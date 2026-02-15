/**
 * Confidence Badge Component
 * 
 * Displays HIGH/MEDIUM/LOW confidence with color coding and icon.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  score?: number;
  showScore?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const config = {
  HIGH: {
    icon: ShieldCheck,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
    label: 'High'
  },
  MEDIUM: {
    icon: ShieldAlert,
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30',
    label: 'Medium'
  },
  LOW: {
    icon: ShieldX,
    className: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
    label: 'Low'
  }
};

const sizeConfig = {
  sm: {
    badge: 'text-[10px] h-5 px-1.5',
    icon: 'h-3 w-3'
  },
  md: {
    badge: 'text-xs h-6 px-2',
    icon: 'h-3.5 w-3.5'
  },
  lg: {
    badge: 'text-sm h-7 px-2.5',
    icon: 'h-4 w-4'
  }
};

export function ConfidenceBadge({ 
  level, 
  score, 
  showScore = true,
  showIcon = true,
  size = 'sm',
  className
}: ConfidenceBadgeProps) {
  const { icon: Icon, className: colorClass, label } = config[level];
  const { badge: badgeSize, icon: iconSize } = sizeConfig[size];

  return (
    <Badge 
      variant="outline" 
      className={cn(colorClass, badgeSize, className)}
    >
      {showIcon && <Icon className={cn(iconSize, 'mr-1')} />}
      {showScore && score !== undefined ? `${score}%` : label}
    </Badge>
  );
}

export default ConfidenceBadge;
