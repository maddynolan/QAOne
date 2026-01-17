/**
 * Tab Manager Module (Simplified)
 * 
 * Leverages Playwright's NATIVE multi-tab/cross-origin support:
 * - Playwright runs out-of-process = full access to any origin
 * - context.waitForEvent('page') handles new tabs/popups
 * - page.frameLocator() handles iframes seamlessly
 * - Regular locators work on cross-origin pages!
 * 
 * This module adds RECORDING/PLAYBACK tracking on top of native capabilities.
 */

/**
 * Handle new tab action during playback
 * 
 * Uses Playwright's native multi-tab support via context.waitForEvent('page')
 */
async function handleNewTab(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const targetIndex = action.tabIndex;
  
  console.log(`[TabManager] NewTab - index: ${targetIndex}`);
  
  const pages = ctx.context.pages();
  
  // Tab already exists? Switch to it
  if (typeof targetIndex === 'number' && pages[targetIndex]) {
    ctx.page = pages[targetIndex];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Switched to tab ${targetIndex}`);
    return { success: true };
  }
  
  // Wait for new page using Playwright's native event
  if (pages.length === 1) {
    try {
      console.log(`[TabManager] Waiting for new page...`);
      const newPage = await ctx.context.waitForEvent('page', { timeout });
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      ctx.page = newPage;
      await ctx.page.bringToFront();
      console.log(`[TabManager] ✓ New tab: ${newPage.url().substring(0, 60)}`);
      return { success: true };
    } catch (e) {
      console.log(`[TabManager] Timeout waiting for new page`);
    }
  }
  
  // Multiple pages - switch to latest
  ctx.page = pages[pages.length - 1];
  await ctx.page.bringToFront();
  console.log(`[TabManager] ✓ Switched to latest tab: ${ctx.page.url().substring(0, 60)}`);
  return { success: true };
}

/**
 * Handle tab switch action during playback
 * 
 * Simple tab switching using Playwright's page tracking
 */
async function handleSwitchTab(ctx, action, options = {}) {
  const targetIndex = action.tabIndex ?? action.args?.[0];
  const targetUrl = action.url || action.args?.[1];
  
  console.log(`[TabManager] SwitchTab - index: ${targetIndex}, url: ${targetUrl}`);
  
  const pages = ctx.context.pages();
  
  // By index (most reliable)
  if (typeof targetIndex === 'number' && pages[targetIndex]) {
    ctx.page = pages[targetIndex];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Tab ${targetIndex}: ${ctx.page.url().substring(0, 60)}`);
    return { success: true };
  }
  
  // By URL match
  if (targetUrl) {
    const match = pages.find(p => {
      try {
        const url = p.url();
        return url === targetUrl || url.includes(targetUrl) || 
               new URL(url).hostname === new URL(targetUrl).hostname;
      } catch { return false; }
    });
    
    if (match) {
      ctx.page = match;
      await ctx.page.bringToFront();
      console.log(`[TabManager] ✓ Tab by URL: ${ctx.page.url().substring(0, 60)}`);
      return { success: true };
    }
  }
  
  // Fallback to first tab
  if (pages.length > 0) {
    ctx.page = pages[0];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Fallback to tab 0`);
    return { success: true };
  }
  
  return { success: false, error: `Could not switch to tab ${targetIndex}` };
}

/**
 * Handle tab close action during playback
 */
async function handleCloseTab(ctx, action, options = {}) {
  const targetIndex = action.tabIndex ?? action.args?.[0];
  
  console.log(`[TabManager] CloseTab - index: ${targetIndex}`);
  
  const pages = ctx.context.pages();
  
  // Determine which tab to close
  let tabToClose = typeof targetIndex === 'number' && pages[targetIndex] 
    ? pages[targetIndex] 
    : pages[pages.length - 1];
  
  if (tabToClose && pages.length > 1) {
    await tabToClose.close();
    console.log(`[TabManager] ✓ Closed tab`);
    
    // Switch to parent tab
    const remainingPages = ctx.context.pages();
    if (remainingPages.length > 0) {
      ctx.page = remainingPages[0];
      await ctx.page.bringToFront();
      console.log(`[TabManager] ✓ Parent tab: ${ctx.page.url().substring(0, 60)}`);
    }
    
    return { success: true };
  }
  
  console.log(`[TabManager] No tab to close`);
  return { success: true };
}

/**
 * Handle cross-origin placeholder action during playback
 * 
 * SIMPLIFIED: Leverages Playwright's native cross-origin support.
 * Playwright runs out-of-process and has FULL ACCESS to cross-origin pages.
 * No special workarounds needed - just use regular locators!
 */
async function handleCrossOrigin(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const userActions = action.userActions || [];
  const externalUrl = action.url || action.label || action.args?.[0];
  
  console.log(`[TabManager] CrossOrigin - URL: ${externalUrl}, actions: ${userActions.length}`);
  
  const pages = ctx.context.pages();
  
  // Find the cross-origin tab (simple: by URL or latest non-parent)
  let targetPage = null;
  
  if (externalUrl) {
    targetPage = pages.find(p => {
      try {
        return p.url().includes(externalUrl) || new URL(p.url()).hostname.includes(externalUrl);
      } catch { return false; }
    });
  }
  
  if (!targetPage && pages.length > 1) {
    targetPage = pages[pages.length - 1];
  }
  
  if (!targetPage) {
    console.log(`[TabManager] No cross-origin tab found, skipping`);
    return { success: true };
  }
  
  // Switch to target page - Playwright has FULL access even cross-origin!
  ctx.page = targetPage;
  await ctx.page.bringToFront();
  await ctx.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  console.log(`[TabManager] ✓ Switched to: ${ctx.page.url().substring(0, 60)}`);
  
  // Execute user actions using Playwright's native locators
  for (const userAction of userActions) {
    console.log(`[TabManager] Action: ${userAction.action || userAction.type} - ${userAction.description || userAction.selector}`);
    const result = await executeUserAction(ctx, userAction, timeout);
    if (!result.success) {
      console.log(`[TabManager] ⚠ Action failed: ${result.error}`);
    }
  }
  
  // Return to parent tab
  const remainingPages = ctx.context.pages();
  if (remainingPages.length > 0) {
    ctx.page = remainingPages[0];
    await ctx.page.bringToFront();
    console.log(`[TabManager] ✓ Returned to parent: ${ctx.page.url().substring(0, 50)}`);
  }
  
  return { success: true };
}

/**
 * Execute a single user-defined action
 * 
 * SIMPLIFIED: Uses Playwright's native locator strategies directly.
 * Playwright handles cross-origin, shadow DOM (open), and iframes natively.
 */
async function executeUserAction(ctx, userAction, timeout = 10000) {
  // Normalize field names (UI vs legacy format)
  const actionType = userAction.type || userAction.action || 'click';
  const findBy = userAction.findBy || userAction.selectorType || 'text';
  const selector = userAction.selector || userAction.text || '';
  const value = userAction.value || '';
  const coords = userAction.coords;
  
  console.log(`[TabManager] Execute: ${actionType} | ${findBy}="${selector}"`);
  
  try {
    // Wait action
    if (actionType === 'wait') {
      const ms = parseInt(value) || parseInt(selector) || 2000;
      await ctx.page.waitForTimeout(ms);
      return { success: true };
    }
    
    // Coordinate-based click
    if (findBy === 'coords' && coords) {
      await ctx.page.mouse.click(coords.x, coords.y);
      console.log(`[TabManager] ✓ Clicked (${coords.x}, ${coords.y})`);
      return { success: true };
    }
    
    if (!selector) {
      return { success: false, error: 'No selector provided' };
    }
    
    // Build locator using Playwright's native methods
    let locator;
    
    switch (findBy) {
      case 'css':
        locator = ctx.page.locator(selector).first();
        break;
      case 'xpath':
        locator = ctx.page.locator(`xpath=${selector}`).first();
        break;
      case 'testId':
        locator = ctx.page.getByTestId(selector);
        break;
      case 'role':
        locator = ctx.page.getByRole(selector.split(':')[0], { name: selector.split(':')[1] });
        break;
      case 'label':
        locator = ctx.page.getByLabel(selector);
        break;
      case 'placeholder':
        locator = ctx.page.getByPlaceholder(selector);
        break;
      case 'text':
      case 'Text Content':
      default:
        // Playwright's getByText auto-pierces open shadow DOM!
        locator = ctx.page.getByText(selector, { exact: false }).first();
        break;
    }
    
    // Wait for element to be actionable
    await locator.waitFor({ state: 'visible', timeout }).catch(() => {});
    
    // Execute action
    switch (actionType) {
      case 'click':
        await locator.click({ timeout, force: true });
        console.log(`[TabManager] ✓ Clicked: "${selector}"`);
        break;
      case 'fill':
      case 'type':
      case 'input':
        await locator.fill(value, { timeout });
        console.log(`[TabManager] ✓ Filled: "${selector}" = "${value}"`);
        break;
      case 'select':
        await locator.selectOption(value, { timeout });
        console.log(`[TabManager] ✓ Selected: "${value}"`);
        break;
      case 'check':
        await locator.check({ timeout });
        break;
      case 'uncheck':
        await locator.uncheck({ timeout });
        break;
      case 'hover':
        await locator.hover({ timeout });
        break;
      default:
        await locator.click({ timeout, force: true });
    }
    
    return { success: true };
  } catch (e) {
    console.error(`[TabManager] Action failed:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Handle frame switch action
 * 
 * Uses Playwright's native frameLocator() which handles iframes seamlessly
 */
async function handleSwitchToFrame(ctx, action, options = {}) {
  const frameSelector = action.frameSelector || action.selector || action.value;
  const frameName = action.frameName || action.name;
  const frameIndex = action.frameIndex;
  
  console.log(`[TabManager] SwitchToFrame - selector: ${frameSelector}, name: ${frameName}, index: ${frameIndex}`);
  
  try {
    // Playwright's frameLocator() provides FULL access to iframe content
    let frame;
    
    if (frameSelector) {
      frame = ctx.page.frameLocator(frameSelector);
    } else if (frameName) {
      frame = ctx.page.frameLocator(`iframe[name="${frameName}"]`);
    } else if (typeof frameIndex === 'number') {
      frame = ctx.page.frameLocator('iframe').nth(frameIndex);
    } else {
      frame = ctx.page.frameLocator('iframe').first();
    }
    
    ctx._currentFrame = frame;
    console.log(`[TabManager] ✓ Frame context set`);
    return { success: true };
  } catch (e) {
    return { success: false, error: `Frame switch failed: ${e.message}` };
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
