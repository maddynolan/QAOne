# Feature: Performance & Load Testing
> Enterprise-grade performance testing with three execution paths (Python VUs, Go runner, in-browser fetch), Lighthouse Core Web Vitals, server resource monitoring, load profiles (spike/stress/endurance/capacity), distributed load generation, and k6 integration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Execution Paths](#7-execution-paths)
8. [Key Subsystems](#8-key-subsystems)
9. [Configuration](#9-configuration)
10. [Known Gaps & TODOs](#10-known-gaps--todos)

---

## 1. Overview

Performance Testing is Flowstral's load and stress testing module. It allows users to:

- **Record HTTP traffic** and convert to load test scenarios
- **Configure load patterns** (constant, ramp, spike, stress, endurance, capacity, breakpoint, wave)
- **Execute load tests** via three independent paths (Python VUs, Go binary, in-browser)
- **Run Lighthouse audits** for Core Web Vitals (LCP, FCP, CLS, TBT, TTI)
- **Monitor server resources** during tests (CPU, memory, disk, network)
- **Correlate** server metrics with response times
- **Generate k6 scripts** for enterprise-grade load testing
- **View real-time metrics** (response time, RPS, error rate, percentiles)
- **Compare test runs** and analyze trends

**Total codebase:** ~12,600 lines across 19 files with 80+ API endpoints.

---

## 2. Architecture

### Three Execution Paths

```
                    ┌──────────────────────────────┐
                    │     Performance Testing       │
                    └──────────┬───────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                   │
            ▼                  ▼                   ▼
    Python LoadGenerator   Go Runner Client   In-Browser Runner
    (load_generator.py)    (go_runner_client)  (Performance.tsx)
    │                      │                   │
    ├── VirtualUser tasks  ├── HTTP to Go bin  ├── fetch() calls
    ├── asyncio concurrency├── gRPC protocol   ├── Max 20 VUs
    ├── Metrics collection ├── Distributed VUs ├── Real-time chart
    └── In-process         └── External binary └── Client-side only
```

### Data Flow

```
Input Sources:
    ├── Protocol Recording (HTTP traffic capture)
    ├── HAR file import
    ├── Manual API request builder
    ├── Flowstral recording conversion
    └── VirtualUserGenerator step builder
        │
        ▼
    ScenarioCompiler (547 lines)
        ├── Compiles to CompiledScenario JSON
        ├── Auto-generates extractors (tokens, IDs)
        └── Configures thresholds and data pools
        │
        ▼
    PerformanceEngine (465 lines - orchestrator)
        ├── LoadGenerator (Python VUs)
        ├── GoRunnerClient (Go binary)
        ├── K6Executor (k6 subprocess)
        ├── LoadProfileManager (7 patterns)
        ├── MonitoringService (real-time metrics)
        ├── CorrelationEngine (request correlation)
        └── ReportingEngine (recommendations)
        │
        ▼
    Outputs:
        ├── Real-time metrics (response time, RPS, error rate, p50-p99)
        ├── Lighthouse Core Web Vitals
        ├── Server resource correlation charts
        ├── Test reports with recommendations
        └── Run comparison and trend analysis
```

---

## 3. Frontend Code Audit

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/pages/Performance.tsx` | 1,991 | **Fully implemented** | Main page: 8 tabs (Quick Start, Record, Live Test, Config, History, System, Lighthouse, Setup). 6 quick-start scenarios. In-browser load runner (max 20 VUs). Protocol capture integration. Server monitoring. Lighthouse runner. Full pipeline button. Run comparison. |
| `src/pages/VirtualUserGenerator.tsx` | 2,730 | **Fully implemented** | Virtual user scenario builder: 8 load patterns, 3 user personas, step builder with HTTP config, import from test cases/Flowstral/HAR, live test execution with real-time metrics polling. |

### Performance.tsx Key Features

- **8 tabs:** Quick Start, Record, Live Test, Config, History, System, Lighthouse, Setup
- **6 quick-start scenarios:** API Load, Spike, Stress, Endurance, Mixed Workload, PWA Load
- **In-browser load runner:** Sends real HTTP requests via `fetch()`, capped at 20 VUs
- **Protocol capture:** Integrates with `/api/protocol-recording/*` for HTTP traffic recording
- **Server monitoring:** Uses SRM API (`/api/srm/*`) for target server metrics
- **Lighthouse:** Runs Google Lighthouse and displays Core Web Vitals
- **Full pipeline button:** Lighthouse → SRM → Load Test → Correlation → Lighthouse (before/after)

### VirtualUserGenerator.tsx Key Features

- **8 load patterns:** constant, ramp_up, ramp_down, spike, stress, soak, breakpoint, wave
- **3 personas:** standard_user, power_user, mobile_user
- **Step builder:** method, URL, headers, body, assertions, extractors, think time
- **Import sources:** Test cases, Flowstral recordings, HAR files
- **Real-time execution:** Polls `/api/performance/tests/{id}/status` for live metrics

---

## 4. Backend Code Audit

### Routers

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/performance_api.py` | 2,411 | `/api/performance` | 64+ | **Fully implemented** |
| `backend/app/routers/scale_api.py` | 158 | `/api/v2` | 8 | **Fully implemented** (not perf-specific) |
| `backend/app/routers/server_monitoring_api.py` | 406 | `/api/srm` | 12 | **Fully implemented** |
| `backend/app/routers/system_monitoring_api.py` | 305 | `/api/monitoring` | 7 | **Fully implemented** |

### Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/performance/performance_engine.py` | 465 | **Fully implemented** | Main orchestrator: instantiates all subsystems, runs load tests (background task), scenario mix, distributed support |
| `backend/app/services/performance/load_generator.py` | 502 | **Fully implemented** | Core VU engine: VirtualUser tasks with staggered ramp-up, protocol handler, correlation, think time, metrics collection (1s polling), percentile calculation (p50-p99) |
| `backend/app/services/performance/load_profiles.py` | 293 | **Fully implemented** | 7 load profiles: linear, step, spike, stress, endurance, capacity, custom. Factory methods for each pattern. |
| `backend/app/services/performance/scenario_compiler.py` | 547 | **Fully implemented** | Compiles HAR, recordings, builder steps, and API requests into `CompiledScenario` JSON. Auto-generates token/ID extractors. |
| `backend/app/services/performance/go_runner_client.py` | 437 | **Fully implemented** | HTTP-based communication with Go runner binary. Local process management, capacity-aware distributed VU splitting, metric aggregation. |
| `backend/app/services/performance/lighthouse_service.py` | 318 | **Fully implemented** | Runs `npx lighthouse` via subprocess. Extracts Performance/Accessibility/BestPractices/SEO scores + Core Web Vitals (LCP, FCP, CLS, TBT, TTI). Hardened mode (N runs, median). In-memory reports. |
| `backend/app/services/performance/distributed_controller.py` | 220 | **Partial stub** | Node registration and VU distribution work. `_start_node_test()` is **placeholder** (sleep 1s, no actual remote communication). |
| `backend/app/services/performance/apm_integration.py` | 245 | **Partial** | Datadog and New Relic are **real** (HTTP POST). Dynatrace and Prometheus are **stubs** (log only). |
| `backend/app/services/performance/reporting_engine.py` | 337 | **Fully implemented** | Reports with recommendations, baseline comparison (10% regression threshold), trend analysis, multi-run comparison. In-memory only. |
| `backend/app/services/performance/run_manager.py` | 544 | **Fully implemented** | Full state machine (CREATED→QUEUED→STARTING→RUNNING→STOPPING→FINISHED/FAILED/CANCELLED). JSON file persistence. Threshold evaluation with pass/fail verdict. |
| `backend/app/services/performance/monitoring_service.py` | 321 | **Fully implemented** | Real-time metrics, SLA threshold checking, anomaly detection. `_collect_metrics()` returns zeros by default (relies on external `update_metrics()` calls). |
| `backend/app/services/performance/network_simulation.py` | 175 | **Fully implemented** | 7 network profiles (Fast 3G, Slow 3G, 4G, Cable, DSL, Dial-up, Custom). Simulates bandwidth, latency, jitter, packet loss. Not auto-integrated into load path. |
| `backend/app/services/executors/k6_executor.py` | 254 | **Fully implemented** | Runs `k6 run` via subprocess. Generates k6 JavaScript with stages, checks, error rate tracking. Parses JSON output for metrics. |

---

## 5. API Endpoints

### Performance (`/api/performance`) — 64+ Endpoints

**Scenarios:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/scenarios` | Create scenario |
| POST | `/scenarios/from-flowstral` | Create from Flowstral recording |
| GET | `/scenarios` | List scenarios |
| GET | `/scenarios/{id}` | Get scenario detail |
| POST | `/scenarios/{id}/steps` | Add step |
| POST | `/scenarios/{id}/export` | Export JSON |
| POST | `/scenarios/import` | Import JSON |

**Compilation:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/compile/har` | Compile HAR to scenario |
| POST | `/compile/recording` | Compile browser recording |
| POST | `/compile/api-requests` | Compile API requests |
| POST | `/compile/load-requests` | Compile recorder requests (optional k6 export) |

**Test Execution:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/tests/run` | Run load test |
| POST | `/tests/run-mix` | Run scenario mix |
| POST | `/tests/{id}/stop` | Stop test |
| GET | `/tests/{id}/status` | Get test status |
| GET | `/tests/{id}/report` | Get test report |

**Metrics & Monitoring:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics/realtime` | Real-time metrics |
| GET | `/metrics/history` | Metrics history |
| POST | `/metrics/record` | Record custom metric |
| GET | `/metrics/summary` | Metrics summary |
| GET | `/metrics/prometheus` | Prometheus format |
| GET | `/system-metrics` | System metrics |

**Go Runner:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/runner/status` | Runner status |
| POST | `/runner/start-local` | Start local runner |
| POST | `/runner/register` | Register runner |
| POST | `/runner/discover` | Discover local runner (port 50051) |
| POST | `/runner/stop-local` | Stop local runner |
| GET | `/runner/heartbeat` | Runner heartbeat |

**Lighthouse:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/lighthouse/run` | Run Lighthouse |
| POST | `/lighthouse/run-hardened` | Hardened run (median of N) |
| GET | `/lighthouse/report/{id}` | Get report |
| GET | `/lighthouse/result/{id}` | Get result |
| POST | `/pwa/performance` | PWA performance audit |

**Run Management:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/runs/create` | Create run (state machine) |
| POST | `/runs/{id}/start` | Start run |
| POST | `/runs/{id}/stop` | Stop run |
| POST | `/runs/{id}/metrics` | Update metrics |
| POST | `/runs/{id}/evaluate` | Evaluate thresholds |
| GET | `/runs/{id}` | Get run details |
| GET | `/runs` | List runs |
| GET | `/runs/history/{id}` | Run history |
| POST | `/runs/compare` | Compare runs |

**Additional:** Load profiles, data pools, reports, baselines, trends, alerts, schedules, transactions, errors, correlation, workloads, checks, groups, tags, scripts, and capabilities endpoints.

### Server Resource Monitoring (`/api/srm`) — 12 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/servers` | Add server to monitor |
| DELETE | `/servers/{id}` | Remove server |
| GET | `/servers` | List servers |
| POST | `/start` | Start monitoring |
| POST | `/stop` | Stop monitoring |
| GET | `/current` | Current server metrics |
| POST | `/record-response-time` | Record for correlation |
| GET | `/correlation` | Correlation chart data |
| GET | `/summary/{id}` | Server summary |
| GET | `/summary` | All summaries |
| GET | `/health-check` | Health check |
| GET | `/comparison` | Feature comparison |

### System Monitoring (`/api/monitoring`) — 7 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/start` | Start monitoring at interval |
| POST | `/stop` | Stop monitoring |
| GET | `/current` | Current system snapshot (psutil) |
| GET | `/history` | Historical metrics |
| GET | `/summary` | Summary statistics |
| GET | `/health-check` | Health check with warnings |
| GET | `/correlation` | Formatted correlation data |

---

## 6. UI Walkthrough

### Quick Start Load Test

1. Navigate to **Performance** from the sidebar.
2. In the **Quick Start** tab, select a scenario (API Load, Spike, Stress, etc.).
3. Enter the target URL.
4. Configure VUs, duration, and ramp-up time.
5. Click **Start Test** — the in-browser runner sends requests.
6. Watch live metrics: response time, RPS, error rate, percentiles chart.
7. Stop or wait for completion. View summary.

### Virtual User Generator

1. Navigate to **Virtual User Generator**.
2. Select a **load pattern** (constant, ramp_up, spike, stress, soak, breakpoint, wave).
3. Choose a **user persona** (standard, power_user, mobile_user).
4. Add HTTP request steps: method, URL, headers, body, assertions, think time.
5. Or **import** from test cases, Flowstral recordings, or HAR files.
6. Click **Run Test** — sends to backend `/api/performance/tests/run`.
7. Poll status for live metrics. View results when complete.

### Lighthouse Audit

1. In the **Lighthouse** tab, enter the target URL.
2. Select form factor (desktop or mobile).
3. Click **Run Audit**.
4. View scores: Performance, Accessibility, Best Practices, SEO.
5. View Core Web Vitals: LCP, FCP, CLS, TBT, TTI.

---

## 7. Execution Paths

### Path 1: Python LoadGenerator (In-Process)

The primary execution engine. Creates `VirtualUser` asyncio tasks with staggered ramp-up:

- Each VU runs an iteration loop: send request → collect metrics → think time → repeat
- Metrics collected every 1 second (response times, error count, active VUs)
- Percentile calculation: p50, p75, p90, p95, p99
- Supports protocol handler callback and correlation data

### Path 2: Go Runner (External Binary)

For higher-scale load generation:

- `GoRunnerClient` communicates with Go binary via HTTP (port 50051)
- Can start/stop local process or register remote runners
- Capacity-aware: distributes VUs across multiple runners proportionally
- Aggregates metrics from distributed child runs

### Path 3: In-Browser Runner (Client-Side)

For quick demos and small-scale tests:

- `Performance.tsx` sends `fetch()` calls directly from the browser
- Capped at 20 virtual users
- Real-time chart updates
- No backend involvement (except for CORS issues)

---

## 8. Key Subsystems

### Load Profiles

| Profile | Pattern |
|---------|---------|
| **Linear** | Gradual ramp from 0 to target VUs |
| **Step** | Step-wise increases at intervals |
| **Spike** | Sharp burst, hold, drop |
| **Stress** | Ramp to target, then 50% overload |
| **Endurance** | Sustained load for extended duration |
| **Capacity** | Gradual increase until failure |
| **Custom** | User-defined VU schedule |

### Run Manager State Machine

```
CREATED → QUEUED → STARTING → RUNNING → STOPPING → FINISHED
                                    ↓                  ↓
                                  FAILED           CANCELLED
```

**Persistence:** JSON files at `data/performance_runs/runs_index.json`

### Threshold Evaluation

Default thresholds:
- `p95_response_time` < 2000ms
- `p99_response_time` < 5000ms
- `error_rate` < 5%
- `throughput` > 10 RPS

**Verdict:** PASS if all thresholds met, FAIL if any critical threshold exceeded.

---

## 9. Configuration

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATADOG_API_KEY` | APM Integration | Send metrics to Datadog |
| `NEW_RELIC_LICENSE_KEY` | APM Integration | Send metrics to New Relic |

### Go Runner

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 50051 | Go runner HTTP port |
| Binary path | Auto-discovered | Searched in filesystem |

### Lighthouse

| Setting | Default | Description |
|---------|---------|-------------|
| Node.js | Auto-discovered | Required for `npx lighthouse` |
| Hardened runs | 3 | Number of runs for median calculation |

---

## 10. Known Gaps & TODOs

### Stubs

| Component | Issue |
|-----------|-------|
| `distributed_controller.py` `_start_node_test()` | **Placeholder** — sleeps 1s, does not communicate with remote nodes |
| `apm_integration.py` Dynatrace | **Log-only stub** |
| `apm_integration.py` Prometheus | **Log-only stub** |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **In-memory storage** | `lighthouse_service.py`, `reporting_engine.py`, `monitoring_service.py` all use in-memory dicts. Lost on restart. Only `run_manager.py` persists to disk. |
| **Three independent execution paths** | Python LoadGenerator, Go Runner, in-browser fetch are completely independent with no shared metrics pipeline. |
| **k6_executor.py** | Uses synchronous `subprocess.run()` in async method — blocks the event loop. |
| **monitoring_service.py `_collect_metrics()`** | Returns zeroed values by default. Relies on external `update_metrics()` calls. |
| **network_simulation.py** | Not auto-integrated into load generator request path. Must be called explicitly. |
| **load_generator.py `stop_load_test()`** | Simplified cancellation — comment notes "In a real implementation, you'd track tasks and cancel them properly." |
| **In-browser runner capped at 20 VUs** | Not suitable for serious load testing, only for quick demos. |

---

*Last updated: 2026-02-08*
*Generated by code audit of the Flowstral performance testing feature.*
