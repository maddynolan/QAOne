# Change Management Policy

| Field | Value |
|-------|-------|
| **Document Title** | Change Management Policy |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 7, 2026 |
| **Owner** | Security Team |
| **Classification** | Internal |
| **SOC 2 Controls** | CC8.1 |
| **Approved By** | See Approval Signatures (Section 12) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Change Types and Classification](#3-change-types-and-classification)
4. [Change Request Process](#4-change-request-process)
5. [Approval Workflow](#5-approval-workflow)
6. [Risk Assessment](#6-risk-assessment)
7. [Testing and Validation](#7-testing-and-validation)
8. [Deployment Procedures](#8-deployment-procedures)
9. [Rollback Procedures](#9-rollback-procedures)
10. [Change Freeze Periods](#10-change-freeze-periods)
11. [Post-Change Validation](#11-post-change-validation)
12. [Approval Signatures](#12-approval-signatures)
13. [Version History](#13-version-history)

---

## 1. Purpose

This Change Management Policy establishes a structured and consistent process for managing changes to the QAAI/Flowstral platform, its infrastructure, and supporting systems. The policy ensures that changes are planned, tested, approved, and implemented in a controlled manner to minimize risk to service availability, data integrity, and security.

This policy supports SOC 2 Trust Services Criterion CC8.1, which requires that the entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.

## 2. Scope

This policy applies to all changes affecting:

- **Application Software**: QAAI frontend (React/TypeScript), backend (Python/FastAPI), Electron desktop app, Chrome extension, and Flowstral engine.
- **Infrastructure**: Servers, containers, networks, load balancers, DNS, and CDN configurations.
- **Databases**: PostgreSQL schema changes, migrations, Supabase configuration, PgBouncer settings.
- **Configuration**: Environment variables, Nginx configuration, Helm chart values, Docker Compose files, CI/CD pipelines.
- **Security Controls**: Firewall rules, RBAC permissions, encryption settings, rate limiting, SSRF validation rules.
- **Third-Party Integrations**: Changes to integrations with Supabase, OpenAI, Anthropic, GitHub, Jira, or other external services.
- **Documentation**: Security policies, runbooks, and operational procedures (when changes have compliance implications).

## 3. Change Types and Classification

### 3.1 Change Type Definitions

| Change Type | Risk Level | Approval | Lead Time | Examples |
|-------------|-----------|----------|-----------|---------|
| **Standard** | Low (pre-approved) | Pre-approved by Change Advisory Board (CAB) | None | Dependency version updates (patch), documentation updates, log level changes, UI text corrections, adding non-sensitive environment variables |
| **Normal** | Medium | Requires review and approval | 2+ business days | New features, bug fixes, database migrations, API endpoint additions, configuration changes, integration updates |
| **Emergency** | High (post-approval) | Approved by on-call engineer + post-incident review | Immediate | Security patches for active vulnerabilities, critical bug fixes affecting production availability, data loss prevention |

### 3.2 Change Classification Criteria

To determine the change type, evaluate the following criteria:

| Criterion | Standard | Normal | Emergency |
|-----------|----------|--------|-----------|
| Service impact | No impact | Potential brief impact | Active outage or security breach |
| User-facing changes | No | Yes | Yes |
| Database schema changes | No | Yes | If required to resolve incident |
| Security control changes | No | Yes | Yes (security patch) |
| Rollback complexity | Simple (revert commit) | Moderate (may need migration rollback) | Varies |
| Testing required | Automated CI only | Full CI + staging validation | Minimum viable testing |
| Regulatory impact | None | Possible | Yes (if security-related) |

## 4. Change Request Process

### 4.1 Change Request Template

All Normal and Emergency changes must be documented using the following template:

```
CHANGE REQUEST
==============

CR Number:          CR-YYYY-NNN
Date Submitted:     YYYY-MM-DD
Requested By:       [Name, Role]
Change Type:        [Standard / Normal / Emergency]
Priority:           [Low / Medium / High / Critical]

DESCRIPTION
-----------
Summary:            [One-line summary of the change]
Detailed Description: [What is being changed and why]
Business Justification: [Why this change is needed]
Affected Systems:   [List of affected components: frontend, backend, database, infrastructure]
Affected Users:     [Which user roles or segments are affected]

TECHNICAL DETAILS
-----------------
Repository:         maddynolan/QAOne
Branch:             [Feature branch name]
Pull Request:       [PR URL]
Files Changed:      [Key files being modified]
Database Migrations: [Yes/No - if yes, list migration files]
Environment Variables: [Any new or changed env vars]
Dependencies:       [New dependencies added or updated]

RISK ASSESSMENT
---------------
Risk Level:         [Low / Medium / High / Critical]
Likelihood:         [1-5]
Impact:             [1-5]
Risk Score:         [Likelihood x Impact]
Mitigation:         [Steps to reduce risk]
Rollback Plan:      [How to revert if the change fails]

TESTING
-------
Unit Tests:         [Added/Updated/Existing coverage]
Integration Tests:  [Added/Updated/Existing coverage]
Staging Validation: [Steps performed in staging]
Security Review:    [Required? Completed?]

SCHEDULE
--------
Planned Start:      [Date/Time]
Planned End:        [Date/Time]
Maintenance Window: [If applicable]
Change Freeze Check: [Confirmed not in freeze period]

APPROVALS
---------
Developer:          [Name] - [Date]
Reviewer:           [Name] - [Date]
CAB/Manager:        [Name] - [Date]  (Normal changes)
CISO:               [Name] - [Date]  (Security changes)
```

### 4.2 Standard Change Catalog

The following changes are pre-approved and do not require individual change requests:

| ID | Standard Change | Conditions |
|----|----------------|------------|
| SC-001 | Dependency patch version updates | Automated by Dependabot; CI passes; no breaking changes |
| SC-002 | Documentation updates (`docs/`) | No code changes; no compliance impact |
| SC-003 | UI text, label, or tooltip corrections | No functional change; no new strings requiring translation |
| SC-004 | Log level adjustments | Non-production environments only; or production if reducing verbosity |
| SC-005 | Adding non-sensitive environment variables | No secrets; no production configuration change |
| SC-006 | Grafana dashboard modifications | Monitoring only; no alerting rule changes |
| SC-007 | Development environment configuration | No production or staging impact |
| SC-008 | Test case additions (no code changes) | Adding tests that do not modify application code |

Standard changes must still follow the CI/CD pipeline and pass all automated checks.

## 5. Approval Workflow

### 5.1 Standard Changes

```
Developer
    |
    v
Automated CI Pipeline (.github/workflows/ci.yml)
    |  [Build + Test + Security Scan]
    v
Auto-Merge (if all checks pass)
    |
    v
Deploy to Staging (automatic)
    |
    v
Deploy to Production (automatic via deploy-coolify.yml)
```

### 5.2 Normal Changes

```
Developer
    |
    v
Pull Request Created
    |
    v
Code Review (1+ peer reviewer required)
    |  [Review checklist: functionality, security, tests, documentation]
    v
Automated CI Pipeline (.github/workflows/ci.yml)
    |  [Build + Test + Lint + Security Scan (CodeQL)]
    v
Reviewer Approval
    |
    v
Manager/CAB Approval (for High risk or security-impacting changes)
    |
    v
Merge to Main Branch
    |
    v
Deploy to Staging (.github/workflows/staging.yml)
    |
    v
Staging Validation (manual or automated smoke tests)
    |
    v
Deploy to Production (.github/workflows/deploy-coolify.yml)
    |  [Build Docker image + Push to GHCR + Webhook deploy to Coolify]
    v
Post-Change Validation (Section 11)
```

### 5.3 Emergency Changes

```
On-Call Engineer identifies critical issue
    |
    v
Verbal/Chat Authorization from Engineering Lead or CISO
    |  [Document: who authorized, when, why]
    v
Implement Fix (minimum viable change)
    |
    v
Expedited CI Pipeline (may skip non-critical checks)
    |
    v
Deploy to Production (with monitoring)
    |
    v
Immediate Post-Change Validation
    |
    v
Post-Incident Review (within 24 hours)
    |  [Document: root cause, fix details, full CR created retroactively]
    v
Retroactive Change Request Filed
    |
    v
Lessons Learned and Process Improvement
```

### 5.4 Approval Authority Matrix

| Change Type | Risk Level | Approver(s) |
|-------------|-----------|-------------|
| Standard | Low | Pre-approved (no individual approval needed) |
| Normal | Low | 1 peer reviewer |
| Normal | Medium | 1 peer reviewer + Engineering Lead |
| Normal | High | 1 peer reviewer + Engineering Lead + CISO |
| Normal (security) | Any | 1 peer reviewer + Security Team member + CISO |
| Normal (database migration) | Any | 1 peer reviewer + DBA or Operations |
| Emergency | Any | On-call engineer (verbal) + retroactive full approval within 24 hours |

## 6. Risk Assessment

### 6.1 Risk Assessment Matrix

All Normal changes must include a risk assessment using the following matrix:

**Likelihood Scale:**

| Score | Likelihood | Description |
|-------|-----------|-------------|
| 1 | Very Low | Extremely unlikely to cause issues; change is well-understood |
| 2 | Low | Unlikely to cause issues; similar changes have been made before |
| 3 | Medium | Possible issues; change involves moderate complexity |
| 4 | High | Likely to cause some issues; change is complex or affects critical paths |
| 5 | Very High | Almost certain to cause issues; untested technology or fundamental architecture change |

**Impact Scale:**

| Score | Impact | Description |
|-------|--------|-------------|
| 1 | Negligible | No user impact; internal tools only |
| 2 | Minor | Brief degradation; workaround available; affects <5% of users |
| 3 | Moderate | Service degradation for some users; no data loss; recovery <1 hour |
| 4 | Major | Significant outage; affects majority of users; potential data integrity concerns |
| 5 | Critical | Complete service outage; data loss or corruption; security breach; regulatory impact |

**Risk Score = Likelihood x Impact:**

| Risk Score | Level | Required Action |
|------------|-------|-----------------|
| 1-5 | Low | Standard approval workflow |
| 6-11 | Medium | Engineering Lead approval; staging validation mandatory |
| 12-19 | High | Engineering Lead + CISO approval; full regression testing; maintenance window |
| 20-25 | Critical | Full CAB review; executive approval; dedicated rollback team on standby |

### 6.2 Security-Specific Risk Factors

Changes that involve any of the following automatically receive a minimum Medium risk rating and require Security Team review:

1. Authentication or authorization logic (RBAC, JWT, session management).
2. Encryption, key management, or credential handling.
3. Input validation, SSRF prevention, or SQL injection safeguards.
4. Rate limiting, CORS, or other middleware security controls.
5. User data access patterns or tenant isolation boundaries.
6. Third-party integration authentication (OAuth, API keys).
7. Audit logging or compliance reporting.
8. Network configuration, firewall rules, or TLS settings.
9. Container security settings, Dockerfile changes, or Nginx configuration.
10. Database schema changes affecting data with Confidential or Restricted classification.

## 7. Testing and Validation

### 7.1 Testing Requirements by Change Type

| Test Type | Standard | Normal (Low) | Normal (Med/High) | Emergency |
|-----------|----------|-------------|-------------------|-----------|
| Automated unit tests | Required (CI) | Required (CI) | Required (CI) | Best effort |
| Automated integration tests | Required (CI) | Required (CI) | Required (CI) | Best effort |
| Linting and type checks | Required (CI) | Required (CI) | Required (CI) | Optional |
| Security scanning (CodeQL) | Required (CI) | Required (CI) | Required (CI) | Post-deploy |
| Dependency vulnerability scan | Required (CI) | Required (CI) | Required (CI) | Post-deploy |
| Manual code review | Not required | Required | Required | Post-deploy |
| Staging deployment test | Not required | Recommended | Required | Not required |
| Performance impact assessment | Not required | Not required | Required (if perf-sensitive) | Not required |
| Accessibility impact check | Not required | Not required | Required (if UI change) | Not required |
| Security-specific test | Not required | If security-related | Required | Post-deploy |
| Full regression test | Not required | Not required | Required (Critical risk) | Not required |

### 7.2 CI/CD Pipeline Integration

The QAAI CI/CD pipeline (`.github/workflows/ci.yml`) automatically performs:

1. **Build**: Compile frontend (`npm run build`) and verify backend syntax.
2. **Test**: Run unit and integration test suites.
3. **Lint**: ESLint (frontend), Python linting (backend).
4. **Security Scan**: CodeQL analysis for vulnerability detection.
5. **Dependency Check**: `npm audit` and Python dependency scanning via Dependabot.
6. **Docker Build**: Build and tag Docker images.
7. **Staging Deploy**: Automatic deployment to staging environment (`.github/workflows/staging.yml`).
8. **Production Deploy**: Triggered on merge to main via Coolify webhook (`.github/workflows/deploy-coolify.yml`).

All pipeline stages must pass before a change can be merged. Pipeline failures block the merge and must be resolved.

### 7.3 Staging Environment Requirements

The staging environment must:

1. Mirror production configuration as closely as possible (same Docker images, similar database schema, equivalent environment variables with test values).
2. Use a separate database instance (not production data).
3. Have its own Supabase project for authentication testing.
4. Be accessible only to authorized team members.
5. Generate its own audit logs for change validation review.

## 8. Deployment Procedures

### 8.1 Production Deployment Process

The standard production deployment follows the Coolify-based pipeline:

1. **Pre-Deployment Checks**:
   - Verify CI pipeline passed on the merge commit.
   - Confirm staging validation is complete (for Normal Medium/High changes).
   - Verify the change is not in a change freeze period (Section 10).
   - Confirm rollback plan is documented and understood.
   - Notify relevant stakeholders of upcoming deployment.

2. **Deployment Execution**:
   - CI/CD pipeline builds Docker image and pushes to GitHub Container Registry (GHCR).
   - Coolify webhook triggers deployment of the new image.
   - Health check endpoint (`/health`) confirms the new version is running.
   - Database migrations run automatically via `auto_migrate.py` on startup.

3. **Post-Deployment**:
   - Verify health endpoint returns 200.
   - Check Prometheus metrics for error rate spikes.
   - Monitor Grafana dashboards for anomalies.
   - Perform smoke tests on critical paths (authentication, test execution, API testing).
   - Confirm WebSocket connections re-establish.
   - Execute post-change validation (Section 11).

### 8.2 Electron Desktop Release Process

Electron releases follow a separate process as documented in the Push & Release Procedure:

1. Merge changes to main branch.
2. Build webapp: `npm run build:webapp` (from `flowstral-desktop/`).
3. Build Electron installers: `npm run build:win`.
4. Create GitHub release with assets (Setup.exe, Portable.exe, latest.yml) via `gh release create`.
5. Version bump in `flowstral-desktop/package.json`.
6. Verify auto-update feed (`latest.yml`) is correctly published.

### 8.3 Database Migration Procedures

Database migrations require special handling:

1. **Migration Files**: Located in `supabase/migrations/` (numbered sequentially, e.g., `034_ai_settings.sql`).
2. **Pre-Migration**:
   - Back up the database before applying migrations.
   - Review migration SQL for destructive operations (DROP, DELETE, ALTER with data loss).
   - Test migration on staging first.
3. **Execution**: Migrations run automatically on application startup via `auto_migrate.py`.
4. **Verification**: Confirm table schemas match expected state. Verify data integrity.
5. **Rollback**: If migration fails, restore from backup. Create a reverse migration script for planned rollbacks.

### 8.4 Chrome Extension Release Process

Chrome Extension updates follow Chrome Web Store guidelines:

1. Version bump in `flowstral-extension/manifest.json`.
2. Build the extension package.
3. Test in development mode across Chromium browsers.
4. Submit to Chrome Web Store for review.
5. Monitor review status and address any rejection feedback.
6. Verify auto-update propagation to installed extensions.

## 9. Rollback Procedures

### 9.1 Application Rollback

| Method | When to Use | Procedure | Recovery Time |
|--------|-------------|-----------|---------------|
| **Git Revert** | Code change causing issues, no data impact | `git revert <commit>`, push, deploy via CI/CD | 15-30 minutes |
| **Docker Image Rollback** | Rapid revert needed, known-good image exists | Update Coolify to deploy previous GHCR image tag | 5-10 minutes |
| **Feature Flag** | Feature-specific issue, other changes are fine | Disable feature flag in configuration | 1-5 minutes |
| **Environment Variable** | Configuration change causing issues | Revert env var in Coolify/deployment config, restart | 5-10 minutes |

### 9.2 Database Rollback

| Method | When to Use | Procedure | Recovery Time |
|--------|-------------|-----------|---------------|
| **Reverse Migration** | Schema change causing issues, data intact | Apply reverse migration SQL script | 10-30 minutes |
| **Point-in-Time Recovery** | Data corruption or loss | Restore PostgreSQL from WAL backup to specific timestamp | 30-60 minutes |
| **Full Backup Restore** | Catastrophic failure | Restore from latest backup (30-day rolling) | 1-4 hours |

### 9.3 Infrastructure Rollback

| Method | When to Use | Procedure | Recovery Time |
|--------|-------------|-----------|---------------|
| **Nginx Config Revert** | Reverse proxy or header change causing issues | Restore previous `nginx/default.conf`, reload Nginx | 2-5 minutes |
| **Helm Rollback** | Kubernetes deployment issue | `helm rollback qaai <revision>` | 5-15 minutes |
| **DNS Revert** | DNS change causing routing issues | Restore previous DNS records | 5-60 minutes (TTL dependent) |

### 9.4 Rollback Decision Criteria

A rollback should be initiated when:

1. The change causes production errors exceeding the baseline error rate by 5x.
2. The health endpoint (`/health`) returns non-200 responses.
3. Critical functionality (authentication, test execution, data persistence) is impaired.
4. A security vulnerability is introduced by the change.
5. The change causes data corruption or loss.
6. Customer-reported issues directly attributable to the change exceed acceptable thresholds.

The on-call engineer has authority to initiate rollback without additional approval. All rollbacks are documented and reviewed.

## 10. Change Freeze Periods

### 10.1 Scheduled Freeze Periods

| Freeze Period | Duration | Reason | Exceptions |
|--------------|----------|--------|------------|
| Pre-Audit Freeze | 2 weeks before SOC 2 audit start | Ensure stable environment for auditor review | Emergency security patches only |
| End-of-Quarter Freeze | Last 3 business days of each quarter | Minimize risk during reporting period | Emergency changes only |
| Major Holiday Freeze | Dec 24 - Jan 2 (annually) | Reduced staffing for monitoring and incident response | Emergency changes only |
| Post-Incident Freeze | 48 hours after Severity 1 incident resolution | Ensure stability after major incident | Fixes for the triggering incident only |

### 10.2 Freeze Period Rules

1. During a freeze period, only Emergency changes (as defined in Section 3.1) may be deployed to production.
2. Normal and Standard changes may continue to be developed, reviewed, and tested in staging but must not be deployed to production.
3. The Engineering Lead or CISO may declare an unscheduled freeze at any time if conditions warrant.
4. The CISO has authority to lift a freeze early if the justification no longer applies.
5. All freeze periods and exceptions are logged.

### 10.3 Freeze Period Notifications

1. Scheduled freezes are announced at least 2 weeks in advance via email and team communication channels.
2. Unscheduled freezes are announced immediately with the reason and expected duration.
3. Freeze lifts are announced when the freeze period ends.

## 11. Post-Change Validation

### 11.1 Validation Requirements

All production changes require post-change validation within 1 hour of deployment:

| Validation Type | Standard Changes | Normal Changes | Emergency Changes |
|----------------|-----------------|----------------|-------------------|
| Health check endpoint | Automated | Automated | Manual + Automated |
| Error rate monitoring | Automated (15 min) | Automated (30 min) | Manual (60 min) |
| Functional smoke test | Not required | Required | Required |
| Security scan | Not required | Required (security changes) | Within 24 hours |
| Performance baseline | Not required | Required (perf-sensitive) | Within 24 hours |
| User impact assessment | Not required | Required | Required |

### 11.2 Smoke Test Checklist

The following critical paths must be verified after production deployment:

1. **Authentication**: Login, logout, token refresh, MFA verification.
2. **Test Case Management**: Create, read, update, delete test cases via `/test-cases` API.
3. **Test Execution**: Start and complete a test run via `/test-runs` API.
4. **API Testing**: Execute an API request via `/api/v2/testing/execute`.
5. **WebSocket Connectivity**: Verify WebSocket connections establish and receive heartbeats.
6. **Dashboard**: Verify dashboard loads with metrics via `/dashboard` API.
7. **Audit Logging**: Verify actions are logged via `/api/audit/logs`.
8. **Health Endpoint**: `GET /health` returns 200 with version information.

### 11.3 Monitoring Baselines

Post-change monitoring compares against established baselines:

| Metric | Baseline Source | Alert Threshold |
|--------|----------------|-----------------|
| HTTP error rate (5xx) | 7-day rolling average | >2x baseline |
| Response time (p95) | 7-day rolling average | >1.5x baseline |
| CPU utilization | 7-day rolling average | >80% sustained |
| Memory utilization | 7-day rolling average | >85% sustained |
| Database connection pool | PgBouncer metrics | >80% pool utilization |
| WebSocket connection count | 7-day rolling average | <50% baseline (drop) |
| Authentication failure rate | 7-day rolling average | >3x baseline |

### 11.4 Change Success Criteria

A change is considered successful when:

1. All post-change validation checks pass.
2. Error rates remain within acceptable thresholds for 1 hour post-deployment.
3. No rollback was required.
4. No security vulnerabilities were introduced (confirmed by security scan if applicable).
5. No customer-reported issues attributable to the change within 24 hours.

If any success criterion is not met, the change is flagged for review and potential rollback per Section 9.

## 12. Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Executive Officer | _________________ | _________________ | ____/____/________ |
| Chief Information Security Officer | _________________ | _________________ | ____/____/________ |
| VP of Engineering | _________________ | _________________ | ____/____/________ |
| Head of Operations | _________________ | _________________ | ____/____/________ |

## 13. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | Security Team | Initial policy creation for SOC 2 Type II certification |
