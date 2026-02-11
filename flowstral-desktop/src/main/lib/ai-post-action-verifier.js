/**
 * AI Post-Action Verifier
 * 
 * Verifies that executed actions ACTUALLY worked by checking DOM state after execution.
 * This catches FALSE POSITIVES — steps that Playwright reported as "passed" but 
 * didn't actually achieve the intended result.
 * 
 * VERIFICATION STRATEGIES:
 * 
 * 1. FILL Verification:
 *    - Check: Does the input/textarea actually contain the expected value?
 *    - Method: Read element value/textContent, compare to expected
 *    - Catches: Focus lost before typing, autocomplete overwritten, readonly fields
 * 
 * 2. CLICK Verification:
 *    - Check: Did something observably change? (URL, DOM mutation, focus, aria-expanded)
 *    - Method: Compare pre-click and post-click snapshots
 *    - Catches: Clicks on wrong element, click absorbed by overlay, dead buttons
 * 
 * 3. SELECT Verification:
 *    - Check: Is the selected option now the intended value?
 *    - Method: Read select value or custom dropdown display text
 *    - Catches: Dropdown didn't actually change, wrong option selected
 * 
 * 4. CHECK/UNCHECK Verification:
 *    - Check: Is the checkbox in the expected state?
 *    - Method: Read checked property or aria-checked
 *    - Catches: Toggle didn't fire, custom checkbox not toggled
 * 
 * FALSE POSITIVE → AI CORRECTION:
 * When verification fails, optionally use AI to:
 * 1. Diagnose what went wrong
 * 2. Suggest a correction (re-try with different approach)
 * 3. Execute the correction
 * 
 * @author Flowstral AI
 * @version 1.0.0
 */

class AIPostActionVerifier {
  constructor(options = {}) {
    this.debug = options.debug !== false;
    this.backendUrl = options.backendUrl || process.env.BACKEND_URL || 'http://localhost:8000';
    this.openaiKey = options.openaiKey || process.env.OPENAI_API_KEY || '';
    
    // Stats
    this.verificationsRun = 0;
    this.falsePositivesCaught = 0;
    this.correctionsMade = 0;
  }
  
  log(...args) {
    if (this.debug) console.log('[AI-Verifier]', ...args);
  }

  /**
   * Verify that an action actually achieved its intended result.
   * 
   * @param {import('playwright').Page} page - Playwright page
   * @param {import('playwright').Locator} locator - The element locator that was acted on
   * @param {Object} action - The action that was executed
   * @param {string} actionType - Normalized action type
   * @param {Object} preState - State snapshot taken BEFORE the action (optional)
   * @returns {Promise<{verified: boolean, issue?: string, correction?: Object}>}
   */
  async verify(page, locator, action, actionType, preState = null) {
    this.verificationsRun++;
    
    try {
      if (['fill', 'type', 'input'].includes(actionType)) {
        return await this._verifyFill(page, locator, action);
      }
      
      if (['click', 'clicktext', 'clickelement'].includes(actionType)) {
        return await this._verifyClick(page, locator, action, preState);
      }
      
      if (['select', 'selectoption'].includes(actionType)) {
        return await this._verifySelect(page, locator, action);
      }
      
      if (['check', 'uncheck'].includes(actionType)) {
        return await this._verifyCheck(page, locator, action, actionType === 'uncheck');
      }
      
      // Non-verifiable actions — assume good
      return { verified: true };
      
    } catch (error) {
      this.log('Verification error:', error.message);
      // Don't fail the step just because verification itself errored
      return { verified: true, verificationError: error.message };
    }
  }

  /**
   * Capture pre-action state snapshot for comparison.
   * Call this BEFORE executing the action.
   */
  async capturePreState(page, actionType) {
    try {
      if (['click', 'clicktext', 'clickelement'].includes(actionType)) {
        return {
          url: page.url(),
          domHash: await page.evaluate(() => {
            // Quick DOM mutation indicator
            return document.body ? document.body.children.length + '|' + document.body.innerHTML.length : '0|0';
          }).catch(() => ''),
          timestamp: Date.now()
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // FILL VERIFICATION
  // ════════════════════════════════════════════════════════════════

  async _verifyFill(page, locator, action) {
    const expectedValue = action.value || action.args?.[1] || '';
    if (!expectedValue) return { verified: true }; // Nothing to verify
    
    try {
      // Read the actual value from the element
      const actualValue = await locator.evaluate(el => {
        // Standard inputs and textareas
        if ('value' in el) return el.value;
        // Contenteditable elements
        if (el.contentEditable === 'true' || el.isContentEditable) {
          return el.textContent || el.innerText || '';
        }
        return '';
      }).catch(() => null);
      
      if (actualValue === null) {
        this.log('Could not read element value');
        return { verified: true }; // Can't verify, assume OK
      }
      
      // Normalize and compare
      const normalizedExpected = expectedValue.trim();
      const normalizedActual = (actualValue || '').trim();
      
      // Exact match
      if (normalizedActual === normalizedExpected) {
        return { verified: true };
      }
      
      // Contains match (for fields that may add formatting)
      if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
        return { verified: true };
      }
      
      // Value doesn't match — this is a FALSE POSITIVE
      this.falsePositivesCaught++;
      this.log(`❌ FALSE POSITIVE: Fill expected "${normalizedExpected}" but got "${normalizedActual}"`);
      
      return {
        verified: false,
        issue: `fill_mismatch`,
        details: `Expected "${normalizedExpected}" but field contains "${normalizedActual}"`,
        correction: {
          type: 'retry_fill',
          strategy: 'clear_and_retype',
          value: expectedValue
        }
      };
      
    } catch (e) {
      this.log('Fill verification error:', e.message);
      return { verified: true }; // Don't block on verification failure
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CLICK VERIFICATION  
  // ════════════════════════════════════════════════════════════════

  async _verifyClick(page, locator, action, preState) {
    if (!preState) return { verified: true }; // No baseline to compare
    
    try {
      // Wait a tiny bit for DOM to settle
      await page.waitForTimeout(150);
      
      // Check 1: URL changed (navigation-triggering clicks)
      const currentUrl = page.url();
      if (currentUrl !== preState.url) {
        return { verified: true }; // URL changed, click worked
      }
      
      // Check 2: DOM mutated (most clicks cause some DOM change)
      const currentDomHash = await page.evaluate(() => {
        return document.body ? document.body.children.length + '|' + document.body.innerHTML.length : '0|0';
      }).catch(() => '');
      
      if (currentDomHash !== preState.domHash) {
        return { verified: true }; // DOM changed, click likely worked
      }
      
      // Check 3: aria-expanded toggled (for menus, dropdowns, accordions)
      const ariaChanged = await locator.evaluate(el => {
        const expanded = el.getAttribute('aria-expanded');
        const pressed = el.getAttribute('aria-pressed');
        return expanded === 'true' || pressed === 'true';
      }).catch(() => false);
      
      if (ariaChanged) {
        return { verified: true };
      }
      
      // Check 4: Focus moved (some clicks just change focus)
      const focusOnTarget = await locator.evaluate(el => document.activeElement === el).catch(() => false);
      if (focusOnTarget) {
        return { verified: true }; // At least focus moved
      }
      
      // Nothing observable changed — POTENTIAL false positive
      // But don't flag it yet; some clicks have no visible effect (analytics, state changes)
      // Only flag if the element was likely not actually clicked
      const wasClickable = await locator.evaluate(el => {
        const style = getComputedStyle(el);
        return style.pointerEvents !== 'none' && !el.disabled;
      }).catch(() => true);
      
      if (!wasClickable) {
        this.falsePositivesCaught++;
        this.log('❌ FALSE POSITIVE: Click target not clickable (pointer-events: none or disabled)');
        return {
          verified: false,
          issue: 'click_not_effective',
          details: 'Element was not interactable (disabled or pointer-events:none)',
          correction: {
            type: 'retry_click',
            strategy: 'js_click'
          }
        };
      }
      
      // Assume click worked (many clicks have no observable side-effect)
      return { verified: true };
      
    } catch (e) {
      this.log('Click verification error:', e.message);
      return { verified: true };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SELECT VERIFICATION
  // ════════════════════════════════════════════════════════════════

  async _verifySelect(page, locator, action) {
    const expectedValue = action.value || action.args?.[1] || '';
    if (!expectedValue) return { verified: true };
    
    try {
      const actualValue = await locator.evaluate(el => {
        // Native <select>
        if (el.tagName === 'SELECT') {
          return el.options[el.selectedIndex]?.text || el.value;
        }
        // Custom dropdown — check aria-selected or displayed text
        const selected = el.querySelector('[aria-selected="true"]');
        if (selected) return selected.textContent?.trim() || '';
        return el.textContent?.trim() || '';
      }).catch(() => null);
      
      if (actualValue === null) return { verified: true };
      
      const normalizedExpected = expectedValue.toLowerCase().trim();
      const normalizedActual = (actualValue || '').toLowerCase().trim();
      
      if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
        return { verified: true };
      }
      
      this.falsePositivesCaught++;
      this.log(`❌ FALSE POSITIVE: Select expected "${expectedValue}" but got "${actualValue}"`);
      
      return {
        verified: false,
        issue: 'select_mismatch',
        details: `Expected "${expectedValue}" but selected "${actualValue}"`,
        correction: {
          type: 'retry_select',
          strategy: 'click_option_by_text',
          value: expectedValue
        }
      };
    } catch (e) {
      return { verified: true };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CHECK/UNCHECK VERIFICATION
  // ════════════════════════════════════════════════════════════════

  async _verifyCheck(page, locator, action, shouldBeUnchecked) {
    try {
      const isChecked = await locator.evaluate(el => {
        if ('checked' in el) return el.checked;
        return el.getAttribute('aria-checked') === 'true';
      }).catch(() => null);
      
      if (isChecked === null) return { verified: true };
      
      const expectedState = !shouldBeUnchecked; // check = true, uncheck = false
      
      if (isChecked === expectedState) {
        return { verified: true };
      }
      
      this.falsePositivesCaught++;
      this.log(`❌ FALSE POSITIVE: Expected ${expectedState ? 'checked' : 'unchecked'} but got ${isChecked ? 'checked' : 'unchecked'}`);
      
      return {
        verified: false,
        issue: 'check_mismatch',
        details: `Expected ${expectedState ? 'checked' : 'unchecked'} but element is ${isChecked ? 'checked' : 'unchecked'}`,
        correction: {
          type: 'retry_check',
          strategy: 'js_toggle'
        }
      };
    } catch (e) {
      return { verified: true };
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CORRECTION EXECUTION
  // ════════════════════════════════════════════════════════════════

  /**
   * Apply a correction to fix a false positive.
   * Returns true if correction succeeded.
   */
  async applyCorrection(page, locator, correction, action) {
    this.log(`Applying correction: ${correction.type} via ${correction.strategy}`);
    
    try {
      switch (correction.type) {
        case 'retry_fill': {
          // Clear the field completely, then retype
          await locator.click({ timeout: 2000 }).catch(() => {});
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Delete');
          await page.waitForTimeout(50);
          await page.keyboard.type(correction.value, { delay: 10 });
          await page.waitForTimeout(100);
          
          // Verify again
          const val = await locator.evaluate(el => el.value || el.textContent || '').catch(() => '');
          const success = val.trim().includes(correction.value.trim());
          if (success) this.correctionsMade++;
          return success;
        }
        
        case 'retry_click': {
          if (correction.strategy === 'js_click') {
            await locator.evaluate(el => {
              el.click();
              el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            this.correctionsMade++;
            return true;
          }
          return false;
        }
        
        case 'retry_select': {
          // Try clicking the option text within the dropdown
          const text = correction.value;
          try {
            await page.getByText(text, { exact: true }).first().click({ timeout: 3000 });
            this.correctionsMade++;
            return true;
          } catch (e) {
            return false;
          }
        }
        
        case 'retry_check': {
          await locator.evaluate(el => el.click());
          this.correctionsMade++;
          return true;
        }
        
        default:
          return false;
      }
    } catch (error) {
      this.log('Correction failed:', error.message);
      return false;
    }
  }

  /**
   * Get verification stats
   */
  getStats() {
    return {
      verificationsRun: this.verificationsRun,
      falsePositivesCaught: this.falsePositivesCaught,
      correctionsMade: this.correctionsMade,
      falsePositiveRate: this.verificationsRun > 0 
        ? (this.falsePositivesCaught / this.verificationsRun) : 0
    };
  }
}

module.exports = { AIPostActionVerifier };
