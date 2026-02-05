# License System Implementation

## Overview

Complete license management system for Flowstral Desktop with admin dashboard, license generator, tracking, and enforcement.

---

## 1. Admin Dashboard

**URL:** `https://flowstral.com/admin/licenses`

**Access:**
- Email: `sales@flowstral.com` (or other whitelisted emails)
- Password: Set via `ADMIN_PASSWORD` env var (default: `Inception@123`)

**Features:**
- Dashboard stats (total licenses, active, expiring soon, activations)
- License generator with customizable parameters
- License table with status, days remaining, activations
- Revoke functionality
- CSV export

**Files:**
- Frontend: `src/pages/LicenseAdminPage.tsx`
- Backend: `backend/app/routers/license_api.py`

---

## 2. License Generator API

### Generate Licenses
```
POST /api/license/admin/generate
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| license_type | string | "trial" | trial, professional, enterprise, unlimited |
| count | int | 1 | Number of licenses (1-100) |
| days | int | 14 | Validity period (1-365) |
| max_activations | int | 1 | Devices per license (1-100) |
| email | string | optional | Customer email |
| company | string | optional | Company name |

**Response:**
```json
{
  "success": true,
  "count": 5,
  "type": "trial",
  "validDays": 14,
  "licenses": [
    {"key": "FLOWSTRAL-XXXXX-...", "expiresAt": "2026-02-19T..."}
  ]
}
```

### Other Admin Endpoints
- `POST /api/license/admin/login` - Admin authentication
- `GET /api/license/admin/list` - List all licenses with tracking
- `GET /api/license/admin/stats` - Dashboard statistics
- `DELETE /api/license/admin/revoke/{key}` - Revoke a license
- `GET /api/license/admin/audit-log` - Admin action audit trail

---

## 3. License Key Format

```
FLOWSTRAL-TXXXX-XXXXA-YYMM0-CCCCC
         │      │     │     │
         │      │     │     └── Checksum (HMAC-SHA256)
         │      │     └── Expiry (YYMM format)
         │      └── Random segment
         └── Type code: T=trial, P=professional, E=enterprise, U=unlimited
```

**Offline Validation:** Keys can be validated offline by checking:
1. Format validity
2. HMAC checksum
3. Embedded expiry date

---

## 4. License Enforcement Flow

### Desktop App Startup
```
App Starts
    │
    ├── Load license.html (license entry page)
    │
    ├── Check stored license key
    │   ├── No key → Stay on license page
    │   └── Has key → Validate with server
    │       ├── Valid → Load webapp
    │       └── Invalid/Expired → Stay on license page
    │
    └── User enters key → Validate → If valid → Load webapp
```

### During App Usage
- Re-validates every 24 hours
- Before recording/playback: `checkLicenseForFeature()` called
- If expired mid-session: Shows "license blocked" message

### Feature Gating by License Type
| Feature | Trial | Professional | Enterprise | Unlimited |
|---------|-------|--------------|------------|-----------|
| Recording | ✓ | ✓ | ✓ | ✓ |
| Playback | ✓ | ✓ | ✓ | ✓ |
| Basic Reports | ✓ | ✓ | ✓ | ✓ |
| Advanced Reports | | ✓ | ✓ | ✓ |
| Parallel Execution | | ✓ | ✓ | ✓ |
| API Testing | | ✓ | ✓ | ✓ |
| CI/CD Integration | | | ✓ | ✓ |
| Self-Healing | | | ✓ | ✓ |
| AI Suggestions | | | ✓ | ✓ |
| Custom Integrations | | | | ✓ |
| Dedicated Support | | | | ✓ |

---

## 5. Electron Desktop Integration

### Files Modified
- `flowstral-desktop/src/main/index.js` - License validation, enforcement
- `flowstral-desktop/src/main/license.js` - License manager class
- `flowstral-desktop/src/main/preload.js` - IPC for license page
- `flowstral-desktop/src/main/webapp-preload.js` - IPC for webapp
- `flowstral-desktop/src/renderer/license.html` - License entry UI

### Key Functions
```javascript
// Check license for feature access
checkLicenseForFeature(feature) → { allowed: boolean, reason?, message? }

// Send license status to webapp
sendLicenseStatusToWebapp() → IPC 'license-status' event

// Load webapp after license validated
loadWebapp() → Creates new window with webapp-preload.js
```

### Config Storage
- Location: `%APPDATA%\flowstral-config\config.json`
- Contains: `licenseKey`, `licenseCache`, preferences
- **Note:** Not deleted on uninstall (standard Windows behavior)

### Debug Commands
```bash
# Run with license reset (for testing fresh install)
"C:\Program Files\Flowstral\Flowstral.exe" --reset-license

# Clear all config manually
Remove-Item -Recurse -Force "$env:APPDATA\flowstral-config"
```

---

## 6. Persistent Storage (Current: File-Based)

### Storage Location
```
backend/data/licenses.json
```

### Structure
```json
{
  "licenses": {
    "FLOWSTRAL-XXX...": {
      "key": "FLOWSTRAL-XXX...",
      "type": "trial",
      "email": "customer@email.com",
      "expiresAt": "2026-02-19T...",
      "maxActivations": 1,
      "features": ["recording", "playback", "basic-reports"],
      "createdAt": "2026-02-05T...",
      "createdBy": "sales@flowstral.com"
    }
  },
  "activations": {
    "FLOWSTRAL-XXX...": [
      {
        "deviceId": "abc123",
        "deviceName": "DESKTOP-XYZ",
        "activatedAt": "2026-02-05T..."
      }
    ]
  },
  "saved_at": "2026-02-05T..."
}
```

### Auto-Save Triggers
- License created
- License activated
- License deactivated
- License revoked
- License auto-registered (offline validation)

### Limitations
- Railway containers may have ephemeral storage
- Data lost if container is replaced (redeploy)
- **Solution:** Migrate to Supabase (TODO)

---

## 7. Security Features

### Admin Authentication
- JWT tokens (24-hour expiry)
- Email whitelist: `ADMIN_EMAILS` in license_api.py
- Rate limiting: 5 attempts, 5-minute lockout
- Optional IP whitelist via `ADMIN_IP_WHITELIST` env var

### Audit Logging
All admin actions logged:
- Login attempts (success/failure)
- License generations
- License revocations
- Stored in `backend/data/license_audit.json`

---

## 8. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `Inception@123` | Admin login password |
| `LICENSE_SECRET` | `flowstral-offline-2024` | HMAC key for license generation |
| `JWT_SECRET` | `flowstral-jwt-secret-2024` | JWT signing key |
| `ADMIN_IP_WHITELIST` | (empty) | Comma-separated allowed IPs |
| `LICENSE_DATA_DIR` | `backend/data` | License storage directory |

---

## 9. TODO: Database Persistence

For permanent storage, migrate to Supabase tables:

```sql
-- licenses table
CREATE TABLE licenses (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT,
  company TEXT,
  expires_at TIMESTAMP NOT NULL,
  max_activations INT DEFAULT 1,
  features JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- activations table
CREATE TABLE license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT REFERENCES licenses(key),
  device_id TEXT NOT NULL,
  device_name TEXT,
  activated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(license_key, device_id)
);

-- audit_log table
CREATE TABLE license_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  admin_email TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 10. Testing Checklist

- [ ] Fresh install shows license page
- [ ] Invalid key rejected with error message
- [ ] Valid key activates and loads app
- [ ] Tabs functional after license activation
- [ ] License persists after app restart
- [ ] Expired license shows license page
- [ ] Admin dashboard accessible with credentials
- [ ] License generator creates valid keys
- [ ] Generated keys work in desktop app
- [ ] Revoked license stops working
- [ ] License data survives server restart

---

*Last Updated: February 5, 2026*
