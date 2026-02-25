# Flowstral — Coolify Deployment Guide

Deploy the full Flowstral platform on a single Hetzner server using Coolify.

## Prerequisites

- Hetzner Cloud account (hetzner.com)
- Cloudflare account (free tier)
- Domain name (e.g., flowstral.com)
- GitHub repository access (maddynolan/QAOne)
- OpenAI API key (for AI features)

## Architecture

All services run on a single Hetzner VPS via Coolify:

| Service | Image/Source | Port | Purpose |
|---------|-------------|------|---------|
| PostgreSQL 16 | pgvector/pgvector:pg16 | 5432 (internal) | Primary database |
| Redis 7 | redis:7-alpine | 6379 (internal) | Cache & job queue |
| MinIO | minio/minio:latest | 9000/9001 (internal) | Object storage (screenshots, artifacts) |
| Backend | backend/Dockerfile | 8000 → api.flowstral.com | FastAPI API server |
| Frontend | Dockerfile.frontend | 80 → app.flowstral.com | React SPA (nginx) |
| Test Worker | backend/Dockerfile.worker | — (background) | Playwright test execution |

## Step 1: Provision Hetzner Server

1. Log into Hetzner Cloud Console (console.hetzner.cloud)
2. Create new server:
   - **Location**: Choose closest to your users (Falkenstein DE, Helsinki FI, or Ashburn US)
   - **Image**: Ubuntu 22.04 LTS
   - **Type**: CX32 (4 vCPU, 8 GB RAM, 80 GB NVMe) — $8.50/mo
   - **For heavier demos**: CX42 (8 vCPU, 16 GB RAM) — $16/mo
   - **SSH Key**: Add your SSH key
   - **Networking**: Enable IPv4 (auto-assigned)
3. Note the server's IP address

### Scaling Guide

| Phase | Users | Server | Monthly Cost |
|-------|-------|--------|-------------|
| Demo | ~20 | 1x CX32 | $8.50 |
| 100 customers | ~50 | 2x CX32 (app + data) | $17 |
| 500 customers | ~100 | CX42 + CX32 + CX42 (app + db + workers) | $41 |
| 1000 customers | ~200 | CX52 + CX42 + CX42 + CX32 + CX42 + LB11 | $108 |

## Step 2: Install Coolify

SSH into your server and run:

```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Coolify will be available at `http://YOUR_SERVER_IP:8000`. Complete the initial setup wizard (create admin account).

## Step 3: Configure Cloudflare DNS

1. Add your domain to Cloudflare (free plan)
2. Update nameservers at your registrar to Cloudflare's
3. Create DNS records:

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | app | YOUR_SERVER_IP | Proxied (orange) |
| A | api | YOUR_SERVER_IP | Proxied (orange) |
| A | coolify | YOUR_SERVER_IP | DNS Only (grey) |

4. SSL/TLS settings:
   - Mode: **Full (Strict)**
   - Always Use HTTPS: **On**
   - Minimum TLS Version: **1.2**

5. Page Rules (optional):
   - `app.flowstral.com/assets/*` → Cache Level: Cache Everything, Edge TTL: 1 month
   - `api.flowstral.com/*` → Cache Level: Bypass

## Step 4: Deploy Infrastructure Services

In Coolify dashboard, add these services:

### PostgreSQL
- Type: Service → PostgreSQL
- Image: `pgvector/pgvector:pg16`
- Environment:
  - POSTGRES_USER=qaai
  - POSTGRES_PASSWORD=<generate-strong-password>
  - POSTGRES_DB=qaai
- Volume: /var/lib/postgresql/data (persistent)
- Health check: `pg_isready -U qaai`

### Redis
- Type: Service → Redis
- Image: `redis:7-alpine`
- Volume: /data (persistent)
- Health check: `redis-cli ping`

### MinIO
- Type: Service → Docker Image
- Image: `minio/minio:latest`
- Command: `server /data --console-address ":9001"`
- Environment:
  - MINIO_ROOT_USER=minioadmin
  - MINIO_ROOT_PASSWORD=<generate-strong-password>
- Volume: /data (persistent)
- Health check: `curl -f http://localhost:9000/minio/health/live`

## Step 5: Deploy Application Services

### Backend API
- Type: Application → GitHub Repository
- Repository: maddynolan/QAOne
- Branch: main
- Dockerfile: backend/Dockerfile
- Domain: api.flowstral.com
- Port: 8000
- Environment variables: (see .env.example in this directory)
- Health check: GET /health

### Frontend
- Type: Application → GitHub Repository
- Repository: maddynolan/QAOne
- Branch: main
- Dockerfile: Dockerfile.frontend
- Domain: app.flowstral.com
- Port: 80
- Build arg: VITE_API_BASE_URL=https://api.flowstral.com

### Test Worker
- Type: Application → GitHub Repository
- Repository: maddynolan/QAOne
- Branch: main
- Dockerfile: backend/Dockerfile.worker
- No public domain (background service)
- Environment: Same as backend + WORKER_ID=worker-1 + WORKER_CAPACITY=5

## Step 6: Database Migrations

After PostgreSQL is running, the backend auto-runs migrations on startup via `auto_migrate.py`.

To seed demo data, set `SEED_DEMO_DATA=true` in the backend environment. On next restart, the backend will populate realistic demo content (50 test cases, 20 runs, 10 defects, etc.).

## Step 7: Monitoring (Optional)

Deploy Prometheus + Grafana using the existing configs:

### Prometheus
- Image: prom/prometheus:latest
- Mount: prometheus/prometheus.yml → /etc/prometheus/prometheus.yml
- Port: 9090 (internal or expose at metrics.flowstral.com)

### Grafana
- Image: grafana/grafana:latest
- Mount: grafana/datasources/ → /etc/grafana/provisioning/datasources/
- Mount: grafana/dashboards/ → /etc/grafana/provisioning/dashboards/
- Port: 3000 → grafana.flowstral.com
- Default login: admin / admin (change on first login)

## Step 8: Verify Deployment

```bash
# Health check
curl https://api.flowstral.com/health

# Check database
curl https://api.flowstral.com/health/database

# Open frontend
open https://app.flowstral.com
```

## Backup Strategy

### Database (automated via Coolify)
Coolify supports scheduled PostgreSQL backups to S3-compatible storage:
1. Go to PostgreSQL service → Backups
2. Configure S3 endpoint (Cloudflare R2 recommended: $0 egress)
3. Schedule: Daily at 3 AM
4. Retention: 7 daily, 4 weekly

### Manual backup
```bash
# SSH into server
docker exec qaai-postgres pg_dump -U qaai -F c qaai > backup-$(date +%Y%m%d).dump

# Restore
docker exec -i qaai-postgres pg_restore -U qaai -d qaai < backup-20260224.dump
```

## Updating

Push to `main` branch triggers automatic rebuild in Coolify (if auto-deploy is enabled).

Manual update:
1. Go to service in Coolify dashboard
2. Click "Redeploy"

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check DATABASE_URL points to correct Coolify PG service name |
| Frontend blank page | Verify VITE_API_BASE_URL is set to https://api.flowstral.com |
| CORS errors | Check FRONTEND_URL env var matches https://app.flowstral.com |
| WebSocket fails | Ensure Cloudflare WebSocket support is on (Settings → Network) |
| Out of memory | Upgrade to CX42 (16 GB) — Hetzner allows live upgrades |
