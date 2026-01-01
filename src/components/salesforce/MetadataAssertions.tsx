/**
 * Metadata Assertions
 * 
 * Assert on Salesforce org configuration for regression testing:
 * - Field existence and properties
 * - Picklist values
 * - Validation rules
 * - Flows and Process Builders
 * - Permissions and profiles
 * - Record Types
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Shield, Zap, Database, CheckCircle, Plus, RefreshCw, 
  Loader2, ChevronDown, ChevronRight, FileText, Lock,
  AlertTriangle, Eye, Settings, Layers, Box, List,
  ToggleLeft, Code, Users, Key
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe, SObjectField } from '@/lib/salesforce-api';
import { cn } from '@/lib/utils';

// Types
interface MetadataAssertion {
  id: string;
  type: 'field_exists' | 'field_type' | 'field_required' | 'picklist_values' | 
        'validation_rule' | 'flow_active' | 'record_type_exists' | 'permission' |
        'field_visible' | 'owd_setting';
  object?: string;
  field?: string;
  expectedValue?: any;
  description: string;
}

interface MetadataAssertionsProps {
  onAddAsStep?: (step: { type: string; action: string; args: any }) => void;
  className?: string;
}

// Assertion type configurations
const ASSERTION_TYPES = [
  {
    id: 'field_exists',
    label: 'Field Exists',
    icon: Box,
    color: 'blue',
    description: 'Assert a field exists on an object'
  },
  {
    id: 'field_type',
    label: 'Field Type',
    icon: Code,
    color: 'purple',
    description: 'Assert field has expected data type'
  },
  {
    id: 'field_required',
    label: 'Field Required',
    icon: AlertTriangle,
    color: 'amber',
    description: 'Assert field is required/optional'
  },
  {
    id: 'picklist_values',
    label: 'Picklist Values',
    icon: List,
    color: 'emerald',
    description: 'Assert picklist contains expected values'
  },
  {
    id: 'validation_rule',
    label: 'Validation Rule Active',
    icon: Shield,
    color: 'red',
    description: 'Assert validation rule exists and is active'
  },
  {
    id: 'flow_active',
    label: 'Flow Active',
    icon: Zap,
    color: 'orange',
    description: 'Assert flow/process builder is active'
  },
  {
    id: 'record_type_exists',
    label: 'Record Type Exists',
    icon: FileText,
    color: 'cyan',
    description: 'Assert record type exists and is active'
  },
  {
    id: 'permission',
    label: 'Permission',
    icon: Lock,
    color: 'indigo',
    description: 'Assert profile/permission set has access'
  },
];

export function MetadataAssertions({
  onAddAsStep,
  className
}: MetadataAssertionsProps) {
  // State
  const [selectedType, setSelectedType] = useState<string>('field_exists');
  const [selectedObject, setSelectedObject] = useState<string>('');
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state based on assertion type
  const [selectedField, setSelectedField] = useState<string>('');
  const [expectedType, setExpectedType] = useState<string>('');
  const [isRequired, setIsRequired] = useState<boolean>(true);
  const [expectedPicklistValues, setExpectedPicklistValues] = useState<string>('');
  const [validationRuleName, setValidationRuleName] = useState<string>('');
  const [flowName, setFlowName] = useState<string>('');
  const [recordTypeName, setRecordTypeName] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [permissionType, setPermissionType] = useState<string>('read');
  
  // Metadata lists
  const [allObjects, setAllObjects] = useState<{ name: string; label: string }[]>([]);
  const [validationRules, setValidationRules] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  
  // Load objects
  useEffect(() => {
    loadObjects();
  }, []);
  
  // Load object describe when selected
  useEffect(() => {
    if (selectedObject) {
      loadObjectDescribe(selectedObject);
    }
  }, [selectedObject]);
  
  const loadObjects = async () => {
    try {
      const result = await salesforceApi.describeGlobal();
      setAllObjects(result.sobjects
        .filter((o: any) => o.queryable)
        .map((o: any) => ({ name: o.name, label: o.label }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label))
      );
    } catch (e) {
      console.error('Failed to load objects:', e);
    }
  };
  
  const loadObjectDescribe = async (objectName: string) => {
    setLoading(true);
    try {
      const describe = await salesforceApi.describeSObject(objectName);
      setObjectDescribe(describe);
      
      // Also load validation rules for this object
      try {
        const rules = await salesforceApi.query(`
          SELECT Id, ValidationName, Active, Description, ErrorMessage 
          FROM ValidationRule 
          WHERE EntityDefinition.QualifiedApiName = '${objectName}'
        `);
        setValidationRules(rules.records || []);
      } catch (e) {
        // Validation rules query might fail without certain permissions
        setValidationRules([]);
      }
    } catch (e) {
      console.error('Failed to load object:', e);
    } finally {
      setLoading(false);
    }
  };
  
  // Load flows
  useEffect(() => {
    loadFlows();
    loadProfiles();
  }, []);
  
  const loadFlows = async () => {
    try {
      const result = await salesforceApi.query(`
        SELECT Id, DeveloperName, MasterLabel, ProcessType, Status 
        FROM FlowDefinitionView 
        WHERE IsActive = true
        ORDER BY MasterLabel
        LIMIT 200
      `);
      setFlows(result.records || []);
    } catch (e) {
      console.error('Failed to load flows:', e);
    }
  };
  
  const loadProfiles = async () => {
    try {
      const result = await salesforceApi.query(`
        SELECT Id, Name FROM Profile ORDER BY Name LIMIT 100
      `);
      setProfiles(result.records || []);
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  };
  
  // Generate assertion step
  const addAssertionStep = () => {
    let assertion: MetadataAssertion | null = null;
    
    switch (selectedType) {
      case 'field_exists':
        if (!selectedObject || !selectedField) {
          toast.error('Please select object and field');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'field_exists',
          object: selectedObject,
          field: selectedField,
          description: `Assert ${selectedObject}.${selectedField} exists`
        };
        break;
        
      case 'field_type':
        if (!selectedObject || !selectedField || !expectedType) {
          toast.error('Please select object, field, and expected type');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'field_type',
          object: selectedObject,
          field: selectedField,
          expectedValue: expectedType,
          description: `Assert ${selectedObject}.${selectedField} is type ${expectedType}`
        };
        break;
        
      case 'field_required':
        if (!selectedObject || !selectedField) {
          toast.error('Please select object and field');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'field_required',
          object: selectedObject,
          field: selectedField,
          expectedValue: isRequired,
          description: `Assert ${selectedObject}.${selectedField} is ${isRequired ? 'required' : 'optional'}`
        };
        break;
        
      case 'picklist_values':
        if (!selectedObject || !selectedField || !expectedPicklistValues) {
          toast.error('Please select object, field, and enter expected values');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'picklist_values',
          object: selectedObject,
          field: selectedField,
          expectedValue: expectedPicklistValues.split(',').map(v => v.trim()),
          description: `Assert ${selectedObject}.${selectedField} contains values: ${expectedPicklistValues}`
        };
        break;
        
      case 'validation_rule':
        if (!selectedObject || !validationRuleName) {
          toast.error('Please select object and validation rule');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'validation_rule',
          object: selectedObject,
          expectedValue: validationRuleName,
          description: `Assert validation rule "${validationRuleName}" is active on ${selectedObject}`
        };
        break;
        
      case 'flow_active':
        if (!flowName) {
          toast.error('Please select a flow');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'flow_active',
          expectedValue: flowName,
          description: `Assert flow "${flowName}" is active`
        };
        break;
        
      case 'record_type_exists':
        if (!selectedObject || !recordTypeName) {
          toast.error('Please select object and record type');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'record_type_exists',
          object: selectedObject,
          expectedValue: recordTypeName,
          description: `Assert record type "${recordTypeName}" exists on ${selectedObject}`
        };
        break;
        
      case 'permission':
        if (!selectedObject || !profileName) {
          toast.error('Please select object and profile');
          return;
        }
        assertion = {
          id: `meta_${Date.now()}`,
          type: 'permission',
          object: selectedObject,
          expectedValue: { profile: profileName, access: permissionType },
          description: `Assert ${profileName} has ${permissionType} access on ${selectedObject}`
        };
        break;
    }
    
    if (assertion) {
      onAddAsStep?.({
        type: 'sf_metadata_assert',
        action: 'AssertMetadata',
        args: assertion
      });
      toast.success(`Added metadata assertion: ${assertion.description}`);
    }
  };
  
  // Get field type options
  const fieldTypes = [
    'string', 'textarea', 'email', 'phone', 'url', 'picklist', 'multipicklist',
    'boolean', 'int', 'double', 'currency', 'percent', 'date', 'datetime',
    'reference', 'id', 'address', 'location', 'base64', 'encryptedstring'
  ];
  
  // Get current assertion type config
  const currentType = ASSERTION_TYPES.find(t => t.id === selectedType);
  
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 pb-16 space-y-2">
          
          {/* Assertion Type Picker */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Assertion Type
            </label>
            <div className="grid grid-cols-2 gap-1">
              {ASSERTION_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left transition-all",
                      isSelected 
                        ? `bg-${type.color}-500/10 border-${type.color}-500/30` 
                        : "bg-secondary border-border hover:border-primary/30"
                    )}
                  >
                    <Icon className={cn(
                      "h-3.5 w-3.5",
                      isSelected ? `text-${type.color}-400` : "text-gray-500"
                    )} />
                    <div>
                      <p className={cn(
                        "text-[11px] font-medium",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {type.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Type Description - Compact */}
          {currentType && (
            <div className="px-2 py-1.5 rounded bg-primary/10 border border-primary/20">
              <p className="text-[10px] text-foreground">
                <span className="text-primary font-medium">→</span> {currentType.description}
              </p>
            </div>
          )}
          
          {/* Dynamic Form based on assertion type */}
          <div className="space-y-2 p-2 rounded-lg bg-secondary border border-white/5">
            
            {/* Object picker - needed for most assertions */}
            {['field_exists', 'field_type', 'field_required', 'picklist_values', 'validation_rule', 'record_type_exists', 'permission'].includes(selectedType) && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">Object</label>
                <Select value={selectedObject} onValueChange={setSelectedObject}>
                  <SelectTrigger className="h-8 bg-input border-border text-xs">
                    <SelectValue placeholder="Select object..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-secondary border-border">
                    {allObjects.map(obj => (
                      <SelectItem key={obj.name} value={obj.name} className="text-xs">
                        {obj.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Field picker - for field-based assertions */}
            {['field_exists', 'field_type', 'field_required', 'picklist_values'].includes(selectedType) && objectDescribe && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">Field</label>
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger className="h-8 bg-input border-border text-xs">
                    <SelectValue placeholder="Select field..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-secondary border-border">
                    {objectDescribe.fields.map(field => (
                      <SelectItem key={field.name} value={field.name} className="text-xs">
                        {field.label} ({field.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Field Type expected value */}
            {selectedType === 'field_type' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">Expected Type</label>
                <Select value={expectedType} onValueChange={setExpectedType}>
                  <SelectTrigger className="h-8 bg-input border-border text-xs">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-secondary border-border">
                    {fieldTypes.map(type => (
                      <SelectItem key={type} value={type} className="text-xs">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Field Required toggle */}
            {selectedType === 'field_required' && (
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-muted-foreground">Expected to be Required?</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isRequired ? "default" : "outline"}
                    className={cn("h-7 px-3 text-xs", isRequired && "bg-emerald-600")}
                    onClick={() => setIsRequired(true)}
                  >
                    Required
                  </Button>
                  <Button
                    size="sm"
                    variant={!isRequired ? "default" : "outline"}
                    className={cn("h-7 px-3 text-xs", !isRequired && "bg-gray-600")}
                    onClick={() => setIsRequired(false)}
                  >
                    Optional
                  </Button>
                </div>
              </div>
            )}
            
            {/* Picklist values input */}
            {selectedType === 'picklist_values' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">Expected Values (comma-separated)</label>
                <Input
                  value={expectedPicklistValues}
                  onChange={(e) => setExpectedPicklistValues(e.target.value)}
                  placeholder="Value1, Value2, Value3"
                  className="h-8 bg-input border-border text-xs"
                />
                {selectedField && objectDescribe && (
                  <div className="mt-1">
                    <p className="text-[9px] text-gray-500 mb-1">Current values in org:</p>
                    <div className="flex flex-wrap gap-1">
                      {objectDescribe.fields
                        .find(f => f.name === selectedField)
                        ?.picklistValues?.filter(pv => pv.active)
                        .map(pv => (
                          <Badge 
                            key={pv.value} 
                            variant="outline" 
                            className="h-4 px-1.5 text-[8px] border-white/20 text-gray-400 cursor-pointer hover:bg-white/10"
                            onClick={() => {
                              setExpectedPicklistValues(prev => 
                                prev ? `${prev}, ${pv.value}` : pv.value
                              );
                            }}
                          >
                            {pv.label}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Validation Rule picker */}
            {selectedType === 'validation_rule' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-gray-400">Validation Rule</label>
                {validationRules.length > 0 ? (
                  <Select value={validationRuleName} onValueChange={setValidationRuleName}>
                    <SelectTrigger className="h-8 bg-input border-border text-xs">
                      <SelectValue placeholder="Select rule..." />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border">
                      {validationRules.map(rule => (
                        <SelectItem key={rule.Id} value={rule.ValidationName} className="text-xs">
                          {rule.ValidationName} {rule.Active ? '✓' : '(inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={validationRuleName}
                    onChange={(e) => setValidationRuleName(e.target.value)}
                    placeholder="Enter validation rule API name"
                    className="h-8 bg-input border-border text-xs"
                  />
                )}
              </div>
            )}
            
            {/* Flow picker */}
            {selectedType === 'flow_active' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-gray-400">Flow</label>
                {flows.length > 0 ? (
                  <Select value={flowName} onValueChange={setFlowName}>
                    <SelectTrigger className="h-8 bg-input border-border text-xs">
                      <SelectValue placeholder="Select flow..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] bg-secondary border-border">
                      {flows.map(flow => (
                        <SelectItem key={flow.Id} value={flow.DeveloperName} className="text-xs">
                          {flow.MasterLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder="Enter flow API name"
                    className="h-8 bg-input border-border text-xs"
                  />
                )}
              </div>
            )}
            
            {/* Record Type picker */}
            {selectedType === 'record_type_exists' && objectDescribe && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-gray-400">Record Type</label>
                {objectDescribe.recordTypeInfos?.length > 0 ? (
                  <Select value={recordTypeName} onValueChange={setRecordTypeName}>
                    <SelectTrigger className="h-8 bg-input border-border text-xs">
                      <SelectValue placeholder="Select record type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border">
                      {objectDescribe.recordTypeInfos
                        .filter((rt: any) => rt.developerName !== 'Master')
                        .map((rt: any) => (
                          <SelectItem key={rt.recordTypeId} value={rt.developerName} className="text-xs">
                            {rt.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={recordTypeName}
                    onChange={(e) => setRecordTypeName(e.target.value)}
                    placeholder="Enter record type developer name"
                    className="h-8 bg-input border-border text-xs"
                  />
                )}
              </div>
            )}
            
            {/* Permission - Profile and Access Type */}
            {selectedType === 'permission' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-gray-400">Profile</label>
                  {profiles.length > 0 ? (
                    <Select value={profileName} onValueChange={setProfileName}>
                      <SelectTrigger className="h-8 bg-input border-border text-xs">
                        <SelectValue placeholder="Select profile..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] bg-secondary border-border">
                        {profiles.map(profile => (
                          <SelectItem key={profile.Id} value={profile.Name} className="text-xs">
                            {profile.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Enter profile name"
                      className="h-8 bg-input border-border text-xs"
                    />
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-gray-400">Access Type</label>
                  <div className="flex gap-1.5">
                    {['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'].map(access => (
                      <Button
                        key={access}
                        size="sm"
                        variant={permissionType === access ? "default" : "outline"}
                        className={cn(
                          "h-6 px-2 text-[9px]",
                          permissionType === access && "bg-indigo-600"
                        )}
                        onClick={() => setPermissionType(access)}
                      >
                        {access}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
            
          </div>
          
          {/* Action Bar - Sticky at bottom */}
          <div className="sticky bottom-0 mt-4 px-2 py-2 border-t border-border bg-input -mx-2 space-y-1.5">
            {/* Preview of step to be added */}
            {selectedType && (selectedObject || selectedType === 'flow_active') && (
              <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 font-mono truncate">
                → {selectedType === 'field_exists' && selectedField && `${selectedObject}.${selectedField} exists`}
                {selectedType === 'field_type' && selectedField && `${selectedObject}.${selectedField} is ${expectedType || '?'}`}
                {selectedType === 'field_required' && selectedField && `${selectedObject}.${selectedField} ${isRequired ? 'required' : 'optional'}`}
                {selectedType === 'picklist_values' && selectedField && `${selectedObject}.${selectedField} has values`}
                {selectedType === 'validation_rule' && `${selectedObject} validation rule`}
                {selectedType === 'flow_active' && `Flow "${flowName || '?'}" active`}
                {selectedType === 'record_type_exists' && `${selectedObject} record type`}
                {selectedType === 'permission' && `${profileName || '?'} ${permissionType} ${selectedObject}`}
                {!selectedField && !flowName && ['field_exists', 'field_type', 'field_required', 'picklist_values'].includes(selectedType) && '(select field)'}
              </div>
            )}
            <Button
              className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              onClick={addAssertionStep}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Assertion Step
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default MetadataAssertions;

