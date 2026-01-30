# QAAI / Flowstral: Deployment Recommendation & Control Plane vs Client

> **Purpose:** Recommended deployment for this tool, what runs in the **control plane** vs on the **client**, and step-by-step reference for SaaS and PaaS.  
> **See also:** `docs/DEPLOYMENT-STATUS-AND-STEPS.md`, `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md`.

---

## 1. Best deployment recommendation for this tool

QAAI/Flowstral is a **QA automation platform** with recording (desktop + extension), playback (desktop + optional server-side workers), LLM features, multi-tenant/RBAC, test runs, and artifacts. Given that:

| Scenario | Recommended option | Why |
|----------|--------------------|-----|
| **Product / commercial SaaS** | **SaaS** | Single control plane; users get desktop + extension + web UI; no infra for customers; fast iteration. |
| **Enterprise self-host (same stack as SaaS)** | **PaaS (K8s/Helm)** | Same control plane, deployed in customer cloud or your K8s; compliance and data residency. |
| **Air-gapped / regulated** | **On-prem (docker-compose)** | Full control plane in customer DC; OLLAMA for LLM; no cloud dependency. |
| **Hybrid (e.g. cloud UI + on-prem workers)** | **Hybrid** | Control plane in cloud; workers or recorders on-prem; use when data must stay on-prem but orchestration can be cloud. |

**Default recommendation:** **SaaS** for most teams (control plane in your cloud, cloud LLM, clients are desktop + extension + browser). Use **PaaS (Helm)** when an enterprise wants to self-host the same architecture. Use **on-prem** only when network or policy requires it.

---

## 2. Control plane vs client side (SaaS and PaaS)

The same **split** applies to both SaaS and PaaS; only *where* the control plane runs differs (your cloud vs customer K8s).

### 2.1 Control plane (your infrastructure)

**Definition:** Services you deploy and operate. They hold state, enforce tenant/RBAC, run LLM/workers, and serve the web app.

| Component | Responsibility | Typical location |
|-----------|----------------|------------------|
| **Backend API** | Auth, tenant/RBAC, test cases/runs, orchestration, LLM gateway, flowstral/automation APIs | Your cloud or K8s |
| **Database** | Test cases, runs, projects, tenants, RBAC, artifacts metadata | Managed Postgres (SaaS) or in-cluster (PaaS) |
| **Redis** | Queues, cache, session (if used) | Managed Redis or in-cluster |
| **Object storage** | Artifacts, screenshots, HAR, reports | S3/GCS/Azure Blob or MinIO |
| **LLM** | OpenAI/Anthropic (or OLLAMA if on-prem); model gateway in backend | Cloud API keys; backend calls LLM |
| **Test workers** | Run Playwright tests (when “run on server” or scheduled runs) | Optional; same cloud or K8s as backend |
| **Frontend (web app)** | Dashboard, test builder, runs UI, settings | Static host (Vercel/Netlify) or in-cluster |
| **Tenant / RBAC** | Tenants API, middleware (X-Tenant-ID, JWT), permissions | Backend |

**Summary:** API + DB + Redis + storage + (optional) workers + web app = **control plane**. All of this is **server-side**.

### 2.2 Client side (user devices / browser)

**Definition:** What runs on the user’s machine or in the browser. No direct DB/queue access; everything goes through the API (or stays local).

| Component | Responsibility | Control plane interaction |
|------------|----------------|----------------------------|
| **Desktop app (Electron)** | Recording (Playwright browser), **local playback**, test builder UI (embedded web app), optional sync to backend | Optional: auth, sync test cases/runs, “run on server” (POST steps to API) |
| **Browser extension** | Recording in any tab, HAR capture, export script; optional “Run on server” | Optional: auth, send recording to API, run test via API |
| **Web app (browser)** | Dashboard, test builder, viewing runs, settings | **Always:** all data via API; auth (JWT/session) |

**Summary:** **Recording** and **local playback** (desktop) stay on the client. **Orchestration, storage, multi-tenant, and server-side test execution** stay in the control plane.

### 2.3 Visual split

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE (you deploy)                            │
│  ┌─────────────┐  ┌──────────┐  ┌───────┐  ┌─────────┐  ┌──────────────┐   │
│  │ Backend API │  │ Postgres │  │ Redis │  │ Storage │  │ Web frontend  │   │
│  │ (tenant,    │  │ (state)  │  │(queue)│  │(artifacts)│  │ (dashboard)  │   │
│  │  RBAC, LLM) │  │          │  │       │  │         │  │              │   │
│  └──────┬──────┘  └──────────┘  └───────┘  └─────────┘  └──────┬───────┘   │
│         │                                                         │          │
│  ┌──────┴────────────────────────────────────────────────────────┴───────┐   │
│  │ Optional: Test workers (Playwright run on server)                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │                              │
         │ HTTPS / WSS                  │ HTTPS
         ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│   CLIENT: Desktop    │      │   CLIENT: Browser    │      │   CLIENT: Web   │
│   • Record (local)   │      │   • Extension record │      │   • Dashboard    │
│   • Playback (local) │      │   • HAR export       │      │   • Test builder │
│   • Sync → API       │      │   • Run on server →  │      │   • All via API  │
│                     │      │     API              │      │                 │
└─────────────────────┘      └─────────────────────┘      └─────────────────┘
```

---

## 3. SaaS: control plane + client + steps

### 3.1 What lives where (SaaS)

| Layer | What | Where |
|-------|------|--------|
| **Control plane** | Backend API, Postgres, Redis, S3 (or Supabase), web frontend, (optional) test workers | Your cloud (e.g. AWS, GCP, Azure) |
| **Client** | Desktop app, extension, user’s browser (web app) | User devices; web app loads from your static host |

### 3.2 SaaS deployment steps (ordered)

1. **Provision control plane – database**  
   Create Postgres (Supabase, RDS, Cloud SQL). Run migrations from `supabase/migrations`. Note `DATABASE_URL`.

2. **Provision control plane – Redis (optional)**  
   Create Redis (ElastiCache, Memorystore, or managed Redis). Note `REDIS_URL`.

3. **Provision control plane – object storage**  
   Create bucket (S3/GCS/Azure Blob or Supabase Storage). Note `S3_*` or equivalent. Backend stores artifacts here.

4. **Build and deploy backend (control plane)**  
   - Build: `docker build -t <registry>/qaai-backend:latest ./backend` (use `backend/Dockerfile`).  
   - Deploy to ECS/Cloud Run/App Service with env: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, `REDIS_URL`, `S3_*`.  
   - No OLLAMA required; use cloud LLM only.

5. **Build and deploy web frontend (control plane)**  
   - Build: `docker build -f Dockerfile.frontend -t <registry>/qaai-frontend:latest .` with `VITE_API_BASE_URL=https://api.yourdomain.com` (or your backend URL).  
   - Deploy to Vercel/Netlify or serve from same cloud (e.g. CloudFront + S3).  
   - Ensure `VITE_API_BASE_URL` points to the backend API.

6. **Configure auth and multi-tenant**  
   - Issue JWTs with `tenant_id` and `user_id` (or use API keys with `X-Tenant-ID` / `X-User-ID`).  
   - Use Tenants API for provisioning; protect routes with `@require_permission` if needed.  
   - See `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md` § SaaS compliance (multi-tenant/RBAC).

7. **Optional: test workers (control plane)**  
   - Build worker: `docker build -f backend/Dockerfile.worker -t <registry>/qaai-worker:latest ./backend`.  
   - Run workers that connect to same `DATABASE_URL`, `REDIS_URL`, and backend URL. Used for “run on server” and scheduled runs.

8. **Client – desktop**  
   - Build desktop (see `docs/DEPLOYMENT-STATUS-AND-STEPS.md` § Desktop).  
   - Publish installers; set electron-updater URL.  
   - Users install; configure `serverUrl` to your API (or ship with default).

9. **Client – extension**  
   - Package extension; publish to Chrome Web Store or ship ZIP.  
   - Users set backend URL in extension options (or ship default) for “Run on server” and sync.

10. **Client – web app**  
    - Users open your frontend URL in the browser; all actions go through the API (control plane).

---

## 4. PaaS (K8s/Helm): control plane + client + steps

### 4.1 What lives where (PaaS)

| Layer | What | Where |
|-------|------|--------|
| **Control plane** | Same as SaaS (API, Postgres, Redis, MinIO, frontend, workers) | Kubernetes cluster (your or customer’s); Helm chart `helm/qaai/` |
| **Client** | Same as SaaS: desktop, extension, browser | User devices; web app is served from ingress |

### 4.2 PaaS deployment steps (ordered)

1. **Prerequisites**  
   - Kubernetes cluster and `kubectl` configured.  
   - Container registry for images (e.g. GCR, ECR, ACR).

2. **Build and push control plane images**  
   - Backend: `docker build -t <registry>/qaai-backend:latest ./backend`; push.  
   - Frontend: `docker build -f Dockerfile.frontend -t <registry>/qaai-frontend:latest .` (set `VITE_API_BASE_URL` to backend URL); push.  
   - Worker (optional): `docker build -f backend/Dockerfile.worker -t <registry>/qaai-worker:latest ./backend`; push.

3. **Helm values**  
   - Copy `helm/qaai/values.yaml` to `myvalues.yaml`.  
   - Set `backend.image.repository` and tag; same for frontend and workers if used.  
   - Set Postgres/MinIO/Redis auth (or use existing secrets).  
   - Set `ingress.hosts` and TLS (e.g. `qaai.customer.com`).  
   - Keep `ollama.enabled: false` and use cloud LLM (set backend env `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` via secrets).

4. **Install control plane**  
   - `helm dependency update helm/qaai`  
   - `helm install qaai helm/qaai -f myvalues.yaml`  
   - Confirm backend, frontend, Postgres, Redis, MinIO (and optionally workers) are running; ingress is reachable.

5. **Configure auth and multi-tenant**  
   - Same as SaaS: JWTs or API keys with `X-Tenant-ID` / `X-User-ID`; Tenants API; `@require_permission` where needed.

6. **Client – desktop and extension**  
   - Same as SaaS: ship desktop installers and extension with `serverUrl` (or default) pointing to PaaS ingress URL (e.g. `https://qaai.customer.com`).

7. **Client – web app**  
   - Users open the ingress URL; frontend is served from the cluster; all API calls go to backend in the same cluster.

---

## 5. Quick reference: control plane vs client

| Concern | Control plane | Client |
|---------|----------------|--------|
| **Where** | Your cloud or K8s | User machine / browser |
| **API** | Host and run | Call only |
| **DB / Redis / Storage** | Run and own | No direct access |
| **Tenant / RBAC** | Enforced in API | Send JWT or headers |
| **LLM** | Backend calls OpenAI/Anthropic | No direct LLM |
| **Recording** | — | Desktop + extension |
| **Playback** | Optional (workers) | Desktop (local) |
| **Web UI** | Serve static app | Browser loads it |
| **Test cases / runs** | Stored in DB | Read/write via API |

---

## 6. Doc index (easy reference)

| Doc | Use for |
|-----|---------|
| **docs/DEPLOYMENT-RECOMMENDATION-AND-CONTROL-PLANE.md** (this file) | Recommendation, control plane vs client, SaaS/PaaS steps |
| **docs/DEPLOYMENT-STATUS-AND-STEPS.md** | What’s done vs pending, all deployment types, key file locations |
| **docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md** | Full options (SaaS, PaaS, hybrid, on-prem), recorder parity, packaging tools |
| **docs/RECORDER-SYNC-CHECKLIST.md** | Extension ↔ desktop recorder sync |
| **env.example** | Env vars; cloud-only default |

---

## 7. When to update this doc

- **New deployment option** – Add a section and keep §1 recommendation and §2 split in mind.  
- **Component moves** (e.g. playback to control plane only) – Update §2 and §5.  
- **New control plane service** (e.g. separate auth service) – Add to §2.1 and steps.  
- **New client** (e.g. CLI) – Add to §2.2 and steps.

Keep this file as the single place for **recommendation**, **control plane vs client**, and **SaaS/PaaS steps** for easy reference.
