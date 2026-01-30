# QAAI / Flowstral: Deployment Options, Recorder Parity & Packaging Reference

> **Purpose:** Lowest-level reference for deployment (SaaS, PaaS, hybrid, on-prem), desktop ↔ browser extension feature parity, and packaging tools/steps. Use this when starting packaging and deployment work.  
> **Recommendation & control plane vs client:** See **`docs/DEPLOYMENT-RECOMMENDATION-AND-CONTROL-PLANE.md`** for best deployment choice and what runs in control plane vs on the client (SaaS and PaaS steps).

---

## Part 1: Deployment Options

### 1.1 SaaS (Software as a Service)

**What it is:** Hosted cloud; users use the app via browser/desktop client; no server install.

| Aspect | Details |
|--------|---------|
| **Frontend** | Vite SPA → `dist/`; deploy to **Vercel** (current `vercel.json`), Netlify, or any static host. |
| **API** | Backend runs in your cloud (e.g. AWS ECS, GCP Cloud Run, Azure App Service). No `Dockerfile` in repo today; you must add `backend/Dockerfile`. |
| **Database** | Managed Postgres (Supabase, RDS, Cloud SQL). Supabase migrations live in `supabase/migrations/`. |
| **Storage** | S3/GCS/Azure Blob for artifacts; or Supabase Storage. |
| **Desktop client** | Users download from `https://releases.flowstral.com/desktop` (see `flowstral-desktop/package.json` publish URL). |
| **Extension** | Publish to Chrome Web Store / Edge Add-ons; or host unpacked ZIP for enterprise. |

**Lowest-level steps (SaaS):**

1. **Backend Dockerfile (missing today):** Create `backend/Dockerfile` (Python 3.10+, uvicorn, copy `backend/`, `requirements.txt`, expose 8000).
2. **Frontend:** `npm run build` → `dist/`. Point Vercel/Netlify to repo; set `VITE_API_BASE_URL` (or equivalent) to backend URL.
3. **DB:** Provision Postgres; run `supabase/migrations` or equivalent; set `DATABASE_URL` on backend.
4. **Secrets:** `JWT_SECRET`, any LLM API keys; use env vars or secret manager.
5. **Desktop updates:** Configure `electron-updater` publish URL; sign installers (Windows: signtool; macOS: notarize with Apple ID).

**SaaS compliance: multi-tenant and RBAC**

The backend has **tenant context** and **RBAC** enabled for SaaS:

- **Tenant context:** `TenantContextMiddleware` sets `request.state.tenant_id` and `request.state.user_id` from:
  1. JWT token (Authorization header) – decode and read `tenant_id` / `user_id` claims.
  2. Headers: `X-Tenant-ID`, `X-User-ID` (for API-key or server-to-server calls).
- **RBAC:** `RBACMiddleware` loads permissions for the user/tenant and attaches them to `request.state.permissions`. Use the `@require_permission("permission:action")` decorator on routers to protect routes.
- **Tenants API:** `GET/POST /tenants`, `GET/PATCH /tenants/{tenant_id}` (see `backend/app/routers/tenants_api.py`). Use for provisioning tenants and updating settings.
- **Files:** `backend/app/middleware/tenant_middleware.py`, `backend/app/middleware/rbac_middleware.py`, `backend/app/services/core/tenant_service.py`, `backend/app/services/core/rbac_service.py`.

For SaaS: issue JWTs with `tenant_id` and `user_id`, or have API clients send `X-Tenant-ID` / `X-User-ID`. Optionally protect key routes with `@require_permission("test_cases:create")` etc.

---

### 1.2 PaaS (Platform as a Service)

**What it is:** Deploy full stack to a managed platform (e.g. Kubernetes via Helm, or app platform like Render/Fly.io).

| Aspect | Details |
|--------|---------|
| **Helm** | Chart in `helm/qaai/`: `Chart.yaml`, `values.yaml`. Dependencies: Bitnami PostgreSQL, MinIO, Redis. |
| **Values** | Backend image `qaai/backend`, replicas, autoscaling, ingress (e.g. `qaai.example.com`), TLS (e.g. cert-manager). |
| **Images** | You must build and push: `backend`, `frontend`, `test-worker`. Only `backend/Dockerfile.worker` exists; add `backend/Dockerfile` and a frontend Dockerfile (e.g. `Dockerfile.frontend` referenced in `docker-compose.air-gapped.yml`). |
| **Ollama** | Optional in values; for local LLM (e.g. `ollama/ollama`, persistence ~100Gi). |

**Lowest-level steps (PaaS / K8s):**

1. **Add missing Dockerfiles:**
   - `backend/Dockerfile`: FROM python:3.10-slim, WORKDIR /app, COPY requirements.txt, pip install, COPY ., CMD uvicorn app.main:app --host 0.0.0.0 --port 8000.
   - Frontend: multi-stage (node build → nginx serve `dist/`) or use root `vite.config.ts` with build context `./` and output in `dist/`.
2. **Build & push:** e.g. `docker build -t qaai/backend:latest ./backend`, push to your registry.
3. **Helm:** `helm dependency update helm/qaai`, `helm install qaai helm/qaai -f myvalues.yaml`. Set `backend.image.repository` and tag; ensure `postgresql.auth`, `minio.auth`, `redis` match your secrets.
4. **Ingress:** values already have `ingress.enabled`, host, TLS; ensure cert-manager or your ingress controller is installed.

---

### 1.3 Hybrid

**What it is:** Some components in cloud, some on-prem (e.g. orchestration in cloud, execution or data on-prem).

| Pattern | Where | Details |
|--------|--------|---------|
| **Cloud orchestration + on-prem workers** | API/UI in cloud; test workers run in customer network | Backend and frontend as in SaaS; workers connect to backend via tunnel or VPN; `REDIS_URL` / queue visible to both. |
| **On-prem execution + cloud AI** | Recorder/runner on-prem; LLM calls go to OpenAI/Anthropic | Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` on backend; `OLLAMA_URL` empty or not used. |
| **Desktop/extension → your backend** | Desktop app or extension points to your server URL | Configure `serverUrl` (desktop: `flowstral-desktop` config/store; extension: options). |

**Lowest-level steps (hybrid):**

1. **Backend:** Deploy as in SaaS or PaaS; ensure CORS and auth allow requests from desktop/extension and from on-prem workers.
2. **Workers on-prem:** Use same image as `test-worker` (Dockerfile.worker); set `DATABASE_URL`, `REDIS_URL`, backend URL to reach cloud (or use tunnel).
3. **Desktop:** Mass deploy with `serverUrl` pre-set (see flowstral-desktop `DEPLOYMENT.md`: GPO, config.json, or registry).
4. **Extension:** If using enterprise unpacked, ship a config or build variant that sets default `serverUrl`.

---

### 1.4 On-Prem (Full)

**What it is:** Everything runs in customer data center; air-gapped optional.

| Artifact | Location | Purpose |
|----------|----------|---------|
| **docker-compose.yml** | Repo root | Minimal: Postgres only (no backend build). |
| **docker-compose.full.yml** | Repo root | Full stack: Postgres (pgvector), MinIO, Redis, backend, frontend, ollama, test-worker × 2. Builds backend from `./backend` (Dockerfile), frontend from `./src` (Dockerfile). |
| **docker-compose.air-gapped.yml** | Repo root | Air-gapped: Postgres, backend, ollama, optional frontend. No external API keys; `AIR_GAPPED_MODE=true`, `OLLAMA_URL=http://ollama:11434`. |

**Missing pieces for on-prem today:**

- **backend/Dockerfile** does not exist. `docker-compose.full.yml` and `docker-compose.air-gapped.yml` reference `context: ./backend`, `dockerfile: Dockerfile`.
- **Frontend Dockerfile:** Referenced as `Dockerfile.frontend` in air-gapped compose (context `.`); not present in repo. You need a Dockerfile that builds the Vite app (e.g. from repo root: build `src` with Vite, serve `dist/` with nginx).

**Lowest-level steps (on-prem):**

1. **Add `backend/Dockerfile`** (see PaaS section).
2. **Add frontend Dockerfile** (e.g. `Dockerfile.frontend` at repo root: Node build, then nginx or static serve).
3. **Copy env:** From `env.example`; set `POSTGRES_PASSWORD`, `JWT_SECRET`, etc. For air-gapped, leave LLM API keys unset.
4. **Run:**  
   - Full: `docker-compose -f docker-compose.full.yml up -d`  
   - Air-gapped: `docker-compose -f docker-compose.air-gapped.yml up -d`
5. **Ollama models:** After first run, e.g. `docker exec qaai-ollama ollama pull qwen2.5-coder:14b` (or per docker-compose service name).
6. **Desktop/extension:** Point `serverUrl` to on-prem backend (e.g. `https://qaai.internal.company.com`). Use flowstral-desktop `DEPLOYMENT.md` for mass deployment (GPO, MDM, config.json).

---

## Part 2: Desktop App vs Browser Extension — Feature Parity & Sync

### 2.1 Shared vs Desktop-Only Today

| Component | Desktop (flowstral-desktop) | Extension (flowstral-extension) | Sync status |
|-----------|-----------------------------|---------------------------------|-------------|
| **recorder-engine.js** | Loaded from `flowstral-extension/src/lib/recorder-engine.js` and injected (playwright-recorder.js) | Content script; same file | ✅ Single source of truth |
| **App selectors / SmartSelector** | Via recorder-engine + app-selectors | Same in recorder-engine / content | ✅ Aligned |
| **Action coalescing** (dropdown → single “Select X”) | `lib/action-coalescer.js`; used in recipe-recorder-integration | ❌ Not in extension | 🔴 Add to extension |
| **Recipe / ElementRecipe** (what/where/which) | `lib/recipe-recorder-integration.js`, `lib/element-recipe.js`; V2 click capture script | ❌ Not in extension | 🔴 Add to extension |
| **SmartFinder + Strategy Memory** | `lib/smart-finder.js`, `lib/strategy-memory.js` (playback + learning) | ❌ Not in extension | 🔴 Playback: optional backend or extension-side |
| **ActionHandlers** (product click, PWA, etc.) | `lib/action-handlers.js` (executeAction) | ❌ Extension only runs in browser; no Playwright runner | 🟡 N/A for recording; only for “run test” in extension |
| **Confidence + step metadata + screenshots** | `lib/confidence/`, `lib/step-metadata/`, `lib/screenshots/` | Extension has confidence in selectors; no step-metadata/screenshot manager | 🟡 Align confidence; optional metadata in extension |
| **Debug mode (pause/step/retry/skip)** | playwright-recorder.js + IPC | ❌ Extension has no test runner | 🟡 Could add “run in backend” or future in-extension runner |
| **Mobile emulation** | playwright-recorder.js (viewport, network throttle) | ❌ Not in extension | 🟡 Optional: devtools-style emulation in extension |
| **Network capture** | Desktop can add (see ARCHITECTURE.md) | `lib/network-capture.js` | Extension has it; desktop could reuse |
| **License / config** | electron-store, license.js, serverUrl | storage, options | Different by design |

### 2.2 What “sync” means here

- **Recording output parity:** Actions and selectors produced by the extension should match the desktop (same coalescing, same recipe/selector shape where applicable). That implies bringing **action-coalescer** and **recipe/element-recipe** (and optionally strategy-memory for “which selector worked”) into the extension’s recording path.
- **Same engine:** Keep using `recorder-engine.js` as the single source for core recording and app selectors; desktop already reads it from the extension folder.
- **Playback:** Desktop has Playwright + SmartFinder + ActionHandlers for running tests. Extension does not run tests locally; it can send steps to backend. Making “both similar” for playback means either (a) extension delegates run to backend/desktop, or (b) you add a minimal in-browser runner (limited).

### 2.3 Concrete sync plan (recording parity)

1. **Action coalescer in extension**
   - **Add:** `flowstral-extension/src/lib/action-coalescer.js` (or equivalent). Either copy from desktop and adapt to browser (no Node `require`), or extract a shared script that both can use.
   - **Integrate:** In content script / recorder flow, after capturing a raw click/input, run coalescer; if it returns a combined action (e.g. “Select X”), emit that instead of two separate actions.
   - **Script injection:** Desktop injects `getActionCoalescerScript()` from recipe-recorder-integration; extension can inject the same script in the page or run coalescer in content script on received events.

2. **Recipe / ElementRecipe in extension**
   - **Add:** `element-recipe.js` and `recipe-recorder-integration.js` (or their logic) into extension. Desktop’s `getRecipeClickCaptureScript()` is injected into the page; extension can either:
     - Inject the same script (from a shared source or copied), and have content script listen for recipe actions, or
     - Reimplement the same “what/where/which” capture in content script using the same data model.
   - **Output:** Extension should emit actions that include `recipe` (what/where/which) so that backend or desktop playback can use the same SmartFinder/recipe logic.

3. **Single source of truth**
   - **Option A:** Create a shared npm package (e.g. `@flowstral/recorder-core`) containing: recorder-engine, action-coalescer, element-recipe, recipe-recorder-integration (browser-safe parts). Desktop and extension both depend on it; build step copies or bundles into each.
   - **Option B:** Keep files in `flowstral-extension/src/lib/` and have desktop require/copy from there (current pattern for recorder-engine). Add there: action-coalescer (browser-safe), element-recipe, and a thin recipe-recorder-integration that works in extension.

4. **Strategy memory (optional)**
   - Desktop uses it for playback (remember which selector worked). Extension could: (a) send “last successful selector” to backend so backend can learn, or (b) store per-origin in `chrome.storage` and use on next run for the same page. Lower priority than coalescer + recipe.

5. **Confidence**
   - Extension already attaches confidence to selectors. Align the scale and meaning with desktop’s ConfidenceCalculator so that any shared backend or report sees the same semantics.

### 2.4 File-level checklist (extension)

| File in desktop (src/main/lib/) | Action in extension |
|--------------------------------|---------------------|
| action-coalescer.js | Add to extension (browser-safe version or shared bundle). |
| element-recipe.js | Add; used by recipe capture. |
| recipe-recorder-integration.js | Add or adapt: getRecipeClickCaptureScript, recipeActionToLegacy, legacyActionToRecipe. |
| smart-finder.js | Playback only; optional for extension (e.g. if you add “run test” in extension via backend). |
| strategy-memory.js | Optional: persist in storage; use when generating or suggesting selectors. |
| action-handlers.js | Not needed for recording; only for execution (desktop/backend). |

---

## Part 3: Packaging — Tools and Steps

### 3.1 Desktop app (Electron)

| Item | Detail |
|------|--------|
| **App** | flowstral-desktop (Electron). |
| **Entry** | `flowstral-desktop/package.json` → `"main": "src/main/index.js"`. |
| **Webapp** | Built from repo root Vite app; copied into desktop: `build:webapp` / `build:webapp:unix` → `webapp/`. |
| **Builder** | electron-builder (in flowstral-desktop and root electron-builder.config.js). |
| **Output** | flowstral-desktop: `dist/` (package.json build.directories.output). Root config: `dist-electron/`. Use one consistently (e.g. flowstral-desktop’s `dist/`). |

**Tools:**

- Node 18+
- npm (or yarn)
- electron-builder
- electron (devDep)
- Playwright (for recorder): `npx playwright install chromium`
- Windows: signtool (optional but recommended for installers)
- macOS: Xcode + Apple ID for notarization (e.g. electron-notarize)

**Steps (per platform):**

1. **From repo root (optional):** Build webapp so desktop has latest UI.  
   `npm run build` (if your root package.json builds the Vite app), then copy `dist` → `flowstral-desktop/webapp` (or use desktop’s `build:webapp`).
2. **Desktop dir:**  
   `cd flowstral-desktop`  
   `npm ci` or `npm install`  
   `npx playwright install chromium`
3. **Build:**  
   - Win: `npm run build:win` → NSIS + portable in `dist/`  
   - Mac: `npm run build:mac` → DMG + zip in `dist/`  
   - Linux: `npm run build:linux` → AppImage + deb in `dist/`
4. **Signing (production):**  
   - Win: Set env (e.g. CSC_*); use signtool in electron-builder.  
   - Mac: Set APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID; use afterSign in electron-builder (see root electron-builder.config.js).
5. **Icons:** flowstral-desktop uses `assets/` (icon.ico, icon.icns, icon.png). Root electron-builder.config references `electron/resources` — align with flowstral-desktop package.json `build.directories.buildResources: "assets"`.

**Artifacts:**

- Windows: `Flowstral-Setup-{version}.exe`, optional portable.
- macOS: `Flowstral-{version}-{arch}.dmg` (and .zip).
- Linux: `Flowstral-{version}-{arch}.AppImage`, `.deb`.

---

### 3.2 Browser extension

| Item | Detail |
|------|--------|
| **App** | flowstral-extension. |
| **Manifest** | manifest.json (MV3). |
| **Build** | No bundler required today; `npm run build` in extension is `mkdir -p dist && cp -r manifest.json src icons dist/`. |

**Extension capabilities (for store listing / approval):**

- **Recording:** UI actions with multi-strategy selectors (recorder-engine.js); app-specific handling (Salesforce, ServiceNow, Workday, etc.).
- **HAR capture for load testing and API testing:** Optional **Protocol Capture** toggle during recording captures HTTP/WebSocket as **HAR (HTTP Archive)**. Export HAR for:
  - **Load testing:** Import into k6, JMeter, Gatling, NeoLoad, etc.
  - **API testing:** Use in Postman, Insomnia, or API test suites; request/response headers and timing preserved. HAR 1.2 format; XHR, Fetch, document, WebSocket; optional correlation detection.
- **Playwright (and other) export:** Generate Playwright, Selenium, Puppeteer scripts from recorded steps.
- **Suggestions / page analysis:** Optional analysis of page elements for test ideas.
- **Run on server:** Optional “Run Test” that sends steps to backend for execution.

**Tools:**

- Node 18+ (for scripts/tests)
- Chrome or Edge (load unpacked)
- Zip tool (for store or enterprise)

**Steps:**

1. **Extension dir:**  
   `cd flowstral-extension`  
   `npm install` (if you add a build step later).
2. **Load unpacked:** Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `flowstral-extension` (or `dist/` if you use the copy step).
3. **Package for store / enterprise:**  
   Zip `flowstral-extension` (or `dist/`) excluding `node_modules`, `.git`, tests.  
   For Chrome Web Store: upload ZIP; fill listing, privacy policy (see PRIVACY_POLICY.md).
4. **After parity work:** If you introduce a build step (e.g. bundle shared lib or TypeScript), add `npm run build` and point manifest to built files; then package the build output.

**Artifacts:**

- Unpacked folder: `flowstral-extension/` or `flowstral-extension/dist/`.
- ZIP: `flowstral-extension-{version}.zip` for store or sideload.

---

### 3.3 Backend (API)

| Item | Detail |
|------|--------|
| **Runtime** | Python 3.10+. |
| **Server** | uvicorn (e.g. `uvicorn app.main:app --host 0.0.0.0 --port 8000`). |
| **Dockerfile** | **Missing:** add `backend/Dockerfile`. |

**Suggested backend/Dockerfile (minimal):**

```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Tools:**

- Docker
- pip / venv (local dev)

**Steps:**

1. Add `backend/Dockerfile` as above (or with non-root user, healthcheck, etc.).
2. Build: `docker build -t qaai/backend:latest ./backend`.
3. Run: use docker-compose (full or air-gapped) or Kubernetes with image `qaai/backend:latest`.

---

### 3.4 Frontend (Vite SPA)

| Item | Detail |
|------|--------|
| **Build** | `npm run build` (root); output `dist/`. |
| **Config** | vite.config.ts (port 8080 dev). |
| **Dockerfile** | **Missing:** docker-compose files reference `Dockerfile.frontend` at repo root. |

**Suggested Dockerfile.frontend (repo root):**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Tools:**

- Node 18+, npm
- Docker (for image)

**Steps:**

1. Add `Dockerfile.frontend` at repo root (or adjust paths if frontend lives in subdir).
2. Build: `docker build -f Dockerfile.frontend -t qaai/frontend:latest .`.
3. Serve: nginx serves `dist/`; set API URL via env and build-time or runtime config.

---

### 3.5 Test worker

| Item | Detail |
|------|--------|
| **Dockerfile** | backend/Dockerfile.worker (exists). |
| **Base** | mcr.microsoft.com/playwright/python:v1.40.0-focal. |
| **CMD** | python -m app.workers.test_worker. |

**Steps:**

1. `docker build -f backend/Dockerfile.worker -t qaai/test-worker:latest ./backend`.
2. Use in docker-compose or K8s with `DATABASE_URL`, `REDIS_URL`, backend URL.

---

## Part 4: Quick reference matrix

| Deployment | Frontend | Backend | DB | Workers | Desktop | Extension |
|-------------|-----------|---------|-----|---------|---------|-----------|
| **SaaS** | Vercel/static | Your cloud (need Dockerfile) | Managed Postgres | Optional cloud workers | Download from releases | Chrome Store or ZIP |
| **PaaS** | Helm / K8s | Same | Bitnami Postgres (Helm) | Helm test-workers | Same | Same |
| **Hybrid** | Cloud or on-prem | Cloud or on-prem | Either | On-prem or cloud | serverUrl → your API | serverUrl → your API |
| **On-prem** | docker-compose full/air-gapped | Same | Postgres in compose | In same compose | serverUrl → on-prem host | Same |

| Package | Main tool | Output |
|---------|-----------|--------|
| **Desktop** | electron-builder (in flowstral-desktop) | NSIS/DMG/AppImage/deb + portable |
| **Extension** | Copy or future bundle | Unpacked dir + ZIP |
| **Backend** | Docker (add Dockerfile) | Image qaai/backend |
| **Frontend** | Vite + Docker (add Dockerfile.frontend) | dist/ + image qaai/frontend |
| **Worker** | Docker (Dockerfile.worker) | Image qaai/test-worker |

---

## Part 5: Immediate next steps for packaging

1. **Add `backend/Dockerfile`** so docker-compose.full and air-gapped work.
2. **Add `Dockerfile.frontend`** at repo root (or under frontend) and wire compose to it.
3. **Align Electron output dir:** Prefer flowstral-desktop’s `dist/` and ensure root electron-builder.config.js and desktop package.json agree on output and buildResources.
4. **Extension ↔ desktop parity:** Introduce action-coalescer and recipe (element-recipe + recipe-recorder-integration) into the extension so recording output matches desktop; keep recorder-engine.js as single source.
5. **Document env vars:** Central list (e.g. in backend README or env.example) for DATABASE_URL, REDIS_URL, S3/MinIO, JWT_SECRET, OLLAMA_URL, AIR_GAPPED_MODE, and optional LLM keys.

Once these are in place, you can package and ship for SaaS, PaaS, hybrid, and on-prem using the same reference.
