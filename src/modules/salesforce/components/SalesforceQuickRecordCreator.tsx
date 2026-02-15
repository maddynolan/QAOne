/**
 * Salesforce Quick Record Creator
 * 
 * Create records quickly with smart defaults.
 * Features:
 * - Smart field detection
 * - Auto-fill with realistic data
 * - Required field validation
 * - Lookup field autocomplete
 * - Create multiple records
 * - Template saving
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Plus, Save, RefreshCw, Loader2, Zap, Search,
  Star, Trash2, Copy, Check, X, FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe } from '@/modules/salesforce/lib/salesforce-api';
import { testDataFactory, STANDARD_OBJECT_TEMPLATES } from '@/modules/salesforce/lib/salesforce-test-data-factory';

interface FieldValue {
  name: string;
  value: any;
  isRequired: boolean;
  type: string;
  label: string;
}

interface RecordTemplate {
  id: string;
  name: string;
  objectName: string;
  fields: FieldValue[];
}

interface CreateResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface SalesforceQuickRecordCreatorProps {
  isConnected: boolean;
}

export function SalesforceQuickRecordCreator({ isConnected }: SalesforceQuickRecordCreatorProps) {
  const [selectedObject, setSelectedObject] = useState('Account');
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createCount, setCreateCount] = useState(1);
  const [results, setResults] = useState<CreateResult[]>([]);
  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [lookupSearchResults, setLookupSearchResults] = useState<{ [key: string]: any[] }>({});

  const objectOptions = useMemo(() => STANDARD_OBJECT_TEMPLATES.map(t => ({
    value: t.apiName,
    label: t.label,
  })), []);

  // Load templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sf_record_templates');
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, []);

  const saveTemplates = useCallback((newTemplates: RecordTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem('sf_record_templates', JSON.stringify(newTemplates));
  }, []);

  const loadObjectFields = useCallback(async () => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      const describe = await salesforceApi.describeSObject(selectedObject);
      setObjectDescribe(describe);

      // Initialize field values
      const fields: FieldValue[] = describe.fields
        .filter(f => f.createable)
        .map(f => ({
          name: f.name,
          value: '',
          isRequired: !f.nillable && !f.defaultValue,
          type: f.type,
          label: f.label,
        }));

      setFieldValues(fields);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, selectedObject]);

  const updateFieldValue = useCallback((fieldName: string, value: any) => {
    setFieldValues(prev =>
      prev.map(f => f.name === fieldName ? { ...f, value } : f)
    );
  }, []);

  const autoFillFields = useCallback(() => {
    if (!objectDescribe) return;

    const template = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === selectedObject);
    if (!template) {
      toast.error('No template found for this object');
      return;
    }

    const generated = testDataFactory.generateRecord(template, {});
    
    setFieldValues(prev =>
      prev.map(f => ({
        ...f,
        value: generated[f.name] ?? f.value,
      }))
    );

    toast.success('Fields auto-filled with test data');
  }, [objectDescribe, selectedObject]);

  const clearFields = useCallback(() => {
    setFieldValues(prev =>
      prev.map(f => ({ ...f, value: '' }))
    );
    setResults([]);
  }, []);

  const searchLookup = useCallback(async (fieldName: string, referenceTo: string, searchTerm: string) => {
    if (!isConnected || searchTerm.length < 2) {
      setLookupSearchResults(prev => ({ ...prev, [fieldName]: [] }));
      return;
    }

    try {
      const query = `SELECT Id, Name FROM ${referenceTo} WHERE Name LIKE '%${searchTerm}%' LIMIT 10`;
      const result = await salesforceApi.query(query);
      setLookupSearchResults(prev => ({ ...prev, [fieldName]: result.records }));
    } catch (e) {
      console.error('Lookup search failed:', e);
    }
  }, [isConnected]);

  const createRecords = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    // Validate required fields
    const missingRequired = fieldValues.filter(f => f.isRequired && !f.value);
    if (missingRequired.length > 0) {
      toast.error(`Missing required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setIsLoading(true);
    setResults([]);

    const newResults: CreateResult[] = [];

    for (let i = 0; i < createCount; i++) {
      // Build record data
      const recordData: any = {};
      fieldValues.forEach(f => {
        if (f.value !== '' && f.value !== null && f.value !== undefined) {
          let value = f.value;
          
          // Handle Name uniqueness for multiple records
          if (f.name === 'Name' && createCount > 1) {
            value = `${value} ${i + 1}`;
          }
          
          recordData[f.name] = value;
        }
      });

      try {
        const result = await salesforceApi.createRecord(selectedObject, recordData);
        newResults.push({ success: true, id: result.id });
      } catch (error: any) {
        newResults.push({ success: false, error: error.message });
      }
    }

    setResults(newResults);
    const successCount = newResults.filter(r => r.success).length;
    toast.success(`Created ${successCount}/${createCount} records`);
    setIsLoading(false);
  }, [isConnected, selectedObject, fieldValues, createCount]);

  const saveAsTemplate = useCallback(() => {
    if (!templateName) {
      toast.error('Please enter a template name');
      return;
    }

    const newTemplate: RecordTemplate = {
      id: `template_${Date.now()}`,
      name: templateName,
      objectName: selectedObject,
      fields: fieldValues.filter(f => f.value),
    };

    saveTemplates([...templates, newTemplate]);
    setTemplateName('');
    toast.success('Template saved');
  }, [templateName, selectedObject, fieldValues, templates, saveTemplates]);

  const loadTemplate = useCallback((template: RecordTemplate) => {
    if (template.objectName !== selectedObject) {
      setSelectedObject(template.objectName);
    }

    setFieldValues(prev =>
      prev.map(f => {
        const templateField = template.fields.find(tf => tf.name === f.name);
        return templateField ? { ...f, value: templateField.value } : f;
      })
    );

    toast.success(`Loaded template: ${template.name}`);
  }, [selectedObject]);

  const deleteTemplate = useCallback((id: string) => {
    saveTemplates(templates.filter(t => t.id !== id));
    toast.success('Template deleted');
  }, [templates, saveTemplates]);

  const filteredFields = useMemo(() => {
    if (showOnlyRequired) {
      return fieldValues.filter(f => f.isRequired);
    }
    return fieldValues;
  }, [fieldValues, showOnlyRequired]);

  const copyResultIds = useCallback(() => {
    const ids = results.filter(r => r.success && r.id).map(r => r.id).join('\n');
    navigator.clipboard.writeText(ids);
    toast.success('IDs copied to clipboard');
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Object Selector */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">Quick Record Creator</CardTitle>
          <CardDescription>Create records quickly with smart defaults</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Object</Label>
              <Select value={selectedObject} onValueChange={setSelectedObject}>
                <SelectTrigger className="bg-input border-border text-foreground">
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
            <div>
              <Label>Record Count</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={createCount}
                onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
                className="bg-input border-border text-foreground"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={loadObjectFields}
                disabled={!isConnected || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Load Fields
              </Button>
              <Button
                variant="outline"
                onClick={autoFillFields}
                disabled={!objectDescribe}
                className="gap-2 text-muted-foreground border-border hover:text-foreground hover:bg-accent"
              >
                <Zap className="w-4 h-4" />
                Auto-Fill
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      {templates.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">Saved Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map(template => (
                <Badge
                  key={template.id}
                  variant="outline"
                  className="cursor-pointer flex items-center gap-1 px-3 py-1 text-muted-foreground border-border hover:bg-accent"
                >
                  <span onClick={() => loadTemplate(template)}>
                    {template.name} ({template.objectName})
                  </span>
                  <X
                    className="w-3 h-3 hover:text-red-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(template.id);
                    }}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field Values */}
      {fieldValues.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-sm">Field Values</CardTitle>
                <CardDescription>
                  {fieldValues.filter(f => f.value).length} of {fieldValues.length} fields set
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showRequired"
                    checked={showOnlyRequired}
                    onCheckedChange={(c) => setShowOnlyRequired(!!c)}
                  />
                  <Label htmlFor="showRequired" className="text-xs text-muted-foreground">
                    Required only
                  </Label>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFields}>
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {filteredFields.map(field => (
                <div key={field.name} className="flex items-center gap-3">
                  <div className="w-40 flex items-center gap-1">
                    <span className={`text-sm ${field.isRequired ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {field.label}
                    </span>
                    {field.isRequired && (
                      <span className="text-red-400 text-xs">*</span>
                    )}
                  </div>
                  <div className="flex-1">
                    {field.type === 'boolean' ? (
                      <Checkbox
                        checked={field.value === true || field.value === 'true'}
                        onCheckedChange={(c) => updateFieldValue(field.name, c)}
                      />
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        value={field.value || ''}
                        onChange={(e) => updateFieldValue(field.name, e.target.value)}
                        className="bg-input border-border text-foreground text-sm min-h-[60px]"
                      />
                    ) : field.type === 'picklist' ? (
                      <Select
                        value={field.value || ''}
                        onValueChange={(v) => updateFieldValue(field.name, v)}
                      >
                        <SelectTrigger className="bg-input border-border text-foreground">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {objectDescribe?.fields
                            .find(f => f.name === field.name)
                            ?.picklistValues
                            .filter(p => p.active)
                            .map(p => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={field.value || ''}
                        onChange={(e) => updateFieldValue(field.name, e.target.value)}
                        type={field.type === 'currency' || field.type === 'number' || field.type === 'percent' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        className="bg-input border-border text-foreground text-sm"
                      />
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] w-20 justify-center text-cyan-300 border-cyan-500/50">
                    {field.type}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <Button
                onClick={createRecords}
                disabled={!isConnected || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create {createCount > 1 ? `${createCount} Records` : 'Record'}
              </Button>
              <div className="flex-1" />
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-40 bg-input border-border text-sm"
              />
              <Button
                variant="outline"
                onClick={saveAsTemplate}
                disabled={!templateName}
                className="gap-2 text-muted-foreground border-border hover:text-foreground hover:bg-accent"
              >
                <Star className="w-4 h-4" />
                Save Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm">
                Results ({results.filter(r => r.success).length}/{results.length} successful)
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={copyResultIds} className="gap-2">
                <Copy className="w-4 h-4" />
                Copy IDs
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded flex items-center gap-2 ${
                    result.success
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  {result.success ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 font-mono text-sm">{result.id}</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm">{result.error}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceQuickRecordCreator;

