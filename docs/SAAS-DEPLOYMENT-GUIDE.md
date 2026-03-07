# Flowstral SaaS Deployment Guide

> **Purpose:** Step-by-step guide for deploying the Flowstral QA Platform as a fully managed SaaS service using Vercel, Railway, and Supabase.
> Last updated: 2026-02-23

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Supabase Setup](#step-1-supabase-setup)
4. [Step 2: Railway Backend Deployment](#step-2-railway-backend-deployment)
5. [Step 3: Vercel Frontend Deployment](#step-3-vercel-frontend-deployment)
6. [Step 4: Domain and DNS Setup](#step-4-domain-and-dns-setup)
7. [Step 5: Environment Variable Reference](#step-5-environment-variable-reference)
8. [Step 6: Post-Deployment Verification](#step-6-post-deployment-verification)
9. [Step 7: Monitoring and Alerting](#step-7-monitoring-and-alerting)
10. [Step 8: Scaling Guidelines](#step-8-scaling-guidelines)
11. [Step 9: CI/CD Integration](#step-9-cicd-integration)
12. [Step 10: Backup and Disaster Recovery](#step-10-backup-and-disaster-recovery)
13. [Cost Estimation](#cost-estimation)
14. [Security Checklist](#security-checklist)
15. [Chrome Web Store Publishing (v3.14.0)](#chrome-web-store-publishing-v3140)
16. [Client Demo Quick Setup](#client-demo-quick-setup)
17. [Troubleshooting](#troubleshooting)
18. [Pre-Deployment Security Checklist](#pre-deployment-security-checklist)

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────────┐
                        │              End Users                       │
                        │  (Browser / Desktop App / Chrome Extension)  │
                        └──────────────┬──────────────────────────────┘
                                       │
                              HTTPS / WSS
                                       │
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
               ▼                       ▼                       ▼
   ┌───────────────────┐  ┌────────────────────┐  ┌──────────────────┐
   │   Vercel (CDN)    │  │  Railway (Backend)  │  │  Supabase        │
   │                   │  │                     │  │                  │
   │  React SPA        │  │  FastAPI + Uvicorn  │  │  PostgreSQL 16   │
   │  Static assets    │  │  Python 3.10        │  │  Auth (JWT)      │
   │  Edge network     │  │  Playwright workers │  │  Storage (S3)    │
   │  app.flowstral.com│  │  api.flowstral.com  │  │  Realtime (WS)   │
   └───────────────────┘  └─────────┬───────────┘  └──────────────────┘
                                    │
                          ┌─────────┼─────────┐
                          │         │         │
                          ▼         ▼         ▼
                    ┌──────────┐ ┌──────┐ ┌──────────┐
                    │ OpenAI   │ │Redis │ │Supabase  │
                    │ API      │ │(Rail)│ │PostgreSQL│
                    │gpt-4o-   │ │      │ │          │
                    │mini      │ │Queue │ │Data +    │
                    │          │ │Cache │ │Migrations│
                    └──────────┘ └──────┘ └──────────┘
```

### Service Responsibilities

| Service | Domain | Purpose |
|---------|--------|---------|
| **Vercel** | `app.flowstral.com` | Static frontend hosting with global CDN, SPA routing, security headers |
| **Railway** | `api.flowstral.com` | FastAPI backend, WebSocket support, test execution workers, AI orchestration |
| **Supabase** | `hgnqricmdqbreekmqpov.supabase.co` | PostgreSQL 16 database, JWT auth, file storage for test artifacts |
| **Railway Redis** | Internal | Job queue (test execution), caching, session state |
| **OpenAI** | External API | gpt-4o-mini for test generation, rewrites, AI self-healing |
| **Anthropic** | External API (optional) | Claude for prompt caching, advanced reasoning |

### Current Production URLs

| Service | URL |
|---------|-----|
| Backend API | `https://qaone-production.up.railway.app` |
| Supabase Project | `https://hgnqricmdqbreekmqpov.supabase.co` |
| Frontend | Vercel deployment (configure custom domain) |
| Health Check | `https://qaone-production.up.railway.app/health` |

---

## Prerequisites

Before starting deployment, ensure you have:

- [ ] GitHub account with access to `maddynolan/QAOne` repository
- [ ] Vercel account (free tier works for initial setup; Pro recommended for production)
- [ ] Railway account (Pro plan recommended: $20/month)
- [ ] Supabase account with a project created
- [ ] OpenAI API key with billing enabled
- [ ] Domain name for custom domains (optional but recommended)
- [ ] Node.js 20+ and npm installed locally (for testing builds)
- [ ] Python 3.10+ installed locally (for testing backend)

---

## Step 1: Supabase Setup

Supabase provides the PostgreSQL database, authentication, and file storage.

### 1.1 Create a New Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Fill in:
   - **Organization:** Select or create one
   - **Project name:** `flowstral-production` (or your preferred name)
   - **Database password:** Generate a strong password and save it securely
   - **Region:** Choose the closest to your primary users (e.g., `us-east-1` for US, `eu-west-1` for Europe)
4. Click **Create new project** and wait for provisioning (1-2 minutes)

### 1.2 Note Your Credentials

From the Supabase dashboard, navigate to **Settings > API** and record:

| Credential | Where to Find | Example |
|------------|---------------|---------|
| **Project URL** | Settings > API > Project URL | `https://hgnqricmdqbreekmqpov.supabase.co` |
| **Anon (public) key** | Settings > API > Project API keys > anon | `eyJhbGciOiJIUzI1NiIs...` |
| **Service role key** | Settings > API > Project API keys > service_role | `eyJhbGciOiJIUzI1NiIs...` (keep secret) |
| **Database URL** | Settings > Database > Connection string > URI | `postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres` |
| **Project ID** | Settings > General | `hgnqricmdqbreekmqpov` |

**Important:** The service role key bypasses Row Level Security (RLS). Never expose it in frontend code. It is only used server-side (Railway backend).

### 1.3 Run Database Migrations

The Flowstral schema is defined in 34 migration files under `supabase/migrations/`. Apply them in order:

**Option A: Using Supabase CLI (recommended)**

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref hgnqricmdqbreekmqpov

# Push all migrations
supabase db push
```

**Option B: Using the SQL Editor in Supabase Dashboard**

1. Navigate to **SQL Editor** in your Supabase dashboard
2. Execute each migration file in numerical order:
   - `001_initial_schema.sql` -- Core tables (test_cases, test_runs, users)
   - `002_ai_generations.sql` -- AI generation tracking
   - `003_ai_templates.sql` -- AI prompt templates
   - `004_requirements_table.sql` -- Requirements management
   - ... through `034_ai_settings.sql` (BYOK AI settings, usage tracking)
3. Verify each migration completes without errors

**Migration files location:** `supabase/migrations/`

### 1.4 Configure Authentication

1. Go to **Authentication > Providers** in Supabase dashboard
2. **Email/Password:** Enabled by default. Configure:
   - Confirm email: Enable for production
   - Minimum password length: 8 (recommended: 12)
3. **OAuth Providers (optional):**
   - Google: Add Client ID and Secret from Google Cloud Console
   - GitHub: Add Client ID and Secret from GitHub Developer Settings
4. **URL Configuration** (Authentication > URL Configuration):
   - Site URL: `https://app.flowstral.com` (your frontend domain)
   - Redirect URLs: Add `https://app.flowstral.com/**`

### 1.5 Set Up Storage Buckets

Navigate to **Storage** in the Supabase dashboard and create buckets for test artifacts:

```sql
-- Run in SQL Editor to create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('test-artifacts', 'test-artifacts', false, 52428800, ARRAY['image/png', 'image/jpeg', 'application/pdf', 'application/json', 'text/plain', 'text/html', 'application/zip']),
  ('screenshots', 'screenshots', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('visual-baselines', 'visual-baselines', false, 10485760, ARRAY['image/png', 'image/jpeg']),
  ('recordings', 'recordings', false, 104857600, ARRAY['application/json', 'application/zip', 'video/webm']);
```

Set RLS policies on each bucket:

```sql
-- Allow authenticated users to read their own artifacts
CREATE POLICY "Users can read own artifacts" ON storage.objects
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to upload artifacts
CREATE POLICY "Users can upload artifacts" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### 1.6 Enable Realtime (Optional)

If you need real-time database subscriptions (used by the dashboard):

1. Go to **Database > Replication**
2. Enable replication for tables: `test_runs`, `test_cases`, `defects`

---

## Step 2: Railway Backend Deployment

Railway hosts the FastAPI backend, Redis, and optional test execution workers.

### 2.1 Create a Railway Project

1. Go to [https://railway.app/dashboard](https://railway.app/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Connect your GitHub account and select `maddynolan/QAOne`
5. Railway will auto-detect the project. You will configure build settings next.

### 2.2 Configure the Backend Service

In the Railway dashboard for your service:

**Settings tab:**

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Watch Paths** | `backend/**` |
| **Healthcheck Path** | `/health` |
| **Restart Policy** | On failure (with backoff) |

Alternatively, Railway can use the existing `backend/Dockerfile` for a Docker-based deploy:

**Settings tab (Docker mode):**

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Dockerfile Path** | `Dockerfile` |
| **Watch Paths** | `backend/**` |

The Dockerfile already includes a healthcheck, non-root user, and uvicorn start command.

### 2.3 Add Redis

1. In your Railway project, click **New Service > Database > Redis**
2. Railway provisions a Redis instance and sets `REDIS_URL` automatically
3. Note the `REDIS_URL` from the Redis service variables (format: `redis://default:password@host:port`)

### 2.4 Set Environment Variables

In the Railway backend service, go to **Variables** and add:

```env
# Database (from Supabase Step 1.2)
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.hgnqricmdqbreekmqpov.supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://hgnqricmdqbreekmqpov.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Redis (auto-set by Railway if using their Redis add-on)
# REDIS_URL=redis://default:...@...railway.internal:6379

# AI / LLM (AI is OFF by default -- users opt-in via Settings > AI tab)
# Server-provided fallback keys (optional). Used when an org has no BYOK key.
# OPENAI_API_KEY=sk-proj-[your-key]
# ANTHROPIC_API_KEY=sk-ant-[your-key]
OPENAI_TEST_CASE_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=2000
TEST_CASE_LLM_PROVIDER=auto
DEFAULT_LLM_PROVIDER=openai

# BYOK Key Encryption (required for users to store their own AI keys)
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=[generate-a-fernet-key]

# Application
PYTHONPATH=/app
PYTHONUNBUFFERED=1
TRACK_LLM_USAGE=true

# CORS - must match your frontend domain
CORS_ALLOWED_ORIGINS=https://app.flowstral.com,https://flowstral.com

# Security
JWT_SECRET_KEY=[generate-a-strong-random-key-64-chars]
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Air-gapped mode (keep false for SaaS)
AIR_GAPPED_MODE=false
```

**Generate strong secrets:**

```bash
# Generate JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Generate ENCRYPTION_KEY (Fernet key for BYOK API key encryption)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate INTERNAL_SERVICE_KEY
openssl rand -hex 32

# Generate REDIS_PASSWORD
openssl rand -base64 24
```

### 2.5 Add Custom Domain

1. In Railway service settings, go to **Networking > Custom Domain**
2. Add `api.flowstral.com`
3. Railway provides a CNAME target (e.g., `your-service.up.railway.app`)
4. Add the CNAME record in your DNS provider (see Step 4)
5. Railway auto-provisions an SSL certificate

### 2.6 Verify Backend Deployment

```bash
# Health check
curl https://api.flowstral.com/health

# Expected response:
# {"status": "healthy", "version": "...", "database": "connected"}

# Test AI service
curl https://api.flowstral.com/api/ai-testing/status

# Test dashboard
curl https://api.flowstral.com/dashboard/stats
```

### 2.7 Optional: Add Test Execution Workers

For heavy automated test execution, deploy separate worker instances:

1. In Railway, add a new service from the same repo
2. Set Root Directory to `backend`
3. Use `Dockerfile.worker` as the Dockerfile path
4. Set environment variables:

```env
DATABASE_URL=[same as backend]
REDIS_URL=[same as backend]
WORKER_ID=worker-1
WORKER_CAPACITY=5
PYTHONPATH=/app
PYTHONUNBUFFERED=1
```

Workers pull test execution jobs from the Redis queue and run them using Playwright in headless mode. Scale by adding more worker replicas in Railway.

---

## Step 3: Vercel Frontend Deployment

Vercel hosts the React frontend as a static SPA with global CDN distribution.

### 3.1 Connect to Vercel

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **Add New > Project**
3. Import `maddynolan/QAOne` from GitHub
4. Vercel auto-detects the framework. Confirm settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 20.x |

The project already includes a `vercel.json` with SPA rewrites and security headers:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api/.*).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' https:; frame-ancestors 'none'" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 3.2 Set Environment Variables

In the Vercel project settings, go to **Settings > Environment Variables** and add:

```env
# Backend API URL (Railway)
VITE_API_BASE_URL=https://api.flowstral.com
VITE_API_URL=https://api.flowstral.com

# Supabase (public keys only -- safe for frontend)
VITE_SUPABASE_URL=https://hgnqricmdqbreekmqpov.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[your-supabase-anon-key]
VITE_SUPABASE_PROJECT_ID=hgnqricmdqbreekmqpov

# Web Analytics (optional -- leave empty to disable)
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CLARITY_PROJECT_ID=abc123xyz
VITE_CRISP_WEBSITE_ID=[your-crisp-website-id]

# LLM Provider hint for frontend
TEST_CASE_LLM_PROVIDER=auto
```

**Important:** Only `VITE_`-prefixed variables are embedded in the build output and accessible in the browser. Never prefix sensitive keys (like `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY`) with `VITE_`.

### 3.3 Configure Environments

Vercel supports environment-specific variables. Set up:

| Environment | `VITE_API_BASE_URL` | Purpose |
|-------------|---------------------|---------|
| **Production** | `https://api.flowstral.com` | Live users |
| **Preview** | `https://api-staging.flowstral.com` | PR previews, testing |
| **Development** | `http://localhost:8000` | Local dev |

### 3.4 Add Custom Domain

1. In Vercel project settings, go to **Domains**
2. Add `app.flowstral.com` (or `flowstral.com` for root domain)
3. Vercel provides DNS records to configure (see Step 4)
4. SSL is auto-provisioned by Vercel

### 3.5 Verify Frontend Deployment

1. Navigate to your Vercel deployment URL
2. Confirm the app loads without console errors
3. Verify API connectivity by checking the dashboard loads data
4. Test authentication flow (sign up / sign in)

---

## Step 4: Domain and DNS Setup

### 4.1 Recommended Domain Structure

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `flowstral.com` | Vercel | Marketing / landing page |
| `app.flowstral.com` | Vercel | Main application SPA |
| `api.flowstral.com` | Railway | Backend API |
| `docs.flowstral.com` | (optional) | Documentation site |

### 4.2 DNS Records

Add these records at your DNS provider (Cloudflare, Namecheap, Route 53, etc.):

```
# Frontend (Vercel)
# Vercel provides the exact values when you add the domain
Type    Name    Value                           TTL
A       @       76.76.21.21                     300
CNAME   app     cname.vercel-dns.com            300
CNAME   www     cname.vercel-dns.com            300

# Backend (Railway)
# Railway provides the CNAME target when you add a custom domain
CNAME   api     your-service.up.railway.app     300

# Supabase (no DNS needed -- uses supabase.co subdomain)
```

### 4.3 SSL Certificates

Both Vercel and Railway auto-provision and renew SSL certificates via Let's Encrypt. No manual certificate management is required.

### 4.4 CORS Configuration

The backend must allow requests from the frontend domain. Verify the `CORS_ALLOWED_ORIGINS` environment variable on Railway includes all frontend domains:

```env
CORS_ALLOWED_ORIGINS=https://app.flowstral.com,https://flowstral.com,https://www.flowstral.com
```

The FastAPI backend configures CORS middleware in `backend/app/main.py` using this variable.

---

## Step 5: Environment Variable Reference

### Backend (Railway) -- Complete List

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string from Supabase | `postgresql://postgres:pw@db.xxx.supabase.co:5432/postgres` |
| `SUPABASE_URL` | Yes | Supabase project URL | `https://hgnqricmdqbreekmqpov.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) | `eyJhbGci...` |
| `REDIS_URL` | Recommended | Redis connection string (auto-set by Railway Redis add-on) | `redis://default:pw@host:6379` |
| `OPENAI_API_KEY` | Optional | Server-provided OpenAI API key (fallback for orgs without BYOK keys) | `sk-proj-...` |
| `ANTHROPIC_API_KEY` | Optional | Server-provided Anthropic Claude API key (fallback) | `sk-ant-...` |
| `DEFAULT_LLM_PROVIDER` | No | Default LLM provider | `openai` (default) |
| `ENCRYPTION_KEY` | Recommended | Fernet key for encrypting BYOK API keys at rest | Fernet key string |
| `TEST_CASE_LLM_PROVIDER` | No | Provider for test case generation | `auto` (default) |
| `OPENAI_TEST_CASE_MODEL` | No | OpenAI model for test generation | `gpt-4o-mini` (default) |
| `OPENAI_TEMPERATURE` | No | LLM temperature | `0.2` (default) |
| `OPENAI_MAX_TOKENS` | No | Max token output | `2000` (default) |
| `JWT_SECRET_KEY` | Yes | JWT signing secret (min 32 bytes) | 64-char hex string |
| `JWT_ALGORITHM` | No | JWT algorithm | `HS256` (default) |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Access token expiry | `15` (default) |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | No | Refresh token expiry | `7` (default) |
| `APP_ENV` | Yes | Application environment | `production` |
| `INTERNAL_SERVICE_KEY` | Yes | Internal service-to-service auth key | 64-char hex string |
| `REDIS_PASSWORD` | Recommended | Redis authentication password | Base64-encoded string |
| `RATE_LIMIT_BACKEND` | Recommended | Rate limiting storage backend | `redis` (recommended for multi-instance) |
| `UPLOAD_MAX_SIZE_MB` | No | Maximum file upload size in MB | `50` (default) |
| `CORS_ALLOWED_ORIGINS` | Yes | Allowed CORS origins (comma-separated) | `https://app.flowstral.com` |
| `AIR_GAPPED_MODE` | No | Block external LLM calls | `false` (default) |
| `TRACK_LLM_USAGE` | No | Track LLM API usage metrics | `true` |
| `PYTHONPATH` | Yes | Python module path | `/app` |
| `PYTHONUNBUFFERED` | Yes | Disable stdout buffering | `1` |

### Frontend (Vercel) -- Complete List

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE_URL` | Yes | Backend API base URL | `https://api.flowstral.com` |
| `VITE_API_URL` | No | Alias for API base URL (fallback) | `https://api.flowstral.com` |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL | `https://hgnqricmdqbreekmqpov.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon key (safe for frontend) | `eyJhbGci...` |
| `VITE_SUPABASE_PROJECT_ID` | No | Supabase project ID | `hgnqricmdqbreekmqpov` |
| `VITE_GA4_MEASUREMENT_ID` | No | Google Analytics 4 measurement ID | `G-XXXXXXXXXX` |
| `VITE_CLARITY_PROJECT_ID` | No | Microsoft Clarity project ID | `abc123xyz` |
| `VITE_CRISP_WEBSITE_ID` | No | Crisp live chat website ID | UUID from Crisp dashboard |

**Note:** The frontend resolves `API_BASE_URL` with this fallback chain (defined in `src/lib/api-config.ts`):
1. `VITE_API_BASE_URL`
2. `VITE_API_URL`
3. Hardcoded fallback: `https://qaone-production.up.railway.app`

### Required Security Environment Variables

The following environment variables must be set on the backend (Railway) for a secure production deployment. These are in addition to the database and Supabase credentials listed above.

```env
# Application environment -- enables production-only security behaviors
APP_ENV=production

# JWT authentication -- single key for signing and verifying tokens
JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Internal service-to-service authentication key
INTERNAL_SERVICE_KEY=<generate with: openssl rand -hex 32>

# Redis authentication (set this and update REDIS_URL to include the password)
REDIS_PASSWORD=<generate with: openssl rand -base64 24>

# Rate limiting backend -- use Redis for multi-instance deployments
RATE_LIMIT_BACKEND=redis

# BYOK API key encryption at rest (Fernet symmetric encryption)
ENCRYPTION_KEY=<generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# File upload size limit
UPLOAD_MAX_SIZE_MB=50

# CORS -- restrict to your frontend domain(s) only, no wildcards
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

---

## Step 6: Post-Deployment Verification

Run through this checklist after deploying all services.

### 6.1 Backend Health Checks

```bash
# Basic health
curl -s https://api.flowstral.com/health | python -m json.tool

# Expected:
# {
#   "status": "healthy",
#   "database": "connected",
#   "version": "..."
# }

# AI service status
curl -s https://api.flowstral.com/api/ai-testing/status | python -m json.tool

# Dashboard stats (verifies DB connectivity)
curl -s https://api.flowstral.com/dashboard/stats | python -m json.tool

# Test case CRUD
curl -s https://api.flowstral.com/test-cases | python -m json.tool
```

### 6.2 Frontend Verification

1. Open `https://app.flowstral.com` in a browser
2. Verify the landing page renders correctly
3. Open browser DevTools (F12) > Console -- check for errors
4. Verify Network tab shows requests going to `api.flowstral.com`
5. Test sign-up flow (creates user in Supabase Auth)
6. Test sign-in flow
7. Navigate to Dashboard -- verify data loads
8. Navigate to Recorder -- verify it renders

### 6.3 WebSocket Verification

```bash
# Test WebSocket connectivity (requires wscat)
npm install -g wscat
wscat -c wss://api.flowstral.com/test-runs/ws/test-connection
```

### 6.4 Analytics Verification

1. Open the app and navigate between pages
2. Check Google Analytics 4 real-time view for `page_view` events
3. Check Microsoft Clarity dashboard for session recording
4. Check Crisp dashboard for chat widget status

---

## Step 7: Monitoring and Alerting

### 7.1 Railway Dashboard

Railway provides built-in monitoring:

- **Metrics:** CPU, memory, network I/O per service
- **Logs:** Real-time log streaming with search
- **Deployments:** Deploy history, rollback capability
- **Usage:** Monthly usage and billing

Access via [https://railway.app/dashboard](https://railway.app/dashboard).

### 7.2 Vercel Analytics

Vercel provides frontend performance monitoring:

- **Web Vitals:** LCP, FID, CLS scores
- **Speed Insights:** Per-page performance
- **Edge Functions logs** (if used)

Enable via Vercel project settings > **Analytics**.

### 7.3 Prometheus Metrics

The backend exposes Prometheus metrics at `/metrics` (via `prometheus-client` library in `requirements.txt`):

```bash
curl https://api.flowstral.com/metrics
```

Exposed metrics include:
- `http_requests_total` -- Request count by method, endpoint, status
- `http_request_duration_seconds` -- Request latency histogram
- `llm_requests_total` -- LLM API call count by provider
- `test_executions_total` -- Test execution count by status

### 7.4 Google Analytics 4

Marketing and product analytics are tracked via GA4 (configured in `src/lib/web-analytics.ts`):

- **Page views:** Every route change
- **CTA clicks:** All marketing page buttons
- **Sign-ups and logins:** Conversion tracking
- **Feature engagement:** In-app feature usage

Setup: Set `VITE_GA4_MEASUREMENT_ID` in Vercel environment variables.

### 7.5 Microsoft Clarity

Heatmaps and session recordings for UX analysis:

- Session recordings of user interactions
- Click heatmaps
- Scroll depth analysis
- Dead click detection

Setup: Set `VITE_CLARITY_PROJECT_ID` in Vercel environment variables.

### 7.6 Crisp Live Chat

In-app live chat for customer support:

- Chat widget appears on marketing pages
- Triggered programmatically via `openCrispChat()` from "Chat with us" buttons
- Disabled automatically in the Electron desktop app

Setup: Set `VITE_CRISP_WEBSITE_ID` in Vercel environment variables.

### 7.7 Uptime Monitoring (Recommended)

Set up external uptime monitoring with one of these services:

| Service | Free Tier | Recommended Checks |
|---------|-----------|-------------------|
| **Better Stack** (betterstack.com) | 10 monitors | Health endpoint, homepage |
| **UptimeRobot** (uptimerobot.com) | 50 monitors | Health endpoint, homepage |
| **Checkly** (checklyhq.com) | 5 checks | Health endpoint with assertions |

**Recommended monitors:**

| Check | URL | Interval | Alert |
|-------|-----|----------|-------|
| Backend Health | `GET https://api.flowstral.com/health` | 60s | Email + Slack |
| Frontend | `GET https://app.flowstral.com` | 60s | Email + Slack |
| API Response | `GET https://api.flowstral.com/dashboard/stats` | 300s | Email |
| WebSocket | `WSS https://api.flowstral.com/test-runs/ws/ping` | 300s | Email |

---

## Step 8: Scaling Guidelines

### 8.1 Vertical Scaling (Railway)

| Load Level | Users | Railway Config | Estimated Cost |
|------------|-------|----------------|---------------|
| **Starter** | 1-20 | 1 vCPU, 1 GB RAM | ~$5-20/month |
| **Growth** | 20-100 | 2 vCPU, 4 GB RAM | ~$40-80/month |
| **Scale** | 100-500 | 4 vCPU, 8 GB RAM | ~$100-200/month |
| **Enterprise** | 500+ | 8 vCPU, 16 GB RAM + workers | ~$300+/month |

Adjust in Railway service settings > **Resources**.

### 8.2 Horizontal Scaling

| Component | How to Scale | When |
|-----------|-------------|------|
| **Frontend (Vercel)** | Automatic -- global CDN | No action needed |
| **Backend (Railway)** | Increase replicas in Railway | Response times > 2s under load |
| **Workers** | Add Railway worker services | Test execution queue backs up |
| **Database (Supabase)** | Upgrade Supabase plan | Connection count > 50, storage > 8 GB |
| **Redis** | Upgrade Railway Redis instance | Memory usage > 80% |

### 8.3 Supabase Connection Pooling

Supabase uses PgBouncer for connection pooling. For high-concurrency workloads:

1. Go to **Settings > Database** in Supabase
2. Use the **Pooler connection string** (port 6543) instead of the direct connection (port 5432)
3. Connection string format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

Update `DATABASE_URL` on Railway to use the pooler URL when concurrent connections exceed 20.

### 8.4 Performance Optimization

- **Backend:** Use `gunicorn` with `uvicorn` workers for multi-process serving: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- **Frontend:** Vite builds with code splitting and tree shaking by default. Heavy pages (API Testing, Recorder) are lazy-loaded in `App.tsx`.
- **Database:** Add indexes on frequently queried columns (already in migration files). Monitor slow queries in Supabase dashboard > **Database > Query Performance**.
- **Redis:** Enable Redis persistence for job queue durability across restarts.

---

## Step 9: CI/CD Integration

### 9.1 Automatic Deployments

Both Vercel and Railway support automatic deployments from GitHub:

| Trigger | Vercel (Frontend) | Railway (Backend) |
|---------|-------------------|-------------------|
| Push to `main` | Auto-deploy to production | Auto-deploy to production |
| Push to `develop` | Preview deployment | Deploy to staging (if configured) |
| Pull request | Preview deployment with unique URL | No auto-deploy (recommended) |

### 9.2 GitHub Actions Workflow

Create `.github/workflows/deploy.yml` for additional CI steps:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci --legacy-peer-deps
      - run: npm run build

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 9.3 Release Process

The established release process (from CLAUDE.md) is:

1. Merge feature branch to `main`
2. Push to GitHub (triggers Vercel + Railway auto-deploy)
3. Build Electron desktop app (`flowstral-desktop/`)
4. Create GitHub release with desktop installers

```bash
# Check current version
cat flowstral-desktop/package.json | grep version

# Check latest release
"C:\Program Files\GitHub CLI\gh.exe" release list --repo maddynolan/QAOne --limit 1

# Create release with assets
"C:\Program Files\GitHub CLI\gh.exe" release create v3.13.0 \
  --repo maddynolan/QAOne \
  --title "Flowstral v3.13.0 - Description" \
  --notes "Release notes here" \
  "C:\QAAI\flowstral-desktop\dist\Flowstral-Setup.exe" \
  "C:\QAAI\flowstral-desktop\dist\Flowstral-Portable.exe" \
  "C:\QAAI\flowstral-desktop\dist\latest.yml"
```

---

## Step 10: Backup and Disaster Recovery

### 10.1 Database Backups

**Supabase automatic backups:**
- Free plan: Daily backups, 7-day retention
- Pro plan: Daily backups, 30-day retention, point-in-time recovery (PITR)

**Manual backup:**

```bash
# Using pg_dump
pg_dump "postgresql://postgres:[password]@db.hgnqricmdqbreekmqpov.supabase.co:5432/postgres" \
  --format=custom \
  --file=flowstral-backup-$(date +%Y%m%d).dump

# Restore
pg_restore --dbname="[connection-string]" flowstral-backup-20260223.dump
```

### 10.2 Code and Configuration

- All code is in GitHub (`maddynolan/QAOne`) with full git history
- Environment variables are stored in Railway and Vercel platform secrets
- Document all env vars in a secure password manager (1Password, Vault, etc.)

### 10.3 Recovery Procedures

| Scenario | Recovery Steps | RTO |
|----------|---------------|-----|
| Backend crash | Railway auto-restarts, check logs | < 1 minute |
| Bad deployment | Railway rollback to previous deploy | < 2 minutes |
| Database corruption | Supabase PITR restore (Pro plan) | < 30 minutes |
| Region outage | Deploy to different Railway region | < 1 hour |
| Complete disaster | Redeploy from GitHub + restore DB backup | < 2 hours |

---

## Cost Estimation

### Minimal (Startup / 1-20 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Supabase | Free | $0 |
| Railway | Hobby ($5 credit) | $5-10 |
| Vercel | Free | $0 |
| OpenAI | Pay-as-you-go | $5-20 |
| Domain | Annual / 12 | ~$1 |
| **Total** | | **$11-31/month** |

### Growth (20-100 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Supabase | Pro | $25 |
| Railway | Pro (backend + Redis + 1 worker) | $20-100 |
| Vercel | Pro | $20 |
| OpenAI | Pay-as-you-go | $20-50 |
| Uptime monitoring | Free tier | $0 |
| Domain | Annual / 12 | ~$1 |
| **Total** | | **$86-196/month** |

### Scale (100-500 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Supabase | Pro (with compute add-on) | $25-75 |
| Railway | Team (backend + Redis + 3 workers) | $100-300 |
| Vercel | Pro | $20 |
| OpenAI | Pay-as-you-go | $50-150 |
| Anthropic Claude | Pay-as-you-go (optional) | $20-80 |
| Better Stack monitoring | Starter | $24 |
| Domain + DNS | Cloudflare Pro | $20 |
| **Total** | | **$259-669/month** |

### Cost Optimization Tips

1. **LLM costs:** Use `gpt-4o-mini` (default) instead of `gpt-4o` -- 10x cheaper with similar quality for test generation
2. **Supabase:** Use connection pooling to stay within connection limits on lower tiers
3. **Railway:** Start with a single backend instance; add workers only when test execution queue backs up
4. **Vercel:** Free tier supports 100 GB bandwidth and unlimited deployments -- sufficient for most SaaS use cases
5. **Redis:** Only needed if you use background test workers or want caching; the backend works without it

---

## Security Checklist

### Environment and Secrets

- [ ] All environment variables stored in Railway / Vercel platform secrets (not committed to `.env` in git)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only on backend (Railway), never on frontend (Vercel)
- [ ] `OPENAI_API_KEY` only on backend (Railway), never on frontend (Vercel)
- [ ] `JWT_SECRET_KEY` is unique, cryptographically random, 64+ characters (min 32 bytes)
- [ ] `ENCRYPTION_KEY` is set (Fernet key) for BYOK API key encryption at rest
- [ ] `INTERNAL_SERVICE_KEY` is set for service-to-service authentication
- [ ] `APP_ENV=production` is set
- [ ] `.env` file is listed in `.gitignore` (do not commit production secrets)
- [ ] API keys rotated quarterly (set calendar reminders)
- [ ] BYOK keys are encrypted in `ai_encrypted_keys` table (Fernet), never in localStorage or frontend state

### Network and CORS

- [ ] `CORS_ALLOWED_ORIGINS` locked to production frontend domains only (no `*` wildcards)
- [ ] HTTPS enforced on all endpoints (automatic with Vercel and Railway)
- [ ] WebSocket connections use `wss://` (not `ws://`)
- [ ] Backend health endpoint (`/health`) does not expose sensitive information
- [ ] Prometheus `/metrics` endpoint restricted (via nginx or middleware) in production

### Authentication

- [ ] Supabase Row Level Security (RLS) policies active on all tables
- [ ] JWT access tokens have short expiry (15 minutes recommended)
- [ ] JWT refresh tokens configured (7-day expiry recommended)
- [ ] Password minimum length set to 12+ characters in Supabase Auth settings
- [ ] Email confirmation enabled for new sign-ups
- [ ] Rate limiting on auth endpoints (5 requests/second -- configured in nginx)
- [ ] Rate limiting backend set to Redis for multi-instance deployments (`RATE_LIMIT_BACKEND=redis`)

### Application

- [ ] Backend Dockerfile runs as non-root user (`appuser`, UID 1001)
- [ ] Frontend serves security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`
- [ ] Content Security Policy (CSP) configured in vercel.json / nginx to restrict script sources
- [ ] File upload size limits enforced (52 MB for artifacts, 10 MB for screenshots)
- [ ] Storage bucket access controlled by RLS policies
- [ ] RBAC middleware active on sensitive API endpoints

### Monitoring

- [ ] Uptime monitoring configured for backend health and frontend availability
- [ ] Error alerting set up (email or Slack) for 5xx responses
- [ ] LLM usage tracking enabled (`TRACK_LLM_USAGE=true`) to monitor API costs
- [ ] Railway deployment notifications enabled

---

## AI Configuration (v3.14.0+)

### AI is OFF by Default

AI features are disabled by default for all organizations. No AI API keys are required for the platform to function. Users opt-in to AI via **Settings > AI** in the web application.

### BYOK (Bring Your Own Key)

Users can provide their own OpenAI or Anthropic API keys through the Settings UI. BYOK keys are:

- Encrypted at rest using Fernet symmetric encryption (requires `ENCRYPTION_KEY` env var on Railway)
- Never stored in the frontend -- only a `hasApiKey: boolean` flag is tracked client-side
- Resolved per-request: BYOK org key > server env var > AI unavailable (503)

**Setup:** Ensure `ENCRYPTION_KEY` is set in Railway environment variables (see Step 5). Generate it with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Server-Provided Fallback Keys (Optional)

If you want to offer AI capabilities to all users without requiring BYOK, set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in Railway. These are used as fallbacks when an org has not configured their own key.

### Budget Tracking and Usage Monitoring

AI usage is tracked per-organization in the `ai_usage_log` table. Each LLM API call records:
- Provider, model, prompt/completion tokens, estimated cost
- Feature area (e.g., `test_case_generation`, `self_healing`, `chat_assistant`)
- Timestamp for time-series analysis

Admins can view usage stats and set budget limits via **Settings > AI > Usage** or query the API directly:

```bash
# Get current period usage stats for an org
curl -H "Authorization: Bearer $TOKEN" \
  https://api.flowstral.com/api/ai/settings/usage
```

### AI Settings API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/ai/settings` | Get org AI settings (enabled, provider, features, has_key) |
| `PUT` | `/api/ai/settings` | Update settings (enabled, provider, model, 20 feature toggles) |
| `POST` | `/api/ai/settings/key` | Store BYOK API key (Fernet-encrypted) |
| `DELETE` | `/api/ai/settings/key/{provider}` | Remove stored key |
| `POST` | `/api/ai/settings/test` | Test connection with stored/provided key |
| `GET` | `/api/ai/settings/providers` | List providers + which have keys configured |
| `GET` | `/api/ai/settings/usage` | Get current period usage stats and budget status |

### Database Tables

Migration `034_ai_settings.sql` (applied via `supabase db push`) creates:
- `ai_settings` -- Per-org AI configuration, provider selection, 20 feature toggles, budget limits
- `ai_usage_log` -- LLM call tracking per org for cost monitoring

The `ai_encrypted_keys` table is created at runtime by `AISettingsService` to store Fernet-encrypted BYOK keys. All three tables are also bootstrapped by `auto_migrate.py` on backend startup.

---

## Chrome Web Store Publishing (v3.14.0)

### Prerequisites

- **Chrome Developer account** -- one-time $5 registration fee at [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
- **Hosted privacy policy** -- must be publicly accessible at `https://app.flowstral.com/privacy` (already implemented in `PrivacyPage.tsx`, Section 8 covers Chrome Extension data practices)
- **Extension source** -- `flowstral-extension/` directory in the repository

### Step-by-Step Publishing Process

**1. Create a Chrome Developer Account**

1. Go to [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Sign in with a Google account (use a team/company account, not personal)
3. Pay the one-time $5 developer registration fee
4. Complete identity verification (may take 24-48 hours for new accounts)

**2. Package the Extension**

```bash
cd C:\QAAI\flowstral-extension

# Ensure manifest.json has the correct version number
# The version must be incremented for each submission

# Create a zip file for upload (exclude development files)
zip -r flowstral-extension.zip \
  manifest.json \
  src/ \
  icons/ \
  PRIVACY_POLICY.md \
  -x "*.DS_Store" "node_modules/*" ".git/*"
```

**3. Create the Store Listing**

1. In the Developer Console, click **New Item**
2. Upload the `flowstral-extension.zip` file
3. Fill in the listing details:
   - **Name:** Flowstral QA Recorder
   - **Summary:** Browser test recorder with AI self-healing for enterprise QA automation
   - **Description:** Detailed description covering recording capabilities, AI features, and enterprise integration
   - **Category:** Developer Tools
   - **Language:** English

**4. Upload Required Assets**

| Asset | Specification | Purpose |
|-------|---------------|---------|
| Icon (128x128) | PNG, 128x128 pixels | Store listing icon |
| Screenshots (5+) | PNG/JPEG, 1280x800 or 640x400 | Store listing screenshots |
| Small promo tile | PNG, 440x280 | Optional promotional tile |
| Marquee promo | PNG, 1400x560 | Optional large promotional banner |

Recommended screenshots:
1. Recording a browser session (side panel open)
2. AI auto-fix healing a broken selector
3. Generated Playwright script output
4. Manual Assist card with selector suggestions
5. Extension settings / configuration panel

**5. Complete Privacy Declarations**

Under **Privacy practices**, declare the following data types:

| Data Type | Usage | Disclosure |
|-----------|-------|------------|
| **User Activity** (clicks, scrolls, mouse movements) | Core functionality (test recording) | Disclosed -- sent to user's configured backend server |
| **Web History** (URLs visited during recording) | Core functionality (test step URLs) | Disclosed -- sent to user's configured backend server |

Additional declarations:
- Data is **not sold** to third parties
- Data is **not used for purposes unrelated** to the extension's functionality
- Data is **not used for creditworthiness or lending** purposes
- Sensitive data (passwords, auth headers) is **masked before transmission**

**6. Submit for Review**

1. Review all listing details and privacy declarations
2. Click **Submit for Review**
3. Review typically takes 1-5 business days
4. You will receive email notification of approval or rejection

### Pre-Submission Compliance Checklist

All items below were completed in v3.13.3 and are maintained going forward:

- [x] `optional_host_permissions` restricted to `["https://*/*", "http://localhost/*", "http://127.0.0.1/*"]` (no `<all_urls>`)
- [x] Sensitive headers masked in network captures: Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token
- [x] Password fields and sensitive inputs masked as `[MASKED]` in recorded actions
- [x] No remote code execution -- all code is bundled in the extension package
- [x] Backend URL validation enforces HTTPS for non-localhost URLs
- [x] Privacy policy hosted at `/privacy` and linked from `manifest.json` `homepage_url`
- [x] Auto-dropdown scanning disabled (was auto-triggering clicks on page elements)
- [x] Correlation patterns (auto-detection of API keys/tokens) disabled in extension

### Common Rejection Reasons and Fixes

| Rejection Reason | Fix |
|-----------------|-----|
| **Broad host permissions** | Use `optional_host_permissions` instead of `permissions` for host access; already restricted in v3.13.3 |
| **Missing privacy policy** | Ensure `/privacy` route is accessible and covers extension data practices (Section 8) |
| **Unclear data usage** | Update description to explain why User Activity and Web History are collected |
| **Remote code loading** | Ensure no `eval()`, no remote script injection; all code must be in the zip |
| **Excessive permissions** | Only request permissions actually used; `webRequest` is in `optional_permissions` |
| **Missing purpose description** | Each permission in manifest.json should have a clear justification in the store listing |

---

## Client Demo Quick Setup

> 30-minute setup for deploying a fully functional Flowstral demo environment using Coolify on a Hetzner VPS. Ideal for client demos, proof-of-concept evaluations, and sales engineering.

### Prerequisites

- [ ] Hetzner Cloud account ([https://console.hetzner.cloud](https://console.hetzner.cloud))
- [ ] Cloudflare account for DNS management (free tier works)
- [ ] Domain or subdomain (e.g., `demo.flowstral.com`)
- [ ] SSH key pair for server access

### Step 1: Provision the Server (5 minutes)

1. In Hetzner Cloud Console, create a new server:
   - **Location:** Nuremberg (eu-central) or your nearest region
   - **Image:** Ubuntu 22.04
   - **Type:** CX32 (4 vCPU, 8 GB RAM, 80 GB SSD) -- $8.50/month
   - **SSH Key:** Add your public key
   - **Name:** `flowstral-demo`
2. Note the server's public IP address

### Step 2: Install Coolify (5 minutes)

```bash
# SSH into the server
ssh root@<server-ip>

# Install Coolify (one-liner)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Coolify will be available at http://<server-ip>:8000
# Create your admin account on first visit
```

### Step 3: Configure DNS (2 minutes)

In Cloudflare, add an A record:

```
Type    Name              Content         Proxy
A       demo.flowstral    <server-ip>     DNS only (grey cloud)
```

If using a wildcard for Coolify subdomains:

```
A       *.demo.flowstral  <server-ip>     DNS only
```

### Step 4: Deploy Services in Coolify (15 minutes)

Deploy the following 6 services in order through the Coolify dashboard:

**Service 1: PostgreSQL**
- Type: Database > PostgreSQL 16
- Config: Database name `qaai`, user `qaai`, generate password
- Note the internal connection string

**Service 2: Redis**
- Type: Database > Redis 7
- Default configuration

**Service 3: MinIO**
- Type: Service > MinIO
- Set `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
- Create bucket `qa-artifacts` after deployment

**Service 4: Backend API**
- Type: Application > Docker
- Source: GitHub `maddynolan/QAOne`, root directory `backend`
- Dockerfile: `backend/Dockerfile`
- Domain: `api.demo.flowstral.com`
- Environment variables (see `deploy/coolify/.env.example`):

```env
DATABASE_URL=postgresql://qaai:<password>@<postgres-internal>:5432/qaai
REDIS_URL=redis://<redis-internal>:6379
S3_ENDPOINT_URL=http://<minio-internal>:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=<minio-password>
S3_BUCKET_NAME=qa-artifacts
JWT_SECRET_KEY=<generate-64-char-hex>
ENCRYPTION_KEY=<generate-fernet-key>
APP_ENV=production
DEFAULT_LLM_PROVIDER=openai
CORS_ALLOWED_ORIGINS=https://demo.flowstral.com
PYTHONPATH=/app
PYTHONUNBUFFERED=1
SEED_DEMO_DATA=true
```

**Service 5: Frontend**
- Type: Application > Docker
- Source: GitHub `maddynolan/QAOne`, root directory `/`
- Dockerfile: `Dockerfile.frontend`
- Build arg: `VITE_API_BASE_URL=https://api.demo.flowstral.com`
- Domain: `demo.flowstral.com`

**Service 6 (Optional): Monitoring**
- Type: Application > Docker Compose
- Use `docker-compose.monitoring.yml` for Prometheus + Grafana

### Step 5: Seed Demo Data

The `SEED_DEMO_DATA=true` environment variable triggers automatic demo data seeding on backend startup via `auto_migrate.py`. This creates:

- 1 organization, 3 projects, 3 sample users
- 50 test cases across multiple categories
- 20 test runs with pass/fail results
- 10 defects with varying severities
- 8 requirements linked to test cases
- 5 API collections with sample requests
- 3 environments (dev, staging, prod)
- 2 accessibility scan results
- 3 performance test runs

Demo user credentials are output in the backend logs on first startup.

### Step 6: Verification Checklist

```bash
# Backend health
curl -s https://api.demo.flowstral.com/health
# Expected: {"status": "healthy", "database": "connected"}

# Dashboard data populated
curl -s https://api.demo.flowstral.com/dashboard/stats
# Expected: non-zero counts for test cases, runs, defects

# Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://demo.flowstral.com
# Expected: 200
```

Verify in browser:
- [ ] Landing page renders at `https://demo.flowstral.com`
- [ ] Dashboard shows populated metrics after sign-in
- [ ] Test Repository displays 50 seeded test cases
- [ ] API Testing page loads with sample collections
- [ ] Recorder page renders without errors

### Cost Summary

| Resource | Monthly Cost |
|----------|-------------|
| Hetzner CX32 (4 vCPU, 8 GB, 80 GB) | $8.50 |
| Cloudflare DNS (free tier) | $0 |
| Domain (if needed, annual/12) | ~$1 |
| **Total** | **~$9.50/month** |

---

## Troubleshooting

### Backend Fails to Start

**Symptom:** Railway deployment fails or health check returns 503.

**Check:**
1. Railway logs for Python import errors or missing dependencies
2. `DATABASE_URL` is correct and Supabase allows connections from Railway IP range
3. Required environment variables are set (see Step 5)

```bash
# Test DB connection manually
python -c "import psycopg2; conn = psycopg2.connect('DATABASE_URL_HERE'); print('OK')"
```

### CORS Errors in Browser

**Symptom:** Browser console shows `Access-Control-Allow-Origin` errors.

**Fix:** Ensure `CORS_ALLOWED_ORIGINS` on Railway includes the exact frontend domain with protocol:
```
CORS_ALLOWED_ORIGINS=https://app.flowstral.com,https://flowstral.com
```

Do not include trailing slashes. Do not include ports unless non-standard.

### Frontend Shows "Connection Error" or Blank Dashboard

**Symptom:** App loads but API calls fail silently.

**Check:**
1. Verify `VITE_API_BASE_URL` is set correctly in Vercel environment variables
2. Verify the backend is running: `curl https://api.flowstral.com/health`
3. Check browser DevTools Network tab for failed requests
4. Rebuild frontend after changing environment variables (Vercel requires a new deployment for env var changes)

### WebSocket Disconnections

**Symptom:** Real-time test execution updates stop mid-run.

**Check:**
1. Railway supports WebSockets natively -- verify no proxy is stripping `Upgrade` headers
2. The frontend WebSocket hook (`useExecutionWebSocket.ts`) implements a 25-second heartbeat
3. Check Railway service logs for connection timeout errors
4. Ensure the WebSocket URL resolves correctly: `wss://api.flowstral.com/test-runs/ws/{executionId}`

### AI Features Return Errors

**Symptom:** Test generation, AI self-healing, or Flowpilot agents fail.

**Check:**
1. AI must be enabled for the org via **Settings > AI** (AI is OFF by default)
2. Either a BYOK key must be stored (via `POST /api/ai/settings/key`) or `OPENAI_API_KEY` must be set as a server-level fallback
3. If using BYOK, verify `ENCRYPTION_KEY` is set in Railway env vars (required for key decryption)
4. `DEFAULT_LLM_PROVIDER` is set to `openai` (not `local_ollama`)
5. `AIR_GAPPED_MODE` is `false`
6. Check Railway logs for `openai.AuthenticationError` or `openai.RateLimitError`
7. Verify with: `curl https://api.flowstral.com/api/ai-testing/status`
8. Check AI settings: `curl -H "Authorization: Bearer $TOKEN" https://api.flowstral.com/api/ai/settings`

### Database Migration Failures

**Symptom:** Tables missing, 500 errors on CRUD operations.

**Fix:**
1. Re-run migrations via Supabase CLI: `supabase db push`
2. Check the SQL Editor for the last successfully applied migration
3. The backend has an in-memory fallback (`backend/app/services/storage/database.py`) that keeps the app functional without PostgreSQL, but data will not persist

### Supabase Connection Limits

**Symptom:** `too many connections for role` error in Railway logs.

**Fix:**
1. Switch `DATABASE_URL` to the pooler connection string (port 6543)
2. Upgrade Supabase plan for higher connection limits
3. Reduce Railway backend replicas or add connection pooling on the application side

---

## Quick Reference Commands

```bash
# Check backend health
curl -s https://api.flowstral.com/health | python -m json.tool

# Check latest GitHub release
"C:\Program Files\GitHub CLI\gh.exe" release list --repo maddynolan/QAOne --limit 3

# Trigger Vercel deployment
vercel --prod

# View Railway logs
railway logs --service backend --tail

# Run DB migrations
supabase link --project-ref hgnqricmdqbreekmqpov && supabase db push

# Generate secrets
python -c "import secrets; print(secrets.token_hex(32))"

# Test CORS
curl -H "Origin: https://app.flowstral.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  https://api.flowstral.com/health -v
```

---

## Pre-Deployment Security Checklist

Run through this checklist before every production deployment to ensure no security gaps exist.

- [ ] All default credentials changed (no `minioadmin`, `qaai_password`, etc.)
- [ ] JWT_SECRET_KEY set to unique random value (min 32 bytes)
- [ ] ENCRYPTION_KEY set (Fernet key)
- [ ] APP_ENV=production
- [ ] CORS_ALLOWED_ORIGINS restricted to your domains only
- [ ] All security headers configured (HSTS, CSP, Permissions-Policy, Referrer-Policy, X-Frame-Options, X-Content-Type-Options)
- [ ] Redis authentication enabled
- [ ] Database SSL/TLS enabled
- [ ] Backup strategy configured (30-day minimum retention)
- [ ] Monitoring/alerting configured
- [ ] Log aggregation configured
- [ ] Rate limiting backend set to Redis for multi-instance
