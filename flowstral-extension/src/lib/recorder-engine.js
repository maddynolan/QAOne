/**
 * Flowstral Recorder Engine - SINGLE SOURCE OF TRUTH
 * 
 * Shared between:
 * - Web Extension (content.js imports this)
 * - Desktop App (embedded-browser.js loads and injects this)
 * 
 * DO NOT DUPLICATE THIS LOGIC ANYWHERE!
 * All recording behavior must be defined here.
 * 
 * @version 2.0.0
 * @author Flowstral Team
 */

(function(exports) {
  'use strict';

  // Silent mode for Salesforce - avoid triggering security warnings
  var _isSalesforce = typeof window !== 'undefined' && ((window.location.href || '').indexOf('salesforce') >= 0 || (window.location.href || '').indexOf('force.com') >= 0);
  var _log = function() { 
    if (!_isSalesforce && typeof console !== 'undefined' && console.log) { 
      try { console.log.apply(console, arguments); } catch(e){} 
    } 
  };

  // ============================================================================
  // APP SELECTOR CONFIGURATIONS
  // Complete configuration for 30+ enterprise applications
  // ============================================================================

  const AppSelectorConfig = {
    'salesforce-lwc': {
      name: 'Salesforce LWC',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      detectElements: ['[class*="lwc-"]', 'lightning-'],
      strategies: [
        { attr: 'name', priority: 100, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
        { attr: 'title', priority: 95, playwright: function(val) { return 'locator(\'[title="' + val + '"]\')'; } },
        { attr: 'aria-label', priority: 90, playwright: function(val) { return 'getByLabel(\'' + val + '\')'; } },
        { attr: 'data-target-selection-name', priority: 85, playwright: function(val) { return 'locator(\'[data-target-selection-name="' + val + '"]\')'; } },
        { attr: 'field-name', priority: 80, playwright: function(val) { return 'locator(\'[field-name="' + val + '"]\')'; } },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /input-\d+/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      customWait: 'domcontentloaded',
    },
    'salesforce-aura': {
      name: 'Salesforce Aura',
      detectPatterns: [/force\.com/i, /salesforce\.com/i],
      detectElements: ['[data-aura-rendered-by]'],
      strategies: [
        { attr: 'data-aura-id', priority: 100, playwright: function(val) { return 'locator(\'[data-aura-id="' + val + '"]\')'; } },
        { attr: 'name', priority: 95, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
        { attr: 'title', priority: 90, playwright: function(val) { return 'locator(\'[title="' + val + '"]\')'; } },
      ],
      avoidPatterns: [/data-aura-rendered-by/, /\d+:\d+;[a-z]/, /globalId;\d+/],
      customWait: 'domcontentloaded',
    },
    salesforce: {
      name: 'Salesforce',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      strategies: [
        { attr: 'name', priority: 100, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
        { attr: 'title', priority: 95, playwright: function(val) { return 'locator(\'[title="' + val + '"]\')'; } },
        { attr: 'aria-label', priority: 90, playwright: function(val) { return 'getByLabel(\'' + val + '\')'; } },
        { attr: 'data-aura-id', priority: 85, playwright: function(val) { return 'locator(\'[data-aura-id="' + val + '"]\')'; } },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      customWait: 'domcontentloaded',
    },
    servicenow: {
      name: 'ServiceNow',
      detectPatterns: [/service-now\.com/i, /servicenow\.com/i],
      detectElements: ['[id^="sys_"]', '[class*="glide"]'],
      strategies: [
        { attr: 'name', priority: 100, playwright: function(val) {
          if (val.indexOf('.') >= 0) return 'locator(\'[name="' + val + '"]\')';
          return 'locator(\'[name*="' + val + '"]\')';
        }},
        { attr: 'data-field', priority: 95, playwright: function(val) { return 'locator(\'[data-field="' + val + '"]\')'; } },
        { attr: 'aria-label', priority: 90, playwright: function(val) { return 'locator(\'[aria-label="' + val + '"]\')'; } },
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
        { attr: 'data-automation-id', priority: 100, playwright: function(val) { return 'locator(\'[data-automation-id="' + val + '"]\')'; } },
        { attr: 'data-automation-label', priority: 95, playwright: function(val) { return 'locator(\'[data-automation-label="' + val + '"]\')'; } },
        { attr: 'data-uxi-widget-type', priority: 90, playwright: function(val) { return 'locator(\'[data-uxi-widget-type="' + val + '"]\')'; } },
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
        { attr: 'id', priority: 100, playwright: function(val) {
          if (val.indexOf('--') >= 0) {
            var suffix = val.split('--').pop();
            return 'locator(\'[id$="--' + suffix + '"]\')';
          }
          return 'locator(\'[id="' + val + '"]\')';
        }},
        { attr: 'data-sap-ui', priority: 95, playwright: function(val) { return 'locator(\'[data-sap-ui="' + val + '"]\')'; } },
        { attr: 'title', priority: 90, playwright: function(val) { return 'locator(\'[title="' + val + '"]\')'; } },
      ],
      avoidPatterns: [/__xmlview\d+--/, /__button\d+/, /__clone\d+/],
      classPrefix: ['sapM', 'sapUi'],
      customWait: 'networkidle',
    },
    dynamics365: {
      name: 'Microsoft Dynamics 365',
      detectPatterns: [/dynamics\.com/i, /crm\.dynamics/i],
      detectElements: ['[data-id*="fieldControl"]', '[class*="MscrmControls"]'],
      strategies: [
        { attr: 'data-id', priority: 100, playwright: function(val) { return 'locator(\'[data-id="' + val + '"]\')'; } },
        { attr: 'data-control-name', priority: 95, playwright: function(val) { return 'locator(\'[data-control-name="' + val + '"]\')'; } },
        { attr: 'aria-label', priority: 90, playwright: function(val) { return 'locator(\'[aria-label="' + val + '"]\')'; } },
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
    angular: {
      name: 'Angular',
      detectPatterns: [/angular/i],
      detectElements: ['[ng-reflect-', '[_ngcontent-', '[_nghost-'],
      strategies: [
        { attr: 'data-cy', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
        { attr: 'formcontrolname', priority: 90, playwright: function(val) { return 'locator(\'[formcontrolname="' + val + '"]\')'; } },
        { attr: 'name', priority: 85, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
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
        { attr: 'name', priority: 85, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
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
        { attr: 'name', priority: 85, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
      ],
      avoidPatterns: [/data-v-[a-f0-9]+/],
      customWait: 'networkidle',
    },
    generic: {
      name: 'Generic Web App',
      detectPatterns: [],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'name', priority: 85, playwright: function(val) { return 'locator(\'[name="' + val + '"]\')'; } },
        { attr: 'id', priority: 80, playwright: function(val) { return 'locator(\'#' + val + '\')'; } },
        { attr: 'aria-label', priority: 75, playwright: function(val) { return 'getByLabel(\'' + val + '\')'; } },
      ],
      customWait: 'networkidle',
    }
  };

  // ============================================================================
  // APP DETECTION
  // ============================================================================

  function detectApp() {
    var url = (window.location.href || '').toLowerCase();
    var d = document;
    var w = window;

    // Salesforce LWC (most specific)
    if (d.querySelector('[class*="lwc-"]') || d.querySelector('lightning-')) {
      return 'salesforce-lwc';
    }
    // Salesforce Aura
    if (d.querySelector('[data-aura-rendered-by]') || w.Aura || w.$A) {
      return 'salesforce-aura';
    }
    // Workday
    if (d.querySelector('[data-automation-id]') && (url.indexOf('workday') >= 0 || d.querySelector('wd-'))) {
      return 'workday';
    }
    // Dynamics 365
    if (w.Xrm || w.Mscrm || d.querySelector('[data-id*="fieldControl"]')) {
      return 'dynamics365';
    }
    // ServiceNow
    if (w.g_form || w.GlideRecord || d.querySelector('[id^="sys_"]')) {
      return 'servicenow';
    }
    // SAP UI5/Fiori
    if ((w.sap && w.sap.ui && w.sap.ui.getCore) || d.querySelector('[id^="__xmlview"]')) {
      return 'sap-ui5';
    }
    // Generic Salesforce (URL-based)
    if (url.indexOf('salesforce') >= 0 || url.indexOf('force.com') >= 0 || url.indexOf('lightning.force') >= 0) {
      return 'salesforce';
    }
    // URL-based detection for other apps
    var apps = ['servicenow', 'workday', 'jira', 'zendesk', 'hubspot', 'netsuite', 'shopify'];
    for (var i = 0; i < apps.length; i++) {
      if (url.indexOf(apps[i]) >= 0) {
        return apps[i];
      }
    }
    // Framework detection
    if (d.querySelector('[ng-reflect-') || d.querySelector('[_ngcontent-')) {
      return 'angular';
    }
    if (d.querySelector('[data-reactroot]') || d.querySelector('[data-reactid]')) {
      return 'react';
    }
    if (d.querySelector('[data-v-') || d.querySelector('[v-model]')) {
      return 'vue';
    }
    
    return 'generic';
  }

  // ============================================================================
  // SELECTOR UTILITIES
  // ============================================================================

  function escapeSelector(str) {
    return (str || '').replace(/["\\]/g, '\\$&');
  }

  function escapeString(str) {
    return (str || '').replace(/['\\]/g, '\\$&');
  }

  /**
   * Check if a value looks dynamic/generated
   */
  function isDynamic(value) {
    if (!value) return true;
    // Pure numbers
    if (/^\d+$/.test(value)) return true;
    // UUIDs
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return true;
    // Long hex strings
    if (/^[a-f0-9]{16,}$/i.test(value)) return true;
    // LWC dynamic IDs
    if (/^lwc-[a-z0-9]+$/i.test(value)) return true;
    // Aura dynamic IDs
    if (/^\d+:\d+;[a-z]/.test(value)) return true;
    // React keys
    if (/^\.r\[\d+\]/.test(value)) return true;
    // Angular ng-content
    if (/_ngcontent-\w+-c\d+/.test(value)) return true;
    // Vue data-v
    if (/^data-v-[a-f0-9]+$/.test(value)) return true;
    return false;
  }

  /**
   * Check if selector matches problematic patterns for current app
   */
  function isProblematicSelector(value, attr, appConfig) {
    if (!appConfig || !appConfig.avoidPatterns) return false;
    for (var i = 0; i < appConfig.avoidPatterns.length; i++) {
      if (appConfig.avoidPatterns[i].test(value)) return true;
    }
    return false;
  }

  // ============================================================================
  // FIND INTERACTIVE ELEMENT
  // Critical for finding the actual button/link, not wrapper divs
  // ============================================================================

  /**
   * Interactive element selectors - elements we consider "clickable"
   */
  var INTERACTIVE_SELECTORS = [
    'button',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="radio"]',
    'input[type="submit"]',
    'input[type="button"]',
    '[tabindex="0"]',
    '[data-action]',
    '[onclick]',
    '.slds-button',           // Salesforce
    'lightning-button',       // Salesforce LWC
    'lightning-button-icon',  // Salesforce LWC
    'lightning-menu-item',    // Salesforce LWC
    '[data-automation-id]',   // Workday
  ];

  /**
   * Check if an element is an LWC/custom element wrapper (hyphenated tag name)
   * These are common in Salesforce Lightning and need special handling
   */
  function isLWCWrapper(element) {
    if (!element || !element.tagName) return false;
    var tag = element.tagName.toLowerCase();
    // LWC elements have hyphenated names: one-appnav, lightning-button, one-app-launcher-menu, etc.
    return tag.indexOf('-') >= 0;
  }

  /**
   * Find the actual interactive element INSIDE an LWC wrapper
   * LWC wrappers often contain the real button/link as a child
   */
  function findInteractiveInLWC(lwcElement) {
    if (!lwcElement) return null;
    
    // Priority order for finding interactive content inside LWC
    var selectors = [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      'input[type="submit"]',
      'input[type="button"]',
      '.slds-button',
      '[data-refid]',
      '[title]',
      '[aria-label]'
    ];
    
    for (var i = 0; i < selectors.length; i++) {
      try {
        var inner = lwcElement.querySelector(selectors[i]);
        if (inner) return inner;
      } catch (e) {}
    }
    
    // Check Shadow DOM if present
    if (lwcElement.shadowRoot) {
      for (var j = 0; j < selectors.length; j++) {
        try {
          var shadowInner = lwcElement.shadowRoot.querySelector(selectors[j]);
          if (shadowInner) return shadowInner;
        } catch (e) {}
      }
    }
    
    return null;
  }

  /**
   * Find the actual interactive element when user clicks.
   * event.target might be a nested span/icon inside a button - we need the button.
   * 
   * CRITICAL for Salesforce LWC: Also looks INSIDE LWC wrapper elements
   * for the actual interactive content.
   */
  function findInteractiveElement(target) {
    try {
    if (!target || target === document.body || target === document.documentElement) {
      return target;
    }

    var targetTag = (target.tagName || '').toLowerCase();
    if (!targetTag) return target;
    
    // If target itself is interactive, use it
    if (['button', 'a', 'input', 'select', 'textarea'].indexOf(targetTag) >= 0) {
      return target;
    }
    var role = target.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'].indexOf(role) >= 0) {
      return target;
    }

    // CRITICAL: Check if target is an LWC wrapper - look INSIDE for interactive element
    if (isLWCWrapper(target)) {
      var innerInteractive = findInteractiveInLWC(target);
      if (innerInteractive) {
        _log('[Recorder] Found interactive inside LWC:', targetTag, '->', innerInteractive.tagName);
        return innerInteractive;
      }
    }

    // Walk up DOM to find nearest interactive ancestor
    var current = target;
    var maxDepth = 10;

    while (current && current !== document.body && maxDepth > 0) {
      // Check if current matches any interactive selector
      for (var i = 0; i < INTERACTIVE_SELECTORS.length; i++) {
        try {
          if (current.matches && current.matches(INTERACTIVE_SELECTORS[i])) {
            return current;
          }
        } catch (e) {}
      }

      // If we hit an LWC wrapper while walking up, look inside it
      if (isLWCWrapper(current)) {
        var innerEl = findInteractiveInLWC(current);
        if (innerEl) {
          _log('[Recorder] Found interactive inside LWC parent:', current.tagName.toLowerCase(), '->', innerEl.tagName);
          return innerEl;
        }
      }

      // Check for cursor: pointer (indicates clickable)
      try {
        var style = window.getComputedStyle(current);
        if (style.cursor === 'pointer') {
          var hasText = current.textContent && current.textContent.trim().length > 0 && current.textContent.trim().length < 100;
          var tag = current.tagName.toLowerCase();
          if (hasText && ['span', 'svg', 'path', 'i'].indexOf(tag) < 0 && !isLWCWrapper(current)) {
            return current;
          }
        }
      } catch (e) {}

      current = current.parentElement;
      maxDepth--;
    }

    // If no interactive ancestor found, prefer parent for tiny elements
    if (['span', 'svg', 'path', 'i', 'img'].indexOf(targetTag) >= 0) {
      var parent = target.parentElement;
      if (parent && parent !== document.body) {
        var parentTag = (parent.tagName || '').toLowerCase();
        if (['div', 'li', 'button', 'a'].indexOf(parentTag) >= 0) {
          var text = (parent.textContent || '').trim();
          if (text && text.length > 0 && text.length < 100) {
            return parent;
          }
        }
      }
    }

    return target;
    } catch(e) { return target; }
  }

  // ============================================================================
  // IS GENERIC CONTAINER
  // Skip clicks on meaningless wrapper elements
  // ============================================================================

  /**
   * Check if element is a generic container without meaningful identifiers.
   * These create useless "Click div" actions that always fail during playback.
   */
  function isGenericContainer(element) {
    try {
    if (!element || !element.tagName) return false;
    var tagName = element.tagName.toLowerCase();
    
    // LWC custom elements (hyphenated) - check for meaningful attributes
    if (tagName.indexOf('-') >= 0) {
      // If it has ANY meaningful attribute, it's not generic
      var hasTitle = element.getAttribute('title');
      var hasAriaLabel = element.getAttribute('aria-label');
      var hasDataRefid = element.getAttribute('data-refid');
      var hasRole = element.getAttribute('role');
      var hasText = (element.textContent || '').trim();
      
      if (hasTitle || hasAriaLabel || hasDataRefid || hasRole || (hasText && hasText.length < 50)) {
        return false; // Has meaningful content - record it
      }
    }
    
    var genericContainerTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];

    if (genericContainerTags.indexOf(tagName) < 0) {
      return false; // Not a generic container tag
    }

    // Check for meaningful attributes
    var hasId = element.id && !element.id.match(/^\d+$/) && !element.id.match(/^(lwc|aura)-/i);
    var hasTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
    var hasRole = element.getAttribute('role');
    var hasName = element.getAttribute('name');
    var hasAriaLabel = element.getAttribute('aria-label');
    var hasClickableRole = hasRole && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(hasRole) >= 0;
    var text = (element.textContent || '').trim();
    var hasShortText = text.length > 0 && text.length < 50;

    // Is generic if NO meaningful identifiers
    return !hasId && !hasTestId && !hasClickableRole && !hasName && !hasAriaLabel && !hasShortText;
    } catch(e) { return false; }
  }

  // ============================================================================
  // IS SENSITIVE FIELD
  // Detect password/secret fields for masking
  // ============================================================================

  function isSensitiveField(element, type) {
    if (type === 'password') return true;

    var name = (element.name || '').toLowerCase();
    var id = (element.id || '').toLowerCase();
    var placeholder = (element.placeholder || '').toLowerCase();
    var allText = name + ' ' + id + ' ' + placeholder;

    var sensitivePatterns = [
      /password|passwd|pwd|pass/,
      /secret|token|api[_-]?key/,
      /credit[_-]?card|card[_-]?number|ccnum/,
      /cvv|cvc|security[_-]?code/,
      /ssn|social[_-]?security/,
      /pin|otp|verification[_-]?code/,
    ];

    for (var i = 0; i < sensitivePatterns.length; i++) {
      if (sensitivePatterns[i].test(allText)) return true;
    }
    return false;
  }

  // ============================================================================
  // GET FIELD LABEL
  // Extract human-readable label for form fields
  // ============================================================================

  function getFieldLabel(element) {
    // 1. Associated label
    if (element.id) {
      var label = document.querySelector('label[for="' + element.id + '"]');
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }
    // 2. Parent label
    var parentLabel = element.closest('label');
    if (parentLabel) {
      var labelText = (parentLabel.textContent || '').replace(element.value || '', '').trim();
      if (labelText) return labelText;
    }
    // 3. aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }
    // 4. Placeholder
    if (element.placeholder) {
      return element.placeholder;
    }
    // 5. Name (formatted)
    if (element.name) {
      return element.name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    }
    // 6. Fallback
    return element.type || 'input';
  }

  // ============================================================================
  // GET VISIBLE TEXT
  // Extract visible text from element (not hidden children)
  // ============================================================================

  function getVisibleText(element) {
    try {
    if (!element) return '';
    
    // For inputs, use value or placeholder
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value || element.placeholder || '';
    }
    
    var tag = (element.tagName || '').toLowerCase();
    if (!tag) return '';
    var text = '';
    
    // PRIORITY 1: Check for title attribute first (most reliable for buttons)
    var titleAttr = element.getAttribute ? element.getAttribute('title') : null;
    if (titleAttr && titleAttr.length > 1 && titleAttr.length < 60) {
      return titleAttr;
    }
    
    // 1. Check aria-label and title first (most reliable for LWC)
    var ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 60) {
      return ariaLabel;
    }
    var title = element.getAttribute('title');
    if (title && title.length > 1 && title.length < 60) {
      return title;
    }
    
    // 2. For LWC elements (hyphenated tags), search more aggressively
    if (tag.indexOf('-') >= 0) {
      // Check slot content
      var slot = element.querySelector('slot');
      if (slot && slot.assignedNodes) {
        var assigned = slot.assignedNodes();
        for (var a = 0; a < assigned.length; a++) {
          if (assigned[a].textContent) {
            text = assigned[a].textContent.trim();
            if (text && text.length > 0 && text.length < 60) return text;
          }
        }
      }
      
      // Check Shadow DOM
      if (element.shadowRoot) {
        var shadowText = element.shadowRoot.textContent || '';
        shadowText = shadowText.trim();
        if (shadowText && shadowText.length > 0 && shadowText.length < 60) {
          return shadowText;
        }
        // Try specific elements in shadow
        var shadowBtn = element.shadowRoot.querySelector('button, a, span.slds-button__label, .slds-truncate');
        if (shadowBtn) {
          text = (shadowBtn.textContent || '').trim();
          if (text && text.length > 0 && text.length < 60) return text;
        }
      }
      
      // Check nested button/span for text
      var innerEl = element.querySelector('button, a, span[title], .slds-truncate, [slot]');
      if (innerEl) {
        text = (innerEl.textContent || innerEl.getAttribute('title') || '').trim();
        if (text && text.length > 0 && text.length < 60) return text;
      }
    }
    
    // 3. For buttons/links, get direct text nodes
    var childNodes = element.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      if (childNodes[i].nodeType === 3) { // Text node
        text += childNodes[i].textContent;
      }
    }
    text = text.trim();
    
    // 4. If no direct text, try innerText (but clean it up carefully)
    if (!text) {
      // First, try to find a clean text source from child elements
      var cleanTextEl = element.querySelector('[title], [aria-label], .slds-truncate, .slds-text-heading, h1, h2, h3, h4, h5, h6');
      if (cleanTextEl) {
        var cleanText = cleanTextEl.getAttribute('title') || cleanTextEl.getAttribute('aria-label') || cleanTextEl.textContent;
        if (cleanText && cleanText.length > 0 && cleanText.length < 60) {
          text = cleanText.trim();
        }
      }
      
      // If still no text, use innerText but clean it up
      if (!text) {
        text = (element.innerText || element.textContent || '').trim();
        
        // Normalize whitespace
        text = text.replace(/\s+/g, ' ');
        
        // Fix common Salesforce concatenation issues:
        // "AccountsAccountsRecently Viewed" -> "Accounts"
        // "Accounts ViewedSelect a List" -> "Accounts Viewed"
        
        // Pattern 1: Detect repeated word at start (e.g., "AccountsAccounts...")
        var words = text.split(' ');
        if (words.length > 0) {
          var firstWord = words[0];
          for (var len = 3; len <= Math.floor(firstWord.length / 2); len++) {
            var pattern = firstWord.substring(0, len);
            if (firstWord.substring(len, len + len) === pattern) {
              // Found repetition - extract just the meaningful part
              // "AccountsAccountsRecently" -> "Accounts"
              text = pattern;
              break;
            }
          }
        }
        
        // Pattern 2: Detect concatenated actions (e.g., "ViewedSelect" -> "Viewed")
        // Look for camelCase-like patterns in the middle of words
        text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
        
        // Pattern 3: If text is very long and weird, just take first word
        if (text.length > 40) {
          var firstCleanWord = text.split(' ')[0];
          if (firstCleanWord && firstCleanWord.length > 2 && firstCleanWord.length < 30) {
            text = firstCleanWord;
          }
        }
      }
    }
    
    // Final cleanup
    text = text.trim();
    
    // Limit length
    if (text.length > 50) {
      text = text.substring(0, 47) + '...';
    }
    
    return text;
    } catch(e) { return ''; }
  }

  // ============================================================================
  // SMART SELECTOR CLASS
  // Generates robust, app-aware selectors with fallbacks
  // ============================================================================

  function SmartSelector() {
    this.currentApp = 'generic';
    this.appConfig = AppSelectorConfig.generic;
  }

  SmartSelector.prototype.setApp = function(appKey) {
    if (AppSelectorConfig[appKey]) {
      this.currentApp = appKey;
      this.appConfig = AppSelectorConfig[appKey];
      _log('[SmartSelector] App set to:', this.appConfig.name);
    }
  };

  SmartSelector.prototype.detectAndSetApp = function() {
    var app = detectApp();
    this.setApp(app);
    return app;
  };

  /**
   * Main method: Generate the best selector for an element
   * Returns: { selector, playwright, type, confidence, primary, fallbacks, strategies }
   */
  SmartSelector.prototype.getBestSelector = function(element) {
    try {
    // Guard against body/html
    var tagName = element && element.tagName ? element.tagName.toLowerCase() : '';
    if (!element || tagName === 'body' || tagName === 'html') {
      return {
        selector: '[SELECTOR_NEEDED]',
        playwright: 'locator("[SELECTOR_NEEDED]")',
        type: 'error',
        confidence: 0,
        primary: { selector: '[SELECTOR_NEEDED]', playwright: 'locator("[SELECTOR_NEEDED]")', confidence: 0 },
        fallbacks: [],
        strategies: [],
        app: this.currentApp,
        appName: this.appConfig ? this.appConfig.name : 'generic',
      };
    }

    var selectors = [];
    var isSalesforce = this.currentApp.indexOf('salesforce') >= 0;

    // 1. Salesforce-optimized selectors (if applicable)
    if (isSalesforce) {
      this._addSalesforceSelectors(element, selectors);
    }

    // 2. App-specific selectors
    this._addAppSpecificSelectors(element, selectors);

    // 3. Standard test attributes
    this._addTestAttributes(element, selectors);

    // 4. Form selectors (name, placeholder)
    this._addFormSelectors(element, selectors);

    // 5. ARIA selectors
    this._addAriaSelectors(element, selectors);

    // 6. ID selector (if not dynamic)
    this._addIdSelector(element, selectors);

    // 7. Text selectors
    this._addTextSelectors(element, selectors);

    // 8. CSS selectors (fallback)
    this._addCssSelectors(element, selectors);

    // Rank and verify uniqueness
    this._rankSelectors(selectors, element);

    // Pick best
    var best = selectors[0] || {
      selector: this._buildFallbackSelector(element),
      playwright: 'locator(\'' + this._buildFallbackSelector(element) + '\')',
      type: 'fallback',
      confidence: 10,
    };

    // Get fallbacks (top 5 alternatives)
    var fallbacks = selectors.slice(1, 6);

    return {
      selector: best.selector,
      playwright: best.playwright,
      type: best.type,
      confidence: best.confidence,
      primary: best,
      fallbacks: fallbacks,
      strategies: selectors,
      app: this.currentApp,
      appName: this.appConfig ? this.appConfig.name : 'generic',
    };
    } catch(e) { 
      return { selector: '[SELECTOR_NEEDED]', playwright: 'locator("[SELECTOR_NEEDED]")', type: 'error', confidence: 0, primary: {}, fallbacks: [], strategies: [], app: this.currentApp, appName: 'generic' }; 
    }
  };

  SmartSelector.prototype._addSalesforceSelectors = function(element, selectors) {
    try {
    var getAttr = function(name) { try { return element.getAttribute ? element.getAttribute(name) : null; } catch(e) { return null; } };
    var role = getAttr('role');
    var ariaLabel = getAttr('aria-label');
    var title = getAttr('title');
    var nameAttr = getAttr('name');
    var visibleText = getVisibleText(element);
    var tag = (element.tagName || '').toLowerCase();
    if (!tag) return;
    var isLWC = tag.indexOf('-') >= 0;

    // CRITICAL: For LWC elements, also check inner button/link for text
    if (isLWC && (!visibleText || visibleText.length < 2)) {
      var innerButton = element.querySelector('button, a, [role="button"], .slds-button');
      if (innerButton) {
        visibleText = getVisibleText(innerButton);
        // Also get aria-label from inner element if not on wrapper
        if (!ariaLabel) ariaLabel = innerButton.getAttribute('aria-label');
        if (!title) title = innerButton.getAttribute('title');
      }
    }

    // LWC Button elements (lightning-button, lightning-button-icon, etc.)
    if (isLWC && tag.indexOf('button') >= 0) {
      // Get the label attribute specific to lightning-button
      var label = element.getAttribute('label');
      if (label) {
        selectors.push({
          type: 'lwc-label',
          selector: tag + '[label="' + escapeSelector(label) + '"]',
          playwright: 'locator(\'' + tag + '[label="' + escapeString(label) + '"]\')',
          confidence: 98,
          description: 'LWC button by label'
        });
      }
      // Check variant for icon buttons
      var iconName = element.getAttribute('icon-name');
      if (iconName) {
        selectors.push({
          type: 'lwc-icon',
          selector: tag + '[icon-name="' + escapeSelector(iconName) + '"]',
          playwright: 'locator(\'' + tag + '[icon-name="' + escapeString(iconName) + '"]\')',
          confidence: 95,
          description: 'LWC button by icon'
        });
      }
    }

    // Text/Role for buttons (including LWC)
    if (visibleText && visibleText.length >= 2 && visibleText.length <= 80) {
      if (tag === 'button' || role === 'button' || (isLWC && tag.indexOf('button') >= 0)) {
        selectors.push({
          type: 'role',
          selector: null,
          playwright: 'getByRole(\'button\', { name: \'' + escapeString(visibleText) + '\' })',
          confidence: 100,
          description: 'SF Button by text'
        });
      }
      if (tag === 'a' || role === 'link') {
        selectors.push({
          type: 'role',
          selector: null,
          playwright: 'getByRole(\'link\', { name: \'' + escapeString(visibleText) + '\' })',
          confidence: 100,
          description: 'SF Link by text'
        });
      }
      // Text selector
      selectors.push({
        type: 'text',
        selector: null,
        playwright: 'getByText(\'' + escapeString(visibleText) + '\', { exact: true })',
        confidence: 90,
        description: 'SF Text exact'
      });
    }

    // title attribute (high priority for Salesforce)
    if (title && title.length > 1 && title.length < 100) {
      selectors.push({
        type: 'title',
        selector: '[title="' + escapeSelector(title) + '"]',
        playwright: 'locator(\'[title="' + escapeString(title) + '"]\')',
        confidence: 96,
        description: 'SF title'
      });
    }

    // aria-label
    if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) {
      selectors.push({
        type: 'label',
        selector: '[aria-label="' + escapeSelector(ariaLabel) + '"]',
        playwright: 'getByLabel(\'' + escapeString(ariaLabel) + '\')',
        confidence: 95,
        description: 'SF aria-label'
      });
    }

    // Name attribute
    if (nameAttr && !isDynamic(nameAttr)) {
      selectors.push({
        type: 'name',
        selector: '[name="' + escapeSelector(nameAttr) + '"]',
        playwright: 'locator(\'[name="' + escapeString(nameAttr) + '"]\')',
        confidence: 98,
        description: 'SF name'
      });
    }

    // Title
    if (title && title.length > 1 && title.length < 50) {
      selectors.push({
        type: 'title',
        selector: '[title="' + escapeSelector(title) + '"]',
        playwright: 'locator(\'[title="' + escapeString(title) + '"]\')',
        confidence: 92,
        description: 'SF title'
      });
    }

    // Salesforce-specific attributes
    var sfAttrs = ['data-target-selection-name', 'data-field', 'field-name', 'data-refid'];
    for (var i = 0; i < sfAttrs.length; i++) {
      var val = getAttr(sfAttrs[i]);
      if (val && !isDynamic(val)) {
        selectors.push({
          type: 'sf-' + sfAttrs[i],
          selector: '[' + sfAttrs[i] + '="' + escapeSelector(val) + '"]',
          playwright: 'locator(\'[' + sfAttrs[i] + '="' + escapeString(val) + '"]\')',
          confidence: 88,
          description: 'SF ' + sfAttrs[i]
        });
      }
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addAppSpecificSelectors = function(element, selectors) {
    try {
    var strategies = (this.appConfig && this.appConfig.strategies) || [];
    var self = this;

    for (var i = 0; i < strategies.length; i++) {
      var strategy = strategies[i];
      var value = element.getAttribute ? element.getAttribute(strategy.attr) : null;
      if (value && !isProblematicSelector(value, strategy.attr, self.appConfig)) {
        var selector = '[' + strategy.attr + '="' + escapeSelector(value) + '"]';
        var playwright;
        if (typeof strategy.playwright === 'function') {
          playwright = strategy.playwright(value);
        } else if (strategy.useTestId) {
          playwright = 'getByTestId(\'' + escapeString(value) + '\')';
        } else {
          playwright = 'locator(\'[' + strategy.attr + '="' + escapeString(value) + '"]\')';
        }

        selectors.push({
          type: 'app-' + self.currentApp,
          selector: selector,
          playwright: playwright,
          confidence: strategy.priority,
          description: (self.appConfig ? self.appConfig.name : 'generic') + ': ' + strategy.attr,
        });
      }
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addTestAttributes = function(element, selectors) {
    try {
    var testAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-automation-id'];
    for (var i = 0; i < testAttrs.length; i++) {
      var value = element.getAttribute ? element.getAttribute(testAttrs[i]) : null;
      if (value && !isDynamic(value)) {
        selectors.push({
          type: 'testid',
          selector: '[' + testAttrs[i] + '="' + escapeSelector(value) + '"]',
          playwright: testAttrs[i] === 'data-testid' ? 'getByTestId(\'' + escapeString(value) + '\')' : 'locator(\'[' + testAttrs[i] + '="' + escapeString(value) + '"]\')',
          confidence: 99,
          description: 'Test ID: ' + testAttrs[i],
        });
      }
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addFormSelectors = function(element, selectors) {
    try {
    // Name attribute
    if (element.name && !isDynamic(element.name)) {
      selectors.push({
        type: 'name',
        selector: '[name="' + escapeSelector(element.name) + '"]',
        playwright: 'locator(\'[name="' + escapeString(element.name) + '"]\')',
        confidence: 95,
        description: 'Form name',
      });
    }
    // Placeholder
    if (element.placeholder) {
      selectors.push({
        type: 'placeholder',
        selector: '[placeholder="' + escapeSelector(element.placeholder) + '"]',
        playwright: 'getByPlaceholder(\'' + escapeString(element.placeholder) + '\')',
        confidence: 85,
        description: 'Placeholder',
      });
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addAriaSelectors = function(element, selectors) {
    try {
    var ariaLabel = element.getAttribute ? element.getAttribute('aria-label') : null;
    if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) {
      selectors.push({
        type: 'aria',
        selector: '[aria-label="' + escapeSelector(ariaLabel) + '"]',
        playwright: 'getByLabel(\'' + escapeString(ariaLabel) + '\')',
        confidence: 88,
        description: 'ARIA label',
      });
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addIdSelector = function(element, selectors) {
    try {
    if (element.id && !isDynamic(element.id)) {
      selectors.push({
        type: 'id',
        selector: '#' + element.id,
        playwright: 'locator(\'#' + escapeString(element.id) + '\')',
        confidence: 97,
        description: 'ID selector',
      });
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addTextSelectors = function(element, selectors) {
    try {
    var tag = (element.tagName || '').toLowerCase();
    var role = element.getAttribute ? element.getAttribute('role') : null;
    var text = getVisibleText(element);

    if (text && text.length >= 2 && text.length <= 60) {
      // Role-based for buttons/links
      if (tag === 'button' || role === 'button') {
        selectors.push({
          type: 'role',
          selector: null,
          playwright: 'getByRole(\'button\', { name: \'' + escapeString(text) + '\' })',
          confidence: 92,
          description: 'Button by text',
        });
      }
      if (tag === 'a' || role === 'link') {
        selectors.push({
          type: 'role',
          selector: null,
          playwright: 'getByRole(\'link\', { name: \'' + escapeString(text) + '\' })',
          confidence: 92,
          description: 'Link by text',
        });
      }
      // Generic text
      selectors.push({
        type: 'text',
        selector: null,
        playwright: 'getByText(\'' + escapeString(text) + '\')',
        confidence: 75,
        description: 'Text content',
        textValue: text,
      });
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._addCssSelectors = function(element, selectors) {
    try {
    var tagName = (element.tagName || '').toLowerCase();
    if (!tagName) return;
    var classes = [];
    
    // Get stable class names
    if (element.classList) {
      for (var i = 0; i < element.classList.length && classes.length < 2; i++) {
        var c = element.classList[i];
        if (c.length > 1 && c.length < 30 && !isDynamic(c)) {
          classes.push(c);
        }
      }
    }

    if (classes.length > 0) {
      var cssSelector = tagName + '.' + classes.join('.');
      selectors.push({
        type: 'css',
        selector: cssSelector,
        playwright: 'locator(\'' + cssSelector + '\')',
        confidence: 50,
        description: 'CSS selector',
      });
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._rankSelectors = function(selectors, element) {
    try {
    // Sort by confidence (higher is better)
    selectors.sort(function(a, b) {
      return (b.confidence || 0) - (a.confidence || 0);
    });

    // Check uniqueness for top selectors
    for (var i = 0; i < Math.min(selectors.length, 5); i++) {
      var sel = selectors[i];
      if (sel.selector) {
        try {
          var matches = document.querySelectorAll(sel.selector);
          sel.uniqueMatch = matches.length === 1;
          sel.matchCount = matches.length;
        } catch (e) {
          sel.uniqueMatch = false;
          sel.matchCount = 0;
        }
      }
    }
    } catch(e) { /* Silent */ }
  };

  SmartSelector.prototype._buildFallbackSelector = function(element) {
    try {
    var tagName = (element.tagName || '').toLowerCase() || 'div';
    var parent = element.parentElement;
    if (parent && parent !== document.body && parent.children) {
      var index = Array.from(parent.children).indexOf(element) + 1;
      var parentTag = (parent.tagName || '').toLowerCase() || 'div';
      return parentTag + ' > ' + tagName + ':nth-child(' + index + ')';
    }
    return tagName;
    } catch(e) { return 'div'; }
  };

  // ============================================================================
  // ELEMENT INFO EXTRACTOR
  // Extract all relevant info from an element for recording
  // ============================================================================

  function getElementInfo(element, smartSelector) {
    if (!element || !element.tagName) return null;

    var rect = element.getBoundingClientRect();
    var selectorObj = smartSelector ? smartSelector.getBestSelector(element) : { strategies: [] };

    var tag = element.tagName.toLowerCase();
    var role = element.getAttribute('role');
    var ariaLabel = element.getAttribute('aria-label');
    var title = element.getAttribute('title');
    var text = getVisibleText(element);

    return {
      tagName: tag,
      id: element.id || '',
      text: text,
      type: element.type || '',
      name: element.name || '',
      value: element.value || '',
      placeholder: element.placeholder || '',
      ariaLabel: ariaLabel || '',
      title: title || '',
      role: role || '',
      selectors: selectorObj.strategies || [],
      selectorObj: selectorObj,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  exports.AppSelectorConfig = AppSelectorConfig;
  exports.detectApp = detectApp;
  exports.escapeSelector = escapeSelector;
  exports.escapeString = escapeString;
  exports.isDynamic = isDynamic;
  exports.isProblematicSelector = isProblematicSelector;
  exports.findInteractiveElement = findInteractiveElement;
  exports.isGenericContainer = isGenericContainer;
  exports.isSensitiveField = isSensitiveField;
  exports.getFieldLabel = getFieldLabel;
  exports.getVisibleText = getVisibleText;
  exports.SmartSelector = SmartSelector;
  exports.getElementInfo = getElementInfo;
  exports.INTERACTIVE_SELECTORS = INTERACTIVE_SELECTORS;

})(typeof exports !== 'undefined' ? exports : (window.FlowstralRecorderEngine = {}));

