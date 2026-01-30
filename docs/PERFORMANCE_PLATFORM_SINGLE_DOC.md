# Performance / Load Testing Platform — Single Doc (Quickstart → Concepts → Workflows → API → Ops)

This document describes the end-to-end **enterprise load testing stack**: Recorder/Protocol capture → Drafts → Performance tab → Scenario compile → Execution (Browser / Go runner / k6) → Observability (SRM) → Frontend metrics (Lighthouse + PWA).

**Document review (accuracy):** This consolidated doc matches the implemented behavior and APIs. Cross-checked against PERF-OPTIMIZATIONS, PERF-CAPABILITIES-REFERENCE, and PERF-SETUP-AND-WALKTHROUGH. Minor clarifications: (1) Drafts API base path is `/api/performance` so endpoints are e.g. `POST /api/performance/drafts`. (2) Run manager compare uses `POST /api/performance/runs/compare` with body `{ "run_ids": ["id1", "id2"] }`. (3) Lighthouse run-hardened accepts `cache_strategy` (cold|warm) and `artifacts_dir` (default `data/lighthouse_artifacts`).

**Step-by-step enterprise run:** For a full walkthrough (deploy site to AWS → browser run → API load test → Go runner → SRM → Lighthouse), see [PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md](./PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md).

---

## ELI5: AWS terms (Explain Like I'm 5)

- **AWS (Amazon Web Services)**  
  A cloud where you rent computers and services over the internet instead of buying your own servers. Like “rent a computer in Amazon’s building.”

- **EC2**  
  “Rent a virtual computer” (a VM). You choose size (CPU/RAM), start it, install your software (e.g. our Go runner or k6), and use it. You pay for the time it’s on. Good when you want full control (SSH, install anything).

- **Fargate**  
  “Run a container without managing the computer.” You give AWS your container (e.g. Docker image); AWS runs it for you and you don’t create or manage EC2s. Easier than EC2, but less control. Good for “just run this app.”

- **VPC (Virtual Private Cloud)**  
  Your private network inside AWS. Like your own isolated LAN in the cloud: you decide IP ranges, subnets, and which things can talk to each other. Your EC2s and Fargate tasks usually live inside a VPC.

- **AZ (Availability Zone)**  
  A separate physical data center inside one region (e.g. “us-east-1a”, “us-east-1b”). AWS has many AZs per region. Using more than one AZ makes your app resilient if one building has a problem.

**Short:** AWS = cloud; EC2 = rent a VM; Fargate = run a container without managing the VM; VPC = your private network in AWS; AZ = one data center in a region.

---

## 0) Architecture at a Glance

### Pipeline
1) **Record**
- Record UI actions and optionally capture network traffic (protocol capture).

2) **Draft**
- Recorder posts captured requests to backend drafts and redirects to Performance tab (preferred); sessionStorage fallback exists.

3) **Compile**
- Convert recorded “requests” / HAR / recording into a compiled scenario for execution (especially for Go runner / k6).

4) **Execute**
- **Browser runner** for quick validation (capped at 20 VUs).
- **Go runner** for high scale.
- **k6** for CI/CD & maximum scale.

5) **Observe**
- **SRM** correlates response-time behavior with server CPU/memory/disk (Prometheus/SSH/WMI/CloudWatch).

6) **Analyze**
- Run manager stores run metadata, state machine, thresholds/verdict and supports compare/history/trends.

7) **Frontend quality (optional)**
- Lighthouse runs from backend (npx), including hardened “median-of-3” runs and artifacts.
- PWA load scenario + PWA performance checks.

---

## 1) Quickstart (Run Something in 5–10 Minutes)

### Prerequisites
- Backend: Python 3.9+ (FastAPI), Node.js 18+ (for Lighthouse)
- Frontend: Vite/React app
- Optional: Go 1.19+ (Go runner), k6

### Start backend + frontend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# in another terminal
npm run dev
```

### Run “From Recorder” test (fastest realistic path)
1) Open **Recorder**
- Enable **Load Testing** (and optionally **Protocol Capture**)

2) Record a flow and stop

3) Click **Quick Load Test / Open Perf tab**
- Preferred: creates draft via backend and redirects with `?draft_id=...`
- Fallback: stores in `sessionStorage` and redirects

4) In **Performance** tab:
- See “From Recorder: N requests ready”
- Click **Use these requests**
- Adjust config
- Run Custom Test (browser validation; max 20 VUs)

---

## 2) Key Concepts (Short + Practical)

### 2.1 Right engine for the right test
- **Browser runner** = quick validation (cap 20 VUs)
- **Go runner / k6** = real load (50–10,000+ VUs)

### 2.2 Replayability (correlation + secrets)
To make recorded traffic replay reliably at scale:
- Extract dynamic values (tokens/session IDs) from responses (“correlation”)
- Reuse them in later requests via templating
- Never store credentials in scenario JSON; resolve secrets at runtime via env variables, referenced like `{{AUTH_TOKEN}}`

### 2.3 Workload modeling (shape + realism)
Supported config elements include:
- stages: `[[duration_seconds, target_vus], ...]`
- think time min/max
- optional arrival_rate (req/sec)

Example compile usage:
- `POST /api/performance/compile/load-requests` with stages + think time

### 2.3a Open vs closed model (Concurrency vs Arrival rate)
- **Concurrency (VUs):** “Open” model — you set a number of virtual users; each VU runs the scenario in a loop. Throughput (RPS) depends on how fast each request completes. Use when you want to stress “N concurrent users.”
- **Arrival rate (RPS):** “Closed” model — you set a target requests per second; the runner tries to maintain that rate (adding/removing VUs as needed). Use when you want “sustained X RPS” regardless of latency.
- **API:** `POST /api/performance/compile/load-requests` and `POST /api/performance/tests/run` accept optional `arrival_rate` (requests/sec) and `mode: "concurrency" | "arrival_rate"`. When `mode` is `arrival_rate`, use `arrival_rate` instead of (or in addition to) `virtual_users` for workload shape.

### 2.4 Percentiles (what matters in results)
When you read results, use percentiles (p50/p95/p99) for latency, plus:
- throughput (RPS)
- errors (4xx/5xx/timeouts)
- server resource behavior (SRM)

### 2.5 Go runner vs k6 — when to use which
Neither is universally “better”; they serve different needs.

| Aspect | Go runner (ours) | k6 (Grafana) |
|--------|------------------|---------------|
| **Control** | gRPC + QAAI backend; register, heartbeat, compile → JSON scenario | Run anywhere: CLI, CI, VMs, cloud; JS scripts |
| **Integration** | Native: Recorder → Drafts → Compile → Run from Performance tab | Export HAR/scenario → write or generate k6 script; run outside UI |
| **Scale** | High (e.g. 50–1,000+ VUs per runner; multi-runner possible) | Very high; distributed and cloud options |
| **Scripting** | No — scenario is compiled JSON (steps, think time, thresholds) | Yes — full JavaScript (logic, checks, extensions) |
| **CI/CD** | Trigger via API from your pipeline | First-class: native CI plugins, exit codes, cloud runs |
| **Cost (software)** | Free — we own it | Free on your own infra (k6 OSS); paid only for Grafana Cloud k6 |

**Use Go runner when:** You want one-click runs from the Performance tab, integrated with drafts/compare/SRM, and controlled scale from our backend.  
**Use k6 when:** You need max scale, custom JS logic, or to run load tests in CI/CD or on your own VMs without depending on the QAAI backend.

### 2.6 Cost and pricing — what’s free, what to budget

**Free (no license cost):**
- **QAAI platform:** Browser runner, Go runner, backend, Performance tab, drafts, compare, SRM (as you run it).
- **k6 open source:** Free to run on your own servers and VMs. No k6 license. (k6 OSS is AGPL-3.0; using the unmodified binary on your infra is fine.)
- **Lighthouse:** Free (Node/npx on your backend host).

**Paid (only if you choose them):**
- **Grafana Cloud k6:** Optional. Pay only if you use their cloud execution (e.g. ~$0.15/VUh or tiered plans from ~$59/mo). Not required to run k6 on your VMs.
- **VM/compute:** You pay for the machines that run the load (same whether you use Go runner or k6).

**Baking cost for runs on VM instances:**
- **Model:** `cost_per_run ≈ (VM instance price per hour) × (run duration in hours) × (number of runner VMs)`.
- **Example:** One VM at $0.05/hr, 10‑minute run: ~\$0.008 per run. Ten VMs for 1 hour: 10 × \$0.05 = \$0.50 (example rates; use your cloud’s pricing).
- **Practice:** Tag VMs (e.g. “qaai-load”) and use billing by tag, or track run count × average duration × instance type in a spreadsheet or FinOps dashboard.

### 2.7 VUs without VMs vs when you need VMs

**“Without VMs”** here means: no extra cloud VMs for the load generator. You run the runner on your laptop, a dev server, or the same host as the QAAI backend.

| Runner | Max VUs (no extra VMs) | Where it runs |
|--------|------------------------|----------------|
| **Browser** | **20** (hard cap) | Your browser tab; backend can be anywhere. |
| **Go runner** | **~500–1,000** per process (default `--max-vus=1000`) | One machine (laptop or single server). Limit is CPU/network of that machine. |
| **k6** | **~500–2,000+** per machine (depends on script and instance) | One machine; same idea as Go runner. |

So you can run **up to ~1,000 VUs with no VMs** by using one machine (e.g. your dev box or a single EC2) and the Go runner or k6.

**When you need (extra) VMs:**

- You need **more VUs than one machine can drive** (e.g. 3,000–10,000+). Spread load across multiple runner VMs (each running Go runner or k6).
- You want **isolation**: don’t run the load generator on the same instance as the PWA or the QAAI backend; use a separate VM (or separate VMs) so results aren’t skewed by resource contention.
- You want **geographic distribution**: run runners in several regions to test CDN/global latency or region-specific behavior.
- You want **reproducible CI**: run k6 (or Go runner) on a dedicated build/CI VM or container so every run uses the same environment.

**Rule of thumb:**  
- **≤ 20 VUs:** Browser runner, no VM.  
- **≤ ~1,000 VUs:** One machine (Go runner or k6), no extra VM if that machine is already available.  
- **&gt; ~1,000 VUs or isolated/geo distribution:** Use one or more VMs (or containers) for the runners.

### 2.8 PWA on AWS — best way to run load tests

If your PWA is hosted on AWS (e.g. S3 + CloudFront, or ECS/App Runner):

1. **Run load generators in AWS (recommended)**  
   Use EC2 (or ECS/Fargate) in the **same region** as the PWA (or in a second region if you’re testing cross-region). Benefits: stable network, no home/office variability, easy to size and repeat.

2. **Prefer a different AZ (and instance) from the app**  
   Don’t run the Go runner or k6 on the same instance as the PWA. Use a separate EC2 (or container) so CPU/memory contention doesn’t hide real user impact. Same VPC is fine; same AZ is fine as long as it’s a different instance.

3. **Sizing (rough)**  
   - **Go runner:** One process can handle ~500–1,000 VUs (default). One **c5.large** (or similar) per 500–1,000 VUs is a reasonable start.  
   - **k6:** Similar; 500–1,500 VUs per medium-sized instance depending on script.  
   Scale out by adding more runner VMs and distributing VUs (or use k6’s distributed execution).

4. **Network**  
   - **Same VPC as PWA:** Lower latency, good for “same-region” capacity testing.  
   - **Different VPC or public internet:** Higher latency, good for “real user” or cross-region behavior.

5. **Practical setup (example)**  
   - PWA: e.g. **us-east-1** (CloudFront + S3 or ECS).  
   - Runner: 1–2 EC2 in **us-east-1** (different AZ from app if possible), run Go runner or k6, point at the PWA URL.  
   - QAAI backend: Can run on your laptop, same EC2, or another service; it only orchestrates and collects results. For &gt;1k VUs, run at least the **runner** on dedicated EC2.

6. **No extra VM option**  
   For quick checks (e.g. &lt; 500 VUs), you can run the Go runner (or k6) on your laptop or the same EC2 that runs the QAAI backend, and target the PWA URL. Use extra VMs when you need more VUs or isolation (as in §2.7).

### 2.9 End-to-end: Load test a website with 2000 users from AWS

**Yes — you can load-test a website by running the load generator in AWS (e.g. 2000 users) and controlling it from our tool.** Here’s what the tool can do and how it works start to end.

**Tool capabilities involved:**
- **Record** the flow (or define requests) in the Recorder / Performance tab.
- **Compile** those requests into a scenario (JSON) the Go runner or k6 can run.
- **Run the load from AWS:** one or more EC2 (or Fargate) instances run the Go runner (or k6); they generate the 2000 virtual users and send traffic to your website.
- **Control from QAAI:** the QAAI backend (on your laptop, or on another server) tells the runner(s) what to run, gets status and metrics back, and shows results in the Performance tab.

**Start-to-end flow (2000 VUs from AWS):**

1. **Record or define the flow (no AWS yet)**  
   - In **Recorder:** turn on Load Testing, record the user journey on the website, stop, then **Quick Load Test → Open Perf tab**.  
   - Or in **Performance** tab: paste/import URLs or use “From Recorder” if you already have a draft.  
   - Result: a list of HTTP requests (URLs, methods, headers) that represent what “one user” does.

2. **Compile to a scenario**  
   - In Performance tab: **Use these requests**, set **Virtual Users = 2000**, duration, ramp-up, then the UI (or API) calls `POST /api/performance/compile/load-requests`.  
   - Backend returns a **compiled scenario** (JSON) and base URL. That scenario is what the runner will execute.

3. **Prepare AWS: run the load generator there**  
   - **Option A — Go runner on EC2:**  
     - Launch 1–2 EC2 instances in AWS (e.g. same region as the website, different AZ from the app).  
     - Install Go, build our runner: `cd runner && go build -o runner ./cmd/runner`.  
     - Start: `./runner --port 50051 --max-vus 1000` (for 2000 VUs use two EC2s, each with 1000, or one with `--max-vus 2000` if you build for that).  
     - Ensure security group allows: **inbound** from QAAI backend (e.g. your IP or backend’s IP) to port 50051, and **outbound** to the website’s URL.  
   - **Option B — k6 on EC2:**  
     - Launch EC2, install k6, write (or generate) a k6 script from the same flow. Run k6 with 2000 VUs.  
     - Our tool doesn’t “drive” k6 on EC2 automatically; you run k6 on EC2 and can still use QAAI for recording, compiling, and comparing runs (e.g. export scenario → generate k6 script, run on EC2, import results if you add that flow).

4. **Connect AWS runner to QAAI (Go runner path)**  
   - From your machine (or wherever the QAAI backend runs), register the runner so QAAI can send work to it:  
     `POST /api/performance/runner/register` with body  
     `{ "hostname": "<EC2 public IP or private DNS>", "port": 50051, "max_vus": 1000 }`.  
   - If you have two EC2s, register both (each with its own hostname and port).  
   - Backend now “knows” those runner(s) and will send them scenarios when you start a test.

5. **Run the test (2000 VUs)**  
   - In **Performance** tab: pick the scenario (from Recorder/draft), set **2000** virtual users, duration, ramp-up; click **Run** (or use API `POST /api/performance/tests/run` with `scenario_id`, `virtual_users: 2000`, etc.).  
   - Backend picks the registered runner(s), sends the compiled scenario and config to the runner(s) (e.g. `http://<EC2>:50051/api/run/start`).  
   - The **EC2 runner(s)** generate 2000 virtual users and send HTTP traffic to **your website**. The website can be anywhere (AWS, on-prem, etc.); it just needs to be reachable from the EC2(s) (outbound allowed).

6. **See results**  
   - **During run:** `GET /api/performance/tests/{test_id}/status` and, if implemented, real-time metrics.  
   - **After run:** Performance tab shows report (or `GET /api/performance/tests/{test_id}/report`): latency (p50/p95/p99), throughput (RPS), errors.  
   - Optional: use **SRM** to monitor the website’s server (CPU, memory, disk) during the test and correlate with response times.

**Summary:**  
- **Without AWS:** Browser runner = up to 20 VUs on your machine; Go runner on your laptop = up to ~1000 VUs.  
- **With AWS:** You run the Go runner (or k6) on EC2; register the runner with QAAI; then from the Performance tab you run a test with 2000 VUs. Traffic is generated **from AWS** toward your website; QAAI orchestrates the run and shows results. The website under test can be hosted on AWS or anywhere else, as long as the EC2 runner(s) can reach it.

---

## 3) Primary Workflows

### 3.1 Recorder → Drafts → Performance Tab
**Preferred path**
- Recorder creates a draft: `POST /api/performance/drafts`
- Redirect to `/performance?draft_id=...`

**Fallback**
- Uses `sessionStorage` keys (kept for backwards compatibility).

### 3.2 Compile “From Recorder” requests into a scenario
```http
POST /api/performance/compile/load-requests
Content-Type: application/json

{
  "requests": [
    { "method": "GET", "url": "https://example.com/api/products", "headers": {}, "body": "" }
  ],
  "name": "From Recorder",
  "config": { "virtual_users": 50, "duration_seconds": 60, "ramp_up_seconds": 10 }
}
```
Response includes `compiled_scenario` and `base_url`.

### 3.3 Go Runner (High-scale load engine)
Build:
```bash
cd runner
go build -o runner ./cmd/runner
```
Start:
```bash
./runner --port 50051
```

Register:
```http
POST /api/performance/runner/register
Content-Type: application/json

{ "hostname": "localhost", "port": 50051, "max_vus": 1000 }
```

Status:
- `GET /api/performance/runner/status`

Heartbeat:
- `GET /api/performance/runner/heartbeat` (capacity-aware health checks)

### 3.4 k6 (CI/CD & max scale)
- Get scenario via:
  - Recorder → Performance (quick validation)
  - HAR export/import to script
  - Compiled scenario → generate k6 steps

Example script:
```js
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 50, duration: '60s' };

export default function () {
  const res = http.get('https://your-pwa.example.com/');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

### 3.5 Lighthouse (Core Web Vitals / PWA performance)
Run from UI (Performance tab → Lighthouse) or API:
```http
POST /api/performance/lighthouse/run
Content-Type: application/json

{ "url": "https://your-pwa.example.com", "form_factor": "mobile", "timeout_seconds": 120 }
```

**Hardened Lighthouse** (median of N runs + optional artifacts):
- `POST /api/performance/lighthouse/run-hardened`
- returns median performance_score + LCP/FCP/CLS/TBT/TTI
- can save raw JSON reports per run_id

### 3.6 PWA load scenario
PWA Load hits `/`, `/manifest.json`, `/service-worker.js` with configured VUs/duration.

### 3.7 SRM (Server Resource Monitoring) + correlation
Goal: Monitor target server CPU/memory/disk during tests (like LoadRunner SiteScope).

- Add server from UI (Record tab → server monitoring) or API: `POST /api/srm/servers`
- Start monitoring: `POST /api/srm/start` with interval
- Optional: record response times into SRM for correlation (`record-response-time`)
- Correlation endpoint: `GET /api/srm/correlation`

---

## 4) Protocol Recording & HAR (Unify UI + Protocol)

### 4.1 What you built
- Browser-native protocol recording using Chrome APIs (`chrome.webRequest`) + `PerformanceObserver` for timing breakdown.
- Toggle in Recorder (default OFF).
- HAR export/import and Protocol tab in Builder for stats, correlations, and “Load Test” launch.

### 4.2 Unified test case format
Test case includes UI steps + protocol requests + correlations.

### 4.3 Why HAR
HAR includes method/url/headers/bodies, timing breakdown, cookies/cache info; portable and tool-compatible.

### 4.4 Automatic correlation detection
Correlation = extract dynamic values from responses and reuse in subsequent steps (session IDs, CSRF, tokens, request IDs).

---

## 5) API Reference (Core Endpoints)

Base prefix: `/api/performance`.

### 5.1 Scenarios
- `POST /scenarios` create scenario
- `GET /scenarios` list
- `GET /scenarios/{scenario_id}` get
- `POST /scenarios/{scenario_id}/steps` add step
- `POST /scenarios/{scenario_id}/export` export
- `POST /scenarios/import` import

### 5.2 Compile → CompiledScenario (Go runner ready)
- `POST /compile/har`
- `POST /compile/recording`
- `POST /compile/api-requests`
- `POST /compile/load-requests` (From Recorder; returns `compiled_scenario`, `base_url`)

### 5.3 Go runner endpoints
- `GET /runner/status`
- `POST /runner/start-local`
- `POST /runner/register`
- `POST /runner/discover`
- `POST /runner/stop-local`
- `GET /runner/heartbeat`

### 5.4 Load test execution
- `POST /tests/run` (scenario_id, vus, duration, base_url, thresholds, etc.)
- `POST /tests/{test_id}/stop`
- `GET /tests/{test_id}/status`
- `GET /tests/{test_id}/report`

### 5.5 Lighthouse & PWA performance
- `POST /lighthouse/run`
- `GET /lighthouse/report/{run_id}`
- `GET /lighthouse/result/{run_id}`
- `POST /pwa/performance`

### 5.6 Drafts (Recorder handoff)
- `POST /api/performance/drafts`
- `GET /api/performance/drafts/{draft_id}`
- `GET /api/performance/drafts`
- `DELETE /api/performance/drafts/{draft_id}`

### 5.7 Results store + compare/history/trends
- Run manager persists metadata + verdicts and supports compare/history/baseline/trends.

### 5.8 Error analysis
- `GET /api/performance/errors/analysis` provides error breakdown; also supports SRM correlation.

---

## 6) Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | Frontend | Backend base URL (e.g. `http://localhost:8000`) |
| `K6_BINARY` | Backend | Path to k6 (optional) |
| `K6_RESULTS_DIR` | Backend | k6 results directory (optional) |
| Node.js / npx | Backend host | Required for Lighthouse |

---

## 7) Troubleshooting

- **“From Recorder” not showing:** ensure draft_id flow or sessionStorage keys exist before opening `/performance`.
- **Lighthouse fails:** Node.js and `npx` must be on PATH for backend process.
- **Go runner not found:** start runner and check `GET /api/performance/runner/status`.
- **SRM not collecting:** verify target metrics endpoint / creds / firewall.

---

## 8) What’s already implemented (Optimizations)

### A) Replayable traffic (correlation + auth + secrets)
- Extractors + templating
- Secrets resolver using env vars `{{VAR}}` (no credentials stored in scenario)

### B) Backend drafts (replace sessionStorage; keep fallback)
- In-memory draft store with TTL and REST API
- Recorder posts drafts + redirects with `draft_id`

### C) Engine guardrails
- Browser runner capped at 20 VUs with UI + runtime enforcement

### D) Workload modeling
- stages, think time min/max, optional arrival_rate

### E) Results store + compare
- Run manager + compare endpoint + history/baseline/trends support

### F) Lighthouse hardening
- “run hardened” executes N runs (default 3) and returns median; can save artifacts

### G) SRM app-level signals (recommended via Prometheus)
- Prometheus support; recommended extra app metrics: DB connections, queue depth, downstream latency, 4xx/5xx by endpoint

### H) Go runner heartbeat
- Heartbeat endpoint for capacity-aware scheduling foundation

---

## 9) Further recommended optimizations (next enterprise leap)

These are the next improvements that will make the platform feel “LoadRunner/NeoLoad-grade” in real customer environments.

### 9.1 Canonical Scenario Schema (Versioned)
Create a single:
- `ScenarioSchema v1` (JSON schema)
- `StepSchema v1`
- `ExtractorSchema v1`
- `ThresholdSchema v1`
Add `schema_version` to exports and run results.

### 9.2 Built-in Redaction + Privacy Rules for HAR/Recording
Before storing/exporting:
- strip auth headers by default
- strip cookies by default
- redact known sensitive keys (`password`, `token`, `authorization`, etc.)
- allow opt-in “keep headers” for internal-only use

### 9.3 Data Pools (Parameterization) as a First-Class Feature
- CSV/JSON data pool upload
- per-VU row selection strategy (unique/random/sequential)
- templating `{{user.email}}`, `{{productId}}`

### 9.4 Open vs Closed Model UX + docs
Add UI toggle:
- **Concurrency (VUs)** vs **Arrival rate (RPS)**
Explain when each is used.

### 9.5 Deterministic baselines + regression gates
- baseline run pinned per scenario+environment
- pass/fail: p95 > X%, error rate > Y%, throughput < Z%
- CI export: JUnit-style perf gate results

### 9.6 Distributed scheduling + job queue
- job queue (runs are jobs)
- scheduler selects runners by available capacity
- optional sharding across runners
- stream progress + metrics to UI

### 9.7 Time series storage for metrics (not just JSON blobs)
Store:
- summary JSON + raw artifacts
- time series (latency percentiles, RPS, errors, SRM metrics)

### 9.8 Diagnosis Assistant
After a run, auto-generate:
- likely bottleneck (CPU/DB/dependency)
- endpoints regressed
- changes vs baseline
Start rule-based.

### 9.9 Explicit limitations for WebSockets/streaming
Be explicit about what is captured (handshake vs payload frames) to prevent overpromises.

### 9.10 Live metrics streaming to UI
- **SSE or WebSocket** from backend (or runner) to Perf tab during a run.
- Stream: latency percentiles, RPS, error count, active VUs, optional SRM snapshot.
- Enables “live” dashboard without polling; foundation for LoadRunner-style real-time UI.

### 9.11 Lighthouse: cache strategy in UI
- Expose **cold vs warm** cache in Performance tab Lighthouse section (already in run-hardened API as `cache_strategy`).
- Cold = clear storage before run (first-load); warm = reuse cache (repeat visit).
- Reduces confusion and makes PWA “repeat visit” vs “first load” explicit.

### 9.12 Prometheus recommended metrics (app-level)
- Publish a **recommended metrics list** (names/labels) for app-level observability:
  - DB: e.g. `db_connections_active`, `db_slow_queries_total`.
  - Queues: e.g. `queue_depth`, `worker_queue_backlog`.
  - Downstream: e.g. `http_client_request_duration_seconds` by target.
  - Errors: e.g. `http_requests_total` by status (4xx/5xx) and endpoint.
- SRM Prometheus server type can scrape these when exposed by the app; document in Setup/SRM.

### 9.13 Audit trail (who / what / when)
- **Drafts:** `created_by`, `created_at` (already in draft store); optional `updated_at`, `last_used_by`.
- **Runs:** `created_by`, `started_at`, `finished_at`; optional link to draft or scenario version.
- **Exports:** Log when scenarios/HARs are exported and by whom (for enterprise compliance).

### 9.14 PWA: run Lighthouse under load (optional)
- Option to run Lighthouse **after** a PWA load test (or at intervals during soak) to capture LCP/FCP/CLS under stress.
- Complements “PWA Load” scenario + standalone Lighthouse; answers “does front-end quality degrade under load?”

### 9.15 In-browser bottleneck warning
- Heuristic: if **requested VUs** vs **actual RPS** suggests the browser tab is the bottleneck (e.g. RPS far below expected), show a toast: “Load generator may be saturated; use Go runner or k6 for higher load.”
- Complements the hard cap (20 VUs) with a soft signal when the browser is struggling.
