# Recorder Routers

Backend API routers for browser test recording via CDP, Playwright, and the Flowstral pipeline. These routers handle recording session lifecycle, event ingestion, code generation, and engine operations.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `playwright_recorder_api.py` | 3,516 | `/api/flowstral` | 44 | Playwright recorder -- event ingestion, session management, code generation, step editing, playback |
| `flowstral_api.py` | 839 | `/api/flowstral` | 10 | Flowstral pipeline -- start/stop recording, session streaming, Action Graph operations |
| `flowstral_engine_api.py` | 549 | `/flowstral` | 11 | Flowstral engine operations -- smart element finding, page intelligence, code generation |
| `cdp_recorder_api.py` | 444 | `/cdp-recorder` | 13 | CDP recorder -- Chrome DevTools Protocol-based recording with direct browser launch |
| `flowstral_config_api.py` | 167 | `/api/flowstral/projects` | 4 | Flowstral project configuration -- project-level recording settings |

**Total: 82 endpoints across 5 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/flowstral/start-recording` | POST | flowstral_api | Start Flowstral pipeline recording session |
| `/api/flowstral/stop-recording` | POST | flowstral_api | Stop and finalize recording |
| `/api/flowstral/recorder/events` | POST | playwright_recorder_api | Receive recorded browser events |
| `/api/flowstral/code` | GET | playwright_recorder_api | Get generated Playwright code |
| `/cdp-recorder/start` | POST | cdp_recorder_api | Start CDP recording with browser launch |
| `/cdp-recorder/stop` | POST | cdp_recorder_api | Stop CDP recording |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/flowstral/` | 27 files -- Action Graph, micro-pipelines (DOM, WCAG, Performance), event coalescing, session management |
| `backend/app/services/flowstral_engine/` | 9 files -- SmartElementFinder, code generation, self-healing, page intelligence |

## Related Frontend Module

- `src/modules/recorder/` -- PlaywrightRecorderPage, SelfHealing, ElementRepository
