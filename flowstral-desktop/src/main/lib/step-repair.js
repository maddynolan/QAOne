/**
 * Step Repair - Re-run to Step X and Pause for Repair
 * 
 * When a user flags a step as wrong or a step fails, this module allows:
 * 1. Re-running the test up to that step
 * 2. Pausing with browser open at that exact state
 * 3. User performs the correct action
 * 4. System captures new element recipe
 * 5. Test continues or saves the fix
 * 
 * This is the "Assisted Re-record" approach - no technical knowledge needed.
 * 
 * @author Flowstral
 * @version 1.0.0
 */

const { SmartFinder } = require('./smart-finder');
const { buildRecipeFromElement } = require('./element-recipe');

// ═══════════════════════════════════════════════════════════════════════════
// STEP REPAIR MODES
// ═══════════════════════════════════════════════════════════════════════════

const REPAIR_MODES = {
  PAUSE_BEFORE: 'pause_before',    // Stop BEFORE the flagged step
  PAUSE_AFTER: 'pause_after',      // Stop AFTER executing (to see result)
  INTERACTIVE: 'interactive',      // Pause and let user re-do the action
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP REPAIR MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class StepRepairManager {
  constructor(options = {}) {
    this.executor = options.executor;   // TestExecutor instance
    this.recorder = options.recorder;   // PlaywrightRecorder instance
    
    this.currentRepairSession = null;
    this.onRepairStart = options.onRepairStart || (() => {});
    this.onRepairPause = options.onRepairPause || (() => {});
    this.onRepairCapture = options.onRepairCapture || (() => {});
    this.onRepairComplete = options.onRepairComplete || (() => {});
    
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[StepRepair]') : () => {};
  }

  /**
   * Start a repair session for a specific step
   * 
   * @param {Object} testData - The full test data
   * @param {number} stepIndex - Zero-based index of step to repair
   * @param {string} mode - REPAIR_MODES value
   * @returns {Promise<Object>} Repair session info
   */
  async startRepairSession(testData, stepIndex, mode = REPAIR_MODES.INTERACTIVE) {
    this.log(`Starting repair session for step ${stepIndex + 1} in mode: ${mode}`);
    
    if (this.currentRepairSession) {
      throw new Error('Repair session already in progress. Cancel it first.');
    }
    
    // Validate inputs
    if (!testData || !testData.steps || stepIndex >= testData.steps.length) {
      throw new Error('Invalid test data or step index');
    }
    
    const targetStep = testData.steps[stepIndex];
    const stepsToRun = testData.steps.slice(0, stepIndex);
    
    this.currentRepairSession = {
      id: `repair_${Date.now()}`,
      testData,
      targetStepIndex: stepIndex,
      targetStep,
      stepsToRun,
      mode,
      status: 'initializing',
      startTime: Date.now(),
      capturedAction: null,
      error: null,
    };
    
    this.onRepairStart(this.currentRepairSession);
    
    try {
      // Step 1: Run all steps before the target
      this.log(`Running ${stepsToRun.length} steps to reach target state...`);
      this.currentRepairSession.status = 'running_prerequisites';
      
      const prerequisiteResult = await this._runPrerequisiteSteps(stepsToRun);
      
      if (!prerequisiteResult.success) {
        this.currentRepairSession.status = 'prerequisite_failed';
        this.currentRepairSession.error = prerequisiteResult.error;
        throw new Error(`Failed to reach target state: ${prerequisiteResult.error}`);
      }
      
      this.log(`Prerequisites complete. Browser is now at step ${stepIndex + 1} state.`);
      
      // Step 2: Pause at target step
      this.currentRepairSession.status = 'paused';
      
      // Capture the current state for reference
      const currentState = await this._captureCurrentState();
      this.currentRepairSession.stateAtPause = currentState;
      
      // Notify that we're paused and ready for user input
      this.onRepairPause({
        session: this.currentRepairSession,
        message: `Paused before step ${stepIndex + 1}: "${targetStep.description || targetStep.type}"`,
        instructions: this._getInstructionsForMode(mode, targetStep),
        screenshot: currentState.screenshot,
      });
      
      return {
        success: true,
        sessionId: this.currentRepairSession.id,
        status: 'paused',
        message: `Browser is ready. ${this._getInstructionsForMode(mode, targetStep)}`,
        screenshot: currentState.screenshot,
      };
      
    } catch (error) {
      this.currentRepairSession.status = 'error';
      this.currentRepairSession.error = error.message;
      this.log(`Repair session failed: ${error.message}`);
      
      return {
        success: false,
        sessionId: this.currentRepairSession?.id,
        error: error.message,
      };
    }
  }

  /**
   * Run prerequisite steps to reach target state
   */
  async _runPrerequisiteSteps(steps) {
    if (!this.executor) {
      throw new Error('No executor available');
    }
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.log(`Running prerequisite step ${i + 1}/${steps.length}: ${step.type}`);
      
      try {
        // Execute the step
        const result = await this.executor.executeStep(step);
        
        if (!result.success && !result.skipped) {
          return {
            success: false,
            failedAtStep: i,
            error: result.error || `Step ${i + 1} failed`,
          };
        }
        
        // Small delay between steps
        await this.executor.page.waitForTimeout(200);
        
      } catch (error) {
        return {
          success: false,
          failedAtStep: i,
          error: error.message,
        };
      }
    }
    
    return { success: true };
  }

  /**
   * Capture user's action during repair
   * Called when user performs an action in interactive mode
   */
  async captureUserAction(actionData) {
    if (!this.currentRepairSession || this.currentRepairSession.status !== 'paused') {
      throw new Error('No active repair session or not in paused state');
    }
    
    this.log('Capturing user action:', actionData.type);
    this.currentRepairSession.status = 'capturing';
    
    try {
      // Build a new recipe from the captured action
      const newRecipe = await this._buildRecipeFromCapture(actionData);
      
      this.currentRepairSession.capturedAction = {
        originalStep: this.currentRepairSession.targetStep,
        newAction: actionData,
        newRecipe,
        capturedAt: Date.now(),
      };
      
      this.onRepairCapture({
        session: this.currentRepairSession,
        captured: this.currentRepairSession.capturedAction,
      });
      
      return {
        success: true,
        captured: this.currentRepairSession.capturedAction,
        message: 'Action captured successfully',
      };
      
    } catch (error) {
      this.log(`Failed to capture action: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build a new element recipe from captured action data
   */
  async _buildRecipeFromCapture(actionData) {
    const { element, page } = actionData;
    
    if (!element || !page) {
      // If no element data, return minimal recipe
      return {
        what: {
          role: actionData.role || 'button',
          text: actionData.text || actionData.label,
        },
        where: {},
        which: {},
      };
    }
    
    try {
      // Use the element analyzer to build a proper recipe
      const recipe = await page.evaluate(
        (el) => window.__flowstralElementAnalyzer?.analyzeElement(el),
        element
      );
      
      return recipe || {
        what: { text: actionData.text },
        where: {},
        which: {},
      };
    } catch (e) {
      this.log(`Recipe build failed: ${e.message}`);
      return {
        what: { text: actionData.text },
        where: {},
        which: {},
      };
    }
  }

  /**
   * Apply the captured fix to the test
   */
  async applyFix(options = {}) {
    if (!this.currentRepairSession || !this.currentRepairSession.capturedAction) {
      throw new Error('No captured action to apply');
    }
    
    const { testData, targetStepIndex, capturedAction } = this.currentRepairSession;
    const { continueTest = false, saveToTest = true } = options;
    
    this.log('Applying fix...');
    this.currentRepairSession.status = 'applying';
    
    // Create the fixed step
    const fixedStep = {
      ...capturedAction.originalStep,
      recipe: capturedAction.newRecipe,
      selectorObj: {
        ...capturedAction.originalStep.selectorObj,
        recipe: capturedAction.newRecipe,
      },
      _repaired: true,
      _repairedAt: Date.now(),
      _originalRecipe: capturedAction.originalStep.recipe,
    };
    
    // Update the test data
    if (saveToTest) {
      testData.steps[targetStepIndex] = fixedStep;
    }
    
    // Continue test execution if requested
    if (continueTest && this.executor) {
      this.log('Continuing test execution from fixed step...');
      
      // Execute the fixed step
      const fixedResult = await this.executor.executeStep(fixedStep);
      
      if (!fixedResult.success) {
        return {
          success: false,
          error: 'Fixed step still failed',
          fixedStep,
        };
      }
      
      // Execute remaining steps
      const remainingSteps = testData.steps.slice(targetStepIndex + 1);
      for (const step of remainingSteps) {
        await this.executor.executeStep(step);
      }
    }
    
    this.currentRepairSession.status = 'complete';
    
    this.onRepairComplete({
      session: this.currentRepairSession,
      fixedStep,
      testData,
    });
    
    const result = {
      success: true,
      fixedStep,
      testData: saveToTest ? testData : null,
      message: 'Step repaired successfully',
    };
    
    // Clean up session
    this.currentRepairSession = null;
    
    return result;
  }

  /**
   * Cancel the current repair session
   */
  async cancelRepair() {
    if (!this.currentRepairSession) {
      return { success: true, message: 'No repair session active' };
    }
    
    this.log('Cancelling repair session');
    
    this.currentRepairSession.status = 'cancelled';
    this.currentRepairSession = null;
    
    return { success: true, message: 'Repair session cancelled' };
  }

  /**
   * Capture current browser state
   */
  async _captureCurrentState() {
    if (!this.executor?.page) {
      return { screenshot: null, url: null };
    }
    
    try {
      const page = this.executor.page;
      const screenshot = await page.screenshot({ type: 'png' }).catch(() => null);
      const url = page.url();
      const title = await page.title().catch(() => '');
      
      return {
        screenshot: screenshot ? screenshot.toString('base64') : null,
        url,
        title,
        timestamp: Date.now(),
      };
    } catch (e) {
      return { screenshot: null, url: null };
    }
  }

  /**
   * Get instructions based on repair mode
   */
  _getInstructionsForMode(mode, step) {
    const stepDesc = step.description || step.type || 'this action';
    
    switch (mode) {
      case REPAIR_MODES.PAUSE_BEFORE:
        return `Inspect the page. The next step is: "${stepDesc}"`;
        
      case REPAIR_MODES.PAUSE_AFTER:
        return `The step "${stepDesc}" has been executed. Verify the result.`;
        
      case REPAIR_MODES.INTERACTIVE:
      default:
        return `Perform the action manually: "${stepDesc}". The system will capture your action.`;
    }
  }

  /**
   * Get current session status
   */
  getSessionStatus() {
    if (!this.currentRepairSession) {
      return { active: false };
    }
    
    return {
      active: true,
      sessionId: this.currentRepairSession.id,
      status: this.currentRepairSession.status,
      targetStep: this.currentRepairSession.targetStepIndex + 1,
      elapsed: Date.now() - this.currentRepairSession.startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREENSHOT POLICY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines when to capture screenshots during test execution
 * Only capture on failures or low confidence - not every step
 */
const ScreenshotPolicy = {
  // When to capture
  CAPTURE_ON: {
    FAILURE: true,              // Always capture on failure
    LOW_CONFIDENCE: true,       // Capture when confidence < threshold
    USER_FLAG: true,            // Capture when user flags step
    FIRST_RUN: false,           // Don't capture on first successful run
    EVERY_STEP: false,          // Don't capture every step (expensive)
  },
  
  // Confidence threshold below which we capture
  CONFIDENCE_THRESHOLD: 75,
  
  // Retention
  KEEP_FAILURE_SCREENSHOTS: true,
  KEEP_LOW_CONFIDENCE_SCREENSHOTS: true,
  CLEAR_ON_SUCCESS: true,       // Clear screenshots if test passes on retry
  
  /**
   * Determine if screenshot should be captured for a step result
   */
  shouldCapture(stepResult, options = {}) {
    // Always capture failures
    if (!stepResult.success) {
      return { capture: true, reason: 'failure' };
    }
    
    // Capture low confidence
    if (stepResult.confidence && stepResult.confidence < this.CONFIDENCE_THRESHOLD) {
      return { capture: true, reason: 'low_confidence', confidence: stepResult.confidence };
    }
    
    // Capture if user flagged this step previously
    if (options.flaggedSteps?.includes(stepResult.stepIndex)) {
      return { capture: true, reason: 'user_flagged' };
    }
    
    // Don't capture successful high-confidence steps
    return { capture: false, reason: 'success' };
  },
  
  /**
   * Get screenshot capture config for a test run
   */
  getConfig(options = {}) {
    return {
      captureOnFailure: this.CAPTURE_ON.FAILURE,
      captureOnLowConfidence: this.CAPTURE_ON.LOW_CONFIDENCE,
      confidenceThreshold: options.confidenceThreshold || this.CONFIDENCE_THRESHOLD,
      flaggedSteps: options.flaggedSteps || [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  StepRepairManager,
  REPAIR_MODES,
  ScreenshotPolicy,
};
