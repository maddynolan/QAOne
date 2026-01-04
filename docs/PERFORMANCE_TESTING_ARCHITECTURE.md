# 🚀 ArisTrace Performance Testing Architecture

**Version:** 4.0 (Go Runner Integration)  
**Last Updated:** January 2026  
**Module:** Virtual User Generator (Perf Tab)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Summary](#component-summary)
4. [Go Runner](#go-runner)
5. [Python Controller](#python-controller)
6. [Scenario Compiler](#scenario-compiler)
7. [Run State Machine](#run-state-machine)
8. [Pass/Fail Gates](#passfail-gates)
9. [Correlation Engine](#correlation-engine)
10. [Data Parameterization](#data-parameterization)
11. [Metrics Collection](#metrics-collection)
12. [Distributed Load Generation](#distributed-load-generation)
13. [API Reference](#api-reference)
14. [Integration Points](#integration-points)
15. [Technical Stack](#technical-stack)

---

## 📖 Overview

ArisTrace Performance Testing is an **enterprise-grade load testing platform** combining:

- **Go Runner** for high-performance load generation (10K+ VUs)
- **Python Controller** for orchestration and reporting
- **React UI** for configuration and real-time monitoring

### Feature Matrix

| Feature | Status | Technology |
|---------|--------|------------|
| **Go Runner (High Performance)** | ✅ | Go 1.21, goroutines, HdrHistogram |
| **Scenario Compiler** | ✅ | Python, HAR/Recording → JSON |
| **Control Plane / Load Plane Split** | ✅ | UI controls, backend generates load |
| **Run State Machine** | ✅ | CREATED → RUNNING → FINISHED |
| **Pass/Fail Gates** | ✅ | Threshold-based verdicts |
| **Correlation Engine** | ✅ | Go + Python implementations |
| **Data Parameterization** | ✅ | CSV/JSON, Sequential/Random/Unique |
| **Real-time Metrics** | ✅ | WebSocket + Polling |
| **Distributed Workers** | ✅ | gRPC with mTLS |
| **HAR Import** | ✅ | Browser network capture |
| **Recording Integration** | ✅ | From Record tab |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARISTRACE APP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      FRONTEND (React + TypeScript)                    │   │
│  │                                                                       │   │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │   │ Record  │ │  Build  │ │   API   │ │  Perf   │ │ Reports │       │   │
│  │   │   Tab   │ │   Tab   │ │   Tab   │ │   Tab   │ │   Tab   │       │   │
│  │   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └─────────┘       │   │
│  │        │           │           │           │                         │   │
│  │        └───────────┴───────────┴───────────┘                         │   │
│  │                            │                                          │   │
│  │                   VirtualUserGenerator.tsx                            │   │
│  │                   (Control Plane UI)                                  │   │
│  │                                                                       │   │
│  │   Features:                                                           │   │
│  │   • Configure VUs, duration, ramp-up                                  │   │
│  │   • Set pass/fail thresholds                                          │   │
│  │   • Monitor real-time metrics                                         │   │
│  │   • View PASS/FAIL verdict                                            │   │
│  │   • Export reports                                                    │   │
│  │                                                                       │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │ HTTP API                                  │
│                                  ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PYTHON CONTROLLER (FastAPI)                        │   │
│  │                    backend/app/services/performance/                  │   │
│  │                                                                       │   │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │   │
│  │   │ scenario_compiler│  │   run_manager    │  │ go_runner_client │   │   │
│  │   │                  │  │                  │  │                  │   │   │
│  │   │ • HAR → JSON     │  │ • State machine  │  │ • Start/stop     │   │   │
│  │   │ • Recording→JSON │  │ • Thresholds     │  │ • Stream metrics │   │   │
│  │   │ • API→JSON       │  │ • Pass/Fail      │  │ • Fallback       │   │   │
│  │   └──────────────────┘  └──────────────────┘  └────────┬─────────┘   │   │
│  │                                                         │             │   │
│  │   ┌──────────────────┐  ┌──────────────────┐           │             │   │
│  │   │ correlation_eng  │  │ data_param_eng   │           │             │   │
│  │   │                  │  │                  │           │             │   │
│  │   │ • Session tokens │  │ • CSV/JSON pools │           │             │   │
│  │   │ • CSRF           │  │ • Unique data    │           │             │   │
│  │   │ • Dynamic IDs    │  │ • Parameterize   │           │             │   │
│  │   └──────────────────┘  └──────────────────┘           │             │   │
│  │                                                         │             │   │
│  └─────────────────────────────────────────────────────────┼─────────────┘   │
│                                                            │                 │
│                    ┌───────────────────────────────────────┘                 │
│                    │                                                         │
│                    ▼                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       GO RUNNER (Load Plane)                          │   │
│  │                       runner/cmd/runner/                              │   │
│  │                                                                       │   │
│  │   ┌──────────────────────────────────────────────────────────────┐   │   │
│  │   │                    High-Performance Core                      │   │   │
│  │   │                                                               │   │   │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │   │
│  │   │  │ HTTP Client │  │ VU Pool     │  │ Scheduler   │          │   │   │
│  │   │  │             │  │             │  │             │          │   │   │
│  │   │  │ HTTP/1.1    │  │ 10K+ VUs    │  │ Ramp up     │          │   │   │
│  │   │  │ HTTP/2      │  │ Goroutines  │  │ Ramp down   │          │   │   │
│  │   │  │ Keep-alive  │  │ Pool mgmt   │  │ Duration    │          │   │   │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘          │   │   │
│  │   │                                                               │   │   │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │   │
│  │   │  │ Correlation │  │ Metrics     │  │ Assertions  │          │   │   │
│  │   │  │             │  │             │  │             │          │   │   │
│  │   │  │ Session IDs │  │ HdrHisto    │  │ Status code │          │   │   │
│  │   │  │ CSRF tokens │  │ Percentiles │  │ Body match  │          │   │   │
│  │   │  │ JSON paths  │  │ Host stats  │  │ Response <  │          │   │   │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘          │   │   │
│  │   │                                                               │   │   │
│  │   └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │   Standalone: ./runner --standalone --scenario test.json              │   │
│  │   Server:     ./runner --port 50051 --max-vus 5000                   │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │ HTTP Traffic
                                    ▼

                    ┌─────────────────────────────────┐
                    │        TARGET SYSTEM            │
                    │   (Your Application Under Test) │
                    └─────────────────────────────────┘
```

---

## 📦 Component Summary

### Files Created/Modified

```
QAAI/
├── proto/
│   └── runner.proto                    # gRPC service definitions
│
├── runner/                             # Go Runner (NEW)
│   ├── go.mod                          # Go dependencies
│   ├── cmd/runner/
│   │   └── main.go                     # Entry point + gRPC server
│   ├── pkg/scenario/
│   │   └── types.go                    # CompiledScenario format
│   └── internal/
│       ├── executor/
│       │   ├── http_client.go          # HTTP/1.1 + HTTP/2
│       │   ├── vu.go                   # Virtual user logic
│       │   └── pool.go                 # VU pool management
│       ├── correlation/
│       │   └── correlation.go          # Dynamic value extraction
│       ├── metrics/
│       │   └── collector.go            # HdrHistogram metrics
│       └── scheduler/
│           └── scheduler.go            # Ramp up/down logic
│
├── backend/app/services/performance/
│   ├── scenario_compiler.py            # HAR/Recording → JSON (NEW)
│   ├── go_runner_client.py             # Go runner communication (NEW)
│   ├── run_manager.py                  # State machine + thresholds
│   ├── performance_engine.py           # Main orchestrator
│   ├── load_generator.py               # Python fallback
│   ├── correlation_engine.py           # Session/CSRF handling (UPDATED)
│   ├── data_parameterization.py        # CSV/JSON pools
│   ├── distributed_controller.py       # Multi-node coordination
│   ├── monitoring_service.py           # Real-time metrics
│   └── alerting_service.py             # Notifications
│
├── backend/app/routers/
│   └── performance_api.py              # REST endpoints (UPDATED)
│
├── src/pages/
│   └── VirtualUserGenerator.tsx        # Perf tab UI
│
└── docs/
    ├── PERFORMANCE_TESTING_ARCHITECTURE.md  # This file
    └── PERFORMANCE_TESTING_USAGE.md         # Usage guide
```

---

## 🦫 Go Runner

### Why Go?

| Metric | Python asyncio | Go Runner |
|--------|----------------|-----------|
| **Max VUs per node** | ~500 | **10,000+** |
| **Memory per VU** | ~1MB | **~10KB** |
| **Startup time** | 2-5s | **<100ms** |
| **HTTP/2 support** | Manual | **Native** |
| **Connection pooling** | httpx | **net/http** |

### Installation (Required for Go Runner)

**Windows:**
```powershell
# Download Go from https://go.dev/dl/
# Or use winget:
winget install GoLang.Go

# Verify installation
go version
# Expected: go version go1.21.x windows/amd64
```

**macOS:**
```bash
brew install go
```

**Linux:**
```bash
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### Building the Runner

```bash
cd runner

# Install dependencies
go mod download

# Build
go build -o runner.exe ./cmd/runner    # Windows
go build -o runner ./cmd/runner        # Linux/macOS
```

### Running Modes

**Standalone Mode** (for quick local tests):
```bash
./runner --standalone --scenario scenario.json
```

**Server Mode** (for controller integration):
```bash
./runner --port 50051 --max-vus 5000 --agent-id worker-1
```

### CompiledScenario Format

```json
{
  "scenario_id": "uuid",
  "name": "API Load Test",
  "source": "har",
  "config": {
    "virtual_users": 100,
    "duration_seconds": 300,
    "ramp_up_seconds": 60,
    "target_url": "https://api.example.com"
  },
  "steps": [
    {
      "id": "step_1",
      "type": "http",
      "method": "GET",
      "url": "${base_url}/api/products",
      "headers": {"Authorization": "Bearer ${token}"},
      "extract": [{"name": "product_id", "from": "json", "path": "$.data[0].id"}],
      "assertions": [{"type": "status", "expected": 200}]
    }
  ],
  "thresholds": [
    {"metric": "response_time.p95", "op": "<", "value": 800}
  ]
}
```

---

## 🐍 Python Controller

### Services

| Service | File | Purpose |
|---------|------|---------|
| **ScenarioCompiler** | `scenario_compiler.py` | Convert HAR/Recording → JSON |
| **GoRunnerClient** | `go_runner_client.py` | Communicate with Go runner |
| **RunManager** | `run_manager.py` | State machine, thresholds |
| **PerformanceEngine** | `performance_engine.py` | Main orchestrator |
| **LoadGenerator** | `load_generator.py` | Python fallback |
| **CorrelationEngine** | `correlation_engine.py` | Dynamic values |
| **DataParameterization** | `data_parameterization.py` | Test data pools |

### Fallback Logic

```python
# In go_runner_client.py
async def start_run(self, ...):
    if self.is_go_runner_available():
        # Use Go runner (10K+ VUs)
        return await self._dispatch_to_go_runner(...)
    else:
        # Fallback to Python asyncio (~500 VUs)
        return {"use_fallback": True}
```

---

## 📝 Scenario Compiler

Converts multiple input formats to universal JSON:

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  HAR    │     │Recording│     │  API    │
│  File   │     │ Session │     │Requests │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  SCENARIO COMPILER   │
          │                      │
          │  • Parse input       │
          │  • Extract steps     │
          │  • Auto-correlate    │
          │  • Add think times   │
          │  • Generate JSON     │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  CompiledScenario    │
          │  (Universal JSON)    │
          └──────────────────────┘
```

### API Endpoints

```bash
# Compile HAR file
POST /api/performance/compile/har
{
  "har_content": "{ ... HAR JSON ... }",
  "name": "My Load Test",
  "config": {"virtual_users": 50, "duration_seconds": 120}
}

# Compile recorded session
POST /api/performance/compile/recording
{
  "network_requests": [
    {"method": "GET", "url": "https://api.example.com/products", "headers": {}}
  ],
  "name": "Recorded Flow"
}

# Compile API requests
POST /api/performance/compile/api-requests
{
  "requests": [
    {"method": "POST", "url": "/api/login", "body": {"user": "${username}"}}
  ]
}
```

---

## 🔄 Run State Machine

```
   ┌──────────┐     start()     ┌──────────┐
   │ CREATED  │ ──────────────▶ │ STARTING │
   └──────────┘                 └────┬─────┘
         │                           │
         │ cancel()                  │ workers ready
         ▼                           ▼
   ┌──────────┐                 ┌──────────┐
   │CANCELLED │                 │ RUNNING  │
   └──────────┘                 └────┬─────┘
                                     │
                        stop() or    │
                        duration     │
                        complete     │
                                     ▼
                               ┌──────────┐
                               │ STOPPING │
                               └────┬─────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
                 ┌──────────┐              ┌──────────┐
                 │ FINISHED │              │  FAILED  │
                 └────┬─────┘              └──────────┘
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

---

## ✅ Pass/Fail Gates

### Default Thresholds

| Metric | Operator | Value | Critical |
|--------|----------|-------|----------|
| `response_time.p95` | < | 800ms | No |
| `response_time.p99` | < | 2000ms | No |
| `error_rate` | < | 1% | **Yes** |
| `throughput.rps` | > | 10 | No |

### Verdict Logic

- If **any critical threshold fails** → `FAIL`
- If **all thresholds pass** → `PASS`
- Otherwise → `FAIL` with count

---

## 🔗 Correlation Engine

### Supported Extractors

| Type | From | Example |
|------|------|---------|
| `json` | Response body | `$.data.token` |
| `header` | Response header | `X-CSRF-Token` |
| `cookie` | Set-Cookie | `JSESSIONID` |
| `regex` | Response body | `token="([^"]+)"` |
| `status` | Status code | `200` |

### Auto-Detection

Both Go and Python engines auto-detect:
- `session_id`, `JSESSIONID`, `PHPSESSID`
- `csrf_token`, `_token`
- `access_token`, `Bearer`

---

## 📊 Metrics Collection

### HdrHistogram (Go Runner)

```go
// Accurate percentiles even at 100K+ RPS
hist := hdrhistogram.New(1, 60000, 3)  // 1ms to 60s, 3 significant digits

type Snapshot struct {
    ActiveVUs          int32
    TotalRequests      int64
    SuccessfulRequests int64
    FailedRequests     int64
    ErrorRate          float64
    RequestsPerSecond  float64
    
    ResponseTimeMin    float64
    ResponseTimeMax    float64
    ResponseTimeAvg    float64
    ResponseTimeP50    float64
    ResponseTimeP95    float64
    ResponseTimeP99    float64
    
    HostCPUPercent     float64
    HostMemoryPercent  float64
    GoGoroutines       int64
}
```

---

## 🌐 Distributed Load Generation

For 5000+ VUs, use multiple Go runner agents:

```
┌─────────────────────────────────────────────────────┐
│               PYTHON CONTROLLER                      │
│           Dispatches CompiledScenario                │
└──────────────────────┬──────────────────────────────┘
                       │ gRPC StartRun
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │ Go Agent  │  │ Go Agent  │  │ Go Agent  │
  │  2K VUs   │  │  2K VUs   │  │  2K VUs   │
  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
                       │ StreamMetrics
                       ▼
              ┌────────────────────┐
              │ Aggregate + Report │
              └────────────────────┘
```

---

## 📡 API Reference

### Run Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/runs/create` | Create run with thresholds |
| `POST` | `/api/performance/runs/{id}/start` | Start execution |
| `POST` | `/api/performance/runs/{id}/stop` | Stop and evaluate |
| `GET` | `/api/performance/runs/{id}` | Get status + metrics |

### Compilation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/performance/compile/har` | HAR → Scenario |
| `POST` | `/api/performance/compile/recording` | Recording → Scenario |
| `POST` | `/api/performance/compile/api-requests` | API → Scenario |

### Go Runner

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/performance/runner/status` | Runner status |
| `POST` | `/api/performance/runner/start-local` | Start local |
| `POST` | `/api/performance/runner/stop-local` | Stop local |

---

## 🔌 Integration Points

### From Record Tab

1. Enable "Capture Network" toggle
2. Record user journey
3. Click "Send to Perf"
4. Network requests → CompiledScenario
5. Run load test

### From API Tab

1. Create/import API requests
2. Click "Send to Perf"
3. Requests → CompiledScenario
4. Run load test

### From HAR File

1. Export HAR from browser DevTools
2. Import in Perf tab
3. HAR → CompiledScenario
4. Run load test

---

## 🛠️ Technical Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Shadcn/UI |
| **Backend** | FastAPI (Python 3.9+) |
| **Load Runner** | Go 1.21, goroutines, HdrHistogram |
| **Communication** | gRPC, Protocol Buffers |
| **Storage** | JSON files (SQLite/Postgres ready) |

---

*© 2026 ArisTrace - Excellence in Every QA Trace*
