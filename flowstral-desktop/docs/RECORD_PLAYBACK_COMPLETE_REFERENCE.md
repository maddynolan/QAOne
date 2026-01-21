# QAAI Record & Playback Complete Reference

**Version**: 2.1.0  
**Last Updated**: January 21, 2026  
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Recording System](#recording-system)
3. [Playback System](#playback-system)
4. [Supported Elements](#supported-elements)
5. [Web Component Frameworks](#web-component-frameworks)
6. [Element Finding Strategies](#element-finding-strategies)
7. [Action Types](#action-types)
8. [Deduplication & Filtering](#deduplication--filtering)
9. [Edge Cases & Fixes](#edge-cases--fixes)
10. [Configuration Options](#configuration-options)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Dual Recording System

QAAI uses a **dual recording approach** for maximum robustness:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECORDING LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   RECIPE RECORDER   │    │    CDP RECORDER     │             │
│  │   (DOM Events)      │    │   (Browser Level)   │             │
│  │                     │    │                     │             │
│  │  • Semantic capture │    │  • Shadow DOM       │             │
│  │  • Role + Text      │    │  • Cross-origin     │             │
│  │  • Landmark context │    │  • Low-level events │             │
│  │  • Action coalescing│    │  • Coordinates      │             │
│  └──────────┬──────────┘    └──────────┬──────────┘             │
│             │                          │                         │
│             └──────────┬───────────────┘                         │
│                        ▼                                         │
│             ┌─────────────────────┐                              │
│             │   DEDUPLICATION     │                              │
│             │   Cross-system      │                              │
│             │   50ms windows      │                              │
│             │   Text normalization│                              │
│             └──────────┬──────────┘                              │
│                        ▼                                         │
│             ┌─────────────────────┐                              │
│             │   ACTIONS ARRAY     │                              │
│             │   Unified format    │                              │
│             └─────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### Playback Fallback Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAYBACK LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LAYER 1: SmartFinder (10 phases)              ~85% success  ││
│  │   testId → role+text → aria-label → name → id → CSS → ...  ││
│  └─────────────────────────────────────────────────────────────┘│
│                        ▼ (if fails)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LAYER 2: Legacy _findElement (50+ strategies)  +5% = 90%    ││
│  │   Comprehensive selector fallbacks                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                        ▼ (if fails)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LAYER 3: iFrame Search                         +2% = 92%    ││
│  │   Search all iframes for element                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                        ▼ (if fails)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LAYER 4: AI Vision Fallback (Optional)         +4% = 96%    ││
│  │   Screenshot + GPT-4o coordinate detection                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                        ▼ (if fails)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LAYER 5: Coordinate Fallback                   +2% = 98%    ││
│  │   Use recorded bounding box center                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recording System

### File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `playwright-recorder.js` | Main orchestrator | ~11,000 |
| `lib/recipe-recorder-integration.js` | Recipe-based recording | ~1,300 |
| `lib/element-recipe.js` | Element analysis | ~900 |
| `lib/action-coalescer.js` | Dropdown coalescing | ~500 |

### Events Captured

#### Click Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `click` | DOM + CDP | Standard clicks |
| `pointerdown` | DOM | Radix dropdowns (use pointerdown, not click) |
| `dblclick` | DOM | Double-click actions |
| `contextmenu` | DOM | Right-click actions |

#### Input Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `input` | DOM | Text input (debounced 1.5s) |
| `change` | DOM | Select, checkbox, radio, file |
| `blur` | DOM | Flush pending input |

#### Keyboard Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `keydown` | DOM | Enter (submit), Escape (close modal) |

#### Mouse Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `mouseenter` | DOM | Hover (for flyout menus, 200ms debounce) |
| `dragstart` | DOM | Drag start |
| `drop` | DOM | Drop target |
| `dragend` | DOM | Drag cancelled |

#### Scroll Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `scroll` | Window | Significant scrolls (>300px, debounced) |

#### Navigation Events

| Event | Handler | Use Case |
|-------|---------|----------|
| `framenavigated` | Playwright | Page navigation (filtered) |

### Recipe Format (ElementRecipe)

Every recorded element is stored as a "Recipe" - a semantic description:

```javascript
{
  what: {                    // WHAT the element IS
    role: 'button',          // ARIA role
    text: 'Submit',          // Visible text
    tag: 'button',           // HTML tag
    type: 'submit'           // Input type (if applicable)
  },
  where: {                   // WHERE the element is located
    landmark: 'form',        // Nearest landmark (main, nav, form, dialog)
    within: 'toolbar',       // Parent with role (tablist, menu, listbox)
    nearText: 'Contact Info' // Nearby label or heading
  },
  which: {                   // WHICH one (disambiguation)
    testId: 'submit-btn',    // data-testid
    id: 'contact-submit',    // HTML id (if stable)
    name: 'submit',          // name attribute
    ariaLabel: 'Submit form',// aria-label
    placeholder: null,       // placeholder text
    position: 2,             // Position among similar siblings (1-based)
    totalMatching: 3,        // Total matching elements
    uniqueText: false        // Is text unique in context?
  },
  confirm: {                 // CONFIRMATION data
    boundingBox: { x, y, width, height },
    cssSelector: 'form > button:nth-child(3)',
    href: '/submit'          // For links
  }
}
```

---

## Playback System

### File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `lib/smart-finder.js` | 10-phase element finding | ~1,400 |
| `lib/action-handlers.js` | Unified action execution | ~1,300 |
| `lib/ai-fallback.js` | AI vision fallback | ~220 |

### SmartFinder Phases

| Phase | Strategy | Description |
|-------|----------|-------------|
| 0 | `testId` | `data-testid` attribute (most reliable) |
| 1 | `scope` | Narrow search to landmark/within container |
| 2 | `role+text` | Playwright `getByRole(role, { name: text })` |
| 2a | `role+text-apostrophe-flex` | Flexible apostrophe matching |
| 2b | `role+text-singular` | Try singular form (for Radix tabs) |
| 2c | `role+text-regex` | Regex matching |
| 2d | `role-alt` | Try alternative roles (button↔link) |
| 3 | `text-exact` | Exact text match |
| 3a | `text-apostrophe-flex` | Flexible text with apostrophe variants |
| 3b | `label` | `getByLabel()` for form elements |
| 4 | `aria-label` | Exact, contains, and flexible |
| 5 | `name` | name attribute |
| 6 | `id` | HTML id (if not dynamic) |
| 7 | `href` | Link href matching |
| 8 | `css-fallback` | Recorded CSS selector |
| 9 | `text-variation` | Stripped text (remove counters, badges) |
| 9a | `keyword-extract` | Key phrases from text |
| 10 | `shadow-dom` | Pierce selector for Shadow DOM |
| 11 | `coordinates` | Bounding box center fallback |

### Text Normalization

All text is normalized before matching:

```javascript
normalizeText(text) {
  return text
    // Apostrophe variants → straight apostrophe
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'")
    // Quote variants → straight quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Dynamic Text Stripping

For flexible matching, dynamic content is stripped:

```javascript
stripDynamicContent(text) {
  return text
    .replace(/\s*\(\s*\d+\s*\)\s*$/, '')      // "(5)" counters
    .replace(/\s*\[\s*\d+\s*\]\s*$/, '')      // "[5]" counters
    .replace(/\s*-\s*\d+\s*$/, '')            // "- 5" counters
    .replace(/^(new|updated|active)\s+/i, '') // Badges
    .replace(/\s*\d+\s*(min|hour)s?\s*ago/i, '') // Time ago
    .trim();
}
```

---

## Supported Elements

### Standard HTML Elements

| Element | Role | Recording | Playback | Notes |
|---------|------|-----------|----------|-------|
| `<button>` | button | ✅ Click | ✅ | Full support |
| `<a>` | link | ✅ Click | ✅ | href stored for fallback |
| `<input type="text">` | textbox | ✅ Fill | ✅ | Debounced input |
| `<input type="email">` | textbox | ✅ Fill | ✅ | |
| `<input type="password">` | textbox | ✅ Fill | ✅ | Value masked in UI |
| `<input type="search">` | searchbox | ✅ Fill | ✅ | |
| `<input type="tel">` | textbox | ✅ Fill | ✅ | |
| `<input type="url">` | textbox | ✅ Fill | ✅ | |
| `<input type="number">` | spinbutton | ✅ Fill | ✅ | |
| `<input type="checkbox">` | checkbox | ✅ Check/Uncheck | ✅ | |
| `<input type="radio">` | radio | ✅ Click | ✅ | |
| `<input type="submit">` | button | ✅ Click | ✅ | |
| `<input type="button">` | button | ✅ Click | ✅ | |
| `<input type="file">` | button | ✅ Upload | ✅ | setInputFiles() |
| `<input type="range">` | slider | ✅ | ⚠️ | Needs dedicated handler |
| `<input type="date">` | textbox | ✅ Fill | ✅ | Native picker not triggered |
| `<input type="time">` | textbox | ✅ Fill | ✅ | |
| `<input type="color">` | button | ✅ Click | ⚠️ | Color picker limited |
| `<textarea>` | textbox | ✅ Fill | ✅ | |
| `<select>` | combobox | ✅ Select | ✅ | Native select |
| `<option>` | option | ✅ | ✅ | |
| `<table>` | table | ✅ | ✅ | |
| `<tr>` | row | ✅ | ✅ | |
| `<th>` | columnheader | ✅ Click | ✅ | Sortable headers |
| `<td>` | cell | ✅ Click | ✅ | Clickable cells |
| `<nav>` | navigation | ✅ Scope | ✅ | Landmark |
| `<main>` | main | ✅ Scope | ✅ | Landmark |
| `<header>` | banner | ✅ Scope | ✅ | Landmark |
| `<footer>` | contentinfo | ✅ Scope | ✅ | Landmark |
| `<aside>` | complementary | ✅ Scope | ✅ | Landmark |
| `<section>` | region | ✅ Scope | ✅ | Landmark |
| `<article>` | article | ✅ Scope | ✅ | Landmark |
| `<form>` | form | ✅ Scope | ✅ | Landmark |
| `<dialog>` | dialog | ✅ Scope | ✅ | Modal handling |
| `<details>` | group | ✅ | ✅ | Accordion |
| `<summary>` | button | ✅ Click | ✅ | Accordion trigger |
| `<ul>/<ol>` | list | ✅ | ✅ | |
| `<li>` | listitem | ✅ Click | ✅ | |
| `<dl>` | list | ✅ | ✅ | Definition list |
| `<dt>` | term | ✅ | ✅ | |
| `<dd>` | definition | ✅ | ✅ | |
| `<menu>` | menu | ✅ | ✅ | |
| `<img>` | img | ✅ Click | ✅ | Clickable images |
| `<svg>` | img | ✅ Click | ✅ | When in button/link |
| `<canvas>` | - | ✅ Click | ⚠️ | Coordinate-based |
| `<video>` | - | ⚠️ | ⚠️ | Controls limited |
| `<audio>` | - | ⚠️ | ⚠️ | Controls limited |
| `<iframe>` | - | ✅ | ✅ | iframe search fallback |
| `<output>` | status | ✅ | ✅ | |
| `<meter>` | meter | ✅ | ✅ | |
| `<progress>` | progressbar | ✅ | ✅ | |
| `<h1>`-`<h6>` | heading | ✅ | ✅ | |
| `<area>` | link | ✅ Click | ✅ | Image maps |
| `<fieldset>` | group | ✅ Scope | ✅ | |

### Contenteditable Elements

| Type | Recording | Playback | Notes |
|------|-----------|----------|-------|
| `[contenteditable="true"]` | ✅ Fill | ✅ | click + keyboard.type |
| Quill Editor (`.ql-editor`) | ✅ Fill | ✅ | Detected automatically |
| ProseMirror (`.ProseMirror`) | ✅ Fill | ✅ | Detected automatically |
| TinyMCE (`.tox-edit-area`) | ✅ Fill | ✅ | Detected automatically |
| CKEditor (`.ck-editor__editable`) | ✅ Fill | ✅ | Detected automatically |

---

## Web Component Frameworks

### Salesforce Lightning (lightning-*)

| Component | Role | Support |
|-----------|------|---------|
| `lightning-button` | button | ✅ |
| `lightning-button-icon` | button | ✅ |
| `lightning-button-menu` | button | ✅ |
| `lightning-input` | textbox | ✅ |
| `lightning-combobox` | combobox | ✅ |
| `lightning-textarea` | textbox | ✅ |
| `lightning-checkbox` | checkbox | ✅ |
| `lightning-checkbox-group` | group | ✅ |
| `lightning-radio` | radio | ✅ |
| `lightning-radio-group` | radiogroup | ✅ |
| `lightning-select` | combobox | ✅ |
| `lightning-tab` | tab | ✅ |
| `lightning-tabset` | tablist | ✅ |
| `lightning-menu` | menu | ✅ |
| `lightning-menu-item` | menuitem | ✅ |
| `lightning-datatable` | table | ✅ |
| `lightning-tree` | tree | ✅ |
| `lightning-tree-item` | treeitem | ✅ |
| `lightning-modal` | dialog | ✅ |
| `lightning-card` | region | ✅ |
| `lightning-icon` | img | ✅ |
| `lightning-spinner` | status | ✅ |
| `lightning-badge` | status | ✅ |
| `lightning-progress-bar` | progressbar | ✅ |
| `lightning-slider` | slider | ✅ |

### SAP UI5 (ui5-*)

| Component | Role | Support |
|-----------|------|---------|
| `ui5-button` | button | ✅ |
| `ui5-input` | textbox | ✅ |
| `ui5-select` | combobox | ✅ |
| `ui5-option` | option | ✅ |
| `ui5-checkbox` | checkbox | ✅ |
| `ui5-radio-button` | radio | ✅ |
| `ui5-textarea` | textbox | ✅ |
| `ui5-table` | table | ✅ |
| `ui5-table-row` | row | ✅ |
| `ui5-table-cell` | cell | ✅ |
| `ui5-tab` | tab | ✅ |
| `ui5-tabcontainer` | tablist | ✅ |
| `ui5-dialog` | dialog | ✅ |
| `ui5-menu` | menu | ✅ |
| `ui5-menu-item` | menuitem | ✅ |
| `ui5-link` | link | ✅ |
| `ui5-icon` | img | ✅ |
| `ui5-switch` | switch | ✅ |
| `ui5-slider` | slider | ✅ |
| `ui5-progress-indicator` | progressbar | ✅ |
| `ui5-tree` | tree | ✅ |
| `ui5-tree-item` | treeitem | ✅ |

### Ionic (ion-*)

| Component | Role | Support |
|-----------|------|---------|
| `ion-button` | button | ✅ |
| `ion-input` | textbox | ✅ |
| `ion-textarea` | textbox | ✅ |
| `ion-select` | combobox | ✅ |
| `ion-select-option` | option | ✅ |
| `ion-checkbox` | checkbox | ✅ |
| `ion-radio` | radio | ✅ |
| `ion-radio-group` | radiogroup | ✅ |
| `ion-toggle` | switch | ✅ |
| `ion-range` | slider | ✅ |
| `ion-tab` | tab | ✅ |
| `ion-tabs` | tablist | ✅ |
| `ion-tab-button` | tab | ✅ |
| `ion-menu` | menu | ✅ |
| `ion-item` | listitem | ✅ |
| `ion-list` | list | ✅ |
| `ion-modal` | dialog | ✅ |
| `ion-alert` | alertdialog | ✅ |
| `ion-action-sheet` | dialog | ✅ |
| `ion-fab` | button | ✅ |
| `ion-fab-button` | button | ✅ |
| `ion-searchbar` | searchbox | ✅ |
| `ion-segment` | tablist | ✅ |
| `ion-segment-button` | tab | ✅ |
| `ion-card` | region | ✅ |
| `ion-accordion` | group | ✅ |
| `ion-accordion-group` | group | ✅ |

### Angular Material (mat-*)

| Component | Role | Support |
|-----------|------|---------|
| `mat-button` | button | ✅ |
| `mat-raised-button` | button | ✅ |
| `mat-icon-button` | button | ✅ |
| `mat-fab` | button | ✅ |
| `mat-mini-fab` | button | ✅ |
| `mat-form-field` | group | ✅ |
| `mat-input` | textbox | ✅ |
| `mat-select` | combobox | ✅ |
| `mat-option` | option | ✅ |
| `mat-checkbox` | checkbox | ✅ |
| `mat-radio-button` | radio | ✅ |
| `mat-radio-group` | radiogroup | ✅ |
| `mat-slide-toggle` | switch | ✅ |
| `mat-slider` | slider | ✅ |
| `mat-tab` | tab | ✅ |
| `mat-tab-group` | tablist | ✅ |
| `mat-menu` | menu | ✅ |
| `mat-menu-item` | menuitem | ✅ |
| `mat-dialog-container` | dialog | ✅ |
| `mat-list` | list | ✅ |
| `mat-list-item` | listitem | ✅ |
| `mat-nav-list` | navigation | ✅ |
| `mat-tree` | tree | ✅ |
| `mat-tree-node` | treeitem | ✅ |
| `mat-expansion-panel` | group | ✅ |
| `mat-accordion` | group | ✅ |
| `mat-stepper` | group | ✅ |
| `mat-step` | listitem | ✅ |
| `mat-chip` | button | ✅ |
| `mat-chip-list` | list | ✅ |
| `mat-autocomplete` | listbox | ✅ |
| `mat-datepicker` | dialog | ✅ |
| `mat-progress-bar` | progressbar | ✅ |
| `mat-progress-spinner` | progressbar | ✅ |
| `mat-snack-bar-container` | alert | ✅ |
| `mat-tooltip` | tooltip | ✅ |

### Material Design Components (mdc-*)

| Component | Role | Support |
|-----------|------|---------|
| `mdc-button` | button | ✅ |
| `mdc-fab` | button | ✅ |
| `mdc-icon-button` | button | ✅ |
| `mdc-textfield` | textbox | ✅ |
| `mdc-select` | combobox | ✅ |
| `mdc-checkbox` | checkbox | ✅ |
| `mdc-radio` | radio | ✅ |
| `mdc-switch` | switch | ✅ |
| `mdc-slider` | slider | ✅ |
| `mdc-tab` | tab | ✅ |
| `mdc-tab-bar` | tablist | ✅ |
| `mdc-menu` | menu | ✅ |
| `mdc-list` | list | ✅ |
| `mdc-list-item` | listitem | ✅ |
| `mdc-dialog` | dialog | ✅ |
| `mdc-snackbar` | alert | ✅ |

### Vaadin (vaadin-*)

| Component | Role | Support |
|-----------|------|---------|
| `vaadin-button` | button | ✅ |
| `vaadin-text-field` | textbox | ✅ |
| `vaadin-text-area` | textbox | ✅ |
| `vaadin-select` | combobox | ✅ |
| `vaadin-combo-box` | combobox | ✅ |
| `vaadin-checkbox` | checkbox | ✅ |
| `vaadin-radio-button` | radio | ✅ |
| `vaadin-radio-group` | radiogroup | ✅ |
| `vaadin-tab` | tab | ✅ |
| `vaadin-tabs` | tablist | ✅ |
| `vaadin-menu-bar` | menubar | ✅ |
| `vaadin-grid` | grid | ✅ |
| `vaadin-grid-column` | columnheader | ✅ |
| `vaadin-dialog` | dialog | ✅ |
| `vaadin-notification` | alert | ✅ |
| `vaadin-date-picker` | textbox | ✅ |
| `vaadin-time-picker` | textbox | ✅ |

### Microsoft FAST (fast-*)

| Component | Role | Support |
|-----------|------|---------|
| `fast-button` | button | ✅ |
| `fast-text-field` | textbox | ✅ |
| `fast-text-area` | textbox | ✅ |
| `fast-select` | combobox | ✅ |
| `fast-option` | option | ✅ |
| `fast-checkbox` | checkbox | ✅ |
| `fast-radio` | radio | ✅ |
| `fast-radio-group` | radiogroup | ✅ |
| `fast-switch` | switch | ✅ |
| `fast-slider` | slider | ✅ |
| `fast-tab` | tab | ✅ |
| `fast-tabs` | tablist | ✅ |
| `fast-tab-panel` | tabpanel | ✅ |
| `fast-menu` | menu | ✅ |
| `fast-menu-item` | menuitem | ✅ |
| `fast-dialog` | dialog | ✅ |
| `fast-accordion` | group | ✅ |
| `fast-accordion-item` | group | ✅ |
| `fast-tree-view` | tree | ✅ |
| `fast-tree-item` | treeitem | ✅ |

### IBM Carbon (cds-*)

| Component | Role | Support |
|-----------|------|---------|
| `cds-button` | button | ✅ |
| `cds-text-input` | textbox | ✅ |
| `cds-textarea` | textbox | ✅ |
| `cds-select` | combobox | ✅ |
| `cds-checkbox` | checkbox | ✅ |
| `cds-radio-button` | radio | ✅ |
| `cds-toggle` | switch | ✅ |
| `cds-slider` | slider | ✅ |
| `cds-tabs` | tablist | ✅ |
| `cds-tab` | tab | ✅ |
| `cds-modal` | dialog | ✅ |
| `cds-notification` | alert | ✅ |
| `cds-accordion` | group | ✅ |
| `cds-accordion-item` | group | ✅ |
| `cds-structured-list` | list | ✅ |
| `cds-structured-list-row` | row | ✅ |

### Shoelace (sl-*)

| Component | Role | Support |
|-----------|------|---------|
| `sl-button` | button | ✅ |
| `sl-input` | textbox | ✅ |
| `sl-select` | combobox | ✅ |
| `sl-option` | option | ✅ |
| `sl-checkbox` | checkbox | ✅ |
| `sl-radio` | radio | ✅ |
| `sl-radio-group` | radiogroup | ✅ |
| `sl-tab` | tab | ✅ |
| `sl-tab-group` | tablist | ✅ |
| `sl-tab-panel` | tabpanel | ✅ |
| `sl-dialog` | dialog | ✅ |
| `sl-drawer` | dialog | ✅ |
| `sl-menu` | menu | ✅ |
| `sl-menu-item` | menuitem | ✅ |
| `sl-switch` | switch | ✅ |
| `sl-textarea` | textbox | ✅ |
| `sl-tree` | tree | ✅ |
| `sl-tree-item` | treeitem | ✅ |

---

## Element Finding Strategies

### Role Equivalences

SmartFinder uses flexible role matching:

```javascript
roleEquivalences = {
  'button': ['button', 'input'],           // input[type=button/submit]
  'link': ['link', 'a'],
  'textbox': ['textbox', 'input', 'textarea'],
  'checkbox': ['checkbox', 'input'],
  'radio': ['radio', 'input'],
  'combobox': ['combobox', 'listbox', 'select'],
  'option': ['option', 'menuitem', 'li'],
  'menuitem': ['menuitem', 'option', 'li'],
  'tab': ['tab', 'button', 'a'],
  'slider': ['slider', 'input'],
  'switch': ['switch', 'checkbox', 'input'],
  'searchbox': ['searchbox', 'textbox', 'input'],
  'cell': ['cell', 'td', 'gridcell'],
  'row': ['row', 'tr'],
  'columnheader': ['columnheader', 'th'],
  'treeitem': ['treeitem', 'li', 'option'],
  'heading': ['heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
}
```

### Dynamic ID Patterns (Ignored)

These ID patterns are considered unstable and ignored:

```javascript
unstableIdPatterns = [
  /^:r[a-z0-9]+:?$/i,           // Radix: :r0:, :r1a:
  /^react-aria-?\d+/i,          // React Aria
  /^headlessui-/i,              // Headless UI
  /^radix-/i,                   // Radix
  /^mui-/i,                     // MUI
  /^chakra-/i,                  // Chakra UI
  /^mantine-/i,                 // Mantine
  /^aura\d+/i,                  // Salesforce Aura
  /^lwc-/i,                     // Lightning Web Components
  /^input-\d+$/i,               // Generic input-123
  /^[a-f0-9]{8,}$/i,            // UUID-like
  /^\d{6,}$/,                   // Pure numbers
]
```

### testId Attributes (Priority Order)

```javascript
testIdAttributes = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
  'data-automation-id',
  'data-target-selection-name', // Salesforce
  'data-refid',                 // Salesforce
  'stable-dom-ref',             // SAP
]
```

---

## Action Types

### Recorded Action Types

| Type | QWord | Description |
|------|-------|-------------|
| `click` | ClickText | Standard click |
| `dblclick` | DoubleClick | Double-click |
| `rightClick` | RightClick | Right-click (context menu) |
| `fill` | Fill | Text input |
| `select` | Select | Dropdown selection |
| `check` | Check | Checkbox check |
| `uncheck` | Uncheck | Checkbox uncheck |
| `hover` | Hover | Mouse hover |
| `press` | Press | Keyboard press |
| `scroll` | ScrollDown/Up | Page scroll |
| `upload` | Upload | File upload |
| `dragDrop` | DragDrop | Drag and drop |
| `navigate` | GoTo | URL navigation (filtered) |
| `closeModal` | CloseModal | Modal/dialog close |
| `dialog` | HandleDialog | Browser dialog |
| `download` | Download | File download |
| `switchTab` | SwitchTab | Tab switching |
| `newTab` | NewTab | New tab opened |

---

## Deduplication & Filtering

### Cross-System Deduplication

Recipe and CDP recordings are deduplicated:

```javascript
// Recipe records action:
→ Adds ID: recipe_${timestamp}_click_${text}
→ ALSO adds: cdp_${timestamp}_Click "${text}"  // Blocks CDP

// CDP checks both before recording
```

### Navigation Filtering

Navigations are suppressed when:

1. **Within 5 seconds of any interaction** (click/fill/select)
2. **Matching skip patterns**:
   - `/secur/`, `/sessionserver/`, `/identity/`
   - `/auth/`, `/oauth/`, `/sso/`
   - `/lightning/r/`, `/lightning/o/`, `/lightning/n/`
   - `filterName=`, `aura?`
3. **Same-domain Salesforce navigations**

### Click Deduplication

- 50ms timestamp windows
- Normalized text comparison
- Recipe-style ID blocking

---

## Edge Cases & Fixes

### Fixes Implemented (January 2026)

| Issue | Fix | File |
|-------|-----|------|
| Dynamic text ("Cart (5)") | `stripDynamicContent()` | smart-finder.js |
| Contenteditable editors | Dedicated fill handler | action-handlers.js |
| href fallback for links | Phase 7 href matching | smart-finder.js |
| Wrong element clicked (search input vs button) | Role validation + `_isLikelyWrongClickTarget()` | smart-finder.js |
| Navigation recorded before click | `_lastInteractionTimestamp` | playwright-recorder.js |
| Same-domain navigation spam | Extended skip patterns | playwright-recorder.js |
| Double-recording Recipe+CDP | Cross-system ID blocking | playwright-recorder.js |
| Scroll not recorded | Scroll event handler | recipe-recorder-integration.js |
| Web components not recognized | 100+ component mappings | element-recipe.js |

### Known Limitations

| Scenario | Status | Workaround |
|----------|--------|------------|
| Cross-origin iframes | ❌ Cannot fix | Browser security |
| Permission dialogs | ❌ Cannot automate | Manual intervention |
| Native date pickers | ⚠️ Limited | Fill text instead |
| Color pickers | ⚠️ Limited | Direct value set |
| Mobile gestures | ⚠️ Limited | Maestro for native apps |

---

## Configuration Options

### PlaywrightRecorder Options

```javascript
const recorder = new PlaywrightRecorder({
  // Recipe-based recording (recommended)
  useRecipeRecorder: true,        // Default: true
  
  // SmartFinder for playback
  useSmartFinderForPlayback: true, // Default: true
  
  // AI Vision Fallback
  enableAIFallback: true,         // Default: true
  maxAICallsPerRun: 5,            // Default: 5
  
  // Mobile testing
  mobileDevice: null,             // e.g., 'iPhone 15 Pro'
  mobileNetwork: null,            // e.g., '4G', 'Slow 3G'
});
```

### SmartFinder Options

```javascript
const finder = new SmartFinder(page, {
  timeout: 10000,    // Default: 10000ms
  debug: false,      // Default: false (enable for logs)
});
```

---

## Troubleshooting

### Debug Logging

Enable verbose logging:

```javascript
// SmartFinder
const finder = new SmartFinder(page, { debug: true });

// Look for these log patterns:
[SmartFinder] Trying strategy: role+text
[SmartFinder] Strategy role+text succeeded
[SmartFinder] Found element using stripped text: "Cart" (original: "Cart (5)")
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Element not found | Wrong landmark scope | Check `where.landmark` in recipe |
| Clicks wrong element | Multiple matches | Check `which.position` |
| Navigation recorded separately | Skip patterns missing | Check `_shouldRecordNavigation` |
| Double actions recorded | Deduplication failed | Check timestamps |
| Shadow DOM element not found | Pierce selector failed | Use `pierce/` locator |
| Contenteditable not filling | Wrong fill strategy | Check `isContentEditable` detection |

### Telemetry

SmartFinder stores failed attempts for debugging:

```javascript
// After a failed find:
console.log(finder.lastFailedAttempts);  // Array of tried strategies
console.log(finder.lastFailedRecipe);    // The recipe that failed
```

---

## Appendix: Complete File Structure

```
flowstral-desktop/src/main/
├── playwright-recorder.js      # Main orchestrator (11,000 lines)
│   ├── Recording initialization
│   ├── CDP click capture setup
│   ├── Event listeners (click, input, navigation)
│   ├── Deduplication logic
│   ├── Test execution
│   └── Navigation filtering
│
├── lib/
│   ├── smart-finder.js         # Element finding (1,400 lines)
│   │   ├── 11-phase find algorithm
│   │   ├── Role equivalences
│   │   ├── Text normalization
│   │   ├── Dynamic text stripping
│   │   ├── Shadow DOM support
│   │   └── Coordinate fallback
│   │
│   ├── action-handlers.js      # Action execution (1,300 lines)
│   │   ├── Unified executeAction()
│   │   ├── Click with 4-layer fallback
│   │   ├── Fill with contenteditable support
│   │   ├── Select with Radix support
│   │   ├── Scroll with delta/absolute
│   │   └── Modal close strategies
│   │
│   ├── element-recipe.js       # Recipe model (900 lines)
│   │   ├── TAG_TO_ROLE mappings
│   │   ├── INPUT_TYPE_TO_ROLE mappings
│   │   ├── CUSTOM_ELEMENT_ROLES (100+)
│   │   ├── getElementAnalyzerScript()
│   │   └── Text normalization
│   │
│   ├── recipe-recorder-integration.js # Recording (1,300 lines)
│   │   ├── Click/dblclick/rightClick handlers
│   │   ├── Input/change handlers
│   │   ├── Hover handler
│   │   ├── Scroll handler
│   │   ├── Drag/drop handlers
│   │   └── recipeActionToLegacy()
│   │
│   ├── action-coalescer.js     # Dropdown coalescing (500 lines)
│   │   ├── Trigger detection
│   │   ├── Option detection
│   │   └── Select action merging
│   │
│   ├── ai-fallback.js          # AI vision (220 lines)
│   │   ├── Screenshot capture
│   │   ├── GPT-4o coordinate detection
│   │   └── Coordinate-based clicking
│   │
│   └── recording-utils.js      # Utilities (220 lines)
│       └── Text normalization helpers
```

---

**Document Version**: 2.1.0  
**Generated**: January 21, 2026  
**QAAI Platform Version**: 2.0.0
