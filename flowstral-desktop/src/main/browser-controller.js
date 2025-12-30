/**
 * Browser Controller - Playwright Integration
 * 
 * Controls browser instances for recording and test execution.
 * Supports chromium, firefox, and webkit.
 */

const { chromium, firefox, webkit } = require('playwright');
const path = require('path');

class BrowserController {
  constructor(options = {}) {
    this.browserType = options.browserType || 'chromium';
    this.headless = options.headless ?? false;  // Visible by default for recording
    this.forceVisible = false;
    this.viewport = options.viewport || { width: 1280, height: 720 };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.launching = false;  // Prevent multiple simultaneous launches
    
    // User data directory for persistent sessions
    this.userDataDir = options.userDataDir || path.join(
      process.env.APPDATA || process.env.HOME,
      '.flowstral',
      'browser-data'
    );
  }

  /**
   * Toggle browser visibility (for MFA handling)
   */
  setVisible(visible) {
    this.forceVisible = visible;
  }

  /**
   * Get the browser launcher based on type
   */
  getBrowserLauncher() {
    switch (this.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }

  /**
   * Launch browser with persistent context (remembers sessions/MFA)
   */
  async launch() {
    // Already have a context
    if (this.context) {
      console.log('[Browser] Already have context, reusing');
      return this.context;
    }
    
    // Prevent multiple simultaneous launches
    if (this.launching) {
      console.log('[Browser] Launch already in progress, waiting...');
      // Wait for the current launch to complete (max 30 seconds)
      let waited = 0;
      while (this.launching && waited < 30000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }
      if (this.context) return this.context;
    }
    
    this.launching = true;
    console.log('[Browser] Starting launch...');

    try {
      const launcher = this.getBrowserLauncher();
      
      // ALWAYS visible for recording
      console.log('[Browser] Launching VISIBLE browser...');
      console.log('[Browser] User data dir:', this.userDataDir);
    
    this.context = await launcher.launchPersistentContext(this.userDataDir, {
      headless: false,  // ALWAYS visible
      viewport: this.viewport,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    });
    
    console.log('[Browser] Context created successfully');

    // Get or create the first page
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    // Add error handling
    this.page.on('pageerror', (error) => {
      console.error('[Browser] Page error:', error.message);
    });

    this.context.on('close', () => {
      this.context = null;
      this.page = null;
    });

    return this.context;
    } finally {
      this.launching = false;
    }
  }

  /**
   * Get current page or create new one
   */
  async getPage() {
    if (!this.context) {
      await this.launch();
    }
    
    if (!this.page || this.page.isClosed()) {
      this.page = await this.context.newPage();
    }
    
    return this.page;
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    const page = await this.getPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return page.url();
  }

  /**
   * Wait for page to be ready (no spinners, etc.)
   */
  async waitForReady(timeout = 15000) {
    const page = await this.getPage();
    
    // Wait for DOM content
    await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
    
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '.slds-spinner',
      'lightning-spinner',
      '[aria-busy="true"]',
      '.loading',
      '.spinner'
    ];
    
    const startTime = Date.now();
    while ((Date.now() - startTime) < timeout) {
      let hasLoading = false;
      
      for (const selector of loadingSelectors) {
        try {
          const visible = await page.locator(selector).first().isVisible({ timeout: 500 });
          if (visible) {
            hasLoading = true;
            break;
          }
        } catch {
          // Selector not found, continue
        }
      }
      
      if (!hasLoading) break;
      await page.waitForTimeout(300);
    }
    
    // Small buffer for any final rendering
    await page.waitForTimeout(200);
  }

  /**
   * Execute a click action
   */
  async click(selector, options = {}) {
    const page = await this.getPage();
    
    // Try multiple strategies
    const strategies = [
      () => page.locator(selector).first().click({ timeout: options.timeout || 10000 }),
      () => page.getByText(selector).first().click({ timeout: options.timeout || 10000 }),
      () => page.getByRole('button', { name: selector }).click({ timeout: options.timeout || 10000 }),
      () => page.getByRole('link', { name: selector }).click({ timeout: options.timeout || 10000 })
    ];
    
    for (const strategy of strategies) {
      try {
        await strategy();
        await this.waitForReady();
        return true;
      } catch {
        continue;
      }
    }
    
    throw new Error(`Click failed: Could not find element "${selector}"`);
  }

  /**
   * Execute a type/fill action
   */
  async fill(selector, value, options = {}) {
    const page = await this.getPage();
    
    // Try multiple strategies
    const strategies = [
      () => page.locator(selector).first().fill(value, { timeout: options.timeout || 10000 }),
      () => page.getByLabel(selector).first().fill(value, { timeout: options.timeout || 10000 }),
      () => page.getByPlaceholder(selector).first().fill(value, { timeout: options.timeout || 10000 }),
      () => page.getByRole('textbox', { name: selector }).fill(value, { timeout: options.timeout || 10000 })
    ];
    
    for (const strategy of strategies) {
      try {
        await strategy();
        await this.waitForReady();
        return true;
      } catch {
        continue;
      }
    }
    
    throw new Error(`Fill failed: Could not find input "${selector}"`);
  }

  /**
   * Press a key
   */
  async press(key) {
    const page = await this.getPage();
    await page.keyboard.press(key);
    await this.waitForReady();
  }

  /**
   * Capture screenshot
   */
  async screenshot(options = {}) {
    const page = await this.getPage();
    const buffer = await page.screenshot({
      type: 'png',
      fullPage: options.fullPage || false
    });
    return buffer.toString('base64');
  }

  /**
   * Get page info for analysis
   */
  async getPageInfo() {
    const page = await this.getPage();
    
    return await page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        forms: [],
        buttons: [],
        links: [],
        inputs: []
      };
      
      // Find forms
      document.querySelectorAll('form').forEach(form => {
        info.forms.push({
          id: form.id,
          action: form.action,
          method: form.method
        });
      });
      
      // Find buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(btn => {
        info.buttons.push({
          text: btn.innerText || btn.value,
          id: btn.id,
          name: btn.name,
          type: btn.type
        });
      });
      
      // Find links
      document.querySelectorAll('a').forEach(link => {
        info.links.push({
          text: link.innerText,
          href: link.href,
          id: link.id
        });
      });
      
      // Find inputs
      document.querySelectorAll('input, textarea, select').forEach(input => {
        info.inputs.push({
          type: input.type || input.tagName.toLowerCase(),
          id: input.id,
          name: input.name,
          placeholder: input.placeholder,
          label: input.labels?.[0]?.innerText
        });
      });
      
      return info;
    });
  }

  /**
   * Analyze page for suggested actions
   */
  async analyzePage() {
    const page = await this.getPage();
    const screenshot = await this.screenshot();
    const pageInfo = await this.getPageInfo();
    
    const suggestions = [];
    
    // Suggest clicking buttons
    for (const btn of pageInfo.buttons.slice(0, 5)) {
      if (btn.text) {
        suggestions.push({
          type: 'click',
          description: `Click "${btn.text}" button`,
          selector: btn.id ? `#${btn.id}` : `button:has-text("${btn.text}")`,
          confidence: 0.9
        });
      }
    }
    
    // Suggest filling inputs
    for (const input of pageInfo.inputs.slice(0, 5)) {
      if (input.type !== 'hidden' && input.type !== 'submit') {
        const desc = input.label || input.placeholder || input.name || 'input';
        suggestions.push({
          type: 'fill',
          description: `Enter text in "${desc}"`,
          selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
          confidence: 0.85
        });
      }
    }
    
    return {
      url: pageInfo.url,
      title: pageInfo.title,
      screenshot,
      suggestions,
      pageInfo
    };
  }

  /**
   * Close browser
   */
  async close() {
    console.log('[Browser] Closing...');
    
    if (this.context) {
      try {
        await this.context.close();
      } catch (e) {
        console.log('[Browser] Context close error:', e.message);
      }
      this.context = null;
      this.page = null;
    }
    
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log('[Browser] Browser close error:', e.message);
      }
      this.browser = null;
    }
    
    console.log('[Browser] Closed');
  }
}

module.exports = BrowserController;

