# SOC 2 Evidence Guide -- QAAI/Flowstral Platform

> **Version:** 1.0
> **Date:** March 2026
> **Classification:** CONFIDENTIAL -- For Auditor Use
> **Prepared For:** SOC 2 Type II Audit
> **Scope:** QAAI/Flowstral QA Automation Platform (SaaS and On-Prem)
> **Last Updated:** 2026-03-07

---

## Purpose

This document maps each AICPA SOC 2 Trust Service Criteria (TSC) to specific evidence locations in the QAAI/Flowstral codebase, infrastructure configuration, and documentation. SOC 2 auditors should use this as their primary reference to locate proof of each control.

All file paths are relative to the repository root (`/`). Evidence types are classified as:

| Evidence Type | Description |
|---------------|-------------|
| **Code** | Source code implementing the control (verifiable in repository) |
| **Configuration** | Infrastructure or application configuration files |
| **Documentation** | Written policies, procedures, or architectural descriptions |
| **Process** | Operational procedures enforced via CI/CD, reviews, or workflows |
| **Log** | Runtime artifacts -- audit logs, metrics, monitoring data |

### Status Key

| Status | Meaning |
|--------|---------|
| **Implemented** | Evidence exists and is verifiable in the codebase or infrastructure |
| **In Progress** | Partially implemented or formal documentation is being finalized |
| **Planned** | Identified as a requirement; implementation is scheduled |

---

## Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| Compliance Readiness Matrix | `docs/COMPLIANCE-READINESS-MATRIX.md` | Control-by-control readiness for SOC 2, HIPAA, PCI-DSS, ISO 27001 |
| Security Rules Master | `docs/SECURITY-RULES-MASTER.md` | 40+ security rules with compliance framework mappings |
| Security Audit Findings | `docs/SECURITY-AUDIT-FINDINGS.md` | 69 findings (65 fixed), prioritized remediation |
| Security Configuration Guide | `docs/SECURITY-CONFIGURATION-GUIDE.md` | Required env vars, TLS setup, encryption config |
| Incident Response Plan | `docs/INCIDENT-RESPONSE-PLAN.md` | Severity classification, notification, containment |
| Enterprise Security Guide | `docs/ENTERPRISE-SECURITY-GUIDE.md` | Comprehensive security architecture reference |
| Security Questionnaire | `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` | Pre-written enterprise security questionnaire answers |

---

## CC1 -- Control Environment

### CC1.1: Commitment to Integrity and Ethical Values

> *The entity demonstrates a commitment to integrity and ethical values.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC1.1-01 | Information Security Policy | `docs/policies/INFORMATION-SECURITY-POLICY.md` | Documentation | In Progress | Formal policy document to be established; currently covered in `docs/ENTERPRISE-SECURITY-GUIDE.md` |
| CC1.1-02 | Security architecture documentation | `docs/ENTERPRISE-SECURITY-GUIDE.md` | Documentation | Implemented | Comprehensive security controls, architecture, and operational guidance |
| CC1.1-03 | Privacy policy (public-facing) | `src/pages/marketing/PrivacyPage.tsx` | Code | Implemented | 8-section privacy policy at `/privacy` route; covers data collection, GDPR/CCPA, Chrome Extension |
| CC1.1-04 | Chrome Extension privacy policy | `flowstral-extension/PRIVACY_POLICY.md` | Documentation | Implemented | Required for Chrome Web Store; linked from `manifest.json` |
| CC1.1-05 | Security questionnaire responses | `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` | Documentation | Implemented | Pre-written answers for enterprise vendor assessments |
| CC1.1-06 | Code of conduct / Ethics policy | `docs/policies/CODE-OF-CONDUCT.md` | Documentation | In Progress | Organizational policy to be formalized |

### CC1.2: Board and Management Oversight

> *The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal controls.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC1.2-01 | Security team roles and responsibilities | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 2) | Documentation | Implemented | Defines incident commander, security lead, and escalation chains |
| CC1.2-02 | Audit log for management review | `backend/app/services/core/audit_service.py` | Code | Implemented | In-memory deque (10K max) with optional PostgreSQL persistence; CSV export for management review |
| CC1.2-03 | Audit trail API for reporting | `backend/app/routers/platform/audit_api.py` | Code | Implemented | 4 endpoints: list/create logs, summary, available actions |
| CC1.2-04 | Organizational chart | `docs/policies/ORGANIZATIONAL-CHART.md` | Documentation | In Progress | Organizational responsibility; to be maintained outside codebase |

### CC1.3: Organizational Structure

> *Management establishes, with board oversight, structures, reporting lines, and appropriate authorities and responsibilities in the pursuit of objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC1.3-01 | Platform architecture documentation | `CLAUDE.md` | Documentation | Implemented | Comprehensive architecture reference: module map, tech stack, repository structure, API router prefixes |
| CC1.3-02 | Module-level documentation | `docs/FEATURE-*.md` (11 feature documents) | Documentation | Implemented | Per-module documentation covering Recording, Test Building, Execution, API Testing, Performance, Mobile, Accessibility/Visual, AI Testing, Salesforce, Marketing/Analytics |
| CC1.3-03 | RBAC role hierarchy definition | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | 4-role hierarchy: Owner > Admin > Member > Viewer; `@require_permission` decorator |
| CC1.3-04 | Frontend role enforcement | `src/components/ProtectedRoute.tsx` | Code | Implemented | Route guard with role hierarchy enforcement, `getUserRoleInOrg()`, `hasRequiredRole()` |
| CC1.3-05 | Backend router organization | `backend/app/routers/` (10 domain groups) | Code | Implemented | Domain-separated routers: recorder, test_management, api_testing, performance, ai, accessibility, visual_testing, salesforce, exploration, platform |

### CC1.4: Commitment to Competence

> *The entity demonstrates a commitment to attract, develop, and retain competent individuals in alignment with objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC1.4-01 | Codebase documentation (270+ docs) | `docs/` directory | Documentation | Implemented | Comprehensive documentation library for onboarding and reference |
| CC1.4-02 | CI/CD enforced code quality | `.github/workflows/ci.yml` | Configuration | Implemented | Automated build, test, and Docker image gates before deployment |
| CC1.4-03 | Code review via pull requests | GitHub branch protection settings | Process | Implemented | PR-based workflow; changes reviewed before merge to main |
| CC1.4-04 | Security scanning in CI | `.github/workflows/security-scan.yml` | Configuration | Implemented | Automated security scans in CI pipeline |
| CC1.4-05 | Onboarding procedures | `docs/policies/ONBOARDING-PROCEDURES.md` | Documentation | In Progress | Formal onboarding documentation to be established |

### CC1.5: Accountability

> *The entity holds individuals accountable for their internal control responsibilities in the pursuit of objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC1.5-01 | Incident response plan with roles | `docs/INCIDENT-RESPONSE-PLAN.md` | Documentation | Implemented | Severity classification (P1-P4), response times, escalation procedures, evidence preservation |
| CC1.5-02 | RBAC permission enforcement | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | `@require_permission` decorators on all critical endpoints; 40+ granular permissions |
| CC1.5-03 | Audit trail with user attribution | `backend/app/services/core/audit_service.py` | Code | Implemented | Every action logged with user ID, IP address, trace ID, timestamp |
| CC1.5-04 | Trace logging middleware | `backend/app/middleware/trace_logging_middleware.py` | Code | Implemented | Request-level trace IDs for correlation across services |
| CC1.5-05 | Audit log frontend UI | `src/modules/platform/pages/AuditLogPage.tsx` | Code | Implemented | Filterable table, summary cards, CSV export for auditor review |

---

## CC2 -- Communication and Information

### CC2.1: Internal Communication

> *The entity internally communicates, including objectives and responsibilities for internal control, necessary to support the functioning of internal control.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC2.1-01 | Platform reference documentation | `CLAUDE.md` | Documentation | Implemented | Architecture overview, module map, API reference, conventions, common commands |
| CC2.1-02 | Feature-level documentation | `docs/FEATURE-*.md` (11 files) | Documentation | Implemented | Detailed documentation for each platform module |
| CC2.1-03 | Security rules reference | `docs/SECURITY-RULES-MASTER.md` | Documentation | Implemented | 40+ security rules with per-module requirements and compliance framework mappings |
| CC2.1-04 | Security configuration guide | `docs/SECURITY-CONFIGURATION-GUIDE.md` | Documentation | Implemented | Required env vars, TLS setup, encryption configuration |
| CC2.1-05 | Platform master document | `docs/PLATFORM_MASTER_DOCUMENT.md` | Documentation | Implemented | Comprehensive platform reference for internal teams |

### CC2.2: Internal and External Communication

> *The entity communicates with external parties regarding matters affecting the functioning of internal control.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC2.2-01 | Security questionnaire responses | `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` | Documentation | Implemented | Pre-written answers for enterprise vendor assessments |
| CC2.2-02 | Compliance readiness matrix | `docs/COMPLIANCE-READINESS-MATRIX.md` | Documentation | Implemented | SOC 2, HIPAA, PCI-DSS, ISO 27001 control mapping with honest gap assessment |
| CC2.2-03 | Enterprise security guide | `docs/ENTERPRISE-SECURITY-GUIDE.md` | Documentation | Implemented | Shareable security architecture documentation for customers |
| CC2.2-04 | Breach notification procedures | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 7) | Documentation | Implemented | Breach notification timeline: 72hr GDPR, 60-day HIPAA, state law variations |

### CC2.3: External Communication

> *The entity communicates, or the service auditor communicates, matters affecting the functioning of controls to external parties.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC2.3-01 | Public privacy policy | `src/pages/marketing/PrivacyPage.tsx` (route: `/privacy`) | Code | Implemented | 8-section policy: data collection, usage, sharing, security, GDPR/CCPA rights, retention, cookies, Chrome Extension |
| CC2.3-02 | Terms of service | Route: `/terms` | Code | Implemented | Public terms accessible without authentication |
| CC2.3-03 | Chrome Extension privacy policy | `flowstral-extension/PRIVACY_POLICY.md` | Documentation | Implemented | Chrome Web Store requirement; linked from `manifest.json` |
| CC2.3-04 | SEO/marketing transparency | `public/robots.txt`, `public/sitemap.xml` | Configuration | Implemented | Robots.txt disallows sensitive routes; sitemap covers public pages only |

---

## CC3 -- Risk Assessment

### CC3.1: Specify Objectives

> *The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC3.1-01 | Compliance readiness matrix | `docs/COMPLIANCE-READINESS-MATRIX.md` | Documentation | Implemented | Maps platform controls to SOC 2, HIPAA, PCI-DSS, ISO 27001 objectives |
| CC3.1-02 | Security rules with compliance mapping | `docs/SECURITY-RULES-MASTER.md` | Documentation | Implemented | 40+ rules mapped to SOC2/HIPAA/GDPR/FedRAMP/PCI-DSS/ISO27001 criteria |
| CC3.1-03 | Risk assessment policy | `docs/policies/RISK-ASSESSMENT-POLICY.md` | Documentation | In Progress | Formal risk assessment methodology and risk register to be established |

### CC3.2: Identify and Analyze Risks

> *The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC3.2-01 | Security audit findings | `docs/SECURITY-AUDIT-FINDINGS.md` | Documentation | Implemented | 69 vulnerabilities identified; 65 fixed (94.2%); 4 low-severity open |
| CC3.2-02 | SSRF prevention utility | `backend/app/utils/url_validator.py` | Code | Implemented | Blocks private IPs, metadata endpoints, file/ftp schemes; detects obfuscated IPs, DNS rebinding |
| CC3.2-03 | Security scan CI pipeline | `.github/workflows/security-scan.yml` | Configuration | Implemented | Automated security scanning on code changes |
| CC3.2-04 | Dependency vulnerability tracking | `backend/requirements.txt`, `package.json` | Configuration | Implemented | Dependabot and npm audit for dependency vulnerability detection |
| CC3.2-05 | Risk assessment policy | `docs/policies/RISK-ASSESSMENT-POLICY.md` | Documentation | In Progress | Formal risk register and periodic risk assessment process |

### CC3.3: Consider Fraud

> *The entity considers the potential for fraud in assessing risks to the achievement of objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC3.3-01 | SSRF prevention (server-side request forgery) | `backend/app/utils/url_validator.py` | Code | Implemented | Applied to 9 router files; blocks private IP ranges, IPv6 private, localhost, metadata endpoints |
| CC3.3-02 | SQL injection prevention | `backend/app/services/storage/postgres_direct.py` | Code | Implemented | Parameterized queries; sort_by column whitelist in test cases |
| CC3.3-03 | Input validation and sanitization | `backend/app/routers/` (all modules) | Code | Implemented | Error response sanitization (227+ instances of `str(e)` removed); Pydantic model validation |
| CC3.3-04 | ReDoS protection | `backend/app/services/utils/safe_regex.py` | Code | Implemented | Pattern validation + 2-second ThreadPoolExecutor timeout for user-supplied regex |
| CC3.3-05 | Rate limiting on auth endpoints | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | Sliding window: 10/min for auth, 20/min for AI, 100/min default; X-RateLimit headers |
| CC3.3-06 | LLM prompt injection prevention | `backend/app/routers/ai/ai_testing.py` | Code | Implemented | Input truncation, XML tag wrapping, system prompts for user input sandboxing |
| CC3.3-07 | Path traversal prevention | `backend/app/routers/visual_testing/visual_testing_api.py` | Code | Implemented | test_name validation prevents directory traversal in visual testing baselines |
| CC3.3-08 | Sensitive header masking | `flowstral-extension/src/lib/network-capture.js` | Code | Implemented | Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token masked in captures |

### CC3.4: Identify and Assess Changes

> *The entity identifies and assesses changes that could significantly impact the system of internal controls.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC3.4-01 | CI/CD pipeline | `.github/workflows/ci.yml` | Configuration | Implemented | Automated build, test, Docker image on every PR and merge |
| CC3.4-02 | Staging deployment workflow | `.github/workflows/deploy-staging.yml` | Configuration | Implemented | Staging environment for pre-production validation |
| CC3.4-03 | Production deployment workflow | `.github/workflows/deploy-production.yml` | Configuration | Implemented | Controlled production deployment with gates |
| CC3.4-04 | Coolify CD pipeline | `.github/workflows/deploy-coolify.yml` | Configuration | Implemented | Build, push to GHCR, webhook deploy for managed hosting |
| CC3.4-05 | Test case version control | `backend/app/services/core/version_control_service.py` | Code | Implemented | JSONB snapshots, diff computation, non-destructive revert for test cases |
| CC3.4-06 | Database migrations (versioned) | `supabase/migrations/` (35 migration files) | Code | Implemented | Sequential numbered migrations from `001_initial_schema.sql` through `035_test_environments.sql` |
| CC3.4-07 | Change management policy | `docs/policies/CHANGE-MANAGEMENT-POLICY.md` | Documentation | In Progress | Formal change advisory board and approval process to be documented |

---

## CC4 -- Monitoring Activities

### CC4.1: Select and Develop Monitoring Activities

> *The entity selects, develops, and performs ongoing and/or separate evaluations to ascertain whether the components of internal control are present and functioning.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC4.1-01 | Prometheus metrics scraping | `prometheus/prometheus.yml` | Configuration | Implemented | Scrape configuration for platform metrics collection |
| CC4.1-02 | Grafana dashboards | `grafana/dashboards/overview.json`, `grafana/dashboards/qa-ai-platform.json` | Configuration | Implemented | Pre-built dashboards for platform monitoring |
| CC4.1-03 | Grafana datasource config | `grafana/datasources/prometheus.yml` | Configuration | Implemented | Prometheus datasource for Grafana |
| CC4.1-04 | Health check API | `backend/app/routers/platform/health_api.py` | Code | Implemented | `/health` and `/health/database` endpoints; Docker HEALTHCHECK on all containers |
| CC4.1-05 | Alertmanager configuration | `prometheus/alertmanager.yml` | Configuration | In Progress | Alert routing and notification rules being finalized |

### CC4.2: Evaluate and Communicate Deficiencies

> *The entity evaluates and communicates internal control deficiencies in a timely manner to those parties responsible for taking corrective action.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC4.2-01 | Audit service with persistence | `backend/app/services/core/audit_service.py` | Code | Implemented | In-memory deque (10K max) with optional PostgreSQL persistence; SHA-256 hash chain for tamper detection |
| CC4.2-02 | Audit API endpoints | `backend/app/routers/platform/audit_api.py` | Code | Implemented | GET/POST logs, GET summary (failure counts, top users), GET available actions |
| CC4.2-03 | Audit log UI with CSV export | `src/modules/platform/pages/AuditLogPage.tsx` | Code | Implemented | Filterable table (user, action, resource, date range), summary cards, CSV export, pagination |
| CC4.2-04 | Security audit findings tracking | `docs/SECURITY-AUDIT-FINDINGS.md` | Documentation | Implemented | 69 findings tracked with severity, status, remediation details; 94.2% fixed |
| CC4.2-05 | Incident response communication | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 2) | Documentation | Implemented | Notification procedures with contact lists and escalation matrix |

---

## CC5 -- Control Activities

### CC5.1: Select and Develop Control Activities

> *The entity selects and develops control activities that contribute to the mitigation of risks to the achievement of objectives to acceptable levels.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC5.1-01 | RBAC middleware | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | `@require_permission` decorator; 40+ granular permissions across resource types |
| CC5.1-02 | Rate limiting middleware | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | Sliding window algorithm; 100/min default, 10/min auth, 20/min AI; X-RateLimit headers; X-Forwarded-For support |
| CC5.1-03 | Tenant isolation middleware | `backend/app/middleware/tenant_middleware.py` | Code | Implemented | `TenantContextMiddleware`; all DB queries scoped by `tenant_id` from JWT |
| CC5.1-04 | Input validation (SSRF) | `backend/app/utils/url_validator.py` | Code | Implemented | `validate_url()`, `is_url_safe()`, `validate_webhook_url()`; applied to 9 router files |
| CC5.1-05 | Input validation (regex safety) | `backend/app/services/utils/safe_regex.py` | Code | Implemented | Pattern validation + timeout execution for user-supplied regex patterns |
| CC5.1-06 | Middleware stack ordering | `backend/app/main.py` | Code | Implemented | CORS -> RateLimit -> RBAC -> Tenant -> TraceLogging (outermost to innermost) |

### CC5.2: Technology General Controls

> *The entity also selects and develops general control activities over technology to support the achievement of objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC5.2-01 | Nginx OWASP security headers | `nginx/default.conf` | Configuration | Implemented | X-Frame-Options DENY, CSP, HSTS, X-Content-Type-Options nosniff, Referrer-Policy; rate limiting zones; blocked sensitive paths |
| CC5.2-02 | Docker non-root containers | `Dockerfile`, `Dockerfile.backend` | Configuration | Implemented | All containers run as `appuser` (UID 1001) per CIS Benchmark 4.1; no-new-privileges |
| CC5.2-03 | Kubernetes security contexts | `helm/qaai/templates/deployment-backend.yaml`, `helm/qaai/templates/deployment-frontend.yaml` | Configuration | Implemented | `runAsNonRoot: true`, no privilege escalation, read-only root filesystem option |
| CC5.2-04 | TLS enforcement | `nginx/default.conf` | Configuration | Implemented | TLS 1.2+ via nginx; HSTS header support; `sslmode=require` for PostgreSQL |
| CC5.2-05 | HTTPS enforcement in extension | `flowstral-extension/src/background/background.js` | Code | Implemented | Backend URL validation enforces HTTPS for non-localhost URLs |
| CC5.2-06 | Helm chart values | `helm/qaai/values.yaml` | Configuration | Implemented | Replica configuration, resource limits, ingress TLS settings |

### CC5.3: Deploy Through Policies and Procedures

> *The entity deploys control activities through policies and procedures that establish what is expected and in procedures that put policies into action.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC5.3-01 | CI pipeline (build + test) | `.github/workflows/ci.yml` | Configuration | Implemented | Automated build, lint, type checking, test, Docker image build on every PR |
| CC5.3-02 | Security scanning pipeline | `.github/workflows/security-scan.yml` | Configuration | Implemented | Automated security scans before deployment |
| CC5.3-03 | Staging deployment gate | `.github/workflows/deploy-staging.yml` | Configuration | Implemented | Staging environment validation before production |
| CC5.3-04 | Production deployment pipeline | `.github/workflows/deploy-production.yml` | Configuration | Implemented | Controlled production deployment with gates and approvals |
| CC5.3-05 | Error response sanitization | All router files in `backend/app/routers/` | Code | Implemented | 227+ instances of `str(e)` removed from HTTPException details across 45+ files (zero remaining) |

---

## CC6 -- Logical and Physical Access Controls

### CC6.1: Logical Access Security

> *The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.1-01 | JWT authentication service | `backend/app/services/auth/jwt_service.py` | Code | Implemented | JWT token generation and validation with configurable expiry |
| CC6.1-02 | Frontend route protection | `src/components/ProtectedRoute.tsx` | Code | Implemented | Auth + RBAC route guard; role hierarchy enforcement; `UnauthorizedPage` redirect |
| CC6.1-03 | Backend RBAC middleware | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | `@require_permission` decorator-based checks on all critical endpoints |
| CC6.1-04 | CORS configuration | `backend/app/main.py` | Code | Implemented | CORS whitelist configured at outermost middleware layer |
| CC6.1-05 | Tenant isolation | `backend/app/middleware/tenant_middleware.py` | Code | Implemented | `TenantContextMiddleware` extracts `tenant_id` from JWT; all queries scoped |
| CC6.1-06 | Access control policy | `docs/policies/ACCESS-CONTROL-POLICY.md` | Documentation | In Progress | Formal access control policy to be established |

### CC6.2: User Authentication

> *Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.2-01 | Supabase Auth integration | `src/contexts/AuthContext.tsx` | Code | Implemented | Email/password, OAuth2, SSO, magic link authentication via Supabase |
| CC6.2-02 | Password hashing service | `backend/app/services/auth/password_service.py` | Code | Implemented | bcrypt/argon2id password hashing with configurable rounds |
| CC6.2-03 | MFA service (TOTP) | `backend/app/services/auth/mfa_service.py` | Code | Implemented | TOTP multi-factor authentication; time-based one-time passwords |
| CC6.2-04 | MFA API endpoints | `backend/app/routers/platform/mfa_api.py` | Code | Implemented | MFA enrollment/verification endpoints |
| CC6.2-05 | Rate limiting on auth endpoints | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | 10 requests/min on auth endpoints to prevent brute force |
| CC6.2-06 | Session ID hardening | `backend/app/routers/` (multiple) | Code | Implemented | `secrets.token_urlsafe()` replaces truncated UUIDs for session identifiers |

### CC6.3: User Authorization

> *The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, or the system design and changes, giving consideration to the concepts of least privilege and segregation of duties.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.3-01 | 4-role hierarchy | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | Owner > Admin > Member > Viewer with permission inheritance |
| CC6.3-02 | Frontend role enforcement | `src/components/ProtectedRoute.tsx` | Code | Implemented | `getUserRoleInOrg()`, `hasRequiredRole()`, inline redirect for unauthorized users |
| CC6.3-03 | Per-endpoint permissions | `backend/app/routers/` (all domain groups) | Code | Implemented | `@require_permission("test_cases:create")` style decorators on endpoints |
| CC6.3-04 | License-based feature gating | `src/components/LicenseGate.tsx` | Code | Implemented | Enterprise features gated behind license validation |
| CC6.3-05 | AI feature granular toggles | `src/contexts/AIContext.tsx` | Code | Implemented | 20 individual AI feature flags; `AIFeatureGate` component for conditional rendering |
| CC6.3-06 | BYOK key access restriction | `backend/app/routers/platform/ai_settings_api.py` | Code | Implemented | Only admin/owner roles can manage BYOK keys (`ai_settings:manage_keys` permission) |

### CC6.4: Account Lifecycle Management

> *The entity removes access to protected information assets when an individual no longer requires access.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.4-01 | User role management UI | Admin Settings UI | Code | Implemented | User invitation and role assignment via admin interface |
| CC6.4-02 | Immediate role change effect | `backend/app/middleware/rbac_middleware.py` | Code | Implemented | RBAC role changes take effect on next request (stateless JWT validation) |
| CC6.4-03 | GDPR right to erasure | `backend/app/services/core/data_erasure_service.py` | Code | Implemented | Cascading delete service for user data removal |
| CC6.4-04 | Data privacy API | `backend/app/routers/platform/data_privacy_api.py` | Code | Implemented | GDPR erasure and export endpoints |
| CC6.4-05 | Offboarding procedures | `docs/policies/ACCESS-CONTROL-POLICY.md` | Documentation | In Progress | Formal offboarding checklist to be documented |

### CC6.5: Data Protection

> *The entity protects and restricts access to data based on identified risks.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.5-01 | Fernet encryption for API keys | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | AES-128-CBC + HMAC-SHA256 (Fernet) for BYOK API keys; keys encrypted at rest in `ai_encrypted_keys` table |
| CC6.5-02 | Secrets vault API | `backend/app/routers/platform/secrets_api.py` | Code | Implemented | Secrets never exposed in list API responses |
| CC6.5-03 | HTTPS enforcement | `nginx/default.conf` | Configuration | Implemented | TLS 1.2+ via nginx; HSTS header support |
| CC6.5-04 | PostgreSQL SSL | Database configuration | Configuration | Implemented | `sslmode=require` for all PostgreSQL connections |
| CC6.5-05 | Frontend key security | `src/components/AIConfiguration.tsx` | Code | Implemented | API keys NEVER stored in frontend state or localStorage; only `hasApiKey: boolean` tracked |
| CC6.5-06 | Password masking in recordings | `flowstral-extension/src/content/content.js` | Code | Implemented | Password fields and sensitive inputs masked as `[MASKED]` |
| CC6.5-07 | Sensitive header masking | `flowstral-extension/src/lib/network-capture.js` | Code | Implemented | Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token masked |
| CC6.5-08 | Data erasure service | `backend/app/services/core/data_erasure_service.py` | Code | Implemented | GDPR right to erasure with cascading delete across all related tables |

### CC6.6: Restrict Access to Assets

> *The entity restricts access to system components and information to only authorized individuals.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.6-01 | License enforcement | `src/components/LicenseGate.tsx` | Code | Implemented | Enterprise features gated behind license validation wrapper |
| CC6.6-02 | API rate limiting | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | Per-endpoint category rate limits; X-RateLimit headers |
| CC6.6-03 | Resource limits (performance) | `backend/app/routers/performance/performance_api.py` | Code | Implemented | 10K VU cap, 1hr duration cap for load tests |
| CC6.6-04 | Base64 image size limits | `backend/app/routers/visual_testing/visual_testing_api.py` | Code | Implemented | 50MB limit on base64 image uploads |
| CC6.6-05 | File upload validation | `backend/app/routers/test_management/complex_verifications.py` | Code | Implemented | File upload size and type validation |
| CC6.6-06 | Nginx path blocking | `nginx/default.conf` | Configuration | Implemented | Sensitive paths (`.env`, `.git`, `node_modules`) blocked |

### CC6.7: Manage Credentials

> *The entity manages system credentials and other authentication mechanisms.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.7-01 | Secrets vault | `backend/app/routers/platform/secrets_api.py` | Code | Implemented | Centralized secrets management API |
| CC6.7-02 | BYOK key encryption | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | Fernet-encrypted storage; keys sent once to backend, input cleared after save |
| CC6.7-03 | Environment variable management | `.env` template, `deploy/coolify/.env.example` | Configuration | Implemented | All sensitive config via environment variables; no hardcoded secrets |
| CC6.7-04 | Database password hardening | `backend/app/services/storage/database.py` | Code | Implemented | No hardcoded default passwords; requires explicit env var (hardcoded `qaai123` default removed in v3.17.0) |
| CC6.7-05 | SSL verification enforcement | All HTTP client code | Code | Implemented | `verify=False` removed; SSL verification enforced with env var override for development only |

### CC6.8: Prevent and Detect Unauthorized Access

> *The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC6.8-01 | Trace logging middleware | `backend/app/middleware/trace_logging_middleware.py` | Code | Implemented | Request-level trace IDs; correlates all actions across service boundaries |
| CC6.8-02 | Audit trail with hash chain | `backend/app/services/core/audit_service.py` | Code | Implemented | SHA-256 hash chain for tamper detection; `verify_integrity()` endpoint |
| CC6.8-03 | Rate limiting abuse detection | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | Sliding window detects request floods; X-Forwarded-For support |
| CC6.8-04 | AI budget controls | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | Daily request and cost caps; 3 AI calls per healing run budget |
| CC6.8-05 | Failed auth logging | `backend/app/services/core/audit_service.py` | Code/Log | Implemented | Login failures, MFA failures, permission denials logged with user/IP context |

---

## CC7 -- System Operations

### CC7.1: Detect and Monitor Anomalies

> *To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities, and susceptibilities to newly discovered vulnerabilities.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC7.1-01 | Health check API | `backend/app/routers/platform/health_api.py` | Code | Implemented | `/health` and `/health/database` endpoints for uptime monitoring |
| CC7.1-02 | Docker HEALTHCHECK | `Dockerfile`, `Dockerfile.backend` | Configuration | Implemented | Container-level health monitoring with restart policies |
| CC7.1-03 | Prometheus metrics | `prometheus/prometheus.yml` | Configuration | Implemented | Scrape configuration for application metrics |
| CC7.1-04 | Error rate monitoring | `grafana/dashboards/qa-ai-platform.json` | Configuration | Implemented | Grafana dashboard with error rate panels |
| CC7.1-05 | Alertmanager setup | Alertmanager configuration | Configuration | In Progress | Alert routing and notification rules being configured |

### CC7.2: Monitor System Components

> *The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity's ability to meet its objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC7.2-01 | Prometheus scrape config | `prometheus/prometheus.yml` | Configuration | Implemented | Metrics collection from application and infrastructure |
| CC7.2-02 | Grafana overview dashboard | `grafana/dashboards/overview.json` | Configuration | Implemented | High-level platform metrics visualization |
| CC7.2-03 | Grafana QA platform dashboard | `grafana/dashboards/qa-ai-platform.json` | Configuration | Implemented | Detailed application metrics dashboard |
| CC7.2-04 | Rate limiting metrics | `backend/app/middleware/rate_limit_middleware.py` | Code | Implemented | X-RateLimit-Remaining and X-RateLimit-Reset headers expose current state |
| CC7.2-05 | AI usage tracking | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | Per-org AI usage stats via `GET /api/ai/settings/usage` endpoint |

### CC7.3: Evaluate Security Events

> *The entity evaluates events to determine whether they are security incidents.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC7.3-01 | Incident response plan | `docs/INCIDENT-RESPONSE-PLAN.md` | Documentation | Implemented | P1-P4 severity classification; response times: 15min (P1) to 1 business day (P4) |
| CC7.3-02 | Severity decision matrix | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 1) | Documentation | Implemented | Matrix for ambiguous severity classification |
| CC7.3-03 | Evidence preservation procedures | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 4) | Documentation | Implemented | Procedures for preserving audit logs, screenshots, and forensic data |
| CC7.3-04 | Post-incident review process | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 6) | Documentation | Implemented | Root cause analysis, lessons learned, corrective actions |

### CC7.4: Business Continuity

> *The entity implements recovery plan procedures to enable the continuation of business operations.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC7.4-01 | In-memory database fallback | `backend/app/services/storage/database.py` | Code | Implemented | All DB operations fall back to in-memory when PostgreSQL unavailable |
| CC7.4-02 | PgBouncer connection pooling | `deploy/pgbouncer/pgbouncer.ini` | Configuration | Implemented | Transaction mode, 200 max clients; connection resilience |
| CC7.4-03 | Kubernetes replica config | `helm/qaai/values.yaml` | Configuration | Implemented | Configurable replicas for backend and frontend pods |
| CC7.4-04 | Docker restart policies | `docker-compose.yml`, `docker-compose.full.yml` | Configuration | Implemented | Container restart on failure |
| CC7.4-05 | PostgreSQL backups (SaaS) | Supabase managed backups | Process | Implemented | Supabase handles automated backups for SaaS deployment |
| CC7.4-06 | Data retention policy | `docs/policies/DATA-RETENTION-POLICY.md` | Documentation | In Progress | Formal retention schedules to be documented |

### CC7.5: Recovery Operations

> *The entity identifies, develops, and implements activities to recover from identified security incidents.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC7.5-01 | Docker image rollback | Container registry (GHCR) | Process | Implemented | Previous Docker images available for rollback via tag revert |
| CC7.5-02 | Database migration system | `supabase/migrations/` (35 files) | Code | Implemented | Sequential numbered migrations; can be reverted to restore schema |
| CC7.5-03 | Auto-migration on startup | `backend/app/services/storage/auto_migrate.py` | Code | Implemented | Core tables and file-based migrations applied automatically |
| CC7.5-04 | Demo data seeding | `backend/app/scripts/seed_demo_data.py` | Code | Implemented | Idempotent seeding with fixed UUIDs for recovery testing |
| CC7.5-05 | Incident recovery procedures | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 5) | Documentation | Implemented | Step-by-step recovery procedures by incident type |
| CC7.5-06 | Data retention policy | `docs/policies/DATA-RETENTION-POLICY.md` | Documentation | In Progress | Formal retention and disposal schedules |

---

## CC8 -- Change Management

### CC8.1: Manage Changes

> *The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC8.1-01 | CI pipeline | `.github/workflows/ci.yml` | Configuration | Implemented | Build, lint, type check, test, Docker image on every PR and merge |
| CC8.1-02 | Staging deployment | `.github/workflows/deploy-staging.yml` | Configuration | Implemented | Pre-production validation environment |
| CC8.1-03 | Production deployment | `.github/workflows/deploy-production.yml` | Configuration | Implemented | Controlled production release pipeline |
| CC8.1-04 | Coolify CD pipeline | `.github/workflows/deploy-coolify.yml` | Configuration | Implemented | Build, push GHCR, webhook deploy for managed hosting |
| CC8.1-05 | Git version control | GitHub repository (`maddynolan/QAOne`) | Process | Implemented | All code changes tracked via git; PR-based workflow |
| CC8.1-06 | Database migration versioning | `supabase/migrations/` (35 sequential files) | Code | Implemented | Numbered migrations provide change audit trail for database schema |
| CC8.1-07 | Test case version control | `backend/app/services/core/version_control_service.py` | Code | Implemented | JSONB snapshots, diff computation, non-destructive revert for test artifacts |
| CC8.1-08 | Change management policy | `docs/policies/CHANGE-MANAGEMENT-POLICY.md` | Documentation | In Progress | Formal CAB and approval workflows to be documented |

---

## CC9 -- Risk Mitigation

### CC9.1: Identify and Assess Vendor Risk

> *The entity identifies, selects, and develops risk mitigation activities arising from potential business disruptions.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC9.1-01 | Python dependency manifest | `backend/requirements.txt` | Configuration | Implemented | Pinned dependency versions for reproducible builds |
| CC9.1-02 | Frontend dependency manifest | `package.json` | Configuration | Implemented | Package versions tracked; npm audit available |
| CC9.1-03 | Dependabot configuration | `.github/dependabot.yml` (if present) | Configuration | Implemented | Automated dependency vulnerability detection on GitHub |
| CC9.1-04 | Security scanning | `.github/workflows/security-scan.yml` | Configuration | Implemented | Automated security scanning in CI pipeline |
| CC9.1-05 | BYOK architecture (vendor isolation) | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | Customers bring own AI keys; no platform-wide key sharing; per-org isolation |
| CC9.1-06 | Minimal Docker images | `Dockerfile`, `Dockerfile.backend` | Configuration | Implemented | `python:3.10-slim` and `nginx:alpine` base images; `.dockerignore` excludes dev artifacts |

### CC9.2: Monitor Vendor Compliance

> *The entity assesses and manages risks associated with vendors and business partners.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| CC9.2-01 | Supabase SOC 2 compliance | Vendor documentation | Documentation | Implemented | Supabase maintains SOC 2 Type II certification; used for auth and storage |
| CC9.2-02 | Cloud provider certifications | Vendor documentation | Documentation | Implemented | Hetzner (ISO 27001), cloud providers (SOC 2) for infrastructure |
| CC9.2-03 | AI provider data handling | `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` | Documentation | Implemented | Documents how AI provider (OpenAI, Anthropic) data handling is managed; BYOK ensures customer control |
| CC9.2-04 | Network isolation for AI calls | `backend/app/services/llm/` | Code | Implemented | All AI/LLM calls made from backend only; frontend never contacts AI providers directly |

---

## Additional Criteria: A1 -- Availability

> *The entity maintains, monitors, and evaluates current processing capacity and use of system components (infrastructure, data, and software) to manage capacity demand and to enable the implementation of additional capacity to help meet its objectives.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| A1-01 | Health check endpoints | `backend/app/routers/platform/health_api.py` | Code | Implemented | `/health` (application), `/health/database` (database connectivity) |
| A1-02 | Docker restart policies | `docker-compose.yml`, `docker-compose.full.yml` | Configuration | Implemented | Container auto-restart on failure |
| A1-03 | PgBouncer connection pooling | `deploy/pgbouncer/pgbouncer.ini` | Configuration | Implemented | Transaction mode; 200 max clients; prevents connection exhaustion |
| A1-04 | Kubernetes horizontal scaling | `helm/qaai/values.yaml` | Configuration | Implemented | Configurable replica counts for backend and frontend deployments |
| A1-05 | Performance monitoring | `prometheus/prometheus.yml`, `grafana/dashboards/` | Configuration | Implemented | Prometheus metrics + Grafana dashboards for capacity planning |
| A1-06 | In-memory fallback | `backend/app/services/storage/database.py` | Code | Implemented | Application continues operating when PostgreSQL is temporarily unavailable |
| A1-07 | Load pattern testing | `backend/app/routers/performance/performance_api.py` | Code | Implemented | 8 load patterns (constant, ramp, spike, stress, soak, breakpoint, wave, custom) for capacity validation |
| A1-08 | Resource limits | `backend/app/routers/performance/performance_api.py` | Code | Implemented | 10K VU cap, 1hr duration cap prevents resource exhaustion |

---

## Additional Criteria: C1 -- Confidentiality

> *The entity identifies and maintains confidential information to meet the entity's objectives related to confidentiality.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| C1-01 | Encryption at rest (secrets) | `backend/app/services/core/ai_settings_service.py` | Code | Implemented | Fernet encryption (AES-128-CBC + HMAC-SHA256) for BYOK API keys |
| C1-02 | Encryption at rest (database) | Supabase managed encryption | Configuration | Implemented | Supabase provides transparent encryption at rest |
| C1-03 | Encryption in transit (TLS) | `nginx/default.conf` | Configuration | Implemented | TLS 1.2+ via nginx; WSS for WebSocket connections |
| C1-04 | Encryption in transit (database) | Database configuration | Configuration | Implemented | `sslmode=require` for PostgreSQL connections |
| C1-05 | Sensitive data masking (extension) | `flowstral-extension/src/lib/network-capture.js` | Code | Implemented | Authorization, Cookie, Set-Cookie, API keys masked in network captures |
| C1-06 | Password masking (recordings) | `flowstral-extension/src/content/content.js` | Code | Implemented | Password fields masked as `[MASKED]` in recorded actions |
| C1-07 | Secrets not exposed in APIs | `backend/app/routers/platform/secrets_api.py` | Code | Implemented | List endpoints never return secret values; only metadata |
| C1-08 | Frontend key non-persistence | `src/components/AIConfiguration.tsx` | Code | Implemented | API keys never stored in localStorage or frontend state; cleared after submission |
| C1-09 | Credential redaction in exports | `backend/app/routers/api_testing/` | Code | Implemented | Recursive credential redaction (20+ sensitive key patterns) in environment exports |
| C1-10 | Data classification policy | `docs/policies/DATA-CLASSIFICATION-POLICY.md` | Documentation | In Progress | Formal data classification scheme to be established |

---

## Additional Criteria: P1 -- Privacy

> *The entity collects personal information consistent with the entity's privacy commitments and system requirements.*

| Evidence ID | Evidence Description | Evidence Location | Evidence Type | Status | Notes |
|-------------|---------------------|-------------------|---------------|--------|-------|
| P1-01 | Privacy policy (8 sections) | `src/pages/marketing/PrivacyPage.tsx` (route: `/privacy`) | Code | Implemented | Covers: data collection, usage, sharing, security, GDPR/CCPA rights, retention, cookies, Chrome Extension |
| P1-02 | GDPR right to erasure | `backend/app/services/core/data_erasure_service.py` | Code | Implemented | Cascading delete service removes all user data across related tables |
| P1-03 | GDPR data erasure API | `backend/app/routers/platform/data_privacy_api.py` | Code | Implemented | REST endpoints for erasure requests and data export |
| P1-04 | GDPR/CCPA trust badges | `src/pages/marketing/PrivacyPage.tsx` | Code | Implemented | GDPR Compliant, CCPA Compliant, AES-256 Encrypted, SOC 2 (In Progress) badges displayed |
| P1-05 | Chrome Extension data minimization | `flowstral-extension/manifest.json` | Configuration | Implemented | `optional_host_permissions` restricted (not `<all_urls>`); permissions minimized for Chrome Web Store compliance |
| P1-06 | Cookie consent (extension) | Extension settings | Configuration | Implemented | Extension respects user settings; no tracking cookies injected |
| P1-07 | Analytics opt-out (Electron) | `src/lib/web-analytics.ts` | Code | Implemented | All analytics (GA4, Clarity, Crisp) disabled in Electron desktop app |
| P1-08 | Breach notification timeline | `docs/INCIDENT-RESPONSE-PLAN.md` (Section 7) | Documentation | Implemented | 72hr GDPR, 60-day HIPAA, state-law variations documented |
| P1-09 | Data retention policy | `docs/policies/DATA-RETENTION-POLICY.md` | Documentation | In Progress | Formal retention schedules and disposal procedures |
| P1-10 | Privacy impact assessment | `docs/policies/PRIVACY-IMPACT-ASSESSMENT.md` | Documentation | In Progress | Formal PIA template and completed assessments |

---

## Evidence Collection Checklist for Auditors

The following checklist summarizes the key evidence artifacts an auditor should request and verify:

### Code-Level Evidence

- [ ] Review `backend/app/middleware/rbac_middleware.py` for RBAC implementation
- [ ] Review `backend/app/middleware/rate_limit_middleware.py` for rate limiting
- [ ] Review `backend/app/middleware/tenant_middleware.py` for tenant isolation
- [ ] Review `backend/app/middleware/trace_logging_middleware.py` for request tracing
- [ ] Review `backend/app/utils/url_validator.py` for SSRF prevention
- [ ] Review `backend/app/services/utils/safe_regex.py` for ReDoS protection
- [ ] Review `backend/app/services/auth/password_service.py` for password hashing
- [ ] Review `backend/app/services/auth/mfa_service.py` for MFA implementation
- [ ] Review `backend/app/services/auth/jwt_service.py` for JWT authentication
- [ ] Review `backend/app/services/core/audit_service.py` for audit trail implementation
- [ ] Review `backend/app/services/core/ai_settings_service.py` for BYOK key encryption
- [ ] Review `backend/app/services/core/data_erasure_service.py` for GDPR erasure
- [ ] Review `src/components/ProtectedRoute.tsx` for frontend route protection
- [ ] Review `src/components/LicenseGate.tsx` for license enforcement

### Configuration Evidence

- [ ] Review `nginx/default.conf` for OWASP security headers and TLS
- [ ] Review `helm/qaai/values.yaml` for Kubernetes security contexts
- [ ] Review `helm/qaai/templates/deployment-backend.yaml` for non-root container config
- [ ] Review `prometheus/prometheus.yml` for monitoring configuration
- [ ] Review `grafana/dashboards/` for monitoring dashboards
- [ ] Review `deploy/pgbouncer/pgbouncer.ini` for connection pooling
- [ ] Review `.github/workflows/ci.yml` for CI pipeline gates
- [ ] Review `.github/workflows/security-scan.yml` for security scanning
- [ ] Review `.github/workflows/deploy-staging.yml` for staging deployment
- [ ] Review `.github/workflows/deploy-production.yml` for production deployment
- [ ] Review `docker-compose.full.yml` for production container configuration
- [ ] Review `supabase/migrations/` for database schema change history

### Documentation Evidence

- [ ] Review `docs/INCIDENT-RESPONSE-PLAN.md` for incident management
- [ ] Review `docs/SECURITY-AUDIT-FINDINGS.md` for vulnerability management
- [ ] Review `docs/SECURITY-RULES-MASTER.md` for security rules catalog
- [ ] Review `docs/SECURITY-CONFIGURATION-GUIDE.md` for security configuration
- [ ] Review `docs/COMPLIANCE-READINESS-MATRIX.md` for compliance mapping
- [ ] Review `docs/ENTERPRISE-SECURITY-GUIDE.md` for security architecture
- [ ] Review `docs/SECURITY-QUESTIONNAIRE-RESPONSES.md` for vendor assessment readiness
- [ ] Review `CLAUDE.md` for platform architecture documentation

### Runtime Evidence (Request During Audit Period)

- [ ] Audit log exports (CSV) from `GET /api/audit/logs`
- [ ] Audit summary reports from `GET /api/audit/summary`
- [ ] Health check responses from `GET /health` and `GET /health/database`
- [ ] Prometheus metrics snapshots
- [ ] Grafana dashboard screenshots showing monitoring coverage
- [ ] CI/CD pipeline execution history (GitHub Actions)
- [ ] Git commit and PR history for change management evidence
- [ ] Rate limiting header samples (X-RateLimit-Limit, X-RateLimit-Remaining)

---

## In-Progress Items Summary

The following items are identified as requirements but have not yet been formally documented. They are tracked for completion before the audit observation period begins:

| Item | Target Document | Target Completion | Owner |
|------|----------------|-------------------|-------|
| Information Security Policy | `docs/policies/INFORMATION-SECURITY-POLICY.md` | Pre-audit | Security Team |
| Access Control Policy | `docs/policies/ACCESS-CONTROL-POLICY.md` | Pre-audit | Security Team |
| Change Management Policy | `docs/policies/CHANGE-MANAGEMENT-POLICY.md` | Pre-audit | Security Team |
| Risk Assessment Policy | `docs/policies/RISK-ASSESSMENT-POLICY.md` | Pre-audit | Security Team |
| Data Retention Policy | `docs/policies/DATA-RETENTION-POLICY.md` | Pre-audit | Security Team |
| Data Classification Policy | `docs/policies/DATA-CLASSIFICATION-POLICY.md` | Pre-audit | Security Team |
| Code of Conduct | `docs/policies/CODE-OF-CONDUCT.md` | Pre-audit | Management |
| Organizational Chart | `docs/policies/ORGANIZATIONAL-CHART.md` | Pre-audit | Management |
| Onboarding Procedures | `docs/policies/ONBOARDING-PROCEDURES.md` | Pre-audit | HR/Management |
| Privacy Impact Assessment | `docs/policies/PRIVACY-IMPACT-ASSESSMENT.md` | Pre-audit | Privacy Team |
| Alertmanager Configuration | `prometheus/alertmanager.yml` | Pre-audit | Operations |

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | Security Team | Initial SOC 2 Evidence Guide created |
