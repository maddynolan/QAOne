/**
 * ScenarioBuilder — Visual no-code scenario builder for performance testing.
 *
 * Allows users to build HTTP request sequences, think times, and loops
 * without writing code. Supports import from HAR files and recordings.
 *
 * Used by Performance.tsx in the scenario configuration tab.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Upload,
  FileCode,
  Play,
  Trash2,
  GripVertical,
  FileInput,
  Clock,
  Repeat,
  Globe,
  ArrowDown,
  ArrowUp,
  Code2,
  X,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import ScenarioStepCard from './ScenarioStepCard';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScenarioStepExtractor {
  id: string;
  type: string;
  variableName: string;
  pattern: string;
  scope: string;
}

export interface ScenarioStepCheck {
  id: string;
  type: string;
  operator: string;
  expectedValue: string;
}

export interface ScenarioStepHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface ScenarioStep {
  id: string;
  type: 'http_request' | 'think_time' | 'loop' | 'condition';
  name: string;
  enabled: boolean;
  method?: string;
  url?: string;
  headers?: ScenarioStepHeader[];
  body?: string;
  bodyType?: string;
  extractors?: ScenarioStepExtractor[];
  checks?: ScenarioStepCheck[];
  minDelay?: number;
  maxDelay?: number;
  iterations?: number;
  children?: ScenarioStep[];
}

interface ScenarioBuilderProps {
  steps: ScenarioStep[];
  onStepsChange: (steps: ScenarioStep[]) => void;
  targetUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createHttpRequestStep(targetUrl: string): ScenarioStep {
  return {
    id: generateStepId(),
    type: 'http_request',
    name: 'HTTP Request',
    enabled: true,
    method: 'GET',
    url: targetUrl || 'https://example.com',
    headers: [
      { key: 'Content-Type', value: 'application/json', enabled: true },
    ],
    body: '',
    bodyType: 'json',
    extractors: [],
    checks: [],
  };
}

function createThinkTimeStep(): ScenarioStep {
  return {
    id: generateStepId(),
    type: 'think_time',
    name: 'Think Time',
    enabled: true,
    minDelay: 1000,
    maxDelay: 3000,
  };
}

function createLoopStep(): ScenarioStep {
  return {
    id: generateStepId(),
    type: 'loop',
    name: 'Loop',
    enabled: true,
    iterations: 5,
    children: [],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({
  steps,
  onStepsChange,
  targetUrl,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // ── Step counts ──────────────────────────────────────────────────────────

  const stepCounts = useMemo(() => {
    const counts = { total: steps.length, enabled: 0, http: 0, thinkTime: 0, loop: 0 };
    for (const step of steps) {
      if (step.enabled) counts.enabled++;
      if (step.type === 'http_request') counts.http++;
      if (step.type === 'think_time') counts.thinkTime++;
      if (step.type === 'loop') counts.loop++;
    }
    return counts;
  }, [steps]);

  // ── Add steps ────────────────────────────────────────────────────────────

  const addHttpRequest = useCallback(() => {
    const newStep = createHttpRequestStep(targetUrl);
    onStepsChange([...steps, newStep]);
  }, [steps, onStepsChange, targetUrl]);

  const addThinkTime = useCallback(() => {
    const newStep = createThinkTimeStep();
    onStepsChange([...steps, newStep]);
  }, [steps, onStepsChange]);

  const addLoop = useCallback(() => {
    const newStep = createLoopStep();
    onStepsChange([...steps, newStep]);
  }, [steps, onStepsChange]);

  // ── Step manipulation ────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (stepId: string) => {
      onStepsChange(steps.filter((s) => s.id !== stepId));
    },
    [steps, onStepsChange],
  );

  const handleDuplicate = useCallback(
    (step: ScenarioStep) => {
      const duplicated: ScenarioStep = {
        ...JSON.parse(JSON.stringify(step)),
        id: generateStepId(),
        name: `${step.name} (copy)`,
      };
      const idx = steps.findIndex((s) => s.id === step.id);
      const next = [...steps];
      next.splice(idx + 1, 0, duplicated);
      onStepsChange(next);
    },
    [steps, onStepsChange],
  );

  const handleUpdate = useCallback(
    (stepId: string, updates: Partial<ScenarioStep>) => {
      onStepsChange(
        steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
      );
    },
    [steps, onStepsChange],
  );

  const handleToggle = useCallback(
    (stepId: string) => {
      onStepsChange(
        steps.map((s) =>
          s.id === stepId ? { ...s, enabled: !s.enabled } : s,
        ),
      );
    },
    [steps, onStepsChange],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= steps.length ||
        toIndex >= steps.length
      ) {
        return;
      }
      const next = [...steps];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onStepsChange(next);
    },
    [steps, onStepsChange],
  );

  const handleClearAll = useCallback(() => {
    onStepsChange([]);
  }, [onStepsChange]);

  // ── Compile scenario preview ─────────────────────────────────────────────

  const compiledScenario = useMemo(() => {
    const enabledSteps = steps.filter((s) => s.enabled);
    return {
      version: '1.0',
      name: 'Performance Scenario',
      totalSteps: enabledSteps.length,
      steps: enabledSteps.map((step, idx) => {
        const base: Record<string, unknown> = {
          order: idx + 1,
          type: step.type,
          name: step.name,
        };
        if (step.type === 'http_request') {
          base.method = step.method;
          base.url = step.url;
          base.headers = (step.headers || [])
            .filter((h) => h.enabled && h.key)
            .reduce(
              (acc, h) => {
                acc[h.key] = h.value;
                return acc;
              },
              {} as Record<string, string>,
            );
          if (step.body && ['POST', 'PUT', 'PATCH'].includes(step.method || '')) {
            base.body = step.body;
            base.bodyType = step.bodyType;
          }
          if (step.extractors && step.extractors.length > 0) {
            base.extractors = step.extractors;
          }
          if (step.checks && step.checks.length > 0) {
            base.checks = step.checks;
          }
        } else if (step.type === 'think_time') {
          base.minDelay = step.minDelay;
          base.maxDelay = step.maxDelay;
        } else if (step.type === 'loop') {
          base.iterations = step.iterations;
          base.children = step.children;
        }
        return base;
      }),
    };
  }, [steps]);

  // ── Filtered steps ───────────────────────────────────────────────────────

  const filteredSteps = useMemo(() => {
    if (!searchFilter.trim()) return steps;
    const lower = searchFilter.toLowerCase();
    return steps.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.type.toLowerCase().includes(lower) ||
        (s.url && s.url.toLowerCase().includes(lower)) ||
        (s.method && s.method.toLowerCase().includes(lower)),
    );
  }, [steps, searchFilter]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Scenario Builder
              </CardTitle>
              <CardDescription className="mt-1">
                Build your load test scenario step by step — no code required
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {stepCounts.total > 0 && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {stepCounts.total} step{stepCounts.total !== 1 ? 's' : ''}
                  </Badge>
                  {stepCounts.http > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800"
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      {stepCounts.http}
                    </Badge>
                  )}
                  {stepCounts.thinkTime > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {stepCounts.thinkTime}
                    </Badge>
                  )}
                  {stepCounts.loop > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs text-purple-600 border-purple-200 dark:text-purple-400 dark:border-purple-800"
                    >
                      <Repeat className="h-3 w-3 mr-1" />
                      {stepCounts.loop}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary actions */}
            <Button size="sm" onClick={addHttpRequest}>
              <Plus className="h-4 w-4 mr-1" />
              Add HTTP Request
            </Button>
            <Button size="sm" variant="outline" onClick={addThinkTime}>
              <Clock className="h-4 w-4 mr-1" />
              Add Think Time
            </Button>
            <Button size="sm" variant="outline" onClick={addLoop}>
              <Repeat className="h-4 w-4 mr-1" />
              Add Loop
            </Button>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Import actions */}
            <Button size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-1" />
              Import from HAR
            </Button>
            <Button size="sm" variant="outline">
              <FileInput className="h-4 w-4 mr-1" />
              Import from Recording
            </Button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search filter */}
            {steps.length > 3 && (
              <Input
                placeholder="Filter steps..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            )}

            {/* Clear all */}
            {steps.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleClearAll}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step list */}
      {filteredSteps.length > 0 ? (
        <div className="space-y-2">
          {filteredSteps.map((step, index) => {
            const originalIndex = steps.findIndex((s) => s.id === step.id);
            return (
              <ScenarioStepCard
                key={step.id}
                step={step}
                index={originalIndex}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onToggle={handleToggle}
              />
            );
          })}

          {/* Reorder controls */}
          {steps.length > 1 && !searchFilter && (
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <GripVertical className="h-3 w-3" />
              <span>
                Drag steps to reorder, or use the step cards to move up/down
              </span>
            </div>
          )}
        </div>
      ) : steps.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileCode className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No steps yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Start building your load test scenario by adding HTTP requests,
              think times, and loops. You can also import steps from a HAR file
              or an existing recording session.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={addHttpRequest}>
                <Plus className="h-4 w-4 mr-1" />
                Add HTTP Request
              </Button>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-1" />
                Import from HAR
              </Button>
              <Button variant="outline">
                <FileInput className="h-4 w-4 mr-1" />
                Import from Recording
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Filtered empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No steps match &quot;{searchFilter}&quot;
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setSearchFilter('')}
            >
              Clear filter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bottom actions */}
      {steps.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {stepCounts.enabled}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-foreground">
                    {stepCounts.total}
                  </span>{' '}
                  steps enabled
                </div>
                {stepCounts.enabled < stepCounts.total && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {stepCounts.total - stepCounts.enabled} disabled
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Code2 className="h-4 w-4 mr-1" />
                  {showPreview ? 'Hide' : 'Show'} JSON Preview
                </Button>
              </div>
            </div>

            {/* JSON preview */}
            {showPreview && (
              <div className="mt-4">
                <Separator className="mb-4" />
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Compiled Scenario</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        JSON.stringify(compiledScenario, null, 2),
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy JSON
                  </Button>
                </div>
                <div className="rounded-md bg-muted/50 border p-4 max-h-80 overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(compiledScenario, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick add footer */}
      {steps.length > 0 && (
        <div className="flex items-center justify-center gap-2 pb-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={addHttpRequest}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            HTTP Request
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={addThinkTime}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Think Time
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={addLoop}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Loop
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScenarioBuilder;
