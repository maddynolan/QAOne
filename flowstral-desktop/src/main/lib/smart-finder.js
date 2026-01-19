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
    
    // CRITICAL: Normalize text to fix recording issues (double spaces, apostrophe variants)
    // This ensures playback works even if recording captured wrong characters
    if (what?.text) {
      what.text = this.normalizeText(what.text);
      this.log('Normalized text:', what.text);
    }
    if (which?.ariaLabel) {
      which.ariaLabel = this.normalizeText(which.ariaLabel);
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
      const clickableRoles = ['link', 'button', 'menuitem', 'tab', 'option'];
      const alternativeRoles = clickableRoles.filter(r => r !== what.role);
      
      for (const altRole of alternativeRoles) {
        const altResult = await this.tryStrategy(`role-alt-${altRole}`, async () => {
          const flexRegex = this.createFlexibleTextRegex(what.text);
          const locator = scope.getByRole(altRole, { name: flexRegex || new RegExp(what.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
          return await this.resolveMultiple(locator, which, `role-alt-${altRole}`);
        }, attempts);
        
        if (altResult.success) {
          this.log(`Found with alternative role "${altRole}" instead of "${what.role}"`);
          return altResult.locator;
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
        return await this.resolveMultiple(locator, which, 'text-exact');
      }, attempts);
      
      if (result.success) return result.locator;
      
      // APOSTROPHE FIX: Try with flexible apostrophe matching for text
      const flexibleTextRegex = this.createFlexibleTextRegex(what.text);
      if (flexibleTextRegex) {
        const apostropheResult = await this.tryStrategy('text-apostrophe-flex', async () => {
          const locator = scope.getByText(flexibleTextRegex);
          return await this.resolveMultiple(locator, which, 'text-apostrophe-flex');
        }, attempts);
        
        if (apostropheResult.success) return apostropheResult.locator;
      }
      
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
      // Strategy 1: Exact match
      const result = await this.tryStrategy('aria-label', async () => {
        const locator = scope.locator(`[aria-label="${which.ariaLabel}"]`);
        return await this.validateLocator(locator, 'aria-label');
      }, attempts);
      
      if (result.success) return result.locator;
      
      // Strategy 2: Partial match (contains) - handles minor text differences
      const partialResult = await this.tryStrategy('aria-label-contains', async () => {
        // Get first significant part of ariaLabel (before comma or first 20 chars)
        const searchPart = which.ariaLabel.split(',')[0].trim();
        const normalizedSearch = this.normalizeText(searchPart);
        const locator = scope.locator(`[aria-label*="${normalizedSearch}"]`);
        return await this.validateLocator(locator, 'aria-label-contains');
      }, attempts);
      
      if (partialResult.success) return partialResult.locator;
      
      // Strategy 3: Flexible regex (handles apostrophe variants)
      const flexResult = await this.tryStrategy('aria-label-flex', async () => {
        const searchPart = which.ariaLabel.split(',')[0].trim();
        const flexRegex = this.createFlexibleTextRegex(searchPart);
        // Use XPath for regex matching on aria-label
        const locator = scope.getByRole('link', { name: flexRegex });
        return await this.validateLocator(locator, 'aria-label-flex');
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
      
      // APOSTROPHE FIX: Last resort - try with flexible apostrophe matching
      const flexibleTextRegex = this.createFlexibleTextRegex(what.text);
      if (flexibleTextRegex) {
        const apostropheResult = await this.tryStrategy('text-contains-apostrophe-flex', async () => {
          const locator = this.page.getByText(flexibleTextRegex).first();
          return await this.validateLocator(locator, 'text-contains-apostrophe-flex');
        }, attempts);
        
        if (apostropheResult.success) return apostropheResult.locator;
      }
      
      // KEYWORD EXTRACTION: Try key phrases from the text
      // e.g., "Go To Saver's Switch" → try "Saver's Switch"
      const keyPhrases = what.text
        .split(/\s+(?:to|the|a|an|with|for|on|in|and|or|of)\s+/i)
        .filter(phrase => phrase.length > 3)
        .map(phrase => phrase.trim());
      
      for (const keyPhrase of keyPhrases) {
        if (keyPhrase.length >= 5 && keyPhrase !== what.text) {
          const keywordRegex = this.createFlexibleTextRegex(keyPhrase);
          if (keywordRegex) {
            const keywordResult = await this.tryStrategy('keyword-extract', async () => {
              const locator = this.page.getByText(keywordRegex).first();
              return await this.validateLocator(locator, 'keyword-extract');
            }, attempts);
            
            if (keywordResult.success) {
              this.log(`Found by keyword extraction: "${keyPhrase}" from "${what.text}"`);
              return keywordResult.locator;
            }
          }
        }
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
    if (confirm?.boundingBox) {
      const bboxResult = await this.tryStrategy('boundingBox-center', async () => {
        const { x, y, width, height } = confirm.boundingBox;
        // Calculate center of bounding box
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        this.log(`Trying bounding box center: (${centerX}, ${centerY})`);
        
        const element = await this.page.evaluateHandle(
          ([cx, cy]) => {
            const el = document.elementFromPoint(cx, cy);
            return el;
          },
          [centerX, centerY]
        );
        
        if (element) {
          const isValid = await element.evaluate(el => el !== null && el !== undefined);
          if (isValid) {
            // Convert ElementHandle to Locator by getting a selector
            const tagName = await element.evaluate(el => el.tagName?.toLowerCase() || 'div');
            // Return a locator that clicks at these coordinates
            return { 
              success: true, 
              locator: this.page.locator(`${tagName}`).first(), 
              count: 1,
              useCoordinates: { x: centerX, y: centerY } 
            };
          }
        }
        return { success: false, count: 0 };
      }, attempts);
      
      if (bboxResult.success) {
        // Store coordinates for click handler to use
        this._lastBoundingBoxCoords = bboxResult.useCoordinates;
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
      // Use Playwright's pierce selector for Shadow DOM
      // This automatically pierces through open Shadow DOMs
      
      // Strategy 1: TestId with pierce
      if (which?.testId) {
        const locator = this.page.locator(`pierce/[data-testid="${which.testId}"]`);
        const count = await locator.count();
        if (count > 0) {
          this.log(`Found in Shadow DOM by testId: ${which.testId}`);
          return { success: true, locator: locator.first(), count };
        }
      }
      
      // Strategy 2: Role + Text with pierce
      if (what?.role && what?.text) {
        const normalizedText = this.normalizeText(what.text);
        // Playwright's pierce locator
        const locator = this.page.locator(`pierce/${what.role}:has-text("${normalizedText}")`);
        const count = await locator.count();
        if (count > 0) {
          this.log(`Found in Shadow DOM by role+text: ${what.role} "${normalizedText}"`);
          return { success: true, locator: locator.first(), count };
        }
      }
      
      // Strategy 3: Text-only with pierce
      if (what?.text) {
        const normalizedText = this.normalizeText(what.text);
        const locator = this.page.locator(`pierce/:text("${normalizedText}")`);
        const count = await locator.count();
        if (count > 0) {
          this.log(`Found in Shadow DOM by text: "${normalizedText}"`);
          return { success: true, locator: locator.first(), count };
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
