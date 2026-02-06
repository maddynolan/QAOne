/**
 * Smart Finder - Find elements using ElementRecipe
 * 
 * Uses a multi-phase approach:
 * 1. FAST PATH - Try remembered strategy from Strategy Memory (10ms)
 * 2. SCOPE - Narrow down the search area
 * 3. QUERY - Find candidates by what the element IS
 * 4. RESOLVE - Pick the right one if multiple matches
 * 5. FALLBACK - Try alternative strategies if needed
 * 6. LEARN - Remember successful strategy for next time
 * 
 * @author Flowstral
 * @version 3.0.0 - Now with Strategy Memory for learning
 */

const { getStrategyMemory } = require('./strategy-memory');

// ============================================================================
// SMART FINDER CLASS
// ============================================================================

class SmartFinder {
  constructor(page, options = {}) {
    this.page = page;
    this.timeout = options.timeout || 10000;
    this.debug = options.debug || false;
    
    // Strategy Memory for learning which strategies work
    this.strategyMemory = options.strategyMemory || getStrategyMemory();
    this.enableLearning = options.enableLearning !== false;  // Enable by default
    
    // Track execution time for optimization
    this._executionStartTime = null;
    
    // Telemetry for debugging failed attempts
    this.lastFailedAttempts = null;
    this.lastFailedRecipe = null;
    this.lastSuccessfulStrategy = null;  // For learning
    this.lastSuccessfulSelector = null;  // For Lock Locators feature
    this._currentRecipe = null;          // Current recipe being searched
    
    // Confidence tracking for each find operation
    this._lastFindResult = null;
    this._matchCount = 0;
    this._usedPosition = 1;
    this._exactTextMatch = null;
    this._fallbacksUsed = [];
    
    // Role equivalences for flexible matching
    // Format: expected role -> [acceptable actual roles]
    this.roleEquivalences = {
      'button': ['button', 'BUTTON', 'input', 'INPUT'],  // input[type=button/submit]
      'link': ['link', 'LINK', 'a', 'A'],
      'textbox': ['textbox', 'TEXTBOX', 'input', 'INPUT', 'textarea', 'TEXTAREA'],
      'checkbox': ['checkbox', 'CHECKBOX', 'input', 'INPUT'],
      'radio': ['radio', 'RADIO', 'input', 'INPUT'],
      'combobox': ['combobox', 'COMBOBOX', 'listbox', 'LISTBOX', 'select', 'SELECT'],
      'option': ['option', 'OPTION', 'menuitem', 'MENUITEM', 'li', 'LI'],
      'menuitem': ['menuitem', 'MENUITEM', 'option', 'OPTION', 'li', 'LI'],
      'tab': ['tab', 'TAB', 'button', 'BUTTON', 'a', 'A'],
      'slider': ['slider', 'SLIDER', 'input', 'INPUT'],
      'switch': ['switch', 'SWITCH', 'checkbox', 'CHECKBOX', 'input', 'INPUT'],
      'searchbox': ['searchbox', 'SEARCHBOX', 'textbox', 'TEXTBOX', 'input', 'INPUT'],
      'spinbutton': ['spinbutton', 'SPINBUTTON', 'input', 'INPUT'],
      'cell': ['cell', 'CELL', 'td', 'TD', 'gridcell', 'GRIDCELL'],
      'row': ['row', 'ROW', 'tr', 'TR'],
      'columnheader': ['columnheader', 'COLUMNHEADER', 'th', 'TH'],
      'img': ['img', 'IMG', 'image', 'IMAGE'],
      'treeitem': ['treeitem', 'TREEITEM', 'li', 'LI', 'option', 'OPTION'],
      'heading': ['heading', 'HEADING', 'h1', 'H1', 'h2', 'H2', 'h3', 'H3', 'h4', 'H4', 'h5', 'H5', 'h6', 'H6'],
    };
    
    // Element types that should NOT be clickable targets (likely wrong match)
    this.nonClickableRoles = ['textbox', 'searchbox', 'spinbutton', 'slider'];
    this.nonClickableTags = ['input', 'textarea'];
  }
  
  /**
   * Check if actual role matches expected role
   * Uses role equivalences for flexibility while preventing clearly wrong matches
   * @param {string} expectedRole - Role from recipe
   * @param {string} actualRole - Role/tag found on element
   * @param {string} actionType - 'click', 'fill', etc. to apply action-specific validation
   * @returns {boolean}
   */
  _roleMatches(expectedRole, actualRole, actionType = 'click') {
    if (!expectedRole) return true; // No expected role means accept anything
    if (!actualRole) return false;
    
    const normalizedExpected = expectedRole.toLowerCase();
    const normalizedActual = actualRole.toLowerCase();
    
    // Exact match
    if (normalizedExpected === normalizedActual) return true;
    
    // Check equivalences
    const acceptableRoles = this.roleEquivalences[normalizedExpected];
    if (acceptableRoles && acceptableRoles.map(r => r.toLowerCase()).includes(normalizedActual)) {
      return true;
    }
    
    // For click actions, reject elements that are clearly not clickable targets
    // (e.g., clicking should NOT match input fields)
    if (actionType === 'click') {
      // If expected is a clickable role (button, link, tab, etc.)
      // but actual is a form input, reject
      if (['button', 'link', 'tab', 'menuitem', 'option'].includes(normalizedExpected)) {
        if (['input', 'textarea', 'textbox', 'searchbox'].includes(normalizedActual)) {
          this.log(`Role mismatch: expected clickable ${expectedRole}, got input-type ${actualRole}`);
          return false;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if element is likely a wrong match for click actions
   * (e.g., matched a search input when looking for a button)
   * @param {Locator} locator - The found element
   * @param {string} expectedRole - What we expected
   * @returns {Promise<boolean>} - true if element seems wrong
   */
  async _isLikelyWrongClickTarget(locator, expectedRole) {
    if (!expectedRole) return false;
    
    try {
      const elementInfo = await locator.evaluate(el => {
        const tag = el.tagName.toLowerCase();
        const type = el.type?.toLowerCase() || '';
        const role = el.getAttribute('role') || '';
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const placeholder = (el.placeholder || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        
        const isInput = tag === 'input' || tag === 'textarea';
        
        // Comprehensive search input detection (especially for Salesforce)
        const isSearchBox = 
          type === 'search' || 
          role === 'searchbox' || 
          role === 'combobox' ||  // Salesforce global search uses combobox role
          placeholder.includes('search') ||
          ariaLabel.includes('search') ||
          name.includes('search') ||
          className.includes('search') ||
          id.includes('search') ||
          // Salesforce-specific patterns
          tag.includes('one-global-search') ||
          tag.includes('forcesearch') ||
          tag.includes('search-input') ||
          el.closest('one-global-search') !== null ||
          el.closest('forceSearch-searchbox') !== null ||
          el.closest('lightning-base-combobox') !== null ||
          // Generic combobox that looks like search
          (role === 'combobox' && isInput);
          
        // Also detect if this is a text input field (for form filling, not clicking)
        const isTextInput = isInput && ['text', 'email', 'password', 'tel', 'url', 'number', ''].includes(type);
        
        return { tag, type, role, isInput, isSearchBox, isTextInput, ariaLabel, placeholder };
      });
      
      // If looking for button/link/tab but found a search/text input
      if (['button', 'link', 'tab', 'menuitem', 'option'].includes(expectedRole.toLowerCase())) {
        if (elementInfo.isSearchBox) {
          this.log(`Wrong target detected: expected ${expectedRole}, found search input`);
          return true;
        }
        if (elementInfo.isTextInput) {
          this.log(`Wrong target detected: expected ${expectedRole}, found text input ${elementInfo.tag}[${elementInfo.type}]`);
          return true;
        }
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Update page reference (critical after navigation)
   * @param {Page} page - New Playwright page reference
   */
  updatePage(page) {
    this.page = page;
    this.log('Page reference updated');
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[SmartFinder]', ...args);
    }
  }
  
  // ==========================================================================
  // PRE-ACTION CHECKS - Ensure page is ready before finding elements
  // ==========================================================================
  
  /**
   * Wait for page to be stable before element finding
   * Handles: animations, lazy loading, framework hydration
   */
  async waitForPageStability(options = {}) {
    const { 
      maxWait = 5000,
      checkAnimations = true,
      checkNetwork = true 
    } = options;
    
    try {
      // 1. Wait for DOM to be ready
      await this.page.waitForLoadState('domcontentloaded', { timeout: maxWait }).catch(() => {});
      
      // 2. Wait for any running animations to complete
      if (checkAnimations) {
        await this.page.evaluate(() => {
          return new Promise((resolve) => {
            const animations = document.getAnimations();
            if (animations.length === 0) {
              resolve();
              return;
            }
            // Wait max 2 seconds for animations
            const timeout = setTimeout(resolve, 2000);
            Promise.all(animations.map(a => a.finished.catch(() => {})))
              .then(() => {
                clearTimeout(timeout);
                resolve();
              });
          });
        }).catch(() => {});
      }
      
      // 3. Wait for network to be idle (no pending XHR/fetch)
      if (checkNetwork) {
        await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      }
      
      // 4. Small buffer for React/Vue/Angular hydration
      await this.page.waitForTimeout(100);
      
      this.log('Page stability check complete');
    } catch (error) {
      this.log('Page stability check timed out (proceeding anyway):', error.message);
    }
  }
  
  /**
   * Dismiss any blocking overlays (cookie banners, modals, etc.)
   */
  async dismissBlockingOverlays() {
    try {
      const dismissed = await this.page.evaluate(() => {
        const dismissed = [];
        
        // Common cookie consent selectors
        const cookieSelectors = [
          '[id*="cookie"] button[class*="accept"]',
          '[id*="cookie"] button[class*="agree"]',
          '[class*="cookie"] button[class*="accept"]',
          '[class*="cookie"] button[class*="agree"]',
          '[data-testid*="cookie-accept"]',
          '#onetrust-accept-btn-handler',
          '.cc-accept',
          '[aria-label*="Accept cookies"]',
          '[aria-label*="Accept all"]',
        ];
        
        for (const selector of cookieSelectors) {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            dismissed.push('cookie-banner');
            break;
          }
        }
        
        // Common modal close selectors
        const modalCloseSelectors = [
          '[role="dialog"] [aria-label="Close"]',
          '[role="dialog"] button[class*="close"]',
          '.modal [class*="close"]',
          '[class*="popup"] [class*="close"]',
          '[data-dismiss="modal"]',
        ];
        
        for (const selector of modalCloseSelectors) {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            dismissed.push('modal');
            break;
          }
        }
        
        return dismissed;
      });
      
      if (dismissed.length > 0) {
        this.log('Dismissed overlays:', dismissed);
        await this.page.waitForTimeout(300); // Wait for animation
      }
    } catch (error) {
      this.log('Error dismissing overlays:', error.message);
    }
  }
  
  /**
   * Scroll element into view, accounting for sticky headers
   */
  async scrollIntoViewWithOffset(locator, offset = 100) {
    try {
      // First, scroll element into view
      await locator.scrollIntoViewIfNeeded();
      
      // Then, check if covered by sticky header and adjust
      const isCovered = await this.page.evaluate(async (offsetPx) => {
        // Get all sticky/fixed elements
        const allElements = document.querySelectorAll('*');
        let stickyHeight = 0;
        
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'sticky') {
            const rect = el.getBoundingClientRect();
            if (rect.top < offsetPx && rect.height > stickyHeight) {
              stickyHeight = rect.height;
            }
          }
        }
        
        return stickyHeight;
      }, offset);
      
      if (isCovered > 0) {
        await this.page.evaluate((scrollAmount) => {
          window.scrollBy(0, -scrollAmount - 20);
        }, isCovered);
      }
    } catch (error) {
      this.log('Scroll adjustment failed:', error.message);
    }
  }
  
  /**
   * Normalize text for matching - handles apostrophe variants and whitespace
   * Common issue: recorded "Saver's" vs page "Saver's" (curly vs straight apostrophe)
   */
  normalizeText(text) {
    // CRITICAL: Check for null, undefined, AND non-string types
    if (!text || typeof text !== 'string') {
      return typeof text === 'string' ? text : '';
    }
    return text
      // Normalize all apostrophe variants to straight apostrophe
      .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'")
      // Normalize all quote variants
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Strip dynamic content from text for more flexible matching
   * Handles counters, badges, timestamps that change between record/playback
   * Examples:
   *   "Cart (5)" → "Cart"
   *   "Messages [3]" → "Messages"
   *   "Updated - 2 min ago" → "Updated"
   *   "New Contact" → "Contact" (if "New" is a badge)
   */
  stripDynamicContent(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      // Remove parenthetical counters: "(5)", "( 12 )"
      .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
      // Remove bracketed counters: "[5]", "[ 12 ]"
      .replace(/\s*\[\s*\d+\s*\]\s*$/, '')
      // Remove dash counters: "- 5", " - 12"
      .replace(/\s*-\s*\d+\s*$/, '')
      // Remove common badges at start: "New ", "Updated ", "Active "
      .replace(/^(new|updated|active|draft|pending)\s+/i, '')
      // Remove time-ago suffixes: "2 min ago", "5 hours ago"
      .replace(/\s*-?\s*\d+\s*(min|hour|day|week|month|sec|second|minute)s?\s*(ago)?\s*$/i, '')
      // Remove "unread" or "read" suffixes
      .replace(/\s*\(?(un)?read\)?\s*$/i, '')
      .trim();
  }
  
  /**
   * Get multiple text variations for flexible matching
   * Returns array of texts to try, from most specific to most general
   */
  getTextVariations(text) {
    if (!text) return [];
    
    const variations = [];
    const normalized = this.normalizeText(text);
    const stripped = this.stripDynamicContent(normalized);
    
    // 1. Original normalized text
    variations.push(normalized);
    
    // 2. With dynamic content stripped (if different)
    if (stripped && stripped !== normalized && stripped.length >= 3) {
      variations.push(stripped);
    }
    
    // 3. First significant words (for long text)
    if (normalized.length > 30) {
      const firstPart = normalized.split(/\s+/).slice(0, 4).join(' ');
      if (firstPart.length >= 5) {
        variations.push(firstPart);
      }
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }
  
  /**
   * Create a regex that matches text with any apostrophe variant
   */
  createFlexibleTextRegex(text) {
    if (!text) return null;
    // Escape regex special chars except apostrophes
    let escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace apostrophes with a pattern that matches any apostrophe variant
    escaped = escaped.replace(/['\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "['\u2018\u2019\u201B\u2032\u0060\u00B4']");
    return new RegExp(escaped, 'i');
  }
  
  /**
   * Fix Salesforce missing 's' character issue
   * Salesforce sometimes renders text with 's' replaced by whitespace
   * e.g., "Li t" instead of "List", "U er" instead of "User"
   * This is a RECORDING issue but we also fix during PLAYBACK for robustness
   */
  _fixMissingSCharacter(text) {
    if (!text || typeof text !== 'string') return text;
    
    // First normalize all whitespace types (nbsp, thin space, etc.) to regular space
    text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    
    // Apply the missing 's' fixes using \s+ to catch any whitespace variations
    return text
      .replace(/Li\s+t\b/g, 'List')              // "Li t" -> "List"
      .replace(/U\s+er\b/g, 'User')              // "U er" -> "User"
      .replace(/Pa\s+word\b/g, 'Password')       // "Pa word" -> "Password"
      .replace(/Ca\s+e\b/g, 'Case')              // "Ca e" -> "Case"
      .replace(/Ta\s+k\b/g, 'Task')              // "Ta k" -> "Task"
      .replace(/A\s+et\b/g, 'Asset')             // "A et" -> "Asset"
      .replace(/Campa\s+gn\b/g, 'Campaign')      // "Campa gn" -> "Campaign"
      .replace(/Acc\s+ount\b/g, 'Account')       // "Acc ount" -> "Account"
      .replace(/Cont\s+act\b/g, 'Contact')       // "Cont act" -> "Contact"
      .replace(/Opp\s+ortunity\b/g, 'Opportunity')
      .replace(/Rec\s+ently\b/g, 'Recently')     // "Rec ently" -> "Recently"
      .replace(/View\s+ed\b/g, 'Viewed')         // "View ed" -> "Viewed"
      .replace(/Act\s+ive\b/g, 'Active')         // "Act ive" -> "Active"
      .replace(/\s{2,}/g, ' ')                   // Collapse multiple spaces
      .trim();
  }
  
  // ==========================================================================
  // MAIN FIND METHOD
  // ==========================================================================
  
  /**
   * Find an element using its recipe
   * @param {Object} recipe - The ElementRecipe
   * @param {Object} options - Optional options for finding
   * @param {boolean} options.skipCoordinateFallback - Skip coordinate strategies (cross-device)
   * @returns {Promise<Locator>} - Playwright locator
   */
  async find(recipe, options = {}) {
    this._executionStartTime = Date.now();
    this._resetTrackingState(); // Reset confidence tracking for new find
    
    // Store recipe for Lock Locators feature (used in _recordLearningAndReturn)
    this._currentRecipe = recipe;
    
    // Store cross-device flag for coordinate strategy decisions
    this._skipCoordinateFallback = options.skipCoordinateFallback || false;
    if (this._skipCoordinateFallback) {
      this.log('⚠️ Cross-device mode: Skipping coordinate-based fallback strategies');
    }
    
    this.log('Finding element:', JSON.stringify(recipe, null, 2));
    
    const { what, where, which, confirm } = recipe;
    
    // CRITICAL: Normalize text to fix recording issues (double spaces, apostrophe variants, missing 's')
    // This ensures playback works even if recording captured wrong characters
    if (what?.text) {
      what.text = this.normalizeText(what.text);
      // Also fix Salesforce missing 's' issue in the recorded text
      what.text = this._fixMissingSCharacter(what.text);
      this.log('Normalized text:', what.text);
    }
    if (which?.ariaLabel) {
      which.ariaLabel = this.normalizeText(which.ariaLabel);
      which.ariaLabel = this._fixMissingSCharacter(which.ariaLabel);
    }
    
    // Track what we tried (for debugging/healing)
    const attempts = [];
    
    // ==========================================================================
    // FAST PATH: Try remembered strategy from Strategy Memory
    // This skips the full search if we already know what works
    // SKIP fast path for generic buttons with scoping context!
    // SKIP fast path when recipe lacks direct text identification!
    // ==========================================================================
    
    // ==========================================================================
    // CONTEXT-AWARE ELEMENT FINDING
    // Handles: E-commerce products, Travel bookings, Food delivery, Table rows, etc.
    // If action has productContext (or similar), find the context first, then the button
    // ==========================================================================
    const action = options.action || {}; // Get action from options if provided
    const contextText = action?.productContext;
    if (contextText && what?.text) {
      this.log(`[CONTEXT SEARCH] Looking for "${what.text}" within context: "${contextText}"`);
      
      const contextResult = await this.tryStrategy('context-aware-search', async () => {
        // Escape special regex characters in context text for CSS selectors
        const escapedContext = contextText.replace(/['"]/g, '');
        
        // ─────────────────────────────────────────────────────────────────────
        // COMPREHENSIVE CONTAINER SELECTORS (ordered by specificity)
        // ─────────────────────────────────────────────────────────────────────
        const containerSelectors = [
          // AMAZON
          `[data-component-type="s-search-result"]:has-text("${escapedContext}")`,
          `[data-asin]:has-text("${escapedContext}")`,
          `.s-result-item:has-text("${escapedContext}")`,
          // WALMART
          `[data-item-id]:has-text("${escapedContext}")`,
          `[data-automation-id*="product"]:has-text("${escapedContext}")`,
          `[data-testid*="list-view"]:has-text("${escapedContext}")`,
          // TARGET
          `[data-test="@web/ProductCard"]:has-text("${escapedContext}")`,
          `[data-test="product-card"]:has-text("${escapedContext}")`,
          `[data-test*="ProductCard"]:has-text("${escapedContext}")`,
          // BEST BUY
          `.sku-item:has-text("${escapedContext}")`,
          `[data-sku-id]:has-text("${escapedContext}")`,
          // EBAY
          `.s-item:has-text("${escapedContext}")`,
          // ETSY
          `.v2-listing-card:has-text("${escapedContext}")`,
          `[data-listing-id]:has-text("${escapedContext}")`,
          // SHOPIFY
          `.product-card:has-text("${escapedContext}")`,
          `[data-product-id]:has-text("${escapedContext}")`,
          // TRAVEL SITES
          `[data-stid*="property-card"]:has-text("${escapedContext}")`,
          `[data-testid="property-card"]:has-text("${escapedContext}")`,
          `.sr_item:has-text("${escapedContext}")`,
          // FOOD DELIVERY
          `[data-anchor-id*="MenuItem"]:has-text("${escapedContext}")`,
          `[data-testid*="menu-item"]:has-text("${escapedContext}")`,
          // GENERIC (fallbacks)
          `article:has-text("${escapedContext}")`,
          `li:has-text("${escapedContext}")`,
          `[class*="product"]:has-text("${escapedContext}")`,
          `[class*="Product"]:has-text("${escapedContext}")`,
          `[class*="card"]:has-text("${escapedContext}")`,
          `[class*="Card"]:has-text("${escapedContext}")`,
          `[class*="item"]:has-text("${escapedContext}")`,
          `[class*="Item"]:has-text("${escapedContext}")`,
          `[class*="tile"]:has-text("${escapedContext}")`,
          `[class*="Tile"]:has-text("${escapedContext}")`,
          `[class*="result"]:has-text("${escapedContext}")`,
          `[role="listitem"]:has-text("${escapedContext}")`,
          `tr:has-text("${escapedContext}")`,
          `[role="row"]:has-text("${escapedContext}")`,
        ];
        
        for (const containerSelector of containerSelectors) {
          try {
            const container = this.page.locator(containerSelector).first();
            const containerCount = await container.count();
            
            if (containerCount > 0) {
              this.log(`[CONTEXT SEARCH] Found container with: ${containerSelector.substring(0, 60)}...`);
              
              // ─────────────────────────────────────────────────────────────────
              // COMPREHENSIVE BUTTON SELECTORS within the container
              // ─────────────────────────────────────────────────────────────────
              const buttonSelectors = [
                // Exact text match
                `button:has-text("${what.text}")`,
                `[role="button"]:has-text("${what.text}")`,
                `a:has-text("${what.text}")`,
                // Data attribute patterns
                `[data-test*="addToCart"]`,
                `[data-testid*="add-to-cart"]`,
                `[data-testid*="addToCart"]`,
                `[data-automation-id*="add"]`,
                `[data-test*="add"]`,
                // Class patterns
                `[class*="add-to-cart"]`,
                `[class*="addToCart"]`,
                `[class*="AddToCart"]`,
                `[class*="buy-button"]`,
                `[class*="BuyButton"]`,
                // Aria patterns
                `[aria-label*="add to cart" i]`,
                `[aria-label*="add to bag" i]`,
                `[aria-label*="buy" i]`,
                // Generic button with cart icon
                `button:has(svg[class*="cart"])`,
                `button:has([class*="cart-icon"])`,
                // Generic action buttons
                `button.primary`,
                `button[type="submit"]`,
                // Travel/Booking specific
                `[data-stid*="book"]`,
                `[data-testid*="select"]`,
                `button:has-text("Book")`,
                `button:has-text("Reserve")`,
                `button:has-text("Select")`,
                // Food delivery specific
                `button:has-text("Add")`,
                `[data-testid*="add-item"]`,
                // Table row actions
                `button:has-text("Edit")`,
                `button:has-text("Delete")`,
                `button:has-text("View")`,
                `[class*="action"]`,
              ];
              
              for (const btnSelector of buttonSelectors) {
                try {
                  const button = container.locator(btnSelector).first();
                  const btnCount = await button.count();
                  
                  if (btnCount > 0) {
                    // Verify button is visible and enabled
                    const isVisible = await button.isVisible().catch(() => false);
                    const isEnabled = await button.isEnabled().catch(() => true);
                    
                    if (isVisible && isEnabled) {
                      this.log(`[CONTEXT SEARCH] ✓ Found button "${what.text}" within "${contextText.substring(0, 30)}..."`);
                      this.log(`[CONTEXT SEARCH]   Container: ${containerSelector.substring(0, 50)}`);
                      this.log(`[CONTEXT SEARCH]   Button: ${btnSelector}`);
                      return { success: true, locator: button };
                    }
                  }
                } catch (e) {
                  // Try next button selector
                }
              }
              
              this.log(`[CONTEXT SEARCH] Found container but no matching button inside`);
            }
          } catch (e) {
            // Try next container selector
          }
        }
        
        // ─────────────────────────────────────────────────────────────────────
        // FALLBACK: Text-based search with proximity
        // Find the context text, then look for buttons nearby
        // ─────────────────────────────────────────────────────────────────────
        this.log(`[CONTEXT SEARCH] Trying text proximity fallback...`);
        
        try {
          const contextLocator = this.page.getByText(escapedContext, { exact: false }).first();
          if (await contextLocator.count() > 0) {
            // Find the nearest common ancestor that might be a card
            const ancestors = [
              contextLocator.locator('xpath=ancestor::article'),
              contextLocator.locator('xpath=ancestor::li'),
              contextLocator.locator('xpath=ancestor::*[contains(@class, "product")]'),
              contextLocator.locator('xpath=ancestor::*[contains(@class, "card")]'),
              contextLocator.locator('xpath=ancestor::*[contains(@class, "item")]'),
              contextLocator.locator('xpath=ancestor::*[@data-testid]'),
              contextLocator.locator('xpath=ancestor::*[@data-test]'),
            ];
            
            for (const ancestor of ancestors) {
              try {
                if (await ancestor.count() > 0) {
                  const container = ancestor.first();
                  const addButton = container.locator(`button:has-text("${what.text}")`).first();
                  if (await addButton.count() > 0) {
                    this.log(`[CONTEXT SEARCH] ✓ Found via text proximity!`);
                    return { success: true, locator: addButton };
                  }
                }
              } catch (e) {
                // Try next ancestor
              }
            }
          }
        } catch (e) {
          this.log(`[CONTEXT SEARCH] Text proximity failed: ${e.message}`);
        }
        
        return { success: false };
      }, attempts);
      
      if (contextResult.success) {
        return await this._recordLearningAndReturn(contextResult.locator);
      }
      
      this.log(`[CONTEXT SEARCH] All strategies failed, falling back to normal search...`);
    }
    
    // Generic button texts that are common across multiple components
    const GENERIC_BUTTON_TEXTS = ['new', 'edit', 'delete', 'save', 'cancel', 'close', 'submit', 'view all', 'add', 'remove', 'add to cart', 'buy', 'buy now'];
    const isGenericText = what?.text && GENERIC_BUTTON_TEXTS.includes(what.text.toLowerCase().trim());
    const hasSpecificContext = where?.relatedList || where?.componentName || confirm?.cssSelector?.includes('data-testid');
    
    // CRITICAL: If recipe only has tag (no text/role), CSS selectors are unreliable
    // This happens with checkboxes where text is in nearby label
    const hasOnlyTag = what?.tag && !what?.text && !what?.role;
    const hasOnlyNearText = !what?.text && where?.nearText;
    const cssIsPositional = confirm?.cssSelector && /nth-child|:first|:last|:eq\(/.test(confirm.cssSelector);
    
    // Skip fast path for:
    // 1. Generic buttons with specific context (need full scoping)
    // 2. Recipes with only tag + nearText (text verification not reliable with CSS)
    // 3. Positional CSS selectors (span:nth-child(1) can match wrong elements)
    const shouldSkipFastPath = (isGenericText && hasSpecificContext) || 
                               (hasOnlyTag && hasOnlyNearText && cssIsPositional);
    
    if (this.enableLearning && this.strategyMemory && !shouldSkipFastPath) {
      const fingerprint = this.strategyMemory.createFingerprint(recipe, action);
      const remembered = this.strategyMemory.getBestStrategy(fingerprint);
      
      if (remembered) {
        this.log(`[FAST PATH] Trying remembered strategy: ${remembered.strategy}`);
        
        try {
          const fastResult = await this._tryRememberedStrategy(remembered, recipe);
          if (fastResult.success) {
            const executionTime = Date.now() - this._executionStartTime;
            this.strategyMemory.recordSuccess(fingerprint, remembered.strategy, remembered.selector, executionTime);
            this.lastSuccessfulStrategy = remembered.strategy;
            this.log(`[FAST PATH] ✓ Success in ${executionTime}ms using remembered strategy`);
            return fastResult.locator;
          } else {
            // Remembered strategy failed - record and continue to full search
            this.strategyMemory.recordFailure(fingerprint, remembered.strategy);
            this.log(`[FAST PATH] Remembered strategy failed, falling back to full search`);
          }
        } catch (e) {
          this.log(`[FAST PATH] Error: ${e.message}, falling back to full search`);
        }
      }
      
      // Store fingerprint for learning later
      this._currentFingerprint = fingerprint;
    } else if (shouldSkipFastPath) {
      // Log specific reason for skipping
      if (isGenericText && hasSpecificContext) {
        this.log(`[FAST PATH] Skipped for generic text "${what?.text}" with specific context`);
      } else if (hasOnlyTag && hasOnlyNearText && cssIsPositional) {
        this.log(`[FAST PATH] Skipped: Recipe has only tag "${what?.tag}" + nearText "${where?.nearText}" with positional CSS - too risky for fast path`);
      }
      // Still create fingerprint for learning
      if (this.enableLearning && this.strategyMemory) {
        this._currentFingerprint = this.strategyMemory.createFingerprint(recipe, action);
      }
    }
    
    // ==========================================================================
    // PHASE 0: Try testId first (most reliable)
    // ==========================================================================
    
    if (which?.testId) {
      const result = await this.tryStrategy('testId', async () => {
        const locator = this.page.getByTestId(which.testId);
        return await this.validateLocator(locator, 'testId');
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
    }
    
    // ==========================================================================
    // PHASE 0.5: Extract and try data-testid from CSS selector (Salesforce pattern)
    // Salesforce often puts testIds in the confirm.cssSelector like:
    // [data-testid="sfdc:StandardButton.Opportunity.New"] > a
    // ==========================================================================
    
    if (confirm?.cssSelector) {
      // Extract data-testid from CSS selector
      const testIdMatch = confirm.cssSelector.match(/\[data-testid=["']([^"']+)["']\]/);
      if (testIdMatch) {
        const extractedTestId = testIdMatch[1];
        this.log(`Extracted Salesforce testId from CSS: ${extractedTestId}`);
        
        const sfTestIdResult = await this.tryStrategy('sf-testid-extracted', async () => {
          // Try the full attribute selector first
          const locator = this.page.locator(`[data-testid="${extractedTestId}"]`);
          const validated = await this.validateLocator(locator, 'sf-testid-extracted');
          if (validated.success) return validated;
          
          // Try finding the child element (e.g., the <a> inside)
          const childLocator = this.page.locator(`[data-testid="${extractedTestId}"] a, [data-testid="${extractedTestId}"] button`).first();
          return await this.validateLocator(childLocator, 'sf-testid-extracted-child');
        }, attempts);
        
        if (sfTestIdResult.success) return sfTestIdResult.locator;
      }
    }
    
    // ==========================================================================
    // PHASE 1: SCOPE - Narrow down the search area
    // ==========================================================================
    
    let scope = this.page;
    
    // PRIORITY 0: Salesforce Component ID scoping (most specific)
    // Use data-component-id to scope to specific Salesforce component containers
    // This is critical for distinguishing "New" buttons in different related lists
    if (where?.componentName && !where?.relatedList) {
      this.log(`Salesforce component scope: "${where.componentName}"`);
      const componentResult = await this.tryStrategy('sf-component-scope', async () => {
        // Match component name patterns like "force_relatedListContainer" to data-component-id
        // Salesforce uses formats like: force_relatedListContainer, forceRelatedListContainer, etc.
        const componentName = where.componentName;
        
        // Build selectors for the component
        const componentSelectors = [
          // Exact match
          `[data-component-id="${componentName}"]`,
          // Partial match (component ID may have additional suffixes)
          `[data-component-id*="${componentName}"]`,
          // Class-based (some components use classes instead)
          `.${componentName}`,
          // Try with different case variations
          `[data-component-id*="${componentName.toLowerCase()}"]`,
          `[data-component-id*="${componentName.replace(/_/g, '')}"]`,
        ];
        
        for (const selector of componentSelectors) {
          try {
            const locator = this.page.locator(selector);
            const count = await locator.count().catch(() => 0);
            if (count > 0) {
              this.log(`✓ Scoped to Salesforce component: "${componentName}" via ${selector}`);
              return { success: true, scope: locator.first() };
            }
          } catch (e) {
            this.log(`Component selector failed: ${selector} - ${e.message}`);
          }
        }
        
        // FALLBACK: For related list containers, try to find by position using bounding box
        // The recorded bounding box tells us the Y position of the target "New" button
        if (confirm?.boundingBox && what?.text?.toLowerCase() === 'new') {
          const targetY = confirm.boundingBox.y;
          this.log(`Trying bounding box fallback: target Y = ${targetY}`);
          
          // Find all "New" buttons and pick the one closest to the recorded Y position
          const newButtons = await this.page.locator('button:has-text("New"), a:has-text("New")').all();
          this.log(`Found ${newButtons.length} "New" buttons on page`);
          
          let closestButton = null;
          let closestDistance = Infinity;
          
          for (const btn of newButtons) {
            try {
              const box = await btn.boundingBox();
              if (box) {
                const distance = Math.abs(box.y - targetY);
                this.log(`  Button at Y=${box.y}, distance=${distance}`);
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestButton = btn;
                }
              }
            } catch (e) {
              // Button not visible
            }
          }
          
          // Accept if within 100px of recorded position
          if (closestButton && closestDistance < 100) {
            this.log(`✓ Found "New" button by bounding box proximity (distance: ${closestDistance}px)`);
            return { success: true, locator: closestButton };
          }
        }
        
        this.log(`✗ Could not scope to component "${componentName}"`);
        return { success: false };
      }, attempts);
      
      if (componentResult.success) {
        if (componentResult.scope) {
          scope = componentResult.scope;
        } else if (componentResult.locator) {
          // Direct locator match from bounding box - return immediately
          return await this._recordLearningAndReturn(componentResult.locator);
        }
      }
    }
    
    // PRIORITY 1: Salesforce Related List scoping (most specific)
    // This is CRITICAL for distinguishing "New" buttons in different related lists
    if (where?.relatedList) {
      this.log(`Salesforce related list scope: "${where.relatedList}"`);
      const relatedListResult = await this.tryStrategy('sf-related-list-scope', async () => {
        // Find the related list container by its header text
        const relatedListText = where.relatedList;
        
        // APPROACH 1: Use page.evaluate to find container with matching header
        // This is more reliable than complex CSS selectors
        const containerHandle = await this.page.evaluateHandle((headerText) => {
          // Look for any card/container with a header containing this text
          const allContainers = document.querySelectorAll(
            'lst-related-list-single-container, lst-related-list-container, ' +
            'article.slds-card, lightning-card, flexipage-component2, ' +
            '[data-component-id*="Related"], .forceRelatedListContainer'
          );
          
          for (const container of allContainers) {
            const header = container.querySelector(
              '.slds-card__header-title, .slds-text-heading--small, ' +
              '[slot="title"], h2, .header-title, .forceRelatedListCardHeader'
            );
            if (header) {
              const text = (header.textContent || '').trim().replace(/\s*\(\d+\)\s*$/, '');
              // Check if header contains or matches our target
              if (text.toLowerCase().includes(headerText.toLowerCase()) ||
                  headerText.toLowerCase().includes(text.toLowerCase())) {
                return container;
              }
            }
          }
          return null;
        }, relatedListText);
        
        if (containerHandle) {
          const element = containerHandle.asElement();
          if (element) {
            // Convert ElementHandle to Locator using a unique selector
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            const dataComponentId = await element.evaluate(el => el.getAttribute('data-component-id'));
            
            if (dataComponentId) {
              const locator = this.page.locator(`[data-component-id="${dataComponentId}"]`);
              const count = await locator.count().catch(() => 0);
              if (count > 0) {
                this.log(`✓ Scoped to Salesforce related list: "${relatedListText}" via data-component-id`);
                return { success: true, scope: locator.first() };
              }
            }
            
            // Fallback: use the element handle directly as scope
            this.log(`✓ Scoped to Salesforce related list: "${relatedListText}" via evaluateHandle`);
            // Create a locator that matches this specific container
            const locator = this.page.locator(`${tagName}:has-text("${relatedListText}")`).first();
            return { success: true, scope: locator };
          }
        }
        
        // APPROACH 2: Try CSS selectors as fallback
        const relatedListSelectors = [
          // Card with matching header - use :has-text instead of :text-is
          `lst-related-list-single-container:has-text("${relatedListText}")`,
          `article.slds-card:has-text("${relatedListText}")`,
          `lightning-card:has-text("${relatedListText}")`,
          `[data-component-id*="Related"]:has-text("${relatedListText}")`,
          `flexipage-component2:has-text("${relatedListText}")`,
          `.forceRelatedListContainer:has-text("${relatedListText}")`,
        ];
        
        for (const selector of relatedListSelectors) {
          try {
            const locator = this.page.locator(selector);
            const count = await locator.count().catch(() => 0);
            if (count > 0) {
              this.log(`✓ Scoped to Salesforce related list: "${relatedListText}" via ${selector.substring(0, 50)}...`);
              return { success: true, scope: locator.first() };
            }
          } catch (e) {
            this.log(`Related list selector failed: ${selector.substring(0, 50)}... - ${e.message}`);
          }
        }
        
        this.log(`✗ Could not scope to related list "${relatedListText}" - will use position fallback`);
        return { success: false };
      }, attempts);
      
      if (relatedListResult.success && relatedListResult.scope) {
        scope = relatedListResult.scope;
      }
    }
    
    // PRIORITY 2: Skip activity timeline if we're NOT looking for activity items
    if (where?.isActivityTimeline === false || 
        (where?.relatedList && !where.isActivityTimeline)) {
      // Explicitly exclude activity timeline when looking for related list items
      this.log('Excluding activity timeline from search scope');
    }
    
    // PRIORITY 3: Container role scoping
    if (scope === this.page && where?.within) {
      const scoped = await this.tryScope(where.within, attempts);
      if (scoped) scope = scoped;
    }
    // PRIORITY 4: Landmark scoping (least specific)
    else if (scope === this.page && where?.landmark) {
      const scoped = await this.tryScope(where.landmark, attempts);
      if (scoped) scope = scoped;
    }
    
    // ==========================================================================
    // PHASE 1.5: SALESFORCE LIST VIEW SELECTOR (special handling)
    // List View selectors are buttons that open a dropdown, NOT search inputs
    // CRITICAL: This must come BEFORE general strategies to prevent clicking search box
    // CRITICAL: Skip this for OPTIONS - they are items IN the dropdown, not the trigger!
    // ==========================================================================
    
    // Skip list view BUTTON detection if we're looking for an OPTION or MENUITEM
    // These are items inside the dropdown, not the dropdown trigger itself
    const isOptionRole = what?.role && ['option', 'menuitem', 'listitem', 'treeitem'].includes(what.role.toLowerCase());
    
    // Normalize text for comparison (handle the "Li t" -> "List" issue)
    const normalizedText = what?.text?.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/Li\s+t\b/gi, 'List')
      .replace(/Rec\s+ently\b/gi, 'Recently')
      .replace(/View\s+ed\b/gi, 'Viewed')
      .replace(/Act\s+ive\b/gi, 'Active') || '';
    
    // Only trigger list view BUTTON detection for button-like elements, NOT options
    const isListViewTrigger = !isOptionRole && normalizedText && (
      /list\s*view/i.test(normalizedText) ||
      /recently\s*viewed/i.test(normalizedText) ||
      /select\s+a\s+list/i.test(normalizedText)  // More specific - "Select a List View"
    );
    
    if (isListViewTrigger) {
      this.log(`Salesforce list view detection: "${what.text}" (normalized: "${normalizedText}")`);
      
      // Try Salesforce-specific list view selectors - ORDERED by specificity
      const sfListViewSelectors = [
        // Most specific: List view picker in page header
        `button[title*="Select a List View"]`,
        `button[title*="Select List View"]`,
        `button[aria-label*="Select a List View"]`,
        `button[aria-label*="Select List View"]`,
        // Lightning button menu (common for list views)
        `lightning-button-menu[data-tab-name] button`,
        `lightning-button-menu button[title]`,
        `lightning-button-menu button[aria-haspopup="true"]`,
        // Page header buttons with popup behavior
        `.slds-page-header button[aria-haspopup="true"]`,
        `.slds-page-header button[aria-haspopup="listbox"]`,
        `.slds-page-header button[aria-haspopup="menu"]`,
        // Text-based matches for "Recently Viewed" dropdown
        `button:has-text("Recently Viewed")`,
        `[role="button"]:has-text("Recently Viewed")`,
        // Salesforce list header components
        `lst-list-view-manager-header button`,
        `lst-list-view-manager-header [role="button"]`,
        `.listViewContainer button`,
        `[data-component-id*="listView"] button`,
        // Generic page header button with title
        `.slds-page-header button[title]`,
        `.slds-page-header__title button`,
      ];
      
      for (const selector of sfListViewSelectors) {
        const sfResult = await this.tryStrategy(`sf-listview-${selector.substring(0, 25)}`, async () => {
          const locator = this.page.locator(selector).first();
          const count = await locator.count();
          if (count > 0) {
            const isVisible = await locator.isVisible().catch(() => false);
            if (isVisible) {
              // CRITICAL: Make sure this is NOT a search input or combobox search
              const isSearchInput = await locator.evaluate(el => {
                const tag = el.tagName.toLowerCase();
                const type = (el.type || '').toLowerCase();
                const role = (el.getAttribute('role') || '').toLowerCase();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const placeholder = (el.placeholder || '').toLowerCase();
                
                // Reject any search-related inputs
                const isSearch = tag === 'input' || 
                  type === 'search' || 
                  type === 'text' ||
                  role === 'searchbox' ||
                  (role === 'combobox' && (ariaLabel.includes('search') || placeholder.includes('search'))) ||
                  ariaLabel.includes('search') ||
                  placeholder.includes('search') ||
                  el.closest('one-global-search') !== null ||
                  el.closest('[class*="global-search"]') !== null;
                  
                return isSearch;
              }).catch(() => false);
              
              if (!isSearchInput) {
                return { success: true, locator, count: 1 };
              } else {
                this.log(`sf-listview: Rejected search input for selector: ${selector}`);
              }
            }
          }
          return { success: false, count: 0 };
        }, attempts);
        
        if (sfResult.success) {
          this.log(`✓ Found Salesforce list view button via: ${selector}`);
          return await this._recordLearningAndReturn(sfResult.locator);
        }
      }
      
      this.log(`⚠ Salesforce list view detection failed, falling back to general strategies`);
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
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
      
      // APOSTROPHE FIX: Try with flexible apostrophe matching
      // e.g., recorded "Saver's" vs page "Saver's" (curly vs straight apostrophe)
      const flexibleTextRegex = this.createFlexibleTextRegex(what.text);
      if (flexibleTextRegex) {
        const apostropheResult = await this.tryStrategy('role+text-apostrophe-flex', async () => {
          const locator = scope.getByRole(what.role, { name: flexibleTextRegex });
          return await this.resolveMultiple(locator, which, 'role+text-apostrophe-flex');
        }, attempts);
        
        if (apostropheResult.success) return apostropheResult.locator;
      }
      
      // RADIX FIX: Try without trailing 's' (Radix tabs use singular accessible names)
      // e.g., recorded "Tables" but accessible name is "Table"
      if (what.role === 'tab' && what.text.endsWith('s')) {
        const singularText = what.text.slice(0, -1);
        const singularResult = await this.tryStrategy('role+text-singular', async () => {
          const locator = scope.getByRole(what.role, { name: singularText });
          return await this.resolveMultiple(locator, which, 'role+text-singular');
        }, attempts);
        
        if (singularResult.success) return singularResult.locator;
      }
      
      // Try regex matching (handles partial matches)
      const regexResult = await this.tryStrategy('role+text-regex', async () => {
        // Create regex that matches the text anywhere in accessible name
        const escapedText = what.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const locator = scope.getByRole(what.role, { name: new RegExp(escapedText, 'i') });
        return await this.resolveMultiple(locator, which, 'role+text-regex');
      }, attempts);
      
      if (regexResult.success) return regexResult.locator;
      
      // MULTI-ROLE FALLBACK: Try alternative clickable roles if initial role failed
      // This handles misclassified elements (e.g., link styled as button or vice versa)
      // IMPORTANT: Only fall back between SIMILAR roles to avoid clicking wrong element
      // - button ↔ link (styled interchangeably)
      // - menuitem ↔ option (similar selection concepts)
      // - tab is unique (don't fall back)
      const roleFallbackMap = {
        'button': ['link'],           // Button might be styled as link
        'link': ['button'],           // Link might be styled as button
        'menuitem': ['option'],       // Menu items vs options
        'option': ['menuitem'],
        'tab': [],                    // Tabs are unique, don't fall back
      };
      
      const alternativeRoles = roleFallbackMap[what.role] || [];
      
      // ONLY do role fallback if we're still within the correct landmark scope
      // This prevents clicking a nav link when we wanted a button in main content
      const isInCorrectScope = scope !== this.page; // We have a scoped search
      
      if (isInCorrectScope && alternativeRoles.length > 0) {
        for (const altRole of alternativeRoles) {
          const altResult = await this.tryStrategy(`role-alt-${altRole}`, async () => {
            const flexRegex = this.createFlexibleTextRegex(what.text);
            const locator = scope.getByRole(altRole, { name: flexRegex || new RegExp(what.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
            return await this.resolveMultiple(locator, which, `role-alt-${altRole}`);
          }, attempts);
          
          if (altResult.success) {
            this.log(`Found with alternative role "${altRole}" instead of "${what.role}" (within scope)`);
            return altResult.locator;
          }
        }
      }
    }
    
    // Try role-only with position if text didn't work
    // CRITICAL: Must validate element text matches to avoid clicking wrong element!
    if (what?.role && which?.position) {
      const result = await this.tryStrategy('role+position', async () => {
        const locator = scope.getByRole(what.role);
        const count = await locator.count();
        if (count > 0 && which.position <= count) {
          const candidate = locator.nth(which.position - 1);
          
          // CRITICAL FIX: Validate the element's text contains our expected text
          // This prevents clicking "New Event" when we want "New" button for Opportunity
          if (what.text) {
            const elementText = await candidate.textContent().catch(() => '');
            const normalizedElementText = this.normalizeText(elementText || '');
            const normalizedExpectedText = this.normalizeText(what.text);
            
            // Check if the element text matches (contains or matches)
            const textMatches = normalizedElementText.toLowerCase().includes(normalizedExpectedText.toLowerCase()) ||
                               normalizedExpectedText.toLowerCase().includes(normalizedElementText.toLowerCase());
            
            if (!textMatches) {
              this.log(`role+position: Element at position ${which.position} has text "${normalizedElementText}", expected "${normalizedExpectedText}" - SKIPPING`);
              return { success: false, reason: 'text mismatch' };
            }
          }
          
          return { success: true, locator: candidate };
        }
        return { success: false };
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
    }
    
    // ==========================================================================
    // PHASE 2.5: SALESFORCE "NEW" BUTTON DISAMBIGUATION
    // When related list scoping failed and we have multiple "New" buttons,
    // use the parent container's object type to find the right one
    // ==========================================================================
    if (what?.text?.toLowerCase() === 'new' && where?.relatedList && scope === this.page) {
      this.log(`Salesforce "New" button disambiguation for related list: "${where.relatedList}"`);
      const sfNewResult = await this.tryStrategy('sf-new-button', async () => {
        // Find all "New" buttons/links on the page
        const newButtons = await this.page.evaluateHandle((targetList) => {
          const buttons = Array.from(document.querySelectorAll('a, button'));
          const newButtonsInList = [];
          
          for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text.toLowerCase() !== 'new') continue;
            
            // Walk up to find the related list container
            let container = btn.closest(
              'lst-related-list-single-container, lst-related-list-container, ' +
              'article.slds-card, lightning-card, flexipage-component2, ' +
              '[data-component-id*="Related"], .forceRelatedListContainer'
            );
            
            if (container) {
              const header = container.querySelector(
                '.slds-card__header-title, .slds-text-heading--small, ' +
                '[slot="title"], h2, .header-title, .forceRelatedListCardHeader'
              );
              if (header) {
                const headerText = (header.textContent || '').trim().replace(/\s*\(\d+\)\s*$/, '');
                // Check if this matches our target related list
                if (headerText.toLowerCase().includes(targetList.toLowerCase()) ||
                    targetList.toLowerCase().includes(headerText.toLowerCase())) {
                  return btn;
                }
              }
            }
            
            // Also check the href for object type hints
            const href = btn.getAttribute('href') || '';
            const targetLower = targetList.toLowerCase();
            // e.g., href contains "/Opportunity/new" for Opportunities list
            if (href.toLowerCase().includes(`/${targetLower.replace(/ies$/, 'y').replace(/s$/, '')}/new`) ||
                href.toLowerCase().includes(`/${targetLower}/new`)) {
              return btn;
            }
          }
          
          return null;
        }, where.relatedList);
        
        if (sfNewResult) {
          const element = sfNewResult.asElement();
          if (element) {
            // Get identifying attributes to create a locator
            const attrs = await element.evaluate(el => ({
              tagName: el.tagName.toLowerCase(),
              href: el.getAttribute('href'),
              title: el.getAttribute('title'),
              ariaLabel: el.getAttribute('aria-label'),
              dataRefid: el.getAttribute('data-refid'),
            }));
            
            // Try to create a specific locator
            if (attrs.href) {
              const locator = this.page.locator(`${attrs.tagName}[href="${attrs.href}"]:has-text("New")`);
              if (await locator.count() === 1) {
                this.log(`✓ Found "New" button for "${where.relatedList}" via href`);
                return { success: true, locator: locator.first() };
              }
            }
            if (attrs.dataRefid) {
              const locator = this.page.locator(`[data-refid="${attrs.dataRefid}"]`);
              if (await locator.count() === 1) {
                this.log(`✓ Found "New" button for "${where.relatedList}" via data-refid`);
                return { success: true, locator: locator.first() };
              }
            }
            
            // Fallback: click the element directly
            this.log(`✓ Found "New" button for "${where.relatedList}" via evaluateHandle (direct click)`);
            await element.click();
            return { success: true, locator: null, directClick: true };
          }
        }
        
        return { success: false };
      }, attempts);
      
      if (sfNewResult.success) {
        if (sfNewResult.directClick) {
          // Already clicked in the strategy - return a marker object
          // The caller (playwright-recorder.js) will see this and skip the click
          this.log('✓ Salesforce "New" button already clicked via direct element access');
          const marker = { __directClickComplete: true };
          return marker;
        }
        return await this._recordLearningAndReturn(sfNewResult.locator);
      }
    }
    
    // ==========================================================================
    // PHASE 2.6: NEAR TEXT STRATEGY (BEFORE text-based methods)
    // Critical for checkboxes, radio buttons where the clickable element is
    // NEXT TO the label text, not containing it directly
    // This runs REGARDLESS of whether what.text exists!
    // ==========================================================================
    
    if (where?.nearText && !what?.text) {
      // Only run this specialized strategy when:
      // - We have nearText (label text nearby)
      // - We DON'T have what.text (can't use normal text strategies)
      // This is the checkbox/radio scenario
      
      this.log(`[PHASE 2.6] nearText strategy: "${where.nearText}" (no direct text)`);
      
      const nearTextResult = await this.tryStrategy('near-text-specialized', async () => {
        const searchText = this.normalizeText(where.nearText);
        this.log(`[near-text] Looking for clickable element near "${searchText}"`);
        
        // Use Playwright's getByText to find the label text first
        const textLocator = scope.getByText(searchText, { exact: false });
        const textCount = await textLocator.count();
        
        this.log(`[near-text] Found ${textCount} text elements matching "${searchText}"`);
        
        if (textCount > 0) {
          // Iterate through text matches to find the RIGHT one
          for (let i = 0; i < Math.min(textCount, 5); i++) {
            const textEl = textLocator.nth(i);
            
            // Verify this text element contains our exact text (not just partial match)
            const elText = await textEl.textContent().catch(() => '');
            const normalizedElText = this.normalizeText(elText || '').toLowerCase().trim();
            const normalizedSearch = searchText.toLowerCase().trim();
            
            // STRICTER MATCHING: Check if the text is a close match
            // Option 1: Element text starts with search text
            // Option 2: Element text is very similar (for minor whitespace/formatting diffs)
            // Option 3: Search text is contained BUT element is not much longer (to avoid partial matches)
            const startsWithMatch = normalizedElText.startsWith(normalizedSearch);
            const exactMatch = normalizedElText === normalizedSearch;
            const containsMatch = normalizedElText.includes(normalizedSearch);
            const lengthRatio = normalizedElText.length / normalizedSearch.length;
            
            // Only accept if:
            // - Exact match
            // - Starts with the search text
            // - Contains the search text AND length is within 50% (avoids "I am..." matching "I have...")
            const isGoodMatch = exactMatch || startsWithMatch || (containsMatch && lengthRatio < 1.5);
            
            if (!isGoodMatch) {
              this.log(`[near-text] Skipping text element ${i}: "${elText.substring(0, 50)}" doesn't closely match "${normalizedSearch.substring(0, 50)}"`);
              continue;
            }
            
            this.log(`[near-text] Checking text element ${i}: "${elText}"`);
            
            // Strategy 1: Check for checkbox/radio in same label structure
            try {
              const checkboxInLabel = textEl.locator('xpath=ancestor::label//input[@type="checkbox" or @type="radio"]').first();
              if (await checkboxInLabel.count() > 0 && await checkboxInLabel.isVisible()) {
                this.log(`[near-text] ✓ Found checkbox/radio input in label ancestor`);
                return { success: true, locator: checkboxInLabel };
              }
            } catch (e) { /* continue */ }
            
            // Strategy 2: Check for custom checkbox role in label
            try {
              const roleCheckbox = textEl.locator('xpath=ancestor::label//*[@role="checkbox" or @role="radio" or @role="switch"]').first();
              if (await roleCheckbox.count() > 0 && await roleCheckbox.isVisible()) {
                this.log(`[near-text] ✓ Found role=checkbox in label ancestor`);
                return { success: true, locator: roleCheckbox };
              }
            } catch (e) { /* continue */ }
            
            // Strategy 3: Check preceding sibling (checkbox before text)
            try {
              const precedingInput = textEl.locator('xpath=preceding-sibling::input[@type="checkbox" or @type="radio"]').first();
              if (await precedingInput.count() > 0 && await precedingInput.isVisible()) {
                this.log(`[near-text] ✓ Found checkbox as preceding sibling`);
                return { success: true, locator: precedingInput };
              }
              
              const precedingSpan = textEl.locator('xpath=preceding-sibling::span[contains(@class,"check") or @role="checkbox"]').first();
              if (await precedingSpan.count() > 0 && await precedingSpan.isVisible()) {
                this.log(`[near-text] ✓ Found checkbox span as preceding sibling`);
                return { success: true, locator: precedingSpan };
              }
            } catch (e) { /* continue */ }
            
            // Strategy 4: Check parent's first child (common: <label><span class="checkbox"></span>Text</label>)
            try {
              const parent = textEl.locator('xpath=parent::*');
              const firstChild = parent.locator(':scope > *:first-child');
              if (await firstChild.count() > 0) {
                const fcTag = await firstChild.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
                const fcType = await firstChild.getAttribute('type').catch(() => '');
                const fcRole = await firstChild.getAttribute('role').catch(() => '');
                const fcClass = await firstChild.getAttribute('class').catch(() => '');
                
                if (fcType === 'checkbox' || fcType === 'radio' || 
                    fcRole === 'checkbox' || fcRole === 'radio' ||
                    fcClass?.includes('check') || fcClass?.includes('radio')) {
                  if (await firstChild.isVisible()) {
                    this.log(`[near-text] ✓ Found checkbox as parent's first child (${fcTag}, type=${fcType}, role=${fcRole})`);
                    return { success: true, locator: firstChild };
                  }
                }
              }
            } catch (e) { /* continue */ }
            
            // Strategy 5: Look for label with "for" attribute
            try {
              const label = textEl.locator('xpath=ancestor::label[@for]').first();
              if (await label.count() > 0) {
                const forId = await label.getAttribute('for');
                if (forId) {
                  const forTarget = this.page.locator(`#${forId}`);
                  if (await forTarget.count() > 0 && await forTarget.isVisible()) {
                    this.log(`[near-text] ✓ Found checkbox via label[for="${forId}"]`);
                    return { success: true, locator: forTarget };
                  }
                }
              }
            } catch (e) { /* continue */ }
          }
        }
        
        return { success: false, count: 0 };
      }, attempts);
      
      if (nearTextResult.success) {
        this.log(`[near-text] Successfully found checkbox near "${where.nearText}"`);
        return await this._recordLearningAndReturn(nearTextResult.locator);
      }
      
      this.log(`[near-text] No checkbox found near "${where.nearText}", continuing to other strategies`);
    }
    
    // ==========================================================================
    // PHASE 3: Try text-based methods
    // ==========================================================================
    
    if (what?.text) {
      // Try exact text match
      const result = await this.tryStrategy('text-exact', async () => {
        const locator = scope.getByText(what.text, { exact: true });
        const validated = await this.resolveMultiple(locator, which, 'text-exact');
        
        // CRITICAL: If role is specified (e.g., button/link), validate element matches
        // This prevents clicking on search inputs when looking for buttons with matching text
        if (validated.success && what.role) {
          if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
            this.log(`text-exact: rejected ${what.text} - wrong target type for ${what.role}`);
            return { success: false, count: 0 };
          }
        }
        
        return validated;
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
      
      // APOSTROPHE FIX: Try with flexible apostrophe matching for text
      const flexibleTextRegex = this.createFlexibleTextRegex(what.text);
      if (flexibleTextRegex) {
        const apostropheResult = await this.tryStrategy('text-apostrophe-flex', async () => {
          const locator = scope.getByText(flexibleTextRegex);
          const validated = await this.resolveMultiple(locator, which, 'text-apostrophe-flex');
          
          // Validate for role mismatch
          if (validated.success && what.role) {
            if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
              this.log(`text-apostrophe-flex: rejected - wrong target type for ${what.role}`);
              return { success: false, count: 0 };
            }
          }
          
          return validated;
        }, attempts);
        
        if (apostropheResult.success) return apostropheResult.locator;
      }
      
      // Try getByLabel (for form elements)
      // CRITICAL FIX: Validate that matched element is actually a form input
      if (where?.nearText) {
        const labelResult = await this.tryStrategy('label', async () => {
          const locator = scope.getByLabel(where.nearText);
          const validated = await this.validateLocator(locator, 'label');
          
          // Extra validation: getByLabel can match non-inputs, so verify
          if (validated.success) {
            const isFormElement = await validated.locator.evaluate(el => {
              const tag = el.tagName.toLowerCase();
              return tag === 'input' || tag === 'textarea' || tag === 'select' ||
                     el.hasAttribute('contenteditable') ||
                     el.getAttribute('role') === 'textbox' ||
                     el.getAttribute('role') === 'combobox';
            }).catch(() => false);
            
            if (!isFormElement) {
              this.log(`getByLabel("${where.nearText}") matched non-form element, skipping`);
              return { success: false, count: 0 };
            }
          }
          
          return validated;
        }, attempts);
        
        if (labelResult.success) return labelResult.locator;
      }
      
      // ==========================================================================
      // NEAR TEXT STRATEGY: Find clickable elements near specific text
      // Critical for checkboxes, radio buttons where the clickable element is
      // NEXT TO the label text, not containing it
      // ==========================================================================
      
      const nearTextResult = await this.tryStrategy('near-text', async () => {
        const searchText = this.normalizeText(where.nearText);
        this.log(`[near-text] Looking for clickable element near "${searchText}"`);
        
        // Strategy 1: Find text, then find clickable sibling/parent
        // Use evaluate for complex DOM traversal
        const result = await this.page.evaluate((text) => {
          const normalizeText = (t) => t?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
          const searchLower = normalizeText(text);
          
          // Find all text nodes/elements containing the text
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            null,
            false
          );
          
          let foundElement = null;
          let node;
          while (node = walker.nextNode()) {
            const nodeText = node.textContent || node.innerText || '';
            if (normalizeText(nodeText).includes(searchLower)) {
              // For text nodes, get parent element
              const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
              if (el && normalizeText(el.innerText || el.textContent || '') === searchLower) {
                foundElement = el;
                break;
              }
              // Also check if this element's direct text matches
              if (el) {
                const directText = Array.from(el.childNodes)
                  .filter(n => n.nodeType === Node.TEXT_NODE)
                  .map(n => n.textContent)
                  .join('');
                if (normalizeText(directText) === searchLower) {
                  foundElement = el;
                  break;
                }
              }
            }
          }
          
          if (!foundElement) return null;
          
          // Now find the associated clickable element
          // Check these locations:
          // 1. Previous sibling (checkbox before label)
          // 2. Parent's first child (checkbox at start of label)
          // 3. Preceding element within parent (custom checkbox span)
          // 4. Parent label's "for" attribute target
          
          const checkClickable = (el) => {
            if (!el) return null;
            const tag = el.tagName?.toLowerCase();
            const type = el.type?.toLowerCase();
            const role = el.getAttribute?.('role');
            
            // Actual checkbox/radio
            if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
              return el;
            }
            // Custom checkbox span with role
            if (role === 'checkbox' || role === 'radio' || role === 'switch') {
              return el;
            }
            // Span/div that looks like a custom checkbox
            if ((tag === 'span' || tag === 'div') && 
                (el.className?.includes('checkbox') || el.className?.includes('radio') ||
                 el.className?.includes('check') || el.className?.includes('custom'))) {
              return el;
            }
            return null;
          };
          
          // Strategy 1: Check previous sibling
          let clickable = checkClickable(foundElement.previousElementSibling);
          if (clickable) return { selector: null, element: clickable.outerHTML.substring(0, 200) };
          
          // Strategy 2: Check parent's first child
          clickable = checkClickable(foundElement.parentElement?.firstElementChild);
          if (clickable && clickable !== foundElement) return { selector: null, element: clickable.outerHTML.substring(0, 200) };
          
          // Strategy 3: Look within same label/container
          const parent = foundElement.closest('label') || foundElement.parentElement;
          if (parent) {
            for (const child of parent.querySelectorAll('input, span, div')) {
              clickable = checkClickable(child);
              if (clickable) return { selector: null, element: clickable.outerHTML.substring(0, 200) };
            }
          }
          
          // Strategy 4: If in a label, check "for" attribute
          const label = foundElement.closest('label');
          if (label?.htmlFor) {
            const forTarget = document.getElementById(label.htmlFor);
            clickable = checkClickable(forTarget);
            if (clickable) return { selector: `#${label.htmlFor}`, element: clickable.outerHTML.substring(0, 200) };
          }
          
          // Strategy 5: Just return the text element itself if it looks clickable
          if (foundElement.onclick || foundElement.getAttribute('role') === 'checkbox' || 
              foundElement.closest('[role="checkbox"]')) {
            return { selector: null, element: foundElement.outerHTML.substring(0, 200) };
          }
          
          return null;
        }, searchText);
        
        if (result) {
          this.log(`[near-text] Found clickable element near "${searchText}": ${result.element}`);
          
          // Now we need to find this element with a Playwright locator
          // Use getByText to find the label, then navigate to the checkbox
          const textLocator = scope.getByText(searchText, { exact: false });
          const textCount = await textLocator.count();
          
          if (textCount > 0) {
            // Try to find the checkbox relative to the text
            for (let i = 0; i < Math.min(textCount, 3); i++) {
              const textEl = textLocator.nth(i);
              
              // Check for checkbox in same label/parent structure
              const checkboxInParent = textEl.locator('xpath=ancestor::label//input[@type="checkbox"] | xpath=ancestor::label//input[@type="radio"] | xpath=ancestor::label//*[@role="checkbox"] | xpath=ancestor::label//*[@role="radio"]').first();
              if (await checkboxInParent.count() > 0 && await checkboxInParent.isVisible()) {
                this.log(`[near-text] Found checkbox in label ancestor`);
                return { success: true, locator: checkboxInParent };
              }
              
              // Check preceding sibling
              const precedingSibling = textEl.locator('xpath=preceding-sibling::input[@type="checkbox"] | xpath=preceding-sibling::input[@type="radio"] | xpath=preceding-sibling::*[@role="checkbox"]').first();
              if (await precedingSibling.count() > 0 && await precedingSibling.isVisible()) {
                this.log(`[near-text] Found checkbox as preceding sibling`);
                return { success: true, locator: precedingSibling };
              }
              
              // Check parent's first child (common pattern: <label><span class="checkbox"></span>Text</label>)
              const parentFirstChild = textEl.locator('xpath=parent::*/child::*[1][self::input or self::span or self::div]').first();
              if (await parentFirstChild.count() > 0 && await parentFirstChild.isVisible()) {
                // Verify it looks like a checkbox
                const role = await parentFirstChild.getAttribute('role').catch(() => '');
                const type = await parentFirstChild.getAttribute('type').catch(() => '');
                const className = await parentFirstChild.getAttribute('class').catch(() => '');
                
                if (type === 'checkbox' || type === 'radio' || 
                    role === 'checkbox' || role === 'radio' ||
                    className?.includes('check') || className?.includes('radio')) {
                  this.log(`[near-text] Found checkbox as parent's first child`);
                  return { success: true, locator: parentFirstChild };
                }
              }
            }
          }
        }
        
        return { success: false, count: 0 };
      }, attempts);
      
      if (nearTextResult.success) return await this._recordLearningAndReturn(nearTextResult.locator);
    }
    
    // ==========================================================================
    // PHASE 4: Try aria-label
    // ==========================================================================
    
    if (which?.ariaLabel) {
      // Strategy 1: Exact match
      const result = await this.tryStrategy('aria-label', async () => {
        const locator = scope.locator(`[aria-label="${which.ariaLabel}"]`);
        const validated = await this.validateLocator(locator, 'aria-label');
        
        // Validate for role mismatch (prevent clicking search inputs when expecting buttons)
        if (validated.success && what?.role) {
          if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
            this.log(`aria-label: rejected - wrong target type for ${what.role}`);
            return { success: false, count: 0 };
          }
        }
        
        return validated;
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
      
      // Strategy 2: Partial match (contains) - handles minor text differences
      const partialResult = await this.tryStrategy('aria-label-contains', async () => {
        // Get first significant part of ariaLabel (before comma or first 20 chars)
        const searchPart = which.ariaLabel.split(',')[0].trim();
        const normalizedSearch = this.normalizeText(searchPart);
        const locator = scope.locator(`[aria-label*="${normalizedSearch}"]`);
        const validated = await this.validateLocator(locator, 'aria-label-contains');
        
        // Validate for role mismatch
        if (validated.success && what?.role) {
          if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
            this.log(`aria-label-contains: rejected - wrong target type for ${what.role}`);
            return { success: false, count: 0 };
          }
        }
        
        return validated;
      }, attempts);
      
      if (partialResult.success) return partialResult.locator;
      
      // Strategy 3: Flexible regex (handles apostrophe variants)
      const flexResult = await this.tryStrategy('aria-label-flex', async () => {
        const searchPart = which.ariaLabel.split(',')[0].trim();
        const flexRegex = this.createFlexibleTextRegex(searchPart);
        // Use XPath for regex matching on aria-label
        const locator = scope.getByRole('link', { name: flexRegex });
        const validated = await this.validateLocator(locator, 'aria-label-flex');
        
        // Validate for role mismatch
        if (validated.success && what?.role) {
          if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
            this.log(`aria-label-flex: rejected - wrong target type for ${what.role}`);
            return { success: false, count: 0 };
          }
        }
        
        return validated;
      }, attempts);
      
      if (flexResult.success) return flexResult.locator;
    }
    
    // ==========================================================================
    // PHASE 5: Try name attribute (forms)
    // ==========================================================================
    
    if (which?.name) {
      const result = await this.tryStrategy('name', async () => {
        const locator = scope.locator(`[name="${which.name}"]`);
        return await this.validateLocator(locator, 'name');
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
    }
    
    // ==========================================================================
    // PHASE 6: Try ID (if stable)
    // ==========================================================================
    
    if (which?.id) {
      const result = await this.tryStrategy('id', async () => {
        const locator = this.page.locator(`#${which.id}`);
        return await this.validateLocator(locator, 'id');
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
    }
    
    // ==========================================================================
    // PHASE 7: Try href matching for links
    // ==========================================================================
    
    if (confirm?.href || which?.href) {
      const href = confirm?.href || which?.href;
      const result = await this.tryStrategy('href', async () => {
        // Try exact href match first
        let locator = scope.locator(`a[href="${href}"]`);
        let count = await locator.count();
        
        if (count === 0) {
          // Try partial href match (last path segment)
          const hrefPath = href.split('/').pop()?.split('?')[0];
          if (hrefPath && hrefPath.length > 2) {
            locator = scope.locator(`a[href*="${hrefPath}"]`);
            count = await locator.count();
          }
        }
        
        if (count > 0) {
          return await this.resolveMultiple(locator, which, 'href');
        }
        return { success: false, count: 0 };
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
    }
    
    // ==========================================================================
    // PHASE 8: Fallback to CSS selector
    // ==========================================================================
    
    if (confirm?.cssSelector) {
      const result = await this.tryStrategy('css-fallback', async () => {
        const locator = this.page.locator(confirm.cssSelector);
        return await this.validateLocator(locator, 'css-fallback');
      }, attempts);
      
      if (result.success) return await this._recordLearningAndReturn(result.locator);
      
      // If full selector failed, try just the parent (without child selectors)
      const parentSelector = confirm.cssSelector.split('>')[0].trim();
      if (parentSelector !== confirm.cssSelector) {
        const parentResult = await this.tryStrategy('css-fallback-parent', async () => {
          const locator = this.page.locator(parentSelector);
          return await this.validateLocator(locator, 'css-fallback-parent');
        }, attempts);
        
        if (parentResult.success) return parentResult.locator;
      }
    }
    
    // ==========================================================================
    // PHASE 8.5: Salesforce Lightning element patterns
    // Handle lightning-button, lightning-combobox, one-app-launcher, etc.
    // ==========================================================================
    
    if (what?.text) {
      const sfElementResult = await this.tryStrategy('sf-lightning-elements', async () => {
        const searchText = this.normalizeText(what.text);
        
        // Salesforce-specific selectors that commonly contain buttons/links
        const sfSelectors = [
          // Lightning buttons with text
          `lightning-button:has-text("${searchText}") button`,
          `lightning-button button:has-text("${searchText}")`,
          `lightning-button-icon:has-text("${searchText}")`,
          
          // Standard buttons/links with the text
          `button:has-text("${searchText}")`,
          `a:has-text("${searchText}")`,
          `[role="button"]:has-text("${searchText}")`,
          `[role="link"]:has-text("${searchText}")`,
          `[role="menuitem"]:has-text("${searchText}")`,
          `[role="option"]:has-text("${searchText}")`,
          
          // Segmented controls / toggle button groups (styled radio buttons)
          `[role="radio"]:has-text("${searchText}")`,
          `[role="switch"]:has-text("${searchText}")`,
          `[aria-pressed]:has-text("${searchText}")`,
          `[aria-selected]:has-text("${searchText}")`,
          `label:has-text("${searchText}")`,
          `.btn-group :has-text("${searchText}")`,
          `.button-group :has-text("${searchText}")`,
          `[role="radiogroup"] :has-text("${searchText}")`,
          
          // Salesforce one-app components
          `one-app-nav-bar-item-root a:has-text("${searchText}")`,
          `one-app-launcher-menu-item a:has-text("${searchText}")`,
          
          // Lightning combobox options
          `lightning-base-combobox-item:has-text("${searchText}")`,
          `lightning-base-combobox-item[data-value*="${searchText}"]`,
          
          // SLDS components
          `.slds-button:has-text("${searchText}")`,
          `.slds-dropdown__item:has-text("${searchText}")`,
          
          // Buttons with title attribute
          `button[title*="${searchText}"]`,
          `a[title*="${searchText}"]`,
          `[role="button"][title*="${searchText}"]`,
        ];
        
        for (const selector of sfSelectors) {
          try {
            const locator = this.page.locator(selector).first();
            const count = await locator.count().catch(() => 0);
            if (count > 0) {
              // Validate it's visible
              const isVisible = await locator.isVisible().catch(() => false);
              if (isVisible) {
                this.log(`Found Salesforce element via: ${selector.substring(0, 50)}...`);
                return { success: true, locator, count };
              }
            }
          } catch (e) {
            // Skip invalid selectors
          }
        }
        
        return { success: false, count: 0 };
      }, attempts);
      
      if (sfElementResult.success) return sfElementResult.locator;
    }
    
    // ==========================================================================
    // PHASE 9: Relaxed search with text variations (last resort before Shadow DOM)
    // CRITICAL FIX: Use 'scope' instead of 'this.page' to respect landmark
    // Also tries stripped/partial text for dynamic content
    // ==========================================================================
    
    if (what?.text) {
      // Get text variations for flexible matching
      const textVariations = this.getTextVariations(what.text);
      
      for (const textVariant of textVariations) {
        // Try scoped search (respects landmark from Phase 1)
        const result = await this.tryStrategy(`text-variation-${textVariant === what.text ? 'original' : 'stripped'}`, async () => {
          // CRITICAL: Search within scope (may be narrowed by landmark), not entire page
          const locator = scope.getByText(textVariant).first();
          const validated = await this.validateLocator(locator, 'text-variation');
          
          // EXTRA VALIDATION: If we have a role, verify the found element's role matches
          if (validated.success && what?.role) {
            const actualRole = await validated.locator.evaluate(el => {
              return el.getAttribute('role') || el.tagName.toLowerCase();
            }).catch(() => null);
            
            if (!this._roleMatches(what.role, actualRole, 'click')) {
              this.log(`text-variation found element but role mismatch: expected ${what.role}, got ${actualRole}`);
              return { success: false, count: 0 };
            }
            
            // Additional check: is this a clearly wrong target (like a search input)?
            if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
              return { success: false, count: 0 };
            }
          }
          
          return validated;
        }, attempts);
        
        if (result.success) {
          if (textVariant !== what.text) {
            this.log(`Found element using stripped text: "${textVariant}" (original: "${what.text}")`);
          }
          return await this._recordLearningAndReturn(result.locator);
        }
      }
      
      // Also try original flexible apostrophe matching
      const flexibleTextRegex = this.createFlexibleTextRegex(what.text);
      if (flexibleTextRegex) {
        const apostropheResult = await this.tryStrategy('text-contains-apostrophe-flex', async () => {
          const locator = scope.getByText(flexibleTextRegex).first();
          const validated = await this.validateLocator(locator, 'text-contains-apostrophe-flex');
          
          // Role validation using helper method
          if (validated.success && what?.role) {
            const actualRole = await validated.locator.evaluate(el => {
              return el.getAttribute('role') || el.tagName.toLowerCase();
            }).catch(() => null);
            
            if (!this._roleMatches(what.role, actualRole, 'click')) {
              this.log(`text-contains-apostrophe-flex found element but role mismatch: expected ${what.role}, got ${actualRole}`);
              return { success: false, count: 0 };
            }
            
            // Additional check for wrong targets
            if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
              return { success: false, count: 0 };
            }
          }
          
          return validated;
        }, attempts);
        
        if (apostropheResult.success) return apostropheResult.locator;
      }
      
      // KEYWORD EXTRACTION: Try key phrases from the text
      // e.g., "Go To Saver's Switch" → try "Saver's Switch"
      // Still use scope for scoped search
      // CRITICAL: Include role validation AND require a role to be specified
      // If no role is specified, keyword extraction is too risky
      const keyPhrases = what.text
        .split(/\s+(?:to|the|a|an|with|for|on|in|and|or|of)\s+/i)
        .filter(phrase => phrase.length > 3)
        .map(phrase => phrase.trim());
      
      // Only try keyword extraction if we have a specific role to validate against
      // This prevents matching random elements with similar text
      if (what?.role) {
        for (const keyPhrase of keyPhrases) {
          if (keyPhrase.length >= 5 && keyPhrase !== what.text) {
            const keywordRegex = this.createFlexibleTextRegex(keyPhrase);
            if (keywordRegex) {
              const keywordResult = await this.tryStrategy('keyword-extract', async () => {
                // Use role+name instead of just text for more accurate matching
                const locator = scope.getByRole(what.role, { name: keywordRegex }).first();
                const validated = await this.validateLocator(locator, 'keyword-extract');
                
                // Validate role matches (extra safety)
                if (validated.success) {
                  const actualRole = await validated.locator.evaluate(el => {
                    return el.getAttribute('role') || el.tagName.toLowerCase();
                  }).catch(() => null);
                  
                  if (!this._roleMatches(what.role, actualRole, 'click')) {
                    this.log(`keyword-extract found element but role mismatch: expected ${what.role}, got ${actualRole}`);
                    return { success: false, count: 0 };
                  }
                  
                  // Additional check for wrong targets
                  if (await this._isLikelyWrongClickTarget(validated.locator, what.role)) {
                    return { success: false, count: 0 };
                  }
                }
                
                return validated;
              }, attempts);
              
              if (keywordResult.success) {
                this.log(`Found by keyword extraction: "${keyPhrase}" from "${what.text}"`);
                return keywordResult.locator;
              }
            }
          }
        }
      } else {
        this.log('Skipping keyword-extract strategy: no role specified for validation');
      }
    }
    
    // ==========================================================================
    // PHASE 9: SHADOW DOM SEARCH (Salesforce Lightning, SAP UI5, etc.)
    // ==========================================================================
    
    const shadowResult = await this.tryStrategy('shadow-dom', async () => {
      return await this.findInShadowDOM(what, which);
    }, attempts);
    
    if (shadowResult.success) return await this._recordLearningAndReturn(shadowResult.locator);
    
    // ==========================================================================
    // PHASE 10: COORDINATE-BASED FALLBACK (for edge cases)
    // SKIP if cross-device playback (coordinates won't work on different viewport)
    // ==========================================================================
    
    // Try using which.coordinates
    if (which?.coordinates && !this._skipCoordinateFallback) {
      const coordResult = await this.tryStrategy('coordinates', async () => {
        const { x, y } = which.coordinates;
        const element = await this.page.evaluateHandle(
          ([x, y]) => document.elementFromPoint(x, y),
          [x, y]
        );
        if (element) {
          return { success: true, locator: element, count: 1 };
        }
        return { success: false, count: 0 };
      }, attempts);
      
      if (coordResult.success) return coordResult.locator;
    }
    
    // Try using confirm.boundingBox (center point)
    // CRITICAL: Must validate the element found is actually clickable and not a loading overlay
    // SKIP if cross-device playback (coordinates won't match on different viewport)
    if (confirm?.boundingBox && !this._skipCoordinateFallback) {
      const bboxResult = await this.tryStrategy('boundingBox-center', async () => {
        const { x, y, width, height } = confirm.boundingBox;
        // Calculate center of bounding box
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        this.log(`Trying bounding box center: (${centerX}, ${centerY})`);
        
        // Find element at coordinates and validate it's a valid click target
        const elementInfo = await this.page.evaluate(
          ([cx, cy, expectedText, expectedRole]) => {
            const el = document.elementFromPoint(cx, cy);
            if (!el) return null;
            
            // Check if it's a loading overlay, invisible element, or body
            const isLoadingOverlay = el.id?.toLowerCase().includes('loading') || 
                                     el.className?.toLowerCase().includes('loading') ||
                                     el.className?.toLowerCase().includes('msgbox') ||
                                     el.closest('[class*="loading"]') ||
                                     el.closest('[class*="spinner"]') ||
                                     el.closest('[class*="overlay"]');
            
            if (isLoadingOverlay) return null;
            
            // Check if element is visible
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return null;
            }
            
            // Check if it's a generic container that we shouldn't click
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute('role');
            if ((tag === 'div' || tag === 'span') && !role && !el.onclick && !el.closest('a, button, [role="button"]')) {
              // This is likely not the clickable target, find the actual interactive element
              const clickableChild = el.querySelector('a, button, [role="button"], input, [onclick]');
              if (clickableChild) {
                return {
                  tag: clickableChild.tagName.toLowerCase(),
                  id: clickableChild.id,
                  className: clickableChild.className,
                  text: clickableChild.textContent?.trim().substring(0, 50),
                  testId: clickableChild.getAttribute('data-testid'),
                  isValid: true
                };
              }
              return null;
            }
            
            // Get identifying info for building a locator
            return {
              tag: tag,
              id: el.id,
              className: el.className,
              text: el.textContent?.trim().substring(0, 50),
              testId: el.getAttribute('data-testid'),
              ariaLabel: el.getAttribute('aria-label'),
              role: role,
              isValid: true
            };
          },
          [centerX, centerY, what?.text || '', what?.role || '']
        );
        
        if (!elementInfo || !elementInfo.isValid) {
          this.log(`Bounding box found invalid element (loading overlay or invisible)`);
          return { success: false, count: 0 };
        }
        
        this.log(`Bounding box found: tag=${elementInfo.tag}, id=${elementInfo.id}, text=${elementInfo.text}`);
        
        // Build the best possible locator for this element
        let locator;
        if (elementInfo.testId) {
          locator = this.page.locator(`[data-testid="${elementInfo.testId}"]`).first();
        } else if (elementInfo.id && !elementInfo.id.match(/^(aura|lwc-|:r\d)/i)) {
          locator = this.page.locator(`#${elementInfo.id}`).first();
        } else if (elementInfo.ariaLabel) {
          locator = this.page.locator(`[aria-label="${elementInfo.ariaLabel}"]`).first();
        } else if (elementInfo.role && elementInfo.text) {
          locator = this.page.getByRole(elementInfo.role, { name: elementInfo.text }).first();
        } else {
          // Last resort: use mouse click at coordinates directly
          // Store coordinates for direct click, don't use a locator
          return { 
            success: true, 
            locator: null,  // Signal to use direct coordinates
            count: 1,
            useCoordinates: { x: centerX, y: centerY },
            useDirectClick: true
          };
        }
        
        // Validate the locator actually resolves
        const count = await locator.count().catch(() => 0);
        if (count > 0) {
          return { success: true, locator, count: 1 };
        }
        
        // Fall back to direct coordinate click
        return { 
          success: true, 
          locator: null,
          count: 1,
          useCoordinates: { x: centerX, y: centerY },
          useDirectClick: true
        };
      }, attempts);
      
      if (bboxResult.success) {
        if (bboxResult.useDirectClick) {
          // Store coordinates for click handler to use direct mouse click
          this._lastBoundingBoxCoords = bboxResult.useCoordinates;
          this._useDirectClick = true;
          // Return a dummy locator, the click handler will use coordinates
          return { __useDirectClick: true, coords: bboxResult.useCoordinates };
        }
        return await this._recordLearningAndReturn(bboxResult.locator);
      }
    }
    
    // ==========================================================================
    // FAILED - Log what we tried with telemetry
    // ==========================================================================
    
    this.log('All strategies failed. Attempts:', attempts);
    
    // Store telemetry for debugging
    this.lastFailedAttempts = attempts;
    this.lastFailedRecipe = recipe;
    
    throw new Error(`Could not find element. Tried: ${attempts.map(a => a.strategy).join(', ')}. Recipe: ${JSON.stringify(recipe)}`);
  }
  
  // ==========================================================================
  // SHADOW DOM SUPPORT
  // ==========================================================================
  
  /**
   * Search for element inside Shadow DOM trees
   * Critical for: Salesforce Lightning, SAP UI5, Web Components
   */
  async findInShadowDOM(what, which) {
    this.log('Searching in Shadow DOM...');
    
    try {
      // NOTE: Playwright's pierce/ selector ONLY works with pure CSS selectors
      // It does NOT support :has-text() or :text() pseudo-selectors!
      // Use evaluate() for text-based searches in Shadow DOM
      
      // Strategy 1: TestId with CSS (works without pierce for open Shadow DOM)
      if (which?.testId) {
        // First try normal locator (Playwright auto-pierces open Shadow DOM by default)
        let locator = this.page.locator(`[data-testid="${which.testId}"]`);
        let count = await locator.count().catch(() => 0);
        if (count > 0) {
          this.log(`Found in Shadow DOM by testId: ${which.testId}`);
          return { success: true, locator: locator.first(), count };
        }
        
        // Try with explicit shadow DOM piercing via evaluate
        const shadowTestId = await this.page.evaluate((testId) => {
          function findInShadows(root, selector) {
            const result = root.querySelector(selector);
            if (result) return true;
            
            const elements = root.querySelectorAll('*');
            for (const el of elements) {
              if (el.shadowRoot) {
                if (findInShadows(el.shadowRoot, selector)) return true;
              }
            }
            return false;
          }
          return findInShadows(document, `[data-testid="${testId}"]`);
        }, which.testId);
        
        if (shadowTestId) {
          // Found it - now get it with a locator
          locator = this.page.locator(`[data-testid="${which.testId}"]`);
          count = await locator.count().catch(() => 0);
          if (count > 0) {
            return { success: true, locator: locator.first(), count };
          }
        }
      }
      
      // Strategy 2: Role + Text via evaluate (pierce doesn't support :has-text)
      if (what?.role && what?.text) {
        const normalizedText = this.normalizeText(what.text);
        const role = what.role.toLowerCase();
        
        // Find element via evaluate in Shadow DOM
        const elementHandle = await this.page.evaluateHandle(({ role, text }) => {
          function findInShadows(root) {
            // Check current level
            const candidates = root.querySelectorAll(`[role="${role}"], ${role}`);
            for (const el of candidates) {
              const elText = el.textContent?.trim() || el.getAttribute('aria-label') || '';
              if (elText.includes(text) || text.includes(elText)) {
                return el;
              }
            }
            
            // Check shadow roots
            const elements = root.querySelectorAll('*');
            for (const el of elements) {
              if (el.shadowRoot) {
                const found = findInShadows(el.shadowRoot);
                if (found) return found;
              }
            }
            return null;
          }
          return findInShadows(document);
        }, { role, text: normalizedText });
        
        if (elementHandle) {
          const isValid = await elementHandle.evaluate(el => el !== null).catch(() => false);
          if (isValid) {
            this.log(`Found in Shadow DOM by role+text: ${role} "${normalizedText}"`);
            // Get locator by using the element's accessible name
            const locator = this.page.getByRole(role, { name: normalizedText }).first();
            const count = await locator.count().catch(() => 0);
            if (count > 0) {
              return { success: true, locator, count };
            }
          }
        }
      }
      
      // Strategy 3: Text-only via evaluate
      if (what?.text) {
        const normalizedText = this.normalizeText(what.text);
        
        // Try getByText first (works for most cases)
        let locator = this.page.getByText(normalizedText, { exact: false }).first();
        let count = await locator.count().catch(() => 0);
        if (count > 0) {
          this.log(`Found by text (auto-pierce): "${normalizedText}"`);
          return { success: true, locator, count };
        }
        
        // Deep shadow DOM search via evaluate
        const elementHandle = await this.page.evaluateHandle((text) => {
          function findInShadows(root) {
            // Use TreeWalker for text nodes
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (walker.currentNode.textContent?.includes(text)) {
                // Return the parent element
                return walker.currentNode.parentElement;
              }
            }
            
            // Check shadow roots
            const elements = root.querySelectorAll('*');
            for (const el of elements) {
              if (el.shadowRoot) {
                const found = findInShadows(el.shadowRoot);
                if (found) return found;
              }
            }
            return null;
          }
          return findInShadows(document);
        }, normalizedText);
        
        if (elementHandle) {
          const isValid = await elementHandle.evaluate(el => el !== null).catch(() => false);
          if (isValid) {
            this.log(`Found in Shadow DOM by text: "${normalizedText}"`);
            // Return getByText which should now find it
            return { success: true, locator: this.page.getByText(normalizedText).first(), count: 1 };
          }
        }
      }
      
      // Strategy 4: Manual shadow DOM walking (for complex cases)
      const shadowElement = await this.page.evaluateHandle(({ role, text, testId }) => {
        function findInShadow(root, criteria) {
          // Search direct children
          const elements = root.querySelectorAll('*');
          for (const el of elements) {
            // Check testId
            if (criteria.testId && el.getAttribute('data-testid') === criteria.testId) {
              return el;
            }
            
            // Check role + text
            const elRole = el.getAttribute('role') || el.tagName.toLowerCase();
            const elText = (el.textContent || '').trim();
            
            if (criteria.role && criteria.text) {
              if (elRole === criteria.role && elText.includes(criteria.text)) {
                return el;
              }
            } else if (criteria.text) {
              if (elText.includes(criteria.text)) {
                return el;
              }
            }
            
            // Recurse into shadow root
            if (el.shadowRoot) {
              const found = findInShadow(el.shadowRoot, criteria);
              if (found) return found;
            }
          }
          return null;
        }
        
        // Start search from document
        return findInShadow(document, { role, text, testId });
      }, { role: what?.role, text: what?.text, testId: which?.testId });
      
      if (shadowElement) {
        const isValid = await shadowElement.evaluate(el => el !== null);
        if (isValid) {
          this.log('Found in Shadow DOM by manual walking');
          return { success: true, locator: shadowElement, count: 1 };
        }
      }
      
      return { success: false, count: 0 };
    } catch (error) {
      this.log('Shadow DOM search failed:', error.message);
      return { success: false, count: 0, error };
    }
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
        // Track for learning
        this._lastSuccessfulStrategy = name;
        this._lastSuccessfulSelector = result.selector || null;
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
   * Record learning and return the locator
   * This is called when we successfully find an element
   */
  async _recordLearningAndReturn(locator) {
    const executionTime = Date.now() - this._executionStartTime;
    
    // Build selector string from the recipe for Lock Locators feature
    // If strategy didn't return a selector, construct one from recipe data
    if (!this._lastSuccessfulSelector && this._currentRecipe) {
      this._lastSuccessfulSelector = this._buildSelectorFromRecipe(this._currentRecipe, this._lastSuccessfulStrategy);
    }
    
    // CRITICAL FIX: If we STILL don't have a selector, extract one from the actual DOM element.
    // This ensures Lock Locators always has something to save, even when
    // _buildSelectorFromRecipe returns null (e.g., elements without testId/ariaLabel/role).
    if (!this._lastSuccessfulSelector && locator) {
      try {
        this._lastSuccessfulSelector = await this._extractSelectorFromLocator(locator);
        if (this._lastSuccessfulSelector) {
          this.log(`[Lock Locators] Extracted selector from DOM: ${this._lastSuccessfulSelector}`);
        }
      } catch (e) {
        this.log(`[Lock Locators] Could not extract selector from locator: ${e.message}`);
      }
    }
    
    // Expose the working strategy/selector for Lock Locators feature
    this.lastSuccessfulStrategy = this._lastSuccessfulStrategy;
    this.lastSuccessfulSelector = this._lastSuccessfulSelector;
    
    this.log(`[Lock Locators] Strategy: ${this.lastSuccessfulStrategy}, Selector: ${this.lastSuccessfulSelector || 'none'}`);
    
    if (this.enableLearning && this._currentFingerprint && this._lastSuccessfulStrategy) {
      this.strategyMemory.recordSuccess(
        this._currentFingerprint, 
        this._lastSuccessfulStrategy, 
        this._lastSuccessfulSelector,
        executionTime
      );
      this.log(`[LEARNING] Recorded success: ${this._lastSuccessfulStrategy} in ${executionTime}ms`);
    }
    
    // Record the find result for confidence tracking
    this._lastFindResult = {
      strategy: this._lastSuccessfulStrategy,
      matchCount: this._matchCount || 1,
      usedPosition: this._usedPosition || 1,
      exactTextMatch: this._exactTextMatch,
      fallbacksUsed: this._fallbacksUsed || [],
      executionTime,
      success: true,
      selector: this._lastSuccessfulSelector
    };
    
    return locator;
  }

  /**
   * Extract the best Playwright selector by querying the actual DOM element.
   * Called as a LAST RESORT when _buildSelectorFromRecipe returns null.
   * Evaluates the found element's attributes and builds a reliable selector.
   */
  async _extractSelectorFromLocator(locator) {
    try {
      const attrs = await locator.evaluate(el => {
        return {
          tagName: el.tagName?.toLowerCase() || '',
          id: el.id || '',
          name: el.getAttribute('name') || '',
          type: el.getAttribute('type') || '',
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          testId: el.getAttribute('data-testid') || el.getAttribute('data-test-id') || '',
          placeholder: el.getAttribute('placeholder') || '',
          text: (el.textContent || '').trim().substring(0, 60),
          classes: el.className || '',
          href: el.getAttribute('href') || '',
          title: el.getAttribute('title') || '',
        };
      });

      // Priority order: most stable → least stable
      if (attrs.testId) return `[data-testid="${attrs.testId}"]`;
      if (attrs.ariaLabel && attrs.ariaLabel.length > 1 && attrs.ariaLabel.length < 80) {
        return `[aria-label="${attrs.ariaLabel}"]`;
      }
      if (attrs.role && attrs.text && attrs.text.length > 0 && attrs.text.length < 50) {
        return `role=${attrs.role}[name="${attrs.text}"]`;
      }
      if (attrs.id && !this._isLikelyDynamicId(attrs.id)) {
        return `#${attrs.id}`;
      }
      if (attrs.name) return `[name="${attrs.name}"]`;
      if (attrs.placeholder && attrs.placeholder.length < 60) {
        return `[placeholder="${attrs.placeholder}"]`;
      }
      if (attrs.title && attrs.title.length < 60) {
        return `[title="${attrs.title}"]`;
      }
      if (attrs.text && attrs.text.length > 1 && attrs.text.length < 80) {
        return `text="${attrs.text}"`;
      }
      // Last resort: tag + type (for inputs/buttons)
      if (attrs.tagName === 'input' && attrs.type) {
        return `${attrs.tagName}[type="${attrs.type}"]`;
      }
      if (attrs.href && attrs.tagName === 'a' && attrs.href.length < 100) {
        return `a[href="${attrs.href}"]`;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the last find operation's result metadata
   * Used for confidence calculation
   * 
   * @returns {Object} Find result with strategy, matchCount, etc.
   */
  getLastFindResult() {
    return this._lastFindResult || {
      strategy: null,
      matchCount: 1,
      usedPosition: 1,
      exactTextMatch: null,
      fallbacksUsed: [],
      executionTime: 0,
      success: false
    };
  }

  /**
   * Reset tracking state for a new find operation
   */
  _resetTrackingState() {
    this._matchCount = 0;
    this._usedPosition = 1;
    this._exactTextMatch = null;
    this._fallbacksUsed = [];
    this._lastFindResult = null;
  }
  
  /**
   * Build a Playwright selector string from recipe data
   * Used for Lock Locators feature - returns the BEST selector for this element
   * @param {Object} recipe - The recipe that was used to find the element
   * @param {string} strategy - The strategy that succeeded
   * @returns {string|null} A Playwright-compatible selector string
   */
  _buildSelectorFromRecipe(recipe, strategy) {
    if (!recipe) return null;
    
    const { what, where, which } = recipe;
    
    // Priority 1: data-testid (most stable)
    if (which?.testId) {
      return `[data-testid="${which.testId}"]`;
    }
    
    // Priority 2: aria-label (accessibility, usually stable)
    if (which?.ariaLabel && which.ariaLabel.length > 2) {
      return `[aria-label="${which.ariaLabel}"]`;
    }
    
    // Priority 3: role + text (Playwright-style selector)
    if (which?.role && what?.text && what.text.length > 1 && what.text.length < 50) {
      // Format: role=button[name="Click me"]
      return `role=${which.role}[name="${what.text}"]`;
    }
    
    // Priority 4: getByText for text-based strategies
    if (strategy?.includes('text') && what?.text && what.text.length > 1 && what.text.length < 80) {
      return `text="${what.text}"`;
    }
    
    // Priority 4b: ANY strategy with text — if we have text and no better selector, use it
    if (what?.text && what.text.length > 1 && what.text.length < 80) {
      return `text="${what.text}"`;
    }
    
    // Priority 5: ID (if not dynamic)
    if (which?.id && !this._isLikelyDynamicId(which.id)) {
      return `#${which.id}`;
    }
    
    // Priority 6: name attribute (for form elements)
    if (which?.name) {
      return `[name="${which.name}"]`;
    }
    
    // Fallback: Use the primary selector if it looks stable
    if (which?.selector && !which.selector.includes(':nth') && which.selector.length < 100) {
      return which.selector;
    }
    
    return null;
  }
  
  /**
   * Check if an ID looks dynamic/random (shouldn't be used for Lock Locators)
   */
  _isLikelyDynamicId(id) {
    if (!id) return true;
    const dynamicPatterns = [
      /^:r[a-z0-9]+:?$/i,           // Radix
      /^react-aria-?\d+/i,          // React Aria
      /^headlessui-/i,              // Headless UI
      /^radix-/i,                   // Radix
      /^mui-/i,                     // MUI
      /^aura\d+/i,                  // Salesforce Aura
      /^lwc-/i,                     // Lightning Web Components
      /^input-\d+$/i,               // Generic input-123
      /^[a-f0-9]{8,}$/i,            // UUID-like
      /^\d{6,}$/,                   // Pure numbers
    ];
    return dynamicPatterns.some(p => p.test(id));
  }
  
  /**
   * Try a remembered strategy from Strategy Memory
   * CRITICAL: Must verify text content for CSS-based strategies to avoid wrong element matches!
   */
  async _tryRememberedStrategy(remembered, recipe) {
    const { strategy, selector } = remembered;
    const { what, where, which, confirm } = recipe;
    
    // Determine expected text for verification
    // Can come from what.text, where.nearText, or which.ariaLabel
    const expectedText = what?.text || where?.nearText || which?.ariaLabel;
    
    // CSS-based strategies need extra text verification since positional selectors can match wrong elements
    const needsTextVerification = ['css-fallback', 'css-fallback-parent'].includes(strategy) && expectedText;
    
    try {
      let locator;
      
      // Try based on strategy type
      switch (strategy) {
        case 'testId':
          if (which?.testId) {
            locator = this.page.getByTestId(which.testId);
          }
          break;
          
        case 'sf-testid-extracted':
        case 'sf-testid-extracted-child':
          if (selector) {
            locator = this.page.locator(selector);
          }
          break;
          
        case 'role+text':
        case 'role+text-apostrophe-flex':
        case 'role+text-regex':
          if (what?.role && what?.text) {
            locator = this.page.getByRole(what.role, { name: what.text });
          }
          break;
          
        case 'text-exact':
          if (what?.text) {
            locator = this.page.getByText(what.text, { exact: true });
          }
          break;
          
        case 'aria-label':
          if (which?.ariaLabel) {
            locator = this.page.locator(`[aria-label="${which.ariaLabel}"]`);
          }
          break;
          
        case 'css-fallback':
        case 'css-fallback-parent':
          if (selector || confirm?.cssSelector) {
            locator = this.page.locator(selector || confirm.cssSelector);
          }
          break;
          
        case 'name':
          if (which?.name) {
            locator = this.page.locator(`[name="${which.name}"]`);
          }
          break;
          
        case 'id':
          if (which?.id) {
            locator = this.page.locator(`#${which.id}`);
          }
          break;
          
        default:
          // For strategies we don't have fast path for, return false
          // This will trigger full search
          if (selector) {
            locator = this.page.locator(selector);
          } else {
            return { success: false };
          }
      }
      
      if (locator) {
        const count = await locator.count().catch(() => 0);
        if (count > 0) {
          const firstLocator = locator.first();
          const isVisible = await firstLocator.isVisible().catch(() => false);
          
          if (isVisible) {
            // ================================================================
            // CRITICAL TEXT VERIFICATION for CSS-based strategies
            // Positional CSS selectors (span:nth-child(1)) can match wrong elements!
            // We must verify the found element contains the expected text
            // ================================================================
            if (needsTextVerification) {
              try {
                // Get text from element and nearby context
                const elementText = await firstLocator.textContent().catch(() => '') || '';
                const normalizedElementText = this.normalizeText(elementText || '');
                const normalizedExpected = this.normalizeText(expectedText || '');
                
                // Safety check - if expected text is empty, skip verification
                if (!normalizedExpected) {
                  this.log(`[FAST PATH] No expected text to verify, allowing match`);
                } else {
                  // Check if element text contains expected text (case-insensitive)
                  const textMatches = normalizedElementText.toLowerCase().includes(normalizedExpected.toLowerCase());
                  
                  // Also check nearby text (parent, siblings) for "nearText" matches
                  let nearTextMatches = false;
                  if (!textMatches && where?.nearText) {
                    try {
                      // Check parent element's text
                      const parentText = await firstLocator.locator('xpath=..').textContent().catch(() => '') || '';
                      const normalizedParentText = this.normalizeText(parentText || '');
                      nearTextMatches = normalizedParentText.toLowerCase().includes(normalizedExpected.toLowerCase());
                      
                      // Also check if the label sibling matches (common for checkboxes)
                      if (!nearTextMatches) {
                        // Try following sibling first
                        const followingText = await firstLocator.locator('xpath=following-sibling::*[1]').textContent().catch(() => '') || '';
                        if (followingText) {
                          nearTextMatches = this.normalizeText(followingText).toLowerCase().includes(normalizedExpected.toLowerCase());
                        }
                        // Try preceding sibling if following didn't match
                        if (!nearTextMatches) {
                          const precedingText = await firstLocator.locator('xpath=preceding-sibling::*[1]').textContent().catch(() => '') || '';
                          if (precedingText) {
                            nearTextMatches = this.normalizeText(precedingText).toLowerCase().includes(normalizedExpected.toLowerCase());
                          }
                        }
                      }
                    } catch (siblingError) {
                      // Sibling lookup failed, just use direct text match result
                      this.log(`[FAST PATH] Sibling lookup error (non-critical): ${siblingError.message}`);
                    }
                  }
                  
                  if (!textMatches && !nearTextMatches) {
                    this.log(`[FAST PATH] Text verification FAILED! Expected "${normalizedExpected}", found "${normalizedElementText}"`);
                    this.log(`[FAST PATH] CSS selector matched WRONG element - falling back to full search`);
                    
                    // CRITICAL: Record this as a failure to clear the bad cache entry
                    if (this.strategyMemory && this._currentFingerprint) {
                      this.strategyMemory.recordFailure(this._currentFingerprint, strategy);
                      this.log(`[FAST PATH] Recorded failure to invalidate cached strategy`);
                    }
                    
                    return { success: false, reason: 'text_mismatch' };
                  }
                  
                  this.log(`[FAST PATH] Text verification PASSED: "${normalizedExpected}"`);
                }
              } catch (verifyError) {
                // SAFE FALLBACK: If verification fails entirely, allow the match
                // This ensures we don't break existing behavior
                this.log(`[FAST PATH] Text verification error: ${verifyError.message}, allowing match anyway`);
              }
            }
            
            return { success: true, locator: firstLocator };
          }
        }
      }
      
      return { success: false };
    } catch (e) {
      this.log(`[FAST PATH] Error in remembered strategy: ${e.message}`);
      return { success: false, error: e };
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
    
    // Track match count for confidence
    this._matchCount = count;
    
    if (count === 0) {
      return { success: false, count: 0 };
    }
    
    if (count === 1) {
      this._usedPosition = 1;
      return { success: true, locator: locator.first(), count: 1 };
    }
    
    // Multiple matches - use position if available (most reliable for disambiguation)
    if (typeof which?.position === 'number' && which.position > 0 && which.position <= count) {
      this.log(`Multiple matches (${count}), using position ${which.position}`);
      this._usedPosition = which.position;
      this._fallbacksUsed.push('position');
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
    
    // Multiple matches - try to use ID as filter
    if (which?.id && !this._isDynamicId(which.id)) {
      try {
        const idLocator = this.page.locator(`#${which.id}`);
        const idCount = await idLocator.count();
        if (idCount === 1) {
          this.log(`Multiple matches (${count}), filtered to unique ID: ${which.id}`);
          this._usedPosition = 1;
          this._matchCount = 1; // Filtered down to 1
          return { success: true, locator: idLocator.first(), count: 1 };
        }
      } catch (e) {
        // ID selector failed, continue
      }
    }
    
    // Multiple matches - try to find one that's visible and in viewport
    try {
      for (let i = 0; i < Math.min(count, 10); i++) { // Check first 10 matches
        const candidate = locator.nth(i);
        const isVisible = await candidate.isVisible({ timeout: 500 }).catch(() => false);
        if (isVisible) {
          const box = await candidate.boundingBox().catch(() => null);
          if (box && box.y >= 0 && box.y < 1000) { // Visible in viewport
            this.log(`Multiple matches (${count}), using first visible in viewport (index ${i})`);
            this._usedPosition = i + 1;
            this._fallbacksUsed.push('visibility');
            return { success: true, locator: candidate, count };
          }
        }
      }
    } catch (e) {
      // Visibility check failed, continue to default
    }
    
    // Default to first with warning
    this.log(`WARNING: Multiple matches (${count}) with no disambiguation, using first. Consider recording with element index.`);
    this._usedPosition = 1;
    this._fallbacksUsed.push('first-of-many');
    return { success: true, locator: locator.first(), count };
  }
  
  /**
   * Check if an ID looks dynamic/auto-generated
   */
  _isDynamicId(id) {
    if (!id) return true;
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}/i,  // UUID
      /^\d{10,}$/,                   // Timestamp
      /^:r\d+:$/,                    // Radix
      /^ember\d+$/,                  // Ember
      /^react-/,                     // React
      /^vue_/,                       // Vue
      /^aura\d+/,                    // Salesforce Aura
      /^lwc-\d+/,                    // Salesforce LWC
      /_\d{5,}$/,                    // Ending with long numbers
    ];
    return dynamicPatterns.some(p => p.test(id));
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
