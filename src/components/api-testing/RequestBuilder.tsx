/**
 * RequestBuilder - Postman-style ad-hoc API request builder.
 * Lets a regular tester type a URL, pick method, set headers/body/auth,
 * send the request, and see the full response with syntax highlighting.
 */

import { useState, useCallback, useEffect, useRef } from "react";
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
  Send, Plus, Trash2, Loader2, Copy, Save, Clock, History, Code,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import AssertionsPanel from "./AssertionsPanel";
import { generateSnippet, SNIPPET_LABELS } from "./codeSnippets";
import ResponseTreeExplorer from "./ResponseTreeExplorer";
import { useToast } from "@/hooks/use-toast";
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

/** Resolve a simple JSONPath (e.g. $[4].title or $.data.items[0]) to a value; supports arrays and objects. */
function jsonPathValue(obj: any, path: string): unknown {
  if (obj == null) return undefined;
  let s = path.replace(/^\$\.?/, "").trim();
  if (!s) return obj;
  let current: any = obj;
  const tokens: string[] = [];
  for (let i = 0; i < s.length; ) {
    if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end === -1) break;
      tokens.push(s.slice(i, end + 1));
      i = end + 1;
    } else if (s[i] === ".") {
      i++;
      const next = s[i];
      if (next === "[" || next === undefined) continue;
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_$]/.test(s[j])) j++;
      tokens.push(s.slice(i, j));
      i = j;
    } else {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_$]/.test(s[j])) j++;
      tokens.push(s.slice(i, j));
      i = j;
    }
  }
  for (const t of tokens) {
    if (current == null) return undefined;
    if (t.startsWith("[") && t.endsWith("]")) {
      const idx = parseInt(t.slice(1, -1), 10);
      if (Number.isNaN(idx)) continue;
      current = current[idx];
    } else {
      current = current[t];
    }
  }
  return current;
}

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
  /** When loading a test case from the collection, pass its assertions so they can be edited */
  assertions?: Array<{ id?: string; type?: string; name?: string; expected?: string; path?: string; operator?: string; schema?: string }>;
  /** When set, "Add to Tests" will update this test case in the collection instead of adding new */
  editingTestCaseId?: string;
}

interface RequestBuilderProps {
  onSaveToChain?: (request: RequestConfig, assertions: AssertionConfig[]) => void;
  onAddToTestSuite?: (testCase: any) => void;
  initialRequest?: InitialRequestData | null;
  activeEnvironment?: EnvironmentConfig | null;
  /** Tier 2: global variables (resolve order: global → env → collection → saved from response) */
  globalVariables?: Record<string, string>;
  collectionVariables?: Record<string, string>;
}

export default function RequestBuilder({ onSaveToChain, onAddToTestSuite, initialRequest, activeEnvironment, globalVariables = {}, collectionVariables = {} }: RequestBuilderProps) {
  const { toast } = useToast();
  const [request, setRequest] = useState<RequestConfig>(createEmptyRequest());
  const [assertions, setAssertions] = useState<AssertionConfig[]>([]);
  const [assertionResults, setAssertionResults] = useState<Array<{ passed: boolean; message: string }>>([]);
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("params");
  const [responseTab, setResponseTab] = useState("body");
  // Console: last request/response for inspection (zero-code)
  const [lastRequest, setLastRequest] = useState<{ method: string; url: string; headers: Record<string, string>; body: string } | null>(null);
  // Cookie jar: domain -> list of { name, value } (zero-code; from Set-Cookie, sent as Cookie header)
  const [cookieJar, setCookieJar] = useState<Record<string, Array<{ name: string; value: string }>>>(() => {
    try {
      const raw = localStorage.getItem("api_cookie_jar");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("api_cookie_jar", JSON.stringify(cookieJar));
    } catch {}
  }, [cookieJar]);

  // --- Load initial request when prop changes (e.g. from collection test case click) ---
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
      if (initialRequest.assertions && Array.isArray(initialRequest.assertions) && initialRequest.assertions.length > 0) {
        const normalized: AssertionConfig[] = initialRequest.assertions.map((a: any, i: number) => ({
          id: a.id || generateId(),
          type: a.type || "status_code",
          name: a.name || `${a.type || "assertion"} ${i + 1}`,
          expected: a.expected != null ? String(a.expected) : "",
          path: a.path != null ? String(a.path) : "",
          operator: a.operator != null ? String(a.operator) : "equals",
          schema: a.schema != null ? (typeof a.schema === "string" ? a.schema : JSON.stringify(a.schema)) : "",
        }));
        setAssertions(normalized);
      } else {
        setAssertions([]);
      }
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

  // Request history (zero-code: no scripts — just log and replay)
  const HISTORY_KEY = "api_request_history";
  const HISTORY_MAX = 100;
  const [requestHistory, setRequestHistory] = useState<Array<{ id: string; method: string; url: string; timestamp: string; name?: string }>>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const pushHistory = useCallback((method: string, url: string) => {
    const entry = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      method,
      url,
      timestamp: new Date().toISOString(),
    };
    setRequestHistory((prev) => {
      const next = [entry, ...prev.filter((h) => !(h.method === method && h.url === url))].slice(0, HISTORY_MAX);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const loadFromHistory = useCallback((entry: { method: string; url: string }) => {
    setRequest((prev) => ({ ...prev, method: entry.method, url: entry.url }));
    setShowHistory(false);
  }, []);

  // OAuth2: list configs and get token (zero-code — no scripts)
  const [oauth2Configs, setOauth2Configs] = useState<Array<{ config_id: string; name: string; grant_type: string }>>([]);
  const [oauth2ConfigId, setOauth2ConfigId] = useState("");
  const [oauth2Loading, setOauth2Loading] = useState(false);
  const [oauth2Error, setOauth2Error] = useState<string | null>(null);
  useEffect(() => {
    if (request.authType !== "oauth2") return;
    fetch(`${API_BASE_URL}/api/oauth2/configs`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.configs?.length) setOauth2Configs(data.configs);
      })
      .catch(() => setOauth2Configs([]));
  }, [request.authType]);

  // Saved from response (zero-code): store node values for use as {{name}} in next request
  const [savedFromResponse, setSavedFromResponse] = useState<Record<string, unknown>>({});

  // Before request (zero-code): set variables before send — Static, $timestamp, $randomUUID, etc.
  type BeforeRequestVarType = "static" | "$timestamp" | "$randomUUID" | "$randomInt" | "$randomEmail" | "$randomFullName";
  const BEFORE_REQUEST_TYPES: { value: BeforeRequestVarType; label: string }[] = [
    { value: "static", label: "Static value" },
    { value: "$timestamp", label: "$timestamp" },
    { value: "$randomUUID", label: "$randomUUID" },
    { value: "$randomInt", label: "$randomInt" },
    { value: "$randomEmail", label: "$randomEmail" },
    { value: "$randomFullName", label: "$randomFullName" },
  ];
  const [beforeRequestVars, setBeforeRequestVars] = useState<Array<{ id: string; variableName: string; type: BeforeRequestVarType; staticValue?: string }>>([]);
  const preRequestComputedRef = useRef<Record<string, string>>({});
  const computePreRequestVars = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    beforeRequestVars.forEach((row) => {
      if (!row.variableName.trim()) return;
      const key = row.variableName.trim();
      switch (row.type) {
        case "static":
          out[key] = row.staticValue ?? "";
          break;
        case "$timestamp":
          out[key] = String(Date.now());
          break;
        case "$randomUUID":
          out[key] = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          break;
        case "$randomInt":
          out[key] = String(Math.floor(Math.random() * 1e9));
          break;
        case "$randomEmail":
          out[key] = `user-${Date.now()}@example.com`;
          break;
        case "$randomFullName":
          out[key] = `User ${Math.random().toString(36).slice(2, 8)}`;
          break;
        default:
          out[key] = "";
      }
    });
    return out;
  }, [beforeRequestVars]);
  const addBeforeRequestVar = useCallback(() => {
    setBeforeRequestVars((prev) => [...prev, { id: generateId(), variableName: "", type: "static", staticValue: "" }]);
  }, []);
  const updateBeforeRequestVar = useCallback((id: string, patch: Partial<{ variableName: string; type: BeforeRequestVarType; staticValue: string }>) => {
    setBeforeRequestVars((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const removeBeforeRequestVar = useCallback((id: string) => {
    setBeforeRequestVars((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const extraVarsForResolve = useCallback((): { global: Record<string, string>; collection: Record<string, string>; local: Record<string, string> } => {
    const local: Record<string, string> = {};
    Object.entries(savedFromResponse).forEach(([k, v]) => {
      local[k] = v === null || v === undefined ? "" : String(v);
    });
    Object.entries(preRequestComputedRef.current).forEach(([k, v]) => {
      local[k] = v;
    });
    return { global: globalVariables, collection: collectionVariables, local };
  }, [globalVariables, collectionVariables, savedFromResponse]);

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
      headers["Authorization"] = `Bearer ${resolveVariables(request.authToken, activeEnvironment || null, extraVarsForResolve())}`;
    } else if (request.authType === "basic" && request.authUsername) {
      const user = resolveVariables(request.authUsername, activeEnvironment || null, extraVarsForResolve());
      const pass = resolveVariables(request.authPassword, activeEnvironment || null, extraVarsForResolve());
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
    // Cookie jar: add Cookie header when request host matches stored cookies
    try {
      const resolvedUrl = resolveVariables(request.url.trim(), activeEnvironment || null, extraVarsForResolve());
      if (resolvedUrl) {
        const host = new URL(resolvedUrl, "http://localhost").hostname;
        const cookies = cookieJar[host];
        if (cookies?.length) {
          headers["Cookie"] = cookies.map((c) => `${encodeURIComponent(c.name)}=${encodeURIComponent(c.value)}`).join("; ");
        }
      }
    } catch {}
    return headers;
  }, [request, activeEnvironment, extraVarsForResolve, cookieJar]);

  // --- Build URL with query params and variable resolution ---
  const buildUrl = useCallback((): string => {
    let url = request.url.trim();
    if (!url) return url;
    // Resolve environment variables in URL
    url = resolveVariables(url, activeEnvironment || null, extraVarsForResolve());
    const params = request.params.filter(p => p.enabled && p.key.trim());
    if (params.length > 0) {
      const sep = url.includes("?") ? "&" : "?";
      url += sep + params.map(p => {
        const key = resolveVariables(p.key, activeEnvironment || null, extraVarsForResolve());
        const val = resolveVariables(p.value, activeEnvironment || null, extraVarsForResolve());
        return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      }).join("&");
    }
    if (request.authType === "api_key" && request.authApiKeyLocation === "query" && request.authApiKeyName) {
      const sep = url.includes("?") ? "&" : "?";
      const keyName = resolveVariables(request.authApiKeyName, activeEnvironment || null, extraVarsForResolve());
      const keyVal = resolveVariables(request.authApiKeyValue, activeEnvironment || null, extraVarsForResolve());
      url += `${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(keyVal)}`;
    }
    return url;
  }, [request, activeEnvironment, extraVarsForResolve]);

  // Check for unresolved variables in URL
  const unresolvedVars = request.url ? hasUnresolvedVariables(request.url) : [];

  // --- Send the request ---
  const handleSend = async () => {
    // Compute before-request variables so {{var}} in URL/headers/body resolve correctly
    preRequestComputedRef.current = computePreRequestVars();
    const url = buildUrl();
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    const sentHeaders = buildHeaders();
    const sentBody = request.bodyType !== "none" && request.body.trim()
      ? resolveVariables(request.body, activeEnvironment || null, extraVarsForResolve())
      : "";

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
                  headers: sentHeaders,
                  body: request.bodyType !== "none" && request.body.trim()
                    ? tryParseJSON(sentBody)
                    : undefined,
                  query: Object.fromEntries(
                    request.params.filter(p => p.enabled && p.key.trim()).map(p => [p.key, p.value])
                  ),
                },
                expected_status: (() => {
                  const statusAssertion = assertions.find(a => a.type === "status_code");
                  if (statusAssertion) return parseInt(String(statusAssertion.expected), 10) || 200;
                  return request.method === "POST" ? 201 : 200;
                })(),
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
      // Accept actual_status OR status_code OR http_status as the HTTP status indicator
      const httpStatus = testResult?.actual_status ?? testResult?.status_code ?? testResult?.http_status;
      
      if (testResult && httpStatus) {
        // SUCCESS PATH: backend made the HTTP request and returned full details
        const responseBody = testResult.response_body ?? testResult.response_data;
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
        setLastRequest({ method: request.method, url, headers: sentHeaders, body: sentBody });
        pushHistory(request.method, url);

        // Cookie jar: parse Set-Cookie from response and store by host
        const respHeaders = testResult.response_headers || {};
        const setCookieRaw = respHeaders["set-cookie"] ?? respHeaders["Set-Cookie"];
        if (setCookieRaw) {
          const arr = Array.isArray(setCookieRaw) ? setCookieRaw : [setCookieRaw];
          let host = "";
          try {
            host = new URL(url, "http://localhost").hostname;
          } catch {}
          if (host) {
            const newCookies: Array<{ name: string; value: string }> = [];
            for (const raw of arr) {
              const part = String(raw).split(";")[0].trim();
              const eq = part.indexOf("=");
              if (eq > 0) {
                newCookies.push({ name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() });
              }
            }
            if (newCookies.length) {
              setCookieJar((prev) => {
                const existing = prev[host] || [];
                const byName = new Map(existing.map((c) => [c.name, c]));
                newCookies.forEach((c) => byName.set(c.name, c));
                return { ...prev, [host]: [...byName.values()] };
              });
            }
          }
        }

        // Extract assertion results: prefer backend results (assertions.results), else build client-side
        const backendResults = testResult.assertion_results ?? testResult.assertions?.results;
        if (Array.isArray(backendResults) && backendResults.length > 0) {
          setAssertionResults(backendResults.map((r: any) => ({
            passed: !!r.passed,
            message: r.message ?? (r.actual !== undefined || r.expected !== undefined
              ? `expected ${r.expected ?? "—"}, got ${r.actual ?? "—"}`
              : r.error ?? "Assertion failed"),
          })));
        } else {
          // Build assertion results client-side (with correct JSONPath for arrays)
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
              try {
                const bodyObj = typeof responseBody === "string" ? JSON.parse(responseBody) : responseBody;
                const val = jsonPathValue(bodyObj, a.path);
                const actual = val === undefined || val === null ? "undefined" : String(val);
                const passed = a.operator === "exists" ? val !== undefined && val !== null
                  : a.operator === "not_exists" ? val === undefined || val === null
                  : a.operator === "contains" ? actual.includes(a.expected)
                  : actual === (a.expected ?? "");
                results.push({
                  passed,
                  message: `JSONPath "${a.path}": ${passed ? "passed" : `expected "${a.expected ?? ""}", got "${actual}"`}`,
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
      } else if (testResult && testResult.error) {
        // ERROR PATH: backend failed to make the HTTP request (invalid URL, network error, etc.)
        const errorMsg = String(testResult.error);
        const isUrlError = errorMsg.includes("URL") || errorMsg.includes("host") || !url.startsWith("http");
        setResponse({
          status: 0,
          statusText: isUrlError ? "Invalid URL" : "Request Failed",
          headers: {},
          body: isUrlError
            ? `Error: The URL "${url}" is not a valid HTTP URL.\n\nThe request path needs a base URL. Please either:\n1. Set a base URL in the Environment settings (Env tab)\n2. Enter the full URL (e.g., https://api.example.com${url.startsWith('/') ? url : '/' + url})\n\nBackend error: ${errorMsg}`
            : `Request failed: ${errorMsg}`,
          time: Math.round(testResult.response_time_ms || elapsed),
          size: 0,
        });
        setError(isUrlError
          ? `Invalid URL: "${url}" — set a base URL in Environment settings or enter the full URL`
          : `Request failed: ${errorMsg}`
        );
        pushHistory(request.method, url);
      } else {
        // FALLBACK: unexpected response format — show raw but with correct status
        setResponse({
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: Object.fromEntries(proxyResponse.headers.entries()),
          body: JSON.stringify(data, null, 2),
          time: elapsed,
          size: 0,
        });
        pushHistory(request.method, url);
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
      const pathOnly = url ? (url.replace(/^https?:\/\/[^/]+/, "") || "/") : "/";
      onAddToTestSuite({
        test_case_id: (initialRequest as any)?.editingTestCaseId || `builder_${saved.id}`,
        editingTestCaseId: (initialRequest as any)?.editingTestCaseId,
        title: saved.name,  // Use the user-provided name, NOT the endpoint path
        description: `Custom test: ${request.method} ${url}`,
        method: request.method,
        path: pathOnly,
        endpoint: pathOnly,
        expected_status: (() => {
          const sa = assertions.find(a => a.type === "status_code");
          if (sa) return parseInt(String(sa.expected), 10) || 200;
          return request.method === "POST" ? 201 : 200;
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

      {/* Request History (zero-code: no scripts — replay from list) */}
      {showHistory && (
        <Card className="border-muted">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Request History</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>Close</Button>
            </div>
            <Input
              placeholder="Search method or URL..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="mt-2 h-8 text-sm"
            />
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-56">
              <div className="space-y-1">
                {requestHistory
                  .filter((h) => {
                    const q = historySearch.trim().toLowerCase();
                    if (!q) return true;
                    return h.method.toLowerCase().includes(q) || h.url.toLowerCase().includes(q);
                  })
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0"
                      onClick={() => loadFromHistory(entry)}
                    >
                      <Badge variant="outline" className={`text-xs flex-shrink-0 ${getMethodColor(entry.method)}`}>
                        {entry.method}
                      </Badge>
                      <span className="text-xs font-mono truncate flex-1" title={entry.url}>{entry.url}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
              {requestHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No history yet. Send a request to record it.</p>
              )}
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Generate code snippet">
                  <Code className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Copy as</DropdownMenuLabel>
                {SNIPPET_LABELS.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => {
                      const snippet = generateSnippet(request, value);
                      navigator.clipboard.writeText(snippet);
                      toast({ title: "Copied", description: `${label} snippet copied to clipboard` });
                    }}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              title="Request history"
            >
              <History className="w-4 h-4" />
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
                  const pathOnly = url.replace(/^https?:\/\/[^/]+/, "") || "/";
                  const isEditing = !!(initialRequest as any)?.editingTestCaseId;
                  const defaultName = isEditing && initialRequest ? (initialRequest as any).title : `${request.method} ${pathOnly}`;
                  const userTitle = prompt(isEditing ? "Edit test case name:" : "Enter a name for this test case:", defaultName || `${request.method} ${pathOnly}`);
                  if (!userTitle) return; // cancelled
                  onAddToTestSuite({
                    test_case_id: (initialRequest as any)?.editingTestCaseId || `builder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    editingTestCaseId: (initialRequest as any)?.editingTestCaseId,
                    title: userTitle.trim(),
                    description: `Custom test: ${request.method} ${url}`,
                    method: request.method,
                    path: pathOnly,
                    endpoint: pathOnly,
                    expected_status: (() => {
                      const statusAssertion = assertions.find(a => a.type === "status_code");
                      if (statusAssertion) return parseInt(statusAssertion.expected) || 200;
                      return request.method === "POST" ? 201 : 200;
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
                title={(initialRequest as any)?.editingTestCaseId ? "Update this test case in the collection" : "Add this request as a test case to the Execute tab and Tests page"}
                className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                {(initialRequest as any)?.editingTestCaseId ? "Update test" : "Add to Tests"}
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
              <TabsTrigger value="before" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Before request
                {beforeRequestVars.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">{beforeRequestVars.length}</Badge>
                )}
              </TabsTrigger>
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
              <TabsTrigger value="cookies" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                Cookies
                {Object.keys(cookieJar).length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {Object.keys(cookieJar).length}
                  </Badge>
                )}
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

            {/* Before request — set variables before send (zero-code) */}
            <TabsContent value="before" className="p-4 mt-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Set variables before sending. Use <code className="text-xs bg-muted px-1 rounded">{`{{variableName}}`}</code> in URL, headers, or body.
              </p>
              <div className="space-y-2">
                {beforeRequestVars.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2 p-2 rounded border bg-muted/30">
                    <Input
                      placeholder="Variable name"
                      value={row.variableName}
                      onChange={(e) => updateBeforeRequestVar(row.id, { variableName: e.target.value })}
                      className="w-32 font-mono text-sm"
                    />
                    <Select
                      value={row.type}
                      onValueChange={(v) => updateBeforeRequestVar(row.id, { type: v as BeforeRequestVarType })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BEFORE_REQUEST_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {row.type === "static" && (
                      <Input
                        placeholder="Value"
                        value={row.staticValue ?? ""}
                        onChange={(e) => updateBeforeRequestVar(row.id, { staticValue: e.target.value })}
                        className="flex-1 min-w-[120px]"
                      />
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeBeforeRequestVar(row.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addBeforeRequestVar}>
                <Plus className="w-4 h-4 mr-2" />
                Set variable
              </Button>
            </TabsContent>

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

            {/* Cookies — view/edit jar; sent automatically when host matches */}
            <TabsContent value="cookies" className="p-4 mt-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Cookies from <code className="text-xs bg-muted px-1 rounded">Set-Cookie</code> are stored by domain and sent on matching requests.
              </p>
              {Object.entries(cookieJar).length === 0 ? (
                <p className="text-sm text-muted-foreground">No cookies stored. Send a request that returns Set-Cookie to populate.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cookieJar).map(([domain, cookies]) => (
                    <div key={domain} className="rounded border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{domain}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 h-7"
                          onClick={() => setCookieJar((prev) => { const next = { ...prev }; delete next[domain]; return next; })}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear domain
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {cookies.map((c, i) => (
                          <div key={`${c.name}-${i}`} className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-muted-foreground">{c.name}</span>
                            <span className="flex-1 truncate font-mono">{c.value}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => setCookieJar((prev) => ({
                                ...prev,
                                [domain]: (prev[domain] || []).filter((_, j) => j !== i),
                              }))}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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

              {request.authType === "oauth2" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select an OAuth2 config and get a token. The token will be set as Bearer for this request (no scripts).
                  </p>
                  <div className="space-y-2">
                    <Label>OAuth2 Config</Label>
                    <Select
                      value={oauth2ConfigId}
                      onValueChange={(v) => { setOauth2ConfigId(v); setOauth2Error(null); }}
                    >
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue placeholder="Select a config..." />
                      </SelectTrigger>
                      <SelectContent>
                        {oauth2Configs.map((c) => (
                          <SelectItem key={c.config_id} value={c.config_id}>
                            {c.name} ({c.grant_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    disabled={!oauth2ConfigId || oauth2Loading}
                    onClick={async () => {
                      if (!oauth2ConfigId) return;
                      setOauth2Loading(true);
                      setOauth2Error(null);
                      try {
                        const r = await fetch(`${API_BASE_URL}/api/oauth2/headers/${oauth2ConfigId}`);
                        const data = await r.json();
                        if (!r.ok) throw new Error(data.detail || "Failed to get token");
                        const authHeader = data?.headers?.Authorization;
                        if (!authHeader || typeof authHeader !== "string") throw new Error("No Authorization header");
                        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
                        setRequest((prev) => ({ ...prev, authType: "bearer", authToken: token }));
                        toast({ title: "Token set", description: "OAuth2 token applied as Bearer. Send the request to use it." });
                      } catch (err: any) {
                        setOauth2Error(err.message || "Failed to get token");
                        toast({ title: "OAuth2 error", description: err.message, variant: "destructive" });
                      } finally {
                        setOauth2Loading(false);
                      }
                    }}
                  >
                    {oauth2Loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Get token and use as Bearer
                  </Button>
                  {oauth2Error && (
                    <p className="text-sm text-destructive">{oauth2Error}</p>
                  )}
                  {oauth2Configs.length === 0 && (
                    <p className="text-xs text-muted-foreground">No OAuth2 configs yet. Create one via API: POST /api/oauth2/configs</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Assertions */}
            <TabsContent value="assertions" className="p-4 mt-0">
              <AssertionsPanel assertions={assertions} onChange={setAssertions} results={assertionResults.length > 0 ? assertionResults : undefined} currentResponseBody={response?.body} />
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
                <TabsTrigger value="console" className="rounded-b-none">Console</TabsTrigger>
                <TabsTrigger value="tree" className="rounded-b-none text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Assert Builder
                </TabsTrigger>
              </TabsList>

              <TabsContent value="console" className="mt-0 p-4 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Last request</h4>
                  {lastRequest ? (
                    <div className="rounded border bg-muted/30 p-3 font-mono text-xs space-y-2">
                      <div><span className="text-primary font-semibold">{lastRequest.method}</span> {lastRequest.url}</div>
                      <div className="border-t pt-2">
                        {Object.entries(lastRequest.headers).map(([k, v]) => (
                          <div key={k} className="flex gap-2"><span className="text-muted-foreground">{k}:</span><span className="break-all">{v}</span></div>
                        ))}
                      </div>
                      {lastRequest.body && (
                        <pre className="mt-2 pt-2 border-t whitespace-pre-wrap break-words">{lastRequest.body}</pre>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Send a request to see it here.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Last response</h4>
                  {response && (
                    <div className="rounded border bg-muted/30 p-3 font-mono text-xs space-y-2">
                      <div><span className="text-primary font-semibold">{response.status}</span> {response.statusText} · {response.time}ms</div>
                      <div className="border-t pt-2">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div key={k} className="flex gap-2"><span className="text-muted-foreground">{k}:</span><span className="break-all">{v}</span></div>
                        ))}
                      </div>
                      <pre className="mt-2 pt-2 border-t whitespace-pre-wrap break-words max-h-48 overflow-auto">{formatResponseBody(response.body)}</pre>
                    </div>
                  )}
                </div>
              </TabsContent>

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
                  onSaveAsVariable={(name, _path, value) => {
                    setSavedFromResponse(prev => ({ ...prev, [name]: value }));
                    toast({ title: "Saved", description: `Use {{${name}}} in URL, headers, or body for the next request.` });
                  }}
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
