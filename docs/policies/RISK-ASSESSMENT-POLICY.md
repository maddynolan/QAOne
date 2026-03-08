# Risk Assessment Policy

| Field | Value |
|-------|-------|
| **Document Title** | Risk Assessment Policy |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 7, 2026 |
| **Owner** | Security Team |
| **Classification** | Internal |
| **SOC 2 Controls** | CC3.1, CC3.2, CC3.3, CC3.4 |
| **Approved By** | See Approval Signatures (Section 13) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Risk Management Framework](#3-risk-management-framework)
4. [Risk Identification](#4-risk-identification)
5. [Risk Scoring Methodology](#5-risk-scoring-methodology)
6. [Risk Treatment](#6-risk-treatment)
7. [Risk Register](#7-risk-register)
8. [QAAI Platform Risk Inventory](#8-qaai-platform-risk-inventory)
9. [Risk Assessment Cadence](#9-risk-assessment-cadence)
10. [Vulnerability Management](#10-vulnerability-management)
11. [Penetration Testing](#11-penetration-testing)
12. [Risk Acceptance and Escalation](#12-risk-acceptance-and-escalation)
13. [Approval Signatures](#13-approval-signatures)
14. [Version History](#14-version-history)

---

## 1. Purpose

This Risk Assessment Policy establishes the framework for identifying, evaluating, treating, and monitoring information security risks to the QAAI/Flowstral platform. The policy ensures that risks are managed proactively, that resources are allocated to the highest-priority risks, and that risk management activities are documented and auditable.

This policy supports SOC 2 Trust Services Criteria:

- **CC3.1**: The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks relating to objectives.
- **CC3.2**: The entity identifies risks to the achievement of its objectives across the entity and analyzes risks as a basis for determining how the risks should be managed.
- **CC3.3**: The entity considers the potential for fraud in assessing risks to the achievement of objectives.
- **CC3.4**: The entity identifies and assesses changes that could significantly impact the system of internal control.

## 2. Scope

This policy applies to all information security risks affecting:

- The QAAI/Flowstral platform across all deployment models (SaaS, on-premises, desktop).
- Supporting infrastructure (servers, databases, networks, cloud services).
- Third-party services and integrations (Supabase, OpenAI, Anthropic, GitHub, Jira).
- Organizational processes (development, operations, customer support).
- Personnel (employees, contractors, third-party partners).
- Physical assets (offices, data centers, endpoint devices).

## 3. Risk Management Framework

### 3.1 Framework Overview

The QAAI risk management framework follows the ISO 31000 risk management process:

```
1. Establish Context
        |
        v
2. Risk Identification
        |
        v
3. Risk Analysis (Likelihood x Impact)
        |
        v
4. Risk Evaluation (Scoring and Prioritization)
        |
        v
5. Risk Treatment (Mitigate, Accept, Transfer, Avoid)
        |
        v
6. Monitoring and Review
        |
        v
   (Continuous cycle)
```

### 3.2 Risk Management Objectives

1. Protect the confidentiality, integrity, and availability of customer data processed by the QAAI platform.
2. Maintain continuous platform availability in accordance with service level commitments.
3. Comply with regulatory and contractual obligations (SOC 2, GDPR, HIPAA where applicable).
4. Minimize financial, operational, and reputational impact from security incidents.
5. Enable informed decision-making by leadership through transparent risk reporting.
6. Continuously improve the security posture through systematic risk identification and treatment.

### 3.3 Risk Appetite Statement

The organization maintains a low risk appetite for:

- Data breaches involving customer data or credentials.
- Unauthorized access to production systems.
- Service outages affecting platform availability.
- Regulatory non-compliance.

The organization maintains a moderate risk appetite for:

- Technology adoption risks associated with AI/LLM integration.
- Market and competitive risks.
- Operational risks that can be mitigated through automation and monitoring.

## 4. Risk Identification

### 4.1 Risk Identification Methods

| Method | Frequency | Responsible | Description |
|--------|-----------|-------------|-------------|
| Asset inventory review | Quarterly | Operations + Security | Catalog all information assets, assess value and exposure |
| Threat modeling | Per major feature/release | Engineering + Security | STRIDE or PASTA methodology for new features |
| Vulnerability scanning | Continuous (automated) | Security + DevOps | Dependabot, CodeQL, npm audit, container scanning |
| Penetration testing | Annually (minimum) | External vendor + Security | Black-box and white-box testing of the platform |
| Security code review | Per pull request | Engineering | Review code changes for security implications |
| Incident analysis | Per incident | Security + Engineering | Root cause analysis identifies systemic risks |
| Regulatory change monitoring | Quarterly | Legal + Security | Monitor changes in SOC 2, GDPR, HIPAA, PCI-DSS |
| Third-party risk assessment | Annually + on new vendor | Security + Procurement | Assess security posture of third-party services |
| Internal audit | Annually | Security | Comprehensive assessment of all controls |
| Employee reports | Continuous | All staff | Anyone can report a potential risk or vulnerability |

### 4.2 Risk Categories

| Category | Code | Description | QAAI Examples |
|----------|------|-------------|---------------|
| **Application Security** | APP | Vulnerabilities in application code | SSRF, XSS, SQL injection, insecure deserialization |
| **Infrastructure Security** | INF | Risks to servers, networks, cloud services | Misconfigured firewalls, unpatched servers, container escapes |
| **Data Security** | DAT | Risks to data confidentiality, integrity, availability | Data breach, data corruption, unauthorized access |
| **Access Control** | ACC | Risks related to authentication and authorization | Privilege escalation, credential theft, session hijacking |
| **Third-Party** | TPR | Risks from third-party services and supply chain | Vendor breach, API outage, dependency vulnerabilities |
| **Operational** | OPS | Risks to business operations and processes | Deployment failures, backup failures, key person dependency |
| **Compliance** | COM | Regulatory and contractual compliance risks | SOC 2 control failures, GDPR violations, audit findings |
| **Physical** | PHY | Physical security risks | Office break-in, hardware theft, natural disaster |
| **Personnel** | PER | Human-related risks | Insider threat, social engineering, skill gaps |
| **AI/LLM Specific** | AIS | Risks specific to AI/LLM integration | Prompt injection, data leakage to LLM providers, model hallucination |

### 4.3 Threat Modeling

For significant new features or architectural changes, threat modeling is conducted using the STRIDE methodology:

| Threat Type | Description | QAAI Relevance |
|-------------|-------------|----------------|
| **S**poofing | Impersonating a user or system | JWT token forgery, session hijacking |
| **T**ampering | Modifying data or code | Test result manipulation, configuration tampering |
| **R**epudiation | Denying actions were taken | Audit log deletion or modification |
| **I**nformation Disclosure | Exposing data to unauthorized parties | API key leakage, error message information disclosure |
| **D**enial of Service | Disrupting service availability | Rate limit bypass, resource exhaustion via performance tests |
| **E**levation of Privilege | Gaining higher access than authorized | RBAC bypass, tenant isolation failure |

## 5. Risk Scoring Methodology

### 5.1 Likelihood Scale

| Score | Level | Description | Estimated Frequency |
|-------|-------|-------------|-------------------|
| 1 | Very Low | Extremely unlikely; would require extraordinary circumstances | Less than once every 5 years |
| 2 | Low | Unlikely but possible; has not occurred but could | Once every 2-5 years |
| 3 | Medium | Possible; has occurred in the industry or similar organizations | Once per year |
| 4 | High | Likely; has occurred before or conditions make it probable | Multiple times per year |
| 5 | Very High | Almost certain; actively being exploited or conditions exist for imminent occurrence | Monthly or more frequently |

### 5.2 Impact Scale

| Score | Level | Description | Financial Impact | Operational Impact | Reputational Impact |
|-------|-------|-------------|-----------------|-------------------|-------------------|
| 1 | Negligible | No meaningful impact | < $1,000 | No service disruption | No external awareness |
| 2 | Minor | Minimal impact, easily absorbed | $1,000 - $10,000 | < 1 hour disruption for < 5% of users | Minor customer complaint |
| 3 | Moderate | Noticeable impact requiring management attention | $10,000 - $100,000 | 1-4 hours disruption or degradation | Some customer churn, social media mention |
| 4 | Major | Significant impact affecting business objectives | $100,000 - $1,000,000 | 4-24 hours disruption, data integrity concerns | Media coverage, significant customer churn |
| 5 | Critical | Severe impact threatening business viability | > $1,000,000 | > 24 hours disruption, data loss or breach | Regulatory action, widespread media coverage, existential threat |

### 5.3 Risk Score Calculation

**Risk Score = Likelihood x Impact**

| | Impact 1 | Impact 2 | Impact 3 | Impact 4 | Impact 5 |
|---|---------|---------|---------|---------|---------|
| **Likelihood 5** | 5 (Low) | 10 (Med) | 15 (High) | 20 (Crit) | 25 (Crit) |
| **Likelihood 4** | 4 (Low) | 8 (Med) | 12 (High) | 16 (High) | 20 (Crit) |
| **Likelihood 3** | 3 (Low) | 6 (Med) | 9 (Med) | 12 (High) | 15 (High) |
| **Likelihood 2** | 2 (Low) | 4 (Low) | 6 (Med) | 8 (Med) | 10 (Med) |
| **Likelihood 1** | 1 (Low) | 2 (Low) | 3 (Low) | 4 (Low) | 5 (Low) |

### 5.4 Risk Levels

| Risk Score | Level | Color | Response Time | Required Action |
|------------|-------|-------|---------------|-----------------|
| 20-25 | **Critical** | Red | Immediate (within 24 hours) | Executive notification, emergency treatment plan, dedicated resources |
| 12-19 | **High** | Orange | Within 1 week | CISO review, treatment plan required, tracked in weekly security meetings |
| 6-11 | **Medium** | Yellow | Within 1 month | Security Team review, treatment plan documented, tracked quarterly |
| 1-5 | **Low** | Green | Within 1 quarter | Documented in risk register, monitored, treated as resources allow |

## 6. Risk Treatment

### 6.1 Treatment Options

| Option | Description | When to Use | Example |
|--------|-------------|-------------|---------|
| **Mitigate** | Implement controls to reduce likelihood or impact | Risk is above appetite and can be reduced through controls | Implement SSRF validation (`url_validator.py`) to reduce SSRF risk |
| **Accept** | Acknowledge the risk without additional controls | Risk is within appetite, or cost of mitigation exceeds benefit | Accept minor UI rendering inconsistencies across browsers |
| **Transfer** | Shift risk to a third party | Risk can be better managed externally | Purchase cyber insurance, use managed database services |
| **Avoid** | Eliminate the activity that creates the risk | Risk is unacceptable and cannot be adequately mitigated | Do not store raw credit card numbers; do not allow direct database access from the internet |

### 6.2 Treatment Plan Template

Each risk requiring treatment must have a documented plan:

```
RISK TREATMENT PLAN
===================

Risk ID:            RISK-YYYY-NNN
Risk Description:   [Description of the risk]
Current Risk Score: [Likelihood x Impact = Score]
Target Risk Score:  [Desired score after treatment]
Treatment Option:   [Mitigate / Accept / Transfer / Avoid]

TREATMENT ACTIONS
-----------------
Action 1:           [Description of the control or action]
  Owner:            [Person responsible]
  Deadline:         [Target completion date]
  Status:           [Not Started / In Progress / Completed]
  Evidence:         [How completion will be verified]

Action 2:           [Description of the control or action]
  Owner:            [Person responsible]
  Deadline:         [Target completion date]
  Status:           [Not Started / In Progress / Completed]
  Evidence:         [How completion will be verified]

RESIDUAL RISK
-------------
After treatment:    [Expected Likelihood x Impact = Residual Score]
Acceptable:         [Yes/No]
Risk Owner Sign-off: [Name, Date]
```

### 6.3 Control Categories

| Category | Description | QAAI Examples |
|----------|-------------|---------------|
| **Preventive** | Prevent the risk from occurring | Input validation, SSRF prevention (`url_validator.py`), RBAC enforcement, rate limiting |
| **Detective** | Detect when the risk has occurred | Audit logging (`audit_service.py`), Prometheus alerting, error rate monitoring |
| **Corrective** | Correct the impact after occurrence | Incident response procedures, backup restoration, self-healing locator chain |
| **Compensating** | Alternative control when primary is not feasible | In-memory fallback when PostgreSQL is unavailable, manual code review when automated scan misses |

## 7. Risk Register

### 7.1 Risk Register Template

The risk register is the central repository for all identified risks. Each entry includes:

| Column | Description |
|--------|-------------|
| **Risk ID** | Unique identifier (RISK-YYYY-NNN) |
| **Category** | Risk category code (APP, INF, DAT, ACC, TPR, OPS, COM, PHY, PER, AIS) |
| **Description** | Clear description of the risk event and its potential impact |
| **Likelihood** | Score 1-5 |
| **Impact** | Score 1-5 |
| **Inherent Risk Score** | Likelihood x Impact (before controls) |
| **Existing Controls** | Controls already in place |
| **Residual Likelihood** | Score 1-5 (after existing controls) |
| **Residual Impact** | Score 1-5 (after existing controls) |
| **Residual Risk Score** | Residual Likelihood x Residual Impact |
| **Risk Level** | Critical / High / Medium / Low |
| **Treatment** | Mitigate / Accept / Transfer / Avoid |
| **Treatment Actions** | Specific actions planned |
| **Owner** | Individual accountable for the risk |
| **Status** | Open / In Treatment / Accepted / Closed |
| **Review Date** | Next scheduled review date |

### 7.2 Risk Register Maintenance

1. The risk register is maintained by the Security Team in a controlled document.
2. New risks are added as identified through any method in Section 4.1.
3. Risk scores are re-evaluated quarterly and after any significant change.
4. Closed risks are archived but retained for 3 years.
5. The risk register is reviewed in quarterly security review meetings.
6. The CISO presents a risk register summary to leadership quarterly.

## 8. QAAI Platform Risk Inventory

The following is the initial risk inventory for the QAAI/Flowstral platform. This inventory is a living document updated through the risk assessment process.

### 8.1 Application Security Risks

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-001 | **SSRF via user-supplied URLs**: Attackers submit URLs targeting internal services (metadata endpoints, internal APIs) through API testing, accessibility scanning, visual testing capture, or Blaze exploration endpoints. | 4 | 4 | 16 (High) | `url_validator.py` validates all user URLs; blocks private IPs, metadata endpoints, file/ftp/data schemes; detects obfuscated IPs (hex, octal, decimal), DNS rebinding. Applied to 9 router files (v3.17.0). | 2x4=8 (Med) | Mitigate (maintain, add DNS resolution validation) | Security Team |
| RISK-2026-002 | **SQL injection via dynamic queries**: Malicious SQL in user inputs (test case names, search filters, sort parameters) could access or modify unauthorized data. | 3 | 5 | 15 (High) | Sort_by column whitelist in test cases CRUD (v3.17.0); parameterized queries via Supabase client and psycopg2; input sanitization in API endpoints. | 1x5=5 (Low) | Mitigate (maintain, extend whitelist to all query endpoints) | Engineering |
| RISK-2026-003 | **Cross-Site Scripting (XSS)**: User-generated content (test case names, descriptions, API response bodies) rendered in the browser without proper sanitization. | 3 | 3 | 9 (Med) | React's built-in XSS protection (JSX escaping); Content Security Policy via Nginx (`default.conf`); Monaco editor for code display (no raw HTML rendering). | 2x3=6 (Med) | Mitigate (add CSP reporting, audit dangerouslySetInnerHTML usage) | Engineering |
| RISK-2026-004 | **Insecure error responses leaking internal information**: Stack traces, file paths, or database error details exposed in API error responses. | 4 | 3 | 12 (High) | Error response sanitization removing `str(e)` from 100+ HTTPException details (v3.17.0); generic error messages returned to clients. | 2x3=6 (Med) | Mitigate (maintain, add error response testing) | Engineering |
| RISK-2026-005 | **Path traversal in file operations**: Attackers manipulate file paths in visual testing baselines, recordings, or HAR file uploads to access unauthorized files. | 3 | 4 | 12 (High) | Test_name validation in visual testing (v3.17.0); file operations restricted to designated directories. | 2x4=8 (Med) | Mitigate (add path canonicalization, restrict to chroot directories) | Engineering |

### 8.2 Access Control and Authentication Risks

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-006 | **API key exposure in logs or error messages**: BYOK API keys (OpenAI, Anthropic) accidentally logged or included in error responses. | 3 | 5 | 15 (High) | Fernet encryption for stored keys; frontend never stores keys; `sanitize_url_for_logging()` strips credentials; sensitive header masking in Chrome Extension. | 1x5=5 (Low) | Mitigate (maintain, add log scanning for key patterns) | Security Team |
| RISK-2026-007 | **Session hijacking via stolen JWT tokens**: Attacker obtains a valid JWT and impersonates the user. | 3 | 4 | 12 (High) | JWT expiry (1 hour); `secrets.token_urlsafe()` for session IDs (v3.17.0); TLS encryption in transit; rate limiting (100/min default, 10/min auth). | 2x4=8 (Med) | Mitigate (add token binding, implement refresh token rotation) | Security Team |
| RISK-2026-008 | **Privilege escalation via RBAC bypass**: User with Member role accesses Admin-only functionality due to missing permission checks. | 2 | 4 | 8 (Med) | `@require_permission` decorators on backend endpoints; `ProtectedRoute` with role hierarchy enforcement on frontend; `getUserRoleInOrg()` + `hasRequiredRole()` checks. | 1x4=4 (Low) | Mitigate (maintain, add automated RBAC testing) | Engineering |
| RISK-2026-009 | **Tenant isolation failure**: User in Organization A accesses data belonging to Organization B. | 2 | 5 | 10 (Med) | `TenantContextMiddleware` injects tenant context; all queries filtered by organization/project ID; Supabase Row Level Security. | 1x5=5 (Low) | Mitigate (maintain, add cross-tenant testing) | Engineering |
| RISK-2026-010 | **Brute-force authentication attacks**: Automated attempts to guess user credentials. | 4 | 3 | 12 (High) | Rate limiting (10/min for auth endpoints); account lockout after 5 failed attempts (15 min); after 15 attempts (manual reset); failed attempt logging. | 2x3=6 (Med) | Mitigate (maintain, add CAPTCHA after 3 failures) | Security Team |

### 8.3 Data Security Risks

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-011 | **Customer data exposure via AI/LLM providers**: Test content sent to OpenAI/Anthropic may be retained or used for training by the provider. | 3 | 4 | 12 (High) | AI off by default; BYOK architecture; input truncation for prompt injection prevention (v3.17.0); minimum necessary data sent. | 2x3=6 (Med) | Mitigate (enforce data processing agreements with providers, add data minimization filters) | Security Team |
| RISK-2026-012 | **Sensitive data in browser recordings**: Chrome Extension captures passwords, credit card numbers, or PII during recording sessions. | 3 | 4 | 12 (High) | Password fields masked as `[MASKED]` in content.js; sensitive headers masked in network captures; auto-dropdown scanning disabled (v3.13.3+). | 2x3=6 (Med) | Mitigate (add PII detection patterns, credit card regex masking) | Engineering |
| RISK-2026-013 | **Backup data breach**: Unauthorized access to database backups containing customer data. | 2 | 5 | 10 (Med) | AES-256 encryption at rest for backups; separate encryption key storage; geographic separation; access restricted to Operations + CISO. | 1x5=5 (Low) | Mitigate (maintain, add backup access alerting) | Operations |
| RISK-2026-014 | **Data leakage via client-side storage**: Sensitive data persisted in localStorage or sessionStorage accessible to XSS or browser extensions. | 3 | 3 | 9 (Med) | API keys never stored client-side; only `hasApiKey` boolean flags; Zustand stores use `persist` for non-sensitive state only; UTM params in sessionStorage (non-sensitive). | 2x3=6 (Med) | Mitigate (audit localStorage usage, add encryption for sensitive client state) | Engineering |

### 8.4 Third-Party and Supply Chain Risks

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-015 | **Dependency vulnerability in npm/Python packages**: A critical vulnerability in a third-party dependency is exploited before patching. | 4 | 3 | 12 (High) | Dependabot automated PRs; `npm audit` in CI; CodeQL scanning; Python dependency scanning; regular dependency updates. | 2x3=6 (Med) | Mitigate (maintain automated scanning, add SLA for critical CVE patching: 24 hours) | Engineering |
| RISK-2026-016 | **Supabase service outage**: Supabase Auth or Storage unavailability affects QAAI platform operations. | 2 | 4 | 8 (Med) | In-memory fallback for database operations; PostgreSQL direct connection as alternative; desktop SQLite for offline mode. | 2x3=6 (Med) | Mitigate (maintain fallbacks, evaluate self-hosted Supabase for enterprise) | Operations |
| RISK-2026-017 | **GitHub supply chain attack**: Compromised GitHub Action, NPM package, or container base image introduces malicious code. | 2 | 5 | 10 (Med) | Pinned GitHub Action versions; `npm audit` in CI; Docker multi-stage builds with specific base image versions; non-root container execution. | 1x5=5 (Low) | Mitigate (add SBOM generation, container image signing) | Engineering |

### 8.5 Operational and AI-Specific Risks

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-018 | **Resource exhaustion via performance testing**: Malicious or misconfigured load tests overwhelm production infrastructure. | 3 | 4 | 12 (High) | 10K VU cap; 1-hour duration cap; server-side execution requires Admin role (v3.17.0); rate limiting on API endpoints. | 2x3=6 (Med) | Mitigate (maintain caps, add per-tenant resource quotas) | Engineering |
| RISK-2026-019 | **LLM prompt injection**: Malicious content in test data or user inputs manipulates AI/LLM behavior to leak data or produce harmful outputs. | 3 | 3 | 9 (Med) | Input truncation for LLM calls (v3.17.0); AI budget control (max 3 AI calls per run); structured prompts with system instructions. | 2x3=6 (Med) | Mitigate (add output filtering, implement guardrails) | Engineering |
| RISK-2026-020 | **Key person dependency**: Critical platform knowledge concentrated in a small number of individuals. | 3 | 3 | 9 (Med) | Comprehensive documentation (270+ docs, CLAUDE.md); modular codebase architecture (11 frontend modules, 10 backend router groups); CI/CD automation. | 2x2=4 (Low) | Mitigate (maintain documentation, cross-training program) | Management |
| RISK-2026-021 | **Deployment pipeline compromise**: Attacker gains access to CI/CD pipeline and deploys malicious code to production. | 2 | 5 | 10 (Med) | GitHub branch protection rules; required PR reviews; CI/CD secrets in GitHub Secrets (encrypted); Coolify webhook authentication. | 1x5=5 (Low) | Mitigate (add deployment signing, restrict workflow permissions) | DevOps |
| RISK-2026-022 | **SSL/TLS certificate expiry**: Expired certificates cause service disruption or downgrade to insecure connections. | 2 | 3 | 6 (Med) | SSL verification enforced (removed `verify=False` in v3.17.0); HTTPS enforcement for non-localhost backends in Chrome Extension; Nginx HSTS headers. | 1x3=3 (Low) | Mitigate (automated certificate renewal, expiry monitoring) | Operations |

### 8.6 Fraud-Related Risks (CC3.3)

| Risk ID | Description | L | I | Score | Existing Controls | Residual Score | Treatment | Owner |
|---------|-------------|---|---|-------|------------------|----------------|-----------|-------|
| RISK-2026-023 | **Insider threat: unauthorized data access**: Employee or contractor with legitimate access exfiltrates customer data. | 2 | 5 | 10 (Med) | RBAC with least privilege; audit logging of all data access; quarterly access reviews; offboarding checklist with token revocation. | 1x5=5 (Low) | Mitigate (add DLP controls, behavioral analytics) | Security Team |
| RISK-2026-024 | **Test result manipulation**: User falsifies test results to meet compliance or quality metrics. | 2 | 3 | 6 (Med) | Audit trail records all test executions with immutable timestamps; version control for test cases; automated execution logs. | 1x3=3 (Low) | Accept (existing controls adequate) | Security Team |
| RISK-2026-025 | **License bypass or abuse**: User circumvents license gates to access enterprise features without authorization. | 3 | 2 | 6 (Med) | `LicenseGate` component wraps enterprise features; backend license validation via `/api/license`; feature flags server-side. | 2x2=4 (Low) | Accept (existing controls adequate) | Engineering |

## 9. Risk Assessment Cadence

### 9.1 Scheduled Assessments

| Assessment Type | Frequency | Scope | Responsible | Output |
|----------------|-----------|-------|-------------|--------|
| **Full Risk Assessment** | Annually (Q1) | All risk categories, all systems | Security Team + external assessor | Updated risk register, executive risk report |
| **Quarterly Risk Review** | Quarterly | All open risks, new risks since last review | Security Team | Risk register update, treatment status report |
| **Monthly Vulnerability Review** | Monthly | Automated scan results, new CVEs | Security Team + Engineering | Vulnerability status report, patching priorities |
| **Weekly Security Standup** | Weekly | Active incidents, high/critical risks, ongoing treatments | Security Team | Action items, escalations |

### 9.2 Event-Triggered Assessments

A risk assessment must be conducted within 5 business days of:

| Trigger | Scope |
|---------|-------|
| Security incident (Severity 1 or 2) | Full assessment of the affected domain |
| Major platform release (new features, architecture changes) | Threat model for new functionality |
| New third-party integration | Third-party risk assessment |
| Regulatory change affecting the platform | Compliance risk assessment |
| Significant infrastructure change | Infrastructure risk assessment |
| Customer security audit or penetration test findings | Targeted risk assessment based on findings |
| Merger, acquisition, or organizational restructuring | Full risk assessment |

### 9.3 Change Impact Assessment (CC3.4)

When evaluating changes that could significantly impact internal controls:

1. **Identify**: List all controls affected by the proposed change.
2. **Assess**: Evaluate whether the change increases, decreases, or has no effect on risk.
3. **Document**: Record the assessment in the change request (per Change Management Policy).
4. **Approve**: Changes that increase risk require Security Team review and CISO approval.
5. **Monitor**: Post-change monitoring for risk indicators per the post-change validation requirements.

## 10. Vulnerability Management

### 10.1 Continuous Vulnerability Scanning

| Tool | Type | Frequency | Scope |
|------|------|-----------|-------|
| **Dependabot** | Dependency vulnerability | Continuous (on commit) | npm packages, Python packages |
| **CodeQL** | Static application security testing (SAST) | On PR + weekly scheduled | JavaScript/TypeScript, Python |
| **npm audit** | npm vulnerability database | On CI pipeline run | Frontend dependencies |
| **Docker Scout / Trivy** | Container image scanning | On image build | Docker images |
| **Snyk** (recommended) | Comprehensive dependency and code scanning | Continuous | Full stack |

### 10.2 Vulnerability Severity and Response SLAs

| Severity | CVSS Score | Response SLA | Patching SLA |
|----------|-----------|-------------|--------------|
| Critical | 9.0 - 10.0 | 4 hours (acknowledge and assess) | 24 hours (patch or mitigate) |
| High | 7.0 - 8.9 | 24 hours | 7 days |
| Medium | 4.0 - 6.9 | 5 business days | 30 days |
| Low | 0.1 - 3.9 | 10 business days | 90 days |
| Informational | 0 | Logged | Next scheduled update |

### 10.3 Vulnerability Remediation Process

1. **Discovery**: Vulnerability identified via scanning tool, penetration test, security researcher report, or internal review.
2. **Triage**: Security Team assesses severity, exploitability, and affected systems within the response SLA.
3. **Prioritize**: Rank based on CVSS score, asset criticality, and exposure (internet-facing vs internal).
4. **Remediate**: Apply patch, update dependency, implement workaround, or accept risk (with documentation).
5. **Verify**: Confirm the vulnerability is resolved via re-scan or manual verification.
6. **Document**: Update the vulnerability tracking system and risk register as needed.
7. **Communicate**: Notify stakeholders of remediation status.

### 10.4 Known Vulnerability Tracking

All known vulnerabilities are tracked in a vulnerability register with:

- CVE identifier (if applicable).
- Affected component and version.
- Severity and CVSS score.
- Discovery date and discovery method.
- Remediation status and expected completion date.
- Owner and assignee.
- Compensating controls (if remediation is deferred).

## 11. Penetration Testing

### 11.1 Annual Penetration Testing

A comprehensive penetration test is conducted at least annually by a qualified external vendor. The test must cover:

| Test Area | Scope | Methodology |
|-----------|-------|-------------|
| **External Network** | Internet-facing infrastructure, public APIs, web application | OWASP Testing Guide, PTES |
| **Web Application** | QAAI frontend and backend API endpoints | OWASP Top 10, API Security Top 10 |
| **Authentication and Authorization** | Login, JWT, RBAC, MFA, session management | Credential testing, privilege escalation |
| **API Security** | All API router groups (recorder, test management, API testing, performance, AI, accessibility, visual, Salesforce, exploration, platform) | Fuzzing, injection, authorization bypass |
| **Infrastructure** | Servers, databases, containers, Nginx, PgBouncer | CIS Benchmarks, container escape |
| **Social Engineering** (optional) | Phishing, pretexting | PTES Social Engineering |

### 11.2 Penetration Test Requirements

1. The vendor must hold relevant certifications (CREST, OSCP, CEH, or equivalent).
2. Testing must be conducted against the staging environment (production testing only with explicit CISO approval and during maintenance window).
3. Rules of engagement must be documented: scope, timeline, communication plan, escalation procedures.
4. The vendor provides a detailed report within 2 weeks of test completion.
5. The report includes: executive summary, methodology, findings with severity ratings, evidence, and remediation recommendations.

### 11.3 Penetration Test Remediation

1. Critical and High findings must be remediated within the SLAs defined in Section 10.2.
2. Medium and Low findings are added to the risk register and remediation backlog.
3. A remediation retest is conducted within 30 days of completing Critical/High remediation.
4. Penetration test reports and remediation evidence are retained as SOC 2 audit artifacts.

### 11.4 Additional Security Testing

| Test Type | Frequency | Scope |
|-----------|-----------|-------|
| Internal vulnerability scan | Monthly | Internal network, databases, servers |
| Red team exercise | Annually (recommended) | Simulated attack across all vectors |
| Security code review | Per PR (automated) + quarterly (manual deep-dive) | Application code |
| Configuration audit | Quarterly | Nginx, PgBouncer, Helm, Docker, CI/CD |
| Disaster recovery test | Annually | Full DR scenario per Incident Response Plan |

## 12. Risk Acceptance and Escalation

### 12.1 Risk Acceptance Authority

| Risk Level | Acceptance Authority | Documentation |
|------------|---------------------|---------------|
| Low (1-5) | Engineering Lead or Security Team member | Risk register entry |
| Medium (6-11) | CISO | Risk register entry + risk acceptance form |
| High (12-19) | CISO + VP of Engineering | Risk acceptance form + executive briefing |
| Critical (20-25) | CEO + CISO | Board notification + formal risk acceptance with compensating controls |

### 12.2 Risk Acceptance Form

Accepted risks must be documented with:

```
RISK ACCEPTANCE FORM
====================

Risk ID:            RISK-YYYY-NNN
Risk Description:   [Description]
Risk Score:         [Likelihood x Impact = Score]
Risk Level:         [Critical / High / Medium / Low]

BUSINESS JUSTIFICATION
----------------------
Why this risk is being accepted:
[Detailed explanation]

Alternatives considered:
[What mitigation options were evaluated and why they were not chosen]

COMPENSATING CONTROLS
---------------------
1. [Control that partially mitigates the accepted risk]
2. [Additional monitoring or detection in place]

ACCEPTANCE
----------
Accepted By:        [Name, Role]
Acceptance Date:    [Date]
Review Date:        [When the acceptance will be re-evaluated — maximum 12 months]
Conditions:         [Any conditions that would invalidate the acceptance]
```

### 12.3 Escalation Procedures

| Condition | Escalation Path | Timeline |
|-----------|----------------|----------|
| New Critical risk identified | Security Team -> CISO -> CEO | Immediately |
| New High risk identified | Security Team -> CISO | Within 24 hours |
| Risk score increases to Critical | Risk Owner -> CISO -> CEO | Within 24 hours |
| Treatment plan behind schedule (Critical/High) | Risk Owner -> CISO | At next weekly standup |
| Treatment plan behind schedule (Medium) | Risk Owner -> Security Team Lead | At next quarterly review |
| Risk acceptance expiry without renewal | Security Team -> CISO | 30 days before expiry |
| Multiple Medium risks in same category | Security Team -> CISO | At next quarterly review |
| External audit finding related to a risk | Security Team -> CISO -> CEO | Within 5 business days |

### 12.4 Risk Reporting

| Report | Audience | Frequency | Content |
|--------|----------|-----------|---------|
| Risk Dashboard | Security Team | Real-time | All open risks, treatment status, vulnerability metrics |
| Risk Summary | CISO | Weekly | Critical/High risk status, new risks, escalations |
| Risk Report | Executive Leadership | Quarterly | Risk posture overview, trend analysis, top risks, treatment progress |
| Risk Attestation | SOC 2 Auditors | Annually | Full risk register, assessment methodology, treatment evidence |
| Board Risk Brief | Board of Directors | Semi-annually | Strategic risk overview, risk appetite alignment, key decisions |

## 13. Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Executive Officer | _________________ | _________________ | ____/____/________ |
| Chief Information Security Officer | _________________ | _________________ | ____/____/________ |
| VP of Engineering | _________________ | _________________ | ____/____/________ |
| Head of Legal/Compliance | _________________ | _________________ | ____/____/________ |

## 14. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | Security Team | Initial policy creation for SOC 2 Type II certification |
