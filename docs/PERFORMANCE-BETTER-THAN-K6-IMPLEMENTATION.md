# Performance: All 6 “Better Than k6” Improvements — Implementation

This doc tracks the **six improvements** from [PERFORMANCE-GO-RUNNER-VS-K6.md](./PERFORMANCE-GO-RUNNER-VS-K6.md) and their implementation status.

---

## 1. True scenario mix in one run (4.1)

**Goal:** Run multiple scenarios with weights in one test (e.g. 50% Journey A, 30% B, 20% C).

**Implementation:**
- **API:** `POST /api/performance/tests/run-mix` accepts `scenario_mix: [{ scenario_id, weight_pct }]`, `virtual_users`, `duration_seconds`, etc. Backend starts N runs (one per scenario) with `virtual_users = round(total * weight_pct / 100)`, stores `parent_id -> [child_test_ids]`, returns `parent_id`. `GET /api/performance/tests/{parent_id}/status` and `.../report` aggregate children.
- **UI:** Performance tab “Scenario mix” section: add multiple scenarios (from drafts or saved), set weight % each, then “Run mix”.
- **Status:** Implemented. `POST /api/performance/tests/run-mix` with `scenario_mix: [{ scenario_id, weight_pct }]`; `get_test_status` and `get_test_report` aggregate children; Performance tab can call run-mix via API.

---

## 2. CI/CD and thresholds — verdict + webhook (4.2)

**Goal:** Pass/fail verdict from thresholds; optional webhook on run end for CI.

**Implementation:**
- **Report verdict:** `GET /api/performance/tests/{test_id}/report` includes `verdict: "pass" | "fail"` (from threshold evaluation when thresholds are provided).
- **Webhook:** `POST /api/performance/tests/run` accepts optional `webhook_url`. When the test completes (background task), POST to `webhook_url` with `{ verdict, test_id, summary }`.
- **Status:** Verdict in report; webhook on completion implemented.

---

## 3. Open vs closed model — docs + UI (4.3)

**Goal:** Document and expose “Concurrency (VUs)” vs “Arrival rate (RPS)”.

**Implementation:**
- **Docs:** [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md) and [PERF-SETUP-AND-WALKTHROUGH.md](./PERF-SETUP-AND-WALKTHROUGH.md) updated with “Open vs closed” and when to use arrival rate.
- **API:** `POST /api/performance/compile/load-requests` and `POST /api/performance/tests/run` accept optional `arrival_rate` (requests/sec) and `mode: "concurrency" | "arrival_rate"`.
- **UI:** Performance tab Config: “Mode” dropdown (Concurrency (VUs) | Arrival rate (RPS)); when “Arrival rate”, show “Target RPS” and optional “Ramp (s)”.
- **Status:** Docs updated (PERFORMANCE_PLATFORM_SINGLE_DOC §2.3a Open vs closed). API already accepts `arrival_rate` in compile/load-requests config. UI Mode/Target RPS can be added in Config tab when needed.

---

## 4. Distributed execution — multi-runner from one run (4.4)

**Goal:** One “Run” splits VUs across registered runners and aggregates.

**Implementation:**
- **Go runner client:** When `start_run` is called with `total_vus` and multiple runners are available, split VUs across runners (e.g. by `available_vus`), send same scenario to each with `run_id-0`, `run_id-1`, …; store `run_id -> [run_id-0, run_id-1]`. `get_metrics(run_id)` and `stop_run(run_id)` aggregate/forward to children.
- **API:** `POST /api/performance/tests/run` with `use_distributed: true` uses the split logic when Go runner client is used.
- **Status:** go_runner_client splits VUs across runners and aggregates metrics/stop.

---

## 5. Export to k6 (4.5)

**Goal:** Export scenario to k6 script for CI or scripting.

**Implementation:**
- **API:** `POST /api/performance/compile/load-requests` with `export: "k6"` returns `{ compiled_scenario, base_url, k6_script }`. Or `GET /api/performance/scenarios/{scenario_id}/export/k6` returns a k6 script (if scenario is stored). Script contains `import http from 'k6/http'`, `export default function() { ... }` from scenario steps.
- **Status:** Implemented. `POST /api/performance/compile/load-requests` with body `export: "k6"` returns `k6_script` (generated from compiled scenario: import http, export default function, BASE_URL from env).

---

## 6. Full load test — one-click (4.6)

**Goal:** One button: Lighthouse baseline → SRM start → Load test → SRM stop → Correlation → Lighthouse again.

**Implementation:**
- **UI:** Performance tab “Full load test” button. On click: (1) Run Lighthouse (current URL), (2) Start SRM (if server configured), (3) Start load test (current scenario), (4) Poll until test completes, (5) Stop SRM, (6) Fetch correlation, (7) Run Lighthouse again. Show combined summary (Lighthouse before/after, SRM correlation, load report).
- **Optional API:** `POST /api/performance/full-test` with `url`, `scenario_id`, `virtual_users`, … orchestrates the same sequence server-side and returns combined result (reduces UI polling).
- **Status:** “Full load test” button in Performance tab runs the sequence from the UI.

---

## Flowstral website updates

- **LandingPage.tsx:** Performance copy updated to “better than k6”, SRM, Lighthouse, scenario mix; “NEW” badges removed; hero/Flowstral/Performance section animations tuned (duration, ease, 5th metric “SRM + Lighthouse”).
- **References:** No “new” where performance is mentioned; messaging aligned to current product state.
