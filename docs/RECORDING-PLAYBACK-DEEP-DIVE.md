# Recording & Playback System - Complete Deep Dive

## Overview Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RECORDING PHASE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Click → Browser Event → Click Capture Script → Action Queue   │
│                                                                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ composedPath │ → │ Element Analyzer │ → │ ElementRecipe    │   │
│  │ (Shadow DOM) │    │ (Roles, Text)   │    │ (what/where/which)│   │
│  └──────────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         PLAYBACK PHASE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step JSON → SmartFinder → Locator → Click/Fill/Select             │
│                                                                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │ Recipe from  │ → │ 8-Phase Finding │ → │ Element Located  │   │
│  │ recorded step│    │ (Robust search) │    │ (action executed)│   │
│  └──────────────┘    └─────────────────┘    └──────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PART 1: RECORDING

### Entry Point
**File:** `playwright-recorder.js:650` - `start(url)`

```javascript
async start(url, options = {}) {
  // 1. Launch browser with persistent context (maintains login sessions)
  this.context = await chromium.launchPersistentContext(userDataDir, {...});
  
  // 2. Get or create page
  this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
  
  // 3. INJECT CLICK CAPTURE SCRIPT (this is the key!)
  await this.page.addInitScript(this._getClickCaptureScript());
  
  // 4. Navigate to URL
  await this.page.goto(url);
  
  // 5. Re-inject after page loads
  await this.page.evaluate(this._getClickCaptureScript());
  
  // 6. Setup CDP click capture (for Shadow DOM)
  await this._setupCDPClickCapture();
  
  // 7. Start polling for captured actions
  this._startPolling();
}
```

### Click Capture Script (Runs in Browser)
**File:** `playwright-recorder.js:794` - `_getClickCaptureScript()`

This script is **injected into every page** and captures clicks:

```javascript
window.addEventListener('click', function(e) {
  // Get composed path - THIS IS THE KEY FOR SHADOW DOM!
  // composedPath() returns array of all elements from target up to window
  // INCLUDING elements inside Shadow DOM boundaries
  const path = e.composedPath ? e.composedPath() : [target];
  
  // Find best interactive element from the path
  for (const el of path) {
    // Skip containers (html, body, form, etc.)
    if (tag === 'html' || tag === 'body') continue;
    
    // PRIORITY ORDER:
    // 1. Submit buttons (input[type="submit"])
    // 2. Buttons and links (<button>, <a>)
    // 3. Role-based elements (role="button", role="tab", etc.)
    // 4. Framework-specific (Salesforce, SAP, etc.)
    // 5. Elements with aria-label or title
  }
  
  // Extract element data
  const clickData = {
    text: element.innerText || element.value,
    tagName: element.tagName,
    role: element.getAttribute('role'),
    id: element.id,
    testId: element.getAttribute('data-testid'),
    ariaLabel: element.getAttribute('aria-label'),
    className: element.className,
    // ... 20+ attributes captured
  };
  
  // Push to global queue (polled by Node.js)
  window.__flowstralCDPClicks.push(clickData);
});
```

### V2 Recipe Recorder (Enhanced)
**File:** `recipe-recorder-integration.js:22` - `getRecipeClickCaptureScript()`

When `useRecipeRecorder = true`, also injects this script:

```javascript
document.addEventListener('click', function(e) {
  const path = e.composedPath ? e.composedPath() : [e.target];
  
  // Find best element
  const element = findBestElement(path);
  
  // ANALYZE element to create "recipe"
  const recipe = analyzer.analyze(element);
  
  // Recipe format:
  // {
  //   what: { role: 'button', text: 'Add to Cart', tag: 'button' },
  //   where: { within: 'tabpanel', nearText: 'MacBook Pro' },
  //   which: { position: 3, testId: 'add-cart-btn' },
  //   confirm: { cssSelector: '.product button' }
  // }
  
  window.__flowstralRecipeActions.push({
    type: 'click',
    target: recipe,
    description: 'Click "Add to Cart"',
    timestamp: Date.now()
  });
});
```

### Element Analyzer (Creates Recipe)
**File:** `element-recipe.js:211` - `getElementAnalyzerScript()`

Runs in browser context:

```javascript
analyzer.analyze = function(element) {
  return {
    what: {
      role: this.getRole(element),        // button, tab, link, textbox
      text: this.getVisibleText(element),  // "Add to Cart"
      tag: element.tagName.toLowerCase(),  // button
      type: element.type || null           // for inputs
    },
    where: {
      landmark: this.findNearestLandmark(element),  // main, nav, form
      within: this.findParentWithRole(element),     // tablist, menu
      nearText: this.findNearbyLabel(element)       // "MacBook Pro 14"
    },
    which: {
      position: this.getPositionAmongSiblings(element),  // 3 (3rd of 8)
      testId: this.getTestId(element),      // data-testid value
      id: element.id,                        // only if stable
      name: element.getAttribute('name'),
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      uniqueText: this.isTextUnique(element, text)
    },
    confirm: {
      boundingBox: element.getBoundingClientRect(),
      cssSelector: generateCssSelector(element)  // fallback
    }
  };
};
```

### Role Detection
**File:** `element-recipe.js:20-117`

Maps HTML/Custom elements to ARIA roles:

```javascript
// Standard HTML
const TAG_TO_ROLE = {
  button: 'button',
  a: 'link',
  select: 'combobox',
  textarea: 'textbox',
  // ...
};

// Salesforce Lightning
const CUSTOM_ELEMENT_ROLES = {
  'lightning-button': 'button',
  'lightning-input': 'textbox',
  'lightning-combobox': 'combobox',
  'lightning-tab': 'tab',
  // ...
};

// SAP UI5
const CUSTOM_ELEMENT_ROLES = {
  'ui5-button': 'button',
  'ui5-input': 'textbox',
  'ui5-select': 'combobox',
  // ...
};
```

### Polling for Actions
**File:** `playwright-recorder.js:1588` - `_startPolling()`

Every 100ms, checks the page for new actions:

```javascript
_startPolling() {
  this.pollInterval = setInterval(async () => {
    // Get clicks captured by injected script
    const clicks = await this.page.evaluate(() => {
      const c = window.__flowstralCDPClicks || [];
      window.__flowstralCDPClicks = [];  // Clear queue
      return c;
    });
    
    // Get inputs (with debouncing)
    const inputs = await this.page.evaluate(() => {
      return window.__flowstralCDPInputs || {};
    });
    
    // Process clicks
    for (const click of clicks) {
      this._processClick(click);
    }
    
    // Process inputs
    for (const [key, input] of Object.entries(inputs)) {
      this._processInput(input);
    }
  }, 100);
}
```

### Deduplication
**File:** `playwright-recorder.js:1700+`

When processing actions:

```javascript
_processClick(clickData) {
  // Generate unique ID for deduplication
  const actionId = `click:${clickData.text}:${clickData.timestamp}`;
  
  // Skip if already seen
  if (this.seenActionIds.has(actionId)) return;
  this.seenActionIds.add(actionId);
  
  // Build action object
  const action = {
    type: 'click',
    qword: clickData.text ? 'ClickText' : 'ClickElement',
    args: [clickData.text || clickData.tagName, clickData.elementIndex],
    description: `Click "${clickData.text}"`,
    timestamp: clickData.timestamp,
    selectorObj: { ... },
    element: { ... },
    recipe: clickData.recipe  // If V2 recorder enabled
  };
  
  // Add to actions list
  this._addAction(action);
}
```

---

## PART 2: PLAYBACK

### Entry Point
**File:** `playwright-recorder.js:1928` - `runTest()`

```javascript
async runTest({ url, steps, headless, timeout }) {
  // 1. Launch browser (or use existing)
  if (needsNewBrowser) {
    this.context = await chromium.launchPersistentContext(userDataDir, {...});
    this.page = await this.context.newPage();
  }
  
  // 2. Navigate to URL
  await this.page.goto(url);
  
  // 3. Execute each step
  for (const step of steps) {
    const result = await this.executeAction(step);
    if (!result.success) {
      // Step failed
      break;
    }
  }
}
```

### Execute Action
**File:** `playwright-recorder.js:4980+` - `executeAction()` case 'click'

```javascript
case 'click':
case 'clicktext':
case 'ClickText':
  // ═══════════════════════════════════════════════════════
  // ELEMENT FINDING - 3-TIER SYSTEM
  // ═══════════════════════════════════════════════════════
  
  let clickResult = null;
  
  // ════════════════════════════════════════
  // TIER 1: SmartFinder (Recipe-based)
  // Most robust, framework-agnostic
  // ════════════════════════════════════════
  if (this.useSmartFinderForPlayback) {
    try {
      // Initialize SmartFinder
      if (!this.smartFinder) {
        this.smartFinder = new SmartFinder(this.page, { timeout: 15000 });
      }
      
      // Wait for page stability
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(300);
      
      // Convert legacy action to recipe format
      const recipe = legacyActionToRecipe(action);
      
      // Find element using recipe
      const locator = await this.smartFinder.find(recipe);
      if (locator) {
        clickResult = { locator, strategy: { type: 'SmartFinder' } };
      }
    } catch (error) {
      // Fall through to Tier 2
    }
  }
  
  // ════════════════════════════════════════
  // TIER 2: _findElement (Legacy, 50+ strategies)
  // Exhaustive search with many fallbacks
  // ════════════════════════════════════════
  if (!clickResult) {
    clickResult = await this._findElement(action);
  }
  
  // ════════════════════════════════════════
  // TIER 3: AI Self-Healing (Future)
  // Use AI to find element when all else fails
  // ════════════════════════════════════════
  // if (!clickResult) {
  //   clickResult = await this._aiHealElement(recipe);
  // }
  
  if (!clickResult) {
    return { success: false, error: 'Element not found' };
  }
  
  // EXECUTE THE CLICK
  await clickResult.locator.click();
```

### SmartFinder - 8-Phase Element Finding
**File:** `smart-finder.js:40` - `find(recipe)`

```javascript
async find(recipe) {
  const { what, where, which, confirm } = recipe;
  const attempts = [];  // Track what we tried
  
  // ═══════════════════════════════════════
  // PHASE 0: testId (most stable)
  // ═══════════════════════════════════════
  if (which?.testId) {
    const locator = this.page.getByTestId(which.testId);
    if (await locator.count() > 0) return locator;
  }
  
  // ═══════════════════════════════════════
  // PHASE 1: SCOPE - Narrow search area
  // ═══════════════════════════════════════
  let scope = this.page;
  if (where?.within) {
    // Look inside specific container
    // e.g., within: 'tabpanel' → search inside [role="tabpanel"]
    scope = await this.tryScope(where.within);
  }
  
  // ═══════════════════════════════════════
  // PHASE 2: role + text (semantic)
  // ═══════════════════════════════════════
  if (what?.role && what?.text) {
    const locator = scope.getByRole(what.role, { name: what.text });
    const result = await this.resolveMultiple(locator, which);
    if (result.success) return result.locator;
  }
  
  // ═══════════════════════════════════════
  // PHASE 3: role + position
  // ═══════════════════════════════════════
  if (what?.role && which?.position) {
    const locator = scope.getByRole(what.role);
    const count = await locator.count();
    if (which.position <= count) {
      return locator.nth(which.position - 1);
    }
  }
  
  // ═══════════════════════════════════════
  // PHASE 4: text-exact
  // ═══════════════════════════════════════
  if (what?.text) {
    const locator = scope.getByText(what.text, { exact: true });
    if (await locator.count() > 0) return locator.first();
  }
  
  // ═══════════════════════════════════════
  // PHASE 5: aria-label
  // ═══════════════════════════════════════
  if (which?.ariaLabel) {
    const locator = scope.locator(`[aria-label="${which.ariaLabel}"]`);
    if (await locator.count() > 0) return locator.first();
  }
  
  // ═══════════════════════════════════════
  // PHASE 6: name attribute
  // ═══════════════════════════════════════
  if (which?.name) {
    const locator = scope.locator(`[name="${which.name}"]`);
    if (await locator.count() > 0) return locator.first();
  }
  
  // ═══════════════════════════════════════
  // PHASE 7: id
  // ═══════════════════════════════════════
  if (which?.id) {
    const locator = this.page.locator(`#${which.id}`);
    if (await locator.count() > 0) return locator.first();
  }
  
  // ═══════════════════════════════════════
  // PHASE 8: CSS fallback
  // ═══════════════════════════════════════
  if (confirm?.cssSelector) {
    const locator = this.page.locator(confirm.cssSelector);
    if (await locator.count() > 0) return locator.first();
  }
  
  // ═══════════════════════════════════════
  // FAILED
  // ═══════════════════════════════════════
  throw new Error(`Could not find element. Tried: ${attempts.join(', ')}`);
}
```

### _findElement - 50+ Strategy Fallback
**File:** `playwright-recorder.js:4380` - `_findElement(action)`

Priority order of strategies:

```javascript
async _findElement(action) {
  const strategies = [];
  
  // ═══════ HIGHEST PRIORITY: TEST IDs ═══════
  if (testId) {
    strategies.push({ type: 'testid-exact', value: `[data-testid="${testId}"]` });
    strategies.push({ type: 'testid-getby', value: `getByTestId:${testId}` });
    strategies.push({ type: 'testid-alt', value: `[data-test-id="${testId}"]` });
    strategies.push({ type: 'testid-cy', value: `[data-cy="${testId}"]` });
  }
  
  // ═══════ HIGH PRIORITY: NAME ═══════
  if (name) {
    strategies.push({ type: 'name-exact', value: `[name="${name}"]` });
    strategies.push({ type: 'name-button', value: `button[name="${name}"]` });
  }
  
  // ═══════ HIGH PRIORITY: ID ═══════
  if (id && !this._isDynamicId(id)) {
    strategies.push({ type: 'id-exact', value: `#${id}` });
  }
  
  // ═══════ HIGH PRIORITY: ARIA-LABEL ═══════
  if (ariaLabel) {
    strategies.push({ type: 'aria-exact', value: `[aria-label="${ariaLabel}"]` });
    strategies.push({ type: 'aria-getby', value: `getByLabel:${ariaLabel}` });
  }
  
  // ═══════ MEDIUM PRIORITY: ROLE + NAME ═══════
  if (role && label) {
    strategies.push({ type: 'role-name', value: `getByRole:${role}:${label}` });
  }
  
  // ═══════ FILL ACTIONS: INPUT-SPECIFIC ═══════
  if (isFillAction) {
    // Salesforce-specific
    strategies.push({ type: 'sf-username', value: `#username` });
    strategies.push({ type: 'sf-password', value: `#password` });
    
    // Playwright's shadow-piercing methods
    strategies.push({ type: 'getByLabel', value: `getByLabel:${label}` });
    strategies.push({ type: 'getByPlaceholder', value: `getByPlaceholder:${label}` });
    
    // Lightning components
    strategies.push({ type: 'lightning-input', value: `lightning-input[label="${label}"] input` });
  }
  
  // ═══════ CLICK ACTIONS: BUTTON-SPECIFIC ═══════
  if (!isFillAction) {
    // Playwright's shadow-piercing methods
    strategies.push({ type: 'getByRole-button', value: `getByRole:button:${label}` });
    strategies.push({ type: 'getByRole-link', value: `getByRole:link:${label}` });
    strategies.push({ type: 'getByRole-tab', value: `getByRole:tab:${label}` });
    strategies.push({ type: 'getByText', value: `getByText:${label}` });
    
    // Salesforce-specific
    strategies.push({ type: 'sf-app-launcher', value: `button[title="App Launcher"]` });
  }
  
  // ═══════ TRY EACH STRATEGY ═══════
  for (const strategy of strategies) {
    try {
      let locator;
      
      // Build locator based on strategy type
      if (strategy.value.startsWith('getByTestId:')) {
        locator = this.page.getByTestId(strategy.value.replace('getByTestId:', ''));
      } else if (strategy.value.startsWith('getByRole:')) {
        const [role, name] = strategy.value.replace('getByRole:', '').split(':');
        locator = this.page.getByRole(role, { name });
      } else {
        locator = this.page.locator(strategy.value);
      }
      
      // Apply element index (for duplicates)
      locator = getAtIndex(locator);
      
      // Check if found and visible
      const count = await locator.count();
      if (count > 0) {
        const isVisible = await locator.isVisible({ timeout: 5000 });
        if (isVisible) {
          return { locator, strategy };
        }
      }
    } catch (e) {
      // Try next strategy
    }
  }
  
  // ═══════ LAST RESORT: DEEP SHADOW DOM SEARCH ═══════
  return await this._deepShadowSearch(label);
}
```

### Element Index for Duplicates
**File:** `playwright-recorder.js:4391-4397`

When there are multiple matching elements (e.g., 8 "Add to Cart" buttons):

```javascript
// Extract element index from action.args[1]
// args = ['Add to Cart', 2]  →  elementIndex = 2 (click 3rd button)
const elementIndex = typeof action.args?.[1] === 'number' ? action.args[1] : 0;

// Helper to get element at specific index
const getAtIndex = (locator) => 
  elementIndex === 0 ? locator.first() : locator.nth(elementIndex);

// Example usage:
// locator = page.getByRole('button', { name: 'Add to Cart' })
// locator = getAtIndex(locator)  // Gets 3rd button if elementIndex=2
```

### Legacy to Recipe Conversion
**File:** `recipe-recorder-integration.js:401` - `legacyActionToRecipe()`

Converts old action format to new recipe format:

```javascript
function legacyActionToRecipe(legacyAction) {
  // If already has recipe, use it
  if (legacyAction.recipe) {
    return legacyAction.recipe;
  }
  
  // Build recipe from legacy fields
  return {
    what: {
      role: element.role || selectorObj.role,
      text: legacyAction.text || element.text,
      tag: element.tagName
    },
    where: {
      nearText: legacyAction.label || selectorObj.ariaLabel
    },
    which: {
      testId: element.testId || selectorObj.testId,
      id: element.id,
      name: element.name,
      ariaLabel: element.ariaLabel,
      placeholder: element.placeholder,
      // CRITICAL: position for duplicate elements
      position: typeof legacyAction.elementIndex === 'number' 
        ? legacyAction.elementIndex + 1 
        : null
    },
    confirm: {
      cssSelector: selectorObj.selector
    }
  };
}
```

---

## PART 3: KEY FILES REFERENCE

| File | Purpose | Lines |
|------|---------|-------|
| `playwright-recorder.js` | Main recorder & executor | 8000+ |
| `smart-finder.js` | 8-phase element finding | 600+ |
| `element-recipe.js` | Element analyzer & role inference | 640+ |
| `recipe-recorder-integration.js` | V2 recorder & format conversion | 445 |
| `action-coalescer.js` | Handles dropdown sequences | 460 |

---

## PART 4: FALLBACK HIERARCHY

```
RECORDING:
  1. composedPath() - W3C standard for Shadow DOM
  2. Element priority (buttons > roles > aria-label > fallbacks)
  3. V2 Recipe analyzer (richer data capture)

PLAYBACK:
  ┌─────────────────────────────────────────────────────────────┐
  │ TIER 1: SmartFinder (8 phases)                              │
  │   Phase 0: testId                                           │
  │   Phase 1: scope (within container)                         │
  │   Phase 2: role + text                                      │
  │   Phase 3: role + position                                  │
  │   Phase 4: text-exact                                       │
  │   Phase 5: aria-label                                       │
  │   Phase 6: name attribute                                   │
  │   Phase 7: id                                               │
  │   Phase 8: CSS fallback                                     │
  └─────────────────────┬───────────────────────────────────────┘
                        │ If all fail
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ TIER 2: _findElement (50+ strategies)                       │
  │   - testId variants                                         │
  │   - name attribute                                          │
  │   - id attribute                                            │
  │   - aria-label                                              │
  │   - role + name                                             │
  │   - Playwright's getBy* methods                             │
  │   - Framework-specific (Salesforce, SAP)                    │
  │   - CSS selectors                                           │
  │   - Text-based fallbacks                                    │
  └─────────────────────┬───────────────────────────────────────┘
                        │ If all fail
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ TIER 3: Deep Shadow DOM Search                              │
  │   - page.evaluate() to search all shadow roots              │
  │   - Finds elements by text/aria-label/title                 │
  │   - Returns CSS path including shadow boundaries            │
  └─────────────────────┬───────────────────────────────────────┘
                        │ If all fail
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ TIER 4: AI Self-Healing (FUTURE)                            │
  │   - Analyze page accessibility tree                         │
  │   - Use AI to find best match                               │
  │   - Update test with new selector                           │
  └─────────────────────────────────────────────────────────────┘
```

---

## PART 5: CONFIGURATION FLAGS

| Flag | Location | Default | Purpose |
|------|----------|---------|---------|
| `useRecipeRecorder` | constructor:51 | `true` | Enable V2 Recipe capture |
| `useSmartFinderForPlayback` | constructor:54 | `true` | Use SmartFinder in playback |
| `timeout` | `_findElement`:4381 | 5000ms | Element find timeout |
| `isVisible timeout` | line 4720 | 5000ms | Visibility check timeout |

---

## PART 6: DATA FLOW DIAGRAM

```
┌────────────────────────────────────────────────────────────────┐
│                        RECORDING                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User clicks "Add to Cart" (3rd of 8)                          │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Click Event (browser)                                    │   │
│  │   e.composedPath() = [button, div, section, ...]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Element Analyzer                                         │   │
│  │   - role: 'button'                                       │   │
│  │   - text: 'Add to Cart'                                  │   │
│  │   - position: 3 (among siblings)                         │   │
│  │   - within: 'tabpanel'                                   │   │
│  │   - nearText: 'AirPods Pro 2'                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Action Created:                                          │   │
│  │ {                                                        │   │
│  │   type: 'click',                                         │   │
│  │   qword: 'ClickText',                                    │   │
│  │   args: ['Add to Cart', 2],  // elementIndex = 2        │   │
│  │   description: 'Click "Add to Cart" (3rd of 8)',        │   │
│  │   recipe: {                                              │   │
│  │     what: { role: 'button', text: 'Add to Cart' },      │   │
│  │     which: { position: 3 }                               │   │
│  │   }                                                      │   │
│  │ }                                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  Saved to Test Case JSON                                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                        PLAYBACK                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Load step from JSON                                           │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ legacyActionToRecipe(action)                             │   │
│  │   → Creates recipe with position: 3                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SmartFinder.find(recipe)                                 │   │
│  │   Phase 2: getByRole('button', { name: 'Add to Cart' })  │   │
│  │   Found 8 matches                                        │   │
│  │   Phase 3: Use position → .nth(2)                        │   │
│  │   → Returns locator for 3rd button                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  locator.click()                                               │
│       │                                                         │
│       ▼                                                         │
│  ✅ Correct button clicked!                                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## PART 7: WHAT MAKES IT ROBUST

1. **Shadow DOM Support**: `composedPath()` pierces all shadow boundaries
2. **Recipe Format**: Captures "what the element IS", not just CSS
3. **Position Tracking**: `elementIndex` for duplicate elements
4. **Multi-Phase Finding**: 8 phases in SmartFinder, 50+ strategies in fallback
5. **Framework Awareness**: Salesforce, SAP, Radix role mappings
6. **Stable Identifier Priority**: testId > name > aria-label > CSS
7. **Visibility Checks**: Only clicks visible elements
8. **Page Stability Waits**: Waits for DOM to settle before finding
