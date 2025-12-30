# Changelog - December 16, 2024

## Major Feature: Unified Protocol Recording & Performance Testing

### 🎯 Summary
Implemented browser-native protocol (HTTP/HTTPS) recording that captures network traffic during UI recording sessions. This enables unified test cases that combine UI automation with protocol-level load testing - eliminating the need for separate tools like LoadRunner or NeoLoad.

---

## New Features

### 1. Browser-Native Network Capture
**File**: `flowstral-extension/src/lib/network-capture.js`

- Uses `chrome.webRequest` API for HTTP capture (no proxy needed!)
- Uses `PerformanceObserver` for accurate timing metrics
- Captures: method, URL, headers, body, status, timing breakdown
- Detects: DNS, TCP, SSL handshake, TTFB, download times

```javascript
// Key APIs used
chrome.webRequest.onBeforeRequest.addListener(...)
chrome.webRequest.onCompleted.addListener(...)
new PerformanceObserver(...)
```

### 2. Protocol Capture Toggle
**Files**: `sidepanel.html`, `sidepanel.js`, `background.js`

- Added checkbox toggle for network capture (default: OFF)
- Enable for performance testing scenarios
- Visual indicator when capture is active

### 3. HAR Export
**Files**: `sidepanel.js`, `background.js`

- Export captured traffic as HAR (HTTP Archive) files
- Industry-standard format compatible with:
  - Chrome DevTools
  - Fiddler, Charles Proxy
  - LoadRunner, JMeter, k6

### 4. Protocol Tab in Test Builder
**Files**: `UnifiedWorkflowEditor.tsx`, `EnhancedWorkflowEditor.tsx`

New "Protocol" tab in right panel showing:
- **Statistics**: Total requests, average response time
- **Auto-detected correlations**: Session IDs, tokens, dynamic values
- **Request list**: All HTTP requests with method, URL, status, timing
- **Import HAR**: Load HAR files directly into builder
- **Export HAR**: Save captured requests
- **Load Test**: One-click launch to performance testing page

### 5. Automatic Correlation Detection
**File**: `network-capture.js`

Automatically identifies dynamic values:
- Session IDs (JSESSIONID, PHPSESSID, etc.)
- CSRF tokens
- OAuth/JWT tokens
- Request/correlation IDs
- Timestamps

### 6. Unified Test Case Format
Test cases now include both UI steps AND protocol data:

```json
{
  "steps": [...],  // UI actions
  "network_data": {
    "requests": [...],    // HTTP traffic
    "correlations": [...] // Dynamic values
  }
}
```

### 7. Load Testing Integration
**File**: `VirtualUserGenerator.tsx`

- Import HAR files for load testing
- Convert HAR entries to test steps
- Configure virtual users, duration, ramp-up
- Run protocol-level load tests

---

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   RECORDER                          │
│  ┌──────────────┐    ┌─────────────────┐           │
│  │ UI Recording │    │ Protocol Capture │           │
│  │  (DOM events)│    │ (webRequest API) │           │
│  └──────┬───────┘    └────────┬────────┘           │
│         └────────┬────────────┘                     │
│                  ▼                                  │
│         ┌──────────────────┐                        │
│         │Unified Test Case │                        │
│         └────────┬─────────┘                        │
└──────────────────┼──────────────────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
┌─────────┐ ┌──────────┐ ┌────────────┐
│ Builder │ │HAR Export│ │ Load Test  │
│Protocol │ │          │ │ Generator  │
│   Tab   │ │          │ │            │
└─────────┘ └──────────┘ └────────────┘
```

### Why Better Than LoadRunner/NeoLoad

| Feature | LoadRunner/NeoLoad | QAAI |
|---------|-------------------|------|
| Proxy Setup | Required | Not needed |
| HTTPS Capture | Cert install | Native |
| Correlation | Manual | Automatic |
| UI + Protocol | Separate | Unified |
| Modern SPAs | Struggles | Built for |
| Cost | $10K-$100K+ | Open source |

---

## Files Changed

### New Files
- `flowstral-extension/src/lib/network-capture.js`
- `backend/app/services/performance/protocol_recorder.py`
- `backend/app/routers/protocol_recording_api.py`
- `docs/PROTOCOL_RECORDING_PERFORMANCE_TESTING.md`

### Modified Files
- `flowstral-extension/manifest.json` - Added `webRequest` permission
- `flowstral-extension/src/background/background.js` - Network capture integration
- `flowstral-extension/src/sidepanel/sidepanel.html` - Protocol UI elements
- `flowstral-extension/src/sidepanel/sidepanel.js` - Protocol capture logic
- `src/pages/UnifiedWorkflowEditor.tsx` - Protocol tab in Test Builder
- `src/pages/EnhancedWorkflowEditor.tsx` - Protocol tab (workflow editor)
- `src/pages/VirtualUserGenerator.tsx` - HAR import for load testing

---

## Bug Fixes

1. **Recorder not stopping with protocol capture** - Fixed webRequest listener binding
2. **Protocol data not passed to Builder** - Fixed localStorage data transfer
3. **HAR import not working** - Made backend import more robust
4. **Load test button disabled** - Fixed HAR-to-step conversion

---

## Usage

### Enable Protocol Capture
1. Open QAAI Recorder
2. Check "Protocol Capture" toggle
3. Start recording
4. Perform actions
5. Stop recording

### View Protocol Data
1. Click "Builder" to open Test Builder
2. Click "Protocol" tab in right panel
3. See captured HTTP requests

### Export HAR
- From Recorder: Click "Export HAR"
- From Builder: Click "HAR" button in Protocol tab

### Run Load Test
- From Recorder: Click "Load Test"
- From Builder: Click "Load Test" in Protocol tab

---

## Known Limitations

1. WebSocket traffic capture is limited (future enhancement)
2. Request body capture may be incomplete for streaming
3. Binary responses not fully decoded

---

## Next Steps

1. Correlation parameterization UI
2. Export to k6/JMeter formats
3. WebSocket load testing
4. GraphQL query parameterization
5. Think time analysis



