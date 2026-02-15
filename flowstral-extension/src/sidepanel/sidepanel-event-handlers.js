/**
 * Sidepanel Event-Handler wiring
 * Extracted from SidebarController.attachEventListeners — loaded via <script> before sidepanel.js
 * Standalone function invoked by one-liner delegate in the class.
 */

function spAttachEventListeners(ctx) {
  // Recording controls
  ctx.elements.startBtn.addEventListener('click', () => ctx.startRecording());
  ctx.elements.stopBtn.addEventListener('click', () => ctx.stopRecording());
  ctx.elements.clearBtn.addEventListener('click', () => ctx.clearRecording());
  ctx.elements.saveTestCaseBtn.addEventListener('click', () => ctx.saveTestCase());
  // Record tab uses openInWorkflowEditorFromRecord
  ctx.elements.openWorkflowBtn.addEventListener('click', () => ctx.openInWorkflowEditorFromRecord());

  // Open in Desktop Recorder — save session then open in full desktop UI
  if (ctx.elements.openDesktopBtn) {
    ctx.elements.openDesktopBtn.addEventListener('click', () => ctx.openInDesktopRecorder());
  }

  // Network capture toggle
  if (ctx.elements.networkCaptureToggle) {
    ctx.elements.networkCaptureToggle.addEventListener('change', (e) => {
      ctx.state.captureNetwork = e.target.checked;
      chrome.runtime.sendMessage({
        type: 'TOGGLE_NETWORK_CAPTURE',
        enabled: ctx.state.captureNetwork
      });
      console.log('[Sidebar] Network capture toggled:', ctx.state.captureNetwork);
      ctx.updateProtocolActionsVisibility();
    });
  }

  // HAR Export button
  if (ctx.elements.exportHarBtn) {
    ctx.elements.exportHarBtn.addEventListener('click', () => ctx.exportHAR());
  }

  // Load Test button
  if (ctx.elements.loadTestBtn) {
    ctx.elements.loadTestBtn.addEventListener('click', () => ctx.openLoadTest());
  }

  // AI Enhancement (in Review tab)
  if (ctx.elements.enhanceAIBtn) {
    ctx.elements.enhanceAIBtn.addEventListener('click', () => ctx.enhanceWithAI());
  }

  // Assertion builder
  if (ctx.elements.assertionType) {
    ctx.elements.assertionType.addEventListener('change', () => ctx.updateAssertionUI());
  }
  if (ctx.elements.addAssertionBtn) {
    ctx.elements.addAssertionBtn.addEventListener('click', () => ctx.addAssertion());
  }

  // Smart Assert button
  if (ctx.elements.smartAssertBtn) {
    ctx.elements.smartAssertBtn.addEventListener('click', () => ctx.showSmartAssertSuggestions());
  }

  // Script controls
  ctx.elements.generateBtn.addEventListener('click', () => ctx.generateScript());
  ctx.elements.copyBtn.addEventListener('click', () => ctx.copyScript());
  ctx.elements.downloadBtn.addEventListener('click', () => ctx.downloadScript());

  // Run controls
  ctx.elements.runBtn.addEventListener('click', () => ctx.runTest());
  ctx.elements.clearLogsBtn.addEventListener('click', () => ctx.clearLogs());

  // Show browser toggle
  ctx.elements.showBrowserToggle.addEventListener('click', () => {
    ctx.options.showBrowser = !ctx.options.showBrowser;
    ctx.elements.showBrowserToggle.classList.toggle('active');
    ctx.saveSettings();
  });

  // Settings
  ctx.elements.appSelect.addEventListener('change', (e) => {
    ctx.options.appType = e.target.value;
    ctx.saveSettings();
  });

  ctx.elements.languageSelect.addEventListener('change', (e) => {
    ctx.options.language = e.target.value;
    ctx.updateScriptLangDisplay();
    ctx.saveSettings();
    // Regenerate script with new language
    if (ctx.state.script && ctx.state.actions.length > 0) {
      ctx.generateScript();
    }
  });

  ctx.elements.browserSelect.addEventListener('change', (e) => {
    ctx.options.browser = e.target.value;
    ctx.saveSettings();
  });

  ctx.elements.serverUrl.addEventListener('change', (e) => {
    ctx.options.serverUrl = e.target.value;
    ctx.saveSettings();
    ctx.checkServerConnection();
  });

  // Base URL input - save when changed
  if (ctx.elements.baseUrlInput) {
    ctx.elements.baseUrlInput.addEventListener('change', (e) => {
      ctx.options.baseUrl = e.target.value;
      ctx.saveSettings();
      console.log('[Sidebar] Base URL updated:', e.target.value);
    });
  }

  ctx.elements.checkServerBtn.addEventListener('click', () => ctx.checkServerConnection());

  // Advanced feature toggles
  const advancedToggles = [
    { el: ctx.elements.selfHealingToggle, key: 'selfHealing' },
    { el: ctx.elements.smartWaitsToggle, key: 'smartWaits' },
    { el: ctx.elements.screenshotOnFailureToggle, key: 'screenshotOnFailure' },
    { el: ctx.elements.generateAssertionsToggle, key: 'generateAssertions' },
    { el: ctx.elements.pageObjectModelToggle, key: 'pageObjectModel' },
    { el: ctx.elements.dataDrivenToggle, key: 'dataDriven' },
    { el: ctx.elements.crossBrowserToggle, key: 'crossBrowser' },
    { el: ctx.elements.visualRegressionToggle, key: 'visualRegression' },
  ];

  advancedToggles.forEach(({ el, key }) => {
    if (el) {
      el.addEventListener('change', (e) => {
        ctx.options[key] = e.target.checked;
        ctx.saveSettings();
        // If POM, data-driven, or other enterprise features change, show info
        if (['pageObjectModel', 'dataDriven', 'crossBrowser', 'visualRegression'].includes(key)) {
          ctx.addLog('info', `${key} ${e.target.checked ? 'enabled' : 'disabled'} - will apply on next generation`);
        }
      });
    }
  });

  // Format buttons for test case generation
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => ctx.downloadTestCase(btn.dataset.format));
  });

  // ============ AGENTIC FEATURES (Phases 3-4) ============
  // Refresh Analysis button
  if (ctx.elements.refreshAnalysisBtn) {
    console.log('[Sidebar] Attaching refreshAnalysisBtn click handler');
    ctx.elements.refreshAnalysisBtn.addEventListener('click', () => {
      console.log('[Sidebar] Refresh Analysis button clicked!');
      ctx.refreshPageAnalysis();
    });
  } else {
    console.error('[Sidebar] refreshAnalysisBtn element NOT FOUND!');
  }

  // Scan Menus button - discovers hidden dropdown menu items
  if (ctx.elements.expandMenusBtn) {
    ctx.elements.expandMenusBtn.addEventListener('click', () => {
      console.log('[Sidebar] Scan Menus clicked!');
      ctx.scanDropdownMenus();
    });
  }

  // Show Code Toggle
  if (ctx.elements.showCodeToggle) {
    ctx.elements.showCodeToggle.addEventListener('click', () => {
      ctx.showSelectorCode = !ctx.showSelectorCode;
      ctx.elements.showCodeToggle.classList.toggle('active', ctx.showSelectorCode);
      ctx.renderSuggestions();  // Re-render with/without code
    });
  }

  // Test Data Generation
  const generateTestDataBtn = document.getElementById('generateTestDataBtn');
  if (generateTestDataBtn) {
    generateTestDataBtn.addEventListener('click', () => ctx.generateTestData());
  }

  const copyTestDataBtn = document.getElementById('copyTestDataBtn');
  if (copyTestDataBtn) {
    copyTestDataBtn.addEventListener('click', () => ctx.copyTestDataAsJSON());
  }

  const downloadTestDataCSVBtn = document.getElementById('downloadTestDataCSVBtn');
  if (downloadTestDataCSVBtn) {
    downloadTestDataCSVBtn.addEventListener('click', () => ctx.downloadTestDataAsCSV());
  }

  const clearTestDataBtn = document.getElementById('clearTestDataBtn');
  if (clearTestDataBtn) {
    clearTestDataBtn.addEventListener('click', () => ctx.clearTestData());
  }

  // Data Constraints Modal
  const openConstraintsBtn = document.getElementById('openConstraintsBtn');
  if (openConstraintsBtn) {
    openConstraintsBtn.addEventListener('click', () => ctx.openConstraintsModal());
  }

  const closeConstraintsModal = document.getElementById('closeConstraintsModal');
  if (closeConstraintsModal) {
    closeConstraintsModal.addEventListener('click', () => ctx.closeConstraintsModal());
  }

  const addConstraintBtn = document.getElementById('addConstraintBtn');
  if (addConstraintBtn) {
    addConstraintBtn.addEventListener('click', () => ctx.addConstraint());
  }

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => ctx.applyPreset(e.target.dataset.preset));
  });

  // Suggestion Filter
  if (ctx.elements.suggestionFilter) {
    ctx.elements.suggestionFilter.addEventListener('change', () => {
      ctx.renderSuggestions();  // Re-render with filter
    });
  }

  // Assert All button
  if (ctx.elements.assertAllBtn) {
    ctx.elements.assertAllBtn.addEventListener('click', () => ctx.addAllAssertions());
  }

  // Capture Page button
  if (ctx.elements.capturePageBtn) {
    ctx.elements.capturePageBtn.addEventListener('click', () => ctx.capturePage());
  }

  // Workflow buttons
  const saveTestCaseBtn = document.getElementById('saveTestCaseFromWorkflow');
  if (saveTestCaseBtn) {
    saveTestCaseBtn.addEventListener('click', () => ctx.saveAsUnifiedTestCase());
  }

  const openWorkflowEditorBtn = document.getElementById('openWorkflowEditorBtn');
  if (openWorkflowEditorBtn) {
    openWorkflowEditorBtn.addEventListener('click', () => ctx.openInWorkflowEditor());
  }

  if (ctx.elements.clearWorkflowBtn) {
    ctx.elements.clearWorkflowBtn.addEventListener('click', () => ctx.clearWorkflow());
  }

  // Tab control buttons
  const addSwitchParentBtn = document.getElementById('addSwitchParentBtn');
  if (addSwitchParentBtn) {
    addSwitchParentBtn.addEventListener('click', () => ctx.addTabControlStep('switchToParent'));
  }
  const addCloseTabBtn = document.getElementById('addCloseTabBtn');
  if (addCloseTabBtn) {
    addCloseTabBtn.addEventListener('click', () => ctx.addTabControlStep('closeTab'));
  }

  // POM section handlers
  if (ctx.elements.pomToggle) {
    ctx.elements.pomToggle.addEventListener('click', () => {
      const content = ctx.elements.pomContent;
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  }
  if (ctx.elements.pomClassSelect) {
    ctx.elements.pomClassSelect.addEventListener('change', (e) => {
      const className = e.target.value;
      if (className && ctx.state.pageObjects?.[className]) {
        ctx.elements.pomPreview.textContent = ctx.state.pageObjects[className];
      }
    });
  }
  if (ctx.elements.copyPomBtn) {
    ctx.elements.copyPomBtn.addEventListener('click', () => ctx.copyPomClass());
  }
  if (ctx.elements.downloadPomBtn) {
    ctx.elements.downloadPomBtn.addEventListener('click', () => ctx.downloadAllPomClasses());
  }

  // Test Data section handlers
  if (ctx.elements.testDataToggle) {
    ctx.elements.testDataToggle.addEventListener('click', () => {
      const content = ctx.elements.testDataContent;
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  }
  if (ctx.elements.downloadTestDataBtn) {
    ctx.elements.downloadTestDataBtn.addEventListener('click', () => ctx.downloadTestData());
  }

  // Review tab event listeners
  ctx.elements.previewFormatBtn.addEventListener('click', () => ctx.generatePreview());
  ctx.elements.copyPreviewBtn.addEventListener('click', () => ctx.copyPreview());
  ctx.elements.downloadPreviewBtn.addEventListener('click', () => ctx.downloadPreview());
  // New simplified save/view buttons
  if (ctx.elements.saveWithAssertionsBtn) {
    ctx.elements.saveWithAssertionsBtn.addEventListener('click', () => ctx.saveRecordingWithAssertions());
  }
  if (ctx.elements.viewInTraceBtn) {
    ctx.elements.viewInTraceBtn.addEventListener('click', () => ctx.openTracePage());
  }

  // Auto-update badge when format changes
  ctx.elements.outputFormatSelect.addEventListener('change', (e) => {
    const formatLabels = {
      'python': 'Python',
      'typescript': 'TypeScript',
      'istqb': 'ISTQB',
      'gherkin': 'Gherkin',
      'markdown': 'Markdown'
    };
    ctx.elements.previewFormatBadge.textContent = formatLabels[e.target.value] || e.target.value;
    // Clear preview when format changes
    ctx.elements.scriptEditor.value = '';
    ctx.updateReviewButtons();
  });

  // Auto-suggest test case name based on start URL
  ctx.elements.testCaseName.addEventListener('focus', () => {
    if (!ctx.elements.testCaseName.value && ctx.state.startUrl) {
      try {
        const url = new URL(ctx.state.startUrl);
        const path = url.pathname.replace(/\//g, '_').replace(/^_|_$/g, '');
        ctx.elements.testCaseName.value = `Test_${path || 'home'}_${new Date().toISOString().slice(0, 10)}`;
      } catch (e) {}
    }
  });
}
