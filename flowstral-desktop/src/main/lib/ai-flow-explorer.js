/**
 * AI Flow Explorer v2.1 - Autonomous Test Discovery & Coverage Engine
 * 
 * IMPROVED FEATURES:
 * 1. PRIORITIZES LOGIN FLOWS - Fills credentials before exploring
 * 2. HANDLES NEW TABS/WINDOWS - Popup detection and context switching
 * 3. HANDLES IFRAMES - Detection and switching
 * 4. SMART AI DECISIONS - Uses actual test data for authentication
 * 
 * @author Flowstral
 * @version 2.1.0
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ============================================================================
// PAGE NODE - Represents a single page in the application
// ============================================================================

class PageNode {
  constructor(url, title) {
    this.id = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.url = url;
    this.title = title;
    this.screenshot = null;
    this.elements = [];
    this.hiddenElements = [];
    this.navigationTriggers = [];
    this.outgoingEdges = [];
    this.incomingEdges = [];
    this.visited = false;
    this.fullyExplored = false;
    this.discoveredAt = new Date();
  }
}

// ============================================================================
// NAVIGATION EDGE - Represents a transition between pages
// ============================================================================

class NavigationEdge {
  constructor(fromPage, toPage, trigger) {
    this.id = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.fromPage = fromPage;
    this.toPage = toPage;
    this.trigger = trigger;
    this.action = trigger.action;
    this.steps = [];
    this.explored = false;
  }
}

// ============================================================================
// DISCOVERED ELEMENT
// ============================================================================

class DiscoveredElement {
  constructor(data) {
    this.id = `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.role = data.role;
    this.name = data.name;
    this.selector = data.selector;
    this.xpath = data.xpath;
    this.boundingBox = data.boundingBox;
    this.isVisible = data.isVisible;
    this.isHidden = data.isHidden;
    this.revealedBy = data.revealedBy;
    this.isNavigationTrigger = false;
    this.leadsTo = null;
    this.attributes = data.attributes || {};
    this.innerText = data.innerText;
    this.value = data.value;
    this.isInteractive = data.isInteractive;
    this.elementType = data.elementType;
  }
}

// ============================================================================
// AI FLOW EXPLORER CLASS
// ============================================================================

class AIFlowExplorer {
  constructor(page, options = {}) {
    this.page = page;
    this.browserContext = page.context();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.model = options.model || 'gpt-4o-mini';
    this.maxPages = options.maxPages || 50;
    this.maxActionsPerPage = options.maxActionsPerPage || 30;
    this.timeout = options.timeout || 15000;
    this.debug = options.debug || false;
    this.screenshotDir = options.screenshotDir || './screenshots';
    
    // Test data for form filling - THESE ARE THE USER'S CREDENTIALS
    this.testData = {
      email: options.testData?.email || 'test@example.com',
      username: options.testData?.username || options.testData?.email || 'testuser',
      password: options.testData?.password || 'Test123!@#',
      firstName: options.testData?.firstName || 'Test',
      lastName: options.testData?.lastName || 'User',
      phone: options.testData?.phone || '555-123-4567',
      search: options.testData?.search || 'test search',
      ...options.testData
    };
    
    this.log('Test data configured:', {
      email: this.testData.email,
      username: this.testData.username,
      passwordSet: !!this.testData.password
    });
    
    // Navigation graph
    this.pageGraph = new Map();
    this.edges = [];
    this.landingPage = null;
    
    // Exploration state
    this.currentPage = null;
    this.allPages = []; // Track all browser pages/tabs
    this.explorationQueue = [];
    this.exploredPaths = new Set();
    this.discoveredFlows = [];
    this.triedActions = new Set(); // Prevent repeating actions
    
    // Generated test cases
    this.testCases = [];
    this.currentFlow = [];
    
    // Coverage tracking
    this.coverage = {
      pagesDiscovered: 0,
      pagesFullyExplored: 0,
      elementsDiscovered: 0,
      hiddenElementsFound: 0,
      navigationPathsFound: 0,
      flowsGenerated: 0,
      assertionsCreated: 0,
      popupsHandled: 0,
      iframesFound: 0
    };
    
    // Callbacks
    this.onPageDiscovered = options.onPageDiscovered || (() => {});
    this.onElementDiscovered = options.onElementDiscovered || (() => {});
    this.onFlowComplete = options.onFlowComplete || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onTestGenerated = options.onTestGenerated || (() => {});
    this.onError = options.onError || (() => {});
    
    this.shouldStop = false;
    
    // Ensure screenshot directory
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
    
    // Setup popup handler
    this.setupPopupHandler();
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[AIFlowExplorer]', ...args);
    }
  }
  
  stop() {
    this.shouldStop = true;
  }
  
  // ==========================================================================
  // POPUP/NEW TAB HANDLING
  // ==========================================================================
  
  setupPopupHandler() {
    this.browserContext.on('page', async (newPage) => {
      this.log('NEW POPUP/TAB DETECTED!');
      this.coverage.popupsHandled++;
      this.allPages.push(newPage);
      
      try {
        await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
        const url = newPage.url();
        const title = await newPage.title();
        
        this.log('New tab URL:', url, 'Title:', title);
        
        // Add to page graph
        this.addPageToGraph(url, title);
        
        this.onProgress({
          type: 'popup_detected',
          url,
          title,
          totalTabs: this.allPages.length
        });
      } catch (e) {
        this.log('Error handling popup:', e.message);
      }
    });
  }
  
  /**
   * Switch to a specific page/tab
   */
  async switchToPage(page) {
    this.page = page;
    await page.bringToFront();
    this.log('Switched to page:', page.url());
  }
  
  /**
   * Get all open pages/tabs
   */
  getAllPages() {
    return this.browserContext.pages();
  }
  
  /**
   * Handle new popup and return it
   */
  async waitForPopup(action) {
    const [newPage] = await Promise.all([
      this.browserContext.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      action()
    ]);
    
    if (newPage) {
      this.log('Captured popup during action');
      await newPage.waitForLoadState('domcontentloaded');
      return newPage;
    }
    return null;
  }
  
  // ==========================================================================
  // IFRAME HANDLING
  // ==========================================================================
  
  /**
   * Find all iframes on the page
   */
  async findIframes() {
    const iframes = [];
    
    try {
      const frameLocators = this.page.frameLocator('iframe, frame');
      const frames = this.page.frames();
      
      for (const frame of frames) {
        if (frame !== this.page.mainFrame()) {
          const url = frame.url();
          const name = frame.name();
          
          iframes.push({
            frame,
            url,
            name,
            isAccessible: true
          });
          
          this.log('Found iframe:', name || url);
        }
      }
      
      this.coverage.iframesFound += iframes.length;
    } catch (e) {
      this.log('Error finding iframes:', e.message);
    }
    
    return iframes;
  }
  
  /**
   * Get elements from an iframe
   */
  async getIframeElements(frame) {
    try {
      return await frame.evaluate(() => {
        const elements = [];
        const interactive = document.querySelectorAll(
          'a, button, input, select, textarea, [role="button"], [role="link"], [onclick]'
        );
        
        interactive.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            elements.push({
              name: el.innerText?.trim().substring(0, 100) || 
                    el.getAttribute('aria-label') || 
                    el.getAttribute('placeholder') || '',
              selector: el.id ? `#${el.id}` : null,
              elementType: el.tagName.toLowerCase(),
              isInIframe: true
            });
          }
        });
        
        return elements;
      });
    } catch (e) {
      this.log('Error getting iframe elements:', e.message);
      return [];
    }
  }
  
  // ==========================================================================
  // SCREENSHOT & VISUAL ANALYSIS
  // ==========================================================================
  
  async takeScreenshot(name) {
    const filename = `${name}_${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    
    try {
      await this.page.screenshot({ path: filepath, fullPage: true });
      this.log('Screenshot saved:', filepath);
      return filepath;
    } catch (e) {
      this.log('Screenshot failed:', e.message);
      return null;
    }
  }
  
  // ==========================================================================
  // ELEMENT DISCOVERY
  // ==========================================================================
  
  async discoverAllElements() {
    this.log('Discovering all elements...');
    
    const visibleElements = await this.getVisibleElements();
    this.log(`Found ${visibleElements.length} visible elements`);
    
    const hiddenElements = await this.discoverHiddenElements(visibleElements);
    this.log(`Found ${hiddenElements.length} hidden elements`);
    
    // Check for iframes and their elements
    const iframes = await this.findIframes();
    let iframeElements = [];
    for (const iframe of iframes) {
      const els = await this.getIframeElements(iframe.frame);
      iframeElements = iframeElements.concat(els);
    }
    this.log(`Found ${iframeElements.length} elements in iframes`);
    
    const allElements = [...visibleElements, ...hiddenElements, ...iframeElements];
    await this.identifyNavigationTriggers(allElements);
    
    this.coverage.elementsDiscovered += visibleElements.length;
    this.coverage.hiddenElementsFound += hiddenElements.length;
    
    return { 
      visible: visibleElements, 
      hidden: hiddenElements, 
      iframe: iframeElements,
      all: allElements 
    };
  }
  
  async getVisibleElements() {
    return await this.page.evaluate(() => {
      const elements = [];
      
      const selectors = [
        'a[href]', 'button', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
        '[role="checkbox"]', '[role="radio"]', '[role="combobox"]', '[role="listbox"]',
        '[onclick]', '[tabindex]:not([tabindex="-1"])',
        '[data-testid]', '.btn', '.button', '.nav-link'
      ];
      
      const foundElements = document.querySelectorAll(selectors.join(', '));
      
      foundElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = rect.width > 0 && rect.height > 0 && 
                          style.display !== 'none' && 
                          style.visibility !== 'hidden';
        
        if (!isVisible) return;
        
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || tag;
        const name = el.getAttribute('aria-label') || 
                     el.getAttribute('title') ||
                     el.getAttribute('placeholder') ||
                     el.innerText?.trim().substring(0, 100) || '';
        
        // Determine element type
        let elementType = 'unknown';
        const inputType = el.type?.toLowerCase() || '';
        
        if (tag === 'a' || role === 'link') elementType = 'link';
        else if (tag === 'button' || role === 'button') elementType = 'button';
        else if (tag === 'input') {
          if (inputType === 'checkbox') elementType = 'checkbox';
          else if (inputType === 'radio') elementType = 'radio';
          else if (inputType === 'submit') elementType = 'submit';
          else if (inputType === 'email') elementType = 'email';
          else if (inputType === 'password') elementType = 'password';
          else if (inputType === 'text' || !inputType) elementType = 'text';
          else elementType = 'input';
        }
        else if (tag === 'select') elementType = 'dropdown';
        else if (tag === 'textarea') elementType = 'textarea';
        else if (role === 'tab') elementType = 'tab';
        else if (role === 'checkbox') elementType = 'checkbox';
        else if (role === 'radio') elementType = 'radio';
        
        // Build best selector
        let selector = '';
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.name && (tag === 'input' || tag === 'select')) {
          selector = `[name="${el.name}"]`;
        } else if (el.getAttribute('data-testid')) {
          selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
        } else if (el.className && typeof el.className === 'string' && el.className.trim()) {
          selector = `${tag}.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`;
        } else {
          selector = tag;
        }
        
        // Check if login-related
        const isLoginRelated = /log.?in|sign.?in|username|email|password|submit/i.test(
          name + ' ' + el.name + ' ' + el.id + ' ' + el.placeholder
        );
        
        const href = el.getAttribute('href');
        const isNavigationTrigger = 
          (href && !href.startsWith('#') && !href.startsWith('javascript:')) ||
          el.type === 'submit' ||
          /login|sign.?in|submit|continue|next|search/i.test(name);
        
        elements.push({
          role,
          name,
          selector,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          isVisible: true,
          isHidden: false,
          isNavigationTrigger: !!isNavigationTrigger,
          leadsTo: href || null,
          attributes: {
            href,
            type: inputType,
            name: el.name,
            id: el.id,
            placeholder: el.placeholder
          },
          innerText: (el.innerText || '').substring(0, 200),
          value: el.value || null,
          elementType,
          isLoginRelated,
          inputName: el.name || el.id || ''
        });
      });
      
      return elements;
    });
  }
  
  async discoverHiddenElements(visibleElements) {
    const hiddenElements = [];
    
    const triggers = visibleElements.filter(el => 
      el.elementType === 'dropdown' ||
      el.name.toLowerCase().includes('menu') ||
      el.attributes.class?.includes('dropdown')
    );
    
    for (const trigger of triggers.slice(0, 5)) {
      try {
        const locator = trigger.selector ? 
          this.page.locator(trigger.selector).first() :
          this.page.getByText(trigger.name, { exact: true }).first();
        
        if (await locator.count() === 0) continue;
        
        await locator.hover({ timeout: 2000 });
        await this.page.waitForTimeout(300);
        
        const newElements = await this.page.evaluate((triggerSelector) => {
          const newEls = [];
          const dropdowns = document.querySelectorAll(
            '[role="menu"], [role="listbox"], .dropdown-menu, [aria-expanded="true"] ~ *'
          );
          
          dropdowns.forEach(dropdown => {
            const items = dropdown.querySelectorAll('[role="menuitem"], [role="option"], a, button');
            items.forEach(item => {
              const rect = item.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                newEls.push({
                  role: item.getAttribute('role') || 'menuitem',
                  name: item.innerText?.trim().substring(0, 100) || '',
                  isHidden: true,
                  revealedBy: triggerSelector,
                  elementType: 'menuitem'
                });
              }
            });
          });
          
          return newEls;
        }, trigger.selector);
        
        hiddenElements.push(...newElements.filter(el => 
          el.name && !hiddenElements.find(h => h.name === el.name)
        ));
        
        await this.page.mouse.move(0, 0);
        await this.page.waitForTimeout(200);
      } catch (e) {
        this.log('Hidden element discovery error:', e.message);
      }
    }
    
    return hiddenElements;
  }
  
  async identifyNavigationTriggers(elements) {
    const patterns = [
      /login|sign.?in|log.?in/i,
      /register|sign.?up/i,
      /submit|continue|next/i,
      /forgot.?password/i
    ];
    
    for (const el of elements) {
      if (el.isNavigationTrigger) continue;
      
      const matchesPattern = patterns.some(p => 
        p.test(el.name || '') || p.test(el.innerText || '')
      );
      
      if (matchesPattern || el.attributes?.type === 'submit') {
        el.isNavigationTrigger = true;
      }
    }
  }
  
  // ==========================================================================
  // SMART LOGIN DETECTION & HANDLING
  // ==========================================================================
  
  /**
   * Detect if current page is a login page and handle it
   */
  async detectAndHandleLoginPage(elements) {
    this.log('Checking if this is a login page...');
    
    // Find login-related fields (with safe property access)
    const emailField = elements.find(el => 
      el.elementType === 'email' || 
      (el.elementType === 'text' && /email|user/i.test(el.inputName || el.name || el.attributes?.placeholder || ''))
    );
    
    const passwordField = elements.find(el => 
      el.elementType === 'password' || 
      /password/i.test(el.inputName || el.attributes?.placeholder || '')
    );
    
    const loginButton = elements.find(el => 
      (el.elementType === 'button' || el.elementType === 'submit') &&
      /log.?in|sign.?in|submit/i.test(el.name || el.innerText || '')
    );
    
    const isLoginPage = emailField && passwordField;
    
    if (isLoginPage) {
      this.log('LOGIN PAGE DETECTED!');
      this.log('Email field:', emailField?.selector || emailField?.name);
      this.log('Password field:', passwordField?.selector || passwordField?.name);
      this.log('Login button:', loginButton?.name);
      
      return {
        isLoginPage: true,
        emailField,
        passwordField,
        loginButton
      };
    }
    
    return { isLoginPage: false };
  }
  
  /**
   * Perform login with configured credentials
   */
  async performLogin(loginInfo) {
    const { emailField, passwordField, loginButton } = loginInfo;
    const steps = [];
    
    this.log('PERFORMING LOGIN with credentials...');
    this.log('Using email:', this.testData.email);
    
    try {
      // Fill email/username
      if (emailField) {
        const emailLocator = emailField.selector ? 
          this.page.locator(emailField.selector).first() :
          this.page.getByRole('textbox', { name: /email|user/i }).first();
        
        await emailLocator.fill(this.testData.email || this.testData.username);
        steps.push(this.actionToStep('fill', emailField, this.testData.email));
        this.log('Filled email:', this.testData.email);
        await this.page.waitForTimeout(300);
      }
      
      // Fill password
      if (passwordField) {
        const pwdLocator = passwordField.selector ?
          this.page.locator(passwordField.selector).first() :
          this.page.locator('input[type="password"]').first();
        
        await pwdLocator.fill(this.testData.password);
        steps.push(this.actionToStep('fill', passwordField, '****'));
        this.log('Filled password');
        await this.page.waitForTimeout(300);
      }
      
      // Click login button
      if (loginButton) {
        const beforeUrl = this.page.url();
        
        // Check if clicking might open a popup
        const popup = await this.waitForPopup(async () => {
          const btnLocator = loginButton.selector ?
            this.page.locator(loginButton.selector).first() :
            this.page.getByRole('button', { name: /log.?in|sign.?in/i }).first();
          
          await btnLocator.click();
        });
        
        if (popup) {
          this.log('Login opened new tab/window');
          await this.switchToPage(popup);
        }
        
        steps.push(this.actionToStep('click', loginButton));
        this.log('Clicked login button');
        
        // Wait for navigation
        await this.page.waitForTimeout(3000);
        
        const afterUrl = this.page.url();
        if (beforeUrl !== afterUrl) {
          this.log('Navigation after login: ', beforeUrl, '->', afterUrl);
          return { success: true, steps, navigated: true, newUrl: afterUrl };
        }
      }
      
      return { success: true, steps, navigated: false };
      
    } catch (error) {
      this.log('Login failed:', error.message);
      return { success: false, error: error.message, steps };
    }
  }
  
  // ==========================================================================
  // PAGE GRAPH BUILDING
  // ==========================================================================
  
  addPageToGraph(url, title) {
    const normalizedUrl = this.normalizeUrl(url);
    
    if (this.pageGraph.has(normalizedUrl)) {
      return this.pageGraph.get(normalizedUrl);
    }
    
    const pageNode = new PageNode(normalizedUrl, title);
    this.pageGraph.set(normalizedUrl, pageNode);
    this.coverage.pagesDiscovered++;
    
    this.onPageDiscovered({
      url: normalizedUrl,
      title,
      totalPages: this.pageGraph.size
    });
    
    return pageNode;
  }
  
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      let normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
      return normalized;
    } catch {
      return url;
    }
  }
  
  addEdge(fromPage, toPage, trigger, steps) {
    const edge = new NavigationEdge(fromPage, toPage, trigger);
    edge.steps = steps;
    
    fromPage.outgoingEdges.push(edge);
    toPage.incomingEdges.push(edge);
    this.edges.push(edge);
    this.coverage.navigationPathsFound++;
    
    return edge;
  }
  
  // ==========================================================================
  // ASSERTIONS
  // ==========================================================================
  
  async generateAssertions(pageNode, elements) {
    const assertions = [];
    
    const title = await this.page.title();
    if (title) {
      assertions.push({
        type: 'title',
        qword: 'AssertTitle',
        args: [title],
        description: `Verify page title is "${title}"`
      });
    }
    
    const url = this.page.url();
    assertions.push({
      type: 'url',
      qword: 'AssertUrl',
      args: [url],
      description: `Verify URL is "${url}"`
    });
    
    this.coverage.assertionsCreated += assertions.length;
    return assertions;
  }
  
  // ==========================================================================
  // STEP CONVERSION
  // ==========================================================================
  
  actionToStep(action, element, value) {
    const step = {
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: 'ai-flow-explorer'
    };
    
    switch (action) {
      case 'click':
        step.qword = element.elementType === 'link' ? 'ClickText' : 'ClickElement';
        step.args = [element.name || element.selector];
        step.description = `Click "${element.name || element.selector}"`;
        step.selector = element.selector;
        break;
        
      case 'fill':
        step.qword = 'Fill';
        step.args = [element.name || element.selector, value];
        step.description = `Fill "${element.name}" with "${value}"`;
        step.selector = element.selector;
        break;
        
      case 'select':
        step.qword = 'Select';
        step.args = [element.name || element.selector, value];
        step.description = `Select "${value}" from "${element.name}"`;
        step.selector = element.selector;
        break;
        
      case 'check':
        step.qword = 'Check';
        step.args = [element.name || element.selector];
        step.description = `Check "${element.name}"`;
        step.selector = element.selector;
        break;
        
      case 'navigate':
        step.qword = 'GoTo';
        step.args = [value];
        step.description = `Navigate to ${value}`;
        break;
        
      default:
        step.qword = 'ClickText';
        step.args = [element.name];
    }
    
    return step;
  }
  
  // ==========================================================================
  // MAIN EXPLORATION ENGINE
  // ==========================================================================
  
  async explore(landingPageUrl) {
    this.log('Starting SMART flow exploration from:', landingPageUrl);
    this.log('Test credentials:', { email: this.testData.email, passwordSet: !!this.testData.password });
    this.shouldStop = false;
    
    try {
      // Navigate to landing page
      await this.page.goto(landingPageUrl, { 
        waitUntil: 'networkidle',
        timeout: this.timeout 
      });
      await this.page.waitForTimeout(1000);
      
      // Create landing page node
      const title = await this.page.title();
      this.landingPage = this.addPageToGraph(landingPageUrl, title);
      this.currentPage = this.landingPage;
      
      // Take initial screenshot
      this.landingPage.screenshot = await this.takeScreenshot('landing');
      
      // Discover all elements
      const { all: elements, visible, hidden, iframe } = await this.discoverAllElements();
      this.landingPage.elements = visible;
      this.landingPage.hiddenElements = hidden;
      this.landingPage.navigationTriggers = elements.filter(e => e.isNavigationTrigger);
      
      this.onProgress({
        type: 'landing_analyzed',
        url: landingPageUrl,
        elements: elements.length,
        visibleElements: visible.length,
        hiddenElements: hidden.length,
        iframeElements: iframe.length,
        navigationTriggers: this.landingPage.navigationTriggers.length
      });
      
      // **SMART LOGIN HANDLING** - Check if this is a login page
      const loginInfo = await this.detectAndHandleLoginPage(elements);
      
      if (loginInfo.isLoginPage && this.testData.email && this.testData.password) {
        this.log('** ATTEMPTING LOGIN FIRST **');
        
        const loginResult = await this.performLogin(loginInfo);
        
        if (loginResult.navigated) {
          // Successfully logged in - add new page
          const newTitle = await this.page.title();
          const newUrl = this.page.url();
          const newPage = this.addPageToGraph(newUrl, newTitle);
          
          // Record the login flow
          this.addEdge(this.landingPage, newPage, {
            name: 'Login Flow',
            action: 'login',
            elementType: 'flow'
          }, loginResult.steps);
          
          // Continue exploring from logged-in state
          await this.exploreCurrentPage(newPage);
        } else {
          this.log('Login did not navigate - might need verification or failed');
          // Still explore non-login triggers
          await this.exploreNonLoginTriggers();
        }
      } else {
        // Not a login page - explore all triggers
        for (const trigger of this.landingPage.navigationTriggers) {
          this.explorationQueue.push({
            fromPage: this.landingPage,
            trigger,
            depth: 0
          });
        }
        
        await this.explorationLoop();
      }
      
      // Generate test cases
      await this.generateTestCases();
      
      return {
        success: true,
        coverage: this.coverage,
        pageGraph: this.serializePageGraph(),
        testCases: this.testCases,
        flows: this.discoveredFlows
      };
      
    } catch (error) {
      this.log('Exploration error:', error);
      this.onError({ error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Explore non-login navigation triggers
   */
  async exploreNonLoginTriggers() {
    const nonLoginTriggers = this.landingPage.navigationTriggers.filter(t => 
      !/log.?in|sign.?in|password|email|username/i.test(t.name || '')
    );
    
    for (const trigger of nonLoginTriggers) {
      this.explorationQueue.push({
        fromPage: this.landingPage,
        trigger,
        depth: 0
      });
    }
    
    await this.explorationLoop();
  }
  
  /**
   * Explore the current page after navigation
   */
  async exploreCurrentPage(pageNode) {
    this.log('Exploring page:', pageNode.url);
    
    // Take screenshot
    pageNode.screenshot = await this.takeScreenshot(`page_${this.pageGraph.size}`);
    
    // Discover elements
    const { all: elements, visible, hidden } = await this.discoverAllElements();
    pageNode.elements = visible;
    pageNode.hiddenElements = hidden;
    pageNode.navigationTriggers = elements.filter(e => e.isNavigationTrigger);
    
    // Check for login page (might have been redirected)
    const loginInfo = await this.detectAndHandleLoginPage(elements);
    if (loginInfo.isLoginPage) {
      this.log('Reached a login page - skipping further exploration from here');
      return;
    }
    
    // Add new navigation triggers to queue
    for (const trigger of pageNode.navigationTriggers) {
      const actionKey = `${pageNode.url}->${trigger.name}`;
      if (!this.exploredPaths.has(actionKey) && !this.triedActions.has(actionKey)) {
        this.explorationQueue.push({
          fromPage: pageNode,
          trigger,
          depth: 1
        });
      }
    }
    
    pageNode.fullyExplored = true;
    this.coverage.pagesFullyExplored++;
    
    // Continue exploration
    await this.explorationLoop();
  }
  
  /**
   * Main exploration loop
   */
  async explorationLoop() {
    while (this.explorationQueue.length > 0 && !this.shouldStop) {
      const { fromPage, trigger, depth } = this.explorationQueue.shift();
      
      if (depth > 5) continue;
      if (this.pageGraph.size >= this.maxPages) break;
      
      const actionKey = `${fromPage.url}->${trigger.name}`;
      if (this.triedActions.has(actionKey)) continue;
      this.triedActions.add(actionKey);
      
      this.log(`Exploring: "${trigger.name}" from ${fromPage.title}`);
      
      try {
        // Ensure we're on the right page
        const currentUrl = this.normalizeUrl(this.page.url());
        if (currentUrl !== fromPage.url) {
          await this.navigateToPage(fromPage);
        }
        
        const flowSteps = [];
        
        // Handle hidden elements
        if (trigger.isHidden && trigger.revealedBy) {
          await this.page.locator(trigger.revealedBy).first().hover({ timeout: 3000 });
          await this.page.waitForTimeout(300);
        }
        
        const beforeUrl = this.page.url();
        const beforePages = this.getAllPages().length;
        
        // Perform action with popup detection
        const popup = await this.waitForPopup(async () => {
          await this.performAction(trigger);
        });
        
        // Handle new popup
        if (popup) {
          this.log('Action opened new tab!');
          await this.switchToPage(popup);
        }
        
        await this.page.waitForTimeout(1500);
        
        const afterUrl = this.page.url();
        const afterPages = this.getAllPages().length;
        
        // Check if new tab was opened
        if (afterPages > beforePages) {
          this.log('New tab detected after action');
        }
        
        // Navigation occurred
        if (beforeUrl !== afterUrl || popup) {
          const newTitle = await this.page.title();
          const newUrl = this.page.url();
          const newPage = this.addPageToGraph(newUrl, newTitle);
          
          flowSteps.push(this.actionToStep('click', trigger));
          this.addEdge(fromPage, newPage, trigger, flowSteps);
          
          // Explore new page if not done
          if (!newPage.fullyExplored) {
            await this.exploreCurrentPage(newPage);
          }
          
          this.exploredPaths.add(actionKey);
          
          this.onProgress({
            type: 'page_explored',
            fromUrl: fromPage.url,
            toUrl: newUrl,
            trigger: trigger.name,
            totalPages: this.pageGraph.size
          });
        }
        
      } catch (error) {
        this.log('Error exploring trigger:', error.message);
        this.exploredPaths.add(actionKey);
      }
    }
  }
  
  async navigateToPage(pageNode) {
    await this.page.goto(pageNode.url, { 
      waitUntil: 'domcontentloaded',
      timeout: this.timeout 
    });
    await this.page.waitForTimeout(500);
  }
  
  async performAction(element) {
    const locators = [
      () => element.selector ? this.page.locator(element.selector).first() : null,
      () => this.page.getByRole(element.role, { name: element.name }).first(),
      () => this.page.getByText(element.name, { exact: false }).first(),
      () => this.page.locator(`text="${element.name}"`).first()
    ];
    
    for (const getLocator of locators) {
      try {
        const locator = getLocator();
        if (!locator) continue;
        
        const count = await locator.count();
        if (count > 0) {
          await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
          await locator.click({ timeout: 5000 });
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error(`Could not interact with: ${element.name}`);
  }
  
  // ==========================================================================
  // TEST GENERATION
  // ==========================================================================
  
  async generateTestCases() {
    this.log('Generating test cases...');
    
    for (const edge of this.edges) {
      const testCase = {
        id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${edge.trigger.name}`,
        description: `Test: ${edge.fromPage.title} → ${edge.toPage.title}`,
        steps: [
          this.actionToStep('navigate', {}, edge.fromPage.url),
          ...edge.steps
        ],
        assertions: [],
        priority: 'medium',
        generated: true,
        source: 'ai-flow-explorer'
      };
      
      this.testCases.push(testCase);
      this.onTestGenerated(testCase);
    }
    
    this.coverage.flowsGenerated = this.testCases.length;
    return this.testCases;
  }
  
  serializePageGraph() {
    const nodes = [];
    const edges = [];
    
    for (const [url, page] of this.pageGraph) {
      nodes.push({
        id: page.id,
        url: page.url,
        title: page.title,
        elementCount: page.elements?.length || 0,
        hiddenElementCount: page.hiddenElements?.length || 0,
        navigationTriggerCount: page.navigationTriggers?.length || 0,
        screenshot: page.screenshot,
        fullyExplored: page.fullyExplored
      });
    }
    
    for (const edge of this.edges) {
      edges.push({
        id: edge.id,
        from: edge.fromPage.id,
        to: edge.toPage.id,
        trigger: edge.trigger.name,
        stepCount: edge.steps?.length || 0
      });
    }
    
    return { nodes, edges };
  }
  
  // ==========================================================================
  // MANUAL TEST AUTOMATION
  // ==========================================================================
  
  async automateManualTestCase(description) {
    this.log('Automating manual test:', description);
    
    const prompt = `Convert this manual test case to automation steps:

MANUAL TEST:
${description}

TEST DATA AVAILABLE:
${Object.entries(this.testData).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Return JSON:
{"steps": [{"action": "navigate|click|fill|select|check", "target": "<element>", "value": "<value if needed>", "description": "<step>"}]}`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: 'Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const result = JSON.parse(response.data.choices[0].message.content);
      const steps = result.steps || [];
      
      return {
        success: true,
        steps: steps.map(s => ({
          qword: this.actionToQWord(s.action),
          args: [s.target, s.value].filter(Boolean),
          description: s.description
        }))
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  actionToQWord(action) {
    return { navigate: 'GoTo', click: 'ClickText', fill: 'Fill', select: 'Select', check: 'Check' }[action] || 'ClickText';
  }
}

module.exports = {
  AIFlowExplorer,
  PageNode,
  NavigationEdge,
  DiscoveredElement
};
