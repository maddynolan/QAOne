# API Feature Audit: QAAI vs ReadyAPI & Postman

**Purpose:** Detailed audit of QAAI API testing capabilities vs ReadyAPI and Postman, gaps, and roadmap. Use this for packaging reference and cursor rules.

---

## 1. Executive Summary

| Dimension | QAAI | ReadyAPI | Postman |
|-----------|------|----------|---------|
| **Primary focus** | Unified QA (API + UI + Perf + AI) | API/functional/load/security | API design & testing |
| **Spec import** | OpenAPI, WSDL, Postman, GraphQL | OpenAPI, WSDL, Postman, GraphQL | OpenAPI, Postman, GraphQL, HAR |
| **Spec export** | OpenAPI (generated), Postman (generated) | Native project XML | Collection v2.1, OpenAPI |
| **Recorded traffic** | Desktop/extension network capture → HAR, API tab | Proxy-based | Proxy, HAR import |
| **Import from other tools** | Postman, OpenAPI, WSDL, GraphQL | Postman, OpenAPI, WSDL | Postman, OpenAPI, HAR, Insomnia, cURL |
| **Export to other tools** | Postman (from suite), HAR (from recording) | SoapUI XML, Postman (limited) | Postman, OpenAPI, cURL |
| **AI test generation** | ✅ Rift persona, LLM | ❌ | ❌ (Newman only) |
| **Unified with UI/Perf** | ✅ Flowstral, Perf | ❌ | ❌ |

**Verdict:** QAAI already covers a **good number** of API features and is **better** than Postman/ReadyAPI in: unified platform (API + UI + Perf), AI test generation, no-proxy network capture, and Rift persona. Gaps: **import/export parity** (HAR→API collection, export to Insomnia/ReadyAPI, import from ReadyAPI/Insomnia), and **recorded-tab → API export** flow clarity.

---

## 2. Feature Matrix (Detailed)

### 2.1 Specification Import

| Format | QAAI | ReadyAPI | Postman | Notes |
|--------|------|----------|---------|-------|
| OpenAPI 3.x (JSON/YAML) | ✅ `/api/import/spec` | ✅ | ✅ | Full |
| Swagger 2 | ✅ (as openapi) | ✅ | ✅ | Full |
| WSDL | ✅ | ✅ | ✅ | Full |
| Postman Collection v2/v2.1 | ✅ | ✅ | ✅ | Full |
| GraphQL (SDL/JSON) | ✅ | ✅ | ✅ | Full |
| **HAR** | ⚠️ Perf/protocol only | ✅ (limited) | ✅ | **Gap:** HAR→API test suite/collection in API tab |
| **Insomnia export** | ❌ | ❌ | ✅ | **Gap:** Import Insomnia JSON |
| **ReadyAPI/SoapUI project XML** | ❌ | Native | ❌ | **Gap:** Import SoapUI project (optional) |
| AsyncAPI | ❌ | ❌ | ⚠️ | Optional future |
| cURL | ❌ | ❌ | ✅ | Optional future |

### 2.2 Specification / Collection Export

| Export target | QAAI | ReadyAPI | Postman | Notes |
|---------------|------|----------|---------|-------|
| Postman Collection v2.1 | ✅ (from test suite) | ⚠️ | Native | From `generate_executable_tests(..., postman)` |
| OpenAPI (skeleton) | ⚠️ Partial | ✅ | ✅ | **Gap:** Export current collection as OpenAPI |
| HAR | ✅ (recorder/desktop + protocol) | ✅ | ✅ | From network capture + protocol recording |
| Insomnia | ❌ | ❌ | ❌ | **Gap:** Export to Insomnia JSON |
| ReadyAPI/SoapUI XML | ❌ | Native | ❌ | Optional (low demand) |
| k6 / JMeter | ✅ (Perf) | ✅ | Via Newman/plugins | Perf tab |

### 2.3 Recorded Network → API Tests

| Source | QAAI | ReadyAPI | Postman |
|--------|------|----------|---------|
| **Desktop app Record tab** | ✅ Capture → `capturedNetworkRequests` → API tab via sessionStorage | Proxy | Proxy / HAR |
| **Export captured as HAR** | ✅ Extension/desktop `exportAsHAR()` | ✅ | ✅ |
| **Export captured as Postman** | ❌ | ⚠️ | ✅ (from HAR) | **Gap:** Recorded requests → Postman collection in one click |
| **Export captured as OpenAPI** | ❌ | ❌ | ⚠️ | **Gap:** Optional “Generate OpenAPI from recording” |

### 2.4 Test Generation & Execution

| Feature | QAAI | ReadyAPI | Postman |
|---------|------|----------|---------|
| Auto-generate from spec | ✅ (Rift + LLM + deterministic) | ✅ | ⚠️ (examples only) |
| Positive/Negative/Boundary/Security | ✅ | ✅ | ✅ |
| OWASP API Top 10 | ✅ (Rift, owasp_api_security) | ✅ | ⚠️ |
| Playwright/pytest/Postman/k6/REST Assured | ✅ | ⚠️ | Newman |
| Request chaining | ✅ (request_chaining_api) | ✅ | ✅ (scripts) |
| Environment variables | ✅ (environment_manager) | ✅ | ✅ |
| Database assertions | ✅ (database_connector) | ✅ | ❌ |
| Service virtualization | ✅ (service_virtualization) | ✅ | Mock server |

### 2.5 Protocol & Integrations

| Feature | QAAI | ReadyAPI | Postman |
|---------|------|----------|---------|
| REST | ✅ | ✅ | ✅ |
| SOAP / WSDL | ✅ | ✅ | ✅ |
| GraphQL | ✅ | ✅ | ✅ |
| gRPC / Kafka / MQTT / WebSocket | ✅ (v2/testing) | ⚠️ | ⚠️ |
| OAuth2 | ✅ (oauth2_api) | ✅ | ✅ |
| CI/CD (Newman, CLI, REST) | ✅ | ✅ | ✅ |

---

## 3. Gaps and Recommendations

### 3.1 High Priority (Implement)

1. **HAR → API test suite / collection**
   - **Where:** `/api/import/har` (or extend `/api/import/spec` with `spec_format=har`).
   - **Behavior:** Accept HAR JSON → normalize to internal test suite → optionally return Postman collection.
   - **UI:** API tab “Import from HAR” (file or paste).

2. **Export recorded network as Postman collection**
   - **Where:** Recorder (desktop) and API tab when data is from recorder.
   - **Behavior:** `capturedNetworkRequests` or protocol `requests` → Postman Collection v2.1 JSON (with optional test scripts).
   - **UI:** “Export as Postman” in Record tab (after capture) and in API tab when showing recorded requests.

3. **Export current API collection/suite**
   - **Where:** API tab + backend.
   - **Endpoints:** e.g. `POST /api/import/export-postman`, `POST /api/import/export-openapi` (skeleton), `POST /api/import/export-har` (from current requests).
   - **UI:** “Export to” → Postman, OpenAPI (skeleton), HAR.

### 3.2 Medium Priority (Roadmap)

4. **Import from Insomnia**
   - Parse Insomnia export JSON (request/response + folders).
   - Add `spec_format=insomnia` in api_spec_parser and `/api/import/spec`.

5. **Import from ReadyAPI/SoapUI project**
   - Parse SoapUI project XML (REST/GROOVY, endpoints, assertions).
   - New parser in api_spec_parser; endpoint e.g. `/api/import/spec` with `spec_format=soapui` and file upload.

6. **Export to Insomnia**
   - Generate Insomnia-compatible JSON from current suite/collection.

### 3.3 Low Priority

7. **Import from cURL / Export as cURL** – convenience only.
8. **AsyncAPI import** – if event-driven APIs become a requirement.

---

## 4. Current Implementation Reference

### 4.1 Backend

| Component | Path | Role |
|-----------|------|------|
| API Import | `backend/app/routers/api_import_api.py` | `/api/import/spec`, `/api/import/spec/file`, `/api/import/generate-tests`, `/api/import/formats` |
| API Spec Parser | `backend/app/services/connectors/api_spec_parser.py` | openapi, swagger, postman, graphql, wsdl |
| API Test Engine | `backend/app/services/engines/api_test_engine.py` | generate_test_suite, generate_executable_tests (playwright, pytest, postman, rest_assured, k6) |
| Postman generator | `backend/app/services/engines/api_test_engine_enhancements.py` | generate_postman_collection(test_suite) |
| Enhanced API Testing | `backend/app/routers/enhanced_api_testing_api.py` | `/api/v2/testing/*` (test-suite, DB, execute, virtual, load, env) |
| Protocol recording (HAR) | `backend/app/routers/protocol_recording_api.py` | `/api/protocol-recording/import-har`, `export-har/{id}` |
| Performance HAR | `backend/app/routers/performance_api.py` | HAR → CompiledScenario (load test) |

### 4.2 Frontend

| Component | Path | Role |
|-----------|------|------|
| Enhanced API Testing UI | `src/pages/EnhancedAPITesting.tsx` | Import spec (file/paste), Execute, Export (code) |
| Playwright Recorder | `src/pages/PlaywrightRecorderPage.tsx` | `capturedNetworkRequests`, API/Perf tabs via sessionStorage |
| Unified Workflow Editor | `src/pages/UnifiedWorkflowEditor.tsx` | protocolData, Export (HAR, k6, JMeter mentioned) |
| Performance | `src/pages/Performance.tsx` | Export HAR from protocol recording |

### 4.3 Desktop / Extension

| Component | Path | Role |
|-----------|------|------|
| Network capture (desktop) | `flowstral-desktop/src/main/lib/network-capture.js` | start/stop, exportAsHAR(), linkUserAction |
| IPC (desktop) | `flowstral-desktop/src/main/index.js` | network-capture-start/stop, network-capture-export-har |
| Extension network capture | `flowstral-extension/src/lib/network-capture.js` | Same HAR + correlation patterns |

---

## 5. Cursor / Dev Guidance (Do Not Break)

- **API import:** All existing `/api/import/*` routes and `APISpecParser` formats (openapi, swagger, postman, graphql, wsdl) must keep current behavior. Add new formats (har, insomnia, soapui) as additional branches.
- **API export:** New export endpoints (Postman, OpenAPI, HAR, Insomnia) must be additive; responses must not change existing contract of `/api/import/generate-tests` or `/api/v2/testing/*`.
- **Recorder:** `capturedNetworkRequests` and sessionStorage keys `pendingApiTestRequests` / `pendingLoadTestTimestamp` are used by API tab; do not remove or rename. New “Export as Postman” should produce a download without replacing this flow.
- **Protocol recording:** HAR import/export under `/api/protocol-recording/` and Performance HAR export must remain working. HAR→API suite can share the same HAR parsing logic (e.g. protocol_recorder or a shared har_parser).
- **Feature matrix:** This doc and `test-website/APEX_READYAPI_FEATURE_MATRIX.md` should be updated when adding import/export formats or new API testing features.

---

## 6. Packaging & Cursor Rules

- **Cursor rules:** `.cursorrules` includes "API Testing - Do Not Break" and points to this doc.
- **Required reading:** Listed in `.cursorrules` under Required Reading (#3).
- **Reference:** When adding import/export formats or changing API testing behavior, update this doc and the do-not-break section in `.cursorrules`.

## 7. Changelog

| Date | Change |
|------|--------|
| 2025-01-29 | Initial audit; added HAR import (parser + /api/import/har + /spec with har); export Postman, OpenAPI, HAR; API tab UI: HAR in Format, Export to Postman/HAR; cursor rules + packaging ref. |
