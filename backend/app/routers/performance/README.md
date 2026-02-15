# Performance Routers

Backend API routers for load testing, protocol recording, and enterprise-scale data queries. Handles virtual user simulation, HTTP traffic capture, and paginated queries for large datasets.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `performance_api.py` | 2,410 | `/api/performance` | 80 | Load testing engine -- scenarios, execution, results, transaction analysis, metrics, 8 load patterns |
| `protocol_recording_api.py` | 522 | `/api/protocol-recording` | 14 | HTTP traffic capture during browser sessions, HAR import/export |
| `scale_api.py` | 157 | `/api/v2` | 8 | Paginated queries for 100K+ test cases, performance-optimized data access |

**Total: 102 endpoints across 3 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/performance/start` | POST | performance_api | Start load test execution |
| `/api/performance/stop` | POST | performance_api | Stop running load test |
| `/api/performance/results/{id}` | GET | performance_api | Get test results with metrics |
| `/api/performance/scenarios` | GET/POST | performance_api | Scenario CRUD |
| `/api/performance/generate-script` | POST | performance_api | Generate load test script (QAAI, k6, JMeter) |
| `/api/protocol-recording/start` | POST | protocol_recording_api | Start HTTP traffic capture |
| `/api/protocol-recording/stop` | POST | protocol_recording_api | Stop capture and export HAR |
| `/api/v2/test-cases` | GET | scale_api | Paginated test case queries |

## Load Patterns Supported

Constant, Ramp, Spike, Stress, Soak, Breakpoint, Wave, Custom

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/performance/` | Virtual user simulation, HAR processing, script generation, headless execution, transaction analysis |

## Related Frontend Module

- `src/modules/performance/` -- Performance page, VirtualUserGenerator page
