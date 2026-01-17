/**
 * Shell Preload Script
 * 
 * Bridge between the navigation shell (renderer) and main process.
 * Provides APIs for navigation, view switching, and status monitoring.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the shell renderer
contextBridge.exposeInMainWorld('flowstral', {
  // Navigation
  navigateTo: (route) => ipcRenderer.invoke('navigate-to', route),
  showWebapp: () => ipcRenderer.invoke('show-webapp'),
  showRecorder: () => ipcRenderer.invoke('show-recorder'),
  getCurrentView: () => ipcRenderer.invoke('get-current-view'),
  
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  
  // License
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  
  // Server connection
  connectServer: () => ipcRenderer.invoke('connect-server'),
  disconnectServer: () => ipcRenderer.invoke('disconnect-server'),
  
  // Embedded Browser (Recorder) - LEGACY, kept for compatibility
  embeddedBrowser: {
    show: (bounds) => ipcRenderer.invoke('embedded-browser-show', bounds),
    hide: () => ipcRenderer.invoke('embedded-browser-hide'),
    navigate: (url) => ipcRenderer.invoke('embedded-browser-navigate', url),
    startRecording: () => ipcRenderer.invoke('embedded-browser-start-recording'),
    stopRecording: () => ipcRenderer.invoke('embedded-browser-stop-recording'),
    getActions: () => ipcRenderer.invoke('embedded-browser-get-actions'),
    clearActions: () => ipcRenderer.invoke('embedded-browser-clear-actions'),
    back: () => ipcRenderer.invoke('embedded-browser-back'),
    forward: () => ipcRenderer.invoke('embedded-browser-forward'),
    refresh: () => ipcRenderer.invoke('embedded-browser-refresh'),
    resize: (bounds) => ipcRenderer.invoke('embedded-browser-resize', bounds),
    suggest: () => ipcRenderer.invoke('embedded-browser-suggest')
  },
  
  // Playwright Recorder (Standalone Browser - RECOMMENDED)
  // Opens a separate browser window for recording
  // Uses EXACT SAME recorder-engine.js as browser extension
  playwrightRecorder: {
    start: (url) => ipcRenderer.invoke('playwright-recorder-start', url),
    stop: () => ipcRenderer.invoke('playwright-recorder-stop'),
    pause: () => ipcRenderer.invoke('playwright-recorder-pause'),
    resume: () => ipcRenderer.invoke('playwright-recorder-resume'),
    getActions: () => ipcRenderer.invoke('playwright-recorder-get-actions'),
    clearActions: () => ipcRenderer.invoke('playwright-recorder-clear-actions'),
    isRecording: () => ipcRenderer.invoke('playwright-recorder-is-recording'),
    isPaused: () => ipcRenderer.invoke('playwright-recorder-is-paused'),
    analyze: () => ipcRenderer.invoke('playwright-recorder-analyze'),
    executeAction: (action) => ipcRenderer.invoke('playwright-recorder-execute-action', action),
    addManualAction: (action) => ipcRenderer.invoke('playwright-recorder-add-manual-action', action)
  },
  
  // Mobile Testing
  // 50+ device profiles with network simulation
  mobile: {
    // Get available devices for UI dropdown
    getDevices: () => ipcRenderer.invoke('mobile-get-devices'),
    // Set mobile device for recording/testing
    setDevice: (deviceName, network) => ipcRenderer.invoke('mobile-set-device', { deviceName, network }),
    // Get current mobile configuration
    getConfig: () => ipcRenderer.invoke('mobile-get-config'),
    // Clear mobile device (return to desktop mode)
    clearDevice: () => ipcRenderer.invoke('mobile-clear-device'),
    // Check Maestro installation
    checkMaestro: () => ipcRenderer.invoke('mobile-check-maestro'),
    // Run native app test via Maestro
    runNativeTest: (options) => ipcRenderer.invoke('mobile-run-native-test', options),
    // Get native devices (emulators/simulators)
    getNativeDevices: (platform) => ipcRenderer.invoke('mobile-get-native-devices', platform),
    // Maestro Studio - Interactive recorder for native apps
    startStudio: (deviceId) => ipcRenderer.invoke('mobile-start-studio', { deviceId }),
    stopStudio: () => ipcRenderer.invoke('mobile-stop-studio'),
    getStudioStatus: () => ipcRenderer.invoke('mobile-studio-status')
  },
  
  // Test Export
  export: {
    flowstralTest: (testName) => ipcRenderer.invoke('export-flowstral-test', testName),
    robotFramework: (testName) => ipcRenderer.invoke('export-robot-framework', testName),
    playwright: () => ipcRenderer.invoke('export-playwright'),
    toTestBuilder: (testName) => ipcRenderer.invoke('export-to-test-builder', testName)
  },
  
  // Updates
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // Utilities
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'action-recorded',
      'screenshot',
      'recording-status',
      'execution-status',
      'step-status',
      'step-result',
      'connection-status',
      'license-status',
      'update-available',
      'update-downloaded',
      'update-error',
      'error',
      'navigate',
      'view-changed',
      'webapp-url-changed',
      'browser-url-changed',
      'playwright-recorder-action',
      'playwright-recorder-stopped',
      'playwright-recorder-paused',
      'playwright-recorder-resumed',
      'playwright-recorder-suggestions',
      'playwright-recorder-navigation',
      // AI Explorer Agent channels
      'ai-explorer-progress',
      'ai-explorer-action',
      'ai-explorer-test-discovered',
      'ai-explorer-error',
      'ai-explorer-state-change',
      // Mobile testing channels
      'mobile-native-test-step',
      'mobile-native-test-progress',
      'mobile-native-test-error'
    ];
    
    // Store listeners for explicit removal
    const listeners = new Map();
    
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Store for explicit removal
      const key = `${channel}-${callback.toString().substring(0, 50)}`;
      listeners.set(key, { channel, subscription });
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
        listeners.delete(key);
      };
    }
  },
  
  // Explicit listener removal
  off: (channel, callback) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // One-time event listener
  once: (channel, callback) => {
    ipcRenderer.once(channel, (event, ...args) => callback(...args));
  }
});

// Provide platform info
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  isElectron: true,
  version: process.versions.electron
});

console.log('[Shell Preload] APIs exposed');
