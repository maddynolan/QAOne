# Enterprise Performance Run — Step-by-Step Walkthrough

This document walks you through **deploying one of our websites to AWS** (e.g. Flowstral playground or flowstral.com) and running an **enterprise-style performance run**: browser run, API load test, Go runner, SRM (Server Resource Monitoring), and Lighthouse metrics — start to finish.

**Reference:** See [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md) for architecture, APIs, and concepts.

**Flowstral.com-specific:** For what to test on flowstral.com, how to record it, and a **2000+ VU, 1-hour run with ramp-up** (plus cost), see [FLOWSTRAL-COM-LOAD-TEST-PLAN.md](./FLOWSTRAL-COM-LOAD-TEST-PLAN.md).

---

## What You’ll Do (Overview)

1. **Deploy a website to AWS** (Flowstral playground or flowstral.com) so you have a live URL to test.
2. **Start QAAI** (backend + frontend) and optional Go runner.
3. **Run Lighthouse** for a baseline (Core Web Vitals).
4. **Set up SRM** to monitor the server hosting the website during load.
5. **Browser run** — up to 20 VUs from the Performance tab (quick validation).
6. **API load test** — compile recorded/API requests and run (browser or Go runner).
7. **Go runner run** — higher VUs (e.g. 200–1000) via registered Go runner.
8. **View SRM correlation** and **run Lighthouse again** to compare under load.

---

## Part A: Deploy the Website to AWS

You need a **live URL** to load-test (e.g. `https://your-flowstral-playground.example.com` or `https://flowstral.com`). If the site is already live, skip to Part B.

### Option 1: Static / PWA (e.g. Flowstral playground) — S3 + CloudFront

Use this when the site is static (HTML/JS/CSS) or a PWA.

1. **Build the site locally**
   - From the repo (e.g. flowstral playground or test-website):  
     `npm run build` or your project’s build command.  
   - Output is typically in `dist/` or `build/`.

2. **Create an S3 bucket**
   - AWS Console → S3 → Create bucket (e.g. `flowstral-playground-prod`).
   - Block public access **off** if you’ll use bucket website hosting; or keep **on** and use CloudFront only (recommended).

3. **Upload build**
   - Upload the contents of `dist/` (or `build/`) to the bucket.  
   - For S3 website: enable “Static website hosting” and set index document (e.g. `index.html`).  
   - For CloudFront: you don’t need S3 website hosting; CloudFront will use the bucket as origin.

4. **Create CloudFront distribution**
   - CloudFront → Create distribution.
   - Origin: your S3 bucket (or S3 website endpoint).
   - Default root object: `index.html`.
   - Optional: custom domain (e.g. `playground.flowstral.com`) via ACM certificate and Route 53 (or your DNS).
   - Deploy; note the distribution URL (e.g. `https://d1234abcd.cloudfront.net`) or your custom URL.

5. **Test**
   - Open the CloudFront URL (or custom URL) in a browser and confirm the site loads.

### Option 2: Full app (backend + frontend) — EC2 or ECS

Use this when the site has a backend (e.g. Node/Python API).

1. **EC2**
   - Launch an EC2 instance (e.g. Amazon Linux 2 or Ubuntu).
   - Install Node/Python, clone repo, build frontend, run backend (e.g. `node server.js` + serve static or reverse proxy).
   - Security group: allow 80/443 (and 22 for SSH if needed).
   - Optional: put Nginx/Caddy in front; use ACM + ALB for HTTPS.
   - Note the public URL (e.g. `http://<EC2-public-IP>` or `https://your-domain.com`).

2. **ECS Fargate**
   - Build Docker image(s) for frontend and/or backend; push to ECR.
   - Create ECS cluster, task definition(s), service; attach ALB.
   - Point domain to ALB; use ACM for HTTPS.
   - Note the app URL.

**Result:** You have a **base URL** for the website (e.g. `https://d1234abcd.cloudfront.net` or `https://flowstral.com`). Use this everywhere below as **TARGET_URL**.

---

## Part B: Prerequisites (QAAI + Optional Go Runner)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- **Node.js 18+** on the same machine (for Lighthouse). Ensure `npx` is on PATH.
- Leave the backend running; note its URL (e.g. `http://localhost:8000`).

### 2. Frontend

```bash
# From repo root
npm run dev
```

- Open the app (e.g. `http://localhost:5173`).
- Set **VITE_API_URL** (or equivalent) to your backend URL so the Performance tab calls the correct API.

### 3. Go runner (for high-VU run)

```bash
cd runner
go build -o runner ./cmd/runner
./runner --port 50051 --max-vus 1000
```

- Register with backend (see Step 7 below) or use “Start local runner” from Performance → Setup tab.

### 4. SRM: server access

- If the **website runs on a server you control** (EC2, on-prem): you’ll need **SSH** (username + password or key) to that host so QAAI can run CPU/memory commands.
- If the site is **only S3 + CloudFront**: there is no “server” to SSH into; SRM will be skipped or you monitor an optional backend (e.g. API server) if you have one.

---

## Part C: Enterprise Run — Step-by-Step

Use **TARGET_URL** = your deployed site (e.g. `https://d1234abcd.cloudfront.net` or `https://flowstral.com`).

---

### Step 1: Lighthouse baseline (before load)

Get Core Web Vitals and performance score with no load.

1. In the app, go to **Performance** → **Lighthouse** tab.
2. Enter **URL:** `TARGET_URL` (e.g. `https://flowstral.com`).
3. Choose **Device:** Desktop or Mobile.
4. Click **Run Lighthouse**.
5. Wait for the run to finish (backend runs `npx lighthouse`).
6. Note **Performance score**, **LCP**, **FCP**, **CLS**, **TBT**, **TTI** (or screenshot).

**API alternative:**

```http
POST /api/performance/lighthouse/run
Content-Type: application/json

{ "url": "TARGET_URL", "form_factor": "desktop", "timeout_seconds": 120 }
```

**Optional (hardened run, median of 3):**

```http
POST /api/performance/lighthouse/run-hardened
Content-Type: application/json

{ "url": "TARGET_URL", "form_factor": "desktop", "runs": 3, "cache_strategy": "cold" }
```

---

### Step 2: Set up SRM (if you have a server to monitor)

Only if the website or its API runs on a host you can SSH into (e.g. EC2).

1. Go to **Performance** → **Setup** tab (or the section where **Server-side metrics (SRM)** is configured).
2. **Add server:**
   - **Server type:** e.g. `linux_ssh`.
   - **Host:** IP or hostname of the EC2/server (e.g. `ec2-xx-xx-xx-xx.compute.amazonaws.com`).
   - **Port:** 22 (SSH).
   - **Username / Password** (or **Private key path**).
3. Click **Start monitoring** (or equivalent). Set interval (e.g. 5 s).
4. Confirm “Server resource monitoring started” and that CPU/memory appear (Performance tab may show live metrics).

**API:**

```http
POST /api/srm/servers
Content-Type: application/json

{
  "alias": "target_server",
  "server_type": "linux_ssh",
  "host": "YOUR_EC2_IP_OR_HOSTNAME",
  "port": 22,
  "username": "ec2-user",
  "password": "..." 
  // or "private_key_path": "/path/to/key.pem"
}

POST /api/srm/start
Content-Type: application/json

{ "interval_seconds": 5 }
```

- If the site is **only S3 + CloudFront**, skip SRM or add a different server you care about (e.g. API backend).

---

### Step 3: Browser run (up to 20 VUs)

Quick validation from the Performance tab using the in-browser runner.

1. Go to **Recorder** (Playwright Recorder / Flowstral).
2. Enable **Load Testing** (and optionally **Protocol Capture**).
3. **Start recording.** Navigate to `TARGET_URL` and perform a short flow (e.g. open home, click a link, trigger an API call if any).
4. **Stop recording.**
5. Click **Quick Load Test** / **Open Perf tab** (creates draft and redirects to Performance with `?draft_id=...`).
6. On **Performance** tab you should see **From Recorder: N request(s) ready**.
7. Click **Use these requests.**
8. Set **Target Base URL** to `TARGET_URL` if needed; **Virtual Users** is capped at **20** for browser.
9. Set **Duration** (e.g. 60 s), **Ramp up** (e.g. 10 s).
10. Click **Run Custom Test** (in-browser run).
11. Wait for completion; review summary (latency, RPS, errors).

**What you get:** Confirmation that the recorded flow runs under light load (20 VUs) and baseline latency/RPS from the browser runner.

---

### Step 4: API load test (same requests, from Performance tab)

Reuse the same recorded flow as an “API” load test (same compile, different runner or same browser).

1. Stay on **Performance** tab with the same **From Recorder** requests (or re-use draft).
2. **Use these requests** if not already.
3. **Config** tab:
   - **Virtual Users:** 20 (browser) or higher if Go runner is registered (see Step 7).
   - **Duration / Ramp up:** as needed.
4. Run **Run Custom Test** again (browser) or **Run** with Go runner (after Step 7).

**Optional — compile via API and run later with Go runner:**

```http
POST /api/performance/compile/load-requests
Content-Type: application/json

{
  "requests": [
    { "method": "GET", "url": "TARGET_URL/", "headers": {}, "body": "" },
    { "method": "GET", "url": "TARGET_URL/some-path", "headers": {}, "body": "" }
  ],
  "name": "Flowstral homepage flow",
  "config": {
    "virtual_users": 100,
    "duration_seconds": 120,
    "ramp_up_seconds": 15
  }
}
```

- Save the returned `compiled_scenario` and `base_url`; use them when starting a test via `/api/performance/tests/run` with a scenario that uses this compiled scenario.

---

### Step 5: Record response times into SRM (during load)

If SRM is running and you want **response time vs CPU/memory** correlation:

- The Performance tab may call `POST /api/srm/record-response-time` during the run (if wired in your build).
- Or your load test runner (e.g. Go runner) can call this API with each request’s response time so the backend can correlate with SRM samples.

**API:**

```http
POST /api/srm/record-response-time
Content-Type: application/json

{ "response_time_ms": 150, "transaction_name": "GET /", "status": "pass" }
```

- Call this repeatedly during the test (e.g. from your runner or from the UI if implemented).

---

### Step 6: Go runner run (e.g. 200–1000 VUs)

For higher load you need the Go runner registered.

1. **Start the Go runner** (if not already):
   ```bash
   cd runner && ./runner --port 50051 --max-vus 1000
   ```
2. **Register** it with the backend:
   - **Performance** → **Setup** tab → use “Register runner” or “Discover”.
   - Or API:
   ```http
   POST /api/performance/runner/register
   Content-Type: application/json

   { "hostname": "localhost", "port": 50051, "max_vus": 1000 }
   ```
3. **Check status:** `GET /api/performance/runner/status` — should show runner(s) and capacity.
4. On **Performance** tab, with the same scenario (From Recorder / compiled):
   - Set **Virtual Users** to e.g. **200** or **500** (within runner’s `max_vus`).
   - Set **Duration** and **Ramp up**.
   - Click **Run** — backend should dispatch to the Go runner; the run executes on the runner and sends traffic to **TARGET_URL**.
5. Monitor status and, when done, open the **report** (latency percentiles, RPS, errors).

**If runner is on another machine (e.g. EC2):** Use that machine’s hostname/IP and port in `POST /api/performance/runner/register`; ensure the backend can reach `http://<runner_host>:50051`.

---

### Step 7: Stop SRM and view correlation

1. After the load test finishes, **Stop monitoring** in the Performance tab (SRM section).
2. Open **Correlation** (or call `GET /api/srm/correlation`).
3. You should see **response time vs CPU/memory** (and optionally disk/network) over time — enterprise-style “did server resources cause slow responses?”

**API:**

```http
POST /api/srm/stop
GET /api/srm/correlation
```

---

### Step 8: Lighthouse again (optional — under load or after)

- Run **Lighthouse** again on `TARGET_URL` (same as Step 1).
- Compare **Performance score** and **LCP/FCP/CLS** to the baseline.
- For “Lighthouse under load,” you can run a small load in another tab/window and run Lighthouse during it (optional; not all setups automate this).

**API:** Same as Step 1: `POST /api/performance/lighthouse/run` or `run-hardened`.

---

## Part D: Order of Operations (Enterprise Style)

| Order | Step | Purpose |
|-------|------|--------|
| 1 | Deploy site to AWS | Have TARGET_URL |
| 2 | Start backend + frontend (+ optional Go runner) | QAAI ready |
| 3 | Lighthouse baseline | Core Web Vitals with no load |
| 4 | SRM setup + Start monitoring | Capture server metrics during load |
| 5 | Browser run (20 VUs) | Quick validation of flow |
| 6 | API/load test (same flow, 20+ VUs) | Confirm compile + runner |
| 7 | Go runner run (200–1000 VUs) | High load from runner |
| 8 | Stop SRM → Correlation | Response time vs CPU/memory |
| 9 | Lighthouse again | Compare scores after load |

---

## Part E: Checklist (One-Page)

- [ ] Website deployed to AWS; **TARGET_URL** works in browser.
- [ ] Backend running (port 8000); Node.js available for Lighthouse.
- [ ] Frontend running; Performance tab loads.
- [ ] **Lighthouse baseline** run; scores noted.
- [ ] **SRM:** Server added and monitoring started (if applicable).
- [ ] **Recorder:** Flow recorded with Load Testing on; draft in Performance tab.
- [ ] **Browser run:** “Use these requests” → Run Custom Test (20 VUs); report OK.
- [ ] **Go runner:** Built, started, registered; status shows runner.
- [ ] **Go runner run:** Same scenario, 200+ VUs; report OK.
- [ ] **SRM:** Stopped; correlation viewed.
- [ ] **Lighthouse** run again; comparison with baseline.

---

## Part F: Troubleshooting

| Issue | What to check |
|-------|----------------|
| Lighthouse fails | Node.js and `npx` on PATH for backend; URL is http(s). |
| “From Recorder” empty | Draft flow: Recorder → Quick Load Test → Perf tab with `?draft_id=...`; or sessionStorage fallback. |
| Go runner not found | Runner process running; `GET /api/performance/runner/status`; register with correct hostname/port. |
| SRM no data | Server added with correct SSH (or other) credentials; monitoring started before load test. |
| 403/404 on TARGET_URL | CORS/security on the deployed site; use a URL that allows requests from your runner/backend. |
| High latency from runner | Run runner in same region as TARGET_URL (e.g. both in us-east-1); check network/SG. |

---

## References

- [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md) — architecture, Go runner vs k6, cost, VMs, AWS.
- [PERF-SETUP-AND-WALKTHROUGH.md](./PERF-SETUP-AND-WALKTHROUGH.md) — setup details for Go runner, k6, Lighthouse, SRM.
- [PERF-CAPABILITIES-REFERENCE.md](./PERF-CAPABILITIES-REFERENCE.md) — API reference.
