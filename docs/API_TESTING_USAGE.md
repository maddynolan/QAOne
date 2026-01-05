# 📘 ArisTrace API Testing - User Guide

**Version:** 2.0  
**Last Updated:** January 2026

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [API Testing Quick Start](#api-testing-quick-start)
3. [Import & Test Generation](#import--test-generation)
4. [Request Chaining](#request-chaining)
5. [Security Testing](#security-testing)
6. [Managing Secrets](#managing-secrets)
7. [Environment Profiles](#environment-profiles)
8. [Viewing Reports](#viewing-reports)
9. [API Coverage Map](#api-coverage-map)
10. [Data Flow Visualization](#data-flow-visualization)
11. [APM Integration](#apm-integration)
12. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Prerequisites

1. **Backend Running**
   ```powershell
   cd C:\QAAI\backend
   uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend Running**
   ```powershell
   cd C:\QAAI
   npm run dev
   ```

3. **Electron Desktop App** (Optional)
   ```powershell
   cd C:\QAAI\flowstral-desktop
   npm run dev
   ```

### Accessing API Testing

**Web App:** Navigate to `http://localhost:8082` → Click **API** tab

**Desktop App:** Launch Electron app → Click **API** in the top navigation

---

## ⚡ API Testing Quick Start

### Step 1: Select a Template

1. Go to **API Tab** → **Templates** sub-tab
2. Choose from:
   - 🛒 **E-Commerce API** - Products, cart, orders
   - 👤 **User Management** - Auth, users, roles
   - 💳 **Payment Gateway** - Transactions, refunds
   - 📊 **Analytics API** - Events, metrics

3. Click the template card to load pre-configured tests

### Step 2: Configure Environment

1. Switch to **Environments** sub-tab
2. Set your **Target URL** (e.g., `https://api.yourapp.com`)
3. Add any required **Headers** (API keys, auth tokens)
4. Select environment: Dev / QA / Staging / Prod

### Step 3: Execute Tests

1. Go to **Execute** sub-tab
2. Review test list - check/uncheck individual tests
3. Click **▶ Run All Tests** or **▶ Run Selected**
4. Watch real-time progress

### Step 4: View Results

1. Switch to **Results** sub-tab
2. See execution summary:
   - Total tests
   - Pass/Fail counts
   - Pass rate percentage
3. View individual test details in table
4. Switch between report views:
   - **Summary** - Quick stats and table
   - **HTML Report** - Visual formatted report
   - **JUnit XML** - CI/CD compatible
   - **JSON** - Raw data
   - **Allure** - Rich test reporting

---

## 📥 Import & Test Generation

### Import OpenAPI/Swagger Spec

1. Go to **Import** sub-tab
2. Click **Import OpenAPI Spec**
3. Either:
   - **Upload file:** Drag & drop YAML/JSON
   - **Enter URL:** Paste spec URL
4. Click **Parse Spec**
5. Review discovered endpoints
6. Click **Generate Tests** to auto-create test cases

### Import Postman Collection

1. Go to **Import** sub-tab
2. Click **Import Postman Collection**
3. Upload `.json` file exported from Postman
4. Map environment variables if needed
5. Click **Import**

### Import from Recording

1. Go to **Record** tab (main navigation)
2. Enable **Capture Network** toggle
3. Interact with your application
4. Click **Send to API**
5. Review captured requests in API tab

---

## 🔗 Request Chaining

### Creating a Request Chain

1. Go to **Import** → **Request Chaining** section
2. Click **+ Add Step**
3. Configure first request:
   ```
   Name: Login
   Method: POST
   URL: /api/auth/login
   Body: {"username": "test", "password": "pass123"}
   ```
4. Add **Extraction** rules:
   - Variable Name: `auth_token`
   - Source: `json`
   - Path: `$.token`

### Using Extracted Variables

1. Add second step
2. Reference extracted variable:
   ```
   Name: Get Profile
   Method: GET
   URL: /api/users/{{user_id}}
   Headers:
     Authorization: Bearer {{auth_token}}
   ```

### Variable Syntax

| Syntax | Description |
|--------|-------------|
| `{{variable}}` | Insert variable value |
| `{{$timestamp}}` | Current Unix timestamp |
| `{{$randomInt}}` | Random integer |
| `{{$guid}}` | Random UUID |

### Extraction Examples

**From JSON Response:**
```json
{
  "name": "auth_token",
  "from": "json",
  "path": "$.data.access_token"
}
```

**From Response Header:**
```json
{
  "name": "request_id",
  "from": "header",
  "path": "X-Request-ID"
}
```

**From Cookie:**
```json
{
  "name": "session",
  "from": "cookie",
  "path": "session_id"
}
```

**Using Regex:**
```json
{
  "name": "order_id",
  "from": "regex",
  "path": "order_id=([A-Z0-9]+)"
}
```

---

## 🛡️ Security Testing

### Running a Security Scan

1. Go to **Security** sub-tab
2. Enter **Target URL** (e.g., `https://api.yourapp.com`)
3. Select security tests to run:
   - ☑️ **Auth Matrix** - Test authentication boundaries
   - ☑️ **BOLA** - Broken Object Level Authorization
   - ☑️ **Injection** - SQL/NoSQL/Command injection
   - ☑️ **Rate Limiting** - Missing rate limits
   - ☑️ **SSRF** - Server-Side Request Forgery
   - ☑️ **Mass Assignment** - Property manipulation

4. Click **▶ Run Security Scan**
5. Review results:
   - Severity levels (Critical, High, Medium, Low)
   - Affected endpoints
   - Remediation suggestions

### Interpreting Security Results

| Severity | Action Required |
|----------|-----------------|
| 🔴 **Critical** | Fix immediately, blocks release |
| 🟠 **High** | Fix before release |
| 🟡 **Medium** | Fix in next sprint |
| 🟢 **Low** | Consider fixing |

---

## 🔐 Managing Secrets

### Accessing Secrets Vault

**Web App:** More → Secrets Vault  
**Desktop App:** More dropdown → Secrets Vault  
**Direct URL:** `/secrets`

### Creating a Secret

1. Click **+ Add Secret**
2. Fill in details:
   - **Name:** Unique identifier (e.g., `API_TOKEN`)
   - **Value:** The secret value (hidden by default)
   - **Type:** Select type (API Key, Password, Token, etc.)
   - **Environment:** Dev / QA / Staging / Prod
   - **Description:** Optional notes

3. Click **Store Secret**

### Using Secrets in Tests

Reference secrets using `{{secret_name}}` syntax:

```
Headers:
  Authorization: Bearer {{API_TOKEN}}
  X-API-Key: {{my_api_key}}

Body:
  {
    "password": "{{db_password}}"
  }
```

### Viewing a Secret Value

1. Find the secret in the list
2. Click the 👁️ (eye) icon
3. Authenticate if prompted
4. Value is revealed temporarily

### Security Notes

- Secrets are **encrypted at rest** using AES-256
- Values are **masked** in the UI by default
- Audit logs track all secret access
- HashiCorp Vault can be configured for enterprise use

---

## 🌍 Environment Profiles

### Creating an Environment

1. Go to **Environments** sub-tab
2. Click **+ Add Environment**
3. Configure:
   ```
   Name: Production
   Base URL: https://api.prod.example.com
   Variables:
     - API_VERSION: v2
     - TIMEOUT_MS: 30000
   ```

### Switching Environments

1. Use the **Environment** dropdown in the Execute tab
2. Or set default environment in Settings

### Environment Variables

| Variable | Description |
|----------|-------------|
| `{{baseUrl}}` | Environment's base URL |
| `{{env.API_VERSION}}` | Custom variable |
| `{{$env.NODE_ENV}}` | System environment |

---

## 📊 Viewing Reports

### In-App Report Viewing

1. Run tests → Go to **Results** tab
2. Use the tabbed interface:

| Tab | Description |
|-----|-------------|
| **📊 Summary** | Quick stats, pass/fail counts, test table |
| **🌐 HTML Report** | Formatted visual report in iframe |
| **📋 JUnit XML** | CI/CD-compatible XML format |
| **📦 JSON** | Raw execution data |
| **🔶 Allure** | Allure-compatible JSON |

### Downloading Reports

Click the download icons (⬇️) in the Results tab header:
- Each button downloads the corresponding format
- Files are named with date: `api-test-results-2026-01-04.xml`

### Generating Allure Report

1. Download the Allure JSON
2. Run in terminal:
   ```bash
   npm install -g allure-commandline
   allure generate allure-results-*.json -o allure-report
   allure open allure-report
   ```

---

## 🗺️ API Coverage Map

### Accessing Coverage Map

**Path:** More → Coverage Map  
**Direct URL:** `/coverage`

### Understanding the View

1. **Coverage Summary**
   - Total endpoints discovered
   - Tested vs untested count
   - Coverage percentage

2. **By HTTP Method**
   - Visual breakdown: GET, POST, PUT, DELETE
   - Progress bars showing coverage per method

3. **Endpoint List**
   - Green background = Tested ✅
   - Red background = Untested ❌
   - Shows test count and pass rate

### Improving Coverage

1. Filter to show only **Untested** endpoints
2. Click **Generate Tests** on untested rows
3. Review and run generated tests

---

## 📈 Data Flow Visualization

### Accessing Data Dependency Graph

**Path:** More → Data Flow  
**Direct URL:** `/data-flow`

### Understanding the Graph

1. **Request Nodes** - Each API request in your chain
2. **Variable Badges** - Extracted/injected variables
3. **Flow Lines** - Data dependencies between requests

### Node Colors

| Badge Color | Meaning |
|-------------|---------|
| 🟡 Yellow | Auth tokens |
| 🔵 Blue | IDs (user_id, order_id) |
| 🟣 Purple | Session data |
| 🟢 Green | General data |

### Interacting with the Graph

1. Click a node to see details
2. View extractions and injections
3. Navigate to dependent requests
4. Click **Run Chain** to execute

---

## 📡 APM Integration

### Accessing APM Configuration

**Path:** More → APM Config  
**Direct URL:** `/apm`

### Connecting to Datadog

1. Click **Datadog** provider card
2. Enter:
   - **API Key:** Your Datadog API key
   - **API URL:** `https://api.datadoghq.com` (or your region)
   - **Application Key:** (Optional)
3. Click **Save & Test**

### Connecting to New Relic

1. Click **New Relic** provider card
2. Enter:
   - **License Key:** Your New Relic license key
   - **Account ID:** Your NR account ID
   - **Region:** US or EU
3. Click **Save & Test**

### Connecting to Prometheus

1. Click **Prometheus** provider card
2. Enter:
   - **Pushgateway URL:** `http://localhost:9091`
   - **Job Name:** `aristrace_api_tests`
3. Click **Save & Test**

### Metrics Sent to APM

| Metric | Description |
|--------|-------------|
| `response_time.avg` | Average response time |
| `response_time.p95` | 95th percentile |
| `throughput.rps` | Requests per second |
| `error_rate` | Error percentage |
| `active_vus` | Active virtual users |

---

## ❓ Troubleshooting

### Tests Not Running

**Symptom:** Click "Run" but nothing happens

**Solution:**
1. Check backend is running on port 8000
2. Open browser DevTools → Network tab
3. Look for failed requests to `/api/v2/testing/execute`
4. Check backend logs for errors

### Secrets Not Resolving

**Symptom:** `{{secret_name}}` appears literally in request

**Solution:**
1. Verify secret exists in Secrets Vault
2. Check secret name matches exactly (case-sensitive)
3. Ensure secret is for correct environment

### Import Failing

**Symptom:** OpenAPI import shows error

**Solution:**
1. Validate your spec at https://editor.swagger.io/
2. Ensure spec is valid YAML/JSON
3. Check for circular references
4. Try importing via file instead of URL

### Reports Not Loading

**Symptom:** Results tab shows blank

**Solution:**
1. Wait for test execution to complete
2. Check console for JavaScript errors
3. Refresh the page
4. Check backend returned valid results

### Coverage Map Empty

**Symptom:** No endpoints shown

**Solution:**
1. Import an OpenAPI spec first
2. Run some tests to populate coverage
3. Check backend has test results stored

### APM Not Receiving Metrics

**Symptom:** Connected but no data in APM dashboard

**Solution:**
1. Click **Test Connection** in APM Config
2. Verify API key/credentials are correct
3. Check firewall allows outbound HTTPS
4. Run a test after configuring APM

---

## 🆘 Getting Help

### Logs

**Backend logs:** Check terminal running uvicorn  
**Frontend logs:** Browser DevTools → Console

### Support Channels

- 📖 **Documentation:** `/docs` folder
- 🐛 **Bug Reports:** GitHub Issues
- 💬 **Community:** Discord/Slack

---

*© 2026 ArisTrace - Excellence in Every QA Trace*

