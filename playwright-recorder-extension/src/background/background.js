/**
 * Background Service Worker
 * Manages recording state across tabs and generates Playwright scripts
 */

class RecordingManager {
  constructor() {
    this.state = {
      recording: false,
      activeTabId: null,
      actions: [],
      startUrl: null,
      startTime: null,
      metadata: {},
    };
    
    this.init();
  }

  async init() {
    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.state.recording && tabId === this.state.activeTabId) {
        if (changeInfo.url) {
          this.state.actions.push({
            type: 'navigate',
            url: changeInfo.url,
            timestamp: Date.now(),
            description: `Navigate to ${new URL(changeInfo.url).pathname}`,
            method: 'page-load',
          });
        }
      }
    });

    // Listen for tab close
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.state.recording && tabId === this.state.activeTabId) {
        this.stopRecording();
      }
    });

    // Load any saved state
    const saved = await chrome.storage.local.get('recorderState');
    if (saved.recorderState) {
      this.state = { ...this.state, ...saved.recorderState };
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'START_RECORDING':
        await this.startRecording(sender.tab?.id || message.tabId);
        sendResponse({ success: true });
        break;

      case 'STOP_RECORDING':
        const result = await this.stopRecording();
        sendResponse(result);
        break;

      case 'GET_STATE':
        sendResponse({
          recording: this.state.recording,
          actionCount: this.state.actions.length,
          startUrl: this.state.startUrl,
        });
        break;

      case 'ACTION_RECORDED':
        this.state.actions.push(message.action);
        this.saveState();
        sendResponse({ count: this.state.actions.length });
        break;

      case 'SAVE_ACTIONS':
        // Merge actions from content script (on page unload)
        if (message.actions) {
          this.state.actions = [...this.state.actions, ...message.actions];
          this.saveState();
        }
        sendResponse({ success: true });
        break;

      case 'GENERATE_SCRIPT':
        // Try to generate via backend API first (faster, supports 20+ apps)
        this.generateScriptViaAPI(message.options)
          .then(script => {
            if (script) {
              sendResponse({ script });
            } else {
              // Fallback to local generation
              const localScript = this.generateScript(message.options);
              sendResponse({ script: localScript });
            }
          })
          .catch(() => {
            // Fallback to local generation on error
            const localScript = this.generateScript(message.options);
            sendResponse({ script: localScript });
          });
        return true; // Keep channel open for async

      case 'GET_ACTIONS':
        sendResponse({ actions: this.state.actions });
        break;

      case 'CLEAR_RECORDING':
        this.clearRecording();
        sendResponse({ success: true });
        break;

      case 'DOWNLOAD_SCRIPT':
        await this.downloadScript(message.script, message.filename);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  async startRecording(tabId) {
    if (this.state.recording) {
      await this.stopRecording();
    }

    // Get the current tab
    const tab = await chrome.tabs.get(tabId);

    this.state = {
      recording: true,
      activeTabId: tabId,
      actions: [],
      startUrl: tab.url,
      startTime: Date.now(),
      metadata: {
        title: tab.title,
        timestamp: Date.now(),
        startUrl: tab.url,
      },
    };

    // Inject content script if needed and start recording
    await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });

    // Update badge
    chrome.action.setBadgeText({ text: 'REC', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4757', tabId });

    this.saveState();
  }

  async stopRecording() {
    if (!this.state.recording) {
      return { success: false, error: 'Not recording' };
    }

    // Try to get final actions from content script (may have actions not yet sent)
    try {
      const response = await chrome.tabs.sendMessage(
        this.state.activeTabId,
        { type: 'STOP_RECORDING' }
      );
      // Only use content script actions if they have MORE than what we already have
      // This prevents losing actions if content script was reloaded
      if (response.actions && response.actions.length > this.state.actions.length) {
        this.state.actions = response.actions;
      }
    } catch (e) {
      console.log('Could not get actions from content script:', e);
      // Keep using the actions we already have from ACTION_RECORDED messages
    }

    const recording = {
      actions: this.state.actions,
      metadata: this.state.metadata,
    };

    // Generate script with current actions
    const script = this.generateScript();

    // Clear badge
    try {
      chrome.action.setBadgeText({ text: '', tabId: this.state.activeTabId });
    } catch (e) {
      // Tab may no longer exist
    }

    this.state.recording = false;
    this.saveState();

    return {
      success: true,
      recording,
      script,
      actionCount: this.state.actions.length,
    };
  }

  generateScript(options = {}) {
    const config = {
      language: 'typescript',
      includeComments: true,
      generateAssertions: true,
      usePageObjectModel: false,
      ...options,
    };

    const { actions, metadata } = {
      actions: this.state.actions,
      metadata: this.state.metadata,
    };

    if (actions.length === 0) {
      return config.language === 'python' 
        ? '# No actions recorded' 
        : '// No actions recorded';
    }

    if (config.language === 'python') {
      return this.generatePythonScript(actions, metadata, config);
    } else {
      return this.generateTypeScriptScript(actions, metadata, config);
    }
  }

  generateTypeScriptScript(actions, metadata, config) {
    let script = `import { test, expect } from '@playwright/test';

/**
 * ${metadata.title || 'Recorded Test'}
 * Recorded on: ${new Date(metadata.timestamp).toISOString()}
 * Starting URL: ${metadata.startUrl}
 */
test('${this.escapeString(metadata.title || 'Recorded test')}', async ({ page }) => {
  // Navigate to starting URL
  await page.goto('${this.escapeString(metadata.startUrl)}');
  await page.waitForLoadState('networkidle');

`;

    let previousAction = null;

    for (const action of actions) {
      if (this.isRedundant(action, previousAction)) continue;

      if (config.includeComments && action.description) {
        script += `  // ${action.description}\n`;
      }

      script += this.generateTypeScriptAction(action);
      script += this.generateTypeScriptWait(action);
      script += '\n';
      previousAction = action;
    }

    script += `  // Test complete
});
`;

    return script;
  }

  generatePythonScript(actions, metadata, config) {
    const testName = this.toSnakeCase(metadata.title || 'recorded_test');
    let script = `import pytest
from playwright.sync_api import Page, expect


def test_${testName}(page: Page):
    """
    ${metadata.title || 'Recorded Test'}
    Recorded on: ${new Date(metadata.timestamp).toISOString()}
    Starting URL: ${metadata.startUrl}
    """
    # Navigate to starting URL
    page.goto("${this.escapeStringDouble(metadata.startUrl)}")
    page.wait_for_load_state("networkidle")

`;

    let previousAction = null;

    for (const action of actions) {
      if (this.isRedundant(action, previousAction)) continue;

      if (config.includeComments && action.description) {
        script += `    # ${action.description}\n`;
      }

      script += this.generatePythonAction(action);
      script += this.generatePythonWait(action);
      script += '\n';
      previousAction = action;
    }

    script += `    # Test complete
`;

    return script;
  }

  generateTypeScriptAction(action) {
    const selector = this.formatTypeScriptSelector(action.selector);

    switch (action.type) {
      case 'click':
        let clickCode = `  await page.${selector}.click(`;
        const opts = [];
        if (action.button && action.button !== 'left') {
          opts.push(`button: '${action.button}'`);
        }
        if (action.modifiers && action.modifiers.length) {
          opts.push(`modifiers: [${action.modifiers.map(m => `'${m}'`).join(', ')}]`);
        }
        if (opts.length) clickCode += `{ ${opts.join(', ')} }`;
        clickCode += ');\n';
        return clickCode;

      case 'dblclick':
        return `  await page.${selector}.dblclick();\n`;

      case 'fill':
        return `  await page.${selector}.fill('${this.escapeString(action.value || '')}');\n`;

      case 'type':
        return `  await page.${selector}.type('${this.escapeString(action.value || '')}');\n`;

      case 'select':
        if (action.label) {
          return `  await page.${selector}.selectOption({ label: '${this.escapeString(action.label)}' });\n`;
        }
        return `  await page.${selector}.selectOption('${this.escapeString(action.value || '')}');\n`;

      case 'check':
        return `  await page.${selector}.check();\n`;

      case 'uncheck':
        return `  await page.${selector}.uncheck();\n`;

      case 'press':
        return `  await page.${selector}.press('${action.key}');\n`;

      case 'keyboard':
        return `  await page.keyboard.${action.method}('${action.key}');\n`;

      case 'navigate':
        return `  await page.goto('${this.escapeString(action.url)}');\n`;

      case 'upload':
        return `  await page.${selector}.setInputFiles(['${this.escapeString(action.files)}']);\n`;

      case 'hover':
        return `  await page.${selector}.hover();\n`;

      default:
        return `  // Unhandled action: ${action.type}\n`;
    }
  }

  generatePythonAction(action) {
    const selector = this.formatPythonSelector(action.selector);

    switch (action.type) {
      case 'click':
        let clickCode = `    page.${selector}.click(`;
        const opts = [];
        if (action.button && action.button !== 'left') {
          opts.push(`button="${action.button}"`);
        }
        if (action.modifiers && action.modifiers.length) {
          opts.push(`modifiers=[${action.modifiers.map(m => `"${m}"`).join(', ')}]`);
        }
        if (opts.length) clickCode += opts.join(', ');
        clickCode += ')\n';
        return clickCode;

      case 'dblclick':
        return `    page.${selector}.dblclick()\n`;

      case 'fill':
        return `    page.${selector}.fill("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'type':
        return `    page.${selector}.type("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'select':
        if (action.label) {
          return `    page.${selector}.select_option(label="${this.escapeStringDouble(action.label)}")\n`;
        }
        return `    page.${selector}.select_option("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'check':
        return `    page.${selector}.check()\n`;

      case 'uncheck':
        return `    page.${selector}.uncheck()\n`;

      case 'press':
        return `    page.${selector}.press("${action.key}")\n`;

      case 'keyboard':
        return `    page.keyboard.${action.method}("${action.key}")\n`;

      case 'navigate':
        return `    page.goto("${this.escapeStringDouble(action.url)}")\n`;

      case 'upload':
        return `    page.${selector}.set_input_files(["${this.escapeStringDouble(action.files)}"])\n`;

      case 'hover':
        return `    page.${selector}.hover()\n`;

      default:
        return `    # Unhandled action: ${action.type}\n`;
    }
  }

  generateTypeScriptWait(action) {
    let code = '';
    if (action.type === 'navigate' || action.triggersNavigation) {
      code += `  await page.waitForLoadState('networkidle');\n`;
    }
    if (action.mightTriggerChange) {
      code += `  await page.waitForLoadState('domcontentloaded');\n`;
    }
    return code;
  }

  generatePythonWait(action) {
    let code = '';
    if (action.type === 'navigate' || action.triggersNavigation) {
      code += `    page.wait_for_load_state("networkidle")\n`;
    }
    if (action.mightTriggerChange) {
      code += `    page.wait_for_load_state("domcontentloaded")\n`;
    }
    return code;
  }

  formatTypeScriptSelector(selectorData) {
    if (!selectorData) return "locator('body')";

    if (selectorData.playwright) {
      return selectorData.playwright;
    }

    if (selectorData.selector) {
      return `locator('${this.escapeString(selectorData.selector)}')`;
    }

    if (typeof selectorData === 'string') {
      return `locator('${this.escapeString(selectorData)}')`;
    }

    return "locator('body')";
  }

  formatPythonSelector(selectorData) {
    if (!selectorData) return 'locator("body")';

    if (selectorData.playwright) {
      return this.convertToPythonSelector(selectorData.playwright);
    }

    if (selectorData.selector) {
      return `locator("${this.escapeStringDouble(selectorData.selector)}")`;
    }

    if (typeof selectorData === 'string') {
      return `locator("${this.escapeStringDouble(selectorData)}")`;
    }

    return 'locator("body")';
  }

  convertToPythonSelector(tsSelector) {
    return tsSelector
      .replace(/getByTestId/g, 'get_by_test_id')
      .replace(/getByRole/g, 'get_by_role')
      .replace(/getByLabel/g, 'get_by_label')
      .replace(/getByPlaceholder/g, 'get_by_placeholder')
      .replace(/getByText/g, 'get_by_text')
      .replace(/getByAltText/g, 'get_by_alt_text')
      .replace(/getByTitle/g, 'get_by_title')
      .replace(/'/g, '"')
      .replace(/{ name: /g, 'name=')
      .replace(/ }/g, '');
  }

  toSnakeCase(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50);
  }

  escapeStringDouble(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  isRedundant(action, prev) {
    if (!prev) return false;
    
    if (action.type === 'click' && prev.type === 'click') {
      if (action.timestamp - prev.timestamp < 100) {
        return action.selector?.selector === prev.selector?.selector;
      }
    }
    
    return false;
  }

  escapeString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  clearRecording() {
    this.state.actions = [];
    this.state.metadata = {};
    this.saveState();
  }

  async saveState() {
    await chrome.storage.local.set({
      recorderState: {
        recording: this.state.recording,
        activeTabId: this.state.activeTabId,
        actions: this.state.actions,
        metadata: this.state.metadata,
        startUrl: this.state.startUrl,
      },
    });
  }

  async downloadScript(script, filename = 'recorded-test.spec.ts') {
    const blob = new Blob([script], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true,
    });
  }

  async generateScriptViaAPI(options = {}) {
    // Backend API URL (configurable)
    const API_BASE_URL = 'http://localhost:8000'; // Default, can be configured
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/playwright-recorder/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actions: this.state.actions,
          metadata: this.state.metadata,
          options: options,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      return result.script || null;
    } catch (error) {
      console.log('Backend API not available, using local generation:', error);
      return null;
    }
  }
}

// Initialize
const manager = new RecordingManager();
