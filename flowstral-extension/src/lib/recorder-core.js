/**
 * Flowstral Recorder Core - SHARED between Web Extension and Desktop App
 * 
 * DO NOT MODIFY THIS FILE IN DESKTOP APP!
 * This is the single source of truth. Desktop reads this file directly.
 * 
 * Contains:
 * - findInteractiveElement: Walk up DOM to find clickable ancestor
 * - isGenericContainer: Check if element is a meaningless container
 * - isSensitiveField: Detect password/secret fields
 * - getElementSelectors: Generate robust selectors for an element
 * - Input debouncing logic (pendingInput pattern)
 */

(function(exports) {
  'use strict';

  // ============================================================================
  // APP DETECTION
  // ============================================================================
  
  function detectApp() {
    var url = (window.location.href || '').toLowerCase();
    var d = document;
    
    // Salesforce LWC (most specific)
    if (d.querySelector('[class*="lwc-"]') || d.querySelector('lightning-')) {
      return 'salesforce-lwc';
    }
    // Salesforce Aura
    if (d.querySelector('[data-aura-rendered-by]') || window.Aura || window.$A) {
      return 'salesforce-aura';
    }
    // Generic Salesforce
    if (url.includes('salesforce') || url.includes('force.com') || url.includes('lightning.force')) {
      return 'salesforce';
    }
    // ServiceNow
    if (url.includes('servicenow') || url.includes('service-now') || window.g_form) {
      return 'servicenow';
    }
    // Workday
    if (url.includes('workday') || url.includes('myworkday') || d.querySelector('[data-automation-id]')) {
      return 'workday';
    }
    // Dynamics 365
    if (url.includes('dynamics') || url.includes('crm.dynamics') || window.Xrm) {
      return 'dynamics365';
    }
    // SAP
    if (url.includes('sap.com') || url.includes('fiori')) {
      return 'sap';
    }
    // Oracle
    if (url.includes('oracle') || url.includes('oraclecloud')) {
      return 'oracle';
    }
    // Jira/Atlassian
    if (url.includes('atlassian') || url.includes('jira') || url.includes('confluence')) {
      return 'jira';
    }
    // Zendesk
    if (url.includes('zendesk')) {
      return 'zendesk';
    }
    // HubSpot
    if (url.includes('hubspot')) {
      return 'hubspot';
    }
    // NetSuite
    if (url.includes('netsuite')) {
      return 'netsuite';
    }
    // Shopify
    if (url.includes('shopify') || url.includes('myshopify')) {
      return 'shopify';
    }
    // Slack
    if (url.includes('slack')) {
      return 'slack';
    }
    
    return 'generic';
  }

  // ============================================================================
  // FIND INTERACTIVE ELEMENT (exact copy from web extension content.js)
  // ============================================================================
  
  /**
   * Find the actual interactive element when user clicks
   * event.target might be a nested span/icon inside a button - we need the button
   */
  function findInteractiveElement(target) {
    if (!target || target === document.body || target === document.documentElement) {
      return target;
    }
    
    // Interactive element selectors (same as PageAnalyzer.collectButtons)
    var interactiveSelectors = [
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
    ];
    
    // If target itself is interactive, use it
    var targetTag = target.tagName.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea'].indexOf(targetTag) >= 0) {
      return target;
    }
    var role = target.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'].indexOf(role) >= 0) {
      return target;
    }
    
    // Walk up DOM to find nearest interactive ancestor
    var current = target;
    var maxDepth = 10; // Don't walk too far
    
    while (current && current !== document.body && maxDepth > 0) {
      // Check if current matches any interactive selector
      for (var i = 0; i < interactiveSelectors.length; i++) {
        try {
          if (current.matches && current.matches(interactiveSelectors[i])) {
            return current;
          }
        } catch (e) {}
      }
      
      // Check for cursor: pointer (indicates clickable)
      try {
        var style = window.getComputedStyle(current);
        if (style.cursor === 'pointer') {
          var hasText = current.textContent && current.textContent.trim().length > 0 && current.textContent.trim().length < 100;
          var tag = current.tagName.toLowerCase();
          // If it's a meaningful element with text and pointer cursor, it's likely the target
          if (hasText && ['span', 'svg', 'path', 'i'].indexOf(tag) < 0) {
            return current;
          }
        }
      } catch (e) {}
      
      current = current.parentElement;
      maxDepth--;
    }
    
    // If no interactive ancestor found, return original target
    // But prefer parent if target is just a text node or tiny element
    if (['span', 'svg', 'path', 'i', 'img'].indexOf(targetTag) >= 0) {
      var parent = target.parentElement;
      if (parent && parent !== document.body) {
        var parentTag = parent.tagName.toLowerCase();
        // If parent is a div/li with meaningful text, use parent
        if (['div', 'li', 'button', 'a'].indexOf(parentTag) >= 0) {
          var text = (parent.textContent || '').trim();
          if (text && text.length > 0 && text.length < 100) {
            return parent;
          }
        }
      }
    }
    
    return target;
  }

  // ============================================================================
  // IS GENERIC CONTAINER (exact copy from web extension content.js)
  // ============================================================================
  
  /**
   * Check if element is a generic container without meaningful identifiers
   * These create useless "Click div" actions that always fail during playback
   */
  function isGenericContainer(element) {
    var genericContainerTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];
    var tagName = element.tagName.toLowerCase();
    
    if (genericContainerTags.indexOf(tagName) < 0) {
      return false; // Not a generic container tag
    }
    
    // Only record if element has meaningful attributes
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
  }

  // ============================================================================
  // IS SENSITIVE FIELD (exact copy from web extension content.js)
  // ============================================================================
  
  /**
   * Detect if a field contains sensitive data (passwords, secrets, etc.)
   */
  function isSensitiveField(element, type, attrs) {
    // Check input type
    if (type === 'password') return true;
    
    // Check common sensitive field patterns
    var name = (element.name || '').toLowerCase();
    var id = (element.id || '').toLowerCase();
    var placeholder = (element.placeholder || '').toLowerCase();
    var label = (attrs && attrs.label ? attrs.label : '').toLowerCase();
    var allText = name + ' ' + id + ' ' + placeholder + ' ' + label;
    
    var sensitivePatterns = [
      /password|passwd|pwd|pass/,
      /secret|token|api[_-]?key/,
      /credit[_-]?card|card[_-]?number|ccnum/,
      /cvv|cvc|security[_-]?code/,
      /ssn|social[_-]?security/,
      /pin|otp|verification[_-]?code/,
      /auth[_-]?code|access[_-]?token/,
      /private[_-]?key|secret[_-]?key/,
    ];
    
    for (var i = 0; i < sensitivePatterns.length; i++) {
      if (sensitivePatterns[i].test(allText)) return true;
    }
    return false;
  }

  // ============================================================================
  // GET FIELD LABEL (helper function)
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
  // ESCAPE HELPERS
  // ============================================================================
  
  function escapeSelector(str) {
    return (str || '').replace(/["\\]/g, '\\$&');
  }
  
  function escapeString(str) {
    return (str || '').replace(/['\\]/g, '\\$&');
  }

  // ============================================================================
  // GET ELEMENT SELECTORS (generates robust selectors like web extension)
  // ============================================================================
  
  /**
   * Generate all possible selectors for an element
   * Returns array of { type, selector, playwright, confidence }
   */
  function getElementSelectors(element, detectedApp) {
    if (!element || !element.tagName) return [];
    
    var selectors = [];
    var app = detectedApp || detectApp();
    
    // Helper to add selector
    function add(type, selector, playwright, confidence) {
      selectors.push({
        type: type,
        selector: selector,
        playwright: playwright,
        confidence: confidence
      });
    }
    
    // 1. Test IDs (highest priority)
    var testid = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('data-cy');
    if (testid) {
      var attr = element.getAttribute('data-testid') ? 'data-testid' : 
                 element.getAttribute('data-test-id') ? 'data-test-id' : 'data-cy';
      add('testid', '[' + attr + '="' + escapeSelector(testid) + '"]', 
          "getByTestId('" + escapeString(testid) + "')", 100);
    }
    
    // 2. ID (if not dynamic)
    var id = element.id;
    if (id && !id.match(/^(lwc|aura)-/i) && !id.match(/^[a-f0-9]{8,}$/i) && !id.match(/^\d+$/)) {
      add('id', '#' + escapeSelector(id), "locator('#" + escapeString(id) + "')", 95);
    }
    
    // 3. App-specific selectors
    if (app.indexOf('salesforce') >= 0) {
      var auraClass = element.getAttribute('data-aura-class');
      if (auraClass) {
        add('aura', '[data-aura-class="' + escapeSelector(auraClass) + '"]',
            "locator('[data-aura-class=\"" + escapeString(auraClass) + "\"]')", 90);
      }
      var refid = element.getAttribute('data-refid');
      if (refid) {
        add('refid', '[data-refid="' + escapeSelector(refid) + '"]',
            "locator('[data-refid=\"" + escapeString(refid) + "\"]')", 88);
      }
    }
    if (app === 'workday') {
      var autoId = element.getAttribute('data-automation-id');
      if (autoId) {
        add('automation', '[data-automation-id="' + escapeSelector(autoId) + '"]',
            "locator('[data-automation-id=\"" + escapeString(autoId) + "\"]')", 95);
      }
    }
    if (app === 'servicenow') {
      var snComp = element.getAttribute('data-sn-component');
      if (snComp) {
        add('sn', '[data-sn-component="' + escapeSelector(snComp) + '"]',
            "locator('[data-sn-component=\"" + escapeString(snComp) + "\"]')", 95);
      }
    }
    
    // 4. Name attribute (critical for form fields)
    if (element.name) {
      add('name', '[name="' + escapeSelector(element.name) + '"]',
          "locator('[name=\"" + escapeString(element.name) + "\"]')", 90);
    }
    
    // 5. aria-label
    var ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      add('aria', '[aria-label="' + escapeSelector(ariaLabel) + '"]',
          "getByLabel('" + escapeString(ariaLabel) + "')", 85);
    }
    
    // 6. Placeholder
    if (element.placeholder) {
      add('placeholder', '[placeholder="' + escapeSelector(element.placeholder) + '"]',
          "getByPlaceholder('" + escapeString(element.placeholder) + "')", 80);
    }
    
    // 7. Title
    if (element.title) {
      add('title', '[title="' + escapeSelector(element.title) + '"]',
          "locator('[title=\"" + escapeString(element.title) + "\"]')", 75);
    }
    
    // 8. Text content (for buttons/links)
    var tag = element.tagName.toUpperCase();
    var role = element.getAttribute('role');
    var text = '';
    
    if (tag === 'BUTTON' || tag === 'A' || role === 'button' || role === 'link' ||
        (tag === 'INPUT' && (element.type === 'submit' || element.type === 'button'))) {
      text = (element.innerText || element.textContent || element.value || '').trim();
      if (text && text.length > 1 && text.length < 60) {
        // Role-based selector
        var roleStr = tag === 'A' || role === 'link' ? 'link' : 'button';
        add('role', null, "getByRole('" + roleStr + "', { name: '" + escapeString(text) + "' })", 85);
        // Text selector
        add('text', null, "getByText('" + escapeString(text) + "')", 70);
      }
    }
    
    // 9. CSS selector (fallback)
    try {
      var tagName = element.tagName.toLowerCase();
      var classes = [];
      for (var i = 0; i < element.classList.length && classes.length < 2; i++) {
        var c = element.classList[i];
        if (c.length > 1 && c.length < 30 && c.indexOf('--') < 0) {
          classes.push(c);
        }
      }
      if (classes.length > 0) {
        var cssSelector = tagName + '.' + classes.join('.');
        add('css', cssSelector, "locator('" + escapeString(cssSelector) + "')", 50);
      }
    } catch (e) {}
    
    // Sort by confidence
    selectors.sort(function(a, b) { return b.confidence - a.confidence; });
    
    return selectors;
  }

  // ============================================================================
  // GET BEST SELECTOR (returns single best selector object)
  // ============================================================================
  
  function getBestSelector(element, detectedApp) {
    var selectors = getElementSelectors(element, detectedApp);
    if (selectors.length === 0) {
      return {
        selector: null,
        playwright: null,
        type: 'unknown',
        confidence: 0,
        fallbacks: []
      };
    }
    
    var best = selectors[0];
    return {
      selector: best.selector,
      playwright: best.playwright,
      type: best.type,
      confidence: best.confidence,
      primary: best,
      fallbacks: selectors.slice(1, 5),
      strategies: selectors
    };
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================
  
  exports.detectApp = detectApp;
  exports.findInteractiveElement = findInteractiveElement;
  exports.isGenericContainer = isGenericContainer;
  exports.isSensitiveField = isSensitiveField;
  exports.getFieldLabel = getFieldLabel;
  exports.getElementSelectors = getElementSelectors;
  exports.getBestSelector = getBestSelector;
  exports.escapeSelector = escapeSelector;
  exports.escapeString = escapeString;

})(typeof exports !== 'undefined' ? exports : (window.FlowstralRecorderCore = {}));

