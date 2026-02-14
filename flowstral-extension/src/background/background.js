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
          files: ['src/lib/recorder-engine.js', 'src/lib/action-coalescer-browser.js', 'src/content/content.js']
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
          files: ['src/lib/recorder-engine.js', 'src/lib/action-coalescer-browser.js', 'src/content/content.js']
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
def wait_for_page_ready(page, timeout: int = 10000):
    """Wait for page to be fully loaded and interactive - NON-BLOCKING"""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except:
        pass  # Continue even if page is still loading
    
    # Wait for common loading indicators to disappear (with SHORT timeout)
    spinners = [
        ".slds-spinner",           # Salesforce
        ".loading-spinner",        # Generic
    ]
    
    for spinner in spinners:
        try:
            spinner_el = page.locator(spinner).first
            if spinner_el.is_visible(timeout=500):
                spinner_el.wait_for(state="hidden", timeout=5000)
        except:
            pass  # Spinner not found or already hidden - continue
    
    # Small delay for JavaScript rendering
    page.wait_for_timeout(300)


def safe_click(page, *selectors, timeout=10000):
    """Try multiple selectors until one works - self-healing click"""
    last_error = None
    for selector in selectors:
        try:
            element = page.locator(selector).first
            element.wait_for(state="visible", timeout=timeout)
            element.scroll_into_view_if_needed()
            element.click(force=True, no_wait_after=True)
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
    
    # Click the element (no_wait_after to avoid navigation timeout)
    page.locator(selector).click(force=force, no_wait_after=True)
    
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

    // First pass: remove obvious duplicates and useless actions
    const cleanedActions = [];
    const seenNavigateUrls = new Set(); // Track ALL navigate URLs, not just last one
    const seenActionSignatures = new Set(); // Track action signatures to prevent duplicates
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const prev = i > 0 ? cleanedActions[cleanedActions.length - 1] : null;
      
      // CRITICAL: Skip useless click/hover actions on generic elements with no real selector
      // These are actions like "Click div", "Click span", "Click body" that are meaningless
      if ((action.type === 'click' || action.type === 'hover') && action.tagName) {
        const tag = action.tagName.toLowerCase();
        const genericTags = ['div', 'span', 'body', 'html', 'section', 'article', 'main', 'header', 'footer', 'nav'];
        
        // Get the selector to check if it's meaningful
        const selectorStr = action.selector?.playwright || action.selector?.selector || 
                           action.selector?.primary?.playwright || action.selector?.primary?.selector || '';
        
        // Skip if it's a generic tag AND selector is too simple (just the tag name or empty)
        const isTooSimple = !selectorStr || 
                           selectorStr === tag ||
                           selectorStr === `locator("${tag}")` ||
                           selectorStr === `locator('${tag}')` ||
                           selectorStr.match(/^locator\s*\(\s*['"]?(div|span|body|section)['"]?\s*\)$/i);
        
        if (genericTags.includes(tag) && isTooSimple) {
          console.log(`[Flowstral] Skipping useless action: ${action.type} ${tag} (no meaningful selector)`);
          continue;
        }
      }
      
      // CRITICAL: Create signature to detect duplicate action sequences
      const actionSig = `${action.type}_${this.normalizeSelector(this.getSelectorString(action.selector) || action.description || '')}`;
      
      // Skip if we've seen this exact action recently (within last 20 actions)
      let recentDuplicate = false;
      const recentSigs = Array.from(seenActionSignatures).slice(-20);
      if (recentSigs.includes(actionSig) && action.type !== 'navigate') {
        // Check if this is part of a repeated sequence (same action appearing again)
        console.log(`[Flowstral] Skipping repeated action: ${action.type} (seen before in sequence)`);
        recentDuplicate = true;
      }
      seenActionSignatures.add(actionSig);
      
      if (recentDuplicate && cleanedActions.length > 10) {
        // If we're seeing duplicates and have enough actions, we might be in a repeated flow
        // Check if last 5 actions match a pattern from earlier
        continue;
      }
      
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
        
        // Simple click for buttons (noWaitAfter to avoid navigation timeout)
        let clickCode = `  await page.${selector}.click({ force: true, noWaitAfter: true });\n`;
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
    
    // If selector is null/useless, skip this action entirely
    if (!selector && action.type !== 'navigate' && action.type !== 'keyboard') {
      console.log('[Flowstral] Skipping action with no valid selector:', action.type, action.description);
      return ''; // Return empty to skip action
    }
    
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
        // CRITICAL: Use no_wait_after=True to avoid navigation timeout (e.g., after login button)
        const opts = ['force=True', 'no_wait_after=True', 'timeout=10000'];
        if (action.button && action.button !== 'left') {
          opts.push(`button="${action.button}"`);
        }
        if (action.modifiers && action.modifiers.length) {
          opts.push(`modifiers=[${action.modifiers.map(m => `"${m}"`).join(', ')}]`);
        }
        const args = opts.join(', ');
        // NOTE: Removed wait_for_page_ready() call - causes 30s timeout on slow SPAs like Salesforce
        return `    page.${selector}.click(${args})
    page.wait_for_timeout(500)  # Brief pause for UI update
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

      case 'fill': {
        // Never fill radio/checkbox - skip this action
        if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
          return ''; // Skip - should use check instead
        }
        
        const desc = (action.description || action.text || '').toLowerCase();
        const placeholder = (action.placeholder || '').toLowerCase();
        const isAppLauncherSearch = desc.includes('search apps') || placeholder.includes('search apps') || 
                                    desc.includes('app launcher') || placeholder.includes('search items');
        
        // SALESFORCE: Special handling for App Launcher search and custom inputs
        if (isAppLauncherSearch || isSalesforce) {
          return `    # ROBUST: Wait for modal/input with fallback selectors + multiple fill strategies
    _fill_done = False
    _search_selectors = [
        '${selector}',
        'input[placeholder*="Search apps"]',
        'input[placeholder*="Search Apps"]',
        'one-app-launcher-menu input',
        'input.slds-input[placeholder*="Search"]',
        '[role="searchbox"]',
        'input[type="search"]',
    ]
    for _attempt in range(3):
        for _sel in _search_selectors:
            try:
                _el = page.locator(_sel)
                if _el.count() > 0:
                    _el.first.wait_for(state="visible", timeout=3000)
                    # Strategy 1: Click to focus, then fill with short timeout
                    try:
                        _el.first.click(timeout=2000)
                        page.wait_for_timeout(300)
                        _el.first.fill("${this.escapeStringDouble(action.value || '')}", timeout=5000)
                        _fill_done = True
                    except:
                        # Strategy 2: Use type() for custom Salesforce components
                        try:
                            _el.first.click(timeout=2000)
                            page.wait_for_timeout(300)
                            _el.first.type("${this.escapeStringDouble(action.value || '')}", delay=50)
                            _fill_done = True
                        except:
                            # Strategy 3: Use keyboard directly
                            _el.first.click(timeout=2000)
                            page.keyboard.type("${this.escapeStringDouble(action.value || '')}")
                            _fill_done = True
                    break
            except:
                continue
        if _fill_done:
            break
        page.wait_for_timeout(2000)  # Wait and retry
    if not _fill_done:
        raise Exception("Could not fill input after retries")\n`;
        }
        
        // ROBUST: Wait for element to be visible before filling (handles modals, dynamic content)
        return `    # Wait for input to be ready
    try:
        page.${selector}.wait_for(state="visible", timeout=10000)
    except:
        pass  # Continue even if wait times out
    page.${selector}.fill("${this.escapeStringDouble(action.value || '')}")\n`;
      }

      case 'type':
        return `    # Wait for input to be ready
    try:
        page.${selector}.wait_for(state="visible", timeout=10000)
    except:
        pass
    page.${selector}.type("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'select':
        if (action.label) {
          return `    page.${selector}.select_option(label="${this.escapeStringDouble(action.label)}")\n`;
        }
        return `    page.${selector}.select_option("${this.escapeStringDouble(action.value || '')}")\n`;

      case 'check': {
        // For Salesforce, prefer clicking the visible label/text instead of strict check on hidden inputs
        if (isSalesforce && this.isInteractiveSelector(action.selector)) {
          return `    page.${selector}.click(force=True, no_wait_after=True)\n`;
        }
        return `    page.${selector}.check()\n`;
      }

      case 'uncheck': {
        if (isSalesforce && this.isInteractiveSelector(action.selector)) {
          return `    page.${selector}.click(force=True, no_wait_after=True)\n`;
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
        // Hovers are non-critical - wrap in try/except and skip on failure
        return `    # HOVER (non-critical)\n    try:\n        page.${selector}.hover(timeout=2000)\n    except:\n        pass  # Hovers are non-critical\n`;

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
    
    // Only add wait after navigation - use domcontentloaded with timeout (networkidle fails on SPAs)
    if (action.type === 'navigate') {
      code += `    try:\n`;
      code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
      code += `    except:\n`;
      code += `        pass  # Continue even if page is still loading\n`;
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
      code += `    try:\n`;
      code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
      code += `    except:\n`;
      code += `        pass  # Continue even if page is still loading\n`;
    } else if (action.type === 'click' && action.mightTriggerChange && nextAction) {
      // Only wait if next action is different (page might have changed)
      if (nextAction.type !== action.type || this.getSelectorString(nextAction.selector) !== this.getSelectorString(action.selector)) {
        code += `    try:\n`;
        code += `        page.wait_for_load_state("domcontentloaded", timeout=10000)\n`;
        code += `    except:\n`;
        code += `        pass\n`;
      }
    }
    
    // CRITICAL: Add extra wait after login button clicks (Salesforce, etc.)
    // Login triggers major page change - Lightning Experience needs time to load
    const desc = (action.description || '').toLowerCase();
    const text = (action.text || '').toLowerCase();
    const selectorStr = JSON.stringify(action.selector || {}).toLowerCase();
    
    if (action.type === 'click' && (
      desc.includes('log in') || desc.includes('login') || desc.includes('sign in') ||
      text.includes('log in') || text.includes('login') || text.includes('sign in')
    )) {
      code += `    # Wait for post-login page load (Salesforce Lightning needs extra time)\n`;
      code += `    try:\n`;
      code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
      code += `    except:\n`;
      code += `        pass  # Continue - Salesforce makes continuous API calls\n`;
      code += `    page.wait_for_timeout(5000)  # Extra wait for Lightning Experience\n`;
    }
    
    // CRITICAL: Add wait for App Launcher modal after clicking waffle icon
    if (action.type === 'click' && (
      desc.includes('app launcher') || desc.includes('applauncher') ||
      text.includes('app launcher') || text.includes('applauncher') ||
      selectorStr.includes('waffle') || selectorStr.includes('app-launcher') ||
      selectorStr.includes('slds-icon-waffle')
    )) {
      code += `    # Wait for App Launcher modal to open\n`;
      code += `    try:\n`;
      code += `        page.locator('div.slds-modal__content, div.appLauncherMenu, one-app-launcher-menu').wait_for(state="visible", timeout=10000)\n`;
      code += `    except:\n`;
      code += `        pass  # Modal might use different selector\n`;
      code += `    page.wait_for_timeout(1500)  # Wait for search input to be interactive\n`;
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
    if (!selectorData) return null; // Return null to signal skip action
    
    // Helper to check if selector is useless (just a tag name)
    const isUselessSelector = (str) => {
      if (!str || typeof str !== 'string') return true;
      const trimmed = str.trim().toLowerCase();
      // Useless if it's just a tag name or locator("tagname")
      const uselessPatterns = [
        /^(div|span|body|html|section|article|main|header|footer|nav|aside|p|ul|li|table|tr|td)$/,
        /^locator\s*\(\s*['"]?(div|span|body|section|article|main|header|footer|nav)['"]?\s*\)$/,
      ];
      return uselessPatterns.some(p => p.test(trimmed));
    };

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
    
    // Check if primary selector is useless
    const primarySel = selectorData.playwright || selectorData.selector || '';
    if (isUselessSelector(primarySel)) {
      // Try fallbacks
      if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
        for (const fallback of selectorData.fallbacks) {
          const fbSel = fallback.playwright || fallback.selector || '';
          if (!isUselessSelector(fbSel) && !isVisualLocator(fbSel)) {
            selectorData = fallback; // Use fallback instead
            break;
          }
        }
      }
      
      // If still useless, return null to skip this action
      const newSel = selectorData.playwright || selectorData.selector || '';
      if (isUselessSelector(newSel)) {
        console.log('[Flowstral] Skipping useless selector:', primarySel);
        return null;
      }
    }

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
    
    // CRITICAL FIX: Don't blindly replace quotes - handle nested quotes properly
    // For selectors like locator('[data-testid="value"]'), keep single quotes on the outside
    // Only convert single quotes to double quotes if there are no double quotes inside
    if (!result.includes('"')) {
      // Safe to convert single quotes to double quotes
      result = result.replace(/'/g, '"');
    }
    // If there are already double quotes (like in attribute selectors), keep single quotes
    // Python: locator('[data-testid="value"]') is valid
    
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
      .replace(/\\/g, '\\\\')     // Escape backslashes first
      .replace(/"/g, '\\"')       // Escape double quotes
      .replace(/\n/g, '\\n')      // Escape newlines
      .replace(/\r/g, '\\r')      // Escape carriage returns
      .replace(/\t/g, '\\t')      // Escape tabs
      .replace(/\f/g, '\\f')      // Escape form feeds
      .replace(/\0/g, '')         // Remove null characters
      .replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove other control characters
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

  // Helper: Get selector string from selector object
  getSelectorString(selector) {
    if (!selector) return '';
    if (typeof selector === 'string') return selector;
    
    // Try to extract actual selector string in order of preference
    // Priority: playwright > selector > css > primary (nested)
    if (selector.playwright) return selector.playwright;
    if (selector.selector) return selector.selector;
    if (selector.css) return selector.css;
    
    // Check nested primary object
    if (selector.primary) {
      if (typeof selector.primary === 'string') return selector.primary;
      if (selector.primary.playwright) return selector.primary.playwright;
      if (selector.primary.selector) return selector.primary.selector;
    }
    
    // Try other properties
    if (selector.testId) return `[data-testid="${selector.testId}"]`;
    if (selector.role) return `role=${selector.role}`;
    if (selector.text) return `text=${selector.text}`;
    if (selector.label) return `label=${selector.label}`;
    if (selector.id) return `#${selector.id}`;
    if (selector.name) return `[name="${selector.name}"]`;
    
    // Last resort: return empty string (not JSON) to avoid false matches
    return '';
  }
  
  // Helper: Normalize selector for comparison
  // CRITICAL: Must match content.js normalizeSelector exactly!
  normalizeSelector(selectorStr) {
    if (!selectorStr) return '';
    return selectorStr
      .replace(/'/g, '"')                     // Normalize quotes
      .replace(/\s+/g, ' ')                   // Normalize whitespace
      .replace(/locator\s*\(\s*/g, 'locator(') // Normalize spacing in locator()
      .replace(/get_by_\s*/g, 'get_by_')      // Normalize get_by methods (MUST MATCH content.js)
      .trim()
      .toLowerCase();
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
    // CRITICAL: Generate Python snake_case syntax, not JavaScript camelCase
    if (!action) return null;
    
    // Extract text from description (e.g., "Click 'Get involved'" -> "Get involved")
    const description = action.description || '';
    const textMatch = description.match(/['"]([^'"]+)['"]/);
    const text = textMatch ? textMatch[1] : (action.text || '');
    
    // For click actions, try get_by_role or get_by_text (Python syntax)
    if (action.type === 'click' && text) {
      // Try to determine role from description or tagName
      let role = 'button';
      if (description.toLowerCase().includes('link') || action.tagName === 'a') {
        role = 'link';
      } else if (description.toLowerCase().includes('button') || action.tagName === 'button') {
        role = 'button';
      }
      
      if (text.length > 0 && text.length < 50) {
        return `get_by_role('${role}', name='${this.escapeString(text)}')`;
      }
    }
    
    // For fill actions, try get_by_label or get_by_placeholder (Python syntax)
    if (action.type === 'fill') {
      const label = action.label || action.placeholder || text;
      if (label && label.length > 0 && label.length < 50) {
        return `get_by_label('${this.escapeString(label)}')`;
      }
    }
    
    // For check/uncheck, try get_by_role with text (Python syntax)
    if ((action.type === 'check' || action.type === 'uncheck') && text) {
      if (text.length > 0 && text.length < 50) {
        return `get_by_role('checkbox', name='${this.escapeString(text)}')`;
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
