/**
 * PWA Cache Verifier
 * 
 * Verify Cache Storage contents for PWA testing.
 * Check if critical resources are cached for offline use.
 * 
 * @module pwa-testing/cache-verifier
 */

/**
 * Common cache names used by popular frameworks
 */
const COMMON_CACHE_PREFIXES = [
  'workbox-',
  'sw-precache-',
  'gatsby-',
  'next-',
  'create-react-app-',
  'angular-',
  'vue-',
  'nuxt-'
];

/**
 * Get all cache storage information
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Cache information
 */
async function getCacheInfo(page) {
  try {
    const cacheInfo = await page.evaluate(async () => {
      if (!('caches' in self)) {
        return { supported: false, error: 'Cache API not supported' };
      }
      
      try {
        const cacheNames = await caches.keys();
        const cacheDetails = [];
        let totalSize = 0;
        let totalEntries = 0;
        
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          
          const entries = keys.map(request => ({
            url: request.url,
            method: request.method
          }));
          
          cacheDetails.push({
            name: cacheName,
            entryCount: keys.length,
            entries: entries.slice(0, 50) // Limit to 50 entries per cache for performance
          });
          
          totalEntries += keys.length;
        }
        
        return {
          supported: true,
          cacheCount: cacheNames.length,
          cacheNames,
          totalEntries,
          caches: cacheDetails
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    });
    
    return {
      success: true,
      ...cacheInfo
    };
    
  } catch (error) {
    return {
      success: false,
      supported: false,
      error: error.message
    };
  }
}

/**
 * Check if specific URLs are cached
 * 
 * @param {Page} page - Playwright page object
 * @param {string[]} urls - URLs to check (can be partial matches)
 * @returns {Promise<Object>} Verification result
 */
async function verifyCachedUrls(page, urls) {
  try {
    const result = await page.evaluate(async (urls) => {
      if (!('caches' in self)) {
        return { supported: false, error: 'Cache API not supported' };
      }
      
      try {
        const cacheNames = await caches.keys();
        const cachedUrls = new Set();
        
        // Collect all cached URLs
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          
          for (const request of keys) {
            cachedUrls.add(request.url);
          }
        }
        
        // Check each expected URL
        const urlChecks = urls.map(expectedUrl => {
          // Check for exact match or partial match
          const found = [...cachedUrls].some(cachedUrl => {
            if (expectedUrl.startsWith('http')) {
              return cachedUrl === expectedUrl;
            }
            // Partial match
            return cachedUrl.includes(expectedUrl);
          });
          
          return {
            url: expectedUrl,
            cached: found
          };
        });
        
        const allCached = urlChecks.every(c => c.cached);
        
        return {
          supported: true,
          allCached,
          checks: urlChecks,
          totalCached: cachedUrls.size
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    }, urls);
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify critical resources are cached (CSS, JS, images, etc.)
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Verification options
 * @param {boolean} options.checkStyles - Check for cached stylesheets
 * @param {boolean} options.checkScripts - Check for cached JavaScript
 * @param {boolean} options.checkImages - Check for cached images
 * @param {boolean} options.checkFonts - Check for cached fonts
 * @returns {Promise<Object>} Verification result
 */
async function verifyCriticalResources(page, options = {}) {
  const {
    checkStyles = true,
    checkScripts = true,
    checkImages = false,
    checkFonts = false
  } = options;
  
  try {
    const result = await page.evaluate(async ({ checkStyles, checkScripts, checkImages, checkFonts }) => {
      if (!('caches' in self)) {
        return { supported: false, error: 'Cache API not supported' };
      }
      
      try {
        const cacheNames = await caches.keys();
        const cachedResources = {
          styles: [],
          scripts: [],
          images: [],
          fonts: [],
          other: []
        };
        
        // Collect all cached resources
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          
          for (const request of keys) {
            const url = request.url.toLowerCase();
            
            if (url.endsWith('.css') || url.includes('stylesheet')) {
              cachedResources.styles.push(request.url);
            } else if (url.endsWith('.js') || url.includes('javascript')) {
              cachedResources.scripts.push(request.url);
            } else if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url)) {
              cachedResources.images.push(request.url);
            } else if (/\.(woff|woff2|ttf|otf|eot)$/.test(url)) {
              cachedResources.fonts.push(request.url);
            } else {
              cachedResources.other.push(request.url);
            }
          }
        }
        
        // Get resources from the page
        const pageResources = {
          styles: [],
          scripts: []
        };
        
        // Get stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (link.href) pageResources.styles.push(link.href);
        });
        
        // Get scripts
        document.querySelectorAll('script[src]').forEach(script => {
          if (script.src) pageResources.scripts.push(script.src);
        });
        
        // Check coverage
        const checks = {};
        
        if (checkStyles) {
          const stylesCached = pageResources.styles.filter(url => 
            cachedResources.styles.some(cached => cached.includes(url) || url.includes(cached))
          );
          checks.styles = {
            total: pageResources.styles.length,
            cached: stylesCached.length,
            percentage: pageResources.styles.length > 0 
              ? Math.round((stylesCached.length / pageResources.styles.length) * 100)
              : 100,
            missing: pageResources.styles.filter(url => 
              !cachedResources.styles.some(cached => cached.includes(url) || url.includes(cached))
            ).slice(0, 10)
          };
        }
        
        if (checkScripts) {
          const scriptsCached = pageResources.scripts.filter(url => 
            cachedResources.scripts.some(cached => cached.includes(url) || url.includes(cached))
          );
          checks.scripts = {
            total: pageResources.scripts.length,
            cached: scriptsCached.length,
            percentage: pageResources.scripts.length > 0
              ? Math.round((scriptsCached.length / pageResources.scripts.length) * 100)
              : 100,
            missing: pageResources.scripts.filter(url =>
              !cachedResources.scripts.some(cached => cached.includes(url) || url.includes(cached))
            ).slice(0, 10)
          };
        }
        
        if (checkImages) {
          checks.images = {
            cached: cachedResources.images.length
          };
        }
        
        if (checkFonts) {
          checks.fonts = {
            cached: cachedResources.fonts.length
          };
        }
        
        return {
          supported: true,
          checks,
          summary: {
            totalCaches: cacheNames.length,
            totalCachedResources: 
              cachedResources.styles.length + 
              cachedResources.scripts.length + 
              cachedResources.images.length + 
              cachedResources.fonts.length + 
              cachedResources.other.length
          }
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    }, { checkStyles, checkScripts, checkImages, checkFonts });
    
    // Determine success based on coverage
    let success = true;
    if (result.checks?.styles && result.checks.styles.percentage < 50) success = false;
    if (result.checks?.scripts && result.checks.scripts.percentage < 50) success = false;
    
    return {
      success,
      ...result
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clear all caches (useful for testing fresh cache state)
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Clear result
 */
async function clearAllCaches(page) {
  try {
    const result = await page.evaluate(async () => {
      if (!('caches' in self)) {
        return { supported: false, error: 'Cache API not supported' };
      }
      
      try {
        const cacheNames = await caches.keys();
        const deleteResults = await Promise.all(
          cacheNames.map(async (name) => {
            const deleted = await caches.delete(name);
            return { name, deleted };
          })
        );
        
        return {
          supported: true,
          cleared: deleteResults.length,
          results: deleteResults
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    });
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get cache storage usage (quota and usage)
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Storage usage info
 */
async function getCacheStorageUsage(page) {
  try {
    const result = await page.evaluate(async () => {
      if (!('storage' in navigator && 'estimate' in navigator.storage)) {
        return { supported: false, error: 'Storage API not supported' };
      }
      
      try {
        const estimate = await navigator.storage.estimate();
        
        return {
          supported: true,
          usage: estimate.usage,
          quota: estimate.quota,
          usageInMB: Math.round(estimate.usage / 1024 / 1024 * 100) / 100,
          quotaInMB: Math.round(estimate.quota / 1024 / 1024 * 100) / 100,
          percentUsed: Math.round((estimate.usage / estimate.quota) * 10000) / 100,
          usageDetails: estimate.usageDetails || null
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    });
    
    return {
      success: true,
      ...result
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a specific cache exists
 * 
 * @param {Page} page - Playwright page object
 * @param {string} cacheName - Name of the cache to check
 * @returns {Promise<Object>} Check result
 */
async function cacheExists(page, cacheName) {
  try {
    const result = await page.evaluate(async (cacheName) => {
      if (!('caches' in self)) {
        return { supported: false, error: 'Cache API not supported' };
      }
      
      try {
        const exists = await caches.has(cacheName);
        
        if (exists) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          return {
            supported: true,
            exists: true,
            entryCount: keys.length
          };
        }
        
        return {
          supported: true,
          exists: false
        };
        
      } catch (e) {
        return { supported: true, error: e.message };
      }
    }, cacheName);
    
    return {
      success: true,
      cacheName,
      ...result
    };
    
  } catch (error) {
    return {
      success: false,
      cacheName,
      error: error.message
    };
  }
}

module.exports = {
  getCacheInfo,
  verifyCachedUrls,
  verifyCriticalResources,
  clearAllCaches,
  getCacheStorageUsage,
  cacheExists,
  COMMON_CACHE_PREFIXES
};
