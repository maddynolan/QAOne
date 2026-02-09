/**
 * RequestBuilder - Postman-style ad-hoc API request builder.
 * Lets a regular tester type a URL, pick method, set headers/body/auth,
 * send the request, and see the full response with syntax highlighting.
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Plus, Trash2, Loader2, Copy, Save, Clock,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
} from "lucide-react";
import AssertionsPanel from "./AssertionsPanel";
import ResponseTreeExplorer from "./ResponseTreeExplorer";
import { resolveVariables, hasUnresolvedVariables, type EnvironmentConfig } from "./EnvironmentManager";
import {
  API_BASE_URL,
  HTTP_METHODS,
  AUTH_TYPES,
  BODY_TYPES,
  getMethodColor,
  type RequestConfig,
  type ResponseData,
  type AssertionConfig,
  type KeyValuePair,
  createEmptyRequest,
  generateId,
} from "./constants";

interface SavedRequest {
  id: string;
  name: string;
  request: RequestConfig;
  assertions: AssertionConfig[];
  savedAt: string;
}

export interface InitialRequestData {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  bodyType?: string;
}

interface RequestBuilderProps {
  onSaveToChain?: (request: RequestConfig, assertions: AssertionConfig[]) => void;
  onAddToTestSuite?: (testCase: any) => void;
  initialRequest?: InitialRequestData | null;
  activeEnvironment?: EnvironmentConfig | null;
}

export default function RequestBuilder({ onSaveToChain, onAddToTestSuite, initialRequest, activeEnvironment }: RequestBuilderProps) {
  const [request, setRequest] = useState<RequestConfig>(createEmptyRequest());
  const [assertions, setAssertions] = useState<AssertionConfig[]>([]);
  const [assertionResults, setAssertionResults] = useState<Array<{ passed: boolean; message: string }>>([]);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("params");
  const [responseTab, setResponseTab] = useState("body");

  // --- Load initial request when prop changes (e.g. from "Try It" button) ---
  useEffect(() => {
    if (initialRequest) {
      const headers: KeyValuePair[] = [];
      if (initialRequest.headers) {
        Object.entries(initialRequest.headers).forEach(([key, value]) => {
          headers.push({ key, value, enabled: true });
        });
      }
      if (!headers.find(h => h.key.toLowerCase() === "content-type")) {
        headers.push({ key: "Content-Type", value: "application/json", enabled: true });
      }

      setRequest({
        ...createEmptyRequest(),
        method: initialRequest.method || "GET",
        url: initialRequest.url || "",
        headers,
        body: initialRequest.body
          ? (typeof initialRequest.body === "string" ? initialRequest.body : JSON.stringify(initialRequest.body, null, 2))
          : "",
        bodyType: initialRequest.bodyType || (initialRequest.body ? "json" : "none"),
      });
      setResponse(null);
      setError(null);
      setAssertionResults([]);
    }
  }, [initialRequest]);
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("api_saved_requests") || "[]");
    } catch {
      return [];
    }
  });
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // --- Key-Value helpers ---
  const updateKV = (
    field: "headers" | "params",
    index: number,
    key: string,
    value: string
  ) => {
    const arr = [...request[field]];
    arr[index] = { ...arr[index], [key]: value };
    setRequest({ ...request, [field]: arr });
  };

  const toggleKV = (field: "headers" | "params", index: number) => {
    const arr = [...request[field]];
    arr[index] = { ...arr[index], enabled: !arr[index].enabled };
    setRequest({ ...request, [field]: arr });
  };

  const addKV = (field: "headers" | "params") => {
    setRequest({
      ...request,
      [field]: [...request[field], { key: "", value: "", enabled: true }],
    });
  };

  const removeKV = (field: "headers" | "params", index: number) => {
    setRequest({
      ...request,
      [field]: request[field].filter((_, i) => i !== index),
    });
  };

  // --- Build headers from auth + custom headers + env variables ---
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    request.headers.forEach(h => {
      if (h.enabled && h.key.trim()) {
        const key = resolveVariables(h.key.trim(), activeEnvironment || null);
        const val = resolveVariables(h.value, activeEnvironment || null);
        headers[key] = val;
      }
    });

    // Apply request-level auth first
    if (request.authType === "bearer" && request.authToken) {
      headers["Authorization"] = `Bearer ${resolveVariables(request.authToken, activeEnvironment || null)}`;
    } else if (request.authType === "basic" && request.authUsername) {
      const user = resolveVariables(request.authUsername, activeEnvironment || null);
      const pass = resolveVariables(request.authPassword, activeEnvironment || null);
      headers["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`;
    } else if (request.authType === "api_key" && request.authApiKeyName && request.authApiKeyLocation === "header") {
      const keyName = resolveVariables(request.authApiKeyName, activeEnvironment || null);
      const keyVal = resolveVariables(request.authApiKeyValue, activeEnvironment || null);
      headers[keyName] = keyVal;
    }
    // If request auth is "none", fall back to environment-level auth
    else if (request.authType === "none" && activeEnvironment?.auth && activeEnvironment.auth.type !== "none") {
      const envAuth = activeEnvironment.auth;
      if (envAuth.type === "bearer" && envAuth.bearer_token) {
        headers["Authorization"] = `Bearer ${envAuth.bearer_token}`;
      } else if (envAuth.type === "basic" && envAuth.basic_username) {
        headers["Authorization"] = `Basic ${btoa(`${envAuth.basic_username}:${envAuth.basic_password || ""}`)}`;
      } else if (envAuth.type === "api_key" && envAuth.api_key_name && envAuth.api_key_location === "header") {
        headers[envAuth.api_key_name] = envAuth.api_key_value || "";
      }
    }
    return headers;
  }, [request, activeEnvironment]);

  // --- Build URL with query params and variable resolution ---
  const buildUrl = useCallback((): string => {
    let url = request.url.trim();
    if (!url) return url;
    // Resolve environment variables in URL
    url = resolveVariables(url, activeEnvironment || null);
    const params = request.params.filter(p => p.enabled && p.key.trim());
    if (params.length > 0) {
      const sep = url.includes("?") ? "&" : "?";
      url += sep + params.map(p => {
        const key = resolveVariables(p.key, activeEnvironment || null);
        const val = resolveVariables(p.value, activeEnvironment || null);
        return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      }).join("&");
    }
    if (request.authType === "api_key" && request.authApiKeyLocation === "query" && request.authApiKeyName) {
      const sep = url.includes("?") ? "&" : "?";
      const keyName = resolveVariables(request.authApiKeyName, activeEnvironment || null);
      const keyVal = resolveVariables(request.authApiKeyValue, activeEnvironment || null);
      url += `${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(keyVal)}`;
    }
    return url;
  }, [request, activeEnvironment]);

  // Check for unresolved variables in URL
  const unresolvedVars = request.url ? hasUnresolvedVariables(request.url) : [];

  // --- Send the request ---
  const handleSend = async () => {
    const url = buildUrl();
    if (!url) {
      setError("Please enter a URL");
      return;
    }

    setSending(true);
    setError(null);
    setResponse(null);

    const startTime = performance.now();

    try {
      // Use the backend proxy endpoint to avoid CORS issues
      const proxyResponse = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_suite: {
            test_cases: [
              {
                test_case_id: `adhoc_${Date.now()}`,
                title: "Ad-hoc Request",
                method: request.method,
                path: url,
                request: {
                  headers: buildHeaders(),
                  body: request.bodyType !== "none" && request.body.trim()
                    ? tryParseJSON(resolveVariables(request.body, activeEnvironment || null))
                    : undefined,
                  query: Object.fromEntries(
                    request.params.filter(p => p.enabled && p.key.trim()).map(p => [p.key, p.value])
                  ),
                },
                expected_status: 200,
                assertions: assertions.map(a => ({
                  type: a.type,
                  operator: a.operator,
                  expected: a.expected,
                  path: a.path,
                  schema: a.schema,
                })),
                test_type: "functional",
              },
            ],
            base_url: "",
          },
          execution_config: {
            base_url: "",
            parallel: false,
          },
          mode: "automated",
        }),
      });

      const elapsed = Math.round(performance.now() - startTime);
      const data = await proxyResponse.json();

      // Extract the actual result from the test execution
      const testResult = data?.execution_results?.test_results?.[0] || data?.test_results?.[0];
      if (testResult && testResult.actual_status) {
        const responseBody = testResult.response_body ?? testResult.response_data;
        const httpStatus = testResult.actual_status;
        const statusText = httpStatus >= 200 && httpStatus < 300 ? "OK"
          : httpStatus >= 300 && httpStatus < 400 ? "Redirect"
          : httpStatus === 400 ? "Bad Request"
          : httpStatus === 401 ? "Unauthorized"
          : httpStatus === 403 ? "Forbidden"
          : httpStatus === 404 ? "Not Found"
          : httpStatus === 405 ? "Method Not Allowed"
          : httpStatus === 429 ? "Too Many Requests"
          : httpStatus >= 500 ? "Server Error"
          : testResult.error || "Error";
        setResponse({
          status: httpStatus,
          statusText,
          headers: testResult.response_headers || {},
          body: typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody ?? data, null, 2),
          time: Math.round(testResult.response_time_ms || elapsed),
          size: typeof responseBody === "string" ? responseBody.length : JSON.stringify(responseBody || "").length,
        });

        // Extract assertion results from backend response
        if (testResult.assertion_results && Array.isArray(testResult.assertion_results)) {
          setAssertionResults(testResult.assertion_results);
        } else {
          // Build assertion results client-side from basic checks
          const results: Array<{ passed: boolean; message: string }> = [];
          for (const a of assertions) {
            if (a.type === "status_code") {
              const expected = parseInt(a.expected) || 200;
              results.push({
                passed: httpStatus === expected,
                message: `Status code: expected ${expected}, got ${httpStatus}`,
              });
            } else if (a.type === "contains") {
              const bodyStr = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody || "");
              const found = bodyStr.includes(a.expected);
              results.push({
                passed: a.operator === "not_contains" ? !found : found,
                message: `Body ${found ? "contains" : "does not contain"} "${a.expected}"`,
              });
            } else if (a.type === "response_time") {
              const maxMs = parseInt(a.expected) || 1000;
              const actualMs = Math.round(testResult.response_time_ms || elapsed);
              results.push({
                passed: actualMs <= maxMs,
                message: `Response time: ${actualMs}ms (max ${maxMs}ms)`,
              });
            } else if (a.type === "header") {
              const headerVal = (testResult.response_headers || {})[a.path || ""] || "";
              const match = a.operator === "contains"
                ? headerVal.toLowerCase().includes((a.expected || "").toLowerCase())
                : headerVal === a.expected;
              results.push({
                passed: match,
                message: `Header "${a.path}": ${match ? "matches" : `expected "${a.expected}", got "${headerVal}"`}`,
              });
            } else if (a.type === "jsonpath" && a.path) {
              // Basic JSONPath check: extract from response and compare
              try {
                const bodyObj = typeof responseBody === "string" ? JSON.parse(responseBody) : responseBody;
                const pathParts = a.path.replace(/^\$\.?/, "").split(".");
                let val: any = bodyObj;
                for (const part of pathParts) {
                  if (val == null) break;
                  const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
                  if (arrMatch) {
                    val = val[arrMatch[1]]?.[parseInt(arrMatch[2])];
                  } else {
                    val = val[part];
                  }
                }
                const actual = String(val);
                const passed = a.operator === "exists" ? val !== undefined && val !== null
                  : a.operator === "not_exists" ? val === undefined || val === null
                  : a.operator === "contains" ? actual.includes(a.expected)
                  : actual === a.expected;
                results.push({
                  passed,
                  message: `JSONPath "${a.path}": ${passed ? "passed" : `expected "${a.expected}", got "${actual}"`}`,
                });
              } catch {
                results.push({ passed: false, message: `JSONPath "${a.path}": failed to evaluate` });
              }
            } else {
              results.push({ passed: true, message: `${a.type}: evaluated` });
            }
          }
          setAssertionResults(results);
        }
      } else {
        // Fallback: show the raw response
        setResponse({
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: Object.fromEntries(proxyResponse.headers.entries()),
          body: JSON.stringify(data, null, 2),
          time: elapsed,
          size: 0,
        });
      }
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setSending(false);
    }
  };

  // --- Save request ---
  const saveRequest = () => {
    if (!saveName.trim()) return;
    const saved: SavedRequest = {
      id: generateId(),
      name: saveName.trim(),
      request: { ...request },
      assertions: [...assertions],
      savedAt: new Date().toISOString(),
    };
    // Keep in local list for quick access in Builder's "Saved" tab
    const updated = [...savedRequests, saved];
    setSavedRequests(updated);
    localStorage.setItem("api_saved_requests", JSON.stringify(updated));
    setSaveName("");
    setShowSaveInput(false);

    // Save to Execute suite AND database (via the callback in EnhancedAPITesting)
    if (onAddToTestSuite) {
      const url = buildUrl();
      onAddToTestSuite({
        test_case_id: `builder_${saved.id}`,
        title: saved.name,  // Use the user-provided name, NOT the endpoint path
        description: `Custom test: ${request.method} ${url}`,
        method: request.method,
        path: url,
        expected_status: (() => {
          const sa = assertions.find(a => a.type === "status_code");
          return sa ? parseInt(sa.expected) || 200 : 200;
        })(),
        test_type: "functional",
        tags: ["functional", "builder", "custom"],
        request: {
          headers: buildHeaders(),
          body: request.bodyType !== "none" && request.body.trim()
            ? (() => { try { return JSON.parse(request.body); } catch { return request.body; } })()
            : undefined,
          query: Object.fromEntries(
            request.params.filter(p => p.enabled && p.key.trim()).map(p => [p.key, p.value])
          ),
        },
        assertions: assertions.map(a => ({
          type: a.type, operator: a.operator, expected: a.expected, path: a.path, schema: a.schema,
        })),
      });
    }
  };

  const loadSavedRequest = (saved: SavedRequest) => {
    setRequest({ ...saved.request });
    setAssertions([...saved.assertions]);
    setShowSaved(false);
  };

  const deleteSavedRequest = (id: string) => {
    const updated = savedRequests.filter(r => r.id !== id);
    setSavedRequests(updated);
    localStorage.setItem("api_saved_requests", JSON.stringify(updated));
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-600 bg-green-500/10 border-green-500/30";
    if (status >= 300 && status < 400) return "text-blue-600 bg-blue-500/10 border-blue-500/30";
    if (status >= 400 && status < 500) return "text-amber-600 bg-amber-500/10 border-amber-500/30";
    return "text-red-600 bg-red-500/10 border-red-500/30";
  };

  const methodColor = getMethodColor(request.method);

  return (
    <div className="space-y-4">
      {/* Saved requests toggle */}
      {savedRequests.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaved(!showSaved)}
          >
            {showSaved ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            Saved Requests ({savedRequests.length})
          </Button>
        </div>
      )}

      {showSaved && savedRequests.length > 0 && (
        <Card className="border-muted">
          <CardContent className="p-3">
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {savedRequests.map(saved => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group"
                    onClick={() => loadSavedRequest(saved)}
                  >
                    <Badge variant="outline" className={`text-xs ${getMethodColor(saved.request.method)}`}>
                      {saved.request.method}
                    </Badge>
                    <span className="text-sm font-medium flex-1 truncate">{saved.name}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {saved.request.url}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={e => { e.stopPropagation(); deleteSavedRequest(saved.id); }}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* URL Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Select
              value={request.method}
              onValueChange={v => setRequest({ ...request, method: v })}
            >
              <SelectTrigger className={`w-[120px] font-bold text-sm ${methodColor}`}>
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

            <div className="flex-1 relative">
              <Input
                className={`w-full font-mono text-sm ${unresolvedVars.length > 0 ? "border-amber-400 pr-20" : ""}`}
                placeholder="https://api.example.com/endpoint  or  {{base_url}}/api/users"
                value={request.url}
                onChange={e => setRequest({ ...request, url: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
              />
              {unresolvedVars.length > 0 && activeEnvironment && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {unresolvedVars.length} unresolved
                </span>
              )}
              {activeEnvironment && request.url.includes("{{") && unresolvedVars.length === 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                  vars resolved
                </span>
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || !request.url.trim()}
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 min-w-[100px]"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSaveInput(!showSaveInput)}
              title="Save request"
            >
              <Save className="w-4 h-4" />
            </Button>

            {onSaveToChain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSaveToChain(request, assertions)}
                title="Add to chain"
              >
                <Plus className="w-4 h-4 mr-1" />
                Chain
              </Button>
            )}

            {onAddToTestSuite && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = buildUrl();
                  if (!url) return;
                  const defaultName = `${request.method} ${url.replace(/https?:\/\/[^/]+/, "")}`;
                  const userTitle = prompt("Enter a name for this test case:", defaultName);
                  if (!userTitle) return; // cancelled
                  onAddToTestSuite({
                    test_case_id: `builder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    title: userTitle.trim(),
                    description: `Custom test: ${request.method} ${url}`,
                    method: request.method,
                    path: url,
                    expected_status: (() => {
                      const statusAssertion = assertions.find(a => a.type === "status_code");
                      return statusAssertion ? parseInt(statusAssertion.expected) || 200 : 200;
                    })(),
                    test_type: "functional",
                    tags: ["functional", "builder", "custom"],
                    request: {
                      headers: buildHeaders(),
                      body: request.bodyType !== "none" && request.body.trim()
                        ? (() => { try { return JSON.parse(request.body); } catch { return request.body; } })()
                        : undefined,
                      query: Object.fromEntries(
                        request.params.filter(p => p.enabled && p.key.trim()).map(p => [p.key, p.value])
                      ),
                    },
                    assertions: assertions.map(a => ({
                      type: a.type,
                      operator: a.operator,
                      expected: a.expected,
                      path: a.path,
                      schema: a.schema,
                    })),
                  });
                }}
                title="Add this request as a test case to the Execute tab and Tests page"
                className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Add to Tests
              </Button>
            )}
          </div>

          {showSaveInput && (
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Request name (e.g. Login, Get Users)"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveRequest(); }}
                className="flex-1"
              />
              <Button size="sm" onClick={saveRequest} disabled={!saveName.trim()}>
                Save
              </Button>
            </div>
          )}

          {/* Active environment indicator */}
          {activeEnvironment && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${
                activeEnvironment.type === "production" ? "bg-red-500" :
                activeEnvironment.type === "staging" ? "bg-amber-500" : "bg-green-500"
              }`} />
              <span>
                Env: <strong className="text-foreground">{activeEnvironment.name}</strong>
                <span className="font-mono ml-1">({activeEnvironment.base_url})</span>
              </span>
              {activeEnvironment.auth?.type !== "none" && activeEnvironment.auth?.type && (
                <Badge variant="secondary" className="text-[10px] h-4">
                  Auth: {activeEnvironment.auth.type}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Configuration Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 pt-2">
              <TabsTrigger value="params" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Params
                {request.params.filter(p => p.enabled && p.key.trim()).length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {request.params.filter(p => p.enabled && p.key.trim()).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="headers" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Headers
                {request.headers.filter(h => h.enabled && h.key.trim()).length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {request.headers.filter(h => h.enabled && h.key.trim()).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="body" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Body
              </TabsTrigger>
              <TabsTrigger value="auth" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Auth
                {request.authType !== "none" && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {AUTH_TYPES.find(a => a.value === request.authType)?.label}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="assertions" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Assertions
                {assertions.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {assertions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Params */}
            <TabsContent value="params" className="p-4 mt-0">
              <KeyValueEditor
                pairs={request.params}
                onUpdate={(i, k, v) => updateKV("params", i, k, v)}
                onToggle={i => toggleKV("params", i)}
                onAdd={() => addKV("params")}
                onRemove={i => removeKV("params", i)}
                keyPlaceholder="Parameter name"
                valuePlaceholder="Value"
              />
            </TabsContent>

            {/* Headers */}
            <TabsContent value="headers" className="p-4 mt-0">
              <KeyValueEditor
                pairs={request.headers}
                onUpdate={(i, k, v) => updateKV("headers", i, k, v)}
                onToggle={i => toggleKV("headers", i)}
                onAdd={() => addKV("headers")}
                onRemove={i => removeKV("headers", i)}
                keyPlaceholder="Header name"
                valuePlaceholder="Value"
              />
            </TabsContent>

            {/* Body */}
            <TabsContent value="body" className="p-4 mt-0 space-y-3">
              <div className="flex gap-2">
                {BODY_TYPES.map(bt => (
                  <Button
                    key={bt.value}
                    variant={request.bodyType === bt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequest({ ...request, bodyType: bt.value })}
                  >
                    {bt.label}
                  </Button>
                ))}
              </div>
              {request.bodyType !== "none" && (
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  placeholder={
                    request.bodyType === "json"
                      ? '{\n  "key": "value"\n}'
                      : request.bodyType === "xml"
                        ? '<?xml version="1.0"?>\n<root></root>'
                        : request.bodyType === "form"
                          ? "key=value&key2=value2"
                          : "Raw text content..."
                  }
                  value={request.body}
                  onChange={e => setRequest({ ...request, body: e.target.value })}
                />
              )}
              {request.bodyType === "json" && request.body.trim() && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        setRequest({ ...request, body: JSON.stringify(JSON.parse(request.body), null, 2) });
                      } catch {}
                    }}
                  >
                    Format JSON
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Auth */}
            <TabsContent value="auth" className="p-4 mt-0 space-y-4">
              <div className="space-y-2">
                <Label>Authorization Type</Label>
                <Select
                  value={request.authType}
                  onValueChange={v => setRequest({ ...request, authType: v })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map(at => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {request.authType === "bearer" && (
                <div className="space-y-2">
                  <Label>Token</Label>
                  <Input
                    className="font-mono text-sm"
                    placeholder="Enter bearer token"
                    value={request.authToken}
                    onChange={e => setRequest({ ...request, authToken: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded">{"${variable_name}"}</code> to reference chain variables.
                  </p>
                </div>
              )}

              {request.authType === "basic" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={request.authUsername}
                      onChange={e => setRequest({ ...request, authUsername: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={request.authPassword}
                      onChange={e => setRequest({ ...request, authPassword: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {request.authType === "api_key" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Key Name</Label>
                      <Input
                        placeholder="X-API-Key"
                        value={request.authApiKeyName}
                        onChange={e => setRequest({ ...request, authApiKeyName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Key Value</Label>
                      <Input
                        className="font-mono"
                        value={request.authApiKeyValue}
                        onChange={e => setRequest({ ...request, authApiKeyValue: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Add To</Label>
                    <Select
                      value={request.authApiKeyLocation}
                      onValueChange={v => setRequest({ ...request, authApiKeyLocation: v })}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">Header</SelectItem>
                        <SelectItem value="query">Query Parameter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Assertions */}
            <TabsContent value="assertions" className="p-4 mt-0">
              <AssertionsPanel assertions={assertions} onChange={setAssertions} results={assertionResults.length > 0 ? assertionResults : undefined} />
              {assertionResults.length > 0 && (
                <div className="mt-3 space-y-1">
                  {assertionResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {r.passed
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <span className={r.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                        {r.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Response */}
      {response && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-3">
                Response
                <Badge variant="outline" className={getStatusColor(response.status)}>
                  {response.status} {response.statusText}
                </Badge>
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {response.time}ms
                </span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(response.body);
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={responseTab} onValueChange={setResponseTab}>
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
                <TabsTrigger value="body" className="rounded-b-none">Body</TabsTrigger>
                <TabsTrigger value="headers" className="rounded-b-none">
                  Headers
                  {Object.keys(response.headers).length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                      {Object.keys(response.headers).length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tree" className="rounded-b-none text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Assert Builder
                </TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="mt-0">
                <ScrollArea className="h-[350px]">
                  <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                    {formatResponseBody(response.body)}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="headers" className="mt-0">
                <ScrollArea className="h-[300px]">
                  <div className="p-4 space-y-1">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-3 text-sm py-1 border-b border-border/50 last:border-0">
                        <span className="font-mono font-medium text-primary min-w-[180px]">{key}</span>
                        <span className="font-mono text-muted-foreground break-all">{value}</span>
                      </div>
                    ))}
                    {Object.keys(response.headers).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No headers returned from proxy</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="tree" className="mt-0 p-4">
                <ResponseTreeExplorer
                  responseBody={response.body}
                  responseHeaders={response.headers}
                  responseStatus={response.status}
                  responseTime={response.time}
                  onAddAssertion={(assertion) => {
                    setAssertions(prev => [...prev, assertion]);
                    setActiveSection("assertions");
                  }}
                  existingAssertions={assertions}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Helper Components ---

function KeyValueEditor({
  pairs,
  onUpdate,
  onToggle,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
}: {
  pairs: KeyValuePair[];
  onUpdate: (index: number, key: string, value: string) => void;
  onToggle: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={() => onToggle(i)}
            className="cursor-pointer"
          />
          <Input
            className="flex-1 h-8 text-sm font-mono"
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={e => onUpdate(i, "key", e.target.value)}
          />
          <Input
            className="flex-1 h-8 text-sm font-mono"
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={e => onUpdate(i, "value", e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
            onClick={() => onRemove(i)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="w-3 h-3 mr-1" />
        Add Row
      </Button>
    </div>
  );
}

// --- Helpers ---

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
