/**
 * TestRunnerIPC - IPC handlers for TestRunner
 * 
 * This module exposes TestRunner functionality to the Electron renderer process
 * through IPC handlers. It also provides a browser-side API that can be injected
 * into window.flowstral.playwrightRecorder
 */

import { TestRunner, TestStep, TestConfig, StepResult, TestResult } from './TestRunner';

// ============================================================================
// Singleton Instance
// ============================================================================

let runnerInstance: TestRunner | null = null;

function getRunner(): TestRunner {
  if (!runnerInstance) {
    runnerInstance = new TestRunner();
  }
  return runnerInstance;
}

// ============================================================================
// IPC Handler Functions (for Electron Main Process)
// ============================================================================

export const testRunnerHandlers = {
  /**
   * Run a test with optional debug mode
   */
  async runTest(args: { 
    steps: TestStep[]; 
    url?: string; 
    debugMode?: boolean;
    stepByStep?: boolean;
  }): Promise<TestResult> {
    const runner = getRunner();
    
    return runner.runTest(args.steps, {
      baseUrl: args.url,
      debugMode: args.debugMode || false,
      stepByStep: args.stepByStep || false,
      headless: false
    });
  },

  /**
   * Pause the currently running test
   */
  pauseTest(): void {
    const runner = getRunner();
    runner.pauseTest();
  },

  /**
   * Resume from paused state
   */
  resumeTest(args?: { 
    fromStep?: number; 
    steps?: TestStep[];
    totalSteps?: number;
  }): void {
    const runner = getRunner();
    runner.resumeTest({
      fromStep: args?.fromStep,
      updatedSteps: args?.steps
    });
  },

  /**
   * Skip the current step and continue
   */
  skipStep(args?: { 
    skippedStep?: number;
    continueFrom?: number;
    isComplete?: boolean;
  }): void {
    const runner = getRunner();
    runner.skipStep();
  },

  /**
   * Retry the current step with optional updates
   */
  async retryStep(args: { 
    step: TestStep; 
    index: number;
  }): Promise<StepResult> {
    const runner = getRunner();
    return runner.retryStep(args.step);
  },

  /**
   * Run a single step (for step-by-step mode)
   */
  async runSingleStep(args: { 
    step: TestStep; 
    index: number;
  }): Promise<StepResult> {
    const runner = getRunner();
    return runner.runSingleStep(args.step, args.index);
  },

  /**
   * Stop the test and optionally close browser
   */
  async stopTest(args?: { closeBrowser?: boolean }): Promise<void> {
    const runner = getRunner();
    await runner.stopTest(args);
  },

  /**
   * Get current runner state
   */
  getStatus(): { 
    isRunning: boolean; 
    isPaused: boolean; 
    currentStep: number;
    results: StepResult[];
  } {
    const runner = getRunner();
    return {
      isRunning: runner.running,
      isPaused: runner.paused,
      currentStep: runner.currentStep,
      results: runner.results
    };
  }
};

// ============================================================================
// Event Forwarding (for sending events to renderer)
// ============================================================================

export type EventCallback = (event: string, data: any) => void;

let eventCallback: EventCallback | null = null;

export function setEventCallback(callback: EventCallback): void {
  eventCallback = callback;
  
  const runner = getRunner();
  
  // Forward all runner events
  runner.on('step-start', (data) => callback('step-start', data));
  runner.on('step-complete', (data) => callback('step-complete', data));
  runner.on('step-failed', (data) => callback('step-failed', data));
  runner.on('test-paused', (data) => callback('test-paused', data));
  runner.on('test-resumed', (data) => callback('test-resumed', data));
  runner.on('test-complete', (data) => callback('test-complete', data));
  runner.on('test-stopped', (data) => callback('test-stopped', data));
}

// ============================================================================
// Browser-Side API (inject into window.flowstral.playwrightRecorder)
// ============================================================================

/**
 * This object is designed to be injected into the browser context
 * so the frontend can call these methods directly
 */
export const playwrightRecorderAPI = {
  runTest: testRunnerHandlers.runTest,
  pauseTest: testRunnerHandlers.pauseTest,
  resumeTest: testRunnerHandlers.resumeTest,
  skipStep: testRunnerHandlers.skipStep,
  retryStep: testRunnerHandlers.retryStep,
  runSingleStep: testRunnerHandlers.runSingleStep,
  stopTest: testRunnerHandlers.stopTest,
  getStatus: testRunnerHandlers.getStatus
};

// ============================================================================
// Electron IPC Registration Helper
// ============================================================================

/**
 * Register IPC handlers with Electron's ipcMain
 * 
 * Usage in main.ts:
 * ```
 * import { ipcMain } from 'electron';
 * import { registerTestRunnerIPC } from './runner/TestRunnerIPC';
 * 
 * registerTestRunnerIPC(ipcMain, mainWindow.webContents);
 * ```
 */
export function registerTestRunnerIPC(
  ipcMain: any, 
  webContents: any
): void {
  // Register handlers
  ipcMain.handle('test-runner:run', async (_: any, args: any) => {
    return testRunnerHandlers.runTest(args);
  });

  ipcMain.handle('test-runner:pause', () => {
    testRunnerHandlers.pauseTest();
  });

  ipcMain.handle('test-runner:resume', (_: any, args: any) => {
    testRunnerHandlers.resumeTest(args);
  });

  ipcMain.handle('test-runner:skip', (_: any, args: any) => {
    testRunnerHandlers.skipStep(args);
  });

  ipcMain.handle('test-runner:retry', async (_: any, args: any) => {
    return testRunnerHandlers.retryStep(args);
  });

  ipcMain.handle('test-runner:run-single', async (_: any, args: any) => {
    return testRunnerHandlers.runSingleStep(args);
  });

  ipcMain.handle('test-runner:stop', async (_: any, args: any) => {
    return testRunnerHandlers.stopTest(args);
  });

  ipcMain.handle('test-runner:status', () => {
    return testRunnerHandlers.getStatus();
  });

  // Set up event forwarding to renderer
  setEventCallback((event, data) => {
    webContents.send(`test-runner:${event}`, data);
  });
}

// ============================================================================
// Preload Script Helper
// ============================================================================

/**
 * Code to be included in Electron preload script
 * 
 * This exposes the test runner API to the renderer via contextBridge
 */
export const preloadScript = `
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowstral', {
  playwrightRecorder: {
    // Run test
    runTest: (args) => ipcRenderer.invoke('test-runner:run', args),
    
    // Pause/Resume
    pauseTest: () => ipcRenderer.invoke('test-runner:pause'),
    resumeTest: (args) => ipcRenderer.invoke('test-runner:resume', args),
    
    // Skip/Retry
    skipStep: (args) => ipcRenderer.invoke('test-runner:skip', args),
    retryStep: (args) => ipcRenderer.invoke('test-runner:retry', args),
    
    // Single step execution
    runSingleStep: (args) => ipcRenderer.invoke('test-runner:run-single', args),
    
    // Stop
    stopTest: (args) => ipcRenderer.invoke('test-runner:stop', args),
    
    // Status
    getStatus: () => ipcRenderer.invoke('test-runner:status'),
    
    // Event listeners
    on: (event, callback) => {
      ipcRenderer.on(\`test-runner:\${event}\`, (_, data) => callback(data));
    },
    off: (event, callback) => {
      ipcRenderer.removeListener(\`test-runner:\${event}\`, callback);
    }
  }
});
`;

export default {
  testRunnerHandlers,
  playwrightRecorderAPI,
  registerTestRunnerIPC,
  setEventCallback,
  preloadScript
};

