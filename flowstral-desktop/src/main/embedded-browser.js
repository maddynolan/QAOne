/**
 * Embedded Browser using Electron BrowserView
 * 
 * Robust recording matching the Flowstral web extension quality.
 * Uses the same QWord format for seamless integration with Test Builder.
 * 
 * IMPORTANT: Uses shared recorder-core.js from flowstral-extension for parity.
 * Do NOT duplicate recording logic - single source of truth!
 */

const { BrowserView, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Path to shared recorder engine (SINGLE SOURCE OF TRUTH)
const RECORDER_ENGINE_PATH = path.join(__dirname, '../../../flowstral-extension/src/lib/recorder-engine.js');
// Path to the ACTUAL content.js from browser extension
const CONTENT_JS_PATH = path.join(__dirname, '../../../flowstral-extension/src/content/content.js');

class EmbeddedBrowser {
  constructor(options = {}) {
    this.mainWindow = options.mainWindow;
    this.onAction = options.onAction || (() => {});
    this.onUrlChange = options.onUrlChange || (() => {});
    
    this.view = null;
    this.recording = false;
    this.actions = [];
    this.pollInterval = null;
    this.startUrl = null;  // Track starting URL for first GoTo step
    this.lastUserUrl = null;  // Track user-initiated navigation vs redirects
    this.backupActions = [];  // Store backup actions in main process (survives cross-domain navigation)
    
    // Persistent session for login/MFA persistence
    this.sessionName = 'flowstral-browser';
    
    console.log('[EmbeddedBrowser] Constructor called, mainWindow:', this.mainWindow ? 'SET' : 'NULL');
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  create() {
    if (this.view) return this.view;

    const persistentSession = session.fromPartition(`persist:${this.sessionName}`);
    
    // Set a proper desktop Chrome user agent for Salesforce compatibility
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    persistentSession.setUserAgent(userAgent);

    this.view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: persistentSession,
        // Enable features needed for Salesforce Lightning
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        enableBlinkFeatures: '',
        // JavaScript and web features
        javascript: true,
        webgl: true,
        plugins: true,
        // Proper scrolling and zoom
        scrollBounce: true,
        enablePreferredSizeMode: false,
      }
    });

    this.view.setBackgroundColor('#ffffff');
    
    // Set user agent on webContents as well
    this.view.webContents.setUserAgent(userAgent);

    // Capture actions BEFORE navigation (they're about to be lost)
    this.view.webContents.on('will-navigate', async (event, url) => {
      if (this.recording) {
        console.log('[EmbeddedBrowser] About to navigate to:', url);
        
        // First, do an immediate poll
        await this.pollNow();
        
        try {
          // Simple, defensive script to grab any remaining actions
          const actions = await this.view.webContents.executeJavaScript(`
            (function() {
              try {
                // Try to get actions array
                var actions = window.__flowstralActions__ || [];
                
                // Check localStorage backup
                try {
                  var backupStr = localStorage.getItem('__flowstral_backup_actions__');
                  if (backupStr) {
                    var backup = JSON.parse(backupStr);
                    localStorage.removeItem('__flowstral_backup_actions__');
                    // Merge backup
                    backup.forEach(function(b) {
                      var exists = actions.some(function(a) { return a.timestamp === b.timestamp; });
                      if (!exists) actions.push(b);
                    });
                  }
                } catch(e) {}
                
                // Flush pending input
                if (window.flushPendingInput) window.flushPendingInput();
                
                // Return and clear
                if (window.__flowstralActions__) window.__flowstralActions__ = [];
                return actions;
              } catch(e) {
                return [];
              }
            })();
          `);
          if (actions && actions.length > 0) {
            console.log('[EmbeddedBrowser] Captured', actions.length, 'actions before navigation');
            // Store in main process backup (survives cross-domain navigation)
            this.backupActions = actions;
            actions.forEach(action => this.recordAction(action));
          }
        } catch (e) {
          console.log('[EmbeddedBrowser] Could not capture pre-navigation actions:', e.message);
        }
      }
    });

    // Navigation handler - only record user-initiated navigations
    this.view.webContents.on('did-navigate', (event, url) => {
      console.log('[EmbeddedBrowser] Navigated to:', url);
      this.onUrlChange(url);
      
      if (this.recording) {
        // Only record if this is a significant navigation (not a redirect)
        const isSignificantNavigation = this._isSignificantNavigation(url);
        if (isSignificantNavigation) {
          this.recordAction({
            type: 'navigate',
            url: this._cleanUrl(url),
            timestamp: Date.now()
          });
        }
        // Re-inject recorder after navigation
        setTimeout(() => this.injectRecorder(), 500);
      }
    });

    this.view.webContents.on('did-navigate-in-page', (event, url) => {
      this.onUrlChange(url);
    });

    this.view.webContents.on('did-finish-load', async () => {
      if (this.recording) {
        // First, check main process backup (survives cross-domain navigation!)
        if (this.backupActions && this.backupActions.length > 0) {
          console.log('[EmbeddedBrowser] Recovering', this.backupActions.length, 'backup actions from main process');
          this.backupActions.forEach(action => this.recordAction(action));
          this.backupActions = [];  // Clear after processing
        }
        
        // Also check localStorage (same-domain backup)
        try {
          const backupActions = await this.view.webContents.executeJavaScript(`
            (function() {
              try {
                var backupStr = localStorage.getItem('__flowstral_backup_actions__');
                if (backupStr) {
                  localStorage.removeItem('__flowstral_backup_actions__');
                  return JSON.parse(backupStr);
                }
              } catch(e) {}
              return [];
            })();
          `);
          
          if (backupActions && backupActions.length > 0) {
            console.log('[EmbeddedBrowser] Found', backupActions.length, 'backup actions from localStorage');
            backupActions.forEach(action => this.recordAction(action));
          }
        } catch (e) {
          // Ignore errors
        }
        
        this.injectRecorder();
      }
    });

    this.view.webContents.setWindowOpenHandler(({ url }) => {
      this.view.webContents.loadURL(url);
      return { action: 'deny' };
    });

    console.log('[EmbeddedBrowser] Created');
    return this.view;
  }

  /**
   * Check if this is a significant navigation worth recording
   * Filters out redirects, auth callbacks, etc.
   */
  _isSignificantNavigation(url) {
    // Skip internal redirects and auth flows
    const skipPatterns = [
      '/secur/contentDoor',
      '/secur/frontdoor',
      '/_ui/identity',
      '/auth/callback',
      '/oauth',
      'sid=',
      'startURL=',
    ];
    
    for (const pattern of skipPatterns) {
      if (url.includes(pattern)) {
        return false;
      }
    }
    
    // If URL is same domain but different path, it's likely user navigation
    return true;
  }

  /**
   * Clean URL for display (remove long query strings)
   */
  _cleanUrl(url) {
    try {
      const parsed = new URL(url);
      // Keep only essential query params
      const essentialParams = ['id', 'recordId', 'view'];
      const cleanParams = new URLSearchParams();
      
      for (const key of essentialParams) {
        if (parsed.searchParams.has(key)) {
          cleanParams.set(key, parsed.searchParams.get(key));
        }
      }
      
      const cleanUrl = `${parsed.origin}${parsed.pathname}`;
      const paramString = cleanParams.toString();
      return paramString ? `${cleanUrl}?${paramString}` : cleanUrl;
    } catch {
      return url;
    }
  }

  attach(bounds) {
    if (!this.view || !this.mainWindow) return false;
    
    try {
      this.mainWindow.addBrowserView(this.view);
      
      // Ensure minimum width for proper Salesforce rendering
      const minWidth = 900;
      const adjustedBounds = {
        ...bounds,
        width: Math.max(bounds.width, minWidth)
      };
      
      this.view.setBounds(adjustedBounds);
      this.view.setAutoResize({ width: true, height: true });
      
      // Set zoom level to ensure proper rendering
      this.view.webContents.setZoomFactor(1.0);
      
      console.log('[EmbeddedBrowser] Attached with bounds:', adjustedBounds);
      return true;
    } catch (error) {
      console.error('[EmbeddedBrowser] Attach failed:', error.message);
      return false;
    }
  }
  
  /**
   * Set zoom level (useful for fitting large pages)
   */
  setZoom(factor) {
    if (this.view) {
      this.view.webContents.setZoomFactor(factor);
    }
  }

  setBounds(bounds) {
    if (this.view) {
      this.view.setBounds(bounds);
    }
  }

  detach() {
    if (this.view && this.mainWindow) {
      this.mainWindow.removeBrowserView(this.view);
    }
  }

  async navigate(url) {
    if (!this.view) this.create();
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    this.lastUserUrl = url;
    console.log('[EmbeddedBrowser] Loading URL:', url);
    await this.view.webContents.loadURL(url);
    return url;
  }

  /**
   * Start recording - adds initial GoTo step
   */
  startRecording() {
    this.recording = true;
    this.actions = [];
    
    // ALWAYS record the starting URL as the first GoTo step
    const currentUrl = this.getURL();
    console.log('[EmbeddedBrowser] Starting recording, current URL:', currentUrl);
    
    if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.startsWith('chrome:')) {
      this.startUrl = currentUrl;
      
      // Force add the initial navigation - this is critical for test playback
      const qwordAction = {
        id: `act_${Date.now()}_initial`,
        qword: 'GoTo',
        args: [currentUrl], // Use full URL for navigation
        description: `Navigate to ${new URL(currentUrl).hostname}`,
        selectorObj: null,
        raw: { type: 'navigate', url: currentUrl, isInitial: true },
        timestamp: Date.now()
      };
      
      this.actions.push(qwordAction);
      this.onAction(qwordAction);
      console.log('[EmbeddedBrowser] Added initial GoTo step:', currentUrl);
    }
    
    this.injectRecorder();
    this.startPolling();
    console.log('[EmbeddedBrowser] Recording started with', this.actions.length, 'initial actions');
  }

  stopRecording() {
    this.recording = false;
    this.stopPolling();
    console.log('[EmbeddedBrowser] Recording stopped, captured', this.actions.length, 'actions');
    return this.actions;
  }

  startPolling() {
    this.stopPolling();
    
    this.pollInterval = setInterval(async () => {
      if (!this.recording || !this.view) return;
      
      try {
        const newActions = await this.view.webContents.executeJavaScript(`
          (function() {
            if (!window.__flowstralActions__) return [];
            const actions = window.__flowstralActions__.splice(0);
            return actions;
          })();
        `);
        
        if (newActions && newActions.length > 0) {
          newActions.forEach(action => this.recordAction(action));
        }
      } catch (e) {
        // Page might not be ready
      }
    }, 100);  // Poll every 100ms to catch actions faster
  }
  
  // Immediate poll - call this before navigation to capture pending actions
  async pollNow() {
    if (!this.recording || !this.view) return;
    try {
      const newActions = await this.view.webContents.executeJavaScript(`
        (function() {
          if (!window.__flowstralActions__) return [];
          return window.__flowstralActions__.splice(0);
        })();
      `);
      if (newActions && newActions.length > 0) {
        console.log('[EmbeddedBrowser] Immediate poll captured', newActions.length, 'actions');
        newActions.forEach(action => this.recordAction(action));
      }
    } catch (e) {
      // Ignore
    }
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Record an action with smart deduplication
   */
  recordAction(action) {
    const qwordAction = this._toQWord(action);
    
    // For Fill actions, check if we already have a fill for the same field
    if (qwordAction.qword === 'Fill') {
      const fieldName = qwordAction.args[0];
      const newValue = qwordAction.args[1];
      
      // Look for existing fill action for same field
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const existing = this.actions[i];
        if (existing.qword === 'Fill' && existing.args[0] === fieldName) {
          // Update existing fill with new value (handles partial -> full typing)
          if (existing.args[1] !== newValue) {
            existing.args[1] = newValue;
            if (existing.displayArgs) existing.displayArgs[1] = qwordAction.displayArgs ? qwordAction.displayArgs[1] : newValue;
            existing.raw = action;
            existing.timestamp = action.timestamp || Date.now();
            console.log('[EmbeddedBrowser] Updated existing Fill:', fieldName, '| new value');
          }
          return; // Don't add duplicate
        }
      }
    }
    
    // Smart deduplication for other actions
    const lastAction = this.actions[this.actions.length - 1];
    
    if (lastAction) {
      // Skip if same action within 500ms
      if (lastAction.qword === qwordAction.qword && 
          JSON.stringify(lastAction.args) === JSON.stringify(qwordAction.args) &&
          Date.now() - lastAction.timestamp < 500) {
        return;
      }
      
      // Skip redundant navigations
      if (qwordAction.qword === 'GoTo' && lastAction.qword === 'GoTo' &&
          this._isSameBasePath(qwordAction.args[0], lastAction.args[0])) {
        return;
      }
    }
    
    const enrichedAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...qwordAction,
      selectorObj: this._buildSelectorObject(action),  // Full selector with fallbacks
      raw: action,
      timestamp: action.timestamp || Date.now()
    };
    
    this.actions.push(enrichedAction);
    this.onAction(enrichedAction);
    
    console.log('[EmbeddedBrowser] Action recorded:', enrichedAction.qword, enrichedAction.args.join(' | '));
  }

  /**
   * Check if two URLs have the same base path
   */
  _isSameBasePath(url1, url2) {
    try {
      const parsed1 = new URL(url1);
      const parsed2 = new URL(url2);
      return parsed1.origin === parsed2.origin && parsed1.pathname === parsed2.pathname;
    } catch {
      return url1 === url2;
    }
  }

  /**
   * Build selector object with fallbacks (MATCHES WEB EXTENSION FORMAT)
   * Web extension's getBestSelector returns: { primary, fallbacks, app, appName, selector, playwright, ... }
   */
  _buildSelectorObject(action) {
    const element = action.element || {};
    const selectors = element.selectors || [];
    
    // Sort by confidence (higher is better)
    const sorted = [...selectors].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    
    // Find the best selector (prefer CSS selectors over text)
    const cssSelectors = sorted.filter(s => 
      s.selector && (s.selector.startsWith('[') || s.selector.startsWith('#') || s.selector.startsWith('.'))
    );
    
    // Primary selector - prefer CSS selector, otherwise first sorted
    const primary = cssSelectors[0] || sorted[0] || { selector: null, playwright: null };
    const textSelector = sorted.find(s => s.type === 'text');
    
    // Build playwright locator from the CSS selector
    let playwrightLocator = primary.playwright || null;
    if (!playwrightLocator && primary.selector) {
      // Build proper playwright locator from CSS selector
      const sel = primary.selector;
      if (sel.startsWith('[') || sel.startsWith('#') || sel.startsWith('.')) {
        playwrightLocator = `locator('${sel}')`;
      } else if (element.name) {
        playwrightLocator = `locator('[name="${element.name}"]')`;
      } else if (element.id) {
        playwrightLocator = `locator('#${element.id}')`;
      }
    } else if (!playwrightLocator && element.name) {
      playwrightLocator = `locator('[name="${element.name}"]')`;
    } else if (!playwrightLocator && element.id) {
      playwrightLocator = `locator('#${element.id}')`;
    }
    
    // Build the selectorObj in web extension format
    // PRIORITY ORDER for selectors:
    // 1. data-testid (most stable - explicitly added for testing)
    // 2. name attribute (stable - used by forms)
    // 3. id attribute (stable if not dynamic)
    // 4. aria-label (stable - accessibility)
    // 5. CSS selectors
    
    // Build best selector prioritizing stable attributes
    let bestSelector = primary.selector;
    if (element.testId || element.dataTestId) {
      bestSelector = `[data-testid="${element.testId || element.dataTestId}"]`;
    } else if (element.name && !bestSelector) {
      bestSelector = `[name="${element.name}"]`;
    } else if (element.id && !bestSelector) {
      bestSelector = `#${element.id}`;
    }
    
    const selectorObj = {
      // Primary selector (best match)
      primary: primary,
      // CSS selector string - PRIORITIZE data-testid and name
      selector: bestSelector || (element.name ? `[name="${element.name}"]` : element.id ? `#${element.id}` : null),
      // Playwright locator string (e.g., "locator('[name=\"username\"]')")
      playwright: playwrightLocator,
      // Confidence score
      confidence: primary.confidence || 0,
      // Type of selector
      type: primary.type || 'unknown',
      // Text content (for display/debugging)
      text: textSelector?.value || element.text || '',
      // Element attributes for fallback resolution - CRITICAL FOR ROBUST PLAYBACK
      testId: element.testId || element.dataTestId || '',       // HIGHEST PRIORITY
      dataTestId: element.dataTestId || element.testId || '',   // Alias
      name: element.name || '',                                  // HIGH PRIORITY
      id: element.id || '',
      placeholder: element.placeholder || '',
      ariaLabel: element.ariaLabel || '',
      title: element.title || '',
      role: element.role || '',
      href: element.href || '',
      // Fallback selectors (all except primary)
      fallbacks: sorted.slice(1)
        .filter(s => s.playwright)
        .map(s => ({ 
          selector: s.selector,
          playwright: s.playwright,
          type: s.type,
          confidence: s.confidence 
        })),
      // All strategies for debugging
      strategies: sorted.map(s => ({ 
        type: s.type, 
        selector: s.selector, 
        playwright: s.playwright, 
        confidence: s.confidence 
      })),
      // App context
      app: action.app || 'generic'
    };
    
    return selectorObj;
  }

  /**
   * Convert raw action to Flowstral QWord format
   * Matches the robust web extension format
   */
  _toQWord(action) {
    const element = action.element || {};
    const selectors = element.selectors || [];
    const bestSelector = selectors.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    const textSelector = selectors.find(s => s.type === 'text');

    switch (action.type) {
      case 'navigate':
        return {
          qword: 'GoTo',
          args: [action.url],
          description: `Navigate to ${action.url}`
        };
      
      case 'click':
        // CRITICAL: Get text from element.text (description) or textSelector.textValue
        // Browser extension uses generateDescription which returns the visible text
        const clickText = element.text || textSelector?.textValue || element.innerText;
        
        // Prefer text-based clicks for readability (EXACT same as browser extension)
        if (clickText && clickText.length > 0 && clickText.length < 50 && 
            clickText !== element.tagName?.toLowerCase()) {
          return {
            qword: 'ClickText',
            args: [clickText],
            selector: bestSelector,
            description: `Click "${clickText}"`
          };
        }
        // Fall back to element click with aria-label/title/name
        const fallbackLabel = element.ariaLabel || element.title || element.name || element.tagName || 'element';
        return {
          qword: 'ClickElement',
          args: [fallbackLabel],
          selector: bestSelector,
          description: `Click ${fallbackLabel}`
        };
      
      case 'fill':
      case 'input':
        const label = element.placeholder || element.name || element.id || 
                      element.ariaLabel || 'input';
        const displayVal = action.isPassword ? '********' : (action.displayValue || action.value);
        return {
          qword: 'Fill',
          args: [label, action.value || ''],
          displayArgs: [label, displayVal],
          isPassword: action.isPassword,
          selector: bestSelector,
          description: `Type "${displayVal}" into ${label}`
        };
      
      case 'select':
        const selectLabel = element.name || element.id || 'dropdown';
        return {
          qword: 'Select',
          args: [selectLabel, action.value],
          selector: bestSelector,
          description: `Select "${action.value}" from ${selectLabel}`
        };
      
      case 'submit':
        // Convert submit to ClickText on the submit button
        const submitText = element.text || element.value || 'Submit';
        return {
          qword: 'ClickText',
          args: [submitText],
          selector: bestSelector,
          description: `Click "${submitText}"`
        };
      
      case 'check':
      case 'uncheck':
        const checkLabel = element.name || element.id || textSelector?.value || 'checkbox';
        return {
          qword: action.type === 'check' ? 'Check' : 'Uncheck',
          args: [checkLabel],
          selector: bestSelector,
          description: `${action.type === 'check' ? 'Check' : 'Uncheck'} "${checkLabel}"`
        };
      
      default:
        // Generic action
        return {
          qword: 'ClickText',
          args: [textSelector?.value || element.text || action.value || 'element'],
          selector: bestSelector,
          description: `${action.type}: ${element.text || action.value || ''}`
        };
    }
  }

  /**
   * Export actions as Flowstral test format (for Test Builder)
   */
  exportAsFlowstralTest(testName = 'Recorded Test') {
    return {
      name: testName,
      description: `Recorded on ${new Date().toISOString()}`,
      steps: this.actions.map((action, index) => ({
        id: `step_${Date.now()}_${index}`,
        order: index + 1,
        type: this._mapQWordToStepType(action.qword),
        qword: action.qword,
        args: action.args,
        displayArgs: action.displayArgs,
        selector: action.selector,
        selectorObj: action.selectorObj,
        description: action.description,
        name: action.description,
        enabled: true
      }))
    };
  }

  /**
   * Map QWord to step type for Test Builder
   */
  _mapQWordToStepType(qword) {
    const map = {
      'GoTo': 'navigate',
      'ClickText': 'click',
      'ClickElement': 'click',
      'Fill': 'input',
      'Select': 'select',
      'Check': 'click',
      'Uncheck': 'click',
      'AssertText': 'assert',
      'Wait': 'wait'
    };
    return map[qword] || 'click';
  }

  exportAsRobotFramework(testName = 'Recorded Test') {
    let robot = `*** Test Cases ***\n${testName}\n`;
    robot += `    [Documentation]    Recorded on ${new Date().toISOString()}\n`;
    
    for (const action of this.actions) {
      const args = action.displayArgs || action.args;
      robot += `    ${action.qword}    ${args.join('    ')}\n`;
    }
    
    return robot;
  }

  /**
   * Export as Playwright test with intelligent waits and assertions
   * Matches the quality of web extension's PlaywrightGenerator
   */
  exportAsPlaywright(testName = 'Recorded Test') {
    const escapeString = (str) => str?.replace(/'/g, "\\'").replace(/\n/g, '\\n') || '';
    
    let code = `// Flowstral Generated Test\n`;
    code += `// Generated on: ${new Date().toISOString()}\n`;
    code += `import { test, expect } from '@playwright/test';\n\n`;
    code += `test('${escapeString(testName)}', async ({ page }) => {\n`;
    code += `  // Set default timeout\n`;
    code += `  test.setTimeout(60000);\n\n`;
    
    let previousAction = null;
    
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];
      const nextAction = this.actions[i + 1];
      
      // Add comment for context
      if (action.description) {
        code += `  // ${action.description}\n`;
      }
      
      switch (action.qword) {
        case 'GoTo':
          code += `  await page.goto('${escapeString(action.args[0])}');\n`;
          code += `  await page.waitForLoadState('networkidle');\n`;
          break;
          
        case 'ClickText':
          const clickText = escapeString(action.args[0]);
          // Try multiple strategies for clicking
          code += `  await page.getByText('${clickText}', { exact: false }).first().click();\n`;
          // Add intelligent wait after click that might trigger navigation or content change
          if (action.raw?.triggersNavigation || action.raw?.mightTriggerChange) {
            code += `  await page.waitForLoadState('domcontentloaded');\n`;
          }
          break;
          
        case 'ClickElement':
          const clickSelector = action.selectorObj?.primary || action.selector?.value || action.args[0];
          code += `  await page.locator('${escapeString(clickSelector)}').first().click();\n`;
          break;
          
        case 'Fill':
          const fieldLabel = escapeString(action.args[0]);
          const fieldValue = escapeString(action.args[1]);
          const selectorObj = action.selectorObj;
          
          // Use best available selector
          if (selectorObj?.primary) {
            code += `  await page.locator('${escapeString(selectorObj.primary)}').fill('${fieldValue}');\n`;
          } else if (action.selector?.value) {
            code += `  await page.locator('${escapeString(action.selector.value)}').fill('${fieldValue}');\n`;
          } else {
            // Fall back to label-based fill
            code += `  await page.getByLabel('${fieldLabel}').fill('${fieldValue}');\n`;
          }
          
          // Add assertion for fill
          code += `  await expect(page.locator('${escapeString(selectorObj?.primary || action.selector?.value || `[placeholder="${fieldLabel}"]`)}')).toHaveValue('${fieldValue}');\n`;
          break;
          
        case 'Select':
          const selectLabel = escapeString(action.args[0]);
          const selectValue = escapeString(action.args[1]);
          const selectSelector = action.selectorObj?.primary || action.selector?.value;
          
          if (selectSelector) {
            code += `  await page.locator('${escapeString(selectSelector)}').selectOption('${selectValue}');\n`;
          } else {
            code += `  await page.getByLabel('${selectLabel}').selectOption('${selectValue}');\n`;
          }
          break;
          
        case 'Check':
          code += `  await page.getByLabel('${escapeString(action.args[0])}').check();\n`;
          break;
          
        case 'Uncheck':
          code += `  await page.getByLabel('${escapeString(action.args[0])}').uncheck();\n`;
          break;
          
        case 'AssertText':
          code += `  await expect(page.getByText('${escapeString(action.args[0])}')).toBeVisible();\n`;
          break;
          
        case 'Wait':
          code += `  await page.waitForTimeout(${action.args[0] || 1000});\n`;
          break;
          
        default:
          code += `  // Unsupported action: ${action.qword}\n`;
      }
      
      code += '\n';
      previousAction = action;
    }
    
    // Final screenshot
    code += `  // Take final screenshot\n`;
    code += `  await page.screenshot({ path: 'test-result.png', fullPage: true });\n`;
    code += `});\n`;
    
    return code;
  }

  /**
   * Simple recorder that uses shared engine for selectors
   * but keeps event handlers minimal to avoid page conflicts
   */
  async injectRecorder() {
    if (!this.view) return;

    // Load recorder-engine.js (shared with web extension)
    let recorderEngineCode = '';
    try {
      recorderEngineCode = fs.readFileSync(RECORDER_ENGINE_PATH, 'utf8');
      console.log('[EmbeddedBrowser] Loaded recorder-engine.js');
    } catch (e) {
      console.error('[EmbeddedBrowser] Failed to load recorder-engine.js:', e.message);
      return;
    }

    const recorderScript = `
(function() {
  if (window.__flowstralRecorderInjected__) return;
  window.__flowstralRecorderInjected__ = true;
  window.__flowstralActions__ = window.__flowstralActions__ || [];

  // Inject shared engine
  ${recorderEngineCode}
  
  var Engine = window.FlowstralRecorderEngine || {};
  var SmartSelector = Engine.SmartSelector;
  var findInteractiveElement = Engine.findInteractiveElement || function(t) { return t; };
  var isGenericContainer = Engine.isGenericContainer || function() { return false; };
  var isSensitiveField = Engine.isSensitiveField || function() { return false; };
  var getVisibleText = Engine.getVisibleText || function(el) { return (el.textContent || '').trim(); };

  var smartSelector = SmartSelector ? new SmartSelector() : null;
  if (smartSelector) {
    smartSelector.detectAndSetApp();
    console.log('[Flowstral] App detected:', smartSelector.currentApp);
  }

  var pendingInput = null;
  var inputTimeout = null;

  // BROWSER EXTENSION EXACT generateDescription (content.js line 5031-5088)
  function generateDescription(action, element) {
    var text = getVisibleText(element);
    if (text && text.length > 0) {
      if (text.length > 30) text = text.substring(0, 30) + '...';
      return action + ' "' + text + '"';
    }
    var label = element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('title');
    if (label) return action + ' ' + label;
    return action + ' ' + element.tagName.toLowerCase();
  }

  function recordAction(type, element, extra) {
    if (!element || !element.tagName) return;
    
    var text = getVisibleText(element);
    var selectorObj = smartSelector ? smartSelector.getBestSelector(element) : {};
    
    var action = {
      type: type,
      element: {
        tagName: element.tagName.toLowerCase(),
        id: element.id || '',
        text: text,
        name: element.name || '',
        placeholder: element.placeholder || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        title: element.getAttribute('title') || '',
        role: element.getAttribute('role') || '',
        selectors: selectorObj.strategies || [],
        selectorObj: selectorObj
      },
      url: window.location.href,
      timestamp: Date.now(),
      description: generateDescription(type === 'click' ? 'Click' : type === 'fill' ? 'Fill' : type, element)
    };
    if (extra) Object.assign(action, extra);
    
    window.__flowstralActions__.push(action);
    console.log('[Flowstral]', action.description);
  }

  function flushPendingInput() {
    if (!pendingInput) return;
    clearTimeout(inputTimeout);
    var el = pendingInput.element;
    var value = pendingInput.value || el.value;
    if (value) {
      var isPassword = (el.type || '').toLowerCase() === 'password' || isSensitiveField(el);
      recordAction('fill', el, { value: value, displayValue: isPassword ? '********' : value, isPassword: isPassword });
    }
    pendingInput = null;
  }

  // Click handler
  document.addEventListener('click', function(e) {
    flushPendingInput();
    var element = findInteractiveElement(e.target);
    if (!element || element === document.body) return;
    
    var tag = element.tagName.toLowerCase();
    var type = (element.type || '').toLowerCase();
    
    // Skip text inputs
    if (tag === 'input' && ['text','email','password','search','tel','url','number'].indexOf(type) >= 0) return;
    if (tag === 'textarea') return;
    
    // Skip generic containers
    if (isGenericContainer(element)) return;
    
    // Check for login/submit
    var text = (element.textContent || '').toLowerCase();
    if (tag === 'button' || type === 'submit' || text.indexOf('login') >= 0 || text.indexOf('log in') >= 0) {
      var form = element.closest('form');
      if (form) {
        form.querySelectorAll('input').forEach(function(inp) {
          if (inp.value && ['text','email','password'].indexOf((inp.type||'').toLowerCase()) >= 0) {
            var isPw = inp.type === 'password';
            recordAction('fill', inp, { value: inp.value, displayValue: isPw ? '********' : inp.value, isPassword: isPw });
          }
        });
      }
      recordAction('submit', element);
      return;
    }
    
    recordAction('click', element);
  }, true);

  // Input handler with debounce
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var type = (el.type || '').toLowerCase();
    if (['checkbox','radio','submit','button','file','hidden'].indexOf(type) >= 0) return;
    
    if (pendingInput && pendingInput.element === el) {
      pendingInput.value = el.value;
      clearTimeout(inputTimeout);
    } else {
      flushPendingInput();
      pendingInput = { element: el, value: el.value };
    }
    inputTimeout = setTimeout(flushPendingInput, 1500);
  }, true);

  // Blur handler
  document.addEventListener('blur', function(e) {
    if (pendingInput && pendingInput.element === e.target) {
      pendingInput.value = e.target.value;
      flushPendingInput();
    }
  }, true);

  // Change handler for selects/checkboxes
  document.addEventListener('change', function(e) {
    flushPendingInput();
    var el = e.target;
    if (el.tagName === 'SELECT') {
      recordAction('select', el, { value: el.options[el.selectedIndex]?.text || el.value });
    } else if (el.type === 'checkbox') {
      recordAction(el.checked ? 'check' : 'uncheck', el);
    }
  }, true);

  window.flushPendingInput = flushPendingInput;
  console.log('[Flowstral] Recorder ready');
})();
`;

    try {
      const testResult = await this.view.webContents.executeJavaScript('(function(){ return "test-ok"; })()');
      console.log('[EmbeddedBrowser] Script test:', testResult);
      await this.view.webContents.executeJavaScript(recorderScript);
      console.log('[EmbeddedBrowser] Recorder injected');
    } catch (e) {
      console.error('[EmbeddedBrowser] Injection failed:', e.message);
    }
  }

  getURL() {
    return this.view?.webContents?.getURL() || '';
  }

  getActions() {
    return this.actions;
  }

  clearActions() {
    this.actions = [];
  }

  goBack() {
    if (this.view?.webContents?.canGoBack()) {
      this.view.webContents.goBack();
    }
  }

  goForward() {
    if (this.view?.webContents?.canGoForward()) {
      this.view.webContents.goForward();
    }
  }

  refresh() {
    this.view?.webContents?.reload();
  }

  openDevTools() {
    this.view?.webContents?.openDevTools({ mode: 'detach' });
  }

  destroy() {
    this.stopPolling();
    this.detach();
    if (this.view) {
      this.view.webContents.destroy();
      this.view = null;
    }
  }
}

module.exports = EmbeddedBrowser;
