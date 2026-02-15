/**
 * TestCaseCard - Grid view card for displaying individual test cases
 *
 * Shows test case status, priority, automation status, tags, and
 * action buttons for running and editing.
 */

import React from 'react';
import {
  Play, Edit, CheckCircle, AlertCircle, Clock, Star, StarOff, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TestCase } from '../types/test-repository.types';

interface TestCaseCardProps {
  testCase: TestCase;
  onSelect: () => void;
  onRun: () => void;
  onEdit: () => void;
  onStar: () => void;
  isSelected: boolean;
}

export function TestCaseCard({
  testCase,
  onSelect,
  onRun,
  onEdit,
  onStar,
  isSelected
}: TestCaseCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "bg-card border-border cursor-pointer transition-all hover:border-primary/50 group",
        isSelected && "border-primary ring-1 ring-primary/30"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {testCase.lastResult === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {testCase.lastResult === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
            {!testCase.lastResult && <Clock className="w-4 h-4 text-muted-foreground" />}
            <h3 className="font-medium text-foreground truncate">{testCase.name}</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStar();
            }}
            className="p-1 hover:bg-accent rounded"
          >
            {testCase.starred ? (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            ) : (
              <StarOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {testCase.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{testCase.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {testCase.automationStatus === 'full' && (
              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">Auto</Badge>
            )}
            {testCase.automationStatus === 'partial' && (
              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">Partial</Badge>
            )}
            {(!testCase.automationStatus || testCase.automationStatus === 'none') && (
              <Badge className="bg-secondary text-muted-foreground border-border text-xs">Manual</Badge>
            )}
            {testCase.priority && (
              <Badge
                className={cn(
                  "text-xs",
                  testCase.priority === 'critical' && "bg-red-500/10 text-red-600 dark:text-red-400",
                  testCase.priority === 'high' && "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                  testCase.priority === 'medium' && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                  testCase.priority === 'low' && "bg-secondary text-muted-foreground"
                )}
              >
                {testCase.priority}
              </Badge>
            )}
            {/* Test Type Tags */}
            {testCase.tags?.includes('load') && (
              <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]">Load</Badge>
            )}
            {testCase.tags?.includes('api') && (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">API</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 dark:text-green-400 hover:text-green-700 hover:bg-green-500/10"
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tags */}
        {testCase.tags && testCase.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {testCase.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 bg-secondary text-muted-foreground rounded">
                {tag}
              </span>
            ))}
            {testCase.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{testCase.tags.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
