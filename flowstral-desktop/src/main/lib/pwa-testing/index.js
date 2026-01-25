/**
 * PWA Testing Module
 * 
 * Comprehensive Progressive Web App testing utilities.
 * Tests manifest validation, service workers, offline functionality, and cache storage.
 * 
 * @module pwa-testing
 * 
 * Usage:
 *   const PWATesting = require('./lib/pwa-testing');
 *   
 *   // Validate PWA manifest
 *   const manifestResult = await PWATesting.validateManifestFromPage(page);
 *   
 *   // Check service worker status
 *   const swStatus = await PWATesting.checkServiceWorkerStatus(page);
 *   
 *   // Test offline functionality
 *   const offlineResult = await PWATesting.testOfflineMode(ctx, { expectedElements: ['body'] });
 *   
 *   // Verify cached resources
 *   const cacheResult = await PWATesting.verifyCriticalResources(page);
 */

const ManifestValidator = require('./manifest-validator');
const ServiceWorkerUtils = require('./service-worker-utils');
const OfflineTester = require('./offline-tester');
const CacheVerifier = require('./cache-verifier');

/**
 * Run a comprehensive PWA audit
 * 
 * @param {Object} ctx - Execution context with page and cdpSession
 * @param {Object} options - Audit options
 * @returns {Promise<Object>} Complete PWA audit result
 */
async function runPWAAudit(ctx, options = {}) {
  const { page, cdpSession, context } = ctx;
  const {
    checkManifest = true,
    checkServiceWorker = true,
    checkOffline = true,
    checkCache = true,
    offlineExpectedElements = ['body'],
    offlineExpectedText = [],
    expectedCachedUrls = []
  } = options;
  
  console.log('[PWA Audit] Starting comprehensive PWA audit...');
  
  const results = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    score: 0,
    passed: false,
    categories: {}
  };
  
  let totalPoints = 0;
  let earnedPoints = 0;
  
  // 1. Manifest Validation (25 points)
  if (checkManifest) {
    totalPoints += 25;
    console.log('[PWA Audit] Checking manifest...');
    
    try {
      const manifestResult = await ManifestValidator.validateManifestFromPage(page);
      results.categories.manifest = manifestResult;
      
      if (manifestResult.valid) {
        earnedPoints += 25;
      } else if (manifestResult.manifestUrl) {
        // Partial points for having a manifest with issues
        earnedPoints += Math.round(manifestResult.score * 0.25);
      }
    } catch (e) {
      results.categories.manifest = { error: e.message };
    }
  }
  
  // 2. Service Worker (25 points)
  if (checkServiceWorker) {
    totalPoints += 25;
    console.log('[PWA Audit] Checking service worker...');
    
    try {
      const swResult = await ServiceWorkerUtils.checkServiceWorkerStatus(page);
      results.categories.serviceWorker = swResult;
      
      if (swResult.registered && swResult.ready) {
        earnedPoints += 25;
      } else if (swResult.registered) {
        earnedPoints += 15; // Partial points for registration without being ready
      }
    } catch (e) {
      results.categories.serviceWorker = { error: e.message };
    }
  }
  
  // 3. Offline Functionality (30 points)
  if (checkOffline && cdpSession) {
    totalPoints += 30;
    console.log('[PWA Audit] Testing offline functionality...');
    
    try {
      const offlineResult = await OfflineTester.testOfflineMode(ctx, {
        expectedElements: offlineExpectedElements,
        expectedText: offlineExpectedText
      });
      results.categories.offline = offlineResult;
      
      if (offlineResult.offlineCapable) {
        earnedPoints += 30;
      } else {
        // Partial points based on what elements loaded
        const elementsPassed = offlineResult.elementChecks?.filter(c => c.passed).length || 0;
        const totalElements = offlineResult.elementChecks?.length || 1;
        earnedPoints += Math.round((elementsPassed / totalElements) * 15);
      }
    } catch (e) {
      results.categories.offline = { error: e.message };
    }
  }
  
  // 4. Cache Storage (20 points)
  if (checkCache) {
    totalPoints += 20;
    console.log('[PWA Audit] Verifying cache storage...');
    
    try {
      const cacheResult = await CacheVerifier.verifyCriticalResources(page, {
        checkStyles: true,
        checkScripts: true
      });
      results.categories.cache = cacheResult;
      
      if (cacheResult.success) {
        const styleCoverage = cacheResult.checks?.styles?.percentage || 0;
        const scriptCoverage = cacheResult.checks?.scripts?.percentage || 0;
        const avgCoverage = (styleCoverage + scriptCoverage) / 2;
        earnedPoints += Math.round((avgCoverage / 100) * 20);
      }
      
      // Also check specific URLs if provided
      if (expectedCachedUrls.length > 0) {
        const urlResult = await CacheVerifier.verifyCachedUrls(page, expectedCachedUrls);
        results.categories.cachedUrls = urlResult;
      }
    } catch (e) {
      results.categories.cache = { error: e.message };
    }
  }
  
  // Calculate final score
  results.score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  results.passed = results.score >= 75;
  results.earnedPoints = earnedPoints;
  results.totalPoints = totalPoints;
  
  // Generate summary
  results.summary = generateAuditSummary(results);
  
  console.log(`[PWA Audit] Complete. Score: ${results.score}/100 (${results.passed ? 'PASSED' : 'FAILED'})`);
  
  return results;
}

/**
 * Generate human-readable audit summary
 */
function generateAuditSummary(results) {
  const summary = {
    status: results.passed ? 'PASS' : 'FAIL',
    score: results.score,
    checks: []
  };
  
  if (results.categories.manifest) {
    const m = results.categories.manifest;
    summary.checks.push({
      name: 'Web App Manifest',
      status: m.valid ? 'PASS' : (m.manifestUrl ? 'PARTIAL' : 'FAIL'),
      details: m.valid ? 'Manifest is valid' : 
               (m.manifestUrl ? `Found ${m.issues?.length || 0} issue(s)` : 'No manifest found')
    });
  }
  
  if (results.categories.serviceWorker) {
    const sw = results.categories.serviceWorker;
    summary.checks.push({
      name: 'Service Worker',
      status: sw.registered ? 'PASS' : 'FAIL',
      details: sw.registered ? 
               `${sw.count || 1} service worker(s) registered` : 
               'No service worker registered'
    });
  }
  
  if (results.categories.offline) {
    const o = results.categories.offline;
    summary.checks.push({
      name: 'Offline Capability',
      status: o.offlineCapable ? 'PASS' : 'FAIL',
      details: o.offlineCapable ? 'App works offline' : 'App does not work offline'
    });
  }
  
  if (results.categories.cache) {
    const c = results.categories.cache;
    const coverage = c.checks ? 
      Math.round(((c.checks.styles?.percentage || 0) + (c.checks.scripts?.percentage || 0)) / 2) : 0;
    summary.checks.push({
      name: 'Cache Storage',
      status: coverage >= 50 ? 'PASS' : (coverage > 0 ? 'PARTIAL' : 'FAIL'),
      details: `${coverage}% of critical resources cached`
    });
  }
  
  return summary;
}

/**
 * Check PWA installability criteria
 */
async function checkInstallability(page) {
  return ManifestValidator.checkInstallability(page);
}

// Export all functions
module.exports = {
  // Main audit function
  runPWAAudit,
  checkInstallability,
  
  // Manifest validation
  validateManifest: ManifestValidator.validateManifest,
  validateManifestFromPage: ManifestValidator.validateManifestFromPage,
  
  // Service worker utilities
  checkServiceWorkerStatus: ServiceWorkerUtils.checkServiceWorkerStatus,
  waitForServiceWorker: ServiceWorkerUtils.waitForServiceWorker,
  triggerServiceWorkerUpdate: ServiceWorkerUtils.triggerServiceWorkerUpdate,
  unregisterAllServiceWorkers: ServiceWorkerUtils.unregisterAllServiceWorkers,
  getContextServiceWorkers: ServiceWorkerUtils.getContextServiceWorkers,
  listenForServiceWorkers: ServiceWorkerUtils.listenForServiceWorkers,
  
  // Offline testing
  setNetworkConditions: OfflineTester.setNetworkConditions,
  goOffline: OfflineTester.goOffline,
  goOnline: OfflineTester.goOnline,
  testOfflineMode: OfflineTester.testOfflineMode,
  testOfflineSync: OfflineTester.testOfflineSync,
  checkOfflineUI: OfflineTester.checkOfflineUI,
  
  // Cache verification
  getCacheInfo: CacheVerifier.getCacheInfo,
  verifyCachedUrls: CacheVerifier.verifyCachedUrls,
  verifyCriticalResources: CacheVerifier.verifyCriticalResources,
  clearAllCaches: CacheVerifier.clearAllCaches,
  getCacheStorageUsage: CacheVerifier.getCacheStorageUsage,
  cacheExists: CacheVerifier.cacheExists,
  
  // Constants
  SW_STATES: ServiceWorkerUtils.SW_STATES,
  NETWORK_PRESETS: OfflineTester.NETWORK_PRESETS,
  COMMON_CACHE_PREFIXES: CacheVerifier.COMMON_CACHE_PREFIXES,
  REQUIRED_MANIFEST_FIELDS: ManifestValidator.REQUIRED_FIELDS,
  REQUIRED_ICON_SIZES: ManifestValidator.REQUIRED_ICON_SIZES
};
