# Feature: Salesforce Testing

> Deep Salesforce integration with multi-org management, SOQL queries, metadata validation, test data factory, Apex execution, and Salesforce-optimized Playwright code generation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Authentication Flows](#7-authentication-flows)
8. [Data Factory & Templates](#8-data-factory--templates)
9. [Configuration](#9-configuration)
10. [Known Gaps & TODOs](#10-known-gaps--todos)

---

## 1. Overview

Salesforce Testing in Flowstral provides a dedicated toolset for testing Salesforce orgs. Unlike the general-purpose recorder or API tester, the Salesforce module understands Salesforce-specific concepts: Lightning components, SOQL queries, object metadata, validation rules, Apex test classes, record types, and Shadow DOM locators.

| Capability | Implementation | Status |
|------------|---------------|--------|
| **Multi-Org Management** | localStorage-based org store with backend sync | Fully implemented |
| **Authentication** | OAuth2, Username/Password, JWT Bearer, Session ID | Fully implemented |
| **SOQL Editor** | Frontend editor with syntax highlighting + backend execution via `simple_salesforce` | Fully implemented |
| **Schema Browser** | Describe objects, fields, picklists, record types from live org | Fully implemented |
| **Metadata Validation** | Backend validates object names, fields, selectors, workflows against cached metadata | Fully implemented |
| **Test Data Factory** | Template-based and schema-aware generation for 5+ standard objects | Fully implemented |
| **Bulk Data Loader** | Bulk API 2.0 insert/update/upsert/delete via CSV | Fully implemented |
| **REST API Playground** | Raw Salesforce REST calls via backend proxy (avoids CORS) | Fully implemented |
| **Record Inspector** | Fetch any record by ID with auto-detected object type from key prefix | Fully implemented |
| **Apex Test Runner** | Discover and execute Apex test classes with polling for results | Fully implemented |
| **Permission Analyzer** | Object and field permissions for any user | Fully implemented |
| **Salesforce Playwright Generator** | Salesforce-optimized locator priority chain for recorded scripts | Fully implemented |
| **Functional/Integration/Regression/UAT Testing** | Salesforce-aware test builders for each test type | Frontend implemented |
| **Test Orchestrator** | Scan org for testable items, auto-generate test suites | Fully implemented |
| **Token Pool** | Pre-warmed token pool for parallel test execution | Fully implemented |

**Total codebase size:**
- Frontend: ~16,403 lines (page: 2,118 + components: 11,752 + sub-components: 2,533)
- Frontend libs: ~5,260 lines
- Backend: ~4,420 lines (routers: 2,190 + services: 1,553 + generators: 677)

---

## 2. Architecture

```
Frontend (React + localStorage)                    Backend (FastAPI + simple_salesforce)
+----------------------------------------------+   +----------------------------------------------+
| SalesforceToolsPage.tsx (2,118 lines)        |   | salesforce_api.py (28 endpoints)             |
|   22 tabs (orgs, soql, bulk, api, schema,    |   |   /api/salesforce/*                          |
|   inspect, tests, permissions, datafactory,  |   |   Connection, proxy, metadata, SOQL,         |
|   relationships, logs, assertions, cloner,   |   |   validation, orchestrator, integration      |
|   diff, create, apex, fieldanalysis,         |   |                                              |
|   reports, functional, integration,          |   | salesforce_auth.py (11 endpoints)            |
|   regression, uat, orchestrator)             |   |   /api/salesforce/auth/*                     |
+----------------------------------------------+   |   JWT, OAuth, token pool                     |
|                                              |   +----------------------------------------------+
| salesforce-api.ts (SalesforceApiService)     |            |
|   Multi-org localStorage persistence         |   +----------------------------------------------+
|   Auto-connect from backend on init          |   | Services                                     |
|   Proxy all REST calls through backend       |   |   auth_service.py (SalesforceAuthService)    |
|   Token lifecycle management                 |   |   metadata_service.py (SalesforceMetadataS.) |
+----------------------------------------------+   |   soql_service.py (SOQLService)              |
|                                              |   +----------------------------------------------+
| salesforce-service.ts                        |            |
|   Metadata validation requests               |   +----------------------------------------------+
|   Object/field/selector/workflow validation  |   | Playwright Generators                        |
|   Autocomplete suggestions                   |   |   salesforce_playwright_generator.py (294 L) |
+----------------------------------------------+   |   robust_salesforce_generator.py (383 L)     |
|                                              |   +----------------------------------------------+
| salesforce-test-data-factory.ts              |
|   Template-based generation (offline)        |
|   Schema-aware generation (org-connected)    |
|   Industry-specific data pools               |
+----------------------------------------------+
|                                              |
| salesforce-templates.ts                      |
|   Object templates: Account, Contact, Lead,  |
|   Opportunity, Case with Lightning selectors |
+----------------------------------------------+
|                                              |
| salesforce-test-integration.ts               |
|   Context-aware recording suggestions        |
|   Validation rule integration                |
|   Coverage tracking                          |
+----------------------------------------------+
```

**Key architectural decisions:**

1. **Dual-path API calls**: The frontend `SalesforceApiService` attempts direct Salesforce REST calls via a backend proxy (`POST /api/salesforce/proxy`) with the org's access token. If no local token is available, it falls back to an auto-proxy (`POST /api/salesforce/auto-proxy`) where the backend handles authentication entirely.

2. **Multi-org management**: Orgs are stored in `localStorage` (key: `salesforce_orgs`). On startup, the frontend syncs with the backend (`GET /api/salesforce/status`) to pick up backend-managed connections.

3. **Backend uses `simple_salesforce`**: The Python library `simple_salesforce` handles Salesforce API communication. Credentials are stored in `backend/app/config/salesforce_credentials.json` and also loaded from environment variables.

4. **No Zustand store**: Unlike other modules (API Testing, Mobile Testing), the Salesforce module uses `useState` in the page component and a singleton `SalesforceApiService` class. No Zustand store exists for this module.

---

## 3. Frontend Code Audit

### Page

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/salesforce/pages/SalesforceToolsPage.tsx` | 2,118 | **Fully implemented** | Main hub with 22 tabs, multi-org selector header, all state management |

**Key State Variables:**
- `activeTab` (default: `'orgs'`), `orgs: SalesforceOrg[]`, `currentOrg: SalesforceOrg | null`
- SOQL: `soqlQuery`, `queryResults`, `queryColumns`, `queryError`, `queryHistory`
- Schema: `objects`, `selectedObject`, `objectDescribe`, `objectFilter`, `showCustomOnly`
- Inspector: `inspectRecordId`, `inspectObjectType`, `inspectedRecord`
- Bulk: `bulkOperation`, `bulkObjectName`, `bulkCsvData`, `bulkExternalIdField`, `bulkJobStatus`
- API Playground: `apiMethod`, `apiEndpoint`, `apiBody`, `apiResponse`, `apiError`
- Apex Tests: `testClasses`, `selectedTestClasses`, `testRunId`, `testResults`, `testRunStatus`
- Permissions: `permissionUserId`, `objectPermissions`, `fieldPermissions`
- Data Factory: `selectedDataObject`, `dataRecordCount`, `dataIndustry`, `generatedRecords`, `seedingProgress`

**Key Functions:**
- `syncWithBackend()` -- syncs frontend org list with backend connection status on mount
- `handleAddOrg()` -- authenticates via `POST /api/salesforce/connect`, stores org in localStorage
- `handleExecuteQuery()` -- runs SOQL via `salesforceApi.query()`, saves to history
- `loadObjects()` / `loadObjectDescribe()` -- schema browser via `describeGlobal()` / `describeSObject()`
- `handleInspectRecord()` -- auto-detects object type from 3-character key prefix
- `handleBulkUpload()` -- Bulk API 2.0 job lifecycle (create, upload, close, poll)
- `handleApiRequest()` -- raw REST call via `salesforceApi.request()`
- `handleRunTests()` -- discovers Apex test classes, runs, polls 3s interval
- `handleAnalyzePermissions()` -- queries object and field permissions for a user
- `handleGenerateTestData()` -- schema-aware (org-connected) or template-based (offline) generation

### Components (20 files, 11,752 lines)

| File | Lines | Role |
|------|-------|------|
| `AddOrgDialog.tsx` | 418 | Dialog with 3 auth methods: Browser OAuth popup, Session ID, manual credentials. Color picker for org badge. |
| `SalesforceApexExecutor.tsx` | 465 | Anonymous Apex code editor and executor. Syntax-highlighted output. |
| `SalesforceApiReference.tsx` | 591 | Browsable Salesforce REST and SOAP API reference with categorized endpoints. |
| `SalesforceAssertionBuilder.tsx` | 557 | Build SOQL-based assertions for test steps: query, field path, operator, expected value. |
| `SalesforceContextPanel.tsx` | 519 | Sidebar panel showing current org context: connection info, recent objects, API limits. |
| `SalesforceDataDiff.tsx` | 489 | Before/after record comparison: highlights added, removed, and changed fields. |
| `SalesforceDebugLogAnalyzer.tsx` | 431 | Parse and display Salesforce debug logs: filter by category/level, timeline view. |
| `SalesforceFieldAnalyzer.tsx` | 425 | Field metadata analysis: data types, picklist values, required flags, dependencies. |
| `SalesforceFunctionalTesting.tsx` | 666 | Functional test builder: CRUD operations, field validations, workflow triggers. |
| `SalesforceIntegrationTesting.tsx` | 925 | Integration test builder: API testing, webhook validation, cross-object verification, CRUD lifecycle tests. |
| `SalesforceQuickRecordCreator.tsx` | 528 | Rapid record creation with template-based smart fill. Create Account/Contact/Lead/Opportunity/Case. |
| `SalesforceRecordCloner.tsx` | 517 | Clone existing records with field overrides. Deep clone includes related child records. |
| `SalesforceRegressionTesting.tsx` | 840 | Baseline regression: capture known-good state, compare after changes, detect drift. |
| `SalesforceRelationshipVisualizer.tsx` | 418 | Object relationship graph: master-detail, lookup, junction objects as interactive diagram. |
| `SalesforceReportRunner.tsx` | 419 | Execute Salesforce reports via Analytics API and display results in table format. |
| `SalesforceTemplates.tsx` | 655 | Pre-built test templates for standard Salesforce objects with step-by-step workflows. |
| `SalesforceTestOrchestrator.tsx` | 877 | Scan org for testable items (validation rules, flows, triggers), auto-generate test suites. |
| `SalesforceUATesting.tsx` | 876 | UAT workflow: test scenarios, stakeholder signoff, evidence capture, acceptance criteria. |
| `SalesforceValidationPanel.tsx` | 590 | Test validation rules: positive (rule allows) and negative (rule blocks) test cases. |
| `SoqlEditor.tsx` | 546 | SOQL editor with syntax highlighting, object/field autocomplete, query history. |

### Sub-Components (4 files, 2,533 lines)

| File | Lines | Role |
|------|-------|------|
| `salesforce/MetadataAssertions.tsx` | 710 | Assert metadata properties: object exists, field type matches, picklist values correct. |
| `salesforce/SFContextDashboard.tsx` | 738 | Dashboard showing org health: API limits, metadata stats, recent activity, connection status. |
| `salesforce/SmartSOQLBuilder.tsx` | 601 | Visual SOQL builder: drag-drop fields, WHERE clause builder, ORDER BY, LIMIT, GROUP BY. |
| `salesforce/StageTransitionTester.tsx` | 484 | Test Opportunity stage transitions: valid paths, required fields per stage, close date logic. |

### Libraries (5 files, 5,260 lines)

| File | Lines | Role |
|------|-------|------|
| `lib/salesforce-api.ts` | 1,312 | Core API client: `SalesforceApiService` singleton. Multi-org management (localStorage), auth (login, refresh, auto-connect from backend), REST proxy, SOQL, Bulk API 2.0, Tooling API, describe, permissions, limits. 13 exported types. |
| `lib/salesforce-service.ts` | 498 | Metadata validation service: `salesforceService` singleton. Connects to backend validation endpoints. Object/field/picklist/selector/workflow validation. Autocomplete suggestions. |
| `lib/salesforce-templates.ts` | 1,835 | Standard object templates with field definitions. 5 templates: Account (19 fields), Contact (22 fields), Lead (24 fields), Opportunity (18 fields), Case (16 fields). Smart fill type mappings. Lightning/Classic/LWC selectors per field. Navigation steps. |
| `lib/salesforce-test-data-factory.ts` | 1,066 | Test data generation: `TestDataFactory` class. Template-based (offline) and schema-aware (org-connected) modes. Industry pools: healthcare, finance, retail, technology, manufacturing. 20 company names, 40 first names, 40 last names, 18 city/state pairs. CSV/JSON export. |
| `lib/salesforce-test-integration.ts` | 549 | Test integration layer: `SalesforceTestIntegration` class. Context detection (current object, page type, record ID from URL). Validation rule test suggestions. Flow awareness. Coverage tracking. |

### Constants (1 file)

| File | Lines | Role |
|------|-------|------|
| `constants/salesforce-constants.ts` | 14 | Org color palette: 8 colors (Blue, Green, Purple, Orange, Pink, Cyan, Red, Yellow). |

### Barrel Export

`src/modules/salesforce/index.ts` exports 19 named members: 1 page, 14 components (the 4 sub-components are not re-exported), 4 libs.

---

## 4. Backend Code Audit

### Routers

| File | Lines | Prefix | Endpoints | Role |
|------|-------|--------|-----------|------|
| `backend/app/routers/salesforce/salesforce_api.py` | 1,826 | `/api/salesforce` | 28 | Connection (status, connect, disconnect, auto-connect, OAuth start/callback/status), proxy (proxy, auto-proxy), SOQL (query, assert, generate-code), metadata (fetch, objects, object detail, fields), validation (object, field, picklist, selector, workflow), suggestions (fields, objects), orchestrator (scan, generate-tests), integration (execute-test, run-crud-test) |
| `backend/app/routers/salesforce/salesforce_auth.py` | 364 | `/api/salesforce/auth` | 11 | Auth status, configure org, get token, validate token, pool initialize/status/acquire/shutdown, list orgs, set default org, delete org |

### Services

| File | Lines | Role |
|------|-------|------|
| `backend/app/services/salesforce/auth_service.py` | 505 | `SalesforceAuthService` -- centralized auth with 3 strategies: JWT Bearer (RS256 signed assertion), OAuth Refresh Token, Username/Password. `SalesforceToken` dataclass with expiry tracking (5-minute safety buffer). `TokenPool` class for parallel execution (round-robin distribution, pre-warming, auto-refresh). Singleton via `get_auth_service()`. Config from file + environment variables. |
| `backend/app/services/salesforce/metadata_service.py` | 827 | `SalesforceMetadataService` -- fetches and caches org metadata (objects, fields, picklists, record types). Validates objects, fields, picklist values, selectors, and workflows against cached metadata. Fuzzy matching for suggestions (SequenceMatcher). Caches to `metadata_cache/sf_metadata.json`. Knows 30 standard objects, 50 standard fields, 20+ Lightning component patterns, 10 SF selector patterns. |
| `backend/app/services/salesforce/soql_service.py` | 221 | `SOQLService` -- executes SOQL queries via `simple_salesforce`. Parameter substitution with `{param}` placeholders. Mock mode when not connected. Assertion support (compare actual values). |

### Playwright Generators

| File | Lines | Role |
|------|-------|------|
| `backend/app/services/flowstral/salesforce_playwright_generator.py` | 294 | `SalesforcePlaywrightGenerator` -- Salesforce Experience Cloud optimized. 7-priority locator chain: (1) `getByTitle()`, (2) `href` for links, (3) ID extraction from action descriptions, (4) `getByRole().filter({ hasText })` for Shadow DOM, (5) Lightning component selectors, (6) `data-menulist-item` + text filter, (7) combined/scoped selectors. `networkidle` waits after each action. |
| `backend/app/services/flowstral/robust_salesforce_generator.py` | 383 | `RobustSalesforceGenerator` -- metadata-first approach. Single-pass extraction: locator + text + event type together. Deduplicates by locator normalization. Guards against fill-into-body. Trusts recorded metadata over heuristics. |

### Backend Helper Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `get_salesforce_client()` | `salesforce_api.py` | Creates `simple_salesforce.Salesforce` instance from env vars or saved credentials file |
| `auto_connect_salesforce()` | `salesforce_api.py` | Restores connection on backend startup using saved refresh token |
| `save_credentials_to_file()` | `salesforce_api.py` | Persists credentials to `backend/app/config/salesforce_credentials.json` |
| `get_auth_service()` | `auth_service.py` | Singleton factory for `SalesforceAuthService` |
| `get_metadata_service()` | `metadata_service.py` | Singleton factory for `SalesforceMetadataService` |

---

## 5. API Endpoints

### Connection & Authentication (`/api/salesforce`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/salesforce/status` | Connection status: connected flag, instance URL, access token, username, cached metadata stats |
| `POST` | `/api/salesforce/connect` | Username/password auth via `simple_salesforce`. Tries multiple domains (login, test) with/without security token. Stores session in env vars. |
| `POST` | `/api/salesforce/disconnect` | Clears env vars and saved credentials |
| `POST` | `/api/salesforce/auto-connect` | Re-authenticate using saved `refresh_token` from credentials file |
| `GET` | `/api/salesforce/oauth/start` | Start OAuth2 browser flow. Returns `authorization_url` to open in popup. Stores `state` for callback. |
| `GET` | `/api/salesforce/oauth/callback` | Handle OAuth callback: exchange `code` for tokens, save credentials, set env vars |
| `GET` | `/api/salesforce/oauth/status/{state}` | Poll OAuth completion status (used by frontend popup polling) |

### Proxy (`/api/salesforce`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/salesforce/proxy` | Proxy Salesforce REST calls: accepts `instance_url`, `access_token`, `endpoint`, `method`, `body`. Avoids CORS. |
| `POST` | `/api/salesforce/auto-proxy` | Proxy without frontend token: backend handles auth from stored credentials. |

### SOQL (`/api/salesforce/soql`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/salesforce/query` | Execute SOQL query directly (simple interface) |
| `POST` | `/api/salesforce/soql/query` | Execute SOQL with parameter substitution (`{param}` placeholders) |
| `POST` | `/api/salesforce/soql/assert` | Execute SOQL and assert result field matches expected value |
| `POST` | `/api/salesforce/soql/generate-code` | Generate Playwright assertion code from SOQL query |

### Metadata (`/api/salesforce/metadata`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/salesforce/metadata/fetch` | Fetch and cache metadata for specified objects (or top 20 standard objects) |
| `GET` | `/api/salesforce/metadata/objects` | List all cached objects |
| `GET` | `/api/salesforce/metadata/objects/{name}` | Get full object description (fields, record types) |
| `GET` | `/api/salesforce/metadata/objects/{name}/fields` | Get all fields for an object |

### Validation (`/api/salesforce/validate`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/salesforce/validate/object` | Validate object API name exists in metadata cache |
| `POST` | `/api/salesforce/validate/field` | Validate field exists on object |
| `POST` | `/api/salesforce/validate/picklist` | Validate picklist value for a field |
| `POST` | `/api/salesforce/validate/selector` | Validate Salesforce selector pattern (Lightning, Aura, LWC, data attributes) |
| `POST` | `/api/salesforce/validate/workflow` | Validate entire workflow against metadata |

### Suggestions (`/api/salesforce/suggest`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/salesforce/suggest/fields` | Autocomplete field names for an object |
| `POST` | `/api/salesforce/suggest/objects` | Autocomplete object API names |

### Orchestrator & Integration (`/api/salesforce`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/salesforce/orchestrator/scan` | Scan org for testable items: validation rules, flows, triggers, Apex classes |
| `POST` | `/api/salesforce/orchestrator/generate-tests` | Auto-generate test suite from scanned items |
| `POST` | `/api/salesforce/integration/execute-test` | Run an integration test (API call + SOQL assertion) |
| `POST` | `/api/salesforce/integration/run-crud-test` | Run a CRUD lifecycle test (Create -> Read -> Update -> Delete) |

### Auth Service (`/api/salesforce/auth`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/salesforce/auth/status` | List configured orgs with auth method and token status |
| `POST` | `/api/salesforce/auth/configure` | Configure a new org (JWT, refresh token, or password credentials) |
| `POST` | `/api/salesforce/auth/token` | Get a valid access token (auto-refreshes if expired) |
| `POST` | `/api/salesforce/auth/token/validate` | Validate a token is still working |
| `POST` | `/api/salesforce/auth/pool/initialize` | Pre-warm token pool for parallel execution |
| `GET` | `/api/salesforce/auth/pool/status` | Token pool stats: size, available, total acquisitions |
| `POST` | `/api/salesforce/auth/pool/acquire` | Acquire token from pool (round-robin) |
| `POST` | `/api/salesforce/auth/pool/shutdown` | Drain and shutdown token pool |
| `GET` | `/api/salesforce/auth/orgs` | List all configured org names |
| `POST` | `/api/salesforce/auth/orgs/{org_name}/set-default` | Set default org |
| `DELETE` | `/api/salesforce/auth/orgs/{org_name}` | Remove an org configuration |

**Total: 39 endpoints** (28 in salesforce_api + 11 in salesforce_auth)

---

## 6. UI Walkthrough

### 22 Tabs in SalesforceToolsPage

| # | Tab Value | Icon | Label | Component |
|---|-----------|------|-------|-----------|
| 1 | `orgs` | Cloud | Orgs | Inline org manager: list, add, remove, switch, color badges |
| 2 | `soql` | Database | SOQL | Inline SOQL editor with query history |
| 3 | `bulk` | Upload | Bulk | Bulk data loader (insert/update/upsert/delete with CSV) |
| 4 | `api` | Globe | API | REST API playground (GET/POST/PATCH/DELETE) |
| 5 | `schema` | Table | Schema | Object browser with field details |
| 6 | `inspect` | Eye | Inspect | Record inspector by ID (auto-detects object type) |
| 7 | `tests` | Play | Tests | Apex test runner (discover, select, run, poll results) |
| 8 | `permissions` | Shield | Perms | Permission analyzer (object + field permissions) |
| 9 | `datafactory` | Zap | Data | Test data factory (template-based and schema-aware) |
| 10 | `relationships` | GitBranch | Rels | `SalesforceRelationshipVisualizer` |
| 11 | `logs` | Terminal | Logs | `SalesforceDebugLogAnalyzer` |
| 12 | `assertions` | CheckCircle | Assert | `SalesforceAssertionBuilder` |
| 13 | `cloner` | Copy | Clone | `SalesforceRecordCloner` |
| 14 | `diff` | ArrowRight | Diff | `SalesforceDataDiff` |
| 15 | `create` | Plus | Create | `SalesforceQuickRecordCreator` |
| 16 | `apex` | Terminal | Apex | `SalesforceApexExecutor` |
| 17 | `fieldanalysis` | Hash | Fields | `SalesforceFieldAnalyzer` |
| 18 | `reports` | FileJson | Reports | `SalesforceReportRunner` |
| 19 | `functional` | Layers | Functional | `SalesforceFunctionalTesting` |
| 20 | `integration` | Globe | Integration | `SalesforceIntegrationTesting` |
| 21 | `regression` | RefreshCw | Regression | `SalesforceRegressionTesting` |
| 22 | `uat` | Users | UAT | `SalesforceUATesting` |

Additionally, the **Orchestrator** tab (`orchestrator` value) appears with special border styling and renders `SalesforceTestOrchestrator`.

### Page Header

The page header shows:
- Page title with Cloud icon
- Current org badge (colored by org color)
- "Add Org" button (opens `AddOrgDialog`)
- Org selector dropdown (switch between connected orgs)
- API limits display (if loaded)

### AddOrgDialog Authentication Methods

The `AddOrgDialog` supports 3 authentication modes:

| Method | How It Works |
|--------|-------------|
| **Browser OAuth** | Opens `GET /api/salesforce/oauth/start` in a popup window. Polls `GET /api/salesforce/oauth/status/{state}` every 2 seconds until complete. On success, creates org from returned tokens. 5-minute timeout. |
| **Session ID** | User pastes a Salesforce session ID and instance URL directly. No backend auth call needed -- token is stored as-is. |
| **Manual Credentials** | Username, password, security token, login URL. Calls `POST /api/salesforce/connect` through the backend. |

Fields: Name, Org Type (production/sandbox/developer/scratch), Login URL, Color (8 options).

---

## 7. Authentication Flows

### Flow 1: Username/Password (Frontend-Initiated)

```
User enters credentials in AddOrgDialog
    |
    v
POST /api/salesforce/connect  (salesforce_api.py)
    |-- Determines domain from loginUrl (login/test/custom)
    |-- Tries multiple domain + token combinations
    |-- simple_salesforce.Salesforce(username, password, security_token, domain)
    |-- Stores session_id + instance_url in os.environ
    |
    v
Frontend stores org in localStorage (salesforceApi.addOrg())
```

### Flow 2: OAuth2 Browser Popup

```
User clicks "Browser Login" in AddOrgDialog
    |
    v
GET /api/salesforce/oauth/start?domain=login
    |-- Returns authorization_url with state token
    |-- Frontend opens popup window to authorization_url
    |
    v
User authenticates in Salesforce login page
    |
    v
Redirect to GET /api/salesforce/oauth/callback?code=xxx&state=yyy
    |-- Exchanges code for access_token + refresh_token
    |-- Saves credentials to salesforce_credentials.json
    |-- Sets env vars: SF_SESSION_ID, SF_INSTANCE_URL, SF_USERNAME
    |-- Returns HTML page that closes the popup
    |
    v
Frontend polling (GET /api/salesforce/oauth/status/{state}) detects success
    |-- Creates org in localStorage
    |-- Syncs with backend status
```

### Flow 3: JWT Bearer (Backend-Configured)

```
POST /api/salesforce/auth/configure
    |-- Provides: client_id, username, private_key (PEM)
    |
    v
POST /api/salesforce/auth/token
    |-- SalesforceAuthService._jwt_bearer_auth()
    |-- Creates JWT assertion: {iss: client_id, sub: username, aud: login_url, exp: now+300}
    |-- Signs with RS256 (private key)
    |-- POST to Salesforce /services/oauth2/token with grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
    |-- Returns SalesforceToken
```

### Flow 4: Auto-Connect on Startup

```
Backend startup
    |
    v
auto_connect_salesforce() reads salesforce_credentials.json
    |-- If refresh_token + client_id exist:
    |   POST to Salesforce /services/oauth2/token with grant_type=refresh_token
    |   Updates env vars and credentials file
    |
    v
Frontend mount (SalesforceToolsPage useEffect)
    |
    v
syncWithBackend() -- GET /api/salesforce/status
    |-- If backend reports connected:
    |   Create/update org in localStorage
    |
    v
SalesforceApiService constructor calls autoConnectFromBackend()
    |-- GET /api/salesforce/auth/status (checks for configured orgs)
    |-- POST /api/salesforce/auth/token (gets fresh token)
    |-- Creates/updates org in localStorage
```

### Token Lifecycle

| Event | Action |
|-------|--------|
| Token obtained | `tokenExpiry` set to `Date.now() + 7200000` (2 hours) |
| API call with expired token | `autoRefreshFromBackend()` tries backend refresh first, falls back to local `refreshAccessToken()` |
| Backend token expired | `SalesforceAuthService.get_token()` auto-refreshes (5-minute safety buffer) |
| No token, no org | `ensureConnected()` tries `autoConnectFromBackend()` |

---

## 8. Data Factory & Templates

### Template-Based Generation (Offline)

The `TestDataFactory` class (`salesforce-test-data-factory.ts`) generates realistic records without a Salesforce connection using built-in templates.

**Supported Objects:**

| Object | Fields | Notable Fields |
|--------|--------|----------------|
| Account | 19 | Name, Type, Industry, AnnualRevenue, NumberOfEmployees, BillingAddress |
| Contact | 22 | FirstName, LastName, Email, Phone, MailingAddress, AccountId |
| Lead | 24 | FirstName, LastName, Company, Email, LeadSource, Status, Industry |
| Opportunity | 18 | Name, StageName, Amount, CloseDate, Probability, AccountId |
| Case | 16 | Subject, Description, Status, Priority, Origin, Type, ContactId |

**Data Pools:**

| Pool | Size | Examples |
|------|------|---------|
| Company names | 20 | Acme Corporation, GlobalTech Solutions, Pinnacle Industries |
| First names | 40 | James, Mary, John, Patricia, Robert, Jennifer |
| Last names | 40 | Smith, Johnson, Williams, Brown, Jones, Garcia |
| Streets | 18 | Main Street, Oak Avenue, Park Road |
| City/State pairs | 18 | San Francisco/CA, New York/NY, Chicago/IL |

**Industry-Specific Data:**

| Industry | Customizations |
|----------|---------------|
| Healthcare | Medical company names, HIPAA-related fields, healthcare industry picklist |
| Finance | Financial company names, banking-related fields, financial services industry |
| Retail | Retail company names, commerce-related fields, consumer goods industry |
| Technology | Tech company names, software-related fields, technology industry |
| Manufacturing | Manufacturing company names, production-related fields, industrial industry |

### Schema-Aware Generation (Org-Connected)

When a Salesforce org is connected, the data factory fetches live metadata via `salesforceApi.describeObject()` and generates data that respects:

1. **Actual picklist values** -- reads from `field.picklistValues` instead of template defaults
2. **Required fields** -- ensures all `nillable: false && createable: true` fields are populated
3. **Field types** -- generates appropriate data for each Salesforce field type
4. **Max lengths** -- respects `field.length` constraints
5. **Reference fields** -- generates placeholder IDs for lookup/master-detail fields

**Generation flow:**
```
handleGenerateTestData()
    |-- If org connected:
    |   1. salesforceApi.describeObject(objectName) -- get live schema
    |   2. Extract schemaFields: name, type, picklistValues, required, maxLength
    |   3. testDataFactory.generateRecordsWithSchema(objectName, count, schemaFields)
    |
    |-- If no org (fallback):
    |   testDataFactory.generateRecords({ objectName, count, industry })
```

### Object Templates (`salesforce-templates.ts`)

Each template includes:

```typescript
interface SalesforceObjectTemplate {
  apiName: string;        // e.g., 'Account'
  label: string;          // e.g., 'Account'
  fields: SalesforceField[];  // With Lightning/Classic/LWC selectors
  navigationSteps: {
    lightning: string[];   // e.g., ['Open App Launcher', 'Click "Accounts"', ...]
    classic: string[];     // e.g., ['Click "Accounts" tab', ...]
  };
  verificationSteps: string[];
  relatedObjects: string[];
}

interface SalesforceField {
  apiName: string;
  label: string;
  type: SalesforceFieldType;  // text, email, picklist, lookup, etc.
  required: boolean;
  smartFillType: string;       // Maps to data generator
  selectors: {
    lightning: string;  // e.g., 'lightning-input[field-name="Name"]'
    classic?: string;   // e.g., 'input#acc2'
    lwc?: string;       // e.g., 'c-account-form lightning-input'
  };
}
```

### Smart Fill Type Mappings

| SmartFillType | Generator | Examples |
|---------------|-----------|---------|
| `accountName` | company | Acme Corporation, Global Tech Inc |
| `accountType` | picklist | Customer - Direct, Partner, Prospect |
| `industry` | picklist | Technology, Healthcare, Finance |
| `annualRevenue` | currency | 1000000, 5000000 |
| `email` | email | john.smith@company.com |
| `phone` | phone | (555) 123-4567 |
| `website` | url | https://www.example.com |
| `stageName` | picklist | Prospecting, Qualification, Negotiation |

### Export Formats

- **CSV**: `testDataFactory.recordsToCSV(records)` -- comma-separated with header row
- **JSON**: Records array is directly JSON-serializable
- **Insert to Org**: Generated records can be pasted into the Bulk Data Loader tab

---

## 9. Configuration

### AI Configuration (v3.14.0 — BYOK)

AI-powered Salesforce features (test generation, data generation) are **OFF by default**:

- Users provide their own OpenAI/Anthropic key via Settings > AI tab (BYOK — encrypted with Fernet, stored server-side)
- Server admins can set `OPENAI_API_KEY` env var as fallback for all users
- Key resolution: BYOK key → server env var → disabled
- AI feature toggles (per org/project): `sf_test_generation`, `sf_data_generation`
- Core Salesforce features (multi-org management, SOQL editor, metadata validation, Apex execution, OAuth) work fully without AI

### Environment Variables

| Variable | Purpose | Used By |
|----------|---------|---------|
| `SF_USERNAME` | Salesforce username | `salesforce_api.py`, `metadata_service.py`, `soql_service.py` |
| `SF_PASSWORD` | Salesforce password | `metadata_service.py`, `soql_service.py` |
| `SF_SECURITY_TOKEN` | Security token (appended to password) | `metadata_service.py`, `soql_service.py` |
| `SF_DOMAIN` | Auth domain: `login` (prod), `test` (sandbox) | All backend services |
| `SF_SESSION_ID` | Active session ID / access token | `salesforce_api.py` (get_salesforce_client) |
| `SF_INSTANCE_URL` | Salesforce instance URL (e.g., `https://na1.salesforce.com`) | `salesforce_api.py` |
| `SF_CLIENT_ID` / `SALESFORCE_CLIENT_ID` | Connected App Client ID | `auth_service.py` |
| `SF_CLIENT_SECRET` / `SALESFORCE_CLIENT_SECRET` | Connected App Client Secret | `auth_service.py` |
| `SF_PRIVATE_KEY` | PEM-encoded private key for JWT auth | `auth_service.py` |
| `SF_PRIVATE_KEY_PATH` | Path to private key file | `auth_service.py` |
| `SF_REFRESH_TOKEN` | OAuth refresh token | `auth_service.py` |

### Credentials File

**Path:** `backend/app/config/salesforce_credentials.json`

```json
{
    "org_name": "Default Org",
    "instance_url": "https://orgfarm-xxx.develop.my.salesforce.com",
    "access_token": "00D...",
    "refresh_token": "5Aep...",
    "client_id": "3MVG9...",
    "client_secret": "...",
    "username": "user@example.com",
    "created_at": "2026-01-15T10:00:00",
    "notes": "OAuth tokens. Access token expires in 2 hours, use refresh_token to get new one."
}
```

This file is:
- Created by `save_credentials_to_file()` after successful OAuth callback
- Read by `auto_connect_salesforce()` on backend startup
- Read by `get_salesforce_client()` as fallback when env vars are empty
- Updated with new access tokens after refresh

### Frontend Storage

| Key | Storage | Content |
|-----|---------|---------|
| `salesforce_orgs` | localStorage | Array of `SalesforceOrg` objects (includes tokens) |
| `salesforce_current_org` | localStorage | ID of the currently selected org |
| `salesforce_query_history` | localStorage | Array of `{ query, timestamp }` for SOQL history |
| `salesforce_api_history` | localStorage | Array of API playground request history |

### Metadata Cache

**Path:** `backend/app/services/salesforce/metadata_cache/sf_metadata.json`

Caches object describes to enable offline validation. Contains objects, fields, picklists, and record types. Loaded lazily on first validation request.

### Python Dependencies

| Package | Purpose |
|---------|---------|
| `simple-salesforce` | Salesforce REST API client |
| `PyJWT` | JWT token creation for Bearer flow |
| `cryptography` | RSA key handling for JWT signing |
| `httpx` | Async HTTP client for OAuth token exchange |

---

## 10. Known Gaps & TODOs

### Missing Functionality

| Gap | Description | Severity |
|-----|-------------|----------|
| **No Zustand store** | All state lives in `useState` inside `SalesforceToolsPage.tsx` (2,118 lines). Unlike other modules, there is no Zustand store for state persistence across navigation. Switching away from the page loses all in-memory state. | Medium |
| **Token stored in localStorage** | Access tokens and refresh tokens are stored in browser localStorage via `SalesforceApiService`. This is a security concern for production environments. | Medium |
| **No real-time WebSocket** | Unlike test execution (which has WebSocket progress), Salesforce operations (bulk jobs, Apex tests) use polling intervals. No WebSocket integration for real-time updates. | Low |
| **Hardcoded Connected App Client ID** | The OAuth refresh token flow in `salesforce-api.ts` uses a hardcoded Connected App Client ID (`3MVG9I9urWNI...`). This should be configurable. | Low |
| **OAuth popup CORS** | The OAuth flow uses a popup window and polling. If the popup is blocked, the flow fails silently (5-minute timeout). | Low |
| **No test persistence** | Functional, integration, regression, and UAT test components build tests in-memory but do not persist them to the backend test repository. | Medium |
| **Orchestrator scan is mock-capable** | The `/api/salesforce/orchestrator/scan` endpoint falls back to mock data when no Salesforce connection is available. This is useful for demos but could confuse users. | Low |
| **Component tab overflow** | With 22+ tabs, the tab bar overflows on smaller screens. The tabs use `flex-wrap` but can be hard to navigate. | Low |

### Potential Improvements

| Improvement | Details |
|-------------|---------|
| **Zustand store** | Extract state from `SalesforceToolsPage` into a dedicated Zustand store with `persist` middleware, consistent with other modules |
| **Secure token storage** | Move token management entirely to the backend. Frontend should not hold access tokens. Use session cookies instead. |
| **WebSocket for bulk jobs** | Stream bulk job progress and Apex test results via WebSocket instead of polling |
| **Persist generated tests** | Wire the functional/integration/regression/UAT test builders to the `test-cases` CRUD API for persistence |
| **CI/CD integration** | Document how to use the token pool + JWT auth in headless CI/CD pipelines |
| **Custom object templates** | Allow users to create and save custom object templates for their org's custom objects |

---

*Last updated: 2026-02-20*
