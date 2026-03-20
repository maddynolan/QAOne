import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Brain, Loader2 } from 'lucide-react';

interface ExecutionProgressProps {
  phase: string;
  step: string;
  progress: number;
  theme: string;
}

export function ExecutionProgress({ phase, step, progress, theme }: ExecutionProgressProps) {
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
    )}>
      <div className="flex items-center gap-2">
        {progress < 100 ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
        ) : (
          <Brain className="w-4 h-4 text-green-500" />
        )}
        <span className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-900' : 'text-white')}>
          {phase || 'Processing...'}
        </span>
      </div>
      {step && (
        <p className={cn("text-xs truncate", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
          {step}
        </p>
      )}
      <Progress value={progress} className="h-1.5" />
    </div>
  );
}
