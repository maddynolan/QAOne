/**
 * FailedStepAssist — Inline intervention card shown on failed steps.
 *
 * When all 5 element resolution layers fail, the user sees:
 * 1. What the AI was looking for (target text)
 * 2. A screenshot of the page at failure point
 * 3. Three actions they can take:
 *    a) "Point at it" — paste a CSS/XPath selector or element text
 *    b) "Rephrase" — rewrite the step description for the AI
 *    c) "Skip & continue" — mark step as skipped and proceed
 *
 * This turns a dead-end failure into a collaborative recovery.
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MousePointer,
  PenLine,
  SkipForward,
  Send,
  X,
  Search,
  AlertTriangle,
  Eye,
  Lightbulb,
  Crosshair,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { TestStep } from './types';

interface FailedStepAssistProps {
  step: TestStep;
  screenshot?: string | null;
  onProvideSelector: (selector: string) => void;
  onRephrase: (newDescription: string) => void;
  onSkip: () => void;
  onDismiss: () => void;
  theme: string;
  isSubmitting?: boolean;
}

type AssistMode = null | 'selector' | 'rephrase';

export function FailedStepAssist({
  step,
  screenshot,
  onProvideSelector,
  onRephrase,
  onSkip,
  onDismiss,
  theme,
  isSubmitting,
}: FailedStepAssistProps) {
  const [mode, setMode] = useState<AssistMode>(null);
  const [selectorInput, setSelectorInput] = useState('');
  const [rephraseInput, setRephraseInput] = useState(step.description || `${step.action} ${step.target}`);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const target = step.target || '';

  // Suggest what might help
  const getSuggestion = (): string => {
    const err = (step.error || '').toLowerCase();
    if (err.includes('not visible') || err.includes('not found') || err.includes('goal_blocked'))
      return 'The element may be inside an iframe, behind a modal, or rendered by JavaScript after page load. Try providing a CSS selector or rephrasing the step.';
    if (err.includes('timeout'))
      return 'The element took too long to appear. It might be loaded dynamically or require scrolling to.';
    if (err.includes('intercepted') || err.includes('overlay'))
      return 'Something is covering the element (cookie banner, modal, tooltip). Try dismissing it first.';
    return 'The AI could not find this element using any of its 5 resolution strategies. You can help by pointing at it or rephrasing.';
  };

  return (
    <div className={cn(
      "rounded-lg border-2 border-dashed mt-1 mb-2 overflow-hidden transition-all",
      theme === 'light'
        ? "border-amber-300 bg-amber-50/50"
        : "border-amber-500/40 bg-amber-500/5"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className={cn("text-xs font-semibold", theme === 'light' ? 'text-amber-800' : 'text-amber-300')}>
            Can't find: "{target}"
          </span>
        </div>
        <button
          onClick={onDismiss}
          className={cn(
            "p-0.5 rounded transition-colors",
            theme === 'light' ? 'hover:bg-amber-200/50 text-amber-400' : 'hover:bg-amber-500/20 text-amber-500'
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Suggestion */}
      <div className={cn(
        "px-3 pb-2 text-[11px] flex items-start gap-1.5",
        theme === 'light' ? 'text-amber-700' : 'text-amber-400/80'
      )}>
        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>{getSuggestion()}</span>
      </div>

      {/* Screenshot toggle */}
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
            {showScreenshot ? 'Hide' : 'Show'} page screenshot
            {showScreenshot ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {showScreenshot && (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Page at failure point"
              className={cn(
                "mt-1.5 w-full max-h-48 object-contain rounded border",
                theme === 'light' ? 'border-amber-200' : 'border-amber-500/30'
              )}
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      {!mode && (
        <div className="flex gap-1.5 px-3 pb-3">
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "flex-1 h-8 text-xs",
              theme === 'light'
                ? "border-amber-300 text-amber-700 hover:bg-amber-100"
                : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            )}
            onClick={() => setMode('selector')}
          >
            <Crosshair className="w-3 h-3 mr-1" /> Point at it
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "flex-1 h-8 text-xs",
              theme === 'light'
                ? "border-amber-300 text-amber-700 hover:bg-amber-100"
                : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            )}
            onClick={() => setMode('rephrase')}
          >
            <PenLine className="w-3 h-3 mr-1" /> Rephrase step
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "flex-1 h-8 text-xs",
              theme === 'light'
                ? "border-gray-300 text-gray-500 hover:bg-gray-100"
                : "border-gray-700 text-gray-400 hover:bg-gray-800"
            )}
            onClick={onSkip}
          >
            <SkipForward className="w-3 h-3 mr-1" /> Skip
          </Button>
        </div>
      )}

      {/* Selector mode */}
      {mode === 'selector' && (
        <div className="px-3 pb-3 space-y-2">
          <p className={cn("text-[11px]", theme === 'light' ? 'text-amber-700' : 'text-amber-400')}>
            Paste a CSS selector, XPath, or the exact text of the element:
          </p>
          <div className="flex gap-1.5">
            <Input
              value={selectorInput}
              onChange={(e) => setSelectorInput(e.target.value)}
              placeholder='e.g. button:has-text("18-35") or #age-selector'
              className={cn(
                "h-8 text-xs flex-1 font-mono",
                theme === 'light' ? "bg-white border-amber-200" : "bg-gray-900 border-amber-500/30"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectorInput.trim()) onProvideSelector(selectorInput.trim());
              }}
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!selectorInput.trim() || isSubmitting}
              onClick={() => onProvideSelector(selectorInput.trim())}
            >
              {isSubmitting ? <Search className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
          </div>
          <div className={cn("text-[10px] space-y-0.5", theme === 'light' ? 'text-gray-500' : 'text-gray-500')}>
            <p>Examples: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">#my-button</code> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">[data-testid="age-18-35"]</code> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">18-35</code></p>
          </div>
        </div>
      )}

      {/* Rephrase mode */}
      {mode === 'rephrase' && (
        <div className="px-3 pb-3 space-y-2">
          <p className={cn("text-[11px]", theme === 'light' ? 'text-amber-700' : 'text-amber-400')}>
            Rewrite the step so the AI tries a different approach:
          </p>
          <div className="flex gap-1.5">
            <Input
              value={rephraseInput}
              onChange={(e) => setRephraseInput(e.target.value)}
              placeholder="Click the age range button showing 18-35"
              className={cn(
                "h-8 text-xs flex-1",
                theme === 'light' ? "bg-white border-amber-200" : "bg-gray-900 border-amber-500/30"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rephraseInput.trim()) onRephrase(rephraseInput.trim());
              }}
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!rephraseInput.trim() || isSubmitting}
              onClick={() => onRephrase(rephraseInput.trim())}
            >
              {isSubmitting ? <Search className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setMode(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
