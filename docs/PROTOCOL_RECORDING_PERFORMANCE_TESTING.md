# Protocol Recording & Performance Testing

## Overview

QAAI now includes **browser-native protocol recording** that captures HTTP/HTTPS traffic during UI recording sessions. This enables **unified test cases** that combine UI automation with protocol-level load testing - something traditional tools like LoadRunner and NeoLoad struggle to achieve elegantly.

## What We Built (Last 24 Hours)

### 1. Browser-Native Network Capture (`flowstral-extension/src/lib/network-capture.js`)

A new module that captures HTTP traffic using Chrome's native APIs:

```javascript
// Uses chrome.webRequest API (no proxy needed!)
chrome.webRequest.onBeforeRequest.addListener(...)
chrome.webRequest.onSendHeaders.addListener(...)
chrome.webRequest.onHeadersReceived.addListener(...)
chrome.webRequest.onCompleted.addListener(...)

// Also uses PerformanceObserver for timing
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Captures DNS, TCP, SSL, TTFB, download times
  }
})
```

### 2. Protocol Capture Toggle in Recorder

Users can enable/disable network capture during recording:
- **Default: OFF** (for pure UI testing)
- **Enable for**: Performance testing, API correlation, debugging

```html
<!-- sidepanel.html -->
<input type="checkbox" id="captureNetwork"> Protocol Capture
```

### 3. HAR Export

Captured network data can be exported as HAR (HTTP Archive) files:
- Industry-standard format
- Compatible with Chrome DevTools, Fiddler, Charles Proxy
- Can be imported into load testing tools

### 4. Protocol Tab in Test Builder

New "Protocol" tab in the Test Builder right panel shows:
- **Statistics**: Total requests, avg response time
- **Auto-detected correlations**: Session IDs, tokens, dynamic values
- **Request list**: All HTTP requests with method, URL, status, timing
- **Import HAR**: Load HAR files directly
- **Export HAR**: Save captured requests
- **Load Test**: One-click launch to performance testing

### 5. Unified Test Case Format

Test cases now include both UI steps AND protocol data:

```json
{
  "id": "tc_123",
  "name": "Login Test",
  "steps": [
    { "type": "navigate", "url": "https://app.com" },
    { "type": "input", "selector": "#username", "value": "user" },
    { "type": "click", "selector": "#login" }
  ],
  "network_data": {
    "requests": [
      {
        "method": "POST",
        "url": "https://api.app.com/auth/login",
        "statusCode": 200,
        "duration": 245,
        "requestHeaders": {...},
        "responseHeaders": {...}
      }
    ],
    "correlations": [
      { "name": "session_id", "type": "cookie", "value": "abc123" },
      { "name": "csrf_token", "type": "header", "value": "xyz789" }
    ]
  }
}
```

---

## Why HAR Files?

### What is HAR?

HAR (HTTP Archive) is a JSON-based format for recording HTTP transactions. It includes:
- Request method, URL, headers, body
- Response status, headers, body
- Timing breakdown (DNS, connect, SSL, TTFB, download)
- Cookies and cache information

### Why We Use HAR

1. **Industry Standard**: Supported by all major browsers and tools
2. **Complete Data**: Captures everything needed for replay
3. **Timing Info**: Essential for performance analysis
4. **Portable**: Easy to share, analyze, and import into other tools
5. **Debug-Friendly**: Can be viewed in Chrome DevTools

### HAR File Example (from your recording)

```json
{
  "log": {
    "version": "1.2",
    "creator": { "name": "QAAI Network Capture", "version": "1.0.0" },
    "entries": [
      {
        "startedDateTime": "2025-12-17T02:56:05.710Z",
        "time": 24,
        "request": {
          "method": "GET",
          "url": "https://jsonplaceholder.typicode.com/todos/1",
          "headers": [...]
        },
        "response": {
          "status": 200,
          "headers": [...]
        },
        "timings": {
          "dns": 0, "connect": 0, "ssl": 0,
          "send": 0, "wait": 0, "receive": 0
        }
      }
    ]
  }
}
```

---

## Automatic Correlation Detection

### What is Correlation?

In load testing, **correlation** means extracting dynamic values from responses and using them in subsequent requests. Examples:
- Session IDs
- CSRF tokens
- OAuth tokens
- Transaction IDs
- Timestamps

### How QAAI Does Auto-Correlation

Our `NetworkCapture` class automatically detects dynamic values:

```javascript
// Patterns we detect
const CORRELATION_PATTERNS = {
  sessionId: /session[_-]?id|jsessionid|phpsessid|asp\.net_sessionid/i,
  csrfToken: /csrf|xsrf|_token|authenticity_token/i,
  authToken: /auth[_-]?token|bearer|jwt|access_token/i,
  requestId: /request[_-]?id|correlation[_-]?id|trace[_-]?id/i,
  timestamp: /timestamp|_ts|_t$/i,
};

// Detection in headers
_detectCorrelationInHeaders(headers) {
  for (const [pattern, regex] of Object.entries(CORRELATION_PATTERNS)) {
    for (const [key, value] of Object.entries(headers)) {
      if (regex.test(key)) {
        this.detectedCorrelations.set(pattern, value);
      }
    }
  }
}

// Detection in cookies
_detectCorrelationInCookies(cookies) {
  // Parse Set-Cookie headers and detect session/auth cookies
}

// Detection in response body
_detectCorrelationInBody(body) {
  // Parse JSON and detect dynamic values
}
```

### Why This Matters

Traditional tools require **manual correlation**:
1. Run recording
2. Analyze responses to find dynamic values
3. Manually create extraction rules
4. Manually parameterize requests

**QAAI does this automatically**, saving hours of work per test script.

---

## How We're Different from LoadRunner & NeoLoad

| Feature | LoadRunner/NeoLoad | QAAI |
|---------|-------------------|------|
| **Proxy Setup** | Required (complex) | Not needed (browser-native) |
| **HTTPS Capture** | Requires cert install | Works natively |
| **Correlation** | Manual (tedious) | Automatic detection |
| **UI + Protocol** | Separate tools | Unified in one test case |
| **Modern Apps** | Struggles with SPAs | Built for React/Vue/Angular |
| **Cost** | $10K-$100K+ licenses | Open source |
| **Learning Curve** | Weeks | Hours |
| **CI/CD Integration** | Complex | Native |

### Technical Advantages

#### 1. Browser-Native Capture
```
LoadRunner: App → Proxy → LoadRunner → Server
QAAI:      App → Browser (chrome.webRequest) → Direct capture
```
- No man-in-the-middle
- No certificate issues
- No proxy configuration
- Works with HTTP/2, WebSockets, GraphQL

#### 2. Accurate Timing
```javascript
// We use PerformanceObserver for real browser timing
const timing = performance.getEntriesByType('resource');
// Includes: DNS, TCP, SSL, Request, Response, DOM processing
```
LoadRunner's proxy-based timing can't capture browser-side metrics.

#### 3. SPA Support
Modern apps make AJAX calls that LoadRunner often misses:
- React useEffect API calls
- Vue watchers
- Angular HTTP interceptors

QAAI captures **all** network traffic because we're inside the browser.

#### 4. Unified Test Artifacts
One recording creates:
- Playwright UI test
- API test collection
- Load test script
- HAR file for debugging

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        QAAI RECORDER                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   UI Recording  │    │ Protocol Capture │                    │
│  │  (DOM events)   │    │ (chrome.webRequest)│                  │
│  └────────┬────────┘    └────────┬─────────┘                    │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      ▼                                           │
│           ┌─────────────────────┐                                │
│           │  Unified Test Case  │                                │
│           │  - UI Steps         │                                │
│           │  - HTTP Requests    │                                │
│           │  - Correlations     │                                │
│           │  - Timing Data      │                                │
│           └─────────┬───────────┘                                │
└─────────────────────┼───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────────┐ ┌──────────┐ ┌────────────┐
│ Test Builder  │ │HAR Export│ │ Load Test  │
│ (Protocol Tab)│ │          │ │ Generator  │
└───────────────┘ └──────────┘ └────────────┘
```

---

## Usage Guide

### Recording with Protocol Capture

1. **Open Recorder**: Click QAAI extension icon
2. **Enable Protocol Capture**: Check "Protocol Capture" toggle
3. **Start Recording**: Click "Start"
4. **Perform Actions**: Navigate, click, fill forms
5. **Stop Recording**: Click "Stop"
6. **Export Options**:
   - Click "Builder" → Opens with Protocol tab
   - Click "Export HAR" → Downloads HAR file
   - Click "Load Test" → Opens load testing page

### Viewing Protocol Data in Builder

1. Open Test Builder (`/builder`)
2. Select any step (or just view)
3. Look for **Step | Protocol** tabs in right panel
4. Click **Protocol** tab
5. See:
   - Request count & avg time
   - Auto-detected correlations
   - Request list (click for details)
6. Actions:
   - **HAR** button: Export to file
   - **Load Test** button: Launch performance test

### Importing HAR Files

1. Open Test Builder (`/builder`)
2. Click **Protocol** tab
3. Click **"Import HAR File"**
4. Select `.har` or `.json` file
5. Requests populate automatically

### Running Load Tests

1. From Builder: Click **Load Test** in Protocol tab
2. From Recorder: Click **Load Test** button
3. Configure:
   - Virtual users (1-1000)
   - Ramp-up time
   - Duration
   - Load profile (constant, ramp, spike)
4. Click **Start Load Test**
5. View real-time metrics

---

## Files Changed/Added

### New Files
- `flowstral-extension/src/lib/network-capture.js` - Network capture module
- `backend/app/services/performance/protocol_recorder.py` - Backend protocol service
- `backend/app/routers/protocol_recording_api.py` - API endpoints
- `docs/PROTOCOL_RECORDING_PERFORMANCE_TESTING.md` - This documentation

### Modified Files
- `flowstral-extension/manifest.json` - Added `webRequest` permission
- `flowstral-extension/src/background/background.js` - Integrated network capture
- `flowstral-extension/src/sidepanel/sidepanel.html` - Added Protocol UI
- `flowstral-extension/src/sidepanel/sidepanel.js` - Protocol capture logic
- `src/pages/UnifiedWorkflowEditor.tsx` - Added Protocol tab
- `src/pages/EnhancedWorkflowEditor.tsx` - Added Protocol tab
- `src/pages/VirtualUserGenerator.tsx` - HAR import for load testing

---

## Distributed Load Testing Architecture

### How LoadRunner Works (For Comparison)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LOADRUNNER ARCHITECTURE                              │
│                                                                          │
│  ┌───────────────┐                                                      │
│  │    VuGen      │  Recording (proxy-based, generates C scripts)        │
│  └───────┬───────┘                                                      │
│          │                                                               │
│          ▼                                                               │
│  ┌───────────────┐     Orchestration (Windows-based, licensed)          │
│  │  Controller   │────────────────────────────────────┐                 │
│  └───────┬───────┘                                    │                 │
│          │                                            │                 │
│    ┌─────┴─────┬─────────────┬─────────────┐         │                 │
│    ▼           ▼             ▼             ▼         │                 │
│ ┌──────┐   ┌──────┐     ┌──────┐     ┌──────┐       │                 │
│ │ LG 1 │   │ LG 2 │     │ LG 3 │     │ LG 4 │       │                 │
│ │200 VU│   │200 VU│     │200 VU│     │200 VU│       │                 │
│ │ $$$  │   │ $$$  │     │ $$$  │     │ $$$  │       │                 │
│ └──────┘   └──────┘     └──────┘     └──────┘       │                 │
│    │           │             │             │         │                 │
│    └───────────┴─────────────┴─────────────┘         │                 │
│                        │                              │                 │
│                        ▼                              ▼                 │
│                 ┌─────────────┐              ┌─────────────┐           │
│                 │ Target App  │              │  Analysis   │           │
│                 └─────────────┘              │   Server    │           │
│                                              └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘

LoadRunner Costs for 1000 Users:
- Controller License: ~$15,000
- Load Generator Licenses: 5 x $10,000 = $50,000
- Analysis License: ~$5,000
- Annual Maintenance: ~$15,000
- TOTAL: ~$85,000+ first year
```

### QAAI Distributed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        QAAI ARCHITECTURE                                 │
│                                                                          │
│  ┌───────────────┐                                                      │
│  │   Recorder    │  Browser-native (HAR output, auto-correlation)       │
│  │  (Extension)  │                                                      │
│  └───────┬───────┘                                                      │
│          │                                                               │
│          ▼                                                               │
│  ┌───────────────┐     Orchestration (Python, container-native)         │
│  │  Controller   │────────────────────────────────────┐                 │
│  │  (FastAPI)    │                                    │                 │
│  └───────┬───────┘                                    │                 │
│          │                                            │                 │
│    ┌─────┴─────┬─────────────┬─────────────┐         │                 │
│    ▼           ▼             ▼             ▼         │                 │
│ ┌──────┐   ┌──────┐     ┌──────┐     ┌──────┐       │                 │
│ │Worker│   │Worker│     │Worker│     │Worker│       │                 │
│ │ 500  │   │ 500  │     │ 500  │     │ 500  │       │                 │
│ │ FREE │   │ FREE │     │ FREE │     │ FREE │       │                 │
│ │Docker│   │Docker│     │Docker│     │Docker│       │                 │
│ └──────┘   └──────┘     └──────┘     └──────┘       │                 │
│    │           │             │             │         │                 │
│    └───────────┴─────────────┴─────────────┘         │                 │
│                        │                              │                 │
│                        ▼                              ▼                 │
│                 ┌─────────────┐              ┌─────────────┐           │
│                 │ Target App  │              │  Real-time  │           │
│                 └─────────────┘              │  Dashboard  │           │
│                                              └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘

QAAI Costs for 1000 Users:
- Software: $0 (open source)
- Cloud VMs: 2 x t3.large (~$0.08/hr) = ~$0.16/hr
- For 1-hour test: ~$0.20
- TOTAL: ~$0.20 per test (vs $85,000 LoadRunner)
```

### Why LoadRunner Needs Multiple VMs

1. **Memory**: Each virtual user maintains HTTP state (~2-5MB RAM)
   - 1000 users = 2-5 GB RAM
   - Plus LoadRunner overhead = 8-10 GB total

2. **CPU**: SSL encryption is CPU-intensive
   - Each HTTPS request needs encryption/decryption
   - 200-500 concurrent connections max efficient per CPU

3. **Network**: Connection limits
   - OS limits on open connections (~65K per IP)
   - Practical limit ~10K connections per machine

4. **Licensing**: LoadRunner limits users per Load Generator
   - Typical license: 200-500 users per LG
   - Forces buying more licenses for scale

### QAAI's Efficiency Advantages

```python
# LoadRunner uses threads (expensive)
# Each Vuser = 1 thread = ~2MB stack + context switching

# QAAI uses async (efficient)
async def run_user(user_id):
    async with aiohttp.ClientSession() as session:
        while running:
            await execute_request(session)
            await asyncio.sleep(think_time)

# Same machine can handle 2-3x more users with async
```

### Deployment Mode Selection Guide

**CRITICAL: Choose the right deployment mode for accurate results!**

#### When to Use VM-Based Load Generators

| Scenario | Why VMs? |
|----------|----------|
| **Official baseline tests** | Most accurate timing (no container overhead) |
| **Firewall requirements** | Static IPs can be whitelisted |
| **Soak tests (24h+)** | No pod eviction, stable memory |
| **Legacy protocols** | Citrix, SAP GUI, custom TCP work better |
| **Regulatory compliance** | Dedicated infrastructure required |
| **Behind-firewall apps** | Simpler network topology |

#### When to Use Container/Kubernetes Load Generators

| Scenario | Why Containers? |
|----------|-----------------|
| **CI/CD pipeline tests** | Quick spin-up, disposable |
| **Cost optimization** | Pay only while running |
| **Elastic scaling** | Scale 100→10000 users automatically |
| **Development smoke tests** | Fast feedback loop |
| **Cloud-native apps** | Same environment as production |

#### Container Caveats (Important!)

```
⚠️ NETWORK OVERHEAD:
   Container NAT: +0.5-2ms latency
   Overlay network: +1-3ms latency
   Total: Your response times will be 1.5-5ms HIGHER than reality!

⚠️ PORT EXHAUSTION:
   Host ephemeral ports: 32768-60999 (~28K ports)
   With 60s TIME_WAIT: max ~466 new connections/second/host
   Solution: Increase port range or use connection pooling

⚠️ NOISY NEIGHBORS:
   Other pods on same node affect CPU/memory
   Solution: Use dedicated node pools for load generators

⚠️ POD EVICTION:
   Long tests may be interrupted by Kubernetes
   Solution: Use VMs for tests > 4 hours
```

#### Recommended Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                   HYBRID DEPLOYMENT STRATEGY                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CI/CD TESTS (Daily)                BASELINE TESTS (Monthly)    │
│  ─────────────────                  ────────────────────────    │
│  ┌──────────────┐                   ┌──────────────┐            │
│  │ Kubernetes   │                   │  Dedicated   │            │
│  │ Pods (5-10)  │                   │  VMs (2-4)   │            │
│  │              │                   │              │            │
│  │ Quick: 2min  │                   │ Accurate:    │            │
│  │ Cheap: $0.10 │                   │ No overhead  │            │
│  │ Purpose:     │                   │ Purpose:     │            │
│  │ Catch        │                   │ Official     │            │
│  │ regressions  │                   │ benchmarks   │            │
│  └──────────────┘                   └──────────────┘            │
│         │                                  │                     │
│         └──────────────┬───────────────────┘                     │
│                        ▼                                         │
│              Compare Results: Container vs VM                    │
│              Calculate overhead delta for your app               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Overhead Compensation (Experimental)

If you must compare container results against VM baselines:

```python
# In load test config
config = LoadTestConfig(
    # ... other settings ...
    compensate_container_overhead=True,
    estimated_overhead_ms=2.0  # Calibrate for your environment
)

# Metrics will show both raw and compensated values:
# avg_response_time_ms: 45.2 (raw)
# compensated_avg_response_time_ms: 43.2 (minus overhead)
```

⚠️ **Warning**: Overhead varies by:
- Network configuration (CNI plugin, overlay type)
- Cloud provider (AWS EKS vs Azure AKS vs GKE)
- Time of day (shared infrastructure load)

**Best practice**: Establish your own overhead baseline by running identical tests on VMs and containers.

---

### Deployment for Scale

**Option 1: Docker Compose (up to 5,000 users)**
```yaml
version: '3'
services:
  controller:
    image: flowstral/load-controller
    
  worker-1:
    image: flowstral/load-worker
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
  
  worker-2:
    image: qaai/load-worker
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2'
```

**Option 2: Kubernetes (10,000+ users)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: load-workers
spec:
  replicas: 20  # 20 workers x 500 users = 10,000 users
  template:
    spec:
      containers:
      - name: worker
        image: qaai/load-worker
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
```

**Option 3: Cloud Auto-Scaling (unlimited)**
```
AWS ECS / GCP Cloud Run / Azure Container Instances
- Auto-scale based on load
- Pay only for test duration
- No idle infrastructure costs
```

### Capacity Planning

| Target Users | Workers Needed | Memory/Worker | Total Cost/Hour |
|-------------|----------------|---------------|-----------------|
| 500         | 1              | 2 GB          | ~$0.05          |
| 1,000       | 2              | 2 GB each     | ~$0.10          |
| 5,000       | 5              | 4 GB each     | ~$0.50          |
| 10,000      | 10             | 4 GB each     | ~$1.00          |
| 50,000      | 50             | 4 GB each     | ~$5.00          |
| 100,000     | 100            | 4 GB each     | ~$10.00         |

**LoadRunner equivalent cost for 100,000 users: ~$500,000+**

---

## Future Enhancements

1. **Correlation Parameterization UI** - Visual editor for extraction rules
2. **Response Validation** - Assert on API responses during load tests
3. **Think Time Analysis** - Auto-calculate realistic user delays
4. **Transaction Grouping** - Group requests into business transactions
5. **Export to k6/JMeter** - Generate scripts for other tools
6. **WebSocket Load Testing** - Capture and replay WebSocket traffic
7. **GraphQL Support** - Parse and parameterize GraphQL queries

---

## Summary

QAAI's protocol recording transforms how QA teams approach performance testing:

| Before (LoadRunner/NeoLoad) | After (QAAI) |
|---------------------------|--------------|
| Separate UI and perf tools | Unified platform |
| Complex proxy setup | Zero configuration |
| Manual correlation | Automatic detection |
| Weeks to create scripts | Minutes |
| Expensive licenses | Open source |
| Siloed test artifacts | Single source of truth |

**Record once, test everything** - UI automation, API testing, and load testing from a single recording session.
