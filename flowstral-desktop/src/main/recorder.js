/**
 * Recorder Engine
 * 
 * Captures user interactions in the browser and converts them to test steps.
 * Supports intelligent element detection with fallback selectors.
 */

class RecorderEngine {
  constructor(options = {}) {
    this.browserController = options.browserController;
    this.onAction = options.onAction || (() => {});
    this.onScreenshot = options.onScreenshot || (() => {});
    
    this.recording = false;
    this.actions = [];
    this.screenshotInterval = null;
    this.injectedScript = null;
    
    // Build the recorder injection script
    this.buildInjectionScript();
  }

  /**
   * Build the script to inject into the page
   */
  buildInjectionScript() {
    this.injectedScript = `
    (function() {
      if (window.__flowstralRecorderInitialized__) return;
      window.__flowstralRecorderInitialized__ = true;
      window.__flowstralRecordedActions__ = window.__flowstralRecordedActions__ || [];

      function getElementInfo(el) {
        if (!el || !el.tagName) return null;
        
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        
        // Get best selector
        const selectors = [];
        
        // ID selector
        if (el.id) {
          selectors.push({ type: 'id', value: '#' + CSS.escape(el.id), confidence: 1.0 });
        }
        
        // Data-testid
        if (el.dataset.testid) {
          selectors.push({ type: 'testid', value: '[data-testid="' + el.dataset.testid + '"]', confidence: 0.95 });
        }
        
        // Name attribute
        if (el.name) {
          selectors.push({ type: 'name', value: '[name="' + el.name + '"]', confidence: 0.9 });
        }
        
        // Role + text
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const text = (el.innerText || el.value || '').trim().substring(0, 50);
        if (text) {
          selectors.push({ type: 'text', value: text, role: role, confidence: 0.85 });
        }
        
        // Aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          selectors.push({ type: 'aria', value: '[aria-label="' + ariaLabel + '"]', confidence: 0.88 });
        }
        
        // Placeholder
        if (el.placeholder) {
          selectors.push({ type: 'placeholder', value: '[placeholder="' + el.placeholder + '"]', confidence: 0.82 });
        }
        
        // CSS path as fallback
        const cssPath = getCSSPath(el);
        selectors.push({ type: 'css', value: cssPath, confidence: 0.6 });
        
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          text: text,
          value: el.value,
          type: el.type,
          name: el.name,
          href: el.href,
          placeholder: el.placeholder,
          ariaLabel: ariaLabel,
          selectors: selectors,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          visible: styles.display !== 'none' && styles.visibility !== 'hidden'
        };
      }

      function getCSSPath(el) {
        if (!(el instanceof Element)) return '';
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
          let selector = el.nodeName.toLowerCase();
          if (el.id) {
            selector += '#' + CSS.escape(el.id);
            path.unshift(selector);
            break;
          } else {
            let sibling = el;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
              if (sibling.nodeName.toLowerCase() === selector.split(':')[0]) nth++;
            }
            if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
          }
          path.unshift(selector);
          el = el.parentNode;
        }
        return path.join(' > ');
      }

      function recordAction(type, element, extra = {}) {
        const info = getElementInfo(element);
        if (!info) return;
        
        const action = {
          id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          type: type,
          timestamp: Date.now(),
          url: window.location.href,
          element: info,
          ...extra
        };
        
        window.__flowstralRecordedActions__.push(action);
        console.log('[Flowstral] Recorded:', action.type, info.text || info.selectors[0]?.value);
      }

      // Click handler
      document.addEventListener('click', function(e) {
        const el = e.target;
        if (el.closest('[data-flowstral-ignore]')) return;
        recordAction('click', el);
      }, true);

      // Input change handler (on blur to avoid recording every keystroke)
      document.addEventListener('change', function(e) {
        const el = e.target;
        if (el.closest('[data-flowstral-ignore]')) return;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          recordAction('fill', el, { value: el.value });
        }
      }, true);

      // Form submit handler
      document.addEventListener('submit', function(e) {
        const el = e.target;
        recordAction('submit', el);
      }, true);

      // Navigation detection
      let lastUrl = window.location.href;
      setInterval(function() {
        if (window.location.href !== lastUrl) {
          window.__flowstralRecordedActions__.push({
            id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'navigate',
            timestamp: Date.now(),
            url: window.location.href,
            fromUrl: lastUrl
          });
          lastUrl = window.location.href;
        }
      }, 500);

      // Handle shadow DOM
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.shadowRoot) {
              attachShadowListeners(node.shadowRoot);
            }
          });
        });
      });

      function attachShadowListeners(root) {
        root.addEventListener('click', function(e) {
          recordAction('click', e.target);
        }, true);
        root.addEventListener('change', function(e) {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            recordAction('fill', e.target, { value: e.target.value });
          }
        }, true);
      }

      observer.observe(document.body, { childList: true, subtree: true });

      // Attach to existing shadow roots
      document.querySelectorAll('*').forEach(function(el) {
        if (el.shadowRoot) attachShadowListeners(el.shadowRoot);
      });

      console.log('[Flowstral] Recorder initialized');
    })();
    `;
  }

  /**
   * Start recording
   */
  async start(url) {
    if (this.recording) {
      return;
    }

    this.recording = true;
    this.actions = [];

    // Launch browser and navigate
    await this.browserController.launch();
    await this.browserController.navigate(url);
    
    // Inject recorder script
    await this.injectRecorder();
    
    // No screenshot streaming - user sees browser directly (like Copado)
    // this.startScreenshotCapture();
    
    // Start polling for actions
    this.startActionPolling();

    return { success: true, url };
  }

  /**
   * Inject recorder script into page
   */
  async injectRecorder() {
    const page = await this.browserController.getPage();
    
    // Inject into main frame
    await page.evaluate(this.injectedScript);
    
    // Re-inject on navigation
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        await page.evaluate(this.injectedScript).catch(() => {});
      }
    });
  }

  /**
   * Start polling for recorded actions
   */
  startActionPolling() {
    this.actionPollInterval = setInterval(async () => {
      if (!this.recording) return;
      if (!this.browserController.context) return;  // Don't poll if no browser
      
      try {
        const page = await this.browserController.getPage();
        
        const newActions = await page.evaluate(() => {
          const actions = window.__flowstralRecordedActions__ || [];
          window.__flowstralRecordedActions__ = [];
          return actions;
        });
        
        for (const action of newActions) {
          this.actions.push(action);
          this.onAction(action);
        }
      } catch (error) {
        // Page might be navigating, ignore
      }
    }, 500);
  }

  /**
   * Start screenshot capture
   */
  startScreenshotCapture() {
    this.screenshotInterval = setInterval(async () => {
      if (!this.recording) return;
      if (!this.browserController.context) return;  // Don't capture if no browser
      
      try {
        const screenshot = await this.browserController.screenshot();
        this.onScreenshot(screenshot);
      } catch (error) {
        // Browser might be busy, ignore
      }
    }, 2000);
  }

  /**
   * Stop recording
   */
  async stop() {
    this.recording = false;
    
    // Stop intervals
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    if (this.actionPollInterval) {
      clearInterval(this.actionPollInterval);
      this.actionPollInterval = null;
    }

    // Get final actions
    try {
      const page = await this.browserController.getPage();
      const finalActions = await page.evaluate(() => {
        const actions = window.__flowstralRecordedActions__ || [];
        window.__flowstralRecordedActions__ = [];
        return actions;
      });
      
      this.actions.push(...finalActions);
    } catch (error) {
      // Page might be closed
    }

    return {
      actions: this.actions,
      url: await this.browserController.getPage().then(p => p.url()).catch(() => '')
    };
  }

  /**
   * Get recorded actions
   */
  getActions() {
    return this.actions;
  }

  /**
   * Clear recorded actions
   */
  clearActions() {
    this.actions = [];
  }

  /**
   * Capture current screenshot
   */
  async captureScreenshot() {
    return await this.browserController.screenshot();
  }

  /**
   * Analyze current page
   */
  async analyzePage() {
    return await this.browserController.analyzePage();
  }

  /**
   * Execute a single step
   */
  async executeStep(step) {
    const page = await this.browserController.getPage();
    
    switch (step.type) {
      case 'navigate':
        await this.browserController.navigate(step.url);
        break;
        
      case 'click':
        await this.executeClick(step);
        break;
        
      case 'fill':
        await this.executeFill(step);
        break;
        
      case 'press':
        await this.browserController.press(step.key);
        break;
        
      case 'wait':
        await page.waitForTimeout(step.duration || 1000);
        break;
        
      case 'assert':
        await this.executeAssert(step);
        break;
        
      default:
        console.log(`[Recorder] Unknown step type: ${step.type}`);
    }
    
    await this.browserController.waitForReady();
  }

  /**
   * Execute click with intelligent selector fallback
   */
  async executeClick(step) {
    const page = await this.browserController.getPage();
    const selectors = step.element?.selectors || [];
    
    // Sort by confidence
    const sortedSelectors = [...selectors].sort((a, b) => b.confidence - a.confidence);
    
    for (const sel of sortedSelectors) {
      try {
        if (sel.type === 'text') {
          if (sel.role && sel.role !== sel.tagName) {
            await page.getByRole(sel.role, { name: sel.value }).click({ timeout: 5000 });
          } else {
            await page.getByText(sel.value).click({ timeout: 5000 });
          }
          return;
        } else {
          await page.locator(sel.value).click({ timeout: 5000 });
          return;
        }
      } catch {
        continue;
      }
    }
    
    throw new Error(`Click failed: No selector worked for element`);
  }

  /**
   * Execute fill with intelligent selector fallback
   */
  async executeFill(step) {
    const page = await this.browserController.getPage();
    const selectors = step.element?.selectors || [];
    const value = step.value || '';
    
    // Sort by confidence
    const sortedSelectors = [...selectors].sort((a, b) => b.confidence - a.confidence);
    
    for (const sel of sortedSelectors) {
      try {
        if (sel.type === 'placeholder') {
          await page.getByPlaceholder(sel.value.replace('[placeholder="', '').replace('"]', '')).fill(value, { timeout: 5000 });
          return;
        } else if (sel.type === 'aria') {
          const label = sel.value.match(/aria-label="(.+?)"/)?.[1];
          if (label) {
            await page.getByLabel(label).fill(value, { timeout: 5000 });
            return;
          }
        } else {
          await page.locator(sel.value).fill(value, { timeout: 5000 });
          return;
        }
      } catch {
        continue;
      }
    }
    
    throw new Error(`Fill failed: No selector worked for input`);
  }

  /**
   * Execute assertion
   */
  async executeAssert(step) {
    const page = await this.browserController.getPage();
    
    switch (step.assertType) {
      case 'text':
        await page.getByText(step.expected).waitFor({ state: 'visible', timeout: 10000 });
        break;
        
      case 'url':
        const url = page.url();
        if (!url.includes(step.expected)) {
          throw new Error(`URL assertion failed: Expected "${step.expected}" but got "${url}"`);
        }
        break;
        
      case 'element':
        await page.locator(step.selector).waitFor({ state: 'visible', timeout: 10000 });
        break;
        
      default:
        throw new Error(`Unknown assertion type: ${step.assertType}`);
    }
  }
}

module.exports = RecorderEngine;

