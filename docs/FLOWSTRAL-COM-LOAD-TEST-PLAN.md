# Flowstral.com Load Test Plan — What to Test, 2000+ VUsers, 1-Hour Run, Cost

This document defines **what to test on flowstral.com** (our live URL), how **you record those flows**, and **step-by-step how to run a load test with 2000+ virtual users** for **1 hour with ramp-up**, plus **cost estimate**.

**Live URL:** `https://flowstral.com`

---

## Part 1: What to Test on Flowstral.com

Based on the current site, these are the **recommended flows to record** and then run under load.

### 1.1 Primary user journeys (record these)

| # | Journey name | What to do (you record this) | What gets captured for load test |
|---|--------------|------------------------------|-----------------------------------|
| **1** | **Homepage load** | Open Recorder, enable **Load Testing** (and **Protocol Capture** if you want all assets). Go to `https://flowstral.com` and let the page fully load (wait for images/scripts). Stop recording. | `GET https://flowstral.com/` plus any critical CSS/JS/fonts the recorder captures. This is the minimum “one user visit.” |
| **2** | **Homepage + scroll** | Same as above, then scroll down the page (hero → FLOW/STRAL → Flowpilot → Mobile → Platform cards → CTAs). Stop when you reach “Start Free Trial.” | Same as #1 plus any lazy-loaded or on-scroll requests (e.g. images, analytics). |
| **3** | **Homepage + key clicks** | Load flowstral.com, then click one or more: “Watch Demo,” “Learn more” (e.g. under Flowpilot or Performance), “Explore Flowpilot,” “Start Free Trial” or “Schedule Live Demo.” Stop after 2–3 clicks. | Homepage request + requests triggered by those clicks (e.g. navigation to flowstral.app, or tracking/API calls). Use this if you want to simulate “engaged” users. |

**Recommendation:** Record **at least Journey 1** (homepage load). Add **Journey 2** if you want to stress lazy-loaded assets; add **Journey 3** if you care about click-driven traffic (e.g. outbound to flowstral.app or APIs).

### 1.2 What the site is (for load-test design)

- **flowstral.com** is a marketing/landing page: hero, methodology (FLOW/STRAL), Flowpilot, Mobile Testing, platform features, Performance/API/Visual/A11y snippets, and CTAs (“Start Free Trial,” “Schedule Live Demo,” “flowstral.app”).
- Most content is on **one page** (`/`). Links like “Start Free Trial” / “Sign In” typically go to **flowstral.app** (different origin). For a **flowstral.com-only** load test, recording the homepage and scroll (Journey 1 or 2) is enough.
- If the page uses **analytics or other APIs** (e.g. form submit, tracking), enable **Protocol Capture** when recording so those requests are included in the load scenario.

### 1.3 URLs you will likely see in the recording

- `https://flowstral.com/` — main document
- Same-origin assets (e.g. `/assets/...`, `/scripts/...`) if the site uses relative paths
- Third-party (e.g. fonts, analytics) — include only if you want to load-test them; otherwise you can filter to same-origin in the Performance tab or when compiling.

**For a simple 2000 VU run:** Recording **Journey 1** (GET homepage + full load) is enough. Use **Journey 2** for a slightly more realistic “scroll” scenario.

### 1.4 What is actually captured in flows 1, 2, and 3 (network vs APIs, what 2000 VUs run against)

**What the Recorder captures:** **HTTP network requests** — method, URL, headers, body. Each request is a single “hit” (e.g. GET document, GET script, GET API). The Recorder does **not** capture DOM events or mouse moves; it captures the **network layer** (and, if Protocol Capture is on, every request the page makes).

| Flow | What gets captured (concrete) | What 2000 VUs run against |
|------|-------------------------------|---------------------------|
| **Flow 1 — Homepage load** | Every HTTP request the browser makes while loading `https://flowstral.com/`: the main **document** (GET /), plus **CSS, JS, fonts, images** (same-origin or third-party, depending on Protocol Capture). Often 5–30+ requests per “page load.” | One **scenario** = one list of **endpoints**. Each VU repeatedly picks an endpoint (by weight), sends that HTTP request to the target, then picks again. So 2000 VUs = 2000 concurrent “users,” each firing those same requests (e.g. GET /, GET /assets/…, GET /script.js) in a weighted random order. |
| **Flow 2 — Homepage + scroll** | Same as Flow 1 **plus** any requests triggered by scrolling (lazy-loaded images, “in view” analytics, etc.). More endpoints = more variety in what gets hit. | Same as above: one scenario, **all** those endpoints with **weights**. Default: each endpoint gets weight 100 → equal probability. So over time you get a mix of document + assets + scroll-driven requests. |
| **Flow 3 — Homepage + clicks** | Flow 1 + requests triggered by **clicks** (navigations to flowstral.app, tracking pixels, form submits, API calls). If a click opens a new tab or redirects, you may capture requests to **another origin** (e.g. flowstral.app). | Same: one scenario, all endpoints. If you want **only** flowstral.com, filter or remove outbound URLs when editing the scenario; otherwise 2000 VUs will also hit flowstral.app (or other domains) per the recorded mix. |

**Summary:**  
- **Network events = APIs = same thing here:** every captured item is an **HTTP request** (method + URL + headers + body). “APIs” are just HTTP requests to API paths (e.g. GET /api/foo).  
- **2000 VUs run against:** one **scenario** = one **list of endpoints** (the requests you recorded). Each VU loops: pick endpoint by weight → send request → (optional think time) → repeat for the test duration. So you’re load-testing **that set of URLs** with 2000 concurrent users.

---

## Part 2: How You Record (Steps for You)

1. **Open the Recorder** (Playwright Recorder / Flowstral) in the QAAI app.
2. **Enable “Load Testing”** (and optionally **“Protocol Capture”** to capture all network requests).
3. **Start recording.**
4. **Perform one of the journeys above** (e.g. open `https://flowstral.com`, wait for full load, optionally scroll and/or click).
5. **Stop recording.**
6. Click **“Quick Load Test”** / **“Open Perf tab”** so the captured requests are sent to the backend (draft) and you are redirected to the Performance tab with `?draft_id=...`.

You should then see **“From Recorder: N request(s) ready”** on the Performance tab. Those requests are what will be replayed for 2000+ VUsers.

### 2.1 Scenario mix (not all traffic on one flow)

You want a **mix of behaviors**: e.g. 50% homepage-only, 30% homepage+scroll, 20% homepage+clicks.

**Two levels of mix:**

1. **Endpoint mix (one scenario, weighted endpoints)** — **supported today.**  
   One scenario = one list of **endpoints** (each request = one endpoint). In **Config** you can set a **weight** per endpoint (e.g. GET / = 50, GET /assets/x = 30). Each VU randomly picks an endpoint by weight. So you get a **mix of URLs** in one run (e.g. 50% document, 30% assets, 20% API). Quick Start templates already use weights.

2. **True scenario mix (multiple journeys with weights)** — **not in main UI/API yet.**  
   Example: 50% VUs run "Journey A," 30% "Journey B," 20% "Journey C." The backend load generator supports multiple scenarios with a weight per scenario; the **tests/run** API takes a **single** scenario_id.  
   **Workarounds:** (A) Record one combined flow (homepage + scroll + click) and use **endpoint weights** to favor some URLs. (B) Run three separate tests (e.g. 1000 / 600 / 400 VUs) and aggregate results. (C) Use the backend programmatically (internal load_generator with multiple scenarios).

**Practical:** For flowstral.com, record **Flow 2** (homepage + scroll), then in Config set **weights** so GET / has higher weight and assets/APIs share the rest. That gives a realistic mix in one run.

---

## Part 3: Run a Load Test with 2000+ VUsers, 1 Hour, Ramp-Up

For **2000+ VUs** the **browser runner cannot be used** (it is capped at 20 VUs). You must use the **Go runner** or **k6** on one or more **runner VMs** (e.g. EC2). The QAAI backend can stay on your laptop or a separate host; it only orchestrates and collects results.

### 3.1 Target profile (example)

| Setting | Value | Note |
|---------|--------|------|
| **Virtual users** | **2000** (or 2500) | Use 2–3 runner VMs (see below). |
| **Duration** | **1 hour** (3600 s) | Sustained load. |
| **Ramp-up** | **10 minutes** (600 s) | Linear ramp from 0 to 2000 VUs over 10 min. |
| **Ramp-down** (optional) | **5 minutes** (300 s) | If your runner supports it. |
| **Think time** (optional) | e.g. 1–3 s between requests | Makes the scenario more realistic; configurable in compile/config. |

### 3.2 Step-by-step: 2000+ VU, 1-hour run with ramp-up

**Step 1 — Record the flow (you)**  
- Do Part 2 above (Journey 1 or 2) so you have a draft in the Performance tab.

**Step 2 — Compile the scenario**  
- In **Performance** tab: **“Use these requests.”**  
- Set **Target Base URL** to `https://flowstral.com` if needed.  
- In **Config**, set:
  - **Virtual Users:** `2000`
  - **Duration:** `3600` (seconds) = 1 hour
  - **Ramp up:** `600` (seconds) = 10 minutes  
- The UI (or API) will call `POST /api/performance/compile/load-requests` with something like:
  ```json
  {
    "requests": [ ... ],
    "name": "Flowstral.com homepage",
    "config": {
      "virtual_users": 2000,
      "duration_seconds": 3600,
      "ramp_up_seconds": 600
    }
  }
  ```
- Save or note the returned **compiled_scenario** (and **base_url**) if you run via API.

**Step 3 — Prepare runner VMs (AWS)**  
- For **2000 VUs** you need **2–3 runner instances** (each Go runner can handle ~500–1000 VUs per process, or use k6 with similar sizing).
- **Example:** 2× EC2 (e.g. **c5.large** or **c5.xlarge**) in the **same region** as flowstral.com (or in a region close to your users).
  - On each EC2: install and run the **Go runner** (or **k6**).
  - **Go runner:**  
    `./runner --port 50051 --max-vus 1000`  
  - Ensure **security group**: outbound to `https://flowstral.com` (and to your QAAI backend if it’s not on the same VPC); inbound from your QAAI backend IP to port **50051** (so the backend can send “start run” to the runner).

**Step 4 — Register runners with QAAI**  
- From the machine where the QAAI backend runs, register each runner:
  ```http
  POST /api/performance/runner/register
  Content-Type: application/json

  { "hostname": "<EC2-1-public-IP-or-DNS>", "port": 50051, "max_vus": 1000 }
  ```
  Repeat for EC2-2 (and EC2-3 if used).  
- **Performance → Setup** tab may have “Register runner” / “Discover”; use the same hostname and port there if available.

**Step 5 — Start the 1-hour load test**  
- In **Performance** tab: select the scenario (From Recorder / compiled), set **2000** VUs, **3600** s duration, **600** s ramp-up, then click **Run**.  
- Or via API:
  ```http
  POST /api/performance/tests/run
  Content-Type: application/json

  {
    "scenario_id": "<your-scenario-id>",
    "virtual_users": 2000,
    "duration_seconds": 3600,
    "ramp_up_seconds": 600,
    "base_url": "https://flowstral.com"
  }
  ```
- Backend will dispatch the run to the registered runner(s). The runners will ramp from 0 to 2000 VUs over 10 minutes, then hold 2000 VUs for the remainder of the hour (until 3600 s total).

**Step 6 — Monitor and get the report**  
- **Status:** `GET /api/performance/tests/{test_id}/status`  
- **Report (after run):** Performance tab report, or `GET /api/performance/tests/{test_id}/report` — latency (p50/p95/p99), RPS, errors.

**Ramp-up behavior:**  
- “Ramp-up 600 s” means the number of active VUs increases linearly from 0 to 2000 over the first 600 seconds. After 600 s, all 2000 VUs are active for the remaining 3000 s (50 minutes). Total test time = 3600 s (1 hour).

---

## Part 4: Cost Estimate for 2000+ VUsers, 1-Hour Run

Only **runner infrastructure** is considered here (the machines that generate the 2000 VUs). QAAI backend and your laptop are assumed already available.

### 4.1 Assumptions

- **2000 VUs**, **1 hour** (3600 s) sustained (after 10 min ramp-up).
- **2× EC2** as runner VMs (e.g. **us-east-1**), each running one Go runner process (e.g. 1000 VUs per VM).
- On-demand Linux pricing (approximate; check [AWS Pricing](https://aws.amazon.com/ec2/pricing/on-demand/) for your region).

### 4.2 Example EC2 cost (on-demand, us-east-1, Linux)

| Instance type | Use case | $/hour (approx) | 1 hour run |
|---------------|----------|------------------|------------|
| **c5.large** | 2× for 2000 VUs | ~\$0.085/hr each | 2 × \$0.085 = **\$0.17** |
| **c5.xlarge** | 2× if you want headroom | ~\$0.17/hr each | 2 × \$0.17 = **\$0.34** |

- **Total runner cost for one 1-hour run:** about **\$0.17–\$0.35** (depending on instance type and region).
- **No license cost** for QAAI or Go runner or k6 OSS when run on your own EC2.

### 4.3 Optional: flowstral.com hosting cost (your side)

- If flowstral.com is on **S3 + CloudFront**: you pay for S3 storage + CloudFront data transfer and requests. A 1-hour load test with 2000 VUs can generate a large number of requests; cost depends on page size and request count (e.g. millions of requests → non-trivial CloudFront cost). Use the AWS calculator or billing dashboard to estimate.
- If flowstral.com is on **EC2/ECS**: the **target** server cost is unchanged by the test; you only pay for the **runner** EC2s above (and possibly more data transfer).

### 4.4 Summary table

| Item | Cost (approx) |
|------|----------------|
| **Runner VMs (2× EC2, 1 hour)** | **\$0.17–\$0.35** |
| **QAAI / Go runner / k6 license** | **\$0** (use your own infra) |
| **flowstral.com (S3/CloudFront)** | Your existing + extra request/egress from test (estimate separately) |

**Bottom line:** For the **load test infrastructure** (runner side only), budget about **\$0.20–\$0.50** per 1-hour run at 2000 VUs, depending on instance size and region.

---

## Part 5: Full load test — SRM, Lighthouse, and monitoring (all captured)

To run a **full load test** with **SRM**, **Lighthouse**, and **load metrics** all captured in one procedure:

### 5.1 Order of operations

| Step | Action | What you get |
|------|--------|----------------|
| 1 | **Lighthouse baseline** (before load) | Performance score, LCP, FCP, CLS, TBT, TTI with no load. |
| 2 | **Add SRM server + Start monitoring** | Backend starts collecting CPU/memory/disk (and optional network) from the **target** server (e.g. EC2 hosting flowstral.com or its origin). |
| 3 | **Start load test** (browser 20 VU or Go runner 2000 VU) | Traffic hits flowstral.com; backend (or runner) can call `POST /api/srm/record-response-time` per request so response times are correlated with SRM samples. |
| 4 | **During run** | **SRM:** live CPU/memory in Performance tab (if UI polls `GET /api/srm/current`). **Load:** status/report from `GET /api/performance/tests/{test_id}/status` and report. **Lighthouse:** not run “during” the same test; run before and after. |
| 5 | **Stop load test** | Get load report (latency, RPS, errors). |
| 6 | **Stop SRM** | `POST /api/srm/stop`. |
| 7 | **View SRM correlation** | `GET /api/srm/correlation` — response time vs CPU/memory over time (enterprise-style “did server resources cause slow responses?”). |
| 8 | **Lighthouse again** (after load) | Run Lighthouse on flowstral.com; compare score and Core Web Vitals to baseline. |

### 5.2 What is captured where

| Data | Where it’s captured | How to view |
|------|---------------------|-------------|
| **Network/API requests** | Recorder → draft → scenario; replayed by each VU. | Load test report (requests, RPS, errors per endpoint if supported). |
| **Response times (latency)** | Runner (browser or Go) measures each HTTP response. | Performance tab report: p50/p95/p99, RPS. |
| **SRM (server CPU/memory/disk)** | Backend collects from target server via SSH/WMI/Prometheus/etc. | Performance tab SRM section; `GET /api/srm/current` (live), `GET /api/srm/correlation` (after stop). |
| **Response time ↔ SRM correlation** | Backend correlates each `record-response-time` call with SRM samples by timestamp. | `GET /api/srm/correlation` (graph or export). |
| **Lighthouse (Core Web Vitals)** | Backend runs `npx lighthouse` (before and after load). | Performance tab → Lighthouse tab; or `POST /api/performance/lighthouse/run` / `run-hardened`. |

### 5.3 One-line checklist

Lighthouse baseline → SRM add + start → Start load test → (during: optional record-response-time) → Stop load test → Stop SRM → SRM correlation → Lighthouse again.

---

## Part 6: Quick Reference — 2000 VU, 1 Hour, 10 Min Ramp-Up

| What | Value |
|------|--------|
| **URL** | `https://flowstral.com` |
| **What to record** | Homepage load (and optionally scroll / key clicks) |
| **Virtual users** | 2000 |
| **Duration** | 3600 s (1 hour) |
| **Ramp-up** | 600 s (10 minutes) |
| **Runner** | Go runner or k6 on 2× EC2 (e.g. c5.large) |
| **Runner cost (1 run)** | ~\$0.17–\$0.35 (EC2 only) |

---

## References

- [PERFORMANCE_PLATFORM_SINGLE_DOC.md](./PERFORMANCE_PLATFORM_SINGLE_DOC.md) — architecture, Go runner vs k6, VMs, cost model.
- [PERFORMANCE-GO-RUNNER-VS-K6.md](./PERFORMANCE-GO-RUNNER-VS-K6.md) — where we beat k6, where k6 beats us, how to make ours better.
- [PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md](./PERFORMANCE-ENTERPRISE-RUN-WALKTHROUGH.md) — full enterprise run (browser, API, Go runner, SRM, Lighthouse).
- [PERF-SETUP-AND-WALKTHROUGH.md](./PERF-SETUP-AND-WALKTHROUGH.md) — Go runner build, register, discover.
