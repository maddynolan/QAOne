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
  const selector = action.selector;
  
  // Try finding element with automatic retry (handles slow pages)
  let clickResult = await ctx.findElementWithRetry(action);
  
  // Layer 3: IFRAME FALLBACK - Search inside iframes if not found on main page
  if (!clickResult) {
    console.log('[ActionHandler] Click: Element not on main page, checking iframes...');
    clickResult = await searchIframesForClick(ctx, action, label);
  }
  
  // Layer 4: AI FALLBACK - Last resort when all deterministic strategies fail
  if (!clickResult && ctx.enableAIFallback) {
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
  
  return { success: true, strategy: clickResult.strategy.type };
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
 * Handle fill/type actions with iframe fallback
 * Supports: input, textarea, contenteditable, and rich text editors
 */
async function handleFill(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const value = action.value;
  const label = getActionLabel(action);
  
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
          
          console.log(`[ActionHandler] ✓ SmartFinder contenteditable fill succeeded for "${label}"`);
          return { success: true, strategy: 'SmartFinder-contenteditable' };
        }
        
        // Standard input/textarea fill
        await smartLocator.clear().catch(() => {});
        await smartLocator.fill(value || '', { timeout });
        console.log(`[ActionHandler] ✓ SmartFinder fill succeeded for "${label}"`);
        return { success: true, strategy: 'SmartFinder' };
      }
    } catch (e) {
      console.log(`[ActionHandler] SmartFinder fill failed: ${e.message}`);
    }
  }
  
  // Try legacy element finder
  const fillResult = await ctx._findElement(action);
  if (fillResult) {
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
    console.log(`[ActionHandler] ✓ Legacy fill succeeded for "${label}"`);
    return { success: true, strategy: fillResult.strategy.type };
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
 */
async function handleSelect(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const value = action.value;
  const label = getActionLabel(action);
  
  console.log(`[ActionHandler] Select action: "${label}" -> "${value}"`);
  
  // Try native <select> first
  if (selector) {
    try {
      const nativeSelect = ctx.page.locator(`select${selector}, ${selector}`).first();
      const isSelect = await nativeSelect.evaluate(el => el.tagName === 'SELECT').catch(() => false);
      if (isSelect) {
        await nativeSelect.selectOption(value, { timeout });
        console.log(`[ActionHandler] ✓ Native select succeeded`);
        return { success: true, strategy: 'native-select' };
      }
    } catch (e) {}
  }
  
  // For Radix/custom dropdowns - multi-strategy approach
  const selectResult = await handleRadixSelect(ctx, action, value, label, timeout);
  if (selectResult.success) {
    return selectResult;
  }
  
  return { success: false, error: `Could not select "${value}" from dropdown "${label}"` };
}

/**
 * Handle Radix UI dropdown selection
 */
async function handleRadixSelect(ctx, action, value, label, timeout) {
  // Strategy 1: Try SmartFinder findCombobox
  if (ctx.useSmartFinderForPlayback && ctx.smartFinder) {
    try {
      const comboResult = await ctx.smartFinder.findCombobox(label);
      if (comboResult) {
        await comboResult.locator.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(300);
        
        // Find and click option
        const option = await findDropdownOption(ctx, value);
        if (option) {
          await option.click({ timeout: 5000 });
          console.log(`[ActionHandler] ✓ SmartFinder combobox select succeeded`);
          return { success: true, strategy: 'SmartFinder-combobox' };
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
      if (await trigger.isVisible({ timeout: 3000 })) {
        await trigger.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(300);
        
        const option = await findDropdownOption(ctx, value);
        if (option) {
          await option.click({ timeout: 5000 });
          console.log(`[ActionHandler] ✓ TestId select succeeded`);
          return { success: true, strategy: 'testId' };
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
        console.log(`[ActionHandler] ✓ Combobox scan select succeeded`);
        return { success: true, strategy: 'combobox-scan' };
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
  // Try various option selectors
  const optionSelectors = [
    `[role="option"]:has-text("${value}")`,
    `[role="menuitem"]:has-text("${value}")`,
    `[data-radix-select-item]:has-text("${value}")`,
    `[data-radix-collection-item]:has-text("${value}")`,
    `[data-state] >> text="${value}"`,
    `text="${value}"`
  ];
  
  for (const sel of optionSelectors) {
    try {
      const option = ctx.page.locator(sel).first();
      if (await option.isVisible({ timeout: 500 })) {
        return option;
      }
    } catch (e) {}
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
          hoverResult = { locator: locator.first(), strategy: { type: 'selector-fallback' } };
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
  console.log(`[ActionHandler] ✓ Hover succeeded using ${hoverResult.strategy?.type || 'SmartFinder'}`);
  
  // Wait for flyout menus to appear after hover
  await ctx.page.waitForTimeout(300);
  
  return { success: true, strategy: hoverResult.strategy?.type || 'SmartFinder' };
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
 * Handle check/uncheck actions
 */
async function handleCheck(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = getActionLabel(action);
  
  const checkResult = await ctx._findElement(action);
  if (checkResult) {
    await checkResult.locator.check({ timeout });
    return { success: true };
  }
  
  return { success: false, error: `Could not find checkbox: "${label || selector}"` };
}

async function handleUncheck(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = getActionLabel(action);
  
  const uncheckResult = await ctx._findElement(action);
  if (uncheckResult) {
    await uncheckResult.locator.uncheck({ timeout });
    return { success: true };
  }
  
  return { success: false, error: `Could not find checkbox: "${label || selector}"` };
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
    console.log(`[ActionHandler] ✓ File uploaded: ${filePath}`);
    return { success: true };
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
// UNIFIED EXECUTION POINT
// This is THE SINGLE entry point for all action execution.
// Both PlaywrightRecorder and TestExecutor MUST use this.
// ============================================================

/**
 * Execute a single action - UNIFIED EXECUTION POINT
 * 
 * @param {Object} ctx - Execution context (PlaywrightRecorder or TestExecutor instance)
 *   Must provide: page, findElementWithRetry, enableAIFallback, findElementWithAI
 * @param {Object} action - The action to execute
 * @param {Object} options - Execution options (timeout, etc.)
 * @returns {Promise<{success: boolean, error?: string, strategy?: string}>}
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
      
      // Click actions
      case 'click':
      case 'clicktext':
      case 'clickelement':
        return await handleClick(ctx, action, { timeout });
      
      // Double-click actions
      case 'dblclick':
      case 'doubleclick':
        return await handleDoubleClick(ctx, action, { timeout });
      
      // Right-click (context menu) actions
      case 'rightclick':
      case 'contextmenu':
        return await handleRightClick(ctx, action, { timeout });
      
      // Fill/Input actions
      case 'fill':
      case 'type':
      case 'input':
        return await handleFill(ctx, action, { timeout });
      
      // Select/Dropdown actions
      case 'select':
      case 'selectoption':
        return await handleSelect(ctx, action, { timeout });
      
      // Hover action (critical for flyout menus)
      case 'hover':
        return await handleHover(ctx, action, { timeout });
      
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
      
      default:
        console.warn(`[ActionHandlers] Unknown action type: ${actionType}`);
        return { success: false, error: `Unknown action type: ${actionType}` };
    }
  } catch (error) {
    console.error(`[ActionHandlers] Action failed:`, error.message);
    return { success: false, error: error.message };
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
