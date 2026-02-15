# API Testing Routers

Backend API routers for multi-protocol API testing, spec import, and request chaining. Supports REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, and AMQP protocols.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `enhanced_api_testing_api.py` | 1,171 | `/api/v2/testing` | 46 | Multi-protocol API test execution, collections, environments, mock servers, data-driven testing |
| `api_import_api.py` | 731 | `/api/import` | 9 | OpenAPI/Swagger/HAR/Postman spec import, URL fetching (CORS proxy), test generation from specs |
| `request_chaining_api.py` | 412 | `/api/request-chain` | 9 | Request chain CRUD and execution with variable extraction (JSONPath, regex, headers) |

**Total: 64 endpoints across 3 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/v2/testing/execute` | POST | enhanced_api_testing_api | Execute API test (any protocol) |
| `/api/v2/testing/collections` | GET/POST | enhanced_api_testing_api | Collection management |
| `/api/v2/testing/environments` | GET/POST | enhanced_api_testing_api | Environment management with variable substitution |
| `/api/import/spec` | POST | api_import_api | Import OpenAPI/Swagger spec (returns parsed_spec with base_url) |
| `/api/import/fetch-url` | GET | api_import_api | Fetch spec from URL (backend proxy for CORS) |
| `/api/import/har` | POST | api_import_api | Import HAR file |
| `/api/request-chain/execute` | POST | request_chaining_api | Execute request chain |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/api_testing/` | EnhancedAPITestEngine, APISpecParser, DatabaseConnector, SchemaInferenceEngine, ServiceVirtualization, ReportingEngine |

## Related Frontend Module

- `src/modules/api-testing/` -- EnhancedAPITesting page, 16 components, apiTestingStore
