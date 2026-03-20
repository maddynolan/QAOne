import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import type { ExplorationDefect } from './types';

interface DefectCardProps {
  defect: ExplorationDefect;
  theme: string;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500',
  high: 'bg-orange-500/10 text-orange-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-blue-500/10 text-blue-500',
  minor: 'bg-blue-500/10 text-blue-500',
};

export function DefectCard({ defect, theme }: DefectCardProps) {
  const url = defect.page_url || defect.url;

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
    )}>
      <div className="flex items-start gap-2">
        <Badge className={cn("text-[10px] border-0 flex-shrink-0", severityColors[defect.severity] || severityColors.medium)}>
          {defect.severity}
        </Badge>
        <Badge className={cn("text-[10px] border-0 flex-shrink-0",
          theme === 'light' ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"
        )}>
          {defect.type}
        </Badge>
        {defect.wcag_criterion && (
          <Badge className="text-[10px] border-0 bg-purple-500/10 text-purple-500">
            {defect.wcag_criterion}
          </Badge>
        )}
      </div>

      <p className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-900' : 'text-white')}>
        {defect.title || defect.description}
      </p>

      {defect.title && defect.description !== defect.title && (
        <p className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
          {defect.description}
        </p>
      )}

      {url && (
        <div className="flex items-center gap-1">
          <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className={cn("text-[10px] truncate", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
            {url}
          </span>
        </div>
      )}

      {defect.screenshot && (
        <img
          src={`data:image/jpeg;base64,${defect.screenshot}`}
          alt="Defect screenshot"
          className="w-full max-h-32 object-cover rounded border border-gray-200 dark:border-gray-700 mt-1"
        />
      )}
    </div>
  );
}
