/**
 * IPC Handlers Index
 * 
 * Central registration point for all IPC handlers.
 * Import this module in index.js to register all handlers at once.
 */

const { registerBrowserHandlers } = require('./browser-handlers');
const { registerStorageHandlers } = require('./storage-handlers');
const { registerTestHandlers } = require('./test-handlers');
const { registerUtilityHandlers } = require('./utility-handlers');

/**
 * Register all IPC handlers
 * @param {Object} context - Application context with getters for all modules
 */
function registerAllHandlers(context) {
  console.log('[IPC] Registering all handlers...');
  
  registerBrowserHandlers(context);
  registerStorageHandlers(context);
  registerTestHandlers(context);
  registerUtilityHandlers(context);
  
  console.log('[IPC] All handlers registered');
}

module.exports = {
  registerAllHandlers,
  registerBrowserHandlers,
  registerStorageHandlers,
  registerTestHandlers,
  registerUtilityHandlers
};

