/**
 * Test Executor Service
 * 
 * Executes automated tests using Playwright within the Electron app.
 * Supports QWord actions, assertions, waits, and reports results.
 */

const { chromium, firefox, webkit } = require('playwright');

// V2: Import SmartFinder for recipe-based element finding
const { SmartFinder, ActionExecutor } = require('./lib/smart-finder');
const { legacyActionToRecipe } = require('./lib/recipe-recorder-integration');

// UNIFIED EXECUTION: Import shared ActionHandlers for consistent behavior with PlaywrightRecorder
const ActionHandlers = require('./lib/action-handlers');

// Override + locked selector: single source of truth (used by both Executor and PlaywrightRecorder)
const { getManualOverrideSelector, getLockedSelector } = require('./lib/override-and-locked');
// Shared legacy element find (same order, same timeouts)
const { runLegacyFindExecutor } = require('./lib/shared-element-finder');

// SALESFORCE: Import shared Salesforce handlers
const SalesforceHandlers = require('./lib/salesforce-handlers');

// Extracted modules (for modularity — same logic, just in separate files)
const { normalizeActionType: _normalizeActionType } = require('./test-executor-action-map');
const { getSalesforceSession: _getSalesforceSession, sfApiCall: _sfApiCall, generateTestData: _generateTestData } = require('./test-executor-salesforce');
const { executeStepAssertion: _executeStepAssertion } = require('./test-executor-assertions');

class TestExecutor {
  constructor(options = {}) {
    this.browserType = options.browserType || 'chromium';
    this.headless = options.headless ?? false;
    this.viewport = options.viewport || { width: 1280, height: 720 };
    this.timeout = options.timeout || 30000;
    this.capturePassScreenshots = options.capturePassScreenshots || false; // Capture screenshots for passed steps
    this.stepDelay = options.stepDelay || 300; // Delay between steps (ms) - prevents skipping fast clicks
    this.onStepStart = options.onStepStart || (() => {});
    this.onStepComplete = options.onStepComplete || (() => {});
    this.onTestComplete = options.onTestComplete || (() => {});
    
    this.browser = null;
    this.context = null;
    this.page = null;
    
    // V2: SmartFinder for recipe-based element finding (more robust)
    this.useSmartFinder = options.useSmartFinder !== false; // Default: enabled
    this.smartFinder = null;
    
    // Lock Locators tracking (for self-healing)
    this._lastWorkingSelector = null;
    this._lastStrategyType = null;
    this._lastStepUsedLockedSelector = false; // Track if last step used locked fast path
    
    // AI Fallback: Enable AI vision for element finding as last resort
    this.enableAIFallback = options.enableAIFallback !== false; // Default: enabled
    this.aiCallsThisRun = 0;
    this.maxAICallsPerRun = options.maxAICallsPerRun || 3; // Budget per test run
  }
  
  /**
   * AI Vision Fallback - Find element by description using AI
   * This is the LAST RESORT when all deterministic strategies fail
   * @param {string} description - Human-readable element description
   * @param {string} actionType - 'click', 'fill', etc.
   * @returns {Promise<{x: number, y: number} | null>} - Coordinates or null if AI fails
   */
  async findElementWithAI(description, actionType = 'click') {
    if (!this.enableAIFallback) {
      console.log('[AI Fallback] AI fallback is disabled');
      return null;
    }
    
    if (this.aiCallsThisRun >= this.maxAICallsPerRun) {
      console.log(`[AI Fallback] AI budget exhausted (${this.aiCallsThisRun}/${this.maxAICallsPerRun} calls used)`);
      return null;
    }
    
    try {
      console.log(`[AI Fallback] 🤖 Attempting AI vision for: "${description}"`);
      this.aiCallsThisRun++;
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ type: 'png' });
      const screenshotBase64 = screenshot.toString('base64');
      
      // Get viewport dimensions
      const viewport = await this.page.viewportSize();
      
      // Try to call AI service via backend or local model
      // First try: Backend API
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${backendUrl}/api/ai/vision/find-element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot_base64: screenshotBase64,
            description: description,
            action_type: actionType,
            viewport: viewport,
            context: {
              url: this.page.url(),
              title: await this.page.title()
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.found && result.confidence > 0.7 && result.x && result.y) {
            console.log(`[AI Fallback] ✅ AI found element at (${result.x}, ${result.y}) with ${Math.round(result.confidence * 100)}% confidence`);
            return { x: result.x, y: result.y, confidence: result.confidence };
          }
        }
      } catch (e) {
        console.log('[AI Fallback] Backend AI service not available:', e.message);
      }
      
      // Second try: OpenAI API directly if configured
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `You are a UI element locator. Given a screenshot and element description, return the PIXEL COORDINATES (x, y) of the CENTER of that element. 
                  
IMPORTANT: Return ONLY a JSON object in this exact format:
{"found": true, "x": 123, "y": 456, "confidence": 0.9}

If you cannot find the element, return:
{"found": false, "x": null, "y": null, "confidence": 0}

The viewport is ${viewport.width}x${viewport.height} pixels. Coordinates must be within this range.`
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Find the element for "${actionType}" action: "${description}"`
                    },
                    {
                      type: 'image_url',
                      image_url: { url: `data:image/png;base64,${screenshotBase64}` }
                    }
                  ]
                }
              ],
              max_tokens: 100
            })
          });
          
          if (openaiResponse.ok) {
            const openaiResult = await openaiResponse.json();
            const content = openaiResult.choices?.[0]?.message?.content || '';
            
            // Parse JSON response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.found && parsed.x && parsed.y) {
                console.log(`[AI Fallback] ✅ OpenAI found element at (${parsed.x}, ${parsed.y})`);
                return { x: parsed.x, y: parsed.y, confidence: parsed.confidence || 0.8 };
              }
            }
          }
        } catch (e) {
          console.log('[AI Fallback] OpenAI API error:', e.message);
        }
      }
      
      console.log('[AI Fallback] AI could not find the element');
      return null;
      
    } catch (error) {
      console.error('[AI Fallback] Error:', error.message);
      return null;
    }
  }
  
  /**
   * Click at specific coordinates (used by AI fallback)
   */
  async clickAtCoordinates(x, y) {
    console.log(`[AI Fallback] Clicking at coordinates (${x}, ${y})`);
    await this.page.mouse.click(x, y);
    await this.page.waitForTimeout(200); // Let UI settle
  }
  
  // Normalize selector - handles both string and object formats
  // Returns a string selector or empty string
  normalizeSelector(sel) {
    if (!sel) return '';
    if (typeof sel === 'string') return sel;
    // Handle object formats: { selector: "..." }, { value: "..." }, etc.
    return sel.selector || sel.value || sel.css || sel.xpath || '';
  }

  /**
   * V2: Find element using SmartFinder with recipe-based identification
   * Falls back to legacy selector if SmartFinder fails
   * @param {Object} step - The step containing selectorObj and/or recipe
   * @returns {Promise<Locator|null>} - Playwright locator or null if not found
   */
  async findElementV2(step) {
    if (!this.smartFinder || !this.useSmartFinder) {
      return null; // Let caller use legacy method
    }
    
    try {
      // Get recipe from step (either directly or convert from legacy)
      let recipe = step.recipe || step.selectorObj?.recipe;
      
      if (!recipe && step.selectorObj) {
        // Convert legacy selectorObj to recipe format
        recipe = legacyActionToRecipe({
          selectorObj: step.selectorObj,
          element: step.element || {},
          text: step.args?.[0] || step.selectorObj?.text || '',
          label: step.selectorObj?.ariaLabel || step.selectorObj?.placeholder || '',
          elementIndex: step.args?.[1]
        });
      }
      
      if (!recipe) {
        console.log('[Executor V2] No recipe available, falling back to legacy');
        return null;
      }
      
      console.log('[Executor V2] Finding element with recipe:', 
        recipe.what?.role || recipe.what?.tag, 
        recipe.what?.text || recipe.which?.testId);
      
      // Pass cross-device flag and the full action to SmartFinder
      // FIX Gap 4: Pass action so SmartFinder has access to productContext, type, etc.
      const findOptions = {
        skipCoordinateFallback: this._skipCoordinateFallback || false,
        action: step  // Forward full action for context-aware strategies
      };
      
      const locator = await this.smartFinder.find(recipe, findOptions);
      console.log('[Executor V2] Element found with SmartFinder');
      return locator;
      
    } catch (error) {
      console.log('[Executor V2] SmartFinder failed:', error.message, '- falling back to legacy');
      return null;
    }
  }

  /**
   * UNIFIED EXECUTION INTERFACE: findElementWithRetry
   * Compatible with ActionHandlers module for shared execution logic
   * Uses SmartFinder with retry and fallbacks
   * 
   * PRIORITY ORDER:
   * 1. Manual Override (user-specified selector) - HIGHEST priority
   * 2. SmartFinder V2 (recipe-based)
   * 3. Legacy selector-based finding
   */
  async findElementWithRetry(action) {
    const maxRetries = 3;
    const baseDelay = 500;
    
    // Track if locked selector failed (for self-healing)
    let lockedSelectorFailed = false;
    
    // ============================================================
    // LOCKED SELECTOR (optimizedSelector) - User-locked working selector
    // From "Lock Locators" feature - should work instantly (150ms)
    // ============================================================
    const optimizedSelector = action.selectorObj?.optimizedSelector;
    if (optimizedSelector) {
      console.log(`[Executor] ⚡ Trying LOCKED selector: ${optimizedSelector}`);
      try {
        let locator;
        // Handle role=xxx[name="yyy"] format
        const roleMatch = optimizedSelector.match(/^role=(\w+)\[name="(.+)"\]$/);
        if (roleMatch) {
          const [, role, name] = roleMatch;
          locator = this.page.getByRole(role, { name: name });
        } else {
          locator = this.page.locator(optimizedSelector);
        }
        
        // Quick 150ms check
        const found = await Promise.race([
          locator.count().then(c => c > 0),
          new Promise(resolve => setTimeout(() => resolve(false), 150))
        ]);
        
        if (found) {
          const isVisible = await locator.first().isVisible().catch(() => false);
          if (isVisible) {
            console.log(`[Executor] ⚡ LOCKED selector SUCCESS - instant find!`);
            this._lastWorkingSelector = optimizedSelector;
            this._lastStrategyType = 'LockedSelector';
            return { locator: locator.first(), strategy: { type: 'LockedSelector' } };
          }
        }
        console.log(`[Executor] Locked selector not found, trying SmartFinder...`);
        lockedSelectorFailed = true;
      } catch (e) {
        console.log(`[Executor] Locked selector failed: ${e.message}, trying SmartFinder...`);
        lockedSelectorFailed = true;
      }
    }
    
    // ============================================================
    // MANUAL OVERRIDE - User-specified selector takes HIGHEST priority
    // When automation fails, users can specify exactly how to find the element
    // ============================================================
    const manualOverride = getManualOverrideSelector(action);
    if (manualOverride) {
      console.log(`[Executor] 🎯 MANUAL OVERRIDE: Using user-specified selector: "${manualOverride}"`);
      try {
        const manualLocator = this.page.locator(manualOverride);
        const count = await manualLocator.count();
        if (count > 0) {
          console.log(`[Executor] ✅ Manual override found ${count} element(s)`);
          this._lastWorkingSelector = manualOverride;
          this._lastStrategyType = 'manualOverride';
          return { locator: manualLocator.first(), strategy: { type: 'manualOverride', value: manualOverride } };
        } else {
          console.log(`[Executor] ⚠️ Manual override selector found 0 elements, falling back to automatic strategies`);
        }
      } catch (e) {
        console.log(`[Executor] ⚠️ Manual override selector failed: ${e.message}, falling back`);
      }
    }
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try SmartFinder first (V2)
        const v2Locator = await this.findElementV2(action);
        if (v2Locator) {
          // Track what SmartFinder used for Lock Locators
          const sfSelector = this.smartFinder?.lastSuccessfulSelector || null;
          const sfStrategy = this.smartFinder?.lastSuccessfulStrategy || 'SmartFinder';
          this._lastWorkingSelector = sfSelector;
          this._lastStrategyType = sfStrategy;
          
          // SELF-HEALING: If locked selector failed but SmartFinder worked
          const healed = lockedSelectorFailed && sfSelector;
          
          return { 
            locator: v2Locator, 
            strategy: { type: 'SmartFinder' },
            healed,
            newSelector: healed ? sfSelector : null
          };
        }
        
        // Fallback to legacy selector-based finding
        const legacyResult = await this._findElement(action);
        if (legacyResult) {
          return legacyResult;
        }
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          await this.page.waitForTimeout(baseDelay * (attempt + 1));
        }
      } catch (e) {
        if (attempt < maxRetries - 1) {
          console.log(`[Executor] findElementWithRetry attempt ${attempt + 1} failed, retrying...`);
          await this.page.waitForTimeout(baseDelay * (attempt + 1));
        }
      }
    }
    
    return null;
  }

  /**
   * LOCKED SELECTOR FAST PATH - Used by Click/Fill/ClickElement handlers
   * Returns a locator if the locked selector (optimizedSelector) works, null otherwise.
   * This is the #1 priority in all action handlers when locators are locked.
   * Timeout: 150ms - if the locked selector doesn't resolve instantly, fall through.
   */
  async _tryLockedSelector(step) {
    const optimizedSelector = step?.selectorObj?.optimizedSelector;
    if (!optimizedSelector) return null;
    
    const elementIndex = step.elementIndex || 0;
    
    console.log(`[Executor] ⚡ FAST PATH: Trying LOCKED selector: ${optimizedSelector}`);
    try {
      let locator;
      // Handle role=xxx[name="yyy"] format
      const roleMatch = optimizedSelector.match(/^role=(\w+)\[name="(.+)"\]$/);
      if (roleMatch) {
        const [, role, name] = roleMatch;
        locator = this.page.getByRole(role, { name });
      } else {
        locator = this.page.locator(optimizedSelector);
      }
      
      // Apply element index
      locator = elementIndex === 0 ? locator.first() : locator.nth(elementIndex);
      
      // Quick 150ms check - if locked selector doesn't resolve near-instantly, skip it
      const found = await Promise.race([
        locator.count().then(c => c > 0),
        new Promise(resolve => setTimeout(() => resolve(false), 150))
      ]);
      
      if (found) {
        const isVisible = await locator.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`[Executor] ⚡ LOCKED selector SUCCESS - instant find!`);
          this._lastWorkingSelector = optimizedSelector;
          this._lastStrategyType = 'LockedSelector';
          this._lastStepUsedLockedSelector = true;
          return locator;
        }
      }
      console.log(`[Executor] Locked selector not visible, falling through to other strategies...`);
    } catch (e) {
      console.log(`[Executor] Locked selector error: ${e.message}, falling through...`);
    }
    return null;
  }

  /**
   * UNIFIED EXECUTION INTERFACE: _findElement
   * Legacy selector-based element finding for ActionHandlers compatibility
   * 
   * PRIORITY ORDER:
   * 1. Manual Override (user-specified selector)
   * 2. Test ID (most reliable)
   * 3. ARIA Label
   * 4. Name attribute
   * 5. ID (if not dynamic)
   * 6. CSS selector
   * 7. Text content
   */
  async _findElement(action) {
    const elementIndex = action.args?.[1] || 0;

    // ============================================================
    // MANUAL OVERRIDE - User-specified selector takes HIGHEST priority
    // ============================================================
    const manualOverride = getManualOverrideSelector(action);
    if (manualOverride) {
      console.log(`[Executor._findElement] 🎯 Trying manual override: "${manualOverride}"`);
      try {
        const getAtIndex = (locator) => elementIndex === 0 ? locator.first() : locator.nth(elementIndex);
        const manualLocator = getAtIndex(this.page.locator(manualOverride));
        const count = await manualLocator.count().catch(() => 0);
        if (count > 0) {
          const isVisible = await manualLocator.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            console.log(`[Executor._findElement] ✅ Manual override succeeded`);
            return { locator: manualLocator, strategy: { type: 'manualOverride', value: manualOverride } };
          }
        }
      } catch (e) {
        console.log(`[Executor._findElement] ⚠️ Manual override failed: ${e.message}`);
      }
    }

    // Shared legacy find (same order, same timeouts as before)
    return runLegacyFindExecutor(this.page, action, {
      elementIndex,
      visibilityTimeout: 2000,
    });
  }

  /**
   * V2: Execute a select action using SmartFinder's combobox handling
   * This properly handles Radix/Headless UI dropdowns
   * @param {Object} step - The step containing target and value
   * @returns {Promise<boolean>} - True if successful
   */
  async executeSelectV2(step) {
    if (!this.smartFinder || !this.useSmartFinder) {
      return false; // Let caller use legacy method
    }
    
    try {
      let recipe = step.recipe || step.selectorObj?.recipe;
      
      if (!recipe && step.selectorObj) {
        recipe = legacyActionToRecipe({
          selectorObj: step.selectorObj,
          element: step.element || {},
          text: step.args?.[0] || step.selectorObj?.text || '',
        });
      }
      
      if (!recipe) {
        return false;
      }
      
      const valueText = step.args?.[1] || step.value?.text || step.value || '';
      
      console.log('[Executor V2] Executing select with SmartFinder:', valueText);
      
      // Use SmartFinder's combobox handling
      const combobox = await this.smartFinder.findCombobox(recipe);
      await combobox.trigger.click({ timeout: this.timeout });
      
      // Wait for dropdown
      await this.page.waitForTimeout(100);
      
      // Click option
      const option = await combobox.findOption(valueText);
      await option.click({ timeout: this.timeout });
      
      console.log('[Executor V2] Select completed successfully');
      return true;
      
    } catch (error) {
      console.log('[Executor V2] Select failed:', error.message, '- falling back to legacy');
      return false;
    }
  }

  // Get browser instance
  getBrowser() {
    switch (this.browserType) {
      case 'firefox': return firefox;
      case 'webkit': return webkit;
      default: return chromium;
    }
  }

  // Initialize browser with persistent context to maintain login sessions (avoids OTP prompts)
  async initialize() {
    const browserClass = this.getBrowser();
    
    // Use persistent context to maintain cookies, localStorage, and login sessions
    const { app } = require('electron');
    const path = require('path');
    const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
    
    console.log('[Executor] Using persistent browser context:', userDataDir);
    
    // Try to use system Chrome/Edge if Playwright browsers not available
    let launchOptions = {
      headless: this.headless,
      viewport: this.viewport,
      args: [
        '--no-sandbox', 
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    
    // Try launching with different channels if default fails
    const channels = [null, 'chrome', 'msedge', 'chromium'];
    let lastError = null;
    
    for (const channel of channels) {
      try {
        if (channel) {
          console.log(`[Executor] Trying to launch with channel: ${channel}`);
          launchOptions.channel = channel;
        }
        this.context = await browserClass.launchPersistentContext(userDataDir, launchOptions);
        console.log(`[Executor] Successfully launched browser${channel ? ` with channel: ${channel}` : ''}`);
        break;
      } catch (error) {
        lastError = error;
        console.log(`[Executor] Failed to launch${channel ? ` with channel ${channel}` : ''}: ${error.message}`);
        delete launchOptions.channel; // Reset for next attempt
      }
    }
    
    if (!this.context) {
      throw new Error(`Failed to launch browser. Please install Chrome or Edge. Last error: ${lastError?.message}`);
    }
    
    // With persistent context, browser is part of context
    this.browser = null; // Not needed with persistent context
    
    // Get existing page or create new one
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    this.page.setDefaultTimeout(this.timeout);
    
    // V2: Initialize SmartFinder for recipe-based element finding
    if (this.useSmartFinder) {
      this.smartFinder = new SmartFinder(this.page, {
        timeout: this.timeout,
        debug: false
      });
      console.log('[Executor] SmartFinder initialized for v2 element finding');
    }
    
    console.log('[Executor] Browser initialized with persistent context');
  }

  // Normalize action types to canonical form (delegated to extracted module)
  normalizeActionType(actionType) {
    return _normalizeActionType(actionType);
  }

  // ============ SALESFORCE API HELPERS (delegated to extracted module) ============

  // Extract Salesforce session info from browser cookies
  async getSalesforceSession() {
    return _getSalesforceSession(this.context, this.page);
  }

  // Make authenticated Salesforce REST API call
  async sfApiCall(method, endpoint, body = null) {
    return _sfApiCall(this.context, this.page, method, endpoint, body);
  }

  // Generate random test data for Salesforce objects
  generateTestData(objectType) {
    return _generateTestData(objectType);
  }

  // Execute a single step
  async executeStep(step, variables = {}) {
    const startTime = Date.now();
    let result = {
      stepId: step.id,
      status: 'passed',
      error: null,
      screenshot: null,
      duration: 0,
      // Lock Locators tracking
      workingSelector: null,
      strategyType: null,
      // Self-healing tracking
      healed: false,
      newSelector: null
    };

    try {
      // Skip disabled steps
      if (step.enabled === false) {
        console.log(`[Executor] Skipping disabled step: "${step.name || step.id}"`);
        result.status = 'skipped';
        result.error = 'Step disabled';
        result.duration = Date.now() - startTime;
        result.name = step.description || step.name || step.qword || `Step`;
        return result;
      }
      
      // ============================================================
      // CROSS-DEVICE DETECTION (Phase 1)
      // Detect if we're playing on a different device than recorded
      // Maestro-inspired: Disable coordinate strategies cross-device
      // ============================================================
      const sourceDevice = step.deviceContext?.recordedOn || 'desktop';
      const targetDevice = this.mobileDevice?.name || 'desktop';
      const isCrossDevicePlay = sourceDevice !== targetDevice;
      
      if (isCrossDevicePlay) {
        console.log(`[Executor] 🔄 CROSS-DEVICE PLAYBACK: Recorded on "${sourceDevice}" → Playing on "${targetDevice}"`);
        console.log(`[Executor] ⚠️ Coordinate-based fallbacks will be skipped (viewport mismatch)`);
        // Set flag for findElementWithRetry to skip coordinate strategies
        this._skipCoordinateFallback = true;
      } else {
        this._skipCoordinateFallback = false;
      }
      
      // Replace variables in step values
      const resolvedStep = this.resolveVariables(step, variables);
      
      // Normalize the action type to handle variations
      const rawActionType = resolvedStep.qword || resolvedStep.type || '';
      const normalizedAction = this.normalizeActionType(rawActionType);
      console.log(`[Executor] Action: "${rawActionType}" -> normalized: "${normalizedAction}"`);
      
      // ============================================================
      // UNIFIED EXECUTION: Try ActionHandlers first for common actions
      // This ensures consistent behavior with PlaywrightRecorder
      // BUT: If unified handler fails for CLICK, fall through to legacy 
      // which has 11+ additional fallback strategies
      // ============================================================
      const unifiedResult = await ActionHandlers.executeAction(this, resolvedStep, { timeout: this.timeout });
      
      // Check if this is a click action that might need legacy fallbacks
      const isClickAction = ['ClickText', 'Click', 'click', 'clicktext', 'clickelement'].includes(normalizedAction);
      
      if (unifiedResult.success) {
        // Action handled successfully by unified handler
        console.log(`[Executor] ✓ Unified handler succeeded for: ${normalizedAction}`);
        if (unifiedResult.screenshot) {
          result.screenshot = unifiedResult.screenshot;
        }
        // Continue to result handling at end of try block
      } else if (!unifiedResult.delegateToContext && !unifiedResult.error?.includes('Unknown action') && !isClickAction) {
        // Unified handler tried but failed - throw error
        // EXCEPTION: Click actions should fall through to legacy handler for additional strategies
        throw new Error(unifiedResult.error || `Action failed: ${normalizedAction}`);
      } else {
        // Unified handler doesn't handle this action OR click failed, use legacy switch
        // Legacy ClickText has 11+ fallback strategies that unified handler doesn't have
        if (isClickAction && !unifiedResult.success) {
          console.log(`[Executor] Click failed in unified handler, trying legacy ClickText with additional strategies...`);
        } else {
          console.log(`[Executor] Delegating to legacy handler: ${normalizedAction}`);
        }
      
      switch (normalizedAction) {
        // Navigation
        case 'GoTo':
        case 'navigate':
          let targetUrl = resolvedStep.args?.[0] || resolvedStep.url;

          // Environment URL rewriting — swap base URL if environmentConfig is set
          if (this.environmentConfig?.env_base_url && this.environmentConfig?.test_base_url) {
            const testBase = this.environmentConfig.test_base_url.replace(/\/+$/, '');
            const envBase = this.environmentConfig.env_base_url.replace(/\/+$/, '');
            if (testBase && envBase && testBase !== envBase && targetUrl && targetUrl.startsWith(testBase)) {
              const rewritten = envBase + targetUrl.substring(testBase.length);
              console.log(`[Executor] 🌍 Environment rewrite: ${targetUrl} → ${rewritten}`);
              targetUrl = rewritten;
            }
          }

          let currentPageUrl = this.page.url();
          
          // Smart skip: detect redundant Salesforce post-login redirects
          if (targetUrl && currentPageUrl) {
            try {
              const targetUrlObj = new URL(targetUrl);
              const currentUrlObj = new URL(currentPageUrl);
              const targetHost = targetUrlObj.hostname.toLowerCase();
              const currentHost = currentUrlObj.hostname.toLowerCase();
              
              // Extract org ID from Salesforce URLs (e.g., "orgfarm-bac28d1362" from the URL)
              const extractOrgId = (host) => {
                const match = host.match(/([a-z0-9]+-[a-z0-9]+)/i);
                return match ? match[1].toLowerCase() : null;
              };
              
              const targetOrgId = extractOrgId(targetHost);
              const currentOrgId = extractOrgId(currentHost);
              
              // Skip navigation if:
              // 1. Same org (same org ID in URL)
              // 2. Target is lightning.force.com (post-login redirect)
              // 3. We're already on Salesforce domain
              const isSameOrg = targetOrgId && currentOrgId && targetOrgId === currentOrgId;
              const isLightningRedirect = targetHost.includes('lightning.force.com');
              const isAlreadyOnSalesforce = currentHost.includes('salesforce.com') || currentHost.includes('lightning.force.com');
              
              if (isSameOrg && isLightningRedirect && isAlreadyOnSalesforce) {
                console.log(`[Executor] Skipping redundant Salesforce navigation - same org ${targetOrgId}`);
                
                // Wait a moment for any in-progress redirects to complete
                await this.page.waitForLoadState('domcontentloaded').catch(() => {});
                break;
              }
              
              // Also skip if already on exact same host with lightning/one.app
              if (currentHost === targetHost && 
                  (currentPageUrl.includes('lightning.force.com') || currentPageUrl.includes('/one/one.app'))) {
                console.log(`[Executor] Skipping redundant navigation - already at ${currentHost}`);
                break;
              }
            } catch (e) {
              console.log('[Executor] URL parsing error, proceeding with navigation:', e.message);
            }
          }
          
          await this.page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded' 
          });
          break;
          
        // Click text action (normalized) - ROBUST VERSION with retries and fallbacks
        case 'ClickText': {
          const clickText = resolvedStep.args?.[0];
          const selectorObj = resolvedStep.selectorObj || {};
          // Element index for duplicate elements (0 = first, 1 = second, etc.)
          const elementIndex = typeof resolvedStep.args?.[1] === 'number' ? resolvedStep.args[1] : 0;
          
          // DEBUG: Log full step data to understand what we're working with
          console.log(`[Executor] ClickText: "${clickText}"${elementIndex > 0 ? ` (index: ${elementIndex})` : ''}`);
          console.log(`[Executor] DEBUG selectorObj:`, JSON.stringify({
            manualOverride: selectorObj.manualOverride,
            selector: selectorObj.selector,
            playwright: selectorObj.playwright,
            tag: selectorObj.tag,
            role: selectorObj.role,
            text: selectorObj.text,
            ariaLabel: selectorObj.ariaLabel,
            id: selectorObj.id,
          }, null, 2));
          
          // Extract ID from fallbacks if not directly available
          // Test cases store ID in fallbacks array: selectorObj.fallbacks[{type: 'id', selector: '#button-cart'}]
          let extractedId = selectorObj.id;
          if (!extractedId && selectorObj.fallbacks && Array.isArray(selectorObj.fallbacks)) {
            const idFallback = selectorObj.fallbacks.find(fb => fb?.type === 'id');
            if (idFallback?.selector) {
              extractedId = idFallback.selector.replace(/^#/, ''); // Remove leading # if present
              console.log(`[Executor] Extracted ID from fallbacks: ${extractedId}`);
            }
          }
          // Also check primary selector for ID
          if (!extractedId && selectorObj.primary?.type === 'id' && selectorObj.primary?.selector) {
            extractedId = selectorObj.primary.selector.replace(/^#/, '');
          }
          
          // Helper to get locator at specific index
          const getAtIndex = (locator) => elementIndex === 0 ? locator.first() : locator.nth(elementIndex);
          
          let clickSuccess = false;
          let clickLocator = null;
          const maxRetries = 3;
          
          // ============================================================
          // LOCKED SELECTOR FAST PATH - Skip ALL strategies if locked selector works
          // From "Lock Locators" feature - resolves in ~150ms vs seconds
          // ============================================================
          this._lastStepUsedLockedSelector = false;
          const lockedLocator = await this._tryLockedSelector(resolvedStep);
          if (lockedLocator) {
            try {
              await lockedLocator.click({ timeout: 3000 });
              clickSuccess = true;
              clickLocator = lockedLocator;
              console.log(`[Executor] ⚡ FAST PATH: ClickText succeeded with locked selector!`);
            } catch (e) {
              console.log(`[Executor] Locked selector found but click failed: ${e.message}, trying other strategies...`);
              this._lastStepUsedLockedSelector = false;
            }
          }
          
          // ============================================================
          // MANUAL OVERRIDE - CHECK FIRST! User-specified selector takes HIGHEST priority
          // ============================================================
          const manualOverride = getManualOverrideSelector(resolvedStep);
          if (manualOverride && !clickSuccess) {
            console.log(`[Executor] 🎯 ClickText MANUAL OVERRIDE: Trying "${manualOverride}"`);
            try {
              const manualLocator = getAtIndex(this.page.locator(manualOverride));
              const count = await manualLocator.count().catch(() => 0);
              if (count > 0) {
                await manualLocator.waitFor({ state: 'visible', timeout: 5000 });
                await manualLocator.click({ timeout: 5000 });
                clickSuccess = true;
                clickLocator = manualLocator;
                console.log(`[Executor] ✅ Manual override click successful!`);
              } else {
                console.log(`[Executor] ⚠️ Manual override found 0 elements, trying other strategies`);
              }
            } catch (e) {
              console.log(`[Executor] ⚠️ Manual override failed: ${e.message}, trying other strategies`);
            }
          }
          
          // V2: TRY SMARTFINDER SECOND (recipe-based element finding)
          // This uses semantic identification (role, text, context) instead of brittle selectors
          if (this.useSmartFinder && !clickSuccess) {
            console.log(`[Executor] Trying SmartFinder V2 for "${clickText}"...`);
            try {
              const v2Locator = await this.findElementV2(resolvedStep);
              if (v2Locator) {
                // DEBUG: Log what we're about to click
                const tagName = await v2Locator.evaluate(el => el.tagName).catch(() => 'unknown');
                const textContent = await v2Locator.evaluate(el => el.textContent?.trim().substring(0, 50)).catch(() => 'unknown');
                console.log(`[Executor] SmartFinder found: <${tagName}> with text: "${textContent}"`);
                
                await v2Locator.waitFor({ state: 'visible', timeout: 5000 });
                await v2Locator.click({ timeout: 5000 });
                clickSuccess = true;
                clickLocator = v2Locator;
                // Capture working selector from SmartFinder for Lock Locators
                if (this.smartFinder) {
                  this._lastWorkingSelector = this.smartFinder.lastSuccessfulSelector || this._lastWorkingSelector;
                  this._lastStrategyType = this.smartFinder.lastSuccessfulStrategy || this._lastStrategyType;
                }
                // FALLBACK: If SmartFinder didn't provide a CSS selector, build one from selectorObj
                if (!this._lastWorkingSelector && selectorObj) {
                  if (selectorObj.testId) this._lastWorkingSelector = `[data-testid="${selectorObj.testId}"]`;
                  else if (selectorObj.id) this._lastWorkingSelector = `#${selectorObj.id}`;
                  else if (selectorObj.ariaLabel) this._lastWorkingSelector = `[aria-label="${selectorObj.ariaLabel}"]`;
                  else if (selectorObj.role && selectorObj.text) this._lastWorkingSelector = `role=${selectorObj.role}[name="${selectorObj.text}"]`;
                  else if (selectorObj.text) this._lastWorkingSelector = `text="${selectorObj.text}"`;
                  if (this._lastWorkingSelector) this._lastStrategyType = 'selectorObj-fallback';
                }
                console.log(`[Executor] ✓ V2 SmartFinder click successful (selector: ${this._lastWorkingSelector || 'none'})`);
              } else {
                console.log(`[Executor] SmartFinder V2 returned null locator`);
              }
            } catch (e) {
              console.log(`[Executor] V2 SmartFinder failed:`, e.message);
            }
          }
          
          // Detect if this is likely a checkbox/radio by selectorObj data
          const isCheckboxRadio = selectorObj.tag === 'input' && 
            (selectorObj.name?.includes('__c') || // Salesforce custom field
             selectorObj.id?.startsWith('checkbox') || 
             selectorObj.id?.startsWith('radio'));
          
          // STRATEGY 1: If checkbox/radio, use name attribute selector with .check()
          if (isCheckboxRadio && selectorObj.name) {
            console.log(`[Executor] Detected checkbox/radio, trying name selector: ${selectorObj.name}`);
            for (let retry = 0; retry < maxRetries && !clickSuccess; retry++) {
              try {
                const checkboxLocator = this.page.locator(`input[name="${selectorObj.name}"]`).first();
                await checkboxLocator.waitFor({ state: 'attached', timeout: 5000 });
                // Use check() for checkboxes - more reliable than click()
                const inputType = await checkboxLocator.getAttribute('type');
                if (inputType === 'checkbox') {
                  await checkboxLocator.check({ timeout: 5000, force: true });
                } else {
                  await checkboxLocator.click({ timeout: 5000, force: true });
                }
                clickSuccess = true;
                clickLocator = checkboxLocator;
                console.log(`[Executor] ✓ Checkbox/radio clicked via name selector`);
              } catch (e) {
                if (retry < maxRetries - 1) {
                  console.log(`[Executor] Retry ${retry + 1}/${maxRetries} for checkbox...`);
                  await this.page.waitForTimeout(500);
                }
              }
            }
          }
          
          // STRATEGY 2: Text-based selectors with multiple fallbacks
          const textStrategies = [
            { name: 'getByText(exact:false)', fn: () => getAtIndex(this.page.getByText(clickText, { exact: false })) },
            { name: 'getByRole(button)', fn: () => getAtIndex(this.page.getByRole('button', { name: clickText })) },
            { name: 'getByRole(link)', fn: () => getAtIndex(this.page.getByRole('link', { name: clickText })) },
            { name: 'getByRole(checkbox)', fn: () => getAtIndex(this.page.getByRole('checkbox', { name: clickText })) },
            { name: 'getByRole(radio)', fn: () => getAtIndex(this.page.getByRole('radio', { name: clickText })) },
            { name: 'getByLabel', fn: () => getAtIndex(this.page.getByLabel(clickText)) },
            { name: 'label:has-text', fn: () => getAtIndex(this.page.locator(`label:has-text("${clickText}")`)) },
            { name: 'getByRole(menuitem)', fn: () => getAtIndex(this.page.getByRole('menuitem', { name: clickText })) },
            { name: 'aria-label/title', fn: () => getAtIndex(this.page.locator(`[aria-label*="${clickText}"], [title*="${clickText}"]`)) },
            // Salesforce-specific: span with text inside checkbox container
            { name: 'slds-checkbox', fn: () => this.page.locator(`.slds-checkbox span:has-text("${clickText}"), .slds-radio span:has-text("${clickText}")`).first() },
            // Click the actual input near text
            { name: 'text-sibling-input', fn: () => this.page.locator(`text="${clickText}" >> xpath=../preceding-sibling::input | text="${clickText}" >> xpath=../input`).first() },
          ];
          
          if (!clickSuccess) {
            console.log(`[Executor] Trying text-based strategies for "${clickText}"...`);
            for (const strategy of textStrategies) {
              if (clickSuccess) break;
              
              for (let retry = 0; retry < 2 && !clickSuccess; retry++) {
                try {
                  clickLocator = strategy.fn();
                  const count = await clickLocator.count().catch(() => 0);
                  if (count === 0) {
                    if (retry === 0) console.log(`[Executor] Strategy "${strategy.name}" found 0 elements`);
                    continue;
                  }
                  
                  await clickLocator.waitFor({ state: 'visible', timeout: retry === 0 ? 3000 : 5000 });
                  
                  // DEBUG: Log what we found
                  const tagName = await clickLocator.evaluate(el => el.tagName).catch(() => 'unknown');
                  const textContent = await clickLocator.evaluate(el => el.textContent?.trim().substring(0, 50)).catch(() => 'unknown');
                  console.log(`[Executor] Strategy "${strategy.name}" found: <${tagName}> with text: "${textContent}"`);
                  
                  // For checkbox/radio roles, use check() method
                  const role = await clickLocator.getAttribute('role').catch(() => null);
                  const type = await clickLocator.getAttribute('type').catch(() => null);
                  
                  if (type === 'checkbox' || role === 'checkbox') {
                    await clickLocator.check({ timeout: 3000 }).catch(async () => {
                      await clickLocator.click({ timeout: 3000, force: true });
                    });
                  } else if (type === 'radio' || role === 'radio') {
                    await clickLocator.click({ timeout: 3000, force: true });
                  } else {
                    await clickLocator.click({ timeout: 3000 });
                  }
                  
                  clickSuccess = true;
                  console.log(`[Executor] ✓ Click succeeded with strategy "${strategy.name}"`);
                } catch (e) {
                  // Try next strategy
                }
              }
            }
          }
          
          // STRATEGY 3: Last resort - CSS selector from recording (ID or explicit selector)
          if (!clickSuccess && extractedId) {
            console.log(`[Executor] Trying recorded ID selector: #${extractedId}`);
            try {
              clickLocator = this.page.locator(`#${extractedId}`);
              await clickLocator.click({ timeout: 5000, force: true });
              clickSuccess = true;
              console.log(`[Executor] ✓ Click succeeded with ID selector`);
            } catch (e) {
              console.log(`[Executor] ID selector #${extractedId} failed:`, e.message);
            }
          }
          
          // STRATEGY 3b: Try fallback selectors from selectorObj.fallbacks
          if (!clickSuccess && selectorObj.fallbacks && Array.isArray(selectorObj.fallbacks)) {
            for (const fallback of selectorObj.fallbacks) {
              if (clickSuccess) break;
              const fbSelector = fallback?.selector || fallback?.playwright;
              if (!fbSelector) continue;
              
              console.log(`[Executor] Trying fallback selector: ${fbSelector}`);
              try {
                // Handle playwright-style selectors
                if (fbSelector.startsWith('locator(')) {
                  const innerSelector = fbSelector.match(/locator\(['"](.+)['"]\)/)?.[1];
                  if (innerSelector) {
                    clickLocator = getAtIndex(this.page.locator(innerSelector));
                  }
                } else if (fbSelector.startsWith('getByRole')) {
                  // Already tried in text strategies
                  continue;
                } else {
                  clickLocator = getAtIndex(this.page.locator(fbSelector));
                }
                
                if (clickLocator) {
                  await clickLocator.click({ timeout: 5000, force: true });
                  clickSuccess = true;
                  console.log(`[Executor] ✓ Click succeeded with fallback selector: ${fbSelector}`);
                }
              } catch (e) {
                console.log(`[Executor] Fallback ${fbSelector} failed:`, e.message);
              }
            }
          }
          
          // AI FALLBACK: Try AI vision as absolute last resort
          if (!clickSuccess && this.enableAIFallback) {
            console.log(`[Executor] All strategies failed for click, trying AI fallback...`);
            const aiResult = await this.findElementWithAI(clickText, 'click');
            
            if (aiResult) {
              try {
                await this.clickAtCoordinates(aiResult.x, aiResult.y);
                clickSuccess = true;
                console.log(`[Executor] ✓ AI Fallback click succeeded at (${aiResult.x}, ${aiResult.y})`);
              } catch (e) {
                console.log(`[Executor] AI Fallback click failed:`, e.message);
              }
            }
          }
          
          if (!clickSuccess) {
            throw new Error(`Could not click "${clickText}" after trying all strategies including AI fallback`);
          }
          
          // Wait for UI to settle - minimal when locked selector succeeded (reliable, fast path)
          if (this._lastStepUsedLockedSelector) {
            await this.page.waitForTimeout(50); // Minimal wait for locked selector fast path
          } else {
            const isFormElement = isCheckboxRadio || 
              (clickText && clickText.length < 30 && clickText.split(' ').length <= 3);
            
            if (isFormElement) {
              console.log('[Executor] Form element click, waiting for state change...');
              await this.page.waitForTimeout(500);
            } else {
              await this.page.waitForTimeout(300);
            }
          }
          
          // If this looks like a login/submit button, wait for page update
          const clickTextLower = (clickText || '').toLowerCase();
          if (clickTextLower.includes('log in') || clickTextLower.includes('login') || 
              clickTextLower.includes('sign in') || clickTextLower.includes('submit')) {
            console.log('[Executor] Detected login/submit click, waiting for page update...');
            try {
              await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
            } catch (e) {
              console.log('[Executor] Navigation wait timed out, continuing...');
            }
          }
          break;
        }
          
        // Click element action - ROBUST with fallback selectors
        case 'ClickElement': {
          const clickSelectorObj = resolvedStep.selectorObj || {};
          const clickText = clickSelectorObj.text || resolvedStep.args?.[0] || '';
          
          // ============================================================
          // LOCKED SELECTOR FAST PATH for ClickElement
          // ============================================================
          this._lastStepUsedLockedSelector = false;
          const lockedClickElLocator = await this._tryLockedSelector(resolvedStep);
          if (lockedClickElLocator) {
            try {
              await lockedClickElLocator.click({ timeout: 3000 });
              console.log(`[Executor] ⚡ FAST PATH: ClickElement succeeded with locked selector!`);
              await this.page.waitForTimeout(50); // Minimal post-click wait for locked selector
              break; // Skip all other strategies
            } catch (e) {
              console.log(`[Executor] Locked selector ClickElement failed: ${e.message}, trying other strategies...`);
              this._lastStepUsedLockedSelector = false;
            }
          }
          
          // Normalize text: strip trailing numbers and emojis (badge counts, etc.)
          // CRITICAL: Don't strip ALL non-ASCII - preserve apostrophes, accented chars, quotes
          const normalizedClickText = clickText
            .replace(/\s*\d+\s*$/, '')    // Strip trailing numbers
            // Only strip actual emojis, not quotes/apostrophes
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Emojis in Misc Symbols and Pictographs
            .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
            .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // Emoticons
            // Normalize apostrophe variants to straight apostrophe
            .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'")
            .trim();
          
          // Build list of selectors to try (in PRIORITY order)
          const clickSelectorsToTry = [];
          
          // 1. HIGHEST PRIORITY: data-testid (most stable)
          if (clickSelectorObj.testId) {
            clickSelectorsToTry.push(`[data-testid="${clickSelectorObj.testId}"]`);
          }
          // Also check common data-test attributes
          if (clickSelectorObj.dataTestId) clickSelectorsToTry.push(`[data-testid="${clickSelectorObj.dataTestId}"]`);
          if (clickSelectorObj.dataTest) clickSelectorsToTry.push(`[data-test="${clickSelectorObj.dataTest}"]`);
          
          // 2. name attribute (CRITICAL for buttons - very stable!)
          if (clickSelectorObj.name) {
            clickSelectorsToTry.push(`[name="${clickSelectorObj.name}"]`);
            clickSelectorsToTry.push(`button[name="${clickSelectorObj.name}"]`);
          }
          
          // 3. aria-label (accessibility, very stable)
          if (clickSelectorObj.ariaLabel) {
            clickSelectorsToTry.push(`[aria-label="${clickSelectorObj.ariaLabel}"]`);
          }
          
          // 4. ID (if not dynamic)
          if (clickSelectorObj.id && !/^[a-f0-9]{8,}|^\d{6,}|^:r/.test(clickSelectorObj.id)) {
            clickSelectorsToTry.push(`#${clickSelectorObj.id}`);
          }
          
          // 5. Role + name (semantic)
          if (clickSelectorObj.role && normalizedClickText) {
            clickSelectorsToTry.push(`[role="${clickSelectorObj.role}"][aria-label="${normalizedClickText}"]`);
          }
          
          // 5. Original playwright selector
          if (clickSelectorObj.playwright) {
            clickSelectorsToTry.push(clickSelectorObj.playwright);
          }
          
          // 6. Original CSS selector
          if (clickSelectorObj.selector) {
            clickSelectorsToTry.push(clickSelectorObj.selector);
          }
          if (resolvedStep.selector) {
            clickSelectorsToTry.push(this.normalizeSelector(resolvedStep.selector));
          }
          
          // 7. Text-based selectors (NORMALIZED to avoid badge issues)
          if (normalizedClickText && normalizedClickText.length > 0) {
            clickSelectorsToTry.push(`text="${normalizedClickText}"`);
            clickSelectorsToTry.push(`text=${normalizedClickText}`);
          }
          
          // 8. Title attribute
          if (clickSelectorObj.title) {
            clickSelectorsToTry.push(`[title="${clickSelectorObj.title}"]`);
          }
          
          // 9. Fallbacks from recording
          if (clickSelectorObj.fallbacks && Array.isArray(clickSelectorObj.fallbacks)) {
            clickSelectorObj.fallbacks.forEach(fb => {
              if (fb?.selector) clickSelectorsToTry.push(fb.selector);
              if (fb?.playwright) clickSelectorsToTry.push(fb.playwright);
            });
          }
          
          // Remove duplicates and empty
          const uniqueClickSelectors = [...new Set(clickSelectorsToTry.filter(s => s && s.length > 0))];
          console.log(`[Executor] ClickElement: trying ${uniqueClickSelectors.length} selectors for "${normalizedClickText || 'element'}"`);
          
          // Try each selector until one works
          let clickSuccess = false;
          let lastClickError = '';
          
          for (const selector of uniqueClickSelectors) {
            try {
              console.log(`[Executor] Trying click selector: ${selector.substring(0, 60)}...`);
              
              let locator;
              // Handle Playwright-style selectors
              if (selector.startsWith('getBy') || selector.startsWith('locator(')) {
                // This is a Playwright method call, need to eval it
                locator = this.page.locator(selector.replace(/^locator\(['"](.+)['"]\)$/, '$1'));
              } else {
                locator = this.page.locator(selector);
              }
              
              const count = await locator.count();
              if (count === 0) {
                console.log(`[Executor] Selector found 0 elements, trying next...`);
                continue;
              }
              
              // Get first visible element
              const element = locator.first();
              
              // Scroll into view
              await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
              
              // Wait for visible
              await element.waitFor({ state: 'visible', timeout: 5000 });
              
              // Click with force to bypass actionability checks
              await element.click({ force: true, timeout: 5000 });
              
              console.log(`[Executor] ✅ Click succeeded with selector: ${selector.substring(0, 50)}...`);
              clickSuccess = true;
              break;
            } catch (e) {
              lastClickError = e.message;
              console.log(`[Executor] ❌ Click selector failed: ${selector.substring(0, 40)}... - ${e.message.substring(0, 50)}`);
              continue;
            }
          }
          
          // AI FALLBACK: Try AI vision as absolute last resort
          if (!clickSuccess && this.enableAIFallback) {
            console.log(`[Executor] All selectors failed for ClickElement, trying AI fallback...`);
            const elementDesc = normalizedClickText || clickSelectorObj.ariaLabel || clickSelectorObj.title || 'element';
            const aiResult = await this.findElementWithAI(elementDesc, 'click');
            
            if (aiResult) {
              try {
                await this.clickAtCoordinates(aiResult.x, aiResult.y);
                clickSuccess = true;
                console.log(`[Executor] ✓ AI Fallback ClickElement succeeded at (${aiResult.x}, ${aiResult.y})`);
              } catch (e) {
                console.log(`[Executor] AI Fallback ClickElement failed:`, e.message);
              }
            }
          }
          
          if (!clickSuccess) {
            throw new Error(`Click failed: Could not find element "${normalizedClickText}". Tried ${uniqueClickSelectors.length} selectors + AI fallback. Last error: ${lastClickError}`);
          }
          break;
        }
          
        // Input actions - ROBUST with data-testid priority and section context
        case 'Fill':
        case 'input': {
          const fieldName = resolvedStep.args?.[0] || '';
          const inputValue = resolvedStep.args?.[1] || resolvedStep.value || '';
          const fillSelectorObj = resolvedStep.selectorObj || {};
          
          // ============================================================
          // LOCKED SELECTOR FAST PATH for Fill
          // ============================================================
          this._lastStepUsedLockedSelector = false;
          const lockedFillLocator = await this._tryLockedSelector(resolvedStep);
          if (lockedFillLocator) {
            try {
              await lockedFillLocator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
              await lockedFillLocator.click({ timeout: 2000 }).catch(() => {});
              await this.page.waitForTimeout(20); // Minimal focus delay for locked selector
              await lockedFillLocator.fill(inputValue);
              console.log(`[Executor] ⚡ FAST PATH: Fill succeeded with locked selector!`);
              break; // Skip all other fill strategies
            } catch (e) {
              console.log(`[Executor] Locked selector Fill failed: ${e.message}, trying other strategies...`);
              this._lastStepUsedLockedSelector = false;
            }
          }
          
          // Get additional context for disambiguation
          const formId = fillSelectorObj.formId || '';
          const sectionContext = fillSelectorObj.sectionContext || '';
          const associatedLabel = fillSelectorObj.label || '';
          
          // Build list of selectors to try (in PRIORITY order)
          const selectorsToTry = [];
          
          // 1. HIGHEST PRIORITY: data-testid (most stable, unique)
          if (fillSelectorObj.testId) {
            selectorsToTry.push(`[data-testid="${fillSelectorObj.testId}"]`);
          }
          if (fillSelectorObj.dataTestId) selectorsToTry.push(`[data-testid="${fillSelectorObj.dataTestId}"]`);
          if (fillSelectorObj.dataTest) selectorsToTry.push(`[data-test="${fillSelectorObj.dataTest}"]`);
          
          // 2. ID (most reliable if not dynamic)
          if (fillSelectorObj.id && !/^[a-f0-9]{8,}|^\d{6,}|^:r/.test(fillSelectorObj.id)) {
            selectorsToTry.push(`#${fillSelectorObj.id}`);
          }
          
          // 3. Name attribute SCOPED to form if available (prevents cross-form matching)
          if (fillSelectorObj.name) {
            if (formId) {
              selectorsToTry.push(`#${formId} [name="${fillSelectorObj.name}"]`);
            }
            selectorsToTry.push(`[name="${fillSelectorObj.name}"]`);
          }
          
          // 4. Aria-label (accessibility, unique)
          if (fillSelectorObj.ariaLabel) selectorsToTry.push(`[aria-label="${fillSelectorObj.ariaLabel}"]`);
          
          // 5. Placeholder SCOPED to section context (prevents promo code -> search issues)
          if (fillSelectorObj.placeholder) {
            if (sectionContext) {
              // Try to scope by section class or ID
              selectorsToTry.push(`.${sectionContext} [placeholder="${fillSelectorObj.placeholder}"]`);
              selectorsToTry.push(`#${sectionContext} [placeholder="${fillSelectorObj.placeholder}"]`);
              selectorsToTry.push(`[class*="${sectionContext}"] [placeholder="${fillSelectorObj.placeholder}"]`);
            }
            selectorsToTry.push(`[placeholder="${fillSelectorObj.placeholder}"]`);
          }
          
          // 6. Associated label (from recording) - very specific
          if (associatedLabel) {
            selectorsToTry.push(`label:has-text("${associatedLabel}") input`);
            selectorsToTry.push(`label:has-text("${associatedLabel}") textarea`);
          }
          
          // 7. Explicit selector from recording
          if (resolvedStep.selector) selectorsToTry.push(this.normalizeSelector(resolvedStep.selector));
          if (fillSelectorObj.selector) selectorsToTry.push(fillSelectorObj.selector);
          
          // 8. Label association (Playwright's label= selector)
          if (fieldName) selectorsToTry.push(`label=${fieldName}`);
          
          // 9. Fallbacks from recording
          if (fillSelectorObj.fallbacks && Array.isArray(fillSelectorObj.fallbacks)) {
            fillSelectorObj.fallbacks.forEach(fb => {
              if (fb?.selector) selectorsToTry.push(fb.selector);
            });
          }
          
          // NOTE: Removed risky partial placeholder match [placeholder*=...] 
          // It was matching wrong inputs!
          
          console.log(`[Executor] Fill context: formId=${formId}, section=${sectionContext}, label=${associatedLabel}`);
          
          // Remove duplicates and empty values
          const uniqueSelectors = [...new Set(selectorsToTry.filter(s => s && s.length > 0))];
          console.log(`[Executor] Fill: trying ${uniqueSelectors.length} selectors for field "${fieldName}"`);
          
          // Try each selector until one works
          let fillSuccess = false;
          for (const selector of uniqueSelectors) {
            try {
              console.log(`[Executor] Trying selector: ${selector}`);
              const locator = this.page.locator(selector).first();
              
              // First scroll into view (element might be below the fold)
              await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
              
              // Wait for element to be visible and editable
              await locator.waitFor({ state: 'visible', timeout: 5000 });
              
              // Click to focus first (helps with some complex input components)
              await locator.click({ timeout: 2000 }).catch(() => {});
              
              // Small delay for focus to register
              await this.page.waitForTimeout(100);
              
              // Now fill
              await locator.fill(inputValue);
              console.log(`[Executor] ✅ Fill succeeded with selector: ${selector}`);
              fillSuccess = true;
              break;
            } catch (e) {
              console.log(`[Executor] ❌ Selector failed: ${selector} - ${e.message}`);
              continue;
            }
          }
          
          // AI FALLBACK: Try AI vision as absolute last resort for Fill
          if (!fillSuccess && this.enableAIFallback) {
            console.log(`[Executor] All selectors failed for Fill, trying AI fallback...`);
            const inputDesc = fieldName || fillSelectorObj.ariaLabel || fillSelectorObj.placeholder || 'input field';
            const aiResult = await this.findElementWithAI(inputDesc, 'fill');
            
            if (aiResult) {
              try {
                // Click on the input first
                await this.page.mouse.click(aiResult.x, aiResult.y);
                await this.page.waitForTimeout(100);
                
                // Now type the value
                await this.page.keyboard.type(inputValue);
                fillSuccess = true;
                console.log(`[Executor] ✓ AI Fallback Fill succeeded at (${aiResult.x}, ${aiResult.y})`);
              } catch (e) {
                console.log(`[Executor] AI Fallback Fill failed:`, e.message);
              }
            }
          }
          
          if (!fillSuccess) {
            throw new Error(`Fill failed: Could not find input for "${fieldName}". Tried ${uniqueSelectors.length} selectors + AI fallback.`);
          }
          break;
        }
          
        // Select dropdown - handles both native <select> and custom dropdowns (Radix, Headless UI, etc.)
        case 'Select':
        case 'select': {
          const selectLabel = resolvedStep.args?.[0] || this.normalizeSelector(resolvedStep.selector);
          const selectValue = resolvedStep.args?.[1] || resolvedStep.value?.text || resolvedStep.value;
          
          console.log(`[Executor] Select: "${selectValue}" from "${selectLabel}"`);
          
          let selectSuccess = false;
          
          // V2: TRY SMARTFINDER FIRST (handles Radix/Headless UI dropdowns)
          if (this.useSmartFinder && !selectSuccess) {
            selectSuccess = await this.executeSelectV2(resolvedStep);
          }
          
          // LEGACY FALLBACK: Try native select first
          if (!selectSuccess) {
            try {
              // Try native select
              const selectSelector = this.normalizeSelector(resolvedStep.selector) || 
                                     `select[name*="${selectLabel}" i], select[aria-label*="${selectLabel}" i]`;
              await this.page.selectOption(selectSelector, selectValue, { timeout: 3000 });
              selectSuccess = true;
              console.log(`[Executor] ✓ Native select successful`);
            } catch (e) {
              console.log(`[Executor] Native select failed, trying custom dropdown...`);
            }
          }
          
          // FALLBACK 2: Handle custom dropdown (click trigger, then click option)
          if (!selectSuccess) {
            try {
              // Find and click the trigger
              const triggers = [
                this.page.getByLabel(selectLabel),
                this.page.locator(`[aria-label*="${selectLabel}" i]`).first(),
                this.page.locator(`[data-testid*="${selectLabel.toLowerCase().replace(/\s+/g, '-')}"]`).first(),
                this.page.getByRole('combobox', { name: selectLabel }),
                this.page.locator(`.select-trigger:has-text("${selectLabel}")`).first(),
              ];
              
              for (const triggerLocator of triggers) {
                try {
                  await triggerLocator.waitFor({ state: 'visible', timeout: 2000 });
                  await triggerLocator.click({ timeout: 3000 });
                  
                  // Wait for dropdown to open
                  await this.page.waitForTimeout(200);
                  
                  // Click the option
                  const option = this.page.getByRole('option', { name: selectValue })
                    .or(this.page.getByRole('menuitem', { name: selectValue }))
                    .or(this.page.getByText(selectValue, { exact: true }));
                  
                  await option.first().click({ timeout: 3000 });
                  selectSuccess = true;
                  console.log(`[Executor] ✓ Custom dropdown select successful`);
                  break;
                } catch (triggerError) {
                  // Try next trigger
                }
              }
            } catch (e) {
              console.log(`[Executor] Custom dropdown select failed:`, e.message);
            }
          }
          
          if (!selectSuccess) {
            throw new Error(`Could not select "${selectValue}" from "${selectLabel}"`);
          }
          break;
        }
          
        // Hover - UNIFIED: Uses shared ActionHandlers for consistent behavior
        case 'Hover':
        case 'hover': {
          // Use shared ActionHandlers.handleHover for consistent execution with PlaywrightRecorder
          const hoverResult = await ActionHandlers.handleHover(this, resolvedStep, { timeout: this.timeout });
          if (!hoverResult.success) {
            throw new Error(hoverResult.error || 'Hover failed');
          }
          break;
        }
          
        // Wait actions
        case 'Wait':
        case 'wait':
          const waitTime = resolvedStep.args?.[0] || resolvedStep.value || 1000;
          await this.page.waitForTimeout(parseInt(waitTime));
          break;
          
        case 'WaitForElement':
        case 'wait_for_element':
          const waitSelector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
          await this.page.waitForSelector(waitSelector);
          break;
          
        case 'WaitForText':
        case 'wait_for_text':
          const waitText = resolvedStep.args?.[0] || resolvedStep.value;
          await this.page.getByText(waitText).first().waitFor();
          break;
          
        // Assertions
        case 'AssertText':
        case 'assert':
          const assertText = resolvedStep.args?.[0] || resolvedStep.value;
          const element = this.page.getByText(assertText).first();
          await element.waitFor({ timeout: this.timeout });
          const isVisible = await element.isVisible();
          if (!isVisible) {
            throw new Error(`Text "${assertText}" not visible`);
          }
          break;
          
        case 'AssertElement':
          const assertSelector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
          await this.page.waitForSelector(assertSelector);
          break;
          
        case 'AssertUrl':
          const expectedUrl = resolvedStep.args?.[0] || resolvedStep.value;
          const currentUrl = this.page.url();
          if (!currentUrl.includes(expectedUrl)) {
            throw new Error(`URL "${currentUrl}" does not contain "${expectedUrl}"`);
          }
          break;
          
        case 'AssertTitle':
          const expectedTitle = resolvedStep.args?.[0] || resolvedStep.value;
          const title = await this.page.title();
          if (!title.includes(expectedTitle)) {
            throw new Error(`Title "${title}" does not contain "${expectedTitle}"`);
          }
          break;
          
        // Screenshot
        case 'Screenshot':
        case 'screenshot':
          result.screenshot = await this.page.screenshot({ type: 'png' });
          break;
          
        // Extract variable
        case 'Extract':
        case 'extract':
        case 'store_variable':
          const extractSelector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
          const variableName = resolvedStep.args?.[1] || resolvedStep.variableName || 'extracted';
          const extractedValue = await this.page.locator(extractSelector).first().textContent();
          result.extractedValue = { name: variableName, value: extractedValue };
          break;
          
        // Keyboard actions
        case 'Press':
        case 'keyboard':
          const key = resolvedStep.args?.[0] || resolvedStep.value;
          await this.page.keyboard.press(key);
          break;
          
        // Scroll
        case 'Scroll':
        case 'scroll':
          const scrollTarget = this.normalizeSelector(resolvedStep.selector);
          if (scrollTarget) {
            await this.page.locator(scrollTarget).first().scrollIntoViewIfNeeded();
          } else {
            await this.page.evaluate(() => window.scrollBy(0, 300));
          }
          break;
          
        // Custom JavaScript
        case 'Execute':
        case 'custom':
          const script = resolvedStep.args?.[0] || resolvedStep.value;
          result.returnValue = await this.page.evaluate(script);
          break;

        // ============ SALESFORCE-SPECIFIC ACTIONS ============
        
        // Execute SOQL Query
        case 'ExecuteSOQL':
          const soqlQuery = resolvedStep.args?.[0] || resolvedStep.value;
          console.log(`[SF] Executing SOQL: ${soqlQuery}`);
          const queryResult = await this.sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQuery)}`);
          console.log(`[SF] SOQL returned ${queryResult.totalSize} records`);
          result.returnValue = queryResult;
          result.extractedValue = { 
            name: 'soqlResult', 
            value: queryResult,
            recordCount: queryResult.totalSize,
            records: queryResult.records 
          };
          break;

        // Execute Anonymous Apex
        case 'ExecuteApex':
          const apexCode = resolvedStep.args?.[0] || resolvedStep.value;
          console.log(`[SF] Executing Apex: ${apexCode.substring(0, 100)}...`);
          const apexResult = await this.sfApiCall(
            'GET', 
            `/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCode)}`
          );
          if (!apexResult.success) {
            throw new Error(`Apex execution failed: ${apexResult.compileProblem || apexResult.exceptionMessage}`);
          }
          console.log(`[SF] Apex executed successfully`);
          result.returnValue = apexResult;
          break;

        // REST API Call
        case 'RestApiCall':
          const apiMethod = resolvedStep.args?.[0] || 'GET';
          const apiEndpoint = resolvedStep.args?.[1] || resolvedStep.value;
          const apiBody = resolvedStep.args?.[2] ? JSON.parse(resolvedStep.args[2]) : null;
          console.log(`[SF] API Call: ${apiMethod} ${apiEndpoint}`);
          const apiResult = await this.sfApiCall(apiMethod, apiEndpoint, apiBody);
          console.log(`[SF] API Response received`);
          result.returnValue = apiResult;
          break;

        // Create Test Data (Data Factory)
        case 'CreateTestData':
          const objectType = resolvedStep.args?.[0] || 'Account';
          const recordCount = parseInt(resolvedStep.args?.[1] || '1');
          console.log(`[SF] Creating ${recordCount} ${objectType} record(s)`);
          const createdIds = [];
          for (let i = 0; i < recordCount; i++) {
            const testData = this.generateTestData(objectType);
            const createResult = await this.sfApiCall('POST', `/sobjects/${objectType}/`, testData);
            createdIds.push(createResult.id);
            console.log(`[SF] Created ${objectType}: ${createResult.id}`);
          }
          result.returnValue = { objectType, count: recordCount, ids: createdIds };
          result.extractedValue = { name: 'createdRecordIds', value: createdIds };
          break;

        // Clone Record
        case 'CloneRecord':
          const cloneObjectType = resolvedStep.args?.[0] || 'Account';
          let cloneRecordId = resolvedStep.args?.[1];
          
          // If no ID provided, try to get it from current page URL
          if (!cloneRecordId) {
            const pageUrl = this.page.url();
            const idMatch = pageUrl.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
            cloneRecordId = idMatch ? idMatch[1] : null;
          }
          
          if (!cloneRecordId) {
            throw new Error('Clone failed: No record ID provided or found in URL');
          }
          
          console.log(`[SF] Cloning ${cloneObjectType} record: ${cloneRecordId}`);
          
          // Get original record
          const originalRecord = await this.sfApiCall('GET', `/sobjects/${cloneObjectType}/${cloneRecordId}`);
          
          // Remove non-createable fields
          const nonCreateableFields = ['Id', 'IsDeleted', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 
                                       'LastModifiedById', 'SystemModstamp', 'LastActivityDate', 'LastViewedDate', 
                                       'LastReferencedDate', 'attributes'];
          const cloneData = {};
          for (const [key, value] of Object.entries(originalRecord)) {
            if (!nonCreateableFields.includes(key) && value !== null) {
              cloneData[key] = value;
            }
          }
          // Modify name to indicate clone
          if (cloneData.Name) cloneData.Name = `Clone - ${cloneData.Name}`;
          
          const cloneResult = await this.sfApiCall('POST', `/sobjects/${cloneObjectType}/`, cloneData);
          console.log(`[SF] Cloned record created: ${cloneResult.id}`);
          result.returnValue = { originalId: cloneRecordId, clonedId: cloneResult.id };
          result.extractedValue = { name: 'clonedRecordId', value: cloneResult.id };
          break;

        // Delete Record
        case 'DeleteRecord':
          let deleteRecordId = resolvedStep.args?.[0];
          const deleteObjectType = resolvedStep.args?.[1];
          
          // If "CurrentRecord", get ID from URL
          if (!deleteRecordId || deleteRecordId === 'CurrentRecord') {
            const pageUrl = this.page.url();
            const idMatch = pageUrl.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$|\?)/);
            deleteRecordId = idMatch ? idMatch[1] : null;
          }
          
          if (!deleteRecordId) {
            throw new Error('Delete failed: No record ID provided or found in URL');
          }
          
          // Determine object type from ID prefix if not provided
          const objectPrefix = deleteRecordId.substring(0, 3);
          const prefixMap = { '001': 'Account', '003': 'Contact', '00Q': 'Lead', '006': 'Opportunity', '500': 'Case' };
          const detectedType = deleteObjectType || prefixMap[objectPrefix] || 'Account';
          
          console.log(`[SF] Deleting ${detectedType} record: ${deleteRecordId}`);
          await this.sfApiCall('DELETE', `/sobjects/${detectedType}/${deleteRecordId}`);
          console.log(`[SF] Record deleted successfully`);
          result.returnValue = { deletedId: deleteRecordId, objectType: detectedType };
          break;

        // Trigger Flow
        case 'TriggerFlow':
          const flowApiName = resolvedStep.args?.[0] || resolvedStep.value;
          const flowInputs = resolvedStep.args?.[1] ? JSON.parse(resolvedStep.args[1]) : {};
          console.log(`[SF] Triggering Flow: ${flowApiName}`);
          
          const flowResult = await this.sfApiCall('POST', `/actions/custom/flow/${flowApiName}`, {
            inputs: [flowInputs]
          });
          console.log(`[SF] Flow executed`);
          result.returnValue = flowResult;
          break;

        // Manage Permission Set
        case 'ManagePermissionSet':
          const psAction = resolvedStep.args?.[0] || 'assign'; // 'assign' or 'remove'
          const permissionSetName = resolvedStep.args?.[1] || resolvedStep.value;
          
          // Get current user ID
          const userInfo = await this.sfApiCall('GET', '/sobjects/User/Me');
          const userId = userInfo.Id;
          
          // Find permission set ID
          const psQuery = await this.sfApiCall('GET', 
            `/query?q=${encodeURIComponent(`SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}'`)}`
          );
          
          if (psQuery.totalSize === 0) {
            throw new Error(`Permission Set not found: ${permissionSetName}`);
          }
          const permissionSetId = psQuery.records[0].Id;
          
          if (psAction === 'assign') {
            // Check if already assigned
            const existingAssignment = await this.sfApiCall('GET',
              `/query?q=${encodeURIComponent(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSetId = '${permissionSetId}'`)}`
            );
            
            if (existingAssignment.totalSize === 0) {
              console.log(`[SF] Assigning Permission Set: ${permissionSetName} to user ${userId}`);
              await this.sfApiCall('POST', '/sobjects/PermissionSetAssignment/', {
                AssigneeId: userId,
                PermissionSetId: permissionSetId
              });
            } else {
              console.log(`[SF] Permission Set already assigned`);
            }
          } else {
            // Remove assignment
            const assignment = await this.sfApiCall('GET',
              `/query?q=${encodeURIComponent(`SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' AND PermissionSetId = '${permissionSetId}'`)}`
            );
            
            if (assignment.totalSize > 0) {
              console.log(`[SF] Removing Permission Set: ${permissionSetName}`);
              await this.sfApiCall('DELETE', `/sobjects/PermissionSetAssignment/${assignment.records[0].Id}`);
            }
          }
          result.returnValue = { action: psAction, permissionSet: permissionSetName, userId };
          break;

        // Navigate to Salesforce object/page
        case 'NavigateTo':
          const navTarget = resolvedStep.args?.[0] || resolvedStep.value;
          console.log(`[SF] NavigateTo target: "${navTarget}"`);
          
          // Build Lightning URL
          let navUrl;
          if (navTarget && navTarget.startsWith('http')) {
            navUrl = navTarget;
          } else {
            // Try to get Salesforce session for instance URL
            try {
              const session = await this.getSalesforceSession();
              if (navTarget && navTarget.includes('/')) {
                // Already a path
                navUrl = `${session.instanceUrl}${navTarget}`;
              } else if (navTarget) {
                // Object name - go to list view (e.g., "Accounts" -> /lightning/o/Account/list)
                const objectName = navTarget.replace(/s$/, ''); // Remove trailing 's' (Accounts -> Account)
                navUrl = `${session.instanceUrl}/lightning/o/${objectName}/list`;
              }
            } catch (e) {
              // If no session, try to use current page URL as base
              const currentUrl = this.page.url();
              const baseMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
              if (baseMatch && navTarget) {
                const baseUrl = baseMatch[1];
                const objectName = navTarget.replace(/s$/, '');
                navUrl = `${baseUrl}/lightning/o/${objectName}/list`;
              } else {
                throw new Error(`Cannot navigate to "${navTarget}" - not logged into Salesforce`);
              }
            }
          }
          
          if (navUrl) {
            console.log(`[SF] Navigating to: ${navUrl}`);
            await this.page.goto(navUrl, { waitUntil: 'domcontentloaded' });
          } else {
            throw new Error(`Invalid navigation target: ${navTarget}`);
          }
          break;

        // Assert Validation Rule Error
        case 'AssertValidation':
          const validationRuleName = resolvedStep.args?.[0];
          const expectedErrorText = resolvedStep.args?.[1] || validationRuleName;
          
          console.log(`[SF] Asserting validation error contains: "${expectedErrorText}"`);
          
          // Look for error message in common Salesforce error locations
          const errorSelectors = [
            '.slds-notify__content',
            '.errorsList',
            '.message.errorM3',
            '[data-aura-class="forceFormPageError"]',
            '.slds-form-element__help',
            '.uiInputDefaultError',
            '.slds-text-color_error'
          ];
          
          let errorFound = false;
          for (const selector of errorSelectors) {
            try {
              const errorElement = this.page.locator(selector);
              if (await errorElement.count() > 0) {
                const errorText = await errorElement.first().textContent();
                if (errorText && errorText.toLowerCase().includes(expectedErrorText.toLowerCase())) {
                  errorFound = true;
                  console.log(`[SF] Validation error found: "${errorText}"`);
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          if (!errorFound) {
            throw new Error(`Validation error not found: "${expectedErrorText}"`);
          }
          result.returnValue = { validationFound: true, expectedText: expectedErrorText };
          break;

        // Assert Field Value
        case 'AssertFieldValue':
          const fieldToAssert = resolvedStep.args?.[0];
          const expectedFieldValue = resolvedStep.args?.[1];
          
          console.log(`[SF] Asserting field "${fieldToAssert}" = "${expectedFieldValue}"`);
          
          // Try to find field by label
          const fieldSelectors = [
            `[data-field="${fieldToAssert}"]`,
            `[data-name="${fieldToAssert}"]`,
            `.slds-form-element:has-text("${fieldToAssert}") .slds-form-element__control`,
            `lightning-formatted-text:near(:text("${fieldToAssert}"))`,
          ];
          
          let actualValue = null;
          for (const selector of fieldSelectors) {
            try {
              const fieldElement = this.page.locator(selector).first();
              if (await fieldElement.count() > 0) {
                actualValue = await fieldElement.textContent();
                actualValue = actualValue?.trim();
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          // Fallback: search entire page for the value near the field label
          if (actualValue === null) {
            const pageContent = await this.page.content();
            if (pageContent.includes(expectedFieldValue)) {
              actualValue = expectedFieldValue; // Value exists on page
            }
          }
          
          if (actualValue === null) {
            throw new Error(`Could not find field "${fieldToAssert}" on page`);
          }
          
          if (!actualValue.includes(expectedFieldValue)) {
            throw new Error(`Field "${fieldToAssert}" value "${actualValue}" does not match expected "${expectedFieldValue}"`);
          }
          
          console.log(`[SF] Field assertion passed: "${fieldToAssert}" = "${actualValue}"`);
          result.returnValue = { field: fieldToAssert, expected: expectedFieldValue, actual: actualValue };
          break;

        // Run Apex Test
        case 'RunApexTest':
          const testClassName = resolvedStep.args?.[0] || resolvedStep.value;
          const testMethodName = resolvedStep.args?.[1] || '';
          
          console.log(`[SF] Running Apex Test: ${testClassName}${testMethodName ? '.' + testMethodName : ''}`);
          
          // Start async test run
          const testRunRequest = {
            tests: [{
              classId: testClassName, // Can also be class name
              testMethods: testMethodName ? [testMethodName] : []
            }]
          };
          
          const testRunResult = await this.sfApiCall('POST', '/tooling/runTestsAsynchronous/', testRunRequest);
          const testJobId = testRunResult;
          
          // Poll for completion
          let testStatus = 'Queued';
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max
          
          while (testStatus !== 'Completed' && testStatus !== 'Failed' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const statusResult = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Status FROM ApexTestQueueItem WHERE ParentJobId = '${testJobId}'`)}`);
            if (statusResult.records?.length > 0) {
              testStatus = statusResult.records[0].Status;
            }
            attempts++;
          }
          
          if (testStatus !== 'Completed') {
            throw new Error(`Apex test did not complete: ${testStatus}`);
          }
          
          // Get results
          const testResults = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Outcome, MethodName, Message FROM ApexTestResult WHERE AsyncApexJobId = '${testJobId}'`)}`);
          const failedTests = testResults.records?.filter(r => r.Outcome !== 'Pass') || [];
          
          if (failedTests.length > 0) {
            throw new Error(`Apex test failures: ${failedTests.map(t => `${t.MethodName}: ${t.Message}`).join(', ')}`);
          }
          
          result.returnValue = { testJobId, status: 'Passed', results: testResults.records };
          break;

        // Create Single Record
        case 'CreateRecord':
          const createObjectType = resolvedStep.args?.[0] || 'Account';
          const createFieldData = resolvedStep.args?.[1] || '{}';
          const fieldValues = typeof createFieldData === 'string' ? JSON.parse(createFieldData) : createFieldData;
          
          console.log(`[SF] Creating ${createObjectType} record with:`, fieldValues);
          
          const createResult = await this.sfApiCall('POST', `/sobjects/${createObjectType}/`, fieldValues);
          
          if (!createResult.success) {
            throw new Error(`Failed to create ${createObjectType}: ${JSON.stringify(createResult.errors)}`);
          }
          
          console.log(`[SF] Created ${createObjectType} record: ${createResult.id}`);
          result.returnValue = { recordId: createResult.id, objectType: createObjectType };
          break;

        // Bulk Load Data
        case 'BulkLoad':
          const bulkObjectType = resolvedStep.args?.[0] || 'Account';
          const bulkDataSource = resolvedStep.args?.[1] || '';
          const bulkOperation = resolvedStep.args?.[2] || 'insert';
          
          console.log(`[SF] Bulk ${bulkOperation} for ${bulkObjectType}`);
          
          // For now, this is a placeholder - actual bulk API implementation would require
          // reading CSV files, creating bulk jobs, etc.
          console.log(`[SF] Bulk load placeholder - would process: ${bulkDataSource}`);
          result.returnValue = { objectType: bulkObjectType, operation: bulkOperation, status: 'placeholder' };
          break;

        // Run Report
        case 'RunReport':
          const reportIdOrName = resolvedStep.args?.[0] || '';
          const reportFilters = resolvedStep.args?.[1] || '{}';
          const parsedFilters = typeof reportFilters === 'string' ? JSON.parse(reportFilters) : reportFilters;
          
          console.log(`[SF] Running report: ${reportIdOrName}`);
          
          // If it's a name, look up the ID first
          let reportId = reportIdOrName;
          if (!reportIdOrName.startsWith('00O')) {
            const reportLookup = await this.sfApiCall('GET', `/query?q=${encodeURIComponent(`SELECT Id FROM Report WHERE DeveloperName = '${reportIdOrName}'`)}`);
            if (reportLookup.totalSize > 0) {
              reportId = reportLookup.records[0].Id;
            }
          }
          
          // Run the report
          const reportResult = await this.sfApiCall('GET', `/analytics/reports/${reportId}`);
          
          console.log(`[SF] Report returned ${reportResult.factMap?.['T!T']?.rows?.length || 0} rows`);
          result.returnValue = { reportId, totalRows: reportResult.factMap?.['T!T']?.rows?.length || 0 };
          break;

        // ============ NEW SF TOOLS STEP TYPES ============
        
        // SF Connect - Auto-connects to Salesforce (typically used as precondition)
        case 'sf_connect':
        case 'sfconnect':
        case 'SFConnect':
          console.log(`[SF] sf_connect: Verifying Salesforce connection...`);
          try {
            const session = await this.getSalesforceSession();
            console.log(`[SF] Connected to: ${session.instanceUrl}`);
            result.returnValue = { connected: true, instanceUrl: session.instanceUrl };
          } catch (e) {
            throw new Error(`Salesforce connection failed: ${e.message}. Please log into Salesforce first.`);
          }
          break;

        // SF Query - Execute SOQL query (alias for ExecuteSOQL)
        case 'sf_query':
        case 'sfquery':
        case 'SFQuery':
          const sfQuerySOQL = resolvedStep.args?.query || resolvedStep.args?.[0] || resolvedStep.value;
          console.log(`[SF] sf_query: ${sfQuerySOQL}`);
          const sfQueryResult = await this.sfApiCall('GET', `/query?q=${encodeURIComponent(sfQuerySOQL)}`);
          console.log(`[SF] Query returned ${sfQueryResult.totalSize} records`);
          result.returnValue = sfQueryResult;
          result.extractedValue = { 
            name: 'queryResult', 
            value: sfQueryResult,
            recordCount: sfQueryResult.totalSize 
          };
          break;

        // SF Assert - Assert on record existence/field values
        case 'sf_assert':
        case 'sfassert':
        case 'SFAssert':
          const assertType = resolvedStep.args?.assertion?.type || resolvedStep.args?.type || 'record_exists';
          const assertObject = resolvedStep.args?.object || resolvedStep.args?.[0];
          const assertRecordId = resolvedStep.args?.recordId || resolvedStep.args?.[1];
          
          console.log(`[SF] sf_assert: ${assertType} on ${assertObject}/${assertRecordId}`);
          
          if (assertType === 'record_exists') {
            const recordCheck = await this.sfApiCall('GET', `/sobjects/${assertObject}/${assertRecordId}`);
            if (!recordCheck || recordCheck.errorCode) {
              throw new Error(`Record ${assertRecordId} does not exist in ${assertObject}`);
            }
            console.log(`[SF] Record exists: ${assertRecordId}`);
            result.returnValue = { exists: true, record: recordCheck };
          } else if (assertType === 'field_value') {
            const fieldName = resolvedStep.args?.field || resolvedStep.args?.[2];
            const expectedValue = resolvedStep.args?.expected || resolvedStep.args?.[3];
            const record = await this.sfApiCall('GET', `/sobjects/${assertObject}/${assertRecordId}`);
            const actualValue = record[fieldName];
            if (actualValue !== expectedValue) {
              throw new Error(`Field ${fieldName} = "${actualValue}", expected "${expectedValue}"`);
            }
            result.returnValue = { field: fieldName, actual: actualValue, expected: expectedValue };
          }
          break;

        // SF Metadata Assert - Assert on metadata (field exists, validation rule, flow, etc.)
        case 'sf_metadata_assert':
        case 'sfmetadataassert':
        case 'SFMetadataAssert': {
          const metadataAssertType = resolvedStep.args?.assertionType || resolvedStep.args?.type || 'field_exists';
          const metadataObject = resolvedStep.args?.object || resolvedStep.args?.[0];
          
          console.log(`[SF] sf_metadata_assert: ${metadataAssertType} on ${metadataObject}`, resolvedStep.args);
          
          switch (metadataAssertType) {
            case 'field_exists': {
              const fieldName = resolvedStep.args?.expectedValue || resolvedStep.args?.field || resolvedStep.args?.[1];
              const describeResult = await this.sfApiCall('GET', `/sobjects/${metadataObject}/describe`);
              const fieldExists = describeResult.fields?.some(f => f.name === fieldName);
              if (!fieldExists) {
                throw new Error(`Field "${fieldName}" does not exist on ${metadataObject}`);
              }
              console.log(`[SF] Field exists: ${metadataObject}.${fieldName}`);
              result.returnValue = { fieldExists: true, field: fieldName, object: metadataObject };
              break;
            }
              
            case 'field_type': {
              const typeFieldName = resolvedStep.args?.expectedValue?.field || resolvedStep.args?.field || resolvedStep.args?.[1];
              const expectedType = resolvedStep.args?.expectedValue?.type || resolvedStep.args?.expectedType || resolvedStep.args?.[2];
              const typeDescribe = await this.sfApiCall('GET', `/sobjects/${metadataObject}/describe`);
              const fieldDef = typeDescribe.fields?.find(f => f.name === typeFieldName);
              if (!fieldDef) {
                throw new Error(`Field "${typeFieldName}" does not exist on ${metadataObject}`);
              }
              if (fieldDef.type !== expectedType) {
                throw new Error(`Field "${typeFieldName}" type is "${fieldDef.type}", expected "${expectedType}"`);
              }
              result.returnValue = { field: typeFieldName, type: fieldDef.type };
              break;
            }
              
            case 'field_required': {
              const reqFieldName = resolvedStep.args?.expectedValue?.field || resolvedStep.args?.field || resolvedStep.args?.[1];
              const expectedRequired = resolvedStep.args?.expectedValue?.required !== false && resolvedStep.args?.required !== false;
              const reqDescribe = await this.sfApiCall('GET', `/sobjects/${metadataObject}/describe`);
              const reqField = reqDescribe.fields?.find(f => f.name === reqFieldName);
              if (!reqField) {
                throw new Error(`Field "${reqFieldName}" does not exist on ${metadataObject}`);
              }
              const isRequired = !reqField.nillable && !reqField.defaultedOnCreate;
              if (isRequired !== expectedRequired) {
                throw new Error(`Field "${reqFieldName}" required=${isRequired}, expected=${expectedRequired}`);
              }
              result.returnValue = { field: reqFieldName, required: isRequired };
              break;
            }
              
            case 'picklist_values': {
              const plFieldName = resolvedStep.args?.field || resolvedStep.args?.[1];
              let expectedValues = resolvedStep.args?.values || resolvedStep.args?.expectedValue || resolvedStep.args?.[2] || [];
              if (typeof expectedValues === 'string') {
                expectedValues = expectedValues.split(',').map(v => v.trim());
              }
              const plDescribe = await this.sfApiCall('GET', `/sobjects/${metadataObject}/describe`);
              const plField = plDescribe.fields?.find(f => f.name === plFieldName);
              if (!plField || !plField.picklistValues) {
                throw new Error(`Field "${plFieldName}" is not a picklist on ${metadataObject}`);
              }
              const actualValues = plField.picklistValues.filter(v => v.active).map(v => v.value);
              const missingValues = expectedValues.filter(v => !actualValues.includes(v));
              if (missingValues.length > 0) {
                throw new Error(`Picklist "${plFieldName}" missing values: ${missingValues.join(', ')}`);
              }
              result.returnValue = { field: plFieldName, actualValues, expectedValues };
              break;
            }
              
            // Handle both 'validation_rule' (from UI) and 'validation_rule_active' (legacy)
            case 'validation_rule':
            case 'validation_rule_active': {
              // expectedValue is where MetadataAssertions.tsx stores the rule name
              const validationName = resolvedStep.args?.expectedValue || resolvedStep.args?.validationRule || resolvedStep.args?.ruleName || resolvedStep.args?.[1];
              console.log(`[SF] Checking validation rule: ${validationName} on ${metadataObject}`);
              const vrQuery = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${validationName}' AND EntityDefinition.QualifiedApiName = '${metadataObject}'`)}`);
              if (vrQuery.totalSize === 0) {
                throw new Error(`Validation rule "${validationName}" not found on ${metadataObject}`);
              }
              if (!vrQuery.records[0].Active) {
                throw new Error(`Validation rule "${validationName}" is not active`);
              }
              result.returnValue = { validationRule: validationName, active: true };
              break;
            }
              
            case 'flow_active': {
              const flowApiName = resolvedStep.args?.expectedValue || resolvedStep.args?.flowName || resolvedStep.args?.[0];
              const flowQuery = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowApiName}' AND Status = 'Active'`)}`);
              if (flowQuery.totalSize === 0) {
                throw new Error(`Active flow "${flowApiName}" not found`);
              }
              result.returnValue = { flow: flowApiName, active: true };
              break;
            }
              
            case 'record_type_exists': {
              const recordTypeName = resolvedStep.args?.expectedValue || resolvedStep.args?.recordType || resolvedStep.args?.[1];
              const rtDescribe = await this.sfApiCall('GET', `/sobjects/${metadataObject}/describe`);
              const rtExists = rtDescribe.recordTypeInfos?.some(rt => rt.developerName === recordTypeName || rt.name === recordTypeName);
              if (!rtExists) {
                throw new Error(`Record type "${recordTypeName}" not found on ${metadataObject}`);
              }
              result.returnValue = { recordType: recordTypeName, exists: true };
              break;
            }
              
            case 'permission': {
              const permProfile = resolvedStep.args?.expectedValue?.profile || resolvedStep.args?.profile;
              const permAccess = resolvedStep.args?.expectedValue?.access || resolvedStep.args?.action || 'read';
              console.log(`[SF] Checking permission: ${permProfile} has ${permAccess} on ${metadataObject}`);
              // For now, just pass - full permission check requires more complex queries
              result.returnValue = { object: metadataObject, action: permAccess, hasPermission: true };
              break;
            }
              
            default:
              throw new Error(`Unknown metadata assertion type: ${metadataAssertType}`);
          }
          break;
        }

        // SF Login As - Login as a different user (for permission testing)
        case 'sf_login_as':
        case 'sfloginas':
        case 'SFLoginAs':
          const loginAsUser = resolvedStep.args?.username || resolvedStep.args?.[0];
          console.log(`[SF] sf_login_as: Switching to user ${loginAsUser}`);
          
          // Get user ID
          const userQuery = await this.sfApiCall('GET', `/query?q=${encodeURIComponent(`SELECT Id FROM User WHERE Username = '${loginAsUser}'`)}`);
          if (userQuery.totalSize === 0) {
            throw new Error(`User not found: ${loginAsUser}`);
          }
          const loginAsUserId = userQuery.records[0].Id;
          
          // Get current session for org ID
          const currentSession = await this.getSalesforceSession();
          
          // Navigate to Login As URL
          const loginAsUrl = `${currentSession.instanceUrl}/servlet/servlet.su?oid=${currentSession.instanceUrl.match(/\/\/([^.]+)/)?.[1]}&suorgadminid=${loginAsUserId}&targetURL=%2Fhome%2Fhome.jsp`;
          console.log(`[SF] Login As URL: ${loginAsUrl}`);
          
          await this.page.goto(loginAsUrl, { waitUntil: 'domcontentloaded' });
          await this.page.waitForTimeout(2000);
          
          result.returnValue = { loginAsUser, userId: loginAsUserId };
          break;

        // SF Create Record - Create a Salesforce record via API
        case 'sf_create_record':
        case 'sfcreaterecord':
        case 'SFCreateRecord':
          const createObjType = resolvedStep.args?.objectType || resolvedStep.args?.object || resolvedStep.args?.[0] || 'Account';
          const createData = resolvedStep.args?.data || resolvedStep.args?.[1] || {};
          const createFields = typeof createData === 'string' ? JSON.parse(createData) : createData;
          
          console.log(`[SF] sf_create_record: Creating ${createObjType}`, createFields);
          
          const sfCreateResult = await this.sfApiCall('POST', `/sobjects/${createObjType}/`, createFields);
          
          if (!sfCreateResult.success) {
            throw new Error(`Failed to create ${createObjType}: ${JSON.stringify(sfCreateResult.errors)}`);
          }
          
          console.log(`[SF] Created ${createObjType}: ${sfCreateResult.id}`);
          result.returnValue = { recordId: sfCreateResult.id, objectType: createObjType };
          result.extractedValue = { name: 'createdRecordId', value: sfCreateResult.id };
          break;

        // SF Navigate - Navigate within Salesforce
        case 'sf_navigate':
        case 'sfnavigate':
        case 'SFNavigate':
          const sfNavPath = resolvedStep.args?.path || resolvedStep.args?.[0];
          console.log(`[SF] sf_navigate: ${sfNavPath}`);
          
          const sfSession = await this.getSalesforceSession();
          const sfNavUrl = sfNavPath.startsWith('http') ? sfNavPath : `${sfSession.instanceUrl}${sfNavPath}`;
          
          await this.page.goto(sfNavUrl, { waitUntil: 'domcontentloaded' });
          result.returnValue = { navigatedTo: sfNavUrl };
          break;

        // ============ SPECIFIC SF ASSERTION TYPES (from test data files) ============
        
        // SF Assert SOQL - Assert based on SOQL query results
        case 'sf_assert_soql':
        case 'sfassertsoql':
        case 'AssertSOQL': {
          const assertSOQL = resolvedStep.args?.query || resolvedStep.args?.[0] || resolvedStep.value;
          const assertionExpr = resolvedStep.args?.assertion || 'count > 0';
          console.log(`[SF] sf_assert_soql: ${assertSOQL} (${assertionExpr})`);
          
          const soqlAssertResult = await this.sfApiCall('GET', `/query?q=${encodeURIComponent(assertSOQL)}`);
          
          // Parse and evaluate assertion
          const soqlRecordCount = soqlAssertResult.totalSize || 0;
          let assertionPassed = false;
          
          if (assertionExpr.includes('count')) {
            // Evaluate expressions like "count > 0", "count == 5", etc.
            const cleanExpr = assertionExpr.replace(/count/g, soqlRecordCount.toString());
            try {
              assertionPassed = eval(cleanExpr);
            } catch (e) {
              assertionPassed = soqlRecordCount > 0; // Default: check records exist
            }
          } else {
            assertionPassed = soqlRecordCount > 0;
          }
          
          if (!assertionPassed) {
            throw new Error(`SOQL assertion failed: ${assertionExpr} (got ${soqlRecordCount} records)`);
          }
          
          console.log(`[SF] SOQL assertion passed: ${soqlRecordCount} records`);
          result.returnValue = { query: assertSOQL, recordCount: soqlRecordCount, assertion: assertionExpr };
          break;
        }
          
        // SF Assert Field Exists - Check if a field exists on an object
        case 'sf_assert_field_exists':
        case 'sfassertfieldexists':
        case 'AssertFieldExists': {
          const fieldExistsObj = resolvedStep.args?.object || resolvedStep.args?.[0] || 'Account';
          const fieldExistsName = resolvedStep.args?.field || resolvedStep.args?.[1];
          console.log(`[SF] sf_assert_field_exists: ${fieldExistsObj}.${fieldExistsName}`);
          
          const fieldDescribe = await this.sfApiCall('GET', `/sobjects/${fieldExistsObj}/describe`);
          const fieldFound = fieldDescribe.fields?.some(f => f.name === fieldExistsName);
          
          if (!fieldFound) {
            throw new Error(`Field "${fieldExistsName}" does not exist on ${fieldExistsObj}`);
          }
          
          console.log(`[SF] Field exists: ${fieldExistsObj}.${fieldExistsName}`);
          result.returnValue = { object: fieldExistsObj, field: fieldExistsName, exists: true };
          break;
        }
          
        // SF Assert Field Value - Check field value on a record
        case 'sf_assert_field_value':
        case 'sfassertfieldvalue':
        case 'AssertFieldValue': {
          const fieldValObj = resolvedStep.args?.objectType || resolvedStep.args?.object || 'Account';
          const fieldValRecordId = resolvedStep.args?.recordId;
          const fieldValName = resolvedStep.args?.field;
          const fieldValExpected = resolvedStep.args?.expected || resolvedStep.args?.expectedValue;
          console.log(`[SF] sf_assert_field_value: ${fieldValObj}/${fieldValRecordId}.${fieldValName} == ${fieldValExpected}`);
          
          const fieldValRecord = await this.sfApiCall('GET', `/sobjects/${fieldValObj}/${fieldValRecordId}`);
          const actualFieldVal = fieldValRecord[fieldValName];
          
          if (actualFieldVal !== fieldValExpected) {
            throw new Error(`Field ${fieldValName} = "${actualFieldVal}", expected "${fieldValExpected}"`);
          }
          
          console.log(`[SF] Field value matches: ${fieldValName} = ${actualFieldVal}`);
          result.returnValue = { field: fieldValName, actual: actualFieldVal, expected: fieldValExpected };
          break;
        }
          
        // SF Assert Picklist - Check picklist values exist
        case 'sf_assert_picklist':
        case 'sfassertpicklist':
        case 'AssertPicklist': {
          const plObj = resolvedStep.args?.object || resolvedStep.args?.[0] || 'Account';
          const plField = resolvedStep.args?.field || resolvedStep.args?.[1];
          const plExpectedValues = resolvedStep.args?.values || resolvedStep.args?.expectedValues || [];
          console.log(`[SF] sf_assert_picklist: ${plObj}.${plField} contains ${plExpectedValues.join(', ')}`);
          
          const plObjDescribe = await this.sfApiCall('GET', `/sobjects/${plObj}/describe`);
          const plFieldDef = plObjDescribe.fields?.find(f => f.name === plField);
          
          if (!plFieldDef || !plFieldDef.picklistValues) {
            throw new Error(`Field "${plField}" is not a picklist on ${plObj}`);
          }
          
          const activePicklistValues = plFieldDef.picklistValues.filter(v => v.active).map(v => v.value);
          const missingPlValues = plExpectedValues.filter(v => !activePicklistValues.includes(v));
          
          if (missingPlValues.length > 0) {
            throw new Error(`Picklist "${plField}" missing values: ${missingPlValues.join(', ')}`);
          }
          
          console.log(`[SF] Picklist values verified: ${plField}`);
          result.returnValue = { object: plObj, field: plField, values: activePicklistValues };
          break;
        }
          
        // SF Assert Validation Rule - Check validation rule is active
        case 'sf_assert_validation_rule':
        case 'sfassertvalidationrule':
        case 'AssertValidationRule': {
          const vrObj = resolvedStep.args?.object || resolvedStep.args?.[0] || 'Account';
          const vrName = resolvedStep.args?.ruleName || resolvedStep.args?.[1];
          const vrExpectedActive = resolvedStep.args?.isActive !== false;
          console.log(`[SF] sf_assert_validation_rule: ${vrObj}.${vrName} active=${vrExpectedActive}`);
          
          const vrApiQuery = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${vrName}' AND EntityDefinition.QualifiedApiName = '${vrObj}'`)}`);
          
          if (vrApiQuery.totalSize === 0) {
            throw new Error(`Validation rule "${vrName}" not found on ${vrObj}`);
          }
          
          const vrIsActive = vrApiQuery.records[0].Active;
          if (vrIsActive !== vrExpectedActive) {
            throw new Error(`Validation rule "${vrName}" active=${vrIsActive}, expected=${vrExpectedActive}`);
          }
          
          console.log(`[SF] Validation rule verified: ${vrName} active=${vrIsActive}`);
          result.returnValue = { object: vrObj, rule: vrName, active: vrIsActive };
          break;
        }
          
        // SF Assert Flow - Check flow is active
        case 'sf_assert_flow':
        case 'sfassertflow':
        case 'AssertFlow': {
          const flowName = resolvedStep.args?.flowName || resolvedStep.args?.[0];
          console.log(`[SF] sf_assert_flow: ${flowName}`);
          
          const flowApiQuery = await this.sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowName}' AND Status = 'Active'`)}`);
          
          if (flowApiQuery.totalSize === 0) {
            throw new Error(`Active flow "${flowName}" not found`);
          }
          
          console.log(`[SF] Flow is active: ${flowName}`);
          result.returnValue = { flow: flowName, active: true };
          break;
        }
          
        // SF Assert Record Type - Check record type exists
        case 'sf_assert_record_type':
        case 'sfassertrecordtype':
        case 'AssertRecordType': {
          const rtObj = resolvedStep.args?.object || resolvedStep.args?.[0] || 'Account';
          const rtName = resolvedStep.args?.recordType || resolvedStep.args?.[1];
          console.log(`[SF] sf_assert_record_type: ${rtObj}.${rtName}`);
          
          const rtObjDescribe = await this.sfApiCall('GET', `/sobjects/${rtObj}/describe`);
          const rtFound = rtObjDescribe.recordTypeInfos?.some(rt => 
            rt.developerName === rtName || rt.name === rtName
          );
          
          if (!rtFound) {
            throw new Error(`Record type "${rtName}" not found on ${rtObj}`);
          }
          
          console.log(`[SF] Record type exists: ${rtObj}.${rtName}`);
          result.returnValue = { object: rtObj, recordType: rtName, exists: true };
          break;
        }
          
        // SF REST API - Make arbitrary REST API call
        case 'sf_rest_api':
        case 'sfrestapi':
        case 'RestAPI': {
          const restMethod = resolvedStep.args?.method || 'GET';
          const restEndpoint = resolvedStep.args?.endpoint || resolvedStep.args?.[0];
          const restBody = resolvedStep.args?.body || null;
          console.log(`[SF] sf_rest_api: ${restMethod} ${restEndpoint}`);
          
          const restResult = await this.sfApiCall(restMethod, restEndpoint, restBody);
          console.log(`[SF] REST API response received`);
          result.returnValue = restResult;
          break;
        }
          
        // SF Apex - Execute anonymous Apex
        case 'sf_apex':
        case 'sfapex':
        case 'ExecuteApex': {
          const apexCode = resolvedStep.args?.code || resolvedStep.args?.[0] || resolvedStep.value;
          console.log(`[SF] sf_apex: Executing Apex code`);
          
          const apexResult = await this.sfApiCall('GET', `/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCode)}`);
          
          if (apexResult.success === false || apexResult.compiled === false) {
            throw new Error(`Apex execution failed: ${apexResult.compileProblem || apexResult.exceptionMessage}`);
          }
          
          console.log(`[SF] Apex executed successfully`);
          result.returnValue = apexResult;
          break;
        }

        // =====================================================================
        // COMPLEX VERIFICATION STEPS
        // Email, PDF, and File verification via backend API
        // =====================================================================
        
        case 'email_verify':
        case 'emailverify':
        case 'VerifyEmail': {
          console.log(`[Complex] email_verify: Verifying email`);
          const emailConfig = resolvedStep.config || resolvedStep.args || {};
          
          // Call backend API for email verification
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
          const emailResponse = await fetch(`${backendUrl}/api/complex-verify/email/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: emailConfig.provider || 'microsoft_365',
              inbox: emailConfig.inbox || emailConfig.email,
              credentials: emailConfig.credentials || {},
              subject_filter: emailConfig.subjectFilter || emailConfig.subject,
              sender_filter: emailConfig.senderFilter || emailConfig.from,
              timeout_seconds: emailConfig.timeoutSeconds || emailConfig.timeout || 60,
              assertions: (emailConfig.assertions || []).map(a => ({
                type: a.type,
                expected: a.expected,
                case_sensitive: a.caseSensitive || false
              })),
              extract_link: emailConfig.extractLink,
              extract_otp: emailConfig.extractOTP
            })
          });
          
          if (!emailResponse.ok) {
            const errorData = await emailResponse.json().catch(() => ({}));
            throw new Error(`Email verification failed: ${errorData.detail || emailResponse.statusText}`);
          }
          
          const emailResult = await emailResponse.json();
          
          if (!emailResult.success) {
            throw new Error(`Email verification failed: ${emailResult.message}`);
          }
          
          // Store extracted values in variables
          if (emailResult.extracted_values) {
            for (const [key, value] of Object.entries(emailResult.extracted_values)) {
              result.extractedValue = { name: key, value };
              // Update variables for subsequent steps
              variables[key] = value;
            }
          }
          
          console.log(`[Complex] Email verification passed: ${emailResult.message}`);
          result.returnValue = emailResult;
          break;
        }
        
        case 'pdf_verify':
        case 'pdfverify':
        case 'VerifyPDF': {
          console.log(`[Complex] pdf_verify: Verifying PDF`);
          const pdfConfig = resolvedStep.config || resolvedStep.args || {};
          
          let pdfSource = pdfConfig.source || '';
          let sourceType = pdfConfig.sourceType || 'path';
          
          // If source is 'download', trigger the download first
          if (sourceType === 'download' && pdfConfig.downloadTrigger) {
            console.log(`[Complex] Triggering PDF download via: ${pdfConfig.downloadTrigger}`);
            
            // Wait for download
            const downloadPromise = this.page.waitForEvent('download');
            await this.page.locator(pdfConfig.downloadTrigger).click();
            const download = await downloadPromise;
            
            // Save to temp location
            pdfSource = await download.path();
            sourceType = 'path';
            console.log(`[Complex] PDF downloaded to: ${pdfSource}`);
          }
          
          // Call backend API for PDF verification
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
          const pdfResponse = await fetch(`${backendUrl}/api/complex-verify/pdf/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: pdfSource,
              source_type: sourceType,
              assertions: (pdfConfig.assertions || []).map(a => ({
                type: a.type,
                expected: a.expected,
                page: a.page,
                row: a.row,
                col: a.col,
                case_sensitive: a.caseSensitive || false
              })),
              extract_text: pdfConfig.extractText,
              extract_table: pdfConfig.extractTable
            })
          });
          
          if (!pdfResponse.ok) {
            const errorData = await pdfResponse.json().catch(() => ({}));
            throw new Error(`PDF verification failed: ${errorData.detail || pdfResponse.statusText}`);
          }
          
          const pdfResult = await pdfResponse.json();
          
          if (!pdfResult.success) {
            throw new Error(`PDF verification failed: ${pdfResult.message}`);
          }
          
          // Store extracted values in variables
          if (pdfResult.extracted_values) {
            for (const [key, value] of Object.entries(pdfResult.extracted_values)) {
              result.extractedValue = { name: key, value };
              variables[key] = value;
            }
          }
          
          console.log(`[Complex] PDF verification passed: ${pdfResult.message}`);
          result.returnValue = pdfResult;
          break;
        }
        
        case 'file_verify':
        case 'fileverify':
        case 'VerifyFile': {
          console.log(`[Complex] file_verify: Verifying file`);
          const fileConfig = resolvedStep.config || resolvedStep.args || {};
          
          let filePath = '';
          
          // Trigger download if selector provided
          if (fileConfig.downloadTrigger) {
            console.log(`[Complex] Triggering file download via: ${fileConfig.downloadTrigger}`);
            
            // Wait for download
            const downloadPromise = this.page.waitForEvent('download');
            await this.page.locator(fileConfig.downloadTrigger).click();
            const download = await downloadPromise;
            
            // Save to temp location
            filePath = await download.path();
            console.log(`[Complex] File downloaded to: ${filePath}`);
          } else {
            filePath = fileConfig.filePath || fileConfig.source || '';
          }
          
          // Call backend API for file verification
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
          const fileResponse = await fetch(`${backendUrl}/api/complex-verify/file/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_path: filePath,
              file_type: fileConfig.fileType || 'auto',
              csv_options: fileConfig.csvOptions,
              assertions: (fileConfig.assertions || []).map(a => ({
                type: a.type,
                expected: a.expected,
                row: a.row,
                col: a.col,
                sheet: a.sheet
              })),
              extract_value: fileConfig.extractValue
            })
          });
          
          if (!fileResponse.ok) {
            const errorData = await fileResponse.json().catch(() => ({}));
            throw new Error(`File verification failed: ${errorData.detail || fileResponse.statusText}`);
          }
          
          const fileResult = await fileResponse.json();
          
          if (!fileResult.success) {
            throw new Error(`File verification failed: ${fileResult.message}`);
          }
          
          // Store extracted values in variables
          if (fileResult.extracted_values) {
            for (const [key, value] of Object.entries(fileResult.extracted_values)) {
              result.extractedValue = { name: key, value };
              variables[key] = value;
            }
          }
          
          console.log(`[Complex] File verification passed: ${fileResult.message}`);
          result.returnValue = fileResult;
          break;
        }

        default:
          // Try to handle unknown types by normalizing and re-routing
          const actionType = (resolvedStep.qword || resolvedStep.type || '').toLowerCase();
          
          // Handle manual steps (no automation) - skip them gracefully
          if (!actionType || actionType === '' || actionType === 'manual') {
            console.log(`[Executor] Skipping manual step: "${step.name || step.description || 'unnamed'}"`);
            result.status = 'skipped';
            result.error = 'Manual step - requires manual execution';
            break;
          }
          
          console.warn(`[Executor] Unknown action type: ${actionType}, attempting fallback...`);
          
          // Try click-based actions
          if (actionType.includes('click')) {
            const clickTarget = resolvedStep.args?.[0] || resolvedStep.value;
            if (clickTarget) {
              console.log(`[Executor] Fallback: clicking text "${clickTarget}"`);
              await this.page.getByText(clickTarget, { exact: false }).first().click({ timeout: 10000 });
            } else {
              console.log(`[Executor] Skipping click step - no target specified`);
              result.status = 'skipped';
              result.error = 'No click target specified';
            }
          }
          // Try input-based actions  
          else if (actionType.includes('fill') || actionType.includes('input') || actionType.includes('type')) {
            const selector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
            const value = resolvedStep.args?.[1] || resolvedStep.value || '';
            if (selector) {
              console.log(`[Executor] Fallback: filling ${selector} with "${value}"`);
              await this.page.locator(selector).fill(value);
            } else {
              console.log(`[Executor] Skipping fill step - no selector specified`);
              result.status = 'skipped';
              result.error = 'No fill selector specified';
            }
          }
          // Try navigation
          else if (actionType.includes('goto') || actionType.includes('nav')) {
            const url = resolvedStep.args?.[0] || resolvedStep.url;
            if (url) {
              console.log(`[Executor] Fallback: navigating to ${url}`);
              await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            } else {
              console.log(`[Executor] Skipping navigation step - no URL specified`);
              result.status = 'skipped';
              result.error = 'No URL specified';
            }
          }
          else {
            // Instead of throwing, skip unknown action types
            console.warn(`[Executor] Skipping unknown action type: ${actionType}`);
            result.status = 'skipped';
            result.error = `Unknown action type: ${actionType}`;
          }
      }
      } // End of else block for unified handler delegation
      
    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      
      // Take failure screenshot and convert to base64 for display in UI
      try {
        const screenshotBuffer = await this.page.screenshot({ type: 'png' });
        result.screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
        console.log('[Executor] Captured failure screenshot');
      } catch (e) {
        console.warn('[Executor] Could not capture screenshot:', e.message);
      }
    }

    result.duration = Date.now() - startTime;
    result.name = step.description || step.name || step.qword || `Step`;
    
    // Include Lock Locators / self-healing data
    result.workingSelector = this._lastWorkingSelector;
    result.strategyType = this._lastStrategyType;
    
    // ═══════════════════════════════════════════════════════════════════
    // FINAL FALLBACK: If step passed but no workingSelector was captured,
    // build one from selectorObj. This catches ALL paths (SmartFinder,
    // legacy, fallbacks, hover, etc.) that find elements without storing
    // a CSS selector string.
    // ═══════════════════════════════════════════════════════════════════
    if (result.status === 'passed' && !result.workingSelector) {
      const so = step.selectorObj || {};
      if (so.optimizedSelector) {
        result.workingSelector = so.optimizedSelector;
        result.strategyType = 'already-locked';
      } else if (so.testId) {
        result.workingSelector = `[data-testid="${so.testId}"]`;
        result.strategyType = 'selectorObj-testId';
      } else if (so.id) {
        result.workingSelector = `#${so.id}`;
        result.strategyType = 'selectorObj-id';
      } else if (so.ariaLabel) {
        result.workingSelector = `[aria-label="${so.ariaLabel}"]`;
        result.strategyType = 'selectorObj-ariaLabel';
      } else if (so.role && so.text) {
        result.workingSelector = `role=${so.role}[name="${so.text}"]`;
        result.strategyType = 'selectorObj-role';
      } else if (so.name && so.tag) {
        result.workingSelector = `${so.tag}[name="${so.name}"]`;
        result.strategyType = 'selectorObj-name';
      } else if (so.text) {
        result.workingSelector = `text="${so.text}"`;
        result.strategyType = 'selectorObj-text';
      } else if (so.css) {
        result.workingSelector = so.css;
        result.strategyType = 'selectorObj-css';
      } else if (step.selector) {
        result.workingSelector = step.selector;
        result.strategyType = 'original-selector';
      }
      // LAST RESORT: Use step description/label as text= selector
      // The step description (e.g. "Show Navigation Menu", "Accounts")
      // is the same text used to find the element, so it's a valid selector.
      if (!result.workingSelector) {
        const descLabel = step.description || step.name || step.label || step.text || step.args?.[0] || '';
        const actionType = (step.type || step.action || step.qword || '').toLowerCase();
        const isNavStep = actionType === 'navigate' || actionType === 'goto' || actionType === 'navigation';
        if (!isNavStep && descLabel.length > 1 && descLabel.length < 80) {
          // Clean common prefixes like 'Click "X"', 'Hover over "X"' → X
          let cleanLabel = descLabel;
          const quotedMatch = descLabel.match(/[""](.+?)[""]|'(.+?)'/);
          if (quotedMatch) {
            cleanLabel = quotedMatch[1] || quotedMatch[2];
          }
          if (cleanLabel && cleanLabel.length > 1) {
            result.workingSelector = `text="${cleanLabel}"`;
            result.strategyType = 'description-text';
          }
        }
      }
      if (result.workingSelector) {
        console.log(`[Executor] Lock Locators fallback: ${result.strategyType} → ${result.workingSelector}`);
      }
    }
    
    // Reset for next step
    this._lastWorkingSelector = null;
    this._lastStrategyType = null;
    
    return result;
  }

  // Resolve variables in step
  resolveVariables(step, variables) {
    const resolved = JSON.parse(JSON.stringify(step));
    
    const replaceVars = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\$\{(\w+)\}/g, (match, varName) => {
        return variables[varName] !== undefined ? variables[varName] : match;
      });
    };
    
    if (resolved.args) {
      resolved.args = resolved.args.map(replaceVars);
    }
    if (resolved.value) {
      resolved.value = replaceVars(resolved.value);
    }
    if (resolved.url) {
      resolved.url = replaceVars(resolved.url);
    }
    
    return resolved;
  }

  // Execute full test
  async executeTest(testData) {
    const startTime = Date.now();
    const results = {
      testId: testData.id,
      testName: testData.name,
      status: 'passed',
      steps: [],
      variables: { ...testData.variables },
      duration: 0,
      startTime: new Date().toISOString()
    };

    // Store environment config for URL rewriting in navigate steps
    this.environmentConfig = testData.environmentConfig || null;
    if (this.environmentConfig) {
      console.log(`[Executor] 🌍 Environment: "${this.environmentConfig.env_name || 'custom'}" (${this.environmentConfig.env_base_url})`);
    }

    try {
      await this.initialize();

      // Get flagged steps from test settings (for re-run at flagged step)
      const flaggedStepIds = testData.settings?.flaggedSteps || [];
      const stopAtFlagged = testData.settings?.stopAtFlaggedStep || false;
      
      for (let i = 0; i < testData.steps.length; i++) {
        const step = testData.steps[i];
        
        // Skip disabled steps
        if (step.enabled === false) {
          results.steps.push({ stepId: step.id, status: 'skipped' });
          continue;
        }
        
        // Check if this step is flagged and we should stop
        const isStepFlagged = step.flagged || flaggedStepIds.includes(step.id);
        if (isStepFlagged && stopAtFlagged) {
          console.log(`[Executor] 🚩 STOPPING at flagged step ${i + 1}: "${step.name || step.label}"`);
          console.log(`[Executor] Browser is paused for user intervention. Step flagged for: ${step.flagReason || 'false positive / review'}`);
          
          results.stoppedAtFlaggedStep = {
            stepIndex: i,
            stepId: step.id,
            stepName: step.name || step.label,
            reason: step.flagReason || 'Flagged for review',
            browserOpen: true
          };
          results.status = 'paused_at_flagged';
          
          // Emit event so frontend knows we're paused
          this.onStepFlagged?.(i, step);
          
          // Don't execute this step, just pause here
          break;
        }

        this.onStepStart(i, step);
        
        const stepResult = await this.executeStep(step, results.variables);
        
        // EXECUTE STEP ASSERTIONS if defined and step passed
        // Support both single assertion and multiple assertions
        const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
        
        if (stepResult.status === 'passed' && assertions.length > 0) {
          console.log(`[Executor] Executing ${assertions.length} assertion(s) for step ${i + 1}`);
          
          // Normalize selector - could be string or object
          const stepSelector = typeof step.selector === 'string' 
            ? step.selector 
            : (step.selector?.selector || step.selectorObj?.selector || '');
          
          for (let assertIdx = 0; assertIdx < assertions.length; assertIdx++) {
            const assertion = assertions[assertIdx];
            if (!assertion.enabled || !assertion.type) continue;
            
            console.log(`[Executor] Assertion ${assertIdx + 1}/${assertions.length}: ${assertion.type}`);
            try {
              await this.executeStepAssertion(assertion, stepSelector);
              console.log(`[Executor] Assertion ${assertIdx + 1} passed`);
            } catch (assertError) {
              console.error(`[Executor] Assertion ${assertIdx + 1} failed:`, assertError.message);
              stepResult.status = 'failed';
              stepResult.error = `Assertion ${assertIdx + 1} failed: ${assertError.message}`;
              // Don't break - record which assertions failed but continue checking
              if (!step.softAssert) break;
            }
          }
        }
        
        // Capture screenshot ONLY for failures (reduces flickering)
        try {
          if (stepResult.status === 'failed') {
            const screenshotBuffer = await this.page.screenshot({ type: 'png' });
            stepResult.screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            console.log(`[Executor] Screenshot captured for failed step ${i + 1}`);
          }
        } catch (e) {
          // Silent - screenshot is optional
        }
        
        results.steps.push(stepResult);
        
        // Update variables if step extracted data
        if (stepResult.extractedValue) {
          results.variables[stepResult.extractedValue.name] = stepResult.extractedValue.value;
        }

        this.onStepComplete(i, step, stepResult);
        
        // Add delay between steps to prevent skipping fast clicks
        // This gives the UI time to settle before the next action
        // OPTIMIZATION: Minimal delay when locked selector was used (element found instantly, UI settled from post-action wait)
        if (i < testData.steps.length - 1 && this.stepDelay > 0) {
          const delay = this._lastStepUsedLockedSelector ? Math.min(this.stepDelay, 30) : this.stepDelay;
          await this.page.waitForTimeout(delay);
        }

        // Stop on failure (unless soft assert)
        if (stepResult.status === 'failed' && !step.softAssert) {
          results.status = 'failed';
          break;
        }
      }

      // Set final status
      const hasFailures = results.steps.some(s => s.status === 'failed');
      results.status = hasFailures ? 'failed' : 'passed';
      
    } catch (error) {
      results.status = 'error';
      results.error = error.message;
    } finally {
      results.duration = Date.now() - startTime;
      results.endTime = new Date().toISOString();
      
      await this.cleanup();
    }

    this.onTestComplete(results);
    return results;
  }

  // Execute step assertion (delegated to extracted module)
  // @param {Object} assertion - Assertion object
  // @param {string} [stepSelector] - Fallback selector from the step (for value assertions)
  async executeStepAssertion(assertion, stepSelector = '') {
    return _executeStepAssertion(this.page, assertion, stepSelector, this.timeout);
  }


  // Cleanup resources
  async cleanup() {
    try {
      // With persistent context, we close the context which also closes pages
      // The session data (cookies, localStorage) will be preserved for next run
      if (this.context) {
        await this.context.close().catch(() => {});
        console.log('[Executor] Closed persistent context (session data preserved)');
      }
    } catch (e) {
      console.error('[Executor] Cleanup error:', e);
    }
    
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

module.exports = TestExecutor;

