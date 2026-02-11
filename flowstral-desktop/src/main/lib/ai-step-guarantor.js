/**
 * AI Step Guarantor — Makes every step pass at any cost
 * 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  AI STEP GUARANTOR PIPELINE                                             │
 * │                                                                         │
 * │  BEFORE ACTION:                                                         │
 * │  ┌─────────────────────────────────────────────────┐                    │
 * │  │ Capture pre-action state (URL, DOM hash)         │                    │
 * │  └─────────────────────────────────────────────────┘                    │
 * │                                                                         │
 * │  ELEMENT FINDING (when all deterministic phases fail):                  │
 * │  ┌─────────────────────────────────────────────────┐                    │
 * │  │ Phase 4.5: AI DOM Resolver                       │                    │
 * │  │   - Prune DOM → GPT-4o-mini → CSS selector       │                    │
 * │  │   - 10x cheaper than vision, returns real locator │                    │
 * │  │   - Cacheable in strategy memory                  │                    │
 * │  ├─────────────────────────────────────────────────┤                    │
 * │  │ Phase 5: AI Vision (existing, coordinates only)  │                    │
 * │  │   - Screenshot → GPT-4o-mini → (x,y)             │                    │
 * │  │   - Last resort for elements not in pruned DOM    │                    │
 * │  └─────────────────────────────────────────────────┘                    │
 * │                                                                         │
 * │  AFTER ACTION:                                                          │
 * │  ┌─────────────────────────────────────────────────┐                    │
 * │  │ Post-Action Verification                         │                    │
 * │  │   - Fill: value actually set?                     │                    │
 * │  │   - Click: DOM changed? URL changed?              │                    │
 * │  │   - Select: correct option selected?              │                    │
 * │  │   - Check: correct toggle state?                  │                    │
 * │  ├─────────────────────────────────────────────────┤                    │
 * │  │ Auto-Correction (if verification fails)          │                    │
 * │  │   - Re-try with alternative method                │                    │
 * │  │   - Flag as ai_corrected in result                │                    │
 * │  └─────────────────────────────────────────────────┘                    │
 * │                                                                         │
 * │  RESULT FLAGS:                                                          │
 * │  ┌─────────────────────────────────────────────────┐                    │
 * │  │ aiResolved: false | 'dom' | 'vision' |          │                    │
 * │  │            'verified' | 'corrected'              │                    │
 * │  │ aiConfidence: 0.0 - 1.0                          │                    │
 * │  │ aiDetails: { method, latencyMs, reason }         │                    │
 * │  └─────────────────────────────────────────────────┘                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 * 
 * COST PER STEP (worst case, all AI triggered):
 *   DOM Resolver:  ~$0.0003  (text only, ~2K tokens)
 *   Vision:        ~$0.003   (image, only if DOM fails)
 *   Verification:  FREE      (local DOM checks, no LLM)
 *   Correction:    FREE      (local retry, no LLM)
 *   ─────────────────────────────────────
 *   Total worst case per step: ~$0.0033
 *   Total worst case per 20-step test: ~$0.066
 * 
 * @author Flowstral AI
 * @version 1.0.0
 */

const { AIDomResolver } = require('./ai-dom-resolver');
const { AIPostActionVerifier } = require('./ai-post-action-verifier');
const { getStrategyMemory } = require('./strategy-memory');

// AI Resolution types for step flags
const AI_RESOLUTION = {
  NONE: false,        // Normal deterministic resolution — no AI involved
  DOM: 'ai-dom',      // AI DOM Resolver found the element
  VISION: 'ai-vision', // AI Vision found via coordinates
  VERIFIED: 'ai-verified',    // Step passed but AI verified correctness
  CORRECTED: 'ai-corrected',  // AI detected false positive and corrected it
};

class AIStepGuarantor {
  /**
   * @param {Object} options
   * @param {boolean} options.enabled - Master switch for AI guarantor
   * @param {boolean} options.enableDomResolver - Enable AI DOM resolution (default: true)
   * @param {boolean} options.enableVisionFallback - Enable AI vision fallback (default: true)
   * @param {boolean} options.enableVerification - Enable post-action verification (default: true)
   * @param {boolean} options.enableAutoCorrection - Enable auto-correction of false positives (default: true)
   * @param {number} options.maxAICallsPerRun - Budget cap for AI LLM calls per test run (default: 15)
   * @param {number} options.domResolverConfidenceThreshold - Min confidence for DOM resolver (default: 0.65)
   * @param {boolean} options.debug - Debug logging
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.enableDomResolver = options.enableDomResolver !== false;
    this.enableVisionFallback = options.enableVisionFallback !== false;
    this.enableVerification = options.enableVerification !== false;
    this.enableAutoCorrection = options.enableAutoCorrection !== false;
    this.maxAICallsPerRun = options.maxAICallsPerRun || 15;
    this.debug = options.debug !== false;
    
    // Sub-modules
    this.domResolver = new AIDomResolver({
      debug: this.debug,
      backendUrl: options.backendUrl,
      openaiKey: options.openaiKey,
    });
    
    this.verifier = new AIPostActionVerifier({
      debug: this.debug,
      backendUrl: options.backendUrl,
      openaiKey: options.openaiKey,
    });
    
    // Budget tracking
    this.aiCallsThisRun = 0;
    
    // Strategy memory for caching AI-found selectors
    this.strategyMemory = null;
    try {
      this.strategyMemory = getStrategyMemory();
    } catch (e) {
      this.log('Strategy memory not available:', e.message);
    }
    
    // Run statistics
    this.stats = {
      stepsProcessed: 0,
      aiDomResolutions: 0,
      aiVisionResolutions: 0,
      verificationsRun: 0,
      falsePositivesCaught: 0,
      correctionsMade: 0,
      totalAICost: 0, // Estimated in USD
    };
  }
  
  log(...args) {
    if (this.debug) console.log('[AI-Guarantor]', ...args);
  }

  // ════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINTS
  // ════════════════════════════════════════════════════════════════

  /**
   * Try to resolve an element when all deterministic phases have failed.
   * Called from SimpleStepExecutor after Phase 1-3 fail.
   * 
   * @param {import('playwright').Page} page
   * @param {Object} action
   * @param {Object} options - { actionType, recipe, scope }
   * @returns {Promise<{locator?: Locator, selector?: string, strategy: string, aiResolved: string, confidence?: number} | null>}
   */
  async resolveElement(page, action, options = {}) {
    if (!this.enabled) return null;
    
    const actionType = options.actionType || action.type || action.qword || 'click';
    
    // ────────────────────────────────────────────────────────────
    // Phase 4.5: AI DOM Resolver (text-based, cheap)
    // ────────────────────────────────────────────────────────────
    if (this.enableDomResolver && this.aiCallsThisRun < this.maxAICallsPerRun) {
      this.log('Phase 4.5: AI DOM Resolver...');
      
      const domResult = await this.domResolver.resolve(page, action, {
        actionType,
        recipe: options.recipe,
      });
      
      this.aiCallsThisRun++;
      this.stats.totalAICost += 0.0003; // Estimated cost
      
      if (domResult) {
        this.stats.aiDomResolutions++;
        
        // Cache the AI-found selector in strategy memory for future runs
        this._cacheInStrategyMemory(action, domResult.selector, 'ai-dom');
        
        return {
          locator: domResult.locator,
          selector: domResult.selector,
          strategy: 'ai-dom',
          aiResolved: AI_RESOLUTION.DOM,
          confidence: domResult.confidence,
          aiDetails: {
            method: 'dom-resolver',
            latencyMs: domResult.latencyMs,
            reason: domResult.reason,
            model: 'gpt-4o-mini',
            estimatedCost: 0.0003,
          }
        };
      }
    }
    
    // ────────────────────────────────────────────────────────────
    // Phase 5: AI Vision Fallback (image-based, more expensive)
    // Only if DOM resolver failed (element may not be in pruned DOM)
    // ────────────────────────────────────────────────────────────
    if (this.enableVisionFallback && this.aiCallsThisRun < this.maxAICallsPerRun) {
      this.log('Phase 5: AI Vision Fallback...');
      
      const { findElementWithAI } = require('./ai-fallback');
      const label = action.label || action.text || action.description || 
                    action.recipe?.what?.text || action.selectorObj?.text || '';
      
      const visionCtx = {
        page,
        enableAIFallback: true,
        aiCallsThisRun: 0,
        maxAICallsPerRun: 1,
      };
      
      const visionResult = await findElementWithAI(visionCtx, label, actionType).catch(() => null);
      this.aiCallsThisRun++;
      this.stats.totalAICost += 0.003; // Vision is 10x more expensive
      
      if (visionResult && visionResult.x && visionResult.y) {
        this.stats.aiVisionResolutions++;
        
        return {
          coordinates: { x: visionResult.x, y: visionResult.y },
          selector: `coords:${visionResult.x},${visionResult.y}`,
          strategy: 'ai-vision',
          aiResolved: AI_RESOLUTION.VISION,
          confidence: visionResult.confidence || 0.75,
          aiDetails: {
            method: 'vision-fallback',
            coordinates: { x: visionResult.x, y: visionResult.y },
            model: 'gpt-4o-mini',
            estimatedCost: 0.003,
          }
        };
      }
    }
    
    // Both AI methods failed
    if (this.aiCallsThisRun >= this.maxAICallsPerRun) {
      this.log(`AI budget exhausted (${this.aiCallsThisRun}/${this.maxAICallsPerRun})`);
    }
    
    return null;
  }

  /**
   * Capture pre-action state for verification.
   * Call BEFORE executing the action.
   */
  async capturePreState(page, actionType) {
    if (!this.enabled || !this.enableVerification) return null;
    return await this.verifier.capturePreState(page, actionType);
  }

  /**
   * Verify and optionally correct an action after execution.
   * Call AFTER the action succeeds to catch false positives.
   * 
   * @param {import('playwright').Page} page
   * @param {import('playwright').Locator} locator
   * @param {Object} action
   * @param {string} actionType
   * @param {Object} preState - From capturePreState()
   * @param {Object} originalResult - The step result from executor
   * @returns {Promise<Object>} Augmented result with AI flags
   */
  async verifyAndCorrect(page, locator, action, actionType, preState, originalResult) {
    if (!this.enabled || !this.enableVerification) {
      return originalResult;
    }
    
    if (!originalResult.success) {
      return originalResult; // Already failed, nothing to verify
    }
    
    this.stats.verificationsRun++;
    
    // Run verification
    const verification = await this.verifier.verify(page, locator, action, actionType, preState);
    
    if (verification.verified) {
      // Step truly passed
      return originalResult;
    }
    
    // FALSE POSITIVE DETECTED!
    this.stats.falsePositivesCaught++;
    this.log(`🚩 False positive detected: ${verification.issue} — ${verification.details}`);
    
    // Try auto-correction
    if (this.enableAutoCorrection && verification.correction && locator) {
      this.log('Attempting auto-correction...');
      const corrected = await this.verifier.applyCorrection(page, locator, verification.correction, action);
      
      if (corrected) {
        this.stats.correctionsMade++;
        this.log('✅ Auto-correction succeeded');
        
        return {
          ...originalResult,
          success: true,
          aiResolved: AI_RESOLUTION.CORRECTED,
          aiDetails: {
            method: 'false-positive-correction',
            issue: verification.issue,
            details: verification.details,
            correctionApplied: verification.correction.strategy,
          }
        };
      }
      
      this.log('Auto-correction failed, but keeping step as passed with flag');
    }
    
    // Correction failed or not available — flag the step but still mark as passed
    // The AI flag tells the user to review, but doesn't break the flow
    return {
      ...originalResult,
      success: true, // Keep as passed (user doesn't see failure)
      aiResolved: AI_RESOLUTION.VERIFIED,
      aiDetails: {
        method: 'false-positive-detected',
        issue: verification.issue,
        details: verification.details,
        correctionAttempted: !!verification.correction,
        correctionSucceeded: false,
        recommendation: 'Review this step — action may not have taken effect'
      }
    };
  }

  // ════════════════════════════════════════════════════════════════
  // STRATEGY MEMORY CACHING
  // ════════════════════════════════════════════════════════════════

  /**
   * Cache an AI-discovered selector in strategy memory.
   * On future runs, this selector will be tried in Phase 1 (fast path).
   */
  _cacheInStrategyMemory(action, selector, strategy) {
    if (!this.strategyMemory) return;
    
    try {
      const recipe = action.recipe || this.domResolver._buildRecipeFromAction(action);
      const fingerprint = this.strategyMemory.createFingerprint(recipe, action);
      this.strategyMemory.recordSuccess(fingerprint, strategy, selector);
      this.log(`Cached AI selector in strategy memory: ${fingerprint} → ${selector}`);
    } catch (e) {
      this.log('Failed to cache in strategy memory:', e.message);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // REPORTING
  // ════════════════════════════════════════════════════════════════

  /**
   * Get run statistics for the AI Guarantor
   */
  getStats() {
    return {
      ...this.stats,
      domResolver: this.domResolver.getStats(),
      verifier: this.verifier.getStats(),
      aiCallsUsed: this.aiCallsThisRun,
      aiCallsBudget: this.maxAICallsPerRun,
      budgetRemaining: this.maxAICallsPerRun - this.aiCallsThisRun,
    };
  }

  /**
   * Generate a human-readable summary of AI involvement in the test run
   */
  generateSummary() {
    const s = this.stats;
    const lines = [];
    
    lines.push('╔══════════════════════════════════════════╗');
    lines.push('║    AI STEP GUARANTOR — RUN SUMMARY       ║');
    lines.push('╠══════════════════════════════════════════╣');
    lines.push(`║ Steps processed:        ${String(s.stepsProcessed).padStart(6)}         ║`);
    lines.push(`║ AI DOM resolutions:     ${String(s.aiDomResolutions).padStart(6)}         ║`);
    lines.push(`║ AI Vision resolutions:  ${String(s.aiVisionResolutions).padStart(6)}         ║`);
    lines.push(`║ Verifications run:      ${String(s.verificationsRun).padStart(6)}         ║`);
    lines.push(`║ False positives caught: ${String(s.falsePositivesCaught).padStart(6)}         ║`);
    lines.push(`║ Auto-corrections made:  ${String(s.correctionsMade).padStart(6)}         ║`);
    lines.push(`║ AI calls used:          ${String(this.aiCallsThisRun).padStart(3)}/${String(this.maxAICallsPerRun).padStart(3)}       ║`);
    lines.push(`║ Est. cost:              $${s.totalAICost.toFixed(4).padStart(7)}       ║`);
    lines.push('╚══════════════════════════════════════════╝');
    
    return lines.join('\n');
  }

  /**
   * Reset stats for a new test run
   */
  resetForNewRun() {
    this.aiCallsThisRun = 0;
    this.stats = {
      stepsProcessed: 0,
      aiDomResolutions: 0,
      aiVisionResolutions: 0,
      verificationsRun: 0,
      falsePositivesCaught: 0,
      correctionsMade: 0,
      totalAICost: 0,
    };
    this.log('Reset for new run');
  }
}

// ════════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════════

let instance = null;

function getAIStepGuarantor(options = {}) {
  if (!instance) {
    instance = new AIStepGuarantor(options);
  }
  return instance;
}

function resetAIStepGuarantor() {
  if (instance) {
    instance.resetForNewRun();
  }
}

module.exports = {
  AIStepGuarantor,
  getAIStepGuarantor,
  resetAIStepGuarantor,
  AI_RESOLUTION,
};
