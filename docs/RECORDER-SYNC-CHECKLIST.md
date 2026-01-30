# Recorder Sync: Desktop → Browser Extension Checklist

Use this with **docs/DEPLOYMENT-AND-PACKAGING-REFERENCE.md** (Part 2). Goal: make recording output from the extension match the desktop (same coalescing, same recipe/selector shape).

---

## Phase 1: Action coalescing (dropdown → single “Select X”)

- [ ] **Add** `flowstral-extension/src/lib/action-coalescer.js`
  - Copy logic from `flowstral-desktop/src/main/lib/action-coalescer.js`.
  - Remove Node `require`/`module.exports`; use IIFE or export for content script.
  - Keep: PATTERNS (dropdown, tab, accordion), `process(action)`, `flush()`.
- [ ] **Inject or run in content script**
  - Option A: Inject `getActionCoalescerScript()` (from recipe-recorder-integration) into page; page posts coalesced actions to content script.
  - Option B: Content script receives raw click/input; runs coalescer in content script; emits combined action when pattern completes.
- [ ] **Wire** into existing recorder flow (content.js / recorder-engine) so that after each raw action we call coalescer; if it returns non-null, emit that instead of the raw action(s).
- [ ] **Test** on a Radix/Select dropdown: expect one “Select 'X' from 'Y'” instead of “Click trigger” + “Click option”.

---

## Phase 2: Recipe / ElementRecipe (what/where/which)

- [ ] **Add** `flowstral-extension/src/lib/element-recipe.js`
  - Copy from `flowstral-desktop/src/main/lib/element-recipe.js` (or shared package).
  - Browser-safe: no `fs`/`path`; same data shape (what/where/which).
- [ ] **Add** recipe capture script
  - Either copy `getElementAnalyzerScript()` and `getRecipeClickCaptureScript()` from `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` into an extension script, or
  - Create a small `recipe-recorder-integration.js` in extension that injects the same script and listens for `__flowstralRecipeActions`.
- [ ] **Content script** should:
  - Inject recipe click capture on start recording (same as desktop).
  - On each recipe action, convert with `recipeActionToLegacy` if downstream still expects legacy shape; or emit both `recipe` and legacy.
- [ ] **Output** of extension recording must include `recipe: { what, where, which }` on actions so backend/desktop can use SmartFinder.
- [ ] **Test** on Salesforce/LWC or Radix: verify actions have `recipe` and selectors still work.

---

## Phase 3: Single source of truth (optional but recommended)

- [ ] **Decide:** shared npm package vs copy-from-extension.
  - Package: create `@flowstral/recorder-core` (or similar) with recorder-engine, action-coalescer, element-recipe, recipe-recorder-integration (browser-safe parts). Desktop and extension depend on it; build copies or bundles into each.
  - Copy: keep everything in `flowstral-extension/src/lib/`; desktop continues to read recorder-engine from extension path and add coalescer/recipe by copying those files into desktop (or require from a path).
- [ ] **Document** in ARCHITECTURE.md (both desktop and extension) which files are shared and where they live.

---

## Phase 4: Strategy memory (optional)

- [ ] **Extension:** Persist “last successful selector” per origin in `chrome.storage.local` (e.g. key by recipe fingerprint).
- [ ] **When generating selectors:** If we have a stored strategy for this element fingerprint, prefer it (same idea as desktop StrategyMemory).
- [ ] **Backend:** Optionally extension sends “selector X worked for step Y” so backend can learn; lower priority.

---

## Phase 5: Confidence alignment

- [ ] **Compare** confidence scale in extension (recorder-engine.js, content.js) with desktop `lib/confidence/`.
- [ ] **Align** so the same numeric range and meaning are used (e.g. 0–100, same thresholds for “low/medium/high”).
- [ ] **Docs:** Note in DEPLOYMENT-AND-PACKAGING-REFERENCE.md that confidence is aligned.

---

## Files to add or touch (extension)

| File | Action |
|------|--------|
| `src/lib/action-coalescer.js` | Add (browser-safe). |
| `src/lib/element-recipe.js` | Add (browser-safe). |
| `src/lib/recipe-recorder-integration.js` | Add thin layer: getRecipeClickCaptureScript, recipeActionToLegacy, legacyActionToRecipe. |
| `src/content/content.js` | Wire coalescer + recipe capture; emit recipe in actions. |
| `manifest.json` | If new scripts are injected, ensure they’re in `web_accessible_resources` or content_scripts as needed. |

---

## Don’t sync (by design)

- **SmartFinder / ActionHandlers:** Playback-only; desktop and backend use them. Extension doesn’t run Playwright; no need to port full execution.
- **Debug mode (pause/step/retry):** Desktop-only unless you add a “run test” flow in extension that calls backend.
- **Mobile emulation:** Desktop-only for now; optional later in extension via devtools-style emulation.
- **License/config:** Different (electron-store vs chrome.storage); keep as is.

---

## Verification

- Record the same flow in **desktop** and **extension** (e.g. login + dropdown select + submit).
- Compare exported JSON: same number of actions, same coalesced “Select” steps, same presence of `recipe` on click/select/fill.
- Run the same steps in desktop playback; both desktop-recorded and extension-recorded sessions should play back correctly.
