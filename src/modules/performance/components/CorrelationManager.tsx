import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Link2,
  ShieldCheck,
  Key,
  Cookie,
  KeyRound,
  FlaskConical,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export interface CorrelationRule {
  id: string;
  name: string;
  extractType:
    | 'jsonpath'
    | 'regex'
    | 'boundary'
    | 'header'
    | 'cookie'
    | 'xpath'
    | 'html_form';
  pattern: string;
  variableName: string;
  scope: 'response_body' | 'response_header' | 'cookie';
  occurrence: 'first' | 'last' | 'all';
  enabled: boolean;
}

export interface CorrelationManagerProps {
  rules: CorrelationRule[];
  onRulesChange: (rules: CorrelationRule[]) => void;
  targetUrl: string;
}

const EXTRACT_TYPES = [
  { value: 'jsonpath', label: 'JSONPath' },
  { value: 'regex', label: 'Regex' },
  { value: 'boundary', label: 'Boundary' },
  { value: 'header', label: 'Header' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'xpath', label: 'XPath' },
  { value: 'html_form', label: 'HTML Form' },
] as const;

const SCOPE_OPTIONS = [
  { value: 'response_body', label: 'Response Body' },
  { value: 'response_header', label: 'Response Header' },
  { value: 'cookie', label: 'Cookie' },
] as const;

const OCCURRENCE_OPTIONS = [
  { value: 'first', label: 'First' },
  { value: 'last', label: 'Last' },
  { value: 'all', label: 'All' },
] as const;

const PATTERN_PLACEHOLDERS: Record<string, string> = {
  jsonpath: '$.data.token',
  regex: '(?<=token":")[^"]+',
  boundary: 'LB="token=", RB="&"',
  header: 'X-CSRF-Token',
  cookie: 'session_id',
  xpath: '//input[@name="csrf"]/@value',
  html_form: 'input[name="csrf_token"]',
};

interface PresetRule {
  name: string;
  icon: React.ReactNode;
  rule: Omit<CorrelationRule, 'id' | 'enabled' | 'occurrence'>;
}

const PRESET_RULES: PresetRule[] = [
  {
    name: 'CSRF Token',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    rule: {
      name: 'csrf_token',
      extractType: 'regex',
      pattern: 'csrf[_-]?token["\']\\s*[:=]\\s*["\']([^"\']+)',
      variableName: 'csrf_token',
      scope: 'response_body',
    },
  },
  {
    name: 'JWT Token',
    icon: <Key className="h-3.5 w-3.5" />,
    rule: {
      name: 'jwt_token',
      extractType: 'regex',
      pattern: 'eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
      variableName: 'jwt_token',
      scope: 'response_body',
    },
  },
  {
    name: 'Session ID',
    icon: <Cookie className="h-3.5 w-3.5" />,
    rule: {
      name: 'session_id',
      extractType: 'cookie',
      pattern: 'JSESSIONID|PHPSESSID|ASP.NET_SessionId|session_id|sid',
      variableName: 'session_id',
      scope: 'cookie',
    },
  },
  {
    name: 'OAuth Token',
    icon: <KeyRound className="h-3.5 w-3.5" />,
    rule: {
      name: 'access_token',
      extractType: 'jsonpath',
      pattern: '$.access_token',
      variableName: 'access_token',
      scope: 'response_body',
    },
  },
];

function generateId(): string {
  return `cor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CorrelationManager({
  rules,
  onRulesChange,
  targetUrl,
}: CorrelationManagerProps) {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [testOpen, setTestOpen] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    value: string;
  } | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addRule = () => {
    const newRule: CorrelationRule = {
      id: generateId(),
      name: 'new_variable',
      extractType: 'regex',
      pattern: '',
      variableName: 'new_variable',
      scope: 'response_body',
      occurrence: 'first',
      enabled: true,
    };
    onRulesChange([...rules, newRule]);
    setExpandedRules((prev) => new Set(prev).add(newRule.id));
  };

  const addPreset = (preset: PresetRule) => {
    const newRule: CorrelationRule = {
      ...preset.rule,
      id: generateId(),
      occurrence: 'first',
      enabled: true,
    };
    onRulesChange([...rules, newRule]);
  };

  const updateRule = (
    id: string,
    updates: Partial<CorrelationRule>
  ) => {
    onRulesChange(
      rules.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const deleteRule = (id: string) => {
    onRulesChange(rules.filter((r) => r.id !== id));
    setExpandedRules((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const runTestExtraction = () => {
    if (!testRuleId || !testInput.trim()) {
      setTestResult({ matched: false, value: 'No match found' });
      return;
    }

    const rule = rules.find((r) => r.id === testRuleId);
    if (!rule) {
      setTestResult({ matched: false, value: 'Rule not found' });
      return;
    }

    try {
      if (rule.extractType === 'jsonpath') {
        const parsed = JSON.parse(testInput);
        const pathParts = rule.pattern
          .replace(/^\$\.?/, '')
          .split('.');
        let value: unknown = parsed;
        for (const part of pathParts) {
          if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
            value = (value as Record<string, unknown>)[part];
          } else {
            setTestResult({ matched: false, value: 'No match found' });
            return;
          }
        }
        setTestResult({ matched: true, value: String(value) });
      } else if (rule.extractType === 'regex') {
        const regex = new RegExp(rule.pattern);
        const match = regex.exec(testInput);
        if (match) {
          setTestResult({
            matched: true,
            value: match[1] || match[0],
          });
        } else {
          setTestResult({ matched: false, value: 'No match found' });
        }
      } else {
        setTestResult({
          matched: false,
          value: `Client-side testing not supported for ${rule.extractType}`,
        });
      }
    } catch {
      setTestResult({ matched: false, value: 'No match found' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Correlation Rules</h3>
          <Badge variant="secondary" className="text-xs">
            {rules.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => {
              /* Auto-detect placeholder */
            }}
            title="Run a test first to auto-detect correlatable values"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Detect
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={addRule}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Pre-built Rules */}
      <Collapsible open={presetsOpen} onOpenChange={setPresetsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 w-full justify-start px-2"
          >
            {presetsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Quick Add Common Patterns
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-2 mt-2">
            {PRESET_RULES.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => addPreset(preset)}
              >
                {preset.icon}
                {preset.name}
              </Button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Empty State */}
      {rules.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No correlation rules. Correlations automatically capture dynamic
              values (tokens, session IDs) from responses and inject them into
              subsequent requests.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isExpanded = expandedRules.has(rule.id);
            return (
              <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
                <CardContent className="p-3 space-y-3">
                  {/* Rule Summary Row */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) =>
                        updateRule(rule.id, { enabled: v })
                      }
                      className="scale-75"
                    />
                    <Input
                      value={rule.name}
                      onChange={(e) =>
                        updateRule(rule.id, { name: e.target.value })
                      }
                      className="h-7 text-xs w-[160px]"
                    />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono shrink-0"
                    >
                      {'${'}
                      {rule.variableName}
                      {'}'}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {
                        EXTRACT_TYPES.find((t) => t.value === rule.extractType)
                          ?.label
                      }
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block max-w-[200px]">
                      {rule.pattern}
                    </span>

                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleExpanded(rule.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Edit Form */}
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Extract Type</Label>
                        <Select
                          value={rule.extractType}
                          onValueChange={(v) =>
                            updateRule(rule.id, {
                              extractType: v as CorrelationRule['extractType'],
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXTRACT_TYPES.map((t) => (
                              <SelectItem
                                key={t.value}
                                value={t.value}
                                className="text-xs"
                              >
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Variable Name</Label>
                        <Input
                          value={rule.variableName}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              variableName: e.target.value,
                            })
                          }
                          className="h-8 text-xs font-mono"
                          placeholder="my_variable"
                        />
                      </div>

                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Pattern</Label>
                        <Input
                          value={rule.pattern}
                          onChange={(e) =>
                            updateRule(rule.id, { pattern: e.target.value })
                          }
                          className="h-8 text-xs font-mono"
                          placeholder={
                            PATTERN_PLACEHOLDERS[rule.extractType] || 'Pattern'
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Scope</Label>
                        <Select
                          value={rule.scope}
                          onValueChange={(v) =>
                            updateRule(rule.id, {
                              scope: v as CorrelationRule['scope'],
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCOPE_OPTIONS.map((s) => (
                              <SelectItem
                                key={s.value}
                                value={s.value}
                                className="text-xs"
                              >
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Occurrence</Label>
                        <Select
                          value={rule.occurrence}
                          onValueChange={(v) =>
                            updateRule(rule.id, {
                              occurrence: v as CorrelationRule['occurrence'],
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OCCURRENCE_OPTIONS.map((o) => (
                              <SelectItem
                                key={o.value}
                                value={o.value}
                                className="text-xs"
                              >
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Test Extraction Section */}
      <Collapsible open={testOpen} onOpenChange={setTestOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 w-full justify-start px-2"
          >
            {testOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <FlaskConical className="h-3.5 w-3.5" />
            Test Extraction
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Select Rule to Test</Label>
                <Select
                  value={testRuleId || ''}
                  onValueChange={(v) => {
                    setTestRuleId(v);
                    setTestResult(null);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a rule..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((r) => (
                      <SelectItem
                        key={r.id}
                        value={r.id}
                        className="text-xs"
                      >
                        {r.name} ({r.extractType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Paste sample response to test extraction
                </Label>
                <Textarea
                  value={testInput}
                  onChange={(e) => {
                    setTestInput(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder='{"csrf_token": "abc123", "data": {"access_token": "eyJhbGci..."}}'
                  className="text-xs font-mono h-24 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={runTestExtraction}
                  disabled={!testRuleId || !testInput.trim()}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Test
                </Button>

                {testResult && (
                  <div className="flex items-center gap-1.5">
                    {testResult.matched ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-mono ${
                        testResult.matched
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {testResult.value}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
