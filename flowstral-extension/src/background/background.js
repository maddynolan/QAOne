/**
 * Background Service Worker
 * Manages recording state across tabs and generates test scripts
 * 
 * v2.0 - Added Network Capture for Protocol-Level Testing
 * Better than LoadRunner/NeoLoad: Browser-native, no proxy needed
 */

// Import shared modules
importScripts('../lib/api-config.js');
importScripts('../lib/network-capture.js');

// Import extracted helper modules
importScripts('background-utils.js');
importScripts('background-script-generators.js');
importScripts('background-test-case-generators.js');

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
      // NEW: Network capture settings
      captureNetwork: false,   // Toggle for network capture (default OFF - enable for load testing)
      networkData: null,       // Captured HTTP requests
    };
    
    // Initialize Network Capture
    this.networkCapture = new NetworkCapture();
    
    this.init();
  }

  async init() {
    // Initialize centralized URL config and listen for settings changes
    await initApiConfig();
    listenForConfigChanges();

    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Listen for tab updates - ONLY for content script injection, NOT navigation recording
    // Navigation recording is handled by content.js to avoid duplicates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (this.state.recording && this.state.trackedTabs.has(tabId)) {
        // When tab finishes loading, inject content script
        // (navigation events are recorded by content.js, not here - prevents duplicates)
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
        // Request host permission if needed (optional_host_permissions)
        const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
        if (!hasPermission) {
          const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
          if (!granted) {
            console.warn('[Background] Host permission denied by user');
            return;
          }
        }

        // Inject CSS first
        await chrome.scripting.insertCSS({
          target: { tabId: tabId, allFrames: true },
          files: ['src/content/content.css']
        }).catch(() => {});

        // Inject content scripts in order: shared engine → coalescer → recorder
        await chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: true },
          files: [
            'src/lib/recorder-engine.js',
            'src/lib/action-coalescer-browser.js',
            'src/content/content-app-selector-config.js',
            'src/content/content-computer-vision.js',
            'src/content/content-synthetic-data.js',
            'src/content/content-page-analyzer.js',
            'src/content/content-smart-selector.js',
            'src/content/content.js'
          ]
        });
        console.log('[Background] Injected content scripts into tab:', tabId);

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
          isRecording: this.state.recording,  // Also send isRecording for content script compatibility
          paused: this.state.paused,
          actionCount: this.state.actions.length,
          startUrl: this.state.startUrl,
          options: { appType: this.state.appType || 'auto' },
          // NEW: Network capture status
          captureNetwork: this.state.captureNetwork,
          networkRequestCount: this.networkCapture?.completedRequests?.length || 0,
          sessionId: this.state.sessionId,
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

        const newAction = message.action;
        
        // ENHANCED DEDUPLICATION: Multiple strategies
        // 1. Exact timestamp match (original check)
        const actionSignature = `${newAction.type}_${newAction.timestamp}_${newAction.url || newAction.value || newAction.description || ''}`;
        const isExactDuplicate = this.state.actions.some(a => {
          const existingSignature = `${a.type}_${a.timestamp}_${a.url || a.value || a.description || ''}`;
          return existingSignature === actionSignature;
        });
        
        if (isExactDuplicate) {
          console.log('[Background] Skipping exact duplicate action:', newAction.type);
          sendResponse({ count: this.state.actions.length, duplicate: true });
          break;
        }
        
        // 2. SEMANTIC DEDUPLICATION for fill actions - same selector within time window = update
        if (newAction.type === 'fill' && newAction.selector) {
          const newSelStr = this.normalizeSelector(this.getSelectorString(newAction.selector));
          const now = newAction.timestamp;
          
          // Only look at recent actions (last 30 seconds) to avoid updating old fills
          // Search backwards from end for efficiency
          let existingFillIdx = -1;
          for (let i = this.state.actions.length - 1; i >= 0; i--) {
            const a = this.state.actions[i];
            // Stop searching if action is too old (more than 30 seconds ago)
            if (now - a.timestamp > 30000) break;
            
            if (a.type === 'fill' && a.selector) {
              const existingSelStr = this.normalizeSelector(this.getSelectorString(a.selector));
              if (existingSelStr === newSelStr) {
                existingFillIdx = i;
                break;
              }
            }
          }
          
          if (existingFillIdx >= 0) {
            // Update existing fill instead of adding duplicate
            console.log('[Background] Updating existing fill action (within 30s window)');
            this.state.actions[existingFillIdx].value = newAction.value;
            this.state.actions[existingFillIdx].displayValue = newAction.displayValue;
            this.state.actions[existingFillIdx].timestamp = newAction.timestamp;
            this.saveState();
            sendResponse({ count: this.state.actions.length, updated: true });
            chrome.runtime.sendMessage({ type: 'ACTION_UPDATED', action: this.state.actions[existingFillIdx] }).catch(() => {});
            break;
          }
        }
        
        // 3. Click/Hover deduplication - if we have hover then click on same element, keep only click
        let skipClickHover = false;
        if ((newAction.type === 'click' || newAction.type === 'hover') && newAction.selector) {
          const newSelStr = this.normalizeSelector(this.getSelectorString(newAction.selector));
          const now = newAction.timestamp;
          
          // Look for same-element click/hover within last 3 seconds
          for (let i = this.state.actions.length - 1; i >= Math.max(0, this.state.actions.length - 10); i--) {
            const a = this.state.actions[i];
            if ((a.type === 'click' || a.type === 'hover') && a.selector) {
              const existingSelStr = this.normalizeSelector(this.getSelectorString(a.selector));
              const timeDiff = Math.abs(now - a.timestamp);
              
              if (existingSelStr === newSelStr && timeDiff < 3000) {
                // Same element within 3 seconds
                if (newAction.type === 'click' && a.type === 'hover') {
                  // Click after hover - remove hover, add click
                  console.log('[Background] Click after hover on same element - removing hover');
                  this.state.actions.splice(i, 1);
                  // Continue to add the click
                } else if (newAction.type === 'hover' && a.type === 'click') {
                  // Hover after click - skip hover entirely
                  console.log('[Background] Hover after click on same element - skipping hover');
                  sendResponse({ count: this.state.actions.length, duplicate: true });
                  skipClickHover = true;
                  break;
                } else if (newAction.type === a.type) {
                  // Same action type within 3 seconds - skip duplicate
                  console.log('[Background] Same action type on same element within 3s - skipping');
                  sendResponse({ count: this.state.actions.length, duplicate: true });
                  skipClickHover = true;
                  break;
                }
              }
            }
          }
        }
        
        if (skipClickHover) break; // Exit switch case if we already handled it
        
        // 4. Time-window deduplication: Same type + SAME selector within 2 seconds = duplicate
        // (Description-based was too broad - different actions can have similar descriptions)
        let recentDupe = false;
        const newSelStr = newAction.selector ? this.normalizeSelector(this.getSelectorString(newAction.selector)) : '';
        
        for (let i = this.state.actions.length - 1; i >= Math.max(0, this.state.actions.length - 20); i--) {
          const a = this.state.actions[i];
          if (a.type !== newAction.type) continue;
          
          const timeDiff = Math.abs(newAction.timestamp - a.timestamp);
          if (timeDiff > 2000) continue;
          
          // For actions with selectors, require SAME selector (not just similar description)
          if (newSelStr) {
            const aSel = a.selector ? this.normalizeSelector(this.getSelectorString(a.selector)) : '';
            if (aSel === newSelStr) {
              recentDupe = true;
              break;
            }
          } else {
            // For actions without selectors (like navigate), check FULL description match
            if (a.description === newAction.description) {
              recentDupe = true;
              break;
            }
          }
        }
        
        if (recentDupe) {
          console.log('[Background] Skipping recent duplicate (within 2s, same selector):', newAction.type);
          sendResponse({ count: this.state.actions.length, duplicate: true });
          break;
        }

        // Not a duplicate - add it
        this.state.actions.push(newAction);
        this.saveState();
        console.log('[Background] Total actions now:', this.state.actions.length);
        sendResponse({ count: this.state.actions.length });
        // Broadcast to side panel for live updates
        chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action: newAction }).catch(() => {});
        break;

      case 'SAVE_ACTIONS':
        // CRITICAL FIX: Enhanced deduplication on page unload/navigation
        if (message.actions && message.actions.length > 0) {
          // Build maps for existing actions
          const existingSignatures = new Set(
            this.state.actions.map(a => `${a.type}_${a.timestamp}_${a.url || a.value || a.description || ''}`)
          );
          
          // Build a map of existing fill action selectors for semantic dedup
          const existingFillSelectors = new Map();
          this.state.actions.forEach((a, idx) => {
            if (a.type === 'fill' && a.selector) {
              const selStr = this.normalizeSelector(this.getSelectorString(a.selector));
              if (selStr) existingFillSelectors.set(selStr, idx);
            }
          });
          
          let newActionsAdded = 0;
          let actionsUpdated = 0;
          
          for (const action of message.actions) {
            const signature = `${action.type}_${action.timestamp}_${action.url || action.value || action.description || ''}`;
            
            // Check exact duplicate
            if (existingSignatures.has(signature)) {
              continue;
            }
            
            // For fill actions, check semantic duplicate (same selector)
            if (action.type === 'fill' && action.selector) {
              const selStr = this.normalizeSelector(this.getSelectorString(action.selector));
              if (existingFillSelectors.has(selStr)) {
                // Update existing fill instead of adding new
                const existingIdx = existingFillSelectors.get(selStr);
                this.state.actions[existingIdx].value = action.value;
                this.state.actions[existingIdx].displayValue = action.displayValue;
                this.state.actions[existingIdx].timestamp = action.timestamp;
                actionsUpdated++;
                continue;
              }
            }
            
            // Not a duplicate - add it
            this.state.actions.push(action);
            existingSignatures.add(signature);
            if (action.type === 'fill' && action.selector) {
              const selStr = this.normalizeSelector(this.getSelectorString(action.selector));
              if (selStr) existingFillSelectors.set(selStr, this.state.actions.length - 1);
            }
            newActionsAdded++;
          }
          
          console.log(`[Background] SAVE_ACTIONS: ${newActionsAdded} new, ${actionsUpdated} updated, ${message.actions.length - newActionsAdded - actionsUpdated} skipped`);
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
      
      // ============ NETWORK CAPTURE CONTROLS ============
      case 'TOGGLE_NETWORK_CAPTURE':
        this.state.captureNetwork = message.enabled !== false;
        console.log('[Background] Network capture toggled:', this.state.captureNetwork);
        
        // If already recording, start/stop network capture accordingly
        if (this.state.recording) {
          if (this.state.captureNetwork) {
            try {
              this.networkCapture.start(this.state.sessionId || `session_${Date.now()}`);
              console.log('[Background] Network capture started mid-recording');
            } catch (error) {
              console.warn('[Background] Failed to start network capture:', error.message);
            }
          } else {
            try {
              this.networkCapture.stop();
              console.log('[Background] Network capture stopped mid-recording');
            } catch (error) {
              console.warn('[Background] Failed to stop network capture:', error.message);
            }
          }
        }
        
        sendResponse({ success: true, captureNetwork: this.state.captureNetwork });
        break;
      
      case 'GET_NETWORK_STATUS':
        sendResponse({
          enabled: this.state.captureNetwork,
          isCapturing: this.state.recording && this.state.captureNetwork,
          requestCount: this.networkCapture?.completedRequests?.length || 0,
        });
        break;
      
      case 'GET_NETWORK_DATA':
        // Return full network capture data (for Builder export)
        // First check if we have saved network data from a stopped recording
        if (this.state.networkData && this.state.networkData.requests?.length > 0) {
          console.log('[Background] GET_NETWORK_DATA: returning saved data with', this.state.networkData.requests.length, 'requests');
          sendResponse({ networkData: this.state.networkData });
        } else if (this.networkCapture && this.networkCapture.completedRequests?.length > 0) {
          // Otherwise get current capture data
          const liveData = {
            requests: this.networkCapture.completedRequests || [],
            statistics: this.networkCapture._calculateStatistics?.() || {},
            correlations: Array.from(this.networkCapture.detectedCorrelations?.entries() || []).map(([name, values]) => ({
              name,
              values: Array.from(values)
            })),
          };
          console.log('[Background] GET_NETWORK_DATA: returning live data with', liveData.requests.length, 'requests');
          sendResponse({ networkData: liveData });
        } else {
          console.log('[Background] GET_NETWORK_DATA: no data available');
          sendResponse({ networkData: null });
        }
        break;
      
      case 'EXPORT_HAR':
        // Export current session as HAR
        if (this.networkCapture && this.state.networkData) {
          const har = this.networkCapture.exportAsHAR ? 
            this.networkCapture.exportAsHAR() : 
            this._convertToHAR(this.state.networkData);
          sendResponse({ success: true, har });
        } else {
          sendResponse({ success: false, error: 'No network data available' });
        }
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

  async startRecording(tabId, options = {}) {
    if (this.state.recording) {
      await this.stopRecording();
    }

    // Request optional permissions needed for recording
    try {
      await chrome.permissions.request({
        permissions: ['tabs'],
        origins: ['<all_urls>'],
      });
    } catch (e) {
      console.warn('[Background] Permission request failed (may already be granted):', e.message);
    }

    // Get the current tab (fast)
    const tab = await chrome.tabs.get(tabId);
    
    // Generate session ID for linking UI + Protocol data
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Preserve network capture setting from before (user may have toggled it)
    const shouldCaptureNetwork = options.captureNetwork !== undefined 
      ? options.captureNetwork 
      : this.state.captureNetwork || false;  // Default OFF if not explicitly set

    // Set state immediately - CLEAR all old data for fresh start
    this.state = {
      recording: true,
      activeTabId: tabId,
      trackedTabs: new Set([tabId]),  // Start tracking this tab
      currentTabId: tabId,             // Currently active tab
      actions: [],
      startUrl: tab.url,
      startTime: Date.now(),
      sessionId: sessionId,            // NEW: Unified session ID
      captureNetwork: shouldCaptureNetwork,
      networkData: null,
      metadata: {
        title: tab.title,
        timestamp: Date.now(),
        startUrl: tab.url,
        sessionId: sessionId,
      },
    };
    
    // Clear any old script from storage
    await chrome.storage.local.remove('recorderState');

    // Start network capture if enabled (requires optional webRequest + downloads permissions)
    if (this.state.captureNetwork) {
      try {
        // Request optional permissions for network capture
        await chrome.permissions.request({
          permissions: ['webRequest', 'downloads'],
        }).catch(() => {});
        this.networkCapture.start(sessionId);
        console.log('[Background] Network capture started for session:', sessionId);
      } catch (error) {
        console.warn('[Background] Network capture failed to start:', error.message);
      }
    }

    // Update badge immediately (don't wait)
    chrome.action.setBadgeText({ text: 'REC', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4757', tabId });

    // Send message to content script - inject if needed
    try {
      await chrome.tabs.sendMessage(tabId, { 
        type: 'START_RECORDING',
        sessionId: sessionId,
        captureNetwork: this.state.captureNetwork 
      });
      console.log('[Background] START_RECORDING sent to content script successfully');
    } catch (error) {
      console.warn('[Background] Content script not found, injecting now...');
      
      // Inject the content scripts (all 3 in order + CSS)
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tabId, allFrames: true },
          files: ['src/content/content.css']
        }).catch(() => {});
        await chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: true },
          files: [
            'src/lib/recorder-engine.js',
            'src/lib/action-coalescer-browser.js',
            'src/content/content-app-selector-config.js',
            'src/content/content-computer-vision.js',
            'src/content/content-synthetic-data.js',
            'src/content/content-page-analyzer.js',
            'src/content/content-smart-selector.js',
            'src/content/content.js'
          ]
        });
        console.log('[Background] Content scripts injected successfully');

        // Wait a moment for scripts to initialize
        await new Promise(r => setTimeout(r, 300));
        
        // Try sending the message again
        await chrome.tabs.sendMessage(tabId, { 
          type: 'START_RECORDING',
          sessionId: sessionId,
          captureNetwork: this.state.captureNetwork 
        });
        console.log('[Background] START_RECORDING sent after injection');
      } catch (injectError) {
        console.error('[Background] Failed to inject content script:', injectError);
        // Recording will still work via ACTION_RECORDED messages when content script eventually loads
      }
    }

    // Save state (non-blocking)
    this.saveState();
  }

  async stopRecording() {
    if (!this.state.recording) {
      return { success: false, error: 'Not recording' };
    }

    console.log('[Background] stopRecording called, current actions:', this.state.actions.length);

    // Try to get final actions from content script (may have actions not yet sent)
    // CRITICAL FIX: Never replace background's deduplicated list with content's raw list
    // Instead, MERGE any new actions from content that background might have missed
    try {
      const response = await chrome.tabs.sendMessage(
        this.state.activeTabId,
        { type: 'STOP_RECORDING' }
      );
      console.log('[Background] Content script returned', response?.actions?.length || 0, 'actions');
      console.log('[Background] Background has', this.state.actions.length, 'deduplicated actions');
      
      // DON'T replace - background's list is already deduplicated!
      // Only check if content has actions we might have missed (edge case: rapid actions not yet received)
      if (response.actions && response.actions.length > 0) {
        // Build set of existing action signatures
        const existingSignatures = new Set(
          this.state.actions.map(a => `${a.type}_${a.timestamp}`)
        );
        
        // Only add truly new actions (not already in background)
        let addedCount = 0;
        for (const action of response.actions) {
          const sig = `${action.type}_${action.timestamp}`;
          if (!existingSignatures.has(sig)) {
            // Run through deduplication before adding
            const selStr = this.normalizeSelector(this.getSelectorString(action.selector) || '');
            const isDupe = this.state.actions.some(a => {
              const existingSel = this.normalizeSelector(this.getSelectorString(a.selector) || '');
              return a.type === action.type && existingSel === selStr && 
                     Math.abs(a.timestamp - action.timestamp) < 3000;
            });
            
            if (!isDupe) {
              this.state.actions.push(action);
              existingSignatures.add(sig);
              addedCount++;
            }
          }
        }
        console.log('[Background] Added', addedCount, 'new actions from content script');
      }
      
      console.log('[Background] Final deduplicated count:', this.state.actions.length);
    } catch (e) {
      console.log('[Background] Could not get actions from content script:', e);
      // Keep using the actions we already have from ACTION_RECORDED messages
    }

    console.log('[Background] Final action count:', this.state.actions.length);

    // NEW: Stop network capture and get results
    let networkData = null;
    if (this.state.captureNetwork) {
      try {
        networkData = this.networkCapture.stop();
        console.log('[Background] Network capture stopped. Captured:', networkData?.requests?.length || 0, 'requests');
        
        // Link UI actions to HTTP requests (correlation)
        if (networkData && this.state.actions.length > 0) {
          networkData.linkedActions = this._linkActionsToRequests(this.state.actions, networkData.requests);
        }
        
        this.state.networkData = networkData;
      } catch (error) {
        console.warn('[Background] Network capture stop failed:', error.message);
      }
    }

    const recording = {
      actions: this.state.actions,
      metadata: this.state.metadata,
      // NEW: Include network data in recording
      networkData: networkData,
      sessionId: this.state.sessionId,
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
      // NEW: Include network summary in response
      networkSummary: networkData ? {
        totalRequests: networkData.requests?.length || 0,
        correlations: networkData.correlations?.length || 0,
        statistics: networkData.statistics,
      } : null,
    };
  }
  
  /**
   * Link UI actions to the HTTP requests they triggered
   * Creates correlation between user clicks and API calls
   */
  _linkActionsToRequests(actions, requests) {
    const linked = [];
    
    for (const action of actions) {
      const actionTime = action.timestamp;
      
      // Find requests within 2 seconds after this action
      const triggeredRequests = requests.filter(req => {
        const timeDiff = req.startTime - actionTime;
        return timeDiff >= 0 && timeDiff < 2000; // Within 2 seconds after
      });
      
      if (triggeredRequests.length > 0) {
        linked.push({
          action: {
            type: action.type,
            description: action.description,
            timestamp: actionTime,
          },
          requests: triggeredRequests.map(req => ({
            url: req.url,
            method: req.method,
            statusCode: req.statusCode,
            duration: req.duration,
          })),
        });
      }
    }
    
    return linked;
  }

  async saveSessionToBackend(recording, script) {
    try {
      const sessionData = {
        session_id: recording.sessionId || `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: recording.metadata.title || `Recording ${new Date().toLocaleString()}`,
        initial_url: recording.metadata.startUrl || this.state.startUrl,
        actions: recording.actions,
        script: script,
        created_at: new Date().toISOString(),
        is_active: false,
        metadata: recording.metadata,
        // NEW: Include network/protocol data for load testing
        network_data: recording.networkData ? {
          session_id: recording.sessionId,
          requests: recording.networkData.requests || [],
          websockets: recording.networkData.websockets || [],
          correlations: recording.networkData.correlations || [],
          linked_actions: recording.networkData.linkedActions || [],
          statistics: recording.networkData.statistics || {},
          start_time: recording.networkData.startTime,
          end_time: recording.networkData.endTime,
          duration: recording.networkData.duration,
        } : null,
      };

      const response = await fetch(apiUrl('/api/flowstral/save-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (response.ok) {
        console.log('[Background] Session saved to backend:', sessionData.session_id);
        
        // If we have network data, also save to protocol recording endpoint
        if (sessionData.network_data && sessionData.network_data.requests.length > 0) {
          this._saveProtocolDataToBackend(sessionData.session_id, sessionData.network_data);
        }
      } else {
        console.warn('[Background] Failed to save session to backend:', response.status);
      }
    } catch (error) {
      console.warn('[Background] Could not save session to backend (server may be offline):', error.message);
      // Store locally as fallback
      chrome.storage.local.set({ [`session_${Date.now()}`]: recording });
    }
  }
  
  /**
   * Save protocol/network data to dedicated endpoint for load testing
   */
  async _saveProtocolDataToBackend(sessionId, networkData) {
    try {
      // Convert to HAR format for compatibility
      const harData = this.networkCapture.exportAsHAR ? 
        this.networkCapture.exportAsHAR() : 
        this._convertToHAR(networkData);
      
      const response = await fetch(apiUrl('/api/protocol-recording/import-har'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          har: harData,
          name: `Protocol Data: ${sessionId}`,
          linked_session_id: sessionId,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[Background] Protocol data saved:', result.recording_id);
      }
    } catch (error) {
      console.warn('[Background] Could not save protocol data:', error.message);
    }
  }
  
  /**
   * Convert network data to HAR format
   */
  _convertToHAR(networkData) {
    return {
      log: {
        version: '1.2',
        creator: { name: 'QAAI Extension', version: '2.0' },
        entries: (networkData.requests || []).map(req => ({
          startedDateTime: new Date(req.startTime).toISOString(),
          time: req.duration || 0,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(req.requestHeaders || {}).map(([name, value]) => ({ name, value })),
            queryString: [],
            postData: req.requestBody ? { mimeType: 'application/json', text: JSON.stringify(req.requestBody) } : null,
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: req.statusCode || 0,
            statusText: '',
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(req.responseHeaders || {}).map(([name, value]) => ({ name, value })),
            content: { size: req.timing?.decodedBodySize || 0, mimeType: '' },
            headersSize: -1,
            bodySize: -1,
          },
          timings: {
            dns: req.timing?.dns || -1,
            connect: req.timing?.tcp || -1,
            ssl: req.timing?.ssl || -1,
            send: 0,
            wait: req.timing?.ttfb || 0,
            receive: req.timing?.download || 0,
          },
          cache: {},
        })),
      },
    };
  }

  // ============================================================================
  // SCRIPT GENERATION — delegated to background-script-generators.js
  // ============================================================================

  generateScript(options = {}) {
    return bgGenerateScript(this.state, options);
  }

  // ============================================================================
  // UTILITY METHODS — delegated to background-utils.js
  // ============================================================================

  toSnakeCase(str) { return bgToSnakeCase(str); }
  escapeStringDouble(str) { return bgEscapeStringDouble(str); }
  escapeString(str) { return bgEscapeString(str); }
  isRedundant(action, prev) { return bgIsRedundant(action, prev, bgGetSelectorString, bgGetActionPriority); }
  getSelectorString(selector) { return bgGetSelectorString(selector); }
  getActionPriority(type) { return bgGetActionPriority(type); }
  normalizeSelector(selectorStr) { return bgNormalizeSelector(selectorStr); }

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

  // ============================================================================
  // TEST CASE GENERATION — delegated to background-test-case-generators.js
  // ============================================================================

  generateTestCases(actions, format, testName = 'Recorded Test') {
    return bgGenerateTestCases(actions, format, testName, this.state.metadata);
  }

  generateSelectorFromActionData(action) {
    return bgGenerateSelectorFromActionData(action);
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
    try {
      const response = await fetch(apiUrl('/api/flowstral/generate'), {
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
