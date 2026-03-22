import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Save, RefreshCw } from 'lucide-react';
import { TestStepList } from './TestStepList';
import type { TestResult } from './types';

interface TestResultCardProps {
  test: TestResult;
  expanded: boolean;
  onToggle: () => void;
  onSave: (test: TestResult) => void;
  onRerunWithFix?: (test: TestResult) => void;
  /** User provides a CSS/XPath selector for a failed step */
  onProvideSelector?: (stepIndex: number, selector: string) => void;
  /** User rephrases a failed step */
  onRephrase?: (stepIndex: number, newDescription: string) => void;
  /** User skips a failed step */
  onSkip?: (stepIndex: number) => void;
  theme: string;
  isRetrying?: boolean;
}

const statusConfig = {
  passed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Passed' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Warning' },
  running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Running' },
};

export function TestResultCard({
  test, expanded, onToggle, onSave, onRerunWithFix,
  onProvideSelector, onRephrase, onSkip,
  theme, isRetrying,
}: TestResultCardProps) {
  const config = statusConfig[test.status] || statusConfig.running;
  const StatusIcon = config.icon;

  // Get last screenshot from steps for the assist card
  const lastScreenshot = [...(test.steps || [])].reverse().find(s => s.screenshot)?.screenshot || test.screenshot;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
    )}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
        )}
      >
        <StatusIcon className={cn("w-4 h-4 flex-shrink-0", config.color, test.status === 'running' && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <span className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-900' : 'text-white')}>
            {test.name}
          </span>
          {test.description && (
            <p className={cn("text-xs truncate mt-0.5", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
              {test.description}
            </p>
          )}
        </div>
        <Badge className={cn("text-[10px] border-0", config.bg, config.color)}>
          {config.label}
        </Badge>
        {test.duration > 0 && (
          <span className={cn("text-xs tabular-nums", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
            {(test.duration / 1000).toFixed(1)}s
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className={cn(
          "border-t px-4 py-3 space-y-3",
          theme === 'light' ? 'border-gray-100' : 'border-gray-800'
        )}>
          <TestStepList
            steps={test.steps}
            theme={theme}
            onProvideSelector={onProvideSelector}
            onRephrase={onRephrase}
            onSkip={onSkip}
            lastScreenshot={lastScreenshot}
            isRetrying={isRetrying}
          />

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onSave(test)}>
              <Save className="w-3 h-3 mr-1" /> Save as Test Case
            </Button>
            {test.status === 'failed' && onRerunWithFix && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-purple-600 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-500/10"
                onClick={() => onRerunWithFix(test)}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Re-run with Fix
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
