# Flowstral Browser Extension

> **Chrome Extension for Test Recording**  
> Capture browser interactions and generate Playwright scripts

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Components](#components)
5. [Recording Flow](#recording-flow)
6. [Selector Generation](#selector-generation)
7. [Backend Integration](#backend-integration)
8. [Installation](#installation)
9. [Development](#development)

---

## Overview

Flowstral is a Chrome extension that records user interactions with web pages and generates Playwright test scripts. It supports smart selector generation for 20+ enterprise applications including Salesforce, ServiceNow, Workday, and more.

### Key Features

| Feature | Description |
|---------|-------------|
| **Action Recording** | Captures clicks, inputs, navigations, scrolls |
| **Smart Selectors** | App-aware selector generation (Salesforce, Angular, React) |
| **Real-time Preview** | See generated code as you record |
| **Page Analysis** | Analyze page elements for testability |
| **Multi-format Export** | Playwright Python/TS, Selenium, Cypress |
| **Backend Integration** | WebSocket sync with QAAI backend |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Flowstral Extension Architecture                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Content   │────▶│ Background  │────▶│   Backend   │                   │
│  │   Script    │◀────│   Script    │◀────│     API     │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│        │                    │                                               │
│        │ DOM Events         │ Chrome APIs                                   │
│        ▼                    ▼                                               │
│  ┌─────────────┐     ┌─────────────┐                                       │
│  │   Web Page  │     │  Side Panel │                                       │
│  │   (Target)  │     │     UI      │                                       │
│  └─────────────┘     └─────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
User Action (click/type)
       │
       ▼
Content Script (content.js)
       │ Captures DOM event
       │ Generates selector
       ▼
chrome.runtime.sendMessage()
       │
       ▼
Background Script (background.js)
       │ Routes message
       │ Manages session
       ▼
Side Panel (sidepanel.js)
       │ Updates UI
       │ Generates script
       ▼
Backend API (optional)
       │ Stores session
       │ Enhances selectors
```

---

## Directory Structure

```
flowstral-extension/
├── manifest.json               # Chrome Extension manifest (v3)
├── package.json                # NPM dependencies
├── playwright.config.ts        # Playwright config for generated tests
├── README.md                   # Extension readme
│
├── icons/                      # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── examples/                   # Example generated tests
│   └── recorded_test.py
│
└── src/
    ├── background/
    │   └── background.js       # Service worker (session management)
    │
    ├── content/
    │   ├── content.js          # Injected script (event capture)
    │   └── content.css         # Injected styles (highlights)
    │
    ├── sidepanel/
    │   ├── sidepanel.html      # Side panel UI
    │   └── sidepanel.js        # Side panel logic (2000+ lines)
    │
    ├── popup/
    │   ├── popup.html          # Toolbar popup (minimal)
    │   └── popup.js
    │
    └── lib/                    # Shared libraries
        ├── smart-selector.js   # Intelligent selector generation
        ├── app-selectors.js    # App-specific selector strategies
        ├── playwright-generator.js  # Script generation
        ├── page-analyzer-prototype.js  # Page analysis
        └── computer-vision.js  # Visual element detection
```

---

## Components

### 1. Content Script (`src/content/content.js`)

Injected into every page to capture DOM events.

**Event Types Captured:**

| Event | Handler | Data Captured |
|-------|---------|---------------|
| `click` | `handleClick()` | Element, coordinates, text |
| `input` | `handleInput()` | Field, value, type |
| `change` | `handleChange()` | Form field changes |
| `submit` | `handleSubmit()` | Form data |
| `keydown` | `handleKeydown()` | Key presses (Enter, Tab) |

**Selector Generation:**

```javascript
function generateSelector(element) {
  // Priority order:
  // 1. data-testid / data-cy / data-qa
  // 2. id (if stable, not dynamic)
  // 3. name attribute
  // 4. aria-label
  // 5. role + accessible name
  // 6. text content
  // 7. CSS path (fallback)
  
  if (element.dataset.testid) {
    return `[data-testid="${element.dataset.testid}"]`;
  }
  
  if (element.id && !isDynamicId(element.id)) {
    return `#${element.id}`;
  }
  
  // ... more strategies
}

function isDynamicId(id) {
  // Detect dynamic IDs (React, Angular, Salesforce)
  return /[0-9a-f]{8,}|_[0-9]+$|^ember|^react/i.test(id);
}
```

**Highlighting:**

```javascript
function highlightElement(element) {
  element.style.outline = '2px solid #4CAF50';
  element.style.outlineOffset = '2px';
  
  setTimeout(() => {
    element.style.outline = '';
    element.style.outlineOffset = '';
  }, 500);
}
```

### 2. Background Script (`src/background/background.js`)

Service worker managing extension state and communication.

**Responsibilities:**
- Session management (create, update, end)
- Message routing between content/sidepanel
- Backend API communication
- Storage management

**Key Functions:**

```javascript
// Session management
let currentSession = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      currentSession = createSession(sender.tab);
      break;
      
    case 'STOP_RECORDING':
      finalizeSession(currentSession);
      currentSession = null;
      break;
      
    case 'RECORD_EVENT':
      if (currentSession) {
        currentSession.events.push(message.event);
        notifySidePanel(message.event);
      }
      break;
      
    case 'GET_SESSION':
      sendResponse(currentSession);
      break;
  }
  return true; // Keep channel open for async
});
```

### 3. Side Panel (`src/sidepanel/sidepanel.js`)

Main UI for the extension with recording controls and script preview.

**File Size:** ~2000+ lines

**State Management:**

```javascript
class SidePanelState {
  constructor() {
    this.isRecording = false;
    this.events = [];
    this.startUrl = '';
    this.pageAnalysis = null;
    this.framework = 'playwright-python';
    this.generatedScript = '';
  }
}

const state = new SidePanelState();
```

**UI Sections:**

| Section | Purpose |
|---------|---------|
| **Header** | Extension title, version |
| **Controls** | Start/Stop recording, Clear |
| **Events List** | Recorded actions display |
| **Code Preview** | Generated Playwright script |
| **Suggest Tab** | AI-powered element suggestions |
| **Settings** | Framework selection, options |

**Key Methods:**

```javascript
// Start recording
async startRecording() {
  this.state.isRecording = true;
  this.state.events = [];
  
  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  this.state.startUrl = tab.url;
  
  // Notify content script
  chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
  
  this.updateUI();
}

// Stop recording
async stopRecording() {
  this.state.isRecording = false;
  
  // Generate script
  this.generateScript();
  
  this.updateUI();
}

// Generate Playwright script
generateScript() {
  const framework = this.state.framework;
  const events = this.state.events;
  
  let script = '';
  
  switch (framework) {
    case 'playwright-python':
      script = generatePlaywrightPython(events);
      break;
    case 'playwright-typescript':
      script = generatePlaywrightTS(events);
      break;
    // ... other frameworks
  }
  
  this.state.generatedScript = script;
}

// Export to Workflow Editor
async openInWorkflowEditor() {
  const workflowData = {
    name: `Recorded Workflow - ${new Date().toLocaleString()}`,
    startUrl: this.state.startUrl || this.state.pageAnalysis?.url || '',
    events: this.state.events,
    framework: this.state.framework
  };
  
  // Open workflow editor with data
  const editorUrl = `http://localhost:5173/workflow-editor?data=${encodeURIComponent(JSON.stringify(workflowData))}`;
  chrome.tabs.create({ url: editorUrl });
}
```

### 4. Library Files (`src/lib/`)

#### Smart Selector (`smart-selector.js`)

Intelligent selector generation with app awareness.

```javascript
class SmartSelector {
  constructor(element, appType) {
    this.element = element;
    this.appType = appType || this.detectAppType();
  }
  
  detectAppType() {
    const html = document.documentElement.outerHTML;
    
    if (html.includes('lightning-') || html.includes('lwc')) return 'salesforce';
    if (html.includes('ng-') || html.includes('[ng')) return 'angular';
    if (html.includes('data-reactroot') || html.includes('__react')) return 'react';
    if (html.includes('data-v-')) return 'vue';
    if (html.includes('sn-') || html.includes('ServiceNow')) return 'servicenow';
    
    return 'generic';
  }
  
  generateSelector() {
    const strategies = this.getStrategiesForApp();
    
    for (const strategy of strategies) {
      const selector = strategy(this.element);
      if (selector && this.isUnique(selector)) {
        return selector;
      }
    }
    
    return this.fallbackSelector();
  }
  
  getStrategiesForApp() {
    switch (this.appType) {
      case 'salesforce':
        return [
          this.byDataId,
          this.byName,
          this.byAriaLabel,
          this.byLightningComponent,
          this.byText
        ];
      case 'angular':
        return [
          this.byTestId,
          this.byFormControlName,
          this.byNgReflect,
          this.byText
        ];
      // ... other apps
    }
  }
}
```

#### Playwright Generator (`playwright-generator.js`)

Converts events to Playwright code.

```javascript
function generatePlaywrightPython(events, options = {}) {
  const lines = [
    'from playwright.sync_api import expect',
    '',
    `def test_${options.testName || 'recorded_test'}(page):`,
    '    """Generated by Flowstral Recorder"""',
    ''
  ];
  
  for (const event of events) {
    const code = eventToPlaywrightPython(event);
    lines.push(`    ${code}`);
  }
  
  return lines.join('\n');
}

function eventToPlaywrightPython(event) {
  switch (event.type) {
    case 'navigate':
      return `page.goto("${event.url}")\n    page.wait_for_load_state("domcontentloaded")`;
      
    case 'click':
      return `page.${toPythonSelector(event.selector)}.click()`;
      
    case 'input':
      return `page.${toPythonSelector(event.selector)}.fill("${event.value}")`;
      
    case 'press':
      return `page.${toPythonSelector(event.selector)}.press("${event.key}")`;
      
    default:
      return `# Unknown event: ${event.type}`;
  }
}

function toPythonSelector(selector) {
  // Convert JS-style to Python-style
  // getByRole('button', { name: 'Submit' }) -> get_by_role("button", name="Submit")
  
  if (selector.includes('getByRole')) {
    const match = selector.match(/getByRole\(['"](\w+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}/);
    if (match) {
      return `get_by_role("${match[1]}", name="${match[2]}")`;
    }
  }
  
  // ... more conversions
}
```

---

## Recording Flow

### Step-by-Step Process

```
1. USER CLICKS RECORD
   └─ Side panel sends START_RECORDING to background
   └─ Background notifies content script
   └─ Content script adds event listeners

2. USER INTERACTS WITH PAGE
   └─ Content script captures DOM event
   └─ Generates best selector for element
   └─ Sends event to background script
   └─ Background adds to session
   └─ Side panel updates events list

3. USER CLICKS STOP
   └─ Content script removes listeners
   └─ Side panel generates script
   └─ User can copy/export/edit

4. EXPORT OPTIONS
   ├─ Copy to clipboard
   ├─ Download as file
   ├─ Open in Workflow Editor
   └─ Send to QAAI backend
```

### Event Object Structure

```javascript
{
  type: 'click',           // click, input, navigate, scroll, etc.
  timestamp: 1702627200000,
  element: {
    tagName: 'BUTTON',
    id: 'submit-btn',
    className: 'btn btn-primary',
    textContent: 'Submit',
    attributes: {
      'data-testid': 'submit-button',
      'aria-label': 'Submit form'
    }
  },
  selector: "page.get_by_role('button', name='Submit')",
  value: null,             // For input events
  coordinates: { x: 150, y: 300 },
  frameId: 0               // For iframe support
}
```

---

## Selector Generation

### Strategy Priority

| Priority | Strategy | Example |
|----------|----------|---------|
| 1 | data-testid | `[data-testid="submit-btn"]` |
| 2 | data-cy / data-qa | `[data-cy="submit"]` |
| 3 | id (stable) | `#submit-btn` |
| 4 | name | `[name="submit"]` |
| 5 | aria-label | `[aria-label="Submit form"]` |
| 6 | role + name | `getByRole('button', { name: 'Submit' })` |
| 7 | text content | `getByText('Submit')` |
| 8 | CSS path | `form > div:nth-child(2) > button` |

### App-Specific Strategies

#### Salesforce/LWC

```javascript
// Good selectors for Salesforce
'[data-id="field-name"]'           // data-id is stable
'lightning-input[name="Email"]'    // Component + name
'[data-field="Email"]'             // data-field attribute
'.slds-form-element[data-field]'   // SLDS classes with data attrs

// Avoid in Salesforce
'#lwc-123abc'                      // Dynamic LWC IDs
'.auraId_xyz'                      // Aura dynamic classes
```

#### Angular

```javascript
// Good selectors for Angular
'[formcontrolname="email"]'        // Reactive forms
'[ng-reflect-name="email"]'        // Input bindings
'[data-testid="email-input"]'      // Custom test IDs

// Avoid in Angular
'.ng-star-inserted'                // Dynamic ngIf classes
'#mat-input-0'                     // Material dynamic IDs
```

#### React

```javascript
// Good selectors for React
'[data-testid="submit-button"]'    // Test IDs
'[data-cy="submit"]'               // Cypress convention
'button:has-text("Submit")'        // Text content

// Avoid in React
'.sc-abc123'                       // Styled-components
'#react-select-2-input'            // Library IDs
```

---

## Backend Integration

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/flowstral/sessions` | POST | Create recording session |
| `/api/flowstral/events/batch` | POST | Submit recorded events |
| `/api/flowstral/sessions/{id}/script` | GET | Get generated script |
| `/api/flowstral/analyze` | POST | Analyze page elements |

### Session Sync

```javascript
async function syncWithBackend(session) {
  try {
    // Create session on backend
    const response = await fetch('http://localhost:8000/api/flowstral/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_url: session.startUrl,
        user_agent: navigator.userAgent
      })
    });
    
    const { session_id } = await response.json();
    session.backendId = session_id;
    
    // Sync events
    await fetch(`http://localhost:8000/api/flowstral/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id,
        events: session.events
      })
    });
    
  } catch (error) {
    console.log('Backend sync failed, continuing offline:', error);
  }
}
```

---

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit Chrome Web Store
2. Search "Flowstral Recorder"
3. Click "Add to Chrome"

### Developer Mode (Current)

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `flowstral-extension` directory
5. Pin the extension to toolbar

### Verify Installation

1. Click the extension icon in toolbar
2. Side panel should open
3. Navigate to any website
4. Click "Start Recording"

---

## Development

### Setup

```bash
cd flowstral-extension
npm install
```

### Build (if needed)

```bash
npm run build
```

### Reload After Changes

1. Make changes to source files
2. Go to `chrome://extensions`
3. Click refresh icon on the extension card
4. For sidepanel changes, close and reopen side panel

### Debug

**Background Script:**
```
chrome://extensions → Flowstral → "service worker" link → DevTools
```

**Content Script:**
```
Target page → DevTools → Console → Select "flowstral-extension" context
```

**Side Panel:**
```
Right-click side panel → Inspect
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Events not recording | Reload extension, refresh target page |
| Script not generating | Check DevTools console for errors |
| Backend not connecting | Verify backend is running on port 8000 |
| Selectors breaking | Update app-selectors.js for new patterns |

---

## Manifest Permissions

| Permission | Usage |
|------------|-------|
| `activeTab` | Access current tab for recording |
| `storage` | Save session data locally |
| `tabs` | Query and message tabs |
| `scripting` | Inject content scripts |
| `downloads` | Export scripts as files |
| `sidePanel` | Enable side panel UI |
| `<all_urls>` | Record on any website |

---

*Last updated: December 2024*
