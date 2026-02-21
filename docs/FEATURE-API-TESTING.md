# Feature: API Testing

Flowstral's API Testing module is a response-driven API testing platform comparable to Postman, ReadyAPI, and SoapUI. It supports REST, SOAP/WSDL, GraphQL, gRPC, Kafka, MQTT, WebSocket, and AMQP (RabbitMQ) protocols with real HTTP execution, click-to-assert from live responses, request chaining, and multi-format import/export.

## Architecture (Post-Redesign Feb 2026)

```
Frontend (React + Zustand)                   Backend (FastAPI + aiohttp/httpx)
+----------------------------------+         +-----------------------------------+
| EnhancedAPITesting.tsx (6 tabs)  |         | /api/v2/testing/* (execution)     |
|   - Builder (default tab)        | ------> | /api/import/*    (spec parsing)   |
|   - Import (spec import)         |         | /api/request-chain/* (chaining)   |
|   - Chains (multi-step flows)    |         +-----------------------------------+
|   - Execute (batch runner)       |                     |
|   - Environments                 |         Real HTTP via aiohttp / httpx
|   - Results (reports)            |                     |
+----------------------------------+               Target APIs
|                                  |
| CollectionSidebar (Zustand)      |
|   - Folders & requests           |
|   - Drag & drop reorder          |
|   - Context menu (edit/delete)   |
|   - Run single / folder / all    |
+----------------------------------+
```

### What Changed (Redesign: Feb 10, 2026)

| Before | After |
|--------|-------|
| 9 tabs (Builder, Templates, Import, Chains, Execute, Security, Environments, Mock, Results) | 6 tabs (Builder, Import, Chains, Execute, Environments, Results) |
| Import auto-generated ~100 tests in 8 categories (security, performance, boundary, contract, negative, data-driven, integration, functional) from spec alone | Import creates clean endpoint list only; users build assertions from live responses |
| Default tab: Import | Default tab: Builder |
| Templates tab with 3 protocol demos | Removed (absorbed into Import quick-import) |
| Tests tab (hidden dead code) | Removed |
| Runs tab (hidden dead code) | Removed |
| Security tab (OWASP scanner UI) | Removed from tabs (backend still available via API) |
| Mock Server tab | Removed from tabs (backend still available via API) |
| testSuite auto-bridge useEffect silently pushed phantom tests to sidebar | Removed |
| Legacy testSuite persistence to `/api/db/api-collections/default` | Removed (Zustand store handles all persistence) |

### Design Philosophy: Response-Driven Testing

**The old approach** (spec-guessing): Import spec -> auto-generate ~100 tests with hardcoded assertions -> overwhelm user with noise they can't customize.

**The new approach** (response-driven, like Postman/ReadyAPI):
1. Import spec -> one clean request per endpoint in sidebar
2. Click any request -> Builder opens with URL pre-filled
3. Send request -> see actual live response
4. Click response fields to add assertions (or click "Auto-Assert" for all top-level fields)
5. Organize into folders, rename, duplicate for test variations
6. Run single / folder / all from sidebar

This matches how professional testers actually work: assertions built from **real responses**, not guesses.

## 6 Tabs Overview

### 1. Builder (Default Tab)

**Component:** `src/modules/api-testing/components/RequestBuilder.tsx`

A full-featured HTTP request builder (Postman-like):
- URL bar with method selector (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Tabs: Params, Headers, Body (JSON/Form/XML/Raw/None), Auth (Bearer/Basic/API Key), Assertions
- Response viewer with Body, Headers, Console, and Assert Builder tabs
- **Auto-Assert button** (green, in response header): generates assertions from the actual response:
  - Status code assertion (from real response status)
  - Response time assertion (based on actual response time, 2x threshold)
  - Content-Type header assertion
  - JSONPath assertions for all top-level response fields (equals for primitives, exists for objects/arrays)
  - Array length assertion (if response is an array)
- Response Tree Explorer with click-to-assert on individual fields
- **Response Snapshot & Diff**: save a baseline response, re-send to instantly see added/removed/changed fields. Detects endpoint changes immediately.
- **Schema Assert** button: auto-generates a JSON Schema from the actual response structure as a contract assertion. If the API changes its shape (new fields, removed fields, type changes), the assertion fails.
- **Negative Test Generator** dropdown: one-click to create common negative test variations from the current request:
  - Wrong HTTP method (405)
  - Missing authentication (401)
  - Malformed JSON body (400)
  - Empty body (400)
  - Non-existent resource (404)
- **Resizable response panel** (drag handle, 150px-800px)
- Save/Load requests, "Add to Chain" button

**How Send works:**
1. Builds URL with query params and auth headers
2. Proxies through backend: `POST /api/v2/testing/execute` with `mode: "automated"`
3. Backend makes real HTTP call via `aiohttp.ClientSession`
4. Frontend extracts `actual_status`, `response_body`, `response_headers`, `response_time_ms`
5. Displays formatted response with proper HTTP status text (200 OK, 404 Not Found, etc.)

**Assert Builder (ResponseTreeExplorer) - 4 views:**
- **Body (Tree)**: Browse JSON response as a collapsible tree. Click any field to add a JSONPath assertion (leaf = value assert, parent = exists). Save as variable: click to store a response value as `{{name}}` for use in next request/chain.
- **Table**: Flat spreadsheet view of all leaf fields showing field name, type, value, JSONPath, and one-click assert button per row. Best for quickly scanning and selecting fields to assert.
- **Headers**: All response headers with one-click assert buttons.
- **Quick Assert**: One-click assertions for status, time, and suggested top-level fields. "Assert All Top-Level Fields" button for bulk add.
- **Resizable panel**: drag handle at bottom edge to adjust height (150px-800px)
- **Overflow-safe**: action buttons (assert, save, copy) are grouped in a shrink-0 container, never hidden by long text values

### 2. Import (Specification Import)

**Supported formats:** OpenAPI/Swagger (JSON/YAML), Postman Collection (JSON), WSDL/SOAP (XML), GraphQL SDL, HAR

**Three import methods:**
1. **File upload** - Drag & drop or click to select
2. **URL fetch** - Proxied through backend (`/api/import/fetch-url`) to avoid CORS
3. **Paste text** - Directly paste spec content

**Quick Import samples** (one-click, embedded in UI):
- **JSONPlaceholder** - 10 REST endpoints
- **ReqRes Auth** - 7 endpoints (login, register, CRUD)
- **Petstore** - 7 OpenAPI endpoints

**Import flow (simplified):**
1. Frontend sends spec to `POST /api/import/spec` (or `/api/import/spec/file` for uploads)
2. Backend's `APISpecParser` normalizes to a common format with paths and operations
3. Frontend displays parsed endpoints in a table with method badges, paths, and summaries
4. User clicks "Add All Endpoints" or selects specific ones with "Add Selected"
5. Each endpoint becomes one clean request in the sidebar collection (with proper base URL, sample body for POST/PUT/PATCH, Content-Type header)
6. **No test generation call** - the enhanced test suite generation endpoint is NOT called during import. No "Happy Path"/"Invalid Data Type" suffixed names. Clean endpoint names only.

**Tip displayed to users:** "Add endpoints to the collection, then click any in the sidebar to open in Builder. Send the request, see the live response, and click response fields to add real assertions."

**Export:** Postman Collection v2.1 and HAR 1.2 export via backend endpoints.

### 3. Chains (Request Chain Builder)

**Component:** `src/modules/api-testing/components/RequestChainBuilder.tsx`

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

### 4. Execute (Collection-Driven Batch Runner)

Runs tests from the sidebar collection:
1. Reads requests and folders from the active Zustand collection (single source of truth)
2. Select/deselect individual tests or entire folders
3. Execute via `POST /api/v2/testing/execute`
4. Results flow into the Results tab automatically

### 5. Environments

Create and manage environments with:
- Name, type (dev/staging/production), base URL
- Variable resolution with `{{var}}` syntax
- Persisted via API and localStorage

**Database connectivity:** PostgreSQL, MySQL, SQLite, MongoDB, MSSQL for data-driven testing and database assertions. See the [Database Integration](#database-integration) section below for full details.

### 6. Results (Reports & Export)

Five report format views:
1. **Summary** - Grid with Total/Passed/Failed/Pass Rate + performance metrics
2. **HTML Report** - Styled standalone HTML table (rendered in iframe)
3. **JUnit XML** - Compatible with CI/CD tools
4. **JSON** - Raw JSON export
5. **Allure** - Allure-format JSON (for `allure generate` CLI)

## Collection Sidebar

**Component:** `src/modules/api-testing/components/CollectionSidebar.tsx`

**State:** `src/modules/api-testing/store/apiTestingStore.ts` (Zustand with immer + persist)

The sidebar is the organizational backbone:
- **Collections**: create, rename, delete, import from spec
- **Folders**: create, rename, delete, organize tests by category
- **Requests**: create, edit, duplicate, delete, move between folders
- **Drag & drop**: reorder requests within and between folders
- **Context menu**: right-click for full actions (edit, delete, duplicate, move to folder)
- **Run buttons**: run single request, run all in folder, run entire collection
- **Persistence**: immediate save (`_saveCollectionNow`) for user-initiated mutations, debounced save for bulk operations, backend sync with `updated_at` timestamp comparison

## Database Integration

The API testing module includes deep database integration for data-driven testing, post-request assertions, and interactive schema exploration. Supports PostgreSQL, MySQL, SQLite, MongoDB, and MSSQL.

### Database Workbench (Frontend)

**Location:** `src/modules/api-testing/pages/EnhancedAPITesting.tsx` — rendered in the Environments tab, replacing the old minimal DB connection card.

The Database Workbench is a full-featured database interaction panel with 4 sections:

**1. Connection Form** (collapsible via `<details>`):
- Auto-collapses when active connections exist, open by default when none
- Fields: Connection ID, DB type (PostgreSQL/MySQL/SQLite/MongoDB/MSSQL), host, port, database name, username, password
- Connects via `POST /api/v2/testing/database/connect`

**2. Active Connections List:**
- Shows all active connections with green status dot, connection ID, and DB type badge
- Per-connection **Disconnect** button (red X) → `DELETE /api/v2/testing/database/{connection_id}`
- Refresh button to reload connections from `GET /api/v2/testing/database/connections`

**3. Schema Browser** (`DbSchemaBrowser` inline component):
- Select a connection from dropdown → fetches tables via `GET /api/v2/testing/database/{connection_id}/tables`
- Displays table list with table name, type (TABLE/VIEW), and estimated row count
- Click a table → fetches columns via `GET /api/v2/testing/database/{connection_id}/tables/{table_name}/columns`
- Column details show: column name, data type, nullable status (YES/NO badge), default value, and primary key indicator (key icon)

**4. SQL Query Editor** (`DbQueryEditor` inline component):
- Connection selector dropdown + SQL query textarea
- Execute with button or **Ctrl+Enter** keyboard shortcut
- Shows execution time in milliseconds
- Results displayed in a scrollable table with column headers auto-detected from response
- **Copy CSV** and **Copy JSON** buttons for result export
- **Query History**: collapsible list of last 20 queries per session; click any to reload into textarea

### Database Assertions (12th Assertion Type)

**Constants:** `src/modules/api-testing/components/constants.ts`

The `database` assertion type validates database state after an API call completes. It uses 7 specialized operators defined in `DB_ASSERTION_OPERATORS`:

| Operator | Label | Description |
|----------|-------|-------------|
| `equals` | Result Equals | Query result matches expected value |
| `contains` | Result Contains | Query result contains expected substring |
| `count` | Row Count Equals | Number of result rows equals expected |
| `greater_than` | Row Count Greater Than | Row count exceeds threshold |
| `less_than` | Row Count Less Than | Row count below threshold |
| `not_empty` | Not Empty | Query returns at least one row |
| `is_empty` | Is Empty | Query returns zero rows |

**AssertionConfig type** (updated):
```typescript
interface AssertionConfig {
  id: string;
  type: string;         // "database" for DB assertions
  name: string;
  expected: string;
  path: string;
  operator: string;
  schema: string;
  db_connection_id?: string;  // Which active DB connection to use
  db_query?: string;          // SQL query to run after API call
  db_comparison?: string;     // DB_ASSERTION_OPERATORS value
}
```

**AssertionsPanel UI** (`src/modules/api-testing/components/AssertionsPanel.tsx`):
When `type="database"` is selected, the panel shows a specialized form:
- **Connection selector** dropdown (populated from `dbConnections` prop) with Database icon per option
- **SQL query** textarea for the assertion query
- **Comparison mode** dropdown with `DB_ASSERTION_OPERATORS`
- **Expected value** input (hidden for `not_empty`/`is_empty` operators)

The `dbConnections` prop flows from `EnhancedAPITesting.tsx` → `RequestBuilder.tsx` → `AssertionsPanel.tsx`.

### Data-Driven Testing from Database

**Component:** `src/modules/api-testing/components/DataDrivenPanel.tsx`

The DataDrivenPanel has 3 data source tabs: **File Upload**, **Inline**, and **Database Query**.

**Database Query tab** (`TabsContent value="database"`):
- Connection selector dropdown (from `dbConnections` prop passed by `EnhancedAPITesting.tsx`)
- SQL query input for the data extraction query
- Row limit input (default: 100)
- **Load Data** button triggers `handleDatabaseQuery()`:
  1. Calls `POST /api/v2/testing/data-driven/source` with `source_type: "database_query"`, `connection_id`, `query`, `row_limit`
  2. Backend's `DataDrivenEngine.create_database_source()` executes the query via `DatabaseConnector.extract_test_data()`
  3. Results wrapped in `InlineDataSource` and returned with preview data
  4. Frontend displays row count and data preview table

### Backend Services

**DatabaseConnector** (`backend/app/services/api_testing/database_connector.py`):

| Method | Purpose | Returns |
|--------|---------|---------|
| `connect(config)` | Establish DB connection | `connection_id` |
| `execute_query(connection_id, query)` | Run SQL query | `List[Dict]` rows |
| `extract_test_data(connection_id, query, limit)` | Query with auto-LIMIT | `List[Dict]` rows |
| `list_tables(connection_id)` | List all tables/collections | `List[{table_name, table_type, row_count}]` |
| `get_table_columns(connection_id, table_name)` | Get column metadata | `List[{column_name, data_type, is_nullable, column_default, is_primary_key}]` |
| `assert_database_state(connection_id, query, operator, expected)` | Run assertion query | `{passed, actual, expected, message}` |
| `disconnect(connection_id)` | Close and remove connection | `bool` |
| `get_active_connections()` | List active connections | `List[Dict]` |

**Table listing** uses database-specific SQL:
- **PostgreSQL**: `information_schema.tables` + `pg_stat_user_tables` for row estimates
- **MySQL**: `information_schema.tables` with `TABLE_ROWS`
- **SQLite**: `sqlite_master WHERE type='table'`
- **MongoDB**: `list_collection_names()` with `estimated_document_count()`
- **MSSQL**: `information_schema.tables` + `sys.dm_db_partition_stats` for row estimates

**Column metadata** uses database-specific queries:
- **PostgreSQL/MySQL/MSSQL**: `information_schema.columns` joined with constraint info for PK detection
- **SQLite**: `PRAGMA table_info(table_name)`
- **MongoDB**: Samples first document and infers field types

**DataDrivenEngine** (`backend/app/services/api_testing/data_driven_engine.py`):

| Method | Purpose |
|--------|---------|
| `create_database_source(name, connection_id, query, row_limit)` | Executes query via `DatabaseConnector.extract_test_data()`, wraps result in `InlineDataSource`, returns `source_id` |

### Database API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/database/connect` | Connect to a database (PostgreSQL, MySQL, SQLite, MongoDB, MSSQL) |
| POST | `/api/v2/testing/database/query` | Execute SQL query against connected DB |
| POST | `/api/v2/testing/database/assert` | Assert database state (7 operators) |
| GET | `/api/v2/testing/database/connections` | List all active database connections |
| DELETE | `/api/v2/testing/database/{connection_id}` | Disconnect from a specific database |
| GET | `/api/v2/testing/database/{connection_id}/tables` | List tables/collections with types and row estimates |
| GET | `/api/v2/testing/database/{connection_id}/tables/{table_name}/columns` | Get column metadata (name, type, nullable, default, PK) |
| POST | `/api/v2/testing/data-driven/source` | Create data source (now accepts `source_type: "database_query"`) |

### Prop Wiring

Database connections are managed as state in `EnhancedAPITesting.tsx` (`dbConnections` state) and passed down to child components:

```
EnhancedAPITesting.tsx (dbConnections state)
  ├── RequestBuilder.tsx (dbConnections prop)
  │     └── AssertionsPanel.tsx (dbConnections prop) — for database assertion type
  └── DataDrivenPanel.tsx (dbConnections prop) — for database query data source
```

## State Management

The API testing module uses a dedicated Zustand store (`apiTestingStore.ts`) with:
- `immer` middleware for immutable state updates
- `persist` middleware for localStorage backup
- Backend sync via `/api/db/api-collections/*` endpoints
- Debounced saves for performance, immediate saves for critical mutations (delete, move, create folder)
- `updated_at` timestamp comparison on load to prevent overwriting newer local data

## Public Test Endpoints

All demos use real public APIs (no localhost):

| API | URL | Used For |
|-----|-----|----------|
| **JSONPlaceholder** | `https://jsonplaceholder.typicode.com` | REST CRUD, quick import |
| **ReqRes** | `https://reqres.in` | Auth flows, pagination, quick import |
| **Petstore** | `https://petstore.swagger.io/v2` | OpenAPI import, quick import |
| **Countries GraphQL** | `https://countries.trevorblades.com/graphql` | GraphQL testing |
| **CountryInfo SOAP** | `http://webservices.oorsprong.org/.../CountryInfoService.wso` | SOAP/WSDL testing |
| **HTTPBin** | `https://httpbin.org` | Headers, auth, status codes |

## Backend Endpoint Reference

### Test Execution (`/api/v2/testing`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/execute` | Execute test suite (automated/manual/ci_cd/load) |
| POST | `/execute/load` | Load test execution |
| POST | `/test-suite/generate` | Generate test suite from spec |
| POST | `/security/scan` | OWASP security scan (available via API) |
| POST | `/report/generate` | Generate execution report |
| GET | `/capabilities` | Full capability list |
| GET | `/protocols` | Supported protocols |

### Database (`/api/v2/testing/database`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/connect` | Connect to database (PostgreSQL, MySQL, SQLite, MongoDB, MSSQL) |
| POST | `/query` | Execute SQL query |
| POST | `/assert` | Assert database state (7 operators) |
| GET | `/connections` | List active connections |
| DELETE | `/{connection_id}` | Disconnect from database |
| GET | `/{connection_id}/tables` | List tables with types and estimated row counts |
| GET | `/{connection_id}/tables/{table_name}/columns` | Get column metadata (name, type, nullable, default, PK) |

### Data-Driven (`/api/v2/testing/data-driven`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/source` | Create data source (csv, json, excel, inline, database_query) |

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

### Environments (`/api/v2/testing/environment`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/create` | Create environment |
| GET | `/` | List environments |
| GET | `/{id}` | Get environment |
| PUT | `/{id}` | Update environment |
| DELETE | `/{id}` | Delete environment |

### Collection Persistence (`/api/db/api-collections`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List all collections |
| GET | `/{id}` | Get collection by ID |
| PUT | `/{id}` | Update collection |
| DELETE | `/{id}` | Delete collection |

## Configuration

The API testing module uses the centralized backend URL from `src/lib/api-config.ts`:

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://qaone-production.up.railway.app';
```

Both `constants.ts` (used by RequestBuilder, ChainBuilder) and `EnhancedAPITesting.tsx` import from this single source.

## Key Files

| File | Purpose |
|------|---------|
| `src/modules/api-testing/pages/EnhancedAPITesting.tsx` | Main page (6 tabs, ~4077 lines) |
| `src/modules/api-testing/store/apiTestingStore.ts` | Zustand store (collections, folders, requests, execution) |
| `src/modules/api-testing/components/CollectionSidebar.tsx` | Sidebar with folders, requests, drag-drop, run buttons |
| `src/modules/api-testing/components/RequestBuilder.tsx` | Postman-like request builder with Auto-Assert |
| `src/modules/api-testing/components/ResponseTreeExplorer.tsx` | Response tree with click-to-assert, resizable panel |
| `src/modules/api-testing/components/AssertionsPanel.tsx` | Assertion editor (12 types including database, 13 operators + 7 DB operators) |
| `src/modules/api-testing/components/RequestChainBuilder.tsx` | Multi-step chain builder |
| `src/modules/api-testing/components/ChainStepCard.tsx` | Chain step UI card |
| `src/modules/api-testing/components/ChainResultsView.tsx` | Chain results display |
| `src/modules/api-testing/components/EnvironmentManager.tsx` | Environment management with variable resolution |
| `src/modules/api-testing/components/constants.ts` | Shared types, constants, API_BASE_URL, DB_ASSERTION_OPERATORS |
| `src/modules/api-testing/components/DataDrivenPanel.tsx` | Data-driven testing panel (file, inline, database query sources) |
| `backend/app/routers/api_testing/enhanced_api_testing_api.py` | FastAPI router (execution, env) |
| `backend/app/routers/api_testing/api_import_api.py` | Import/export router |
| `backend/app/routers/api_testing/request_chaining_api.py` | Chain execution router |
| `backend/app/services/api_testing/test_execution_engine.py` | Real HTTP execution via aiohttp |
| `backend/app/services/api_testing/request_chaining.py` | Chain engine (httpx, jsonpath_ng) |
| `backend/app/services/connectors/api_spec_parser.py` | OpenAPI/Postman/WSDL/GraphQL/HAR parser |
| `backend/app/services/api_testing/database_connector.py` | DatabaseConnector — connect, query, list_tables, get_table_columns, assert, disconnect |
| `backend/app/services/api_testing/data_driven_engine.py` | DataDrivenEngine — CSV, JSON, Excel, inline, and database_query data sources |

## Day-to-Day Tester Workflow

1. **Import API**: Paste OpenAPI spec URL or upload Postman collection -> "Add Endpoints" -> clean sidebar with one request per endpoint
2. **Test an endpoint**: Click in sidebar -> Builder opens with URL pre-filled -> Click Send -> See response
3. **Add assertions**: Click response fields to assert specific values, OR click "Auto-Assert" to assert all top-level fields at once
4. **Organize**: Drag requests into folders, rename, duplicate for variations (e.g., "GET /users - valid", "GET /users - invalid ID")
5. **Run**: Click Run on a single request, a folder, or "Run All" from sidebar footer
6. **Review results**: Results tab shows pass/fail with full request/response details, export as JUnit/HTML/JSON

## Removed Features (Still Available via Backend API)

The following features were removed from the frontend tabs but their backend endpoints remain available:

- **OWASP Security Scanner**: `POST /api/v2/testing/security/scan` - still works for programmatic use
- **Mock Server**: `POST /api/v2/testing/mock/server` - still works for programmatic use
- **Auto-Generated Test Categories**: Backend engine (`EnhancedAPITestEngine`) still exists but is no longer called from the import flow

---

*Last updated: 2026-02-21*
*Generated by code audit of the Flowstral API testing feature.*
