# 🚀 ArisTrace Performance Testing Architecture

**Version:** 2.0  
**Last Updated:** January 2026  
**Module:** Virtual User Generator (Perf Tab)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture: Control Plane vs Load Plane](#architecture-control-plane-vs-load-plane)
3. [System Components](#system-components)
4. [Load Test Patterns](#load-test-patterns)
5. [User Personas](#user-personas)
6. [Quick Start Scenarios](#quick-start-scenarios)
7. [Backend Services](#backend-services)
8. [API Endpoints](#api-endpoints)
9. [Metrics Collected](#metrics-collected)
10. [Distributed Load Generation](#distributed-load-generation)
11. [How to Use](#how-to-use)
12. [Scalability](#scalability)

---

## 📖 Overview

The ArisTrace Performance Testing module provides **enterprise-grade load testing** with a proper **Control Plane / Load Plane architecture**:

- **Control Plane (Browser)** - UI for configuration, monitoring, and results
- **Load Plane (Backend)** - Server-side load generation using asyncio workers
- **Scalable** - From 10 to 10,000+ virtual users via distributed nodes
- **Protocol-Level** - Direct HTTP/WebSocket testing without browser overhead

---

## 🏗️ Architecture: Control Plane vs Load Plane

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONTROL PLANE (Browser/UI)                          │
│                    VirtualUserGenerator.tsx                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│    │   Configure  │  │   Monitor    │  │   Results    │                 │
│    │  Test Params │  │  Real-time   │  │   & Export   │                 │
│    └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                          │
│    ✅ Set VU count, duration, pattern                                    │
│    ✅ View live metrics dashboard                                        │
│    ✅ Start/Stop/Pause tests                                             │
│    ✅ Export results to CSV/JSON                                         │
│    ❌ Does NOT generate load (no browser fetch to target)                │
│                                                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │  HTTP API Calls
                                │  ┌─────────────────────────────┐
                                │  │ POST /api/performance/tests/run
                                │  │ GET  /api/performance/tests/{id}/status
                                │  │ GET  /api/performance/metrics/realtime
                                │  │ POST /api/performance/tests/{id}/stop
                                │  └─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LOAD PLANE (Backend/FastAPI)                         │
│                    PerformanceEngine + LoadGenerator                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────────────────────────────────────────────────────┐     │
│    │                   PerformanceEngine                           │     │
│    │  ┌─────────────────┐  ┌─────────────────┐                    │     │
│    │  │  LoadGenerator  │  │ DistributedCtrl │ ← Scale to N nodes │     │
│    │  │  (asyncio pool) │  │                 │                    │     │
│    │  └────────┬────────┘  └─────────────────┘                    │     │
│    │           │                                                   │     │
│    │   ┌───────┴───────┐                                          │     │
│    │   │ VirtualUser   │ × 500+ concurrent                        │     │
│    │   │ VirtualUser   │                                          │     │
│    │   │ VirtualUser   │ → httpx/aiohttp (10K+ conn capable)      │     │
│    │   │ ...           │                                          │     │
│    │   └───────────────┘                                          │     │
│    └──────────────────────────────────────────────────────────────┘     │
│                                                                          │
│    Supporting Services:                                                  │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│    │ Monitoring   │ │ Correlation  │ │ Alerting     │ │ Reporting    │  │
│    │ Service      │ │ Engine       │ │ Service      │ │ Engine       │  │
│    └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │  HTTP/WebSocket Requests
                                │  (Server-side, no browser limits)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TARGET SYSTEM                                    │
│                   (Application Under Test)                               │
│                                                                          │
│                     http://your-app.com                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Browser-Based (Wrong) | Server-Based (Correct) |
|-----------------------|------------------------|
| 6 concurrent connections per domain | 10,000+ concurrent connections |
| Limited by user's laptop | Scale across multiple servers |
| CORS restrictions | No CORS (server-to-server) |
| Results polluted by browser overhead | Clean protocol-level metrics |
| Can't simulate real load | True production-like traffic |

---

## 🧩 System Components

### Frontend (Control Plane)

| Component | File | Purpose |
|-----------|------|---------|
| Virtual User Generator | `src/pages/VirtualUserGenerator.tsx` | UI for configuration and monitoring |

**The UI does NOT:**
- Make HTTP requests to the target system
- Generate actual load
- Measure response times directly

**The UI DOES:**
- Send configuration to backend API
- Poll for real-time metrics
- Display results and graphs
- Allow test control (start/stop/pause)

### Backend (Load Plane)

| Component | File | Purpose |
|-----------|------|---------|
| Performance API | `backend/app/routers/performance_api.py` | REST endpoints |
| Performance Engine | `backend/app/services/performance/performance_engine.py` | Main orchestrator |
| Load Generator | `backend/app/services/performance/load_generator.py` | Virtual user pool |
| Distributed Controller | `backend/app/services/performance/distributed_controller.py` | Multi-node scaling |
| Protocol Handler | `backend/app/services/performance/protocol_handler.py` | HTTP/WS execution |
| Monitoring Service | `backend/app/services/performance/monitoring_service.py` | Metrics aggregation |
| Correlation Engine | `backend/app/services/performance/correlation_engine.py` | Dynamic value extraction |

---

## 📊 Load Test Patterns

| Pattern | Icon | Description | API `profile_type` |
|---------|------|-------------|-------------------|
| **Constant Load** | ➡️ | Maintain steady number of users | `linear` |
| **Ramp Up** | 📈 | Gradually increase users | `linear` |
| **Ramp Down** | 📉 | Gradually decrease users | `linear` |
| **Spike Test** | ⚡ | Sudden burst of users | `spike` |
| **Stress Test** | 🔥 | Push beyond normal capacity | `stress` |
| **Soak/Endurance** | 🕐 | Extended duration test | `endurance` |
| **Breakpoint** | 💥 | Find system breaking point | `capacity` |
| **Wave Pattern** | 🌊 | Cyclic load increases | Custom |

### Pattern Visualization

```
Constant Load:      ────────────────────────
                    
Ramp Up:            ─────────────────/
                                    /
                                   /
                    ______________/

Spike Test:         _______/\______
                          /  \
                    _____/    \_____

Stress Test:               ___/
                          /
                    ─────/
                    
Wave Pattern:       ╱╲╱╲╱╲╱╲╱╲╱╲
```

---

## 👥 User Personas

| Persona | Think Time | Click Delay | Use Case |
|---------|------------|-------------|----------|
| **Casual Browser** | 3-8 seconds | 500-2000ms | E-commerce browsing |
| **Normal User** | 1-3 seconds | 200-800ms | Standard transactions |
| **Power User** | 0.5-1.5 seconds | 100-400ms | Experienced users |
| **Bot/Automated** | 100-500ms | 50-200ms | API stress testing |

---

## ⚡ Quick Start Scenarios

| Scenario | Users | Duration | Pattern | Target Endpoints |
|----------|-------|----------|---------|------------------|
| 🚀 **API Load Test** | 50 | 60s | Ramp Up | `/api/products`, `/api/categories` |
| ⚡ **Spike Test** | 200 | 120s | Spike | `/api/products` |
| 🔥 **Stress Test** | 500 | 180s | Stress | All endpoints |
| 🕐 **Endurance Test** | 25 | 600s | Constant | All endpoints |
| 🌊 **Mixed Workload** | 100 | 300s | Wave | E-commerce flow |

---

## 🔧 Backend Services

### `PerformanceEngine` (Orchestrator)

```python
class PerformanceEngine:
    def __init__(self):
        self.load_generator = LoadGenerator()           # Core VU pool
        self.distributed_controller = DistributedController()  # Multi-node
        self.monitoring_service = MonitoringService()   # Metrics
        self.correlation_engine = CorrelationEngine()   # Dynamic values
        self.reporting_engine = ReportingEngine()       # Reports
        self.alerting_service = AlertingService()       # SLA alerts
        self.test_scheduler = TestScheduler()           # Cron scheduling
        self.system_monitor = SystemMonitor()           # CPU/Memory
```

### `LoadGenerator` (Virtual User Pool)

```python
class LoadGenerator:
    async def start_load_test(
        self,
        scenario_names: List[str],
        protocol_handler: ProtocolHandler,
        metrics_callback: Callable
    ) -> str:
        # Spawns VUs using asyncio tasks
        for vu_index in range(scenario.virtual_users):
            task = asyncio.create_task(
                self._run_virtual_user(vu, scenario, delay)
            )
        # Each VU executes HTTP requests server-side
```

### `VirtualUser` (Single User Simulation)

```python
@dataclass
class VirtualUser:
    user_id: str
    state: UserState  # RUNNING, THINKING, WAITING, ERROR
    iterations: int
    errors: int
    response_times: List[float]
    session_data: Dict[str, Any]      # Cookies, tokens
    correlation_data: Dict[str, Any]  # Extracted values
```

---

## 📡 API Endpoints

### Test Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/tests/run` | Start a load test |
| `POST` | `/api/performance/tests/{id}/stop` | Stop a running test |
| `GET` | `/api/performance/tests/{id}/status` | Get test status + metrics |
| `GET` | `/api/performance/tests/{id}/report` | Get final report |

### Real-time Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/performance/metrics/realtime` | Live dashboard data |
| `GET` | `/api/performance/metrics/history` | Historical metrics |

### Scenario Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/scenarios` | Create scenario |
| `GET` | `/api/performance/scenarios` | List all scenarios |
| `POST` | `/api/performance/scenarios/{id}/steps` | Add test step |

### Enterprise Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/load-profiles/create` | Create spike/stress profile |
| `POST` | `/api/performance/data-pools/create` | Data parameterization |
| `POST` | `/api/performance/alerts/create` | SLA alerting |
| `POST` | `/api/performance/schedules/create` | Scheduled tests |
| `GET` | `/api/performance/system-metrics` | Server CPU/Memory |

---

## 📈 Metrics Collected

### Response Time Metrics

```typescript
interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;      // milliseconds
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;      // 50th percentile
  p90ResponseTime: number;      // 90th percentile
  p95ResponseTime: number;      // 95th percentile
  p99ResponseTime: number;      // 99th percentile
  requestsPerSecond: number;    // throughput (RPS)
  activeUsers: number;
  errorsPerSecond: number;
  bytesReceived: number;
  bytesSent: number;
}
```

### Server-Side Collection

Metrics are collected **on the backend**, not in the browser:

```python
async def _run_virtual_user(self, vu: VirtualUser, scenario: LoadScenario):
    step_start = time.time()
    
    # Server-side HTTP request (httpx/aiohttp)
    result = await self.protocol_handler.execute(step)
    
    response_time = time.time() - step_start
    vu.response_times.append(response_time * 1000)  # ms
```

---

## 🌐 Distributed Load Generation

For tests requiring 1,000+ VUs, use distributed mode:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER NODE                               │
│                  DistributedController                           │
│                                                                  │
│    Coordinates test execution across worker nodes                │
│    Aggregates metrics from all nodes                             │
└─────────────────────────────┬────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Worker 1    │  │  Worker 2    │  │  Worker N    │
    │  500 VUs     │  │  500 VUs     │  │  500 VUs     │
    │              │  │              │  │              │
    │  LoadGen     │  │  LoadGen     │  │  LoadGen     │
    └──────────────┘  └──────────────┘  └──────────────┘
```

**Enable distributed mode:**
```python
POST /api/performance/tests/run
{
  "scenario_id": "...",
  "virtual_users": 2000,
  "use_distributed": true  # ← Enable multi-node
}
```

---

## 🎯 How to Use

### Quick Load Test (1 Click)

1. Navigate to **Perf** tab
2. Enter your target URL
3. Click **Run** on "API Load Test" scenario
4. Watch **Metrics** tab (data from backend)

### Custom Load Test

1. **Config** tab → Set users, duration, pattern
2. **Steps** tab → Add HTTP request steps
3. Click **Start Test**
   - UI sends config to `POST /api/performance/tests/run`
   - Backend spawns VUs and generates load
4. **Metrics** tab → Polls `GET /api/performance/metrics/realtime`
5. **Results** tab → Shows final report

### From HAR File

1. **HAR** tab → Upload HAR file
2. HAR requests converted to scenario steps
3. Configure load parameters
4. Start test (backend executes)

### Flow Diagram

```
┌──────────────────┐
│  User Clicks     │
│  "Start Test"    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  UI sends POST   │────▶│  Backend starts  │
│  /tests/run      │     │  LoadGenerator   │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │  VUs execute     │
         │               │  HTTP requests   │
         │               │  (server-side)   │
         │               └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│  UI polls GET    │◀────│  Backend returns │
│  /metrics/realtime│     │  aggregated data │
└────────┬─────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐
│  UI displays     │
│  live dashboard  │
└──────────────────┘
```

---

## 📊 Scalability

| Scenario | VUs | Architecture |
|----------|-----|--------------|
| Development | 1-50 | Single backend node |
| Staging | 50-500 | Single backend node |
| Production | 500-2000 | Single high-spec node |
| Enterprise | 2000-10000+ | Distributed (3-10 workers) |

### Single Node Limits (Python asyncio)

- **10,000+ concurrent connections** with httpx/aiohttp
- **1,000-5,000 VUs** practical limit per node (depends on target latency)
- **Linear scaling** with distributed controller

---

## 🛠️ Technical Stack

| Layer | Technology |
|-------|------------|
| **Control Plane** | React 18 + TypeScript + Shadcn/UI |
| **Load Plane** | FastAPI + Python asyncio |
| **HTTP Client** | httpx (async) / aiohttp |
| **Metrics** | In-memory + time-series storage |
| **Distribution** | Custom DistributedController |

---

## 📁 File Structure

```
src/
├── pages/
│   └── VirtualUserGenerator.tsx    # UI Control Plane

backend/
├── app/
│   ├── routers/
│   │   └── performance_api.py      # REST endpoints
│   └── services/
│       └── performance/
│           ├── performance_engine.py     # Main orchestrator
│           ├── load_generator.py         # VU pool (asyncio)
│           ├── distributed_controller.py # Multi-node
│           ├── protocol_handler.py       # HTTP/WS execution
│           ├── monitoring_service.py     # Metrics
│           ├── correlation_engine.py     # Dynamic extraction
│           ├── reporting_engine.py       # Reports
│           ├── alerting_service.py       # SLA alerts
│           ├── test_scheduler.py         # Cron scheduling
│           ├── system_monitoring.py      # Server resources
│           ├── load_profiles.py          # Spike/Stress patterns
│           ├── data_parameterization.py  # CSV/JSON data
│           └── transaction_analyzer.py   # Breakdown analysis
```

---

## 📞 Support

For questions or issues with Performance Testing:
- Backend generates load; browser only displays
- Check backend logs: `backend/logs/performance.log`
- Enable **AI Analysis** in Settings for intelligent recommendations

---

*Document generated by ArisTrace Platform*  
*© 2026 ArisTrace - Excellence in Every QA Trace*
