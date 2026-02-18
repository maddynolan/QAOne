/**
 * Electron Bridge
 * 
 * Provides a unified API for the React app to communicate with Electron
 * when running in the desktop app, or gracefully fall back when in browser.
 */

// Check if running in Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         (window as any).electronAPI?.isElectron === true;
};

// Get the Electron API (if available)
export const getElectronAPI = () => {
  if (isElectron()) {
    return (window as any).electronAPI;
  }
  return null;
};

// Platform info
export const getPlatform = () => {
  if (typeof window !== 'undefined' && (window as any).platform) {
    return (window as any).platform;
  }
  return {
    os: 'browser',
    arch: 'web',
    isElectron: false,
    version: null
  };
};

/**
 * Navigation helper - works in both Electron and browser
 */
export const navigate = async (route: string): Promise<void> => {
  const api = getElectronAPI();
  if (api) {
    await api.navigateTo(route);
  } else {
    // Browser fallback - use react-router or window.location
    window.location.hash = route;
  }
};

/**
 * Show the recorder view (Electron only)
 */
export const showRecorder = async (): Promise<void> => {
  const api = getElectronAPI();
  if (api) {
    await api.showRecorder();
  } else {
    console.log('[Electron Bridge] Recorder not available in browser');
  }
};

/**
 * Show the webapp view (Electron only)
 */
export const showWebapp = async (): Promise<void> => {
  const api = getElectronAPI();
  if (api) {
    await api.showWebapp();
  }
};

/**
 * Recorder APIs (Electron only)
 */
export const recorder = {
  isAvailable: () => isElectron(),
  
  navigate: async (url: string) => {
    const api = getElectronAPI();
    return api?.recorder?.navigate(url);
  },
  
  startRecording: async () => {
    const api = getElectronAPI();
    return api?.recorder?.startRecording();
  },
  
  stopRecording: async () => {
    const api = getElectronAPI();
    return api?.recorder?.stopRecording();
  },
  
  getActions: async () => {
    const api = getElectronAPI();
    return api?.recorder?.getActions() || [];
  },
  
  clearActions: async () => {
    const api = getElectronAPI();
    return api?.recorder?.clearActions();
  },
  
  suggest: async () => {
    const api = getElectronAPI();
    return api?.recorder?.suggest() || [];
  },
};

/**
 * Export APIs (Electron only for now)
 */
export const testExport = {
  isAvailable: () => isElectron(),
  
  toFlowstral: async (testName: string) => {
    const api = getElectronAPI();
    return api?.export?.flowstralTest(testName);
  },
  
  toRobotFramework: async (testName: string) => {
    const api = getElectronAPI();
    return api?.export?.robotFramework(testName);
  },
  
  toPlaywright: async () => {
    const api = getElectronAPI();
    return api?.export?.playwright();
  },
  
  toTestBuilder: async (testName: string) => {
    const api = getElectronAPI();
    return api?.export?.toTestBuilder(testName);
  },
};

/**
 * Configuration APIs
 */
export const config = {
  get: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.getConfig();
    }
    // Browser fallback - use localStorage
    return {
      serverUrl: localStorage.getItem('serverUrl') || 'https://qaone-production.up.railway.app',
      mode: 'browser',
      preferences: JSON.parse(localStorage.getItem('preferences') || '{}')
    };
  },
  
  set: async (config: any) => {
    const api = getElectronAPI();
    if (api) {
      return api.setConfig(config);
    }
    // Browser fallback
    if (config.serverUrl) localStorage.setItem('serverUrl', config.serverUrl);
    if (config.preferences) localStorage.setItem('preferences', JSON.stringify(config.preferences));
    return true;
  },
};

/**
 * Titlebar theme sync — tell Electron about webapp light/dark mode
 */
export const setTitlebarTheme = async (isDark: boolean) => {
  const api = getElectronAPI();
  if (api?.setTitlebarTheme) {
    return api.setTitlebarTheme(isDark);
  }
  // Browser fallback — no-op
  return { success: true };
};

/**
 * Event subscription helper
 */
export const subscribe = (channel: string, callback: (...args: any[]) => void): (() => void) => {
  const api = getElectronAPI();
  if (api) {
    return api.on(channel, callback) || (() => {});
  }
  // Browser fallback - no-op
  return () => {};
};

/**
 * Open external URL
 */
export const openExternal = (url: string): void => {
  const api = getElectronAPI();
  if (api) {
    api.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
};

/**
 * Check for updates (Electron only)
 */
export const checkUpdates = async () => {
  const api = getElectronAPI();
  if (api) {
    return api.checkUpdates();
  }
  return null;
};

/**
 * Test Execution APIs (Electron only - uses local Playwright)
 */
export const testRunner = {
  isAvailable: () => isElectron(),
  
  executeTest: async (testData: any) => {
    const api = getElectronAPI();
    if (api?.testRunner) {
      return api.testRunner.executeTest(testData);
    }
    return { status: 'error', error: 'Test runner not available' };
  },
  
  cancelTest: async () => {
    const api = getElectronAPI();
    if (api?.testRunner) {
      return api.testRunner.cancelTest();
    }
    return false;
  },
  
  executeHeadless: async (testData: any) => {
    const api = getElectronAPI();
    if (api?.testRunner) {
      return api.testRunner.executeHeadless(testData);
    }
    return { status: 'error', error: 'Test runner not available' };
  },
  
  // Subscribe to execution events
  onStepStart: (callback: (data: any) => void) => {
    return subscribe('test-step-start', callback);
  },
  
  onStepComplete: (callback: (data: any) => void) => {
    return subscribe('test-step-complete', callback);
  },
  
  onTestComplete: (callback: (data: any) => void) => {
    return subscribe('test-complete', callback);
  },
};

/**
 * Local Storage APIs - works offline in Electron
 * Falls back to browser localStorage when not in Electron
 */
export const localData = {
  isAvailable: () => isElectron(),
  
  // Test Cases
  getTestCases: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.getTestCases();
    }
    // Browser fallback - use 'test_cases' to match Repository
    return JSON.parse(localStorage.getItem('test_cases') || '[]');
  },
  
  saveTestCase: async (testCase: any) => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.saveTestCase(testCase);
    }
    // Browser fallback - use 'test_cases' to match Repository
    const testCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    const index = testCases.findIndex((tc: any) => tc.id === testCase.id);
    if (index >= 0) {
      testCases[index] = testCase;
    } else {
      testCases.push(testCase);
    }
    localStorage.setItem('test_cases', JSON.stringify(testCases));
    console.log('[localData] Saved test case to localStorage:', testCase.id, testCase.name);
    return testCase;
  },
  
  deleteTestCase: async (id: string) => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.deleteTestCase(id);
    }
    // Browser fallback - use 'test_cases' to match Repository
    const testCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localStorage.setItem('test_cases', JSON.stringify(testCases.filter((tc: any) => tc.id !== id)));
    return true;
  },
  
  // Test Runs
  getTestRuns: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.getTestRuns();
    }
    return JSON.parse(localStorage.getItem('testRuns') || '[]');
  },
  
  saveTestRun: async (testRun: any) => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.saveTestRun(testRun);
    }
    const testRuns = JSON.parse(localStorage.getItem('testRuns') || '[]');
    testRuns.unshift(testRun);
    localStorage.setItem('testRuns', JSON.stringify(testRuns));
    return testRun;
  },
  
  // Recording Sessions
  getRecordingSessions: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.getRecordingSessions();
    }
    return JSON.parse(localStorage.getItem('recordingSessions') || '[]');
  },
  
  saveRecordingSession: async (session: any) => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.saveRecordingSession(session);
    }
    const sessions = JSON.parse(localStorage.getItem('recordingSessions') || '[]');
    sessions.unshift(session);
    localStorage.setItem('recordingSessions', JSON.stringify(sessions));
    return session;
  },
  
  // Test Results
  getTestResults: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.getTestResults();
    }
    return JSON.parse(localStorage.getItem('testResults') || '[]');
  },
  
  saveTestResult: async (result: any) => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.saveTestResult(result);
    }
    const results = JSON.parse(localStorage.getItem('testResults') || '[]');
    results.unshift(result);
    localStorage.setItem('testResults', JSON.stringify(results));
    return result;
  },
  
  // Import/Export (Electron only - file dialogs)
  exportToFile: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.exportToFile();
    }
    // Browser fallback - download JSON
    const data = {
      testCases: JSON.parse(localStorage.getItem('testCases') || '[]'),
      testRuns: JSON.parse(localStorage.getItem('testRuns') || '[]'),
      recordingSessions: JSON.parse(localStorage.getItem('recordingSessions') || '[]'),
      testResults: JSON.parse(localStorage.getItem('testResults') || '[]'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowstral-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  },
  
  importFromFile: async () => {
    const api = getElectronAPI();
    if (api?.localStorage) {
      return api.localStorage.importFromFile();
    }
    return { success: false, error: 'Not available in browser' };
  },
};

/**
 * Mobile Testing APIs (Electron only)
 */
export const mobile = {
  isAvailable: () => isElectron(),
  
  getDevices: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-get-devices');
    }
    return { ios: [], android: [] };
  },
  
  setDevice: async (deviceName: string, network?: string) => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-set-device', { deviceName, network });
    }
    return null;
  },
  
  getConfig: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-get-config');
    }
    return null;
  },
  
  clearDevice: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-clear-device');
    }
    return null;
  },
  
  checkMaestro: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-check-maestro');
    }
    return false;
  },
  
  getNativeDevices: async (platform: 'ios' | 'android') => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-get-native-devices', platform);
    }
    return [];
  },
  
  runNativeTest: async (steps: any[], appId: string, platform: string, deviceId?: string) => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-run-native-test', { steps, appId, platform, deviceId });
    }
    return { success: false, error: 'Not available in browser' };
  },
  
  // Start recording with mobile emulation
  startRecording: async (url: string, deviceName: string, network?: string) => {
    const api = getElectronAPI();
    if (api) {
      // First set the mobile device
      await api.invoke('mobile-set-device', { deviceName, network });
      // Then start recording with mobile settings
      return api.invoke('playwright-recorder-start', { 
        url, 
        mobileDevice: deviceName,
        mobileNetwork: network 
      });
    }
    return { success: false, error: 'Not available in browser' };
  },
  
  stopRecording: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('playwright-recorder-stop');
    }
    return null;
  },
  
  // Maestro Studio - Interactive native app recorder
  startStudio: async (deviceId?: string) => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-start-studio', { deviceId });
    }
    return { success: false, error: 'Not available in browser' };
  },
  
  stopStudio: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-stop-studio');
    }
    return { success: false, error: 'Not available in browser' };
  },
  
  getStudioStatus: async () => {
    const api = getElectronAPI();
    if (api) {
      return api.invoke('mobile-studio-status');
    }
    return { running: false };
  },

  // Device Lab: Screenshots
  takeScreenshot: async (platform: 'ios' | 'android', deviceId?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-screenshot', { platform, deviceId });
    return { success: false, error: 'Not available in browser' };
  },

  // Device Lab: Log capture
  startLogs: async (platform: 'ios' | 'android', deviceId?: string, filter?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-start-logs', { platform, deviceId, filter });
    return { success: false, error: 'Not available in browser' };
  },
  stopLogs: async () => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-stop-logs');
    return { success: false, error: 'Not available in browser' };
  },
  onLogLine: (callback: (line: string) => void) => {
    const api = getElectronAPI();
    if (api) return api.on('mobile-log-line', callback);
    return () => {};
  },

  // Device Lab: App management
  installApp: async (appPath: string, platform: 'ios' | 'android', deviceId?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-install-app', { appPath, platform, deviceId });
    return { success: false, error: 'Not available in browser' };
  },
  uninstallApp: async (bundleId: string, platform: 'ios' | 'android', deviceId?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-uninstall-app', { bundleId, platform, deviceId });
    return { success: false, error: 'Not available in browser' };
  },
  browseForApp: async () => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-browse-app');
    return { success: false, error: 'Not available in browser' };
  },

  // Inspector: Element hierarchy
  getHierarchy: async (platform: 'ios' | 'android', deviceId?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-get-hierarchy', { platform, deviceId });
    return { success: false, error: 'Not available in browser' };
  },

  // Studio output streaming
  onStudioOutput: (callback: (output: string) => void) => {
    const api = getElectronAPI();
    if (api) return api.on('mobile-studio-output', callback);
    return () => {};
  },

  // Advanced Tools
  openDeepLink: async (platform: 'ios' | 'android', deviceId: string | undefined, url: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-open-deep-link', { platform, deviceId, url });
    return { success: false, error: 'Not available in browser' };
  },
  sendPush: async (platform: 'ios' | 'android', deviceId: string | undefined, payload: string, bundleId?: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-send-push', { platform, deviceId, payload, bundleId });
    return { success: false, error: 'Not available in browser' };
  },
  simulateBiometric: async (platform: 'ios' | 'android', deviceId: string | undefined, result: 'success' | 'failure') => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-simulate-biometric', { platform, deviceId, result });
    return { success: false, error: 'Not available in browser' };
  },
  setGeoLocation: async (platform: 'ios' | 'android', deviceId: string | undefined, latitude: number, longitude: number) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-geolocation', { platform, deviceId, latitude, longitude });
    return { success: false, error: 'Not available in browser' };
  },
  setNetworkCondition: async (platform: 'ios' | 'android', deviceId: string | undefined, profile: any) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-network', { platform, deviceId, profile });
    return { success: false, error: 'Not available in browser' };
  },
  setOrientation: async (platform: 'ios' | 'android', deviceId: string | undefined, orientation: 'portrait' | 'landscape') => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-orientation', { platform, deviceId, orientation });
    return { success: false, error: 'Not available in browser' };
  },
  setAppearance: async (platform: 'ios' | 'android', deviceId: string | undefined, mode: 'light' | 'dark') => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-appearance', { platform, deviceId, mode });
    return { success: false, error: 'Not available in browser' };
  },
  setLocale: async (platform: 'ios' | 'android', deviceId: string | undefined, locale: string) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-locale', { platform, deviceId, locale });
    return { success: false, error: 'Not available in browser' };
  },
  setFontScale: async (platform: 'ios' | 'android', deviceId: string | undefined, scale: number) => {
    const api = getElectronAPI();
    if (api) return api.invoke('mobile-set-font-scale', { platform, deviceId, scale });
    return { success: false, error: 'Not available in browser' };
  },
};

// Export a single object for convenience
export default {
  isElectron,
  getElectronAPI,
  getPlatform,
  navigate,
  showRecorder,
  showWebapp,
  recorder,
  testExport,
  config,
  subscribe,
  openExternal,
  checkUpdates,
  localData,
  testRunner,
  mobile,
};

