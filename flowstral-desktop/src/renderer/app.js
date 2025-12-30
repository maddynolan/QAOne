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
  
  // Toast
  toastContainer: document.getElementById('toast-container')
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

// Render steps list with QWord format (like browser extension)
function renderSteps() {
  if (!elements.stepsList) return;
  
  if (state.actions.length === 0) {
    elements.stepsList.innerHTML = `
      <div class="empty-steps">
        <p>No steps recorded</p>
        <span>Click Record and interact with the browser</span>
      </div>
    `;
  } else {
    elements.stepsList.innerHTML = state.actions.map((action, index) => {
      // Use QWord format (matches browser extension)
      const qword = action.qword || action.type?.toUpperCase() || 'ACTION';
      const args = action.displayArgs || action.args || [];
      const description = action.description || args.join(' | ') || '';
      
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
            <div class="step-description">${escapeHtml(description.substring(0, 50))}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  
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

// Initialize app
document.addEventListener('DOMContentLoaded', init);
