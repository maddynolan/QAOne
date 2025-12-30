/**
 * Local Storage IPC Handlers
 * 
 * All handlers for local data persistence:
 * - Test cases CRUD
 * - Test runs CRUD
 * - Recording sessions
 * - Elements repository
 * - Import/Export
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');

/**
 * Register all storage-related IPC handlers
 * @param {Object} context - Application context
 * @param {LocalStorage} context.localStorage - Local storage instance
 */
function registerStorageHandlers(context) {
  const { getLocalStorage } = context;

  // ============================================================================
  // TEST CASES
  // ============================================================================

  ipcMain.handle('local-storage-get-test-cases', (event, options = {}) => {
    const storage = getLocalStorage();
    // Support both old API (no args) and new API (with options)
    if (storage?.getTestCases) {
      return typeof storage.getTestCases === 'function' 
        ? storage.getTestCases(options) 
        : [];
    }
    return [];
  });

  // New: Get test case by ID
  ipcMain.handle('local-storage-get-test-case', (event, id) => {
    const storage = getLocalStorage();
    if (storage?.getTestCaseById) {
      return storage.getTestCaseById(id);
    }
    // Fallback for JSON storage
    const cases = storage?.getTestCases() || [];
    return cases.find(tc => tc.id === id) || null;
  });

  // New: Search test cases (full-text search for SQLite)
  ipcMain.handle('local-storage-search-test-cases', (event, query, options = {}) => {
    const storage = getLocalStorage();
    if (storage?.searchTestCases) {
      return storage.searchTestCases(query, options);
    }
    // Fallback for JSON storage
    const cases = storage?.getTestCases() || [];
    const q = (query || '').toLowerCase();
    return cases.filter(tc => 
      (tc.name || '').toLowerCase().includes(q) ||
      (tc.description || '').toLowerCase().includes(q)
    );
  });

  // New: Get storage stats
  ipcMain.handle('local-storage-get-stats', () => {
    const storage = getLocalStorage();
    if (storage?.getStats) {
      return storage.getStats();
    }
    // Fallback for JSON storage
    const cases = storage?.getTestCases() || [];
    return {
      testCases: cases.length,
      automated: cases.filter(t => t.automationStatus === 'full').length,
      partial: cases.filter(t => t.automationStatus === 'partial').length,
      manual: cases.filter(t => !t.automationStatus || t.automationStatus === 'none').length
    };
  });

  ipcMain.handle('local-storage-save-test-case', (event, testCase) => {
    return getLocalStorage()?.saveTestCase(testCase);
  });

  ipcMain.handle('local-storage-delete-test-case', (event, id) => {
    getLocalStorage()?.deleteTestCase(id);
    return { success: true };
  });

  // ============================================================================
  // TEST RUNS
  // ============================================================================

  ipcMain.handle('local-storage-get-test-runs', () => {
    return getLocalStorage()?.getTestRuns() || [];
  });

  ipcMain.handle('local-storage-save-test-run', (event, testRun) => {
    return getLocalStorage()?.saveTestRun(testRun);
  });

  // ============================================================================
  // RECORDING SESSIONS
  // ============================================================================

  ipcMain.handle('local-storage-get-recording-sessions', () => {
    return getLocalStorage()?.getRecordingSessions() || [];
  });

  ipcMain.handle('local-storage-save-recording-session', (event, session) => {
    return getLocalStorage()?.saveRecordingSession(session);
  });

  // ============================================================================
  // ELEMENTS
  // ============================================================================

  ipcMain.handle('local-storage-get-elements', () => {
    return getLocalStorage()?.getElements() || [];
  });

  ipcMain.handle('local-storage-save-element', (event, element) => {
    return getLocalStorage()?.saveElement(element);
  });

  // ============================================================================
  // TEST RESULTS
  // ============================================================================

  ipcMain.handle('local-storage-get-test-results', () => {
    return getLocalStorage()?.getTestResults() || [];
  });

  ipcMain.handle('local-storage-save-test-result', (event, result) => {
    return getLocalStorage()?.saveTestResult(result);
  });

  // ============================================================================
  // SYNC
  // ============================================================================

  ipcMain.handle('local-storage-get-pending-sync', () => {
    return getLocalStorage()?.getPendingSync() || {};
  });

  ipcMain.handle('local-storage-mark-synced', (event, { collection, ids }) => {
    return getLocalStorage()?.markSynced(collection, ids);
  });

  // ============================================================================
  // IMPORT / EXPORT
  // ============================================================================

  ipcMain.handle('local-storage-export-all', () => {
    return getLocalStorage()?.exportAll();
  });

  ipcMain.handle('local-storage-clear-all', () => {
    return getLocalStorage()?.clearAll();
  });

  ipcMain.handle('local-storage-clear-test-cases', () => {
    const localStorage = getLocalStorage();
    if (localStorage) {
      localStorage.writeCollection('test_cases', []);
      console.log('[LocalStorage] Test cases cleared');
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('local-storage-import-all', async (event, data) => {
    return getLocalStorage()?.importAll(data);
  });

  ipcMain.handle('local-storage-import-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Flowstral Data',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true };
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      const imported = getLocalStorage()?.importAll(data);
      return { success: true, imported };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('local-storage-export-file', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Flowstral Data',
      defaultPath: `flowstral-export-${Date.now()}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    });
    
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    
    try {
      const data = getLocalStorage()?.exportAll();
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Storage handlers registered');
}

module.exports = { registerStorageHandlers };

