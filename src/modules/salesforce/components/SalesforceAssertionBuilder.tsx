/**
 * Salesforce SOQL Assertion Builder
 * 
 * Build database assertions for test validation.
 * Features:
 * - Visual assertion builder
 * - SOQL query generation
 * - Record count assertions
 * - Field value assertions
 * - Relationship assertions
 * - Export to test script
 */

import { useState, useCallback, useMemo } from 'react';
import {
  CheckCircle, Plus, Trash2, Copy, Code, Database,
  Hash, Type, Calendar, ToggleLeft, List, Loader2,
  Play, ChevronDown, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';
import { STANDARD_OBJECT_TEMPLATES } from '@/modules/salesforce/lib/salesforce-test-data-factory';

interface Assertion {
  id: string;
  type: 'count' | 'exists' | 'field_equals' | 'field_contains' | 'field_not_empty' | 'related_count';
  objectName: string;
  fieldName?: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  expectedValue?: any;
  whereClause?: string;
  relatedObject?: string;
  relatedField?: string;
  description: string;
}

interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actualValue: any;
  expectedValue: any;
  message: string;
  query: string;
}

interface SalesforceAssertionBuilderProps {
  isConnected: boolean;
  onExportAssertions?: (assertions: Assertion[]) => void;
}

export function SalesforceAssertionBuilder({ isConnected, onExportAssertions }: SalesforceAssertionBuilderProps) {
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [results, setResults] = useState<AssertionResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedObject, setSelectedObject] = useState('Account');
  const [selectedField, setSelectedField] = useState('');
  const [assertionType, setAssertionType] = useState<Assertion['type']>('count');
  const [operator, setOperator] = useState<Assertion['operator']>('=');
  const [expectedValue, setExpectedValue] = useState('');
  const [whereClause, setWhereClause] = useState('');
  const [description, setDescription] = useState('');

  const objectOptions = useMemo(() => STANDARD_OBJECT_TEMPLATES.map(t => ({
    value: t.apiName,
    label: t.label,
  })), []);

  const fieldOptions = useMemo(() => {
    const template = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === selectedObject);
    return template?.fields.map(f => ({
      value: f.name,
      label: f.label,
      type: f.type,
    })) || [];
  }, [selectedObject]);

  const assertionTypes = [
    { value: 'count', label: 'Record Count', icon: Hash, description: 'Assert number of records' },
    { value: 'exists', label: 'Record Exists', icon: CheckCircle, description: 'Assert record exists' },
    { value: 'field_equals', label: 'Field Equals', icon: Type, description: 'Assert field value equals' },
    { value: 'field_contains', label: 'Field Contains', icon: List, description: 'Assert field contains text' },
    { value: 'field_not_empty', label: 'Field Not Empty', icon: AlertCircle, description: 'Assert field is not empty' },
    { value: 'related_count', label: 'Related Count', icon: Database, description: 'Assert related record count' },
  ];

  const operators = [
    { value: '=', label: 'Equals (=)' },
    { value: '!=', label: 'Not Equals (!=)' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '>=', label: 'Greater or Equal (>=)' },
    { value: '<=', label: 'Less or Equal (<=)' },
    { value: 'LIKE', label: 'Like (LIKE)' },
    { value: 'IN', label: 'In (IN)' },
  ];

  const addAssertion = useCallback(() => {
    const newAssertion: Assertion = {
      id: `assertion_${Date.now()}`,
      type: assertionType,
      objectName: selectedObject,
      fieldName: ['field_equals', 'field_contains', 'field_not_empty'].includes(assertionType) ? selectedField : undefined,
      operator: ['count', 'field_equals'].includes(assertionType) ? operator : undefined,
      expectedValue: expectedValue || undefined,
      whereClause: whereClause || undefined,
      description: description || generateDefaultDescription(),
    };
    
    setAssertions(prev => [...prev, newAssertion]);
    setDescription('');
    setExpectedValue('');
    setWhereClause('');
    toast.success('Assertion added');
  }, [assertionType, selectedObject, selectedField, operator, expectedValue, whereClause, description]);

  const generateDefaultDescription = () => {
    switch (assertionType) {
      case 'count':
        return `Assert ${selectedObject} count ${operator} ${expectedValue}`;
      case 'exists':
        return `Assert ${selectedObject} exists`;
      case 'field_equals':
        return `Assert ${selectedObject}.${selectedField} ${operator} ${expectedValue}`;
      case 'field_contains':
        return `Assert ${selectedObject}.${selectedField} contains "${expectedValue}"`;
      case 'field_not_empty':
        return `Assert ${selectedObject}.${selectedField} is not empty`;
      case 'related_count':
        return `Assert ${selectedObject} has related records`;
      default:
        return 'New assertion';
    }
  };

  const removeAssertion = useCallback((id: string) => {
    setAssertions(prev => prev.filter(a => a.id !== id));
    setResults(prev => prev.filter(r => r.assertionId !== id));
  }, []);

  const generateSOQL = useCallback((assertion: Assertion): string => {
    let query = '';
    
    switch (assertion.type) {
      case 'count':
        query = `SELECT COUNT() FROM ${assertion.objectName}`;
        if (assertion.whereClause) {
          query += ` WHERE ${assertion.whereClause}`;
        }
        break;
      
      case 'exists':
        query = `SELECT Id FROM ${assertion.objectName}`;
        if (assertion.whereClause) {
          query += ` WHERE ${assertion.whereClause}`;
        }
        query += ' LIMIT 1';
        break;
      
      case 'field_equals':
      case 'field_contains':
      case 'field_not_empty':
        query = `SELECT Id, ${assertion.fieldName} FROM ${assertion.objectName}`;
        if (assertion.whereClause) {
          query += ` WHERE ${assertion.whereClause}`;
        }
        query += ' LIMIT 1';
        break;
      
      case 'related_count':
        query = `SELECT COUNT() FROM ${assertion.relatedObject || 'Contact'} WHERE ${assertion.relatedField || 'AccountId'} != null`;
        if (assertion.whereClause) {
          query += ` AND ${assertion.whereClause}`;
        }
        break;
    }
    
    return query;
  }, []);

  const runAssertions = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    if (assertions.length === 0) {
      toast.error('No assertions to run');
      return;
    }

    setIsRunning(true);
    const newResults: AssertionResult[] = [];

    for (const assertion of assertions) {
      try {
        const query = generateSOQL(assertion);
        let passed = false;
        let actualValue: any = null;
        let message = '';

        if (assertion.type === 'count') {
          const result = await salesforceApi.query(query);
          actualValue = result.totalSize;
          
          switch (assertion.operator) {
            case '=': passed = actualValue === parseInt(assertion.expectedValue); break;
            case '!=': passed = actualValue !== parseInt(assertion.expectedValue); break;
            case '>': passed = actualValue > parseInt(assertion.expectedValue); break;
            case '<': passed = actualValue < parseInt(assertion.expectedValue); break;
            case '>=': passed = actualValue >= parseInt(assertion.expectedValue); break;
            case '<=': passed = actualValue <= parseInt(assertion.expectedValue); break;
            default: passed = actualValue === parseInt(assertion.expectedValue);
          }
          message = passed 
            ? `Count is ${actualValue} (expected ${assertion.operator} ${assertion.expectedValue})`
            : `Count is ${actualValue}, expected ${assertion.operator} ${assertion.expectedValue}`;
        }
        else if (assertion.type === 'exists') {
          const result = await salesforceApi.query(query);
          actualValue = result.totalSize > 0;
          passed = actualValue;
          message = passed ? 'Record exists' : 'Record does not exist';
        }
        else if (assertion.type === 'field_equals') {
          const result = await salesforceApi.query(query);
          if (result.records.length > 0 && assertion.fieldName) {
            actualValue = result.records[0][assertion.fieldName];
            passed = String(actualValue) === String(assertion.expectedValue);
            message = passed 
              ? `Field value matches: "${actualValue}"`
              : `Field value "${actualValue}" does not match expected "${assertion.expectedValue}"`;
          } else {
            message = 'No matching record found';
          }
        }
        else if (assertion.type === 'field_contains') {
          const result = await salesforceApi.query(query);
          if (result.records.length > 0 && assertion.fieldName) {
            actualValue = result.records[0][assertion.fieldName];
            passed = String(actualValue || '').toLowerCase().includes(String(assertion.expectedValue || '').toLowerCase());
            message = passed 
              ? `Field contains "${assertion.expectedValue}"`
              : `Field value "${actualValue}" does not contain "${assertion.expectedValue}"`;
          } else {
            message = 'No matching record found';
          }
        }
        else if (assertion.type === 'field_not_empty') {
          const result = await salesforceApi.query(query);
          if (result.records.length > 0 && assertion.fieldName) {
            actualValue = result.records[0][assertion.fieldName];
            passed = actualValue !== null && actualValue !== undefined && actualValue !== '';
            message = passed ? 'Field is not empty' : 'Field is empty';
          } else {
            message = 'No matching record found';
          }
        }

        newResults.push({
          assertionId: assertion.id,
          passed,
          actualValue,
          expectedValue: assertion.expectedValue,
          message,
          query,
        });
      } catch (error: any) {
        newResults.push({
          assertionId: assertion.id,
          passed: false,
          actualValue: null,
          expectedValue: assertion.expectedValue,
          message: `Error: ${error.message}`,
          query: generateSOQL(assertion),
        });
      }
    }

    setResults(newResults);
    const passedCount = newResults.filter(r => r.passed).length;
    toast.success(`Assertions complete: ${passedCount}/${newResults.length} passed`);
    setIsRunning(false);
  }, [isConnected, assertions, generateSOQL]);

  const exportToPlaywright = useCallback(() => {
    const code = assertions.map(assertion => {
      const query = generateSOQL(assertion);
      let assertionCode = `// ${assertion.description}\n`;
      
      switch (assertion.type) {
        case 'count':
          assertionCode += `const result = await sfApi.query(\`${query}\`);\n`;
          assertionCode += `expect(result.totalSize).toBe(${assertion.expectedValue});\n`;
          break;
        case 'exists':
          assertionCode += `const result = await sfApi.query(\`${query}\`);\n`;
          assertionCode += `expect(result.totalSize).toBeGreaterThan(0);\n`;
          break;
        case 'field_equals':
          assertionCode += `const result = await sfApi.query(\`${query}\`);\n`;
          assertionCode += `expect(result.records[0].${assertion.fieldName}).toBe('${assertion.expectedValue}');\n`;
          break;
        case 'field_contains':
          assertionCode += `const result = await sfApi.query(\`${query}\`);\n`;
          assertionCode += `expect(result.records[0].${assertion.fieldName}).toContain('${assertion.expectedValue}');\n`;
          break;
        case 'field_not_empty':
          assertionCode += `const result = await sfApi.query(\`${query}\`);\n`;
          assertionCode += `expect(result.records[0].${assertion.fieldName}).toBeTruthy();\n`;
          break;
        default:
          assertionCode += `// TODO: Implement assertion\n`;
      }
      
      return assertionCode;
    }).join('\n');

    navigator.clipboard.writeText(code);
    toast.success('Automated assertions copied to clipboard');
  }, [assertions, generateSOQL]);

  const getResultForAssertion = useCallback((assertionId: string) => {
    return results.find(r => r.assertionId === assertionId);
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Assertion Builder */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">Build Assertion</CardTitle>
          <CardDescription>Create database assertions for test validation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Assertion Type */}
            <div>
              <Label>Assertion Type</Label>
              <Select value={assertionType} onValueChange={(v: any) => setAssertionType(v)}>
                <SelectTrigger className="bg-input border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assertionTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        <t.icon className="w-4 h-4" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {assertionTypes.find(t => t.value === assertionType)?.description}
              </p>
            </div>

            {/* Object */}
            <div>
              <Label>Object</Label>
              <Select value={selectedObject} onValueChange={setSelectedObject}>
                <SelectTrigger className="bg-input border-input text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {objectOptions.map(obj => (
                    <SelectItem key={obj.value} value={obj.value}>
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field (if applicable) */}
            {['field_equals', 'field_contains', 'field_not_empty'].includes(assertionType) && (
              <div>
                <Label>Field</Label>
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger className="bg-input border-input text-foreground">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldOptions.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Operator (if applicable) */}
            {['count', 'field_equals'].includes(assertionType) && (
              <div>
                <Label>Operator</Label>
                <Select value={operator} onValueChange={(v: any) => setOperator(v)}>
                  <SelectTrigger className="bg-input border-input text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Expected Value */}
            {['count', 'field_equals', 'field_contains'].includes(assertionType) && (
              <div>
                <Label>Expected Value</Label>
                <Input
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                  placeholder={assertionType === 'count' ? 'e.g., 10' : 'e.g., Acme Corp'}
                  className="bg-input border-input text-foreground"
                />
              </div>
            )}

            {/* Where Clause */}
            <div className="col-span-2">
              <Label>WHERE Clause (optional)</Label>
              <Input
                value={whereClause}
                onChange={(e) => setWhereClause(e.target.value)}
                placeholder="e.g., CreatedDate = TODAY AND Status = 'Active'"
                className="bg-input border-input text-foreground"
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={generateDefaultDescription()}
                className="bg-input border-input text-foreground"
              />
            </div>
          </div>

          <Button onClick={addAssertion} className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            Add Assertion
          </Button>
        </CardContent>
      </Card>

      {/* Assertions List */}
      {assertions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Assertions ({assertions.length})</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPlaywright}
                  className="gap-2 text-foreground border-border hover:bg-accent"
                >
                  <Code className="w-4 h-4" />
                  Export Script
                </Button>
                <Button
                  onClick={runAssertions}
                  disabled={!isConnected || isRunning}
                  className="gap-2"
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assertions.map(assertion => {
                const result = getResultForAssertion(assertion.id);
                return (
                  <div
                    key={assertion.id}
                    className={`p-4 rounded-lg border ${
                      result
                        ? result.passed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-100 dark:bg-slate-900/50 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {result && (
                          result.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                          )
                        )}
                        <div>
                          <div className="font-medium text-white">{assertion.description}</div>
                          <div className="text-sm text-slate-400 mt-1">
                            {assertionTypes.find(t => t.value === assertion.type)?.label} •{' '}
                            {assertion.objectName}
                            {assertion.fieldName && `.${assertion.fieldName}`}
                          </div>
                          {result && (
                            <div className={`text-sm mt-2 ${result.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {result.message}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            {generateSOQL(assertion)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAssertion(assertion.id)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceAssertionBuilder;

