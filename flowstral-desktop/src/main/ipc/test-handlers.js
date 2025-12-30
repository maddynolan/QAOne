/**
 * Test Execution IPC Handlers
 * 
 * Handlers for running and managing tests:
 * - Execute tests (visible and headless)
 * - Cancel running tests
 * - Get test results
 */

const { ipcMain } = require('electron');

/**
 * Register all test execution IPC handlers
 * @param {Object} context - Application context
 * @param {TestExecutor} context.testExecutor - Test executor instance
 */
function registerTestHandlers(context) {
  const { getTestExecutor, getLocalStorage } = context;

  // Current test execution state
  let currentExecution = null;

  // ============================================================================
  // EXECUTE TEST (VISIBLE)
  // ============================================================================

  ipcMain.handle('execute-test', async (event, testData) => {
    const testExecutor = getTestExecutor();
    const localStorage = getLocalStorage();
    
    if (!testExecutor) {
      return { success: false, error: 'Test executor not available' };
    }

    try {
      console.log('[IPC] Executing test:', testData.name);
      
      currentExecution = {
        id: testData.id,
        name: testData.name,
        startTime: Date.now(),
        status: 'running'
      };

      const result = await testExecutor.executeTest(testData, {
        headless: false,
        video: true,
        screenshots: true
      });

      currentExecution.status = result.success ? 'passed' : 'failed';
      currentExecution.endTime = Date.now();

      // Save test run to local storage
      if (localStorage) {
        localStorage.saveTestRun({
          id: `run_${Date.now()}`,
          testId: testData.id,
          testName: testData.name,
          status: result.success ? 'passed' : 'failed',
          duration: Date.now() - currentExecution.startTime,
          results: result.results,
          timestamp: new Date().toISOString()
        });
      }

      console.log('[IPC] Test completed:', result.success ? 'PASSED' : 'FAILED');
      return result;
    } catch (error) {
      console.error('[IPC] Test execution error:', error);
      currentExecution = null;
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // EXECUTE TEST (HEADLESS)
  // ============================================================================

  ipcMain.handle('execute-test-headless', async (event, testData) => {
    const testExecutor = getTestExecutor();
    
    if (!testExecutor) {
      return { success: false, error: 'Test executor not available' };
    }

    try {
      console.log('[IPC] Executing test (headless):', testData.name);
      
      const result = await testExecutor.executeTest(testData, {
        headless: true,
        video: false,
        screenshots: true
      });

      return result;
    } catch (error) {
      console.error('[IPC] Headless test error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // CANCEL TEST
  // ============================================================================

  ipcMain.handle('cancel-test', async () => {
    const testExecutor = getTestExecutor();
    
    if (!testExecutor || !currentExecution) {
      return { success: false, error: 'No test running' };
    }

    try {
      await testExecutor.cancel();
      currentExecution.status = 'cancelled';
      currentExecution.endTime = Date.now();
      console.log('[IPC] Test cancelled');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // GET CURRENT EXECUTION STATUS
  // ============================================================================

  ipcMain.handle('get-test-status', () => {
    return currentExecution;
  });

  console.log('[IPC] Test handlers registered');
}

module.exports = { registerTestHandlers };

