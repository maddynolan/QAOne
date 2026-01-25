/**
 * IPC Handlers Index
 * 
 * Centralized registration of all IPC handlers.
 * Extracted from index.js for better maintainability.
 * 
 * USAGE in index.js:
 *   const { registerAllIPCHandlers } = require('./ipc');
 *   registerAllIPCHandlers({ getWebappView: () => webappView });
 */

const { registerRecorderHandlers } = require('./recorder-handlers');
const { registerMobileHandlers } = require('./mobile-handlers');
const { registerPWAHandlers } = require('./pwa-handlers');

/**
 * Register all IPC handlers
 * @param {object} deps - Dependencies
 * @param {function} deps.getWebappView - Function to get webappView
 * @returns {object} - Handler utilities { getRecorder }
 */
function registerAllIPCHandlers(deps) {
  console.log('[IPC] Registering all handlers...');
  
  // Register recorder handlers (returns getRecorder function)
  const { getRecorder } = registerRecorderHandlers(deps);
  
  // Register mobile handlers (needs recorder access)
  registerMobileHandlers({ ...deps, getRecorder });
  
  // Register PWA testing handlers (needs recorder access)
  registerPWAHandlers({ ...deps, getRecorder });
  
  console.log('[IPC] All handlers registered');
  
  return { getRecorder };
}

module.exports = {
  registerAllIPCHandlers,
  registerRecorderHandlers,
  registerMobileHandlers,
  registerPWAHandlers
};
