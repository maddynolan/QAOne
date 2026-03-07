/**
 * StepCard Component
 *
 * Renders a single test step in the step list with drag-drop support,
 * execution status, and context menu actions.
 * Extracted from UnifiedWorkflowEditor.tsx.
 */

import React from 'react';
import {
  ArrowUp, ArrowDown, Eye, EyeOff, Copy, Trash2,
  MoreHorizontal, GripVertical, Crosshair, Video,
  ChevronRight, Wand2, CheckCircle, Zap, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { TestStep } from '../types/workflow-editor.types';
import { getStepInfo } from '../constants/step-categories';
import { getStepDescription } from '../lib/step-helpers';

interface StepCardProps {
  step: TestStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TestStep>) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isFirst: boolean;
  isLast: boolean;
  executionStatus?: string;
}

// Helper to mask sensitive values in step names/descriptions
function maskSensitiveStepName(name: string, step: TestStep): string {
  if (!name) return name;
  
  // Detect if this is a password/sensitive field
  const isSensitive = step.isSensitive || 
                     step.inputType === 'password' ||
                     /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.name || '') ||
                     /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.target || '');
  
  if (!isSensitive) return name;
  
  // Replace any quoted value with masked dots
  // Matches: "value", 'value', "ā口¢ā口¢...", etc.
  return name.replace(/["'][^"']+["']/g, (match) => {
    // Keep the first quote and replace content with mask
    const quote = match[0];
    return `${quote}••••••••${quote}`;
  });
}

// Helper to detect and fix corrupted/garbled characters
function hasCorruptedChars(str: string): boolean {
  if (!str) return false;
  // Detect UTF-8 encoding issues - these characters indicate corruption
  return /[āã口¢Γ]/.test(str) || /^[•●○◦]{4,}$/.test(str);
}

function StepCard({
  step,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isFirst,
  isLast,
  executionStatus,
  onRecordStep,
}: StepCardProps & { onRecordStep?: (stepId: string, stepIndex: number) => void }) {
  const info = getStepInfo(step.type);
  
  // Get human-readable description (NO selectors shown)
  let description = getStepDescription(step);
  
  // Extra security: if this is a password field, force mask the description
  const isPasswordStep = step.isSensitive || 
                         step.inputType === 'password' ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.name || '') ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.target || '') ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.selector || '') ||
                         /[āã口¢Γ]/.test(step.value || ''); // Detect garbled chars
  
  if (isPasswordStep && description) {
    // Force mask any password-related description
    description = '🔒 Type "••••••••"';
  }
  
  // Mask sensitive values in step name
  const displayName = maskSensitiveStepName(step.name, step);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`group relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-primary bg-primary/5 border-primary/50'
          : isDragging
          ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500/50 opacity-90'
          : executionStatus === 'passed'
          ? 'bg-success/5 border-success/30'
          : executionStatus === 'failed'
          ? 'bg-destructive/5 border-destructive/30'
          : 'bg-card border-border hover:border-primary/40 hover:bg-primary/5'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing flex items-center">
        <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      </div>
      
      {/* Step Number & Icon */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${info.color}`}>
          {index + 1}
        </div>
        {!isLast && <div className="w-0.5 h-4 bg-border mt-1" />}
      </div>

      {/* Content - NO CODE/SELECTOR shown */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <info.icon className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground text-base">{displayName}</span>
          {!step.enabled && (
            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">Disabled</Badge>
          )}
          {step.fallback && (
            <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30">
              <Wand2 className="h-3 w-3 mr-1" />
              Fallback
            </Badge>
          )}
          {/* Show assertion badge for both legacy single assertion and new multi-assertions */}
          {(step.assertion?.enabled || (step.assertions && step.assertions.length > 0 && step.assertions.some(a => a.enabled))) && (
            <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              {step.assertions && step.assertions.filter(a => a.enabled).length > 1
                ? `${step.assertions.filter(a => a.enabled).length} Checks`
                : 'Assert'}
            </Badge>
          )}
          {/* Show automation status */}
          {((step as any).qword && (step as any).args?.length > 0) && (
            <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
              <Zap className="h-3 w-3 mr-1" />
              Script
            </Badge>
          )}
          {/* Manual step indicator */}
          {step.type === 'manual_step' && !((step as any).qword && (step as any).args?.length > 0) && (
            <Badge variant="outline" className="text-xs bg-slate-500/20 text-slate-400 border-slate-500/30">
              <ClipboardList className="h-3 w-3 mr-1" />
              Manual
            </Badge>
          )}
        </div>
        {/* Show human-readable description, not selector */}
        {description && (
          <div className="text-sm text-muted-foreground font-medium mt-2">
            {description}
          </div>
        )}
        {step.expectedResult && (
          <div className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {step.expectedResult.slice(0, 60)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Trace This Step button - shown for manual/automatable steps without existing automation */}
        {onRecordStep && !((step as any).qword && (step as any).args?.length > 0) &&
         ['click', 'input', 'select', 'hover', 'navigate', 'manual_step'].includes(step.type) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
            onClick={(e) => { e.stopPropagation(); onRecordStep(step.id, index); }}
            title="Trace automation for this step"
          >
            <Video className="h-3 w-3 mr-1" />
            Trace
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={isFirst}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={isLast}>
          <ArrowDown className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-popover border-border">
            {/* Trace This Step option in menu */}
            {onRecordStep && !((step as any).qword && (step as any).args?.length > 0) && (
              <>
                <DropdownMenuItem
                  onClick={() => onRecordStep(step.id, index)}
                  className="text-purple-400 hover:bg-purple-500/10 focus:bg-purple-500/10 cursor-pointer"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Trace This Step
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
              </>
            )}
            <DropdownMenuItem 
              onClick={onDuplicate}
              className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer"
            >
              <Copy className="h-4 w-4 mr-2 text-primary" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onUpdate({ enabled: !step.enabled })}
              className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer"
            >
              {step.enabled ? (
                <><EyeOff className="h-4 w-4 mr-2 text-warning" />Disable</>
              ) : (
                <><Eye className="h-4 w-4 mr-2 text-success" />Enable</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={onDelete} 
              className="text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default StepCard;
