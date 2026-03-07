/**
 * Flowstral Recorder - Enhanced Sidebar Controller
 * Full-featured recorder with Results panel, logs, and all features
 */

class SidebarController {
  constructor() {
    this.state = {
      recording: false,
      paused: false,
      running: false,
      actions: [],
      script: '',
      serverConnected: false,
      assertions: [],  // Manual assertions added by user
      // Agentic features (Phases 1-4)
      pageAnalysis: null,
      suggestions: [],
      autoAssertions: [],
      // Network capture (Protocol-level testing)
      captureNetwork: false,  // Default OFF - enable only for load/performance testing
      networkRequestCount: 0,
      hasProtocolData: false,  // True when protocol data has been captured
    };
    
    this.options = {
      language: 'playwright-python',
      browser: 'chromium',
      showBrowser: false,
      serverUrl: 'http://localhost:8000',
      appType: 'auto',
      frontendUrl: 'http://localhost:8080',
      baseUrl: 'http://localhost:3000',  // Test starting URL
      // Advanced features
      selfHealing: true,
      smartWaits: true,
      screenshotOnFailure: true,
      generateAssertions: true,
      // Enterprise features
      pageObjectModel: false,
      dataDriven: false,
      crossBrowser: false,
      visualRegression: false,
    };
    
    this.elements = {};
    this.init();
  }

  async init() {
    // Initialize centralized URL config (reads from chrome.storage.local)
    if (typeof initApiConfig === 'function') await initApiConfig();

    this.cacheElements();
    this.setupTabs();
    this.attachEventListeners();
    await this.loadSettings();
    await this.loadState();
    this.checkServerConnection();
    this.updateUI();
    
    // Initialize workflow and failed elements display
    this.renderWorkflow();
    this.renderFailedElements();
    
    // Track current URL to detect navigation
    this.currentPageUrl = null;
    
    // Initialize current URL from active tab
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        this.currentPageUrl = tabs[0].url;
        console.log('[Sidebar] Initial page URL:', this.currentPageUrl);
      }
    });
    
    // Listen for tab updates (navigation) to auto-refresh analysis
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only care about the active tab and when loading completes
      if (changeInfo.status === 'complete' && tab.active) {
        console.log('[Sidebar] Tab updated:', tab.url, 'previous:', this.currentPageUrl);
        
        // Skip chrome:// and extension pages
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
          this.currentPageUrl = tab.url;
          return;
        }
        
        // Check if URL changed - compare full URL including path
        const urlChanged = !this.currentPageUrl || this.currentPageUrl !== tab.url;
        
        if (urlChanged) {
          console.log('[Sidebar] Page navigated from', this.currentPageUrl, 'to', tab.url);
          this.addLog('info', '🔄 Page navigated - refreshing analysis...');
          
          // Clear old analysis immediately
          this.state.pageAnalysis = null;
          this.state.suggestions = [];
          this.renderPageAnalysis();
          this.renderSuggestions();
          
          // Auto-refresh analysis after navigation (give page time to load)
          setTimeout(() => {
            this.refreshPageAnalysis();
          }, 1500);  // Increased to 1.5s for page load
        }
        
        // Always update current URL
        this.currentPageUrl = tab.url;
      }
    });
    
    // Also listen for tab activation changes
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url !== this.currentPageUrl) {
          console.log('[Sidebar] Tab switched to:', tab.url);
          this.currentPageUrl = tab.url;
          
          // Auto-refresh when switching tabs
          setTimeout(() => {
            this.refreshPageAnalysis();
          }, 300);
        }
      } catch (e) {
        // Tab might not exist
      }
    });
    
    // Listen for real-time action updates from background
    // SIMPLIFIED: Trust background.js for deduplication - don't duplicate that logic here
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ACTION_RECORDED') {
        console.log('[Sidebar] ACTION_RECORDED received:', message.action.type, message.action.description);
        
        // Background already did deduplication - trust it and just add
        // Check by timestamp to avoid adding same action twice (from broadcast)
        const newAction = message.action;
        const alreadyExists = this.state.actions.some(a => a.timestamp === newAction.timestamp && a.type === newAction.type);
        
        if (!alreadyExists) {
          this.state.actions.push(newAction);
          console.log('[Sidebar] Actions count:', this.state.actions.length);
          this.renderActionsList();
          this.updateUI();
        }

        // Update network request count
        this.updateNetworkRequestCount();
      }
      
      // Handle action updates (consolidation of fill actions)
      if (message.type === 'ACTION_UPDATED') {
        console.log('[Sidebar] ACTION_UPDATED received:', message.action?.type);
        // Sync actions from background to ensure consistency
        this.syncActionsFromBackground();
      }
      if (message.type === 'NETWORK_REQUEST_CAPTURED') {
        // Real-time network request count update
        this.state.networkRequestCount = message.count || 0;
        this.updateNetworkRequestDisplay();
      }
      if (message.type === 'RECORDING_STARTED') {
        this.state.recording = true;
        this.state.paused = false;
        this.updateUI();
      }
      if (message.type === 'RECORDING_STOPPED') {
        this.state.recording = false;
        this.state.paused = false;
        this.updateUI();
      }
      
      // ============ AGENTIC FEATURES (Phases 1-4) ============
      if (message.type === 'PAGE_ANALYSIS') {
        console.log('[Sidebar] PAGE_ANALYSIS received:', message.data);
        this.state.pageAnalysis = message.data.analysis;
        this.state.suggestions = message.data.suggestions || [];
        this.state.autoAssertions = message.data.assertions || [];
        this.renderPageAnalysis();
        this.renderSuggestions();
      }
      if (message.type === 'EXECUTION_PROGRESS') {
        console.log('[Sidebar] Execution progress:', message.data.current, '/', message.data.total);
        this.addLog('info', `Executing step ${message.data.current}/${message.data.total}: ${message.data.step?.description || ''}`);
      }
      if (message.type === 'EXECUTION_COMPLETE') {
        const success = message.data.success;
        this.addLog(success ? 'success' : 'error', `Execution ${success ? 'completed' : 'failed'}`);
      }
      if (message.type === 'SELECTOR_ATTEMPT') {
        // Update UI with retry progress
        const { current, total, source, actionText } = message.data;
        this.addLog('info', `Trying ${source} (${current}/${total}) for "${actionText}"`);
      }
    });

    // Check server connection periodically
    setInterval(() => this.checkServerConnection(), 30000);
  }

  cacheElements() {
    this.elements = {
      // Status
      serverStatus: document.getElementById('serverStatus'),
      serverDot: document.getElementById('serverDot'),
      serverText: document.getElementById('serverText'),
      recordingDot: document.getElementById('recordingDot'),
      statusText: document.getElementById('statusText'),
      actionCount: document.getElementById('actionCount'),
      liveCount: document.getElementById('liveCount'),
      
      // Network capture
      networkCaptureToggle: document.getElementById('networkCaptureToggle'),
      networkRequestCount: document.getElementById('networkRequestCount'),
      protocolActions: document.getElementById('protocolActions'),
      exportHarBtn: document.getElementById('exportHarBtn'),
      loadTestBtn: document.getElementById('loadTestBtn'),
      
      // Base URL input
      baseUrlInput: document.getElementById('baseUrlInput'),
      
      // Record tab
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      clearBtn: document.getElementById('clearBtn'),
      saveTestCaseBtn: document.getElementById('saveTestCaseBtn'),
      openWorkflowBtn: document.getElementById('openWorkflowBtn'),
      actionsList: document.getElementById('actionsList'),
      
      // Script tab
      generateBtn: document.getElementById('generateBtn'),
      copyBtn: document.getElementById('copyBtn'),
      downloadBtn: document.getElementById('downloadBtn'),
      scriptSection: document.getElementById('scriptSection'),
      scriptPreview: document.getElementById('scriptPreview'),
      scriptLang: document.getElementById('scriptLang'),
      // POM section
      pomSection: document.getElementById('pomSection'),
      pomToggle: document.getElementById('pomToggle'),
      pomContent: document.getElementById('pomContent'),
      pomClassSelect: document.getElementById('pomClassSelect'),
      pomPreview: document.getElementById('pomPreview'),
      copyPomBtn: document.getElementById('copyPomBtn'),
      downloadPomBtn: document.getElementById('downloadPomBtn'),
      // Test Data section
      testDataSection: document.getElementById('testDataSection'),
      testDataToggle: document.getElementById('testDataToggle'),
      testDataContent: document.getElementById('testDataContent'),
      testDataPreview: document.getElementById('testDataPreview'),
      downloadTestDataBtn: document.getElementById('downloadTestDataBtn'),
      
      // Run tab
      showBrowserToggle: document.getElementById('showBrowserToggle'),
      runBtn: document.getElementById('runBtn'),
      stopTestBtn: document.getElementById('stopTestBtn'),
      resultsPanel: document.getElementById('resultsPanel'),
      resultsTitle: document.getElementById('resultsTitle'),
      resultsStats: document.getElementById('resultsStats'),
      passedCount: document.getElementById('passedCount'),
      failedCount: document.getElementById('failedCount'),
      duration: document.getElementById('duration'),
      logsArea: document.getElementById('logsArea'),
      clearLogsBtn: document.getElementById('clearLogsBtn'),
      
      // Settings tab
      appSelect: document.getElementById('appSelect'),
      languageSelect: document.getElementById('languageSelect'),
      browserSelect: document.getElementById('browserSelect'),
      serverUrl: document.getElementById('serverUrl'),
      checkServerBtn: document.getElementById('checkServerBtn'),
      // Advanced toggles
      selfHealingToggle: document.getElementById('selfHealingToggle'),
      smartWaitsToggle: document.getElementById('smartWaitsToggle'),
      screenshotOnFailureToggle: document.getElementById('screenshotOnFailureToggle'),
      generateAssertionsToggle: document.getElementById('generateAssertionsToggle'),
      // Enterprise toggles
      pageObjectModelToggle: document.getElementById('pageObjectModelToggle'),
      dataDrivenToggle: document.getElementById('dataDrivenToggle'),
      crossBrowserToggle: document.getElementById('crossBrowserToggle'),
      visualRegressionToggle: document.getElementById('visualRegressionToggle'),
      
      // Review tab
      testCaseName: document.getElementById('testCaseName'),
      testCaseDesc: document.getElementById('testCaseDesc'),
      testTypeSelect: document.getElementById('testTypeSelect'),
      testCategorySelect: document.getElementById('testCategorySelect'),
      testPrioritySelect: document.getElementById('testPrioritySelect'),
      testTagsInput: document.getElementById('testTagsInput'),
      outputFormatSelect: document.getElementById('outputFormatSelect'),
      previewFormatBtn: document.getElementById('previewFormatBtn'),
      previewFormatBadge: document.getElementById('previewFormatBadge'),
      scriptEditor: document.getElementById('scriptEditor'),
      copyPreviewBtn: document.getElementById('copyPreviewBtn'),
      downloadPreviewBtn: document.getElementById('downloadPreviewBtn'),
      saveWithAssertionsBtn: document.getElementById('saveWithAssertionsBtn'),
      viewInTraceBtn: document.getElementById('viewInTraceBtn'),
      // Assertions
      assertionType: document.getElementById('assertionType'),
      assertionValue: document.getElementById('assertionValue'),
      assertionValueLabel: document.getElementById('assertionValueLabel'),
      assertionValueGroup: document.getElementById('assertionValueGroup'),
      soqlQueryGroup: document.getElementById('soqlQueryGroup'),
      soqlQuery: document.getElementById('soqlQuery'),
      selectorGroup: document.getElementById('selectorGroup'),
      assertionSelector: document.getElementById('assertionSelector'),
      addAssertionBtn: document.getElementById('addAssertionBtn'),
      assertionsList: document.getElementById('assertionsList'),
      // Smart Assert (AI suggestions)
      smartAssertBtn: document.getElementById('smartAssertBtn'),
      smartAssertSuggestions: document.getElementById('smartAssertSuggestions'),
      smartAssertList: document.getElementById('smartAssertList'),
      // AI Enhancement (in Review tab)
      enhanceAIBtn: document.getElementById('enhanceAIBtn'),
      
      // Suggest tab elements (Agentic Phase 3)
      analysisPageType: document.getElementById('analysisPageType'),
      analysisAppName: document.getElementById('analysisAppName'),
      analysisTiming: document.getElementById('analysisTiming'),
      countButtons: document.getElementById('countButtons'),
      countLinks: document.getElementById('countLinks'),
      countInputs: document.getElementById('countInputs'),
      countHeadings: document.getElementById('countHeadings'),
      refreshAnalysisBtn: document.getElementById('refreshAnalysisBtn'),
      expandMenusBtn: document.getElementById('expandMenusBtn'),
      showCodeToggle: document.getElementById('showCodeToggle'),
      suggestionFilter: document.getElementById('suggestionFilter'),
      suggestionCount: document.getElementById('suggestionCount'),
      suggestionsList: document.getElementById('suggestionsList'),
      assertAllBtn: document.getElementById('assertAllBtn'),
      capturePageBtn: document.getElementById('capturePageBtn'),
      // Workflow section
      workflowSection: document.getElementById('workflowSection'),
      workflowStepCount: document.getElementById('workflowStepCount'),
      workflowStepsList: document.getElementById('workflowStepsList'),
      saveScenarioBtn: document.getElementById('saveScenarioBtn'),
      convertManualBtn: document.getElementById('convertManualBtn'),
      clearWorkflowBtn: document.getElementById('clearWorkflowBtn'),
      // Failed elements section
      failedElementsSection: document.getElementById('failedElementsSection'),
      failedCount: document.getElementById('failedCount'),
      failedElementsList: document.getElementById('failedElementsList'),
      // Open in Desktop button
      openDesktopBtn: document.getElementById('openDesktopBtn'),
    };

    // Initialize show code toggle state
    this.showSelectorCode = false;

    // Manual assist state — which step index has the manual assist card open (null = none)
    this.manualAssistStepIndex = null;
    // False positive flags loaded from backend
    this.falsePositiveFlags = new Map();
    
    // Workflow steps (elements selected for flow)
    this.workflowSteps = [];
    
    // Failed elements that need manual fix
    this.failedElements = [];
  }

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tabId = `tab-${tab.dataset.tab}`;
        document.getElementById(tabId).classList.add('active');
        
        // Auto-generate script when switching to script tab
        if (tab.dataset.tab === 'script' && this.state.actions.length > 0 && !this.state.script) {
          this.generateScript();
        }
      });
    });
  }

  attachEventListeners() {
    spAttachEventListeners(this);
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.local.get([
        'flowstral_app_type',
        'flowstral_language',
        'flowstral_browser',
        'flowstral_show_browser',
        'flowstral_server_url',
        'flowstral_base_url',  // Base URL for test starting point
        // Advanced features
        'flowstral_self_healing',
        'flowstral_smart_waits',
        'flowstral_screenshot_on_failure',
        'flowstral_generate_assertions',
        // Enterprise features
        'flowstral_page_object_model',
        'flowstral_data_driven',
        'flowstral_cross_browser',
        'flowstral_visual_regression',
      ]);
      
      // Load base URL
      if (settings.flowstral_base_url && this.elements.baseUrlInput) {
        this.options.baseUrl = settings.flowstral_base_url;
        this.elements.baseUrlInput.value = settings.flowstral_base_url;
      }
      
      if (settings.flowstral_app_type) {
        this.options.appType = settings.flowstral_app_type;
        this.elements.appSelect.value = settings.flowstral_app_type;
      }
      if (settings.flowstral_language) {
        this.options.language = settings.flowstral_language;
        this.elements.languageSelect.value = settings.flowstral_language;
      }
      if (settings.flowstral_browser) {
        this.options.browser = settings.flowstral_browser;
        this.elements.browserSelect.value = settings.flowstral_browser;
      }
      if (settings.flowstral_show_browser) {
        this.options.showBrowser = settings.flowstral_show_browser;
        this.elements.showBrowserToggle.classList.add('active');
      }
      if (settings.flowstral_server_url) {
        this.options.serverUrl = settings.flowstral_server_url;
        this.elements.serverUrl.value = settings.flowstral_server_url;
      }
      if (settings.flowstral_frontend_url) {
        this.options.frontendUrl = settings.flowstral_frontend_url;
      }

      // Load advanced feature toggles
      const advancedOptions = [
        { key: 'selfHealing', storageKey: 'flowstral_self_healing', el: this.elements.selfHealingToggle },
        { key: 'smartWaits', storageKey: 'flowstral_smart_waits', el: this.elements.smartWaitsToggle },
        { key: 'screenshotOnFailure', storageKey: 'flowstral_screenshot_on_failure', el: this.elements.screenshotOnFailureToggle },
        { key: 'generateAssertions', storageKey: 'flowstral_generate_assertions', el: this.elements.generateAssertionsToggle },
        { key: 'pageObjectModel', storageKey: 'flowstral_page_object_model', el: this.elements.pageObjectModelToggle },
        { key: 'dataDriven', storageKey: 'flowstral_data_driven', el: this.elements.dataDrivenToggle },
        { key: 'crossBrowser', storageKey: 'flowstral_cross_browser', el: this.elements.crossBrowserToggle },
        { key: 'visualRegression', storageKey: 'flowstral_visual_regression', el: this.elements.visualRegressionToggle },
      ];
      
      advancedOptions.forEach(({ key, storageKey, el }) => {
        if (settings[storageKey] !== undefined) {
          this.options[key] = settings[storageKey];
        }
        if (el) {
          el.checked = this.options[key];
        }
      });
      
      this.updateScriptLangDisplay();
    } catch (error) {
      console.error('[Sidebar] Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      // Get base URL from input if available
      if (this.elements.baseUrlInput) {
        this.options.baseUrl = this.elements.baseUrlInput.value;
      }
      
      await chrome.storage.local.set({
        flowstral_app_type: this.options.appType,
        flowstral_language: this.options.language,
        flowstral_browser: this.options.browser,
        flowstral_show_browser: this.options.showBrowser,
        flowstral_server_url: this.options.serverUrl,
        flowstral_frontend_url: this.options.frontendUrl,
        flowstral_base_url: this.options.baseUrl || '',  // Save base URL
        // Advanced features
        flowstral_self_healing: this.options.selfHealing,
        flowstral_smart_waits: this.options.smartWaits,
        flowstral_screenshot_on_failure: this.options.screenshotOnFailure,
        flowstral_generate_assertions: this.options.generateAssertions,
        // Enterprise features
        flowstral_page_object_model: this.options.pageObjectModel,
        flowstral_data_driven: this.options.dataDriven,
        flowstral_cross_browser: this.options.crossBrowser,
        flowstral_visual_regression: this.options.visualRegression,
      });
    } catch (error) {
      console.error('[Sidebar] Failed to save settings:', error);
    }
  }

  async loadState() {
    try {
      // Get recording state from background
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response) {
        this.state.recording = response.recording || false;
        this.state.paused = response.paused || false;
      }

      // Get actions from background - single source of truth
      await this.syncActionsFromBackground();

      // Clear script on load
      this.state.script = '';

      console.log('[Sidebar] Loaded state:', {
        recording: this.state.recording,
        actions: this.state.actions.length
      });
    } catch (error) {
      console.error('[Sidebar] Failed to load state:', error);
      this.state.recording = false;
      this.state.actions = [];
      this.state.script = '';
    }
  }
  
  // Sync actions from background.js (single source of truth)
  async syncActionsFromBackground() {
    try {
      const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
      if (actionsResponse && actionsResponse.actions) {
        this.state.actions = actionsResponse.actions;
        this.renderActionsList();
        this.updateUI();
        console.log('[Sidebar] Synced actions from background:', this.state.actions.length);
      }
    } catch (error) {
      console.error('[Sidebar] Failed to sync actions:', error);
    }
  }

  async checkServerConnection() {
    try {
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        this.state.serverConnected = true;
        this.elements.serverDot.classList.add('connected');
        this.elements.serverText.textContent = 'Connected';
      } else {
        throw new Error('Not healthy');
      }
    } catch (error) {
      this.state.serverConnected = false;
      this.elements.serverDot.classList.remove('connected');
      this.elements.serverText.textContent = 'Offline';
    }
  }

  updateUI() {
    const { recording, actions, script, running } = this.state;
    
    // Update recording status
    if (recording) {
      this.elements.recordingDot.classList.add('active');
      this.elements.statusText.textContent = this.state.paused ? 'Paused' : 'Tracing...';
      this.elements.startBtn.classList.add('hidden');
      this.elements.stopBtn.classList.remove('hidden');
    } else {
      this.elements.recordingDot.classList.remove('active');
      this.elements.statusText.textContent = 'Ready';
      this.elements.startBtn.classList.remove('hidden');
      this.elements.stopBtn.classList.add('hidden');
    }
    
    // Update counts
    this.elements.actionCount.textContent = actions.length;
    this.elements.liveCount.textContent = `${actions.length} actions`;
    
    // Update button states
    this.elements.clearBtn.disabled = actions.length === 0;
    this.elements.saveTestCaseBtn.disabled = actions.length === 0;
    this.elements.openWorkflowBtn.disabled = actions.length === 0;
    this.elements.generateBtn.disabled = actions.length === 0;
    if (this.elements.openDesktopBtn) this.elements.openDesktopBtn.disabled = actions.length === 0;
    
    // AI Enhancement button (in Review tab)
    if (this.elements.enhanceAIBtn) {
      this.elements.enhanceAIBtn.disabled = actions.length === 0;
    }
    
    // Review tab buttons
    if (this.elements.saveWithAssertionsBtn) {
      this.elements.saveWithAssertionsBtn.disabled = actions.length === 0;
    }
    this.elements.copyBtn.disabled = !script;
    this.elements.downloadBtn.disabled = !script;
    this.elements.runBtn.disabled = !script || running;
    
    // Update test case format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.disabled = actions.length === 0;
    });
    
    // Update Review tab buttons
    this.updateReviewButtons();
    
    // Update run button state
    if (running) {
      this.elements.runBtn.classList.add('hidden');
      this.elements.stopTestBtn.classList.remove('hidden');
    } else {
      this.elements.runBtn.classList.remove('hidden');
      this.elements.stopTestBtn.classList.add('hidden');
    }
    
    // Render actions list
    this.renderActionsList();
    
    // Update script preview
    if (script) {
      this.elements.scriptPreview.textContent = script;
    }
    
    // Update network capture display
    this.updateNetworkRequestDisplay();
  }

  /**
   * Update network request count from background
   */
  async updateNetworkRequestCount() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_NETWORK_STATUS' });
      if (response) {
        this.state.networkRequestCount = response.requestCount || 0;
        this.state.captureNetwork = response.enabled;
        this.updateNetworkRequestDisplay();
      }
    } catch (e) {
      // Background might not be ready
    }
  }

  /**
   * Update network request count display
   */
  updateNetworkRequestDisplay() {
    if (this.elements.networkRequestCount) {
      if (!this.state.captureNetwork) {
        // Protocol capture is off
        this.elements.networkRequestCount.textContent = 'off';
        this.elements.networkRequestCount.style.color = 'rgba(255, 255, 255, 0.4)';
      } else if (this.state.recording) {
        // Actively capturing
        const count = this.state.networkRequestCount || 0;
        this.elements.networkRequestCount.textContent = `${count} reqs`;
        this.elements.networkRequestCount.style.color = '#38BDF8';
      } else {
        // Enabled but not recording
        this.elements.networkRequestCount.textContent = 'ready';
        this.elements.networkRequestCount.style.color = '#22c55e';
      }
    }
    
    // Update toggle state
    if (this.elements.networkCaptureToggle) {
      this.elements.networkCaptureToggle.checked = this.state.captureNetwork;
    }

    // Update protocol actions visibility
    this.updateProtocolActionsVisibility();
  }

  updateProtocolActionsVisibility() {
    if (this.elements.protocolActions) {
      // Show if we have captured protocol data (even after stopping)
      const hasProtocolData = this.state.hasProtocolData || (this.state.captureNetwork && (this.state.networkRequestCount || 0) > 0);
      this.elements.protocolActions.style.display = hasProtocolData ? 'flex' : 'none';
    }
  }

  async exportHAR() {
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'EXPORT_HAR' }, resolve);
      });
      
      if (response && response.har) {
        const blob = new Blob([JSON.stringify(response.har, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qaai_recording_${Date.now()}.har`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ HAR file exported!', 'success');
      } else {
        this.showNotification('❌ No protocol data to export', 'error');
      }
    } catch (error) {
      console.error('[Sidebar] HAR export error:', error);
      this.showNotification('❌ Failed to export HAR', 'error');
    }
  }

  openLoadTest() {
    // Open the load testing page with protocol data
    // Use the configured frontend URL (default 8080)
    const frontendUrl = this.options.frontendUrl || 'http://localhost:8080';
    const loadTestUrl = new URL(`${frontendUrl}/load-testing`);
    loadTestUrl.searchParams.set('hasProtocolData', 'true');
    loadTestUrl.searchParams.set('source', 'recorder');
    
    // Open in new tab
    chrome.tabs.create({ url: loadTestUrl.toString() });
    this.showNotification('🚀 Opening Load Test page...', 'info');
  }

  updateScriptLangDisplay() {
    const frameworkNames = {
      'playwright-python': 'Playwright (Python)',
      'playwright-typescript': 'Playwright (TS)',
      'playwright-java': 'Playwright (Java)',
      'playwright-csharp': 'Playwright (C#)',
      'selenium-java': 'Selenium (Java)',
      'selenium-python': 'Selenium (Python)',
      'selenium-csharp': 'Selenium (C#)',
      'selenium-javascript': 'Selenium (JS)',
      'cypress': 'Cypress',
      'cypress-typescript': 'Cypress (TS)',
      'robot-framework': 'Robot Framework',
      'testcafe': 'TestCafe',
      'puppeteer': 'Puppeteer',
      // Legacy fallback
      'python': 'Playwright (Python)',
      'typescript': 'Playwright (TS)',
    };
    this.elements.scriptLang.textContent = frameworkNames[this.options.language] || this.options.language;
  }

  renderActionsList() {
    const container = this.elements.actionsList;

    if (this.state.actions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎬</div>
          <p>Click Start to begin recording</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    this.state.actions.forEach((action, index) => {
      const item = document.createElement('div');
      item.className = 'action-item';

      // Check if this step has been flagged as false positive
      const isFlagged = this.falsePositiveFlags.has(action.id);
      const flagBadge = isFlagged ? '<span style="color:#f59e0b;font-size:10px;margin-left:4px;" title="Flagged as false positive">🚩</span>' : '';

      // Check if this step has a status (from test results)
      const statusBadge = action._status === 'failed'
        ? '<span style="color:#ef4444;font-size:10px;margin-left:4px;">✗</span>'
        : action._status === 'passed'
        ? '<span style="color:#22c55e;font-size:10px;margin-left:4px;">✓</span>'
        : '';

      item.innerHTML = `
        <span class="action-number">${index + 1}</span>
        <div class="action-icon">${this.getActionIcon(action.type)}</div>
        <div class="action-details" style="flex:1;min-width:0;">
          <div class="action-type">${action.type}${statusBadge}${flagBadge}</div>
          <div class="action-selector">${action.description || this.getActionDescription(action)}</div>
          ${action._status === 'failed' || action._fixable ? `
          <div class="action-ai-buttons" style="display:flex;gap:4px;margin-top:4px;">
            <button onclick="sidebar.handleAiFix(${index})" style="font-size:9px;padding:2px 6px;border:1px solid rgba(139,92,246,0.5);border-radius:4px;background:rgba(139,92,246,0.15);color:#a78bfa;cursor:pointer;" title="AI Auto-Fix">🤖 Fix</button>
            <button onclick="sidebar.handleFlag(${index})" style="font-size:9px;padding:2px 6px;border:1px solid rgba(245,158,11,0.5);border-radius:4px;background:rgba(245,158,11,0.15);color:#fbbf24;cursor:pointer;" title="Flag as False Positive">${isFlagged ? '🚩 Unflag' : '🚩 Flag'}</button>
            <button onclick="sidebar.handleManualAssist(${index})" style="font-size:9px;padding:2px 6px;border:1px solid rgba(56,189,248,0.5);border-radius:4px;background:rgba(56,189,248,0.15);color:#38bdf8;cursor:pointer;" title="Manual Fix">🔧 Manual</button>
          </div>
          ` : ''}
        </div>
      `;

      container.appendChild(item);

      // Render inline Manual Assist card if this step is active
      if (this.manualAssistStepIndex === index) {
        const card = this._createManualAssistCard(action, index);
        container.appendChild(card);
      }
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
    };
    return icons[type] || '⚡';
  }

  getActionDescription(action) {
    switch (action.type) {
      case 'click':
        return action.selector?.selector?.substring(0, 50) || 'Click element';
      case 'fill':
      case 'type':
        // SECURITY: Use displayValue (masked) for sensitive fields
        const displayVal = action.isSensitive 
          ? (action.displayValue || '••••••••')
          : (action.displayValue || action.value || '');
        // Truncate for display but keep meaningful length
        const truncated = displayVal.length > 30 ? displayVal.substring(0, 27) + '...' : displayVal;
        // Add lock icon for sensitive fields
        const lockIcon = action.isSensitive ? '🔒 ' : '';
        return `${lockIcon}Type "${truncated}"`;
      case 'navigate':
        return action.url ? new URL(action.url).pathname : 'Navigate';
      case 'select':
        return `Select: "${action.label || action.value}"`;
      default:
        return action.type;
    }
  }

  // ============================================
  // RECORDING METHODS
  // ============================================

  async startRecording() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        this.addLog('error', 'No active tab found');
        return;
      }
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.addLog('error', 'Cannot record on browser internal pages');
        return;
      }
      
      // Update UI immediately
      this.state.recording = true;
      this.state.paused = false;
      this.state.actions = [];
      this.state.script = '';
      this.updateUI();
      
      // Send to background
      chrome.runtime.sendMessage({ 
        type: 'START_RECORDING', 
        tabId: tab.id,
        options: { 
          language: this.options.language,
          appType: this.options.appType
        }
      }).catch(() => {});

      // Send to content script
      chrome.tabs.sendMessage(tab.id, { 
        type: 'START_RECORDING',
        options: { 
          language: this.options.language,
          appType: this.options.appType
        }
      }).catch(() => {});
      
      this.addLog('success', 'Trace started');
    } catch (error) {
      console.error('[Sidebar] Failed to start recording:', error);
      this.addLog('error', 'Failed to start recording');
    }
  }

  async stopRecording() {
    try {
      // IMPORTANT: Keep a backup of actions before stopping
      const actionBackup = [...this.state.actions];
      
      const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      console.log('[Sidebar] Stop recording response:', response);

      this.state.recording = false;
      this.state.paused = false;
      
      // Use response actions, but fallback to backup if response is empty
      const responseActions = response?.recording?.actions || [];
      if (responseActions.length > 0) {
        this.state.actions = responseActions;
        console.log('[Sidebar] Using response actions:', responseActions.length);
      } else if (actionBackup.length > 0) {
        // Response was empty but we had actions - keep the backup
        this.state.actions = actionBackup;
        console.log('[Sidebar] Response empty, keeping backup actions:', actionBackup.length);
      } else {
        // Both empty - try to sync from background
        console.log('[Sidebar] No actions found, trying to sync from background...');
        await this.syncActionsFromBackground();
      }
      
      this.state.script = '';
      
      // Preserve network request count if protocol data was captured
      const capturedNetworkCount = response?.networkSummary?.totalRequests || 0;
      this.state.networkRequestCount = capturedNetworkCount;
      this.state.hasProtocolData = capturedNetworkCount > 0;

      this.updateUI();
      this.updateProtocolActionsVisibility();
      this.addLog('info', `Trace stopped. ${this.state.actions.length} actions captured.`);
      
      // Show network summary if protocol data was captured
      if (response?.networkSummary) {
        const ns = response.networkSummary;
        this.addLog('success', `🌐 Protocol data captured: ${ns.totalRequests} HTTP requests`);
        if (ns.correlations > 0) {
          this.addLog('info', `Auto-detected ${ns.correlations} correlation patterns (tokens, session IDs)`);
        }
        if (ns.statistics?.avgDuration) {
          this.addLog('info', `Avg response time: ${ns.statistics.avgDuration}ms, P95: ${ns.statistics.p95Duration}ms`);
        }
      }
    } catch (error) {
      console.error('[Sidebar] Failed to stop recording:', error);
      this.state.recording = false;
      
      // Try to recover actions from background on error
      console.log('[Sidebar] Attempting to recover actions from background...');
      try {
        await this.syncActionsFromBackground();
        this.addLog('warning', `Recovery: Found ${this.state.actions.length} actions from background`);
      } catch (syncError) {
        console.error('[Sidebar] Recovery failed:', syncError);
      }
      
      this.updateUI();
    }
  }

  async clearRecording() {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_RECORDING' });
      
      this.state.actions = [];
      this.state.script = '';
      this.state.paused = false;
      this.updateUI();
      this.addLog('info', 'Recording cleared');
    } catch (error) {
      console.error('[Sidebar] Failed to clear recording:', error);
    }
  }

  // ============================================
  // SCRIPT GENERATION
  // ============================================

  async generateScript() {
    return spGenerateScript(this);
  }

  async runTest() {
    return spRunTest(this);
  }

  copyScript() {
    if (this.state.script) {
      navigator.clipboard.writeText(this.state.script);
      
      const originalText = this.elements.copyBtn.textContent;
      this.elements.copyBtn.textContent = '✓ Copied';
      setTimeout(() => {
        this.elements.copyBtn.textContent = originalText;
      }, 1500);
      
      this.addLog('success', 'Script copied to clipboard');
    }
  }

  // ============================================
  // POM & TEST DATA METHODS
  // ============================================

  copyPomClass() {
    const selectedClass = this.elements.pomClassSelect?.value;
    if (selectedClass && this.state.pageObjects?.[selectedClass]) {
      navigator.clipboard.writeText(this.state.pageObjects[selectedClass]);
      this.addLog('success', `POM class "${selectedClass}" copied to clipboard`);
    } else {
      this.addLog('error', 'No POM class selected');
    }
  }

  downloadAllPomClasses() {
    if (!this.state.pageObjects || Object.keys(this.state.pageObjects).length === 0) {
      this.addLog('error', 'No POM classes to download');
      return;
    }
    
    // Create a single file with all POM classes
    const allClasses = Object.entries(this.state.pageObjects)
      .map(([name, code]) => `# ${name}\n${code}`)
      .join('\n\n# ' + '='.repeat(60) + '\n\n');
    
    const header = `"""
Page Object Model Classes
Generated by Flowstral Recorder
Date: ${new Date().toISOString()}
"""

`;
    
    const fullContent = header + allClasses;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page_objects_${new Date().toISOString().slice(0, 10)}.py`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.addLog('success', `Downloaded ${Object.keys(this.state.pageObjects).length} POM classes`);
  }

  downloadTestData() {
    if (!this.state.testData || this.state.testData.length === 0) {
      this.addLog('error', 'No test data to download');
      return;
    }
    
    const json = JSON.stringify(this.state.testData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.addLog('success', `Downloaded ${this.state.testData.length} test data parameters`);
  }

  updatePomSection() {
    const pomSection = this.elements.pomSection;
    const pomSelect = this.elements.pomClassSelect;
    const pomPreview = this.elements.pomPreview;
    
    if (!pomSection || !pomSelect) return;
    
    if (this.state.pageObjects && Object.keys(this.state.pageObjects).length > 0) {
      pomSection.style.display = 'block';
      
      // Clear and populate dropdown
      pomSelect.innerHTML = '<option value="">Select a page class...</option>';
      Object.keys(this.state.pageObjects).forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        pomSelect.appendChild(option);
      });
      
      // Auto-select first class
      if (Object.keys(this.state.pageObjects).length > 0) {
        const firstClass = Object.keys(this.state.pageObjects)[0];
        pomSelect.value = firstClass;
        pomPreview.textContent = this.state.pageObjects[firstClass];
      }
    } else {
      pomSection.style.display = 'none';
    }
  }

  updateTestDataSection() {
    const testDataSection = this.elements.testDataSection;
    const testDataPreview = this.elements.testDataPreview;
    
    if (!testDataSection) return;
    
    if (this.state.testData && this.state.testData.length > 0) {
      testDataSection.style.display = 'block';
      testDataPreview.textContent = JSON.stringify(this.state.testData, null, 2);
    } else {
      testDataSection.style.display = 'none';
    }
  }

  // ============================================
  // AI ENHANCEMENT (GPT-4o-mini)
  // ============================================

  async enhanceWithAI() {
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to enhance');
      return;
    }
    
    try {
      this.elements.enhanceAIBtn.disabled = true;
      this.elements.enhanceAIBtn.textContent = '✨ Enhancing...';
      this.addLog('info', 'Enhancing recording with GPT-4o-mini...');
      
      // Get fresh actions
      const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
      const actions = actionsResponse?.actions || this.state.actions;
      
      // Call the AI enhancement endpoint
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/enhance-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: actions,
          metadata: {
            startUrl: actions[0]?.url,
            appType: this.options.appType
          },
          enhancement_level: 'standard'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success' && result.enhanced_test_case) {
        const enhanced = result.enhanced_test_case;
        
        // Store the enhanced data
        this.state.enhancedTestCase = enhanced;
        
        // Update the Review tab with AI-generated content
        if (enhanced.test_name && this.elements.testCaseName) {
          this.elements.testCaseName.value = enhanced.test_name;
        }
        if (enhanced.description && this.elements.testCaseDesc) {
          this.elements.testCaseDesc.value = enhanced.description;
        }
        if (enhanced.tags && this.elements.testTagsInput) {
          this.elements.testTagsInput.value = enhanced.tags.join(', ');
        }
        if (enhanced.priority && this.elements.testPrioritySelect) {
          this.elements.testPrioritySelect.value = enhanced.priority;
        }
        
        // Log success
        const aiLabel = enhanced.ai_enhanced ? '🤖 AI' : '📝 Basic';
        this.addLog('success', `${aiLabel} Enhancement complete!`);
        this.addLog('info', `Generated: "${enhanced.test_name}"`);
        
        if (enhanced.suggested_assertions?.length > 0) {
          this.addLog('info', `Suggested ${enhanced.suggested_assertions.length} assertions`);
        }
        if (enhanced.edge_cases?.length > 0) {
          this.addLog('info', `Found ${enhanced.edge_cases.length} edge cases to consider`);
        }
        
        // Show the enhanced steps in the preview
        if (enhanced.steps?.length > 0) {
          this._displayEnhancedSteps(enhanced);
        }
        
        // Switch to Review tab to show enhanced data
        document.querySelector('[data-tab="review"]').click();
        
      } else {
        throw new Error('Enhancement failed - no data returned');
      }
      
    } catch (error) {
      console.error('[Sidebar] AI Enhancement failed:', error);
      this.addLog('error', `AI Enhancement failed: ${error.message}`);
    } finally {
      this.elements.enhanceAIBtn.disabled = this.state.actions.length === 0;
      this.elements.enhanceAIBtn.textContent = '✨ Enhance with AI';
    }
  }

  _displayEnhancedSteps(enhanced) {
    // Update the script preview with enhanced steps if we're on review tab
    const preview = this.elements.scriptEditor;
    if (preview && enhanced.steps) {
      let stepsText = `# ${enhanced.test_name}\n# ${enhanced.description}\n\n`;
      
      enhanced.steps.forEach((step, i) => {
        stepsText += `## Step ${step.step_number || i + 1}\n`;
        stepsText += `Action: ${step.action}\n`;
        stepsText += `Expected: ${step.expected_result}\n\n`;
      });
      
      if (enhanced.suggested_assertions?.length > 0) {
        stepsText += '\n# Suggested Assertions:\n';
        enhanced.suggested_assertions.forEach(assertion => {
          stepsText += `# - ${assertion}\n`;
        });
      }
      
      if (enhanced.edge_cases?.length > 0) {
        stepsText += '\n# Edge Cases to Consider:\n';
        enhanced.edge_cases.forEach(edge => {
          stepsText += `# - ${edge}\n`;
        });
      }
      
      preview.value = stepsText;
    }
  }

  // ============================================
  // MANUAL ASSERTIONS
  // ============================================

  updateAssertionUI() {
    const type = this.elements.assertionType?.value;
    const valueGroup = this.elements.assertionValueGroup;
    const valueLabel = this.elements.assertionValueLabel;
    const soqlGroup = this.elements.soqlQueryGroup;
    const selectorGroup = this.elements.selectorGroup;
    
    if (!type) return;
    
    // Hide all optional groups first
    soqlGroup?.classList.add('hidden');
    selectorGroup?.classList.add('hidden');
    valueGroup?.classList.remove('hidden');
    
    // Update label and show/hide fields based on type
    switch (type) {
      case 'text_visible':
        valueLabel.textContent = 'Text to find on page';
        break;
      case 'text_exact':
        valueLabel.textContent = 'Exact text to match';
        selectorGroup?.classList.remove('hidden');
        break;
      case 'text_contains':
        valueLabel.textContent = 'Text that should be present';
        selectorGroup?.classList.remove('hidden');
        break;
      case 'element_visible':
        valueLabel.textContent = 'Element selector';
        this.elements.assertionValue.placeholder = 'e.g., .success-message, #result';
        break;
      case 'element_count':
        valueLabel.textContent = 'Expected count';
        this.elements.assertionValue.placeholder = 'e.g., 5';
        selectorGroup?.classList.remove('hidden');
        break;
      case 'url_contains':
        valueLabel.textContent = 'URL should contain';
        break;
      case 'title_is':
        valueLabel.textContent = 'Expected page title';
        break;
      case 'soql_query':
        valueLabel.textContent = 'Expected record count';
        this.elements.assertionValue.placeholder = 'e.g., 1 (at least 1 record)';
        soqlGroup?.classList.remove('hidden');
        break;
    }
  }

  addAssertion() {
    const type = this.elements.assertionType?.value;
    const value = this.elements.assertionValue?.value.trim();
    const selector = this.elements.assertionSelector?.value.trim();
    const soql = this.elements.soqlQuery?.value.trim();
    
    if (!type) {
      this.addLog('error', 'Please select an assertion type');
      return;
    }
    
    if (!value && type !== 'soql_query') {
      this.addLog('error', 'Please enter a value for the assertion');
      return;
    }
    
    if (type === 'soql_query' && !soql) {
      this.addLog('error', 'Please enter a SOQL query');
      return;
    }
    
    // Build assertion object
    const assertion = {
      id: Date.now(),
      type,
      value,
      selector: selector || null,
      soql: soql || null,
      displayText: this.getAssertionDisplayText(type, value, selector, soql)
    };
    
    // Add to state
    this.state.assertions.push(assertion);
    
    // Render the list
    this.renderAssertionsList();
    
    // Clear inputs
    this.elements.assertionValue.value = '';
    if (this.elements.assertionSelector) this.elements.assertionSelector.value = '';
    if (this.elements.soqlQuery) this.elements.soqlQuery.value = '';
    
    this.addLog('success', `Added assertion: ${assertion.displayText}`);
  }

  getAssertionDisplayText(type, value, selector, soql) {
    switch (type) {
      case 'text_visible':
        return `Page contains "${value}"`;
      case 'text_exact':
        return selector ? `"${value}" in ${selector}` : `Exact text: "${value}"`;
      case 'text_contains':
        return selector ? `${selector} contains "${value}"` : `Contains: "${value}"`;
      case 'element_visible':
        return `${value} is visible`;
      case 'element_count':
        return `${selector || 'elements'} count = ${value}`;
      case 'url_contains':
        return `URL contains "${value}"`;
      case 'title_is':
        return `Title = "${value}"`;
      case 'soql_query':
        return `SOQL returns ${value} record(s)`;
      default:
        return `${type}: ${value}`;
    }
  }

  renderAssertionsList() {
    const list = this.elements.assertionsList;
    if (!list) return;
    
    if (this.state.assertions.length === 0) {
      list.innerHTML = '<div style="font-size: 10px; color: rgba(255,255,255,0.4); padding: 8px; text-align: center;">No assertions added yet</div>';
      return;
    }
    
    list.innerHTML = this.state.assertions.map(a => `
      <div class="assertion-item" data-id="${a.id}">
        <span class="assertion-text" title="${a.displayText}">${a.displayText}</span>
        <button class="remove-btn" onclick="sidebar.removeAssertion(${a.id})">✕</button>
      </div>
    `).join('');
  }

  removeAssertion(id) {
    this.state.assertions = this.state.assertions.filter(a => a.id !== id);
    this.renderAssertionsList();
    this.addLog('info', 'Assertion removed');
  }

  /**
   * Smart Assert - AI-powered assertion suggestions based on element analysis
   * Analyzes the current page/selected element and suggests relevant assertions
   */
  showSmartAssertSuggestions() {
    const suggestionsPanel = this.elements.smartAssertSuggestions;
    const suggestionsList = this.elements.smartAssertList;
    
    if (!suggestionsPanel || !suggestionsList) return;
    
    // Get the last recorded action or page state
    const lastAction = this.state.actions && this.state.actions.length > 0 
      ? this.state.actions[this.state.actions.length - 1] 
      : null;
    
    // Build suggestions based on context
    const suggestions = this._generateSmartAssertions(lastAction);
    
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'text_visible',
        value: '',
        display: 'Page contains text...',
        hint: 'Enter expected text to verify'
      });
    }
    
    // Render suggestions
    suggestionsList.innerHTML = suggestions.map((s, idx) => `
      <div class="suggestion-chip" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; cursor: pointer; transition: all 0.2s;" 
           onclick="sidebar.applySmartAssertion(${idx})" 
           data-type="${s.type}" 
           data-value="${this._escapeHtml(s.value || '')}"
           data-selector="${this._escapeHtml(s.selector || '')}">
        <span style="font-size: 14px;">${this._getAssertionIcon(s.type)}</span>
        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: 500; color: #fff;">${s.display}</div>
          ${s.hint ? `<div style="font-size: 9px; color: rgba(255,255,255,0.5);">${s.hint}</div>` : ''}
        </div>
        <span style="font-size: 11px; color: #8B5CF6;">+</span>
      </div>
    `).join('');
    
    // Store suggestions for later use
    this._smartAssertSuggestions = suggestions;
    
    // Show the panel
    suggestionsPanel.style.display = 'block';
    this.addLog('info', `Smart Assert: ${suggestions.length} suggestions generated`);
  }
  
  _generateSmartAssertions(lastAction) {
    const suggestions = [];
    
    // Context-aware suggestions based on last action
    if (lastAction) {
      const actionType = lastAction.type || lastAction.action;
      const selector = lastAction.selector || lastAction.target?.selector;
      const text = lastAction.text || lastAction.value || lastAction.target?.text;
      
      // Text/Input assertions
      if (actionType === 'input' || actionType === 'fill' || actionType === 'type') {
        suggestions.push({
          type: 'text_visible',
          value: text?.substring(0, 50) || '',
          display: `Input contains "${text?.substring(0, 30) || '...'}"`,
          hint: 'Verify the entered text appears',
          selector
        });
      }
      
      // Click assertions - check for navigation/state change
      if (actionType === 'click') {
        suggestions.push({
          type: 'element_visible',
          value: selector || '',
          display: 'Element is visible after click',
          hint: 'Verify element state after action',
          selector
        });
        
        // If clicking a link/button, might navigate
        suggestions.push({
          type: 'url_contains',
          value: '',
          display: 'URL changes after click',
          hint: 'Enter expected URL fragment'
        });
      }
      
      // Form submission
      if (actionType === 'submit' || (text && text.toLowerCase().includes('submit'))) {
        suggestions.push({
          type: 'text_visible',
          value: 'success',
          display: 'Success message appears',
          hint: 'Verify form submission result'
        });
        suggestions.push({
          type: 'text_visible',
          value: 'error',
          display: 'No error message',
          hint: 'Verify no errors appear'
        });
      }
    }
    
    // Generic suggestions that always apply
    suggestions.push({
      type: 'text_visible',
      value: '',
      display: 'Text is visible on page',
      hint: 'Verify specific text appears'
    });
    
    suggestions.push({
      type: 'element_visible',
      value: '',
      display: 'Element is visible',
      hint: 'Enter selector to verify visibility'
    });
    
    suggestions.push({
      type: 'title_is',
      value: '',
      display: 'Page title matches',
      hint: 'Verify page title'
    });
    
    // Date-specific suggestions (for date fields detected)
    if (lastAction?.target?.type === 'date' || lastAction?.selector?.includes('date')) {
      suggestions.unshift({
        type: 'text_visible',
        value: new Date().toLocaleDateString(),
        display: 'Date field shows today',
        hint: 'Verify current date is displayed'
      });
    }
    
    // Currency/amount suggestions
    if (lastAction?.selector?.includes('amount') || lastAction?.selector?.includes('price') || lastAction?.selector?.includes('total')) {
      suggestions.unshift({
        type: 'text_contains',
        value: '$',
        display: 'Amount format is correct',
        hint: 'Verify currency formatting',
        selector: lastAction.selector
      });
    }
    
    return suggestions;
  }
  
  applySmartAssertion(index) {
    const suggestion = this._smartAssertSuggestions?.[index];
    if (!suggestion) return;
    
    // Pre-fill the assertion form
    if (this.elements.assertionType) {
      this.elements.assertionType.value = suggestion.type;
      this.updateAssertionUI();
    }
    
    if (this.elements.assertionValue && suggestion.value) {
      this.elements.assertionValue.value = suggestion.value;
    }
    
    if (this.elements.assertionSelector && suggestion.selector) {
      this.elements.assertionSelector.value = suggestion.selector;
    }
    
    // Hide the suggestions panel
    if (this.elements.smartAssertSuggestions) {
      this.elements.smartAssertSuggestions.style.display = 'none';
    }
    
    this.addLog('info', `Applied: ${suggestion.display}`);
  }
  
  _getAssertionIcon(type) {
    const icons = {
      'text_visible': '📝',
      'text_exact': '🎯',
      'text_contains': '📄',
      'element_visible': '👁️',
      'element_count': '🔢',
      'url_contains': '🔗',
      'title_is': '📰',
      'soql_query': '⚡'
    };
    return icons[type] || '✅';
  }
  
  _escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async saveTestCase() {
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to save');
      return;
    }
    
    try {
      const exportData = this._prepareActionsForExport();
      
      // Prompt for test case name
      const defaultName = `Test_${new Date().toISOString().slice(0, 10)}_${this.state.actions.length}steps`;
      const testName = prompt('Enter test case name:', defaultName);
      
      if (!testName) {
        this.addLog('info', 'Save cancelled');
        return;
      }
      
      // Save to backend
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: exportData.actions,
          metadata: exportData.metadata,
          name: testName,
          tags: [this.options.appType],
          status: 'pending'  // Pending review
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      const testCase = result.test_case;
      
      this.addLog('success', `✅ Test case saved! ID: ${testCase.id}`);
      this.addLog('info', `View in Test Cases section to approve and run`);
      
      const originalText = this.elements.saveTestCaseBtn.textContent;
      this.elements.saveTestCaseBtn.textContent = '✓ Saved';
      setTimeout(() => {
        this.elements.saveTestCaseBtn.textContent = originalText;
      }, 2000);
      
    } catch (error) {
      console.error('[Sidebar] Failed to save test case:', error);
      this.addLog('error', `Failed to save: ${error.message}`);
    }
  }

  // ============================================
  // REVIEW TAB METHODS
  // ============================================

  updateReviewButtons() {
    const hasActions = this.state.actions && this.state.actions.length > 0;
    const hasPreview = this.elements.scriptEditor && this.elements.scriptEditor.value.trim().length > 0;
    
    if (this.elements.previewFormatBtn) this.elements.previewFormatBtn.disabled = !hasActions;
    if (this.elements.copyPreviewBtn) this.elements.copyPreviewBtn.disabled = !hasPreview;
    if (this.elements.downloadPreviewBtn) this.elements.downloadPreviewBtn.disabled = !hasPreview;
    if (this.elements.saveWithAssertionsBtn) this.elements.saveWithAssertionsBtn.disabled = !hasActions;
  }

  async generatePreview() {
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to preview');
      return;
    }
    
    const format = this.elements.outputFormatSelect.value;
    const exportData = this._prepareActionsForExport();
    
    try {
      this.elements.previewFormatBtn.textContent = '⏳ Generating...';
      this.elements.previewFormatBtn.disabled = true;
      
      let preview = '';
      
      if (format === 'python' || format === 'typescript') {
        // Generate automated script
        const response = await fetch(`${this.options.serverUrl}/api/flowstral/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actions: exportData.actions,
            metadata: {
              ...exportData.metadata,
              title: this.elements.testCaseName.value || 'Traced Test'
            },
            options: { language: format }
          })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        preview = result.script;
        
      } else {
        // Generate manual test case (istqb, gherkin, markdown)
        const response = await fetch(`${this.options.serverUrl}/api/flowstral/generate-test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actions: exportData.actions,
            format: format,
            testName: this.elements.testCaseName.value || 'Traced Test',
            appType: this.options.appType
          })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        preview = result.testCases;
      }
      
      this.elements.scriptEditor.value = preview;
      this.updateReviewButtons();
      this.addLog('success', `Generated ${format.toUpperCase()} preview`);
      
    } catch (error) {
      console.error('[Sidebar] Failed to generate preview:', error);
      this.addLog('error', `Failed to generate preview: ${error.message}`);
    } finally {
      this.elements.previewFormatBtn.textContent = '👁️ Preview in Selected Format';
      this.elements.previewFormatBtn.disabled = false;
    }
  }

  copyPreview() {
    const preview = this.elements.scriptEditor.value;
    if (preview) {
      navigator.clipboard.writeText(preview);
      
      const originalText = this.elements.copyPreviewBtn.textContent;
      this.elements.copyPreviewBtn.textContent = '✓ Copied';
      setTimeout(() => {
        this.elements.copyPreviewBtn.textContent = originalText;
      }, 1500);
      
      this.addLog('success', 'Preview copied to clipboard');
    }
  }

  downloadPreview() {
    const preview = this.elements.scriptEditor.value;
    const format = this.elements.outputFormatSelect.value;
    const testName = this.elements.testCaseName.value || 'test_case';
    
    if (!preview) return;
    
    const extensions = {
      'python': 'py',
      'typescript': 'ts',
      'istqb': 'txt',
      'gherkin': 'feature',
      'markdown': 'md'
    };
    
    const filename = `${testName.replace(/\s+/g, '_')}.${extensions[format] || 'txt'}`;
    const blob = new Blob([preview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    this.addLog('success', `Downloading ${filename}`);
  }

  async saveTestCaseWithStatus(status) {
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to save');
      return;
    }
    
    const testName = this.elements.testCaseName.value.trim();
    if (!testName) {
      this.addLog('error', 'Please enter a test case name');
      this.elements.testCaseName.focus();
      return;
    }
    
    try {
      const exportData = this._prepareActionsForExport();
      const format = this.elements.outputFormatSelect.value;
      const isAutomated = ['python', 'typescript'].includes(format);
      
      // Get tags from input
      const tagsInput = this.elements.testTagsInput.value.trim();
      const customTags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
      
      // Build tags array
      const tags = [
        this.elements.testCategorySelect.value,  // smoke, regression, etc.
        isAutomated ? 'automated' : 'manual',
        this.options.appType,
        ...customTags
      ];
      
      // Save to backend
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: exportData.actions,
          metadata: {
            ...exportData.metadata,
            description: this.elements.testCaseDesc.value,
            testType: isAutomated ? 'automated' : 'manual',
            category: this.elements.testCategorySelect.value,
            priority: this.elements.testPrioritySelect.value,
            outputFormat: format,
            script: this.elements.scriptEditor.value || null,
          },
          name: testName,
          tags: tags,
          status: status
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      const testCase = result.test_case;
      
      const statusEmoji = status === 'approved' ? '✅' : '📝';
      const statusText = status === 'approved' ? 'Approved & Ready' : 'Saved as Draft';
      
      this.addLog('success', `${statusEmoji} Test case ${statusText}! ID: ${testCase.id}`);
      this.addLog('info', `Name: ${testName}`);
      this.addLog('info', `Type: ${isAutomated ? 'Automated' : 'Manual'} | Category: ${this.elements.testCategorySelect.value}`);
      
      // Update button
      const btn = this.elements.saveWithAssertionsBtn;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Saved!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
      
    } catch (error) {
      console.error('[Sidebar] Failed to save test case:', error);
      this.addLog('error', `Failed to save: ${error.message}`);
    }
  }

  // Save recording with any assertions added
  async saveRecordingWithAssertions() {
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to save');
      return;
    }
    
    try {
      const exportData = this._prepareActionsForExport();
      
      // Include assertions from the assertion list
      const assertions = this.state.assertions || [];
      
      // Update the recording on the backend
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/save-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.state.sessionId || `session_${Date.now()}`,
          actions: exportData.actions,
          assertions: assertions,
          metadata: {
            ...exportData.metadata,
            testCaseName: this.elements.testCaseName?.value?.trim() || '',
            description: this.elements.testCaseDesc?.value || '',
            category: this.elements.testCategorySelect?.value || 'functional',
            priority: this.elements.testPrioritySelect?.value || 'medium',
            updatedAt: new Date().toISOString(),
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      this.addLog('success', `Recording updated with ${assertions.length} assertions`);
      
      // Update button feedback
      const btn = this.elements.saveWithAssertionsBtn;
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Saved!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }
      
    } catch (error) {
      console.error('[Sidebar] Failed to update recording:', error);
      this.addLog('error', `Failed to update: ${error.message}`);
    }
  }

  // Open the Trace page in a new tab
  openTracePage() {
    // Get the frontend URL (backend is 8000, frontend is usually 8080 or 3000)
    const baseUrl = this.options.serverUrl.replace(':8000', ':8080').replace('/api', '');
    const traceUrl = `${baseUrl.replace(/\/$/, '')}/flowstral`;
    
    // Open Trace page in a new tab
    chrome.tabs.create({ url: traceUrl });
    this.addLog('info', 'Opened Trace page - use it to approve and create test cases');
  }
  
  _prepareActionsForExport() {
    return {
      actions: this.state.actions.map(action => ({
        type: action.type,
        description: action.description,
        selector: action.selector,
        value: action.value,
        url: action.url,
        timestamp: action.timestamp,
        tagName: action.tagName,
        inputType: action.inputType,
        innerText: action.innerText,
        name: action.name,
        ariaLabel: action['aria-label'] || action.ariaLabel,
        placeholder: action.placeholder,
        title: action.title,
        className: action.className,
        triggersNavigation: action.triggersNavigation,
      })),
      metadata: {
        startUrl: this.state.startUrl || window.location.href,
        recordedAt: new Date().toISOString(),
        actionCount: this.state.actions.length,
        appType: this.options.appType,
      }
    };
  }
  
  async openInWorkflowEditorFromRecord() {
    return spOpenInWorkflowEditorFromRecord(this);
  }

  downloadScript() {
    if (!this.state.script) return;
    
    const ext = this.options.language === 'python' ? 'py' : 'ts';
    const filename = `flowstral_test_${Date.now()}.${ext}`;
    
    // Create blob and download
    const blob = new Blob([this.state.script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
    this.addLog('success', `Downloaded: ${filename}`);
  }

  addLog(type, message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="time">[${time}]</span>
      <span class="message">${this.escapeHtml(message)}</span>
    `;
    this.elements.logsArea.appendChild(entry);
    this.elements.logsArea.scrollTop = this.elements.logsArea.scrollHeight;
  }

  clearLogs() {
    this.elements.logsArea.innerHTML = `
      <div class="log-entry info">
        <span class="time">[--:--:--]</span>
        <span class="message">Logs cleared. Ready for next test...</span>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // TEST CASE GENERATION (ISTQB, Gherkin, Markdown)
  // ============================================

  async downloadTestCase(format) {
    if (this.state.actions.length === 0) {
      this.addLog('error', 'No actions recorded');
      return;
    }
    
    try {
      this.addLog('info', `Generating ${format.toUpperCase()} test case...`);
      
      if (format === 'all') {
        // Download all formats
        for (const fmt of ['istqb', 'gherkin', 'markdown']) {
          await this.downloadSingleFormat(fmt);
        }
        this.addLog('success', 'All test case formats downloaded!');
      } else {
        await this.downloadSingleFormat(format);
        this.addLog('success', `${format.toUpperCase()} test case downloaded!`);
      }
    } catch (error) {
      console.error('[Sidebar] Error generating test case:', error);
      this.addLog('error', `Error generating test case: ${error.message}`);
    }
  }

  async downloadSingleFormat(format) {
    // Get actions from background
    const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
    const actions = actionsResponse?.actions || this.state.actions;
    
    // Call backend to generate test case
    const serverUrl = this.options.serverUrl || 'http://localhost:8000';
    const response = await fetch(`${serverUrl}/api/flowstral/generate-test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actions: actions,
        format: format,
        testName: `Flowstral Test ${new Date().toISOString().slice(0, 10)}`,
        appType: this.options.appType || 'generic'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.testCases) {
      // Determine file extension
      const extensions = { 
        istqb: 'txt', 
        gherkin: 'feature', 
        markdown: 'md' 
      };
      const ext = extensions[format] || 'txt';
      const filename = `flowstral_test_${format}_${Date.now()}.${ext}`;
      
      // Download the file
      const blob = new Blob([result.testCases], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  }

  // ============================================================================
  // AGENTIC FEATURES (Phases 3-4)
  // ============================================================================

  /**
   * Scan dropdown menus by hovering/clicking to reveal hidden items
   */
  async scanDropdownMenus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      
      this.elements.expandMenusBtn.textContent = '⏳ Scanning...';
      this.elements.expandMenusBtn.disabled = true;
      this.addLog('info', 'Scanning dropdown menus...');
      
      // Send message to content script to scan menus
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_MENUS' }, { frameId: 0 });
      
      if (response?.success) {
        // Merge new menu items with existing suggestions
        const menuItems = response.menuItems || [];
        this.addLog('success', `Found ${menuItems.length} menu items`);
        
        // Add menu items to existing suggestions
        const newSuggestions = menuItems.map(item => ({
          type: 'click',
          element: 'link',
          text: item.text,
          selector: item.selector,
          selectorObj: item.selectorObj,
          description: `Click "${item.text}" [menu]`,
          location: 'nav',
          parentMenu: item.parentMenu,
          href: item.href,
        }));
        
        // Append to existing suggestions, avoiding duplicates
        const existingTexts = new Set(this.state.suggestions.map(s => s.text?.toLowerCase()));
        const uniqueNew = newSuggestions.filter(s => !existingTexts.has(s.text?.toLowerCase()));
        
        this.state.suggestions = [...this.state.suggestions, ...uniqueNew];
        this.renderSuggestions();
        
        this.addLog('success', `Added ${uniqueNew.length} new menu items`);
      } else {
        this.addLog('error', 'Menu scan failed');
      }
    } catch (error) {
      console.error('[Sidebar] Menu scan error:', error);
      this.addLog('error', 'Menu scan error: ' + error.message);
    } finally {
      this.elements.expandMenusBtn.textContent = '📂 Scan Menus';
      this.elements.expandMenusBtn.disabled = false;
    }
  }

  /**
   * Refresh page analysis manually
   */
  async refreshPageAnalysis() {
    console.log('[Sidebar] refreshPageAnalysis called');
    this.addLog('info', 'Starting page analysis...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Sidebar] Active tab:', tab?.id, tab?.url);
      
      if (!tab) {
        this.addLog('error', 'No active tab found');
        return;
      }
      
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        this.addLog('error', 'Cannot analyze browser internal pages');
        return;
      }
      
      this.elements.refreshAnalysisBtn.textContent = '⏳ Analyzing...';
      this.elements.refreshAnalysisBtn.disabled = true;
      
      console.log('[Sidebar] Sending ANALYZE_PAGE to tab', tab.id);
      
      // Request analysis from content script - target MAIN FRAME only (frameId: 0)
      let response;
      try {
        console.log('[Sidebar] Sending ANALYZE_PAGE to tab', tab.id, 'URL:', tab.url);
        response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_PAGE' }, { frameId: 0 });
        console.log('[Sidebar] Analysis response:', response);
      } catch (sendError) {
        // Content script not loaded - inject it first
        console.log('[Sidebar] Content script not loaded, injecting...', sendError.message);
        this.addLog('info', 'Content script not loaded - injecting...');
        
        try {
          // First inject the content script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [0] },  // Main frame only
            files: ['src/content/content.js']
          });
          
          console.log('[Sidebar] Content script injected, waiting for initialization...');
          
          // Wait for script to initialize
          await new Promise(r => setTimeout(r, 1000));
          
          // Retry the message
          console.log('[Sidebar] Retrying ANALYZE_PAGE...');
          response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_PAGE' }, { frameId: 0 });
          console.log('[Sidebar] Analysis response after injection:', response);
        } catch (injectError) {
          console.error('[Sidebar] Injection/retry failed:', injectError);
          
          // More helpful error message
          if (injectError.message?.includes('Cannot access')) {
            this.addLog('error', 'Cannot analyze this page (restricted access)');
          } else if (injectError.message?.includes('No frame')) {
            this.addLog('error', 'Page not fully loaded - try again in a moment');
          } else {
            this.addLog('error', 'Could not analyze page: ' + injectError.message);
          }
          return;
        }
      }
      
      if (response?.success && response.analysis) {
        this.state.pageAnalysis = response.analysis;
        // Generate suggestions locally if not provided
        this.state.suggestions = this.generateLocalSuggestions(response.analysis);
        this.renderPageAnalysis();
        this.renderSuggestions();
        this.addLog('success', `Page analyzed in ${response.analysis.timing}`);
      } else {
        this.addLog('error', 'Analysis failed - make sure you\'re on a valid page');
      }
    } catch (error) {
      console.error('[Sidebar] Analysis error:', error);
      this.addLog('error', 'Could not analyze page: ' + error.message);
    } finally {
      this.elements.refreshAnalysisBtn.textContent = '🔄 Refresh Analysis';
      this.elements.refreshAnalysisBtn.disabled = false;
    }
  }

  /**
   * Generate suggestions from analysis data
   * Preserves FULL selector data for robust script generation (same as recording)
   * INCREASED LIMITS for comprehensive page coverage
   */
  generateLocalSuggestions(analysis) {
    const suggestions = [];
    const seenDescriptions = new Map();  // Track duplicates to add context
    const duplicateCounts = new Map();   // Count total duplicates by text
    
    // First pass: count duplicates by text/label
    const allElements = [
      ...(analysis.buttons || []).map(b => ({ ...b, _type: 'button' })),
      ...(analysis.links || []).map(l => ({ ...l, _type: 'link' })),
    ];
    
    allElements.forEach(el => {
      const key = (el.text || el.label || '').toLowerCase().trim();
      if (key) {
        duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
      }
    });
    
    // Helper to make unique descriptions for duplicates
    const makeUniqueDescription = (baseDesc, element, elementText) => {
      const count = seenDescriptions.get(baseDesc) || 0;
      seenDescriptions.set(baseDesc, count + 1);
      
      // Check total duplicate count for this text
      const key = (elementText || '').toLowerCase().trim();
      const totalDuplicates = duplicateCounts.get(key) || 1;
      
      if (count > 0 || element.duplicateIndex > 0 || totalDuplicates > 1) {
        // Add context for duplicates - use location, id, or index
        let context = '';
        
        // Prefer location (header, footer, nav, etc.)
        if (element.location && element.location !== 'body') {
          context = `[${element.location}]`;
        } else if (element.id) {
          context = `#${element.id}`;
        } else if (element.parentId) {
          context = `in #${element.parentId}`;
        } else if (element.parentClass) {
          context = `in .${element.parentClass}`;
        } else {
          context = `(${(element.duplicateIndex || count) + 1} of ${totalDuplicates})`;
        }
        
        return { 
          description: `${baseDesc} ${context}`,
          elementIndex: element.duplicateIndex || count,
          totalDuplicates 
        };
      }
      return { description: baseDesc, elementIndex: null, totalDuplicates: 1 };
    };
    
    // Add ALL button/clickable suggestions (increased from 5 to 50)
    (analysis.buttons || []).slice(0, 50).forEach(btn => {
      if (!btn.disabled) {
        // Use element type from analysis (button, card, option, tab, menuitem)
        const elementType = btn.elementType || 'button';
        const elementLabel = {
          'button': 'button',
          'card': 'card',
          'option': 'option',
          'tab': 'tab',
          'menuitem': 'menu item'
        }[elementType] || elementType;
        
        const baseDesc = `Click "${btn.text}" ${elementLabel}`;
        const { description, elementIndex, totalDuplicates } = makeUniqueDescription(baseDesc, btn, btn.text);
        
        suggestions.push({
          type: 'click',
          element: elementType,
          text: btn.text,
          selector: btn.selector,
          selectorObj: btn.selectorObj,
          description,
          tagName: btn.tagName,
          id: btn.id,
          className: btn.className,
          name: btn.name,
          role: btn.role,
          ariaLabel: btn.ariaLabel,
          // Duplicate tracking
          elementIndex: elementIndex,
          totalDuplicates: totalDuplicates,
          hasDuplicates: totalDuplicates > 1,
        });
      }
    });
    
    // Add ALL link suggestions (increased from 3 to 50)
    (analysis.links || []).slice(0, 50).forEach(link => {
      // Add location to description for better context
      let baseDesc = `Click "${link.text}" link`;
      if (link.location && link.location !== 'body' && link.location !== 'main') {
        baseDesc = `Click "${link.text}" link [${link.location}]`;
      }
      
      const { description, elementIndex, totalDuplicates } = makeUniqueDescription(baseDesc, link, link.text);
      
      suggestions.push({
        type: 'click',
        element: 'link',
        text: link.text,
        selector: link.selector,
        selectorObj: link.selectorObj,
        description,
        tagName: link.tagName,
        id: link.id,
        className: link.className,
        ariaLabel: link.ariaLabel,
        href: link.href,
        location: link.location,
        // Duplicate tracking
        elementIndex: elementIndex,
        totalDuplicates: totalDuplicates,
        hasDuplicates: totalDuplicates > 1,
      });
    });
    
    // Add heading suggestions for assertions
    (analysis.headings || []).slice(0, 10).forEach(heading => {
      suggestions.push({
        type: 'assert',
        element: 'heading',
        text: heading.text,
        selector: heading.selector,
        description: `Assert heading "${heading.text}" visible`,
        level: heading.level,
      });
    });
    
    // Add ALL input suggestions (increased from 5 to 20)
    (analysis.inputs || []).slice(0, 20).forEach(input => {
      // CRITICAL: Force CLICK for radio/checkbox - never FILL
      const isRadioOrCheckbox = input.type === 'radio' || input.type === 'checkbox' ||
                                 input.role === 'radio' || input.role === 'checkbox';
      const isSelect = input.type === 'select' || input.tagName === 'select';
      
      // Determine action type - radio/checkbox MUST be click
      const actionType = isRadioOrCheckbox ? 'click' : 
                         isSelect ? 'select' : 
                         (input.actionType || 'fill');
      
      // Create appropriate description and element type
      let description;
      let elementType = 'input';
      
      if (isRadioOrCheckbox) {
        const baseDesc = `Select "${input.label}" option`;
        description = makeUniqueDescription(baseDesc, input);
        elementType = input.type === 'radio' || input.role === 'radio' ? 'radio' : 'checkbox';
      } else if (isSelect) {
        description = `Choose from "${input.label}" dropdown`;
        elementType = 'dropdown';
      } else {
        description = `Fill "${input.label}" field`;
      }
      
      suggestions.push({
        type: actionType,
        element: elementType,
        label: input.label,
        selector: input.selector,
        selectorObj: input.selectorObj,
        inputType: input.type,
        description,
        tagName: input.tagName,
        id: input.id,
        className: input.className,
        name: input.name,
        role: input.role,
        ariaLabel: input.ariaLabel,
        placeholder: input.placeholder,
      });
    });
    
    console.log(`[Sidebar] Generated ${suggestions.length} suggestions: ${analysis.buttons?.length || 0} buttons, ${analysis.links?.length || 0} links, ${analysis.inputs?.length || 0} inputs, ${analysis.headings?.length || 0} headings`);
    
    return suggestions;
  }

  /**
   * Render page analysis summary
   */
  renderPageAnalysis() {
    const analysis = this.state.pageAnalysis;
    if (!analysis) return;
    
    // Update page type with badge
    if (this.elements.analysisPageType) {
      const pageTypeClass = analysis.pageType || 'generic';
      this.elements.analysisPageType.innerHTML = `<span class="analysis-badge ${pageTypeClass}">${analysis.pageType || 'Unknown'}</span>`;
    }
    
    // Update app name
    if (this.elements.analysisAppName) {
      this.elements.analysisAppName.textContent = analysis.appName || 'Generic';
    }
    
    // Update timing
    if (this.elements.analysisTiming) {
      this.elements.analysisTiming.textContent = analysis.timing || '-';
    }
    
    // Update counts
    if (this.elements.countButtons) {
      this.elements.countButtons.textContent = analysis.counts?.buttons || 0;
    }
    if (this.elements.countLinks) {
      this.elements.countLinks.textContent = analysis.counts?.links || 0;
    }
    if (this.elements.countInputs) {
      this.elements.countInputs.textContent = analysis.counts?.inputs || 0;
    }
    if (this.elements.countHeadings) {
      this.elements.countHeadings.textContent = analysis.counts?.headings || 0;
    }
    
    // Enable action buttons
    if (this.elements.assertAllBtn) {
      this.elements.assertAllBtn.disabled = false;
    }
    if (this.elements.capturePageBtn) {
      this.elements.capturePageBtn.disabled = false;
    }
  }

  /**
   * Render suggestions list
   */
  renderSuggestions() {
    const container = this.elements.suggestionsList;
    if (!container) return;
    
    let suggestions = this.state.suggestions || [];
    
    // Apply filter
    const filter = this.elements.suggestionFilter?.value || 'all';
    if (filter !== 'all') {
      suggestions = suggestions.filter(s => {
        if (filter === 'header' || filter === 'footer' || filter === 'nav') {
          return s.location === filter;
        }
        return s.element === filter;
      });
    }
    
    // Update count display
    if (this.elements.suggestionCount) {
      const total = this.state.suggestions?.length || 0;
      this.elements.suggestionCount.textContent = filter === 'all' 
        ? `${total} items` 
        : `${suggestions.length} of ${total}`;
    }
    
    if (suggestions.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <div class="icon">🔍</div>
          <p>${filter === 'all' ? 'No suggestions available. Click Refresh Analysis.' : 'No ' + filter + ' elements found.'}</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    suggestions.forEach((suggestion, idx) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      
      // CRITICAL: Fix action type for radio/checkbox - they should be CLICK, not FILL
      let effectiveType = suggestion.type;
      if (suggestion.element === 'radio' || suggestion.element === 'checkbox' ||
          suggestion.inputType === 'radio' || suggestion.inputType === 'checkbox') {
        effectiveType = 'click';
        suggestion.type = 'click';
      }
      
      // Create better action type labels
      const actionLabels = {
        'click': 'CLICK',
        'fill': 'FILL INPUT',
        'check': 'SELECT OPTION',
        'select': 'CHOOSE FROM',
        'assert': 'ASSERT'
      };
      const elementLabels = {
        'button': 'BUTTON',
        'link': 'LINK',
        'input': 'INPUT',
        'radio': 'RADIO',
        'checkbox': 'CHECKBOX',
        'dropdown': 'DROPDOWN',
        'combobox': 'DROPDOWN',
        'heading': 'HEADING',
        'card': 'CARD',
        'option': 'OPTION',
        'tab': 'TAB',
        'menuitem': 'MENU ITEM'
      };
      
      const actionLabel = actionLabels[effectiveType] || effectiveType.toUpperCase();
      const elementLabel = elementLabels[suggestion.element] || suggestion.element?.toUpperCase() || '';
      
      // Location badge for context
      const locationBadge = suggestion.location && suggestion.location !== 'body' && suggestion.location !== 'main'
        ? `<span style="font-size: 9px; color: #667eea; margin-left: 4px;">[${suggestion.location}]</span>`
        : '';
      
      // Duplicate warning badge - shows when multiple elements match
      const duplicateBadge = suggestion.hasDuplicates 
        ? `<span style="font-size: 9px; color: #f59e0b; background: #fef3c7; padding: 1px 4px; border-radius: 3px; margin-left: 4px;" title="⚠️ ${suggestion.totalDuplicates} elements match this selector. Element ${(suggestion.elementIndex || 0) + 1} of ${suggestion.totalDuplicates} will be targeted.">⚠️ ${suggestion.totalDuplicates} found</span>`
        : '';
      
      // Selector code - only show if toggle is on
      const selectorHtml = this.showSelectorCode 
        ? `<div class="suggestion-selector">${(suggestion.selector || '').substring(0, 80)}${suggestion.selector?.length > 80 ? '...' : ''}</div>`
        : '';
      
      item.innerHTML = `
        <div class="suggestion-icon ${suggestion.element || suggestion.type}">
          ${this.getSuggestionIcon(suggestion)}
        </div>
        <div class="suggestion-details">
          <div class="suggestion-type">${actionLabel} ${elementLabel}${locationBadge}${duplicateBadge}</div>
          <div class="suggestion-text">${suggestion.text || suggestion.label || suggestion.description}</div>
          ${selectorHtml}
        </div>
        <div class="suggestion-actions">
          <button class="exec-btn" data-idx="${idx}" title="Execute this action">▶</button>
          <button class="add-btn" data-idx="${idx}" title="Add to recording">+</button>
        </div>
      `;
      container.appendChild(item);
    });
    
    // Add event listeners for action buttons
    container.querySelectorAll('.exec-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const suggestion = suggestions[idx];
        console.log('[Sidebar] ▶ clicked for:', suggestion?.text, 'idx:', idx);
        if (suggestion) {
          await this.executeSuggestion(suggestion);
        } else {
          console.error('[Sidebar] No suggestion at index', idx);
        }
      });
    });
    
    container.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        const suggestion = suggestions[idx];
        console.log('[Sidebar] + clicked for:', suggestion?.text, 'idx:', idx);
        if (suggestion) {
          // Add directly to workflow without executing
          this.addToWorkflow(suggestion, {});
          this.addLog('info', `Added "${suggestion.text}" to workflow`);
        }
      });
    });
  }

  /**
   * Get icon for suggestion type
   */
  getSuggestionIcon(suggestion) {
    const icons = {
      'button': '🔘',
      'link': '🔗',
      'input': '📝',
      'radio': '🔘',
      'card': '📋',
      'option': '☑️',
      'tab': '📑',
      'menuitem': '📌',
      'combobox': '📋',
      'dropdown': '📋',
      'checkbox': '☑️',
      'dropdown': '📋',
      'flow': '⚡',
      'click': '👆',
      'fill': '⌨️',
      'check': '✅',
      'select': '📋',
    };
    return icons[suggestion.element] || icons[suggestion.type] || '💡';
  }

  /**
   * Execute a suggestion (Phase 4) - with auto-retry and pointing mode
   */
  async executeSuggestion(suggestion, addToWorkflow = true) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        this.addLog('error', 'No active tab found');
        return;
      }
      
      this.addLog('info', `Executing: ${suggestion.text || suggestion.description}`);
      
      // Try executing with auto-retry of fallback selectors
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_ACTION',
        action: suggestion
      }, { frameId: 0 });
      
      console.log('[Sidebar] Execute response:', response);
      
      if (response?.success) {
        this.addLog('success', `✓ ${suggestion.text || suggestion.description}`);
        
        // Add to workflow steps
        if (addToWorkflow) {
          console.log('[Sidebar] Adding to workflow...');
          this.addToWorkflow(suggestion, response);
        }
        
        // Refresh analysis after action - wait longer if it might navigate
        const isLink = suggestion.element === 'link' || suggestion.href;
        const waitTime = isLink ? 1500 : 800;
        
        setTimeout(() => {
          this.addLog('info', '🔄 Refreshing page analysis...');
          this.refreshPageAnalysis();
        }, waitTime);
        
        return { success: true };
        
      } else if (response?.needsManualSelect) {
        // All selectors failed - enter pointing mode
        this.addLog('info', `Element not found. Click on it manually...`);
        
        const pointResult = await this.startPointingMode(suggestion, tab.id);
        
        if (pointResult?.success) {
          this.addLog('success', `✓ Found and clicked: ${pointResult.text || suggestion.text}`);
          
          // Update suggestion with new selector
          suggestion.selectorObj = pointResult.newSelectorObj;
          suggestion.selector = pointResult.selector;
          suggestion.fixed = true;
          
          // Add to workflow
          if (addToWorkflow) {
            this.addToWorkflow(suggestion, pointResult);
          }
          
          // Refresh analysis - wait for possible navigation
          setTimeout(() => {
            this.addLog('info', '🔄 Refreshing page analysis...');
            this.refreshPageAnalysis();
          }, 1500);
          
          return { success: true, fixed: true };
          
        } else if (pointResult?.cancelled) {
          this.addLog('info', 'Pointing cancelled');
          // Add to failed elements
          this.addToFailedElements(suggestion, 'User cancelled');
          return { success: false, cancelled: true };
        }
      } else {
        // Other error
        this.addLog('error', `Failed: ${response?.error || 'Unknown error'}`);
        this.addToFailedElements(suggestion, response?.error);
        return { success: false, error: response?.error };
      }
    } catch (error) {
      console.error('[Sidebar] Execute error:', error);
      this.addLog('error', 'Execution failed: ' + error.message);
      this.addToFailedElements(suggestion, error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start pointing mode on page
   */
  async startPointingMode(suggestion, tabId) {
    try {
      this.addLog('info', '🎯 Point to the element on the page...');
      
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'START_POINTING_MODE',
        actionInfo: {
          text: suggestion.text || suggestion.description,
          type: suggestion.type
        }
      }, { frameId: 0 });
      
      return response;
    } catch (error) {
      console.error('[Sidebar] Pointing mode error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add executed element to workflow with assertion support
   */
  addToWorkflow(suggestion, response, assertionConfig = null) {
    console.log('[Sidebar] addToWorkflow called with:', suggestion.text || suggestion.description);
    
    // Auto-detect appropriate assertion based on action type
    const autoAssertion = this.generateAutoAssertion(suggestion, response);
    
    const step = {
      id: Date.now(),
      order: this.workflowSteps.length + 1,
      type: suggestion.type,
      element: suggestion.element,
      text: suggestion.text || suggestion.label,
      description: suggestion.description,
      selector: response?.selector || suggestion.selector,
      selectorObj: response?.newSelectorObj || suggestion.selectorObj,
      fixed: suggestion.fixed || false,
      timestamp: Date.now(),
      // Multi-tab support
      opensNewTab: response?.opensNewTab || suggestion.opensNewTab || false,
      href: response?.href || suggestion.href || null,
      // NEW: Assertion (expected result) for this step
      assertion: assertionConfig || autoAssertion,
      // NEW: Manual step description
      manualStep: {
        action: this.generateManualAction(suggestion),
        expectedResult: this.generateExpectedResult(suggestion, assertionConfig || autoAssertion)
      },
      // NEW: Input value for fill actions
      value: suggestion.value || response?.value || null,
      // NEW: Element index for handling duplicate elements
      elementIndex: suggestion.elementIndex,
      totalDuplicates: suggestion.totalDuplicates || 1,
      hasDuplicates: suggestion.hasDuplicates || false
    };
    
    this.workflowSteps.push(step);
    console.log('[Sidebar] workflowSteps now has', this.workflowSteps.length, 'items');
    
    this.renderWorkflow();
    this.updateWorkflowButtons();
    
    console.log('[Sidebar] Workflow rendered, section display:', this.elements.workflowSection?.style.display);
  }
  
  /**
   * Generate automatic assertion based on action type
   */
  generateAutoAssertion(suggestion, response) { return spGenerateAutoAssertion(suggestion, response); }
  generateManualAction(suggestion) { return spGenerateManualAction(suggestion); }
  generateExpectedResult(suggestion, assertion) { return spGenerateExpectedResult(suggestion, assertion); }

  
  /**
   * Render workflow steps
   */
  renderWorkflow() {
    console.log('[Sidebar] renderWorkflow called, steps:', this.workflowSteps.length);
    
    const container = this.elements.workflowStepsList;
    console.log('[Sidebar] workflowStepsList container:', container ? 'FOUND' : 'NOT FOUND');
    console.log('[Sidebar] workflowSection:', this.elements.workflowSection ? 'FOUND' : 'NOT FOUND');
    
    if (!container) {
      console.error('[Sidebar] workflowStepsList container not found!');
      return;
    }
    
    // Show section if we have steps
    if (this.elements.workflowSection) {
      this.elements.workflowSection.style.display = this.workflowSteps.length > 0 ? 'block' : 'none';
      console.log('[Sidebar] Set workflowSection display to:', this.elements.workflowSection.style.display);
    }
    
    if (this.elements.workflowStepCount) {
      this.elements.workflowStepCount.textContent = `${this.workflowSteps.length} steps`;
    }
    
    if (this.workflowSteps.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: 12px;"><p style="font-size: 11px;">Click ▶ on elements to add them to workflow</p></div>';
      return;
    }
    
    container.innerHTML = this.workflowSteps.map((step, idx) => {
      // Icon based on type and new tab status
      let icon = step.fixed ? '🔧' : (step.element === 'button' ? '🔘' : step.element === 'link' ? '🔗' : '👆');
      if (step.opensNewTab) icon = '🔗↗️';
      if (step.type === 'switchToParent') icon = '↩️';
      
      // Type label
      let typeLabel = step.type?.toUpperCase() || 'CLICK';
      if (step.opensNewTab) typeLabel += ' (NEW TAB)';
      
      // Assertion badge
      const hasAssertion = step.assertion?.enabled;
      const assertionBadge = hasAssertion ? 
        `<span style="background: rgba(76, 175, 80, 0.3); color: #4caf50; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">✓ Assert</span>` : '';
      
      // Expected result preview
      const expectedResult = step.manualStep?.expectedResult || (hasAssertion ? this.generateExpectedResult(step, step.assertion) : '');
      const expectedResultHtml = expectedResult ? 
        `<div style="font-size: 9px; color: rgba(76, 175, 80, 0.8); margin-top: 2px;">✅ ${expectedResult}</div>` : '';
      
      return `
      <div class="action-item" style="padding: 8px 10px;">
        <span class="action-number">${step.order}</span>
        <div class="action-icon ${step.element || 'click'}" style="width: 22px; height: 22px;">
          ${icon}
        </div>
        <div class="action-details" style="flex: 1;">
          <div class="action-type" style="font-size: 10px;">${typeLabel} ${step.element?.toUpperCase() || ''}${assertionBadge}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.9);">${step.text || step.description}</div>
          ${expectedResultHtml}
        </div>
        <button class="edit-step-btn" data-idx="${idx}" style="background: none; border: none; color: #4fc3f7; cursor: pointer; padding: 4px; margin-right: 4px;" title="Edit assertion">⚙️</button>
        <button class="remove-step-btn" data-idx="${idx}" style="background: none; border: none; color: #ff6b81; cursor: pointer; padding: 4px;">✕</button>
      </div>
    `}).join('');
    
    // Add remove listeners
    container.querySelectorAll('.remove-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        this.workflowSteps.splice(idx, 1);
        // Re-number steps
        this.workflowSteps.forEach((s, i) => s.order = i + 1);
        this.renderWorkflow();
        this.updateWorkflowButtons();
      });
    });
    
    // Add edit assertion listeners
    container.querySelectorAll('.edit-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx);
        this.openAssertionEditor(idx);
      });
    });
  }
  
  /**
   * Open assertion editor modal for a step
   */
  openAssertionEditor(stepIndex) {
    const step = this.workflowSteps[stepIndex];
    if (!step) return;
    
    // Create or get modal
    let modal = document.getElementById('assertionEditorModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'assertionEditorModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h3 style="margin: 0; font-size: 14px;">⚙️ Edit Step Assertion</h3>
            <button class="close-modal" style="background: none; border: none; font-size: 18px; cursor: pointer; color: white;">×</button>
          </div>
          <div class="modal-body" style="padding: 15px;">
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Step: <span id="editingStepName" style="color: white;"></span></label>
            </div>
            
            <div style="margin-bottom: 15px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="assertionEnabled" style="width: 16px; height: 16px;">
                <span style="font-size: 12px;">Enable Assertion (Expected Result)</span>
              </label>
            </div>
            
            <div id="assertionOptions" style="display: none;">
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Assertion Type</label>
                <select id="assertionType" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white;">
                  <option value="visible">👁️ Element is visible</option>
                  <option value="hidden">🙈 Element is hidden</option>
                  <option value="enabled">✅ Element is enabled</option>
                  <option value="disabled">🚫 Element is disabled</option>
                  <option value="text_equals">📝 Text equals</option>
                  <option value="text_contains">🔍 Text contains</option>
                  <option value="url_equals">🔗 URL equals</option>
                  <option value="url_contains">🔗 URL contains</option>
                  <option value="title_equals">📄 Page title equals</option>
                  <option value="title_contains">📄 Page title contains</option>
                  <option value="value_equals">📥 Input value equals</option>
                  <option value="checked">☑️ Checkbox is checked</option>
                  <option value="not_checked">⬜ Checkbox is unchecked</option>
                  <option value="element_count">🔢 Element count equals</option>
                </select>
              </div>
              
              <div id="assertionExpectedDiv" style="margin-bottom: 12px; display: none;">
                <label style="display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Expected Value</label>
                <input type="text" id="assertionExpected" placeholder="Expected value..." style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white;">
              </div>
              
              <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 5px;">Custom Expected Result Text (for manual test)</label>
                <input type="text" id="assertionManualResult" placeholder="e.g., Success message appears" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: white;">
              </div>
              
              <div style="background: rgba(76, 175, 80, 0.1); padding: 10px; border-radius: 4px; margin-top: 10px;">
                <div style="font-size: 10px; color: rgba(255,255,255,0.6);">Preview (Manual Test):</div>
                <div id="assertionPreview" style="font-size: 12px; color: #4caf50; margin-top: 4px;">✅ Element is visible</div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="padding: 10px 15px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end; gap: 8px;">
            <button id="cancelAssertionBtn" style="padding: 8px 16px; background: rgba(255,255,255,0.1); border: none; border-radius: 4px; color: white; cursor: pointer;">Cancel</button>
            <button id="saveAssertionBtn" style="padding: 8px 16px; background: #4fc3f7; border: none; border-radius: 4px; color: #1a1a2e; cursor: pointer; font-weight: 500;">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Close button
      modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      modal.querySelector('#cancelAssertionBtn').addEventListener('click', () => {
        modal.style.display = 'none';
      });
      
      // Toggle assertion options visibility
      modal.querySelector('#assertionEnabled').addEventListener('change', (e) => {
        modal.querySelector('#assertionOptions').style.display = e.target.checked ? 'block' : 'none';
      });
      
      // Update preview and expected field visibility based on type
      const typeSelect = modal.querySelector('#assertionType');
      const expectedDiv = modal.querySelector('#assertionExpectedDiv');
      const preview = modal.querySelector('#assertionPreview');
      const expectedInput = modal.querySelector('#assertionExpected');
      const manualInput = modal.querySelector('#assertionManualResult');
      
      const needsExpected = ['text_equals', 'text_contains', 'url_equals', 'url_contains', 'title_equals', 'title_contains', 'value_equals', 'element_count'];
      
      const updatePreview = () => {
        const type = typeSelect.value;
        const expected = expectedInput.value;
        const manual = manualInput.value;
        
        expectedDiv.style.display = needsExpected.includes(type) ? 'block' : 'none';
        
        if (manual) {
          preview.textContent = `✅ ${manual}`;
        } else {
          preview.textContent = `✅ ${this.generateExpectedResult({}, { type, expected })}`;
        }
      };
      
      typeSelect.addEventListener('change', updatePreview);
      expectedInput.addEventListener('input', updatePreview);
      manualInput.addEventListener('input', updatePreview);
    }
    
    // Populate with current step data
    modal.querySelector('#editingStepName').textContent = step.text || step.description || `Step ${stepIndex + 1}`;
    
    const enabled = modal.querySelector('#assertionEnabled');
    const options = modal.querySelector('#assertionOptions');
    const typeSelect = modal.querySelector('#assertionType');
    const expectedInput = modal.querySelector('#assertionExpected');
    const manualInput = modal.querySelector('#assertionManualResult');
    const expectedDiv = modal.querySelector('#assertionExpectedDiv');
    const preview = modal.querySelector('#assertionPreview');
    
    enabled.checked = step.assertion?.enabled || false;
    options.style.display = enabled.checked ? 'block' : 'none';
    typeSelect.value = step.assertion?.type || 'visible';
    expectedInput.value = step.assertion?.expected || '';
    manualInput.value = step.manualStep?.expectedResult || '';
    
    const needsExpected = ['text_equals', 'text_contains', 'url_equals', 'url_contains', 'title_equals', 'title_contains', 'value_equals', 'element_count'];
    expectedDiv.style.display = needsExpected.includes(typeSelect.value) ? 'block' : 'none';
    
    if (manualInput.value) {
      preview.textContent = `✅ ${manualInput.value}`;
    } else {
      preview.textContent = `✅ ${this.generateExpectedResult({}, { type: typeSelect.value, expected: expectedInput.value })}`;
    }
    
    // Save handler
    const saveBtn = modal.querySelector('#saveAssertionBtn');
    saveBtn.onclick = () => {
      step.assertion = {
        enabled: enabled.checked,
        type: typeSelect.value,
        expected: expectedInput.value,
        target: step.selector
      };
      
      step.manualStep = {
        ...step.manualStep,
        expectedResult: manualInput.value || this.generateExpectedResult(step, step.assertion)
      };
      
      this.renderWorkflow();
      modal.style.display = 'none';
      this.addLog('success', `Updated assertion for step ${stepIndex + 1}`);
    };
    
    modal.style.display = 'flex';
  }
  
  /**
   * Update workflow button states
   */
  updateWorkflowButtons() {
    const hasSteps = this.workflowSteps.length > 0;
    const saveTestCaseBtn = document.getElementById('saveTestCaseFromWorkflow');
    const openWorkflowEditorBtn = document.getElementById('openWorkflowEditorBtn');
    
    if (saveTestCaseBtn) saveTestCaseBtn.disabled = !hasSteps;
    if (openWorkflowEditorBtn) openWorkflowEditorBtn.disabled = !hasSteps;
  }
  
  /**
   * Add to failed elements list
   */
  addToFailedElements(suggestion, error) {
    this.failedElements.push({
      ...suggestion,
      error,
      failedAt: Date.now()
    });
    this.renderFailedElements();
  }
  
  /**
   * Render failed elements
   */
  renderFailedElements() {
    const container = this.elements.failedElementsList;
    if (!container) return;
    
    // Show section if we have failures
    if (this.elements.failedElementsSection) {
      this.elements.failedElementsSection.style.display = this.failedElements.length > 0 ? 'block' : 'none';
    }
    
    if (this.elements.failedCount) {
      this.elements.failedCount.textContent = this.failedElements.length;
    }
    
    container.innerHTML = this.failedElements.map((el, idx) => `
      <div class="action-item" style="padding: 8px 10px; background: rgba(255, 71, 87, 0.1);">
        <div class="action-icon" style="background: rgba(255, 71, 87, 0.2);">❌</div>
        <div class="action-details" style="flex: 1;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.9);">${el.text || el.description}</div>
          <div style="font-size: 9px; color: #ff6b81;">${el.error}</div>
        </div>
        <button class="retry-failed-btn" data-idx="${idx}" style="background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 10px;">🔄 Retry</button>
      </div>
    `).join('');
    
    // Add retry listeners
    container.querySelectorAll('.retry-failed-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(btn.dataset.idx);
        const element = this.failedElements[idx];
        
        // Remove from failed list
        this.failedElements.splice(idx, 1);
        this.renderFailedElements();
        
        // Try again
        await this.executeSuggestion(element);
      });
    });
  }
  
  /**
   * Clear workflow
   */
  clearWorkflow() {
    this.workflowSteps = [];
    this.renderWorkflow();
    this.updateWorkflowButtons();
    this.addLog('info', 'Workflow cleared');
  }
  
  /**
   * Add a tab control step (switch to parent, close tab)
   */
  addTabControlStep(type) {
    const step = {
      id: Date.now(),
      order: this.workflowSteps.length + 1,
      type: type,
      element: 'tab',
      text: type === 'switchToParent' ? 'Switch to Parent Tab' : 'Close Current Tab',
      description: type === 'switchToParent' ? 'Return to the original/parent tab' : 'Close the current tab',
      timestamp: Date.now()
    };
    
    this.workflowSteps.push(step);
    this.renderWorkflow();
    this.updateWorkflowButtons();
    this.addLog('info', `Added: ${step.text}`);
  }
  
  /**
   * Save as UNIFIED test case (both manual and automated in one)
   * This saves to the backend test_cases table
   */
  async saveAsUnifiedTestCase() { return spSaveAsUnifiedTestCase(this); }
  async saveToAlternativeEndpoint(testCase) { return spSaveToAlternativeEndpoint(this, testCase); }

  
  async openInWorkflowEditor() { return spOpenInWorkflowEditor(this); }

  
  mapStepTypeToNodeType(stepType) { return spMapStepTypeToNodeType(stepType); }
  mapActionTypeToNodeType(actionType) { return spMapActionTypeToNodeType(actionType); }

  
  // ============================================================================
  // SYNTHETIC TEST DATA GENERATION — delegates to sidepanel-test-data.js
  // ============================================================================
  async generateTestData() { return spGenerateTestData(this); }
  generateTestDataFromSuggestions() { return spGenerateTestDataFromSuggestions(this); }
  detectFieldType(input) { return spDetectFieldType(input); }
  generateValue(fieldType) { return spGenerateValue(this, fieldType); }
  renderTestData(testData) { return spRenderTestData(this, testData); }
  async fillFieldWithValue(fieldData, value) { return spFillFieldWithValue(this, fieldData, value); }
  copyTestDataAsJSON() { return spCopyTestDataAsJSON(this); }
  downloadTestDataAsCSV() { return spDownloadTestDataAsCSV(this); }
  clearTestData() { return spClearTestData(this); }

  
  // ============================================================================
  // DATA CONSTRAINTS MANAGEMENT — delegates to sidepanel-constraints.js
  // ============================================================================
  openConstraintsModal() { return spOpenConstraintsModal(this); }
  closeConstraintsModal() { return spCloseConstraintsModal(); }
  async applyPreset(presetName) { return spApplyPreset(this, presetName); }
  addConstraint() { return spAddConstraint(this); }
  loadActiveConstraints() { return spLoadActiveConstraints(this); }
  saveDataConstraints() { return spSaveDataConstraints(this); }
  getDataConstraint(fieldType) { return spGetDataConstraint(this, fieldType); }

  
  async generateScriptFromWorkflow() { return spGenerateScriptFromWorkflow(this); }
  generateAssertionCode(assertion, selector, language) { return spGenerateAssertionCode(assertion, selector, language); }

  
  async saveWorkflowAsScenario() { return spSaveWorkflowAsScenario(this); }
  async saveToWebsiteWorkflowEditor(workflowData) { return spSaveToWebsiteWorkflowEditor(this, workflowData); }
  convertToManualTest() { return spConvertToManualTest(this); }
  getManualTestAction(step) { return spGetManualTestAction(step); }
  getExpectedResult(step) { return spGetExpectedResult(step); }
  formatManualTest(testCase) { return spFormatManualTest(testCase); }


  /**
   * Add suggestion to current recording
   * Uses the SAME selector format as recording for robust scripts
   */
  async addSuggestionToRecording(suggestion) {
    // Use the action type from analysis (already set correctly: click for radio/checkbox)
    const actionType = suggestion.type === 'check' ? 'click' : suggestion.type;
    
    // Create action from suggestion with FULL selector data (same as recording)
    // This enables fallback chains and self-healing
    const action = {
      type: actionType,
      description: suggestion.description,
      // Use the FULL selector object if available (contains fallbacks)
      // This is the same format recording uses
      selector: suggestion.selectorObj || { playwright: suggestion.selector?.replace('page.', '') || suggestion.selector },
      value: suggestion.value,
      text: suggestion.text || suggestion.label,
      timestamp: Date.now(),
      automated: true,
      // Element metadata for robust script generation (same as recording captures)
      tagName: suggestion.tagName,
      inputType: suggestion.inputType || suggestion.type,
      name: suggestion.name,
      id: suggestion.id,
      className: suggestion.className,
      role: suggestion.role,
      ariaLabel: suggestion.ariaLabel,
      innerText: suggestion.text || suggestion.label,
      // App context
      app: suggestion.selectorObj?.app,
      appName: suggestion.selectorObj?.appName,
    };
    
    // Add to local actions
    this.state.actions.push(action);
    this.renderActionsList();
    this.updateUI();
    
    // Send to background
    chrome.runtime.sendMessage({
      type: 'ACTION_RECORDED',
      action: action
    });
    
    this.addLog('success', `Added: ${suggestion.description}`);
  }

  /**
   * Add all auto-generated assertions to recording
   */
  async addAllAssertions() {
    const analysis = this.state.pageAnalysis;
    if (!analysis) {
      this.addLog('error', 'No page analysis available');
      return;
    }
    
    let count = 0;
    
    // Add heading assertions
    (analysis.headings || []).slice(0, 3).forEach(h => {
      const action = {
        type: 'assert',
        assertType: 'toBeVisible',
        description: `Assert heading: "${h.text}"`,
        selector: { playwright: h.selector },
        timestamp: Date.now()
      };
      this.state.actions.push(action);
      count++;
    });
    
    // Add button assertions
    (analysis.buttons || []).slice(0, 4).forEach(b => {
      const action = {
        type: 'assert',
        assertType: 'toBeVisible',
        description: `Assert button: "${b.text}"`,
        selector: { playwright: b.selector },
        timestamp: Date.now()
      };
      this.state.actions.push(action);
      count++;
    });
    
    this.renderActionsList();
    this.updateUI();
    this.addLog('success', `Added ${count} assertions to recording`);
  }

  /**
   * Capture current page state
   */
  async capturePage() {
    const analysis = this.state.pageAnalysis;
    if (!analysis) {
      this.addLog('error', 'No page analysis available');
      return;
    }
    
    // Add navigate action with current URL
    const navigateAction = {
      type: 'navigate',
      url: analysis.url,
      description: `Navigate to ${new URL(analysis.url).pathname}`,
      timestamp: Date.now()
    };
    this.state.actions.push(navigateAction);
    
    // Add key assertions
    let assertionCount = 0;
    
    // Add heading assertions
    (analysis.headings || []).slice(0, 2).forEach(h => {
      this.state.actions.push({
        type: 'assert',
        assertType: 'toBeVisible',
        description: `Assert heading: "${h.text}"`,
        selector: { playwright: h.selector },
        timestamp: Date.now()
      });
      assertionCount++;
    });
    
    // Add key button assertions
    (analysis.buttons || []).slice(0, 3).forEach(b => {
      this.state.actions.push({
        type: 'assert',
        assertType: 'toBeVisible',
        description: `Assert button: "${b.text}"`,
        selector: { playwright: b.selector },
        timestamp: Date.now()
      });
      assertionCount++;
    });
    
    this.renderActionsList();
    this.updateUI();
    this.addLog('success', `Captured page with ${assertionCount} assertions`);
  }

  // ============================================
  // AI ASSIST & DESKTOP — delegates to sidepanel-ai-assist.js
  // ============================================
  async openInDesktopRecorder() { return spOpenInDesktopRecorder(this); }
  async handleAiFix(stepIndex) { return spHandleAiFix(this, stepIndex); }
  async handleFlag(stepIndex) { return spHandleFlag(this, stepIndex); }
  handleManualAssist(stepIndex) { return spHandleManualAssist(this, stepIndex); }
  _createManualAssistCard(action, stepIndex) { return spCreateManualAssistCard(this, action, stepIndex); }
  _switchManualAssistTab(btn, tabName) { return spSwitchManualAssistTab(btn, tabName); }
  async _submitManualAssistPaste(stepIndex) { return spSubmitManualAssistPaste(this, stepIndex); }
  async _submitManualAssistSelector(stepIndex) { return spSubmitManualAssistSelector(this, stepIndex); }
  _renderManualAssistResults(container, selectors, stepIndex) { return spRenderManualAssistResults(this, container, selectors, stepIndex); }
  _applyManualAssistSelector(stepIndex, selector) { return spApplyManualAssistSelector(this, stepIndex, selector); }

}

// Initialize when DOM is ready - make global for onclick handlers
let sidebar;
document.addEventListener('DOMContentLoaded', () => {
  sidebar = new SidebarController();
  window.sidebar = sidebar; // Make accessible for inline onclick
  
  // Notify that sidebar is ready for Flowstral Engine integration
  console.log('[Sidepanel] SidebarController initialized');
  console.log('[Sidepanel] generateScript exists:', typeof sidebar.generateScript);
  
  // Dispatch event for integration script
  window.dispatchEvent(new CustomEvent('sidebarReady', { detail: { sidebar } }));
});
