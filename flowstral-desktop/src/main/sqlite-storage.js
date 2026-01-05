/**
 * SQLite Storage Service
 * 
 * Scalable local storage using SQLite for enterprise-scale test management.
 * Supports:
 * - Full-text search across 10,000+ test cases
 * - Indexed queries for fast filtering
 * - Background sync queue for cloud sync
 * - Migration from JSON storage
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// We'll use better-sqlite3 for synchronous, fast SQLite access
// If not available, fall back to the JSON-based LocalStorage
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log('[SQLiteStorage] better-sqlite3 not available, using fallback');
  Database = null;
}

class SQLiteStorage {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.dbPath = path.join(this.dataDir, 'flowstral.db');
    this.db = null;
    this.fallback = null;
    
    this.ensureDataDir();
    this.initialize();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initialize() {
    if (!Database) {
      // Fallback to JSON storage
      const LocalStorage = require('./local-storage');
      this.fallback = new LocalStorage();
      console.log('[SQLiteStorage] Using JSON fallback');
      return;
    }

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
      this.db.pragma('foreign_keys = ON');
      
      this.createTables();
      this.migrateFromJSON();
      
      console.log('[SQLiteStorage] Initialized successfully');
    } catch (error) {
      console.error('[SQLiteStorage] Initialization failed:', error.message);
      // Fallback to JSON storage
      const LocalStorage = require('./local-storage');
      this.fallback = new LocalStorage();
    }
  }

  createTables() {
    // Test Cases table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        description TEXT,
        folder_id TEXT,
        release_id TEXT,
        plan_id TEXT,
        automation_status TEXT DEFAULT 'none',
        priority TEXT,
        test_type TEXT,
        created_at TEXT,
        updated_at TEXT,
        sync_status TEXT DEFAULT 'local',
        data TEXT -- Full JSON for complex fields
      )
    `);

    // Test Steps table (for efficient step-level queries)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_steps (
        id TEXT PRIMARY KEY,
        test_case_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        name TEXT,
        type TEXT,
        qword TEXT,
        args TEXT,
        selector TEXT,
        selector_obj TEXT,
        value TEXT,
        expected_result TEXT,
        automation_status TEXT,
        data TEXT, -- Full JSON for complex fields
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
      )
    `);

    // Indexes for fast queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tc_folder ON test_cases(folder_id);
      CREATE INDEX IF NOT EXISTS idx_tc_status ON test_cases(automation_status);
      CREATE INDEX IF NOT EXISTS idx_tc_updated ON test_cases(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_steps_tc ON test_steps(test_case_id, position);
    `);

    // Full-text search virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS test_cases_fts USING fts5(
        id, name, description, 
        content='test_cases', 
        content_rowid='rowid'
      )
    `);

    // Tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Test case tags junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_case_tags (
        test_case_id TEXT,
        tag_id TEXT,
        PRIMARY KEY (test_case_id, tag_id),
        FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      )
    `);

    // Folders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        position INTEGER DEFAULT 0,
        data TEXT
      )
    `);

    // Test Runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        name TEXT,
        mode TEXT,
        status TEXT,
        started_at TEXT,
        ended_at TEXT,
        release_id TEXT,
        plan_id TEXT,
        data TEXT
      )
    `);

    // Sync queue for offline-first
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT,
        payload TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        last_error TEXT
      )
    `);

    // Triggers for FTS sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS tc_ai AFTER INSERT ON test_cases BEGIN
        INSERT INTO test_cases_fts(rowid, id, name, description) 
        VALUES (new.rowid, new.id, new.name, new.description);
      END;
      
      CREATE TRIGGER IF NOT EXISTS tc_ad AFTER DELETE ON test_cases BEGIN
        INSERT INTO test_cases_fts(test_cases_fts, rowid, id, name, description) 
        VALUES('delete', old.rowid, old.id, old.name, old.description);
      END;
      
      CREATE TRIGGER IF NOT EXISTS tc_au AFTER UPDATE ON test_cases BEGIN
        INSERT INTO test_cases_fts(test_cases_fts, rowid, id, name, description) 
        VALUES('delete', old.rowid, old.id, old.name, old.description);
        INSERT INTO test_cases_fts(rowid, id, name, description) 
        VALUES (new.rowid, new.id, new.name, new.description);
      END;
    `);
  }

  migrateFromJSON() {
    const jsonPath = path.join(this.dataDir, 'test_cases.json');
    if (!fs.existsSync(jsonPath)) return;

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (!jsonData || jsonData.length === 0) return;

      // Check if already migrated
      const count = this.db.prepare('SELECT COUNT(*) as cnt FROM test_cases').get();
      if (count.cnt > 0) {
        console.log('[SQLiteStorage] Already have data, skipping JSON migration');
        return;
      }

      console.log(`[SQLiteStorage] Migrating ${jsonData.length} test cases from JSON...`);

      const insertTC = this.db.prepare(`
        INSERT OR REPLACE INTO test_cases 
        (id, name, title, description, folder_id, release_id, plan_id, 
         automation_status, priority, test_type, created_at, updated_at, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertStep = this.db.prepare(`
        INSERT OR REPLACE INTO test_steps
        (id, test_case_id, position, name, type, qword, args, selector, 
         selector_obj, value, expected_result, automation_status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction((testCases) => {
        for (const tc of testCases) {
          insertTC.run(
            tc.id,
            tc.name || tc.title,
            tc.title,
            tc.description,
            tc.folderId,
            tc.releaseId,
            tc.planId,
            tc.automationStatus || 'none',
            tc.priority,
            tc.test_type,
            tc.createdAt,
            tc.updatedAt,
            JSON.stringify(tc)
          );

          // Insert steps
          const steps = tc.steps || [];
          steps.forEach((step, idx) => {
            insertStep.run(
              step.id || `step_${tc.id}_${idx}`,
              tc.id,
              idx,
              step.name,
              step.type,
              step.qword,
              step.args ? JSON.stringify(step.args) : null,
              step.selector,
              step.selectorObj ? JSON.stringify(step.selectorObj) : null,
              step.value,
              step.expectedResult,
              step.automationStatus,
              JSON.stringify(step)
            );
          });
        }
      });

      transaction(jsonData);
      console.log('[SQLiteStorage] Migration complete');

      // Backup the JSON file
      fs.renameSync(jsonPath, jsonPath + '.bak');

    } catch (error) {
      console.error('[SQLiteStorage] Migration error:', error.message);
    }
  }

  // ============================================================
  // Test Cases API
  // ============================================================

  getTestCases(options = {}) {
    if (this.fallback) return this.fallback.getTestCases();

    const { 
      folderId, 
      status, 
      search, 
      tags, 
      limit = 1000, 
      offset = 0,
      sortBy = 'updated_at',
      sortOrder = 'DESC'
    } = options;

    let query = 'SELECT * FROM test_cases WHERE 1=1';
    const params = [];

    if (folderId) {
      query += ' AND folder_id = ?';
      params.push(folderId);
    }

    if (status && status !== 'all') {
      query += ' AND automation_status = ?';
      params.push(status);
    }

    if (search) {
      // Use FTS for search
      query = `
        SELECT tc.* FROM test_cases tc
        JOIN test_cases_fts fts ON tc.id = fts.id
        WHERE test_cases_fts MATCH ?
      `;
      params.length = 0;
      params.push(search + '*');
      
      if (folderId) {
        query += ' AND tc.folder_id = ?';
        params.push(folderId);
      }
      if (status && status !== 'all') {
        query += ' AND tc.automation_status = ?';
        params.push(status);
      }
    }

    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const rows = this.db.prepare(query).all(...params);
      
      // Parse JSON data and attach steps
      return rows.map(row => {
        const tc = row.data ? JSON.parse(row.data) : row;
        // Get steps
        const steps = this.db.prepare(
          'SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY position'
        ).all(row.id);
        
        return {
          ...tc,
          id: row.id,
          name: row.name,
          automationStatus: row.automation_status,
          steps: steps.map(s => s.data ? JSON.parse(s.data) : s)
        };
      });
    } catch (error) {
      console.error('[SQLiteStorage] getTestCases error:', error.message);
      return [];
    }
  }

  getTestCaseById(id) {
    if (this.fallback) {
      return this.fallback.getTestCases().find(tc => tc.id === id);
    }

    try {
      const row = this.db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
      if (!row) return null;

      const tc = row.data ? JSON.parse(row.data) : row;
      const steps = this.db.prepare(
        'SELECT * FROM test_steps WHERE test_case_id = ? ORDER BY position'
      ).all(id);

      return {
        ...tc,
        id: row.id,
        steps: steps.map(s => s.data ? JSON.parse(s.data) : s)
      };
    } catch (error) {
      console.error('[SQLiteStorage] getTestCaseById error:', error.message);
      return null;
    }
  }

  saveTestCase(testCase) {
    if (this.fallback) return this.fallback.saveTestCase(testCase);

    const now = new Date().toISOString();
    const tc = {
      ...testCase,
      updatedAt: now,
      createdAt: testCase.createdAt || now
    };

    try {
      const insertTC = this.db.prepare(`
        INSERT OR REPLACE INTO test_cases 
        (id, name, title, description, folder_id, release_id, plan_id, 
         automation_status, priority, test_type, created_at, updated_at, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const deleteSteps = this.db.prepare('DELETE FROM test_steps WHERE test_case_id = ?');
      
      const insertStep = this.db.prepare(`
        INSERT INTO test_steps
        (id, test_case_id, position, name, type, qword, args, selector, 
         selector_obj, value, expected_result, automation_status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction(() => {
        insertTC.run(
          tc.id,
          tc.name || tc.title,
          tc.title,
          tc.description,
          tc.folderId,
          tc.releaseId,
          tc.planId,
          tc.automationStatus || this.calculateStatus(tc),
          tc.priority,
          tc.test_type,
          tc.createdAt,
          tc.updatedAt,
          JSON.stringify(tc)
        );

        // Delete old steps and insert new ones
        deleteSteps.run(tc.id);

        const steps = tc.steps || [];
        steps.forEach((step, idx) => {
          insertStep.run(
            step.id || `step_${tc.id}_${idx}`,
            tc.id,
            idx,
            step.name,
            step.type,
            step.qword,
            step.args ? JSON.stringify(step.args) : null,
            step.selector,
            step.selectorObj ? JSON.stringify(step.selectorObj) : null,
            step.value,
            step.expectedResult,
            step.automationStatus,
            JSON.stringify(step)
          );
        });
      });

      transaction();
      
      // Add to sync queue
      this.addToSyncQueue('test_case', tc.id, 'upsert', tc);

      return tc;
    } catch (error) {
      console.error('[SQLiteStorage] saveTestCase error:', error.message);
      return testCase;
    }
  }

  deleteTestCase(id) {
    if (this.fallback) return this.fallback.deleteTestCase(id);

    try {
      this.db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
      this.addToSyncQueue('test_case', id, 'delete', null);
      return true;
    } catch (error) {
      console.error('[SQLiteStorage] deleteTestCase error:', error.message);
      return false;
    }
  }

  calculateStatus(tc) {
    const steps = tc.steps || [];
    if (steps.length === 0) return 'none';
    
    const automated = steps.filter(s => 
      (s.qword && s.args && s.args.length > 0) ||
      (s.selectorObj && Object.keys(s.selectorObj).length > 0) ||
      s.automationStatus === 'recorded'
    );
    
    if (automated.length === steps.length) return 'full';
    if (automated.length > 0) return 'partial';
    return 'none';
  }

  // ============================================================
  // Search API (Full-Text Search)
  // ============================================================

  searchTestCases(query, options = {}) {
    if (this.fallback) {
      const all = this.fallback.getTestCases();
      const q = query.toLowerCase();
      return all.filter(tc => 
        (tc.name || '').toLowerCase().includes(q) ||
        (tc.description || '').toLowerCase().includes(q)
      );
    }

    const { limit = 50, offset = 0 } = options;

    try {
      const rows = this.db.prepare(`
        SELECT tc.* FROM test_cases tc
        JOIN test_cases_fts fts ON tc.id = fts.id
        WHERE test_cases_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(query + '*', limit, offset);

      return rows.map(row => row.data ? JSON.parse(row.data) : row);
    } catch (error) {
      console.error('[SQLiteStorage] searchTestCases error:', error.message);
      return [];
    }
  }

  // ============================================================
  // Folders API
  // ============================================================

  getFolders() {
    if (this.fallback) {
      // Fallback reads from JSON file
      const filePath = path.join(this.dataDir, 'folders.json');
      try {
        if (fs.existsSync(filePath)) {
          return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (e) {}
      return [];
    }

    try {
      return this.db.prepare('SELECT * FROM folders ORDER BY position').all()
        .map(row => row.data ? JSON.parse(row.data) : row);
    } catch (error) {
      console.error('[SQLiteStorage] getFolders error:', error.message);
      return [];
    }
  }

  saveFolder(folder) {
    if (this.fallback) {
      const folders = this.getFolders();
      const idx = folders.findIndex(f => f.id === folder.id);
      if (idx >= 0) folders[idx] = folder;
      else folders.push(folder);
      const filePath = path.join(this.dataDir, 'folders.json');
      fs.writeFileSync(filePath, JSON.stringify(folders, null, 2));
      return folder;
    }

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO folders (id, name, parent_id, position, data)
        VALUES (?, ?, ?, ?, ?)
      `).run(folder.id, folder.name, folder.parentId, folder.position || 0, JSON.stringify(folder));
      return folder;
    } catch (error) {
      console.error('[SQLiteStorage] saveFolder error:', error.message);
      return folder;
    }
  }

  // ============================================================
  // Test Runs API
  // ============================================================

  getTestRuns(options = {}) {
    if (this.fallback) return this.fallback.getTestRuns();

    const { limit = 100, offset = 0 } = options;

    try {
      return this.db.prepare(
        'SELECT * FROM test_runs ORDER BY started_at DESC LIMIT ? OFFSET ?'
      ).all(limit, offset).map(row => row.data ? JSON.parse(row.data) : row);
    } catch (error) {
      console.error('[SQLiteStorage] getTestRuns error:', error.message);
      return [];
    }
  }

  saveTestRun(testRun) {
    if (this.fallback) return this.fallback.saveTestRun(testRun);

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO test_runs 
        (id, name, mode, status, started_at, ended_at, release_id, plan_id, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        testRun.id,
        testRun.name,
        testRun.mode,
        testRun.status,
        testRun.startedAt || testRun.startTime,
        testRun.endedAt || testRun.endTime,
        testRun.releaseId,
        testRun.planId,
        JSON.stringify(testRun)
      );
      return testRun;
    } catch (error) {
      console.error('[SQLiteStorage] saveTestRun error:', error.message);
      return testRun;
    }
  }

  // ============================================================
  // Sync Queue API
  // ============================================================

  addToSyncQueue(entityType, entityId, operation, payload) {
    if (this.fallback) return;

    try {
      this.db.prepare(`
        INSERT INTO sync_queue (entity_type, entity_id, operation, payload)
        VALUES (?, ?, ?, ?)
      `).run(entityType, entityId, operation, payload ? JSON.stringify(payload) : null);
    } catch (error) {
      console.error('[SQLiteStorage] addToSyncQueue error:', error.message);
    }
  }

  getPendingSync(limit = 100) {
    if (this.fallback) return [];

    try {
      return this.db.prepare(`
        SELECT * FROM sync_queue 
        WHERE attempts < 3
        ORDER BY created_at 
        LIMIT ?
      `).all(limit);
    } catch (error) {
      console.error('[SQLiteStorage] getPendingSync error:', error.message);
      return [];
    }
  }

  markSynced(ids) {
    if (this.fallback || !ids.length) return;

    try {
      const placeholders = ids.map(() => '?').join(',');
      this.db.prepare(`DELETE FROM sync_queue WHERE id IN (${placeholders})`).run(...ids);
    } catch (error) {
      console.error('[SQLiteStorage] markSynced error:', error.message);
    }
  }

  // ============================================================
  // Stats API
  // ============================================================

  getStats() {
    if (this.fallback) {
      const tc = this.fallback.getTestCases();
      return {
        testCases: tc.length,
        automated: tc.filter(t => t.automationStatus === 'full').length,
        partial: tc.filter(t => t.automationStatus === 'partial').length,
        manual: tc.filter(t => !t.automationStatus || t.automationStatus === 'none').length
      };
    }

    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN automation_status = 'full' THEN 1 ELSE 0 END) as automated,
          SUM(CASE WHEN automation_status = 'partial' THEN 1 ELSE 0 END) as partial,
          SUM(CASE WHEN automation_status = 'none' OR automation_status IS NULL THEN 1 ELSE 0 END) as manual
        FROM test_cases
      `).get();

      return {
        testCases: stats.total,
        automated: stats.automated,
        partial: stats.partial,
        manual: stats.manual
      };
    } catch (error) {
      console.error('[SQLiteStorage] getStats error:', error.message);
      return { testCases: 0, automated: 0, partial: 0, manual: 0 };
    }
  }

  // ============================================================
  // Export/Import
  // ============================================================

  exportAll() {
    return {
      testCases: this.getTestCases({ limit: 100000 }),
      testRuns: this.getTestRuns({ limit: 10000 }),
      folders: this.getFolders(),
      exportedAt: new Date().toISOString(),
      version: '3.0-sqlite'
    };
  }

  clearAll() {
    if (this.fallback) return this.fallback.clearAll();

    try {
      this.db.exec('DELETE FROM test_steps');
      this.db.exec('DELETE FROM test_cases');
      this.db.exec('DELETE FROM test_runs');
      this.db.exec('DELETE FROM folders');
      this.db.exec('DELETE FROM sync_queue');
      console.log('[SQLiteStorage] All data cleared');
      return true;
    } catch (error) {
      console.error('[SQLiteStorage] clearAll error:', error.message);
      return false;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = SQLiteStorage;



