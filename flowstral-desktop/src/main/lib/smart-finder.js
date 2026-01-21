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
    
    // Telemetry for debugging failed attempts
    this.lastFailedAttempts = null;
    this.lastFailedRecipe = null;
    
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
   * @returns {Promise<Locator>} - Playwright locator
   */
  async find(recipe) {
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
          return sfResult.locator;
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
      
      if (result.success) return result.locator;
      
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
      
      if (result.success) return result.locator;
      
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
      
      if (result.success) return result.locator;
      
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
      
      if (result.success) return result.locator;
    }
    
    // ==========================================================================
    // PHASE 8: Fallback to CSS selector
    // ==========================================================================
    
    if (confirm?.cssSelector) {
      const result = await this.tryStrategy('css-fallback', async () => {
        const locator = this.page.locator(confirm.cssSelector);
        return await this.validateLocator(locator, 'css-fallback');
      }, attempts);
      
      if (result.success) return result.locator;
      
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
          return result.locator;
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
    
    if (shadowResult.success) return shadowResult.locator;
    
    // ==========================================================================
    // PHASE 10: COORDINATE-BASED FALLBACK (for edge cases)
    // ==========================================================================
    
    // Try using which.coordinates
    if (which?.coordinates) {
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
    if (confirm?.boundingBox) {
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
        return bboxResult.locator;
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
    
    // Multiple matches - use position if available (most reliable for disambiguation)
    if (typeof which?.position === 'number' && which.position > 0 && which.position <= count) {
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
    
    // Multiple matches - try to use ID as filter
    if (which?.id && !this._isDynamicId(which.id)) {
      try {
        const idLocator = this.page.locator(`#${which.id}`);
        const idCount = await idLocator.count();
        if (idCount === 1) {
          this.log(`Multiple matches (${count}), filtered to unique ID: ${which.id}`);
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
            return { success: true, locator: candidate, count };
          }
        }
      }
    } catch (e) {
      // Visibility check failed, continue to default
    }
    
    // Default to first with warning
    this.log(`WARNING: Multiple matches (${count}) with no disambiguation, using first. Consider recording with element index.`);
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
