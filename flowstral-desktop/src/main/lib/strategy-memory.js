/**
 * Strategy Memory - Learn and remember which strategies work for elements
 * 
 * Simple learning system:
 * 1. Remembers which strategy succeeded for each element
 * 2. Uses that strategy FIRST on subsequent playbacks
 * 3. Persists between sessions for within-environment speedup
 * 
 * NOTE: For cross-environment optimization, use optimizedSelector in test steps
 * (set via "Lock Locators" after successful run)
 * 
 * @author Flowstral
 * @version 1.1.0 - Simplified
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// STRATEGY MEMORY CLASS
// ============================================================================

class StrategyMemory {
  constructor(options = {}) {
    // Memory storage: fingerprint -> strategy info
    this.memory = new Map();
    
    // Strategy success counters (global)
    this.strategyStats = {};
    
    // Options
    this.persistPath = options.persistPath || null;
    this.maxMemorySize = options.maxMemorySize || 10000;
    
    // Load persisted memory if available
    if (this.persistPath) {
      this._loadFromDisk();
    }
  }
  
  // ==========================================================================
  // FINGERPRINTING
  // ==========================================================================
  
  /**
   * Create a fingerprint for an element based on its recipe
   */
  createFingerprint(recipe, action = {}) {
    const parts = [];
    
    if (action.type) {
      parts.push(`type:${action.type}`);
    }
    
    if (recipe?.what?.role) {
      parts.push(`role:${recipe.what.role}`);
    }
    if (recipe?.what?.text) {
      const normalizedText = this._normalizeTextForFingerprint(recipe.what.text);
      if (normalizedText) {
        parts.push(`text:${normalizedText}`);
      }
    }
    
    if (recipe?.where?.landmark) {
      parts.push(`landmark:${recipe.where.landmark}`);
    }
    
    if (recipe?.which?.testId) {
      parts.push(`testId:${recipe.which.testId}`);
    }
    if (recipe?.which?.ariaLabel) {
      const normalizedLabel = this._normalizeTextForFingerprint(recipe.which.ariaLabel);
      if (normalizedLabel) {
        parts.push(`ariaLabel:${normalizedLabel}`);
      }
    }
    
    if (recipe?.which?.position) {
      parts.push(`pos:${recipe.which.position}`);
    }
    
    const fingerprintString = parts.join('|');
    return this._hash(fingerprintString);
  }
  
  _normalizeTextForFingerprint(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s#]/g, '')
      .trim()
      .substring(0, 50);
  }
  
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `fp_${Math.abs(hash).toString(36)}`;
  }
  
  // ==========================================================================
  // MEMORY OPERATIONS
  // ==========================================================================
  
  /**
   * Get the best strategy to try first for this element
   * Returns null if no memory exists
   */
  getBestStrategy(fingerprint) {
    const entry = this.memory.get(fingerprint);
    if (!entry) return null;
    
    // Check if memory has good success rate (>70%)
    if (entry.successCount > 0) {
      const successRate = entry.successCount / (entry.successCount + entry.failCount);
      if (successRate >= 0.7) {
        console.log(`[StrategyMemory] Using cached: "${entry.strategy}" (${Math.round(successRate * 100)}% success)`);
        return {
          strategy: entry.strategy,
          selector: entry.selector,
          confidence: successRate
        };
      }
    }
    
    return null;
  }
  
  /**
   * Record a successful strategy
   */
  recordSuccess(fingerprint, strategy, selector = null, executionTimeMs = null) {
    let entry = this.memory.get(fingerprint) || {
      strategy: strategy,
      selector: selector,
      successCount: 0,
      failCount: 0,
      createdAt: Date.now()
    };
    
    entry.strategy = strategy;
    if (selector) entry.selector = selector;
    entry.successCount++;
    entry.lastSuccess = Date.now();
    
    if (executionTimeMs !== null) {
      entry.avgExecutionTime = entry.avgExecutionTime 
        ? (entry.avgExecutionTime * 0.8) + (executionTimeMs * 0.2)
        : executionTimeMs;
    }
    
    this.memory.set(fingerprint, entry);
    this._updateStrategyStats(strategy, true);
    this._maybePersist();
    
    console.log(`[StrategyMemory] Recorded success: "${strategy}" (${entry.successCount} total)`);
  }
  
  /**
   * Record a failed attempt
   */
  recordFailure(fingerprint, strategy) {
    const entry = this.memory.get(fingerprint);
    if (!entry) return;
    
    entry.failCount++;
    this.memory.set(fingerprint, entry);
    this._updateStrategyStats(strategy, false);
    
    // Clear if too many failures
    const failRate = entry.failCount / (entry.successCount + entry.failCount);
    if (failRate > 0.5 && entry.failCount >= 3) {
      console.log(`[StrategyMemory] Clearing unreliable entry: ${fingerprint}`);
      this.memory.delete(fingerprint);
      this._maybePersist();
    }
    
    console.log(`[StrategyMemory] Recorded failure: "${strategy}"`);
  }
  
  _updateStrategyStats(strategy, success) {
    if (!this.strategyStats[strategy]) {
      this.strategyStats[strategy] = { successes: 0, failures: 0 };
    }
    if (success) {
      this.strategyStats[strategy].successes++;
    } else {
      this.strategyStats[strategy].failures++;
    }
  }
  
  /**
   * Clear all entries
   */
  clearAll() {
    const count = this.memory.size;
    this.memory.clear();
    this.strategyStats = {};
    this._maybePersist();
    console.log(`[StrategyMemory] Cleared ${count} entries`);
    return count;
  }
  
  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================
  
  _maybePersist() {
    if (!this.persistPath) return;
    if (this._lastPersist && Date.now() - this._lastPersist < 5000) return;
    this._persistToDisk();
  }
  
  _persistToDisk() {
    if (!this.persistPath) return;
    
    try {
      const data = {
        memory: Array.from(this.memory.entries()),
        strategyStats: this.strategyStats,
        savedAt: Date.now()
      };
      
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
      this._lastPersist = Date.now();
      console.log(`[StrategyMemory] Saved ${this.memory.size} entries`);
    } catch (e) {
      console.error('[StrategyMemory] Failed to persist:', e.message);
    }
  }
  
  _loadFromDisk() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) {
      console.log('[StrategyMemory] No saved memory found, starting fresh');
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.memory = new Map(data.memory || []);
      this.strategyStats = data.strategyStats || {};
      console.log(`[StrategyMemory] Loaded ${this.memory.size} cached strategies`);
    } catch (e) {
      console.error('[StrategyMemory] Failed to load:', e.message);
    }
  }
  
  // ==========================================================================
  // STATS
  // ==========================================================================
  
  getStats() {
    const entries = Array.from(this.memory.values());
    const totalSuccesses = entries.reduce((sum, e) => sum + e.successCount, 0);
    const totalFailures = entries.reduce((sum, e) => sum + e.failCount, 0);
    
    return {
      totalEntries: this.memory.size,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalSuccesses / (totalSuccesses + totalFailures + 1)
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance = null;

function getStrategyMemory(options = {}) {
  if (!instance) {
    const defaultPath = options.persistPath || 
      (process.env.APPDATA ? 
        path.join(process.env.APPDATA, 'flowstral', 'strategy-memory.json') :
        path.join(__dirname, '..', '..', '..', 'data', 'strategy-memory.json'));
    
    const dir = path.dirname(defaultPath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.error(`[StrategyMemory] Failed to create directory:`, e.message);
    }
    
    instance = new StrategyMemory({
      persistPath: defaultPath,
      ...options
    });
  }
  return instance;
}

module.exports = {
  StrategyMemory,
  getStrategyMemory
};
