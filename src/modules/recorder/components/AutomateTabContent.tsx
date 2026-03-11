/**
 * AutomateTabContent - Link manual test steps with recorded actions.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Link2, Settings, RotateCcw, CheckSquare, Video,
  CheckCircle, Circle, ArrowRight, X, Layers, Sparkles,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LinkMode } from "@/modules/recorder/lib/automation-linking";

interface AutomateTabContentProps {
  selectedTestCase: any;
  stepLinks: Record<number, any>;
  stepAutomation: Record<number, any>;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  selectedActionIndices: Set<number>;
  setSelectedActionIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleLinkSelectedActions: (stepIdx: number) => void;
  groupingEnabled: boolean;
  setGroupingEnabled: (enabled: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (enabled: boolean) => void;
  defaultLinkMode: LinkMode;
  setDefaultLinkMode: (mode: LinkMode) => void;
  setStepAutomation: React.Dispatch<React.SetStateAction<Record<number, any>>>;
  setStepLinks: React.Dispatch<React.SetStateAction<Record<number, any>>>;
  recordForStepContext: any;
  skipCurrentStep: () => void;
  clearStepAutomation: (idx: number) => void;
  getActionIcon: (qword: string, small?: boolean) => React.ReactNode;
}

export default function AutomateTabContent({
  selectedTestCase,
  stepLinks,
  stepAutomation,
  currentStepIndex,
  setCurrentStepIndex,
  selectedActionIndices,
  setSelectedActionIndices,
  handleLinkSelectedActions,
  groupingEnabled,
  setGroupingEnabled,
  autoAdvance,
  setAutoAdvance,
  defaultLinkMode,
  setDefaultLinkMode,
  setStepAutomation,
  setStepLinks,
  recordForStepContext,
  skipCurrentStep,
  clearStepAutomation,
  getActionIcon,
}: AutomateTabContentProps) {
  return (
    <>
      {/* Header with Settings */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold">Link Steps</span>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5">
            {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0} linked
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* Settings Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] border-border">
                <Settings className="h-3 w-3 mr-1" />
                Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-64 p-3">
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-foreground">Linking Options</h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor="grouping-tab" className="text-[11px] text-muted-foreground">
                    Allow action grouping
                  </Label>
                  <Switch
                    id="grouping-tab"
                    checked={groupingEnabled}
                    onCheckedChange={setGroupingEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autoadvance-tab" className="text-[11px] text-muted-foreground">
                    Auto-advance steps
                  </Label>
                  <Switch
                    id="autoadvance-tab"
                    checked={autoAdvance}
                    onCheckedChange={setAutoAdvance}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Link mode</Label>
                  <Select value={defaultLinkMode} onValueChange={(v) => setDefaultLinkMode(v as LinkMode)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="document">Document - Keep manual text</SelectItem>
                      <SelectItem value="replace">Replace - Use generated text</SelectItem>
                      <SelectItem value="hybrid">Hybrid - Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {groupingEnabled
                    ? "Multiple recordings can be linked to one step"
                    : "One recording per step"}
                </p>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStepAutomation({}); setStepLinks({}); setCurrentStepIndex(0); }}
            className="h-6 px-2 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset All
          </Button>
        </div>
      </div>

      {/* Selection Info Bar - When actions are selected on left */}
      {selectedActionIndices.size > 0 && (
        <div className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedActionIndices.size} recorded action{selectedActionIndices.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Click a step below to link</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedActionIndices(new Set())}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Recording Context Banner */}
      {recordForStepContext && (
        <div className="px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
          <div className="flex items-center gap-2 text-xs">
            <Video className="h-3 w-3 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span className="text-purple-700 dark:text-purple-300">
              Recording for: <strong>{recordForStepContext.stepName}</strong>
            </span>
          </div>
          {recordForStepContext.manualDescription && (
            <p className="text-[10px] text-muted-foreground mt-1 pl-5">
              {recordForStepContext.manualDescription}
            </p>
          )}
        </div>
      )}

      {/* Scrollable Manual Steps List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {(selectedTestCase.steps || []).map((step: any, idx: number) => {
            const legacyAutomation = stepAutomation[idx];
            const enhancedLink = stepLinks[idx];
            const isCurrent = currentStepIndex === idx;
            const hasEnhancedLink = enhancedLink && enhancedLink.actions.length > 0;
            const isAutomated = hasEnhancedLink || legacyAutomation?.type === 'recorded' || legacyAutomation?.type === 'suggested';
            const isSkipped = legacyAutomation?.type === 'skipped';
            const actionCount = enhancedLink?.actions.length || 0;
            const hasSelectedActions = selectedActionIndices.size > 0;

            return (
              <div
                key={step.id || idx}
                onClick={() => {
                  setCurrentStepIndex(idx);
                  // If actions are selected, link them to this step
                  if (hasSelectedActions) {
                    handleLinkSelectedActions(idx);
                  }
                }}
                className={cn(
                  "group relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                  isCurrent && "bg-purple-500/15 border-purple-500/50 ring-1 ring-purple-500/30",
                  !isCurrent && isAutomated && "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15",
                  !isCurrent && isSkipped && "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15",
                  !isCurrent && !isAutomated && !isSkipped && "bg-card border-border hover:border-purple-500/30 hover:bg-purple-500/5",
                  hasSelectedActions && !isCurrent && "hover:border-blue-500/50 hover:bg-blue-500/10"
                )}
              >
                {/* Step Number Badge */}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0",
                  isCurrent && "bg-purple-500 text-white",
                  !isCurrent && isAutomated && "bg-emerald-500/20 text-emerald-400",
                  !isCurrent && isSkipped && "bg-amber-500/20 text-amber-400",
                  !isCurrent && !isAutomated && !isSkipped && "bg-white/5 text-muted-foreground"
                )}>
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Status Icon */}
                    {isAutomated && <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />}
                    {isSkipped && <Circle className="h-4 w-4 text-amber-400 shrink-0" />}
                    {isCurrent && !isAutomated && !isSkipped && <ArrowRight className="h-4 w-4 text-purple-400 shrink-0 animate-pulse" />}

                    {/* Step Name */}
                    <p className="text-sm font-medium truncate">{step.name || step.description || `Step ${idx + 1}`}</p>

                    {/* Link Mode Badge */}
                    {hasEnhancedLink && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-500/30 text-emerald-400">
                        {enhancedLink.linkMode}
                      </Badge>
                    )}
                  </div>

                  {/* Step Description (manual action) */}
                  {step.action && (
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {step.action}
                    </p>
                  )}

                  {/* Linked Actions Info */}
                  {hasEnhancedLink && (
                    <div className="mt-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                        <Layers className="h-3 w-3" />
                        <span>{actionCount} linked action{actionCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1">
                        {enhancedLink.actions.slice(0, 3).map((action: any, actIdx: number) => (
                          <div key={actIdx} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {getActionIcon(action.qword, true)}
                            <span className="truncate">{action.description || action.qword}</span>
                          </div>
                        ))}
                        {actionCount > 3 && (
                          <p className="text-[10px] text-muted-foreground">+{actionCount - 3} more...</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy Automation Info */}
                  {!hasEnhancedLink && legacyAutomation?.data && (
                    <div className="mt-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                        {legacyAutomation.type === 'recorded' ? <Video className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                        <span className="truncate">{(legacyAutomation.data as any).description || (legacyAutomation.data as any).qword}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Link hint when actions selected */}
                  {hasSelectedActions && (
                    <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[9px] px-2 animate-pulse">
                      Click to link
                    </Badge>
                  )}

                  {/* Skip button for current step */}
                  {isCurrent && !isAutomated && !isSkipped && !hasSelectedActions && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); skipCurrentStep(); }}
                      className="h-7 px-2 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/20"
                    >
                      Skip
                    </Button>
                  )}

                  {/* Clear button for automated/skipped steps */}
                  {(isAutomated || isSkipped) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); clearStepAutomation(idx); }}
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Bottom Help */}
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {selectedActionIndices.size > 0
            ? `Click any step above to link ${selectedActionIndices.size} selected action${selectedActionIndices.size > 1 ? 's' : ''}`
            : groupingEnabled
              ? 'Select multiple recorded actions on the left panel, then click a step to link them'
              : 'Select recorded actions on the left, then click a step to link'}
        </p>
      </div>
    </>
  );
}
