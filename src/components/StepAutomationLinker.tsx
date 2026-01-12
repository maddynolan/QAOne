/**
 * Step Automation Linker Component
 * 
 * A comprehensive UI for linking recorded automation actions to manual test steps.
 * Supports many-to-one linking, multiple link modes, and step grouping.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { 
  CheckCircle, Circle, ArrowRight, X, Plus, Trash2, 
  ChevronDown, ChevronRight, Link2, Unlink, RefreshCw,
  Play, Video, Sparkles, Layers, FileText, Settings,
  Eye, EyeOff, GripVertical, MoreVertical, Check,
  Copy, Wand2, AlertCircle, Info, Zap, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AutomationAction,
  LinkMode,
  AutomationStatus,
  LinkedStep,
  createLinkedStep,
  generateActionDescription,
  generateGroupDescription,
  generateExpectedResult,
  calculateCoverage,
  mergeToStep,
  findBestStepMatch,
  convertRecordedAction,
} from "@/lib/automation-linking";

// ============================================================================
// TYPES
// ============================================================================

interface ManualStep {
  id: string;
  name?: string;
  description?: string;
  manualAction?: string;
  expectedResult?: string;
  type?: string;
  qword?: string;  // Already has automation
  args?: string[];
  selectorObj?: any;
}

interface StepAutomationLinkerProps {
  // Manual steps to automate
  manualSteps: ManualStep[];
  
  // Current step being recorded for
  currentStepIndex: number;
  onCurrentStepChange: (index: number) => void;
  
  // Step automation mappings
  stepLinks: Record<number, {
    actions: AutomationAction[];
    linkMode: LinkMode;
    isComplete: boolean;
  }>;
  onStepLinksChange: (links: Record<number, {
    actions: AutomationAction[];
    linkMode: LinkMode;
    isComplete: boolean;
  }>) => void;
  
  // Recording state
  isRecording?: boolean;
  pendingActions?: AutomationAction[];  // Actions waiting to be linked
  onClearPendingAction?: (id: string) => void;
  
  // Settings
  defaultLinkMode?: LinkMode;
  groupingEnabled?: boolean;
  onGroupingChange?: (enabled: boolean) => void;
  autoAdvance?: boolean;
  onAutoAdvanceChange?: (enabled: boolean) => void;
  
  // Actions
  onSkipStep?: (index: number) => void;
  onMergeComplete?: (linkedSteps: LinkedStep[]) => void;
  onStartRecording?: (stepIndex: number) => void;
  
  // Display options
  compact?: boolean;
  showMergePreview?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Individual step card showing manual description and linked automation
 */
function StepCard({
  step,
  index,
  isCurrent,
  linkedActions,
  linkMode,
  isComplete,
  isRecording,
  groupingEnabled,
  onSelect,
  onAddAction,
  onRemoveAction,
  onClearAll,
  onSkip,
  onLinkModeChange,
  onMarkComplete,
  onStartRecording,
}: {
  step: ManualStep;
  index: number;
  isCurrent: boolean;
  linkedActions: AutomationAction[];
  linkMode: LinkMode;
  isComplete: boolean;
  isRecording: boolean;
  groupingEnabled: boolean;
  onSelect: () => void;
  onAddAction: (action: AutomationAction) => void;
  onRemoveAction: (actionId: string) => void;
  onClearAll: () => void;
  onSkip: () => void;
  onLinkModeChange: (mode: LinkMode) => void;
  onMarkComplete: () => void;
  onStartRecording?: () => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const hasAutomation = linkedActions.length > 0;
  const hasExistingAutomation = step.qword && step.args;
  
  // Auto-expand when becomes current
  useEffect(() => {
    if (isCurrent) setExpanded(true);
  }, [isCurrent]);
  
  const statusColor = useMemo(() => {
    if (isComplete && hasAutomation) return 'bg-green-500/20 border-green-500/50 text-green-400';
    if (hasAutomation) return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
    if (hasExistingAutomation) return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
    if (isCurrent) return 'bg-purple-500/20 border-purple-500/50 text-purple-400';
    return 'bg-card border-border/50 text-muted-foreground';
  }, [isComplete, hasAutomation, hasExistingAutomation, isCurrent]);
  
  const statusIcon = useMemo(() => {
    if (isComplete && hasAutomation) return <CheckCircle className="h-4 w-4 text-green-400" />;
    if (hasAutomation) return <Link2 className="h-4 w-4 text-blue-400" />;
    if (hasExistingAutomation) return <Zap className="h-4 w-4 text-emerald-400" />;
    if (isCurrent) return <ArrowRight className="h-4 w-4 text-purple-400 animate-pulse" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  }, [isComplete, hasAutomation, hasExistingAutomation, isCurrent]);
  
  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        statusColor,
        isCurrent && "ring-2 ring-purple-500/30"
      )}
    >
      {/* Header - Always visible */}
      <div
        onClick={onSelect}
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-white/5"
      >
        {/* Step number */}
        <div className={cn(
          "flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono font-bold shrink-0",
          isCurrent ? "bg-purple-500 text-white" : "bg-white/10"
        )}>
          {String(index + 1).padStart(2, '0')}
        </div>
        
        {/* Status icon */}
        {statusIcon}
        
        {/* Step name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {step.name || step.manualAction || step.description || `Step ${index + 1}`}
          </p>
          {linkedActions.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">
              {linkedActions.length} action{linkedActions.length !== 1 ? 's' : ''} linked
            </p>
          )}
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasExistingAutomation && !hasAutomation && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Pre-automated
            </Badge>
          )}
          {linkedActions.length > 1 && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
              Grouped
            </Badge>
          )}
        </div>
        
        {/* Expand/collapse */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
          {/* Manual description */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              Manual Description
            </Label>
            <p className="text-sm bg-black/20 rounded p-2">
              {step.manualAction || step.description || step.name || 'No description'}
            </p>
            {step.expectedResult && (
              <p className="text-xs text-muted-foreground">
                Expected: {step.expectedResult}
              </p>
            )}
          </div>
          
          {/* Linked automation actions */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1 justify-between">
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Linked Automation ({linkedActions.length})
              </span>
              {linkedActions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onClearAll(); }}
                >
                  Clear All
                </Button>
              )}
            </Label>
            
            {linkedActions.length === 0 ? (
              <div className="text-xs text-muted-foreground bg-black/20 rounded p-3 text-center">
                {isRecording && isCurrent ? (
                  <span className="text-purple-400">Recording... actions will appear here</span>
                ) : hasExistingAutomation ? (
                  <span className="text-emerald-400">Using pre-existing automation: {step.qword}</span>
                ) : (
                  <span>No automation linked yet</span>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {linkedActions.map((action, actionIdx) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 text-xs bg-black/20 rounded p-2 group"
                  >
                    <span className="text-muted-foreground w-4 shrink-0">{actionIdx + 1}.</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {action.qword}
                    </Badge>
                    <span className="flex-1 truncate">
                      {action.description || generateActionDescription(action)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); onRemoveAction(action.id); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Link mode selector */}
          {linkedActions.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Link Mode</Label>
              <Select value={linkMode} onValueChange={(v) => onLinkModeChange(v as LinkMode)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      Document - Keep manual text
                    </span>
                  </SelectItem>
                  <SelectItem value="replace">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3" />
                      Replace - Use generated text
                    </span>
                  </SelectItem>
                  <SelectItem value="hybrid">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3 w-3" />
                      Hybrid - Manual + automation
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isCurrent && !hasAutomation && onStartRecording && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                onClick={(e) => { e.stopPropagation(); onStartRecording(); }}
              >
                <Video className="h-3 w-3 mr-1" />
                Record
              </Button>
            )}
            {isCurrent && !hasAutomation && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); onSkip(); }}
              >
                Skip (Manual)
              </Button>
            )}
            {hasAutomation && !isComplete && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-400 border-green-500/30 hover:bg-green-500/10"
                onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark Complete
              </Button>
            )}
            {groupingEnabled && linkedActions.length > 0 && linkedActions.length < 10 && (
              <Badge variant="outline" className="text-[10px]">
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Add more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Action picker dialog for manually linking actions
 */
function ActionPickerDialog({
  open,
  onOpenChange,
  availableActions,
  onSelectAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableActions: AutomationAction[];
  onSelectAction: (action: AutomationAction) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Action to Step</DialogTitle>
          <DialogDescription>
            Select an action to link to the current step
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-1">
            {availableActions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No unlinked actions available
              </p>
            ) : (
              availableActions.map((action) => (
                <Button
                  key={action.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-3"
                  onClick={() => {
                    onSelectAction(action);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {action.qword}
                    </Badge>
                    <span className="text-sm truncate flex-1 text-left">
                      {action.description || generateActionDescription(action)}
                    </span>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StepAutomationLinker({
  manualSteps,
  currentStepIndex,
  onCurrentStepChange,
  stepLinks,
  onStepLinksChange,
  isRecording = false,
  pendingActions = [],
  onClearPendingAction,
  defaultLinkMode = 'document',
  groupingEnabled = true,
  onGroupingChange,
  autoAdvance = true,
  onAutoAdvanceChange,
  onSkipStep,
  onMergeComplete,
  onStartRecording,
  compact = false,
  showMergePreview = false,
}: StepAutomationLinkerProps) {
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  
  // Calculate coverage
  const coverage = useMemo(() => {
    const linkedSteps: LinkedStep[] = manualSteps.map((step, idx) => {
      const link = stepLinks[idx];
      return createLinkedStep(
        step,
        link?.actions || [],
        link?.linkMode || defaultLinkMode
      );
    });
    return calculateCoverage(linkedSteps);
  }, [manualSteps, stepLinks, defaultLinkMode]);
  
  // Get all unlinked actions
  const unlinkedActions = useMemo(() => {
    const linkedActionIds = new Set<string>();
    Object.values(stepLinks).forEach(link => {
      link.actions.forEach(a => linkedActionIds.add(a.id));
    });
    return pendingActions.filter(a => !linkedActionIds.has(a.id));
  }, [pendingActions, stepLinks]);
  
  // Link an action to a step
  const linkActionToStep = useCallback((stepIndex: number, action: AutomationAction) => {
    const existing = stepLinks[stepIndex] || { actions: [], linkMode: defaultLinkMode, isComplete: false };
    
    // Check if already at max for non-grouping mode
    if (!groupingEnabled && existing.actions.length >= 1) {
      return; // Replace mode would need different handling
    }
    
    const newLinks = {
      ...stepLinks,
      [stepIndex]: {
        ...existing,
        actions: [...existing.actions, action],
      },
    };
    
    onStepLinksChange(newLinks);
    
    // Auto-advance if enabled and this completes the step
    if (autoAdvance && stepIndex === currentStepIndex) {
      const nextUnlinked = findNextUnlinkedStep(stepIndex + 1);
      if (nextUnlinked !== -1) {
        onCurrentStepChange(nextUnlinked);
      }
    }
  }, [stepLinks, defaultLinkMode, groupingEnabled, autoAdvance, currentStepIndex, onStepLinksChange, onCurrentStepChange]);
  
  // Find next step without automation
  const findNextUnlinkedStep = useCallback((startIndex: number): number => {
    for (let i = startIndex; i < manualSteps.length; i++) {
      const link = stepLinks[i];
      if (!link || link.actions.length === 0) {
        return i;
      }
    }
    return -1;
  }, [manualSteps.length, stepLinks]);
  
  // Remove action from step
  const removeActionFromStep = useCallback((stepIndex: number, actionId: string) => {
    const existing = stepLinks[stepIndex];
    if (!existing) return;
    
    const newActions = existing.actions.filter(a => a.id !== actionId);
    
    if (newActions.length === 0) {
      const { [stepIndex]: _, ...rest } = stepLinks;
      onStepLinksChange(rest);
    } else {
      onStepLinksChange({
        ...stepLinks,
        [stepIndex]: { ...existing, actions: newActions },
      });
    }
  }, [stepLinks, onStepLinksChange]);
  
  // Clear all actions from step
  const clearStepActions = useCallback((stepIndex: number) => {
    const { [stepIndex]: _, ...rest } = stepLinks;
    onStepLinksChange(rest);
  }, [stepLinks, onStepLinksChange]);
  
  // Skip step (mark as manual)
  const handleSkipStep = useCallback((stepIndex: number) => {
    onSkipStep?.(stepIndex);
    
    // Move to next step
    const next = findNextUnlinkedStep(stepIndex + 1);
    if (next !== -1) {
      onCurrentStepChange(next);
    }
  }, [onSkipStep, findNextUnlinkedStep, onCurrentStepChange]);
  
  // Change link mode for step
  const changeLinkMode = useCallback((stepIndex: number, mode: LinkMode) => {
    const existing = stepLinks[stepIndex];
    if (!existing) return;
    
    onStepLinksChange({
      ...stepLinks,
      [stepIndex]: { ...existing, linkMode: mode },
    });
  }, [stepLinks, onStepLinksChange]);
  
  // Mark step as complete
  const markStepComplete = useCallback((stepIndex: number) => {
    const existing = stepLinks[stepIndex];
    if (!existing) return;
    
    onStepLinksChange({
      ...stepLinks,
      [stepIndex]: { ...existing, isComplete: true },
    });
    
    // Move to next incomplete step
    if (autoAdvance) {
      const next = findNextUnlinkedStep(stepIndex + 1);
      if (next !== -1) {
        onCurrentStepChange(next);
      }
    }
  }, [stepLinks, autoAdvance, findNextUnlinkedStep, onStepLinksChange, onCurrentStepChange]);
  
  // Generate merged result
  const generateMergedSteps = useCallback((): LinkedStep[] => {
    return manualSteps.map((step, idx) => {
      const link = stepLinks[idx];
      return createLinkedStep(
        step,
        link?.actions || [],
        link?.linkMode || defaultLinkMode
      );
    });
  }, [manualSteps, stepLinks, defaultLinkMode]);
  
  // Handle merge completion
  const handleMergeComplete = useCallback(() => {
    const merged = generateMergedSteps();
    onMergeComplete?.(merged);
    setShowMergeDialog(false);
  }, [generateMergedSteps, onMergeComplete]);
  
  // Auto-link pending actions when they arrive
  useEffect(() => {
    if (pendingActions.length > 0 && isRecording) {
      const latestAction = pendingActions[pendingActions.length - 1];
      const isAlreadyLinked = Object.values(stepLinks).some(
        link => link.actions.some(a => a.id === latestAction.id)
      );
      
      if (!isAlreadyLinked) {
        // Auto-link to current step
        linkActionToStep(currentStepIndex, latestAction);
      }
    }
  }, [pendingActions, isRecording, currentStepIndex, stepLinks, linkActionToStep]);
  
  return (
    <div className={cn("flex flex-col h-full", compact && "gap-2")}>
      {/* Header with coverage and settings */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">Step Automation</span>
          </div>
          
          {/* Coverage indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  coverage.percentage === 100 ? "bg-green-500" :
                  coverage.percentage >= 50 ? "bg-blue-500" : "bg-amber-500"
                )}
                style={{ width: `${coverage.percentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {coverage.automated}/{coverage.total}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Settings button */}
          <Popover open={showSettings} onOpenChange={setShowSettings}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Linking Settings</h4>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="grouping" className="text-xs">
                    Allow action grouping
                  </Label>
                  <Switch
                    id="grouping"
                    checked={groupingEnabled}
                    onCheckedChange={onGroupingChange}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoadvance" className="text-xs">
                    Auto-advance steps
                  </Label>
                  <Switch
                    id="autoadvance"
                    checked={autoAdvance}
                    onCheckedChange={onAutoAdvanceChange}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Default link mode</Label>
                  <Select 
                    value={defaultLinkMode} 
                    onValueChange={(v) => {
                      // Would need to lift this state up
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="replace">Replace</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Merge preview button */}
          {coverage.automated > 0 && onMergeComplete && (
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => setShowMergeDialog(true)}
            >
              <Check className="h-3 w-3 mr-1" />
              Merge ({coverage.automated})
            </Button>
          )}
        </div>
      </div>
      
      {/* Unlinked actions notice */}
      {unlinkedActions.length > 0 && (
        <div className="mx-3 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400">
              {unlinkedActions.length} unlinked action{unlinkedActions.length !== 1 ? 's' : ''}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-amber-400"
              onClick={() => setShowActionPicker(true)}
            >
              <Link2 className="h-3 w-3 mr-1" />
              Link
            </Button>
          </div>
        </div>
      )}
      
      {/* Steps list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {manualSteps.map((step, idx) => {
            const link = stepLinks[idx];
            return (
              <StepCard
                key={step.id || idx}
                step={step}
                index={idx}
                isCurrent={currentStepIndex === idx}
                linkedActions={link?.actions || []}
                linkMode={link?.linkMode || defaultLinkMode}
                isComplete={link?.isComplete || false}
                isRecording={isRecording}
                groupingEnabled={groupingEnabled}
                onSelect={() => onCurrentStepChange(idx)}
                onAddAction={(action) => linkActionToStep(idx, action)}
                onRemoveAction={(actionId) => removeActionFromStep(idx, actionId)}
                onClearAll={() => clearStepActions(idx)}
                onSkip={() => handleSkipStep(idx)}
                onLinkModeChange={(mode) => changeLinkMode(idx, mode)}
                onMarkComplete={() => markStepComplete(idx)}
                onStartRecording={onStartRecording ? () => onStartRecording(idx) : undefined}
              />
            );
          })}
        </div>
      </ScrollArea>
      
      {/* Quick tip */}
      <div className="px-3 py-2 border-t border-border/50 bg-muted/30 shrink-0">
        <p className="text-xs text-muted-foreground">
          <span className="text-purple-400 font-medium">Tip:</span>
          {isRecording ? (
            ` Recording for step ${currentStepIndex + 1}. ${groupingEnabled ? 'Multiple actions can be grouped.' : 'One action per step.'}`
          ) : (
            ` Click a step to select it, then record or add suggestions.`
          )}
        </p>
      </div>
      
      {/* Action picker dialog */}
      <ActionPickerDialog
        open={showActionPicker}
        onOpenChange={setShowActionPicker}
        availableActions={unlinkedActions}
        onSelectAction={(action) => linkActionToStep(currentStepIndex, action)}
      />
      
      {/* Merge preview dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Merge Preview</DialogTitle>
            <DialogDescription>
              Review the automation links before saving
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3 pr-4">
              {generateMergedSteps().map((linkedStep, idx) => (
                <div
                  key={linkedStep.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    linkedStep.automationStatus === 'fully_automated' 
                      ? "bg-green-500/10 border-green-500/30"
                      : linkedStep.automationStatus === 'partial'
                      ? "bg-blue-500/10 border-blue-500/30"
                      : "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-black/20 text-xs font-mono shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {linkedStep.manualDescription || 'Untitled Step'}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {linkedStep.linkMode}
                        </Badge>
                      </div>
                      
                      {linkedStep.automationActions.length > 0 ? (
                        <div className="space-y-1 mt-2">
                          {linkedStep.automationActions.map((action, actionIdx) => (
                            <div key={action.id} className="flex items-center gap-2 text-xs">
                              <Badge className="text-[10px] bg-blue-500/20 text-blue-400">
                                {action.qword}
                              </Badge>
                              <span className="truncate text-muted-foreground">
                                {action.description || generateActionDescription(action)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          📝 Manual step (no automation)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <div className="flex items-center gap-2 mr-auto">
              <Badge variant="outline">
                {coverage.automated} automated
              </Badge>
              <Badge variant="outline">
                {coverage.manual} manual
              </Badge>
            </div>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeComplete} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-1" />
              Save Merged Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default StepAutomationLinker;

