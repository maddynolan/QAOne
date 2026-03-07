# Flowstral Platform — Master Security Rules & Compliance Guide

> **AUTHORITATIVE REFERENCE** for all security rules, controls, and compliance requirements.
> Every developer, operator, and auditor MUST follow these rules. Violations are deployment blockers.
>
> **Compliance Frameworks:** SOC 2 Type II | HIPAA | GDPR | FedRAMP (Moderate) | PCI-DSS v4.0 | ISO 27001:2022
>
> **Audience:** Engineering, DevOps, Security, Compliance, Legal
> **Last updated:** 2026-03-06
> **Document owner:** Security Engineering

---

## Table of Contents

1. [Document Hierarchy & Related Guides](#1-document-hierarchy--related-guides)
2. [Security Rule Categories](#2-security-rule-categories)
3. [SEC-AUTH: Authentication Rules](#3-sec-auth-authentication-rules)
4. [SEC-AUTHZ: Authorization & Access Control Rules](#4-sec-authz-authorization--access-control-rules)
5. [SEC-DATA: Data Protection Rules](#5-sec-data-data-protection-rules)
6. [SEC-CRYPTO: Cryptography & Key Management Rules](#6-sec-crypto-cryptography--key-management-rules)
7. [SEC-NET: Network Security Rules](#7-sec-net-network-security-rules)
8. [SEC-LOG: Logging, Monitoring & Audit Rules](#8-sec-log-logging-monitoring--audit-rules)
9. [SEC-INPUT: Input Validation & Injection Prevention Rules](#9-sec-input-input-validation--injection-prevention-rules)
10. [SEC-FILE: File Handling & Upload Rules](#10-sec-file-file-handling--upload-rules)
11. [SEC-API: API Security Rules](#11-sec-api-api-security-rules)
12. [SEC-CONTAINER: Container & Infrastructure Rules](#12-sec-container-container--infrastructure-rules)
13. [SEC-PRIVACY: Privacy & Data Subject Rights Rules](#13-sec-privacy-privacy--data-subject-rights-rules)
14. [SEC-INCIDENT: Incident Response Rules](#14-sec-incident-incident-response-rules)
15. [SEC-SUPPLY: Supply Chain & Dependency Rules](#15-sec-supply-supply-chain--dependency-rules)
16. [SEC-AI: AI/LLM-Specific Security Rules](#16-sec-ai-aillm-specific-security-rules)
17. [Feature Module Security Requirements](#17-feature-module-security-requirements)
18. [Compliance Framework Cross-Reference Matrix](#18-compliance-framework-cross-reference-matrix)
19. [Enforcement & Exceptions](#19-enforcement--exceptions)

---

## 1. Document Hierarchy & Related Guides

This document is the **top-level security authority**. All other security documents derive from and must not contradict this one.

| Document | Purpose | Path |
|----------|---------|------|
| **This document** | Master security rules & compliance mapping | `docs/SECURITY-RULES-MASTER.md` |
| Security Configuration Guide | Operational setup instructions | `docs/SECURITY-CONFIGURATION-GUIDE.md` |
| Enterprise Security Guide | Architecture & implementation details | `docs/ENTERPRISE-SECURITY-GUIDE.md` |
| Incident Response Plan | IR procedures & playbooks | `docs/INCIDENT-RESPONSE-PLAN.md` |
| Security Questionnaire Responses | Pre-written enterprise questionnaire answers | `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` |
| Compliance Readiness Matrix | Control-by-control gap analysis | `docs/COMPLIANCE-READINESS-MATRIX.md` |

### Compliance Framework Legend

Throughout this document, each rule is tagged with the compliance frameworks it satisfies:

| Tag | Framework | Description |
|-----|-----------|-------------|
| `SOC2` | SOC 2 Type II | AICPA Trust Service Criteria (CC1-CC9) |
| `HIPAA` | HIPAA Security Rule | 45 CFR Part 160/164 — healthcare data protection |
| `GDPR` | EU General Data Protection Regulation | EU 2016/679 — personal data protection |
| `FedRAMP` | Federal Risk & Authorization Management Program | NIST SP 800-53 Rev 5 controls |
| `PCI` | PCI-DSS v4.0 | Payment Card Industry Data Security Standard |
| `ISO` | ISO 27001:2022 | Information Security Management System |
| `NIST` | NIST Cybersecurity Framework | Risk management framework |

---

## 2. Security Rule Categories

Each rule follows this format:

```
[RULE-ID] Rule Title
Severity: CRITICAL | HIGH | MEDIUM | LOW
Frameworks: SOC2(CC#.#) | HIPAA(§164.###) | GDPR(Art.##) | FedRAMP(XX-#) | PCI(Req.#) | ISO(A.#.#)
Enforcement: AUTOMATED | MANUAL | CI/CD
Status: IMPLEMENTED | IN PROGRESS | PLANNED

Description and implementation requirements.
```

---

## 3. SEC-AUTH: Authentication Rules

### [SEC-AUTH-001] JWT Secret Key Must Be Externally Configured
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(d)) | FedRAMP(IA-5) | PCI(Req.8.3) | ISO(A.8.5)
**Enforcement:** AUTOMATED (startup validation)
**Status:** IMPLEMENTED

- JWT signing key MUST be provided via `JWT_SECRET_KEY` environment variable
- Application MUST refuse to start in production (`APP_ENV=production`) if key is missing or is a known default
- Known insecure defaults that trigger rejection: `"your-secret-key-change-in-production"`, `"dev-only-insecure-secret-change-me"`, empty string
- Minimum key length: 32 characters (256 bits)
- Key MUST be generated using cryptographically secure random generator: `openssl rand -hex 32`
- **File:** `backend/app/main.py` → `_validate_startup_security()`

### [SEC-AUTH-002] JWT Signatures Must Always Be Verified
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(d)) | FedRAMP(IA-5) | PCI(Req.8.3) | ISO(A.8.5)
**Enforcement:** CODE REVIEW
**Status:** IMPLEMENTED

- All JWT decode operations MUST verify the signature — `verify_signature=False` is PROHIBITED
- The `extract_claims()` function must always pass `options={"verify_signature": True}`
- Token expiration (`exp` claim) MUST be verified
- **File:** `backend/app/services/auth/jwt_service.py`

### [SEC-AUTH-003] Short-Lived Access Tokens with Refresh
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(d)) | FedRAMP(IA-5) | PCI(Req.8.6) | ISO(A.8.5)
**Enforcement:** CODE REVIEW
**Status:** IMPLEMENTED

- Access tokens: 15-minute expiration (configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh tokens: 7-day expiration, stored server-side
- Token rotation: new refresh token issued on each refresh, old one invalidated
- JWT ID (`jti`) claim included for revocation support

### [SEC-AUTH-004] Multi-Factor Authentication (MFA)
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(d)) | FedRAMP(IA-2(1)) | PCI(Req.8.4) | ISO(A.8.5)
**Enforcement:** MANUAL (admin toggle)
**Status:** IMPLEMENTED

- TOTP (RFC 6238) via `pyotp` library
- Enrollment: generate secret → display QR code → verify first code → enable
- 10 single-use recovery codes generated at enrollment (SHA-256 hashed before storage)
- Admin can enforce MFA org-wide
- Rate limit: 10 requests/minute on MFA endpoints
- **Files:** `backend/app/services/auth/mfa_service.py`, `backend/app/routers/platform/mfa_api.py`

### [SEC-AUTH-005] Password Security Requirements
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(IA-5(1)) | PCI(Req.8.3) | ISO(A.8.5)
**Enforcement:** AUTOMATED (validation service)
**Status:** IMPLEMENTED

- Minimum length: 12 characters
- Must contain: uppercase, lowercase, digit, special character
- Checked against common password dictionary (top 10,000)
- Hashing: bcrypt via passlib (cost factor 12), SHA-512 fallback
- Passwords NEVER logged, NEVER stored in plaintext, NEVER returned in API responses
- **File:** `backend/app/services/auth/password_service.py`

### [SEC-AUTH-006] Authentication Rate Limiting
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(AC-7) | PCI(Req.8.3) | ISO(A.8.16)
**Enforcement:** AUTOMATED (middleware)
**Status:** IMPLEMENTED

- Auth endpoints (`/auth/*`): 10 requests/minute per IP
- MFA endpoints (`/api/mfa/*`): 10 requests/minute per IP
- Failed login attempts: logged with IP address for security monitoring
- Nginx auth zone: 5r/s with burst=3
- **File:** `backend/app/middleware/rate_limit_middleware.py`

---

## 4. SEC-AUTHZ: Authorization & Access Control Rules

### [SEC-AUTHZ-001] Role-Based Access Control (RBAC)
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.3) | HIPAA(§164.312(a)(1)) | GDPR(Art.25) | FedRAMP(AC-3) | PCI(Req.7.1) | ISO(A.8.3)
**Enforcement:** CODE REVIEW + AUTOMATED
**Status:** IMPLEMENTED

- Four roles in hierarchy: `owner > admin > member > viewer`
- All state-changing endpoints MUST use `@require_permission("resource:action")` decorator
- Viewers: read-only access to all resources
- Members: create, read, update — no delete, no admin functions
- Admins: full CRUD + user management + settings
- Owners: all admin permissions + org deletion + billing
- **File:** `backend/app/middleware/rbac_middleware.py`

### [SEC-AUTHZ-002] Tenant Isolation
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.3) | HIPAA(§164.312(a)(1)) | FedRAMP(AC-4) | PCI(Req.7.1) | ISO(A.8.3)
**Enforcement:** AUTOMATED (middleware)
**Status:** IMPLEMENTED

- Tenant ID MUST be extracted from JWT token claims — NEVER from client-supplied headers
- `X-Tenant-ID` and `X-User-ID` headers from clients are IGNORED
- Internal service-to-service calls: validated via `X-Internal-Service-Key` shared secret
- All database queries MUST include `tenant_id` filter (enforced by middleware setting `request.state.tenant_id`)
- Cross-tenant data access: DENIED by default, no override mechanism
- **File:** `backend/app/middleware/tenant_middleware.py`

### [SEC-AUTHZ-003] Secrets Access Control
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(AC-3) | PCI(Req.7.1) | ISO(A.8.3)
**Enforcement:** AUTOMATED
**Status:** IMPLEMENTED

- Secret reveal (`?reveal=true`): restricted to `admin` and `owner` roles only
- Every secret reveal generates an audit log entry
- Rate limit: max 10 reveals/minute per user
- **File:** `backend/app/routers/platform/secrets_api.py`

### [SEC-AUTHZ-004] Principle of Least Privilege for Service Accounts
**Severity:** HIGH
**Frameworks:** SOC2(CC6.3) | FedRAMP(AC-6) | PCI(Req.7.2) | ISO(A.8.2)
**Enforcement:** MANUAL (K8s config)
**Status:** IMPLEMENTED

- Kubernetes: dedicated ServiceAccounts for backend and test-worker (no default SA)
- Docker: all containers run as non-root user `appuser` (UID 1001)
- Database: application user has only DML permissions (SELECT, INSERT, UPDATE, DELETE) — no DDL in production
- **Files:** `helm/qaai/values.yaml`, `docker-compose.full.yml`

---

## 5. SEC-DATA: Data Protection Rules

### [SEC-DATA-001] Encryption at Rest
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.7) | HIPAA(§164.312(a)(2)(iv)) | GDPR(Art.32) | FedRAMP(SC-28) | PCI(Req.3.5) | ISO(A.8.24)
**Enforcement:** MANUAL (infrastructure config)
**Status:** IMPLEMENTED

- PostgreSQL: TDE via `pgcrypto` extension or disk-level encryption required
- MinIO/S3: Server-Side Encryption (SSE-S3 or SSE-KMS) required
- Redis: encrypted volumes required in production
- Kubernetes: `encrypted: true` annotation on PersistentVolumeClaims
- Secrets in database: Fernet-encrypted (AES-128-CBC) via `ENCRYPTION_KEY`
- **See:** `docs/SECURITY-CONFIGURATION-GUIDE.md` Section 4

### [SEC-DATA-002] Encryption in Transit
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.7) | HIPAA(§164.312(e)(1)) | GDPR(Art.32) | FedRAMP(SC-8) | PCI(Req.4.1) | ISO(A.8.24)
**Enforcement:** AUTOMATED (nginx + ingress)
**Status:** IMPLEMENTED

- All external traffic: TLS 1.2+ required (TLS 1.0 and 1.1 DISABLED)
- Cipher suite: ECDHE+AESGCM only (forward secrecy required)
- HSTS enabled: `max-age=31536000; includeSubDomains; preload`
- HTTP (port 80) → HTTPS (port 443) redirect enforced
- Internal cluster traffic: TLS recommended via service mesh
- **File:** `nginx/default.conf`

### [SEC-DATA-003] Encryption Key Requirements
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.7) | HIPAA(§164.312(a)(2)(iv)) | FedRAMP(SC-12) | PCI(Req.3.6) | ISO(A.8.24)
**Enforcement:** AUTOMATED (startup validation)
**Status:** IMPLEMENTED

- `ENCRYPTION_KEY` (or `SECRETS_ENCRYPTION_KEY`): required, fails startup if missing in production
- Minimum length: 32 bytes (256 bits)
- Generated via: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- Key rotation: documented procedure in Security Configuration Guide
- Key backup: encrypted, stored separately from data
- **File:** `backend/app/main.py` → `_validate_startup_security()`

### [SEC-DATA-004] PII Handling Rules
**Severity:** HIGH
**Frameworks:** SOC2(CC6.5) | HIPAA(§164.502) | GDPR(Art.5) | FedRAMP(SI-12) | ISO(A.8.11)
**Enforcement:** AUTOMATED (log filter)
**Status:** IMPLEMENTED

- PII MUST NOT appear in application logs — enforced by `PIISanitizationFilter`:
  - Email addresses: `u***@e***.com`
  - IP addresses: `192.168.x.x`
  - Bearer tokens: `Bearer [REDACTED]`
  - API keys: `sk-[REDACTED]`
- PII in error responses: PROHIBITED in production mode
- PII in URLs: PROHIBITED (no query params with personal data)
- PII in screenshots/recordings: warning displayed to operators
- **File:** `backend/app/middleware/trace_logging_middleware.py`

### [SEC-DATA-005] Data Classification
**Severity:** MEDIUM
**Frameworks:** SOC2(CC6.5) | HIPAA(§164.312(a)(1)) | GDPR(Art.9) | FedRAMP(RA-2) | PCI(Req.3.2) | ISO(A.5.12)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

| Classification | Examples | Controls Required |
|---------------|----------|-------------------|
| **CRITICAL** | Encryption keys, JWT secrets, DB passwords | Env vars only, never in code/logs/responses |
| **CONFIDENTIAL** | API keys (BYOK), user passwords, MFA secrets | Fernet-encrypted at rest, masked in logs |
| **INTERNAL** | Test cases, recordings, audit logs | Tenant-isolated, RBAC-protected |
| **PUBLIC** | Marketing pages, docs, pricing | No special controls |

---

## 6. SEC-CRYPTO: Cryptography & Key Management Rules

### [SEC-CRYPTO-001] Approved Cryptographic Algorithms
**Severity:** HIGH
**Frameworks:** SOC2(CC6.7) | HIPAA(§164.312(a)(2)(iv)) | FedRAMP(SC-13) | PCI(Req.3.6) | ISO(A.8.24)
**Enforcement:** CODE REVIEW
**Status:** IMPLEMENTED

| Use Case | Algorithm | Library |
|----------|-----------|---------|
| JWT signing | HS256 (HMAC-SHA256) | PyJWT |
| Password hashing | bcrypt (cost 12) | passlib |
| Secret encryption | Fernet (AES-128-CBC + HMAC-SHA256) | cryptography |
| MFA/TOTP | HMAC-SHA1 (per RFC 6238) | pyotp |
| Audit hash chain | SHA-256 | hashlib |
| TLS | ECDHE+AESGCM (TLS 1.2+) | OpenSSL (nginx) |

**PROHIBITED algorithms:** MD5, SHA-1 (for signing), DES, 3DES, RC4, SSLv3, TLS 1.0, TLS 1.1

### [SEC-CRYPTO-002] Key Rotation Policy
**Severity:** HIGH
**Frameworks:** SOC2(CC6.7) | FedRAMP(SC-12(1)) | PCI(Req.3.6) | ISO(A.8.24)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

| Key Type | Rotation Frequency | Procedure |
|----------|-------------------|-----------|
| JWT signing key | Every 90 days | Generate new key → deploy → old tokens expire naturally |
| Encryption key | Annually or on compromise | Re-encrypt all secrets with new key |
| Database password | Every 90 days | Update via secrets manager |
| TLS certificate | Before expiry (auto via cert-manager) | Let's Encrypt auto-renewal |
| BYOK API keys | Per customer policy | Customer-managed via Settings |

---

## 7. SEC-NET: Network Security Rules

### [SEC-NET-001] Network Segmentation
**Severity:** HIGH
**Frameworks:** SOC2(CC6.6) | HIPAA(§164.312(e)(1)) | FedRAMP(SC-7) | PCI(Req.1.3) | ISO(A.8.22)
**Enforcement:** MANUAL (K8s NetworkPolicy)
**Status:** IMPLEMENTED

- Backend → PostgreSQL, Redis, MinIO, Ollama: ALLOWED
- Test workers → Backend, PostgreSQL, Redis: ALLOWED
- Frontend → Backend only: ALLOWED
- All other inter-pod traffic: DENIED by default
- External ingress: through nginx/ingress controller only
- **File:** `helm/qaai/values.yaml` → `networkPolicy`

### [SEC-NET-002] Rate Limiting
**Severity:** HIGH
**Frameworks:** SOC2(CC6.6) | FedRAMP(SC-5) | PCI(Req.6.4) | ISO(A.8.16)
**Enforcement:** AUTOMATED (middleware + nginx)
**Status:** IMPLEMENTED

| Endpoint Category | Limit (per IP) | Backend | Nginx |
|-------------------|---------------|---------|-------|
| Default API | 100/min | `rate_limit_middleware.py` | 30r/s |
| Auth endpoints | 10/min | `rate_limit_middleware.py` | 5r/s |
| AI/LLM endpoints | 20/min | `rate_limit_middleware.py` | via API zone |
| MFA endpoints | 10/min | `rate_limit_middleware.py` | 5r/s |
| File uploads | 5/min | `rate_limit_middleware.py` | 5r/s |
| Privacy/erasure | 5/min | `rate_limit_middleware.py` | via API zone |
| Health/metrics | Unlimited | Excluded | No limit |
| Static assets | N/A | N/A | 50r/s |

**Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### [SEC-NET-003] CORS Configuration
**Severity:** HIGH
**Frameworks:** SOC2(CC6.6) | FedRAMP(SC-7) | PCI(Req.6.4) | ISO(A.8.22)
**Enforcement:** AUTOMATED
**Status:** IMPLEMENTED

- Origins: MUST be explicitly configured via `CORS_ALLOWED_ORIGINS` env var (comma-separated)
- Development defaults: `http://localhost:8080,http://localhost:5173,http://localhost:3000`
- Production: NO wildcards — exact origin list required
- Methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS` (no wildcard)
- Headers: `Authorization, Content-Type, X-Request-ID, Accept, X-Tenant-ID` (no wildcard)
- Credentials: enabled for authenticated requests
- **File:** `backend/app/main.py`

### [SEC-NET-004] Security Headers
**Severity:** MEDIUM
**Frameworks:** SOC2(CC6.6) | FedRAMP(SC-7) | PCI(Req.6.4) | ISO(A.8.22)
**Enforcement:** AUTOMATED (nginx)
**Status:** IMPLEMENTED

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Feature restrictions |
| `Content-Security-Policy` | `default-src 'self'; ...` | Prevent injection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |

- **File:** `nginx/default.conf`

### [SEC-NET-005] Internal Header Stripping
**Severity:** HIGH
**Frameworks:** SOC2(CC6.6) | FedRAMP(SC-7) | ISO(A.8.22)
**Enforcement:** AUTOMATED (nginx)
**Status:** IMPLEMENTED

- `X-Internal-Service-Key`: stripped from all client requests at nginx proxy level
- Prevents clients from spoofing internal service-to-service authentication
- **File:** `nginx/default.conf` → `proxy_set_header X-Internal-Service-Key ""`

---

## 8. SEC-LOG: Logging, Monitoring & Audit Rules

### [SEC-LOG-001] Audit Log Immutability
**Severity:** CRITICAL
**Frameworks:** SOC2(CC7.2) | HIPAA(§164.312(b)) | GDPR(Art.30) | FedRAMP(AU-9) | PCI(Req.10.3) | ISO(A.8.15)
**Enforcement:** AUTOMATED (database constraints)
**Status:** IMPLEMENTED

- Audit log table: append-only (UPDATE/DELETE revoked via PostgreSQL migration)
- Hash chain: each entry includes SHA-256 hash of previous entry for tamper detection
- Integrity verification endpoint: validates hash chain is unbroken
- Minimum retention: 7 years (SOC 2 / HIPAA requirement)
- **File:** `backend/app/services/core/audit_service.py`

### [SEC-LOG-002] Security Event Logging
**Severity:** HIGH
**Frameworks:** SOC2(CC7.2) | HIPAA(§164.312(b)) | FedRAMP(AU-2) | PCI(Req.10.2) | ISO(A.8.15)
**Enforcement:** AUTOMATED
**Status:** IMPLEMENTED

The following events MUST be logged to the audit trail:

| Event | Data Captured |
|-------|--------------|
| Login success | user_id, IP, timestamp, method |
| Login failure | attempted_user, IP, timestamp, reason |
| Logout | user_id, IP, timestamp |
| Permission denied | user_id, resource, action, IP |
| Secret revealed | user_id, secret_name, IP |
| Secret modified | user_id, secret_name, action, IP |
| Data export | user_id, export_type, IP |
| Data erasure | user_id, request_id, status |
| MFA enrolled/disabled | user_id, action |
| User role changed | admin_id, target_user, old_role, new_role |
| Settings changed | user_id, setting_key, IP |

### [SEC-LOG-003] Log Sanitization
**Severity:** HIGH
**Frameworks:** SOC2(CC6.5) | HIPAA(§164.502) | GDPR(Art.5) | FedRAMP(SI-12) | PCI(Req.3.4) | ISO(A.8.11)
**Enforcement:** AUTOMATED (logging filter)
**Status:** IMPLEMENTED

- `PIISanitizationFilter` applied to ALL Python logging handlers
- Patterns masked: email addresses, IPv4 addresses, Bearer tokens, API keys (`sk-*`, `key-*`)
- Structured JSON logging format for log aggregation (ELK, Datadog, Splunk)
- **File:** `backend/app/middleware/trace_logging_middleware.py`

### [SEC-LOG-004] Log Retention
**Severity:** MEDIUM
**Frameworks:** SOC2(CC7.2) | HIPAA(§164.530(j)) | FedRAMP(AU-11) | PCI(Req.10.7) | ISO(A.8.15)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

| Log Type | Minimum Retention | Maximum |
|----------|-------------------|---------|
| Security/audit logs | 7 years | Indefinite |
| Application logs | 90 days | 1 year |
| Access logs (nginx) | 90 days | 1 year |
| Debug logs | 7 days | 30 days |
| Performance metrics | 1 year | 3 years |

---

## 9. SEC-INPUT: Input Validation & Injection Prevention Rules

### [SEC-INPUT-001] SQL Injection Prevention
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** CODE REVIEW + AUTOMATED
**Status:** IMPLEMENTED

- Parameterized queries ONLY — no string interpolation in SQL
- Dynamic table/column names: validated against whitelist + regex `^[a-zA-Z_][a-zA-Z0-9_]*$`
- ORM usage preferred over raw SQL
- Table name whitelist maintained in `postgres_direct.py`
- **File:** `backend/app/services/storage/postgres_direct.py`

### [SEC-INPUT-002] Command Injection Prevention
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** CODE REVIEW
**Status:** ENFORCED (rule)

- `subprocess.call()` / `subprocess.Popen()`: MUST use list arguments, NEVER `shell=True` with user input
- All user-supplied values passed to subprocess MUST be sanitized/validated
- Playwright browser launches: URL validated before navigation
- File paths: validated against path traversal before use in system commands

### [SEC-INPUT-003] XSS Prevention
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** AUTOMATED (CSP + framework)
**Status:** IMPLEMENTED

- Content-Security-Policy header prevents inline script execution
- React auto-escapes all rendered content
- User-generated HTML in reports: sanitized before rendering
- API responses: `Content-Type: application/json` (no HTML interpretation)

### [SEC-INPUT-004] SSRF Prevention
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** CODE REVIEW
**Status:** RULE DEFINED

- User-supplied URLs (for scanning, testing, crawling) MUST be validated:
  - Block private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`
  - Block internal hostnames: `localhost`, `metadata.google.internal`, `169.254.169.254`
  - Block non-HTTP(S) schemes: `file://`, `ftp://`, `gopher://`, `data:`
  - Maximum redirect depth: 3
- Performance testing: MUST validate target URLs are not internal/private
- Accessibility scanning: MUST validate target URLs
- AI exploration/crawling: MUST validate all discovered URLs before navigation
- **Applies to:** Performance, Accessibility, Visual Testing, AI Testing, API Import modules

### [SEC-INPUT-005] Path Traversal Prevention
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-10) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** CODE REVIEW
**Status:** ENFORCED (rule)

- All file paths from user input MUST be validated:
  - Reject paths containing `../`, `..\\`, `\0`
  - Resolve canonical path and verify it's within allowed directory
  - Use `os.path.realpath()` + `startswith()` check against base directory
- Uploaded files: stored with randomized names, not user-provided names
- **Applies to:** File upload endpoints, visual testing baselines, API spec import

### [SEC-INPUT-006] Request Body Size Limits
**Severity:** MEDIUM
**Frameworks:** SOC2(CC6.6) | FedRAMP(SC-5) | PCI(Req.6.4) | ISO(A.8.16)
**Enforcement:** AUTOMATED (middleware + nginx)
**Status:** IMPLEMENTED

- Global request body limit: 50MB (configurable via `UPLOAD_MAX_SIZE_MB`)
- Nginx: `client_max_body_size 50m`
- Backend middleware: validates `Content-Length` header before reading body
- **File:** `backend/app/main.py`

---

## 10. SEC-FILE: File Handling & Upload Rules

### [SEC-FILE-001] File Type Validation
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-3) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** CODE REVIEW
**Status:** ENFORCED (rule)

- Allowed file types (whitelist):
  - API specs: `.json`, `.yaml`, `.yml`, `.har`
  - Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`
  - Data files: `.csv`, `.xlsx`
  - Mobile flows: `.yaml`, `.yml`
- Magic bytes validation for image uploads (not just extension)
- MIME type verification against file content
- Executable files: ALWAYS REJECTED (`.exe`, `.sh`, `.bat`, `.cmd`, `.ps1`, `.dll`, `.so`)

### [SEC-FILE-002] File Storage Security
**Severity:** HIGH
**Frameworks:** SOC2(CC6.7) | HIPAA(§164.312(a)(2)(iv)) | FedRAMP(SC-28) | PCI(Req.3.5) | ISO(A.8.24)
**Enforcement:** MANUAL
**Status:** ENFORCED (rule)

- Uploaded files stored with UUID-based names (no user-supplied filenames in storage path)
- Files stored in designated upload directory or MinIO/S3 bucket
- File access: tenant-isolated (files belong to the uploading tenant)
- Temporary files: cleaned up after processing (max 1 hour retention)
- Antivirus scanning: recommended for enterprise deployments (ClamAV)

---

## 11. SEC-API: API Security Rules

### [SEC-API-001] API Authentication Required
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(d)) | FedRAMP(IA-2) | PCI(Req.8.1) | ISO(A.8.5)
**Enforcement:** AUTOMATED (middleware)
**Status:** IMPLEMENTED

- All API endpoints MUST require authentication EXCEPT:
  - `/health`, `/health/database`, `/health/metrics` — monitoring
  - `/metrics` — Prometheus scraping
  - `/docs`, `/openapi.json`, `/redoc` — API documentation (disable in production)
  - `/auth/login`, `/auth/register`, `/auth/refresh` — authentication endpoints
- Authentication: via `Authorization: Bearer <jwt>` header
- Missing/invalid token: return `401 Unauthorized`

### [SEC-API-002] Error Response Sanitization
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(SI-11) | PCI(Req.6.2) | ISO(A.8.28)
**Enforcement:** AUTOMATED (exception handler)
**Status:** IMPLEMENTED

- Production (`APP_ENV=production`): generic error messages only
  - `{"error": "Internal server error", "request_id": "<uuid>"}`
  - Stack traces: logged server-side only
  - Database errors: `"A database error occurred"`
  - No file paths, SQL queries, or internal state in responses
- Development: full error details including stack trace
- Request ID: included in all error responses for correlation
- **File:** `backend/app/main.py` → global exception handler

### [SEC-API-003] API Versioning & Deprecation
**Severity:** MEDIUM
**Frameworks:** SOC2(CC8.1) | ISO(A.8.9)
**Enforcement:** MANUAL
**Status:** ENFORCED (rule)

- API endpoints use versioned prefixes where applicable (`/api/v2/testing`)
- Deprecated endpoints: return `Deprecation` header with sunset date
- Breaking changes: new version required, old version maintained for minimum 90 days

---

## 12. SEC-CONTAINER: Container & Infrastructure Rules

### [SEC-CONTAINER-001] Non-Root Container Execution
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | FedRAMP(CM-6) | PCI(Req.2.2) | ISO(A.8.9)
**Enforcement:** AUTOMATED (Dockerfile + K8s)
**Status:** IMPLEMENTED

- All containers: `runAsNonRoot: true`, `runAsUser: 1001`
- Privilege escalation: `allowPrivilegeEscalation: false`
- Capabilities: `drop: ["ALL"]` (no Linux capabilities)
- Seccomp profile: `RuntimeDefault`
- Root filesystem: read-only where possible (`readOnlyRootFilesystem: true`)
  - Exception: test workers (Playwright requires writable browser cache)
- **Files:** `docker-compose.full.yml`, `helm/qaai/values.yaml`

### [SEC-CONTAINER-002] Image Security
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(CM-6) | PCI(Req.6.3) | ISO(A.8.9)
**Enforcement:** CI/CD
**Status:** IMPLEMENTED

- Base images: pinned to specific versions (no `latest` tag in production)
- Multi-stage builds: separate build and runtime stages
- Vulnerability scanning: Trivy or Grype in CI/CD pipeline
- Image signing: recommended via Cosign/Notation
- Base image updates: monthly review cycle

### [SEC-CONTAINER-003] No Hardcoded Credentials in Container Config
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(IA-5) | PCI(Req.2.3) | ISO(A.8.5)
**Enforcement:** CODE REVIEW + CI/CD
**Status:** IMPLEMENTED

- Docker Compose: all credentials via `${VAR:?required}` syntax (fail if not set)
- Kubernetes: credentials via `Secret` objects or external secrets manager
- No default passwords for PostgreSQL, MinIO, Redis — all REQUIRE explicit configuration
- Environment files (`.env`): NEVER committed to version control (in `.gitignore`)
- **Files:** `docker-compose.full.yml`, `helm/qaai/values.yaml`

### [SEC-CONTAINER-004] Container Runtime Protection
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(CM-6) | PCI(Req.2.2) | ISO(A.8.9)
**Enforcement:** AUTOMATED (Docker + K8s)
**Status:** IMPLEMENTED

- `no-new-privileges` security option on all containers
- Resource limits set (CPU and memory) to prevent resource exhaustion
- Health checks on all services for automated restart
- Restart policy: `unless-stopped` (Docker) / managed by K8s
- **Files:** `docker-compose.full.yml`, `helm/qaai/values.yaml`

---

## 13. SEC-PRIVACY: Privacy & Data Subject Rights Rules

### [SEC-PRIVACY-001] GDPR Right to Erasure (Article 17)
**Severity:** CRITICAL
**Frameworks:** GDPR(Art.17) | HIPAA(§164.524) | ISO(A.5.34)
**Enforcement:** AUTOMATED (API endpoints)
**Status:** IMPLEMENTED

- `POST /api/privacy/erasure-request`: initiate erasure (30-day grace period)
- `POST /api/privacy/erasure-execute`: execute after grace period
- `POST /api/privacy/erasure-cancel`: cancel within grace period
- Cascading deletion across 20+ tables (test cases, runs, recordings, API collections, etc.)
- Audit logs: anonymized (not deleted) — `"DELETED_USER"` placeholder
- **Files:** `backend/app/services/core/data_erasure_service.py`, `backend/app/routers/platform/data_privacy_api.py`

### [SEC-PRIVACY-002] GDPR Right to Data Portability (Article 20)
**Severity:** HIGH
**Frameworks:** GDPR(Art.20) | ISO(A.5.34)
**Enforcement:** AUTOMATED (API endpoint)
**Status:** IMPLEMENTED

- `POST /api/privacy/data-export`: exports all user data as JSON
- Includes: test cases, test runs, recordings, API collections, settings, audit logs
- Format: structured JSON with metadata
- Access: restricted to the data subject (verified via JWT)

### [SEC-PRIVACY-003] Data Retention Policy
**Severity:** HIGH
**Frameworks:** GDPR(Art.5(1)(e)) | HIPAA(§164.530(j)) | SOC2(CC6.5) | FedRAMP(SI-12) | ISO(A.5.33)
**Enforcement:** MANUAL (configurable)
**Status:** IMPLEMENTED (documented)

- Default data retention: 365 days (configurable per org)
- Test run results: retained per retention policy, then auto-deleted
- Recordings and screenshots: retained per retention policy
- Audit logs: minimum 7 years (compliance override)
- User accounts: deactivated after 90 days of inactivity (configurable)

### [SEC-PRIVACY-004] Consent Management
**Severity:** HIGH
**Frameworks:** GDPR(Art.6,7) | ISO(A.5.34)
**Enforcement:** MANUAL
**Status:** ENFORCED (rule)

- Cookie consent: must be obtained before non-essential cookies
- Analytics tracking: disabled in Electron desktop app
- Privacy-preserving defaults: decline cookies by default
- CAPTCHA/bot detection: never bypassed by platform

### [SEC-PRIVACY-005] Data Processing Records
**Severity:** MEDIUM
**Frameworks:** GDPR(Art.30) | ISO(A.5.34)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

- Records of processing activities maintained in compliance documentation
- Data flow diagrams available for each module
- Sub-processor list maintained and updated

---

## 14. SEC-INCIDENT: Incident Response Rules

### [SEC-INCIDENT-001] Incident Classification & Response
**Severity:** HIGH
**Frameworks:** SOC2(CC7.3,CC7.4) | HIPAA(§164.308(a)(6)) | GDPR(Art.33,34) | FedRAMP(IR-4) | PCI(Req.12.10) | ISO(A.5.24-28)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

| Severity | Examples | Response Time | Notification |
|----------|----------|--------------|--------------|
| P1 (Critical) | Data breach, system compromise, active exploit | 15 minutes | CTO, Legal, affected customers |
| P2 (High) | Auth bypass, privilege escalation, data leak | 1 hour | Security lead, engineering |
| P3 (Medium) | Vulnerability discovered, config error | 4 hours | Security team |
| P4 (Low) | Minor policy violation, false positive | Next business day | Security team |

- **See:** `docs/INCIDENT-RESPONSE-PLAN.md` for full procedures

### [SEC-INCIDENT-002] Breach Notification Requirements
**Severity:** CRITICAL
**Frameworks:** GDPR(Art.33,34) | HIPAA(§164.408) | FedRAMP(IR-6) | PCI(Req.12.10) | ISO(A.5.26)
**Enforcement:** MANUAL
**Status:** IMPLEMENTED (documented)

| Requirement | Deadline | Authority |
|-------------|----------|-----------|
| GDPR notification to DPA | 72 hours | EU Data Protection Authority |
| GDPR notification to subjects | "Without undue delay" | Affected individuals |
| HIPAA notification to HHS | 60 days | HHS Office for Civil Rights |
| HIPAA notification to individuals | 60 days | Affected individuals |
| State breach notification (US) | Varies (24h - 90 days) | State Attorney General |
| PCI notification | Immediate | Payment brands + acquiring bank |

---

## 15. SEC-SUPPLY: Supply Chain & Dependency Rules

### [SEC-SUPPLY-001] Dependency Security Scanning
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(SA-11) | PCI(Req.6.3) | ISO(A.8.28)
**Enforcement:** CI/CD
**Status:** ENFORCED (rule)

- `npm audit` run on every CI build (frontend)
- `pip audit` or `safety check` run on every CI build (backend)
- Critical/High vulnerabilities: block deployment
- Dependabot / Renovate: configured for automated dependency updates
- SBOM (Software Bill of Materials): generated for enterprise customers

### [SEC-SUPPLY-002] Dependency Pinning
**Severity:** MEDIUM
**Frameworks:** SOC2(CC6.1) | FedRAMP(CM-2) | PCI(Req.6.3) | ISO(A.8.9)
**Enforcement:** CODE REVIEW
**Status:** ENFORCED (rule)

- Python: exact versions in `requirements.txt` (no `>=` for security-critical packages)
- npm: `package-lock.json` committed, integrity hashes verified
- Docker base images: pinned to specific digests or versions
- Container registry: use private registry for production images

---

## 16. SEC-AI: AI/LLM-Specific Security Rules

### [SEC-AI-001] API Key Security (BYOK)
**Severity:** CRITICAL
**Frameworks:** SOC2(CC6.1) | HIPAA(§164.312(a)(1)) | FedRAMP(IA-5) | PCI(Req.8.3) | ISO(A.8.5)
**Enforcement:** AUTOMATED
**Status:** IMPLEMENTED

- BYOK API keys: Fernet-encrypted before database storage
- Frontend: NEVER stores API keys in state/localStorage (only `hasApiKey: boolean`)
- Key display: never revealed after initial storage
- Key deletion: immediate, no soft-delete
- **File:** `backend/app/services/core/ai_settings_service.py`

### [SEC-AI-002] Prompt Injection Prevention
**Severity:** HIGH
**Frameworks:** SOC2(CC6.1) | FedRAMP(SI-10) | ISO(A.8.28)
**Enforcement:** CODE REVIEW
**Status:** ENFORCED (rule)

- User input in LLM prompts: clearly delineated from system instructions
- Use template markers: `<user_input>...</user_input>` to separate untrusted content
- LLM responses: validated before executing any actions (no blind execution)
- Sensitive data: NEVER included in LLM prompts (no API keys, passwords, PII)
- Output sanitization: LLM output checked for injection attempts before rendering

### [SEC-AI-003] AI Feature Budget Control
**Severity:** MEDIUM
**Frameworks:** SOC2(CC6.1) | ISO(A.8.16)
**Enforcement:** AUTOMATED
**Status:** IMPLEMENTED

- Self-healing: max 3 AI calls per test run (budget controlled)
- Per-org usage tracking and configurable budget limits
- Rate limiting on all AI endpoints: 20/min for AI testing, 30/min for generation
- AI features: off by default, require explicit opt-in
- **File:** `backend/app/routers/ai/ai_automation_api.py`

---

## 17. Feature Module Security Requirements

Each feature module MUST comply with all applicable SEC-* rules above. Additional per-module requirements:

### 17.1 Recording Module
- Recorded actions MUST mask password fields as `[MASKED]`
- Network captures MUST mask sensitive headers (Authorization, Cookie, X-API-Key)
- Screenshots MAY contain PII — operators must be warned
- Browser launches: validate URL before navigation (SEC-INPUT-004)
- HAR exports: strip sensitive headers before output

### 17.2 Test Management Module
- Test case data: tenant-isolated (SEC-AUTHZ-002)
- Test execution: subprocess with sanitized arguments (SEC-INPUT-002)
- Complex verifications (email): credentials stored encrypted, never logged
- Version history: immutable snapshots (no modification of historical versions)

### 17.3 API Testing Module
- API spec import: YAML parsed with `yaml.safe_load()` only — `yaml.load()` PROHIBITED
- User-supplied URLs for API testing: SSRF validation required (SEC-INPUT-004)
- Database connections: credentials encrypted, connection strings not logged
- Response data: may contain sensitive info — warn operators about logging
- HAR import: validate file content, sanitize captured credentials

### 17.4 Performance Testing Module
- **CRITICAL**: Load testing can be weaponized as DDoS tool
- Target URL validation: MUST block private/internal IPs (SEC-INPUT-004)
- Virtual user limits: enforced per-tier (free: 20, paid: configurable)
- Server-side execution: resource quotas enforced (CPU/memory limits)
- Captured traffic: sensitive headers stripped before storage

### 17.5 Accessibility Testing Module
- Scanner URL validation: MUST validate target URLs (SEC-INPUT-004)
- Batch scanning: maximum URLs per batch enforced (prevent abuse)
- Screenshots captured during scans: may contain PII
- Report generation: sanitize HTML output to prevent XSS (SEC-INPUT-003)

### 17.6 Visual Testing Module
- Image uploads: validate file type by magic bytes (SEC-FILE-001)
- Baseline storage: tenant-isolated, no path traversal in filenames
- Screenshot capture: URL validation required (SEC-INPUT-004)
- Diff images: temporary, cleaned up after viewing

### 17.7 Mobile Testing Module
- Device commands (ADB/Xcode): validated before execution
- App installation: file type validation (APK/IPA only)
- YAML flow definitions: parsed with `yaml.safe_load()` only
- Device logs: may contain PII — not persisted long-term

### 17.8 AI Testing / Flowpilot Module
- Crawling URLs: validated against SSRF rules (SEC-INPUT-004)
- LLM prompts: no PII, no credentials (SEC-AI-002)
- AI-generated test steps: validated before browser execution
- SSE streaming: authenticated connection required
- Session management: auto-cleanup after timeout

---

## 18. Compliance Framework Cross-Reference Matrix

### SOC 2 Type II Trust Service Criteria

| Criteria | Controls | Status |
|----------|----------|--------|
| CC1.1-1.5 | Control Environment | RBAC, security policies, this document |
| CC2.1-2.3 | Communication & Information | Audit logging, security docs, training |
| CC3.1-3.4 | Risk Assessment | Vulnerability scanning, dependency audit, penetration testing |
| CC4.1-4.2 | Monitoring Activities | Audit trail, log aggregation, alerting |
| CC5.1-5.3 | Control Activities | RBAC enforcement, rate limiting, input validation |
| CC6.1 | Logical Access | JWT auth, MFA, password policy, API key management |
| CC6.2 | Credential Lifecycle | Key rotation, password expiry, token refresh |
| CC6.3 | Access Authorization | RBAC, tenant isolation, least privilege |
| CC6.6 | System Boundaries | Network policy, CORS, rate limiting, security headers |
| CC6.7 | Data Protection | Encryption at rest + transit, Fernet, TLS 1.2+ |
| CC6.8 | Malware Prevention | Dependency scanning, file upload validation |
| CC7.1-7.5 | System Monitoring | Audit logs, PII filtering, structured logging |
| CC8.1 | Change Management | Version control, CI/CD, API versioning |
| CC9.1-9.2 | Risk Mitigation | Incident response, disaster recovery |

### HIPAA Security Rule

| Safeguard | Section | Controls | Status |
|-----------|---------|----------|--------|
| Administrative | §164.308(a)(1) | Risk analysis, risk management | Documented |
| Administrative | §164.308(a)(3) | Workforce security, access management | RBAC, tenant isolation |
| Administrative | §164.308(a)(4) | Information access management | Least privilege, secrets access control |
| Administrative | §164.308(a)(5) | Security awareness training | Training program documented |
| Administrative | §164.308(a)(6) | Security incident procedures | Incident response plan |
| Technical | §164.312(a)(1) | Access control | JWT, MFA, RBAC, password policy |
| Technical | §164.312(b) | Audit controls | Immutable audit log, hash chain |
| Technical | §164.312(c)(1) | Integrity | Hash chain, read-only filesystem |
| Technical | §164.312(d) | Person/entity authentication | JWT, MFA, password strength |
| Technical | §164.312(e)(1) | Transmission security | TLS 1.2+, HTTPS enforcement |
| Physical | §164.310 | Physical safeguards | Cloud provider responsibility (shared model) |

### GDPR Compliance

| Article | Requirement | Controls | Status |
|---------|-------------|----------|--------|
| Art. 5 | Data processing principles | Data minimization, purpose limitation, retention policy |
| Art. 6 | Lawful processing | Consent management, legitimate interest |
| Art. 7 | Conditions for consent | Cookie consent, opt-in analytics |
| Art. 17 | Right to erasure | Data erasure API, 30-day grace period |
| Art. 20 | Data portability | JSON data export endpoint |
| Art. 25 | Data protection by design | Tenant isolation, PII masking, encryption |
| Art. 30 | Records of processing | Processing activity documentation |
| Art. 32 | Security of processing | Encryption, access control, pseudonymization |
| Art. 33 | Breach notification (DPA) | 72-hour notification procedure |
| Art. 34 | Breach notification (subjects) | Communication procedure |
| Art. 35 | DPIA | Data Protection Impact Assessment template |

### FedRAMP (Moderate) — NIST SP 800-53 Rev 5

| Family | Controls | Implementation |
|--------|----------|---------------|
| AC (Access Control) | AC-2, AC-3, AC-4, AC-6, AC-7 | RBAC, tenant isolation, least privilege, lockout |
| AU (Audit) | AU-2, AU-3, AU-9, AU-11 | Audit logging, tamper protection, retention |
| CM (Configuration) | CM-2, CM-6 | Baseline configs, container hardening |
| IA (Identification/Auth) | IA-2, IA-5 | JWT, MFA, password policy, key management |
| IR (Incident Response) | IR-4, IR-6 | Incident response plan, breach notification |
| RA (Risk Assessment) | RA-2, RA-5 | Data classification, vulnerability scanning |
| SA (System Acquisition) | SA-11 | Dependency scanning, SBOM |
| SC (System/Comms Protection) | SC-5, SC-7, SC-8, SC-12, SC-13, SC-28 | Rate limiting, network segmentation, TLS, crypto |
| SI (System/Info Integrity) | SI-3, SI-10, SI-11, SI-12 | Input validation, error handling, PII protection |

### PCI-DSS v4.0

| Requirement | Controls | Status |
|-------------|----------|--------|
| Req 1: Network Security | Network policies, firewall rules | Implemented |
| Req 2: Secure Configurations | No defaults, hardened containers | Implemented |
| Req 3: Protect Stored Data | Encryption at rest, key management | Implemented |
| Req 4: Encrypt Transmissions | TLS 1.2+, HTTPS enforcement | Implemented |
| Req 5: Malware Protection | Dependency scanning, file validation | Implemented |
| Req 6: Secure Development | Input validation, code review, vulnerability management | Implemented |
| Req 7: Restrict Access | RBAC, least privilege, tenant isolation | Implemented |
| Req 8: Identify Users | JWT, MFA, password policy, session management | Implemented |
| Req 9: Physical Access | Cloud provider shared responsibility | N/A (cloud) |
| Req 10: Log & Monitor | Audit trail, log retention, PII masking | Implemented |
| Req 11: Test Security | Vulnerability scanning, dependency audit | CI/CD |
| Req 12: Security Policies | This document, IR plan, training | Documented |

### ISO 27001:2022 Annex A

| Control | Description | Implementation |
|---------|-------------|---------------|
| A.5.1-5.37 | Organizational Controls | Security policies, roles, asset management, data classification |
| A.6.1-6.8 | People Controls | Security awareness, terms of employment |
| A.7.1-7.14 | Physical Controls | Cloud provider responsibility (shared model) |
| A.8.1 | User Endpoint Devices | Chrome Extension security, desktop app hardening |
| A.8.2-8.5 | Access Control | RBAC, privileged access, authentication |
| A.8.9 | Configuration Management | Container hardening, baseline configs |
| A.8.11 | Data Masking | PII sanitization filter |
| A.8.15 | Logging | Audit trail, structured logging |
| A.8.16 | Monitoring | Rate limiting, anomaly detection |
| A.8.22-8.23 | Network Security | Segmentation, web filtering |
| A.8.24 | Cryptography | TLS, Fernet, bcrypt, key management |
| A.8.25-8.28 | Secure Development | SDLC, input validation, secure coding |

---

## 19. Enforcement & Exceptions

### Enforcement Mechanisms

| Mechanism | Where | What It Checks |
|-----------|-------|---------------|
| Startup validation | `main.py` | Required secrets present, not defaults |
| RBAC middleware | Every request | Permission decorators, role checks |
| Tenant middleware | Every request | JWT-based tenant extraction |
| Rate limit middleware | Every request | Per-IP, per-endpoint limits |
| PIISanitizationFilter | All log output | Email, IP, token masking |
| CI/CD pipeline | Every PR | `npm audit`, `pip audit`, Docker scan |
| Code review | Every PR | Manual review against these rules |
| Nginx | Every request | Security headers, TLS, rate limits, header stripping |

### Exception Process

1. **Request:** Developer documents why rule cannot be followed
2. **Risk Assessment:** Security team evaluates risk and compensating controls
3. **Approval:** Security lead + CTO approval required
4. **Documentation:** Exception logged in `docs/security-exceptions.md` with:
   - Rule ID being excepted
   - Justification
   - Compensating controls
   - Expiration date (max 90 days, renewable)
   - Approver names
5. **Review:** All exceptions reviewed quarterly

### Non-Negotiable Rules (No Exceptions Allowed)

These rules can NEVER be excepted regardless of circumstance:

- `SEC-AUTH-001`: JWT secret must be externally configured
- `SEC-AUTH-002`: JWT signatures must always be verified
- `SEC-AUTHZ-002`: Tenant isolation via JWT
- `SEC-DATA-002`: TLS 1.2+ for external traffic
- `SEC-CONTAINER-003`: No hardcoded credentials
- `SEC-PRIVACY-001`: GDPR right to erasure
- `SEC-INCIDENT-002`: Breach notification requirements

---

## Appendix A: Required Environment Variables (Security)

| Variable | Purpose | Required In |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | JWT signing key (min 32 chars) | Production |
| `ENCRYPTION_KEY` or `SECRETS_ENCRYPTION_KEY` | Fernet encryption key | Production |
| `POSTGRES_PASSWORD` | Database password | Always |
| `MINIO_ROOT_USER` | Object storage username | Always |
| `MINIO_ROOT_PASSWORD` | Object storage password | Always |
| `APP_ENV` | `production` or `development` | Always |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | Production |
| `REDIS_PASSWORD` | Redis authentication | Production |
| `RATE_LIMIT_BACKEND` | `memory` or `redis` | Production (should be `redis`) |
| `REDIS_URL` | Redis connection string | When `RATE_LIMIT_BACKEND=redis` |
| `UPLOAD_MAX_SIZE_MB` | Max upload size (default: 50) | Optional |

## Appendix B: Security Checklist for New Features

Before any new feature is merged, verify:

- [ ] All endpoints have `@require_permission()` decorators
- [ ] User input validated via Pydantic models
- [ ] No SQL injection (parameterized queries, table name whitelist)
- [ ] No command injection (no `shell=True` with user input)
- [ ] No path traversal (validated file paths)
- [ ] No SSRF (URL validation for any backend HTTP requests)
- [ ] Error responses don't leak internal details in production
- [ ] Sensitive data not logged (check for PII in log statements)
- [ ] File uploads validated (type, size, name sanitization)
- [ ] Rate limiting applied for resource-intensive endpoints
- [ ] Tenant isolation maintained (all queries filter by tenant_id)
- [ ] API keys/secrets handled via env vars, not hardcoded
- [ ] Unit tests include negative/security test cases
- [ ] YAML parsing uses `safe_load()` not `load()`

## Appendix C: Compliance Audit Schedule

| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Dependency vulnerability scan | Every CI build | Automated |
| Container image scan | Every CI build | Automated |
| Code security review | Every PR | Engineering |
| Penetration test | Annually | Third-party firm |
| SOC 2 audit | Annually | External auditor |
| HIPAA risk assessment | Annually | Compliance officer |
| Key rotation | Every 90 days | Security team |
| Access review | Quarterly | Security team |
| Security exception review | Quarterly | Security lead + CTO |
| Incident response drill | Semi-annually | All engineering |
| Security awareness training | Annually | All staff |
| Compliance readiness review | Quarterly | Compliance officer |

---

*This document is the authoritative security reference for the Flowstral platform. All development, operations, and compliance activities MUST conform to these rules. Any deviations require the formal exception process defined in Section 19.*
