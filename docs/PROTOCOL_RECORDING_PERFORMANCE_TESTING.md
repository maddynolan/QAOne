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
