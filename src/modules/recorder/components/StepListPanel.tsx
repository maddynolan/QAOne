/**
 * StepListPanel - Renders the recorded steps list with per-step action cards.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 * Includes: step header, multi-select bar, scrollable step cards with actions.
 */

import React from "react";
import {
  Play, Trash2, Save, CheckCircle, Video, Search, Filter,
  Folder, Tag, ChevronDown, ChevronLeft, ChevronRight, Settings, Code,
  Zap, FileText, Merge, RotateCcw, X, Sparkles,
  AlertCircle, Check, Layers, RefreshCw, Lightbulb,
  MousePointer, Keyboard, Eye, Target, Cloud, Link, Edit,
  Hash, Type, CircleDot, FormInput, Database, Copy,
  Shield, Wand2, CheckSquare, Plus, Circle, Hand, SkipForward,
  PenLine, LayoutGrid, ArrowRight, Upload, Activity,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepConfidenceIndicator } from "@/modules/recorder/components/confidence";
import type { RecordedAction, Suggestion, TestCase } from "@/modules/recorder/types/recorder.types";
import {
  isCrossOriginAction, isPasswordField,
} from "@/modules/recorder/lib/actionValidation";
import {
  getDisplayDescription,
} from "@/modules/recorder/lib/displayHelpers";
import { maskSensitiveAction } from "@/modules/recorder/lib/actionValidation";

export interface StepListPanelProps {
  actions: RecordedAction[];
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
  mode: 'new' | 'existing';
  selectedTestCase: TestCase | null;
  isMultiSelectMode: boolean;
  setIsMultiSelectMode: (v: boolean) => void;
  selectedActionIndices: Set<number>;
  setSelectedActionIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedActionIndex: number | null;
  setSelectedActionIndex: (v: number | null) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (v: number) => void;
  stepLinks: Record<number, { actions: any[]; linkMode: string; isComplete: boolean }>;
  falsePositiveSteps: Map<string, { stepIndex: number; screenshot: string | null; markedAt: number; reason?: string }>;
  draggedIndex: number | null;
  dragOverIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleClearActions: () => void;
  selectAllActions: () => void;
  clearAllSelections: () => void;
  linkSelectedActionsToStep: () => void;
  toggleActionSelection: (index: number, e: React.MouseEvent | React.ChangeEvent) => void;
  linkActionToStep: (stepIndex: number, action: RecordedAction, type: string) => void;
  openEditSelectorModal: (index: number) => void;
  setEditingCrossOriginIndex: (v: number) => void;
  setCrossOriginUserActions: (v: any[]) => void;
  setShowCrossOriginEditor: (v: boolean) => void;
  getActionIcon: (qword: string, small?: boolean) => React.ReactNode;
  actionsEndRef: React.RefObject<HTMLDivElement>;
}

export default function StepListPanel({
  actions,
  setActions,
  mode,
  selectedTestCase,
  isMultiSelectMode,
  setIsMultiSelectMode,
  selectedActionIndices,
  setSelectedActionIndices,
  selectedActionIndex,
  setSelectedActionIndex,
  currentStepIndex,
  setCurrentStepIndex,
  stepLinks,
  falsePositiveSteps,
  draggedIndex,
  dragOverIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleClearActions,
  selectAllActions,
  clearAllSelections,
  linkSelectedActionsToStep,
  toggleActionSelection,
  linkActionToStep,
  openEditSelectorModal,
  setEditingCrossOriginIndex,
  setCrossOriginUserActions,
  setShowCrossOriginEditor,
  getActionIcon,
  actionsEndRef,
}: StepListPanelProps) {
  return (
    <>
      {/* Recorded Steps Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Recorded Steps</span>
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
            {actions.length}
          </Badge>
          {selectedActionIndices.size > 0 && (
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
              {selectedActionIndices.size} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Multi-select toggle */}
          {actions.length > 0 && mode === 'existing' && selectedTestCase && (
            <Button
              variant={isMultiSelectMode ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) {
                  setSelectedActionIndices(new Set());
                }
              }}
              className={cn(
                "h-6 px-2 text-xs",
                isMultiSelectMode && "bg-purple-500 hover:bg-purple-600 text-white"
              )}
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              Select
            </Button>
          )}
          {actions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearActions} className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Multi-select action bar - shown when actions are selected */}
      {isMultiSelectMode && mode === 'existing' && selectedTestCase && (
        <div className="px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllActions}
                className="h-6 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
              >
                Select All
              </Button>
              {selectedActionIndices.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllSelections}
                  className="h-6 px-2 text-xs text-muted-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            {selectedActionIndices.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-300">Link to:</span>
                <Select
                  value={String(currentStepIndex)}
                  onValueChange={(v) => setCurrentStepIndex(parseInt(v))}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs bg-purple-500/20 border-purple-500/30">
                    <SelectValue placeholder="Select step" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedTestCase.steps || []).map((step: any, idx: number) => (
                      <SelectItem key={idx} value={String(idx)} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-purple-400">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="truncate max-w-[150px]">{step.name || step.description || `Step ${idx + 1}`}</span>
                          {stepLinks[idx]?.actions.length > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">
                              {stepLinks[idx].actions.length}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={linkSelectedActionsToStep}
                  className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                >
                  <Link className="h-3 w-3 mr-1.5" />
                  Link {selectedActionIndices.size}
                </Button>
              </div>
            )}
          </div>
          {/* Range selection hint */}
          <p className="text-[10px] text-purple-300/70 mt-1">
            Hold Shift+Click for range selection
          </p>
        </div>
      )}

      {/* Recorded Steps List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
        {actions.length === 0 ? (
          <div className="text-center py-12 px-4 text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No actions recorded yet.</p>
            <p className="text-xs mt-1">Click 'Start Recording' to begin.</p>
          </div>
        ) : (
          <div className="px-2 pb-20 space-y-1"> {/* pb-20 for fixed footer space */}
            {actions.map((action, index) => {
              // Apply masking for sensitive fields (passwords)
              const displayAction = maskSensitiveAction(action);
              const isPw = isPasswordField(action);
              const isSelected = selectedActionIndex === index;
              const isMultiSelected = selectedActionIndices.has(index);
              const isNewlyAdded = index === actions.length - 1;

              return (
              <div
                key={action.id || `action_${index}_${action.timestamp}`}
                draggable={!isMultiSelectMode}
                onDragStart={() => !isMultiSelectMode && handleDragStart(index)}
                onDragOver={(e) => !isMultiSelectMode && handleDragOver(e, index)}
                onDragEnd={() => !isMultiSelectMode && handleDragEnd()}
                onClick={(e) => {
                  if (isMultiSelectMode) {
                    toggleActionSelection(index, e);
                  } else {
                    setSelectedActionIndex(isSelected ? null : index);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg bg-card hover:bg-accent border group cursor-pointer transition-all",
                  !isMultiSelectMode && "active:cursor-grabbing",
                  isSelected && !isMultiSelectMode && "border-primary bg-primary/10 ring-1 ring-primary/30",
                  isMultiSelected && "border-purple-500 bg-purple-500/20 ring-1 ring-purple-500/30",
                  draggedIndex === index && "opacity-50 border-cyan-500/50",
                  dragOverIndex === index && draggedIndex !== index && "border-cyan-500 bg-cyan-500/10",
                  !isSelected && !isMultiSelected && draggedIndex === null && "border-transparent hover:border-white/5",
                  isNewlyAdded && !isMultiSelectMode && "animate-pulse-once"
                )}
              >
                {/* Checkbox for multi-select mode */}
                {isMultiSelectMode ? (
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      isMultiSelected
                        ? "bg-purple-500 border-purple-500"
                        : "border-muted-foreground/50 hover:border-purple-400"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActionSelection(index, e);
                    }}
                  >
                    {isMultiSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                ) : (
                  /* Drag handle */
                  <div className="flex flex-col gap-0.5 text-muted-foreground group-hover:text-foreground shrink-0 cursor-grab">
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <div className="w-1 h-1 rounded-full bg-current" />
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-current" />
                      <div className="w-1 h-1 rounded-full bg-current" />
                    </div>
                  </div>
                )}
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded text-xs font-mono shrink-0",
                  isMultiSelected ? "bg-purple-500/30 text-purple-300" : "bg-white/5 text-muted-foreground"
                )}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                {getActionIcon(action.qword || action.type || '')}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-foreground truncate flex-1 min-w-0">
                      {getDisplayDescription(displayAction)}
                      {isPw && <span className="ml-1 text-primary">&#x1f512;</span>}
                      {isCrossOriginAction(action) && (
                        <span className="ml-1 text-yellow-500">&#x26a0;&#xfe0f;</span>
                      )}
                      {/* Flagged step indicator (false positive or wrong element) */}
                      {action.id && falsePositiveSteps.has(action.id) && (
                        <span
                          className={cn(
                            "ml-1 px-1.5 py-0.5 text-[10px] rounded border",
                            falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element')
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          )}
                          title={falsePositiveSteps.get(action.id)?.reason || "Flagged -- test will stop here for fixing"}
                        >
                          &#x1f6a9; {falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element') ? 'Wrong Element' : 'Flagged'}
                        </span>
                      )}
                    </p>
                    {/* Confidence indicator - shows when confidence is not HIGH or multiple matches */}
                    <StepConfidenceIndicator
                      confidence={action.confidence}
                      matchAnalysis={action.matchAnalysis}
                    />
                  </div>
                  {isCrossOriginAction(action) ? (
                    <p className="text-xs text-yellow-500/80 truncate">
                      {(action as any).userActions?.length > 0
                        ? `${(action as any).userActions.length} action(s) defined`
                        : 'Click to add selectors'}
                    </p>
                  ) : displayAction.args?.[0] && (
                    <p className="text-xs text-muted-foreground truncate">
                      {isPw ? `${displayAction.args[0]} \u2192 \u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022` : displayAction.args.join(' \u2192 ')}
                    </p>
                  )}
                </div>
                {/* ============ ACTION BUTTONS - Always visible ============ */}
                <div className="flex items-center gap-1 shrink-0 ml-auto pl-2">
                  {/* Edit button for cross-origin actions */}
                  {isCrossOriginAction(action) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCrossOriginIndex(index);
                        setCrossOriginUserActions((action as any).userActions || []);
                        setShowCrossOriginEditor(true);
                      }}
                    >
                      <PenLine className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {/* Quick link button - shown when hovering in existing mode */}
                  {mode === 'existing' && selectedTestCase && !isMultiSelectMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        linkActionToStep(currentStepIndex, action, 'recorded');
                        // Remove from actions list after linking
                        setActions(prev => prev.filter((_, i) => i !== index));
                      }}
                      title={`Link to Step ${currentStepIndex + 1}`}
                    >
                      <Link className="h-3 w-3 mr-0.5" />
                      <span className="text-[10px]">{currentStepIndex + 1}</span>
                    </Button>
                  )}
                  {/* COPY SELECTOR BUTTON - Quick copy for debugging */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      const selector = action.selectorObj?.manualOverride ||
                                      action.selectorObj?.primary ||
                                      action.selectorObj?.selector ||
                                      action.selector || '';
                      if (selector) {
                        navigator.clipboard.writeText(selector);
                        // toast handled by parent
                      }
                    }}
                    title="Copy selector to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {/* EDIT SELECTOR BUTTON - Manual Override - Always visible */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditSelectorModal(index);
                    }}
                    title="Edit step - Modify selector or value"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  {/* DELETE BUTTON - Always visible */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const actionName = action.description || action.qword || 'step';
                      setActions(prev => prev.filter((_, i) => i !== index));
                      // Also remove from selection if multi-selected
                      if (selectedActionIndices.has(index)) {
                        setSelectedActionIndices(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(index);
                          // Adjust indices for items after the deleted one
                          const adjusted = new Set<number>();
                          newSet.forEach(i => adjusted.add(i > index ? i - 1 : i));
                          return adjusted;
                        });
                      }
                    }}
                    title="Delete step"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              );
            })}
            {/* Auto-scroll target */}
            <div ref={actionsEndRef} />
          </div>
        )}
        </ScrollArea>
      </div>
    </>
  );
}
