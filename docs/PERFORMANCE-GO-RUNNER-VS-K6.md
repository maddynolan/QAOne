# Go Runner (QAAI) vs k6 — Where We Win, Where k6 Wins, How to Get Better

This doc compares **our load-test stack** (QAAI + Go runner + Performance tab) with **k6** (Grafana): where we have an edge, where k6 is better, and **how we can make ours better than k6** where it matters.

---

## 1) Where we have the edge (today)

| Area | Us (QAAI + Go runner) | Why it matters |
|------|------------------------|----------------|
| **Record → load test in one place** | Recorder (Load Testing on) → Quick Load Test → Performance tab → “Use these requests” → Run. No export/import, no writing scripts. | Faster path from “I recorded a flow” to “I’m load-testing it.” Good for non-scripters and quick validation. |
| **SRM (Server Resource Monitoring)** | Built-in: add server (SSH/WMI/Prometheus/CloudWatch), start monitoring, run load test, stop, view **response time vs CPU/memory** correlation. | Enterprise need: “Is the server the bottleneck?” k6 can send metrics to Prometheus etc., but you wire and interpret correlation yourself. |
| **Lighthouse in the same UI** | Performance tab → Lighthouse: run before/after load, Core Web Vitals (LCP, FCP, CLS, TBT, TTI) + performance score. Optional run-hardened (median of N runs). | Single pane: load + front-end quality. With k6 you run Lighthouse separately (e.g. CI) and correlate manually. |
| **Drafts + compare runs** | Drafts API (recorder handoff), run manager, compare two runs (e.g. baseline vs last). | Traceability and regression: “this run vs that run” without leaving the app. |
| **No scripting required** | Scenario = compiled JSON (steps, think time, thresholds). Run from UI or API without writing JavaScript. | Lower barrier for QA/product; scripters can still use k6 when they need logic. |
| **Cost (software)** | Free — we own the stack. Go runner on your VMs = $0 license. | k6 OSS on your VMs is also free; Grafana Cloud k6 is paid. We’re on par for self-hosted; we don’t depend on a vendor cloud. |

**Summary:** We’re better for **integrated workflow** (record → draft → load → SRM → Lighthouse → compare) and **single-pane observability** (load + server + front-end quality) without scripting.

---

## 2) Where k6 is better (today)

| Area | k6 | Why it matters |
|------|-----|----------------|
| **Scripting and logic** | Full JavaScript: conditions, loops, custom metrics, checks, thresholds, data (JSON/CSV), multiple scenarios in one script. | Complex flows (e.g. “if status 200 then POST /cart else retry”), parameterization, and scenario mix in one file. We have JSON scenarios + optional extractors; no full scripting. |
| **Scale and distribution** | Single process to 100k+ VUs with proper sizing; native distributed execution (multiple nodes); Grafana Cloud for managed scale. | Very large or geo-distributed tests. We scale via multiple Go runner VMs (manual); no built-in “distributed controller” that auto-shards. |
| **CI/CD and ecosystem** | Native GitHub Actions, GitLab CI, Jenkins plugins; exit codes and thresholds for pass/fail; k6 Cloud for result storage and trends. | “Run on every commit” and “fail the build if p95 > X.” We can be triggered via API but don’t have first-class CI plugins or cloud result history. |
| **Protocol and format support** | HTTP/1.1, HTTP/2, WebSockets, gRPC, GraphQL (via JS), MQTT, etc. via core or extensions. | Broader protocol coverage out of the box. We focus on HTTP; others possible but not as rich. |
| **Open/closed model and docs** | Well-documented **open** (VUs) vs **closed** (arrival rate) model; ramp stages (stages option). | Clear mental model for test design. We have stages/think time; we could document and expose open vs closed more clearly. |
| **Community and extensions** | Large community, many extensions (browser, Kafka, Redis, etc.), xk6 for custom builds. | Ecosystem and “batteries included” for advanced use cases. |

**Summary:** k6 is better for **scripting**, **max scale / distribution**, **CI/CD integration**, and **protocol/ecosystem breadth**.

---

## 3) Are we “good” or is k6 “better”?

- **For “record a flow and load-test it quickly, with SRM and Lighthouse in one place”** → **we are better** (integrated workflow, no scripting, single pane).
- **For “script complex logic, run in CI, or scale to 10k+ VUs across many nodes”** → **k6 is better**.

So: **we’re better for integrated, enterprise-style observability (load + SRM + Lighthouse + compare); k6 is better for scripting, scale, and CI.** Neither is universally “better”; it depends on the use case.

---

## 4) How we can make ours better than k6 (where it counts)

Priorities to **close gaps** and **extend our edge**:

### 4.1 True scenario mix in one run (UI + API)

- **Gap:** Today `POST /api/performance/tests/run` takes a single `scenario_id`. k6 can run multiple “scenarios” (different functions) with weights in one script.
- **Improvement:** Support **multiple scenario IDs + weights** in one run (e.g. `scenario_ids: [{ id: "A", weight: 50 }, { id: "B", weight: 30 }, { id: "C", weight: 20 }]`). Backend (and Go runner) assign each VU to a scenario by weight and run that scenario for the duration. Expose in Performance tab as “Scenario mix” (add journeys, set %).
- **Outcome:** “50% homepage, 30% scroll, 20% clicks” in **one** run, without workarounds. We match k6-style mix and keep no-script UX.

### 4.2 CI/CD and thresholds (pass/fail, exit code)

- **Gap:** k6 has native CI plugins and exit codes (e.g. fail if p95 > 500 ms). We have thresholds in scenario/runner but no standard “perf gate” export (e.g. JUnit) or CI plugin.
- **Improvement:** (1) **Threshold verdict** in run report (pass/fail) and expose in API. (2) **JUnit-style XML** or **generic webhook** on run end (e.g. POST results to a URL). (3) **GitHub Action / GitLab CI** example (or plugin) that calls our API, runs test, and fails the job if verdict = fail.
- **Outcome:** “Run load test on every deploy and fail if regressed” without leaving our stack. We close the CI gap vs k6.

### 4.3 Open vs closed model (docs + UI)

- **Gap:** k6 documents open (VUs) vs closed (arrival rate) model clearly. We have stages and think time but don’t explain the model or expose “arrival rate” as a first-class option.
- **Improvement:** (1) Document **open vs closed** in PERFORMANCE_PLATFORM_SINGLE_DOC and PERF-SETUP. (2) In Performance tab Config, add **mode**: “Concurrency (VUs)” vs “Arrival rate (RPS)” and, for arrival rate, **target RPS** + optional ramp. Backend/runner interpret accordingly (e.g. constant rate with variable concurrency).
- **Outcome:** Same mental model as k6 for test design; we’re not “worse” for lack of clarity.

### 4.4 Distributed execution (multi-runner from one “run”)

- **Gap:** k6 has native distributed execution; we have “register multiple runners” but a single run is dispatched to one runner (or we’d need to split VUs across runners in the backend).
- **Improvement:** When starting a run, **backend splits VUs across registered runners** by capacity (e.g. 2000 VUs → 1000 to runner A, 1000 to runner B), sends same scenario to each, and **aggregates** status and report. One “Run” in the UI = one logical test, N runners. Optionally: “distributed” flag and a simple scheduler (by available VUs from heartbeat).
- **Outcome:** “2000 VU run” without manually starting two tests on two runners. We approach k6-style scale with our own runner.

### 4.5 Scripting/DSL (optional, for power users)

- **Gap:** k6 = full JS; we = JSON scenario only. Power users want conditions, loops, parameterization.
- **Improvement:** (1) **Data pools + templating** (already partly there): CSV/JSON upload, `{{user.email}}` in URL/body; document and expose in UI. (2) Optional **small DSL or expression language** in scenario (e.g. “if step.response.status == 200 then next step else skip”) without full JS. (3) Or: “Export to k6 script” from our scenario so scripters can refine in k6 and we stay the “record → quick run” path.
- **Outcome:** We don’t need to beat k6 at “full JS”; we can stay best at “no script” and add “enough” logic (data pools, light expressions) plus “export to k6” for the rest.

### 4.6 Lighthouse + SRM during/after load (one-click “full test”)

- **Gap:** Today you run Lighthouse before and after manually; SRM is separate start/stop. “One click = load + SRM + Lighthouse” is a procedure, not a single action.
- **Improvement:** **“Full load test”** preset or button: (1) Run Lighthouse baseline, (2) Start SRM, (3) Start load test (with optional record-response-time), (4) When load finishes, Stop SRM, (5) Run Lighthouse again, (6) Show: load report + SRM correlation + Lighthouse before/after. One flow, one place.
- **Outcome:** We double down on “single pane” and make “enterprise full test” the default experience vs k6 (where you assemble this yourself).

---

## 5) Summary table

| Dimension | Us today | k6 today | How we get better |
|-----------|----------|----------|-------------------|
| Record → load | ✅ Better | Export/script | Keep UX; add scenario mix. |
| SRM + correlation | ✅ Better | DIY | Add “full test” one-click. |
| Lighthouse in same UI | ✅ Better | Separate | Keep; add “full test” flow. |
| Scenario mix (weighted journeys) | ⚠️ Endpoint weights only | Script | Add multi-scenario + weights in one run. |
| CI/CD, pass/fail | ⚠️ API only | Native | Add verdict, JUnit/webhook, CI example. |
| Open/closed model | ⚠️ Implicit | Documented | Document + add arrival-rate option in UI. |
| Distributed run | ⚠️ Multi-runner manual | Native | Auto-split VUs across runners, aggregate. |
| Scripting / logic | ❌ JSON only | Full JS | Data pools + light DSL or “export to k6.” |
| Scale (single run) | ~1k–2k per runner | 10k+ / distributed | Multi-runner auto-split + optional scaling. |

**Bottom line:** We’re already better for **integrated load + SRM + Lighthouse + compare** and **no-script recording**. To be “better than k6” in more dimensions: add **scenario mix**, **CI/verdict**, **distributed one-run**, and **full-test one-click**; document **open/closed** and add **arrival rate**; keep scripting optional (data pools + export to k6). That keeps our edge and closes the main gaps.
