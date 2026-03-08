/**
 * ChecksEditor — k6-style checks/assertions editor for load test requests.
 *
 * Allows users to define assertions that are evaluated against every HTTP
 * response during a load test. Failed checks are tracked as errors in the
 * performance metrics.
 *
 * Supported check types: Status Code, Body Contains, Body Not Contains,
 * Body Regex, JSON Path, Header Value, Response Time.
 */
import React, { useCallback } from 'react';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Check {
  id: string;
  type: string;
  operator: string;
  expectedValue: string;
}

interface ChecksEditorProps {
  checks: Check[];
  onChecksChange: (checks: Check[]) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHECK_TYPES = [
  { value: 'status_code', label: 'Status Code' },
  { value: 'body_contains', label: 'Body Contains' },
  { value: 'body_not_contains', label: 'Body Not Contains' },
  { value: 'body_regex', label: 'Body Regex' },
  { value: 'json_path', label: 'JSON Path' },
  { value: 'header_value', label: 'Header Value' },
  { value: 'response_time', label: 'Response Time (ms)' },
] as const;

const CHECK_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'less_than', label: 'less than' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'matches', label: 'matches (regex)' },
] as const;

const VALUE_PLACEHOLDERS: Record<string, string> = {
  status_code: '200',
  body_contains: 'success',
  body_not_contains: 'error',
  body_regex: '"id":\\s*\\d+',
  json_path: '$.status == "ok"',
  header_value: 'application/json',
  response_time: '500',
};

// ─── Component ───────────────────────────────────────────────────────────────

const ChecksEditor: React.FC<ChecksEditorProps> = ({
  checks,
  onChecksChange,
}) => {
  const addCheck = useCallback(() => {
    const newCheck: Check = {
      id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'status_code',
      operator: 'equals',
      expectedValue: '200',
    };
    onChecksChange([...checks, newCheck]);
  }, [checks, onChecksChange]);

  const updateCheck = useCallback(
    (id: string, field: keyof Check, value: string) => {
      onChecksChange(
        checks.map((chk) =>
          chk.id === id ? { ...chk, [field]: value } : chk,
        ),
      );
    },
    [checks, onChecksChange],
  );

  const removeCheck = useCallback(
    (id: string) => {
      onChecksChange(checks.filter((chk) => chk.id !== id));
    },
    [checks, onChecksChange],
  );

  if (checks.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          No checks. Add assertions to validate responses during load testing.
        </p>
        <Button size="sm" variant="outline" onClick={addCheck}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Check
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <div
          key={check.id}
          className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5"
        >
          <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Type */}
          <Select
            value={check.type}
            onValueChange={(v) => updateCheck(check.id, 'type', v)}
          >
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Check type" />
            </SelectTrigger>
            <SelectContent>
              {CHECK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select
            value={check.operator}
            onValueChange={(v) => updateCheck(check.id, 'operator', v)}
          >
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder="Operator" />
            </SelectTrigger>
            <SelectContent>
              {CHECK_OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expected value */}
          <Input
            value={check.expectedValue}
            onChange={(e) =>
              updateCheck(check.id, 'expectedValue', e.target.value)
            }
            placeholder={VALUE_PLACEHOLDERS[check.type] || 'Expected value'}
            className="h-8 text-xs font-mono flex-1"
          />

          {/* Delete */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            onClick={() => removeCheck(check.id)}
            title="Remove check"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addCheck} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Check
      </Button>
    </div>
  );
};

export default ChecksEditor;
