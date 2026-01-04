# 🚀 ArisTrace Performance Testing Architecture

**Version:** 3.0 (Enterprise Complete)  
**Last Updated:** January 2026  
**Module:** Virtual User Generator (Perf Tab)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture: ELIS Pattern](#architecture-elis-pattern)
3. [Run State Machine](#run-state-machine)
4. [Pass/Fail Gates](#passfail-gates)
5. [Core Backend Services](#core-backend-services)
6. [API Endpoints](#api-endpoints)
7. [Correlation Engine](#correlation-engine)
8. [Data Parameterization](#data-parameterization)
9. [Metrics & Storage](#metrics--storage)
10. [Distributed Load Generation](#distributed-load-generation)
11. [UI Features](#ui-features)
12. [Integration with Recording](#integration-with-recording)
13. [How to Use](#how-to-use)

---

## 📖 Overview

ArisTrace Performance Testing is an **enterprise-grade load testing platform** with:

| Feature | Status | Description |
|---------|--------|-------------|
| **Control Plane / Load Plane Split** | ✅ | Browser controls, backend generates load |
| **Run State Machine** | ✅ | CREATED → RUNNING → STOPPING → FINISHED/FAILED |
| **Pass/Fail Gates** | ✅ | Threshold-based PASS/FAIL verdict |
| **Correlation Engine** | ✅ | Session cookies, CSRF, dynamic IDs |
| **Data Parameterization** | ✅ | CSV/JSON user pools, unique payloads |
| **Metrics Storage** | ✅ | Persistent run history, trend analysis |
| **Distributed Workers** | ✅ | Multi-node load generation |
| **Alerting** | ✅ | Email, Slack, webhooks for SLA violations |

---

## 🏗️ Architecture: ELIS Pattern

**E**xecutor, **L**oaders, **I**nspectors, **S**torage

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         1. BOSS (Control Plane)                          │
│                         React UI (VirtualUserGenerator.tsx)              │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ Configure test parameters (VUs, duration, thresholds)               │
│  ✅ Start/Stop/Pause tests                                               │
│  ✅ View real-time metrics                                               │
│  ✅ Display PASS/FAIL verdict                                            │
│  ❌ Does NOT generate load (no browser fetch to target)                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP API
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       2. COORDINATOR (FastAPI)                           │
│                       performance_api.py + run_manager.py                │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ Creates Run IDs                                                      │
│  ✅ Manages Run State Machine (CREATED → RUNNING → FINISHED)             │
│  ✅ Saves test config to Postgres/JSON                                   │
│  ✅ Dispatches work to Load Agents                                       │
│  ✅ Evaluates Pass/Fail thresholds                                       │
│  ✅ Stores run history                                                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Queue/Direct Call
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       3. WORKERS (Load Agents)                           │
│                       load_generator.py + distributed_controller.py      │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ Spawns virtual users (asyncio tasks)                                 │
│  ✅ Executes HTTP requests server-side (httpx/aiohttp)                   │
│  ✅ Applies correlation (session tokens, CSRF)                           │
│  ✅ Uses parameterized data (CSV/JSON)                                   │
│  ✅ Records response times + errors                                      │
│  ✅ Scales horizontally (N worker nodes)                                 │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP Traffic
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       TARGET SYSTEM                                      │
│                       (Your Application Under Test)                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       4. CAMERAS (Monitoring)                            │
│                       monitoring_service.py + system_monitoring.py       │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ Workers report RPS, latency, errors                                  │
│  ✅ Server agents report CPU/memory (if accessible)                      │
│  ✅ Metrics aggregated in real-time                                      │
│  ✅ Alert triggers evaluated                                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       5. REPORT (Results)                                │
│                       reporting_engine.py + run_manager.py               │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ Big PASS/FAIL verdict                                                │
│  ✅ Threshold results breakdown                                          │
│  ✅ Grafana-like graphs (Metrics tab)                                    │
│  ✅ Historical comparison                                                │
│  ✅ Export bundle (JSON/CSV)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Run State Machine

Every test run follows this state machine:

```
┌──────────┐     start()     ┌──────────┐
│ CREATED  │ ──────────────▶ │ STARTING │
└──────────┘                 └────┬─────┘
      │                           │
      │ cancel()                  │ workers ready
      ▼                           ▼
┌──────────┐                 ┌──────────┐
│CANCELLED │                 │ RUNNING  │ ◀─────┐
└──────────┘                 └────┬─────┘       │
                                  │             │ resume()
                     stop() or    │ pause()     │
                     duration     │             │
                     complete     │             │
                                  ▼             │
                             ┌──────────┐       │
                             │ STOPPING │ ──────┘
                             └────┬─────┘
                                  │
                     ┌────────────┼────────────┐
                     ▼            ▼            ▼
               ┌──────────┐ ┌──────────┐ ┌──────────┐
               │ FINISHED │ │  FAILED  │ │CANCELLED │
               └──────────┘ └──────────┘ └──────────┘
                    │
                    ▼
            evaluate_thresholds()
                    │
           ┌────────┴────────┐
           ▼                 ▼
       ┌──────┐          ┌──────┐
       │ PASS │          │ FAIL │
       └──────┘          └──────┘
```

### Run States

| State | Description |
|-------|-------------|
| `CREATED` | Run created, configuration saved |
| `QUEUED` | Waiting for workers (distributed mode) |
| `STARTING` | Workers initializing |
| `RUNNING` | Active load generation |
| `STOPPING` | Graceful shutdown in progress |
| `FINISHED` | Completed successfully |
| `FAILED` | Terminated with errors |
| `CANCELLED` | User cancelled |

---

## ✅ Pass/Fail Gates

Tests are evaluated against **thresholds** to produce a clear **PASS/FAIL verdict**.

### Default Thresholds

| Metric | Operator | Value | Critical | Description |
|--------|----------|-------|----------|-------------|
| `response_time.p95` | < | 800ms | No | 95th percentile response time |
| `response_time.p99` | < | 2000ms | No | 99th percentile response time |
| `iterations.error_rate` | < | 1% | **Yes** | Error rate must be under 1% |
| `throughput.rps` | > | 10 | No | Minimum requests per second |

### Verdict Logic

```python
if any(critical_threshold_failed):
    verdict = "FAIL"
    reason = "Critical threshold(s) failed"
elif all_thresholds_passed:
    verdict = "PASS"
    reason = "All thresholds passed"
else:
    verdict = "FAIL"
    reason = f"{failed_count} thresholds failed"
```

### UI Display

The Results tab shows a prominent verdict banner:

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅  PASS                                          Thresholds   │
│                                                       3/4       │
│  All 4 thresholds passed                                        │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐│
│  │ ✓ P95 < 800  │ │ ✓ P99 < 2000 │ │ ✓ Error < 1% │ │✓ RPS>10 ││
│  │ 450ms        │ │ 890ms        │ │ 0.5%         │ │ 125     ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Backend Services

### File Structure

```
backend/app/services/performance/
├── run_manager.py            # 🆕 Run state machine + Pass/Fail gates
├── performance_engine.py     # Main orchestrator
├── load_generator.py         # Virtual user pool (asyncio)
├── correlation_engine.py     # Session/CSRF/token handling
├── data_parameterization.py  # CSV/JSON test data pools
├── distributed_controller.py # Multi-node workers
├── monitoring_service.py     # Real-time metrics
├── alerting_service.py       # Email/Slack/webhook alerts
├── reporting_engine.py       # Reports + trends
├── load_profiles.py          # Spike/stress/endurance patterns
├── protocol_handler.py       # HTTP/WebSocket execution
├── system_monitoring.py      # Server CPU/memory
└── transaction_analyzer.py   # Error breakdown
```

### Service Responsibilities

| Service | Purpose |
|---------|---------|
| **RunManager** | State machine, thresholds, verdict, history |
| **PerformanceEngine** | Orchestrates all components |
| **LoadGenerator** | Spawns/manages virtual users |
| **CorrelationEngine** | Extracts/applies dynamic values |
| **DataParameterizationEngine** | Manages test data pools |
| **DistributedController** | Coordinates worker nodes |
| **AlertingService** | Sends notifications on SLA breach |
| **ReportingEngine** | Generates reports, trends |

---

## 📡 API Endpoints

### Run Management (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/runs/create` | Create new run with thresholds |
| `POST` | `/api/performance/runs/{id}/start` | Start the run |
| `POST` | `/api/performance/runs/{id}/stop` | Stop and evaluate verdict |
| `POST` | `/api/performance/runs/{id}/evaluate` | Evaluate thresholds |
| `GET` | `/api/performance/runs/{id}` | Get run details + verdict |
| `GET` | `/api/performance/runs` | List runs with filtering |
| `GET` | `/api/performance/runs/history/{scenario}` | Get run history for trends |
| `POST` | `/api/performance/runs/compare` | Compare multiple runs |
| `GET` | `/api/performance/thresholds/defaults` | Get default thresholds |

### Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/scenarios` | Create scenario |
| `POST` | `/api/performance/tests/run` | Start load test (legacy) |
| `GET` | `/api/performance/metrics/realtime` | Live metrics |
| `POST` | `/api/performance/data-pools/create` | Create data pool |
| `POST` | `/api/performance/alerts/create` | Create alert |
| `GET` | `/api/performance/system-metrics` | Server CPU/memory |

---

## 🔗 Correlation Engine

Automatically handles dynamic values:

### Auto-Detected Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Session ID | `session_id`, `JSESSIONID` | Cookie extraction |
| CSRF Token | `csrf_token`, `_token` | Hidden form field |
| Auth Token | `access_token`, `Bearer` | JWT from response |
| Dynamic IDs | `order_id`, `user_id` | JSON path extraction |

### Extraction Methods

```python
CorrelationRule(
    variable_name="csrf_token",
    extract_type="regex",  # jsonpath, regex, header, cookie, xpath
    extract_value=r'name="csrf_token" value="([^"]+)"',
    scope="session"
)
```

### Auto-Replacement

```python
# Before correlation
url = "/api/orders/${order_id}"
headers = {"X-CSRF-Token": "${csrf_token}"}

# After correlation
url = "/api/orders/12345"
headers = {"X-CSRF-Token": "abc123xyz"}
```

---

## 📊 Data Parameterization

### Access Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `SEQUENTIAL` | Read in order, wrap around | Predictable testing |
| `RANDOM` | Random selection | Realistic distribution |
| `UNIQUE` | Each VU gets unique data | No collisions |
| `SHARED` | Round-robin across VUs | Global queue |

### Create Data Pool

```python
POST /api/performance/data-pools/create
{
    "pool_id": "users",
    "name": "Test Users",
    "data_source": "/data/users.csv",
    "access_mode": "unique",
    "columns": ["username", "password", "email"]
}
```

### CSV Example

```csv
username,password,email
user1,pass123,user1@test.com
user2,pass456,user2@test.com
user3,pass789,user3@test.com
```

### Usage in Requests

```python
{
    "url": "/api/login",
    "body": {
        "username": "${username}",
        "password": "${password}"
    }
}
```

---

## 📈 Metrics & Storage

### Metrics Collected

```typescript
interface LoadTestMetrics {
    // Response Times
    response_time: {
        min: number;      // Minimum response time (ms)
        max: number;      // Maximum response time (ms)
        avg: number;      // Average response time (ms)
        p50: number;      // 50th percentile
        p75: number;      // 75th percentile
        p90: number;      // 90th percentile
        p95: number;      // 95th percentile
        p99: number;      // 99th percentile
    };
    
    // Throughput
    throughput: {
        rps: number;              // Requests per second
        total_requests: number;   // Total requests made
    };
    
    // Errors
    iterations: {
        total: number;
        errors: number;
        error_rate: number;    // errors / total
    };
    
    // Virtual Users
    virtual_users: {
        total: number;
        active: number;
        completed: number;
        error: number;
    };
}
```

### Persistent Storage

Runs are stored in `data/performance_runs/`:

```
data/performance_runs/
├── runs_index.json           # All runs metadata
├── run_abc123_metrics.json   # Per-run detailed metrics
└── run_abc123_errors.json    # Error samples
```

### Historical Queries

```python
# Get 30-day history for trend analysis
GET /api/performance/runs/history/my_scenario?days=30

# Response
{
    "runs": [
        {
            "run_id": "run_abc123",
            "created_at": "2026-01-01T10:00:00Z",
            "verdict": "PASS",
            "metrics": { "p95": 450, "error_rate": 0.005 }
        },
        ...
    ]
}
```

---

## 🌐 Distributed Load Generation

For 1000+ VUs, use distributed mode:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER NODE                               │
│                  DistributedController                           │
│                                                                  │
│    Distributes VUs across workers                                │
│    Aggregates metrics from all nodes                             │
└─────────────────────────────┬────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Worker 1    │  │  Worker 2    │  │  Worker N    │
    │  500 VUs     │  │  500 VUs     │  │  500 VUs     │
    │  LoadGen     │  │  LoadGen     │  │  LoadGen     │
    └──────────────┘  └──────────────┘  └──────────────┘
```

### Enable Distributed Mode

```python
POST /api/performance/tests/run
{
    "scenario_id": "...",
    "virtual_users": 2000,
    "use_distributed": true  # Auto-distributes across nodes
}
```

---

## 🖥️ UI Features

### 7 Tabs

| Tab | Purpose |
|-----|---------|
| **Quick** | One-click test scenarios |
| **HAR** | Import HAR files |
| **Config** | Pattern, users, duration, thresholds |
| **Steps** | View/edit test steps |
| **Users** | Virtual user status |
| **Metrics** | Live dashboard |
| **Results** | PASS/FAIL verdict + summary |

### Results Tab Features

1. **Big PASS/FAIL Banner** - Immediately shows verdict
2. **Threshold Breakdown** - Each threshold with actual vs expected
3. **Recommendations** - AI-generated optimization tips
4. **Export** - JSON/CSV download

---

## 🔄 Integration with Recording

The performance module integrates with the **Record** tab:

```
┌─────────────┐     Record with      ┌─────────────┐
│  Record     │  "Capture Network"   │   Builder   │
│  Tab        │ ─────────────────▶   │   Tab       │
└─────────────┘     enabled          └──────┬──────┘
                                            │
                                            │ Send to Perf
                                            ▼
                                     ┌─────────────┐
                                     │   Perf      │
                                     │   Tab       │
                                     └──────┬──────┘
                                            │
                                            │ HTTP requests
                                            │ become test steps
                                            ▼
                                     ┌─────────────┐
                                     │ Load Test   │
                                     │ Execution   │
                                     └─────────────┘
```

### Flow

1. **Record** browser session with "Capture Network" toggle ON
2. Network requests captured as API calls
3. Click "Send to Perf" (orange button)
4. Requests become load test steps
5. Configure VUs, duration, thresholds
6. Run test → Get PASS/FAIL verdict

---

## 🎯 How to Use

### Quick Test (1 Minute)

1. Go to **Perf** tab
2. Enter target URL: `http://your-app.com`
3. Click **Run** on "API Load Test" scenario
4. Watch **Metrics** tab
5. Check **Results** for PASS/FAIL

### Custom Test with Thresholds

1. **Config** tab:
   - Set VUs: 100
   - Duration: 120s
   - Pattern: Ramp Up
   
2. **Thresholds** (via API):
   ```json
   {
       "thresholds": [
           {"metric": "response_time.p95", "operator": "<", "value": 500},
           {"metric": "iterations.error_rate", "operator": "<", "value": 0.005, "critical": true}
       ]
   }
   ```

3. **Steps** tab → Add/import test steps

4. Click **Start Test**

5. **Results** tab → See PASS/FAIL

### From Recorded Session

1. **Record** tab → Enable "Capture Network"
2. Browse your application
3. Stop recording → Click **Send to Perf**
4. Configure load parameters
5. Run → Get verdict

---

## 📊 Comparison with Tools

| Feature | ArisTrace | LoadRunner | k6 | Gatling |
|---------|-----------|------------|-----|---------|
| Browser Control | ✅ | ✅ | ❌ | ❌ |
| Server-side Load | ✅ | ✅ | ✅ | ✅ |
| Correlation | ✅ | ✅ | Manual | Manual |
| Data Pools | ✅ | ✅ | ✅ | ✅ |
| Pass/Fail Gates | ✅ | ✅ | ✅ | ✅ |
| Run History | ✅ | ✅ | ✅ | ✅ |
| Integrated Recording | ✅ | ✅ | ❌ | ❌ |
| Free | ✅ | ❌ | ✅ | ✅ |

---

## 🛠️ Technical Stack

| Layer | Technology |
|-------|------------|
| Control Plane | React 18 + TypeScript + Shadcn/UI |
| API Layer | FastAPI (Python 3.9+) |
| Load Plane | asyncio + httpx + aiohttp |
| Storage | JSON files (upgradeable to Postgres) |
| Distributed | Custom controller (upgradeable to Redis/RabbitMQ) |

---

## 📞 Next Steps (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Run State Machine | ✅ Done |
| 2 | Pass/Fail Thresholds | ✅ Done |
| 3 | Correlation Engine | ✅ Done |
| 4 | Data Parameterization | ✅ Done |
| 5 | Run History Storage | ✅ Done |
| 6 | WebSocket for Live Metrics | 🔜 Next |
| 7 | Redis Queue for Workers | 🔜 Next |
| 8 | PostgreSQL Metrics Storage | 🔜 Future |
| 9 | Distributed Tracing | 🔜 Future |
| 10 | Auto Evidence Pack (PDF) | 🔜 Future |

---

*Document generated by ArisTrace Platform*  
*© 2026 ArisTrace - Excellence in Every QA Trace*
