# Access Control Policy

| Field | Value |
|-------|-------|
| **Document Title** | Access Control Policy |
| **Version** | 1.0 |
| **Effective Date** | March 1, 2026 |
| **Last Reviewed** | March 7, 2026 |
| **Owner** | Security Team |
| **Classification** | Internal |
| **SOC 2 Controls** | CC6.1, CC6.2, CC6.3, CC6.4, CC6.5, CC6.6, CC6.7, CC6.8 |
| **Approved By** | See Approval Signatures (Section 14) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Access Control Principles](#3-access-control-principles)
4. [User Provisioning](#4-user-provisioning)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Permissions Matrix](#6-permissions-matrix)
7. [Authentication Requirements](#7-authentication-requirements)
8. [Password Policy](#8-password-policy)
9. [Multi-Factor Authentication (MFA)](#9-multi-factor-authentication-mfa)
10. [Access Reviews](#10-access-reviews)
11. [Service Account Management](#11-service-account-management)
12. [API Key Lifecycle Management](#12-api-key-lifecycle-management)
13. [Emergency Access Procedures](#13-emergency-access-procedures)
14. [User De-Provisioning and Offboarding](#14-user-de-provisioning-and-offboarding)
15. [Approval Signatures](#15-approval-signatures)
16. [Version History](#16-version-history)

---

## 1. Purpose

This Access Control Policy defines the requirements and procedures for managing user access to the QAAI/Flowstral platform and its supporting infrastructure. The policy ensures that access is granted based on the principle of least privilege, that authentication mechanisms are appropriately strong, and that access rights are reviewed and revoked in a timely manner.

This policy supports SOC 2 Trust Services Criteria CC6.1 through CC6.8, which address logical and physical access controls.

## 2. Scope

This policy applies to:

- All user accounts on the QAAI/Flowstral platform (SaaS, on-premises, and desktop deployments).
- All administrative access to infrastructure components (servers, databases, cloud services).
- All service accounts and automated processes that interact with QAAI systems.
- All API keys, tokens, and credentials used for authentication or authorization.
- All third-party integrations (Supabase, GitHub, Jira, OpenAI, Anthropic) that access or process QAAI data.

## 3. Access Control Principles

### 3.1 Least Privilege

Users and service accounts shall be granted the minimum level of access necessary to perform their assigned duties. No user shall have access to systems or data beyond what their role requires.

### 3.2 Need-to-Know

Access to Confidential and Restricted data (as defined in the Information Security Policy) is granted only when a documented business need exists. Organization and project boundaries enforced by the QAAI `TenantContextMiddleware` provide automatic need-to-know isolation.

### 3.3 Separation of Duties

Critical operations require involvement of multiple individuals:

- Code deployment requires both a developer (author) and a reviewer (approver) via pull request.
- Access provisioning for Admin and Owner roles requires approval from an existing Owner.
- Emergency access requires both activation and post-incident review.

### 3.4 Defense in Depth

Multiple layers of access control are enforced:

1. **Network Layer**: Firewall rules, VPN, IP allowlisting for infrastructure access.
2. **Application Layer**: JWT-based authentication, RBAC middleware (`@require_permission` decorators), tenant isolation.
3. **Data Layer**: Row-level security via tenant IDs, Fernet encryption for sensitive fields, PostgreSQL role-based access.

## 4. User Provisioning

### 4.1 Account Request Process

1. **Request**: The hiring manager or team lead submits an account request specifying:
   - Full name and corporate email address.
   - Organization and project(s) to be granted access to.
   - Requested role (Viewer, Member, Admin, or Owner).
   - Business justification for the requested role if Admin or Owner.
   - Start date and expected duration (for contractors/temporary workers).

2. **Approval**:
   - Viewer and Member roles: Approved by any Admin or Owner of the target organization.
   - Admin role: Approved by an existing Owner of the target organization.
   - Owner role: Approved by an existing Owner plus the CISO or VP of Engineering.
   - Infrastructure access: Approved by the Operations team lead and the CISO.

3. **Provisioning**:
   - Account created in Supabase authentication system.
   - Role assigned in the QAAI platform via `project_management_api.py` (`/api/projects`).
   - MFA enrollment initiated (required for Admin and Owner roles per Section 9).
   - Welcome email sent with initial setup instructions.
   - Provisioning action logged to the audit trail (`audit_service.py`).

4. **Verification**: The provisioning team verifies the account has the correct role and project access within 1 business day of creation.

### 4.2 Account Types

| Account Type | Description | Approval | MFA | Max Inactive Period |
|-------------|-------------|----------|-----|-------------------|
| Standard User | Regular platform users (Member/Viewer) | Admin or Owner | Recommended | 90 days |
| Privileged User | Admin and Owner roles | Owner + CISO | Required | 60 days |
| Service Account | Automated processes, CI/CD, integrations | Operations Lead + CISO | N/A (key-based) | N/A (reviewed quarterly) |
| Temporary/Contractor | Time-limited access | Manager + Admin | Required | 30 days or contract end |
| Emergency Access | Break-glass accounts | CISO (pre-approved) | Required | Always disabled; enabled on demand |

### 4.3 Account Naming Standards

- User accounts: Corporate email address (e.g., `jane.doe@company.com`).
- Service accounts: Prefix `svc-` followed by the service name (e.g., `svc-cicd-pipeline`, `svc-monitoring`).
- Emergency accounts: Prefix `emergency-` followed by a sequential number (e.g., `emergency-01`).

## 5. Role-Based Access Control (RBAC)

### 5.1 Role Hierarchy

The QAAI platform implements a hierarchical RBAC model enforced by `ProtectedRoute` (frontend) and `RBACMiddleware` (backend):

```
Owner (highest privilege)
  |
  v
Admin
  |
  v
Member
  |
  v
Viewer (lowest privilege)
```

Each higher role inherits all permissions of the lower roles.

### 5.2 Role Definitions

#### 5.2.1 Viewer

- **Purpose**: Read-only access for stakeholders who need to monitor status without making changes.
- **Intended Users**: Executives, external auditors, project managers without edit needs.
- **Restrictions**: Cannot create, modify, or delete any resources. Cannot execute tests. Cannot access AI features. Cannot view Restricted data (API keys, credentials).

#### 5.2.2 Member

- **Purpose**: Standard working access for team members who create and execute tests.
- **Intended Users**: QA engineers, developers, testers.
- **Capabilities**: Create and edit test cases, execute tests, manage API collections, run performance tests, access accessibility scanning, use AI features (when enabled at org level). Cannot manage users, change organization settings, or access audit logs.

#### 5.2.3 Admin

- **Purpose**: Administrative access for team leads who manage projects and users.
- **Intended Users**: QA leads, engineering managers, team leads.
- **Capabilities**: All Member permissions plus: manage project users and roles (except Owner), configure integrations, manage AI settings (enable/disable features, store BYOK keys), view audit logs, manage license settings, configure webhooks.

#### 5.2.4 Owner

- **Purpose**: Full access with organizational control.
- **Intended Users**: Organization founders, CTO, VP of Engineering.
- **Capabilities**: All Admin permissions plus: create and delete organizations, assign/revoke Owner and Admin roles, manage billing, delete projects, access all audit logs across the organization, approve emergency access, manage data retention settings.

### 5.3 Role Assignment Rules

1. Every organization must have at least one Owner.
2. The principle of least privilege applies: assign the lowest role that meets the user's needs.
3. Role escalation (e.g., Member to Admin) requires documented approval from an Owner.
4. Role de-escalation may be performed by any Admin or Owner without additional approval.
5. A user may hold different roles in different projects within the same organization.
6. Role assignments are logged to the audit trail.

## 6. Permissions Matrix

### 6.1 Platform Feature Permissions

| Feature Area | Viewer | Member | Admin | Owner |
|-------------|--------|--------|-------|-------|
| **Test Cases** | | | | |
| View test cases | Read | Read | Read | Read |
| Create test cases | -- | Create | Create | Create |
| Edit test cases | -- | Update (own) | Update (all) | Update (all) |
| Delete test cases | -- | -- | Delete | Delete |
| Version history | Read | Read | Read | Read |
| Revert test case versions | -- | -- | Revert | Revert |
| **Recordings** | | | | |
| View recordings | Read | Read | Read | Read |
| Create recordings | -- | Create | Create | Create |
| Delete recordings | -- | Delete (own) | Delete (all) | Delete (all) |
| AI self-healing (Fix/Flag) | -- | Execute | Execute | Execute |
| **Test Execution** | | | | |
| View test runs | Read | Read | Read | Read |
| Execute tests (manual) | -- | Execute | Execute | Execute |
| Execute tests (automated) | -- | Execute | Execute | Execute |
| Cancel running tests | -- | Cancel (own) | Cancel (all) | Cancel (all) |
| **API Testing** | | | | |
| View collections | Read | Read | Read | Read |
| Create/edit requests | -- | Create/Update | Create/Update | Create/Update |
| Execute API tests | -- | Execute | Execute | Execute |
| Manage environments | -- | Create/Update | Create/Update/Delete | Create/Update/Delete |
| Database connections | -- | -- | Create/Update/Delete | Create/Update/Delete |
| **Performance Testing** | | | | |
| View results | Read | Read | Read | Read |
| Run performance tests | -- | Execute | Execute | Execute |
| Server-side execution | -- | -- | Execute | Execute |
| **Accessibility/Visual** | | | | |
| View scan results | Read | Read | Read | Read |
| Run scans | -- | Execute | Execute | Execute |
| Manage baselines | -- | Create | Create/Delete | Create/Delete |
| **Mobile Testing** | | | | |
| View flows and runs | Read | Read | Read | Read |
| Create/edit flows | -- | Create/Update | Create/Update | Create/Update |
| Execute mobile tests | -- | Execute | Execute | Execute |
| Device management | -- | -- | Manage | Manage |
| **AI/Flowpilot** | | | | |
| View AI results | Read | Read | Read | Read |
| Run AI agents | -- | Execute | Execute | Execute |
| Configure AI settings | -- | -- | Configure | Configure |
| Store BYOK API keys | -- | -- | Store | Store |
| **Platform Management** | | | | |
| View dashboard | Read | Read | Read | Read |
| Manage defects | Read | Create/Update | Create/Update/Delete | Create/Update/Delete |
| Manage requirements | Read | Create/Update | Create/Update/Delete | Create/Update/Delete |
| View audit logs | -- | -- | Read | Read |
| Export audit logs | -- | -- | -- | Export |
| Manage users | -- | -- | Add/Remove (Member/Viewer) | Add/Remove (all roles) |
| Organization settings | -- | -- | Read | Read/Update |
| Integrations (Jira, etc.) | -- | -- | Configure | Configure |
| License management | -- | -- | -- | Manage |
| Data erasure (GDPR) | -- | -- | -- | Execute |

### 6.2 Infrastructure Permissions

| Resource | Developer | Operations | Security | CISO |
|----------|----------|------------|----------|------|
| Production servers | -- | Full | Read + Audit | Full |
| Staging servers | Deploy (CI/CD) | Full | Read + Audit | Full |
| Database (prod) | -- | Full | Read + Audit | Full |
| Database (staging) | Read | Full | Read + Audit | Full |
| Monitoring (Prometheus/Grafana) | Read | Full | Read + Configure | Full |
| CI/CD pipeline | Configure (own repos) | Full | Audit | Full |
| Container registry | Push (CI/CD only) | Full | Audit | Full |
| Secrets vault | -- | Manage | Audit | Full |
| Backup systems | -- | Full | Audit | Full |
| Network firewalls | -- | Full | Configure + Audit | Full |

## 7. Authentication Requirements

### 7.1 Authentication Mechanisms

| Component | Mechanism | Implementation |
|-----------|-----------|---------------|
| QAAI Web Application | JWT tokens via Supabase Auth | `python-jose` for token validation, `ProtectedRoute` for frontend enforcement |
| QAAI API | Bearer token (JWT) | Validated in middleware stack; CORS + RateLimit + RBAC + Tenant + TraceLogging |
| Supabase | Email/password + OAuth | Supabase Auth SDK |
| Infrastructure (SSH) | SSH key-based | RSA 4096-bit or Ed25519 minimum |
| CI/CD (GitHub Actions) | GitHub tokens + secrets | Repository-scoped tokens |
| Database (PostgreSQL) | Certificate + password | PgBouncer enforced (`deploy/pgbouncer/pgbouncer.ini`) |
| Salesforce Integration | OAuth 2.0 | `salesforce_auth` router (`/api/salesforce/auth`) |

### 7.2 Session Management

1. JWT tokens expire after 1 hour. Refresh tokens are valid for 7 days.
2. Sessions are terminated on password change.
3. Concurrent session limit: 5 active sessions per user.
4. Inactive sessions are terminated after 30 minutes of inactivity.
5. Session tokens use `secrets.token_urlsafe()` for generation (hardened in v3.17.0).
6. WebSocket connections send heartbeat/pong every 25 seconds; connections without heartbeat are terminated.

### 7.3 Failed Authentication

1. After 5 consecutive failed login attempts, the account is locked for 15 minutes.
2. After 15 consecutive failed attempts, the account is locked until manual reset by an Admin.
3. All failed authentication attempts are logged with source IP, timestamp, and user agent.
4. Rate limiting is enforced at 10 requests/minute for authentication endpoints (`RateLimitMiddleware`).
5. Brute-force patterns trigger automated alerts to the Security Team.

## 8. Password Policy

### 8.1 Password Requirements

| Requirement | Standard Users | Admin/Owner Users |
|-------------|---------------|-------------------|
| Minimum length | 12 characters | 14 characters |
| Uppercase letters | At least 1 | At least 1 |
| Lowercase letters | At least 1 | At least 1 |
| Digits | At least 1 | At least 1 |
| Special characters | At least 1 | At least 2 |
| Password history | Cannot reuse last 6 | Cannot reuse last 12 |
| Maximum age | 180 days | 90 days |
| Minimum age | 1 day | 1 day |

### 8.2 Password Storage

- Passwords are hashed using bcrypt or argon2id as implemented in `backend/app/services/auth/password_service.py`.
- Plaintext passwords are never stored, logged, or transmitted after initial hashing.
- Salt is unique per password (built into bcrypt/argon2id).
- Password hash migration: If a user's password is stored with an older algorithm, it is re-hashed with the current algorithm upon next successful login.

### 8.3 Password Restrictions

Passwords must not:

1. Contain the user's name, email, or username.
2. Be a commonly used password (checked against a dictionary of the top 100,000 breached passwords).
3. Be the same as any password used in the last 6 (standard) or 12 (privileged) password changes.
4. Contain more than 3 consecutive identical characters.
5. Be shared with any other person or system.

### 8.4 Password Reset

1. Self-service password reset via email verification link (Supabase Auth).
2. Reset links expire after 1 hour.
3. Admin-initiated password reset requires the user to change the password on next login.
4. All password reset events are logged to the audit trail.

## 9. Multi-Factor Authentication (MFA)

### 9.1 MFA Requirements

| Role | MFA Requirement | Enforcement |
|------|----------------|-------------|
| Owner | **Required** | Account locked until MFA enrolled |
| Admin | **Required** | Account locked until MFA enrolled |
| Member | Recommended (strongly encouraged) | Opt-in via Settings |
| Viewer | Recommended | Opt-in via Settings |
| Service Accounts | N/A | API key or certificate-based auth |
| Infrastructure Access | **Required** | SSH key + OTP for production |
| Emergency Access | **Required** | Pre-enrolled TOTP |

### 9.2 Supported MFA Methods

The QAAI platform supports TOTP (Time-Based One-Time Password) multi-factor authentication via `backend/app/services/auth/mfa_service.py` and `backend/app/routers/platform/mfa_api.py`.

| Method | Supported | Priority |
|--------|-----------|----------|
| TOTP (Authenticator App) | Yes | Primary |
| SMS OTP | No (insecure, not recommended) | -- |
| Hardware Security Key (FIDO2/WebAuthn) | Planned | Future |
| Push Notification | Planned | Future |

### 9.3 MFA Enrollment

1. Users navigate to Settings > Security > Multi-Factor Authentication.
2. The backend generates a TOTP secret and returns a QR code.
3. The user scans the QR code with their authenticator app (Google Authenticator, Authy, 1Password, etc.).
4. The user enters a verification code to confirm enrollment.
5. Recovery codes are generated and displayed once. Users must securely store these codes.
6. MFA enrollment is logged to the audit trail.

### 9.4 MFA Recovery

1. If a user loses access to their MFA device, they may use a recovery code to authenticate.
2. Each recovery code may only be used once.
3. If all recovery codes are exhausted, the user must contact an Admin or Owner to reset MFA.
4. MFA reset by Admin requires identity verification (government ID or manager attestation).
5. MFA reset events are logged and flagged for Security Team review.

## 10. Access Reviews

### 10.1 Quarterly Access Reviews

Access reviews are conducted quarterly to ensure that user access rights remain appropriate:

1. **Scope**: All active user accounts across all organizations and projects.
2. **Reviewer**: Organization Owners review their users. The Security Team reviews privileged and infrastructure accounts.
3. **Process**:
   a. Generate access report listing all users, their roles, last login date, and organization/project memberships.
   b. Reviewer validates each user's continued need for access and current role appropriateness.
   c. Flag accounts for action: Confirm, Downgrade, Disable, or Remove.
   d. Flagged actions are executed within 5 business days.
   e. Review completion is documented and retained for SOC 2 audit evidence.

### 10.2 Review Triggers

In addition to quarterly reviews, access reviews are triggered by:

- Organizational restructuring or team changes.
- Security incident involving access compromise.
- Employee role change (promotion, transfer, demotion).
- Contractor engagement end or renewal.
- SOC 2 audit preparation.

### 10.3 Inactive Account Management

| Account Type | Inactive Threshold | Action |
|-------------|-------------------|--------|
| Standard User | 90 days | Disable account, notify user |
| Privileged User (Admin/Owner) | 60 days | Disable account, notify user and Security Team |
| Contractor/Temporary | 30 days or contract end (whichever first) | Disable and remove access |
| Service Account | N/A (no inactivity timeout) | Reviewed quarterly for continued necessity |

Disabled accounts are retained for 90 days before deletion to allow for reactivation if needed. After 90 days, the account is permanently deleted per the Data Retention Policy.

## 11. Service Account Management

### 11.1 Service Account Principles

1. Service accounts are used only for automated processes and integrations, never for interactive human login.
2. Each service account has a single, clearly defined purpose documented in the service account registry.
3. Service accounts use API keys or certificates for authentication, not passwords.
4. Service accounts are assigned the minimum role necessary (prefer Viewer or Member).
5. Service accounts do not have MFA (key-based authentication is equivalent).

### 11.2 Service Account Registry

A service account registry is maintained with the following information:

| Field | Description |
|-------|-------------|
| Account Name | Follows `svc-` naming convention |
| Owner | Individual responsible for the account |
| Purpose | What the account does and why it needs access |
| Systems Accessed | Which QAAI systems, APIs, or databases |
| Role/Permissions | Assigned RBAC role and any additional permissions |
| Key Rotation Date | When the API key was last rotated |
| Next Review Date | When the account is next due for quarterly review |
| Expiry Date | When the account should be decommissioned (if temporary) |

### 11.3 Service Account Controls

1. Service account credentials (API keys, certificates) are stored in the secrets vault (`secrets_api.py`, `/api/secrets`).
2. Service account keys are rotated every 90 days (see Section 12).
3. Service account activity is logged to the audit trail.
4. Service accounts that are no longer needed are disabled within 24 hours of determination and deleted after 30 days.
5. Service accounts must not be shared between different automated processes.

## 12. API Key Lifecycle Management

### 12.1 API Key Types

| Key Type | Purpose | Storage | Rotation |
|----------|---------|---------|----------|
| Platform API Keys | Authenticate service-to-service calls | Secrets vault | 90 days |
| BYOK AI Keys (OpenAI, Anthropic) | Customer-provided LLM API keys | Fernet-encrypted in `ai_encrypted_keys` table | Customer-managed, recommended 90 days |
| Integration Keys (Jira, GitHub) | Third-party integrations | Encrypted in database | 90 days |
| Supabase Keys | Auth and storage | Environment variables (encrypted at rest) | On compromise or annually |
| JWT Signing Keys | Token signing | Server environment | Annually or on compromise |

### 12.2 Key Creation

1. API keys are generated using cryptographically secure random number generators (`secrets.token_urlsafe()`).
2. Keys are minimum 32 bytes (256 bits) of entropy.
3. Key creation is logged to the audit trail with: creator identity, key purpose, associated service account, and expiry date.
4. The full key is displayed to the creator only once at creation time.
5. Only a key identifier (last 4 characters) is stored for administrative reference.

### 12.3 Key Rotation

1. All platform and integration API keys must be rotated every 90 days.
2. The key rotation process:
   a. Generate a new key.
   b. Configure the new key in the consuming system.
   c. Verify the new key functions correctly.
   d. Revoke the old key.
   e. Log the rotation event.
3. Automated rotation is preferred. Manual rotation must be documented.
4. A 7-day grace period allows both old and new keys to function during transition.
5. Key rotation reminders are sent 14 days and 7 days before expiry.

### 12.4 Key Revocation

Keys must be immediately revoked when:

1. The key is suspected or confirmed to be compromised.
2. The associated user or service account is de-provisioned.
3. The key has exceeded its maximum age without rotation.
4. The business purpose for the key no longer exists.

Revocation is effective immediately. There is no grace period for security-related revocations.

### 12.5 BYOK Key Security

For customer-provided BYOK API keys (AI provider keys stored via `/api/ai/settings/key`):

1. Keys are Fernet-encrypted before storage in the `ai_encrypted_keys` table.
2. The encryption key is derived from a server-side secret and is never exposed to the frontend.
3. The frontend only receives a `hasApiKey: boolean` flag, never the actual key.
4. Keys are decrypted only at the point of use (LLM API call) and not cached in plaintext.
5. Key deletion removes the encrypted record and logs the event.

## 13. Emergency Access Procedures

### 13.1 Emergency Access Definition

Emergency access (break-glass) is invoked only when:

1. All authorized administrators are unavailable during a critical incident.
2. A security incident requires immediate access to contain damage.
3. A system failure requires administrative intervention to restore service.

### 13.2 Emergency Access Accounts

1. Two emergency access accounts (`emergency-01`, `emergency-02`) are pre-provisioned with Owner-level access but permanently disabled.
2. Each account has its credentials stored in a sealed envelope held by the CISO and a designated backup.
3. MFA is pre-enrolled for emergency accounts.
4. Emergency accounts have full audit logging enabled with real-time alerts.

### 13.3 Emergency Access Procedure

1. **Invocation**: Contact the CISO (or designated backup) and state the emergency reason.
2. **Authorization**: The CISO verbally authorizes activation and documents the reason.
3. **Activation**: The CISO (or backup) enables the emergency account.
4. **Usage**: The authorized user performs the minimum actions necessary to resolve the emergency.
5. **Deactivation**: The emergency account is disabled immediately after the emergency is resolved.
6. **Review**: Within 24 hours, a post-incident review is conducted:
   - All actions taken under the emergency account are reviewed via audit logs.
   - The emergency access justification is documented.
   - The emergency account credentials are changed.
   - Findings are reported to executive leadership.

### 13.4 Emergency Access Logging

All emergency access events generate real-time alerts to the Security Team and CISO. The following are logged:

- Account activation timestamp and authorizer identity.
- All actions performed during the emergency session.
- Account deactivation timestamp.
- Post-incident review completion and findings.

## 14. User De-Provisioning and Offboarding

### 14.1 Triggering Events

De-provisioning is initiated when:

| Event | Timeline |
|-------|----------|
| Voluntary resignation | Within 24 hours of last working day |
| Involuntary termination | Immediately upon notification |
| Contractor engagement end | On the contract end date |
| Role transfer (no longer needs access) | Within 24 hours of transfer effective date |
| Extended leave (>90 days) | Account disabled on leave start date |
| Security incident (compromised account) | Immediately |

### 14.2 Offboarding Checklist

The following steps must be completed for every departing user:

| Step | Action | Responsible | Timeline |
|------|--------|-------------|----------|
| 1 | Disable user account in Supabase Auth | IT/Security | Immediate |
| 2 | Revoke all active JWT tokens and refresh tokens | IT/Security | Immediate |
| 3 | Revoke all API keys associated with the user | IT/Security | Immediate |
| 4 | Remove user from all organizations and projects in QAAI | Admin/Owner | Within 24 hours |
| 5 | Disable MFA and remove TOTP enrollment | IT/Security | Immediate |
| 6 | Revoke SSH keys and VPN access | Operations | Immediate |
| 7 | Revoke access to third-party services (GitHub, Jira, Supabase console) | IT/Security | Within 24 hours |
| 8 | Transfer ownership of shared resources (test cases, collections, projects) | Admin/Owner | Within 48 hours |
| 9 | Review audit logs for the user's last 30 days of activity | Security Team | Within 5 business days |
| 10 | Retrieve company devices and assets | IT/HR | Per HR policy |
| 11 | Remove from email distribution lists and communication channels | IT/HR | Within 24 hours |
| 12 | Archive or reassign the user's personal data per Data Retention Policy | IT/Security | Within 30 days |
| 13 | Document offboarding completion | IT/Security | Within 5 business days |

### 14.3 Offboarding Verification

1. Within 5 business days of offboarding, the Security Team verifies that all checklist items are completed.
2. A random sample of offboarded users is audited quarterly as part of the access review process.
3. Any access that was not revoked during offboarding is treated as a security incident and investigated.

### 14.4 GDPR Data Subject Rights

For users exercising their right to erasure under GDPR:

1. The data erasure request is processed via `data_erasure_service.py` and `/api/data-privacy/erasure` endpoint.
2. Cascading deletion removes the user's personal data across all tables.
3. Audit log entries are anonymized but retained for compliance purposes.
4. Confirmation of erasure is provided to the user within 30 days.
5. Erasure events are logged (anonymized) for regulatory compliance evidence.

## 15. Approval Signatures

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Executive Officer | _________________ | _________________ | ____/____/________ |
| Chief Information Security Officer | _________________ | _________________ | ____/____/________ |
| VP of Engineering | _________________ | _________________ | ____/____/________ |
| Head of Human Resources | _________________ | _________________ | ____/____/________ |

## 16. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-01 | Security Team | Initial policy creation for SOC 2 Type II certification |
