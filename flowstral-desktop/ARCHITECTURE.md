# Flowstral Desktop - Architecture Documentation

> **Last Updated:** December 22, 2024  
> **Version:** 1.0.0

## Overview

Flowstral Desktop is an Electron application that provides a native desktop experience for recording, editing, and executing automated tests. It embeds the Flowstral React webapp and adds native capabilities like:

- **Embedded Browser**: A dockable browser for recording user interactions
- **Native Test Execution**: Run Playwright tests locally without cloud dependencies
- **Offline Support**: Full functionality without internet connection
- **Session Persistence**: Login states are preserved across app restarts

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         index.js                                 │   │
│  │  - Window management (BrowserWindow, BrowserView)               │   │
│  │  - IPC handlers for all webapp ↔ main communication             │   │
│  │  - Menu, tray, auto-updater                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                        │                        │           │
│           ▼                        ▼                        ▼           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │ EmbeddedBrowser │   │  TestExecutor   │   │   CloudConnector    │   │
│  │ (BrowserView)   │   │  (Playwright)   │   │   (API Client)      │   │
│  │                 │   │                 │   │                     │   │
│  │ - Recording     │   │ - Run tests     │   │ - Auth/Sync         │   │
│  │ - Suggestions   │   │ - Generate code │   │ - Cloud backup      │   │
│  │ - Navigation    │   │ - Video capture │   │                     │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED LIB (from Extension)                   │   │
│  │  - recorder-core.js    : findInteractiveElement, etc.           │   │
│  │  - smart-selector.js   : Multi-strategy selector generation     │   │
│  │  - app-selectors.js    : App-specific selectors (Salesforce)    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (contextBridge)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS (BrowserView)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    React Webapp (from /src)                      │   │
│  │  - Test Builder UI                                              │   │
│  │  - Desktop Recorder Page                                        │   │
│  │  - Dashboard, Settings, etc.                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    │ electronAPI (preload)              │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   webapp-preload.js (contextBridge)              │   │
│  │  - Exposes safe IPC methods to webapp                           │   │
│  │  - recorder.*, test.*, cloud.*, etc.                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
flowstral-desktop/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.js              # Entry point, window management
│   │   ├── embedded-browser.js   # BrowserView for recording
│   │   ├── test-executor.js      # Playwright test runner
│   │   ├── cloud-connector.js    # Cloud API client
│   │   ├── local-storage.js      # Electron-store wrapper
│   │   ├── license.js            # License validation
│   │   ├── recorder.js           # Legacy recorder (deprecated)
│   │   ├── browser-controller.js # Window automation
│   │   ├── preload.js            # Shell preload script
│   │   ├── webapp-preload.js     # Webapp preload (exposes electronAPI)
│   │   ├── browser-preload.js    # Embedded browser preload
│   │   ├── ipc/                  # IPC handlers (refactored)
│   │   │   ├── index.js          # Handler registration
│   │   │   ├── browser-handlers.js   # Embedded browser IPC
│   │   │   ├── storage-handlers.js   # Local storage IPC
│   │   │   ├── test-handlers.js      # Test execution IPC
│   │   │   └── utility-handlers.js   # Config, license, updates
│   │   └── lib/                  # Shared libraries
│   │       ├── recorder-script.js    # Injected recorder script
│   │       ├── action-converter.js   # QWord conversion
│   │       ├── playwright-export.js  # Code generation
│   │       ├── smart-selector.js     # Selector generation
│   │       └── app-selectors.js      # App-specific configs
│   └── renderer/                 # Shell UI (minimal)
│       ├── shell.html            # Main window HTML shell
│       ├── index.html            # Alternative shell
│       ├── app.js                # Shell JavaScript
│       └── styles.css            # Shell styles
├── assets/                       # Icons and images
├── scripts/                      # Build scripts
├── package.json
└── README.md
```

## Key Modules

### 1. `index.js` - Main Entry Point (1681 lines)

**Responsibilities:**
- Creates and manages the main BrowserWindow
- Creates BrowserViews for webapp and embedded browser
- Registers all IPC handlers
- Manages app lifecycle (ready, quit, focus)
- Handles auto-updates, tray, menu

**Key IPC Handlers:**

| Channel | Description |
|---------|-------------|
| `embedded-browser-show` | Show embedded browser with bounds |
| `embedded-browser-navigate` | Navigate to URL |
| `embedded-browser-start-recording` | Start recording actions |
| `embedded-browser-stop-recording` | Stop and return actions |
| `embedded-browser-suggest` | Get page suggestions |
| `embedded-browser-execute-action` | Execute action in browser |
| `export-to-test-builder` | Export recording to Test Builder |
| `run-playwright-test` | Execute Playwright test |
| `get-test-results` | Get test execution results |

### 2. `embedded-browser.js` - BrowserView Manager (1349 lines)

**Responsibilities:**
- Creates and configures BrowserView
- Injects recorder script into pages
- Captures user interactions (clicks, inputs, etc.)
- Converts actions to QWord format
- Generates Playwright code

**Key Methods:**

```javascript
class EmbeddedBrowser {
  create()              // Create BrowserView with settings
  navigate(url)         // Navigate to URL
  startRecording()      // Begin capturing actions
  stopRecording()       // Stop and return captured actions
  injectRecorder()      // Inject recording script into page
  recordAction(action)  // Process and store an action
  exportAsPlaywright()  // Generate Playwright test code
  _toQWord(action)      // Convert action to QWord format
  _buildSelectorObject() // Build robust selector object
}
```

**Recorder Script (Injected):**
The `injectRecorder()` method injects JavaScript into the page that:
- Uses functions from `recorder-core.js` (findInteractiveElement, etc.)
- Captures click, input, change, submit events
- Debounces input (1500ms) to consolidate typing
- Detects sensitive fields (passwords)
- Generates multiple selector strategies

### 3. `test-executor.js` - Playwright Runner (313 lines)

**Responsibilities:**
- Runs Playwright tests
- Captures screenshots/videos
- Returns detailed results

### 4. `webapp-preload.js` - Context Bridge (161 lines)

**Exposes to Webapp:**

```javascript
window.electronAPI = {
  // Desktop Recorder
  showEmbeddedBrowser(bounds),
  hideEmbeddedBrowser(),
  navigateEmbeddedBrowser(url),
  startRecording(),
  stopRecording(),
  suggestActions(),
  executeAction(action),
  exportToTestBuilder(testName),
  
  // Test Execution
  runPlaywrightTest(testCase),
  getTestResults(),
  
  // Cloud
  cloudSync(),
  cloudLogin(token),
  
  // Storage
  saveTest(test),
  loadTests(),
  
  // Utilities
  focusWebapp(),
  openExternal(url),
}
```

## Shared Code with Web Extension

The desktop app shares core recording logic with the browser extension to ensure consistency:

### Shared Files (Source of Truth: `flowstral-extension/src/lib/`)

| File | Purpose |
|------|---------|
| `recorder-core.js` | Core recording functions |
| `smart-selector.js` | Multi-strategy selector generation |
| `app-selectors.js` | App-specific configs (Salesforce, etc.) |

### Shared Functions in `recorder-core.js`

```javascript
// All functions are EXACT COPIES in desktop's embedded-browser.js
findInteractiveElement(target)  // Walk up DOM to find clickable element
isGenericContainer(element)     // Check if element is meaningless container
isSensitiveField(element)       // Detect password/secret fields
getFieldLabel(element)          // Get label for input field
getElementSelectors(element)    // Generate all possible selectors
getBestSelector(element)        // Get best selector with fallbacks
detectApp()                     // Detect current application (Salesforce, etc.)
```

### Sync Process

When updating recording logic:
1. **Edit** `flowstral-extension/src/lib/recorder-core.js`
2. **Copy** the updated functions to `embedded-browser.js`
3. Each function has comment: `// EXACT COPY from recorder-core.js - DO NOT MODIFY`

## QWord Format

Actions are stored in QWord format for consistency:

```javascript
{
  qword: 'ClickText' | 'Fill' | 'GoTo' | 'Select' | 'Check' | 'AssertText',
  args: ['arg1', 'arg2'],           // Arguments for the action
  displayArgs: ['arg1', '****'],    // Display-safe arguments
  selector: { type, value },        // Primary selector
  selectorObj: {                    // Full selector object
    primary: { selector, playwright, confidence },
    fallbacks: [...],
    strategies: [...]
  },
  element: {                        // Element metadata
    tagName, id, name, text,
    placeholder, ariaLabel
  },
  description: 'Human-readable',
  timestamp: 1234567890
}
```

## IPC Communication Flow

```
┌─────────────────┐     IPC Invoke      ┌─────────────────┐
│  React Webapp   │ ─────────────────▶ │  Main Process   │
│  (Renderer)     │                    │  (index.js)     │
│                 │ ◀───────────────── │                 │
│                 │     IPC Response   │                 │
└─────────────────┘                    └─────────────────┘
        │                                      │
        │ electronAPI                          │ Direct call
        ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│ webapp-preload  │                    │ EmbeddedBrowser │
│ (contextBridge) │                    │ TestExecutor    │
└─────────────────┘                    │ CloudConnector  │
                                       └─────────────────┘
```

## Session Persistence

The app uses `electron-store` and persistent sessions:

```javascript
// Persistent browser session (survives app restarts)
const persistentSession = session.fromPartition('persist:flowstral-browser');

// User preferences and local test storage
const store = new Store({
  name: 'flowstral-desktop',
  encryptionKey: 'your-encryption-key'
});
```

## Security Considerations

1. **Context Isolation**: `contextIsolation: true` for all webContents
2. **Node Integration**: `nodeIntegration: false` in renderer
3. **Preload Scripts**: Safe IPC bridge via contextBridge
4. **Sensitive Data**: Passwords masked with `••••••••`
5. **External Links**: Opened in system browser, not app

## Development

### Running Locally

```bash
cd flowstral-desktop
npm install
npm run dev
```

### Building

```bash
# Windows
npm run build:win

# Mac
npm run build:mac

# All platforms
npm run build
```

### Debugging

```bash
# Enable DevTools
ELECTRON_ENABLE_LOGGING=1 npm run dev

# Debug main process
npm run dev -- --inspect
```

## Future Improvements

- [ ] Extract IPC handlers to separate modules
- [ ] Create shared npm package for recorder-core
- [ ] Add unit tests for selector generation
- [ ] Implement hot-reload for development
- [ ] Add telemetry/analytics module

