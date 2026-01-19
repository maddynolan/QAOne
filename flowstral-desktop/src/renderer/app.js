/**
 * Flowstral Desktop - Renderer Application
 * 
 * Handles UI interactions with DOCKED browser view (like Copado CRT).
 * The browser is embedded directly in the app window using Electron BrowserView.
 */

// App State
const state = {
  recording: false,
  connected: false,
  licensed: false,
  actions: [],
  config: null,
  currentView: 'studio',
  browserAttached: false
};

// DOM Elements
const elements = {
  // Views
  views: document.querySelectorAll('.view'),
  navItems: document.querySelectorAll('.nav-item'),
  
  // Status
  connectionStatus: document.getElementById('connection-status'),
  licenseStatus: document.getElementById('license-status'),
  
  // Studio - New Docked Layout
  urlInput: document.getElementById('url-input'),
  btnBack: document.getElementById('btn-back'),
  btnForward: document.getElementById('btn-forward'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnGo: document.getElementById('btn-go'),
  btnRecord: document.getElementById('btn-record'),
  btnSuggest: document.getElementById('btn-suggest'),
  stepsList: document.getElementById('steps-list'),
  stepCount: document.getElementById('step-count'),
  btnClear: document.getElementById('btn-clear'),
  btnGenerate: document.getElementById('btn-generate'),
  browserPanel: document.getElementById('browser-panel'),
  browserPlaceholder: document.getElementById('browser-placeholder'),
  
  // Settings
  licenseKeyInput: document.getElementById('license-key-input'),
  btnActivate: document.getElementById('btn-activate'),
  btnDeactivate: document.getElementById('btn-deactivate'),
  licenseInfoCard: document.getElementById('license-info-card'),
  licenseType: document.getElementById('license-type'),
  licenseExpiry: document.getElementById('license-expiry'),
  serverUrlInput: document.getElementById('server-url-input'),
  btnConnect: document.getElementById('btn-connect'),
  browserTypeSelect: document.getElementById('browser-type-select'),
  headlessToggle: document.getElementById('headless-toggle'),
  startupToggle: document.getElementById('startup-toggle'),
  trayToggle: document.getElementById('tray-toggle'),
  appVersion: document.getElementById('app-version'),
  btnCheckUpdates: document.getElementById('btn-check-updates'),
  
  // Mobile Testing
  mobileCurrentDevice: document.getElementById('mobile-current-device'),
  mobileCurrentNetwork: document.getElementById('mobile-current-network'),
  btnClearDevice: document.getElementById('btn-clear-device'),
  networkPresets: document.getElementById('network-presets'),
  maestroStatus: document.getElementById('maestro-status'),
  btnInstallMaestro: document.getElementById('btn-install-maestro'),
  nativePlatformSelect: document.getElementById('native-platform-select'),
  nativeAppId: document.getElementById('native-app-id'),
  nativeDevicesStatus: document.getElementById('native-devices-status'),
  btnRefreshDevices: document.getElementById('btn-refresh-devices'),
  btnRecordMobile: document.getElementById('btn-record-mobile'),
  btnRunMobileTest: document.getElementById('btn-run-mobile-test'),
  btnMobileHelp: document.getElementById('btn-mobile-help'),
  
  // Toast
  toastContainer: document.getElementById('toast-container')
};

// Mobile state
const mobileState = {
  selectedDevice: null,
  selectedNetwork: null,
  devices: null,
  maestroInstalled: false
};

// Initialize
async function init() {
  // Load configuration
  try {
    state.config = await window.flowstral.getConfig();
    
    // Apply config to UI
    if (elements.serverUrlInput) elements.serverUrlInput.value = state.config.serverUrl;
    if (elements.browserTypeSelect) elements.browserTypeSelect.value = state.config.preferences.browserType;
    if (elements.headlessToggle) elements.headlessToggle.checked = state.config.preferences.headless;
    if (elements.startupToggle) elements.startupToggle.checked = state.config.preferences.launchOnStartup;
    if (elements.trayToggle) elements.trayToggle.checked = state.config.preferences.minimizeToTray;
    if (elements.appVersion) elements.appVersion.textContent = state.config.version;
  } catch (e) {
    console.log('Config load failed:', e);
  }
  
  // Check license
  try {
    const licenseInfo = await window.flowstral.getLicenseInfo();
    if (licenseInfo?.valid) {
      updateLicenseUI(licenseInfo);
    }
  } catch (e) {
    console.log('License check failed:', e);
  }
  
  // Setup event listeners
  setupEventListeners();
  setupIPCListeners();
  
  // Update UI
  renderSteps();
  
  console.log('[App] Initialized');
}

// Setup UI event listeners
function setupEventListeners() {
  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
    });
  });
  
  // Browser Navigation
  elements.btnBack?.addEventListener('click', () => {
    window.flowstral.embeddedBrowser.back();
  });
  
  elements.btnForward?.addEventListener('click', () => {
    window.flowstral.embeddedBrowser.forward();
  });
  
  elements.btnRefresh?.addEventListener('click', () => {
    window.flowstral.embeddedBrowser.refresh();
  });
  
  elements.btnGo?.addEventListener('click', navigateToBrowser);
  
  elements.urlInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateToBrowser();
    }
  });
  
  // Recording Controls
  elements.btnRecord?.addEventListener('click', toggleRecording);
  elements.btnSuggest?.addEventListener('click', analyzePage);
  elements.btnClear?.addEventListener('click', clearActions);
  elements.btnGenerate?.addEventListener('click', generateTest);
  
  // Settings - License
  elements.btnActivate?.addEventListener('click', activateLicense);
  elements.btnDeactivate?.addEventListener('click', deactivateLicense);
  
  // Settings - Server
  elements.btnConnect?.addEventListener('click', toggleConnection);
  
  // Settings - Preferences
  elements.browserTypeSelect?.addEventListener('change', savePreferences);
  elements.headlessToggle?.addEventListener('change', savePreferences);
  elements.startupToggle?.addEventListener('change', savePreferences);
  elements.trayToggle?.addEventListener('change', savePreferences);
  
  // Settings - Updates
  elements.btnCheckUpdates?.addEventListener('click', checkUpdates);
  
  // Handle window resize to update browser bounds
  window.addEventListener('resize', updateBrowserBounds);
  
  // Mobile Testing
  elements.btnClearDevice?.addEventListener('click', clearMobileDevice);
  elements.btnInstallMaestro?.addEventListener('click', installMaestro);
  elements.btnRefreshDevices?.addEventListener('click', refreshNativeDevices);
  elements.btnRecordMobile?.addEventListener('click', startMobileRecording);
  elements.btnRunMobileTest?.addEventListener('click', runMobileTest);
  elements.btnMobileHelp?.addEventListener('click', showMobileHelp);
  
  // Network preset buttons
  elements.networkPresets?.querySelectorAll('.network-btn').forEach(btn => {
    btn.addEventListener('click', () => selectNetwork(btn.dataset.network));
  });
}

// Setup IPC listeners
function setupIPCListeners() {
  // Action recorded
  window.flowstral.on('action-recorded', (action) => {
    state.actions.push(action);
    renderSteps();
  });
  
  // Recording status
  window.flowstral.on('recording-status', ({ recording, actions }) => {
    state.recording = recording;
    if (actions) {
      state.actions = actions;
      renderSteps();
    }
    updateRecordingUI();
  });
  
  // URL changed
  window.flowstral.on('url-changed', (url) => {
    elements.urlInput.value = url;
  });
  
  // Connection status
  window.flowstral.on('connection-status', (status) => {
    state.connected = status === 'connected';
    updateConnectionUI();
  });
  
  // License status
  window.flowstral.on('license-status', (info) => {
    updateLicenseUI(info);
  });
  
  // Errors
  window.flowstral.on('error', (message) => {
    showToast(message, 'error');
  });
  
  // Updates
  window.flowstral.on('update-available', (info) => {
    showToast(`Update ${info.version} available!`, 'info');
  });
  
  window.flowstral.on('update-downloaded', () => {
    showToast('Update downloaded. Restart to install.', 'success');
  });
}

// Navigate to URL in embedded browser
async function navigateToBrowser() {
  const url = elements.urlInput.value.trim();
  if (!url) {
    showToast('Please enter a URL', 'warning');
    return;
  }
  
  // Show browser if not attached
  if (!state.browserAttached) {
    await showEmbeddedBrowser();
  }
  
  // Navigate
  const finalUrl = await window.flowstral.embeddedBrowser.navigate(url);
  console.log('[App] Navigated to:', finalUrl);
}

// Show embedded browser (attach BrowserView)
async function showEmbeddedBrowser() {
  const bounds = getBrowserBounds();
  const success = await window.flowstral.embeddedBrowser.show(bounds);
  
  if (success) {
    state.browserAttached = true;
    elements.browserPlaceholder?.classList.add('hidden');
    console.log('[App] Browser attached with bounds:', bounds);
  } else {
    showToast('Failed to show browser', 'error');
  }
}

// Get browser panel bounds (for BrowserView positioning)
function getBrowserBounds() {
  if (!elements.browserPanel) {
    return { x: 360, y: 50, width: 800, height: 600 };
  }
  
  const rect = elements.browserPanel.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

// Update browser bounds on resize
function updateBrowserBounds() {
  if (state.browserAttached) {
    const bounds = getBrowserBounds();
    window.flowstral.embeddedBrowser.resize(bounds);
  }
}

// Switch view
function switchView(viewName) {
  state.currentView = viewName;
  
  elements.views.forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });
  
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });
  
  // Update browser bounds when switching views
  setTimeout(updateBrowserBounds, 100);
  
  // Initialize mobile view when switching to it
  if (viewName === 'mobile') {
    initMobileView();
  }
}

// Toggle recording
async function toggleRecording() {
  if (state.recording) {
    // Stop recording
    const actions = await window.flowstral.embeddedBrowser.stopRecording();
    state.actions = actions || [];
    state.recording = false;
    renderSteps();
    showToast(`Recorded ${state.actions.length} steps`, 'success');
  } else {
    // Show browser first if not attached
    if (!state.browserAttached) {
      await showEmbeddedBrowser();
    }
    
    // Navigate to URL
    const url = elements.urlInput.value.trim();
    if (url) {
      await window.flowstral.embeddedBrowser.navigate(url);
    }
    
    // Start recording
    await window.flowstral.embeddedBrowser.startRecording();
    state.recording = true;
    state.actions = [];
    renderSteps();
    showToast('Recording started - interact with the browser', 'info');
  }
  
  updateRecordingUI();
}

// Update recording UI
function updateRecordingUI() {
  if (elements.btnRecord) {
    if (state.recording) {
      elements.btnRecord.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
        Stop
      `;
      elements.btnRecord.classList.add('recording');
    } else {
      elements.btnRecord.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="6"/>
        </svg>
        Record
      `;
      elements.btnRecord.classList.remove('recording');
    }
  }
  
  if (elements.urlInput) {
    elements.urlInput.disabled = state.recording;
  }
}

// Analyze page (suggest actions) - like browser extension
async function analyzePage() {
  showToast('Analyzing page for testable elements...', 'info');
  
  try {
    const suggestions = await window.flowstral.embeddedBrowser.suggest();
    
    if (!suggestions || suggestions.length === 0) {
      showToast('No testable elements found on this page', 'warning');
      return;
    }
    
    // Show suggestions modal
    showSuggestionsModal(suggestions);
    showToast(`Found ${suggestions.length} testable elements`, 'success');
  } catch (error) {
    showToast('Failed to analyze page: ' + error.message, 'error');
  }
}

// Show suggestions modal
function showSuggestionsModal(suggestions) {
  // Create modal if doesn't exist
  let modal = document.getElementById('suggestions-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'suggestions-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
        <h3>Suggested Test Steps</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px;">Click to add to recorded steps</p>
        <div id="suggestions-list" style="max-height: 400px; overflow-y: auto;"></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="suggestions-close">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('suggestions-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  // Populate suggestions
  const list = document.getElementById('suggestions-list');
  list.innerHTML = suggestions.map((s, i) => `
    <div class="step-item suggestion-item" data-index="${i}" style="cursor: pointer; margin-bottom: 8px;">
      <div class="step-number" style="background: var(--accent-purple);">${s.qword.charAt(0)}</div>
      <div class="step-content">
        <div class="step-type">${s.qword}</div>
        <div class="step-description">${escapeHtml(s.description)}</div>
      </div>
    </div>
  `).join('');
  
  // Add click handlers
  list.querySelectorAll('.suggestion-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const suggestion = suggestions[index];
      state.actions.push({
        id: `sug_${Date.now()}`,
        qword: suggestion.qword,
        args: suggestion.args,
        description: suggestion.description,
        timestamp: Date.now(),
        source: 'suggestion'
      });
      renderSteps();
      showToast(`Added: ${suggestion.qword}`, 'success');
    });
  });
  
  modal.style.display = 'flex';
}

// Clear actions
async function clearActions() {
  await window.flowstral.embeddedBrowser.clearActions();
  state.actions = [];
  renderSteps();
}

// Generate test - show export options modal
function generateTest() {
  if (state.actions.length === 0) {
    showToast('No steps to generate test from', 'warning');
    return;
  }
  
  // Create export modal if doesn't exist
  let modal = document.getElementById('export-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <h3>Export Test</h3>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Test Name</label>
          <input type="text" id="export-test-name" value="Recorded Salesforce Test" 
                 style="width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-primary);">
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
          <button class="btn btn-accent export-btn" data-format="flowstral">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
            </svg>
            Flowstral JSON
          </button>
          <button class="btn btn-secondary export-btn" data-format="robot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6"/><path d="M9 15h6"/>
            </svg>
            Robot Framework
          </button>
          <button class="btn export-btn" data-format="playwright">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Playwright
          </button>
        </div>
        
        <div id="export-preview" style="background: var(--bg-tertiary); border-radius: 8px; padding: 16px; max-height: 300px; overflow: auto; display: none;">
          <pre style="margin: 0; font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap;"><code id="export-code"></code></pre>
        </div>
        
        <div style="border-top: 1px solid var(--border-subtle); margin-top: 16px; padding-top: 16px;">
          <button class="btn btn-primary" id="export-to-builder" style="width: 100%; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open in Web Test Builder
          </button>
        </div>
        
        <div class="modal-actions" style="margin-top: 12px;">
          <button class="btn btn-ghost" id="export-close">Cancel</button>
          <button class="btn btn-secondary" id="export-copy" style="display: none;">Copy to Clipboard</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Close button
    document.getElementById('export-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Copy button
    document.getElementById('export-copy').addEventListener('click', () => {
      const code = document.getElementById('export-code').textContent;
      navigator.clipboard.writeText(code);
      showToast('Copied to clipboard!', 'success');
    });
    
    // Open in Test Builder button (PRIMARY ACTION)
    document.getElementById('export-to-builder').addEventListener('click', async () => {
      const testName = document.getElementById('export-test-name').value;
      showToast('Opening Test Builder...', 'info');
      
      try {
        const result = await window.flowstral.export.toTestBuilder(testName);
        
        if (result.success) {
          showToast('Opened in Test Builder!', 'success');
          modal.style.display = 'none';
        } else {
          showToast('Failed: ' + result.error, 'error');
        }
      } catch (error) {
        showToast('Failed to open Test Builder: ' + error.message, 'error');
      }
    });
    
    // Export format buttons
    modal.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const format = btn.dataset.format;
        const testName = document.getElementById('export-test-name').value;
        let code = '';
        
        try {
          switch (format) {
            case 'flowstral':
              const flowstralData = await window.flowstral.export.flowstralTest(testName);
              code = JSON.stringify(flowstralData, null, 2);
              break;
            case 'robot':
              code = await window.flowstral.export.robotFramework(testName);
              break;
            case 'playwright':
              code = await window.flowstral.export.playwright();
              break;
          }
          
          document.getElementById('export-code').textContent = code;
          document.getElementById('export-preview').style.display = 'block';
          document.getElementById('export-copy').style.display = 'inline-flex';
          document.getElementById('export-save').style.display = format === 'flowstral' ? 'inline-flex' : 'none';
          
          // Highlight selected button
          modal.querySelectorAll('.export-btn').forEach(b => b.style.opacity = '0.5');
          btn.style.opacity = '1';
        } catch (error) {
          showToast('Export failed: ' + error.message, 'error');
        }
      });
    });
  }
  
  // Reset and show
  document.getElementById('export-preview').style.display = 'none';
  document.getElementById('export-copy').style.display = 'none';
  document.getElementById('export-save').style.display = 'none';
  modal.querySelectorAll('.export-btn').forEach(b => b.style.opacity = '1');
  modal.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY-ONLY HELPERS - Pure functions that NEVER modify state.actions
// These only improve UI display while preserving all recorded data for playback
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a better display label from action data when args[0] is generic "element"
 * PURE FUNCTION: Only reads data, never modifies anything
 * Uses the full selectorObj/recipe data that recording already captured
 */
function getDisplayLabel(action) {
  if (!action) return 'element';
  
  const args = action.args || [];
  const label = args[0] || '';
  
  // If label is already good (not generic "element" or tag name), use it as-is
  if (label && label !== 'element' && label.length > 1 && !label.match(/^(div|span|button|input|a|li|td|tr)$/i)) {
    return label;
  }
  
  // Extract better label from ALL possible sources (recording captured this!)
  const sel = action.selectorObj || action.raw?.selectorObj || {};
  const raw = action.raw || {};
  const element = action.element || raw.element || {};
  const recipe = action.recipe || action.raw?.recipe || action.target || {};
  const recipeWhat = recipe?.what || {};
  const recipeWhere = recipe?.where || {};
  const recipeWhich = recipe?.which || {};
  
  // Priority order for finding a better label - try ALL sources exhaustively
  const betterLabel = 
    // First: accessible names (best for users)
    sel.title || raw.title || element.title ||
    sel.ariaLabel || raw.ariaLabel || element.ariaLabel ||
    recipeWhat.text ||
    recipeWhere.nearText ||
    // Second: form identifiers
    sel.placeholder || raw.placeholder || element.placeholder ||
    sel.name || raw.name || element.name ||
    recipeWhich.name ||
    // Third: test IDs (developer-friendly)
    sel.testId || raw.testId || element.testId ||
    sel.dataTestId || raw.dataTestId || element.dataTestId ||
    recipeWhich.testId ||
    // Fourth: text content from multiple sources
    sel.text || raw.text || element.text ||
    sel.innerText || raw.innerText || element.innerText ||
    element.textContent ||
    // Fifth: try to extract from description
    extractLabelFromDescription(action.description) ||
    // Sixth: role-based description with tag
    (sel.role || element.role ? `${sel.role || element.role}${sel.tagName || element.tagName ? ' (' + (sel.tagName || element.tagName) + ')' : ''}` : null) ||
    // Seventh: tag with index for disambiguation (if multiple)
    ((sel.tagName || element.tagName || raw.tag) && (sel.elementIndex !== undefined || raw.elementIndex !== undefined) && (sel.elementIndex > 0 || raw.elementIndex > 0)
      ? `${sel.tagName || element.tagName || raw.tag} #${(sel.elementIndex || raw.elementIndex) + 1}` 
      : null) ||
    // Eighth: just the tag name
    sel.tagName || element.tagName || raw.tag ||
    // Last resort: original label
    label;
  
  return betterLabel || 'element';
}

/**
 * Try to extract a meaningful label from description text
 * e.g., 'Click "Login"' -> 'Login', 'Fill "username"' -> 'username'
 */
function extractLabelFromDescription(description) {
  if (!description) return null;
  
  // Pattern: Action "Label" - extract the label
  const match = description.match(/(?:Click|Fill|Select|Check|Uncheck|Type)\s*["']([^"']+)["']/i);
  if (match && match[1] && match[1] !== 'element' && match[1].length > 1) {
    return match[1];
  }
  return null;
}

/**
 * Get field identity for deduplication (by attributes, not display label)
 * PURE FUNCTION: Only reads data
 * Enhanced to check multiple sources and handle edge cases
 */
function getFieldIdentity(action) {
  if (!action) return null;
  
  const sel = action.selectorObj || {};
  const raw = action.raw?.selectorObj || action.raw || {};
  const element = action.element || action.raw?.element || {};
  const recipe = action.recipe || action.target || {};
  const recipeWhich = recipe?.which || {};
  
  // Build identity from stable field attributes (NOT from display label)
  // Check ALL possible sources
  return sel.name || raw.name || element.name ||
         sel.id || raw.id || element.id ||
         sel.testId || raw.testId || element.testId ||
         sel.dataTestId || raw.dataTestId || element.dataTestId ||
         sel.placeholder || raw.placeholder || element.placeholder ||
         recipeWhich.name ||
         recipeWhich.id ||
         recipeWhich.testId ||
         null;
}

/**
 * Check if a string looks like a field VALUE rather than a field LABEL
 * Values: passwords, emails, typed content
 * Labels: "username", "pw", "email", "password", etc.
 */
function looksLikeFieldValue(str) {
  if (!str || str.length < 3) return false;
  
  // Common field label names - NOT values
  const fieldLabelPatterns = /^(username|user|pw|pwd|password|pass|email|mail|name|phone|tel|address|city|zip|code|input|field|text|search|query)$/i;
  if (fieldLabelPatterns.test(str)) return false;
  
  // Looks like email
  if (str.includes('@') && str.includes('.')) return true;
  
  // Looks like password (mixed case + numbers/special chars, 6+ chars)
  if (str.length >= 6 && /[A-Z]/.test(str) && /[a-z]/.test(str) && /[0-9@!#$%^&*()_+\-=]/.test(str)) return true;
  
  // Looks like typed content (has spaces or is very long)
  if (str.includes(' ') && str.length > 10) return true;
  
  // Contains @ but not a field name
  if (str.includes('@') && str.length > 5) return true;
  
  return false;
}

/**
 * Check if two Fill actions are for the same field
 * Uses multiple heuristics to detect duplicates even when field identity differs
 */
function areSameFillField(action1, action2) {
  if (!action1 || !action2) return false;
  if (action1.qword !== 'Fill' || action2.qword !== 'Fill') return false;
  
  // Check 1: Same field identity (name, id, testId, placeholder)
  const id1 = getFieldIdentity(action1);
  const id2 = getFieldIdentity(action2);
  if (id1 && id2 && id1 === id2) return true;
  
  // Check 2: Same value being filled
  const val1 = action1.args?.[1] || '';
  const val2 = action2.args?.[1] || '';
  const label1 = action1.args?.[0] || '';
  const label2 = action2.args?.[0] || '';
  const timeDiff = Math.abs((action1.timestamp || 0) - (action2.timestamp || 0));
  
  // Within 5 second window (give more room for Recipe vs CDP timing)
  if (timeDiff < 5000) {
    // Same value = same field
    if (val1 && val2 && val1 === val2) return true;
    
    // One value contains the other (partial typing captured)
    if (val1 && val2 && (val1.includes(val2) || val2.includes(val1))) return true;
    
    // Label of one equals value of other (Recipe bug)
    if (label1 && val2 && label1 === val2) return true;
    if (label2 && val1 && label2 === val1) return true;
    
    // Label of one contains value of other (truncated)
    if (label1 && val2 && (label1.includes(val2) || val2.includes(label1))) return true;
    if (label2 && val1 && (label2.includes(val1) || val1.includes(label2))) return true;
  }
  
  // Check 3: One label looks like a VALUE (Recipe bug: uses value as label)
  // If one has a proper field identity and the other has a value-like label
  if (timeDiff < 5000) {
    const label1IsValue = looksLikeFieldValue(label1);
    const label2IsValue = looksLikeFieldValue(label2);
    
    // One is a real field (has identity or normal label), other used value as label
    if (label1IsValue && (id2 || !label2IsValue)) {
      console.log('[areSameFillField] Detected value-as-label:', label1, 'vs', label2);
      return true;
    }
    if (label2IsValue && (id1 || !label1IsValue)) {
      console.log('[areSameFillField] Detected value-as-label:', label2, 'vs', label1);
      return true;
    }
    
    // Both have identity - probably different fields
    // Neither has identity but both have value-like labels within time window
    if (label1IsValue && label2IsValue && !id1 && !id2) {
      // Could be same password field captured twice with different partial values
      return true;
    }
  }
  
  return false;
}

/**
 * Create display-ready actions array with deduplication
 * PURE FUNCTION: Returns NEW array, NEVER modifies input
 * - Deduplicates Fill actions for the same field (keeps last/most complete)
 * - Preserves all other action types
 */
function getDisplayActions(actions) {
  if (!actions || actions.length === 0) return [];
  
  const result = [];
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    if (action.qword === 'Fill') {
      // Check if we already have a fill for this same field
      const existingIndex = result.findIndex(item => areSameFillField(item.action, action));
      
      if (existingIndex !== -1) {
        // Replace with the later one (more complete value) OR the one with better field identity
        const existing = result[existingIndex];
        const existingId = getFieldIdentity(existing.action);
        const newId = getFieldIdentity(action);
        const existingVal = existing.action.args?.[1] || '';
        const newVal = action.args?.[1] || '';
        
        // Keep the one with: 1) field identity, 2) longer value, 3) later timestamp
        const shouldReplace = 
          (!existingId && newId) || // new has identity, old doesn't
          (newVal.length > existingVal.length) || // new has longer value
          (action.timestamp > existing.action.timestamp); // new is later
        
        if (shouldReplace) {
          result[existingIndex] = { action, originalIndex: i };
        }
        // Skip adding duplicate
        continue;
      }
      
      result.push({ action, originalIndex: i });
    } else {
      result.push({ action, originalIndex: i });
    }
  }
  
  // Sort by original index to maintain recording order
  result.sort((a, b) => a.originalIndex - b.originalIndex);
  
  // Return just the actions (without the index metadata)
  return result.map(item => item.action);
}

/**
 * Build improved description for display
 * PURE FUNCTION: Creates new string, doesn't modify action
 */
function getDisplayDescription(action) {
  if (!action) return '';
  
  const qword = action.qword || action.type?.toUpperCase() || 'ACTION';
  let description = action.description || '';
  const betterLabel = getDisplayLabel(action);
  
  // If description contains generic "element", replace it
  if (description.includes('"element"') || description.includes("'element'")) {
    description = description.replace(/"element"|'element'/g, `"${betterLabel}"`);
  }
  
  // If label is still "element" in the description after getDisplayLabel, try harder
  if (betterLabel === 'element' || description.includes('Click "element"')) {
    // For clicks, try to build from role/tag
    const sel = action.selectorObj || action.raw?.selectorObj || {};
    const element = action.element || action.raw?.element || {};
    const role = sel.role || element.role;
    const tag = sel.tagName || element.tagName || action.raw?.tag;
    
    if (role) {
      description = `Click ${role}${tag ? ' (' + tag + ')' : ''}`;
    } else if (tag && tag !== 'element') {
      description = `Click ${tag}`;
    }
  }
  
  // If no description or it's just the qword, build one
  if (!description || description === qword) {
    if (qword === 'Fill') {
      const value = action.displayArgs?.[1] || action.args?.[1] || '';
      const displayVal = value.length > 20 ? value.substring(0, 20) + '...' : value;
      description = `Fill "${betterLabel}": "${displayVal}"`;
    } else if (qword === 'GoTo') {
      description = `Navigate to ${action.args?.[0] || action.url || ''}`;
    } else {
      description = `${qword.replace(/([A-Z])/g, ' $1').trim()} "${betterLabel}"`;
    }
  }
  
  return description;
}

// ═══════════════════════════════════════════════════════════════════════════════
// END DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Render steps list with QWord format (like browser extension)
// Uses display helpers for cleaner UI while preserving original data
function renderSteps() {
  if (!elements.stepsList) return;
  
  // DEBUG: Verify new code is running
  console.log('[renderSteps] V2 - Display helpers active, actions:', state.actions.length);
  
  if (state.actions.length === 0) {
    elements.stepsList.innerHTML = `
      <div class="empty-steps">
        <p>No steps recorded</p>
        <span>Click Record and interact with the browser</span>
      </div>
    `;
  } else {
    // DEBUG: Log raw actions to understand structure
    console.log('[renderSteps] Raw actions:', JSON.stringify(state.actions.map(a => ({
      qword: a.qword,
      args: a.args,
      desc: a.description?.substring(0, 40),
      sel: a.selectorObj ? Object.keys(a.selectorObj).filter(k => a.selectorObj[k]) : [],
      raw: a.raw ? Object.keys(a.raw).filter(k => a.raw[k]) : []
    })), null, 2));
    
    // DISPLAY-ONLY: Get deduplicated actions for cleaner UI
    // Original state.actions is NEVER modified - used intact for export/playback
    const displayActions = getDisplayActions(state.actions);
    
    console.log('[renderSteps] After dedup:', displayActions.length, 'actions');
    
    elements.stepsList.innerHTML = displayActions.map((action, index) => {
      // Use QWord format (matches browser extension)
      const qword = action.qword || action.type?.toUpperCase() || 'ACTION';
      
      // DISPLAY-ONLY: Get improved description using full action data
      const description = getDisplayDescription(action);
      
      // Color coding by QWord type
      const qwordColors = {
        'GoTo': '#10B981',      // Green for navigation
        'ClickText': '#00D9FF', // Cyan for clicks
        'ClickElement': '#00D9FF',
        'Fill': '#7C3AED',      // Purple for input
        'Select': '#F59E0B',    // Orange for select
        'AssertText': '#EC4899' // Pink for assertions
      };
      const color = qwordColors[qword] || '#00D9FF';
      
      return `
        <div class="step-item" data-index="${index}">
          <div class="step-number">${index + 1}</div>
          <div class="step-content">
            <div class="step-type" style="color: ${color};">${qword}</div>
            <div class="step-description">${escapeHtml(description.substring(0, 60))}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Show ORIGINAL action count (so user knows full recording scope)
  // Display may show fewer due to deduplication, but all are preserved
  if (elements.stepCount) {
    elements.stepCount.textContent = state.actions.length;
  }
  
  if (elements.btnClear) {
    elements.btnClear.disabled = state.actions.length === 0;
  }
  
  if (elements.btnGenerate) {
    elements.btnGenerate.disabled = state.actions.length === 0;
  }
}

// Activate license
async function activateLicense() {
  const key = elements.licenseKeyInput?.value.trim();
  if (!key) {
    showToast('Please enter a license key', 'warning');
    return;
  }
  
  const result = await window.flowstral.activateLicense(key);
  
  if (result.valid) {
    showToast('License activated successfully!', 'success');
    updateLicenseUI(result);
  } else {
    showToast(result.error || 'License activation failed', 'error');
  }
}

// Deactivate license
async function deactivateLicense() {
  await window.flowstral.deactivateLicense();
  if (elements.licenseInfoCard) elements.licenseInfoCard.style.display = 'none';
  if (elements.licenseKeyInput) elements.licenseKeyInput.value = '';
  updateLicenseStatusBadge(false);
  showToast('License deactivated', 'info');
}

// Update license UI
function updateLicenseUI(info) {
  state.licensed = info.valid;
  updateLicenseStatusBadge(info.valid);
  
  if (info.valid && elements.licenseInfoCard) {
    elements.licenseInfoCard.style.display = 'flex';
    if (elements.licenseType) elements.licenseType.textContent = info.type?.toUpperCase() || 'UNKNOWN';
    if (elements.licenseExpiry) elements.licenseExpiry.textContent = info.expiresAt 
      ? new Date(info.expiresAt).toLocaleDateString() 
      : 'Never';
  }
}

// Update license status badge
function updateLicenseStatusBadge(valid) {
  const badge = elements.licenseStatus;
  if (!badge) return;
  
  const dot = badge.querySelector('.status-dot');
  const text = badge.querySelector('.status-text');
  
  if (valid) {
    if (dot) dot.className = 'status-dot online';
    if (text) text.textContent = 'Licensed';
  } else {
    if (dot) dot.className = 'status-dot warning';
    if (text) text.textContent = 'Not Licensed';
  }
}

// Toggle server connection
async function toggleConnection() {
  if (state.connected) {
    await window.flowstral.disconnectServer();
  } else {
    const url = elements.serverUrlInput?.value.trim();
    if (url) {
      await window.flowstral.setConfig({ serverUrl: url });
    }
    await window.flowstral.connectServer();
  }
}

// Update connection UI
function updateConnectionUI() {
  const badge = elements.connectionStatus;
  if (!badge) return;
  
  const dot = badge.querySelector('.status-dot');
  const text = badge.querySelector('.status-text');
  
  if (state.connected) {
    if (dot) dot.className = 'status-dot online';
    if (text) text.textContent = 'Connected';
    if (elements.btnConnect) elements.btnConnect.textContent = 'Disconnect';
  } else {
    if (dot) dot.className = 'status-dot offline';
    if (text) text.textContent = 'Disconnected';
    if (elements.btnConnect) elements.btnConnect.textContent = 'Connect';
  }
}

// Save preferences
async function savePreferences() {
  await window.flowstral.setConfig({
    preferences: {
      browserType: elements.browserTypeSelect?.value || 'chromium',
      headless: elements.headlessToggle?.checked || false,
      launchOnStartup: elements.startupToggle?.checked || true,
      minimizeToTray: elements.trayToggle?.checked || true
    }
  });
}

// Check for updates
async function checkUpdates() {
  try {
    await window.flowstral.checkUpdates();
    showToast('Checking for updates...', 'info');
  } catch (e) {
    showToast('Failed to check for updates', 'error');
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = elements.toastContainer;
  if (!container) {
    console.log(`[Toast] ${type}: ${message}`);
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// =============================================================================
// MOBILE TESTING FUNCTIONS
// =============================================================================

// Load mobile devices and populate UI
async function loadMobileDevices() {
  try {
    if (!window.flowstral?.mobile?.getDevices) {
      console.log('[Mobile] Mobile API not available');
      return;
    }
    
    const data = await window.flowstral.mobile.getDevices();
    mobileState.devices = data;
    
    if (!data?.categories) return;
    
    const categoryMap = {
      'Popular': 'popular-devices',
      'iOS - iPhone': 'ios-iphone-devices',
      'iOS - iPad': 'ios-ipad-devices',
      'Android - Google': 'android-google-devices',
      'Android - Samsung': 'android-samsung-devices',
      'Android - Other': 'android-other-devices'
    };
    
    for (const [category, elementId] of Object.entries(categoryMap)) {
      const container = document.getElementById(elementId);
      if (!container) continue;
      
      const devices = data.categories[category] || [];
      container.innerHTML = devices.map(deviceName => {
        const device = data.devices[deviceName];
        if (!device) return '';
        
        return `
          <button class="device-btn" data-device="${deviceName}">
            <span class="device-name">${deviceName}</span>
            <span class="device-info">${device.viewport.width}×${device.viewport.height}</span>
          </button>
        `;
      }).join('');
      
      // Add click handlers
      container.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', () => selectDevice(btn.dataset.device));
      });
    }
    
    // Load current config
    const config = await window.flowstral.mobile.getConfig();
    if (config?.device) {
      mobileState.selectedDevice = config.device;
      updateMobileUI();
    }
    
    console.log('[Mobile] Loaded', Object.keys(data.devices || {}).length, 'devices');
  } catch (error) {
    console.error('[Mobile] Failed to load devices:', error);
  }
}

// Select a mobile device
async function selectDevice(deviceName) {
  try {
    const network = mobileState.selectedNetwork || null;
    await window.flowstral.mobile.setDevice(deviceName, network);
    mobileState.selectedDevice = deviceName;
    updateMobileUI();
    showToast(`Device set to ${deviceName}`, 'success');
  } catch (error) {
    showToast('Failed to set device: ' + error.message, 'error');
  }
}

// Select network preset
async function selectNetwork(networkName) {
  try {
    if (networkName === mobileState.selectedNetwork) {
      // Deselect
      mobileState.selectedNetwork = null;
      if (mobileState.selectedDevice) {
        await window.flowstral.mobile.setDevice(mobileState.selectedDevice, null);
      }
    } else {
      mobileState.selectedNetwork = networkName;
      if (mobileState.selectedDevice) {
        await window.flowstral.mobile.setDevice(mobileState.selectedDevice, networkName);
      }
    }
    updateMobileUI();
    showToast(`Network: ${mobileState.selectedNetwork || 'No throttling'}`, 'info');
  } catch (error) {
    showToast('Failed to set network: ' + error.message, 'error');
  }
}

// Clear mobile device (return to desktop mode)
async function clearMobileDevice() {
  try {
    await window.flowstral.mobile.clearDevice();
    mobileState.selectedDevice = null;
    mobileState.selectedNetwork = null;
    updateMobileUI();
    showToast('Switched to desktop mode', 'info');
  } catch (error) {
    showToast('Failed to clear device: ' + error.message, 'error');
  }
}

// Update mobile UI state
function updateMobileUI() {
  // Update current device display
  if (elements.mobileCurrentDevice) {
    elements.mobileCurrentDevice.textContent = mobileState.selectedDevice 
      ? mobileState.selectedDevice 
      : 'Desktop (No emulation)';
  }
  
  // Update current network display
  if (elements.mobileCurrentNetwork) {
    elements.mobileCurrentNetwork.textContent = mobileState.selectedNetwork 
      ? mobileState.selectedNetwork 
      : 'No throttling';
  }
  
  // Highlight selected device
  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.device === mobileState.selectedDevice);
  });
  
  // Highlight selected network
  document.querySelectorAll('.network-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.network === mobileState.selectedNetwork);
  });
}

// Check Maestro installation status
async function checkMaestroStatus() {
  try {
    if (!window.flowstral?.mobile?.checkMaestro) {
      updateMaestroUI({ installed: false, message: 'API not available' });
      return;
    }
    
    const status = await window.flowstral.mobile.checkMaestro();
    mobileState.maestroInstalled = status.installed;
    updateMaestroUI(status);
  } catch (error) {
    updateMaestroUI({ installed: false, message: error.message });
  }
}

// Update Maestro status UI
function updateMaestroUI(status) {
  if (elements.maestroStatus) {
    if (status.installed) {
      elements.maestroStatus.textContent = `✓ Installed (${status.version || 'Unknown version'})`;
      elements.maestroStatus.className = 'maestro-installed';
    } else {
      elements.maestroStatus.textContent = `✗ Not installed`;
      elements.maestroStatus.className = 'maestro-not-installed';
    }
  }
  
  if (elements.btnInstallMaestro) {
    elements.btnInstallMaestro.style.display = status.installed ? 'none' : 'inline-flex';
  }
}

// Install Maestro
async function installMaestro() {
  showToast('Opening Maestro installation page...', 'info');
  // Open Maestro installation URL
  window.open('https://maestro.mobile.dev/getting-started/installing-maestro', '_blank');
}

// Refresh native devices list
async function refreshNativeDevices() {
  try {
    const platform = elements.nativePlatformSelect?.value || 'android';
    const devices = await window.flowstral.mobile.getNativeDevices(platform);
    
    if (elements.nativeDevicesStatus) {
      if (devices && devices.length > 0) {
        elements.nativeDevicesStatus.textContent = `${devices.length} device(s) found`;
      } else {
        elements.nativeDevicesStatus.textContent = 'No devices found - start emulator/simulator';
      }
    }
    
    showToast(`Found ${devices?.length || 0} ${platform} device(s)`, 'info');
  } catch (error) {
    showToast('Failed to list devices: ' + error.message, 'error');
  }
}

// Start mobile recording
async function startMobileRecording() {
  if (!mobileState.selectedDevice) {
    showToast('Please select a device first', 'warning');
    return;
  }
  
  // Switch to Studio view
  switchView('studio');
  
  // Small delay to ensure view switch, then trigger recording
  setTimeout(() => {
    if (!state.recording) {
      toggleRecording();
    }
  }, 100);
}

// Run test on mobile
async function runMobileTest() {
  if (!mobileState.selectedDevice) {
    showToast('Please select a device first', 'warning');
    return;
  }
  
  if (state.actions.length === 0) {
    showToast('No test steps to run. Record a test first.', 'warning');
    return;
  }
  
  showToast(`Running test on ${mobileState.selectedDevice}...`, 'info');
  
  try {
    // The device is already set, so just run the test
    const result = await window.flowstral.embeddedBrowser.runTest({
      steps: state.actions,
      url: elements.urlInput?.value
    });
    
    if (result.success) {
      showToast('Test passed on mobile!', 'success');
    } else {
      showToast('Test failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showToast('Test execution failed: ' + error.message, 'error');
  }
}

// Show mobile help
function showMobileHelp() {
  // Create help modal
  let modal = document.getElementById('mobile-help-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mobile-help-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
        <h3>📱 Mobile Testing Guide</h3>
        
        <div style="margin: 16px 0;">
          <h4 style="color: var(--accent-cyan); margin-bottom: 8px;">Mobile Web Testing</h4>
          <ol style="margin-left: 20px; color: var(--text-secondary);">
            <li>Select a device from the grid above</li>
            <li>Optionally select a network condition</li>
            <li>Click "Record on Mobile" to start recording</li>
            <li>The browser will emulate the selected device</li>
            <li>Record your test as normal</li>
          </ol>
        </div>
        
        <div style="margin: 16px 0;">
          <h4 style="color: var(--accent-purple); margin-bottom: 8px;">Native App Testing (Maestro)</h4>
          <ol style="margin-left: 20px; color: var(--text-secondary);">
            <li>Install Maestro: <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">curl -Ls "https://get.maestro.mobile.dev" | bash</code></li>
            <li>Start an Android emulator or iOS simulator</li>
            <li>Enter your app's bundle ID</li>
            <li>QAAI will convert your test steps to Maestro commands</li>
          </ol>
        </div>
        
        <div style="margin: 16px 0;">
          <h4 style="color: var(--success); margin-bottom: 8px;">Tips</h4>
          <ul style="margin-left: 20px; color: var(--text-secondary);">
            <li>Use "Slow 3G" to test loading states</li>
            <li>iPad/Tablet tests may need wider viewports</li>
            <li>Tests recorded on mobile work on desktop too</li>
          </ul>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="document.getElementById('mobile-help-modal').style.display='none'">Close</button>
          <button class="btn btn-secondary" onclick="window.open('file:///${encodeURIComponent('C:/QAAI/docs/MOBILE_TESTING_GUIDE.md')}')">View Full Docs</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }
  
  modal.style.display = 'flex';
}

// Initialize mobile view when switching to it
function initMobileView() {
  if (!mobileState.devices) {
    loadMobileDevices();
  }
  checkMaestroStatus();
}

// Initialize app
document.addEventListener('DOMContentLoaded', init);
