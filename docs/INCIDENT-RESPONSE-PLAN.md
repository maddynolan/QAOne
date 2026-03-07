# Incident Response Plan -- QAAI/Flowstral Platform

> **Classification:** CONFIDENTIAL -- Internal Use Only
> **Owner:** Security & Operations Team
> **Last Updated:** 2026-03-06
> **Review Cycle:** Quarterly (next review: 2026-06-06)
> **Applies To:** QAAI/Flowstral SaaS, On-Prem, and Hybrid deployments

---

## Table of Contents

1. [Severity Classification](#1-severity-classification)
2. [Notification Procedures](#2-notification-procedures)
3. [Containment Procedures](#3-containment-procedures)
4. [Evidence Preservation](#4-evidence-preservation)
5. [Recovery Procedures](#5-recovery-procedures)
6. [Post-Incident Review](#6-post-incident-review)
7. [Breach Notification Timeline](#7-breach-notification-timeline)
8. [Appendices](#8-appendices)

---

## 1. Severity Classification

### Severity Levels

| Level | Name | Description | Examples | Response Time | Resolution Target |
|-------|------|-------------|----------|---------------|-------------------|
| **P1** | Critical | Data breach, full platform outage, active exploitation | Confirmed data exfiltration; all services down; ransomware; compromised production database; leaked API keys with confirmed abuse | **15 minutes** | 4 hours |
| **P2** | High | Partial outage, confirmed security vulnerability, data integrity risk | Single service outage (recorder, API testing); unpatched CVE with known exploit; authentication bypass discovered; database corruption in one tenant | **30 minutes** | 8 hours |
| **P3** | Medium | Degraded performance, non-critical bug affecting functionality, potential vulnerability | Elevated error rates (>5%); slow response times (>5s p95); non-exploitable vulnerability; background job failures; WebSocket connection drops | **2 hours** | 48 hours |
| **P4** | Low | Cosmetic issues, documentation errors, minor UX inconsistencies | UI alignment issues; typos in error messages; stale documentation; non-functional tooltip; log noise | **1 business day** | Next sprint |

### Severity Decision Matrix

Use this matrix when the severity is ambiguous:

| Factor | P1 | P2 | P3 | P4 |
|--------|----|----|----|----|
| Users affected | All / majority | Significant subset | Small subset | Individual |
| Data exposure | Confirmed breach | Potential exposure | No data risk | None |
| Revenue impact | Direct revenue loss | Feature unavailable | Workaround exists | No impact |
| Security posture | Active exploitation | Exploitable vuln | Theoretical risk | Informational |
| Reputational risk | Public/media exposure | Customer-facing | Internal only | None |
| Regulatory impact | Reportable breach | Possible reporting | No obligation | None |

> **Escalation rule:** When in doubt, classify one level higher. Downgrade after investigation confirms lower severity.

---

## 2. Notification Procedures

### 2.1 Escalation Matrix

Fill in names, phone numbers, and email addresses for your organization:

| Role | P1 (Critical) | P2 (High) | P3 (Medium) | P4 (Low) |
|------|---------------|-----------|-------------|----------|
| On-Call Engineer | Immediate | Immediate | Within 2h | Next business day |
| Engineering Lead | Immediate | Within 30m | FYI (async) | -- |
| VP Engineering / CTO | Within 15m | Within 1h | -- | -- |
| CEO / Founder | Within 30m | FYI (async) | -- | -- |
| Security Officer | Immediate | Within 30m | FYI (async) | -- |
| Legal Counsel | Within 1h | As needed | -- | -- |
| Customer Success Lead | Within 1h | Within 2h | As needed | -- |
| Data Protection Officer | Within 1h (if breach) | As needed | -- | -- |

### Contact Directory

| Role | Name | Phone | Email | Backup |
|------|------|-------|-------|--------|
| On-Call Engineer | _______________ | _______________ | _______________ | _______________ |
| Engineering Lead | _______________ | _______________ | _______________ | _______________ |
| VP Engineering / CTO | _______________ | _______________ | _______________ | _______________ |
| CEO / Founder | _______________ | _______________ | _______________ | _______________ |
| Security Officer | _______________ | _______________ | _______________ | _______________ |
| Legal Counsel | _______________ | _______________ | _______________ | _______________ |
| Customer Success Lead | _______________ | _______________ | _______________ | _______________ |
| Data Protection Officer | _______________ | _______________ | _______________ | _______________ |

### 2.2 Communication Channels

| Channel | Purpose | Severity |
|---------|---------|----------|
| PagerDuty / Opsgenie | Primary on-call alerting | P1, P2 |
| Dedicated Slack channel (`#incident-response`) | Real-time coordination during active incident | P1, P2, P3 |
| Email distribution list (`security@___`) | Formal notifications, post-incident summaries | All |
| Status page (e.g., statuspage.io) | Public customer-facing updates | P1, P2 |
| Phone / video bridge | War-room for active P1 incidents | P1 |
| Jira / Linear ticket | Tracking, audit trail, post-incident tasks | All |

### 2.3 Customer Notification Timelines

| Severity | Initial Notice | Update Frequency | Resolution Notice |
|----------|---------------|-------------------|-------------------|
| **P1** | Within 1 hour of confirmation | Every 30 minutes during active incident | Within 2 hours of resolution |
| **P2** | Within 4 hours | Every 2 hours during active incident | Within 4 hours of resolution |
| **P3** | Within 24 hours (if customer-facing) | Daily until resolved | Within 24 hours of resolution |
| **P4** | Release notes only | -- | Release notes |

### Customer Communication Templates

**P1/P2 Initial Notice:**
```
Subject: [QAAI Platform] Service Incident - [Brief Description]

We are aware of an issue affecting [describe affected service/capability].
Our engineering team is actively investigating.

Impact: [What customers may experience]
Start Time: [UTC timestamp]
Current Status: Investigating

We will provide updates every [30 minutes / 2 hours].

For urgent inquiries: [support contact]
```

**Resolution Notice:**
```
Subject: [QAAI Platform] Resolved - [Brief Description]

The incident affecting [service] has been resolved.

Duration: [start] to [end] ([total duration])
Root Cause: [brief, non-technical summary]
Impact: [what was affected, number of users/tenants]

We will publish a detailed post-incident report within [48 hours / 5 business days].
```

---

## 3. Containment Procedures

### 3.1 Data Breach

**Trigger:** Confirmed or suspected unauthorized access to customer data, PII, test artifacts, or credentials.

**Immediate Actions (first 30 minutes):**

- [ ] Assign Incident Commander (IC) and open war-room channel
- [ ] Determine scope: which tenants, data types, and time window are affected
- [ ] Isolate affected systems from network (do NOT power off -- preserve evidence)
- [ ] Revoke all active API tokens and sessions for affected tenants
- [ ] Rotate Supabase service keys and JWT signing secrets
- [ ] Disable affected user accounts pending investigation
- [ ] Enable enhanced logging on all remaining systems
- [ ] Notify Security Officer and Legal Counsel

**Platform-Specific Steps:**

- [ ] Revoke Fernet-encrypted BYOK API keys for affected orgs (`ai_encrypted_keys` table)
- [ ] Invalidate all active JWT tokens (rotate `JWT_SECRET` in environment)
- [ ] Review `audit_logs` table for unauthorized actions in the affected time window
- [ ] Check Supabase auth logs for unusual sign-in patterns
- [ ] Review `RateLimitMiddleware` logs for bypass attempts
- [ ] If on-prem: coordinate with customer IT team for network isolation
- [ ] If SaaS: isolate affected tenant database rows via `TenantContextMiddleware`

**DO NOT:**

- [ ] Power off or reboot affected servers before forensic capture
- [ ] Delete or modify log files
- [ ] Communicate externally without Legal/DPO approval
- [ ] Attempt to "fix" the vulnerability before evidence is preserved

### 3.2 DDoS / Volumetric Attack

**Trigger:** Abnormal traffic volume, service degradation correlated with traffic spike, monitoring alerts.

**Immediate Actions:**

- [ ] Confirm attack vs. legitimate traffic spike (check analytics, recent marketing campaigns)
- [ ] Enable WAF rules on CDN / reverse proxy (Cloudflare, AWS WAF, or equivalent)
- [ ] Activate rate limiting escalation in `RateLimitMiddleware`:
  - Default: 100/min -> reduce to 30/min
  - Auth endpoints: 10/min -> reduce to 3/min
  - AI endpoints: 20/min -> reduce to 5/min
- [ ] Enable Nginx rate limiting zones (`nginx/default.conf`):
  ```
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  limit_req zone=api burst=20 nodelay;
  ```
- [ ] Block offending IP ranges at firewall / CDN level
- [ ] If using PgBouncer (`deploy/pgbouncer/pgbouncer.ini`): reduce `max_client_conn` to protect database
- [ ] Scale up frontend/backend replicas if using Kubernetes (`helm/qaai/values.yaml`)
- [ ] Enable geo-blocking if attack originates from specific regions
- [ ] Monitor until traffic normalizes, then gradually relax restrictions

### 3.3 Compromised Credentials

**Trigger:** Leaked API key, exposed environment variable, compromised user account, stolen service credential.

**Immediate Actions:**

- [ ] Identify which credential(s) are compromised
- [ ] Determine exposure window (when leaked, when discovered)

**Per credential type:**

| Credential | Rotation Procedure |
|------------|-------------------|
| `OPENAI_API_KEY` | Regenerate in OpenAI dashboard; update `.env` and Coolify/K8s secrets; restart backend |
| `ANTHROPIC_API_KEY` | Regenerate in Anthropic console; update `.env`; restart backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Regenerate in Supabase dashboard; update `.env`; restart backend |
| `SUPABASE_ANON_KEY` | Regenerate in Supabase dashboard; update `.env` and frontend; redeploy |
| `JWT_SECRET` | Generate new secret; update `.env`; restart backend (all users will be logged out) |
| `DATABASE_URL` | Change PostgreSQL password; update `.env`, PgBouncer config; restart all services |
| `FERNET_KEY` | Generate new key; re-encrypt all BYOK keys in `ai_encrypted_keys`; restart backend |
| User password | Force password reset; revoke all sessions; notify user |
| Chrome Extension key | Regenerate in Chrome Web Store; publish extension update |

**Post-rotation:**

- [ ] Force logout all active sessions
- [ ] Review audit logs for unauthorized actions during exposure window
- [ ] Scan for any data exfiltration during the exposure period
- [ ] Notify affected customers if their data may have been accessed
- [ ] Update credential rotation log (see Appendix A)

### 3.4 Unauthorized Access

**Trigger:** Suspicious login, privilege escalation, access from unexpected location/IP, RBAC bypass.

**Immediate Actions:**

- [ ] Revoke all sessions for the affected account(s)
- [ ] Disable account pending investigation
- [ ] Export full audit trail for the account from `GET /api/audit/logs`
- [ ] Review RBAC middleware logs for permission check failures
- [ ] Check `TenantContextMiddleware` for cross-tenant access attempts
- [ ] Review Supabase auth logs for the account
- [ ] Check if OAuth2 tokens (Salesforce, integrations) were used
- [ ] Examine test execution history for data exfiltration via test scripts
- [ ] Check for new API keys or webhooks created by the account
- [ ] If on-prem: review VPN/network access logs with customer IT

---

## 4. Evidence Preservation

### 4.1 Audit Log Export

**Priority: Perform within first hour of incident detection.**

- [ ] Export platform audit logs:
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_URL/api/audit/logs?start_date=$INCIDENT_START&end_date=$NOW&limit=10000" \
    > audit_export_$(date +%Y%m%d_%H%M%S).json
  ```
- [ ] Export audit summary:
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$API_URL/api/audit/summary" \
    > audit_summary_$(date +%Y%m%d_%H%M%S).json
  ```
- [ ] Save copies to a secure, write-once storage location (S3 with Object Lock, or equivalent)

### 4.2 Database Snapshots

- [ ] Create PostgreSQL point-in-time snapshot:
  ```bash
  pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME \
    -f incident_$(date +%Y%m%d_%H%M%S).dump
  ```
- [ ] If using managed PostgreSQL (Supabase, RDS): trigger manual backup via dashboard
- [ ] Preserve WAL (Write-Ahead Log) files for the incident window
- [ ] Export affected tenant data separately for isolated analysis
- [ ] Store snapshots with checksums (SHA-256) for integrity verification:
  ```bash
  sha256sum incident_*.dump > checksums.sha256
  ```

### 4.3 Log Collection

Collect and preserve logs from all relevant sources:

| Source | Location | Collection Method |
|--------|----------|-------------------|
| Backend application logs | Uvicorn stdout/stderr | `docker logs backend > backend.log` or journalctl |
| Nginx access/error logs | `/var/log/nginx/` | Copy to evidence storage |
| PostgreSQL query logs | `pg_log/` or CloudWatch | Export for incident window |
| Supabase auth logs | Supabase dashboard | Export via API or dashboard |
| PgBouncer logs | `/var/log/pgbouncer/` | Copy to evidence storage |
| Kubernetes events | `kubectl get events` | Export to JSON |
| Rate limit logs | Backend middleware output | Extract from application logs |
| WAF/CDN logs | Cloudflare / AWS WAF dashboard | Export for incident window |
| CI/CD pipeline logs | GitHub Actions | Download artifacts |
| Electron auto-update logs | Desktop client logs | Request from affected users |

### 4.4 Chain of Custody

Maintain a custody log for all evidence:

| Item | Collected By | Date/Time (UTC) | SHA-256 Hash | Storage Location | Access Granted To |
|------|-------------|-----------------|--------------|------------------|-------------------|
| _______________ | _______________ | _______________ | _______________ | _______________ | _______________ |
| _______________ | _______________ | _______________ | _______________ | _______________ | _______________ |
| _______________ | _______________ | _______________ | _______________ | _______________ | _______________ |

**Rules:**
- All evidence files must be checksummed at collection time
- Evidence must be stored in append-only / write-once storage
- Access to evidence requires IC or Security Officer approval
- Transfer of evidence must be logged with sender, receiver, date, and method
- Original evidence must never be modified; work only with copies

---

## 5. Recovery Procedures

### 5.1 Database Restore

**When to use:** Data corruption, ransomware, failed migration, accidental deletion.

- [ ] Identify the last known-good backup before the incident
- [ ] Verify backup integrity:
  ```bash
  pg_restore --list incident_backup.dump | head -20
  ```
- [ ] Create a recovery database (do NOT overwrite production yet):
  ```bash
  createdb qaai_recovery
  pg_restore -d qaai_recovery incident_backup.dump
  ```
- [ ] Validate recovered data: row counts, recent records, tenant isolation
- [ ] Run migration scripts to bring schema to current version:
  ```bash
  cd backend && python -m app.auto_migrate
  ```
- [ ] If validated, swap production to recovered database
- [ ] Re-run `SEED_DEMO_DATA=true` if demo data was affected
- [ ] Verify all 34 migration files have been applied (`supabase/migrations/001_*` through `034_*`)

### 5.2 Secret Rotation

Complete rotation checklist (perform even if only some secrets are confirmed compromised):

- [ ] `JWT_SECRET` -- regenerate, redeploy backend (forces all user re-login)
- [ ] `OPENAI_API_KEY` -- regenerate in OpenAI dashboard, update env
- [ ] `ANTHROPIC_API_KEY` -- regenerate in Anthropic console, update env
- [ ] `SUPABASE_SERVICE_ROLE_KEY` -- regenerate in Supabase, update env
- [ ] `SUPABASE_ANON_KEY` -- regenerate in Supabase, update env AND frontend build
- [ ] `DATABASE_URL` -- change PostgreSQL password, update env + PgBouncer
- [ ] `FERNET_KEY` -- generate new key, re-encrypt `ai_encrypted_keys` table
- [ ] `VITE_GA4_MEASUREMENT_ID` -- rotate if analytics account compromised
- [ ] `VITE_CRISP_WEBSITE_ID` -- rotate if chat system compromised
- [ ] GitHub deploy keys / CI secrets -- regenerate in GitHub repo settings
- [ ] Docker registry credentials -- regenerate GHCR tokens
- [ ] Helm chart secrets -- update via `kubectl create secret` or sealed-secrets
- [ ] Coolify environment variables -- update via Coolify dashboard

### 5.3 Service Restart Procedure

**Order matters.** Follow this sequence:

1. **Database layer:**
   - [ ] Verify PostgreSQL is healthy: `pg_isready -h $DB_HOST`
   - [ ] Verify PgBouncer connections: check `pgbouncer.ini` settings
   - [ ] Run auto-migration: `python -m app.auto_migrate`

2. **Backend:**
   - [ ] Restart FastAPI/Uvicorn:
     ```bash
     # Docker
     docker-compose restart backend
     # Kubernetes
     kubectl rollout restart deployment/qaai-backend
     # Coolify
     # Trigger redeploy via webhook or dashboard
     ```
   - [ ] Verify health: `curl $API_URL/health`

3. **Frontend:**
   - [ ] Rebuild if environment variables changed: `npm run build`
   - [ ] Restart Nginx / redeploy static assets
   - [ ] Verify: load landing page in browser

4. **Electron desktop:**
   - [ ] If backend URL changed: update `api-config` and publish new build
   - [ ] Trigger auto-update via `latest.yml`

5. **Chrome extension:**
   - [ ] If backend URL changed: update `api-config.js` defaults
   - [ ] Publish update to Chrome Web Store

### 5.4 Verification Steps

After recovery, verify each component:

- [ ] **Health endpoint:** `GET /health` returns 200
- [ ] **Database connectivity:** `GET /api/db/status` or test a CRUD operation
- [ ] **Authentication:** Sign in with test account, verify JWT issuance
- [ ] **RBAC:** Verify role-based access (owner, admin, member, viewer)
- [ ] **Tenant isolation:** Verify cross-tenant queries return empty
- [ ] **Recording:** Start and stop a Playwright recording session
- [ ] **Test execution:** Run a simple test case end-to-end
- [ ] **API testing:** Execute a REST request via `/api/v2/testing/execute`
- [ ] **AI features:** Test AI endpoint with BYOK key (if applicable)
- [ ] **WebSocket:** Verify real-time updates during test execution
- [ ] **Audit trail:** Verify new actions appear in `/api/audit/logs`
- [ ] **Rate limiting:** Verify rate limit headers present in responses
- [ ] **Monitoring:** Confirm Prometheus scraping, Grafana dashboards loading

---

## 6. Post-Incident Review

### 6.1 Timeline

Complete within **5 business days** of incident resolution.

**Post-Incident Review participants:** Incident Commander, affected engineers, Security Officer, Engineering Lead, Customer Success (if customer-facing).

### 6.2 Post-Mortem Template

```
# Post-Incident Review: [Incident Title]

**Incident ID:** INC-YYYY-NNN
**Severity:** P1 / P2 / P3 / P4
**Date:** YYYY-MM-DD
**Duration:** HH:MM (from detection to resolution)
**Incident Commander:** [Name]
**Author:** [Name]
**Review Date:** YYYY-MM-DD
**Status:** Draft / Final

---

## Executive Summary
[2-3 sentence summary: what happened, what was impacted, how it was resolved]

---

## Timeline (all times UTC)

| Time (UTC) | Event | Actor |
|------------|-------|-------|
| HH:MM | [First indicator / alert triggered] | [System/Person] |
| HH:MM | [Incident detected / confirmed] | [Person] |
| HH:MM | [Escalation / notification] | [Person] |
| HH:MM | [Containment action taken] | [Person] |
| HH:MM | [Root cause identified] | [Person] |
| HH:MM | [Fix deployed / service restored] | [Person] |
| HH:MM | [Incident closed] | [IC] |

---

## Root Cause Analysis

### What happened
[Technical description of the root cause]

### Why it happened
[Contributing factors, process gaps, missing safeguards]

### 5 Whys Analysis
1. Why did [symptom] occur? Because [cause 1].
2. Why did [cause 1] occur? Because [cause 2].
3. Why did [cause 2] occur? Because [cause 3].
4. Why did [cause 3] occur? Because [cause 4].
5. Why did [cause 4] occur? Because [root cause].

---

## Impact Assessment

| Dimension | Detail |
|-----------|--------|
| Users affected | [count / percentage] |
| Tenants affected | [list or count] |
| Data exposed | [types, volume, sensitivity] |
| Revenue impact | [estimated $ or description] |
| SLA breaches | [which SLAs, by how much] |
| Regulatory implications | [GDPR, CCPA, or other reporting required] |

---

## What Went Well
- [Effective detection, fast containment, good communication, etc.]
- [...]

## What Went Poorly
- [Delayed detection, unclear ownership, missing runbook, etc.]
- [...]

## Where We Got Lucky
- [Factors that reduced impact but were not by design]
- [...]

---

## Remediation Actions

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
| [Specific, measurable action] | [Name] | P1/P2/P3 | YYYY-MM-DD | Open |
| [Specific, measurable action] | [Name] | P1/P2/P3 | YYYY-MM-DD | Open |
| [Specific, measurable action] | [Name] | P1/P2/P3 | YYYY-MM-DD | Open |

---

## Prevention Measures

### Short-term (within 2 weeks)
- [ ] [Immediate fix or mitigation]
- [ ] [...]

### Medium-term (within 1 quarter)
- [ ] [Process improvement, tooling, monitoring]
- [ ] [...]

### Long-term (within 2 quarters)
- [ ] [Architectural change, vendor change, policy update]
- [ ] [...]

---

## Appendix
- [Links to evidence, logs, dashboards, Slack threads]
- [Customer communications sent]
- [Related incidents]
```

---

## 7. Breach Notification Timeline

### 7.1 GDPR (EU/EEA -- General Data Protection Regulation)

| Requirement | Timeline | Action |
|-------------|----------|--------|
| Supervisory Authority notification | **72 hours** from awareness of breach | File notification with lead supervisory authority (typically where your EU establishment is, or where most affected users are) |
| Data subject notification | **Without undue delay** (if high risk to rights/freedoms) | Direct notification to affected individuals |
| Documentation | Immediate | Document breach facts, effects, remedial actions (even if not reportable) |

**GDPR Notification Checklist:**

- [ ] Nature of the breach (categories and approximate number of data subjects)
- [ ] Name and contact details of DPO
- [ ] Likely consequences of the breach
- [ ] Measures taken or proposed to address the breach
- [ ] Measures to mitigate possible adverse effects

> **Note:** The 72-hour clock starts when the organization becomes "aware" of the breach, not when it occurred. If notification cannot be made within 72 hours, provide reasons for delay.

### 7.2 US State Requirements

| Jurisdiction | Notification Deadline | Special Requirements |
|-------------|----------------------|---------------------|
| **California (CCPA/CPRA)** | Without unreasonable delay, no later than **72 hours** for AG notification if >500 residents | AG notification required; right to statutory damages ($100-$750/consumer); security audit requirements |
| **New York (SHIELD Act)** | Most expedient time possible | Must notify AG, Department of State, and Division of State Police; expanded definition of private information |
| **Texas** | Within **60 days** | AG notification required if >250 residents affected |
| **Florida** | Within **30 days** to individuals; within **30 days** to AG if >500 residents | Penalties up to $500K for failure to notify |
| **Virginia (VCDPA)** | Without unreasonable delay, no later than **60 days** | AG notification required |
| **Colorado (CPA)** | Within **30 days** | AG notification required |
| **Connecticut** | Within **60 days** | AG notification required |
| **All other US states** | Varies (typically 30-60 days) | Check state-specific statute; most require AG notification above certain thresholds |

### 7.3 Customer SLA Notification

| Customer Tier | Notification Timeline | Method | Content |
|---------------|----------------------|--------|---------|
| Enterprise (on-prem) | Within **4 hours** of confirmed breach | Phone + email to designated security contact | Full technical details, affected systems, containment status |
| Enterprise (SaaS) | Within **8 hours** of confirmed breach | Email to account admin + phone to security contact | Impact scope, containment actions, expected resolution |
| Professional | Within **24 hours** of confirmed breach | Email notification | Impact summary, actions taken, next steps |
| Free / Trial | Within **48 hours** of confirmed breach | Email notification | General summary, recommended actions |

### 7.4 Regulatory Notification Template

```
PERSONAL DATA BREACH NOTIFICATION

To: [Supervisory Authority / State Attorney General]
From: [Organization Legal Name]
Date: [Submission Date]
Reference: [Internal Incident ID]

1. Nature of the breach:
   [Description of what happened]

2. Categories of data subjects affected:
   [e.g., platform users, enterprise customers, trial users]

3. Approximate number of data subjects:
   [Count or best estimate]

4. Categories of personal data:
   [e.g., email addresses, names, hashed passwords, test data,
    organization names, usage analytics]

5. Likely consequences:
   [Assessment of potential harm]

6. Measures taken to address the breach:
   [Containment, remediation, prevention actions]

7. Data Protection Officer contact:
   Name: _______________
   Email: _______________
   Phone: _______________

8. Additional information:
   [Any supplementary details, or note that further information
    will follow]
```

---

## 8. Appendices

### Appendix A: Credential Rotation Log

| Date | Credential | Rotated By | Reason | Verified By |
|------|-----------|-----------|--------|-------------|
| _______________ | _______________ | _______________ | _______________ | _______________ |
| _______________ | _______________ | _______________ | _______________ | _______________ |

### Appendix B: Incident Log

| Incident ID | Date | Severity | Summary | Duration | Root Cause | Post-Mortem Link |
|-------------|------|----------|---------|----------|------------|-----------------|
| INC-____-001 | _______________ | P__ | _______________ | _______________ | _______________ | _______________ |
| INC-____-002 | _______________ | P__ | _______________ | _______________ | _______________ | _______________ |

### Appendix C: Key System Endpoints for Incident Response

| System | Health Check | Logs Location |
|--------|-------------|---------------|
| Backend API | `GET /health` | Docker logs / Coolify logs / K8s pod logs |
| PostgreSQL | `pg_isready -h $DB_HOST` | `pg_log/` or cloud provider logs |
| PgBouncer | `SHOW STATS` via admin console | `/var/log/pgbouncer/` |
| Nginx | `curl -I https://$DOMAIN` | `/var/log/nginx/access.log`, `error.log` |
| Supabase | Supabase dashboard health | Supabase dashboard logs |
| Prometheus | `GET /prometheus/-/healthy` | Prometheus container logs |
| Grafana | `GET /grafana/api/health` | Grafana container logs |
| Electron auto-update | `GET /latest.yml` from release server | GitHub Releases |

### Appendix D: External Contacts

| Organization | Contact | Purpose |
|-------------|---------|---------|
| Hosting provider (Hetzner) | _______________ | Infrastructure incidents, DDoS mitigation |
| CDN / WAF provider | _______________ | DDoS mitigation, WAF rule changes |
| Supabase support | _______________ | Auth/database incidents |
| OpenAI support | _______________ | API key compromise, abuse reports |
| Anthropic support | _______________ | API key compromise, abuse reports |
| Cyber insurance provider | _______________ | Breach coverage, legal support |
| External forensics firm | _______________ | Major breach investigation |
| Legal counsel (data privacy) | _______________ | Regulatory notification guidance |

### Appendix E: Regular Testing Schedule

| Activity | Frequency | Last Performed | Next Due | Owner |
|----------|-----------|---------------|----------|-------|
| Tabletop exercise (P1 scenario) | Quarterly | _______________ | _______________ | _______________ |
| Backup restore test | Monthly | _______________ | _______________ | _______________ |
| Secret rotation drill | Quarterly | _______________ | _______________ | _______________ |
| Incident response plan review | Quarterly | _______________ | _______________ | _______________ |
| Penetration test | Annually | _______________ | _______________ | _______________ |
| Dependency vulnerability scan | Weekly (automated) | _______________ | _______________ | _______________ |

---

> **Document Control:** This plan must be reviewed quarterly and updated after every P1/P2 incident. All team members with incident response roles must acknowledge receipt and review annually.
