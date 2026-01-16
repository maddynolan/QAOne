/**
 * Action Handlers Module
 * 
 * Extracted from playwright-recorder.js for better maintainability.
 * Each handler receives (context, action, options) where context is the PlaywrightRecorder instance.
 */

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
  const label = action.label || action.text;
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
 */
async function handleFill(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const value = action.value;
  const label = action.label || action.text;
  
  // Try SmartFinder first (best for modern frameworks)
  if (ctx.useSmartFinderForPlayback && ctx.smartFinder && action.recipe) {
    try {
      console.log(`[ActionHandler] Trying SmartFinder for fill: "${label}"`);
      const smartResult = await ctx.smartFinder.findElement(action.recipe);
      if (smartResult) {
        await smartResult.locator.clear().catch(() => {});
        await smartResult.locator.fill(value || '', { timeout });
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
    await fillResult.locator.clear().catch(() => {});
    await fillResult.locator.fill(value || '', { timeout });
    console.log(`[ActionHandler] ✓ Legacy fill succeeded for "${label}"`);
    return { success: true, strategy: fillResult.strategy.type };
  }
  
  // IFRAME FALLBACK - Search inside iframes
  console.log(`[ActionHandler] Fill: Element not on main page, checking iframes...`);
  const iframeFillResult = await searchIframesForFill(ctx, action, value, label, timeout);
  if (iframeFillResult.success) {
    return iframeFillResult;
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
  const label = action.label || action.text;
  
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
 * Handle hover action
 */
async function handleHover(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const selector = action.selector;
  const label = action.label || action.text;
  
  const hoverResult = await ctx.findElementWithRetry(action);
  if (hoverResult) {
    await hoverResult.locator.hover({ timeout });
    return { success: true };
  }
  
  return { success: false, error: `Could not find element to hover: "${label || selector}"` };
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
  const label = action.label || action.text;
  
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
  const label = action.label || action.text;
  
  const uncheckResult = await ctx._findElement(action);
  if (uncheckResult) {
    await uncheckResult.locator.uncheck({ timeout });
    return { success: true };
  }
  
  return { success: false, error: `Could not find checkbox: "${label || selector}"` };
}

/**
 * Handle scroll action
 */
async function handleScroll(ctx, action, options = {}) {
  const direction = action.direction || action.value || 'down';
  const amount = action.amount || 300;
  
  if (direction === 'down') {
    await ctx.page.mouse.wheel(0, amount);
  } else if (direction === 'up') {
    await ctx.page.mouse.wheel(0, -amount);
  } else if (direction === 'left') {
    await ctx.page.mouse.wheel(-amount, 0);
  } else if (direction === 'right') {
    await ctx.page.mouse.wheel(amount, 0);
  }
  
  return { success: true };
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

module.exports = {
  handleNavigation,
  handleSalesforceNavigation,
  handleClick,
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
  // Internal helpers exposed for advanced use
  searchIframesForClick,
  searchIframesForFill,
  handleRadixSelect,
  findDropdownOption
};
