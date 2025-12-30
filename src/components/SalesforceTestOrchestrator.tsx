/**
 * Salesforce Test Orchestrator
 * 
 * Unified testing hub that integrates all Salesforce testing capabilities:
 * 1. Auto-discovery of testable items (validation rules, flows, objects)
 * 2. One-click test suite generation
 * 3. Smart test recommendations
 * 4. Context-aware test recording
 * 5. Integrated data generation
 * 6. Comprehensive reporting
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Wand2, Play, Search, Database, Shield, Zap, GitBranch, Users,
  FileText, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  ChevronRight, ChevronDown, Download, Copy, Eye, Target, Layers,
  ArrowRight, Sparkles, ListChecks, Clock, BarChart, Settings,
  PlusCircle, Workflow, TestTube, Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi } from '@/lib/salesforce-api';
import { testDataFactory } from '@/lib/salesforce-test-data-factory';

interface DiscoveredItem {
  type: 'validation' | 'flow' | 'apex' | 'trigger' | 'object' | 'field';
  id: string;
  name: string;
  object?: string;
  description?: string;
  active?: boolean;
  testable: boolean;
}

interface GeneratedTest {
  id: string;
  name: string;
  type: 'positive' | 'negative' | 'boundary' | 'integration' | 'e2e';
  category: string;
  sourceItem: string;
  steps: string[];
  testData?: any;
  assertions: string[];
  status: 'draft' | 'ready' | 'pass' | 'fail';
}

interface TestSuite {
  id: string;
  name: string;
  object: string;
  tests: GeneratedTest[];
  coverage: {
    validationRules: number;
    flows: number;
    fields: number;
    crud: boolean;
  };
  createdAt: string;
}

interface SalesforceTestOrchestratorProps {
  isConnected: boolean;
  onRunTest?: (test: GeneratedTest) => void;
  onRecordTest?: (test: GeneratedTest) => void;
}

export function SalesforceTestOrchestrator({ 
  isConnected, 
  onRunTest,
  onRecordTest 
}: SalesforceTestOrchestratorProps) {
  // Discovery State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredItem[]>([]);
  
  // Generation State
  const [selectedObject, setSelectedObject] = useState('Account');
  const [objects, setObjects] = useState<string[]>([
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event', 'Campaign'
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuite, setGeneratedSuite] = useState<TestSuite | null>(null);
  
  // Options
  const [options, setOptions] = useState({
    includeValidationTests: true,
    includeFlowTests: true,
    includeCrudTests: true,
    includeFieldTests: true,
    includeSecurityTests: true,
    includeApiTests: true,
    includeNegativeTests: true,
    includeBoundaryTests: true,
    generateTestData: true,
  });

  // ========== DISCOVERY ==========
  
  const scanOrg = useCallback(async () => {
    const currentOrg = salesforceApi.getCurrentOrg();
    if (!currentOrg) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    setIsScanning(true);
    setScanProgress(0);
    setDiscoveredItems([]);
    
    const items: DiscoveredItem[] = [];
    
    try {
      // Scan Validation Rules
      setScanProgress(10);
      toast.info('Scanning validation rules...');
      try {
        const validationQuery = `SELECT Id, ValidationName, EntityDefinition.QualifiedApiName, Active, Description FROM ValidationRule LIMIT 100`;
        const validationResult = await salesforceApi.toolingQuery(validationQuery);
        (validationResult.records || []).forEach((rule: any) => {
          items.push({
            type: 'validation',
            id: rule.Id,
            name: rule.ValidationName,
            object: rule.EntityDefinition?.QualifiedApiName,
            description: rule.Description,
            active: rule.Active,
            testable: true,
          });
        });
      } catch (e) {
        console.warn('Could not scan validation rules:', e);
      }
      
      // Scan Flows
      setScanProgress(30);
      toast.info('Scanning flows...');
      try {
        const flowQuery = `SELECT Id, DeveloperName, MasterLabel, ProcessType, Description FROM FlowDefinition WHERE ProcessType IN ('Workflow', 'AutoLaunchedFlow', 'Flow') LIMIT 100`;
        const flowResult = await salesforceApi.toolingQuery(flowQuery);
        (flowResult.records || []).forEach((flow: any) => {
          items.push({
            type: 'flow',
            id: flow.Id,
            name: flow.MasterLabel || flow.DeveloperName,
            description: flow.Description,
            active: true,
            testable: true,
          });
        });
      } catch (e) {
        console.warn('Could not scan flows:', e);
      }
      
      // Scan Apex Test Classes
      setScanProgress(50);
      toast.info('Scanning Apex classes...');
      try {
        const apexQuery = `SELECT Id, Name FROM ApexClass WHERE Status = 'Active' AND (Name LIKE '%Test%' OR Name LIKE '%test%') LIMIT 50`;
        const apexResult = await salesforceApi.toolingQuery(apexQuery);
        (apexResult.records || []).forEach((cls: any) => {
          items.push({
            type: 'apex',
            id: cls.Id,
            name: cls.Name,
            testable: true,
          });
        });
      } catch (e) {
        console.warn('Could not scan Apex classes:', e);
      }
      
      // Scan Triggers
      setScanProgress(70);
      toast.info('Scanning triggers...');
      try {
        const triggerQuery = `SELECT Id, Name, TableEnumOrId FROM ApexTrigger WHERE Status = 'Active' LIMIT 50`;
        const triggerResult = await salesforceApi.toolingQuery(triggerQuery);
        (triggerResult.records || []).forEach((trigger: any) => {
          items.push({
            type: 'trigger',
            id: trigger.Id,
            name: trigger.Name,
            object: trigger.TableEnumOrId,
            active: true,
            testable: true,
          });
        });
      } catch (e) {
        console.warn('Could not scan triggers:', e);
      }
      
      setScanProgress(100);
      setDiscoveredItems(items);
      toast.success(`Discovery complete! Found ${items.length} testable items`);
      
    } catch (error: any) {
      console.error('Scan error:', error);
      toast.error('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ========== TEST GENERATION ==========
  
  const generateTestSuite = useCallback(async () => {
    const currentOrg = salesforceApi.getCurrentOrg();
    if (!currentOrg) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    setIsGenerating(true);
    const tests: GeneratedTest[] = [];
    
    try {
      // Get object metadata
      toast.info(`Analyzing ${selectedObject}...`);
      let objectDescribe: any = null;
      try {
        objectDescribe = await salesforceApi.describeSObject(selectedObject);
      } catch (e) {
        console.warn('Could not describe object:', e);
      }
      
      // CRUD Tests
      if (options.includeCrudTests) {
        tests.push({
          id: `crud-create-${Date.now()}`,
          name: `Create ${selectedObject}`,
          type: 'positive',
          category: 'CRUD',
          sourceItem: selectedObject,
          steps: [
            `Navigate to ${selectedObject} tab`,
            'Click New button',
            'Fill required fields',
            'Click Save',
            `Verify ${selectedObject} record is created`,
          ],
          assertions: [
            'Record ID is generated',
            'All fields are saved correctly',
            'Record appears in list view',
          ],
          status: 'ready',
        });
        
        tests.push({
          id: `crud-read-${Date.now()}`,
          name: `View ${selectedObject}`,
          type: 'positive',
          category: 'CRUD',
          sourceItem: selectedObject,
          steps: [
            `Navigate to ${selectedObject} list`,
            'Click on a record',
            'Verify record details page loads',
          ],
          assertions: [
            'Record details are displayed',
            'All fields are visible',
            'Related lists load correctly',
          ],
          status: 'ready',
        });
        
        tests.push({
          id: `crud-update-${Date.now()}`,
          name: `Edit ${selectedObject}`,
          type: 'positive',
          category: 'CRUD',
          sourceItem: selectedObject,
          steps: [
            `Open ${selectedObject} record`,
            'Click Edit',
            'Modify fields',
            'Click Save',
            'Verify changes are saved',
          ],
          assertions: [
            'Edit mode is activated',
            'Fields are editable',
            'Changes are persisted',
          ],
          status: 'ready',
        });
        
        tests.push({
          id: `crud-delete-${Date.now()}`,
          name: `Delete ${selectedObject}`,
          type: 'positive',
          category: 'CRUD',
          sourceItem: selectedObject,
          steps: [
            `Open ${selectedObject} record`,
            'Click Delete',
            'Confirm deletion',
            'Verify record is deleted',
          ],
          assertions: [
            'Confirmation dialog appears',
            'Record is removed',
            'Record in Recycle Bin',
          ],
          status: 'ready',
        });
      }
      
      // Validation Rule Tests
      if (options.includeValidationTests) {
        const validationItems = discoveredItems.filter(
          item => item.type === 'validation' && item.object === selectedObject
        );
        
        for (const rule of validationItems) {
          // Positive test (valid data)
          tests.push({
            id: `val-pos-${rule.id}`,
            name: `${rule.name} - Valid Data`,
            type: 'positive',
            category: 'Validation Rules',
            sourceItem: rule.name,
            steps: [
              `Create ${selectedObject} with valid data`,
              'Ensure all validation criteria are met',
              'Save the record',
            ],
            assertions: [
              'Record saves successfully',
              'No validation errors',
            ],
            status: 'ready',
          });
          
          // Negative test (invalid data)
          if (options.includeNegativeTests) {
            tests.push({
              id: `val-neg-${rule.id}`,
              name: `${rule.name} - Invalid Data`,
              type: 'negative',
              category: 'Validation Rules',
              sourceItem: rule.name,
              steps: [
                `Create ${selectedObject} with invalid data`,
                'Violate the validation rule criteria',
                'Attempt to save',
              ],
              assertions: [
                'Validation error is displayed',
                'Record is NOT saved',
                'Error message matches rule message',
              ],
              status: 'ready',
            });
          }
        }
      }
      
      // Flow Tests
      if (options.includeFlowTests) {
        const flowItems = discoveredItems.filter(item => item.type === 'flow');
        
        for (const flow of flowItems.slice(0, 5)) {
          tests.push({
            id: `flow-${flow.id}`,
            name: `Flow: ${flow.name}`,
            type: 'e2e',
            category: 'Flows & Automation',
            sourceItem: flow.name,
            steps: [
              'Trigger the flow conditions',
              'Verify flow executes',
              'Check flow actions completed',
            ],
            assertions: [
              'Flow is triggered',
              'Expected actions are performed',
              'Data is updated correctly',
            ],
            status: 'ready',
          });
        }
      }
      
      // API Tests
      if (options.includeApiTests) {
        tests.push({
          id: `api-query-${Date.now()}`,
          name: `API: Query ${selectedObject}`,
          type: 'integration',
          category: 'API Tests',
          sourceItem: 'REST API',
          steps: [
            `Send GET request to /query?q=SELECT+Id,Name+FROM+${selectedObject}`,
            'Verify response status 200',
            'Verify records returned',
          ],
          assertions: [
            'HTTP 200 response',
            'Response contains records array',
            'totalSize is present',
          ],
          status: 'ready',
        });
        
        tests.push({
          id: `api-create-${Date.now()}`,
          name: `API: Create ${selectedObject}`,
          type: 'integration',
          category: 'API Tests',
          sourceItem: 'REST API',
          steps: [
            `Send POST request to /sobjects/${selectedObject}`,
            'Include required fields in body',
            'Verify response status 201',
          ],
          assertions: [
            'HTTP 201 response',
            'Response contains id',
            'success is true',
          ],
          status: 'ready',
        });
      }
      
      // Field Tests
      if (options.includeFieldTests && objectDescribe) {
        const requiredFields = objectDescribe.fields?.filter(
          (f: any) => !f.nillable && f.createable && f.name !== 'Id'
        ) || [];
        
        for (const field of requiredFields.slice(0, 3)) {
          tests.push({
            id: `field-req-${field.name}`,
            name: `Required Field: ${field.label}`,
            type: 'negative',
            category: 'Field Validation',
            sourceItem: field.name,
            steps: [
              `Create ${selectedObject} without ${field.label}`,
              'Attempt to save',
            ],
            assertions: [
              'Required field error is shown',
              'Record is NOT saved',
            ],
            status: 'ready',
          });
        }
      }
      
      // Boundary Tests
      if (options.includeBoundaryTests && objectDescribe) {
        const textFields = objectDescribe.fields?.filter(
          (f: any) => f.type === 'string' && f.length > 0 && f.createable
        ) || [];
        
        for (const field of textFields.slice(0, 2)) {
          tests.push({
            id: `boundary-${field.name}`,
            name: `Boundary: ${field.label} Max Length`,
            type: 'boundary',
            category: 'Boundary Tests',
            sourceItem: field.name,
            steps: [
              `Enter ${field.length} characters in ${field.label}`,
              `Enter ${field.length + 1} characters`,
              'Verify behavior',
            ],
            assertions: [
              `${field.length} chars accepted`,
              `${field.length + 1} chars rejected or truncated`,
            ],
            status: 'ready',
          });
        }
      }
      
      // Generate test data if requested
      if (options.generateTestData) {
        try {
          const testDataRecords = testDataFactory.generateRecords({
            objectName: selectedObject,
            count: 3,
            industry: 'generic',
          });
          
          tests.forEach(test => {
            if (test.category === 'CRUD' || test.category === 'Validation Rules') {
              test.testData = testDataRecords[0]?.data;
            }
          });
        } catch (e) {
          console.warn('Could not generate test data:', e);
        }
      }
      
      // Create test suite
      const suite: TestSuite = {
        id: Date.now().toString(),
        name: `${selectedObject} Test Suite`,
        object: selectedObject,
        tests,
        coverage: {
          validationRules: tests.filter(t => t.category === 'Validation Rules').length / 2,
          flows: tests.filter(t => t.category === 'Flows & Automation').length,
          fields: tests.filter(t => t.category === 'Field Validation').length,
          crud: options.includeCrudTests,
        },
        createdAt: new Date().toISOString(),
      };
      
      setGeneratedSuite(suite);
      toast.success(`Generated ${tests.length} test cases for ${selectedObject}!`);
      
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Generation failed: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedObject, options, discoveredItems]);

  // ========== EXPORT ==========
  
  const exportSuite = useCallback(() => {
    if (!generatedSuite) return;
    
    const exportData = {
      ...generatedSuite,
      exportedAt: new Date().toISOString(),
      format: 'qa-ai-test-suite',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedObject}-test-suite.json`;
    a.click();
    
    toast.success('Test suite exported!');
  }, [generatedSuite, selectedObject]);

  const copyAsMarkdown = useCallback(() => {
    if (!generatedSuite) return;
    
    const markdown = `# ${generatedSuite.name}

Generated: ${new Date(generatedSuite.createdAt).toLocaleString()}

## Coverage
- CRUD Operations: ${generatedSuite.coverage.crud ? '✅' : '❌'}
- Validation Rules: ${generatedSuite.coverage.validationRules} tests
- Flows: ${generatedSuite.coverage.flows} tests
- Field Validation: ${generatedSuite.coverage.fields} tests

## Test Cases

${generatedSuite.tests.map((test, idx) => `
### ${idx + 1}. ${test.name}
**Type:** ${test.type} | **Category:** ${test.category}

**Steps:**
${test.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Assertions:**
${test.assertions.map(a => `- ${a}`).join('\n')}
`).join('\n---\n')}
`;
    
    navigator.clipboard.writeText(markdown);
    toast.success('Copied as Markdown!');
  }, [generatedSuite]);

  // ========== STATS ==========
  
  const stats = useMemo(() => {
    if (!discoveredItems.length) return null;
    
    return {
      validationRules: discoveredItems.filter(i => i.type === 'validation').length,
      flows: discoveredItems.filter(i => i.type === 'flow').length,
      apexClasses: discoveredItems.filter(i => i.type === 'apex').length,
      triggers: discoveredItems.filter(i => i.type === 'trigger').length,
      total: discoveredItems.length,
    };
  }, [discoveredItems]);

  const testStats = useMemo(() => {
    if (!generatedSuite) return null;
    
    const byCategory: { [key: string]: number } = {};
    const byType: { [key: string]: number } = {};
    
    generatedSuite.tests.forEach(test => {
      byCategory[test.category] = (byCategory[test.category] || 0) + 1;
      byType[test.type] = (byType[test.type] || 0) + 1;
    });
    
    return { byCategory, byType, total: generatedSuite.tests.length };
  }, [generatedSuite]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Rocket className="w-6 h-6 text-purple-400" />
            Test Orchestrator
          </h2>
          <p className="text-sm text-slate-400">
            Auto-discover, generate, and manage comprehensive Salesforce tests
          </p>
        </div>
      </div>

      {/* Step 1: Discovery */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Step 1: Discover Testable Items
          </CardTitle>
          <CardDescription>
            Scan your org for validation rules, flows, triggers, and Apex classes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={scanOrg}
              disabled={isScanning || !isConnected}
              className="gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isScanning ? 'Scanning...' : 'Scan Org'}
            </Button>
            
            {isScanning && (
              <div className="flex-1">
                <Progress value={scanProgress} className="h-2" />
                <p className="text-xs text-slate-400 mt-1">{scanProgress}% complete</p>
              </div>
            )}
            
            {stats && (
              <div className="flex gap-3">
                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                  <Shield className="w-3 h-3 mr-1" />
                  {stats.validationRules} Rules
                </Badge>
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  <Zap className="w-3 h-3 mr-1" />
                  {stats.flows} Flows
                </Badge>
                <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                  <FileText className="w-3 h-3 mr-1" />
                  {stats.apexClasses} Apex
                </Badge>
                <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                  <GitBranch className="w-3 h-3 mr-1" />
                  {stats.triggers} Triggers
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Configure & Generate */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            Step 2: Generate Test Suite
          </CardTitle>
          <CardDescription>
            Configure options and auto-generate comprehensive test cases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Object Selection */}
          <div className="flex items-center gap-4">
            <Label className="text-slate-400">Target Object:</Label>
            <select
              value={selectedObject}
              onChange={(e) => setSelectedObject(e.target.value)}
              className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white"
            >
              {objects.map(obj => (
                <option key={obj} value={obj}>{obj}</option>
              ))}
            </select>
            
            <Button
              onClick={generateTestSuite}
              disabled={isGenerating || !isConnected}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Test Suite
            </Button>
          </div>
          
          {/* Options */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-medium">Test Types</Label>
              {[
                { key: 'includeCrudTests', label: 'CRUD Tests' },
                { key: 'includeValidationTests', label: 'Validation Rules' },
                { key: 'includeFlowTests', label: 'Flow Tests' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-medium">Coverage</Label>
              {[
                { key: 'includeFieldTests', label: 'Field Validation' },
                { key: 'includeSecurityTests', label: 'Security Tests' },
                { key: 'includeApiTests', label: 'API Tests' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-medium">Advanced</Label>
              {[
                { key: 'includeNegativeTests', label: 'Negative Tests' },
                { key: 'includeBoundaryTests', label: 'Boundary Tests' },
                { key: 'generateTestData', label: 'Generate Test Data' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-slate-400">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Generated Tests */}
      {generatedSuite && (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-green-400" />
                Step 3: Review & Execute ({generatedSuite.tests.length} Tests)
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyAsMarkdown} className="gap-1.5 text-slate-300 border-slate-600">
                  <Copy className="w-3.5 h-3.5" />
                  Copy MD
                </Button>
                <Button size="sm" variant="outline" onClick={exportSuite} className="gap-1.5 text-slate-300 border-slate-600">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            {testStats && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                {Object.entries(testStats.byCategory).map(([cat, count]) => (
                  <div key={cat} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                    <div className="text-lg font-bold text-white">{count}</div>
                    <div className="text-xs text-slate-400">{cat}</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Test List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {generatedSuite.tests.map((test, idx) => (
                <div
                  key={test.id}
                  className="p-3 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{idx + 1}.</span>
                        <span className="font-medium text-white">{test.name}</span>
                        <Badge className={
                          test.type === 'positive' ? 'bg-green-600' :
                          test.type === 'negative' ? 'bg-red-600' :
                          test.type === 'boundary' ? 'bg-yellow-600' :
                          test.type === 'integration' ? 'bg-blue-600' :
                          'bg-purple-600'
                        }>
                          {test.type}
                        </Badge>
                        <Badge variant="outline" className="text-slate-400 border-slate-600">
                          {test.category}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        <span className="text-slate-400">Steps:</span> {test.steps.length} |{' '}
                        <span className="text-slate-400">Assertions:</span> {test.assertions.length}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordTest?.(test)}
                        className="h-7 px-2 text-slate-400 hover:text-white"
                        title="Record this test"
                      >
                        <TestTube className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRunTest?.(test)}
                        className="h-7 px-2 text-slate-400 hover:text-green-400"
                        title="Run this test"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Target, label: 'Run All Tests', color: 'green', action: () => toast.info('Coming soon!') },
          { icon: TestTube, label: 'Record Tests', color: 'blue', action: () => toast.info('Coming soon!') },
          { icon: BarChart, label: 'View Report', color: 'purple', action: () => toast.info('Coming soon!') },
          { icon: Settings, label: 'Configure', color: 'slate', action: () => toast.info('Coming soon!') },
        ].map((action, idx) => (
          <Button
            key={idx}
            variant="outline"
            onClick={action.action}
            className={`h-16 flex-col gap-1 text-slate-300 border-slate-700 hover:border-${action.color}-500/50 hover:bg-${action.color}-500/10`}
          >
            <action.icon className={`w-5 h-5 text-${action.color}-400`} />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}



