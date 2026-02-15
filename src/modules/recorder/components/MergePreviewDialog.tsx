/**
 * Merge Preview Dialog
 * Shows a preview of merged test steps (manual + automated) with
 * link mode visualization and automation status.
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 9182-9319).
 */

import React from 'react';
import {
  Merge, CheckCircle, AlertCircle, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface MergePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTestCase: any;
  mergedSteps: any[];
  defaultLinkMode: string;
  groupingEnabled: boolean;
  saveMergedTest: () => void;
}

export default function MergePreviewDialog({
  open,
  onOpenChange,
  selectedTestCase,
  mergedSteps,
  defaultLinkMode,
  groupingEnabled,
  saveMergedTest,
}: MergePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] bg-card border-border flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Merge className="h-5 w-5 text-purple-400" />
            Merge Preview - {selectedTestCase?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Automated ({mergedSteps.filter(s => s.qword && !s._manualOnly).length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Grouped ({mergedSteps.filter(s => s._hasMultipleActions).length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              Manual Only ({mergedSteps.filter(s => s._manualOnly).length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Extra Recorded ({mergedSteps.filter(s => s._extra).length})
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-muted-foreground">Link Mode:</span>
            <Badge variant="outline" className="text-[10px]">{defaultLinkMode}</Badge>
            <span className="text-muted-foreground">--</span>
            <span className="text-muted-foreground">Grouping: {groupingEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {mergedSteps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    step._merged && "bg-emerald-500/10 border-emerald-500/30",
                    step._hasMultipleActions && "bg-blue-500/10 border-blue-500/30",
                    step._manualOnly && "bg-muted-foreground/10 border-gray-500/30",
                    step._extra && "bg-purple-500/10 border-purple-500/30",
                    !step._merged && !step._manualOnly && !step._extra && step.qword && "bg-emerald-500/10 border-emerald-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-6 shrink-0 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm truncate">
                          {step.name || step.description || `${step.qword} ${step.args?.[0] || ''}`}
                        </span>
                        {step._merged && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Merged</Badge>
                        )}
                        {step._hasMultipleActions && (
                          <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                            {step.automationActions?.length || 0} Actions
                          </Badge>
                        )}
                        {step._linkMode && (
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {step._linkMode}
                          </Badge>
                        )}
                        {step._manualOnly && (
                          <Badge className="bg-muted-foreground/20 text-muted-foreground text-[10px]">Manual</Badge>
                        )}
                        {step._extra && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">New Step</Badge>
                        )}
                      </div>

                      {step.manualAction && step._linkMode !== 'replace' && (
                        <div className="mt-1 text-xs text-muted-foreground bg-black/20 rounded p-1.5">
                          {step.manualAction}
                        </div>
                      )}

                      {step._hasMultipleActions && step.automationActions?.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {step.automationActions.map((action: any, actionIdx: number) => (
                            <div key={action.id || actionIdx} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-[10px] text-muted-foreground/60">{actionIdx + 1}.</span>
                              <Badge variant="outline" className="text-[10px] border-white/20">
                                {action.qword}
                              </Badge>
                              <span className="truncate">{action.description || action.args?.join(' -> ')}</span>
                            </div>
                          ))}
                        </div>
                      ) : step.qword && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {step.qword}
                          </Badge>
                          <span className="truncate">{step.args?.join(' -> ')}</span>
                        </div>
                      )}
                    </div>
                    {step.qword || step._hasMultipleActions ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="border-t border-border pt-4 shrink-0">
          <div className="flex-1 text-xs text-muted-foreground">
            {mergedSteps.filter(s => s._hasMultipleActions).length > 0 && (
              <span>Steps with grouped actions will execute all linked actions in sequence</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/20">
            Cancel
          </Button>
          <Button onClick={saveMergedTest} className="bg-gradient-to-r from-purple-500 to-purple-600">
            <Save className="h-4 w-4 mr-2" />
            Save Merged Test ({mergedSteps.filter(s => s.qword || s._hasMultipleActions).length}/{mergedSteps.length} automated)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
