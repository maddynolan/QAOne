/**
 * TestResultsPanel Component
 *
 * Full-width test execution results panel with step-by-step timeline,
 * expandable per-step details, and scrollable log viewer.
 * Replaces the cramped inline results block in the left sidebar.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronRight,
  Wand2, Crosshair, SkipForward, Clock, Zap, X, Terminal,
  ChevronUp, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepResult {
  stepId?: string;
  status: string;
  error?: string;
  healed?: boolean;
  workingSelector?: string;
  screenshot?: string;     // base64 screenshot on failure
  retries?: number;        // number of retry attempts
  tracePath?: string;      // path to Playwright trace file
}

interface ExecutionResult {
  status: 'idle' | 'running' | 'passed' | 'failed';
  currentStep: number;
  results: StepResult[];
  logs: string[];
}

interface TestStep {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  [key: string]: any;
}

interface TestResultsPanelProps {
  executionResult: ExecutionResult;
  steps: TestStep[];
  isRunning: boolean;
  browserKeptOpen?: boolean;
  onFixStep?: (stepIndex: number) => void;
  onRerecordStep?: (stepIndex: number) => void;
  onSkipAndContinue?: () => void;
  onClose?: () => void;
}

export default function TestResultsPanel({
  executionResult,
  steps,
  isRunning,
  browserKeptOpen,
  onFixStep,
  onRerecordStep,
  onSkipAndContinue,
  onClose,
}: TestResultsPanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current && showLogs) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [executionResult.logs, showLogs]);

  // Auto-expand failed step
  useEffect(() => {
    if (executionResult.status === 'failed') {
      const failedIdx = executionResult.results.findIndex(r => r.status === 'failed');
      if (failedIdx >= 0) setExpandedStep(failedIdx);
    }
  }, [executionResult.status, executionResult.results]);

  if (executionResult.status === 'idle') return null;

  const enabledSteps = steps.filter(s => s.enabled);
  const passedCount = executionResult.results.filter(r => r.status === 'passed').length;
  const failedCount = executionResult.results.filter(r => r.status === 'failed').length;
  const healedCount = executionResult.results.filter(r => r.healed).length;
  const totalSteps = enabledSteps.length;
  const pendingCount = totalSteps - passedCount - failedCount;

  // Duration from logs
  const durationMatch = executionResult.logs.join('\n').match(/\((\d+)ms\)/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : null;

  const statusConfig = {
    running: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', label: 'Running...' },
    passed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-600 dark:text-green-400', label: 'Passed' },
    failed: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-600 dark:text-red-400', label: 'Failed' },
  };
  const config = statusConfig[executionResult.status as keyof typeof statusConfig] || statusConfig.running;

  if (isCollapsed) {
    return (
      <div className={`border-t-2 ${config.bg} px-4 py-2 flex items-center justify-between cursor-pointer`}
           onClick={() => setIsCollapsed(false)}>
        <div className="flex items-center gap-3">
          {executionResult.status === 'running' && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
          {executionResult.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-500" />}
          {executionResult.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-500" />}
          <span className={`font-semibold text-sm ${config.text}`}>{config.label}</span>
          <span className="text-xs text-muted-foreground">
            {passedCount} passed · {failedCount} failed {healedCount > 0 ? `· ${healedCount} healed` : ''} {duration ? `· ${duration}ms` : ''}
          </span>
        </div>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`border-t-2 ${config.bg} flex flex-col max-h-[45vh] min-h-[180px]`}>
      {/* Summary Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {executionResult.status === 'running' && <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />}
            {executionResult.status === 'passed' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {executionResult.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
            <span className={`font-bold text-base ${config.text}`}>{config.label}</span>
          </div>

          {/* Step Counts */}
          <div className="flex items-center gap-3 text-xs">
            {passedCount > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <CheckCircle className="h-3 w-3" /> {passedCount} passed
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertCircle className="h-3 w-3" /> {failedCount} failed
              </span>
            )}
            {healedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Shield className="h-3 w-3" /> {healedCount} healed
              </span>
            )}
            {executionResult.status === 'running' && pendingCount > 0 && (
              <span className="text-muted-foreground">{pendingCount} pending</span>
            )}
          </div>

          {duration && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {duration}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(!showLogs)}>
            <Terminal className="h-3 w-3 mr-1" />
            {showLogs ? 'Hide Logs' : 'Logs'}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => setIsCollapsed(true)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
          {onClose && !isRunning && (
            <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Step Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {showLogs ? (
          // Log Viewer
          <div ref={logRef} className="h-full bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-xs overflow-auto">
            {executionResult.logs.map((line, i) => (
              <div key={i} className={`py-0.5 ${
                line.includes('FAILED') || line.includes('Error') || line.includes('❌') ? 'text-red-400' :
                line.includes('PASSED') || line.includes('✅') ? 'text-green-400' :
                line.includes('healed') || line.includes('🔧') ? 'text-amber-400' :
                line.includes('▶') ? 'text-blue-400' :
                'text-slate-300'
              }`}>{line}</div>
            ))}
            {executionResult.status === 'running' && (
              <div className="text-blue-400 animate-pulse py-0.5">▶ Running...</div>
            )}
          </div>
        ) : (
          // Step-by-step timeline
          <div className="space-y-1">
            {enabledSteps.map((step, idx) => {
              const result = executionResult.results[idx];
              const isCurrentStep = executionResult.status === 'running' && idx === executionResult.currentStep;
              const isPending = !result && !isCurrentStep;
              const isExpanded = expandedStep === idx;

              const stepStatus = isCurrentStep ? 'running' : result?.status || 'pending';

              const statusIcon = {
                passed: <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />,
                failed: <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
                running: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />,
                skipped: <SkipForward className="h-4 w-4 text-gray-400 flex-shrink-0" />,
                pending: <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />,
              };

              const statusColors = {
                passed: 'border-green-500/20 bg-green-500/5',
                failed: 'border-red-500/20 bg-red-500/5',
                running: 'border-blue-500/30 bg-blue-500/10',
                skipped: 'border-gray-500/20 bg-gray-500/5',
                pending: 'border-border/50 bg-transparent opacity-50',
              };

              return (
                <div key={step.id} className={`rounded-lg border ${statusColors[stepStatus as keyof typeof statusColors] || statusColors.pending}`}>
                  <div
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedStep(isExpanded ? null : idx)}
                  >
                    {/* Step number */}
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right flex-shrink-0">{idx + 1}</span>

                    {/* Status icon */}
                    {statusIcon[stepStatus as keyof typeof statusIcon] || statusIcon.pending}

                    {/* Step name */}
                    <span className={`text-sm flex-1 truncate ${stepStatus === 'pending' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                      {step.name || step.type}
                    </span>

                    {/* Healed badge */}
                    {result?.healed && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                        <Shield className="h-2.5 w-2.5" /> Healed
                      </span>
                    )}

                    {/* Expand arrow */}
                    {(result?.error || result?.healed || result?.workingSelector || result?.screenshot) && (
                      isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (result?.error || result?.healed || result?.workingSelector || result?.screenshot) && (
                    <div className="px-3 pb-2 ml-[52px] space-y-2">
                      {result.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 rounded px-2 py-1.5 font-mono">
                          {result.error}
                        </div>
                      )}
                      {result.screenshot && (
                        <div className="mt-2">
                          <img
                            src={result.screenshot.startsWith('data:') ? result.screenshot : `data:image/png;base64,${result.screenshot}`}
                            alt="Failure screenshot"
                            className="max-w-full rounded border border-border/50 cursor-pointer hover:opacity-90"
                            style={{ maxHeight: '200px' }}
                            onClick={() => window.open(result.screenshot!.startsWith('data:') ? result.screenshot! : `data:image/png;base64,${result.screenshot}`, '_blank')}
                          />
                          <span className="text-[10px] text-muted-foreground">Click to enlarge</span>
                        </div>
                      )}
                      {result.healed && result.workingSelector && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
                          <span className="font-medium">Healed selector:</span> <code className="font-mono">{result.workingSelector}</code>
                        </div>
                      )}
                      {/* Action buttons for failed steps */}
                      {result.status === 'failed' && (
                        <div className="flex gap-2 pt-1">
                          {onFixStep && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-400 dark:hover:bg-purple-500/10"
                              onClick={(e) => { e.stopPropagation(); onFixStep(idx); }}>
                              <Wand2 className="h-3 w-3 mr-1" /> Fix Step
                            </Button>
                          )}
                          {onRerecordStep && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-500/10"
                              onClick={(e) => { e.stopPropagation(); onRerecordStep(idx); }}>
                              <Crosshair className="h-3 w-3 mr-1" /> Re-trace
                            </Button>
                          )}
                          {browserKeptOpen && onSkipAndContinue && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] border-green-300 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-500/10"
                              onClick={(e) => { e.stopPropagation(); onSkipAndContinue(); }}>
                              <SkipForward className="h-3 w-3 mr-1" /> Skip & Continue
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress bar for running state */}
      {executionResult.status === 'running' && totalSteps > 0 && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((executionResult.currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
