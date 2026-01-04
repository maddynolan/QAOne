# 🎯 ArisTrace Performance Testing - Complete Usage Guide

**Version:** 1.0  
**Last Updated:** January 2026

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Test Types](#test-types)
4. [Method 1: Quick Start Scenarios](#method-1-quick-start-scenarios)
5. [Method 2: Import HAR File](#method-2-import-har-file)
6. [Method 3: From Recording](#method-3-from-recording)
7. [Method 4: From API Tab](#method-4-from-api-tab)
8. [Method 5: Manual Configuration](#method-5-manual-configuration)
9. [Understanding Results](#understanding-results)
10. [Setting Thresholds](#setting-thresholds)
11. [Data Parameterization](#data-parameterization)
12. [Correlation Setup](#correlation-setup)
13. [Advanced: Go Runner](#advanced-go-runner)
14. [Troubleshooting](#troubleshooting)
15. [Best Practices](#best-practices)

---

## 🚀 Quick Start

**Run your first load test in 60 seconds:**

1. Go to **Perf** tab
2. Enter your target URL (e.g., `http://localhost:8002`)
3. Click **▶ Run** on "API Load Test"
4. Watch **Metrics** tab for live results
5. Check **Results** tab for PASS/FAIL

That's it! Now let's dive deeper.

---

## 📦 Prerequisites

### Backend Server

Make sure the backend is running:

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Demo Target (Optional)

For testing, start the e-commerce demo:

```bash
cd backend
python test_ecommerce_server.py
# Runs on http://localhost:8002
```

### Go Runner (Optional - for high load)

For tests with 500+ virtual users:

**Windows - Install Go:**
```powershell
# Option 1: Download installer from https://go.dev/dl/
# Option 2: Use winget
winget install GoLang.Go

# Restart terminal, then verify
go version
```

**Build Go Runner:**
```powershell
cd C:\QAAI\runner
go mod download
go build -o runner.exe ./cmd/runner
```

---

## 🧪 Test Types

| Test Type | Purpose | VUs | Duration | Pattern |
|-----------|---------|-----|----------|---------|
| **Smoke Test** | Verify system works | 1-5 | 1-5 min | Constant |
| **Load Test** | Normal capacity | 10-100 | 5-30 min | Ramp up/down |
| **Stress Test** | Find breaking point | 100-500 | 15-60 min | Stepped increase |
| **Spike Test** | Sudden traffic burst | 10→500→10 | 5-10 min | Sharp spike |
| **Endurance Test** | Memory leaks, stability | 50-100 | 1-8 hours | Constant |

---

## 📌 Method 1: Quick Start Scenarios

**Best for:** Getting started quickly

### Step-by-Step

1. **Navigate to Perf Tab**
   - Click "Perf" in the left sidebar

2. **Enter Target URL**
   - In the "Target URL" field, enter: `http://localhost:8002`
   - Or your application URL: `https://api.yourapp.com`

3. **Choose a Scenario**
   - **API Load Test**: GET request to `/api/products`
   - **E-commerce Flow**: Login → Browse → Cart → Checkout
   - **Stress Test**: Gradually increase to 100 VUs
   - **Spike Test**: Sudden burst of traffic

4. **Click Run**
   - Click the **▶ Run** button next to your chosen scenario

5. **Monitor Progress**
   - Auto-navigates to **Metrics** tab
   - Watch real-time:
     - Active VUs
     - Requests/second
     - Response times (P50, P95, P99)
     - Error rate

6. **View Results**
   - When complete, auto-navigates to **Results** tab
   - See **PASS** or **FAIL** verdict
   - Review threshold breakdown

### Screenshot Guide

```
┌─────────────────────────────────────────────────────────────────────┐
│  Quick Start                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Target URL: [ http://localhost:8002                    ]           │
│                                                                      │
│  ┌─────────────────────────────────────────┬────────┐               │
│  │ 🔥 API Load Test                        │ ▶ Run  │               │
│  │ Simple GET request load test            │        │               │
│  │ 10 VUs • 60s • Ramp 10s                │        │               │
│  ├─────────────────────────────────────────┼────────┤               │
│  │ 🛒 E-commerce Flow                      │ ▶ Run  │               │
│  │ Login → Browse → Cart → Checkout        │        │               │
│  │ 20 VUs • 120s • Ramp 30s               │        │               │
│  └─────────────────────────────────────────┴────────┘               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📌 Method 2: Import HAR File

**Best for:** Testing real user journeys captured from browser

### What is HAR?

HAR (HTTP Archive) is a JSON file that records all HTTP requests made by your browser. It captures the exact sequence of API calls during a user session.

### Step-by-Step

1. **Capture HAR from Browser**

   **Chrome:**
   - Open DevTools (F12)
   - Go to **Network** tab
   - Check "Preserve log"
   - Navigate through your app
   - Right-click → **Save all as HAR with content**

   **Firefox:**
   - Open DevTools (F12)
   - Go to **Network** tab
   - Navigate through your app
   - Right-click → **Save All As HAR**

2. **Import HAR in ArisTrace**
   - Go to **Perf** tab
   - Click **HAR** tab (or "Import HAR")
   - Click **Browse** and select your `.har` file
   - Or drag & drop the file

3. **Preview Imported Steps**
   - Review extracted HTTP requests
   - Each request becomes a test step:
     ```
     ✓ GET /api/products
     ✓ POST /api/login
     ✓ GET /api/cart
     ✓ POST /api/checkout
     ```

4. **Configure Load Parameters**
   - Switch to **Config** tab
   - Set:
     - **Virtual Users**: 50
     - **Duration**: 300s (5 min)
     - **Ramp Up**: 60s
     - **Pattern**: Ramp Up

5. **Start Test**
   - Click **Start Test**
   - Monitor in **Metrics** tab

### Example HAR Structure

```json
{
  "log": {
    "entries": [
      {
        "request": {
          "method": "POST",
          "url": "https://api.example.com/login",
          "headers": [
            {"name": "Content-Type", "value": "application/json"}
          ],
          "postData": {
            "text": "{\"username\":\"test\",\"password\":\"pass\"}"
          }
        },
        "response": {
          "status": 200
        }
      }
    ]
  }
}
```

---

## 📌 Method 3: From Recording

**Best for:** Converting recorded browser sessions to load tests

### Step-by-Step

1. **Go to Record Tab**
   - Click "Record" in sidebar

2. **Enable Network Capture**
   - Toggle **"Capture Network"** ON
   - This records all HTTP requests during your session

3. **Start Recording**
   - Enter your target URL
   - Click **Start Recording**
   - Playwright browser opens

4. **Perform User Journey**
   - Navigate your application
   - Login, browse products, add to cart, etc.
   - Each action generates HTTP requests

5. **Stop Recording**
   - Click **Stop Recording**
   - You'll see:
     - UI steps (clicks, fills)
     - Network requests captured

6. **Send to Performance Tab**
   - Click **Send to Perf** (orange button)
   - Or click **API** to send to API tab

7. **Configure and Run**
   - Requests are now in Perf tab
   - Configure VUs, duration
   - Click **Start Test**

### Network Capture Toggle

```
┌─────────────────────────────────────────────────────────────────────┐
│  Recording Options                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ☑ Capture Network Traffic   ← Enable this!                        │
│                                                                      │
│  When enabled, all HTTP requests during recording                   │
│  will be captured for API and Performance testing.                  │
│                                                                      │
│  ☐ Performance Test Type     (tag for load testing)                │
│  ☐ API Test Type             (tag for API testing)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📌 Method 4: From API Tab

**Best for:** Load testing existing API collections

### Step-by-Step

1. **Go to API Tab**
   - Click "API" in sidebar

2. **Create or Import Requests**
   - **Manual**: Click "New Request"
   - **Import**: Import OpenAPI/Swagger spec
   - **From Recording**: See Method 3

3. **Test API Requests**
   - Verify each request works individually
   - Check responses are correct

4. **Send to Performance**
   - Select requests you want to load test
   - Click **Send to Perf** button
   - Or right-click → "Add to Performance Test"

5. **Configure Load Test**
   - In Perf tab, configure:
     - Virtual Users
     - Duration
     - Thresholds

6. **Run Test**
   - Click **Start Test**

### API → Perf Flow

```
API Tab                         Perf Tab
┌──────────────────┐           ┌──────────────────┐
│ POST /api/login  │           │ Step 1: Login    │
│ GET /api/users   │  ──────▶  │ Step 2: Get Users│
│ PUT /api/profile │           │ Step 3: Update   │
└──────────────────┘           └──────────────────┘
```

---

## 📌 Method 5: Manual Configuration

**Best for:** Custom scenarios, specific endpoints

### Step-by-Step

1. **Go to Perf Tab**

2. **Click Config Tab**

3. **Configure Test Parameters**

   | Parameter | Description | Example |
   |-----------|-------------|---------|
   | **Name** | Test name | "API Stress Test" |
   | **Target URL** | Base URL | `https://api.example.com` |
   | **Virtual Users** | Concurrent users | 100 |
   | **Duration** | Test length (seconds) | 300 |
   | **Ramp Up Time** | Time to reach max VUs | 60 |
   | **Pattern** | Load pattern | Ramp Up |

4. **Add Test Steps (Steps Tab)**

   ```
   + Add Step
   
   Name:    [ Login Request                ]
   Method:  [ POST ▼ ]
   URL:     [ /api/login                   ]
   Headers: { "Content-Type": "application/json" }
   Body:    { "username": "${user}", "password": "${pass}" }
   ```

5. **Set Thresholds**

   ```
   + Add Threshold
   
   Metric:   [ P95 Response Time ▼ ]
   Operator: [ < ▼ ]
   Value:    [ 800 ] ms
   Critical: [ ☑ ]
   ```

6. **Start Test**
   - Click **Start Test**

---

## 📊 Understanding Results

### Results Tab Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ✅  PASS                                    Thresholds: 4/4  │  │
│  │                                                                │  │
│  │  All thresholds passed successfully                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ ✓ P95    │ │ ✓ P99    │ │ ✓ Errors │ │ ✓ RPS    │              │
│  │ < 800ms  │ │ < 2000ms │ │ < 1%     │ │ > 10     │              │
│  │ ───────  │ │ ───────  │ │ ───────  │ │ ───────  │              │
│  │ 450ms ✓  │ │ 890ms ✓  │ │ 0.5% ✓   │ │ 125 ✓    │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                      │
│  Summary Statistics                                                  │
│  ─────────────────                                                   │
│  Total Requests:     12,450                                          │
│  Successful:         12,388 (99.5%)                                  │
│  Failed:             62 (0.5%)                                       │
│  Peak RPS:           145.2                                           │
│                                                                      │
│  Response Times                                                      │
│  ─────────────                                                       │
│  Min:    45ms                                                        │
│  Avg:    230ms                                                       │
│  P50:    180ms                                                       │
│  P95:    450ms                                                       │
│  P99:    890ms                                                       │
│  Max:    2,340ms                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Metrics Explained

| Metric | What It Means | Good Value |
|--------|---------------|------------|
| **P50** | 50% of requests faster than this | < 200ms |
| **P95** | 95% of requests faster than this | < 800ms |
| **P99** | 99% of requests faster than this | < 2000ms |
| **RPS** | Requests per second | Depends on system |
| **Error Rate** | % of failed requests | < 1% |

### Verdict Rules

| Condition | Verdict |
|-----------|---------|
| All thresholds pass | ✅ **PASS** |
| Any critical threshold fails | ❌ **FAIL** |
| Non-critical threshold fails | ⚠️ **WARN** (shows as FAIL) |

---

## ⚙️ Setting Thresholds

### Default Thresholds

```json
{
  "thresholds": [
    {"metric": "response_time.p95", "op": "<", "value": 800, "critical": false},
    {"metric": "response_time.p99", "op": "<", "value": 2000, "critical": false},
    {"metric": "error_rate", "op": "<", "value": 0.01, "critical": true},
    {"metric": "throughput.rps", "op": ">", "value": 10, "critical": false}
  ]
}
```

### Custom Thresholds via API

```bash
POST /api/performance/runs/create
{
  "scenario_id": "...",
  "virtual_users": 100,
  "duration_seconds": 300,
  "thresholds": [
    {
      "metric": "response_time.p95",
      "operator": "<",
      "value": 500,
      "severity": "critical",
      "name": "P95 must be under 500ms"
    },
    {
      "metric": "error_rate",
      "operator": "<",
      "value": 0.005,
      "severity": "critical",
      "name": "Error rate under 0.5%"
    }
  ]
}
```

### Available Metrics

| Metric | Description |
|--------|-------------|
| `response_time.min` | Minimum response time |
| `response_time.avg` | Average response time |
| `response_time.p50` | 50th percentile |
| `response_time.p75` | 75th percentile |
| `response_time.p90` | 90th percentile |
| `response_time.p95` | 95th percentile |
| `response_time.p99` | 99th percentile |
| `response_time.max` | Maximum response time |
| `throughput.rps` | Requests per second |
| `error_rate` | Error rate (0-1) |
| `iterations.total` | Total requests |
| `iterations.errors` | Failed requests |

---

## 📄 Data Parameterization

### What is Parameterization?

Instead of sending the same data every time, use different values for each virtual user:

```
Without Parameterization:
  VU1: POST /login {"user": "test", "pass": "123"}
  VU2: POST /login {"user": "test", "pass": "123"}  ← Same!
  VU3: POST /login {"user": "test", "pass": "123"}  ← Same!

With Parameterization:
  VU1: POST /login {"user": "user1", "pass": "pass1"}
  VU2: POST /login {"user": "user2", "pass": "pass2"}  ← Different!
  VU3: POST /login {"user": "user3", "pass": "pass3"}  ← Different!
```

### Create Data Pool

1. **Prepare CSV file** (`users.csv`):
   ```csv
   username,password,email
   user1,pass123,user1@test.com
   user2,pass456,user2@test.com
   user3,pass789,user3@test.com
   ```

2. **Create Pool via API**:
   ```bash
   POST /api/performance/data-pools/create
   {
     "pool_id": "test_users",
     "name": "Test Users",
     "data_source": "users.csv",
     "access_mode": "unique"
   }
   ```

3. **Use in Requests**:
   ```json
   {
     "url": "/api/login",
     "body": {
       "username": "${username}",
       "password": "${password}"
     }
   }
   ```

### Access Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `sequential` | Read in order, wrap around | Predictable tests |
| `random` | Random selection | Realistic distribution |
| `unique` | Each VU gets unique data | No login conflicts |
| `shared` | Round-robin across VUs | Global queue |

---

## 🔗 Correlation Setup

### What is Correlation?

Capture dynamic values from responses and use them in subsequent requests:

```
1. POST /login
   Response: {"token": "abc123"}
   
2. Extract: token = "abc123"

3. GET /api/data
   Headers: {"Authorization": "Bearer abc123"}
   ↑ Uses extracted token
```

### Auto-Detected Values

The engine automatically detects and extracts:
- Session IDs (`JSESSIONID`, `PHPSESSID`)
- CSRF tokens (`csrf_token`, `_token`)
- Auth tokens (`access_token`, `Bearer`)

### Manual Extraction

In your scenario JSON:

```json
{
  "steps": [
    {
      "name": "Login",
      "method": "POST",
      "url": "/api/login",
      "body": {"username": "${username}", "password": "${password}"},
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
      "method": "GET",
      "url": "/api/users/${user_id}",
      "headers": {
        "Authorization": "Bearer ${auth_token}"
      }
    }
  ]
}
```

---

## ⚡ Advanced: Go Runner

### When to Use Go Runner

| VUs | Recommended |
|-----|-------------|
| < 100 | Python (default) |
| 100-500 | Either |
| 500+ | **Go Runner** |

### Install Go (Windows)

```powershell
# Option 1: Download from https://go.dev/dl/
# Download: go1.21.6.windows-amd64.msi
# Run installer, follow prompts

# Option 2: winget
winget install GoLang.Go

# Option 3: Chocolatey
choco install golang

# Verify (restart terminal first!)
go version
# Should show: go version go1.21.x windows/amd64
```

### Build Go Runner

```powershell
cd C:\QAAI\runner

# Download dependencies
go mod download

# Build
go build -o runner.exe ./cmd/runner

# Verify
.\runner.exe --help
```

### Run Go Runner

**Standalone (quick test):**
```powershell
.\runner.exe --standalone --scenario C:\QAAI\test_scenario.json
```

**Server mode (for controller):**
```powershell
.\runner.exe --port 50051 --max-vus 5000
```

### Start via API

```bash
# Start local Go runner
POST http://localhost:8000/api/performance/runner/start-local
{"max_vus": 5000}

# Check status
GET http://localhost:8000/api/performance/runner/status

# Response:
{
  "go_runner_available": true,
  "runner_count": 1,
  "available_capacity": 5000
}
```

---

## 🔧 Troubleshooting

### "Go command not found"

**Problem:** Go is not installed or not in PATH.

**Solution:**
1. Install Go from https://go.dev/dl/
2. Restart your terminal
3. Verify with `go version`

### "Connection refused to localhost:8000"

**Problem:** Backend server not running.

**Solution:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### "No results showing in Metrics tab"

**Problem:** UI not polling correctly.

**Solution:**
1. Check browser console for errors (F12)
2. Verify backend is running
3. Try "Results" tab after test completes

### "All requests failing"

**Problem:** Target URL incorrect or server down.

**Solution:**
1. Verify target URL is accessible
2. Test URL in browser first
3. Check firewall/CORS settings

### "Python fallback being used instead of Go"

**Problem:** Go runner not available.

**Solution:**
1. Build Go runner: `cd runner && go build -o runner.exe ./cmd/runner`
2. Start via API: `POST /api/performance/runner/start-local`
3. Verify with: `GET /api/performance/runner/status`

---

## ✅ Best Practices

### 1. Start Small

```
First test:  10 VUs × 60s
Then:        50 VUs × 120s
Then:       100 VUs × 300s
```

### 2. Use Ramp-Up

Always use ramp-up to avoid shocking the system:
```
Ramp Up Time = VUs / 10
Example: 100 VUs → 10s ramp-up
```

### 3. Set Realistic Thresholds

Based on your SLAs:
```
- Consumer apps: P95 < 1000ms
- Internal apps: P95 < 500ms
- APIs: P95 < 200ms
```

### 4. Run Multiple Times

Single runs can be misleading. Run 3+ times to get consistent data.

### 5. Test During Off-Hours

If testing production, schedule during low-traffic periods.

### 6. Monitor Server Resources

Watch CPU/memory on the target server, not just response times.

### 7. Use Parameterization

Avoid cache hits by using unique data per VU.

---

## 📚 Example Scenarios

### Basic API Test

```json
{
  "name": "Basic API Test",
  "config": {
    "virtual_users": 10,
    "duration_seconds": 60,
    "ramp_up_seconds": 10,
    "target_url": "http://localhost:8002"
  },
  "steps": [
    {
      "type": "http",
      "method": "GET",
      "url": "${target_url}/api/products"
    }
  ]
}
```

### Login Flow

```json
{
  "name": "Login Flow",
  "steps": [
    {
      "name": "Login",
      "type": "http",
      "method": "POST",
      "url": "/api/login",
      "body": {"username": "${user}", "password": "${pass}"},
      "extract": [{"name": "token", "from": "json", "path": "$.token"}]
    },
    {
      "name": "Think Time",
      "type": "think",
      "think_time_ms": 2000
    },
    {
      "name": "Get Profile",
      "type": "http",
      "method": "GET",
      "url": "/api/profile",
      "headers": {"Authorization": "Bearer ${token}"}
    }
  ]
}
```

### E-commerce Flow

```json
{
  "name": "E-commerce Checkout",
  "steps": [
    {"type": "http", "method": "GET", "url": "/api/products"},
    {"type": "think", "think_time_ms": 1500},
    {"type": "http", "method": "POST", "url": "/api/cart", "body": {"product_id": 1}},
    {"type": "think", "think_time_ms": 2000},
    {"type": "http", "method": "GET", "url": "/api/cart"},
    {"type": "think", "think_time_ms": 1000},
    {"type": "http", "method": "POST", "url": "/api/checkout"}
  ]
}
```

---

## 🎉 Summary

| Method | Best For | Difficulty |
|--------|----------|------------|
| Quick Start | Getting started | ⭐ Easy |
| HAR Import | Real user journeys | ⭐⭐ Medium |
| From Recording | UI-based capture | ⭐⭐ Medium |
| From API Tab | Existing APIs | ⭐⭐ Medium |
| Manual Config | Custom scenarios | ⭐⭐⭐ Advanced |
| Go Runner | High load (500+ VUs) | ⭐⭐⭐ Advanced |

---

**Need help?** Check the architecture doc: `docs/PERFORMANCE_TESTING_ARCHITECTURE.md`

*© 2026 ArisTrace - Excellence in Every QA Trace*

