# Performance / Load Testing – Optimizations & Additions

This document describes the enterprise optimizations and additions implemented for the performance/load testing tool (drafts, engine guardrails, correlation/secrets, workload modeling, results store, Lighthouse hardening, SRM app-level, Go runner heartbeat).

---

## A) Replayable traffic (correlation + auth)

**Implemented:**

- **Scenario compiler:** Extractors (JSON path, regex), think time, correlation rules; Go scenario supports `extract` and templating.
- **Secrets resolver:** `backend/app/services/performance/secrets_resolver.py` – resolve `{{VAR}}` in headers, body, URL from environment at runtime. Never store credentials in scenarios; use env vars (e.g. `AUTH_TOKEN`, `API_KEY`) and reference as `{{AUTH_TOKEN}}`.
- **Docs:** Correlation and session handling are documented in PERF-CAPABILITIES-REFERENCE; use extractors and data pools for multi-user parameterization.

**Usage:** In compiled scenario steps, use extractors to capture tokens from responses; in subsequent steps use variables in headers/body/URL. For secrets, set env vars and use `{{SECRET_NAME}}` in scenario; backend resolves at execution time.

---

## B) Backend draft run (replace sessionStorage)

**Implemented:**

- **Draft store:** `backend/app/services/performance/draft_store.py` – in-memory store with optional TTL (default 24h).
- **API:**  
  - `POST /api/performance/drafts` – create draft (requests, name, source, created_by, ttl_seconds).  
  - `GET /api/performance/drafts/{draft_id}` – get draft.  
  - `GET /api/performance/drafts` – list drafts.  
  - `DELETE /api/performance/drafts/{draft_id}` – delete draft.
- **Recorder:** "Quick Load Test" posts to `/api/performance/drafts` and redirects to `/performance?draft_id=...`. Fallback: sessionStorage if API fails.
- **Perf tab:** On load, reads `?draft_id=` from URL, fetches draft, populates "From Recorder" requests. Also supports sessionStorage for backward compatibility.

**Benefits:** Shareable across machines, durable across reloads, auditable (created_by, timestamps).

---

## C) Right engine for the right test

**Implemented:**

- **In-browser runner:** Capped at **20 VUs** (`MAX_BROWSER_VUS`). Labeled as "Quick validation (browser)" in Quick Start and Config.
- **Config tab:** Virtual Users input max = 20; helper text: "For more VUs use Go runner or k6 (Setup tab)."
- **runLoadTest:** If requested VUs > 20, caps at 20 and shows toast: "In-browser runner capped at 20 VUs. Use Go runner or k6 for X+ VUs."
- **Setup tab:** Documents Go runner and k6 for "real load" (50–10,000+ VUs).

---

## D) Workload modeling

**Implemented:**

- **Config (scenario_compiler):** `stages: [[duration_seconds, target_vus], ...]`, `think_time_min_ms`, `think_time_max_ms`, optional `arrival_rate` (requests/sec).
- **compile/load-requests:** Accepts `config.stages`, `config.think_time_min_ms`, `config.think_time_max_ms`, `config.arrival_rate`.
- **Quick-start scenarios:** Already use weights per endpoint. Config supports think time and duration/ramp.

**Usage:** POST `/api/performance/compile/load-requests` with `config: { stages: [[30, 10], [60, 50], [30, 0]], think_time_min_ms: 500, think_time_max_ms: 2000 }`.

---

## E) Results store + trend comparisons

**Implemented:**

- **Run manager:** Run metadata, state machine, thresholds, verdict; persistent storage (JSON).
- **API:** `GET /api/performance/runs`, `GET /api/performance/runs/{run_id}`, `POST /api/performance/runs/compare` (body: `run_ids`), `GET /api/performance/runs/history/{scenario_id}`, reports/baseline/trends.
- **Perf tab History:** "Compare runs (last vs baseline)" card – button to compare last 2 runs via API (GET runs, POST runs/compare).

---

## F) Lighthouse execution hardening

**Implemented:**

- **run_lighthouse_hardened:** `backend/app/services/performance/lighthouse_service.py` – run Lighthouse N times (default 3), return **median** result for performance_score, LCP, FCP, CLS, TBT, TTI.
- **Artifacts:** Optional `save_artifacts` and `artifacts_dir` – save raw JSON report per run to disk (e.g. `data/lighthouse_artifacts/{run_id}_run0.json`).
- **API:** `POST /api/performance/lighthouse/run-hardened` – body: url, form_factor, timeout_seconds, runs (default 3), cache_strategy (cold|warm), save_artifacts, artifacts_dir.

**Usage:** For stable PWA performance numbers, use run-hardened; median reduces single-run flukes.

---

## G) SRM: app-level signals and recommended metrics

**Implemented:**

- **Existing:** SRM monitors CPU, memory, disk, network; supports Prometheus, SSH, WMI, CloudWatch. Transaction analyzer categorizes errors (timeout, connection, 4xx, 5xx).
- **API:** `GET /api/performance/errors/analysis` – error analysis and summary. SRM correlation: `GET /api/srm/correlation`.
- **Docs:** PERF-CAPABILITIES-REFERENCE and PERF-SETUP document SRM workflow. Recommended Prometheus metrics (DB connections, queue depth, downstream latency, 4xx/5xx by endpoint) can be added as custom metrics in your Prometheus config; SRM can scrape any Prometheus-compatible endpoint.

---

## H) Go runner: heartbeat and capacity awareness

**Implemented:**

- **Heartbeat:** `GET /api/performance/runner/heartbeat` – returns runner status, available_vus, current_vus, active_runs, timestamp for health checks and capacity-aware scheduling.
- **Existing:** Runner registration, discover, start-local, stop-local; run manager and performance engine can dispatch to Go runner when available.

**Future:** Job queue, capacity-based scheduling, and streaming live metrics (SSE/WebSocket) can be added on top of heartbeat and run APIs.

---

## Summary table

| Item | Status | Where |
|------|--------|--------|
| A – Correlation + secrets | Done | scenario_compiler extractors; secrets_resolver.py; docs |
| B – Draft run | Done | draft_store.py; POST/GET/DELETE /drafts; Recorder + Perf tab |
| C – Engine guardrails | Done | MAX_BROWSER_VUS=20; labels; Config cap; Setup tab |
| D – Workload modeling | Done | Config.stages, think_time_min/max, arrival_rate; compile/load-requests |
| E – Results + compare | Done | run_manager; GET runs, POST runs/compare; History Compare card |
| F – Lighthouse hardened | Done | run_lighthouse_hardened; POST lighthouse/run-hardened; artifacts_dir |
| G – SRM app-level | Doc + existing | Error analysis API; SRM correlation; recommended metrics in docs |
| H – Runner heartbeat | Done | GET /runner/heartbeat; capacity/status for scheduling |

---

*See also: PERF-SETUP-AND-WALKTHROUGH.md, PERF-CAPABILITIES-REFERENCE.md.*
