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
  
  // Theme — tell Electron titlebar about light/dark mode
  setTitlebarTheme: (isDark) => ipcRenderer.invoke('set-titlebar-theme', isDark),

  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),

  // Landing page optional plugins (API, Perf, A11y, Mobile)
  getLandingPlugins: () => ipcRenderer.invoke('get-landing-plugins'),
  setLandingPlugins: (plugins) => ipcRenderer.invoke('set-landing-plugins', plugins),

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
  exportToTestBuilder: (testCaseOrName) => ipcRenderer.invoke('export-to-test-builder', testCaseOrName),
  
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
    toTestBuilder: (testCaseOrName) => ipcRenderer.invoke('export-to-test-builder', testCaseOrName),
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
      'license-blocked',
      'license-expiring-soon',
      'update-available',
      'update-downloaded',
      'view-changed',
      'browser-url-changed',
      'test-step-start',
      'test-step-complete',
      'test-complete',
      // AI Generator events
      'ai-generator-progress',
      'ai-generator-test',
      'ai-generator-error',
      // AI Explorer Agent events
      'ai-explorer-progress',
      'ai-explorer-action',
      'ai-explorer-test-discovered',
      'ai-explorer-error',
      'ai-explorer-state-change',
      // Flow Explorer events
      'flow-explorer-progress',
      'flow-explorer-page-discovered',
      'flow-explorer-element-discovered',
      'flow-explorer-flow-complete',
      'flow-explorer-test-generated',
      'flow-explorer-error',
      // Goal Agent events
      'goal-agent-step',
      'goal-agent-progress',
      'goal-agent-complete',
      'goal-agent-error',
      // Mobile device lab events
      'mobile-log-line',
      'mobile-studio-output',
    ];
    
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
  
  // Explicit listener removal
  off: (channel, callback) => {
    ipcRenderer.removeAllListeners(channel);
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
    // Recording controls
    start: (url, options) => ipcRenderer.invoke('playwright-recorder-start', url, options),
    stop: () => ipcRenderer.invoke('playwright-recorder-stop'),
    pause: () => ipcRenderer.invoke('playwright-recorder-pause'),
    resume: () => ipcRenderer.invoke('playwright-recorder-resume'),
    getActions: () => ipcRenderer.invoke('playwright-recorder-get-actions'),
    clearActions: () => ipcRenderer.invoke('playwright-recorder-clear-actions'),
    isRecording: () => ipcRenderer.invoke('playwright-recorder-is-recording'),
    isPaused: () => ipcRenderer.invoke('playwright-recorder-is-paused'),
    analyze: () => ipcRenderer.invoke('playwright-recorder-analyze'),
    switchTabContext: (tabIndex) => ipcRenderer.invoke('playwright-recorder-switch-tab-context', tabIndex),
    executeAction: (action) => ipcRenderer.invoke('playwright-recorder-execute-action', action),
    addManualAction: (action) => ipcRenderer.invoke('playwright-recorder-add-manual-action', action),
    
    // Test execution - Run mode
    runTest: (options) => ipcRenderer.invoke('playwright-recorder-run-test', options),
    
    // Debug mode controls
    pauseTest: () => ipcRenderer.invoke('playwright-recorder-pause-test'),
    resumeTest: (options) => ipcRenderer.invoke('playwright-recorder-resume-test', options),
    skipStep: (options) => ipcRenderer.invoke('playwright-recorder-skip-step', options),
    retryStep: (options) => ipcRenderer.invoke('playwright-recorder-retry-step', options),
    stopTest: (options) => ipcRenderer.invoke('playwright-recorder-stop-test', options),
    
    // Step-by-step execution
    runSingleStep: (options) => ipcRenderer.invoke('playwright-recorder-run-single-step', options),
    
    // Status
    getTestStatus: () => ipcRenderer.invoke('playwright-recorder-get-test-status'),
    
    // ============ FAILURE REPAIR API ============
    // Help users fix failed steps with browser-assisted debugging
    
    // Get the last failure state (screenshot, URL, step info)
    getFailureState: () => ipcRenderer.invoke('playwright-recorder-get-failure-state'),
    
    // Re-open browser to the failed state (for visual debugging)
    reopenToFailure: () => ipcRenderer.invoke('playwright-recorder-reopen-to-failure'),
    
    // Retry just the failed step with an updated action
    retryFailedStep: (updatedAction) => ipcRenderer.invoke('playwright-recorder-retry-failed-step', updatedAction),
    
    // Resume test execution from the failed step
    resumeFromFailure: (options) => ipcRenderer.invoke('playwright-recorder-resume-from-failure', options),
    
    // Close browser manually (when done debugging)
    closeBrowser: () => ipcRenderer.invoke('playwright-recorder-close-browser'),
    
    // Check if browser is currently open
    isBrowserOpen: () => ipcRenderer.invoke('playwright-recorder-is-browser-open'),
  },
  
  // ========================================================================
  // ELEMENT PICKER API - Visual element selection for fixing failed steps
  // ========================================================================
  elementPicker: {
    // Start element picker mode (returns picked element info)
    start: () => ipcRenderer.invoke('element-picker-start'),
    
    // Stop element picker mode
    stop: () => ipcRenderer.invoke('element-picker-stop'),
    
    // Test a selector to see if it finds elements
    testSelector: (selector) => ipcRenderer.invoke('element-picker-test-selector', selector),
    
    // Highlight an element by selector (for preview)
    highlight: (selector) => ipcRenderer.invoke('element-picker-highlight', selector),
    
    // Listen for picker events
    onPicked: (callback) => {
      ipcRenderer.on('element-picker:picked', (_, data) => callback(data));
    },
    onCancelled: (callback) => {
      ipcRenderer.on('element-picker:cancelled', () => callback());
    },
    onStarted: (callback) => {
      ipcRenderer.on('element-picker:started', () => callback());
    },
  },
  
  // ========================================================================
  // DEBUG COLLECTOR API - Capture and analyze step failures
  // ========================================================================
  debug: {
    // Capture failure state with full debug info
    captureFailure: (action, strategiesAttempted, error) => 
      ipcRenderer.invoke('debug-capture-failure', { action, strategiesAttempted, error }),
    
    // Get last failure debug info
    getLastFailure: () => ipcRenderer.invoke('debug-get-last-failure'),
    
    // Analyze failure and get fix suggestions
    analyzeFailure: (action, strategiesAttempted) => 
      ipcRenderer.invoke('debug-analyze-failure', { action, strategiesAttempted }),
    
    // AI-assisted element finding
    aiFindElement: (description) => ipcRenderer.invoke('ai-find-element', description),
  },
  
  // ========================================================================
  // MOBILE TESTING API (Phase 1: Emulation, Phase 2: Native Apps)
  // ========================================================================
  mobile: {
    // Get available devices for UI dropdown
    getDevices: () => ipcRenderer.invoke('mobile-get-devices'),
    
    // Set mobile device for recording/testing
    setDevice: (deviceName, network) => ipcRenderer.invoke('mobile-set-device', { deviceName, network }),
    
    // Get current mobile configuration
    getConfig: () => ipcRenderer.invoke('mobile-get-config'),
    
    // Clear mobile device (return to desktop mode)
    clearDevice: () => ipcRenderer.invoke('mobile-clear-device'),
    
    // Check Maestro availability for native app testing
    checkMaestro: () => ipcRenderer.invoke('mobile-check-maestro'),
    
    // Run test on native app via Maestro
    runNativeTest: (options) => ipcRenderer.invoke('mobile-run-native-test', options),
    
    // Get available native devices (emulators/simulators)
    getNativeDevices: (platform) => ipcRenderer.invoke('mobile-get-native-devices', platform),
    
    // Maestro Studio - Interactive recorder for native apps
    startStudio: (deviceId) => ipcRenderer.invoke('mobile-start-studio', { deviceId }),
    stopStudio: () => ipcRenderer.invoke('mobile-stop-studio'),
    getStudioStatus: () => ipcRenderer.invoke('mobile-studio-status'),

    // Device Lab - Screenshots, logs, app management, inspector
    takeScreenshot: (platform, deviceId) => ipcRenderer.invoke('mobile-screenshot', { platform, deviceId }),
    startLogs: (platform, deviceId, filter) => ipcRenderer.invoke('mobile-start-logs', { platform, deviceId, filter }),
    stopLogs: () => ipcRenderer.invoke('mobile-stop-logs'),
    installApp: (appPath, platform, deviceId) => ipcRenderer.invoke('mobile-install-app', { appPath, platform, deviceId }),
    uninstallApp: (bundleId, platform, deviceId) => ipcRenderer.invoke('mobile-uninstall-app', { bundleId, platform, deviceId }),
    browseForApp: () => ipcRenderer.invoke('mobile-browse-app'),
    getHierarchy: (platform, deviceId) => ipcRenderer.invoke('mobile-get-hierarchy', { platform, deviceId }),

    // Advanced Tools
    openDeepLink: (platform, deviceId, url) => ipcRenderer.invoke('mobile-open-deep-link', { platform, deviceId, url }),
    sendPush: (platform, deviceId, payload, bundleId) => ipcRenderer.invoke('mobile-send-push', { platform, deviceId, payload, bundleId }),
    simulateBiometric: (platform, deviceId, result) => ipcRenderer.invoke('mobile-simulate-biometric', { platform, deviceId, result }),
    setGeoLocation: (platform, deviceId, latitude, longitude) => ipcRenderer.invoke('mobile-set-geolocation', { platform, deviceId, latitude, longitude }),
    setNetworkCondition: (platform, deviceId, profile) => ipcRenderer.invoke('mobile-set-network', { platform, deviceId, profile }),
    setOrientation: (platform, deviceId, orientation) => ipcRenderer.invoke('mobile-set-orientation', { platform, deviceId, orientation }),
    setAppearance: (platform, deviceId, mode) => ipcRenderer.invoke('mobile-set-appearance', { platform, deviceId, mode }),
    setLocale: (platform, deviceId, locale) => ipcRenderer.invoke('mobile-set-locale', { platform, deviceId, locale }),
    setFontScale: (platform, deviceId, scale) => ipcRenderer.invoke('mobile-set-font-scale', { platform, deviceId, scale }),
  },
  
  // Network Capture API (ported from browser extension)
  networkCapture: {
    start: (sessionId) => ipcRenderer.invoke('network-capture-start', sessionId),
    stop: () => ipcRenderer.invoke('network-capture-stop'),
    getStatus: () => ipcRenderer.invoke('network-capture-status'),
    exportHAR: () => ipcRenderer.invoke('network-capture-export-har'),
    linkAction: (data) => ipcRenderer.invoke('network-capture-link-action', data),
  },
  
  // Export API
  export: {
    toTestBuilder: (testCaseOrName) => ipcRenderer.invoke('export-to-test-builder', testCaseOrName),
    playwright: () => ipcRenderer.invoke('export-playwright'),
    robotFramework: (testName) => ipcRenderer.invoke('export-robot-framework', testName),
  },
  
  // Event listeners for Playwright recorder
  on: (channel, callback) => {
    const validChannels = [
      // Recording events
      'playwright-recorder-action',
      'playwright-recorder-stopped',
      'playwright-recorder-paused',
      'playwright-recorder-resumed',
      'playwright-recorder-suggestions',
      'playwright-recorder-navigation',
      // Test execution events
      'playwright-test-step-start',
      'playwright-test-step-complete',
      'playwright-test-complete',
      'playwright-test-paused',
      'test-step-start',
      'test-step-complete',
      'test-step-flagged',
      'test-complete',
      // Debug mode events
      'test-runner:step-start',
      'test-runner:step-complete',
      'test-runner:step-failed',
      'test-runner:test-paused',
      'test-runner:test-resumed',
      'test-runner:test-complete',
      'test-runner:test-stopped',
      // Mobile native test events
      'mobile-native-test-step',
      'mobile-native-test-progress',
      'mobile-native-test-error',
      // Mobile device lab events
      'mobile-log-line',
      'mobile-studio-output',
      // Network capture events
      'network-request-start',
      'network-request-complete',
      'network-websocket-created',
      'network-capture-complete',
      // General events
      'action-recorded',
      'recording-status',
      'execution-status',
      // License events
      'license-status',
      'license-blocked',
      'license-expiring-soon',
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

