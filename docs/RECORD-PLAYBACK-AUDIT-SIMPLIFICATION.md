# Record & Playback — Full Audit & Simplification Opportunities

> **Purpose:** Deep-dive audit of Record & Playback flows. Use with `docs/RECORD-PLAYBACK-CORE-ARCHITECTURE.md`.  
> **Output:** List of simplification opportunities and “where to go from here” — **no implementation yet**.

**How to use this doc:**  
- **New to the codebase?** Start with **ELI5** and the **Visual** sections (flowcharts, two paths, “where duplication lives,” safe vs don’t touch).  
- **Need the full picture in one screen?** Jump to **Section 12 — One-Page Cheat Sheet**.  
- **Deciding what to condense?** Use **Section 7 (comparison table)** and **Section 8 (safe vs risky)**.  
- **Thinking impact and UX?** See **`docs/RECORD-PLAYBACK-IMPACT-AND-UX-BRAINSTORM.md`** — full testing lifecycle, day-in-the-life, robustness + UX ideas, north stars (brainstorm only).  
- **Rest is detail:** Executive summary, file lists, prioritization, open questions.

---

## ELI5 — What Actually Happens

**Recording (in plain English):**  
You click “Start Recording,” the app opens a browser and injects a script into the page. When you click or type, that script sees the element (e.g. a button), asks “what’s the best way to find this again later?” (that’s **selector generation** — it lives in several places in the codebase). It sometimes merges two clicks into one action (e.g. “open dropdown” + “click option” → “Select X”) — that’s **coalescing**, and we have two implementations. The resulting “action” is sent to the desktop app and shown in the Record tab. So: **one recording pipeline in theory, but the “how we describe the element” and “how we merge clicks” are built in more than one place.**

**Playback (in plain English):**  
You click “Run Test.” The app has to **find** each element (button, input, etc.) and then **do** the action (click, type). “Find” is the tricky part: we try “user’s custom selector” → “last working selector” → “recipe” → “lots of fallback strategies.” We built that “find” logic **twice** — once for the Record tab (with pause/resume and 114 strategies) and once for the Builder/Tests/headless run (51 strategies). “Do” is shared: one module (ActionHandlers) does the actual click/type. So: **one “do” path, two “find” paths.**

---

## Visual: Recording Flow (One Pipeline, Many Pieces)

```
  YOU
   │  "Start Recording"
   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  RECORD TAB (React)                                                      │
│  PlaywrightRecorderPage.tsx  →  "Start"  →  IPC: playwright-recorder-start│
└──────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  DESKTOP (Electron main)                                                  │
│  PlaywrightRecorder  →  opens browser  →  INJECTS scripts into the page   │
│       │                                                                   │
│       ├── recorder-engine.js (from extension)  ← click/input listeners    │
│       ├── recipe-recorder-integration.js      ← V2 recipe + COALESCER    │
│       └── (coalescer = desktop action-coalescer.js injected)             │
└──────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  INSIDE THE BROWSER PAGE                                                  │
│  You click "Submit"  →  script runs  →  "What’s the best selector?"      │
│       │                      │                                            │
│       │                      └── SELECTOR FROM ONE OF:                    │
│       │                          • recorder-engine.js (SmartSelector)     │
│       │                          • extension smart-selector.js            │
│       │                          • (or desktop smart-selector if used)    │
│       │                                                                   │
│       └── action  →  coalescer? (dropdown → one "Select"?)  →  send to   │
│                      desktop                                              │
└──────────────────────────────────────────────────────────────────────────┘
   │
   ▼
  Actions appear in Record tab list.  ←  ONE pipeline, but SELECTOR and
                                         COALESCER each have 2+ implementations.
```

---

## Visual: Playback — The Two Paths (Same Idea, Two Implementations)

```
                    "Run Test" from RECORD TAB          "Run Test" from BUILDER / TESTS / HEADLESS
                                      │                                    │
                                      ▼                                    ▼
                    IPC: playwright-recorder-run-test         IPC: execute-test
                                      │                                    │
                                      ▼                                    ▼
                    ┌─────────────────────────────┐         ┌─────────────────────────────┐
                    │  PlaywrightRecorder         │         │  TestExecutor                │
                    │  (same browser as record,   │         │  (fresh browser, run to end) │
                    │   pause/resume/lock UI)     │         │                              │
                    └──────────────┬──────────────┘         └──────────────┬──────────────┘
                                   │                                       │
                    BOTH do the same ORDER of "find element":               │
                                   │                                       │
                    1. Manual override?  ──────────────────────────────────┤
                    2. Locked selector? ──────────────────────────────────┤
                    3. SmartFinder (recipe) ──────────────────────────────┤
                    4. Legacy _findElement (try 114 strategies)  (51 strategies)
                                   │                                       │
                                   ▼                                       ▼
                    ┌─────────────────────────────┐         ┌─────────────────────────────┐
                    │  ActionHandlers             │         │  ActionHandlers              │
                    │  (SHARED — click, fill, …)  │         │  (SHARED — same code)        │
                    └─────────────────────────────┘         └─────────────────────────────┘
                                   │                                       │
                                   ▼                                       ▼
                    Step runs. Events to UI.                Step runs. Report at end.
```

**Takeaway:** The **order** of finding (override → locked → SmartFinder → legacy) is the same. The **code** that does it is written twice (two files, different strategy counts).

---

## Visual: Where the Duplication Lives

```
                    RECORDING
    ┌─────────────────────────────────────────────────────────┐
    │  "How do we describe this element?" (SELECTOR)          │
    │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
    │  │ A   │ │ B   │ │ C   │ │ D   │ │ E   │ │ F   │  ...  │  ← 6+ places
    │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        │
    │  (recorder-engine, extension smart-selector, desktop    │
    │   smart-selector, inline getBestSelector, embedded,     │
    │   content.js Enhanced…)                                │
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │  "Merge two clicks into one?" (COALESCER)               │
    │  ┌─────────────────────┐    ┌─────────────────────┐   │
    │  │ Desktop              │    │ Extension           │   │  ← 2 implementations
    │  │ action-coalescer.js  │    │ action-coalescer-    │   │
    │  │ (injected)           │    │ browser.js           │   │
    │  └─────────────────────┘    └─────────────────────┘   │
    └─────────────────────────────────────────────────────────┘

                    PLAYBACK
    ┌─────────────────────────────────────────────────────────┐
    │  "Find the element" (ELEMENT FINDING)                    │
    │  ┌─────────────────────────────┐ ┌─────────────────────┐│
    │  │ PlaywrightRecorder          │ │ TestExecutor         ││  ← 2 implementations
    │  │ findElementWithRetry       │ │ findElementWithRetry ││
    │  │ _findElement (114 tries)   │ │ _findElement (51)    ││
    │  └─────────────────────────────┘ └─────────────────────┘│
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │  "Do the action" (CLICK, FILL, …)                        │
    │  ┌─────────────────────────────────────────────────────┐│
    │  │ ActionHandlers  (ONE implementation — shared)       ││  ← no duplication
    │  └─────────────────────────────────────────────────────┘│
    └─────────────────────────────────────────────────────────┘
```

---

## Visual: One Step of Playback (What Happens Inside “Find”)

Same flow in both engines; the boxes are different code.

```
  Step: "Click 'Submit'"
         │
         ▼
  ┌──────────────────┐
  │ Manual override?  │  ──yes──► use it
  └────────┬─────────┘
           │ no
           ▼
  ┌──────────────────┐
  │ Locked selector? │  ──yes──► use it (150ms)
  └────────┬─────────┘
           │ no (or failed)
           ▼
  ┌──────────────────┐
  │ SmartFinder      │  ──found─► use it (recipe: role+text, testId, …)
  │ (recipe-based)   │
  └────────┬─────────┘
           │ not found
           ▼
  ┌──────────────────┐
  │ Legacy           │  ──found─► use it
  │ _findElement     │     │
  │ (114 or 51       │     │  RECORDER: 114 strategies (testId, name, id,
  │  strategies)     │     │  aria, Salesforce login, listview search, …)
  └────────┬─────────┘     │  EXECUTOR:  51 strategies (smaller set)
           │              │
           ▼              ▼
       not found      found  →  ActionHandlers.click(locator)
           │
           ▼
       Retry (up to 3×) or fail
```

---

## Visual: Safe to Condense vs Don’t Touch

```
  SAFE TO CONDENSE (same behavior, less copy-paste)
  ═══════════════════════════════════════════════
  • Manual override check     →  one helper, 4 call sites
  • Locked selector try       →  one helper, 2 call sites
  • IPC execute-test          →  one registration
  • Event names               →  one canonical name + alias

  PARTIAL (share the “what”, keep the “where”)
  ═════════════════════════════════════════════
  • Element finding           →  share strategy list; KEEP both entry points
  • SmartSelector             →  share spec/config; KEEP fallbacks
  • Coalescer                 →  share pattern rules; KEEP both runners
  • Recipe vs legacy          →  normalize inside; KEEP accepting both

  DO NOT CONDENSE (would break things)
  ═══════════════════════════════════
  • Merge Record tab and Builder into one “run” path   →  different UX
  • Delete 114-strategy path, use only 51             →  enterprise regressions
  • Remove desktop or extension selector/coalescer    →  no fallback when inject fails
```

---

## 1. Executive Summary

- **Recording** is split across extension (`recorder-engine.js`, SmartSelector) and desktop (PlaywrightRecorder injects scripts, recipe recorder, action coalescer). One clear “recording pipeline” would be easier to reason about.
- **Playback** is implemented twice: **PlaywrightRecorder** (Record tab: run test, pause, resume, lock locators) and **TestExecutor** (execute-test IPC: Builder/Tests/headless). Both implement `findElementWithRetry` + `_findElement` with similar logic (~114 strategy pushes in recorder vs ~51 in executor). They share **ActionHandlers** for executing actions but not element finding.
- **Selector generation** exists in multiple places: extension `recorder-engine.js`, extension `smart-selector.js`, desktop `lib/smart-selector.js`, inline `getBestSelector` in `playwright-recorder.js`, `embedded-browser.js`, and extension `content.js` EnhancedSmartSelector. Risk of drift and bugs.
- **Action coalescing** exists in two implementations: desktop `lib/action-coalescer.js` (injected via recipe recorder) and extension `action-coalescer-browser.js`. Behavior should be one source of truth.

**Bottom line:** The doc’s “unified execution” is true for *action execution* (ActionHandlers), but **element finding and recording pipeline are duplicated or scattered**. Simplifying there gives the biggest payoff.

---

## 2. Recording Flow — What Exists

| Layer | Where | Notes |
|-------|--------|------|
| **UI** | `PlaywrightRecorderPage.tsx` | Start/stop, device, network; listens to `playwright-recorder-action`, `playwright-recorder-stopped` |
| **IPC** | `playwright-recorder-start` / `-stop` | index.js + ipc/recorder-handlers.js |
| **Orchestration** | `playwright-recorder.js` | Creates browser, injects scripts, handles tabs/CDP/cross-origin |
| **Injected scripts** | recorder-engine.js (extension) | Event capture (click, input, etc.); **SmartSelector** lives here (and in extension smart-selector.js) |
| **Recipe recorder** | `lib/recipe-recorder-integration.js` | V2 recipe format; injects **desktop** action-coalescer |
| **Coalescing** | Desktop `action-coalescer.js` (injected) | Dropdown trigger+option → Select. Extension has `action-coalescer-browser.js` (separate implementation) |
| **Selector build** | Multiple (see below) | recorder-engine SmartSelector, desktop smart-selector, inline getBestSelector in playwright-recorder, embedded-browser |

**Recording entry for “Run Test”:** Record tab uses `flowstral.playwrightRecorder.runTest()` when available, else `electronAPI.testRunner.executeTest()`. So Record tab playback usually goes through **PlaywrightRecorder**, not TestExecutor.

---

## 3. Playback Flow — What Exists

| Entry | Handler | Engine | findElementWithRetry | _findElement |
|-------|----------|--------|----------------------|--------------|
| **Record tab “Run Test”** | `playwright-recorder-run-test` | PlaywrightRecorder | playwright-recorder.js | playwright-recorder.js (~114 strategies) |
| **Builder / Tests / Headless** | `execute-test` (IPC) | TestExecutor | test-executor.js | test-executor.js (~51 strategies) |

Both engines:

- Check manual override first, then locked/optimized selector, then SmartFinder (recipe), then legacy `_findElement`.
- Use **ActionHandlers.executeAction(ctx, step)** so that **ctx** is either PlaywrightRecorder or TestExecutor. ActionHandlers calls `ctx.findElementWithRetry(action)` and `ctx._findElement(action)`.

So: **one shared action-execution layer**, **two separate element-finding implementations** (with different strategy counts and ordering).

---

## 4. Selector Generation — All Locations

| Location | Role | Risk if changed |
|----------|------|------------------|
| **flowstral-extension/src/lib/recorder-engine.js** | Inline SmartSelector + getBestSelector | Used when desktop injects recorder-engine; “single source of truth” in doc |
| **flowstral-extension/src/lib/smart-selector.js** | Standalone SmartSelector class | May be used by extension content script; can drift from recorder-engine |
| **flowstral-desktop/src/main/lib/smart-selector.js** | Standalone SmartSelector | Used by desktop when not using injected engine; can drift |
| **flowstral-desktop/src/main/playwright-recorder.js** | Inline `getBestSelector(el)` (around 5839) + loads Engine.SmartSelector (10667) | Duplication: inline vs injected engine |
| **flowstral-desktop/src/main/embedded-browser.js** | Loads Engine.SmartSelector, _buildSelectorObject | Different code path (embedded browser vs PlaywrightRecorder) |
| **flowstral-extension/src/content/content.js** | EnhancedSmartSelector wrapping SharedSmartSelector | Extension-only recording path |
| **flowstral-extension/src/lib/recorder-core.js** | getBestSelector(element, detectedApp) | Another selector entry point |

Having many sources makes it hard to guarantee “record with same logic we play back with” and to fix selector bugs in one place.

---

## 5. Duplication & Overlap Summary

| Area | Duplication | Impact |
|------|-------------|--------|
| **Element finding** | PlaywrightRecorder vs TestExecutor each have findElementWithRetry + _findElement | Bug fixes and new strategies must be done twice; ~114 vs ~51 strategies, different order |
| **Manual override** | Checked in both findElementWithRetry and _findElement in both files | 4 places; easy to miss one |
| **Locked selector (optimizedSelector)** | Same idea implemented in both engines | Logic and timeouts can diverge |
| **Self-healing** | Both emit healed/newSelector; frontend handles both | Could be single code path |
| **SmartSelector / getBestSelector** | 6+ locations (see above) | Drift, inconsistent selectors |
| **Action coalescing** | Desktop action-coalescer.js vs extension action-coalescer-browser.js | Two implementations of “dropdown → select” |
| **Recipe vs legacy** | recipe-recorder-integration, legacyActionToRecipe, selectorObj vs recipe | Two formats; both supported; more branches everywhere |

---

## 6. Simplification Opportunities (Prioritized)

### High impact / high leverage

1. **Single playback engine for element finding**  
   - **Idea:** One implementation of `findElementWithRetry` + legacy `_findElement` (e.g. in TestExecutor or a shared `ElementFinder`), and have PlaywrightRecorder **delegate** to it (same browser/page, different process context if needed).  
   - **Benefit:** One place for manual override, locked selector, SmartFinder, legacy strategies, self-healing. No more “fix it in two files.”  
   - **Risk:** Record tab today uses PlaywrightRecorder’s runTest (pause/resume/events); need to keep that UX and events while swapping only the “find + execute action” guts.

2. **Single source of truth for selector generation (recording)**  
   - **Idea:** Pick one SmartSelector implementation (e.g. extension recorder-engine’s SmartSelector) and use it everywhere recording happens; remove or thin inline getBestSelector and duplicate smart-selector.js copies.  
   - **Benefit:** One place to improve selectors and fix bugs; recording and playback expectations stay aligned.  
   - **Risk:** Need to ensure desktop-injected recording and extension recording both use the same module or API.

3. **Single action coalescer**  
   - **Idea:** One implementation (e.g. desktop action-coalescer) and inject or share it; remove or wrap extension action-coalescer-browser so behavior is defined in one place.  
   - **Benefit:** Dropdown/select behavior and exclusions (e.g. nav menus) stay consistent.  
   - **Risk:** Low if one implementation is clearly canonical and the other is just a thin adapter.

### Medium impact

4. **Normalize “recipe vs legacy” at playback boundary**  
   - **Idea:** At playback entry (executeStep / runTest), convert everything to one internal shape (e.g. always recipe + optional selectorObj) and have a single findElement(step) that only sees that shape.  
   - **Benefit:** Less “if recipe … else selectorObj” branching in multiple files.  
   - **Risk:** Medium; need to ensure all callers (Record, Builder, Tests, headless) pass compatible step format.

5. **Centralize manual-override and locked-selector checks**  
   - **Idea:** One function or small module that, given an action/step, returns “use this selector” or “run full find.” Both engines call it before SmartFinder/legacy.  
   - **Benefit:** Guarantee manual override and locked selector are applied the same way everywhere.  
   - **Risk:** Low; can be done incrementally.

6. **Reduce PlaywrightRecorder._findElement strategy count**  
   - **Idea:** Either (a) delete the huge inline _findElement in playwright-recorder and rely on shared element finder, or (b) replace the 114 strategy pushes with a shared strategy list (e.g. from test-executor or a lib).  
   - **Benefit:** Fewer strategies to maintain; consistent order with TestExecutor.  
   - **Risk:** Medium; must not regress hard-to-find elements (e.g. Salesforce).

### Lower impact / cleanup

7. **Document and enforce “Record tab = runTest; others = execute-test”**  
   - **Idea:** In architecture doc, state clearly: Record tab uses PlaywrightRecorder.runTest (with pause/resume/lock locators); Builder/Tests/headless use execute-test → TestExecutor. Then remove or clarify the “else executeTest” fallback in PlaywrightRecorderPage if it’s redundant.  
   - **Benefit:** Less confusion; clearer ownership.  
   - **Risk:** None if behavior is unchanged.

8. **Single IPC registration for execute-test**  
   - **Idea:** index.js and ipc/test-handlers.js both register execute-test; ensure only one handler is active and that it always uses TestExecutor (or the chosen single engine).  
   - **Benefit:** No duplicate or conflicting handlers.  
   - **Risk:** Low; verify which registration wins and that all UIs use it.

9. **Trim duplicate event names**  
   - **Idea:** PlaywrightRecorder emits both `playwright-test-step-complete` and `test-runner:step-complete` (and similar). Prefer one naming scheme and alias only where needed for compatibility.  
   - **Benefit:** Clearer event contract; fewer listeners.  
   - **Risk:** Low; frontend must be updated to subscribe to the chosen names.

10. **Extract “confidence” and “strategy type” from shared finder**  
    - **Idea:** If element finding is unified, have the single finder return strategy type and confidence; Lock Locators and UI badges consume that instead of each engine computing it.  
    - **Benefit:** Consistent Lock Locators and confidence display.  
    - **Risk:** Low once finder is shared.

---

## 7. Comparison: What Can Be Truly Condensed vs What to Keep

*Goal: Condense only where we don’t disturb robustness. Everything was built for a reason; changing it can introduce regressions.*

| Area | What we have (A vs B) | Why both exist (robustness) | Safe to condense? | How to condense without hurting robustness | Regression risk if we condense wrong |
|------|------------------------|-----------------------------|-------------------|--------------------------------------------|--------------------------------------|
| **Playback entry points** | PlaywrightRecorder.runTest (Record tab) vs TestExecutor.executeTest (Builder/Tests/headless) | Record tab: same browser as recording, pause/resume/step-by-step, lock locators UI, rich events. TestExecutor: fresh browser, run-to-end, different lifecycle. Different products. | **No** — keep both entry points | Don’t merge the two flows. Optionally **share** the element-finding *logic* (strategy list, order) via a shared module both call. | **High** if we remove one path (Record UX or headless would break). **Low** if we only share a helper module. |
| **findElementWithRetry + _findElement** | Two full implementations: PlaywrightRecorder (~114 strategies) vs TestExecutor (~51) | Recorder has more enterprise/Salesforce strategies; executor was tuned for speed and clarity. Different history and edge cases. | **Partial** | **Condense:** Extract a shared “priority + strategy list” (or shared `runLegacyFind(action, page)`) that both use. **Keep:** Each engine can still add *extra* strategies on top (e.g. Record-only Salesforce fallbacks) so we don’t drop hard-won behavior. Do **not** delete the 114 and only use 51. | **High** if we remove the 114-strategy path entirely. **Low** if we share a base list and keep extension points. |
| **Manual override check** | Checked in findElementWithRetry and again in _findElement, in both engines (4 places) | Defense in depth: every code path must respect user choice. | **Yes** | One small helper, e.g. `getManualOverrideOrNull(action)` / `tryManualOverride(page, action)`, used at the start of both findElementWithRetry and _findElement in both engines. Behavior unchanged; less copy-paste. | **Low** — same logic, single implementation. |
| **Locked selector (optimizedSelector)** | Same flow in both engines: try locked selector first (150ms), then fall back. | Ensures “Lock Locators” works the same from Record and from Builder/Tests. | **Partial** | **Condense:** One helper, e.g. `tryLockedSelector(page, action)` (returns locator or null), used by both engines. **Keep:** Both entry points still exist; only the “try locked” logic is shared. | **Low** if helper is a pure function with same timeout/behavior. **Medium** if we change timeout or role= format. |
| **SmartSelector / getBestSelector (recording)** | 6+ places: recorder-engine, extension smart-selector, desktop smart-selector, inline in playwright-recorder, embedded-browser, content.js | Different contexts: injected script (no Node), extension content script, desktop fallback when injection fails, embedded browser. | **Partial** | **Condense:** (1) One *spec* (priority order, dynamic ID patterns, app config) in a single JSON or doc; (2) Align implementations to that spec; (3) Optionally one canonical implementation (e.g. recorder-engine) that others *call* or *mirror* when possible. **Do not:** Delete desktop or extension copies without a fallback when injection/context fails. | **High** if we remove fallbacks (e.g. desktop smart-selector when recorder-engine fails to inject). **Low** if we only align behavior and share config/spec. |
| **Action coalescer (dropdown → select)** | Desktop action-coalescer.js (injected) vs extension action-coalescer-browser.js | Different runtimes: desktop injects into page; extension runs in extension context. May have different exclusions (e.g. nav menus). | **Partial** | **Condense:** Share *pattern definition* (what is trigger/option, max delay, nav exclusions) as data or a tiny shared script. **Keep:** Two “runners” (injected vs extension) that both use that definition. Don’t force one runtime to inject into the other’s context (cross-origin/security). | **Medium** if we remove one runner and injection fails in some sites. **Low** if we only share the pattern data/logic. |
| **Recipe vs legacy (playback)** | Steps come as recipe and/or selectorObj; both paths in findElement and executeStep. | Backward compatibility: old tests have selectorObj only; new ones have recipe; some have both. Playback must handle all. | **Partial** | **Condense:** At the *boundary* only: one normalizer “step → internal shape” (recipe + optional selectorObj) so downstream code sees one shape. **Keep:** Still accept both recipe and legacy from UI/API; don’t drop support for selectorObj-only tests. | **High** if we drop legacy format. **Low** if we only normalize internally and keep accepting both. |
| **Self-healing (healed / newSelector)** | Both engines detect “locked failed, SmartFinder worked” and emit healed + newSelector; frontend updates step. | Same UX from Record and from Tests tab. | **Partial** | **Condense:** If we ever share element-finding in a module, that module returns `{ healed, newSelector }`; both engines just pass it through. **Keep:** Both engines still emit events; no change to frontend contract. | **Low** — just moving where the flag is set. |
| **Event names** | e.g. playwright-test-step-complete vs test-runner:step-complete | Different consumers (Record UI vs generic test runner). | **Partial** | **Condense:** Prefer one canonical name; have the other as an alias (one emit, or a thin adapter). **Keep:** Don’t remove the alias until all listeners are updated. | **Low** if we add alias; **medium** if we rename without updating all listeners. |
| **IPC for execute-test** | index.js and ipc/test-handlers.js both register execute-test (or similar). | Historical or different app modes (e.g. packaged vs dev). | **Yes** | Single registration point; document which one is used. Remove duplicate so there’s no ambiguity. | **Low** — just cleanup. |

---

## 8. Safe vs Risky Condensing (Summary)

**Safe to condense (same behavior, less duplication):**

- Manual override check → one helper, same four call sites.
- Locked-selector try → one helper, both engines call it.
- IPC execute-test → one registration, document it.
- (Optional) Event names → one canonical name + alias.

**Partial (condense only the right part):**

- Element finding → share *strategy list / base logic*; keep both entry points and allow engine-specific extras. Do **not** delete the 114-strategy path.
- SmartSelector → share *spec/config* and align behavior; keep fallback implementations where injection or context can fail.
- Action coalescer → share *pattern definitions*; keep both runners for their contexts.
- Recipe vs legacy → normalize to one *internal* shape at playback boundary; keep accepting both formats from outside.
- Self-healing → move “set healed/newSelector” into shared finder if we add one; keep events and UX.

**Do not condense (would risk robustness):**

- Merging Record tab and Builder/Tests into a single “run test” path (different UX and lifecycle).
- Removing PlaywrightRecorder’s 114-strategy _findElement and using only TestExecutor’s 51 (regression on enterprise/Salesforce).
- Removing desktop or extension selector/coalescer *runners* without a fallback when their context isn’t available.

---

## 9. What to Leave As-Is (For Now)

- **ActionHandlers** — Shared execution (click, fill, select, etc.) is already unified; keep it.
- **SmartFinder + Strategy Memory** — Single lib used by both engines; keep.
- **Reliability layer, AI fallback, iFrame handling** — Used via ActionHandlers/context; keep.
- **Recipe format (what/where/which)** — Good abstraction for playback; keep, but normalize at boundary (see #4).
- **Lock Locators and self-healing UX** — Keep behavior; only implementation (who finds the element and reports workingSelector) should move to one place.

---

## 10. Suggested Order of Work (Brainstorm)

1. **Clarify and document**  
   - Update RECORD-PLAYBACK-CORE-ARCHITECTURE.md: which IPC/engine is used for Record vs Builder/Tests; list all selector-generation and coalescer locations.  
   - Add this audit doc as the “simplification backlog” reference.

2. **Quick wins (no unification yet)**  
   - Centralize manual-override + locked-selector check in a small helper used by both engines (#5).  
   - Single IPC for execute-test and document it (#8).

3. **Single playback element-finding path**  
   - Introduce shared element finder (e.g. in lib, or TestExecutor as the implementation) with findElementWithRetry + legacy strategies.  
   - Have TestExecutor use it only.  
   - Have PlaywrightRecorder runTest call the same finder (e.g. by delegating to TestExecutor with the same page, or by passing page into the shared module).  
   - Deprecate duplicate _findElement in PlaywrightRecorder (#1).

4. **Single selector source for recording**  
   - Choose canonical SmartSelector (e.g. recorder-engine) and make desktop and extension recording use it; remove or thin duplicates (#2).

5. **Single coalescer**  
   - Pick one action-coalescer and use it everywhere recording happens (#3).

6. **Recipe/legacy normalization**  
   - Normalize step shape at playback boundary and reduce branching (#4).

---

## 11. Open Questions

- Should **Record tab “Run Test”** eventually go through the same `execute-test` IPC and TestExecutor (with pause/resume/lock locators implemented there), so there is literally one execution path? Or is the goal only “same logic, two entry points”?
- Is **embedded-browser.js** recording still in use, or can selector building there be deprecated in favor of PlaywrightRecorder + injected recorder-engine?
- Are both **extension** and **desktop** recording flows required (e.g. Chrome extension vs desktop app), or can one be the primary and the other a thin wrapper?

---

## 12. One-Page Cheat Sheet (At a Glance)

**Recording in one sentence:**  
Browser gets scripts injected → you interact → scripts decide “how to find this element later” (selector) and sometimes “merge two clicks into one” (coalescer) → actions go to Record tab. Selector and coalescer each have 2+ implementations.

**Playback in one sentence:**  
We “find” the element (override → locked → SmartFinder → legacy) then “do” the action (click/fill). “Find” is implemented twice (Record tab vs Builder/Tests); “do” is one (ActionHandlers).

**Single diagram — recording vs playback:**

```
  RECORDING                              PLAYBACK
  ─────────                              ────────
  You  →  [Record tab]  →  IPC  →       "Run"  →  [Record tab]  →  PlaywrightRecorder  →  find (114)  →  ActionHandlers  →  step done
              │                          "Run"  →  [Builder/Tests] →  TestExecutor       →  find (51)   →  ActionHandlers  →  step done
              ▼
         [PlaywrightRecorder]
              │
              ▼  inject
         [Browser: recorder-engine + recipe + coalescer]
              │
              ▼  "best selector?" from 6+ places  →  action  →  back to Record tab
```

**Single diagram — what’s duplicated:**

```
  RECORDING                    PLAYBACK
  ────────                     ────────
  Selector: 6+ places    │     Find element: 2 engines (Recorder 114, Executor 51)
  Coalescer: 2 versions  │     Do action: 1 (ActionHandlers) ✓
```

**Condense?**  
Safe: override helper, locked helper, one IPC, event alias.  
Partial: share strategy list / spec / pattern data; keep both entry points and fallbacks.  
Don’t: merge the two run paths, delete 114 strategies, or remove selector/coalescer fallbacks.

---

## 13. References

- **Architecture:** `docs/RECORD-PLAYBACK-CORE-ARCHITECTURE.md`
- **Key files:**  
  - Recording: `playwright-recorder.js`, `flowstral-extension/src/lib/recorder-engine.js`, `lib/recipe-recorder-integration.js`, `lib/action-coalescer.js`  
  - Playback: `test-executor.js`, `playwright-recorder.js` (runTest, findElementWithRetry, _findElement), `lib/action-handlers.js`, `lib/smart-finder.js`  
  - Selectors: `recorder-engine.js` (SmartSelector), `flowstral-extension/src/lib/smart-selector.js`, `flowstral-desktop/src/main/lib/smart-selector.js`

---

*Audit date: Feb 2026. Re-run after major refactors.*
