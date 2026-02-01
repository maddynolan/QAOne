# QAAI / Flowstral: Complete Deployment Plan — SaaS, PaaS & On-Prem

> **Purpose:** Single runbook to deploy tonight in all three modes. Use this doc end-to-end; refer to linked docs for deeper reference.

**Related docs:**  
- `DEPLOYMENT-RECOMMENDATION-AND-CONTROL-PLANE.md` — control plane vs client, SaaS/PaaS rationale  
- `DEPLOYMENT-STATUS-AND-STEPS.md` — what's done vs pending, key file locations  
- `DEPLOYMENT-AND-PACKAGING-REFERENCE.md` — full options, recorder parity, packaging  

---

## 1. Prerequisites (all modes)

- **Git:** repo cloned, on correct branch  
- **Node 18+** and **npm** (for frontend and desktop builds)  
- **Docker** and **Docker Compose** (for backend/frontend images and on-prem)  
- **kubectl** and **Helm 3** (PaaS only)  
- **Container registry** (PaaS/SaaS): e.g. Docker Hub, ECR, GCR, ACR  

**Secrets to have ready:**

- `JWT_SECRET` — min 32 chars  
- `DATABASE_URL` — Postgres connection string  
- `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` — cloud LLM provider keys

**Minimum Resource Requirements:**

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Backend | 2 cores | 2GB | 10GB |
| Worker | 2 cores | 4GB | 20GB |
| Postgres | 1 core | 1GB | 20GB+ |
| Redis | 0.5 core | 512MB | 1GB |
| Frontend | 0.5 core | 512MB | 1GB |

---

## 2. SaaS deployment (tonight)

### 2.1 Database

1. Create Postgres (Supabase, RDS, Cloud SQL, etc.).  
2. Run migrations in order (files are numbered 001-030):
   ```bash
   # If using Supabase CLI: supabase db push
   # Or run SQL files in supabase/migrations/ against your DB
   # Run in numerical order (001, 002, 003, ...)
   for f in supabase/migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
   ```
3. Note `DATABASE_URL`.

### 2.2 Redis

- Create Redis (ElastiCache, Memorystore, managed Redis).  
- Note `REDIS_URL` (e.g. `redis://host:6379/0`).
- **Note:** Redis is required if using test workers or background job queuing. Optional for single-instance deployments without workers.

### 2.3 Object storage

- Create S3/GCS/Azure Blob bucket (or use Supabase Storage).  
- Note `S3_*` or equivalent env vars for backend.

### 2.4 Backend image and deploy

```bash
# From repo root
docker build -t <registry>/qaai-backend:latest ./backend
docker push <registry>/qaai-backend:latest
```

Deploy to your cloud (ECS, Cloud Run, App Service, etc.) with env:

- `DATABASE_URL`  
- `JWT_SECRET`  
- `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`  
- `REDIS_URL` (required if using workers)  
- `S3_*` or storage env  

Expose port 8000; ensure health check on `/health`.

### 2.5 Frontend build and deploy

```bash
# From repo root — set API URL to your backend
export VITE_API_BASE_URL=https://api.yourdomain.com
npm run build
# Deploy dist/ to Vercel, Netlify, or static host (CloudFront + S3, etc.)
```

Or build with Docker:

```bash
docker build -f Dockerfile.frontend --build-arg VITE_API_BASE_URL=https://api.yourdomain.com -t <registry>/qaai-frontend:latest .
docker push <registry>/qaai-frontend:latest
# Then run frontend container or serve dist/ from your static host
```

### 2.6 Verification

```bash
# Verify backend health
curl https://api.yourdomain.com/health
# Expected: {"status":"ok"}

# Verify database connection
curl https://api.yourdomain.com/health/database
# Expected: {"status":"ok","message":"Database connection successful","tables_found":true}

# Verify frontend loads
curl -I https://yourdomain.com
# Expected: HTTP/2 200
```

### 2.7 Auth and multi-tenant

- Issue JWTs with `tenant_id` and `user_id` (or use API keys with `X-Tenant-ID` / `X-User-ID`).  
- See `docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md` § "SaaS compliance (multi-tenant/RBAC)".

### 2.8 Optional: test workers

```bash
docker build -f backend/Dockerfile.worker -t <registry>/qaai-worker:latest ./backend
docker push <registry>/qaai-worker:latest
```

Run workers with same `DATABASE_URL`, `REDIS_URL`, and backend URL.

### 2.9 Clients

- **Desktop:** Build from `flowstral-desktop` (see § 5). Set `serverUrl` to `https://api.yourdomain.com`.  
- **Extension:** Package from `flowstral-extension`; publish to Chrome Web Store or ship ZIP. Set backend URL in extension options.  
- **Web:** Users open your frontend URL; all traffic goes to backend.

---

## 3. PaaS (Kubernetes / Helm) deployment (tonight)

### 3.1 Build and push images

```bash
# From repo root
export REGISTRY=your-registry.io/your-org
export API_URL=https://qaai.customer.com  # or your ingress host

# Backend
docker build -t $REGISTRY/qaai-backend:latest ./backend
docker push $REGISTRY/qaai-backend:latest

# Frontend (set API URL for your ingress)
docker build -f Dockerfile.frontend --build-arg VITE_API_BASE_URL=$API_URL -t $REGISTRY/qaai-frontend:latest .
docker push $REGISTRY/qaai-frontend:latest

# Optional: test workers
docker build -f backend/Dockerfile.worker -t $REGISTRY/qaai-worker:latest ./backend
docker push $REGISTRY/qaai-worker:latest
```

### 3.2 Helm values

```bash
cp helm/qaai/values.yaml myvalues.yaml
```

Edit `myvalues.yaml`:

- `backend.image.repository`: `$REGISTRY/qaai-backend`  
- `backend.image.tag`: `latest`  
- `frontend.image.repository` and tag (if chart has frontend)  
- `testWorkers.image.repository` and tag if using workers  
- `postgresql.auth.password`, `minio.auth.rootPassword`, etc. (or use existing secrets)  
- `ingress.hosts`: e.g. `host: qaai.customer.com`  
- `ingress.tls` if using TLS (e.g. cert-manager)  
- Set backend env `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` via K8s secrets  

### 3.3 Install

```bash
helm dependency update helm/qaai
helm install qaai helm/qaai -f myvalues.yaml
kubectl get pods
kubectl get ingress
```

### 3.4 Verification

```bash
# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=qaai-backend --timeout=120s

# Port-forward to verify locally
kubectl port-forward svc/qaai-backend 8000:8000 &
curl http://localhost:8000/health

# Or test via ingress
curl https://qaai.customer.com/health
```

### 3.5 Clients

- Point desktop and extension `serverUrl` to PaaS ingress (e.g. `https://qaai.customer.com`).  
- Web app is served from ingress; API calls go to backend in-cluster.

---

## 4. On-prem (docker-compose) deployment (tonight)

### 4.1 Environment

```bash
cp env.example .env
# Edit .env: POSTGRES_PASSWORD, JWT_SECRET, DATABASE_URL, etc.
# Set OPENAI_API_KEY / ANTHROPIC_API_KEY for cloud LLM
```

### 4.2 Full stack

```bash
docker-compose -f docker-compose.full.yml up -d
docker-compose -f docker-compose.full.yml ps
```

Services: Postgres, MinIO, Redis, backend, frontend, test workers.

### 4.3 Verification

```bash
# Wait for services to be healthy
docker-compose -f docker-compose.full.yml ps

# Verify backend
curl http://localhost:8000/health

# Verify database
curl http://localhost:8000/health/database

# Verify frontend
curl -I http://localhost:3000
```

### 4.4 Clients

- Set desktop and extension `serverUrl` to on-prem host (e.g. `https://qaai.internal.company.com`).  
- Use `flowstral-desktop/DEPLOYMENT.md` for mass deployment (GPO, MDM, config.json).

---

## 5. Desktop app (all modes)

### 5.1 Build webapp and desktop

```bash
# From repo root — build Vite app
npm run build

# Copy into desktop (Windows)
cd flowstral-desktop && npm run build:webapp
# Or (Unix): npm run build:webapp:unix

# Install deps and Playwright Chromium
npm ci
npx playwright install chromium

# Build installers
npm run build:win   # Windows
# npm run build:mac   # macOS
# npm run build:linux # Linux
```

Artifacts: `flowstral-desktop/dist/` (e.g. NSIS, DMG, AppImage).

### 5.2 Configure backend URL

- In desktop app: Settings → Server URL = your backend (SaaS, PaaS, or on-prem).  
- For mass deploy: use electron-store key or config file; see `flowstral-desktop/DEPLOYMENT.md`.

### 5.3 Signing (production)

- **Windows:** Set `CSC_*` env for signtool; configure in electron-builder.  
- **macOS:** Set `APPLE_ID`, `APPLE_TEAM_ID`, notarize (e.g. electron-notarize).

---

## 6. Extension (all modes)

```bash
cd flowstral-extension
# Ensure manifest.json and icons are correct
# Zip folder (exclude node_modules, .git) for Chrome Web Store or enterprise ZIP
```

Users set backend URL in extension options for "Run on server" and sync.

---

## 7. Monitoring (optional but recommended)

### 7.1 Deploy monitoring stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

This starts Prometheus and Grafana for metrics collection.

### 7.2 Access dashboards

- **Grafana:** http://localhost:3001 (default admin/admin)
- **Prometheus:** http://localhost:9090

### 7.3 Key metrics to watch

- Backend `/health` status
- Database connection pool usage
- Redis queue depth (if using workers)
- Test execution success/failure rates

---

## 8. Rollback strategy

### 8.1 SaaS/PaaS rollback

```bash
# Redeploy previous image tag
docker pull <registry>/qaai-backend:<previous-tag>
# Update deployment with previous tag

# Kubernetes
kubectl set image deployment/qaai-backend backend=<registry>/qaai-backend:<previous-tag>
kubectl rollout status deployment/qaai-backend
```

### 8.2 On-prem rollback

```bash
# Stop services
docker-compose -f docker-compose.full.yml down

# Checkout previous version
git checkout <previous-tag>

# Rebuild and restart
docker-compose -f docker-compose.full.yml build
docker-compose -f docker-compose.full.yml up -d
```

### 8.3 Database rollback

**Important:** Always backup before migrations.

```bash
# Backup before deployment
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

---

## 9. Checklist summary

| Step | SaaS | PaaS | On-prem |
|------|------|------|---------|
| DB provision + migrations | ✅ | ✅ (Helm Postgres) | ✅ (compose Postgres) |
| Redis | Required for workers | ✅ (Helm Redis) | ✅ (compose Redis) |
| Storage | S3/GCS/Supabase | MinIO (Helm) | MinIO (compose) |
| Backend image + deploy | Build → cloud | Build → registry → Helm | compose |
| Frontend build + deploy | Build → Vercel/static | Build → registry → Helm | compose |
| LLM | OpenAI/Anthropic | Same | OpenAI/Anthropic |
| Desktop + Extension | Build; set serverUrl | Same | Same; serverUrl = on-prem |
| Auth / multi-tenant | JWTs or headers | Same | Same |
| Monitoring | CloudWatch/Datadog | Prometheus/Grafana | compose monitoring |
| Verification | curl /health | kubectl + curl | docker-compose + curl |

---

## 10. Quick reference — key files

| What | Where |
|------|--------|
| Backend Dockerfile | `backend/Dockerfile` |
| Frontend Dockerfile | `Dockerfile.frontend` (repo root) |
| Worker Dockerfile | `backend/Dockerfile.worker` |
| Compose full | `docker-compose.full.yml` |
| Compose monitoring | `docker-compose.monitoring.yml` |
| Helm chart | `helm/qaai/` |
| Env template | `env.example` |
| Migrations | `supabase/migrations/` |
| Desktop build | `flowstral-desktop/` — `build:webapp`, then `build:win` / `build:mac` / `build:linux` |

Use this plan for tonight's deployment in SaaS, PaaS, and on-prem; adjust registry names, domains, and secrets to your environment.

---

## 11. License-Based Feature Access

The platform supports license-based feature gating for optional modules:

### 11.1 Available plugin modules

| Plugin Key | Feature | Description |
|------------|---------|-------------|
| `api` | API Testing | REST, GraphQL, SOAP, Mock Server, DataGen (10K+ unique values), OWASP Security |
| `perf` | Performance Testing | Load testing with 10k+ VUs, SRM, Lighthouse |
| `a11y` | Accessibility Testing | WCAG 2.1 scanning with remediation guidance |
| `mobile` | Mobile Testing | 50+ device profiles, network throttling |

### 11.2 How it works

- **Frontend:** Uses `LandingPluginsContext` to show/hide sections based on license
- **Backend:** Validates license claims in JWT (`licensed_plugins` array)
- **Desktop:** Injects license info via Electron IPC on load
- **Storage:** Web uses `localStorage`, Desktop uses Electron store

### 11.3 License claim format

```json
{
  "tenant_id": "acme-corp",
  "user_id": "user-123",
  "licensed_plugins": ["api", "perf", "a11y", "mobile"],
  "license_tier": "enterprise"
}
```

### 11.4 Customization

Users can show/hide sections via the "Customize" button in the header, but only plugins included in their license are available. Unlicensed plugins show a lock icon with upgrade prompt.

---

## 12. Post-Deployment: Customization Options

The landing page supports optional plugin visibility: **API**, **Performance**, **Accessibility**, **Mobile**. Users can choose what to show based on their license:

- **Web:** Use the **Customize** (sliders + plug icon) control in the header; check or uncheck API, Perf, A11y, Mobile. Choices are stored in `localStorage` (`flowstral_landing_plugins`).
- **Desktop:** Same UI; choices are also stored in Electron store (`landingPlugins`) and injected into the webapp on load so the embedded landing page reflects desktop preferences.

**Sections affected:**

- **Features grid:** API Testing, Performance, Accessibility, and Mobile Testing cards are shown only when the corresponding plugin is enabled and licensed.
- **Performance & API section:** Shown if either **Perf** or **API** is enabled.
- **Visual & A11y section:** Shown if **A11y** is enabled.
- **Mobile Testing section:** Shown if **Mobile** is enabled.

**Implementation files:**
- `src/contexts/LandingPluginsContext.tsx` - React context with license support
- `src/pages/LandingPage.tsx` - Filtered rendering with license indicators
- `flowstral-desktop/src/main/index.js` - Desktop IPC handlers
- `flowstral-desktop/src/main/webapp-preload.js` - Desktop injection

---

## 13. API Testing - Enterprise Features (NEW)

The API Testing module now includes enterprise-grade features comparable to Postman and ReadyAPI:

### 13.1 Test Data Generation (DataGen)

Generate unlimited unique test data (10,000+ values) with Faker integration:

```bash
# Install Faker for unlimited data generation
pip install faker
```

**Supported data types:** 50+ types including names, emails, addresses, phones, companies, credit cards, UUIDs, dates, custom patterns, and more.

**Smart Fill Integration:** The Builder's Smart Fill feature now connects to the backend DataGen API for batch generation.

### 13.2 Mock Server

Create real HTTP mock servers for service virtualization:

- **Dynamic responses:** Use `{{$random.email}}` templates
- **Scenario-based:** Different responses based on conditions
- **Stateful sequences:** Simulate API state changes
- **Request logging:** Verify requests received
- **Auto-generation:** Create mocks from OpenAPI specs

### 13.3 Backend Endpoints (API Testing)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/testing/capabilities` | GET | List all capabilities |
| `/api/v2/testing/datagen/types` | GET | Available data types |
| `/api/v2/testing/datagen/generate` | POST | Generate single/few values |
| `/api/v2/testing/datagen/batch` | POST | Generate 10,000+ unique values |
| `/api/v2/testing/datagen/stats` | GET | Generation statistics |
| `/api/v2/testing/mock/server` | POST | Create mock server |
| `/api/v2/testing/mock/server/{id}/start` | POST | Start mock server |
| `/api/v2/testing/mock/server/{id}/endpoint` | POST | Add mock endpoint |
| `/api/v2/testing/mock/server/{id}/verify` | POST | Verify requests received |

### 13.4 Verification Commands

```bash
# Check DataGen capabilities
curl http://localhost:8000/api/v2/testing/datagen/stats
# Expected: {"status":"success","stats":{"faker_enabled":true,...}}

# Generate 10,000 unique emails
curl -X POST http://localhost:8000/api/v2/testing/datagen/batch \
  -H "Content-Type: application/json" \
  -d '{"data_type": "email", "count": 10000, "ensure_unique": true}'

# Create and start mock server
curl -X POST http://localhost:8000/api/v2/testing/mock/server \
  -d '{"name": "Test API", "port": 8081}'
```

### 13.5 Testing Documentation

See `docs/API-TESTING-TEST-GUIDE.md` for complete feature verification with public test APIs:
- JSONPlaceholder, ReqRes, HTTPBin for REST
- Swagger Petstore for OpenAPI
- GraphQL Countries for GraphQL
- CountryInfo Service for SOAP/WSDL

### 13.6 Key Files

| File | Description |
|------|-------------|
| `backend/app/services/api_testing/test_data_generator.py` | DataGen with Faker |
| `backend/app/services/api_testing/mock_server.py` | Real HTTP mock server |
| `backend/app/routers/enhanced_api_testing_api.py` | API endpoints |
| `src/lib/smart-fill-generators.ts` | Frontend generators + backend API |
| `src/components/SmartFillDialog.tsx` | Smart Fill UI with batch mode |
| `docs/API-TESTING-ENTERPRISE.md` | Full feature documentation |
