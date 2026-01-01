# QAAI/ArisTrace Features Usage Guide

Complete guide for using all features including Email Verification, PDF Verification, File Verification, and Salesforce Auto-Connect.

---

## Table of Contents

1. [Email Verification](#1-email-verification)
2. [PDF Verification](#2-pdf-verification)
3. [File Verification](#3-file-verification)
4. [Salesforce Auto-Connect](#4-salesforce-auto-connect)
5. [Quick Reference](#5-quick-reference)

---

## 1. Email Verification

### Overview
Verify emails received during test execution - perfect for 2FA, password reset, registration confirmations, and more.

### Supported Providers
- **Microsoft 365 / Outlook** (Enterprise recommended)
- **Gmail** (Personal/Development)

### Step-by-Step Setup

#### Option A: Microsoft 365 Setup

**Step 1: Create Azure AD App**
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: Azure Active Directory → App registrations → New registration
3. Name: `QAAI Email Verification`
4. Account type: `Accounts in this organizational directory only`
5. Click `Register`
6. Copy the **Application (client) ID** and **Directory (tenant) ID**

**Step 2: Add API Permissions**
1. Go to: API permissions → Add a permission
2. Select: Microsoft Graph → Application permissions
3. Add these permissions:
   - `Mail.Read`
   - `Mail.ReadBasic`
4. Click `Grant admin consent for [Your Org]`

**Step 3: Create Client Secret**
1. Go to: Certificates & secrets → New client secret
2. Description: `QAAI Secret`
3. Expiry: 24 months
4. Click `Add`
5. **COPY THE VALUE IMMEDIATELY** (only shown once!)

**Step 4: Configure Backend**
Create/edit `backend/.env`:
```env
MS_CLIENT_ID=your-application-client-id
MS_CLIENT_SECRET=your-client-secret-value
MS_TENANT_ID=your-directory-tenant-id
```

#### Option B: Gmail Setup

**Step 1: Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: `QAAI Email Verification`
3. Enable: Gmail API

**Step 2: Create OAuth Credentials**
1. Go to: APIs & Services → Credentials
2. Create Credentials → OAuth client ID
3. Application type: Desktop app
4. Download JSON file as `gmail_credentials.json`

**Step 3: Configure Backend**
```env
GMAIL_CREDENTIALS_PATH=./config/gmail_credentials.json
```

### Using Email Verification in Tests

#### Method 1: Via Workflow Editor UI

1. Open **Workflow Editor**
2. Expand **Complex Verify** category in Step Palette
3. Drag **Email Verify** step to your test
4. Configure:

```
┌─────────────────────────────────────────────────────┐
│ 📧 Email Verify Step Configuration                  │
├─────────────────────────────────────────────────────┤
│ Provider: [Microsoft 365 ▼]                         │
│                                                     │
│ Inbox/Email: test-user@company.com                  │
│                                                     │
│ Filters:                                            │
│   Subject Filter: "Your verification code"          │
│   Sender Filter: noreply@myapp.com                  │
│                                                     │
│ Wait Timeout: 60 seconds                            │
│                                                     │
│ ── Assertions ──                                    │
│ [+] Subject contains: "verification"                │
│ [+] Body contains: "Your code is"                   │
│ [+] From equals: "noreply@myapp.com"                │
│                                                     │
│ ── Extractions ──                                   │
│ ☑ Extract verification link → {{verifyUrl}}        │
│ ☑ Extract OTP code → {{otpCode}}                   │
└─────────────────────────────────────────────────────┘
```

5. Use extracted values in later steps:
   - Next step: Fill input with `{{otpCode}}`
   - Or: Navigate to `{{verifyUrl}}`

#### Method 2: Via API

```bash
# Initialize email service
curl -X POST http://localhost:8000/api/complex-verify/email/initialize?provider=microsoft_365 \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-secret",
    "tenant_id": "your-tenant",
    "user_email": "inbox@company.com"
  }'

# Wait for and verify email
curl -X POST http://localhost:8000/api/complex-verify/email/verify \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "microsoft_365",
    "inbox": "test@company.com",
    "subject_filter": "verification code",
    "timeout_seconds": 60,
    "assertions": [
      {"type": "subject_contains", "expected": "verification", "enabled": true},
      {"type": "body_contains", "expected": "code", "enabled": true}
    ],
    "extract_otp": {"store_as": "otpCode"}
  }'
```

### Common Email Test Scenarios

#### Scenario 1: 2FA Login
```
Step 1: Navigate → login page
Step 2: Input → email: test@company.com
Step 3: Input → password: ****
Step 4: Click → Login button
Step 5: Email Verify →
        - Subject: "verification code"
        - Extract OTP → {{otpCode}}
Step 6: Input → OTP field: {{otpCode}}
Step 7: Click → Verify button
Step 8: Assert → URL contains "/dashboard"
```

#### Scenario 2: Registration Confirmation
```
Step 1: Navigate → signup page
Step 2: Fill form → name, email, password
Step 3: Click → Register
Step 4: Email Verify →
        - Subject: "Confirm your email"
        - Extract Link → {{confirmUrl}}
Step 5: Navigate → {{confirmUrl}}
Step 6: Assert → text "Email confirmed"
```

---

## 2. PDF Verification

### Overview
Verify downloaded or fetched PDF documents - great for invoices, reports, contracts, and generated documents.

### Prerequisites
```bash
cd backend
pip install PyPDF2 pdfplumber
```

### Using PDF Verification in Tests

#### Method 1: Via Workflow Editor UI

1. Open **Workflow Editor**
2. Expand **Complex Verify** category
3. Drag **PDF Verify** step to your test
4. Configure:

```
┌─────────────────────────────────────────────────────┐
│ 📄 PDF Verify Step Configuration                    │
├─────────────────────────────────────────────────────┤
│ Source Type: [Download ▼]                           │
│                                                     │
│ Download Trigger: button#download-invoice           │
│ (CSS selector for download button)                  │
│                                                     │
│ ── OR ──                                            │
│ Source Type: [URL ▼]                                │
│ PDF URL: https://api.example.com/invoice/123.pdf    │
│                                                     │
│ ── Assertions ──                                    │
│ [+] Contains text: "Invoice #12345"                 │
│ [+] Contains text: "Total: $499.99"                 │
│ [+] Page count equals: 2                            │
│ [+] Table contains: "Item" (page 1)                 │
│                                                     │
│ ── Extractions ──                                   │
│ Pattern: Total: \$([0-9.]+)                         │
│ Store as: {{invoiceTotal}}                          │
└─────────────────────────────────────────────────────┘
```

#### Method 2: Via API

```bash
# Verify PDF from URL
curl -X POST http://localhost:8000/api/complex-verify/pdf/verify \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://example.com/invoice.pdf",
    "source_type": "url",
    "assertions": [
      {"type": "contains_text", "expected": "Invoice #12345", "enabled": true},
      {"type": "page_count", "expected": "1", "enabled": true}
    ],
    "extract_text": {
      "pattern": "Total: \\$([0-9.]+)",
      "store_as": "invoiceTotal"
    }
  }'

# Parse PDF to see all text (debugging)
curl -X POST http://localhost:8000/api/complex-verify/pdf/parse \
  -H "Content-Type: application/json" \
  -d '{"source": "/path/to/document.pdf", "source_type": "path"}'
```

### PDF Assertion Types

| Type | What it checks | Example |
|------|----------------|---------|
| `contains_text` | Text exists in PDF | "Invoice #12345" |
| `not_contains_text` | Text NOT in PDF | "DRAFT" |
| `page_count` | Exact page count | 2 |
| `page_count_min` | At least N pages | 1 |
| `title_equals` | PDF metadata title | "Invoice Report" |
| `text_matches` | Regex pattern match | `\d{4}-\d{4}` |
| `table_contains` | Table has value | "$499.99" |

### Common PDF Test Scenarios

#### Scenario: Verify Invoice Download
```
Step 1: Navigate → Orders page
Step 2: Click → View Order #123
Step 3: Click → Download Invoice (triggers PDF download)
Step 4: PDF Verify →
        - Source: Download
        - Contains: "Order #123"
        - Contains: "Total: $"
        - Page count: 1
        - Extract: Total: \$([0-9.]+) → {{total}}
Step 5: Assert → {{total}} equals order total
```

---

## 3. File Verification

### Overview
Verify downloaded files including CSV exports, Excel reports, JSON data, XML files, and images.

### Prerequisites
```bash
cd backend
pip install pandas openpyxl Pillow xmltodict
```

### Using File Verification in Tests

#### Method 1: Via Workflow Editor UI

1. Open **Workflow Editor**
2. Expand **Complex Verify** category
3. Drag **File Verify** step to your test
4. Configure based on file type:

**For CSV Files:**
```
┌─────────────────────────────────────────────────────┐
│ 📁 File Verify Step Configuration                   │
├─────────────────────────────────────────────────────┤
│ Download Trigger: button#export-csv                 │
│ File Type: [CSV ▼]                                  │
│                                                     │
│ ── Assertions ──                                    │
│ [+] File exists                                     │
│ [+] Row count min: 100                              │
│ [+] Column count: 5                                 │
│ [+] Header contains: "Email"                        │
│ [+] Cell equals: "test@example.com" (row 0, col 2)  │
│                                                     │
│ ── Extractions ──                                   │
│ Row: 0, Column: Email → {{firstEmail}}              │
└─────────────────────────────────────────────────────┘
```

**For Excel Files:**
```
┌─────────────────────────────────────────────────────┐
│ 📁 File Verify Step Configuration                   │
├─────────────────────────────────────────────────────┤
│ Download Trigger: button#export-excel               │
│ File Type: [Excel ▼]                                │
│                                                     │
│ ── Assertions ──                                    │
│ [+] Sheet exists: "Summary"                         │
│ [+] Sheet count: 3                                  │
│ [+] Cell equals: "Total" (sheet: Summary, B1)       │
└─────────────────────────────────────────────────────┘
```

**For JSON Files:**
```
┌─────────────────────────────────────────────────────┐
│ 📁 File Verify Step Configuration                   │
├─────────────────────────────────────────────────────┤
│ Download Trigger: button#export-json                │
│ File Type: [JSON ▼]                                 │
│                                                     │
│ ── Assertions ──                                    │
│ [+] JSONPath exists: $.data.users                   │
│ [+] JSONPath equals: $.status = "success"           │
│ [+] Array length: $.data.items ≥ 10                 │
└─────────────────────────────────────────────────────┘
```

#### Method 2: Via API

```bash
# Verify CSV file
curl -X POST http://localhost:8000/api/complex-verify/file/verify \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/downloads/export.csv",
    "file_type": "csv",
    "assertions": [
      {"type": "file_exists", "expected": "", "enabled": true},
      {"type": "csv_row_count_min", "expected": "100", "enabled": true},
      {"type": "csv_header_contains", "expected": "Email", "enabled": true}
    ]
  }'

# Check capabilities (which libraries are installed)
curl http://localhost:8000/api/complex-verify/capabilities
```

### File Assertion Types by Type

#### CSV Assertions
| Type | Description |
|------|-------------|
| `csv_row_count` | Exact row count |
| `csv_row_count_min` | At least N rows |
| `csv_column_count` | Number of columns |
| `csv_header_contains` | Has column header |
| `csv_cell_equals` | Cell value matches |

#### Excel Assertions
| Type | Description |
|------|-------------|
| `excel_sheet_exists` | Sheet name exists |
| `excel_sheet_count` | Number of sheets |
| `excel_cell_equals` | Cell value matches |

#### JSON Assertions
| Type | Description |
|------|-------------|
| `json_path_exists` | Path exists |
| `json_path_equals` | Path value matches |
| `json_array_length` | Array has N items |

#### Image Assertions
| Type | Description |
|------|-------------|
| `image_width` | Width in pixels |
| `image_height` | Height in pixels |
| `image_format` | Format (PNG, JPEG) |

---

## 4. Salesforce Auto-Connect

### Overview
The app now automatically reconnects to Salesforce when the backend starts, using saved OAuth tokens.

### How It Works

1. **On First Login**: Connect via OAuth in SF Tools page
2. **Tokens Saved**: Access & refresh tokens saved to `backend/config/salesforce_credentials.json`
3. **On Restart**: Backend automatically uses refresh token to get new access token
4. **No Manual Login**: Works automatically across laptop restarts!

### Setup (One-Time)

**Step 1: Initial OAuth Connection**
1. Start the backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Open QAAI app
3. Go to **Salesforce Tools** page
4. Click **Connect via OAuth**
5. Login to your Salesforce org
6. Authorize the connected app

**Step 2: Verify Auto-Connect**
After restart, check backend logs:
```
[OK] Salesforce auto-connected: https://your-org.my.salesforce.com (your-user@org.com)
```

### Manual Reconnect (If Needed)

If auto-connect fails, you can manually trigger it:

```bash
curl -X POST http://localhost:8000/api/salesforce/auto-connect
```

Or re-authenticate via OAuth in the SF Tools page.

### Troubleshooting

**"Refresh token expired"**
- Re-authenticate via OAuth in SF Tools page
- This typically happens after several months

**"No credentials found"**
- You haven't connected to Salesforce yet
- Go to SF Tools page and connect via OAuth

---

## 5. Quick Reference

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/complex-verify/capabilities` | GET | Check installed libraries |
| `/api/complex-verify/email/verify` | POST | Verify email with assertions |
| `/api/complex-verify/email/check-latest` | POST | Debug: get recent emails |
| `/api/complex-verify/pdf/verify` | POST | Verify PDF with assertions |
| `/api/complex-verify/pdf/parse` | POST | Debug: extract PDF text |
| `/api/complex-verify/file/verify` | POST | Verify file with assertions |
| `/api/salesforce/auto-connect` | POST | Trigger SF reconnect |
| `/api/salesforce/status` | GET | Check SF connection status |

### Environment Variables

```env
# Microsoft 365 Email
MS_CLIENT_ID=your-azure-app-client-id
MS_CLIENT_SECRET=your-azure-client-secret
MS_TENANT_ID=your-azure-tenant-id

# Gmail
GMAIL_CREDENTIALS_PATH=./config/gmail_credentials.json

# Salesforce (auto-managed via OAuth)
# Saved in: backend/config/salesforce_credentials.json
```

### Required Python Packages

```bash
# Email (Microsoft 365)
pip install msal httpx

# PDF
pip install PyPDF2 pdfplumber

# File verification
pip install pandas openpyxl Pillow xmltodict
```

### Step Types in Workflow Editor

| Category | Step Type | Description |
|----------|-----------|-------------|
| Complex Verify | Email Verify | Wait for and verify email |
| Complex Verify | PDF Verify | Verify PDF document |
| Complex Verify | File Verify | Verify downloaded file |

---

## Need Help?

1. **Check Capabilities**: `GET /api/complex-verify/capabilities`
2. **Check Backend Logs**: Look for error messages
3. **Test API Directly**: Use curl commands above
4. **Check Documentation**: `docs/COMPLEX_VERIFICATIONS.md`

