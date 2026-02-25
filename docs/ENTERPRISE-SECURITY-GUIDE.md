# Flowstral Enterprise Security Guide

> Comprehensive security reference for the Flowstral QA Platform (QAAI).
> Covers authentication, authorization, multi-tenancy, encryption, network hardening, container security, audit logging, secret management, vulnerability scanning, compliance, and incident response.
>
> **Audience:** Security engineers, DevOps, compliance officers, IT administrators.
> **Last updated:** 2026-02-25

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Authorization (RBAC)](#2-authorization-rbac)
3. [Multi-Tenancy](#3-multi-tenancy)
4. [Rate Limiting](#4-rate-limiting)
5. [Data Encryption](#5-data-encryption)
6. [BYOK AI Key Security](#6-byok-ai-key-security)
7. [Network Security](#7-network-security)
8. [Container Security](#8-container-security)
9. [Audit Logging](#9-audit-logging)
10. [Secret Management](#10-secret-management)
11. [Security Scanning](#11-security-scanning)
12. [Compliance Considerations](#12-compliance-considerations)
13. [Incident Response](#13-incident-response)

---

## 1. Authentication

Flowstral implements a layered authentication model that supports bearer token flows for API access, Supabase-managed identity for user-facing sessions, and API key headers for service-to-service calls.

### 1.1 JWT Token Authentication

All authenticated API requests carry a JSON Web Token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

**Implementation details:**

| Aspect | Value |
|--------|-------|
| Library | PyJWT (`import jwt`) |
| Algorithm | HS256 (configurable via `JWT_ALGORITHM` env var) |
| Secret | `JWT_SECRET` environment variable (must be rotated in production) |
| Token extraction | `TenantContextMiddleware._extract_from_jwt()` in `backend/app/middleware/tenant_middleware.py` |

**JWT payload claims:**

| Claim | Purpose |
|-------|---------|
| `sub` or `user_id` | Authenticated user identifier |
| `tenant_id` | Organization/tenant scope for multi-tenancy isolation |
| `roles` | Array of role names assigned to the user |
| `permissions` | Array of granted permission strings |
| `exp` | Token expiration timestamp (Unix epoch) |
| `iat` | Issued-at timestamp |

**Token lifecycle:**

1. User authenticates via Supabase Auth (email/password, OAuth2, or SSO).
2. Backend receives the Supabase session token and mints a platform JWT with tenant and RBAC claims.
3. Frontend stores the token in memory (not localStorage) and attaches it to every Axios request via interceptor.
4. `TenantContextMiddleware` decodes the token on every inbound request and populates `request.state` with `tenant_id`, `user_id`, `roles`, and `permissions`.
5. Expired tokens return `401 Unauthorized`. Invalid tokens are logged and rejected silently.

### 1.2 Supabase Auth Integration

Supabase provides the identity layer:

- **Email/password** registration and login with email confirmation.
- **OAuth2 providers** (Google, GitHub, Microsoft, SAML SSO) configurable per project.
- **Magic link** passwordless login.
- **Row Level Security (RLS)** on Supabase tables enforces tenant isolation at the database level.

**Frontend flow:**
- `AuthContext` (`src/contexts/AuthContext.tsx`) wraps the Supabase client and exposes `currentUser`, `currentOrg`, `organizations`, and `loading` state.
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) redirects unauthenticated users to `/auth` and checks role requirements.
- `PublicRoute` redirects already-authenticated users away from auth pages.

### 1.3 API Key Authentication (Service-to-Service)

For headless CI/CD and external integrations, Flowstral accepts header-based identity:

| Header | Purpose |
|--------|---------|
| `X-Tenant-ID` | Tenant scope (fallback when no JWT is present) |
| `X-User-ID` | User identity (fallback when no JWT is present) |

These headers are checked by `TenantContextMiddleware` only when no valid JWT token is found in the `Authorization` header.

### 1.4 Session Management and Token Expiry

- **Access tokens** should be short-lived (recommended: 15-60 minutes).
- **Refresh tokens** are managed by Supabase client SDK with automatic background renewal.
- On the backend, `jwt.ExpiredSignatureError` is caught explicitly and returns a clear error, prompting the frontend to refresh.
- Concurrent sessions are allowed per user; each session carries its own JWT.

### 1.5 Password Policy Recommendations

For deployments using email/password authentication, enforce the following at the Supabase project level:

| Policy | Recommended Value |
|--------|-------------------|
| Minimum length | 12 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 digit, 1 special character |
| Password history | Prevent reuse of the last 5 passwords |
| Lockout threshold | 5 failed attempts triggers 15-minute lockout |
| MFA | Enable TOTP-based MFA for all admin and owner roles |
| Password rotation | Require rotation every 90 days for admin accounts |

---

## 2. Authorization (RBAC)

Flowstral enforces role-based access control on both the frontend and backend. The system uses a hierarchical role model combined with fine-grained permission strings.

### 2.1 Role Hierarchy

```
owner > admin > member > viewer
```

| Role | Hierarchy Level | Description |
|------|----------------|-------------|
| `owner` | 4 | Full platform control, billing, user management, destructive operations |
| `admin` | 3 | Configuration, test management, integrations, user invitations |
| `member` | 2 | Create and execute tests, manage collections, view results |
| `viewer` | 1 | Read-only access to dashboards, test results, and reports |

Higher roles inherit all permissions of lower roles. The hierarchy is enforced numerically in `ProtectedRoute.tsx`:

```typescript
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}
```

### 2.2 Backend Enforcement

**Middleware:** `RBACMiddleware` (`backend/app/middleware/rbac_middleware.py`)

The middleware runs on every non-public request and populates `request.state.permissions` by querying the `RBACService`. Endpoint-level enforcement uses three decorators:

**`@require_permission(permission_string)`**

Checks whether the authenticated user holds a specific permission. Returns `403 Forbidden` with the denied permission string if the check fails.

```python
@router.post("/test-cases")
@require_permission("test_cases:create")
async def create_test_case(request: Request, ...):
    ...
```

**`@require_role(role_name)`**

Checks whether the user has the exact named role. Returns `403 Forbidden` if the role is not assigned.

```python
@router.delete("/test-cases/{id}")
@require_role("admin")
async def delete_test_case(request: Request, ...):
    ...
```

**`@require_any_permission(permission_list)`**

Checks whether the user holds at least one of the listed permissions.

```python
@require_any_permission(["test_cases:read", "test_cases:write"])
async def get_or_write_test_case(request: Request, ...):
    ...
```

### 2.3 Frontend Enforcement

- `ProtectedRoute` accepts an optional `requiredRole` prop. If the user's organizational role does not meet or exceed the required level, an `UnauthorizedPage` component is rendered with a clear message and a link back to the dashboard.
- `LicenseGate` wraps enterprise features and checks the current license tier before rendering children.
- Navigation items in `AppSidebar.tsx` are conditionally shown based on role and license.

### 2.4 Permission Model

Permissions follow the `resource:action` format:

| Resource | Actions |
|----------|---------|
| `test_cases` | `create`, `read`, `update`, `delete`, `execute` |
| `test_runs` | `create`, `read`, `cancel` |
| `test_plans` | `create`, `read`, `update`, `delete` |
| `api_testing` | `execute`, `manage_collections`, `manage_environments` |
| `performance` | `execute`, `manage_scenarios` |
| `accessibility` | `scan`, `read_reports` |
| `visual_testing` | `compare`, `manage_baselines` |
| `ai_testing` | `execute`, `manage_agents` |
| `mobile_testing` | `execute`, `manage_devices` |
| `settings` | `read`, `update` |
| `integrations` | `manage` |
| `users` | `invite`, `manage_roles`, `remove` |
| `secrets` | `create`, `read`, `update`, `delete` |
| `defects` | `create`, `read`, `update`, `delete` |
| `ai_settings` | `read`, `update`, `manage_keys` |

The wildcard permission `*` grants unrestricted access and is reserved for the `owner` role.

### 2.5 Default Permissions per Role

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| `test_cases:create` | Yes | Yes | Yes | No |
| `test_cases:read` | Yes | Yes | Yes | Yes |
| `test_cases:delete` | Yes | Yes | No | No |
| `test_runs:execute` | Yes | Yes | Yes | No |
| `settings:update` | Yes | Yes | No | No |
| `users:manage_roles` | Yes | Yes | No | No |
| `users:remove` | Yes | No | No | No |
| `secrets:create` | Yes | Yes | No | No |
| `secrets:read` | Yes | Yes | Yes | No |
| `integrations:manage` | Yes | Yes | No | No |
| `ai_settings:read` | Yes | Yes | Yes | Yes |
| `ai_settings:update` | Yes | Yes | No | No |
| `ai_settings:manage_keys` | Yes | Yes | No | No |

---

## 3. Multi-Tenancy

Flowstral is a multi-tenant platform. Each organization operates in an isolated tenant boundary that prevents cross-tenant data access.

### 3.1 Tenant Isolation via Middleware

`TenantContextMiddleware` (`backend/app/middleware/tenant_middleware.py`) extracts the `tenant_id` from the JWT token or the `X-Tenant-ID` header on every request and stores it in `request.state.tenant_id`.

**Extraction priority:**
1. JWT `tenant_id` claim (primary).
2. `X-Tenant-ID` header (fallback for API key authentication).

### 3.2 JWT Claims Carry Tenant Context

Every JWT minted by the platform embeds the `tenant_id` claim. When users switch organizations in the frontend (via `WorkspaceSwitcher`), a new JWT is issued for the target tenant.

### 3.3 Database Query Filtering

All database queries that touch tenant-scoped data include a `WHERE tenant_id = $X` clause. This is enforced at the service layer. Example from `SecretsService`:

```sql
SELECT ... FROM secrets
WHERE secret_id = $1
  AND (tenant_id = $2 OR tenant_id IS NULL)
```

The `OR tenant_id IS NULL` pattern allows system-level resources (shared templates, default configurations) to be accessible across tenants.

### 3.4 Cross-Tenant Access Prevention

- The `require_tenant()` helper in `tenant_middleware.py` raises `401 Unauthorized` if no tenant context is present on endpoints that require it.
- There is no API surface that accepts an arbitrary `tenant_id` as a query parameter; tenant context is always derived from the authenticated token.
- Supabase Row Level Security (RLS) policies provide a second layer of enforcement at the database level for tables managed through Supabase.
- Context variables (`ContextVar`) ensure tenant state does not leak between concurrent requests in async handlers.

### 3.5 Data Segregation Patterns

| Data Type | Isolation Method |
|-----------|-----------------|
| Test cases, runs, plans | `tenant_id` column + query filter |
| API collections, environments | `tenant_id` column + query filter |
| Secrets | `tenant_id` column + encrypted storage |
| Uploaded files (screenshots, HARs) | Tenant-prefixed S3/MinIO paths |
| AI settings and encrypted keys | `org_id` column + Fernet encryption at rest |
| AI usage logs | `org_id` column for usage tracking and billing |
| Audit logs | `tenant_id` column for log partitioning |

---

## 4. Rate Limiting

Flowstral implements rate limiting at both the application layer (FastAPI middleware) and the reverse proxy layer (nginx) to protect against abuse and denial-of-service attacks.

### 4.1 Application-Level Rate Limiting

`RateLimitMiddleware` (`backend/app/middleware/rate_limit_middleware.py`) uses an in-memory sliding window algorithm.

**Default limits per IP address:**

| Path Prefix | Max Requests | Window |
|-------------|-------------|--------|
| `/auth` | 10 | 60 seconds |
| `/api/ai-testing` | 20 | 60 seconds |
| `/api/ai/enhancements` | 20 | 60 seconds |
| `/api/llm` | 20 | 60 seconds |
| `/ai` | 30 | 60 seconds |
| All other endpoints | 100 | 60 seconds |

**Excluded paths** (no rate limiting): `/health`, `/health/database`, `/health/metrics`, `/metrics`, `/docs`, `/openapi.json`, `/redoc`.

**CORS preflight** (`OPTIONS`) requests are also excluded from rate limiting.

### 4.2 Rate Limit Response Headers

Every response includes rate limit information:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining before throttling |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait (only on `429` responses) |

When the limit is exceeded, the server returns:

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1740307260

{
  "detail": "Too many requests. Please try again later.",
  "retry_after": 60
}
```

### 4.3 Nginx-Level Rate Limiting

The nginx reverse proxy (`nginx/default.conf`) adds a second layer of rate limiting:

| Zone | Rate | Burst | Scope |
|------|------|-------|-------|
| `api` | 30 req/s | 10 | API proxy (`/api/`) |
| `auth` | 5 req/s | 3 | Auth endpoints (`/auth`) |
| `static` | 50 req/s | 20 | Static assets (`/`) |

### 4.4 DDoS Protection

- **Dual-layer rate limiting** (nginx + application middleware) provides defense in depth.
- **IP extraction** respects `X-Forwarded-For` and `X-Real-IP` headers for deployments behind load balancers.
- **Periodic cleanup** of stale rate limiter entries prevents memory growth (every 1,000 requests).
- **Production recommendation:** Replace the in-memory rate limiter with a Redis-backed implementation (`redis-py` with `INCR`/`EXPIRE`) when running multiple backend worker processes.
- **Cloud deployments** should additionally use a WAF (AWS WAF, Cloudflare, or equivalent) in front of the nginx layer.

---

## 5. Data Encryption

### 5.1 Encryption at Rest

| Component | Encryption Method |
|-----------|-------------------|
| PostgreSQL data | `pgcrypto` extension available; AES-256 column-level encryption for sensitive fields |
| Supabase storage | Supabase-managed encryption at rest (AES-256) |
| Secrets table | Fernet symmetric encryption via `cryptography` library (see Section 10) |
| BYOK AI API keys | Fernet symmetric encryption via `cryptography` library (see [Section 6](#6-byok-ai-key-security)) |
| S3/MinIO objects | Server-side encryption (SSE-S3 or SSE-KMS) configurable |
| Redis cache | Enable `requirepass` and TLS in production |

### 5.2 Encryption in Transit

| Path | Protocol |
|------|----------|
| Client to nginx | TLS 1.2+ (HTTPS enforced via HSTS in production) |
| Nginx to backend | Internal network (HTTP within Docker bridge; TLS optional) |
| Backend to PostgreSQL | TLS enabled via `sslmode=require` in `DATABASE_URL` |
| Backend to Supabase | HTTPS (enforced by Supabase) |
| Backend to Redis | TLS optional (`rediss://` scheme) |
| WebSocket connections | WSS (TLS-encrypted WebSocket) |

**HSTS configuration** (enable in production by uncommenting in `nginx/default.conf`):

```
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### 5.3 API Keys and Secrets

Sensitive credentials are never stored in plaintext. The `SecretsService` (`backend/app/services/core/secrets_service.py`) uses Fernet symmetric encryption:

- Encryption key derived from `SECRETS_ENCRYPTION_KEY` environment variable.
- Key is hashed with SHA-256 to produce the 32-byte Fernet key.
- All secret values are encrypted before database insertion.
- Decryption occurs on-demand during test execution via `resolve_secret()`.
- The `encrypted_value` column is never exposed in list API responses.

### 5.4 Environment Variables for Sensitive Configuration

The following environment variables must be set securely and never committed to version control:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signing key for JWT tokens |
| `SECRETS_ENCRYPTION_KEY` | Master key for Fernet encryption of stored secrets |
| `ENCRYPTION_KEY` | Alternative encryption key used by BYOK AI key encryption (fallback: `SECRETS_ENCRYPTION_KEY`) |
| `DATABASE_URL` | PostgreSQL connection string with credentials |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude integration |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (backend only) |
| `MINIO_ROOT_PASSWORD` | MinIO/S3 storage credentials |

---

## 6. BYOK AI Key Security

> Added in v3.14.0. Covers the Bring Your Own Key (BYOK) architecture that allows organizations to use their own AI provider API keys with full encryption, isolation, and budget controls.

### 6.1 AI Disabled by Default

Flowstral makes **no AI API calls** unless a user explicitly enables AI at the organization level and provides API keys. This is enforced at multiple layers:

| Layer | Default State | Override Mechanism |
|-------|--------------|-------------------|
| Organization `ai_settings` | `ai_enabled: false` | Admin enables via Settings > AI |
| Feature toggles (20 areas) | All `false` | Admin enables individual features |
| API key presence | None stored | Admin submits key via `POST /api/ai/settings/key` |
| Backend AI endpoints | Return `503 Service Unavailable` | Only respond when key resolves successfully |

The key resolution chain ensures no AI calls are made without explicit configuration:

```
1. Check ai_encrypted_keys for org/project-specific BYOK key  ->  use it
2. Else check server env var (OPENAI_API_KEY / ANTHROPIC_API_KEY)  ->  use it
3. Else  ->  AI unavailable, return 503
```

This chain is implemented in `backend/app/routers/ai/ai_key_resolver.py` via the shared `resolve_ai_key(request, provider)` helper, which is called by all AI router endpoints.

### 6.2 BYOK API Key Encryption at Rest

User-provided AI API keys are encrypted using Fernet symmetric encryption from the `cryptography` library before storage. Keys are **never stored in plaintext** anywhere in the system.

**Encryption details:**

| Aspect | Implementation |
|--------|---------------|
| Algorithm | Fernet (AES-128-CBC + HMAC-SHA256) via `cryptography.fernet.Fernet` |
| Key derivation | SHA-256 hash of `ENCRYPTION_KEY` or `SECRETS_ENCRYPTION_KEY` env var, base64url-encoded to 32 bytes |
| Storage table | `ai_encrypted_keys` in PostgreSQL |
| Decryption | On-demand in `AISettingsService.resolve_key()`, never cached in plaintext |
| Key columns | `encrypted_key` (ciphertext), `provider` (openai/anthropic), `org_id` (tenant scope) |

**Encryption flow:**

```
User submits key via POST /api/ai/settings/key
  -> AISettingsService._encrypt_key(raw_key)
    -> SHA-256(ENCRYPTION_KEY) -> base64url -> Fernet key
    -> Fernet.encrypt(raw_key.encode())
  -> INSERT INTO ai_encrypted_keys (org_id, provider, encrypted_key)
  -> Return { success: true, has_key: true }  (key value NOT returned)
```

**Decryption flow:**

```
AI endpoint called (e.g., POST /api/ai-testing/start)
  -> resolve_ai_key(request, "openai")
    -> AISettingsService.resolve_key(org_id, "openai")
      -> SELECT encrypted_key FROM ai_encrypted_keys WHERE org_id = $1 AND provider = $2
      -> Fernet.decrypt(encrypted_key) -> raw key
    -> Return raw key (held in memory only for the duration of the request)
```

### 6.3 Frontend Key Security

API keys are never stored in frontend state, localStorage, sessionStorage, or any client-side storage:

| Principle | Implementation |
|-----------|---------------|
| No client-side storage | Frontend only tracks `hasApiKey: boolean` / `hasAnthropicKey: boolean` flags |
| Input clearing | After successful key submission, the input field is cleared immediately |
| Display | Only a "Key stored securely" badge is shown; the key value is never displayed |
| Transmission | Keys are sent once via `POST /api/ai/settings/key` over HTTPS; never included in GET requests or URL parameters |
| React context | `AIContext.tsx` stores feature flags and `hasApiKey` booleans, never the keys themselves |

### 6.4 Client Caching Strategy

To avoid creating a new HTTP client for every AI API call (which would be expensive), the `AISettingsService` caches instantiated AI provider clients keyed by a truncated hash of the decrypted key:

```
cache_key = SHA-256(decrypted_key)[:16]
```

This approach:

- **Prevents key leakage:** The full key is never used as a cache key or logged. Only a 16-character hex digest is used for cache lookup.
- **Avoids per-request overhead:** Once a client is created for a given key, it is reused for subsequent requests from the same org.
- **Supports key rotation:** When an org updates their key, the new key produces a different hash, so a new client is created automatically. The old cached client is eventually garbage-collected.

### 6.5 Budget Controls and Rate Limiting

AI usage is constrained by configurable daily limits stored in the `ai_settings` table:

| Control | Column | Default | Description |
|---------|--------|---------|-------------|
| Request limit | `max_requests_per_day` | 1000 | Maximum AI API calls per 24-hour period per org |
| Cost limit | `max_cost_per_day_cents` | 5000 (= $50) | Maximum estimated cost in cents per day per org |
| Auto-reset | Midnight UTC | — | Counters reset automatically at 00:00 UTC daily |

**Enforcement flow:**

1. Before every AI API call, `AISettingsService` checks the current day's usage from `ai_usage_log`.
2. If `requests_today >= max_requests_per_day` or `cost_today_cents >= max_cost_per_day_cents`, the request is rejected with `429 Too Many Requests` and a descriptive error message.
3. After a successful AI call, a usage record is inserted into `ai_usage_log` with `org_id`, `provider`, `model`, `tokens_used`, `estimated_cost_cents`, and `timestamp`.
4. The budget state is also enforced within the healing orchestrator: `ai_automation_api._budget_state` limits AI healing calls to 3 per test run to prevent runaway costs.

### 6.6 AI Usage Audit Trail

All AI API calls are logged to the `ai_usage_log` table for cost tracking, compliance, and forensic analysis:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `org_id` | UUID | Organization (tenant) scope |
| `project_id` | UUID | Optional project scope |
| `user_id` | UUID | User who triggered the AI call |
| `provider` | TEXT | `openai` or `anthropic` |
| `model` | TEXT | Model used (e.g., `gpt-4o-mini`, `claude-3-5-sonnet`) |
| `feature_area` | TEXT | Which of the 20 AI features was used |
| `tokens_used` | INTEGER | Token count (prompt + completion) |
| `estimated_cost_cents` | INTEGER | Estimated cost for the call |
| `timestamp` | TIMESTAMPTZ | When the call was made |

This table supports:

- **Billing reports:** Aggregate cost per org/project/user over any time period.
- **Anomaly detection:** Identify unusual spikes in AI usage that may indicate abuse.
- **Compliance audits:** Demonstrate exactly when, where, and how AI was used.
- **Budget enforcement:** Real-time daily totals for the budget control system.

### 6.7 Database Tables

Three new tables were added in migration `034_ai_settings.sql`:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ai_settings` | Organization/project AI configuration | `org_id`, `project_id`, `ai_enabled`, `provider`, `model`, `feature_toggles` (JSONB), `max_requests_per_day`, `max_cost_per_day_cents` |
| `ai_encrypted_keys` | Fernet-encrypted BYOK API keys | `org_id`, `provider`, `encrypted_key`, `created_at`, `updated_at` |
| `ai_usage_log` | Audit trail of all AI API calls | `org_id`, `user_id`, `provider`, `model`, `feature_area`, `tokens_used`, `estimated_cost_cents`, `timestamp` |

All three tables use `org_id` for tenant isolation and are subject to the same query-level filtering as all other tenant-scoped data (see [Section 3](#3-multi-tenancy)).

### 6.8 RBAC for AI Settings

AI settings endpoints follow the existing RBAC middleware patterns:

| Endpoint | Required Permission | Purpose |
|----------|-------------------|---------|
| `GET /api/ai/settings` | `ai_settings:read` | Read org AI configuration |
| `PUT /api/ai/settings` | `ai_settings:update` | Update AI config, feature toggles |
| `POST /api/ai/settings/key` | `ai_settings:manage_keys` | Store a BYOK API key |
| `DELETE /api/ai/settings/key/{provider}` | `ai_settings:manage_keys` | Remove a stored key |
| `POST /api/ai/settings/test` | `ai_settings:update` | Test connection with key |
| `GET /api/ai/settings/providers` | `ai_settings:read` | List providers and key status |
| `GET /api/ai/settings/usage` | `ai_settings:read` | Get usage statistics |

Only `admin` and `owner` roles can modify AI settings or manage keys. All users can read the AI configuration (to know which features are enabled). See [Section 2.5](#25-default-permissions-per-role) for the complete permission matrix.

### 6.9 Security Recommendations for BYOK Deployments

- **Key rotation:** Rotate BYOK API keys at your AI provider at least every 90 days. After rotating at the provider, update the key in Flowstral via `POST /api/ai/settings/key`.
- **Encryption key management:** The `ENCRYPTION_KEY` / `SECRETS_ENCRYPTION_KEY` environment variable is the master key for all BYOK encryption. Protect it with the same rigor as your database credentials. Store it in a secrets manager (HashiCorp Vault, AWS Secrets Manager) rather than a `.env` file.
- **Budget limits:** Set conservative daily budget limits initially and increase as you understand your usage patterns. Review `ai_usage_log` regularly.
- **Principle of least privilege:** Enable only the AI feature areas your team actually uses. The 20 granular feature toggles allow fine-grained control.
- **Network isolation:** AI API calls to OpenAI/Anthropic are made from the backend only. The frontend never communicates with AI providers directly. In air-gapped environments, disable cloud AI and use Ollama with local models.
- **Key deletion:** When offboarding an organization or rotating keys, use `DELETE /api/ai/settings/key/{provider}` to remove the encrypted key. The deletion is immediate and the cached client is invalidated.

---

## 7. Network Security

### 7.1 Nginx Security Headers

The nginx configuration (`nginx/default.conf`) enforces OWASP-recommended security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking by blocking iframe embedding |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Restricts browser feature access |
| `Content-Security-Policy` | See below | Prevents XSS, injection, and data exfiltration |

**Content Security Policy breakdown:**

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com
    https://www.googletagmanager.com https://www.google-analytics.com
    https://client.crisp.chat;
style-src 'self' 'unsafe-inline' https://client.crisp.chat;
img-src 'self' data: blob: https:;
font-src 'self' data: https://client.crisp.chat;
connect-src 'self' https://*.supabase.co https://*.railway.app
    wss://*.supabase.co https://api.openai.com
    https://www.google-analytics.com https://client.crisp.chat
    wss://client.relay.crisp.chat;
frame-src 'none';
```

**Server version hiding:**

```
server_tokens off;
```

### 7.2 CORS Configuration

The backend FastAPI application configures CORS with a whitelist of allowed origins. The middleware stack order is:

```
CORS -> RateLimit -> RBAC -> TenantContext -> TraceLogging
```

**Production CORS policy:**
- Only explicitly listed frontend origins are allowed.
- Credentials are permitted (for cookie-based auth flows).
- Allowed methods are restricted to `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- `Authorization`, `Content-Type`, `X-Tenant-ID`, `X-User-ID`, and `X-Trace-ID` are the only allowed request headers.

### 7.3 API Proxy Through Nginx

All API traffic is proxied through nginx, which:

- Adds `X-Real-IP` and `X-Forwarded-For` headers for accurate IP logging.
- Adds `X-Forwarded-Proto` to preserve the original protocol.
- Sets read timeout to 300 seconds (for long-running performance tests).
- Enables WebSocket upgrade (`Connection: upgrade`) for real-time test execution.

### 7.4 Sensitive Path Blocking

Nginx blocks access to hidden files and sensitive extensions:

```nginx
location ~ /\. { deny all; return 404; }
location ~* \.(env|git|htpasswd|htaccess)$ { deny all; return 404; }
```

### 7.5 Firewall Recommendations

For production deployments, configure network firewalls to expose only the required ports:

| Port | Service | External Access |
|------|---------|-----------------|
| 80 | Nginx (HTTP, redirects to HTTPS) | Yes |
| 443 | Nginx (HTTPS) | Yes |
| 8000 | FastAPI backend | No (internal only, behind nginx) |
| 5432 | PostgreSQL | No (internal only) |
| 6379 | Redis | No (internal only) |
| 9000/9001 | MinIO | No (internal only, or restricted to admin network) |

**Additional recommendations:**
- Use a VPN or bastion host for database and Redis access.
- Deploy a Web Application Firewall (WAF) in front of nginx for production SaaS.
- Enable fail2ban on the host to block IPs with repeated auth failures.
- Restrict `/metrics` and `/health` endpoints to monitoring network CIDR blocks.

---

## 8. Container Security

### 8.1 Non-Root User in All Containers

Every Docker container runs as a non-root user (`appuser`, UID 1001), following CIS Docker Benchmark 4.1.

**Backend container** (`backend/Dockerfile`):

```dockerfile
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 -d /app -s /sbin/nologin appuser
# ...
USER appuser
```

**Frontend container** (`Dockerfile.frontend`):

```dockerfile
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser && \
    chown -R appuser:appuser /usr/share/nginx/html && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    touch /var/run/nginx.pid && chown appuser:appuser /var/run/nginx.pid
```

### 8.2 Minimal Base Images

| Container | Base Image | Rationale |
|-----------|-----------|-----------|
| Backend API | `python:3.10-slim` | Minimal Debian with only essential libraries |
| Frontend | `nginx:alpine` | Alpine Linux (~5MB base) for minimal attack surface |
| Test workers | `python:3.10-slim` + Playwright | Slim base with browser automation dependencies |
| PostgreSQL | `pgvector/pgvector:pg16` | Official PostgreSQL 16 with pgvector extension |
| Redis | `redis:7-alpine` | Alpine-based Redis for minimal footprint |

### 8.3 No Secrets in Docker Images

- All sensitive configuration is injected via environment variables at runtime.
- The `docker-compose.full.yml` file uses `${VAR:-default}` syntax with a `.env` file.
- Docker build arguments (`ARG`) are used only for non-sensitive build-time configuration (e.g., `VITE_API_BASE_URL`).
- `.dockerignore` excludes `.env`, `node_modules`, `.git`, and other development artifacts.

### 8.4 Health Checks

All containers define health checks for orchestrator awareness:

```dockerfile
# Backend
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
```

```yaml
# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U qaai"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### 8.5 Read-Only Filesystem Recommendations

For hardened production deployments:

```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
    volumes:
      - backend_logs:/app/logs
```

### 8.6 CIS Docker Benchmark Compliance Checklist

| Control | Status | Notes |
|---------|--------|-------|
| 4.1 Non-root user | Implemented | UID 1001 in all containers |
| 4.2 Trusted base images | Implemented | Official images from Docker Hub |
| 4.3 No unnecessary packages | Implemented | `--no-install-recommends` flag used |
| 4.5 No secrets in build | Implemented | Environment variable injection |
| 4.6 HEALTHCHECK | Implemented | All service containers |
| 5.1 AppArmor/SELinux | Recommended | Enable host-level MAC |
| 5.2 Restricted capabilities | Recommended | Drop all, add only needed |
| 5.5 No privileged mode | Default | None of the containers use `--privileged` |
| 5.10 Memory limits | Recommended | Set `deploy.resources.limits.memory` |
| 5.12 Read-only root FS | Recommended | Use `read_only: true` with tmpfs |

---

## 9. Audit Logging

### 9.1 Trace Logging Middleware

`TraceLoggingMiddleware` (`backend/app/middleware/trace_logging_middleware.py`) assigns a unique `trace_id` to every request:

- If the client sends an `X-Trace-ID` header, that value is used (for distributed tracing).
- Otherwise, a UUID v4 is generated automatically.
- The `trace_id` is stored in a `ContextVar` so all log records within the request include it.
- The response includes `X-Trace-ID` in the headers so clients can reference it in bug reports.

**Log format integration:**

```python
class TraceIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = getattr(record, "trace_id", trace_id_ctx.get()) or "-"
        return True
```

This enables structured log queries like:

```
trace_id=abc123 | SELECT action, user_id, resource, timestamp
```

### 9.2 Audit Trail Events

All significant actions are logged with the following attributes:

| Attribute | Description |
|-----------|-------------|
| `trace_id` | Request correlation identifier |
| `timestamp` | ISO 8601 timestamp |
| `user_id` | Authenticated user who performed the action |
| `tenant_id` | Tenant scope |
| `action` | Action performed (e.g., `test_case.create`, `secret.read`, `user.invite`) |
| `resource_type` | Type of resource affected |
| `resource_id` | Identifier of the affected resource |
| `ip_address` | Client IP (from `X-Forwarded-For` or direct connection) |
| `status` | `success` or `failure` |
| `details` | Additional context (e.g., changed fields, error messages) |

### 9.3 Filterable Audit Queries

Audit logs support filtering by:

- **User:** Who performed the action.
- **Action:** What was done (CRUD operations, executions, configuration changes).
- **Resource:** Which resource was affected (test case, secret, integration).
- **Date range:** Time-bounded queries for compliance periods.
- **Tenant:** Scope to a specific organization.

### 9.4 Export to CSV for Compliance

Audit logs can be exported in CSV format for:

- SOC 2 audit evidence collection.
- Internal security reviews.
- Regulatory compliance documentation.
- Third-party auditor access.

### 9.5 Storage Architecture

- **Default:** In-memory with periodic flush to PostgreSQL `audit_logs` table.
- **Production:** Direct PostgreSQL persistence with partitioning by month.
- **High-volume:** Stream to external SIEM (Splunk, Datadog, ELK) via structured JSON logs.

### 9.6 AI Usage Audit Trail (v3.14.0+)

In addition to the general audit trail, all AI API calls are logged to a dedicated `ai_usage_log` table for cost tracking and compliance. This includes provider, model, token count, estimated cost, feature area, and the user who triggered the call. See [Section 6.6](#66-ai-usage-audit-trail) for full details on the AI usage logging schema and its use in budget enforcement.

---

## 10. Secret Management

### 10.1 SecretsService Architecture

The `SecretsService` (`backend/app/services/core/secrets_service.py`) provides encrypted storage for API keys, tokens, passwords, and other credentials used during test execution.

**Encryption:**
- Uses the `cryptography` library's `Fernet` implementation (AES-128-CBC with HMAC-SHA256).
- The encryption key is derived from the `SECRETS_ENCRYPTION_KEY` environment variable, hashed with SHA-256 to produce a 32-byte key, then base64url-encoded for Fernet compatibility.
- All secret values are encrypted before insertion into the `secrets` PostgreSQL table.
- Decrypted values are never stored in the database; decryption occurs in-memory on demand.

**Supported secret types:**

| Type | Use Case |
|------|----------|
| `api_key` | Third-party API keys (e.g., Jira, Slack) |
| `password` | Application passwords for test environments |
| `token` | OAuth tokens, bearer tokens |
| `credential` | Composite credentials (username + password) |
| `custom` | User-defined secrets |

### 10.2 Secret Lifecycle

```
Create  ->  Encrypt  ->  Store in DB  ->  Resolve on demand  ->  Inject into test env  ->  Rotate  ->  Delete
```

**Key operations:**

| Operation | Method | Access Control |
|-----------|--------|----------------|
| Create secret | `create_secret()` | `secrets:create` permission |
| Read secret | `get_secret()` / `resolve_secret()` | `secrets:read` permission, tenant-scoped |
| List secrets | `list_secrets()` | Returns metadata only (no decrypted values) |
| Update secret | `update_secret()` | `secrets:update` permission |
| Delete secret | `delete_secret()` | `secrets:delete` permission |
| Inject into env | `inject_secrets_into_env()` | Called during test execution |

### 10.3 Environment Variable Injection

During test execution, the `inject_secrets_into_env()` method:

1. Accepts a list of secret names.
2. Resolves and decrypts each secret.
3. Converts names to uppercase environment variable format (e.g., `my-api-key` becomes `MY_API_KEY`).
4. Returns a dictionary for subprocess environment injection.
5. Logs injection events (name only, never the value).

### 10.4 Rotation Policies

- **Recommended rotation interval:** Every 90 days for API keys and tokens.
- **Immediate rotation triggers:** Suspected compromise, employee offboarding, security incident.
- Update secrets via the `update_secret()` API; the old value is overwritten (not versioned).
- For zero-downtime rotation, create a new secret with a versioned name, update references, then delete the old secret.

### 10.5 Kubernetes Secrets (K8s Deployments)

For Kubernetes deployments, platform secrets should be managed via native K8s Secrets or an external vault:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: flowstral-secrets
  namespace: flowstral
type: Opaque
data:
  JWT_SECRET: <base64-encoded>
  SECRETS_ENCRYPTION_KEY: <base64-encoded>
  DATABASE_URL: <base64-encoded>
  OPENAI_API_KEY: <base64-encoded>
```

**Production recommendation:** Integrate with HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault for automatic rotation and centralized audit.

---

## 11. Security Scanning

### 11.1 Automated Security Scan Pipeline

Set up a weekly GitHub Actions workflow to scan all layers of the stack:

```yaml
name: Security Scan
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6 AM UTC
  workflow_dispatch: {}

jobs:
  frontend-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --legacy-peer-deps
      - run: npm audit --audit-level=high
      - run: npx audit-ci --high

  backend-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - run: pip install pip-audit safety
      - run: pip-audit -r backend/requirements.txt
      - run: safety check -r backend/requirements.txt

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build backend image
        run: docker build -t flowstral-backend:scan ./backend
      - name: Build frontend image
        run: docker build -t flowstral-frontend:scan -f Dockerfile.frontend .
      - name: Scan backend with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: flowstral-backend:scan
          severity: CRITICAL,HIGH
          exit-code: '1'
      - name: Scan frontend with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: flowstral-frontend:scan
          severity: CRITICAL,HIGH
          exit-code: '1'
```

### 11.2 Frontend Dependency Scanning

| Tool | Purpose | Command |
|------|---------|---------|
| `npm audit` | Check npm packages for known vulnerabilities | `npm audit --audit-level=high` |
| `audit-ci` | CI-friendly npm audit with configurable thresholds | `npx audit-ci --high` |
| Dependabot | Automated PR creation for vulnerable dependencies | GitHub Settings > Security |
| Snyk | Deep dependency analysis with fix suggestions | `npx snyk test` |

### 11.3 Backend Dependency Scanning

| Tool | Purpose | Command |
|------|---------|---------|
| `pip-audit` | PyPI advisory database lookup | `pip-audit -r requirements.txt` |
| `safety` | Check installed packages against Safety DB | `safety check -r requirements.txt` |
| `bandit` | Static analysis for common Python security issues | `bandit -r backend/app -ll` |
| Dependabot | Automated PR creation for pip dependencies | GitHub Settings > Security |

### 11.4 Container Image Scanning

| Tool | Purpose | Integration |
|------|---------|-------------|
| Trivy | Vulnerability scanning of container images and IaC | GitHub Actions, CLI |
| Grype | Anchore-based vulnerability scanner | GitHub Actions, CLI |
| Docker Scout | Docker Hub native scanning | Docker Desktop, CLI |

### 11.5 OWASP Security Testing

For API security testing, use Flowstral's own capabilities alongside OWASP ZAP:

- **OWASP ZAP** proxy scans against the running backend.
- **Flowstral API Testing** module can be configured with security-focused assertions (response headers, error handling, injection payloads).
- **DAST scanning** should run against staging environments before production deployments.

---

## 12. Compliance Considerations

### 12.1 SOC 2 Readiness

Flowstral includes features that support SOC 2 Type II compliance:

| SOC 2 Criteria | Flowstral Feature |
|----------------|-------------------|
| **CC6.1** Logical access | RBAC with role hierarchy, permission-based endpoint protection |
| **CC6.2** User provisioning | Organization-based user management, role assignment |
| **CC6.3** Authentication | JWT + Supabase Auth with MFA support |
| **CC6.6** Encryption | Fernet encryption at rest (secrets + BYOK AI keys), TLS 1.2+ in transit |
| **CC7.1** Change management | Git-based version control, CI/CD pipeline |
| **CC7.2** System monitoring | Health checks, Prometheus metrics, trace logging |
| **CC7.4** Change control | BYOK AI keys encrypted at rest, usage audit trail, budget controls |
| **CC8.1** Incident response | Audit logs, trace IDs, health endpoints |
| **A1.2** Availability | Container health checks, auto-restart policies |

### 12.2 GDPR Data Handling

For deployments that process EU personal data:

- **Data minimization:** Collect only what is needed for test execution.
- **Right to erasure:** Implement `DELETE /api/users/{id}/data` endpoint to purge all user-associated data.
- **Data portability:** Export user data in standard formats (JSON, CSV).
- **Consent management:** Record user consent for data processing.
- **Data residency:** On-premise deployment option ensures data stays within the required jurisdiction.
- **DPA compliance:** Multi-tenancy with strict tenant isolation supports data processor agreements.

### 12.3 HIPAA Considerations for Healthcare

For healthcare organizations:

- **PHI protection:** Never include Protected Health Information in test data; use synthetic data generators.
- **Access controls:** RBAC enforcement on all PHI-adjacent resources.
- **Audit trail:** All access to test data is logged with user identity and timestamp.
- **Encryption:** AES-256 at rest, TLS 1.2+ in transit (both are Flowstral defaults).
- **BAA support:** On-premise deployment enables Business Associate Agreement compliance.
- **Session management:** Configurable session timeout (recommended: 15 minutes for HIPAA).

### 12.4 Air-Gapped Deployment for Regulated Environments

Flowstral supports fully air-gapped deployments for classified, defense, and highly regulated environments:

| Component | Air-Gap Solution |
|-----------|------------------|
| Frontend | Pre-built static assets served by nginx (no CDN dependencies) |
| Backend | Docker image with all Python dependencies baked in |
| AI/LLM | Disable cloud LLM; use Ollama with local models (Qwen 2.5) |
| Database | Local PostgreSQL (no Supabase dependency) |
| Storage | Local MinIO instance (S3-compatible) |
| Auth | Local JWT-based auth (no Supabase dependency) |
| Analytics | Disabled (all web analytics scripts skip in offline mode) |
| Updates | Manual Docker image transfers via USB/secure media |

**Air-gap deployment command:**

```bash
# Export images on connected machine
docker save flowstral-backend flowstral-frontend | gzip > flowstral-images.tar.gz

# Transfer to air-gapped host and load
docker load < flowstral-images.tar.gz
docker-compose -f docker-compose.full.yml up -d
```

---

## 13. Incident Response

### 13.1 Health Check Endpoints

Flowstral exposes health check endpoints for monitoring and alerting:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /health` | Application health | `{"status": "healthy", "version": "..."}` |
| `GET /health/database` | Database connectivity | `{"status": "connected", "latency_ms": ...}` |
| `GET /health/metrics` | Extended health metrics | Component-level health breakdown |
| `GET /metrics` | Prometheus-format metrics | Counters, histograms, gauges |

**Monitoring integration:**
- Prometheus scrapes `/metrics` at configurable intervals.
- Grafana dashboards visualize request rates, latencies, error rates, and resource usage.
- AlertManager triggers notifications on anomalies (e.g., error rate > 5%, p99 latency > 5s).

### 13.2 Prometheus Metrics

Key metrics exported:

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, path, and status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `active_websocket_connections` | Gauge | Current WebSocket connections |
| `test_executions_total` | Counter | Total test executions by status |
| `ai_api_calls_total` | Counter | LLM API calls by provider |
| `rate_limit_rejections_total` | Counter | Rate-limited requests |
| `db_query_duration_seconds` | Histogram | Database query latency |

### 13.3 Audit Log Analysis for Forensics

In the event of a security incident, use audit logs for forensic analysis:

**Investigation workflow:**

1. **Identify the trace:** Collect the `X-Trace-ID` from affected requests or error reports.
2. **Reconstruct the timeline:** Query audit logs filtered by `trace_id`, `user_id`, or `ip_address` within the incident window.
3. **Assess scope:** Determine which tenants, resources, and users were affected.
4. **Identify the vector:** Analyze request patterns for anomalies (unusual endpoints, elevated error rates, unfamiliar IPs).
5. **Contain:** Revoke affected JWT tokens, rotate compromised secrets, block suspicious IPs at the WAF/nginx level.
6. **Remediate:** Patch the vulnerability, update security configurations, deploy fixes.
7. **Report:** Generate CSV audit log export for stakeholders and regulatory bodies.

### 13.4 Backup and Recovery Procedures

| Component | Backup Method | Frequency | Retention |
|-----------|--------------|-----------|-----------|
| PostgreSQL | `pg_dump` / continuous WAL archiving | Daily full + continuous WAL | 30 days |
| MinIO/S3 objects | Cross-region replication or `mc mirror` | Continuous | 90 days |
| Redis | RDB snapshots + AOF | Every 5 minutes | 7 days |
| Secrets encryption key | Offline secure backup (HSM or vault) | On rotation | Permanent |
| BYOK AI encryption key | Same as secrets encryption key (shared `ENCRYPTION_KEY`) | On rotation | Permanent |
| Docker images | Container registry with immutable tags | Per release | All releases |
| Configuration | Git version control | Every commit | Permanent |

**Recovery Time Objectives (RTO):**

| Scenario | Target RTO | Procedure |
|----------|-----------|-----------|
| Single container failure | < 30 seconds | Docker auto-restart policy (`unless-stopped`) |
| Database corruption | < 1 hour | Restore from most recent `pg_dump` + WAL replay |
| Full cluster failure | < 4 hours | Re-deploy from Docker images + restore database backup |
| Encryption key compromise | < 2 hours | Rotate `SECRETS_ENCRYPTION_KEY`, re-encrypt all secrets |
| BYOK AI key compromise | < 30 minutes | Rotate key at AI provider, update via `POST /api/ai/settings/key`, old cached client auto-invalidated |
| Complete disaster recovery | < 24 hours | Deploy from scratch using IaC + restore all backups |

### 13.5 Incident Response Playbook

| Phase | Actions |
|-------|---------|
| **Detection** | Monitor alerts (Prometheus/Grafana), review rate limit rejections, check health endpoints |
| **Triage** | Assess severity (P1-P4), identify affected components and tenants |
| **Containment** | Block attacking IPs, revoke compromised tokens, disable affected integrations |
| **Eradication** | Patch vulnerability, rotate secrets, update security configurations |
| **Recovery** | Restore from backups if needed, verify system integrity, re-enable services |
| **Post-mortem** | Document timeline, root cause, impact, and preventive measures |

---

## Appendix A: Security Configuration Checklist

Use this checklist before promoting any environment to production:

- [ ] `JWT_SECRET` set to a cryptographically random value (minimum 64 characters)
- [ ] `SECRETS_ENCRYPTION_KEY` set to a cryptographically random value
- [ ] `DATABASE_URL` uses `sslmode=require`
- [ ] All default passwords changed (PostgreSQL, MinIO, Redis)
- [ ] HTTPS enforced with valid TLS certificate
- [ ] HSTS header enabled in nginx
- [ ] CORS origins restricted to production frontend domain
- [ ] Rate limiting configured for expected traffic patterns
- [ ] Non-root users in all containers
- [ ] Docker images scanned with Trivy (no CRITICAL/HIGH vulnerabilities)
- [ ] Health check endpoints accessible to monitoring system
- [ ] Prometheus metrics endpoint restricted to internal network
- [ ] Audit logging enabled and persisting to PostgreSQL
- [ ] Backup procedures tested and recovery validated
- [ ] MFA enabled for all admin and owner accounts
- [ ] API documentation endpoints (`/docs`, `/redoc`) disabled or restricted in production
- [ ] `ENCRYPTION_KEY` or `SECRETS_ENCRYPTION_KEY` set for BYOK AI key encryption
- [ ] AI features disabled by default (`ai_enabled: false` in `ai_settings`)
- [ ] BYOK daily budget limits configured (`max_requests_per_day`, `max_cost_per_day_cents`)
- [ ] AI usage logs (`ai_usage_log`) monitored for anomalies
- [ ] No AI API keys stored in frontend state or localStorage (verify `hasApiKey` boolean pattern)
- [ ] `.env` file permissions restricted (`chmod 600`)
- [ ] Firewall rules restrict database and cache ports to internal network
- [ ] WAF deployed in front of nginx (for SaaS deployments)

---

## Appendix B: Key Security Files Reference

| File | Path | Purpose |
|------|------|---------|
| RBAC Middleware | `backend/app/middleware/rbac_middleware.py` | Permission and role enforcement decorators |
| Tenant Middleware | `backend/app/middleware/tenant_middleware.py` | JWT extraction, tenant isolation, context variables |
| Rate Limit Middleware | `backend/app/middleware/rate_limit_middleware.py` | Per-IP sliding window rate limiting |
| Trace Logging Middleware | `backend/app/middleware/trace_logging_middleware.py` | Request correlation with trace IDs |
| RBAC Service | `backend/app/services/core/rbac_service.py` | Role and permission management |
| Secrets Service | `backend/app/services/core/secrets_service.py` | Fernet-encrypted secret storage |
| Protected Route | `src/components/ProtectedRoute.tsx` | Frontend role-based route guard |
| Auth Context | `src/contexts/AuthContext.tsx` | Supabase auth state management |
| License Gate | `src/components/LicenseGate.tsx` | Enterprise feature gating |
| AI Settings Service | `backend/app/services/core/ai_settings_service.py` | BYOK key encryption, resolution, budget tracking |
| AI Settings API | `backend/app/routers/platform/ai_settings_api.py` | REST API for AI settings and key management |
| AI Key Resolver | `backend/app/routers/ai/ai_key_resolver.py` | Shared helper for resolving BYOK keys in AI routers |
| AI Context | `src/contexts/AIContext.tsx` | Frontend AI feature flags (no keys stored) |
| AI Configuration UI | `src/components/AIConfiguration.tsx` | Settings > AI tab for BYOK key management |
| AI Settings Migration | `supabase/migrations/034_ai_settings.sql` | Database tables for AI settings, keys, and usage |
| Nginx Config | `nginx/default.conf` | Security headers, rate limiting, API proxy |
| Backend Dockerfile | `backend/Dockerfile` | Non-root container, health check |
| Frontend Dockerfile | `Dockerfile.frontend` | Non-root nginx, security headers |
| Docker Compose (Full) | `docker-compose.full.yml` | Production stack with all services |

---

*This document is maintained as part of the Flowstral platform repository. Update it whenever security-related changes are made to middleware, infrastructure, or deployment configurations.*
