/**
 * Content Script - Enhanced with App-Specific Selectors and Computer Vision
 * Captures user actions with intelligent, application-aware selectors
 * 
 * IMPORTANT: This file now uses shared recorder-engine.js for core functionality.
 * The shared engine is loaded first via manifest.json content_scripts.
 * This ensures IDENTICAL behavior with the desktop Electron app.
 */

(function() {
  'use strict';

  // ============================================================================
  // USE SHARED RECORDER ENGINE (loaded via manifest.json before this file)
  // ============================================================================
  
  const SharedEngine = window.FlowstralRecorderEngine || {};
  const useSharedEngine = !!SharedEngine.SmartSelector;
  
  if (useSharedEngine) {
    console.log('[Recorder] Using shared FlowstralRecorderEngine');
  } else {
    console.warn('[Recorder] Shared engine not found, using inline code');
  }

  // Import from shared engine (or use inline fallback)
  const SharedAppSelectorConfig = SharedEngine.AppSelectorConfig;
  const SharedSmartSelector = SharedEngine.SmartSelector;
  const sharedFindInteractiveElement = SharedEngine.findInteractiveElement;
  const sharedIsGenericContainer = SharedEngine.isGenericContainer;
  const sharedIsSensitiveField = SharedEngine.isSensitiveField;
  const sharedGetFieldLabel = SharedEngine.getFieldLabel;
  const sharedGetVisibleText = SharedEngine.getVisibleText;
  const sharedDetectApp = SharedEngine.detectApp;
  const sharedIsDynamic = SharedEngine.isDynamic;

  // ============================================================================
  // APP SELECTOR CONFIGURATIONS
  // Use pre-loaded helper (content-app-selector-config.js) or shared engine or inline fallback
  // ============================================================================

  const AppSelectorConfig = SharedAppSelectorConfig || window._FlowstralAppSelectorConfig || {
    'salesforce-lwc': {
      name: 'Salesforce LWC',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      detectElements: ['[class*="lwc-"]', 'lightning-'],
      strategies: [
        // Priority: text/role > label > name > title > aria-label
        // AVOID: data-id (often dynamic numbers), dynamic IDs
        { attr: 'name', priority: 100, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 95, playwright: (val) => `locator('[title="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
        { attr: 'data-target-selection-name', priority: 85, playwright: (val) => `locator('[data-target-selection-name="${val}"]')` },
        { attr: 'field-name', priority: 80, playwright: (val) => `locator('[field-name="${val}"]')` },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /input-\d+/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      // domcontentloaded is BETTER than networkidle for Salesforce
      // networkidle causes timeouts due to constant background requests (analytics, Aura queue)
      customWait: 'domcontentloaded',
    },
    'salesforce-aura': {
      name: 'Salesforce Aura',
      detectPatterns: [/force\.com/i, /salesforce\.com/i],
      detectElements: ['[data-aura-rendered-by]'],
      strategies: [
        { attr: 'data-aura-id', priority: 100, playwright: (val) => `locator('[data-aura-id="${val}"]')` },
        { attr: 'name', priority: 95, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      avoidPatterns: [/data-aura-rendered-by/, /\d+:\d+;[a-z]/, /globalId;\d+/],
      // domcontentloaded - Aura has constant $A.getCallback() queue
      customWait: 'domcontentloaded',
    },
    salesforce: {
      name: 'Salesforce',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      strategies: [
        // AVOID data-id with pure numbers - often dynamic
        { attr: 'name', priority: 100, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 95, playwright: (val) => `locator('[title="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
        { attr: 'data-aura-id', priority: 85, playwright: (val) => `locator('[data-aura-id="${val}"]')` },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      // domcontentloaded is BETTER than networkidle for Salesforce
      customWait: 'domcontentloaded',
    },
    servicenow: {
      name: 'ServiceNow',
      detectPatterns: [/service-now\.com/i, /servicenow\.com/i],
      detectElements: ['[id^="sys_"]', '[class*="glide"]'],
      strategies: [
        { attr: 'name', priority: 100, playwright: (val) => {
          // ServiceNow uses table.field pattern
          if (val.includes('.')) return `locator('[name="${val}"]')`;
          return `locator('[name*="${val}"]')`;
        }},
        { attr: 'data-field', priority: 95, playwright: (val) => `locator('[data-field="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `locator('[aria-label="${val}"]')` },
        { attr: 'id', priority: 85, playwright: (val) => {
          // Use suffix pattern for sys_display fields
          if (val.includes('sys_display.') && val.includes('.')) {
            const parts = val.split('.');
            return `locator('[id^="sys_display."][id$=".${parts[parts.length-1]}"]')`;
          }
          return `locator('[id$=".${val}"]')`;
        }},
      ],
      avoidPatterns: [/sys_display\.[^"]+\.\d+/],
      tagPrefix: 'now-',
      frameSelector: 'iframe[name="gsft_main"]',
      customWait: 'domcontentloaded',
    },
    workday: {
      name: 'Workday',
      detectPatterns: [/workday\.com/i, /myworkday\.com/i],
      detectElements: ['[data-automation-id]', 'wd-'],
      strategies: [
        { attr: 'data-automation-id', priority: 100, playwright: (val) => `locator('[data-automation-id="${val}"]')` },
        { attr: 'data-automation-label', priority: 95, playwright: (val) => `locator('[data-automation-label="${val}"]')` },
        { attr: 'data-uxi-widget-type', priority: 90, playwright: (val) => `locator('[data-uxi-widget-type="${val}"]')` },
      ],
      avoidPatterns: [/wd-[A-F0-9-]+/i],
      shadowDomApps: true,
      customWait: 'networkidle',
    },
    'sap-ui5': {
      name: 'SAP UI5 / Fiori',
      detectPatterns: [/sap\.com/i, /fiori/i, /sapcloud/i],
      detectElements: ['[id^="__xmlview"]', '[data-sap-ui]'],
      strategies: [
        { attr: 'id', priority: 100, playwright: (val) => {
          // Use suffix pattern after --
          if (val.includes('--')) {
            const suffix = val.split('--').pop();
            return `locator('[id$="--${suffix}"]')`;
          }
          return `locator('[id="${val}"]')`;
        }},
        { attr: 'data-sap-ui', priority: 95, playwright: (val) => `locator('[data-sap-ui="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      avoidPatterns: [/__xmlview\d+--/, /__button\d+/, /__clone\d+/],
      classPrefix: ['sapM', 'sapUi'],
      customWait: 'networkidle',
    },
    sap: {
      name: 'SAP',
      detectPatterns: [/sap\.com/i, /fiori/i, /sapcloud/i],
      strategies: [
        { attr: 'data-sap-ui', priority: 100, playwright: (val) => `locator('[data-sap-ui="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      classPrefix: ['sapM', 'sapUi'],
      customWait: 'networkidle',
    },
    oracle: {
      name: 'Oracle',
      detectPatterns: [/oracle\.com/i, /oraclecloud\.com/i],
      strategies: [
        { attr: 'data-afr-fgridcol', priority: 100 },
        { attr: 'label-hint', priority: 90 },
      ],
      tagPrefix: 'oj-',
      customWait: 'networkidle',
    },
    dynamics365: {
      name: 'Microsoft Dynamics 365',
      detectPatterns: [/dynamics\.com/i, /crm\.dynamics/i],
      detectElements: ['[data-id*="fieldControl"]', '[class*="MscrmControls"]'],
      strategies: [
        { attr: 'data-id', priority: 100, playwright: (val) => `locator('[data-id="${val}"]')` },
        { attr: 'data-control-name', priority: 95, playwright: (val) => `locator('[data-control-name="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `locator('[aria-label="${val}"]')` },
      ],
      avoidPatterns: [/id-[a-f0-9-]{36}/i, /MscrmControls\.\w+_\d+/],
      customWait: 'networkidle',
    },
    jira: {
      name: 'Jira / Atlassian',
      detectPatterns: [/atlassian\.net/i, /jira\./i, /confluence\./i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-item-title', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    zendesk: {
      name: 'Zendesk',
      detectPatterns: [/zendesk\.com/i],
      strategies: [
        { attr: 'data-test-id', priority: 100 },
        { attr: 'data-garden-id', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    hubspot: {
      name: 'HubSpot',
      detectPatterns: [/hubspot\.com/i, /hs-sites\.com/i],
      strategies: [
        { attr: 'data-selenium-test', priority: 100 },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-button-use', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    netsuite: {
      name: 'NetSuite',
      detectPatterns: [/netsuite\.com/i, /app\.netsuite/i],
      strategies: [
        { attr: 'data-ns-field-type', priority: 95 },
      ],
      idPrefix: 'custpage_',
      frameSelector: 'iframe[name="main"]',
      customWait: 'networkidle',
    },
    shopify: {
      name: 'Shopify',
      detectPatterns: [/shopify\.com/i, /myshopify\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
      ],
      classPrefix: ['Polaris-'],
      customWait: 'networkidle',
    },
    slack: {
      name: 'Slack',
      detectPatterns: [/slack\.com/i, /app\.slack/i],
      strategies: [
        { attr: 'data-qa', priority: 100 },
        { attr: 'data-qa-action', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    monday: {
      name: 'Monday.com',
      detectPatterns: [/monday\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-automationid', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    quickbooks: {
      name: 'QuickBooks',
      detectPatterns: [/quickbooks\.intuit\.com/i, /qbo\.intuit/i],
      strategies: [
        { attr: 'data-automation', priority: 100 },
        { attr: 'data-cy', priority: 95 },
        { attr: 'data-automation-id', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    freshdesk: {
      name: 'Freshdesk',
      detectPatterns: [/freshdesk\.com/i, /freshworks\.com/i],
      strategies: [
        { attr: 'data-aid', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
      ],
      customWait: 'networkidle',
    },
    zoho: {
      name: 'Zoho',
      detectPatterns: [/zoho\.com/i],
      strategies: [
        { attr: 'data-zcqa', priority: 100 },
        { attr: 'lyte-att', priority: 90 },
      ],
      customWait: 'domcontentloaded',
    },
    powerapps: {
      name: 'Power Apps',
      detectPatterns: [/powerapps\.com/i, /make\.powerapps/i],
      strategies: [
        { attr: 'data-control-name', priority: 100 },
      ],
      classPrefix: ['appmagic-'],
      customWait: 'networkidle',
    },
    coupa: {
      name: 'Coupa',
      detectPatterns: [/coupahost\.com/i, /coupa\.com/i],
      strategies: [
        { attr: 'data-object-name', priority: 100 },
        { attr: 'data-field', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    anaplan: {
      name: 'Anaplan',
      detectPatterns: [/anaplan\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    successfactors: {
      name: 'SAP SuccessFactors',
      detectPatterns: [/successfactors\.com/i, /sapsf\.com/i],
      strategies: [
        { attr: 'data-automation-id', priority: 100 },
        { attr: 'data-help-id', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    // Frontend Frameworks
    angular: {
      name: 'Angular',
      detectPatterns: [/angular/i],
      detectElements: ['[ng-reflect-', '[_ngcontent-', '[_nghost-'],
      strategies: [
        { attr: 'data-cy', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
        { attr: 'formcontrolname', priority: 90, playwright: (val) => `locator('[formcontrolname="${val}"]')` },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'ng-reflect-name', priority: 80, playwright: (val) => `locator('[ng-reflect-name="${val}"]')` },
      ],
      avoidPatterns: [/_ngcontent-\w+-c\d+/, /_nghost-\w+-c\d+/],
      customWait: 'networkidle',
    },
    react: {
      name: 'React',
      detectPatterns: [],
      detectElements: ['[data-reactroot]', '[data-reactid]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'aria-label', priority: 80, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
    vue: {
      name: 'Vue.js',
      detectPatterns: [],
      detectElements: ['[data-v-', '[v-model]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/data-v-[a-f0-9]+/],
      customWait: 'networkidle',
    },
    svelte: {
      name: 'Svelte',
      detectPatterns: [],
      detectElements: ['[class*="svelte-"]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/svelte-[a-z0-9]+/],
      customWait: 'networkidle',
    },
    // Additional Enterprise Apps
    veeva: {
      name: 'Veeva Vault',
      detectPatterns: [/veeva\.com/i, /vault\.com/i],
      strategies: [
        { attr: 'data-component-id', priority: 100 },
        { attr: 'data-field-name', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      customWait: 'networkidle',
    },
    pega: {
      name: 'Pega',
      detectPatterns: [/pega\.com/i, /prpc/i],
      detectElements: ['[data-test-id*="pega"]', '[class*="pega-"]'],
      strategies: [
        { attr: 'data-test-id', priority: 100 },
        { attr: 'data-node-id', priority: 95 },
        { attr: 'data-ctl', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/pzButton[A-Z0-9]+/],
      customWait: 'networkidle',
    },
    appian: {
      name: 'Appian',
      detectPatterns: [/appian\.com/i],
      detectElements: ['[data-appian-]'],
      strategies: [
        { attr: 'data-appian-element', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
    outsystems: {
      name: 'OutSystems',
      detectPatterns: [/outsystems/i],
      detectElements: ['[osui-', '[data-block]'],
      strategies: [
        { attr: 'data-input', priority: 100 },
        { attr: 'data-button', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'id', priority: 85, playwright: (val) => {
          // OutSystems uses wtXXX_YYY pattern - use suffix
          if (val.includes('_')) {
            const suffix = val.split('_').pop();
            return `locator('[id$="_${suffix}"]')`;
          }
          return `locator('[id="${val}"]')`;
        }},
      ],
      avoidPatterns: [/wt\d+_\d+/],
      customWait: 'networkidle',
    },
    mendix: {
      name: 'Mendix',
      detectPatterns: [/mendix/i, /mxapp/i],
      strategies: [
        { attr: 'data-widget-name', priority: 100 },
        { attr: 'mx-name', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      customWait: 'networkidle',
    },
    generic: {
      name: 'Generic',
      detectPatterns: [],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'data-test', priority: 85 },
        { attr: 'name', priority: 80, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'aria-label', priority: 75, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
  };

  // ============================================================================
  // COMPUTER VISION (extracted to content-computer-vision.js)
  // ============================================================================

  const ComputerVision = window._FlowstralComputerVision || class ComputerVisionFallback {
    constructor() { this.fingerprints = new Map(); }
    captureFingerprint() { return null; }
    highlightElement() {}
  };

  // ============================================================================
  // SYNTHETIC DATA GENERATOR (extracted to content-synthetic-data.js)
  // ============================================================================

  const SyntheticDataGenerator = window._FlowstralSyntheticDataGenerator || class SyntheticDataGeneratorFallback {
    constructor() { this.constraints = {}; }
    detectFieldType() { return 'text'; }
    generate() { return 'test'; }
    analyzeElement(el) { return { fieldType: 'text', suggestedValue: 'test', confidence: 0.5, alternatives: [] }; }
    generatePageTestData(inputs) { return []; }
    setConstraint() {}
    getConstraint() { return null; }
    extractElementConstraints() { return null; }
    getDropdownOptions() { return []; }
  };

  // Create global instance
  const syntheticDataGenerator = new SyntheticDataGenerator();

  // ============================================================================
  // PAGE ANALYZER (extracted to content-page-analyzer.js)
  // ============================================================================

  const PageAnalyzer = window._FlowstralPageAnalyzer || class PageAnalyzerFallback {
    constructor() { this.lastAnalysis = null; }
    analyze() { return { url: '', title: '', pageType: 'generic', buttons: [], links: [], inputs: [], headings: [], counts: { total: 0 } }; }
    generateAssertions() { return []; }
  };

  // ============================================================================
  // ENHANCED SMART SELECTOR (extracted to content-smart-selector.js)
  // ============================================================================

  const EnhancedSmartSelector = window._FlowstralEnhancedSmartSelector || class EnhancedSmartSelectorFallback {
    constructor() { this.currentApp = 'generic'; this.appConfig = AppSelectorConfig.generic; }
    detectApp() { return 'generic'; }
    getBestSelector(el) { return { selector: 'body', playwright: 'locator("body")', type: 'fallback', confidence: 0, primary: {}, fallbacks: [] }; }
    setApp() {}
    enableVisualLocators() {}
  };


  // ============================================================================
  // ACTION RECORDER
  // ============================================================================

  class ActionRecorder {
    constructor() {
      this.smartSelector = new EnhancedSmartSelector();
      // Wire dependencies for extracted classes
      if (this.smartSelector.setDeps) {
        this.smartSelector.setDeps({
          SharedSmartSelector: SharedSmartSelector,
          sharedDetectApp: sharedDetectApp,
          sharedIsDynamic: sharedIsDynamic,
          AppSelectorConfig: AppSelectorConfig,
          ComputerVision: ComputerVision,
        });
      }
      this.pageAnalyzer = new PageAnalyzer(this.smartSelector);
      // Wire dependencies for extracted PageAnalyzer
      if (this.pageAnalyzer.setDeps) {
        this.pageAnalyzer.setDeps(AppSelectorConfig, syntheticDataGenerator);
      }
      this.actionCoalescer = (typeof ActionCoalescerBrowser !== 'undefined') ? new ActionCoalescerBrowser({ debug: false }) : null;
      if (this.actionCoalescer) this.actionCoalescer.onFlush = (action) => this.addAction(action);
      this.recording = false;
      this.paused = false;
      this.actions = [];
      this.startTime = null;
      this.startUrl = null;
      this.pendingInput = null;
      this.inputTimeout = null;
      this.lastAction = null;
      this.selectedApp = 'auto';
      
      // Agentic features
      this.lastPageAnalysis = null;
      this.analysisDebounceTimer = null;
      this.domObserver = null;
      
      // CRITICAL: Navigation deduplication state (class-level to persist across re-injections)
      this.lastNavTime = 0;
      this.lastNavUrl = '';
      this.recordedNavUrls = new Set();  // Track ALL recorded URLs to prevent duplicates
      
      this.init();
    }

    init() {
      console.log('[Recorder] Content script initialized');
      console.log('[Recorder] Chrome runtime available:', !!chrome.runtime);
      console.log('[Recorder] Chrome runtime ID:', chrome.runtime.id);
      
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Recorder] Message received:', message.type, 'from:', sender);
        try {
          switch (message.type) {
            case 'START_RECORDING':
              console.log('[Recorder] START_RECORDING received, starting recording...');
              this.startRecording(message.options || {});
              sendResponse({ success: true });
              break;
            case 'STOP_RECORDING':
              console.log('[Recorder] STOP_RECORDING received, stopping recording...');
              if (this.actionCoalescer) {
                var flushed = this.actionCoalescer.flush();
                if (flushed) this.actions.push(flushed);
              }
              this.stopRecording();
              sendResponse({ success: true, actions: this.actions });
              break;

            case 'PAUSE_RECORDING':
              this.paused = true;
              sendResponse({ success: true, paused: true });
              break;

            case 'RESUME_RECORDING':
              this.paused = false;
              sendResponse({ success: true, paused: false });
              break;

            case 'GET_STATUS':
              const status = { 
                recording: this.recording, 
                paused: this.paused || false,
                actionsCount: this.actions.length,
                detectedApp: this.smartSelector.currentApp,
                appName: this.smartSelector.appConfig.name,
              };
              console.log('[Recorder] GET_STATUS response:', status);
              sendResponse(status);
              break;
            case 'SET_APP':
              this.setApp(message.app);
              sendResponse({ success: true, app: this.smartSelector.currentApp });
              break;
            case 'DETECT_APP':
              const detected = this.smartSelector.detectApp();
              sendResponse({ app: detected, name: this.smartSelector.appConfig.name });
              break;
            case 'GET_ACTIONS':
              console.log('[Recorder] GET_ACTIONS requested, returning', this.actions.length, 'actions');
              sendResponse({ actions: this.actions });
              break;
            case 'SET_VISUAL_LOCATORS':
              this.smartSelector.enableVisualLocators(message.enabled);
              sendResponse({ success: true });
              break;
            case 'CLEAR_ACTIONS':
              this.actions = [];
              sendResponse({ success: true });
              break;
            
            // ============ AGENTIC FEATURES (Phases 1-4) ============
            case 'ANALYZE_PAGE':
              // Manual trigger for page analysis
              const analysis = this.analyzeCurrentPage();
              sendResponse({ success: true, analysis });
              break;
            
            case 'GENERATE_TEST_DATA':
              // Generate synthetic test data for all form fields
              const pageInputs = this.pageAnalyzer?.collectInputs() || [];
              const testData = syntheticDataGenerator.generatePageTestData(
                pageInputs.map(input => {
                  // Create mock element from input data for analysis
                  const mockEl = document.querySelector(input.selector?.replace('page.', '').replace(/^locator\(["'](.+)["']\)$/, '$1')) || {
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    placeholder: input.placeholder,
                    tagName: input.tagName || 'INPUT',
                    getAttribute: () => null
                  };
                  return { ...input, element: mockEl };
                })
              );
              sendResponse({ 
                success: true, 
                testData,
                summary: {
                  totalFields: testData.length,
                  fieldTypes: [...new Set(testData.map(d => d.fieldType))]
                }
              });
              break;
            
            case 'REGENERATE_FIELD_DATA':
              // Regenerate data for a specific field type with constraints
              const fieldType = message.fieldType || 'text';
              const fieldConstraints = message.constraints || {};
              const count = message.count || 5;
              const values = [];
              for (let i = 0; i < count; i++) {
                values.push(syntheticDataGenerator.generate(fieldType, fieldConstraints));
              }
              sendResponse({ success: true, values, fieldType });
              break;
            
            case 'SET_DATA_CONSTRAINT':
              // Set a constraint for a field type or specific field
              syntheticDataGenerator.setConstraint(message.key, message.constraint);
              sendResponse({ success: true });
              break;
            
            case 'GET_DATA_CONSTRAINTS':
              // Get all constraints
              sendResponse({ 
                success: true, 
                constraints: syntheticDataGenerator.constraints 
              });
              break;
            
            case 'GET_DROPDOWN_OPTIONS':
              // Get options from a specific dropdown/select element
              try {
                const selector = message.selector;
                let element = document.querySelector(selector);
                if (element) {
                  const opts = syntheticDataGenerator.getDropdownOptions(element);
                  sendResponse({ success: true, options: opts });
                } else {
                  sendResponse({ success: false, error: 'Element not found' });
                }
              } catch (err) {
                sendResponse({ success: false, error: err.message });
              }
              break;
            
            case 'FILL_FIELD':
              // Fill a field with a value
              try {
                const selector = message.selector;
                const value = message.value;
                let element = null;
                
                // Try to find element by selector
                if (selector) {
                  // Handle Playwright-style selectors
                  if (selector.includes('getByRole')) {
                    const match = selector.match(/getByRole\(['"](\w+)['"],\s*\{\s*name:\s*['"](.+)['"]\s*\}/);
                    if (match) {
                      const [, role, name] = match;
                      element = document.querySelector(`[role="${role}"]`) || 
                                [...document.querySelectorAll(`[role="${role}"]`)].find(el => 
                                  el.textContent?.includes(name) || el.getAttribute('aria-label')?.includes(name)
                                );
                    }
                  } else if (selector.includes('getByLabel')) {
                    const match = selector.match(/getByLabel\(['"](.+)['"]\)/);
                    if (match) {
                      const label = match[1];
                      const labelEl = [...document.querySelectorAll('label')].find(l => l.textContent?.includes(label));
                      if (labelEl?.htmlFor) {
                        element = document.getElementById(labelEl.htmlFor);
                      }
                    }
                  } else if (selector.includes('locator')) {
                    const match = selector.match(/locator\(['"](.+)['"]\)/);
                    if (match) {
                      element = document.querySelector(match[1]);
                    }
                  } else {
                    // Try as CSS selector
                    element = document.querySelector(selector);
                  }
                }
                
                if (element) {
                  // Focus and fill
                  element.focus();
                  element.value = value;
                  
                  // Dispatch events
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  // Flash highlight
                  const origBg = element.style.backgroundColor;
                  element.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                  setTimeout(() => { element.style.backgroundColor = origBg; }, 500);
                  
                  sendResponse({ success: true });
                } else {
                  sendResponse({ success: false, error: 'Element not found' });
                }
              } catch (err) {
                sendResponse({ success: false, error: err.message });
              }
              break;
            
            case 'SCAN_MENUS':
              // Scan dropdown menus for hidden items
              this.scanDropdownMenus().then(result => {
                sendResponse(result);
              });
              return true;  // Keep channel open for async response
            
            case 'START_POINTING_MODE':
              // User needs to manually point to an element
              this.startPointingMode(message.actionInfo).then(result => {
                sendResponse(result);
              });
              return true;  // Keep channel open for async response
            
            case 'STOP_POINTING_MODE':
              this.stopPointingMode();
              sendResponse({ success: true });
              break;
            
            case 'GET_PAGE_ANALYSIS':
              // Return cached analysis or run new one
              if (this.lastPageAnalysis && Date.now() - this.lastPageAnalysis.analyzedAt < 5000) {
                sendResponse({ analysis: this.lastPageAnalysis });
              } else {
                const freshAnalysis = this.analyzeCurrentPage();
                sendResponse({ analysis: freshAnalysis });
              }
              break;
            
            case 'EXECUTE_ACTION':
              // Execute a suggested action (Phase 4)
              this.executeSuggestedAction(message.action).then(result => {
                sendResponse(result);
              });
              return true; // Keep channel open for async
            
            case 'EXECUTE_STEPS':
              // Execute multiple steps autonomously (Phase 4)
              this.executeStepsAutonomously(message.steps, message.options).then(results => {
                sendResponse({ success: true, results });
              });
              return true; // Keep channel open for async
              
            default:
              console.log('[Recorder] Unknown message type:', message.type);
              sendResponse({ error: 'Unknown message type' });
          }
        } catch (error) {
          console.error('[Recorder] Error handling message:', error);
          sendResponse({ error: error.message });
        }
        return true; // Keep channel open for async response
      });
      
      console.log('[Recorder] Message listener attached');
      
      // Check if recording is already active (for page navigations)
      this.checkAndResumeRecording();
    }
    
    async checkAndResumeRecording() {
      try {
        console.log('[Recorder] Checking if recording is active in background...');
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        console.log('[Recorder] Background state:', response);
        
        // Check both 'isRecording' and 'recording' for compatibility
        const isActive = response && (response.isRecording || response.recording);
        
        if (isActive && !this.recording) {
          console.log('[Recorder] Recording is active in background, resuming...');
          this.startRecording(response.options || {});
          
          const currentUrl = window.location.href;
          
          // Only record navigation if:
          // 1. Different page than startUrl
          // 2. Not already recorded this URL
          // 3. Not a skip pattern URL
          const shouldSkipNav = response.startUrl === currentUrl || 
                                this.recordedNavUrls.has(currentUrl) ||
                                this.shouldSkipNavigationUrl(currentUrl);
          
          if (!shouldSkipNav) {
            this.recordedNavUrls.add(currentUrl);
            this.lastNavUrl = currentUrl;
            this.lastNavTime = Date.now();
            
            this.addAction({
              type: 'navigate',
              url: currentUrl,
              description: `Navigate to ${window.location.pathname}`,
              timestamp: Date.now()
            });
          } else {
            console.log('[Recorder] Skipping navigation on resume:', currentUrl);
          }
        }
      } catch (error) {
        console.log('[Recorder] Could not check recording state:', error.message);
      }
    }
    
    shouldSkipNavigationUrl(url) {
      // Skip intermediate auth/redirect pages (CASE-INSENSITIVE)
      const skipPatterns = [
        /\/secur\//i,
        /\/sessionserver/i,
        /\/identity\//i,
        /\/login\//i,
        /contentdoor/i,
        /\/auth\//i,
        /\/oauth\//i,
        /callback/i,
        /\/sso\//i,
        /\/setup\//i,
        /aura\?/i,
        /\/apexpages\//i,
        /lightning\/setup/i,
        /AddPhone/i,
        /VerifyIdentity/i,
      ];
      return skipPatterns.some(pattern => pattern.test(url));
    }

    setApp(appKey) {
      if (appKey === 'auto') {
        this.smartSelector.detectApp();
      } else {
        this.smartSelector.setApp(appKey);
      }
      this.selectedApp = appKey;
    }

    // ============================================================================
    // AGENTIC FEATURES (Phases 1-4)
    // ============================================================================

    /**
     * Analyze the current page and return structured data
     */
    analyzeCurrentPage() {
      try {
        const analysis = this.pageAnalyzer.analyze();
        this.lastPageAnalysis = analysis;
        console.log(`[Recorder] Page analyzed in ${analysis.timing}: ${analysis.counts.total} elements found`);
        return analysis;
      } catch (error) {
        console.error('[Recorder] Page analysis failed:', error);
        return null;
      }
    }

    /**
     * Analyze page and broadcast to sidepanel
     */
    analyzeAndBroadcast() {
      // Debounce rapid calls (e.g., during SPA navigation)
      if (this.analysisDebounceTimer) {
        clearTimeout(this.analysisDebounceTimer);
      }
      
      this.analysisDebounceTimer = setTimeout(() => {
        const analysis = this.analyzeCurrentPage();
        if (analysis) {
          // Generate assertions from analysis
          const assertions = this.pageAnalyzer.generateAssertions(10);
          
          // Broadcast to background/sidepanel
          chrome.runtime.sendMessage({
            type: 'PAGE_ANALYSIS',
            data: {
              analysis,
              assertions,
              suggestions: this.generateSuggestions(analysis)
            }
          }).catch(() => {
            // Sidepanel may not be open
          });
        }
      }, 300); // 300ms debounce
    }

    /**
     * Generate action suggestions based on page analysis
     */
    generateSuggestions(analysis) {
      const suggestions = [];
      
      // Suggest clicking key buttons
      analysis.buttons.slice(0, 5).forEach(btn => {
        if (!btn.disabled) {
          suggestions.push({
            type: 'click',
            element: 'button',
            text: btn.text,
            selector: btn.selector,
            confidence: 90,
            description: `Click "${btn.text}" button`
          });
        }
      });
      
      // Suggest clicking important links
      analysis.links.slice(0, 3).forEach(link => {
        suggestions.push({
          type: 'click',
          element: 'link',
          text: link.text,
          selector: link.selector,
          confidence: 80,
          description: `Click "${link.text}" link`
        });
      });
      
      // Suggest filling inputs
      analysis.inputs.slice(0, 5).forEach(input => {
        if (input.type !== 'hidden' && input.type !== 'submit') {
          suggestions.push({
            type: 'fill',
            element: 'input',
            label: input.label,
            selector: input.selector,
            inputType: input.type,
            confidence: 85,
            description: `Fill "${input.label}" field`
          });
        }
      });
      
      // Add page-type specific suggestions
      if (analysis.pageType === 'login') {
        suggestions.unshift({
          type: 'flow',
          flowName: 'login',
          confidence: 95,
          description: 'Complete login flow',
          steps: ['Fill username/email', 'Fill password', 'Click submit']
        });
      }
      
      if (analysis.pageType === 'form' || analysis.pageType === 'create-form') {
        suggestions.unshift({
          type: 'flow',
          flowName: 'form-completion',
          confidence: 90,
          description: 'Fill all required fields',
          steps: analysis.inputs.filter(i => i.required).map(i => `Fill "${i.label}"`)
        });
      }
      
      return suggestions;
    }

    /**
     * Setup DOM observer for dynamic page changes
     */
    setupDOMObserver() {
      if (this.domObserver) {
        this.domObserver.disconnect();
      }
      
      this.domObserver = new MutationObserver((mutations) => {
        // Check for significant DOM changes
        const significantChange = mutations.some(m => 
          m.addedNodes.length > 5 || 
          m.removedNodes.length > 5 ||
          (m.target.tagName && ['MAIN', 'SECTION', 'ARTICLE', 'FORM', 'DIALOG'].includes(m.target.tagName))
        );
        
        if (significantChange && this.recording) {
          // Re-analyze on significant DOM changes
          this.analyzeAndBroadcast();
        }
      });
      
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false // Don't trigger on attribute changes
      });
    }

    /**
     * Scan dropdown menus by hovering to reveal hidden items
     */
    async scanDropdownMenus() {
      // CWS Compliance: Auto-scanning dropdowns disabled in extension
      // This feature automatically clicks/hovers UI elements which could trigger side effects
      // Use manual scanning via the sidepanel "Scan Elements" button instead
      // Desktop app retains full auto-scanning capability
      console.log('[Flowstral] Auto dropdown scanning disabled in extension for CWS compliance');
      return { dropdowns: [], totalItemsFound: 0 };

      const menuItems = [];
      const pageAnalyzer = this.pageAnalyzer;

      try {
        // Find all potential menu triggers (dropdown buttons, nav items with submenus)
        const menuTriggers = pageAnalyzer.deepQuery([
          'button[aria-haspopup]',
          'button[aria-expanded]',
          '[role="menuitem"]',
          '[role="button"][aria-haspopup]',
          '.slds-dropdown-trigger',        // Salesforce
          '.dropdown-toggle',              // Bootstrap
          '[data-toggle="dropdown"]',      // Bootstrap
          'nav a[aria-expanded]',          // General nav
          '.menu-item-has-children > a',   // WordPress
          'header button',                 // General header menus
          'nav button',                    // General nav buttons
        ].join(', '));
        
        console.log(`[Content] Found ${menuTriggers.length} potential menu triggers`);
        
        for (const trigger of menuTriggers.slice(0, 10)) {  // Limit to 10 menus
          const triggerText = trigger.textContent?.trim() || trigger.getAttribute('aria-label') || '';
          
          try {
            // Hover to reveal menu
            trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            
            // Some menus need a click
            if (trigger.getAttribute('aria-expanded') === 'false') {
              trigger.click();
            }
            
            // Wait for menu to appear
            await new Promise(r => setTimeout(r, 300));
            
            // Now look for revealed menu items
            const menuItemSelectors = [
              '[role="menuitem"]',
              '[role="option"]',
              '.slds-dropdown__item a',
              '.dropdown-menu a',
              '.dropdown-menu button',
              'ul[role="menu"] a',
              'ul[role="menu"] li',
              '[aria-labelledby] a',
              '.submenu a',
              '.sub-menu a',
            ];
            
            // Look for menu items near the trigger or in popup containers
            const popups = pageAnalyzer.deepQuery('[role="menu"], .slds-dropdown, .dropdown-menu, .submenu, .sub-menu, [aria-expanded="true"] + *');
            
            for (const popup of popups) {
              const items = popup.querySelectorAll('a, button, [role="menuitem"]');
              
              for (const item of items) {
                const text = item.textContent?.trim();
                if (!text || text.length > 50) continue;
                
                // Get selector using smart selector
                const selectorObj = this.smartSelector ? this.smartSelector.getBestSelector(item) : null;
                
                menuItems.push({
                  text,
                  parentMenu: triggerText,
                  href: item.getAttribute('href'),
                  selectorObj,
                  selector: selectorObj?.playwright ? `page.${selectorObj.playwright}` : 
                           `page.getByRole('menuitem', { name: '${text.replace(/'/g, "\\'")}' })`,
                });
              }
            }
            
            // Close menu
            trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            document.body.click();  // Click elsewhere to close
            
            await new Promise(r => setTimeout(r, 100));
            
          } catch (e) {
            console.warn('[Content] Error scanning menu:', triggerText, e);
          }
        }
        
        // Remove duplicates
        const seen = new Set();
        const uniqueItems = menuItems.filter(item => {
          const key = item.text.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        
        console.log(`[Content] Found ${uniqueItems.length} unique menu items`);
        
        return { success: true, menuItems: uniqueItems };
        
      } catch (error) {
        console.error('[Content] Menu scan error:', error);
        return { success: false, error: error.message };
      }
    }

    /**
     * Start pointing mode - user manually selects element on page
     */
    async startPointingMode(actionInfo) {
      return new Promise((resolve) => {
        console.log('[Recorder] Starting pointing mode for:', actionInfo?.text || 'element');
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'qaai-pointing-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2147483646;
          cursor: crosshair;
          background: rgba(0, 0, 0, 0.1);
        `;
        
        // Create instruction banner
        const banner = document.createElement('div');
        banner.id = 'qaai-pointing-banner';
        banner.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483647;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        banner.innerHTML = `🎯 Click on "<strong>${actionInfo?.text || 'the element'}</strong>" on this page`;
        
        let currentHighlight = null;
        
        // Highlight on hover
        const handleMouseOver = (e) => {
          if (e.target === overlay || e.target === banner) return;
          
          if (currentHighlight) {
            currentHighlight.style.outline = '';
            currentHighlight.style.outlineOffset = '';
          }
          
          currentHighlight = e.target;
          currentHighlight.style.outline = '3px solid #667eea';
          currentHighlight.style.outlineOffset = '2px';
        };
        
        const handleMouseOut = (e) => {
          if (e.target === overlay || e.target === banner) return;
          e.target.style.outline = '';
          e.target.style.outlineOffset = '';
        };
        
        // Capture on click
        const handleClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          if (e.target === overlay || e.target === banner) return;
          
          const element = e.target;
          console.log('[Recorder] User pointed to:', element.tagName, element.textContent?.substring(0, 30));
          
          // Get new selector using smart selector
          const newSelectorObj = this.smartSelector.getBestSelector(element);
          const text = element.textContent?.trim().substring(0, 50);
          
          // Clean up
          cleanup();
          
          // Highlight the element green briefly
          element.style.outline = '3px solid #4ade80';
          setTimeout(() => { element.style.outline = ''; }, 1000);
          
          // Click the element
          try {
            element.click();
          } catch (err) {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
          
          resolve({
            success: true,
            newSelectorObj,
            selector: newSelectorObj?.playwright ? `page.${newSelectorObj.playwright}` : null,
            text,
            tagName: element.tagName.toLowerCase(),
            clicked: true
          });
        };
        
        // Cleanup function
        const cleanup = () => {
          overlay.remove();
          banner.remove();
          document.removeEventListener('mouseover', handleMouseOver, true);
          document.removeEventListener('mouseout', handleMouseOut, true);
          document.removeEventListener('click', handleClick, true);
          document.removeEventListener('keydown', handleKeydown, true);
          if (currentHighlight) {
            currentHighlight.style.outline = '';
            currentHighlight.style.outlineOffset = '';
          }
          this.pointingModeActive = false;
        };
        
        // Cancel on Escape
        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            cleanup();
            resolve({ success: false, cancelled: true });
          }
        };
        
        // Store cleanup for external stop
        this.stopPointingModeCleanup = cleanup;
        this.pointingModeActive = true;
        
        // Attach listeners
        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('keydown', handleKeydown, true);
        
        // Add elements to page
        document.body.appendChild(overlay);
        document.body.appendChild(banner);
      });
    }
    
    /**
     * Stop pointing mode externally
     */
    stopPointingMode() {
      if (this.stopPointingModeCleanup) {
        this.stopPointingModeCleanup();
        this.stopPointingModeCleanup = null;
      }
    }

    /**
     * Execute a single suggested action (Phase 4)
     */
    async executeSuggestedAction(action) {
      try {
        console.log('[Recorder] Executing suggested action:', action.type, action.description);
        
        // Build list of selectors to try (primary + fallbacks)
        const selectorsToTry = [];
        
        // Add primary selector
        if (action.selectorObj?.playwright) {
          selectorsToTry.push({ 
            selector: `page.${action.selectorObj.playwright}`, 
            source: 'primary',
            confidence: action.selectorObj.confidence 
          });
        }
        if (action.selector) {
          selectorsToTry.push({ selector: action.selector, source: 'selector' });
        }
        
        // Add fallbacks from selectorObj
        if (action.selectorObj?.fallbacks) {
          action.selectorObj.fallbacks.forEach((fb, i) => {
            if (fb.playwright) {
              selectorsToTry.push({ 
                selector: `page.${fb.playwright}`, 
                source: `fallback-${i+1}`,
                confidence: fb.confidence 
              });
            }
          });
        }
        
        // Add text-based fallback
        if (action.text) {
          selectorsToTry.push({ 
            selector: `page.getByText('${action.text}', { exact: true })`, 
            source: 'text-exact' 
          });
          selectorsToTry.push({ 
            selector: `page.getByText('${action.text}')`, 
            source: 'text-contains' 
          });
        }
        
        console.log('[Recorder] Will try', selectorsToTry.length, 'selectors');
        
        // Try each selector
        let element = null;
        let usedSelector = null;
        let attempt = 0;
        
        for (const sel of selectorsToTry) {
          attempt++;
          console.log(`[Recorder] Attempt ${attempt}/${selectorsToTry.length}: ${sel.source}`);
          
          // Notify progress
          chrome.runtime.sendMessage({
            type: 'SELECTOR_ATTEMPT',
            data: { 
              current: attempt, 
              total: selectorsToTry.length,
              source: sel.source,
              actionText: action.text || action.description
            }
          }).catch(() => {});
          
          element = await this.findElementBySelector(sel.selector);
          
          if (element) {
            usedSelector = sel;
            console.log('[Recorder] Found element with:', sel.source);
            break;
          }
          
          await this.delay(100);  // Small delay between attempts
        }
        
        // If still not found, try text search as last resort
        if (!element && action.text) {
          console.log('[Recorder] Last resort: searching by text content');
          const candidates = this.pageAnalyzer.deepQuery('a, button, [role="link"], [role="button"], [onclick]');
          element = candidates.find(el => {
            const elText = el.textContent?.trim();
            return elText === action.text || elText?.toLowerCase().includes(action.text.toLowerCase());
          });
          if (element) {
            usedSelector = { selector: 'text-search', source: 'text-search' };
          }
        }
        
        if (!element) {
          console.error('[Recorder] All selectors failed for:', action.text || action.description);
          return { 
            success: false, 
            needsManualSelect: true,
            error: `Element not found after ${attempt} attempts`,
            triedSelectors: selectorsToTry.length
          };
        }
        
        console.log('[Recorder] Found element:', element.tagName, element.textContent?.substring(0, 30));
        
        // Execute the action
        switch (action.type) {
          case 'click':
          case 'assert':
            // Scroll into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.delay(200);
            
            // Highlight briefly
            const originalOutline = element.style.outline;
            element.style.outline = '3px solid #4ade80';
            
            // Check if this link opens in new tab
            const opensNewTab = element.tagName === 'A' && (
              element.target === '_blank' ||
              element.getAttribute('target') === '_blank'
            );
            
            // Try multiple click methods for robustness
            try {
              element.click();
            } catch (e) {
              console.log('[Recorder] Native click failed, trying dispatch');
              element.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
            }
            
            // Remove highlight after brief delay
            setTimeout(() => { element.style.outline = originalOutline; }, 500);
            
            if (element.tagName === 'A' && element.href) {
              console.log('[Recorder] Link clicked, href:', element.href, 'opensNewTab:', opensNewTab);
            }
            
            // Return info about whether new tab was opened
            return { 
              success: true, 
              usedSelector, 
              attempt,
              opensNewTab,
              href: element.href || null
            };
            break;
            
          case 'fill':
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
            element.value = action.value || '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            break;
            
          case 'check':
            if (!element.checked) {
              element.click();
            }
            break;
            
          case 'select':
            element.value = action.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            break;
            
          default:
            return { success: false, error: `Unknown action type: ${action.type}` };
        }
        
        // Record the action if we're recording
        if (this.recording) {
          const selector = this.smartSelector.getBestSelector(element);
          this.addAction({
            type: action.type,
            selector: selector,
            value: action.value,
            timestamp: Date.now(),
            description: action.description,
            automated: true
          });
        }
        
        // Re-analyze after action (page may have changed)
        setTimeout(() => this.analyzeAndBroadcast(), 500);
        
        return { success: true, action: action.type };
        
      } catch (error) {
        console.error('[Recorder] Action execution failed:', error);
        return { success: false, error: error.message };
      }
    }

    /**
     * Execute multiple steps autonomously (Phase 4)
     */
    async executeStepsAutonomously(steps, options = {}) {
      const results = [];
      const approvalMode = options.approvalMode || 'auto';
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Notify progress
        chrome.runtime.sendMessage({
          type: 'EXECUTION_PROGRESS',
          data: { current: i + 1, total: steps.length, step }
        }).catch(() => {});
        
        // Execute the step
        const result = await this.executeSuggestedAction(step);
        results.push(result);
        
        // If step failed, try self-healing
        if (!result.success && options.selfHealing) {
          const healedResult = await this.attemptSelfHealing(step);
          if (healedResult.success) {
            results[results.length - 1] = healedResult;
          }
        }
        
        // Wait for page to stabilize
        await this.waitForStability();
      }
      
      // Notify completion
      chrome.runtime.sendMessage({
        type: 'EXECUTION_COMPLETE',
        data: { results, success: results.every(r => r.success) }
      }).catch(() => {});
      
      return results;
    }

    /**
     * Find element by Playwright-style selector
     */
    async findElementBySelector(selectorStr) {
      // Parse Playwright selector
      if (!selectorStr) return null;
      
      console.log('[Recorder] Finding element by selector:', selectorStr);
      
      // Handle page.getByRole
      const roleMatch = selectorStr.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?\)/);
      if (roleMatch) {
        const [, role, name] = roleMatch;
        console.log('[Recorder] Looking for role:', role, 'name:', name);
        
        // Build query based on role - INCLUDE IMPLICIT ROLES
        let query;
        if (role === 'link') {
          query = 'a, [role="link"]';  // Links can be <a> or [role="link"]
        } else if (role === 'button') {
          query = 'button, [role="button"], input[type="submit"], input[type="button"]';
        } else if (role === 'heading') {
          query = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
        } else if (role === 'menuitem') {
          query = '[role="menuitem"], [role="option"], li > a';
        } else {
          query = `[role="${role}"], ${role}`;
        }
        
        const elements = this.pageAnalyzer.deepQuery(query);
        console.log('[Recorder] Found', elements.length, 'elements matching role:', role);
        
        if (name) {
          // Try exact match first
          let found = elements.find(el => {
            const elText = el.textContent?.trim();
            const ariaLabel = el.getAttribute('aria-label');
            return elText === name || ariaLabel === name;
          });
          
          if (!found) {
            // Try includes match
            found = elements.find(el => {
              const elText = el.textContent?.trim().toLowerCase();
              const ariaLabel = el.getAttribute('aria-label')?.toLowerCase();
              const nameLower = name.toLowerCase();
              return elText?.includes(nameLower) || ariaLabel?.includes(nameLower) ||
                     nameLower.includes(elText);
            });
          }
          
          console.log('[Recorder] Found element:', found ? 'yes' : 'no');
          return found;
        }
        return elements[0];
      }
      
      // Handle page.getByLabel
      const labelMatch = selectorStr.match(/getByLabel\(['"]([^'"]+)['"]\)/);
      if (labelMatch) {
        const label = labelMatch[1];
        // Try aria-label
        let el = document.querySelector(`[aria-label="${label}"]`);
        if (el) return el;
        
        // Try label element
        const labels = document.querySelectorAll('label');
        for (const labelEl of labels) {
          if (labelEl.textContent?.includes(label)) {
            const forId = labelEl.getAttribute('for');
            if (forId) {
              return document.getElementById(forId);
            }
            return labelEl.querySelector('input, select, textarea');
          }
        }
      }
      
      // Handle page.getByText
      const textMatch = selectorStr.match(/getByText\(['"]([^'"]+)['"](?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)/);
      if (textMatch) {
        const text = textMatch[1];
        const exact = textMatch[2] === 'true';
        
        // First try: look for clickable elements with this text
        const clickables = this.pageAnalyzer.deepQuery('a, button, [role="link"], [role="button"], [onclick]');
        let found = clickables.find(el => {
          const elText = el.textContent?.trim();
          return exact ? elText === text : elText?.includes(text);
        });
        
        if (!found) {
          // Fallback: any element with text
          const elements = this.pageAnalyzer.deepQuery('*');
          found = elements.find(el => {
            const elText = el.textContent?.trim();
            return exact ? elText === text : (elText === text || (elText?.length < text.length * 2 && elText?.includes(text)));
          });
        }
        
        return found;
      }
      
      // Handle page.getByTestId
      const testIdMatch = selectorStr.match(/getByTestId\(['"]([^'"]+)['"]\)/);
      if (testIdMatch) {
        return document.querySelector(`[data-testid="${testIdMatch[1]}"]`);
      }
      
      // Handle page.locator with CSS selector
      const locatorMatch = selectorStr.match(/locator\(['"]([^'"]+)['"]\)/);
      if (locatorMatch) {
        return document.querySelector(locatorMatch[1]);
      }
      
      // Fallback: try as CSS selector
      try {
        return document.querySelector(selectorStr);
      } catch (e) {
        return null;
      }
    }

    /**
     * Attempt self-healing when element not found
     */
    async attemptSelfHealing(step) {
      console.log('[Recorder] Attempting self-healing for:', step.description);
      
      // Re-analyze the page
      const analysis = this.analyzeCurrentPage();
      if (!analysis) return { success: false, error: 'Could not analyze page' };
      
      // Try to find similar element
      let candidates = [];
      
      if (step.type === 'click' && step.element === 'button') {
        candidates = analysis.buttons.filter(b => 
          this.calculateSimilarity(b.text, step.text) > 0.6
        );
      } else if (step.type === 'click' && step.element === 'link') {
        candidates = analysis.links.filter(l => 
          this.calculateSimilarity(l.text, step.text) > 0.6
        );
      } else if (step.type === 'fill') {
        candidates = analysis.inputs.filter(i => 
          this.calculateSimilarity(i.label, step.label) > 0.6
        );
      }
      
      if (candidates.length > 0) {
        // Use best matching candidate
        const best = candidates[0];
        console.log('[Recorder] Self-healed to:', best.text || best.label);
        
        return await this.executeSuggestedAction({
          ...step,
          selector: best.selector,
          healed: true
        });
      }
      
      return { success: false, error: 'Self-healing failed - no similar element found' };
    }

    /**
     * Calculate text similarity (simple)
     */
    calculateSimilarity(a, b) {
      if (!a || !b) return 0;
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      if (la === lb) return 1;
      if (la.includes(lb) || lb.includes(la)) return 0.8;
      // Simple word overlap
      const wordsA = la.split(/\s+/);
      const wordsB = lb.split(/\s+/);
      const overlap = wordsA.filter(w => wordsB.includes(w)).length;
      return overlap / Math.max(wordsA.length, wordsB.length);
    }

    /**
     * Wait for page to stabilize
     */
    async waitForStability(timeout = 2000) {
      return new Promise(resolve => {
        let stabilityTimer;
        const observer = new MutationObserver(() => {
          clearTimeout(stabilityTimer);
          stabilityTimer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 300);
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Timeout fallback
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, timeout);
        
        // Start stability timer
        stabilityTimer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 300);
      });
    }

    /**
     * Helper delay function
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    startRecording(options = {}) {
      if (this.recording) {
        console.log('[Recorder] Already recording, skipping');
        return;
      }
      
      console.log('[Recorder] startRecording called, initializing...');
      console.log('[Recorder] Document ready state:', document.readyState);
      console.log('[Recorder] Document body exists:', !!document.body);
      
      // Start recording IMMEDIATELY - no delays
      this.recording = true;
      this.actions = [];
      this.startTime = Date.now();
      this.startUrl = window.location.href;
      
      // CRITICAL: Reset navigation tracking state
      this.lastNavTime = Date.now();
      this.lastNavUrl = this.startUrl;
      this.recordedNavUrls = new Set([this.startUrl]);  // Mark start URL as recorded to prevent duplicates
      
      console.log('[Recorder] Recording started, URL:', this.startUrl);
      
      // Attach listeners FIRST (instant)
      // If document is not ready, wait for it
      if (document.readyState === 'loading') {
        console.log('[Recorder] Document still loading, waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
          console.log('[Recorder] DOMContentLoaded fired, attaching listeners now');
          this.attachEventListeners();
          this.showRecordingIndicator();
        }, { once: true });
      } else {
        console.log('[Recorder] Document ready, attaching listeners immediately');
        this.attachEventListeners();
        this.showRecordingIndicator();
      }
      
      // Set app (fast, synchronous)
      if (options.app && options.app !== 'auto') {
        this.smartSelector.setApp(options.app);
      } else {
        // Detect app asynchronously (non-blocking)
        setTimeout(() => {
          this.smartSelector.detectApp();
          this.updateRecordingIndicator();
        }, 0);
      }
      
      // Enable visual locators (fast)
      this.smartSelector.enableVisualLocators(options.useVisualLocators || false);
      
      // Setup DOM observer for dynamic pages (Agentic Phase 2)
      this.setupDOMObserver();
      
      // Analyze page after short delay (let DOM settle)
      setTimeout(() => {
        this.analyzeAndBroadcast();
      }, 500);
      
      console.log(`[Flowstral] Recording started immediately - App: ${this.smartSelector.appConfig.name}`);
    }

    stopRecording() {
      if (!this.recording) return;
      
      this.recording = false;
      this.flushPendingInput();
      this.detachEventListeners();
      this.hideRecordingIndicator();
      
      // Cleanup DOM observer (Agentic Phase 2)
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }
      
      console.log('[Playwright Recorder] Recording stopped', this.actions.length, 'actions');
    }

    attachEventListeners() {
      console.log('[Recorder] Attaching event listeners...');
      console.log('[Recorder] Document exists:', !!document);
      console.log('[Recorder] Window exists:', !!window);
      
      try {
        document.addEventListener('click', this.handleClick, true);
        document.addEventListener('dblclick', this.handleDblClick, true);
        document.addEventListener('input', this.handleInput, true);
        document.addEventListener('change', this.handleChange, true);
        document.addEventListener('keydown', this.handleKeydown, true);
        document.addEventListener('submit', this.handleSubmit, true);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        
        // Phase 2: Enhanced recording - hover, drag-drop, file upload
        document.addEventListener('mouseenter', this.handleHover, true);
        document.addEventListener('dragstart', this.handleDragStart, true);
        document.addEventListener('drop', this.handleDrop, true);
        
        this.observeUrlChanges();
        console.log('[Recorder] Event listeners attached successfully (including hover, drag-drop)');
      } catch (error) {
        console.error('[Recorder] Error attaching event listeners:', error);
      }
    }

    detachEventListeners() {
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('dblclick', this.handleDblClick, true);
      document.removeEventListener('input', this.handleInput, true);
      document.removeEventListener('change', this.handleChange, true);
      document.removeEventListener('keydown', this.handleKeydown, true);
      document.removeEventListener('submit', this.handleSubmit, true);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      
      // Phase 2: Enhanced recording
      document.removeEventListener('mouseenter', this.handleHover, true);
      document.removeEventListener('dragstart', this.handleDragStart, true);
      document.removeEventListener('drop', this.handleDrop, true);
      
      if (this.urlObserver) this.urlObserver.disconnect();
    }

    handleClick = (event) => {
      if (!this.recording) {
        console.log('[Recorder] Click ignored - not recording');
        return;
      }
      if (this.paused) {
        console.log('[Recorder] Click ignored - paused');
        return;
      }
      if (this.isRecorderElement(event.target)) {
        console.log('[Recorder] Click ignored - recorder element');
        return;
      }
      
      console.log('[Recorder] Click event captured on:', event.target.tagName, event.target.className);
      
      // Cancel any pending hover - click takes precedence over hover
      this.cancelPendingHover();
      
      this.flushPendingInput();
      
      // CRITICAL FIX: Find the ACTUAL interactive element, not just event.target
      // event.target might be a span/div inside a button - we need the button
      const element = this.findInteractiveElement(event.target);
      const tagName = element.tagName.toLowerCase();
      const type = element.type?.toLowerCase();
      
      console.log('[Recorder] Element details:', { tagName, type, id: element.id, className: element.className });
      
      // Skip click on actual radio/checkbox inputs - handleChange will record check/uncheck
      // But ONLY for actual input elements, not custom components
      if (tagName === 'input' && (type === 'radio' || type === 'checkbox')) {
        console.log('[Recorder] Click on input radio/checkbox - letting handleChange handle it');
        return; // Let handleChange handle it
      }
      
      // CRITICAL: Skip click on text/password/email/etc inputs - the fill action will be recorded instead
      // Recording click before fill creates redundant "Click Input" + "Fill" entries
      if (tagName === 'input' && !['radio', 'checkbox', 'submit', 'button', 'reset', 'file'].includes(type)) {
        console.log('[Recorder] Click on text/password input - letting handleInput record fill instead');
        return; // Fill action will be recorded by handleInput
      }
      
      // Skip click on textareas - fill action will be recorded
      if (tagName === 'textarea') {
        console.log('[Recorder] Click on textarea - letting handleInput record fill instead');
        return;
      }
      
      // Skip click on contenteditable elements - fill action will be recorded
      if (element.isContentEditable) {
        console.log('[Recorder] Click on contenteditable - letting handleInput record fill instead');
        return;
      }
      
      // Skip click if we just recorded a fill action on this same element (within 500ms)
      // This handles custom input components where click fires after input
      if (this.actions.length > 0) {
        const lastAction = this.actions[this.actions.length - 1];
        if (lastAction.type === 'fill' && Date.now() - lastAction.timestamp < 500) {
          const lastSel = this.normalizeSelector(this.getSelectorString(lastAction.selector));
          const currentSel = this.normalizeSelector(this.getSelectorString(this.smartSelector.getBestSelector(element)));
          if (lastSel && currentSel && lastSel === currentSel) {
            console.log('[Recorder] Click on just-filled element - skipping redundant click');
            return;
          }
        }
      }
      
      // CRITICAL: Skip clicks on generic container elements (div, span, section, etc.) that have no meaningful identifiers
      // These create useless "Click div" actions that always fail during playback
      const genericContainerTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];
      if (genericContainerTags.includes(tagName)) {
        // Only record if element has meaningful attributes
        const hasId = element.id && !element.id.match(/^\d+$/) && !element.id.match(/^(lwc|aura)-/i);
        const hasTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
        const hasRole = element.getAttribute('role');
        const hasName = element.getAttribute('name');
        const hasAriaLabel = element.getAttribute('aria-label');
        const hasClickableRole = hasRole && ['button', 'link', 'menuitem', 'tab', 'option'].includes(hasRole);
        const hasShortText = (element.textContent || '').trim().length > 0 && (element.textContent || '').trim().length < 50;
        
        // Skip if no meaningful identifiers
        if (!hasId && !hasTestId && !hasClickableRole && !hasName && !hasAriaLabel && !hasShortText) {
          console.log('[Recorder] Click on generic container without identifiers - skipping:', tagName);
          return;
        }
      }
      
      // For labels, we need to be careful - they might be:
      // 1. Standard labels for radio/checkbox (skip - let handleChange record)
      // 2. Custom component labels (record the click)
      if (tagName === 'label') {
        const associatedInput = element.querySelector('input[type="radio"], input[type="checkbox"]') ||
                                document.getElementById(element.getAttribute('for'));
        // Only skip if there's a real HTML input that will fire change event
        if (associatedInput && associatedInput.tagName === 'INPUT') {
          console.log('[Recorder] Click on label with associated input - letting handleChange handle it');
          return; // Let handleChange handle it
        }
        // Otherwise record the click (custom component)
        console.log('[Recorder] Click on label (no associated input) - recording click');
      }
      
      // For spans inside labels that wrap radio/checkboxes, skip
      // But be careful not to skip span clicks on custom components
      if (tagName === 'span') {
        const parentLabel = element.closest('label');
        if (parentLabel) {
          const associatedInput = parentLabel.querySelector('input[type="radio"], input[type="checkbox"]');
          if (associatedInput && associatedInput.tagName === 'INPUT') {
            console.log('[Recorder] Click on span inside label with input - letting handleChange handle it');
            return; // Let handleChange handle it
          }
        }
        console.log('[Recorder] Click on span - recording click');
      }
      
      const selector = this.smartSelector.getBestSelector(element);
      const elementAttrs = this.getElementAttributes(element);
      
      // Debug logging
      console.log('[Recorder] Click captured:', tagName, elementAttrs.innerText?.substring(0, 30));
      console.log('[Recorder] Selector generated:', selector?.playwright || selector?.selector || 'NO SELECTOR');
      
      if (!selector || (!selector.playwright && !selector.selector)) {
        console.warn('[Recorder] WARNING: No selector generated for element!', element);
      }
      
      var clickAction = {
        type: 'click',
        selector: selector,
        timestamp: Date.now(),
        description: this.generateDescription('Click', element),
        tagName: tagName,
        inputType: type,
        button: event.button === 2 ? 'right' : 'left',
        modifiers: this.getModifiers(event),
        app: selector.app,
        appName: selector.appName,
        triggersNavigation: this.mightTriggerNavigation(element),
        mightTriggerChange: true,
        // Include element attributes for backend selector building
        ...elementAttrs,
      };
      
      if (this.actionCoalescer) {
        var result = this.actionCoalescer.process(clickAction, element);
        if (result.pending) return;
        if (result.single) { this.addAction(result.single); return; }
        if (result.flushed) this.addAction(result.flushed);
        if (result.current) this.addAction(result.current);
        return;
      }
      this.addAction(clickAction);
    };

    handleDblClick = (event) => {
      if (!this.recording || this.paused || this.isRecorderElement(event.target)) return;
      
      // Use same interactive element detection as click
      const element = this.findInteractiveElement(event.target);
      const selector = this.smartSelector.getBestSelector(element);
      const currentSelectorStr = this.getSelectorString(selector);
      
      // BUG FIX #2: Only remove clicks if they're on the SAME element AND recent
      if (this.actions.length >= 2) {
        const last = this.actions[this.actions.length - 1];
        const prev = this.actions[this.actions.length - 2];
        const now = Date.now();
        
        // Verify both clicks are on the SAME element (using normalized selector comparison)
        const lastSel = this.normalizeSelector(this.getSelectorString(last.selector));
        const prevSel = this.normalizeSelector(this.getSelectorString(prev.selector));
        const currentSelNorm = this.normalizeSelector(currentSelectorStr);
        
        // Only remove if BOTH are clicks, BOTH match current element, AND within 500ms
        const isRecent = now - prev.timestamp < 500;
        
        if (last.type === 'click' && prev.type === 'click' && 
            lastSel === currentSelNorm && prevSel === currentSelNorm && isRecent) {
          this.actions.pop();
          this.actions.pop();
          console.log('[Recorder] Removed 2 clicks before dblclick on same element');
        }
      }
      
      this.addAction({
        type: 'dblclick',
        selector: selector,
        timestamp: Date.now(),
        description: this.generateDescription('Double-click', event.target),
        app: selector.app,
      });
    };

    handleInput = (event) => {
      if (!this.recording || this.paused || this.isRecorderElement(event.target)) return;
      
      let element = event.target;
      const value = element.value || '';
      
      // CRITICAL: Ensure we have a valid input element, not body/html
      const tagName = element.tagName?.toLowerCase();
      if (tagName === 'body' || tagName === 'html' || !tagName) {
        console.warn('[Recorder] Input event on invalid element:', tagName, '- finding actual input');
        // Try to find the actual focused input element
        const activeEl = document.activeElement;
        if (activeEl && ['input', 'textarea', 'select'].includes(activeEl.tagName?.toLowerCase())) {
          element = activeEl;
          console.log('[Recorder] Using activeElement instead:', activeEl.tagName);
        } else {
          console.warn('[Recorder] Could not find valid input element, skipping');
          return;
        }
      }
      
      if (this.pendingInput && this.pendingInput.element === element) {
        this.pendingInput.value = value;
        clearTimeout(this.inputTimeout);
      } else {
        this.flushPendingInput();
        const selector = this.smartSelector.getBestSelector(element);
        
        // Validate selector doesn't contain 'body'
        if (selector?.selector?.includes('body') || selector?.playwright?.includes('body')) {
          console.warn('[Recorder] Rejecting body selector for input, regenerating');
          // Force regenerate with the actual input element
        }
        
        this.pendingInput = {
          element: element,
          selector: selector,
          value: value,
          startTime: Date.now(),
        };
      }
      
      // Increased debounce to 1500ms to consolidate typing into single action
      // This prevents recording intermediate values like "m", "ma", "mad", "madh"...
      this.inputTimeout = setTimeout(() => this.flushPendingInput(), 1500);
    };

    handleChange = (event) => {
      if (!this.recording || this.paused || this.isRecorderElement(event.target)) return;
      
      const element = event.target;
      const tagName = element.tagName.toLowerCase();
      const type = element.type?.toLowerCase();
      
      // Debug logging
      console.log('[Recorder] Change captured:', tagName, type, element.value || element.checked);
      
      if (tagName === 'select') {
        const selector = this.smartSelector.getBestSelector(element);
        this.addAction({
          type: 'select',
          selector: selector,
          timestamp: Date.now(),
          description: this.generateDescription('Select', element),
          value: element.value,
          label: element.options[element.selectedIndex]?.textContent?.trim(),
          app: selector.app,
        });
      } else if (type === 'checkbox' || type === 'radio') {
        const selector = this.smartSelector.getBestSelector(element);
        const elementAttrs = this.getElementAttributes(element);
        
        // Remove any recent click on same element (check/uncheck replaces click)
        if (this.actions.length > 0) {
          const lastAction = this.actions[this.actions.length - 1];
          const lastSelector = lastAction.selector?.selector || '';
          const currentSelector = selector.selector || '';
          if (lastAction.type === 'click' && lastSelector === currentSelector && 
              Date.now() - lastAction.timestamp < 300) {
            this.actions.pop(); // Remove the click, we'll add check/uncheck
          }
        }
        
        // Also remove recent clicks on generic spans/labels (common checkbox wrappers)
        if (this.actions.length > 0) {
          const lastAction = this.actions[this.actions.length - 1];
          if (lastAction.type === 'click' && 
              ['span', 'label', 'div'].includes(lastAction.tagName?.toLowerCase()) &&
              Date.now() - lastAction.timestamp < 500) {
            this.actions.pop(); // Remove redundant wrapper click
          }
        }
        
        this.addAction({
          type: element.checked ? 'check' : 'uncheck',
          selector: selector,
          timestamp: Date.now(),
          description: this.generateDescription(element.checked ? 'Check' : 'Uncheck', element),
          tagName: tagName,
          inputType: type,
          app: selector.app,
          // Include element attributes for backend selector building
          ...elementAttrs,
        });
      } else if (type === 'file') {
        const selector = this.smartSelector.getBestSelector(element);
        this.addAction({
          type: 'upload',
          selector: selector,
          timestamp: Date.now(),
          description: `Upload files`,
          files: Array.from(element.files || []).map(f => f.name).join(', '),
          app: selector.app,
        });
      } else {
        // For any other change event (custom components, etc.), record it
        // This helps with Salesforce LWC and other custom elements
        const selector = this.smartSelector.getBestSelector(element);
        const elementAttrs = this.getElementAttributes(element);
        let value = element.value || element.getAttribute('value') || '';

        // SECURITY: Check if this is a sensitive field
        const isSensitive = this.isSensitiveField(element, type, elementAttrs);
        // CWS Compliance: Mask sensitive field values to protect user privacy
        if (isSensitive) {
          value = '[MASKED]';
        }
        const displayValue = isSensitive ? '••••••••' : value;
        
        // Only record if we have a meaningful value change
        if (value) {
          // BUG FIX #6: Check for existing fill action before creating duplicate
          const existingFillIndex = this.findExistingFillAction(selector);
          
          if (existingFillIndex >= 0) {
            // Update existing fill action instead of creating duplicate
            this.actions[existingFillIndex].value = value;
            this.actions[existingFillIndex].displayValue = displayValue;
            this.actions[existingFillIndex].isSensitive = isSensitive;
            this.actions[existingFillIndex].timestamp = Date.now();
            console.log('[Recorder] Updated existing fill from change event (deduped)');
            
            // Notify UI of update
            chrome.runtime.sendMessage({
              type: 'ACTION_UPDATED',
              actionIndex: existingFillIndex,
              action: this.actions[existingFillIndex],
              count: this.actions.length,
            }).catch(() => {});
          } else {
            this.addAction({
              type: 'fill',
              selector: selector,
              value: value,
              displayValue: displayValue,  // Masked for UI display
              isSensitive: isSensitive,    // Flag for security handling
              timestamp: Date.now(),
              description: this.generateDescription('Fill', element, { isSensitive, displayValue }),
              tagName: tagName,
              app: selector.app,
              ...elementAttrs,
            });
          }
        }
      }
    };

    handleKeydown = (event) => {
      if (!this.recording || this.paused) return;
      
      const specialKeys = ['Enter', 'Escape', 'Tab'];
      
      if (specialKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
        this.flushPendingInput();
        
        if (event.key === 'Enter') {
          const selector = this.smartSelector.getBestSelector(event.target);
          this.addAction({
            type: 'press',
            selector: selector,
            key: 'Enter',
            timestamp: Date.now(),
            description: 'Press Enter',
            isInForm: !!event.target.closest('form'),
            app: selector.app,
          });
        } else if (event.ctrlKey || event.metaKey) {
          const shortcut = this.formatShortcut(event);
          if (shortcut) {
            this.addAction({
              type: 'keyboard',
              method: 'press',
              key: shortcut,
              timestamp: Date.now(),
              description: `Press ${shortcut}`,
            });
          }
        }
      }
    };

    handleSubmit = () => {
      if (!this.recording || this.paused) return;
      this.flushPendingInput();
      if (this.actions.length > 0) {
        this.actions[this.actions.length - 1].triggersNavigation = true;
      }
    };

    handleBeforeUnload = () => {
      if (this.recording) {
        this.flushPendingInput();
        // Only send actions that haven't been synced yet
        // Background.js already receives each action via ACTION_RECORDED
        // This is just a safety backup in case some were missed
        if (this.actions.length > 0) {
          console.log('[Recorder] beforeUnload - sending', this.actions.length, 'actions as backup');
          chrome.runtime.sendMessage({ type: 'SAVE_ACTIONS', actions: this.actions });
        }
      }
    };

    // ==================== Phase 2: Enhanced Recording ====================
    
    // Track hover timing to only record intentional hovers (not just mouse passing)
    hoverTimeout = null;
    hoverElement = null;
    hoverRecorded = false; // Track if we recorded a hover to prevent duplicate
    
    handleHover = (event) => {
      if (!this.recording || this.paused) return;
      if (this.isRecorderElement(event.target)) return;

      // Use same interactive element detection as click
      const element = this.findInteractiveElement(event.target);
      const tagName = element.tagName.toLowerCase();

      // NEVER record hover on form elements - they're always filled/clicked, not hovered
      if (['input', 'textarea', 'select', 'label'].includes(tagName)) {
        return;
      }

      // NEVER record hover on links or buttons - these are always clicked, not hovered
      // Only record hover on elements that ONLY reveal content on hover (no click action)
      if (tagName === 'a' || tagName === 'button' || element.matches('[role="button"], [role="link"]')) {
        return;
      }
      
      // Only record hover on elements that specifically trigger tooltips/menus on hover
      // NOT elements that are typically clicked
      const hasHoverContent = element.matches([
        '[data-tooltip]',           // Explicit tooltip
        '[aria-describedby]',       // ARIA tooltip
        '.tooltip-trigger',         // CSS tooltip trigger
        '.hover-menu',              // Hover menu
        '.slds-dropdown-trigger',   // Salesforce dropdown trigger
        'lightning-helptext',       // Salesforce help text (info icons)
        '.slds-button_icon-bare',   // Salesforce icon-only buttons (info icons)
      ].join(','));
      
      // Also check if element has a title attribute that would show on hover
      const hasTitle = element.hasAttribute('title') && element.getAttribute('title').trim().length > 0;
      
      if (!hasHoverContent && !hasTitle) return;
      
      // Clear previous hover timeout
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }
      
      this.hoverElement = element;
      this.hoverRecorded = false;
      
      // Only record hover after 800ms to ensure it's intentional (not just passing by)
      this.hoverTimeout = setTimeout(() => {
        if (this.hoverElement === element && this.recording && !this.hoverRecorded) {
          // BUG FIX #7: Check element is still connected to DOM
          if (!element.isConnected) {
            console.log('[Recorder] Hover element removed from DOM, skipping');
            return;
          }
          
          const selector = this.smartSelector.getBestSelector(element);
          const elementAttrs = this.getElementAttributes(element);
          
          this.hoverRecorded = true;
          this.addAction({
            type: 'hover',
            selector: selector,
            timestamp: Date.now(),
            description: this.generateDescription('Hover', element),
            tagName: tagName,
            hasTooltip: hasTitle || !!element.getAttribute('data-tooltip'),
            hasDropdown: !!element.closest('.dropdown') || !!element.querySelector('.dropdown-menu'),
            app: selector.app,
            ...elementAttrs,
          });
        }
      }, 800); // Increased to 800ms for more intentional hovers
    };
    
    // Cancel hover recording when element is clicked (click takes precedence)
    cancelPendingHover = () => {
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      this.hoverElement = null;
      this.hoverRecorded = false;
    };
    
    // Drag and Drop recording
    dragSource = null;
    
    handleDragStart = (event) => {
      if (!this.recording || this.paused) return;
      if (this.isRecorderElement(event.target)) return;
      
      this.flushPendingInput();
      
      const element = event.target;
      const selector = this.smartSelector.getBestSelector(element);
      const elementAttrs = this.getElementAttributes(element);
      
      // Store drag source info for when drop happens
      this.dragSource = {
        element: element,
        selector: selector,
        elementAttrs: elementAttrs,
        timestamp: Date.now(),
      };
      
      console.log('[Recorder] Drag started:', element.tagName, selector?.playwright);
    };
    
    handleDrop = (event) => {
      if (!this.recording || this.paused) return;
      if (this.isRecorderElement(event.target)) return;
      if (!this.dragSource) return;
      
      const dropTarget = event.target;
      const targetSelector = this.smartSelector.getBestSelector(dropTarget);
      const targetAttrs = this.getElementAttributes(dropTarget);
      
      this.addAction({
        type: 'drag',
        sourceSelector: this.dragSource.selector,
        targetSelector: targetSelector,
        timestamp: Date.now(),
        description: `Drag from ${this.generateDescription('', this.dragSource.element)} to ${this.generateDescription('', dropTarget)}`,
        sourceTagName: this.dragSource.element.tagName.toLowerCase(),
        targetTagName: dropTarget.tagName.toLowerCase(),
        app: this.dragSource.selector.app,
        sourceElement: this.dragSource.elementAttrs,
        targetElement: targetAttrs,
      });
      
      console.log('[Recorder] Drop recorded:', this.dragSource.selector?.playwright, '->', targetSelector?.playwright);
      
      // Clear drag source
      this.dragSource = null;
    };
    
    // File Upload handling (enhanced change handler for file inputs)
    handleFileInput = (element) => {
      const files = element.files;
      if (!files || files.length === 0) return null;
      
      const fileNames = Array.from(files).map(f => f.name);
      const selector = this.smartSelector.getBestSelector(element);
      const elementAttrs = this.getElementAttributes(element);
      
      return {
        type: 'upload',
        selector: selector,
        files: fileNames,
        fileCount: files.length,
        timestamp: Date.now(),
        description: `Upload ${files.length} file(s): ${fileNames.join(', ')}`,
        tagName: 'input',
        inputType: 'file',
        app: selector.app,
        ...elementAttrs,
      };
    };

    // BUG FIX #4: Helper to add URL with size limit (prevents memory leak)
    addToRecordedNavUrls(url) {
      // Limit to last 100 URLs to prevent memory bloat in long sessions
      if (this.recordedNavUrls.size >= 100) {
        const oldest = this.recordedNavUrls.values().next().value;
        this.recordedNavUrls.delete(oldest);
        console.log('[Recorder] Pruned oldest URL from recordedNavUrls:', oldest);
      }
      this.recordedNavUrls.add(url);
    }
    
    observeUrlChanges() {
      let lastObservedUrl = window.location.href;
      
      this.urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastObservedUrl) {
          const now = Date.now();
          const urlChanged = window.location.href;
          lastObservedUrl = urlChanged;
          
          if (this.recording) {
            // CRITICAL: Debounce navigation events - Salesforce/SPAs do many rapid redirects
            // Only record if at least 3 seconds since last navigation (increased from 2)
            if (now - this.lastNavTime < 3000) {
              console.log('[Recorder] Skipping rapid navigation (debounce):', urlChanged);
              // Still re-analyze page but don't record duplicate navigate action
              setTimeout(() => this.analyzeAndBroadcast(), 500);
              return;
            }
            
            // CRITICAL: Skip if we've already recorded this exact URL
            if (this.recordedNavUrls.has(urlChanged)) {
              console.log('[Recorder] Skipping already recorded URL:', urlChanged);
              setTimeout(() => this.analyzeAndBroadcast(), 500);
              return;
            }
            
            // Skip intermediate auth/redirect pages (CASE-INSENSITIVE)
            const skipPatterns = [
              /\/secur\//i,           // Salesforce security pages
              /\/sessionserver/i,     // Session server redirects
              /\/identity\//i,        // Identity verification
              /\/login\//i,           // Login redirects
              /contentdoor/i,         // Content door pages (case-insensitive)
              /\/auth\//i,            // Auth redirects
              /\/oauth\//i,           // OAuth redirects
              /callback/i,            // OAuth callbacks
              /\/sso\//i,             // SSO redirects
              /\/setup\//i,           // Salesforce setup pages
              /aura\?/i,              // Lightning Aura requests
              /\/apexpages\//i,       // Apex pages redirects
              /lightning\/setup/i,    // Lightning setup
              /AddPhone/i,            // Phone verification pages
              /VerifyIdentity/i,      // Identity verification
            ];
            
            const isSkipUrl = skipPatterns.some(pattern => pattern.test(urlChanged));
            if (isSkipUrl) {
              console.log('[Recorder] Skipping auth/redirect page:', urlChanged);
              setTimeout(() => this.analyzeAndBroadcast(), 500);
              return;
            }
            
            // Update navigation state
            this.lastNavTime = now;
            this.lastNavUrl = urlChanged;
            this.addToRecordedNavUrls(urlChanged); // BUG FIX #4: Use helper with size limit
            
            this.addAction({
              type: 'navigate',
              url: urlChanged,
              timestamp: now,
              description: `Navigate to ${window.location.pathname}`,
            });

            // Re-analyze page after navigation (Agentic Phase 2)
            setTimeout(() => this.analyzeAndBroadcast(), 500);
          }
        }
      });
      
      // BUG FIX #3: Wait for body to exist before observing
      const startObserving = () => {
        if (document.body) {
          this.urlObserver.observe(document.body, { childList: true, subtree: true });
          console.log('[Recorder] URL observer attached to document.body');
        } else {
          // Retry after a short delay if body not ready
          console.log('[Recorder] document.body not ready, retrying in 100ms...');
          setTimeout(startObserving, 100);
        }
      };
      startObserving();
    }

    flushPendingInput() {
      if (!this.pendingInput) return;
      clearTimeout(this.inputTimeout);
      
      const element = this.pendingInput.element;
      
      // BUG FIX #1: Check if element is still in DOM (race condition protection)
      if (!element || !element.isConnected) {
        console.warn('[Recorder] Element detached before flush, using cached selector');
        // Still record with cached selector but skip element-dependent methods
        if (this.pendingInput.value && this.pendingInput.selector) {
          this.addAction({
            type: 'fill',
            selector: this.pendingInput.selector,
            value: this.pendingInput.value,
            displayValue: this.pendingInput.value,
            timestamp: this.pendingInput.startTime,
            description: 'Fill input (element detached)',
            app: this.pendingInput.selector?.app,
          });
        }
        this.pendingInput = null;
        return;
      }
      
      const tagName = element.tagName.toLowerCase();
      const type = element.type?.toLowerCase();
      
      // Don't record fill on radio/checkbox - use check instead
      if (tagName === 'input' && (type === 'radio' || type === 'checkbox')) {
        this.pendingInput = null;
        return;
      }
      
      if (this.pendingInput.value) {
        const elementAttrs = this.getElementAttributes(element);
        
        // SECURITY: Detect sensitive fields and mask the value for display
        const isSensitive = this.isSensitiveField(element, type, elementAttrs);
        // CWS Compliance: Mask sensitive field values to protect user privacy
        const maskedValue = isSensitive ? '[MASKED]' : this.pendingInput.value;
        const displayValue = isSensitive ? '••••••••' : this.pendingInput.value;

        // Check if we already have a fill action on the SAME element - update it instead of creating new
        const existingFillIndex = this.findExistingFillAction(this.pendingInput.selector);

        if (existingFillIndex >= 0) {
          // Update existing fill action with new value instead of adding duplicate
          this.actions[existingFillIndex].value = maskedValue;
          this.actions[existingFillIndex].displayValue = displayValue;
          this.actions[existingFillIndex].isSensitive = isSensitive;
          this.actions[existingFillIndex].timestamp = Date.now(); // Update timestamp
          console.log('[Recorder] Updated existing fill action instead of creating duplicate');
          
          // Notify UI of update
          chrome.runtime.sendMessage({
            type: 'ACTION_UPDATED',
            actionIndex: existingFillIndex,
            action: this.actions[existingFillIndex],
            count: this.actions.length,
          }).catch(() => {});
        } else {
          // Create new fill action
          this.addAction({
            type: 'fill',
            selector: this.pendingInput.selector,
            value: maskedValue,          // CWS Compliance: actual value masked for sensitive fields
            displayValue: displayValue,  // Masked value for UI display
            isSensitive: isSensitive,    // Flag for security handling
            timestamp: this.pendingInput.startTime,
            description: this.generateDescription('Fill', this.pendingInput.element, { isSensitive, displayValue }),
            tagName: tagName,
            inputType: type,
            app: this.pendingInput.selector.app,
            // Include element attributes for backend selector building
            ...elementAttrs,
          });
        }
      }
      this.pendingInput = null;
    }
    
    // SECURITY: Detect if a field contains sensitive data
    isSensitiveField(element, type, attrs) {
      // Check input type
      if (type === 'password') return true;
      
      // Check common sensitive field patterns
      const name = (element.name || '').toLowerCase();
      const id = (element.id || '').toLowerCase();
      const placeholder = (element.placeholder || '').toLowerCase();
      const label = (attrs?.label || '').toLowerCase();
      const allText = `${name} ${id} ${placeholder} ${label}`;
      
      const sensitivePatterns = [
        /password|passwd|pwd|pass/,
        /secret|token|api[_-]?key/,
        /credit[_-]?card|card[_-]?number|ccnum/,
        /cvv|cvc|security[_-]?code/,
        /ssn|social[_-]?security/,
        /pin|otp|verification[_-]?code/,
        /auth[_-]?code|access[_-]?token/,
        /private[_-]?key|secret[_-]?key/,
      ];
      
      return sensitivePatterns.some(pattern => pattern.test(allText));
    }
    
    // BUG FIX #5: Normalize selector for comparison (handles equivalent selectors)
    normalizeSelector(selectorStr) {
      if (!selectorStr) return '';
      return selectorStr
        .replace(/'/g, '"')                     // Normalize quotes
        .replace(/\s+/g, ' ')                   // Normalize whitespace
        .replace(/locator\s*\(\s*/g, 'locator(') // Normalize spacing in locator()
        .replace(/get_by_\s*/g, 'get_by_')      // Normalize get_by methods
        .trim()
        .toLowerCase();
    }
    
    // Find existing fill action on the same element (to consolidate inputs)
    findExistingFillAction(selector) {
      if (!selector) return -1;
      
      const selectorStr = this.getSelectorString(selector);
      if (!selectorStr) return -1;
      
      // Use normalized comparison for selectors
      const normalizedSelector = this.normalizeSelector(selectorStr);
      const now = Date.now();
      
      // Look for fill action on same element within last 30 seconds (not just last 5 actions)
      // This handles cases where user filled many other fields before coming back
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const action = this.actions[i];
        
        // Stop searching if action is too old (more than 30 seconds)
        if (now - action.timestamp > 30000) break;
        
        if (action.type === 'fill') {
          const actionSel = this.normalizeSelector(this.getSelectorString(action.selector));
          if (actionSel === normalizedSelector) {
            return i;
          }
        }
      }
      return -1;
    }

    addAction(action) {
      if (this.shouldSkipAction(action)) {
        console.log('[Recorder] Action skipped:', action.type, action.description);
        return;
      }

      // Remove any recent redundant action before adding new one
      this.removeRedundantActions(action);

      // Generate unique action ID for AI healing chain, false positive tracking, and manual assist
      if (!action.id) {
        const rand = Math.random().toString(36).substring(2, 6);
        action.id = `action_${Date.now()}_${rand}`;
      }

      this.actions.push(action);
      this.lastAction = action;
      
      console.log('[Recorder] Action added:', action.type, action.description, 'Total:', this.actions.length);
      
      chrome.runtime.sendMessage({
        type: 'ACTION_RECORDED',
        action: action,
        count: this.actions.length,
      }).then(response => {
        console.log('[Recorder] Action sent to background, response:', response);
      }).catch(error => {
        console.error('[Recorder] Failed to send action to background:', error);
      });
      
      this.updateRecordingIndicator();
    }

    shouldSkipAction(action) {
      // CRITICAL: Skip navigate actions to already-recorded URLs
      if (action.type === 'navigate') {
        if (this.recordedNavUrls && this.recordedNavUrls.has(action.url)) {
          console.log('[Recorder] Skipping already-recorded navigation URL:', action.url);
          return true;
        }
        // Also check skip patterns
        if (this.shouldSkipNavigationUrl && this.shouldSkipNavigationUrl(action.url)) {
          console.log('[Recorder] Skipping navigation to skip-pattern URL:', action.url);
          return true;
        }
      }
      
      if (!this.lastAction) return false;
      
      // Skip duplicate clicks on EXACT same element within 150ms (double-click prevention)
      if (action.type === 'click' && this.lastAction.type === 'click') {
        const actionSel = this.getSelectorString(action.selector);
        const lastSel = this.getSelectorString(this.lastAction.selector);
        // Only skip if exact same selector AND very short time gap (likely double event)
        if (actionSel && lastSel && actionSel === lastSel && action.timestamp - this.lastAction.timestamp < 150) {
          return true;
        }
      }
      
      // Skip fill on radio/checkbox inputs (change event handles these)
      if (action.type === 'fill' && action.tagName === 'input' && 
          (action.inputType === 'radio' || action.inputType === 'checkbox' ||
           action.elementType === 'radio' || action.elementType === 'checkbox')) {
        return true;
      }
      
      return false;
    }

    removeRedundantActions(newAction) {
      // Remove click before check/uncheck on same element
      if (newAction.type === 'check' || newAction.type === 'uncheck') {
        const newSel = this.getSelectorString(newAction.selector);
        for (let i = this.actions.length - 1; i >= 0; i--) {
          const existing = this.actions[i];
          if (existing.type === 'click' && newAction.timestamp - existing.timestamp < 500) {
            const existingSel = this.getSelectorString(existing.selector);
            if (existingSel === newSel) {
              console.log('[Recorder] Removing redundant click before check/uncheck');
              this.actions.splice(i, 1); // Remove the click
              break;
            }
          }
        }
      }
      
      // Remove duplicate navigations
      if (newAction.type === 'navigate') {
        for (let i = this.actions.length - 1; i >= 0; i--) {
          const existing = this.actions[i];
          if (existing.type === 'navigate' && existing.url === newAction.url) {
            this.actions.splice(i, 1); // Remove duplicate navigation
            break;
          }
        }
      }
    }

    getSelectorString(selector) {
      if (!selector) return '';
      if (typeof selector === 'string') return selector;
      return selector.selector || selector.playwright || '';
    }

    generateDescription(action, element, options = {}) {
      const { isSensitive = false, displayValue = null } = options;
      
      // Get meaningful label for the element
      const getElementLabel = (el) => {
        // Priority order for element identification:
        // 1. Explicit label via 'for' attribute
        const id = el.id;
        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) {
            const labelText = labelEl.textContent.trim();
            if (labelText && labelText.length <= 40) return labelText;
          }
        }
        // 2. Parent label element
        const parentLabel = el.closest('label');
        if (parentLabel) {
          const labelText = parentLabel.textContent.trim().replace(el.value || '', '').trim();
          if (labelText && labelText.length <= 40 && labelText.length > 0) return labelText;
        }
        // 3. Aria-label attribute
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.length <= 40) return ariaLabel;
        // 4. Placeholder attribute
        const placeholder = el.getAttribute('placeholder');
        if (placeholder && placeholder.length <= 40) return placeholder;
        // 5. Name attribute (formatted)
        const name = el.getAttribute('name');
        if (name && name.length <= 40) {
          // Convert camelCase or snake_case to readable format
          return name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        }
        // 6. Title attribute
        const title = el.getAttribute('title');
        if (title && title.length <= 40) return title;
        // 7. Fallback to element type
        return el.tagName.toLowerCase();
      };
      
      // For fill actions, include the field label and value
      if (action === 'Fill' && displayValue !== null) {
        const lockIcon = isSensitive ? '🔒 ' : '';
        const fieldLabel = getElementLabel(element);
        const val = displayValue.length > 20 ? displayValue.substring(0, 17) + '...' : displayValue;
        
        // Format: "🔒 Fill Password: ••••••••" or "Fill Email: test@example.com"
        if (fieldLabel && fieldLabel !== element.tagName.toLowerCase()) {
          return `${lockIcon}Fill ${fieldLabel}: "${val}"`;
        }
        return `${lockIcon}Fill input: "${val}"`;
      }
      
      const text = (element.textContent || '').trim().substring(0, 30);
      const label = element.getAttribute('aria-label') || element.getAttribute('placeholder');
      if (text) return `${action} "${text}${text.length >= 30 ? '...' : ''}"`;
      if (label) return `${action} ${label}`;
      return `${action} ${element.tagName.toLowerCase()}`;
    }

    getModifiers(event) {
      const mods = [];
      if (event.ctrlKey) mods.push('Control');
      if (event.shiftKey) mods.push('Shift');
      if (event.altKey) mods.push('Alt');
      if (event.metaKey) mods.push('Meta');
      return mods;
    }

    /**
     * Extract important element attributes for selector building in backend
     */
    getElementAttributes(element) {
      if (!element) return {};
      
      return {
        // Standard attributes
        id: element.id || null,
        name: element.getAttribute('name') || null,
        title: element.getAttribute('title') || null,
        placeholder: element.getAttribute('placeholder') || null,
        ariaLabel: element.getAttribute('aria-label') || null,
        role: element.getAttribute('role') || null,
        
        // Test IDs
        testId: element.getAttribute('data-testid') || 
                element.getAttribute('data-test-id') ||
                element.getAttribute('data-cy') ||
                element.getAttribute('data-test') || null,
        
        // Text content (trimmed)
        innerText: (element.innerText || '').trim().substring(0, 100),
        textContent: (element.textContent || '').trim().substring(0, 100),
        
        // Type info - RENAMED to avoid overwriting action 'type' when spread
        elementType: element.type || element.getAttribute('type') || null,
        tagName: element.tagName?.toLowerCase() || null,
        className: element.className || null,
        
        // Value (for inputs) - check both property and attribute
        // For radio buttons, getAttribute('value') is more reliable than element.value
        value: element.getAttribute('value') || element.value || null,
        
        // For labels
        forAttr: element.getAttribute('for') || null,
        
        // Href for links
        href: element.getAttribute('href') || null,
        
        // ARIA attributes
        ariaDescribedby: element.getAttribute('aria-describedby') || null,
        ariaLabelledby: element.getAttribute('aria-labelledby') || null,
      };
    }

    formatShortcut(event) {
      const parts = [];
      if (event.ctrlKey) parts.push('Control');
      if (event.shiftKey) parts.push('Shift');
      if (event.altKey) parts.push('Alt');
      if (event.metaKey) parts.push('Meta');
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
        parts.push(event.key);
        return parts.join('+');
      }
      return null;
    }

    mightTriggerNavigation(element) {
      const tag = element.tagName.toLowerCase();
      if (tag === 'a' && element.href) return true;
      if ((tag === 'button' || element.type === 'submit') && element.closest('form')) return true;
      return false;
    }
    
    /**
     * CRITICAL: Find the actual interactive element when user clicks
     * event.target might be a nested span/icon inside a button - we need the button
     * 
     * Uses shared findInteractiveElement from recorder-engine.js if available.
     * This ensures IDENTICAL behavior with the desktop Electron app.
     */
    findInteractiveElement(target) {
      // USE SHARED FUNCTION if available (single source of truth)
      if (sharedFindInteractiveElement) {
        return sharedFindInteractiveElement(target);
      }
      
      // Fallback to inline implementation
      if (!target || target === document.body || target === document.documentElement) {
        return target;
      }
      
      const interactiveSelectors = [
        'button', 'a[href]', '[role="button"]', '[role="link"]',
        '[role="menuitem"]', '[role="option"]', '[role="tab"]',
        '[role="checkbox"]', '[role="radio"]', 'input[type="submit"]',
        'input[type="button"]', '[tabindex="0"]', '[data-action]',
        '[onclick]', '.slds-button', 'lightning-button', 'lightning-button-icon',
      ];
      
      const targetTag = target.tagName.toLowerCase();
      if (['button', 'a', 'input', 'select', 'textarea'].includes(targetTag)) {
        return target;
      }
      if (target.getAttribute('role') && ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'].includes(target.getAttribute('role'))) {
        return target;
      }
      
      let current = target;
      let maxDepth = 10;
      
      while (current && current !== document.body && maxDepth > 0) {
        for (const selector of interactiveSelectors) {
          try {
            if (current.matches && current.matches(selector)) {
              return current;
            }
          } catch (e) {}
        }
        
        try {
          const style = window.getComputedStyle(current);
          if (style.cursor === 'pointer') {
            const hasText = current.textContent?.trim().length > 0 && current.textContent?.trim().length < 100;
            const tag = current.tagName.toLowerCase();
            if (hasText && !['span', 'svg', 'path', 'i'].includes(tag)) {
              return current;
            }
          }
        } catch (e) {}
        
        current = current.parentElement;
        maxDepth--;
      }
      
      if (['span', 'svg', 'path', 'i', 'img'].includes(targetTag)) {
        const parent = target.parentElement;
        if (parent && parent !== document.body) {
          const parentTag = parent.tagName.toLowerCase();
          if (['div', 'li', 'button', 'a'].includes(parentTag)) {
            const text = parent.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) {
              return parent;
            }
          }
        }
      }
      
      return target;
    }

    isRecorderElement(element) {
      return element.closest('#flowstral-indicator') !== null;
    }

    showRecordingIndicator() {
      if (document.getElementById('flowstral-indicator')) return;
      
      const indicator = document.createElement('div');
      indicator.id = 'flowstral-indicator';
      indicator.innerHTML = `
        <div class="flowstral-indicator-content">
          <span class="flowstral-recording-dot"></span>
          <span class="flowstral-text">FLOWSTRAL</span>
          <span class="flowstral-app">${this.smartSelector.appConfig.name}</span>
          <span class="flowstral-count">0</span>
        </div>
      `;
      document.body.appendChild(indicator);
    }

    hideRecordingIndicator() {
      document.getElementById('flowstral-indicator')?.remove();
    }

    updateRecordingIndicator() {
      const countEl = document.querySelector('#flowstral-indicator .flowstral-count');
      if (countEl) countEl.textContent = this.actions.length;
    }
  }

  // Initialize
  window.playwrightRecorder = new ActionRecorder();
  
  // Debug: Log page context
  console.log('[Recorder] Content script loaded in:', {
    url: window.location.href,
    isIframe: window.self !== window.top,
    readyState: document.readyState,
    hasShadowDOM: document.querySelector('*').shadowRoot !== undefined
  });
})();

