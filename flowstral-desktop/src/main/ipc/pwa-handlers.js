/**
 * PWA Testing IPC Handlers
 * 
 * IPC handlers for Progressive Web App testing functionality.
 * 
 * Channels:
 *   - pwa-audit: Run comprehensive PWA audit
 *   - pwa-check-manifest: Validate PWA manifest
 *   - pwa-check-service-worker: Check service worker status
 *   - pwa-wait-for-service-worker: Wait for service worker state
 *   - pwa-test-offline: Test offline functionality
 *   - pwa-check-cache: Verify cache storage
 *   - pwa-check-installability: Check PWA installability criteria
 *   - pwa-clear-caches: Clear all caches (for testing)
 *   - pwa-get-cache-info: Get detailed cache information
 */

const { ipcMain } = require('electron');

// Lazy load PWA testing module
let PWATesting = null;
const getPWATesting = () => {
  if (!PWATesting) {
    PWATesting = require('../lib/pwa-testing');
  }
  return PWATesting;
};

/**
 * Register all PWA testing IPC handlers
 * @param {object} deps - Dependencies
 * @param {function} deps.getRecorder - Function to get PlaywrightRecorder instance
 */
function registerPWAHandlers(deps) {
  const { getRecorder } = deps;
  
  console.log('[IPC] Registering PWA handlers...');
  
  /**
   * Run comprehensive PWA audit
   */
  ipcMain.handle('pwa-audit', async (event, options = {}) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      
      // Build context for PWA testing
      const ctx = {
        page: recorder.page,
        cdpSession: recorder.cdpSession || null,
        context: recorder.context || null
      };
      
      const result = await pwa.runPWAAudit(ctx, {
        checkManifest: options.checkManifest !== false,
        checkServiceWorker: options.checkServiceWorker !== false,
        checkOffline: options.checkOffline !== false && ctx.cdpSession,
        checkCache: options.checkCache !== false,
        offlineExpectedElements: options.expectedElements || ['body'],
        offlineExpectedText: options.expectedText || [],
        expectedCachedUrls: options.expectedCachedUrls || []
      });
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Audit failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Validate PWA manifest
   */
  ipcMain.handle('pwa-check-manifest', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.validateManifestFromPage(recorder.page);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Manifest check failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Check service worker status
   */
  ipcMain.handle('pwa-check-service-worker', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.checkServiceWorkerStatus(recorder.page);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Service worker check failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Wait for service worker to reach a specific state
   */
  ipcMain.handle('pwa-wait-for-service-worker', async (event, { state = 'activated', timeout = 30000 } = {}) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.waitForServiceWorker(recorder.page, state, timeout);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Wait for service worker failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Test offline functionality
   */
  ipcMain.handle('pwa-test-offline', async (event, options = {}) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      if (!recorder.cdpSession) {
        return { success: false, error: 'CDP session not available. Cannot simulate offline mode.' };
      }
      
      const pwa = getPWATesting();
      
      const ctx = {
        page: recorder.page,
        cdpSession: recorder.cdpSession
      };
      
      const result = await pwa.testOfflineMode(ctx, {
        expectedElements: options.expectedElements || ['body'],
        expectedText: options.expectedText || [],
        expectedUrls: options.expectedUrls || [],
        skipReload: options.skipReload || false,
        timeout: options.timeout || 10000
      });
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Offline test failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Check cache storage
   */
  ipcMain.handle('pwa-check-cache', async (event, options = {}) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      
      // Get cache info
      const cacheInfo = await pwa.getCacheInfo(recorder.page);
      
      // Verify critical resources if requested
      let resourceCheck = null;
      if (options.checkResources !== false) {
        resourceCheck = await pwa.verifyCriticalResources(recorder.page, {
          checkStyles: options.checkStyles !== false,
          checkScripts: options.checkScripts !== false,
          checkImages: options.checkImages || false,
          checkFonts: options.checkFonts || false
        });
      }
      
      // Verify specific URLs if provided
      let urlCheck = null;
      if (options.expectedUrls && options.expectedUrls.length > 0) {
        urlCheck = await pwa.verifyCachedUrls(recorder.page, options.expectedUrls);
      }
      
      return {
        success: true,
        cacheInfo,
        resourceCheck,
        urlCheck
      };
      
    } catch (error) {
      console.error('[PWA] Cache check failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Check PWA installability criteria
   */
  ipcMain.handle('pwa-check-installability', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.checkInstallability(recorder.page);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Installability check failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Clear all caches (useful for testing fresh state)
   */
  ipcMain.handle('pwa-clear-caches', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.clearAllCaches(recorder.page);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Clear caches failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Get detailed cache information
   */
  ipcMain.handle('pwa-get-cache-info', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const cacheInfo = await pwa.getCacheInfo(recorder.page);
      const storageUsage = await pwa.getCacheStorageUsage(recorder.page);
      
      return {
        success: true,
        caches: cacheInfo,
        storage: storageUsage
      };
      
    } catch (error) {
      console.error('[PWA] Get cache info failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Unregister all service workers (for testing clean state)
   */
  ipcMain.handle('pwa-unregister-service-workers', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.page) {
        return { success: false, error: 'No page available. Start recording first.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.unregisterAllServiceWorkers(recorder.page);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Unregister service workers failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Go offline (for manual testing)
   */
  ipcMain.handle('pwa-go-offline', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.cdpSession) {
        return { success: false, error: 'CDP session not available.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.goOffline(recorder.cdpSession);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Go offline failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  /**
   * Go online (restore network)
   */
  ipcMain.handle('pwa-go-online', async (event) => {
    try {
      const recorder = getRecorder();
      if (!recorder || !recorder.cdpSession) {
        return { success: false, error: 'CDP session not available.' };
      }
      
      const pwa = getPWATesting();
      const result = await pwa.goOnline(recorder.cdpSession);
      
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[PWA] Go online failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  console.log('[IPC] PWA handlers registered (12 channels)');
}

module.exports = {
  registerPWAHandlers
};
