# Backend Stack and Packaging for Customers

> **Purpose:** Clarify what the QAAI backend is, how data is stored (SQLite vs PostgreSQL), and how to package the product for customer delivery.

---

## 1. What Is Our Backend?

The QAAI backend is a **FastAPI** application that provides:

- **REST API** for the web app and desktop client (test cases, test runs, API testing, performance, accessibility, etc.).
- **Database-backed storage** for test cases, test suites, test runs, API collections, environments, and other entities.
- **Execution engines** for API tests, Playwright/UI tests, and performance tests.

**Relevant pieces:**

| Component | Role |
|-----------|------|
| **FastAPI app** | `backend/app/main.py` – mounts all routers, CORS, lifespan. |
| **Database service** | `backend/app/services/storage/database_service.py` – single service for SQLite (and future Postgres) with repositories for each entity. |
| **Database API** | `backend/app/routers/database_api.py` – REST at `/api/db/*` for test_cases, test_suites, test_runs, **api_collections**, etc. |
| **API testing** | `backend/app/services/api_testing/` – execution, assertions, environments. |

**Important:** All persistent data that the UI needs (including the **API Testing** tab collection) is intended to be **stored and retrieved from the backend**, not from browser localStorage. The API Testing tab loads and saves the default collection via:

- `GET /api/db/api-collections/default` – load
- `PUT /api/db/api-collections/default` – save (payload = full test suite JSON)

---

## 2. SQLite vs PostgreSQL

### Current State

- **Default:** The app uses **SQLite** when `DATABASE_TYPE` is not set or is `sqlite`.
  - Config: `SQLITE_PATH` (default `data/qaai.db`).
  - All tables (test_cases, test_suites, test_runs, **api_collections**, etc.) are created and used via `database_service.py`.
- **PostgreSQL:** The codebase references Postgres (`POSTGRES_URL` / `DATABASE_URL`, `postgres_direct.py`) and the deployment docs assume Postgres for production. However, the main **database_service** Repository layer currently uses SQLite only; a Postgres implementation for the same entities is not fully wired. So in practice, **today’s single-node and desktop packaging use SQLite**.

### When to Use Which

| Scenario | Recommendation |
|----------|----------------|
| **Development / single user** | SQLite – no extra setup; one file `data/qaai.db`. |
| **Desktop app bundled for customers** | SQLite – backend can ship with the app; DB file in user data dir. |
| **Production / multi-user / SaaS** | **PostgreSQL** – scale, concurrency, backups. Requires implementing the Postgres path in `database_service` (or using a separate Postgres client for the same schema). |
| **AWS / cloud** | Use a managed Postgres (RDS, Aurora) and set `DATABASE_URL` once the backend supports it for all entities. |

So: **Postgres is the right choice for production and when you need multi-user scale; SQLite is fine for one-box and packaged desktop delivery.** Expanding to AWS or Postgres is the right direction for hosted/production; for “packaged for customers” (e.g. desktop + backend + DB), SQLite is acceptable and keeps deployment simple.

---

## 3. Packaging for Customers

To ship a single “product” to customers (e.g. desktop app + backend + data):

1. **Backend**  
   - Run the FastAPI backend (e.g. `uvicorn app.main:app`) with `DATABASE_TYPE=sqlite` and `SQLITE_PATH` pointing to a persistent path (e.g. user data directory).

2. **Database**  
   - No separate DB server: SQLite uses a single file. Ensure the process has write access to `SQLITE_PATH` (e.g. `%APPDATA%/QAAI/qaai.db` on Windows).

3. **Desktop client**  
   - Build the Electron app (e.g. from `flowstral-desktop`: `npm run build:webapp` then `npm run build:win`). Configure it so the frontend’s API base URL points to the bundled or co-installed backend (e.g. `http://localhost:8000` when the backend runs locally).

4. **What gets packaged**  
   - **Option A:** Installer includes backend (Python + deps or a single executable e.g. PyInstaller) + Electron app; backend starts as a local service when the app starts.  
   - **Option B:** Backend and desktop are separate installers; customer runs the backend on a server and points the desktop to that URL.

For **Option A**, all data (test cases, API collection, test runs, etc.) lives in the backend’s SQLite file; no reliance on localStorage. For **Option B**, the same applies, with the backend (and optionally Postgres) running in the customer’s environment.

---

## 4. API Collections (API Tab) – Backend as Source of Truth

The API Testing tab no longer persists the test suite in **localStorage**. It:

- **Loads** the default collection on mount: `GET /api/db/api-collections/default` → `response.payload` is the full suite (test_cases, folders, base_url, etc.).
- **Saves** changes to the backend (debounced): `PUT /api/db/api-collections/default` with body `{ "payload": testSuite }`.

So current and previous sessions are always **retrieved from and stored in the backend** (table `api_collections`, id `default`). This applies whether the backend uses SQLite or, in the future, PostgreSQL.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| **What is our backend?** | FastAPI app + `database_service` (SQLite by default) + `/api/db` and other routers. |
| **SQLite or Postgres?** | SQLite for dev and packaged desktop; expand to **Postgres** (and optionally AWS) for production/multi-user. |
| **Where is the API tab collection stored?** | Backend only: `api_collections` table, GET/PUT `/api/db/api-collections/default`. |
| **How to package for customers?** | Backend + SQLite (or Postgres) + env vars; bundle backend with desktop (Option A) or run backend separately (Option B). |

- **Shared DB and tester packaging:** For “all testers see the same data,” one backend + one DB (Supabase or RDS), and Electron installer with backend URL only: see **`docs/SHARED-DB-AND-TESTER-PACKAGING.md`**.
- **Deployment:** For more deployment detail (SaaS, PaaS, on-prem, Docker), see **`docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md`**.
