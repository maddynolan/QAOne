/**
 * RunsTabPanel - Renders the Runs tab content in Test Repository.
 * Shows run summary stats, run list with status, and actions (execute, rerun, results).
 */
import React from 'react';
import {
  PlayCircle, CheckCircle, AlertCircle, Clock, Play, RefreshCw,
  BarChart3, MoreVertical, Trash2, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TestRun } from '../types/test-repository.types';

interface RunsTabPanelProps {
  testRuns: TestRun[];
  executingRunId: string | null;
  executingStepIndex: number;
  onCreateRun: () => void;
  onExecuteRun: (run: TestRun) => void;
  onContinueManualRun: (run: TestRun) => void;
  onViewResults: (run: TestRun) => void;
  onRerunFromRun: (run: TestRun) => void;
  onRerunFromDropdown: (run: TestRun) => void;
  onDeleteRun: (runId: string) => void;
}

export function RunsTabPanel({
  testRuns,
  executingRunId,
  executingStepIndex,
  onCreateRun,
  onExecuteRun,
  onContinueManualRun,
  onViewResults,
  onRerunFromRun,
  onRerunFromDropdown,
  onDeleteRun,
}: RunsTabPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto">
        {testRuns.length === 0 ? (
          <div className="text-center py-16">
            <PlayCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Test Runs</h3>
            <p className="text-muted-foreground mb-4">Create a test run to execute your test cases</p>
            <Button
              onClick={onCreateRun}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Test Run
            </Button>
            <div className="mt-6 p-4 bg-secondary rounded-lg max-w-md mx-auto">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                <strong className="text-blue-600 dark:text-primary">Automated:</strong> Runs tests via Playwright in desktop app<br/>
                <strong className="text-blue-400">Manual:</strong> Step-by-step execution with screenshots &amp; defect linking
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Execution Summary */}
            {(() => {
              const totalRuns = testRuns.length;
              const passedRuns = testRuns.filter(r => r.status === 'passed').length;
              const failedRuns = testRuns.filter(r => r.status === 'failed').length;
              const pendingRuns = testRuns.filter(r => r.status === 'pending').length;
              const runningRuns = testRuns.filter(r => r.status === 'running').length;
              const passRate = totalRuns > 0 ? Math.round((passedRuns / (totalRuns - pendingRuns - runningRuns)) * 100) || 0 : 0;

              return (
                <div className="grid grid-cols-5 gap-3 mb-4">
                  <div className="bg-secondary rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{totalRuns}</div>
                    <div className="text-xs text-muted-foreground">Total Runs</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{passedRuns}</div>
                    <div className="text-xs text-emerald-400/70">Passed</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{failedRuns}</div>
                    <div className="text-xs text-red-400/70">Failed</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-primary">{pendingRuns + runningRuns}</div>
                    <div className="text-xs text-blue-600 dark:text-primary/70">Pending</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{passRate}%</div>
                    <div className="text-xs text-purple-400/70">Pass Rate</div>
                  </div>
                </div>
              );
            })()}

            {/* Run List */}
            <div className="space-y-2">
            {testRuns.slice(0, 50).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/30 group"
              >
                <div className="flex items-center gap-3">
                  {run.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {run.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {run.status === 'running' && <Clock className="w-5 h-5 text-blue-600 dark:text-primary animate-pulse" />}
                  {run.status === 'pending' && <Clock className="w-5 h-5 text-gray-500" />}
                  {run.status === 'blocked' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{run.name || 'Test Run'}</p>
                      {(run.testCaseIds?.length || 0) > 1 && (
                        <Badge className="text-xs bg-purple-500/10 text-purple-400">
                          {run.testCaseIds?.length} tests
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.startTime).toLocaleString()} &bull; {run.mode}
                      {run.executionMode && run.testCaseIds && run.testCaseIds.length > 1 &&
                        ` \u2022 ${run.executionMode}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {run.results && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-400">{run.results.passed}&#10003;</span>
                      <span className="text-red-400">{run.results.failed}&#10007;</span>
                      <span className="text-gray-500 dark:text-gray-400">{run.results.skipped}&#9675;</span>
                    </div>
                  )}
                  <Badge className={cn(
                    "text-xs",
                    run.mode === 'automated' ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-blue-600 dark:text-primary"
                  )}>
                    {run.mode}
                  </Badge>
                  {run.status === 'pending' && (run.testCaseId || (run.testCaseIds && run.testCaseIds.length > 0)) && (
                    <Button
                      size="sm"
                      className={cn(
                        "h-7 px-3",
                        run.mode === 'manual'
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-green-600 hover:bg-green-500"
                      )}
                      disabled={run.mode === 'automated' && (executingRunId === run.id || executingRunId !== null)}
                      onClick={() => onExecuteRun(run)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {run.mode === 'manual'
                        ? 'Start Manual Test'
                        : executingRunId === run.id
                          ? 'Running...'
                          : (run.testCaseIds?.length || 1) > 1
                            ? `Run ${run.testCaseIds?.length} Tests`
                            : 'Execute'}
                    </Button>
                  )}
                  {run.status === 'running' && executingRunId === run.id && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-primary">
                      <Clock className="w-3 h-3 animate-spin" />
                      {run.testCaseIds && run.testCaseIds.length > 1
                        ? `Test ${(run.currentTestIndex || 0) + 1}/${run.testCaseIds.length}`
                        : `Step ${executingStepIndex + 1}`}
                    </div>
                  )}
                  {/* Continue button for partial manual execution */}
                  {run.status === 'running' && run.mode === 'manual' && executingRunId !== run.id && (
                    <Button
                      size="sm"
                      className="h-7 px-3 bg-primary hover:bg-primary/90"
                      onClick={() => onContinueManualRun(run)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Continue
                    </Button>
                  )}
                  {/* View Results button for completed or partial runs */}
                  {(run.status === 'passed' || run.status === 'failed' || (run.status === 'running' && run.manualStepResults)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 border-border text-foreground hover:bg-accent"
                      onClick={() => onViewResults(run)}
                    >
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Results
                    </Button>
                  )}
                  {/* Rerun button for completed runs */}
                  {(run.status === 'passed' || run.status === 'failed') && (run.testCaseId || (run.testCaseIds && run.testCaseIds.length > 0)) && (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 h-7 px-3"
                      disabled={run.mode === 'automated' && executingRunId !== null}
                      onClick={() => onRerunFromRun(run)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Rerun
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border">
                      <DropdownMenuItem
                        className="text-foreground focus:bg-secondary"
                        onClick={() => onViewResults(run)}
                      >
                        <BarChart3 className="w-4 h-4 mr-2" /> View Results
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-foreground focus:bg-secondary"
                        disabled={!run.testCaseId || executingRunId !== null}
                        onClick={() => onRerunFromDropdown(run)}
                      >
                        <Play className="w-4 h-4 mr-2" /> Re-run
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-secondary" />
                      <DropdownMenuItem
                        className="text-red-400 focus:bg-red-500/10"
                        onClick={() => onDeleteRun(run.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
