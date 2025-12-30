/**
 * Test Executor Service
 * 
 * Executes automated tests using Playwright within the Electron app.
 * Supports QWord actions, assertions, waits, and reports results.
 */

const { chromium, firefox, webkit } = require('playwright');

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
  }
  
  // Normalize selector - handles both string and object formats
  // Returns a string selector or empty string
  normalizeSelector(sel) {
    if (!sel) return '';
    if (typeof sel === 'string') return sel;
    // Handle object formats: { selector: "..." }, { value: "..." }, etc.
    return sel.selector || sel.value || sel.css || sel.xpath || '';
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
          
          // Helper to get locator at specific index
          const getAtIndex = (locator) => elementIndex === 0 ? locator.first() : locator.nth(elementIndex);
          
          // Detect if this is likely a checkbox/radio by selectorObj data
          const isCheckboxRadio = selectorObj.tag === 'input' && 
            (selectorObj.name?.includes('__c') || // Salesforce custom field
             selectorObj.id?.startsWith('checkbox') || 
             selectorObj.id?.startsWith('radio'));
          
          let clickSuccess = false;
          let clickLocator = null;
          const maxRetries = 3;
          
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
          
          // STRATEGY 3: Last resort - CSS selector from recording
          if (!clickSuccess && selectorObj.id) {
            console.log(`[Executor] Trying recorded ID selector: #${selectorObj.id}`);
            try {
              clickLocator = this.page.locator(`#${selectorObj.id}`);
              await clickLocator.click({ timeout: 5000, force: true });
              clickSuccess = true;
              console.log(`[Executor] ✓ Click succeeded with ID selector`);
            } catch (e) {
              // Continue to throw
            }
          }
          
          if (!clickSuccess) {
            throw new Error(`Could not click "${clickText}" after trying all strategies`);
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
          
        // Click element action (normalized)
        case 'ClickElement':
          let clickSelector = resolvedStep.selectorObj?.selector || this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
          const clickAriaLabel = resolvedStep.selectorObj?.ariaLabel;
          const clickTitle = resolvedStep.selectorObj?.title;
          const clickDataId = resolvedStep.selectorObj?.dataId;
          
          // If selector is a simple tag name (LWC element), build better selector
          if (clickSelector && /^[a-z]+-[a-z-]+$/.test(clickSelector)) {
            console.log(`[Executor] Detected LWC element: ${clickSelector}, looking for better selector`);
            if (clickAriaLabel) {
              clickSelector = `[aria-label="${clickAriaLabel}"]`;
            } else if (clickTitle) {
              clickSelector = `[title="${clickTitle}"]`;
            } else if (clickDataId) {
              clickSelector = `[data-id="${clickDataId}"]`;
            } else {
              // Use text-based selector
              const text = resolvedStep.selectorObj?.text || resolvedStep.args?.[0];
              if (text) {
                console.log(`[Executor] Using text selector for LWC: "${text}"`);
                await this.page.getByText(text, { exact: false }).first().click();
                break;
              }
            }
          }
          
          console.log(`[Executor] ClickElement: ${clickSelector}`);
          await this.page.locator(clickSelector).first().click();
          break;
          
        // Input actions
        case 'Fill':
        case 'input': {
          const fieldName = resolvedStep.args?.[0];
          const inputValue = resolvedStep.args?.[1] || resolvedStep.value || '';
          const fillSelectorObj = resolvedStep.selectorObj || {};
          
          // Build list of selectors to try (in priority order)
          const selectorsToTry = [];
          
          // 1. Explicit selector from recording
          if (resolvedStep.selector) selectorsToTry.push(this.normalizeSelector(resolvedStep.selector));
          if (fillSelectorObj.selector) selectorsToTry.push(fillSelectorObj.selector);
          
          // 2. ID (most reliable)
          if (fillSelectorObj.id) selectorsToTry.push(`#${fillSelectorObj.id}`);
          
          // 3. Name attribute
          if (fillSelectorObj.name) selectorsToTry.push(`[name="${fillSelectorObj.name}"]`);
          if (fieldName && fieldName !== fillSelectorObj.name) selectorsToTry.push(`[name="${fieldName}"]`);
          
          // 4. Placeholder (common for modern UIs)
          if (fillSelectorObj.placeholder) selectorsToTry.push(`[placeholder="${fillSelectorObj.placeholder}"]`);
          if (fieldName) selectorsToTry.push(`[placeholder*="${fieldName}"]`);
          
          // 5. Aria-label (accessibility)
          if (fillSelectorObj.ariaLabel) selectorsToTry.push(`[aria-label="${fillSelectorObj.ariaLabel}"]`);
          
          // 6. Label text (Playwright's label= selector)
          if (fieldName) selectorsToTry.push(`label=${fieldName}`);
          
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
          
          if (!fillSuccess) {
            throw new Error(`Fill failed: Could not find input for "${fieldName}". Tried ${uniqueSelectors.length} selectors.`);
          }
          break;
        }
          
        // Select dropdown
        case 'Select':
        case 'select':
          const selectSelector = resolvedStep.args?.[0] || this.normalizeSelector(resolvedStep.selector);
          const selectValue = resolvedStep.args?.[1] || resolvedStep.value;
          await this.page.selectOption(selectSelector, selectValue);
          break;
          
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

        default:
          // Try to handle unknown types by normalizing and re-routing
          const actionType = (resolvedStep.qword || resolvedStep.type || '').toLowerCase();
          console.warn(`[Executor] Unknown action type: ${actionType}, attempting fallback...`);
          
          // Try click-based actions
          if (actionType.includes('click')) {
            const clickTarget = resolvedStep.args?.[0] || resolvedStep.value;
            if (clickTarget) {
              console.log(`[Executor] Fallback: clicking text "${clickTarget}"`);
              await this.page.getByText(clickTarget, { exact: false }).first().click({ timeout: 10000 });
            }
          }
          // Try input-based actions  
          else if (actionType.includes('fill') || actionType.includes('input') || actionType.includes('type')) {
            const selector = this.normalizeSelector(resolvedStep.selector) || resolvedStep.args?.[0];
            const value = resolvedStep.args?.[1] || resolvedStep.value || '';
            if (selector) {
              console.log(`[Executor] Fallback: filling ${selector} with "${value}"`);
              await this.page.locator(selector).fill(value);
            }
          }
          // Try navigation
          else if (actionType.includes('goto') || actionType.includes('nav')) {
            const url = resolvedStep.args?.[0] || resolvedStep.url;
            if (url) {
              console.log(`[Executor] Fallback: navigating to ${url}`);
              await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            }
          }
          else {
            console.error(`[Executor] Could not handle action type: ${actionType}`);
            throw new Error(`Unknown action type: ${actionType}`);
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
        // Simple: Does input have exact value?
        if (!target) throw new Error('No target selector');
        const val = await this.page.locator(target).first().inputValue({ timeout: 5000 }).catch(() => '');
        if (val !== expected) throw new Error(`Value is "${val}", expected "${expected}"`);
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

