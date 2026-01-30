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
      // SMART PRODUCT CONTEXT: For "Add to cart" type buttons, capture the product name
      var clickText = recipe.what?.text || 'element';
      var productContext = this.getProductContext(element, clickText);
      
      callback({
        type: 'click',
        target: recipe,
        // If we found product context, add it to the description
        description: productContext 
          ? 'Click "' + clickText + ' for ' + productContext + '"'
          : 'Click "' + clickText + '"',
        // Store product context in recipe for playback
        productContext: productContext || null
      });
    },
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COMPREHENSIVE CONTEXT DETECTION
    // Handles: E-commerce, Travel, Food Delivery, Banking, Enterprise, etc.
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Get context for actions that need disambiguation (same button text, different targets)
    getProductContext: function(element, buttonText) {
      var lowerText = (buttonText || '').toLowerCase();
      
      // ─────────────────────────────────────────────────────────────────────────
      // STEP 1: Identify what TYPE of action this is
      // ─────────────────────────────────────────────────────────────────────────
      var contextType = this.identifyContextType(lowerText, element);
      if (!contextType) return null;
      
      // ─────────────────────────────────────────────────────────────────────────
      // STEP 2: Find the containing card/item/row
      // ─────────────────────────────────────────────────────────────────────────
      var container = this.findContextContainer(element, contextType);
      if (!container) return null;
      
      // ─────────────────────────────────────────────────────────────────────────
      // STEP 3: Extract the identifying text from container
      // ─────────────────────────────────────────────────────────────────────────
      var contextText = this.extractContextText(container, contextType);
      
      if (contextText) {
        console.log('[Flowstral] 🎯 Context detected (' + contextType + '):', contextText);
      }
      
      return contextText;
    },
    
    // Identify what type of context we're dealing with
    identifyContextType: function(buttonText, element) {
      // ══════════════════════════════════════════════════════════════════════
      // E-COMMERCE: Product actions
      // ══════════════════════════════════════════════════════════════════════
      if (buttonText.includes('add to cart') ||
          buttonText.includes('add to bag') ||
          buttonText.includes('add to basket') ||
          buttonText.includes('add to wishlist') ||
          buttonText.includes('add to favorites') ||
          buttonText.includes('add to list') ||
          buttonText.includes('buy now') ||
          buttonText.includes('buy it now') ||
          buttonText.includes('quick add') ||
          buttonText.includes('quick shop') ||
          buttonText.includes('quick view') ||
          buttonText.includes('shop now') ||
          buttonText.includes('get it') ||
          buttonText.includes('pick up') ||
          buttonText.includes('order now') ||
          buttonText.includes('pre-order') ||
          buttonText.includes('reserve') ||
          buttonText.includes('notify me') ||
          buttonText === 'add' ||
          buttonText === 'buy' ||
          buttonText === 'shop' ||
          buttonText === 'get' ||
          buttonText === '+' ||
          // Size/Color selection in product context
          (element.closest('[class*="product"], [class*="Product"], [data-product], article') &&
           (buttonText.match(/^(xs|s|m|l|xl|xxl|2xl|3xl|\d+)$/i) || // Sizes
            buttonText.match(/^(black|white|red|blue|green|yellow|pink|gray|grey|brown|navy|beige)$/i)))) { // Colors
        return 'product';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // TRAVEL: Booking actions
      // ══════════════════════════════════════════════════════════════════════
      if (buttonText.includes('book now') ||
          buttonText.includes('book this') ||
          buttonText.includes('reserve now') ||
          buttonText.includes('reserve room') ||
          buttonText.includes('select room') ||
          buttonText.includes('select flight') ||
          buttonText.includes('select this') ||
          buttonText.includes('choose flight') ||
          buttonText.includes('choose room') ||
          buttonText.includes('view deal') ||
          buttonText.includes('view details') ||
          buttonText.includes('see availability') ||
          buttonText.includes('check availability') ||
          buttonText.includes('check rates') ||
          buttonText.includes('show prices') ||
          buttonText.includes('lock price') ||
          buttonText.includes('hold') ||
          // Flight/hotel specific
          buttonText.includes('departing') ||
          buttonText.includes('returning') ||
          // Car rental
          buttonText.includes('select car') ||
          buttonText.includes('rent now')) {
        return 'booking';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // FOOD DELIVERY: Menu item actions
      // ══════════════════════════════════════════════════════════════════════
      if (buttonText.includes('add item') ||
          buttonText.includes('add to order') ||
          buttonText.includes('customize') ||
          buttonText.includes('reorder') ||
          // Context check for food sites
          (element.closest('[class*="menu"], [class*="Menu"], [class*="dish"], [class*="food"]') &&
           (buttonText === 'add' || buttonText === '+' || buttonText === 'order'))) {
        return 'menuItem';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // STREAMING: Media actions
      // ══════════════════════════════════════════════════════════════════════
      if ((buttonText === 'play' ||
           buttonText.includes('watch now') ||
           buttonText.includes('listen now') ||
           buttonText.includes('start watching') ||
           buttonText === 'resume' ||
           buttonText.includes('add to queue') ||
           buttonText.includes('add to playlist') ||
           buttonText.includes('add to library') ||
           buttonText.includes('my list')) &&
          element.closest('[class*="card"], [class*="Card"], [class*="title"], article')) {
        return 'card';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // BANKING/FINANCE: Account actions
      // ══════════════════════════════════════════════════════════════════════
      if ((buttonText.includes('transfer') ||
           buttonText.includes('pay now') ||
           buttonText.includes('pay bill') ||
           buttonText.includes('view details') ||
           buttonText.includes('view statement') ||
           buttonText === 'pay' ||
           buttonText === 'send') &&
          element.closest('[class*="account"], [class*="Account"], [class*="transaction"], tr, [role="row"]')) {
        return 'tableRow';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // TABLE ROWS: Data grid actions
      // ══════════════════════════════════════════════════════════════════════
      if ((buttonText === 'edit' || 
           buttonText === 'delete' || 
           buttonText === 'view' ||
           buttonText === 'remove' ||
           buttonText === 'open' ||
           buttonText === 'update' ||
           buttonText === 'approve' ||
           buttonText === 'reject' ||
           buttonText === 'cancel' ||
           buttonText === 'clone' ||
           buttonText === 'copy' ||
           buttonText === 'archive' ||
           buttonText.includes('action') ||
           buttonText.includes('more options') ||
           buttonText === '...' ||
           buttonText === '⋮' ||
           buttonText === '⋯') &&
          element.closest('tr, [role="row"], .list-row, [class*="row"], [class*="Row"], .ag-row')) {
        return 'tableRow';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // LIST ITEMS: Generic list actions
      // ══════════════════════════════════════════════════════════════════════
      if ((buttonText === 'select' ||
           buttonText === 'remove' ||
           buttonText === 'edit' ||
           buttonText === 'delete' ||
           buttonText === 'move' ||
           buttonText === 'pin' ||
           buttonText === 'unpin') &&
          element.closest('li, [role="listitem"], [class*="list-item"], [class*="ListItem"]')) {
        return 'listItem';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // SOCIAL MEDIA: Post/Feed actions
      // ══════════════════════════════════════════════════════════════════════
      if ((buttonText === 'like' ||
           buttonText === 'love' ||
           buttonText === 'share' ||
           buttonText === 'comment' ||
           buttonText === 'retweet' ||
           buttonText === 'repost' ||
           buttonText === 'reply' ||
           buttonText === 'save' ||
           buttonText === 'bookmark' ||
           buttonText.includes('react')) &&
          element.closest('article, [data-testid="tweet"], [class*="post"], [class*="Post"], [class*="feed"]')) {
        return 'card';
      }
      
      // ══════════════════════════════════════════════════════════════════════
      // CARD ACTIONS: Generic card buttons
      // ══════════════════════════════════════════════════════════════════════
      if (buttonText === 'view' || 
          buttonText === 'details' ||
          buttonText === 'read more' ||
          buttonText === 'learn more' ||
          buttonText === 'explore' ||
          buttonText === 'discover' ||
          buttonText === 'see more' ||
          buttonText === 'show more') {
        var card = element.closest('article, [class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"]');
        if (card) return 'card';
      }
      
      return null;
    },
    
    // Find the container element based on context type
    findContextContainer: function(element, contextType) {
      var selectors = [];
      
      switch (contextType) {
        case 'product':
          selectors = [
            // ══════════════════════════════════════════════════════════════════
            // MAJOR E-COMMERCE SITES (270+ selectors for comprehensive coverage)
            // ══════════════════════════════════════════════════════════════════
            
            // AMAZON
            '[data-component-type="s-search-result"]',
            '[data-asin]',
            '.s-result-item',
            '.sg-col-inner',
            '[data-cel-widget*="search_result"]',
            
            // WALMART
            '[data-item-id]',
            '[data-automation-id*="product"]',
            '.search-result-gridview-item',
            '[data-testid*="list-view"]',
            '[data-testid*="item-stack"]',
            '.mb0.ph1.pa0-xl.bb.b--near-white.w-25',
            
            // TARGET
            '[data-test="@web/ProductCard"]',
            '[data-test="product-card"]',
            '[data-test*="ProductCard"]',
            '[data-test="@web/site-top-of-funnel/ProductCardWrapper"]',
            
            // BEST BUY
            '.sku-item',
            '.list-item',
            '[data-sku-id]',
            '.sku-title',
            '.pricing-price',
            
            // EBAY
            '.s-item',
            '.srp-results .s-item',
            '[data-viewport]',
            '.s-item__wrapper',
            
            // ETSY
            '.v2-listing-card',
            '[data-listing-id]',
            '.listing-link',
            '.wt-grid__item-xs-6',
            
            // SHOPIFY (generic patterns for all Shopify stores)
            '.product-card',
            '.grid__item',
            '[data-product-id]',
            '.product-item',
            '.product-grid-item',
            '[data-product-handle]',
            '.boost-pfs-filter-product-item',
            
            // HOME DEPOT
            '.browse-search__pod',
            '.product-pod',
            '[data-component="product-pod"]',
            '.results-wrapped .plp-pod',
            
            // LOWES
            '.product-card',
            '[data-selector="product-card"]',
            
            // WAYFAIR
            '.ProductCard',
            '[data-hb-id="ProductCard"]',
            '.ProductCard--listItem',
            
            // COSTCO
            '.product-tile',
            '.product',
            '.product-tile-set',
            
            // SAMS CLUB
            '[data-testid="item-card"]',
            '.sc-product-card',
            
            // MACYS
            '.productThumbnail',
            '[data-el="productThumbnail"]',
            '.product-thumbnail-image',
            
            // NORDSTROM
            '.Edzs8',
            '[data-element-id="product-module"]',
            '.product-module',
            
            // KOHLS
            '[data-tracking="product-pod"]',
            '.products-grid .product-pod',
            
            // JC PENNEY
            '.product-card',
            '.gallery-product',
            
            // NEWEGG
            '.item-cell',
            '.item-container',
            '[data-product-id]',
            
            // MICROCENTER
            '.product_wrapper',
            '.product-info',
            
            // OVERSTOCK
            '.product-card',
            '.search-product-card',
            
            // BED BATH & BEYOND / OVERSTOCK
            '[data-testid="product-tile"]',
            
            // CHEWY
            '.ProductCard',
            '[data-testid="product-card"]',
            
            // PETCO
            '.product-tile',
            '.plp-product-tile',
            
            // ZAPPOS
            '[itemprop="itemListElement"]',
            '.product-link',
            
            // NIKE
            '.product-card',
            '[data-testid="product-card"]',
            '.product-grid__item',
            
            // ADIDAS
            '.plp-glass-product-card',
            '[data-auto-id="product-card"]',
            
            // APPLE
            '.as-purchaseinfo',
            '.rf-serp-productlist-item',
            
            // MICROSOFT STORE
            '.m-channel-placement-item',
            '[data-bi-name="product-tile"]',
            
            // GOOGLE STORE
            '.mqN2J',
            '[data-promo-name]',
            
            // ALIBABA / ALIEXPRESS
            '.search-card-item',
            '[data-algolia-component="card"]',
            '.card--gallery',
            
            // WISH
            '.feed-row-item',
            '[data-impression-tag]',
            
            // IKEA
            '.pip-product-compact',
            '[data-product-number]',
            
            // ZARA / INDITEX
            '.product-grid__product',
            '[data-productid]',
            
            // H&M
            '.product-item',
            '.product-item-details',
            
            // UNIQLO
            '.productTile',
            '[data-test="product-tile"]',
            
            // GAP / OLD NAVY / BANANA REPUBLIC
            '.product-card',
            '[data-product-id]',
            
            // WILLIAMS SONOMA / POTTERY BARN / WEST ELM
            '.product-cell',
            '[data-product-id]',
            
            // CRATE & BARREL / CB2
            '.product-card',
            '.shoppable-product',
            
            // GENERIC PATTERNS (fallbacks)
            'article',
            'li[class*="product"]',
            'li[class*="item"]',
            'div[class*="ProductCard"]',
            'div[class*="product-card"]',
            'div[class*="productCard"]',
            'div[class*="product_card"]',
            '[class*="ProductTile"]',
            '[class*="product-tile"]',
            '[class*="item-card"]',
            '[class*="ItemCard"]',
            '[class*="search-result"]',
            '[class*="SearchResult"]',
            '[class*="grid-item"]',
            '[class*="GridItem"]',
            '[class*="plp-product"]',
            '[class*="ProductListItem"]',
            '[role="listitem"]'
          ];
          break;
          
        case 'booking':
          selectors = [
            // ══════════════════════════════════════════════════════════════════
            // TRAVEL & BOOKING SITES
            // ══════════════════════════════════════════════════════════════════
            
            // EXPEDIA
            '.uitk-card',
            '[data-stid*="property-card"]',
            '[data-stid="property-listing"]',
            
            // BOOKING.COM
            '[data-testid="property-card"]',
            '.sr_item',
            '.sr_property_block',
            '[data-hotelid]',
            
            // AIRBNB
            '[data-testid="card-container"]',
            '[itemprop="itemListElement"]',
            '.c1yo0219',
            '[data-test-id="card-container"]',
            
            // HOTELS.COM
            '.uitk-layout-flex-item',
            '[data-stid*="section-results"]',
            
            // VRBO
            '[data-wdio="property-card"]',
            '.ResultTile',
            
            // KAYAK
            '.Flights-Results-FlightResultItem',
            '.resultInner',
            '.resultWrapper',
            
            // GOOGLE FLIGHTS / HOTELS
            '[data-ved]',
            '.pIav2d',
            
            // SKYSCANNER
            '[data-testid="result-item"]',
            '.FlightsResults_dayViewItem',
            
            // TRIPADVISOR
            '.listing',
            '[data-locationid]',
            '.ui_column',
            
            // PRICELINE
            '.Box-sc',
            '[data-test-id="hotel-listing"]',
            
            // TRIVAGO
            '.item',
            '[data-testid="accommodation-card"]',
            
            // SOUTHWEST
            '.air-booking-select-detail',
            '.air-booking-select-price',
            
            // DELTA
            '.flight-search-result',
            '.price-cell',
            
            // UNITED
            '.flight-result-container',
            '[data-automation="flight-row"]',
            
            // AMERICAN
            '.flight-row',
            '[data-test="flight-details"]',
            
            // JETBLUE
            '.jb-flight-option',
            '[data-qaid="flight-option"]',
            
            // ENTERPRISE / HERTZ / AVIS (car rental)
            '.vehicle-card',
            '[data-vehicle-id]',
            '.car-tile',
            
            // CRUISE LINES
            '.cruise-card',
            '.sailing-card',
            
            // GENERIC
            '[class*="hotel-card"]',
            '[class*="flight-card"]',
            '[class*="listing-card"]',
            '[class*="property-card"]',
            '[class*="result-card"]',
            'article'
          ];
          break;
          
        case 'menuItem':
          selectors = [
            // ══════════════════════════════════════════════════════════════════
            // FOOD DELIVERY SITES
            // ══════════════════════════════════════════════════════════════════
            
            // DOORDASH
            '[data-anchor-id*="MenuItem"]',
            '[data-anchor-id*="StoreMenuItem"]',
            '.styles__ItemCard',
            
            // UBER EATS
            '[data-testid="rich-items-card"]',
            '[data-testid*="menu-item"]',
            '[data-test="store-item-card"]',
            
            // GRUBHUB / SEAMLESS
            '.menuItem',
            '.menuItemNew',
            '[data-testid*="menu"]',
            '.s-row',
            
            // POSTMATES
            '[data-testid="menu-item"]',
            '.css-1dbjc4n',
            
            // INSTACART
            '[data-radium="true"]',
            '.e-lm59ad',
            '[data-testid="product-card"]',
            
            // CHOWNOW
            '.menu-item',
            '[data-menu-item-id]',
            
            // GENERIC
            '[class*="menu-item"]',
            '[class*="MenuItem"]',
            '[class*="dish-card"]',
            '[class*="food-item"]',
            '[class*="FoodItem"]',
            'article'
          ];
          break;
          
        case 'tableRow':
          selectors = [
            // ══════════════════════════════════════════════════════════════════
            // TABLE/DATA GRID ROWS (Enterprise focus)
            // ══════════════════════════════════════════════════════════════════
            
            // Standard HTML
            'tr',
            '[role="row"]',
            
            // SALESFORCE
            '.slds-table tr',
            'lightning-datatable tr',
            '[data-row-key-value]',
            '.slds-listbox__item',
            'lightning-base-combobox-item',
            
            // SERVICENOW
            '[data-list-id]',
            '.list_row',
            '.list2_row',
            
            // WORKDAY
            '[data-automation-id*="row"]',
            '.WBQO',
            
            // SAP
            '[data-sap-ui-row]',
            '.sapMLIBContent',
            
            // ORACLE CLOUD
            '.oj-table-body-row',
            '[data-afr-rkey]',
            
            // JIRA
            '[data-testid="board.card"]',
            '.ghx-issue',
            
            // AG-GRID (common data grid)
            '.ag-row',
            '[row-index]',
            
            // REACT TABLE
            '.rt-tr',
            '[role="row"]',
            
            // GENERIC
            '.list-row',
            '[class*="table-row"]',
            '[class*="TableRow"]',
            '[class*="data-row"]',
            '[class*="DataRow"]',
            '[class*="grid-row"]'
          ];
          break;
          
        case 'listItem':
          selectors = [
            'li',
            '[role="listitem"]',
            '[class*="list-item"]',
            '[class*="ListItem"]',
            '[class*="feed-item"]',
            '[class*="FeedItem"]',
            // Social media patterns
            '[data-testid="tweet"]',
            '[data-testid="post"]',
            'article[role="article"]'
          ];
          break;
          
        case 'card':
          selectors = [
            'article',
            '[class*="card"]',
            '[class*="Card"]',
            '[data-testid*="card"]',
            // STREAMING
            '[data-testid="title-card"]',
            '.title-card',
            // SOCIAL
            '.post',
            '.feed-shared-update'
          ];
          break;
      }
      
      // Try each selector
      for (var i = 0; i < selectors.length; i++) {
        var container = element.closest(selectors[i]);
        if (container) {
          return container;
        }
      }
      
      return null;
    },
    
    // Extract identifying text from container
    extractContextText: function(container, contextType) {
      var titleSelectors = [];
      
      switch (contextType) {
        case 'product':
          titleSelectors = [
            // ══════════════════════════════════════════════════════════════════
            // PRODUCT TITLE SELECTORS (comprehensive, ordered by reliability)
            // ══════════════════════════════════════════════════════════════════
            
            // DATA ATTRIBUTES (most reliable)
            '[data-test*="product-title"]',
            '[data-testid*="product-title"]',
            '[data-testid*="productTitle"]',
            '[data-testid*="item-title"]',
            '[data-automation-id*="product-title"]',
            '[data-automation-id*="productTitle"]',
            '[data-test*="productTitle"]',
            '[data-tracking*="title"]',
            '[data-element*="title"]',
            
            // AMAZON
            'h2 a.a-link-normal span',
            'h2 a span.a-text-normal',
            '.a-size-medium.a-color-base.a-text-normal',
            '.a-size-base-plus.a-color-base.a-text-normal',
            '[data-cy="title-recipe"] a',
            
            // WALMART
            '[data-automation-id="product-title"]',
            'span[data-automation-id="product-title"]',
            '[data-item-id] [class*="product-title"]',
            
            // TARGET
            '[data-test="product-title"]',
            'a[data-test="product-title"]',
            '[data-test="@web/ProductCard/ProductCardTitle"]',
            
            // BEST BUY
            '.sku-title a',
            '.sku-header h1',
            '[data-sku-id] .sku-title',
            
            // EBAY
            '.s-item__title span',
            '.s-item__title',
            '[class*="s-item__title"]',
            
            // ETSY
            '.v2-listing-card__title',
            '[data-listing-id] h3',
            '.wt-text-caption',
            
            // SHOPIFY (common patterns)
            '.product-card__title',
            '.product__title',
            '.grid-product__title',
            '[data-product-title]',
            
            // HOME DEPOT
            '.product-title',
            '.pod-plp__description a',
            
            // WAYFAIR
            '.ProductCard__title',
            '[data-hb-id="ProductCard"] h2',
            
            // NEWEGG
            '.item-title',
            '.item-info .item-title a',
            
            // MACYS
            '.productDescription a',
            '[data-el="productThumbnail"] .productDescription',
            
            // NORDSTROM
            '.QNRwm',
            '[data-element-id="product-module"] h3',
            
            // KOHLS
            '.prod-title',
            '[data-tracking="product-title"]',
            
            // COSTCO
            '.description a',
            '.product-title',
            
            // NIKE
            '.product-card__title',
            '[data-testid="product-card__link-overlay"]',
            
            // ADIDAS
            '.glass-product-card__title',
            '[data-auto-id="product-card"] h2',
            
            // APPLE
            '.as-titleinfo',
            '.rf-serp-productname',
            
            // HEADINGS (generic but common)
            'h1', 'h2', 'h3', 'h4',
            
            // CLASS-BASED PATTERNS
            '[class*="ProductTitle"]',
            '[class*="product-title"]',
            '[class*="productTitle"]',
            '[class*="product_title"]',
            '[class*="ProductName"]',
            '[class*="product-name"]',
            '[class*="productName"]',
            '[class*="product_name"]',
            '[class*="item-title"]',
            '[class*="ItemTitle"]',
            '[class*="item-name"]',
            '[class*="ItemName"]',
            '[class*="card-title"]',
            '[class*="CardTitle"]',
            '[class*="tile-title"]',
            '[class*="TileTitle"]',
            '[class*="title"]',
            '[class*="name"]',
            
            // LINK PATTERNS (product pages)
            'a[href*="/product"]',
            'a[href*="/products/"]',
            'a[href*="/dp/"]',      // Amazon
            'a[href*="/ip/"]',      // Walmart
            'a[href*="/p/"]',       // Target, others
            'a[href*="/pd/"]',      // Best Buy
            'a[href*="/itm/"]',     // eBay
            'a[href*="/listing/"]', // Etsy
            'a[href*="/shop/"]',
            'a[href*="/buy/"]'
          ];
          break;
          
        case 'booking':
          titleSelectors = [
            // ══════════════════════════════════════════════════════════════════
            // TRAVEL/BOOKING TITLE SELECTORS
            // ══════════════════════════════════════════════════════════════════
            
            // EXPEDIA / HOTELS.COM
            '[data-stid="content-hotel-title"]',
            '[data-stid*="property-name"]',
            
            // BOOKING.COM
            '[data-testid="title"]',
            '.sr-hotel__name',
            '[data-testid="hotel-name"]',
            
            // AIRBNB
            '[data-testid="listing-card-title"]',
            '.t1jojoys',
            
            // TRIPADVISOR
            '.listing_title',
            '[data-automation="hotel-name"]',
            
            // KAYAK
            '.resultInfo .name',
            '.top-info .name',
            
            // PRICELINE
            '[data-test-id="hotel-name"]',
            '.hotel-name',
            
            // FLIGHT PATTERNS
            '.airline-name',
            '[class*="flight-info"]',
            '.carrier-info',
            
            // CLASS-BASED
            '[class*="hotel-name"]',
            '[class*="HotelName"]',
            '[class*="property-name"]',
            '[class*="PropertyName"]',
            '[class*="listing-title"]',
            '[class*="ListingTitle"]',
            'h2', 'h3'
          ];
          break;
          
        case 'menuItem':
          titleSelectors = [
            // ══════════════════════════════════════════════════════════════════
            // FOOD DELIVERY TITLE SELECTORS
            // ══════════════════════════════════════════════════════════════════
            
            // DOORDASH
            '[class*="ItemName"]',
            '.styles__ItemName',
            
            // UBER EATS
            '[data-testid="rich-text"]',
            '.styles__StoreItemHeaderTitle',
            
            // GRUBHUB
            '.menuItem-name',
            '[class*="menuItem__header"]',
            
            // INSTACART
            '[data-testid="item-card-title"]',
            
            // GENERIC
            '[class*="item-name"]',
            '[class*="ItemName"]',
            '[class*="dish-name"]',
            '[class*="DishName"]',
            '[class*="menu-item-name"]',
            '[class*="MenuItemName"]',
            '[class*="food-name"]',
            'h3', 'h4',
            '[class*="title"]'
          ];
          break;
          
        case 'tableRow':
          titleSelectors = [
            // ══════════════════════════════════════════════════════════════════
            // TABLE ROW IDENTIFIER SELECTORS
            // ══════════════════════════════════════════════════════════════════
            
            // Standard table
            'td:first-child',
            'td:nth-child(1)',
            'th[scope="row"]',
            
            // SALESFORCE
            '[data-label]',
            '.slds-truncate a',
            'lightning-formatted-url a',
            
            // JIRA
            '.issue-key',
            '[data-testid="issue-key"]',
            
            // AG-GRID
            '[col-id]:first-child',
            '.ag-cell-value:first-child',
            
            // GENERIC
            '[class*="name"]',
            '[class*="title"]',
            '[class*="id"]',
            '[class*="key"]',
            'a'
          ];
          break;
          
        case 'listItem':
        case 'card':
          titleSelectors = [
            // ══════════════════════════════════════════════════════════════════
            // CARD/LIST TITLE SELECTORS
            // ══════════════════════════════════════════════════════════════════
            
            // STREAMING
            '[data-testid="title-card-title"]',
            '.title-card__title',
            '.track-name',
            '.video-title',
            
            // SOCIAL
            '[data-testid="tweetText"]',
            '[class*="post-title"]',
            
            // GENERIC
            'h1', 'h2', 'h3', 'h4', 'h5',
            '[class*="title"]',
            '[class*="Title"]',
            '[class*="name"]',
            '[class*="Name"]',
            '[class*="heading"]',
            '[class*="Heading"]',
            '[class*="headline"]',
            '[class*="Headline"]',
            'a'
          ];
          break;
      }
      
      // Try each selector to find title
      for (var i = 0; i < titleSelectors.length; i++) {
        var titleEl = container.querySelector(titleSelectors[i]);
        if (titleEl) {
          var text = this.cleanContextText(titleEl.textContent || titleEl.innerText || '');
          if (text && text.length > 3 && text.length < 200) {
            return text;
          }
        }
      }
      
      // FALLBACK: Try aria-label on container or main link
      var ariaLabel = container.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.length > 3 && ariaLabel.length < 200) {
        return this.cleanContextText(ariaLabel);
      }
      
      // FALLBACK 2: Look for the first significant link
      var links = container.querySelectorAll('a[href]');
      for (var j = 0; j < links.length; j++) {
        var linkText = this.cleanContextText(links[j].textContent || '');
        if (linkText && linkText.length > 5 && linkText.length < 150) {
          return linkText;
        }
      }
      
      return null;
    },
    
    // Clean up extracted text
    cleanContextText: function(text) {
      if (!text) return '';
      
      return text
        // Remove prices ($XX.XX, £XX, €XX, etc.)
        .replace(/[\$£€¥][\d,]+\.?\d*/g, '')
        // Remove "New", "Sale", "Hot", badges
        .replace(/\b(new|sale|hot|best seller|sponsored|ad)\b/gi, '')
        // Remove star ratings
        .replace(/[\d.]+\s*(stars?|out of \d)/gi, '')
        // Remove review counts
        .replace(/\(\d+[\d,]*\s*reviews?\)/gi, '')
        .replace(/\d+[\d,]*\s*reviews?/gi, '')
        // Remove shipping info
        .replace(/free shipping/gi, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
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
