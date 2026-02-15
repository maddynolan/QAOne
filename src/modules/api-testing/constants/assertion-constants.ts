/**
 * Assertion type and operator constants for inline assertion builder in EnhancedAPITesting.
 *
 * Note: The canonical assertion types/operators used by RequestBuilder, AssertionsPanel,
 * and RequestChainBuilder live in `../components/constants.ts`. These are the inline
 * definitions used by the EnhancedAPITesting page's own assertion UI (with emoji icons
 * instead of Lucide icon names).
 *
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

export const INLINE_ASSERTION_TYPES = [
  { value: "status_code", label: "Status Code", icon: "\u{1F522}", description: "Validate HTTP status code" },
  { value: "response_time", label: "Response Time", icon: "\u23F1\uFE0F", description: "Check response time (ms)" },
  { value: "jsonpath", label: "JSONPath", icon: "\u{1F4CD}", description: "Extract and validate JSON values" },
  { value: "schema", label: "JSON Schema", icon: "\u{1F4CB}", description: "Validate against JSON Schema" },
  { value: "contains", label: "Contains", icon: "\u{1F50D}", description: "Response contains text" },
  { value: "not_contains", label: "Not Contains", icon: "\u{1F6AB}", description: "Response doesn't contain text" },
  { value: "regex", label: "Regex Match", icon: "\u{1F3AF}", description: "Match regular expression" },
  { value: "header", label: "Header Value", icon: "\u{1F4E8}", description: "Validate response header" },
  { value: "equals", label: "Equals", icon: "\u2696\uFE0F", description: "Exact value match" },
  { value: "xpath", label: "XPath", icon: "\u{1F3F7}\uFE0F", description: "Extract and validate XML values" },
] as const;

export const INLINE_ASSERTION_OPERATORS = [
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
