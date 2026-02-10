# Shared Database, All Tabs from DB, and Tester Packaging

> **Purpose:** How to use Supabase/RDS so everything is stored in one place, all tabs (tests, cases, suites, plans, runs, defects) load from and save to the DB, and how to package the app so all testers see the same data (including in the Electron app).

---

## 1. Do You Need “AWS” in Addition to Supabase / RDS?

**Short answer: No.** Use **one** database as the source of truth.

| Option | What it is | When to use |
|--------|------------|-------------|
| **Supabase** | Hosted Postgres + auth + realtime + dashboard | Single Postgres; good for speed of setup and built-in auth. |
| **RDS (AWS)** | AWS managed PostgreSQL | You already have it; it *is* “AWS” for your DB. No need to “set up AWS too.” |
| **Both** | Two databases | Only if you use Supabase for one product and RDS for another. For QAAI, pick **one** and point the backend at it. |

**Recommendation:** If RDS is already set up, use **RDS** as the app database and set `DATABASE_URL` (or `POSTGRES_*`) to your RDS instance. If you prefer Supabase, use the Supabase Postgres connection string. Do not run two separate app databases for the same product.

---

## 2. Where Everything Is Stored (Backend + DB)

The backend exposes **one** API that the web app and Electron app call:

- Base URL: e.g. `https://your-backend.example.com` or `http://localhost:8000`
- All persistent data goes through **`/api/db/*`** (and other routers). The **database service** (today SQLite; Postgres when wired) is the single source of truth.

| Tab / Data | Backend endpoint(s) | Stored in DB |
|------------|---------------------|--------------|
| **Test cases** | `GET/POST/PUT/DELETE /api/db/test-cases` | ✅ test_cases |
| **Test suites** | `GET/POST/PUT/DELETE /api/db/test-suites` | ✅ test_suites |
| **Test plans** | `GET/POST/PUT/DELETE /api/db/test-plans` | ✅ test_plans |
| **Test runs** | `GET/POST/PUT/DELETE /api/db/test-runs` | ✅ test_runs |
| **Defects** | `GET/POST/PUT/DELETE /api/db/defects` | ✅ defects |
| **API collection** | `GET/PUT /api/db/api-collections/default` | ✅ api_collections |
| **Releases** | (no endpoint yet) | ❌ localStorage until you add a table + API |

So: **tests, test cases, suites, plans, runs, defects** are all intended to be **loaded from and saved to the DB** via the backend. The frontend (including Electron) should use the backend as primary and only fall back to localStorage when the backend is unavailable (e.g. offline).

---

## 3. Backend Database: SQLite vs Postgres (Supabase / RDS)

- **Today:** The app’s **database_service** uses **SQLite** by default. All `/api/db/*` data (test_cases, test_suites, test_runs, test_plans, defects, api_collections, etc.) is stored in one SQLite file.
- **For shared data across testers:** You need **one backend instance** talking to **one database**. That database can be:
  - **SQLite** (single file): fine for a small team if the backend runs on one server and everyone points to it.
  - **PostgreSQL (Supabase or RDS):** better for production, backups, and scaling. The codebase has `DATABASE_URL`, `postgres_direct.py`, and Supabase migrations; the **database_service** Repository layer still needs a Postgres implementation so that all `/api/db/*` reads/writes go to Postgres instead of SQLite when `DATABASE_URL` is set.

**Practical steps:**

1. **Keep using what you have:** If your backend currently runs with SQLite and is deployed on one server, all testers pointing at that server already share the same DB file. No extra “AWS setup” required for that.
2. **Move to Supabase or RDS:** When you want managed Postgres:
   - Use **one** of: Supabase Postgres **or** RDS.
   - Set `DATABASE_URL` (and optionally `DATABASE_TYPE=postgres`) on the backend.
   - Implement or enable the Postgres path in `database_service` so test_cases, test_suites, test_runs, test_plans, defects, api_collections, etc. use that connection. Until then, the backend will keep using SQLite.

---

## 4. All Tabs Load from DB / Save to DB

**Goal:** Tests tab, Suites, Plans, Runs, Defects (and API tab) all **load from the backend** and **save to the backend** so that every tester sees the same data.

**How it works:**

- **Backend** already exposes:
  - `GET /api/db/test-cases`, `GET /api/db/test-suites`, `GET /api/db/test-plans`, `GET /api/db/test-runs`, `GET /api/db/defects`
  - Corresponding `POST` / `PUT` / `DELETE` for create/update/delete.
- **Frontend (e.g. TestRepository):**
  - **On load:** Call these endpoints first; use the response to set state (test cases, suites, plans, runs, defects). Optionally fall back to localStorage if the backend is down.
  - **On create/update/delete:** Call the corresponding `POST` / `PUT` / `DELETE`, then update local state (and optionally stop persisting those entities to localStorage when backend is the source of truth).

Once this is in place, **all testers** using the same backend URL will see the same tests, suites, plans, runs, and defects. Same applies in the **Electron app** as long as it uses the same API base URL.

**Releases:** There is no `/api/db/releases` yet. Until you add a `releases` table and API, the Releases tab can continue to use localStorage or a separate store.

---

## 5. How Tester Packaging Works (Same Data for Everyone)

**Requirement:** All testers see the same tests and defects, including in the Electron app.

**Solution:** They all talk to **one backend**, which is connected to **one database** (Supabase or RDS or even one SQLite file on a server). No database installer on each tester machine.

### Option A: Central backend (recommended for “same data”)

1. **You run one backend** (e.g. on a server, or Docker, or a PaaS). Point it to **one** database:
   - **Supabase:** set `DATABASE_URL` to your Supabase Postgres URL.
   - **RDS:** set `DATABASE_URL` to your RDS Postgres URL.
2. **Give testers an installer** that contains **only the Electron app** (no DB, no backend). The app is **preconfigured** with your backend URL (e.g. `https://qaai.yourcompany.com` or `http://your-server:8000`).
3. Testers install and open the app; it loads and saves everything via your backend. **Same backend ⇒ same DB ⇒ same tests, suites, plans, runs, defects.**

So: **the “package” for testers is the Electron installer with a fixed backend URL.** You do **not** give them an “installer to set up the DB” on their PC. The DB lives on your side (Supabase or RDS).

### Option B: Team installs backend + DB (self‑hosted)

If a team wants to run everything on their own server:

1. You provide (or document) an installer or Docker setup that installs:
   - Backend (FastAPI)
   - One database (e.g. Postgres in Docker, or connection to their Supabase/RDS)
2. They set `DATABASE_URL` so the backend uses that Postgres.
3. They install the **Electron app** on each tester machine and set the app’s backend URL to that server.
4. Again: one backend + one DB ⇒ everyone sees the same data.

### Summary

| Question | Answer |
|----------|--------|
| Do testers install a DB? | **No.** For shared data, the DB runs once (on your server or Supabase/RDS). |
| What do testers install? | **Only the Electron app** (installer), configured to use your backend URL. |
| How do they all see the same tests/defects? | All clients (browser + Electron) use the **same backend URL**; backend reads/writes **one database**. |
| Do I need both Supabase and RDS? | **No.** Pick one. RDS is already “AWS” for DB. |
| Should I “set up AWS” in addition? | Only if you want to run the **backend** on AWS (e.g. ECS, Lambda). The **database** can be RDS (AWS) or Supabase; one is enough. |

---

## 6. Checklist: Everything Stored and Retrieved from DB

- [ ] **Backend** uses one database (SQLite for single-server, or Postgres via Supabase/RDS when implemented).
- [ ] **Test cases:** Frontend loads from `GET /api/db/test-cases`, saves via POST/PUT/DELETE.
- [ ] **Suites:** Load from `GET /api/db/test-suites`, save via POST/PUT/DELETE.
- [ ] **Plans:** Load from `GET /api/db/test-plans`, save via POST/PUT/DELETE.
- [ ] **Runs:** Load from `GET /api/db/test-runs`, save via POST/PUT/DELETE.
- [ ] **Defects:** Load from `GET /api/db/defects`, save via POST/PUT/DELETE.
- [ ] **API collection:** Already backend-backed via `GET/PUT /api/db/api-collections/default`.
- [ ] **Electron app:** Built with `API_BASE_URL` or equivalent pointing to your central backend (no localStorage as source of truth for the above).
- [ ] **Releases:** Either add `releases` table + `/api/db/releases` or keep localStorage for now.

---

## 7. References

- **Backend and packaging overview:** `docs/BACKEND-AND-PACKAGING-FOR-CUSTOMERS.md`
- **Deployment options (SaaS, PaaS, on‑prem):** `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md`
- **Database API:** `backend/app/routers/database_api.py`
- **Database service (SQLite/Postgres):** `backend/app/services/storage/database_service.py`
