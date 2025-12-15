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
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ACTION_RECORDED') {
        console.log('[Sidebar] ACTION_RECORDED received:', message.action.type, message.action.description);
        console.log('[Sidebar] Current actions before push:', this.state.actions.length);
        this.state.actions.push(message.action);
        console.log('[Sidebar] Actions after push:', this.state.actions.length);
        this.renderActionsList();
        this.updateUI();
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
    };
    
    // Initialize show code toggle state
    this.showSelectorCode = false;
    
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
    // Recording controls
    this.elements.startBtn.addEventListener('click', () => this.startRecording());
    this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
    this.elements.clearBtn.addEventListener('click', () => this.clearRecording());
    this.elements.saveTestCaseBtn.addEventListener('click', () => this.saveTestCase());
    // Record tab uses openInWorkflowEditorFromRecord
    this.elements.openWorkflowBtn.addEventListener('click', () => this.openInWorkflowEditorFromRecord());
    
    // AI Enhancement (in Review tab)
    if (this.elements.enhanceAIBtn) {
      this.elements.enhanceAIBtn.addEventListener('click', () => this.enhanceWithAI());
    }
    
    // Assertion builder
    if (this.elements.assertionType) {
      this.elements.assertionType.addEventListener('change', () => this.updateAssertionUI());
    }
    if (this.elements.addAssertionBtn) {
      this.elements.addAssertionBtn.addEventListener('click', () => this.addAssertion());
    }
    
    // Script controls
    this.elements.generateBtn.addEventListener('click', () => this.generateScript());
    this.elements.copyBtn.addEventListener('click', () => this.copyScript());
    this.elements.downloadBtn.addEventListener('click', () => this.downloadScript());
    
    // Run controls
    this.elements.runBtn.addEventListener('click', () => this.runTest());
    this.elements.clearLogsBtn.addEventListener('click', () => this.clearLogs());
    
    // Show browser toggle
    this.elements.showBrowserToggle.addEventListener('click', () => {
      this.options.showBrowser = !this.options.showBrowser;
      this.elements.showBrowserToggle.classList.toggle('active');
      this.saveSettings();
    });
    
    // Settings
    this.elements.appSelect.addEventListener('change', (e) => {
      this.options.appType = e.target.value;
      this.saveSettings();
    });
    
    this.elements.languageSelect.addEventListener('change', (e) => {
      this.options.language = e.target.value;
      this.updateScriptLangDisplay();
      this.saveSettings();
      // Regenerate script with new language
      if (this.state.script && this.state.actions.length > 0) {
        this.generateScript();
      }
    });
    
    this.elements.browserSelect.addEventListener('change', (e) => {
      this.options.browser = e.target.value;
      this.saveSettings();
    });
    
    this.elements.serverUrl.addEventListener('change', (e) => {
      this.options.serverUrl = e.target.value;
      this.saveSettings();
      this.checkServerConnection();
    });
    
    // Base URL input - save when changed
    if (this.elements.baseUrlInput) {
      this.elements.baseUrlInput.addEventListener('change', (e) => {
        this.options.baseUrl = e.target.value;
        this.saveSettings();
        console.log('[Sidebar] Base URL updated:', e.target.value);
      });
    }
    
    this.elements.checkServerBtn.addEventListener('click', () => this.checkServerConnection());
    
    // Advanced feature toggles
    const advancedToggles = [
      { el: this.elements.selfHealingToggle, key: 'selfHealing' },
      { el: this.elements.smartWaitsToggle, key: 'smartWaits' },
      { el: this.elements.screenshotOnFailureToggle, key: 'screenshotOnFailure' },
      { el: this.elements.generateAssertionsToggle, key: 'generateAssertions' },
      { el: this.elements.pageObjectModelToggle, key: 'pageObjectModel' },
      { el: this.elements.dataDrivenToggle, key: 'dataDriven' },
      { el: this.elements.crossBrowserToggle, key: 'crossBrowser' },
      { el: this.elements.visualRegressionToggle, key: 'visualRegression' },
    ];
    
    advancedToggles.forEach(({ el, key }) => {
      if (el) {
        el.addEventListener('change', (e) => {
          this.options[key] = e.target.checked;
          this.saveSettings();
          // If POM, data-driven, or other enterprise features change, show info
          if (['pageObjectModel', 'dataDriven', 'crossBrowser', 'visualRegression'].includes(key)) {
            this.addLog('info', `${key} ${e.target.checked ? 'enabled' : 'disabled'} - will apply on next generation`);
          }
        });
      }
    });
    
    // Format buttons for test case generation
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => this.downloadTestCase(btn.dataset.format));
    });
    
    // ============ AGENTIC FEATURES (Phases 3-4) ============
    // Refresh Analysis button
    if (this.elements.refreshAnalysisBtn) {
      console.log('[Sidebar] Attaching refreshAnalysisBtn click handler');
      this.elements.refreshAnalysisBtn.addEventListener('click', () => {
        console.log('[Sidebar] Refresh Analysis button clicked!');
        this.refreshPageAnalysis();
      });
    } else {
      console.error('[Sidebar] refreshAnalysisBtn element NOT FOUND!');
    }
    
    // Scan Menus button - discovers hidden dropdown menu items
    if (this.elements.expandMenusBtn) {
      this.elements.expandMenusBtn.addEventListener('click', () => {
        console.log('[Sidebar] Scan Menus clicked!');
        this.scanDropdownMenus();
      });
    }
    
    // Show Code Toggle
    if (this.elements.showCodeToggle) {
      this.elements.showCodeToggle.addEventListener('click', () => {
        this.showSelectorCode = !this.showSelectorCode;
        this.elements.showCodeToggle.classList.toggle('active', this.showSelectorCode);
        this.renderSuggestions();  // Re-render with/without code
      });
    }
    
    // Test Data Generation
    const generateTestDataBtn = document.getElementById('generateTestDataBtn');
    if (generateTestDataBtn) {
      generateTestDataBtn.addEventListener('click', () => this.generateTestData());
    }
    
    const copyTestDataBtn = document.getElementById('copyTestDataBtn');
    if (copyTestDataBtn) {
      copyTestDataBtn.addEventListener('click', () => this.copyTestDataAsJSON());
    }
    
    const downloadTestDataCSVBtn = document.getElementById('downloadTestDataCSVBtn');
    if (downloadTestDataCSVBtn) {
      downloadTestDataCSVBtn.addEventListener('click', () => this.downloadTestDataAsCSV());
    }
    
    const clearTestDataBtn = document.getElementById('clearTestDataBtn');
    if (clearTestDataBtn) {
      clearTestDataBtn.addEventListener('click', () => this.clearTestData());
    }
    
    // Data Constraints Modal
    const openConstraintsBtn = document.getElementById('openConstraintsBtn');
    if (openConstraintsBtn) {
      openConstraintsBtn.addEventListener('click', () => this.openConstraintsModal());
    }
    
    const closeConstraintsModal = document.getElementById('closeConstraintsModal');
    if (closeConstraintsModal) {
      closeConstraintsModal.addEventListener('click', () => this.closeConstraintsModal());
    }
    
    const addConstraintBtn = document.getElementById('addConstraintBtn');
    if (addConstraintBtn) {
      addConstraintBtn.addEventListener('click', () => this.addConstraint());
    }
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyPreset(e.target.dataset.preset));
    });
    
    // Suggestion Filter
    if (this.elements.suggestionFilter) {
      this.elements.suggestionFilter.addEventListener('change', () => {
        this.renderSuggestions();  // Re-render with filter
      });
    }
    
    // Assert All button
    if (this.elements.assertAllBtn) {
      this.elements.assertAllBtn.addEventListener('click', () => this.addAllAssertions());
    }
    
    // Capture Page button
    if (this.elements.capturePageBtn) {
      this.elements.capturePageBtn.addEventListener('click', () => this.capturePage());
    }
    
    // Workflow buttons
    const saveTestCaseBtn = document.getElementById('saveTestCaseFromWorkflow');
    if (saveTestCaseBtn) {
      saveTestCaseBtn.addEventListener('click', () => this.saveAsUnifiedTestCase());
    }
    
    const openWorkflowEditorBtn = document.getElementById('openWorkflowEditorBtn');
    if (openWorkflowEditorBtn) {
      openWorkflowEditorBtn.addEventListener('click', () => this.openInWorkflowEditor());
    }
    
    if (this.elements.clearWorkflowBtn) {
      this.elements.clearWorkflowBtn.addEventListener('click', () => this.clearWorkflow());
    }
    
    // Tab control buttons
    const addSwitchParentBtn = document.getElementById('addSwitchParentBtn');
    if (addSwitchParentBtn) {
      addSwitchParentBtn.addEventListener('click', () => this.addTabControlStep('switchToParent'));
    }
    const addCloseTabBtn = document.getElementById('addCloseTabBtn');
    if (addCloseTabBtn) {
      addCloseTabBtn.addEventListener('click', () => this.addTabControlStep('closeTab'));
    }
    
    // POM section handlers
    if (this.elements.pomToggle) {
      this.elements.pomToggle.addEventListener('click', () => {
        const content = this.elements.pomContent;
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
      });
    }
    if (this.elements.pomClassSelect) {
      this.elements.pomClassSelect.addEventListener('change', (e) => {
        const className = e.target.value;
        if (className && this.state.pageObjects?.[className]) {
          this.elements.pomPreview.textContent = this.state.pageObjects[className];
        }
      });
    }
    if (this.elements.copyPomBtn) {
      this.elements.copyPomBtn.addEventListener('click', () => this.copyPomClass());
    }
    if (this.elements.downloadPomBtn) {
      this.elements.downloadPomBtn.addEventListener('click', () => this.downloadAllPomClasses());
    }
    
    // Test Data section handlers
    if (this.elements.testDataToggle) {
      this.elements.testDataToggle.addEventListener('click', () => {
        const content = this.elements.testDataContent;
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
      });
    }
    if (this.elements.downloadTestDataBtn) {
      this.elements.downloadTestDataBtn.addEventListener('click', () => this.downloadTestData());
    }
    
    // Review tab event listeners
    this.elements.previewFormatBtn.addEventListener('click', () => this.generatePreview());
    this.elements.copyPreviewBtn.addEventListener('click', () => this.copyPreview());
    this.elements.downloadPreviewBtn.addEventListener('click', () => this.downloadPreview());
    // New simplified save/view buttons
    if (this.elements.saveWithAssertionsBtn) {
      this.elements.saveWithAssertionsBtn.addEventListener('click', () => this.saveRecordingWithAssertions());
    }
    if (this.elements.viewInTraceBtn) {
      this.elements.viewInTraceBtn.addEventListener('click', () => this.openTracePage());
    }
    
    // Auto-update badge when format changes
    this.elements.outputFormatSelect.addEventListener('change', (e) => {
      const formatLabels = {
        'python': 'Python',
        'typescript': 'TypeScript',
        'istqb': 'ISTQB',
        'gherkin': 'Gherkin',
        'markdown': 'Markdown'
      };
      this.elements.previewFormatBadge.textContent = formatLabels[e.target.value] || e.target.value;
      // Clear preview when format changes
      this.elements.scriptEditor.value = '';
      this.updateReviewButtons();
    });
    
    // Auto-suggest test case name based on start URL
    this.elements.testCaseName.addEventListener('focus', () => {
      if (!this.elements.testCaseName.value && this.state.startUrl) {
        try {
          const url = new URL(this.state.startUrl);
          const path = url.pathname.replace(/\//g, '_').replace(/^_|_$/g, '');
          this.elements.testCaseName.value = `Test_${path || 'home'}_${new Date().toISOString().slice(0, 10)}`;
        } catch (e) {}
      }
    });
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
      
      // Get actions from background
      const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
      if (actionsResponse) {
        this.state.actions = actionsResponse.actions || [];
      }
      
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
      this.elements.statusText.textContent = this.state.paused ? 'Paused' : 'Recording...';
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
      item.innerHTML = `
        <span class="action-number">${index + 1}</span>
        <div class="action-icon">${this.getActionIcon(action.type)}</div>
        <div class="action-details">
          <div class="action-type">${action.type}</div>
          <div class="action-selector">${action.description || this.getActionDescription(action)}</div>
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
    };
    return icons[type] || '⚡';
  }

  getActionDescription(action) {
    switch (action.type) {
      case 'click':
        return action.selector?.selector?.substring(0, 50) || 'Click element';
      case 'fill':
        return `Fill: "${(action.value || '').substring(0, 25)}..."`;
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
      
      this.addLog('success', 'Recording started');
    } catch (error) {
      console.error('[Sidebar] Failed to start recording:', error);
      this.addLog('error', 'Failed to start recording');
    }
  }

  async stopRecording() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      
      this.state.recording = false;
      this.state.paused = false;
      this.state.actions = response?.recording?.actions || [];
      this.state.script = '';
      
      this.updateUI();
      this.addLog('info', `Recording stopped. ${this.state.actions.length} actions captured.`);
    } catch (error) {
      console.error('[Sidebar] Failed to stop recording:', error);
      this.state.recording = false;
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
    if (this.state.actions.length === 0) {
      this.addLog('error', 'No actions to generate script from');
      return;
    }
    
    try {
      this.elements.generateBtn.disabled = true;
      this.elements.generateBtn.textContent = '⏳ Generating...';
      this.addLog('info', 'Generating script...');
      
      // Get fresh actions from background
      const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
      this.state.actions = actionsResponse?.actions || [];
      
      if (this.state.actions.length === 0) {
        this.addLog('error', 'No actions found');
        return;
      }
      
      // Check server connection
      if (!this.state.serverConnected) {
        await this.checkServerConnection();
      }
      
      if (!this.state.serverConnected) {
        // Generate locally via background script
        const response = await chrome.runtime.sendMessage({
          type: 'GENERATE_SCRIPT',
          options: { language: this.options.language }
        });
        
        if (response?.script) {
          this.state.script = response.script;
          this.addLog('success', 'Script generated (local)');
        } else {
          throw new Error('Failed to generate script locally');
        }
      } else {
        // Generate via backend API with all options
        const framework = this.options.language || 'playwright-python';
        const isPlaywright = framework.startsWith('playwright-');
        
        const generateOptions = {
          language: framework,
          // Advanced features
          selfHealing: this.options.selfHealing,
          smartWaits: this.options.smartWaits,
          screenshotOnFailure: this.options.screenshotOnFailure,
          generateAssertions: this.options.generateAssertions,
          // Enterprise features
          pageObjectModel: this.options.pageObjectModel,
          dataDriven: this.options.dataDriven,
          crossBrowser: this.options.crossBrowser,
          visualRegression: this.options.visualRegression,
        };
        
        // Use framework converter for non-Playwright frameworks
        // Use enhanced generator for Playwright with enterprise features
        let endpoint;
        let requestBody;
        
        // Get base URL from input (user-specified) or fallback to first action URL
        const baseUrl = this.elements.baseUrlInput?.value || this.state.actions[0]?.url || '';
        console.log('[Sidebar] Using base URL for test:', baseUrl);
        
        if (!isPlaywright) {
          // Use multi-framework converter
          endpoint = `${this.options.serverUrl}/api/flowstral/convert`;
          requestBody = {
            actions: this.state.actions,
            framework: framework,
            metadata: { 
              name: this.elements.testCaseName?.value || 'Recorded Test',
              startUrl: baseUrl,  // Use user-specified base URL
              appType: this.options.appType 
            },
            options: { pageObjectModel: this.options.pageObjectModel }
          };
        } else {
          const useEnhanced = this.options.pageObjectModel || this.options.dataDriven || 
                             this.options.crossBrowser || this.options.visualRegression;
          endpoint = useEnhanced 
            ? `${this.options.serverUrl}/api/flowstral/generate-enhanced-script`
            : `${this.options.serverUrl}/api/flowstral/generate`;
          requestBody = {
            actions: this.state.actions,
            metadata: { 
              startUrl: baseUrl,  // Use user-specified base URL
              appType: this.options.appType 
            },
            options: generateOptions
          };
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        this.state.script = result.script;
        
        // Store additional generated content
        if (result.page_objects && Object.keys(result.page_objects).length > 0) {
          this.state.pageObjects = result.page_objects;
          this.addLog('success', `Generated POM classes: ${Object.keys(result.page_objects).join(', ')}`);
        }
        if (result.test_data && result.test_data.length > 0) {
          this.state.testData = result.test_data;
          this.addLog('info', `Extracted ${result.test_data.length} data parameters`);
        }
        if (result.config) {
          this.state.crossBrowserConfig = result.config;
        }
        
        // Handle framework-specific response
        const frameworkName = result.framework || this.options.language;
        const features = result.metadata?.features || [];
        let logMsg = `Script generated for ${frameworkName} (${result.action_count || this.state.actions.length} actions)`;
        if (features.length > 0) {
          logMsg += ` [${features.join(', ')}]`;
        }
        if (result.dependencies?.length > 0) {
          this.addLog('info', `Dependencies: ${result.dependencies.join(', ')}`);
        }
        if (result.setup_instructions) {
          this.addLog('info', `Setup: ${result.setup_instructions}`);
        }
        this.addLog('success', logMsg);
      }
      
      this.updateUI();
      
      // Update POM and Test Data sections if they were generated
      this.updatePomSection();
      this.updateTestDataSection();
      
      // Switch to script tab
      document.querySelector('[data-tab="script"]').click();
      
    } catch (error) {
      console.error('[Sidebar] Failed to generate script:', error);
      this.addLog('error', `Generation failed: ${error.message}`);
    } finally {
      this.elements.generateBtn.disabled = this.state.actions.length === 0;
      this.elements.generateBtn.textContent = '⚡ Generate';
    }
  }

  // ============================================
  // TEST EXECUTION
  // ============================================

  async runTest() {
    if (!this.state.script) {
      this.addLog('error', 'No script to run. Generate a script first.');
      return;
    }
    
    // Check server connection
    if (!this.state.serverConnected) {
      await this.checkServerConnection();
    }
    
    if (!this.state.serverConnected) {
      this.addLog('error', 'Backend server not connected. Start the server first.');
      return;
    }
    
    try {
      this.state.running = true;
      this.updateUI();
      
      this.clearLogs();
      this.addLog('info', 'Starting test execution...');
      this.addLog('info', `Browser: ${this.options.browser}, Headed: ${this.options.showBrowser}`);
      
      // Update results UI
      this.elements.resultsTitle.innerHTML = '<span>⏳</span> Running test...';
      this.elements.resultsStats.classList.add('hidden');
      
      const startTime = Date.now();
      
      const response = await fetch(`${this.options.serverUrl}/api/flowstral/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: this.state.script,
          language: this.options.language,
          browser: this.options.browser,
          headless: !this.options.showBrowser,
          timeout: 60000
        })
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      const executionResult = result.execution_result || result;
      const status = executionResult.status || result.status;
      
      // Update results UI
      if (status === 'passed' || status === 'success') {
        this.elements.resultsTitle.innerHTML = '<span>✅</span> Test Passed';
        this.elements.passedCount.textContent = '1';
        this.elements.failedCount.textContent = '0';
        this.addLog('success', `Test passed in ${duration}s`);
      } else {
        this.elements.resultsTitle.innerHTML = '<span>❌</span> Test Failed';
        this.elements.passedCount.textContent = '0';
        this.elements.failedCount.textContent = '1';
        
        // Show detailed error information
        const errorMsg = executionResult.error || executionResult.stderr || executionResult.stdout || 'Unknown error';
        this.addLog('error', `Test failed: ${errorMsg.substring(0, 1000)}`);
        
        // Show full stderr if available
        if (executionResult.stderr) {
          const stderrLines = executionResult.stderr.split('\n').slice(0, 20); // First 20 lines
          stderrLines.forEach(line => {
            if (line.trim()) {
              this.addLog('error', line.substring(0, 200));
            }
          });
        }
        
        // Show stdout if available (might contain useful info)
        if (executionResult.stdout && !executionResult.stderr) {
          const stdoutLines = executionResult.stdout.split('\n').slice(0, 20);
          stdoutLines.forEach(line => {
            if (line.trim() && (line.includes('Error') || line.includes('error') || line.includes('Failed') || line.includes('Traceback'))) {
              this.addLog('error', line.substring(0, 200));
            }
          });
        }
        
        // Show error details if available
        if (executionResult.error_details && executionResult.error_details.length > 0) {
          executionResult.error_details.forEach(detail => {
            this.addLog('error', `Test: ${detail.test || 'Unknown'}`);
            this.addLog('error', `Error: ${detail.error || 'Unknown error'}`);
          });
        }
      }
      
      this.elements.duration.textContent = `${duration}s`;
      this.elements.resultsStats.classList.remove('hidden');
      
    } catch (error) {
      console.error('[Sidebar] Test execution failed:', error);
      this.elements.resultsTitle.innerHTML = '<span>❌</span> Execution Error';
      this.addLog('error', `Execution error: ${error.message}`);
    } finally {
      this.state.running = false;
      this.updateUI();
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

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
              title: this.elements.testCaseName.value || 'Recorded Test'
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
            testName: this.elements.testCaseName.value || 'Recorded Test',
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
    if (!this.state.actions || this.state.actions.length === 0) {
      this.addLog('error', 'No actions to export');
      return;
    }
    
    try {
      // Convert recorded actions to Workflow Editor node format
      const nodes = [];
      const startUrl = this.state.startUrl || '';
      
      // Add Navigate node first if we have a start URL
      if (startUrl) {
        nodes.push({
          id: 'node-navigate',
          type: 'navigate',
          label: 'Navigate',
          position: { x: 100, y: 50 },
          data: {
            url: startUrl,
            description: `Navigate to ${startUrl}`
          }
        });
      }
      
      // Convert each recorded action to a node
      this.state.actions.forEach((action, idx) => {
        const nodeType = this.mapActionTypeToNodeType ? 
          this.mapActionTypeToNodeType(action.type) : 
          (action.type === 'fill' ? 'input' : action.type || 'click');
        const yPos = 50 + ((startUrl ? idx + 1 : idx) * 80);
        
        nodes.push({
          id: `node-${idx + 1}`,
          type: nodeType,
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${action.text || action.description || ''}`.substring(0, 50),
          position: { x: 100, y: yPos },
          data: {
            selector: action.selectorObj?.playwright || action.selector || '',
            selectorMethod: 'playwright',
            value: action.value || '',
            description: action.description || action.text || '',
            url: action.url || ''
          }
        });
      });
      
      // Build the workflow state for the editor (include startUrl!)
      const workflowState = {
        workflowName: `Recording - ${new Date().toLocaleString()}`,
        appType: this.options.appType || 'generic',
        nodes: nodes,
        startUrl: startUrl  // Include startUrl for builder
      };
      
      console.log('[Sidebar] Exporting recorded actions to Test Builder:', workflowState, 'Total nodes:', nodes.length);
      
      // Get frontend URL
      const frontendUrl = this.options.frontendUrl || 'http://localhost:8080';
      const builderUrl = `${frontendUrl}/builder`;
      
      // Open the unified test builder tab
      const tab = await chrome.tabs.create({ url: builderUrl });
      
      // Wait for tab to load then inject the data into localStorage
      const self = this;
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Inject script to set localStorage (unified test case format)
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (data) => {
              console.log('[Test Builder Import] Importing from recording:', data);
              // Convert to unified test case format
              const unifiedTestCase = {
                id: `tc_${Date.now()}`,
                name: data.workflowName || 'Recorded Test',
                description: '',
                tags: [],
                steps: data.nodes.map((node, idx) => ({
                  id: `step_${Date.now()}_${idx}`,
                  type: node.type || 'click',
                  name: node.label || 'Step',
                  selector: node.data?.selector,
                  value: node.data?.value,
                  url: node.data?.url,
                  enabled: true,
                  expectedResult: node.data?.manualStep?.expectedResult || '',
                })),
                variables: [],
                settings: {
                  baseUrl: data.startUrl || '',
                  timeout: 30000,
                  retries: 0,
                  parallelizable: false,
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: 1,
                },
              };
              localStorage.setItem('unified_test_case', JSON.stringify(unifiedTestCase));
              setTimeout(() => window.location.reload(), 100);
            },
            args: [workflowState]
          }).then(() => {
            self.addLog('success', '✅ Recording loaded in Test Builder!');
          }).catch(err => {
            console.error('[Sidebar] Inject error:', err);
          });
        }
      });
      
      this.addLog('success', `Opening Test Builder with ${nodes.length} steps...`);
      
      if (this.elements.openWorkflowBtn) {
        const originalText = this.elements.openWorkflowBtn.textContent;
        this.elements.openWorkflowBtn.textContent = '✓ Opened';
        setTimeout(() => {
          this.elements.openWorkflowBtn.textContent = originalText;
        }, 2000);
      }
      
    } catch (error) {
      console.error('[Sidebar] Failed to open workflow editor:', error);
      this.addLog('error', `Failed to open workflow editor: ${error.message}`);
    }
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
    
    // Helper to make unique descriptions for duplicates
    const makeUniqueDescription = (baseDesc, element) => {
      const count = seenDescriptions.get(baseDesc) || 0;
      seenDescriptions.set(baseDesc, count + 1);
      
      if (count > 0 || element.duplicateIndex > 0) {
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
          context = `(${(element.duplicateIndex || count) + 1})`;
        }
        
        return `${baseDesc} ${context}`;
      }
      return baseDesc;
    };
    
    // Add ALL button suggestions (increased from 5 to 30)
    (analysis.buttons || []).slice(0, 30).forEach(btn => {
      if (!btn.disabled) {
        const baseDesc = `Click "${btn.text}" button`;
        suggestions.push({
          type: 'click',
          element: 'button',
          text: btn.text,
          selector: btn.selector,
          selectorObj: btn.selectorObj,
          description: makeUniqueDescription(baseDesc, btn),
          tagName: btn.tagName,
          id: btn.id,
          className: btn.className,
          name: btn.name,
          role: btn.role,
          ariaLabel: btn.ariaLabel,
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
      
      suggestions.push({
        type: 'click',
        element: 'link',
        text: link.text,
        selector: link.selector,
        selectorObj: link.selectorObj,
        description: makeUniqueDescription(baseDesc, link),
        tagName: link.tagName,
        id: link.id,
        className: link.className,
        ariaLabel: link.ariaLabel,
        href: link.href,
        location: link.location,
        duplicateIndex: link.duplicateIndex,
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
        'heading': 'HEADING'
      };
      
      const actionLabel = actionLabels[effectiveType] || effectiveType.toUpperCase();
      const elementLabel = elementLabels[suggestion.element] || suggestion.element?.toUpperCase() || '';
      
      // Location badge for context
      const locationBadge = suggestion.location && suggestion.location !== 'body' && suggestion.location !== 'main'
        ? `<span style="font-size: 9px; color: #667eea; margin-left: 4px;">[${suggestion.location}]</span>`
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
          <div class="suggestion-type">${actionLabel} ${elementLabel}${locationBadge}</div>
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
      value: suggestion.value || response?.value || null
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
  generateAutoAssertion(suggestion, response) {
    const type = suggestion.type || suggestion.element;
    
    // Default assertions based on action type
    const defaults = {
      'click': { enabled: true, type: 'visible', target: suggestion.selector },
      'fill': { enabled: true, type: 'value_equals', target: suggestion.selector, expected: suggestion.value || '' },
      'navigate': { enabled: true, type: 'url_contains', expected: suggestion.href || '' },
      'link': { enabled: true, type: 'url_contains', expected: suggestion.href || '' },
      'button': { enabled: true, type: 'visible', target: suggestion.selector },
      'checkbox': { enabled: true, type: 'checked', target: suggestion.selector },
      'radio': { enabled: true, type: 'checked', target: suggestion.selector },
      'select': { enabled: true, type: 'value_equals', target: suggestion.selector, expected: '' },
    };
    
    return defaults[type] || { enabled: false, type: 'visible' };
  }
  
  /**
   * Generate manual action description
   */
  generateManualAction(suggestion) {
    const type = suggestion.type || suggestion.element;
    const text = suggestion.text || suggestion.label || suggestion.description;
    
    switch (type) {
      case 'click':
      case 'button':
        return `Click on "${text}"`;
      case 'link':
        return `Click on link "${text}"`;
      case 'fill':
      case 'input':
        return `Enter "${suggestion.value || '...'}" in ${text}`;
      case 'checkbox':
        return `Check/uncheck "${text}"`;
      case 'radio':
        return `Select radio option "${text}"`;
      case 'select':
        return `Select option from "${text}"`;
      case 'navigate':
        return `Navigate to ${suggestion.href || 'the target page'}`;
      default:
        return `Interact with "${text}"`;
    }
  }
  
  /**
   * Generate expected result description
   */
  generateExpectedResult(suggestion, assertion) {
    if (!assertion || !assertion.enabled) {
      return 'Step completes successfully';
    }
    
    const type = assertion.type;
    const expected = assertion.expected || '';
    
    const descriptions = {
      'visible': 'Element is visible on the page',
      'hidden': 'Element is no longer visible',
      'enabled': 'Element is enabled and clickable',
      'disabled': 'Element is disabled',
      'text_equals': `Text equals "${expected}"`,
      'text_contains': `Text contains "${expected}"`,
      'url_equals': `URL is "${expected}"`,
      'url_contains': `URL contains "${expected}"`,
      'title_equals': `Page title is "${expected}"`,
      'title_contains': `Page title contains "${expected}"`,
      'element_count': `Element count is ${expected}`,
      'value_equals': `Input value is "${expected}"`,
      'checked': 'Checkbox/radio is checked',
      'not_checked': 'Checkbox/radio is unchecked',
    };
    
    return descriptions[type] || 'Assertion passes';
  }
  
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
  async saveAsUnifiedTestCase() {
    if (this.workflowSteps.length === 0) {
      this.addLog('error', 'No steps in workflow');
      return;
    }
    
    try {
      const serverUrl = this.elements.serverUrl?.value || 'http://localhost:8000';
      const testCaseName = `Test Case - ${new Date().toLocaleString()}`;
      
      // Build unified test case with both manual steps and automation data
      // Format matches backend schema - NOW WITH ASSERTIONS
      const testCase = {
        name: testCaseName,
        description: `Recorded test with ${this.workflowSteps.length} steps. Can be run in Manual or Automated mode. Includes ${this.workflowSteps.filter(s => s.assertion?.enabled).length} assertions.`,
        testType: 'unified',  // Can be run in manual OR automated mode
        priority: 'medium',
        status: 'active',
        
        // Steps in backend expected format WITH ASSERTIONS
        steps: this.workflowSteps.map((step, idx) => ({
          stepNumber: idx + 1,
          action: step.manualStep?.action || this.getManualTestAction(step),
          expectedResult: step.manualStep?.expectedResult || this.getExpectedResult(step),
          testData: step.value || '',
          
          // Include automation data in each step
          automationData: {
            actionType: step.type || 'click',
            selector: step.selectorObj || { playwright: step.selector },
            elementType: step.element,
            text: step.text,
            value: step.value,
            opensNewTab: step.opensNewTab || false
          },
          
          // NEW: Include assertion config for code generation
          assertion: step.assertion || { enabled: false },
          
          // NEW: Manual step description from workflow
          manualStep: step.manualStep
        })),
        
        // NEW: All assertions summary
        assertions: this.workflowSteps
          .filter(s => s.assertion?.enabled)
          .map(s => ({
            step: s.text || s.description,
            type: s.assertion.type,
            expected: s.assertion.expected || '',
            description: this.generateExpectedResult(s, s.assertion)
          })),
        
        // Automation metadata
        automationConfig: {
          startUrl: this.state.startUrl || this.state.pageAnalysis?.url || '',
          framework: 'playwright',
          canRunAutomated: true,
          canRunManual: true,
          hasAssertions: this.workflowSteps.some(s => s.assertion?.enabled)
        },
        
        // Tags for filtering
        tags: ['recorded', 'unified', 'can-automate', 'has-assertions'],
        
        // Source tracking
        source: 'flowstral-recorder'
      };
      
      this.addLog('info', 'Saving test case to backend...');
      
      // Save to backend - try /test-cases endpoint
      const response = await fetch(`${serverUrl}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      
      if (response.ok) {
        const result = await response.json();
        this.addLog('success', `✅ Test Case saved! ID: ${result.id || result.test_case_id || 'new'}`);
        
        // Also generate script for preview
        await this.generateScriptFromWorkflow();
        
        return result;
      } else {
        const errorText = await response.text();
        console.error('[Sidebar] Backend error:', errorText);
        this.addLog('error', 'Backend error: ' + (response.statusText || 'Failed to save'));
        
        // Try alternative endpoint
        await this.saveToAlternativeEndpoint(testCase);
      }
    } catch (error) {
      console.error('[Sidebar] Save test case error:', error);
      this.addLog('error', 'Could not save: ' + error.message);
      
      // Still generate script locally
      await this.generateScriptFromWorkflow();
    }
  }
  
  /**
   * Try alternative endpoints if main one fails
   */
  async saveToAlternativeEndpoint(testCase) {
    const serverUrl = this.elements.serverUrl?.value || 'http://localhost:8000';
    
    // Try flowstral recordings endpoint
    try {
      const recording = {
        name: testCase.name,
        description: testCase.description,
        start_url: testCase.automation_data.start_url,
        actions: testCase.automation_data.actions,
        manual_steps: testCase.manual_steps,
        status: 'pending_review',
        test_type: 'unified'
      };
      
      const response = await fetch(`${serverUrl}/api/flowstral/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recording)
      });
      
      if (response.ok) {
        const result = await response.json();
        this.addLog('success', `✅ Saved as recording! ID: ${result.id}`);
        return result;
      }
    } catch (e) {
      console.warn('[Sidebar] Alternative endpoint also failed:', e);
    }
    
    this.addLog('info', 'Saved locally (backend unavailable)');
  }
  
  /**
   * Open the workflow in the website's Workflow Editor
   * Converts workflow steps to Workflow Editor format and loads them
   */
  async openInWorkflowEditor() {
    // Check for workflow steps from Suggest tab
    const steps = this.workflowSteps || [];
    // Also check recorded actions from Record tab
    const actions = this.state.actions || [];
    
    const hasWorkflow = steps.length > 0 || actions.length > 0;
    
    if (!hasWorkflow) {
      this.addLog('error', 'No steps or actions to export');
      return;
    }
    
    try {
      // Convert to Workflow Editor node format
      const nodes = [];
      // Use recording startUrl first, then page analysis URL as fallback
      const startUrl = this.state.startUrl || this.state.pageAnalysis?.url || '';
      
      // Add Navigate node first if we have a URL
      if (startUrl) {
        nodes.push({
          id: 'node-navigate',
          type: 'navigate',
          label: 'Navigate',
          position: { x: 100, y: 50 },
          data: {
            url: startUrl,
            description: `Navigate to ${startUrl}`
          }
        });
      }
      
      // Convert workflow steps (from Suggest tab) with assertion support
      steps.forEach((step, idx) => {
        const nodeType = this.mapStepTypeToNodeType(step.type || 'click');
        const yPos = 50 + ((idx + 1) * 80);
        
        nodes.push({
          id: `node-${idx + 1}`,
          type: nodeType,
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${step.text || step.description || ''}`.substring(0, 50),
          position: { x: 100, y: yPos },
          data: {
            selector: step.selectorObj?.playwright || step.selector || '',
            selectorMethod: 'playwright',
            value: step.value || '',
            description: step.description || step.text || '',
            assertType: nodeType === 'assert' ? 'visible' : undefined,
            // NEW: Include assertion data for unified test case support
            assertion: step.assertion || {
              enabled: false,
              type: 'visible',
              target: step.selectorObj?.playwright || step.selector || ''
            },
            // NEW: Include manual step data
            manualStep: step.manualStep || {
              action: this.generateManualAction(step),
              expectedResult: step.assertion?.enabled ? 
                this.generateExpectedResult(step, step.assertion) : 
                'Step completes successfully'
            }
          }
        });
      });
      
      // Convert recorded actions (from Record tab) if no workflow steps - with assertion support
      if (steps.length === 0 && actions.length > 0) {
        actions.forEach((action, idx) => {
          const nodeType = this.mapActionTypeToNodeType(action.type);
          const yPos = 50 + ((idx + 1) * 80);
          
          // Generate auto-assertion based on action type
          const autoAssertion = this.generateAutoAssertion(action, {});
          
          nodes.push({
            id: `node-${idx + 1}`,
            type: nodeType,
            label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${action.text || action.description || ''}`.substring(0, 50),
            position: { x: 100, y: yPos },
            data: {
              selector: action.selectorObj?.playwright || action.selector || '',
              selectorMethod: 'playwright',
              value: action.value || '',
              description: action.description || action.text || '',
              // NEW: Include assertion data
              assertion: action.assertion || autoAssertion,
              // NEW: Include manual step data
              manualStep: action.manualStep || {
                action: this.generateManualAction(action),
                expectedResult: this.generateExpectedResult(action, autoAssertion)
              }
            }
          });
        });
      }
      
      // Build the workflow state (include startUrl!)
      const workflowState = {
        workflowName: `Recorded Workflow - ${new Date().toLocaleString()}`,
        appType: this.options.appType || 'generic',
        nodes: nodes,
        startUrl: startUrl  // Include startUrl for builder
      };
      
      console.log('[Sidebar] Exporting to Test Builder:', workflowState, 'Total nodes:', nodes.length);
      
      // Get frontend URL
      const frontendUrl = this.options.frontendUrl || 'http://localhost:8080';
      const builderUrl = `${frontendUrl}/builder`;
      
      this.addLog('info', `Opening Test Builder with ${nodes.length} steps...`);
      
      // Open the unified test builder tab first
      const tab = await chrome.tabs.create({ url: builderUrl });
      
      // Wait for tab to load, then inject data into localStorage
      const self = this;
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Inject script to set localStorage (unified test case format)
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (data) => {
              console.log('[Test Builder Import] Importing workflow:', data);
              // Convert to unified test case format
              const unifiedTestCase = {
                id: `tc_${Date.now()}`,
                name: data.workflowName || 'Recorded Test',
                description: '',
                tags: [],
                steps: data.nodes.map((node, idx) => ({
                  id: `step_${Date.now()}_${idx}`,
                  type: node.type || 'click',
                  name: node.label || 'Step',
                  selector: node.data?.selector,
                  value: node.data?.value,
                  url: node.data?.url,
                  enabled: true,
                  expectedResult: node.data?.manualStep?.expectedResult || '',
                })),
                variables: [],
                settings: {
                  baseUrl: data.startUrl || '',
                  timeout: 30000,
                  retries: 0,
                  parallelizable: false,
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  version: 1,
                },
              };
              localStorage.setItem('unified_test_case', JSON.stringify(unifiedTestCase));
              // Reload to pick up the new state
              setTimeout(() => window.location.reload(), 100);
            },
            args: [workflowState]
          }).then(() => {
            self.addLog('success', '✅ Test loaded in builder!');
          }).catch(err => {
            console.error('[Sidebar] Inject error:', err);
            self.addLog('error', 'Could not import: ' + err.message);
          });
        }
      });
      
    } catch (error) {
      console.error('[Sidebar] Open test builder error:', error);
      this.addLog('error', 'Failed to open: ' + error.message);
      
      // Try to open anyway
      const frontendUrl = this.options.frontendUrl || 'http://localhost:8080';
      chrome.tabs.create({ url: `${frontendUrl}/builder` });
    }
  }
  
  /**
   * Map step type to workflow editor node type
   */
  mapStepTypeToNodeType(stepType) {
    const typeMap = {
      'click': 'click',
      'fill': 'input',
      'type': 'input',
      'input': 'input',
      'navigate': 'navigate',
      'goto': 'navigate',
      'wait': 'wait',
      'assert': 'assert',
      'assertion': 'assert',
      'switchToParent': 'navigate',
      'closeTab': 'navigate'
    };
    return typeMap[stepType] || 'click';
  }
  
  /**
   * Map action type to workflow editor node type
   */
  mapActionTypeToNodeType(actionType) {
    const typeMap = {
      'click': 'click',
      'fill': 'input',
      'type': 'input',
      'select': 'input',
      'check': 'click',
      'uncheck': 'click',
      'navigate': 'navigate',
      'goto': 'navigate',
      'wait': 'wait',
      'waitForSelector': 'wait',
      'assert': 'assert',
      'expect': 'assert'
    };
    return typeMap[actionType] || 'click';
  }
  
  // ============================================================================
  // SYNTHETIC TEST DATA GENERATION
  // ============================================================================
  
  /**
   * Generate synthetic test data for all form fields on the page
   */
  async generateTestData() {
    this.addLog('info', '🎲 Generating test data...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.addLog('error', 'No active tab found');
        return;
      }
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GENERATE_TEST_DATA'
      }, { frameId: 0 });
      
      if (response?.success && response.testData) {
        this.generatedTestData = response.testData;
        this.renderTestData(response.testData);
        this.addLog('success', `✅ Generated data for ${response.testData.length} fields`);
      } else {
        // Fallback: generate from suggestions if content script fails
        this.generateTestDataFromSuggestions();
      }
    } catch (error) {
      console.error('[Sidebar] Generate test data error:', error);
      // Fallback: use suggestions
      this.generateTestDataFromSuggestions();
    }
  }
  
  /**
   * Fallback: Generate test data from already collected suggestions
   */
  generateTestDataFromSuggestions() {
    const inputSuggestions = (this.state.suggestions || []).filter(s => 
      s.element === 'input' || s.actionType === 'fill'
    );
    
    if (inputSuggestions.length === 0) {
      this.addLog('warning', 'No input fields found. Run Refresh Analysis first.');
      return;
    }
    
    const testData = inputSuggestions.map(input => {
      const fieldType = this.detectFieldType(input);
      return {
        fieldName: input.text || input.label || 'field',
        fieldType: fieldType,
        selector: input.selectorObj?.playwright || input.selector,
        value: this.generateValue(fieldType),
        alternatives: [
          this.generateValue(fieldType),
          this.generateValue(fieldType),
          this.generateValue(fieldType)
        ],
        confidence: input.syntheticData?.confidence || 0.7
      };
    });
    
    this.generatedTestData = testData;
    this.renderTestData(testData);
    this.addLog('success', `✅ Generated data for ${testData.length} fields (from suggestions)`);
  }
  
  /**
   * Detect field type from input suggestion
   */
  detectFieldType(input) {
    if (input.syntheticData?.detectedType) return input.syntheticData.detectedType;
    
    const text = `${input.text || ''} ${input.label || ''} ${input.name || ''}`.toLowerCase();
    
    if (/email/.test(text)) return 'email';
    if (/phone|tel|mobile/.test(text)) return 'phone';
    if (/first\s*name/.test(text)) return 'firstName';
    if (/last\s*name/.test(text)) return 'lastName';
    if (/name/.test(text) && !/user|company|org/.test(text)) return 'fullName';
    if (/password/.test(text)) return 'password';
    if (/company|org/.test(text)) return 'company';
    if (/street|address/.test(text)) return 'street';
    if (/city/.test(text)) return 'city';
    if (/state/.test(text)) return 'state';
    if (/zip|postal/.test(text)) return 'zipCode';
    // Date components - check BEFORE generic date
    if (/\bmonth\b|mes\b/.test(text)) return 'month';
    if (/\bday\b|dia\b/.test(text)) return 'day';
    if (/\byear\b|año\b/.test(text)) return 'year';
    if (/\bdob\b|birth\s*date|date.*birth/.test(text)) return 'birthDate';
    if (/gender|sex/.test(text)) return 'gender';
    if (/date/.test(text)) return 'date';
    if (/amount|price/.test(text)) return 'currency';
    
    return 'text';
  }
  
  /**
   * Generate a value for a field type
   */
  generateValue(fieldType) {
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const currentYear = new Date().getFullYear();
    
    // Get any user-defined constraints for this field type
    const constraint = this.getDataConstraint(fieldType) || {};
    
    // If constraint has options (dropdown), pick from them
    if (constraint.options?.length > 0) {
      const opt = constraint.options[randomNum(0, constraint.options.length - 1)];
      return opt.value || opt.text || opt;
    }
    
    const generators = {
      email: () => `test.user${uniqueId}@example.com`,
      phone: () => `+1${randomNum(200, 999)}${randomNum(200, 999)}${randomNum(1000, 9999)}`,
      firstName: () => ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily'][randomNum(0, 5)],
      lastName: () => ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'][randomNum(0, 5)],
      fullName: () => `${generators.firstName()} ${generators.lastName()}`,
      username: () => `user_${uniqueId}`,
      password: () => `Test@${uniqueId}123!`,
      company: () => ['Acme Corp', 'TechStart Inc', 'Global Solutions'][randomNum(0, 2)],
      street: () => `${randomNum(100, 9999)} ${['Main St', 'Oak Ave', 'Maple Dr'][randomNum(0, 2)]}`,
      city: () => ['New York', 'Los Angeles', 'Chicago', 'Houston'][randomNum(0, 3)],
      state: () => {
        // Use constraint options if set, else default
        if (constraint.options) {
          const opt = constraint.options[randomNum(0, constraint.options.length - 1)];
          return opt.value || opt;
        }
        return ['CA', 'TX', 'FL', 'NY', 'PA'][randomNum(0, 4)];
      },
      zipCode: () => `${randomNum(10000, 99999)}`,
      // Date components with constraint support
      month: () => {
        const min = constraint.min || 1;
        const max = constraint.max || 12;
        return `${randomNum(min, max)}`;
      },
      day: () => {
        const min = constraint.min || 1;
        const max = constraint.max || 28;
        return `${randomNum(min, max)}`;
      },
      year: () => {
        // Use minAge/maxAge constraints
        const minAge = constraint.minAge || constraint.min || 18;
        const maxAge = constraint.maxAge || constraint.max || 65;
        return `${currentYear - randomNum(minAge, maxAge)}`;
      },
      birthDate: () => {
        const minAge = constraint.minAge || 18;
        const maxAge = constraint.maxAge || 65;
        const y = currentYear - randomNum(minAge, maxAge);
        const m = randomNum(1, 12).toString().padStart(2, '0');
        const d = randomNum(1, 28).toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
      },
      gender: () => ['Male', 'Female', 'Other'][randomNum(0, 2)],
      age: () => {
        const min = constraint.minAge || constraint.min || 18;
        const max = constraint.maxAge || constraint.max || 80;
        return `${randomNum(min, max)}`;
      },
      date: () => new Date(Date.now() + randomNum(-365, 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: () => {
        const min = constraint.min || 10;
        const max = constraint.max || 10000;
        return `${randomNum(min, max)}.${randomNum(0, 99).toString().padStart(2, '0')}`;
      },
      number: () => {
        const min = constraint.min || 1;
        const max = constraint.max || 1000;
        return `${randomNum(min, max)}`;
      },
      text: () => ['Test input', 'Sample data', 'Lorem ipsum', 'Test entry'][randomNum(0, 3)]
    };
    
    return (generators[fieldType] || generators.text)();
  }
  
  /**
   * Render test data in the UI
   */
  renderTestData(testData) {
    const container = document.getElementById('testDataList');
    const section = document.getElementById('testDataSection');
    
    if (!container || !section) return;
    
    // Show section
    section.style.display = 'block';
    
    if (!testData || testData.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No test data generated</p></div>';
      return;
    }
    
    container.innerHTML = testData.map((data, idx) => `
      <div class="action-item" style="padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 500; color: #fff; font-size: 12px;">
            ${this.escapeHtml(data.fieldName)}
          </span>
          <span style="font-size: 10px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px;">
            ${data.fieldType}
          </span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <input type="text" value="${this.escapeHtml(data.value)}" 
                 class="form-control test-data-input" 
                 data-index="${idx}"
                 style="flex: 1; font-size: 11px; padding: 4px 8px;"
          />
          <button class="btn btn-sm regenerate-btn" data-index="${idx}" data-type="${data.fieldType}" title="Regenerate">🔄</button>
          <button class="btn btn-sm use-value-btn" data-index="${idx}" title="Use this value">✓</button>
        </div>
        ${data.confidence < 0.7 ? `<div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">⚠️ Low confidence detection</div>` : ''}
      </div>
    `).join('');
    
    // Add event listeners for regenerate buttons
    container.querySelectorAll('.regenerate-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const fieldType = e.target.dataset.type;
        const newValue = this.generateValue(fieldType);
        const input = container.querySelector(`input[data-index="${idx}"]`);
        if (input) {
          input.value = newValue;
          this.generatedTestData[idx].value = newValue;
        }
      });
    });
    
    // Add event listeners for use value buttons
    container.querySelectorAll('.use-value-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.target.dataset.index);
        const data = this.generatedTestData[idx];
        const input = container.querySelector(`input[data-index="${idx}"]`);
        const value = input?.value || data.value;
        
        // Try to fill the field on the page
        await this.fillFieldWithValue(data, value);
      });
    });
  }
  
  /**
   * Fill a field on the page with the generated value
   */
  async fillFieldWithValue(fieldData, value) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_FIELD',
        selector: fieldData.selector,
        value: value
      }, { frameId: 0 });
      
      this.addLog('success', `Filled "${fieldData.fieldName}" with value`);
    } catch (error) {
      console.error('[Sidebar] Fill field error:', error);
      this.addLog('error', 'Could not fill field: ' + error.message);
    }
  }
  
  /**
   * Copy test data as JSON
   */
  copyTestDataAsJSON() {
    if (!this.generatedTestData || this.generatedTestData.length === 0) {
      this.addLog('warning', 'No test data to copy');
      return;
    }
    
    const jsonData = JSON.stringify(this.generatedTestData.map(d => ({
      field: d.fieldName,
      type: d.fieldType,
      value: d.value,
      selector: d.selector
    })), null, 2);
    
    navigator.clipboard.writeText(jsonData).then(() => {
      this.addLog('success', '📋 Test data copied to clipboard!');
    }).catch(err => {
      console.error('[Sidebar] Copy error:', err);
    });
  }
  
  /**
   * Download test data as CSV
   */
  downloadTestDataAsCSV() {
    if (!this.generatedTestData || this.generatedTestData.length === 0) {
      this.addLog('warning', 'No test data to download');
      return;
    }
    
    // Build CSV content
    const headers = ['Field Name', 'Field Type', 'Value', 'Alt Value 1', 'Alt Value 2', 'Selector'];
    const rows = this.generatedTestData.map(d => [
      d.fieldName,
      d.fieldType,
      d.value,
      d.alternatives?.[0] || '',
      d.alternatives?.[1] || '',
      d.selector || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_data_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.addLog('success', '📥 Test data downloaded as CSV!');
  }
  
  /**
   * Clear test data
   */
  clearTestData() {
    this.generatedTestData = [];
    const section = document.getElementById('testDataSection');
    const container = document.getElementById('testDataList');
    
    if (section) section.style.display = 'none';
    if (container) container.innerHTML = '';
    
    this.addLog('info', 'Test data cleared');
  }
  
  // ============================================================================
  // DATA CONSTRAINTS MANAGEMENT
  // ============================================================================
  
  /**
   * Open the constraints modal
   */
  openConstraintsModal() {
    const modal = document.getElementById('constraintsModal');
    if (modal) {
      modal.style.display = 'flex';
      this.loadActiveConstraints();
    }
  }
  
  /**
   * Close the constraints modal
   */
  closeConstraintsModal() {
    const modal = document.getElementById('constraintsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  /**
   * Apply a preset constraint configuration
   */
  async applyPreset(presetName) {
    const presets = {
      'adult18-35': {
        year: { minAge: 18, maxAge: 35, description: 'Age 18-35 years' },
        birthDate: { minAge: 18, maxAge: 35 }
      },
      'adult18-65': {
        year: { minAge: 18, maxAge: 65, description: 'Age 18-65 years' },
        birthDate: { minAge: 18, maxAge: 65 }
      },
      'senior65+': {
        year: { minAge: 65, maxAge: 100, description: 'Age 65+ years' },
        birthDate: { minAge: 65, maxAge: 100 }
      },
      'usStates': {
        state: { 
          options: [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
          ].map(s => ({ value: s, text: s })),
          description: 'All 50 US States'
        }
      }
    };
    
    const preset = presets[presetName];
    if (!preset) return;
    
    // Save constraints
    this.dataConstraints = { ...this.dataConstraints, ...preset };
    this.saveDataConstraints();
    
    // Update UI
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });
    
    this.loadActiveConstraints();
    this.addLog('success', `Applied preset: ${presetName}`);
  }
  
  /**
   * Add a custom constraint from the modal form
   */
  addConstraint() {
    const fieldType = document.getElementById('constraintFieldType')?.value;
    const minVal = document.getElementById('constraintMin')?.value;
    const maxVal = document.getElementById('constraintMax')?.value;
    
    if (!fieldType) {
      this.addLog('error', 'Please select a field type');
      return;
    }
    
    const constraint = {};
    if (minVal) {
      constraint.minAge = parseInt(minVal);
      constraint.min = parseInt(minVal);
    }
    if (maxVal) {
      constraint.maxAge = parseInt(maxVal);
      constraint.max = parseInt(maxVal);
    }
    
    if (Object.keys(constraint).length === 0) {
      this.addLog('error', 'Please enter min or max value');
      return;
    }
    
    constraint.description = `${fieldType}: ${minVal || '?'} - ${maxVal || '?'}`;
    
    // Save constraint
    if (!this.dataConstraints) this.dataConstraints = {};
    this.dataConstraints[fieldType] = constraint;
    this.saveDataConstraints();
    
    // Clear form
    document.getElementById('constraintFieldType').value = '';
    document.getElementById('constraintMin').value = '';
    document.getElementById('constraintMax').value = '';
    
    this.loadActiveConstraints();
    this.addLog('success', `Added rule for ${fieldType}`);
  }
  
  /**
   * Load and display active constraints
   */
  loadActiveConstraints() {
    // Load from storage if not loaded
    if (!this.dataConstraints) {
      const stored = localStorage.getItem('qaai_sidebar_constraints');
      this.dataConstraints = stored ? JSON.parse(stored) : {};
    }
    
    const container = document.getElementById('activeConstraintsList');
    if (!container) return;
    
    const constraints = this.dataConstraints;
    const keys = Object.keys(constraints);
    
    if (keys.length === 0) {
      container.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 11px; padding: 8px;">No rules set</div>';
      return;
    }
    
    container.innerHTML = keys.map(key => {
      const c = constraints[key];
      let desc = c.description || '';
      if (!desc) {
        if (c.minAge || c.maxAge) {
          desc = `Age ${c.minAge || '?'} - ${c.maxAge || '?'}`;
        } else if (c.min || c.max) {
          desc = `${c.min || '?'} - ${c.max || '?'}`;
        } else if (c.options) {
          desc = `${c.options.length} options`;
        }
      }
      
      return `
        <div class="constraint-item">
          <span><strong>${key}</strong>: ${desc}</span>
          <button class="remove-btn" data-key="${key}" title="Remove">✕</button>
        </div>
      `;
    }).join('');
    
    // Add remove handlers
    container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        delete this.dataConstraints[key];
        this.saveDataConstraints();
        this.loadActiveConstraints();
        this.addLog('info', `Removed rule for ${key}`);
      });
    });
  }
  
  /**
   * Save constraints to localStorage
   */
  saveDataConstraints() {
    localStorage.setItem('qaai_sidebar_constraints', JSON.stringify(this.dataConstraints || {}));
  }
  
  /**
   * Get constraint for a field when generating data
   */
  getDataConstraint(fieldType) {
    if (!this.dataConstraints) {
      const stored = localStorage.getItem('qaai_sidebar_constraints');
      this.dataConstraints = stored ? JSON.parse(stored) : {};
    }
    return this.dataConstraints[fieldType] || null;
  }
  
  /**
   * Generate script from current workflow steps - WITH ASSERTIONS
   */
  async generateScriptFromWorkflow() {
    try {
      // Convert workflow to actions format - INCLUDING ASSERTIONS
      const actions = this.workflowSteps.map((step, idx) => ({
        type: step.type || 'click',
        selector: step.selectorObj || { playwright: step.selector },
        element: step.element,
        text: step.text,
        value: step.value,
        description: step.description,
        tagName: step.element === 'link' ? 'a' : step.element === 'button' ? 'button' : 'div',
        href: step.href,
        opensNewTab: step.opensNewTab,
        timestamp: step.timestamp,
        // NEW: Include assertion data for script generation
        assertion: step.assertion || { enabled: false },
        manualStep: step.manualStep
      }));
      
      // Save to background for script generation
      await chrome.runtime.sendMessage({
        type: 'SAVE_WORKFLOW',
        workflow: {
          name: `Workflow ${new Date().toLocaleString()}`,
          steps: actions,
          startUrl: this.state.startUrl || this.state.pageAnalysis?.url || '',
          createdAt: Date.now(),
          // NEW: Include assertions summary
          hasAssertions: actions.some(a => a.assertion?.enabled),
          assertionCount: actions.filter(a => a.assertion?.enabled).length
        }
      });
      
      // Update local state
      this.state.actions = actions;
      
      // Enable generate button
      if (this.elements.generateBtn) {
        this.elements.generateBtn.disabled = false;
      }
      
      // Switch to Script tab and generate
      const scriptTab = document.querySelector('[data-tab="script"]');
      if (scriptTab) scriptTab.click();
      
      setTimeout(() => this.generateScript(), 300);
      
    } catch (error) {
      console.error('[Sidebar] Generate script error:', error);
    }
  }
  
  /**
   * Generate Playwright assertion code for a step
   */
  generateAssertionCode(assertion, selector, language = 'python') {
    if (!assertion?.enabled) return '';
    
    const target = assertion.target || selector || '';
    const expected = assertion.expected || '';
    
    if (language === 'python') {
      switch (assertion.type) {
        case 'visible': return `    expect(${target}).to_be_visible()`;
        case 'hidden': return `    expect(${target}).to_be_hidden()`;
        case 'enabled': return `    expect(${target}).to_be_enabled()`;
        case 'disabled': return `    expect(${target}).to_be_disabled()`;
        case 'text_equals': return `    expect(${target}).to_have_text("${expected}")`;
        case 'text_contains': return `    expect(${target}).to_contain_text("${expected}")`;
        case 'url_equals': return `    expect(page).to_have_url("${expected}")`;
        case 'url_contains': return `    expect(page.url).to_contain("${expected}")`;
        case 'title_equals': return `    expect(page).to_have_title("${expected}")`;
        case 'title_contains': return `    expect(page.title()).to_contain("${expected}")`;
        case 'element_count': return `    expect(${target}).to_have_count(${expected})`;
        case 'value_equals': return `    expect(${target}).to_have_value("${expected}")`;
        case 'checked': return `    expect(${target}).to_be_checked()`;
        case 'not_checked': return `    expect(${target}).not_to_be_checked()`;
        default: return '';
      }
    } else {
      // TypeScript
      switch (assertion.type) {
        case 'visible': return `    await expect(${target}).toBeVisible();`;
        case 'hidden': return `    await expect(${target}).toBeHidden();`;
        case 'enabled': return `    await expect(${target}).toBeEnabled();`;
        case 'disabled': return `    await expect(${target}).toBeDisabled();`;
        case 'text_equals': return `    await expect(${target}).toHaveText('${expected}');`;
        case 'text_contains': return `    await expect(${target}).toContainText('${expected}');`;
        case 'url_equals': return `    await expect(page).toHaveURL('${expected}');`;
        case 'url_contains': return `    await expect(page.url()).toContain('${expected}');`;
        case 'title_equals': return `    await expect(page).toHaveTitle('${expected}');`;
        case 'title_contains': return `    await expect(await page.title()).toContain('${expected}');`;
        case 'element_count': return `    await expect(${target}).toHaveCount(${expected});`;
        case 'value_equals': return `    await expect(${target}).toHaveValue('${expected}');`;
        case 'checked': return `    await expect(${target}).toBeChecked();`;
        case 'not_checked': return `    await expect(${target}).not.toBeChecked();`;
        default: return '';
      }
    }
  }
  
  /**
   * Save workflow as automated scenario/test
   */
  async saveWorkflowAsScenario() {
    if (this.workflowSteps.length === 0) {
      this.addLog('error', 'No steps in workflow');
      return;
    }
    
    try {
      // Convert workflow steps to recording actions format
      const actions = this.workflowSteps.map(step => ({
        type: step.type || 'click',
        selector: step.selectorObj || { playwright: step.selector },
        value: step.value,
        description: step.description || `${step.type} "${step.text}"`,
        timestamp: step.timestamp,
        text: step.text,
        opensNewTab: step.opensNewTab || false
      }));
      
      const workflowData = {
        name: `Flow ${new Date().toLocaleString()}`,
        steps: actions,
        startUrl: this.state.startUrl || this.state.pageAnalysis?.url || 'Unknown',
        createdAt: Date.now()
      };
      
      // Send to background to save as recording (for script generation)
      await chrome.runtime.sendMessage({
        type: 'SAVE_WORKFLOW',
        workflow: workflowData
      });
      
      // Also update local state.actions for script generation
      this.state.actions = actions;
      
      this.addLog('success', `Saved scenario with ${actions.length} steps`);
      
      // Also save to website backend if server is connected
      await this.saveToWebsiteWorkflowEditor(workflowData);
      
      // Enable the generate button
      if (this.elements.generateBtn) {
        this.elements.generateBtn.disabled = false;
      }
      
      // Switch to Script tab
      const scriptTab = document.querySelector('[data-tab="script"]');
      if (scriptTab) scriptTab.click();
      
      // Auto-generate script after short delay
      setTimeout(() => {
        this.generateScript();
      }, 300);
      
    } catch (error) {
      console.error('[Sidebar] Save scenario error:', error);
      this.addLog('error', 'Failed to save scenario: ' + error.message);
    }
  }
  
  /**
   * Save workflow to website backend for viewing in Workflow Editor
   */
  async saveToWebsiteWorkflowEditor(workflowData) {
    try {
      const serverUrl = this.elements.serverUrl?.value || 'http://localhost:8000';
      
      // Convert to flowstral recording format for backend
      const recording = {
        name: workflowData.name,
        description: `Recorded workflow with ${workflowData.steps.length} steps`,
        start_url: workflowData.startUrl,
        actions: workflowData.steps.map((step, idx) => ({
          action_number: idx + 1,
          action_type: step.type || 'click',
          selector: typeof step.selector === 'object' ? step.selector : { playwright: step.selector },
          value: step.value || null,
          description: step.description,
          timestamp: step.timestamp,
          opens_new_tab: step.opensNewTab || false
        })),
        created_at: new Date().toISOString(),
        status: 'pending_review'
      };
      
      const response = await fetch(`${serverUrl}/api/flowstral/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recording)
      });
      
      if (response.ok) {
        const result = await response.json();
        this.addLog('success', `📤 Saved to Workflow Editor (ID: ${result.id || 'new'})`);
        console.log('[Sidebar] Saved to backend:', result);
      } else {
        console.warn('[Sidebar] Backend save failed:', response.status);
        this.addLog('info', 'Saved locally (backend unavailable)');
      }
    } catch (error) {
      console.warn('[Sidebar] Could not save to backend:', error.message);
      this.addLog('info', 'Saved locally (backend unavailable)');
    }
  }
  
  /**
   * Convert workflow to manual test case
   */
  convertToManualTest() {
    if (this.workflowSteps.length === 0) {
      this.addLog('error', 'No steps in workflow');
      return;
    }
    
    // Generate manual test case in ISTQB format
    const testCase = {
      id: `TC-${Date.now()}`,
      name: `Manual Test - ${new Date().toLocaleString()}`,
      description: 'Test case generated from recorded workflow',
      preconditions: `Navigate to: ${this.state.startUrl || this.state.pageAnalysis?.url || 'Application URL'}`,
      steps: this.workflowSteps.map((step, idx) => ({
        stepNumber: idx + 1,
        action: this.getManualTestAction(step),
        expectedResult: this.getExpectedResult(step)
      })),
      postconditions: 'Verify all steps completed successfully',
      priority: 'Medium',
      createdAt: new Date().toISOString()
    };
    
    // Format as readable text
    const manualTestText = this.formatManualTest(testCase);
    
    // Show in script preview
    if (this.elements.scriptPreview) {
      this.elements.scriptPreview.textContent = manualTestText;
    }
    
    // Switch to Script tab
    const scriptTab = document.querySelector('[data-tab="script"]');
    if (scriptTab) scriptTab.click();
    
    // Copy to clipboard
    navigator.clipboard?.writeText(manualTestText).then(() => {
      this.addLog('success', 'Manual test case copied to clipboard');
    }).catch(() => {
      this.addLog('info', 'Manual test case generated');
    });
  }
  
  /**
   * Get human-readable action for manual test
   */
  getManualTestAction(step) {
    const actionVerbs = {
      'click': 'Click on',
      'fill': 'Enter value in',
      'select': 'Select from',
      'check': 'Check/Select',
      'assert': 'Verify'
    };
    
    const verb = actionVerbs[step.type] || 'Interact with';
    const element = step.element || 'element';
    const text = step.text || step.description;
    
    return `${verb} the "${text}" ${element}`;
  }
  
  /**
   * Get expected result for manual test step
   */
  getExpectedResult(step) {
    const elementType = step.element || 'element';
    const text = step.text || '';
    
    switch (step.type) {
      case 'click':
        if (elementType === 'link') return 'Page navigates or action is triggered';
        if (elementType === 'button') return 'Action is performed successfully';
        if (elementType === 'radio' || elementType === 'checkbox') return 'Option is selected';
        return 'Element responds to click';
      case 'fill':
        return `Value "${step.value || 'entered text'}" is displayed in the field`;
      case 'select':
        return 'Selected option is displayed';
      case 'assert':
        return `"${text}" is visible on the page`;
      default:
        return 'Action completes successfully';
    }
  }
  
  /**
   * Format test case as readable text
   */
  formatManualTest(testCase) {
    let output = `═══════════════════════════════════════════════════════════════
                    MANUAL TEST CASE
═══════════════════════════════════════════════════════════════

TEST ID: ${testCase.id}
NAME: ${testCase.name}
PRIORITY: ${testCase.priority}
CREATED: ${testCase.createdAt}

───────────────────────────────────────────────────────────────
DESCRIPTION
───────────────────────────────────────────────────────────────
${testCase.description}

───────────────────────────────────────────────────────────────
PRECONDITIONS
───────────────────────────────────────────────────────────────
${testCase.preconditions}

───────────────────────────────────────────────────────────────
TEST STEPS
───────────────────────────────────────────────────────────────
`;

    testCase.steps.forEach(step => {
      output += `
Step ${step.stepNumber}:
  ACTION: ${step.action}
  EXPECTED: ${step.expectedResult}
`;
    });

    output += `
───────────────────────────────────────────────────────────────
POSTCONDITIONS
───────────────────────────────────────────────────────────────
${testCase.postconditions}

═══════════════════════════════════════════════════════════════
`;

    return output;
  }

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
}

// Initialize when DOM is ready - make global for onclick handlers
let sidebar;
document.addEventListener('DOMContentLoaded', () => {
  sidebar = new SidebarController();
  window.sidebar = sidebar; // Make accessible for inline onclick
});
