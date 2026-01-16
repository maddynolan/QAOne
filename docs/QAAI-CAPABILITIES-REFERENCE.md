# QAAI Capabilities Reference

> **PURPOSE**: This document is a comprehensive reference for the QAAI test automation platform.
> Share this with AI assistants to quickly onboard them on the architecture and capabilities.
> Last Updated: January 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Recording System](#recording-system)
3. [Playback System](#playback-system)
4. [Element Finding (SmartFinder)](#element-finding-smartfinder)
5. [Element Recipe Model](#element-recipe-model)
6. [AI Fallback System](#ai-fallback-system)
7. [Multi-Tab and Cross-Origin Handling](#multi-tab-and-cross-origin-handling)
8. [Framework Support](#framework-support)
9. [Key Files Reference](#key-files-reference)
10. [Configuration Options](#configuration-options)
11. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### Project Structure
```
C:\QAAI\
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── routers/           # API endpoints
│   │   └── services/          # Business logic
│   │       ├── automation/    # Element resolvers, validators
│   │       └── executors/     # Test runner service
│   └── data/
│       └── test_cases/        # Stored test cases (JSON)
│
├── flowstral-desktop/         # Electron desktop app (MAIN)
│   └── src/main/
│       ├── index.js           # Main entry, IPC handlers
│       ├── playwright-recorder.js  # Recording & playback engine
│       ├── test-executor.js   # Alternative test executor
│       └── lib/
│           ├── smart-finder.js           # 8-phase element finder
│           ├── element-recipe.js         # Recipe model & analyzer
│           ├── recipe-recorder-integration.js  # Legacy ↔ Recipe conversion
│           ├── action-coalescer.js       # Dropdown sequence detection
│           ├── ai-explorer-agent.js      # AI exploration
│           └── ai-goal-agent.js          # Goal-based AI agent
│
├── flowstral-extension/       # Browser extension (Chrome/Firefox)
│   └── src/lib/
│       └── recorder-engine.js # Shared recorder engine
│
└── docs/                      # Documentation
    ├── QAAI-CAPABILITIES-REFERENCE.md  # THIS FILE
    └── RECORDING-PLAYBACK-DEEP-DIVE.md # Technical deep dive
```

### Two Execution Paths
| Path | Entry Point | Used When | Has AI Fallback |
|------|-------------|-----------|-----------------|
| PlaywrightRecorder | `playwright-recorder.js` | Desktop app recording/playback | ✅ YES |
| TestExecutor | `test-executor.js` | Backend API test runs | ✅ YES |

---

## Recording System

### Entry Points
1. **Desktop App** → `PlaywrightRecorder.start()` → Opens Playwright browser
2. **Browser Extension** → `recorder-engine.js` → Injects into page

### How Actions Are Captured

```
User Click → DOM Event → composedPath() → Element Analysis → Action Object
                              ↓
                    Pierces Shadow DOM
                    Gets actual clicked element
```

### Recording Flow
```javascript
// 1. User clicks element in browser
document.addEventListener('click', (e) => {
  const path = e.composedPath(); // Pierces Shadow DOM
  const target = path[0];        // Actual clicked element
  
  // 2. Analyze element
  const recipe = analyzeElement(target);  // what, where, which
  
  // 3. Check for duplicate elements
  const count = document.querySelectorAll(selector).length;
  const elementIndex = Array.from(matches).indexOf(target);
  
  // 4. Create action
  const action = {
    type: 'click',
    label: target.textContent,
    elementIndex: elementIndex,  // CRITICAL for disambiguation
    selector: {...},
    recipe: recipe
  };
});
```

### Key Recording Files
| File | Purpose |
|------|---------|
| `playwright-recorder.js` | Main recorder class, manages browser |
| `recorder-engine.js` | Shared engine (injected into page) |
| `element-recipe.js` | Contains `getElementAnalyzerScript()` |
| `recipe-recorder-integration.js` | Converts actions to recipes |

---

## Playback System

### 4-Layer Fallback Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYBACK REQUEST                              │
│                    action = { type: 'click', label: 'Submit' }   │
└────────────────────────────┬────────────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────────────┐
    │ LAYER 1: SmartFinder with Retry (3 attempts)                │
    │ - 8-phase element finding                                    │
    │ - Exponential backoff (500ms, 1000ms, 2000ms)               │
    │ SUCCESS RATE: ~95%                                          │
    └────────────────────────┬────────────────────────────────────┘
                             │ If failed
    ┌────────────────────────▼────────────────────────────────────┐
    │ LAYER 2: Legacy _findElement (50+ strategies)               │
    │ - testId, name, id, ariaLabel, role, CSS, text              │
    │ - Also with retry                                            │
    │ SUCCESS RATE: ~4% additional                                 │
    └────────────────────────┬────────────────────────────────────┘
                             │ If failed
    ┌────────────────────────▼────────────────────────────────────┐
    │ LAYER 3: AI Vision Fallback                                  │
    │ - Takes screenshot                                           │
    │ - Asks GPT-4o-mini for pixel coordinates                     │
    │ - Clicks at (x, y)                                           │
    │ - Budget: 5 calls per test run                               │
    │ SUCCESS RATE: ~1% additional (catches edge cases)            │
    └────────────────────────┬────────────────────────────────────┘
                             │ If failed
    ┌────────────────────────▼────────────────────────────────────┐
    │ LAYER 4: Report Failure                                      │
    │ - Clear error message                                        │
    │ - Screenshot of page state                                   │
    │ - All strategies tried listed                                │
    └─────────────────────────────────────────────────────────────┘
```

### Key Playback Methods
```javascript
// Main entry point for playback
PlaywrightRecorder.runTest({ url, steps }) 

// Execute single action
PlaywrightRecorder.executeAction(action)

// Find element with retry (3 attempts, exponential backoff)
PlaywrightRecorder.findElementWithRetry(action)

// Layer 1: SmartFinder
SmartFinder.find(recipe)

// Layer 2: Legacy finder
PlaywrightRecorder._findElement(action)

// Layer 3: AI Vision
PlaywrightRecorder.findElementWithAI(description, actionType)
```

---

## Element Finding (SmartFinder)

### Location: `flowstral-desktop/src/main/lib/smart-finder.js`

### 8-Phase Approach
```javascript
// Phase 0: testId (most reliable)
page.getByTestId(which.testId)

// Phase 1: Scope - Narrow search area
page.locator('[role="tablist"]')  // within
page.locator('main')               // landmark

// Phase 2: Role + Name
page.getByRole('button', { name: 'Add to Cart' })

// Phase 3: Text
page.getByText('Submit', { exact: true })

// Phase 4: Aria
page.getByLabel('Email address')

// Phase 5: Name attribute
page.locator('[name="email"]')

// Phase 6: ID
page.locator('#submit-btn')

// Phase 7: CSS Fallback
page.locator(confirm.cssSelector)

// Phase 8: Position disambiguation
locator.nth(position - 1)  // position is 1-based
```

### Handling Multiple Matches
```javascript
// When multiple elements match (e.g., 5 "Add to Cart" buttons)
async resolveMultiple(locator, which) {
  const count = await locator.count();
  
  if (count === 1) return locator.first();
  
  // Use position (most reliable for disambiguation)
  if (typeof which?.position === 'number' && which.position > 0) {
    return locator.nth(which.position - 1); // position is 1-based
  }
  
  // Or use parent context
  if (which?.parentContext) {
    return locator.filter({ has: page.locator(which.parentContext) }).first();
  }
  
  // Default to first
  return locator.first();
}
```

---

## Element Recipe Model

### Location: `flowstral-desktop/src/main/lib/element-recipe.js`

### Structure
```javascript
{
  what: {
    role: 'button',           // ARIA role (button, link, textbox, etc.)
    text: 'Add to Cart',      // Visible text
    tag: 'button',            // HTML tag
    type: 'submit'            // Input type (for inputs)
  },
  
  where: {
    landmark: 'main',         // Nearest landmark (header, main, nav, form)
    within: 'tabpanel',       // Parent with role (tablist, menu, toolbar)
    nearText: 'MacBook Pro',  // Nearby label or heading
    formLabel: 'Email'        // Associated form label
  },
  
  which: {
    position: 3,              // 3rd matching element (1-based!)
    testId: 'add-cart-btn',   // data-testid
    id: 'submit',             // HTML id (only if stable)
    name: 'email',            // name attribute
    ariaLabel: 'Submit form', // aria-label
    placeholder: 'Enter email',
    uniqueText: false         // Is text unique in context?
  },
  
  confirm: {
    boundingBox: { x, y, width, height },
    cssSelector: '.product-card:nth-child(3) button'
  }
}
```

### Why Recipe > CSS Selector
| CSS Selector | Recipe |
|--------------|--------|
| `.btn-primary:nth-child(3)` | `{ role: 'button', text: 'Add', position: 3 }` |
| Breaks when class changes | Works as long as it's a button with "Add" |
| Breaks when order changes | Position is relative to matching elements |
| No semantic meaning | Self-documenting |

---

## AI Fallback System

### How It Works
```javascript
async findElementWithAI(description, actionType) {
  // 1. Check budget
  if (this.aiCallsThisRun >= 5) return null;
  
  // 2. Take screenshot
  const screenshot = await page.screenshot({ type: 'png' });
  
  // 3. Call AI (backend or OpenAI direct)
  const response = await fetch('/api/ai/vision/find-element', {
    body: { screenshot_base64, description, action_type, viewport }
  });
  
  // 4. Return coordinates
  return { x: 450, y: 320, confidence: 0.92 };
}

// Usage in click
if (!elementFound) {
  const coords = await findElementWithAI('Add to Cart button', 'click');
  await page.mouse.click(coords.x, coords.y);
}
```

### Budget System
- **Max 5 AI calls per test run** (configurable)
- Prevents runaway API costs
- Counter resets at start of each test

---

## Multi-Tab and Cross-Origin Handling

### Supported Tab Operations
| Action Type | Recording | Playback | Notes |
|-------------|-----------|----------|-------|
| `newTab` | ✅ Auto-detected | ✅ Waits for tab | Via `context.on('page')` |
| `switchTab` | ✅ Focus detection | ✅ By index/URL | 1.5s debounce |
| `closeTab` | ✅ Auto-detected | ✅ Returns to parent | Via `page.on('close')` |
| `crossOriginPlaceholder` | ✅ Auto-detected | ✅ Manual selectors | For external domains |

### Modal/Popup Window Support
| Action Type | Recording | Playback | Notes |
|-------------|-----------|----------|-------|
| `closeModal` | ✅ Close button click | ✅ Multi-strategy | Radix Dialog, Material, etc. |
| `closeModal` | ✅ Backdrop click | ✅ Backdrop click | Click outside to dismiss |
| `press Escape` | ✅ Escape in modal | ✅ Key press | For modal dismissal |

**Close Modal Playback Strategies** (in order):
1. Find close button by aria-label (close/dismiss)
2. Find Radix `[data-radix-dialog-close]` button
3. Find `.close` or `[data-dismiss]` buttons
4. Find button with text "Close", "Cancel", "×", "X"
5. Press Escape key
6. Click backdrop/overlay

### Cross-Origin Limitations
**Browser security prevents direct access to cross-origin tabs.** When a test opens a tab to a different domain (e.g., OAuth login, payment gateway), QAAI cannot inject recorder scripts.

**Solution: Cross-Origin Placeholder Steps**
1. QAAI detects cross-origin navigation automatically
2. Records a `crossOriginPlaceholder` step
3. User can edit the step to define manual actions
4. During playback, QAAI executes user-defined selectors

### Manual Selector Types for Cross-Origin
```javascript
{
  action: 'click' | 'fill' | 'select',
  description: 'Human-readable description',
  selectorType: 'text' | 'css' | 'xpath' | 'testid' | 'coords',
  selector: 'button.submit' | '//button[@id="pay"]',
  text: 'Submit Payment',
  coords: { x: 450, y: 320 },
  value: 'Value for fill actions'
}
```

### Cross-Origin Playback Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ Step: crossOriginPlaceholder                                    │
│ URL: https://external-site.com/oauth                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────────────┐
    │ 1. Find and switch to cross-origin tab                      │
    │    - By URL match or hostname                               │
    │    - Falls back to latest tab                               │
    └────────────────────────┬────────────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────────────┐
    │ 2. Execute user-defined actions                             │
    │    - CSS selector → page.locator(selector)                  │
    │    - XPath → page.locator('xpath=' + selector)              │
    │    - Text → page.getByText(text)                            │
    │    - Coords → page.mouse.click(x, y)                        │
    │    - AI Fallback if enabled                                 │
    └────────────────────────┬────────────────────────────────────┘
                             │
    ┌────────────────────────▼────────────────────────────────────┐
    │ 3. Close cross-origin tab and return to parent              │
    │    - Explicitly closes external tab                         │
    │    - Switches back to tab 0 (parent)                        │
    │    - Re-initializes SmartFinder for parent page             │
    └─────────────────────────────────────────────────────────────┘
```

### iFrame Handling
| Operation | Method | Notes |
|-----------|--------|-------|
| Click in iframe | `frameLocator` search | Tries testId, button text, text content |
| Fill in iframe | `frameLocator` search | Tries testId, id, placeholder, name |
| Switch to frame | `switchToFrame` action | By selector, name, or index |
| Return to main | `switchToMainFrame` | Clears frame context |

### Fresh Browser Mode
For state-sensitive tests, use "Fresh Run" to start with a clean browser:
```javascript
// In PlaywrightRecorder.runTest()
if (options.freshBrowser) {
  // Launches new browser without persistent storage
  // No cookies, localStorage, or session data
}
```

---

## Framework Support

### Built-In Mappings
| Framework | Special Handling |
|-----------|------------------|
| Salesforce Lightning | Shadow DOM, `lightning-*` components |
| SAP Fiori | `sap-*` attributes, custom controls |
| Radix UI | Click-then-select for dropdowns |
| Shadcn/UI | Same as Radix (built on Radix) |
| Headless UI | Non-native select handling |
| Chakra UI | Dynamic ID filtering |
| Material UI | Dynamic class filtering |

### Shadow DOM Handling
```javascript
// Recording: composedPath() pierces Shadow DOM
const path = event.composedPath();
const actualElement = path[0]; // Gets element inside shadow

// Playback: Playwright's >> syntax
page.locator('my-component >> button');
```

---

## Key Files Reference

### Recording Files
| File | Lines | Purpose |
|------|-------|---------|
| `playwright-recorder.js` | ~10000 | Main recorder, playback, overlays |
| `recorder-engine.js` | ~2000 | Shared engine (injected in page) |
| `element-recipe.js` | ~400 | Recipe model, element analyzer |
| `recipe-recorder-integration.js` | ~500 | Legacy ↔ Recipe conversion |

### Playback Files
| File | Lines | Purpose |
|------|-------|---------|
| `playwright-recorder.js` | - | `executeAction()`, `runTest()` |
| `smart-finder.js` | ~600 | 8-phase element finding |
| `test-executor.js` | ~3500 | Alternative executor (backend API) |

### AI Files
| File | Lines | Purpose |
|------|-------|---------|
| `ai-explorer-agent.js` | ~1000 | Autonomous page exploration |
| `ai-goal-agent.js` | ~700 | Goal-directed automation |

### Refactored Handler Modules (Jan 2026)
| File | Lines | Purpose |
|------|-------|---------|
| `action-handlers.js` | ~600 | Click, fill, select, drag, download handlers |
| `tab-manager.js` | ~450 | Multi-tab/window/cross-origin handling |
| `salesforce-handlers.js` | ~400 | Salesforce-specific actions (sf_*, REST API) |

---

## Configuration Options

### PlaywrightRecorder
```javascript
new PlaywrightRecorder({
  // Recipe system (robust element finding)
  useRecipeRecorder: true,         // Default: true
  useSmartFinderForPlayback: true, // Default: true
  
  // AI fallback
  enableAIFallback: true,          // Default: true
  maxAICallsPerRun: 5,             // Budget per test
  
  // Timeouts
  timeout: 30000,                  // Action timeout
});
```

### SmartFinder
```javascript
new SmartFinder(page, {
  debug: true,      // Log attempts
  timeout: 15000,   // Element wait timeout
});
```

---

## Troubleshooting Guide

### Problem: Tab clicking fails (e.g., "Tables" not found)
**Cause**: Radix UI tabs have accessibility name "Table" but visual text "Tables"
**Solution**: SmartFinder now tries singular text for tabs (strips trailing 's')
**Files**: `smart-finder.js` - `role+text-singular` strategy

### Problem: Radix dropdown not recording
**Cause**: Radix uses `pointerdown` event, not `click`
**Solution**: Added pointerdown handler in recipe-recorder-integration.js
**Files**: `recipe-recorder-integration.js` - pointerdown handler sets pendingTrigger

### Problem: Wrong "Add to Cart" button clicked (duplicates)
**Cause**: `getPositionAmongSiblings()` only checked immediate siblings
**Solution**: Added `getGlobalPosition()` for same-text elements across page
**Files**: `element-recipe.js` - getGlobalPosition()

### Problem: SmartFinder can't find element by role
**Cause**: Action object missing element/selectorObj during playback
**Solution**: Pass full step data to action object in runTest()
**Files**: `playwright-recorder.js` - action construction (2 locations)

### Problem: "Target page, context or browser has been closed"
**Cause**: Test started before page fully loaded
**Solution**: Added `waitForLoadState('networkidle')` + page validity checks
**Files**: `playwright-recorder.js` - page stability wait

### Problem: SmartFinder searches for "Click 'Tables'" instead of "Tables"
**Cause**: legacyActionToRecipe used full label as search text
**Solution**: Added extractTextFromLabel() to parse element text from descriptions
**Files**: `recipe-recorder-integration.js` - extractTextFromLabel()

### Problem: Custom dropdown not selecting option
**Cause**: Using `selectOption()` on non-native select
**Solution**: We detect native vs custom and use click-then-select for custom

### Problem: Test fails on slow page load
**Cause**: Element not visible yet when tried to click
**Solution**: Retry with exponential backoff (3 attempts)

### Problem: Element inside Shadow DOM not found
**Cause**: Regular selectors can't pierce Shadow DOM
**Solution**: `composedPath()` for recording, Playwright `>>` for playback

### Problem: AI fallback not working
**Cause**: Backend not running or no API key
**Solution**: Set `OPENAI_API_KEY` env var, or start backend on port 8000

### Problem: Cross-origin tab actions not recorded
**Cause**: Browser security prevents script injection into different-origin tabs
**Solution**: QAAI creates `crossOriginPlaceholder` steps that can be edited with manual selectors
**Files**: `tab-manager.js` - handleCrossOrigin(), `PlaywrightRecorderPage.tsx` - CrossOriginEditor

### Problem: Fill/Click fails in iframe
**Cause**: Element search not scoped to iframes by default
**Solution**: Added iframe fallback search using testId, id, placeholder, name strategies
**Files**: `action-handlers.js` - searchIframesForFill(), searchIframesForClick()

### Problem: Download step timing out
**Cause**: Download was already triggered by previous click action
**Solution**: Download handler now waits only 3s if no trigger selector, passes by default
**Files**: `action-handlers.js` - handleDownload()

### Problem: Tab switch spam during recording
**Cause**: Focus detection too aggressive (no debounce)
**Solution**: Added 1.5s debounce and focus confirmation before recording switchTab
**Files**: `tab-manager.js` - setupTabFocusDetection()

### Problem: State pollution between test runs
**Cause**: Persistent browser context saves cookies/localStorage
**Solution**: Use "Fresh Run" to launch clean browser without persistent storage
**Files**: `playwright-recorder.js` - freshBrowser option in runTest()

### See Also
For detailed post-mortem on January 2026 fixes, see:
`docs/RECORDING-PLAYBACK-BUGFIXES-2026-01-15.md`

---

## Quick Start for AI Assistants

When working on QAAI recording/playback issues:

1. **Check which executor is being used**:
   - Desktop app → `PlaywrightRecorder` in `playwright-recorder.js`
   - Backend API → `TestExecutor` in `test-executor.js`

2. **Check if SmartFinder is enabled**:
   - Look for `useSmartFinderForPlayback` (should be `true`)
   - Look for `useRecipeRecorder` (should be `true`)

3. **For element finding issues**:
   - Start at `_findElement()` or `SmartFinder.find()`
   - Check if `elementIndex` is being passed and used

4. **For custom UI components**:
   - Check `smart-finder.js` for framework mappings
   - May need to add new patterns for unsupported frameworks

5. **For AI fallback issues**:
   - Check `enableAIFallback` flag
   - Check `aiCallsThisRun` vs `maxAICallsPerRun`
   - Check backend `/api/ai/vision/find-element` endpoint

---

## AI Goal Agent (v3.0)

The AI Goal Agent enables natural language test creation without manual recording.

### Architecture: Plan-First, Execute-Fast
```
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ANALYZE                                                     │
│ analyzePageDeep() → Products, Buttons, Dropdowns, Cart, Modals       │
│ [Local Playwright scan - NO API call]                                │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 2: PLAN                                                        │
│ createActionPlan() → GPT-4o creates ordered action sequence          │
│ [SINGLE API call for entire goal]                                    │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 3: EXECUTE                                                     │
│ executeSmartAction() → Playwright executes each planned action       │
│ [NO API calls - fast local execution]                                │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PHASE 4: RECORD                                                      │
│ generateTestCase() → Creates playback-compatible test steps          │
│ [Includes elementIndex, testId, recipe for SmartFinder]              │
└──────────────────────────────────────────────────────────────────────┘
```

### Smart Execution Strategies
| Action Type | Strategy | Handles |
|------------|----------|---------|
| Add to Cart | Product card detection → specific Add button | Multiple products |
| Remove from Cart | Cart item detection → specific Remove button | Cart management |
| Tab Navigation | Role-based and text matching | Radix tabs |
| Dropdown Select | Radix combobox detection → option finding | Complex dropdowns |
| Fill Form | Label/placeholder/testId matching | Various inputs |

### Memory State Tracking
```javascript
this.memory = {
  visitedPages: ['products', 'cart'],
  addedToCart: ['iPhone 15 Pro', 'MacBook Pro'],
  removedFromCart: ['AirPods'],
  filledFields: { email: 'test@example.com' },
  cartCount: 2
};
```

### Key Differences from Manual Recording
| Aspect | Manual Recording | Goal Agent |
|--------|-----------------|------------|
| Element Finding | User clicks exact element | Agent finds by product name |
| Duplicate Handling | Automatic index tracking | Memory-based index tracking |
| Recipe Data | Full recipe captured | Inferred from execution |
| Playback Reliability | High (exact recipe) | High (product-specific targets) |

### Example Goal & Execution
```
Goal: "Add 3 different phones to cart, remove the cheapest one, apply promo SAVE10"

Generated Plan:
1. click "Products" tab
2. click "Add to Cart for iPhone 15 Pro" 
3. click "Add to Cart for Samsung Galaxy S24"
4. click "Add to Cart for Google Pixel 8"
5. click "Cart" tab
6. click "Remove for Google Pixel 8"
7. fill "Promo Code" with "SAVE10"
8. click "Apply"

Execution Result:
- Each product added via product-card strategy
- Element indexes: 0, 1, 2
- Remove via cart-item detection
- Promo filled via input detection
```

---

## Version History

| Date | Changes |
|------|---------|
| Jan 16, 2026 | **AI Goal Agent v3.1** - Product-specific recording for correct playback |
| Jan 16, 2026 | Goal Agent smartClick now returns actualTarget (product name) |
| Jan 16, 2026 | Step recording uses actual product names, not generic "Add to Cart" |
| Jan 16, 2026 | Element indexes tracked correctly via memory.addedToCart.length |
| Jan 16, 2026 | Removed recorder overhead for cart actions (faster execution) |
| Jan 16, 2026 | **AI Goal Agent v3.0** - Plan-first agentic architecture |
| Jan 16, 2026 | Fixed Goal Agent IPC channels in preload (events weren't whitelisted) |
| Jan 16, 2026 | Fixed Goal Agent event handler signature in frontend |
| Jan 16, 2026 | Added auto-launch browser for Goal Agent when no session active |
| Jan 16, 2026 | Added extensive debugging logs for Goal Agent execution |
| Jan 16, 2026 | Fixed AIFlowExplorer light/dark mode contrast issues |
| Jan 15, 2026 | **Major Refactoring** - Extracted handlers into modules |
| Jan 15, 2026 | Added cross-origin tab handling with manual selectors |
| Jan 15, 2026 | Added multi-tab/window recording and playback |
| Jan 15, 2026 | Added Fresh Browser mode for clean test runs |
| Jan 15, 2026 | Added iframe search fallback for click/fill actions |
| Jan 15, 2026 | Fixed download step handling (trigger vs already-triggered) |
| Jan 15, 2026 | Fixed tab focus detection with debouncing |
| Jan 15, 2026 | Added cross-origin placeholder UI in recorder |
| Jan 2026 | Added AI fallback to PlaywrightRecorder |
| Jan 2026 | Added retry with exponential backoff |
| Jan 2026 | Fixed elementIndex for duplicate elements |
| Jan 2026 | Added custom dropdown support (Radix, Headless UI) |
| Jan 2026 | Enabled SmartFinder and Recipe system by default |

---

## How to Share This Document

**In future conversations, you can say:**

> "Please read the file `C:\QAAI\docs\QAAI-CAPABILITIES-REFERENCE.md` to understand our recording and playback system."

Or simply:

> "Check the QAAI capabilities reference doc in the docs folder."

This document contains everything needed to understand and work on the system.
