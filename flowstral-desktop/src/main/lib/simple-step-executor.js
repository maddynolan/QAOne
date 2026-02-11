/**
 * SimpleStepExecutor — Playwright-native step execution with simplified element finding.
 * 
 * ARCHITECTURE:
 * 
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  executeStepV2(action)                                               │
 * │                                                                      │
 * │  1. IS IT AN ELEMENT-INTERACTION ACTION? (click/fill/hover/etc.)     │
 * │     YES → Use SimpleElementFinder (Playwright auto-wait, parallel)   │
 * │           → If not found: heal with SmartFinder                      │
 * │           → If still not found: iframe search                        │
 * │           → If still not found: AI DOM Resolver (text LLM)           │
 * │           → If still not found: AI Vision fallback (screenshot)      │
 * │           → Execute the action on the found element                  │
 * │           → Post-action verification (catch false positives)         │
 * │           → Auto-correction if verification fails                    │
 * │                                                                      │
 * │  2. IS IT A NON-ELEMENT ACTION? (navigate/wait/press/tab/SF/etc.)   │
 * │     YES → Delegate to existing ActionHandlers UNCHANGED              │
 * │           → These handlers already work correctly                    │
 * │                                                                      │
 * │  AI STEP GUARANTOR:                                                  │
 * │  - Phase 4.5: AI DOM Resolver (pruned DOM → GPT-4o-mini → selector) │
 * │  - Phase 5: AI Vision (screenshot → GPT-4o-mini → coordinates)      │
 * │  - Post-Action: Verify fills, clicks, selects actually worked        │
 * │  - Auto-Correct: Fix false positives with alternative methods        │
 * │  - AI Flags: aiResolved field on every step result                   │
 * │  - Strategy Cache: AI selectors saved for future fast-path runs      │
 * │                                                                      │
 * │  WHAT'S DIFFERENT FROM executeAction:                                │
 * │  - NO manual count()+isVisible() snapshots for element finding       │
 * │  - NO 300ms DOM stability wait (Playwright waitFor handles it)       │
 * │  - NO sequential Quick Scan (replaced by parallel tier racing)       │
 * │  - Element finding is 3-10x faster on happy path                     │
 * │  - AI GUARANTOR makes steps pass when all else fails                 │
 * │                                                                      │
 * │  WHAT'S THE SAME:                                                    │
 * │  - All action handlers (click mechanics, fill logic, dropdown, etc.) │
 * │  - Tab switching, iframe scoping                                     │
 * │  - Lock Locators tracking (workingSelector, strategyType)            │
 * │  - Self-healing (updates locked selector when healing succeeds)      │
 * │  - All SF/PWA/comprehensive UI handlers                              │
 * └───────────────────────────────────────────────────────────────────────┘
 * 
 * USAGE (in playwright-recorder.js):
 * 
 *   const { SimpleStepExecutor } = require('./lib/simple-step-executor');
 *   
 *   // In runTest():
 *   if (this._useSimplePlayback) {
 *     const executor = new SimpleStepExecutor(this);
 *     result = await executor.executeAction(action);
 *   } else {
 *     result = await this.executeAction(action);
 *   }
 */

const { SimpleElementFinder } = require('./simple-element-finder');
const { getManualOverrideSelector, getLockedSelector } = require('./override-and-locked');
const { getAIStepGuarantor, AI_RESOLUTION } = require('./ai-step-guarantor');

// Action types that require finding an element on the page
const ELEMENT_ACTIONS = new Set([
  'click', 'clicktext', 'clickelement',
  'dblclick', 'doubleclick',
  'rightclick', 'contextmenu',
  'fill', 'type', 'input',
  'hover',
  'check', 'uncheck',
  'clear', 'clearfield',
  'focus', 'blur',
  'select', 'selectoption',
]);

// Action types that are delegated entirely to existing handlers (no element finding change)
const DELEGATED_ACTIONS = new Set([
  'goto', 'navigate', 'navigateto', 'salesforcenavigation',
  'wait', 'pause',
  'press', 'keypress',
  'scroll',
  'drag', 'dragdrop',
  'upload', 'fileupload', 'download',
  'dialog', 'handledialog', 'closemodal', 'dismissmodal',
  'asserttext', 'assert', 'assertvisible', 'assertvalue',
  'screenshot',
  'newtab', 'switchtab', 'closetab',
  'crossoriginplaceholder', 'crossorigin',
  // SF-specific
  'sf-navigate-record', 'navigatetorecordbyid',
  'sf-navigate-soql', 'navigatetorecordbysoql',
  'sf-navigate-list', 'navigatetoobjectlist',
  'sf-navigate-new', 'navigatetonewrecord',
  'sf-global-search', 'salesforceglobalsearch',
  'sf-app-launcher', 'openapplauncher',
  'sf-open-search', 'openglobalsearch',
  'sf-wait', 'waitforsalesforceready',
  'sf-click-tab', 'clickrecordtab',
  'sf-click-save', 'clicksavebutton',
  'sf-click-edit', 'clickeditbutton',
  'sf-click-delete', 'clickdeletebutton',
  'sf-click-clone', 'clickclonebutton',
  'sf_assert_record_type', 'assertrecordtype',
  'sf_rest_api', 'restapi',
  'sf_apex', 'executeapex',
  // PWA
  'pwaaudit', 'validatepwa', 'checkmanifest', 'validatemanifest',
  'checkserviceworker', 'serviceworkerstatus', 'waitforserviceworker',
  'testoffline', 'offlinetest', 'checkcache', 'verifycache',
  'checkinstallability', 'pwainstallable',
  // Comprehensive UI
  'toggle', 'toggleswitch', 'slider', 'setslider', 'range',
  'expand', 'collapse', 'accordion',
  'autocomplete', 'typeahead', 'selectsuggestion',
  'otp', 'otpinput', 'pin',
  'increment', 'decrement', 'setquantity',
  'rate', 'rating', 'setrating',
  'sortcolumn', 'tablesort',
  'gotopage', 'pagination',
  'acceptcookies', 'dismissbanner', 'cookieconsent',
  'loadmore', 'scrolltoload', 'infinitescroll',
  'multiselect', 'selectmultiple',
  'selectdate', 'datepicker',
  'selecttime', 'timepicker',
  'selectcalendardate', 'calendar',
]);

class SimpleStepExecutor {
  /**
   * @param {object} ctx - The PlaywrightRecorder instance (provides page, context, smartFinder, etc.)
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.finder = new SimpleElementFinder({ 
      debug: true,
      tier1Timeout: 3000,
      tier2Timeout: 5000,
    });
    
    // AI Step Guarantor — makes steps pass when all deterministic methods fail
    this.aiGuarantor = getAIStepGuarantor({
      enabled: ctx.enableAIFallback !== false,
      enableDomResolver: true,
      enableVisionFallback: true,
      enableVerification: true,
      enableAutoCorrection: true,
      maxAICallsPerRun: ctx.maxAICallsPerRun || 15,
      debug: true,
    });
  }

  /**
   * Execute an action using the simplified pipeline.
   * 
   * For element-interaction actions: SimpleElementFinder → healing → iframe → AI
   * For everything else: delegate to existing handlers unchanged
   * 
   * @param {object} action - The action object
   * @returns {Promise<{success: boolean, error?: string, workingSelector?: string, strategyType?: string, healed?: boolean, newSelector?: string}>}
   */
  async executeAction(action) {
    if (!this.ctx.page || this.ctx.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }

    const actionType = (action.type || action.qword || '').toLowerCase().replace(/[-_ ]/g, '');

    // ══════════════════════════════════════════════════════════════
    // IMPLICIT TAB SWITCHING — must happen for ALL actions
    // Same logic as executeAction in playwright-recorder.js
    // ══════════════════════════════════════════════════════════════
    if (action.tabIndex !== undefined && action.type !== 'switchTab' && action.type !== 'newTab') {
      const pages = this.ctx.context?.pages() || [];
      const targetTabIndex = action.tabIndex;
      if (targetTabIndex >= 0 && targetTabIndex < pages.length) {
        const targetPage = pages[targetTabIndex];
        if (targetPage && !targetPage.isClosed() && targetPage !== this.ctx.page) {
          console.log(`[SimpleStepExecutor] Implicit tab switch: ${targetTabIndex}`);
          this.ctx.page = targetPage;
          if (this.ctx.smartFinder) {
            this.ctx.smartFinder.updatePage(this.ctx.page);
          }
        }
      }
    }
    
    // ══════════════════════════════════════════════════════════════
    // NON-ELEMENT ACTIONS: Delegate to existing handlers unchanged
    // This includes: navigate, wait, press, tab management, SF helpers,
    // PWA, comprehensive UI, assertions, etc.
    // ══════════════════════════════════════════════════════════════
    if (DELEGATED_ACTIONS.has(actionType) || !ELEMENT_ACTIONS.has(actionType)) {
      // Use the existing executeAction on the recorder context
      // This preserves ALL existing behavior for non-element actions
      return await this.ctx.executeAction(action);
    }

    // ══════════════════════════════════════════════════════════════
    // ELEMENT-INTERACTION ACTIONS: Use SimpleElementFinder
    // ══════════════════════════════════════════════════════════════
    const isFill = ['fill', 'type', 'input'].includes(actionType);
    const isCheck = ['check', 'uncheck'].includes(actionType);
    const isHover = actionType === 'hover';
    const isDblClick = ['dblclick', 'doubleclick'].includes(actionType);
    const isRightClick = ['rightclick', 'contextmenu'].includes(actionType);
    const isSelect = ['select', 'selectoption'].includes(actionType);
    const isClear = ['clear', 'clearfield'].includes(actionType);
    const isFocus = actionType === 'focus';
    const isBlur = actionType === 'blur';

    // Get iframe scope (same as current system)
    let scope;
    try {
      scope = await this.ctx._getFrameScope(action);
    } catch (e) {
      scope = this.ctx.page;
    }
    const isIframe = scope !== this.ctx.page;

    // Get position for disambiguation
    const position = action.elementIndex ?? 
                     (action.recipe?.which?.position) ?? 
                     (action.args?.[1]) ?? 
                     null;

    // ────────────────────────────────────────────────────────────
    // PHASE 1: SimpleElementFinder (parallel Playwright-native)
    // ────────────────────────────────────────────────────────────
    let findResult = await this.finder.find(scope, action, { isFill, position });
    
    let healed = false;
    let newSelector = null;
    const hadLockedSelector = !!getLockedSelector(action);

    // ────────────────────────────────────────────────────────────
    // PHASE 2: Healing — SmartFinder (only if SimpleElementFinder failed)
    // This is where the complex SF/shadow DOM/disambiguation logic runs
    // ────────────────────────────────────────────────────────────
    if (!findResult && this.ctx.smartFinder) {
      console.log('[SimpleStepExecutor] Phase 2: Healing with SmartFinder...');
      try {
        // Build recipe from action (same conversion as current system)
        const recipe = this._buildRecipeFromAction(action);
        if (recipe) {
          // Re-scope SmartFinder to correct page/frame
          const smartFinderTarget = isIframe ? scope : this.ctx.page;
          if (this.ctx.smartFinder.page !== smartFinderTarget) {
            const { SmartFinder } = require('./smart-finder');
            this.ctx.smartFinder = new SmartFinder(smartFinderTarget, { debug: true, timeout: 8000 });
          }
          
          const sfResult = await this.ctx.smartFinder.find(recipe);
          if (sfResult && sfResult.locator) {
            findResult = {
              locator: sfResult.locator,
              strategy: `healed-${sfResult.strategy || 'SmartFinder'}`,
              selector: this.ctx.smartFinder.lastSuccessfulSelector || sfResult.strategy || ''
            };
            // Mark as healed if we had a locked selector that failed
            if (hadLockedSelector) {
              healed = true;
              newSelector = findResult.selector;
            }
            console.log(`[SimpleStepExecutor] ✓ Healed via SmartFinder: ${findResult.strategy}`);
          }
        }
      } catch (e) {
        console.log(`[SimpleStepExecutor] SmartFinder healing failed: ${e.message}`);
      }
    }

    // ────────────────────────────────────────────────────────────
    // PHASE 3: iframe brute-force search (only if not found yet)
    // ────────────────────────────────────────────────────────────
    if (!findResult && !isIframe) {
      console.log('[SimpleStepExecutor] Phase 3: Searching iframes...');
      findResult = await this._searchIframes(action, isFill);
    }

    // ────────────────────────────────────────────────────────────
    // PHASE 4+5: AI Step Guarantor (DOM Resolver → Vision Fallback)
    // Replaces the old Phase 4 with a 2-tier AI pipeline:
    //   4.5: AI DOM Resolver (text LLM, returns real selectors)
    //   5:   AI Vision Fallback (screenshot, returns coordinates)
    // ────────────────────────────────────────────────────────────
    let aiResolved = AI_RESOLUTION.NONE;
    let aiDetails = null;
    
    if (!findResult) {
      console.log('[SimpleStepExecutor] Phase 4+5: AI Step Guarantor...');
      const recipe = this._buildRecipeFromAction(action);
      const aiResult = await this.aiGuarantor.resolveElement(this.ctx.page, action, {
        actionType,
        recipe,
        scope,
      });
      
      if (aiResult) {
        aiResolved = aiResult.aiResolved;
        aiDetails = aiResult.aiDetails;
        
        if (aiResult.coordinates) {
          // AI Vision found coordinates — execute directly with AI flags
          const coordResult = await this._executeWithCoordinates(aiResult.coordinates, action, actionType);
          return {
            ...coordResult,
            aiResolved,
            aiDetails,
          };
        } else if (aiResult.locator) {
          // AI DOM Resolver found a real locator — use it like a normal find
          findResult = {
            locator: aiResult.locator,
            strategy: aiResult.strategy,
            selector: aiResult.selector,
          };
          console.log(`[SimpleStepExecutor] ✓ AI found element: ${aiResult.strategy} → "${aiResult.selector}"`);
        }
      }
    }

    // ────────────────────────────────────────────────────────────
    // ELEMENT NOT FOUND — return failure (all phases exhausted)
    // ────────────────────────────────────────────────────────────
    if (!findResult) {
      const label = action.label || action.text || '';
      return { 
        success: false, 
        error: `Element not found: "${label}" (tried all strategies + AI)`,
        aiResolved: AI_RESOLUTION.NONE,
      };
    }

    // ────────────────────────────────────────────────────────────
    // PRE-ACTION: Capture state for post-action verification
    // ────────────────────────────────────────────────────────────
    const preState = await this.aiGuarantor.capturePreState(this.ctx.page, actionType);

    // ────────────────────────────────────────────────────────────
    // EXECUTE THE ACTION on the found element
    // ────────────────────────────────────────────────────────────
    const locator = findResult.locator;
    
    // Track for Lock Locators
    this.ctx._lastWorkingSelector = findResult.selector;
    this.ctx._lastStrategyType = findResult.strategy;

    let actionResult;
    try {
      if (isFill) {
        actionResult = await this._executeFill(locator, action, findResult, healed, newSelector);
      } else if (isSelect) {
        actionResult = await this._executeSelect(action, findResult, healed, newSelector);
      } else if (isCheck) {
        actionResult = await this._executeCheck(locator, action, actionType === 'uncheck', findResult, healed, newSelector);
      } else if (isDblClick) {
        await locator.dblclick({ timeout: 5000 });
        actionResult = this._successResult(findResult, healed, newSelector);
      } else if (isRightClick) {
        await locator.click({ button: 'right', timeout: 5000 });
        actionResult = this._successResult(findResult, healed, newSelector);
      } else if (isHover) {
        await locator.hover({ timeout: 5000 });
        actionResult = this._successResult(findResult, healed, newSelector);
      } else if (isClear) {
        await locator.clear({ timeout: 5000 });
        actionResult = this._successResult(findResult, healed, newSelector);
      } else if (isFocus) {
        await locator.focus({ timeout: 5000 });
        actionResult = this._successResult(findResult, healed, newSelector);
      } else if (isBlur) {
        await locator.evaluate(el => el.blur());
        actionResult = this._successResult(findResult, healed, newSelector);
      } else {
        // Default: click
        actionResult = await this._executeClick(locator, action, findResult, healed, newSelector);
      }
    } catch (actionError) {
      console.error(`[SimpleStepExecutor] Action execution failed: ${actionError.message}`);
      actionResult = { success: false, error: actionError.message };
    }

    // ────────────────────────────────────────────────────────────
    // POST-ACTION: AI Verification + Auto-Correction
    // Catches false positives and corrects them transparently
    // ────────────────────────────────────────────────────────────
    if (actionResult.success) {
      actionResult = await this.aiGuarantor.verifyAndCorrect(
        this.ctx.page, locator, action, actionType, preState, actionResult
      );
    }

    // Attach AI resolution flags
    if (aiResolved !== AI_RESOLUTION.NONE) {
      actionResult.aiResolved = actionResult.aiResolved || aiResolved;
      actionResult.aiDetails = actionResult.aiDetails || aiDetails;
    }
    
    // Track step in guarantor stats
    this.aiGuarantor.stats.stepsProcessed++;

    return actionResult;
  }

  // ════════════════════════════════════════════════════════════════
  // ACTION EXECUTORS
  // ════════════════════════════════════════════════════════════════

  /**
   * Execute a click with fallback methods (same cascade as current system).
   * Method 1: standard click → Method 2: force click → Method 3: JS click
   * Also handles new tab detection and link navigation after click.
   */
  async _executeClick(locator, action, findResult, healed, newSelector) {
    // Scroll into view
    try { await locator.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch (e) { /* ok */ }

    // Track pages before click for new tab detection
    const pagesBefore = this.ctx.context ? this.ctx.context.pages().length : 0;

    // Method 1: Standard Playwright click (handles actionability checks)
    let clickSuccess = false;
    try {
      await locator.click({ timeout: 5000 });
      clickSuccess = true;
    } catch (e1) {
      console.log(`[SimpleStepExecutor] Standard click failed: ${e1.message}, trying force...`);
    }

    // Method 2: Force click (bypasses actionability checks)
    if (!clickSuccess) {
      try {
        await locator.click({ timeout: 3000, force: true });
        clickSuccess = true;
      } catch (e2) {
        console.log(`[SimpleStepExecutor] Force click failed: ${e2.message}, trying JS click...`);
      }
    }

    // Method 3: JS click via evaluate
    if (!clickSuccess) {
      try {
        await locator.evaluate(el => el.click());
        clickSuccess = true;
      } catch (e3) {
        console.log(`[SimpleStepExecutor] JS click failed: ${e3.message}, trying dispatchEvent...`);
      }
    }

    // Method 4: dispatchEvent
    if (!clickSuccess) {
      try {
        await locator.dispatchEvent('click');
        clickSuccess = true;
      } catch (e4) {
        return { success: false, error: `All click methods failed on "${action.label || ''}"` };
      }
    }

    // ────────────────────────────────────────────────────────────
    // POST-CLICK: New tab detection (event-driven, fast)
    // Same logic as playwright-recorder.js but simplified
    // ────────────────────────────────────────────────────────────
    if (this.ctx.context) {
      try {
        const newTabPage = await this.ctx.context.waitForEvent('page', { timeout: 200 }).catch(() => null);
        const pagesAfter = this.ctx.context.pages();
        
        if (pagesAfter.length > pagesBefore && newTabPage) {
          console.log(`[SimpleStepExecutor] New tab detected after click — switching`);
          await newTabPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
          this.ctx.page = newTabPage;
          this.ctx._playbackPages = pagesAfter;
          this.ctx._playbackPageIndex = pagesAfter.length - 1;
          
          // Reinitialize SmartFinder for new page
          if (this.ctx.useSmartFinderForPlayback) {
            const { SmartFinder } = require('./smart-finder');
            this.ctx.smartFinder = new SmartFinder(this.ctx.page, { debug: true, timeout: 8000 });
          }
        }
      } catch (e) {
        // No new tab — normal case
      }
    }

    // ────────────────────────────────────────────────────────────
    // POST-CLICK: Check for link navigation (uses Playwright event, not fixed wait)
    // ────────────────────────────────────────────────────────────
    const isLink = (action.element?.tagName || '').toLowerCase() === 'a' || 
                   (action.selectorObj?.tagName || '').toLowerCase() === 'a' ||
                   (action.recipe?.what?.tag || '').toLowerCase() === 'a' ||
                   (action.selectorObj?.href);
    if (isLink) {
      try {
        // Wait for URL change (link navigation) — event-driven, resolves instantly on nav
        await this.ctx.page.waitForURL(/.*/, { timeout: 3000, waitUntil: 'domcontentloaded' });
      } catch (e) {
        // No navigation — possibly a JS-handled link, that's ok
      }
    }

    return this._successResult(findResult, healed, newSelector);
  }

  /**
   * Execute a fill action with contenteditable support.
   */
  async _executeFill(locator, action, findResult, healed, newSelector) {
    const value = action.value || action.args?.[1] || '';
    
    // Scroll into view
    try { await locator.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch (e) { /* ok */ }

    // Check if element is contenteditable (rich text editors)
    const isContentEditable = await locator.evaluate(el => {
      return el.contentEditable === 'true' || el.isContentEditable || 
             el.getAttribute('role') === 'textbox' ||
             el.classList?.contains('ql-editor') ||
             el.classList?.contains('slds-rich-text-area__content') ||
             el.classList?.contains('cke_editable') ||
             el.classList?.contains('ProseMirror') ||
             el.classList?.contains('tox-edit-area__iframe');
    }).catch(() => false);

    if (isContentEditable) {
      // Rich text editor: click to focus, then type
      try {
        await locator.click({ timeout: 2000 });
        await this.ctx.page.waitForTimeout(100); // Brief settle for focus
        // Select all + delete to clear
        await this.ctx.page.keyboard.press('Control+A');
        await this.ctx.page.keyboard.press('Delete');
        await this.ctx.page.keyboard.type(value);
        return this._successResult(findResult, healed, newSelector);
      } catch (e) {
        console.log(`[SimpleStepExecutor] Contenteditable fill failed: ${e.message}`);
      }
    }

    // Method 1: Standard Playwright fill
    try {
      await locator.fill(value, { timeout: 5000 });
      return this._successResult(findResult, healed, newSelector);
    } catch (e1) {
      console.log(`[SimpleStepExecutor] fill() failed: ${e1.message}, trying click+type...`);
    }

    // Method 2: Click to focus, clear, then type character by character
    try {
      await locator.click({ timeout: 2000 });
      // Triple-click to select all, then delete
      await locator.click({ clickCount: 3, timeout: 1000 });
      await this.ctx.page.keyboard.press('Delete');
      await locator.type(value, { timeout: 5000 });
      return this._successResult(findResult, healed, newSelector);
    } catch (e2) {
      console.log(`[SimpleStepExecutor] click+type failed: ${e2.message}, trying keyboard...`);
    }

    // Method 3: Focus + keyboard type
    try {
      await locator.focus({ timeout: 2000 });
      await this.ctx.page.keyboard.press('Control+A');
      await this.ctx.page.keyboard.press('Delete');
      await this.ctx.page.keyboard.type(value);
      return this._successResult(findResult, healed, newSelector);
    } catch (e3) {
      return { success: false, error: `All fill methods failed for "${action.label || ''}"` };
    }
  }

  /**
   * Execute a select action. 
   * Select is complex (native dropdowns, custom dropdowns, Radix, etc.)
   * so we delegate to the existing handler but pass the found element.
   */
  async _executeSelect(action, findResult, healed, newSelector) {
    // For select, the existing ActionHandlers.handleSelect already handles
    // native <select>, Radix, custom dropdowns, etc.
    // Let the existing handler do its work, which includes its own element finding
    // BUT we set _lastWorkingSelector so Lock Locators captures it.
    const ActionHandlers = require('./action-handlers');
    const result = await ActionHandlers.executeAction(this.ctx, action, { timeout: action.timeout || 30000 });
    
    if (result.success) {
      return {
        ...result,
        workingSelector: result.workingSelector || findResult.selector,
        strategyType: result.strategyType || findResult.strategy,
        healed,
        newSelector,
      };
    }
    return result;
  }

  /**
   * Execute a check/uncheck action with state verification.
   */
  async _executeCheck(locator, action, shouldUncheck, findResult, healed, newSelector) {
    try {
      if (shouldUncheck) {
        await locator.uncheck({ timeout: 5000 });
      } else {
        await locator.check({ timeout: 5000 });
      }
      return this._successResult(findResult, healed, newSelector);
    } catch (e) {
      // Fallback: click the element (some custom checkboxes don't support check/uncheck)
      try {
        await locator.click({ timeout: 3000 });
        return this._successResult(findResult, healed, newSelector);
      } catch (e2) {
        return { success: false, error: `Check/uncheck failed: ${e2.message}` };
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // IFRAME SEARCH
  // ════════════════════════════════════════════════════════════════

  /**
   * Search all iframes on the page for the target element.
   * Same logic as current searchIframesForClick but uses SimpleElementFinder.
   */
  async _searchIframes(action, isFill) {
    try {
      const iframeCount = await this.ctx.page.locator('iframe').count();
      if (iframeCount === 0) return null;

      console.log(`[SimpleStepExecutor] Searching ${iframeCount} iframes...`);
      
      for (let i = 0; i < Math.min(iframeCount, 10); i++) {
        try {
          const frameLocator = this.ctx.page.frameLocator(`iframe >> nth=${i}`);
          const result = await this.finder.find(frameLocator, action, { 
            isFill, 
            // Use shorter timeouts for iframe scanning
          });
          if (result) {
            console.log(`[SimpleStepExecutor] ✓ Found in iframe[${i}] via ${result.strategy}`);
            return result;
          }
        } catch (e) {
          // Cross-origin iframe or other error — skip
          continue;
        }
      }
    } catch (e) {
      console.log(`[SimpleStepExecutor] iframe search error: ${e.message}`);
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════
  // AI VISION COORDINATE CLICK
  // ════════════════════════════════════════════════════════════════

  async _executeWithCoordinates(aiResult, action, actionType) {
    try {
      const { x, y } = aiResult;
      if (actionType.includes('fill')) {
        await this.ctx.page.mouse.click(x, y);
        await this.ctx.page.waitForTimeout(200);
        const value = action.value || action.args?.[1] || '';
        await this.ctx.page.keyboard.type(value);
      } else {
        await this.ctx.page.mouse.click(x, y);
      }
      return { 
        success: true, 
        workingSelector: `coords:${x},${y}`,
        strategyType: 'ai-vision',
      };
    } catch (e) {
      return { success: false, error: `AI vision click failed: ${e.message}` };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════

  /**
   * Build an ElementRecipe from an action object for SmartFinder healing.
   */
  _buildRecipeFromAction(action) {
    const so = action.selectorObj || {};
    const element = action.element || {};
    const existingRecipe = action.recipe;

    if (existingRecipe && existingRecipe.what) {
      return existingRecipe;
    }

    // Construct a recipe from available data
    const text = so.text || action.label || action.text || element.text || action.args?.[0] || '';
    const role = so.role || element.role || '';
    const tagName = (so.tagName || element.tagName || '').toLowerCase();

    return {
      what: {
        role: role || tagName || '',
        text: text,
        tag: tagName || '',
        type: element.type || '',
      },
      where: {
        nearText: action.recipe?.where?.nearText || '',
        within: action.recipe?.where?.within || '',
        landmark: action.recipe?.where?.landmark || '',
        relatedList: action.recipe?.where?.relatedList || '',
        componentName: action.recipe?.where?.componentName || '',
      },
      which: {
        testId: so.testId || element.testId || '',
        id: so.id || element.id || '',
        name: so.name || element.name || '',
        ariaLabel: so.ariaLabel || element.ariaLabel || '',
        placeholder: so.placeholder || element.placeholder || '',
        title: so.title || element.title || '',
        position: action.elementIndex || action.recipe?.which?.position || null,
        href: so.href || element.href || '',
      },
      confirm: {
        cssSelector: so.selector || so.primary || '',
        boundingBox: action.boundingBox || action.recipe?.confirm?.boundingBox || null,
      }
    };
  }

  /**
   * Build a standard success result object compatible with Lock Locators.
   */
  _successResult(findResult, healed = false, newSelector = null) {
    return {
      success: true,
      workingSelector: findResult.selector || null,
      strategyType: findResult.strategy || null,
      healed,
      newSelector,
    };
  }
}

module.exports = { SimpleStepExecutor };
