# Performance / Load Testing – Capabilities Reference

Full reference for the enterprise load testing tool: APIs, options, recorder integration, Lighthouse, PWA performance, and server-side metrics.

---

## 1. Overview

| Area | Description |
|------|-------------|
| **Load testing** | In-browser (fetch loop), Go runner, k6. Scenarios from Quick Start, Custom Config, or From Recorder. |
| **Recorder integration** | Recorder POSTs to `/api/performance/drafts` and redirects to `/performance?draft_id=...` (preferred); fallback: sessionStorage. Perf tab loads draft or session and runs load test. |
| **Drafts** | Backend persistence for load-test drafts (shareable, durable, auditable). POST/GET/DELETE `/drafts`. |
| **Engine guardrails** | In-browser runner capped at 20 VUs (quick validation); Go runner/k6 for real load (50+ VUs). |
| **Compile** | HAR, recording (network_requests), API requests, load-requests (from Recorder) → CompiledScenario for Go runner. |
| **Lighthouse** | Run Lighthouse from backend (npx). Performance score + LCP, FCP, CLS, TBT, TTI. |
| **PWA performance** | PWA Load scenario (document + manifest + SW). Lighthouse for PWA URL. Full PWA audit in Flowstral Desktop. |
| **Server-side metrics (SRM)** | Monitor target server CPU, memory, disk during load tests (Prometheus, SSH, WMI, CloudWatch). |

---

## 2. Performance API Endpoints (Backend)

Base prefix: `/api/performance`.

### Scenarios

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scenarios` | Create scenario (name, description). |
| GET | `/scenarios` | List scenarios. |
| GET | `/scenarios/{scenario_id}` | Get scenario details. |
| POST | `/scenarios/{scenario_id}/steps` | Add step (http_request). |
| POST | `/scenarios/{scenario_id}/export` | Export scenario JSON. |
| POST | `/scenarios/import` | Import scenario from JSON. |

### Compile (→ CompiledScenario for Go runner)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/compile/har` | Compile HAR → scenario. Body: `har_content`, `name`, `config`. |
| POST | `/compile/recording` | Compile recording → scenario. Body: `network_requests`, `recorded_steps`, `name`, `config`. |
| POST | `/compile/api-requests` | Compile API requests → scenario. Body: `requests`, `name`, `config`. |
| POST | `/compile/load-requests` | **From Recorder.** Compile load test requests → scenario. Body: `requests` (array of `{ method, url, headers?, body? }`), `name`, `config`. Returns `compiled_scenario`, `base_url`. |

### Go Runner

| Method | Path | Description |
|--------|------|-------------|
| GET | `/runner/status` | Runner status, capacity, list of runners. |
| POST | `/runner/start-local` | Start local Go runner (body: `max_vus`). |
| POST | `/runner/register` | Register runner (body: `hostname`, `port`, `max_vus`, `agent_id`). |
| POST | `/runner/discover` | Discover local runner on port 50051. |
| POST | `/runner/stop-local` | Stop local Go runner. |
| GET | `/runner/heartbeat` | Runner heartbeat: status, available_vus, current_vus, active_runs, timestamp (for health checks and capacity-aware scheduling). |

### Load Tests

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tests/run` | Run load test. Body: `scenario_id`, `virtual_users`, `ramp_up_seconds`, `duration_seconds`, `ramp_down_seconds`, `think_time_ms`, `base_url`, `protocol`, `thresholds`, `sla_thresholds`, `use_distributed`. |
| POST | `/tests/{test_id}/stop` | Stop test. |
| GET | `/tests/{test_id}/status` | Test status. |
| GET | `/tests/{test_id}/report` | Test report. |

### Metrics & Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics/realtime` | Real-time metrics dashboard. |
| GET | `/metrics/history` | Metrics history (query: `start_time`, `end_time`, `limit`). |
| GET | `/system-metrics` | System resource metrics (local machine). |
| POST | `/reports/generate` | Generate test report. Body: `test_id`, `test_data`, `system_metrics`. |
| POST | `/reports/baseline` | Set baseline. Body: `scenario_id`, `test_id`, `test_data`. |
| GET | `/reports/trends/{scenario_id}` | Trend analysis (query: `days`). |

### Lighthouse & PWA Performance

| Method | Path | Description |
|--------|------|-------------|
| POST | `/lighthouse/run` | Run Lighthouse. Body: `url`, `form_factor` (desktop/mobile), `timeout_seconds`. Returns: `run_id`, `success`, `performance_score`, `lcp_ms`, `fcp_ms`, `cls`, `tbt_ms`, `tti_ms`, `categories`, `audits`, `error`. |
| GET | `/lighthouse/report/{run_id}` | Full Lighthouse report JSON. |
| GET | `/lighthouse/result/{run_id}` | Result summary (scores, Web Vitals). |
| POST | `/pwa/performance` | PWA performance: run Lighthouse for PWA URL. Body: `url`, `form_factor`, `timeout_seconds`. Full PWA audit (manifest, SW, offline) is in Flowstral Desktop. |

### Enterprise (Load profiles, data pools, alerts, schedules)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/load-profiles/create` | Create load profile (spike, stress, endurance, capacity). |
| POST | `/data-pools/create` | Create data pool (parameterization). |
| POST | `/alerts/create` | Create performance alert. |
| POST | `/schedules/create` | Create scheduled test. |
| POST | `/correlation/rules` | Add correlation rule. |
| GET | `/transactions/breakdown` | Transaction breakdown. |
| GET | `/errors/analysis` | Error analysis. |

### Run Manager (State machine, thresholds)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/runs/create` | Create run (scenario_id, virtual_users, duration_seconds, target_url, thresholds, tags). |
| POST | `/runs/{run_id}/start` | Start run. |
| POST | `/runs/{run_id}/stop` | Stop run, evaluate thresholds. |
| POST | `/runs/{run_id}/metrics` | Update run metrics. |
| POST | `/runs/{run_id}/evaluate` | Evaluate thresholds, return verdict. |
| GET | `/runs/{run_id}` | Run details. |
| GET | `/runs` | List runs (query: scenario_id, state, limit, offset). |
| GET | `/runs/history/{scenario_id}` | Run history (query: days). |
| POST | `/runs/compare` | Compare runs. Body: `run_ids`. |
| GET | `/thresholds/defaults` | Default pass/fail thresholds. |

---

## 3. Server Resource Monitoring (SRM) API

Base prefix: `/api/srm`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/servers` | Add server. Body: `alias`, `server_type` (linux_ssh, windows_wmi, prometheus, aws_cloudwatch, …), `host`, `port`, credentials. |
| DELETE | `/servers/{server_id}` | Remove server. |
| GET | `/servers` | List servers. |
| POST | `/start` | Start monitoring. Body: `interval_seconds`. |
| POST | `/stop` | Stop monitoring. |
| GET | `/current` | Current server metrics (CPU, memory, disk per server). |
| POST | `/record-response-time` | Record response time for correlation. Body: `response_time_ms`, `transaction_name`, `status`. |
| GET | `/correlation` | Response time vs server CPU/memory correlation. |
| GET | `/help` | SRM usage and step-by-step. |

---

## 4. Protocol Recording API

Base prefix: `/api/protocol-recording`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/start` | Start protocol recording. Body: `recording_id`, `name`, `base_url`. |
| POST | `/stop/{recording_id}` | Stop and get summary. |
| POST | `/export-har/{recording_id}` | Export HAR. |
| GET | `/{recording_id}` | Recording details. |

---

## 5. Frontend Performance Tab

### Tabs

| Tab | Purpose |
|-----|---------|
| **Quick Start** | Pre-configured scenarios (API Load, Spike, Stress, Endurance, Mixed Workload, **PWA Load**). Run Test. |
| **Record** | Protocol Capture (HAR), Server CPU Monitoring (SRM). Add server, start/stop monitoring, export HAR. |
| **Live** | Live test metrics (requests, response time, RPS, server CPU/memory history when SRM enabled). |
| **Config** | Custom Test: Base URL, Virtual Users, Duration, Ramp Up, Think Time. Run Custom Test. From Recorder: “Use these requests” fills endpoints. |
| **History** | Past test runs. |
| **System** | Local system resources (CPU, memory, network). |
| **Lighthouse** | URL input, Desktop/Mobile, Run Lighthouse. Display Performance score, LCP, FCP, CLS, TBT, TTI. |
| **Setup** | Step-by-step: Go runner, k6, Lighthouse, SRM. |

### From Recorder Flow

1. Recorder sets `sessionStorage.pendingLoadTestRequests` (array of `{ method, url, headers?, body? }`) and `pendingLoadTestTimestamp`, then navigates to `/performance`.
2. Performance page on load reads sessionStorage; if present, shows **From Recorder: N request(s)** banner.
3. **Use these requests** → parses URLs to base URL + paths, sets `recorderEndpoints`, `customConfig.baseUrl`, switches to Config tab. Clears sessionStorage.
4. **Run Custom Test** uses `recorderEndpoints` (or default) with `customConfig.baseUrl`, virtual users, duration, ramp-up.

---

## 6. PWA-Specific Capabilities

| Capability | Where | Description |
|------------|-------|-------------|
| **PWA Load scenario** | Perf tab → Quick Start | Hits `/`, `/manifest.json`, `/service-worker.js` with configurable VUs and duration. Set Base URL to PWA origin in Config. |
| **Lighthouse for PWA** | Perf tab → Lighthouse, or POST `/api/performance/pwa/performance` | Run Lighthouse on PWA URL; get Performance + LCP/FCP/CLS. |
| **PWA audit (manifest, SW, offline, cache, installability)** | Flowstral Desktop | PWA actions in Test Builder / action handlers. See **PWA_TESTING_GUIDE.md**. |
| **PWA performance under load** | Optional | Run PWA Load scenario; before/after run Lighthouse to compare Web Vitals. |

---

## 7. Quick Reference: Config Shapes

### compile/load-requests (From Recorder)

```json
{
  "requests": [
    { "method": "GET", "url": "https://example.com/api/products", "headers": {}, "body": "" }
  ],
  "name": "From Recorder",
  "config": {
    "virtual_users": 50,
    "duration_seconds": 60,
    "ramp_up_seconds": 10,
    "target_url": "https://example.com"
  }
}
```

### lighthouse/run

```json
{
  "url": "https://your-pwa.example.com",
  "form_factor": "desktop",
  "timeout_seconds": 120
}
```

### pwa/performance

```json
{
  "url": "https://your-pwa.example.com",
  "form_factor": "mobile",
  "timeout_seconds": 120
}
```

### SRM add server (Prometheus)

```json
{
  "alias": "target_server",
  "server_type": "prometheus",
  "host": "localhost",
  "port": 9090
}
```

### SRM add server (Linux SSH)

```json
{
  "alias": "app_server",
  "server_type": "linux_ssh",
  "host": "app.example.com",
  "port": 22,
  "username": "monitor",
  "password": "secret"
}
```

---

*See also: **PERF-SETUP-AND-WALKTHROUGH.md**, **PERF-OPTIMIZATIONS.md** (drafts, engine guardrails, secrets, workload, Lighthouse hardened, runner heartbeat), **PWA_TESTING_GUIDE.md**, **PWA-PERFORMANCE-AND-LOAD-TESTING.md**.*
