# Performance / Load Testing – Full Setup & Walkthrough

This guide walks you through setting up the enterprise load testing stack (Go runner, k6, Lighthouse, Server Resource Monitoring) and integrating recorder capture into the Performance tab.

## Prerequisites

- **Backend:** Python 3.9+ (FastAPI), Node.js 18+ (for Lighthouse)
- **Frontend:** Vite/React app (QAAI web app)
- **Optional:** Go 1.19+ (for Go runner), k6 (for external load tests)

---

## 1. Backend & Frontend (Required)

1. **Start the backend**
   ```bash
   cd backend
   pip install -r requirements.txt   # or your env
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend**
   ```bash
   npm run dev
   # or: yarn dev / pnpm dev
   ```

3. **Open the Performance tab**
   - Navigate to **Performance** (or `/performance`) in the app.

---

## 2. Recorder → Performance Tab Integration

**Goal:** Record HTTP traffic in the Recorder and run it as a load test in the Performance tab.

1. **Record with Load capture**
   - Open **Recorder** (Playwright Recorder or Flowstral recording).
   - Enable **📊 Load Testing** (and optionally **Protocol Capture**).
   - Start recording and perform actions (navigate, click, API calls).
   - Stop recording.

2. **Send to Perf tab**
   - Click **Open Perf tab to load test recorded endpoints** (or “Quick Load Test”).
   - **Preferred:** Recorder POSTs to `POST /api/performance/drafts` and redirects to `/performance?draft_id=...` (shareable, durable, auditable).
   - **Fallback:** If backend is unavailable, requests are stored in `sessionStorage` and you are redirected to `/performance`.

3. **Use requests in Perf tab**
   - On the Performance page you see: **From Recorder: N request(s) ready for load testing** (from draft or session).
   - Click **Use these requests**.
   - Base URL and endpoints are filled from the recorded URLs; you land on the **Config** tab.
   - **In-browser runner is capped at 20 VUs** (quick validation). For more VUs use Go runner or k6 (Setup tab).
   - Optionally adjust **Target Base URL**, **Virtual Users** (max 20 in browser), **Duration**, **Ramp Up**.
   - Click **Run Custom Test** to run the in-browser load test with those endpoints.

4. **Optional: compile on backend**
   - You can also POST the same requests to the backend to get a compiled scenario for the Go runner:
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
   - Response includes `compiled_scenario` and `base_url` for use with the Go runner or k6.

---

## 3. Go Runner (Optional – High-Scale Load Engine)

**Goal:** Run load tests using the Go-based runner for higher concurrency.

1. **Build the Go runner**
   ```bash
   cd runner
   go build -o runner ./cmd/runner
   ```

2. **Start the runner**
   ```bash
   ./runner --port 50051
   ```
   - On Windows: `runner.exe --port 50051`

3. **Discover from backend**
   - Backend auto-discovers a runner on `localhost:50051`, or you can register manually:
   ```http
   POST /api/performance/runner/register
   Content-Type: application/json

   { "hostname": "localhost", "port": 50051, "max_vus": 1000 }
   ```

4. **Check status**
   ```http
   GET /api/performance/runner/status
   ```
   - Response includes `go_runner_available`, `runners`, `available_capacity`.

5. **Run a load test via backend**
   - Create a scenario (or use compiled scenario from HAR/recording).
   - POST to `/api/performance/tests/run` with `scenario_id`, `virtual_users`, `duration_seconds`, `base_url`, etc.
   - Backend dispatches to the Go runner when available; otherwise uses in-browser/Python fallback.

---

## 4. k6 (Optional – External Load Tests)

**Goal:** Use k6 for maximum scale or CI/CD.

1. **Install k6**
   - See [k6.io/docs/getting-started/installation](https://k6.io/docs/getting-started/installation).

2. **Get a scenario**
   - **Option A:** Record in Recorder with Load toggle → **Use these requests** in Perf tab → run in-browser (no k6).
   - **Option B:** Export HAR from **Protocol Capture** (Record tab → Enable Protocol Capture → run test → Export HAR). Convert HAR to k6 script (e.g. har-to-k6 or manual).
   - **Option C:** Use backend compile endpoint to get `compiled_scenario` (steps with URL, method, think time) and write a k6 script that matches those steps.

3. **Example k6 script (PWA or API)**
   ```javascript
   import http from 'k6/http';
   import { check } from 'k6';
   export const options = { vus: 50, duration: '60s' };
   export default function () {
     const res = http.get('https://your-pwa.example.com/');
     check(res, { 'status is 200': (r) => r.status === 200 });
   }
   ```
   ```bash
   k6 run script.js
   ```

---

## 5. Lighthouse (Core Web Vitals & PWA Performance)

**Goal:** Run Lighthouse from the backend and see Performance score + LCP, FCP, CLS, TBT, TTI in the UI.

1. **Node.js on backend host**
   - The backend runs Lighthouse via `npx lighthouse`. Ensure **Node.js 18+** is installed on the machine where the backend runs, and `npx` is on PATH.

2. **First run (optional)**
   - From the backend host: `npx lighthouse https://example.com --output=json`  
   - This fetches Lighthouse if not cached.

3. **From the Performance tab**
   - Open the **Lighthouse** tab.
   - Enter **URL** (e.g. your PWA start URL).
   - Choose **Desktop** or **Mobile**.
   - Click **Run Lighthouse**.
   - Results show **Performance** score and **LCP**, **FCP**, **CLS**, **TBT**, **TTI**.

4. **Via API**
   ```http
   POST /api/performance/lighthouse/run
   Content-Type: application/json

   { "url": "https://your-pwa.example.com", "form_factor": "mobile", "timeout_seconds": 120 }
   ```
   - Response: `run_id`, `success`, `performance_score`, `lcp_ms`, `fcp_ms`, `cls`, `tbt_ms`, `tti_ms`, `categories`, `audits`, `error` (if failed).

   **PWA-specific:**
   ```http
   POST /api/performance/pwa/performance
   Content-Type: application/json

   { "url": "https://your-pwa.example.com", "form_factor": "mobile" }
   ```
   - Same Lighthouse result; use for PWA performance in pipelines. Full PWA audit (manifest, service worker, offline) runs in **Flowstral Desktop** (see PWA_TESTING_GUIDE.md).

---

## 6. Server-Side Metrics (SRM)

**Goal:** Monitor target server CPU, memory, disk during load tests (like LoadRunner SiteScope).

1. **Add server**
   - In the Performance page, open the **Record** tab → **Server CPU Monitoring**.
   - Set **Server Type:** Prometheus / Linux (SSH) / Windows (WMI) / AWS CloudWatch.
   - Set **Host**, **Port**, and credentials if needed (e.g. SSH username/password or key path).
   - The UI calls `POST /api/srm/servers` with your config.

2. **Start monitoring**
   - Enable **Server Monitoring** and start (e.g. **Start monitoring** or toggle).  
   - Backend: `POST /api/srm/start` with `interval_seconds` (e.g. 2).

3. **Run load test**
   - Run a load test (Quick Start, Custom, or From Recorder).  
   - Optionally, your load test code can call `POST /api/srm/record-response-time` with `response_time_ms` and `transaction_name` to correlate response times with server metrics.

4. **View metrics**
   - **Current:** GET `/api/srm/current` (CPU, memory, disk per server).
   - **Correlation:** GET `/api/srm/correlation` (response time vs server CPU/memory).

5. **Stop**
   - `POST /api/srm/stop` when the test is done.

---

## 7. PWA-Specific Load Test (Quick Start)

1. **Set PWA base URL**
   - In Performance → **Config** tab, set **Target Base URL** to your PWA origin (e.g. `https://my-pwa.example.com`).

2. **Run PWA Load scenario**
   - In **Quick Start**, select **📱 PWA Load**.
   - Click **Run Test**.  
   - This hits `/`, `/manifest.json`, and `/service-worker.js` with the configured VUs and duration.

3. **Optional: Lighthouse before/after**
   - Use the **Lighthouse** tab (or `/api/performance/pwa/performance`) before and after the PWA load test to compare LCP/FCP/CLS.

4. **Full PWA audit (manifest, SW, offline)**
   - Use **Flowstral Desktop** and the PWA actions (see **PWA_TESTING_GUIDE.md**); those run against a live browser page and are not in the backend Performance API.

---

## 8. Full Walkthrough (End-to-End)

1. **Start backend + frontend** (see §1).
2. **Optional: Start Go runner** on port 50051 (§3).
3. **Optional: Add SRM server** in Record tab (§6) and start monitoring.
4. **Record:** Recorder → enable Load (and optionally Protocol Capture) → record flows → **Quick Load Test** (§2).
5. **Perf tab:** **Use these requests** → adjust base URL and config → **Run Custom Test** (§2).
6. **Lighthouse:** Lighthouse tab → enter PWA/URL → **Run Lighthouse** (§5).
7. **PWA Load:** Set base URL to PWA → Quick Start → **PWA Load** → Run (§7).
8. **Stop SRM** when done (§6).

---

## 9. Environment Variables (Summary)

| Variable        | Where    | Purpose                          |
|----------------|----------|-----------------------------------|
| `VITE_API_URL` | Frontend | Backend base URL (e.g. `http://localhost:8000`) |
| `K6_BINARY`    | Backend  | Path to k6 (optional)            |
| `K6_RESULTS_DIR` | Backend | k6 results directory (optional)  |
| Node.js / npx  | Backend  | Required for Lighthouse          |

---

## 10. Troubleshooting

- **“From Recorder” not showing:** Ensure you clicked **Quick Load Test** (or equivalent) from the Recorder so `pendingLoadTestRequests` and `pendingLoadTestTimestamp` are set in sessionStorage before navigating to `/performance`.
- **Lighthouse fails:** Ensure Node.js and `npx` are on the PATH of the backend process. Run `npx lighthouse https://example.com` from the backend host to test. For timeout, increase `timeout_seconds` in the request.
- **Go runner not found:** Run `./runner --port 50051` from the `runner/` directory; check GET `/api/performance/runner/status`.
- **SRM not collecting:** For Prometheus, ensure the target exposes metrics at the given host:port. For SSH/WMI, check credentials and firewall.

---

*See also: **PERF-CAPABILITIES-REFERENCE.md** (all APIs and options), **PERF-OPTIMIZATIONS.md** (drafts, engine guardrails, secrets, workload, Lighthouse hardened, runner heartbeat), **PWA_TESTING_GUIDE.md** (PWA audit in Flowstral Desktop), **PWA-PERFORMANCE-AND-LOAD-TESTING.md** (PWA performance test flow).*
