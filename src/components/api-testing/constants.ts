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
  { value: "form", label: "Form Data" },
  { value: "xml", label: "XML" },
  { value: "raw", label: "Raw Text" },
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
