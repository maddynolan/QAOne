/**
 * Background Service Worker
 * Manages recording state across tabs and generates Playwright scripts
 */

class RecordingManager {
  constructor() {
    this.state = {
      recording: false,
      paused: false,
      activeTabId: null,
      trackedTabs: new Set(),  // All tabs being recorded
      currentTabId: null,      // Currently focused tab
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

    // Listen for tab updates (URL changes)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.state.recording && this.state.trackedTabs.has(tabId)) {
        if (changeInfo.url) {
          this.state.actions.push({
            type: 'navigate',
            url: changeInfo.url,
            timestamp: Date.now(),
            description: `Navigate to ${new URL(changeInfo.url).pathname}`,
            method: 'page-load',
            tabId: tabId,
          });
        }
        // When tab finishes loading, inject content script
        if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
          this.injectContentScript(tabId);
        }
      }
    });

    // Listen for NEW tabs created (popups, target="_blank")
    chrome.tabs.onCreated.addListener(async (tab) => {
      if (this.state.recording && tab.openerTabId && this.state.trackedTabs.has(tab.openerTabId)) {
        console.log('[Background] New tab created from recorded tab:', tab.id, 'opener:', tab.openerTabId);
        
        // Track this new tab
        this.state.trackedTabs.add(tab.id);
        
        // Record the popup/new tab action
        this.state.actions.push({
          type: 'new_tab',
          tabId: tab.id,
          openerTabId: tab.openerTabId,
          timestamp: Date.now(),
          description: 'New tab/window opened',
          url: tab.pendingUrl || tab.url || 'about:blank',
        });
        
        // Wait for tab to load, then inject content script
        setTimeout(() => this.injectContentScript(tab.id), 500);
      }
    });

    // Listen for tab activation (switching between tabs)
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      if (this.state.recording && this.state.trackedTabs.has(activeInfo.tabId)) {
        if (this.state.currentTabId !== activeInfo.tabId) {
          console.log('[Background] Tab switched from', this.state.currentTabId, 'to', activeInfo.tabId);
          
          this.state.actions.push({
            type: 'switch_tab',
            fromTabId: this.state.currentTabId,
            toTabId: activeInfo.tabId,
            timestamp: Date.now(),
            description: 'Switch to tab',
          });
          
          this.state.currentTabId = activeInfo.tabId;
        }
      }
    });

    // Listen for tab close
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (this.state.recording && this.state.trackedTabs.has(tabId)) {
        // Remove from tracked tabs
        this.state.trackedTabs.delete(tabId);
        
        // Record tab close
        this.state.actions.push({
          type: 'close_tab',
          tabId: tabId,
          timestamp: Date.now(),
          description: 'Tab closed',
        });
        
        // Only stop recording if the MAIN tab was closed
        if (tabId === this.state.activeTabId) {
          this.stopRecording();
        }
      }
    });

    // Load any saved state
    const saved = await chrome.storage.local.get('recorderState');
    if (saved.recorderState) {
      this.state = { ...this.state, ...saved.recorderState };
      // Convert tracked tabs back to Set if saved as array
      if (Array.isArray(saved.recorderState.trackedTabs)) {
        this.state.trackedTabs = new Set(saved.recorderState.trackedTabs);
      }
    }
  }

  async injectContentScript(tabId) {
    try {
      // Check if content script is already there
      const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => null);
      if (response) {
        // Content script exists, just start recording
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
        console.log('[Background] Started recording in existing content script, tab:', tabId);
      } else {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['src/content/content.js']
        });
        console.log('[Background] Injected content script into tab:', tabId);
        
        // Start recording after injection
        setTimeout(async () => {
          await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }).catch(() => {});
        }, 100);
      }
    } catch (error) {
      console.log('[Background] Could not inject content script:', error.message);
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
          paused: this.state.paused,
          actionCount: this.state.actions.length,
          startUrl: this.state.startUrl,
        });
        break;

      case 'PAUSE_RECORDING':
        this.state.paused = true;
        this.saveState();
        sendResponse({ success: true, paused: true });
        break;

      case 'RESUME_RECORDING':
        this.state.paused = false;
        this.saveState();
        sendResponse({ success: true, paused: false });
        break;

      case 'ACTION_RECORDED':
        console.log('[Background] Received ACTION_RECORDED:', message.action.type, message.action.description);
        this.state.actions.push(message.action);
        this.saveState();
        console.log('[Background] Total actions now:', this.state.actions.length);
        sendResponse({ count: this.state.actions.length });
        // Broadcast to side panel for live updates
        chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action: message.action }).catch(() => {});
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
        // Generate script locally (instant, no delays)
        try {
          const script = this.generateScript(message.options || {});
          console.log('[Flowstral] Generated script length:', script ? script.length : 0);
          sendResponse({ script: script || '' });
        } catch (error) {
          console.error('[Flowstral] Error generating script:', error);
          sendResponse({ script: '', error: error.message });
        }
        return true; // Keep channel open for async response

      case 'GET_ACTIONS':
        console.log('[Background] GET_ACTIONS requested, returning', this.state.actions.length, 'actions');
        sendResponse({ actions: this.state.actions });
        break;

      case 'CLEAR_RECORDING':
        this.clearRecording();
        sendResponse({ success: true });
        break;

      case 'SAVE_WORKFLOW':
        // Save workflow from Suggest tab as recording
        console.log('[Background] SAVE_WORKFLOW received:', message.workflow);
        try {
          const workflow = message.workflow;
          
          // Set the actions from workflow steps
          this.state.actions = workflow.steps.map((step, idx) => ({
            ...step,
            actionNumber: idx + 1,
            timestamp: step.timestamp || Date.now()
          }));
          
          this.state.startUrl = workflow.startUrl;
          this.state.startTime = workflow.createdAt || Date.now();
          
          console.log('[Background] Workflow saved with', this.state.actions.length, 'actions');
          sendResponse({ success: true, actionCount: this.state.actions.length });
        } catch (error) {
          console.error('[Background] Error saving workflow:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GENERATE_TEST_CASES':
        try {
          const testCases = this.generateTestCases(
            this.state.actions,
            message.format || 'markdown',
            message.testName || 'Recorded Test'
          );
          sendResponse({ testCases });
        } catch (error) {
          console.error('[Flowstral] Error generating test cases:', error);
          sendResponse({ testCases: '', error: error.message });
        }
        break;

      case 'DOWNLOAD_SCRIPT':
        await this.downloadScript(message.script, message.filename);
        sendResponse({ success: true });
        break;

      // ============ AGENTIC FEATURES (Phases 1-4) ============
      case 'PAGE_ANALYSIS':
        // Forward page analysis to side panel
        console.log('[Background] PAGE_ANALYSIS received, forwarding to sidepanel');
        // Broadcast to all extension views (sidepanel will receive it)
        chrome.runtime.sendMessage(message).catch(() => {
          // Sidepanel may not be open, that's OK
        });
        sendResponse({ success: true });
        break;

      case 'EXECUTION_PROGRESS':
      case 'EXECUTION_COMPLETE':
      case 'SELECTOR_ATTEMPT':
        // Forward execution updates to sidepanel
        chrome.runtime.sendMessage(message).catch(() => {});
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

    // Get the current tab (fast)
    const tab = await chrome.tabs.get(tabId);

    // Set state immediately - CLEAR all old data for fresh start
    this.state = {
      recording: true,
      activeTabId: tabId,
      trackedTabs: new Set([tabId]),  // Start tracking this tab
      currentTabId: tabId,             // Currently active tab
      actions: [],
      startUrl: tab.url,
      startTime: Date.now(),
      metadata: {
        title: tab.title,
        timestamp: Date.now(),
        startUrl: tab.url,
      },
    };
    
    // Clear any old script from storage
    await chrome.storage.local.remove('recorderState');

    // Update badge immediately (don't wait)
    chrome.action.setBadgeText({ text: 'REC', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4757', tabId });

    // Send message to content script (non-blocking - don't await)
    chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' }).then(() => {
      console.log('[Background] START_RECORDING sent to content script successfully');
    }).catch((error) => {
      console.error('[Background] Failed to send START_RECORDING to content script:', error);
      // Content script might not be loaded yet - that's OK, it will start when loaded
    });

    // Save state (non-blocking)
    this.saveState();
  }

  async stopRecording() {
    if (!this.state.recording) {
      return { success: false, error: 'Not recording' };
    }

    console.log('[Background] stopRecording called, current actions:', this.state.actions.length);

    // Try to get final actions from content script (may have actions not yet sent)
    try {
      const response = await chrome.tabs.sendMessage(
        this.state.activeTabId,
        { type: 'STOP_RECORDING' }
      );
      console.log('[Background] Content script returned', response?.actions?.length || 0, 'actions');
      // Only use content script actions if they have MORE than what we already have
      // This prevents losing actions if content script was reloaded
      if (response.actions && response.actions.length > this.state.actions.length) {
        console.log('[Background] Using content script actions (more than background)');
        this.state.actions = response.actions;
      } else {
        console.log('[Background] Keeping background actions:', this.state.actions.length);
      }
    } catch (e) {
      console.log('[Background] Could not get actions from content script:', e);
      // Keep using the actions we already have from ACTION_RECORDED messages
    }

    console.log('[Background] Final action count:', this.state.actions.length);

    const recording = {
      actions: this.state.actions,
      metadata: this.state.metadata,
    };

    // Generate FRESH script with current actions only
    const script = this.generateScript();

    // Clear badge
    try {
      chrome.action.setBadgeText({ text: '', tabId: this.state.activeTabId });
    } catch (e) {
      // Tab may no longer exist
    }

    this.state.recording = false;
    // Don't save script in state - it will be generated fresh each time
    this.saveState();

    // POST session to backend for persistence (non-blocking)
    this.saveSessionToBackend(recording, script);

    return {
      success: true,
      recording,
      script,
      actionCount: this.state.actions.length,
    };
  }

  async saveSessionToBackend(recording, script) {
    try {
      const sessionData = {
        session_id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: recording.metadata.title || `Recording ${new Date().toLocaleString()}`,
        initial_url: recording.metadata.startUrl || this.state.startUrl,
        actions: recording.actions,
        script: script,
        created_at: new Date().toISOString(),
        is_active: false,
        metadata: recording.metadata,
      };

      const response = await fetch('http://localhost:8000/api/flowstral/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (response.ok) {
        console.log('[Background] Session saved to backend:', sessionData.session_id);
      } else {
        console.warn('[Background] Failed to save session to backend:', response.status);
      }
    } catch (error) {
      console.warn('[Background] Could not save session to backend (server may be offline):', error.message);
      // Store locally as fallback
      chrome.storage.local.set({ [`session_${Date.now()}`]: recording });
    }
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
    // Fix starting URL - skip extension URLs
    let startUrl = metadata.startUrl || 'about:blank';
    if (startUrl.startsWith('chrome-extension://') || startUrl.startsWith('chrome://')) {
      // Find first real navigation action
      const firstNav = actions.find(a => a.type === 'navigate' && a.url && 
        !a.url.startsWith('chrome-extension://') && !a.url.startsWith('chrome://'));
      if (firstNav) {
        startUrl = firstNav.url;
      } else {
        startUrl = 'about:blank';
      }
    }
    
    let script = `import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * ${metadata.title || 'Recorded Test'}
 * Recorded on: ${new Date(metadata.timestamp).toISOString()}
 * Starting URL: ${startUrl}
 */

// Helper: Wait for page to be ready
async function waitForPageReady(page: Page) {
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch {}
  
  // Wait for spinners to disappear
  const spinners = ['.slds-spinner', '.loading-spinner', '[class*="spinner"]', '[aria-busy="true"]'];
  for (const spinner of spinners) {
    try {
      const el = page.locator(spinner).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.waitFor({ state: 'hidden', timeout: 10000 });
      }
    } catch {}
  }
  await page.waitForTimeout(500);
}

// Helper: Click and handle new tab if opened
async function clickAndHandleNewTab(context: BrowserContext, page: Page, selector: string): Promise<Page> {
  const initialPages = context.pages().length;
  
  await page.locator(selector).click({ force: true });
  await page.waitForTimeout(1000);
  
  const currentPages = context.pages();
  if (currentPages.length > initialPages) {
    const newPage = currentPages[currentPages.length - 1];
    await newPage.waitForLoadState('domcontentloaded');
    await waitForPageReady(newPage);
    return newPage;
  }
  
  return page;
}

test('${this.escapeString(metadata.title || 'Recorded test')}', async ({ page, context }) => {
  // Navigate to starting URL
  await page.goto('${this.escapeString(startUrl)}');
  await waitForPageReady(page);

`;

    // First pass: remove obvious duplicates and invalid actions
    const cleanedActions = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const prev = i > 0 ? cleanedActions[cleanedActions.length - 1] : null;
      
      if (this.isRedundant(action, prev)) continue;
      
      // Skip fill on radio/checkbox (should never happen, but double-check)
      if (action.type === 'fill' && action.tagName === 'input' && 
          (action.inputType === 'radio' || action.inputType === 'checkbox')) {
        continue;
      }
      
      cleanedActions.push(action);
    }
    
    // Second pass: generate script from cleaned actions
    let previousAction = null;
    for (let i = 0; i < cleanedActions.length; i++) {
      const action = cleanedActions[i];
      const nextAction = i < cleanedActions.length - 1 ? cleanedActions[i + 1] : null;
      
      if (config.includeComments && action.description) {
        script += `  // ${action.description}\n`;
      }

      const actionCode = this.generateTypeScriptAction(action);
      if (actionCode && actionCode.trim()) { // Only add if action code is not empty
        script += actionCode;
        script += this.generateTypeScriptWait(action, nextAction);
        script += '\n';
      }
      previousAction = action;
    }

    script += `  // Test complete
});
`;

    return script;
  }

  generatePythonScript(actions, metadata, config) {
    const testName = this.toSnakeCase(metadata.title || 'recorded_test');
    
    // Fix starting URL - skip extension URLs
    let startUrl = metadata.startUrl || 'about:blank';
    if (startUrl.startsWith('chrome-extension://') || startUrl.startsWith('chrome://')) {
      // Find first real navigation action
      const firstNav = actions.find(a => a.type === 'navigate' && a.url && 
        !a.url.startsWith('chrome-extension://') && !a.url.startsWith('chrome://'));
      if (firstNav) {
        startUrl = firstNav.url;
      } else {
        startUrl = 'about:blank';
      }
    }
    
    let script = `import pytest
from playwright.sync_api import Page, expect, BrowserContext
import time


# ==================== Smart Helpers ====================
def wait_for_page_ready(page, timeout: int = 30000):
    """Wait for page to be fully loaded and interactive"""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except:
        pass
    
    # Wait for common loading indicators to disappear
    spinners = [
        ".slds-spinner",           # Salesforce
        ".loading-spinner",        # Generic
        "[class*='spinner']",      # Generic
        "[class*='loading']",      # Generic
        "[aria-busy='true']",      # ARIA
    ]
    
    for spinner in spinners:
        try:
            spinner_el = page.locator(spinner).first
            if spinner_el.is_visible(timeout=1000):
                spinner_el.wait_for(state="hidden", timeout=10000)
        except:
            pass  # Spinner not found or already hidden
    
    # Small delay for JavaScript rendering
    page.wait_for_timeout(500)


def safe_click(page, *selectors, timeout=10000):
    """Try multiple selectors until one works - self-healing click"""
    last_error = None
    for selector in selectors:
        try:
            element = page.locator(selector).first
            element.wait_for(state="visible", timeout=timeout)
            element.scroll_into_view_if_needed()
            element.click(force=True)
            return True
        except Exception as e:
            last_error = e
            continue
    
    # If all selectors failed, raise the last error
    if last_error:
        raise last_error
    return False


def click_and_handle_new_tab(context, page, selector, force=True):
    """Click element and switch to new tab if one opens"""
    # Get current page count
    initial_pages = len(context.pages)
    
    # Click the element
    page.locator(selector).click(force=force)
    
    # Wait briefly for potential new tab
    page.wait_for_timeout(1000)
    
    # Check if new tab opened
    current_pages = context.pages
    if len(current_pages) > initial_pages:
        # Switch to the new tab
        new_page = current_pages[-1]
        new_page.wait_for_load_state("domcontentloaded")
        wait_for_page_ready(new_page)
        return new_page
    
    return page


def test_${testName}(page: Page, context: BrowserContext):
    """
    ${metadata.title || 'Recorded Test'}
    Recorded on: ${new Date(metadata.timestamp).toISOString()}
    Starting URL: ${startUrl}
    
    Note: Uses 'context' fixture to handle multi-tab scenarios
    """
    # Navigate to starting URL
    page.goto("${this.escapeStringDouble(startUrl)}")
    wait_for_page_ready(page)

`;

    let previousAction = null;

    // First pass: remove obvious duplicates
    const cleanedActions = [];
    const seenNavigateUrls = new Set(); // Track ALL navigate URLs, not just last one
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const prev = i > 0 ? cleanedActions[cleanedActions.length - 1] : null;
      
      // Skip duplicate navigations to the same URL (check all previous navigations)
      if (action.type === 'navigate') {
        if (seenNavigateUrls.has(action.url)) {
          console.log(`[Flowstral] Skipping duplicate navigation to: ${action.url}`);
          continue; // Skip duplicate navigation
        }
        seenNavigateUrls.add(action.url);
      }
      
      // Skip data-id selectors - they're extension-generated and won't work in real tests
      // Check all possible selector locations
      const selectorStr = action.selector?.playwright || 
                         action.selector?.selector || 
                         action.selector?.primary?.playwright ||
                         action.selector?.primary?.selector ||
                         '';
      
      // Check for simple numeric data-id selectors (like [data-id="11"], [data-id="12"])
      const dataIdMatch = selectorStr.match(/\[data-id="(\d+)"\]/);
      if (dataIdMatch && dataIdMatch[1].length <= 3 && !selectorStr.includes('data-control-name')) {
        // This is an extension-generated data-id, try to use a better selector
        console.log(`[Flowstral] Detected extension-generated data-id selector: ${selectorStr}`);
        
        // Try fallback selectors in order of preference
        const fallbacks = action.selector?.fallbacks || [];
        let foundFallback = false;
        
        // Check ALL fallbacks (not just first one)
        for (const fallback of fallbacks) {
          const fbStr = fallback?.playwright || fallback?.selector || '';
          // Skip if fallback is also a data-id (check for simple numeric data-id)
          const fbDataIdMatch = fbStr.match(/\[data-id="(\d+)"\]/);
          if (!fbDataIdMatch || (fbDataIdMatch[1].length > 3) || fbStr.includes('data-control-name')) {
            // This fallback is good - use it
            console.log(`[Flowstral] Using fallback selector: ${fbStr}`);
            action.selector = fallback;
            foundFallback = true;
            break;
          }
        }
        
        // If no good fallback from fallbacks array, try primary selector
        if (!foundFallback && action.selector?.primary) {
          const primaryStr = action.selector.primary?.playwright || action.selector.primary?.selector || '';
          const primaryDataIdMatch = primaryStr.match(/\[data-id="(\d+)"\]/);
          if (!primaryDataIdMatch || (primaryDataIdMatch[1].length > 3) || primaryStr.includes('data-control-name')) {
            console.log(`[Flowstral] Using primary selector: ${primaryStr}`);
            action.selector = action.selector.primary;
            foundFallback = true;
          }
        }
        
        // Also check if selector object has name, title, or other attributes we can use
        if (!foundFallback) {
          const selectorObj = action.selector || {};
          if (selectorObj.name && !selectorObj.name.match(/^\d+$/)) {
            // Name attribute exists and is not just a number
            action.selector = { playwright: `locator('[name="${selectorObj.name}"]')`, selector: `[name="${selectorObj.name}"]` };
            foundFallback = true;
            console.log(`[Flowstral] Using name attribute from selector: ${selectorObj.name}`);
          } else if (selectorObj.title) {
            action.selector = { playwright: `locator('[title="${selectorObj.title}"]')`, selector: `[title="${selectorObj.title}"]` };
            foundFallback = true;
            console.log(`[Flowstral] Using title attribute from selector: ${selectorObj.title}`);
          }
        }
        
        // If still no good selector, try to generate one from action data
        if (!foundFallback) {
          console.log(`[Flowstral] No valid fallback selector found, generating selector from action data`);
          
          // Try to generate a selector from action description or text
          const generatedSelector = this.generateSelectorFromActionData(action);
          if (generatedSelector) {
            console.log(`[Flowstral] Generated selector from action data: ${generatedSelector}`);
            action.selector = { playwright: generatedSelector, selector: generatedSelector };
          } else {
            // Last resort: check if selector has any other attributes we can use
            const selectorData = action.selector || {};
            if (selectorData.name) {
              action.selector = { playwright: `locator('[name="${selectorData.name}"]')`, selector: `[name="${selectorData.name}"]` };
              console.log(`[Flowstral] Using name attribute: ${selectorData.name}`);
            } else if (selectorData.title) {
              action.selector = { playwright: `locator('[title="${selectorData.title}"]')`, selector: `[title="${selectorData.title}"]` };
              console.log(`[Flowstral] Using title attribute: ${selectorData.title}`);
            } else {
              console.log(`[Flowstral] Could not generate selector, skipping action`);
              continue; // Only skip if we truly can't generate anything
            }
          }
        }
      }
      
      if (this.isRedundant(action, prev)) continue;
      
      // Skip empty actions (filtered out fills on radio/checkbox)
      if (action.type === 'fill' && action.tagName === 'input' && 
          (action.inputType === 'radio' || action.inputType === 'checkbox')) {
        continue;
      }
      
      // CRITICAL: Skip actions with invalid selectors (visual locator comments)
      // Check both primary selector and nested structure
      const selectorPlaywright = action.selector?.playwright || action.selector?.primary?.playwright;
      const isVisualLocator = selectorPlaywright && (
        selectorPlaywright.trim().startsWith('//') || 
        selectorPlaywright.includes('Visual locator:')
      );
      
      if (isVisualLocator) {
        // Try to use fallback - be more aggressive about finding valid selectors
        const fallbacks = action.selector?.fallbacks || action.selector?.primary?.fallbacks || [];
        
        // First try: find a fallback with valid playwright selector
        let validFallback = fallbacks.find(f => {
          const fbPlaywright = f.playwright || f.primary?.playwright;
          return fbPlaywright && !fbPlaywright.trim().startsWith('//') && !fbPlaywright.includes('Visual locator:');
        });
        
        if (validFallback) {
          action.selector = validFallback;
        } else {
          // Second try: use any fallback with a CSS selector
          validFallback = fallbacks.find(f => f.selector || f.primary?.selector);
          if (validFallback) {
            action.selector = { selector: validFallback.selector || validFallback.primary?.selector };
          } else if (action.selector?.selector) {
            // Third try: use the primary selector's CSS selector
            action.selector = { selector: action.selector.selector };
          } else if (action.selector?.primary?.selector) {
            // Fourth try: use primary selector
            action.selector = { selector: action.selector.primary.selector };
          } else {
            // Last resort: use a generic locator instead of skipping
            console.warn(`[Flowstral] Action ${action.type} has no valid selector, using fallback locator("body")`);
            action.selector = { selector: 'body' };
          }
        }
      }
      
      cleanedActions.push(action);
    }
    
    // Second pass: generate script from cleaned actions
    for (let i = 0; i < cleanedActions.length; i++) {
      const action = cleanedActions[i];
      const nextAction = i < cleanedActions.length - 1 ? cleanedActions[i + 1] : null;
      
      if (config.includeComments && action.description) {
        script += `    # ${action.description}\n`;
      }

      const actionCode = this.generatePythonAction(action);
      if (actionCode) { // Only add if action code is not empty
        script += actionCode;
        script += this.generatePythonWait(action, nextAction);
        script += '\n';
      }
      previousAction = action;
    }

    script += `    # Test complete
`;

    // CRITICAL: Post-process to remove any visual locator comments that slipped through
    // Pattern 1: page.// Visual locator: ... -> replace with fallback
    script = script.replace(/page\.\s*\/\/\s*Visual\s+locator[^\n]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(/gi, 'page.locator("body").$1(');
    
    // Pattern 2: page.// Visual locator: ... (any method call)
    script = script.replace(/page\.\s*\/\/[^.]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(/gi, 'page.locator("body").$1(');
    
    // Pattern 3: Remove standalone lines with visual locators
    script = script.replace(/^\s*page\.\s*\/\/\s*Visual\s+locator[^\n]*$/gim, '');
    
    // Pattern 4: Remove any line that starts with page.// (catch-all)
    script = script.replace(/^\s*page\.\s*\/\/[^\n]*$/gim, '');
    
    // Pattern 5: Remove any line containing "Visual locator" anywhere
    script = script.replace(/^\s*.*Visual\s+locator.*$/gim, '');
    
    // Pattern 6: Remove any comment line with // Visual
    script = script.replace(/^\s*\/\/\s*Visual[^\n]*$/gim, '');
    
    // Pattern 7: Fix cases where visual locator is part of the selector string
    script = script.replace(/page\.([^.]*\/\/\s*Visual\s+locator[^.]*)\.[a-z_]+\(/gi, 'page.locator("body").click(');

    return script;
  }

  generateTypeScriptAction(action) {
    const selector = this.formatTypeScriptSelector(action.selector);

    switch (action.type) {
      case 'click': {
        // Check if this is a link that might open new tab
        const isLink = action.element === 'link' || action.tagName === 'a' || action.href;
        const mightOpenNewTab = isLink || action.opensNewTab || action.opens_new_tab;
        
        // For links, use clickAndHandleNewTab to auto-detect new tabs
        if (mightOpenNewTab) {
          return `  // Click (auto-handles new tab if opened)
  page = await clickAndHandleNewTab(context, page, '${selector}');
`;
        }
        
        // Simple click for buttons
        let clickCode = `  await page.${selector}.click({ force: true });\n`;
        clickCode += `  await waitForPageReady(page);\n`;
        return clickCode;
      }

      case 'dblclick':
        return `  await page.${selector}.dblclick();\n`;

      case 'switchToParent':
        return `  // Switch back to parent/original tab
  const pages = context.pages();
  if (pages.length > 1) {
    page = pages[0]; // Switch to first (parent) page
    await page.bringToFront();
  }
`;

      case 'closeTab':
        return `  // Close current tab and switch to parent
  await page.close();
  const remainingPages = context.pages();
  if (remainingPages.length > 0) {
    page = remainingPages[0];
    await page.bringToFront();
  }
`;

      case 'fill':
        // Never fill radio/checkbox - skip this action (should be filtered by isRedundant)
        if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
          return ''; // Skip - should use check instead
        }
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

      // Agentic auto-assertions (Phase 2)
      case 'assert':
        const assertSelector = this.formatTypeScriptSelector(action.selector);
        return `  await expect(page.${assertSelector}).toBeVisible();\n`;

      default:
        return `  // Unhandled action: ${action.type}\n`;
    }
  }

  generatePythonAction(action) {
    const selector = this.formatPythonSelector(action.selector);
    const isSalesforce = (action.app || '').includes('salesforce');
    const isRadioOrCheckbox = action.type === 'check' || action.type === 'uncheck';

    switch (action.type) {
      case 'click': {
        // Check if this is a link that might open new tab
        const isLink = action.element === 'link' || action.tagName === 'a' || action.href;
        const mightOpenNewTab = isLink || action.opensNewTab || action.opens_new_tab;
        
        // For links, use click_and_handle_new_tab to auto-detect new tabs
        if (mightOpenNewTab) {
          return `    # Click (auto-handles new tab if opened)
    page = click_and_handle_new_tab(context, page, "${selector}")
`;
        }
        
        // Simple click for buttons and non-link elements
        const opts = ['force=True'];  // Always use force for reliability
        if (action.button && action.button !== 'left') {
          opts.push(`button="${action.button}"`);
        }
        if (action.modifiers && action.modifiers.length) {
          opts.push(`modifiers=[${action.modifiers.map(m => `"${m}"`).join(', ')}]`);
        }
        const args = opts.join(', ');
        return `    page.${selector}.click(${args})
    wait_for_page_ready(page)
`;
      }

      case 'dblclick':
        return `    page.${selector}.dblclick()\n`;

      case 'switchToParent':
        return `    # Switch back to parent/original tab
    pages = context.pages
    if len(pages) > 1:
        page = pages[0]  # Switch to first (parent) page
        page.bring_to_front()
`;

      case 'closeTab':
        return `    # Close current tab and switch to parent
    page.close()
    remaining_pages = context.pages
    if len(remaining_pages) > 0:
        page = remaining_pages[0]
        page.bring_to_front()
`;

      case 'fill':
        // Never fill radio/checkbox - skip this action
        if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
          return ''; // Skip - should use check instead
        }
        return `    page.${selector}.fill("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'type':
        return `    page.${selector}.type("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'select':
        if (action.label) {
          return `    page.${selector}.select_option(label="${this.escapeStringDouble(action.label)}")\n`;
        }
        return `    page.${selector}.select_option("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'check': {
        // For Salesforce, prefer clicking the visible label/text instead of strict check on hidden inputs
        if (isSalesforce && this.isInteractiveSelector(action.selector)) {
          return `    page.${selector}.click(force=True)\n`;
        }
        return `    page.${selector}.check()\n`;
      }

      case 'uncheck': {
        if (isSalesforce && this.isInteractiveSelector(action.selector)) {
          return `    page.${selector}.click(force=True)\n`;
        }
        return `    page.${selector}.uncheck()\n`;
      }

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

      // Agentic auto-assertions (Phase 2)
      case 'assert':
        const assertSelector = this.formatPythonSelector(action.selector);
        return `    expect(page.${assertSelector}).to_be_visible()\n`;

      default:
        return `    # Unhandled action: ${action.type}\n`;
    }
  }

  generateTypeScriptWait(action, nextAction) {
    let code = '';
    
    // Only add wait after navigation
    if (action.type === 'navigate') {
      code += `  await page.waitForLoadState('networkidle');\n`;
      return code;
    }
    
    // Skip waits for form inputs (fill/type) - they're fast
    if (action.type === 'fill' || action.type === 'type') {
      return code;
    }
    
    // Skip waits for check/uncheck - they're instant
    if (action.type === 'check' || action.type === 'uncheck') {
      return code;
    }
    
    // Only wait after actions that might trigger navigation or major DOM changes
    if (action.triggersNavigation) {
      code += `  await page.waitForLoadState('networkidle');\n`;
    } else if (action.type === 'click' && action.mightTriggerChange && nextAction) {
      // Only wait if next action is different (page might have changed)
      if (nextAction.type !== action.type || this.getSelectorString(nextAction.selector) !== this.getSelectorString(action.selector)) {
        code += `  await page.waitForLoadState('domcontentloaded');\n`;
      }
    }
    
    return code;
  }

  generatePythonWait(action, nextAction) {
    let code = '';
    
    // Only add wait after navigation
    if (action.type === 'navigate') {
      code += `    page.wait_for_load_state("networkidle")\n`;
      return code;
    }
    
    // Skip waits for form inputs (fill/type) - they're fast
    if (action.type === 'fill' || action.type === 'type') {
      return code;
    }
    
    // Skip waits for check/uncheck - they're instant
    if (action.type === 'check' || action.type === 'uncheck') {
      return code;
    }
    
    // Only wait after actions that might trigger navigation or major DOM changes
    if (action.triggersNavigation) {
      code += `    page.wait_for_load_state("networkidle")\n`;
    } else if (action.type === 'click' && action.mightTriggerChange && nextAction) {
      // Only wait if next action is different (page might have changed)
      if (nextAction.type !== action.type || this.getSelectorString(nextAction.selector) !== this.getSelectorString(action.selector)) {
        code += `    page.wait_for_load_state("domcontentloaded")\n`;
      }
    }
    
    return code;
  }

  formatTypeScriptSelector(selectorData) {
    if (!selectorData) return "locator('body')";

    // Skip visual locator comments - they're not valid code
    if (selectorData.playwright) {
      const playwright = selectorData.playwright;
      // If it's a comment (visual locator), use fallback
      if (playwright.trim().startsWith('//')) {
        // Try to use selector or fallback
        if (selectorData.selector) {
          return `locator('${this.escapeString(selectorData.selector)}')`;
        }
        // Use fallback selectors if available
        if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
          const fallback = selectorData.fallbacks[0];
          if (fallback.playwright && !fallback.playwright.trim().startsWith('//')) {
            return fallback.playwright;
          }
          if (fallback.selector) {
            return `locator('${this.escapeString(fallback.selector)}')`;
          }
        }
        return "locator('body')"; // Last resort
      }
      return playwright;
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

    // Helper to check if a string is a visual locator comment
    const isVisualLocator = (str) => {
      if (!str || typeof str !== 'string') return false;
      const trimmed = str.trim();
      return trimmed.startsWith('//') || trimmed.includes('Visual locator:') || trimmed.startsWith('page.//');
    };

    // Helper to check if a selector is a simple data-id selector (extension-generated)
    const isSimpleDataId = (str) => {
      if (!str || typeof str !== 'string') return false;
      // Check for [data-id="11"], [data-id="12"] etc (simple numeric IDs)
      const dataIdMatch = str.match(/\[data-id="(\d+)"\]/);
      if (dataIdMatch && dataIdMatch[1].length <= 3 && !str.includes('data-control-name')) {
        return true; // This is an extension-generated data-id
      }
      return false;
    };

    // Skip visual locator comments - they're not valid code
    if (selectorData.playwright) {
      const playwright = selectorData.playwright;
      // If it's a comment (visual locator), use fallback
      if (isVisualLocator(playwright)) {
        // Try to use selector or fallback (but check it's not also a visual locator)
        if (selectorData.selector && !isVisualLocator(selectorData.selector)) {
          return `locator("${this.escapeStringDouble(selectorData.selector)}")`;
        }
        // Use fallback selectors if available
        if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
          for (const fallback of selectorData.fallbacks) {
            if (fallback.playwright && !isVisualLocator(fallback.playwright)) {
              return this.convertToPythonSelector(fallback.playwright);
            }
            if (fallback.selector && !isVisualLocator(fallback.selector)) {
              return `locator("${this.escapeStringDouble(fallback.selector)}")`;
            }
          }
        }
        return 'locator("body")'; // Last resort
      }
      // Before converting, double-check it's not a visual locator or simple data-id
      if (isVisualLocator(playwright) || isSimpleDataId(playwright)) {
        // Try fallbacks
        if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
          for (const fallback of selectorData.fallbacks) {
            if (fallback.playwright && !isVisualLocator(fallback.playwright) && !isSimpleDataId(fallback.playwright)) {
              return this.convertToPythonSelector(fallback.playwright);
            }
            if (fallback.selector && !isVisualLocator(fallback.selector) && !isSimpleDataId(fallback.selector)) {
              return `locator("${this.escapeStringDouble(fallback.selector)}")`;
            }
          }
        }
        // Try primary selector if available
        if (selectorData.primary && !isSimpleDataId(selectorData.primary.selector || selectorData.primary.playwright || '')) {
          if (selectorData.primary.playwright) {
            return this.convertToPythonSelector(selectorData.primary.playwright);
          }
          if (selectorData.primary.selector) {
            return `locator("${this.escapeStringDouble(selectorData.primary.selector)}")`;
          }
        }
        return 'locator("body")'; // Last resort
      }
      return this.convertToPythonSelector(playwright);
    }

    if (selectorData.selector) {
      // Check if selector itself is a visual locator or simple data-id
      if (isVisualLocator(selectorData.selector) || isSimpleDataId(selectorData.selector)) {
        // Try fallbacks
        if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
          for (const fallback of selectorData.fallbacks) {
            if (fallback.playwright && !isVisualLocator(fallback.playwright) && !isSimpleDataId(fallback.playwright)) {
              return this.convertToPythonSelector(fallback.playwright);
            }
            if (fallback.selector && !isVisualLocator(fallback.selector) && !isSimpleDataId(fallback.selector)) {
              return `locator("${this.escapeStringDouble(fallback.selector)}")`;
            }
          }
        }
        // Try primary selector if available
        if (selectorData.primary && !isSimpleDataId(selectorData.primary.selector || selectorData.primary.playwright || '')) {
          if (selectorData.primary.playwright) {
            return this.convertToPythonSelector(selectorData.primary.playwright);
          }
          if (selectorData.primary.selector) {
            return `locator("${this.escapeStringDouble(selectorData.primary.selector)}")`;
          }
        }
        return 'locator("body")'; // Last resort
      }
      return `locator("${this.escapeStringDouble(selectorData.selector)}")`;
    }

    if (typeof selectorData === 'string') {
      if (isVisualLocator(selectorData) || isSimpleDataId(selectorData)) {
        return 'locator("body")'; // Last resort
      }
      return `locator("${this.escapeStringDouble(selectorData)}")`;
    }

    return 'locator("body")';
  }

  convertToPythonSelector(tsSelector) {
    // CRITICAL: Skip visual locator comments - they're not valid selectors
    if (!tsSelector || typeof tsSelector !== 'string') {
      return 'locator("body")';
    }
    
    const trimmed = tsSelector.trim();
    if (trimmed.startsWith('//') || trimmed.includes('Visual locator:') || trimmed.startsWith('page.//')) {
      return 'locator("body")'; // Return fallback instead
    }
    
    // Handle full method calls like: page.getByRole('button', { name: 'Next' })
    // Convert to Python: page.get_by_role('button', name='Next')
    let result = tsSelector
      .replace(/getByTestId\(/g, 'get_by_test_id(')
      .replace(/getByRole\(/g, 'get_by_role(')
      .replace(/getByLabel\(/g, 'get_by_label(')
      .replace(/getByPlaceholder\(/g, 'get_by_placeholder(')
      .replace(/getByText\(/g, 'get_by_text(')
      .replace(/getByAltText\(/g, 'get_by_alt_text(')
      .replace(/getByTitle\(/g, 'get_by_title(');
    
    // Convert TypeScript object syntax to Python kwargs
    // { name: 'Next' } -> name='Next'
    result = result.replace(/\{\s*name:\s*['"]([^'"]+)['"]\s*\}/g, "name='$1'");
    result = result.replace(/\{\s*hasText:\s*['"]([^'"]+)['"]\s*\}/g, "has_text='$1'");
    
    // Convert single quotes to double quotes for strings (Python style)
    // But preserve quotes in method calls
    result = result.replace(/'/g, '"');
    
    // Fix filter syntax: .filter({ name: 'Next' }) -> .filter(name='Next')
    result = result.replace(/\.filter\(\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\s*\)/g, ".filter(name='$1')");
    result = result.replace(/\.filter\(\s*\{\s*hasText:\s*['"]([^'"]+)['"]\s*\}\s*\)/g, ".filter(has_text='$1')");
    
    return result;
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
    
    const actionSelector = this.getSelectorString(action.selector);
    const prevSelector = this.getSelectorString(prev.selector);
    
    // Skip duplicate navigations to same URL
    if (action.type === 'navigate' && prev.type === 'navigate') {
      if (action.url === prev.url) return true;
    }
    
    // Skip duplicate button clicks (same button, same text, within 500ms)
    if (action.type === 'click' && prev.type === 'click') {
      if (action.description === prev.description && action.timestamp - prev.timestamp < 500) {
        return true;
      }
    }
    
    // Skip duplicate actions on same element within short time
    if (actionSelector === prevSelector && actionSelector) {
      // Same element, check if redundant
      if (action.timestamp - prev.timestamp < 500) {
        // Multiple actions on same element - keep only the most specific one
        const actionPriority = this.getActionPriority(action.type);
        const prevPriority = this.getActionPriority(prev.type);
        
        // If current action is less specific, skip it
        if (actionPriority < prevPriority) return true;
        
        // If same priority, skip duplicates
        if (actionPriority === prevPriority && action.type === prev.type) return true;
        
        // Skip fill after check on radio/checkbox
        if (prev.type === 'check' && action.type === 'fill') {
          return true; // Check is enough, don't fill
        }
      }
    }
    
    // Skip click before check/uncheck on same element (check/uncheck already includes click)
    if (prev.type === 'click' && (action.type === 'check' || action.type === 'uncheck')) {
      if (actionSelector === prevSelector && action.timestamp - prev.timestamp < 500) {
        return true; // Skip the click, keep the check
      }
    }
    
    // Skip fill on radio/checkbox elements (use check instead)
    if (action.type === 'fill') {
      if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
        return true; // Never fill radio/checkbox
      }
    }
    
    // Skip clicks on generic spans/labels that are just wrappers
    if (action.type === 'click') {
      const selector = actionSelector.toLowerCase();
      if (selector.includes('span') && selector.includes('nth-of-type') && 
          prev.type === 'check' && action.timestamp - prev.timestamp < 500) {
        return true; // Skip click on span wrapper if check just happened
      }
    }
    
    // Skip redundant waits
    if (action.type === 'wait') {
      return true;
    }
    
    return false;
  }

  getSelectorString(selector) {
    if (!selector) return '';
    if (typeof selector === 'string') return selector;
    return selector.selector || selector.playwright || '';
  }

  getActionPriority(type) {
    // Higher number = more specific/important
    const priorities = {
      'navigate': 10,
      'fill': 8,
      'select': 8,
      'check': 7,
      'uncheck': 7,
      'click': 5,
      'type': 6,
      'press': 4,
      'hover': 3,
      'wait': 1,
    };
    return priorities[type] || 0;
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
    // Clear ALL state for fresh start
    this.state.actions = [];
    this.state.metadata = {};
    this.state.recording = false;
    this.state.activeTabId = null;
    this.state.startUrl = null;
    this.state.startTime = null;
    
    // Clear from storage too (including cached scripts)
    chrome.storage.local.remove('recorderState');
    chrome.storage.local.remove('flowstral_script'); // Clear any cached script
  }

  async saveState() {
    await chrome.storage.local.set({
      recorderState: {
        recording: this.state.recording,
        activeTabId: this.state.activeTabId,
        trackedTabs: Array.from(this.state.trackedTabs || []),  // Serialize Set as array
        currentTabId: this.state.currentTabId,
        actions: this.state.actions,
        metadata: this.state.metadata,
        startUrl: this.state.startUrl,
      },
    });
  }

  generateTestCases(actions, format, testName = 'Recorded Test') {
    switch (format) {
      case 'istqb': return this.generateISTQB(actions, testName);
      case 'gherkin': return this.generateGherkin(actions, testName);
      case 'markdown': return this.generateMarkdown(actions, testName);
      default: return this.generateMarkdown(actions, testName);
    }
  }

  generateISTQB(actions, testName) {
    const border = '═'.repeat(76);
    const appType = this.state.metadata.appType || 'generic';
    let output = `
╔${border}╗
║${'TEST CASE SPECIFICATION'.padStart(49).padEnd(76)}║
╠${border}╣
║ Test Case ID    : TC_${Date.now().toString().slice(-8).padEnd(56)}║
║ Title           : ${testName.substring(0, 56).padEnd(56)}║
║ App Type        : ${appType.padEnd(56)}║
║ Priority        : ${'Medium'.padEnd(56)}║
║ Estimated Time  : ${(Math.ceil(actions.length * 0.25) + ' minutes').padEnd(56)}║
╠${border}╣
║ PRECONDITIONS                                                                ║
╠${border}╣
║ 1. Application is accessible and functional                                  ║
║ 2. User has valid credentials (if required)                                  ║
║ 3. Test environment is stable                                                ║
╠${border}╣
║ TEST STEPS                                                                   ║
╠═════╦${'═'.repeat(38)}╦${'═'.repeat(31)}╣
║ #   ║ ACTION${' '.repeat(32)}║ EXPECTED RESULT${' '.repeat(15)}║
╠═════╬${'─'.repeat(38)}╬${'─'.repeat(31)}╣
`;

    let stepNum = 1;
    actions.forEach((action, i) => {
      if (action.type === 'navigate' && i > 0) return;
      
      const actionText = this.formatActionText(action).substring(0, 36).padEnd(36);
      const expected = this.formatExpectedResult(action).substring(0, 29).padEnd(29);
      output += `║ ${stepNum.toString().padEnd(3)} ║ ${actionText} ║ ${expected} ║\n`;
      stepNum++;
    });

    output += `╠═════╩${'═'.repeat(38)}╩${'═'.repeat(31)}╣
║ POSTCONDITIONS                                                               ║
╠${border}╣
║ 1. System returns to stable state                                            ║
║ 2. No error messages displayed                                               ║
╚${border}╝
`;
    return output;
  }

  generateGherkin(actions, testName) {
    const featureName = testName.replace(/[-_]/g, ' ');
    const appType = this.state.metadata.appType || 'generic';
    const language = this.state.metadata.language || 'typescript';
    
    let output = `@automated @${appType.replace('-', '_')}
Feature: ${featureName}
  As a user
  I want to complete the workflow
  So that I can achieve my goal

  Background:
    Given the application is accessible
    And all prerequisites are met

  @smoke @e2e
  Scenario: ${testName}
`;

    let isFirst = true;
    for (const action of actions) {
      if (action.type === 'navigate' && !isFirst) continue;
      
      let keyword;
      if (action.type === 'navigate') {
        keyword = 'Given';
      } else {
        keyword = isFirst ? 'When' : 'And';
        isFirst = false;
      }

      output += `    ${keyword} ${this.formatGherkinStep(action)}\n`;
    }

    output += `\n  # Step Definitions Reference (${language === 'python' ? 'Behave/pytest-bdd' : 'Cucumber.js'})
  # This scenario was auto-generated from recorded actions
`;

    return output;
  }

  generateMarkdown(actions, testName) {
    const appType = this.state.metadata.appType || 'generic';
    const language = this.state.metadata.language || 'typescript';
    
    let output = `# Test Case: ${testName}\n\n`;
    
    output += `## Overview\n\n`;
    output += `| Property | Value |\n|----------|-------|\n`;
    output += `| **Test ID** | TC_${Date.now().toString().slice(-8)} |\n`;
    output += `| **App Type** | ${appType} |\n`;
    output += `| **Generated** | ${new Date().toISOString()} |\n`;
    output += `| **Language** | ${language === 'python' ? 'Python' : 'TypeScript'} |\n`;
    output += `| **Steps** | ${actions.length} |\n\n`;

    output += `## Preconditions\n\n`;
    output += `- Application is accessible\n`;
    output += `- User has required permissions\n`;
    output += `- Test environment is stable\n\n`;

    output += `## Test Steps\n\n`;
    output += `| # | Action | Test Data | Expected Result |\n`;
    output += `|---|--------|-----------|----------------|\n`;

    actions.forEach((action, i) => {
      const actionText = this.formatActionText(action);
      const data = action.value || action.text || '-';
      const expected = this.formatExpectedResult(action);
      output += `| ${i + 1} | ${actionText} | ${data} | ${expected} |\n`;
    });

    output += `\n## Automation Code\n\n`;
    output += `The test script is available in ${language === 'python' ? 'Python' : 'TypeScript'} format.\n`;
    output += `Download using the extension's Generate tab.\n`;

    output += `\n## Notes\n\n`;
    output += `- This test case was auto-generated from browser recording\n`;
    output += `- Review and adjust expected results for your specific requirements\n`;
    output += `- Add assertions as needed for validation\n`;

    return output;
  }

  formatActionText(action) {
    switch (action.type) {
      case 'navigate': return `Navigate to page`;
      case 'click': return `Click ${action.text?.substring(0, 25) || action.description?.substring(0, 25) || 'element'}`;
      case 'fill': return `Enter "${action.value?.substring(0, 15) || ''}"`;
      case 'check': return `Select ${action.text?.substring(0, 25) || 'option'}`;
      case 'uncheck': return `Deselect option`;
      case 'select': return `Choose "${action.value?.substring(0, 15) || ''}"`;
      case 'press': return `Press ${action.key} key`;
      default: return action.type;
    }
  }

  formatExpectedResult(action) {
    switch (action.type) {
      case 'navigate': return 'Page loads successfully';
      case 'click': return 'Element responds';
      case 'fill': return 'Field accepts input';
      case 'check': return 'Option is selected';
      case 'uncheck': return 'Option is deselected';
      case 'select': return 'Value is selected';
      case 'press': return 'Key action registered';
      default: return 'Success';
    }
  }

  generateSelectorFromActionData(action) {
    // Try to generate a Playwright selector from available action data
    if (!action) return null;
    
    // Extract text from description (e.g., "Click 'Get involved'" -> "Get involved")
    const description = action.description || '';
    const textMatch = description.match(/['"]([^'"]+)['"]/);
    const text = textMatch ? textMatch[1] : (action.text || '');
    
    // For click actions, try getByRole or getByText
    if (action.type === 'click' && text) {
      // Try to determine role from description or tagName
      let role = 'button';
      if (description.toLowerCase().includes('link') || action.tagName === 'a') {
        role = 'link';
      } else if (description.toLowerCase().includes('button') || action.tagName === 'button') {
        role = 'button';
      }
      
      if (text.length > 0 && text.length < 50) {
        return `getByRole('${role}', { name: '${this.escapeString(text)}' })`;
      }
    }
    
    // For fill actions, try getByLabel or getByPlaceholder
    if (action.type === 'fill') {
      const label = action.label || action.placeholder || text;
      if (label && label.length > 0 && label.length < 50) {
        return `getByLabel('${this.escapeString(label)}')`;
      }
    }
    
    // For check/uncheck, try getByRole with text
    if ((action.type === 'check' || action.type === 'uncheck') && text) {
      if (text.length > 0 && text.length < 50) {
        return `getByRole('checkbox', { name: '${this.escapeString(text)}' })`;
      }
    }
    
    // If we have a name attribute, use it
    if (action.name) {
      return `locator('[name="${this.escapeString(action.name)}"]')`;
    }
    
    // If we have a title attribute, use it
    if (action.title) {
      return `locator('[title="${this.escapeString(action.title)}"]')`;
    }
    
    return null;
  }

  escapeString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  formatGherkinStep(action) {
    switch (action.type) {
      case 'navigate': return `I am on the application page`;
      case 'click': return `I click on "${action.text?.substring(0, 30) || action.description?.substring(0, 30) || 'the element'}"`;
      case 'fill': return `I enter "${action.value || 'value'}" in the input field`;
      case 'check': return `I select the "${action.text?.substring(0, 30) || 'option'}"`;
      case 'uncheck': return `I deselect the option`;
      case 'select': return `I choose "${action.value || 'value'}" from the dropdown`;
      case 'press': return `I press the "${action.key}" key`;
      default: return `I perform ${action.type} action`;
    }
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
      const response = await fetch(`${API_BASE_URL}/api/flowstral/generate`, {
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

// Open sidebar when extension icon is clicked (instead of popup)
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Open the side panel for the current window
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Set side panel behavior to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // Older Chrome versions may not support this
});
