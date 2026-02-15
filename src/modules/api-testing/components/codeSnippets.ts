/**
 * Zero-code: Generate code snippets from current request (Postman-style).
 * Used by Builder "Code" button — no scripts, just copy-paste for developers.
 */

import type { RequestConfig } from "./constants";

function escapeShell(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function escapeDouble(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/** Build final URL with query string from request */
export function buildUrlForSnippet(request: RequestConfig): string {
  let url = request.url.trim();
  const params = request.params.filter((p) => p.enabled && p.key.trim());
  if (params.length > 0) {
    const sep = url.includes("?") ? "&" : "?";
    url +=
      sep +
      params
        .map(
          (p) =>
            `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`
        )
        .join("&");
  }
  if (
    request.authType === "api_key" &&
    request.authApiKeyLocation === "query" &&
    request.authApiKeyName
  ) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}${encodeURIComponent(request.authApiKeyName)}=${encodeURIComponent(request.authApiKeyValue)}`;
  }
  return url;
}

/** Build headers object for snippets (no variable resolution; use as-is) */
export function buildHeadersForSnippet(request: RequestConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((h) => {
    if (h.enabled && h.key.trim()) headers[h.key.trim()] = h.value;
  });
  if (request.authType === "bearer" && request.authToken) {
    headers["Authorization"] = `Bearer ${request.authToken}`;
  } else if (request.authType === "basic" && request.authUsername) {
    headers["Authorization"] = `Basic ${btoa(`${request.authUsername}:${request.authPassword || ""}`)}`;
  } else if (
    request.authType === "api_key" &&
    request.authApiKeyName &&
    request.authApiKeyLocation === "header"
  ) {
    headers[request.authApiKeyName] = request.authApiKeyValue;
  }
  return headers;
}

export function generateCurl(request: RequestConfig): string {
  const url = buildUrlForSnippet(request);
  const headers = buildHeadersForSnippet(request);
  const method = request.method.toUpperCase();
  let out = `curl -X ${method} ${escapeShell(url)}`;
  Object.entries(headers).forEach(([k, v]) => {
    out += ` \\\n  -H ${escapeDouble(`${k}: ${v}`)}`;
  });
  if (
    request.bodyType !== "none" &&
    request.body.trim() &&
    ["POST", "PUT", "PATCH"].includes(method)
  ) {
    const body =
      request.bodyType === "json"
        ? request.body.replace(/\n/g, " ").trim()
        : request.body;
    out += ` \\\n  -d ${escapeDouble(body)}`;
  }
  return out;
}

export function generatePythonRequests(request: RequestConfig): string {
  const url = buildUrlForSnippet(request);
  const headers = buildHeadersForSnippet(request);
  const method = request.method.toLowerCase();
  const hasBody =
    request.bodyType !== "none" &&
    request.body.trim() &&
    ["post", "put", "patch"].includes(method);
  let out = `import requests\n\n`;
  out += `url = ${JSON.stringify(url)}\n`;
  out += `headers = ${JSON.stringify(headers, null, 2)}\n`;
  if (hasBody && request.bodyType === "json") {
    try {
      JSON.parse(request.body);
      out += `payload = ${request.body.trim()}\n`;
      out += `response = requests.${method}(url, headers=headers, json=payload)\n`;
    } catch {
      out += `payload = ${JSON.stringify(request.body)}\n`;
      out += `response = requests.${method}(url, headers=headers, data=payload)\n`;
    }
  } else if (hasBody) {
    out += `payload = ${JSON.stringify(request.body)}\n`;
    out += `response = requests.${method}(url, headers=headers, data=payload)\n`;
  } else {
    out += `response = requests.${method}(url, headers=headers)\n`;
  }
  out += `print(response.status_code)\nprint(response.text)\n`;
  return out;
}

export function generateNodeFetch(request: RequestConfig): string {
  const url = buildUrlForSnippet(request);
  const headers = buildHeadersForSnippet(request);
  const method = request.method.toUpperCase();
  const hasBody =
    request.bodyType !== "none" &&
    request.body.trim() &&
    ["POST", "PUT", "PATCH"].includes(method);
  let out = `fetch(${JSON.stringify(url)}, {\n  method: ${JSON.stringify(method)},\n  headers: ${JSON.stringify(headers, null, 2).split("\n").join("\n  ")}`;
  if (hasBody) {
    if (request.bodyType === "json") {
      try {
        JSON.parse(request.body);
        out += `,\n  body: JSON.stringify(${request.body.trim()})\n`;
      } catch {
        out += `,\n  body: ${JSON.stringify(request.body)}\n`;
      }
    } else {
      out += `,\n  body: ${JSON.stringify(request.body)}\n`;
    }
  } else {
    out += "\n";
  }
  out += `})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));\n`;
  return out;
}

export type SnippetLanguage = "curl" | "python" | "node";

export const SNIPPET_LABELS: { value: SnippetLanguage; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "python", label: "Python (requests)" },
  { value: "node", label: "Node (fetch)" },
];

export function generateSnippet(
  request: RequestConfig,
  lang: SnippetLanguage
): string {
  switch (lang) {
    case "curl":
      return generateCurl(request);
    case "python":
      return generatePythonRequests(request);
    case "node":
      return generateNodeFetch(request);
    default:
      return generateCurl(request);
  }
}
