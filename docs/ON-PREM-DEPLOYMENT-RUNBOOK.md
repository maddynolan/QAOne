# Flowstral On-Premises Deployment Runbook

> Step-by-step guide for deploying the Flowstral QA Platform in your own infrastructure.
> Three deployment methods are covered: Docker Compose, Kubernetes/Helm, and Air-Gapped.
>
> Last updated: 2026-02-23

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: Docker Compose (Small Teams)](#method-1-docker-compose-small-teams)
4. [Method 2: Kubernetes / Helm (Production Scale)](#method-2-kubernetes--helm-production-scale)
5. [Method 3: Air-Gapped (Regulated Environments)](#method-3-air-gapped-regulated-environments)
6. [Hybrid Deployment Mode](#hybrid-deployment-mode)
7. [Environment Variables Reference](#environment-variables-reference)
8. [SSL/TLS Certificate Setup](#ssltls-certificate-setup)
9. [Database Setup and Migration](#database-setup-and-migration)
10. [Backup and Restore](#backup-and-restore)
11. [Health Checks](#health-checks)
12. [Monitoring Setup](#monitoring-setup)
13. [Troubleshooting](#troubleshooting)
14. [Upgrade Procedure](#upgrade-procedure)

---

## Architecture Overview

```
                         +------------------+
                         |   Load Balancer  |
                         |  (nginx / ALB)   |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |                           |
           +--------+--------+        +--------+--------+
           |    Frontend     |        |    Backend API   |
           |  (nginx + SPA)  |        | (FastAPI/uvicorn)|
           |    Port 80/443  |        |    Port 8000     |
           +-----------------+        +--------+---------+
                                               |
                    +-------------+------------+-------------+
                    |             |            |              |
           +--------+--+  +------+-----+  +---+------+  +---+--------+
           | PostgreSQL |  |   Redis    |  |  MinIO   |  | Test       |
           |  (pgvector)|  |  (cache/   |  | (S3-     |  | Workers   |
           |  Port 5432 |  |   queue)   |  | compat)  |  | (Playwright|
           +------------+  |  Port 6379 |  | Port 9000|  |  runners) |
                           +------------+  +----------+  +-----------+

           +------------------+    +------------------+
           |   Prometheus     |    |    Grafana        |
           |   Port 9090      |    |   Port 3001       |
           | (optional)       |    |  (optional)        |
           +------------------+    +------------------+

           +------------------+
           |   Ollama         |
           |   Port 11434     |
           | (air-gapped only)|
           +------------------+
```

### Component Summary

| Component | Image | Purpose | Required |
|-----------|-------|---------|----------|
| **Frontend** | `qaai/frontend` (nginx:alpine) | Serves React SPA, proxies API calls | Yes |
| **Backend** | `qaai/backend` (python:3.10-slim) | FastAPI application server | Yes |
| **PostgreSQL** | `pgvector/pgvector:pg16` | Primary database with pgvector extension | Yes |
| **Redis** | `redis:7-alpine` | Caching, job queues, session storage | Yes |
| **MinIO** | `minio/minio:latest` | S3-compatible object storage for artifacts | Yes |
| **Test Workers** | `qaai/test-worker` (Playwright base) | Headless browser test execution | Yes |
| **Ollama** | `ollama/ollama:latest` | Local LLM inference (air-gapped only) | Air-gapped only |
| **Prometheus** | `prom/prometheus:latest` | Metrics collection | Optional |
| **Grafana** | `grafana/grafana:latest` | Dashboards and alerting | Optional |

---

## Prerequisites

### Hardware Requirements

| Tier | CPU | RAM | Disk | Recommended For |
|------|-----|-----|------|-----------------|
| **Minimum** | 4 cores | 16 GB | 100 GB SSD | Development, evaluation (up to 5 users) |
| **Standard** | 8 cores | 32 GB | 200 GB SSD | Small teams (5-20 users) |
| **Production** | 16+ cores | 64 GB | 500 GB SSD | Enterprise (20-100+ users) |
| **Air-Gapped + LLM** | 16+ cores | 64 GB + GPU | 500 GB SSD | Add GPU for Ollama (NVIDIA recommended) |

### Software Requirements

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Docker Engine | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Kubernetes | 1.26+ | Container orchestration (Method 2 only) |
| Helm | 3.12+ | Kubernetes package manager (Method 2 only) |
| kubectl | 1.26+ | Kubernetes CLI (Method 2 only) |
| Git | 2.30+ | Clone repository |

### Network Requirements

| Port | Service | Protocol | Direction |
|------|---------|----------|-----------|
| 80 | Frontend (HTTP) | TCP | Inbound |
| 443 | Frontend (HTTPS) | TCP | Inbound |
| 8000 | Backend API | TCP | Internal |
| 5432 | PostgreSQL | TCP | Internal |
| 6379 | Redis | TCP | Internal |
| 9000 | MinIO API | TCP | Internal |
| 9001 | MinIO Console | TCP | Internal (admin) |
| 9090 | Prometheus | TCP | Internal (monitoring) |
| 3001 | Grafana | TCP | Internal (monitoring) |
| 11434 | Ollama | TCP | Internal (air-gapped) |

### DNS and Certificates

- A DNS record pointing to the deployment host (e.g., `flowstral.yourcompany.com`)
- TLS certificate for HTTPS (self-signed, corporate CA, or Let's Encrypt)

---

## Method 1: Docker Compose (Small Teams)

> Best for teams of 5-20 users. Uses `docker-compose.full.yml` which ships in the repository.
> Deploys all components on a single host with cloud LLM (OpenAI/Anthropic) for AI features.

### Step 1: Clone the Repository

```bash
git clone https://github.com/maddynolan/QAOne.git /opt/flowstral
cd /opt/flowstral
```

### Step 2: Create the Environment File

Create `.env` in the repository root:

```bash
cat > /opt/flowstral/.env << 'EOF'
# --- Database ---
POSTGRES_USER=qaai
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here
POSTGRES_DB=qaai

# --- MinIO (S3-compatible storage) ---
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=CHANGE_ME_minio_secret_here

# --- AI / LLM Configuration ---
# AI is OFF by default. No AI keys are required for deployment.
# Users enable AI via Settings > AI tab and can bring their own keys (BYOK).
#
# Optional: Provide server-level fallback keys. These are used when a user/org
# has not configured their own BYOK key.
# OPENAI_API_KEY=sk-your-openai-api-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
DEFAULT_LLM_PROVIDER=openai

# --- BYOK Key Encryption ---
# Required if users will store their own AI API keys via Settings > AI tab.
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=CHANGE_ME_generate_fernet_key

# --- JWT Authentication ---
JWT_SECRET=CHANGE_ME_generate_with_openssl_rand_hex_32
JWT_ALGORITHM=HS256

# --- Frontend Build-Time Variable ---
# Set to your server's public URL or IP
VITE_API_BASE_URL=http://flowstral.yourcompany.com:8000

# --- Optional: LLM Usage Tracking ---
TRACK_LLM_USAGE=true
EOF
```

Generate strong passwords and keys:

```bash
# Generate random passwords
openssl rand -hex 16   # Use for POSTGRES_PASSWORD
openssl rand -hex 16   # Use for MINIO_ROOT_PASSWORD
openssl rand -hex 32   # Use for JWT_SECRET

# Generate Fernet key for BYOK API key encryption
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Use for ENCRYPTION_KEY
```

### Step 3: Build the Docker Images

```bash
cd /opt/flowstral

# Build all images (backend, frontend, test worker)
docker compose -f docker-compose.full.yml build
```

This builds three images:
- `qaai-backend` from `backend/Dockerfile` (Python 3.10, non-root user)
- `qaai-frontend` from `Dockerfile.frontend` (Node 20 build stage, nginx:alpine serve stage)
- `qaai-test-worker` from `backend/Dockerfile.worker` (Playwright base with browser binaries)

### Step 4: Start All Services

```bash
docker compose -f docker-compose.full.yml up -d
```

Expected startup order (enforced by `depends_on` with health checks):
1. PostgreSQL, Redis, MinIO start in parallel
2. Backend starts after all three are healthy
3. Frontend and Test Workers start after Backend

### Step 5: Verify the Deployment

```bash
# Check all containers are running
docker compose -f docker-compose.full.yml ps

# Check backend health
curl -s http://localhost:8000/health
# Expected: {"status":"ok"}

# Check database connectivity
curl -s http://localhost:8000/health/database
# Expected: {"status":"ok","message":"Database connection successful","tables_found":true}

# Check full diagnostics
curl -s http://localhost:8000/health/diagnostic | python3 -m json.tool

# Check frontend is serving
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# Check MinIO health
curl -s http://localhost:9000/minio/health/live
# Expected: HTTP 200

# Check Redis
docker exec qaai-redis redis-cli ping
# Expected: PONG
```

### Step 6: Access the Platform

| Interface | URL | Credentials |
|-----------|-----|-------------|
| Flowstral Web App | `http://localhost:3000` | Create account on first visit |
| Backend API Docs | `http://localhost:8000/docs` | No auth required |
| MinIO Console | `http://localhost:9001` | MINIO_ROOT_USER / MINIO_ROOT_PASSWORD |

### Step 7: Create the S3 Artifact Bucket

```bash
# Install MinIO client
docker exec qaai-minio mc alias set local http://localhost:9000 minioadmin minioadmin

# Create the artifacts bucket
docker exec qaai-minio mc mb local/qa-artifacts

# Verify
docker exec qaai-minio mc ls local/
```

### Step 8: Scale Test Workers (Optional)

```bash
# Scale to 4 test worker instances
docker compose -f docker-compose.full.yml up -d --scale test-worker=4

# Verify workers
docker compose -f docker-compose.full.yml ps test-worker
```

---

## Method 2: Kubernetes / Helm (Production Scale)

> Best for 20-100+ users with high availability requirements. The Helm chart lives
> at `helm/qaai/` in the repository and includes Bitnami dependencies for PostgreSQL,
> Redis, and MinIO.

### Step 1: Prerequisites

```bash
# Verify tools
kubectl version --client
helm version

# Verify cluster access
kubectl cluster-info

# Install NGINX Ingress Controller (if not already present)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Install cert-manager for TLS (recommended)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

### Step 2: Create a Namespace and Secrets

```bash
# Create namespace
kubectl create namespace flowstral

# Create secrets for sensitive values
kubectl create secret generic qaai-secrets \
  --namespace flowstral \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)" \
  --from-literal=MINIO_ROOT_PASSWORD="$(openssl rand -hex 16)" \
  --from-literal=ENCRYPTION_KEY="$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
  # Optional: Add server-provided AI keys as fallbacks (AI is OFF by default)
  # --from-literal=OPENAI_API_KEY='sk-your-openai-api-key' \
  # --from-literal=ANTHROPIC_API_KEY='sk-ant-your-anthropic-key'
```

### Step 3: Build and Push Docker Images

```bash
# Set your private registry
REGISTRY=registry.yourcompany.com/flowstral

# Build images
cd /opt/flowstral
docker build -t $REGISTRY/backend:latest -f backend/Dockerfile backend/
docker build -t $REGISTRY/frontend:latest \
  --build-arg VITE_API_BASE_URL=https://flowstral.yourcompany.com \
  -f Dockerfile.frontend .
docker build -t $REGISTRY/test-worker:latest -f backend/Dockerfile.worker backend/

# Push to registry
docker push $REGISTRY/backend:latest
docker push $REGISTRY/frontend:latest
docker push $REGISTRY/test-worker:latest
```

### Step 4: Configure values.yaml

Create a custom values file `values-production.yaml`:

```yaml
# values-production.yaml - Production overrides
global:
  imageRegistry: "registry.yourcompany.com/flowstral"
  imagePullSecrets:
    - name: regcred

# PostgreSQL (Bitnami subchart)
postgresql:
  enabled: true
  auth:
    username: qaai
    password: ""              # Pulled from qaai-secrets
    existingSecret: qaai-secrets
    secretKeys:
      adminPasswordKey: POSTGRES_PASSWORD
      userPasswordKey: POSTGRES_PASSWORD
    database: qaai
  persistence:
    enabled: true
    size: 50Gi
    storageClass: "standard"  # Adjust for your cluster
  postgresqlExtendedConf:
    shared_preload_libraries: "vector"
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"

# MinIO (Bitnami subchart)
minio:
  enabled: true
  auth:
    rootUser: minioadmin
    rootPassword: ""
    existingSecret: qaai-secrets
  persistence:
    enabled: true
    size: 100Gi
    storageClass: "standard"
  defaultBuckets: "qa-artifacts"

# Redis (Bitnami subchart)
redis:
  enabled: true
  auth:
    enabled: false
  master:
    persistence:
      enabled: true
      size: 10Gi
      storageClass: "standard"

# Backend API
backend:
  image:
    repository: registry.yourcompany.com/flowstral/backend
    tag: latest
    pullPolicy: Always
  replicaCount: 3
  service:
    type: ClusterIP
    port: 8000
  env:
    DATABASE_URL: "postgresql://qaai:$(POSTGRES_PASSWORD)@qaai-postgresql:5432/qaai"
    S3_ENDPOINT_URL: "http://qaai-minio:9000"
    S3_ACCESS_KEY: "minioadmin"
    S3_BUCKET_NAME: "qa-artifacts"
    REDIS_URL: "redis://qaai-redis-master:6379"
    DEFAULT_LLM_PROVIDER: "openai"
    TRACK_LLM_USAGE: "true"
  resources:
    requests:
      memory: "2Gi"
      cpu: "1000m"
    limits:
      memory: "4Gi"
      cpu: "2000m"
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

# Ollama (disabled for cloud LLM deployments)
ollama:
  enabled: false

# Test Workers (Playwright runners)
testWorkers:
  enabled: true
  replicaCount: 3
  image:
    repository: registry.yourcompany.com/flowstral/test-worker
    tag: latest
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"

# Ingress
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/websocket-services: "qaai-backend"
  hosts:
    - host: flowstral.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: qaai-tls
      hosts:
        - flowstral.yourcompany.com
```

### Step 5: Add Bitnami Helm Repository and Update Dependencies

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

cd /opt/flowstral/helm/qaai
helm dependency build
```

### Step 6: Install the Chart

```bash
helm install qaai ./helm/qaai \
  --namespace flowstral \
  --create-namespace \
  -f values-production.yaml \
  --timeout 10m \
  --wait
```

### Step 7: Verify the Deployment

```bash
# Check all pods
kubectl get pods -n flowstral
# Expected: All pods in Running state

# Check services
kubectl get svc -n flowstral

# Check ingress
kubectl get ingress -n flowstral

# Test backend health from inside the cluster
kubectl exec -n flowstral deploy/qaai-backend -- curl -s http://localhost:8000/health
# Expected: {"status":"ok"}

# Check pod logs
kubectl logs -n flowstral deploy/qaai-backend --tail=50
kubectl logs -n flowstral deploy/qaai-worker --tail=50
```

### Step 8: Create a ClusterIssuer for TLS (cert-manager)

```yaml
# letsencrypt-prod.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@yourcompany.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

```bash
kubectl apply -f letsencrypt-prod.yaml
```

### Step 9: Access the Platform

```bash
# Get the external IP
kubectl get svc -n ingress-nginx ingress-nginx-controller

# Access via browser
# https://flowstral.yourcompany.com
```

---

## Method 3: Air-Gapped (Regulated Environments)

> For environments with no internet access. Uses Ollama for local LLM inference
> instead of cloud APIs. The repository ships `docker-compose.air-gapped.yml` for
> this purpose.

### Phase A: Preparation (Internet-Connected Machine)

#### Step 1: Pull All Required Images

```bash
# Pull all images needed for air-gapped deployment
docker pull postgres:16
docker pull redis:7-alpine
docker pull minio/minio:latest
docker pull ollama/ollama:latest
docker pull node:20-alpine
docker pull nginx:alpine
docker pull python:3.10-slim
docker pull mcr.microsoft.com/playwright/python:v1.40.0-focal
docker pull prom/prometheus:latest
docker pull grafana/grafana:latest
```

#### Step 2: Build Application Images

```bash
cd /opt/flowstral

# Build backend
docker build -t qaai/backend:latest -f backend/Dockerfile backend/

# Build frontend (set API URL to match air-gapped host)
docker build -t qaai/frontend:latest \
  --build-arg VITE_API_BASE_URL=http://flowstral.internal:8000 \
  -f Dockerfile.frontend .

# Build test worker
docker build -t qaai/test-worker:latest -f backend/Dockerfile.worker backend/
```

#### Step 3: Pre-Pull Ollama Models

```bash
# Start Ollama temporarily to download models
docker run -d --name ollama-prep -v ollama_prep:/root/.ollama ollama/ollama:latest

# Pull the recommended model for air-gapped use
docker exec ollama-prep ollama pull qwen2.5-coder:7b

# Optionally pull a larger model if hardware allows
# docker exec ollama-prep ollama pull qwen2.5-coder:14b

# Stop the temporary container
docker stop ollama-prep
```

#### Step 4: Save Everything to a Tarball

```bash
# Save all Docker images to a single archive
docker save -o flowstral-images.tar \
  postgres:16 \
  redis:7-alpine \
  minio/minio:latest \
  ollama/ollama:latest \
  qaai/backend:latest \
  qaai/frontend:latest \
  qaai/test-worker:latest \
  prom/prometheus:latest \
  grafana/grafana:latest

# Save the Ollama model volume
docker run --rm -v ollama_prep:/source -v $(pwd):/backup alpine \
  tar czf /backup/ollama-models.tar.gz -C /source .

# Package the repository (source, configs, migrations)
tar czf flowstral-source.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  /opt/flowstral

# Create a manifest
echo "Flowstral Air-Gapped Bundle" > MANIFEST.txt
echo "Created: $(date -u)" >> MANIFEST.txt
echo "Images: flowstral-images.tar ($(du -h flowstral-images.tar | cut -f1))" >> MANIFEST.txt
echo "Models: ollama-models.tar.gz ($(du -h ollama-models.tar.gz | cut -f1))" >> MANIFEST.txt
echo "Source: flowstral-source.tar.gz ($(du -h flowstral-source.tar.gz | cut -f1))" >> MANIFEST.txt

echo ""
echo "Transfer these files to the air-gapped environment:"
echo "  - flowstral-images.tar"
echo "  - ollama-models.tar.gz"
echo "  - flowstral-source.tar.gz"
echo "  - MANIFEST.txt"
```

### Phase B: Installation (Air-Gapped Machine)

#### Step 5: Load Docker Images

```bash
# Load all Docker images
docker load -i /media/transfer/flowstral-images.tar

# Verify images loaded
docker images | grep -E "(qaai|postgres|redis|minio|ollama|prometheus|grafana)"
```

#### Step 6: Extract Source and Models

```bash
# Extract source code
mkdir -p /opt/flowstral
tar xzf /media/transfer/flowstral-source.tar.gz -C /opt/flowstral --strip-components=1

# Create Ollama data volume and restore models
docker volume create ollama_data
docker run --rm -v ollama_data:/dest -v /media/transfer:/backup alpine \
  tar xzf /backup/ollama-models.tar.gz -C /dest
```

#### Step 7: Configure Environment

```bash
cat > /opt/flowstral/.env << 'EOF'
# --- Database ---
POSTGRES_USER=qaai
POSTGRES_PASSWORD=CHANGE_ME_strong_password_here
POSTGRES_DB=qaai

# --- Air-Gapped Mode ---
AIR_GAPPED_MODE=true

# --- JWT ---
JWT_SECRET=CHANGE_ME_generate_a_long_random_string
JWT_ALGORITHM=HS256

# --- No cloud API keys needed ---
# OPENAI_API_KEY is not set (Ollama provides LLM)
# ANTHROPIC_API_KEY is not set
EOF
```

#### Step 8: Start Services

```bash
cd /opt/flowstral

docker compose -f docker-compose.air-gapped.yml up -d
```

#### Step 9: Verify Ollama Model Availability

```bash
# Check Ollama is running and model is loaded
docker exec qa-ai-ollama ollama list
# Expected output should show qwen2.5-coder:7b

# Test model inference
docker exec qa-ai-ollama ollama run qwen2.5-coder:7b "Say hello in one word"
```

#### Step 10: Verify All Services

```bash
# Backend health
curl -s http://localhost:8000/health
# Expected: {"status":"ok"}

# Full diagnostic
curl -s http://localhost:8000/health/diagnostic | python3 -m json.tool
# Check that "ollama": "ok" and "database": "ok"

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
# Expected: 200
```

#### Air-Gapped Access

| Interface | URL |
|-----------|-----|
| Flowstral Web App | `http://localhost:8080` |
| Backend API Docs | `http://localhost:8000/docs` |
| Ollama API | `http://localhost:11434` |

---

## Hybrid Deployment Mode

> SaaS-hosted frontend with on-premises backend and database. Combines the convenience of managed frontend hosting with the data sovereignty of on-prem infrastructure.

### When to Use Hybrid Mode

Hybrid deployment is recommended when:

- **Regulated industries** (healthcare, finance, government) require that test data, recordings, and AI processing stay within the organization's network
- **Data sovereignty requirements** mandate that all data remains in a specific geographic region or jurisdiction
- **Security policies** prohibit sensitive application data from leaving the corporate network
- **Existing infrastructure** -- the customer already has Docker/Kubernetes clusters and wants to leverage them for the backend
- **BYOK AI keys** must never leave the customer's infrastructure (encrypted keys stored on customer-controlled database)

### Architecture

```
                  ┌──────────────────────────────────────┐
                  │         Public Cloud (SaaS)           │
                  │                                      │
                  │   ┌──────────────────────────┐       │
                  │   │  Frontend (Coolify/Vercel) │      │
                  │   │  app.flowstral.com         │      │
                  │   │  React SPA + CDN           │      │
                  │   └────────────┬───────────────┘      │
                  │                │                       │
                  └────────────────┼───────────────────────┘
                                   │
                         HTTPS / WSS (encrypted)
                         VITE_API_BASE_URL points here
                                   │
                  ┌────────────────┼───────────────────────┐
                  │                ▼                        │
                  │   Customer Network (On-Prem)            │
                  │                                         │
                  │   ┌────────────────────────┐            │
                  │   │  Backend API            │           │
                  │   │  FastAPI + Uvicorn       │          │
                  │   │  Docker / K8s            │          │
                  │   │  api.customer.internal   │          │
                  │   └──────────┬───────────────┘          │
                  │              │                           │
                  │   ┌──────┬──┴──┬──────┬──────┐          │
                  │   │      │     │      │      │          │
                  │   ▼      ▼     ▼      ▼      ▼          │
                  │ PgSQL  Redis  MinIO  Workers Ollama     │
                  │ (data) (cache)(files)(tests) (optional) │
                  │                                         │
                  └─────────────────────────────────────────┘
```

### Key Principle

All sensitive data (test recordings, AI API keys, test results, user data, screenshots, and artifacts) stays within the customer's network. The SaaS-hosted frontend is a static React SPA that communicates exclusively with the customer's backend over HTTPS.

### Setup Instructions

**1. Deploy the Frontend (SaaS-hosted)**

Use Coolify on Hetzner or Vercel to host the frontend. The critical configuration is the `VITE_API_BASE_URL` build argument, which must point to the customer's backend URL:

```bash
# Build the frontend Docker image pointing to the customer backend
docker build -t qaai/frontend:latest \
  --build-arg VITE_API_BASE_URL=https://api.customer-domain.com \
  -f Dockerfile.frontend .
```

Or set in Vercel environment variables:

```env
VITE_API_BASE_URL=https://api.customer-domain.com
```

The frontend is a static SPA with no server-side processing. It contains no secrets, no API keys, and no customer data. It is safe to host on any CDN or static hosting provider.

**2. Deploy the Backend (Customer On-Prem)**

Follow either [Method 1: Docker Compose](#method-1-docker-compose-small-teams) or [Method 2: Kubernetes / Helm](#method-2-kubernetes--helm-production-scale) from this runbook to deploy the backend on the customer's infrastructure.

Key environment variables for the on-prem backend:

```env
# Database (on-prem PostgreSQL)
DATABASE_URL=postgresql://qaai:password@postgres.internal:5432/qaai

# Storage (on-prem MinIO)
S3_ENDPOINT_URL=http://minio.internal:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=<strong-password>
S3_BUCKET_NAME=qa-artifacts

# Redis (on-prem)
REDIS_URL=redis://redis.internal:6379

# CORS -- must include the SaaS frontend domain
CORS_ORIGINS=https://app.flowstral.com,https://customer-app.flowstral.com

# JWT and encryption
JWT_SECRET=<generate-64-char-hex>
ENCRYPTION_KEY=<generate-fernet-key>

# AI -- keys stay on customer infrastructure
# OPENAI_API_KEY=sk-... (optional server fallback)
# Users store BYOK keys via Settings > AI; encrypted in customer's DB
```

**3. Configure CORS**

The on-prem backend must allow cross-origin requests from the SaaS frontend domain. Set `CORS_ORIGINS` to include the exact frontend URL:

```env
CORS_ORIGINS=https://app.flowstral.com
```

The FastAPI middleware in `backend/app/main.py` reads this variable and configures CORS headers accordingly.

**4. Configure TLS / HTTPS**

The connection between the SaaS frontend and the on-prem backend **must use HTTPS**. Options:

| Method | Description |
|--------|-------------|
| **Reverse proxy (recommended)** | Place nginx or a load balancer in front of the backend with a TLS certificate |
| **cert-manager (Kubernetes)** | Use cert-manager with Let's Encrypt or a corporate CA |
| **Self-signed + trust** | Use a self-signed cert and configure the browser to trust the corporate CA |

The backend must be accessible from the public internet (or via VPN) at the URL specified in `VITE_API_BASE_URL`.

### BYOK AI in Hybrid Mode

BYOK (Bring Your Own Key) AI integration works naturally in hybrid mode because all key storage and AI API calls happen on the customer's backend:

1. User enters their API key in **Settings > AI** in the frontend
2. Key is sent via HTTPS to the customer's backend (`POST /api/ai/settings/key`)
3. Backend encrypts the key with Fernet (`ENCRYPTION_KEY` on customer's server) and stores it in the customer's PostgreSQL database (`ai_encrypted_keys` table)
4. When AI features are used, the backend decrypts the key and makes API calls to OpenAI/Anthropic directly from the customer's network
5. The SaaS frontend never sees, stores, or transmits the decrypted API key

This ensures AI API keys never leave the customer's infrastructure boundary.

### Network Requirements

| Connection | Protocol | Direction | Required |
|-----------|----------|-----------|----------|
| Frontend (SaaS) to Backend (On-Prem) | HTTPS (443) | Outbound from user browser | Yes |
| Frontend (SaaS) to Backend (On-Prem) | WSS (443) | Outbound from user browser | Yes (for real-time test execution) |
| Backend to PostgreSQL | TCP (5432) | Internal on-prem | Yes |
| Backend to Redis | TCP (6379) | Internal on-prem | Yes |
| Backend to MinIO | TCP (9000) | Internal on-prem | Yes |
| Backend to OpenAI/Anthropic API | HTTPS (443) | Outbound from on-prem | Only if AI features are used |

**WebSocket support is required** between the frontend and backend for real-time test execution progress updates. Ensure any reverse proxy, load balancer, or firewall between them supports the HTTP Upgrade header for WebSocket connections.

### Comparison with Full SaaS and Full On-Prem

| Aspect | Full SaaS | Hybrid | Full On-Prem |
|--------|-----------|--------|-------------|
| Frontend hosting | Cloud (Vercel/Coolify) | Cloud (Vercel/Coolify) | Customer infrastructure |
| Backend hosting | Cloud (Railway) | Customer infrastructure | Customer infrastructure |
| Database | Cloud (Supabase) | Customer infrastructure | Customer infrastructure |
| Data location | Cloud provider | Customer network | Customer network |
| AI key storage | Cloud (encrypted) | Customer network (encrypted) | Customer network (encrypted) |
| Setup complexity | Low | Medium | High |
| Maintenance | Managed | Shared | Customer-managed |
| Frontend updates | Automatic (CI/CD) | Automatic (CI/CD) | Manual rebuild required |

---

## Environment Variables Reference

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://qaai:qaai_password@postgres:5432/qaai` | PostgreSQL connection string |
| `POSTGRES_USER` | `qaai` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `qaai_password` | PostgreSQL password (**change in production**) |
| `POSTGRES_DB` | `qaai` | PostgreSQL database name |
| `JWT_SECRET` | none | Secret key for JWT token signing (**required**) |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |

### Storage Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_ENDPOINT_URL` | `http://minio:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `S3_SECRET_KEY` | `minioadmin` | MinIO secret key (**change in production**) |
| `S3_BUCKET_NAME` | `qa-artifacts` | Bucket for test artifacts |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `MINIO_ROOT_USER` | `minioadmin` | MinIO console username |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO console password (**change in production**) |

### LLM Provider Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_LLM_PROVIDER` | `openai` | LLM provider: `openai`, `anthropic`, or `local_qwen` |
| `OPENAI_API_KEY` | none | Server-provided OpenAI API key (optional fallback -- users can BYOK via Settings) |
| `ANTHROPIC_API_KEY` | none | Server-provided Anthropic API key (optional fallback -- users can BYOK via Settings) |
| `OLLAMA_URL` | `http://ollama:11434` | Ollama endpoint (air-gapped only) |
| `TRACK_LLM_USAGE` | `false` | Track LLM token usage and costs |
| `AIR_GAPPED_MODE` | `false` | Enable air-gapped mode (disables cloud LLM calls) |
| `ENCRYPTION_KEY` | none | Fernet symmetric key for encrypting BYOK API keys at rest (**required for BYOK**) |
| `SECRETS_ENCRYPTION_KEY` | none | Alias for `ENCRYPTION_KEY` (either may be used) |

### Frontend Build Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API URL (set at Docker build time) |
| `VITE_GA4_MEASUREMENT_ID` | none | Google Analytics 4 ID (optional, disabled in on-prem) |
| `VITE_CLARITY_PROJECT_ID` | none | Microsoft Clarity ID (optional) |
| `VITE_CRISP_WEBSITE_ID` | none | Crisp live chat ID (optional) |

### Worker Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_ID` | `worker-1` | Unique identifier for this worker instance |
| `WORKER_CAPACITY` | `5` | Maximum concurrent test executions per worker |

---

## SSL/TLS Certificate Setup

### Option A: cert-manager with Let's Encrypt (Kubernetes)

This is configured automatically when using Method 2 with the `cert-manager.io/cluster-issuer` annotation in values.yaml. Certificates are automatically provisioned and renewed.

```yaml
# In values-production.yaml (already included above)
ingress:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    - secretName: qaai-tls
      hosts:
        - flowstral.yourcompany.com
```

### Option B: Self-Signed Certificates (Docker Compose)

```bash
# Generate a self-signed certificate
mkdir -p /opt/flowstral/certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /opt/flowstral/certs/flowstral.key \
  -out /opt/flowstral/certs/flowstral.crt \
  -subj "/C=US/ST=State/L=City/O=YourCompany/CN=flowstral.yourcompany.com"
```

Create `nginx/ssl.conf` to replace `nginx/default.conf`:

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=static:10m rate=50r/s;

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/certs/flowstral.crt;
    ssl_certificate_key /etc/nginx/certs/flowstral.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    server_tokens off;

    location / {
        limit_req zone=static burst=20 nodelay;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://backend:8000/health;
        proxy_set_header Host $host;
    }
}
```

Mount the certificates in `docker-compose.full.yml` by adding to the `frontend` service:

```yaml
frontend:
  # ... existing config ...
  volumes:
    - ./certs:/etc/nginx/certs:ro
    - ./nginx/ssl.conf:/etc/nginx/conf.d/default.conf:ro
  ports:
    - "80:80"
    - "443:443"
```

### Option C: Corporate CA Certificate

```bash
# Place your corporate CA-signed certificate and key:
cp /path/to/corporate-cert.pem /opt/flowstral/certs/flowstral.crt
cp /path/to/corporate-key.pem /opt/flowstral/certs/flowstral.key

# If you have a CA chain file, concatenate it:
cat /path/to/corporate-cert.pem /path/to/ca-chain.pem > /opt/flowstral/certs/flowstral.crt
```

Then use the same nginx SSL configuration as Option B above.

---

## Database Setup and Migration

### PostgreSQL with pgvector

The `docker-compose.full.yml` uses the `pgvector/pgvector:pg16` image which includes the pgvector extension pre-installed. The air-gapped compose file uses standard `postgres:16`.

### Automatic Migration

Database migrations run automatically on backend startup. The `supabase/migrations/` directory is mounted into the PostgreSQL container as `/docker-entrypoint-initdb.d/`, which PostgreSQL executes on first initialization.

Migration files are numbered and executed in order:

```
supabase/migrations/
  001_initial_schema.sql
  002_ai_generations.sql
  003_ai_templates.sql
  004_requirements_table.sql
  005_fix_ai_generations.sql
  006_enhance_test_lifecycle.sql
  007_rag_foundation.sql
  008_ai_generations_quality_tracking.sql
  009_model_registry.sql
  010_add_test_types.sql
  ...
```

### Manual Migration

If you need to run migrations manually (e.g., after an upgrade):

```bash
# Docker Compose
docker exec -i qaai-postgres psql -U qaai -d qaai < supabase/migrations/011_new_migration.sql

# Kubernetes
kubectl exec -n flowstral deploy/qaai-postgresql -- \
  psql -U qaai -d qaai < supabase/migrations/011_new_migration.sql
```

### Connection String Format

```
postgresql://<user>:<password>@<host>:<port>/<database>
```

Examples:
- Docker Compose: `postgresql://qaai:qaai_password@postgres:5432/qaai`
- Kubernetes: `postgresql://qaai:qaai_password@qaai-postgresql:5432/qaai`
- External DB: `postgresql://qaai:password@db.yourcompany.com:5432/qaai?sslmode=require`

### Using an External PostgreSQL Database

To use an existing PostgreSQL 16+ instance instead of the containerized one:

1. Disable the built-in PostgreSQL in `docker-compose.full.yml` by commenting out the `postgres` service.
2. Install the pgvector extension on your external database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Set `DATABASE_URL` in `.env` to point to your external database.
4. Run the initial migrations manually from `supabase/migrations/`.

---

## AI Configuration (v3.14.0+)

### AI is OFF by Default

The Flowstral platform does not require any AI/LLM API keys to deploy and operate. All core functionality -- recording, test management, execution, API testing, performance testing, accessibility scanning, visual testing, and mobile testing -- works without AI.

AI-powered features (test generation, self-healing, Flowpilot agents, etc.) are disabled by default and must be explicitly enabled by an organization admin via **Settings > AI**.

### Server-Provided AI Keys (Optional)

If you want to provide AI capabilities as part of your deployment without requiring users to bring their own keys, set these environment variables:

```bash
# Server-level fallback keys (used when org has no BYOK key configured)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key   # Optional
```

These server-provided keys are used as fallbacks. If an organization has configured their own BYOK key, the org-specific key takes precedence.

### Bring Your Own Key (BYOK)

Users can provide their own AI API keys via **Settings > AI tab** in the web application. BYOK keys are:

- **Encrypted at rest** using Fernet symmetric encryption (AES-128-CBC)
- **Never stored in frontend** state or localStorage (only `hasApiKey: boolean` is tracked)
- **Sent to backend** via `POST /api/ai/settings/key`, encrypted, and stored in the `ai_encrypted_keys` table
- **Resolved per-request** by the backend: BYOK key > server env var > AI unavailable

**Required for BYOK:** The `ENCRYPTION_KEY` environment variable must be set to a valid Fernet key:

```bash
# Generate a Fernet key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Set in .env
ENCRYPTION_KEY=<generated-fernet-key>
```

If `ENCRYPTION_KEY` is not set, users will not be able to store BYOK keys (the platform will still function, but without BYOK capability).

### AI Key Resolution Chain

When an AI endpoint is called, the backend resolves the API key in this order:

1. **BYOK key** -- Check `ai_encrypted_keys` table for an org/project-specific key (Fernet-decrypted)
2. **Server env var** -- Check `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable
3. **AI unavailable** -- Return HTTP 503 for AI endpoints

### AI Toggle Hierarchy

```
Server env (OPENAI_API_KEY)       <-- Platform-provided key (fallback)
  +-- Org settings (ai_settings)  <-- Admin enables AI, stores BYOK key
       +-- Project override       <-- Optional per-project settings
            +-- Feature toggles   <-- 20 granular feature flags
```

### AI API Endpoints

The following endpoints are added for AI configuration management:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/ai/settings` | Get org AI settings (enabled, provider, features, has_key) |
| `PUT` | `/api/ai/settings` | Update settings (enabled, provider, model, features) |
| `POST` | `/api/ai/settings/key` | Store BYOK API key (Fernet-encrypted) |
| `DELETE` | `/api/ai/settings/key/{provider}` | Remove stored key |
| `POST` | `/api/ai/settings/test` | Test connection with stored/provided key |
| `GET` | `/api/ai/settings/providers` | List providers + which have keys configured |
| `GET` | `/api/ai/settings/usage` | Get current period usage stats |

### Database Tables (Auto-Created)

Migration `034_ai_settings.sql` creates:
- `ai_settings` -- Per-org AI configuration, 20 feature toggles, budget limits
- `ai_usage_log` -- LLM call tracking per org (provider, model, tokens, cost, feature)

The `ai_encrypted_keys` table is created at runtime by `AISettingsService` (not in SQL migrations) to store Fernet-encrypted BYOK API keys.

All three tables are also bootstrapped by `auto_migrate.py` on backend startup, ensuring they exist regardless of whether the SQL migration file was applied.

---

## Backup and Restore

### PostgreSQL Backup

```bash
# --- Docker Compose ---

# Full backup
docker exec qaai-postgres pg_dump -U qaai -d qaai -Fc > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore
docker exec -i qaai-postgres pg_restore -U qaai -d qaai --clean --if-exists < backup_20260223_120000.dump

# --- Kubernetes ---

# Full backup
kubectl exec -n flowstral deploy/qaai-postgresql -- \
  pg_dump -U qaai -d qaai -Fc > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore
kubectl exec -i -n flowstral deploy/qaai-postgresql -- \
  pg_restore -U qaai -d qaai --clean --if-exists < backup_20260223_120000.dump
```

### MinIO Backup

```bash
# Install mc (MinIO Client) if not available
docker exec qaai-minio mc alias set local http://localhost:9000 minioadmin minioadmin

# Mirror the artifacts bucket to a local directory
docker exec qaai-minio mc mirror local/qa-artifacts /backup/minio-artifacts

# Or use mc from outside the container
mc alias set flowstral http://localhost:9000 minioadmin minioadmin
mc mirror flowstral/qa-artifacts ./backup/minio-artifacts/
```

### Redis Backup

```bash
# Trigger an RDB snapshot
docker exec qaai-redis redis-cli BGSAVE

# Copy the dump file
docker cp qaai-redis:/data/dump.rdb ./backup/redis-dump.rdb

# Restore (stop Redis, replace dump.rdb, start Redis)
docker stop qaai-redis
docker cp ./backup/redis-dump.rdb qaai-redis:/data/dump.rdb
docker start qaai-redis
```

### Full Automated Backup Script

```bash
#!/bin/bash
# flowstral-backup.sh - Run daily via cron
# Usage: ./flowstral-backup.sh /path/to/backup/dir

set -euo pipefail

BACKUP_DIR="${1:-/opt/flowstral/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${BACKUP_PATH}"

echo "[$(date)] Starting Flowstral backup to ${BACKUP_PATH}"

# 1. PostgreSQL
echo "[$(date)] Backing up PostgreSQL..."
docker exec qaai-postgres pg_dump -U qaai -d qaai -Fc \
  > "${BACKUP_PATH}/postgres.dump"
echo "  PostgreSQL: $(du -h "${BACKUP_PATH}/postgres.dump" | cut -f1)"

# 2. Redis
echo "[$(date)] Backing up Redis..."
docker exec qaai-redis redis-cli BGSAVE
sleep 2
docker cp qaai-redis:/data/dump.rdb "${BACKUP_PATH}/redis.rdb"
echo "  Redis: $(du -h "${BACKUP_PATH}/redis.rdb" | cut -f1)"

# 3. MinIO artifacts
echo "[$(date)] Backing up MinIO artifacts..."
docker exec qaai-minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null
docker exec qaai-minio mc mirror --quiet local/qa-artifacts /tmp/minio-backup
docker cp qaai-minio:/tmp/minio-backup "${BACKUP_PATH}/minio-artifacts"
docker exec qaai-minio rm -rf /tmp/minio-backup
echo "  MinIO: $(du -sh "${BACKUP_PATH}/minio-artifacts" | cut -f1)"

# 4. Environment config (exclude secrets from backup — store separately)
echo "[$(date)] Backing up configuration..."
cp /opt/flowstral/docker-compose.full.yml "${BACKUP_PATH}/"
# Do NOT backup .env with secrets — manage separately

# 5. Compress
echo "[$(date)] Compressing backup..."
tar czf "${BACKUP_DIR}/flowstral-backup-${TIMESTAMP}.tar.gz" -C "${BACKUP_DIR}" "${TIMESTAMP}"
rm -rf "${BACKUP_PATH}"

# 6. Retain last 7 daily backups
echo "[$(date)] Cleaning old backups (retaining 7)..."
ls -1t "${BACKUP_DIR}"/flowstral-backup-*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null || true

FINAL_SIZE=$(du -h "${BACKUP_DIR}/flowstral-backup-${TIMESTAMP}.tar.gz" | cut -f1)
echo "[$(date)] Backup complete: flowstral-backup-${TIMESTAMP}.tar.gz (${FINAL_SIZE})"
```

Add to cron for daily backups at 2:00 AM:

```bash
chmod +x /opt/flowstral/flowstral-backup.sh
echo "0 2 * * * /opt/flowstral/flowstral-backup.sh /opt/flowstral/backups >> /var/log/flowstral-backup.log 2>&1" | crontab -
```

---

## Health Checks

### Endpoints

| Endpoint | Method | Purpose | Expected Response |
|----------|--------|---------|-------------------|
| `/health` | GET | Overall service status | `{"status": "ok"}` |
| `/health/database` | GET | PostgreSQL connectivity | `{"status": "ok", "message": "Database connection successful", "tables_found": true}` |
| `/health/diagnostic` | GET | All subsystems check | `{"status": "ok", "checks": {"database": "ok", "ollama": "ok"}}` |
| `/health/db-test` | GET | Detailed DB diagnostics | Connection string, table list, pool status |

### Health Check Script

```bash
#!/bin/bash
# flowstral-healthcheck.sh - Use as a monitoring probe

BACKEND_URL="${1:-http://localhost:8000}"

echo "=== Flowstral Health Check ==="
echo "Target: ${BACKEND_URL}"
echo ""

# Basic health
HTTP_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" "${BACKEND_URL}/health")
if [ "$HTTP_CODE" = "200" ]; then
  echo "[PASS] Backend API: HTTP ${HTTP_CODE}"
else
  echo "[FAIL] Backend API: HTTP ${HTTP_CODE}"
fi

# Database
HTTP_CODE=$(curl -s -o /tmp/dbhealth.json -w "%{http_code}" "${BACKEND_URL}/health/database")
DB_STATUS=$(cat /tmp/dbhealth.json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unreachable")
if [ "$DB_STATUS" = "ok" ]; then
  echo "[PASS] Database: ${DB_STATUS}"
else
  echo "[FAIL] Database: ${DB_STATUS}"
fi

# Diagnostic
HTTP_CODE=$(curl -s -o /tmp/diag.json -w "%{http_code}" "${BACKEND_URL}/health/diagnostic")
if [ "$HTTP_CODE" = "200" ]; then
  OVERALL=$(cat /tmp/diag.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
  echo "[INFO] Diagnostic: ${OVERALL}"
  cat /tmp/diag.json | python3 -m json.tool 2>/dev/null
else
  echo "[FAIL] Diagnostic endpoint: HTTP ${HTTP_CODE}"
fi

# Redis
REDIS_PONG=$(docker exec qaai-redis redis-cli ping 2>/dev/null || echo "FAIL")
if [ "$REDIS_PONG" = "PONG" ]; then
  echo "[PASS] Redis: PONG"
else
  echo "[FAIL] Redis: ${REDIS_PONG}"
fi

# MinIO
MINIO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:9000/minio/health/live" 2>/dev/null || echo "000")
if [ "$MINIO_CODE" = "200" ]; then
  echo "[PASS] MinIO: HTTP ${MINIO_CODE}"
else
  echo "[FAIL] MinIO: HTTP ${MINIO_CODE}"
fi

rm -f /tmp/health.json /tmp/dbhealth.json /tmp/diag.json
```

---

## Monitoring Setup

### Deploy Prometheus and Grafana

The repository includes `docker-compose.monitoring.yml` for monitoring services.

#### Step 1: Ensure the Network Exists

The monitoring stack uses the `qa-ai-network` network as an external network. Create it if it does not exist:

```bash
docker network create qa-ai-network 2>/dev/null || true
```

#### Step 2: Create Prometheus Configuration

The repository includes `prometheus/prometheus.yml`:

```yaml
# prometheus/prometheus.yml (already in repo)
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'flowstral-backend'
    metrics_path: /metrics
    static_configs:
      - targets: ['backend:8000']
        labels:
          service: 'flowstral-api'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

#### Step 3: Create Grafana Datasource Configuration

```bash
mkdir -p /opt/flowstral/grafana/datasources
cat > /opt/flowstral/grafana/datasources/prometheus.yaml << 'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF
```

#### Step 4: Create Grafana Dashboard Provisioning

```bash
mkdir -p /opt/flowstral/grafana/dashboards
cat > /opt/flowstral/grafana/dashboards/dashboards.yaml << 'EOF'
apiVersion: 1
providers:
  - name: 'default'
    orgId: 1
    folder: 'Flowstral'
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
      foldersFromFilesStructure: false
EOF
```

#### Step 5: Start the Monitoring Stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

#### Step 6: Access Monitoring

| Interface | URL | Credentials |
|-----------|-----|-------------|
| Prometheus | `http://localhost:9090` | No auth |
| Grafana | `http://localhost:3001` | admin / admin (change on first login) |

### Recommended Alert Rules

Configure these alerts in Grafana or Prometheus Alertmanager:

| Alert | Condition | Severity |
|-------|-----------|----------|
| Backend Down | `/health` returns non-200 for > 1 minute | Critical |
| Database Unreachable | `/health/database` status is "error" for > 30 seconds | Critical |
| High API Latency | p95 response time > 5 seconds for > 5 minutes | Warning |
| High Error Rate | HTTP 5xx rate > 5% of total requests for > 2 minutes | Critical |
| Disk Space Low | Volume usage > 85% | Warning |
| Disk Space Critical | Volume usage > 95% | Critical |
| Worker Queue Backlog | Pending test executions > 50 for > 10 minutes | Warning |
| Redis Memory High | Redis used_memory > 80% of maxmemory | Warning |

---

## Troubleshooting

### Backend Will Not Start

**Symptom:** Container exits immediately or restarts in a loop.

```bash
# Check logs
docker logs qaai-backend --tail=100

# Common causes:
# 1. DATABASE_URL is wrong or PostgreSQL is not ready
# 2. Port 8000 is already in use
# 3. Python dependency missing
```

**Fix: DATABASE_URL connection refused**
```bash
# Verify PostgreSQL is running and healthy
docker exec qaai-postgres pg_isready -U qaai
# Expected: accepting connections

# Verify the connection string is correct
docker exec qaai-backend python -c "
import os
print('DATABASE_URL:', os.getenv('DATABASE_URL', 'NOT SET'))
"

# If the container name changed, update DATABASE_URL to match
# the service name in docker-compose (e.g., postgres, not localhost)
```

**Fix: Port conflict**
```bash
# Check what is using port 8000
ss -tlnp | grep 8000
# Or on macOS:
lsof -i :8000

# Change the host port in docker-compose:
# ports: - "8001:8000"
```

### Frontend Shows Blank Page

**Symptom:** Browser loads but shows a white screen. Console shows network errors.

```bash
# Check if the frontend container is running
docker logs qaai-frontend --tail=50

# The most common cause is VITE_API_BASE_URL mismatch.
# This is a BUILD-TIME variable, not runtime. You must rebuild:
docker compose -f docker-compose.full.yml build frontend \
  --build-arg VITE_API_BASE_URL=http://your-actual-backend-url:8000

docker compose -f docker-compose.full.yml up -d frontend
```

**Fix: CORS errors in browser console**
```bash
# The backend allows all origins by default. If you see CORS errors,
# check that the frontend is reaching the backend through the correct URL.
# Use the nginx proxy path (/api/) rather than direct backend access.
```

### Tests Not Executing

**Symptom:** Tests remain in "pending" state, no progress shown.

```bash
# Check test worker logs
docker logs qaai-test-worker --tail=100

# Verify workers are connected to Redis
docker exec qaai-redis redis-cli LLEN test_execution_queue

# Verify Playwright browsers are installed in the worker
docker exec qaai-test-worker python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('about:blank')
    print('Playwright OK:', page.title())
    browser.close()
"
```

**Fix: Playwright browser binaries missing**
```bash
# The worker Dockerfile is based on mcr.microsoft.com/playwright/python:v1.40.0-focal
# which includes browsers. If using a custom image:
docker exec qaai-test-worker python -m playwright install chromium
```

### Slow Performance

**Symptom:** API responses are slow, tests take too long.

```bash
# Check Redis connection and latency
docker exec qaai-redis redis-cli INFO stats | grep -E "instantaneous_ops|connected_clients"

# Check PostgreSQL active connections
docker exec qaai-postgres psql -U qaai -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check container resource usage
docker stats --no-stream

# Check disk I/O
docker exec qaai-postgres iostat -x 1 3 2>/dev/null || echo "iostat not available"
```

**Fix: Increase backend workers**
```bash
# Override the uvicorn command to use more workers
# In docker-compose.full.yml, change the backend command:
# command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# Or scale backend replicas (Kubernetes)
kubectl scale deployment qaai-backend -n flowstral --replicas=4
```

### MinIO Bucket Does Not Exist

**Symptom:** File upload or artifact storage fails with "bucket not found".

```bash
# Create the bucket manually
docker exec qaai-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec qaai-minio mc mb local/qa-artifacts --ignore-existing
docker exec qaai-minio mc ls local/
```

### Ollama Model Not Available (Air-Gapped)

**Symptom:** AI features return errors about model not found.

```bash
# Check available models
docker exec qa-ai-ollama ollama list

# If no models are listed, the volume was not restored correctly.
# Re-load from the backup:
docker volume rm ollama_data
docker volume create ollama_data
docker run --rm -v ollama_data:/dest -v /media/transfer:/backup alpine \
  tar xzf /backup/ollama-models.tar.gz -C /dest

# Restart Ollama
docker restart qa-ai-ollama

# Verify
docker exec qa-ai-ollama ollama list
```

### Container Running Out of Memory

**Symptom:** OOMKilled in Docker or Kubernetes.

```bash
# Check which container was killed
docker inspect qaai-backend | grep -A5 "OOMKilled"

# Increase memory limits in docker-compose.full.yml:
# backend:
#   deploy:
#     resources:
#       limits:
#         memory: 4G

# For Kubernetes, update values.yaml resources.limits.memory
```

---

## Upgrade Procedure

### Docker Compose Upgrade

```bash
cd /opt/flowstral

# 1. Pull the latest code
git pull origin main

# 2. Create a backup before upgrading
./flowstral-backup.sh /opt/flowstral/backups

# 3. Rebuild images with new code
docker compose -f docker-compose.full.yml build

# 4. Apply any new database migrations
# (Migrations in supabase/migrations/ run automatically on first PostgreSQL init.
#  For existing databases, apply new migrations manually.)
NEW_MIGRATIONS=$(ls supabase/migrations/*.sql | sort)
echo "Review these migrations before applying:"
echo "$NEW_MIGRATIONS"

# Apply a specific migration:
# docker exec -i qaai-postgres psql -U qaai -d qaai < supabase/migrations/011_new_migration.sql

# 5. Restart services with new images
docker compose -f docker-compose.full.yml up -d

# 6. Verify health
curl -s http://localhost:8000/health
curl -s http://localhost:8000/health/database

# 7. Check logs for errors
docker compose -f docker-compose.full.yml logs --tail=50 backend
```

### Kubernetes / Helm Upgrade

```bash
# 1. Build and push new images
REGISTRY=registry.yourcompany.com/flowstral
VERSION=1.2.0

docker build -t $REGISTRY/backend:$VERSION -f backend/Dockerfile backend/
docker build -t $REGISTRY/frontend:$VERSION \
  --build-arg VITE_API_BASE_URL=https://flowstral.yourcompany.com \
  -f Dockerfile.frontend .
docker build -t $REGISTRY/test-worker:$VERSION -f backend/Dockerfile.worker backend/

docker push $REGISTRY/backend:$VERSION
docker push $REGISTRY/frontend:$VERSION
docker push $REGISTRY/test-worker:$VERSION

# 2. Update image tags in values-production.yaml
# backend.image.tag: "1.2.0"
# testWorkers.image.tag: "1.2.0"

# 3. Update Helm dependencies (if Chart.yaml changed)
cd helm/qaai && helm dependency update && cd ../..

# 4. Perform a rolling upgrade
helm upgrade qaai ./helm/qaai \
  --namespace flowstral \
  -f values-production.yaml \
  --timeout 10m \
  --wait

# 5. Verify the rollout
kubectl rollout status deployment/qaai-backend -n flowstral
kubectl rollout status deployment/qaai-frontend -n flowstral
kubectl rollout status deployment/qaai-worker -n flowstral

# 6. Check health
kubectl exec -n flowstral deploy/qaai-backend -- curl -s http://localhost:8000/health

# 7. If something goes wrong, rollback
# helm rollback qaai 1 --namespace flowstral
```

### Air-Gapped Upgrade

```bash
# On the internet-connected machine:
# 1. Pull latest code and rebuild images (same as Phase A steps 1-4)
# 2. Save new images to tarball
# 3. Transfer to air-gapped environment

# On the air-gapped machine:
# 1. Load new images
docker load -i /media/transfer/flowstral-images-v1.2.0.tar

# 2. Create a backup
./flowstral-backup.sh /opt/flowstral/backups

# 3. Extract updated source (for migrations, configs)
tar xzf /media/transfer/flowstral-source-v1.2.0.tar.gz -C /opt/flowstral --strip-components=1

# 4. Restart with new images
cd /opt/flowstral
docker compose -f docker-compose.air-gapped.yml up -d

# 5. Verify
curl -s http://localhost:8000/health
```

### Rollback

If an upgrade causes issues:

```bash
# Docker Compose: restore from backup
docker compose -f docker-compose.full.yml down

# Restore database
docker compose -f docker-compose.full.yml up -d postgres
sleep 10  # Wait for PostgreSQL to be ready
docker exec -i qaai-postgres pg_restore -U qaai -d qaai --clean --if-exists < backup_before_upgrade.dump

# Restore previous images (if you tagged them before upgrading)
# docker tag qaai/backend:previous qaai/backend:latest

docker compose -f docker-compose.full.yml up -d

# Kubernetes: Helm rollback
helm history qaai --namespace flowstral
helm rollback qaai <revision-number> --namespace flowstral
```

---

## Appendix: Quick Command Reference

| Task | Command |
|------|---------|
| Start all services | `docker compose -f docker-compose.full.yml up -d` |
| Stop all services | `docker compose -f docker-compose.full.yml down` |
| View backend logs | `docker logs qaai-backend --tail=100 -f` |
| View worker logs | `docker logs qaai-test-worker --tail=100 -f` |
| Check health | `curl -s http://localhost:8000/health` |
| Check DB health | `curl -s http://localhost:8000/health/database` |
| Full diagnostics | `curl -s http://localhost:8000/health/diagnostic \| python3 -m json.tool` |
| Scale workers | `docker compose -f docker-compose.full.yml up -d --scale test-worker=4` |
| Enter DB shell | `docker exec -it qaai-postgres psql -U qaai -d qaai` |
| Enter Redis shell | `docker exec -it qaai-redis redis-cli` |
| Backup DB | `docker exec qaai-postgres pg_dump -U qaai -d qaai -Fc > backup.dump` |
| Restart backend | `docker compose -f docker-compose.full.yml restart backend` |
| Rebuild and restart | `docker compose -f docker-compose.full.yml up -d --build` |
| Check container resources | `docker stats --no-stream` |
| K8s: Check pods | `kubectl get pods -n flowstral` |
| K8s: Backend logs | `kubectl logs -n flowstral deploy/qaai-backend --tail=100` |
| K8s: Scale backend | `kubectl scale deployment qaai-backend -n flowstral --replicas=4` |
| K8s: Helm upgrade | `helm upgrade qaai ./helm/qaai -n flowstral -f values-production.yaml` |
| K8s: Helm rollback | `helm rollback qaai <revision> -n flowstral` |
