/**
 * Test Execution Results Dialog
 * Shows real-time test execution progress, step-by-step results,
 * AI auto-fix controls, debug/pause controls, and failure analysis.
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 8124-9180).
 */

import React from 'react';
import {
  Loader2, CheckCircle, AlertCircle, Bug, Square, Play, Check, X,
  ChevronLeft, ChevronRight, MousePointer, RefreshCw, SkipForward,
  Circle, Eye,
} from 'lucide-react';
import { useAI } from '@/contexts/AIContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { RecordedAction } from '@/modules/recorder/types/recorder.types';
import {
  getDisplayLabel, getDisplayDescription, looksLikeFieldValue,
  getFieldIdentity, areSameFillField,
} from '@/modules/recorder/lib/displayHelpers';
import { isPasswordField, maskSensitiveAction } from '@/modules/recorder/lib/actionValidation';
import { classifyFailure } from '@/modules/recorder/lib/failureClassification';
import type { FailureExplanation, FixOption as ApiFixOption } from '@/modules/recorder/lib/aiEnhancements';
import ManualAssistCard from '@/modules/recorder/components/ManualAssistCard';

export interface TestExecutionResultData {
  status: string;
  stepResults: any[];
  currentStep?: number;
  totalSteps?: number;
  error?: string;
  failedStepIndex?: number;
  selectedScreenshot?: string;
  [key: string]: any;
}

export interface TestResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testExecutionResult: TestExecutionResultData | null;
  setTestExecutionResult: React.Dispatch<React.SetStateAction<TestExecutionResultData | null>>;
  actions: RecordedAction[];
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
  isTestPaused: boolean;
  isDebugMode: boolean;
  pausedAtStep: number | null;
  stepByStepMode: boolean;
  toggleStepByStepMode: () => void;
  editingPausedStep: any;
  updatePausedStepField: (field: string, value: any) => void;
  failureCardStepIndex: number | null;
  setFailureCardStepIndex: (idx: number | null) => void;
  // AI state
  aiExplanation: FailureExplanation | null;
  setAiExplanation: (v: FailureExplanation | null) => void;
  aiExplanationLoading: boolean;
  setAiExplanationLoading: (v: boolean) => void;
  autoFixingSteps: Set<number>;
  autoFixResults: Map<number, { success: boolean; message: string }>;
  manualAssistStep: number | null;
  setManualAssistStep: (v: number | null) => void;
  setAutoFixResults: React.Dispatch<React.SetStateAction<Map<number, { success: boolean; message: string }>>>;
  falsePositiveSteps: Map<string, any>;
  flakyStepIds: Set<string>;
  currentTestId: string;
  // Handlers
  handleStopTest: () => void;
  handlePauseTest: () => void;
  handleResumeTest: () => void;
  handleRetryPausedStep: () => void;
  handleSkipPausedStep: () => void;
  handleRunFromStep: (idx: number) => void;
  handleRunTest: (debug: boolean) => void;
  handleAutoFixStep: (idx: number, opts?: { flagFirst?: boolean }) => void;
  handleLockLocators: () => void;
  handleRefreshSuggestions: () => void;
  markStepAsFalsePositive: (idx: number, screenshot: string | null, reason?: string) => void;
  unmarkFalsePositive: (actionId: string) => void;
  explainFailureApi: (params: any) => Promise<any>;
  switchToStepTabAndRefresh: (idx: number) => void;
  setEditingActionIndex: (idx: number | null) => void;
  setRightPanelTab: (tab: string) => void;
  setShowTestResultModal: (open: boolean) => void;
}

export default function TestResultsDialog({
  open,
  onOpenChange,
  testExecutionResult,
  setTestExecutionResult,
  actions,
  setActions,
  isTestPaused,
  isDebugMode,
  pausedAtStep,
  stepByStepMode,
  toggleStepByStepMode,
  editingPausedStep,
  updatePausedStepField,
  failureCardStepIndex,
  setFailureCardStepIndex,
  aiExplanation,
  setAiExplanation,
  aiExplanationLoading,
  setAiExplanationLoading,
  autoFixingSteps,
  autoFixResults,
  manualAssistStep,
  setManualAssistStep,
  setAutoFixResults,
  falsePositiveSteps,
  flakyStepIds,
  currentTestId,
  handleStopTest,
  handlePauseTest,
  handleResumeTest,
  handleRetryPausedStep,
  handleSkipPausedStep,
  handleRunFromStep,
  handleRunTest,
  handleAutoFixStep,
  handleLockLocators,
  handleRefreshSuggestions,
  markStepAsFalsePositive,
  unmarkFalsePositive,
  explainFailureApi: explainFailureApiFn,
  switchToStepTabAndRefresh,
  setEditingActionIndex,
  setRightPanelTab,
  setShowTestResultModal,
}: TestResultsDialogProps) {
  const { config: aiConfig } = useAI();
  const aiAvailable = aiConfig.enabled && aiConfig.hasApiKey;

  return (
    <Dialog open={open} onOpenChange={(openVal) => {
      if (!openVal && testExecutionResult?.status === 'running') {
        return;
      }
      if (!openVal && isTestPaused) {
        handleStopTest();
      }
      onOpenChange(openVal);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-card border-border overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testExecutionResult?.status === 'running' && !isTestPaused && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  {isDebugMode ? (
                    <>
                      <span>Debug Mode</span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                        <Bug className="h-3 w-3 mr-1" />
                        Running
                      </Badge>
                    </>
                  ) : (
                    'Running Test...'
                  )}
                </>
              )}
              {(testExecutionResult?.status === 'paused' || isTestPaused) && (
                <>
                  <Bug className="h-5 w-5 text-amber-400" />
                  <span className="text-amber-400">Debug Paused</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs ml-2">
                    Step {(pausedAtStep || 0) + 1}
                  </Badge>
                </>
              )}
              {testExecutionResult?.status === 'passed' && (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Test Passed!
                  {(() => {
                    const healedCount = testExecutionResult?.stepResults?.filter((s: any) => s.healed).length || 0;
                    const skippedCount = testExecutionResult?.stepResults?.filter((s: any) => s.skipped).length || 0;
                    return (
                      <>
                        {healedCount > 0 && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs ml-2">{healedCount} healed</Badge>}
                        {skippedCount > 0 && <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs ml-2">{skippedCount} skipped</Badge>}
                      </>
                    );
                  })()}
                </>
              )}
              {testExecutionResult?.status === 'failed' && !isTestPaused && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  Test Failed
                </>
              )}
            </div>

            {isDebugMode && testExecutionResult?.status === 'running' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="step-mode" className="text-xs text-muted-foreground">Step-by-step</Label>
                <Switch
                  id="step-mode"
                  checked={stepByStepMode}
                  onCheckedChange={toggleStepByStepMode}
                />
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden max-w-full">
          {/* Progress Bar */}
          {(testExecutionResult?.status === 'running' || isTestPaused) && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Step {(isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1} of {testExecutionResult?.totalSteps}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(((isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    isTestPaused ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${((isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100}%` }}
                />
              </div>

              {testExecutionResult?.status === 'running' && !isTestPaused && (
                <div className="flex items-center gap-2 pt-2">
                  {isDebugMode ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePauseTest}
                        className="flex-1 h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      >
                        <div className="h-3 w-3 bg-amber-400 rounded-sm mr-2" />
                        Pause
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopTest}
                        className="h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStopTest}
                      className="h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ONE-SCREEN FAILURE CARD */}
          {testExecutionResult?.status === 'failed' && !isTestPaused && (() => {
            let canonicalFailedIdx: number | undefined;
            if (testExecutionResult.failedStepIndex !== undefined) {
              canonicalFailedIdx = testExecutionResult.failedStepIndex;
            }
            if (canonicalFailedIdx === undefined) {
              const found = testExecutionResult.stepResults?.find((r: { status: string }) => r.status === 'failed');
              canonicalFailedIdx = found?.index;
            }
            if (canonicalFailedIdx === undefined) return null;

            const viewingIdx = failureCardStepIndex ?? canonicalFailedIdx;
            const viewingResult = testExecutionResult.stepResults?.[viewingIdx];
            const viewingAction = actions[viewingIdx];
            if (!viewingAction && !viewingResult) return null;

            const stepLabel = viewingAction ? getDisplayLabel(viewingAction) : null;
            const isViewingFailed = viewingResult?.status === 'failed';
            const classified = isViewingFailed ? classifyFailure(viewingResult?.error, stepLabel || undefined) : null;
            const stepName = viewingAction ? getDisplayDescription(maskSensitiveAction(viewingAction)) : `Step ${viewingIdx + 1}`;
            const isStepFlaky = viewingAction?.id ? flakyStepIds.has(viewingAction.id) : false;
            const totalSteps = testExecutionResult.totalSteps || actions.length;
            const isOnCanonicalFailed = viewingIdx === canonicalFailedIdx;

            return (
              <div className={`p-4 ${isViewingFailed ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-500/10 border-zinc-500/30'} border rounded-lg space-y-3`}>
                {/* Step Navigation Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={viewingIdx <= 0}
                      onClick={() => setFailureCardStepIndex(Math.max(0, viewingIdx - 1))}
                      className="h-7 w-7 p-0"
                      title="Previous step"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {viewingIdx + 1} of {totalSteps}
                      {isViewingFailed && <span className="text-red-400 ml-1">(failed)</span>}
                      {viewingResult?.status === 'passed' && <span className="text-emerald-400 ml-1">(passed)</span>}
                      {viewingResult?.status === 'skipped' && <span className="text-gray-400 ml-1">(skipped)</span>}
                      {!viewingResult && <span className="text-gray-500 ml-1">(not reached)</span>}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={viewingIdx >= totalSteps - 1}
                      onClick={() => setFailureCardStepIndex(Math.min(totalSteps - 1, viewingIdx + 1))}
                      className="h-7 w-7 p-0"
                      title="Next step"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {!isOnCanonicalFailed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFailureCardStepIndex(canonicalFailedIdx!)}
                      className="text-xs text-red-400 hover:text-red-300 h-7"
                    >
                      Go to failed step
                    </Button>
                  )}
                </div>

                {/* Step Details */}
                <div className="flex items-start gap-3">
                  {viewingResult?.screenshot && (
                    <img src={viewingResult.screenshot} alt="Step" className="w-24 h-24 object-cover rounded border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isViewingFailed ? 'text-red-200' : 'text-foreground'}`}>{stepName}</p>
                      {isStepFlaky && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                          Flaky
                        </span>
                      )}
                    </div>
                    {isViewingFailed && classified && (
                      <p className="text-sm text-red-300/90 mt-1">
                        {aiExplanation && isOnCanonicalFailed ? aiExplanation.plain_explanation : classified.message}
                      </p>
                    )}
                    {isViewingFailed && aiExplanation && isOnCanonicalFailed && aiExplanation?.root_cause && aiExplanation.root_cause !== 'unknown' && aiExplanation.root_cause !== aiExplanation.failure_type && (
                      <p className="text-xs text-red-400/60 mt-0.5">
                        Root cause: {aiExplanation.root_cause.replace(/_/g, ' ')}
                        {aiExplanation.confidence > 0 && ` (${Math.round(aiExplanation.confidence * 100)}% confidence)`}
                      </p>
                    )}
                    {viewingResult?.status === 'passed' && (
                      <p className={cn(
                        "text-sm mt-1",
                        viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && falsePositiveSteps.get(viewingAction.id)?.reason?.includes('Wrong element')
                          ? "text-red-400/90"
                          : "text-emerald-400/90"
                      )}>
                        {viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && falsePositiveSteps.get(viewingAction.id)?.reason?.includes('Wrong element')
                          ? "Warning: Step passed but flagged as wrong element -- may have clicked the wrong thing."
                          : "This step passed successfully."
                        }
                      </p>
                    )}
                    {!viewingResult && (
                      <p className="text-sm text-gray-400/90 mt-1">This step was not reached during execution.</p>
                    )}
                  </div>
                </div>

                {/* Fix buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setShowTestResultModal(false);
                      setEditingActionIndex(viewingIdx);
                      setRightPanelTab('suggestions');
                      switchToStepTabAndRefresh(viewingIdx);
                      toast.info('Click the correct element in the browser or pick one from Smart Suggestions.', { duration: 4000 });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <MousePointer className="h-4 w-4 mr-2" />
                    Fix this step
                  </Button>
                  <Button variant="outline" size="sm" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => handleRunFromStep(viewingIdx)}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry from here
                  </Button>
                  {isViewingFailed && viewingAction?.id && !falsePositiveSteps.has(viewingAction.id) && (
                    <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => { markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null); }}>
                      Not a real failure
                    </Button>
                  )}
                  {viewingResult?.status === 'passed' && viewingAction?.id && !falsePositiveSteps.has(viewingAction.id) && (
                    <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null, 'Wrong element — step passed but clicked incorrect element'); }}>
                      Wrong Element
                    </Button>
                  )}
                  {viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && (
                    <Button variant="outline" size="sm" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10" onClick={() => { unmarkFalsePositive(viewingAction.id!); }}>
                      Unflag
                    </Button>
                  )}
                  {isViewingFailed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => {
                        setTestExecutionResult(prev => {
                          if (!prev) return prev;
                          const newResults = [...prev.stepResults];
                          newResults[viewingIdx] = { ...newResults[viewingIdx], status: 'passed', error: undefined };
                          return { ...prev, stepResults: newResults };
                        });
                        toast.success(`Step ${viewingIdx + 1} marked as passed`, { duration: 2000 });
                        if (viewingIdx + 1 < totalSteps) {
                          setFailureCardStepIndex(viewingIdx + 1);
                        }
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Mark as Passed & Next
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10" onClick={() => handleRunFromStep(viewingIdx)}>
                    <Play className="h-4 w-4 mr-1" />
                    Run from here
                  </Button>
                </div>
                {/* AI MULTI-FIX section */}
                {isViewingFailed && <div className="border-t border-red-500/20 pt-2">
                  {!aiExplanation && !aiExplanationLoading && isOnCanonicalFailed && aiAvailable && (
                    <button
                      onClick={async () => {
                        setAiExplanationLoading(true);
                        try {
                          const result = await explainFailureApiFn({
                            test_id: currentTestId,
                            step_id: viewingAction?.id || 'unknown',
                            step_index: viewingIdx,
                            step_label: stepLabel || '',
                            error_message: viewingResult?.error || 'Unknown error',
                            step_info: {
                              action: viewingAction?.type || 'unknown',
                              label: stepLabel || '',
                              selector: viewingAction?.selectorObj?.selector || viewingAction?.selector || '',
                              description: viewingAction?.description || '',
                              element: viewingAction?.element || {},
                            },
                            screenshot_b64: null,
                          });
                          setAiExplanation(result);
                        } catch (e) {
                          console.warn('AI explanation failed:', e);
                        } finally {
                          setAiExplanationLoading(false);
                        }
                      }}
                      className="text-xs text-red-300/70 hover:text-red-200 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Why did this fail? (More fix options)
                    </button>
                  )}
                  {aiExplanationLoading && (
                    <div className="flex items-center gap-2 text-xs text-red-300/60">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Analyzing failure...
                    </div>
                  )}
                  {aiExplanation && isOnCanonicalFailed && aiExplanation.fix_options.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-red-300/70 font-medium">Fix options (ranked by likelihood):</p>
                      <div className="space-y-1.5">
                        {aiExplanation.fix_options.slice(0, 5).map((fix: ApiFixOption, i: number) => (
                          <button
                            key={fix.fix_id}
                            onClick={() => {
                              if (fix.fix_type === 'update_selector') {
                                setShowTestResultModal(false);
                                setEditingActionIndex(viewingIdx);
                                setRightPanelTab('suggestions');
                                handleRefreshSuggestions();
                              } else if (fix.fix_type === 'add_wait') {
                                const waitStep = {
                                  type: 'wait',
                                  value: String(fix.details?.wait_ms || 2000),
                                  description: `Wait ${(fix.details?.wait_ms || 2000) / 1000}s before step`,
                                  timestamp: Date.now(),
                                };
                                const newActions = [...actions];
                                newActions.splice(viewingIdx, 0, waitStep);
                                setActions(newActions);
                                toast.success(`Added ${(fix.details?.wait_ms || 2000) / 1000}s wait before step ${viewingIdx + 1}. Run again to verify.`, { duration: 4000 });
                              } else if (fix.fix_type === 'retry') {
                                handleRunFromStep(viewingIdx);
                              } else if (fix.fix_type === 'skip_step') {
                                const newActions = [...actions];
                                if (newActions[viewingIdx]) {
                                  (newActions[viewingIdx] as any)._skipped = true;
                                }
                                setActions(newActions);
                                if (viewingIdx + 1 < actions.length) {
                                  handleRunFromStep(viewingIdx + 1);
                                }
                                toast.info(`Step ${viewingIdx + 1} marked as skipped.`, { duration: 3000 });
                              } else if (fix.fix_type === 'mark_false_positive') {
                                markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null);
                              } else if (fix.fix_type === 'quarantine') {
                                const newActions = [...actions];
                                if (newActions[viewingIdx]) {
                                  (newActions[viewingIdx] as any)._quarantined = true;
                                  (newActions[viewingIdx] as any)._quarantinedAt = new Date().toISOString();
                                }
                                setActions(newActions);
                                toast.info('Step quarantined -- it will be skipped in future runs until you un-quarantine it.', { duration: 4000 });
                              } else if (fix.fix_type === 'investigate') {
                                toast.info(fix.description, { duration: 6000 });
                              } else {
                                toast.info(fix.description, { duration: 4000 });
                              }
                            }}
                            className="w-full flex items-start gap-2 p-2 rounded-md text-left text-xs hover:bg-red-500/10 transition-colors group"
                          >
                            <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-red-400/30 text-red-300/70 group-hover:border-red-400/60 group-hover:text-red-200">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-red-200 group-hover:text-red-100">{fix.title}</span>
                              <p className="text-red-300/60 mt-0.5 leading-tight">{fix.description}</p>
                            </div>
                            {fix.confidence >= 0.7 && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
                                likely fix
                              </span>
                            )}
                            {fix.auto_applicable && (
                              <span className="shrink-0 px-1 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                auto
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {aiExplanation.ai_enhanced && (
                        <p className="text-[10px] text-red-400/40 mt-1">AI-enhanced analysis</p>
                      )}
                      {!aiExplanation.ai_enhanced && (
                        <p className="text-[10px] text-red-400/40 mt-1">Pattern-based analysis (add OpenAI key for AI-enhanced)</p>
                      )}
                    </div>
                  )}
                </div>}
              </div>
            );
          })()}

          {/* FALSE POSITIVE PAUSE CARD */}
          {isTestPaused && pausedAtStep !== null && actions[pausedAtStep]?.id && falsePositiveSteps.has(actions[pausedAtStep].id) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
              <p className="text-sm font-medium text-amber-200">You said this step isn&apos;t a real failure.</p>
              <p className="text-sm text-amber-300/90">Is the page correct now?</p>
              <div className="flex gap-2">
                <Button onClick={handleResumeTest} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check className="h-4 w-4 mr-2" />
                  Yes, continue
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    setShowTestResultModal(false);
                    setEditingActionIndex(pausedAtStep);
                    setRightPanelTab('suggestions');
                    handleRefreshSuggestions();
                    toast.info('Pick the correct element from Smart Suggestions or click it in the browser.', { duration: 4000 });
                  }}
                >
                  <MousePointer className="h-4 w-4 mr-2" />
                  No, let me fix it
                </Button>
              </div>
            </div>
          )}

          {/* PAUSED STATE - Edit Step Panel */}
          {isTestPaused && editingPausedStep && pausedAtStep !== null && !(actions[pausedAtStep]?.id && falsePositiveSteps.has(actions[pausedAtStep].id)) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-amber-500 flex items-center justify-center text-amber-900 text-xs font-bold">
                    {pausedAtStep + 1}
                  </div>
                  <span className="text-sm font-medium text-amber-300">Edit Step Before Continuing</span>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400 text-xs">Browser is open</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <Input
                    value={editingPausedStep.qword || ''}
                    onChange={(e) => updatePausedStepField('qword', e.target.value)}
                    className="h-8 text-sm bg-background border-border"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Target (optional)</Label>
                  <Input
                    value={editingPausedStep.selectorObj?.selector || ''}
                    onChange={(e) => updatePausedStepField('selectorObj', {
                      ...editingPausedStep.selectorObj,
                      selector: e.target.value
                    })}
                    className="h-8 text-sm bg-background border-border font-mono text-[11px]"
                    placeholder="Optional: target on page"
                  />
                </div>
              </div>

              {(editingPausedStep.qword?.includes('fill') || editingPausedStep.args?.length) && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    value={editingPausedStep.args?.[0] || ''}
                    onChange={(e) => updatePausedStepField('args', [e.target.value])}
                    className="h-8 text-sm bg-background border-border"
                    placeholder="Value to input"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Input
                  value={editingPausedStep.description || ''}
                  onChange={(e) => updatePausedStepField('description', e.target.value)}
                  className="h-8 text-sm bg-background border-border"
                  placeholder="Step description"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                <Button onClick={handleResumeTest} className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button onClick={handleRetryPausedStep} variant="outline" className="h-9 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry Step
                </Button>
                <Button onClick={handleSkipPausedStep} variant="outline" className="h-9 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                <Button onClick={handleStopTest} variant="outline" className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>

              <p className="text-[10px] text-amber-400/70 text-center">
                The browser is still open. You can inspect the page, modify the step above, then Resume or Retry.
              </p>
            </div>
          )}

          {/* Step Results List */}
          <div className="flex gap-4 overflow-hidden max-w-full">
            <ScrollArea className={cn("flex-1 overflow-hidden", isTestPaused ? "h-[300px]" : "h-[55vh]")}>
              <div className="space-y-1 pr-2 overflow-hidden max-w-full" id="execution-steps-container">
                {actions.map((action, idx) => {
                  if (action.qword === 'Fill') {
                    const myLabel = action.args?.[0]?.toString() || '';
                    const myId = getFieldIdentity(action);
                    const hasBetterFill = actions.some((other, otherIdx) => {
                      if (otherIdx === idx || other.qword !== 'Fill') return false;
                      if (!areSameFillField(action, other)) return false;
                      const otherId = getFieldIdentity(other);
                      const otherLabel = other.args?.[0]?.toString() || '';
                      if (otherId && !myId) return true;
                      if (!looksLikeFieldValue(otherLabel) && looksLikeFieldValue(myLabel)) return true;
                      if (otherIdx < idx && !looksLikeFieldValue(otherLabel)) return true;
                      return false;
                    });
                    if (hasBetterFill) return null;
                  }

                  const stepResult = testExecutionResult?.stepResults.find(r => r.index === idx);
                  const isCurrent = (testExecutionResult?.status === 'running' && testExecutionResult?.currentStep === idx) ||
                                   (isTestPaused && pausedAtStep === idx);
                  const isFailed = stepResult?.status === 'failed';
                  const hasScreenshot = !!stepResult?.screenshot;
                  const isPausedHere = isTestPaused && pausedAtStep === idx;

                  const shouldScrollTo = isCurrent || (isFailed && !testExecutionResult?.stepResults.some((r, i) => i > idx && r.status === 'failed'));

                  return (
                    <React.Fragment key={action.id || idx}>
                    <div
                      ref={shouldScrollTo ? (el) => {
                        if (el) {
                          setTimeout(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 50);
                        }
                      } : undefined}
                      className={cn(
                        "group flex items-start gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all overflow-clip relative",
                        isPausedHere && "bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30",
                        isCurrent && !isPausedHere && "bg-blue-500/20 border border-blue-500/30",
                        stepResult?.status === 'passed' && "bg-emerald-500/10 hover:bg-emerald-500/20",
                        stepResult?.status === 'healed' && "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20",
                        stepResult?.status === 'healing' && "bg-amber-500/10 border border-amber-500/20 animate-pulse",
                        stepResult?.status === 'failed' && "bg-red-500/10 hover:bg-red-500/20",
                        stepResult?.status === 'skipped' && "bg-gray-500/10 opacity-60",
                        testExecutionResult?.selectedScreenshot === stepResult?.screenshot && "ring-2 ring-blue-500"
                      )}
                      onClick={() => {
                        if (hasScreenshot) {
                          setTestExecutionResult(prev => prev ? {
                            ...prev,
                            selectedScreenshot: prev.selectedScreenshot === stepResult.screenshot ? undefined : stepResult.screenshot
                          } : null);
                        }
                      }}
                    >
                      <span className={cn(
                        "w-6 shrink-0 pt-0.5 text-center",
                        isPausedHere ? "text-amber-400 font-bold" : "text-muted-foreground"
                      )}>{idx + 1}</span>
                      <div className="shrink-0 pt-0.5">
                        {isPausedHere && <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center"><div className="h-1.5 w-1.5 bg-amber-900 rounded-sm" /></div>}
                        {isCurrent && !isPausedHere && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                        {stepResult?.status === 'passed' && !isPausedHere && <Check className="h-4 w-4 text-emerald-400" />}
                        {stepResult?.status === 'healed' && !isPausedHere && <Check className="h-4 w-4 text-violet-400" />}
                        {stepResult?.status === 'healing' && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
                        {stepResult?.status === 'failed' && !isPausedHere && <X className="h-4 w-4 text-red-400" />}
                        {stepResult?.status === 'skipped' && <SkipForward className="h-4 w-4 text-gray-400" />}
                        {!isCurrent && !stepResult && !isPausedHere && <Circle className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "break-words flex-1",
                            isPausedHere && "text-amber-300",
                            stepResult?.status === 'passed' && !isPausedHere && "text-emerald-400",
                            stepResult?.status === 'healed' && !isPausedHere && "text-violet-400",
                            stepResult?.status === 'healing' && "text-amber-400",
                            stepResult?.status === 'failed' && !isPausedHere && "text-red-400",
                            stepResult?.status === 'skipped' && "text-gray-400",
                            !stepResult && !isPausedHere && "text-muted-foreground"
                          )}>
                            {(() => {
                              const displayAction = maskSensitiveAction(action);
                              return getDisplayDescription(displayAction);
                            })()}
                            {isPasswordField(action) && <span className="ml-1">🔒</span>}
                            {stepResult?.aiResolved && (
                              <span
                                className={cn(
                                  "ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5",
                                  stepResult.aiResolved === 'ai-dom' && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                                  stepResult.aiResolved === 'ai-vision' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                                  stepResult.aiResolved === 'ai-corrected' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                                  stepResult.aiResolved === 'ai-verified' && "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
                                )}
                                title={
                                  stepResult.aiResolved === 'ai-dom' ? 'AI analyzed DOM to find this element' :
                                  stepResult.aiResolved === 'ai-vision' ? 'AI used screenshot vision to find this element' :
                                  stepResult.aiResolved === 'ai-corrected' ? 'AI detected and corrected a false positive' :
                                  stepResult.aiResolved === 'ai-verified' ? 'AI verified this step (possible false positive)' :
                                  'AI assisted with this step'
                                }
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                                  <path d="M8 1a.75.75 0 0 1 .75.75v.5a3.25 3.25 0 0 1 2.5 2.5h.5a.75.75 0 0 1 0 1.5h-.5a3.25 3.25 0 0 1-2.5 2.5v.5a.75.75 0 0 1-1.5 0v-.5a3.25 3.25 0 0 1-2.5-2.5h-.5a.75.75 0 0 1 0-1.5h.5a3.25 3.25 0 0 1 2.5-2.5v-.5A.75.75 0 0 1 8 1Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3.5 12.5a.75.75 0 0 1 .75.75v.25h.25a.75.75 0 0 1 0 1.5h-.25v.25a.75.75 0 0 1-1.5 0V15h-.25a.75.75 0 0 1 0-1.5h.25v-.25a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75v.25h.25a.75.75 0 0 1 0 1.5h-.25v.25a.75.75 0 0 1-1.5 0V15h-.25a.75.75 0 0 1 0-1.5h.25v-.25a.75.75 0 0 1 .75-.75Z" />
                                </svg>
                                {stepResult.aiResolved === 'ai-dom' ? 'AI' :
                                 stepResult.aiResolved === 'ai-vision' ? 'AI Vision' :
                                 stepResult.aiResolved === 'ai-corrected' ? 'AI Fixed' :
                                 stepResult.aiResolved === 'ai-verified' ? 'AI Check' : 'AI'}
                              </span>
                            )}
                            {stepResult?.status === 'healed' && (
                              <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30" title="Auto-healed: selector was broken but AI found the correct element">
                                Healed
                              </span>
                            )}
                            {stepResult?.status === 'healing' && (
                              <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                                Healing...
                              </span>
                            )}
                            {stepResult?.skipped && (
                              <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30" title="Auto-skipped: non-critical step">
                                Skipped
                              </span>
                            )}
                            {action.id && falsePositiveSteps.has(action.id) && (
                              <span className={cn(
                                "ml-1 text-xs px-1 rounded",
                                falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element')
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-amber-500/20 text-amber-400"
                              )}>🚩</span>
                            )}
                          </span>
                          {/* Action buttons for FAILED steps */}
                          {isFailed && testExecutionResult?.status !== 'running' && (
                            <div className="flex items-center gap-1 shrink-0">
                              {autoFixingSteps.has(idx) ? (
                                <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 animate-pulse flex items-center gap-1">
                                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/></svg>
                                  Fixing...
                                </span>
                              ) : autoFixResults.get(idx)?.success ? (
                                <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
                                  Fixed
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAutoFixStep(idx); }}
                                  disabled={!aiAvailable}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded border",
                                    aiAvailable
                                      ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                                      : "bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed"
                                  )}
                                  title={aiAvailable ? "AI Auto-Fix: automatically repair this step using AI healing chain" : "Enable AI in Settings to use Auto-Fix"}
                                >
                                  Fix
                                </button>
                              )}
                              {action.id && !falsePositiveSteps.has(action.id) && !autoFixingSteps.has(idx) && !autoFixResults.get(idx)?.success && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAutoFixStep(idx, { flagFirst: true }); }}
                                  disabled={!aiAvailable}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded border",
                                    aiAvailable
                                      ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30"
                                      : "bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed"
                                  )}
                                  title={aiAvailable ? "Flag as false positive and auto-fix with AI" : "Enable AI in Settings to use Flag & Fix"}
                                >
                                  Flag
                                </button>
                              )}
                              {action.id && falsePositiveSteps.has(action.id) && !autoFixingSteps.has(idx) && !autoFixResults.get(idx)?.success && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAutoFixStep(idx); }}
                                    disabled={!aiAvailable}
                                    className={cn(
                                      "px-2 py-0.5 text-[10px] rounded border",
                                      aiAvailable
                                        ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                                        : "bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed"
                                    )}
                                    title={aiAvailable ? "AI Auto-Fix this flagged step" : "Enable AI in Settings to use Auto-Fix"}
                                  >
                                    Fix
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); unmarkFalsePositive(action.id!); }}
                                    className="px-2 py-0.5 text-[10px] bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded border border-gray-500/30"
                                    title="Remove false positive flag"
                                  >
                                    Unflag
                                  </button>
                                </>
                              )}
                              {/* Manual button - always available, does not require AI */}
                              {!autoFixingSteps.has(idx) && !autoFixResults.get(idx)?.success && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManualAssistStep(manualAssistStep === idx ? null : idx);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded border",
                                    manualAssistStep === idx
                                      ? "bg-amber-500/30 text-amber-300 border-amber-500/50"
                                      : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400/70 hover:text-amber-400 border-amber-500/20 hover:border-amber-500/30"
                                  )}
                                  title="Manual Fix: paste element HTML, enter selector, or upload screenshot"
                                >
                                  Manual
                                </button>
                              )}
                            </div>
                          )}
                          {/* Fix/Flag buttons for PASSED steps */}
                          {stepResult?.status === 'passed' && testExecutionResult?.status !== 'running' && action.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              {autoFixingSteps.has(idx) ? (
                                <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 animate-pulse flex items-center gap-1">
                                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/></svg>
                                  Fixing...
                                </span>
                              ) : autoFixResults.get(idx)?.success ? (
                                <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
                                  Fixed
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAutoFixStep(idx); }}
                                  disabled={!aiAvailable}
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded border",
                                    aiAvailable
                                      ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                                      : "bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed"
                                  )}
                                  title={aiAvailable ? "AI Auto-Fix: automatically repair this step" : "Enable AI in Settings to use Auto-Fix"}
                                >
                                  Fix
                                </button>
                              )}
                              {!falsePositiveSteps.has(action.id) ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markStepAsFalsePositive(idx, stepResult?.screenshot || null, 'Wrong element — step passed but clicked incorrect element');
                                    if (aiAvailable) handleAutoFixStep(idx);
                                  }}
                                  className="px-2 py-0.5 text-[10px] bg-red-500/10 hover:bg-red-500/30 text-red-400/70 hover:text-red-400 rounded border border-red-500/20 hover:border-red-500/30"
                                  title={aiAvailable ? "Wrong element — flags and auto-fixes with AI" : "Wrong element — flags step (enable AI for auto-fix)"}
                                >
                                  Wrong
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); unmarkFalsePositive(action.id!); }}
                                  className="px-2 py-0.5 text-[10px] bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded border border-gray-500/30"
                                  title="Remove flag"
                                >
                                  Unflag
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {stepResult?.error && (
                          <p className="text-xs text-red-400 mt-1 truncate">
                            {classifyFailure(stepResult.error, getDisplayLabel(action)).message}
                          </p>
                        )}
                      </div>
                      {stepResult?.duration && (
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                          {stepResult.duration}ms
                        </span>
                      )}
                      {hasScreenshot && (
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {/* Manual Assist Card */}
                    {manualAssistStep === idx && (
                      <ManualAssistCard
                        testId={currentTestId}
                        stepId={action.id || `step-${idx}`}
                        stepIndex={idx}
                        stepLabel={getDisplayLabel(action)}
                        failedSelector={action.selector || action.selectorObj?.css || action.args?.[0]?.toString() || ''}
                        pageUrl={action.url || ''}
                        onSelectFix={(selector) => {
                          setActions(prev => {
                            const newActions = [...prev];
                            if (idx >= 0 && idx < newActions.length) {
                              newActions[idx] = {
                                ...newActions[idx],
                                selector: selector,
                                selectorObj: { ...newActions[idx].selectorObj, css: selector },
                                args: newActions[idx].args ? [selector, ...newActions[idx].args.slice(1)] : [selector],
                              };
                            }
                            return newActions;
                          });
                          setManualAssistStep(null);
                          setAutoFixResults(prev => new Map(prev).set(idx, { success: true, message: 'Fixed via Manual Assist' }));
                          toast.success(`Step ${idx + 1} selector updated via Manual Assist. Run test again to verify.`, { duration: 4000 });
                        }}
                        onClose={() => setManualAssistStep(null)}
                      />
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Screenshot Preview */}
            {testExecutionResult?.selectedScreenshot && (
              <div className="w-[300px] shrink-0 bg-gray-900 rounded-lg p-2 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Step Screenshot</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setTestExecutionResult(prev => prev ? { ...prev, selectedScreenshot: undefined } : null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <img
                  src={testExecutionResult.selectedScreenshot}
                  alt="Step screenshot"
                  className="w-full rounded border border-border"
                />
              </div>
            )}
          </div>

          {/* Error Message */}
          {testExecutionResult?.status === 'failed' && testExecutionResult?.error && !isTestPaused && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{testExecutionResult.error}</p>
            </div>
          )}

          {/* Summary Footer */}
          {testExecutionResult?.status !== 'running' && !isTestPaused && (
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {testExecutionResult?.stepResults.filter(r => r.status === 'passed').length || 0} / {testExecutionResult?.totalSteps || actions.length} steps passed
                {testExecutionResult?.stepResults.filter(r => r.status === 'skipped').length > 0 && (
                  <span className="text-gray-500 ml-2">
                    ({testExecutionResult?.stepResults.filter(r => r.status === 'skipped').length} skipped)
                  </span>
                )}
                {(() => {
                  const aiSteps = testExecutionResult?.stepResults.filter((r: any) => r.aiResolved) || [];
                  if (aiSteps.length === 0) return null;
                  return (
                    <span className="text-purple-400 ml-2" title={`AI assisted ${aiSteps.length} step(s): ${aiSteps.map((r: any) => `#${r.index + 1} (${r.aiResolved})`).join(', ')}`}>
                      AI: {aiSteps.length} step{aiSteps.length > 1 ? 's' : ''}
                    </span>
                  );
                })()}
              </span>
              <div className="flex items-center gap-2">
                {testExecutionResult?.status === 'failed' && (() => {
                  const failedIdx = testExecutionResult.failedStepIndex ??
                    testExecutionResult.stepResults?.find((r: { status: string }) => r.status === 'failed')?.index ?? 0;
                  const failedStepIndices = testExecutionResult.stepResults
                    ?.map((r: { status: string }, i: number) => r.status === 'failed' ? i : -1)
                    .filter((i: number) => i >= 0) || [];
                  const isAutoFixingAll = failedStepIndices.some((i: number) => autoFixingSteps.has(i));
                  const allFixed = failedStepIndices.length > 0 && failedStepIndices.every((i: number) => autoFixResults.get(i)?.success);
                  return (
                    <>
                      {failedStepIndices.length > 0 && !allFixed && (
                        <Button
                          onClick={() => {
                            failedStepIndices.forEach((i: number) => {
                              if (!autoFixResults.get(i)?.success) {
                                handleAutoFixStep(i);
                              }
                            });
                          }}
                          variant="outline"
                          className={cn(
                            aiAvailable
                              ? "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                              : "border-gray-500/30 text-gray-500 cursor-not-allowed"
                          )}
                          disabled={isAutoFixingAll || !aiAvailable}
                          title={aiAvailable
                            ? `AI Auto-Fix ${failedStepIndices.length} failed step${failedStepIndices.length > 1 ? 's' : ''}`
                            : "Enable AI in Settings to use Auto-Fix"
                          }
                        >
                          {isAutoFixingAll ? (
                            <><svg className="w-4 h-4 mr-1 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round"/></svg> Fixing...</>
                          ) : (
                            <>Auto-Fix All ({failedStepIndices.length})</>
                          )}
                        </Button>
                      )}
                      {allFixed && (
                        <span className="text-sm text-green-400">All steps fixed</span>
                      )}
                      <Button
                        onClick={() => handleRunFromStep(failedIdx)}
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        title="Run from the failed step (browser must be open)"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Run from here
                      </Button>
                      <Button
                        onClick={() => handleRunTest(false)}
                        variant="outline"
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry All
                      </Button>
                    </>
                  );
                })()}
                {testExecutionResult?.status === 'passed' && (
                  <Button
                    onClick={handleLockLocators}
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    title="Save working selectors for faster future runs"
                  >
                    Lock Locators
                  </Button>
                )}
                <Button
                  onClick={() => setShowTestResultModal(false)}
                  className={testExecutionResult?.status === 'passed' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700"}
                >
                  {testExecutionResult?.status === 'passed' ? "Done" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
