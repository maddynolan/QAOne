# API Testing

Multi-protocol API testing with collections, environments, request chaining, assertions, and spec import. Supports REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, and AMQP protocols.

## Architecture

The module is organized around a central page (`EnhancedAPITesting`) that orchestrates 16 specialized components and a persistent Zustand store:

1. **Request Building** -- `RequestBuilder` provides URL, method, headers, body (Monaco editor), auth configuration, and assertion definition. Requests are organized into collections via `CollectionSidebar`.
2. **Environment & Variables** -- `EnvironmentManager` manages dev/staging/prod environments with variable substitution. Variables are resolved at request time from the active environment.
3. **Chaining** -- `RequestChainBuilder` links multiple API calls with variable extraction (JSONPath, regex, headers) between steps. Results are visualized in `ChainResultsView` and `ChainStepCard`.
4. **State** -- All requests, collections, environments, and chains persist in a Zustand store (`apiTestingStore`) with `devtools` + `persist` + `immer` middleware. Data is saved to both localStorage and the backend database.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/EnhancedAPITesting.tsx` | 4,348 | Main API testing page -- builder, import, execute, tabs for requests/chains/environments |
| `pages/APICoverageMap.tsx` | 364 | API endpoint coverage visualization map |
| `pages/APIImport.tsx` | 420 | OpenAPI/Swagger/HAR/Postman spec import with base URL detection |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/RequestBuilder.tsx` | 2,608 | Build API requests -- URL, method, headers, body (Monaco), auth, assertions |
| `components/CollectionSidebar.tsx` | 1,580 | Collection/folder tree -- drag-drop reorder, inline rename, multi-select delete, run all |
| `components/EnvironmentManager.tsx` | 948 | Environment CRUD with variable key-value editing and active environment selection |
| `components/ResponseTreeExplorer.tsx` | 769 | JSON response tree viewer with expand/collapse and copy-path |
| `components/SecurityScanPanel.tsx` | 498 | Security scan configuration and results for API endpoints |
| `components/RequestChainBuilder.tsx` | 496 | Chain multiple API calls with variable extraction between steps |
| `components/ChainStepCard.tsx` | 478 | Individual chain step result card with request/response detail |
| `components/MockServerPanel.tsx` | 444 | Mock server setup for service virtualization |
| `components/DataDrivenPanel.tsx` | 399 | Data-driven test configuration with CSV/JSON data sources |
| `components/constants.ts` | 375 | ASSERTION_TYPES (11 types), ASSERTION_OPERATORS, AssertionConfig type definitions |
| `components/WebSocketClient.tsx` | 312 | WebSocket protocol testing client with message send/receive |
| `components/AssertionsPanel.tsx` | 263 | Assertion editor -- 11 types, multiple operators, pass/fail display |
| `components/CodeEditor.tsx` | 231 | Monaco-based code editor wrapper for request body |
| `components/ChainResultsView.tsx` | 212 | Chain execution results overview with per-step summary |
| `components/codeSnippets.ts` | 163 | Code snippet generation for cURL, Python, JavaScript, etc. |
| `components/TabErrorBoundary.tsx` | 61 | Error boundary wrapper for isolating tab-level failures |

### Store

| File | Lines | Purpose |
|------|-------|---------|
| `store/apiTestingStore.ts` | 2,151 | Zustand store with devtools + persist + immer -- manages requests, chains, collections, folders, environments, variables |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages, components, and store |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/testing/execute` | POST | Execute API test (any protocol) |
| `/api/v2/testing/collections` | GET/POST | List and create collections |
| `/api/v2/testing/collections/{id}` | GET/PUT/DELETE | Collection CRUD |
| `/api/v2/testing/environments` | GET/POST | List and create environments |
| `/api/v2/testing/environments/{id}` | PUT/DELETE | Environment update/delete |
| `/api/import/spec` | POST | Import OpenAPI/Swagger spec (returns parsed endpoints + base_url) |
| `/api/import/spec/file` | POST | Import spec via file upload |
| `/api/import/fetch-url` | GET | Fetch spec from URL (backend proxy for CORS) |
| `/api/import/har` | POST | Import HAR file |
| `/api/import/generate-tests` | POST | Generate test cases from API specs |
| `/api/chain/execute` | POST | Execute request chain |
| `/api/chain` | GET/POST | List and create request chains |

## Supported Protocols

| Protocol | Description |
|----------|-------------|
| REST | Standard HTTP methods with JSON/XML/form bodies |
| SOAP/WSDL | XML-based web services with WSDL import |
| GraphQL | Query/mutation/subscription with schema introspection |
| gRPC | Protocol Buffers with proto file import |
| Kafka | Message produce/consume with topic management |
| MQTT | Pub/sub messaging with broker connection |
| WebSocket | Bidirectional real-time messaging |
| AMQP | RabbitMQ message queue testing |

## Assertion Types

`status_code`, `response_time`, `jsonpath`, `schema`, `contains`, `not_contains`, `regex`, `header`, `equals`, `xpath`, `matches_baseline`

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`
- **External**: React 18, Zustand (with devtools/persist/immer), Monaco Editor, Tailwind CSS, Radix UI, Axios, Lucide icons

## Testing Notes

- The `apiTestingStore` persists to localStorage; clear storage between test runs to avoid state bleed.
- Spec import has a 5-layer base URL resolution chain; test with OpenAPI 3.x, Swagger 2.0, and edge cases (no servers field, relative paths).
- Collection sidebar inline rename uses `onBlur` with 150ms delay -- test rapid click-away scenarios.
- Request chaining variable extraction supports JSONPath, regex, and header sources -- test each extraction type.
- WebSocket client requires a running WebSocket server for integration testing.
- Monaco editor may not render in JSDOM/headless test environments; mock or skip for unit tests.
