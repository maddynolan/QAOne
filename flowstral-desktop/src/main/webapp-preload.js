/**
 * Webapp Preload Script
 * 
 * Provides bridge between embedded React webapp and Electron main process.
 * This allows the webapp to access native features when running in Electron.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Event listeners map for cleanup
const eventListeners = new Map();

// Expose Electron APIs to the React webapp
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,
  
  // Navigation
  navigateTo: (route) => ipcRenderer.invoke('navigate-to', route),
  showWebapp: () => ipcRenderer.invoke('show-webapp'),
  showRecorder: () => ipcRenderer.invoke('show-recorder'),
  getCurrentView: () => ipcRenderer.invoke('get-current-view'),
  focusWebapp: () => ipcRenderer.invoke('focus-webapp'),
  
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  
  // License
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  
  // Server
  connectServer: () => ipcRenderer.invoke('connect-server'),
  disconnectServer: () => ipcRenderer.invoke('disconnect-server'),
  
  // Desktop Recorder - Simplified API for DesktopRecorder page
  showEmbeddedBrowser: (bounds) => ipcRenderer.invoke('embedded-browser-show', bounds),
  hideEmbeddedBrowser: () => ipcRenderer.invoke('embedded-browser-hide'),
  navigateEmbeddedBrowser: (url) => ipcRenderer.invoke('embedded-browser-navigate', url),
  startRecording: () => ipcRenderer.invoke('embedded-browser-start-recording'),
  stopRecording: () => ipcRenderer.invoke('embedded-browser-stop-recording'),
  getActions: () => ipcRenderer.invoke('embedded-browser-get-actions'),
  clearActions: () => ipcRenderer.invoke('embedded-browser-clear-actions'),
  suggestActions: () => ipcRenderer.invoke('embedded-browser-suggest'),
  browserBack: () => ipcRenderer.invoke('embedded-browser-back'),
  browserForward: () => ipcRenderer.invoke('embedded-browser-forward'),
  browserRefresh: () => ipcRenderer.invoke('embedded-browser-refresh'),
  browserZoom: (factor) => ipcRenderer.invoke('embedded-browser-zoom', factor),
  getBrowserZoom: () => ipcRenderer.invoke('embedded-browser-get-zoom'),
  
  // Execute an action in the browser (click, fill, etc.) - like web extension
  executeAction: (action) => ipcRenderer.invoke('embedded-browser-execute-action', action),
  
  // Add an action to the recorded list (for suggestions)
  addAction: (action) => ipcRenderer.invoke('embedded-browser-add-action', action),
  
  // Generic invoke for any IPC call
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  exportToTestBuilder: (testName) => ipcRenderer.invoke('export-to-test-builder', testName),
  
  // Recorder (for Test Builder integration - legacy API)
  recorder: {
    show: (bounds) => ipcRenderer.invoke('embedded-browser-show', bounds),
    hide: () => ipcRenderer.invoke('embedded-browser-hide'),
    navigate: (url) => ipcRenderer.invoke('embedded-browser-navigate', url),
    startRecording: () => ipcRenderer.invoke('embedded-browser-start-recording'),
    stopRecording: () => ipcRenderer.invoke('embedded-browser-stop-recording'),
    getActions: () => ipcRenderer.invoke('embedded-browser-get-actions'),
    clearActions: () => ipcRenderer.invoke('embedded-browser-clear-actions'),
    suggest: () => ipcRenderer.invoke('embedded-browser-suggest'),
  },
  
  // Export
  export: {
    flowstralTest: (testName) => ipcRenderer.invoke('export-flowstral-test', testName),
    robotFramework: (testName) => ipcRenderer.invoke('export-robot-framework', testName),
    playwright: () => ipcRenderer.invoke('export-playwright'),
    toTestBuilder: (testName) => ipcRenderer.invoke('export-to-test-builder', testName),
  },
  
  // Local Storage (offline-capable data)
  localStorage: {
    // Test Cases
    getTestCases: () => ipcRenderer.invoke('local-storage-get-test-cases'),
    saveTestCase: (testCase) => ipcRenderer.invoke('local-storage-save-test-case', testCase),
    deleteTestCase: (id) => ipcRenderer.invoke('local-storage-delete-test-case', id),
    clearTestCases: () => ipcRenderer.invoke('local-storage-clear-test-cases'),
    clearAll: () => ipcRenderer.invoke('local-storage-clear-all'),
    
    // Test Runs
    getTestRuns: () => ipcRenderer.invoke('local-storage-get-test-runs'),
    saveTestRun: (testRun) => ipcRenderer.invoke('local-storage-save-test-run', testRun),
    
    // Recording Sessions
    getRecordingSessions: () => ipcRenderer.invoke('local-storage-get-recording-sessions'),
    saveRecordingSession: (session) => ipcRenderer.invoke('local-storage-save-recording-session', session),
    
    // Elements
    getElements: () => ipcRenderer.invoke('local-storage-get-elements'),
    saveElement: (element) => ipcRenderer.invoke('local-storage-save-element', element),
    
    // Test Results
    getTestResults: () => ipcRenderer.invoke('local-storage-get-test-results'),
    saveTestResult: (result) => ipcRenderer.invoke('local-storage-save-test-result', result),
    
    // Sync
    getPendingSync: () => ipcRenderer.invoke('local-storage-get-pending-sync'),
    markSynced: (collection, ids) => ipcRenderer.invoke('local-storage-mark-synced', { collection, ids }),
    
    // Import/Export
    exportAll: () => ipcRenderer.invoke('local-storage-export-all'),
    importAll: (data) => ipcRenderer.invoke('local-storage-import-all', data),
    exportToFile: () => ipcRenderer.invoke('local-storage-export-file'),
    importFromFile: () => ipcRenderer.invoke('local-storage-import-file'),
  },
  
  // Test Execution
  testRunner: {
    executeTest: (testData) => ipcRenderer.invoke('execute-test', testData),
    cancelTest: () => ipcRenderer.invoke('cancel-test'),
    executeHeadless: (testData) => ipcRenderer.invoke('execute-test-headless', testData),
  },
  
  // Utilities
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'action-recorded',
      'recording-status',
      'execution-status',
      'step-status',
      'connection-status',
      'license-status',
      'update-available',
      'update-downloaded',
      'view-changed',
      'browser-url-changed',
      'test-step-start',
      'test-step-complete',
      'test-complete',
    ];
    
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
  
  once: (channel, callback) => {
    ipcRenderer.once(channel, (event, ...args) => callback(...args));
  }
});

// Also expose platform info
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  isElectron: true,
  version: process.versions.electron
});

// Expose as 'flowstral' for PlaywrightRecorderPage compatibility
// This mirrors the expected API structure from the browser extension
contextBridge.exposeInMainWorld('flowstral', {
  isElectron: true,
  
  // Playwright Recorder API (standalone browser window)
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
    addManualAction: (action) => ipcRenderer.invoke('playwright-recorder-add-manual-action', action),
    runTest: (options) => ipcRenderer.invoke('playwright-recorder-run-test', options),
  },
  
  // Export API
  export: {
    toTestBuilder: (testName) => ipcRenderer.invoke('export-to-test-builder', testName),
    playwright: () => ipcRenderer.invoke('export-playwright'),
    robotFramework: (testName) => ipcRenderer.invoke('export-robot-framework', testName),
  },
  
  // Event listeners for Playwright recorder
  on: (channel, callback) => {
    const validChannels = [
      'playwright-recorder-action',
      'playwright-recorder-stopped',
      'playwright-recorder-paused',
      'playwright-recorder-resumed',
      'playwright-recorder-suggestions',
      'playwright-recorder-navigation',
      'playwright-test-step-start',
      'playwright-test-step-complete',
      'playwright-test-complete',
      'test-step-start',
      'test-step-complete',
      'test-complete',
      'action-recorded',
      'recording-status',
      'execution-status',
    ];
    
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Store for cleanup
      if (!eventListeners.has(channel)) {
        eventListeners.set(channel, []);
      }
      eventListeners.get(channel).push(subscription);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
        const listeners = eventListeners.get(channel);
        if (listeners) {
          const idx = listeners.indexOf(subscription);
          if (idx > -1) listeners.splice(idx, 1);
        }
      };
    }
    
    console.warn('[flowstral] Invalid event channel:', channel);
    return () => {};
  }
});

console.log('[WebApp Preload] Electron APIs exposed to webapp (electronAPI + flowstral)');

