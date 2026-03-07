# Flowstral Security Configuration Guide

> Practical, deployment-focused security configuration for the Flowstral QA Platform (QAAI).
> Covers environment variables, TLS, database hardening, key rotation, network security,
> logging/monitoring, backup/recovery, MFA, and GDPR/privacy compliance.
>
> **Audience:** DevOps engineers, platform administrators, security teams, compliance officers.
> **Deployment contexts:** On-premises (banks, healthcare, government), SaaS, and hybrid.
> **Last updated:** 2026-03-06
>
> **Related documents:**
> - [Enterprise Security Guide](./ENTERPRISE-SECURITY-GUIDE.md) -- Architecture-level security reference (RBAC, multi-tenancy, encryption design)
> - [On-Prem Deployment Runbook](./ON-PREM-DEPLOYMENT-RUNBOOK.md) -- Step-by-step deployment instructions
> - [SaaS Deployment Guide](./SAAS-DEPLOYMENT-GUIDE.md) -- Cloud deployment on Railway/Vercel/Supabase
> - [Deployment and Data Architecture](./DEPLOYMENT-AND-DATA-ARCHITECTURE.md) -- Infrastructure topology and data flow

---

## Table of Contents

1. [Required Environment Variables](#1-required-environment-variables)
2. [TLS Certificate Setup](#2-tls-certificate-setup)
3. [Database Security](#3-database-security)
4. [Key Rotation Procedures](#4-key-rotation-procedures)
5. [Network Security](#5-network-security)
6. [Logging and Monitoring](#6-logging-and-monitoring)
7. [Backup and Recovery](#7-backup-and-recovery)
8. [MFA Configuration](#8-mfa-configuration)
9. [GDPR and Privacy Configuration](#9-gdpr-and-privacy-configuration)

---

## 1. Required Environment Variables

Every Flowstral deployment must configure the variables below before starting services. The `docker-compose.full.yml` enforces required variables with the `?` suffix (e.g., `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}`), so the stack will refuse to start if they are missing.

### 1.1 Security-Critical Variables (Required)

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `JWT_SECRET_KEY` | `openssl rand -hex 64` output | Signs all JWT authentication tokens. Must be at least 64 hex characters. Shared across all backend instances in a cluster. |
| `ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Fernet symmetric key used to encrypt BYOK API keys stored in `ai_encrypted_keys` table and secrets vault entries. Must be a valid Fernet key (44 URL-safe base64 characters). |
| `POSTGRES_PASSWORD` | Strong random password (24+ chars) | Password for the `qaai` PostgreSQL user. Used in `DATABASE_URL` connection string. |
| `MINIO_ROOT_USER` | `flowstral-admin` | MinIO administrative username. Do NOT use `minioadmin` (the default). |
| `MINIO_ROOT_PASSWORD` | Strong random password (24+ chars) | MinIO administrative password. Controls access to all stored artifacts (screenshots, HAR files, test evidence). |
| `REDIS_PASSWORD` | Strong random password (24+ chars) | Redis authentication password. Passed via `--requirepass` flag. Leave empty only in isolated development environments. |
| `CORS_ALLOWED_ORIGINS` | `https://app.flowstral.com` | Comma-separated list of origins permitted to make cross-origin requests to the backend. In production, restrict to your exact frontend domain. Never use `*` in production. |

### 1.2 Application Configuration Variables (Required)

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `APP_ENV` | `production` | Controls behavior: `production` enables HTTPS enforcement, strict CORS, and disables debug endpoints. Other values: `development`, `staging`. |
| `DATABASE_URL` | `postgresql://qaai:PASSWORD@qaai-postgres:5432/qaai` | Full PostgreSQL connection string. Points to PgBouncer (port 6432) in production, direct PostgreSQL (port 5432) in dev. |
| `REDIS_URL` | `redis://:PASSWORD@qaai-redis:6379` | Redis connection URL. Include password when `REDIS_PASSWORD` is set. |
| `FRONTEND_URL` | `https://app.flowstral.com` | Used for CORS origin matching and redirect URLs. Must match the actual domain serving the frontend. |
| `INTERNAL_SERVICE_KEY` | `openssl rand -hex 32` output | Shared secret for service-to-service calls (backend to test workers, internal health probes). Nginx strips this header from external requests. |
| `UPLOAD_MAX_SIZE_MB` | `50` | Maximum file upload size in megabytes. Applies to HAR imports, spec uploads, and screenshot uploads. Must match `client_max_body_size` in nginx. |
| `RATE_LIMIT_BACKEND` | `memory` or `redis` | Rate limiting storage backend. Use `memory` for single-process deployments. Use `redis` for multi-worker or multi-node deployments so rate limits are shared across processes. |

### 1.3 AI/LLM Variables (Optional)

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `OPENAI_API_KEY` | `sk-proj-...` | Platform-level OpenAI API key (fallback). Per-org BYOK keys take precedence when configured. Not required if all orgs provide their own keys. |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Platform-level Anthropic API key (fallback). Used for Claude-based features (prompt caching, complex reasoning). Optional. |
| `DEFAULT_LLM_PROVIDER` | `openai` | Which LLM provider to use by default: `openai`, `anthropic`, or `ollama` (air-gapped). |
| `OPENAI_TEST_CASE_MODEL` | `gpt-4o-mini` | Model used for test case generation and AI features. |
| `OPENAI_TEMPERATURE` | `0.2` | LLM temperature for test generation. Lower values produce more deterministic output. |
| `OPENAI_MAX_TOKENS` | `2000` | Maximum tokens per LLM response. |
| `TRACK_LLM_USAGE` | `true` | Enable per-org LLM usage tracking and budget enforcement. |

### 1.4 Pre-Deployment Checklist

Before starting services, verify the following:

- [ ] All required variables are set (run `docker compose config` to validate)
- [ ] `JWT_SECRET_KEY` is at least 64 hex characters and was generated with a CSPRNG
- [ ] `ENCRYPTION_KEY` is a valid Fernet key (test with `python -c "from cryptography.fernet import Fernet; Fernet(b'YOUR_KEY')"`)
- [ ] `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, and `REDIS_PASSWORD` are unique, random, and at least 24 characters
- [ ] `CORS_ALLOWED_ORIGINS` does not contain `*` or `localhost` in production
- [ ] `APP_ENV` is set to `production`
- [ ] `INTERNAL_SERVICE_KEY` is set and is not reused from any other system
- [ ] `UPLOAD_MAX_SIZE_MB` matches `client_max_body_size` in `nginx/default.conf`
- [ ] AI keys (if used) are not committed to version control

### 1.5 Generating Secrets

```bash
# JWT secret (64 hex characters = 256 bits)
openssl rand -hex 64

# Fernet encryption key
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generic strong password (24 characters, alphanumeric + special)
openssl rand -base64 32 | tr -d '=' | head -c 24

# Internal service key
openssl rand -hex 32
```

---

## 2. TLS Certificate Setup

All production deployments must terminate TLS. Flowstral supports three certificate sources: Let's Encrypt (automated), corporate CA (enterprise), and self-signed (development/internal).

### 2.1 Option A: Let's Encrypt (SaaS / Internet-Facing)

Use Certbot with the nginx plugin for automatic certificate issuance and renewal.

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate (stops nginx briefly for verification)
certbot certonly --standalone -d app.flowstral.com -d api.flowstral.com

# Certificate files are placed at:
#   /etc/letsencrypt/live/app.flowstral.com/fullchain.pem
#   /etc/letsencrypt/live/app.flowstral.com/privkey.pem

# Auto-renewal (runs twice daily by default)
certbot renew --dry-run
```

For Docker deployments, mount the certificate directory into the nginx container:

```yaml
# docker-compose.full.yml addition
services:
  frontend:
    volumes:
      - /etc/letsencrypt/live/app.flowstral.com:/etc/nginx/ssl:ro
      - /etc/letsencrypt/archive/app.flowstral.com:/etc/nginx/ssl-archive:ro
```

### 2.2 Option B: Corporate CA (On-Premises)

Enterprises typically issue certificates from an internal PKI. Obtain the following from your CA team:

| File | Purpose | Nginx Directive |
|------|---------|-----------------|
| `server.crt` (or `fullchain.pem`) | Server certificate + intermediate chain | `ssl_certificate` |
| `server.key` (or `privkey.pem`) | Private key (RSA 2048+ or ECDSA P-256+) | `ssl_certificate_key` |
| `ca-bundle.crt` | Root CA + intermediate CA bundle | `ssl_trusted_certificate` (for OCSP stapling) |

```bash
# Verify the certificate chain
openssl verify -CAfile ca-bundle.crt server.crt

# Verify key matches certificate
openssl x509 -noout -modulus -in server.crt | openssl md5
openssl rsa  -noout -modulus -in server.key  | openssl md5
# Both MD5 hashes must match

# Place files with restricted permissions
chmod 644 /etc/nginx/ssl/fullchain.pem
chmod 600 /etc/nginx/ssl/privkey.pem
chown root:root /etc/nginx/ssl/*
```

### 2.3 Option C: Self-Signed (Development / Air-Gapped Internal)

Use only for development or fully isolated air-gapped networks where no CA is available.

```bash
# Generate a self-signed certificate (valid 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/privkey.pem \
  -out /etc/nginx/ssl/fullchain.pem \
  -subj "/CN=flowstral.internal/O=YourOrg/C=US" \
  -addext "subjectAltName=DNS:flowstral.internal,DNS:*.flowstral.internal,IP:10.0.0.50"

# Trust the certificate on client machines (varies by OS)
# Ubuntu/Debian:
cp fullchain.pem /usr/local/share/ca-certificates/flowstral.crt && update-ca-certificates
# RHEL/CentOS:
cp fullchain.pem /etc/pki/ca-trust/source/anchors/ && update-ca-trust
# Windows:
# Import via certmgr.msc -> Trusted Root Certification Authorities
```

### 2.4 Nginx TLS Configuration

The production TLS block is pre-configured in `nginx/default.conf` (currently commented out). Uncomment the HTTPS server block and configure:

```nginx
server {
    listen 443 ssl http2;
    server_name app.flowstral.com;

    # Certificate paths
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # TLS 1.2+ only (TLS 1.0 and 1.1 are deprecated)
    ssl_protocols TLSv1.2 TLSv1.3;

    # Strong cipher suite (AEAD ciphers, forward secrecy)
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers on;

    # OCSP Stapling (improves TLS handshake performance)
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/ca-bundle.crt;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Session caching (reduces repeated TLS handshakes)
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # DH parameters for DHE ciphers
    # Generate: openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;

    # HSTS (force browsers to use HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # ... rest of server config (copy from HTTP block) ...
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

### 2.5 TLS Validation Checklist

After configuring TLS, verify the setup:

- [ ] Certificate chain is complete (server cert + intermediates)
- [ ] Private key permissions are `600` (owner read/write only)
- [ ] TLS 1.0 and 1.1 are disabled (test with `nmap --script ssl-enum-ciphers -p 443 your-domain`)
- [ ] HSTS header is present in responses
- [ ] HTTP-to-HTTPS redirect works (`curl -I http://your-domain`)
- [ ] SSL Labs test scores A or A+ (https://www.ssllabs.com/ssltest/)
- [ ] Certificate expiry monitoring is configured (see Section 6)

---

## 3. Database Security

### 3.1 PostgreSQL Authentication

Flowstral uses PostgreSQL 16 with pgvector. Secure the database at the authentication level:

```
# pg_hba.conf — restrict connections
# TYPE  DATABASE  USER     ADDRESS          METHOD

# Local connections (Unix socket)
local   all       all                       scram-sha-256

# Backend containers (Docker network)
host    qaai      qaai     172.16.0.0/12    scram-sha-256

# PgBouncer sidecar
host    qaai      qaai     127.0.0.1/32     scram-sha-256

# Reject everything else
host    all       all      0.0.0.0/0        reject
```

Enforce SCRAM-SHA-256 authentication (stronger than MD5):

```sql
-- In postgresql.conf
-- password_encryption = 'scram-sha-256'

-- Set user password with SCRAM
ALTER USER qaai WITH PASSWORD 'your-strong-password';
```

### 3.2 Encryption at Rest

#### Option A: PostgreSQL-Level Encryption (pgcrypto)

Flowstral already encrypts sensitive fields (BYOK API keys) with Fernet via the `ENCRYPTION_KEY` environment variable. For additional column-level encryption:

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example: encrypt a sensitive column
UPDATE ai_encrypted_keys
SET encrypted_key = pgp_sym_encrypt(raw_key, 'your-encryption-passphrase')
WHERE ...;

-- Decrypt
SELECT pgp_sym_decrypt(encrypted_key::bytea, 'your-encryption-passphrase')
FROM ai_encrypted_keys;
```

#### Option B: Filesystem-Level Encryption (LUKS)

For full disk encryption (required by HIPAA, PCI-DSS, and many government standards):

```bash
# Create an encrypted volume for PostgreSQL data
cryptsetup luksFormat /dev/sdb
cryptsetup luksOpen /dev/sdb pgdata-crypt
mkfs.ext4 /dev/mapper/pgdata-crypt
mount /dev/mapper/pgdata-crypt /var/lib/postgresql/data

# Auto-unlock at boot (with key file stored in HSM or secure location)
echo "pgdata-crypt /dev/sdb /root/luks-keyfile luks" >> /etc/crypttab
```

#### Option C: Cloud-Provider Encryption

| Provider | Feature | Configuration |
|----------|---------|---------------|
| AWS RDS | Encryption at rest | Enable during instance creation (AES-256, KMS-managed) |
| Azure Database | TDE (Transparent Data Encryption) | Enabled by default on Azure Database for PostgreSQL |
| GCP Cloud SQL | Encryption at rest | Enabled by default (Google-managed or CMEK) |
| Hetzner | Volume encryption | Not natively available; use LUKS on attached volumes |

### 3.3 Connection Pooling with PgBouncer

Flowstral includes a PgBouncer configuration at `deploy/pgbouncer/pgbouncer.ini`. In production, route all backend connections through PgBouncer.

| Setting | Value | Purpose |
|---------|-------|---------|
| `pool_mode` | `transaction` | Return connections to pool after each transaction (most efficient) |
| `max_client_conn` | `200` | Maximum simultaneous client connections |
| `default_pool_size` | `20` | Server connections per database |
| `reserve_pool_size` | `5` | Extra connections for burst traffic |
| `auth_type` | `scram-sha-256` | Match PostgreSQL authentication method |

```bash
# Point backend at PgBouncer instead of PostgreSQL directly
DATABASE_URL=postgresql://qaai:PASSWORD@pgbouncer:6432/qaai
```

### 3.4 Row-Level Security (RLS)

Flowstral enforces multi-tenancy at the application layer via `TenantContextMiddleware`. For defense-in-depth, enable RLS on sensitive tables:

```sql
-- Enable RLS on test_cases table
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows for their organization
CREATE POLICY tenant_isolation ON test_cases
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Set org context per connection (done by middleware)
SET app.current_org_id = 'org-uuid-here';
```

**Tables to protect with RLS:**

| Table | Isolation Field | Priority |
|-------|----------------|----------|
| `test_cases` | `org_id` | High |
| `test_runs` | `org_id` | High |
| `ai_settings` | `org_id` | Critical |
| `ai_encrypted_keys` | `org_id` | Critical |
| `ai_usage_log` | `org_id` | Medium |
| `defects` | `project_id` (via `org_id` join) | High |
| `audit_logs` | `org_id` | High |

### 3.5 Database Hardening Checklist

- [ ] `POSTGRES_PASSWORD` is 24+ characters, randomly generated
- [ ] `pg_hba.conf` restricts connections to known networks only
- [ ] SCRAM-SHA-256 is the authentication method (not MD5 or trust)
- [ ] `ssl = on` in `postgresql.conf` with valid server certificate
- [ ] Encryption at rest is enabled (LUKS, cloud-provider, or pgcrypto)
- [ ] PgBouncer is deployed for connection pooling in production
- [ ] `max_connections` in PostgreSQL is set appropriately (default 100; PgBouncer handles client-side scaling)
- [ ] `log_statement = 'ddl'` in `postgresql.conf` (log schema changes)
- [ ] `log_connections = on` and `log_disconnections = on` for audit trail
- [ ] Regular `VACUUM` and `ANALYZE` are scheduled via `pg_cron` or crontab

---

## 4. Key Rotation Procedures

Regular key rotation limits the blast radius of a compromised key. Follow these procedures on the cadence specified.

### 4.1 JWT Secret Key Rotation

**Rotation cadence:** Every 90 days, or immediately if compromised.

**Impact:** All existing user sessions are invalidated. Users must re-authenticate.

**Procedure:**

1. Generate a new JWT secret:
   ```bash
   NEW_JWT_SECRET=$(openssl rand -hex 64)
   ```

2. Update the environment variable on all backend instances:
   ```bash
   # Docker Compose
   # Update .env file with new JWT_SECRET_KEY value
   # Then restart backend services
   docker compose restart backend
   ```

3. For zero-downtime rotation (Kubernetes):
   ```bash
   # Update the secret
   kubectl create secret generic flowstral-secrets \
     --from-literal=JWT_SECRET_KEY=$NEW_JWT_SECRET \
     --dry-run=client -o yaml | kubectl apply -f -

   # Rolling restart (pods pick up new secret)
   kubectl rollout restart deployment/flowstral-backend
   ```

4. Verify: Confirm existing tokens are rejected and new logins succeed.

### 4.2 Encryption Key (Fernet) Rotation

**Rotation cadence:** Every 180 days, or immediately if compromised.

**Impact:** Stored BYOK API keys and secrets vault entries must be re-encrypted.

**Procedure:**

1. Generate a new Fernet key:
   ```bash
   NEW_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
   ```

2. Re-encrypt all stored secrets (run from backend container):
   ```python
   # re_encrypt_keys.py
   from cryptography.fernet import Fernet, MultiFernet

   old_key = Fernet(b"OLD_FERNET_KEY_HERE")
   new_key = Fernet(b"NEW_FERNET_KEY_HERE")
   multi = MultiFernet([new_key, old_key])  # new key first

   # For each encrypted record in ai_encrypted_keys:
   #   decrypted = multi.decrypt(record.encrypted_key.encode())
   #   re_encrypted = new_key.encrypt(decrypted)
   #   UPDATE ai_encrypted_keys SET encrypted_key = re_encrypted WHERE id = record.id
   ```

3. Update `ENCRYPTION_KEY` environment variable to the new key.

4. Restart backend services.

5. Verify: Test that BYOK key retrieval works (Settings > AI > test connection).

### 4.3 Database Password Rotation

**Rotation cadence:** Every 90 days.

**Procedure:**

1. Generate a new password:
   ```bash
   NEW_PG_PASS=$(openssl rand -base64 32 | tr -d '=' | head -c 24)
   ```

2. Update PostgreSQL:
   ```sql
   ALTER USER qaai WITH PASSWORD 'new-password-here';
   ```

3. Update PgBouncer `userlist.txt`:
   ```
   "qaai" "new-password-here"
   ```

4. Update `DATABASE_URL` in backend environment.

5. Restart PgBouncer, then backend services.

6. Verify: Check `/health/database` endpoint returns healthy.

### 4.4 MinIO Password Rotation

**Rotation cadence:** Every 90 days.

```bash
# Connect to MinIO container and update credentials
mc alias set local http://localhost:9000 OLD_USER OLD_PASS
mc admin user add local NEW_USER NEW_PASS
mc admin policy attach local readwrite --user NEW_USER
# Update S3_ACCESS_KEY and S3_SECRET_KEY in backend .env
# Restart backend
```

### 4.5 API Key Rotation (BYOK)

**Rotation cadence:** Per-organization, recommended every 90 days.

BYOK API keys are rotated by individual organization administrators through the UI:

1. Navigate to Settings > AI Configuration.
2. Enter the new API key in the provider input field.
3. Click "Save Key" -- the old key is overwritten (encrypted with Fernet).
4. Click "Test Connection" to verify the new key works.

The platform does not store key history. Once overwritten, the old key cannot be retrieved.

### 4.6 Rotation Schedule Summary

| Secret | Cadence | Downtime | Automated |
|--------|---------|----------|-----------|
| JWT Secret Key | 90 days | Sessions invalidated (re-login) | No -- manual |
| Fernet Encryption Key | 180 days | None (with MultiFernet migration) | No -- manual |
| PostgreSQL Password | 90 days | Brief (restart PgBouncer + backend) | No -- manual |
| Redis Password | 90 days | Brief (restart Redis + backend) | No -- manual |
| MinIO Credentials | 90 days | Brief (restart backend) | No -- manual |
| TLS Certificates | Before expiry (Let's Encrypt: 90 days) | None (reload nginx) | Yes (certbot) |
| BYOK API Keys | 90 days (recommended) | None | Yes (UI self-service) |

---

## 5. Network Security

### 5.1 Required Ports

| Port | Service | Protocol | Exposure | Notes |
|------|---------|----------|----------|-------|
| **80** | Nginx (HTTP) | TCP | External | Redirects to 443 in production |
| **443** | Nginx (HTTPS) | TCP | External | Primary entry point for all traffic |
| **8000** | Backend (FastAPI) | TCP | Internal only | Never expose directly; nginx proxies `/api/*` |
| **5432** | PostgreSQL | TCP | Internal only | Direct access only from backend and PgBouncer |
| **6432** | PgBouncer | TCP | Internal only | Backend connects here instead of 5432 in production |
| **6379** | Redis | TCP | Internal only | Backend caching and rate limiting |
| **9000** | MinIO (S3 API) | TCP | Internal only | Object storage API; backend access only |
| **9001** | MinIO (Console) | TCP | Internal only | Admin console; restrict to admin VPN |
| **9090** | Prometheus | TCP | Internal only | Metrics collection |
| **3001** | Grafana | TCP | Internal / VPN | Monitoring dashboards |
| **11434** | Ollama | TCP | Internal only | Air-gapped LLM inference (when enabled) |

### 5.2 Firewall Rules

#### Minimal Ingress Rules (External)

```bash
# Allow HTTPS from anywhere (or restrict to known CIDRs)
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow HTTP for Let's Encrypt ACME challenges + redirect
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Allow SSH from admin network only
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# Drop everything else from external
iptables -A INPUT -j DROP
```

#### Internal Service Communication

```bash
# Docker network handles inter-container communication
# No additional firewall rules needed for services on the same Docker network

# If services are on separate hosts:
# Allow backend -> PostgreSQL
iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.0/24 -j ACCEPT
# Allow backend -> Redis
iptables -A INPUT -p tcp --dport 6379 -s 10.0.1.0/24 -j ACCEPT
# Allow backend -> MinIO
iptables -A INPUT -p tcp --dport 9000 -s 10.0.1.0/24 -j ACCEPT
# Allow Prometheus -> backend (metrics scraping)
iptables -A INPUT -p tcp --dport 8000 -s 10.0.2.0/24 -j ACCEPT
```

#### Kubernetes Network Policies

```yaml
# Restrict backend pod ingress to nginx only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
  namespace: qaai
spec:
  podSelector:
    matchLabels:
      app: flowstral-backend
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: flowstral-frontend
      ports:
        - port: 8000
    - from:
        - podSelector:
            matchLabels:
              app: prometheus
      ports:
        - port: 8000
  policyTypes:
    - Ingress
```

### 5.3 Internal-Only Services

These services must never be exposed to the public internet:

| Service | Why | Mitigation |
|---------|-----|------------|
| PostgreSQL (5432) | Direct database access bypasses all application-level auth | Bind to `127.0.0.1` or Docker internal network |
| Redis (6379) | No built-in ACL enforcement in basic mode; stores rate limit and cache data | Bind to Docker network; use `requirepass` |
| MinIO Console (9001) | Admin console with full bucket management | Restrict to admin VPN or disable in production |
| Prometheus (9090) | Exposes internal metrics (request rates, error counts) | Restrict to monitoring network |
| Backend (8000) | Bypasses nginx rate limiting, security headers, and TLS | Never bind to `0.0.0.0` on host |
| Ollama (11434) | LLM inference endpoint with no authentication | Air-gapped networks only |

### 5.4 Nginx Security Headers

The `nginx/default.conf` includes OWASP-recommended security headers by default:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables unused browser APIs |
| `Content-Security-Policy` | (see `nginx/default.conf`) | Restricts resource loading sources |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year |

### 5.5 Internal Service Key

Nginx strips the `X-Internal-Service-Key` header from all external requests:

```nginx
proxy_set_header X-Internal-Service-Key "";
```

Service-to-service calls (e.g., test workers calling backend) include this header for authentication. The backend validates the header value against the `INTERNAL_SERVICE_KEY` environment variable.

---

## 6. Logging and Monitoring

### 6.1 Structured Logging

The backend uses Python's `logging` module with structured JSON output in production. Key log fields:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 timestamp |
| `level` | Log level (INFO, WARNING, ERROR, CRITICAL) |
| `request_id` | Unique request ID from `TraceLoggingMiddleware` |
| `tenant_id` | Organization ID from `TenantContextMiddleware` |
| `user_id` | Authenticated user ID (when available) |
| `method` | HTTP method |
| `path` | Request path |
| `status_code` | Response status code |
| `duration_ms` | Request processing time |

The `TraceLoggingMiddleware` (`backend/app/middleware/trace_logging_middleware.py`) automatically adds request context to all log entries.

### 6.2 PII Masking

Flowstral masks sensitive data in logs and recordings:

| Data Type | Where Masked | Mask Value |
|-----------|--------------|------------|
| Passwords | Recorder (content.js), logs | `[MASKED]` |
| Authorization headers | Network capture (extension) | `[MASKED]` |
| Cookie headers | Network capture (extension) | `[MASKED]` |
| API keys/tokens | Network capture (extension) | `[MASKED]` |
| X-API-Key headers | Network capture (extension) | `[MASKED]` |
| CSRF tokens | Network capture (extension) | `[MASKED]` |
| BYOK keys (stored) | Database | Fernet-encrypted |
| BYOK keys (in transit) | API responses | Never returned |

Configure additional PII masking patterns in the backend:

```python
# Sensitive fields to redact in logs
SENSITIVE_FIELDS = [
    "password", "token", "secret", "api_key", "authorization",
    "cookie", "set-cookie", "x-api-key", "x-auth-token",
    "credit_card", "ssn", "social_security"
]
```

### 6.3 Prometheus and Grafana Setup

Flowstral includes a Prometheus configuration at `prometheus/prometheus.yml` and Grafana datasources at `grafana/`.

**Prometheus scrape targets:**

| Job | Target | Interval | Metrics |
|-----|--------|----------|---------|
| `flowstral-backend` | `backend:8000/metrics` | 10s | Request count, latency, error rate, active connections |
| `node-exporter` | `node-exporter:9100` | 15s | CPU, memory, disk, network |

**Recommended Grafana dashboards:**

| Dashboard | Panels | Alert Thresholds |
|-----------|--------|-----------------|
| API Health | Request rate, error rate (5xx), p99 latency | Error rate > 1%, p99 > 5s |
| Infrastructure | CPU, memory, disk I/O, network | CPU > 80%, memory > 85%, disk > 90% |
| Database | Active connections, query duration, replication lag | Connections > 80% max, query > 10s |
| Security | Auth failures, rate limit hits, blocked requests | Auth failures > 50/min, rate limits > 100/min |

**Alert rules (Prometheus alertmanager):**

```yaml
groups:
  - name: flowstral-security
    rules:
      - alert: HighAuthFailureRate
        expr: rate(http_requests_total{status="401"}[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"

      - alert: CertificateExpiringSoon
        expr: ssl_certificate_expiry_seconds < 604800  # 7 days
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "TLS certificate expires in less than 7 days"

      - alert: DatabaseConnectionPoolExhausted
        expr: pgbouncer_pools_server_active / pgbouncer_pools_server_maxconn > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "PgBouncer connection pool >90% utilized"
```

### 6.4 Audit Log Configuration

Flowstral has a built-in audit trail system (`backend/app/services/core/audit_service.py`).

**Configuration:**

| Setting | Default | Description |
|---------|---------|-------------|
| In-memory buffer | 10,000 entries | Rolling deque for fast queries |
| PostgreSQL persistence | Optional | Enabled when `audit_logs` table exists |
| Retention | Configurable | See Section 9 (GDPR) |

**Audited actions include:**
- User login/logout
- Test case CRUD operations
- Test execution start/stop
- AI feature usage (with token counts)
- Settings changes
- API key storage/deletion
- Role and permission changes

**API endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/audit/logs` | Query audit logs (filterable by action, user, date range) |
| `POST` | `/api/audit/logs` | Create audit entry (internal use) |
| `GET` | `/api/audit/summary` | Aggregate summary (counts by action type) |
| `GET` | `/api/audit/actions` | List distinct action types |

**Frontend:** The Audit Log page (`/audit-log`) provides a filterable table, summary cards, and CSV export.

### 6.5 Log Retention

| Log Type | Retention Period | Storage |
|----------|-----------------|---------|
| Application logs | 90 days | Container stdout (ship to SIEM) |
| Audit logs | 1 year minimum (regulatory dependent) | PostgreSQL |
| Access logs (nginx) | 90 days | File-based, logrotate |
| Metrics (Prometheus) | 30 days (default) | Prometheus TSDB |
| Security events | 1 year minimum | SIEM/audit log |

---

## 7. Backup and Recovery

### 7.1 PostgreSQL Backup

#### Automated Daily Backups

```bash
#!/bin/bash
# backup-postgres.sh — run via cron at 02:00 UTC daily

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create compressed backup
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h localhost -U qaai -d qaai \
  -Fc --compress=9 \
  -f "$BACKUP_DIR/qaai_${TIMESTAMP}.dump"

# Verify backup integrity
pg_restore --list "$BACKUP_DIR/qaai_${TIMESTAMP}.dump" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backup verification failed" | mail -s "Flowstral Backup Failure" ops@yourorg.com
  exit 1
fi

# Encrypt backup at rest (for off-site storage)
gpg --symmetric --cipher-algo AES256 \
  --passphrase-file /root/.backup-passphrase \
  "$BACKUP_DIR/qaai_${TIMESTAMP}.dump"

# Remove unencrypted dump
rm "$BACKUP_DIR/qaai_${TIMESTAMP}.dump"

# Clean up backups older than retention period
find "$BACKUP_DIR" -name "qaai_*.dump.gpg" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: qaai_${TIMESTAMP}.dump.gpg"
```

#### Cron Schedule

```cron
# Daily full backup at 02:00 UTC
0 2 * * * /opt/flowstral/backup-postgres.sh >> /var/log/backup.log 2>&1

# WAL archiving for point-in-time recovery (PITR)
# Configure in postgresql.conf:
#   archive_mode = on
#   archive_command = 'cp %p /backups/wal/%f'
#   wal_level = replica
```

#### Restore Procedure

```bash
# Stop backend services
docker compose stop backend

# Restore from backup
gpg --decrypt qaai_20260306_020000.dump.gpg | \
  pg_restore -h localhost -U qaai -d qaai --clean --if-exists

# Run pending migrations
cd /opt/flowstral && python -m backend.app.services.storage.auto_migrate

# Restart services
docker compose start backend

# Verify
curl -f http://localhost:8000/health/database
```

### 7.2 MinIO Backup

```bash
#!/bin/bash
# backup-minio.sh — backup all buckets

BACKUP_DIR="/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Mirror all buckets to local backup directory
mc mirror qaai-local/ "$BACKUP_DIR/$TIMESTAMP/" --overwrite

# Compress
tar -czf "$BACKUP_DIR/minio_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_DIR/$TIMESTAMP"

# Encrypt and clean up (same pattern as PostgreSQL)
gpg --symmetric --cipher-algo AES256 \
  --passphrase-file /root/.backup-passphrase \
  "$BACKUP_DIR/minio_${TIMESTAMP}.tar.gz"
rm "$BACKUP_DIR/minio_${TIMESTAMP}.tar.gz"
```

### 7.3 Key Escrow

Critical encryption keys must be escrowed for disaster recovery. Without these keys, encrypted data (BYOK keys, secrets vault, encrypted backups) cannot be recovered.

| Key | Escrow Location | Access Control |
|-----|----------------|----------------|
| `JWT_SECRET_KEY` | Password manager (enterprise vault) | 2+ admins required |
| `ENCRYPTION_KEY` (Fernet) | Hardware Security Module (HSM) or sealed envelope | Break-glass procedure |
| Backup encryption passphrase | Separate password manager or physical safe | 2-person rule |
| PostgreSQL root password | Password manager (enterprise vault) | DBA team only |
| TLS private key | Certificate manager or HSM | Infrastructure team |

**Escrow procedures:**

1. Generate keys using a secure, audited workstation.
2. Store in at least 2 geographically separate locations.
3. Test key recovery annually (restore a backup using escrowed keys).
4. Rotate escrowed keys on the same cadence as production keys (Section 4).
5. Log all escrow access in the audit trail.

### 7.4 Disaster Recovery Plan

| Scenario | RTO Target | RPO Target | Procedure |
|----------|------------|------------|-----------|
| Single service failure | 5 minutes | 0 (no data loss) | Docker auto-restart (`restart: unless-stopped`) |
| Database corruption | 1 hour | Last backup (up to 24 hours) | Restore from daily backup |
| Database corruption (with WAL) | 30 minutes | Minutes (PITR) | Restore base + replay WAL archives |
| Full server loss | 4 hours | Last backup | Provision new server, restore all backups |
| Data center loss | 8 hours | Last off-site backup | Deploy to DR site, restore from off-site backups |
| Encryption key compromise | 2 hours | 0 | Rotate all keys (Section 4), re-encrypt data |

### 7.5 Backup Verification Checklist

Run monthly:

- [ ] Restore PostgreSQL backup to a test instance and verify data integrity
- [ ] Restore MinIO backup and verify artifact accessibility
- [ ] Decrypt an encrypted backup using escrowed keys
- [ ] Verify WAL archive continuity (no gaps)
- [ ] Test full disaster recovery procedure on a staging environment
- [ ] Verify backup monitoring alerts fire correctly (simulate a failed backup)

---

## 8. MFA Configuration

### 8.1 TOTP Setup

Flowstral supports Time-based One-Time Password (TOTP) multi-factor authentication, compatible with Google Authenticator, Authy, Microsoft Authenticator, and any RFC 6238 compliant app.

**Endpoints (rate-limited at auth level: 10 requests/minute):**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/mfa/setup` | Generate TOTP secret + QR code URI |
| `POST` | `/api/mfa/verify` | Verify TOTP code and activate MFA |
| `POST` | `/api/mfa/validate` | Validate TOTP code during login |
| `POST` | `/api/mfa/disable` | Disable MFA (requires current TOTP code) |
| `GET` | `/api/mfa/status` | Check MFA enrollment status |
| `POST` | `/api/mfa/recovery` | Generate recovery codes |
| `POST` | `/api/mfa/recover` | Use a recovery code to bypass TOTP |

**User enrollment flow:**

1. User navigates to Settings > Security > Multi-Factor Authentication.
2. Backend generates a TOTP secret and returns a `otpauth://` URI.
3. User scans the QR code with their authenticator app.
4. User enters the 6-digit code from the app to verify enrollment.
5. Backend stores the TOTP secret (encrypted) and marks MFA as active.
6. On subsequent logins, the user enters their password + TOTP code.

### 8.2 Recovery Codes

When MFA is enabled, the system generates 10 single-use recovery codes. Each code can be used once to bypass TOTP (e.g., if the user loses their phone).

**Security requirements:**

- Recovery codes are displayed once during setup and never shown again.
- Each code is hashed (bcrypt) before storage; the plaintext is not stored.
- Used codes are permanently invalidated.
- Users can regenerate all 10 codes (invalidates all previous codes).

### 8.3 Organization-Wide MFA Enforcement

Organization administrators can require MFA for all members:

```
Settings > Organization > Security > Require MFA for all members
```

When enabled:

- Users without MFA are redirected to the MFA setup page on login.
- Users cannot access any application features until MFA is configured.
- Admins can view MFA enrollment status for all org members.
- Grace period: configurable (default 7 days) before enforcement blocks access.

### 8.4 MFA Security Considerations

| Consideration | Recommendation |
|---------------|----------------|
| TOTP secret storage | Encrypted at rest with `ENCRYPTION_KEY` (Fernet) |
| Code validity window | 30 seconds (standard TOTP), with 1-step tolerance |
| Brute-force protection | Rate limited to 10 attempts/minute per IP |
| Recovery code length | 8 alphanumeric characters per code |
| Recovery code count | 10 codes per user |
| Session after MFA | JWT issued only after successful MFA validation |

---

## 9. GDPR and Privacy Configuration

### 9.1 Data Retention Settings

Configure data retention periods based on your regulatory requirements:

| Data Category | Default Retention | GDPR Consideration | Configuration |
|---------------|-------------------|-------------------|---------------|
| Test cases | Indefinite | Legitimate interest (service delivery) | No auto-deletion |
| Test run results | 1 year | Legitimate interest (quality assurance) | `DATA_RETENTION_TEST_RUNS_DAYS=365` |
| Audit logs | 1 year | Legal obligation (compliance) | `DATA_RETENTION_AUDIT_DAYS=365` |
| User sessions | 30 days | Legitimate interest (security) | JWT expiry configuration |
| Screenshots/artifacts | 90 days | Legitimate interest (debugging) | `DATA_RETENTION_ARTIFACTS_DAYS=90` |
| AI usage logs | 90 days | Legitimate interest (billing) | `DATA_RETENTION_AI_USAGE_DAYS=90` |
| Recorder sessions | 30 days | Legitimate interest (service delivery) | `DATA_RETENTION_RECORDINGS_DAYS=30` |
| Network captures (HAR) | 30 days | Contains PII (cookies, headers) | `DATA_RETENTION_HAR_DAYS=30` |

### 9.2 Data Subject Access Requests (DSAR)

When a user requests a copy of their personal data (GDPR Article 15), the platform provides an export function:

**API endpoint:** `POST /api/privacy/export`

**Exported data includes:**

| Category | Data Included |
|----------|---------------|
| Profile | Name, email, role, organization, creation date |
| Activity | Login history, audit log entries for the user |
| Content | Test cases created/modified by the user |
| AI usage | LLM usage logs attributed to the user |
| Settings | User preferences, notification settings |

**Export format:** JSON archive (`.zip`), delivered via secure download link.

**Timeline:** Must be fulfilled within 30 days (GDPR requirement).

### 9.3 Erasure Request Handling (Right to Be Forgotten)

When a user requests data deletion (GDPR Article 17):

**API endpoint:** `POST /api/privacy/erasure`

**Erasure procedure:**

1. Verify the request (authenticated user or verified identity).
2. Delete or anonymize user profile data.
3. Delete personal data from audit logs (or anonymize: replace user ID with `[DELETED_USER]`).
4. Delete AI usage logs attributed to the user.
5. Re-attribute test cases to `[Former Team Member]` (preserving organizational data).
6. Delete stored sessions and authentication tokens.
7. Log the erasure action in the audit trail (required for compliance proof).
8. Confirm deletion to the user.

**Data that is NOT deleted (legitimate interest / legal obligation):**

| Data | Reason for Retention |
|------|---------------------|
| Audit log entries (anonymized) | Legal obligation for compliance |
| Test cases (re-attributed) | Organizational asset, legitimate interest |
| Aggregate usage statistics | No personal data (anonymized) |

**Rate limiting:** Erasure requests are rate-limited to 5/minute to prevent abuse.

### 9.4 Data Processing Inventory

Maintain a record of processing activities (GDPR Article 30):

| Processing Activity | Legal Basis | Data Categories | Retention |
|---------------------|-------------|-----------------|-----------|
| User authentication | Contract performance | Email, password hash, MFA secret | Account lifetime |
| Test case management | Contract performance | Test content, user attribution | Account lifetime |
| Browser recording | Legitimate interest + consent | DOM interactions, screenshots, network traffic | 30 days |
| AI-powered features | Consent (opt-in) | Prompts, responses, usage logs | 90 days |
| Analytics (SaaS) | Legitimate interest | Page views, feature usage (no PII) | 90 days |
| Audit logging | Legal obligation | User actions, timestamps | 1 year |
| Error reporting | Legitimate interest | Stack traces, request context | 30 days |

### 9.5 Privacy Configuration Checklist

- [ ] Data retention periods are configured for all data categories
- [ ] DSAR export endpoint is tested and returns complete data
- [ ] Erasure endpoint correctly anonymizes/deletes user data
- [ ] Cookie consent banner is configured (for SaaS web deployment)
- [ ] Privacy policy is published at `/privacy` and linked from all entry points
- [ ] Analytics are disabled in Electron desktop app (verified in `web-analytics.ts`)
- [ ] Sensitive headers are masked in network captures (6 header types)
- [ ] Password fields are masked in recorder output
- [ ] AI feature data is not sent to LLM providers unless user opts in (AI is OFF by default)
- [ ] BYOK keys are encrypted at rest and never returned in API responses
- [ ] Data Processing Agreement (DPA) is available for enterprise customers
- [ ] Sub-processor list is maintained and shared on request

---

## Appendix A: Security Configuration Quick Reference

### Minimum Viable Security (Development)

```bash
JWT_SECRET_KEY=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
POSTGRES_PASSWORD=dev-password-change-me
APP_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:8080
RATE_LIMIT_BACKEND=memory
```

### Production Security (Full)

```bash
# Secrets (generate unique values for each deployment)
JWT_SECRET_KEY=<64-hex-chars>
ENCRYPTION_KEY=<fernet-key>
POSTGRES_PASSWORD=<24+-char-random>
MINIO_ROOT_USER=flowstral-admin
MINIO_ROOT_PASSWORD=<24+-char-random>
REDIS_PASSWORD=<24+-char-random>
INTERNAL_SERVICE_KEY=<32-hex-chars>

# Application
APP_ENV=production
DATABASE_URL=postgresql://qaai:$POSTGRES_PASSWORD@pgbouncer:6432/qaai
REDIS_URL=redis://:$REDIS_PASSWORD@qaai-redis:6379
FRONTEND_URL=https://app.flowstral.com
CORS_ALLOWED_ORIGINS=https://app.flowstral.com
UPLOAD_MAX_SIZE_MB=50
RATE_LIMIT_BACKEND=redis

# AI (optional -- only if platform provides default keys)
# OPENAI_API_KEY=sk-proj-...
# ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_LLM_PROVIDER=openai
TRACK_LLM_USAGE=true

# Data retention
DATA_RETENTION_TEST_RUNS_DAYS=365
DATA_RETENTION_AUDIT_DAYS=365
DATA_RETENTION_ARTIFACTS_DAYS=90
DATA_RETENTION_RECORDINGS_DAYS=30
```

### Compliance Matrix

| Requirement | HIPAA | PCI-DSS | SOC 2 | GDPR | FedRAMP |
|-------------|-------|---------|-------|------|---------|
| Encryption at rest | Required | Required | Required | Recommended | Required |
| Encryption in transit (TLS) | Required | Required | Required | Required | Required |
| MFA | Required | Required | Required | Recommended | Required |
| Audit logging | Required | Required | Required | Required | Required |
| Key rotation | Required | 90 days | Annual | Recommended | 90 days |
| Data retention policy | 6 years | 1 year | Defined | Minimization | Defined |
| Access control (RBAC) | Required | Required | Required | Required | Required |
| Vulnerability scanning | Required | Quarterly | Annual | Recommended | Continuous |
| Incident response plan | Required | Required | Required | 72hr notification | Required |
| Backup and recovery | Required | Required | Required | Recommended | Required |
