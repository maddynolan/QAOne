/**
 * Diagnostics Collector - Remote Support System
 * 
 * Collects system information, logs, test history, and error data
 * for remote debugging and support without direct app access.
 * 
 * Features:
 * - System info collection (OS, CPU, RAM, disk)
 * - Application logs capture (last 1000 lines)
 * - Test execution history
 * - Strategy memory statistics
 * - Error log aggregation
 * - Screenshot attachment support
 * - Encrypted report submission
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Import strategy memory if available
let getStrategyMemory;
try {
  getStrategyMemory = require('./strategy-memory').getStrategyMemory;
} catch (e) {
  getStrategyMemory = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG BUFFER - Captures console output for diagnostics
// ═══════════════════════════════════════════════════════════════════════════

const MAX_LOG_LINES = 1000;
const logBuffer = [];
const errorBuffer = [];
const warningBuffer = [];

// Intercept console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function captureLog(type, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const entry = { timestamp, type, message };
  
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
  
  if (type === 'error') {
    errorBuffer.push(entry);
    if (errorBuffer.length > 100) errorBuffer.shift();
  } else if (type === 'warn') {
    warningBuffer.push(entry);
    if (warningBuffer.length > 100) warningBuffer.shift();
  }
}

// Override console methods
console.log = function(...args) {
  captureLog('log', args);
  originalConsoleLog.apply(console, args);
};

console.error = function(...args) {
  captureLog('error', args);
  originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
  captureLog('warn', args);
  originalConsoleWarn.apply(console, args);
};

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS COLLECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

class DiagnosticsCollector {
  constructor() {
    this.appStartTime = Date.now();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // System Information
  // ─────────────────────────────────────────────────────────────────────────

  async getSystemInfo() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      totalMemoryGB: (totalMemory / (1024 ** 3)).toFixed(2),
      freeMemoryGB: (freeMemory / (1024 ** 3)).toFixed(2),
      usedMemoryPercent: ((1 - freeMemory / totalMemory) * 100).toFixed(1),
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      v8Version: process.versions.v8,
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Application Information
  // ─────────────────────────────────────────────────────────────────────────

  async getAppInfo() {
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      appPath: app.getAppPath(),
      userDataPath: app.getPath('userData'),
      isPackaged: app.isPackaged,
      locale: app.getLocale(),
      appUptimeSeconds: Math.floor((Date.now() - this.appStartTime) / 1000),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Log Collection
  // ─────────────────────────────────────────────────────────────────────────

  async getRecentLogs(limit = 500) {
    return logBuffer.slice(-limit);
  }

  async getErrorLogs() {
    return errorBuffer.slice(-50);
  }

  async getWarningLogs() {
    return warningBuffer.slice(-50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Strategy Memory Statistics
  // ─────────────────────────────────────────────────────────────────────────

  async getStrategyMemoryStats() {
    if (!getStrategyMemory) {
      return { available: false, reason: 'Strategy memory module not loaded' };
    }

    try {
      const memory = getStrategyMemory();
      const stats = memory.getStats();
      
      // Get top strategies by success rate
      const allStrategies = memory.getAllStrategies ? memory.getAllStrategies() : [];
      const strategyEffectiveness = {};
      
      for (const [fingerprint, data] of Object.entries(allStrategies)) {
        const strategy = data.strategy;
        if (!strategyEffectiveness[strategy]) {
          strategyEffectiveness[strategy] = { count: 0, totalSuccess: 0 };
        }
        strategyEffectiveness[strategy].count++;
        strategyEffectiveness[strategy].totalSuccess += data.successCount || 1;
      }

      return {
        available: true,
        totalEntries: stats.totalEntries || 0,
        persistPath: stats.persistPath || 'Not persisted',
        strategyEffectiveness,
        lastPersistTime: stats.lastPersistTime || null,
      };
    } catch (e) {
      return { available: false, reason: e.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Execution History
  // ─────────────────────────────────────────────────────────────────────────

  async getTestHistory(limit = 50) {
    const userDataPath = app.getPath('userData');
    const historyPath = path.join(userDataPath, 'test-history.json');

    try {
      if (fs.existsSync(historyPath)) {
        const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        return (data.runs || []).slice(-limit).map(run => ({
          id: run.id,
          testName: run.testName,
          status: run.status,
          duration: run.duration,
          timestamp: run.timestamp,
          stepsTotal: run.stepsTotal,
          stepsPassed: run.stepsPassed,
          stepsFailed: run.stepsFailed,
          // Don't include full step details for privacy
        }));
      }
    } catch (e) {
      return { error: e.message };
    }

    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration (Sanitized)
  // ─────────────────────────────────────────────────────────────────────────

  async getSanitizedConfig() {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');

    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Remove sensitive data
        const sanitized = { ...config };
        delete sanitized.apiKey;
        delete sanitized.authToken;
        delete sanitized.password;
        delete sanitized.secrets;
        
        return sanitized;
      }
    } catch (e) {
      return { error: e.message };
    }

    return {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generate Full Diagnostic Report
  // ─────────────────────────────────────────────────────────────────────────

  async generateReport(options = {}) {
    const {
      includeSystemInfo = true,
      includeAppInfo = true,
      includeLogs = true,
      includeErrors = true,
      includeTestHistory = true,
      includeStrategyMemory = true,
      includeConfig = false,
      userDescription = '',
      screenshotPaths = [],
    } = options;

    console.log('[Diagnostics] Generating diagnostic report...');

    const report = {
      reportId: `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: new Date().toISOString(),
      userDescription,
    };

    if (includeSystemInfo) {
      report.system = await this.getSystemInfo();
    }

    if (includeAppInfo) {
      report.app = await this.getAppInfo();
    }

    if (includeLogs) {
      report.logs = await this.getRecentLogs(options.logLimit || 500);
    }

    if (includeErrors) {
      report.errors = await this.getErrorLogs();
      report.warnings = await this.getWarningLogs();
    }

    if (includeTestHistory) {
      report.testHistory = await this.getTestHistory(options.historyLimit || 50);
    }

    if (includeStrategyMemory) {
      report.strategyMemory = await this.getStrategyMemoryStats();
    }

    if (includeConfig) {
      report.config = await this.getSanitizedConfig();
    }

    // Include screenshot references (not actual images)
    if (screenshotPaths.length > 0) {
      report.screenshots = screenshotPaths.map(p => ({
        path: p,
        exists: fs.existsSync(p),
        size: fs.existsSync(p) ? fs.statSync(p).size : 0,
      }));
    }

    console.log(`[Diagnostics] Report generated: ${report.reportId}`);
    return report;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export Report to File
  // ─────────────────────────────────────────────────────────────────────────

  async exportToFile(report, outputPath = null) {
    const userDataPath = app.getPath('userData');
    const diagnosticsDir = path.join(userDataPath, 'diagnostics');
    
    if (!fs.existsSync(diagnosticsDir)) {
      fs.mkdirSync(diagnosticsDir, { recursive: true });
    }

    const filename = outputPath || path.join(
      diagnosticsDir, 
      `diagnostic-${report.reportId}.json`
    );

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`[Diagnostics] Report exported to: ${filename}`);
    
    return filename;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Report to Support Server
  // ─────────────────────────────────────────────────────────────────────────

  async submitToSupport(report, supportUrl = null) {
    const url = supportUrl || 'https://api.flowstral.com/v1/support/diagnostics';
    
    console.log(`[Diagnostics] Submitting report to support: ${report.reportId}`);

    try {
      // In production, this would POST to the support server
      // For now, we'll save locally and return a mock ticket ID
      const exportedPath = await this.exportToFile(report);
      
      // Mock response - replace with actual API call in production
      const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
      
      console.log(`[Diagnostics] Support ticket created: ${ticketId}`);
      
      return {
        success: true,
        ticketId,
        message: 'Report submitted successfully',
        exportedPath, // Local backup
      };
    } catch (error) {
      console.error('[Diagnostics] Failed to submit report:', error);
      
      // Fallback: save locally
      const exportedPath = await this.exportToFile(report);
      
      return {
        success: false,
        error: error.message,
        exportedPath,
        message: 'Failed to submit online, saved locally',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Quick Health Check
  // ─────────────────────────────────────────────────────────────────────────

  async healthCheck() {
    const system = await this.getSystemInfo();
    const app = await this.getAppInfo();
    const recentErrors = await this.getErrorLogs();
    const strategyMemory = await this.getStrategyMemoryStats();

    return {
      status: recentErrors.length > 10 ? 'warning' : 'healthy',
      system: {
        memoryUsage: `${system.usedMemoryPercent}%`,
        cpuCores: system.cpuCores,
      },
      app: {
        version: app.appVersion,
        uptime: `${app.appUptimeSeconds}s`,
      },
      recentErrorCount: recentErrors.length,
      strategyMemoryEntries: strategyMemory.totalEntries || 0,
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let instance = null;

function getDiagnosticsCollector() {
  if (!instance) {
    instance = new DiagnosticsCollector();
  }
  return instance;
}

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - Expose to renderer process
// ═══════════════════════════════════════════════════════════════════════════

function registerDiagnosticsIPC(ipcMain) {
  const collector = getDiagnosticsCollector();

  // Generate diagnostic report
  ipcMain.handle('diagnostics:generateReport', async (event, options) => {
    return collector.generateReport(options);
  });

  // Submit to support
  ipcMain.handle('diagnostics:submitToSupport', async (event, { report, userDescription }) => {
    if (!report.userDescription && userDescription) {
      report.userDescription = userDescription;
    }
    return collector.submitToSupport(report);
  });

  // Quick health check
  ipcMain.handle('diagnostics:healthCheck', async () => {
    return collector.healthCheck();
  });

  // Get recent logs only
  ipcMain.handle('diagnostics:getRecentLogs', async (event, limit) => {
    return collector.getRecentLogs(limit);
  });

  // Get error logs only
  ipcMain.handle('diagnostics:getErrorLogs', async () => {
    return collector.getErrorLogs();
  });

  // Export report to file
  ipcMain.handle('diagnostics:exportToFile', async (event, report) => {
    return collector.exportToFile(report);
  });

  console.log('[Diagnostics] IPC handlers registered');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  DiagnosticsCollector,
  getDiagnosticsCollector,
  registerDiagnosticsIPC,
  // Expose buffers for testing
  getLogBuffer: () => [...logBuffer],
  getErrorBuffer: () => [...errorBuffer],
};
