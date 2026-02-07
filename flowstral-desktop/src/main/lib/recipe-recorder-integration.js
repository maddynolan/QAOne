/**
 * Recipe Recorder Integration
 * 
 * Integrates the new ElementRecipe-based recording with the existing recorder.
 * Can be enabled/disabled via config, allowing gradual rollout.
 * 
 * @author Flowstral
 * @version 2.0.0
 */

const { getElementAnalyzerScript, generateDescription, recipeToLegacySelector } = require('./element-recipe');
const { getActionCoalescerScript } = require('./action-coalescer');

// ============================================================================
// V2 CLICK CAPTURE SCRIPT
// ============================================================================

/**
 * Get the v2 click capture script that uses ElementRecipe
 * This captures richer element data and supports action coalescing
 */
function getRecipeClickCaptureScript() {
  return `
(function() {
  // Prevent double injection
  if (window.__flowstralRecipeRecorderInjected) return;
  window.__flowstralRecipeRecorderInjected = true;
  
  // Inject the element analyzer
  ${getElementAnalyzerScript()}
  
  // Inject the action coalescer
  ${getActionCoalescerScript()}
  
  var analyzer = window.__flowstralElementAnalyzer;
  var coalescer = window.__flowstralActionCoalescer;
  
  // Storage for captured actions
  window.__flowstralRecipeActions = window.__flowstralRecipeActions || [];
  
  // Filter for framework internals
  function isFrameworkInternal(element) {
    if (!element) return false;
    
    // Check text content for framework code
    var text = (element.textContent || '').trim();
    var internalPatterns = [
      '/@react',
      '__webpack',
      'injectIntoGlobalHook',
      'webpackJsonp',
      'undefined is not',
      'Cannot read propert',
    ];
    
    for (var i = 0; i < internalPatterns.length; i++) {
      if (text.indexOf(internalPatterns[i]) !== -1) return true;
    }
    
    // Check if element is a script tag or inside one
    if (element.tagName === 'SCRIPT') return true;
    if (element.closest && element.closest('script')) return true;
    
    // Check for React DevTools
    var id = element.id || '';
    if (id.indexOf('__react') !== -1) return true;
    
    return false;
  }
  
  // ========== HELPER: Check if element is contenteditable ==========
  function isContentEditable(element) {
    if (!element) return false;
    return element.isContentEditable || 
           element.getAttribute('contenteditable') === 'true' ||
           element.getAttribute('contenteditable') === '';
  }
  
  // ========== HELPER: Check if element is an SVG clickable ==========
  function isSvgClickable(element) {
    if (!element) return false;
    var tagName = element.tagName.toLowerCase();
    // SVG elements that might be clickable
    if (tagName === 'svg' || tagName === 'path' || tagName === 'circle' || 
        tagName === 'rect' || tagName === 'g' || tagName === 'use') {
      // Check if it has click-related attributes or is inside a button/link
      return element.closest('button, a, [role="button"], [role="link"], [onclick]') ||
             element.hasAttribute('onclick') ||
             element.hasAttribute('tabindex') ||
             element.style.cursor === 'pointer';
    }
    return false;
  }
  
  // ========== HELPER: Find best interactive element including SVG ==========
  function findBestInteractiveElement(element) {
    // If SVG element, find the containing interactive element
    if (isSvgClickable(element)) {
      var interactiveParent = element.closest('button, a, [role="button"], [role="link"]');
      if (interactiveParent) return interactiveParent;
    }
    return element;
  }
  
  // Filter for overlay elements
  function isOverlayElement(element) {
    if (!element || !element.closest) return false;
    return !!(
      element.closest('#flowstral-host') ||
      element.closest('#flowstral-suggestions-host') ||
      element.closest('[data-flowstral-ignore="true"]')
    );
  }
  
  // Find the best interactive element from click path
  function findBestElement(path) {
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!el || !el.tagName) continue;
      
      var tag = el.tagName.toLowerCase();
      
      // Skip document/body/structural elements
      if (tag === 'html' || tag === 'body' || tag === 'slot') continue;
      
      // Skip framework internals
      if (isFrameworkInternal(el)) continue;
      
      // Priority 0: Handle SVG elements - find containing interactive element
      if (isSvgClickable(el)) {
        var svgParent = findBestInteractiveElement(el);
        if (svgParent && svgParent !== el) {
          return svgParent;
        }
        // If no interactive parent, treat SVG as clickable if it has role/aria
        if (el.getAttribute('role') || el.getAttribute('aria-label')) {
          return el;
        }
        continue; // Skip standalone SVG without semantic markup
      }
      
      // Priority 1: Form submit elements
      if (tag === 'input' && (el.type === 'submit' || el.type === 'button')) {
        return el;
      }
      
      // Priority 2: Buttons and links
      if (tag === 'button' || (tag === 'a' && el.href)) {
        return el;
      }
      
      // Priority 3: Elements with explicit roles
      var role = el.getAttribute('role');
      var interactiveRoles = ['button', 'link', 'tab', 'menuitem', 'option', 
                              'checkbox', 'radio', 'switch', 'slider', 'treeitem',
                              'combobox', 'listbox', 'row', 'cell', 'gridcell',
                              'columnheader', 'rowheader', 'img', 'progressbar'];
      if (role && interactiveRoles.indexOf(role) !== -1) {
        return el;
      }
      
      // Priority 4: Input elements (except text inputs - handled by fill)
      if (tag === 'input') {
        var type = (el.type || 'text').toLowerCase();
        if (['text', 'email', 'password', 'search', 'tel', 'url', 'number'].indexOf(type) === -1) {
          return el;
        }
        continue; // Skip text inputs
      }
      
      // Skip textarea (handled by fill)
      if (tag === 'textarea') continue;
      
      // Priority 5: Select elements
      if (tag === 'select' || tag === 'option') {
        return el;
      }
      
      // Priority 6: Contenteditable elements (for rich text editors)
      if (isContentEditable(el)) {
        return el;
      }
      
      // Priority 7: Elements with testId (developers marked it for testing)
      if (el.getAttribute('data-testid') || el.getAttribute('data-test')) {
        return el;
      }
      
      // Priority 8: Elements with aria-label (intentionally labeled)
      if (el.getAttribute('aria-label')) {
        return el;
      }
      
      // Priority 9: Elements with tabindex (intentionally interactive)
      if (el.getAttribute('tabindex') === '0') {
        return el;
      }
      
      // Priority 10: Summary element (for <details>/<summary> accordion)
      if (tag === 'summary') {
        return el;
      }
      
      // Priority 11: Table cells that might be clickable (sorting headers)
      if ((tag === 'th' || tag === 'td') && (el.onclick || el.hasAttribute('onclick') || 
          el.style.cursor === 'pointer' || el.closest('[role="grid"]'))) {
        return el;
      }
    }
    
    // Fallback to first element
    return path[0];
  }
  
  // Record an action
  function recordAction(action) {
    // Use pre-set timestamp if available (e.g. fill actions use typing start time)
    // Otherwise default to now (clicks, selects, etc.)
    if (!action.timestamp) {
      action.timestamp = Date.now();
    }
    
    // Add iframe context if we're inside an iframe
    var frameInfo = getFrameContext();
    if (frameInfo) {
      action.frameContext = frameInfo;
    }
    
    window.__flowstralRecipeActions.push(action);
    console.log('[Flowstral Recipe]', action.type, action.description || '', frameInfo ? '(in iframe: ' + frameInfo.name + ')' : '');
  }
  
  // Detect if we're inside an iframe and get frame identification info
  function getFrameContext() {
    try {
      if (window === window.top) return null; // Main frame
      
      // We're in an iframe - get identifier
      var frameInfo = {
        isIframe: true,
        name: window.name || null,
        src: window.location.href,
        origin: window.location.origin
      };
      
      // Try to identify by frame name or src
      if (window.frameElement) {
        var frame = window.frameElement;
        frameInfo.id = frame.id || null;
        frameInfo.name = frame.name || frameInfo.name;
        frameInfo.testId = frame.getAttribute('data-testid') || null;
        frameInfo.title = frame.getAttribute('title') || null;
        frameInfo.ariaLabel = frame.getAttribute('aria-label') || null;
        frameInfo.className = frame.className || null;
        frameInfo.selector = buildFrameSelector(frame);
        
        // Get frame position among all iframes (0-based index)
        try {
          var iframes = frame.ownerDocument.querySelectorAll('iframe');
          for (var i = 0; i < iframes.length; i++) {
            if (iframes[i] === frame) {
              frameInfo.index = i;
              break;
            }
          }
        } catch (e) {}
      }
      
      return frameInfo;
    } catch (e) {
      // Cross-origin iframe - still detect but with limited info
      return { isIframe: true, crossOrigin: true, src: null };
    }
  }
  
  // Build a selector for the iframe element
  function buildFrameSelector(frame) {
    // Priority 1: ID (most reliable)
    if (frame.id) return '#' + frame.id;
    
    // Priority 2: data-testid
    var testId = frame.getAttribute('data-testid');
    if (testId) return 'iframe[data-testid="' + testId + '"]';
    
    // Priority 3: name attribute
    if (frame.name) return 'iframe[name="' + frame.name + '"]';
    
    // Priority 4: title attribute
    var title = frame.getAttribute('title');
    if (title) return 'iframe[title="' + title + '"]';
    
    // Priority 5: src (if not dynamic)
    var src = frame.src || frame.getAttribute('src');
    if (src && !src.includes('?') && !src.includes('#')) {
      // Use partial match on src path
      var srcPath = src.split('/').pop();
      if (srcPath && srcPath.length > 3) {
        return 'iframe[src*="' + srcPath + '"]';
      }
    }
    
    // Priority 6: Position among iframes (least reliable)
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i] === frame) {
        return 'iframe:nth-of-type(' + (i + 1) + ')';
      }
    }
    return 'iframe';
  }
  
  // Track element handled by pointerdown to prevent duplicate recording
  var lastHandledElement = null;
  var lastHandledTime = 0;
  
  // ========== CLICK HANDLER ==========
  
  // Helper: Check if element is a modal close button
  function isModalCloseButton(element) {
    if (!element) return false;
    
    // Check if element is inside a modal/dialog
    var inModal = element.closest(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"], ' +
      '[data-radix-dialog-content], .modal, .modal-content'
    );
    if (!inModal) return false;
    
    // Check if element is a close button
    var ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    var testId = (element.getAttribute('data-testid') || '').toLowerCase();
    var className = (element.className || '').toLowerCase();
    var innerText = ((element.textContent || element.innerText) || '').trim();
    
    // Check for close indicators
    var isCloseIndicator = 
      ariaLabel.includes('close') || ariaLabel.includes('dismiss') ||
      testId.includes('close') || testId.includes('dismiss') ||
      className.includes('close') || className.includes('dismiss') ||
      element.hasAttribute('data-radix-dialog-close') ||
      element.hasAttribute('data-dismiss') ||
      innerText === '×' || innerText === 'X' || innerText === 'x' ||
      innerText.toLowerCase() === 'close' || innerText.toLowerCase() === 'cancel';
    
    return isCloseIndicator;
  }
  
  // Helper: Check if click is on modal backdrop/overlay
  function isModalBackdrop(element) {
    if (!element) return false;
    
    var className = (element.className || '').toLowerCase();
    var role = element.getAttribute('role');
    
    return (
      element.hasAttribute('data-radix-dialog-overlay') ||
      className.includes('backdrop') ||
      className.includes('overlay') ||
      className.includes('modal-bg') ||
      (role === 'presentation' && className.includes('modal'))
    );
  }
  
  document.addEventListener('click', function(e) {
    try {
      var path = e.composedPath ? e.composedPath() : [e.target];
      var element = findBestElement(path);
      if (!element) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
      // ============================================================
      // SKIP CLICKS that are handled by other specialized actions
      // ============================================================
      var tag = element.tagName.toLowerCase();
      var inputType = (element.type || '').toLowerCase();
      
      // Skip text inputs - Fill action will handle these
      if (tag === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(inputType)) {
        console.log('[Flowstral Recipe] Skip click - text input (Fill will capture)');
        return;
      }
      if (tag === 'textarea') {
        console.log('[Flowstral Recipe] Skip click - textarea (Fill will capture)');
        return;
      }
      
      // Skip checkboxes and radios - change event handler records Check/Uncheck/Select
      if (tag === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
        console.log('[Flowstral Recipe] Skip click - ' + inputType + ' (change handler will capture)');
        return;
      }
      
      // Skip <select> and <option> elements - change event handler records Select action
      if (tag === 'select' || tag === 'option') {
        console.log('[Flowstral Recipe] Skip click - ' + tag + ' (change handler will capture Select)');
        return;
      }
      // Handle labels - but DON'T skip segmented control labels (labels for radio/checkbox in button groups)
      if (tag === 'label') {
        var forId = element.getAttribute('for');
        var linkedInput = forId ? document.getElementById(forId) : element.querySelector('input');
        
        if (linkedInput) {
          var linkedTag = linkedInput.tagName.toLowerCase();
          var linkedType = (linkedInput.type || '').toLowerCase();
          
          // Skip labels for text inputs - clicking focuses the input
          if (linkedTag === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(linkedType)) {
            console.log('[Flowstral Recipe] Skip click - label for text input');
            return;
          }
          if (linkedTag === 'textarea') {
            console.log('[Flowstral Recipe] Skip click - label for textarea');
            return;
          }
          
          // DON'T skip labels for radio/checkbox if they look like segmented controls
          // These are visually styled as buttons and should be recorded as clicks
          if (linkedTag === 'input' && (linkedType === 'radio' || linkedType === 'checkbox')) {
            var isSegmentedControl = element.closest(
              '[role="radiogroup"], [role="group"], .btn-group, .button-group, ' +
              '.segmented-control, .toggle-group, .button-select, fieldset'
            );
            var hasButtonStyle = element.classList && (
              element.classList.contains('btn') ||
              element.classList.contains('button') ||
              element.classList.contains('option') ||
              element.classList.contains('choice')
            );
            
            if (isSegmentedControl || hasButtonStyle) {
              console.log('[Flowstral Recipe] ★ Recording segmented control click (label for ' + linkedType + '):', element.textContent?.trim());
              // Don't return - let this be recorded as a click!
            } else {
              // Regular radio/checkbox label - let the change handler deal with it
              console.log('[Flowstral Recipe] Skip click - label for ' + linkedType + ' (change handler will capture)');
              return;
            }
          }
        }
      }
      
      // Skip if pointerdown already handled this element (within 500ms)
      if (element === lastHandledElement && (Date.now() - lastHandledTime) < 500) {
        console.log('[Flowstral Recipe] Skip click - handled by pointerdown');
        return;
      }
      
      var recipe = analyzer.analyze(element);
      if (!recipe) return;
      
      // Check if this is a modal close button
      if (isModalCloseButton(element)) {
        var modal = element.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-radix-dialog-content], .modal');
        var modalTitle = modal ? (modal.querySelector('[role="heading"], h1, h2, h3, .modal-title')?.textContent?.trim() || 'dialog') : 'dialog';
        
        console.log('[Flowstral Recipe] ★ Modal close button clicked');
        recordAction({
          type: 'closeModal',
          target: recipe,
          modalTitle: modalTitle,
          description: 'Close modal: ' + modalTitle
        });
        return;
      }
      
      // Check if this is a backdrop/overlay click (dismiss modal)
      if (isModalBackdrop(element)) {
        var nearbyModal = document.querySelector('[role="dialog"]:not([hidden]), [role="alertdialog"]:not([hidden]), [aria-modal="true"]');
        var modalTitle = nearbyModal ? (nearbyModal.querySelector('[role="heading"], h1, h2, h3, .modal-title')?.textContent?.trim() || 'dialog') : 'dialog';
        
        console.log('[Flowstral Recipe] ★ Modal backdrop clicked');
        recordAction({
          type: 'closeModal',
          target: recipe,
          modalTitle: modalTitle,
          description: 'Close modal by clicking backdrop: ' + modalTitle
        });
        return;
      }
      
      // ============================================================
      // SKIP CLICKS on modal/dialog HEADERS/TITLES
      // These are not user-intended actions - user clicks modal body and
      // event bubbles to title, or user accidentally clicks on the header.
      // Modal titles are: h1/h2 in dialog, .modal-title, slds-modal__header, etc.
      // ============================================================
      var isModalHeader = (function() {
        // Check if element is inside a dialog/modal
        var parentDialog = element.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .slds-modal, .modal');
        if (!parentDialog) return false;
        
        // Check if this is a heading element OR inside a header container
        var tagLower = tag.toLowerCase();
        var isHeadingElement = (tagLower === 'h1' || tagLower === 'h2' || tagLower === 'h3' || 
                                tagLower === 'h4' || tagLower === 'h5' || tagLower === 'h6');
        var roleValue = element.getAttribute && element.getAttribute('role');
        var isHeadingRole = roleValue === 'heading';
        
        // Check if inside modal header container
        var isInHeaderContainer = !!(
          element.closest('.modal-header, .slds-modal__header, .modal-title, [slot="header"]') ||
          element.closest('[class*="modalHeader"], [class*="modal-header"]') ||
          element.closest('[data-aura-class*="panel2Header"], [class*="panelHeader"]')
        );
        
        // Check for Salesforce specific modal header patterns
        var isSalesforceModalHeader = !!(
          element.closest('.forceModalActionContainer') ||
          element.closest('.uiModal--medium .modal-header, .uiModal--large .modal-header') ||
          element.closest('[class*="actionsContainer"]') ||
          (tagLower === 'span' && element.closest('.slds-modal__title'))
        );
        
        return (isHeadingElement || isHeadingRole || isInHeaderContainer || isSalesforceModalHeader);
      })();
      
      if (isModalHeader) {
        console.log('[Flowstral Recipe] Skip click - modal header/title (not user action):', recipe.what?.text || tag);
        return;
      }
      
      // Debug: Check if this is a dropdown trigger
      var isTrigger = coalescer.isDropdownTrigger(element);
      var role = element.getAttribute && element.getAttribute('role');
      console.log('[Flowstral Recipe] CLICK:', element.tagName, 'role=' + role, 
        'isTrigger=' + isTrigger, 'pendingTrigger=' + !!coalescer.pendingTrigger);
      
      // Process through coalescer (handles dropdown trigger + option → select)
      coalescer.processClick(element, recipe, function(action) {
        console.log('[Flowstral Recipe] → Recording:', action.type, action.description);
        recordAction(action);
      });
      
    } catch (err) {
      console.error('[Flowstral Recipe] Click capture error:', err);
    }
  }, true);
  
  // ========== DOUBLE-CLICK HANDLER ==========
  // Records double-click actions (useful for editing in place, selecting words, etc.)
  
  document.addEventListener('dblclick', function(e) {
    try {
      var path = e.composedPath ? e.composedPath() : [e.target];
      var element = findBestElement(path);
      if (!element) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
      var recipe = analyzer.analyze(element);
      if (!recipe) return;
      
      console.log('[Flowstral Recipe] ★ DOUBLE-CLICK:', element.tagName, recipe.what.text || recipe.where.nearText);
      
      recordAction({
        type: 'dblclick',
        target: recipe,
        description: 'Double-click "' + (recipe.what.text || recipe.where.nearText || element.tagName) + '"'
      });
      
    } catch (err) {
      console.error('[Flowstral Recipe] Double-click capture error:', err);
    }
  }, true);
  
  // ========== RIGHT-CLICK (CONTEXT MENU) HANDLER ==========
  // Records right-click actions for context menu operations
  
  document.addEventListener('contextmenu', function(e) {
    try {
      var path = e.composedPath ? e.composedPath() : [e.target];
      var element = findBestElement(path);
      if (!element) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
      var recipe = analyzer.analyze(element);
      if (!recipe) return;
      
      console.log('[Flowstral Recipe] ★ RIGHT-CLICK:', element.tagName, recipe.what.text || recipe.where.nearText);
      
      recordAction({
        type: 'rightClick',
        target: recipe,
        description: 'Right-click "' + (recipe.what.text || recipe.where.nearText || element.tagName) + '"'
      });
      
    } catch (err) {
      console.error('[Flowstral Recipe] Right-click capture error:', err);
    }
  }, true);
  
  // ========== POINTERDOWN HANDLER (for custom dropdowns like Radix) ==========
  // Radix uses pointerdown for BOTH triggers and options, not click!
  
  document.addEventListener('pointerdown', function(e) {
    try {
      var path = e.composedPath ? e.composedPath() : [e.target];
      var element = findBestElement(path);
      if (!element) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
      // Skip text input pointerdown - Fill will handle these
      var tag = element.tagName.toLowerCase();
      var inputType = (element.type || '').toLowerCase();
      if (tag === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(inputType)) {
        return;
      }
      if (tag === 'textarea') return;
      
      var role = element.getAttribute && element.getAttribute('role');
      var isTrigger = coalescer.isDropdownTrigger(element);
      var isOption = coalescer.isDropdownOption(element);
      var isInDropdownContent = (
        element.closest('[data-radix-select-content]') ||
        element.closest('[data-radix-popper-content-wrapper]') ||
        element.closest('[role="listbox"]') ||
        element.closest('[role="menu"]')
      );
      
      console.log('[Flowstral Recipe] POINTERDOWN:', element.tagName, 'role=' + role,
        'isTrigger=' + isTrigger, 'isOption=' + isOption, 'inContent=' + !!isInDropdownContent, 
        'pendingTrigger=' + !!coalescer.pendingTrigger);
      
      // If this is a dropdown TRIGGER, set pendingTrigger (Radix uses pointerdown, not click)
      if (isTrigger && !coalescer.pendingTrigger) {
        console.log('[Flowstral Recipe] ★ Setting pendingTrigger from pointerdown');
        var recipe = analyzer.analyze(element);
        if (recipe) {
          coalescer.processClick(element, recipe, function(action) {
            // This will set pendingTrigger and wait for option
            console.log('[Flowstral Recipe] Trigger processed, waiting for option...');
          });
        }
        // Mark as handled to prevent click from re-processing
        lastHandledElement = element;
        lastHandledTime = Date.now();
        return;
      }
      
      // If this is an option and we have a pending trigger, record select
      if (coalescer.pendingTrigger && (isOption || isInDropdownContent)) {
        console.log('[Flowstral Recipe] ★ Processing option via pointerdown!');
        lastHandledElement = element;
        lastHandledTime = Date.now();
        
        var recipe = analyzer.analyze(element);
        if (recipe) {
          coalescer.processClick(element, recipe, function(action) {
            console.log('[Flowstral Recipe] → Recording SELECT:', action.type, action.description);
            recordAction(action);
          });
        }
      }
    } catch (err) {
      console.error('[Flowstral Recipe] Pointerdown error:', err);
    }
  }, true);
  
  // ========== HOVER HANDLER (for flyout/dropdown menus) ==========
  // CRITICAL: Many navigation menus open on hover, not click
  // Without recording hover, these menus never open during playback
  //
  // SMART FILTERING: Only record hovers that REVEAL hidden content.
  // Skip hovers that are:
  //   - Right after a click on the same/parent element (click already opened it)
  //   - Incidental mouse-overs while navigating to a click target
  //   - On list items, picklist options, table rows (browsing, not activating)
  
  var lastHoverElement = null;
  var lastHoverTime = 0;
  var hoverTimeout = null;
  var lastClickElement = null;
  var lastClickTime = 0;
  
  // Track clicks so we can suppress redundant hovers after clicks
  document.addEventListener('click', function(e) {
    lastClickElement = e.target;
    lastClickTime = Date.now();
  }, true);
  
  document.addEventListener('mouseenter', function(e) {
    try {
      var element = e.target;
      if (!element || !element.tagName) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
      var tag = element.tagName.toLowerCase();
      
      // ── SKIP: list items, picklist options, table rows, dropdown items ──
      // These are "browsing" hovers, not "reveal content" hovers
      var role = element.getAttribute('role') || '';
      var isListBrowsing = (
        tag === 'li' || tag === 'tr' || tag === 'td' || tag === 'option' ||
        role === 'option' || role === 'listitem' || role === 'row' ||
        role === 'menuitem' || role === 'treeitem' ||
        (element.className || '').match(/slds-listbox|slds-dropdown|combobox-item|lookup|picklist|list-item/i)
      );
      if (isListBrowsing) return;
      
      // ── SKIP: hover right after clicking the same or parent element ──
      // If user clicked to open a menu, the hover is redundant
      if (lastClickElement && (Date.now() - lastClickTime) < 2000) {
        var clickedSameOrParent = (
          element === lastClickElement ||
          element.contains(lastClickElement) ||
          (lastClickElement.contains && lastClickElement.contains(element))
        );
        if (clickedSameOrParent) return;
      }
      
      // Only record hovers on elements that REVEAL hidden content
      // Must have explicit flyout/popup indicators
      var hasPopup = element.hasAttribute('aria-haspopup');
      var hasExpanded = element.getAttribute('aria-expanded') === 'false'; // Only when collapsed
      var isFlyoutTrigger = (
        (element.className || '').match(/flyout|dropdown|menu-trigger|submenu|has-children/i) ||
        (element.id || '').match(/navItem|menuTrigger/i) ||
        element.closest('[class*="flyout"], [class*="has-submenu"], [class*="has-children"]')
      );
      
      // Skip if not a genuine hover-to-reveal element
      if (!hasPopup && !hasExpanded && !isFlyoutTrigger) {
        return;
      }
      
      // Debounce - don't record multiple hovers on same element within 2s
      if (element === lastHoverElement && (Date.now() - lastHoverTime) < 2000) {
        return;
      }
      
      // Use a delay to avoid recording incidental hovers (just passing over)
      // Only record if mouse stays on element for 300ms (up from 200ms)
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(function() {
        // Verify mouse is still over this element
        var currentHover = document.elementFromPoint(
          e.clientX || 0,
          e.clientY || 0
        );
        if (!currentHover || !element.contains(currentHover)) {
          return; // Mouse moved away
        }
        
        // Double-check: if a click happened while we were waiting, skip
        if (lastClickElement && (Date.now() - lastClickTime) < 500) {
          return;
        }
        
        var recipe = analyzer.analyze(element);
        if (!recipe) return;
        
        lastHoverElement = element;
        lastHoverTime = Date.now();
        
        console.log('[Flowstral Recipe] ★ HOVER:', element.tagName, recipe.what.text || recipe.where.nearText);
        
        recordAction({
          type: 'hover',
          target: recipe,
          description: 'Hover over "' + (recipe.what.text || recipe.where.nearText || element.tagName) + '"'
        });
      }, 300);
      
    } catch (err) {
      console.error('[Flowstral Recipe] Hover capture error:', err);
    }
  }, true);
  
  // ========== INPUT HANDLER ==========
  
  var pendingInput = null;
  var inputTimeout = null;
  
  function flushPendingInput() {
    if (!pendingInput) return;
    clearTimeout(inputTimeout);
    
    var el = pendingInput.element;
    var value = pendingInput.value || el.value;
    var recipe = pendingInput.recipe;
    
    if (value) {
      var isPassword = (el.type || '').toLowerCase() === 'password';
      
      // Get the best field label - prioritize nearText (label), then ariaLabel, then placeholder
      // CRITICAL: DO NOT use recipe.what.text for inputs since getVisibleText now excludes value
      var fieldLabel = recipe.where.nearText || 
                       recipe.which.ariaLabel || 
                       recipe.which.placeholder ||
                       recipe.which.name ||
                       recipe.what.text ||  // Now safe since we fixed getVisibleText for inputs
                       'input';
      
      // Safety check: if fieldLabel looks like an email/value, use 'input' instead
      if (fieldLabel.includes('@') || fieldLabel.length > 40) {
        fieldLabel = recipe.which.placeholder || recipe.which.name || 'input';
      }
      
      var displayValue = isPassword ? '********' : value.substring(0, 20);
      
      recordAction({
        type: 'fill',
        target: recipe,
        // CRITICAL: Store actual password value - needed for playback!
        // Display is masked but value must be preserved for automation
        value: value,
        displayValue: isPassword ? '********' : value,
        isPassword: isPassword,
        fieldLabel: fieldLabel,  // Store for later use
        description: 'Fill "' + fieldLabel + '": "' + displayValue + '"',
        // Use the time when user STARTED typing, not when debounce fires.
        // Without this, fills would get timestamps 1500ms too late,
        // appearing after clicks that chronologically happened later.
        timestamp: pendingInput.startedAt || Date.now()
      });
    }
    
    pendingInput = null;
  }
  
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
    
    var type = (el.type || '').toLowerCase();
    if (['checkbox', 'radio', 'submit', 'button', 'file', 'hidden'].indexOf(type) !== -1) return;
    
    // Analyze element for recipe
    var recipe = analyzer.analyze(el);
    
    if (pendingInput && pendingInput.element === el) {
      pendingInput.value = el.value;
      pendingInput.recipe = recipe;
      clearTimeout(inputTimeout);
    } else {
      flushPendingInput();
      pendingInput = { element: el, value: el.value, recipe: recipe, startedAt: Date.now() };
    }
    
    inputTimeout = setTimeout(flushPendingInput, 1500);
  }, true);
  
  document.addEventListener('blur', function(e) {
    if (pendingInput && pendingInput.element === e.target) {
      pendingInput.value = e.target.value;
      flushPendingInput();
    }
  }, true);
  
  // ========== CHANGE HANDLER (for native selects, checkboxes) ==========
  
  document.addEventListener('change', function(e) {
    flushPendingInput();
    var el = e.target;
    if (!el) return;
    
    var recipe = analyzer.analyze(el);
    
    if (el.tagName === 'SELECT') {
      var selectedOption = el.options[el.selectedIndex];
      recordAction({
        type: 'select',
        target: recipe,
        value: {
          text: selectedOption ? selectedOption.text : el.value,
          dataValue: el.value
        },
        description: 'Select "' + (selectedOption ? selectedOption.text : el.value) + '" from "' + 
                     (recipe.where.nearText || recipe.what.text || 'dropdown') + '"'
      });
    } else if (el.type === 'checkbox') {
      recordAction({
        type: el.checked ? 'check' : 'uncheck',
        target: recipe,
        description: (el.checked ? 'Check' : 'Uncheck') + ' "' + 
                     (recipe.where.nearText || recipe.what.text || 'checkbox') + '"'
      });
    } else if (el.type === 'radio') {
      recordAction({
        type: 'click',
        target: recipe,
        description: 'Select radio "' + (recipe.what.text || recipe.where.nearText || 'option') + '"'
      });
    }
  }, true);
  
  // ========== KEYBOARD HANDLER (for Enter key submissions and Escape to close modals) ==========
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      flushPendingInput();
      
      // Check if this is in a form
      var el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        var form = el.closest('form');
        if (form) {
          var recipe = analyzer.analyze(el);
          recordAction({
            type: 'press',
            target: recipe,
            value: 'Enter',
            description: 'Press Enter'
          });
        }
      }
    }
    
    // Escape key - used to close modals, dialogs, dropdowns
    if (e.key === 'Escape') {
      // Check if there's an open modal/dialog
      var openModal = document.querySelector(
        '[role="dialog"]:not([hidden]), ' +
        '[role="alertdialog"]:not([hidden]), ' +
        '[data-radix-dialog-content], ' +
        '[data-state="open"][role="dialog"], ' +
        '.modal.show, .modal[open], ' +
        '[aria-modal="true"]'
      );
      
      if (openModal) {
        var modalTitle = openModal.querySelector('[role="heading"], h1, h2, h3, .modal-title')?.textContent?.trim() || 'dialog';
        recordAction({
          type: 'press',
          target: { what: { role: 'dialog', text: modalTitle } },
          value: 'Escape',
          description: 'Press Escape to close ' + modalTitle
        });
      }
    }
  }, true);
  
  // ========== FILE UPLOAD HANDLER ==========
  
  document.addEventListener('change', function(e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;
    
    if (el.files && el.files.length > 0) {
      var recipe = analyzer.analyze(el);
      var fileNames = [];
      for (var i = 0; i < el.files.length; i++) {
        fileNames.push(el.files[i].name);
      }
      
      recordAction({
        type: 'upload',
        target: recipe,
        value: {
          files: fileNames,
          multiple: el.multiple
        },
        description: 'Upload file' + (fileNames.length > 1 ? 's' : '') + ': ' + fileNames.join(', ')
      });
    }
  }, true);
  
  // ========== DRAG AND DROP HANDLER ==========
  
  var dragState = null;
  
  document.addEventListener('dragstart', function(e) {
    var el = e.target;
    if (!el) return;
    
    dragState = {
      element: el,
      recipe: analyzer.analyze(el),
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now()
    };
    
    console.log('[Flowstral Recipe] Drag started:', dragState.recipe?.what?.text || el.tagName);
  }, true);
  
  document.addEventListener('drop', function(e) {
    if (!dragState) return;
    
    var dropTarget = e.target;
    var dropRecipe = analyzer.analyze(dropTarget);
    
    recordAction({
      type: 'dragDrop',
      target: dragState.recipe,
      dropTarget: dropRecipe,
      value: {
        startX: dragState.startX,
        startY: dragState.startY,
        endX: e.clientX,
        endY: e.clientY
      },
      description: 'Drag "' + (dragState.recipe?.what?.text || 'item') + '" to "' + 
                   (dropRecipe?.what?.text || dropRecipe?.where?.nearText || 'drop zone') + '"'
    });
    
    dragState = null;
  }, true);
  
  document.addEventListener('dragend', function(e) {
    // Clear drag state if no drop happened
    if (dragState && (Date.now() - dragState.startTime) > 100) {
      console.log('[Flowstral Recipe] Drag cancelled (no valid drop)');
    }
    dragState = null;
  }, true);
  
  // ========== SCROLL RECORDING DISABLED ==========
  // Scroll events are NOT recorded as separate steps because:
  // 1. Playwright automatically handles scrollIntoViewIfNeeded() before clicks
  // 2. Manual scroll steps clutter the test case
  // 3. Exact scroll amounts are not reliably reproducible across environments
  // 4. The user is scrolling to GET TO an element, then clicking it - 
  //    the click is the actual intent, not the scroll
  //
  // If infinite scroll / lazy loading is needed, it should be handled
  // by a dedicated "waitForContent" or "scrollToLoadMore" action.
  // ================================================
  
  // Expose flush function
  window.__flowstralFlushRecipeInput = flushPendingInput;
  
  console.log('[Flowstral] Recipe Recorder v2.2 loaded (scroll recording disabled - handled by Playwright)');
})();
`;
}

// ============================================================================
// CONVERSION UTILITIES
// ============================================================================

/**
 * Convert a recipe action to the legacy action format
 * This allows the new recorder to work with existing test builder
 */
function recipeActionToLegacy(recipeAction) {
  const { type, target, value, description, timestamp, frameContext, dropTarget, modalTitle, direction } = recipeAction;
  
  // Convert recipe to legacy selectorObj
  const selectorObj = recipeToLegacySelector(target);
  
  // CRITICAL: Extract element text for args array (for playback compatibility)
  const elementText = target?.what?.text || '';
  
  // Extract position for duplicate element disambiguation
  const position = target?.which?.position;
  const totalMatching = target?.which?.totalMatching;
  
  // Build args array with text and optional element index
  const args = elementText ? [elementText] : [];
  if (position && totalMatching && totalMatching > 1) {
    // Position is 1-based, elementIndex for CDP is 0-based
    args.push(position - 1); // Convert to 0-based index
  }
  
  return {
    type: type,
    qword: getQWord(type, target, recipeAction),
    description: description,
    timestamp: timestamp,
    // CRITICAL: Add args array for playback compatibility with CDP-recorded actions
    args: args,
    // Legacy fields
    text: elementText,
    label: target?.where?.nearText || elementText,
    selector: selectorObj.selector,
    selectorObj: selectorObj,
    // New recipe field
    recipe: target,
    // CRITICAL FIX: Preserve landmark and region for scoped element finding
    // Without these, SmartFinder can find elements in wrong page regions
    landmark: target?.where?.landmark || null,
    region: target?.where?.region || null,
    // Preserve within (container role like tablist, menu, listbox)
    within: target?.where?.within || null,
    // Scroll-specific fields
    direction: direction || null,
    // Value for fill/select (handle complex values for new types)
    value: typeof value === 'object' ? (value.text || value.files || value) : value,
    displayValue: typeof value === 'object' ? (value.text || value.files?.join(', ') || JSON.stringify(value)) : value,
    // Element info - comprehensive for fallback finding
    element: {
      tagName: target?.what?.tag || '',
      type: target?.what?.type || '',          // Input type
      id: target?.which?.id || '',
      name: target?.which?.name || '',
      text: target?.what?.text || '',
      role: target?.what?.role || '',
      testId: target?.which?.testId || '',
      ariaLabel: target?.which?.ariaLabel || '',
      placeholder: target?.which?.placeholder || '',
      href: target?.confirm?.href || '',        // For links
      title: target?.which?.title || '',        // Title attribute
      // Position for disambiguation
      position: position || null,
      totalMatching: totalMatching || null,
      // Also preserve landmark in element for redundancy
      landmark: target?.where?.landmark || '',
      within: target?.where?.within || '',
    },
    // Frame context for iframe support
    frameContext: frameContext || null,
    // Drag-drop target
    dropTarget: dropTarget || null,
    // Modal title for close actions
    modalTitle: modalTitle || null,
    // Bounding box for coordinate fallback
    boundingBox: target?.confirm?.boundingBox || null,
    // Element index for multiple matches (0-based)
    elementIndex: position ? position - 1 : null,
    totalMatching: totalMatching || null,
  };
}

/**
 * Get QWord (action keyword) from action type
 */
function getQWord(type, target, action = {}) {
  switch (type) {
    case 'click':
      return target?.what?.text ? 'ClickText' : 'ClickElement';
    case 'dblclick':
    case 'doubleClick':
      return 'DoubleClick';
    case 'rightClick':
    case 'contextmenu':
      return 'RightClick';
    case 'fill':
      return 'Fill';
    case 'select':
      return 'Select';
    case 'check':
      return 'Check';
    case 'uncheck':
      return 'Uncheck';
    case 'upload':
      return 'Upload';
    case 'dragDrop':
      return 'DragDrop';
    case 'dialog':
      return 'HandleDialog';
    case 'switchToFrame':
    case 'frame':
      return 'SwitchFrame';
    case 'switchToMainFrame':
    case 'mainFrame':
      return 'MainFrame';
    case 'newTab':
      return 'NewTab';
    case 'download':
      return 'Download';
    case 'press':
      return 'Press';
    case 'navigate':
      return 'GoTo';
    case 'hover':
      return 'Hover';
    case 'closeModal':
      return 'CloseModal';
    case 'scroll':
      // Include direction in QWord for better UI display
      const direction = action.direction || 'down';
      return `Scroll${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
    case 'focus':
      return 'Focus';
    case 'blur':
      return 'Blur';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Extract element text from description like 'Click "Tables"' → 'Tables'
 */
function extractTextFromLabel(label) {
  if (!label) return null;
  
  // Match patterns like: Click "Tables", Select "Option" from "Dropdown"
  const quoteMatch = label.match(/["']([^"']+)["']/);
  if (quoteMatch) {
    return quoteMatch[1];
  }
  
  // If no quotes, try to extract after common prefixes
  const prefixPatterns = [
    /^Click\s+(.+)$/i,
    /^Fill\s+(.+)$/i,
    /^Select\s+(.+)$/i,
  ];
  
  for (const pattern of prefixPatterns) {
    const match = label.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Convert legacy action to recipe format
 * This allows existing tests to work with new finder
 */
function legacyActionToRecipe(legacyAction) {
  // If already has recipe, return it (but merge with legacy fields for robustness)
  if (legacyAction.recipe) {
    // Merge any additional fields from legacy action that might be missing
    const recipe = { ...legacyAction.recipe };
    
    // Ensure position is preserved
    if (!recipe.which?.position && legacyAction.elementIndex !== undefined) {
      recipe.which = recipe.which || {};
      recipe.which.position = legacyAction.elementIndex + 1;
    }
    
    // Ensure landmark is preserved
    if (!recipe.where?.landmark && legacyAction.landmark) {
      recipe.where = recipe.where || {};
      recipe.where.landmark = legacyAction.landmark;
    }
    
    // Ensure within is preserved
    if (!recipe.where?.within && legacyAction.within) {
      recipe.where = recipe.where || {};
      recipe.where.within = legacyAction.within;
    }
    
    return recipe;
  }
  
  // Build recipe from legacy fields
  const selectorObj = legacyAction.selectorObj || legacyAction.selector || {};
  const element = legacyAction.element || {};
  
  // CRITICAL FIX: elementIndex can be in multiple places:
  // 1. action.elementIndex (direct property)
  // 2. action.args[1] (for ClickText actions)
  // 3. action.selectorObj?.elementIndex
  // 4. action.element?.position (recipe-converted)
  let elementIndex = null;
  if (typeof legacyAction.elementIndex === 'number') {
    elementIndex = legacyAction.elementIndex;
  } else if (typeof legacyAction.args?.[1] === 'number') {
    elementIndex = legacyAction.args[1];
  } else if (typeof selectorObj.elementIndex === 'number') {
    elementIndex = selectorObj.elementIndex;
  } else if (typeof element.position === 'number') {
    elementIndex = element.position - 1; // Convert 1-based to 0-based
  }
  
  // CRITICAL: Normalize text for consistent matching
  // Handles apostrophe variants (', ', etc.), quote variants, and whitespace
  const normalizeText = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'") // Apostrophe variants
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')              // Quote variants
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  // Extract actual element text - try multiple sources
  // Priority: explicit text > element.text > extracted from label > label itself
  let elementText = legacyAction.text || element.text || selectorObj.text;
  if (!elementText && legacyAction.label) {
    // Try to extract text from descriptions like 'Click "Tables"'
    elementText = extractTextFromLabel(legacyAction.label) || legacyAction.label;
  }
  
  // Normalize the text for consistent playback matching
  elementText = normalizeText(elementText);
  
  // CRITICAL FIX: Infer role from action type if not explicitly set
  // This ensures SmartFinder can use role+text strategies
  let inferredRole = element.role || selectorObj.role;
  if (!inferredRole && legacyAction.type) {
    const actionType = legacyAction.type.toLowerCase();
    if (actionType.includes('click')) {
      // For click actions, try to infer role from tag or context
      // NOTE: Recording stores tagName (capital N), also check tag for compatibility
      const tag = (element.tagName || selectorObj.tagName || selectorObj.tag || '').toLowerCase();
      console.log(`[legacyActionToRecipe] Inferred tag: "${tag}" from element.tagName=${element.tagName}, selectorObj.tagName=${selectorObj.tagName}, selectorObj.tag=${selectorObj.tag}`);
      if (tag === 'a') inferredRole = 'link';
      else if (tag === 'button') inferredRole = 'button';
      else if (tag === 'input' && element.type === 'submit') inferredRole = 'button';
      else if (tag === 'summary') inferredRole = 'button';
      else if (tag === 'th') inferredRole = 'columnheader';
      // If text looks like a link (has "go to", URL-like), assume link
      else if (elementText && /^(go to|navigate|visit|open|view)/i.test(elementText)) {
        inferredRole = 'link';
      }
      // Default to null - let SmartFinder try multiple roles
      else if (!inferredRole) inferredRole = null;
    } else if (actionType.includes('fill') || actionType.includes('type')) {
      inferredRole = 'textbox';
    } else if (actionType.includes('check')) {
      inferredRole = 'checkbox';
    } else if (actionType.includes('select')) {
      inferredRole = 'combobox';
    } else if (actionType.includes('dblclick') || actionType.includes('doubleclick')) {
      // Double-click often on text or editable elements
      inferredRole = null;
    } else if (actionType.includes('rightclick') || actionType.includes('contextmenu')) {
      // Right-click can be on any element
      inferredRole = null;
    } else if (actionType.includes('hover')) {
      // Hover often on buttons with menus
      inferredRole = 'button';
    }
  }
  
  // Extract landmark/within from multiple sources
  const landmark = legacyAction.landmark || element.landmark || null;
  const within = legacyAction.within || element.within || null;
  
  return {
    what: {
      role: inferredRole || null,
      text: elementText || '',
      tag: element.tagName || selectorObj.tagName || selectorObj.tag || null,
      type: element.type || selectorObj.type || null, // Input type
    },
    where: {
      landmark: landmark,
      within: within,
      nearText: element.ariaLabel || selectorObj.ariaLabel || elementText || null,
    },
    which: {
      testId: element.testId || selectorObj.testId || selectorObj.dataTestId || null,
      id: element.id || selectorObj.id || null,
      name: element.name || selectorObj.name || null,
      ariaLabel: element.ariaLabel || selectorObj.ariaLabel || null,
      placeholder: element.placeholder || selectorObj.placeholder || null,
      title: element.title || selectorObj.title || null,
      // Position is 1-based (elementIndex 0 → position 1)
      position: elementIndex !== null ? elementIndex + 1 : null,
      totalMatching: legacyAction.totalMatching || element.totalMatching || null,
    },
    confirm: {
      cssSelector: typeof selectorObj === 'string' ? selectorObj : selectorObj.selector,
      boundingBox: legacyAction.boundingBox || null,
      href: element.href || selectorObj.href || null,
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getRecipeClickCaptureScript,
  recipeActionToLegacy,
  legacyActionToRecipe,
  getQWord,
};
