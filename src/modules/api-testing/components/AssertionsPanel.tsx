/**
 * AssertionsPanel - Reusable assertion editor for API testing.
 * Used by RequestBuilder (per-request assertions) and RequestChainBuilder (per-step assertions).
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, CheckCircle2, XCircle, AlertCircle,
  Hash, Clock, Target, FileText, Search, X, Code, Mail, Equal, Tag, Database, ArrowRightLeft,
} from "lucide-react";
import {
  ASSERTION_TYPES,
  ASSERTION_OPERATORS,
  DB_ASSERTION_OPERATORS,
  type AssertionConfig,
  generateId,
} from "./constants";

const ICON_MAP: Record<string, React.ReactNode> = {
  HashIcon: <Hash className="w-4 h-4" />,
  ClockIcon: <Clock className="w-4 h-4" />,
  TargetIcon: <Target className="w-4 h-4" />,
  FileTextIcon: <FileText className="w-4 h-4" />,
  SearchIcon: <Search className="w-4 h-4" />,
  XIcon: <X className="w-4 h-4" />,
  CodeIcon: <Code className="w-4 h-4" />,
  MailIcon: <Mail className="w-4 h-4" />,
  EqualIcon: <Equal className="w-4 h-4" />,
  TagIcon: <Tag className="w-4 h-4" />,
  DatabaseIcon: <Database className="w-4 h-4" />,
};

interface AssertionResult {
  passed: boolean;
  message: string;
  actual?: string;
}

interface DbConnection {
  connection_id: string;
  type: string;
}

interface AssertionsPanelProps {
  assertions: AssertionConfig[];
  onChange: (assertions: AssertionConfig[]) => void;
  results?: AssertionResult[];
  compact?: boolean;
  /** When set, "Matches baseline" assertions show "Use current as baseline" to fill from last response */
  currentResponseBody?: string;
  /** Active database connections for database assertion type */
  dbConnections?: DbConnection[];
}

export default function AssertionsPanel({ assertions, onChange, results, compact = false, currentResponseBody, dbConnections = [] }: AssertionsPanelProps) {
  const addAssertion = () => {
    onChange([
      ...assertions,
      {
        id: generateId(),
        type: "status_code",
        name: "",
        expected: "200",
        path: "",
        operator: "equals",
        schema: "",
      },
    ]);
  };

  const updateAssertion = (id: string, field: string, value: string) => {
    onChange(assertions.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const removeAssertion = (id: string) => {
    onChange(assertions.filter(a => a.id !== id));
  };

  const getResult = (idx: number): AssertionResult | undefined => results?.[idx];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Assertions ({assertions.length})</Label>
        <Button variant="outline" size="sm" onClick={addAssertion}>
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {assertions.length === 0 && (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No assertions added.</p>
          <p className="text-xs mt-1">Add assertions to validate response status, body, headers, and more.</p>
        </div>
      )}

      {assertions.map((assertion, idx) => {
        const result = getResult(idx);
        const typeDef = ASSERTION_TYPES.find(t => t.value === assertion.type);

        return (
          <Card
            key={assertion.id}
            className={`border ${
              result
                ? result.passed
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-red-500/40 bg-red-500/5"
                : "border-border"
            }`}
          >
            <CardContent className={compact ? "p-3 space-y-2" : "p-4 space-y-3"}>
              {/* Row 1: Type + Operator + Result badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {typeDef && ICON_MAP[typeDef.icon]}
                </div>

                <Select
                  value={assertion.type}
                  onValueChange={v => updateAssertion(assertion.id, "type", v)}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSERTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-1.5">
                          {ICON_MAP[t.icon]}
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {assertion.type === "database" ? (
                  <Select
                    value={assertion.db_comparison || "equals"}
                    onValueChange={v => updateAssertion(assertion.id, "db_comparison", v)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DB_ASSERTION_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={assertion.operator}
                    onValueChange={v => updateAssertion(assertion.id, "operator", v)}
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSERTION_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex-1" />

                {result && (
                  <Badge
                    variant="outline"
                    className={
                      result.passed
                        ? "border-green-500 text-green-600 bg-green-500/10"
                        : "border-red-500 text-red-600 bg-red-500/10"
                    }
                  >
                    {result.passed ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    {result.passed ? "Pass" : "Fail"}
                  </Badge>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => removeAssertion(assertion.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Row 2: Path + Expected (non-database types) */}
              {assertion.type !== "database" && (
                <div className="flex gap-2">
                  {(assertion.type === "jsonpath" ||
                    assertion.type === "xpath" ||
                    assertion.type === "header") && (
                    <Input
                      className="h-8 text-xs font-mono flex-1"
                      placeholder={
                        assertion.type === "jsonpath"
                          ? "$.data.id"
                          : assertion.type === "xpath"
                            ? "//element/@attr"
                            : "Content-Type"
                      }
                      value={assertion.path}
                      onChange={e => updateAssertion(assertion.id, "path", e.target.value)}
                    />
                  )}

                  {assertion.type !== "schema" && assertion.type !== "matches_baseline" && (
                    <Input
                      className="h-8 text-xs font-mono flex-1"
                      placeholder={
                        assertion.type === "status_code"
                          ? "200"
                          : assertion.type === "response_time"
                            ? "1000"
                            : "Expected value"
                      }
                      value={assertion.expected}
                      onChange={e => updateAssertion(assertion.id, "expected", e.target.value)}
                    />
                  )}

                  {assertion.type === "schema" && (
                    <Input
                      className="h-8 text-xs font-mono flex-1"
                      placeholder='{"type":"object","properties":{...}}'
                      value={assertion.schema}
                      onChange={e => updateAssertion(assertion.id, "schema", e.target.value)}
                    />
                  )}

                  {assertion.type === "matches_baseline" && (
                    <div className="space-y-1.5 w-full">
                      {currentResponseBody != null && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => updateAssertion(assertion.id, "schema", currentResponseBody)}
                        >
                          Use current as baseline
                        </Button>
                      )}
                      <textarea
                        className="min-h-[80px] w-full rounded border bg-background px-2 py-1.5 text-xs font-mono"
                        placeholder='Paste baseline JSON (e.g. previous response). In Builder, use "Use current as baseline" after Send.'
                        value={assertion.schema}
                        onChange={e => updateAssertion(assertion.id, "schema", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Database Assertion Fields */}
              {assertion.type === "database" && (
                <div className="space-y-2 border-t pt-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Connection</Label>
                      <Select
                        value={assertion.db_connection_id || ""}
                        onValueChange={v => updateAssertion(assertion.id, "db_connection_id", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select connection..." />
                        </SelectTrigger>
                        <SelectContent>
                          {dbConnections.length === 0 ? (
                            <SelectItem value="_none" disabled>No active connections</SelectItem>
                          ) : (
                            dbConnections.map(conn => (
                              <SelectItem key={conn.connection_id} value={conn.connection_id}>
                                <span className="flex items-center gap-1.5">
                                  <Database className="w-3 h-3" />
                                  {conn.connection_id} ({conn.type})
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">SQL Query</Label>
                    <textarea
                      className="min-h-[60px] w-full rounded border bg-background px-2 py-1.5 text-xs font-mono"
                      placeholder="SELECT COUNT(*) FROM users WHERE email = '{{email}}'"
                      value={assertion.db_query || ""}
                      onChange={e => updateAssertion(assertion.id, "db_query", e.target.value)}
                    />
                  </div>

                  {/* Cross-verify: compare DB field with API response JSONPath */}
                  {["field_equals_response", "field_contains_response", "row_matches_response"].includes(assertion.db_comparison || "") && (
                    <div className="space-y-2 border border-blue-500/20 rounded-md p-2 bg-blue-500/5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Target className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-medium text-blue-600">Cross-Verify: DB ↔ Response</span>
                      </div>
                      {assertion.db_comparison !== "row_matches_response" && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground mb-1 block">DB Column / Field</Label>
                          <Input
                            className="h-7 text-xs font-mono"
                            placeholder="e.g. email, name, status"
                            value={assertion.db_field || ""}
                            onChange={e => updateAssertion(assertion.id, "db_field", e.target.value)}
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-[10px] text-muted-foreground mb-1 block">Response JSONPath</Label>
                        <Input
                          className="h-7 text-xs font-mono"
                          placeholder={assertion.db_comparison === "row_matches_response" ? "$.data (object to compare)" : "$.data.email"}
                          value={assertion.response_jsonpath || ""}
                          onChange={e => updateAssertion(assertion.id, "response_jsonpath", e.target.value)}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground">
                        {assertion.db_comparison === "row_matches_response"
                          ? "Compares all DB row fields against the response object at the given JSONPath."
                          : "Compares the DB query result field with the value at the response JSONPath after the API call."}
                      </p>
                    </div>
                  )}

                  {!["not_empty", "is_empty", "field_equals_response", "field_contains_response", "row_matches_response"].includes(assertion.db_comparison || "") && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Expected Value</Label>
                      <Input
                        className="h-8 text-xs font-mono"
                        placeholder={
                          (assertion.db_comparison || "equals") === "count"
                            ? "1"
                            : (assertion.db_comparison || "equals") === "greater_than"
                              ? "0"
                              : "Expected result"
                        }
                        value={assertion.expected}
                        onChange={e => updateAssertion(assertion.id, "expected", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Result message */}
              {result && !result.passed && result.message && (
                <p className="text-xs text-red-500 mt-1">{result.message}</p>
              )}
              {result && result.actual !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Actual: <code className="bg-muted px-1 rounded">{result.actual}</code>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
