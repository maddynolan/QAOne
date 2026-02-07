/**
 * Action Handlers Module
 * 
 * UNIFIED EXECUTION POINT for all action handling.
 * Both PlaywrightRecorder and TestExecutor use this module.
 * 
 * Usage:
 *   const ActionHandlers = require('./lib/action-handlers');
 *   const result = await ActionHandlers.executeAction(ctx, action, options);
 */

// Import shared modules
const { findElementWithAI, clickAtCoordinates, fillAtCoordinates, retryWithBackoff } = require('./ai-fallback');
const RecordingUtils = require('./recording-utils');

// Import Reliability Layer - eliminates false positives
const ReliabilityLayer = require('./reliability-layer');

// Import PWA testing module (lazy loaded to avoid startup cost if not used)
let PWATesting = null;
const getPWATesting = () => {
  if (!PWATesting) {
    PWATesting = require('./pwa-testing');
  }
  return PWATesting;
};

// ============================================================
// TEXT NORMALIZATION UTILITIES
// Critical for matching recorded text against page text
// ============================================================
const normalizeTextForMatching = (text) => {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTextFromDescription = (description) => {
  if (!description) return '';
  const match = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*"([^"]+)"/i);
  if (match) return match[1];
  const matchSingle = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*'([^']+)'/i);
  if (matchSingle) return matchSingle[1];
  return description;
};

const getActionLabel = (action) => {
  let label = action.label || 
              action.text || 
              action.selectorObj?.text ||
              action.recipe?.what?.text ||
              action.args?.[0];
  
  if (!label && action.description) {
    label = extractTextFromDescription(action.description);
  }
  
  return normalizeTextForMatching(label || '');
};

// ═══════════════════════════════════════════════════════════════════════════
// SMART PRODUCT CLICK HANDLER
// Handles "Add to cart", "Buy now", etc. by finding the product first
// This ensures we click the right product even if grid order changes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if this is a product-specific action (Add to cart, Buy now, etc.)
 * Returns the product name if detected, null otherwise
 */
function extractProductNameFromAction(action, label) {
  const description = action.description || '';
  const actionLabel = label || '';
  
  // Patterns for product-specific actions
  // "Add to cart for iPhone 17 Pro Phone Case - heyday Pink"
  // "Add to cart - Filling Good Hyaluronic Acid Plumping Serum"
  // "Buy iPhone 17 Pro"
  const patterns = [
    /add to cart (?:for |[-–] ?)?(.+)/i,
    /buy(?: now)? (?:for |[-–] ?)?(.+)/i,
    /add (?:for |[-–] ?)?(.+?) to cart/i,
    /quick add (?:for |[-–] ?)?(.+)/i,
    /select (?:for |[-–] ?)?(.+)/i,
  ];
  
  // Try description first (more context)
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1] && match[1].length > 3) {
      return match[1].trim();
    }
  }
  
  // Try label
  for (const pattern of patterns) {
    const match = actionLabel.match(pattern);
    if (match && match[1] && match[1].length > 3) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Handle product-specific clicks by finding the product first
 * Returns result object if handled, null to fall through to normal click handling
 */
async function handleProductClick(ctx, action, label, timeout) {
  const productName = extractProductNameFromAction(action, label);
  
  if (!productName) {
    return null; // Not a product-specific action, let normal handling proceed
  }
  
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  console.log(`[ActionHandler] SMART PRODUCT CLICK detected`);
  console.log(`[ActionHandler] Product: "${productName}"`);
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  
  try {
    // Strategy 1: Find product card by title/name, then click Add to Cart within it
    const productCardSelectors = [
      // Common product card containers
      `[data-test="product-card"]:has-text("${productName}")`,
      `[data-testid="product-card"]:has-text("${productName}")`,
      `article:has-text("${productName}")`,
      `[class*="product"]:has-text("${productName}")`,
      `[class*="ProductCard"]:has-text("${productName}")`,
      `[class*="item-card"]:has-text("${productName}")`,
      `li:has-text("${productName}")`,
      `div[data-automation-id]:has-text("${productName}")`, // Walmart
    ];
    
    for (const cardSelector of productCardSelectors) {
      try {
        const card = ctx.page.locator(cardSelector).first();
        const cardCount = await card.count();
        
        if (cardCount > 0) {
          console.log(`[ActionHandler] Found product card with: ${cardSelector}`);
          
          // Now find the Add to Cart button WITHIN this specific card
          const buttonSelectors = [
            'button:has-text("Add to cart")',
            'button:has-text("Add to Cart")',
            'button:has-text("Add")',
            '[data-test="addToCartButton"]',
            '[data-testid="add-to-cart"]',
            '[aria-label*="Add to cart"]',
            '[aria-label*="add to cart"]',
            'button[class*="addToCart"]',
            'button[class*="add-to-cart"]',
          ];
          
          for (const btnSelector of buttonSelectors) {
            try {
              const button = card.locator(btnSelector).first();
              const btnCount = await button.count();
              
              if (btnCount > 0) {
                // VERIFY: Check the card contains the product name before clicking
                const cardText = await card.textContent().catch(() => '');
                const cardContainsProduct = cardText.toLowerCase().includes(productName.toLowerCase().substring(0, 20));
                
                if (!cardContainsProduct) {
                  console.log(`[ActionHandler] ⚠️ Card doesn't contain product "${productName.substring(0, 30)}..." - skipping`);
                  continue; // Try next card selector
                }
                
                // Scroll into view
                await button.scrollIntoViewIfNeeded().catch(() => {});
                await ctx.page.waitForTimeout(200);
                
                // Click the button
                await button.click({ timeout: 5000 });
                
                console.log(`[ActionHandler] ✓ SMART PRODUCT CLICK succeeded!`);
                console.log(`[ActionHandler]   Product: "${productName}"`);
                console.log(`[ActionHandler]   Button: ${btnSelector}`);
                console.log(`[ActionHandler]   Verified: Card contains "${productName.substring(0, 30)}..."`);
                return { success: true, strategy: 'smart-product-click', verified: true };
              }
            } catch (e) {
              // Try next button selector
            }
          }
        }
      } catch (e) {
        // Try next card selector
      }
    }
    
    // Strategy 2: Find product by text, then find nearby Add to Cart button
    console.log(`[ActionHandler] Strategy 2: Finding product text and nearby button...`);
    
    const productText = ctx.page.getByText(productName, { exact: false }).first();
    const textCount = await productText.count();
    
    if (textCount > 0) {
      // Find the containing card/article/container
      const containers = [
        productText.locator('xpath=ancestor::article'),
        productText.locator('xpath=ancestor::li'),
        productText.locator('xpath=ancestor::div[contains(@class, "product")]'),
        productText.locator('xpath=ancestor::div[contains(@class, "card")]'),
        productText.locator('xpath=ancestor::*[@data-test]'),
      ];
      
      for (const container of containers) {
        try {
          if (await container.count() > 0) {
            const addButton = container.first().locator('button:has-text("Add")').first();
            if (await addButton.count() > 0) {
              // VERIFY: Container text matches product
              const containerText = await container.first().textContent().catch(() => '');
              if (!containerText.toLowerCase().includes(productName.toLowerCase().substring(0, 15))) {
                console.log(`[ActionHandler] ⚠️ Container doesn't contain product - skipping`);
                continue;
              }
              
              await addButton.scrollIntoViewIfNeeded().catch(() => {});
              await ctx.page.waitForTimeout(200);
              await addButton.click({ timeout: 5000 });
              
              console.log(`[ActionHandler] ✓ SMART PRODUCT CLICK (via text ancestor) succeeded!`);
              console.log(`[ActionHandler]   Verified: Container contains "${productName.substring(0, 30)}..."`);
              return { success: true, strategy: 'smart-product-click-ancestor', verified: true };
            }
          }
        } catch (e) {
          // Try next container
        }
      }
    }
    
    // Strategy 3: Look for exact product link/title with aria-label
    console.log(`[ActionHandler] Strategy 3: Looking for product by aria-label...`);
    
    const ariaProduct = ctx.page.locator(`[aria-label*="${productName}" i]`).first();
    if (await ariaProduct.count() > 0) {
      // Find nearby Add to Cart
      const parent = ariaProduct.locator('xpath=ancestor::*[.//button[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "add")]]').first();
      if (await parent.count() > 0) {
        const addBtn = parent.locator('button:has-text("Add")').first();
        if (await addBtn.count() > 0) {
          await addBtn.scrollIntoViewIfNeeded().catch(() => {});
          await addBtn.click({ timeout: 5000 });
          
          console.log(`[ActionHandler] ✓ SMART PRODUCT CLICK (via aria-label) succeeded!`);
          return { success: true, strategy: 'smart-product-click-aria' };
        }
      }
    }
    
    console.log(`[ActionHandler] Smart product click strategies exhausted, falling back to normal click...`);
    return null; // Fall through to normal click handling
    
  } catch (e) {
    console.log(`[ActionHandler] Smart product click error: ${e.message}`);
    return null; // Fall through to normal click handling
  }
}

/**
 * Handle navigation actions (goto, navigate)
 */
async function handleNavigation(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const navUrl = action.url || action.value || action.selector;
  
  if (!navUrl) {
    return { success: false, error: 'No URL provided for navigation' };
  }
  
  // Smart skip: if we're already at the target URL, skip redundant navigation
  const currentUrl = ctx.page.url();
  try {
    const targetHost = new URL(navUrl).hostname;
    const currentHost = new URL(currentUrl).hostname;
    
    // Skip if already on same Lightning host (post-login redirect scenario)
    if (targetHost === currentHost && 
        (currentUrl.includes('lightning.force.com') || currentUrl.includes('/one/one.app'))) {
      console.log(`[ActionHandler] Skipping redundant navigation - already at ${currentHost}`);
      return { success: true, skipped: true };
    }
  } catch (e) {
    // URL parsing failed, proceed with navigation
  }
  
  await ctx.page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout });
  return { success: true };
}

/**
 * Handle Salesforce-specific navigation (NavigateTo)
 */
async function handleSalesforceNavigation(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const navTarget = action.args?.[0] || action.value || action.label;
  console.log(`[ActionHandler] NavigateTo: "${navTarget}"`);
  
  let sfNavUrl;
  if (navTarget && navTarget.startsWith('http')) {
    sfNavUrl = navTarget;
  } else {
    // Build from current page URL
    const currentUrl = ctx.page.url();
    const baseMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
    if (baseMatch && navTarget) {
      const baseUrl = baseMatch[1];
      // Handle object names like "Accounts" -> "Account"
      const objectName = navTarget.replace(/s$/, '');
      sfNavUrl = `${baseUrl}/lightning/o/${objectName}/list`;
    }
  }
  
  if (sfNavUrl) {
    console.log(`[ActionHandler] Navigating to: ${sfNavUrl}`);
    await ctx.page.goto(sfNavUrl, { waitUntil: 'domcontentloaded', timeout });
    return { success: true };
  }
  
  return { success: false, error: `Cannot navigate to "${navTarget}"` };
}

/**
 * Handle click actions with 4-layer fallback
 * Layer 1: SmartFinder (recipe-based) with retry
 * Layer 2: Legacy _findElement (50+ strategies) with retry
 * Layer 3: iFrame search (for elements inside iframes)
 * Layer 4: AI Vision Fallback (screenshot + GPT-4o)
 */
async function handleClick(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const selector = action.selector || action.manualSelector;
  
  // ═══════════════════════════════════════════════════════════════════════
  // SPECIAL SELECTOR TYPES: Handle xpath:, coords:, ocr:, image:, text:
  // These are set by the ElementRepairWizard for manual fixes
  // ═══════════════════════════════════════════════════════════════════════
  const manualSelector = action.manualSelector || '';
  
  // Handle XPath selector
  if (manualSelector.startsWith('xpath=')) {
    const xpath = manualSelector.substring(6);
    console.log(`[ActionHandler] Using XPath selector: ${xpath}`);
    try {
      const element = ctx.page.locator(manualSelector);
      if (await element.count() > 0) {
        await element.first().click({ timeout });
        return { success: true, strategy: 'manual-xpath' };
      }
    } catch (e) {
      console.log(`[ActionHandler] XPath selector failed: ${e.message}`);
    }
  }
  
  // Handle Coordinates
  if (manualSelector.startsWith('coords:')) {
    const coordStr = manualSelector.substring(7);
    const [x, y] = coordStr.split(',').map(s => parseInt(s.trim()));
    if (!isNaN(x) && !isNaN(y)) {
      // Warn if cross-device but still allow manual coordinates (user knows best)
      if (ctx._skipCoordinateFallback) {
        console.log(`[ActionHandler] ⚠️ WARNING: Using coordinates cross-device may fail (viewport mismatch)`);
      }
      console.log(`[ActionHandler] Using coordinates: (${x}, ${y})`);
      try {
        await ctx.page.mouse.click(x, y);
        return { success: true, strategy: 'manual-coords' };
      } catch (e) {
        return { success: false, error: `Coordinate click failed: ${e.message}` };
      }
    }
  }
  
  // Handle OCR text (visual text search)
  if (manualSelector.startsWith('ocr:')) {
    const ocrText = manualSelector.substring(4);
    console.log(`[ActionHandler] Using OCR text search: "${ocrText}"`);
    try {
      // Try text-based locator first
      const textLocator = ctx.page.getByText(ocrText, { exact: false });
      if (await textLocator.count() > 0) {
        await textLocator.first().click({ timeout });
        return { success: true, strategy: 'ocr-text-match' };
      }
      // Fall back to AI vision if available
      if (ctx.enableAIFallback) {
        const aiResult = await ctx.findElementWithAI(ocrText, 'click');
        if (aiResult) {
          await ctx.page.mouse.click(aiResult.x, aiResult.y);
          return { success: true, strategy: 'ocr-ai-vision' };
        }
      }
      return { success: false, error: `OCR text not found: "${ocrText}"` };
    } catch (e) {
      return { success: false, error: `OCR search failed: ${e.message}` };
    }
  }
  
  // Handle Text selector - supports exact match (text="value") or partial (text=value)
  if (manualSelector.startsWith('text=')) {
    const isExact = manualSelector.startsWith('text="') && manualSelector.endsWith('"');
    const textValue = isExact 
      ? manualSelector.substring(6, manualSelector.length - 1) // Remove text=" and trailing "
      : manualSelector.substring(5);
    
    console.log(`[ActionHandler] Using text selector: "${textValue}" (exact: ${isExact})`);
    try {
      const element = ctx.page.getByText(textValue, { exact: isExact });
      const count = await element.count();
      console.log(`[ActionHandler] Found ${count} elements matching "${textValue}"`);
      
      if (count > 0) {
        // If multiple matches, log a warning
        if (count > 1 && !isExact) {
          console.log(`[ActionHandler] ⚠️ Multiple matches found - clicking first. Consider using exact match.`);
        }
        await element.first().click({ timeout });
        return { success: true, strategy: isExact ? 'manual-text-exact' : 'manual-text-partial' };
      } else {
        console.log(`[ActionHandler] No elements found with text "${textValue}"`);
      }
    } catch (e) {
      console.log(`[ActionHandler] Text selector failed: ${e.message}`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SMART PRODUCT CLICK: Handle "Add to cart" clicks by finding product first
  // This ensures we click the right product even if order changes
  // ═══════════════════════════════════════════════════════════════════════
  const productClickResult = await handleProductClick(ctx, action, label, timeout);
  if (productClickResult) {
    return productClickResult;
  }
  
  // Try finding element with automatic retry (handles slow pages)
  let clickResult = await ctx.findElementWithRetry(action);
  
  // Layer 3: IFRAME FALLBACK - Search inside iframes if not found on main page
  if (!clickResult) {
    console.log('[ActionHandler] Click: Element not on main page, checking iframes...');
    clickResult = await searchIframesForClick(ctx, action, label);
  }
  
  // Layer 4: AI FALLBACK - Last resort when all deterministic strategies fail
  // SKIP if cross-device playback (coordinates won't work on different viewport)
  if (!clickResult && ctx.enableAIFallback && !ctx._skipCoordinateFallback) {
    console.log(`[ActionHandler] All strategies failed after retries, trying AI fallback...`);
    const aiResult = await ctx.findElementWithAI(label || selector || action.description, 'click');
    if (aiResult) {
      try {
        await ctx.clickAtCoordinates(aiResult.x, aiResult.y);
        console.log(`[ActionHandler] ✓ AI Fallback click succeeded at (${aiResult.x}, ${aiResult.y})`);
        return { success: true, strategy: 'AI Vision Fallback' };
      } catch (e) {
        console.log(`[ActionHandler] AI Fallback click failed:`, e.message);
      }
    }
  } else if (!clickResult && ctx._skipCoordinateFallback) {
    console.log(`[ActionHandler] ⚠️ Skipping AI/coordinate fallback (cross-device playback)`);
  }
  
  if (!clickResult) {
    return { success: false, error: `Could not find element to click: "${label || selector}"` };
  }
  
  console.log(`[ActionHandler] Clicking element: "${label}" using ${clickResult.strategy.type}`);
  
  // Handle case where SmartFinder already clicked the element (Salesforce "New" buttons)
  if (clickResult.alreadyClicked) {
    console.log('[ActionHandler] ✓ Click already performed by SmartFinder');
    return { success: true, strategy: 'SmartFinder-DirectClick' };
  }
  
  // Handle direct coordinate click (when SmartFinder couldn't build a valid locator)
  if (clickResult.useDirectClick && clickResult.coords) {
    console.log(`[ActionHandler] Using direct coordinate click at (${clickResult.coords.x}, ${clickResult.coords.y})`);
    try {
      await ctx.page.mouse.click(clickResult.coords.x, clickResult.coords.y);
      console.log('[ActionHandler] ✓ Direct coordinate click succeeded');
      return { success: true, strategy: 'DirectCoordinates' };
    } catch (e) {
      console.log('[ActionHandler] Direct coordinate click failed:', e.message);
      return { success: false, error: `Direct coordinate click failed: ${e.message}` };
    }
  }
  
  // Debug: Log element details
  try {
    const elementInfo = await clickResult.locator.evaluate(el => ({
      tag: el.tagName,
      href: el.href || el.getAttribute('href'),
      classes: el.className,
      text: (el.textContent || '').substring(0, 50)
    }));
    console.log(`[ActionHandler] Element details: tag=${elementInfo.tag}, href=${elementInfo.href}`);
  } catch (e) {}
  
  // ═══════════════════════════════════════════════════════════════════════
  // RELIABILITY LAYER: Pre-action verification
  // Ensures element is truly actionable before clicking
  // ═══════════════════════════════════════════════════════════════════════
  const preActionCheck = await ReliabilityLayer.verifyElementActionable(ctx.page, clickResult.locator, 'click');
  
  if (!preActionCheck.actionable) {
    console.log(`[ActionHandler] ⚠️ Pre-action check failed:`, preActionCheck.issues.join(', '));
    console.log(`[ActionHandler] 💡 Suggestion: ${preActionCheck.suggestion}`);
    
    // Return with fix suggestions
    return { 
      success: false, 
      error: preActionCheck.issues.join('; '),
      suggestion: preActionCheck.suggestion,
      checks: preActionCheck.checks
    };
  }
  
  if (preActionCheck.issues.length > 0) {
    console.log(`[ActionHandler] ⚠️ Warnings:`, preActionCheck.issues.join(', '));
  }
  
  // Handle multiple matches with smart disambiguation
  const count = await clickResult.locator.count().catch(() => 1);
  if (count > 1) {
    console.log(`[ActionHandler] Multiple elements (${count}) found, disambiguating...`);
    const disambiguated = await ReliabilityLayer.disambiguateMatches(
      ctx.page, 
      clickResult.locator, 
      action.recipe,
      action.visualFingerprint
    );
    clickResult.locator = disambiguated.locator;
    console.log(`[ActionHandler] Selected candidate ${disambiguated.index} (confidence: ${(disambiguated.confidence * 100).toFixed(0)}%)`);
    if (disambiguated.reasons) {
      console.log(`[ActionHandler] Reasons: ${disambiguated.reasons.join(', ')}`);
    }
  }
  
  // Scroll into view and highlight briefly
  await clickResult.locator.scrollIntoViewIfNeeded().catch(() => {});
  await clickResult.locator.evaluate(el => {
    el.style.outline = '2px solid #22c55e';
    el.style.outlineOffset = '1px';
  }).catch(() => {});
  
  // Minimal delay for highlight visibility
  await ctx.page.waitForTimeout(100);
  
  // Try multiple click methods
  let clickSuccess = false;
  
  // Method 1: Standard Playwright click WITHOUT force
  try {
    await clickResult.locator.click({ timeout: 5000 });
    clickSuccess = true;
    console.log('[ActionHandler] ✓ Standard click succeeded');
  } catch (e1) {
    console.log('[ActionHandler] Standard click failed:', e1.message);
    
    // Method 2: Force click (for elements that might be obscured)
    try {
      await clickResult.locator.click({ force: true, timeout: 3000 });
      clickSuccess = true;
      console.log('[ActionHandler] ✓ Force click succeeded');
    } catch (e2) {
      console.log('[ActionHandler] Force click failed:', e2.message);
      
      // Method 3: dispatchEvent click
      try {
        await clickResult.locator.dispatchEvent('click');
        clickSuccess = true;
        console.log('[ActionHandler] ✓ dispatchEvent click succeeded');
      } catch (e3) {
        console.log('[ActionHandler] dispatchEvent click failed:', e3.message);
        
        // Method 4: JavaScript click
        try {
          await clickResult.locator.evaluate(el => el.click());
          clickSuccess = true;
          console.log('[ActionHandler] ✓ JavaScript click succeeded');
        } catch (e4) {
          console.log('[ActionHandler] All click methods failed');
          return { success: false, error: `All click methods failed for "${label}"` };
        }
      }
    }
  }
  
  // Remove highlight
  await clickResult.locator.evaluate(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  }).catch(() => {});
  
  // Allow time for click to trigger any actions/navigations
  await ctx.page.waitForTimeout(200);
  
  // ═══════════════════════════════════════════════════════════════════════
  // POST-CLICK VERIFICATION: Ensure we clicked the CORRECT element
  // Prevents false positives where we click ANY element instead of intended
  // ═══════════════════════════════════════════════════════════════════════
  const verificationResult = await verifyClickedCorrectElement(ctx, action, clickResult, label);
  if (!verificationResult.verified) {
    console.log(`[ActionHandler] ⚠️ CLICK VERIFICATION FAILED: ${verificationResult.reason}`);
    // Return failure if verification fails - this prevents false positives
    return { 
      success: false, 
      error: `Clicked element doesn't match intended target: ${verificationResult.reason}`,
      strategy: clickResult.strategy.type,
      verificationFailed: true
    };
  }
  
  return { success: true, strategy: clickResult.strategy.type };
}

/**
 * Verify that we clicked the correct element (prevents false positives)
 * Compares clicked element's text/context with intended target
 */
async function verifyClickedCorrectElement(ctx, action, clickResult, label) {
  try {
    // Get the text/description we intended to click
    const intendedText = label || 
                        action.text || 
                        action.description ||
                        action.recipe?.what?.text ||
                        action.recipe?.where?.nearText ||
                        action.productContext;
    
    // If no intended text to verify against, skip verification
    if (!intendedText || intendedText.length < 3) {
      return { verified: true, reason: 'No text to verify against' };
    }
    
    // Get what we actually clicked - STRICT: Only check immediate element and direct parent
    let clickedText = { elText: '', ariaLabel: '', title: '', containerText: '' };
    try {
      clickedText = await clickResult.locator.evaluate(el => {
        // Get text from the element itself (including Shadow DOM text)
        const elText = el.textContent?.trim() || el.innerText?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        
        // For Lightning/Shadow DOM, try to get text from shadow root
        let shadowText = '';
        if (el.shadowRoot) {
          shadowText = el.shadowRoot.textContent?.trim()?.substring(0, 100) || '';
        }
        
        // STRICT: Only check IMMEDIATE container (first product card/item), not entire grid
        let containerText = '';
        const immediateContainers = [
          'article', 
          '[data-testid*="product"]', 
          '[data-test*="product"]',
          '[class*="ProductCard"]',
          '[class*="product-card"]',
          '[class*="item-card"]',
          'li[class*="product"]',
          'div[data-automation-id]', // Walmart
          // Salesforce/Lightning containers
          'lightning-menu-item',
          'li[role="presentation"]',
          '[role="menuitem"]',
          '[role="option"]'
        ];
        
        for (const selector of immediateContainers) {
          const container = el.closest(selector);
          if (container && container !== el) {
            // Get only the product title/name from the container, not all text
            const titleEl = container.querySelector('h3, h2, [data-testid*="title"], [data-test*="title"], [class*="title"], [class*="name"], a[href*="product"], span');
            if (titleEl) {
              containerText = titleEl.textContent?.trim()?.substring(0, 100) || '';
            } else {
              // Fallback: get first 150 chars only (not entire container)
              containerText = container.textContent?.trim()?.substring(0, 150) || '';
            }
            break;
          }
        }
        
        return { elText: elText || shadowText, ariaLabel, title, containerText };
      });
    } catch (e) {
      // If we can't read element text, DON'T fail - the click still happened
      console.log(`[ActionHandler] Could not read clicked element text: ${e.message}`);
      return { verified: true, reason: 'Could not read element text (click succeeded)' };
    }
    
    // IMPORTANT: If we got no text at all, assume click was successful
    // This handles Shadow DOM, iframes, and dynamically rendered content
    const allText = [clickedText.elText, clickedText.ariaLabel, clickedText.title, clickedText.containerText].join('').trim();
    if (!allText) {
      console.log(`[ActionHandler] No text found on clicked element - assuming click was correct`);
      return { verified: true, reason: 'No text readable from element (click succeeded)' };
    }
    
    // Normalize texts for comparison
    const normalize = (text) => text?.toLowerCase().replace(/[^\w\s]/g, '').trim() || '';
    const intendedNorm = normalize(intendedText);
    
    // Check if intended text appears in ANY of the clicked element's text properties
    const allClickedText = [
      clickedText.elText,
      clickedText.ariaLabel,
      clickedText.title,
      clickedText.containerText
    ].join(' ').toLowerCase();
    
    // Extract key identifying words from intended text (ignore common words)
    const ignoreWords = new Set(['click', 'the', 'a', 'an', 'in', 'for', 'to', 'of', 'cart', 'add', 'buy', 'now', 'button']);
    const keyWords = intendedNorm.split(/\s+/)
      .filter(w => w.length > 2 && !ignoreWords.has(w))
      .slice(0, 5); // Take up to 5 key words
    
    if (keyWords.length === 0) {
      return { verified: true, reason: 'No key words to verify' };
    }
    
    // Check if at least 50% of key words appear in clicked text
    const matchingWords = keyWords.filter(word => allClickedText.includes(word));
    const matchRatio = matchingWords.length / keyWords.length;
    
    console.log(`[ActionHandler] ═══ CLICK VERIFICATION ═══`);
    console.log(`  INTENDED: "${intendedText.substring(0, 80)}"`);
    console.log(`  CLICKED ELEMENT: "${clickedText.elText?.substring(0, 50) || '(no text)'}"`);
    console.log(`  CLICKED CONTAINER: "${clickedText.containerText?.substring(0, 80) || '(no container)'}"`);
    console.log(`  KEY WORDS: [${keyWords.join(', ')}]`);
    console.log(`  MATCHING: [${matchingWords.join(', ')}] (${Math.round(matchRatio * 100)}%)`);
    
    // STRICTER MATCHING for product-specific actions
    const isProductAction = /iphone|samsung|galaxy|pixel|case|phone|product|watch|airpod|macbook|laptop|tv|headphone/i.test(intendedText);
    const hasSpecificBrand = /iphone|samsung|apple|google|sony|lg|dell|hp|lenovo|nike|adidas/i.test(intendedText);
    
    // For branded products, require the brand name to be in the clicked text
    if (hasSpecificBrand) {
      const brandMatch = intendedText.match(/iphone|samsung|apple|google|sony|lg|dell|hp|lenovo|nike|adidas/i);
      const brandName = brandMatch ? brandMatch[0].toLowerCase() : null;
      
      if (brandName && !allClickedText.includes(brandName)) {
        console.log(`[ActionHandler] ✗ BRAND MISMATCH: Expected "${brandName}" not found in clicked element`);
        return { 
          verified: false, 
          reason: `Expected product with "${brandName}" but clicked "${clickedText.containerText?.substring(0, 50) || clickedText.elText?.substring(0, 50) || 'unknown'}"`
        };
      }
    }
    
    // Require higher match for products (70%) vs generic actions (50%)
    const requiredMatch = isProductAction ? 0.7 : 0.5;
    
    if (matchRatio >= requiredMatch) {
      console.log(`[ActionHandler] ✓ VERIFICATION PASSED (${Math.round(matchRatio * 100)}% match >= ${Math.round(requiredMatch * 100)}% required)`);
      return { verified: true, reason: `Matched ${Math.round(matchRatio * 100)}% of key words` };
    } else {
      // Only allow significant word match if it's a unique identifying word (6+ chars)
      const significantMatch = keyWords.some(word => 
        word.length >= 6 && allClickedText.includes(word)
      );
      
      if (significantMatch) {
        const matchedWord = keyWords.find(w => w.length >= 6 && allClickedText.includes(w));
        console.log(`[ActionHandler] ✓ VERIFICATION PASSED (found significant word: "${matchedWord}")`);
        return { verified: true, reason: `Found significant word: "${matchedWord}"` };
      }
      
      console.log(`[ActionHandler] ✗ VERIFICATION FAILED: ${Math.round(matchRatio * 100)}% < ${Math.round(requiredMatch * 100)}% required`);
      return { 
        verified: false, 
        reason: `Expected "${keyWords.slice(0, 3).join(', ')}..." but clicked "${clickedText.containerText?.substring(0, 40) || clickedText.elText?.substring(0, 40) || 'unknown'}"`
      };
    }
  } catch (e) {
    // If verification fails for technical reasons, allow the click
    console.log(`[ActionHandler] Click verification error: ${e.message}`);
    return { verified: true, reason: 'Verification error, allowing click' };
  }
}

/**
 * Search iframes for click target
 */
async function searchIframesForClick(ctx, action, label) {
  const iframes = await ctx.page.locator('iframe').all();
  console.log(`[ActionHandler] Found ${iframes.length} iframes to search`);
  
  for (let i = 0; i < iframes.length; i++) {
    try {
      const frameLocator = ctx.page.frameLocator(`iframe >> nth=${i}`);
      
      const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId || action.recipe?.which?.testId;
      const buttonText = label || action.text || action.recipe?.what?.text;
      
      let iframeLocator = null;
      
      // Strategy 1: By testId
      if (testId) {
        const locator = frameLocator.locator(`[data-testid="${testId}"]`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found click target in iframe by testId: ${testId}`);
        }
      }
      
      // Strategy 2: By button text
      if (!iframeLocator && buttonText) {
        const locator = frameLocator.getByRole('button', { name: buttonText });
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found click target in iframe by button text: ${buttonText}`);
        }
      }
      
      // Strategy 3: By text content
      if (!iframeLocator && buttonText) {
        const locator = frameLocator.getByText(buttonText, { exact: false });
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found click target in iframe by text: ${buttonText}`);
        }
      }
      
      if (iframeLocator) {
        return { locator: iframeLocator, strategy: { type: `iframe[${i}]` } };
      }
    } catch (e) {
      console.log(`[ActionHandler] Iframe ${i} access failed:`, e.message);
    }
  }
  
  return null;
}

/**
 * Helper: Verify input field contains expected value
 * Returns true if value matches (or is close enough)
 */
async function verifyInputValue(locator, expectedValue, ctx) {
  try {
    await ctx.page.waitForTimeout(100); // Allow value to settle
    
    // Try inputValue() for standard inputs
    let actualValue = await locator.inputValue().catch(() => null);
    
    // Fallback to textContent for contenteditable
    if (actualValue === null) {
      actualValue = await locator.textContent().catch(() => '');
    }
    
    // Fallback to evaluate
    if (actualValue === null) {
      actualValue = await locator.evaluate(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value;
        return el.textContent || el.innerText || '';
      }).catch(() => '');
    }
    
    const normalizedActual = (actualValue || '').trim();
    const normalizedExpected = (expectedValue || '').trim();
    
    // Check for match
    if (normalizedActual === normalizedExpected) {
      return { verified: true, actual: normalizedActual };
    }
    
    // Check if actual contains expected (for cases where page adds formatting)
    if (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual)) {
      return { verified: true, actual: normalizedActual, partial: true };
    }
    
    return { verified: false, actual: normalizedActual, expected: normalizedExpected };
  } catch (e) {
    console.log(`[verifyInputValue] Error: ${e.message}`);
    return { verified: false, error: e.message };
  }
}

/**
 * Handle fill/type actions with iframe fallback
 * Supports: input, textarea, contenteditable, and rich text editors
 * CRITICAL: Now includes verification that value was actually set
 */
async function handleFill(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const value = action.value;
  const label = getActionLabel(action);
  
  // ============================================================
  // LOCKED SELECTOR FAST PATH - Try locked selector first (instant 150ms)
  // handleFill was previously skipping findElementWithRetry entirely,
  // so locked selectors from "Lock Locators" were never used for fill steps.
  // ============================================================
  if (ctx.findElementWithRetry && action.selectorObj?.optimizedSelector) {
    console.log(`[ActionHandler] ⚡ Fill: Trying LOCKED selector fast path for "${label}"`);
    try {
      const lockedResult = await ctx.findElementWithRetry(action);
      if (lockedResult) {
        const locator = lockedResult.locator;
        
        // Check if element is contenteditable
        const isContentEditable = await locator.evaluate(el => {
          return el.isContentEditable || el.getAttribute('contenteditable') === 'true';
        }).catch(() => false);
        
        if (isContentEditable) {
          await locator.click({ timeout: 3000 });
          await ctx.page.waitForTimeout(100);
          await locator.evaluate(el => { el.innerHTML = ''; el.textContent = ''; }).catch(() => {});
          await ctx.page.keyboard.type(value || '', { delay: 10 });
          const verify = await verifyInputValue(locator, value, ctx);
          console.log(`[ActionHandler] ⚡ LOCKED fill (contenteditable) ${verify.verified ? 'VERIFIED' : 'unverified'} for "${label}"`);
          return { success: true, strategy: 'LockedSelector-contenteditable' };
        }
        
        // Standard input/textarea fill
        await locator.clear().catch(() => {});
        await locator.fill(value || '', { timeout });
        
        const verify = await verifyInputValue(locator, value, ctx);
        if (verify.verified) {
          console.log(`[ActionHandler] ⚡ LOCKED fill VERIFIED for "${label}": "${verify.actual}"`);
          return { success: true, strategy: 'LockedSelector-verified' };
        } else {
          console.log(`[ActionHandler] ⚡ LOCKED fill value mismatch: expected "${value}", got "${verify.actual}" - continuing to SmartFinder`);
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Locked selector fill failed: ${e.message}, falling through to SmartFinder`);
    }
  }
  
  // Try SmartFinder first (best for modern frameworks)
  if (ctx.useSmartFinderForPlayback && ctx.smartFinder && action.recipe) {
    try {
      console.log(`[ActionHandler] Trying SmartFinder for fill: "${label}"`);
      // SmartFinder.find() returns a locator directly (not an object with locator property)
      const smartLocator = await ctx.smartFinder.find(action.recipe);
      if (smartLocator) {
        // Check if element is contenteditable (rich text editor)
        const elementType = await smartLocator.evaluate(el => {
          if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return 'contenteditable';
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return 'input';
          // Check for common rich text editor containers
          if (el.classList.contains('ql-editor') || // Quill
              el.classList.contains('ProseMirror') || // ProseMirror
              el.classList.contains('tox-edit-area') || // TinyMCE
              el.classList.contains('ck-editor__editable') || // CKEditor
              el.closest('.ql-container, .ProseMirror, .tox-tinymce, .ck-editor')) {
            return 'richtext';
          }
          return 'unknown';
        }).catch(() => 'unknown');
        
        if (elementType === 'contenteditable' || elementType === 'richtext') {
          // Handle contenteditable/rich text editors
          await smartLocator.click({ timeout: 3000 }); // Focus the editor
          await ctx.page.waitForTimeout(100);
          
          // Clear existing content
          await smartLocator.evaluate(el => {
            el.innerHTML = '';
            el.textContent = '';
          }).catch(() => {});
          
          // Type the value (for better compatibility with editors)
          await ctx.page.keyboard.type(value || '', { delay: 10 });
          
          // VERIFY contenteditable value
          const verify = await verifyInputValue(smartLocator, value, ctx);
          if (verify.verified) {
            console.log(`[ActionHandler] ✓ SmartFinder contenteditable fill VERIFIED for "${label}"`);
            if (ctx._lastWorkingSelector !== undefined) {
              ctx._lastWorkingSelector = ctx.smartFinder?.lastSuccessfulSelector ?? null;
              ctx._lastStrategyType = ctx.smartFinder?.lastSuccessfulStrategy ?? 'SmartFinder';
            }
            return { success: true, strategy: 'SmartFinder-contenteditable-verified' };
          } else {
            console.log(`[ActionHandler] ⚠️ SmartFinder contenteditable fill NOT verified: expected "${value}", got "${verify.actual}"`);
            // Still return success for contenteditable - verification is tricky with rich text
            if (ctx._lastWorkingSelector !== undefined) {
              ctx._lastWorkingSelector = ctx.smartFinder?.lastSuccessfulSelector ?? null;
              ctx._lastStrategyType = ctx.smartFinder?.lastSuccessfulStrategy ?? 'SmartFinder';
            }
            return { success: true, strategy: 'SmartFinder-contenteditable', warning: 'Value verification uncertain' };
          }
        }
        
        // Standard input/textarea fill
        await smartLocator.clear().catch(() => {});
        await smartLocator.fill(value || '', { timeout });
        
        // VERIFY input value
        const verify = await verifyInputValue(smartLocator, value, ctx);
        if (verify.verified) {
          console.log(`[ActionHandler] ✓ SmartFinder fill VERIFIED for "${label}": "${verify.actual}"`);
          const sfSel = ctx.smartFinder?.lastSuccessfulSelector;
          if (sfSel != null) {
            ctx._lastWorkingSelector = sfSel;
            ctx._lastStrategyType = ctx.smartFinder?.lastSuccessfulStrategy ?? 'SmartFinder';
          }
          return { success: true, strategy: 'SmartFinder-verified' };
        } else {
          console.log(`[ActionHandler] ⚠️ SmartFinder fill NOT verified: expected "${value}", got "${verify.actual}"`);
          return { success: false, error: `Fill verification failed: expected "${value}", got "${verify.actual}"` };
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] SmartFinder fill failed: ${e.message}`);
    }
  }
  
  // Try legacy element finder
  const fillResult = await ctx._findElement(action);
  if (fillResult) {
    // Set for Lock Locators: legacy path doesn't go through findElementWithRetry
    const selectorUsed = fillResult.strategy?.value;
    if (selectorUsed && typeof selectorUsed === 'string') {
      ctx._lastWorkingSelector = selectorUsed;
      ctx._lastStrategyType = fillResult.strategy?.type || 'legacy';
    }
    // Check for contenteditable on legacy result too
    const isContentEditable = await fillResult.locator.evaluate(el => {
      return el.isContentEditable || el.getAttribute('contenteditable') === 'true';
    }).catch(() => false);
    
    if (isContentEditable) {
      await fillResult.locator.click({ timeout: 3000 });
      await ctx.page.waitForTimeout(100);
      await fillResult.locator.evaluate(el => { el.innerHTML = ''; el.textContent = ''; }).catch(() => {});
      await ctx.page.keyboard.type(value || '', { delay: 10 });
      console.log(`[ActionHandler] ✓ Legacy contenteditable fill succeeded for "${label}"`);
      return { success: true, strategy: 'legacy-contenteditable' };
    }
    
    await fillResult.locator.clear().catch(() => {});
    await fillResult.locator.fill(value || '', { timeout });
    
    // VERIFY input value
    const verify = await verifyInputValue(fillResult.locator, value, ctx);
    if (verify.verified) {
      console.log(`[ActionHandler] ✓ Legacy fill VERIFIED for "${label}": "${verify.actual}"`);
      return { success: true, strategy: `${fillResult.strategy.type}-verified` };
    } else {
      console.log(`[ActionHandler] ⚠️ Legacy fill NOT verified: expected "${value}", got "${verify.actual}"`);
      return { success: false, error: `Fill verification failed: expected "${value}", got "${verify.actual}"` };
    }
  }
  
  // SALESFORCE APP LAUNCHER FALLBACK - Handle App Launcher search specifically
  // The App Launcher modal has its own search input that may not be found by standard strategies
  try {
    const appLauncherSelectors = [
      'one-app-launcher-modal input[type="search"]',
      'one-app-launcher-modal input[placeholder*="Search"]',
      'one-app-launcher-modal input[role="combobox"]',
      '[class*="appLauncher"] input[type="search"]',
      '[class*="appLauncher"] input[placeholder*="Search"]',
      'lightning-modal input[type="search"]',
      'lightning-modal input[placeholder*="Search"]',
      // Generic modal search
      '[role="dialog"] input[type="search"]',
      '[role="dialog"] input[placeholder*="Search"]'
    ];
    
    for (const selector of appLauncherSelectors) {
      const appLauncherInput = ctx.page.locator(selector).first();
      const count = await appLauncherInput.count().catch(() => 0);
      if (count > 0) {
        await appLauncherInput.click({ timeout: 3000 });
        await ctx.page.waitForTimeout(100);
        await appLauncherInput.clear().catch(() => {});
        await appLauncherInput.fill(value || '', { timeout: 5000 });
        console.log(`[ActionHandler] ✓ Salesforce App Launcher fill succeeded with: ${selector}`);
        return { success: true, strategy: 'sf-app-launcher-search' };
      }
    }
  } catch (e) {
    console.log(`[ActionHandler] Salesforce App Launcher fill fallback failed:`, e.message);
  }
  
  // IFRAME FALLBACK - Search inside iframes
  console.log(`[ActionHandler] Fill: Element not on main page, checking iframes...`);
  const iframeFillResult = await searchIframesForFill(ctx, action, value, label, timeout);
  if (iframeFillResult.success) {
    return iframeFillResult;
  }
  
  // CONTENTEDITABLE FALLBACK - Try finding any focused contenteditable
  try {
    const activeContentEditable = ctx.page.locator('[contenteditable="true"]:focus, .ql-editor:focus, .ProseMirror:focus');
    if (await activeContentEditable.count() > 0) {
      const editor = activeContentEditable.first();
      await editor.evaluate(el => { el.innerHTML = ''; el.textContent = ''; }).catch(() => {});
      await ctx.page.keyboard.type(value || '', { delay: 10 });
      console.log(`[ActionHandler] ✓ Focused contenteditable fill succeeded`);
      return { success: true, strategy: 'focused-contenteditable' };
    }
  } catch (e) {
    console.log(`[ActionHandler] Focused contenteditable check failed:`, e.message);
  }
  
  // AI FALLBACK
  if (ctx.enableAIFallback) {
    console.log(`[ActionHandler] All fill strategies failed, trying AI fallback...`);
    const aiResult = await ctx.findElementWithAI(label || selector || action.description, 'fill');
    if (aiResult) {
      try {
        await ctx.page.mouse.click(aiResult.x, aiResult.y);
        await ctx.page.keyboard.type(value || '');
        console.log(`[ActionHandler] ✓ AI Fallback fill succeeded`);
        return { success: true, strategy: 'AI Vision Fallback' };
      } catch (e) {
        console.log(`[ActionHandler] AI Fallback fill failed:`, e.message);
      }
    }
  }
  
  return { success: false, error: `Could not find element to fill: "${label || selector}"` };
}

/**
 * Search iframes for fill target
 */
async function searchIframesForFill(ctx, action, value, label, timeout) {
  const iframes = await ctx.page.locator('iframe').all();
  console.log(`[ActionHandler] Found ${iframes.length} iframes for fill search`);
  
  for (let i = 0; i < iframes.length; i++) {
    try {
      const frameLocator = ctx.page.frameLocator(`iframe >> nth=${i}`);
      
      // Get potential identifiers
      const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId || action.recipe?.which?.testId;
      const inputId = action.selectorObj?.id || action.recipe?.which?.id;
      const placeholder = action.selectorObj?.placeholder || action.recipe?.what?.placeholder;
      const inputName = action.selectorObj?.name || action.recipe?.which?.name;
      
      let iframeLocator = null;
      
      // Strategy 1: By testId
      if (testId) {
        const locator = frameLocator.locator(`[data-testid="${testId}"]`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found fill target in iframe by testId: ${testId}`);
        }
      }
      
      // Strategy 2: By id
      if (!iframeLocator && inputId) {
        const locator = frameLocator.locator(`#${inputId}`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found fill target in iframe by id: ${inputId}`);
        }
      }
      
      // Strategy 3: By placeholder
      if (!iframeLocator && placeholder) {
        const locator = frameLocator.locator(`[placeholder="${placeholder}"]`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found fill target in iframe by placeholder: ${placeholder}`);
        }
      }
      
      // Strategy 4: By name
      if (!iframeLocator && inputName) {
        const locator = frameLocator.locator(`[name="${inputName}"]`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found fill target in iframe by name: ${inputName}`);
        }
      }
      
      // Strategy 5: By partial placeholder match from label
      if (!iframeLocator && label) {
        const searchText = label.replace(/^fill\s*/i, '').replace(/["']/g, '').trim();
        const locator = frameLocator.locator(`[placeholder*="${searchText}" i]`);
        if (await locator.count() > 0) {
          iframeLocator = locator.first();
          console.log(`[ActionHandler] ✓ Found fill target in iframe by partial placeholder: ${searchText}`);
        }
      }
      
      if (iframeLocator) {
        await iframeLocator.clear().catch(() => {});
        await iframeLocator.fill(value || '', { timeout });
        console.log(`[ActionHandler] ✓ Iframe fill succeeded in iframe ${i}`);
        return { success: true, strategy: `iframe[${i}]` };
      }
    } catch (e) {
      console.log(`[ActionHandler] Iframe ${i} fill search failed:`, e.message);
    }
  }
  
  return { success: false };
}

/**
 * Handle select/dropdown actions (including Radix UI support)
 * IMPROVED: Better native select handling and verification
 */
async function handleSelect(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const value = action.value;
  const label = getActionLabel(action);
  
  console.log(`[ActionHandler] Select action: label="${label?.substring(0, 50)}" -> value="${value}"`);
  
  // Strategy 1: Try native <select> by selector
  if (selector) {
    try {
      const nativeSelect = ctx.page.locator(`select${selector}, ${selector}`).first();
      const isSelect = await nativeSelect.evaluate(el => el.tagName === 'SELECT').catch(() => false);
      if (isSelect) {
        // Try to select by label text first (more reliable), then by value
        try {
          await nativeSelect.selectOption({ label: value }, { timeout: 5000 });
        } catch (e1) {
          try {
            await nativeSelect.selectOption(value, { timeout: 5000 });
          } catch (e2) {
            // Try partial match
            await nativeSelect.selectOption({ label: new RegExp(value, 'i') }, { timeout: 5000 });
          }
        }
        
        // Verify selection
        const selectedText = await nativeSelect.evaluate(el => el.options[el.selectedIndex]?.text || '').catch(() => '');
        if (selectedText.toLowerCase().includes(value.toLowerCase())) {
          console.log(`[ActionHandler] ✓ Native select succeeded, selected: "${selectedText}"`);
          return { success: true, strategy: 'native-select-verified' };
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Native select by selector failed: ${e.message}`);
    }
  }
  
  // Strategy 2: Find ALL native selects and try each
  try {
    const allSelects = ctx.page.locator('select');
    const selectCount = await allSelects.count();
    console.log(`[ActionHandler] Found ${selectCount} native select elements`);
    
    for (let i = 0; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      const isVisible = await sel.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      // Check if this select has an option matching our value
      const hasOption = await sel.evaluate((el, val) => {
        for (const opt of el.options) {
          if (opt.text.toLowerCase().includes(val.toLowerCase()) || 
              opt.value.toLowerCase().includes(val.toLowerCase())) {
            return true;
          }
        }
        return false;
      }, value).catch(() => false);
      
      if (hasOption) {
        console.log(`[ActionHandler] Found select with matching option at index ${i}`);
        try {
          // Try by label first
          await sel.selectOption({ label: value }, { timeout: 3000 }).catch(() => {});
          
          // Verify
          const selectedText = await sel.evaluate(el => el.options[el.selectedIndex]?.text || '').catch(() => '');
          if (selectedText.toLowerCase().includes(value.toLowerCase())) {
            console.log(`[ActionHandler] ✓ Native select scan succeeded, selected: "${selectedText}"`);
            return { success: true, strategy: 'native-select-scan-verified' };
          }
          
          // Try by partial match
          await sel.selectOption({ label: new RegExp(value, 'i') }, { timeout: 3000 }).catch(() => {});
          
          const selectedText2 = await sel.evaluate(el => el.options[el.selectedIndex]?.text || '').catch(() => '');
          if (selectedText2.toLowerCase().includes(value.toLowerCase())) {
            console.log(`[ActionHandler] ✓ Native select regex succeeded, selected: "${selectedText2}"`);
            return { success: true, strategy: 'native-select-regex-verified' };
          }
        } catch (e) {
          console.log(`[ActionHandler] Select attempt ${i} failed: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`[ActionHandler] Native select scan failed: ${e.message}`);
  }
  
  // Strategy 3: For Radix/custom dropdowns - multi-strategy approach
  const selectResult = await handleRadixSelect(ctx, action, value, label, timeout);
  if (selectResult.success) {
    return selectResult;
  }
  
  return { success: false, error: `Could not select "${value}" from dropdown "${label?.substring(0, 50)}"` };
}

/**
 * Helper: Verify dropdown selection was made
 * Checks the trigger element's text content for the selected value
 */
async function verifyDropdownSelection(ctx, triggerLocator, expectedValue) {
  try {
    await ctx.page.waitForTimeout(300); // Wait for selection to settle
    
    // Check trigger text content (most custom dropdowns show selected value in trigger)
    const triggerText = await triggerLocator.textContent().catch(() => '');
    const normalizedTrigger = (triggerText || '').toLowerCase().trim();
    const normalizedExpected = (expectedValue || '').toLowerCase().trim();
    
    if (normalizedTrigger.includes(normalizedExpected)) {
      return { verified: true, displayedValue: triggerText.trim() };
    }
    
    // Check aria-label or value attribute
    const ariaLabel = await triggerLocator.getAttribute('aria-label').catch(() => '');
    if (ariaLabel && ariaLabel.toLowerCase().includes(normalizedExpected)) {
      return { verified: true, displayedValue: ariaLabel };
    }
    
    // Check data-value attribute
    const dataValue = await triggerLocator.getAttribute('data-value').catch(() => '');
    if (dataValue && dataValue.toLowerCase().includes(normalizedExpected)) {
      return { verified: true, displayedValue: dataValue };
    }
    
    return { verified: false, displayedValue: triggerText.trim(), expected: expectedValue };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

/**
 * Handle Radix UI dropdown selection
 * CRITICAL: Now includes verification that selection was made
 */
async function handleRadixSelect(ctx, action, value, label, timeout) {
  let lastTriggerLocator = null;
  
  // Strategy 1: Try SmartFinder findCombobox
  if (ctx.useSmartFinderForPlayback && ctx.smartFinder) {
    try {
      const comboResult = await ctx.smartFinder.findCombobox(label);
      if (comboResult) {
        lastTriggerLocator = comboResult.locator;
        await comboResult.locator.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(300);
        
        // Find and click option
        const option = await findDropdownOption(ctx, value);
        if (option) {
          await option.click({ timeout: 5000 });
          
          // VERIFY selection
          const verify = await verifyDropdownSelection(ctx, comboResult.locator, value);
          if (verify.verified) {
            console.log(`[ActionHandler] ✓ SmartFinder combobox select VERIFIED: "${verify.displayedValue}"`);
            return { success: true, strategy: 'SmartFinder-combobox-verified' };
          } else {
            console.log(`[ActionHandler] ⚠️ SmartFinder combobox select NOT verified: expected "${value}", trigger shows "${verify.displayedValue}"`);
            // Option was clicked, so likely succeeded even if verification failed
            return { success: true, strategy: 'SmartFinder-combobox', warning: 'Verification uncertain' };
          }
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] SmartFinder combobox failed: ${e.message}`);
    }
  }
  
  // Strategy 2: By testId
  const testId = action.selectorObj?.testId || action.recipe?.which?.testId;
  if (testId) {
    try {
      const trigger = ctx.page.locator(`[data-testid="${testId}"]`).first();
      lastTriggerLocator = trigger;
      if (await trigger.isVisible({ timeout: 3000 })) {
        await trigger.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(300);
        
        const option = await findDropdownOption(ctx, value);
        if (option) {
          await option.click({ timeout: 5000 });
          
          // VERIFY selection
          const verify = await verifyDropdownSelection(ctx, trigger, value);
          if (verify.verified) {
            console.log(`[ActionHandler] ✓ TestId select VERIFIED: "${verify.displayedValue}"`);
            return { success: true, strategy: 'testId-verified' };
          } else {
            console.log(`[ActionHandler] ⚠️ TestId select NOT verified: trigger shows "${verify.displayedValue}"`);
            return { success: true, strategy: 'testId', warning: 'Verification uncertain' };
          }
        }
      }
    } catch (e) {}
  }
  
  // Strategy 3: Scan all comboboxes
  try {
    const comboboxes = ctx.page.locator('[role="combobox"], [data-radix-select-trigger]');
    const count = await comboboxes.count();
    
    for (let i = 0; i < count; i++) {
      const trigger = comboboxes.nth(i);
      const isVisible = await trigger.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      lastTriggerLocator = trigger;
      
      // Check if already open
      const isOpen = await trigger.getAttribute('data-state').catch(() => null);
      if (isOpen !== 'open') {
        await trigger.click({ timeout: 3000 }).catch(() => {});
        await ctx.page.waitForTimeout(300);
      }
      
      // Look for option
      const option = await findDropdownOption(ctx, value);
      if (option) {
        await option.click({ timeout: 5000 });
        
        // VERIFY selection
        const verify = await verifyDropdownSelection(ctx, trigger, value);
        if (verify.verified) {
          console.log(`[ActionHandler] ✓ Combobox scan select VERIFIED: "${verify.displayedValue}"`);
          return { success: true, strategy: 'combobox-scan-verified' };
        } else {
          console.log(`[ActionHandler] ⚠️ Combobox scan select - option clicked but verification uncertain`);
          return { success: true, strategy: 'combobox-scan', warning: 'Verification uncertain' };
        }
      }
      
      // Close if we opened it
      if (isOpen !== 'open') {
        await ctx.page.keyboard.press('Escape').catch(() => {});
        await ctx.page.waitForTimeout(100);
      }
    }
  } catch (e) {}
  
  // Strategy 4: AI fallback for select
  if (ctx.enableAIFallback) {
    console.log(`[ActionHandler] Trying AI fallback for select...`);
    const triggerAI = await ctx.findElementWithAI(`dropdown trigger for ${label}`, 'click');
    if (triggerAI) {
      await ctx.clickAtCoordinates(triggerAI.x, triggerAI.y);
      await ctx.page.waitForTimeout(500);
      
      const optionAI = await ctx.findElementWithAI(`option "${value}" in dropdown`, 'click');
      if (optionAI) {
        await ctx.clickAtCoordinates(optionAI.x, optionAI.y);
        console.log(`[ActionHandler] ✓ AI fallback select succeeded`);
        // AI fallback is harder to verify - trust it
        return { success: true, strategy: 'AI-select' };
      }
    }
  }
  
  return { success: false };
}

/**
 * Find dropdown option by value
 */
async function findDropdownOption(ctx, value) {
  // Escape special characters for CSS selectors
  const escapedValue = value.replace(/"/g, '\\"');
  
  // Try various option selectors
  const optionSelectors = [
    `[role="option"]:has-text("${escapedValue}")`,
    `[role="menuitem"]:has-text("${escapedValue}")`,
    `[data-radix-select-item]:has-text("${escapedValue}")`,
    `[data-radix-collection-item]:has-text("${escapedValue}")`,
    `[data-state] >> text="${escapedValue}"`,
    `text="${escapedValue}"`,
    // Also try option tags (native select)
    `option:has-text("${escapedValue}")`,
    `option[value="${escapedValue}"]`,
  ];
  
  for (const sel of optionSelectors) {
    try {
      const option = ctx.page.locator(sel).first();
      if (await option.isVisible({ timeout: 500 })) {
        console.log(`[findDropdownOption] Found option with selector: ${sel}`);
        return option;
      }
    } catch (e) {}
  }
  
  // Fallback: Try to find by evaluating all visible options
  try {
    const allOptions = ctx.page.locator('[role="option"], [role="menuitem"], option, [data-radix-select-item]');
    const count = await allOptions.count();
    const searchValue = value.toLowerCase().trim();
    
    for (let i = 0; i < count; i++) {
      const opt = allOptions.nth(i);
      const isVisible = await opt.isVisible({ timeout: 200 }).catch(() => false);
      if (!isVisible) continue;
      
      const text = await opt.textContent().catch(() => '');
      const normalizedText = (text || '').toLowerCase().trim();
      
      // Check for exact match or starts-with match
      if (normalizedText === searchValue || normalizedText.startsWith(searchValue)) {
        console.log(`[findDropdownOption] Found option by text scan: "${text}"`);
        return opt;
      }
    }
  } catch (e) {
    console.log(`[findDropdownOption] Text scan failed: ${e.message}`);
  }
  
  return null;
}

/**
 * Handle double-click action
 */
async function handleDoubleClick(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const selector = action.selector;
  
  // Try finding element with automatic retry
  let dblClickResult = await ctx.findElementWithRetry(action);
  
  // Iframe fallback
  if (!dblClickResult) {
    console.log('[ActionHandler] DoubleClick: Element not on main page, checking iframes...');
    dblClickResult = await searchIframesForClick(ctx, action, label);
  }
  
  // AI fallback
  if (!dblClickResult && ctx.enableAIFallback) {
    const aiResult = await ctx.findElementWithAI(label || selector || action.description, 'dblclick');
    if (aiResult) {
      try {
        await ctx.page.mouse.dblclick(aiResult.x, aiResult.y);
        console.log(`[ActionHandler] ✓ AI Fallback double-click succeeded at (${aiResult.x}, ${aiResult.y})`);
        return { success: true, strategy: 'AI Vision Fallback' };
      } catch (e) {
        console.log(`[ActionHandler] AI Fallback double-click failed:`, e.message);
      }
    }
  }
  
  if (!dblClickResult) {
    return { success: false, error: `Could not find element to double-click: "${label || selector}"` };
  }
  
  await dblClickResult.locator.scrollIntoViewIfNeeded().catch(() => {});
  await dblClickResult.locator.dblclick({ timeout: 5000 });
  console.log(`[ActionHandler] ✓ Double-click succeeded using ${dblClickResult.strategy?.type || 'SmartFinder'}`);
  
  return { success: true, strategy: dblClickResult.strategy?.type || 'SmartFinder' };
}

/**
 * Handle right-click (context menu) action
 */
async function handleRightClick(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const selector = action.selector;
  
  // Try finding element with automatic retry
  let rightClickResult = await ctx.findElementWithRetry(action);
  
  // Iframe fallback
  if (!rightClickResult) {
    console.log('[ActionHandler] RightClick: Element not on main page, checking iframes...');
    rightClickResult = await searchIframesForClick(ctx, action, label);
  }
  
  // AI fallback
  if (!rightClickResult && ctx.enableAIFallback) {
    const aiResult = await ctx.findElementWithAI(label || selector || action.description, 'rightClick');
    if (aiResult) {
      try {
        await ctx.page.mouse.click(aiResult.x, aiResult.y, { button: 'right' });
        console.log(`[ActionHandler] ✓ AI Fallback right-click succeeded at (${aiResult.x}, ${aiResult.y})`);
        return { success: true, strategy: 'AI Vision Fallback' };
      } catch (e) {
        console.log(`[ActionHandler] AI Fallback right-click failed:`, e.message);
      }
    }
  }
  
  if (!rightClickResult) {
    return { success: false, error: `Could not find element to right-click: "${label || selector}"` };
  }
  
  await rightClickResult.locator.scrollIntoViewIfNeeded().catch(() => {});
  await rightClickResult.locator.click({ button: 'right', timeout: 5000 });
  console.log(`[ActionHandler] ✓ Right-click succeeded using ${rightClickResult.strategy?.type || 'SmartFinder'}`);
  
  // Wait briefly for context menu to appear
  await ctx.page.waitForTimeout(200);
  
  return { success: true, strategy: rightClickResult.strategy?.type || 'SmartFinder' };
}

/**
 * Handle hover action
 */
async function handleHover(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = getActionLabel(action);
  
  console.log(`[ActionHandler] Hover: "${label || selector}"`);
  
  // Try SmartFinder first (best for recipe-based elements)
  let hoverResult = await ctx.findElementWithRetry(action);
  
  // Fallback: Try direct selectors if SmartFinder fails
  if (!hoverResult && ctx.page) {
    const selectorObj = action.selectorObj || {};
    const hoverText = action.args?.[0] || selectorObj.text || label || '';
    
    const selectorsToTry = [];
    if (selectorObj.testId) selectorsToTry.push(`[data-testid="${selectorObj.testId}"]`);
    if (selectorObj.ariaLabel) selectorsToTry.push(`[aria-label="${selectorObj.ariaLabel}"]`);
    if (selectorObj.id) selectorsToTry.push(`#${selectorObj.id}`);
    if (selector) selectorsToTry.push(selector);
    if (hoverText) {
      selectorsToTry.push(`text="${hoverText}"`);
      selectorsToTry.push(`button:has-text("${hoverText}")`);
      selectorsToTry.push(`[role="button"]:has-text("${hoverText}")`);
    }
    
    for (const sel of selectorsToTry) {
      try {
        const locator = ctx.page.locator(sel);
        const count = await locator.count();
        if (count > 0) {
          hoverResult = { locator: locator.first(), strategy: { type: 'selector-fallback', value: sel } };
          // Capture for Lock Locators (was missing — hover fallbacks couldn't be locked)
          if (ctx._lastWorkingSelector !== undefined) {
            ctx._lastWorkingSelector = sel;
            ctx._lastStrategyType = 'selector-fallback';
          }
          console.log(`[ActionHandler] Hover: Found with fallback selector: ${sel}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  // AI Fallback as last resort
  if (!hoverResult && ctx.enableAIFallback && ctx.findElementWithAI) {
    const aiResult = await ctx.findElementWithAI(label || selector, 'hover');
    if (aiResult) {
      await ctx.page.mouse.move(aiResult.x, aiResult.y);
      console.log(`[ActionHandler] ✓ AI Fallback hover succeeded at (${aiResult.x}, ${aiResult.y})`);
      // Wait for menu to appear after hover
      await ctx.page.waitForTimeout(300);
      return { success: true, strategy: 'AI Vision Fallback' };
    }
  }
  
  if (!hoverResult) {
    return { success: false, error: `Could not find element to hover: "${label || selector}"` };
  }
  
  await hoverResult.locator.hover({ timeout });
  const hoverStrategy = hoverResult.strategy?.type || 'SmartFinder';
  console.log(`[ActionHandler] ✓ Hover succeeded using ${hoverStrategy}`);
  
  // Wait for flyout menus to appear after hover
  // OPTIMIZATION: Shorter wait when locked selector was used (reliable find, less variance)
  const hoverSettleTime = hoverStrategy === 'LockedSelector' ? 100 : 300;
  await ctx.page.waitForTimeout(hoverSettleTime);
  
  return { success: true, strategy: hoverStrategy };
}

/**
 * Handle press/keyboard action
 */
async function handlePress(ctx, action, options = {}) {
  const key = action.key || action.value || 'Enter';
  await ctx.page.keyboard.press(key);
  return { success: true };
}

/**
 * Handle wait action
 */
async function handleWait(ctx, action, options = {}) {
  const waitTime = parseInt(action.value || action.duration || '1000');
  await ctx.page.waitForTimeout(waitTime);
  return { success: true };
}

/**
 * Helper: Verify a checkbox is actually checked
 */
async function verifyCheckboxIsChecked(locator) {
  try {
    const isChecked = await locator.isChecked();
    return isChecked;
  } catch (e) {
    return false;
  }
}

/**
 * Helper: Find and check a checkbox, then VERIFY it's actually checked
 * Returns the checkbox locator if successful, null if failed
 */
async function findAndCheckWithVerification(ctx, checkboxLocator, description) {
  try {
    // First, check if it's already checked
    const wasAlreadyChecked = await checkboxLocator.isChecked().catch(() => false);
    if (wasAlreadyChecked) {
      console.log(`[ActionHandler] Checkbox already checked: ${description}`);
      return { success: true, locator: checkboxLocator };
    }
    
    // Try to check it
    await checkboxLocator.check({ timeout: 5000 });
    
    // Wait a moment for the state to update
    await ctx.page.waitForTimeout(100);
    
    // VERIFY it's actually checked now
    const isNowChecked = await checkboxLocator.isChecked().catch(() => false);
    if (isNowChecked) {
      console.log(`[ActionHandler] ✓ Checkbox verified as checked: ${description}`);
      return { success: true, locator: checkboxLocator };
    } else {
      console.log(`[ActionHandler] ⚠️ Checkbox NOT actually checked after check(): ${description}`);
      return { success: false };
    }
  } catch (e) {
    console.log(`[ActionHandler] Check attempt failed for ${description}: ${e.message}`);
    return { success: false };
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns 0-100 score where 100 is exact match
 */
function calculateStringSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check for exact containment
  if (s1 === s2) return 100;
  if (s2.startsWith(s1) && s1.length > s2.length * 0.8) return 95;
  if (s1.startsWith(s2) && s2.length > s1.length * 0.8) return 95;
  
  // Calculate Levenshtein distance
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Verify the label text of a checkbox matches what we expected
 * This is CRITICAL to prevent checking the wrong checkbox
 */
async function verifyCheckboxLabelMatches(ctx, checkboxLocator, expectedLabel) {
  try {
    // Get the actual label text associated with this checkbox
    let actualLabel = '';
    
    // Method 1: Check if checkbox is inside a label
    const parentLabel = checkboxLocator.locator('xpath=ancestor::label');
    if (await parentLabel.count() > 0) {
      actualLabel = await parentLabel.first().textContent().catch(() => '') || '';
    }
    
    // Method 2: Check for label with "for" attribute pointing to this checkbox
    if (!actualLabel) {
      const checkboxId = await checkboxLocator.getAttribute('id').catch(() => null);
      if (checkboxId) {
        const associatedLabel = ctx.page.locator(`label[for="${checkboxId}"]`);
        if (await associatedLabel.count() > 0) {
          actualLabel = await associatedLabel.first().textContent().catch(() => '') || '';
        }
      }
    }
    
    // Method 3: Check sibling text
    if (!actualLabel) {
      const parent = checkboxLocator.locator('xpath=..');
      actualLabel = await parent.textContent().catch(() => '') || '';
    }
    
    if (!actualLabel) {
      console.log(`[verifyCheckboxLabel] Could not find label for checkbox`);
      return { matches: false, actualLabel: '', reason: 'no-label-found' };
    }
    
    // Calculate similarity
    const similarity = calculateStringSimilarity(actualLabel, expectedLabel);
    console.log(`[verifyCheckboxLabel] Expected: "${expectedLabel.substring(0, 50)}"`);
    console.log(`[verifyCheckboxLabel] Actual:   "${actualLabel.substring(0, 50)}"`);
    console.log(`[verifyCheckboxLabel] Similarity: ${similarity}%`);
    
    // Require HIGH similarity (>= 85%) to consider it a match
    if (similarity >= 85) {
      return { matches: true, actualLabel, similarity };
    }
    
    return { matches: false, actualLabel, similarity, reason: `similarity ${similarity}% < 85%` };
  } catch (e) {
    console.log(`[verifyCheckboxLabel] Error: ${e.message}`);
    return { matches: false, reason: e.message };
  }
}

/**
 * Handle check/uncheck actions
 * CRITICAL: Uses STRICT matching AND verifies both:
 * 1. The checkbox is actually checked
 * 2. The checkbox's label matches what we expected to check
 */
async function handleCheck(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = getActionLabel(action);
  
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  console.log(`[ActionHandler] Check action: label="${label}"`);
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  
  // LOCKED SELECTOR FAST PATH
  if (ctx.findElementWithRetry && action.selectorObj?.optimizedSelector) {
    console.log(`[ActionHandler] ⚡ Check: Trying LOCKED selector fast path for "${label}"`);
    try {
      const lockedResult = await ctx.findElementWithRetry(action);
      if (lockedResult) {
        const verified = await findAndCheckWithVerification(ctx, lockedResult.locator, 'LockedSelector');
        if (verified.success) {
          console.log(`[ActionHandler] ⚡ LOCKED check VERIFIED for "${label}"`);
          return { success: true, strategy: 'LockedSelector-check-verified' };
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Locked selector check failed: ${e.message}, falling through`);
    }
  }
  
  // STRATEGY 1: EXACT label match using Playwright's getByLabel with exact: true
  if (label) {
    try {
      console.log(`[ActionHandler] Strategy 1: Trying EXACT getByLabel...`);
      const checkbox = ctx.page.getByLabel(label, { exact: true });
      if (await checkbox.count() > 0) {
        const verified = await findAndCheckWithVerification(ctx, checkbox, 'getByLabel-exact');
        if (verified.success) {
          // Secondary verification: confirm label text
          const labelVerify = await verifyCheckboxLabelMatches(ctx, checkbox, label);
          if (labelVerify.matches) {
            console.log(`[ActionHandler] ✓ EXACT match confirmed! Similarity: ${labelVerify.similarity}%`);
            return { success: true, strategy: 'getByLabel-exact-verified' };
          } else {
            console.log(`[ActionHandler] ⚠️ Checkbox checked but label mismatch: "${labelVerify.actualLabel}"`);
            // UNDO the check since it was the wrong one!
            await checkbox.uncheck().catch(() => {});
          }
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Exact getByLabel failed: ${e.message}`);
    }
  }
  
  // STRATEGY 2: Find ALL labels, score them, and pick ONLY high-similarity matches
  if (label) {
    console.log(`[ActionHandler] Strategy 2: Scanning all labels for high-similarity match...`);
    
    const allLabels = ctx.page.locator('label');
    const labelCount = await allLabels.count();
    console.log(`[ActionHandler] Found ${labelCount} labels on page`);
    
    // Collect ALL candidates with their similarity scores
    const candidates = [];
    
    for (let i = 0; i < labelCount; i++) {
      const lbl = allLabels.nth(i);
      const lblText = await lbl.textContent().catch(() => '');
      if (!lblText || lblText.trim().length === 0) continue;
      
      const similarity = calculateStringSimilarity(lblText, label);
      
      // Only consider if similarity is >= 80%
      if (similarity >= 80) {
        // Find the checkbox associated with this label
        let checkbox = null;
        
        // Method 1: Checkbox inside label
        const checkboxInside = lbl.locator('input[type="checkbox"]').first();
        if (await checkboxInside.count() > 0) {
          checkbox = checkboxInside;
        }
        
        // Method 2: Label has "for" attribute
        if (!checkbox) {
          const forId = await lbl.getAttribute('for').catch(() => null);
          if (forId) {
            const forCheckbox = ctx.page.locator(`#${forId}`);
            if (await forCheckbox.count() > 0) {
              const tagName = await forCheckbox.evaluate(el => el.tagName).catch(() => '');
              const inputType = await forCheckbox.getAttribute('type').catch(() => '');
              if (tagName === 'INPUT' && inputType === 'checkbox') {
                checkbox = forCheckbox;
              }
            }
          }
        }
        
        if (checkbox) {
          candidates.push({ label: lbl, checkbox, text: lblText, similarity });
          console.log(`[ActionHandler] Candidate: "${lblText.substring(0, 60)}" (${similarity}% similar)`);
        }
      }
    }
    
    // Sort by similarity (highest first)
    candidates.sort((a, b) => b.similarity - a.similarity);
    
    // Try the BEST match only (must be >= 85% similar)
    if (candidates.length > 0 && candidates[0].similarity >= 85) {
      const best = candidates[0];
      console.log(`[ActionHandler] Best match: "${best.text.substring(0, 60)}" (${best.similarity}%)`);
      
      // Check if there's another candidate that's too close in score (ambiguous)
      if (candidates.length > 1 && candidates[1].similarity >= 80) {
        const diff = best.similarity - candidates[1].similarity;
        if (diff < 10) {
          console.log(`[ActionHandler] ⚠️ AMBIGUOUS: Second candidate "${candidates[1].text.substring(0, 40)}" is ${candidates[1].similarity}% similar`);
          console.log(`[ActionHandler] Difference is only ${diff}% - too close to be confident`);
          // Continue only if first is significantly better
          if (diff < 5) {
            console.log(`[ActionHandler] ❌ Rejecting due to ambiguity`);
            return { success: false, error: `Ambiguous checkbox match: "${label}" could match multiple checkboxes` };
          }
        }
      }
      
      const verified = await findAndCheckWithVerification(ctx, best.checkbox, `label: ${best.text.substring(0, 30)}`);
      if (verified.success) {
        console.log(`[ActionHandler] ✓ Checkbox checked and verified! Label: "${best.text.substring(0, 50)}"`);
        return { success: true, strategy: `strict-label-match (${best.similarity}%)` };
      }
    } else if (candidates.length > 0) {
      console.log(`[ActionHandler] ❌ Best match (${candidates[0].similarity}%) below 85% threshold`);
    } else {
      console.log(`[ActionHandler] ❌ No candidates found with >= 80% similarity`);
    }
  }
  
  // STRATEGY 3: SmartFinder (only if label strategies failed)
  // SmartFinder can be less strict, so we add label verification
  const checkResult = await ctx._findElement(action);
  if (checkResult) {
    console.log(`[ActionHandler] Strategy 3: SmartFinder found element, verifying label...`);
    
    // First verify this is the RIGHT checkbox by checking the label
    const labelVerify = await verifyCheckboxLabelMatches(ctx, checkResult.locator, label);
    if (!labelVerify.matches) {
      console.log(`[ActionHandler] ❌ SmartFinder found wrong checkbox! Label: "${labelVerify.actualLabel}"`);
      console.log(`[ActionHandler] Expected: "${label}"`);
      // Don't use this result
    } else {
      const verified = await findAndCheckWithVerification(ctx, checkResult.locator, 'SmartFinder');
      if (verified.success) {
        console.log(`[ActionHandler] ✓ SmartFinder checkbox verified (${labelVerify.similarity}% match)`);
        return { success: true, strategy: 'SmartFinder-verified' };
      }
    }
  }
  
  return { success: false, error: `Could not find checkbox with label matching: "${label}"` };
}

/**
 * Helper: Find and uncheck a checkbox, then VERIFY it's actually unchecked
 */
async function findAndUncheckWithVerification(ctx, checkboxLocator, description) {
  try {
    // First, check if it's already unchecked
    const wasAlreadyUnchecked = !(await checkboxLocator.isChecked().catch(() => true));
    if (wasAlreadyUnchecked) {
      console.log(`[ActionHandler] Checkbox already unchecked: ${description}`);
      return { success: true, locator: checkboxLocator };
    }
    
    // Try to uncheck it
    await checkboxLocator.uncheck({ timeout: 5000 });
    
    // Wait a moment for the state to update
    await ctx.page.waitForTimeout(100);
    
    // VERIFY it's actually unchecked now
    const isNowUnchecked = !(await checkboxLocator.isChecked().catch(() => true));
    if (isNowUnchecked) {
      console.log(`[ActionHandler] ✓ Checkbox verified as unchecked: ${description}`);
      return { success: true, locator: checkboxLocator };
    } else {
      console.log(`[ActionHandler] ⚠️ Checkbox NOT actually unchecked after uncheck(): ${description}`);
      return { success: false };
    }
  } catch (e) {
    console.log(`[ActionHandler] Uncheck attempt failed for ${description}: ${e.message}`);
    return { success: false };
  }
}

async function handleUncheck(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = getActionLabel(action);
  
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  console.log(`[ActionHandler] Uncheck action: label="${label}"`);
  console.log(`[ActionHandler] ═══════════════════════════════════════`);
  
  // LOCKED SELECTOR FAST PATH
  if (ctx.findElementWithRetry && action.selectorObj?.optimizedSelector) {
    console.log(`[ActionHandler] ⚡ Uncheck: Trying LOCKED selector fast path for "${label}"`);
    try {
      const lockedResult = await ctx.findElementWithRetry(action);
      if (lockedResult) {
        const verified = await findAndUncheckWithVerification(ctx, lockedResult.locator, 'LockedSelector');
        if (verified.success) {
          console.log(`[ActionHandler] ⚡ LOCKED uncheck VERIFIED for "${label}"`);
          return { success: true, strategy: 'LockedSelector-uncheck-verified' };
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Locked selector uncheck failed: ${e.message}, falling through`);
    }
  }
  
  // STRATEGY 1: EXACT label match using Playwright's getByLabel with exact: true
  if (label) {
    try {
      console.log(`[ActionHandler] Strategy 1: Trying EXACT getByLabel for uncheck...`);
      const checkbox = ctx.page.getByLabel(label, { exact: true });
      if (await checkbox.count() > 0) {
        // Verify label before unchecking
        const labelVerify = await verifyCheckboxLabelMatches(ctx, checkbox, label);
        if (labelVerify.matches) {
          const verified = await findAndUncheckWithVerification(ctx, checkbox, 'getByLabel-exact');
          if (verified.success) {
            console.log(`[ActionHandler] ✓ EXACT uncheck confirmed! Similarity: ${labelVerify.similarity}%`);
            return { success: true, strategy: 'getByLabel-exact-verified' };
          }
        }
      }
    } catch (e) {
      console.log(`[ActionHandler] Exact getByLabel uncheck failed: ${e.message}`);
    }
  }
  
  // STRATEGY 2: Find ALL labels, score them, and pick ONLY high-similarity matches
  if (label) {
    console.log(`[ActionHandler] Strategy 2: Scanning all labels for high-similarity match...`);
    
    const allLabels = ctx.page.locator('label');
    const labelCount = await allLabels.count();
    
    const candidates = [];
    
    for (let i = 0; i < labelCount; i++) {
      const lbl = allLabels.nth(i);
      const lblText = await lbl.textContent().catch(() => '');
      if (!lblText || lblText.trim().length === 0) continue;
      
      const similarity = calculateStringSimilarity(lblText, label);
      
      if (similarity >= 80) {
        let checkbox = null;
        
        const checkboxInside = lbl.locator('input[type="checkbox"]').first();
        if (await checkboxInside.count() > 0) {
          checkbox = checkboxInside;
        }
        
        if (!checkbox) {
          const forId = await lbl.getAttribute('for').catch(() => null);
          if (forId) {
            const forCheckbox = ctx.page.locator(`#${forId}`);
            if (await forCheckbox.count() > 0) {
              const tagName = await forCheckbox.evaluate(el => el.tagName).catch(() => '');
              const inputType = await forCheckbox.getAttribute('type').catch(() => '');
              if (tagName === 'INPUT' && inputType === 'checkbox') {
                checkbox = forCheckbox;
              }
            }
          }
        }
        
        if (checkbox) {
          candidates.push({ label: lbl, checkbox, text: lblText, similarity });
          console.log(`[ActionHandler] Candidate: "${lblText.substring(0, 60)}" (${similarity}% similar)`);
        }
      }
    }
    
    candidates.sort((a, b) => b.similarity - a.similarity);
    
    if (candidates.length > 0 && candidates[0].similarity >= 85) {
      const best = candidates[0];
      console.log(`[ActionHandler] Best match for uncheck: "${best.text.substring(0, 60)}" (${best.similarity}%)`);
      
      const verified = await findAndUncheckWithVerification(ctx, best.checkbox, `label: ${best.text.substring(0, 30)}`);
      if (verified.success) {
        console.log(`[ActionHandler] ✓ Checkbox unchecked and verified! Label: "${best.text.substring(0, 50)}"`);
        return { success: true, strategy: `strict-label-match (${best.similarity}%)` };
      }
    }
  }
  
  // STRATEGY 3: SmartFinder with label verification
  const uncheckResult = await ctx._findElement(action);
  if (uncheckResult) {
    console.log(`[ActionHandler] Strategy 3: SmartFinder found element, verifying label...`);
    
    const labelVerify = await verifyCheckboxLabelMatches(ctx, uncheckResult.locator, label);
    if (!labelVerify.matches) {
      console.log(`[ActionHandler] ❌ SmartFinder found wrong checkbox! Label: "${labelVerify.actualLabel}"`);
    } else {
      const verified = await findAndUncheckWithVerification(ctx, uncheckResult.locator, 'SmartFinder');
      if (verified.success) {
        console.log(`[ActionHandler] ✓ SmartFinder uncheck verified (${labelVerify.similarity}% match)`);
        return { success: true, strategy: 'SmartFinder-verified' };
      }
    }
  }
  
  return { success: false, error: `Could not find checkbox with label matching: "${label}"` };
}

/**
 * Handle scroll action
 * Supports multiple scroll strategies:
 * 1. Scroll to element (if target provided)
 * 2. Scroll by delta (from recorded scroll)
 * 3. Scroll by direction and amount (legacy)
 */
async function handleScroll(ctx, action, options = {}) {
  const { timeout = 10000 } = options;
  const direction = action.direction || 'down';
  const scrollValue = action.value || {};
  
  // Strategy 1: If we have a target element, scroll to it
  if (action.recipe || action.target) {
    try {
      let targetLocator = null;
      
      if (ctx.smartFinder && action.recipe) {
        targetLocator = await ctx.smartFinder.find(action.recipe);
      } else if (ctx._findElement) {
        const result = await ctx._findElement(action);
        if (result) targetLocator = result.locator;
      }
      
      if (targetLocator) {
        await targetLocator.scrollIntoViewIfNeeded({ timeout: 5000 });
        console.log(`[ActionHandler] ✓ Scrolled to element`);
        return { success: true, strategy: 'scroll-to-element' };
      }
    } catch (e) {
      console.log(`[ActionHandler] Scroll to element failed, falling back to delta: ${e.message}`);
    }
  }
  
  // Strategy 2: Scroll by recorded delta
  if (scrollValue.deltaY !== undefined) {
    await ctx.page.evaluate(({ deltaY }) => {
      window.scrollBy(0, deltaY);
    }, { deltaY: scrollValue.deltaY });
    
    // Wait for lazy content to load
    await ctx.page.waitForTimeout(300);
    
    console.log(`[ActionHandler] ✓ Scrolled by delta: ${scrollValue.deltaY}px`);
    return { success: true, strategy: 'scroll-delta' };
  }
  
  // Strategy 3: Scroll to absolute position
  if (scrollValue.toY !== undefined) {
    await ctx.page.evaluate(({ toY }) => {
      window.scrollTo(0, toY);
    }, { toY: scrollValue.toY });
    
    await ctx.page.waitForTimeout(300);
    
    console.log(`[ActionHandler] ✓ Scrolled to Y: ${scrollValue.toY}`);
    return { success: true, strategy: 'scroll-absolute' };
  }
  
  // Strategy 4: Legacy direction-based scroll
  const amount = action.amount || 500; // Increased default for more visible scroll
  
  if (direction === 'down') {
    await ctx.page.mouse.wheel(0, amount);
  } else if (direction === 'up') {
    await ctx.page.mouse.wheel(0, -amount);
  } else if (direction === 'left') {
    await ctx.page.mouse.wheel(-amount, 0);
  } else if (direction === 'right') {
    await ctx.page.mouse.wheel(amount, 0);
  } else if (direction === 'bottom') {
    // Scroll to bottom of page
    await ctx.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  } else if (direction === 'top') {
    // Scroll to top of page
    await ctx.page.evaluate(() => window.scrollTo(0, 0));
  }
  
  // Wait for lazy content
  await ctx.page.waitForTimeout(300);
  
  console.log(`[ActionHandler] ✓ Scrolled ${direction} ${amount}px`);
  return { success: true, strategy: 'scroll-direction' };
}

/**
 * Handle file upload action
 * CRITICAL: Now includes verification that file was actually set
 */
async function handleUpload(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const filePath = action.filePath || action.value || action.args?.[0];
  
  if (!filePath) {
    return { success: false, error: 'No file path provided for upload' };
  }
  
  try {
    // Try to find file input
    let fileInput = null;
    
    if (selector) {
      fileInput = ctx.page.locator(selector).first();
    } else {
      fileInput = ctx.page.locator('input[type="file"]').first();
    }
    
    await fileInput.setInputFiles(filePath, { timeout });
    
    // VERIFY file was set
    await ctx.page.waitForTimeout(200);
    const fileValue = await fileInput.evaluate(el => el.files?.length > 0 ? el.files[0].name : '').catch(() => '');
    
    if (fileValue) {
      console.log(`[ActionHandler] ✓ File upload VERIFIED: ${fileValue}`);
      return { success: true, strategy: 'upload-verified', filename: fileValue };
    } else {
      // Check if there's visual feedback (file name displayed somewhere)
      const expectedFileName = filePath.split(/[/\\]/).pop();
      const fileNameVisible = await ctx.page.getByText(expectedFileName, { exact: false })
        .isVisible({ timeout: 2000 }).catch(() => false);
      
      if (fileNameVisible) {
        console.log(`[ActionHandler] ✓ File upload verified via UI: ${expectedFileName}`);
        return { success: true, strategy: 'upload-ui-verified', filename: expectedFileName };
      }
      
      console.log(`[ActionHandler] ⚠️ File upload completed but verification uncertain`);
      return { success: true, strategy: 'upload', warning: 'Verification uncertain' };
    }
  } catch (e) {
    return { success: false, error: `Upload failed: ${e.message}` };
  }
}

/**
 * Handle drag and drop action
 */
async function handleDrag(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const sourceSelector = action.sourceSelector || action.selector;
  const targetSelector = action.targetSelector || action.target;
  
  if (!sourceSelector || !targetSelector) {
    return { success: false, error: 'Drag requires sourceSelector and targetSelector' };
  }
  
  try {
    const source = ctx.page.locator(sourceSelector).first();
    const target = ctx.page.locator(targetSelector).first();
    
    await source.dragTo(target, { timeout });
    console.log(`[ActionHandler] ✓ Drag completed`);
    return { success: true };
  } catch (e) {
    return { success: false, error: `Drag failed: ${e.message}` };
  }
}

/**
 * Handle download action
 */
async function handleDownload(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const expectedFilename = action.filename || action.value;
  const triggerSelector = action.triggerSelector;
  
  // If there's a trigger selector, we expect a new download event
  if (triggerSelector) {
    try {
      const downloadPromise = ctx.page.waitForEvent('download', { timeout: timeout * 2 });
      await ctx.page.click(triggerSelector);
      const download = await downloadPromise;
      console.log(`[ActionHandler] Download completed: ${download.suggestedFilename()}`);
      
      if (expectedFilename && !download.suggestedFilename().includes(expectedFilename)) {
        return { success: false, error: `Expected filename containing "${expectedFilename}" but got "${download.suggestedFilename()}"` };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: `Download failed: ${e.message}` };
    }
  }
  
  // No trigger - download was already triggered by previous step
  try {
    const download = await ctx.page.waitForEvent('download', { timeout: 3000 });
    console.log(`[ActionHandler] Download completed: ${download.suggestedFilename()}`);
    
    if (expectedFilename && !download.suggestedFilename().includes(expectedFilename)) {
      return { success: false, error: `Expected filename containing "${expectedFilename}" but got "${download.suggestedFilename()}"` };
    }
  } catch (e) {
    // Download either already completed or was handled by previous click
    console.log(`[ActionHandler] Download likely already completed (previous click triggered it)`);
  }
  
  // Download steps pass by default
  return { success: true };
}

/**
 * Handle dialog/alert action
 */
async function handleDialog(ctx, action, options = {}) {
  // Dialogs are auto-handled by page.on('dialog') listener
  // This step just acknowledges the dialog was handled
  console.log(`[ActionHandler] Dialog action acknowledged: ${action.dialogType || 'alert'}`);
  return { success: true };
}

/**
 * Handle modal close action (DOM-based popups/modals)
 * Tries multiple strategies: close button, Escape key, backdrop click
 */
async function handleCloseModal(ctx, action, options = {}) {
  const { timeout = 10000 } = options;
  const modalTitle = action.label || action.text || action.modalTitle;
  
  console.log(`[ActionHandler] Closing modal: ${modalTitle || 'dialog'}`);
  
  // Strategy 1: Find and click close button (X, Close, Cancel)
  const closeButtonSelectors = [
    '[role="dialog"] button[aria-label*="close" i]',
    '[role="dialog"] button[aria-label*="dismiss" i]',
    '[role="alertdialog"] button[aria-label*="close" i]',
    '[data-radix-dialog-close]',
    '[role="dialog"] [data-dismiss="modal"]',
    '[role="dialog"] .close',
    '[role="dialog"] button:has(svg[class*="close"])',
    '[role="dialog"] button:has(svg[class*="x"])',
    '[aria-modal="true"] button[aria-label*="close" i]',
    '.modal button.close',
    '.modal [data-dismiss="modal"]',
    'dialog button[aria-label*="close" i]',
    // Common text-based close buttons
    '[role="dialog"] button:has-text("Close")',
    '[role="dialog"] button:has-text("Cancel")',
    '[role="dialog"] button:has-text("×")',
    '[role="dialog"] button:has-text("X")'
  ];
  
  for (const selector of closeButtonSelectors) {
    try {
      const closeBtn = ctx.page.locator(selector).first();
      if (await closeBtn.isVisible({ timeout: 1000 })) {
        await closeBtn.click({ timeout: 5000 });
        console.log(`[ActionHandler] ✓ Modal closed via button: ${selector}`);
        await ctx.page.waitForTimeout(300);
        return { success: true, strategy: 'close-button' };
      }
    } catch (e) {}
  }
  
  // Strategy 2: Press Escape key
  try {
    const modalVisible = await ctx.page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')
      .first().isVisible({ timeout: 1000 }).catch(() => false);
    
    if (modalVisible) {
      await ctx.page.keyboard.press('Escape');
      console.log(`[ActionHandler] ✓ Pressed Escape to close modal`);
      await ctx.page.waitForTimeout(300);
      
      // Verify modal closed
      const stillVisible = await ctx.page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')
        .first().isVisible({ timeout: 500 }).catch(() => false);
      
      if (!stillVisible) {
        return { success: true, strategy: 'escape-key' };
      }
    }
  } catch (e) {}
  
  // Strategy 3: Click backdrop/overlay
  const backdropSelectors = [
    '[data-radix-dialog-overlay]',
    '.modal-backdrop',
    '.slds-backdrop',
    '[class*="overlay"]',
    '[class*="backdrop"]'
  ];
  
  for (const selector of backdropSelectors) {
    try {
      const backdrop = ctx.page.locator(selector).first();
      if (await backdrop.isVisible({ timeout: 1000 })) {
        await backdrop.click({ position: { x: 10, y: 10 }, force: true });
        console.log(`[ActionHandler] ✓ Modal closed via backdrop click: ${selector}`);
        await ctx.page.waitForTimeout(300);
        return { success: true, strategy: 'backdrop-click' };
      }
    } catch (e) {}
  }
  
  // If no modal was found to close, consider it a success (modal already closed)
  const anyModalOpen = await ctx.page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal.show')
    .first().isVisible({ timeout: 500 }).catch(() => false);
  
  if (!anyModalOpen) {
    console.log(`[ActionHandler] No modal found - already closed`);
    return { success: true, strategy: 'already-closed' };
  }
  
  return { success: false, error: `Could not close modal: ${modalTitle}` };
}

/**
 * Handle assertion actions
 */
async function handleAssertText(ctx, action, options = {}) {
  const expected = action.expected || action.value;
  
  if (!expected) {
    return { success: false, error: 'No expected text for assertion' };
  }
  
  const hasText = await ctx.page.getByText(expected, { exact: false }).first()
    .isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!hasText) {
    return { success: false, error: `Text "${expected}" not visible on page` };
  }
  
  return { success: true };
}

async function handleAssertVisible(ctx, action, options = {}) {
  const selector = action.selector;
  const expected = action.expected || action.value;
  
  const visSelector = selector || (expected ? `text=${expected}` : null);
  if (!visSelector) {
    return { success: false, error: 'No selector or text for visibility assertion' };
  }
  
  const isVisible = await ctx.page.locator(visSelector).first()
    .isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!isVisible) {
    return { success: false, error: `Element not visible: ${visSelector}` };
  }
  
  return { success: true };
}

async function handleAssertValue(ctx, action, options = {}) {
  const selector = action.selector;
  const expected = action.expected || action.value;
  
  if (!selector) {
    return { success: false, error: 'No selector for value assertion' };
  }
  
  const actualValue = await ctx.page.locator(selector).first()
    .inputValue({ timeout: 5000 }).catch(() => '');
  
  if (actualValue !== expected) {
    return { success: false, error: `Expected value "${expected}" but got "${actualValue}"` };
  }
  
  return { success: true };
}

// ============================================================
// PWA TESTING HANDLERS
// Progressive Web App testing actions
// ============================================================

/**
 * Handle PWA Audit - comprehensive PWA check
 */
async function handlePWAAudit(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  try {
    const result = await pwa.runPWAAudit(ctx, {
      checkManifest: action.checkManifest !== false,
      checkServiceWorker: action.checkServiceWorker !== false,
      checkOffline: action.checkOffline !== false && ctx.cdpSession,
      checkCache: action.checkCache !== false,
      offlineExpectedElements: action.expectedElements || ['body'],
      offlineExpectedText: action.expectedText || [],
      expectedCachedUrls: action.expectedCachedUrls || []
    });
    
    return {
      success: result.passed,
      score: result.score,
      categories: result.categories,
      summary: result.summary
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle PWA Manifest validation
 */
async function handleCheckManifest(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  try {
    const result = await pwa.validateManifestFromPage(ctx.page);
    
    return {
      success: result.valid,
      manifestUrl: result.manifestUrl,
      score: result.score,
      issues: result.issues,
      warnings: result.warnings,
      manifest: result.manifest
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle Service Worker status check
 */
async function handleCheckServiceWorker(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  try {
    const result = await pwa.checkServiceWorkerStatus(ctx.page);
    
    return {
      success: result.registered,
      supported: result.supported,
      registered: result.registered,
      ready: result.ready,
      count: result.count,
      registrations: result.registrations
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle Wait for Service Worker
 */
async function handleWaitForServiceWorker(ctx, action, options = {}) {
  const pwa = getPWATesting();
  const targetState = action.state || action.targetState || 'activated';
  const { timeout = 30000 } = options;
  
  try {
    const result = await pwa.waitForServiceWorker(ctx.page, targetState, timeout);
    
    return {
      success: result.success,
      state: result.state,
      scope: result.scope
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle Test Offline mode
 */
async function handleTestOffline(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  if (!ctx.cdpSession) {
    return { success: false, error: 'CDP session required for offline testing' };
  }
  
  try {
    const result = await pwa.testOfflineMode(ctx, {
      expectedElements: action.expectedElements || ['body'],
      expectedText: action.expectedText || [],
      expectedUrls: action.expectedUrls || [],
      skipReload: action.skipReload || false,
      timeout: options.timeout
    });
    
    return {
      success: result.offlineCapable,
      offlineCapable: result.offlineCapable,
      elementChecks: result.elementChecks,
      textChecks: result.textChecks,
      urlChecks: result.urlChecks,
      errors: result.errors
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle Check Cache storage
 */
async function handleCheckCache(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  try {
    // Get cache info
    const cacheInfo = await pwa.getCacheInfo(ctx.page);
    
    // Verify critical resources if requested
    let resourceCheck = null;
    if (action.checkResources !== false) {
      resourceCheck = await pwa.verifyCriticalResources(ctx.page, {
        checkStyles: action.checkStyles !== false,
        checkScripts: action.checkScripts !== false,
        checkImages: action.checkImages || false,
        checkFonts: action.checkFonts || false
      });
    }
    
    // Verify specific URLs if provided
    let urlCheck = null;
    if (action.expectedUrls && action.expectedUrls.length > 0) {
      urlCheck = await pwa.verifyCachedUrls(ctx.page, action.expectedUrls);
    }
    
    const success = cacheInfo.supported && 
                   cacheInfo.cacheCount > 0 && 
                   (resourceCheck?.success !== false);
    
    return {
      success,
      cacheCount: cacheInfo.cacheCount,
      totalEntries: cacheInfo.totalEntries,
      cacheNames: cacheInfo.cacheNames,
      resourceCheck,
      urlCheck
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle Check Installability
 */
async function handleCheckInstallability(ctx, action, options = {}) {
  const pwa = getPWATesting();
  
  try {
    const result = await pwa.checkInstallability(ctx.page);
    
    return {
      success: result.installable,
      installable: result.installable,
      criteria: result.criteria,
      issues: result.issues,
      manifestValidation: result.manifestValidation
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// UNIFIED EXECUTION POINT
// This is THE SINGLE entry point for all action execution.
// Both PlaywrightRecorder and TestExecutor MUST use this.
// ============================================================

/**
 * Enrich successful result with workingSelector/strategyType from ctx for Lock Locators.
 * When handlers use findElementWithRetry or set ctx._lastWorkingSelector, this passes it through.
 */
function enrichResult(ctx, result, action) {
  if (!result || !result.success) return result;
  if (result.workingSelector != null && result.strategyType != null) return result;
  let ws = result.workingSelector ?? ctx._lastWorkingSelector ?? null;
  const st = result.strategyType ?? ctx._lastStrategyType ?? (typeof result.strategy === 'string' ? result.strategy : result.strategy?.type) ?? null;
  
  // FALLBACK: If SmartFinder found the element but didn't set a CSS selector,
  // construct one from the action's selectorObj data (id, name, testId, ariaLabel, text).
  // This ensures Lock Locators can lock ALL steps that pass, not just ones with CSS selectors.
  if (ws == null && action?.selectorObj) {
    const so = action.selectorObj;
    if (so.testId) {
      ws = `[data-testid="${so.testId}"]`;
    } else if (so.id) {
      ws = `#${so.id}`;
    } else if (so.ariaLabel) {
      ws = `[aria-label="${so.ariaLabel}"]`;
    } else if (so.name && so.tag) {
      ws = `${so.tag}[name="${so.name}"]`;
    } else if (so.role && so.text) {
      ws = `role=${so.role}[name="${so.text}"]`;
    } else if (so.text) {
      ws = `text="${so.text}"`;
    } else if (so.css) {
      ws = so.css;
    }
    if (ws) {
      console.log(`[enrichResult] Constructed fallback selector from selectorObj: ${ws}`);
    }
  }
  
  // LAST RESORT: Use the action label/description as a text= selector.
  // getActionLabel() pulls from action.label, action.text, selectorObj.text,
  // recipe.what.text, args[0], and description — the SAME label used to
  // successfully find and interact with the element.  If we got this far
  // without a selector, this text IS the best identifier we have.
  if (ws == null) {
    const actionLabel = getActionLabel(action);
    if (actionLabel && actionLabel.length > 1 && actionLabel.length < 80) {
      ws = `text="${actionLabel}"`;
      console.log(`[enrichResult] Using action label as text selector: ${ws}`);
    }
  }
  
  if (ws != null || st != null) {
    result.workingSelector = result.workingSelector ?? ws;
    result.strategyType = result.strategyType ?? st ?? 'selectorObj-fallback';
  }
  return result;
}

/**
 * Execute a single action - UNIFIED EXECUTION POINT
 * 
 * @param {Object} ctx - Execution context (PlaywrightRecorder or TestExecutor instance)
 *   Must provide: page, findElementWithRetry, enableAIFallback, findElementWithAI
 * @param {Object} action - The action to execute
 * @param {Object} options - Execution options (timeout, etc.)
 * @returns {Promise<{success: boolean, error?: string, strategy?: string, workingSelector?: string, strategyType?: string}>}
 */
async function executeAction(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  
  // Normalize action type to handle variations
  const actionType = normalizeActionType(action.type || action.qword || '');
  
  console.log(`[ActionHandlers] Executing: ${actionType}`, action.description || '');
  
  try {
    switch (actionType) {
      // Navigation
      case 'goto':
      case 'navigate':
        return await handleNavigation(ctx, action, { timeout });
        
      case 'navigateto':
      case 'salesforcenavigation':
        return await handleSalesforceNavigation(ctx, action, { timeout });
      
      // Click actions (findElementWithRetry sets ctx._lastWorkingSelector)
      case 'click':
      case 'clicktext':
      case 'clickelement':
        return enrichResult(ctx, await handleClick(ctx, action, { timeout }), action);
      
      // Double-click actions
      case 'dblclick':
      case 'doubleclick':
        return enrichResult(ctx, await handleDoubleClick(ctx, action, { timeout }), action);
      
      // Right-click (context menu) actions
      case 'rightclick':
      case 'contextmenu':
        return enrichResult(ctx, await handleRightClick(ctx, action, { timeout }), action);
      
      // Fill/Input actions (handleFill uses _findElement; we set ctx._lastWorkingSelector there)
      case 'fill':
      case 'type':
      case 'input':
        return enrichResult(ctx, await handleFill(ctx, action, { timeout }), action);
      
      // Select/Dropdown actions
      case 'select':
      case 'selectoption':
        return enrichResult(ctx, await handleSelect(ctx, action, { timeout }), action);
      
      // Hover action (critical for flyout menus)
      case 'hover':
        return enrichResult(ctx, await handleHover(ctx, action, { timeout }), action);
      
      // Keyboard actions
      case 'press':
      case 'keypress':
        return await handlePress(ctx, action, { timeout });
      
      // Wait actions
      case 'wait':
      case 'pause':
        return await handleWait(ctx, action, { timeout });
      
      // Checkbox/Radio actions
      case 'check':
        return await handleCheck(ctx, action, { timeout });
        
      case 'uncheck':
        return await handleUncheck(ctx, action, { timeout });
      
      // Scroll action
      case 'scroll':
        return await handleScroll(ctx, action, { timeout });
      
      // File upload
      case 'upload':
      case 'fileupload':
        return await handleUpload(ctx, action, { timeout });
      
      // Drag and drop
      case 'drag':
      case 'dragdrop':
        return await handleDrag(ctx, action, { timeout });
      
      // Download
      case 'download':
        return await handleDownload(ctx, action, { timeout });
      
      // Dialog handling
      case 'dialog':
      case 'handledialog':
        return await handleDialog(ctx, action, { timeout });
      
      // Modal close
      case 'closemodal':
      case 'dismissmodal':
        return await handleCloseModal(ctx, action, { timeout });
      
      // Assertions
      case 'asserttext':
      case 'assert':
        return await handleAssertText(ctx, action, { timeout });
        
      case 'assertvisible':
        return await handleAssertVisible(ctx, action, { timeout });
        
      case 'assertvalue':
        return await handleAssertValue(ctx, action, { timeout });
      
      // Tab switching (handled by caller with page array)
      case 'switchtab':
      case 'newtab':
      case 'closetab':
        // These require access to the pages array, delegate back to caller
        return { success: false, delegateToContext: true, actionType };
      
      // Screenshot (handled by caller for result storage)
      case 'screenshot':
        if (ctx.page) {
          const screenshot = await ctx.page.screenshot({ type: 'png' });
          return { success: true, screenshot };
        }
        return { success: false, error: 'No page available for screenshot' };
      
      // ========================================
      // PWA TESTING ACTIONS
      // ========================================
      
      // PWA Audit - comprehensive PWA check
      case 'pwaaudit':
      case 'validatepwa':
        return await handlePWAAudit(ctx, action, { timeout });
      
      // PWA Manifest validation
      case 'checkmanifest':
      case 'validatemanifest':
        return await handleCheckManifest(ctx, action, { timeout });
      
      // Service Worker status check
      case 'checkserviceworker':
      case 'serviceworkerstatus':
        return await handleCheckServiceWorker(ctx, action, { timeout });
      
      // Wait for Service Worker
      case 'waitforserviceworker':
        return await handleWaitForServiceWorker(ctx, action, { timeout });
      
      // Test offline mode
      case 'testoffline':
      case 'offlinetest':
        return await handleTestOffline(ctx, action, { timeout });
      
      // Check cache storage
      case 'checkcache':
      case 'verifycache':
        return await handleCheckCache(ctx, action, { timeout });
      
      // Check installability
      case 'checkinstallability':
      case 'pwainstallable':
        return await handleCheckInstallability(ctx, action, { timeout });
      
      // ========================================
      // COMPREHENSIVE ELEMENT SUPPORT (NEW)
      // ========================================
      
      // Clear input field
      case 'clear':
      case 'clearfield':
        return enrichResult(ctx, await handleClear(ctx, action, { timeout }), action);
      
      // Focus/Blur
      case 'focus':
        return enrichResult(ctx, await handleFocus(ctx, action, { timeout }), action);
      case 'blur':
        return enrichResult(ctx, await handleBlur(ctx, action, { timeout }), action);
      
      // Toggle switch
      case 'toggle':
      case 'toggleswitch':
        return await handleToggle(ctx, action, { timeout });
      
      // Slider/Range
      case 'slider':
      case 'setslider':
      case 'range':
        return await handleSlider(ctx, action, { timeout });
      
      // Accordion
      case 'expand':
      case 'collapse':
      case 'accordion':
        return await handleAccordion(ctx, action, { timeout });
      
      // Autocomplete/Typeahead
      case 'autocomplete':
      case 'typeahead':
      case 'selectsuggestion':
        return await handleAutocomplete(ctx, action, { timeout });
      
      // OTP/PIN input
      case 'otp':
      case 'otpinput':
      case 'pin':
        return await handleOTPInput(ctx, action, { timeout });
      
      // Quantity spinner (+/- buttons)
      case 'increment':
      case 'decrement':
      case 'setquantity':
        return await handleQuantitySpinner(ctx, action, { timeout });
      
      // Star rating
      case 'rate':
      case 'rating':
      case 'setrating':
        return await handleRating(ctx, action, { timeout });
      
      // Table operations
      case 'sortcolumn':
      case 'tablesort':
        return await handleTableSort(ctx, action, { timeout });
      case 'gotopage':
      case 'pagination':
        return await handlePagination(ctx, action, { timeout });
      
      // Cookie consent
      case 'acceptcookies':
      case 'dismissbanner':
      case 'cookieconsent':
        return await handleCookieConsent(ctx, action, { timeout });
      
      // Infinite scroll
      case 'loadmore':
      case 'scrolltoload':
      case 'infinitescroll':
        return await handleInfiniteScroll(ctx, action, { timeout });
      
      // Multi-select
      case 'multiselect':
      case 'selectmultiple':
        return await handleMultiSelect(ctx, action, { timeout });
      
      // Date picker
      case 'selectdate':
      case 'datepicker':
        return await handleDatePicker(ctx, action, { timeout });
      
      // Time picker  
      case 'selecttime':
      case 'timepicker':
        return await handleTimePicker(ctx, action, { timeout });
      
      // Calendar
      case 'selectcalendardate':
      case 'calendar':
        return await handleCalendar(ctx, action, { timeout });
      
      default:
        console.warn(`[ActionHandlers] Unknown action type: ${actionType}`);
        return { success: false, error: `Unknown action type: ${actionType}` };
    }
  } catch (error) {
    console.error(`[ActionHandlers] Action failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// COMPREHENSIVE ELEMENT HANDLERS (NEW)
// Handles: Sliders, Toggles, Accordions, Autocomplete, OTP, Ratings, Tables, etc.
// ============================================================================

/**
 * Clear an input field
 */
async function handleClear(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  
  try {
    const result = await ctx.findElementWithRetry(action);
    if (!result) {
      return { success: false, error: `Could not find element to clear: ${label}` };
    }
    
    await result.locator.clear({ timeout });
    return { success: true, strategy: result.strategy };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Focus an element
 */
async function handleFocus(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  
  try {
    const result = await ctx.findElementWithRetry(action);
    if (!result) {
      return { success: false, error: `Could not find element to focus: ${label}` };
    }
    
    await result.locator.focus({ timeout });
    return { success: true, strategy: result.strategy };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Blur (unfocus) an element
 */
async function handleBlur(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  
  try {
    const result = await ctx.findElementWithRetry(action);
    if (!result) {
      return { success: false, error: `Could not find element to blur: ${label}` };
    }
    
    await result.locator.blur({ timeout });
    return { success: true, strategy: result.strategy };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Toggle a switch element
 */
async function handleToggle(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const targetState = action.value === 'on' || action.value === true || action.value === 'true';
  
  console.log(`[ActionHandler] Toggle: "${label}" → ${targetState ? 'ON' : 'OFF'}`);
  
  try {
    // Try various toggle patterns
    const toggleSelectors = [
      `[role="switch"]:has-text("${label}")`,
      `button[role="switch"]:has-text("${label}")`,
      `label:has-text("${label}") [role="switch"]`,
      `label:has-text("${label}") input[type="checkbox"]`,
      `[aria-label*="${label}" i][role="switch"]`,
      `[data-testid*="toggle"]:has-text("${label}")`,
      `[class*="toggle"]:has-text("${label}")`,
      `[class*="switch"]:has-text("${label}")`,
    ];
    
    for (const selector of toggleSelectors) {
      try {
        const toggle = ctx.page.locator(selector).first();
        if (await toggle.count() > 0) {
          const isChecked = await toggle.isChecked().catch(() => {
            // For non-checkbox toggles, check aria-checked
            return toggle.getAttribute('aria-checked').then(v => v === 'true');
          });
          
          if ((targetState && !isChecked) || (!targetState && isChecked)) {
            await toggle.click({ timeout: 5000 });
          }
          
          return { success: true, strategy: `toggle: ${selector.substring(0, 40)}` };
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    // Fallback to SmartFinder
    const result = await ctx.findElementWithRetry(action);
    if (result) {
      await result.locator.click({ timeout });
      return { success: true, strategy: result.strategy };
    }
    
    return { success: false, error: `Could not find toggle: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Set slider/range value
 */
async function handleSlider(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const value = parseFloat(action.value) || 0;
  
  console.log(`[ActionHandler] Slider: "${label}" → ${value}`);
  
  try {
    // Try various slider patterns
    const sliderSelectors = [
      `[role="slider"][aria-label*="${label}" i]`,
      `input[type="range"][aria-label*="${label}" i]`,
      `label:has-text("${label}") input[type="range"]`,
      `label:has-text("${label}") ~ input[type="range"]`,
      `[data-testid*="slider"]:has-text("${label}")`,
      `[class*="slider"]:has-text("${label}") input`,
      `[class*="Slider"]:has-text("${label}") input`,
    ];
    
    for (const selector of sliderSelectors) {
      try {
        const slider = ctx.page.locator(selector).first();
        if (await slider.count() > 0) {
          // For input[type="range"], use fill
          const tagName = await slider.evaluate(el => el.tagName);
          if (tagName === 'INPUT') {
            await slider.fill(String(value), { timeout: 5000 });
          } else {
            // For custom sliders, try keyboard interaction
            await slider.focus();
            const currentValue = parseFloat(await slider.getAttribute('aria-valuenow') || '0');
            const min = parseFloat(await slider.getAttribute('aria-valuemin') || '0');
            const max = parseFloat(await slider.getAttribute('aria-valuemax') || '100');
            const step = parseFloat(await slider.getAttribute('aria-valuestep') || '1');
            
            const stepsNeeded = Math.round((value - currentValue) / step);
            const key = stepsNeeded > 0 ? 'ArrowRight' : 'ArrowLeft';
            
            for (let i = 0; i < Math.abs(stepsNeeded); i++) {
              await ctx.page.keyboard.press(key);
              await ctx.page.waitForTimeout(50);
            }
          }
          
          return { success: true, strategy: `slider: ${selector.substring(0, 40)}` };
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    return { success: false, error: `Could not find slider: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Expand/Collapse accordion
 */
async function handleAccordion(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const shouldExpand = action.type === 'expand' || action.value === 'expand';
  
  console.log(`[ActionHandler] Accordion: "${label}" → ${shouldExpand ? 'EXPAND' : 'COLLAPSE'}`);
  
  try {
    const accordionSelectors = [
      // Standard accordion patterns
      `[aria-expanded]:has-text("${label}")`,
      `button[aria-controls]:has-text("${label}")`,
      `[data-state]:has-text("${label}")`,
      // Details/Summary
      `summary:has-text("${label}")`,
      // Common class patterns
      `[class*="accordion"]:has-text("${label}") button`,
      `[class*="Accordion"]:has-text("${label}") button`,
      `[class*="collapse"]:has-text("${label}")`,
      `[class*="expand"]:has-text("${label}")`,
    ];
    
    for (const selector of accordionSelectors) {
      try {
        const trigger = ctx.page.locator(selector).first();
        if (await trigger.count() > 0) {
          const isExpanded = await trigger.getAttribute('aria-expanded') === 'true' ||
                            await trigger.getAttribute('data-state') === 'open';
          
          if ((shouldExpand && !isExpanded) || (!shouldExpand && isExpanded)) {
            await trigger.click({ timeout: 5000 });
          }
          
          return { success: true, strategy: `accordion: ${selector.substring(0, 40)}` };
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not find accordion: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Select from autocomplete/typeahead
 */
async function handleAutocomplete(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const searchText = action.searchText || action.value?.text || '';
  const selectText = action.selectText || action.value?.select || action.value || '';
  
  console.log(`[ActionHandler] Autocomplete: type "${searchText}" → select "${selectText}"`);
  
  try {
    // Find the input field
    const result = await ctx.findElementWithRetry({ ...action, type: 'fill' });
    if (!result) {
      return { success: false, error: `Could not find autocomplete input: ${label}` };
    }
    
    // Type to trigger suggestions
    await result.locator.fill(searchText, { timeout: 5000 });
    await ctx.page.waitForTimeout(500); // Wait for suggestions to appear
    
    // Select from suggestions
    const suggestionSelectors = [
      `[role="option"]:has-text("${selectText}")`,
      `[role="listbox"] [role="option"]:has-text("${selectText}")`,
      `[role="menu"] [role="menuitem"]:has-text("${selectText}")`,
      `li:has-text("${selectText}")`,
      `[class*="suggestion"]:has-text("${selectText}")`,
      `[class*="autocomplete"]:has-text("${selectText}")`,
      `[class*="dropdown"]:has-text("${selectText}")`,
      `[data-testid*="suggestion"]:has-text("${selectText}")`,
    ];
    
    for (const selector of suggestionSelectors) {
      try {
        const suggestion = ctx.page.locator(selector).first();
        if (await suggestion.count() > 0 && await suggestion.isVisible()) {
          await suggestion.click({ timeout: 5000 });
          return { success: true, strategy: `autocomplete: ${selector.substring(0, 40)}` };
        }
      } catch (e) {
        // Try next
      }
    }
    
    // Try pressing Enter if no visible option found
    await ctx.page.keyboard.press('Enter');
    return { success: true, strategy: 'autocomplete: Enter key' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Fill OTP/PIN input (multiple boxes)
 */
async function handleOTPInput(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const code = String(action.value || '');
  
  console.log(`[ActionHandler] OTP: entering ${code.length} digit code`);
  
  try {
    // Pattern 1: Multiple individual inputs
    const otpInputs = ctx.page.locator(
      'input[maxlength="1"], input[data-otp], input[class*="otp"], input[class*="pin"], ' +
      'input[autocomplete="one-time-code"], input[name*="otp"], input[name*="code"]'
    );
    const inputCount = await otpInputs.count();
    
    if (inputCount >= code.length) {
      for (let i = 0; i < code.length; i++) {
        await otpInputs.nth(i).fill(code[i], { timeout: 2000 });
      }
      return { success: true, strategy: 'otp: individual inputs' };
    }
    
    // Pattern 2: Single input with full code
    const singleInput = ctx.page.locator(
      'input[autocomplete="one-time-code"], input[name*="otp"], input[name*="verification"], ' +
      'input[data-testid*="otp"], input[data-testid*="code"]'
    ).first();
    
    if (await singleInput.count() > 0) {
      await singleInput.fill(code, { timeout: 5000 });
      return { success: true, strategy: 'otp: single input' };
    }
    
    return { success: false, error: 'Could not find OTP input fields' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle quantity spinner (+/- buttons)
 */
async function handleQuantitySpinner(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const actionType = action.type?.toLowerCase();
  const targetValue = parseInt(action.value) || 1;
  
  console.log(`[ActionHandler] Quantity: ${actionType} for "${label}"`);
  
  try {
    // Find the spinner container
    const containerSelectors = [
      `[class*="quantity"]:has-text("${label}")`,
      `[class*="Quantity"]:has-text("${label}")`,
      `[data-testid*="quantity"]:has-text("${label}")`,
      `[class*="stepper"]:has-text("${label}")`,
      `[class*="spinner"]:has-text("${label}")`,
    ];
    
    let container = null;
    for (const selector of containerSelectors) {
      const loc = ctx.page.locator(selector).first();
      if (await loc.count() > 0) {
        container = loc;
        break;
      }
    }
    
    if (!container) {
      // Try finding by nearby product context
      container = ctx.page.locator(`[class*="quantity"], [class*="Quantity"]`).first();
    }
    
    if (!container || await container.count() === 0) {
      return { success: false, error: `Could not find quantity spinner: ${label}` };
    }
    
    if (actionType === 'increment') {
      const plusBtn = container.locator('button:has-text("+"), button[aria-label*="increase" i], button[aria-label*="add" i]').first();
      if (await plusBtn.count() > 0) {
        await plusBtn.click({ timeout: 5000 });
        return { success: true, strategy: 'quantity: increment' };
      }
    } else if (actionType === 'decrement') {
      const minusBtn = container.locator('button:has-text("-"), button[aria-label*="decrease" i], button[aria-label*="remove" i]').first();
      if (await minusBtn.count() > 0) {
        await minusBtn.click({ timeout: 5000 });
        return { success: true, strategy: 'quantity: decrement' };
      }
    } else if (actionType === 'setquantity') {
      const input = container.locator('input[type="number"], input[type="text"]').first();
      if (await input.count() > 0) {
        await input.fill(String(targetValue), { timeout: 5000 });
        return { success: true, strategy: 'quantity: set value' };
      }
    }
    
    return { success: false, error: `Quantity action failed: ${actionType}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle star rating selection
 */
async function handleRating(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const rating = parseInt(action.value) || 5;
  
  console.log(`[ActionHandler] Rating: ${rating} stars for "${label}"`);
  
  try {
    const ratingSelectors = [
      `[class*="rating"]:has-text("${label}")`,
      `[class*="Rating"]:has-text("${label}")`,
      `[data-testid*="rating"]:has-text("${label}")`,
      `[role="radiogroup"]:has-text("${label}")`,
      `fieldset:has-text("${label}")`,
    ];
    
    for (const selector of ratingSelectors) {
      try {
        const container = ctx.page.locator(selector).first();
        if (await container.count() > 0) {
          // Try clicking the nth star
          const stars = container.locator('button, label, input[type="radio"], svg, [class*="star"]');
          const starCount = await stars.count();
          
          if (starCount >= rating) {
            await stars.nth(rating - 1).click({ timeout: 5000 });
            return { success: true, strategy: `rating: ${rating} stars` };
          }
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not find rating widget: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle table column sorting
 */
async function handleTableSort(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const columnName = getActionLabel(action) || action.column;
  const sortDirection = action.direction || action.value || 'asc';
  
  console.log(`[ActionHandler] Table sort: "${columnName}" → ${sortDirection}`);
  
  try {
    const headerSelectors = [
      `th:has-text("${columnName}")`,
      `[role="columnheader"]:has-text("${columnName}")`,
      `thead td:has-text("${columnName}")`,
      `[data-testid*="header"]:has-text("${columnName}")`,
      `[class*="header"]:has-text("${columnName}")`,
    ];
    
    for (const selector of headerSelectors) {
      try {
        const header = ctx.page.locator(selector).first();
        if (await header.count() > 0) {
          // Check current sort state
          const currentSort = await header.getAttribute('aria-sort') || 'none';
          
          // Click to toggle sort
          await header.click({ timeout: 5000 });
          
          // If need opposite direction, click again
          if ((sortDirection === 'desc' && currentSort === 'none') ||
              (sortDirection === 'asc' && currentSort === 'descending')) {
            await ctx.page.waitForTimeout(300);
            await header.click({ timeout: 5000 });
          }
          
          return { success: true, strategy: `table sort: ${columnName}` };
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not find table column: ${columnName}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle pagination
 */
async function handlePagination(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const targetPage = action.value || action.page || 'next';
  
  console.log(`[ActionHandler] Pagination: go to ${targetPage}`);
  
  try {
    const paginationSelectors = {
      next: [
        'button:has-text("Next")', '[aria-label*="next" i]', '[class*="next"]',
        'a:has-text("Next")', 'button:has-text(">")', '[data-testid*="next"]',
      ],
      prev: [
        'button:has-text("Prev")', '[aria-label*="prev" i]', '[class*="prev"]',
        'a:has-text("Prev")', 'button:has-text("<")', '[data-testid*="prev"]',
      ],
      first: [
        'button:has-text("First")', '[aria-label*="first" i]', 'button:has-text("<<")',
      ],
      last: [
        'button:has-text("Last")', '[aria-label*="last" i]', 'button:has-text(">>")',
      ],
    };
    
    // Handle numeric page
    if (!isNaN(parseInt(targetPage))) {
      const pageNum = parseInt(targetPage);
      const pageBtn = ctx.page.locator(
        `[class*="pagination"] button:has-text("${pageNum}"), ` +
        `[class*="pagination"] a:has-text("${pageNum}"), ` +
        `[role="navigation"] button:has-text("${pageNum}"), ` +
        `[data-testid*="page"]:has-text("${pageNum}")`
      ).first();
      
      if (await pageBtn.count() > 0) {
        await pageBtn.click({ timeout: 5000 });
        return { success: true, strategy: `pagination: page ${pageNum}` };
      }
    }
    
    // Handle named navigation
    const selectors = paginationSelectors[targetPage.toLowerCase()] || paginationSelectors.next;
    for (const selector of selectors) {
      try {
        const btn = ctx.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isEnabled()) {
          await btn.click({ timeout: 5000 });
          return { success: true, strategy: `pagination: ${targetPage}` };
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not navigate to page: ${targetPage}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle cookie consent banners
 */
async function handleCookieConsent(ctx, action, options = {}) {
  const { timeout = 10000 } = options;
  const actionType = action.value || 'accept';
  
  console.log(`[ActionHandler] Cookie consent: ${actionType}`);
  
  try {
    const acceptSelectors = [
      // Common accept buttons
      'button:has-text("Accept")', 'button:has-text("Accept All")',
      'button:has-text("Accept Cookies")', 'button:has-text("I Accept")',
      'button:has-text("Got it")', 'button:has-text("OK")',
      'button:has-text("Allow")', 'button:has-text("Agree")',
      // ID/class patterns
      '#accept-cookies', '#accept-all', '[id*="cookie"][id*="accept"]',
      '[class*="cookie"][class*="accept"]', '[data-testid*="cookie"][data-testid*="accept"]',
      // Aria patterns
      '[aria-label*="accept" i][aria-label*="cookie" i]',
      // OneTrust (very common)
      '#onetrust-accept-btn-handler', '.onetrust-accept-btn-handler',
      // Cookiebot
      '#CybotCookiebotDialogBodyButtonAccept',
      // GDPR frameworks
      '.cc-accept', '.cc-allow', '.gdpr-accept',
    ];
    
    const rejectSelectors = [
      'button:has-text("Reject")', 'button:has-text("Decline")',
      'button:has-text("No Thanks")', 'button:has-text("Reject All")',
      '#onetrust-reject-btn-handler', '#CybotCookiebotDialogBodyButtonDecline',
    ];
    
    const selectors = actionType === 'reject' ? rejectSelectors : acceptSelectors;
    
    for (const selector of selectors) {
      try {
        const btn = ctx.page.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click({ timeout: 5000 });
          return { success: true, strategy: `cookie consent: ${selector.substring(0, 40)}` };
        }
      } catch (e) {
        // Try next
      }
    }
    
    // If no banner found, that's OK - might already be dismissed
    console.log('[ActionHandler] No cookie banner found (may already be dismissed)');
    return { success: true, strategy: 'cookie consent: none found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle infinite scroll / load more
 */
async function handleInfiniteScroll(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const scrollCount = parseInt(action.value) || 3;
  
  console.log(`[ActionHandler] Infinite scroll: ${scrollCount} loads`);
  
  try {
    for (let i = 0; i < scrollCount; i++) {
      // Check for "Load More" button first
      const loadMoreBtn = ctx.page.locator(
        'button:has-text("Load More"), button:has-text("Show More"), ' +
        'button:has-text("See More"), a:has-text("Load More"), ' +
        '[data-testid*="load-more"], [class*="load-more"]'
      ).first();
      
      if (await loadMoreBtn.count() > 0 && await loadMoreBtn.isVisible()) {
        await loadMoreBtn.click({ timeout: 5000 });
      } else {
        // Scroll to bottom
        await ctx.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }
      
      // Wait for content to load
      await ctx.page.waitForTimeout(1000);
      await ctx.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    }
    
    return { success: true, strategy: `infinite scroll: ${scrollCount} loads` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle multi-select (select multiple options)
 */
async function handleMultiSelect(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const values = Array.isArray(action.value) ? action.value : [action.value];
  
  console.log(`[ActionHandler] Multi-select: "${label}" → [${values.join(', ')}]`);
  
  try {
    // Native select with multiple
    const nativeSelect = ctx.page.locator(`select[multiple]:has-text("${label}"), select[multiple][aria-label*="${label}" i]`).first();
    if (await nativeSelect.count() > 0) {
      await nativeSelect.selectOption(values, { timeout });
      return { success: true, strategy: 'multi-select: native' };
    }
    
    // Custom multi-select (checkboxes in dropdown)
    const triggerSelectors = [
      `[aria-haspopup="listbox"]:has-text("${label}")`,
      `[role="combobox"]:has-text("${label}")`,
      `button:has-text("${label}")`,
      `[data-testid*="multi"]:has-text("${label}")`,
    ];
    
    for (const selector of triggerSelectors) {
      try {
        const trigger = ctx.page.locator(selector).first();
        if (await trigger.count() > 0) {
          await trigger.click({ timeout: 5000 });
          await ctx.page.waitForTimeout(300);
          
          // Select each value
          for (const val of values) {
            const option = ctx.page.locator(
              `[role="option"]:has-text("${val}"), ` +
              `[role="checkbox"]:has-text("${val}"), ` +
              `label:has-text("${val}") input[type="checkbox"]`
            ).first();
            
            if (await option.count() > 0) {
              await option.click({ timeout: 2000 });
            }
          }
          
          // Close the dropdown (click outside or press Escape)
          await ctx.page.keyboard.press('Escape');
          return { success: true, strategy: 'multi-select: custom' };
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not find multi-select: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle date picker
 */
async function handleDatePicker(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const dateValue = action.value; // Expected: "2024-01-15" or "January 15, 2024"
  
  console.log(`[ActionHandler] Date picker: "${label}" → ${dateValue}`);
  
  try {
    // Try native date input first
    const nativeInput = ctx.page.locator(
      `input[type="date"][aria-label*="${label}" i], ` +
      `label:has-text("${label}") input[type="date"], ` +
      `input[type="date"][placeholder*="${label}" i]`
    ).first();
    
    if (await nativeInput.count() > 0) {
      await nativeInput.fill(dateValue, { timeout: 5000 });
      return { success: true, strategy: 'date picker: native' };
    }
    
    // Custom date picker - click to open, then select
    const triggerSelectors = [
      `[data-testid*="date"]:has-text("${label}")`,
      `button:has-text("${label}")`,
      `input[placeholder*="date" i]:has-text("${label}")`,
      `[class*="date"]:has-text("${label}") input`,
      `[class*="Date"]:has-text("${label}") input`,
    ];
    
    for (const selector of triggerSelectors) {
      try {
        const trigger = ctx.page.locator(selector).first();
        if (await trigger.count() > 0) {
          await trigger.click({ timeout: 5000 });
          await ctx.page.waitForTimeout(300);
          
          // Try to fill the value
          if (await trigger.evaluate(el => el.tagName === 'INPUT')) {
            await trigger.fill(dateValue, { timeout: 5000 });
            await ctx.page.keyboard.press('Enter');
            return { success: true, strategy: 'date picker: input fill' };
          }
          
          // Try finding day button in calendar
          const day = dateValue.split('-')[2] || dateValue.match(/\d+/)?.[0];
          if (day) {
            const dayBtn = ctx.page.locator(
              `[role="gridcell"]:has-text("${parseInt(day)}"), ` +
              `button:has-text("${parseInt(day)}"), ` +
              `td:has-text("${parseInt(day)}")`
            ).first();
            
            if (await dayBtn.count() > 0) {
              await dayBtn.click({ timeout: 5000 });
              return { success: true, strategy: 'date picker: calendar' };
            }
          }
        }
      } catch (e) {
        // Try next
      }
    }
    
    return { success: false, error: `Could not set date: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle time picker
 */
async function handleTimePicker(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const label = getActionLabel(action);
  const timeValue = action.value; // Expected: "14:30" or "2:30 PM"
  
  console.log(`[ActionHandler] Time picker: "${label}" → ${timeValue}`);
  
  try {
    // Native time input
    const nativeInput = ctx.page.locator(
      `input[type="time"][aria-label*="${label}" i], ` +
      `label:has-text("${label}") input[type="time"]`
    ).first();
    
    if (await nativeInput.count() > 0) {
      await nativeInput.fill(timeValue, { timeout: 5000 });
      return { success: true, strategy: 'time picker: native' };
    }
    
    // Custom time picker
    const result = await ctx.findElementWithRetry(action);
    if (result) {
      await result.locator.fill(timeValue, { timeout: 5000 });
      return { success: true, strategy: result.strategy };
    }
    
    return { success: false, error: `Could not set time: ${label}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Handle calendar interaction
 */
async function handleCalendar(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const date = action.value; // Expected: "2024-01-15"
  
  console.log(`[ActionHandler] Calendar: select ${date}`);
  
  try {
    // Parse the date
    const [year, month, day] = date.split('-').map(Number);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const targetMonth = monthNames[month - 1];
    
    // Find and navigate to correct month
    let attempts = 0;
    while (attempts < 24) { // Max 2 years
      const header = ctx.page.locator('[class*="calendar"] [class*="header"], [role="grid"] caption, [aria-label*="calendar"]').first();
      const headerText = await header.textContent().catch(() => '');
      
      if (headerText.includes(targetMonth) && headerText.includes(String(year))) {
        break;
      }
      
      // Click next or prev based on target
      const currentDate = new Date(headerText);
      const targetDate = new Date(year, month - 1);
      
      const navBtn = currentDate < targetDate
        ? ctx.page.locator('[aria-label*="next" i], button:has-text(">")').first()
        : ctx.page.locator('[aria-label*="prev" i], button:has-text("<")').first();
      
      if (await navBtn.count() > 0) {
        await navBtn.click({ timeout: 2000 });
        await ctx.page.waitForTimeout(200);
      }
      
      attempts++;
    }
    
    // Click the day
    const dayBtn = ctx.page.locator(
      `[role="gridcell"]:has-text("${day}"), ` +
      `button[data-day="${day}"], ` +
      `td:has-text("${day}")`
    ).first();
    
    if (await dayBtn.count() > 0) {
      await dayBtn.click({ timeout: 5000 });
      return { success: true, strategy: 'calendar: day click' };
    }
    
    return { success: false, error: `Could not select date: ${date}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Normalize action type to lowercase without separators
 */
function normalizeActionType(type) {
  if (!type) return '';
  return type.toLowerCase().replace(/[_\s-]/g, '');
}

module.exports = {
  // THE UNIFIED EXECUTION POINT - use this!
  executeAction,
  
  // Individual handlers (for special cases only)
  handleNavigation,
  handleSalesforceNavigation,
  handleClick,
  handleDoubleClick,
  handleRightClick,
  handleFill,
  handleSelect,
  handleHover,
  handlePress,
  handleWait,
  handleCheck,
  handleUncheck,
  handleScroll,
  handleUpload,
  handleDrag,
  handleDownload,
  handleDialog,
  handleCloseModal,
  handleAssertText,
  handleAssertVisible,
  handleAssertValue,
  
  // NEW comprehensive handlers
  handleClear,
  handleFocus,
  handleBlur,
  handleToggle,
  handleSlider,
  handleAccordion,
  handleAutocomplete,
  handleOTPInput,
  handleQuantitySpinner,
  handleRating,
  handleTableSort,
  handlePagination,
  handleCookieConsent,
  handleInfiniteScroll,
  handleMultiSelect,
  handleDatePicker,
  handleTimePicker,
  handleCalendar,
  
  // PWA Testing handlers
  handlePWAAudit,
  handleCheckManifest,
  handleCheckServiceWorker,
  handleWaitForServiceWorker,
  handleTestOffline,
  handleCheckCache,
  handleCheckInstallability,
  
  // PWA Testing module (lazy loaded)
  getPWATesting,
  
  // AI Fallback (re-exported from ai-fallback.js)
  findElementWithAI,
  clickAtCoordinates,
  fillAtCoordinates,
  retryWithBackoff,
  
  // Text utilities
  normalizeActionType,
  getActionLabel,
  normalizeTextForMatching,
  
  // Internal helpers
  searchIframesForClick,
  searchIframesForFill,
  handleRadixSelect,
  findDropdownOption
};
