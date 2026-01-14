/**
 * Smart Finder - Find elements using ElementRecipe
 * 
 * Uses a multi-phase approach:
 * 1. SCOPE - Narrow down the search area
 * 2. QUERY - Find candidates by what the element IS
 * 3. RESOLVE - Pick the right one if multiple matches
 * 4. FALLBACK - Try alternative strategies if needed
 * 
 * @author Flowstral
 * @version 2.0.0
 */

// ============================================================================
// SMART FINDER CLASS
// ============================================================================

class SmartFinder {
  constructor(page, options = {}) {
    this.page = page;
    this.timeout = options.timeout || 10000;
    this.debug = options.debug || false;
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[SmartFinder]', ...args);
    }
  }
  
  // ==========================================================================
  // MAIN FIND METHOD
  // ==========================================================================
  
  /**
   * Find an element using its recipe
   * @param {Object} recipe - The ElementRecipe
   * @returns {Promise<Locator>} - Playwright locator
   */
  async find(recipe) {
    this.log('Finding element:', JSON.stringify(recipe, null, 2));
    
    const { what, where, which, confirm } = recipe;
    
    // Track what we tried (for debugging/healing)
    const attempts = [];
    
    // ==========================================================================
    // PHASE 0: Try testId first (most reliable)
    // ==========================================================================
    
    if (which?.testId) {
      const result = await this.tryStrategy('testId', async () => {
        const locator = this.page.getByTestId(which.testId);
        return await this.validateLocator(locator, 'testId');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 1: SCOPE - Narrow down the search area
    // ==========================================================================
    
    let scope = this.page;
    
    // Try to scope by container role (tablist, menu, listbox, etc.)
    if (where?.within) {
      const scoped = await this.tryScope(where.within, attempts);
      if (scoped) scope = scoped;
    }
    // Fall back to landmark scoping
    else if (where?.landmark) {
      const scoped = await this.tryScope(where.landmark, attempts);
      if (scoped) scope = scoped;
    }
    
    // ==========================================================================
    // PHASE 2: QUERY - Find by role + text (best semantic match)
    // ==========================================================================
    
    if (what?.role && what?.text) {
      const result = await this.tryStrategy('role+text', async () => {
        // Use Playwright's getByRole which is excellent at finding elements
        const locator = scope.getByRole(what.role, { name: what.text });
        return await this.resolveMultiple(locator, which, 'role+text');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // Try role-only if text didn't work
    if (what?.role && which?.position) {
      const result = await this.tryStrategy('role+position', async () => {
        const locator = scope.getByRole(what.role);
        const count = await locator.count();
        if (count > 0 && which.position <= count) {
          return { success: true, locator: locator.nth(which.position - 1) };
        }
        return { success: false };
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 3: Try text-based methods
    // ==========================================================================
    
    if (what?.text) {
      // Try exact text match
      const result = await this.tryStrategy('text-exact', async () => {
        const locator = scope.getByText(what.text, { exact: true });
        return await this.resolveMultiple(locator, which, 'text-exact');
      }, attempts);
      
      if (result.success) return result.locator;
      
      // Try getByLabel (for form elements)
      if (where?.nearText) {
        const labelResult = await this.tryStrategy('label', async () => {
          const locator = scope.getByLabel(where.nearText);
          return await this.validateLocator(locator, 'label');
        }, attempts);
        
        if (labelResult.success) return labelResult.locator;
      }
    }
    
    // ==========================================================================
    // PHASE 4: Try aria-label
    // ==========================================================================
    
    if (which?.ariaLabel) {
      const result = await this.tryStrategy('aria-label', async () => {
        const locator = scope.locator(`[aria-label="${which.ariaLabel}"]`);
        return await this.validateLocator(locator, 'aria-label');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 5: Try name attribute (forms)
    // ==========================================================================
    
    if (which?.name) {
      const result = await this.tryStrategy('name', async () => {
        const locator = scope.locator(`[name="${which.name}"]`);
        return await this.validateLocator(locator, 'name');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 6: Try ID (if stable)
    // ==========================================================================
    
    if (which?.id) {
      const result = await this.tryStrategy('id', async () => {
        const locator = this.page.locator(`#${which.id}`);
        return await this.validateLocator(locator, 'id');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 7: Fallback to CSS selector
    // ==========================================================================
    
    if (confirm?.cssSelector) {
      const result = await this.tryStrategy('css-fallback', async () => {
        const locator = this.page.locator(confirm.cssSelector);
        return await this.validateLocator(locator, 'css-fallback');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 8: Relaxed search (last resort)
    // ==========================================================================
    
    if (what?.text) {
      const result = await this.tryStrategy('text-contains', async () => {
        // Search entire page with partial match
        const locator = this.page.getByText(what.text).first();
        return await this.validateLocator(locator, 'text-contains');
      }, attempts);
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // FAILED - Log what we tried
    // ==========================================================================
    
    this.log('All strategies failed. Attempts:', attempts);
    
    throw new Error(`Could not find element. Tried: ${attempts.map(a => a.strategy).join(', ')}. Recipe: ${JSON.stringify(recipe)}`);
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Try a finding strategy and record the attempt
   */
  async tryStrategy(name, fn, attempts) {
    try {
      this.log(`Trying strategy: ${name}`);
      const result = await fn();
      
      attempts.push({
        strategy: name,
        success: result.success,
        count: result.count || (result.success ? 1 : 0)
      });
      
      if (result.success) {
        this.log(`Strategy ${name} succeeded`);
      }
      
      return result;
    } catch (error) {
      attempts.push({
        strategy: name,
        success: false,
        error: error.message
      });
      return { success: false, error };
    }
  }
  
  /**
   * Try to create a scoped locator
   */
  async tryScope(scopeName, attempts) {
    try {
      // Map common names to selectors
      const scopeSelectors = {
        tablist: '[role="tablist"]',
        menu: '[role="menu"], [role="menubar"]',
        listbox: '[role="listbox"]',
        toolbar: '[role="toolbar"]',
        tree: '[role="tree"]',
        grid: '[role="grid"]',
        radiogroup: '[role="radiogroup"]',
        group: '[role="group"]',
        // Landmarks
        header: 'header, [role="banner"]',
        main: 'main, [role="main"]',
        nav: 'nav, [role="navigation"]',
        footer: 'footer, [role="contentinfo"]',
        form: 'form, [role="form"]',
        dialog: 'dialog, [role="dialog"], [role="alertdialog"]',
        region: 'section, [role="region"]',
        article: 'article, [role="article"]',
      };
      
      const selector = scopeSelectors[scopeName] || `[role="${scopeName}"], ${scopeName}`;
      const scoped = this.page.locator(selector).first();
      const count = await scoped.count();
      
      if (count > 0) {
        this.log(`Scoped to: ${scopeName}`);
        return scoped;
      }
    } catch (error) {
      this.log(`Failed to scope to ${scopeName}:`, error.message);
    }
    
    return null;
  }
  
  /**
   * Validate a locator exists and is visible
   */
  async validateLocator(locator, strategyName) {
    try {
      const count = await locator.count();
      
      if (count === 0) {
        return { success: false, count: 0 };
      }
      
      if (count === 1) {
        // Check if visible
        const isVisible = await locator.isVisible().catch(() => false);
        if (isVisible) {
          return { success: true, locator, count: 1 };
        }
      }
      
      // Multiple matches - return first visible
      if (count > 1) {
        const first = locator.first();
        const isVisible = await first.isVisible().catch(() => false);
        if (isVisible) {
          return { success: true, locator: first, count };
        }
      }
      
      return { success: false, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Resolve multiple matches using disambiguation info
   */
  async resolveMultiple(locator, which, strategyName) {
    const count = await locator.count();
    
    if (count === 0) {
      return { success: false, count: 0 };
    }
    
    if (count === 1) {
      return { success: true, locator: locator.first(), count: 1 };
    }
    
    // Multiple matches - use position if available
    if (which?.position && which.position <= count) {
      this.log(`Multiple matches (${count}), using position ${which.position}`);
      return { success: true, locator: locator.nth(which.position - 1), count };
    }
    
    // Multiple matches - use testId filter if available
    if (which?.testId) {
      const filtered = locator.filter({ has: this.page.locator(`[data-testid="${which.testId}"]`) });
      const filteredCount = await filtered.count();
      if (filteredCount === 1) {
        return { success: true, locator: filtered.first(), count: filteredCount };
      }
    }
    
    // Default to first
    this.log(`Multiple matches (${count}), using first`);
    return { success: true, locator: locator.first(), count };
  }
  
  // ==========================================================================
  // SPECIAL ACTION FINDERS
  // ==========================================================================
  
  /**
   * Find a combobox/select trigger and its options
   * Used for dropdown selections (supports Radix Select, Radix Menu, Headless UI, native select)
   */
  async findCombobox(recipe) {
    const trigger = await this.find(recipe);
    
    return {
      trigger,
      
      /**
       * Wait for and find an option in the dropdown
       */
      findOption: async (optionText) => {
        // Wait for listbox/menu/select content to appear
        // Radix Select uses data-radix-select-content and portals to body
        const listbox = this.page.locator(
          '[role="listbox"], [role="menu"], ' +
          '[data-radix-menu-content], [data-radix-select-content], ' +
          '[data-radix-popper-content-wrapper]'
        );
        
        try {
          await listbox.first().waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
          // Try alternative selector for Radix Select viewport
          const viewport = this.page.locator('[data-radix-select-viewport]');
          await viewport.waitFor({ state: 'visible', timeout: this.timeout });
        }
        
        // Find the option using multiple strategies
        // Strategy 1: By role
        const byRole = this.page.getByRole('option', { name: optionText })
          .or(this.page.getByRole('menuitem', { name: optionText }));
        
        let count = await byRole.count();
        if (count > 0) {
          this.log(`Found option by role: "${optionText}"`);
          return byRole.first();
        }
        
        // Strategy 2: By exact text within listbox/content
        const byText = this.page.locator(
          '[role="listbox"] >> text="' + optionText + '", ' +
          '[role="menu"] >> text="' + optionText + '", ' +
          '[data-radix-select-content] >> text="' + optionText + '", ' +
          '[data-radix-popper-content-wrapper] >> text="' + optionText + '"'
        );
        
        count = await byText.count();
        if (count > 0) {
          this.log(`Found option by text: "${optionText}"`);
          return byText.first();
        }
        
        // Strategy 3: By partial text match
        const byPartialText = this.page.getByText(optionText, { exact: false });
        count = await byPartialText.count();
        if (count > 0) {
          // Filter to only visible ones in dropdown context
          const visible = byPartialText.filter({ hasNot: this.page.locator(':hidden') });
          const visibleCount = await visible.count();
          if (visibleCount > 0) {
            this.log(`Found option by partial text: "${optionText}"`);
            return visible.first();
          }
          return byPartialText.first();
        }
        
        throw new Error(`Option "${optionText}" not found in dropdown`);
      }
    };
  }
  
  /**
   * Find an input by its label
   */
  async findInput(labelText) {
    // Try getByLabel first (Playwright's best method for form inputs)
    const byLabel = this.page.getByLabel(labelText);
    if (await byLabel.count() > 0) {
      return byLabel.first();
    }
    
    // Try placeholder
    const byPlaceholder = this.page.getByPlaceholder(labelText);
    if (await byPlaceholder.count() > 0) {
      return byPlaceholder.first();
    }
    
    // Try name attribute
    const byName = this.page.locator(`input[name*="${labelText}" i], textarea[name*="${labelText}" i]`);
    if (await byName.count() > 0) {
      return byName.first();
    }
    
    throw new Error(`Input "${labelText}" not found`);
  }
}

// ============================================================================
// ACTION EXECUTOR - Execute actions with smart finding
// ============================================================================

class ActionExecutor {
  constructor(page, options = {}) {
    this.page = page;
    this.finder = new SmartFinder(page, options);
    this.timeout = options.timeout || 10000;
    this.debug = options.debug || false;
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[ActionExecutor]', ...args);
    }
  }
  
  /**
   * Execute a recorded step
   */
  async execute(step) {
    const { action, target, value } = step;
    
    this.log(`Executing: ${action}`, step.description || '');
    
    switch (action) {
      case 'click':
        return await this.executeClick(target);
        
      case 'fill':
        return await this.executeFill(target, value);
        
      case 'select':
        return await this.executeSelect(target, value);
        
      case 'check':
        return await this.executeCheck(target, true);
        
      case 'uncheck':
        return await this.executeCheck(target, false);
        
      case 'navigate':
        return await this.executeNavigate(value);
        
      case 'hover':
        return await this.executeHover(target);
        
      case 'press':
        return await this.executePress(target, value);
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }
  
  async executeClick(target) {
    const element = await this.finder.find(target);
    await element.click({ timeout: this.timeout });
    return { success: true, action: 'click' };
  }
  
  async executeFill(target, value) {
    const element = await this.finder.find(target);
    await element.fill(value, { timeout: this.timeout });
    return { success: true, action: 'fill', value };
  }
  
  async executeSelect(target, value) {
    // value can be { text: 'Option text', dataValue: 'option-value' }
    const optionText = typeof value === 'string' ? value : value.text;
    
    // Find and click the trigger
    const combobox = await this.finder.findCombobox(target);
    await combobox.trigger.click({ timeout: this.timeout });
    
    // Wait a moment for dropdown animation
    await this.page.waitForTimeout(100);
    
    // Find and click the option
    const option = await combobox.findOption(optionText);
    await option.click({ timeout: this.timeout });
    
    return { success: true, action: 'select', value: optionText };
  }
  
  async executeCheck(target, checked) {
    const element = await this.finder.find(target);
    if (checked) {
      await element.check({ timeout: this.timeout });
    } else {
      await element.uncheck({ timeout: this.timeout });
    }
    return { success: true, action: checked ? 'check' : 'uncheck' };
  }
  
  async executeNavigate(url) {
    await this.page.goto(url, { timeout: this.timeout });
    return { success: true, action: 'navigate', url };
  }
  
  async executeHover(target) {
    const element = await this.finder.find(target);
    await element.hover({ timeout: this.timeout });
    return { success: true, action: 'hover' };
  }
  
  async executePress(target, key) {
    if (target) {
      const element = await this.finder.find(target);
      await element.press(key, { timeout: this.timeout });
    } else {
      await this.page.keyboard.press(key);
    }
    return { success: true, action: 'press', key };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  SmartFinder,
  ActionExecutor,
};
