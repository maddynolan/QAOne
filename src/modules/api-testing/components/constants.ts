/**
 * Shared constants and types for the API Testing module.
 * Used by RequestBuilder, RequestChainBuilder, AssertionsPanel, and EnhancedAPITesting.
 */

import { API_BASE_URL as CENTRAL_API_URL } from "@/lib/api-config";
export const API_BASE_URL = CENTRAL_API_URL;

// --- HTTP Methods ---
export const HTTP_METHODS = [
  { value: "GET", label: "GET", color: "text-green-600 bg-green-500/10 border-green-500/30" },
  { value: "POST", label: "POST", color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  { value: "PUT", label: "PUT", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  { value: "PATCH", label: "PATCH", color: "text-orange-600 bg-orange-500/10 border-orange-500/30" },
  { value: "DELETE", label: "DELETE", color: "text-red-600 bg-red-500/10 border-red-500/30" },
  { value: "HEAD", label: "HEAD", color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  { value: "OPTIONS", label: "OPTIONS", color: "text-gray-600 bg-gray-500/10 border-gray-500/30" },
] as const;

export function getMethodColor(method: string): string {
  return HTTP_METHODS.find(m => m.value === method.toUpperCase())?.color || "text-gray-600 bg-gray-500/10 border-gray-500/30";
}

// --- Auth Types ---
export const AUTH_TYPES = [
  { value: "none", label: "No Auth" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "api_key", label: "API Key" },
  { value: "oauth2", label: "OAuth 2.0" },
] as const;

// --- Body Types ---
export const BODY_TYPES = [
  { value: "json", label: "JSON" },
  { value: "form", label: "Form URL" },
  { value: "multipart", label: "Multipart" },
  { value: "graphql", label: "GraphQL" },
  { value: "xml", label: "XML" },
  { value: "raw", label: "Raw Text" },
  { value: "binary", label: "Binary" },
  { value: "none", label: "None" },
] as const;

// --- Assertion Types ---
export const ASSERTION_TYPES = [
  { value: "status_code", label: "Status Code", icon: "HashIcon", description: "Validate HTTP status code" },
  { value: "response_time", label: "Response Time", icon: "ClockIcon", description: "Check response time (ms)" },
  { value: "jsonpath", label: "JSONPath", icon: "TargetIcon", description: "Extract and validate JSON values" },
  { value: "schema", label: "JSON Schema", icon: "FileTextIcon", description: "Validate against JSON Schema" },
  { value: "contains", label: "Contains", icon: "SearchIcon", description: "Response body contains text" },
  { value: "not_contains", label: "Not Contains", icon: "XIcon", description: "Response body doesn't contain text" },
  { value: "regex", label: "Regex Match", icon: "CodeIcon", description: "Match regular expression pattern" },
  { value: "header", label: "Header Value", icon: "MailIcon", description: "Validate response header" },
  { value: "equals", label: "Equals", icon: "EqualIcon", description: "Exact value match" },
  { value: "xpath", label: "XPath", icon: "TagIcon", description: "Extract and validate XML values" },
  { value: "matches_baseline", label: "Matches Baseline", icon: "EqualIcon", description: "Regression: compare response to saved baseline JSON" },
  { value: "database", label: "Database Query", icon: "DatabaseIcon", description: "Assert database state after API call" },
] as const;

// --- Database Assertion Operators ---
export const DB_ASSERTION_OPERATORS = [
  { value: "equals", label: "Result Equals" },
  { value: "contains", label: "Result Contains" },
  { value: "count", label: "Row Count Equals" },
  { value: "greater_than", label: "Row Count Greater Than" },
  { value: "less_than", label: "Row Count Less Than" },
  { value: "not_empty", label: "Not Empty" },
  { value: "is_empty", label: "Is Empty" },
  { value: "field_equals_response", label: "Field Equals Response JSONPath" },
  { value: "field_contains_response", label: "Field Contains Response Value" },
  { value: "row_matches_response", label: "Row Matches Response Object" },
] as const;

// --- Assertion Operators ---
export const ASSERTION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "matches_regex", label: "Matches Regex" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Not Exists" },
  { value: "length_equals", label: "Length Equals" },
  { value: "length_greater_than", label: "Length >" },
  { value: "length_less_than", label: "Length <" },
] as const;

// --- Extraction Methods (for request chaining) ---
export const EXTRACTION_METHODS = [
  { value: "jsonpath", label: "JSONPath", description: "Extract value from JSON response body" },
  { value: "regex", label: "Regex", description: "Extract using regular expression" },
  { value: "header", label: "Response Header", description: "Extract from response headers" },
  { value: "cookie", label: "Cookie", description: "Extract from response cookies" },
  { value: "status_code", label: "Status Code", description: "Capture HTTP status code" },
  { value: "response_time", label: "Response Time", description: "Capture response duration (ms)" },
] as const;

// --- Condition Operators (for request chaining) ---
export const CONDITION_OPERATORS = [
  { value: "if_equals", label: "If Equals" },
  { value: "if_not_equals", label: "If Not Equals" },
  { value: "if_contains", label: "If Contains" },
  { value: "if_greater_than", label: "If Greater Than" },
  { value: "if_less_than", label: "If Less Than" },
  { value: "if_exists", label: "If Exists" },
  { value: "if_not_exists", label: "If Not Exists" },
] as const;

// --- Types ---
export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestConfig {
  method: string;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  bodyType: string;
  body: string;
  authType: string;
  authToken: string;
  authUsername: string;
  authPassword: string;
  authApiKeyName: string;
  authApiKeyValue: string;
  authApiKeyLocation: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
  size: number;
}

export interface AssertionConfig {
  id: string;
  type: string;
  name: string;
  expected: string;
  path: string;
  operator: string;
  schema: string;
  // Database assertion fields
  db_connection_id?: string;
  db_query?: string;
  db_comparison?: string;
  // Cross-verify: compare DB field with API response JSONPath
  db_field?: string;
  response_jsonpath?: string;
}

export interface ExtractionConfig {
  id: string;
  name: string;
  method: string;
  expression: string;
  defaultValue: string;
}

export interface ConditionConfig {
  id: string;
  source: string;
  operator: string;
  expected: string;
  gotoStep: string;
  skipStep: string;
}

export interface ChainStep {
  id: string;
  name: string;
  request: RequestConfig;
  extractions: ExtractionConfig[];
  assertions: AssertionConfig[];
  conditions: ConditionConfig[];
  enabled: boolean;
  retryOnFailure: boolean;
  retryCount: number;
  delayBefore: number;
}

export interface ChainStepResult {
  step_id: string;
  step_name: string;
  status: string;
  status_code: number;
  response_time_ms: number;
  response_body: any;
  response_headers: Record<string, string>;
  extracted_values: Record<string, any>;
  assertion_results: Array<{ passed: boolean; message: string }>;
  error: string | null;
}

export interface ChainResult {
  chain_id: string;
  chain_name: string;
  status: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  total_duration_ms: number;
  step_results: ChainStepResult[];
  final_variables: Record<string, any>;
  start_time: string;
  end_time: string;
}

export function createEmptyRequest(): RequestConfig {
  return {
    method: "GET",
    url: "",
    headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
    params: [{ key: "", value: "", enabled: true }],
    bodyType: "json",
    body: "",
    authType: "none",
    authToken: "",
    authUsername: "",
    authPassword: "",
    authApiKeyName: "",
    authApiKeyValue: "",
    authApiKeyLocation: "header",
  };
}

export function createEmptyChainStep(stepNumber: number): ChainStep {
  return {
    id: `step_${Date.now()}_${stepNumber}`,
    name: `Step ${stepNumber}`,
    request: createEmptyRequest(),
    extractions: [],
    assertions: [],
    conditions: [],
    enabled: true,
    retryOnFailure: false,
    retryCount: 3,
    delayBefore: 0,
  };
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// --- cURL Parser ---

/** Tokenize a cURL command string, handling single/double quotes and backslash escapes. */
function tokenizeCurl(raw: string): string[] {
  // Normalize line continuations (backslash + newline)
  const cmd = raw.replace(/\\\s*\n/g, " ").trim();
  const tokens: string[] = [];
  let i = 0;
  while (i < cmd.length) {
    // Skip whitespace
    if (/\s/.test(cmd[i])) { i++; continue; }
    let token = "";
    if (cmd[i] === "'" || cmd[i] === '"') {
      const quote = cmd[i];
      i++;
      while (i < cmd.length && cmd[i] !== quote) {
        if (cmd[i] === "\\" && quote === '"' && i + 1 < cmd.length) {
          i++;
          token += cmd[i];
        } else {
          token += cmd[i];
        }
        i++;
      }
      i++; // skip closing quote
    } else {
      while (i < cmd.length && !/\s/.test(cmd[i])) {
        if (cmd[i] === "\\" && i + 1 < cmd.length) {
          i++;
          token += cmd[i];
        } else {
          token += cmd[i];
        }
        i++;
      }
    }
    tokens.push(token);
  }
  return tokens;
}

/**
 * Parse a cURL command string into a RequestConfig.
 * Supports: -X, -H, -d, --data, --data-raw, --data-binary, -u, --user,
 * --header, -A, --user-agent, --compressed, -b, --cookie
 */
export function parseCurlCommand(curlStr: string): RequestConfig {
  const result = createEmptyRequest();
  const tokens = tokenizeCurl(curlStr);

  // Remove leading "curl" if present
  let idx = 0;
  if (tokens[idx]?.toLowerCase() === "curl") idx++;

  let explicitMethod = false;
  const headers: KeyValuePair[] = [];

  while (idx < tokens.length) {
    const t = tokens[idx];

    if (t === "-X" || t === "--request") {
      idx++;
      result.method = (tokens[idx] || "GET").toUpperCase();
      explicitMethod = true;
    } else if (t === "-H" || t === "--header") {
      idx++;
      const hdr = tokens[idx] || "";
      const colonIdx = hdr.indexOf(":");
      if (colonIdx > 0) {
        const key = hdr.slice(0, colonIdx).trim();
        const val = hdr.slice(colonIdx + 1).trim();
        // Handle Authorization header
        if (key.toLowerCase() === "authorization") {
          if (val.toLowerCase().startsWith("bearer ")) {
            result.authType = "bearer";
            result.authToken = val.slice(7).trim();
          } else if (val.toLowerCase().startsWith("basic ")) {
            result.authType = "basic";
            try {
              const decoded = atob(val.slice(6).trim());
              const sepIdx = decoded.indexOf(":");
              if (sepIdx > 0) {
                result.authUsername = decoded.slice(0, sepIdx);
                result.authPassword = decoded.slice(sepIdx + 1);
              }
            } catch { /* not valid base64 */ }
          } else {
            headers.push({ key, value: val, enabled: true });
          }
        } else {
          headers.push({ key, value: val, enabled: true });
        }
      }
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-urlencode") {
      idx++;
      result.body = tokens[idx] || "";
      if (!explicitMethod) result.method = "POST";
      // Auto-detect body type
      const trimmed = result.body.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        result.bodyType = "json";
      } else if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
        result.bodyType = "xml";
      } else if (t === "--data-urlencode" || (trimmed.includes("=") && !trimmed.includes("{"))) {
        result.bodyType = "form";
      } else {
        result.bodyType = "raw";
      }
    } else if (t === "-u" || t === "--user") {
      idx++;
      const userPass = tokens[idx] || "";
      const sepIdx = userPass.indexOf(":");
      if (sepIdx > 0) {
        result.authType = "basic";
        result.authUsername = userPass.slice(0, sepIdx);
        result.authPassword = userPass.slice(sepIdx + 1);
      }
    } else if (t === "-A" || t === "--user-agent") {
      idx++;
      headers.push({ key: "User-Agent", value: tokens[idx] || "", enabled: true });
    } else if (t === "-b" || t === "--cookie") {
      idx++;
      headers.push({ key: "Cookie", value: tokens[idx] || "", enabled: true });
    } else if (t === "--compressed" || t === "-k" || t === "--insecure" || t === "-s" || t === "--silent" || t === "-v" || t === "--verbose" || t === "-L" || t === "--location") {
      // Flags with no argument — skip
    } else if (t === "-o" || t === "--output" || t === "--connect-timeout" || t === "--max-time") {
      idx++; // skip the argument too
    } else if (!t.startsWith("-")) {
      // Bare URL
      result.url = t;
    }

    idx++;
  }

  // If no Content-Type header was explicitly set and we have a JSON body, add it
  const hasCT = headers.some(h => h.key.toLowerCase() === "content-type");
  if (!hasCT && result.bodyType === "json" && result.body) {
    headers.unshift({ key: "Content-Type", value: "application/json", enabled: true });
  } else if (!hasCT && result.bodyType === "form" && result.body) {
    headers.unshift({ key: "Content-Type", value: "application/x-www-form-urlencoded", enabled: true });
  }

  result.headers = headers.length > 0 ? headers : [{ key: "Content-Type", value: "application/json", enabled: true }];

  return result;
}
