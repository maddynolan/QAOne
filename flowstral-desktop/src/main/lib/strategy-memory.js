/**
 * Strategy Memory - Learn and remember which strategies work for elements
 * 
 * This implements a "learning" system that:
 * 1. Remembers which strategy succeeded for each element
 * 2. Uses that strategy FIRST on subsequent playbacks (fast path)
 * 3. Tracks success rates to optimize strategy ordering
 * 4. Can auto-heal recipes with better selectors
 * 5. Promotes to "optimized" after N consecutive successes (50ms fast path)
 * 6. Detects "flaky" locators that keep failing/recovering
 * 
 * @author Flowstral
 * @version 2.0.0 - With optimization tiers and flaky detection
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONSTANTS - Optimization Thresholds
// ============================================================================

const OPTIMIZATION_CONFIG = {
  // Consecutive successes needed to promote to "optimized"
  CONSECUTIVE_SUCCESSES_TO_OPTIMIZE: 3,
  
  // Consecutive failures to demote from "optimized"
  CONSECUTIVE_FAILURES_TO_DEMOTE: 2,
  
  // Flip-flop threshold to mark as "flaky" (success→fail→success→fail pattern)
  FLAKY_FLIP_FLOP_THRESHOLD: 4,
  
  // Timeout for optimized strategies (much faster)
  OPTIMIZED_TIMEOUT_MS: 50,
  
  // Timeout for learning strategies (standard)
  LEARNING_TIMEOUT_MS: 5000,
  
  // Max history to track for flaky detection
  MAX_HISTORY_LENGTH: 10,
};

// ============================================================================
// STRATEGY MEMORY CLASS
// ============================================================================

class StrategyMemory {
  constructor(options = {}) {
    // Memory storage: fingerprint -> strategy info
    this.memory = new Map();
    
    // Strategy success counters (global)
    this.strategyStats = {};
    
    // Flaky locators - fingerprints that are unstable
    this.flakyLocators = new Set();
    
    // Options
    this.persistPath = options.persistPath || null;  // Path to save memory between sessions
    this.maxMemorySize = options.maxMemorySize || 10000;  // Max entries to prevent memory bloat
    this.enableAutoHeal = options.enableAutoHeal !== false;  // Auto-update recipes
    
    // Configurable thresholds
    this.config = { ...OPTIMIZATION_CONFIG, ...options.config };
    
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
   * 
   * Returns: {
   *   strategy: string,
   *   selector: string,
   *   confidence: number,
   *   isOptimized: boolean,      // True = use fast timeout (50ms)
   *   isFlaky: boolean,          // True = unstable, watch closely
   *   recommendedTimeout: number // 50ms for optimized, 5000ms otherwise
   * }
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
    
    const isFlaky = this.flakyLocators.has(fingerprint) || entry.isFlaky;
    const isOptimized = entry.isOptimized && !isFlaky;
    
    // Check if memory is still "fresh" (success rate > 80%)
    if (entry.successCount > 0) {
      const successRate = entry.successCount / (entry.successCount + entry.failCount);
      if (successRate >= 0.8 || isOptimized) {
        const avgTime = entry.avgExecutionTime ? `${Math.round(entry.avgExecutionTime)}ms avg` : '';
        const statusIcon = isOptimized ? '⚡' : (isFlaky ? '⚠️' : '🚀');
        const status = isOptimized ? 'OPTIMIZED' : (isFlaky ? 'FLAKY' : 'Learning');
        
        console.log(`[StrategyMemory] ${statusIcon} ${status}: "${entry.strategy}" (${entry.consecutiveSuccesses || 0} consecutive, ${Math.round(successRate * 100)}% overall) ${avgTime}`);
        
        return {
          strategy: entry.strategy,
          selector: entry.selector,
          confidence: successRate,
          timesUsed: entry.successCount + entry.failCount,
          isOptimized,
          isFlaky,
          consecutiveSuccesses: entry.consecutiveSuccesses || 0,
          // KEY: Optimized strategies get 50ms timeout, others get 5000ms
          recommendedTimeout: isOptimized ? this.config.OPTIMIZED_TIMEOUT_MS : this.config.LEARNING_TIMEOUT_MS
        };
      } else {
        console.log(`[StrategyMemory] Entry found but low success rate: ${Math.round(successRate * 100)}% (${entry.failCount} failures)`);
      }
    }
    
    return null;
  }
  
  /**
   * Record a successful strategy for future use
   * Tracks consecutive successes and promotes to "optimized" after threshold
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
        createdAt: Date.now(),
        // NEW: Consecutive tracking for optimization
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
        isOptimized: false,
        isFlaky: false,
        // NEW: History for flaky detection (S=success, F=fail)
        history: []
      };
    }
    
    // Update entry
    entry.strategy = strategy;  // Always update to latest successful strategy
    if (selector) entry.selector = selector;
    entry.successCount++;
    entry.lastSuccess = Date.now();
    
    // NEW: Track consecutive successes
    entry.consecutiveSuccesses = (entry.consecutiveSuccesses || 0) + 1;
    entry.consecutiveFailures = 0;  // Reset failure counter on success
    
    // NEW: Track history for flaky detection
    entry.history = entry.history || [];
    entry.history.push('S');
    if (entry.history.length > this.config.MAX_HISTORY_LENGTH) {
      entry.history.shift();
    }
    
    // NEW: Check for promotion to "optimized"
    const wasOptimized = entry.isOptimized;
    if (entry.consecutiveSuccesses >= this.config.CONSECUTIVE_SUCCESSES_TO_OPTIMIZE) {
      entry.isOptimized = true;
      if (!wasOptimized) {
        console.log(`[StrategyMemory] ⚡ PROMOTED to optimized: ${fingerprint} (${entry.consecutiveSuccesses} consecutive successes)`);
      }
    }
    
    // NEW: Check for flaky pattern (alternating S/F)
    this._checkFlakyPattern(fingerprint, entry);
    
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
    
    // Persist IMMEDIATELY for new entries, strategy changes, or optimization promotions
    const forcePersist = isNewEntry || strategyChanged || (!wasOptimized && entry.isOptimized);
    this._maybePersist(forcePersist);
    
    const statusIcon = entry.isOptimized ? '⚡' : (entry.isFlaky ? '⚠️' : '✓');
    const logSuffix = forcePersist ? ' [PERSISTED]' : '';
    console.log(`[StrategyMemory] ${statusIcon} Success: "${strategy}" for ${fingerprint} (${entry.consecutiveSuccesses} consecutive, ${entry.successCount} total)${logSuffix}`);
  }
  
  /**
   * Record a failed attempt (the remembered strategy didn't work)
   * Tracks consecutive failures and can demote from "optimized"
   */
  recordFailure(fingerprint, strategy) {
    const entry = this.memory.get(fingerprint);
    if (!entry) return;
    
    entry.failCount++;
    
    // NEW: Track consecutive failures
    entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
    entry.consecutiveSuccesses = 0;  // Reset success counter on failure
    
    // NEW: Track history for flaky detection
    entry.history = entry.history || [];
    entry.history.push('F');
    if (entry.history.length > this.config.MAX_HISTORY_LENGTH) {
      entry.history.shift();
    }
    
    // NEW: Check for demotion from "optimized"
    const wasOptimized = entry.isOptimized;
    if (entry.isOptimized && entry.consecutiveFailures >= this.config.CONSECUTIVE_FAILURES_TO_DEMOTE) {
      entry.isOptimized = false;
      console.log(`[StrategyMemory] ⬇️ DEMOTED from optimized: ${fingerprint} (${entry.consecutiveFailures} consecutive failures)`);
    }
    
    // NEW: Check for flaky pattern
    this._checkFlakyPattern(fingerprint, entry);
    
    this.memory.set(fingerprint, entry);
    
    // Update global strategy stats
    this._updateStrategyStats(strategy, false);
    
    // If strategy has failed too many times, clear it entirely
    const failRate = entry.failCount / (entry.successCount + entry.failCount);
    if (failRate > 0.5 && entry.failCount >= 5) {  // Increased threshold from 2 to 5
      console.log(`[StrategyMemory] 🗑️ Clearing entry for ${fingerprint} - too many failures (${Math.round(failRate * 100)}% fail rate)`);
      this.memory.delete(fingerprint);
      this._maybePersist(true);
      return;
    }
    
    // Persist if demotion occurred
    if (wasOptimized && !entry.isOptimized) {
      this._maybePersist(true);
    }
    
    const statusIcon = entry.isFlaky ? '⚠️ FLAKY' : '✗';
    console.log(`[StrategyMemory] ${statusIcon} Failure: "${strategy}" for ${fingerprint} (${entry.consecutiveFailures} consecutive failures)`);
  }
  
  /**
   * Check for flaky pattern - alternating successes and failures
   * Pattern like SFSFSF indicates an unstable locator
   */
  _checkFlakyPattern(fingerprint, entry) {
    const history = entry.history || [];
    if (history.length < this.config.FLAKY_FLIP_FLOP_THRESHOLD) return;
    
    // Count transitions (S→F or F→S)
    let transitions = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i] !== history[i - 1]) {
        transitions++;
      }
    }
    
    // If more than 50% of history is transitions, it's flaky
    const transitionRate = transitions / (history.length - 1);
    if (transitionRate > 0.5 && transitions >= this.config.FLAKY_FLIP_FLOP_THRESHOLD - 1) {
      if (!entry.isFlaky) {
        entry.isFlaky = true;
        this.flakyLocators.add(fingerprint);
        console.log(`[StrategyMemory] ⚠️ FLAKY DETECTED: ${fingerprint} (${transitions} transitions in ${history.length} attempts)`);
        console.log(`[StrategyMemory]   History: ${history.join('')}`);
      }
    }
  }
  
  /**
   * Get list of flaky locators
   */
  getFlakyLocators() {
    const flakyEntries = [];
    for (const [fingerprint, entry] of this.memory.entries()) {
      if (entry.isFlaky || this.flakyLocators.has(fingerprint)) {
        flakyEntries.push({
          fingerprint,
          strategy: entry.strategy,
          selector: entry.selector,
          history: entry.history?.join('') || '',
          successRate: entry.successCount / (entry.successCount + entry.failCount)
        });
      }
    }
    return flakyEntries;
  }
  
  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    let optimized = 0;
    let learning = 0;
    let flaky = 0;
    
    for (const [fingerprint, entry] of this.memory.entries()) {
      if (entry.isFlaky || this.flakyLocators.has(fingerprint)) {
        flaky++;
      } else if (entry.isOptimized) {
        optimized++;
      } else {
        learning++;
      }
    }
    
    return {
      total: this.memory.size,
      optimized,
      learning,
      flaky,
      optimizedPercent: this.memory.size > 0 ? Math.round((optimized / this.memory.size) * 100) : 0
    };
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
      const optimizationStats = this.getOptimizationStats();
      const data = {
        memory: Array.from(this.memory.entries()),
        strategyStats: this.strategyStats,
        flakyLocators: Array.from(this.flakyLocators),
        savedAt: Date.now(),
        version: '2.0.0'  // Track version for migration
      };
      
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
      this._lastPersist = Date.now();
      console.log(`[StrategyMemory] Persisted ${this.memory.size} entries (⚡${optimizationStats.optimized} optimized, ⚠️${optimizationStats.flaky} flaky)`);
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
      this.flakyLocators = new Set(data.flakyLocators || []);
      
      // Migrate old entries to new format if needed
      this._migrateEntries();
      
      // Log loaded stats for debugging
      const stats = this.getStats();
      console.log(`[StrategyMemory] ✅ Loaded ${this.memory.size} learned strategies from: ${this.persistPath}`);
      console.log(`[StrategyMemory] ⚡ ${stats.optimized} optimized | 📚 ${stats.learning} learning | ⚠️ ${stats.flaky} flaky`);
      console.log(`[StrategyMemory] Overall: ${stats.totalSuccesses} successes, ${Math.round(stats.overallSuccessRate * 100)}% success rate`);
      
      if (stats.flakyLocators.length > 0) {
        console.log(`[StrategyMemory] ⚠️ Flaky locators to watch: ${stats.flakyLocators.length}`);
      }
    } catch (e) {
      console.error('[StrategyMemory] Failed to load:', e.message);
    }
  }
  
  /**
   * Migrate old format entries to new format with optimization tracking
   */
  _migrateEntries() {
    let migrated = 0;
    for (const [fingerprint, entry] of this.memory.entries()) {
      // Add missing fields
      if (entry.consecutiveSuccesses === undefined) {
        entry.consecutiveSuccesses = entry.successCount >= this.config.CONSECUTIVE_SUCCESSES_TO_OPTIMIZE 
          ? this.config.CONSECUTIVE_SUCCESSES_TO_OPTIMIZE 
          : entry.successCount;
        migrated++;
      }
      if (entry.consecutiveFailures === undefined) {
        entry.consecutiveFailures = 0;
      }
      if (entry.isOptimized === undefined) {
        // Auto-promote entries with good history
        const successRate = entry.successCount / (entry.successCount + entry.failCount + 1);
        entry.isOptimized = successRate >= 0.9 && entry.successCount >= this.config.CONSECUTIVE_SUCCESSES_TO_OPTIMIZE;
      }
      if (entry.history === undefined) {
        entry.history = [];
      }
      if (entry.isFlaky === undefined) {
        entry.isFlaky = false;
      }
      this.memory.set(fingerprint, entry);
    }
    
    if (migrated > 0) {
      console.log(`[StrategyMemory] Migrated ${migrated} entries to v2.0 format`);
      this._maybePersist(true);
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
    
    // Get optimization stats
    const optimizationStats = this.getOptimizationStats();
    
    return {
      totalEntries: this.memory.size,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalSuccesses / (totalSuccesses + totalFailures + 1),
      topStrategies: this.getStrategyOrdering().slice(0, 5),
      avgExecutionTime: entries
        .filter(e => e.avgExecutionTime)
        .reduce((sum, e, _, arr) => sum + e.avgExecutionTime / arr.length, 0),
      // NEW: Optimization stats
      optimized: optimizationStats.optimized,
      learning: optimizationStats.learning,
      flaky: optimizationStats.flaky,
      optimizedPercent: optimizationStats.optimizedPercent,
      flakyLocators: this.getFlakyLocators()
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
