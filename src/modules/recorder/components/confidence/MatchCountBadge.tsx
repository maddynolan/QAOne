/**
 * Match Count Badge Component
 * 
 * Shows "1/6 matches" with warning color when multiple matches exist.
 * This helps users understand when element selection may be ambiguous.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Target, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MatchCountBadgeProps {
  used: number;
  total: number;
  showWarning?: boolean;
  showIcon?: boolean;
  className?: string;
}

export function MatchCountBadge({ 
  used, 
  total, 
  showWarning = true,
  showIcon = true,
  className
}: MatchCountBadgeProps) {
  const hasMultiple = total > 1;
  const isHighRisk = total > 3;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[10px] h-5 px-1.5',
        hasMultiple && showWarning
          ? isHighRisk 
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          : 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        className
      )}
    >
      {showIcon && (
        hasMultiple && showWarning ? (
          <AlertTriangle className="h-3 w-3 mr-1" />
        ) : (
          <Target className="h-3 w-3 mr-1" />
        )
      )}
      {used}/{total}
    </Badge>
  );

  // Only show tooltip for multiple matches
  if (!hasMultiple) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="text-xs max-w-xs">
          <p>
            {total} elements matched this description. 
            Position #{used} was {hasMultiple ? 'selected' : 'used'}.
          </p>
          {isHighRisk && (
            <p className="mt-1 text-amber-400">
              Consider adding a data-testid for more reliable selection.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MatchCountBadge;
