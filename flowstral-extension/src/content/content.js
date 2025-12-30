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
  // APP SELECTOR CONFIGURATIONS (Fallback if shared engine not loaded)
  // ============================================================================
  
  const AppSelectorConfig = SharedAppSelectorConfig || {
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
  // COMPUTER VISION
  // ============================================================================

  class ComputerVision {
    constructor() {
      this.fingerprints = new Map();
    }

    captureFingerprint(element) {
      try {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        const styles = window.getComputedStyle(element);
        
        return {
          bounds: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            aspectRatio: (rect.width / rect.height).toFixed(2),
          },
          styles: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            fontSize: styles.fontSize,
            borderRadius: styles.borderRadius,
          },
          position: {
            xPercent: ((rect.left + rect.width / 2) / window.innerWidth).toFixed(3),
            yPercent: ((rect.top + rect.height / 2) / window.innerHeight).toFixed(3),
            quadrant: this.getQuadrant(rect),
          },
          textHash: this.hashText(element.textContent || ''),
          tagName: element.tagName.toLowerCase(),
          structure: this.getStructureHash(element),
        };
      } catch (e) {
        return null;
      }
    }

    getQuadrant(rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const mx = window.innerWidth / 2;
      const my = window.innerHeight / 2;
      if (cx < mx && cy < my) return 'top-left';
      if (cx >= mx && cy < my) return 'top-right';
      if (cx < mx && cy >= my) return 'bottom-left';
      return 'bottom-right';
    }

    hashText(text) {
      const normalized = text.trim().toLowerCase().substring(0, 50);
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash = hash & hash;
      }
      return hash;
    }

    getStructureHash(element) {
      const children = element.children.length;
      const tag = element.tagName.toLowerCase();
      const depth = this.getDepth(element);
      return `${tag}-${children}-${depth}`;
    }

    getDepth(element, max = 5) {
      let depth = 0;
      let current = element;
      while (current.parentElement && depth < max) {
        depth++;
        current = current.parentElement;
      }
      return depth;
    }

    highlightElement(element) {
      const overlay = document.createElement('div');
      overlay.className = 'cv-highlight';
      const rect = element.getBoundingClientRect();
      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        border: '2px solid #667eea',
        pointerEvents: 'none',
        zIndex: '2147483646',
        borderRadius: '4px',
      });
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 300);
    }
  }

  // ============================================================================
  // SYNTHETIC DATA GENERATOR - Auto-generate realistic test data
  // Detects field types and generates appropriate values
  // ============================================================================

  class SyntheticDataGenerator {
    constructor() {
      // Seed data pools
      this.firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'James', 'Emma', 'Robert', 'Olivia', 'William', 'Sophia', 'Richard', 'Isabella', 'Thomas'];
      this.lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson'];
      this.domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'testmail.com'];
      this.streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Park Ave', 'Lake Dr', 'Hill Rd', 'Valley Way'];
      this.cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
      this.states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'];
      this.companies = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovation Labs', 'Digital Dynamics', 'Cloud Systems', 'Data Analytics Co', 'Smart Solutions'];
      this.jobTitles = ['Software Engineer', 'Product Manager', 'Designer', 'Analyst', 'Consultant', 'Director', 'Developer', 'Architect', 'Lead', 'Specialist'];
      
      // User-defined constraints (loaded from storage)
      this.constraints = {};
      this.loadConstraints();
    }
    
    /**
     * Load saved constraints from storage
     */
    async loadConstraints() {
      try {
        const stored = localStorage.getItem('qaai_data_constraints');
        if (stored) {
          this.constraints = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Could not load constraints:', e);
      }
    }
    
    /**
     * Save constraints to storage
     */
    saveConstraints() {
      try {
        localStorage.setItem('qaai_data_constraints', JSON.stringify(this.constraints));
      } catch (e) {
        console.warn('Could not save constraints:', e);
      }
    }
    
    /**
     * Set a constraint for a field type or specific field
     * @param {string} key - field type (e.g., 'year') or specific field name
     * @param {object} constraint - { min, max, format, options, pattern }
     */
    setConstraint(key, constraint) {
      this.constraints[key] = constraint;
      this.saveConstraints();
    }
    
    /**
     * Get constraint for a field
     */
    getConstraint(fieldType, fieldName) {
      // Check specific field name first, then field type
      return this.constraints[fieldName] || this.constraints[fieldType] || null;
    }
    
    /**
     * Extract constraints from HTML element attributes
     */
    extractElementConstraints(element) {
      const constraints = {};
      
      // HTML5 validation attributes
      if (element.min) constraints.min = parseFloat(element.min);
      if (element.max) constraints.max = parseFloat(element.max);
      if (element.minLength) constraints.minLength = parseInt(element.minLength);
      if (element.maxLength) constraints.maxLength = parseInt(element.maxLength);
      if (element.pattern) constraints.pattern = element.pattern;
      if (element.step) constraints.step = parseFloat(element.step);
      
      // For select/dropdown - get all options
      if (element.tagName === 'SELECT') {
        constraints.options = [...element.options]
          .filter(opt => opt.value && opt.value !== '')
          .map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim()
          }));
        constraints.isDropdown = true;
      }
      
      // For datalist (autocomplete suggestions)
      const datalistId = element.getAttribute('list');
      if (datalistId) {
        const datalist = document.getElementById(datalistId);
        if (datalist) {
          constraints.options = [...datalist.options].map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim() || opt.value
          }));
        }
      }
      
      // Check for date input constraints
      if (element.type === 'date' || element.type === 'datetime-local') {
        if (element.min) constraints.minDate = element.min;
        if (element.max) constraints.maxDate = element.max;
      }
      
      return Object.keys(constraints).length > 0 ? constraints : null;
    }
    
    /**
     * Scan a dropdown/select and get all options
     */
    getDropdownOptions(element) {
      if (element.tagName === 'SELECT') {
        return [...element.options]
          .filter(opt => opt.value && opt.value !== '' && !opt.disabled)
          .map(opt => ({
            value: opt.value,
            text: opt.textContent?.trim()
          }));
      }
      
      // Handle custom dropdowns (Salesforce, React Select, etc.)
      // Look for associated listbox or menu
      const id = element.id || element.getAttribute('aria-controls');
      if (id) {
        const listbox = document.querySelector(`[aria-labelledby="${id}"], [id="${id}"] [role="listbox"], [id="${id}"] [role="menu"]`);
        if (listbox) {
          const options = listbox.querySelectorAll('[role="option"], [role="menuitem"], li');
          return [...options].map(opt => ({
            value: opt.dataset.value || opt.textContent?.trim(),
            text: opt.textContent?.trim()
          }));
        }
      }
      
      return [];
    }

    /**
     * Detect field type from element attributes and context
     */
    detectFieldType(element) {
      const type = (element.type || '').toLowerCase();
      const name = (element.name || '').toLowerCase();
      const id = (element.id || '').toLowerCase();
      const placeholder = (element.placeholder || '').toLowerCase();
      const label = this.getAssociatedLabel(element).toLowerCase();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      
      const allText = `${name} ${id} ${placeholder} ${label} ${ariaLabel}`;
      
      // Check input type first
      if (type === 'email') return 'email';
      if (type === 'tel') return 'phone';
      if (type === 'number') return 'number';
      if (type === 'date') return 'date';
      if (type === 'datetime-local') return 'datetime';
      if (type === 'time') return 'time';
      if (type === 'url') return 'url';
      if (type === 'password') return 'password';
      
      // Pattern matching on field context
      if (/email|e-mail|correo/.test(allText)) return 'email';
      if (/phone|tel|mobile|cell|fax|telefono/.test(allText)) return 'phone';
      if (/first\s*name|fname|given\s*name|nombre/.test(allText)) return 'firstName';
      if (/last\s*name|lname|surname|family\s*name|apellido/.test(allText)) return 'lastName';
      if (/full\s*name|name|nombre\s*completo/.test(allText) && !/user|company|org/.test(allText)) return 'fullName';
      if (/username|user\s*name|login|usuario/.test(allText)) return 'username';
      if (/password|pwd|pass|contraseña/.test(allText)) return 'password';
      if (/company|organization|org\s*name|empresa/.test(allText)) return 'company';
      if (/job\s*title|position|role|title|cargo/.test(allText)) return 'jobTitle';
      if (/street|address\s*1|address\s*line|direccion/.test(allText)) return 'street';
      if (/city|ciudad/.test(allText)) return 'city';
      if (/state|province|estado/.test(allText)) return 'state';
      if (/zip|postal|code|codigo\s*postal/.test(allText)) return 'zipCode';
      if (/country|pais/.test(allText)) return 'country';
      if (/ssn|social\s*security/.test(allText)) return 'ssn';
      if (/credit\s*card|card\s*number|tarjeta/.test(allText)) return 'creditCard';
      if (/cvv|cvc|security\s*code/.test(allText)) return 'cvv';
      if (/expir|exp\s*date|vencimiento/.test(allText)) return 'expiryDate';
      
      // Date components - check BEFORE generic date
      if (/\bmonth\b|mes\b|mm\b/.test(allText)) return 'month';
      if (/\bday\b|dia\b|dd\b/.test(allText)) return 'day';
      if (/\byear\b|año\b|yyyy\b|yy\b|birth.*year|year.*birth/.test(allText)) return 'year';
      if (/\bdob\b|birth\s*date|date.*birth|fecha.*nacimiento/.test(allText)) return 'birthDate';
      
      if (/date|fecha/.test(allText)) return 'date';
      if (/age|edad/.test(allText)) return 'age';
      if (/amount|price|cost|total|monto|precio/.test(allText)) return 'currency';
      if (/quantity|qty|cantidad/.test(allText)) return 'quantity';
      if (/description|desc|comment|note|mensaje/.test(allText)) return 'text';
      if (/url|website|sitio/.test(allText)) return 'url';
      
      // Gender/Sex
      if (/gender|sex|genero/.test(allText)) return 'gender';
      
      // Default based on element type
      if (element.tagName === 'TEXTAREA') return 'text';
      if (type === 'text' || !type) return 'text';
      
      return 'text';
    }

    /**
     * Get associated label text for an element
     */
    getAssociatedLabel(element) {
      // Check for label with for attribute
      if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) return label.textContent || '';
      }
      // Check for parent label
      const parentLabel = element.closest('label');
      if (parentLabel) return parentLabel.textContent || '';
      // Check for aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.textContent || '';
      }
      return '';
    }

    /**
     * Generate random value from array
     */
    random(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generate random number in range
     */
    randomNum(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generate synthetic data based on field type and constraints
     * @param {string} fieldType 
     * @param {object} constraints - { min, max, minAge, maxAge, options, format, pattern }
     */
    generate(fieldType, constraints = {}) {
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(2, 8);
      const currentYear = new Date().getFullYear();
      
      // If we have dropdown options, pick from them
      if (constraints.options?.length > 0) {
        const selected = this.random(constraints.options);
        return selected.value || selected.text;
      }
      
      switch (fieldType) {
        case 'email':
          const domain = constraints.domain || this.random(this.domains);
          return `test.user${uniqueId}@${domain}`;
        
        case 'phone':
          return `+1${this.randomNum(200, 999)}${this.randomNum(200, 999)}${this.randomNum(1000, 9999)}`;
        
        case 'firstName':
          return this.random(this.firstNames);
        
        case 'lastName':
          return this.random(this.lastNames);
        
        case 'fullName':
          return `${this.random(this.firstNames)} ${this.random(this.lastNames)}`;
        
        case 'username':
          return `user_${uniqueId}`;
        
        case 'password':
          const minLen = constraints.minLength || 8;
          return `Test@${uniqueId}123!`.substring(0, Math.max(minLen, 12));
        
        case 'company':
          return this.random(this.companies);
        
        case 'jobTitle':
          return this.random(this.jobTitles);
        
        case 'street':
          return `${this.randomNum(100, 9999)} ${this.random(this.streets)}`;
        
        case 'city':
          return this.random(this.cities);
        
        case 'state':
          return this.random(this.states);
        
        case 'zipCode':
          return `${this.randomNum(10000, 99999)}`;
        
        case 'country':
          return 'United States';
        
        case 'ssn':
          // Fake SSN format (not valid)
          return `${this.randomNum(100, 999)}-${this.randomNum(10, 99)}-${this.randomNum(1000, 9999)}`;
        
        case 'creditCard':
          // Fake card number (not valid - starts with test prefix)
          return `4111-1111-1111-${this.randomNum(1000, 9999)}`;
        
        case 'cvv':
          return `${this.randomNum(100, 999)}`;
        
        case 'expiryDate':
          const futureYear = new Date().getFullYear() + this.randomNum(1, 5);
          return `${this.randomNum(1, 12).toString().padStart(2, '0')}/${futureYear.toString().slice(-2)}`;
        
        case 'month':
          // Use constraints if provided, else 1-12
          const minMonth = constraints.min || 1;
          const maxMonth = constraints.max || 12;
          if (constraints.format === 'name') {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
            return months[this.randomNum(minMonth - 1, maxMonth - 1)];
          }
          return `${this.randomNum(minMonth, maxMonth)}`;
        
        case 'day':
          // Use constraints if provided, else 1-28
          const minDay = constraints.min || 1;
          const maxDay = constraints.max || 28;
          return `${this.randomNum(minDay, maxDay)}`;
        
        case 'year':
          // Use age constraints (minAge/maxAge) to calculate year range
          const minAge = constraints.minAge || constraints.min || 18;
          const maxAge = constraints.maxAge || constraints.max || 65;
          const yearMin = currentYear - maxAge;
          const yearMax = currentYear - minAge;
          return `${this.randomNum(yearMin, yearMax)}`;
        
        case 'birthDate':
          // Use age constraints for birth date
          const bdMinAge = constraints.minAge || 18;
          const bdMaxAge = constraints.maxAge || 65;
          const bdYear = currentYear - this.randomNum(bdMinAge, bdMaxAge);
          const bdMonth = this.randomNum(1, 12);
          const bdDay = this.randomNum(1, 28);
          return `${bdYear}-${bdMonth.toString().padStart(2, '0')}-${bdDay.toString().padStart(2, '0')}`;
        
        case 'gender':
          const genderOptions = constraints.options || ['Male', 'Female', 'Other', 'Prefer not to say'];
          return this.random(genderOptions);
        
        case 'date':
          const date = new Date();
          date.setDate(date.getDate() + this.randomNum(-365, 365));
          return date.toISOString().split('T')[0];
        
        case 'datetime':
          const dt = new Date();
          dt.setDate(dt.getDate() + this.randomNum(-30, 30));
          return dt.toISOString().slice(0, 16);
        
        case 'time':
          return `${this.randomNum(0, 23).toString().padStart(2, '0')}:${this.randomNum(0, 59).toString().padStart(2, '0')}`;
        
        case 'age':
          return `${this.randomNum(18, 80)}`;
        
        case 'currency':
          return `${this.randomNum(10, 10000)}.${this.randomNum(0, 99).toString().padStart(2, '0')}`;
        
        case 'quantity':
          return `${this.randomNum(1, 100)}`;
        
        case 'number':
          return `${this.randomNum(1, 1000)}`;
        
        case 'url':
          return `https://www.${this.random(this.domains)}/page/${uniqueId}`;
        
        case 'text':
        default:
          const texts = [
            'This is a test entry',
            'Sample data for testing',
            'Automated test input',
            'Lorem ipsum dolor sit amet',
            'Test description here'
          ];
          return this.random(texts);
      }
    }

    /**
     * Analyze an element and return suggested test data with constraints
     */
    analyzeElement(element) {
      const fieldType = this.detectFieldType(element);
      const fieldName = element.name || element.id || '';
      
      // Get constraints from multiple sources
      const htmlConstraints = this.extractElementConstraints(element);
      const userConstraints = this.getConstraint(fieldType, fieldName);
      const mergedConstraints = { ...htmlConstraints, ...userConstraints };
      
      // For dropdowns, always pick from actual options
      let value, options = [];
      if (mergedConstraints.isDropdown || mergedConstraints.options?.length > 0) {
        options = mergedConstraints.options || this.getDropdownOptions(element);
        if (options.length > 0) {
          const selected = this.random(options);
          value = selected.value || selected.text;
        } else {
          value = this.generate(fieldType, mergedConstraints);
        }
      } else {
        value = this.generate(fieldType, mergedConstraints);
      }
      
      return {
        fieldType,
        fieldName,
        suggestedValue: value,
        confidence: this.getConfidence(element, fieldType),
        alternatives: this.getAlternatives(fieldType, mergedConstraints, options),
        constraints: mergedConstraints,
        hasOptions: options.length > 0,
        options: options.slice(0, 10)  // Include first 10 options for UI
      };
    }

    /**
     * Get confidence score for field type detection
     */
    getConfidence(element, fieldType) {
      const type = (element.type || '').toLowerCase();
      
      // High confidence if HTML type matches
      if (type === 'email' && fieldType === 'email') return 1.0;
      if (type === 'tel' && fieldType === 'phone') return 1.0;
      if (type === 'date' && fieldType === 'date') return 1.0;
      if (type === 'number' && fieldType === 'number') return 1.0;
      
      // Medium confidence for pattern matches
      if (fieldType !== 'text') return 0.8;
      
      // Low confidence for default text
      return 0.5;
    }

    /**
     * Get alternative values for a field type with constraints
     */
    getAlternatives(fieldType, constraints = {}, options = []) {
      // If we have dropdown options, return a sample of them
      if (options.length > 0) {
        const shuffled = [...options].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(5, options.length)).map(o => o.value || o.text);
      }
      
      // Generate 3 alternative values with constraints
      return [
        this.generate(fieldType, constraints),
        this.generate(fieldType, constraints),
        this.generate(fieldType, constraints)
      ];
    }

    /**
     * Generate test data for all input fields on page
     */
    generatePageTestData(inputs) {
      const testData = [];
      
      for (const input of inputs) {
        const analysis = this.analyzeElement(input.element || input);
        testData.push({
          fieldName: input.label || input.name || input.id || `field_${testData.length}`,
          fieldType: analysis.fieldType,
          selector: input.selectorObj?.playwright || input.selector,
          value: analysis.suggestedValue,
          alternatives: analysis.alternatives,
          confidence: analysis.confidence
        });
      }
      
      return testData;
    }
  }

  // Create global instance
  const syntheticDataGenerator = new SyntheticDataGenerator();

  // ============================================================================
  // PAGE ANALYZER - Agentic Page Understanding (Phases 1-4)
  // Supports 25+ enterprise apps with Shadow DOM traversal
  // ============================================================================

  class PageAnalyzer {
    constructor(smartSelector) {
      this.smartSelector = smartSelector;
      this.lastAnalysis = null;
      this.analysisCache = new Map();
    }

    /**
     * Deep query that pierces Shadow DOM - works for Salesforce, Workday, etc.
     */
    deepQuery(selector) {
      const results = [];
      const search = (root) => {
        try {
          results.push(...root.querySelectorAll(selector));
        } catch (e) {}
        // Traverse shadow roots
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            search(el.shadowRoot);
          }
        });
      };
      search(document);
      return results.filter(el => this.isVisible(el));
    }

    /**
     * Check if element is visible
     */
    isVisible(el) {
      if (!el) return false;
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
      } catch (e) {
        return false;
      }
    }

    /**
     * Main analysis method - returns complete page understanding
     */
    analyze() {
      const startTime = performance.now();
      
      // Detect app type using existing smart selector
      const appType = this.smartSelector?.currentApp || 'generic';
      const appConfig = AppSelectorConfig[appType] || AppSelectorConfig.generic;
      
      // Collect all interactive elements with Shadow DOM support
      const buttons = this.collectButtons();
      const links = this.collectLinks();
      const inputs = this.collectInputs();
      const headings = this.collectHeadings();
      
      // Classify page type
      const pageType = this.classifyPageType();
      
      // Build analysis result
      const analysis = {
        url: window.location.href,
        title: document.title,
        pageType,
        appType,
        appName: appConfig.name || 'Generic',
        
        // Element collections with selectors
        buttons,
        links,
        inputs,
        headings,
        
        // Summary counts
        counts: {
          buttons: buttons.length,
          links: links.length,
          inputs: inputs.length,
          headings: headings.length,
          total: buttons.length + links.length + inputs.length + headings.length
        },
        
        // Performance
        timing: (performance.now() - startTime).toFixed(2) + 'ms',
        analyzedAt: Date.now()
      };
      
      this.lastAnalysis = analysis;
      return analysis;
    }

    /**
     * Collect all buttons AND clickable elements with FULL selector data
     * Now includes clickable cards, divs, list items - not just standard buttons
     */
    collectButtons() {
      // Standard button selectors
      const standardButtons = this.deepQuery('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button, .slds-button');
      
      // Extended selectors for clickable elements (cards, options, etc.)
      const clickableElements = this.deepQuery([
        '[role="option"]',
        '[role="menuitem"]', 
        '[role="listitem"]',
        '[role="tab"]',
        '[role="radio"]',
        '[role="checkbox"]',
        '[tabindex="0"]',
        '[onclick]',
        '[data-action]',
        '[data-click]',
        '[data-testid*="button"]',
        '[data-testid*="card"]',
        '[data-testid*="option"]',
        // Common card/clickable patterns
        '.card[class*="clickable"]',
        '.card[class*="selectable"]',
        'div[class*="option"]',
        'div[class*="choice"]',
        'div[class*="select"]',
        'li[class*="option"]',
        'li[class*="item"][class*="click"]',
        // Cursor pointer detection via style
      ].join(', '));
      
      // Also find elements with cursor: pointer CSS
      const cursorPointerElements = Array.from(document.querySelectorAll('div, li, span, article, section'))
        .filter(el => {
          if (!this.isVisible(el)) return false;
          const style = window.getComputedStyle(el);
          const hasCursor = style.cursor === 'pointer';
          const hasText = this.getElementText(el)?.length > 0 && this.getElementText(el)?.length < 80;
          // Make sure it's a "leaf" clickable (not a container with clickable children)
          const hasNoClickableChildren = !el.querySelector('button, a, [role="button"]');
          return hasCursor && hasText && hasNoClickableChildren;
        });
      
      // Combine and deduplicate
      const allElements = [...standardButtons, ...clickableElements, ...cursorPointerElements];
      const seen = new Set();
      const uniqueElements = allElements.filter(el => {
        if (seen.has(el)) return false;
        seen.add(el);
        return true;
      });
      
      const seenTexts = new Map();  // Track text -> count for duplicates
      
      // Increased limit from 50 to 150 for comprehensive coverage
      return uniqueElements.slice(0, 150).map(el => {
        const text = this.getElementText(el);
        if (!text || text.length > 80) return null;
        
        // Track duplicates - don't skip, but mark them
        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);
        
        // Use the SAME getBestSelector as recording for robust selectors with fallbacks
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        // Determine element type for better labeling
        const tagName = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        let elementType = 'button';
        if (role === 'option' || role === 'radio' || role === 'checkbox') elementType = 'option';
        else if (role === 'tab') elementType = 'tab';
        else if (role === 'menuitem') elementType = 'menuitem';
        else if (tagName === 'div' || tagName === 'li') elementType = 'card';
        
        return {
          text,
          duplicateIndex: count,  // 0 = first, 1 = second, etc.
          tagName,
          elementType,
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateSelector(el, 'button', text),
          ariaLabel: el.getAttribute('aria-label'),
          disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
          id: el.id,
          className: el.className,
          name: el.name,
          role,
          // Add parent context for duplicate handling
          parentId: el.parentElement?.id,
          parentClass: el.parentElement?.className?.split(' ')[0],
        };
      }).filter(Boolean);
    }

    /**
     * Collect all links with FULL selector data (same as recording)
     * INCREASED LIMIT and better duplicate handling
     */
    collectLinks() {
      const elements = this.deepQuery('a[href]');
      const seenTexts = new Map();  // Track duplicates
      
      return elements.filter(el => {
        const text = this.getElementText(el);
        return text && text.length > 0 && text.length < 60 && !text.toLowerCase().includes('skip');
      }).slice(0, 100).map(el => {  // Increased from 30 to 100
        const text = this.getElementText(el);
        
        // Track duplicates - don't skip, but mark them
        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);
        
        // Use the SAME getBestSelector as recording
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        return {
          text,
          duplicateIndex: count,
          href: el.getAttribute('href'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateSelector(el, 'link', text),
          id: el.id,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          // Add context for duplicates
          parentId: el.parentElement?.id,
          parentClass: el.parentElement?.className?.split(' ')[0],
          // Location hint (header, footer, nav, main)
          location: this.getElementLocation(el),
        };
      }).filter(Boolean);
    }
    
    /**
     * Determine element location (header, footer, nav, main, etc.)
     */
    getElementLocation(el) {
      let current = el;
      while (current && current !== document.body) {
        const tag = current.tagName?.toLowerCase();
        const role = current.getAttribute('role');
        const className = (current.className || '').toString().toLowerCase();
        const id = (current.id || '').toLowerCase();
        
        // Check for header
        if (tag === 'header' || role === 'banner' || 
            className.includes('header') || className.includes('masthead') ||
            id.includes('header') || id.includes('masthead')) {
          return 'header';
        }
        
        // Check for footer - be very inclusive
        if (tag === 'footer' || role === 'contentinfo' || 
            className.includes('footer') || className.includes('site-footer') ||
            className.includes('bottom') || className.includes('copyright') ||
            id.includes('footer') || id.includes('bottom')) {
          return 'footer';
        }
        
        // Check for navigation
        if (tag === 'nav' || role === 'navigation' || 
            className.includes('nav') || className.includes('menu') ||
            className.includes('navigation') || id.includes('nav')) {
          return 'nav';
        }
        
        // Check for main content
        if (tag === 'main' || role === 'main' || 
            className.includes('main-content') || id === 'main' || id === 'content') {
          return 'main';
        }
        
        // Check for sidebar
        if (tag === 'aside' || role === 'complementary' || 
            className.includes('sidebar') || className.includes('aside')) {
          return 'sidebar';
        }
        
        current = current.parentElement;
      }
      return 'body';
    }

    /**
     * Collect all form inputs with FULL selector data (same as recording)
     * Handles standard inputs AND Salesforce/LWC custom components
     */
    collectInputs() {
      // Standard HTML inputs
      const standardInputs = this.deepQuery('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      
      // Also find role-based inputs (Salesforce LWC, custom components)
      const roleRadios = this.deepQuery('[role="radio"]');
      const roleCheckboxes = this.deepQuery('[role="checkbox"]');
      
      const results = [];
      const seenLabels = new Map();  // Track duplicates
      
      // Process standard inputs (increased from 20 to 50)
      standardInputs.slice(0, 50).forEach(el => {
        const label = this.getInputLabel(el);
        const type = el.type || el.tagName.toLowerCase();
        
        // Track duplicates - don't skip, mark them
        const labelKey = (label || '').toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        if (labelKey) seenLabels.set(labelKey, count + 1);
        
        // Use getBestSelector for robust selectors (same as recording)
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        // Determine the correct action type for this input
        // CRITICAL: Radio/checkbox should be 'click', not 'fill'
        let actionType = 'fill';
        if (type === 'radio' || type === 'checkbox') {
          actionType = 'click';  // Radio/checkbox are CLICKED, not filled
        } else if (type === 'select' || el.tagName.toLowerCase() === 'select') {
          actionType = 'select';
        }
        
        // Generate synthetic test data suggestion
        const dataAnalysis = syntheticDataGenerator.analyzeElement(el);
        
        results.push({
          label: label || el.name || el.placeholder || 'unlabeled',
          type,
          actionType,
          tagName: el.tagName.toLowerCase(),
          name: el.name,
          id: el.id,
          className: el.className,
          placeholder: el.placeholder,
          required: el.required,
          value: el.value?.substring(0, 50),
          // Full selector object for robust script generation
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateInputSelector(el, label),
          // Synthetic test data suggestions
          syntheticData: {
            detectedType: dataAnalysis.fieldType,
            suggestedValue: dataAnalysis.suggestedValue,
            confidence: dataAnalysis.confidence,
            alternatives: dataAnalysis.alternatives
          }
        });
      });
      
      // Process role="radio" elements (Salesforce LWC button groups) - increased to 30
      roleRadios.slice(0, 30).forEach(el => {
        const label = el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('data-value');
        if (!label || label.length > 50) return;
        
        // Track duplicates
        const labelKey = label.toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        seenLabels.set(labelKey, count + 1);
        
        // Use getBestSelector for robust selectors
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        results.push({
          label,
          type: 'radio',
          actionType: 'click',  // Radio buttons are CLICKED
          tagName: el.tagName.toLowerCase(),
          role: 'radio',
          ariaChecked: el.getAttribute('aria-checked'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('radio', { name: '${this.escapeSelector(label)}' })`,
          // Element metadata
          id: el.id,
          className: el.className,
        });
      });
      
      // Process role="checkbox" elements - increased to 30
      roleCheckboxes.slice(0, 30).forEach(el => {
        const label = el.textContent?.trim() || el.getAttribute('aria-label');
        if (!label || label.length > 50) return;
        
        // Track duplicates
        const labelKey = label.toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        seenLabels.set(labelKey, count + 1);
        
        // Use getBestSelector for robust selectors
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        results.push({
          label,
          type: 'checkbox',
          actionType: 'click',  // Checkboxes are CLICKED
          tagName: el.tagName.toLowerCase(),
          role: 'checkbox',
          ariaChecked: el.getAttribute('aria-checked'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('checkbox', { name: '${this.escapeSelector(label)}' })`,
          // Element metadata
          id: el.id,
          className: el.className,
        });
      });
      
      // Process Salesforce Lightning comboboxes and custom dropdowns
      const comboboxes = this.deepQuery([
        'lightning-combobox',
        'lightning-picklist',
        '[role="combobox"]',
        '[part="combobox"]',
        '.slds-combobox',
        '.slds-dropdown-trigger',
        '[data-type="picklist"]',
        // Generic custom dropdowns with labels
        '.combobox-container',
        '[class*="combobox"]',
        '[class*="dropdown"][class*="trigger"]'
      ].join(', '));
      
      comboboxes.slice(0, 30).forEach(el => {
        // Try multiple ways to find the label
        let label = el.getAttribute('label') || 
                    el.getAttribute('aria-label') ||
                    el.getAttribute('placeholder') ||
                    el.querySelector('label')?.textContent?.trim() ||
                    el.closest('.slds-form-element')?.querySelector('label')?.textContent?.trim() ||
                    el.closest('[class*="form-element"]')?.querySelector('label')?.textContent?.trim();
        
        // Check for "for" attribute on nearby labels
        if (!label && el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) label = labelEl.textContent?.trim();
        }
        
        if (!label || label.length > 60) return;
        
        // Skip if we already have this from standard inputs
        const labelKey = label.toLowerCase();
        if (seenLabels.has(labelKey)) return;
        seenLabels.set(labelKey, 1);
        
        // Use getBestSelector for robust selectors
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        results.push({
          label,
          type: 'combobox',
          actionType: 'click',  // Comboboxes are clicked to open
          tagName: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || 'combobox',
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('combobox', { name: '${this.escapeSelector(label)}' })`,
          // Element metadata
          id: el.id,
          className: el.className,
          elementType: 'dropdown',
        });
      });
      
      return results;
    }

    /**
     * Collect all headings with Playwright selectors
     * INCREASED LIMIT for comprehensive page coverage
     */
    collectHeadings() {
      // Include h4, h5, h6 for more comprehensive coverage
      const elements = this.deepQuery('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const seenTexts = new Map();
      
      // Increased from 10 to 30
      return elements.slice(0, 30).map(el => {
        const text = this.getElementText(el);
        if (!text || text.length > 80) return null;
        
        // Track duplicates
        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);
        
        const level = el.tagName.toLowerCase().replace('h', '') || el.getAttribute('aria-level') || '2';
        
        // Use getBestSelector for robust selectors
        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;
        
        return {
          text,
          level,
          duplicateIndex: count,
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('heading', { name: '${this.escapeSelector(text)}' })`,
          location: this.getElementLocation(el),
        };
      }).filter(Boolean);
    }

    /**
     * Generate Playwright selector for interactive element
     */
    generateSelector(el, role, text) {
      // Prefer role-based selectors (Playwright best practice)
      if (text && text.length < 50) {
        return `page.getByRole('${role}', { name: '${this.escapeSelector(text)}' })`;
      }
      
      // Fallback to aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        return `page.getByLabel('${this.escapeSelector(ariaLabel)}')`;
      }
      
      // Fallback to test ID
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
      if (testId) {
        return `page.getByTestId('${this.escapeSelector(testId)}')`;
      }
      
      // Use smart selector if available
      if (this.smartSelector) {
        const sel = this.smartSelector.getBestSelector(el);
        if (sel?.playwright) {
          return `page.${sel.playwright}`;
        }
      }
      
      return `page.getByRole('${role}', { name: '${this.escapeSelector(text || '')}' })`;
    }

    /**
     * Generate Playwright selector for input element
     */
    generateInputSelector(el, label) {
      // Prefer label-based selector
      if (label && label.length < 50) {
        return `page.getByLabel('${this.escapeSelector(label)}')`;
      }
      
      // Try placeholder
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) {
        return `page.getByPlaceholder('${this.escapeSelector(placeholder)}')`;
      }
      
      // Try name attribute
      const name = el.getAttribute('name');
      if (name) {
        return `page.locator('[name="${this.escapeSelector(name)}"]')`;
      }
      
      // Try aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        return `page.getByLabel('${this.escapeSelector(ariaLabel)}')`;
      }
      
      // Fallback to type
      const type = el.type || 'text';
      return `page.locator('input[type="${type}"]')`;
    }

    /**
     * Get accessible text from element
     */
    getElementText(el) {
      if (!el) return '';
      
      // Try aria-label first
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      
      // Try title
      const title = el.getAttribute('title');
      if (title) return title.trim();
      
      // Get visible text content
      let text = '';
      
      // For inputs, get value or placeholder
      if (el.tagName === 'INPUT') {
        text = el.value || el.placeholder || '';
      } else {
        // Get text content, excluding hidden children
        text = (el.textContent || '').trim();
      }
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      return text.substring(0, 60);
    }

    /**
     * Get label for input element
     */
    getInputLabel(el) {
      // Try aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      
      // Try associated label element
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return (label.textContent || '').trim();
      }
      
      // Try parent label
      const parentLabel = el.closest('label');
      if (parentLabel) {
        // Get text excluding input's own text
        const clone = parentLabel.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(i => i.remove());
        return (clone.textContent || '').trim();
      }
      
      // Try aria-labelledby
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return (labelEl.textContent || '').trim();
      }
      
      // Fallback to placeholder
      return el.placeholder || el.name || null;
    }

    /**
     * Classify page type based on content
     */
    classifyPageType() {
      const url = window.location.pathname.toLowerCase();
      const pageText = (document.body?.innerText || '').toLowerCase();
      
      // URL-based classification
      if (/login|signin|auth/.test(url)) return 'login';
      if (/dashboard|home|overview/.test(url)) return 'dashboard';
      if (/settings|preferences|config/.test(url)) return 'settings';
      if (/search|find|results/.test(url)) return 'search';
      if (/new|create|add/.test(url)) return 'create-form';
      if (/edit|update|modify/.test(url)) return 'edit-form';
      if (/details|view|show/.test(url)) return 'detail';
      if (/list|index|all/.test(url)) return 'list';
      
      // Content-based classification
      const hasLoginForm = pageText.includes('password') && (pageText.includes('login') || pageText.includes('sign in'));
      const hasForm = document.querySelector('form') !== null;
      const hasTable = document.querySelector('table, [role="grid"]') !== null;
      const hasSearch = document.querySelector('[type="search"], [role="searchbox"]') !== null;
      
      if (hasLoginForm) return 'login';
      if (hasTable) return 'list';
      if (hasSearch) return 'search';
      if (hasForm) return 'form';
      
      return 'generic';
    }

    /**
     * Generate Playwright assertion code for page validation
     */
    generateAssertions(maxAssertions = 10) {
      const analysis = this.lastAnalysis || this.analyze();
      const assertions = [];
      
      // Add heading assertions (most important)
      analysis.headings.slice(0, 3).forEach(h => {
        assertions.push({
          type: 'assert',
          action: 'toBeVisible',
          selector: h.selector,
          playwright: `await expect(${h.selector}).toBeVisible();`,
          python: `expect(${h.selector.replace('page.', 'page.')}).to_be_visible()`,
          description: `Heading: "${h.text}"`
        });
      });
      
      // Add key button assertions
      analysis.buttons.slice(0, 4).forEach(b => {
        if (!b.disabled) {
          assertions.push({
            type: 'assert',
            action: 'toBeVisible',
            selector: b.selector,
            playwright: `await expect(${b.selector}).toBeVisible();`,
            python: `expect(${b.selector.replace('page.', 'page.').replace(/getBy/g, 'get_by_').replace(/([A-Z])/g, '_$1').toLowerCase()}).to_be_visible()`,
            description: `Button: "${b.text}"`
          });
        }
      });
      
      // Add important link assertions
      analysis.links.slice(0, 3).forEach(l => {
        assertions.push({
          type: 'assert',
          action: 'toBeVisible',
          selector: l.selector,
          playwright: `await expect(${l.selector}).toBeVisible();`,
          python: `expect(${l.selector.replace('page.', 'page.').replace(/getBy/g, 'get_by_').replace(/([A-Z])/g, '_$1').toLowerCase()}).to_be_visible()`,
          description: `Link: "${l.text}"`
        });
      });
      
      return assertions.slice(0, maxAssertions);
    }

    /**
     * Escape special characters for selector strings
     */
    escapeSelector(str) {
      if (!str) return '';
      return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .trim();
    }
  }

  // ============================================================================
  // ENHANCED SMART SELECTOR
  // Uses shared SmartSelector from recorder-engine.js if available
  // ============================================================================

  class EnhancedSmartSelector {
    constructor() {
      // Use shared SmartSelector if available
      if (SharedSmartSelector) {
        this._sharedSelector = new SharedSmartSelector();
        this._sharedSelector.detectAndSetApp();
        this.currentApp = this._sharedSelector.currentApp;
        this.appConfig = this._sharedSelector.appConfig;
        console.log('[Recorder] Using shared SmartSelector, app:', this.currentApp);
      } else {
        this._sharedSelector = null;
        this.currentApp = 'generic';
        this.appConfig = AppSelectorConfig.generic;
      }
      this.computerVision = new ComputerVision();
      this.useVisualLocators = false;
    }

    setApp(appKey) {
      if (this._sharedSelector) {
        this._sharedSelector.setApp(appKey);
        this.currentApp = this._sharedSelector.currentApp;
        this.appConfig = this._sharedSelector.appConfig;
        return;
      }
      if (AppSelectorConfig[appKey]) {
        this.currentApp = appKey;
        this.appConfig = AppSelectorConfig[appKey];
        console.log(`[Recorder] App set to: ${this.appConfig.name}`);
      }
    }

    detectApp() {
      // Use shared detectApp if available
      if (sharedDetectApp) {
        const app = sharedDetectApp();
        this.setApp(app);
        return app;
      }
      
      const url = window.location.href;
      const w = window;
      const d = document;
      
      // Salesforce LWC (check first - more specific)
      if (d.querySelector('[class*="lwc-"]') || d.querySelector('lightning-')) {
        this.setApp('salesforce-lwc');
        return 'salesforce-lwc';
      }
      
      // Salesforce Aura/Lightning Classic
      if (d.querySelector('[data-aura-rendered-by]') || w.Aura || w.$A) {
        this.setApp('salesforce-aura');
        return 'salesforce-aura';
      }
      
      // Workday (check before generic React)
      if (d.querySelector('[data-automation-id]') && d.querySelector('wd-')) {
        this.setApp('workday');
        return 'workday';
      }
      
      // Dynamics 365
      if (w.Xrm || w.Mscrm || d.querySelector('[data-id*="fieldControl"]')) {
        this.setApp('dynamics365');
        return 'dynamics365';
      }
      
      // ServiceNow
      if (w.g_form || w.GlideRecord || d.querySelector('[id^="sys_"]')) {
        this.setApp('servicenow');
        return 'servicenow';
      }
      
      // SAP UI5/Fiori
      if (w.sap?.ui?.getCore || d.querySelector('[id^="__xmlview"]')) {
        this.setApp('sap-ui5');
        return 'sap-ui5';
      }
      
      // URL-based detection (fallback)
      for (const [key, config] of Object.entries(AppSelectorConfig)) {
        if (key === 'generic' || key === 'salesforce-lwc' || key === 'salesforce-aura' || 
            key === 'sap-ui5') continue;
        
        for (const pattern of config.detectPatterns || []) {
          if (pattern.test(url)) {
            // Also check for detectElements if available
            if (config.detectElements) {
              const hasElement = config.detectElements.some(sel => {
                try {
                  return d.querySelector(sel) !== null;
                } catch (e) {
                  return false;
                }
              });
              if (hasElement) {
                this.setApp(key);
                return key;
              }
            } else {
              this.setApp(key);
              return key;
            }
          }
        }
      }
      
      this.setApp('generic');
      return 'generic';
    }

    enableVisualLocators(enabled) {
      this.useVisualLocators = enabled;
    }

    getBestSelector(element) {
      // CRITICAL GUARD: Never generate selectors for body/html
      const tagName = element?.tagName?.toLowerCase();
      if (!element || tagName === 'body' || tagName === 'html') {
        console.warn('[Selector] Cannot generate selector for:', tagName || 'null element');
        // Try to find the actual active element
        const activeEl = document.activeElement;
        if (activeEl && activeEl !== document.body && activeEl.tagName) {
          console.log('[Selector] Using activeElement instead:', activeEl.tagName);
          element = activeEl;
        } else {
          // Return a placeholder that will be obvious in generated code
          return {
            selector: '[SELECTOR_NEEDED]',
            playwright: 'locator("[SELECTOR_NEEDED]")',
            type: 'error',
            confidence: 0,
            primary: { selector: '[SELECTOR_NEEDED]', playwright: 'locator("[SELECTOR_NEEDED]")', confidence: 0 },
            fallbacks: [],
            app: this.currentApp,
            appName: this.appConfig?.name || 'unknown',
          };
        }
      }
      
      const selectors = [];
      const isSalesforceApp = ['salesforce', 'salesforce-lwc', 'salesforce-aura'].includes(this.currentApp);
      
      // 0. Salesforce/LWC-optimized selectors (highest priority for that app)
      if (isSalesforceApp) {
        this.addSalesforceOptimizedSelectors(element, selectors);
      }
      
      // 1. App-specific selectors (HIGHEST PRIORITY)
      this.addAppSpecificSelectors(element, selectors);
      
      // 2. Standard test attributes
      this.addTestAttributes(element, selectors);
      
      // 3. ARIA selectors
      this.addAriaSelectors(element, selectors);
      
      // 4. Form selectors
      this.addFormSelectors(element, selectors);
      
      // 5. ID selector (with dynamic check)
      this.addIdSelector(element, selectors);
      
      // 6. Text selectors
      this.addTextSelectors(element, selectors);
      
      // 7. CSS selectors
      this.addCssSelectors(element, selectors);
      
      // 8. Visual fingerprint (if enabled) - DISABLED BY DEFAULT
      // Visual locators cause syntax errors in generated code
      // if (this.useVisualLocators) {
      //   this.addVisualSelector(element, selectors);
      // }

      // Verify uniqueness and sort
      this.rankSelectors(selectors, element);

      const best = selectors.find(s => s.uniqueMatch) || selectors[0] || {
        selector: this.buildFallbackSelector(element),
        playwright: `locator('${this.buildFallbackSelector(element)}')`,
        type: 'fallback',
        confidence: 10,
      };

      // CRITICAL FIX: Include more fallbacks, not just uniqueMatch ones
      // This enables runtime retry with multiple strategies (title, aria-label, text, etc.)
      const fallbackCandidates = selectors
        .filter(s => s !== best) // Exclude primary
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0)) // Sort by confidence
        .slice(0, 6); // Take top 6 fallbacks
      
      // Also add title-based selector if element has title (critical for Salesforce App Launcher)
      const title = element.getAttribute('title');
      if (title && title.length > 0 && title.length < 50) {
        const titleSelector = {
          type: 'title',
          selector: `[title="${this.escape(title)}"]`,
          playwright: `locator('[title="${this.escape(title)}"]')`,
          confidence: 90,
          description: `By title: ${title}`,
        };
        if (!fallbackCandidates.some(s => s.selector === titleSelector.selector)) {
          fallbackCandidates.unshift(titleSelector); // Add at front (high priority)
        }
      }

      return {
        primary: best,
        fallbacks: fallbackCandidates,
        app: this.currentApp,
        appName: this.appConfig.name,
        visualFingerprint: this.useVisualLocators ? this.computerVision.captureFingerprint(element) : null,
        ...best,
      };
    }

    /**
     * Salesforce/LWC optimized selector strategy (text/role/label first, avoid dynamic IDs)
     */
    addSalesforceOptimizedSelectors(element, selectors) {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const ariaLabel = element.getAttribute('aria-label');
      const title = element.getAttribute('title');
      const nameAttr = element.getAttribute('name');
      const valueAttr = element.getAttribute('value');
      const visibleText = this.getVisibleText(element);
      const classes = Array.from(element.classList || []);
      const hasSLDS = classes.some(c => c.startsWith('slds-'));

      // 1) Text/Role for interactive elements
      if (visibleText && visibleText.length >= 2 && visibleText.length <= 80) {
        if (tag === 'button' || role === 'button' || hasSLDS) {
          selectors.push({
            type: 'role',
            selector: `getByRole('button', { name: '${this.escape(visibleText)}' })`,
            playwright: `getByRole('button', { name: '${this.escape(visibleText)}' })`,
            confidence: 1,
            description: `SF Button by text`
          });
        }
        if (tag === 'a' || role === 'link') {
          selectors.push({
            type: 'role',
            selector: `getByRole('link', { name: '${this.escape(visibleText)}' })`,
            playwright: `getByRole('link', { name: '${this.escape(visibleText)}' })`,
            confidence: 1,
            description: `SF Link by text`
          });
        }
        // Generic clickable text
        selectors.push({
          type: 'text',
          selector: null,
          playwright: `getByText('${this.escape(visibleText)}', { exact: true })`,
          confidence: 2,
          description: `SF Text exact`
        });
      }

      // 2) Label / aria-label
      if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) {
        selectors.push({
          type: 'label',
          selector: null,
          playwright: `getByLabel('${this.escape(ariaLabel)}')`,
          confidence: 2,
          description: `SF aria-label`
        });
      }

      // 3) Name attribute (stable in SF)
      if (nameAttr && !this.isDynamic(nameAttr)) {
        selectors.push({
          type: 'attribute',
          selector: `[name="${this.escape(nameAttr)}"]`,
          playwright: `locator('[name="${this.escape(nameAttr)}"]')`,
          confidence: 3,
          description: `SF name`
        });
      }

      // 4) Radio/checkbox value
      if ((element.type === 'radio' || element.type === 'checkbox') && valueAttr && !this.isDynamic(valueAttr)) {
        selectors.push({
          type: 'attribute',
          selector: `input[value="${this.escape(valueAttr)}"]`,
          playwright: `locator('input[value="${this.escape(valueAttr)}"]')`,
          confidence: 2,
          description: `SF input value`
        });
      }

      // 5) Title
      if (title && title.length > 1) {
        selectors.push({
          type: 'attribute',
          selector: `[title="${this.escape(title)}"]`,
          playwright: `locator('[title="${this.escape(title)}"]')`,
          confidence: 3,
          description: `SF title`
        });
      }

      // 6) Stable SF data attrs
      const sfAttrs = [
        'data-target-selection-name',
        'data-field',
        'field-name',
        'data-record-id',
        'data-object-api-name'
      ];
      sfAttrs.forEach(attr => {
        const val = element.getAttribute(attr);
        if (val && !this.isDynamic(val)) {
          selectors.push({
            type: 'sf-attribute',
            selector: `[${attr}="${this.escape(val)}"]`,
            playwright: `locator('[${attr}="${this.escape(val)}"]')`,
            confidence: 3,
            description: `SF ${attr}`
          });
        }
      });

      // 7) LWC parent + text
      const lwcParent = this.findLWCParent(element);
      if (lwcParent && visibleText && visibleText.length <= 80) {
        const tagName = lwcParent.tagName.toLowerCase();
        selectors.push({
          type: 'lwc-text',
          selector: null,
          playwright: `locator('${tagName}').getByText('${this.escape(visibleText)}')`,
          confidence: 4,
          description: `LWC parent text`
        });
      }

      // 8) SLDS class fallback
      if (hasSLDS) {
        const stable = classes.find(c => c.startsWith('slds-') && c.length > 6 && !this.isDynamic(c));
        if (stable) {
          selectors.push({
            type: 'slds',
            selector: `.${stable}`,
            playwright: `locator('.${stable}')`,
            confidence: 8,
            description: `SF SLDS class`
          });
        }
      }
    }

    findLWCParent(element) {
      let current = element;
      while (current && current !== document.body) {
        if (current.tagName && current.tagName.toLowerCase().startsWith('lightning-')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    addAppSpecificSelectors(element, selectors) {
      const strategies = this.appConfig.strategies || [];
      
      for (const strategy of strategies) {
        const value = element.getAttribute(strategy.attr);
        if (value) {
          // Check if this selector matches avoid patterns
          if (this.isProblematicSelector(value, strategy.attr)) {
            continue; // Skip problematic selectors
          }
          
          const selector = `[${strategy.attr}="${this.escape(value)}"]`;
          const playwrightCode = typeof strategy.playwright === 'function' 
            ? strategy.playwright(value)
            : (strategy.useTestId 
                ? `getByTestId('${this.escape(value)}')`
                : `locator('[${strategy.attr}="${this.escape(value)}"]')`);
          
          selectors.push({
            type: `app-${this.currentApp}`,
            selector: selector,
            playwright: playwrightCode,
            confidence: strategy.priority,
            description: `${this.appConfig.name}: ${strategy.attr}`,
          });
        }
      }
      
      // Special handling for Salesforce LWC
      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce-aura') {
        const tagName = element.tagName.toLowerCase();
        const title = element.getAttribute('title');
        const ariaLabel = element.getAttribute('aria-label');
        
        // CRITICAL: Special handling for Salesforce App Launcher
        // This is a common failure point - the waffle icon button
        if (title === 'App Launcher' || ariaLabel === 'App Launcher' ||
            element.closest('[title="App Launcher"]') || 
            element.closest('[aria-label="App Launcher"]')) {
          selectors.push({
            type: 'salesforce-app-launcher',
            selector: 'button[title="App Launcher"]',
            playwright: `locator('button[title="App Launcher"]')`,
            confidence: 100,
            description: 'Salesforce: App Launcher button',
          });
          selectors.push({
            type: 'salesforce-app-launcher-fallback',
            selector: '[aria-label="App Launcher"]',
            playwright: `get_by_role('button', name='App Launcher')`,
            confidence: 95,
            description: 'Salesforce: App Launcher by role',
          });
          selectors.push({
            type: 'salesforce-app-launcher-css',
            selector: '.appLauncher button, .slds-icon-waffle_container button',
            playwright: `locator('.appLauncher button, .slds-icon-waffle_container button')`,
            confidence: 85,
            description: 'Salesforce: App Launcher by class',
          });
        }
        
        // Check for lightning-* components
        if (tagName.startsWith('lightning-')) {
          const name = element.getAttribute('name');
          const label = element.getAttribute('label');
          if (name) {
            selectors.push({
              type: 'app-salesforce-lwc-component',
              selector: `${tagName}[name="${this.escape(name)}"]`,
              playwright: `locator('${tagName}[name="${this.escape(name)}"]')`,
              confidence: 95,
              description: `Salesforce LWC: ${tagName} with name`,
            });
          }
          if (label) {
            selectors.push({
              type: 'app-salesforce-lwc-component',
              selector: `${tagName}[label="${this.escape(label)}"]`,
              playwright: `locator('${tagName}[label="${this.escape(label)}"]')`,
              confidence: 90,
              description: `Salesforce LWC: ${tagName} with label`,
            });
          }
        }
        
        // For radio groups, prefer text-based selection
        if (tagName === 'lightning-radio-group' || element.closest('lightning-radio-group')) {
          const text = this.getVisibleText(element);
          if (text && text.length < 50) {
            selectors.push({
              type: 'app-salesforce-lwc-radio',
              selector: null,
              playwright: `locator('lightning-radio-group').getByText('${this.escape(text)}')`,
              confidence: 85,
              description: `Salesforce LWC: Radio group by text`,
            });
          }
        }
      }

      // Check for app-specific tag prefixes
      const tagName = element.tagName.toLowerCase();
      if (this.appConfig.tagPrefix && tagName.startsWith(this.appConfig.tagPrefix)) {
        const label = element.getAttribute('label') || element.getAttribute('name');
        if (label) {
          selectors.push({
            type: `app-${this.currentApp}-component`,
            selector: `${tagName}[label="${this.escape(label)}"]`,
            playwright: `locator('${tagName}[label="${this.escape(label)}"]')`,
            confidence: 90,
            description: `${this.appConfig.name} component: ${tagName}`,
          });
        }
      }

      // Check for app-specific class prefixes
      if (this.appConfig.classPrefix) {
        const classes = Array.from(element.classList);
        for (const prefix of this.appConfig.classPrefix) {
          const matchingClass = classes.find(c => c.startsWith(prefix));
          if (matchingClass) {
            const text = (element.textContent || '').trim().substring(0, 30);
            if (text) {
              selectors.push({
                type: `app-${this.currentApp}-class`,
                selector: `.${matchingClass}`,
                playwright: `locator('.${matchingClass}').filter({ hasText: '${this.escape(text)}' })`,
                confidence: 70,
                description: `${this.appConfig.name} class: ${matchingClass}`,
              });
            }
          }
        }
      }

      // Check for app-specific ID prefixes
      if (this.appConfig.idPrefix && element.id?.startsWith(this.appConfig.idPrefix)) {
        selectors.push({
          type: `app-${this.currentApp}-id`,
          selector: `#${element.id}`,
          playwright: `locator('#${this.escape(element.id)}')`,
          confidence: 95,
          description: `${this.appConfig.name} ID: ${element.id}`,
        });
      }
    }

    addTestAttributes(element, selectors) {
      const testAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];
      
      for (const attr of testAttrs) {
        const value = element.getAttribute(attr);
        if (value) {
          selectors.push({
            type: 'test-attr',
            selector: `[${attr}="${this.escape(value)}"]`,
            playwright: attr === 'data-testid' 
              ? `getByTestId('${this.escape(value)}')`
              : `locator('[${attr}="${this.escape(value)}"]')`,
            confidence: 95,
            description: `Test ID: ${value}`,
          });
        }
      }
    }

    addAriaSelectors(element, selectors) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        selectors.push({
          type: 'aria-label',
          selector: `[aria-label="${this.escape(ariaLabel)}"]`,
          playwright: `getByLabel('${this.escape(ariaLabel)}')`,
          confidence: 85,
          description: `ARIA: ${ariaLabel}`,
        });
      }

      const role = element.getAttribute('role') || this.getImplicitRole(element);
      if (role) {
        const name = this.getAccessibleName(element);
        if (name && name.length < 50) {
          selectors.push({
            type: 'role',
            playwright: `getByRole('${role}', { name: '${this.escape(name)}' })`,
            confidence: 80,
            description: `Role: ${role} "${name}"`,
          });
        }
      }
    }

    addFormSelectors(element, selectors) {
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) {
        selectors.push({
          type: 'placeholder',
          selector: `[placeholder="${this.escape(placeholder)}"]`,
          playwright: `getByPlaceholder('${this.escape(placeholder)}')`,
          confidence: 75,
          description: `Placeholder: ${placeholder}`,
        });
      }

      const name = element.getAttribute('name');
      if (name && !this.isDynamic(name)) {
        selectors.push({
          type: 'name',
          selector: `[name="${this.escape(name)}"]`,
          playwright: `locator('[name="${this.escape(name)}"]')`,
          confidence: 70,
          description: `Name: ${name}`,
        });
      }
    }

    addIdSelector(element, selectors) {
      const id = element.id;
      if (id) {
        // Check if ID matches avoid patterns for this app
        if (this.isProblematicSelector(id, 'id')) {
          return; // Skip problematic IDs
        }
        
        // Check if it's a dynamic ID
        if (this.isDynamic(id)) {
          return; // Skip dynamic IDs
        }
        
        selectors.push({
          type: 'id',
          selector: `#${this.escapeCSS(id)}`,
          playwright: `locator('#${this.escape(id)}')`,
          confidence: 65,
          description: `ID: ${id}`,
        });
      }
    }

    addTextSelectors(element, selectors) {
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const text = (element.textContent || '').trim().substring(0, 50);
      
      // For buttons and links, use getByRole with name
      if (['button', 'a'].includes(tagName) || role === 'button' || role === 'link') {
        if (text && text.length < 40) {
          const roleType = tagName === 'a' || role === 'link' ? 'link' : 'button';
          selectors.push({
            type: 'text',
            playwright: `getByRole('${roleType}', { name: '${this.escape(text)}' })`,
            confidence: 60,
            description: `Text: "${text}"`,
          });
        }
      }
      
      // For spans with text (especially Salesforce radio/checkbox labels), use getByText
      // This handles span.slds-radio_faux and similar elements
      if (tagName === 'span' && text && text.length > 0 && text.length < 40) {
        // Check if this is a radio/checkbox label span in Salesforce
        const isSalesforceRadioLabel = element.classList.contains('slds-radio_faux') ||
                                        element.classList.contains('slds-checkbox_faux') ||
                                        element.closest('lightning-radio-group') ||
                                        element.closest('lightning-checkbox-group');
        
        if (isSalesforceRadioLabel || element.closest('label')) {
          // Use getByText for better uniqueness
          selectors.push({
            type: 'text-span',
            playwright: `getByText('${this.escape(text)}', { exact: true })`,
            confidence: 85, // Higher priority for text-based selection
            description: `Text: "${text}"`,
          });
          
          // Also add a locator with text filter for reliability
          const parentSelector = this.getParentContext(element);
          if (parentSelector) {
            selectors.push({
              type: 'text-filtered',
              playwright: `locator('${parentSelector}').filter({ hasText: '${this.escape(text)}' })`,
              confidence: 80,
              description: `Filtered: "${text}"`,
            });
          }
        }
      }

      if (tagName === 'img') {
        const alt = element.getAttribute('alt');
        if (alt) {
          selectors.push({
            type: 'alt',
            selector: `img[alt="${this.escape(alt)}"]`,
            playwright: `getByAltText('${this.escape(alt)}')`,
            confidence: 60,
            description: `Alt: ${alt}`,
          });
        }
      }
    }
    
    getParentContext(element) {
      // Get a parent selector for context (lightning-radio-group, form, etc.)
      const radioGroup = element.closest('lightning-radio-group');
      if (radioGroup) {
        const name = radioGroup.getAttribute('name');
        if (name) return `lightning-radio-group[name="${this.escape(name)}"]`;
      }
      
      const checkboxGroup = element.closest('lightning-checkbox-group');
      if (checkboxGroup) {
        const name = checkboxGroup.getAttribute('name');
        if (name) return `lightning-checkbox-group[name="${this.escape(name)}"]`;
      }
      
      const label = element.closest('label');
      if (label) {
        const forAttr = label.getAttribute('for');
        if (forAttr) return `label[for="${this.escape(forAttr)}"]`;
      }
      
      return null;
    }

    addCssSelectors(element, selectors) {
      const cssSelector = this.buildStableCssSelector(element);
      if (cssSelector) {
        selectors.push({
          type: 'css',
          selector: cssSelector,
          playwright: `locator('${this.escape(cssSelector)}')`,
          confidence: 45,
          description: `CSS: ${cssSelector}`,
        });
      }
    }

    addVisualSelector(element, selectors) {
      const fingerprint = this.computerVision.captureFingerprint(element);
      if (fingerprint) {
        selectors.push({
          type: 'visual',
          visualFingerprint: fingerprint,
          playwright: `// Visual locator: ${fingerprint.tagName} at ${fingerprint.position.quadrant}`,
          confidence: 30,
          description: `Visual: ${fingerprint.position.quadrant} (${fingerprint.bounds.width}x${fingerprint.bounds.height})`,
        });
        
        this.computerVision.highlightElement(element);
      }
    }

    rankSelectors(selectors, element) {
      for (const sel of selectors) {
        if (sel.selector) {
          try {
            const matches = document.querySelectorAll(sel.selector);
            sel.uniqueMatch = matches.length === 1 && matches[0] === element;
            sel.matchCount = matches.length;
            if (!sel.uniqueMatch && sel.matchCount > 1) {
              sel.confidence *= 0.5;
            }
          } catch (e) {
            sel.uniqueMatch = false;
          }
        } else {
          sel.uniqueMatch = true;
        }
      }
      selectors.sort((a, b) => b.confidence - a.confidence);
    }

    buildStableCssSelector(element) {
      const tag = element.tagName.toLowerCase();
      const classes = Array.from(element.classList)
        .filter(c => !this.isDynamic(c))
        .slice(0, 2);
      
      if (classes.length === 0) return null;
      
      const selector = `${tag}.${classes.join('.')}`;
      try {
        const matches = document.querySelectorAll(selector);
        // ONLY return CSS selector if it matches exactly 1 element
        // This prevents strict mode violations in Playwright
        if (matches.length === 1 && matches[0] === element) {
          return selector;
        }
        // If multiple matches, don't return this selector - let other strategies handle it
        return null;
      } catch (e) {}
      return null;
    }

    buildFallbackSelector(element) {
      // PREFER TEXT-BASED SELECTORS OVER POSITIONAL ONES
      
      const tag = element.tagName?.toLowerCase() || 'unknown';
      
      // CRITICAL: NEVER return 'body', 'html', or 'document' - these are NEVER valid selectors
      if (tag === 'body' || tag === 'html' || tag === 'document' || !element.tagName) {
        console.warn('[Selector] Rejecting invalid element:', tag);
        return 'input'; // Return a placeholder that will fail gracefully
      }
      
      // For input elements, prioritize input-specific attributes
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const type = element.getAttribute('type') || 'text';
        const name = element.getAttribute('name');
        const placeholder = element.getAttribute('placeholder');
        const id = element.id;
        
        // Try name first (most reliable for forms)
        if (name && !this.isDynamic(name)) {
          return `${tag}[name="${this.escape(name)}"]`;
        }
        // Try id
        if (id && !this.isDynamic(id)) {
          return `#${this.escapeCSS(id)}`;
        }
        // Try placeholder
        if (placeholder) {
          return `${tag}[placeholder="${this.escape(placeholder)}"]`;
        }
        // Try type + nth-of-type
        return `${tag}[type="${type}"]`;
      }
      
      // First, try to find text content for the element
      const text = this.getVisibleText(element);
      if (text && text.length > 2 && text.length < 50) {
        // Check if text is unique on page
        try {
          const matches = document.querySelectorAll(`*:not(script):not(style)`);
          let textMatches = 0;
          for (const el of matches) {
            const elText = (el.textContent || '').trim();
            if (elText === text) textMatches++;
          }
          if (textMatches <= 3) {
            // Text is reasonably unique, return a text-based selector
            return `text="${this.escape(text)}"`;
          }
        } catch (e) {}
      }
      
      // Try to find a unique parent with an ID or name
      let current = element;
      let depth = 0;
      while (current && current !== document.body && depth < 5) {
        const id = current.id;
        const name = current.getAttribute('name');
        const dataTestId = current.getAttribute('data-testid');
        
        if (id && !this.isDynamic(id)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `#${this.escapeCSS(id)} ${relPath}`;
          }
        }
        if (name && !this.isDynamic(name)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `[name="${this.escape(name)}"] ${relPath}`;
          }
        }
        if (dataTestId && !this.isDynamic(dataTestId)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `[data-testid="${this.escape(dataTestId)}"] ${relPath}`;
          }
        }
        
        current = current.parentElement;
        depth++;
      }
      
      // Last resort: use tag with role or nth-of-type (NEVER just 'body')
      const role = element.getAttribute('role');
      if (role) {
        return `${tag}[role="${role}"]`;
      }
      
      // Return tag with :first-of-type to make it more specific
      // NEVER return just 'body' or 'html'
      // NOTE: ':first' alone is NOT valid CSS - must use ':first-child' or ':first-of-type'
      if (tag === 'body' || tag === 'html') {
        return 'div'; // Fallback to div, which will fail gracefully
      }
      
      return `${tag}:first-of-type`;
    }
    
    getRelativePath(target, ancestor) {
      // Get a simple relative path from ancestor to target
      const tag = target.tagName.toLowerCase();
      const directChild = target.parentElement === ancestor;
      if (directChild) {
        return tag;
      }
      
      // Simple child selector
      const parentTag = target.parentElement?.tagName.toLowerCase() || '';
      if (parentTag && target.parentElement?.parentElement === ancestor) {
        return `${parentTag} ${tag}`;
      }
      
      return tag;
    }
    
    getVisibleText(element) {
      // Get visible text from element, excluding nested elements
      if (!element) return '';
      
      // For inputs, try to get associated label
      if (element.tagName.toLowerCase() === 'input') {
        const id = element.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return (label.textContent || '').trim();
        }
      }
      
      // For labels containing inputs, get text excluding the input
      if (element.tagName.toLowerCase() === 'label') {
        const clone = element.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.remove());
        return (clone.textContent || '').trim();
      }
      
      // For buttons and links, get direct text
      const directText = Array.from(element.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(' ')
        .trim();
      
      if (directText) return directText;
      
      // Fallback to full text content
      return (element.textContent || '').trim().substring(0, 50);
    }

    getImplicitRole(el) {
      const map = { button: 'button', a: 'link', input: 'textbox', select: 'combobox', textarea: 'textbox' };
      return map[el.tagName.toLowerCase()];
    }

    getAccessibleName(el) {
      return el.getAttribute('aria-label') || el.getAttribute('title') || 
             (el.textContent || '').trim().substring(0, 50);
    }

    isDynamic(str) {
      if (!str) return false;
      
      // App-specific dynamic ID patterns
      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce') {
        // Salesforce LWC dynamic patterns
        if (/^(radio|checkbox|input)-\d+(-\d+)?$/.test(str)) {
          return true;
        }
      }
      
      if (this.currentApp === 'sap-ui5' || this.currentApp === 'sap') {
        // SAP UI5 dynamic patterns
        if (/^__xmlview\d+--/.test(str) || /^__button\d+$/.test(str) || /^__clone\d+$/.test(str)) {
          return true;
        }
      }
      
      // Generic dynamic patterns
      const patterns = [
        /^[a-f0-9]{8,}$/i, /^\d{6,}$/, /^:r[0-9a-z]+:$/,
        /^ember\d+$/, /^ng-/, /^vue-/, /^react-/,
        /^css-[a-z0-9]+$/i, /^sc-[a-z]+$/i, /^_[a-z0-9]{5,}$/i,
        /^gwt-uid-\d+$/,              // GWT
        /^ext-comp-\d+$/,             // ExtJS
        /^wd-[A-F0-9-]+$/i,           // Workday UUIDs
      ];
      return patterns.some(p => p.test(str));
    }
    
    /**
     * Check if a selector value matches problematic patterns for this app
     */
    isProblematicSelector(value, attrType) {
      if (!value) return false;
      
      // CRITICAL: Skip simple numeric data-id values (like "1", "2", "123")
      // These are often dynamically assigned by frameworks and not stable
      if (attrType === 'data-id' && /^\d{1,4}$/.test(value)) {
        console.log(`[Flowstral] Skipping simple numeric data-id: ${value}`);
        return true;
      }
      
      // Check against avoid patterns if they exist
      if (this.appConfig.avoidPatterns) {
        for (const pattern of this.appConfig.avoidPatterns) {
          if (pattern.test(value)) {
            return true;
          }
        }
      }
      
      // App-specific checks
      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce') {
        // Avoid radio-1-71, checkbox-85 patterns
        if (attrType === 'id' && (/^(radio|checkbox|input)-\d+-\d+$/.test(value) || 
            /^(radio|checkbox|input)-\d+$/.test(value))) {
          return true;
        }
        // Avoid lwc-* classes
        if (attrType === 'class' && /^lwc-[a-z0-9]+$/i.test(value)) {
          return true;
        }
      }
      
      return false;
    }

    escape(str) {
      return (str || '').replace(/['\\]/g, '\\$&').replace(/\n/g, '\\n');
    }

    escapeCSS(str) {
      return (str || '').replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
    }
  }

  // ============================================================================
  // ACTION RECORDER
  // ============================================================================

  class ActionRecorder {
    constructor() {
      this.smartSelector = new EnhancedSmartSelector();
      this.pageAnalyzer = new PageAnalyzer(this.smartSelector);
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
      
      this.addAction({
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
      });
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
        const value = element.value || element.getAttribute('value') || '';
        
        // SECURITY: Check if this is a sensitive field
        const isSensitive = this.isSensitiveField(element, type, elementAttrs);
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
        const displayValue = isSensitive ? '••••••••' : this.pendingInput.value;
        
        // Check if we already have a fill action on the SAME element - update it instead of creating new
        const existingFillIndex = this.findExistingFillAction(this.pendingInput.selector);
        
        if (existingFillIndex >= 0) {
          // Update existing fill action with new value instead of adding duplicate
          this.actions[existingFillIndex].value = this.pendingInput.value;
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
            value: this.pendingInput.value,
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

