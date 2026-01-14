/**
 * AI Explorer Agent - Autonomous Test Discovery
 * 
 * A fully autonomous agent that:
 * 1. Navigates to pages
 * 2. Identifies all interactive elements
 * 3. Actually PERFORMS actions (clicks, fills, selects)
 * 4. Observes state changes (what happened?)
 * 5. Records successful actions as test steps
 * 6. Discovers new pages/states
 * 7. Builds comprehensive test cases automatically
 * 
 * Like a self-driving car, but for testing!
 * 
 * @author Flowstral
 * @version 1.0.0
 */

const axios = require('axios');

// ============================================================================
// AI EXPLORER AGENT CLASS
// ============================================================================

class AIExplorerAgent {
  constructor(page, options = {}) {
    this.page = page;
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || 'gpt-4o-mini';
    this.maxActions = options.maxActions || 50;
    this.maxPages = options.maxPages || 5;
    this.timeout = options.timeout || 10000;
    this.debug = options.debug || false;
    
    // Exploration state
    this.visitedUrls = new Set();
    this.performedActions = [];
    this.discoveredTests = [];
    this.currentWorkflow = [];
    this.stateHistory = [];
    this.actionCount = 0;
    
    // Track performed element+action combinations to avoid repetition
    this.triedActions = new Set();
    
    // Track tabs/sections explored
    this.exploredTabs = new Set();
    
    // Default test data patterns for smart form filling
    const defaultTestData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Test123!@#',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-123-4567',
      address: '123 Test Street',
      city: 'Test City',
      zip: '12345',
      country: 'United States',
      card: '4111111111111111',
      cvv: '123',
      expiry: '12/25',
      search: 'test query',
      comment: 'This is a test comment',
      quantity: '2',
      promo: 'TESTCODE',
    };
    
    // Merge user-provided test data with defaults (user data takes precedence)
    this.testData = { ...defaultTestData, ...(options.testData || {}) };
    
    // Log if using custom test data
    if (options.testData) {
      this.log('Using custom test data:', Object.keys(options.testData).join(', '));
    }
    
    // Callbacks
    this.onAction = options.onAction || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onTestDiscovered = options.onTestDiscovered || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    
    // Stop flag
    this.shouldStop = false;
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[AIExplorer]', ...args);
    }
  }
  
  stop() {
    this.shouldStop = true;
  }
  
  // ==========================================================================
  // PAGE ANALYSIS
  // ==========================================================================
  
  /**
   * Get accessibility snapshot of current page
   */
  async getSnapshot() {
    try {
      const snapshot = await this.page.accessibility.snapshot({ interestingOnly: true });
      return this.simplifySnapshot(snapshot);
    } catch (error) {
      this.log('Snapshot failed, using DOM fallback');
      return await this.getDOMSnapshot();
    }
  }
  
  simplifySnapshot(node, depth = 0) {
    if (!node || depth > 8) return null;
    
    const simplified = {
      role: node.role,
      name: node.name || undefined,
      ref: `ref-${Math.random().toString(36).substr(2, 9)}`, // Generate ref for targeting
    };
    
    if (node.value) simplified.value = node.value;
    if (node.checked !== undefined) simplified.checked = node.checked;
    if (node.disabled) simplified.disabled = true;
    if (node.expanded !== undefined) simplified.expanded = node.expanded;
    
    if (node.children && node.children.length > 0) {
      const children = node.children
        .map(child => this.simplifySnapshot(child, depth + 1))
        .filter(Boolean);
      if (children.length > 0) {
        simplified.children = children;
      }
    }
    
    return simplified;
  }
  
  async getDOMSnapshot() {
    return await this.page.evaluate(() => {
      // Collect ALL interactive elements directly
      const interactiveElements = [];
      
      // Query for interactive elements
      const selectors = [
        'button', 'a[href]', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="checkbox"]',
        '[role="radio"]', '[role="combobox"]', '[role="textbox"]', '[role="menuitem"]',
        '[data-testid]', '[onclick]', '[tabindex="0"]'
      ];
      
      const elements = document.querySelectorAll(selectors.join(', '));
      
      elements.forEach((el, idx) => {
        if (el.disabled || el.hidden || el.offsetParent === null) return;
        
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || inferRole(tag, el);
        const name = el.getAttribute('aria-label') || 
                     el.getAttribute('title') ||
                     el.getAttribute('placeholder') ||
                     el.textContent?.trim().substring(0, 50) || '';
        
        if (role && name) {
          interactiveElements.push({
            role: role,
            name: name,
            ref: 'ref-' + Math.random().toString(36).substr(2, 9),
            value: el.value || undefined
          });
        }
      });
      
      function inferRole(tag, el) {
        const map = { 
          button: 'button', 
          a: 'link', 
          input: el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox',
          select: 'combobox',
          textarea: 'textbox',
          option: 'option'
        };
        return map[tag] || 'generic';
      }
      
      // Return as a simplified tree with all elements as children of root
      return {
        role: 'page',
        name: document.title,
        children: interactiveElements
      };
    });
  }
  
  async getDOMSnapshot_OLD() {
    return await this.page.evaluate(() => {
      function analyze(el, depth = 0) {
        if (!el || depth > 5) return null;
        const tag = el.tagName?.toLowerCase();
        if (!tag || ['script', 'style', 'noscript'].includes(tag)) return null;
        
        const role = el.getAttribute('role') || inferRole(tag, el);
        const name = el.getAttribute('aria-label') || el.getAttribute('title') || 
                     (el.innerText || '').trim().substring(0, 50);
        
        const node = { 
          role, 
          ref: 'ref-' + Math.random().toString(36).substr(2, 9) 
        };
        if (name) node.name = name;
        if (el.disabled) node.disabled = true;
        if (el.value) node.value = el.value.substring(0, 30);
        
        const children = [];
        for (const child of el.children) {
          const c = analyze(child, depth + 1);
          if (c) children.push(c);
        }
        if (children.length) node.children = children;
        
        return node;
      }
      
      function inferRole(tag, el) {
        const map = { button: 'button', a: 'link', 
          input: el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox',
          select: 'combobox', textarea: 'textbox', nav: 'navigation', main: 'main',
          form: 'form', table: 'table' };
        return map[tag] || 'generic';
      }
      
      return analyze(document.body);
    });
  }
  
  /**
   * Get current page state for comparison
   */
  async getPageState() {
    return await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        forms: Array.from(document.forms).map(f => ({
          id: f.id,
          action: f.action,
          fieldCount: f.elements.length
        })),
        visibleText: document.body.innerText.substring(0, 500),
        alerts: [], // Would need to track these
        dialogOpen: !!document.querySelector('[role="dialog"]:not([hidden])'),
        toastVisible: !!document.querySelector('[role="alert"], .toast, .notification'),
      };
    });
  }
  
  /**
   * Extract interactive elements from snapshot
   */
  extractInteractiveElements(snapshot, path = []) {
    const elements = [];
    
    if (!snapshot) return elements;
    
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 
      'combobox', 'tab', 'menuitem', 'option', 'switch',
      'slider', 'searchbox'
    ];
    
    if (interactiveRoles.includes(snapshot.role) && !snapshot.disabled) {
      elements.push({
        role: snapshot.role,
        name: snapshot.name || '',
        ref: snapshot.ref,
        path: [...path, snapshot.role],
        value: snapshot.value,
        checked: snapshot.checked,
      });
    }
    
    if (snapshot.children) {
      for (const child of snapshot.children) {
        elements.push(...this.extractInteractiveElements(child, [...path, snapshot.role]));
      }
    }
    
    return elements;
  }
  
  // ==========================================================================
  // AI DECISION MAKING
  // ==========================================================================
  
  /**
   * Ask AI what action to perform next
   */
  async decideNextAction(snapshot, elements, history) {
    // Build list of already-tried actions to avoid repetition
    const triedActionsStr = Array.from(this.triedActions).slice(-30).join('\n') || 'None';
    
    // Categorize elements for better exploration
    const tabs = elements.filter(e => e.role === 'tab');
    const checkboxes = elements.filter(e => e.role === 'checkbox');
    const radios = elements.filter(e => e.role === 'radio');
    const dropdowns = elements.filter(e => e.role === 'combobox');
    const textboxes = elements.filter(e => e.role === 'textbox' || e.role === 'searchbox');
    const buttons = elements.filter(e => e.role === 'button');
    const links = elements.filter(e => e.role === 'link');
    
    // Build test data display from actual values
    const testDataDisplay = Object.entries(this.testData)
      .filter(([k, v]) => v && !['card', 'cvv', 'expiry'].includes(k)) // Hide sensitive defaults
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    
    const prompt = `You are an autonomous test explorer. Analyze this page and decide what action to perform next.

CURRENT PAGE STATE:
URL: ${this.page.url()}
Title: ${await this.page.title()}

INTERACTIVE ELEMENTS BY TYPE:
- Tabs: ${tabs.length} (${tabs.slice(0, 5).map(t => t.name).join(', ')})
- Checkboxes: ${checkboxes.length} (${checkboxes.slice(0, 5).map(c => c.name).join(', ')})
- Radio buttons: ${radios.length} (${radios.slice(0, 5).map(r => r.name).join(', ')})
- Dropdowns: ${dropdowns.length} (${dropdowns.slice(0, 5).map(d => d.name).join(', ')})
- Text inputs: ${textboxes.length}
- Buttons: ${buttons.length}
- Links: ${links.length}

ALL INTERACTIVE ELEMENTS:
${elements.slice(0, 40).map((el, i) => 
  `${i + 1}. [${el.role}] "${el.name}" ${el.value ? `(value: ${el.value})` : ''}${el.checked !== undefined ? ` [${el.checked ? 'checked' : 'unchecked'}]` : ''}`
).join('\n')}

RECENT ACTIONS IN WORKFLOW:
${history.slice(-15).map(h => `- ${h.description}`).join('\n') || 'None yet'}

ALREADY TRIED (DO NOT REPEAT):
${triedActionsStr}

AVAILABLE TEST DATA:
${testDataDisplay}

EXPLORATION STRATEGY:
1. VARY ELEMENT TYPES - Don't just fill text fields! Also interact with:
   - TABS: Click different tabs to explore all sections
   - CHECKBOXES: Toggle them on/off to test both states  
   - RADIO BUTTONS: Select different options
   - DROPDOWNS: Open and select different options
   - BUTTONS: Click action buttons (submit, save, cancel, etc.)
   
2. AVOID REPETITION: Check "ALREADY TRIED" list - pick DIFFERENT elements
   
3. EXPLORE SYSTEMATICALLY:
   - First explore ALL tabs/sections before deep-diving
   - Fill forms completely before submitting
   - Test different states (check/uncheck, select different options)

4. FORM SUBMISSION:
   - After filling ALL form fields (text, dropdowns, checkboxes), submit the form
   - Use the provided test data for accurate filling

5. Return null ONLY when truly all element types have been explored

Return JSON:
{
  "action": "click" | "fill" | "select" | "check" | "radio" | "navigate" | null,
  "elementIndex": <number 1-based>,
  "value": "<value for fill/select/radio actions>",
  "reasoning": "<why this action - which unexplored element type are you testing?>",
  "expectedResult": "<what should happen>",
  "isFormSubmit": true/false,
  "isNavigation": true/false,
  "elementType": "<tab|checkbox|radio|dropdown|textbox|button|link>"
}`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an autonomous QA test explorer. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      const errorDetail = error.response?.data?.error?.message || error.message;
      this.log('AI decision error:', errorDetail);
      if (error.response?.status === 401) {
        const msg = 'API Key is invalid or unauthorized. Please check your OpenAI API key in Settings > AI';
        this.log(msg);
        this.onError({ error: msg });
      } else if (error.response?.status === 429) {
        const msg = 'Rate limit exceeded. Please wait and try again.';
        this.log(msg);
        this.onError({ error: msg });
      } else {
        this.onError({ error: `OpenAI API error: ${errorDetail}` });
      }
      return null;
    }
  }
  
  /**
   * Generate test case from recorded actions
   */
  async generateTestFromWorkflow(workflow, startUrl) {
    if (workflow.length < 2) return null;
    
    const prompt = `Convert this sequence of user actions into a named test case:

START URL: ${startUrl}

ACTIONS PERFORMED:
${workflow.map((w, i) => `${i + 1}. ${w.description} → Result: ${w.result}`).join('\n')}

Generate a test case with:
1. A descriptive name
2. Description of what it tests
3. Priority (high/medium/low)
4. The steps in order

Return JSON:
{
  "name": "<descriptive test name>",
  "description": "<what this test verifies>",
  "priority": "high|medium|low",
  "steps": [
    { "action": "navigate|click|fill|select|assert", "target": "<element>", "value": "<value if needed>" }
  ],
  "assertions": [
    { "type": "text|element|url", "expected": "<expected value>" }
  ]
}`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const test = JSON.parse(response.data.choices[0].message.content);
      
      // Add metadata
      test.id = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      test.generated = true;
      test.generatedAt = new Date().toISOString();
      test.startUrl = startUrl;
      
      return test;
    } catch (error) {
      this.log('Test generation error:', error.message);
      return null;
    }
  }
  
  // ==========================================================================
  // ACTION EXECUTION
  // ==========================================================================
  
  /**
   * Perform an action on the page
   */
  async performAction(action, element) {
    const startState = await this.getPageState();
    let result = { success: false, description: '', stateChange: null };
    
    try {
      switch (action.action) {
        case 'click':
          result = await this.doClick(element);
          break;
        case 'fill':
          result = await this.doFill(element, action.value);
          break;
        case 'select':
          result = await this.doSelect(element, action.value);
          break;
        case 'check':
          result = await this.doCheck(element);
          break;
        case 'radio':
          result = await this.doRadio(element, action.value);
          break;
        case 'navigate':
          result = await this.doNavigate(action.value);
          break;
        default:
          result = { success: false, description: `Unknown action: ${action.action}` };
      }
      
      // Wait for page to settle
      await this.page.waitForTimeout(500);
      
      // Check what changed
      const endState = await this.getPageState();
      result.stateChange = this.detectStateChange(startState, endState);
      
      // Record the action
      this.performedActions.push({
        ...action,
        element: element ? { role: element.role, name: element.name } : null,
        result: result.success ? 'success' : 'failed',
        stateChange: result.stateChange,
        timestamp: Date.now()
      });
      
      // Emit event
      this.onAction({
        action: action.action,
        element: element?.name || action.value,
        result: result.success,
        stateChange: result.stateChange
      });
      
    } catch (error) {
      result = { success: false, description: error.message, error: true };
      this.onError({ action, element, error: error.message });
    }
    
    return result;
  }
  
  async doClick(element) {
    const locators = [
      () => this.page.getByRole(element.role, { name: element.name }),
      () => this.page.getByText(element.name, { exact: true }),
      () => this.page.getByLabel(element.name),
      () => this.page.locator(`[aria-label="${element.name}"]`),
    ];
    
    for (const getLocator of locators) {
      try {
        const locator = getLocator();
        const count = await locator.count();
        if (count > 0) {
          await locator.first().click({ timeout: 5000 });
          return { 
            success: true, 
            description: `Clicked ${element.role} "${element.name}"` 
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, description: `Could not find element to click` };
  }
  
  async doFill(element, value) {
    // Auto-generate appropriate test data
    const testValue = this.getTestValue(element.name, value);
    
    const locators = [
      () => this.page.getByLabel(element.name),
      () => this.page.getByPlaceholder(element.name),
      () => this.page.getByRole('textbox', { name: element.name }),
      () => this.page.locator(`input[name*="${element.name}" i]`),
    ];
    
    for (const getLocator of locators) {
      try {
        const locator = getLocator();
        const count = await locator.count();
        if (count > 0) {
          await locator.first().fill(testValue, { timeout: 5000 });
          return { 
            success: true, 
            description: `Filled "${element.name}" with "${testValue}"` 
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, description: `Could not find input to fill` };
  }
  
  async doSelect(element, value) {
    // Try multiple strategies for different dropdown implementations
    const strategies = [
      // Strategy 1: Native HTML select
      async () => {
        const select = this.page.locator(`select`).filter({ hasText: element.name })
          .or(this.page.getByLabel(element.name));
        const count = await select.count();
        if (count > 0) {
          await select.first().selectOption({ label: value });
          return true;
        }
        return false;
      },
      // Strategy 2: Click combobox and select option
      async () => {
        const trigger = this.page.getByRole('combobox', { name: element.name });
        const count = await trigger.count();
        if (count > 0) {
          await trigger.first().click({ timeout: 3000 });
          await this.page.waitForTimeout(300);
          const option = this.page.getByRole('option', { name: value })
            .or(this.page.getByRole('listitem').filter({ hasText: value }));
          await option.first().click({ timeout: 3000 });
          return true;
        }
        return false;
      },
      // Strategy 3: Click by label then select listbox option
      async () => {
        const label = this.page.getByLabel(element.name);
        const count = await label.count();
        if (count > 0) {
          await label.first().click({ timeout: 3000 });
          await this.page.waitForTimeout(300);
          const option = this.page.getByRole('option', { name: value })
            .or(this.page.getByText(value, { exact: true }));
          await option.first().click({ timeout: 3000 });
          return true;
        }
        return false;
      },
      // Strategy 4: Custom dropdown - click element with name, then click option
      async () => {
        const dropdownTrigger = this.page.locator(`[aria-haspopup="listbox"], [data-testid*="dropdown"], .dropdown-trigger, .select-trigger`)
          .filter({ hasText: element.name });
        const count = await dropdownTrigger.count();
        if (count > 0) {
          await dropdownTrigger.first().click({ timeout: 3000 });
          await this.page.waitForTimeout(300);
          const option = this.page.getByText(value, { exact: true })
            .or(this.page.locator(`[data-value="${value}"], .dropdown-item, .select-option`).filter({ hasText: value }));
          await option.first().click({ timeout: 3000 });
          return true;
        }
        return false;
      }
    ];
    
    for (const strategy of strategies) {
      try {
        const success = await strategy();
        if (success) {
          return { 
            success: true, 
            description: `Selected "${value}" from "${element.name}"` 
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, description: `Could not select from dropdown "${element.name}"` };
  }
  
  async doCheck(element) {
    // Determine if we should check or uncheck based on current state
    const shouldUncheck = element.checked === true;
    
    const locators = [
      () => this.page.getByRole('checkbox', { name: element.name }),
      () => this.page.getByLabel(element.name),
      () => this.page.locator(`input[type="checkbox"]`).filter({ hasText: element.name }),
      () => this.page.locator(`[role="checkbox"]`).filter({ hasText: element.name }),
    ];
    
    for (const getLocator of locators) {
      try {
        const locator = getLocator();
        const count = await locator.count();
        if (count > 0) {
          if (shouldUncheck) {
            await locator.first().uncheck({ timeout: 5000 });
            return { 
              success: true, 
              description: `Unchecked "${element.name}"` 
            };
          } else {
            await locator.first().check({ timeout: 5000 });
            return { 
              success: true, 
              description: `Checked "${element.name}"` 
            };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, description: `Could not toggle checkbox "${element.name}"` };
  }
  
  async doRadio(element, value) {
    const locators = [
      () => this.page.getByRole('radio', { name: value || element.name }),
      () => this.page.getByLabel(value || element.name),
      () => this.page.locator(`input[type="radio"][value="${value}"]`),
      () => this.page.locator(`[role="radio"]`).filter({ hasText: value || element.name }),
    ];
    
    for (const getLocator of locators) {
      try {
        const locator = getLocator();
        const count = await locator.count();
        if (count > 0) {
          await locator.first().check({ timeout: 5000 });
          return { 
            success: true, 
            description: `Selected radio option "${value || element.name}"` 
          };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, description: `Could not select radio option "${value || element.name}"` };
  }
  
  async doNavigate(url) {
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      return { 
        success: true, 
        description: `Navigated to ${url}` 
      };
    } catch (e) {
      return { success: false, description: `Navigation failed: ${e.message}` };
    }
  }
  
  /**
   * Get appropriate test value for a field
   */
  getTestValue(fieldName, suggestedValue) {
    if (suggestedValue) return suggestedValue;
    
    const name = (fieldName || '').toLowerCase();
    
    // Username/login specific - check first (before email check)
    if (name.includes('username') || name.includes('user name') || name.includes('userid') || name.includes('login')) {
      return this.testData.username || this.testData.email;
    }
    if (name.includes('email') || name.includes('e-mail')) return this.testData.email;
    if (name.includes('password') || name.includes('pwd') || name.includes('pass')) return this.testData.password;
    if (name.includes('first') && name.includes('name')) return this.testData.firstName;
    if (name.includes('last') && name.includes('name')) return this.testData.lastName;
    if (name.includes('full') && name.includes('name')) return this.testData.name;
    if (name.includes('name') && !name.includes('user')) return this.testData.name;
    if (name.includes('phone') || name.includes('tel') || name.includes('mobile')) return this.testData.phone;
    if (name.includes('address') || name.includes('street')) return this.testData.address;
    if (name.includes('city')) return this.testData.city;
    if (name.includes('zip') || name.includes('postal') || name.includes('postcode')) return this.testData.zip;
    if (name.includes('country')) return this.testData.country;
    if (name.includes('card') || name.includes('credit')) return this.testData.card;
    if (name.includes('cvv') || name.includes('cvc') || name.includes('security')) return this.testData.cvv;
    if (name.includes('expir') || name.includes('exp')) return this.testData.expiry;
    if (name.includes('search') || name.includes('query') || name.includes('find')) return this.testData.search;
    if (name.includes('comment') || name.includes('message') || name.includes('note') || name.includes('description')) return this.testData.comment;
    if (name.includes('quantity') || name.includes('qty') || name.includes('amount')) return this.testData.quantity;
    if (name.includes('promo') || name.includes('coupon') || name.includes('code') || name.includes('voucher')) return this.testData.promo;
    
    // Check for any custom fields that match
    for (const [key, value] of Object.entries(this.testData)) {
      if (name.includes(key.toLowerCase()) && value) {
        return value;
      }
    }
    
    return 'test value';
  }
  
  /**
   * Detect what changed between states
   */
  detectStateChange(before, after) {
    const changes = [];
    
    if (before.url !== after.url) {
      changes.push({ type: 'navigation', from: before.url, to: after.url });
    }
    
    if (before.title !== after.title) {
      changes.push({ type: 'title_change', from: before.title, to: after.title });
    }
    
    if (!before.dialogOpen && after.dialogOpen) {
      changes.push({ type: 'dialog_opened' });
    }
    
    if (before.dialogOpen && !after.dialogOpen) {
      changes.push({ type: 'dialog_closed' });
    }
    
    if (!before.toastVisible && after.toastVisible) {
      changes.push({ type: 'notification_shown' });
    }
    
    // Check for new text appearing
    const newText = after.visibleText.replace(before.visibleText, '').trim();
    if (newText.length > 20) {
      changes.push({ type: 'new_content', preview: newText.substring(0, 100) });
    }
    
    return changes.length > 0 ? changes : [{ type: 'none' }];
  }
  
  // ==========================================================================
  // MAIN EXPLORATION LOOP
  // ==========================================================================
  
  /**
   * Start autonomous exploration
   */
  async explore(startUrl) {
    this.log('Starting autonomous exploration from:', startUrl);
    this.shouldStop = false;
    this.actionCount = 0;
    this.performedActions = [];
    this.discoveredTests = [];
    this.currentWorkflow = [];
    
    // Navigate to start URL
    await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    this.visitedUrls.add(startUrl);
    
    // Wait for page to stabilize
    await this.page.waitForTimeout(1500);
    
    const workflowStartUrl = startUrl;
    
    while (!this.shouldStop && this.actionCount < this.maxActions) {
      try {
        // Wait a moment for any animations/loading
        await this.page.waitForTimeout(500);
        
        // Get current state
        const snapshot = await this.getSnapshot();
        const elements = this.extractInteractiveElements(snapshot);
        
        this.onProgress({
          type: 'exploring',
          actionCount: this.actionCount,
          maxActions: this.maxActions,
          url: this.page.url(),
          elementsFound: elements.length,
          testsDiscovered: this.discoveredTests.length
        });
        
        this.log(`Found ${elements.length} interactive elements`);
        
        // Log first few elements for debugging
        if (elements.length > 0) {
          this.log('First 5 elements:', elements.slice(0, 5).map(e => `[${e.role}] ${e.name}`).join(', '));
        }
        
        if (elements.length === 0) {
          this.log('No interactive elements found, ending exploration');
          // Log snapshot for debugging
          this.log('Snapshot structure:', JSON.stringify(snapshot, null, 2).substring(0, 500));
          break;
        }
        
        // Ask AI what to do next
        const decision = await this.decideNextAction(snapshot, elements, this.currentWorkflow);
        
        if (!decision || decision.action === null) {
          this.log('AI decided exploration is complete');
          
          // Generate test from current workflow
          if (this.currentWorkflow.length >= 2) {
            const test = await this.generateTestFromWorkflow(this.currentWorkflow, workflowStartUrl);
            if (test) {
              this.discoveredTests.push(test);
              this.onTestDiscovered(test);
            }
          }
          break;
        }
        
        this.log('AI decision:', decision.action, 'on element', decision.elementIndex, '-', decision.reasoning);
        
        // Get target element
        const targetElement = elements[decision.elementIndex - 1];
        
        if (!targetElement && decision.action !== 'navigate') {
          this.log('Invalid element index, skipping');
          continue;
        }
        
        // Perform the action
        const result = await this.performAction(decision, targetElement);
        
        // Record this action+element combination to avoid repetition
        const actionKey = `${decision.action}:${targetElement?.role || 'nav'}:${(targetElement?.name || decision.value || '').substring(0, 30)}`;
        this.triedActions.add(actionKey);
        
        // Track tabs that have been explored
        if (targetElement?.role === 'tab') {
          this.exploredTabs.add(targetElement.name);
        }
        
        // Record in workflow
        this.currentWorkflow.push({
          action: decision.action,
          element: targetElement?.name || decision.value,
          value: decision.value,
          description: result.description,
          result: result.success ? 'success' : 'failed',
          expectedResult: decision.expectedResult,
          stateChange: result.stateChange
        });
        
        this.actionCount++;
        
        // Check if we navigated to a new page
        const currentUrl = this.page.url();
        if (!this.visitedUrls.has(currentUrl)) {
          this.visitedUrls.add(currentUrl);
          this.log('Discovered new page:', currentUrl);
          
          // Generate test for completed workflow
          if (this.currentWorkflow.length >= 2) {
            const test = await this.generateTestFromWorkflow(this.currentWorkflow, workflowStartUrl);
            if (test) {
              this.discoveredTests.push(test);
              this.onTestDiscovered(test);
            }
          }
          
          // Start new workflow
          this.currentWorkflow = [{
            action: 'navigate',
            element: currentUrl,
            description: `Navigated to ${currentUrl}`,
            result: 'success'
          }];
        }
        
        // Small delay between actions
        await this.page.waitForTimeout(300);
        
      } catch (error) {
        this.log('Exploration error:', error.message);
        this.onError({ phase: 'exploration', error: error.message });
        // Continue exploring despite errors
      }
    }
    
    // Final summary
    this.onProgress({
      type: 'complete',
      actionCount: this.actionCount,
      pagesVisited: this.visitedUrls.size,
      testsDiscovered: this.discoveredTests.length
    });
    
    return {
      success: true,
      actionsPerformed: this.actionCount,
      pagesVisited: Array.from(this.visitedUrls),
      tests: this.discoveredTests,
      actions: this.performedActions
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  AIExplorerAgent
};
