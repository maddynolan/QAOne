# QAAI Record & Playback - Deep Dive Documentation

## Executive Summary

This document details the complete record and playback architecture, all bugs discovered during the debugging session, fixes applied, and troubleshooting guide.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Recording Flow](#2-recording-flow)
3. [Playback Flow](#3-playback-flow)
4. [Bugs Found & Fixed](#4-bugs-found--fixed)
5. [Element Finding Strategies](#5-element-finding-strategies)
6. [AI Fallback System](#6-ai-fallback-system)
7. [Troubleshooting Guide](#7-troubleshooting-guide)
8. [Configuration Options](#8-configuration-options)

---

## 1. Architecture Overview

### Component Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBAPP (React/TypeScript)                     │
│                 src/pages/PlaywrightRecorderPage.tsx             │
│  - UI for recording controls, step display, test execution       │
│  - Communicates via IPC to Electron main process                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ IPC (via webapp-preload.js)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ELECTRON MAIN PROCESS                            │
│              flowstral-desktop/src/main/index.js                 │
│  - Routes IPC calls to appropriate handlers                      │
│  - Manages PlaywrightRecorder instance                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PLAYWRIGHT RECORDER                                 │
│        flowstral-desktop/src/main/playwright-recorder.js         │
│  - Core recording and playback logic                             │
│  - Browser management via Playwright                             │
│  - Calls SmartFinder for element location                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      SMART FINDER       │   │    RECIPE RECORDER      │
│   lib/smart-finder.js   │   │  lib/element-recipe.js  │
│ - 10-phase find logic   │   │ - Captures element data │
│ - Apostrophe handling   │   │ - What/Where/Which      │
│ - Shadow DOM support    │   │ - Text normalization    │
└─────────────────────────┘   └─────────────────────────┘
```

### Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `playwright-recorder.js` | Main recorder class, `runTest()`, `executeAction()` | ~10,700 |
| `smart-finder.js` | 10-phase element finding with fallbacks | ~1,050 |
| `element-recipe.js` | Element analysis and recipe creation | ~600 |
| `recipe-recorder-integration.js` | Legacy ↔ Recipe format conversion | ~850 |
| `action-handlers.js` | Extracted action handlers (click, fill, etc.) | ~750 |
| `PlaywrightRecorderPage.tsx` | Web UI for recorder | ~8,600 |

---

## 2. Recording Flow

### Step-by-Step Recording Process

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "START RECORDING"                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. PlaywrightRecorderPage.tsx                                    │
│    - Calls: flowstral.playwrightRecorder.start(url, options)     │
│    - IPC: 'playwright-recorder-start'                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. index.js (IPC Handler)                                        │
│    - Creates PlaywrightRecorder if not exists                    │
│    - Calls: playwrightRecorder.start(url, options)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PlaywrightRecorder.start()                                    │
│    - Launches Chromium browser via Playwright                    │
│    - Navigates to URL                                            │
│    - Injects CDP listener for user actions                       │
│    - Injects Recipe recorder script                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. USER PERFORMS ACTIONS IN BROWSER                              │
│    Each action triggers:                                         │
│    a) CDP event (click, input, navigation)                       │
│    b) Recipe capture (element analysis)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Action Processing                                             │
│    - Merges CDP data + Recipe data                               │
│    - Creates RecordedAction object with:                         │
│      • qword (Click, Fill, Select, etc.)                         │
│      • args [elementText, value]                                 │
│      • selectorObj (multiple selector strategies)                │
│      • recipe (what/where/which)                                 │
│      • element (tag, role, testId, etc.)                         │
│    - Emits 'playwright-recorder-action' event                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. PlaywrightRecorderPage.tsx receives action                    │
│    - Adds to actions[] state                                     │
│    - Displays in Recorded Steps list                             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Captured During Recording

For each action, the system captures:

```javascript
{
  id: "uuid-v4-string",
  qword: "Click",                    // Action type
  type: "click",                     // Normalized type
  args: ["Submit", null],            // [elementText, value]
  description: "Click \"Submit\"",   // Human-readable
  timestamp: 1705678901234,
  
  // Selector strategies (multiple for fallback)
  selectorObj: {
    playwright: "button:has-text('Submit')",
    css: "button.submit-btn",
    xpath: "//button[text()='Submit']",
    testId: "submit-button",
    text: "Submit",
    role: "button",
    ariaLabel: "Submit form"
  },
  
  // Recipe for SmartFinder V2
  recipe: {
    what: { role: "button", text: "Submit", tag: "button" },
    where: { landmark: "main", nearText: "Form" },
    which: { testId: "submit-button", position: 1 }
  },
  
  // Element metadata
  element: {
    tagName: "BUTTON",
    role: "button",
    text: "Submit",
    testId: "submit-button",
    id: "submitBtn",
    className: "btn btn-primary"
  }
}
```

---

## 3. Playback Flow

### Step-by-Step Playback Process

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "RUN TEST"                                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. PlaywrightRecorderPage.tsx::runTest()                         │
│    - Normalizes actions (text, apostrophes)                      │
│    - Calls: flowstral.playwrightRecorder.runTest(options)        │
│    - IPC: 'playwright-recorder-run-test'                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. index.js (IPC Handler)                                        │
│    - Calls: playwrightRecorder.runTest(options)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PlaywrightRecorder.runTest()                                  │
│    - Launches/reuses browser                                     │
│    - Navigates to start URL                                      │
│    - Loops through steps[]                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FOR EACH STEP: executeAction(action)                          │
│                                                                  │
│    Step Type Routing:                                            │
│    ├── navigate/goto → page.goto(url)                            │
│    ├── click/clicktext → findElement() → click()                 │
│    ├── fill/type → findElement() → fill(value)                   │
│    ├── select → findElement() → selectOption()                   │
│    ├── assert → verify element/text exists                       │
│    └── sf-* → Salesforce-specific handlers                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ELEMENT FINDING (4-Layer Fallback)                            │
│                                                                  │
│    Layer 1: findElementWithRetry()                               │
│    ├── SmartFinder.find(recipe)  [10 phases]                     │
│    └── _findElement(action)      [50+ strategies]                │
│                                                                  │
│    Layer 2: If not found on main page                            │
│    └── Search in iframes                                         │
│                                                                  │
│    Layer 3: AI Vision Fallback                                   │
│    └── Screenshot + GPT-4o → coordinates                         │
│                                                                  │
│    Layer 4: Report failure with details                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Execute Action on Found Element                               │
│    - Scroll into view                                            │
│    - Highlight briefly (green outline)                           │
│    - Perform action (click/fill/select)                          │
│    - Wait for navigation/network idle                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Return Result                                                 │
│    { success: true/false, error: "...", strategy: "..." }        │
└─────────────────────────────────────────────────────────────────┘
```

### Label Extraction During Playback

The `getActionLabel()` function extracts element text from multiple sources:

```javascript
// Priority order (first non-empty wins):
1. action.label
2. action.text
3. action.selectorObj?.text
4. action.args?.[0]
5. Extract from description: 'Click "Submit"' → "Submit"
6. action.description (last resort)

// Then normalize apostrophes:
"Saver's" → "Saver's" (curly → straight)
```

---

## 4. Bugs Found & Fixed

### Bug #1: Incomplete Label Extraction (10 places)

**Location**: `playwright-recorder.js`, `action-handlers.js`, `salesforce-handlers.js`

**Problem**:
```javascript
// BEFORE (broken):
const label = action.label || action.text;
// Missing: description fallback, args fallback, selectorObj.text
```

**Fix**:
```javascript
// AFTER (comprehensive):
const label = getActionLabel(action);

// getActionLabel checks ALL sources:
function getActionLabel(action) {
  let label = action.label || 
              action.text || 
              action.selectorObj?.text ||
              action.args?.[0];
  
  if (!label && action.description) {
    const match = action.description.match(/(?:Click|Fill|Select)\s*"([^"]+)"/i);
    label = match ? match[1] : action.description;
  }
  
  return normalizeTextForMatching(label || '');
}
```

**Files Changed**: 
- `playwright-recorder.js` (8 places)
- `action-handlers.js` (4 places)  
- `salesforce-handlers.js` (1 place)

---

### Bug #2: Apostrophe Mismatch

**Problem**: Recorded text "Saver's" (straight `'`) didn't match page text "Saver's" (curly `'`)

**Fix**: Added text normalization at multiple levels:

```javascript
// Module-level normalization function
const normalizeTextForMatching = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'") // All apostrophes → straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')              // All quotes → straight
    .replace(/\s+/g, ' ')
    .trim();
};
```

**Also added flexible regex matching in SmartFinder**:
```javascript
createFlexibleTextRegex(text) {
  let escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace apostrophes with pattern matching ANY apostrophe variant
  escaped = escaped.replace(/['\u2018\u2019]/g, "['\u2018\u2019']");
  return new RegExp(escaped, 'i');
}
```

---

### Bug #3: Missing Role Inference

**Location**: `recipe-recorder-integration.js`

**Problem**: Recipe had `role: null` when element role wasn't explicitly captured

**Fix**:
```javascript
// Infer role from action type and tag
let inferredRole = element.role || selectorObj.role;
if (!inferredRole && legacyAction.type?.includes('click')) {
  const tag = element.tagName?.toLowerCase();
  if (tag === 'a') inferredRole = 'link';
  else if (tag === 'button') inferredRole = 'button';
  else inferredRole = 'link'; // Default for clicks on links
}
```

---

### Bug #4: Undefined Function Reference

**Location**: `playwright-recorder.js` line 5507

**Problem**: Code called `normalizeApostrophes()` which was removed

**Fix**: Changed to use module-level `normalizeTextForMatching()`

---

### Bug #5: Web App Stripping Critical Fields

**Location**: `PlaywrightRecorderPage.tsx`

**Problem**: When sending actions to TestExecutor, critical fields were missing:
```javascript
// BEFORE: Missing text, label, element, recipe
steps: actions.map(a => ({
  id: a.id,
  type: a.type,
  args: a.args,
  selector: a.selectorObj?.selector,
}))
```

**Fix**:
```javascript
// AFTER: All fields passed
steps: actions.map(a => ({
  id: a.id,
  type: a.type,
  qword: a.qword,
  args: a.args,
  selector: a.selectorObj?.playwright || a.selectorObj?.selector,
  selectorObj: a.selectorObj,
  text: a.selectorObj?.text || a.text || a.args?.[0],
  label: a.selectorObj?.text || a.label || a.args?.[0],
  element: a.element || { /* reconstructed */ },
  recipe: a.recipe || a.target,
  // ... all other fields
}))
```

---

### Bug #6: normalizeText Stripping Non-ASCII

**Location**: `PlaywrightRecorderPage.tsx`

**Problem**: Text normalization was removing all non-ASCII characters including curly apostrophes

**Fix**: Changed to normalize apostrophes instead of stripping them

---

## 5. Element Finding Strategies

### SmartFinder 10-Phase Approach

```
Phase 0: TestId (most reliable)
         └── getByTestId(which.testId)

Phase 1: Scope by landmark/container
         └── Narrow search to 'main', 'navigation', etc.

Phase 2: Role + Text (semantic)
         ├── getByRole(role, { name: text })
         ├── Apostrophe-flexible regex
         ├── Singular text fallback (for tabs)
         ├── Regex partial matching
         └── Multi-role fallback (link → button → menuitem)

Phase 3: Text-only strategies
         ├── getByText(text, { exact: true })
         ├── getByText(text, { exact: false })
         └── Apostrophe-flexible text matching

Phase 4: Label/Placeholder (for inputs)
         ├── getByLabel(text)
         └── getByPlaceholder(text)

Phase 5: ID-based
         └── locator('#' + id)

Phase 6: CSS selector
         └── locator(cssSelector)

Phase 7: XPath
         └── locator('xpath=' + xpath)

Phase 8: Attribute-based
         ├── [aria-label*="text"]
         ├── [title*="text"]
         └── [name*="text"]

Phase 9: Shadow DOM
         ├── pierce/[data-testid="..."]
         ├── pierce/role:has-text("...")
         └── Manual shadow DOM walking

Phase 10: Coordinate-based (last resort)
          └── Element at specific position
```

### Legacy _findElement 50+ Strategies

For cases where SmartFinder fails, the legacy finder tries:

```javascript
// Selector-based
1. Direct selector (CSS/XPath)
2. Playwright selector
3. testId variations

// Text-based  
4. getByRole(role, { name: label })
5. getByText(label, { exact: true })
6. getByText(label, { exact: false })
7. Button with text
8. Link with text
9. Input by placeholder
10. Input by label
11. Any element with text

// Attribute-based
12-20. Various attribute selectors

// Keyword extraction
21-30. Extract keywords and search

// Apostrophe variations
31-40. All apostrophe variants

// Link-specific
41-50. href contains, aria-label, etc.
```

---

## 6. AI Fallback System

### When AI Fallback Triggers

```
All deterministic strategies failed
         │
         ▼
┌────────────────────────────────┐
│ Check: enableAIFallback = true │
│ Check: aiCallsThisRun < budget │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ Take page screenshot (PNG)     │
│ Get viewport dimensions        │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ Try 1: Backend AI Service      │
│ POST /api/ai/vision/find-element│
└───────────────┬────────────────┘
                │ (if fails)
                ▼
┌────────────────────────────────┐
│ Try 2: OpenAI API Direct       │
│ Model: gpt-4o-mini             │
│ Prompt: Find element coords    │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ If found with >70% confidence: │
│ Click at (x, y) coordinates    │
└────────────────────────────────┘
```

### Configuration

```javascript
// In PlaywrightRecorder constructor:
this.enableAIFallback = true;      // Enable AI vision fallback
this.maxAICallsPerRun = 5;         // Budget per test run
this.aiCallsThisRun = 0;           // Counter (reset each run)
```

### Requirements

For AI fallback to work, ONE of these must be true:
1. Backend running at `localhost:8000` with `/api/ai/vision/find-element` endpoint
2. `OPENAI_API_KEY` environment variable set

---

## 7. Troubleshooting Guide

### Problem: Element Not Found

**Debug Steps:**

1. **Check Console Logs** (Ctrl+Shift+I in Electron)
   ```
   [PlaywrightRecorder] Recipe for SmartFinder: { role: "link", text: "..." }
   [SmartFinder] Trying strategy: role+text...
   [SmartFinder] Strategy failed: role+text
   ```

2. **Verify Action Data**
   - Is `text` populated? 
   - Is `role` correct?
   - Is the element in Shadow DOM?

3. **Try Manual Override**
   - Edit step → Add CSS selector
   - Use browser DevTools to get selector

### Problem: Apostrophe Mismatch

**Symptoms:**
- Recorded: "Saver's Switch"
- Page shows: "Saver's Switch"
- Error: "Could not find element"

**Fix:**
- Should be auto-handled by `normalizeTextForMatching()`
- Check logs for what text is being searched

### Problem: AI Fallback Not Working

**Check:**
1. Is `enableAIFallback: true`?
2. Is budget exhausted? (Check: `aiCallsThisRun < maxAICallsPerRun`)
3. Is backend running? Or `OPENAI_API_KEY` set?

**Logs to look for:**
```
[AI Fallback] AI fallback is disabled
[AI Fallback] Budget exhausted (5/5 calls used)
[AI Fallback] Backend AI service not available
```

### Problem: Web App Changes Not Taking Effect

**Cause:** Web app is loaded from built files, not dev server

**Fix:**
```bash
# Option 1: Run in dev mode
cd flowstral-desktop
npm run dev  # Loads from localhost:8080

# Option 2: Rebuild webapp
npm run build:webapp
npm start
```

---

## 8. Configuration Options

### PlaywrightRecorder Options

```javascript
const recorder = new PlaywrightRecorder({
  // Recording
  useRecipeRecorder: true,         // Use Recipe system for recording
  
  // Playback
  useSmartFinderForPlayback: true, // Use SmartFinder for element finding
  enableAIFallback: true,          // AI vision as last resort
  maxAICallsPerRun: 5,             // AI call budget per test
  
  // Browser
  headless: false,                 // Show browser during playback
  timeout: 30000,                  // Default action timeout
});
```

### runTest Options

```javascript
await recorder.runTest({
  url: "https://example.com",
  steps: [...],
  headless: false,                 // Show browser
  timeout: 30000,                  // Action timeout
  freshBrowser: false,             // true = clean state, no cookies
  debugMode: false,                // true = step-by-step execution
});
```

### Environment Variables

```bash
BACKEND_URL=http://localhost:8000  # Backend API URL
OPENAI_API_KEY=sk-...              # For direct OpenAI API calls
FLOWSTRAL_DEV_PORT=8080            # Dev server port
```

---

## Appendix: Debug Logging

To enable verbose logging, the following console output is available:

```javascript
// Element finding debug
[PlaywrightRecorder] ========== ELEMENT FINDING DEBUG ==========
[PlaywrightRecorder] Action data: { type, text, label, args[0], ... }
[PlaywrightRecorder] Recipe for SmartFinder: { what: {...}, where: {...}, which: {...} }
[PlaywrightRecorder] Calling SmartFinder.find()...
[PlaywrightRecorder] SmartFinder result: FOUND/NOT FOUND

// AI fallback debug
[PlaywrightRecorder] ========== AI FALLBACK CHECK ==========
[PlaywrightRecorder] clickResult: FOUND/NULL
[PlaywrightRecorder] enableAIFallback: true/false
[PlaywrightRecorder] aiCallsThisRun: 0/5
[AI Fallback] 🤖 Attempting AI vision for: "element description"
[AI Fallback] ✅ AI found element at (x, y) with 95% confidence
```

---

*Last Updated: January 2026*
*Document Version: 1.0*
