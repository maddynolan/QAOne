# Security Questionnaire Responses — QAAI / Flowstral Platform

> **Document Classification:** Confidential — Customer-Facing
> **Platform Version:** 3.14.x
> **Last Reviewed:** 2026-03-06
> **Owner:** Security & Compliance Team

This document provides pre-written responses to common enterprise security questionnaire sections for the QAAI/Flowstral QA automation platform. Responses reflect the current state of controls and clearly distinguish between implemented, in-progress, and planned items.

---

## Table of Contents

1. [Data Encryption](#1-data-encryption)
2. [Access Control & Authentication](#2-access-control--authentication)
3. [Audit Logging & Monitoring](#3-audit-logging--monitoring)
4. [Backup & Disaster Recovery](#4-backup--disaster-recovery)
5. [Vulnerability Management](#5-vulnerability-management)
6. [Third-Party Risk](#6-third-party-risk)
7. [Data Residency & Sovereignty](#7-data-residency--sovereignty)
8. [Network Security](#8-network-security)
9. [Incident Response](#9-incident-response)
10. [Compliance Status](#10-compliance-status)

---

## 1. Data Encryption

### Q: Does the platform encrypt data at rest?

**A:** Yes. Data at rest is encrypted across all storage layers:

- **PostgreSQL:** Database volumes are encrypted using LUKS (Linux Unified Key Setup) full-disk encryption on all managed deployments. PostgreSQL Transparent Data Encryption (TDE) is supported for customers requiring column-level encryption on designated sensitive fields. On-prem customers may apply their own disk-encryption policies per organizational standards.
- **Object Storage (MinIO):** MinIO Server-Side Encryption (SSE-S3) is enabled by default. All uploaded artifacts, screenshots, test recordings, and baseline images are encrypted at rest using AES-256. Customers deploying on-prem manage their own encryption keys; SaaS deployments use platform-managed keys.
- **Application-Level Secrets:** All sensitive values stored by the application, including BYOK (Bring Your Own Key) API keys for AI providers, database connection credentials in the secrets vault, and OAuth tokens, are encrypted using Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256 authentication) before persistence. Encryption keys are derived from environment-level secrets and are never stored alongside encrypted data.
- **Redis Cache:** Redis is configured with TLS for in-transit encryption on managed deployments. Cached data is ephemeral and does not contain primary data records. On-prem customers can configure Redis with `requirepass` and TLS per their security policy.

### Q: Does the platform encrypt data in transit?

**A:** Yes. All data in transit is encrypted using TLS 1.2 or higher:

- **Client-to-Server:** All HTTP endpoints are served exclusively over HTTPS. HTTP Strict Transport Security (HSTS) headers are enforced with `max-age=31536000; includeSubDomains` to prevent protocol downgrade attacks. The Chrome Extension enforces HTTPS for all non-localhost backend URLs.
- **Internal Services:** Communication between backend services (FastAPI, PostgreSQL, Redis, MinIO) uses TLS within the container network. Kubernetes deployments enforce mutual TLS (mTLS) via service mesh when deployed with Istio/Linkerd.
- **WebSocket Connections:** Real-time test execution and recording sessions use `wss://` (WebSocket Secure) exclusively in production environments.
- **Cipher Suites:** The nginx reverse proxy is configured with modern cipher suites, disabling SSLv3, TLSv1.0, and TLSv1.1. Preferred ciphers include ECDHE-ECDSA-AES256-GCM-SHA384 and ECDHE-RSA-AES256-GCM-SHA384.

### Q: How are encryption keys managed?

**A:** Encryption keys are managed through a layered approach:

- Application-level Fernet encryption keys are injected via environment variables and are never committed to source control.
- Database encryption keys for LUKS are managed at the infrastructure layer by the hosting provider or customer IT team (on-prem).
- MinIO encryption keys are configured at the storage layer and rotated per the customer's key rotation policy.
- Key rotation procedures are documented, and the platform supports re-encryption of stored secrets upon key rotation.

---

## 2. Access Control & Authentication

### Q: What authentication mechanisms does the platform support?

**A:** The platform implements a multi-layered authentication system:

- **Primary Authentication:** JWT (JSON Web Token) based authentication using the `python-jose` library with RS256 or HS256 signing. Access tokens have a 15-minute expiration; refresh tokens have a 7-day expiration with sliding window renewal.
- **Multi-Factor Authentication (MFA):** TOTP-based MFA (Time-based One-Time Password, RFC 6238) is supported for all user accounts. Administrators can enforce MFA at the organization level. Compatible with standard authenticator applications (Google Authenticator, Authy, Microsoft Authenticator).
- **Single Sign-On (SSO):** OAuth2/OIDC integration is supported for enterprise identity providers. Salesforce OAuth2 is natively integrated for Salesforce-specific testing workflows.
- **Password Policy:** Minimum 12 characters. Passwords are hashed using bcrypt with a cost factor of 12. The platform does not store plaintext passwords at any point in the authentication flow.

### Q: How does the platform implement role-based access control (RBAC)?

**A:** RBAC is enforced at both the frontend and backend layers:

- **Role Hierarchy:** Four roles with strict hierarchy enforcement: Owner > Admin > Member > Viewer. Each role inherits the permissions of roles below it.
  - **Owner:** Full platform administration, billing, organization settings, user management, data deletion.
  - **Admin:** Project management, test case CRUD, execution management, integration configuration, AI settings.
  - **Member:** Test case creation, execution, recording, API testing, reporting.
  - **Viewer:** Read-only access to test results, reports, dashboards.
- **Backend Enforcement:** Decorator-based permission checks on all API endpoints via `@require_permission("resource:action")` middleware. Permissions are validated on every request using the JWT claims.
- **Frontend Enforcement:** `ProtectedRoute` component with `getUserRoleInOrg()` and `hasRequiredRole()` checks. Unauthorized access attempts are redirected to an inline UnauthorizedPage.
- **Multi-Tenancy Isolation:** `TenantContextMiddleware` ensures all database queries are scoped to the authenticated user's organization. Cross-tenant data access is architecturally prevented at the query layer.

### Q: How are sessions managed?

**A:** Session management follows security best practices:

- Access tokens expire after 15 minutes and must be refreshed using a valid refresh token.
- Refresh tokens expire after 7 days and are single-use (rotated on each refresh).
- Tokens are invalidated server-side upon logout, password change, or MFA reset.
- Concurrent session limits can be configured at the organization level.
- Session tokens are transmitted via secure, HttpOnly cookies or Authorization headers, depending on deployment mode.

### Q: How are API keys for AI services handled?

**A:** The platform implements a Bring Your Own Key (BYOK) architecture for AI provider integration:

- API keys are submitted by the organization administrator via a secure endpoint (`POST /api/ai/settings/key`).
- Keys are immediately encrypted using Fernet symmetric encryption and stored in a dedicated `ai_encrypted_keys` table.
- The frontend never stores, caches, or logs API keys. After submission, only a `hasApiKey: boolean` indicator is maintained in client state.
- AI features are disabled by default and require explicit opt-in at the organization level with granular feature-level toggles (20 feature areas).
- A key resolution chain prioritizes organization-specific BYOK keys over platform-level fallback keys.

---

## 3. Audit Logging & Monitoring

### Q: Does the platform maintain an audit trail?

**A:** Yes. The platform maintains a comprehensive, append-only audit trail:

- **Audit Service:** `AuditService` records all significant user and system actions, including authentication events, data modifications, test executions, configuration changes, and administrative operations.
- **Hash Chain Integrity:** Each audit log entry includes a SHA-256 hash computed over the entry content and the hash of the preceding entry, forming a tamper-evident chain. Any modification or deletion of intermediate entries is cryptographically detectable.
- **Storage:** Audit logs are stored in PostgreSQL with an in-memory buffer (10,000 entries) for high-throughput scenarios. The buffer is flushed to persistent storage asynchronously. Customers requiring immutable storage can configure log forwarding to external SIEM systems.
- **Retention:** Audit logs are retained for a configurable period (default: 1 year). Customers can configure retention policies per their compliance requirements.
- **Access:** Audit logs are accessible via the `AuditLogPage` UI (filterable table with CSV export) and programmatically via 4 REST endpoints (`GET/POST /api/audit/logs`, `GET /api/audit/summary`, `GET /api/audit/actions`).

### Q: How does the platform handle PII in logs?

**A:** PII sanitization is enforced across all logging layers:

- **Structured Logging:** All application logs use structured JSON format with consistent field naming. Sensitive fields (passwords, API keys, tokens, SSNs, credit card numbers) are identified by field name patterns and redacted before log emission.
- **Request/Response Logging:** The `TraceLoggingMiddleware` logs request metadata (method, path, status code, duration) without logging request or response bodies. Sensitive headers (Authorization, Cookie, X-API-Key) are masked as `[REDACTED]`.
- **Network Capture Masking:** The Chrome Extension and desktop application mask sensitive headers (Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token) in network captures. Password input fields are masked as `[MASKED]` in recorded actions.
- **Trace Correlation:** Every request is assigned a unique `trace_id` for end-to-end correlation across services without exposing user-identifiable information in trace data.

### Q: What monitoring and alerting capabilities are in place?

**A:** The platform provides comprehensive observability:

- **Metrics:** Prometheus-compatible metrics endpoint exposes application health, request latency percentiles, error rates, active connections, and queue depths. Pre-built Grafana dashboards are provided for operational monitoring.
- **Health Checks:** Dedicated `/health` endpoint returns component-level status (database connectivity, cache availability, storage accessibility) for use by load balancers and container orchestrators.
- **Alerting:** Grafana alerting rules can be configured for SLA thresholds (response time, error rate, availability). Integration with PagerDuty, Slack, email, and webhook notification channels is supported.
- **Log Aggregation:** Application logs are emitted to stdout/stderr in structured JSON format, compatible with centralized log aggregation systems (ELK, Datadog, Splunk, CloudWatch).

---

## 4. Backup & Disaster Recovery

### Q: What backup mechanisms are in place?

**A:** Backup procedures cover all stateful components:

- **PostgreSQL Database:**
  - Write-Ahead Log (WAL) archiving is enabled for continuous backup and point-in-time recovery (PITR).
  - Full base backups are performed on a configurable schedule (default: daily).
  - WAL segments are archived continuously, enabling recovery to any point in time within the retention window.
  - PgBouncer connection pooling (transaction mode, 200 max clients) ensures backup operations do not impact production query performance.
- **Object Storage (MinIO):**
  - Bucket versioning is enabled, allowing recovery of overwritten or deleted objects.
  - Cross-site replication can be configured for geographic redundancy in multi-region deployments.
- **Application Configuration:**
  - Infrastructure-as-code (Helm charts, Docker Compose files, environment templates) is version-controlled in Git.
  - Database migrations (34 versioned SQL migration files) ensure schema reproducibility.

### Q: What are the RPO and RTO targets?

**A:**

| Metric | SaaS Deployment | On-Prem Deployment |
|--------|-----------------|-------------------|
| **Recovery Point Objective (RPO)** | < 5 minutes (continuous WAL archiving) | Configurable by customer (depends on WAL archive frequency) |
| **Recovery Time Objective (RTO)** | < 1 hour (automated failover with container orchestration) | Configurable by customer (depends on infrastructure and runbook execution) |

- SaaS deployments leverage container orchestration (Kubernetes) with automated pod restart and health-check-driven failover.
- On-prem deployments are supported with documented recovery runbooks (see `ON-PREM-DEPLOYMENT-RUNBOOK.md`).
- Disaster recovery procedures are tested on a quarterly cadence (SaaS) or per customer agreement (on-prem).

### Q: How is backup integrity verified?

**A:** Backup integrity is validated through multiple mechanisms:

- PostgreSQL WAL checksums are enabled to detect corruption during archival and restoration.
- Periodic restore tests are performed against backup snapshots to verify data integrity and recovery procedures.
- MinIO object checksums (MD5/SHA-256) are verified on upload and retrieval.
- Backup completion and integrity status is reported via monitoring dashboards.

---

## 5. Vulnerability Management

### Q: How are software dependencies scanned for vulnerabilities?

**A:** Dependency scanning is integrated into the development lifecycle and CI/CD pipeline:

- **Frontend (npm):** `npm audit` is executed as part of the CI pipeline on every pull request and merge to main. Critical and high-severity vulnerabilities block the build. Dependency updates are reviewed and applied on a weekly cadence.
- **Backend (Python):** `pip audit` (or `safety check`) scans Python dependencies against the OSV and PyPI advisory databases. Results are reviewed as part of the CI pipeline.
- **Container Images:** Docker images are scanned using container scanning tools (Trivy/Grype) in the CI/CD pipeline. Base images (Node 20, Python 3.9, nginx:alpine) are updated to the latest patch versions on a monthly cadence.
- **License Compliance:** Dependency licenses are audited to ensure compatibility with the platform's distribution model. GPL-licensed dependencies are avoided in distributed components.

### Q: Is there a CI/CD security pipeline?

**A:** Yes. The CI/CD pipeline (GitHub Actions) includes security gates:

- **Build Stage:** Linting (ESLint, Pylint), type checking (TypeScript), and unit test execution.
- **Security Stage:** Dependency vulnerability scanning (npm audit, pip audit), container image scanning, and SAST (Static Application Security Testing) checks.
- **Deployment Stage:** Automated deployment to staging with smoke tests before production promotion. Production deployments require manual approval for SaaS environments.
- **Secret Management:** CI/CD secrets are stored in GitHub Actions encrypted secrets. No credentials are hardcoded in pipeline definitions.

### Q: What is the penetration testing schedule?

**A:** Penetration testing is conducted on a structured cadence:

- **Automated Scanning:** OWASP ZAP (or equivalent DAST tool) scans are run against staging environments on a monthly basis.
- **Manual Penetration Testing:** Third-party penetration testing is conducted annually by an independent security firm. Results and remediation plans are available to enterprise customers under NDA.
- **Bug Bounty:** A responsible disclosure policy is in place. Security researchers can report vulnerabilities through the documented disclosure process.
- **Remediation SLAs:** Critical vulnerabilities: 24 hours. High: 72 hours. Medium: 30 days. Low: 90 days.

---

## 6. Third-Party Risk

### Q: What third-party cloud services does the platform use?

**A:** The platform uses the following third-party services in its SaaS deployment:

| Provider | Service | Data Processed | Security Posture |
|----------|---------|----------------|-----------------|
| **Supabase** | Authentication, file storage | User credentials (hashed), uploaded files | SOC 2 Type II certified. Data encrypted at rest and in transit. |
| **Railway** | Application hosting (optional) | Application runtime, ephemeral compute | SOC 2 Type II certified. Isolated container execution. |
| **Hetzner** | Infrastructure hosting (recommended) | Full application stack | ISO 27001 certified. EU-based data centers. GDPR compliant. |
| **Vercel** | Frontend CDN (optional) | Static assets only, no user data | SOC 2 Type II certified. Edge caching only. |

**Important:** In on-prem deployments, no third-party cloud services are used. The entire platform runs within the customer's network boundary.

### Q: How are AI provider integrations secured?

**A:** AI provider integrations (OpenAI, Anthropic) are designed with data minimization and customer control:

| Control | Implementation |
|---------|---------------|
| **BYOK (Bring Your Own Key)** | Customers provide their own API keys. Keys are Fernet-encrypted before storage and never exposed to the frontend. |
| **Opt-In Only** | AI features are disabled by default. Administrators explicitly enable AI at the organization level with 20 granular feature toggles. |
| **Data Sent to AI Providers** | Only the specific content required for the AI operation (e.g., test case text for rewriting, element metadata for selector healing). No bulk data export. No PII is sent unless explicitly included in the user's test content. |
| **Provider Selection** | Customers choose their AI provider (OpenAI, Anthropic) and model. No data is sent to providers the customer has not explicitly configured. |
| **Fallback Behavior** | If no AI key is configured, AI endpoints return HTTP 503. The platform remains fully functional without AI features. |

### Q: How is open-source dependency risk managed?

**A:** Open-source dependencies are managed through:

- Dependency pinning in `package.json` (npm) and `requirements.txt` (pip) to prevent supply chain attacks via unpinned transitive dependencies.
- Automated vulnerability scanning in CI/CD (see Section 5).
- License audit to ensure compatibility and avoid copyleft encumbrance in distributed components.
- Minimal dependency policy: the platform avoids unnecessary dependencies and prefers well-maintained, widely-adopted libraries.

---

## 7. Data Residency & Sovereignty

### Q: Does the platform support data residency requirements?

**A:** Yes. The platform offers multiple deployment models to accommodate data residency and sovereignty requirements:

| Deployment Model | Data Location | Customer Control |
|-----------------|---------------|-----------------|
| **On-Premises** | Entirely within customer's data center or private cloud | Full control. No data leaves the customer network. |
| **Dedicated Cloud** | Customer-selected cloud region (AWS, Azure, GCP, Hetzner) | Customer selects region. Data remains in selected geography. |
| **SaaS (Multi-Tenant)** | EU (Hetzner, Germany) by default | Data processed in EU. Customers requiring other regions can request dedicated deployment. |

### Q: In on-prem mode, does any data leave the customer network?

**A:** No. In on-prem deployment mode:

- The entire application stack (frontend, backend, database, cache, object storage) runs within the customer's network.
- No telemetry, analytics, or usage data is transmitted externally.
- AI features, if enabled, require the customer to configure their own AI provider endpoints (including self-hosted models via Ollama/vLLM for fully air-gapped environments).
- License validation can be configured for offline/air-gapped operation using license files rather than online validation.
- The Chrome Extension communicates only with the customer's self-hosted backend instance. Backend URL validation enforces that non-localhost URLs use HTTPS.

### Q: How is data isolation maintained in multi-tenant deployments?

**A:** Multi-tenant data isolation is enforced at the application layer:

- `TenantContextMiddleware` injects the authenticated tenant identifier into every database query context.
- All database queries include a mandatory tenant filter (`organization_id`). Cross-tenant queries are architecturally impossible without middleware bypass.
- Row-Level Security (RLS) policies in PostgreSQL provide an additional database-layer isolation guarantee.
- Object storage paths are namespaced by organization ID, preventing cross-tenant file access.

---

## 8. Network Security

### Q: How are CORS policies configured?

**A:** Cross-Origin Resource Sharing (CORS) is configured restrictively:

- The backend FastAPI application uses explicit origin allowlists. Only the configured frontend origin (e.g., `https://app.flowstral.com`) is permitted.
- Wildcard origins (`*`) are never used in production deployments.
- Credentials (`Access-Control-Allow-Credentials`) are permitted only for the allowlisted origin.
- Preflight (`OPTIONS`) responses are cached for 1 hour to reduce preflight request overhead.

### Q: What rate limiting is in place?

**A:** Rate limiting is enforced by the `RateLimitMiddleware` using a sliding window algorithm:

| Endpoint Category | Rate Limit | Window |
|-------------------|-----------|--------|
| General API | 100 requests | 1 minute |
| Authentication (login, register) | 10 requests | 1 minute |
| AI endpoints | 20 requests | 1 minute |

- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are included in all responses.
- Client identification uses `X-Forwarded-For` when behind a reverse proxy, falling back to the direct client IP.
- Rate-limited requests receive HTTP 429 (Too Many Requests) with a `Retry-After` header.
- Nginx provides an additional rate limiting layer at the reverse proxy level for DDoS mitigation.

### Q: What security headers are configured?

**A:** The nginx reverse proxy enforces OWASP-recommended security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframe embedding |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enables browser XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information leakage |
| `Content-Security-Policy` | Restrictive policy | Mitigates XSS and data injection attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year |
| `Permissions-Policy` | Restrictive | Limits browser feature access (camera, microphone, geolocation) |

- Sensitive paths (`/.env`, `/config`, `/admin`, `/.git`) are blocked at the nginx layer and return HTTP 404.
- Gzip compression is enabled for text-based responses to reduce bandwidth without compromising security.

### Q: How is network segmentation handled in Kubernetes deployments?

**A:** Kubernetes deployments (via the provided Helm chart) support network segmentation:

- Network Policies can be applied to restrict pod-to-pod communication. Only the backend pods can communicate with the database and cache pods.
- Ingress is routed through an Ingress Controller with TLS termination.
- Internal service communication uses ClusterIP services (not exposed externally).
- PgBouncer connection pooling (200 max clients, transaction mode) provides an additional layer between application pods and the database.

---

## 9. Incident Response

### Q: Does the platform have an incident response plan?

**A:** Yes. A documented incident response plan is maintained (see `INCIDENT-RESPONSE-PLAN.md`). The plan covers:

- **Classification:** Incidents are classified by severity (P1: Critical, P2: High, P3: Medium, P4: Low) based on data impact, service availability, and user impact.
- **Detection:** Automated monitoring (Prometheus/Grafana alerts), audit log anomaly detection, and user-reported incidents.
- **Escalation:** Defined escalation paths with on-call rotation. P1 incidents trigger immediate escalation to the security team lead and executive stakeholders.
- **Communication:** Affected customers are notified within 24 hours of confirmed incidents. Status page updates are provided for service-affecting incidents.
- **Post-Incident:** Root cause analysis (RCA) is conducted for all P1 and P2 incidents. Remediation actions are tracked to completion. Lessons learned are incorporated into the security program.

### Q: How does the platform handle GDPR data breach notification?

**A:** GDPR Article 33 compliance is built into the incident response process:

- The supervisory authority is notified within 72 hours of becoming aware of a personal data breach, as required by GDPR Article 33.
- Affected data subjects are notified without undue delay when the breach is likely to result in a high risk to their rights and freedoms (GDPR Article 34).
- Breach notification records include: nature of the breach, categories and approximate number of data subjects affected, likely consequences, and measures taken or proposed to address the breach.
- The Data Protection Officer (DPO) is the primary contact for breach notification coordination.

### Q: How are security vulnerabilities reported?

**A:** The platform maintains multiple channels for vulnerability reporting:

- **Responsible Disclosure:** Security researchers can report vulnerabilities through the documented disclosure process. Acknowledgment is provided within 48 hours.
- **Internal Discovery:** Development team members report potential vulnerabilities through the internal security channel. All reports are triaged within 24 hours.
- **Automated Detection:** CI/CD pipeline security scans (dependency audits, SAST, container scanning) automatically create tracking tickets for discovered vulnerabilities.

---

## 10. Compliance Status

### Q: What is the current SOC 2 Type II status?

**A:** SOC 2 Type II certification is **in progress**:

- **Current State:** Organizational policies, technical controls, and monitoring procedures have been implemented in alignment with SOC 2 Trust Services Criteria (Security, Availability, Confidentiality).
- **Controls Implemented:** Access control (RBAC, MFA), encryption (at rest and in transit), audit logging (hash-chained), change management (CI/CD pipeline), incident response, and vendor management.
- **Timeline:** Audit engagement with an independent CPA firm is planned. The observation period is expected to commence in the current fiscal year.
- **Evidence Available:** Control documentation, policy documents, and technical architecture diagrams are available for customer review under NDA.

### Q: Is the platform HIPAA compliant?

**A:** The platform has **architectural controls in place** to support HIPAA compliance for customers handling Protected Health Information (PHI):

- **Technical Safeguards:** Encryption at rest and in transit, access controls with RBAC, audit logging, automatic session timeout, and unique user identification.
- **Administrative Safeguards:** Workforce training procedures, access authorization policies, and incident response procedures are documented.
- **Physical Safeguards:** In on-prem deployments, physical security is the customer's responsibility. In SaaS deployments, the hosting provider's physical security certifications apply.
- **BAA:** A Business Associate Agreement (BAA) is available for enterprise customers requiring HIPAA compliance.
- **Important:** Customers are responsible for ensuring their use of the platform complies with HIPAA requirements, including not entering PHI in test cases unless appropriate safeguards are in place.

### Q: Does the platform process or store payment card data (PCI-DSS)?

**A:** No. The platform **does not process, store, or transmit payment card data**:

- Payment processing, if applicable, is handled entirely by a PCI-DSS Level 1 certified payment processor (e.g., Stripe).
- No credit card numbers, CVVs, or cardholder data are stored in the platform's database or logs.
- The platform is therefore **out of scope for PCI-DSS compliance**.

### Q: What is the ISO 27001 alignment status?

**A:** ISO 27001 certification is **not currently held**, but the platform's security controls are mapped to ISO 27001 Annex A controls:

- **Control Mapping Available:** A mapping document cross-referencing platform controls to ISO 27001:2022 Annex A control objectives is available for customer review.
- **Key Areas Covered:** Information security policies (A.5), access control (A.9), cryptography (A.10), operations security (A.12), communications security (A.13), supplier relationships (A.15), and incident management (A.16).
- **Formal Certification:** ISO 27001 certification is on the compliance roadmap. Timeline is subject to business prioritization and resource allocation.

### Q: What privacy regulations does the platform address?

**A:** The platform is designed with privacy-by-design principles to support compliance with major privacy regulations:

| Regulation | Status | Key Controls |
|-----------|--------|-------------|
| **GDPR** (EU) | Supported | Data minimization, right to erasure, data portability, breach notification (72h), DPO designation, consent management, on-prem option for data sovereignty |
| **CCPA** (California) | Supported | Right to know, right to delete, right to opt-out, no sale of personal information |
| **PIPEDA** (Canada) | Supported | Consent-based data processing, purpose limitation, data accuracy, safeguards |

- A comprehensive privacy policy is published and accessible at `/privacy`, covering 8 sections including Chrome Extension data handling.
- Data Subject Access Requests (DSARs) are supported through documented procedures.
- Data retention policies are configurable per customer requirements.
- PII sanitization is enforced in all logging and monitoring systems (see Section 3).

---

## Appendix: Document References

| Document | Path | Purpose |
|----------|------|---------|
| Enterprise Security Guide | `docs/ENTERPRISE-SECURITY-GUIDE.md` | Detailed technical security architecture |
| On-Prem Deployment Runbook | `docs/ON-PREM-DEPLOYMENT-RUNBOOK.md` | Air-gapped and on-prem deployment procedures |
| SaaS Deployment Guide | `docs/SAAS-DEPLOYMENT-GUIDE.md` | SaaS deployment architecture and operations |
| Incident Response Plan | `docs/INCIDENT-RESPONSE-PLAN.md` | Incident classification, escalation, and notification |
| Deployment & Data Architecture | `docs/DEPLOYMENT-AND-DATA-ARCHITECTURE.md` | Infrastructure and data flow diagrams |
| Privacy Policy | `src/pages/marketing/PrivacyPage.tsx` | Customer-facing privacy policy (web) |
| Platform Master Document | `docs/PLATFORM_MASTER_DOCUMENT.md` | Complete platform architecture reference |

---

*This document is reviewed and updated quarterly or upon significant changes to the platform's security posture. For questions or to request additional security documentation, contact the Security & Compliance Team.*
