/**
 * PWA Offline Testing
 * 
 * Test PWA offline functionality by simulating network conditions
 * and verifying cached content is served correctly.
 * 
 * @module pwa-testing/offline-tester
 */

/**
 * Network presets for testing
 */
const NETWORK_PRESETS = {
  ONLINE: { offline: false, downloadThroughput: -1, uploadThroughput: -1, latency: 0 },
  OFFLINE: { offline: true, downloadThroughput: 0, uploadThroughput: 0, latency: 0 },
  SLOW_3G: { offline: false, downloadThroughput: 500 * 1024 / 8, uploadThroughput: 500 * 1024 / 8, latency: 400 },
  FAST_3G: { offline: false, downloadThroughput: 1.5 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 100 },
  SLOW_WIFI: { offline: false, downloadThroughput: 2 * 1024 * 1024 / 8, uploadThroughput: 1 * 1024 * 1024 / 8, latency: 50 },
  LIE_FI: { offline: false, downloadThroughput: 1, uploadThroughput: 1, latency: 10000 } // Connected but unusable
};

/**
 * Set network conditions via CDP
 * 
 * @param {CDPSession} cdpSession - Chrome DevTools Protocol session
 * @param {Object} conditions - Network conditions to set
 * @returns {Promise<Object>} Result
 */
async function setNetworkConditions(cdpSession, conditions) {
  try {
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: conditions.offline,
      downloadThroughput: conditions.downloadThroughput,
      uploadThroughput: conditions.uploadThroughput,
      latency: conditions.latency,
      connectionType: conditions.connectionType || 'wifi'
    });
    
    return { success: true, conditions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Go offline
 * 
 * @param {CDPSession} cdpSession - Chrome DevTools Protocol session
 * @returns {Promise<Object>} Result
 */
async function goOffline(cdpSession) {
  return setNetworkConditions(cdpSession, NETWORK_PRESETS.OFFLINE);
}

/**
 * Go online (restore normal network)
 * 
 * @param {CDPSession} cdpSession - Chrome DevTools Protocol session
 * @returns {Promise<Object>} Result
 */
async function goOnline(cdpSession) {
  return setNetworkConditions(cdpSession, NETWORK_PRESETS.ONLINE);
}

/**
 * Test offline functionality with comprehensive checks
 * 
 * @param {Object} ctx - Context with page and cdpSession
 * @param {Object} options - Test options
 * @param {string[]} options.expectedElements - CSS selectors that should be visible offline
 * @param {string[]} options.expectedText - Text that should be visible offline
 * @param {string[]} options.expectedUrls - URLs that should work offline (navigate and check)
 * @param {boolean} options.skipReload - If true, don't reload the page (test current state)
 * @returns {Promise<Object>} Test result
 */
async function testOfflineMode(ctx, options = {}) {
  const { page, cdpSession } = ctx;
  const {
    expectedElements = ['body'],
    expectedText = [],
    expectedUrls = [],
    skipReload = false,
    timeout = 10000
  } = options;
  
  const results = {
    success: true,
    offlineCapable: false,
    elementChecks: [],
    textChecks: [],
    urlChecks: [],
    errors: []
  };
  
  // Store original URL to return to
  const originalUrl = page.url();
  
  try {
    // Go offline
    const offlineResult = await goOffline(cdpSession);
    if (!offlineResult.success) {
      results.errors.push(`Failed to go offline: ${offlineResult.error}`);
      results.success = false;
      return results;
    }
    
    console.log('[OfflineTester] Network set to offline');
    
    // Reload page if not skipping
    if (!skipReload) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        console.log('[OfflineTester] Page reloaded in offline mode');
      } catch (e) {
        // Page might not fully load offline, which is expected for some PWAs
        console.log('[OfflineTester] Page reload timeout (expected for offline):', e.message);
      }
    }
    
    // Small delay for service worker to handle request
    await page.waitForTimeout(1000);
    
    // Check expected elements are visible
    for (const selector of expectedElements) {
      try {
        const visible = await page.locator(selector).first().isVisible({ timeout: 5000 });
        results.elementChecks.push({
          selector,
          visible,
          passed: visible
        });
        
        if (!visible) {
          results.offlineCapable = false;
        }
      } catch (e) {
        results.elementChecks.push({
          selector,
          visible: false,
          passed: false,
          error: e.message
        });
      }
    }
    
    // Check expected text is visible
    for (const text of expectedText) {
      try {
        const visible = await page.getByText(text, { exact: false }).first()
          .isVisible({ timeout: 5000 });
        results.textChecks.push({
          text,
          visible,
          passed: visible
        });
        
        if (!visible) {
          results.offlineCapable = false;
        }
      } catch (e) {
        results.textChecks.push({
          text,
          visible: false,
          passed: false,
          error: e.message
        });
      }
    }
    
    // Check navigation to expected URLs works offline
    for (const url of expectedUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        
        // Check if we got a meaningful response (not a browser error page)
        const isErrorPage = await page.evaluate(() => {
          const body = document.body?.innerText || '';
          return body.includes('ERR_INTERNET_DISCONNECTED') ||
                 body.includes('No internet') ||
                 body.includes('Unable to connect') ||
                 document.title.includes('Error');
        });
        
        results.urlChecks.push({
          url,
          accessible: !isErrorPage,
          passed: !isErrorPage
        });
        
        if (isErrorPage) {
          results.offlineCapable = false;
        }
      } catch (e) {
        results.urlChecks.push({
          url,
          accessible: false,
          passed: false,
          error: e.message
        });
      }
    }
    
    // Determine overall offline capability
    const allElementsPassed = results.elementChecks.every(c => c.passed);
    const allTextPassed = results.textChecks.length === 0 || results.textChecks.every(c => c.passed);
    const allUrlsPassed = results.urlChecks.length === 0 || results.urlChecks.every(c => c.passed);
    
    results.offlineCapable = allElementsPassed && allTextPassed && allUrlsPassed;
    results.success = results.errors.length === 0;
    
    // Navigate back to original URL while still offline
    if (originalUrl && originalUrl !== page.url()) {
      try {
        await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout });
      } catch (e) {
        // Expected to potentially fail
      }
    }
    
  } finally {
    // Always restore online mode
    await goOnline(cdpSession);
    console.log('[OfflineTester] Network restored to online');
  }
  
  return results;
}

/**
 * Test offline to online sync behavior
 * 
 * @param {Object} ctx - Context with page and cdpSession
 * @param {Object} options - Test options
 * @param {Function} options.offlineAction - Action to perform while offline (e.g., form submission)
 * @param {Function} options.onlineVerification - Verification to perform after going online
 * @param {number} options.syncTimeout - Time to wait for sync after going online
 * @returns {Promise<Object>} Test result
 */
async function testOfflineSync(ctx, options = {}) {
  const { page, cdpSession } = ctx;
  const {
    offlineAction,
    onlineVerification,
    syncTimeout = 5000
  } = options;
  
  const results = {
    success: true,
    offlineActionCompleted: false,
    syncCompleted: false,
    errors: []
  };
  
  try {
    // Go offline
    await goOffline(cdpSession);
    console.log('[OfflineTester] Starting offline sync test');
    
    // Perform offline action
    if (offlineAction) {
      try {
        await offlineAction(page);
        results.offlineActionCompleted = true;
        console.log('[OfflineTester] Offline action completed');
      } catch (e) {
        results.offlineActionCompleted = false;
        results.errors.push(`Offline action failed: ${e.message}`);
      }
    }
    
    // Go online
    await goOnline(cdpSession);
    console.log('[OfflineTester] Network restored, waiting for sync...');
    
    // Wait for potential background sync
    await page.waitForTimeout(syncTimeout);
    
    // Verify sync
    if (onlineVerification) {
      try {
        const verified = await onlineVerification(page);
        results.syncCompleted = verified;
        console.log(`[OfflineTester] Sync verification: ${verified ? 'PASSED' : 'FAILED'}`);
      } catch (e) {
        results.syncCompleted = false;
        results.errors.push(`Sync verification failed: ${e.message}`);
      }
    } else {
      results.syncCompleted = true; // Assume success if no verification provided
    }
    
    results.success = results.offlineActionCompleted && results.syncCompleted;
    
  } catch (error) {
    results.success = false;
    results.errors.push(error.message);
  } finally {
    // Ensure we're online
    await goOnline(cdpSession);
  }
  
  return results;
}

/**
 * Check if page shows proper offline UI
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Options
 * @param {string[]} options.offlineIndicators - Selectors for offline indicators
 * @param {string[]} options.offlineText - Text indicating offline state
 * @returns {Promise<Object>} Result
 */
async function checkOfflineUI(page, options = {}) {
  const {
    offlineIndicators = [
      '[data-offline]',
      '.offline-indicator',
      '[class*="offline"]',
      '[aria-label*="offline" i]'
    ],
    offlineText = [
      'offline',
      'no connection',
      'no internet',
      'you are offline'
    ]
  } = options;
  
  const results = {
    hasOfflineIndicator: false,
    hasOfflineText: false,
    indicators: [],
    text: []
  };
  
  // Check for offline indicator elements
  for (const selector of offlineIndicators) {
    try {
      const visible = await page.locator(selector).first().isVisible({ timeout: 1000 });
      if (visible) {
        results.hasOfflineIndicator = true;
        results.indicators.push(selector);
      }
    } catch (e) {
      // Selector not found
    }
  }
  
  // Check for offline text
  for (const text of offlineText) {
    try {
      const visible = await page.getByText(text, { exact: false }).first()
        .isVisible({ timeout: 1000 });
      if (visible) {
        results.hasOfflineText = true;
        results.text.push(text);
      }
    } catch (e) {
      // Text not found
    }
  }
  
  return results;
}

module.exports = {
  setNetworkConditions,
  goOffline,
  goOnline,
  testOfflineMode,
  testOfflineSync,
  checkOfflineUI,
  NETWORK_PRESETS
};
