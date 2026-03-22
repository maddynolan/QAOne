/**
 * FailedStepAssist — AI-native failure display.
 *
 * Unlike Record & Playback's ManualAssistCard which asks users to paste selectors,
 * this shows what the AI TRIED and what it SAW — no manual element picking.
 *
 * The healing pipeline is fully autonomous (6 layers + 3 retry rounds).
 * This card only appears AFTER all autonomous healing has been exhausted.
 *
 * User actions:
 * - View what the AI tried (expandable heal attempt log)
 * - View the screenshot at failure point
 * - Skip this step and continue to the next goal step
 * - Re-run the entire test with the Self-Healer agent
 *
 * Inspired by: Momentic (tri-modal), TestRigor (no selectors), BLINQ (RCA).
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SkipForward,
  X,
  AlertTriangle,
  Eye,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Layers,
  Zap,
  Search,
  ScanEye,
  Brain,
  MousePointer,
} from 'lucide-react';
import type { TestStep } from './types';

interface FailedStepAssistProps {
  step: TestStep;
  screenshot?: string | null;
  onSkip: () => void;
  onDismiss: () => void;
  theme: string;
}

/** Map heal methods to human-readable descriptions */
function describeHealAttempts(step: TestStep): Array<{ icon: React.ReactNode; label: string; tried: boolean }> {
  const method = step.method || '';
  const error = step.error || '';

  return [
    {
      icon: <MousePointer className="w-3 h-3" />,
      label: 'Playwright roles (button, link, tab, menuitem)',
      tried: true,
    },
    {
      icon: <Search className="w-3 h-3" />,
      label: 'Text match (exact + fuzzy), CSS selectors, XPath',
      tried: true,
    },
    {
      icon: <Layers className="w-3 h-3" />,
      label: 'Page scanner: 13 selector strategies ranked by confidence',
      tried: true,
    },
    {
      icon: <Zap className="w-3 h-3" />,
      label: 'App-specific selectors (Salesforce, Workday, ServiceNow)',
      tried: true,
    },
    {
      icon: <ScanEye className="w-3 h-3" />,
      label: 'Vision AI: screenshot → GPT-4o → click coordinates',
      tried: method !== 'all_layers_failed' || error.includes('Vision'),
    },
    {
      icon: <Brain className="w-3 h-3" />,
      label: 'LLM re-interpretation: semantic element matching',
      tried: method !== 'all_layers_failed' || error.includes('LLM'),
    },
  ];
}

/** Classify the failure root cause (like BLINQ's RCA) */
function classifyFailure(step: TestStep): { type: string; label: string; color: string; suggestion: string } {
  const err = (step.error || '').toLowerCase();
  const target = step.target || '';

  if (err.includes('not visible') || err.includes('not found') || err.includes('all_layers'))
    return {
      type: 'locator',
      label: 'Element Not Found',
      color: 'bg-amber-500/10 text-amber-500',
      suggestion: `The element "${target}" isn't in the DOM or is rendered by a framework the scanner can't reach (iframe, shadow DOM, dynamic JS). The AI tried 6 resolution strategies including Vision AI and semantic matching.`,
    };
  if (err.includes('timeout'))
    return {
      type: 'timing',
      label: 'Timeout',
      color: 'bg-blue-500/10 text-blue-500',
      suggestion: 'The element exists but took too long to appear. This is common with slow API calls or heavy JavaScript frameworks.',
    };
  if (err.includes('intercepted') || err.includes('overlay'))
    return {
      type: 'overlay',
      label: 'Blocked by Overlay',
      color: 'bg-purple-500/10 text-purple-500',
      suggestion: 'A cookie banner, modal, or tooltip is covering the element. Try adding a "dismiss" step before this one.',
    };
  if (err.includes('detached') || err.includes('navigation'))
    return {
      type: 'navigation',
      label: 'Page Changed',
      color: 'bg-cyan-500/10 text-cyan-500',
      suggestion: 'The page navigated away before the action completed. The previous step may have triggered a redirect.',
    };
  return {
    type: 'unknown',
    label: 'Resolution Failed',
    color: 'bg-gray-500/10 text-gray-500',
    suggestion: `All 6 resolution layers were exhausted. Try re-running with the Self-Healer or rephrasing the goal step.`,
  };
}

export function FailedStepAssist({
  step,
  screenshot,
  onSkip,
  onDismiss,
  theme,
}: FailedStepAssistProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const healAttempts = describeHealAttempts(step);
  const failure = classifyFailure(step);

  return (
    <div className={cn(
      "rounded-lg border mt-1 mb-2 overflow-hidden transition-all",
      theme === 'light'
        ? "border-amber-200 bg-gradient-to-b from-amber-50/80 to-white"
        : "border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-gray-900"
    )}>
      {/* Header: RCA badge + target */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <Badge className={cn("text-[10px] border-0", failure.color)}>{failure.label}</Badge>
          <span className={cn("text-xs font-medium truncate", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
            "{step.target}"
          </span>
        </div>
        <button onClick={onDismiss} className="p-0.5 rounded hover:bg-gray-200/50 dark:hover:bg-gray-700/50">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* AI explanation */}
      <div className={cn("px-3 pb-2 text-[11px] flex items-start gap-1.5", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-500" />
        <span>{failure.suggestion}</span>
      </div>

      {/* What the AI tried (expandable) */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium",
            theme === 'light' ? 'text-gray-500 hover:text-gray-700' : 'text-gray-500 hover:text-gray-300'
          )}
        >
          {showDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          6 resolution strategies attempted
        </button>
        {showDetails && (
          <div className="mt-1.5 space-y-1">
            {healAttempts.map((attempt, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={attempt.tried ? 'text-red-400' : 'text-gray-400'}>
                  {attempt.tried ? '✗' : '—'}
                </span>
                <span className={cn("flex-shrink-0", theme === 'light' ? 'text-gray-400' : 'text-gray-600')}>
                  {attempt.icon}
                </span>
                <span className={theme === 'light' ? 'text-gray-600' : 'text-gray-400'}>
                  {attempt.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screenshot (expandable) */}
      {screenshot && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowScreenshot(!showScreenshot)}
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium",
              theme === 'light' ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
            )}
          >
            <Eye className="w-3 h-3" />
            {showScreenshot ? 'Hide' : 'View'} page at failure
            {showScreenshot ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {showScreenshot && (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Page at failure point"
              className={cn(
                "mt-1.5 w-full max-h-48 object-contain rounded border",
                theme === 'light' ? 'border-gray-200' : 'border-gray-700'
              )}
            />
          )}
        </div>
      )}

      {/* Actions — only Skip (Re-run with Fix is on the TestResultCard level) */}
      <div className="flex gap-1.5 px-3 pb-3">
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-7 text-xs",
            theme === 'light'
              ? "border-gray-300 text-gray-600 hover:bg-gray-100"
              : "border-gray-700 text-gray-400 hover:bg-gray-800"
          )}
          onClick={onSkip}
        >
          <SkipForward className="w-3 h-3 mr-1" /> Skip & continue
        </Button>
      </div>
    </div>
  );
}
