# Feature: API Testing

Flowstral's API Testing module is a comprehensive, enterprise-grade API testing platform comparable to Postman, ReadyAPI, and SoapUI. It supports REST, SOAP, GraphQL, and WebSocket protocols with real HTTP execution, request chaining, OWASP security scanning, and multi-format import/export.

## Architecture

```
Frontend (React)                          Backend (FastAPI + aiohttp/httpx)
+----------------------------------+      +-----------------------------------+
| EnhancedAPITesting.tsx (9 tabs)  |      | /api/v2/testing/* (execution)     |
|   - Builder (RequestBuilder)     | ---> | /api/import/*    (spec parsing)   |
|   - Templates (quick-start)      |      | /api/request-chain/* (chaining)   |
|   - Import (spec import)         |      | /api/security/*  (OWASP scanner)  |
|   - Chains (RequestChainBuilder) |      +-----------------------------------+
|   - Execute (test runner)        |                    |
|   - Security (OWASP scan)        |        Real HTTP via aiohttp / httpx
|   - Environments                 |                    |
|   - Mock Server                  |              Target APIs
|   - Results (reports)            |
+----------------------------------+
```

## 9 Tabs Overview

### 1. Builder (Postman-like Request Builder)

**Component:** `src/components/api-testing/RequestBuilder.tsx`

A full-featured HTTP request builder:
- URL bar with method selector (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Tabs: Params, Headers, Body (JSON/Form/XML/Raw/None), Auth (Bearer/Basic/API Key), Assertions
- Response viewer with Body and Headers tabs, status badge, timing, copy button
- Save/Load requests to localStorage
- "Add to Chain" button to push any request into the chain builder

**How Send works:**
1. Builds URL with query params and auth headers
2. Proxies through backend: `POST /api/v2/testing/execute` with `mode: "automated"`
3. Backend makes real HTTP call via `aiohttp.ClientSession`
4. Frontend extracts `actual_status`, `response_body`, `response_headers`, `response_time_ms`
5. Displays formatted response with proper HTTP status text (200 OK, 404 Not Found, etc.)

### 2. Templates (Quick-Start Protocol Templates)

Three protocol templates with real public APIs (no localhost):

| Template | Protocol | Base URL | Auth |
|----------|----------|----------|------|
| **JSONPlaceholder** | REST/OpenAPI | `https://jsonplaceholder.typicode.com` | None |
| **Countries** | GraphQL | `https://countries.trevorblades.com/graphql` | None |
| **CountryInfo** | SOAP/WSDL | `http://webservices.oorsprong.org/...CountryInfoService.wso` | None |

Clicking "Load" populates the Import tab with the full spec and creates an environment.

### 3. Import (Specification Import)

**Supported formats:** OpenAPI/Swagger (JSON/YAML), Postman Collection (JSON), WSDL/SOAP (XML), GraphQL SDL, HAR

**Three import methods:**
1. **File upload** - Drag & drop or click to select
2. **URL fetch** - Proxied through backend (`/api/import/fetch-url`) to avoid CORS
3. **Paste text** - Directly paste spec content

**Quick Import samples** (one-click, embedded in UI):
- **JSONPlaceholder** - 10 REST endpoints
- **ReqRes Auth** - 7 endpoints (login, register, CRUD)
- **Petstore** - 7 OpenAPI endpoints

**Import flow:**
1. Frontend sends spec to `POST /api/import/spec` (or `/api/import/spec/file` for uploads)
2. Backend's `APISpecParser` normalizes to a common format
3. `APITestEngine.generate_test_suite()` creates base test cases from endpoints
4. `EnhancedAPITestEngine.generate_comprehensive_test_suite()` adds 8 test categories
5. Frontend stores the generated test suite and switches to Execute tab

**Export:** Postman Collection v2.1 and HAR 1.2 export via backend endpoints.

### 4. Chains (Request Chain Builder)

**Component:** `src/components/api-testing/RequestChainBuilder.tsx`

Multi-step request chaining (like ReadyAPI TestSuites):
- Name a chain, add steps (each step is a full request with extractions/assertions/conditions)
- **Variable extraction:** JSONPath, regex, response header, cookie, status code, response time
- **Variable injection:** Use `${variable}` syntax in URLs, headers, body, auth tokens
- **Conditional branching:** goto step, skip step based on variable values
- **Retry logic:** configurable retry count and delay per step
- **Step controls:** reorder (move up/down), enable/disable, delete

**Execution flow:**
1. `POST /api/request-chain/chains` - creates chain definition
2. `POST /api/request-chain/variables` - sets initial variables
3. `POST /api/request-chain/chains/execute` - executes with real HTTP via `httpx`

**Backend:** `backend/app/services/api_testing/request_chaining.py` (576 lines)
- Real HTTP execution via `httpx.AsyncClient`
- Full JSONPath support via `jsonpath_ng` library
- 13 assertion operators (equals, contains, starts_with, matches_regex, greater_than, less_than, is_null, exists, json_schema, etc.)
- Value transforms: upper, lower, trim, int, float, bool, json, length

**Results displayed via** `ChainResultsView.tsx`:
- Summary bar with pass/fail counts and pass rate
- Step-by-step waterfall with timing bars
- Extracted variables per step
- Assertion results per step

### 5. Execute (Test Suite Runner)

Runs generated test suites against selected environments:
1. Select environment (provides `base_url`)
2. Choose execution mode: **Automated**, **Manual**, **CI/CD**, or **Load Testing**
3. Select/deselect individual test cases
4. Execute via `POST /api/v2/testing/execute`

**Load Testing mode** supports: virtual users, duration, ramp-up time, think time.

**Test case normalization:** Handles various field naming from different spec parsers. Auto-generates sample request bodies for common endpoints.

### 6. Security (OWASP API Top 10 Scanner)

**Backend:** `backend/app/services/api_testing/owasp_api_security.py` (623 lines)

Real HTTP attacks against target API:

| OWASP Category | What it tests |
|----------------|---------------|
| **API1 - BOLA** | Access resources with different IDs (1, 2, 999999, 0, -1, "admin") |
| **API2 - Broken Auth** | 10 rapid login attempts, weak password registration |
| **API3 - Mass Assignment** | Privileged payloads (role:admin, is_admin:true) |
| **API4 - Resource Consumption** | page_size=10000, >1MB responses, deep nesting |
| **API5 - BFLA** | Probe admin/management/internal/config paths |
| **API7 - SSRF** | SSRF payloads (localhost, 169.254.169.254, file://) |
| **API8 - Misconfig** | Missing security headers, verbose errors, CORS |
| **API9 - Inventory** | Debug endpoints (/debug, /swagger, /.env, /graphiql) |

### 7. Environments

Create and manage environments with:
- Name, type (dev/staging/production), base URL
- Variable resolution with `{{var}}` syntax
- Persisted via API and localStorage

**Database connectivity:** PostgreSQL, MySQL, SQLite, MongoDB, MSSQL for data-driven testing.

### 8. Mock Server

Create real HTTP mock servers with:
- Dynamic response templates (status codes, headers, body)
- Start/Stop/View Logs controls
- Endpoint management (add/remove, configurable method/path/status/body)
- Virtual service creation

### 9. Results (Reports & Export)

Five report format views:
1. **Summary** - Grid with Total/Passed/Failed/Pass Rate + performance metrics
2. **HTML Report** - Styled standalone HTML table (rendered in iframe)
3. **JUnit XML** - Compatible with CI/CD tools
4. **JSON** - Raw JSON export
5. **Allure** - Allure-format JSON (for `allure generate` CLI)

## Test Case Generation Quality

When a spec is imported, tests are generated across **8 categories**:

| Category | What's Generated |
|----------|-----------------|
| **Functional** | Happy path + content-type validation + non-empty response checks |
| **Security** | Per-endpoint OWASP attacks: SQLi, XSS, Auth Bypass, BOLA, Rate Limiting, Mass Assignment |
| **Performance** | Base tests with response time thresholds (1000ms max) |
| **Integration** | Multi-endpoint flows with variable extraction between steps |
| **Contract** | Status code + content-type + JSON schema validation from spec |
| **Negative** | Wrong HTTP method, invalid resource ID, empty body, malformed JSON |
| **Boundary** | Zero/large/negative numbers, empty/long/special-char strings |
| **Data-driven** | Valid data, minimum values, maximum values, required-only fields |

**Sample value generation** uses schema types and formats:
- `format: "email"` -> `test@example.com`
- `format: "date-time"` -> `2024-01-01T12:00:00Z`
- `format: "uuid"` -> `550e8400-e29b-41d4-a716-446655440000`
- Property name hints: `email`, `password`, `phone`, `url`, `title`, `description`

## Public Test Endpoints

All demos use real public APIs (no localhost):

| API | URL | Used For |
|-----|-----|----------|
| **JSONPlaceholder** | `https://jsonplaceholder.typicode.com` | REST CRUD, templates, quick import |
| **ReqRes** | `https://reqres.in` | Auth flows, pagination, quick import |
| **Petstore** | `https://petstore.swagger.io/v2` | OpenAPI import, quick import |
| **Countries GraphQL** | `https://countries.trevorblades.com/graphql` | GraphQL template |
| **CountryInfo SOAP** | `http://webservices.oorsprong.org/.../CountryInfoService.wso` | SOAP/WSDL template |
| **HTTPBin** | `https://httpbin.org` | Headers, auth, status codes |

## Backend Endpoint Reference

### Test Execution (`/api/v2/testing`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/execute` | Execute test suite (automated/manual/ci_cd/load) |
| POST | `/execute/load` | Load test execution |
| POST | `/test-suite/generate` | Generate test suite from spec |
| POST | `/security/scan` | OWASP security scan |
| POST | `/report/generate` | Generate execution report |
| GET | `/capabilities` | Full capability list |
| GET | `/protocols` | Supported protocols |

### Import & Export (`/api/import`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/spec` | Import spec from text |
| POST | `/spec/file` | Import spec from file upload |
| GET | `/fetch-url?url=...` | Proxy fetch (avoids CORS) |
| POST | `/export-postman` | Export to Postman Collection |
| POST | `/export-har` | Export to HAR format |
| GET | `/formats` | List supported formats |

### Request Chaining (`/api/request-chain`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/chains` | Create chain definition |
| POST | `/chains/execute` | Execute saved chain |
| POST | `/quick-chain` | Execute ad-hoc chain (no save) |
| POST | `/variables` | Set global variables |
| GET | `/variables` | Get all variables |
| GET | `/extraction-methods` | List extraction methods |
| GET | `/assertion-operators` | List assertion operators |

### Mock Server (`/api/v2/testing/mock`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/server` | Create mock server |
| GET | `/server` | List mock servers |
| POST | `/server/{id}/start` | Start server |
| POST | `/server/{id}/stop` | Stop server |
| POST | `/server/{id}/endpoint` | Add endpoint |
| GET | `/server/{id}/logs` | Get request logs |

### Environments (`/api/v2/testing/environment`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/create` | Create environment |
| GET | `/` | List environments |
| GET | `/{id}` | Get environment |
| PUT | `/{id}` | Update environment |
| DELETE | `/{id}` | Delete environment |

## Configuration

The API testing module uses the centralized backend URL from `src/lib/api-config.ts`:

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://qaone-production.up.railway.app';
```

Both `constants.ts` (used by RequestBuilder, ChainBuilder) and `EnhancedAPITesting.tsx` import from this single source.

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/EnhancedAPITesting.tsx` | Main page (9 tabs, ~3950 lines) |
| `src/components/api-testing/RequestBuilder.tsx` | Postman-like request builder |
| `src/components/api-testing/RequestChainBuilder.tsx` | Multi-step chain builder |
| `src/components/api-testing/ChainStepCard.tsx` | Chain step UI card |
| `src/components/api-testing/ChainResultsView.tsx` | Chain results display |
| `src/components/api-testing/AssertionsPanel.tsx` | Assertion editor (10 types) |
| `src/components/api-testing/constants.ts` | Shared types, constants, API_BASE_URL |
| `backend/app/routers/enhanced_api_testing_api.py` | FastAPI router (execution, mock, env) |
| `backend/app/routers/api_import_api.py` | Import/export router |
| `backend/app/routers/request_chaining_api.py` | Chain execution router |
| `backend/app/services/api_testing/test_execution_engine.py` | Real HTTP execution via aiohttp |
| `backend/app/services/api_testing/enhanced_api_test_engine.py` | Test suite generator (8 categories) |
| `backend/app/services/api_testing/request_chaining.py` | Chain engine (httpx, jsonpath_ng) |
| `backend/app/services/api_testing/owasp_api_security.py` | OWASP API Top 10 scanner |
| `backend/app/services/connectors/api_spec_parser.py` | OpenAPI/Postman/WSDL/GraphQL/HAR parser |
| `backend/app/services/engines/api_test_engine.py` | Base test case generator |
