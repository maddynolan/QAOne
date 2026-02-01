# API Testing: Enterprise Guide

> Flowstral API testing vs Postman / ReadyAPI (SmartBear). Record flow, API tab features, and handling incomplete specs.

---

## 1. Record Flow: API Toggle

### What Happens When You Enable "API Testing" During Record

1. **Where it is**
   - In the **Record** tab, under the URL field.
   - Section: **"Also capture network traffic for:"**
   - Toggle: **"API Testing"** (and optionally "Load Testing").

2. **When you turn it ON**
   - The app starts **network capture** (desktop: `network-capture.js`, extension: same logic).
   - Every **HTTP/HTTPS** request and response (and optionally WebSocket) is recorded while you use the target site.
   - Captured data is stored in memory as a **HAR (HTTP Archive)**.

3. **When you stop recording**
   - You can **export HAR** (e.g. via IPC `network-capture-export-har`).
   - That HAR can be:
     - **Imported in the API tab** (e.g. via Import → HAR).
     - Used to generate **API test cases** or **collections** from real traffic.

4. **End-to-end flow**
   ```
   Record tab → Enable "API Testing" → Start Recording → Use the app →
   Stop Recording → Export HAR → API tab → Import HAR (or paste spec) →
   Generate/run tests, add assertions, environments, data-driven runs.
   ```

So: **API toggle = capture network traffic for later use in the API tab.** It does not switch the UI to the API tab; it only enables HAR capture for the current recording session.

---

## 2. API Tab: What You Have vs Postman / ReadyAPI

### 2.1 Comparison (High Level)

| Capability | Flowstral | Postman | ReadyAPI (SmartBear) |
|------------|-----------|---------|------------------------|
| **Import** | OpenAPI, Swagger, WSDL, Postman, GraphQL, HAR | OpenAPI, Postman, HAR | OpenAPI, WSDL, Postman, HAR |
| **Environments** | Base URL, variables, auth | Full envs + variables | Full envs + data sources |
| **Request chaining** | Property transfer, extract (JSONPath, headers, etc.) | Pre-request/Test scripts, variables | Property transfer, data sources |
| **Assertions** | Status, time, JSONPath, XPath, schema, regex, header, cookie | Script + snippets | GUI assertions + script |
| **Data-driven** | CSV, JSON, Excel, inline + new APIs | CSV, JSON | CSV, Excel, DB, internal generators |
| **OpenAPI incomplete** | Validate + suggest + auto-fix + infer schema from response | Manual | Manual / schema validation |
| **Security** | OWASP API Top 10 scan | Limited | Security scan |
| **Mock / virtual** | Service virtualization module | Mock server | ReadyAPI Virtualization |
| **Reports** | HTML, JUnit, JSON, Allure, Postman, OpenAPI, HAR | Built-in + Newman | Built-in, CI reports |
| **Execution** | Manual, automated, scheduled, CI/CD, load | Collection runner, CLI, schedule | Test suites, CI, load |

### 2.2 Features That Match or Go Beyond

- **Multi-protocol**: REST, SOAP, GraphQL (gRPC/Kafka/MQTT in engine for generation).
- **Assertions**: status_code, response_time, contains, jsonpath, xpath, schema, regex, header, cookie, database.
- **Environments**: dev/staging/prod, variables, auth (Bearer, OAuth2, API key, etc.).
- **Request chaining**: extract from response (JSONPath, regex, headers), use in next request (`${var}`).
- **Security**: OWASP API Top 10 (e.g. BOLA, auth, mass assignment, resource consumption, SSRF, misconfig, inventory).
- **Reports**: JUnit XML, HTML, JSON, Allure, plus export to Postman collection, OpenAPI skeleton, HAR.
- **Data-driven (new)**:
  - **Data sources**: CSV, JSON (with optional `data_path`), Excel, inline rows.
  - **Variable substitution**: `{{var}}` / `${var}` in URL, headers, body.
  - **Iteration**: run same test suite per row; filter, sample, shuffle.
  - **APIs**: `POST /api/v2/testing/data-driven/source`, `GET .../source/{id}/preview`, `POST .../data-driven/execute`.
- **OpenAPI quality (new)**:
  - **Validate**: `POST /api/v2/testing/openapi/validate` → errors, warnings, info, hints, optional auto-fixes.
  - **Infer schema**: `POST /api/v2/testing/openapi/infer-schema` → build schema from real response when spec is missing/incomplete.

---

## 3. Handling Incomplete or Bad OpenAPI Specs

### 3.1 Typical Problems

- Missing or empty **requestBody** / **responses** / **schemas**.
- Path params in URL but not in **parameters**.
- No **operationId**, **summary**, or **description**.
- No **examples** or **example**.
- No **servers** or **info**.
- Only success (200) documented, no 4xx/5xx.

### 3.2 What Flowstral Does

1. **Validation**
   - Call **`POST /api/v2/testing/openapi/validate`** with your spec.
   - You get a list of issues with severity: **error**, **warning**, **info**, **hint**.
   - Each issue can have a **suggestion** and, where possible, **auto_fix** (e.g. add missing operationId, requestBody skeleton).

2. **Auto-fix (optional)**
   - In the same request, set **`apply_auto_fixes: true`**.
   - Response includes **`fixed_spec`** and **`applied_fixes`**.
   - Use **`fixed_spec`** for import/generate so incomplete specs still produce tests.

3. **Schema inference when spec is missing**
   - After calling an API, take the **response body** (JSON).
   - Call **`POST /api/v2/testing/openapi/infer-schema`** with **`response_data`**.
   - Use the returned **schema** to fill missing `requestBody`/`responses` in your spec or in the UI.

4. **Import behavior**
   - Parser normalizes OpenAPI/Postman/WSDL/GraphQL/HAR.
   - If something is missing (e.g. no schema), you can still generate tests and then refine with validation + inference.

So: **incomplete OpenAPI is handled by validate + optional auto-fix + infer-schema from real responses**, so you can still run full API tests.

---

## 4. New Backend Endpoints (Quick Reference)

| Method | Path | Purpose |
|--------|------|--------|
| POST | `/api/v2/testing/openapi/validate` | Validate spec, return issues; optional `apply_auto_fixes` |
| POST | `/api/v2/testing/openapi/infer-schema` | Infer JSON schema from response body |
| POST | `/api/v2/testing/data-driven/source` | Create data source (csv/json/inline) |
| GET | `/api/v2/testing/data-driven/source/{id}/preview` | Preview rows |
| POST | `/api/v2/testing/data-driven/execute` | Run test suite with data-driven iterations |

---

## 5. API Tab: Suggested UX Flow

1. **From record**
   - Record with **API Testing** toggle ON → export HAR → in API tab: **Import → HAR** → generate tests.

2. **From spec**
   - **Import → OpenAPI/Postman/GraphQL/WSDL** (paste or file).
   - Optionally: **Validate** (and apply auto-fixes) → then **Generate tests**.

3. **When spec is incomplete**
   - Validate → fix critical errors (or apply auto-fixes).
   - Run a request manually (or from a quick test), take response → **Infer schema** → attach to operation.
   - Re-validate and generate.

4. **Data-driven**
   - Create **data source** (CSV/JSON/inline) → **Preview** → **Execute** test suite with **data-driven/execute** (variables in suite substituted per row).

---

## 6. Summary

- **API toggle on Record** = start network capture for that session; export HAR and use it in the API tab for import and test generation.
- **API tab** already covers import (OpenAPI, Postman, HAR, etc.), environments, chaining, assertions, security, reports; **new additions** are data-driven (CSV/JSON/Excel/inline) and OpenAPI validate + auto-fix + infer-schema for incomplete specs.
- **Incomplete OpenAPI** is addressed by validation, optional auto-fix, and schema inference from real responses, so you can still get to a complete, enterprise-style API test setup without manual spec authoring.
