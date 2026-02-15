/**
 * Core recorder script injected into browser pages.
 * Captures all user interactions (clicks, fills, selects, etc.)
 * and stores them in window.__flowstralActions__.
 * This is the EXACT SAME logic as the browser extension.
 */

function getRecorderScript() {
    return `
(function() {
  try {
  if (window.__flowstralRecorderInjected__) return;
  window.__flowstralRecorderInjected__ = true;
  window.__flowstralActions__ = window.__flowstralActions__ || [];

  // Silent mode - suppress console logs in Salesforce to avoid security warnings
  var _silent = (window.location.href || '').indexOf('salesforce') >= 0 || (window.location.href || '').indexOf('force.com') >= 0;
  var _log = function() { if (!_silent && console && console.log) { try { console.log.apply(console, arguments); } catch(e){} } };

  // ========== INJECT SHARED RECORDER ENGINE ==========
  ${this.recorderEngineCode}
  
  var Engine = window.FlowstralRecorderEngine || {};
  var SmartSelector = Engine.SmartSelector;
  var findInteractiveElement = Engine.findInteractiveElement || function(t) { return t; };
  var isGenericContainer = Engine.isGenericContainer || function() { return false; };
  var isSensitiveField = Engine.isSensitiveField || function() { return false; };
  var getVisibleText = Engine.getVisibleText || function(el) { return (el.textContent || '').trim().substring(0, 80); };
  var getFieldLabel = Engine.getFieldLabel || function(el) { return el.name || el.id || 'input'; };

  var smartSelector = SmartSelector ? new SmartSelector() : null;
  if (smartSelector) {
    smartSelector.detectAndSetApp();
    _log('[Flowstral] App:', smartSelector.currentApp, smartSelector.appConfig.name);
  }

  var pendingInput = null;
  var inputTimeout = null;
  var INPUT_DEBOUNCE_MS = 1500;

  // ========== GENERATE DESCRIPTION - SAFE VERSION ==========
  function generateDescription(action, element, options) {
    try {
      options = options || {};
      var isSensitive = options.isSensitive || false;
      var displayValue = options.displayValue || null;
      
      // For fill actions
      if (action === 'Fill' && displayValue !== null) {
        var lockIcon = isSensitive ? '🔒 ' : '';
        var fieldLabel = getFieldLabel(element);
        var val = displayValue.length > 20 ? displayValue.substring(0, 17) + '...' : displayValue;
        if (fieldLabel && element.tagName && fieldLabel !== element.tagName.toLowerCase()) {
          return lockIcon + 'Fill ' + fieldLabel + ': "' + val + '"';
        }
        return lockIcon + 'Fill input: "' + val + '"';
      }
      
      // For other actions - get text
      var text = getVisibleText(element);
      if (text && text.length > 0) {
        var truncated = text.length > 30 ? text.substring(0, 27) + '...' : text;
        return action + ' "' + truncated + '"';
      }
      
      var getAttr = function(name) { 
        try { return element.getAttribute ? element.getAttribute(name) : null; } 
        catch(e) { return null; } 
      };
      var label = getAttr('aria-label') || getAttr('placeholder');
      if (label) return action + ' ' + label;
      
      return action + ' ' + (element.tagName ? element.tagName.toLowerCase() : 'element');
    } catch(err) { return action + ' element'; }
  }

  // ========== GET ELEMENT ATTRIBUTES - SAFE VERSION ==========
  function getElementAttributes(element) {
    if (!element) return {};
    try {
      var getAttr = function(name) { 
        try { return element.getAttribute ? element.getAttribute(name) : null; } 
        catch(e) { return null; } 
      };
      return {
        id: element.id || null,
        name: getAttr('name'),
        title: getAttr('title'),
        placeholder: getAttr('placeholder'),
        ariaLabel: getAttr('aria-label'),
        role: getAttr('role'),
        testId: getAttr('data-testid') || getAttr('data-test-id'),
        innerText: (element.innerText || '').trim().substring(0, 100),
        textContent: (element.textContent || '').trim().substring(0, 100),
        elementType: element.type || getAttr('type'),
        tagName: element.tagName ? element.tagName.toLowerCase() : null,
        className: (typeof element.className === 'string') ? element.className : null,
        value: getAttr('value') || element.value || null,
        href: getAttr('href')
      };
    } catch(err) { return {}; }
  }

  // ========== ADD ACTION - ENHANCED DEDUPLICATION ==========
  function addAction(actionData) {
    try {
      // Dedupe fill actions - use fieldKey for matching
      if (actionData.type === 'fill') {
        var fieldKey = actionData.fieldKey || actionData.name || actionData.id || actionData.placeholder || '';
        
        for (var i = window.__flowstralActions__.length - 1; i >= 0; i--) {
          var prev = window.__flowstralActions__[i];
          if (prev && prev.type === 'fill') {
            var prevFieldKey = prev.fieldKey || prev.name || prev.id || prev.placeholder || '';
            
            // If same field, update instead of adding
            if (prevFieldKey && fieldKey && prevFieldKey === fieldKey) {
              // Only update if value changed
              if (prev.value !== actionData.value) {
                prev.value = actionData.value;
                prev.displayValue = actionData.displayValue;
                prev.description = actionData.description;
                prev.timestamp = actionData.timestamp;
                _log('[Flowstral] Updated fill:', actionData.description);
              }
              return;
            }
          }
        }
      }
      
      // CONSERVATIVE click deduplication - only skip TRUE double-clicks
      // Allow same button (like "Next") to be clicked multiple times after other actions
      if (actionData.type === 'click') {
        var last = window.__flowstralActions__[window.__flowstralActions__.length - 1];
        if (last && last.type === 'click') {
          var timeDiff = Date.now() - (last.timestamp || 0);
          // Only skip if SAME click within 300ms (true double-click debounce)
          if (timeDiff < 300 && last.description === actionData.description) {
            _log('[Flowstral] Skipping double-click:', actionData.description);
            return;
          }
        }
      }
      
      // Dedupe navigations - skip if same URL
      if (actionData.type === 'navigate') {
        var lastNav = null;
        for (var k = window.__flowstralActions__.length - 1; k >= 0; k--) {
          if (window.__flowstralActions__[k].type === 'navigate') {
            lastNav = window.__flowstralActions__[k];
            break;
          }
        }
        if (lastNav && lastNav.url === actionData.url) {
          return;
        }
      }
      
      // Add unique ID to action
      actionData.id = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      
      window.__flowstralActions__.push(actionData);
      _log('[Flowstral]', actionData.description || actionData.type);
    } catch(err) { /* Silent */ }
  }

  // Track flushed inputs to prevent duplicates
  var flushedInputs = new Set();

  function flushPendingInput() {
    try {
      if (!pendingInput) return;
      clearTimeout(inputTimeout);
      
      var el = pendingInput.element;
      if (!el) { pendingInput = null; return; }
      
      // Get value - handle both regular inputs and contenteditable
      var value = pendingInput.value || el.value || el.textContent || '';
      if (!value || value.length === 0) { pendingInput = null; return; }
      
      // Get tagName safely
      var tagName = (el.tagName || '').toLowerCase() || 'input';
      
      // Create unique key for this input field - include aria-label for Lightning components
      var ariaLabel = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
      var fieldKey = (el.name || '') + '|' + (el.id || '') + '|' + (el.placeholder || ariaLabel || '');
      
      // Skip if we already recorded this exact field with this value
      if (flushedInputs.has(fieldKey + ':' + value)) {
        pendingInput = null;
        return;
      }
      
      var type = (el.type || '').toLowerCase();
      var isPassword = type === 'password' || isSensitiveField(el, type);
      var displayValue = isPassword ? '••••••••' : value;
      
      var selector = smartSelector ? smartSelector.getBestSelector(el) : {};
      var attrs = getElementAttributes(el);
      
      addAction({
        type: 'fill',
        selector: selector,
        timestamp: Date.now(),
        description: generateDescription('Fill', el, { isSensitive: isPassword, displayValue: displayValue }),
        tagName: tagName,
        value: value,
        displayValue: displayValue,
        isSensitive: isPassword,
        app: selector.app,
        fieldKey: fieldKey,
        ...attrs
      });
      
      flushedInputs.add(fieldKey + ':' + value);
      pendingInput = null;
    } catch(err) { pendingInput = null; }
  }

  // ========== SALESFORCE-SPECIFIC ELEMENT PATTERNS ==========
  var SF_CLICKABLE_PATTERNS = {
    // App Launcher (9-dots icon)
    appLauncher: [
      'button[title="App Launcher"]',
      '[data-aura-class="forceModuleSwitcher"]',
      'one-app-launcher-header',
      'div.appLauncher button',
      '[class*="appLauncher"] button',
      '.slds-icon-waffle',
      'one-app-launcher-menu',
      '[data-component-id*="appLauncher"]'
    ],
    // Profile/User Menu
    profileMenu: [
      'button[class*="userProfile"]',
      '[data-aura-class="uiPopupTrigger"]',
      'span.uiImage',
      '.profileTrigger',
      '[class*="profile"] button',
      'one-app-nav-bar-item-root[data-id="profile"]',
      '[data-id="userProfileMenu"]',
      '.oneUserProfileCard',
      'button[title*="View profile"]'
    ],
    // Tabs (lightning-tabset, record details, etc.)
    tabs: [
      '[role="tab"]',
      'lightning-tab',
      'li[role="presentation"] a',
      '.slds-tabs_default__item a',
      'a[role="tab"]',
      '[data-tab-name]',
      '[data-tab-id]',
      'slot[name="tabs"] a',
      '.tabHeader',
      'lightning-tabset a'
    ],
    // Menu items
    menuItems: [
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="option"]',
      'lightning-menu-item',
      '.slds-dropdown__item a',
      '.slds-listbox__option',
      'a[role="option"]'
    ],
    // Record/Detail page actions
    recordActions: [
      '[data-target-selection-name*="action"]',
      'lightning-button-menu',
      'runtime_platform_actions-action-renderer',
      'button[name="Edit"]',
      'button[name="Delete"]',
      'button[name="Clone"]',
      '[data-refid]'
    ]
  };
  
  // Helper to check if click target matches any Salesforce pattern
  function matchesSalesforcePattern(element) {
    if (!element) return null;
    
    // Check all patterns
    for (var category in SF_CLICKABLE_PATTERNS) {
      var patterns = SF_CLICKABLE_PATTERNS[category];
      for (var i = 0; i < patterns.length; i++) {
        try {
          if (element.matches && element.matches(patterns[i])) {
            return { category: category, pattern: patterns[i] };
          }
          // Also check if it's inside such an element
          var closest = element.closest(patterns[i]);
          if (closest) {
            return { category: category, pattern: patterns[i], element: closest };
          }
        } catch(e) {}
      }
    }
    return null;
  }
  
  // Helper to find best clickable element in Shadow DOM
  function findClickableInShadow(target) {
    try {
      if (!target) return null;
      
      // If target itself is interactive, return it
      var tag = (target.tagName || '').toLowerCase();
      if (['button', 'a', 'input'].indexOf(tag) >= 0) return target;
      
      var role = target.getAttribute && target.getAttribute('role');
      if (role && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(role) >= 0) return target;
      
      // Check if we're inside a Shadow DOM
      var root = target.getRootNode();
      if (root !== document && root.host) {
        // We're in shadow DOM - the host is what we want
        var host = root.host;
        var hostTag = (host.tagName || '').toLowerCase();
        
        // If host is a Lightning component, use it
        if (hostTag.indexOf('-') >= 0) {
          return host;
        }
      }
      
      // Walk up to find interactive element
      var current = target;
      var maxDepth = 10;
      while (current && current !== document.body && maxDepth-- > 0) {
        var curTag = (current.tagName || '').toLowerCase();
        if (['button', 'a'].indexOf(curTag) >= 0) return current;
        
        var curRole = current.getAttribute && current.getAttribute('role');
        if (curRole && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(curRole) >= 0) return current;
        
        // Check for cursor pointer
        try {
          var style = window.getComputedStyle(current);
          if (style.cursor === 'pointer' && current.textContent && current.textContent.trim().length < 100) {
            return current;
          }
        } catch(e) {}
        
        current = current.parentElement;
      }
      
      return target;
    } catch(e) {
      return target;
    }
  }

  // ========== CAPTURE PHASE HANDLER FOR ALL CLICKS ==========
  // DISABLED: Now using composedPath-based capture in _getClickCaptureScript()
  // This old handler caused duplicates and didn't work with Shadow DOM
  /*
  document.addEventListener('click_DISABLED', function(e) {
    try {
      // IGNORE clicks on Flowstral overlay elements
      if (e.target.closest && e.target.closest('#flowstral-host')) return;
      if (e.target.closest && e.target.closest('#flowstral-suggestions-host')) return;
      if (e.target.closest && e.target.closest('[data-flowstral-ignore="true"]')) return;
      if (e.target.getAttribute && e.target.getAttribute('data-flowstral-ignore') === 'true') return;
      
      // ========== SALESFORCE PATTERN CHECK ==========
      var sfMatch = matchesSalesforcePattern(e.target);
      if (sfMatch) {
        var sfElement = sfMatch.element || e.target;
        sfElement = findClickableInShadow(sfElement) || sfElement;
        
        console.log('[Flowstral] Salesforce pattern matched:', sfMatch.category, sfMatch.pattern);
        
        var sfSelector = smartSelector ? smartSelector.getBestSelector(sfElement) : {};
        var sfAttrs = getElementAttributes(sfElement);
        var sfText = (sfElement.getAttribute('title') || 
                     sfElement.getAttribute('aria-label') || 
                     sfElement.textContent || '').trim();
        
        // Clean up text
        sfText = sfText.replace(/\\s+/g, ' ').substring(0, 50);
        if (!sfText) sfText = sfMatch.category;
        
        addAction({
          type: 'click',
          selector: sfSelector,
          timestamp: Date.now(),
          description: 'Click "' + sfText + '"',
          tagName: (sfElement.tagName || '').toLowerCase(),
          isSalesforcePattern: true,
          sfCategory: sfMatch.category,
          app: sfSelector.app,
          appName: sfSelector.appName,
          ...sfAttrs
        });
        
        window.__flowstralLastSubmitClick = Date.now();
        return;
      }
      
      var element = findInteractiveElement(e.target);
      if (!element || !element.tagName) {
        // Try finding in shadow DOM
        element = findClickableInShadow(e.target);
      }
      if (!element || !element.tagName) return;
      
      var tagName = element.tagName.toLowerCase();
      var type = element.type ? element.type.toLowerCase() : '';
      
      // Get button text from value (for input) or textContent (for button)
      var buttonText = '';
      if (tagName === 'input') {
        buttonText = (element.value || '').toLowerCase().trim();
      } else {
        buttonText = (element.textContent || element.innerText || '').toLowerCase().trim();
      }
      
      // Normalize whitespace and fix repeated text
      buttonText = buttonText.replace(/\\s+/g, ' ').trim();
      var words = buttonText.split(' ');
      if (words.length >= 2 && words[0] === words[1]) {
        buttonText = words.slice(1).join(' ');
      }
      
      // Also check aria-label and title for button text
      var ariaLabel = (element.getAttribute && element.getAttribute('aria-label') || '').toLowerCase();
      var title = (element.getAttribute && element.getAttribute('title') || '').toLowerCase();
      var id = (element.id || '').toLowerCase();
      var className = (element.className || '').toString().toLowerCase();
      
      // ENHANCED: Check if this is a submit/login button - more patterns
      var submitPatterns = ['log in', 'login', 'sign in', 'signin', 'submit', 'verify', 'continue', 'next', 'proceed', 'authenticate', 'enter'];
      var isSubmitLike = type === 'submit' || (tagName === 'input' && type === 'submit');
      
      if (!isSubmitLike) {
        for (var i = 0; i < submitPatterns.length; i++) {
          var pattern = submitPatterns[i];
          if (buttonText.indexOf(pattern) >= 0 || 
              ariaLabel.indexOf(pattern) >= 0 || 
              title.indexOf(pattern) >= 0 ||
              id.indexOf(pattern) >= 0 ||
              className.indexOf(pattern) >= 0) {
            isSubmitLike = true;
            break;
          }
        }
      }
      
      // Also check for button inside a login form
      if (!isSubmitLike) {
        var form = element.closest('form');
        if (form) {
          var formId = (form.id || '').toLowerCase();
          var formClass = (form.className || '').toString().toLowerCase();
          var formAction = (form.action || '').toLowerCase();
          if (formId.indexOf('login') >= 0 || formClass.indexOf('login') >= 0 || 
              formAction.indexOf('login') >= 0 || formAction.indexOf('auth') >= 0) {
            // Any button in a login form is likely a submit
            if (tagName === 'button' || (tagName === 'input' && (type === 'button' || type === 'submit'))) {
              isSubmitLike = true;
            }
          }
        }
      }
      
      // Debug: Always log click info
      console.log('[Flowstral-Capture] Click:', { tagName: tagName, type: type, text: buttonText.substring(0, 30), isSubmitLike: isSubmitLike });
      
      if (isSubmitLike) {
        console.log('[Flowstral] LOGIN/SUBMIT button clicked:', buttonText.substring(0, 30) || type);
        
        // Immediately capture all form inputs FIRST (before page might navigate)
        var form = element.closest('form') || document;
        var inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="number"], input:not([type]), input[type=""]');
        
        inputs.forEach(function(inp) {
          if (inp.value && inp.value.length > 0) {
            var inputType = (inp.type || '').toLowerCase();
            var isPassword = inputType === 'password' || isSensitiveField(inp, inputType);
            var displayValue = isPassword ? '••••••••' : inp.value;
            var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
            var attrs = getElementAttributes(inp);
            var fieldKey = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.placeholder || '');
            
            // Check if already recorded
            var alreadyRecorded = window.__flowstralActions__.some(function(a) {
              return a.type === 'fill' && a.fieldKey === fieldKey;
            });
            
            if (!alreadyRecorded) {
              console.log('[Flowstral] Recording input before submit:', inp.name || inp.id || 'input');
              addAction({
                type: 'fill',
                selector: selector,
                timestamp: Date.now(),
                description: generateDescription('Fill', inp, { isSensitive: isPassword, displayValue: displayValue }),
                tagName: 'input',
                value: inp.value,
                displayValue: displayValue,
                isSensitive: isPassword,
                app: selector.app,
                fieldKey: fieldKey,
                ...attrs
              });
            }
          }
        });
        
        // NOW record the login/submit button click
        var btnSelector = smartSelector ? smartSelector.getBestSelector(element) : {};
        var btnAttrs = getElementAttributes(element);
        
        // Use better text for description
        var descText = buttonText.substring(0, 30) || ariaLabel.substring(0, 30) || title.substring(0, 30) || 'Submit';
        // Capitalize first letter
        descText = descText.charAt(0).toUpperCase() + descText.slice(1);
        
        addAction({
          type: 'click',
          selector: btnSelector,
          timestamp: Date.now(),
          description: 'Click "' + descText + '"',
          tagName: tagName,
          inputType: type,
          isSubmit: true,
          app: btnSelector.app,
          appName: btnSelector.appName,
          ...btnAttrs
        });
        
        // Mark that we've handled this click
        window.__flowstralLastSubmitClick = Date.now();
        return; // Don't let bubble handler also record this
      }
    } catch(err) { 
      try { console.error('[Flowstral] Submit capture error:', err); } catch(e) {} 
    }
  }, true); // CAPTURE PHASE - runs before bubbling
  */
  
  // ========== BUBBLE PHASE CLICK HANDLER FOR REGULAR CLICKS ==========
  // DISABLED: Now using composedPath-based capture in _getClickCaptureScript()
  /*
  document.addEventListener('click_DISABLED', function(e) {
    // IGNORE clicks on Flowstral overlay elements (check immediately, not in setTimeout)
    if (e.target.closest && e.target.closest('#flowstral-overlay')) return;
    if (e.target.getAttribute && e.target.getAttribute('data-flowstral-ignore') === 'true') return;
    if (e.target.closest && e.target.closest('[data-flowstral-ignore="true"]')) return;
    
    setTimeout(function() {
      try {
        // Skip if we just handled a submit or Salesforce pattern button in capture phase
        if (window.__flowstralLastSubmitClick && Date.now() - window.__flowstralLastSubmitClick < 200) {
          return;
        }
        
        flushPendingInput();
        
        var element = findInteractiveElement(e.target);
        
        // ENHANCED: If no interactive element found, try Shadow DOM approach
        if (!element || !element.tagName) {
          element = findClickableInShadow(e.target);
        }
        
        // ENHANCED: Check Lightning custom elements (hyphenated tags)
        if (!element || !element.tagName) {
          var current = e.target;
          while (current && current !== document.body) {
            var tag = (current.tagName || '').toLowerCase();
            if (tag.indexOf('-') >= 0 || tag.indexOf('lightning') >= 0) {
              element = current;
              break;
            }
            current = current.parentElement;
          }
        }
        
        if (!element || !element.tagName) return;
        
        var tagName = element.tagName.toLowerCase();
        var type = element.type ? element.type.toLowerCase() : '';
        
        // Skip click on text inputs - fill will be recorded
        if (tagName === 'input' && ['text','email','password','search','tel','url','number'].indexOf(type) >= 0) {
          return;
        }
        if (tagName === 'textarea') return;
        if (element.isContentEditable) return;
        
        // Skip radio/checkbox inputs - change handler will record
        if (tagName === 'input' && (type === 'radio' || type === 'checkbox')) {
          return;
        }
        
        // Skip submit buttons - already handled in capture phase
        var buttonText = (element.textContent || element.value || '').toLowerCase().trim();
        var ariaLabel = (element.getAttribute && element.getAttribute('aria-label') || '').toLowerCase();
        var title = (element.getAttribute && element.getAttribute('title') || '').toLowerCase();
        
        var isSubmitLike = type === 'submit' || 
                          buttonText.indexOf('log in') >= 0 || 
                          buttonText.indexOf('login') >= 0 || 
                          buttonText.indexOf('sign in') >= 0 ||
                          buttonText.indexOf('submit') >= 0 ||
                          buttonText.indexOf('verify') >= 0 ||
                          buttonText.indexOf('continue') >= 0 ||
                          buttonText.indexOf('next') >= 0; // Added "Next" button support
        
        if (isSubmitLike) {
          return; // Already handled in capture phase
        }
        
        // DON'T skip labels that are part of segmented controls / styled radio buttons
        // These are interactive elements that look like buttons but wrap hidden inputs
        if (tagName === 'label') {
          var hasRadioOrCheckbox = element.querySelector('input[type="radio"], input[type="checkbox"]');
          var isInButtonGroup = element.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control');
          var hasSelectedState = element.classList && (
            element.classList.contains('active') || 
            element.classList.contains('selected') || 
            element.classList.contains('checked')
          );
          
          // If it's a label in a button-like context, it SHOULD be recorded
          if (hasRadioOrCheckbox || isInButtonGroup || hasSelectedState) {
            // Don't skip - let it be recorded
            console.log('[Flowstral] Recording label click for segmented control:', buttonText.substring(0, 30));
          } else {
            return; // Skip normal labels
          }
        }
        
        // ENHANCED: Always record Lightning components (hyphenated tags)
        var isLightningComponent = tagName.indexOf('-') >= 0;
        
        // For generic containers, require meaningful attributes (but allow Lightning components)
        var genericTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];
        if (!isLightningComponent && genericTags.indexOf(tagName) >= 0) {
          var hasId = element.id && !/^\\d+$/.test(element.id) && !/^(lwc|aura)-/i.test(element.id);
          var hasTestId = element.getAttribute && (element.getAttribute('data-testid') || element.getAttribute('data-test-id'));
          var hasRole = element.getAttribute && element.getAttribute('role');
          var hasAriaLabel = element.getAttribute && element.getAttribute('aria-label');
          var hasTitle = element.getAttribute && element.getAttribute('title');
          var hasClickableRole = hasRole && ['button','link','menuitem','tab','option','menuitemcheckbox'].indexOf(hasRole) >= 0;
          var text = (element.textContent || '').trim();
          var hasShortText = text.length > 0 && text.length < 50;
          
          if (!hasId && !hasTestId && !hasClickableRole && !hasAriaLabel && !hasTitle && !hasShortText) {
            return;
          }
        }
        
        if (!isLightningComponent && isGenericContainer(element)) return;
        if (element === document.body || element === document.documentElement) return;
        
        var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
        var attrs = getElementAttributes(element);
        
        // Get best description text
        var descText = title || ariaLabel || buttonText || tagName;
        descText = descText.replace(/\\s+/g, ' ').trim().substring(0, 50);
        if (descText) {
          descText = descText.charAt(0).toUpperCase() + descText.slice(1);
        }
        
        addAction({
          type: 'click',
          selector: selector,
          timestamp: Date.now(),
          description: generateDescription('Click', element) || ('Click "' + descText + '"'),
          tagName: tagName,
          inputType: type,
          app: selector.app,
          appName: selector.appName,
          ...attrs
        });
      } catch(err) { /* Silent - don't break Salesforce */ }
    }, 0);
  }, true); // Use capture phase
  */

  // ========== INPUT HANDLER - ENHANCED FOR SALESFORCE ==========
  // NOTE: Input capture is now handled by composedPath in _getClickCaptureScript()
  // This old handler is kept as backup but may cause duplicates
  /*
  // Captures input on regular inputs AND Lightning combobox/search
  document.addEventListener('input', function(e) {
    try {
      var element = e.target;
      if (!element) return;
      
      // Handle both regular inputs and contenteditable/combobox
      var tagName = (element.tagName || '').toLowerCase();
      var value = element.value || element.textContent || '';
      
      // Skip if no value
      if (!value) return;
      
      // Check if it's a valid input element
      var isInput = tagName === 'input' || tagName === 'textarea';
      var isContentEditable = element.isContentEditable;
      var isLightningInput = tagName.indexOf('lightning-') >= 0 || element.closest('lightning-input, lightning-combobox, lightning-lookup');
      
      if (!isInput && !isContentEditable && !isLightningInput) return;
      
      var type = (element.type || '').toLowerCase();
      if (['checkbox','radio','submit','button','file','hidden'].indexOf(type) >= 0) return;
      
      if (pendingInput && pendingInput.element === element) {
        pendingInput.value = value;
        clearTimeout(inputTimeout);
      } else {
        flushPendingInput();
        pendingInput = { element: element, value: value, startTime: Date.now() };
      }
      
      // Shorter timeout for password fields (they often auto-submit)
      var timeout = type === 'password' ? 500 : INPUT_DEBOUNCE_MS;
      inputTimeout = setTimeout(flushPendingInput, timeout);
    } catch(err) { /* Silent */ }
  }, true); // Use capture phase to catch events before Salesforce
  */

  // ========== CHANGE HANDLER - SAFE VERSION ==========
  document.addEventListener('change', function(e) {
    setTimeout(function() {
      try {
        flushPendingInput();
        
        var element = e.target;
        if (!element || !element.tagName) return;
        var tagName = element.tagName.toLowerCase();
        var type = (element.type || '').toLowerCase();
        
        if (tagName === 'select') {
          var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
          var selectedText = (element.options && element.options[element.selectedIndex]) ? element.options[element.selectedIndex].text : element.value;
          var attrs = getElementAttributes(element);
          
          addAction({
            type: 'select',
            selector: selector,
            timestamp: Date.now(),
            description: generateDescription('Select', element) + ': "' + selectedText + '"',
            tagName: tagName,
            value: element.value,
            label: selectedText,
            app: selector.app,
            ...attrs
          });
        } else if (type === 'checkbox' || type === 'radio') {
          var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
          var attrs = getElementAttributes(element);
          var actionType = type === 'checkbox' ? (element.checked ? 'check' : 'uncheck') : 'click';
          
          addAction({
            type: actionType,
            selector: selector,
            timestamp: Date.now(),
            description: generateDescription(element.checked ? 'Check' : 'Uncheck', element),
            tagName: tagName,
            inputType: type,
            app: selector.app,
            ...attrs
          });
        }
      } catch(err) { /* Silent */ }
    }, 0);
  }, false);

  // ========== KEYDOWN HANDLER - ENHANCED ==========
  document.addEventListener('keydown', function(e) {
    try {
      if (e.key === 'Enter') {
        // Always flush on Enter (password fields, search, etc.)
        flushPendingInput();
        
        // If in a form, capture all fields
        var form = e.target && e.target.closest ? e.target.closest('form') : null;
        if (form) {
          var inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input:not([type])');
          inputs.forEach(function(inp) {
            if (inp.value && inp.value.length > 0 && inp !== e.target) {
              var inputType = (inp.type || '').toLowerCase();
              var isPassword = inputType === 'password' || isSensitiveField(inp, inputType);
              var displayValue = isPassword ? '••••••••' : inp.value;
              var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
              var attrs = getElementAttributes(inp);
              var fieldKey = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.placeholder || '');
              
              var alreadyRecorded = window.__flowstralActions__.some(function(a) {
                return a.type === 'fill' && a.fieldKey === fieldKey;
              });
              
              if (!alreadyRecorded) {
                addAction({
                  type: 'fill',
                  selector: selector,
                  timestamp: Date.now(),
                  description: generateDescription('Fill', inp, { isSensitive: isPassword, displayValue: displayValue }),
                  tagName: 'input',
                  value: inp.value,
                  displayValue: displayValue,
                  isSensitive: isPassword,
                  app: selector.app,
                  fieldKey: fieldKey,
                  ...attrs
                });
              }
            }
          });
        }
      } else if (e.key === 'Tab') {
        flushPendingInput();
      }
    } catch(err) { /* Silent */ }
  }, true);

  // ========== BLUR/FOCUSOUT HANDLER - ENHANCED ==========
  // Use focusout which bubbles (blur doesn't bubble)
  document.addEventListener('focusout', function(e) {
    try {
      var el = e.target;
      if (!el) return;
      var tagName = (el.tagName || '').toLowerCase();
      
      // Handle regular inputs
      if ((tagName === 'input' || tagName === 'textarea') && pendingInput && pendingInput.element === el) {
        pendingInput.value = el.value;
        flushPendingInput();
        return;
      }
      
      // Handle Lightning inputs (combobox, lookup, etc.)
      if (tagName.indexOf('lightning-') >= 0 || el.closest('lightning-input, lightning-combobox, lightning-lookup')) {
        var lightningInput = el.closest('lightning-input, lightning-combobox, lightning-lookup');
        if (lightningInput) {
          var innerInput = lightningInput.querySelector('input');
          if (innerInput && innerInput.value) {
            if (pendingInput && pendingInput.element === innerInput) {
              pendingInput.value = innerInput.value;
              flushPendingInput();
            } else if (innerInput.value.length > 0) {
              // Record this as a fill action
              var isPassword = (innerInput.type || '').toLowerCase() === 'password' || isSensitiveField(innerInput, innerInput.type);
              var displayValue = isPassword ? '••••••••' : innerInput.value;
              var selector = smartSelector ? smartSelector.getBestSelector(innerInput) : {};
              var attrs = getElementAttributes(innerInput);
              
              addAction({
                type: 'fill',
                selector: selector,
                timestamp: Date.now(),
                description: generateDescription('Fill', innerInput, { isSensitive: isPassword, displayValue: displayValue }),
                tagName: 'input',
                value: innerInput.value,
                displayValue: displayValue,
                isSensitive: isPassword,
                app: selector.app,
                ...attrs
              });
            }
          }
        }
      }
    } catch(err) { /* Silent */ }
  }, true);

  // ========== BEFOREUNLOAD HANDLER ==========
  window.addEventListener('beforeunload', function() {
    flushPendingInput();
  });

  window.flushPendingInput = flushPendingInput;
  
  // ========== SHADOW DOM INPUT AND CLICK HANDLER ==========
  // Salesforce App Launcher and other Lightning components use Shadow DOM
  // We need to periodically check for inputs and clicks inside shadow roots
  function attachShadowListeners(root) {
    try {
      // Find all elements that might have shadow roots
      var elements = root.querySelectorAll('*');
      elements.forEach(function(el) {
        if (el.shadowRoot && !el.__flowstralShadowListenersAttached) {
          el.__flowstralShadowListenersAttached = true;
          
          // Attach input listener to shadow root
          el.shadowRoot.addEventListener('input', function(e) {
            try {
              var input = e.target;
              if (!input || !input.tagName) return;
              var tagName = input.tagName.toLowerCase();
              if (tagName !== 'input' && tagName !== 'textarea') return;
              
              var type = (input.type || '').toLowerCase();
              if (['checkbox','radio','submit','button','file','hidden'].indexOf(type) >= 0) return;
              
              var value = input.value || '';
              if (!value) return;
              
              if (pendingInput && pendingInput.element === input) {
                pendingInput.value = value;
                clearTimeout(inputTimeout);
              } else {
                flushPendingInput();
                pendingInput = { element: input, value: value, startTime: Date.now() };
              }
              inputTimeout = setTimeout(flushPendingInput, INPUT_DEBOUNCE_MS);
            } catch(err) { /* Silent */ }
          }, true);
          
          // ========== SHADOW DOM CLICK HANDLER ==========
          // Capture clicks inside shadow DOM (tabs, menus, buttons, etc.)
          // IMPORTANT: Push to __flowstralCDPClicks for unified processing!
          el.shadowRoot.addEventListener('click', function(e) {
            try {
              // Skip if recently handled
              if (window.__flowstralLastSubmitClick && Date.now() - window.__flowstralLastSubmitClick < 200) {
                return;
              }
              
              var target = e.target;
              if (!target || !target.tagName) return;
              
              // Skip input elements (text fields)
              var tag = target.tagName.toLowerCase();
              var type = (target.type || '').toLowerCase();
              if (tag === 'input' && ['text','email','password','search','tel','url','number'].indexOf(type) >= 0) return;
              if (tag === 'textarea') return;
              
              // Find the best interactive element
              var element = findClickableInShadow(target);
              if (!element) element = target;
              
              // Get the host element (lightning component)
              var host = el;
              var hostTag = (host.tagName || '').toLowerCase();
              
              // Determine which to record - host or inner element
              var recordElement = element;
              if (hostTag.indexOf('-') >= 0) {
                // If host is a Lightning component with good attributes, prefer it
                var hostTitle = host.getAttribute('title');
                var hostAriaLabel = host.getAttribute('aria-label');
                var hostLabel = host.getAttribute('label');
                if (hostTitle || hostAriaLabel || hostLabel) {
                  recordElement = host;
                }
              }
              
              var selector = smartSelector ? smartSelector.getBestSelector(recordElement) : {};
              var attrs = getElementAttributes(recordElement);
              
              var descText = recordElement.getAttribute('title') ||
                            recordElement.getAttribute('aria-label') ||
                            recordElement.getAttribute('label') ||
                            (recordElement.textContent || '').trim();
              descText = descText.replace(/\\s+/g, ' ').substring(0, 50);
              
              if (!descText) return; // Skip clicks with no meaningful text
              
              console.log('[Flowstral] Shadow DOM click captured:', descText);
              
              // CRITICAL: Push to CDP queue for unified processing (same as regular clicks)
              // This ensures Shadow DOM clicks like "Next" buttons are properly captured
              window.__flowstralCDPClicks = window.__flowstralCDPClicks || [];
              window.__flowstralCDPClicks.push({
                timestamp: Date.now(),
                tag: (recordElement.tagName || '').toLowerCase(),
                type: recordElement.type || '',
                text: descText,
                title: recordElement.getAttribute('title') || '',
                ariaLabel: recordElement.getAttribute('aria-label') || '',
                id: recordElement.id || '',
                name: recordElement.name || '',
                placeholder: recordElement.placeholder || '',
                role: recordElement.getAttribute('role') || '',
                href: recordElement.href || '',
                description: 'Click "' + descText + '"',
                x: e.clientX,
                y: e.clientY,
                fromShadow: true,
                isSubmit: tag === 'button' && (type === 'submit' || descText.toLowerCase().indexOf('submit') >= 0),
                elementIndex: 0,
                totalMatching: 1
              });
              
              // ALSO add to legacy system for backward compatibility
              addAction({
                type: 'click',
                selector: selector,
                timestamp: Date.now(),
                description: 'Click "' + descText + '"',
                tagName: (recordElement.tagName || '').toLowerCase(),
                isShadowDOM: true,
                hostElement: hostTag,
                app: selector.app,
                appName: selector.appName,
                ...attrs
              });
              
              window.__flowstralLastSubmitClick = Date.now();
            } catch(err) { /* Silent */ }
          }, true);
          
          // Attach focusout listener
          el.shadowRoot.addEventListener('focusout', function(e) {
            try {
              var input = e.target;
              if (!input || !input.tagName) return;
              var tagName = input.tagName.toLowerCase();
              if ((tagName === 'input' || tagName === 'textarea') && pendingInput && pendingInput.element === input) {
                pendingInput.value = input.value;
                flushPendingInput();
              }
            } catch(err) { /* Silent */ }
          }, true);
          
          // Recursively check shadow root for nested shadows
          attachShadowListeners(el.shadowRoot);
        }
      });
    } catch(err) { /* Silent */ }
  }
  
  // Initial scan
  attachShadowListeners(document);
  
  // Use MutationObserver to watch for new shadow hosts
  var shadowObserver = new MutationObserver(function(mutations) {
    try {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            attachShadowListeners(node);
            // Also check if the node itself has shadow
            if (node.shadowRoot && !node.__flowstralShadowListenersAttached) {
              attachShadowListeners(document);
            }
          }
        });
      });
    } catch(err) { /* Silent */ }
  });
  
  shadowObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also periodically scan for new shadow roots (some get created lazily)
  setInterval(function() {
    try {
      attachShadowListeners(document);
    } catch(err) { /* Silent */ }
  }, 2000);
  
  // ========== AGGRESSIVE APP LAUNCHER / SEARCH INPUT CAPTURE ==========
  // Salesforce App Launcher uses deeply nested Shadow DOM - we need to find it
  var lastSearchValues = {};
  var searchPollCount = 0;
  
  function deepFindInputs(root, results) {
    try {
      // Find inputs in current root
      var inputs = root.querySelectorAll('input:not([type="hidden"]):not([type="password"])');
      inputs.forEach(function(inp) {
        if (inp.value && inp.value.length >= 2) {
          results.push(inp);
        }
      });
      
      // Recursively search shadow roots
      var allElements = root.querySelectorAll('*');
      allElements.forEach(function(el) {
        if (el.shadowRoot) {
          deepFindInputs(el.shadowRoot, results);
        }
      });
    } catch(err) {}
  }
  
  setInterval(function() {
    try {
      searchPollCount++;
      var searchInputs = [];
      
      // ====== STRATEGY 1: Direct selectors ======
      var directInputs = document.querySelectorAll(
        'input[placeholder*="Search" i], ' +
        'input[placeholder*="search" i], ' +
        'input[aria-label*="Search" i], ' +
        'input[title*="Search" i], ' +
        'input[name*="search" i], ' +
        'input[class*="search" i], ' +
        'input[role="searchbox"], ' +
        'input[role="combobox"], ' +
        // App launcher specific
        'input[placeholder*="apps" i], ' +
        'input[placeholder*="items" i]'
      );
      directInputs.forEach(function(inp) { searchInputs.push(inp); });
      
      // ====== STRATEGY 2: Lightning component inputs ======
      var lightningSelectors = [
        'lightning-input input',
        'lightning-base-combobox input',
        'lightning-grouped-combobox input',
        'lightning-primitive-input-simple input',
        'one-app-launcher-search input',
        'one-app-launcher-menu input',
        'one-appnav input',
        'one-app-nav-bar input'
      ];
      lightningSelectors.forEach(function(sel) {
        try {
          var found = document.querySelectorAll(sel);
          found.forEach(function(inp) { searchInputs.push(inp); });
        } catch(e) {}
      });
      
      // ====== STRATEGY 3: Deep Shadow DOM search (every 5th poll to save CPU) ======
      if (searchPollCount % 5 === 0) {
        // Find all Lightning/custom element hosts
        var shadowHosts = document.querySelectorAll([
          'lightning-input',
          'lightning-base-combobox', 
          'lightning-grouped-combobox',
          'lightning-primitive-input-simple',
          'one-app-launcher-search',
          'one-app-launcher-menu',
          'one-appnav',
          'one-app-nav-bar',
          'one-app-launcher-header',
          '[class*="appLauncher"]',
          '[class*="search"]'
        ].join(', '));
        
        shadowHosts.forEach(function(host) {
          if (host.shadowRoot) {
            deepFindInputs(host.shadowRoot, searchInputs);
          }
        });
        
        // Also do a full deep search from document
        deepFindInputs(document, searchInputs);
      }
      
      // ====== STRATEGY 4: Find by active element ======
      var activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.value && activeEl.value.length >= 2) {
        searchInputs.push(activeEl);
      }
      // Check shadow root of active element
      if (activeEl && activeEl.shadowRoot) {
        var shadowActive = activeEl.shadowRoot.querySelector('input:focus');
        if (shadowActive && shadowActive.value && shadowActive.value.length >= 2) {
          searchInputs.push(shadowActive);
        }
      }
      
      // ====== Process found inputs ======
      var uniqueInputs = [];
      var seenInputs = new Set();
      searchInputs.forEach(function(inp) {
        if (!seenInputs.has(inp)) {
          seenInputs.add(inp);
          uniqueInputs.push(inp);
        }
      });
      
      uniqueInputs.forEach(function(inp) {
        if (!inp || !inp.value || inp.value.length < 2) return;
        var type = (inp.type || '').toLowerCase();
        if (type === 'password' || type === 'hidden') return;
        
        var value = inp.value.trim();
        
        // Create unique key for this input
        var inputKey = (inp.id || '') + '|' + (inp.name || '') + '|' + (inp.placeholder || '') + '|' + (inp.getAttribute('aria-label') || '');
        var recordKey = inputKey + ':' + value;
        
        // Skip if already recorded this exact input+value
        window.__flowstralRecordedSearches = window.__flowstralRecordedSearches || {};
        if (window.__flowstralRecordedSearches[recordKey]) return;
        
        // Skip if value hasn't changed since last check for this input
        if (lastSearchValues[inputKey] === value) return;
        
        // Check if we already have this in actions
        var alreadyRecorded = window.__flowstralActions__.some(function(a) {
          return a.type === 'fill' && a.value === value;
        });
        
        if (!alreadyRecorded) {
          lastSearchValues[inputKey] = value;
          window.__flowstralRecordedSearches[recordKey] = true;
          
          var placeholder = inp.placeholder || inp.getAttribute('aria-label') || inp.getAttribute('title') || 'Search';
          var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
          var attrs = getElementAttributes(inp);
          
          console.log('[Flowstral] Captured search/app launcher input:', value, 'in', placeholder);
          
          addAction({
            type: 'fill',
            selector: selector,
            timestamp: Date.now(),
            description: 'Fill ' + placeholder + ': "' + value + '"',
            tagName: 'input',
            value: value,
            displayValue: value,
            isSensitive: false,
            app: selector.app,
            fieldKey: 'search|' + inputKey,
            ...attrs
          });
        }
      });
    } catch(err) { /* Silent */ }
  }, 300); // Check every 300ms for more responsive capture
  
  _log('[Flowstral] Playwright recorder ready, app:', smartSelector ? smartSelector.currentApp : 'unknown');
  } catch(e) { /* Silent fail - avoid breaking page */ }
})();
`;
}

module.exports = { getRecorderScript };
