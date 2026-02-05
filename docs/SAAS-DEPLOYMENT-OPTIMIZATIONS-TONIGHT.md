# SaaS-Ready Deployment Optimizations (Tonight + 20 Testers)

> **Purpose:** Cost-optimized structure for tonight’s SaaS rollout, all deployment options (API, Perf, Mobile, A11y, SF, etc.), desktop + extension, and how to track issues via traceable logs. Use with `DEPLOYMENT-PLAN-TONIGHT.md` and `RECORD-PLAYBACK-CORE-ARCHITECTURE.md`.

---

## 1. Deployment Options — Cost-Optimized Structure

### 1.1 Single control plane (recommended for 20 testers)

| Option | What runs where | Cost note |
|--------|------------------|-----------|
| **SaaS (tonight)** | One backend (API + Perf + A11y + SF + Mobile modules), one Postgres, one Redis (optional for workers), frontend static | Minimal: 1 backend instance, 1 DB, optional Redis. Scale workers only if needed. |
| **PaaS (K8s/Helm)** | Same stack in-cluster; backend + frontend + optional workers | Same app; pay for cluster + storage. Use Helm values to enable/disable modules. |
| **On-prem** | `docker-compose.full.yml`; all modules in one backend | No cloud spend; size the host for backend + DB + Redis. |

**Optimization:** Run **one backend** that serves all modules (API Testing, Performance, A11y, Mobile, Salesforce, Visual). No need for separate services per module; use **license/feature flags** to show/hide UI and gate heavy features (e.g. load tests, AI). This keeps tonight’s deploy simple and cost-low.

### 1.2 Per-module scaling (when you grow)

| Module | When to scale separately | Cost tip |
|--------|--------------------------|----------|
| **API** | Never for 20 users; single backend handles it | — |
| **Perf** | Only if you run 10k+ VUs or many concurrent load tests | Use Go runner or k6 workers; keep API in main backend. |
| **Mobile** | Device farm / emulators only if you add real device cloud | For tonight, desktop/extension + emulation is enough. |
| **A11y** | Single backend is enough | — |
| **SF (Salesforce)** | Same backend; token pool in-memory or Redis | — |
| **Visual** | Same backend; store baselines in S3/MinIO | — |

**Cost-optimized layout for tonight:**

- **Backend:** 1 instance (e.g. 2 CPU, 2–4 GB RAM) — runs API, Perf, A11y, SF, Mobile, Visual.
- **DB:** Managed Postgres (Supabase/RDS) or compose Postgres.
- **Redis:** Optional; only if you enable test workers or job queue.
- **Storage:** One S3/MinIO bucket for artifacts, screenshots, baselines.
- **Desktop + Extension:** Point `serverUrl` to the same backend; no extra servers.

### 1.3 Desktop app vs browser extension — single backend

| Client | Role | Backend usage |
|--------|------|----------------|
| **Desktop** | Full recorder + playback, all plugins (API, Perf, A11y, Mobile, SF) | Same backend URL; license validated via `/api/license/validate`. |
| **Extension** | Recording, HAR export, “Run on server” (optional) | Same backend URL; no separate deployment. |

**Efficient setup:**

- One `serverUrl` (e.g. `https://api.yourdomain.com`) for both desktop and extension.
- License server at same host: `POST /api/license/validate`, `/api/license/activate`.
- No duplicate services; desktop and extension are just two clients of the same API.

---

## 2. Record–Playback and Architecture (from RECORD-PLAYBACK-CORE-ARCHITECTURE)

- **Recording:** Desktop (`playwright-recorder.js`, `action-coalescer.js`) and extension (action-coalescer in browser) — both can target the same backend.
- **Playback:** Desktop only (Playwright + SmartFinder); extension can send steps to backend for “Run on server.”
- **Deployment impact:** No extra “record-playback server”; playback runs in desktop or in backend test workers. For 20 testers, one backend + desktop/extension clients is enough.

---

## 3. Issue Tracking — Traceable Logs

### 3.1 Backend (Python)

- **Request ID / Trace ID:** Every request gets a `trace_id` (and optional `request_id`) in middleware. All log lines for that request include `trace_id=...` so you can grep or filter in one place.
- **Structured logs:** Prefer one line per event with key=value or JSON (e.g. `trace_id=abc level=ERROR msg="..." module=license_api`). This allows log aggregators (CloudWatch, Datadog, Grafana Loki) to index and search.
- **Local logs:** Backend already uses `backend/logs/app.log` with rotation. Keep it; add trace_id to the formatter so every line is traceable.

### 3.2 Frontend / Desktop

- **Central logger:** Use a small `src/lib/trace-logger.ts` (or equivalent) that:
  - Generates a **session_id** per app load and **trace_id** per flow (e.g. test run, recording session).
  - Logs with format: `[trace_id] [session_id] level message`.
  - In dev: `console`; optionally send errors (or sampled events) to backend for issue tracking.
- **Cleanup:** Replace ad-hoc `console.log` in critical paths (e.g. recording, playback, license, API calls) with the trace logger so support can ask “what’s your trace_id?” and find the same flow in backend logs.

### 3.3 How testers report issues

1. **Backend error:** User gets or sees a `trace_id` (e.g. in error toast or Settings → Support).
2. **Frontend/desktop error:** Same; show `trace_id` / `session_id` in error UI or “Copy debug info.”
3. You search logs (or log aggregator) for that `trace_id` and get the full request + downstream logs.

---

## 4. License Server — 20 Users, 2-Week Trial

- **Endpoints (already in backend):**
  - `POST /api/license/validate` — validate key + device.
  - `POST /api/license/activate` — activate on device.
  - `POST /api/license/deactivate` — deactivate.
  - `GET /api/license/generate-trials?count=20&days=14` — returns 20 trial keys, 2-week expiry (add this for tonight).
- **Desktop:** Uses `serverUrl` + `/api/license/validate` and `/api/license/activate`; ensure backend mounts license router under `/api` so paths match.
- **Generated licenses:** Call `GET /api/license/generate-trials?count=20&days=14` (or run `python scripts/generate_trial_licenses.py https://api.yourdomain.com`) to get 20 keys; distribute to testers. Each key validates offline (checksum) or online (same backend); 2-week expiry encoded in key.

---

## 5. Checklist for Tonight (20 resources)

| Item | Action |
|------|--------|
| Backend | Deploy one backend with all modules; set `JWT_SECRET`, `DATABASE_URL`, LLM keys. |
| License | Mount license API under `/api`; call `GET /api/license/generate-trials?count=20&days=14` and share keys. |
| Desktop | Build from `flowstral-desktop`; set `serverUrl` to backend; testers enter license key. |
| Extension | Package; set backend URL in options; same backend as desktop. |
| Logs | Enable trace_id in backend logs; add trace logger in frontend; reduce noisy console.log. |
| Docs | Share `DEPLOYMENT-PLAN-TONIGHT.md` + this doc + link to Record–Playback architecture. |

---

## 6. Quick reference — key files

| What | Where |
|------|--------|
| Deployment runbook | `docs/DEPLOYMENT-PLAN-TONIGHT.md` |
| Record–Playback architecture | `docs/RECORD-PLAYBACK-CORE-ARCHITECTURE.md` |
| License API | `backend/app/routers/license_api.py` |
| Desktop license client | `flowstral-desktop/src/main/license.js` |
| Backend logging | `backend/app/main.py` (log config), trace_id middleware (to add) |
| Frontend trace logger | `src/lib/trace-logger.ts` (to add) |

Use this for a cost-optimized, SaaS-ready deploy tonight with 20 testers and traceable issue tracking.
