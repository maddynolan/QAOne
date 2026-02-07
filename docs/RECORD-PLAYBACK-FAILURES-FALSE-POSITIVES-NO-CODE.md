# Fixing Failures & False Positives — No-Code, Blackbox, No AI

> **Purpose:** How a **normal user (no code, no DOM knowledge)** can fix failed and flaky steps and handle false positives in the **easiest, most understandable way**. Platform is **no-code and full blackbox**; this doc is the single source of truth for design and product.  
> **Scope:** All possible failure and false-positive situations; all combinations; no AI (AI integration is next version).  
> **Companion:** `RECORD-PLAYBACK-CORE-ARCHITECTURE.md`, `RECORD-PLAYBACK-IMPACT-AND-UX-BRAINSTORM.md`.

---

## 1. North Star: Zero Code, Zero DOM

**Principle:** The user never sees, edits, or chooses anything technical. They only:

- **See** — Screenshot, step name, plain-English explanation, list of “things on the page.”
- **Choose** — One primary action per moment (click the right thing, retry, skip, mark as “not a real failure,” stabilize).
- **Click** — On the real page (element picker) or on a suggestion (“Button: Submit order”).

We never show: selectors, DOM, XPath, CSS, locators, stack traces, error codes, “element,” “timeout” (we say “the page wasn’t ready in time”), or “assertion” (we say “check that…”).  
**Goal:** Any non-technical tester can fix any failure or false positive in under a minute, without help.

---

## 2. What “Failed” Means (User Mental Model)

To the user, a step can “fail” in only a few ways. We map every technical cause to one of these and show one clear message and one primary action.

| User-facing type | What they think | What we say (example) | Primary action we offer |
|------------------|-----------------|------------------------|--------------------------|
| **Couldn’t find it** | “The test couldn’t find the button/link/field.” | “We couldn’t find ‘Submit’ on the page. It may have moved or the page may have changed.” | **Click the correct one** (picker or suggestions) |
| **Found the wrong one** | “The test clicked something else.” | “We found several ‘Submit’ options and clicked the wrong one. Please click the one you meant.” | **Click the correct one** (picker or “Which one?” list) |
| **Page wasn’t ready** | “The test was too fast.” | “The page was still loading. We can wait longer and try again.” | **Wait and retry** (or “Add a short wait before this step”) |
| **Not a real failure** | “The test said fail but the page is correct.” | “You can mark this step as ‘not a real failure.’ Next time we’ll stop here and ask you instead of failing.” | **Mark as not a real failure** (false positive) |
| **Sometimes works, sometimes doesn’t** | “This step is flaky.” | “This step has failed sometimes. You can make it stable by locking what works, or we can ask you at this step each time.” | **Stabilize** (lock) or **Ask me each time** (false positive) |

Every failure UI should: (1) show **one** of these types, (2) show **one** short sentence, (3) offer **one** primary button, (4) hide technical details behind “More options” if we must.

---

## 3. Failure Taxonomy: Technical Cause → User Type → Message → Actions

So we never leak implementation, we classify internally then map to user type and copy.

| Technical cause (internal) | User type | User message (example) | Actions offered (no code) |
|----------------------------|-----------|--------------------------|----------------------------|
| Selector found 0 elements | Couldn’t find it | “We couldn’t find [step label, e.g. ‘Submit’] on the page. It may have moved or the page may have changed.” | Click the correct one · Wait and retry · Skip this step · Not a real failure |
| Selector found N > 1, wrong one clicked | Found the wrong one | “We found several [labels] and clicked the wrong one. Please click the one you meant.” | Click the correct one (picker or “Which one?” list) · Skip · Not a real failure |
| Element hidden / disabled / covered | Couldn’t find it (or “not ready”) | “We couldn’t use [label] (it might be hidden or the page still loading).” | Click the correct one · Wait and retry · Not a real failure |
| Timeout (page slow, element appeared late) | Page wasn’t ready | “The page wasn’t ready in time. We can wait longer and try again.” | Wait and retry · Click the correct one · Not a real failure |
| Intermittent (flaky) | Sometimes works, sometimes doesn’t | “This step has failed in some runs. You can make it stable or we can ask you at this step each time.” | Stabilize (lock) · Ask me each time (false positive) |
| User previously marked “not a real failure” | (Not a failure — we pause) | “You said this step isn’t a real failure. Is the page correct now?” | Yes, continue · No, something’s wrong — let me fix it (→ fix flow) |

**Rule:** Every failure reason we ever emit (including from reliability layer, SmartFinder, timeout) is mapped to one of these rows. No raw technical strings in the UI.

---

## 4. The One-Screen Rule (Failure Moment)

When a step fails, the user sees **one** place (modal or panel), with:

1. **Step name** — e.g. “Click ‘Submit’” (what we tried to do).
2. **Screenshot** — The page at the moment of failure (or live browser if still open).
3. **One sentence** — From the table above (couldn’t find it / wrong one / not ready / not a real failure / flaky).
4. **One primary button** — The best next action (almost always “Click the correct one” for real failures).
5. **Secondary actions** — Same set every time, in simple words:
   - **Wait and retry** — Try the same step again (e.g. after page loads).
   - **Skip this step** — Continue the test without this step.
   - **Not a real failure** — Mark as false positive (see Section 7).
   - **Run from here** — (If applicable) Run from this step onward after fixing.
   - **More options** — (Optional) Only here: advanced things like “Add a wait before this step” (e.g. “Wait 2 seconds” checkbox), no code.

We **do not** show multiple tabs, selector text, DOM, or error codes. We **do not** ask “do you want to edit the selector?” as the default.

---

## 5. Fix Paths (All Combinations, No Code)

**A. Click the correct one**

We support **four no-code ways** to choose the correct target. All must use plain-language labels only (no selectors in the UI).

1. **Element picker (click on the page)**  
   User clicks “Click the correct one” → we open **element picker**: browser highlights clickable things on hover and shows a short label (e.g. “Button: Submit order”). User clicks the right one → we save it and show “We’ll use what you clicked next time.” Best when the user wants to point at the exact spot on the page.

2. **Smart Suggestions panel (app, right side)**  
   When a step fails, we open the **Smart Suggestions** panel on the right. It shows a list of **plain-language** items only (e.g. “Button: Submit order,” “Link: Back,” “Field: Email”). User clicks one → we replace the failed step with that choice and can retry or continue. No selectors visible. Same list can be grouped (e.g. Buttons, Links, Inputs) and searchable.

3. **Smart Suggestions overlay (on the browser page)**  
   We show a **suggestions overlay** on the page (e.g. bottom-right): same suggestions as the panel, but **on the page** so the user sees them next to the app. The overlay can offer:
   - **Run this action** — We find the item by its label and click it on the page (so the user can “try” it).
   - **Use for failed step** / **Replace step** — When a step has failed, a control in the overlay (or a clear flow from overlay → app) lets the user pick a suggestion to **replace** the failed step, not only add a new step.
   All overlay labels must be plain language (e.g. “Button: Submit order”); no selectors. If the overlay today only has “Add to steps,” we still surface “Click the correct one” via the **app panel** or the **step editor** (below) so the user can replace the failed step from the same list.

4. **Replace with Overlay Suggestion (step editor)**  
   When the user opens the step editor (e.g. to fix a step), we show a block **“Replace with Overlay Suggestion”** (or “Replace with suggestion”) that lists the same plain-language suggestions (from the same source as the overlay/panel). User clicks one → we replace that step and close the editor. So the user can fix from the **modal** without switching to the panel or the page overlay.

**Summary:** For “Click the correct one” we use **all** of: (1) picker on page, (2) Smart Suggestions panel in the app, (3) Smart Suggestions overlay on the page (with “run” and, when in failure mode, “replace step”), (4) Replace with suggestion in the step editor. Everywhere we show **only** plain-language labels (e.g. “Button: Submit order”); we never show selectors in the UI.

- **If no suggestions or user prefers the page:** Use **element picker** only.
- **If multiple similar elements:** “Which one?” with short labels and optional position hint: “Button ‘Submit’ (top of form),” “Button ‘Submit’ (bottom).” User picks one.

**B. Wait and retry**

- User clicks “Wait and retry.” We retry the same step (optionally with a short extra wait). No code. If we support “add wait before this step,” it’s a simple “Wait 2 seconds before this step” toggle or dropdown (e.g. 1 / 2 / 5 seconds), not a script.

**C. Skip this step**

- User clicks “Skip this step.” We mark the step skipped for this run and continue. Optionally: “Remove this step from the test” (delete step) for clarity.

**D. Not a real failure (false positive)**

- See Section 7. User marks the step; we store it; next run we **pause** at that step and ask “Is the page correct?” Yes → continue; No → open fix flow (picker/suggestions).

**E. Run from here**

- After user fixes (e.g. via picker), we offer “Run from here” so they can verify without re-running earlier steps. No code; just “Resume from step 7.”

**F. Stabilize (flaky)**

- User clicks “Stabilize.” We run “Lock locators” for this test (or this step) and optionally rerun. We show: “We’ve saved what worked. This test should be more stable now.”

**G. Ask me each time (flaky + false positive)**

- For flaky steps, we offer “Ask me each time.” We treat it like a false positive: at this step we pause and ask “Is the page correct?” So we don’t fail the test; we ask. No code.

---

## 6. Element Picker for No-Code Users

The picker is the main way users fix “couldn’t find it” or “wrong one” without ever seeing a selector.

**Requirements:**

1. **Highlight on hover** — When the user moves the mouse, we highlight the target (e.g. outline + label).
2. **Label on hover** — Show a **plain-language** label: e.g. “Button: Submit order,” “Link: Back to cart,” “Text field: Email.” Never show a selector.
3. **Click to choose** — One click selects that target. We store it internally (selector/manual override); user only sees “We’ll use what you clicked.”
4. **“Which one?” when many match** — If the step description is generic (e.g. “Submit”) and there are several similar elements, we can show a short list: “Button: Submit (top),” “Button: Submit (bottom)” with optional thumbnail or position. User picks one.
5. **Scroll hint** — If the element is off-screen, we show: “Scroll down and click the element,” or we auto-scroll to it if safe. No technical wording.
6. **Confirmation** — After pick: “Updated. Next run we’ll use this [button/link/field].” No selector.

**What we never do in the picker:** Show CSS/XPath, show “selector,” or ask the user to type or edit anything technical.

---

## 6a. Smart Suggestions Panel and Overlay (All Possible Ways, No Code)

We already have a **Smart Suggestions panel** (right side of the Record tab) and a **Smart Suggestions overlay** (on the browser page). Both must be part of the no-code fix flow so the user has every way to “click the correct one” without code or DOM.

**Smart Suggestions panel (in the app)**

- **Where:** Right side of the Record tab; can be shown when a step fails (e.g. switch to “Suggestions” tab).
- **What it shows:** A list of suggested actions from the current page (buttons, links, fields, etc.). Each item must show a **plain-language** label only (e.g. “Button: Submit order,” “Link: Back to cart,” “Field: Email”). Grouping (e.g. Buttons, Links, Inputs) and search are fine.
- **How the user fixes:** User clicks one suggestion → we **replace the failed step** with that choice (save as manual override / recipe) and confirm in plain language (“We’ll use this next time”). No selector or “manual override” in the UI.
- **When it appears:** Automatically when a step fails (and optionally during recording). Modal is closed first so the panel is visible.

**Smart Suggestions overlay (on the browser page)**

- **Where:** Injected into the browser page (e.g. badge top-right; panel bottom-right when opened). Same data as the app panel (synced from the same analysis).
- **What it shows:** Same list of suggestions with **plain-language** labels only. The overlay can show categories (e.g. Buttons, Links, Inputs) and per-item actions.
- **Actions we support (no code):**
  - **Run this action** — Find the item by label on the page and click (or fill) it. So the user can “try” an option before choosing it to replace the step. No technical wording.
  - **Use for failed step** / **Replace step** — When a step has failed, the user can pick a suggestion in the overlay to **replace** that step (same outcome as clicking in the app panel). If the overlay today only has “Add to steps,” we either add “Replace failed step” when in failure mode or make it obvious that “click the same suggestion in the app panel” replaces the step.
- **Sync:** Suggestions in the overlay and in the app panel come from the same source (e.g. page analysis). When we refresh (e.g. after failure), both update so the user sees the same options in the app and on the page.

**Replace with Overlay Suggestion (in the step editor)**

- **Where:** Inside the step editor modal (e.g. SimpleStepEditor), when fixing a step.
- **What it shows:** A short list of the same suggestions (e.g. “Replace with Overlay Suggestion” with buttons). Each button shows **plain-language** label only (e.g. “Submit order,” “Save”).
- **How the user fixes:** User clicks one → we replace the step with that suggestion and close the modal. Optional “Refresh” to reload suggestions. No selectors.

**No-code rules for panel and overlay**

- Everywhere we show suggestions we use **only** labels like “Button: Submit order,” “Link: Back,” “Field: Email.” We never show CSS, XPath, or “selector” in the UI.
- Tooltips or “More info” must not expose selectors; keep help text in plain language.
- If we show a “type” (e.g. button, link, input), that’s fine; we don’t show the underlying selector.

**Summary:** The user can fix a failed step by (1) **picker** — click on the page; (2) **panel** — click a suggestion in the app; (3) **overlay** — run an action on the page and/or choose a suggestion to replace the failed step; (4) **step editor** — click “Replace with Overlay Suggestion” and pick one. All four are no-code; all use plain-language only.

**Quick reference: All possible ways to fix “wrong element” or “couldn’t find it”**

| Where | What the user does | Result |
|-------|--------------------|--------|
| **Element picker** | Clicks “Click the correct one” → hovers on page (see label) → clicks the target | Step updated; “We’ll use what you clicked next time.” |
| **Smart Suggestions panel (app, right)** | Clicks a suggestion in the list (e.g. “Button: Submit order”) | Failed step replaced with that choice. |
| **Smart Suggestions overlay (browser)** | Clicks “Run” on a suggestion to try it on the page, or “Replace failed step” / equivalent to use it for the failed step | Run = click on page; Replace = step updated. |
| **Step editor – Replace with Overlay Suggestion** | Opens step editor → clicks one of the suggestion buttons | Step replaced; modal closes. |

All four must show **plain-language labels only** (no selectors). Panel and overlay show the **same** suggestions (synced).

---

## 7. False Positive: Complete Flow (No Code)

**Definition:** The test reports “failed” but the user considers the page correct (e.g. timing, environment, known UI quirk). We must not require code or DOM; we only need “mark” and “at this step, ask me.”

**7.1 Marking a step as “not a real failure”**

- From the failure screen, user clicks **“Not a real failure.”**
- Optional: Short reason (dropdown only): “Page was still loading,” “Looks different but correct,” “Known issue,” “Other.” No free-text required.
- We **store**: step id, test id, screenshot at failure (optional but recommended), reason, timestamp.
- We show: “Next time we run this test, we’ll stop at this step and ask you instead of failing.”

**7.2 Next run: when we reach that step**

- We **do not** fail. We **pause** at that step.
- We show one screen:
  - Step name: e.g. “Click ‘Submit’.”
  - Stored screenshot (or current page): “This is when you said it’s not a real failure.”
  - Question: **“Is the page correct now?”**
  - Buttons: **“Yes, continue”** | **“No, something’s wrong — let me fix it.”**
- **Yes, continue:** We continue the test (no failure recorded). No code.
- **No, something’s wrong:** We open the normal fix flow (Click the correct one: picker or suggestions). After fix, we can offer “Run from here” and optionally **clear** the “not a real failure” flag for this step so we don’t ask again unless they re-mark it.

**7.3 Un-marking (treat as real again)**

- In test/step settings or from the step list, user can “Remove ‘not a real failure’” so the step is treated as a normal step again. No code.

**7.4 Summary**

- False positive = **“At this step, stop and ask me; don’t fail.”**
- No selectors, no DOM, no scripts. Just: mark → store screenshot + reason → next run pause → “Is the page correct?” → Continue or Fix.

---

## 8. Flaky: What It Is and How We Handle It (No Code)

**User definition:** “This step sometimes passes and sometimes fails.”

**What we do:**

1. **Detect** — We track per-step pass/fail over runs (e.g. last 10). If a step failed in some but not all, we consider it flaky.
2. **Explain** — We show: “This step has failed in some runs. You can make it stable or we can ask you at this step each time.”
3. **Offer two no-code actions:**
   - **Stabilize** — We “lock” what works (Lock Locators for this step/test). We rerun; if it passes, we show “This test is now more stable.”
   - **Ask me each time** — We treat the step like a false positive: at this step we pause and ask “Is the page correct?” So we never fail the test here; we ask. Good for steps that are inherently variable (e.g. “Accept cookie banner” that may or may not appear).

No code, no DOM. User only chooses “make it stable” or “ask me each time.”

---

## 9. Plain-Language Vocabulary

**Use in UI and messages:**

- “Button,” “link,” “field,” “dropdown,” “checkbox” — not “element.”
- “We couldn’t find [label]” — not “element not found.”
- “The page wasn’t ready in time” — not “timeout.”
- “We found several and clicked the wrong one” — not “multiple matches.”
- “Click the correct one” — not “update selector” or “set manual override.”
- “Make it stable” / “Stabilize” — not “lock locators” (can use “lock” in tooltip if we want).
- “Not a real failure” — not “false positive” (can use “false positive” in docs only).
- “We’ll use what you clicked next time” — not “manual override saved.”
- “Is the page correct now?” — for false positive pause.
- “Wait and retry” — not “retry with same selector.”
- “Run from here” — not “resume from step N.”
- “Skip this step” — clear.

**Never use in user-facing UI:** selector, DOM, XPath, CSS, locator, timeout (use “wasn’t ready in time”), element (use button/link/field), assertion, manual override, recipe, testId, aria-label (unless we say “accessible label” in help text).

---

## 10. All Combinations Matrix

Coverage so we don’t miss a case. Rows = failure type; columns = user action; cell = outcome.

| Failure type        | Click the correct one | Wait and retry | Skip step | Not a real failure | Run from here | Stabilize / Ask me |
|---------------------|------------------------|----------------|-----------|---------------------|---------------|---------------------|
| Couldn’t find it   | Picker or suggestions → save → retry/continue | Retry same step | Continue without step | Mark; next run pause and ask | After fix, run from this step | N/A (use for “wrong one” or flaky) |
| Wrong one           | Picker or “Which one?” → save → retry/continue | Retry (maybe same wrong one) | Continue | Mark | After fix, run from here | N/A |
| Page not ready      | Picker if they want to point to something | Retry (optionally with wait) | Skip | Mark | — | N/A |
| Not a real failure  | (Not a failure; we pause) | — | — | Already marked | — | — |
| Flaky               | Can fix with picker first | Retry | Skip | Can mark as “ask me” | — | Stabilize or Ask me each time |

**Multi-failure run:** We show one failure at a time. After user fixes (e.g. picker), we retry from that step; if the next step fails, we show the next failure screen. So: **one decision per screen**, sequential. We don’t show a list of 5 failed steps and ask to “fix all” in one go (too confusing for no-code).

---

## 11. Edge Cases (No Code)

| Case | What we do (user-facing) |
|------|---------------------------|
| **Element off-screen** | Picker: “Scroll down and click the element,” or we scroll to it if possible. No “element not in viewport.” |
| **Element in popup/iframe** | If we can’t find it, we say “The thing you want might be in a popup or another part of the page. Please click it.” Picker works in the active frame; we may need to support “click in the main page” vs “click in the popup” by context. No DOM words. |
| **Dynamic content (list, table)** | “This step might fail sometimes because the page content changes. You can click the correct one now to fix it, or mark as ‘ask me each time.’” |
| **First failure ever** | One-time short message: “When a step fails, you can fix it by clicking the correct thing on the page. We’ll remember your choice.” Then show the normal failure screen. |
| **User fixes then step fails again** | Same failure screen again; we can add “We tried what you picked last time but it didn’t work. Please click the correct one again.” No selector. |
| **Suggestions empty** | Don’t show an empty list. Show only “Click on the page to choose” (picker). |
| **CI/headless run** | We can’t show picker. We store failure (screenshot, step, reason). In the report we show the same one-sentence reason and “Fix in app: open this test, run from this step, use ‘Click the correct one.’” So the fix path is “in app,” not in CI. |

---

## 12. What We Have vs What We Need (Gap Analysis)

**Already in place (use and harden):**

- Smart Suggestions on failure; Fix/Flag buttons; modal closes so suggestions are visible.
- Element picker; `onElementPicked` → save to `selectorObj.manualOverride`.
- Lock Locators (stabilize); self-healing when locked selector fails.
- Step list and test result modal; step-level status.
- `flaggedStepIds`, `stopAtFlagged`, `keepBrowserOpenOnFailure` (backend support for stopping at flagged step).

**Gaps to close for full no-code confidence:**

| Gap | What’s missing | Needed for no-code |
|-----|----------------|---------------------|
| **Failure reason in plain language** | We likely show technical error or “element not found.” | Classify every failure into the 5 user types; show exactly one sentence from Section 3. |
| **One primary action** | Fix and Flag might be equal weight; “Click the correct one” might not be the single main button. | One big button: “Click the correct one”; others secondary (Wait and retry, Skip, Not a real failure). |
| **Suggestions without selectors** | Panel or overlay might show selector or technical label. | **Panel, overlay, and step editor:** plain-language only (“Button: Submit order,” “Link: Back”). No CSS/XPath in UI. Same rule for overlay tooltips and “Execute”/“Add” labels. |
| **Overlay “Replace failed step”** | Overlay may only have “Execute” and “Add to steps.” | When a step has failed, overlay offers “Use for failed step” / “Replace step” so the user can replace from the page without switching to the app panel; or we make it explicit that “pick the same suggestion in the app panel to replace.” |
| **Panel and overlay in sync** | Suggestions in app vs on page could differ. | Same data source (e.g. page analysis); when we refresh after failure, both panel and overlay update so the user sees the same options in app and on the page. |
| **False positive full flow** | Flag exists; screenshot and “rerun stops at step + ask” may be incomplete. | Store screenshot + reason; on next run **pause** at that step; show “Is the page correct?”; Yes → continue, No → fix flow. |
| **False positive “ask me” at pause** | Backend may stop at flagged step but not show the “Is the page correct?” screen. | Dedicated pause UI: step name, screenshot, “Is the page correct?” “Yes, continue” / “No, let me fix it.” |
| **Flaky detection and actions** | We may not classify “flaky” or offer “Stabilize” vs “Ask me each time.” | Per-step pass/fail history; “This step has failed sometimes”; buttons: Stabilize, Ask me each time. |
| **“Which one?” when multiple** | We might show one suggestion or picker only. | When N > 1 similar: list “Button: X (top),” “Button: X (bottom)” or thumbnails; user picks one. |
| **Picker label on hover** | Picker may highlight but not show “Button: Submit order.” | On hover: plain-language label (role + text); never selector. |
| **Run from here** | May exist in Record tab; ensure it’s visible after a fix. | After “Click the correct one” and save: “Run from here” to re-run from this step. |
| **Vocabulary audit** | Some UI might still say “selector,” “element,” “timeout.” | Replace with Section 9 wording everywhere the user sees. |
| **First-failure onboarding** | May be missing. | One-time: “You can fix by clicking the correct thing. We’ll remember.” |

---

## 13. Implementation-Agnostic Checklist (Product / QA)

Use this to verify we’re fully no-code and that all paths are covered.

**Failure moment**

- [ ] Every failed step shows one user type (couldn’t find / wrong one / not ready / not a real failure / flaky).
- [ ] One short sentence only; no technical message.
- [ ] One primary action (usually “Click the correct one”).
- [ ] Screenshot or live page visible.
- [ ] Secondary: Wait and retry, Skip, Not a real failure, Run from here (when relevant).
- [ ] No selector/DOM/error code in main UI.

**Click the correct one (all possible ways)**

- [ ] **Picker:** highlight on hover; label on hover (e.g. “Button: Submit order”); click to choose; confirmation in plain language.
- [ ] **Smart Suggestions panel (app):** list of plain-language items only; click one → replace failed step; no selectors in UI.
- [ ] **Smart Suggestions overlay (browser):** same list, plain-language only; “Run this action” (click on page) and, when step has failed, “Replace failed step” or clear path to replace (e.g. from overlay choice → app replaces step).
- [ ] **Replace with Overlay Suggestion (step editor):** same suggestions in modal; click one → replace step; plain-language labels only.
- [ ] **Suggestions everywhere:** list of plain-language items only; click one → save and continue (or replace step); no selector visible.
- [ ] “Which one?” when multiple similar elements.
- [ ] Saves to manual override; no “selector” or “manual override” in user-facing UI.

**False positive**

- [ ] User can mark step as “Not a real failure” (optional reason).
- [ ] We store step id, screenshot, reason.
- [ ] Next run: we pause at that step (do not fail).
- [ ] Pause screen: “Is the page correct now?” “Yes, continue” / “No, let me fix it.”
- [ ] User can un-mark later.

**Flaky**

- [ ] We detect (e.g. failed in some of last N runs).
- [ ] We show: “This step has failed sometimes.”
- [ ] Actions: Stabilize (lock), Ask me each time (like false positive).

**Vocabulary**

- [ ] No “selector,” “DOM,” “XPath,” “timeout,” “element,” “assertion,” “manual override” in user-facing copy.
- [ ] Use “button/link/field,” “wasn’t ready in time,” “Click the correct one,” “Not a real failure,” “Stabilize,” “Run from here.”

**Edge cases**

- [ ] Off-screen: “Scroll and click” or auto-scroll.
- [ ] First failure: short onboarding sentence.
- [ ] Multi-failure: one step at a time; after fix, retry then next failure if any.
- [ ] CI: report shows same one-sentence reason + “Fix in app: run from this step, use Click the correct one.”

---

## 14. Summary: One Paragraph Per Concept

**Failure:** We show one type (couldn’t find it / wrong one / not ready / not a real failure / flaky), one sentence, one primary action (usually “Click the correct one”), and a screenshot. No code, no DOM.

**Fix:** User clicks the correct thing (picker or plain-language suggestions). We save it and use it next time. We confirm in plain language. “Run from here” lets them verify without re-running earlier steps.

**False positive:** User marks “Not a real failure.” Next run we pause at that step and ask “Is the page correct?” Yes → continue; No → fix flow. Screenshot and optional reason stored. No code.

**Flaky:** We detect and say “This step has failed sometimes.” User chooses Stabilize (lock what works) or Ask me each time (pause and ask, like false positive). No code.

**Vocabulary:** We never show selectors, DOM, or technical errors. We use “button/link/field,” “wasn’t ready in time,” “Click the correct one,” “Not a real failure,” “Stabilize,” “Run from here.”

**Confidence:** When every failure is classified, every message is one sentence, every fix is one click (picker or list), false positives have a full pause-and-ask flow, and flaky has Stabilize or Ask me, a normal user can fix failures and false positives without code or DOM. This doc is the spec for that behavior.

---

*Document version: Feb 2026. Revisit when adding AI-assisted fix or changing failure/repair UX.*
