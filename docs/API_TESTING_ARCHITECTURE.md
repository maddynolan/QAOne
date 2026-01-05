# 🔌 ArisTrace API Testing Architecture

**Version:** 2.0 (Enhanced API Testing)  
**Last Updated:** January 2026  
**Module:** API Tab (EnhancedAPITesting)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Feature Matrix](#feature-matrix)
4. [Component Summary](#component-summary)
5. [Test Generation](#test-generation)
6. [Request Chaining](#request-chaining)
7. [Security Testing](#security-testing)
8. [Secrets Management](#secrets-management)
9. [Reporting Engine](#reporting-engine)
10. [Observability & APM](#observability--apm)
11. [API Reference](#api-reference)
12. [Integration Points](#integration-points)

---

## 📖 Overview

ArisTrace API Testing is an **enterprise-grade API testing platform** providing:

- **Automated Test Generation** from OpenAPI/Swagger specs
- **Request Chaining** with variable extraction and injection
- **OWASP Security Scanning** for API vulnerabilities
- **Encrypted Secrets Vault** for credential management
- **Multi-Format Reports** (JUnit XML, HTML, JSON, Allure)
- **APM Integration** (Datadog, New Relic, Dynatrace, Prometheus)

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ARISTRACE API TESTING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      FRONTEND (React + TypeScript)                    │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │              EnhancedAPITesting.tsx                          │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │   │  │Templates │ │ Import   │ │ Execute  │ │ Security │       │   │   │
│  │   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │   │
│  │   │  │Environmt │ │ Results  │ │ Settings │ │ Database │       │   │   │
│  │   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  Additional Pages (Electron Desktop + Web)                   │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │   │   │
│  │   │  │ SecretsVault │ │APICoverageMap│ │DataDependency│        │   │   │
│  │   │  │   /secrets   │ │  /coverage   │ │  /data-flow  │        │   │   │
│  │   │  └──────────────┘ └──────────────┘ └──────────────┘        │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────────┐                                           │   │   │
│  │   │  │  APMConfig   │                                           │   │   │
│  │   │  │    /apm      │                                           │   │   │
│  │   │  └──────────────┘                                           │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │ HTTP API                                  │
│                                  ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PYTHON BACKEND (FastAPI)                           │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                        API ROUTERS                           │   │   │
│  │   │                                                              │   │   │
│  │   │  enhanced_api_testing_api.py   secrets_api.py               │   │   │
│  │   │  request_chaining_api.py       oauth2_api.py                │   │   │
│  │   │  owasp_security_api.py         performance_api.py           │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                        SERVICES                              │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────────────┐  ┌──────────────────┐                 │   │   │
│  │   │  │  request_chaining │  │  owasp_security  │                 │   │   │
│  │   │  │                   │  │                  │                 │   │   │
│  │   │  │ • Variable extract│  │ • BOLA detection │                 │   │   │
│  │   │  │ • Property inject │  │ • Injection scan │                 │   │   │
│  │   │  │ • Conditional     │  │ • Auth matrix    │                 │   │   │
│  │   │  └──────────────────┘  └──────────────────┘                 │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────────────┐  ┌──────────────────┐                 │   │   │
│  │   │  │  secrets_service │  │ oauth2_authent.  │                 │   │   │
│  │   │  │                   │  │                  │                 │   │   │
│  │   │  │ • AES encryption  │  │ • OAuth2 flows  │                 │   │   │
│  │   │  │ • Vault fallback  │  │ • Token refresh │                 │   │   │
│  │   │  │ • Env injection   │  │ • JWT decode    │                 │   │   │
│  │   │  └──────────────────┘  └──────────────────┘                 │   │   │
│  │   │                                                              │   │   │
│  │   │  ┌──────────────────┐  ┌──────────────────┐                 │   │   │
│  │   │  │ reporting_engine │  │  apm_integration │                 │   │   │
│  │   │  │                   │  │                  │                 │   │   │
│  │   │  │ • JUnit XML       │  │ • Datadog       │                 │   │   │
│  │   │  │ • HTML reports    │  │ • New Relic     │                 │   │   │
│  │   │  │ • Allure format   │  │ • Prometheus    │                 │   │   │
│  │   │  └──────────────────┘  └──────────────────┘                 │   │   │
│  │   │                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Feature Matrix

| Feature | Status | Description |
|---------|--------|-------------|
| **OpenAPI/Swagger Import** | ✅ | Auto-generate tests from API specs |
| **Postman Collection Import** | ✅ | Import existing Postman collections |
| **Request Chaining** | ✅ | Extract and inject variables between requests |
| **Positive/Negative Test Gen** | ✅ | Auto-generate edge case tests |
| **OWASP Security Scanning** | ✅ | API1-API10 vulnerability detection |
| **OAuth2 Authentication** | ✅ | Authorization Code, Client Credentials, etc. |
| **Secrets Vault** | ✅ | AES-256 encrypted credential storage |
| **Environment Profiles** | ✅ | Dev/QA/Staging/Prod configurations |
| **JUnit XML Export** | ✅ | CI/CD pipeline integration |
| **HTML Reports** | ✅ | Shareable visual reports |
| **Allure Reports** | ✅ | Rich test reporting framework |
| **Inline Report Viewing** | ✅ | View reports in-app without download |
| **API Coverage Map** | ✅ | Visualize tested vs untested endpoints |
| **Data Dependency Graph** | ✅ | Visualize request chain data flow |
| **APM Integration** | ✅ | Datadog, New Relic, Dynatrace, Prometheus |
| **Database Connectors** | 🔄 | MySQL, PostgreSQL, MongoDB, Redis |
| **Mock Server** | 🔄 | Service virtualization |

---

## 📦 Component Summary

### Files Structure

```
QAAI/
├── src/pages/
│   ├── EnhancedAPITesting.tsx      # Main API testing UI
│   ├── SecretsVault.tsx            # Secrets management UI
│   ├── APICoverageMap.tsx          # Coverage visualization
│   ├── DataDependencyGraph.tsx     # Data flow visualization
│   └── APMConfig.tsx               # APM configuration UI
│
├── backend/app/routers/
│   ├── enhanced_api_testing_api.py # Main API testing endpoints
│   ├── secrets_api.py              # CRUD for secrets
│   ├── request_chaining_api.py     # Chain execution
│   ├── oauth2_api.py               # OAuth2 flows
│   └── owasp_security_api.py       # Security scanning
│
├── backend/app/services/
│   ├── api_testing/
│   │   ├── request_chaining.py     # Variable extraction/injection
│   │   ├── owasp_api_security.py   # OWASP security tests
│   │   └── oauth2_authenticator.py # OAuth2 implementation
│   │
│   ├── core/
│   │   ├── secrets_service.py      # Encrypted secret storage
│   │   ├── vault_service.py        # HashiCorp Vault integration
│   │   └── observability_service.py# Logging, metrics, tracing
│   │
│   ├── engines/
│   │   ├── reporting_engine.py     # Report generation
│   │   └── flaky_detector.py       # Flaky test detection
│   │
│   └── observability/
│       ├── prometheus_exporter.py  # Prometheus metrics
│       └── apm_integration.py      # APM integrations
│
└── docs/
    ├── API_TESTING_ARCHITECTURE.md # This file
    └── API_TESTING_USAGE.md        # Usage guide
```

---

## 🧪 Test Generation

### From OpenAPI/Swagger

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  OpenAPI Spec    │────▶│  Test Generator  │────▶│  Test Suite      │
│  (YAML/JSON)     │     │                  │     │                  │
│                  │     │  • Parse schema  │     │  • Positive      │
│  /api/users:     │     │  • Generate cases│     │  • Negative      │
│    get:          │     │  • Add assertions│     │  • Boundary      │
│    post:         │     │  • Create suite  │     │  • Security      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Generated Test Types

| Type | Description | Example |
|------|-------------|---------|
| **Positive** | Valid inputs, expected success | Valid email, correct password |
| **Negative** | Invalid inputs, expect error | Missing required field |
| **Boundary** | Edge cases | Max length string, min/max numbers |
| **Security** | OWASP tests | SQL injection, XSS, auth bypass |

---

## 🔗 Request Chaining

### Variable Extraction

```json
{
  "steps": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": "/api/auth/login",
        "body": {"username": "test", "password": "pass"}
      },
      "extract": [
        {
          "name": "auth_token",
          "from": "json",
          "path": "$.token"
        },
        {
          "name": "user_id", 
          "from": "json",
          "path": "$.user.id"
        }
      ]
    },
    {
      "name": "Get Profile",
      "request": {
        "method": "GET",
        "url": "/api/users/{{user_id}}",
        "headers": {
          "Authorization": "Bearer {{auth_token}}"
        }
      }
    }
  ]
}
```

### Extraction Sources

| Source | Description | Example |
|--------|-------------|---------|
| `json` | JSONPath from response body | `$.data.token` |
| `header` | Response header value | `X-Request-ID` |
| `cookie` | Set-Cookie value | `session_id` |
| `regex` | Regex capture group | `"id":"([^"]+)"` |
| `xpath` | XPath for XML | `//user/id/text()` |

---

## 🛡️ Security Testing

### OWASP API Security Top 10

| Test | Description | Implementation |
|------|-------------|----------------|
| **API1: BOLA** | Broken Object Level Authorization | Test IDOR vulnerabilities |
| **API2: Broken Auth** | Authentication flaws | Test auth bypass, weak tokens |
| **API3: Excessive Data** | Data exposure | Check response filtering |
| **API4: Unrestricted Resource** | Rate limiting | Test for missing limits |
| **API5: Function Auth** | Missing function-level auth | Test admin endpoints |
| **API6: Mass Assignment** | Property manipulation | Test for mass assignment |
| **API7: Security Misconfig** | Headers, CORS, etc. | Check security headers |
| **API8: Injection** | SQL/NoSQL/Command injection | Fuzz input fields |
| **API9: Asset Management** | API versioning | Check old versions |
| **API10: Logging** | Insufficient logging | Verify audit trails |

### Security Scan Configuration

```typescript
// In EnhancedAPITesting.tsx - Security Tab
const selectedSecurityTests = [
  "auth_matrix",    // Test 401/403 responses
  "bola",           // Broken Object Level Authorization
  "injection",      // SQL/NoSQL/Command injection
  "rate_limiting",  // Missing rate limits
  "ssrf",           // Server-Side Request Forgery
  "mass_assignment" // Mass assignment vulnerabilities
];
```

---

## 🔐 Secrets Management

### Secrets Vault Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     SECRETS VAULT                           │
│                                                             │
│  ┌──────────────────┐       ┌──────────────────────────┐   │
│  │   Frontend UI    │       │   Backend Service        │   │
│  │  SecretsVault.tsx│──────▶│   secrets_service.py     │   │
│  │                  │       │                          │   │
│  │  • Create/Edit   │       │  • AES-256 encryption    │   │
│  │  • View masked   │       │  • Fernet key management │   │
│  │  • Delete        │       │  • Environment scoping   │   │
│  └──────────────────┘       └───────────┬──────────────┘   │
│                                         │                   │
│                             ┌───────────▼──────────────┐   │
│                             │   HashiCorp Vault        │   │
│                             │   (Optional Fallback)    │   │
│                             │                          │   │
│                             │  • Dynamic secrets       │   │
│                             │  • Short-lived tokens    │   │
│                             │  • Audit logging         │   │
│                             └──────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Secret Types

| Type | Icon | Use Case |
|------|------|----------|
| `api_key` | 🔑 | External API credentials |
| `password` | 🔒 | User/DB passwords |
| `token` | 🎫 | Auth tokens, JWTs |
| `credential` | 👤 | Username/password pairs |
| `connection_string` | 🔗 | Database connection URLs |
| `certificate` | 📜 | SSL/TLS certificates |

### Usage in Tests

```javascript
// In headers
Authorization: Bearer {{API_TOKEN}}

// In environment variables
DB_PASSWORD={{db_password}}

// In test scripts
const secret = await secrets.resolve("api_key");
```

---

## 📊 Reporting Engine

### Report Formats

| Format | Use Case | View In-App | Download |
|--------|----------|-------------|----------|
| **Summary** | Quick overview | ✅ | - |
| **HTML** | Shareable visual report | ✅ iframe | ✅ .html |
| **JUnit XML** | CI/CD integration | ✅ code view | ✅ .xml |
| **JSON** | Programmatic access | ✅ code view | ✅ .json |
| **Allure** | Rich reporting framework | ✅ preview | ✅ .json |

### Inline Report Viewing

The Results tab provides tabbed views for all report formats:

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Summary │ 🌐 HTML Report │ 📋 JUnit XML │ 📦 JSON │ 🔶 Allure │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Report content displayed inline based on selected tab]    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Download buttons →  ⬇️ ⬇️ ⬇️ ⬇️                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📈 Observability & APM

### Supported APM Providers

| Provider | Logo | Metrics Sent |
|----------|------|--------------|
| **Datadog** | 🐕 | Response times, error rates, throughput |
| **New Relic** | 📊 | Custom events, spans, metrics |
| **Dynatrace** | 🔷 | Distributed traces, metrics |
| **Prometheus** | 🔥 | Scrape-ready metrics endpoint |
| **Grafana Cloud** | 📈 | InfluxDB-compatible metrics |

### Exported Metrics

```
# Performance Metrics
response_time.avg        # Average response time (ms)
response_time.p95        # 95th percentile (ms)
response_time.p99        # 99th percentile (ms)
throughput.rps           # Requests per second
error_rate               # Error percentage (0-100)

# Test Metrics
tests.total              # Total test count
tests.passed             # Passed tests
tests.failed             # Failed tests
tests.pass_rate          # Pass percentage
```

---

## 📡 API Reference

### Test Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v2/testing/execute` | Run test suite |
| `POST` | `/api/v2/testing/generate` | Generate tests from spec |
| `GET` | `/api/v2/testing/test-suites` | List test suites |

### Secrets Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/secrets/` | Create secret |
| `GET` | `/api/secrets/` | List secrets (masked) |
| `GET` | `/api/secrets/{id}?reveal=true` | Get secret value |
| `DELETE` | `/api/secrets/{id}` | Delete secret |

### Security Scanning

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v2/testing/security/scan` | Run OWASP scan |
| `GET` | `/api/v2/testing/security/results/{id}` | Get scan results |

### Request Chaining

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v2/testing/chain/execute` | Execute request chain |
| `POST` | `/api/v2/testing/chain/validate` | Validate chain config |

---

## 🔌 Integration Points

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run API Tests
  run: |
    curl -X POST http://localhost:8000/api/v2/testing/execute \
      -H "Content-Type: application/json" \
      -d '{"suite_id": "my-api-tests", "environment": "staging"}'
    
- name: Download JUnit Results
  run: curl -o results.xml http://localhost:8000/api/v2/testing/results/junit
  
- name: Publish Test Results
  uses: mikepenz/action-junit-report@v3
  with:
    report_paths: 'results.xml'
```

### From Performance Tab

1. Create API test suite
2. Click "Send to Perf"
3. Requests → Performance scenario
4. Run load test with same requests

### From Record Tab

1. Enable network capture
2. Record API interactions
3. Import captured requests
4. Auto-generate test suite

---

## 🎨 UI/UX Features

### Theme Support

All pages support both light and dark themes via `useTheme()` hook:

```typescript
const { theme } = useTheme();

<div className={cn(
  "min-h-screen overflow-auto",
  theme === 'light' ? "bg-gray-50" : "bg-background"
)}>
```

### Responsive Design

- Max container width with `max-w-6xl mx-auto`
- Scrollable content areas with `<ScrollArea>`
- Flex-wrap for filter controls
- Grid layouts for cards

---

*© 2026 ArisTrace - Excellence in Every QA Trace*

