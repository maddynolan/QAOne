/**
 * Action Coalescer - Combine low-level events into high-level intents
 * 
 * Problem: When user selects from a Radix dropdown, we capture:
 *   1. Click on trigger
 *   2. Click on option
 * 
 * But the INTENT is: "Select 'Express' from 'Shipping Method'"
 * 
 * This module detects these patterns and coalesces them into single actions.
 * 
 * @author Flowstral
 * @version 2.0.0
 */

// ============================================================================
// ACTION PATTERNS
// ============================================================================

/**
 * Pattern definitions for action coalescing
 */
const PATTERNS = {
  // Dropdown/Select pattern
  dropdown: {
    // Trigger roles that start a dropdown
    triggerRoles: ['combobox', 'listbox', 'button'],
    // Trigger indicators
    triggerIndicators: [
      '[aria-haspopup="listbox"]',
      '[aria-haspopup="menu"]',
      '[aria-haspopup="true"]',
      '[aria-expanded]',
      '[data-state]', // Radix
      '[role="combobox"]',
      'select',
      '.select-trigger',
      '[class*="select"][class*="trigger"]',
    ],
    // Option roles that end a dropdown selection
    optionRoles: ['option', 'menuitem', 'menuitemcheckbox', 'menuitemradio'],
    // Container that appears after trigger click
    containerSelectors: [
      '[role="listbox"]',
      '[role="menu"]',
      '[data-radix-popper-content-wrapper]',
      '[data-radix-menu-content]',
      '.select-content',
      '[class*="select"][class*="content"]',
    ],
    // Maximum time between trigger click and option click (ms)
    // REDUCED from 5000 to 2000 - if user doesn't select within 2s, record the trigger click
    maxDelay: 2000,
  },
  
  // Tab switching pattern
  tab: {
    triggerRole: 'tab',
    containerRole: 'tablist',
    // Tab click should result in tabpanel change
    resultIndicator: '[aria-selected="true"]',
  },
  
  // Accordion pattern
  accordion: {
    triggerRoles: ['button'],
    containerIndicators: [
      '[data-state="open"]',
      '[data-state="closed"]',
      '[aria-expanded]',
      '.accordion-trigger',
    ],
  },
};

// ============================================================================
// ACTION COALESCER CLASS
// ============================================================================

class ActionCoalescer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.pendingTrigger = null;
    this.pendingTimeout = null;
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[ActionCoalescer]', ...args);
    }
  }
  
  /**
   * Process an incoming action
   * Returns either the action as-is, a coalesced action, or null (if waiting for more)
   */
  process(action) {
    // Check if this completes a pending pattern
    if (this.pendingTrigger) {
      const coalesced = this.tryComplete(action);
      if (coalesced) {
        return coalesced;
      }
    }
    
    // Check if this starts a new pattern
    if (this.isDropdownTrigger(action)) {
      this.startPending(action, 'dropdown');
      return null; // Wait for option click
    }
    
    // Not part of a pattern - return as-is
    return action;
  }
  
  /**
   * Force completion of any pending action
   * Called on timeout or when user does something unexpected
   */
  flush() {
    if (this.pendingTrigger) {
      const action = this.pendingTrigger.action;
      this.clearPending();
      return action;
    }
    return null;
  }
  
  // ==========================================================================
  // PATTERN DETECTION
  // ==========================================================================
  
  /**
   * Check if action is a dropdown trigger
   * NOTE: We only coalesce SELECT/COMBOBOX patterns, NOT navigation menus
   * Navigation menus should record both clicks (trigger + menu item)
   */
  isDropdownTrigger(action) {
    if (action.type !== 'click') return false;
    
    const recipe = action.target || action.recipe;
    if (!recipe) return false;
    
    const { what, which } = recipe;
    
    // ============================================================
    // EXCLUDE NAVIGATION MENUS - these should NOT be coalesced
    // Navigation buttons open menus with links, not options
    // ============================================================
    const isNavigationMenu = 
      what?.role === 'button' && (
        what?.text?.toLowerCase()?.includes('customer') ||
        what?.text?.toLowerCase()?.includes('menu') ||
        what?.text?.toLowerCase()?.includes('nav') ||
        // Check for Salesforce navigation patterns
        (action.element?.id || '').includes('navItem') ||
        (action.element?.className || '').includes('flyout')
      );
    
    if (isNavigationMenu) {
      return false; // Let the click be recorded normally
    }
    
    // Check role - ONLY combobox or listbox are true dropdown triggers
    // Button role is too broad - many navigation menus use buttons
    if (what?.role === 'combobox' || what?.role === 'listbox') {
      return true;
    }
    
    // Check tag - native select is always a dropdown
    if (what?.tag === 'select') return true;
    
    // For buttons, ONLY treat as dropdown if inside a form or has specific select indicators
    if (what?.role === 'button') {
      // Only if it looks like a select/combobox component
      const isSelectComponent = 
        (action.element?.className || '').includes('select') ||
        (recipe.where?.nearText || '').toLowerCase().includes('select') ||
        (recipe.where?.nearText || '').toLowerCase().includes('dropdown');
      
      if (!isSelectComponent) {
        return false; // Navigation button, not a select
      }
    }
    
    return false;
  }
  
  /**
   * Check if action is a dropdown option selection
   */
  isDropdownOption(action) {
    if (action.type !== 'click') return false;
    
    const recipe = action.target || action.recipe;
    if (!recipe) return false;
    
    const { what, where } = recipe;
    
    // Check role
    if (what?.role && PATTERNS.dropdown.optionRoles.includes(what.role)) {
      return true;
    }
    
    // Check container
    if (where?.within === 'listbox' || where?.within === 'menu') {
      return true;
    }
    
    return false;
  }
  
  // ==========================================================================
  // PENDING STATE MANAGEMENT
  // ==========================================================================
  
  startPending(action, patternType) {
    this.log(`Starting pending ${patternType}:`, action.description);
    
    this.pendingTrigger = {
      action,
      patternType,
      timestamp: Date.now(),
    };
    
    // Set timeout to auto-flush if no completion
    this.pendingTimeout = setTimeout(() => {
      this.log('Pending action timed out');
      const flushed = this.flush();
      if (flushed && this.onAction) {
        this.onAction(flushed);
      }
    }, PATTERNS.dropdown.maxDelay);
  }
  
  clearPending() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
    this.pendingTrigger = null;
  }
  
  /**
   * Try to complete a pending pattern with the new action
   */
  tryComplete(action) {
    if (!this.pendingTrigger) return null;
    
    const { patternType } = this.pendingTrigger;
    
    if (patternType === 'dropdown' && this.isDropdownOption(action)) {
      return this.coalesceDropdown(this.pendingTrigger.action, action);
    }
    
    // New action doesn't complete the pattern - flush and return both
    this.log('Action does not complete pattern, flushing');
    const flushed = this.flush();
    
    // Return both actions (the flushed trigger and the new action)
    // The caller should handle this appropriately
    return {
      flushed,
      current: action,
    };
  }
  
  // ==========================================================================
  // COALESCING LOGIC
  // ==========================================================================
  
  /**
   * Coalesce a dropdown trigger + option into a single select action
   */
  coalesceDropdown(triggerAction, optionAction) {
    this.log('Coalescing dropdown selection');
    this.clearPending();
    
    const triggerRecipe = triggerAction.target || triggerAction.recipe || {};
    const optionRecipe = optionAction.target || optionAction.recipe || {};
    
    // Get the trigger's label (what dropdown is this?)
    const triggerLabel = 
      triggerRecipe.where?.nearText ||
      triggerRecipe.what?.text ||
      triggerRecipe.which?.ariaLabel ||
      'dropdown';
    
    // Get the selected option text
    const optionText = 
      optionRecipe.what?.text ||
      optionAction.element?.text ||
      'option';
    
    // Get option value if available
    const optionValue = 
      optionRecipe.which?.testId ||
      optionAction.element?.dataValue ||
      null;
    
    // Build the coalesced action
    return {
      type: 'select',
      // Use trigger's recipe as the target (that's what we click to open)
      target: triggerRecipe,
      // Store the selected value
      value: {
        text: optionText,
        dataValue: optionValue,
      },
      description: `Select "${optionText}" from "${triggerLabel}"`,
      timestamp: optionAction.timestamp || Date.now(),
      // Keep reference to original actions for debugging
      _coalesced: {
        trigger: triggerAction,
        option: optionAction,
      },
    };
  }
}

// ============================================================================
// SCRIPT FOR PAGE INJECTION
// ============================================================================

/**
 * Get the action coalescer script to inject into the page
 * This allows coalescing to happen in real-time during recording
 */
function getActionCoalescerScript() {
  return `
(function() {
  if (window.__flowstralActionCoalescer) return;
  
  window.__flowstralActionCoalescer = {
    pendingTrigger: null,
    pendingTimeout: null,
    
    // Check if element is a dropdown trigger
    // NOTE: We only coalesce SELECT/COMBOBOX patterns, NOT navigation menus
    isDropdownTrigger: function(element) {
      if (!element) return false;
      
      var role = element.getAttribute('role');
      var tag = element.tagName.toLowerCase();
      var hasPopup = element.getAttribute('aria-haspopup');
      var expanded = element.getAttribute('aria-expanded');
      var dataState = element.getAttribute('data-state');
      var id = element.id || '';
      var classList = element.className || '';
      
      // ============================================================
      // EXCLUDE NAVIGATION MENUS - these should NOT be coalesced
      // Navigation buttons open menus with links, not options
      // ============================================================
      var isNavigationMenu = (
        id.includes('navItem') ||
        id.includes('navigation') ||
        classList.includes('flyout') ||
        classList.includes('nav-item') ||
        classList.includes('menu-trigger') ||
        (hasPopup === 'menu' && tag === 'button') // Menu popups with links, not options
      );
      
      if (isNavigationMenu) {
        return false; // Let the click be recorded normally
      }
      
      // Only native select is ALWAYS a dropdown
      if (tag === 'select') return true;
      
      // Combobox/listbox roles are dropdown triggers
      if (role === 'combobox' || role === 'listbox') return true;
      
      // Check for Radix Select trigger attribute (explicit select component)
      if (element.hasAttribute('data-radix-select-trigger')) return true;
      if (element.hasAttribute('data-radix-select-value')) return true;
      
      // Check classes for select components (not general menus)
      if (typeof classList === 'string') {
        if (classList.includes('select') && classList.includes('trigger')) return true;
        if (classList.includes('combobox')) return true;
        if (classList.includes('SelectTrigger')) return true;
      }
      
      // For aria-haspopup="listbox" - this IS a select pattern
      if (hasPopup === 'listbox') return true;
      
      // For general buttons with aria-expanded, DON'T treat as dropdown
      // unless it's clearly a select/combobox component
      
      return false;
    },
    
    // Check if element is a dropdown option
    isDropdownOption: function(element) {
      if (!element) return false;
      
      var role = element.getAttribute('role');
      var optionRoles = ['option', 'menuitem', 'menuitemcheckbox', 'menuitemradio'];
      if (role && optionRoles.indexOf(role) >= 0) return true;
      
      // Check if inside a listbox/menu/select content
      // Radix Select uses data-radix-select-content, not data-radix-menu-content
      var listbox = element.closest(
        '[role="listbox"], [role="menu"], ' +
        '[data-radix-menu-content], [data-radix-select-content], ' +
        '[data-radix-popper-content-wrapper], ' +
        '[class*="SelectContent"], [class*="select-content"]'
      );
      if (listbox) return true;
      
      // Check for Radix collection item attribute (both Menu and Select use this)
      if (element.hasAttribute('data-radix-collection-item')) return true;
      
      return false;
    },
    
    // Process a click action
    processClick: function(element, recipe, callback) {
      var self = this;
      
      // If we have a pending trigger and this is an option, coalesce
      if (this.pendingTrigger && this.isDropdownOption(element)) {
        clearTimeout(this.pendingTimeout);
        
        var triggerRecipe = this.pendingTrigger.recipe;
        var triggerLabel = triggerRecipe.where?.nearText || triggerRecipe.what?.text || 'dropdown';
        var optionText = recipe.what?.text || element.innerText?.trim() || 'option';
        
        this.pendingTrigger = null;
        
        // Return coalesced select action
        callback({
          type: 'select',
          target: triggerRecipe,
          value: {
            text: optionText,
            dataValue: recipe.which?.testId || element.getAttribute('data-value') || null
          },
          description: 'Select "' + optionText + '" from "' + triggerLabel + '"'
        });
        return;
      }
      
      // If this is a dropdown trigger, start pending
      if (this.isDropdownTrigger(element)) {
        this.pendingTrigger = { element: element, recipe: recipe };
        
        // Auto-flush after timeout
        this.pendingTimeout = setTimeout(function() {
          if (self.pendingTrigger) {
            callback({
              type: 'click',
              target: self.pendingTrigger.recipe,
              description: 'Click "' + (self.pendingTrigger.recipe.what?.text || 'element') + '"'
            });
            self.pendingTrigger = null;
          }
        }, 3000);
        
        return; // Don't record yet, wait for option
      }
      
      // Regular click - record immediately
      callback({
        type: 'click',
        target: recipe,
        description: 'Click "' + (recipe.what?.text || 'element') + '"'
      });
    },
    
    // Flush any pending action
    flush: function(callback) {
      if (this.pendingTrigger) {
        clearTimeout(this.pendingTimeout);
        callback({
          type: 'click',
          target: this.pendingTrigger.recipe,
          description: 'Click "' + (this.pendingTrigger.recipe.what?.text || 'element') + '"'
        });
        this.pendingTrigger = null;
      }
    }
  };
  
  console.log('[Flowstral] Action Coalescer loaded');
})();
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  ActionCoalescer,
  getActionCoalescerScript,
  PATTERNS,
};
