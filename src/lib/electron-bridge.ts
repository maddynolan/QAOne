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
      serverUrl: localStorage.getItem('serverUrl') || 'http://localhost:8000',
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
};

