/**
 * TestRunResultsDialog - Modal showing test execution results
 *
 * Displays test run summary stats, progress bar, step-by-step results
 * (with expandable details for multi-test runs), error messages,
 * screenshots, execution logs, and timestamps.
 */

import React, { useState } from 'react';
import {
  CheckCircle, AlertCircle, Clock, RefreshCw, Layers, FileText,
  ChevronDown, Bug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { TestRun, TestCase, StepResult } from '../types/test-repository.types';

interface TestRunResultsDialogProps {
  open: boolean;
  onClose: () => void;
  run: TestRun | null;
  testCase: TestCase | null;
  testCases?: TestCase[];
  onRerun?: () => void;
}

export function TestRunResultsDialog({
  open,
  onClose,
  run,
  testCase,
  testCases,
  onRerun
}: TestRunResultsDialogProps) {
  const [expandedTest, setExpandedTest] = useState<number | null>(null);

  if (!run) return null;

  const isManual = run.mode === 'manual';
  const isMultiTest = (run.testCaseIds && run.testCaseIds.length > 1) || (run.testResults && run.testResults.length > 1);

  // Get step results based on mode
  let stepResults: StepResult[] = [];
  let manualTestResults: Array<{
    testCaseId: string;
    testName: string;
    status: string;
    steps: StepResult[];
  }> = [];

  if (isManual && run.manualStepResults) {
    // For manual runs, get results from manualStepResults
    const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);

    if (testIds.length > 1) {
      // Multi-test manual run
      manualTestResults = testIds.map(tcId => {
        const tc = testCases?.find(t => t.id === tcId);
        const results = run.manualStepResults?.[tcId] || [];
        const hasFailures = results.some((r: StepResult) => r.status === 'failed');
        const allPassed = results.length > 0 && results.every((r: StepResult) => r.status === 'passed' || r.status === 'skipped');
        return {
          testCaseId: tcId,
          testName: tc?.name || tcId,
          status: hasFailures ? 'failed' : allPassed ? 'passed' : 'pending',
          steps: results
        };
      });
    } else if (testIds.length === 1) {
      // Single test manual run
      stepResults = run.manualStepResults?.[testIds[0]] || [];
    }
  } else {
    // For automated runs, use stepResults or testResults
    stepResults = run.stepResults || [];
  }

  const testResults = isManual ? manualTestResults : (run.testResults || []);

  // Calculate totals
  let totalSteps = 0;
  let passedSteps = 0;
  let failedSteps = 0;

  if (isMultiTest && testResults.length > 0) {
    totalSteps = testResults.length;
    passedSteps = testResults.filter(t => t.status === 'passed').length;
    failedSteps = testResults.filter(t => t.status === 'failed').length;
  } else if (stepResults.length > 0) {
    totalSteps = stepResults.length;
    passedSteps = stepResults.filter(s => s.status === 'passed').length;
    failedSteps = stepResults.filter(s => s.status === 'failed').length;
  }
  const duration = run.endTime && run.startTime
    ? Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 1000)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-popover border-border">
        <DialogHeader className="border-b border-gray-200 dark:border-gray-800 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className={cn(
              "p-2 rounded-lg",
              run.status === 'passed' ? "bg-emerald-500/20" :
              run.status === 'failed' ? "bg-red-500/20" : "bg-secondary"
            )}>
              {run.status === 'passed' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : run.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <div>
              <span className="text-lg">{run.name}</span>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                {testCase?.name || 'Test Execution Results'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{totalSteps}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{isMultiTest ? 'Total Tests' : 'Total Steps'}</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{passedSteps}</div>
              <div className="text-xs text-emerald-400/70">Passed</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{failedSteps}</div>
              <div className="text-xs text-red-400/70">Failed</div>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-primary">{duration}s</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Duration</div>
            </div>
          </div>

          {/* Execution Mode Info */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            <Badge className={cn(
              "text-xs",
              run.mode === 'manual' ? "bg-amber-500/10 text-blue-600 dark:text-primary" : "bg-blue-500/10 text-blue-400"
            )}>
              {run.mode === 'manual' ? 'Manual Execution' : 'Automated Execution'}
            </Badge>
            {isMultiTest && (
              <>
                <Badge className={cn(
                  "text-xs",
                  run.executionMode === 'parallel' ? "bg-purple-500/10 text-purple-400" : "bg-gray-500/10 text-gray-500 dark:text-gray-400"
                )}>
                  {run.executionMode === 'parallel' ? 'Parallel' : 'Sequential'}
                </Badge>
                <span>&#8226;</span>
                <span>{testResults.length} test cases</span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {totalSteps > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Progress</span>
                <span>{Math.round((passedSteps / totalSteps) * 100)}% passed</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(passedSteps / totalSteps) * 100}%` }}
                />
                <div
                  className="bg-red-500 h-full transition-all duration-500"
                  style={{ width: `${(failedSteps / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {run.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-400 mb-1">Execution Failed</div>
                  <p className="text-sm text-red-300/80">{run.errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results - Multi-test or Single-test */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {isMultiTest ? 'Test Results' : 'Step Results'}
            </h3>
            <div className="space-y-2">
              {isMultiTest ? (
                // Multi-test results with expandable details
                testResults.length > 0 ? (
                  testResults.map((testResult, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border transition-colors",
                        testResult.status === 'passed' ? "bg-emerald-900/10 border-emerald-800/50" :
                        testResult.status === 'failed' ? "bg-red-900/20 border-red-800/50" :
                        testResult.status === 'skipped' ? "bg-secondary border-border/50" :
                        "bg-amber-900/10 border-amber-800/50"
                      )}
                    >
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
                        onClick={() => setExpandedTest(expandedTest === idx ? null : idx)}
                      >
                        <div className="flex-shrink-0">
                          {testResult.status === 'passed' ? (
                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                          ) : testResult.status === 'failed' ? (
                            <AlertCircle className="h-5 w-5 text-red-400" />
                          ) : testResult.status === 'skipped' ? (
                            <Clock className="h-5 w-5 text-gray-500" />
                          ) : (
                            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-primary animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-foreground">
                                Test {idx + 1}
                              </span>
                              <span className="text-sm text-white font-medium truncate">
                                {testResult.testName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {testResult.duration !== undefined && (
                                <span className="text-xs text-gray-500">
                                  {Math.round(testResult.duration / 1000)}s
                                </span>
                              )}
                              {testResult.stepResults && testResult.stepResults.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  {testResult.stepResults.filter(s => s.status === 'passed').length}/
                                  {testResult.stepResults.length} steps
                                </span>
                              )}
                              <ChevronDown className={cn(
                                "w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform",
                                expandedTest === idx && "transform rotate-180"
                              )} />
                            </div>
                          </div>
                          {testResult.errorMessage && (
                            <div className="mt-1 text-xs text-red-400 truncate">
                              Error: {testResult.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expanded test details - handles both automated and manual step results */}
                      {expandedTest === idx && ((testResult as any).stepResults?.length > 0 || (testResult as any).steps?.length > 0) && (
                        <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-2 bg-black/20">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Step Details:</div>
                          {((testResult as any).stepResults || (testResult as any).steps || []).map((step: any, stepIdx: number) => (
                            <div
                              key={stepIdx}
                              className={cn(
                                "rounded p-2 text-sm flex items-start gap-2",
                                step.status === 'passed' ? "bg-emerald-900/20" :
                                step.status === 'failed' ? "bg-red-900/30" :
                                step.status === 'skipped' ? "bg-secondary/30" :
                                "bg-secondary"
                              )}
                            >
                              {step.status === 'passed' ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              ) : step.status === 'failed' ? (
                                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                              ) : step.status === 'skipped' ? (
                                <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-foreground">
                                    Step {(step.stepIndex ?? stepIdx) + 1}
                                  </span>
                                  <span className="text-foreground">{step.stepName || `Step ${(step.stepIndex ?? stepIdx) + 1}`}</span>
                                  {step.duration && (
                                    <span className="text-xs text-gray-500">({step.duration}ms)</span>
                                  )}
                                  {step.defectId && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 flex items-center gap-1">
                                      <Bug className="w-3 h-3" />
                                      {step.defectId}
                                    </span>
                                  )}
                                </div>
                                {step.notes && (
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Notes: {step.notes}
                                  </div>
                                )}
                                {(step.error || step.errorMessage) && (
                                  <div className="mt-1 text-xs text-red-300 bg-red-900/30 rounded p-1">
                                    {step.error || step.errorMessage}
                                  </div>
                                )}
                                {/* Single screenshot (automated) */}
                                {step.screenshot && typeof step.screenshot === 'string' && (
                                  <img
                                    src={step.screenshot}
                                    alt={`Screenshot`}
                                    className="mt-2 rounded border border-border max-h-32 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(step.screenshot, '_blank')}
                                  />
                                )}
                                {/* Multiple screenshots (manual) */}
                                {step.screenshots && step.screenshots.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {step.screenshots.map((img: string, imgIdx: number) => (
                                      <img
                                        key={imgIdx}
                                        src={img}
                                        alt={`Screenshot ${imgIdx + 1}`}
                                        className="rounded border border-border h-20 cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(img, '_blank')}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No test results available</p>
                  </div>
                )
              ) : (
                // Single test step results (both automated and manual)
                stepResults.length > 0 ? (
                  stepResults.map((step: any, idx: number) => {
                    // Get step definition from test case for details
                    const tcSteps = testCase?.unified_data?.steps || testCase?.steps || [];
                    const stepDef = tcSteps[step.stepIndex ?? idx];
                    const stepAction = stepDef?.action || stepDef?.qword || stepDef?.type || '';
                    const stepSelector = stepDef?.selector || stepDef?.args?.selector || '';
                    const stepValue = stepDef?.value || stepDef?.args?.value || stepDef?.args?.text || stepDef?.args?.url || stepDef?.args?.[0] || '';
                    const expectedResult = stepDef?.expectedResult || stepDef?.expected_result ||
                      (stepDef?.assertion?.value ? `Verify: ${stepDef.assertion.value}` : '');

                    // Build readable action description
                    let actionDescription = stepAction;
                    if (stepDef?.qword) {
                      const qword = stepDef.qword.toLowerCase();
                      if (qword === 'goto' || qword === 'navigate') {
                        actionDescription = `Navigate to ${stepValue || 'URL'}`;
                      } else if (qword === 'click' || qword === 'clicktext') {
                        actionDescription = `Click on ${stepValue || stepSelector || 'element'}`;
                      } else if (qword === 'fill' || qword === 'type') {
                        actionDescription = `Enter "${stepValue}" into ${stepSelector || 'field'}`;
                      } else if (qword === 'asserttext' || qword === 'assert') {
                        actionDescription = `Verify "${stepValue}" is visible`;
                      } else if (qword === 'select') {
                        actionDescription = `Select "${stepValue}" from ${stepSelector || 'dropdown'}`;
                      } else if (qword === 'wait') {
                        actionDescription = `Wait ${stepValue || stepDef?.args?.timeout || ''}ms`;
                      }
                    }

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          step.status === 'passed' ? "bg-emerald-900/10 border-emerald-800/50" :
                          step.status === 'failed' ? "bg-red-900/20 border-red-800/50" :
                          step.status === 'skipped' ? "bg-secondary border-border/50" :
                          "bg-amber-900/10 border-amber-800/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {step.status === 'passed' ? (
                              <CheckCircle className="h-5 w-5 text-emerald-400" />
                            ) : step.status === 'failed' ? (
                              <AlertCircle className="h-5 w-5 text-red-400" />
                            ) : step.status === 'skipped' ? (
                              <Clock className="h-5 w-5 text-gray-500" />
                            ) : (
                              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-primary animate-spin" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Step Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-foreground font-medium">
                                  Step {(step.stepIndex ?? idx) + 1}
                                </span>
                                <span className="text-sm text-white font-medium">
                                  {step.stepName || actionDescription || `Step ${(step.stepIndex ?? idx) + 1}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {step.duration !== undefined && (
                                  <span className="text-xs text-gray-500">
                                    {step.duration}ms
                                  </span>
                                )}
                                {step.defectId && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 flex items-center gap-1">
                                    <Bug className="w-3 h-3" />
                                    {step.defectId}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Step Details - Action & Expected Result */}
                            {(actionDescription || expectedResult) && (
                              <div className="mt-2 space-y-1.5">
                                {actionDescription && actionDescription !== step.stepName && (
                                  <div className="flex items-start gap-2 text-xs">
                                    <span className="text-gray-500 min-w-[60px]">Action:</span>
                                    <span className="text-foreground">{actionDescription}</span>
                                  </div>
                                )}
                                {stepSelector && (
                                  <div className="flex items-start gap-2 text-xs">
                                    <span className="text-gray-500 min-w-[60px]">Target:</span>
                                    <code className="text-blue-600 dark:text-primary/80 bg-secondary px-1.5 py-0.5 rounded font-mono text-[11px] break-all">
                                      {stepSelector}
                                    </code>
                                  </div>
                                )}
                                {expectedResult && (
                                  <div className="flex items-start gap-2 text-xs">
                                    <span className="text-gray-500 min-w-[60px]">Expected:</span>
                                    <span className="text-blue-400">{expectedResult}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Notes (manual execution) */}
                            {step.notes && (
                              <div className="mt-2 p-2 bg-secondary rounded text-xs text-foreground">
                                <span className="text-gray-500">Notes:</span> {step.notes}
                              </div>
                            )}

                            {/* Error message */}
                            {(step.error || step.errorMessage) && (
                              <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300 font-mono">
                                {step.error || step.errorMessage}
                              </div>
                            )}

                            {/* Defect details */}
                            {step.defectTitle && (
                              <div className="mt-2 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs">
                                <div className="flex items-center gap-2 text-red-400 font-medium">
                                  <Bug className="w-3 h-3" />
                                  {step.defectId}
                                </div>
                                <div className="text-foreground mt-1">{step.defectTitle}</div>
                              </div>
                            )}

                            {/* Single screenshot (automated) */}
                            {step.screenshot && typeof step.screenshot === 'string' && (
                              <div className="mt-2">
                                <img
                                  src={step.screenshot}
                                  alt={`Screenshot for step ${(step.stepIndex ?? idx) + 1}`}
                                  className="rounded border border-border max-h-48 cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(step.screenshot, '_blank')}
                                />
                              </div>
                            )}

                            {/* Multiple screenshots (manual execution) */}
                            {step.screenshots && step.screenshots.length > 0 && (
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {step.screenshots.map((img: string, imgIdx: number) => (
                                  <img
                                    key={imgIdx}
                                    src={img}
                                    alt={`Screenshot ${imgIdx + 1}`}
                                    className="rounded border border-border h-24 w-full object-cover cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(img, '_blank')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No step results available</p>
                    <p className="text-xs mt-1">Run the test to see detailed results</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Execution Logs */}
          {run.logs && run.logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Execution Logs
              </h3>
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-pre-wrap">
                  {run.logs.join('\n')}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-800">
            <span>Started: {run.startTime ? new Date(run.startTime).toLocaleString() : 'N/A'}</span>
            <span>Ended: {run.endTime ? new Date(run.endTime).toLocaleString() : 'N/A'}</span>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <div className="flex gap-2 w-full justify-between">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-accent"
            >
              Close
            </Button>
            <div className="flex gap-2">
              {onRerun && (
                <Button
                  onClick={() => {
                    onClose();
                    onRerun();
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rerun Test
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
