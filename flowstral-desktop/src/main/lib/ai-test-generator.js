/**
 * AI Test Generator Agent
 * 
 * Automatically explores web applications and generates test cases using AI.
 * Uses the existing OpenAI configuration from Flowstral settings.
 * 
 * Flow:
 * 1. Navigate to page
 * 2. Get accessibility snapshot (like MCP browser tools)
 * 3. AI analyzes page structure
 * 4. AI generates test scenarios
 * 5. Execute and verify tests
 * 6. Crawl to next page and repeat
 * 
 * @author Flowstral
 * @version 1.0.0
 */

const axios = require('axios');

// ============================================================================
// AI TEST GENERATOR CLASS
// ============================================================================

class AITestGenerator {
  constructor(page, options = {}) {
    this.page = page;
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || 'gpt-4o-mini';
    this.maxPages = options.maxPages || 10;
    this.timeout = options.timeout || 30000;
    this.debug = options.debug || false;
    
    // Track visited pages and generated tests
    this.visitedUrls = new Set();
    this.generatedTests = [];
    this.errors = [];
    
    // Callbacks for progress updates
    this.onProgress = options.onProgress || (() => {});
    this.onTestGenerated = options.onTestGenerated || (() => {});
    this.onError = options.onError || (() => {});
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[AITestGenerator]', ...args);
    }
  }
  
  // ==========================================================================
  // ACCESSIBILITY SNAPSHOT (Similar to MCP browser_snapshot)
  // ==========================================================================
  
  /**
   * Get accessibility tree from the page
   * This is what I use with MCP to understand page structure
   */
  async getAccessibilitySnapshot() {
    try {
      const snapshot = await this.page.accessibility.snapshot({ interestingOnly: true });
      return this.simplifySnapshot(snapshot);
    } catch (error) {
      this.log('Accessibility snapshot failed, falling back to DOM analysis');
      return await this.getDOMSnapshot();
    }
  }
  
  /**
   * Simplify accessibility tree for AI consumption
   */
  simplifySnapshot(node, depth = 0) {
    if (!node || depth > 10) return null;
    
    const simplified = {
      role: node.role,
      name: node.name || undefined,
    };
    
    // Include important properties
    if (node.value) simplified.value = node.value;
    if (node.checked !== undefined) simplified.checked = node.checked;
    if (node.pressed !== undefined) simplified.pressed = node.pressed;
    if (node.selected !== undefined) simplified.selected = node.selected;
    if (node.expanded !== undefined) simplified.expanded = node.expanded;
    if (node.disabled) simplified.disabled = true;
    
    // Recursively process children
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
  
  /**
   * Fallback: Get DOM-based snapshot
   */
  async getDOMSnapshot() {
    return await this.page.evaluate(() => {
      function analyzeElement(el, depth = 0) {
        if (!el || depth > 5) return null;
        
        const tag = el.tagName?.toLowerCase();
        if (!tag || ['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) return null;
        
        const role = el.getAttribute('role') || getImpliedRole(tag, el);
        const name = el.getAttribute('aria-label') || 
                     el.getAttribute('title') || 
                     (el.innerText || '').trim().substring(0, 50);
        
        const node = { role };
        if (name) node.name = name;
        
        // Get interactive info
        if (el.disabled) node.disabled = true;
        if (el.checked !== undefined) node.checked = el.checked;
        if (el.value && ['input', 'textarea', 'select'].includes(tag)) {
          node.value = el.value.substring(0, 50);
        }
        
        // Get children
        const children = [];
        for (const child of el.children) {
          const analyzed = analyzeElement(child, depth + 1);
          if (analyzed) children.push(analyzed);
        }
        if (children.length > 0) node.children = children;
        
        return node;
      }
      
      function getImpliedRole(tag, el) {
        const roles = {
          button: 'button',
          a: 'link',
          input: el.type === 'checkbox' ? 'checkbox' : 
                 el.type === 'radio' ? 'radio' : 
                 el.type === 'submit' ? 'button' : 'textbox',
          select: 'combobox',
          textarea: 'textbox',
          table: 'table',
          nav: 'navigation',
          main: 'main',
          header: 'banner',
          footer: 'contentinfo',
          form: 'form',
          ul: 'list',
          li: 'listitem',
        };
        return roles[tag] || 'generic';
      }
      
      return analyzeElement(document.body);
    });
  }
  
  // ==========================================================================
  // AI ANALYSIS
  // ==========================================================================
  
  /**
   * Call OpenAI API to analyze page and generate tests
   */
  async callAI(prompt, systemPrompt = null) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: this.model,
      messages,
      temperature: 0.3, // Lower for more consistent test generation
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    const content = response.data.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }
  
  /**
   * Analyze page structure and identify testable elements
   */
  async analyzePage(snapshot, url) {
    const systemPrompt = `You are a QA automation expert. Analyze web page structures and generate comprehensive test cases.
    
Your output must be valid JSON with this structure:
{
  "pageType": "login|dashboard|form|list|detail|checkout|settings|other",
  "pageDescription": "Brief description of the page",
  "elements": [
    {
      "type": "button|input|link|dropdown|checkbox|radio|table",
      "name": "Element name/label",
      "purpose": "What this element does",
      "testable": true/false
    }
  ],
  "suggestedTests": [
    {
      "name": "Test name",
      "description": "What the test verifies",
      "priority": "high|medium|low",
      "steps": [
        { "action": "click|fill|select|assert|navigate", "target": "element name", "value": "optional value" }
      ]
    }
  ],
  "links": ["List of internal links to crawl"]
}`;

    const prompt = `Analyze this page and generate test cases:

URL: ${url}

Page Structure (Accessibility Tree):
${JSON.stringify(snapshot, null, 2)}

Generate:
1. Identify all interactive elements
2. Classify the page type
3. Generate test cases covering:
   - Happy path workflows
   - Form validation (if forms exist)
   - Navigation tests
   - Edge cases
4. List internal links to explore next`;

    return await this.callAI(prompt, systemPrompt);
  }
  
  // ==========================================================================
  // TEST GENERATION
  // ==========================================================================
  
  /**
   * Convert AI-generated tests to Flowstral format
   */
  convertToFlowstralFormat(aiTests, pageUrl) {
    const flowstralTests = [];
    
    for (const test of aiTests.suggestedTests || []) {
      const steps = [];
      
      for (const step of test.steps || []) {
        const flowstralStep = {
          id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          qword: this.mapActionToQWord(step.action),
          args: this.buildArgs(step),
          description: `${step.action} "${step.target}"${step.value ? ` with "${step.value}"` : ''}`,
          // Include recipe for V2 finder
          recipe: {
            what: { text: step.target },
            where: {},
            which: {}
          }
        };
        steps.push(flowstralStep);
      }
      
      // Add initial navigation if not present
      if (steps.length > 0 && steps[0].qword !== 'GoTo') {
        steps.unshift({
          id: `step_nav_${Date.now()}`,
          qword: 'GoTo',
          args: [pageUrl],
          description: `Navigate to ${new URL(pageUrl).pathname}`
        });
      }
      
      flowstralTests.push({
        id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: test.name,
        description: test.description,
        priority: test.priority || 'medium',
        pageUrl,
        steps,
        generated: true,
        generatedAt: new Date().toISOString()
      });
    }
    
    return flowstralTests;
  }
  
  mapActionToQWord(action) {
    const mapping = {
      'click': 'ClickText',
      'fill': 'Fill',
      'type': 'Fill',
      'select': 'Select',
      'check': 'Check',
      'uncheck': 'Uncheck',
      'assert': 'AssertText',
      'verify': 'AssertText',
      'navigate': 'GoTo',
      'wait': 'Wait',
      'hover': 'Hover'
    };
    return mapping[action?.toLowerCase()] || 'ClickText';
  }
  
  buildArgs(step) {
    const args = [step.target];
    if (step.value) {
      args.push(step.value);
    }
    return args;
  }
  
  // ==========================================================================
  // MAIN GENERATION METHODS
  // ==========================================================================
  
  /**
   * Generate tests for a single page
   */
  async generateForPage(url) {
    this.log('Generating tests for:', url);
    this.onProgress({ type: 'page_start', url });
    
    try {
      // Navigate to the page
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
      await this.page.waitForTimeout(1000); // Let dynamic content load
      
      // Get accessibility snapshot
      const snapshot = await this.getAccessibilitySnapshot();
      this.log('Got snapshot with', JSON.stringify(snapshot).length, 'chars');
      
      // AI analysis
      this.onProgress({ type: 'analyzing', url });
      const analysis = await this.analyzePage(snapshot, url);
      this.log('AI analysis complete:', analysis.pageType);
      
      // Convert to Flowstral format
      const tests = this.convertToFlowstralFormat(analysis, url);
      this.log('Generated', tests.length, 'tests');
      
      // Store results
      this.generatedTests.push(...tests);
      
      // Emit events
      for (const test of tests) {
        this.onTestGenerated(test);
      }
      
      this.onProgress({ 
        type: 'page_complete', 
        url, 
        testsGenerated: tests.length,
        pageType: analysis.pageType
      });
      
      return {
        url,
        analysis,
        tests,
        links: analysis.links || []
      };
      
    } catch (error) {
      this.log('Error generating tests:', error.message);
      this.errors.push({ url, error: error.message });
      this.onError({ url, error: error.message });
      return { url, error: error.message, tests: [], links: [] };
    }
  }
  
  /**
   * Crawl and generate tests for multiple pages
   */
  async crawlAndGenerate(startUrl) {
    this.log('Starting crawl from:', startUrl);
    this.onProgress({ type: 'crawl_start', startUrl, maxPages: this.maxPages });
    
    const queue = [startUrl];
    const baseHost = new URL(startUrl).host;
    
    while (queue.length > 0 && this.visitedUrls.size < this.maxPages) {
      const url = queue.shift();
      
      // Skip if already visited
      if (this.visitedUrls.has(url)) continue;
      this.visitedUrls.add(url);
      
      // Generate tests for this page
      const result = await this.generateForPage(url);
      
      // Add discovered links to queue
      if (result.links) {
        for (const link of result.links) {
          try {
            const fullUrl = new URL(link, url).href;
            const linkHost = new URL(fullUrl).host;
            
            // Only follow internal links
            if (linkHost === baseHost && !this.visitedUrls.has(fullUrl)) {
              queue.push(fullUrl);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
      
      this.onProgress({
        type: 'progress',
        visited: this.visitedUrls.size,
        maxPages: this.maxPages,
        queued: queue.length,
        testsGenerated: this.generatedTests.length
      });
    }
    
    this.onProgress({ 
      type: 'crawl_complete',
      pagesVisited: this.visitedUrls.size,
      testsGenerated: this.generatedTests.length,
      errors: this.errors.length
    });
    
    return {
      pagesVisited: Array.from(this.visitedUrls),
      tests: this.generatedTests,
      errors: this.errors
    };
  }
  
  /**
   * Generate tests for current page only (quick mode)
   */
  async generateForCurrentPage() {
    const url = this.page.url();
    return await this.generateForPage(url);
  }
  
  // ==========================================================================
  // VERIFICATION (Optional: Execute generated tests to verify they work)
  // ==========================================================================
  
  /**
   * Verify a generated test by executing it
   */
  async verifyTest(test) {
    this.log('Verifying test:', test.name);
    
    const results = [];
    
    for (const step of test.steps) {
      try {
        await this.executeStep(step);
        results.push({ step: step.description, passed: true });
      } catch (error) {
        results.push({ step: step.description, passed: false, error: error.message });
        break; // Stop on first failure
      }
    }
    
    const allPassed = results.every(r => r.passed);
    return { test: test.name, passed: allPassed, results };
  }
  
  async executeStep(step) {
    const target = step.args?.[0];
    const value = step.args?.[1];
    
    switch (step.qword) {
      case 'GoTo':
        await this.page.goto(target, { timeout: this.timeout });
        break;
        
      case 'ClickText':
        await this.page.getByText(target).first().click({ timeout: 5000 });
        break;
        
      case 'Fill':
        await this.page.getByLabel(target).or(this.page.getByPlaceholder(target)).first()
          .fill(value, { timeout: 5000 });
        break;
        
      case 'Select':
        // Try multiple strategies for select
        const trigger = this.page.getByLabel(target).or(this.page.getByRole('combobox', { name: target }));
        await trigger.first().click({ timeout: 5000 });
        await this.page.getByRole('option', { name: value }).or(this.page.getByText(value)).first()
          .click({ timeout: 5000 });
        break;
        
      case 'AssertText':
        await this.page.getByText(target).first().waitFor({ timeout: 5000 });
        break;
        
      case 'Wait':
        await this.page.waitForTimeout(parseInt(target) || 1000);
        break;
        
      default:
        this.log('Unknown step type:', step.qword);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  AITestGenerator
};
