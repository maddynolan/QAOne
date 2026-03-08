# Data Retention Policy

| Field | Value |
|-------|-------|
| **Document Title** | Data Retention Policy |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 7, 2026 |
| **Owner** | Security Team |
| **Classification** | Internal |
| **SOC 2 Controls** | CC6.5, A1.2 |
| **Approved By** | See Approval Signatures (Section 12) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Data Retention Principles](#3-data-retention-principles)
4. [Retention Schedule](#4-retention-schedule)
5. [Archival Procedures](#5-archival-procedures)
6. [Data Deletion and Disposal](#6-data-deletion-and-disposal)
7. [Legal Hold Process](#7-legal-hold-process)
8. [GDPR Right to Erasure](#8-gdpr-right-to-erasure)
9. [Backup Retention and Recovery](#9-backup-retention-and-recovery)
10. [Monitoring and Compliance](#10-monitoring-and-compliance)
11. [Exceptions](#11-exceptions)
12. [Approval Signatures](#12-approval-signatures)
13. [Version History](#13-version-history)

---

## 1. Purpose

This Data Retention Policy defines the requirements for retaining, archiving, and disposing of data processed and stored by the QAAI/Flowstral platform. The policy ensures that data is kept for the minimum period necessary to fulfill business, legal, and regulatory obligations, and that data is disposed of securely when retention periods expire.

This policy supports SOC 2 Trust Services Criteria:

- **CC6.5**: The entity discontinues logical and physical protections over physical and logical assets only after the ability to protect them is no longer needed.
- **A1.2**: The entity authorizes, designs, develops or acquires, implements, operates, approves, maintains, and monitors environmental protections, software, data backup, and recovery infrastructure and processes to meet its objectives.

## 2. Scope

This policy applies to all data created, collected, processed, stored, or transmitted by the QAAI/Flowstral platform, including but not limited to:

- Data stored in PostgreSQL databases (primary data store).
- Data stored in Supabase (authentication, file storage).
- Data stored in SQLite (desktop/offline mode).
- Data stored in browser localStorage and sessionStorage (frontend state).
- Data in transit via APIs, WebSocket connections, and SSE streams.
- Data stored in cloud object storage (screenshots, baselines, recordings).
- Data in CI/CD pipelines, container registries, and deployment artifacts.
- Data in log files, monitoring systems (Prometheus), and dashboards (Grafana).
- Data in backups and disaster recovery systems.
- Data processed by third-party AI/LLM providers (OpenAI, Anthropic).

This policy applies across all deployment models: SaaS, on-premises, and desktop.

## 3. Data Retention Principles

### 3.1 Minimization

Data is retained only as long as necessary to fulfill the purpose for which it was collected. When the retention period expires, data must be archived or securely deleted according to this policy.

### 3.2 Classification-Based Retention

Retention periods are determined by data classification (as defined in the Information Security Policy) and the specific data type. Higher classifications require more rigorous disposal procedures.

### 3.3 Regulatory Compliance

Retention periods comply with applicable regulations. Where regulations mandate longer retention, the regulatory requirement takes precedence. Where regulations mandate shorter retention or deletion on request (e.g., GDPR right to erasure), this policy provides mechanisms to comply.

### 3.4 Defensible Disposal

All data disposal is documented and defensible. The organization maintains records of what was deleted, when, how, and by whom. Disposal is suspended for data subject to legal hold.

## 4. Retention Schedule

### 4.1 Application Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| Test case definitions | Internal | 2 years from last modification | 5 years | 7 years | PostgreSQL (`test_cases` table) |
| Test case version history | Internal | 2 years | 5 years | 7 years | PostgreSQL (`test_case_versions` table) |
| Test execution results | Internal | 2 years from execution date | 3 years | 5 years | PostgreSQL (`test_runs` table) |
| Test execution screenshots | Confidential | 6 months from capture | 6 months | 1 year | Supabase Storage / filesystem |
| Browser recordings (DOM snapshots) | Confidential | 6 months from recording date | 6 months | 1 year | PostgreSQL / filesystem |
| Action Graph data | Internal | 6 months | 6 months | 1 year | PostgreSQL |
| API collections and saved requests | Internal | 2 years from last modification | 3 years | 5 years | PostgreSQL (`api_collections` table) |
| API test results (request/response) | Confidential | 1 year from execution | 2 years | 3 years | PostgreSQL |
| Performance test results | Internal | 1 year from execution | 2 years | 3 years | PostgreSQL / localStorage (`flowstral-perf-history`) |
| Performance test HAR files | Confidential | 6 months | 6 months | 1 year | Filesystem |
| Accessibility scan results | Internal | 1 year from scan date | 2 years | 3 years | PostgreSQL |
| Visual testing baselines | Confidential | Until replaced + 6 months | 6 months | Active + 6 months | Filesystem (`baselines/` directory) |
| Visual testing diff images | Internal | 6 months from creation | 6 months | 1 year | Filesystem (`diffs/` directory) |
| Mobile test flows (YAML) | Internal | 2 years from last modification | 3 years | 5 years | PostgreSQL (`mobile_flows` table) |
| Mobile test run results | Internal | 1 year from execution | 2 years | 3 years | PostgreSQL (`mobile_runs` table) |
| Defect records | Internal | 2 years from closure | 5 years | 7 years | PostgreSQL (`defects` table) |
| Requirements | Internal | 2 years from last modification | 5 years | 7 years | PostgreSQL (`requirements` table) |
| Test plans | Internal | 2 years from last modification | 5 years | 7 years | PostgreSQL (`test_plans` table) |
| Flowpilot/AI testing results | Internal | 1 year from execution | 1 year | 2 years | PostgreSQL |
| Blaze Explorer session data | Internal | 90 days | 9 months | 1 year | In-memory + PostgreSQL |

### 4.2 Security and Compliance Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| Audit logs | Confidential | 1 year online | 6 years archive | 7 years | PostgreSQL (`audit_logs` table) + in-memory deque (10K max) |
| Authentication logs (login/logout) | Confidential | 1 year | 6 years | 7 years | Supabase Auth + audit trail |
| Failed authentication attempts | Confidential | 1 year | 2 years | 3 years | Rate limiting logs |
| RBAC permission change logs | Confidential | 1 year | 6 years | 7 years | Audit trail |
| Security incident records | Confidential | 2 years | 5 years | 7 years | Incident response system |
| Vulnerability scan results | Confidential | 1 year | 2 years | 3 years | Security tools |
| Penetration test reports | Confidential | 2 years | 5 years | 7 years | Secure document storage |
| SOC 2 audit reports | Confidential | Current + 2 prior periods | 5 years | 7+ years | Secure document storage |
| Compliance evidence packages | Confidential | Current audit period + 1 year | 6 years | 7 years | Secure document storage |

### 4.3 User and Account Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| User profiles (name, email) | Confidential | Duration of account + 90 days | N/A (deleted after 90-day grace) | Account life + 90 days | Supabase Auth + PostgreSQL |
| User session data | Restricted | 90 days from session end | N/A (deleted) | 90 days | Supabase Auth |
| MFA enrollment (TOTP secrets) | Restricted | Duration of enrollment | N/A (crypto-shredded on unenroll) | Enrollment duration | Encrypted in database |
| Password hashes | Restricted | Duration of account | N/A (deleted with account) | Account life | PostgreSQL (bcrypt/argon2id) |
| BYOK API keys (Fernet-encrypted) | Restricted | Until revoked + 30 days | N/A (crypto-shredded) | Until revoked + 30 days | PostgreSQL (`ai_encrypted_keys` table) |
| Integration credentials (Jira, GitHub) | Restricted | Until revoked + 30 days | N/A (crypto-shredded) | Until revoked + 30 days | Secrets vault |
| Organization metadata | Internal | Duration of organization + 1 year | 2 years | Org life + 3 years | PostgreSQL |
| Project metadata | Internal | Duration of project + 1 year | 2 years | Project life + 3 years | PostgreSQL |

### 4.4 AI/LLM Interaction Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| AI/LLM request/response logs | Confidential | 90 days | N/A (deleted) | 90 days | PostgreSQL (`ai_usage_log` table) |
| AI settings and feature toggles | Internal | Duration of account | 1 year | Account life + 1 year | PostgreSQL (`ai_settings` table) |
| AI usage metrics | Internal | 1 year | 2 years | 3 years | PostgreSQL |
| Data sent to OpenAI/Anthropic | Confidential | Per provider's retention policy | N/A | Per provider policy | Third-party (not QAAI controlled) |

**Note**: Data sent to third-party AI providers (OpenAI, Anthropic) is subject to those providers' data retention policies. The QAAI platform sends only the minimum data necessary and truncates inputs to prevent prompt injection (v3.17.0+). Customers should review provider data processing agreements.

### 4.5 Infrastructure and Operational Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| Application logs (stdout/stderr) | Internal | 30 days | 60 days | 90 days | Container logging system |
| Prometheus metrics | Internal | 30 days (raw) | 1 year (downsampled) | 13 months | Prometheus TSDB |
| Grafana dashboard snapshots | Internal | 1 year | 1 year | 2 years | Grafana storage |
| Container images (GHCR) | Internal | Last 10 versions | N/A (pruned) | Last 10 versions | GitHub Container Registry |
| CI/CD pipeline logs | Internal | 90 days | N/A (pruned by GitHub) | 90 days | GitHub Actions |
| Deployment configuration history | Confidential | 1 year | 2 years | 3 years | Git repository |
| SSL/TLS certificates (expired) | Restricted | 30 days after expiry | N/A (deleted) | Expiry + 30 days | Certificate management system |

### 4.6 Marketing and Analytics Data

| Data Type | Classification | Active Retention | Archive Retention | Total Retention | Storage Location |
|-----------|---------------|-----------------|-------------------|-----------------|-----------------|
| Google Analytics data | Public/Internal | Per GA4 retention settings | N/A | Per GA4 settings | Google Analytics |
| UTM tracking parameters | Internal | Session duration | N/A | Session duration | sessionStorage (`flowstral_utm`) |
| Crisp chat transcripts | Internal | 1 year | 2 years | 3 years | Crisp platform |
| Microsoft Clarity recordings | Internal | Per Clarity retention settings | N/A | Per Clarity settings | Microsoft Clarity |

## 5. Archival Procedures

### 5.1 Archive Process

When data reaches the end of its active retention period:

1. **Identification**: Automated scheduled jobs identify data eligible for archival based on timestamps and retention rules.
2. **Verification**: The data owner or system administrator verifies the data is not subject to legal hold (Section 7).
3. **Extraction**: Data is extracted from the active database/storage in a standard format (JSON, CSV, or SQL dump).
4. **Compression**: Archived data is compressed (gzip or zstd) to reduce storage costs.
5. **Encryption**: Archived data is encrypted at rest using AES-256 before transfer to archive storage.
6. **Transfer**: Encrypted archives are transferred to cold storage (S3 Glacier, Azure Archive, or equivalent).
7. **Verification**: Archive integrity is verified (checksum comparison, sample restoration test).
8. **Purge**: Active data is purged from the production system after successful archive verification.
9. **Logging**: Archival action is logged to the audit trail with: data type, date range, record count, archive location, and operator identity.

### 5.2 Archive Storage Requirements

| Requirement | Specification |
|-------------|--------------|
| Encryption | AES-256 at rest |
| Access control | Restricted to Operations team and CISO |
| Durability | 99.999999999% (11 nines) for S3 Glacier or equivalent |
| Geographic location | Same region as primary data (or as required by data residency obligations) |
| Retention lock | Write-once-read-many (WORM) for compliance-sensitive archives |
| Indexing | Archive manifest file listing: data type, date range, record count, encryption key ID, checksum |

### 5.3 Archive Retrieval

1. Archive retrieval requests must be submitted to the Operations team with business justification.
2. Retrieval from cold storage may take up to 12 hours (standard) or 4 hours (expedited).
3. Retrieved data is decrypted and made available in a temporary secure workspace.
4. Retrieved data must be deleted from the temporary workspace within 7 days.
5. All retrieval events are logged to the audit trail.

## 6. Data Deletion and Disposal

### 6.1 Deletion Methods by Classification

| Classification | Deletion Method | Verification |
|---------------|----------------|--------------|
| Public | Standard deletion (database DELETE, file system unlink) | Spot-check query |
| Internal | Standard deletion with confirmation | Query verification |
| Confidential | Secure deletion (overwrite + delete) for files; database DELETE with vacuum for databases | Query verification + storage check |
| Restricted | Crypto-shredding (destroy encryption keys) or DoD 5220.22-M compliant multi-pass overwrite for physical media | Verification scan + deletion certificate |

### 6.2 Database Data Deletion

For PostgreSQL data:

1. Execute `DELETE` statements targeting expired data based on retention schedule timestamps.
2. Run `VACUUM ANALYZE` on affected tables to reclaim storage and update statistics.
3. For Restricted data, additionally verify that WAL (Write-Ahead Log) segments containing the deleted data have been recycled.
4. Log the deletion operation including: table name, row count deleted, date range, and operator.

### 6.3 File System Deletion

For files (screenshots, recordings, baselines, HAR files):

1. Internal and Confidential files: Delete using filesystem commands. Verify file no longer exists.
2. Restricted files: Overwrite file contents with random data before deletion, or use secure deletion tool (`shred` on Linux, SDelete on Windows).
3. For cloud storage (S3, Supabase Storage): Delete the object and verify it is removed from any replication or CDN caches.

### 6.4 Encryption Key Disposal

When encryption keys are no longer needed (e.g., after crypto-shredding archived data):

1. Delete the key from the key management system.
2. Verify the key is not recoverable from backups (or mark backups containing the key for disposal on schedule).
3. Log the key disposal event.

### 6.5 Automated Deletion Jobs

The following automated deletion jobs should be implemented and scheduled:

| Job | Schedule | Data Targeted | Retention Rule |
|-----|----------|---------------|---------------|
| Session cleanup | Daily | User sessions older than 90 days | 90-day session retention |
| Screenshot cleanup | Weekly | Screenshots older than 6 months | 6-month active retention |
| Performance data cleanup | Monthly | Performance results older than 1 year | 1-year active retention |
| AI usage log cleanup | Monthly | AI/LLM logs older than 90 days | 90-day retention |
| Audit log archival | Monthly | Audit logs older than 1 year | 1-year online, then archive |
| Inactive account cleanup | Monthly | Disabled accounts older than 90 days | 90-day grace period |
| Expired API key cleanup | Weekly | Revoked keys older than 30 days | Revoked + 30 days |
| Explorer session cleanup | Weekly | Blaze/exploration sessions older than 90 days | 90-day retention |
| Container image pruning | Weekly | Images beyond the latest 10 versions | Keep latest 10 |

### 6.6 Deletion Certificates

For Restricted data deletion, a deletion certificate is generated and retained:

```
DELETION CERTIFICATE
====================
Certificate ID:     DEL-YYYY-NNN
Date:               YYYY-MM-DD HH:MM UTC
Operator:           [Name, Role]
Data Type:          [e.g., BYOK API keys, MFA secrets]
Data Location:      [e.g., PostgreSQL ai_encrypted_keys table]
Record Count:       [Number of records deleted]
Date Range:         [Date range of deleted records]
Deletion Method:    [e.g., Crypto-shredding, Secure overwrite]
Verification:       [Method used to verify deletion]
Verified By:        [Name, Role]
Notes:              [Any relevant notes]
```

Deletion certificates are retained for 7 years.

## 7. Legal Hold Process

### 7.1 Legal Hold Definition

A legal hold (also known as litigation hold or preservation order) is a directive to preserve all data, documents, and records that may be relevant to anticipated or pending litigation, regulatory investigation, or audit.

### 7.2 Legal Hold Initiation

1. Legal counsel or the CISO may initiate a legal hold by issuing a Legal Hold Notice.
2. The notice must specify:
   - The matter or case requiring the hold.
   - The data types and date ranges subject to the hold.
   - The organizations, projects, and users whose data is affected.
   - The expected duration of the hold (or "until further notice").
3. The notice is communicated to the Operations team, Security Team, and relevant data owners.

### 7.3 Legal Hold Implementation

Upon receiving a Legal Hold Notice:

1. **Tag**: All data matching the hold criteria is tagged in the system as "LEGAL_HOLD".
2. **Suspend Deletion**: All automated and manual deletion processes are suspended for tagged data.
3. **Suspend Archival**: Archival processes continue but tagged data is not purged from active systems.
4. **Notify Custodians**: Individuals whose data is subject to the hold are notified (if appropriate and not prejudicial to the matter).
5. **Document**: The hold implementation is documented with: date, scope, systems affected, and actions taken.

### 7.4 Legal Hold Monitoring

1. The Security Team verifies monthly that legal hold data remains preserved.
2. Any system changes that could affect held data require Legal counsel review.
3. New data matching the hold criteria that is created after the hold initiation is also subject to the hold.

### 7.5 Legal Hold Release

1. Legal counsel issues a Legal Hold Release Notice when the hold is no longer required.
2. The release specifies: the matter, the release date, and any data that must continue to be preserved.
3. Upon release, previously held data resumes its normal retention schedule. If the data has exceeded its retention period during the hold, the retention clock restarts from the release date with a 90-day grace period before deletion.
4. The release is documented and communicated to all original hold recipients.

## 8. GDPR Right to Erasure

### 8.1 Applicability

The GDPR right to erasure (Article 17, "right to be forgotten") applies to personal data of users who are:

- Located in the European Economic Area (EEA).
- Located in the United Kingdom.
- Otherwise protected by applicable data protection legislation that provides erasure rights.

### 8.2 Erasure Request Processing

1. **Receipt**: Erasure requests are received via the QAAI platform (`POST /api/data-privacy/erasure`), email to the designated privacy address, or through the user's account settings.
2. **Verification**: The identity of the requestor is verified before processing (account authentication or government ID verification for account-less requests).
3. **Scope Assessment**: The Security Team determines the scope of data to be erased:
   - Personal data directly identifying the user (name, email, profile).
   - Content created by the user (test cases, API collections, recordings).
   - Derived data (AI interaction logs, usage metrics).
   - Audit log entries (anonymized, not deleted, per legal retention requirements).
4. **Legal Hold Check**: Verify the data is not subject to an active legal hold. If it is, the erasure is deferred until the hold is released, and the user is notified.
5. **Processing**: The `DataErasureService` (`backend/app/services/core/data_erasure_service.py`) performs cascading deletion across all relevant tables:
   - User profile and authentication records (Supabase Auth).
   - Organization memberships and role assignments.
   - Test cases, test runs, and results attributed to the user.
   - API collections and saved requests.
   - BYOK API keys (crypto-shredded).
   - MFA enrollment records (crypto-shredded).
   - AI usage logs and settings.
   - Screenshots and recordings.
6. **Audit Log Anonymization**: Audit log entries referencing the user are anonymized (user ID replaced with a hash) but retained for compliance purposes.
7. **Confirmation**: The user receives confirmation of erasure within 30 days of the request.
8. **Documentation**: The erasure event is logged (anonymized) for regulatory compliance evidence.

### 8.3 Erasure Exceptions

Data may be retained despite an erasure request when:

1. Retention is required by law (e.g., tax records, anti-money-laundering).
2. Data is necessary for the establishment, exercise, or defense of legal claims.
3. Data is subject to an active legal hold.
4. Data is required for public health, scientific research, or archival purposes in the public interest.

When an exception applies, the user is notified of the exception and the legal basis for continued retention.

### 8.4 Data Export (Right to Portability)

Users may request a copy of their data before erasure via `GET /api/data-privacy/export`:

1. Data is exported in a machine-readable format (JSON).
2. Export includes: user profile, test cases, API collections, test results, and settings.
3. Export excludes: password hashes, encryption keys, system-generated metadata.
4. Export is available for download for 7 days, then auto-deleted.

## 9. Backup Retention and Recovery

### 9.1 Backup Schedule

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full database backup | Daily (automated) | 30 days rolling | Encrypted cloud storage |
| Monthly database snapshot | First day of each month | 1 year | Encrypted cold storage |
| Annual database snapshot | January 1 | 7 years | Encrypted cold storage (WORM) |
| Supabase backup | Per Supabase plan (daily) | Per plan | Supabase managed |
| File system backup (screenshots, baselines) | Daily (incremental) | 30 days rolling | Encrypted cloud storage |
| Configuration backup (env vars, Helm values) | On every change | 1 year | Encrypted version control |
| Docker image archive | On every release | Last 10 versions | GHCR |

### 9.2 Backup Requirements

1. All backups are encrypted at rest using AES-256.
2. Backup encryption keys are stored separately from the backups.
3. Backups are stored in a geographically separate location from the primary data.
4. Backup access is restricted to the Operations team and CISO.
5. Backup operations are logged to the audit trail.

### 9.3 Recovery Testing

| Test Type | Frequency | Scope | Success Criteria |
|-----------|-----------|-------|-----------------|
| Full restoration test | Quarterly | Restore entire database from latest backup | Database operational, data integrity verified, <4 hour RTO |
| Point-in-time recovery test | Semi-annually | Restore to specific timestamp within last 24 hours | Correct data state at target timestamp |
| Individual table restoration | Quarterly | Restore single table from backup | Table data intact, referential integrity maintained |
| Cross-region recovery test | Annually | Restore from geographically remote backup | Same as full restoration test |
| File system restoration test | Quarterly | Restore screenshots and baselines | Files accessible and intact |

### 9.4 Recovery Procedures

1. **Identify Recovery Scenario**: Data corruption, accidental deletion, ransomware, hardware failure, or disaster.
2. **Select Recovery Point**: Choose the appropriate backup based on the Recovery Point Objective (RPO) and the nature of the incident.
3. **Prepare Recovery Environment**: Provision a clean environment or prepare the existing environment for restoration.
4. **Execute Restoration**: Restore from the selected backup following documented procedures.
5. **Verify Integrity**: Run data integrity checks, verify record counts, and test application functionality.
6. **DNS/Traffic Switch**: If recovering to a new environment, update DNS and load balancer configurations.
7. **Notify Stakeholders**: Inform affected users and stakeholders of the recovery status.
8. **Post-Recovery Review**: Document lessons learned and update recovery procedures.

### 9.5 Recovery Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recovery Time Objective (RTO) | 4 hours | Time from incident to full service restoration |
| Recovery Point Objective (RPO) | 1 hour | Maximum acceptable data loss |
| Recovery test success rate | 100% | All quarterly recovery tests must pass |

## 10. Monitoring and Compliance

### 10.1 Retention Compliance Monitoring

1. **Monthly Review**: The Operations team runs retention compliance reports identifying data exceeding its retention period.
2. **Quarterly Audit**: The Security Team audits a sample of data types to verify retention and disposal compliance.
3. **Annual Assessment**: A comprehensive retention schedule review is conducted to ensure alignment with current business needs and regulatory requirements.
4. **Automated Alerts**: Monitoring systems alert when automated deletion jobs fail or when data volumes suggest retention issues.

### 10.2 Compliance Metrics

| Metric | Target | Reporting Frequency |
|--------|--------|-------------------|
| Data past retention period (not archived or deleted) | 0% | Monthly |
| Automated deletion job success rate | 100% | Weekly |
| Backup success rate | 100% | Daily |
| Recovery test success rate | 100% | Quarterly |
| Legal hold compliance (data preserved) | 100% | Monthly |
| GDPR erasure requests completed within 30 days | 100% | Per request |
| Deletion certificates generated for Restricted data | 100% | Per deletion event |

### 10.3 Reporting

Retention compliance reports are:

1. Generated monthly by the Operations team.
2. Reviewed by the Security Team.
3. Summarized in the quarterly security review for leadership.
4. Available as evidence for SOC 2 auditors.

## 11. Exceptions

### 11.1 Exception Criteria

Exceptions to the retention schedule may be granted when:

1. A regulatory requirement mandates a different retention period.
2. A contractual obligation with a customer specifies alternate retention terms.
3. A business-critical need exists that cannot be met within the standard schedule.
4. A legal hold requires extended retention (see Section 7).

### 11.2 Exception Process

1. Submit exception request to the Security Team with: data type, requested retention period, business justification, and risk assessment.
2. The CISO reviews and approves or rejects the exception.
3. Approved exceptions are documented in the exception register with: approval date, expiry date, compensating controls, and review schedule.
4. Exceptions are reviewed quarterly and expire after 12 months unless renewed.

### 11.3 Customer-Specific Retention

For on-premises deployments, customers may configure their own retention periods:

1. Customer retention settings override default periods (within minimum and maximum bounds).
2. Minimum retention: Audit logs must be retained for at least 1 year regardless of customer preference.
3. Maximum retention: No data type may be retained beyond 10 years without explicit legal justification.
4. Customer-configured retention is documented in the deployment configuration and audit trail.

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
