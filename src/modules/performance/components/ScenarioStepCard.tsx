/**
 * ScenarioStepCard — Individual step card for the performance scenario builder.
 *
 * Renders a collapsible card for each step in the scenario. Shows a compact
 * summary when collapsed, and full editing controls when expanded.
 *
 * Step types: http_request, think_time, loop, condition.
 */
import React, { useState, useCallback } from 'react';
import {
  Globe,
  Clock,
  Repeat,
  GitBranch,
  GripVertical,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ExtractorEditor from './ExtractorEditor';
import ChecksEditor from './ChecksEditor';
import type { ScenarioStep, ScenarioStepHeader } from './ScenarioBuilder';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScenarioStepCardProps {
  step: ScenarioStep;
  index: number;
  onUpdate: (stepId: string, updates: Partial<ScenarioStep>) => void;
  onDelete: (stepId: string) => void;
  onDuplicate: (step: ScenarioStep) => void;
  onToggle: (stepId: string) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  HEAD: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  OPTIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const BODY_TYPES = [
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form Data' },
  { value: 'raw', label: 'Raw' },
  { value: 'xml', label: 'XML' },
] as const;

const TYPE_ICONS: Record<string, React.ElementType> = {
  http_request: Globe,
  think_time: Clock,
  loop: Repeat,
  condition: GitBranch,
};

const TYPE_LABELS: Record<string, string> = {
  http_request: 'HTTP Request',
  think_time: 'Think Time',
  loop: 'Loop',
  condition: 'Condition',
};

// ─── Component ───────────────────────────────────────────────────────────────

const ScenarioStepCard: React.FC<ScenarioStepCardProps> = ({
  step,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const StepIcon = TYPE_ICONS[step.type] || Globe;
  const showBody = step.type === 'http_request' &&
    ['POST', 'PUT', 'PATCH'].includes(step.method || '');

  // ── Header handlers ────────────────────────────────────────────────────

  const handleNameChange = useCallback(
    (value: string) => {
      onUpdate(step.id, { name: value });
    },
    [step.id, onUpdate],
  );

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
  }, []);

  // ── HTTP request handlers ──────────────────────────────────────────────

  const handleMethodChange = useCallback(
    (method: string) => {
      onUpdate(step.id, { method });
    },
    [step.id, onUpdate],
  );

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(step.id, { url: e.target.value });
    },
    [step.id, onUpdate],
  );

  // ── Headers ────────────────────────────────────────────────────────────

  const addHeader = useCallback(() => {
    const headers = [...(step.headers || []), { key: '', value: '', enabled: true }];
    onUpdate(step.id, { headers });
  }, [step.id, step.headers, onUpdate]);

  const updateHeader = useCallback(
    (idx: number, field: keyof ScenarioStepHeader, value: string | boolean) => {
      const headers = [...(step.headers || [])];
      headers[idx] = { ...headers[idx], [field]: value };
      onUpdate(step.id, { headers });
    },
    [step.id, step.headers, onUpdate],
  );

  const removeHeader = useCallback(
    (idx: number) => {
      const headers = (step.headers || []).filter((_, i) => i !== idx);
      onUpdate(step.id, { headers });
    },
    [step.id, step.headers, onUpdate],
  );

  // ── Think time handlers ────────────────────────────────────────────────

  const handleMinDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(60000, Math.max(0, parseInt(e.target.value, 10) || 0));
      const currentMax = step.maxDelay ?? 3000;
      // Auto-clamp: if minDelay exceeds maxDelay, bring maxDelay up
      if (val > currentMax) {
        onUpdate(step.id, { minDelay: val, maxDelay: val });
      } else {
        onUpdate(step.id, { minDelay: val });
      }
    },
    [step.id, step.maxDelay, onUpdate],
  );

  const handleMaxDelayChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(60000, Math.max(0, parseInt(e.target.value, 10) || 0));
      const currentMin = step.minDelay ?? 1000;
      // Auto-clamp: if maxDelay drops below minDelay, bring minDelay down
      if (val < currentMin) {
        onUpdate(step.id, { maxDelay: val, minDelay: val });
      } else {
        onUpdate(step.id, { maxDelay: val });
      }
    },
    [step.id, step.minDelay, onUpdate],
  );

  // ── Loop handlers ──────────────────────────────────────────────────────

  const handleIterationsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(step.id, { iterations: parseInt(e.target.value, 10) || 1 });
    },
    [step.id, onUpdate],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Card
      className={`transition-colors ${
        !step.enabled ? 'opacity-50' : ''
      } ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}
    >
      {/* Collapsed header — always visible */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Drag handle */}
        <div
          className="text-muted-foreground hover:text-foreground cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Step number */}
        <Badge variant="outline" className="text-xs min-w-[28px] justify-center">
          {index + 1}
        </Badge>

        {/* Type icon */}
        <StepIcon className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Method badge (HTTP only) */}
        {step.type === 'http_request' && step.method && (
          <Badge
            className={`text-xs font-mono ${METHOD_COLORS[step.method] || METHOD_COLORS.GET}`}
            variant="secondary"
          >
            {step.method}
          </Badge>
        )}

        {/* Step name / URL preview */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <Input
              value={step.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
              }}
              className="h-6 text-sm"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-sm truncate block"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              title={
                step.type === 'http_request'
                  ? `${step.name} — ${step.url}`
                  : step.name
              }
            >
              <span className="font-medium">{step.name}</span>
              {step.type === 'http_request' && step.url && (
                <span className="text-muted-foreground ml-2 text-xs font-mono">
                  {step.url}
                </span>
              )}
              {step.type === 'think_time' && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {step.minDelay}ms - {step.maxDelay}ms
                </span>
              )}
              {step.type === 'loop' && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {step.iterations}x
                </span>
              )}
            </span>
          )}
        </div>

        {/* Extractor/check badges */}
        {step.type === 'http_request' && (
          <div className="flex items-center gap-1">
            {(step.extractors?.length || 0) > 0 && (
              <Badge variant="outline" className="text-xs">
                {step.extractors!.length} extractor{step.extractors!.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {(step.checks?.length || 0) > 0 && (
              <Badge variant="outline" className="text-xs">
                {step.checks!.length} check{step.checks!.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={step.enabled}
            onCheckedChange={() => onToggle(step.id)}
            className="scale-75"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onDuplicate(step)}
            title="Duplicate step"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(step.id)}
            title="Delete step"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Expand chevron */}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <Separator className="mb-4" />

          {/* HTTP Request expanded view */}
          {step.type === 'http_request' && (
            <div className="space-y-4">
              {/* URL row */}
              <div className="flex items-center gap-2">
                <Select value={step.method || 'GET'} onValueChange={handleMethodChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={step.url || ''}
                  onChange={handleUrlChange}
                  placeholder="https://api.example.com/endpoint"
                  className="flex-1 font-mono text-sm"
                />
              </div>

              {/* Headers section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Headers</Label>
                  <Button size="sm" variant="ghost" onClick={addHeader}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Header
                  </Button>
                </div>
                {(step.headers || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(step.headers || []).map((header, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Switch
                          checked={header.enabled}
                          onCheckedChange={(v) => updateHeader(idx, 'enabled', v)}
                          className="scale-75"
                        />
                        <Input
                          value={header.key}
                          onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                          placeholder="Header name"
                          className="flex-1 h-8 text-sm"
                        />
                        <Input
                          value={header.value}
                          onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeHeader(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No headers. Click &quot;Add Header&quot; to include request headers.
                  </p>
                )}
              </div>

              {/* Body section (POST/PUT/PATCH only) */}
              {showBody && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Body</Label>
                    <Select
                      value={step.bodyType || 'json'}
                      onValueChange={(v) => onUpdate(step.id, { bodyType: v })}
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BODY_TYPES.map((bt) => (
                          <SelectItem key={bt.value} value={bt.value}>
                            {bt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={step.body || ''}
                    onChange={(e) => onUpdate(step.id, { body: e.target.value })}
                    placeholder={
                      step.bodyType === 'json'
                        ? '{\n  "key": "value"\n}'
                        : 'Request body...'
                    }
                    className="font-mono text-sm min-h-[100px]"
                  />
                </div>
              )}

              {/* Extractors section */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Extractors (Correlation)
                </Label>
                <ExtractorEditor
                  extractors={step.extractors || []}
                  onExtractorsChange={(extractors) =>
                    onUpdate(step.id, { extractors })
                  }
                />
              </div>

              {/* Checks section */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Checks (Assertions)
                </Label>
                <ChecksEditor
                  checks={step.checks || []}
                  onChecksChange={(checks) => onUpdate(step.id, { checks })}
                />
              </div>
            </div>
          )}

          {/* Think Time expanded view */}
          {step.type === 'think_time' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Min Delay (ms)</Label>
                  <Input
                    type="number"
                    value={step.minDelay ?? 1000}
                    onChange={handleMinDelayChange}
                    min={0}
                    max={60000}
                    step={100}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Max Delay (ms)</Label>
                  <Input
                    type="number"
                    value={step.maxDelay ?? 3000}
                    onChange={handleMaxDelayChange}
                    min={0}
                    max={60000}
                    step={100}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Simulates user think time with a random delay between{' '}
                <span className="font-medium text-foreground">
                  {step.minDelay ?? 1000}ms
                </span>{' '}
                and{' '}
                <span className="font-medium text-foreground">
                  {step.maxDelay ?? 3000}ms
                </span>
                .
              </p>
            </div>
          )}

          {/* Loop expanded view */}
          {step.type === 'loop' && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Iterations</Label>
                <Input
                  type="number"
                  value={step.iterations ?? 5}
                  onChange={handleIterationsChange}
                  min={1}
                  max={10000}
                  className="mt-1 w-32"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Repeat the enclosed steps{' '}
                <span className="font-medium text-foreground">
                  {step.iterations ?? 5}
                </span>{' '}
                time{(step.iterations ?? 5) !== 1 ? 's' : ''}.
              </p>
            </div>
          )}

          {/* Condition expanded view */}
          {step.type === 'condition' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conditional branching based on variable values or response data.
                Configure the condition expression and child steps.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ScenarioStepCard;
