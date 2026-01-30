# Flowstral Browser Extension - Architecture Documentation

> **Last Updated:** January 12, 2026  
> **Version:** 1.1.0

## Overview

Flowstral Browser Extension is a Chrome/Edge extension for recording, suggesting, and executing automated tests directly in the browser. It provides:

- **Smart Recording**: Captures user interactions with intelligent selector generation
- **Suggestions**: Analyzes pages to suggest testable actions
- **App-Specific Optimization**: Special handling for Salesforce, ServiceNow, Workday, etc.
- **Playwright Export**: Generate Playwright test code from recordings
- **Network Capture**: Browser-native HTTP/WebSocket recording for load testing
- **Multi-Tab Recording**: Track interactions across multiple browser tabs

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER CONTEXT                                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    background.js (Service Worker)                │   │
│  │  - Message routing between components                           │   │
│  │  - Tab management and state tracking                            │   │
│  │  - Cloud API communication                                      │   │
│  │  - Test generation coordination                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                        │                        │           │
│           │ chrome.runtime         │                        │           │
│           ▼                        ▼                        ▼           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │   content.js    │   │  sidepanel.js   │   │     popup.js        │   │
│  │ (Content Script)│   │ (Side Panel UI) │   │   (Popup UI)        │   │
│  │                 │   │                 │   │                     │   │
│  │ - ActionRecorder│   │ - Test Builder  │   │ - Quick Actions     │   │
│  │ - SmartSelector │   │ - Recording UI  │   │ - Status Display    │   │
│  │ - Page Analysis │   │ - Suggestions   │   │                     │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         SHARED LIB                               │   │
│  │  - recorder-core.js    : Core recording functions (SHARED)      │   │
│  │  - smart-selector.js   : Multi-strategy selector generation     │   │
│  │  - app-selectors.js    : App-specific configs                   │   │
│  │  - playwright-generator.js : Test code generation               │   │
│  │  - page-analyzer-prototype.js : DOM analysis                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
flowstral-extension/
├── src/
│   ├── background/
│   │   └── background.js         # Service worker (2317 lines)
│   ├── content/
│   │   ├── content.js            # Content script (5113 lines)
│   │   └── content.css           # Recorder UI styles
│   ├── lib/                      # Shared libraries
│   │   ├── recorder-core.js      # Core recording (SHARED WITH DESKTOP)
│   │   ├── smart-selector.js     # Selector generation
│   │   ├── app-selectors.js      # App-specific configs
│   │   ├── playwright-generator.js # Code generation
│   │   ├── page-analyzer-prototype.js # DOM analysis
│   │   ├── computer-vision.js    # Visual element detection
│   │   └── network-capture.js    # XHR/Fetch interception
│   ├── popup/
│   │   ├── popup.html            # Popup UI
│   │   └── popup.js              # Popup logic
│   └── sidepanel/
│       ├── sidepanel.html        # Side panel UI
│       ├── sidepanel.js          # Side panel logic (5293 lines)
│       └── flowstral_engine_integration.js # Engine integration
├── icons/                        # Extension icons
├── manifest.json                 # Extension manifest
├── ARCHITECTURE.md               # This file
└── PRIVACY_POLICY.md
```

## Key Modules

### 1. `content.js` - Content Script (5113 lines)

**Classes:**

#### `ActionRecorder`
Main class for recording user interactions.

```javascript
class ActionRecorder {
  constructor()
  init()                          // Setup message listeners
  start()                         // Begin recording
  stop()                          // Stop recording
  pause() / resume()              // Pause/resume recording
  
  // Event Handlers
  handleClick(event)              // Process click events
  handleInput(event)              // Process input events (debounced)
  handleChange(event)             // Process select/checkbox changes
  handleSubmit(event)             // Process form submissions
  
  // Helpers
  flushPendingInput()             // Record pending input
  findInteractiveElement(target)  // Walk up DOM to find button/link
  addAction(action)               // Add action to recording
}
```

#### `EnhancedSmartSelector`
Generates robust selectors with app-specific optimizations.

```javascript
class EnhancedSmartSelector {
  constructor()
  setApp(appKey)                  // Set current app context
  detectApp()                     // Auto-detect application
  getBestSelector(element)        // Get best selector with fallbacks
  
  // Selector Generators
  addSalesforceOptimizedSelectors(element, selectors)
  addAppSpecificSelectors(element, selectors)
  addTestAttributes(element, selectors)
  addAriaSelectors(element, selectors)
  addFormSelectors(element, selectors)
  addIdSelector(element, selectors)
  addTextSelectors(element, selectors)
  addCssSelectors(element, selectors)
}
```

### 2. `lib/recorder-core.js` - Shared Core (453 lines)

**SINGLE SOURCE OF TRUTH** for recording logic shared with Desktop app.

```javascript
// Exported Functions
detectApp()                       // Detect Salesforce, ServiceNow, etc.
findInteractiveElement(target)    // Find actual clickable element
isGenericContainer(element)       // Check if element is meaningless
isSensitiveField(element)         // Detect password fields
getFieldLabel(element)            // Get label for input
getElementSelectors(element)      // Generate all selectors
getBestSelector(element)          // Get best with fallbacks
```

### 3. `lib/smart-selector.js` - Selector Generation (422 lines)

Multi-strategy selector generation with priority ranking.

```javascript
class SmartSelector {
  // Priority order (higher = more reliable)
  selectorPriority = {
    'data-testid': 100,
    'data-test': 95,
    'data-cy': 95,
    'aria-label': 85,
    'placeholder': 70,
    'name': 65,
    'id': 60,           // IDs can be dynamic
    'text-content': 55,
    'css-stable': 50,
    'xpath': 20,
  }
  
  generateSelectors(element)       // Generate all possible selectors
  getBestSelector(element)         // Get best with fallbacks
  rankSelectors(selectors)         // Sort by confidence
}
```

### 4. `lib/app-selectors.js` - App Configs (846 lines)

Application-specific selector strategies:

```javascript
const AppSelectorConfig = {
  'salesforce': {
    name: 'Salesforce',
    selectors: [
      { name: 'data-aura-class', priority: 95 },
      { name: 'data-refid', priority: 90 },
      { name: 'lightning-component', priority: 88 },
    ],
    waitStrategy: 'aura-ready',
  },
  'servicenow': { ... },
  'workday': { ... },
  'dynamics365': { ... },
  'sap': { ... },
  'oracle': { ... },
  // ... more apps
}
```

### 5. `lib/playwright-generator.js` - Code Generation (481 lines)

Generates Playwright test code from recorded actions.

```javascript
class PlaywrightGenerator {
  constructor(options)
  generate(actions)                // Generate test file
  generateStep(action)             // Generate single step
  generateAssertion(action)        // Generate assertion
  formatSelector(selector)         // Format for Playwright
}
```

### 6. `background.js` - Service Worker (2317 lines)

Message routing and state management.

```javascript
// Message Types
'START_RECORDING'     // Start recording in tab
'STOP_RECORDING'      // Stop and return actions
'GET_STATUS'          // Get recorder status
'ANALYZE_PAGE'        // Run page analysis
'GENERATE_TEST'       // Generate Playwright code
'SYNC_TO_CLOUD'       // Sync with Flowstral cloud
```

### 7. `sidepanel.js` - Side Panel UI (5293 lines)

Full-featured test builder and recording interface.

## Message Flow

```
┌──────────────┐    chrome.runtime     ┌──────────────┐
│   Popup/     │ ──────────────────▶  │  Background  │
│   SidePanel  │                      │   (Router)   │
└──────────────┘                      └──────────────┘
       ▲                                     │
       │                                     │ chrome.tabs.sendMessage
       │ Response                            ▼
       │                              ┌──────────────┐
       └───────────────────────────── │   Content    │
                                      │   Script     │
                                      └──────────────┘
```

## Selector Strategy

When an element is clicked/typed, multiple selectors are generated:

```javascript
// Example: Login button click
{
  selectors: [
    { type: 'testid', selector: '[data-testid="login-btn"]', confidence: 100 },
    { type: 'role', playwright: "getByRole('button', { name: 'Log In' })", confidence: 90 },
    { type: 'text', playwright: "getByText('Log In')", confidence: 85 },
    { type: 'name', selector: '[name="login"]', confidence: 80 },
    { type: 'css', selector: 'button.login-button', confidence: 50 },
  ],
  primary: { /* best selector */ },
  fallbacks: [ /* backup selectors */ ]
}
```

## App Detection

Auto-detects the current application for optimized handling:

```javascript
function detectApp() {
  const url = window.location.href.toLowerCase();
  
  // Check URL patterns
  if (url.includes('salesforce') || url.includes('force.com')) return 'salesforce';
  if (url.includes('servicenow')) return 'servicenow';
  if (url.includes('workday')) return 'workday';
  
  // Check DOM elements
  if (document.querySelector('lightning-')) return 'salesforce-lwc';
  if (document.querySelector('[data-aura-rendered-by]')) return 'salesforce-aura';
  
  // Check global objects
  if (window.Aura || window.$A) return 'salesforce';
  if (window.g_form) return 'servicenow';
  
  return 'generic';
}
```

## Recording Flow

```
1. User clicks "Start Recording"
   └─▶ sidepanel → background → content (ActionRecorder.start())

2. User interacts with page
   └─▶ content captures event
       └─▶ findInteractiveElement() to get actual element
       └─▶ getBestSelector() to generate selectors
       └─▶ addAction() to store

3. User types in input field
   └─▶ content captures 'input' event
       └─▶ Sets up pendingInput with 1500ms debounce
       └─▶ On timeout or next action: flushPendingInput()

4. User clicks "Stop Recording"
   └─▶ sidepanel → background → content (ActionRecorder.stop())
       └─▶ Returns all captured actions

5. User clicks "Export"
   └─▶ PlaywrightGenerator.generate(actions)
       └─▶ Returns Playwright test code
```

## Shared Code with Desktop

The following files in `src/lib/` are **shared** with Flowstral Desktop:

| File | Shared? | Desktop Location |
|------|---------|------------------|
| `recorder-core.js` | ✅ YES | Injected into embedded browser |
| `smart-selector.js` | ✅ YES | `src/main/lib/` |
| `app-selectors.js` | ✅ YES | `src/main/lib/` |
| `playwright-generator.js` | ⚠️ Logic copied | In `embedded-browser.js` |

**Sync Process:**
1. Edit files in `flowstral-extension/src/lib/`
2. Copy to `flowstral-desktop/src/main/lib/`
3. For `recorder-core.js`, functions are copied into injected script

## Permissions

Required browser permissions (manifest.json):

```json
{
  "permissions": [
    "activeTab",        // Access current tab
    "storage",          // Local storage
    "sidePanel",        // Side panel API
    "tabs",             // Tab management
    "scripting"         // Inject scripts
  ],
  "host_permissions": [
    "<all_urls>"        // Access all pages
  ]
}
```

## Development

### Loading Unpacked

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `flowstral-extension` folder

### Debugging

- **Content Script**: Right-click page → Inspect → Console
- **Background**: Extensions page → "Inspect views: service worker"
- **Popup/SidePanel**: Right-click → Inspect

### Building

```bash
# No build step required - plain JavaScript
# Just zip the folder for distribution
```

### 8. `lib/network-capture.js` - HAR Capture for Load Testing & API Testing

Browser-native HTTP/WebSocket recording; exports **HAR (HTTP Archive)** for:

- **Load testing:** Import HAR into k6, JMeter, Gatling, NeoLoad to replay traffic at scale.
- **API testing:** Use HAR in Postman, Insomnia, or API test suites; request/response headers and timing preserved.

```javascript
class NetworkCapture {
  start(sessionId)              // Start capturing network traffic
  stop()                        // Stop and return captured data
  exportAsHAR()                 // Return HAR 1.2 format
  
  // Captured: XHR/Fetch/document/WebSocket; full headers; timing; request body
  // Auto-detected correlations: session IDs, auth tokens, CSRF, request IDs
}
```

**Key Features:**
- No proxy or SSL cert setup; works with any site (including strict CSP)
- True browser timing (not proxy-delayed)
- Full WebSocket support
- HAR 1.2 standard format
- Automatic correlation detection for session IDs, auth tokens, CSRF tokens, request IDs

## Recent Updates

- [x] Network capture for protocol-level testing (Dec 2024)
- [x] Multi-tab recording support (Dec 2024)
- [x] 30+ enterprise app optimizations (Dec 2024)

## Future Improvements

- [ ] Add Debug Mode via backend API (match desktop)
- [ ] Migrate to TypeScript
- [ ] Add unit tests for selectors
- [ ] Create npm package for shared lib
- [ ] Add visual regression testing
- [ ] Implement AI-powered suggestions

