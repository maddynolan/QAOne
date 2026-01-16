/**
 * Tab Manager Module
 * 
 * Handles multi-tab, multi-window operations including:
 * - New tab detection and tracking
 * - Tab switching
 * - Tab closing
 * - Cross-origin tab handling
 */

const { SmartFinder } = require('./smart-finder');

/**
 * Handle new tab action during playback
 * Waits for a new tab to open and switches context to it
 */
async function handleNewTab(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const expectedUrl = action.url || action.args?.[0];
  const targetIndex = action.tabIndex;
  
  console.log(`[TabManager] NewTab action - expecting URL: ${expectedUrl}, index: ${targetIndex}`);
  
  const pages = ctx.context.pages();
  
  // If target index is provided and tab already exists, switch to it
  if (typeof targetIndex === 'number' && pages[targetIndex]) {
    ctx.page = pages[targetIndex];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Switched to existing tab ${targetIndex}`);
    
    // Re-initialize SmartFinder for new page
    if (ctx.useSmartFinderForPlayback) {
      ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
    }
    
    return { success: true };
  }
  
  // Wait for new page if not already available
  if (pages.length === 1) {
    try {
      console.log(`[TabManager] Waiting for new page to open...`);
      const newPage = await ctx.context.waitForEvent('page', { timeout });
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      
      ctx.page = newPage;
      await ctx.page.bringToFront();
      console.log(`[TabManager] ✓ New tab opened: ${newPage.url().substring(0, 60)}`);
      
      // Re-initialize SmartFinder for new page
      if (ctx.useSmartFinderForPlayback) {
        ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
      }
      
      return { success: true };
    } catch (e) {
      console.log(`[TabManager] No new page opened within timeout`);
    }
  }
  
  // Multiple pages exist - find the right one
  const latestIndex = pages.length - 1;
  ctx.page = pages[latestIndex];
  await ctx.page.bringToFront();
  console.log(`[TabManager] ✓ Switched to latest tab (${latestIndex}): ${ctx.page.url().substring(0, 60)}`);
  
  // Re-initialize SmartFinder for new page
  if (ctx.useSmartFinderForPlayback) {
    ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
  }
  
  return { success: true };
}

/**
 * Handle tab switch action during playback
 * Finds the target tab by index, URL, or hostname
 */
async function handleSwitchTab(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const targetIndex = action.tabIndex ?? action.args?.[0];
  const targetUrl = action.url || action.args?.[1];
  
  console.log(`[TabManager] SwitchTab action - index: ${targetIndex}, url: ${targetUrl}`);
  
  const pages = ctx.context.pages();
  
  // Strategy 1: By index
  if (typeof targetIndex === 'number' && pages[targetIndex]) {
    ctx.page = pages[targetIndex];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Switched to tab ${targetIndex}: ${ctx.page.url().substring(0, 60)}`);
    
    if (ctx.useSmartFinderForPlayback) {
      ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
    }
    
    return { success: true };
  }
  
  // Strategy 2: By URL match
  if (targetUrl) {
    for (let i = 0; i < pages.length; i++) {
      const pageUrl = pages[i].url();
      if (pageUrl === targetUrl || pageUrl.includes(targetUrl)) {
        ctx.page = pages[i];
        await ctx.page.bringToFront();
        console.log(`[TabManager] ✓ Switched to tab by URL match (${i}): ${pageUrl.substring(0, 60)}`);
        
        if (ctx.useSmartFinderForPlayback) {
          ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
        }
        
        return { success: true };
      }
    }
    
    // Try hostname match
    try {
      const targetHost = new URL(targetUrl).hostname;
      for (let i = 0; i < pages.length; i++) {
        try {
          const pageHost = new URL(pages[i].url()).hostname;
          if (pageHost === targetHost) {
            ctx.page = pages[i];
            await ctx.page.bringToFront();
            console.log(`[TabManager] ✓ Switched to tab by hostname match (${i}): ${pageHost}`);
            
            if (ctx.useSmartFinderForPlayback) {
              ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
            }
            
            return { success: true };
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  
  // Strategy 3: Fallback to first or last tab
  const fallbackIndex = targetIndex >= pages.length ? pages.length - 1 : 0;
  if (pages[fallbackIndex]) {
    ctx.page = pages[fallbackIndex];
    await ctx.page.bringToFront();
    console.log(`[TabManager] Fallback to tab ${fallbackIndex}: ${ctx.page.url().substring(0, 60)}`);
    
    if (ctx.useSmartFinderForPlayback) {
      ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
    }
    
    return { success: true };
  }
  
  return { success: false, error: `Could not switch to tab ${targetIndex}` };
}

/**
 * Handle tab close action during playback
 */
async function handleCloseTab(ctx, action, options = {}) {
  const targetIndex = action.tabIndex ?? action.args?.[0];
  
  console.log(`[TabManager] CloseTab action - index: ${targetIndex}`);
  
  const pages = ctx.context.pages();
  
  // Determine which tab to close
  let tabToClose = null;
  if (typeof targetIndex === 'number' && pages[targetIndex]) {
    tabToClose = pages[targetIndex];
  } else {
    // Close current tab (not the first one)
    tabToClose = pages[pages.length - 1];
  }
  
  if (tabToClose && pages.length > 1) {
    await tabToClose.close();
    console.log(`[TabManager] ✓ Closed tab`);
    
    // Switch to remaining tab (prefer first/parent)
    const remainingPages = ctx.context.pages();
    if (remainingPages.length > 0) {
      ctx.page = remainingPages[0];
      await ctx.page.bringToFront();
      console.log(`[TabManager] ✓ Switched to parent tab: ${ctx.page.url().substring(0, 60)}`);
      
      if (ctx.useSmartFinderForPlayback) {
        ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
      }
    }
    
    return { success: true };
  }
  
  console.log(`[TabManager] No tab to close or only one tab remaining`);
  return { success: true };
}

/**
 * Handle cross-origin placeholder action during playback
 * Executes user-defined actions in cross-origin tabs
 */
async function handleCrossOrigin(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const userActions = action.userActions || [];
  const externalUrl = action.url || action.label || action.args?.[0];
  
  console.log(`[TabManager] CrossOrigin action - URL: ${externalUrl}, userActions: ${userActions.length}`);
  
  const pages = ctx.context.pages();
  
  // Find the cross-origin tab
  let targetCrossTabIndex = -1;
  
  // Strategy 1: By URL match
  if (externalUrl) {
    for (let i = 0; i < pages.length; i++) {
      const pageUrl = pages[i].url();
      if (pageUrl.includes(externalUrl) || externalUrl.includes(new URL(pageUrl).hostname)) {
        targetCrossTabIndex = i;
        break;
      }
    }
  }
  
  // Strategy 2: Use latest non-parent tab
  if (targetCrossTabIndex === -1 && pages.length > 1) {
    targetCrossTabIndex = pages.length - 1;
  }
  
  // Execute user actions if we have a target tab
  if (targetCrossTabIndex > 0 && pages[targetCrossTabIndex]) {
    ctx.page = pages[targetCrossTabIndex];
    await ctx.page.bringToFront();
    await ctx.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    console.log(`[TabManager] ✓ Switched to cross-origin tab (${targetCrossTabIndex}): ${ctx.page.url().substring(0, 60)}`);
    
    // Re-initialize SmartFinder for cross-origin page
    if (ctx.useSmartFinderForPlayback) {
      ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
    }
    
    // Execute each user action
    for (const userAction of userActions) {
      console.log(`[TabManager] Executing user action: ${userAction.action} - ${userAction.description}`);
      
      const actionResult = await executeUserAction(ctx, userAction, timeout);
      if (!actionResult.success) {
        console.log(`[TabManager] User action failed: ${actionResult.error}`);
        // Continue with other actions, don't fail the whole step
      }
    }
  } else {
    console.log(`[TabManager] No cross-origin tab found, skipping user actions`);
  }
  
  // CRITICAL: After cross-origin step, switch back to the PARENT tab (tab 0)
  const pagesAfter = ctx.context.pages();
  if (pagesAfter.length > 1 && targetCrossTabIndex > 0) {
    // Close the cross-origin tab if it's still open
    const crossTab = pagesAfter[targetCrossTabIndex];
    if (crossTab && crossTab !== pagesAfter[0]) {
      console.log('[TabManager] Closing cross-origin tab and switching to parent...');
      await crossTab.close().catch(() => {});
    }
  }
  
  // Switch back to parent tab (tab 0)
  const remainingPages = ctx.context.pages();
  if (remainingPages.length > 0) {
    ctx.page = remainingPages[0];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Returned to parent tab: ${ctx.page.url().substring(0, 50)}`);
    
    // Re-initialize SmartFinder for parent page
    if (ctx.useSmartFinderForPlayback) {
      ctx.smartFinder = new SmartFinder(ctx.page, { debug: true, timeout: 15000 });
    }
  }
  
  return { success: true };
}

/**
 * Execute a single user-defined action in cross-origin context
 * Handles both naming conventions:
 * - UI format: { type, findBy, selector, value, description, coords }
 * - Legacy format: { action, selectorType, text, selector, value, description, coords }
 */
async function executeUserAction(ctx, userAction, timeout) {
  // Normalize field names (UI uses 'type'/'findBy', legacy uses 'action'/'selectorType')
  const actionType = userAction.type || userAction.action || 'click';
  const findBy = userAction.findBy || userAction.selectorType || 'text';
  const selectorValue = userAction.selector || userAction.text || '';
  const description = userAction.description || selectorValue;
  const value = userAction.value || '';
  const coords = userAction.coords;
  
  console.log(`[TabManager] executeUserAction: type=${actionType}, findBy=${findBy}, selector="${selectorValue}"`);
  
  try {
    // Handle wait action specially
    if (actionType === 'wait') {
      const duration = parseInt(value) || parseInt(selectorValue) || 2000;
      console.log(`[TabManager] Waiting ${duration}ms`);
      await ctx.page.waitForTimeout(duration);
      return { success: true };
    }
    
    // Build locator based on find method
    let locator = null;
    
    // Strategy 1: Coordinates
    if (findBy === 'coords' && coords) {
      await ctx.page.mouse.click(coords.x, coords.y);
      console.log(`[TabManager] ✓ Clicked at (${coords.x}, ${coords.y})`);
      return { success: true };
    }
    
    // Strategy 2: CSS Selector
    if (findBy === 'css' && selectorValue) {
      locator = ctx.page.locator(selectorValue).first();
      console.log(`[TabManager] Trying CSS selector: ${selectorValue}`);
    }
    // Strategy 3: XPath
    else if (findBy === 'xpath' && selectorValue) {
      locator = ctx.page.locator(`xpath=${selectorValue}`).first();
      console.log(`[TabManager] Trying XPath: ${selectorValue}`);
    }
    // Strategy 4: Test ID
    else if (findBy === 'testId' && selectorValue) {
      locator = ctx.page.locator(`[data-testid="${selectorValue}"]`).first();
      console.log(`[TabManager] Trying testId: ${selectorValue}`);
    }
    // Strategy 5: Text Content (most common from UI)
    else if ((findBy === 'text' || findBy === 'Text Content') && selectorValue) {
      console.log(`[TabManager] Finding by text: "${selectorValue}"`);
      
      // Try getByText first
      locator = ctx.page.getByText(selectorValue, { exact: false }).first();
      
      // If not visible, try getByRole with name
      if (!(await locator.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log(`[TabManager] getByText failed, trying getByRole...`);
        locator = ctx.page.getByRole('link', { name: selectorValue }).first();
      }
      
      // If still not visible, try locator with text
      if (!(await locator.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log(`[TabManager] getByRole failed, trying locator...`);
        locator = ctx.page.locator(`text="${selectorValue}"`).first();
      }
      
      // If still not visible, try partial match
      if (!(await locator.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log(`[TabManager] Exact text failed, trying partial...`);
        locator = ctx.page.locator(`text=${selectorValue}`).first();
      }
    }
    // Fallback: Use selector value as text
    else if (selectorValue) {
      console.log(`[TabManager] Fallback: treating selector as text: "${selectorValue}"`);
      locator = ctx.page.getByText(selectorValue, { exact: false }).first();
    }
    
    // Try AI fallback if element not found
    if (!locator || !(await locator.isVisible({ timeout: 3000 }).catch(() => false))) {
      if (ctx.enableAIFallback && selectorValue) {
        console.log(`[TabManager] Element not found, trying AI fallback for: "${selectorValue}"`);
        const aiResult = await ctx.findElementWithAI(selectorValue, actionType);
        if (aiResult) {
          if (actionType === 'click') {
            await ctx.clickAtCoordinates(aiResult.x, aiResult.y);
            console.log(`[TabManager] ✓ AI click at (${aiResult.x}, ${aiResult.y})`);
          } else if (actionType === 'fill') {
            await ctx.page.mouse.click(aiResult.x, aiResult.y);
            await ctx.page.keyboard.type(value || '');
            console.log(`[TabManager] ✓ AI fill completed`);
          }
          return { success: true, strategy: 'AI' };
        }
      }
      
      return { success: false, error: `Element not found: "${selectorValue}"` };
    }
    
    // Execute the action
    if (actionType === 'click') {
      // Wait for element to be stable
      await locator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await locator.click({ timeout: 10000 });
      console.log(`[TabManager] ✓ Clicked: "${selectorValue}"`);
      await ctx.page.waitForTimeout(500); // Allow for navigation
    } else if (actionType === 'fill') {
      await locator.clear().catch(() => {});
      await locator.fill(value || '', { timeout: 10000 });
      console.log(`[TabManager] ✓ Filled: "${selectorValue}" with "${value}"`);
    } else if (actionType === 'select') {
      // For dropdowns, click then select option
      await locator.click({ timeout: 5000 });
      await ctx.page.waitForTimeout(300);
      const option = ctx.page.locator(`[role="option"]:has-text("${value}")`).first();
      await option.click({ timeout: 5000 });
      console.log(`[TabManager] ✓ Selected: "${value}"`);
    }
    
    return { success: true };
  } catch (e) {
    console.error(`[TabManager] executeUserAction failed:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Handle frame switch action
 */
async function handleSwitchToFrame(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const frameSelector = action.frameSelector || action.selector || action.value;
  const frameName = action.frameName || action.name;
  const frameIndex = action.frameIndex;
  
  console.log(`[TabManager] SwitchToFrame - selector: ${frameSelector}, name: ${frameName}, index: ${frameIndex}`);
  
  try {
    let frame = null;
    
    if (frameSelector) {
      frame = ctx.page.frameLocator(frameSelector);
    } else if (frameName) {
      frame = ctx.page.frameLocator(`iframe[name="${frameName}"]`);
    } else if (typeof frameIndex === 'number') {
      frame = ctx.page.frameLocator(`iframe >> nth=${frameIndex}`);
    } else {
      // Default to first iframe
      frame = ctx.page.frameLocator('iframe').first();
    }
    
    // Store frame context for subsequent actions
    ctx._currentFrame = frame;
    console.log(`[TabManager] ✓ Switched to frame`);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: `Could not switch to frame: ${e.message}` };
  }
}

/**
 * Handle switch to main frame action
 */
async function handleSwitchToMainFrame(ctx, action, options = {}) {
  ctx._currentFrame = null;
  console.log(`[TabManager] ✓ Switched to main frame`);
  return { success: true };
}

/**
 * Setup tab tracking during recording
 * Configures listeners for tab open/close/focus events
 */
function setupTabTracking(ctx) {
  if (!ctx.context) return;
  
  // Initialize tab tracking arrays
  ctx._pages = ctx._pages || [ctx.page];
  ctx._pageUrls = ctx._pageUrls || [ctx.page?.url()];
  ctx._currentPageIndex = 0;
  
  // Listen for new tabs
  ctx.context.on('page', async (newPage) => {
    console.log(`[TabManager] New tab detected`);
    
    const newIndex = ctx._pages.length;
    ctx._pages.push(newPage);
    ctx._pageUrls.push(newPage.url());
    
    // Wait for page to load
    await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    
    const newUrl = newPage.url();
    ctx._pageUrls[newIndex] = newUrl;
    
    // Check if cross-origin
    let isCrossOrigin = false;
    try {
      const parentHost = new URL(ctx._pages[0].url()).hostname;
      const newHost = new URL(newUrl).hostname;
      isCrossOrigin = parentHost !== newHost;
    } catch (e) {}
    
    // Record new tab action
    const tabAction = {
      type: isCrossOrigin ? 'crossOriginPlaceholder' : 'newTab',
      tabIndex: newIndex,
      url: newUrl,
      crossOrigin: isCrossOrigin,
      timestamp: Date.now()
    };
    
    ctx.emit('action', tabAction);
    console.log(`[TabManager] Recorded ${tabAction.type}: ${newUrl.substring(0, 60)}`);
    
    // Setup close listener
    newPage.on('close', () => {
      console.log(`[TabManager] Tab closed: ${newUrl.substring(0, 60)}`);
      
      // Record close action
      ctx.emit('action', {
        type: 'closeTab',
        tabIndex: newIndex,
        url: newUrl,
        timestamp: Date.now()
      });
      
      // Remove from tracking
      const idx = ctx._pages.indexOf(newPage);
      if (idx > -1) {
        ctx._pages.splice(idx, 1);
        ctx._pageUrls.splice(idx, 1);
      }
      
      // Switch back to parent if this was active tab
      if (ctx.page === newPage && ctx._pages.length > 0) {
        ctx.page = ctx._pages[0];
        ctx._currentPageIndex = 0;
      }
    });
    
    // Try to inject recorder into same-origin tabs
    if (!isCrossOrigin) {
      try {
        await ctx._injectClickCaptureScript(newPage);
        console.log(`[TabManager] Injected recorder into new tab`);
      } catch (e) {
        console.log(`[TabManager] Could not inject recorder: ${e.message}`);
      }
    }
  });
}

/**
 * Setup tab focus detection during recording
 */
function setupTabFocusDetection(ctx) {
  if (ctx._tabFocusInterval) {
    clearInterval(ctx._tabFocusInterval);
  }
  
  let lastFocusedIndex = 0;
  let focusDebounceTimer = null;
  const FOCUS_DEBOUNCE_MS = 1500;
  
  ctx._tabFocusInterval = setInterval(async () => {
    if (!ctx._pages || ctx._pages.length <= 1) return;
    
    for (let i = 0; i < ctx._pages.length; i++) {
      const page = ctx._pages[i];
      if (!page || page.isClosed()) continue;
      
      try {
        const hasFocus = await page.evaluate(() => document.hasFocus()).catch(() => false);
        
        if (hasFocus && i !== lastFocusedIndex) {
          // Debounce focus changes
          if (focusDebounceTimer) {
            clearTimeout(focusDebounceTimer);
          }
          
          const targetIndex = i;
          focusDebounceTimer = setTimeout(() => {
            // Double-check focus is still on this tab
            page.evaluate(() => document.hasFocus()).then(stillFocused => {
              if (stillFocused && targetIndex !== lastFocusedIndex) {
                console.log(`[TabManager] Focus changed to tab ${targetIndex}`);
                
                lastFocusedIndex = targetIndex;
                ctx._currentPageIndex = targetIndex;
                ctx.page = page;
                
                ctx.emit('action', {
                  type: 'switchTab',
                  tabIndex: targetIndex,
                  url: page.url(),
                  timestamp: Date.now()
                });
              }
            }).catch(() => {});
          }, FOCUS_DEBOUNCE_MS);
          
          break;
        }
      } catch (e) {
        // Page might be closed
      }
    }
  }, 1000);
}

/**
 * Cleanup tab tracking
 */
function cleanupTabTracking(ctx) {
  if (ctx._tabFocusInterval) {
    clearInterval(ctx._tabFocusInterval);
    ctx._tabFocusInterval = null;
  }
  
  ctx._pages = [];
  ctx._pageUrls = [];
  ctx._currentPageIndex = 0;
}

module.exports = {
  handleNewTab,
  handleSwitchTab,
  handleCloseTab,
  handleCrossOrigin,
  handleSwitchToFrame,
  handleSwitchToMainFrame,
  setupTabTracking,
  setupTabFocusDetection,
  cleanupTabTracking,
  executeUserAction
};
