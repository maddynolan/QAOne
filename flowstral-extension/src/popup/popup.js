/**
 * Popup Controller
 * Manages the extension UI and communicates with background script
 */

class PopupController {
  constructor() {
    this.state = {
      recording: false,
      paused: false,
      actions: [],
      script: '',
    };
    
    this.options = {
      app: 'auto',
      language: 'typescript',
      useVisualLocators: false,
      includeComments: true,
      generateAssertions: true,
      addWaits: true,
      showBrowser: false, // Run tests with visible browser
    };
    
    this.elements = {};
    this.init();
  }

  async init() {
    // Cache DOM elements
    this.cacheElements();
    
    // Set up event listeners
    this.attachEventListeners();
    
    // Load current state from background
    await this.loadState();
    
    // Update UI
    this.updateUI();
  }

  cacheElements() {
    this.elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      actionCount: document.getElementById('actionCount'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      resumeBtn: document.getElementById('resumeBtn'),
      clearBtn: document.getElementById('clearBtn'),
      generateBtn: document.getElementById('generateBtn'),
      runBtn: document.getElementById('runBtn'),
      downloadBtn: document.getElementById('downloadBtn'),
      copyBtn: document.getElementById('copyBtn'),
      downloadISTQB: document.getElementById('downloadISTQB'),
      downloadGherkin: document.getElementById('downloadGherkin'),
      downloadMarkdown: document.getElementById('downloadMarkdown'),
      executionResults: document.getElementById('executionResults'),
      resultsContent: document.getElementById('resultsContent'),
      openSidebarBtn: document.getElementById('openSidebarBtn'),
      showBrowserToggle: document.getElementById('showBrowserToggle'),
      closeResults: document.getElementById('closeResults'),
      actionsContainer: document.getElementById('actionsContainer'),
      emptyState: document.getElementById('emptyState'),
      scriptPreview: document.getElementById('scriptPreview'),
      scriptCode: document.getElementById('scriptCode'),
      optionsPanel: document.getElementById('optionsPanel'),
    };
  }

  attachEventListeners() {
    // Recording controls
    this.elements.startBtn.addEventListener('click', () => this.startRecording());
    this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
    this.elements.pauseBtn.addEventListener('click', () => this.pauseRecording());
    this.elements.resumeBtn.addEventListener('click', () => this.resumeRecording());
    this.elements.clearBtn.addEventListener('click', () => this.clearRecording());
    
    // Script controls
    this.elements.generateBtn.addEventListener('click', () => this.generateScript());
    this.elements.runBtn.addEventListener('click', () => this.runTest());
    this.elements.downloadBtn.addEventListener('click', () => this.downloadScript());
    this.elements.copyBtn.addEventListener('click', () => this.copyScript());
    
    // Test case generation
    this.elements.downloadISTQB.addEventListener('click', () => this.downloadTestCase('istqb'));
    this.elements.downloadGherkin.addEventListener('click', () => this.downloadTestCase('gherkin'));
    this.elements.downloadMarkdown.addEventListener('click', () => this.downloadTestCase('markdown'));
    this.elements.closeResults.addEventListener('click', () => {
      this.elements.executionResults.classList.add('hidden');
    });
    
    // Options toggles
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', () => this.toggleOption(toggle));
    });

    // Language toggle
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setLanguage(btn));
    });

    // App selector - persist selection
    const appSelector = document.getElementById('appSelector');
    if (appSelector) {
      // Load saved app selection
      chrome.storage.local.get(['flowstral_app_selection'], (result) => {
        if (result.flowstral_app_selection) {
          this.options.app = result.flowstral_app_selection;
          appSelector.value = result.flowstral_app_selection;
        }
      });
      
      appSelector.addEventListener('change', (e) => {
        this.options.app = e.target.value;
        // Save to storage
        chrome.storage.local.set({ flowstral_app_selection: e.target.value });
        this.detectAppOnPage();
      });
    }

    // Open sidebar button
    if (this.elements.openSidebarBtn) {
      this.elements.openSidebarBtn.addEventListener('click', () => this.openSidebar());
    }

    // Show browser toggle - load saved state
    if (this.elements.showBrowserToggle) {
      chrome.storage.local.get(['flowstral_show_browser'], (result) => {
        if (result.flowstral_show_browser) {
          this.options.showBrowser = true;
          this.elements.showBrowserToggle.classList.add('active');
        }
      });
    }
  }

  async openSidebar() {
    try {
      // Open the side panel
      await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
    } catch (error) {
      console.error('Failed to open sidebar:', error);
      // Fallback: show message that sidebar requires newer Chrome
      alert('Sidebar requires Chrome 114+ or Edge 114+. You can also click the extension icon and select "Open in side panel".');
    }
  }

  detectAppOnPage() {
    // Non-blocking - don't wait for this
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, { type: 'DETECT_APP' }).then(response => {
        if (response && response.name) {
          // Update status to show detected app
          const statusText = document.getElementById('statusText');
          if (statusText && this.options.app === 'auto') {
            statusText.textContent = `Ready (${response.name})`;
          }
        }
        }).catch(() => {
          // Content script not loaded yet - ignore
        });
      }
    }).catch(() => {
      // Ignore errors
    });
  }

  setLanguage(btn) {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.options.language = btn.dataset.lang;
    // Save options
    chrome.storage.local.set({ flowstral_options: this.options });
  }

  async loadState() {
    try {
      // Load saved options first
      const savedOptions = await new Promise((resolve) => {
        chrome.storage.local.get(['flowstral_app_selection', 'flowstral_options'], (result) => {
          resolve(result);
        });
      });
      
      if (savedOptions.flowstral_app_selection) {
        this.options.app = savedOptions.flowstral_app_selection;
      }
      if (savedOptions.flowstral_options) {
        this.options = { ...this.options, ...savedOptions.flowstral_options };
      }
      
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      this.state.recording = response.recording || false;
      
      const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
      this.state.actions = actionsResponse.actions || [];
      
      // ALWAYS clear script on load - never use cached script
      // This ensures fresh generation with current options every time
      this.state.script = '';
      
      // Also clear any cached script from storage
      chrome.storage.local.remove('flowstral_script');
    } catch (error) {
      console.error('Failed to load state:', error);
      // Reset to safe defaults
      this.state.recording = false;
      this.state.actions = [];
      this.state.script = '';
    }
  }

  updateUI() {
    const { recording, actions } = this.state;
    
    // Update status indicator
    if (recording) {
      this.elements.statusDot.classList.add('active');
      this.elements.statusText.textContent = this.state.paused ? 'Paused' : 'Recording...';
      this.elements.startBtn.classList.add('hidden');
      this.elements.stopBtn.classList.remove('hidden');
      this.elements.pauseBtn.classList.remove('hidden');
      this.elements.resumeBtn.classList.add('hidden');
      this.elements.pauseBtn.disabled = this.state.paused;
      this.elements.resumeBtn.disabled = !this.state.paused;
    } else {
      this.elements.statusDot.classList.remove('active');
      this.elements.statusText.textContent = 'Ready';
      this.elements.startBtn.classList.remove('hidden');
      this.elements.stopBtn.classList.add('hidden');
      this.elements.pauseBtn.classList.add('hidden');
      this.elements.resumeBtn.classList.add('hidden');
    }
    
    // Update action count
    this.elements.actionCount.textContent = actions.length;
    
    // Update app selector to match saved selection
    const appSelector = document.getElementById('appSelector');
    if (appSelector && this.options.app) {
      appSelector.value = this.options.app;
    }
    
    // Update buttons
    this.elements.clearBtn.disabled = actions.length === 0;
    this.elements.generateBtn.disabled = actions.length === 0;
    this.elements.runBtn.disabled = !this.state.script || this.state.script.trim().length === 0;
    this.elements.downloadBtn.disabled = !this.state.script;
    
    // Show/hide actions list
    if (actions.length > 0) {
      this.elements.emptyState.classList.add('hidden');
      this.elements.actionsContainer.classList.remove('hidden');
      this.renderActionsList();
    } else {
      this.elements.emptyState.classList.remove('hidden');
      this.elements.actionsContainer.classList.add('hidden');
    }
    
    // Show/hide script preview
    if (this.state.script) {
      this.elements.scriptPreview.classList.remove('hidden');
      this.elements.scriptCode.textContent = this.state.script;
    } else {
      this.elements.scriptPreview.classList.add('hidden');
    }
  }

  renderActionsList() {
    const container = this.elements.actionsContainer;
    container.innerHTML = '';
    
    // Show last 10 actions
    const recentActions = this.state.actions.slice(-10);
    
    recentActions.forEach((action, index) => {
      const item = document.createElement('div');
      item.className = 'action-item';
      item.innerHTML = `
        <div class="action-icon">${this.getActionIcon(action.type)}</div>
        <div class="action-details">
          <div class="action-type">${action.type}</div>
          <div class="action-desc">${action.description || this.getActionDescription(action)}</div>
        </div>
      `;
      container.appendChild(item);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  getActionIcon(type) {
    const icons = {
      click: '👆',
      dblclick: '👆👆',
      fill: '⌨️',
      type: '⌨️',
      select: '📋',
      check: '☑️',
      uncheck: '⬜',
      navigate: '🔗',
      press: '⏎',
      keyboard: '⌨️',
      hover: '👋',
      upload: '📎',
    };
    return icons[type] || '⚡';
  }

  getActionDescription(action) {
    switch (action.type) {
      case 'click':
        return `Click on element`;
      case 'fill':
        return `Fill with "${(action.value || '').substring(0, 20)}..."`;
      case 'navigate':
        return action.url ? new URL(action.url).pathname : 'Navigate';
      case 'select':
        return `Select "${action.label || action.value}"`;
      default:
        return action.type;
    }
  }

  async startRecording() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        alert('No active tab found');
        return;
      }
      
      // Check if we can record on this page
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        alert('Cannot record on browser internal pages');
        return;
      }
      
      // Send start recording with options (non-blocking - don't await)
      chrome.runtime.sendMessage({ 
        type: 'START_RECORDING', 
        tabId: tab.id,
        options: {
          app: this.options.app,
          useVisualLocators: this.options.useVisualLocators,
        }
      }).catch(() => {}); // Ignore errors

      // Also send to content script directly (non-blocking)
      chrome.tabs.sendMessage(tab.id, { 
        type: 'START_RECORDING',
        options: {
          app: this.options.app,
          useVisualLocators: this.options.useVisualLocators,
        }
      }).catch(() => {}); // Ignore errors
      
      // Update UI immediately (don't wait for responses)
      this.state.recording = true;
      this.state.paused = false;
      this.state.actions = [];
      this.state.script = '';
      this.updateUI();
      
      // Close popup immediately after starting
      window.close();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please refresh the page and try again.');
    }
  }

  async stopRecording() {
    try {
      // First stop the recording
      const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      
      this.state.recording = false;
      this.state.paused = false;
      
      // Get FRESH actions from response
      this.state.actions = response.recording?.actions || [];
      
      // CLEAR old script - user must click Generate Script for fresh generation
      this.state.script = '';
      
      // Hide pause/resume buttons
      this.elements.pauseBtn.classList.add('hidden');
      this.elements.resumeBtn.classList.add('hidden');
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      // Still update UI to show stopped state
      this.state.recording = false;
      this.state.script = ''; // Clear script on error too
      this.updateUI();
    }
  }

  async pauseRecording() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { type: 'PAUSE_RECORDING' });
      }
      await chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
      this.state.paused = true;
      this.updateUI();
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  }

  async resumeRecording() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESUME_RECORDING' });
      }
      await chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
      this.state.paused = false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  }

  async clearRecording() {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_RECORDING' });
      
      this.state.actions = [];
      this.state.script = '';
      this.state.paused = false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to clear recording:', error);
    }
  }

  async downloadTestCase(format) {
    try {
      if (this.state.actions.length === 0) {
        alert('No actions recorded. Please record some actions first.');
        return;
      }

      const testName = document.getElementById('testName')?.value || 'Recorded Test';
      
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_TEST_CASES',
        format: format,
        testName: testName
      });

      if (response?.testCases) {
        const extensions = { istqb: 'txt', gherkin: 'feature', markdown: 'md' };
        const filename = `${testName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extensions[format]}`;
        
        await chrome.runtime.sendMessage({
          type: 'DOWNLOAD_SCRIPT',
          script: response.testCases,
          filename: filename
        });
      } else {
        alert('Failed to generate test case. Please try again.');
      }
    } catch (error) {
      console.error('Failed to download test case:', error);
      alert('Error generating test case: ' + error.message);
    }
  }

  async generateScript() {
    try {
      // Disable button during generation
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.textContent = '⏳ Generating...';
      
      // CLEAR old script first to ensure fresh generation
      this.state.script = '';
      this.updateUI();
      
      // Get FRESH actions from background (don't trust popup state)
      const actionsResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_ACTIONS' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      // Update popup state with fresh actions
      this.state.actions = actionsResponse.actions || [];
      
      if (this.state.actions.length === 0) {
        alert('No actions recorded. Please record some actions first.');
        this.elements.generateBtn.disabled = false;
        this.elements.generateBtn.innerHTML = '<span>⚡</span> Generate Script';
        return;
      }
      
      // Try backend API first (optional - only if available)
      const backendScript = await this.generateScriptViaBackend();
      if (backendScript) {
        this.state.script = backendScript;
        this.updateUI();
        return;
      }
      
      // Fallback to local generation (instant, always works)
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'GENERATE_SCRIPT',
          options: this.options,
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.script) {
        this.state.script = response.script;
        console.log('[Flowstral] Script generated successfully, length:', this.state.script.length);
        console.log('[Flowstral] Generated from', this.state.actions.length, 'actions');
      } else {
        console.error('[Flowstral] No script in response:', response);
        alert('Failed to generate script. Please check console for details.');
      }
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to generate script:', error);
      alert(`Failed to generate script: ${error.message}`);
    } finally {
      // Re-enable button
      this.elements.generateBtn.disabled = false;
      this.elements.generateBtn.innerHTML = '<span>⚡</span> Generate Script';
    }
  }

  async runTest() {
    if (!this.state.script) {
      alert('Please generate a script first');
      return;
    }
    
    try {
      // Show running state
      this.elements.executionResults.classList.remove('hidden');
      this.elements.resultsContent.innerHTML = `
        <div class="result-status running">⏳ Running test...</div>
      `;
      this.elements.runBtn.disabled = true;
      
      const API_BASE_URL = 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/flowstral/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: this.state.script,
          language: this.options.language,
          browser: 'chromium',
          headless: !this.options.showBrowser, // Show browser if toggle is ON
          timeout: 30000,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      const executionResult = result.execution_result || {};
      
      // Display results
      const status = executionResult.status || result.status || 'unknown';
      const statusClass = status === 'passed' || status === 'success' ? 'success' : 
                         status === 'failed' || status === 'error' ? 'failed' : 'running';
      const statusIcon = status === 'passed' || status === 'success' ? '✅' : 
                        status === 'failed' || status === 'error' ? '❌' : '⏳';
      
      let resultsHTML = `
        <div class="result-status ${statusClass}">
          ${statusIcon} Test ${status}
        </div>
      `;
      
      if (executionResult.execution_time_seconds) {
        resultsHTML += `<div style="margin-top: 8px; color: rgba(255,255,255,0.6);">Duration: ${executionResult.execution_time_seconds.toFixed(2)}s</div>`;
      }
      
      // Show exit code if failed
      if ((status === 'failed' || status === 'error') && executionResult.exit_code !== undefined) {
        resultsHTML += `<div style="margin-top: 4px; color: rgba(255,255,255,0.6);">Exit Code: ${executionResult.exit_code}</div>`;
      }
      
      // Show error message if available (highest priority)
      if (executionResult.error) {
        resultsHTML += `
          <div class="result-details" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); margin-top: 12px;">
            <strong style="color: #ff4757;">Error:</strong><br>
            <pre style="margin: 8px 0; white-space: pre-wrap; color: #ff4757; font-size: 11px; max-height: 200px; overflow-y: auto;">${this.escapeHtml(executionResult.error)}</pre>
          </div>
        `;
      }
      
      // Show stderr (errors) - most important for debugging
      if (executionResult.stderr) {
        const stderrText = executionResult.stderr.trim();
        if (stderrText) {
          resultsHTML += `
            <div class="result-details" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); margin-top: 12px;">
              <strong style="color: #ff4757;">Error Details:</strong><br>
              <pre style="margin: 8px 0; white-space: pre-wrap; color: #ff4757; font-size: 11px; max-height: 200px; overflow-y: auto;">${this.escapeHtml(stderrText)}</pre>
            </div>
          `;
        }
      }
      
      // Show stdout (output) - less important but useful
      if (executionResult.stdout) {
        const stdoutText = executionResult.stdout.trim();
        if (stdoutText && stdoutText.length < 1000) { // Only show if not too long
          resultsHTML += `
            <div class="result-details" style="margin-top: 12px;">
              <strong>Output:</strong><br>
              <pre style="margin: 8px 0; white-space: pre-wrap; font-size: 11px; max-height: 150px; overflow-y: auto;">${this.escapeHtml(stdoutText)}</pre>
            </div>
          `;
        }
      }
      
      if (executionResult.screenshots && executionResult.screenshots.length > 0) {
        resultsHTML += `
          <div style="margin-top: 12px; color: rgba(255,255,255,0.7);">
            <strong>Screenshots:</strong> ${executionResult.screenshots.length} captured
          </div>
        `;
      }
      
      // Show test file path for debugging
      if (executionResult.test_file) {
        resultsHTML += `
          <div style="margin-top: 8px; font-size: 10px; color: rgba(255,255,255,0.4); word-break: break-all;">
            Test file: ${executionResult.test_file}
          </div>
        `;
      }
      
      // Show helpful tips if failed
      if (status === 'failed' || status === 'error') {
        resultsHTML += `
          <div style="margin-top: 12px; padding: 8px; background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); border-radius: 6px;">
            <strong style="color: #ffc107;">💡 Troubleshooting:</strong><br>
            <ul style="margin: 4px 0; padding-left: 20px; font-size: 11px; color: rgba(255,255,255,0.7);">
              <li>Check if Node.js and npm are installed</li>
              <li>Verify the generated script has valid syntax</li>
              <li>Check backend logs for detailed error messages</li>
              <li>Ensure Playwright browsers are installed</li>
            </ul>
          </div>
        `;
      }
      
      this.elements.resultsContent.innerHTML = resultsHTML;
      this.elements.runBtn.disabled = false;
      
    } catch (error) {
      console.error('Failed to run test:', error);
      this.elements.resultsContent.innerHTML = `
        <div class="result-status failed">
          ❌ Execution Failed
        </div>
        <div class="result-details" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3);">
          <pre style="margin: 8px 0; white-space: pre-wrap; color: #ff4757;">${this.escapeHtml(error.message)}</pre>
        </div>
      `;
      this.elements.runBtn.disabled = false;
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async runTest() {
    if (!this.state.script) {
      alert('Please generate a script first');
      return;
    }
    
    try {
      // Show running state
      this.elements.executionResults.classList.remove('hidden');
      this.elements.resultsContent.innerHTML = `
        <div class="result-status running">⏳ Running test...</div>
      `;
      this.elements.runBtn.disabled = true;
      
      const API_BASE_URL = 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/flowstral/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: this.state.script,
          language: this.options.language,
          browser: 'chromium',
          headless: !this.options.showBrowser, // Show browser if toggle is ON
          timeout: 30000,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();
      const executionResult = result.execution_result || {};
      
      // Display results
      const status = executionResult.status || 'unknown';
      const statusClass = status === 'passed' ? 'success' : status === 'failed' ? 'failed' : 'running';
      const statusIcon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏳';
      
      let resultsHTML = `
        <div class="result-status ${statusClass}">
          ${statusIcon} Test ${status}
        </div>
      `;
      
      if (executionResult.execution_time_seconds) {
        resultsHTML += `<div style="margin-top: 8px; color: rgba(255,255,255,0.6);">Duration: ${executionResult.execution_time_seconds.toFixed(2)}s</div>`;
      }
      
      if (executionResult.stdout) {
        resultsHTML += `
          <div class="result-details">
            <strong>Output:</strong><br>
            <pre style="margin: 8px 0; white-space: pre-wrap;">${this.escapeHtml(executionResult.stdout)}</pre>
          </div>
        `;
      }
      
      if (executionResult.stderr) {
        resultsHTML += `
          <div class="result-details" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3);">
            <strong>Errors:</strong><br>
            <pre style="margin: 8px 0; white-space: pre-wrap; color: #ff4757;">${this.escapeHtml(executionResult.stderr)}</pre>
          </div>
        `;
      }
      
      if (executionResult.screenshots && executionResult.screenshots.length > 0) {
        resultsHTML += `
          <div style="margin-top: 12px;">
            <strong>Screenshots:</strong> ${executionResult.screenshots.length} captured
          </div>
        `;
      }
      
      this.elements.resultsContent.innerHTML = resultsHTML;
      this.elements.runBtn.disabled = false;
      
    } catch (error) {
      console.error('Failed to run test:', error);
      this.elements.resultsContent.innerHTML = `
        <div class="result-status failed">
          ❌ Execution Failed
        </div>
        <div class="result-details" style="background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3);">
          <pre style="margin: 8px 0; white-space: pre-wrap; color: #ff4757;">${this.escapeHtml(error.message)}</pre>
        </div>
      `;
      this.elements.runBtn.disabled = false;
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async generateScriptViaBackend() {
    // Optional: Try backend API (non-blocking, with timeout)
    const API_BASE_URL = 'http://localhost:8000';
    
    try {
      // Get FRESH actions from background first
      const actionsResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_ACTIONS' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      const freshActions = actionsResponse.actions || [];
      
      if (freshActions.length === 0) {
        return null; // No actions, skip backend
      }
      
      // Get state for metadata
      const stateResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(`${API_BASE_URL}/api/flowstral/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: freshActions, // Use FRESH actions from background
          metadata: { 
            startUrl: stateResponse.startUrl || 'about:blank',
            title: 'Recorded Test',
            timestamp: new Date().toISOString(),
          },
          options: this.options,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        return result.script || null;
      }
    } catch (error) {
      // Silently fail - use local generation
      console.log('[Flowstral] Backend API not available, using local generation:', error.message);
    }
    return null;
  }

  async downloadScript() {
    if (!this.state.script) return;
    
    try {
      const ext = this.options.language === 'python' ? 'py' : 'spec.ts';
      const filename = `recorded-test-${Date.now()}.${ext}`;
      await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_SCRIPT',
        script: this.state.script,
        filename,
      });
    } catch (error) {
      console.error('Failed to download script:', error);
      
      // Fallback: create blob and download
      const ext = this.options.language === 'python' ? 'py' : 'spec.ts';
      const blob = new Blob([this.state.script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recorded-test-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async copyScript() {
    if (!this.state.script) return;
    
    try {
      await navigator.clipboard.writeText(this.state.script);
      
      // Visual feedback
      const btn = this.elements.copyBtn;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  toggleOption(toggle) {
    const option = toggle.dataset.option;
    toggle.classList.toggle('active');
    this.options[option] = toggle.classList.contains('active');
    // Save options
    chrome.storage.local.set({ flowstral_options: this.options });
    
    // Special handling for showBrowser option
    if (option === 'showBrowser') {
      chrome.storage.local.set({ flowstral_show_browser: this.options.showBrowser });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
