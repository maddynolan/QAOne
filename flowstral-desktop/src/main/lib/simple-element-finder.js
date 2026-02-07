/**
 * SimpleElementFinder — Playwright-native element finding with parallel racing.
 * 
 * DESIGN PRINCIPLES:
 * 1. Use Playwright's auto-wait (waitFor) instead of manual count()+isVisible() snapshots
 * 2. Race multiple strategies in parallel instead of sequential waterfall
 * 3. Only fall back to complex healing (SmartFinder) when ALL locators fail
 * 4. Every strategy tried exactly ONCE — no duplicate work across layers
 * 
 * WHAT THIS REPLACES:
 * - Quick Scan layer (8-11 sequential strategies with 250ms race each)
 * - The manual count()+isVisible() pattern in _findElement()
 * - The 300ms DOM stability wait (Playwright's waitFor handles this)
 * 
 * WHAT THIS DOES NOT REPLACE (kept as-is):
 * - SmartFinder (used only for HEALING when all locators fail)
 * - Tab switching, iframe scoping, dialog handling
 * - Action-specific handlers (SF helpers, drag-drop, etc.)
 * - Lock Locators / self-healing / workingSelector tracking
 * 
 * PERFORMANCE:
 * - Happy path: ~20-100ms (Playwright resolves locator instantly when element exists)
 * - Element appears after delay: Playwright auto-wait polls until visible (no manual retry)
 * - All locators fail: ~3s (tier1) + ~5s (tier2) = 8s worst case, then healing
 * - Current system: ~1100ms happy path, ~15s+ worst case
 */

const { getManualOverrideSelector, getLockedSelector } = require('./override-and-locked');

// Dynamic ID patterns — IDs matching these are unreliable and should be skipped
const DYNAMIC_ID_PATTERNS = [
  /^[a-f0-9]{8,}/,           // UUID-like
  /^\d{6,}/,                 // Long numbers
  /^:r[a-z0-9]+:/,           // React IDs
  /^ember\d+/,               // Ember IDs
  /^ng-/,                    // Angular IDs
  /^vue-/,                   // Vue IDs
  /^aura_/,                  // Salesforce Aura
  /^lwc-/,                   // Salesforce LWC
  /^radix-/,                 // Radix UI
  /^headlessui-/,            // Headless UI
  /^downshift-/,             // Downshift
  /^rc[-_]/,                 // Ant Design / rc-components
  /^react-select-/,          // React Select
  /^mui-/,                   // Material UI
  /^chakra-/,                // Chakra UI
];

class SimpleElementFinder {
  /**
   * @param {object} options
   * @param {number} options.tier1Timeout - Timeout for top-priority strategies (ms). Default: 3000
   * @param {number} options.tier2Timeout - Timeout for remaining strategies (ms). Default: 5000
   * @param {boolean} options.debug - Enable verbose logging. Default: false
   */
  constructor(options = {}) {
    this.tier1Timeout = options.tier1Timeout || 3000;
    this.tier2Timeout = options.tier2Timeout || 5000;
    this.debug = options.debug || false;
    
    // Tracking for Lock Locators compatibility
    this.lastSuccessfulSelector = null;
    this.lastSuccessfulStrategy = null;
  }

  /**
   * Find an element using Playwright-native locators with auto-wait.
   * Generates strategies from action data, races them in parallel tiers.
   * 
   * @param {import('playwright').Page|import('playwright').FrameLocator} scope - Page or frame to search in
   * @param {object} action - The action object with selectorObj, recipe, element, etc.
   * @param {object} options
   * @param {boolean} options.isFill - True for fill actions (changes strategy priority)
   * @param {number} options.position - 1-based position for disambiguation (e.g., 3rd "New" button)
   * @returns {Promise<{locator: import('playwright').Locator, strategy: string, selector: string}|null>}
   */
  async find(scope, action, options = {}) {
    const { isFill = false, position = null } = options;
    const startTime = Date.now();
    
    // Reset tracking
    this.lastSuccessfulSelector = null;
    this.lastSuccessfulStrategy = null;

    // Generate all strategies from the action data
    const allStrategies = this._generateStrategies(scope, action, { isFill });
    
    if (allStrategies.length === 0) {
      this._log('No strategies generated from action data');
      return null;
    }

    this._log(`Generated ${allStrategies.length} strategies: [${allStrategies.map(s => s.name).join(', ')}]`);

    // Split into tiers for parallel racing:
    // Tier 1: High-confidence strategies (manual, locked, testId, role+text, ariaLabel)
    // Tier 2: Medium-confidence strategies (text, name, id, css, placeholder, title, href)
    const tier1 = allStrategies.filter(s => s.tier === 1);
    const tier2 = allStrategies.filter(s => s.tier === 2);

    // ══════════════════════════════════════════════════════════
    // TIER 1: Race top strategies in parallel (3s budget)
    // These are the most reliable — one of them almost always works
    // ══════════════════════════════════════════════════════════
    if (tier1.length > 0) {
      this._log(`Tier 1: Racing ${tier1.length} strategies (${this.tier1Timeout}ms budget)...`);
      const winner = await this._raceTier(tier1, this.tier1Timeout, position);
      if (winner) {
        const elapsed = Date.now() - startTime;
        this._log(`✓ Found via ${winner.strategy} in ${elapsed}ms (Tier 1)`);
        this.lastSuccessfulSelector = winner.selector;
        this.lastSuccessfulStrategy = winner.strategy;
        return winner;
      }
      this._log(`Tier 1: No match (${Date.now() - startTime}ms)`);
    }

    // ══════════════════════════════════════════════════════════
    // TIER 2: Race remaining strategies in parallel (5s budget)
    // Fallback strategies — less reliable but still deterministic
    // ══════════════════════════════════════════════════════════
    if (tier2.length > 0) {
      this._log(`Tier 2: Racing ${tier2.length} strategies (${this.tier2Timeout}ms budget)...`);
      const winner = await this._raceTier(tier2, this.tier2Timeout, position);
      if (winner) {
        const elapsed = Date.now() - startTime;
        this._log(`✓ Found via ${winner.strategy} in ${elapsed}ms (Tier 2)`);
        this.lastSuccessfulSelector = winner.selector;
        this.lastSuccessfulStrategy = winner.strategy;
        return winner;
      }
      this._log(`Tier 2: No match (${Date.now() - startTime}ms)`);
    }

    // All deterministic strategies failed
    const elapsed = Date.now() - startTime;
    this._log(`✗ All ${allStrategies.length} strategies failed (${elapsed}ms total)`);
    return null;
  }

  /**
   * Race multiple strategies in parallel using Playwright's native auto-wait.
   * Uses Promise.any() — first visible match wins, rest are abandoned.
   * 
   * @param {Array} strategies - [{name, locator, selector, tier}]
   * @param {number} timeout - Max time to wait (ms)
   * @param {number|null} position - 1-based position for disambiguation
   * @returns {Promise<{locator, strategy, selector}|null>}
   */
  async _raceTier(strategies, timeout, position = null) {
    if (strategies.length === 0) return null;

    try {
      // Promise.any resolves as soon as ANY strategy finds a visible element.
      // The rest are left to time out and are garbage collected.
      // This is the key performance win: instead of trying strategies one-by-one
      // (250ms each × 8 = 2s), we try them all simultaneously (~50ms for the winner).
      const result = await Promise.any(
        strategies.map(s => this._tryStrategy(s, timeout, position))
      );
      return result;
    } catch (e) {
      // AggregateError: all strategies rejected (element not found in any)
      return null;
    }
  }

  /**
   * Try a single strategy using Playwright's native auto-wait.
   * Uses waitFor({state:'visible'}) which internally polls — NOT a snapshot check.
   * 
   * @param {object} strategy - {name, locator, selector}
   * @param {number} timeout - Max wait time (ms)
   * @param {number|null} position - 1-based position for disambiguation
   * @returns {Promise<{locator, strategy, selector}>} - Rejects if not found
   */
  async _tryStrategy(strategy, timeout, position = null) {
    const { name, locator, selector } = strategy;
    
    try {
      // Handle position disambiguation: if position is set and >1, 
      // use nth(position-1) to pick the correct one among duplicates
      let targetLocator = locator;
      if (position && position > 1) {
        // Check if there are multiple matches
        const count = await targetLocator.count();
        if (count >= position) {
          targetLocator = targetLocator.nth(position - 1);
        }
      }

      // Use Playwright's native waitFor — this POLLS internally until visible.
      // Unlike count() which is an instant snapshot, waitFor retries automatically.
      // This means if an element appears 500ms after a navigation, waitFor catches it.
      await targetLocator.first().waitFor({ state: 'visible', timeout });

      // Element is visible! Return it.
      return { 
        locator: targetLocator.first(), 
        strategy: name, 
        selector: selector || name
      };
    } catch (e) {
      // Throw to signal this strategy failed (Promise.any needs rejection)
      throw new Error(`${name}: not found`);
    }
  }

  /**
   * Generate ranked strategies from action data.
   * Priority order:
   *   Tier 1 (high confidence): manual → locked → testId → role+text → ariaLabel/label → placeholder
   *   Tier 2 (medium confidence): text → name → title → id → css → href
   * 
   * @param {import('playwright').Page|import('playwright').FrameLocator} scope
   * @param {object} action
   * @param {object} options - {isFill: boolean}
   * @returns {Array<{name: string, locator: import('playwright').Locator, selector: string, tier: number}>}
   */
  _generateStrategies(scope, action, options = {}) {
    const { isFill = false } = options;
    const strategies = [];
    
    const so = action.selectorObj || {};
    const recipe = action.recipe || {};
    const what = recipe.what || {};
    const which = recipe.which || {};
    const confirm = recipe.confirm || {};
    const element = action.element || {};

    // Extract text from multiple sources (same as current system)
    const text = what.text || so.text || action.label || action.text || 
                 element.text || action.args?.[0] || '';
    const role = what.role || so.role || element.role || '';
    const tagName = (what.tag || so.tagName || element.tagName || '').toLowerCase();

    // ──────────────────────────────────────────────────────────
    // TIER 1: High-confidence strategies (parallel raced first)
    // ──────────────────────────────────────────────────────────

    // 1. Manual Override — user-specified selector, HIGHEST priority
    const manualOverride = getManualOverrideSelector(action);
    if (manualOverride) {
      strategies.push({
        name: 'manual-override',
        locator: scope.locator(manualOverride),
        selector: manualOverride,
        tier: 1
      });
    }

    // 2. Locked/Optimized Selector — proven to work from previous run
    const lockedSelector = getLockedSelector(action);
    if (lockedSelector) {
      // Parse role=xxx[name="yyy"] format used by Lock Locators
      const locator = this._parseLocatorString(scope, lockedSelector);
      if (locator) {
        strategies.push({
          name: 'locked-selector',
          locator,
          selector: lockedSelector,
          tier: 1
        });
      }
    }

    // 3. data-testid — most stable across deploys
    const testId = which.testId || so.testId || element.testId || '';
    if (testId) {
      strategies.push({
        name: 'testId',
        locator: scope.getByTestId(testId),
        selector: `[data-testid="${testId}"]`,
        tier: 1
      });
    }

    // 4. Role + Text — Playwright's recommended approach, pierces shadow DOM
    if (role && text) {
      // Normalize role for Playwright (lowercase)
      const pwRole = role.toLowerCase();
      // Only use valid ARIA roles that Playwright supports
      const validRoles = [
        'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'textbox',
        'combobox', 'option', 'heading', 'cell', 'row', 'listitem', 'treeitem',
        'switch', 'slider', 'spinbutton', 'searchbox', 'img', 'navigation',
        'dialog', 'alert', 'alertdialog', 'menu', 'menubar', 'tablist',
        'list', 'grid', 'table', 'toolbar', 'banner', 'complementary',
        'contentinfo', 'form', 'main', 'region', 'separator', 'group',
        'progressbar', 'status', 'tooltip', 'figure', 'article', 'log',
        'marquee', 'math', 'note', 'timer', 'definition', 'term',
        'directory', 'document', 'feed', 'columnheader', 'rowheader',
        'rowgroup', 'gridcell', 'treegrid', 'presentation', 'none'
      ];
      if (validRoles.includes(pwRole)) {
        strategies.push({
          name: 'role+text',
          locator: scope.getByRole(pwRole, { name: text }),
          selector: `role=${pwRole}[name="${text}"]`,
          tier: 1
        });

        // Also try with flexible matching (handles apostrophe variants, case differences)
        if (text.includes("'") || text.includes("'") || text.includes("'")) {
          const flexText = text.replace(/[''ʼ]/g, "[''ʼ]");
          try {
            strategies.push({
              name: 'role+text-flex',
              locator: scope.getByRole(pwRole, { name: new RegExp(flexText, 'i') }),
              selector: `role=${pwRole}[name=/${flexText}/i]`,
              tier: 1
            });
          } catch (e) { /* invalid regex — skip */ }
        }
      }
    }

    // 5. aria-label (Playwright getByLabel — also pierces shadow DOM)
    const ariaLabel = which.ariaLabel || so.ariaLabel || element.ariaLabel || '';
    if (ariaLabel) {
      strategies.push({
        name: 'aria-label',
        locator: scope.getByLabel(ariaLabel),
        selector: `[aria-label="${ariaLabel}"]`,
        tier: 1
      });
    }

    // 6. Placeholder (strong signal for inputs)
    const placeholder = which.placeholder || so.placeholder || element.placeholder || '';
    if (placeholder && isFill) {
      strategies.push({
        name: 'placeholder',
        locator: scope.getByPlaceholder(placeholder),
        selector: `[placeholder="${placeholder}"]`,
        tier: 1  // Tier 1 for fill actions since placeholder is very reliable
      });
    } else if (placeholder) {
      strategies.push({
        name: 'placeholder',
        locator: scope.getByPlaceholder(placeholder),
        selector: `[placeholder="${placeholder}"]`,
        tier: 2
      });
    }

    // ──────────────────────────────────────────────────────────
    // TIER 2: Medium-confidence strategies (tried if Tier 1 fails)
    // ──────────────────────────────────────────────────────────

    // 7. Text content — common but can match multiple elements
    if (text && text.length > 1 && text.length < 200) {
      strategies.push({
        name: 'text-exact',
        locator: scope.getByText(text, { exact: true }),
        selector: `text="${text}"`,
        tier: 2
      });
    }

    // 8. Title attribute
    const title = which.title || so.title || element.title || '';
    if (title) {
      strategies.push({
        name: 'title',
        locator: scope.getByTitle(title),
        selector: `[title="${title}"]`,
        tier: 2
      });
    }

    // 9. Name attribute (form elements)
    const name = which.name || so.name || element.name || '';
    if (name) {
      strategies.push({
        name: 'name-attr',
        locator: scope.locator(`[name="${name}"]`),
        selector: `[name="${name}"]`,
        tier: isFill ? 1 : 2  // Tier 1 for fills since name is very reliable for form elements
      });
    }

    // 10. ID (if not dynamic)
    const id = which.id || so.id || element.id || '';
    if (id && !this._isDynamicId(id)) {
      // Escape special characters for CSS selector (Node.js doesn't have CSS.escape)
      const escapedId = id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
      strategies.push({
        name: 'id',
        locator: scope.locator(`#${escapedId}`),
        selector: `#${id}`,
        tier: 2
      });
    }

    // 11. CSS selector from recording
    const cssSelector = confirm.cssSelector || so.selector || so.primary || '';
    if (cssSelector && cssSelector.length > 0 && !cssSelector.startsWith('text=')) {
      strategies.push({
        name: 'css-recorded',
        locator: scope.locator(cssSelector),
        selector: cssSelector,
        tier: 2
      });
    }

    // 12. Playwright selector from recording
    const playwrightSelector = so.playwright || '';
    if (playwrightSelector && playwrightSelector !== cssSelector) {
      // Parse "getByRole('button', { name: 'Submit' })" format is already handled by role+text above
      // Only add if it's a locator() string that wasn't already added
      if (playwrightSelector.startsWith('locator(') || playwrightSelector.includes('[data-')) {
        try {
          const selectorStr = playwrightSelector.replace(/^locator\(['"]/, '').replace(/['"]\)$/, '');
          strategies.push({
            name: 'playwright-recorded',
            locator: scope.locator(selectorStr),
            selector: selectorStr,
            tier: 2
          });
        } catch (e) { /* invalid selector — skip */ }
      }
    }

    // 13. Href (for links)
    const href = which.href || confirm.href || so.href || element.href || '';
    if (href && (role === 'link' || tagName === 'a')) {
      strategies.push({
        name: 'href',
        locator: scope.locator(`a[href="${href}"]`),
        selector: `a[href="${href}"]`,
        tier: 2
      });
    }

    // Deduplicate: remove strategies with identical selectors
    const seen = new Set();
    return strategies.filter(s => {
      const key = s.selector;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Parse a locked selector string into a Playwright locator.
   * Handles formats:
   *   - role=button[name="Submit"] → scope.getByRole('button', {name: 'Submit'})
   *   - text="Submit"              → scope.getByText('Submit')
   *   - [data-testid="xyz"]       → scope.getByTestId('xyz')
   *   - Regular CSS selector       → scope.locator(selector)
   */
  _parseLocatorString(scope, selectorStr) {
    if (!selectorStr || typeof selectorStr !== 'string') return null;

    try {
      // role=button[name="Submit"]
      const roleMatch = selectorStr.match(/^role=(\w+)\[name="(.+?)"\]$/);
      if (roleMatch) {
        return scope.getByRole(roleMatch[1], { name: roleMatch[2] });
      }

      // text="Submit" or text=Submit
      const textMatch = selectorStr.match(/^text="(.+?)"$/) || selectorStr.match(/^text=(.+)$/);
      if (textMatch) {
        return scope.getByText(textMatch[1], { exact: true });
      }

      // [data-testid="xyz"]
      const testIdMatch = selectorStr.match(/\[data-testid="(.+?)"\]/);
      if (testIdMatch) {
        return scope.getByTestId(testIdMatch[1]);
      }

      // getByLabel("...")
      const labelMatch = selectorStr.match(/^getByLabel\("(.+?)"\)$/);
      if (labelMatch) {
        return scope.getByLabel(labelMatch[1]);
      }

      // Anything else — treat as CSS/Playwright selector
      return scope.locator(selectorStr);
    } catch (e) {
      this._log(`Failed to parse selector "${selectorStr}": ${e.message}`);
      return null;
    }
  }

  /**
   * Check if an ID looks dynamically generated (unreliable for playback).
   */
  _isDynamicId(id) {
    if (!id) return true;
    return DYNAMIC_ID_PATTERNS.some(pattern => pattern.test(id));
  }

  /**
   * CSS.escape polyfill for Node.js (Playwright runs in Node, not browser).
   * Escapes special characters in CSS selectors.
   */
  _cssEscape(str) {
    // Use global CSS.escape if available (won't be in Node)
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(str);
    // Simple escape for common cases
    return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  _log(msg) {
    if (this.debug) {
      console.log(`[SimpleElementFinder] ${msg}`);
    }
  }
}

module.exports = { SimpleElementFinder };
