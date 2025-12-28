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
    };
    
    return actionMap[normalized] || actionType; // Return original if no mapping found
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
          await this.page.goto(resolvedStep.args?.[0] || resolvedStep.url, { 
            waitUntil: 'domcontentloaded' 
          });
          break;
          
        // Click text action (normalized)
        case 'ClickText':
          const clickText = resolvedStep.args?.[0];
          console.log(`[Executor] ClickText: "${clickText}"`);
          // Try multiple strategies for clicking text
          try {
            await this.page.getByText(clickText, { exact: false }).first().click({ timeout: 10000 });
          } catch (e1) {
            // Fallback: try role-based selector
            try {
              await this.page.getByRole('button', { name: clickText }).first().click({ timeout: 5000 });
            } catch (e2) {
              // Fallback: try link
              try {
                await this.page.getByRole('link', { name: clickText }).first().click({ timeout: 5000 });
              } catch (e3) {
                // Fallback: try menuitem
                try {
                  await this.page.getByRole('menuitem', { name: clickText }).first().click({ timeout: 5000 });
                } catch (e4) {
                  // Last fallback: use aria-label or title
                  await this.page.locator(`[aria-label*="${clickText}"], [title*="${clickText}"]`).first().click({ timeout: 5000 });
                }
              }
            }
          }
          break;
          
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
        case 'input':
          const fieldName = resolvedStep.args?.[0];
          const inputValue = resolvedStep.args?.[1] || resolvedStep.value || '';
          const selectorObj = resolvedStep.selectorObj || {};
          
          // Build list of selectors to try (in priority order)
          const selectorsToTry = [];
          
          // 1. Explicit selector from recording
          if (resolvedStep.selector) selectorsToTry.push(this.normalizeSelector(resolvedStep.selector));
          if (selectorObj.selector) selectorsToTry.push(selectorObj.selector);
          
          // 2. ID (most reliable)
          if (selectorObj.id) selectorsToTry.push(`#${selectorObj.id}`);
          
          // 3. Name attribute
          if (selectorObj.name) selectorsToTry.push(`[name="${selectorObj.name}"]`);
          if (fieldName && fieldName !== selectorObj.name) selectorsToTry.push(`[name="${fieldName}"]`);
          
          // 4. Placeholder (common for modern UIs)
          if (selectorObj.placeholder) selectorsToTry.push(`[placeholder="${selectorObj.placeholder}"]`);
          if (fieldName) selectorsToTry.push(`[placeholder*="${fieldName}"]`);
          
          // 5. Aria-label (accessibility)
          if (selectorObj.ariaLabel) selectorsToTry.push(`[aria-label="${selectorObj.ariaLabel}"]`);
          
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
              // Quick check if element exists (500ms timeout)
              await locator.waitFor({ state: 'visible', timeout: 2000 });
              await locator.fill(inputValue);
              console.log(`[Executor] ✅ Fill succeeded with selector: ${selector}`);
              fillSuccess = true;
              break;
            } catch (e) {
              console.log(`[Executor] ❌ Selector failed: ${selector}`);
              continue;
            }
          }
          
          if (!fillSuccess) {
            throw new Error(`Fill failed: Could not find input for "${fieldName}". Tried ${uniqueSelectors.length} selectors.`);
          }
          break;
          
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
        if (stepResult.status === 'passed' && step.assertion && step.assertion.enabled !== false && step.assertion.type) {
          console.log(`[Executor] Executing assertion for step ${i + 1}:`, step.assertion.type);
          try {
            // Pass step's selector as fallback for value-based assertions
            // Normalize selector - could be string or object
            const stepSelector = typeof step.selector === 'string' 
              ? step.selector 
              : (step.selector?.selector || step.selectorObj?.selector || '');
            await this.executeStepAssertion(step.assertion, stepSelector);
            console.log(`[Executor] Assertion passed for step ${i + 1}`);
          } catch (assertError) {
            console.error(`[Executor] Assertion failed for step ${i + 1}:`, assertError.message);
            stepResult.status = 'failed';
            stepResult.error = `Assertion failed: ${assertError.message}`;
            // Take screenshot on assertion failure (base64 for UI display)
            try {
              const screenshotBuffer = await this.page.screenshot({ type: 'png' });
              stepResult.screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            } catch (e) {}
          }
        }
        
        results.steps.push(stepResult);
        
        // Update variables if step extracted data
        if (stepResult.extractedValue) {
          results.variables[stepResult.extractedValue.name] = stepResult.extractedValue.value;
        }

        this.onStepComplete(i, step, stepResult);

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
        // Simple: Does the input field contain this value?
        if (!target) throw new Error('No target selector for value check (need step selector or assertion target)');
        const inputVal = await this.page.locator(target).first().inputValue({ timeout: 5000 }).catch(() => '');
        if (!inputVal.toLowerCase().includes((expected || '').toLowerCase())) {
          throw new Error(`Input value "${inputVal}" does not contain "${expected}"`);
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

