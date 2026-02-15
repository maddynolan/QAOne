/**
 * Step Confidence Indicator Component
 * 
 * Compact indicator combining confidence badge and match count for step display.
 * Used inline with recorded steps in the recorder UI.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge, ConfidenceLevel } from './ConfidenceBadge';
import { MatchCountBadge } from './MatchCountBadge';

interface StepConfidenceIndicatorProps {
  confidence?: {
    score: number;
    level: ConfidenceLevel;
  };
  matchAnalysis?: {
    totalMatches: number;
    usedPosition: number;
  };
  showBadges?: boolean;
  className?: string;
}

export function StepConfidenceIndicator({
  confidence,
  matchAnalysis,
  showBadges = true,
  className
}: StepConfidenceIndicatorProps) {
  if (!showBadges) return null;

  const hasConfidence = confidence && confidence.level;
  const hasMultipleMatches = matchAnalysis && matchAnalysis.totalMatches > 1;
  
  // Don't show anything if high confidence and single match
  if (hasConfidence && confidence.level === 'HIGH' && !hasMultipleMatches) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Show match count when there are multiple matches */}
      {matchAnalysis && matchAnalysis.totalMatches > 0 && (
        <MatchCountBadge
          used={matchAnalysis.usedPosition}
          total={matchAnalysis.totalMatches}
          showIcon={false}
        />
      )}
      
      {/* Show confidence badge when not HIGH */}
      {hasConfidence && confidence.level !== 'HIGH' && (
        <ConfidenceBadge
          level={confidence.level}
          score={confidence.score}
          showIcon={false}
          size="sm"
        />
      )}
    </div>
  );
}

export default StepConfidenceIndicator;
