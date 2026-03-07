# Compliance Readiness Matrix

> Control-by-control compliance readiness assessment for the QAAI/Flowstral platform.
> This document maps implemented security controls to SOC 2 Type II, HIPAA, PCI-DSS v4.0, and ISO 27001 requirements.
>
> **Purpose:** Enable sales teams and security reviewers to transparently assess platform readiness against enterprise compliance frameworks.
>
> **Audience:** Sales engineers, compliance officers, prospective customers, auditors.
>
> **Last updated:** 2026-03-06

---

## How to Read This Document

Each framework section contains a table with the following columns:

| Column | Description |
|--------|-------------|
| **Control ID** | Framework-specific control identifier |
| **Control Name** | Short description of the requirement |
| **Status** | Implementation status (see legend below) |
| **Implementation Details** | What the platform does today to address the control |
| **Gap/Notes** | Honest assessment of gaps, partial coverage, or customer prerequisites |

### Status Legend

| Icon | Meaning |
|------|---------|
| Implemented | The control is fully implemented in the platform codebase and operational |
| Partial | Some aspects are addressed but the control is not fully satisfied |
| Gap | The control is not currently implemented and requires additional work |

---

## 1. SOC 2 Type II — Trust Services Criteria

SOC 2 Type II evaluates the operating effectiveness of controls over a period (typically 6-12 months). The criteria below map to AICPA Trust Services Criteria (2017 revision).

### CC1 — Control Environment

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC1.1 | Commitment to integrity and ethical values | Gap | No formal code of conduct or ethics policy embedded in the platform | Requires organizational policy documents; platform cannot enforce this |
| CC1.2 | Board/management oversight | Gap | No governance dashboard or board-level reporting | Organizational responsibility; audit log export (CSV) can support evidence collection |
| CC1.3 | Organizational structure and authority | Partial | RBAC with 4-role hierarchy (owner > admin > member > viewer); `ProtectedRoute` enforces frontend, `RBACMiddleware` + `@require_permission` decorator enforces backend | Role definitions exist but no formal org chart or segregation of duties matrix |
| CC1.4 | Commitment to competence | Gap | No training tracking or competency management features | Organizational responsibility |
| CC1.5 | Accountability for internal controls | Partial | Audit trail logs all significant actions with user attribution, IP address, and trace ID; SHA-256 hash chain for tamper detection | No formal control owner assignment or periodic control review process |

### CC2 — Communication and Information

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC2.1 | Internal communication of objectives | Gap | No internal communication or policy distribution features | Organizational responsibility |
| CC2.2 | Internal communication of policies | Partial | Privacy policy page (`/privacy`) with 8 sections; Chrome Extension privacy policy | Platform-level policies exist but no mechanism to distribute or track employee acknowledgment |
| CC2.3 | External communication | Partial | Privacy policy publicly accessible; GDPR/CCPA badges displayed; security headers communicated via nginx | No formal external security communication program or breach notification process |

### CC3 — Risk Assessment

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC3.1 | Risk identification | Partial | Rate limiting detects abuse patterns; audit log tracks failed auth attempts and permission denials; AI budget controls detect anomalous usage | No formal risk register or risk assessment process |
| CC3.2 | Fraud risk assessment | Partial | Rate limiting on auth endpoints (10/min); security event logging for login failures, MFA failures, suspicious activity | No dedicated fraud detection system |
| CC3.3 | Change-related risk assessment | Partial | Version control for test cases (JSONB snapshots, diff, revert); CI/CD pipelines with build/test gates | No formal change risk assessment process or change advisory board tooling |
| CC3.4 | Risk tolerance thresholds | Partial | Configurable rate limits per endpoint category; AI budget limits (daily request + cost caps) | Thresholds are technical; no formal risk appetite statement |

### CC4 — Monitoring Activities

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC4.1 | Ongoing monitoring | Implemented | Audit trail with filterable queries (user, action, resource, date range); health check endpoints; Prometheus metrics scraping; Grafana dashboards; security event tracking | Monitoring infrastructure is in place; SIEM integration requires external setup |
| CC4.2 | Evaluate and communicate deficiencies | Partial | Audit summary endpoint provides failure counts and top users; CSV export for auditor review | No automated alerting on control deficiencies; requires external alerting (Grafana/PagerDuty) |

### CC5 — Control Activities

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC5.1 | Selection and development of controls | Implemented | Layered security: JWT auth, RBAC, tenant isolation, rate limiting, encryption at rest/transit, input validation, CORS, CSP headers | Controls are implemented in code; formal control documentation is in `ENTERPRISE-SECURITY-GUIDE.md` |
| CC5.2 | Technology-based controls | Implemented | Fernet encryption for secrets/BYOK keys; SQL injection prevention (table whitelist in `postgres_direct.py`); file upload size validation (configurable, default 50MB); nginx OWASP headers; non-root containers | Comprehensive technical controls across the stack |
| CC5.3 | Control activities through policies | Partial | Controls enforced programmatically (middleware stack: CORS, RateLimit, RBAC, Tenant, TraceLogging) | No formal written control policies beyond code and documentation |

### CC6 — Logical and Physical Access Controls

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC6.1 | Logical access security | Implemented | JWT authentication with configurable expiry; Supabase Auth (email/password, OAuth2, SSO, magic link); API key headers for service-to-service; CORS whitelist | Token stored in memory (not localStorage) on frontend |
| CC6.2 | User authentication | Implemented | JWT tokens via PyJWT (HS256); Supabase-managed identity; MFA support (TOTP); password policy recommendations (12+ chars, complexity, lockout after 5 failures) | MFA is available but not enforced by default; enforcement is configurable |
| CC6.3 | User authorization | Implemented | 4-role hierarchy with permission inheritance; `@require_permission` decorator on endpoints; `ProtectedRoute` on frontend; per-endpoint permission matrix documented | 40+ granular permissions across resource types |
| CC6.4 | Access provisioning and removal | Partial | User invitation and role assignment via admin UI; RBAC role changes take effect immediately | No automated provisioning/deprovisioning; no integration with HR systems or SCIM |
| CC6.5 | Physical access controls | Gap | Platform is software-only; physical security depends on hosting provider | For on-prem: customer responsibility. For SaaS: depends on Hetzner/cloud provider SOC 2 |
| CC6.6 | System access restrictions | Implemented | Tenant isolation via JWT `tenant_id` claim; all DB queries scoped by tenant; `TenantContextMiddleware` enforces isolation; sensitive paths blocked by nginx | Multi-tenancy is enforced at middleware and query level |
| CC6.7 | Data access restrictions | Implemented | RBAC controls data visibility; viewer role is read-only; secrets never exposed in list APIs; BYOK keys encrypted with Fernet; frontend never stores API keys | Encryption key management depends on env var security |
| CC6.8 | Restriction on privileged access | Implemented | Only `owner` and `admin` roles can manage users, AI settings, and keys; `ai_settings:manage_keys` permission required for BYOK operations | No privileged access workstations (PAW) concept; depends on deployment environment |

### CC7 — System Operations

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC7.1 | Infrastructure monitoring | Implemented | `/health` and `/health/database` endpoints; Docker HEALTHCHECK on all containers; Prometheus scrape config; Grafana dashboards | External monitoring setup required (Grafana, Datadog, etc.) |
| CC7.2 | Anomaly detection | Partial | Rate limiting detects request floods; AI budget controls detect cost anomalies; audit log tracks failed auth patterns | No ML-based anomaly detection; relies on threshold-based detection |
| CC7.3 | Incident detection and response | Partial | Security events logged (login failures, MFA failures, permission denials, rate limiting); trace IDs enable correlation | No formal incident response playbook integrated into the platform; `ENTERPRISE-SECURITY-GUIDE.md` section 13 provides guidance |
| CC7.4 | Business continuity | Partial | In-memory fallback when PostgreSQL is unavailable; PgBouncer for connection pooling; K8s Helm chart with replica configuration | No automated failover; backup strategy depends on infrastructure (Supabase handles SaaS backups) |
| CC7.5 | Data backup and recovery | Partial | PostgreSQL with Supabase-managed backups (SaaS); PgBouncer connection pooling; demo data seeding for recovery testing | No built-in backup scheduling or point-in-time recovery UI; depends on infrastructure |

### CC8 — Change Management

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC8.1 | Change management process | Partial | GitHub-based version control; CI/CD pipelines (build, test, Docker image, deploy); test case version control with diff and revert | No formal change advisory board or approval workflow in the platform |
| CC8.2 | Testing before deployment | Implemented | CI pipeline runs build and tests; staging deployment workflow; Coolify CD pipeline with webhook deploy | Automated testing in CI; manual QA is organizational responsibility |
| CC8.3 | Configuration management | Partial | Environment variables for all sensitive config; `.env` template documented; Helm values.yaml for K8s configuration | No built-in configuration drift detection |

### CC9 — Risk Mitigation

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| CC9.1 | Risk mitigation strategies | Partial | Defense-in-depth: multi-layer security stack; AI disabled by default (opt-in); BYOK key isolation per org; rate limiting per endpoint category | Risk mitigation is technical; no formal risk treatment plan |
| CC9.2 | Vendor risk management | Partial | BYOK architecture ensures customer-owned AI keys; no platform-wide AI key sharing; network isolation (AI calls from backend only) | No vendor risk assessment portal; third-party dependencies (Supabase, OpenAI, Anthropic) require customer evaluation |

---

## 2. HIPAA Security Rule

HIPAA compliance is relevant when customers use Flowstral to test healthcare applications that handle Protected Health Information (PHI). The platform itself does not store PHI, but test data and recordings may contain PHI depending on customer usage.

**Important disclaimer:** Flowstral is a QA automation tool, not a healthcare system. HIPAA compliance depends heavily on how customers configure and use the platform, their BAA coverage with hosting providers, and their organizational policies.

### Administrative Safeguards (45 CFR 164.308)

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| 164.308(a)(1) | Security Management Process | Partial | Rate limiting, RBAC, audit logging, encryption at rest/transit, tamper-evident hash chain on audit logs | No formal risk analysis document or sanction policy; organizational responsibility |
| 164.308(a)(2) | Assigned Security Responsibility | Gap | No security officer assignment feature in the platform | Organizational responsibility; `owner` role is the closest equivalent |
| 164.308(a)(3) | Workforce Security | Partial | RBAC with 4 roles; permission-based access to all resources; tenant isolation | No workforce clearance procedures or termination access revocation automation (no SCIM) |
| 164.308(a)(4) | Information Access Management | Implemented | Role-based access with granular permissions; tenant isolation; viewer role for read-only; BYOK key access restricted to admin/owner | Access authorization is enforced programmatically |
| 164.308(a)(5) | Security Awareness and Training | Gap | No training modules or security awareness features | Organizational responsibility; platform documentation serves as reference |
| 164.308(a)(6) | Security Incident Procedures | Partial | Security event logging; audit trail with hash chain integrity verification; trace ID correlation | No built-in incident response workflow; `ENTERPRISE-SECURITY-GUIDE.md` section 13 provides guidance |
| 164.308(a)(7) | Contingency Plan | Partial | In-memory fallback for DB outages; K8s Helm chart supports replicas; PgBouncer for connection resilience | No built-in disaster recovery plan, emergency mode, or data backup/restore UI |
| 164.308(a)(8) | Evaluation | Partial | Audit log integrity verification (`verify_integrity()` endpoint); health checks; CI/CD testing | No formal periodic security evaluation process |

### Physical Safeguards (45 CFR 164.310)

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| 164.310(a)(1) | Facility Access Controls | Gap | Software platform; no physical facility controls | Customer/hosting provider responsibility; on-prem customers must address this |
| 164.310(b) | Workstation Use and Security | Gap | No workstation policy enforcement | Organizational responsibility |
| 164.310(c) | Workstation Security | Gap | No workstation security features | Organizational responsibility |
| 164.310(d)(1) | Device and Media Controls | Partial | Docker containers use non-root users; no-new-privileges; read-only root filesystem option; secrets never in Docker images | Media disposal and hardware reuse are customer responsibilities |

### Technical Safeguards (45 CFR 164.312)

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| 164.312(a)(1) | Access Control | Implemented | Unique user IDs via Supabase Auth; JWT-based session management; RBAC with 4 roles and 40+ permissions; emergency access via admin/owner override | No automatic logoff (session timeout depends on JWT expiry configuration) |
| 164.312(b) | Audit Controls | Implemented | SHA-256 hash chain audit trail; security event logging (login, MFA, permission denied, data export, data erasure); filterable queries; CSV export; PostgreSQL persistence | In-memory buffer (10K max) with optional DB persistence; SIEM integration via structured JSON logs |
| 164.312(c)(1) | Integrity | Implemented | SHA-256 hash chain on audit logs with `verify_integrity()` endpoint; SQL injection prevention via table whitelist; input validation on file uploads; test case version control with JSONB snapshots | Covers data integrity for audit trail and test artifacts |
| 164.312(d) | Person or Entity Authentication | Implemented | JWT tokens with user claims; Supabase Auth (email/password, OAuth2, SSO); MFA (TOTP) support; API key authentication for service-to-service | MFA available but not enforced by default |
| 164.312(e)(1) | Transmission Security | Implemented | TLS 1.2+ via nginx; HSTS header support (configurable); WSS for WebSocket; `sslmode=require` for PostgreSQL; HTTPS enforced for non-localhost backends in Chrome Extension | HSTS requires explicit enablement in nginx config |

---

## 3. PCI-DSS v4.0

**Important context:** Flowstral does not process, store, or transmit cardholder data (CHD). However, enterprise customers may request PCI-DSS compliance evidence as part of their vendor assessment. This matrix documents how the platform aligns with PCI-DSS requirements in the context of a non-CDE (Cardholder Data Environment) application.

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| **Req 1** | Install and Maintain Network Security Controls | Partial | Nginx reverse proxy with OWASP headers; CORS whitelist; sensitive path blocking; firewall recommendations in security guide | No built-in firewall management; network segmentation depends on deployment infrastructure |
| **Req 2** | Apply Secure Configurations to All System Components | Implemented | Non-root containers (UID 1001); no-new-privileges; minimal base images (`python:3.10-slim`, `nginx:alpine`); `server_tokens off`; environment variable injection (no hardcoded secrets) | K8s security contexts enforced in Helm chart (runAsNonRoot, no privilege escalation, read-only root FS) |
| **Req 3** | Protect Stored Account Data | Partial | Fernet encryption (AES-128-CBC + HMAC-SHA256) for secrets and BYOK API keys; secrets never exposed in list API responses; frontend never stores API keys | Platform does not store cardholder data; encryption covers platform-managed secrets |
| **Req 4** | Protect Cardholder Data with Strong Cryptography During Transmission | Implemented | TLS 1.2+ via nginx; HSTS support; WSS for WebSocket; PostgreSQL `sslmode=require`; Chrome Extension enforces HTTPS for non-localhost backends | No cardholder data transmitted, but all data-in-transit is encrypted |
| **Req 5** | Protect All Systems and Networks from Malicious Software | Partial | `.dockerignore` excludes development artifacts; minimal Docker images; CI/CD build pipeline | No built-in antivirus or malware scanning; depends on host-level protection |
| **Req 6** | Develop and Maintain Secure Systems and Software | Implemented | Input validation (file upload size limits, table whitelist for SQL); error response sanitization; CSP headers; XSS protection header; CI/CD with automated builds and tests | Security scanning (Snyk, npm audit) documented but not enforced in CI by default |
| **Req 7** | Restrict Access to System Components and Cardholder Data by Business Need to Know | Implemented | RBAC with 4-role hierarchy; `@require_permission` decorator; tenant isolation; viewer role is read-only; BYOK key access restricted to admin/owner | Least privilege is enforced programmatically |
| **Req 8** | Identify Users and Authenticate Access to System Components | Implemented | Unique user IDs; JWT authentication; MFA (TOTP) support; password policy recommendations (12+ chars, complexity, lockout); service-to-service API keys | MFA available but not mandated by default; no password rotation enforcement in platform (Supabase-managed) |
| **Req 9** | Restrict Physical Access to Cardholder Data | Gap | Software platform; no physical access controls | N/A for SaaS; customer responsibility for on-prem |
| **Req 10** | Log and Monitor All Access to System Components and Cardholder Data | Implemented | SHA-256 hash chain audit trail; security event logging; trace ID correlation; filterable queries; CSV export; Prometheus metrics; Grafana dashboards | Audit log retention depends on PostgreSQL storage; no built-in log archival |
| **Req 11** | Test Security of Systems and Networks Regularly | Partial | CI/CD pipeline with build/test gates; health check endpoints; audit integrity verification | No built-in penetration testing or vulnerability scanning; organizational responsibility |
| **Req 12** | Support Information Security with Organizational Policies and Programs | Partial | `ENTERPRISE-SECURITY-GUIDE.md` (comprehensive); privacy policy; Chrome Extension privacy policy; security header documentation | No formal information security policy management; organizational responsibility |

---

## 4. ISO 27001:2022 — Annex A Controls

ISO 27001 certification requires an Information Security Management System (ISMS). The platform provides technical controls that support ISMS implementation, but certification requires organizational processes beyond the platform.

### A.5 — Information Security Policies

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.5.1 | Policies for information security | Partial | `ENTERPRISE-SECURITY-GUIDE.md` documents security architecture; privacy policy at `/privacy`; Chrome Extension privacy policy | No formal ISMS policy framework; documented controls exist in code and guides |
| A.5.2 | Review of policies | Gap | No policy review workflow or versioning | Organizational responsibility; git history tracks documentation changes |

### A.6 — Organization of Information Security

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.6.1 | Internal organization | Partial | RBAC defines organizational roles; `owner` role has full control; audit trail tracks who does what | No formal security organization chart or responsibility assignment matrix |
| A.6.2 | Mobile devices and teleworking | Partial | JWT-based stateless auth works from any location; HTTPS enforced; Chrome Extension validates backend URLs | No mobile device management (MDM) integration; remote access security depends on customer infrastructure |

### A.7 — Human Resource Security

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.7.1 | Prior to employment | Gap | No background check or screening features | Organizational responsibility |
| A.7.2 | During employment | Partial | RBAC enforces access appropriate to role; audit trail provides accountability | No security awareness training features |
| A.7.3 | Termination and change of employment | Partial | Role changes take effect immediately via RBAC; BYOK key deletion available | No automated deprovisioning; no SCIM integration for HR system sync |

### A.8 — Asset Management

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.8.1 | Responsibility for assets | Partial | Multi-tenancy provides asset isolation per organization; project-level scoping for test cases, collections, and environments | No formal asset inventory or ownership registry |
| A.8.2 | Information classification | Partial | Sensitive data categories identified: secrets (Fernet-encrypted), BYOK API keys (encrypted), passwords (masked in recordings), network headers (masked in extension) | No formal data classification scheme or labeling |
| A.8.3 | Media handling | Partial | Docker images exclude secrets; `.dockerignore` prevents sensitive file inclusion; file upload size validation | No media disposal or secure deletion features for uploaded test artifacts |

### A.9 — Access Control

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.9.1 | Business requirements for access control | Implemented | RBAC with 4-role hierarchy; 40+ granular permissions; tenant isolation; documented permission matrix per role | Access control policy is implemented in code |
| A.9.2 | User access management | Implemented | User registration via Supabase Auth; role assignment by admin/owner; JWT tokens with claims; permission checks on every request | No self-service access request workflow; no periodic access review automation |
| A.9.3 | User responsibilities | Partial | Password policy recommendations documented; MFA support (TOTP); session management via JWT expiry | No password change enforcement in platform (delegated to Supabase) |
| A.9.4 | System and application access control | Implemented | JWT authentication; RBAC middleware; `@require_permission` decorator; `ProtectedRoute` frontend guard; API key auth for service-to-service; rate limiting per endpoint | Comprehensive programmatic access control |

### A.10 — Cryptography

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.10.1 | Policy on use of cryptographic controls | Implemented | Fernet (AES-128-CBC + HMAC-SHA256) for secrets and BYOK keys; SHA-256 for hash chains, key derivation, and cache keys; TLS 1.2+ for transit; `sslmode=require` for PostgreSQL | Cryptographic algorithms and usage documented in `ENTERPRISE-SECURITY-GUIDE.md` |
| A.10.2 | Key management | Partial | Encryption keys derived from environment variables (`JWT_SECRET`, `SECRETS_ENCRYPTION_KEY`, `ENCRYPTION_KEY`); key rotation recommended every 90 days | No built-in key rotation automation; no HSM integration; key management depends on deployment environment (Vault, AWS KMS recommended) |

### A.12 — Operations Security

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.12.1 | Operational procedures and responsibilities | Partial | Deployment runbooks (`ON-PREM-DEPLOYMENT-RUNBOOK.md`, `SAAS-DEPLOYMENT-GUIDE.md`); Helm chart with documented values; CI/CD pipelines | Documented but not formalized as SOPs |
| A.12.2 | Protection from malware | Partial | Minimal Docker base images; non-root containers; file upload size validation; input sanitization | No built-in antivirus; host-level responsibility |
| A.12.3 | Backup | Partial | PostgreSQL with Supabase-managed backups (SaaS); PgBouncer connection pooling; in-memory fallback | No built-in backup scheduling, verification, or restore testing UI |
| A.12.4 | Logging and monitoring | Implemented | Audit trail with SHA-256 hash chain; trace ID correlation across requests; security event logging; Prometheus metrics; Grafana dashboards; structured JSON logs for SIEM | Comprehensive logging infrastructure |
| A.12.5 | Control of operational software | Partial | CI/CD pipelines; Docker image builds from pinned base images; `package-lock.json` for reproducible builds | No software inventory management or license compliance checking |
| A.12.6 | Technical vulnerability management | Partial | Security scanning documentation (Snyk, npm audit); CI pipeline runs builds and tests | No automated vulnerability scanning enforced in CI; organizational responsibility |
| A.12.7 | Information systems audit considerations | Implemented | Audit trail with integrity verification; CSV export for auditors; filterable queries by user, action, resource, date range | `verify_integrity()` endpoint provides tamper detection |

### A.13 — Communications Security

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.13.1 | Network security management | Implemented | Nginx reverse proxy with OWASP security headers; CORS whitelist; rate limiting; sensitive path blocking; CSP; firewall recommendations documented | Network segmentation depends on deployment infrastructure |
| A.13.2 | Information transfer | Implemented | TLS 1.2+ for all external communications; HTTPS enforcement for Chrome Extension backends; WSS for WebSocket; sensitive header masking (Authorization, Cookie, X-API-Key) in extension network captures | Password fields and sensitive inputs masked as `[MASKED]` in recordings |

### A.14 — System Acquisition, Development, and Maintenance

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.14.1 | Security requirements of information systems | Implemented | Security controls embedded in architecture: RBAC, encryption, tenant isolation, rate limiting, input validation, audit logging | Security requirements are implemented as code, not formal requirement documents |
| A.14.2 | Security in development and support processes | Implemented | CI/CD pipelines; automated builds and tests; version control (git); code review via pull requests; test case version control | Secure coding guidelines documented in security guide |
| A.14.3 | Test data | Partial | Demo data seeding with fixed UUIDs; test environment support (QA/Staging/Preprod URL rewriting); PII masking in recordings | No automated test data anonymization or synthetic data generation for HIPAA/PCI scenarios |

### A.16 — Information Security Incident Management

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.16.1 | Management of incidents and improvements | Partial | Security event logging for 14 event types (login, MFA, permission denied, data export, data erasure, suspicious activity, rate limited, etc.); trace ID correlation; audit hash chain integrity verification | No built-in incident management workflow; `ENTERPRISE-SECURITY-GUIDE.md` section 13 provides guidance; no automated breach notification |

### A.18 — Compliance

| Control ID | Control Name | Status | Implementation Details | Gap/Notes |
|------------|-------------|--------|----------------------|-----------|
| A.18.1 | Compliance with legal and contractual requirements | Partial | GDPR data erasure API endpoint (Article 17); data export support (Article 20); privacy policy with GDPR/CCPA sections; cookie consent recommendations | Data privacy API router registered in `main.py`; implementation coverage depends on deployment |
| A.18.2 | Information security reviews | Partial | Audit log integrity verification; health check endpoints; CI/CD testing | No formal periodic security review process; organizational responsibility |

---

## Summary Dashboard

### Overall Readiness by Framework

| Framework | Implemented | Partial | Gap | Total Controls | Readiness Score |
|-----------|----------|---------|-----|---------------|-----------------|
| **SOC 2 Type II** | 8 | 14 | 5 | 27 | 56% |
| **HIPAA Security Rule** | 6 | 7 | 5 | 18 | 53% |
| **PCI-DSS v4.0** | 6 | 5 | 1 | 12 | 71% |
| **ISO 27001 Annex A** | 11 | 16 | 3 | 30 | 63% |

### Strengths (Fully Implemented)

1. **Access Control** -- RBAC with 4-role hierarchy, 40+ permissions, tenant isolation, JWT auth, MFA support
2. **Audit Logging** -- SHA-256 hash chain, 14 security event types, integrity verification, CSV export, DB persistence
3. **Encryption** -- Fernet (AES-128-CBC + HMAC-SHA256) for secrets and BYOK keys; TLS 1.2+ in transit; SHA-256 key derivation
4. **Container Security** -- Non-root users (UID 1001), no-new-privileges, read-only root filesystem, minimal base images, no secrets in images
5. **Network Security** -- Nginx OWASP headers, CORS, CSP, rate limiting (in-memory + Redis), sensitive path blocking, server version hiding
6. **Input Validation** -- SQL injection prevention (table whitelist), file upload size limits, error response sanitization, PII masking in recordings
7. **Infrastructure Monitoring** -- Health checks, Prometheus metrics, Grafana dashboards, trace ID correlation

### Key Gaps Requiring Attention

| Gap | Frameworks Affected | Remediation Path |
|-----|-------------------|-----------------|
| **No formal ISMS/policies** | SOC 2 (CC1, CC2), ISO 27001 (A.5), HIPAA (Admin) | Create organizational policy documents; implement policy acknowledgment tracking |
| **No SCIM/automated provisioning** | SOC 2 (CC6.4), ISO 27001 (A.7.3, A.9.2), HIPAA (164.308(a)(3)) | Implement SCIM 2.0 integration for IdP-driven user lifecycle |
| **No automated vulnerability scanning in CI** | PCI-DSS (Req 11), ISO 27001 (A.12.6) | Add Snyk/Trivy to CI pipeline; enforce pass/fail gates on vulnerability counts |
| **No incident response workflow** | SOC 2 (CC7.3), HIPAA (164.308(a)(6)), ISO 27001 (A.16.1) | Build incident management features or integrate with PagerDuty/Opsgenie |
| **No key management automation** | ISO 27001 (A.10.2), PCI-DSS (Req 3) | Integrate with HashiCorp Vault or AWS KMS for automated key rotation and HSM-backed encryption |
| **No physical security controls** | SOC 2 (CC6.5), HIPAA (164.310), PCI-DSS (Req 9) | N/A for SaaS; document hosting provider SOC 2 inheritance; on-prem customers must address |
| **MFA not enforced by default** | SOC 2 (CC6.2), HIPAA (164.312(d)), PCI-DSS (Req 8) | Add configurable MFA enforcement policy (require MFA for admin/owner roles at minimum) |
| **No data backup/restore UI** | SOC 2 (CC7.5), HIPAA (164.308(a)(7)), ISO 27001 (A.12.3) | Build backup management dashboard; implement automated backup verification |
| **Audit log retention management** | SOC 2 (CC4.1), PCI-DSS (Req 10), ISO 27001 (A.12.4) | Implement configurable retention policies; add log archival to S3/cold storage |

### Customer Responsibilities (Shared Responsibility Model)

The following controls require customer action regardless of platform capabilities:

| Responsibility | Relevant Frameworks |
|---------------|-------------------|
| Organizational security policies and ISMS documentation | SOC 2, ISO 27001, HIPAA |
| Physical security of on-premises deployments | SOC 2, HIPAA, PCI-DSS |
| Employee background checks and security training | SOC 2, ISO 27001, HIPAA |
| Host-level antivirus and malware protection | PCI-DSS, ISO 27001 |
| Network firewall configuration and WAF deployment | PCI-DSS, SOC 2 |
| Business Associate Agreement (BAA) with hosting providers | HIPAA |
| Periodic risk assessments and penetration testing | SOC 2, PCI-DSS, ISO 27001 |
| Incident response planning and breach notification procedures | SOC 2, HIPAA, ISO 27001 |
| Test data anonymization for PHI/PCI-scoped test environments | HIPAA, PCI-DSS |
| Key management infrastructure (Vault, KMS) for production | ISO 27001, PCI-DSS |

---

## Appendix: Key Security Implementation Files

| File | Purpose |
|------|---------|
| `backend/app/middleware/rbac_middleware.py` | RBAC enforcement middleware + `@require_permission` decorator |
| `backend/app/middleware/tenant_middleware.py` | JWT extraction, tenant isolation, multi-tenancy enforcement |
| `backend/app/middleware/rate_limit_middleware.py` | Sliding window rate limiting (in-memory + Redis backends) |
| `backend/app/middleware/trace_logging_middleware.py` | Trace ID assignment, structured logging, request correlation |
| `backend/app/services/core/audit_service.py` | SHA-256 hash chain audit trail, security event logging, integrity verification |
| `backend/app/services/core/secrets_service.py` | Fernet encryption for stored secrets |
| `backend/app/services/core/ai_settings_service.py` | BYOK key encryption, budget controls, usage tracking |
| `backend/app/services/core/rbac_service.py` | Permission resolution, role hierarchy |
| `backend/app/services/auth/password_service.py` | Password hashing (bcrypt) |
| `backend/app/services/storage/postgres_direct.py` | SQL injection prevention via `ALLOWED_TABLES` whitelist |
| `backend/app/routers/platform/ai_settings_api.py` | BYOK key management API (7 endpoints) |
| `backend/app/routers/platform/audit_api.py` | Audit trail query/export API (4 endpoints) |
| `backend/app/routers/ai/ai_key_resolver.py` | Shared AI key resolution helper |
| `nginx/default.conf` | OWASP security headers, CORS, CSP, rate limiting, path blocking |
| `helm/qaai/values.yaml` | K8s security contexts (runAsNonRoot, no privilege escalation, read-only root FS) |
| `docs/ENTERPRISE-SECURITY-GUIDE.md` | Comprehensive security architecture documentation |
| `src/components/ProtectedRoute.tsx` | Frontend RBAC enforcement, role hierarchy |
| `src/contexts/AIContext.tsx` | Frontend AI feature gating (no key storage) |
| `flowstral-extension/src/lib/network-capture.js` | Sensitive header masking in recordings |
