# Flowstral Feature Comparison: Desktop App vs Browser Extension

> **Last Updated:** January 12, 2026  
> **Version:** 2.1.0

## Executive Summary

This document provides a comprehensive comparison between the Flowstral Desktop App and Browser Extension. **Both platforms are now fully synced** with all major features available on both.

## Quick Reference Table

| Feature Category | Desktop App | Browser Extension | Sync Status |
|-----------------|-------------|-------------------|-------------|
| **Core Recording** | ✅ Full | ✅ Full | ✅ Synced |
| **Smart Selectors** | ✅ Full | ✅ Full | ✅ Synced |
| **App Detection** | ✅ 30+ Apps | ✅ 30+ Apps | ✅ Synced |
| **Test Execution** | ✅ Full + Debug | ✅ Full + Debug (via API) | ✅ Synced |
| **Debug Mode** | ✅ Native | ✅ Via Backend API | ✅ Synced |
| **Network Capture** | ✅ Full | ✅ Full | ✅ Synced |
| **Page Analysis** | ✅ Full | ✅ Full | ✅ Synced |
| **Suggestions** | ✅ Full | ✅ Full | ✅ Synced |
| **Playwright Export** | ✅ Full | ✅ Full | ✅ Synced |
| **Session Persistence** | ✅ Full | ⚠️ Tab-based | ⚡ Desktop ahead |
| **Offline Mode** | ✅ Full | ❌ None | ⚡ Desktop only |
| **Auto-Update** | ✅ Full | ❌ Chrome Store | N/A |
| **Multi-Tab Recording** | ⚠️ Limited | ✅ Full | ⚡ Extension ahead |

---

## Detailed Feature Comparison

### 1. Core Recording Engine

**Status: ✅ IN SYNC**

Both platforms use `recorder-engine.js` as the single source of truth.

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| Click recording | ✅ | ✅ | Identical behavior |
| Double-click | ✅ | ✅ | Identical |
| Right-click | ✅ | ✅ | Identical |
| Input/Fill | ✅ | ✅ | 1500ms debounce |
| Select dropdown | ✅ | ✅ | Identical |
| Checkbox/Radio | ✅ | ✅ | Identical |
| File upload | ✅ | ✅ | Identical |
| Keyboard shortcuts | ✅ | ✅ | Ctrl/Alt/Shift combos |
| Form submit | ✅ | ✅ | Identical |
| Navigation tracking | ✅ | ✅ | URL change detection |
| Pause/Resume | ✅ | ✅ | Identical |

**Shared File:** `flowstral-extension/src/lib/recorder-engine.js`

---

### 2. Smart Selector Generation

**Status: ✅ IN SYNC**

| Strategy | Desktop | Extension | Priority |
|----------|---------|-----------|----------|
| data-testid | ✅ | ✅ | 100 |
| data-test | ✅ | ✅ | 95 |
| aria-label | ✅ | ✅ | 90 |
| role + name | ✅ | ✅ | 85 |
| placeholder | ✅ | ✅ | 80 |
| name attribute | ✅ | ✅ | 75 |
| id (stable) | ✅ | ✅ | 70 |
| text content | ✅ | ✅ | 65 |
| CSS selector | ✅ | ✅ | 50 |
| XPath fallback | ✅ | ✅ | 20 |

---

### 3. Enterprise App Detection

**Status: ✅ IN SYNC**

Both platforms detect and optimize for 30+ enterprise applications:

| Application | Desktop | Extension | Special Handling |
|-------------|---------|-----------|------------------|
| Salesforce LWC | ✅ | ✅ | Shadow DOM, Lightning components |
| Salesforce Aura | ✅ | ✅ | data-aura-id selectors |
| ServiceNow | ✅ | ✅ | Frame handling, sys_ selectors |
| Workday | ✅ | ✅ | data-automation-id |
| SAP UI5/Fiori | ✅ | ✅ | __xmlview selectors |
| Dynamics 365 | ✅ | ✅ | data-id selectors |
| Jira/Atlassian | ✅ | ✅ | data-testid |
| Zendesk | ✅ | ✅ | data-garden-id |
| Oracle Fusion | ✅ | ✅ | oj-* components |
| NetSuite | ✅ | ✅ | nlComponentId |
| HubSpot | ✅ | ✅ | data-test-id |
| Zoho | ✅ | ✅ | lyte- components |
| Monday.com | ✅ | ✅ | data-testid |
| Asana | ✅ | ✅ | data-testid |
| Freshworks | ✅ | ✅ | data-test |
| PEGA | ✅ | ✅ | data-test-id |
| Concur | ✅ | ✅ | data-automation |
| Veeva | ✅ | ✅ | data-test |
| Coupa | ✅ | ✅ | data-testid |
| Ariba | ✅ | ✅ | data-test |
| Anaplan | ✅ | ✅ | data-automation-id |
| Tableau | ✅ | ✅ | data-tb-test-id |
| Power BI | ✅ | ✅ | data-testid |
| Snowflake | ✅ | ✅ | data-testid |

---

### 4. Test Execution

**Status: ✅ IN SYNC**

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| Run tests | ✅ Full | ✅ Via backend | Desktop native, Extension via API |
| **Debug Mode** | ✅ Native | ✅ Via API | Both supported |
| Pause on failure | ✅ | ✅ | Via backend API |
| Step-by-step | ✅ | ✅ | Via backend API |
| Edit while paused | ✅ | ✅ | Via backend API |
| Retry failed step | ✅ | ✅ | Via backend API |
| Skip step | ✅ | ✅ | Via backend API |
| Browser stays open | ✅ | ✅ | Via backend API |
| Headless mode | ✅ | ✅ | Both via backend |
| Video recording | ✅ | ✅ | Via backend |
| Screenshot on fail | ✅ | ✅ | Both |

**Debug Mode API Endpoints (for Extension):**
- `POST /api/flowstral/debug/run` - Start debug session
- `POST /api/flowstral/debug/pause` - Pause execution
- `POST /api/flowstral/debug/resume` - Resume execution
- `POST /api/flowstral/debug/skip` - Skip current step
- `POST /api/flowstral/debug/retry` - Retry current step
- `POST /api/flowstral/debug/stop` - Stop session
- `GET /api/flowstral/debug/status/{session_id}` - Get status

---

### 5. Network Capture

**Status: ✅ IN SYNC**

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| XHR capture | ✅ Full | ✅ Full | Both via DevTools Protocol |
| Fetch capture | ✅ Full | ✅ Full | Both via DevTools Protocol |
| WebSocket capture | ✅ Full | ✅ Full | Both supported |
| Correlation detection | ✅ Full | ✅ Full | Auto-detect tokens, session IDs |
| Request timing | ✅ Full | ✅ Full | True browser timing |
| Response headers | ✅ Full | ✅ Full | Both capture |
| HAR export | ✅ Full | ✅ Full | Both supported |

**Desktop Implementation:** Uses Electron's Chrome DevTools Protocol
**Extension Implementation:** Uses Chrome webRequest API

---

### 6. Page Analysis & Suggestions

**Status: ✅ IN SYNC**

| Feature | Desktop | Extension |
|---------|---------|-----------|
| Auto-analyze on load | ✅ | ✅ |
| Interactive elements | ✅ | ✅ |
| Form fields | ✅ | ✅ |
| Navigation links | ✅ | ✅ |
| Category grouping | ✅ | ✅ |
| Execute suggestion | ✅ | ✅ |
| Add to recording | ✅ | ✅ |
| Duplicate detection | ✅ | ✅ |
| Confidence scoring | ✅ | ✅ |

---

### 7. Export & Code Generation

**Status: ✅ IN SYNC**

| Format | Desktop | Extension | Notes |
|--------|---------|-----------|-------|
| Playwright TypeScript | ✅ | ✅ | Primary format |
| Playwright Python | ✅ | ✅ | Full support |
| Playwright JavaScript | ✅ | ✅ | Full support |
| Robot Framework | ✅ | ✅ | Via backend |
| Test Builder JSON | ✅ | ✅ | Internal format |
| Page Object Model | ✅ | ✅ | Optional |
| Self-healing locators | ✅ | ✅ | Fallback strategies |

---

### 8. UI/UX Features

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| Side panel | ✅ (BrowserView) | ✅ (Chrome API) | Different implementations |
| Floating toolbar | ✅ | ✅ | Identical |
| Dark mode | ✅ | ⚠️ Limited | Desktop has better theme |
| Keyboard shortcuts | ✅ | ✅ | Identical |
| Drag to resize | ✅ | ⚠️ Limited | Desktop better |
| Multi-monitor | ✅ | ❌ | Desktop only |

---

### 9. Session & State Management

**Status: ⚡ DESKTOP AHEAD**

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| Login persistence | ✅ Full | ⚠️ Tab-based | Desktop uses persistent partition |
| MFA remember | ✅ | ⚠️ | Desktop better |
| Cookies persist | ✅ | ⚠️ | Desktop persists across restarts |
| Local storage | ✅ SQLite | ✅ Chrome storage | Different backends |
| Offline mode | ✅ Full | ❌ | Desktop only |
| Cloud sync | ✅ | ✅ | Both |

---

### 10. Multi-Tab/Window Support

**Status: ⚡ EXTENSION AHEAD**

| Feature | Desktop | Extension | Notes |
|---------|---------|-----------|-------|
| Record multiple tabs | ⚠️ Limited | ✅ Full | Extension tracks all tabs |
| Tab switch recording | ❌ | ✅ | Extension records tab switches |
| Popup window recording | ⚠️ | ✅ | Extension better |
| New tab detection | ⚠️ | ✅ | Extension auto-tracks |
| Tab close recording | ❌ | ✅ | Extension records closes |

**Action Required:** Improve desktop multi-window support.

---

## Sync Checklist

### Files That Must Stay In Sync

| File | Source Location | Desktop Copy | Status |
|------|-----------------|--------------|--------|
| `recorder-engine.js` | `flowstral-extension/src/lib/` | Loaded directly | ✅ Synced |
| `app-selectors.js` | `flowstral-extension/src/lib/` | `desktop/src/main/lib/` | ✅ Synced |
| `smart-selector.js` | `flowstral-extension/src/lib/` | `desktop/src/main/lib/` | ✅ Synced |

### How to Sync

1. **recorder-engine.js**: Desktop loads directly from extension folder
2. **Other files**: Copy from extension to desktop after changes

```bash
# Sync command (run from project root)
cp flowstral-extension/src/lib/app-selectors.js flowstral-desktop/src/main/lib/
cp flowstral-extension/src/lib/smart-selector.js flowstral-desktop/src/main/lib/
```

---

## Recent Sync Work (January 2026)

### ✅ Completed

1. **Ported Network Capture to Desktop**
   - Created `flowstral-desktop/src/main/lib/network-capture.js`
   - Uses Electron's Chrome DevTools Protocol
   - Full XHR, Fetch, WebSocket capture
   - HAR export support
   - Correlation detection

2. **Added Debug Mode API to Backend**
   - Created `/api/flowstral/debug/*` endpoints
   - Extension can use via API calls
   - Full pause/resume/retry/skip support
   - Session management

3. **Updated Desktop IPC**
   - Added network capture handlers
   - Added flowstral.networkCapture API

## Remaining Differences (Intentional)

### Desktop-Only Features
- **Offline Mode** - Not possible in browser extension
- **Session Persistence** - Extension limited by browser security
- **Native Playwright** - Extension uses backend

### Extension-Only Features  
- **Multi-Tab Recording** - Native browser API advantage
- **Chrome Store Updates** - Desktop uses auto-updater

### Future Improvements

1. **Improve Desktop Multi-Tab Support**
   - Track popup windows
   - Record tab switches

2. **Unify Theme/Dark Mode**
   - Consistent styling across platforms

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-12 | 2.0.0 | Added Debug Mode to desktop, major comparison update |
| 2024-12-22 | 1.0.0 | Initial documentation |

---

## Appendix: Architecture Diagrams

### Desktop App Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ index.js + playwright-recorder.js + embedded-browser.js │ │
│  │                                                         │ │
│  │  • Recording engine (shared)                            │ │
│  │  • Test execution (Playwright)                          │ │
│  │  • Debug mode (pause/resume/retry) ← NEW               │ │
│  │  • Session persistence                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT WEB APP                            │
│  PlaywrightRecorderPage.tsx                                 │
│  • Run vs Debug toggle                                      │
│  • Pause/Resume/Retry controls                              │
│  • Step-by-step mode                                        │
└─────────────────────────────────────────────────────────────┘
```

### Browser Extension Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER CONTEXT                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ background.js + content.js + sidepanel.js               │ │
│  │                                                         │ │
│  │  • Recording engine (shared)                            │ │
│  │  • Network capture (full)                               │ │
│  │  • Multi-tab tracking                                   │ │
│  │  • Page analysis                                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Chrome APIs
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                              │
│  • Test execution (via Playwright)                          │
│  • Cloud sync                                               │
│  • AI generation                                            │
└─────────────────────────────────────────────────────────────┘
```

