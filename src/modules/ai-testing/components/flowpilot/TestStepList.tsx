import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Eye, Wand2 } from 'lucide-react';
import type { TestStep } from './types';

interface TestStepListProps {
  steps: TestStep[];
  theme: string;
  compact?: boolean;
}

export function TestStepList({ steps, theme, compact }: TestStepListProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-md px-2 py-1.5",
            step.success
              ? theme === 'light' ? 'bg-green-50/50' : 'bg-green-500/5'
              : step.error
                ? theme === 'light' ? 'bg-red-50/50' : 'bg-red-500/5'
                : theme === 'light' ? 'bg-gray-50' : 'bg-gray-800/50'
          )}
        >
          <div className="mt-0.5 flex-shrink-0">
            {step.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            ) : step.error ? (
              <XCircle className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn("text-xs", theme === 'light' ? 'text-gray-800' : 'text-gray-200')}>
              {step.description || `${step.action} ${step.target}`}
            </p>

            {!compact && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {step.method && (
                  <span className={cn("text-[10px]", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                    {step.method}{step.confidence ? ` (${step.confidence}%)` : ''}
                  </span>
                )}
                {step.healed && (
                  <Badge className="text-[9px] px-1 py-0 h-4 bg-purple-500/10 text-purple-500 border-0">
                    <Wand2 className="w-2.5 h-2.5 mr-0.5" />
                    {step.heal_method || 'Healed'}
                  </Badge>
                )}
                {step.error && (
                  <span className="text-[10px] text-red-400 truncate max-w-[200px]">{step.error}</span>
                )}
              </div>
            )}
          </div>

          {step.screenshot && (
            <button
              className={cn("flex-shrink-0 p-0.5 rounded hover:bg-gray-200/50 dark:hover:bg-gray-700/50")}
              title="View screenshot"
            >
              <Eye className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
