/**
 * Strategy Memory - Learn and remember which strategies work for elements
 * 
 * This implements a "learning" system that:
 * 1. Remembers which strategy succeeded for each element
 * 2. Uses that strategy FIRST on subsequent playbacks (fast path)
 * 3. Tracks success rates to optimize strategy ordering
 * 4. Can auto-heal recipes with better selectors
 * 
 * @author Flowstral
 * @version 1.0.0
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
    this.persistPath = options.persistPath || null;  // Path to save memory between sessions
    this.maxMemorySize = options.maxMemorySize || 10000;  // Max entries to prevent memory bloat
    this.enableAutoHeal = options.enableAutoHeal !== false;  // Auto-update recipes
    
    // Load persisted memory if available
    if (this.persistPath) {
      this._loadFromDisk();
    }
  }
  
  // ==========================================================================
  // FINGERPRINTING - Create unique identifier for elements
  // ==========================================================================
  
  /**
   * Create a fingerprint for an element based on its recipe
   * The fingerprint should be stable across minor DOM changes
   */
  createFingerprint(recipe, action = {}) {
    const parts = [];
    
    // Include action type (click, fill, etc.)
    if (action.type) {
      parts.push(`type:${action.type}`);
    }
    
    // What: role + text (primary identifiers)
    if (recipe?.what?.role) {
      parts.push(`role:${recipe.what.role}`);
    }
    if (recipe?.what?.text) {
      // Normalize text for fingerprint (remove dynamic parts)
      const normalizedText = this._normalizeTextForFingerprint(recipe.what.text);
      if (normalizedText) {
        parts.push(`text:${normalizedText}`);
      }
    }
    
    // Where: landmark context
    if (recipe?.where?.landmark) {
      parts.push(`landmark:${recipe.where.landmark}`);
    }
    if (recipe?.where?.within) {
      parts.push(`within:${recipe.where.within}`);
    }
    
    // Which: stable identifiers only
    if (recipe?.which?.testId) {
      parts.push(`testId:${recipe.which.testId}`);
    }
    if (recipe?.which?.name) {
      parts.push(`name:${recipe.which.name}`);
    }
    if (recipe?.which?.ariaLabel) {
      const normalizedLabel = this._normalizeTextForFingerprint(recipe.which.ariaLabel);
      if (normalizedLabel) {
        parts.push(`ariaLabel:${normalizedLabel}`);
      }
    }
    
    // Position as tiebreaker (less stable but useful)
    if (recipe?.which?.position) {
      parts.push(`pos:${recipe.which.position}`);
    }
    
    // Create hash of combined parts
    const fingerprintString = parts.join('|');
    return this._hash(fingerprintString);
  }
  
  /**
   * Normalize text for fingerprinting (remove dynamic content)
   */
  _normalizeTextForFingerprint(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .toLowerCase()
      .replace(/\d+/g, '#')  // Replace numbers with # (handles dynamic IDs, counts)
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[^\w\s#]/g, '')  // Remove special chars except # placeholder
      .trim()
      .substring(0, 50);  // Limit length
  }
  
  /**
   * Simple hash function for fingerprints
   */
  _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;  // Convert to 32bit integer
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
    
    if (!entry) {
      // Only log occasionally to avoid spam (every 10th miss)
      if (Math.random() < 0.1) {
        console.log(`[StrategyMemory] No cached strategy for: ${fingerprint} (${this.memory.size} total entries)`);
      }
      return null;
    }
    
    // Check if memory is still "fresh" (success rate > 80%)
    if (entry.successCount > 0) {
      const successRate = entry.successCount / (entry.successCount + entry.failCount);
      if (successRate >= 0.8) {
        const avgTime = entry.avgExecutionTime ? `${Math.round(entry.avgExecutionTime)}ms avg` : '';
        console.log(`[StrategyMemory] 🚀 Fast path: "${entry.strategy}" (${Math.round(successRate * 100)}% success, used ${entry.successCount}x) ${avgTime}`);
        return {
          strategy: entry.strategy,
          selector: entry.selector,
          confidence: successRate,
          timesUsed: entry.successCount + entry.failCount
        };
      } else {
        console.log(`[StrategyMemory] Entry found but low success rate: ${Math.round(successRate * 100)}% (${entry.failCount} failures)`);
      }
    }
    
    return null;
  }
  
  /**
   * Record a successful strategy for future use
   */
  recordSuccess(fingerprint, strategy, selector = null, executionTimeMs = null) {
    let entry = this.memory.get(fingerprint);
    const isNewEntry = !entry;
    const strategyChanged = entry && entry.strategy !== strategy;
    
    if (!entry) {
      entry = {
        strategy: strategy,
        selector: selector,
        successCount: 0,
        failCount: 0,
        lastSuccess: null,
        avgExecutionTime: null,
        createdAt: Date.now()
      };
    }
    
    // Update entry
    entry.strategy = strategy;  // Always update to latest successful strategy
    if (selector) entry.selector = selector;
    entry.successCount++;
    entry.lastSuccess = Date.now();
    
    // Update average execution time
    if (executionTimeMs !== null) {
      if (entry.avgExecutionTime === null) {
        entry.avgExecutionTime = executionTimeMs;
      } else {
        // Rolling average
        entry.avgExecutionTime = (entry.avgExecutionTime * 0.8) + (executionTimeMs * 0.2);
      }
    }
    
    this.memory.set(fingerprint, entry);
    
    // Update global strategy stats
    this._updateStrategyStats(strategy, true);
    
    // Persist IMMEDIATELY for new entries or strategy changes (important learning)
    // These are the most valuable learnings to not lose
    const forcePersist = isNewEntry || strategyChanged;
    this._maybePersist(forcePersist);
    
    const logSuffix = forcePersist ? ' [PERSISTED IMMEDIATELY]' : '';
    console.log(`[StrategyMemory] Recorded success: "${strategy}" for ${fingerprint} (${entry.successCount} successes)${logSuffix}`);
  }
  
  /**
   * Record a failed attempt (the remembered strategy didn't work)
   */
  recordFailure(fingerprint, strategy) {
    const entry = this.memory.get(fingerprint);
    if (!entry) return;
    
    entry.failCount++;
    this.memory.set(fingerprint, entry);
    
    // Update global strategy stats
    this._updateStrategyStats(strategy, false);
    
    // If strategy has failed too many times, clear it entirely
    const failRate = entry.failCount / (entry.successCount + entry.failCount);
    if (failRate > 0.5 && entry.failCount >= 2) {
      console.log(`[StrategyMemory] Clearing entry for ${fingerprint} - too many failures (${failRate * 100}% fail rate)`);
      this.memory.delete(fingerprint);
      this._maybePersist();
    }
    
    console.log(`[StrategyMemory] Recorded failure: "${strategy}" for ${fingerprint}`);
  }
  
  /**
   * Clear a specific entry by fingerprint
   */
  clearEntry(fingerprint) {
    if (this.memory.has(fingerprint)) {
      this.memory.delete(fingerprint);
      this._maybePersist();
      console.log(`[StrategyMemory] Cleared entry: ${fingerprint}`);
      return true;
    }
    return false;
  }
  
  /**
   * Clear all entries (reset the memory)
   */
  clearAll() {
    const count = this.memory.size;
    this.memory.clear();
    this.strategyStats = {};
    this._maybePersist();
    console.log(`[StrategyMemory] Cleared all ${count} entries`);
    return count;
  }
  
  /**
   * Clear entries matching a pattern (useful for clearing bad patterns)
   */
  clearByPattern(pattern) {
    let cleared = 0;
    const regex = new RegExp(pattern);
    for (const [fingerprint, entry] of this.memory.entries()) {
      if (regex.test(fingerprint) || (entry.selector && regex.test(entry.selector))) {
        this.memory.delete(fingerprint);
        cleared++;
      }
    }
    if (cleared > 0) {
      this._maybePersist();
      console.log(`[StrategyMemory] Cleared ${cleared} entries matching pattern: ${pattern}`);
    }
    return cleared;
  }
  
  /**
   * Update global strategy statistics
   */
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
   * Get strategies ordered by success rate (most successful first)
   */
  getStrategyOrdering() {
    const strategies = Object.entries(this.strategyStats)
      .map(([strategy, stats]) => ({
        strategy,
        successRate: stats.successes / (stats.successes + stats.failures + 1),
        totalUses: stats.successes + stats.failures
      }))
      .filter(s => s.totalUses >= 5)  // Only include strategies with enough data
      .sort((a, b) => b.successRate - a.successRate);
    
    return strategies;
  }
  
  // ==========================================================================
  // RECIPE AUTO-HEALING
  // ==========================================================================
  
  /**
   * Generate healed recipe with additional/better selectors
   * Called when a different strategy than recorded succeeds
   */
  generateHealedRecipe(originalRecipe, successfulStrategy, selector) {
    if (!this.enableAutoHeal) return null;
    
    const healed = JSON.parse(JSON.stringify(originalRecipe));  // Deep clone
    
    // Add the successful selector to the recipe
    if (!healed.healedSelectors) {
      healed.healedSelectors = [];
    }
    
    healed.healedSelectors.push({
      strategy: successfulStrategy,
      selector: selector,
      addedAt: Date.now()
    });
    
    // Mark as healed
    healed._healed = true;
    healed._healedAt = Date.now();
    
    return healed;
  }
  
  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================
  
  /**
   * Save memory to disk (if configured)
   * @param {boolean} force - Force immediate persist (skip throttle)
   */
  _maybePersist(force = false) {
    if (!this.persistPath) return;
    
    // Throttle writes (max once per 2 seconds) UNLESS forced
    // Reduced from 5s to 2s for faster learning
    if (!force && this._lastPersist && Date.now() - this._lastPersist < 2000) {
      return;
    }
    
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
      console.log(`[StrategyMemory] Persisted ${this.memory.size} entries to disk`);
    } catch (e) {
      console.error('[StrategyMemory] Failed to persist:', e.message);
    }
  }
  
  _loadFromDisk() {
    if (!this.persistPath) {
      console.log('[StrategyMemory] No persist path configured - memory will not persist');
      return;
    }
    
    if (!fs.existsSync(this.persistPath)) {
      console.log(`[StrategyMemory] No existing memory file at: ${this.persistPath}`);
      console.log('[StrategyMemory] Will create new file when strategies are learned');
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
      this.memory = new Map(data.memory || []);
      this.strategyStats = data.strategyStats || {};
      
      // Log loaded stats for debugging
      const stats = this.getStats();
      console.log(`[StrategyMemory] ✅ Loaded ${this.memory.size} learned strategies from: ${this.persistPath}`);
      console.log(`[StrategyMemory] Stats: ${stats.totalSuccesses} successes, ${Math.round(stats.overallSuccessRate * 100)}% success rate`);
      if (stats.topStrategies.length > 0) {
        console.log(`[StrategyMemory] Top strategy: ${stats.topStrategies[0]?.strategy} (${Math.round(stats.topStrategies[0]?.successRate * 100)}%)`);
      }
    } catch (e) {
      console.error('[StrategyMemory] Failed to load:', e.message);
    }
  }
  
  // ==========================================================================
  // STATS & DEBUGGING
  // ==========================================================================
  
  /**
   * Get memory statistics
   */
  getStats() {
    const entries = Array.from(this.memory.values());
    const totalSuccesses = entries.reduce((sum, e) => sum + e.successCount, 0);
    const totalFailures = entries.reduce((sum, e) => sum + e.failCount, 0);
    
    return {
      totalEntries: this.memory.size,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalSuccesses / (totalSuccesses + totalFailures + 1),
      topStrategies: this.getStrategyOrdering().slice(0, 5),
      avgExecutionTime: entries
        .filter(e => e.avgExecutionTime)
        .reduce((sum, e, _, arr) => sum + e.avgExecutionTime / arr.length, 0)
    };
  }
  
  /**
   * Clear all memory (for testing)
   */
  clear() {
    this.memory.clear();
    this.strategyStats = {};
    console.log('[StrategyMemory] Memory cleared');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Create singleton with default persistence path
let instance = null;

function getStrategyMemory(options = {}) {
  if (!instance) {
    // Default persist path: in the app's data directory
    const defaultPath = options.persistPath || 
      (process.env.APPDATA ? 
        path.join(process.env.APPDATA, 'flowstral', 'strategy-memory.json') :
        path.join(__dirname, '..', '..', '..', 'data', 'strategy-memory.json'));
    
    // Ensure directory exists before creating instance
    const dir = path.dirname(defaultPath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[StrategyMemory] Created directory: ${dir}`);
      }
    } catch (e) {
      console.error(`[StrategyMemory] Failed to create directory ${dir}:`, e.message);
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
