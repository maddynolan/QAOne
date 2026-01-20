/**
 * Mobile Testing IPC Handlers
 * 
 * Handles all IPC messages for mobile device emulation and native testing.
 * Extracted from index.js for better maintainability.
 */

const { ipcMain } = require('electron');
const PlaywrightRecorder = require('../playwright-recorder');
const { MaestroIntegration } = require('../lib/maestro-integration');

/**
 * Register all mobile testing IPC handlers
 * @param {object} deps - Dependencies
 * @param {function} deps.getRecorder - Function to get PlaywrightRecorder instance
 */
function registerMobileHandlers(deps) {
  const { getRecorder } = deps;
  
  // Get available mobile devices
  ipcMain.handle('mobile-get-devices', async () => {
    try {
      return {
        success: true,
        ...PlaywrightRecorder.getAvailableDevices()
      };
    } catch (error) {
      console.error('[Mobile] Failed to get devices:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Set mobile device for recording
  ipcMain.handle('mobile-set-device', async (event, { deviceName, network }) => {
    try {
      const recorder = getRecorder();
      if (!recorder) {
        return { success: false, error: 'Recorder not initialized' };
      }
      
      const deviceConfig = recorder.setMobileDevice(deviceName);
      if (!deviceConfig) {
        return { success: false, error: `Unknown device: ${deviceName}` };
      }
      
      if (network) {
        recorder.setMobileNetwork(network);
      }
      
      return { 
        success: true, 
        device: deviceConfig,
        network: recorder.getMobileConfig()?.network
      };
    } catch (error) {
      console.error('[Mobile] Set device failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Get current mobile configuration
  ipcMain.handle('mobile-get-config', async () => {
    try {
      const recorder = getRecorder();
      if (!recorder) {
        return { success: true, config: null };
      }
      
      return {
        success: true,
        config: recorder.getMobileConfig(),
        isActive: recorder.isInMobileMode()
      };
    } catch (error) {
      console.error('[Mobile] Get config failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Clear mobile device (return to desktop mode)
  ipcMain.handle('mobile-clear-device', async () => {
    try {
      const recorder = getRecorder();
      if (!recorder) {
        return { success: true };
      }
      
      recorder.clearMobileDevice();
      return { success: true };
    } catch (error) {
      console.error('[Mobile] Clear device failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Check if Maestro is available
  ipcMain.handle('mobile-check-maestro', async () => {
    try {
      const available = await MaestroIntegration.checkMaestro();
      return { success: true, available };
    } catch (error) {
      console.error('[Mobile] Maestro check failed:', error.message);
      return { success: false, available: false, error: error.message };
    }
  });
  
  // Run native mobile test via Maestro
  ipcMain.handle('mobile-run-native-test', async (event, { steps, appId, platform, deviceId }) => {
    try {
      console.log('[Mobile] Running native test:', { appId, platform, deviceId, stepCount: steps?.length });
      
      const result = await MaestroIntegration.runTest({
        steps,
        appId,
        platform,
        deviceId
      });
      
      return { success: true, result };
    } catch (error) {
      console.error('[Mobile] Native test failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Get available native devices
  ipcMain.handle('mobile-get-native-devices', async (event, platform) => {
    try {
      const devices = await MaestroIntegration.getConnectedDevices(platform);
      return { success: true, devices };
    } catch (error) {
      console.error('[Mobile] Get native devices failed:', error.message);
      return { success: false, devices: [], error: error.message };
    }
  });
}

module.exports = { registerMobileHandlers };
