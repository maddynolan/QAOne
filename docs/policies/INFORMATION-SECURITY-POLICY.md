# Information Security Policy

| Field | Value |
|-------|-------|
| **Document Title** | Information Security Policy |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 7, 2026 |
| **Owner** | Security Team |
| **Classification** | Internal |
| **SOC 2 Controls** | CC1.1, CC1.2 |
| **Approved By** | See Approval Signatures (Section 12) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Information Security Management System (ISMS) Overview](#3-information-security-management-system-isms-overview)
4. [Roles and Responsibilities](#4-roles-and-responsibilities)
5. [Data Classification](#5-data-classification)
6. [QAAI Platform Data Classification Examples](#6-qaai-platform-data-classification-examples)
7. [Information Handling Procedures](#7-information-handling-procedures)
8. [Acceptable Use Policy](#8-acceptable-use-policy)
9. [Security Training and Awareness](#9-security-training-and-awareness)
10. [Policy Compliance and Enforcement](#10-policy-compliance-and-enforcement)
11. [Policy Review and Maintenance](#11-policy-review-and-maintenance)
12. [Approval Signatures](#12-approval-signatures)
13. [Version History](#13-version-history)

---

## 1. Purpose

This Information Security Policy establishes the framework for protecting the confidentiality, integrity, and availability of information assets owned, managed, or processed by the QAAI/Flowstral platform and its parent organization. This policy serves as the foundational document of the Information Security Management System (ISMS) and provides direction for all subordinate security policies, standards, and procedures.

This policy supports compliance with the AICPA Trust Services Criteria for SOC 2 Type II, specifically:

- **CC1.1**: The entity demonstrates a commitment to integrity and ethical values.
- **CC1.2**: The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control.

## 2. Scope

### 2.1 Applicability

This policy applies to:

- All employees, contractors, consultants, and temporary workers who access QAAI/Flowstral systems or data.
- All information assets, including but not limited to: source code, customer data, test artifacts, infrastructure credentials, and business records.
- All environments: production, staging, development, and disaster recovery.
- All deployment models: SaaS (Hetzner/Coolify, Railway/Vercel/Supabase), on-premises (Docker/Kubernetes/Helm), and desktop (Electron).
- All third-party services integrated with the platform (Supabase, OpenAI, Anthropic, GitHub, Jira).

### 2.2 Exclusions

This policy does not govern information security practices of customers using the QAAI/Flowstral platform in their own environments unless explicitly stated in contractual agreements. Customer-managed on-premises deployments are governed by the On-Prem Deployment Runbook and shared responsibility model.

## 3. Information Security Management System (ISMS) Overview

### 3.1 ISMS Objectives

The ISMS is designed to:

1. Protect customer data processed through the QAAI platform, including test cases, API collections, recordings, and credentials.
2. Ensure the availability of the platform to meet service level commitments.
3. Maintain the integrity of test results, audit trails, and compliance records.
4. Comply with applicable laws, regulations, and contractual obligations including SOC 2, GDPR, CCPA, and HIPAA (where applicable).
5. Continuously improve the security posture through risk assessment, monitoring, and incident response.

### 3.2 Security Principles

The ISMS is founded on the following principles:

- **Defense in Depth**: Multiple layers of security controls are implemented at the network, application, and data layers. The QAAI platform employs CORS, rate limiting, RBAC, tenant isolation, and trace logging middleware in a defined stack order.
- **Least Privilege**: Users and services are granted the minimum permissions necessary to perform their functions. The QAAI RBAC system enforces Owner > Admin > Member > Viewer role hierarchy.
- **Separation of Duties**: Critical operations require involvement of multiple authorized individuals.
- **Secure by Default**: AI features are disabled by default; users must opt in at the organization level. BYOK (Bring Your Own Key) architecture ensures API keys are Fernet-encrypted at rest.
- **Fail Secure**: System failures default to a secure state. In-memory fallback ensures availability without compromising data isolation.

### 3.3 Compliance Framework Alignment

| Framework | Relevant Controls | Status |
|-----------|------------------|--------|
| SOC 2 Type II | CC1-CC9, A1, C1, PI1 | In Progress |
| GDPR | Articles 5, 6, 17, 25, 32, 33, 34 | Compliant |
| CCPA | Sections 1798.100-1798.199 | Compliant |
| HIPAA | 164.308, 164.310, 164.312 | Ready (when applicable) |
| ISO 27001 | Annex A controls | Aligned |
| PCI-DSS | Requirements 1-12 | Aligned (where applicable) |
| FedRAMP | AC, AU, CM, IA, SC families | Aligned |

## 4. Roles and Responsibilities

### 4.1 Chief Information Security Officer (CISO)

The CISO has overall accountability for the ISMS and is responsible for:

- Establishing and maintaining security policies, standards, and procedures.
- Reporting security posture and risks to executive leadership and the board.
- Overseeing security incident response and coordinating with legal counsel.
- Approving risk acceptance decisions for High-level risks and above.
- Ensuring adequate budget and resources for security operations.
- Leading the annual security program review and SOC 2 audit preparation.

### 4.2 Security Team

The Security Team is responsible for:

- Implementing and operating security controls across all QAAI platform environments.
- Conducting vulnerability assessments, penetration tests, and security code reviews.
- Managing the SSRF prevention utility (`backend/app/utils/url_validator.py`) and other security services.
- Monitoring security events, investigating alerts, and escalating incidents per the Incident Response Plan.
- Administering identity and access management systems, including MFA enrollment (`backend/app/services/auth/mfa_service.py`).
- Maintaining the security rules master document (`docs/SECURITY-RULES-MASTER.md`) with 40+ security rules.
- Conducting quarterly access reviews and annual risk assessments.

### 4.3 Engineering Team

All engineers and developers are responsible for:

- Following secure coding practices as defined in the QAAI security rules, including error response sanitization, input validation, and SSRF prevention.
- Completing mandatory security training upon hire and annually thereafter.
- Reporting security vulnerabilities and incidents to the Security Team within 24 hours.
- Implementing security requirements in code: rate limiting, RBAC decorators (`@require_permission`), tenant isolation, and audit logging.
- Participating in security code reviews for all changes to authentication, authorization, encryption, or data handling code.
- Following the Change Management Policy for all production deployments via the CI/CD pipeline (`.github/workflows/ci.yml`).

### 4.4 Operations and Infrastructure Team

The Operations team is responsible for:

- Maintaining infrastructure security controls: firewalls, network segmentation, TLS configuration.
- Managing container security (non-root containers, CIS Benchmark 4.1 compliance).
- Operating Nginx with OWASP security headers (`nginx/default.conf`).
- Managing PgBouncer connection pooling and database security (`deploy/pgbouncer/pgbouncer.ini`).
- Performing backup and recovery operations per the Data Retention Policy.
- Maintaining Prometheus monitoring and Grafana dashboards for security metrics.

### 4.5 All Staff

Every individual with access to QAAI systems or data is responsible for:

- Understanding and complying with this policy and all subordinate security policies.
- Protecting credentials and not sharing passwords or API keys.
- Reporting suspicious activity, security incidents, or policy violations.
- Completing assigned security awareness training on schedule.
- Locking workstations when unattended.
- Using only approved devices and software for accessing company systems.

## 5. Data Classification

### 5.1 Classification Levels

All information assets must be classified according to the following four-tier scheme:

| Level | Label | Definition | Examples |
|-------|-------|-----------|----------|
| 1 | **Public** | Information intended for public disclosure. No adverse impact if disclosed. | Marketing materials, public documentation, blog posts, landing page content, pricing information. |
| 2 | **Internal** | Information intended for internal use. Minor impact if disclosed externally. | Internal communications, project plans, non-sensitive configuration, development documentation. |
| 3 | **Confidential** | Sensitive business or customer information. Material impact if disclosed. | Customer test data, source code, business strategies, employee records, non-public financial data. |
| 4 | **Restricted** | Highly sensitive information. Severe impact if disclosed. Regulatory or contractual obligations apply. | Encryption keys, API keys, passwords, personally identifiable information (PII), health data (PHI), payment card data, credentials, access tokens. |

### 5.2 Classification Rules

1. All information must be classified by the data owner at the time of creation.
2. When in doubt, classify at the higher (more restrictive) level.
3. Information that combines data from multiple classifications inherits the highest classification of its components.
4. Classification may be upgraded at any time; downgrading requires approval from the data owner and the Security Team.
5. Classification labels must be applied to documents, repositories, databases, and storage containers.

## 6. QAAI Platform Data Classification Examples

The following table maps QAAI/Flowstral platform data types to their classifications:

| Data Type | Classification | Rationale |
|-----------|---------------|-----------|
| Test case definitions | Internal | Business logic, non-sensitive structure |
| Test case results and execution logs | Internal | Operational data, may contain URLs |
| Recorded browser sessions (DOM snapshots) | Confidential | May capture customer application UI and data |
| Screenshots and visual baselines | Confidential | May contain customer application content |
| API collections and saved requests | Confidential | May contain endpoint details, headers, body data |
| API request/response bodies | Confidential | May contain business data |
| User credentials (passwords) | Restricted | Authentication data, hashed via bcrypt/argon2id (`password_service.py`) |
| API keys (OpenAI, Anthropic, customer BYOK) | Restricted | Fernet-encrypted at rest (`ai_settings_service.py`) |
| Database connection strings | Restricted | Infrastructure credentials |
| Supabase keys and JWT secrets | Restricted | Authentication infrastructure |
| MFA TOTP secrets | Restricted | Second-factor authentication seeds |
| Session tokens | Restricted | Active authentication state |
| Audit logs | Confidential | Tracks user actions, potential investigation evidence |
| Dashboard metrics and analytics | Internal | Aggregated operational data |
| Performance test results | Internal | Load test metrics, response times |
| Accessibility scan results | Internal | WCAG compliance findings |
| User profiles (name, email) | Confidential | Personally identifiable information |
| Organization and project metadata | Internal | Structural data |
| AI/LLM interaction logs | Confidential | May contain test content sent to LLM providers |
| Chrome Extension recordings | Confidential | Captures user interactions on customer sites |
| Network capture (HAR files) | Confidential | May contain headers, cookies (masked in extension) |
| Source code | Confidential | Intellectual property |
| Marketing content, blog posts | Public | Intended for public consumption |
| Public documentation (docs/) | Internal | Some docs are internal-only |
| Deployment configurations | Confidential | Infrastructure details |
| Helm chart values | Confidential | Kubernetes configuration with potential secrets references |
| Backup data | Inherits source classification | Matches the classification of the backed-up data |

## 7. Information Handling Procedures

### 7.1 Public Data

| Control | Requirement |
|---------|-------------|
| Storage | No restrictions. May be stored on any approved system. |
| Transmission | No encryption required, though HTTPS is preferred. |
| Access | No restrictions. |
| Sharing | May be shared freely. Published via `src/pages/marketing/`, `public/sitemap.xml`. |
| Disposal | Standard deletion. No special procedures required. |
| Labeling | Optional. Mark as "Public" when helpful for clarity. |

### 7.2 Internal Data

| Control | Requirement |
|---------|-------------|
| Storage | Store on approved company systems only. |
| Transmission | Encrypt in transit (TLS 1.2+). |
| Access | Authenticated users with valid session. Viewer role minimum. |
| Sharing | Share within the organization. Do not share externally without manager approval. |
| Disposal | Standard deletion with confirmation. |
| Labeling | Mark as "Internal" in document headers or metadata. |

### 7.3 Confidential Data

| Control | Requirement |
|---------|-------------|
| Storage | Encrypt at rest (AES-256). Store in approved databases (PostgreSQL with encryption, Supabase). |
| Transmission | Encrypt in transit (TLS 1.2+). Do not transmit over unencrypted channels. |
| Access | Role-based access (Member role minimum). Enforce tenant isolation via `TenantContextMiddleware`. |
| Sharing | Share only with authorized individuals on a need-to-know basis. External sharing requires NDA and management approval. |
| Disposal | Secure deletion. Overwrite or crypto-shred. Follow Data Retention Policy. |
| Labeling | Mark as "Confidential" in headers, footers, or metadata. |
| Logging | All access must be logged via the audit trail (`audit_service.py`). |

### 7.4 Restricted Data

| Control | Requirement |
|---------|-------------|
| Storage | Encrypt at rest with Fernet symmetric encryption or AES-256. Store in designated secure stores only (encrypted database columns, secrets vault via `secrets_api.py`). Never store in logs, environment variable files committed to source control, or client-side storage. |
| Transmission | Encrypt in transit (TLS 1.2+ mandatory). End-to-end encryption preferred. Never include in URL parameters, query strings, or log messages. Use `sanitize_url_for_logging()` for URL logging. |
| Access | Strictly limited to authorized personnel. Admin or Owner role required. MFA mandatory for access. |
| Sharing | Do not share outside the organization. Internal sharing requires explicit authorization and is logged. |
| Disposal | Crypto-shredding (destroy encryption keys) or secure multi-pass overwrite. Follow the Data Retention Policy and GDPR erasure procedures (`data_erasure_service.py`). |
| Labeling | Mark as "Restricted" prominently. Automated detection where possible. |
| Logging | All access, creation, modification, and deletion must be logged with user identity, timestamp, and action type. |
| Monitoring | Real-time alerting on anomalous access patterns. |

### 7.5 Sensitive Data Masking

The QAAI platform implements automatic masking for sensitive data:

- **Chrome Extension**: Passwords masked as `[MASKED]` in recorded actions (`content.js`). Sensitive headers (Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token) masked in network captures (`network-capture.js`).
- **API Keys**: Frontend never stores API keys in state or localStorage. Only `hasApiKey: boolean` flags are tracked. Keys are sent to backend, Fernet-encrypted, and stored in `ai_encrypted_keys` table.
- **Error Responses**: Error response sanitization removes `str(e)` from 100+ HTTPException details to prevent information leakage.
- **URL Logging**: `sanitize_url_for_logging()` strips query parameters and credentials before writing to logs.

## 8. Acceptable Use Policy

### 8.1 General Principles

1. Company information systems and resources are provided for authorized business purposes.
2. Incidental personal use is permitted provided it does not interfere with job duties, consume excessive resources, or violate any policy.
3. Users must not use company systems for illegal activities, harassment, or unauthorized access.

### 8.2 Prohibited Activities

The following activities are strictly prohibited:

1. Sharing, disclosing, or exfiltrating Confidential or Restricted data without authorization.
2. Attempting to access systems, data, or accounts beyond the scope of one's role.
3. Installing unauthorized software on company devices or servers.
4. Disabling, circumventing, or tampering with security controls (firewalls, antivirus, DLP, rate limiting).
5. Using production systems for personal projects or unauthorized testing.
6. Storing Restricted data (API keys, credentials) in unencrypted files, personal devices, or public repositories.
7. Sharing credentials, tokens, or MFA devices with others.
8. Using the QAAI platform to test or attack systems without explicit written authorization from the system owner.
9. Bypassing the CI/CD pipeline to deploy code directly to production.
10. Connecting unauthorized devices to the corporate network or production infrastructure.

### 8.3 Email and Communication

1. Company email must not be used to transmit Restricted data unless end-to-end encrypted.
2. Phishing simulations will be conducted quarterly. Employees who fail must complete additional training.
3. Suspicious emails must be reported to the Security Team immediately.

### 8.4 Remote Work

1. All remote access must use encrypted connections (VPN or HTTPS).
2. Company data must not be stored on personal devices without Mobile Device Management (MDM) enrollment.
3. Screen locks must be set with a maximum 5-minute timeout.
4. Shared or public computers must not be used to access Confidential or Restricted data.

## 9. Security Training and Awareness

### 9.1 Training Requirements

| Audience | Training | Frequency | Duration |
|----------|----------|-----------|----------|
| All Staff | Security Awareness Fundamentals | Upon hire + annually | 1 hour |
| All Staff | Phishing Recognition | Quarterly | 15 minutes |
| Engineering | Secure Coding Practices (OWASP Top 10) | Upon hire + annually | 2 hours |
| Engineering | QAAI Security Controls Workshop | Upon hire + when controls change | 1 hour |
| Security Team | Advanced Threat Detection and IR | Quarterly | 2 hours |
| Management | Security Governance and Risk | Annually | 1 hour |
| Privileged Users | Privileged Access Security | Upon role assignment + annually | 1 hour |

### 9.2 Training Content

Security awareness training must cover:

1. This Information Security Policy and subordinate policies.
2. Data classification and handling procedures.
3. Password security and MFA usage.
4. Social engineering and phishing recognition.
5. Incident reporting procedures.
6. Physical security requirements.
7. Remote work security practices.
8. QAAI-specific security controls: RBAC roles, SSRF prevention, error sanitization, encryption practices.

### 9.3 Training Records

Training completion records must be maintained for a minimum of 3 years. Records must include: employee name, training title, date completed, score (if applicable), and trainer/platform used. These records are subject to SOC 2 audit review.

### 9.4 Non-Compliance

Failure to complete required training within 30 days of the due date will result in escalation to the employee's manager. Continued non-compliance may result in access suspension.

## 10. Policy Compliance and Enforcement

### 10.1 Compliance Monitoring

Compliance with this policy is monitored through:

1. Automated security scanning (Dependabot, CodeQL, npm audit) integrated into CI/CD.
2. Quarterly access reviews comparing actual permissions to role requirements.
3. Annual internal audits of security controls.
4. External SOC 2 Type II audits.
5. Continuous monitoring via Prometheus metrics and Grafana dashboards.
6. Audit log review (`backend/app/services/core/audit_service.py`).

### 10.2 Violations

Violations of this policy may result in disciplinary action up to and including termination of employment or contract, and may be reported to law enforcement if criminal activity is suspected.

The severity of the response will be proportional to the nature, extent, and impact of the violation:

| Severity | Examples | Response |
|----------|----------|----------|
| Low | Failure to complete training on time, minor AUP violation | Verbal warning, mandatory remedial training |
| Medium | Sharing Internal data externally, weak password practices | Written warning, access review, mandatory training |
| High | Unauthorized access to Confidential data, bypassing security controls | Suspension of access, formal investigation, written warning |
| Critical | Exfiltration of Restricted data, intentional sabotage | Immediate access termination, legal action, law enforcement notification |

### 10.3 Exception Process

Exceptions to this policy must be:

1. Requested in writing with business justification and risk assessment.
2. Approved by the CISO (or Security Team Lead for Low-risk exceptions).
3. Time-limited (maximum 12 months, renewable).
4. Documented in the risk register with compensating controls.
5. Reviewed quarterly for continued necessity.

## 11. Policy Review and Maintenance

### 11.1 Review Cadence

This policy must be reviewed and updated:

- **Annually**: Full review by the Security Team and CISO, with input from Engineering, Operations, and Legal.
- **On Material Change**: Within 30 days of any material change to the QAAI platform architecture, deployment model, regulatory requirements, or significant security incident.
- **Post-Audit**: Within 60 days of receiving SOC 2 audit findings that require policy updates.

### 11.2 Review Process

1. The Security Team drafts proposed changes and circulates for review.
2. Stakeholders (Engineering, Operations, Legal, HR) provide feedback within 14 business days.
3. The CISO approves the final version.
4. Updated policy is published to `docs/policies/` and announced to all staff.
5. Training materials are updated to reflect policy changes.

### 11.3 Related Documents

| Document | Location |
|----------|----------|
| Access Control Policy | `docs/policies/ACCESS-CONTROL-POLICY.md` |
| Change Management Policy | `docs/policies/CHANGE-MANAGEMENT-POLICY.md` |
| Data Retention Policy | `docs/policies/DATA-RETENTION-POLICY.md` |
| Risk Assessment Policy | `docs/policies/RISK-ASSESSMENT-POLICY.md` |
| Incident Response Plan | `docs/INCIDENT-RESPONSE-PLAN.md` |
| Security Rules Master | `docs/SECURITY-RULES-MASTER.md` |
| Security Configuration Guide | `docs/SECURITY-CONFIGURATION-GUIDE.md` |
| Security Audit Findings | `docs/SECURITY-AUDIT-FINDINGS.md` |
| Compliance Readiness Matrix | `docs/COMPLIANCE-READINESS-MATRIX.md` |
| Enterprise Security Guide | `docs/ENTERPRISE-SECURITY-GUIDE.md` |

## 12. Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Executive Officer | _________________ | _________________ | ____/____/________ |
| Chief Information Security Officer | _________________ | _________________ | ____/____/________ |
| VP of Engineering | _________________ | _________________ | ____/____/________ |
| Head of Legal/Compliance | _________________ | _________________ | ____/____/________ |

## 13. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | Security Team | Initial policy creation for SOC 2 Type II certification |
