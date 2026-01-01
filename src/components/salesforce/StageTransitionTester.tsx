/**
 * Stage Transition Tester
 * 
 * Test stage/status progressions for Salesforce objects:
 * - Opportunity stages
 * - Lead status/conversion
 * - Case status/escalation
 * - Any object with picklist-based stages
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight, Play, Plus, CheckCircle, AlertTriangle,
  Loader2, ChevronRight, RotateCcw, Target, Zap,
  TrendingUp, XCircle, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe, PicklistValue } from '@/lib/salesforce-api';
import { cn } from '@/lib/utils';

// Standard objects with stages/statuses
const STAGE_OBJECTS = [
  { name: 'Opportunity', stageField: 'StageName', label: 'Opportunity Stages' },
  { name: 'Lead', stageField: 'Status', label: 'Lead Status' },
  { name: 'Case', stageField: 'Status', label: 'Case Status' },
  { name: 'Task', stageField: 'Status', label: 'Task Status' },
  { name: 'Campaign', stageField: 'Status', label: 'Campaign Status' },
  { name: 'Contract', stageField: 'Status', label: 'Contract Status' },
  { name: 'Order', stageField: 'Status', label: 'Order Status' },
  { name: 'Quote', stageField: 'Status', label: 'Quote Status' },
];

interface StageStep {
  id: string;
  fromStage: string;
  toStage: string;
  assertions: string[];
}

interface StageTransitionTesterProps {
  onAddAsStep?: (step: { type: string; action: string; args: any }) => void;
  className?: string;
}

export function StageTransitionTester({
  onAddAsStep,
  className
}: StageTransitionTesterProps) {
  // State
  const [selectedObject, setSelectedObject] = useState<string>('Opportunity');
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Stage field and values
  const [stageField, setStageField] = useState<string>('StageName');
  const [stageValues, setStageValues] = useState<PicklistValue[]>([]);
  
  // Test scenario
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  
  // Load object on change
  useEffect(() => {
    if (selectedObject) {
      loadObjectDescribe(selectedObject);
    }
  }, [selectedObject]);
  
  const loadObjectDescribe = async (objectName: string) => {
    setLoading(true);
    try {
      const describe = await salesforceApi.describeSObject(objectName);
      setObjectDescribe(describe);
      
      // Find the stage field
      const stageConfig = STAGE_OBJECTS.find(o => o.name === objectName);
      const fieldName = stageConfig?.stageField || 'Status';
      setStageField(fieldName);
      
      // Get stage values
      const field = describe.fields.find(f => f.name === fieldName);
      if (field?.picklistValues) {
        const activeValues = field.picklistValues.filter(pv => pv.active);
        setStageValues(activeValues);
        
        // Default to all stages in sequence
        if (activeValues.length > 0 && selectedStages.length === 0) {
          setSelectedStages(activeValues.slice(0, 4).map(v => v.value));
        }
      }
    } catch (e) {
      console.error('Failed to load object:', e);
      toast.error('Failed to load object metadata');
    } finally {
      setLoading(false);
    }
  };
  
  // Get color for stage
  const getStageColor = (stage: string, index: number, total: number) => {
    // Try to determine based on common naming
    const lowerStage = stage.toLowerCase();
    
    if (lowerStage.includes('closed') && lowerStage.includes('won')) return 'emerald';
    if (lowerStage.includes('closed') && lowerStage.includes('lost')) return 'red';
    if (lowerStage.includes('closed') || lowerStage.includes('complete')) return 'blue';
    if (lowerStage.includes('escalat')) return 'orange';
    if (lowerStage.includes('new') || lowerStage.includes('open')) return 'cyan';
    
    // Gradient based on position
    const colors = ['cyan', 'blue', 'purple', 'amber', 'emerald'];
    return colors[Math.min(index, colors.length - 1)];
  };
  
  // Add stage to test
  const addStage = (stage: string) => {
    if (!selectedStages.includes(stage)) {
      setSelectedStages([...selectedStages, stage]);
    }
  };
  
  // Remove stage from test
  const removeStage = (stage: string) => {
    setSelectedStages(selectedStages.filter(s => s !== stage));
  };
  
  // Move stage in sequence
  const moveStage = (fromIndex: number, toIndex: number) => {
    const newStages = [...selectedStages];
    const [moved] = newStages.splice(fromIndex, 1);
    newStages.splice(toIndex, 0, moved);
    setSelectedStages(newStages);
  };
  
  // Generate complete test steps
  const generateTestSteps = () => {
    if (selectedStages.length < 2) {
      toast.error('Select at least 2 stages for the test');
      return;
    }
    
    // Add initial creation step
    onAddAsStep?.({
      type: 'sf_create_record',
      action: 'CreateRecord',
      args: {
        objectType: selectedObject,
        initialStage: selectedStages[0],
        stageField: stageField,
        storeAs: `{{${selectedObject.toLowerCase()}Id}}`,
        description: `Create ${selectedObject} at ${selectedStages[0]}`
      }
    });
    
    // Add stage transition steps
    for (let i = 1; i < selectedStages.length; i++) {
      const fromStage = selectedStages[i - 1];
      const toStage = selectedStages[i];
      
      onAddAsStep?.({
        type: 'sf_update_stage',
        action: 'UpdateStage',
        args: {
          recordId: `{{${selectedObject.toLowerCase()}Id}}`,
          objectType: selectedObject,
          stageField: stageField,
          fromStage: fromStage,
          toStage: toStage,
          description: `Move ${selectedObject} from "${fromStage}" to "${toStage}"`
        }
      });
      
      // Add assertion after each transition
      onAddAsStep?.({
        type: 'sf_assert_field',
        action: 'AssertFieldValue',
        args: {
          recordId: `{{${selectedObject.toLowerCase()}Id}}`,
          objectType: selectedObject,
          field: stageField,
          expectedValue: toStage,
          description: `Assert ${stageField} = "${toStage}"`
        }
      });
    }
    
    toast.success(`Added ${selectedStages.length * 2 - 1} test steps for stage progression`);
  };
  
  // Add single transition step
  const addTransitionStep = (fromStage: string, toStage: string) => {
    onAddAsStep?.({
      type: 'sf_update_stage',
      action: 'UpdateStage',
      args: {
        recordId: `{{${selectedObject.toLowerCase()}Id}}`,
        objectType: selectedObject,
        stageField: stageField,
        fromStage: fromStage,
        toStage: toStage,
        description: `Move ${selectedObject} from "${fromStage}" to "${toStage}"`
      }
    });
    toast.success(`Added stage transition step`);
  };
  
  // Special actions for specific objects
  const getSpecialActions = () => {
    switch (selectedObject) {
      case 'Lead':
        return [
          { label: 'Convert Lead', action: 'ConvertLead', icon: ArrowUpRight },
          { label: 'Qualify Lead', action: 'QualifyLead', icon: CheckCircle },
        ];
      case 'Case':
        return [
          { label: 'Escalate Case', action: 'EscalateCase', icon: TrendingUp },
          { label: 'Close Case', action: 'CloseCase', icon: CheckCircle },
        ];
      case 'Opportunity':
        return [
          { label: 'Close Won', action: 'CloseWon', icon: CheckCircle },
          { label: 'Close Lost', action: 'CloseLost', icon: XCircle },
        ];
      default:
        return [];
    }
  };
  
  const specialActions = getSpecialActions();
  
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 pb-16 space-y-2">
          
          {/* Object Picker */}
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Object
            </label>
            <Select value={selectedObject} onValueChange={setSelectedObject}>
              <SelectTrigger className="h-8 bg-card border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                {STAGE_OBJECTS.map(obj => (
                  <SelectItem key={obj.name} value={obj.name} className="text-xs">
                    {obj.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
          )}
          
          {!loading && stageValues.length > 0 && (
            <>
              {/* Available Stages */}
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Available Stages ({stageField})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {stageValues.map((stage, idx) => {
                    const color = getStageColor(stage.value, idx, stageValues.length);
                    const isSelected = selectedStages.includes(stage.value);
                    
                    return (
                      <button
                        key={stage.value}
                        onClick={() => isSelected ? removeStage(stage.value) : addStage(stage.value)}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium transition-all",
                          isSelected
                            ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/40`
                            : "bg-secondary text-muted-foreground border border-border hover:bg-accent"
                        )}
                      >
                        {stage.label}
                        {isSelected && (
                          <span className="ml-1.5 text-[8px] opacity-60">
                            #{selectedStages.indexOf(stage.value) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Selected Progression */}
              {selectedStages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Test Progression
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-1.5 text-[9px] text-muted-foreground"
                      onClick={() => setSelectedStages([])}
                    >
                      <RotateCcw className="h-3 w-3 mr-0.5" />
                      Clear
                    </Button>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center flex-wrap gap-1">
                      {selectedStages.map((stage, idx) => {
                        const stageInfo = stageValues.find(s => s.value === stage);
                        const color = getStageColor(stage, idx, selectedStages.length);
                        
                        return (
                          <div key={stage} className="flex items-center">
                            <Badge 
                              variant="outline"
                              className={cn(
                                "h-6 px-2 text-[10px] cursor-pointer hover:opacity-80",
                                `border-${color}-500/40 text-${color}-400 bg-${color}-500/10`
                              )}
                              onClick={() => removeStage(stage)}
                            >
                              {stageInfo?.label || stage}
                            </Badge>
                            {idx < selectedStages.length - 1 && (
                              <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Transition Details */}
                    {selectedStages.length >= 2 && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        <p className="text-[9px] text-muted-foreground uppercase">Transitions to test:</p>
                        {selectedStages.slice(1).map((toStage, idx) => {
                          const fromStage = selectedStages[idx];
                          return (
                            <div 
                              key={`${fromStage}-${toStage}`}
                              className="flex items-center justify-between text-[10px] text-muted-foreground"
                            >
                              <span>
                                {idx + 1}. {fromStage} → {toStage}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1.5 text-[9px] text-cyan-400"
                                onClick={() => addTransitionStep(fromStage, toStage)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              
              {/* Special Actions */}
              {specialActions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Special Actions
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {specialActions.map(action => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.action}
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs border-border hover:border-cyan-500/40 justify-start"
                          onClick={() => {
                            onAddAsStep?.({
                              type: `sf_${action.action.toLowerCase()}`,
                              action: action.action,
                              args: {
                                recordId: `{{${selectedObject.toLowerCase()}Id}}`,
                                description: `${action.label}`
                              }
                            });
                            toast.success(`Added "${action.label}" step`);
                          }}
                        >
                          <Icon className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Quick Templates */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Quick Templates
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { 
                  obj: 'Opportunity', 
                  stages: ['Prospecting', 'Qualification', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won'],
                  label: 'Opp: Full Win Path'
                },
                { 
                  obj: 'Opportunity', 
                  stages: ['Prospecting', 'Qualification', 'Closed Lost'],
                  label: 'Opp: Loss Path'
                },
                { 
                  obj: 'Case', 
                  stages: ['New', 'Working', 'Escalated', 'Closed'],
                  label: 'Case: Escalation Path'
                },
                { 
                  obj: 'Lead', 
                  stages: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted'],
                  label: 'Lead: Conversion Path'
                },
              ].map((template, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedObject(template.obj);
                    // Need to wait for object to load
                    setTimeout(() => setSelectedStages(template.stages), 500);
                  }}
                  className="flex items-center gap-2 p-2 rounded bg-secondary hover:bg-accent text-left transition-colors"
                >
                  <Target className="h-3 w-3 text-cyan-400 shrink-0" />
                  <span className="text-[10px] text-muted-foreground">{template.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Action Bar - Sticky at bottom */}
          {selectedStages.length >= 2 && (
            <div className="sticky bottom-0 mt-4 px-2 py-2 border-t border-border bg-card -mx-2">
              <Button
                className="w-full h-8 bg-cyan-600 hover:bg-cyan-700 text-xs"
                onClick={generateTestSteps}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Generate Stage Test ({selectedStages.length * 2 - 1} steps)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default StageTransitionTester;

