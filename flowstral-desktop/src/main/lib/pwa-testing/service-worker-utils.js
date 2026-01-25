/**
 * Service Worker Utilities
 * 
 * Detection, status checking, and lifecycle management for PWA service workers.
 * 
 * @module pwa-testing/service-worker-utils
 */

/**
 * Service worker states
 */
const SW_STATES = {
  INSTALLING: 'installing',
  INSTALLED: 'installed',
  ACTIVATING: 'activating',
  ACTIVATED: 'activated',
  REDUNDANT: 'redundant'
};

/**
 * Check if service workers are supported and get registration status
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Service worker status
 */
async function checkServiceWorkerStatus(page) {
  try {
    const status = await page.evaluate(async () => {
      // Check support
      if (!('serviceWorker' in navigator)) {
        return {
          supported: false,
          registered: false,
          error: 'Service Workers not supported in this browser'
        };
      }
      
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length === 0) {
          return {
            supported: true,
            registered: false,
            registrations: []
          };
        }
        
        // Get detailed info for each registration
        const registrationDetails = registrations.map(reg => {
          const activeWorker = reg.active;
          const waitingWorker = reg.waiting;
          const installingWorker = reg.installing;
          
          return {
            scope: reg.scope,
            updateViaCache: reg.updateViaCache,
            active: activeWorker ? {
              state: activeWorker.state,
              scriptURL: activeWorker.scriptURL
            } : null,
            waiting: waitingWorker ? {
              state: waitingWorker.state,
              scriptURL: waitingWorker.scriptURL
            } : null,
            installing: installingWorker ? {
              state: installingWorker.state,
              scriptURL: installingWorker.scriptURL
            } : null
          };
        });
        
        // Get controller info
        const controller = navigator.serviceWorker.controller;
        
        return {
          supported: true,
          registered: true,
          count: registrations.length,
          registrations: registrationDetails,
          controller: controller ? {
            state: controller.state,
            scriptURL: controller.scriptURL
          } : null,
          ready: !!controller
        };
        
      } catch (e) {
        return {
          supported: true,
          registered: false,
          error: e.message
        };
      }
    });
    
    return {
      success: true,
      ...status
    };
    
  } catch (error) {
    return {
      success: false,
      supported: false,
      registered: false,
      error: error.message
    };
  }
}

/**
 * Wait for a service worker to reach a specific state
 * 
 * @param {Page} page - Playwright page object
 * @param {string} targetState - Target state to wait for (activated, installed, etc.)
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Result with success flag
 */
async function waitForServiceWorker(page, targetState = 'activated', timeout = 30000) {
  const startTime = Date.now();
  
  try {
    const result = await page.evaluate(async ({ targetState, timeout }) => {
      if (!('serviceWorker' in navigator)) {
        return { success: false, error: 'Service Workers not supported' };
      }
      
      return new Promise(async (resolve) => {
        const checkState = async () => {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            
            for (const reg of registrations) {
              const worker = reg.active || reg.waiting || reg.installing;
              
              if (worker && worker.state === targetState) {
                resolve({
                  success: true,
                  state: worker.state,
                  scope: reg.scope,
                  scriptURL: worker.scriptURL
                });
                return true;
              }
              
              // For 'activated' target, also check if controller is ready
              if (targetState === 'activated' && reg.active && reg.active.state === 'activated') {
                resolve({
                  success: true,
                  state: 'activated',
                  scope: reg.scope,
                  scriptURL: reg.active.scriptURL
                });
                return true;
              }
            }
            
            return false;
          } catch (e) {
            return false;
          }
        };
        
        // Check immediately
        if (await checkState()) return;
        
        // Poll with interval
        const interval = setInterval(async () => {
          if (Date.now() - performance.now() > timeout) {
            clearInterval(interval);
            resolve({ success: false, error: `Timeout waiting for service worker state: ${targetState}` });
            return;
          }
          
          if (await checkState()) {
            clearInterval(interval);
          }
        }, 500);
        
        // Also listen for state changes
        navigator.serviceWorker.addEventListener('controllerchange', async () => {
          if (await checkState()) {
            clearInterval(interval);
          }
        });
        
        // Timeout failsafe
        setTimeout(() => {
          clearInterval(interval);
          resolve({ success: false, error: `Timeout waiting for service worker state: ${targetState}` });
        }, timeout);
      });
    }, { targetState, timeout });
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Trigger a service worker update check
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Update result
 */
async function triggerServiceWorkerUpdate(page) {
  try {
    const result = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { success: false, error: 'Service Workers not supported' };
      }
      
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length === 0) {
          return { success: false, error: 'No service worker registered' };
        }
        
        const updateResults = await Promise.all(
          registrations.map(async (reg) => {
            try {
              const updatedReg = await reg.update();
              return {
                scope: reg.scope,
                updated: true,
                hasWaiting: !!updatedReg.waiting
              };
            } catch (e) {
              return {
                scope: reg.scope,
                updated: false,
                error: e.message
              };
            }
          })
        );
        
        return {
          success: true,
          updates: updateResults
        };
        
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unregister all service workers (useful for testing clean state)
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Unregister result
 */
async function unregisterAllServiceWorkers(page) {
  try {
    const result = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { success: true, count: 0, message: 'Service Workers not supported' };
      }
      
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        const unregisterResults = await Promise.all(
          registrations.map(async (reg) => {
            const scope = reg.scope;
            const success = await reg.unregister();
            return { scope, success };
          })
        );
        
        return {
          success: true,
          count: unregisterResults.length,
          results: unregisterResults
        };
        
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get service worker from Playwright context (for advanced testing)
 * 
 * @param {BrowserContext} context - Playwright browser context
 * @returns {Promise<Object>} Service worker info
 */
async function getContextServiceWorkers(context) {
  try {
    const workers = context.serviceWorkers();
    
    if (workers.length === 0) {
      return {
        success: true,
        count: 0,
        workers: []
      };
    }
    
    const workerDetails = await Promise.all(
      workers.map(async (worker) => {
        try {
          const url = worker.url();
          return {
            url,
            type: 'serviceWorker'
          };
        } catch (e) {
          return { error: e.message };
        }
      })
    );
    
    return {
      success: true,
      count: workers.length,
      workers: workerDetails
    };
    
  } catch (error) {
    return {
      success: false,
      count: 0,
      workers: [],
      error: error.message
    };
  }
}

/**
 * Listen for service worker events via context
 * 
 * @param {BrowserContext} context - Playwright browser context
 * @param {Function} onWorker - Callback when service worker is registered
 * @returns {Function} Cleanup function to remove listener
 */
function listenForServiceWorkers(context, onWorker) {
  const handler = (worker) => {
    onWorker({
      url: worker.url(),
      timestamp: Date.now()
    });
  };
  
  context.on('serviceworker', handler);
  
  return () => {
    context.off('serviceworker', handler);
  };
}

module.exports = {
  checkServiceWorkerStatus,
  waitForServiceWorker,
  triggerServiceWorkerUpdate,
  unregisterAllServiceWorkers,
  getContextServiceWorkers,
  listenForServiceWorkers,
  SW_STATES
};
