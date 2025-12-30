/**
 * Local Storage Service
 * 
 * Provides offline-capable data storage using SQLite.
 * Syncs with remote server when connected.
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// For SQLite, we'll use better-sqlite3 or sql.js
// For now, use JSON files as a simpler approach that works offline
// Can upgrade to SQLite later for better performance

class LocalStorage {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  // Read entire collection
  readCollection(collection) {
    const filePath = this.getFilePath(collection);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`[LocalStorage] Error reading ${collection}:`, error.message);
    }
    return [];
  }

  // Write entire collection
  writeCollection(collection, data) {
    const filePath = this.getFilePath(collection);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`[LocalStorage] Error writing ${collection}:`, error.message);
      return false;
    }
  }

  // ============================================================
  // Test Cases
  // ============================================================

  getTestCases() {
    return this.readCollection('test_cases');
  }

  saveTestCase(testCase) {
    const testCases = this.getTestCases();
    const existingIndex = testCases.findIndex(tc => tc.id === testCase.id);
    
    const now = new Date().toISOString();
    const updatedTestCase = {
      ...testCase,
      updatedAt: now,
      createdAt: testCase.createdAt || now,
      syncStatus: 'pending' // Mark for sync
    };

    if (existingIndex >= 0) {
      testCases[existingIndex] = updatedTestCase;
    } else {
      testCases.push(updatedTestCase);
    }

    this.writeCollection('test_cases', testCases);
    return updatedTestCase;
  }

  deleteTestCase(id) {
    const testCases = this.getTestCases().filter(tc => tc.id !== id);
    this.writeCollection('test_cases', testCases);
    return true;
  }

  // ============================================================
  // Test Runs
  // ============================================================

  getTestRuns() {
    return this.readCollection('test_runs');
  }

  saveTestRun(testRun) {
    const testRuns = this.getTestRuns();
    const existingIndex = testRuns.findIndex(tr => tr.id === testRun.id);

    const now = new Date().toISOString();
    const updatedRun = {
      ...testRun,
      updatedAt: now,
      createdAt: testRun.createdAt || now,
      syncStatus: 'pending'
    };

    if (existingIndex >= 0) {
      testRuns[existingIndex] = updatedRun;
    } else {
      testRuns.push(updatedRun);
    }

    this.writeCollection('test_runs', testRuns);
    return updatedRun;
  }

  // ============================================================
  // Recording Sessions
  // ============================================================

  getRecordingSessions() {
    return this.readCollection('recording_sessions');
  }

  saveRecordingSession(session) {
    const sessions = this.getRecordingSessions();
    const now = new Date().toISOString();
    
    const updatedSession = {
      id: session.id || `session_${Date.now()}`,
      ...session,
      savedAt: now,
      syncStatus: 'pending'
    };

    sessions.unshift(updatedSession); // Add to beginning
    
    // Keep only last 100 sessions
    if (sessions.length > 100) {
      sessions.length = 100;
    }

    this.writeCollection('recording_sessions', sessions);
    return updatedSession;
  }

  // ============================================================
  // Elements Repository
  // ============================================================

  getElements() {
    return this.readCollection('elements');
  }

  saveElement(element) {
    const elements = this.getElements();
    const existingIndex = elements.findIndex(e => e.id === element.id);

    const now = new Date().toISOString();
    const updatedElement = {
      ...element,
      updatedAt: now,
      createdAt: element.createdAt || now
    };

    if (existingIndex >= 0) {
      elements[existingIndex] = updatedElement;
    } else {
      elements.push(updatedElement);
    }

    this.writeCollection('elements', elements);
    return updatedElement;
  }

  // ============================================================
  // Test Results
  // ============================================================

  getTestResults() {
    return this.readCollection('test_results');
  }

  saveTestResult(result) {
    const results = this.getTestResults();
    
    const updatedResult = {
      id: result.id || `result_${Date.now()}`,
      ...result,
      timestamp: result.timestamp || new Date().toISOString(),
      syncStatus: 'pending'
    };

    results.unshift(updatedResult);
    
    // Keep only last 1000 results
    if (results.length > 1000) {
      results.length = 1000;
    }

    this.writeCollection('test_results', results);
    return updatedResult;
  }

  // ============================================================
  // Sync Management
  // ============================================================

  getPendingSyncItems(collection) {
    const data = this.readCollection(collection);
    return data.filter(item => item.syncStatus === 'pending');
  }

  markAsSynced(collection, ids) {
    const data = this.readCollection(collection);
    let changed = false;

    data.forEach(item => {
      if (ids.includes(item.id)) {
        item.syncStatus = 'synced';
        item.syncedAt = new Date().toISOString();
        changed = true;
      }
    });

    if (changed) {
      this.writeCollection(collection, data);
    }
  }

  // Get all pending items across collections
  getAllPendingSync() {
    return {
      testCases: this.getPendingSyncItems('test_cases'),
      testRuns: this.getPendingSyncItems('test_runs'),
      recordingSessions: this.getPendingSyncItems('recording_sessions'),
      testResults: this.getPendingSyncItems('test_results'),
    };
  }

  // ============================================================
  // Import/Export
  // ============================================================

  exportAll() {
    return {
      testCases: this.getTestCases(),
      testRuns: this.getTestRuns(),
      recordingSessions: this.getRecordingSessions(),
      elements: this.getElements(),
      testResults: this.getTestResults(),
      exportedAt: new Date().toISOString(),
      version: '2.0'
    };
  }

  importAll(data) {
    if (data.testCases) this.writeCollection('test_cases', data.testCases);
    if (data.testRuns) this.writeCollection('test_runs', data.testRuns);
    if (data.recordingSessions) this.writeCollection('recording_sessions', data.recordingSessions);
    if (data.elements) this.writeCollection('elements', data.elements);
    if (data.testResults) this.writeCollection('test_results', data.testResults);
    
    console.log('[LocalStorage] Imported data');
    return true;
  }

  // Clear all data
  clearAll() {
    const collections = ['test_cases', 'test_runs', 'recording_sessions', 'elements', 'test_results'];
    collections.forEach(c => this.writeCollection(c, []));
    console.log('[LocalStorage] All data cleared');
    return true;
  }
}

module.exports = LocalStorage;

