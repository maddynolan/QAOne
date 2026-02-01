# API Testing: Enterprise Guide

> Flowstral API testing vs Postman / ReadyAPI (SmartBear). Record flow, API tab features, and handling incomplete specs.

---

## 1. Record Flow: API Toggle

### What Happens When You Enable "API Testing" During Record

1. **Where it is**
   - In the **Record** tab, under the URL field.
   - Section: **"Also capture network traffic for:"**
   - Toggle: **"API Testing"** (and optionally "Load Testing").

2. **When you turn it ON**
   - The app starts **network capture** (desktop: `network-capture.js`, extension: same logic).
   - Every **HTTP/HTTPS** request and response (and optionally WebSocket) is recorded while you use the target site.
   - Captured data is stored in memory as a **HAR (HTTP Archive)**.

3. **When you stop recording**
   - You can **export HAR** (e.g. via IPC `network-capture-export-har`).
   - That HAR can be:
     - **Imported in the API tab** (e.g. via Import → HAR).
     - Used to generate **API test cases** or **collections** from real traffic.

4. **End-to-end flow**
   ```
   Record tab → Enable "API Testing" → Start Recording → Use the app →
   Stop Recording → Export HAR → API tab → Import HAR (or paste spec) →
   Generate/run tests, add assertions, environments, data-driven runs.
   ```

So: **API toggle = capture network traffic for later use in the API tab.** It does not switch the UI to the API tab; it only enables HAR capture for the current recording session.

---

## 2. API Tab: What You Have vs Postman / ReadyAPI

### 2.1 Comprehensive Feature Comparison

| Capability | Flowstral | Postman | ReadyAPI (SmartBear) |
|------------|-----------|---------|------------------------|
| **Import** | OpenAPI, Swagger, WSDL, Postman, GraphQL, HAR | OpenAPI, Postman, HAR | OpenAPI, WSDL, Postman, HAR |
| **Environments** | Base URL, variables, auth, timeouts | Full envs + variables | Full envs + data sources |
| **Request chaining** | Property transfer, extract (JSONPath, regex, headers) | Pre-request/Test scripts, variables | Property transfer, data sources |
| **Assertions** | Status, time, JSONPath, XPath, schema, regex, header, cookie, database | Script + snippets | GUI assertions + Groovy |
| **Data-driven** | CSV, JSON, Excel, inline, database | CSV, JSON | CSV, Excel, DB, DataGen |
| **Test Data Generation** | **50+ types (DataGen equivalent)** | Faker in scripts | DataGen TestStep |
| **OpenAPI handling** | Validate + suggest + auto-fix + infer schema | Manual | Manual / schema validation |
| **Security** | OWASP API Top 10 scan (8 categories) | Limited | Security scan |
| **Mock Server** | **Real HTTP server with dynamic responses** | Mock server | ReadyAPI Virtualization |
| **Service Virtualization** | Scenarios, sequences, request logging | Basic | Full |
| **Reports** | HTML, JSON, CSV, trends | Built-in + Newman | Built-in, CI reports |
| **Execution** | Manual, automated, scheduled, CI/CD, load | Collection runner, CLI | Test suites, CI, load |
| **OAuth2** | All grant types + PKCE | OAuth2 | OAuth2 |
| **Database** | PostgreSQL, MySQL, MongoDB, SQLite, MSSQL | Scripts | Full DB support |

### 2.2 Features That Match or Go Beyond Postman/ReadyAPI

#### Multi-Protocol Support
- **REST**: Full support with all HTTP methods
- **SOAP**: WSDL parsing and test generation
- **GraphQL**: Schema introspection and query testing
- **gRPC/Kafka/MQTT/WebSocket**: Engine support for generation

#### Test Data Generation (DataGen) - NEW
50+ data types for realistic test data:

| Category | Types |
|----------|-------|
| **Names** | firstName, lastName, fullName, username |
| **Contact** | email, phone, phoneInternational |
| **Address** | streetAddress, city, state, zipCode, country, fullAddress |
| **Numbers** | integer, float, decimal (with min/max/precision) |
| **Identifiers** | uuid, guid, objectId |
| **Dates** | date, datetime, timestamp, isoDate, pastDate, futureDate |
| **Financial** | creditCard, creditCardExpiry, cvv, price, currency |
| **Text** | word, sentence, paragraph, lorem |
| **Strings** | alphanumeric, alpha, numeric, hex, base64 |
| **Patterns** | pattern (e.g., "XXX-####"), regex |
| **Collections** | randomElement, sequential, weighted |
| **Company** | companyName, jobTitle |
| **Internet** | url, domain, ipv4, ipv6, macAddress, userAgent |
| **Colors** | hexColor, rgbColor |

#### Mock Server (Real HTTP Server) - NEW
- **Actual HTTP server** that listens on a port (not just definitions)
- **Dynamic responses** with template variables
- **Scenario-based responses** (different response based on request)
- **Sequence responses** (stateful mocking)
- **Request logging and verification** (verify your code made expected calls)
- **Auto-generate mocks from OpenAPI spec**
- **Response delay simulation**

#### Assertions
- Status code with operators (==, !=, >, <, etc.)
- Response time thresholds
- JSON body contains/not contains
- JSONPath extraction and comparison
- XPath for XML responses
- JSON Schema validation
- Regex pattern matching
- Header assertions
- Cookie assertions
- **Database assertions** (query DB after API call)

#### Security Testing
OWASP API Security Top 10 (2023):
1. **API1: BOLA** - Broken Object Level Authorization
2. **API2: Broken Authentication** - Rate limiting, weak passwords
3. **API3: BOPLA** - Mass assignment vulnerabilities
4. **API4: Resource Consumption** - Pagination, depth limits
5. **API5: BFLA** - Admin function access
6. **API7: SSRF** - Server-side request forgery
7. **API8: Misconfig** - Security headers, CORS, verbose errors
8. **API9: Inventory** - Debug endpoints, development URLs

---

## 3. Handling Incomplete or Bad OpenAPI Specs

### 3.1 Typical Problems

- Missing or empty **requestBody** / **responses** / **schemas**.
- Path params in URL but not in **parameters**.
- No **operationId**, **summary**, or **description**.
- No **examples** or **example**.
- No **servers** or **info**.
- Only success (200) documented, no 4xx/5xx.

### 3.2 What Flowstral Does

1. **Validation**
   - Call **`POST /api/v2/testing/openapi/validate`** with your spec.
   - You get a list of issues with severity: **error**, **warning**, **info**, **hint**.
   - Each issue can have a **suggestion** and, where possible, **auto_fix** (e.g. add missing operationId, requestBody skeleton).

2. **Auto-fix (optional)**
   - In the same request, set **`apply_auto_fixes: true`**.
   - Response includes **`fixed_spec`** and **`applied_fixes`**.
   - Use **`fixed_spec`** for import/generate so incomplete specs still produce tests.

3. **Schema inference when spec is missing**
   - After calling an API, take the **response body** (JSON).
   - Call **`POST /api/v2/testing/openapi/infer-schema`** with **`response_data`**.
   - Use the returned **schema** to fill missing `requestBody`/`responses` in your spec or in the UI.

4. **Import behavior**
   - Parser normalizes OpenAPI/Postman/WSDL/GraphQL/HAR.
   - If something is missing (e.g. no schema), you can still generate tests and then refine with validation + inference.

So: **incomplete OpenAPI is handled by validate + optional auto-fix + infer-schema from real responses**, so you can still run full API tests.

---

## 4. Backend API Endpoints Reference

### OpenAPI Handling

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/openapi/validate` | Validate spec, return issues; optional `apply_auto_fixes` |
| POST | `/api/v2/testing/openapi/infer-schema` | Infer JSON schema from response body |

### Data-Driven Testing

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/data-driven/source` | Create data source (csv/json/inline) |
| GET | `/api/v2/testing/data-driven/source/{id}/preview` | Preview rows |
| POST | `/api/v2/testing/data-driven/execute` | Run test suite with data-driven iterations |

### Test Data Generation (DataGen)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v2/testing/datagen/types` | List all available data types |
| POST | `/api/v2/testing/datagen/generate` | Generate random data of specified type |
| POST | `/api/v2/testing/datagen/object` | Generate object from schema definition |

### Mock Server

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/mock/server` | Create a mock server |
| POST | `/api/v2/testing/mock/server/{id}/start` | Start the mock server (listen on port) |
| POST | `/api/v2/testing/mock/server/{id}/stop` | Stop the mock server |
| DELETE | `/api/v2/testing/mock/server/{id}` | Delete mock server |
| GET | `/api/v2/testing/mock/server` | List all mock servers |
| GET | `/api/v2/testing/mock/server/{id}` | Get mock server info |
| POST | `/api/v2/testing/mock/server/{id}/endpoint` | Add endpoint to mock |
| POST | `/api/v2/testing/mock/server/{id}/from-openapi` | Generate mock from OpenAPI |
| DELETE | `/api/v2/testing/mock/server/{id}/endpoint/{eid}` | Remove endpoint |
| GET | `/api/v2/testing/mock/server/{id}/logs` | Get request logs |
| POST | `/api/v2/testing/mock/server/{id}/verify` | Verify requests were made |
| DELETE | `/api/v2/testing/mock/server/{id}/logs` | Clear request logs |

### Execution & Reporting

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/execute` | Execute test suite (manual/automated/ci_cd/load) |
| POST | `/api/v2/testing/execute/load` | Execute load/performance test |
| POST | `/api/v2/testing/report/generate` | Generate execution report |
| GET | `/api/v2/testing/report/{id}` | Get report (json/html/csv) |
| POST | `/api/v2/testing/report/trends` | Generate trend report |

### Security Testing

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/security/scan` | Run OWASP API security scan |

### Environments

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/environment/create` | Create environment |
| GET | `/api/v2/testing/environment` | List environments |
| GET | `/api/v2/testing/environment/{id}` | Get environment |
| PUT | `/api/v2/testing/environment/{id}` | Update environment |
| DELETE | `/api/v2/testing/environment/{id}` | Delete environment |
| POST | `/api/v2/testing/environment/{id}/resolve` | Resolve variables in template |

### Database

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v2/testing/database/connect` | Connect to database |
| POST | `/api/v2/testing/database/query` | Execute query |
| POST | `/api/v2/testing/database/assert` | Assert database state |
| GET | `/api/v2/testing/database/connections` | List connections |

---

## 5. Usage Examples

### 5.1 Test Data Generation (DataGen)

```bash
# Get available types
curl http://localhost:8000/api/v2/testing/datagen/types

# Generate random email
curl -X POST http://localhost:8000/api/v2/testing/datagen/generate \
  -H "Content-Type: application/json" \
  -d '{"data_type": "email", "count": 5}'

# Generate object from schema
curl -X POST http://localhost:8000/api/v2/testing/datagen/object \
  -H "Content-Type: application/json" \
  -d '{
    "schema": {
      "name": {"type": "fullName"},
      "email": {"type": "email"},
      "age": {"type": "integer", "min": 18, "max": 65},
      "phone": {"type": "phone"}
    },
    "count": 3
  }'
```

### 5.2 Mock Server

```bash
# Create mock server
curl -X POST http://localhost:8000/api/v2/testing/mock/server \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Mock", "port": 8081}'

# Add endpoint
curl -X POST http://localhost:8000/api/v2/testing/mock/server/{server_id}/endpoint \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "get-users",
    "path": "/api/users",
    "method": "GET",
    "response_body": {"users": [{"id": 1, "name": "{{$random.fullName}}"}]},
    "response_status": 200,
    "dynamic": true
  }'

# Start server
curl -X POST http://localhost:8000/api/v2/testing/mock/server/{server_id}/start

# Now the mock is available at http://127.0.0.1:8081/api/users

# Verify requests were made
curl -X POST "http://localhost:8000/api/v2/testing/mock/server/{server_id}/verify?method=GET&path=/api/users&expected_count=1"
```

### 5.3 OpenAPI Validation & Auto-Fix

```bash
# Validate spec with auto-fixes
curl -X POST http://localhost:8000/api/v2/testing/openapi/validate \
  -H "Content-Type: application/json" \
  -d '{
    "spec": {...your_openapi_spec...},
    "apply_auto_fixes": true
  }'

# Infer schema from response
curl -X POST http://localhost:8000/api/v2/testing/openapi/infer-schema \
  -H "Content-Type: application/json" \
  -d '{
    "response_data": {"id": 1, "name": "Test", "email": "test@example.com"}
  }'
```

---

## 6. API Tab: Suggested UX Flow

1. **From record**
   - Record with **API Testing** toggle ON → export HAR → in API tab: **Import → HAR** → generate tests.

2. **From spec**
   - **Import → OpenAPI/Postman/GraphQL/WSDL** (paste or file).
   - Optionally: **Validate** (and apply auto-fixes) → then **Generate tests**.

3. **When spec is incomplete**
   - Validate → fix critical errors (or apply auto-fixes).
   - Run a request manually (or from a quick test), take response → **Infer schema** → attach to operation.
   - Re-validate and generate.

4. **Data-driven**
   - Create **data source** (CSV/JSON/inline) → **Preview** → **Execute** test suite with **data-driven/execute** (variables in suite substituted per row).

5. **With mock server**
   - Create mock server → Add endpoints (or generate from OpenAPI) → Start server.
   - Run your tests against the mock.
   - After tests: **Verify** that expected requests were made.

---

## 7. Summary: Flowstral vs Competition

| Feature | Flowstral Status |
|---------|-----------------|
| REST API Testing | ✅ Full |
| SOAP/WSDL | ✅ Full |
| GraphQL | ✅ Full |
| Data-Driven Testing | ✅ CSV, JSON, Excel, Inline, Database |
| Test Data Generation | ✅ **50+ types (NEW)** |
| Mock Server | ✅ **Real HTTP server (NEW)** |
| OpenAPI Validation | ✅ With auto-fix |
| Schema Inference | ✅ From responses |
| Security Testing | ✅ OWASP API Top 10 |
| OAuth2 | ✅ All grant types + PKCE |
| Database Assertions | ✅ PostgreSQL, MySQL, MongoDB, etc. |
| CI/CD Integration | ✅ With exit codes |
| Request Chaining | ✅ Property transfer |
| Environments | ✅ Full management |
| Reporting | ✅ HTML, JSON, CSV, trends |

**Verdict**: Flowstral's API testing is now **enterprise-grade and competitive with Postman and ReadyAPI** for most use cases. The new Test Data Generator (DataGen) and real Mock Server capabilities close the key gaps that previously existed.
