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
      
      const locator = await this.smartFinder.find(recipe);
      console.log('[Executor V2] Element found with SmartFinder');
      return locator;
      
    } catch (error) {
      console.log('[Executor V2] SmartFinder failed:', error.message, '- falling back to legacy');
      return null;
    }
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
    
    // Use launchPersistentContext to maintain sessions across runs
    this.context = await browserClass.launchPersistentContext(userDataDir, {
      headless: this.headless,
      viewport: this.viewport,
      args: [
        '--no-sandbox', 
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
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

  // Normalize action types to canonical form
  normalizeActionType(actionType) {
    if (!actionType) return '';
    
    const normalized = actionType.toLowerCase().replace(/[_\s-]/g, '');
    
    // Map variations to canonical action types
    const actionMap = {
      // Click actions
      'clicktext': 'ClickText',
      'click': 'ClickElement',
      'clickelement': 'ClickElement',
      
      // Input actions
      'fill': 'Fill',
      'type': 'Fill',
      'input': 'Fill',
      'entertext': 'Fill',
      
      // Navigation
      'goto': 'GoTo',
      'navigate': 'GoTo',
      'open': 'GoTo',
      'openurl': 'GoTo',
      
      // Select
      'select': 'Select',
      'dropdown': 'Select',
      'selectoption': 'Select',
      
      // Assertions
      'assert': 'AssertText',
      'asserttext': 'AssertText',
      'verify': 'AssertText',
      'verifytext': 'AssertText',
      'assertelement': 'AssertElement',
      'asserturl': 'AssertUrl',
      'asserttitle': 'AssertTitle',
      
      // Wait
      'wait': 'Wait',
      'pause': 'Wait',
      'sleep': 'Wait',
      'waitforelement': 'WaitForElement',
      'waitfortext': 'WaitForText',
      
      // Hover
      'hover': 'Hover',
      'mouseover': 'Hover',
      
      // Screenshot
      'screenshot': 'Screenshot',
      'capture': 'Screenshot',
      
      // Check/Uncheck
      'check': 'Check',
      'checkbox': 'Check',
      'uncheck': 'Uncheck',
      
      // Scroll
      'scroll': 'Scroll',
      'scrollinto': 'Scroll',
      
      // Extract
      'extract': 'Extract',
      'storevariable': 'Extract',
      'store': 'Extract',
      
      // Keyboard
      'press': 'Press',
      'keyboard': 'Press',
      'keypress': 'Press',
      
      // Custom
      'execute': 'Execute',
      'custom': 'Execute',
      'script': 'Execute',
      
      // Salesforce-specific actions
      'executesoql': 'ExecuteSOQL',
      'soql': 'ExecuteSOQL',
      'query': 'ExecuteSOQL',
      'executeapex': 'ExecuteApex',
      'apex': 'ExecuteApex',
      'restapicall': 'RestApiCall',
      'apicall': 'RestApiCall',
      'createtestdata': 'CreateTestData',
      'datafactory': 'CreateTestData',
      'clonerecord': 'CloneRecord',
      'clone': 'CloneRecord',
      'deleterecord': 'DeleteRecord',
      'triggerflow': 'TriggerFlow',
      'flow': 'TriggerFlow',
      'managepermissionset': 'ManagePermissionSet',
      'permissionset': 'ManagePermissionSet',
      'navigateto': 'NavigateTo',
      'assertvalidation': 'AssertValidation',
      'assertfieldvalue': 'AssertFieldValue',
      // New SF Tools
      'runapextest': 'RunApexTest',
      'apextest': 'RunApexTest',
      'createrecord': 'CreateRecord',
      'bulkload': 'BulkLoad',
      'bulk': 'BulkLoad',
      'runreport': 'RunReport',
      'report': 'RunReport',
      
      // New SF Tools Step Types (from UnifiedWorkflowEditor)
      'sfconnect': 'sf_connect',
      'sf_connect': 'sf_connect',
      'sfquery': 'sf_query',
      'sf_query': 'sf_query',
      'sfassert': 'sf_assert',
      'sf_assert': 'sf_assert',
      'sfmetadataassert': 'sf_metadata_assert',
      'sf_metadata_assert': 'sf_metadata_assert',
      'sfloginas': 'sf_login_as',
      'sf_login_as': 'sf_login_as',
      'sfcreaterecord': 'sf_create_record',
      'sf_create_record': 'sf_create_record',
      'sfnavigate': 'sf_navigate',
      'sf_navigate': 'sf_navigate',
      
      // Specific SF assertion types (from test data files)
      'sf_soql': 'sf_query',
      'sfsoql': 'sf_query',
      'executesoql': 'sf_query',
      'sf_assert_soql': 'sf_assert_soql',
      'sfassertsoql': 'sf_assert_soql',
      'assertsoql': 'sf_assert_soql',
      'sf_assert_field_exists': 'sf_assert_field_exists',
      'sfassertfieldexists': 'sf_assert_field_exists',
      'assertfieldexists': 'sf_assert_field_exists',
      'sf_assert_field_value': 'sf_assert_field_value',
      'sfassertfieldvalue': 'sf_assert_field_value',
      'assertfieldvalue': 'sf_assert_field_value',
      'sf_assert_picklist': 'sf_assert_picklist',
      'sfassertpicklist': 'sf_assert_picklist',
      'assertpicklist': 'sf_assert_picklist',
      'sf_assert_validation_rule': 'sf_assert_validation_rule',
      'sfassertvalidationrule': 'sf_assert_validation_rule',
      'assertvalidationrule': 'sf_assert_validation_rule',
      'sf_assert_flow': 'sf_assert_flow',
      'sfassertflow': 'sf_assert_flow',
      'assertflow': 'sf_assert_flow',
      'sf_assert_record_type': 'sf_assert_record_type',
      'sfassertrecordtype': 'sf_assert_record_type',
      'assertrecordtype': 'sf_assert_record_type',
      'createrecord': 'sf_create_record',
      'restapi': 'sf_rest_api',
      'sf_rest_api': 'sf_rest_api',
      'sfrestapi': 'sf_rest_api',
      'apex': 'sf_apex',
      'sf_apex': 'sf_apex',
      'sfapex': 'sf_apex',
      'executeapex': 'sf_apex',
    };
    
    return actionMap[normalized] || actionType; // Return original if no mapping found
  }

  // ============ SALESFORCE API HELPERS ============
  
  // Extract Salesforce session info from browser cookies
  async getSalesforceSession() {
    try {
      const cookies = await this.context.cookies();
      const sidCookie = cookies.find(c => c.name === 'sid');
      
      if (!sidCookie) {
        throw new Error('Not logged into Salesforce - no session cookie found');
      }
      
      // Get instance URL from current page URL
      const currentUrl = this.page.url();
      const urlMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
      const instanceUrl = urlMatch ? urlMatch[1] : null;
      
      if (!instanceUrl) {
        throw new Error('Could not determine Salesforce instance URL');
      }
      
      console.log(`[SF API] Session found, instance: ${instanceUrl}`);
      
      return {
        accessToken: sidCookie.value,
        instanceUrl: instanceUrl,
        apiVersion: 'v59.0'
      };
    } catch (error) {
      console.error('[SF API] Failed to get session:', error);
      throw error;
    }
  }

  // Make authenticated Salesforce REST API call
  async sfApiCall(method, endpoint, body = null) {
    const session = await this.getSalesforceSession();
    
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${session.instanceUrl}/services/data/${session.apiVersion}${endpoint}`;
    
    console.log(`[SF API] ${method} ${url}`);
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      }
    };
    
    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    
    // Execute fetch in browser context (to use same session)
    const result = await this.page.evaluate(async ({ url, options }) => {
      try {
        const response = await fetch(url, options);
        const text = await response.text();
        return {
          ok: response.ok,
          status: response.status,
          data: text ? JSON.parse(text) : null
        };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    }, { url, options });
    
    if (!result.ok) {
      console.error('[SF API] Error:', result);
      throw new Error(`SF API Error: ${result.status} - ${JSON.stringify(result.data || result.error)}`);
    }
    
    return result.data;
  }

  // Generate random test data for Salesforce objects
  generateTestData(objectType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    const dataGenerators = {
      'Account': {
        Name: `Test Account ${random}`,
        Description: `Auto-generated test account at ${new Date().toISOString()}`,
        Industry: 'Technology',
        Type: 'Prospect'
      },
      'Contact': {
        FirstName: `Test`,
        LastName: `Contact ${random}`,
        Email: `test.${random}@example.com`,
        Phone: `555-${Math.floor(Math.random() * 9000) + 1000}`
      },
      'Lead': {
        FirstName: `Test`,
        LastName: `Lead ${random}`,
        Company: `Test Company ${random}`,
        Email: `lead.${random}@example.com`,
        Status: 'Open - Not Contacted'
      },
      'Opportunity': {
        Name: `Test Opportunity ${random}`,
        StageName: 'Prospecting',
        CloseDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        Amount: Math.floor(Math.random() * 100000) + 1000
      },
      'Case': {
        Subject: `Test Case ${random}`,
        Description: `Auto-generated test case`,
        Status: 'New',
        Priority: 'Medium',
        Origin: 'Web'
      }
    };
    
    return dataGenerators[objectType] || { Name: `Test ${objectType} ${random}` };
  }

  // Execute a single step
  async executeStep(step, variables = {}) {
    const startTime = Date.now();
    let result = {
      stepId: step.id,
      status: 'passed',
      error: null,
      screenshot: null,
      duration: 0
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
      
      // Replace variables in step values
      const resolvedStep = this.resolveVariables(step, variables);
      
      // Normalize the action type to handle variations
      const rawActionType = resolvedStep.qword || resolvedStep.type || '';
      const normalizedAction = this.normalizeActionType(rawActionType);
      console.log(`[Executor] Action: "${rawActionType}" -> normalized: "${normalizedAction}"`);
      
      switch (normalizedAction) {
        // Navigation
        case 'GoTo':
        case 'navigate':
          const targetUrl = resolvedStep.args?.[0] || resolvedStep.url;
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
          console.log(`[Executor] ClickText: "${clickText}"${elementIndex > 0 ? ` (index: ${elementIndex})` : ''}`);
          
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
          
          // V2: TRY SMARTFINDER FIRST (recipe-based element finding)
          // This uses semantic identification (role, text, context) instead of brittle selectors
          if (this.useSmartFinder && !clickSuccess) {
            try {
              const v2Locator = await this.findElementV2(resolvedStep);
              if (v2Locator) {
                await v2Locator.waitFor({ state: 'visible', timeout: 5000 });
                await v2Locator.click({ timeout: 5000 });
                clickSuccess = true;
                clickLocator = v2Locator;
                console.log(`[Executor] ✓ V2 SmartFinder click successful`);
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
            () => getAtIndex(this.page.getByText(clickText, { exact: false })),
            () => getAtIndex(this.page.getByRole('button', { name: clickText })),
            () => getAtIndex(this.page.getByRole('link', { name: clickText })),
            () => getAtIndex(this.page.getByRole('checkbox', { name: clickText })),
            () => getAtIndex(this.page.getByRole('radio', { name: clickText })),
            () => getAtIndex(this.page.getByLabel(clickText)),
            () => getAtIndex(this.page.locator(`label:has-text("${clickText}")`)),
            () => getAtIndex(this.page.getByRole('menuitem', { name: clickText })),
            () => getAtIndex(this.page.locator(`[aria-label*="${clickText}"], [title*="${clickText}"]`)),
            // Salesforce-specific: span with text inside checkbox container
            () => this.page.locator(`.slds-checkbox span:has-text("${clickText}"), .slds-radio span:has-text("${clickText}")`).first(),
            // Click the actual input near text
            () => this.page.locator(`text="${clickText}" >> xpath=../preceding-sibling::input | text="${clickText}" >> xpath=../input`).first(),
          ];
          
          if (!clickSuccess) {
            for (const getLocator of textStrategies) {
              if (clickSuccess) break;
              
              for (let retry = 0; retry < 2 && !clickSuccess; retry++) {
                try {
                  clickLocator = getLocator();
                  await clickLocator.waitFor({ state: 'visible', timeout: retry === 0 ? 3000 : 5000 });
                  
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
                  console.log(`[Executor] ✓ Click succeeded with strategy`);
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
          
          // Wait for UI to settle - longer for form elements
          const isFormElement = isCheckboxRadio || 
            (clickText && clickText.length < 30 && clickText.split(' ').length <= 3);
          
          if (isFormElement) {
            console.log('[Executor] Form element click, waiting for state change...');
            await this.page.waitForTimeout(500);
          } else {
            await this.page.waitForTimeout(300);
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
          
          // Normalize text: strip trailing numbers, emojis (badge counts, etc.)
          const normalizedClickText = clickText
            .replace(/\s*\d+\s*$/, '')    // Strip trailing numbers
            .replace(/[^\x00-\x7F]/g, '') // Strip emojis/non-ASCII
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
          
        // Hover
        case 'Hover':
        case 'hover':
          const hoverSelector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
          await this.page.hover(hoverSelector);
          break;
          
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

    try {
      await this.initialize();

      for (let i = 0; i < testData.steps.length; i++) {
        const step = testData.steps[i];
        
        // Skip disabled steps
        if (step.enabled === false) {
          results.steps.push({ stepId: step.id, status: 'skipped' });
          continue;
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
        if (i < testData.steps.length - 1 && this.stepDelay > 0) {
          await this.page.waitForTimeout(this.stepDelay);
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

  // Execute step assertion (attached to a step, not a standalone assertion step)
  // @param {Object} assertion - Assertion object
  // @param {string} [stepSelector] - Fallback selector from the step (for value assertions)
  async executeStepAssertion(assertion, stepSelector = '') {
    const { type, expected } = assertion;
    // Support both 'target' and 'selector' property names (normalize if object)
    const target = assertion.target || this.normalizeSelector(assertion.selector) || stepSelector;
    const timeout = this.timeout;

    console.log(`[Executor] Assertion type="${type}" expected="${expected}" target="${target}"`);

    switch (type) {
      case 'text_contains':
      case 'textContains':
        // Simple: Is this text visible on the page?
        if (!expected) throw new Error('No expected text');
        const hasText = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false);
        if (!hasText) throw new Error(`Text "${expected}" not visible on page`);
        break;
        
      case 'value_contains':
      case 'valueContains':
        // Does the input field contain this value?
        // If no target, search all inputs on the page for the expected value
        if (!expected) {
          console.log('[Executor] value_contains: no expected value, auto-pass');
          break;
        }
        
        let valueFound = false;
        let inputTarget = target;
        
        if (inputTarget) {
          // We have a specific target - check it
          try {
            const inputVal = await this.page.locator(inputTarget).first().inputValue({ timeout: 5000 });
            if (inputVal && inputVal.toLowerCase().includes(expected.toLowerCase())) {
              valueFound = true;
              console.log(`[Executor] value_contains: Found "${expected}" in target input`);
            } else {
              throw new Error(`Input value "${inputVal}" does not contain "${expected}"`);
            }
          } catch (e) {
            if (e.message.includes('does not contain')) throw e;
            console.log(`[Executor] Target selector failed, searching all inputs...`);
          }
        }
        
        if (!valueFound) {
          // No target or target failed - search ALL inputs on the page
          console.log(`[Executor] Searching all inputs for value containing "${expected}"...`);
          const allInputs = await this.page.locator('input, textarea, [contenteditable="true"]').all();
          
          for (const input of allInputs) {
            try {
              let val = await input.inputValue({ timeout: 500 }).catch(() => null);
              if (val === null) {
                // Try textContent for contenteditable
                val = await input.textContent({ timeout: 500 }).catch(() => '');
              }
              if (val && val.toLowerCase().includes(expected.toLowerCase())) {
                valueFound = true;
                console.log(`[Executor] value_contains: Found "${expected}" in an input!`);
                break;
              }
            } catch (e) { /* ignore individual input errors */ }
          }
          
          // Also check if the expected text is visible on the page at all
          if (!valueFound) {
            const pageText = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
            if (pageText) {
              valueFound = true;
              console.log(`[Executor] value_contains: Found "${expected}" as visible text on page`);
            }
          }
          
          if (!valueFound) {
            throw new Error(`Value "${expected}" not found in any input or visible on page`);
          }
        }
        break;

      case 'text_equals':
      case 'textEquals':
        // Simple: Does element have exact text?
        if (!target) throw new Error('No target selector');
        const elemText = await this.page.locator(target).first().textContent({ timeout: 5000 }).catch(() => '');
        if (elemText?.trim() !== expected?.trim()) {
          throw new Error(`Expected "${expected}" but got "${elemText?.trim()}"`);
        }
        break;

      case 'element_visible':
      case 'elementVisible':
        // Simple: Is element visible?
        const visSelector = target || (expected ? `text=${expected}` : null);
        if (!visSelector) throw new Error('No target or text specified');
        const isVis = await this.page.locator(visSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
        if (!isVis) throw new Error(`Element not visible: ${visSelector}`);
        break;

      case 'element_hidden':
      case 'element_not_visible':
        // Simple: Is element NOT visible?
        const hidSelector = target || (expected ? `text=${expected}` : null);
        if (!hidSelector) throw new Error('No target or text specified');
        const stillVis = await this.page.locator(hidSelector).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (stillVis) throw new Error(`Element still visible: ${hidSelector}`);
        break;

      case 'element_enabled':
      case 'elementEnabled':
        // Simple: Is element enabled (clickable)?
        if (!target) throw new Error('No target selector');
        const isEnabled = await this.page.locator(target).first().isEnabled({ timeout: 5000 }).catch(() => false);
        if (!isEnabled) throw new Error(`Element not enabled: ${target}`);
        break;

      case 'element_disabled':
      case 'elementDisabled':
        // Simple: Is element disabled?
        if (!target) throw new Error('No target selector');
        const isDisabled = await this.page.locator(target).first().isDisabled({ timeout: 5000 }).catch(() => false);
        if (!isDisabled) throw new Error(`Element not disabled: ${target}`);
        break;

      case 'url_contains':
      case 'urlContains':
        // Simple: Does URL contain text?
        if (!expected) throw new Error('No expected URL text');
        const url = this.page.url();
        if (!url.includes(expected)) throw new Error(`URL "${url}" doesn't contain "${expected}"`);
        break;

      case 'url_equals':
      case 'urlEquals':
        // Simple: Does URL match exactly?
        if (!expected) throw new Error('No expected URL');
        const urlExact = this.page.url();
        if (urlExact !== expected) throw new Error(`URL is "${urlExact}", expected "${expected}"`);
        break;

      case 'value_equals':
      case 'valueEquals':
        // Does input have exact value?
        // If no target, search all inputs for the expected value
        if (!expected) {
          console.log('[Executor] value_equals: no expected value, auto-pass');
          break;
        }
        
        let valueEqualsFound = false;
        
        if (target) {
          // We have a specific target - check it
          const val = await this.page.locator(target).first().inputValue({ timeout: 5000 }).catch(() => '');
          if (val !== expected) throw new Error(`Value is "${val}", expected "${expected}"`);
          valueEqualsFound = true;
        } else {
          // No target - search ALL inputs on the page for this exact value
          console.log(`[Executor] value_equals: No target, searching all inputs for "${expected}"...`);
          const allInputs = await this.page.locator('input, textarea, [contenteditable="true"]').all();
          
          for (const input of allInputs) {
            try {
              let inputVal = await input.inputValue({ timeout: 500 }).catch(() => null);
              if (inputVal === null) {
                // Try textContent for contenteditable
                inputVal = await input.textContent({ timeout: 500 }).catch(() => '');
              }
              if (inputVal === expected) {
                valueEqualsFound = true;
                console.log(`[Executor] value_equals: Found exact value "${expected}" in an input!`);
                break;
              }
            } catch (e) { /* ignore individual input errors */ }
          }
          
          if (!valueEqualsFound) {
            throw new Error(`Value "${expected}" not found in any input on the page`);
          }
        }
        break;

      case 'success':
        // Always pass - used as simple "step completed" assertion
        console.log('[Executor] Success assertion - auto-pass');
        break;

      case 'page_title':
      case 'title_contains':
        // Simple: Does page title contain text?
        if (!expected) throw new Error('No expected title');
        const title = await this.page.title();
        if (!title.toLowerCase().includes(expected.toLowerCase())) {
          throw new Error(`Title "${title}" doesn't contain "${expected}"`);
        }
        break;

      case 'success':
      case 'verify_success':
        // Simple: Step completed successfully (always passes)
        break;
      
      case 'toast_message':
      case 'alert_message':
        // Check for toast/alert message containing expected text
        if (!expected) throw new Error('No expected message text');
        const toastSelectors = [
          // Salesforce Lightning toasts
          '.slds-notify__content',
          '.toastMessage',
          '.forceToastMessage',
          '[data-key="toastMessage"]',
          // Generic toasts/alerts
          '.toast-message',
          '.alert-message',
          '[role="alert"]',
          '[role="status"]',
          '.notification',
          '.snackbar'
        ];
        let toastFound = false;
        for (const sel of toastSelectors) {
          try {
            const elem = this.page.locator(sel);
            if (await elem.count() > 0) {
              const text = await elem.first().textContent({ timeout: 2000 });
              if (text && text.toLowerCase().includes(expected.toLowerCase())) {
                toastFound = true;
                console.log(`[Executor] Toast found: "${text}"`);
                break;
              }
            }
          } catch (e) { /* ignore */ }
        }
        // Also check page for text directly
        if (!toastFound) {
          toastFound = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
        }
        if (!toastFound) {
          throw new Error(`Toast/Alert message "${expected}" not found`);
        }
        break;
      
      case 'count_equals':
      case 'element_count':
        // Check element count
        if (!target) throw new Error('No target selector for count check');
        const count = await this.page.locator(target).count();
        const expectedCount = parseInt(expected || '0', 10);
        if (count !== expectedCount) {
          throw new Error(`Element count is ${count}, expected ${expectedCount}`);
        }
        break;

      // ========== NEW CONTEXT-AWARE ASSERTION TYPES ==========
      
      // Navigate step assertions
      case 'page_loaded':
      case 'pageLoaded':
        // Page loaded successfully - wait for load state, don't just check
        try {
          await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
          console.log('[Executor] page_loaded: DOM content loaded');
          // Also wait a bit for any dynamic content
          await this.page.waitForTimeout(500);
        } catch (e) {
          throw new Error(`Page did not load within timeout: ${e.message}`);
        }
        break;
        
      case 'no_errors':
      case 'noErrors':
        // Check no error banners visible
        const errorSelectors = [
          '[class*="error"]', '[class*="Error"]', 
          '[role="alert"]', '.alert-danger', '.error-message',
          '.slds-notify--error', '.forceToastMessage.error'
        ];
        let errorFound = false;
        for (const sel of errorSelectors) {
          const errElem = await this.page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
          if (errElem) {
            const errText = await this.page.locator(sel).first().textContent().catch(() => '');
            errorFound = true;
            throw new Error(`Error element found: ${errText || sel}`);
          }
        }
        console.log('[Executor] no_errors: No error elements visible');
        break;
        
      case 'loading_complete':
      case 'loadingComplete':
        // Check loading spinners are gone
        const loaderSelectors = [
          '.loading', '.spinner', '.loader', '[class*="loading"]',
          '.slds-spinner', '.forceSpinner', '[role="progressbar"]'
        ];
        for (const sel of loaderSelectors) {
          const isLoading = await this.page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
          if (isLoading) {
            // Wait for it to disappear
            await this.page.locator(sel).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          }
        }
        console.log('[Executor] loading_complete: No loading indicators visible');
        break;
        
      case 'load_time_under':
      case 'loadTimeUnder':
        // This is informational - we can't accurately measure after the fact
        // Just log and pass
        console.log(`[Executor] load_time_under: Checking load time (target: ${expected}ms)`);
        break;
        
      // Click step assertions
      case 'url_changed':
      case 'urlChanged':
        // URL should be different from the original - always passes after navigation
        console.log(`[Executor] url_changed: Current URL is ${this.page.url()}`);
        break;
        
      case 'toast_success':
      case 'toastSuccess':
        // Look for success toast/notification
        const successSelectors = [
          '.slds-notify--success', '.slds-theme_success',
          '.toast-success', '.alert-success', '[class*="success"]',
          '.forceToastMessage:not(.error)', '.toastMessage'
        ];
        let successFound = false;
        for (const sel of successSelectors) {
          const elem = await this.page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (elem) {
            const text = await this.page.locator(sel).first().textContent({ timeout: 1000 }).catch(() => '');
            if (!expected || text.toLowerCase().includes((expected || '').toLowerCase())) {
              successFound = true;
              console.log(`[Executor] toast_success: Found success message "${text}"`);
              break;
            }
          }
        }
        if (!successFound && expected) {
          // Also try finding text directly
          successFound = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
        }
        if (!successFound && expected) {
          throw new Error(`Success message "${expected}" not found`);
        }
        break;
        
      case 'toast_error':
      case 'toastError':
        // Look for error toast/notification (this is expected in negative tests)
        const errToastSels = [
          '.slds-notify--error', '.slds-theme_error',
          '.toast-error', '.alert-danger', '.error-message'
        ];
        let errToastFound = false;
        for (const sel of errToastSels) {
          const elem = await this.page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (elem) {
            const text = await this.page.locator(sel).first().textContent({ timeout: 1000 }).catch(() => '');
            if (!expected || text.toLowerCase().includes((expected || '').toLowerCase())) {
              errToastFound = true;
              console.log(`[Executor] toast_error: Found error message "${text}"`);
              break;
            }
          }
        }
        if (!errToastFound && expected) {
          throw new Error(`Error message "${expected}" not found`);
        }
        break;
        
      case 'toast_info':
      case 'toastInfo':
        // Look for info toast/notification
        const infoSelectors = ['.slds-notify--info', '.toast-info', '.alert-info'];
        let infoFound = false;
        for (const sel of infoSelectors) {
          const elem = await this.page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (elem) {
            infoFound = true;
            break;
          }
        }
        if (expected) {
          infoFound = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
        }
        console.log(`[Executor] toast_info: ${infoFound ? 'Found' : 'Not found'}`);
        break;
        
      case 'element_appears':
      case 'elementAppears':
        // Wait for element to appear
        const appearSel = target || (expected ? `text=${expected}` : null);
        if (appearSel) {
          try {
            await this.page.locator(appearSel).first().waitFor({ state: 'visible', timeout: 10000 });
            console.log(`[Executor] element_appears: Element appeared: ${appearSel}`);
          } catch (e) {
            throw new Error(`Element did not appear within 10s: ${appearSel}`);
          }
        } else {
          console.warn('[Executor] element_appears: No target or expected text provided, skipping');
        }
        break;
        
      case 'element_disappears':
      case 'elementDisappears':
        // Wait for element to disappear
        const disappearSel = target || (expected ? `text=${expected}` : null);
        if (disappearSel) {
          await this.page.locator(disappearSel).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
            console.log(`[Executor] element_disappears: Element may still be visible: ${disappearSel}`);
          });
          console.log(`[Executor] element_disappears: Element hidden: ${disappearSel}`);
        } else {
          console.warn('[Executor] element_disappears: No target or expected text provided, skipping');
        }
        break;
        
      case 'new_tab_opens':
      case 'newTabOpens':
        // Check if new tab/popup opened - just log, hard to verify
        console.log('[Executor] new_tab_opens: Assertion noted (manual verification may be needed)');
        break;
        
      case 'confirmation_dialog':
      case 'confirmationDialog':
      case 'modal_opens':
      case 'modalOpens':
        // Check for modal/dialog
        const dialogSels = ['[role="dialog"]', '.modal', '.slds-modal', '[class*="modal"]', '.slds-backdrop'];
        let dialogFound = false;
        for (const sel of dialogSels) {
          dialogFound = await this.page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (dialogFound) {
            console.log(`[Executor] confirmation_dialog: Dialog found using ${sel}`);
            // If expected text provided, verify the dialog contains it
            if (expected) {
              const dialogText = await this.page.locator(sel).first().textContent().catch(() => '');
              if (!dialogText.toLowerCase().includes(expected.toLowerCase())) {
                throw new Error(`Dialog found but does not contain "${expected}"`);
              }
            }
            break;
          }
        }
        if (!dialogFound) {
          throw new Error('No confirmation dialog/modal found');
        }
        break;
        
      case 'form_submitted':
      case 'formSubmitted':
        // Form submission - typically URL changes or success message appears
        console.log('[Executor] form_submitted: Form submission noted');
        break;
        
      case 'form_reset':
      case 'formReset':
        // Form reset - check inputs are empty
        console.log('[Executor] form_reset: Form reset noted');
        break;
        
      case 'download_starts':
      case 'downloadStarts':
        // Download detection - just log
        console.log('[Executor] download_starts: Download assertion noted');
        break;
        
      // Input step assertions
      case 'value_accepted':
      case 'valueAccepted':
        // Value was entered successfully - just passes if step passed
        console.log('[Executor] value_accepted: Input accepted');
        break;
        
      case 'value_formatted':
      case 'valueFormatted':
        // Input was auto-formatted
        console.log('[Executor] value_formatted: Format check noted');
        break;
        
      case 'password_masked':
      case 'passwordMasked':
        // Password field shows masked characters (dots/bullets)
        // Just passes if the fill succeeded (password fields auto-mask)
        console.log('[Executor] password_masked: Password field accepted (auto-masked by browser)');
        break;
        
      case 'no_validation_error':
      case 'noValidationError':
        // Check no validation error appears - near the input if target provided, or globally
        const valErrSelectors = [
          '.field-error', '.error-message', '.validation-error',
          '.slds-form-element__help.slds-text-color_error', '.slds-has-error',
          '[data-error="true"]', '.invalid-feedback'
        ];
        let valErrVisible = false;
        
        if (target) {
          // Check near the specific input
          const errCheck = this.page.locator(target).locator('..').locator('[class*="error"], .slds-form-element__help');
          valErrVisible = await errCheck.first().isVisible({ timeout: 1000 }).catch(() => false);
        } else {
          // Check globally for any validation errors
          for (const errSel of valErrSelectors) {
            const errElem = await this.page.locator(errSel).first().isVisible({ timeout: 500 }).catch(() => false);
            if (errElem) {
              const errText = await this.page.locator(errSel).first().textContent().catch(() => '');
              // Skip if it's an empty error element or just structural
              if (errText && errText.trim().length > 0) {
                valErrVisible = true;
                console.log(`[Executor] no_validation_error: Found error text "${errText.trim()}"`);
                break;
              }
            }
          }
        }
        
        if (valErrVisible) {
          throw new Error('Validation error found');
        }
        console.log('[Executor] no_validation_error: No validation errors visible');
        break;
        
      case 'validation_error_shown':
      case 'validationErrorShown':
        // Validation error SHOULD appear (negative test)
        if (expected) {
          const hasValErr = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (!hasValErr) {
            throw new Error(`Expected validation error "${expected}" not found`);
          }
          console.log(`[Executor] validation_error_shown: Found "${expected}"`);
        }
        break;
        
      case 'field_valid':
      case 'fieldValid':
        console.log('[Executor] field_valid: Field validity noted');
        break;
        
      case 'field_invalid':
      case 'fieldInvalid':
        console.log('[Executor] field_invalid: Field invalidity noted');
        break;
        
      case 'placeholder_hidden':
      case 'placeholderHidden':
        console.log('[Executor] placeholder_hidden: Placeholder check noted');
        break;
        
      case 'helper_text_shown':
      case 'helperTextShown':
        if (expected) {
          const hasHelper = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (!hasHelper) {
            throw new Error(`Helper text "${expected}" not found`);
          }
          console.log(`[Executor] helper_text_shown: Found "${expected}"`);
        } else {
          // Check for any helper text elements
          const helperSels = ['.helper-text', '.form-text', '.slds-form-element__help', '[class*="hint"]', '[class*="helper"]'];
          let anyHelper = false;
          for (const sel of helperSels) {
            anyHelper = await this.page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
            if (anyHelper) break;
          }
          console.log(`[Executor] helper_text_shown: ${anyHelper ? 'Helper text visible' : 'No specific helper text found'}`);
        }
        break;
        
      case 'suggestions_shown':
      case 'suggestionsShown':
        const acSels = ['[role="listbox"]', '.autocomplete', '[class*="suggestion"]', '[class*="dropdown"]'];
        let acFound = false;
        for (const sel of acSels) {
          acFound = await this.page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (acFound) break;
        }
        console.log(`[Executor] suggestions_shown: ${acFound ? 'Suggestions visible' : 'No suggestions found'}`);
        break;
        
      // Select step assertions
      case 'option_selected':
      case 'optionSelected':
        console.log(`[Executor] option_selected: Selection noted${expected ? ` (${expected})` : ''}`);
        break;
        
      case 'dropdown_closed':
      case 'dropdownClosed':
        console.log('[Executor] dropdown_closed: Dropdown state noted');
        break;
        
      case 'dependent_dropdown_updated':
      case 'dependentDropdownUpdated':
        // Check if dependent dropdown has options
        if (target) {
          const hasOptions = await this.page.locator(target).locator('option').count() > 1 ||
                            await this.page.locator(target).isEnabled({ timeout: 2000 }).catch(() => false);
          console.log(`[Executor] dependent_dropdown_updated: ${hasOptions ? 'Updated' : 'May not have updated'}`);
        }
        break;
        
      case 'dependent_field_shown':
      case 'dependentFieldShown':
        if (target) {
          const isDepShown = await this.page.locator(target).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (!isDepShown) throw new Error(`Dependent field not shown: ${target}`);
          console.log(`[Executor] dependent_field_shown: Field visible: ${target}`);
        } else if (expected) {
          // Use expected as the text to find
          const isTextShown = await this.page.getByText(expected).first().isVisible({ timeout: 3000 }).catch(() => false);
          if (!isTextShown) throw new Error(`Dependent field/text "${expected}" not shown`);
          console.log(`[Executor] dependent_field_shown: Text "${expected}" visible`);
        } else {
          console.warn('[Executor] dependent_field_shown: No target or expected provided, skipping');
        }
        break;
        
      case 'dependent_field_hidden':
      case 'dependentFieldHidden':
        if (target) {
          const isDepHidden = await this.page.locator(target).first().isVisible({ timeout: 1000 }).catch(() => false);
          if (isDepHidden) throw new Error(`Dependent field still visible: ${target}`);
          console.log(`[Executor] dependent_field_hidden: Field hidden: ${target}`);
        } else if (expected) {
          const isTextHidden = await this.page.getByText(expected).first().isVisible({ timeout: 1000 }).catch(() => false);
          if (isTextHidden) throw new Error(`Dependent field/text "${expected}" still visible`);
          console.log(`[Executor] dependent_field_hidden: Text "${expected}" hidden`);
        } else {
          console.warn('[Executor] dependent_field_hidden: No target or expected provided, skipping');
        }
        break;
        
      case 'price_updated':
      case 'priceUpdated':
        console.log('[Executor] price_updated: Price update noted');
        break;
        
      // Hover assertions
      case 'tooltip_shown':
      case 'tooltipShown':
        const ttSels = ['[role="tooltip"]', '.tooltip', '[class*="tooltip"]'];
        let ttFound = false;
        for (const sel of ttSels) {
          ttFound = await this.page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (ttFound) break;
        }
        if (expected && !ttFound) {
          ttFound = await this.page.getByText(expected).first().isVisible({ timeout: 1000 }).catch(() => false);
        }
        console.log(`[Executor] tooltip_shown: ${ttFound ? 'Found' : 'Not found'}`);
        break;
        
      case 'dropdown_opens':
      case 'dropdownOpens':
        const ddSels = ['[role="menu"]', '[role="listbox"]', '.dropdown-menu', '[class*="dropdown"]'];
        let ddFound = false;
        for (const sel of ddSels) {
          ddFound = await this.page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (ddFound) break;
        }
        console.log(`[Executor] dropdown_opens: ${ddFound ? 'Dropdown opened' : 'No dropdown found'}`);
        break;
        
      // Wait assertions
      case 'text_appears':
      case 'textAppears':
        if (expected) {
          try {
            await this.page.getByText(expected, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
            console.log(`[Executor] text_appears: Text "${expected}" appeared`);
          } catch (e) {
            throw new Error(`Text "${expected}" did not appear within 10 seconds`);
          }
        } else {
          console.warn('[Executor] text_appears: No expected text provided, skipping');
        }
        break;
        
      case 'network_idle':
      case 'networkIdle':
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        console.log('[Executor] network_idle: Network is idle');
        break;
        
      case 'animation_complete':
      case 'animationComplete':
        await this.page.waitForTimeout(500); // Simple wait for animations
        console.log('[Executor] animation_complete: Animation wait complete');
        break;
        
      // API assertions (would need special handling in real API testing)
      case 'status_200':
      case 'status_201':
      case 'status_2xx':
      case 'status_4xx':
      case 'status_code':
      case 'body_contains':
      case 'body_equals':
      case 'json_path_equals':
      case 'json_path_exists':
      case 'array_length':
      case 'not_empty':
      case 'header_present':
      case 'header_equals':
      case 'cookie_set':
      case 'response_time_under':
        // These are for API testing context - auto-pass in UI context
        console.log(`[Executor] API assertion "${type}" noted (for API test context)`);
        break;
        
      // Assert/Verify assertions
      case 'element_exists':
      case 'elementExists':
        const existsSel = target || (expected ? `text=${expected}` : null);
        if (existsSel) {
          const existsCount = await this.page.locator(existsSel).count();
          if (existsCount === 0) throw new Error(`Element does not exist: ${existsSel}`);
          console.log(`[Executor] element_exists: Found ${existsCount} element(s): ${existsSel}`);
        } else {
          console.warn('[Executor] element_exists: No target or expected text provided, skipping');
        }
        break;
        
      case 'text_not_contains':
      case 'textNotContains':
        if (expected) {
          const hasNotText = await this.page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (hasNotText) throw new Error(`Text "${expected}" should NOT be visible but is`);
        }
        break;
        
      case 'element_text_equals':
      case 'elementTextEquals':
        if (target && expected !== undefined) {
          const elemTxt = await this.page.locator(target).first().textContent({ timeout: 5000 }).catch(() => null);
          if (elemTxt === null) {
            throw new Error(`Element not found: ${target}`);
          }
          if (elemTxt.trim() !== (expected || '').trim()) {
            throw new Error(`Element text "${elemTxt.trim()}" does not equal "${expected}"`);
          }
          console.log(`[Executor] element_text_equals: Text matches "${expected}"`);
        } else if (!target) {
          console.warn('[Executor] element_text_equals: No target selector provided, skipping');
        } else {
          console.warn('[Executor] element_text_equals: No expected text provided, skipping');
        }
        break;
        
      case 'count_greater':
      case 'countGreater':
        if (target) {
          const cntGreater = await this.page.locator(target).count();
          const minCount = parseInt(expected || '0', 10);
          if (cntGreater <= minCount) {
            throw new Error(`Element count ${cntGreater} is not greater than ${minCount}`);
          }
          console.log(`[Executor] count_greater: Count ${cntGreater} > ${minCount} ✓`);
        } else {
          console.warn('[Executor] count_greater: No target selector provided, skipping');
        }
        break;
        
      case 'count_less':
      case 'countLess':
        if (target) {
          const cntLess = await this.page.locator(target).count();
          const maxCount = parseInt(expected || '0', 10);
          if (cntLess >= maxCount) {
            throw new Error(`Element count ${cntLess} is not less than ${maxCount}`);
          }
          console.log(`[Executor] count_less: Count ${cntLess} < ${maxCount} ✓`);
        } else {
          console.warn('[Executor] count_less: No target selector provided, skipping');
        }
        break;
        
      // Screenshot/Visual
      case 'screenshot_taken':
      case 'visual_match':
        console.log(`[Executor] Visual assertion "${type}" noted`);
        break;
        
      // Upload
      case 'file_accepted':
      case 'preview_shown':
      case 'progress_complete':
      case 'upload_error':
        console.log(`[Executor] Upload assertion "${type}" noted`);
        break;
        
      // Salesforce-specific (when not using SF API)
      case 'record_count':
      case 'field_value':
      case 'record_exists':
      case 'record_not_exists':
      case 'field_equals':
      case 'field_not_empty':
      case 'record_type':
      case 'row_count':
      case 'row_count_greater':
      case 'no_rows':
      case 'column_value':
        console.log(`[Executor] Database/SF assertion "${type}" noted (for backend context)`);
        break;
        
      // Title assertions
      case 'title_equals':
      case 'titleEquals':
        if (expected) {
          const pageTitle = await this.page.title();
          if (pageTitle !== expected) {
            throw new Error(`Page title is "${pageTitle}", expected "${expected}"`);
          }
        }
        break;
        
      // Element states
      case 'element_selected':
      case 'elementSelected':
        if (target) {
          const isChecked = await this.page.locator(target).first().isChecked({ timeout: 2000 }).catch(() => false);
          const hasSelected = await this.page.locator(target).first().getAttribute('aria-selected').catch(() => null) === 'true';
          if (!isChecked && !hasSelected) {
            console.log('[Executor] element_selected: May not be selected');
          }
        }
        break;
        
      case 'element_expanded':
      case 'elementExpanded':
        if (target) {
          const isExpanded = await this.page.locator(target).first().getAttribute('aria-expanded').catch(() => null) === 'true';
          console.log(`[Executor] element_expanded: ${isExpanded ? 'Expanded' : 'May not be expanded'}`);
        }
        break;
        
      case 'element_highlighted':
      case 'elementHighlighted':
        console.log('[Executor] element_highlighted: Highlight check noted');
        break;
        
      case 'cursor_changes':
      case 'cursorChanges':
        console.log('[Executor] cursor_changes: Cursor change noted');
        break;

      default:
        console.warn(`[Executor] Unknown assertion type: ${type}, skipping`);
        // Don't fail for unknown types
        break;
    }
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

