/**
 * Utility IPC Handlers
 * 
 * Miscellaneous handlers:
 * - Navigation (views, routes)
 * - Configuration
 * - Licensing
 * - Updates
 * - External links
 * - DevTools
 */

const { ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

/**
 * Register all utility IPC handlers
 * @param {Object} context - Application context
 */
function registerUtilityHandlers(context) {
  const { 
    getMainWindow,
    getWebappView,
    getStore,
    getLicenseManager,
    getCloudConnector,
    showWebappView,
    showRecorderView,
    navigateWebapp,
    getCurrentView
  } = context;

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  ipcMain.handle('navigate-to', (event, route) => {
    navigateWebapp(route);
    return { success: true };
  });

  ipcMain.handle('show-webapp', () => {
    showWebappView();
    return { success: true };
  });

  ipcMain.handle('show-recorder', () => {
    showRecorderView();
    return { success: true };
  });

  ipcMain.handle('get-current-view', () => {
    return getCurrentView();
  });

  ipcMain.handle('focus-webapp', () => {
    const webappView = getWebappView();
    const mainWindow = getMainWindow();
    
    if (webappView?.webContents) {
      webappView.webContents.focus();
    }
    mainWindow?.focus();
    return { success: true };
  });

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  ipcMain.handle('get-config', () => {
    const store = getStore();
    return {
      serverUrl: store.get('serverUrl'),
      mode: store.get('mode'),
      preferences: store.get('preferences'),
      deviceId: store.get('deviceId')
    };
  });

  ipcMain.handle('set-config', (event, config) => {
    const store = getStore();
    if (config.serverUrl) store.set('serverUrl', config.serverUrl);
    if (config.mode) store.set('mode', config.mode);
    if (config.preferences) store.set('preferences', { ...store.get('preferences'), ...config.preferences });
    return { success: true };
  });

  // ============================================================================
  // LICENSING
  // ============================================================================

  ipcMain.handle('activate-license', async (event, licenseKey) => {
    const licenseManager = getLicenseManager();
    if (!licenseManager) {
      return { success: false, error: 'License manager not available' };
    }
    
    const result = await licenseManager.activate(licenseKey);
    return result;
  });

  ipcMain.handle('deactivate-license', async () => {
    const licenseManager = getLicenseManager();
    const result = await licenseManager?.deactivate();
    return result || { success: false };
  });

  ipcMain.handle('get-license-info', async () => {
    const licenseManager = getLicenseManager();
    return licenseManager?.getInfo() || null;
  });

  // ============================================================================
  // SERVER CONNECTION
  // ============================================================================

  ipcMain.handle('connect-server', async () => {
    const cloudConnector = getCloudConnector();
    if (!cloudConnector) {
      return { success: false, error: 'Cloud connector not available' };
    }
    
    try {
      await cloudConnector.connect();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('disconnect-server', async () => {
    const cloudConnector = getCloudConnector();
    await cloudConnector?.disconnect();
    return { success: true };
  });

  // ============================================================================
  // UPDATES
  // ============================================================================

  ipcMain.handle('check-updates', async () => {
    return autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // ============================================================================
  // EXTERNAL
  // ============================================================================

  ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
  });

  ipcMain.handle('open-devtools', () => {
    const webappView = getWebappView();
    webappView?.webContents.openDevTools({ mode: 'detach' });
  });

  console.log('[IPC] Utility handlers registered');
}

module.exports = { registerUtilityHandlers };

