import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ListChecks,
} from 'lucide-react';

export interface Threshold {
  id: string;
  metric: string;
  operator: string;
  value: number;
  critical: boolean;
}

export interface ThresholdResult {
  metric: string;
  passed: boolean;
  actual: number;
  threshold: Threshold;
}

export interface ThresholdManagerProps {
  thresholds: Threshold[];
  onThresholdsChange: (thresholds: Threshold[]) => void;
  results?: ThresholdResult[];
}

const METRIC_OPTIONS = [
  { value: 'p50', label: 'P50 Response Time (ms)' },
  { value: 'p90', label: 'P90 Response Time (ms)' },
  { value: 'p95', label: 'P95 Response Time (ms)' },
  { value: 'p99', label: 'P99 Response Time (ms)' },
  { value: 'avg_response', label: 'Avg Response Time (ms)' },
  { value: 'error_rate', label: 'Error Rate (%)' },
  { value: 'rps', label: 'Requests/sec' },
];

const OPERATOR_OPTIONS = [
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '==', label: '==' },
];

const DEFAULT_THRESHOLDS: Omit<Threshold, 'id'>[] = [
  { metric: 'p95', operator: '<', value: 800, critical: false },
  { metric: 'p99', operator: '<', value: 2000, critical: false },
  { metric: 'error_rate', operator: '<', value: 1, critical: true },
  { metric: 'rps', operator: '>', value: 10, critical: false },
];

function generateId(): string {
  return `thr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getMetricLabel(metric: string): string {
  return METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric;
}

export default function ThresholdManager({
  thresholds,
  onThresholdsChange,
  results,
}: ThresholdManagerProps) {
  const addThreshold = () => {
    onThresholdsChange([
      ...thresholds,
      {
        id: generateId(),
        metric: 'p95',
        operator: '<',
        value: 500,
        critical: false,
      },
    ]);
  };

  const loadDefaults = () => {
    onThresholdsChange(
      DEFAULT_THRESHOLDS.map((t) => ({ ...t, id: generateId() }))
    );
  };

  const updateThreshold = (
    id: string,
    field: keyof Threshold,
    value: string | number | boolean
  ) => {
    onThresholdsChange(
      thresholds.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const deleteThreshold = (id: string) => {
    onThresholdsChange(thresholds.filter((t) => t.id !== id));
  };

  const getResultForThreshold = (threshold: Threshold) => {
    return results?.find(
      (r) =>
        r.threshold.metric === threshold.metric &&
        r.threshold.operator === threshold.operator &&
        r.threshold.value === threshold.value
    );
  };

  const passedCount = results?.filter((r) => r.passed).length ?? 0;
  const totalCount = results?.length ?? 0;
  const allPassed = results ? passedCount === totalCount : false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">SLA Thresholds</h3>
          <Badge variant="secondary" className="text-xs">
            {thresholds.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={loadDefaults}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Load Defaults
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={addThreshold}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Threshold
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      {results && results.length > 0 && (
        <Card
          className={allPassed ? 'border-green-500/50' : 'border-red-500/50'}
        >
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {allPassed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {passedCount}/{totalCount} thresholds passed
              </span>
            </div>
            <Badge
              variant={allPassed ? 'default' : 'destructive'}
              className="text-xs"
            >
              {allPassed ? 'PASS' : 'FAIL'}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {thresholds.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No thresholds defined. Add SLA thresholds to automatically
              validate test results.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Threshold Rows */}
      {thresholds.length > 0 && (
        <div className="space-y-2">
          {thresholds.map((threshold) => {
            const result = getResultForThreshold(threshold);
            return (
              <Card key={threshold.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Metric */}
                    <Select
                      value={threshold.metric}
                      onValueChange={(v) =>
                        updateThreshold(threshold.id, 'metric', v)
                      }
                    >
                      <SelectTrigger className="h-8 w-[200px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRIC_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-xs"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operator */}
                    <Select
                      value={threshold.operator}
                      onValueChange={(v) =>
                        updateThreshold(threshold.id, 'operator', v)
                      }
                    >
                      <SelectTrigger className="h-8 w-[70px] text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATOR_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-xs font-mono"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value */}
                    <Input
                      type="number"
                      min={0}
                      max={1000000}
                      step={threshold.metric === 'error_rate' ? 0.1 : 1}
                      value={threshold.value}
                      onChange={(e) =>
                        updateThreshold(
                          threshold.id,
                          'value',
                          Math.min(1000000, parseFloat(e.target.value) || 0)
                        )
                      }
                      className="h-8 w-[100px] text-xs"
                    />

                    {/* Critical Toggle */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <Switch
                        id={`critical-${threshold.id}`}
                        checked={threshold.critical}
                        onCheckedChange={(v) =>
                          updateThreshold(threshold.id, 'critical', v)
                        }
                        className="scale-75"
                      />
                      <Label
                        htmlFor={`critical-${threshold.id}`}
                        className="text-xs cursor-pointer"
                      >
                        Critical
                      </Label>
                      {threshold.critical && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1">
                          Critical
                        </Badge>
                      )}
                    </div>

                    {/* Result indicator + Delete (grouped right) */}
                    <div className="flex items-center gap-2 ml-auto">
                      {result && (
                        <div className="flex items-center gap-1">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            actual: {result.actual.toFixed(1)}
                          </span>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteThreshold(threshold.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
