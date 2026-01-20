/**
 * Playwright Recorder IPC Handlers
 * 
 * Handles all IPC messages for the Playwright recorder functionality.
 * Extracted from index.js for better maintainability.
 */

const { ipcMain } = require('electron');
const PlaywrightRecorder = require('../playwright-recorder');

/**
 * Register all Playwright recorder IPC handlers
 * @param {object} deps - Dependencies
 * @param {function} deps.getWebappView - Function to get webappView
 */
function registerRecorderHandlers(deps) {
  const { getWebappView } = deps;
  
  // Singleton instance
  let playwrightRecorder = null;
  
  /**
   * Create or get the recorder instance
   */
  function getRecorder() {
    return playwrightRecorder;
  }
  
  /**
   * Ensure recorder exists with event forwarding
   */
  function ensureRecorder() {
    if (!playwrightRecorder) {
      playwrightRecorder = new PlaywrightRecorder();
      
      // Forward events to webappView
      playwrightRecorder.on('action', (action) => {
        console.log('[PlaywrightRecorder] Forwarding action to webapp:', action.description);
        getWebappView()?.webContents.send('playwright-recorder-action', action);
      });
      
      playwrightRecorder.on('stopped', ({ actions }) => {
        console.log('[PlaywrightRecorder] Forwarding stopped event, actions:', actions?.length);
        getWebappView()?.webContents.send('playwright-recorder-stopped', { actions });
      });
      
      playwrightRecorder.on('paused', () => {
        console.log('[PlaywrightRecorder] Forwarding paused event');
        getWebappView()?.webContents.send('playwright-recorder-paused');
      });
      
      playwrightRecorder.on('crossOriginTab', (data) => {
        console.log('[PlaywrightRecorder] Cross-origin tab detected:', data.url);
        getWebappView()?.webContents.send('playwright-recorder-cross-origin', data);
      });
      
      playwrightRecorder.on('resumed', () => {
        console.log('[PlaywrightRecorder] Forwarding resumed event');
        getWebappView()?.webContents.send('playwright-recorder-resumed');
      });
      
      playwrightRecorder.on('suggestions', ({ suggestions }) => {
        console.log('[PlaywrightRecorder] Auto-refresh suggestions:', suggestions?.length);
        getWebappView()?.webContents.send('playwright-recorder-suggestions', { suggestions });
      });
      
      playwrightRecorder.on('navigation', ({ url }) => {
        console.log('[PlaywrightRecorder] Navigation detected:', url);
        getWebappView()?.webContents.send('playwright-recorder-navigation', { url });
      });
    }
    return playwrightRecorder;
  }
  
  // Start recording
  ipcMain.handle('playwright-recorder-start', async (event, arg) => {
    try {
      let actualUrl, device, network;
      
      if (typeof arg === 'string') {
        actualUrl = arg;
        device = null;
        network = null;
      } else if (arg && typeof arg === 'object') {
        actualUrl = arg.url;
        device = arg.mobileDevice;
        network = arg.mobileNetwork;
      } else {
        throw new Error('Invalid argument: expected URL string or options object');
      }
      
      console.log('[PlaywrightRecorder] Starting with URL:', actualUrl);
      if (device) console.log('[PlaywrightRecorder] Mobile device:', device);
      if (network) console.log('[PlaywrightRecorder] Network:', network);
      
      const recorder = ensureRecorder();
      
      if (device) {
        recorder.setMobileDevice(device);
      } else {
        recorder.clearMobileDevice();
      }
      
      if (network) {
        recorder.setMobileNetwork(network);
      }
      
      await recorder.start(actualUrl);
      
      const mobileConfig = recorder.getMobileConfig();
      getWebappView()?.webContents.send('recording-status', { 
        recording: true, 
        mode: 'playwright',
        mobile: mobileConfig
      });
      return { success: true, mobile: mobileConfig };
    } catch (error) {
      console.error('[PlaywrightRecorder] Start failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Stop recording
  ipcMain.handle('playwright-recorder-stop', async () => {
    try {
      if (!playwrightRecorder) return { success: false, actions: [] };
      
      const result = await playwrightRecorder.stop();
      getWebappView()?.webContents.send('recording-status', { recording: false, mode: 'playwright' });
      return { success: true, actions: result.actions };
    } catch (error) {
      console.error('[PlaywrightRecorder] Stop failed:', error.message);
      return { success: false, error: error.message, actions: [] };
    }
  });
  
  // Get recorded actions
  ipcMain.handle('playwright-recorder-get-actions', () => {
    return playwrightRecorder?.getActions() || [];
  });
  
  // Clear actions
  ipcMain.handle('playwright-recorder-clear-actions', () => {
    playwrightRecorder?.clearActions();
    return true;
  });
  
  // Check if recording
  ipcMain.handle('playwright-recorder-is-recording', () => {
    return playwrightRecorder?.isRecording() || false;
  });
  
  // Pause recording
  ipcMain.handle('playwright-recorder-pause', () => {
    if (!playwrightRecorder) return { success: false, error: 'Recorder not started' };
    return playwrightRecorder.pause();
  });
  
  // Resume recording
  ipcMain.handle('playwright-recorder-resume', () => {
    if (!playwrightRecorder) return { success: false, error: 'Recorder not started' };
    return playwrightRecorder.resume();
  });
  
  // Check if paused
  ipcMain.handle('playwright-recorder-is-paused', () => {
    return playwrightRecorder?.isPaused() || false;
  });
  
  // Add manual action
  ipcMain.handle('playwright-recorder-add-manual-action', async (event, action) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return playwrightRecorder.addManualAction(action);
  });
  
  // Analyze page
  ipcMain.handle('playwright-recorder-analyze', async () => {
    if (!playwrightRecorder) {
      return { success: false, suggestions: [], error: 'Recorder not started' };
    }
    return await playwrightRecorder.analyzePage();
  });
  
  // Execute action
  ipcMain.handle('playwright-recorder-execute-action', async (event, action) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return await playwrightRecorder.executeAction(action);
  });
  
  // Run test
  ipcMain.handle('playwright-recorder-run-test', async (event, options) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    
    try {
      const result = await playwrightRecorder.runTest(options);
      return result;
    } catch (error) {
      console.error('[PlaywrightRecorder] Run test failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Pause test
  ipcMain.handle('playwright-recorder-pause-test', async () => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return playwrightRecorder.pauseTest();
  });
  
  // Resume test
  ipcMain.handle('playwright-recorder-resume-test', async (event, options) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return playwrightRecorder.resumeTest(options);
  });
  
  // Skip step
  ipcMain.handle('playwright-recorder-skip-step', async (event, options) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return playwrightRecorder.skipStep(options);
  });
  
  // Retry step
  ipcMain.handle('playwright-recorder-retry-step', async (event, options) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    return await playwrightRecorder.retryStep(options);
  });
  
  // Stop test
  ipcMain.handle('playwright-recorder-stop-test', async (event, options) => {
    if (!playwrightRecorder) {
      return { success: false, error: 'Recorder not started' };
    }
    
    try {
      return await playwrightRecorder.stopTest(options);
    } catch (error) {
      console.error('[PlaywrightRecorder] Stop test failed:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Return getter for recorder instance (for other parts of the app that need it)
  return { getRecorder };
}

module.exports = { registerRecorderHandlers };
