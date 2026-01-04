# 🚀 ArisTrace Performance Testing Architecture

**Version:** 4.0 (Go Runner Integration)  
**Last Updated:** January 2026  
**Module:** Virtual User Generator (Perf Tab)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Go Runner (NEW)](#go-runner-new)
4. [Run State Machine](#run-state-machine)
5. [Pass/Fail Gates](#passfail-gates)
6. [Scenario Compiler](#scenario-compiler)
7. [Core Backend Services](#core-backend-services)
8. [API Endpoints](#api-endpoints)
9. [Correlation Engine](#correlation-engine)
10. [Data Parameterization](#data-parameterization)
11. [Metrics & Storage](#metrics--storage)
12. [Distributed Load Generation](#distributed-load-generation)
13. [Integration with Recording](#integration-with-recording)
14. [How to Use](#how-to-use)

---

## 📖 Overview

ArisTrace Performance Testing is an **enterprise-grade load testing platform** with:

| Feature | Status | Description |
|---------|--------|-------------|
| **Go Runner (High Performance)** | ✅ **NEW** | Native Go for 10K+ concurrent VUs |
| **Scenario Compiler** | ✅ **NEW** | HAR/Recording → Compiled JSON |
| **Control Plane / Load Plane Split** | ✅ | Browser controls, backend generates load |
| **Run State Machine** | ✅ | CREATED → RUNNING → STOPPING → FINISHED/FAILED |
| **Pass/Fail Gates** | ✅ | Threshold-based PASS/FAIL verdict |
| **Correlation Engine** | ✅ | Session cookies, CSRF, dynamic IDs |
| **Data Parameterization** | ✅ | CSV/JSON user pools, unique payloads |
| **Metrics Storage** | ✅ | Persistent run history, trend analysis |
| **Distributed Workers** | ✅ | Multi-node load generation via gRPC |
| **Alerting** | ✅ | Email, Slack, webhooks for SLA violations |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON DESKTOP APP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      UI (React/Electron)                              │   │
│  │   Record │ Build │ API │ Performance │ Reports │ Visual │ Admin       │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
│                                   │ HTTP Calls                              │
│                                   ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                   PYTHON CONTROLLER (FastAPI)                         │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │   │  Compiler   │  │ Run Manager │  │ Dispatcher  │  │ Aggregator │  │   │
│  │   │             │  │             │  │             │  │            │  │   │
│  │   │ HAR → JSON  │  │ State       │  │ Start/Stop  │  │ Metrics    │  │   │
│  │   │ Record→JSON │  │ Machine     │  │ Go Runners  │  │ Collector  │  │   │
│  │   │ Steps→JSON  │  │ Thresholds  │  │ gRPC/HTTP   │  │ Reports    │  │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │                                                                       │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                           │
│                    ┌─────────────┼─────────────┐                            │
│                    ▼             ▼             ▼                            │
│              ┌──────────┐  ┌──────────┐  ┌───────────────────┐              │
│              │ SQLite   │  │ Artifacts│  │    GO RUNNER      │              │
│              │ (Runs)   │  │ (Reports)│  │    (Local)        │ ◄── NEW!     │
│              └──────────┘  └──────────┘  │                   │              │
│                                          │  ✓ HTTP/1.1 + H2  │              │
│                                          │  ✓ 10K+ VUs       │              │
│                                          │  ✓ Correlation    │              │
│                                          │  ✓ HdrHistogram   │              │
│                                          │  ✓ Host Metrics   │              │
│                                          └───────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                         │
                                         │ For > 1K VUs (Distributed)
                                         ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                      DISTRIBUTED AGENT POOL (Optional)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │  Go Agent 1     │   │  Go Agent 2     │   │  Go Agent N     │          │
│   │  (500-2K VUs)   │   │  (500-2K VUs)   │   │  (500-2K VUs)   │          │
│   │                 │   │                 │   │                 │          │
│   │ • HTTP/1.1+H2   │   │ • HTTP/1.1+H2   │   │ • HTTP/1.1+H2   │          │
│   │ • Correlation   │   │ • Correlation   │   │ • Correlation   │          │
│   │ • Variables     │   │ • Variables     │   │ • Variables     │          │
│   │ • Assertions    │   │ • Assertions    │   │ • Assertions    │          │
│   │ • Host Metrics  │   │ • Host Metrics  │   │ • Host Metrics  │          │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘          │
│            │                     │                     │                    │
│            └─────────────────────┼─────────────────────┘                    │
│                                  │                                          │
│                                  │ gRPC/mTLS Stream                         │
│                                  ▼                                          │
│                     ┌─────────────────────────┐                             │
│                     │   Controller (Python)   │                             │
│                     │   Aggregate + Report    │                             │
│                     └─────────────────────────┘                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🦫 Go Runner (NEW)

### Why Go?

| Metric | Python (asyncio) | Go Runner |
|--------|------------------|-----------|
| **Max VUs per node** | ~500 | ~10,000 |
| **Memory per VU** | ~1MB | ~10KB |
| **Startup time** | 2-5s | <100ms |
| **HTTP/2 support** | Manual | Native |
| **GC pauses** | Variable | Tunable |

### File Structure

```
runner/
├── go.mod                          # Dependencies
├── proto/
│   └── runner.proto                # gRPC service definitions
├── cmd/
│   └── runner/
│       └── main.go                 # Entry point
├── pkg/
│   └── scenario/
│       └── types.go                # CompiledScenario format
└── internal/
    ├── executor/
    │   ├── http_client.go          # HTTP/1.1 + HTTP/2 client
    │   ├── vu.go                   # Virtual user implementation
    │   └── pool.go                 # VU pool manager
    ├── correlation/
    │   └── correlation.go          # Dynamic value extraction
    ├── metrics/
    │   └── collector.go            # HdrHistogram metrics
    ├── scheduler/
    │   └── scheduler.go            # Ramp up/down logic
    └── grpcserver/
        └── server.go               # gRPC service implementation
```

### Go Runner Features

```go
// High-performance virtual user
type VirtualUser struct {
    ID            string
    Scenario      *scenario.CompiledScenario
    HTTPClient    *HTTPClient     // HTTP/1.1 + HTTP/2
    Correlation   *Engine         // Session tokens, CSRF
    Metrics       *Collector      // HdrHistogram percentiles
}

// Runs in a goroutine - 10KB memory each
func (vu *VirtualUser) Run(ctx context.Context, thinkTimeFn func() time.Duration) {
    for {
        select {
        case <-ctx.Done():
            return
        default:
            vu.runIteration(ctx)
            time.Sleep(thinkTimeFn())
        }
    }
}
```

### Running Go Runner

```bash
# Standalone mode (local testing)
cd runner
go build -o runner ./cmd/runner
./runner --standalone --scenario scenario.json

# gRPC server mode (for controller)
./runner --port 50051 --max-vus 2000 --agent-id worker-1
```

---

## 📝 Scenario Compiler

The **Scenario Compiler** converts multiple input formats into a universal **CompiledScenario JSON** that the Go runner can execute.

### Compilation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  HAR File   │     │  Recording  │     │  Builder    │
│  (Browser)  │     │  (Network)  │     │  (Manual)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    SCENARIO COMPILER    │
              │    (Python/FastAPI)     │
              │                         │
              │  • Parse input format   │
              │  • Extract HTTP steps   │
              │  • Auto-detect cookies  │
              │  • Add think times      │
              │  • Generate extractors  │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │   COMPILED SCENARIO     │
              │   (Universal JSON)      │
              └───────────┬─────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │      GO RUNNER          │
              │   (Load Generation)     │
              └─────────────────────────┘
```

### CompiledScenario Format

```json
{
  "scenario_id": "uuid",
  "name": "E-commerce Checkout Flow",
  "source": "har",
  "version": "1.0",
  "created_at": "2026-01-04T12:00:00Z",
  
  "config": {
    "virtual_users": 100,
    "duration_seconds": 300,
    "ramp_up_seconds": 60,
    "ramp_down_seconds": 30,
    "target_url": "https://shop.example.com",
    "enable_http2": true,
    "think_time_min_ms": 1000,
    "think_time_max_ms": 3000
  },
  
  "thresholds": [
    {"metric": "response_time.p95", "op": "<", "value": 800, "critical": false},
    {"metric": "error_rate", "op": "<", "value": 0.01, "critical": true}
  ],
  
  "variables": {
    "base_url": "https://shop.example.com",
    "api_version": "v2"
  },
  
  "data_pools": [
    {
      "id": "users",
      "name": "Test Users",
      "mode": "unique",
      "columns": ["username", "password"],
      "inline_data": [
        {"username": "user1", "password": "pass1"},
        {"username": "user2", "password": "pass2"}
      ]
    }
  ],
  
  "steps": [
    {
      "id": "step_1",
      "name": "GET /api/products",
      "type": "http",
      "method": "GET",
      "url": "${base_url}/api/products",
      "headers": {"Authorization": "Bearer ${auth_token}"},
      "extract": [
        {"name": "product_id", "from": "json", "path": "$.products[0].id"}
      ],
      "assertions": [
        {"type": "status", "expected": 200}
      ]
    },
    {
      "id": "think_1",
      "name": "Think Time",
      "type": "think",
      "think_time_ms": 2000
    },
    {
      "id": "step_2",
      "name": "POST /api/cart",
      "type": "http",
      "method": "POST",
      "url": "${base_url}/api/cart",
      "body": {"product_id": "${product_id}", "quantity": 1}
    }
  ]
}
```

### Compiler API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/performance/compile/har` | Compile HAR file → Scenario JSON |
| `POST /api/performance/compile/recording` | Compile recorded session → Scenario JSON |
| `POST /api/performance/compile/api-requests` | Compile API tab requests → Scenario JSON |

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
| `STARTING` | Go runner initializing |
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
| `error_rate` | < | 1% | **Yes** | Error rate must be under 1% |
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

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅  PASS                                          Thresholds   │
│                                                       4/4       │
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
├── scenario_compiler.py      # 🆕 HAR/Recording → CompiledScenario
├── go_runner_client.py       # 🆕 Communication with Go runner
├── run_manager.py            # Run state machine + Pass/Fail gates
├── performance_engine.py     # Main orchestrator
├── load_generator.py         # Python fallback (asyncio)
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
| **ScenarioCompiler** | HAR/Recording → CompiledScenario JSON |
| **GoRunnerClient** | Dispatch to Go runner, fallback to Python |
| **RunManager** | State machine, thresholds, verdict, history |
| **PerformanceEngine** | Orchestrates all components |
| **LoadGenerator** | Python fallback for small tests |
| **CorrelationEngine** | Extracts/applies dynamic values |
| **DataParameterizationEngine** | Manages test data pools |
| **DistributedController** | Coordinates worker nodes |

---

## 📡 API Endpoints

### Scenario Compilation (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/compile/har` | Compile HAR → Scenario |
| `POST` | `/api/performance/compile/recording` | Compile recording → Scenario |
| `POST` | `/api/performance/compile/api-requests` | Compile API requests → Scenario |

### Go Runner Management (NEW)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/performance/runner/status` | Get Go runner status |
| `POST` | `/api/performance/runner/start-local` | Start local Go runner |
| `POST` | `/api/performance/runner/stop-local` | Stop local Go runner |

### Run Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/runs/create` | Create new run with thresholds |
| `POST` | `/api/performance/runs/{id}/start` | Start the run |
| `POST` | `/api/performance/runs/{id}/stop` | Stop and evaluate verdict |
| `GET` | `/api/performance/runs/{id}` | Get run details + verdict |
| `GET` | `/api/performance/runs/history/{scenario}` | Get run history for trends |
| `POST` | `/api/performance/runs/compare` | Compare multiple runs |

---

## 🔗 Correlation Engine

Both Python and Go have correlation engines with the same patterns:

### Auto-Detected Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Session ID | `session_id`, `JSESSIONID` | Cookie extraction |
| CSRF Token | `csrf_token`, `_token` | Hidden form field |
| Auth Token | `access_token`, `Bearer` | JWT from response |
| Dynamic IDs | `order_id`, `user_id` | JSON path extraction |

### Go Correlation Engine

```go
// Extract values from response
extracted := engine.Extract(body, headers, statusCode, []Extractor{
    {Name: "auth_token", From: "json", Path: "$.token"},
    {Name: "csrf", From: "header", Key: "X-CSRF-Token"},
})

// Substitute in next request
url := engine.Substitute("${base_url}/api/orders/${order_id}")
```

### JSON Export for Go

```python
# Python → Go
correlation_engine.export_rules_to_json()
# Returns: [{"name": "csrf", "from": "header", "key": "X-CSRF-Token"}, ...]
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

### Inline Data in Scenario

```json
{
  "data_pools": [
    {
      "id": "users",
      "mode": "unique",
      "inline_data": [
        {"username": "user1", "password": "pass1"},
        {"username": "user2", "password": "pass2"}
      ]
    }
  ]
}
```

---

## 📈 Metrics & Storage

### Go Runner Metrics (HdrHistogram)

```go
type Snapshot struct {
    // Virtual Users
    ActiveVUs int32
    PeakVUs   int32
    
    // Request counts
    TotalRequests      int64
    SuccessfulRequests int64
    FailedRequests     int64
    ErrorRate          float64
    
    // Response times (HdrHistogram percentiles)
    ResponseTimeMin float64
    ResponseTimeMax float64
    ResponseTimeAvg float64
    ResponseTimeP50 float64
    ResponseTimeP95 float64
    ResponseTimeP99 float64
    
    // Host metrics (runner machine)
    HostCPUPercent    float64
    HostMemoryPercent float64
    GoGoroutines      int64
    GoHeapBytes       int64
}
```

### Persistent Storage

```
data/performance_runs/
├── runs_index.json           # All runs metadata
├── run_abc123_metrics.json   # Per-run detailed metrics
└── run_abc123_errors.json    # Error samples
```

---

## 🌐 Distributed Load Generation

For 1000+ VUs, use distributed Go agents:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLLER (Python)                           │
│                  Dispatches CompiledScenario                     │
└─────────────────────────────┬────────────────────────────────────┘
                              │ gRPC StartRun
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Go Agent 1  │  │  Go Agent 2  │  │  Go Agent N  │
    │  2000 VUs    │  │  2000 VUs    │  │  2000 VUs    │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                  │                  │
           └──────────────────┴──────────────────┘
                              │
                              │ StreamMetrics (gRPC)
                              ▼
                    ┌─────────────────────┐
                    │ Controller Aggregate│
                    │ → UI Display        │
                    └─────────────────────┘
```

### gRPC Protocol

```protobuf
service RunnerService {
    rpc StartRun(StartRunRequest) returns (StartRunResponse);
    rpc StopRun(StopRunRequest) returns (StopRunResponse);
    rpc StreamMetrics(stream MetricsEvent) returns (stream ControllerCommand);
}
```

---

## 🔄 Integration with Recording

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
                                            │ Compile
                                            ▼
                                     ┌─────────────┐
                                     │ Scenario    │
                                     │ Compiler    │
                                     └──────┬──────┘
                                            │
                                            │ CompiledScenario JSON
                                            ▼
                                     ┌─────────────┐
                                     │  Go Runner  │
                                     │  10K+ VUs   │
                                     └─────────────┘
```

---

## 🎯 How to Use

### Quick Test (1 Minute)

1. Go to **Perf** tab
2. Enter target URL: `http://your-app.com`
3. Click **Run** on "API Load Test" scenario
4. Watch **Metrics** tab
5. Check **Results** for PASS/FAIL

### With Go Runner (High Load)

1. Build Go runner:
   ```bash
   cd runner
   go build -o runner ./cmd/runner
   ```

2. Start via API:
   ```bash
   POST /api/performance/runner/start-local
   {"max_vus": 5000}
   ```

3. Run test normally - Go runner will be used automatically

### From Recorded Session

1. **Record** tab → Enable "Capture Network"
2. Browse your application
3. Stop recording → Click **Send to Perf**
4. Configure load parameters
5. Run → Get verdict

---

## 🛠️ Technical Stack

| Layer | Technology |
|-------|------------|
| Control Plane | React 18 + TypeScript + Shadcn/UI |
| API Layer | FastAPI (Python 3.9+) |
| Load Plane | **Go 1.21** (HdrHistogram, gRPC) |
| Python Fallback | asyncio + httpx + aiohttp |
| Storage | JSON files (upgradeable to Postgres) |
| Distributed | gRPC with mTLS |

---

## 📊 Comparison with Tools

| Feature | ArisTrace | k6 | Gatling | LoadRunner |
|---------|-----------|-----|---------|------------|
| Language | Go + Python | JS | Scala | C |
| Max VUs/Node | 10K+ | 10K+ | 5K | 5K |
| Browser Control | ✅ | ❌ | ❌ | ✅ |
| Correlation | ✅ | Manual | Manual | ✅ |
| Integrated Recording | ✅ | ❌ | ❌ | ✅ |
| Pass/Fail Gates | ✅ | ✅ | ✅ | ✅ |
| Free | ✅ | ✅ | ✅ | ❌ |

---

## 📞 Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Go Runner Core | ✅ Done |
| 2 | Scenario Compiler | ✅ Done |
| 3 | Controller Integration | ✅ Done |
| 4 | gRPC Streaming | 🔜 Next |
| 5 | Distributed Agents | 🔜 Next |
| 6 | mTLS Security | 🔜 Future |
| 7 | WebSocket Protocol | 🔜 Future |
| 8 | Auto Evidence Pack | 🔜 Future |

---

*Document generated by ArisTrace Platform*  
*© 2026 ArisTrace - Excellence in Every QA Trace*
