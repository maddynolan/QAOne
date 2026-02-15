# Exploration Routers

Backend API routers for autonomous application exploration, test generation from exploration sessions, workflow discovery, and the Blaze/Nexus exploratory testing engines.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `exploration_api.py` | 397 | `/api/exploration` | 6 | Core exploration -- start/stop sessions, configure exploration goals, get results |
| `exploration_workflow_api.py` | 290 | `/api/exploration` | 1 | Workflow discovery from exploration sessions |
| `exploration_test_generation_api.py` | 198 | `/api/exploration` | 2 | Generate test cases from exploration results |
| `blaze_api.py` | 182 | `/api/blaze` | 6 | Blaze exploratory testing engine -- autonomous app navigation and issue discovery |
| `nexus_exploratory_api.py` | 145 | `/api/nexus` | 5 | Nexus exploratory testing -- advanced exploration with AI-guided paths |
| `exploration_reporting_api.py` | 105 | `/api/exploration` | 2 | Generate reports from exploration sessions |

**Total: 22 endpoints across 6 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/exploration/start` | POST | exploration_api | Start autonomous exploration session |
| `/api/exploration/stop` | POST | exploration_api | Stop exploration session |
| `/api/exploration/results/{id}` | GET | exploration_api | Get exploration results |
| `/api/exploration/generate-tests` | POST | exploration_test_generation_api | Generate test cases from exploration |
| `/api/exploration/report/{id}` | GET | exploration_reporting_api | Generate exploration report |
| `/api/blaze/explore` | POST | blaze_api | Start Blaze exploratory test |
| `/api/nexus/explore` | POST | nexus_exploratory_api | Start Nexus AI-guided exploration |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/agents/` | AI agent orchestration for autonomous exploration |
| `backend/app/services/ai/` | AI-powered path discovery and test generation |

## Related Frontend Module

- `src/modules/ai-testing/` -- AIExplorerAgent, AIFlowExplorer components
