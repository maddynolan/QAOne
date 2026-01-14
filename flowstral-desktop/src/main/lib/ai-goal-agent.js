/**
 * AI Goal Agent - Autonomous Goal-Directed Test Automation
 * 
 * Give it a goal in natural language, and it will:
 * 1. Understand the objective
 * 2. Analyze the current page
 * 3. Decide the next action to get closer to the goal
 * 4. Perform the action using test data
 * 5. Verify progress and continue until goal is achieved
 * 
 * @version 1.0.0
 */

const axios = require('axios');

class AIGoalAgent {
  constructor(page, options = {}) {
    this.page = page;
    this.browserContext = page.context();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || 'gpt-4o-mini';
    this.maxSteps = options.maxSteps || 50;
    this.timeout = options.timeout || 10000;
    this.debug = options.debug !== false;
    
    // Test data for filling forms
    this.testData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'TestUser',
      phone: '555-123-4567',
      company: 'Test Company Inc',
      amount: '50000',
      date: new Date().toISOString().split('T')[0],
      description: 'Automated test entry',
      ...options.testData
    };
    
    // Execution state
    this.goal = null;
    this.stepsTaken = [];
    this.currentStep = 0;
    this.goalAchieved = false;
    this.shouldStop = false;
    
    // Callbacks
    this.onStep = options.onStep || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onGoalAchieved = options.onGoalAchieved || (() => {});
    this.onError = options.onError || (() => {});
    
    // Handle new tabs/popups
    this.setupPopupHandler();
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[AIGoalAgent]', ...args);
    }
  }
  
  stop() {
    this.shouldStop = true;
  }
  
  setupPopupHandler() {
    this.browserContext.on('page', async (newPage) => {
      this.log('New tab/popup detected, switching context');
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      this.page = newPage;
    });
  }
  
  // ==========================================================================
  // MAIN EXECUTION
  // ==========================================================================
  
  /**
   * Execute a goal - the main entry point
   * @param {string} goal - Natural language description of what to accomplish
   * @param {string} startUrl - Optional URL to start from
   */
  async executeGoal(goal, startUrl = null) {
    this.goal = goal;
    this.stepsTaken = [];
    this.currentStep = 0;
    this.goalAchieved = false;
    this.shouldStop = false;
    
    this.log('='.repeat(60));
    this.log('GOAL:', goal);
    this.log('TEST DATA:', JSON.stringify(this.testData, null, 2));
    this.log('='.repeat(60));
    
    try {
      // Navigate to start URL if provided
      if (startUrl) {
        await this.page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(1000);
        
        this.stepsTaken.push({
          action: 'navigate',
          target: startUrl,
          description: `Navigate to ${startUrl}`,
          qword: 'GoTo',
          args: [startUrl]
        });
      }
      
      // Main execution loop
      while (this.currentStep < this.maxSteps && !this.goalAchieved && !this.shouldStop) {
        this.currentStep++;
        this.log(`\n--- Step ${this.currentStep}/${this.maxSteps} ---`);
        
        // Get current page state
        const pageState = await this.analyzeCurrentPage();
        
        // Ask AI what to do next
        const decision = await this.decideNextAction(pageState);
        
        if (decision.goalAchieved) {
          this.goalAchieved = true;
          this.log('🎉 GOAL ACHIEVED!');
          break;
        }
        
        if (decision.action === 'done' || decision.action === 'stuck') {
          this.log('Agent decided to stop:', decision.reason);
          break;
        }
        
        // Execute the decided action
        const result = await this.executeAction(decision);
        
        // Record the step
        this.stepsTaken.push({
          step: this.currentStep,
          action: decision.action,
          target: decision.target,
          value: decision.value,
          description: decision.description,
          success: result.success,
          qword: this.actionToQWord(decision.action),
          args: this.getQWordArgs(decision)
        });
        
        this.onStep({
          step: this.currentStep,
          action: decision,
          result,
          totalSteps: this.stepsTaken.length
        });
        
        // Wait for page to stabilize
        await this.page.waitForTimeout(1000);
      }
      
      // Generate final test case
      const testCase = this.generateTestCase();
      
      return {
        success: this.goalAchieved,
        goal: this.goal,
        steps: this.stepsTaken,
        testCase,
        totalSteps: this.currentStep,
        reason: this.goalAchieved ? 'Goal achieved' : 'Max steps reached or stopped'
      };
      
    } catch (error) {
      this.log('Execution error:', error);
      this.onError({ error: error.message });
      return {
        success: false,
        goal: this.goal,
        steps: this.stepsTaken,
        error: error.message
      };
    }
  }
  
  // ==========================================================================
  // PAGE ANALYSIS
  // ==========================================================================
  
  async analyzeCurrentPage() {
    const url = this.page.url();
    const title = await this.page.title();
    
    // Get visible interactive elements
    const elements = await this.page.evaluate(() => {
      const results = [];
      const selectors = [
        'a[href]', 'button', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
        '[role="checkbox"]', '[role="radio"]', '[role="combobox"]',
        '[onclick]', '[data-testid]'
      ];
      
      document.querySelectorAll(selectors.join(', ')).forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0 || 
            style.display === 'none' || style.visibility === 'hidden') {
          return;
        }
        
        const tag = el.tagName.toLowerCase();
        const type = el.type || '';
        const name = el.name || el.id || '';
        const text = (el.innerText || '').trim().substring(0, 80);
        const placeholder = el.placeholder || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const href = el.getAttribute('href') || '';
        const role = el.getAttribute('role') || '';
        const value = el.value || '';
        
        // Build best identifier
        let identifier = ariaLabel || title || placeholder || text || name;
        if (!identifier && href) {
          identifier = href.split('/').pop() || href;
        }
        
        // Determine element category
        let category = 'other';
        if (tag === 'input') {
          if (type === 'text' || type === 'email' || type === 'tel' || type === 'number' || !type) category = 'textfield';
          else if (type === 'password') category = 'password';
          else if (type === 'checkbox') category = 'checkbox';
          else if (type === 'radio') category = 'radio';
          else if (type === 'submit' || type === 'button') category = 'button';
          else if (type === 'search') category = 'search';
          else if (type === 'date') category = 'date';
        } else if (tag === 'button' || role === 'button') {
          category = 'button';
        } else if (tag === 'a' || role === 'link') {
          category = 'link';
        } else if (tag === 'select' || role === 'combobox' || role === 'listbox') {
          category = 'dropdown';
        } else if (tag === 'textarea') {
          category = 'textarea';
        } else if (role === 'tab') {
          category = 'tab';
        } else if (role === 'menuitem') {
          category = 'menuitem';
        } else if (role === 'checkbox') {
          category = 'checkbox';
        } else if (role === 'radio') {
          category = 'radio';
        }
        
        // Build selector
        let selector = '';
        if (el.id) selector = `#${el.id}`;
        else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
        else if (name && (tag === 'input' || tag === 'select' || tag === 'textarea')) selector = `${tag}[name="${name}"]`;
        
        results.push({
          index: idx,
          tag,
          type,
          category,
          identifier: identifier.substring(0, 100),
          text: text.substring(0, 100),
          name,
          placeholder,
          selector,
          href,
          value,
          isVisible: true,
          position: { x: Math.round(rect.x), y: Math.round(rect.y) }
        });
      });
      
      return results;
    });
    
    // Get page text content for context
    const pageText = await this.page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).slice(0, 5);
      const labels = Array.from(document.querySelectorAll('label')).map(l => l.innerText.trim()).slice(0, 10);
      return { headings, labels };
    });
    
    this.log(`Page: ${title} (${url})`);
    this.log(`Found ${elements.length} interactive elements`);
    
    return {
      url,
      title,
      elements,
      headings: pageText.headings,
      labels: pageText.labels
    };
  }
  
  // ==========================================================================
  // AI DECISION MAKING
  // ==========================================================================
  
  async decideNextAction(pageState) {
    const prompt = `You are an AI test automation agent. Your goal is to accomplish a specific task by interacting with a web application.

GOAL TO ACHIEVE:
${this.goal}

TEST DATA AVAILABLE (use these values when filling forms):
${Object.entries(this.testData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

CURRENT PAGE:
- URL: ${pageState.url}
- Title: ${pageState.title}
- Headings: ${pageState.headings.join(', ') || 'None'}
- Form Labels: ${pageState.labels.join(', ') || 'None'}

PREVIOUS STEPS TAKEN (${this.stepsTaken.length}):
${this.stepsTaken.slice(-5).map((s, i) => `${i + 1}. ${s.description}`).join('\n') || 'None yet'}

INTERACTIVE ELEMENTS ON PAGE:
${pageState.elements.slice(0, 60).map((el, i) => 
  `[${i}] ${el.category.toUpperCase()}: "${el.identifier || el.text || el.placeholder || el.name || 'unnamed'}"${el.value ? ` (value: "${el.value}")` : ''}`
).join('\n')}

INSTRUCTIONS:
1. Analyze the current page and elements
2. Determine the SINGLE BEST action to get closer to the goal
3. If you see a form field that matches your test data, fill it
4. If the goal appears to be achieved (e.g., success message, confirmation), set goalAchieved to true
5. If stuck or no relevant elements, explain why

Respond with JSON:
{
  "thinking": "Brief explanation of your reasoning",
  "goalAchieved": false,
  "action": "click|fill|select|check|hover|wait|done|stuck",
  "elementIndex": <number from the elements list>,
  "target": "<element identifier or text>",
  "value": "<value to enter if filling>",
  "description": "<human readable step description>"
}`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a precise test automation agent. Always respond with valid JSON. Be specific about which element to interact with.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const decision = JSON.parse(response.data.choices[0].message.content);
      
      this.log('AI Decision:', decision.thinking);
      this.log('Action:', decision.action, 'Target:', decision.target, 'Value:', decision.value || 'N/A');
      
      // Attach the element info
      if (decision.elementIndex !== undefined && pageState.elements[decision.elementIndex]) {
        decision.element = pageState.elements[decision.elementIndex];
      }
      
      return decision;
      
    } catch (error) {
      this.log('AI decision error:', error.message);
      return { action: 'stuck', reason: error.message };
    }
  }
  
  // ==========================================================================
  // ACTION EXECUTION
  // ==========================================================================
  
  async executeAction(decision) {
    const { action, element, target, value } = decision;
    
    this.log(`Executing: ${action} on "${target}"${value ? ` with value "${value}"` : ''}`);
    
    try {
      switch (action) {
        case 'click':
          return await this.doClick(element, target);
          
        case 'fill':
          return await this.doFill(element, target, value);
          
        case 'select':
          return await this.doSelect(element, target, value);
          
        case 'check':
          return await this.doCheck(element, target);
          
        case 'hover':
          return await this.doHover(element, target);
          
        case 'wait':
          await this.page.waitForTimeout(2000);
          return { success: true };
          
        case 'done':
        case 'stuck':
          return { success: true, reason: decision.reason };
          
        default:
          this.log('Unknown action:', action);
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      this.log('Action failed:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  async doClick(element, target) {
    const locators = this.buildLocators(element, target);
    
    for (const locator of locators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 });
          
          // Check if this might open a popup
          const [popup] = await Promise.all([
            this.browserContext.waitForEvent('page', { timeout: 3000 }).catch(() => null),
            locator.first().click({ timeout: 5000 })
          ]);
          
          if (popup) {
            this.log('Click opened new tab');
            await popup.waitForLoadState('domcontentloaded');
            this.page = popup;
          }
          
          return { success: true };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'Element not found' };
  }
  
  async doFill(element, target, value) {
    const locators = this.buildLocators(element, target);
    
    for (const locator of locators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 });
          await locator.first().clear();
          await locator.first().fill(value);
          return { success: true };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'Element not found' };
  }
  
  async doSelect(element, target, value) {
    const locators = this.buildLocators(element, target);
    
    for (const locator of locators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          // Try native select
          try {
            await locator.first().selectOption({ label: value }, { timeout: 3000 });
            return { success: true };
          } catch {
            // Try clicking to open dropdown, then selecting
            await locator.first().click();
            await this.page.waitForTimeout(500);
            await this.page.getByText(value, { exact: false }).first().click();
            return { success: true };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'Element not found' };
  }
  
  async doCheck(element, target) {
    const locators = this.buildLocators(element, target);
    
    for (const locator of locators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          await locator.first().check({ timeout: 5000 });
          return { success: true };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'Element not found' };
  }
  
  async doHover(element, target) {
    const locators = this.buildLocators(element, target);
    
    for (const locator of locators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          await locator.first().hover({ timeout: 5000 });
          return { success: true };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: 'Element not found' };
  }
  
  buildLocators(element, target) {
    const locators = [];
    
    // Use selector if available
    if (element?.selector) {
      locators.push(this.page.locator(element.selector));
    }
    
    // Use text matching
    if (target) {
      locators.push(this.page.getByText(target, { exact: false }));
      locators.push(this.page.getByRole('button', { name: target }));
      locators.push(this.page.getByRole('link', { name: target }));
      locators.push(this.page.getByLabel(target));
      locators.push(this.page.getByPlaceholder(target));
      locators.push(this.page.locator(`[aria-label*="${target}"]`));
      locators.push(this.page.locator(`[title*="${target}"]`));
    }
    
    // Use element properties
    if (element?.name) {
      locators.push(this.page.locator(`[name="${element.name}"]`));
    }
    
    return locators.filter(Boolean);
  }
  
  // ==========================================================================
  // TEST CASE GENERATION
  // ==========================================================================
  
  actionToQWord(action) {
    const map = {
      'click': 'ClickText',
      'fill': 'Fill',
      'select': 'Select',
      'check': 'Check',
      'hover': 'Hover',
      'navigate': 'GoTo',
      'wait': 'Wait'
    };
    return map[action] || 'ClickText';
  }
  
  getQWordArgs(decision) {
    switch (decision.action) {
      case 'fill':
        return [decision.target, decision.value];
      case 'select':
        return [decision.target, decision.value];
      case 'navigate':
        return [decision.target];
      default:
        return [decision.target];
    }
  }
  
  generateTestCase() {
    return {
      id: `goal_test_${Date.now()}`,
      name: `Test: ${this.goal.substring(0, 50)}`,
      description: this.goal,
      steps: this.stepsTaken.map(s => ({
        qword: s.qword,
        args: s.args,
        description: s.description
      })),
      generated: true,
      generatedAt: new Date().toISOString(),
      source: 'ai-goal-agent',
      goalAchieved: this.goalAchieved
    };
  }
}

module.exports = { AIGoalAgent };
