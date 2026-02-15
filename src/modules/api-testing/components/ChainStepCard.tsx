/**
 * ChainStepCard - Individual step in a request chain.
 * Collapsible card showing method + URL, expandable to edit request, extractions, assertions, conditions.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CompactCodeEditor } from "./CodeEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown, ChevronUp, Trash2, GripVertical, Plus,
  ArrowDownToLine, CheckCircle2, GitBranch, Settings,
} from "lucide-react";
import AssertionsPanel from "./AssertionsPanel";
import {
  HTTP_METHODS,
  AUTH_TYPES,
  BODY_TYPES,
  EXTRACTION_METHODS,
  CONDITION_OPERATORS,
  getMethodColor,
  type ChainStep,
  type ExtractionConfig,
  type AssertionConfig,
  type ConditionConfig,
  type KeyValuePair,
  generateId,
} from "./constants";

interface ChainStepCardProps {
  step: ChainStep;
  index: number;
  totalSteps: number;
  allStepIds: { id: string; name: string }[];
  onChange: (step: ChainStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  result?: {
    status: string;
    status_code: number;
    response_time_ms: number;
    error: string | null;
  };
}

export default function ChainStepCard({
  step,
  index,
  totalSteps,
  allStepIds,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  result,
}: ChainStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("request");

  const updateRequest = (field: string, value: any) => {
    onChange({ ...step, request: { ...step.request, [field]: value } });
  };

  const updateKV = (field: "headers" | "params", index: number, key: string, value: string) => {
    const arr = [...step.request[field]];
    arr[index] = { ...arr[index], [key]: value };
    updateRequest(field, arr);
  };

  const addKV = (field: "headers" | "params") => {
    updateRequest(field, [...step.request[field], { key: "", value: "", enabled: true }]);
  };

  const removeKV = (field: "headers" | "params", i: number) => {
    updateRequest(field, step.request[field].filter((_, idx) => idx !== i));
  };

  // Extraction helpers
  const addExtraction = () => {
    onChange({
      ...step,
      extractions: [...step.extractions, {
        id: generateId(),
        name: "",
        method: "jsonpath",
        expression: "",
        defaultValue: "",
      }],
    });
  };

  const updateExtraction = (id: string, field: string, value: string) => {
    onChange({
      ...step,
      extractions: step.extractions.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeExtraction = (id: string) => {
    onChange({ ...step, extractions: step.extractions.filter(e => e.id !== id) });
  };

  // Condition helpers
  const addCondition = () => {
    onChange({
      ...step,
      conditions: [...step.conditions, {
        id: generateId(),
        source: "",
        operator: "if_equals",
        expected: "",
        gotoStep: "",
        skipStep: "",
      }],
    });
  };

  const updateCondition = (id: string, field: string, value: string) => {
    onChange({
      ...step,
      conditions: step.conditions.map(c => c.id === id ? { ...c, [field]: value } : c),
    });
  };

  const removeCondition = (id: string) => {
    onChange({ ...step, conditions: step.conditions.filter(c => c.id !== id) });
  };

  const methodColor = getMethodColor(step.request.method);
  const statusColor = result
    ? result.status === "passed"
      ? "border-green-500/40 bg-green-500/5"
      : result.status === "failed"
        ? "border-red-500/40 bg-red-500/5"
        : "border-yellow-500/40 bg-yellow-500/5"
    : "border-border";

  return (
    <Card className={`transition-all ${statusColor} ${!step.enabled ? "opacity-50" : ""}`}>
      {/* Collapsed header */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />

        <span className="text-xs text-muted-foreground font-mono w-6">{index + 1}</span>

        <Badge variant="outline" className={`text-xs font-bold ${methodColor}`}>
          {step.request.method}
        </Badge>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium truncate block">
            {step.name || `Step ${index + 1}`}
          </span>
          {step.request.url && (
            <span className="text-xs text-muted-foreground font-mono truncate block">
              {step.request.url}
            </span>
          )}
        </div>

        {/* Badges for extractions/assertions/conditions */}
        {step.extractions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <ArrowDownToLine className="w-3 h-3 mr-1" />
            {step.extractions.length}
          </Badge>
        )}
        {step.assertions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {step.assertions.length}
          </Badge>
        )}
        {step.conditions.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <GitBranch className="w-3 h-3 mr-1" />
            {step.conditions.length}
          </Badge>
        )}

        {/* Result badge */}
        {result && (
          <Badge
            variant="outline"
            className={
              result.status === "passed"
                ? "border-green-500 text-green-600"
                : result.status === "failed"
                  ? "border-red-500 text-red-600"
                  : "border-yellow-500 text-yellow-600"
            }
          >
            {result.status_code} - {result.response_time_ms}ms
          </Badge>
        )}

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}>
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === totalSteps - 1}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={e => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t">
          <div className="flex gap-2 mb-3 mt-3">
            <Input
              className="flex-[2] h-8 text-sm"
              placeholder="Step name (e.g. Login, Get Token)"
              value={step.name}
              onChange={e => onChange({ ...step, name: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={step.enabled}
                onChange={e => onChange({ ...step, enabled: e.target.checked })}
              />
              Enabled
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={step.retryOnFailure}
                onChange={e => onChange({ ...step, retryOnFailure: e.target.checked })}
              />
              Retry
            </label>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 h-8">
              <TabsTrigger value="request" className="text-xs h-7">Request</TabsTrigger>
              <TabsTrigger value="body" className="text-xs h-7">Body</TabsTrigger>
              <TabsTrigger value="extract" className="text-xs h-7">
                Extract {step.extractions.length > 0 && `(${step.extractions.length})`}
              </TabsTrigger>
              <TabsTrigger value="assert" className="text-xs h-7">
                Assert {step.assertions.length > 0 && `(${step.assertions.length})`}
              </TabsTrigger>
              <TabsTrigger value="condition" className="text-xs h-7">
                Cond {step.conditions.length > 0 && `(${step.conditions.length})`}
              </TabsTrigger>
            </TabsList>

            {/* Request tab */}
            <TabsContent value="request" className="mt-3 space-y-3">
              <div className="flex gap-2">
                <Select value={step.request.method} onValueChange={v => updateRequest("method", v)}>
                  <SelectTrigger className={`w-[110px] h-8 text-xs font-bold ${methodColor}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <span className={`font-bold ${m.color}`}>{m.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1 h-8 text-xs font-mono"
                  placeholder="https://api.example.com/endpoint or ${base_url}/endpoint"
                  value={step.request.url}
                  onChange={e => updateRequest("url", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Headers</Label>
                {step.request.headers.map((h, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="flex-1 h-7 text-xs font-mono" placeholder="Key" value={h.key} onChange={e => updateKV("headers", i, "key", e.target.value)} />
                    <Input className="flex-1 h-7 text-xs font-mono" placeholder="Value (use ${var})" value={h.value} onChange={e => updateKV("headers", i, "value", e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeKV("headers", i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addKV("headers")}>
                  <Plus className="w-3 h-3 mr-1" /> Header
                </Button>
              </div>

              {/* Auth shortcut */}
              <div className="space-y-2">
                <Label className="text-xs">Auth</Label>
                <Select value={step.request.authType} onValueChange={v => updateRequest("authType", v)}>
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map(at => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {step.request.authType === "bearer" && (
                  <Input
                    className="h-7 text-xs font-mono"
                    placeholder="Bearer token or ${token}"
                    value={step.request.authToken}
                    onChange={e => updateRequest("authToken", e.target.value)}
                  />
                )}
              </div>
            </TabsContent>

            {/* Body tab */}
            <TabsContent value="body" className="mt-3 space-y-3">
              <div className="flex gap-2">
                {BODY_TYPES.map(bt => (
                  <Button
                    key={bt.value}
                    variant={step.request.bodyType === bt.value ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => updateRequest("bodyType", bt.value)}
                  >
                    {bt.label}
                  </Button>
                ))}
              </div>
              {step.request.bodyType !== "none" && (
                <CompactCodeEditor
                  value={step.request.body}
                  onChange={(val) => updateRequest("body", val)}
                  language={step.request.bodyType === "json" ? "json" : step.request.bodyType === "xml" ? "xml" : step.request.bodyType === "graphql" ? "graphql" : "raw"}
                  placeholder={'{\n  "key": "${variable}"\n}'}
                  height="120px"
                />
              )}
            </TabsContent>

            {/* Extractions tab */}
            <TabsContent value="extract" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Extract values from the response to use in later steps via <code className="bg-muted px-1 rounded">{"${variable_name}"}</code>
              </p>
              {step.extractions.map(ext => (
                <Card key={ext.id} className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 h-7 text-xs"
                      placeholder="Variable name (e.g. token, userId)"
                      value={ext.name}
                      onChange={e => updateExtraction(ext.id, "name", e.target.value)}
                    />
                    <Select value={ext.method} onValueChange={v => updateExtraction(ext.id, "method", v)}>
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXTRACTION_METHODS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeExtraction(ext.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                  <Input
                    className="h-7 text-xs font-mono"
                    placeholder={ext.method === "jsonpath" ? "$.data.access_token" : ext.method === "regex" ? "token=([\\w-]+)" : ext.method === "header" ? "Authorization" : "Expression"}
                    value={ext.expression}
                    onChange={e => updateExtraction(ext.id, "expression", e.target.value)}
                  />
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addExtraction}>
                <Plus className="w-3 h-3 mr-1" /> Add Extraction
              </Button>
            </TabsContent>

            {/* Assertions tab */}
            <TabsContent value="assert" className="mt-3">
              <AssertionsPanel
                assertions={step.assertions}
                onChange={a => onChange({ ...step, assertions: a })}
                compact
              />
            </TabsContent>

            {/* Conditions tab */}
            <TabsContent value="condition" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Control flow: skip or jump to steps based on extracted variable values.
              </p>
              {step.conditions.map(cond => (
                <Card key={cond.id} className="p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      className="flex-1 h-7 text-xs font-mono"
                      placeholder="Variable name (e.g. status_code, token)"
                      value={cond.source}
                      onChange={e => updateCondition(cond.id, "source", e.target.value)}
                    />
                    <Select value={cond.operator} onValueChange={v => updateCondition(cond.id, "operator", v)}>
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPERATORS.map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-[100px] h-7 text-xs font-mono"
                      placeholder="Expected"
                      value={cond.expected}
                      onChange={e => updateCondition(cond.id, "expected", e.target.value)}
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeCondition(cond.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Go to step</Label>
                      <Select value={cond.gotoStep} onValueChange={v => updateCondition(cond.id, "gotoStep", v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select step" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {allStepIds.filter(s => s.id !== step.id).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Skip step</Label>
                      <Select value={cond.skipStep} onValueChange={v => updateCondition(cond.id, "skipStep", v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select step" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {allStepIds.filter(s => s.id !== step.id).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="w-3 h-3 mr-1" /> Add Condition
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
