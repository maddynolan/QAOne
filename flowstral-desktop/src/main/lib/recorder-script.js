/**
 * Recorder Script - Injected into pages for recording user interactions
 * 
 * This script is injected into the embedded browser's page context.
 * It captures clicks, inputs, form submissions, etc.
 * 
 * IMPORTANT: Core functions (findInteractiveElement, isGenericContainer, etc.)
 * are EXACT COPIES from flowstral-extension/src/lib/recorder-core.js
 * Do NOT modify these functions here - update recorder-core.js instead.
 */

/**
 * Generate the recorder script as a string for injection
 * @returns {string} The recorder script
 */
function generateRecorderScript() {
  return `
(function() {
  if (window.__flowstralRecorderInjected__) return;
  window.__flowstralRecorderInjected__ = true;
  window.__flowstralActions__ = window.__flowstralActions__ || [];

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  var pendingInput = null;
  var inputTimeout = null;
  var lastFillTimestamp = 0;
  var lastFillSelector = null;

  // ============================================================================
  // SHADOW DOM SUPPORT
  // ============================================================================
  
  function deepQuery(selector) {
    var results = [];
    
    function traverse(root) {
      try {
        var elements = root.querySelectorAll(selector);
        for (var i = 0; i < elements.length; i++) {
          results.push(elements[i]);
        }
      } catch (e) {}
      
      var allElements = root.querySelectorAll('*');
      for (var j = 0; j < allElements.length; j++) {
        var el = allElements[j];
        if (el.shadowRoot) {
          traverse(el.shadowRoot);
        }
      }
    }
    
    traverse(document);
    return results;
  }

  // ============================================================================
  // APP DETECTION (from recorder-core.js)
  // ============================================================================
  
  var detectedApp = 'generic';
  function detectApp() {
    var url = window.location.href.toLowerCase();
    if (url.includes('salesforce') || url.includes('force.com') || url.includes('lightning.force')) {
      return 'salesforce';
    }
    if (url.includes('servicenow') || url.includes('service-now')) return 'servicenow';
    if (url.includes('workday') || url.includes('myworkday')) return 'workday';
    if (url.includes('sap.com') || url.includes('fiori') || url.includes('hana')) return 'sap';
    if (url.includes('oracle') || url.includes('oraclecloud')) return 'oracle';
    if (url.includes('dynamics') || url.includes('crm.dynamics')) return 'dynamics365';
    if (url.includes('atlassian') || url.includes('jira') || url.includes('confluence')) return 'jira';
    if (url.includes('zendesk')) return 'zendesk';
    if (url.includes('hubspot')) return 'hubspot';
    if (url.includes('netsuite')) return 'netsuite';
    if (url.includes('shopify')) return 'shopify';
    if (url.includes('slack')) return 'slack';
    return 'generic';
  }
  detectedApp = detectApp();
  console.log('[Flowstral] Detected app:', detectedApp);

  // ============================================================================
  // SENSITIVE FIELD DETECTION (EXACT COPY from recorder-core.js)
  // ============================================================================
  
  function isSensitiveField(element, type, attrs) {
    if (type === 'password') return true;
    
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
  // GET FIELD LABEL (EXACT COPY from recorder-core.js)
  // ============================================================================
  
  function getFieldLabel(element) {
    if (element.id) {
      var label = document.querySelector('label[for="' + element.id + '"]');
      if (label && label.textContent) {
        return label.textContent.trim();
      }
    }
    var parentLabel = element.closest('label');
    if (parentLabel) {
      var labelText = (parentLabel.textContent || '').replace(element.value || '', '').trim();
      if (labelText) return labelText;
    }
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }
    if (element.placeholder) {
      return element.placeholder;
    }
    if (element.name) {
      return element.name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    }
    return element.type || 'input';
  }

  // ============================================================================
  // SELECTOR GENERATION
  // ============================================================================
  
  function escapeStr(s) {
    return (s || '').replace(/"/g, '\\\\"').replace(/'/g, "\\\\'");
  }

  function getElementInfo(el) {
    if (!el || !el.tagName) return null;
    
    var rect = el.getBoundingClientRect();
    var selectors = [];
    
    // ID selector
    if (el.id && !el.id.match(/^(lwc|aura)-/i) && !el.id.match(/^[a-f0-9]{8,}$/i)) {
      selectors.push({ 
        type: 'id', 
        selector: '#' + el.id, 
        playwright: "locator('#" + el.id + "')",
        confidence: 100 
      });
    }
    
    // Test IDs
    if (el.dataset && el.dataset.testid) {
      var tid = el.dataset.testid;
      selectors.push({ 
        type: 'testid', 
        selector: '[data-testid="' + tid + '"]', 
        playwright: "locator('[data-testid=\\"" + escapeStr(tid) + "\\"]')",
        confidence: 99 
      });
    }
    if (el.getAttribute('data-test-id')) {
      var tid2 = el.getAttribute('data-test-id');
      selectors.push({ 
        type: 'testid', 
        selector: '[data-test-id="' + tid2 + '"]', 
        playwright: "locator('[data-test-id=\\"" + escapeStr(tid2) + "\\"]')",
        confidence: 99 
      });
    }
    if (el.getAttribute('data-cy')) {
      var tid3 = el.getAttribute('data-cy');
      selectors.push({ 
        type: 'testid', 
        selector: '[data-cy="' + tid3 + '"]', 
        playwright: "locator('[data-cy=\\"" + escapeStr(tid3) + "\\"]')",
        confidence: 99 
      });
    }
    
    // App-specific selectors
    if (detectedApp === 'salesforce') {
      if (el.getAttribute('data-aura-class')) {
        var auraClass = el.getAttribute('data-aura-class');
        selectors.push({ 
          type: 'aura', 
          selector: '[data-aura-class="' + auraClass + '"]', 
          playwright: "locator('[data-aura-class=\\"" + escapeStr(auraClass) + "\\"]')",
          confidence: 95 
        });
      }
      if (el.getAttribute('data-refid')) {
        var refid = el.getAttribute('data-refid');
        selectors.push({ 
          type: 'refid', 
          selector: '[data-refid="' + refid + '"]', 
          playwright: "locator('[data-refid=\\"" + escapeStr(refid) + "\\"]')",
          confidence: 92 
        });
      }
    }
    if (detectedApp === 'workday' && el.getAttribute('data-automation-id')) {
      var autoId = el.getAttribute('data-automation-id');
      selectors.push({ 
        type: 'automation', 
        selector: '[data-automation-id="' + autoId + '"]', 
        playwright: "locator('[data-automation-id=\\"" + escapeStr(autoId) + "\\"]')",
        confidence: 98 
      });
    }
    if (detectedApp === 'servicenow' && el.getAttribute('data-sn-component')) {
      var snComp = el.getAttribute('data-sn-component');
      selectors.push({ 
        type: 'sn', 
        selector: '[data-sn-component="' + snComp + '"]', 
        playwright: "locator('[data-sn-component=\\"" + escapeStr(snComp) + "\\"]')",
        confidence: 98 
      });
    }
    
    // Name attribute (critical for form fields)
    if (el.name) {
      selectors.push({ 
        type: 'name', 
        selector: '[name="' + el.name + '"]', 
        playwright: "locator('[name=\\"" + escapeStr(el.name) + "\\"]')",
        confidence: 95 
      });
    }
    
    // Aria-label
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push({ 
        type: 'aria', 
        selector: '[aria-label="' + ariaLabel + '"]', 
        playwright: "getByLabel('" + escapeStr(ariaLabel) + "')",
        confidence: 92 
      });
    }
    
    // Placeholder
    if (el.placeholder) {
      selectors.push({ 
        type: 'placeholder', 
        selector: '[placeholder="' + el.placeholder + '"]', 
        playwright: "getByPlaceholder('" + escapeStr(el.placeholder) + "')",
        confidence: 88 
      });
    }
    
    // Text content
    var text = '';
    var tag = el.tagName.toUpperCase();
    if (tag === 'BUTTON' || tag === 'A' || el.getAttribute('role') === 'button' ||
        (tag === 'INPUT' && (el.type === 'submit' || el.type === 'button'))) {
      text = (el.innerText || el.textContent || el.value || '').trim().substring(0, 50);
    } else if (tag === 'INPUT' || tag === 'TEXTAREA') {
      text = getFieldLabel(el);
    } else {
      text = (el.innerText || '').trim().substring(0, 50);
    }
    
    if (text && text.length > 1) {
      selectors.push({ 
        type: 'text', 
        selector: null,
        playwright: "getByText('" + escapeStr(text) + "')",
        value: text,
        confidence: 85 
      });
      if (tag === 'BUTTON' || el.getAttribute('role') === 'button') {
        selectors.push({ 
          type: 'role', 
          selector: null,
          playwright: "getByRole('button', { name: '" + escapeStr(text) + "' })",
          confidence: 90 
        });
      }
      if (tag === 'A' || el.getAttribute('role') === 'link') {
        selectors.push({ 
          type: 'role', 
          selector: null,
          playwright: "getByRole('link', { name: '" + escapeStr(text) + "' })",
          confidence: 90 
        });
      }
    }
    
    // Title
    if (el.title) {
      selectors.push({ 
        type: 'title', 
        selector: '[title="' + el.title + '"]', 
        playwright: "locator('[title=\\"" + escapeStr(el.title) + "\\"]')",
        confidence: 82 
      });
    }
    
    // CSS fallback
    try {
      var tagName = el.tagName.toLowerCase();
      var classes = Array.from(el.classList)
        .filter(function(c) { return !c.includes('--') && c.length < 30 && c.length > 1; })
        .slice(0, 2).join('.');
      if (classes) {
        var cssSelector = tagName + '.' + classes;
        selectors.push({ 
          type: 'css', 
          selector: cssSelector, 
          playwright: "locator('" + escapeStr(cssSelector) + "')",
          confidence: 60 
        });
      }
    } catch (e) {}
    
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      text: text,
      type: el.type || '',
      name: el.name || '',
      value: el.value || '',
      placeholder: el.placeholder || '',
      ariaLabel: ariaLabel || '',
      selectors: selectors,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
  }

  // ============================================================================
  // FIND INTERACTIVE ELEMENT (EXACT COPY from recorder-core.js)
  // ============================================================================
  
  function findInteractiveElement(target) {
    if (!target || target === document.body || target === document.documentElement) {
      return target;
    }
    
    var interactiveSelectors = [
      'button', 'a[href]', '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="option"]', '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
      'input[type="submit"]', 'input[type="button"]', '[tabindex="0"]',
      '[data-action]', '[onclick]', '.slds-button', 'lightning-button', 'lightning-button-icon'
    ];
    
    var targetTag = target.tagName.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea'].indexOf(targetTag) >= 0) {
      return target;
    }
    var role = target.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'].indexOf(role) >= 0) {
      return target;
    }
    
    var current = target;
    var maxDepth = 10;
    
    while (current && current !== document.body && maxDepth > 0) {
      for (var i = 0; i < interactiveSelectors.length; i++) {
        try {
          if (current.matches && current.matches(interactiveSelectors[i])) {
            return current;
          }
        } catch (e) {}
      }
      
      try {
        var style = window.getComputedStyle(current);
        if (style.cursor === 'pointer') {
          var hasText = current.textContent && current.textContent.trim().length > 0 && current.textContent.trim().length < 100;
          var tag = current.tagName.toLowerCase();
          if (hasText && ['span', 'svg', 'path', 'i'].indexOf(tag) < 0) {
            return current;
          }
        }
      } catch (e) {}
      
      current = current.parentElement;
      maxDepth--;
    }
    
    if (['span', 'svg', 'path', 'i', 'img'].indexOf(targetTag) >= 0) {
      var parent = target.parentElement;
      if (parent && parent !== document.body) {
        var parentTag = parent.tagName.toLowerCase();
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
  // IS GENERIC CONTAINER (EXACT COPY from recorder-core.js)
  // ============================================================================
  
  function isGenericContainer(element) {
    var genericContainerTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];
    var tagName = element.tagName.toLowerCase();
    
    if (genericContainerTags.indexOf(tagName) < 0) {
      return false;
    }
    
    var hasId = element.id && !element.id.match(/^\\d+$/) && !element.id.match(/^(lwc|aura)-/i);
    var hasTestId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
    var hasRole = element.getAttribute('role');
    var hasName = element.getAttribute('name');
    var hasAriaLabel = element.getAttribute('aria-label');
    var hasClickableRole = hasRole && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(hasRole) >= 0;
    var text = (element.textContent || '').trim();
    var hasShortText = text.length > 0 && text.length < 50;
    
    return !hasId && !hasTestId && !hasClickableRole && !hasName && !hasAriaLabel && !hasShortText;
  }

  // ============================================================================
  // ACTION RECORDING HELPERS
  // ============================================================================
  
  function getSelectorKey(el) {
    if (el.id) return '#' + el.id;
    if (el.name) return '[name="' + el.name + '"]';
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    if (el.placeholder) return '[placeholder="' + el.placeholder + '"]';
    return el.tagName + '_' + (el.className || '').split(' ')[0];
  }

  function findExistingFillIndex(selectorKey) {
    var actions = window.__flowstralActions__;
    var now = Date.now();
    
    for (var i = actions.length - 1; i >= 0; i--) {
      var action = actions[i];
      if (now - action.timestamp > 30000) break;
      
      if (action.type === 'fill') {
        var actionKey = action.element && action.element.name ? '[name="' + action.element.name + '"]' :
                       action.element && action.element.id ? '#' + action.element.id :
                       action.element && action.element.placeholder ? '[placeholder="' + action.element.placeholder + '"]' :
                       (action.element && action.element.tagName) || '';
        if (actionKey === selectorKey) {
          return i;
        }
      }
    }
    return -1;
  }

  function recordAction(type, element, extra) {
    var info = getElementInfo(element);
    if (!info) return;
    
    var action = {
      type: type,
      element: info,
      url: window.location.href,
      timestamp: Date.now()
    };
    
    if (extra) {
      for (var key in extra) {
        action[key] = extra[key];
      }
    }
    
    window.__flowstralActions__.push(action);
    console.log('[Flowstral] Action:', type, info.text || info.name || info.id || info.tagName);
  }

  function flushPendingInput() {
    if (!pendingInput) return;
    clearTimeout(inputTimeout);
    
    var el = pendingInput.element;
    var value = pendingInput.value || el.value;
    
    if (!value) {
      pendingInput = null;
      return;
    }
    
    var selectorKey = getSelectorKey(el);
    var existingIdx = findExistingFillIndex(selectorKey);
    
    if (existingIdx >= 0) {
      var existing = window.__flowstralActions__[existingIdx];
      existing.value = value;
      existing.displayValue = pendingInput.isPassword ? '********' : value;
      existing.element.value = value;
      existing.timestamp = Date.now();
      console.log('[Flowstral] Updated existing fill:', selectorKey);
    } else {
      var type = (el.type || '').toLowerCase();
      var label = getFieldLabel(el);
      var isSensitive = isSensitiveField(el, type, { label: label });
      var displayValue = isSensitive ? '••••••••' : value;
      
      recordAction('fill', el, {
        value: value,
        displayValue: displayValue,
        isPassword: type === 'password',
        isSensitive: isSensitive
      });
    }
    
    pendingInput = null;
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  // Click handler
  document.addEventListener('click', function(e) {
    var target = e.target;
    flushPendingInput();
    
    var element = findInteractiveElement(target);
    if (!element) {
      console.log('[Flowstral] No interactive element found');
      return;
    }
    
    var tag = element.tagName.toLowerCase();
    var type = element.type ? element.type.toLowerCase() : '';
    
    if (tag === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].indexOf(type) >= 0) {
      return;
    }
    if (tag === 'textarea') {
      return;
    }
    if (isGenericContainer(element)) {
      return;
    }
    if (element === document.body || element === document.documentElement) {
      return;
    }
    if (tag === 'input' && (type === 'submit' || type === 'button')) {
      recordAction('submit', element);
      return;
    }
    
    recordAction('click', element);
  }, true);

  // Submit handler
  document.addEventListener('submit', function(e) {
    flushPendingInput();
    var form = e.target;
    var submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
    if (submitBtn) {
      recordAction('submit', submitBtn);
    }
  }, true);

  // Input handler (debounced)
  document.addEventListener('input', function(e) {
    var el = e.target;
    var tag = el.tagName.toUpperCase();
    
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    
    var type = (el.type || '').toLowerCase();
    if (tag === 'INPUT' && ['checkbox', 'radio', 'submit', 'button', 'file', 'hidden'].indexOf(type) >= 0) {
      return;
    }
    
    var value = el.value || '';
    
    if (pendingInput && pendingInput.element === el) {
      pendingInput.value = value;
      clearTimeout(inputTimeout);
    } else {
      flushPendingInput();
      pendingInput = {
        element: el,
        value: value,
        isPassword: type === 'password',
        startTime: Date.now()
      };
    }
    
    inputTimeout = setTimeout(function() {
      flushPendingInput();
    }, 1500);
  }, true);

  // Change handler (select, checkbox, radio)
  document.addEventListener('change', function(e) {
    flushPendingInput();
    var el = e.target;
    var tag = el.tagName.toUpperCase();
    var type = (el.type || '').toLowerCase();
    
    if (tag === 'SELECT') {
      var selectedText = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
      recordAction('select', el, { value: selectedText });
    } else if (tag === 'INPUT' && type === 'checkbox') {
      recordAction(el.checked ? 'check' : 'uncheck', el);
    } else if (tag === 'INPUT' && type === 'radio') {
      recordAction('click', el);
    }
  }, true);

  // Keydown handler
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      flushPendingInput();
    }
  }, true);

  console.log('[Flowstral] Recorder injected - ready to capture actions');
})();
`;
}

module.exports = { generateRecorderScript };

