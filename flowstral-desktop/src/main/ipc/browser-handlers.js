/**
 * Embedded Browser IPC Handlers
 * 
 * All handlers related to the embedded browser functionality:
 * - Navigation (show, hide, navigate, back, forward, refresh)
 * - Recording (start, stop, get actions, clear)
 * - Suggestions (suggest, execute, add action)
 * - Export (to test builder, playwright, etc.)
 */

const { ipcMain } = require('electron');

/**
 * Register all browser-related IPC handlers
 * @param {Object} context - Application context
 * @param {EmbeddedBrowser} context.embeddedBrowser - Embedded browser instance
 * @param {BrowserWindow} context.mainWindow - Main window reference
 * @param {BrowserView} context.webappView - Webapp view reference
 * @param {Function} context.showWebappView - Function to show webapp
 * @param {Function} context.navigateWebapp - Function to navigate webapp
 * @param {Function} context.updateViewBounds - Function to update view bounds
 */
function registerBrowserHandlers(context) {
  const { 
    getEmbeddedBrowser, 
    getMainWindow, 
    getWebappView,
    showWebappView,
    navigateWebapp,
    updateViewBounds 
  } = context;

  // ============================================================================
  // BROWSER LIFECYCLE
  // ============================================================================

  ipcMain.handle('embedded-browser-show', async (event, bounds) => {
    const mainWindow = getMainWindow();
    const embeddedBrowser = getEmbeddedBrowser();
    
    if (!mainWindow || !embeddedBrowser) {
      return { success: false, error: 'Browser not ready' };
    }

    try {
      embeddedBrowser.create();
      
      if (embeddedBrowser.view && mainWindow) {
        const winBounds = mainWindow.getBounds();
        const leftPanelWidth = 320;
        const browserBounds = {
          x: leftPanelWidth,
          y: 0,
          width: Math.max(winBounds.width - leftPanelWidth, 900),
          height: winBounds.height
        };
        
        mainWindow.addBrowserView(embeddedBrowser.view);
        embeddedBrowser.view.setBounds(browserBounds);
        embeddedBrowser.view.setAutoResize({ width: true, height: true });
        
        console.log('[IPC] Embedded browser shown with bounds:', browserBounds);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to show embedded browser:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('embedded-browser-hide', async () => {
    const mainWindow = getMainWindow();
    const embeddedBrowser = getEmbeddedBrowser();
    
    if (embeddedBrowser?.view && mainWindow) {
      mainWindow.removeBrowserView(embeddedBrowser.view);
      console.log('[IPC] Embedded browser hidden');
    }
    return { success: true };
  });

  ipcMain.handle('embedded-browser-resize', (event, bounds) => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (embeddedBrowser?.view) {
      embeddedBrowser.view.setBounds(bounds);
    }
  });

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  ipcMain.handle('embedded-browser-navigate', async (event, url) => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser) {
      return { success: false, error: 'Browser not initialized' };
    }
    return embeddedBrowser.navigate(url);
  });

  ipcMain.handle('embedded-browser-back', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    embeddedBrowser?.goBack();
  });

  ipcMain.handle('embedded-browser-forward', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    embeddedBrowser?.goForward();
  });

  ipcMain.handle('embedded-browser-refresh', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    embeddedBrowser?.refresh();
  });

  ipcMain.handle('embedded-browser-zoom', (event, factor) => {
    const embeddedBrowser = getEmbeddedBrowser();
    embeddedBrowser?.setZoomFactor(factor);
  });

  ipcMain.handle('embedded-browser-get-zoom', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    return embeddedBrowser?.getZoomFactor() || 1;
  });

  // ============================================================================
  // RECORDING
  // ============================================================================

  ipcMain.handle('embedded-browser-start-recording', async () => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser) {
      return { success: false, error: 'Browser not initialized' };
    }
    
    await embeddedBrowser.startRecording();
    const currentUrl = embeddedBrowser.getCurrentUrl();
    console.log('[IPC] Recording started at:', currentUrl);
    return { success: true, url: currentUrl };
  });

  ipcMain.handle('embedded-browser-stop-recording', async () => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser) {
      return [];
    }
    
    const actions = embeddedBrowser.stopRecording();
    console.log('[IPC] Recording stopped, captured', actions.length, 'actions');
    return actions;
  });

  ipcMain.handle('embedded-browser-get-actions', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    return embeddedBrowser?.getActions() || [];
  });

  ipcMain.handle('embedded-browser-clear-actions', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    embeddedBrowser?.clearActions();
    return { success: true };
  });

  // ============================================================================
  // SUGGESTIONS & EXECUTION
  // ============================================================================

  ipcMain.handle('embedded-browser-suggest', async () => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser?.view) return { suggestions: [], categories: {}, counts: {}, timing: '0ms', total: 0 };
    
    const startTime = Date.now();
    
    try {
      const result = await embeddedBrowser.view.webContents.executeJavaScript(`
        (function() {
          const startTime = performance.now();
          const suggestions = [];
          const seen = new Set();
          const counts = { buttons: 0, links: 0, inputs: 0, dropdowns: 0, navigation: 0, menus: 0, checkboxes: 0, assertions: 0 };
          
          function addSuggestion(type, qword, args, description, element, selector, category) {
            const key = qword + ':' + args.join('|');
            if (seen.has(key)) return;
            if (!args[0] || args[0].length === 0) return;
            seen.add(key);
            
            const cat = category || type;
            if (counts[cat] !== undefined) counts[cat]++;
            
            suggestions.push({ 
              type, qword, args, description, element, selector, category: cat,
              selectorObj: {
                primary: selector,
                type: selector ? (selector.startsWith('#') ? 'id' : selector.startsWith('[name=') ? 'name' : 'css') : 'text',
                value: selector || args[0],
                text: args[0]
              }
            });
          }
          
          function isVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.left >= 0 && 
                   rect.bottom <= window.innerHeight && rect.right <= window.innerWidth &&
                   window.getComputedStyle(el).visibility !== 'hidden' &&
                   window.getComputedStyle(el).display !== 'none' &&
                   el.offsetWidth > 0 && el.offsetHeight > 0;
          }
          
          // Buttons
          document.querySelectorAll('button:not([disabled]), [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
            if (!isVisible(el)) return;
            const text = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
            if (text && text.length > 0 && text.length < 60) {
              addSuggestion('click', 'ClickText', [text], 'Click "' + text + '"', 'button', el.id ? '#' + el.id : null, 'buttons');
            }
          });
          
          // Links
          document.querySelectorAll('a[href]').forEach(el => {
            if (!isVisible(el)) return;
            const text = (el.innerText || el.title || '').trim();
            if (text && text.length > 1 && text.length < 50) {
              addSuggestion('click', 'ClickText', [text], 'Click "' + text + '"', 'link', null, 'links');
            }
          });
          
          // Inputs
          document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input:not([type]), textarea').forEach(el => {
            if (!isVisible(el) || el.disabled || el.readOnly) return;
            const label = el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '';
            if (label) {
              addSuggestion('fill', 'Fill', [label, ''], 'Type into "' + label + '"', 'input', el.name ? '[name="' + el.name + '"]' : null, 'inputs');
            }
          });
          
          // Selects
          document.querySelectorAll('select:not([disabled])').forEach(el => {
            if (!isVisible(el)) return;
            const label = el.getAttribute('aria-label') || el.name || el.id || 'dropdown';
            addSuggestion('select', 'Select', [label, ''], 'Select from "' + label + '"', 'select', el.name ? '[name="' + el.name + '"]' : null, 'dropdowns');
          });
          
          // Checkboxes
          document.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(el => {
            if (!isVisible(el)) return;
            const label = el.getAttribute('aria-label') || el.closest('label')?.innerText?.trim() || el.name || '';
            if (label) {
              addSuggestion('click', 'ClickText', [label], 'Toggle "' + label + '"', 'checkbox', null, 'checkboxes');
            }
          });
          
          // Headers for assertions
          document.querySelectorAll('h1, h2, .slds-page-header__title').forEach(el => {
            if (!isVisible(el)) return;
            const text = (el.innerText || '').trim().substring(0, 60);
            if (text && text.length > 2) {
              addSuggestion('assert', 'AssertText', [text], 'Verify "' + text + '"', 'header', null, 'assertions');
            }
          });
          
          const duration = (performance.now() - startTime).toFixed(1);
          
          // Group by category
          const categories = {};
          suggestions.forEach(s => {
            if (!categories[s.category]) categories[s.category] = [];
            categories[s.category].push(s);
          });
          
          return { suggestions, categories, counts, timing: duration + 'ms', total: suggestions.length };
        })();
      `);
      
      console.log('[IPC] Suggestions:', result?.total || 0, 'in', Date.now() - startTime + 'ms');
      return result || { suggestions: [], categories: {}, counts: {}, timing: '0ms', total: 0 };
    } catch (error) {
      console.error('[IPC] Suggest failed:', error.message);
      return { suggestions: [], categories: {}, counts: {}, timing: '0ms', total: 0, error: error.message };
    }
  });

  ipcMain.handle('embedded-browser-execute-action', async (event, action) => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser?.view) {
      return { success: false, error: 'No browser' };
    }
    
    try {
      const result = await embeddedBrowser.view.webContents.executeJavaScript(`
        (function() {
          const action = ${JSON.stringify(action)};
          
          function findElement(selector, text) {
            if (selector) {
              try {
                const el = document.querySelector(selector);
                if (el) return el;
              } catch(e) {}
            }
            
            if (text) {
              const clickables = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
              for (const el of clickables) {
                const elText = (el.innerText || el.value || el.title || '').trim();
                if (elText === text || elText.includes(text)) {
                  if (el.offsetParent !== null) return el;
                }
              }
            }
            
            return null;
          }
          
          function findInput(label) {
            let el = document.querySelector('input[placeholder*="' + label + '" i], textarea[placeholder*="' + label + '" i]');
            if (el) return el;
            el = document.querySelector('input[name*="' + label + '" i], textarea[name*="' + label + '" i]');
            if (el) return el;
            el = document.querySelector('input[aria-label*="' + label + '" i], textarea[aria-label*="' + label + '" i]');
            return el;
          }
          
          try {
            if (action.qword === 'ClickText' || action.qword === 'ClickElement') {
              const el = findElement(action.selectorObj?.primary, action.args[0]);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => el.click(), 100);
                return { success: true };
              }
              return { success: false, error: 'Element not found' };
            }
            
            if (action.qword === 'Fill') {
              const el = findInput(action.args[0]);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
                el.value = action.args[1] || '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return { success: true };
              }
              return { success: false, error: 'Input not found' };
            }
            
            return { success: false, error: 'Unknown action' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('embedded-browser-add-action', (event, action) => {
    const embeddedBrowser = getEmbeddedBrowser();
    if (!embeddedBrowser) return null;
    
    const qwordAction = {
      id: `action_${Date.now()}`,
      qword: action.qword,
      args: action.args,
      selector: action.selector,
      selectorObj: action.selectorObj,
      description: action.description,
      timestamp: Date.now()
    };
    
    embeddedBrowser.actions.push(qwordAction);
    return qwordAction;
  });

  // ============================================================================
  // EXPORT
  // ============================================================================

  ipcMain.handle('export-flowstral-test', (event, testName) => {
    const embeddedBrowser = getEmbeddedBrowser();
    return embeddedBrowser?.exportAsFlowstralTest(testName);
  });

  ipcMain.handle('export-robot-framework', (event, testName) => {
    const embeddedBrowser = getEmbeddedBrowser();
    return embeddedBrowser?.exportAsRobotFramework(testName);
  });

  ipcMain.handle('export-playwright', () => {
    const embeddedBrowser = getEmbeddedBrowser();
    return embeddedBrowser?.exportAsPlaywright();
  });

  ipcMain.handle('export-to-test-builder', async (event, testName) => {
    const embeddedBrowser = getEmbeddedBrowser();
    const webappView = getWebappView();
    
    try {
      const testData = embeddedBrowser?.exportAsFlowstralTest(testName);
      if (!testData || testData.steps.length === 0) {
        return { success: false, error: 'No steps to export' };
      }
      
      console.log('[IPC] Exporting', testData.steps.length, 'steps to Test Builder');
      
      // Build test case
      const testCase = buildTestCase(testData, testName);
      
      // Inject into webapp with timestamp to force reload
      const timestamp = Date.now().toString();
      await webappView?.webContents.executeJavaScript(`
        localStorage.setItem('unified_test_case', ${JSON.stringify(JSON.stringify(testCase))});
        localStorage.setItem('unified_test_case_timestamp', '${timestamp}');
        console.log('[IPC] Exported test case with timestamp:', '${timestamp}');
      `);
      
      // Navigate to builder
      showWebappView();
      navigateWebapp('/test-cases/builder');
      
      return { success: true, testCase };
    } catch (error) {
      console.error('[IPC] Export failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Browser handlers registered');
}

/**
 * Build test case for Test Builder
 */
function buildTestCase(testData, testName) {
  const { mapQWordToStepType } = require('../lib/action-converter');
  
  return {
    id: `tc_${Date.now()}`,
    name: testData.name || testName || 'Recorded Test',
    description: testData.description || `Recorded on ${new Date().toISOString()}`,
    tags: ['recorded', 'desktop'],
    steps: testData.steps.map((step, idx) => ({
      id: step.id || `step_${Date.now()}_${idx}`,
      type: mapQWordToStepType(step.qword),
      name: step.name || step.description || `Step ${idx + 1}`,
      url: step.qword === 'GoTo' ? step.args[0] : '',
      selector: getBestSelector(step),
      selectorObj: step.selectorObj || {},
      target: step.qword === 'Fill' ? step.args[0] : '',
      value: step.qword === 'Fill' ? step.args[1] : (step.args?.[0] || ''),
      qword: step.qword,
      args: step.args,
      enabled: true,
    })),
    variables: [],
    settings: { timeout: 30000, retries: 0 },
    metadata: { 
      createdAt: new Date().toISOString(), 
      source: 'flowstral-desktop'
    },
  };
}

/**
 * Get best CSS selector from step
 */
function getBestSelector(step) {
  const selectorObj = step.selectorObj || {};
  if (selectorObj.selector) return selectorObj.selector;
  
  const strategies = selectorObj.strategies || [];
  const css = strategies.find(s => s.selector && (s.selector.startsWith('[') || s.selector.startsWith('#')));
  return css?.selector || '';
}

module.exports = { registerBrowserHandlers };

