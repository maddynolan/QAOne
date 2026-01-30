# QAAI Deployment Status, Pending Work & Steps (Future Reference)

> **Use this doc** for: what’s done vs pending, deployment steps by type, and where to look. Update this file when you complete pending items or change deployment approach.  
> **Also see:** `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md` for full options (SaaS, PaaS, hybrid, on-prem), recorder parity, and packaging tools.

---

## 1. Status at a glance

| Area | Done | Pending |
|------|------|---------|
| **Backend image** | ✅ `backend/Dockerfile` added | — |
| **Frontend image** | ✅ `Dockerfile.frontend` at repo root added | — |
| **OLLAMA** | ✅ Off by default: compose (ollama commented), helm (ollama.enabled: false), env.example cloud-only | — |
| **Multi-tenant / RBAC** | ✅ Middleware + tenants API + SaaS compliance doc in DEPLOYMENT-AND-PACKAGING-REFERENCE.md | — |
| **Extension** | Recording, HAR (load/API), Export HAR, action-coalescer | Recipe; SF context tab; merge test cases; Run on server |
| **Desktop** | Full recorder + playback | — |

---

## 2. What’s done (already in repo)

- **backend/Dockerfile** – Python 3.10, uvicorn, healthcheck, cloud LLM only (no OLLAMA in image).
- **Dockerfile.frontend** – Multi-stage: Node build → nginx serve `dist/`; build-arg `VITE_API_BASE_URL`.
- **docker-compose.full.yml** – Can reference backend Dockerfile; OLLAMA section can be commented for “cloud only.”
- **docker-compose.air-gapped.yml** – References backend + optional frontend; OLLAMA can be commented.
- **helm/qaai/** – Chart + values; OLLAMA optional (can be disabled in values).
- **Tenant + RBAC** – `TenantContextMiddleware`, `RBACMiddleware`, `tenants_api` router; JWT or `X-Tenant-ID` / `X-User-ID` headers.
- **Extension** – HAR capture (load & API testing), Export HAR, UI labels, README/ARCHITECTURE/CHROME_STORE_LISTING/manifest updated.
- **Docs** – `DEPLOYMENT-AND-PACKAGING-REFERENCE.md`, `RECORDER-SYNC-CHECKLIST.md`, extension capabilities (incl. HAR) documented.
- **OLLAMA off by default** – `docker-compose.full.yml`: ollama service and backend OLLAMA_URL commented; default `DEFAULT_LLM_PROVIDER=openai`. `helm/qaai/values.yaml`: `ollama.enabled: false`, backend env OLLAMA_URL commented. `docker-compose.air-gapped.yml`: header comment (air-gapped = OLLAMA required; SaaS = use full compose with cloud keys).
- **env.example** – Central list: DATABASE_URL, JWT_*, cloud LLM (OPENAI/ANTHROPIC), VITE_API_BASE_URL, Redis, S3, multi-tenant note; OLLAMA optional.
- **SaaS compliance (multi-tenant/RBAC)** – Section in `DEPLOYMENT-AND-PACKAGING-REFERENCE.md`: X-Tenant-ID / X-User-ID headers, JWT claims, tenants API, middleware files, @require_permission.
- **Extension action-coalescer** – `flowstral-extension/src/lib/action-coalescer-browser.js` added; wired in content.js (handleClick → process; STOP_RECORDING → flush). Dropdown trigger + option become single “Select X from Y” action.

---

## 3. What’s pending (for future work)

### 3.1 Deployment / infra

- [x] **OLLAMA “off by default” everywhere** – Done: compose (ollama commented), helm (enabled: false), env.example (cloud-only note).
- [x] **env.example** – Done: central list of env vars, cloud-only, OLLAMA optional.
- [x] **SaaS compliance (multi-tenant/RBAC)** – Done: documented in DEPLOYMENT-AND-PACKAGING-REFERENCE.md.

### 3.2 Extension ↔ desktop parity & approval

- [x] **Action coalescer in extension** – Done: `action-coalescer-browser.js`; wired in content.js (handleClick, STOP_RECORDING flush).
- [ ] **Recipe / ElementRecipe in extension** – Add element-recipe + recipe-recorder-integration (or shared script) so recording output matches desktop (see RECORDER-SYNC-CHECKLIST.md).
- [ ] **SF tools context in extension** – SF Context tab in sidepanel (e.g. when on Salesforce: SOQL/Metadata/Stage info or link to templates).
- [ ] **Merge test cases to recorder steps** – In extension: load test cases (storage or API), “Link to test case” / “Merge recording to steps,” save merged (same idea as desktop `mergeToStep` / automation-linking).
- [ ] **Playback from extension** – “Run on server” button: POST recorded steps to backend (e.g. flowstral_api or automation_api `execute-test`).

### 3.3 Optional

- [ ] **Strategy memory in extension** – Persist “last successful selector” per origin (e.g. chrome.storage) for smarter suggestions.
- [ ] **Shared npm package** – `@flowstral/recorder-core` (recorder-engine, coalescer, recipe) for desktop + extension to avoid copy-paste.

---

## 4. Deployment steps by type (quick reference)

### SaaS

1. Build backend: `docker build -t <registry>/qaai-backend:latest ./backend` (use `backend/Dockerfile`).
2. Build frontend: `docker build -f Dockerfile.frontend -t <registry>/qaai-frontend:latest .` (set `VITE_API_BASE_URL` if needed).
3. Provision DB (e.g. Supabase/RDS); run `supabase/migrations` or equivalent; set `DATABASE_URL`.
4. Deploy backend + frontend to your cloud (ECS, Cloud Run, App Service, etc.); set `JWT_SECRET`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
5. Frontend: point API URL to backend (build-time or runtime config).
6. Desktop: publish installers; set electron-updater URL. Extension: publish to Chrome Web Store or ship ZIP.

### PaaS (e.g. Kubernetes / Helm)

1. Build and push images: backend, frontend, test-worker (`backend/Dockerfile`, `Dockerfile.frontend`, `backend/Dockerfile.worker`).
2. `helm dependency update helm/qaai`; create `myvalues.yaml` (backend/frontend image, secrets, ingress host).
3. `helm install qaai helm/qaai -f myvalues.yaml`.
4. (Optional) Disable OLLAMA in values if using cloud LLM only.

### On-prem (docker-compose)

1. Copy `env.example` to `.env`; set `POSTGRES_PASSWORD`, `JWT_SECRET`, etc. (no OLLAMA required if cloud LLM).
2. Full stack: `docker-compose -f docker-compose.full.yml up -d`.
3. Air-gapped: `docker-compose -f docker-compose.air-gapped.yml up -d`. Comment out OLLAMA service if not used.
4. Desktop/extension: set `serverUrl` to on-prem backend URL.

### Extension (store / enterprise)

1. `cd flowstral-extension`; ensure manifest and icons are correct.
2. Zip folder (exclude `node_modules`, `.git`); upload to Chrome Web Store or distribute ZIP for enterprise.
3. Store listing: use `flowstral-extension/CHROME_STORE_LISTING.md`; mention HAR for load & API testing.

### Desktop (Electron)

1. From repo root: build webapp if needed; copy `dist` → `flowstral-desktop/webapp` (or use desktop’s `build:webapp`).
2. `cd flowstral-desktop`; `npm ci`; `npx playwright install chromium`.
3. `npm run build:win` | `build:mac` | `build:linux` → artifacts in `dist/`.
4. Sign/notarize for production (see electron-builder.config.js and flowstral-desktop DEPLOYMENT.md).

---

## 5. Key file locations (memory)

| What | Where |
|------|--------|
| **Recommendation & control plane vs client** | `docs/DEPLOYMENT-RECOMMENDATION-AND-CONTROL-PLANE.md` |
| Deployment options & packaging | `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md` |
| **This status & steps** | `docs/DEPLOYMENT-STATUS-AND-STEPS.md` |
| Recorder sync checklist (extension) | `docs/RECORDER-SYNC-CHECKLIST.md` |
| Backend Dockerfile | `backend/Dockerfile` |
| Frontend Dockerfile | `Dockerfile.frontend` (repo root) |
| Worker Dockerfile | `backend/Dockerfile.worker` |
| Compose full | `docker-compose.full.yml` |
| Compose air-gapped | `docker-compose.air-gapped.yml` |
| Helm chart | `helm/qaai/` |
| Tenant middleware | `backend/app/middleware/tenant_middleware.py` |
| RBAC middleware | `backend/app/middleware/rbac_middleware.py` |
| Tenants API | `backend/app/routers/tenants_api.py` |
| Extension HAR / network | `flowstral-extension/src/lib/network-capture.js` |
| Extension capabilities (store) | `flowstral-extension/CHROME_STORE_LISTING.md`, `manifest.json` description |

---

## 6. Updating this doc

When you:

- **Complete a pending item** – Check it off in §3 and add a short “Done” note in §2 if useful.
- **Change deployment approach** – Update §4 and, if needed, `DEPLOYMENT-AND-PACKAGING-REFERENCE.md`.
- **Add new pending work** – Add it under §3.2 or §3.3 with a clear checkbox.
- **Add new key files** – Add them to §5.

Keep this file as the single place for “what’s done, what’s pending, and what steps to run” so future sessions (and Cursor rules) can rely on it.
