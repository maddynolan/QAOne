// Flowstral Extension - Background Service Worker
// Coordinates between popup UI and content scripts

const API_BASE_URL = 'http://localhost:8000';

// Event batching configuration
const BATCH_SIZE = 5; // Batch every N events (reduced for faster capture)
const BATCH_INTERVAL = 2000; // Or every 2 seconds (reduced for faster capture)
const MAX_OFFLINE_QUEUE = 100; // Max events to queue offline

// Event batching state
let eventBatch = [];
let batchTimer = null;
let offlineQueue = [];

// Log when background script loads
console.log('Flowstral Background: Service worker loaded');

// Load offline queue on startup
chrome.storage.local.get('flowstral_offline_queue').then(stored => {
  if (stored.flowstral_offline_queue) {
    offlineQueue = stored.flowstral_offline_queue;
    console.log(`Flowstral Background: Loaded ${offlineQueue.length} events from offline queue`);
    if (offlineQueue.length > 0) {
      processOfflineQueue();
    }
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  console.log('Flowstral Background: Extension icon clicked, opening side panel');
  chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Flowstral Background: Received message', message.type, message);
  
  // Handle ping for connection test
  if (message.type === 'PING') {
    sendResponse({ success: true, message: 'pong' });
    return true;
  }
  
  // Handle async responses
  const handleAsync = async () => {
    try {
      switch (message.type) {
        case 'FLOWSTRAL_START':
          console.log('Flowstral Background: Handling FLOWSTRAL_START');
          const startResult = await handleStartFlowstral(message.data, sender.tab?.id);
          return { success: true, data: startResult };
          
        case 'FLOWSTRAL_STOP':
          console.log('Flowstral Background: Handling FLOWSTRAL_STOP');
          const stopResult = await handleStopFlowstral(message.data, sender.tab?.id);
          return { success: true, data: stopResult };
          
        case 'FLOWSTRAL_CAPTURE_EVENT':
          const captureResult = await handleCaptureEvent(message.data);
          return { success: true, data: captureResult };
          
        case 'FLOWSTRAL_GET_SESSION':
          const sessionResult = await handleGetSession(message.data);
          return { success: true, data: sessionResult };
          
        case 'FLOWSTRAL_CAPTURE_SCREENSHOT':
          const screenshotResult = await handleCaptureScreenshot(sender.tab?.id);
          return { success: true, screenshot: screenshotResult };
          
        default:
          console.warn('Flowstral Background: Unknown message type', message.type);
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    } catch (error) {
      console.error('Flowstral Background: Message handler error', error);
      console.error('Flowstral Background: Error stack', error.stack);
      return { success: false, error: error.message || String(error) };
    }
  };
  
  // Execute async handler
  handleAsync().then(result => {
    console.log('=== FLOWSTRAL BACKGROUND: SENDING RESPONSE ===');
    console.log('Flowstral Background: Sending response', result.success ? 'SUCCESS' : 'ERROR', result.error || '');
    console.log('Flowstral Background: Response data keys', result.data ? Object.keys(result.data) : 'no data');
    try {
      sendResponse(result);
      console.log('Flowstral Background: Response sent successfully');
    } catch (e) {
      console.error('Flowstral Background: Error sending response', e);
      // Response channel might be closed, but we tried
    }
  }).catch(error => {
    console.error('=== FLOWSTRAL BACKGROUND: UNHANDLED ERROR ===');
    console.error('Flowstral Background: Unhandled error in async handler', error);
    console.error('Flowstral Background: Error message', error.message);
    try {
      sendResponse({ success: false, error: error.message || String(error) });
    } catch (e) {
      console.error('Flowstral Background: Could not send error response', e);
    }
  });
  
  return true; // Keep channel open for async response
});

// Check domain allowlist
async function checkDomainAllowlist(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    const stored = await chrome.storage.local.get(['flowstral_allowed_domains']);
    const allowedDomains = stored.flowstral_allowed_domains || [];
    
    // No allowlist = allow all
    if (allowedDomains.length === 0) {
      return { allowed: true, reason: 'No allowlist configured' };
    }
    
    // Check if domain is allowed
    const isAllowed = allowedDomains.some(allowed => {
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.substring(2);
        return domain === baseDomain || domain.endsWith('.' + baseDomain);
      }
      return domain === allowed;
    });
    
    if (isAllowed) {
      return { allowed: true, reason: 'Domain in allowlist' };
    } else {
      return { allowed: false, reason: `Domain ${domain} not in allowlist` };
    }
  } catch (e) {
    console.error('Flowstral Background: Error checking domain allowlist', e);
    return { allowed: true, reason: 'Error checking allowlist, allowing by default' };
  }
}

// Start Flowstral session
async function handleStartFlowstral(data, tabId) {
  const { project_id, user_id, initial_url, tab_id } = data;
  const targetTabId = tab_id || tabId;
  
  // Check domain allowlist
  if (initial_url) {
    const allowlistCheck = await checkDomainAllowlist(initial_url);
    if (!allowlistCheck.allowed) {
      throw new Error(`Domain not allowed: ${allowlistCheck.reason}`);
    }
  }
  
  console.log('Flowstral Background: Starting session', { project_id, targetTabId, initial_url });
  
  if (!project_id) {
    throw new Error('Project ID is required');
  }
  
  try {
    // Test backend connection first
    console.log('Flowstral Background: Testing backend connection...');
    try {
      const testResponse = await fetch(`${API_BASE_URL}/docs`, { method: 'HEAD' });
      console.log('Flowstral Background: Backend reachable', testResponse.status);
    } catch (testError) {
      console.error('Flowstral Background: Backend not reachable', testError);
      throw new Error(`Backend not running or not accessible at ${API_BASE_URL}. Please start the backend server.`);
    }
    
    // Call backend API to start session
    console.log('Flowstral Background: Calling API to start session...');
    const response = await fetch(`${API_BASE_URL}/api/flowstral/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id,
        user_id: user_id || 'extension_user',
        initial_url: initial_url || 'about:blank',
        initial_dom: '' // Will be captured by content script
      })
    });
    
    console.log('Flowstral Background: API response status', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flowstral Background: API error', response.status, errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    const result = await response.json();
    const sessionId = result.session.session_id;
    
    console.log('Flowstral Background: Session started successfully', sessionId);
    
    // Store session in extension storage
    await chrome.storage.local.set({
      flowstral_session: {
        sessionId,
        projectId: project_id,
        isActive: true,
        tabId: targetTabId,
        startTime: Date.now()
      }
    });
    
    console.log('Flowstral Background: Session stored in extension storage');
    
    // Notify content script in active tab to start recording
    if (targetTabId) {
      console.log('Flowstral Background: Notifying content script in tab', targetTabId);
      try {
        // Wait a bit for content script to be ready
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(targetTabId, {
              type: 'FLOWSTRAL_START_RECORDING',
              sessionId
            });
            console.log('Flowstral Background: Content script notified successfully');
          } catch (e) {
            console.warn('Flowstral Background: Could not notify content script (first try)', e.message);
            // Try injecting content script if it's not loaded
            try {
              console.log('Flowstral Background: Attempting to inject content script...');
              await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                files: ['content.js']
              });
              console.log('Flowstral Background: Content script injected successfully');
              // Try again after injection
              setTimeout(async () => {
                try {
                  await chrome.tabs.sendMessage(targetTabId, {
                    type: 'FLOWSTRAL_START_RECORDING',
                    sessionId
                  });
                  console.log('Flowstral Background: Content script notified after injection');
                } catch (e2) {
                  console.error('Flowstral Background: Still cannot notify content script', e2.message);
                  console.error('Flowstral Background: This might be a cross-origin issue or content script not ready');
                }
              }, 1000);
            } catch (injectError) {
              console.error('Flowstral Background: Failed to inject content script', injectError.message);
              console.error('Flowstral Background: Check if page allows script injection (some pages block it)');
            }
          }
        }, 500);
      } catch (e) {
        console.error('Flowstral Background: Error in notification flow', e.message);
      }
    } else {
      console.warn('Flowstral Background: No tab ID provided, cannot notify content script');
    }
    
    return result;
  } catch (error) {
    console.error('Flowstral Background: Start session error', error);
    console.error('Flowstral Background: Error details', error.stack);
    throw error;
  }
}

// Stop Flowstral session
async function handleStopFlowstral(data, tabId) {
  const { session_id, project_id } = data;
  
  console.log('=== FLOWSTRAL BACKGROUND: STOP SESSION ===');
  console.log('Flowstral Background: Stopping session', { session_id, project_id });
  
  try {
    // CRITICAL: Flush events BEFORE stopping session to ensure they're received
    console.log('Flowstral Background: Flushing events before stopping session...');
    await flushBatchOnStop();
    
    // Wait a moment for events to be processed by backend
    console.log('Flowstral Background: Waiting for events to be processed...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Flowstral Background: Calling backend API to stop session...');
    // Call backend API to stop session
    const response = await fetch(`${API_BASE_URL}/api/flowstral/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id,
        project_id: project_id || 'default'
      })
    });
    
    console.log('Flowstral Background: Stop API response status', response.status);
    console.log('Flowstral Background: Response ok?', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Flowstral Background: Stop API error', response.status, errorText);
      throw new Error(`Failed to stop session: ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    console.log('Flowstral Background: Parsing response JSON...');
    const result = await response.json();
    console.log('Flowstral Background: Response parsed successfully');
    console.log('Flowstral Background: Result keys', Object.keys(result));
    console.log('Flowstral Background: Artifacts in result?', !!result.artifacts);
    console.log('Flowstral Background: Session stopped successfully', {
      status: result.status,
      session_id: result.session_id,
      has_artifacts: !!result.artifacts,
      artifacts_keys: result.artifacts ? Object.keys(result.artifacts) : []
    });
    
    // Clear session from storage
    console.log('Flowstral Background: Clearing session from storage...');
    await chrome.storage.local.remove('flowstral_session');
    console.log('Flowstral Background: Session cleared from storage');
    
    // Notify content script to stop recording
    if (tabId) {
      try {
        console.log('Flowstral Background: Notifying content script to stop...');
        await chrome.tabs.sendMessage(tabId, {
          type: 'FLOWSTRAL_STOP_RECORDING'
        });
        console.log('Flowstral Background: Content script notified to stop');
      } catch (e) {
        console.warn('Flowstral Background: Could not notify content script', e.message);
      }
    }
    
    // Events were already flushed before stopping
    console.log('=== FLOWSTRAL BACKGROUND: STOP COMPLETE ===');
    return result;
  } catch (error) {
    console.error('=== FLOWSTRAL BACKGROUND: STOP ERROR ===');
    console.error('Flowstral Background: Stop session error', error);
    console.error('Flowstral Background: Error message', error.message);
    console.error('Flowstral Background: Error stack', error.stack);
    throw error;
  }
}

// Capture event from content script (with batching)
async function handleCaptureEvent(data) {
  const { session_id, event_type, event_data } = data;
  
  // Add to batch
  eventBatch.push({
    session_id,
    event_type,
    event_data,
    timestamp: Date.now()
  });
  
  console.log(`Flowstral Background: Event added to batch (${eventBatch.length}/${BATCH_SIZE}): ${event_type} - ${event_data.action_description || event_data.url || 'no description'}`);
  
  // Start batch timer if not already running
  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      flushEventBatch();
    }, BATCH_INTERVAL);
  }
  
  // Flush if batch is full OR if it's a critical event (navigate, submit, etc.)
  const criticalEvents = ['navigate', 'submit', 'page_load'];
  if (eventBatch.length >= BATCH_SIZE || criticalEvents.includes(event_type)) {
    console.log(`Flowstral Background: Flushing batch immediately (size: ${eventBatch.length}, critical: ${criticalEvents.includes(event_type)})`);
    await flushEventBatch();
  }
  
  return { success: true, batched: true };
}

// Flush event batch to backend
async function flushEventBatch() {
  if (eventBatch.length === 0) {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    return;
  }
  
  const batchToSend = [...eventBatch];
  eventBatch = [];
  
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  
  console.log(`Flowstral Background: Flushing batch of ${batchToSend.length} events`);
  
  try {
    // Try to send batch
    const response = await fetch(`${API_BASE_URL}/api/flowstral/capture-events-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: batchToSend
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send batch: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`Flowstral Background: Batch sent successfully (${batchToSend.length} events)`);
    
    // Process offline queue if we're back online
    if (offlineQueue.length > 0) {
      processOfflineQueue();
    }
    
    return result;
  } catch (error) {
    console.error('Flowstral Background: Failed to send batch, adding to offline queue', error);
    
    // Add to offline queue
    offlineQueue.push(...batchToSend);
    
    // Limit queue size
    if (offlineQueue.length > MAX_OFFLINE_QUEUE) {
      offlineQueue = offlineQueue.slice(-MAX_OFFLINE_QUEUE);
      console.warn(`Flowstral Background: Offline queue full, keeping last ${MAX_OFFLINE_QUEUE} events`);
    }
    
    // Save to storage
    await chrome.storage.local.set({ flowstral_offline_queue: offlineQueue });
    
    throw error;
  }
}

// Process offline queue with exponential backoff
let retryCount = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

async function processOfflineQueue() {
  if (offlineQueue.length === 0) {
    retryCount = 0;
    return;
  }
  
  const eventsToSend = [...offlineQueue];
  offlineQueue = [];
  
  console.log(`Flowstral Background: Processing offline queue (${eventsToSend.length} events)`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/flowstral/capture-events-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: eventsToSend
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send offline queue: ${response.status}`);
    }
    
    await response.json();
    console.log(`Flowstral Background: Offline queue processed successfully (${eventsToSend.length} events)`);
    
    // Clear from storage
    await chrome.storage.local.remove('flowstral_offline_queue');
    retryCount = 0;
    
    // Process remaining if any
    if (offlineQueue.length > 0) {
      processOfflineQueue();
    }
  } catch (error) {
    console.error('Flowstral Background: Failed to process offline queue', error);
    
    // Put events back in queue
    offlineQueue = [...eventsToSend, ...offlineQueue];
    
    // Limit queue size
    if (offlineQueue.length > MAX_OFFLINE_QUEUE) {
      offlineQueue = offlineQueue.slice(-MAX_OFFLINE_QUEUE);
    }
    
    // Save to storage
    await chrome.storage.local.set({ flowstral_offline_queue: offlineQueue });
    
    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = BASE_DELAY * Math.pow(2, retryCount - 1);
      console.log(`Flowstral Background: Retrying offline queue in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      setTimeout(() => processOfflineQueue(), delay);
    } else {
      console.error('Flowstral Background: Max retries reached, giving up on offline queue');
      retryCount = 0;
    }
  }
}

// Flush batch on stop
async function flushBatchOnStop() {
  if (eventBatch.length > 0) {
    console.log(`Flowstral Background: Flushing remaining batch on stop (${eventBatch.length} events)`);
    try {
      await flushEventBatch();
      console.log('Flowstral Background: Batch flushed successfully on stop');
    } catch (error) {
      console.error('Flowstral Background: Failed to flush batch on stop', error);
      // Don't throw - we still want to stop the session
    }
  } else {
    console.log('Flowstral Background: No events in batch to flush');
  }
}

// Get current session status
async function handleGetSession(data) {
  const stored = await chrome.storage.local.get('flowstral_session');
  if (!stored.flowstral_session) {
    return { session: null };
  }
  
  const { sessionId } = stored.flowstral_session;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${sessionId}/status`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Flowstral: Get session error', error);
  }
  
  return { session: stored.flowstral_session };
}

// Listen for tab updates to re-inject if needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const stored = await chrome.storage.local.get('flowstral_session');
    if (stored.flowstral_session && stored.flowstral_session.isActive) {
      // Re-inject content script if session is active
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'FLOWSTRAL_START_RECORDING',
          sessionId: stored.flowstral_session.sessionId
        });
      } catch (e) {
        // Content script not ready yet, that's ok
      }
    }
  }
});

