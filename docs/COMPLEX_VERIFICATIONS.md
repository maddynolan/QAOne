# Complex Verifications in ArisTrace

ArisTrace supports advanced verification capabilities for testing scenarios that go beyond simple UI interactions. This guide covers Email, PDF, and File verification.

## Overview

| Feature | Use Case | Provider Support |
|---------|----------|------------------|
| **Email Verify** | 2FA, password reset, registration | Microsoft 365, Gmail |
| **PDF Verify** | Invoice, reports, contracts | Any PDF |
| **File Verify** | CSV exports, Excel reports | CSV, Excel, JSON, XML, Images |

---

## 📧 Email Verification

### Supported Providers

1. **Microsoft 365 / Outlook** (Recommended for enterprise)
2. **Gmail** (via Google API)

### Setup - Microsoft 365

1. **Create Azure AD App Registration:**
   ```
   1. Go to Azure Portal → Azure Active Directory → App registrations
   2. New registration → Name: "ArisTrace Email Verification"
   3. Supported account types: "Accounts in this organizational directory only"
   4. Register
   ```

2. **Configure API Permissions:**
   ```
   1. Go to API permissions → Add a permission
   2. Microsoft Graph → Application permissions
   3. Add: Mail.Read, Mail.ReadBasic
   4. Grant admin consent
   ```

3. **Create Client Secret:**
   ```
   1. Go to Certificates & secrets → New client secret
   2. Copy the secret value immediately (shown only once)
   ```

4. **Configure in ArisTrace:**
   
   Set environment variables in `backend/.env`:
   ```env
   MS_CLIENT_ID=your-client-id
   MS_CLIENT_SECRET=your-client-secret
   MS_TENANT_ID=your-tenant-id
   ```

### Setup - Gmail

1. **Create Google Cloud Project:**
   ```
   1. Go to Google Cloud Console → Create Project
   2. Enable Gmail API
   ```

2. **Create OAuth 2.0 Credentials:**
   ```
   1. APIs & Services → Credentials → Create Credentials → OAuth client ID
   2. Application type: Desktop app
   3. Download JSON credentials file
   ```

3. **Configure in ArisTrace:**
   ```env
   GMAIL_CREDENTIALS_PATH=/path/to/credentials.json
   ```

### Using Email Verification in Tests

#### As a Step Type

Add an "Email Verify" step in the workflow editor:

```
┌─────────────────────────────────────────────────────────┐
│ 📧 Email Verify                                         │
├─────────────────────────────────────────────────────────┤
│ Provider: Microsoft 365                                 │
│ Inbox: test-user@company.com                           │
│ Subject Filter: "Welcome to"                           │
│ Wait Timeout: 60 seconds                               │
│                                                         │
│ Assertions:                                            │
│ ✓ Subject contains: "Welcome to ArisTrace"            │
│ ✓ Body contains: "Click here to verify"               │
│ ✓ From equals: "noreply@company.com"                  │
│                                                         │
│ Extract:                                               │
│ ✓ Link → {{verifyUrl}}                                │
│ ✓ OTP → {{otpCode}}                                   │
└─────────────────────────────────────────────────────────┘
```

#### Step Configuration JSON

```json
{
  "type": "email_verify",
  "name": "Verify Registration Email",
  "config": {
    "provider": "microsoft_365",
    "inbox": "test-user@company.com",
    "subjectFilter": "Welcome to",
    "senderFilter": "noreply@company.com",
    "timeoutSeconds": 60,
    "assertions": [
      { "type": "subject_contains", "expected": "Welcome", "enabled": true },
      { "type": "body_contains", "expected": "verify your account", "enabled": true }
    ],
    "extractLink": {
      "pattern": "verify|confirm",
      "storeAs": "verifyUrl"
    },
    "extractOTP": {
      "storeAs": "otpCode"
    }
  }
}
```

### Email Assertion Types

| Type | Description | Example |
|------|-------------|---------|
| `subject_contains` | Subject includes text | "Welcome" |
| `subject_equals` | Subject matches exactly | "Welcome to App" |
| `body_contains` | Email body contains text | "Click here" |
| `from_equals` | Sender matches | "noreply@co.com" |
| `from_contains` | Sender contains | "noreply" |
| `has_attachment` | Has attachment (optionally by name) | "invoice.pdf" |
| `has_link` | Contains link (optionally matching pattern) | "verify" |
| `has_otp` | Contains OTP code | (auto-detect 4-8 digits) |

---

## 📄 PDF Verification

### Supported Libraries

The backend auto-detects available PDF libraries:
- **PyPDF2** - Basic text extraction
- **pdfplumber** - Advanced table extraction (recommended)
- **PyMuPDF** - Fast text extraction

Install recommended libraries:
```bash
pip install PyPDF2 pdfplumber
```

### Using PDF Verification in Tests

#### Source Types

1. **Download** - Click a button to download PDF, then verify
2. **URL** - Directly fetch PDF from URL
3. **Variable** - Use PDF path from previous step

#### Step Configuration

```json
{
  "type": "pdf_verify",
  "name": "Verify Invoice PDF",
  "config": {
    "sourceType": "download",
    "downloadTrigger": "button#export-pdf",
    "assertions": [
      { "type": "contains_text", "expected": "Invoice #12345", "enabled": true },
      { "type": "page_count", "expected": "2", "enabled": true },
      { "type": "table_contains", "expected": "$499.99", "page": 1, "enabled": true }
    ],
    "extractText": {
      "pattern": "Total: \\$([0-9.]+)",
      "storeAs": "invoiceTotal"
    }
  }
}
```

### PDF Assertion Types

| Type | Description | Parameters |
|------|-------------|------------|
| `contains_text` | PDF contains text | expected, page (optional) |
| `not_contains_text` | PDF doesn't contain text | expected, page (optional) |
| `page_count` | Exact page count | expected |
| `page_count_min` | At least N pages | expected |
| `page_count_max` | At most N pages | expected |
| `title_equals` | PDF title matches | expected |
| `title_contains` | PDF title contains | expected |
| `author_equals` | PDF author matches | expected |
| `text_matches` | Text matches regex | expected (pattern) |
| `table_contains` | Table contains text | expected, page |
| `table_cell_equals` | Cell value matches | expected, page, row, col |
| `has_images` | PDF has images | - |

---

## 📁 File Verification

### Supported File Types

| Type | Extensions | Features |
|------|------------|----------|
| **CSV** | .csv, .tsv | Row/column count, cell values |
| **Excel** | .xlsx, .xls | Sheets, cell values |
| **JSON** | .json | JSONPath queries |
| **XML** | .xml | XPath-like queries |
| **Image** | .png, .jpg, etc. | Dimensions, format |

### Required Libraries

```bash
pip install pandas openpyxl Pillow xmltodict
```

### Using File Verification in Tests

```json
{
  "type": "file_verify",
  "name": "Verify Export CSV",
  "config": {
    "downloadTrigger": "button#export-csv",
    "fileType": "csv",
    "assertions": [
      { "type": "file_exists", "expected": "", "enabled": true },
      { "type": "csv_row_count_min", "expected": "100", "enabled": true },
      { "type": "csv_header_contains", "expected": "Email", "enabled": true },
      { "type": "csv_cell_equals", "expected": "test@example.com", "row": 0, "col": "Email", "enabled": true }
    ],
    "extractValue": {
      "row": 0,
      "col": "Email",
      "storeAs": "firstEmail"
    }
  }
}
```

### File Assertion Types

#### General
| Type | Description |
|------|-------------|
| `file_exists` | File was downloaded |
| `file_name_contains` | File name contains text |
| `file_extension` | File has extension |
| `size_min` | File is at least N bytes |
| `size_max` | File is at most N bytes |

#### CSV
| Type | Description | Parameters |
|------|-------------|------------|
| `csv_row_count` | Exact row count | expected |
| `csv_row_count_min` | At least N rows | expected |
| `csv_column_count` | Column count | expected |
| `csv_header_contains` | Headers include | expected |
| `csv_cell_equals` | Cell value matches | expected, row, col |
| `csv_cell_contains` | Cell contains text | expected, row, col |

#### Excel
| Type | Description |
|------|-------------|
| `excel_sheet_exists` | Has sheet by name |
| `excel_sheet_count` | Number of sheets |

#### JSON
| Type | Description | Parameters |
|------|-------------|------------|
| `json_path_equals` | Path value matches | expected, col (path) |
| `json_path_exists` | Path exists | expected (path) |
| `json_array_length` | Array has N items | expected, col (path) |

#### Image
| Type | Description |
|------|-------------|
| `image_width` | Width in pixels |
| `image_height` | Height in pixels |
| `image_format` | Image format (PNG, JPEG, etc.) |
| `image_min_width` | At least N pixels wide |
| `image_min_height` | At least N pixels tall |

---

## API Endpoints

### Email Verification

```bash
# Initialize service
POST /api/complex-verify/email/initialize?provider=microsoft_365
Body: { "client_id": "...", "client_secret": "...", "tenant_id": "...", "user_email": "..." }

# Verify email
POST /api/complex-verify/email/verify
Body: {
  "provider": "microsoft_365",
  "inbox": "test@company.com",
  "subject_filter": "Welcome",
  "timeout_seconds": 60,
  "assertions": [{ "type": "subject_contains", "expected": "Welcome" }],
  "extract_link": { "pattern": "verify", "store_as": "verifyUrl" }
}

# Check latest emails (debug)
POST /api/complex-verify/email/check-latest?provider=microsoft_365&inbox=test@company.com&limit=5
```

### PDF Verification

```bash
# Verify PDF
POST /api/complex-verify/pdf/verify
Body: {
  "source": "https://example.com/invoice.pdf",
  "source_type": "url",
  "assertions": [{ "type": "contains_text", "expected": "Invoice" }]
}

# Upload and verify
POST /api/complex-verify/pdf/verify-upload
Form: file=@invoice.pdf, assertions=[...]

# Parse PDF (debug)
POST /api/complex-verify/pdf/parse
Body: { "source": "/path/to/file.pdf", "source_type": "path" }
```

### File Verification

```bash
# Verify file
POST /api/complex-verify/file/verify
Body: {
  "file_path": "/path/to/export.csv",
  "file_type": "csv",
  "assertions": [{ "type": "csv_row_count_min", "expected": "100" }]
}

# Get capabilities
GET /api/complex-verify/capabilities
```

---

## Example Test Flow

### 2FA Login with Email OTP

```yaml
Steps:
  1. Navigate to https://app.example.com/login
  2. Fill email: test@company.com
  3. Fill password: ********
  4. Click "Login"
  5. Email Verify:
     - Provider: microsoft_365
     - Inbox: test@company.com
     - Subject: "Your verification code"
     - Extract OTP → {{otpCode}}
  6. Fill OTP field: {{otpCode}}
  7. Click "Verify"
  8. Assert: URL contains "/dashboard"
```

### Invoice Download & Verify

```yaml
Steps:
  1. Navigate to https://app.example.com/orders/123
  2. Click "Download Invoice"
  3. PDF Verify:
     - Source: Download
     - Contains: "Order #123"
     - Contains: "Total: $499.99"
     - Page Count: 1
     - Extract: "Total: \$([0-9.]+)" → {{invoiceTotal}}
  4. Assert: Variable {{invoiceTotal}} equals "499.99"
```

---

## Troubleshooting

### Email Not Found

1. **Check inbox filter** - Subject/sender filter may be too strict
2. **Increase timeout** - Email delivery can take time
3. **Check credentials** - Run `/email/check-latest` to test connection
4. **Check permissions** - Azure AD app needs `Mail.Read` permission

### PDF Parsing Fails

1. **Install pdfplumber** - `pip install pdfplumber`
2. **Check file format** - Ensure it's a valid PDF (not password-protected)
3. **Check for scanned PDFs** - OCR is not supported (text must be extractable)

### File Verification Issues

1. **Check file type** - Set correct type or use "auto"
2. **Install pandas** - Required for CSV/Excel parsing
3. **Check encoding** - CSV may use different encoding (utf-16, latin-1)

