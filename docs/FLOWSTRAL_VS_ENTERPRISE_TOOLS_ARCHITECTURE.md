# Flowstral Performance Testing Platform
## Architecture Comparison: Flowstral vs Enterprise Tools

**Document Version:** 1.0  
**Date:** December 16, 2024  
**Classification:** Technical Architecture Document

---

## Executive Summary

This document provides a comprehensive architectural comparison between **Flowstral** and traditional enterprise performance testing tools including HP LoadRunner, NeoLoad, and other market alternatives. Flowstral represents a modern, browser-native approach to performance testing that eliminates many of the complexities and costs associated with legacy solutions.

### Key Differentiators

| Capability | Flowstral | LoadRunner | NeoLoad | Gatling |
|------------|-----------|------------|---------|---------|
| Recording Method | Browser-Native | Proxy-Based | Proxy-Based | Code-Only |
| Correlation | Automatic | Manual | Semi-Auto | Manual |
| Protocol Support | HTTP/2, WS, GraphQL | Extensive | Extensive | HTTP/WS |
| UI + Protocol Unified | ✅ Yes | ❌ Separate | ❌ Separate | ❌ No UI |
| Container-Native | ✅ Yes | ❌ Limited | ⚠️ Partial | ✅ Yes |
| Open Source | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| Annual Cost (1000 users) | ~$500 | ~$85,000 | ~$50,000 | ~$2,000 |

---

## 1. Recording Architecture

### 1.1 Traditional Tools (LoadRunner/NeoLoad)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL PROXY-BASED RECORDING                         │
│                                                                              │
│   ┌──────────┐        ┌─────────────────────┐        ┌──────────────┐      │
│   │          │        │   RECORDING PROXY    │        │              │      │
│   │  Browser │───────▶│                     │───────▶│  Target App  │      │
│   │          │        │  • Port 8080/8888   │        │              │      │
│   └──────────┘        │  • SSL Termination  │        └──────────────┘      │
│        │              │  • Traffic Capture  │                               │
│        │              └──────────┬──────────┘                               │
│        │                         │                                          │
│        │              ┌──────────▼──────────┐                               │
│        │              │   SCRIPT GENERATOR   │                               │
│        │              │                     │                               │
│        │              │  LoadRunner: C code │                               │
│        │              │  NeoLoad: JavaScript │                               │
│        │              └─────────────────────┘                               │
│        │                                                                     │
│   REQUIREMENTS:                                                              │
│   ─────────────                                                              │
│   ✗ Configure browser proxy settings                                        │
│   ✗ Install SSL certificates for HTTPS                                      │
│   ✗ Firewall exceptions for proxy port                                      │
│   ✗ May conflict with corporate proxy                                       │
│   ✗ Cannot capture browser-only traffic (Service Workers)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Limitations of Proxy-Based Recording:**

1. **SSL Certificate Issues**
   - Must install and trust recording tool's CA certificate
   - Enterprise environments may block custom certificates
   - Certificate pinning in apps breaks recording

2. **Modern Web Incompatibility**
   - HTTP/2 multiplexing not fully supported
   - WebSocket capture is limited
   - Service Worker requests invisible to proxy

3. **Network Configuration**
   - Conflicts with corporate proxies
   - VPN issues
   - Firewall rules needed

---

### 1.2 Flowstral Browser-Native Recording

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOWSTRAL BROWSER-NATIVE RECORDING                        │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         CHROME BROWSER                               │   │
│   │                                                                      │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │                  FLOWSTRAL EXTENSION                          │  │   │
│   │   │                                                               │  │   │
│   │   │   ┌─────────────────┐    ┌─────────────────────────────┐    │  │   │
│   │   │   │  UI Recording   │    │    Protocol Capture          │    │  │   │
│   │   │   │  (DOM Events)   │    │    (chrome.webRequest)       │    │  │   │
│   │   │   │                 │    │                              │    │  │   │
│   │   │   │ • Click         │    │ • All HTTP/HTTPS traffic    │    │  │   │
│   │   │   │ • Input         │    │ • Headers & Bodies          │    │  │   │
│   │   │   │ • Navigate      │    │ • Timing (PerformanceAPI)   │    │  │   │
│   │   │   │ • Scroll        │    │ • Auto-correlation          │    │  │   │
│   │   │   └─────────────────┘    └─────────────────────────────┘    │  │   │
│   │   │              │                         │                     │  │   │
│   │   │              └───────────┬─────────────┘                     │  │   │
│   │   │                          ▼                                   │  │   │
│   │   │              ┌─────────────────────────┐                     │  │   │
│   │   │              │   UNIFIED TEST CASE     │                     │  │   │
│   │   │              │   • UI Steps            │                     │  │   │
│   │   │              │   • HTTP Requests       │                     │  │   │
│   │   │              │   • Correlations        │                     │  │   │
│   │   │              │   • HAR Export          │                     │  │   │
│   │   │              └─────────────────────────┘                     │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   │                                                                      │   │
│   │   ┌──────────────┐                              ┌──────────────┐    │   │
│   │   │  Target App  │◄────── Direct Connection ────│   Network    │    │   │
│   │   └──────────────┘       (No Proxy!)            └──────────────┘    │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ADVANTAGES:                                                                │
│   ───────────                                                                │
│   ✓ No proxy configuration needed                                           │
│   ✓ No SSL certificates to install                                          │
│   ✓ Works with corporate proxies/VPNs                                       │
│   ✓ Captures Service Worker traffic                                         │
│   ✓ Full HTTP/2 and WebSocket support                                       │
│   ✓ Unified UI + Protocol in single recording                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```javascript
// Flowstral uses Chrome's native APIs
chrome.webRequest.onBeforeRequest.addListener(callback, filter);
chrome.webRequest.onSendHeaders.addListener(callback, filter);
chrome.webRequest.onHeadersReceived.addListener(callback, filter);
chrome.webRequest.onCompleted.addListener(callback, filter);

// Plus PerformanceObserver for accurate timing
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // DNS, TCP, SSL, TTFB, Download times
  }
}).observe({ entryTypes: ['resource'] });
```

---

## 2. Correlation Architecture

### 2.1 The Correlation Problem

Dynamic values in web applications that change per session:

| Value Type | Example | Frequency |
|------------|---------|-----------|
| Session ID | `JSESSIONID=abc123` | Every login |
| CSRF Token | `_token=xyz789` | Every page |
| OAuth Token | `Bearer eyJhbG...` | Auth flow |
| Request ID | `X-Request-ID: uuid` | Every request |
| Timestamp | `_ts=1702742400` | Time-based |

**Without correlation, load tests fail** because each virtual user sends the same static values from the recording.

---

### 2.2 LoadRunner Correlation (Manual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOADRUNNER MANUAL CORRELATION                             │
│                                                                              │
│   STEP 1: Run Recording                                                      │
│   ────────────────────                                                       │
│   Response captured:                                                         │
│   {"session_id":"abc123","csrf_token":"xyz789","user_id":42}                │
│                                                                              │
│   STEP 2: Identify Dynamic Values (Manual Analysis)                          │
│   ─────────────────────────────────────────────────                          │
│   Developer must:                                                            │
│   • Run test multiple times                                                  │
│   • Compare responses to find changing values                                │
│   • Document each dynamic value location                                     │
│                                                                              │
│   STEP 3: Add Extraction Rules (Manual Coding)                               │
│   ────────────────────────────────────────────                               │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  // Must be placed BEFORE the request that receives the value      │    │
│   │  web_reg_save_param("sessionId",                                   │    │
│   │      "LB=session_id\":\"",     // Left boundary (fragile!)         │    │
│   │      "RB=\"",                   // Right boundary                   │    │
│   │      "Ord=1",                   // First occurrence                 │    │
│   │      "Search=Body",                                                │    │
│   │      LAST);                                                        │    │
│   │                                                                    │    │
│   │  web_reg_save_param("csrfToken",                                   │    │
│   │      "LB=csrf_token\":\"",                                         │    │
│   │      "RB=\"",                                                      │    │
│   │      "Ord=1",                                                      │    │
│   │      LAST);                                                        │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   STEP 4: Apply Parameterization (Manual Replacement)                        │
│   ───────────────────────────────────────────────────                        │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  web_custom_request("GetProfile",                                  │    │
│   │      "URL=https://api.com/profile",                                │    │
│   │      "Headers=Authorization: Bearer {sessionId}",  // Parameterized│    │
│   │      "Headers=X-CSRF-Token: {csrfToken}",                          │    │
│   │      LAST);                                                        │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   TIME REQUIRED: 2-8 hours per script                                        │
│   ERROR PRONE: Boundaries break when API changes                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Flowstral Auto-Correlation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOWSTRAL AUTOMATIC CORRELATION                           │
│                                                                              │
│   DURING RECORDING (Real-time Detection)                                     │
│   ──────────────────────────────────────                                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     CORRELATION ENGINE                               │   │
│   │                                                                      │   │
│   │   Pattern Matching:                                                  │   │
│   │   ┌────────────────────────────────────────────────────────────┐    │   │
│   │   │  sessionId:  /session[_-]?id|jsessionid|phpsessid/i        │    │   │
│   │   │  csrfToken:  /csrf|xsrf|_token|authenticity_token/i        │    │   │
│   │   │  authToken:  /auth[_-]?token|bearer|jwt|access_token/i     │    │   │
│   │   │  requestId:  /request[_-]?id|correlation[_-]?id|trace/i    │    │   │
│   │   │  timestamp:  /timestamp|_ts|_t$/i                          │    │   │
│   │   └────────────────────────────────────────────────────────────┘    │   │
│   │                                                                      │   │
│   │   Detection Locations:                                               │   │
│   │   • Response Headers (Set-Cookie, X-* headers)                      │   │
│   │   • Response Body (JSON, HTML forms)                                │   │
│   │   • URL Parameters                                                   │   │
│   │                                                                      │   │
│   │   Tracking:                                                          │   │
│   │   • Where value first appears (source)                              │   │
│   │   • Where value is used later (destinations)                        │   │
│   │   • Automatic extraction rule generation                            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   OUTPUT (Automatic)                                                         │
│   ──────────────────                                                         │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │  {                                                                 │    │
│   │    "correlations": [                                               │    │
│   │      {                                                             │    │
│   │        "name": "session_id",                                       │    │
│   │        "type": "dynamic",                                          │    │
│   │        "source": { "request": 3, "location": "response.body" },    │    │
│   │        "pattern": "session_id\":\"([^\"]+)\"",                     │    │
│   │        "usedIn": [5, 7, 8, 12]  // Request numbers                 │    │
│   │      },                                                            │    │
│   │      {                                                             │    │
│   │        "name": "csrf_token",                                       │    │
│   │        "type": "dynamic",                                          │    │
│   │        "source": { "request": 1, "location": "response.header" },  │    │
│   │        "pattern": "X-CSRF-Token: (.+)",                            │    │
│   │        "usedIn": [4, 6, 9]                                         │    │
│   │      }                                                             │    │
│   │    ]                                                               │    │
│   │  }                                                                 │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   TIME REQUIRED: 0 seconds (automatic)                                       │
│   MAINTENANCE: Self-healing patterns                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Load Generation Architecture

### 3.1 LoadRunner Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOADRUNNER LOAD GENERATION                                │
│                                                                              │
│                         ┌───────────────────────┐                           │
│                         │      CONTROLLER       │                           │
│                         │    (Windows Server)   │                           │
│                         │                       │                           │
│                         │  • Scenario Manager   │                           │
│                         │  • Results Collector  │                           │
│                         │  • License Server     │                           │
│                         │                       │                           │
│                         │  License: ~$15,000    │                           │
│                         └───────────┬───────────┘                           │
│                                     │                                        │
│            ┌────────────────────────┼────────────────────────┐              │
│            │                        │                        │              │
│            ▼                        ▼                        ▼              │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │  LOAD GENERATOR │     │  LOAD GENERATOR │     │  LOAD GENERATOR │      │
│   │      #1         │     │      #2         │     │      #3         │      │
│   │                 │     │                 │     │                 │      │
│   │  Windows/Linux  │     │  Windows/Linux  │     │  Windows/Linux  │      │
│   │  Server         │     │  Server         │     │  Server         │      │
│   │                 │     │                 │     │                 │      │
│   │  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │      │
│   │  │ VUser 1   │  │     │  │ VUser 201 │  │     │  │ VUser 401 │  │      │
│   │  │ VUser 2   │  │     │  │ VUser 202 │  │     │  │ VUser 402 │  │      │
│   │  │ ...       │  │     │  │ ...       │  │     │  │ ...       │  │      │
│   │  │ VUser 200 │  │     │  │ VUser 400 │  │     │  │ VUser 600 │  │      │
│   │  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │      │
│   │                 │     │                 │     │                 │      │
│   │  License:       │     │  License:       │     │  License:       │      │
│   │  ~$10,000       │     │  ~$10,000       │     │  ~$10,000       │      │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘      │
│            │                       │                       │                │
│            └───────────────────────┼───────────────────────┘                │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌───────────────────────┐                           │
│                         │     TARGET SYSTEM     │                           │
│                         │     (Under Test)      │                           │
│                         └───────────────────────┘                           │
│                                                                              │
│   CONSTRAINTS:                                                               │
│   ────────────                                                               │
│   • 200-500 VUsers per Load Generator (license limit)                       │
│   • Windows servers required for Controller                                  │
│   • Agent software on each Load Generator                                   │
│   • Each VUser = 1 thread = ~2-5 MB RAM                                     │
│   • Total cost for 1000 VUsers: ~$45,000 licenses                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 NeoLoad Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NEOLOAD LOAD GENERATION                                 │
│                                                                              │
│                         ┌───────────────────────┐                           │
│                         │    NEOLOAD CONTROLLER │                           │
│                         │                       │                           │
│                         │  • GUI (Java-based)   │                           │
│                         │  • Cloud option       │                           │
│                         │  • SaaS pricing       │                           │
│                         │                       │                           │
│                         │  License: $30K-100K/yr│                           │
│                         └───────────┬───────────┘                           │
│                                     │                                        │
│            ┌────────────────────────┼────────────────────────┐              │
│            │                        │                        │              │
│            ▼                        ▼                        ▼              │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │ LOAD GENERATOR  │     │ LOAD GENERATOR  │     │   CLOUD LOAD    │      │
│   │   (On-Premise)  │     │   (On-Premise)  │     │   GENERATOR     │      │
│   │                 │     │                 │     │                 │      │
│   │  Java-based     │     │  Java-based     │     │  NeoLoad SaaS   │      │
│   │  400 VUsers     │     │  400 VUsers     │     │  Variable       │      │
│   │                 │     │                 │     │                 │      │
│   │  ~$8K license   │     │  ~$8K license   │     │  Pay-per-use    │      │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘      │
│                                                                              │
│   ADVANTAGES OVER LOADRUNNER:                                               │
│   • Better JavaScript support                                                │
│   • Cloud load generators available                                          │
│   • Semi-automatic correlation                                               │
│                                                                              │
│   LIMITATIONS:                                                               │
│   • Still requires proxy for recording                                       │
│   • Manual correlation still needed for complex apps                         │
│   • Java-based = higher memory usage                                         │
│   • UI and Protocol testing still separate                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Flowstral Distributed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FLOWSTRAL DISTRIBUTED LOAD GENERATION                      │
│                                                                              │
│                         ┌───────────────────────┐                           │
│                         │      CONTROLLER       │                           │
│                         │     (Python/FastAPI)  │                           │
│                         │                       │                           │
│                         │  • Container-native   │                           │
│                         │  • K8s orchestration  │                           │
│                         │  • Real-time metrics  │                           │
│                         │  • WebSocket streams  │                           │
│                         │                       │                           │
│                         │  License: FREE        │                           │
│                         └───────────┬───────────┘                           │
│                                     │                                        │
│            ┌────────────────────────┼────────────────────────┐              │
│            │                        │                        │              │
│            ▼                        ▼                        ▼              │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │     WORKER      │     │     WORKER      │     │     WORKER      │      │
│   │   (Container)   │     │   (Container)   │     │   (Container)   │      │
│   │                 │     │                 │     │                 │      │
│   │  Python/aiohttp │     │  Python/aiohttp │     │  Python/aiohttp │      │
│   │  Async HTTP     │     │  Async HTTP     │     │  Async HTTP     │      │
│   │                 │     │                 │     │                 │      │
│   │  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │      │
│   │  │ User 1    │  │     │  │ User 501  │  │     │  │ User 1001 │  │      │
│   │  │ User 2    │  │     │  │ User 502  │  │     │  │ User 1002 │  │      │
│   │  │ ...       │  │     │  │ ...       │  │     │  │ ...       │  │      │
│   │  │ User 500  │  │     │  │ User 1000 │  │     │  │ User 1500 │  │      │
│   │  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │      │
│   │                 │     │                 │     │                 │      │
│   │  2 GB RAM       │     │  2 GB RAM       │     │  2 GB RAM       │      │
│   │  ~$0.05/hr      │     │  ~$0.05/hr      │     │  ~$0.05/hr      │      │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘      │
│            │                       │                       │                │
│            └───────────────────────┼───────────────────────┘                │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌───────────────────────┐                           │
│                         │     TARGET SYSTEM     │                           │
│                         │     (Under Test)      │                           │
│                         └───────────────────────┘                           │
│                                                                              │
│   ADVANTAGES:                                                                │
│   ───────────                                                                │
│   ✓ 500-1000 VUsers per container (async efficiency)                        │
│   ✓ Auto-scaling with Kubernetes                                            │
│   ✓ No license limits                                                        │
│   ✓ Pay only during test execution                                          │
│   ✓ Works on any cloud (AWS, GCP, Azure, on-prem)                           │
│                                                                              │
│   DEPLOYMENT OPTIONS:                                                        │
│   ───────────────────                                                        │
│   • Docker Compose (dev/small scale)                                        │
│   • Kubernetes (production scale)                                            │
│   • AWS ECS/Fargate                                                          │
│   • Google Cloud Run                                                         │
│   • Azure Container Instances                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why Flowstral Workers Are More Efficient:**

```python
# Traditional tools use threads (LoadRunner C, NeoLoad Java)
# Each thread: ~2-5 MB stack + context switching overhead

# Flowstral uses Python async
async def run_virtual_user(user_id):
    async with aiohttp.ClientSession() as session:
        while running:
            for request in test_requests:
                await execute_with_correlation(session, request)
                await asyncio.sleep(think_time)

# Result: 2-3x more users per machine
# Why: Async I/O, no thread overhead, efficient memory
```

---

## 4. Test Execution Comparison

### 4.1 Script Complexity

**LoadRunner Script (C Language):**
```c
Action()
{
    // 50+ lines of boilerplate code
    web_reg_save_param("sessionId",
        "LB=session_id\":\"",
        "RB=\"",
        "Search=Body",
        LAST);
    
    web_submit_data("Login",
        "Action=https://api.example.com/auth/login",
        "Method=POST",
        "RecContentType=application/json",
        "Mode=HTTP",
        ITEMDATA,
        "Name=username", "Value={pUsername}", ENDITEM,
        "Name=password", "Value={pPassword}", ENDITEM,
        LAST);
    
    lr_think_time(5);
    
    web_custom_request("GetDashboard",
        "URL=https://api.example.com/dashboard",
        "Method=GET",
        "Headers=Authorization: Bearer {sessionId}",
        "Headers=Content-Type: application/json",
        LAST);
    
    return 0;
}
```

**Flowstral (HAR + Auto-Correlation):**
```json
{
  "name": "Login Test",
  "requests": [
    { "method": "POST", "url": "https://api.example.com/auth/login" },
    { "method": "GET", "url": "https://api.example.com/dashboard" }
  ],
  "correlations": [
    { "name": "sessionId", "auto": true }
  ]
}
```

---

## 5. Cost Analysis

### 5.1 Total Cost of Ownership (3-Year)

| Cost Category | LoadRunner | NeoLoad | Gatling Enterprise | Flowstral |
|--------------|------------|---------|-------------------|-----------|
| **Year 1** |  |  |  |  |
| Controller License | $15,000 | $30,000 | $15,000 | $0 |
| Load Gen Licenses (1000 users) | $50,000 | $30,000 | $10,000 | $0 |
| Training | $5,000 | $3,000 | $2,000 | $0 |
| Infrastructure (on-prem) | $10,000 | $10,000 | $5,000 | $0 |
| **Year 1 Total** | **$80,000** | **$73,000** | **$32,000** | **$0** |
|  |  |  |  |  |
| **Years 2-3** |  |  |  |  |
| Maintenance (20%/yr) | $26,000 | $24,000 | $10,000 | $0 |
| Additional Licenses | $10,000 | $10,000 | $5,000 | $0 |
| **Years 2-3 Total** | **$36,000** | **$34,000** | **$15,000** | **$0** |
|  |  |  |  |  |
| **3-Year Total** | **$116,000** | **$107,000** | **$47,000** | **$0** |
|  |  |  |  |  |
| **Per-Test Cloud Cost** | ~$100 | ~$50 | ~$20 | **~$1** |

### 5.2 Cloud Execution Cost Per Test

| Users | Duration | LoadRunner Cloud | NeoLoad Cloud | Flowstral (AWS) |
|-------|----------|-----------------|---------------|-----------------|
| 100 | 1 hour | $50 | $30 | $0.10 |
| 500 | 1 hour | $200 | $100 | $0.30 |
| 1,000 | 1 hour | $400 | $200 | $0.50 |
| 5,000 | 1 hour | $2,000 | $800 | $2.00 |
| 10,000 | 1 hour | $4,000 | $1,500 | $4.00 |

---

## 6. Feature Matrix

### 6.1 Recording Capabilities

| Feature | Flowstral | LoadRunner | NeoLoad | Gatling | k6 |
|---------|-----------|------------|---------|---------|-----|
| Browser-native capture | ✅ | ❌ | ❌ | ❌ | ❌ |
| No proxy required | ✅ | ❌ | ❌ | N/A | N/A |
| HTTP/2 support | ✅ | ⚠️ | ⚠️ | ✅ | ✅ |
| WebSocket capture | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| GraphQL support | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Service Worker traffic | ✅ | ❌ | ❌ | ❌ | ❌ |
| Unified UI + Protocol | ✅ | ❌ | ❌ | ❌ | ❌ |

### 6.2 Correlation & Parameterization

| Feature | Flowstral | LoadRunner | NeoLoad | Gatling | k6 |
|---------|-----------|------------|---------|---------|-----|
| Auto-correlation | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Visual correlation | ✅ | ⚠️ | ✅ | ❌ | ❌ |
| CSV data files | ✅ | ✅ | ✅ | ✅ | ✅ |
| Database data source | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Dynamic data generation | ✅ | ✅ | ✅ | ✅ | ✅ |

### 6.3 Execution & Scaling

| Feature | Flowstral | LoadRunner | NeoLoad | Gatling | k6 |
|---------|-----------|------------|---------|---------|-----|
| Container-native | ✅ | ❌ | ⚠️ | ✅ | ✅ |
| Kubernetes support | ✅ | ❌ | ⚠️ | ✅ | ✅ |
| Auto-scaling | ✅ | ❌ | ⚠️ | ⚠️ | ✅ |
| Users per node | 1000 | 500 | 400 | 800 | 1000 |
| Cloud-native | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |

### 6.4 Integration & CI/CD

| Feature | Flowstral | LoadRunner | NeoLoad | Gatling | k6 |
|---------|-----------|------------|---------|---------|-----|
| REST API | ✅ | ✅ | ✅ | ✅ | ✅ |
| Jenkins plugin | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Actions | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| GitLab CI | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| Azure DevOps | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 7. Migration Guide

### 7.1 From LoadRunner to Flowstral

```
STEP 1: Export LoadRunner HAR
────────────────────────────
In VuGen: File → Export → HTTP Archive (HAR)

STEP 2: Import to Flowstral
───────────────────────────
• Open Flowstral Test Builder
• Click "Protocol" tab
• Click "Import HAR"
• Select exported file

STEP 3: Review Auto-Correlations
────────────────────────────────
• Flowstral auto-detects dynamic values
• Review in "Correlations" section
• Add custom patterns if needed

STEP 4: Configure Load Test
───────────────────────────
• Set virtual users
• Configure ramp-up
• Set duration
• Run test
```

### 7.2 From NeoLoad to Flowstral

```
STEP 1: Export NeoLoad Project as HAR
─────────────────────────────────────
Project → Export → HTTP Archive

STEP 2: Import and Configure
────────────────────────────
Same as LoadRunner migration

STEP 3: Verify Correlation Mapping
──────────────────────────────────
NeoLoad variable extractors → Flowstral auto-correlation
```

---

## 8. Conclusion

### 8.1 When to Choose Flowstral

✅ **Choose Flowstral when:**
- Building a modern web application (SPA, microservices)
- Need unified UI and performance testing
- Want to minimize scripting effort (auto-correlation)
- Running tests in CI/CD pipelines
- Budget-conscious or open-source preferred
- Cloud-native deployment required
- Team lacks LoadRunner/NeoLoad expertise

### 8.2 When Traditional Tools May Still Fit

⚠️ **Consider LoadRunner/NeoLoad when:**
- Testing legacy protocols (Citrix, SAP GUI, Oracle Forms)
- Existing large investment in tool-specific scripts
- Regulatory requirement for specific vendor
- Complex enterprise support contracts needed

### 8.3 Summary

| Criteria | Winner | Reason |
|----------|--------|--------|
| **Ease of Use** | Flowstral | No proxy, auto-correlation |
| **Modern Apps** | Flowstral | Browser-native, SPA support |
| **Cost** | Flowstral | Open source, pay-per-use cloud |
| **Scalability** | Flowstral | Container-native, K8s ready |
| **Legacy Protocols** | LoadRunner | Widest protocol support |
| **Enterprise Support** | LoadRunner/NeoLoad | Vendor contracts |

---

## Appendix A: Deployment Configurations

### A.1 Docker Compose (Development)

```yaml
version: '3.8'
services:
  controller:
    image: flowstral/load-controller:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      
  worker:
    image: flowstral/load-worker:latest
    deploy:
      replicas: 2
    environment:
      - CONTROLLER_URL=http://controller:8000
```

### A.2 Kubernetes (Production)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowstral-workers
spec:
  replicas: 10
  selector:
    matchLabels:
      app: flowstral-worker
  template:
    spec:
      containers:
      - name: worker
        image: flowstral/load-worker:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: flowstral-workers-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: flowstral-workers
  minReplicas: 1
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 8. Server Resource Monitoring (SRM)

### 8.1 The Critical Question: Why Are Response Times Slow?

LoadRunner and NeoLoad include Server Resource Monitoring (SRM) to correlate response times with **target server** CPU/memory. This answers the crucial question: **"Is the server the bottleneck, or something else?"**

### 8.2 Traditional Tools: SiteScope / Built-in SRM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOADRUNNER + SITESCOPE                                    │
│                                                                              │
│   ┌─────────────────┐                    ┌─────────────────────────────┐   │
│   │  Load Controller │                    │    APPLICATION SERVER       │   │
│   │  (LoadRunner)    │──── HTTP ─────────▶│                            │   │
│   │                  │                    │    Target being tested      │   │
│   └─────────────────┘                    └─────────────────────────────┘   │
│           │                                           │                     │
│           │ Response                                  │ SSH/WMI             │
│           │ Times                                     │ Metrics             │
│           ▼                                           ▼                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         SITESCOPE ($$$$)                             │  │
│   │                                                                      │  │
│   │   Monitors:                          Answers:                        │  │
│   │   • Server CPU                       • "Is CPU causing slowdown?"    │  │
│   │   • Server Memory                    • "Is memory exhausted?"        │  │
│   │   • Disk I/O                         • "Is it a DB bottleneck?"      │  │
│   │   • Database connections                                             │  │
│   │   • JVM heap                                                         │  │
│   │                                                                      │  │
│   │   Cost: $50,000+ per year additional license                         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**SiteScope Pricing:**
- LoadRunner itself: ~$85,000/year
- SiteScope addition: ~$30,000-50,000/year
- Total for full monitoring: ~$120,000+/year

### 8.3 Flowstral: Built-in Server Resource Monitoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOWSTRAL (EVERYTHING INCLUDED)                           │
│                                                                              │
│   ┌─────────────────┐                    ┌─────────────────────────────┐   │
│   │  Load Controller │                    │    APPLICATION SERVER       │   │
│   │  (Flowstral)     │──── HTTP ─────────▶│                            │   │
│   │                  │                    │    Target being tested      │   │
│   └─────────────────┘                    └─────────────────────────────┘   │
│           │                                           │                     │
│           │ Response                                  │ SSH/WMI/            │
│           │ Times                                     │ CloudWatch          │
│           ▼                                           ▼                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    BUILT-IN SRM (FREE)                               │  │
│   │                                                                      │  │
│   │   Protocols:                          Correlates:                    │  │
│   │   • SSH (Linux/Unix)                  • Response Time vs CPU         │  │
│   │   • WMI/PowerShell (Windows)          • Response Time vs Memory      │  │
│   │   • AWS CloudWatch                    • Throughput vs Disk I/O       │  │
│   │   • Prometheus /metrics               • Error Rate vs Resources      │  │
│   │   • Azure Monitor (coming)                                           │  │
│   │                                                                      │  │
│   │   Cost: $0 (included in Flowstral)                                   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Feature Comparison: SRM Capabilities

| Feature | Flowstral | LoadRunner + SiteScope | NeoLoad |
|---------|-----------|------------------------|---------|
| **Linux Server Monitoring (SSH)** | ✅ Built-in | ✅ Requires SiteScope | ✅ Built-in |
| **Windows Server Monitoring (WMI)** | ✅ Built-in | ✅ Requires SiteScope | ✅ Built-in |
| **AWS CloudWatch Integration** | ✅ Built-in | ⚠️ Extra config | ⚠️ Limited |
| **Prometheus /metrics Scraping** | ✅ Native | ❌ Not supported | ⚠️ Plugin |
| **Response Time Correlation** | ✅ Automatic | ✅ Yes | ✅ Yes |
| **Bottleneck Analysis** | ✅ AI-powered | ⚠️ Manual | ⚠️ Manual |
| **Top Process Identification** | ✅ Yes | ✅ Yes | ⚠️ Limited |
| **Additional Cost** | **$0** | **$50,000+** | **Included** |

### 8.5 When You STILL Need APM Tools

Flowstral's SRM monitors at the **OS level** (CPU, memory, disk). For **application-level** visibility, you may still want APM tools:

| Monitoring Level | Flowstral SRM | APM Tools (Dynatrace/DataDog) |
|-----------------|---------------|-------------------------------|
| OS CPU/Memory | ✅ | ✅ |
| JVM Heap/GC | ❌ | ✅ |
| Database Query Time | ❌ | ✅ |
| Distributed Tracing | ❌ | ✅ |
| Code Profiling | ❌ | ✅ |

**Recommendation:**
- **Testing YOUR application** → Flowstral SRM + APM agent on server
- **Testing third-party (Salesforce, etc.)** → Flowstral SRM only (can't install agents)
- **Quick validation** → Flowstral SRM is sufficient

### 8.6 Flowstral SRM API Usage

```python
# 1. Add target server(s) to monitor
POST /api/srm/servers
{
    "alias": "app-server",
    "server_type": "linux_ssh",
    "host": "app.example.com",
    "username": "monitor",
    "private_key_path": "/path/to/key"
}

# 2. Start monitoring BEFORE load test
POST /api/srm/start
{
    "interval_seconds": 5
}

# 3. Run load test (response times automatically recorded)
# ... load test runs ...

# 4. Stop monitoring AFTER load test
POST /api/srm/stop

# 5. GET the correlation chart
GET /api/srm/correlation

# Response:
{
    "correlation": {
        "timestamps": ["2024-12-16T10:00:00", ...],
        "response_times": [150, 200, 450, 2000, ...],
        "server_cpu": [30, 45, 75, 92, ...],
        "server_memory": [60, 62, 65, 88, ...],
        "analysis": {
            "findings": [
                {
                    "type": "cpu_bottleneck",
                    "severity": "high",
                    "message": "High CPU (92%) correlates with slow response times",
                    "recommendation": "Scale up CPU or optimize application code"
                }
            ],
            "health_score": 45
        }
    }
}
```

### 8.7 Correlation Visualization

```
Response Time vs Server CPU During Load Test
─────────────────────────────────────────────

Response Time (ms)    │    Server CPU (%)
                      │
2000 ┤              ╭──────╮           │ 100
     │           ╭──╯      ╰──╮        │
1500 ┤        ╭──╯            ╰──╮     │  80
     │     ╭──╯                  ╰──╮  │
1000 ┤  ╭──╯                       ╰─ │  60
     │ ╭╯                              │
 500 ┤─╯                               │  40
     │                                 │
 200 ┤                                 │  20
     ┼────┬────┬────┬────┬────┬────┬──
       0    5   10   15   20   25  30  minutes

─── Response Time
─── Server CPU

FINDING: Response time spike at 15-20 min correlates with CPU hitting 92%
         → Server is the bottleneck, not network
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **VUser** | Virtual User - simulated user in load test |
| **Correlation** | Extracting dynamic values and reusing them |
| **HAR** | HTTP Archive - standard format for HTTP traffic |
| **Think Time** | Simulated delay between user actions |
| **Ramp-up** | Gradual increase of virtual users |
| **Load Generator** | Machine/container executing virtual users |
| **Controller** | Orchestrator managing load generators |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 16, 2024 | Flowstral Team | Initial release |

---

*© 2024 Flowstral. This document is provided for informational purposes.*
