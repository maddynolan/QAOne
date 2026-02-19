/**
 * Pure utility functions for RequestBuilder component.
 * These functions have no React dependencies and no side effects.
 */

/** Resolve a simple JSONPath (e.g. $[4].title or $.data.items[0]) to a value; supports arrays and objects. */
export function jsonPathValue(obj: any, path: string): unknown {
  if (obj == null) return undefined;
  let s = path.replace(/^\$\.?/, "").trim();
  if (!s) return obj;
  // Explicit support for $.length on arrays/strings/objects
  if (s === "length") {
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj === "string") return obj.length;
    if (obj && typeof obj === "object") return Object.keys(obj).length;
    return undefined;
  }
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

export function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Compare two JSON objects and return a list of changes (added/removed/changed fields) */
export function diffJson(baseline: any, current: any, path: string = "$"): Array<{ path: string; type: "added" | "removed" | "changed"; oldVal?: any; newVal?: any }> {
  const diffs: Array<{ path: string; type: "added" | "removed" | "changed"; oldVal?: any; newVal?: any }> = [];
  if (baseline === current) return diffs;
  if (baseline == null && current != null) return [{ path, type: "added", newVal: current }];
  if (baseline != null && current == null) return [{ path, type: "removed", oldVal: baseline }];
  if (typeof baseline !== typeof current) return [{ path, type: "changed", oldVal: baseline, newVal: current }];
  if (Array.isArray(baseline) && Array.isArray(current)) {
    if (baseline.length !== current.length) diffs.push({ path: `${path}.length`, type: "changed", oldVal: baseline.length, newVal: current.length });
    const maxLen = Math.max(baseline.length, current.length);
    for (let i = 0; i < Math.min(maxLen, 20); i++) { // cap at 20 items
      if (i >= baseline.length) diffs.push({ path: `${path}[${i}]`, type: "added", newVal: current[i] });
      else if (i >= current.length) diffs.push({ path: `${path}[${i}]`, type: "removed", oldVal: baseline[i] });
      else diffs.push(...diffJson(baseline[i], current[i], `${path}[${i}]`));
    }
    return diffs;
  }
  if (typeof baseline === "object" && typeof current === "object") {
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(current)]);
    for (const key of allKeys) {
      if (!(key in baseline)) diffs.push({ path: `${path}.${key}`, type: "added", newVal: current[key] });
      else if (!(key in current)) diffs.push({ path: `${path}.${key}`, type: "removed", oldVal: baseline[key] });
      else diffs.push(...diffJson(baseline[key], current[key], `${path}.${key}`));
    }
    return diffs;
  }
  if (baseline !== current) diffs.push({ path, type: "changed", oldVal: baseline, newVal: current });
  return diffs;
}

/** Generate a JSON Schema from an actual JSON value (for contract assertions) */
export function generateJsonSchema(value: any): any {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return { type: "array", items: value.length > 0 ? generateJsonSchema(value[0]) : {} };
  }
  if (typeof value === "object") {
    const props: Record<string, any> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(value)) {
      props[k] = generateJsonSchema(v);
      if (v !== null && v !== undefined) required.push(k);
    }
    return { type: "object", properties: props, required };
  }
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

export function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-600 bg-green-500/10 border-green-500/30";
  if (status >= 300 && status < 400) return "text-blue-600 bg-blue-500/10 border-blue-500/30";
  if (status >= 400 && status < 500) return "text-amber-600 bg-amber-500/10 border-amber-500/30";
  return "text-red-600 bg-red-500/10 border-red-500/30";
}
