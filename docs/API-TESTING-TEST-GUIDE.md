# API Testing Feature Verification Guide

> Complete guide to test all API testing features before deployment using public test APIs.

---

## Public Test APIs Available

### 1. JSONPlaceholder (REST)
**URL:** https://jsonplaceholder.typicode.com
**Best for:** Basic REST testing, CRUD operations, assertions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/posts` | GET | List 100 posts |
| `/posts/1` | GET | Get single post |
| `/posts` | POST | Create post (fake, doesn't persist) |
| `/posts/1` | PUT | Update post |
| `/posts/1` | DELETE | Delete post |
| `/users` | GET | List 10 users with addresses, companies |
| `/comments` | GET | List 500 comments |
| `/todos` | GET | List 200 todos |

### 2. ReqRes (REST with Auth)
**URL:** https://reqres.in
**Best for:** Authentication testing, pagination, delays

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users?page=2` | GET | Paginated users |
| `/api/users/2` | GET | Single user |
| `/api/users` | POST | Create user (returns created) |
| `/api/register` | POST | Register (token response) |
| `/api/login` | POST | Login (token response) |
| `/api/users?delay=3` | GET | Delayed response (3 sec) |

**Test credentials:**
```json
{"email": "eve.holt@reqres.in", "password": "pistol"}
```

### 3. HTTPBin (Request/Response Testing)
**URL:** https://httpbin.org
**Best for:** Headers, auth, status codes, methods

| Endpoint | Description |
|----------|-------------|
| `/get` | Returns request data |
| `/post` | POST echo |
| `/put`, `/patch`, `/delete` | Method testing |
| `/status/404` | Returns specific status |
| `/basic-auth/user/passwd` | Basic auth test |
| `/bearer` | Bearer token test |
| `/headers` | Returns request headers |
| `/cookies/set?name=value` | Cookie testing |
| `/delay/3` | Delayed response |
| `/xml` | XML response |
| `/json` | JSON response |
| `/html` | HTML response |
| `/gzip` | Gzip compressed |

### 4. Swagger Petstore (OpenAPI)
**URL:** https://petstore.swagger.io/v2
**Spec:** https://petstore.swagger.io/v2/swagger.json
**Best for:** OpenAPI import, spec validation, complex schemas

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pet` | POST | Add pet |
| `/pet/{petId}` | GET | Get pet by ID |
| `/pet/findByStatus` | GET | Query params |
| `/store/order` | POST | Create order |
| `/user/login` | GET | User auth |

### 5. The Cat API (API Keys)
**URL:** https://api.thecatapi.com/v1
**Best for:** API key authentication
**Get key:** https://thecatapi.com/signup

| Endpoint | Description |
|----------|-------------|
| `/images/search` | Random cat images |
| `/breeds` | Cat breeds list |

### 6. OpenWeatherMap (Real API)
**URL:** https://api.openweathermap.org/data/2.5
**Best for:** Real-world API testing
**Get key:** https://openweathermap.org/api (free tier)

### 7. GraphQL Test APIs
**URL:** https://countries.trevorblades.com/graphql
**Best for:** GraphQL testing

```graphql
query {
  countries {
    code
    name
    capital
  }
}
```

**URL:** https://graphql-pokemon2.vercel.app/
**Best for:** GraphQL with parameters

### 8. SOAP Test Service
**URL:** http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso
**WSDL:** http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL
**Best for:** SOAP/WSDL testing

---

## Feature Test Checklist

### 1. Import & Parsing

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| OpenAPI Import | Import Petstore swagger.json | Endpoints parsed, test cases generated |
| Postman Import | Export Postman collection, import | Requests converted |
| HAR Import | Record browser traffic, export HAR, import | Requests parsed from HAR |
| WSDL Import | Import CountryInfoService WSDL | SOAP operations extracted |
| GraphQL Import | Paste countries GraphQL schema | Queries/mutations detected |

**Test commands:**
```bash
# Validate Petstore spec
curl -X POST http://localhost:8000/api/v2/testing/openapi/validate \
  -H "Content-Type: application/json" \
  -d '{"spec": <petstore_json>, "apply_auto_fixes": true}'
```

### 2. Test Data Generation (DataGen)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Basic types | Generate email, name, phone | Random values returned |
| Large batch | Generate 10,000 emails | All unique (with Faker) |
| Pattern | Generate "ORD-####-XX" | Custom pattern filled |
| Object | Generate user object from schema | Complete object |
| Locales | Generate German names | German-style names |

**Test commands:**
```bash
# Generate 10,000 unique emails
curl -X POST http://localhost:8000/api/v2/testing/datagen/batch \
  -H "Content-Type: application/json" \
  -d '{"data_type": "email", "count": 10000, "ensure_unique": true}'

# Check stats
curl http://localhost:8000/api/v2/testing/datagen/stats

# Generate object
curl -X POST http://localhost:8000/api/v2/testing/datagen/object \
  -H "Content-Type: application/json" \
  -d '{
    "schema": {
      "name": {"type": "fullName"},
      "email": {"type": "email"},
      "phone": {"type": "phone"},
      "address": {"type": "fullAddress"}
    },
    "count": 5
  }'
```

### 3. Mock Server

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Create server | POST /mock/server | Server ID returned |
| Add endpoint | POST /mock/server/{id}/endpoint | Endpoint added |
| Start server | POST /mock/server/{id}/start | HTTP server running |
| Hit endpoint | curl http://localhost:8081/your-path | Mock response returned |
| Verify requests | POST /mock/server/{id}/verify | Request logged |
| Dynamic response | Use {{$random.email}} | Random email in response |
| Scenarios | Add condition-based responses | Different response per condition |

**Test commands:**
```bash
# Create mock server
curl -X POST http://localhost:8000/api/v2/testing/mock/server \
  -H "Content-Type: application/json" \
  -d '{"name": "Test API", "port": 8081}'

# Add endpoint
curl -X POST http://localhost:8000/api/v2/testing/mock/server/{SERVER_ID}/endpoint \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "get-users",
    "path": "/api/users",
    "method": "GET",
    "response_body": {
      "users": [
        {"id": 1, "name": "{{$random.fullName}}", "email": "{{$random.email}}"}
      ]
    },
    "dynamic": true
  }'

# Start server
curl -X POST http://localhost:8000/api/v2/testing/mock/server/{SERVER_ID}/start

# Test the mock
curl http://localhost:8081/api/users

# Verify requests made
curl -X POST "http://localhost:8000/api/v2/testing/mock/server/{SERVER_ID}/verify?method=GET&path=/api/users"
```

### 4. Data-Driven Testing

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| CSV source | Upload CSV, create source | Source ID returned |
| JSON source | Upload JSON array | Rows parsed |
| Variable substitution | Use {{username}} in request | Value from data row |
| Execute | Run test suite with data source | One iteration per row |

**Test commands:**
```bash
# Create CSV data source
curl -X POST http://localhost:8000/api/v2/testing/data-driven/source \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Users CSV",
    "source_type": "csv",
    "content": "username,email,password\njohn,john@test.com,pass123\njane,jane@test.com,pass456"
  }'

# Preview
curl http://localhost:8000/api/v2/testing/data-driven/source/{SOURCE_ID}/preview
```

### 5. Assertions

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Status code | Assert status == 200 | Pass/fail |
| Response time | Assert < 1000ms | Pass/fail |
| JSONPath | Assert $.data.id exists | Value extracted |
| Contains | Assert body contains "success" | Pass/fail |
| Schema | Validate against JSON schema | Validation result |
| Header | Assert Content-Type header | Pass/fail |

**Test with JSONPlaceholder:**
```bash
curl -X POST http://localhost:8000/api/v2/testing/execute \
  -H "Content-Type: application/json" \
  -d '{
    "test_suite": {
      "base_url": "https://jsonplaceholder.typicode.com",
      "test_cases": [
        {
          "test_case_id": "get-posts",
          "title": "Get all posts",
          "method": "GET",
          "path": "/posts",
          "expected_status": 200,
          "assertions": [
            "status == 200",
            "response_time < 2000",
            "$.length > 0"
          ]
        }
      ]
    },
    "execution_config": {},
    "mode": "automated"
  }'
```

### 6. Request Chaining (Property Transfer)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Extract from response | Get token from login | Token stored |
| Use in next request | Use ${token} in header | Token applied |
| JSONPath extraction | Extract $.data.id | ID captured |

**Test with ReqRes:**
```bash
# Chain: Login → Use token → Get user
curl -X POST http://localhost:8000/api/v2/testing/execute \
  -H "Content-Type: application/json" \
  -d '{
    "test_suite": {
      "base_url": "https://reqres.in",
      "test_cases": [
        {
          "test_case_id": "login",
          "title": "Login",
          "method": "POST",
          "path": "/api/login",
          "request": {
            "body": {"email": "eve.holt@reqres.in", "password": "cityslicka"}
          },
          "expected_status": 200,
          "correlation": {
            "auth_token": {"type": "jsonpath", "path": "$.token"}
          }
        },
        {
          "test_case_id": "get-user",
          "title": "Get User (with token)",
          "method": "GET",
          "path": "/api/users/2",
          "request": {
            "headers": {"Authorization": "Bearer ${auth_token}"}
          },
          "expected_status": 200
        }
      ]
    },
    "execution_config": {"parallel": false},
    "mode": "automated"
  }'
```

### 7. Environment Management

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Create env | POST environment with variables | Env ID returned |
| Resolve variables | Use {{base_url}} | Substituted |
| Switch envs | Create dev/staging/prod | Different values |

**Test commands:**
```bash
# Create environment
curl -X POST http://localhost:8000/api/v2/testing/environment/create \
  -H "Content-Type: application/json" \
  -d '{
    "environment_config": {
      "name": "Development",
      "type": "development",
      "base_url": "https://jsonplaceholder.typicode.com",
      "variables": {
        "api_key": "test-key-123",
        "user_id": "1"
      }
    }
  }'

# Resolve variables
curl -X POST "http://localhost:8000/api/v2/testing/environment/{ENV_ID}/resolve" \
  -H "Content-Type: application/json" \
  -d '"{{base_url}}/users/{{user_id}}"'
```

### 8. Security Testing (OWASP)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| BOLA test | Test /users/1, /users/999 | Auth issues found |
| Auth test | Test login without rate limit | Vulnerability reported |
| SSRF test | Test URL parameters | SSRF risks identified |
| Headers | Check security headers | Missing headers reported |

**Test commands:**
```bash
curl -X POST http://localhost:8000/api/v2/testing/security/scan \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://jsonplaceholder.typicode.com",
    "tests": ["bola", "auth_matrix", "rate_limiting"]
  }'
```

### 9. Database Assertions

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Connect | Connect to test DB | Connection ID |
| Query | Execute SELECT | Results returned |
| Assert | Check row count after API call | Pass/fail |

**Test (with local PostgreSQL):**
```bash
curl -X POST http://localhost:8000/api/v2/testing/database/connect \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "test-db",
    "db_type": "postgresql",
    "connection_config": {
      "host": "localhost",
      "port": 5432,
      "database": "test",
      "user": "postgres",
      "password": "password"
    }
  }'
```

### 10. Execution Modes

| Mode | How to Test | Expected Result |
|------|-------------|-----------------|
| Manual | mode: "manual" | Returns test cases for manual run |
| Automated | mode: "automated" | Runs all tests |
| CI/CD | mode: "ci_cd" | Fast, fail-fast, exit code |
| Load | mode: "load" | Concurrent requests |

### 11. Reporting

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Generate | POST execution results | Report generated |
| HTML | GET report?format=html | HTML report |
| JSON | GET report?format=json | JSON data |
| Trends | POST multiple results | Trend analysis |

---

## Quick Verification Checklist

Run these in order to verify core functionality:

```bash
# 1. Check capabilities
curl http://localhost:8000/api/v2/testing/capabilities

# 2. Test data generation
curl -X POST http://localhost:8000/api/v2/testing/datagen/generate \
  -d '{"data_type": "email", "count": 5}'

# 3. Create and start mock server
# (follow commands above)

# 4. Execute basic test
curl -X POST http://localhost:8000/api/v2/testing/execute \
  -d '{"test_suite": {"base_url": "https://jsonplaceholder.typicode.com", "test_cases": [{"method": "GET", "path": "/posts/1", "expected_status": 200}]}, "execution_config": {}, "mode": "automated"}'

# 5. OpenAPI validation
curl -X POST http://localhost:8000/api/v2/testing/openapi/validate \
  -d '{"spec": {...petstore...}}'

# 6. Security scan
curl -X POST http://localhost:8000/api/v2/testing/security/scan \
  -d '{"target_url": "https://httpbin.org", "tests": ["bola", "auth_matrix"]}'
```

---

## Recommended Test Sequence

1. **Start backend**: `uvicorn app.main:app --reload`
2. **Check health**: `curl http://localhost:8000/health`
3. **Get capabilities**: Verify all features listed
4. **Test DataGen**: Generate 100 emails, verify uniqueness
5. **Test Mock Server**: Create, start, hit endpoint, verify logs
6. **Test Execution**: Run against JSONPlaceholder
7. **Test Assertions**: Verify JSONPath, status, time
8. **Test Chaining**: Login → use token
9. **Test Security**: Scan httpbin.org
10. **Test Reports**: Generate and view HTML report

---

## Install Faker for Full Testing

```bash
pip install faker
```

This enables unlimited unique data generation (10,000+).
