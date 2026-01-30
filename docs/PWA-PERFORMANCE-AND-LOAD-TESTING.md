# PWA Performance & Load Testing – Code Check and ELI5 Guide

## 1. What the Codebase Does Today

### PWA testing (functional, not load)

QAAI has **PWA functional testing** in Flowstral Desktop and docs:

| What exists | Where | What it does |
|-------------|--------|----------------|
| **PWA Audit** | `flowstral-desktop/src/main/lib/pwa-testing/`, `action-handlers.js` | Validates manifest, service worker, offline, cache, installability (score 0–100). |
| **Manifest check** | `pwa-testing/manifest-validator.js` | Validates `manifest.json` (name, icons, display, etc.). |
| **Service worker** | `pwa-testing/service-worker-utils.js` | Checks SW registration and state; can wait for "activated". |
| **Offline test** | `pwa-testing/offline-tester.js` | Goes offline via CDP, reloads, checks expected elements/text/URLs. |
| **Cache check** | `pwa-testing/cache-verifier.js` | Verifies Cache API (critical resources, optional expected URLs). |
| **Installability** | `pwa-testing/index.js` | Checks HTTPS, manifest, SW, icons, start URL, display mode. |
| **Network presets** | `offline-tester.js` | OFFLINE, SLOW_3G, FAST_3G, SLOW_WIFI, LIE_FI (for throttling, not load). |

Docs: `docs/PWA_TESTING_GUIDE.md`, `docs/QAAI-MASTER-REFERENCE.md` (PWA section).

### Load / performance testing (API, not PWA-specific)

| What exists | Where | What it does |
|-------------|--------|----------------|
| **Recorder “Load” toggle** | `PlaywrightRecorderPage.tsx` | Captures network requests during recording; “Quick Load Test” sends data to Performance tab. |
| **Performance page** | `src/pages/Performance.tsx` | Runs **API/HTTP load tests**: virtual users, duration, ramp-up, hitting **endpoints** (e.g. `/api/products`, `/health`). Metrics: response time, RPS, error rate. |
| **Backend performance API** | `backend/app/routers/performance_api.py` | Scenarios, HAR import, Flowstral→scenario; drives **HTTP** load tests. |
| **Protocol capture** | Performance page + backend | Records HTTP traffic during a run; not PWA-specific. |

So: **PWA testing** = “Is the PWA correct?” (manifest, SW, offline, cache). **Load testing** = “How do API endpoints behave under many requests?” They are **not** wired together, and load testing does **not** target “PWA as an app” (e.g. many users opening the PWA and measuring page-level metrics).

---

## 2. Gaps for “PWA App Load Testing” and Performance

- **No PWA-specific load testing**  
  Load tests hit **API endpoints** (from HAR or quick-start scenarios). There is no built-in “N virtual users each open the PWA start URL and we measure success/time.”

- **No Core Web Vitals / Lighthouse in PWA tests**  
  PWA module does not collect LCP, FCP, CLS, TTI, or run Lighthouse. The only reference to Web Vitals in the repo is a label in `UnifiedWorkflowEditor.tsx` (`browser_web_vital_lcp`), not actual measurement.

- **No Lighthouse integration**  
  No automation that runs Lighthouse (or PageSpeed Insights) on the PWA and fails/passes tests or stores scores.

- **No “PWA under load” scenario**  
  You cannot today: “Run 50 users hitting the PWA; for each run measure LCP/FCP and report percentiles.”

- **Performance page does not consume “pending load test” from recorder in code**  
  Recorder sets `pendingLoadTestRequests` / `pendingLoadTestTimestamp` and navigates to `/performance`; the Performance page’s run logic uses its own scenarios/config (quick-start or custom endpoints), not that sessionStorage. So “load test from recorder” is partly a handoff to the Perf tab, not a full use of captured PWA traffic as the load scenario.

- **No link between PWA audit and Performance tab**  
  You cannot run a PWA audit as part of a load test or get “PWA score + Web Vitals” under load in one flow.

---

## 3. ELI5: Full Performance Test for a PWA App (Step by Step)

“ELI5” = simple, step-by-step. Here we assume you want: **functional PWA checks** + **how fast the app feels** (Web Vitals) + **how it behaves when many people use it** (load).

### Big picture (3 parts)

1. **Part A – “Is it a proper PWA?”**  
   Use QAAI’s PWA tests (manifest, service worker, offline, cache, installability).

2. **Part B – “Is it fast for one user?”**  
   Use Lighthouse / Core Web Vitals (LCP, FCP, CLS, etc.) – today outside QAAI, or you add a step that runs Lighthouse.

3. **Part C – “Does it hold up when many users hit it?”**  
   Use load testing: either “many users hit the PWA URL” or “many users hit the APIs the PWA uses.” QAAI’s Performance tab does the latter (API load); for “many users open the PWA” you use the recorder’s captured URLs or external tools.

Below is the full flow in simple steps.

---

### Part A – Check that the PWA is correct (using QAAI)

1. **Open the app in Flowstral Desktop**  
   You need a recording session (browser tab) so PWA tests have a page to inspect.

2. **Go to your PWA’s URL**  
   In the recorder, navigate to your PWA (e.g. `https://my-pwa.example.com`).

3. **Wait for the service worker**  
   Add a step (or use the builder): **Wait for Service Worker** → state `activated`, e.g. 30 s timeout.  
   (So we don’t run the rest while the SW is still installing.)

4. **Run a PWA audit**  
   Add step: **PWA Audit** with:
   - Check manifest: yes  
   - Check service worker: yes  
   - Check offline: yes  
   - Check cache: yes  
   - Optionally set **expectedElements** / **expectedText** to what should be visible (e.g. shell, “Home”).

5. **Optional extra checks**  
   - **Check manifest** only.  
   - **Check cache** with **expectedUrls** = your critical JS/CSS/start URL.  
   - **Test offline**: expectedElements/expectedText/expectedUrls for the offline page.  
   - **Check installability**.

6. **Interpret result**  
   Audit returns a **score (0–100)** and categories (manifest, serviceWorker, offline, cache). Use the pass threshold (e.g. ≥75) and fix any failing checks.  
   **ELI5:** “We made sure the PWA is installed correctly and works offline.”

---

### Part B – Check “how fast” for one user (Lighthouse / Web Vitals)

QAAI does not run Lighthouse or collect Web Vitals yet. Do this outside QAAI (or add an automated step that runs Lighthouse).

1. **Open Chrome DevTools**  
   F12 → **Lighthouse** tab.

2. **Choose “Navigation” and “Performance”**  
   Device: Desktop and/or Mobile.  
   **ELI5:** “We’re measuring how fast the page loads and how smooth it is.”

3. **Run Lighthouse**  
   Click “Analyze page load.” Wait for the report.

4. **Look at Performance score and Core Web Vitals**  
   - **LCP** (Largest Contentful Paint) – “When does the main content show?” (e.g. &lt; 2.5 s good.)  
   - **FCP** (First Contentful Paint) – “When does something first appear?”  
   - **CLS** (Cumulative Layout Shift) – “Does the page jump around?” (e.g. &lt; 0.1 good.)  
   - **TTI** (Time to Interactive) – “When can the user really click and use it?”

5. **Optional: run from command line**  
   Install Lighthouse CLI, then run:  
   `npx lighthouse https://my-pwa.example.com --output html --output-path ./pwa-perf.html`  
   Open `pwa-perf.html` to see the same kind of report.  
   **ELI5:** “We wrote down the speed numbers so we can compare later (e.g. after changes or under load).”

---

### Part C – Load test (“many users” at once)

Two ways to think about “load test for PWA”:

- **Option C1 – Load test the *APIs* the PWA uses**  
  This is what QAAI’s Performance tab does today: many virtual users hit specific HTTP endpoints (e.g. `/api/products`). Good for: “Can the server and APIs handle traffic?”

- **Option C2 – Load test the *PWA itself* (many users open the app)**  
  Many virtual users each open the PWA URL (and maybe click around). Good for: “Does the app shell and first load hold up under concurrency?”  
  QAAI doesn’t do C2 out of the box; you use the recorder to capture URLs and then either use QAAI’s Performance with those URLs as endpoints or use k6/Artillery/etc. to hit the PWA URL (and optionally run Lighthouse per run).

**ELI5:** C1 = “Lots of people calling the same back-office doors.” C2 = “Lots of people opening the front door of the app at once.”

#### C1 – Load test APIs (with QAAI Performance tab)

1. **Decide which URLs matter**  
   Usually: PWA start URL, main API calls (e.g. `/api/products`, `/api/user`).  
   You can get these by:  
   - Recording a session with “Load” (and optionally “Protocol”) capture on, then using “Quick Load Test” to jump to Performance, or  
   - Manually defining endpoints in the Performance tab.

2. **Open the Performance page**  
   In QAAI frontend: go to **Performance** (or `/performance`).

3. **Set base URL**  
   Point to your app’s origin (e.g. `https://my-pwa.example.com`).

4. **Pick or define a scenario**  
   - Use a **Quick-start** (e.g. “API Load Test”) and change paths to match your PWA’s APIs, or  
   - Custom: add endpoints (method + path + optional weight).  
   Include at least:  
   - The **document** (e.g. `GET /` or your start path) so you’re also hitting the PWA shell.  
   - Key **API** routes the PWA calls.

5. **Set load**  
   Virtual users (e.g. 50), duration (e.g. 60 s), ramp-up (e.g. 10 s).

6. **Run**  
   Start the test. Watch response times, RPS, errors.  
   **ELI5:** “We pretended many people were calling the same pages/APIs and checked that the server didn’t fall over.”

#### C2 – Load test “many users open the PWA” (with k6 or similar)

1. **Install k6**  
   https://k6.io/docs/getting-started/installation/

2. **Write a tiny script that hits the PWA URL**  
   Example:

   ```js
   import http from 'k6/http';
   import { check } from 'k6';

   export const options = {
     vus: 50,
     duration: '60s',
   };

   export default function () {
     const res = http.get('https://my-pwa.example.com/');
     check(res, { 'status is 200': (r) => r.status === 200 });
   }
   ```

3. **Run**  
   `k6 run script.js`  
   You get: request success rate, latency (e.g. p95), RPS.  
   **ELI5:** “We had 50 fake users open the app at the same time and saw how many succeeded and how slow it was.”

4. **Optional: combine with Lighthouse**  
   Run Lighthouse (CLI) before and after load, or run a smaller load test and then run Lighthouse once to see if LCP/FCP degraded.  
   **ELI5:** “We checked that the app is still fast even after we stressed it.”

---

### Putting it all together (full PWA performance test, ELI5)

1. **PWA correctness (Part A)**  
   In QAAI/Flowstral: open PWA → wait for SW → run PWA Audit (+ manifest/cache/offline/installability as needed). Fix until score and checks pass.

2. **Speed for one user (Part B)**  
   Run Lighthouse (DevTools or CLI) on the PWA URL. Write down Performance score and LCP/FCP/CLS (and TTI if shown). Fix until they meet your targets.

3. **Load test APIs (Part C1)**  
   In QAAI Performance: base URL = PWA origin, scenario = PWA document + main APIs, run with N users and M duration. Check response times and error rate.

4. **Load test “many users open PWA” (Part C2)**  
   Use k6 (or similar) to hit the PWA start URL with many VUs. Check status 200 and latency. Optionally run Lighthouse again after load to see if metrics got worse.

5. **Optional: throttling**  
   To simulate slow networks, use Chrome DevTools Network throttling (Slow 3G, etc.) or CDP from QAAI (offline-tester’s presets). Re-run Part A (offline) and Part B (Lighthouse on slow 3G) to ensure the PWA is still correct and acceptable on bad networks.

6. **Document and repeat**  
   Save: PWA score, Lighthouse Performance + LCP/FCP/CLS, load test RPS and p95 latency. Re-run after big changes or before releases.  
   **ELI5:** “We made sure the PWA is valid, fast for one person, and still works when many people use it.”

---

## 4. Summary Table

| Goal | In QAAI? | Where / How |
|------|----------|-------------|
| PWA manifest / SW / offline / cache / installability | ✅ Yes | Flowstral Desktop – PWA Audit, Check Manifest, Check Service Worker, Test Offline, Check Cache, Check Installability. |
| Throttled network (Slow 3G, etc.) | ✅ Yes | PWA offline-tester presets (CDP); not in UI as “load test.” |
| Core Web Vitals (LCP, FCP, CLS) | ❌ No | Use Lighthouse (DevTools or CLI) or add Lighthouse step. |
| Load test *API endpoints* | ✅ Yes | Performance tab: scenarios, virtual users, duration; backend performance API. |
| Load test *PWA URL* (many users open app) | ❌ No | Use k6/Artillery/etc. with PWA start URL; or add “PWA load” scenario that hits document URL. |
| PWA audit + load in one flow | ❌ No | Run PWA audit and load test separately; no integration. |
| Lighthouse in automation | ❌ No | Add Lighthouse (or PageSpeed) step if you want it in the same pipeline. |

---

## 5. Suggested code improvements (if you want PWA + load + Web Vitals)

- **Lighthouse / Web Vitals in PWA flow**  
  Add an action (e.g. `runLighthouse` or `collectWebVitals`) that runs Lighthouse via CDP or Node and returns Performance score + LCP/FCP/CLS (and optionally TTI). Expose in Test Builder and in PWA Audit summary.

- **“PWA load” scenario**  
  In Performance tab: preset or scenario type “PWA load” that uses the PWA start URL (and optionally main API URLs from HAR) so that “load test for PWA” is one click.

- **Consume recorder load data on Performance page**  
  On load of `/performance`, read `pendingLoadTestRequests` / `pendingLoadTestTimestamp` from sessionStorage and prefill scenario/endpoints (and optionally base URL) so “Quick Load Test” from the recorder actually drives the next run.

- **Optional: Web Vitals under load**  
  For advanced use: run many headless browsers (or Playwright workers), each opening the PWA URL and collecting LCP/FCP/CLS via CDP or `performance.getEntriesByType`, then aggregate percentiles. This would be a new feature (e.g. “PWA performance under load”).

---

## 6. Integration with Performance Tab (QAAI)

- **Recorder → Perf:** Record with Load toggle → Quick Load Test → Perf tab shows "From Recorder" and **Use these requests** to run a load test with the same endpoints.
- **PWA Load scenario:** In Perf tab → Quick Start → **📱 PWA Load**. Set Base URL to your PWA origin in Config, then Run Test.
- **Lighthouse:** Perf tab → **Lighthouse** tab → enter PWA URL → Run Lighthouse (Performance score + LCP, FCP, CLS, TBT, TTI). Backend: `POST /api/performance/lighthouse/run` or `POST /api/performance/pwa/performance`.
- **Server-side metrics:** Perf tab → Record tab → Server CPU Monitoring → add server, start monitoring, run load test, view correlation.

**Full setup and walkthrough:** See **PERF-SETUP-AND-WALKTHROUGH.md**.  
**All APIs and options:** See **PERF-CAPABILITIES-REFERENCE.md**.

---

*Document generated from codebase review. PWA testing: `flowstral-desktop/src/main/lib/pwa-testing/`, `docs/PWA_TESTING_GUIDE.md`. Load testing: `src/pages/Performance.tsx`, `backend/app/routers/performance_api.py`. Lighthouse: `backend/app/services/performance/lighthouse_service.py`, `POST /api/performance/lighthouse/run`, `POST /api/performance/pwa/performance`.*
