/**
 * Salesforce Record Cloner
 * 
 * Clone records with all related data.
 * Features:
 * - Clone single records
 * - Deep clone (parent + children)
 * - Modify field values during clone
 * - Clone multiple records
 * - Preview before clone
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Copy, Plus, Trash2, Search, Check, X, Loader2,
  ChevronDown, ChevronRight, RefreshCw, Eye, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe } from '@/lib/salesforce-api';
import { STANDARD_OBJECT_TEMPLATES } from '@/lib/salesforce-test-data-factory';

interface FieldOverride {
  fieldName: string;
  originalValue: any;
  newValue: any;
}

interface CloneResult {
  success: boolean;
  originalId: string;
  newId?: string;
  error?: string;
  childResults?: CloneResult[];
}

interface SalesforceRecordClonerProps {
  isConnected: boolean;
}

export function SalesforceRecordCloner({ isConnected }: SalesforceRecordClonerProps) {
  const [recordId, setRecordId] = useState('');
  const [objectType, setObjectType] = useState('');
  const [sourceRecord, setSourceRecord] = useState<any>(null);
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<FieldOverride[]>([]);
  const [includeRelated, setIncludeRelated] = useState(false);
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloneResults, setCloneResults] = useState<CloneResult[]>([]);
  const [cloneCount, setCloneCount] = useState(1);

  const objectOptions = useMemo(() => STANDARD_OBJECT_TEMPLATES.map(t => ({
    value: t.apiName,
    label: t.label,
  })), []);

  const detectObjectType = useCallback((id: string) => {
    if (id.length < 3) return '';
    const prefix = id.substring(0, 3);
    const keyPrefixMap: { [key: string]: string } = {
      '001': 'Account',
      '003': 'Contact',
      '00Q': 'Lead',
      '006': 'Opportunity',
      '500': 'Case',
      '00T': 'Task',
      '00U': 'Event',
      '701': 'Campaign',
      '01t': 'Product2',
      '800': 'Contract',
    };
    return keyPrefixMap[prefix] || '';
  }, []);

  const loadSourceRecord = useCallback(async () => {
    if (!isConnected || !recordId) {
      toast.error('Please enter a record ID');
      return;
    }

    let objType = objectType;
    if (!objType) {
      objType = detectObjectType(recordId);
      if (objType) {
        setObjectType(objType);
      } else {
        toast.error('Could not detect object type. Please select one.');
        return;
      }
    }

    setIsLoading(true);
    try {
      // Get object describe
      const describe = await salesforceApi.describeSObject(objType);
      setObjectDescribe(describe);

      // Get record data
      const record = await salesforceApi.getRecord(objType, recordId);
      setSourceRecord(record);

      // Initialize field overrides with current values
      const overrides: FieldOverride[] = [];
      describe.fields.forEach(field => {
        if (field.createable && record[field.name] !== undefined) {
          overrides.push({
            fieldName: field.name,
            originalValue: record[field.name],
            newValue: record[field.name],
          });
        }
      });
      setFieldOverrides(overrides);

      toast.success(`Loaded ${objType} record`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, recordId, objectType, detectObjectType]);

  const updateFieldOverride = useCallback((fieldName: string, newValue: any) => {
    setFieldOverrides(prev => 
      prev.map(f => f.fieldName === fieldName ? { ...f, newValue } : f)
    );
  }, []);

  const resetFieldOverride = useCallback((fieldName: string) => {
    setFieldOverrides(prev => 
      prev.map(f => f.fieldName === fieldName ? { ...f, newValue: f.originalValue } : f)
    );
  }, []);

  const cloneRecord = useCallback(async () => {
    if (!isConnected || !sourceRecord || !objectType) {
      toast.error('Please load a record first');
      return;
    }

    setIsLoading(true);
    setCloneResults([]);

    try {
      const results: CloneResult[] = [];

      for (let i = 0; i < cloneCount; i++) {
        // Build clone data
        const cloneData: any = {};
        fieldOverrides.forEach(override => {
          if (override.newValue !== null && override.newValue !== undefined) {
            let value = override.newValue;
            
            // Handle Name field uniqueness
            if (override.fieldName === 'Name' && cloneCount > 1) {
              value = `${value} (Clone ${i + 1})`;
            }
            
            cloneData[override.fieldName] = value;
          }
        });

        // Remove system fields that can't be cloned
        delete cloneData.Id;
        delete cloneData.CreatedDate;
        delete cloneData.CreatedById;
        delete cloneData.LastModifiedDate;
        delete cloneData.LastModifiedById;
        delete cloneData.SystemModstamp;
        delete cloneData.IsDeleted;
        
        // Remove State/Country picklist code fields (they auto-populate from the name fields)
        // These cause "Mismatched integration value and ISO code" errors
        delete cloneData.BillingCountryCode;
        delete cloneData.BillingStateCode;
        delete cloneData.ShippingCountryCode;
        delete cloneData.ShippingStateCode;
        delete cloneData.MailingCountryCode;
        delete cloneData.MailingStateCode;
        delete cloneData.OtherCountryCode;
        delete cloneData.OtherStateCode;
        delete cloneData.CountryCode;
        delete cloneData.StateCode;

        try {
          const result = await salesforceApi.createRecord(objectType, cloneData);
          results.push({
            success: true,
            originalId: recordId,
            newId: result.id,
          });

          // Clone related records if enabled
          if (includeRelated && selectedRelationships.length > 0 && result.id) {
            const childResults: CloneResult[] = [];
            
            for (const relName of selectedRelationships) {
              const relationship = objectDescribe?.childRelationships?.find(
                r => r.relationshipName === relName
              );
              
              if (relationship) {
                try {
                  // Query child records
                  const query = `SELECT Id FROM ${relationship.childSObject} WHERE ${relationship.field} = '${recordId}'`;
                  const childRecords = await salesforceApi.query(query);
                  
                  for (const childRecord of childRecords.records) {
                    try {
                      // Get full child record
                      const fullChild = await salesforceApi.getRecord(
                        relationship.childSObject,
                        childRecord.Id
                      );
                      
                      // Clone child with new parent reference
                      const childCloneData = { ...fullChild };
                      delete childCloneData.Id;
                      delete childCloneData.attributes;
                      delete childCloneData.CreatedDate;
                      delete childCloneData.CreatedById;
                      delete childCloneData.LastModifiedDate;
                      delete childCloneData.LastModifiedById;
                      childCloneData[relationship.field] = result.id;
                      
                      const childResult = await salesforceApi.createRecord(
                        relationship.childSObject,
                        childCloneData
                      );
                      
                      childResults.push({
                        success: true,
                        originalId: childRecord.Id,
                        newId: childResult.id,
                      });
                    } catch (e: any) {
                      childResults.push({
                        success: false,
                        originalId: childRecord.Id,
                        error: e.message,
                      });
                    }
                  }
                } catch (e: any) {
                  console.error(`Failed to clone ${relName}:`, e);
                }
              }
            }
            
            results[results.length - 1].childResults = childResults;
          }
        } catch (error: any) {
          results.push({
            success: false,
            originalId: recordId,
            error: error.message,
          });
        }
      }

      setCloneResults(results);
      const successCount = results.filter(r => r.success).length;
      toast.success(`Cloned ${successCount}/${cloneCount} records`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sourceRecord, objectType, fieldOverrides, cloneCount, includeRelated, selectedRelationships, recordId, objectDescribe]);

  const creatableFields = useMemo(() => {
    if (!objectDescribe) return [];
    return objectDescribe.fields.filter(f => f.createable && !f.name.endsWith('Id') || f.name === 'Name');
  }, [objectDescribe]);

  const modifiedFields = useMemo(() => {
    return fieldOverrides.filter(f => f.newValue !== f.originalValue);
  }, [fieldOverrides]);

  return (
    <div className="space-y-4">
      {/* Source Record Selector */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">Record Cloner</CardTitle>
          <CardDescription>Clone Salesforce records with modifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Record ID</Label>
              <Input
                value={recordId}
                onChange={(e) => {
                  // Sanitize input - remove whitespace and non-printable characters
                  const cleanValue = e.target.value.trim().replace(/[\t\n\r]/g, '');
                  setRecordId(cleanValue);
                  const detected = detectObjectType(cleanValue);
                  if (detected) setObjectType(detected);
                }}
                placeholder="e.g., 001xx000003DGbYAAW"
                className="bg-input border-border text-foreground font-mono"
              />
            </div>
            <div>
              <Label>Object Type</Label>
              <Select value={objectType} onValueChange={setObjectType}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue placeholder="Auto-detected" />
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
              <Label>Clone Count</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={cloneCount}
                onChange={(e) => setCloneCount(parseInt(e.target.value) || 1)}
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button
              onClick={loadSourceRecord}
              disabled={!isConnected || isLoading || !recordId}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Load Record
            </Button>

            {objectDescribe && objectDescribe.childRelationships && objectDescribe.childRelationships.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeRelated"
                  checked={includeRelated}
                  onCheckedChange={(c) => setIncludeRelated(!!c)}
                />
                <Label htmlFor="includeRelated" className="text-sm text-slate-400">
                  Include related records
                </Label>
              </div>
            )}
          </div>

          {/* Related Relationships Selector */}
          {includeRelated && objectDescribe?.childRelationships && (
            <div className="mt-4 p-3 bg-secondary rounded-lg">
              <Label className="text-sm text-slate-400">Select relationships to clone:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {objectDescribe.childRelationships
                  .filter(r => r.relationshipName)
                  .slice(0, 10)
                  .map(rel => (
                    <Badge
                      key={rel.relationshipName}
                      variant={selectedRelationships.includes(rel.relationshipName) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        selectedRelationships.includes(rel.relationshipName) 
                          ? 'bg-blue-600 text-foreground hover:bg-blue-700' 
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                      onClick={() => {
                        setSelectedRelationships(prev =>
                          prev.includes(rel.relationshipName)
                            ? prev.filter(r => r !== rel.relationshipName)
                            : [...prev, rel.relationshipName]
                        );
                      }}
                    >
                      {rel.childSObject} ({rel.relationshipName})
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field Overrides */}
      {sourceRecord && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-sm">Field Values</CardTitle>
                <CardDescription>Modify values before cloning</CardDescription>
              </div>
              {modifiedFields.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-400">
                  {modifiedFields.length} modified
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {creatableFields.slice(0, 20).map(field => {
                const override = fieldOverrides.find(f => f.fieldName === field.name);
                const isModified = override && override.newValue !== override.originalValue;
                
                return (
                  <div
                    key={field.name}
                    className={`flex items-center gap-3 p-2 rounded ${
                      isModified ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-secondary'
                    }`}
                  >
                    <div className="w-40 text-sm text-slate-400 truncate">{field.label}</div>
                    <Input
                      value={override?.newValue ?? ''}
                      onChange={(e) => updateFieldOverride(field.name, e.target.value)}
                      className="flex-1 bg-input border-border text-sm"
                    />
                    {isModified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetFieldOverride(field.name)}
                        className="text-slate-400"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    <Badge variant="outline" className="text-[10px] text-cyan-300 border-cyan-500/50">
                      {field.type}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={cloneRecord}
              disabled={!isConnected || isLoading}
              className="mt-4 gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              Clone {cloneCount > 1 ? `${cloneCount} Records` : 'Record'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Clone Results */}
      {cloneResults.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-sm">Clone Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cloneResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    result.success
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-foreground font-mono text-sm">
                      {result.originalId} → {result.newId || 'Failed'}
                    </span>
                  </div>
                  {result.error && (
                    <div className="text-sm text-red-400 mt-1">{result.error}</div>
                  )}
                  {result.childResults && result.childResults.length > 0 && (
                    <div className="mt-2 pl-4 text-xs text-slate-400">
                      Cloned {result.childResults.filter(r => r.success).length}/{result.childResults.length} related records
                    </div>
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

export default SalesforceRecordCloner;

