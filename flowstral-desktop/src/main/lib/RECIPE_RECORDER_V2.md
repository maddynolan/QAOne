# Recipe Recorder V2 - Architecture Documentation

## Overview

The Recipe Recorder V2 is a fundamental redesign of how Flowstral identifies and interacts with elements. Instead of storing CSS selectors or XPaths, it stores **human-centric element descriptions** called "Element Recipes".

## The Problem with Traditional Selectors

Traditional recorders store selectors like:
```
[data-testid="tab-cart"]
#button-123
.MuiButton-root:nth-child(2)
```

These break because:
1. **IDs change** - React, Angular, etc. generate dynamic IDs
2. **Classes change** - CSS refactoring breaks tests
3. **Position changes** - Adding/removing elements breaks nth-child
4. **Framework-specific** - What works for Radix doesn't work for Salesforce

## The Solution: Element Recipes

An Element Recipe describes HOW a human would identify an element:

```javascript
{
  what: {           // WHAT is it?
    role: "tab",
    text: "Cart",
    tag: "button"
  },
  where: {          // WHERE is it?
    landmark: "header",
    within: "tablist",
    nearText: "Products"
  },
  which: {          // WHICH ONE if multiple?
    position: 2,
    testId: "tab-cart",
    uniqueText: true
  }
}
```

This is framework-agnostic and self-healing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RECORDING FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User Action                                                               │
│       │                                                                     │
│       ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  element-recipe.js                                              │       │
│   │  ──────────────────                                             │       │
│   │  • getElementAnalyzerScript() - Injects analyzer into page      │       │
│   │  • Captures: role, text, landmarks, position, testId, etc.      │       │
│   │  • Filters: framework internals, dynamic IDs                    │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│       │                                                                     │
│       ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  action-coalescer.js                                            │       │
│   │  ────────────────────                                           │       │
│   │  • Detects dropdown patterns (trigger click + option click)     │       │
│   │  • Coalesces into single "select" action                        │       │
│   │  • Handles Radix, Headless UI, native selects                   │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│       │                                                                     │
│       ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  recipe-recorder-integration.js                                 │       │
│   │  ───────────────────────────────                                │       │
│   │  • getRecipeClickCaptureScript() - Combined capture script      │       │
│   │  • recipeActionToLegacy() - Convert to legacy format            │       │
│   │  • legacyActionToRecipe() - Convert legacy to recipe            │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLAYBACK FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Test Step                                                                 │
│       │                                                                     │
│       ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │  smart-finder.js - SmartFinder Class                            │       │
│   │  ───────────────────────────────────                            │       │
│   │  Phase 1: SCOPE - Narrow search area                            │       │
│   │           • Use `where.within` (tablist, menu, etc.)            │       │
│   │           • Use `where.landmark` (header, main, form)           │       │
│   │                                                                 │       │
│   │  Phase 2: QUERY - Find by semantic meaning                      │       │
│   │           • getByTestId() - if testId available (highest)       │       │
│   │           • getByRole() + name - semantic identification        │       │
│   │           • getByText() - text content                          │       │
│   │           • getByLabel() - form labels                          │       │
│   │                                                                 │       │
│   │  Phase 3: RESOLVE - Handle multiple matches                     │       │
│   │           • Use position if specified                           │       │
│   │           • Use testId to filter                                │       │
│   │           • Default to first visible                            │       │
│   │                                                                 │       │
│   │  Phase 4: FALLBACK - If all else fails                          │       │
│   │           • Try CSS selector from `confirm.cssSelector`         │       │
│   │           • Try relaxed text search                             │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `lib/element-recipe.js` | ElementRecipe model, Element Analyzer (page script), role inference |
| `lib/smart-finder.js` | SmartFinder class, ActionExecutor for playback |
| `lib/action-coalescer.js` | Detects and coalesces dropdown/select patterns |
| `lib/recipe-recorder-integration.js` | Integration with existing recorder, conversion utilities |

## Key Features

### 1. Role Inference
Maps HTML tags and custom elements to ARIA roles:
- `<button>` → `button`
- `lightning-combobox` → `combobox`
- `ui5-input` → `textbox`

### 2. Framework-Specific Attribute Mapping
Recognizes testing attributes across frameworks:
- `data-testid` (standard)
- `data-target-selection-name` (Salesforce)
- `stable-dom-ref` (SAP UI5)
- `data-cy` (Cypress convention)

### 3. Unstable ID Detection
Filters out dynamic IDs:
- `:r0:`, `:r1a:` (Radix)
- `react-aria-123` (React Aria)
- `headlessui-*` (Headless UI)
- `aura123`, `lwc-*` (Salesforce)

### 4. Action Coalescing
Detects dropdown interactions:
```
Click trigger → Click option  ==>  Select "Option" from "Dropdown"
```

### 5. Smart Finding Priority
1. `data-testid` (most reliable)
2. Role + accessible name
3. aria-label
4. Text content
5. Position among siblings
6. CSS selector (fallback)

## Usage

### Recording (Automatic)
The V2 recorder is enabled by default. It runs alongside the legacy recorder:

```javascript
// In playwright-recorder.js
this.useRecipeRecorder = true; // Default: enabled
```

### Playback
SmartFinder is used automatically for finding elements:

```javascript
// In test-executor.js
this.useSmartFinder = true; // Default: enabled

// Tries V2 first, falls back to legacy
const locator = await this.findElementV2(step);
```

### Manual Usage

```javascript
const { SmartFinder } = require('./lib/smart-finder');

const finder = new SmartFinder(page, { timeout: 10000, debug: true });

// Find element by recipe
const element = await finder.find({
  what: { role: 'tab', text: 'Cart' },
  where: { within: 'tablist' },
  which: { testId: 'tab-cart' }
});

// Handle dropdown selection
const combobox = await finder.findCombobox(recipe);
await combobox.trigger.click();
const option = await combobox.findOption('Express ($19.99)');
await option.click();
```

## Backward Compatibility

The V2 system maintains full backward compatibility:

1. **Existing tests work** - Legacy selectorObj is converted to recipe format
2. **New tests have recipes** - Stored in `step.recipe` field
3. **Gradual migration** - Can disable V2 via config:
   ```javascript
   new PlaywrightRecorder({ useRecipeRecorder: false });
   new TestExecutor({ useSmartFinder: false });
   ```

## Handling Different Frameworks

### Radix UI / Headless UI
- Portals detected via `[data-radix-portal]`, `[role="listbox"]`
- Action coalescer handles trigger + option clicks
- SmartFinder's `findCombobox()` method

### Salesforce Lightning
- Custom element role mapping (`lightning-*`)
- `data-target-selection-name` treated as testId
- Shadow DOM automatically handled by Playwright

### SAP UI5
- Custom element role mapping (`ui5-*`)
- `stable-dom-ref` treated as testId

### Generic Web Apps
- Standard ARIA roles and attributes
- `data-testid` is universal

## Debugging

Enable debug mode for detailed logs:

```javascript
const finder = new SmartFinder(page, { debug: true });
```

Logs show:
- Which strategies were tried
- Which succeeded/failed
- What the recipe contained

## Future Improvements

1. **Visual matching** - Use bounding box and screenshots for AI-assisted finding
2. **Learning** - Track which strategies succeed and prioritize them
3. **Self-healing reports** - Log when fallback strategies are used
4. **More adapters** - Add support for more enterprise apps as needed
