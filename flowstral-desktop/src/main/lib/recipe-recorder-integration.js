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
                              'combobox', 'listbox'];  // Added for Radix Select support
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
      
      // Priority 6: Elements with testId (developers marked it for testing)
      if (el.getAttribute('data-testid') || el.getAttribute('data-test')) {
        return el;
      }
      
      // Priority 7: Elements with aria-label (intentionally labeled)
      if (el.getAttribute('aria-label')) {
        return el;
      }
      
      // Priority 8: Elements with tabindex (intentionally interactive)
      if (el.getAttribute('tabindex') === '0') {
        return el;
      }
    }
    
    // Fallback to first element
    return path[0];
  }
  
  // Record an action
  function recordAction(action) {
    action.timestamp = Date.now();
    
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
        src: window.location.href
      };
      
      // Try to identify by frame name or src
      if (window.frameElement) {
        var frame = window.frameElement;
        frameInfo.id = frame.id || null;
        frameInfo.name = frame.name || frameInfo.name;
        frameInfo.testId = frame.getAttribute('data-testid') || null;
        frameInfo.selector = buildFrameSelector(frame);
      }
      
      return frameInfo;
    } catch (e) {
      // Cross-origin iframe - still detect but with limited info
      return { isIframe: true, crossOrigin: true, src: null };
    }
  }
  
  // Build a selector for the iframe element
  function buildFrameSelector(frame) {
    if (frame.id) return '#' + frame.id;
    if (frame.name) return 'iframe[name="' + frame.name + '"]';
    var testId = frame.getAttribute('data-testid');
    if (testId) return '[data-testid="' + testId + '"]';
    
    // Count position among iframes
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
  
  // ========== POINTERDOWN HANDLER (for custom dropdowns like Radix) ==========
  // Radix uses pointerdown for BOTH triggers and options, not click!
  
  document.addEventListener('pointerdown', function(e) {
    try {
      var path = e.composedPath ? e.composedPath() : [e.target];
      var element = findBestElement(path);
      if (!element) return;
      if (isOverlayElement(element)) return;
      if (isFrameworkInternal(element)) return;
      
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
      recordAction({
        type: 'fill',
        target: recipe,
        value: isPassword ? '' : value,
        displayValue: isPassword ? '********' : value,
        isPassword: isPassword,
        description: 'Fill "' + (recipe.what.text || recipe.where.nearText || 'input') + '"' + 
                     (isPassword ? '' : ' with "' + value.substring(0, 20) + '"')
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
      pendingInput = { element: el, value: el.value, recipe: recipe };
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
  
  // Expose flush function
  window.__flowstralFlushRecipeInput = flushPendingInput;
  
  console.log('[Flowstral] Recipe Recorder v2 loaded');
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
  const { type, target, value, description, timestamp, frameContext, dropTarget } = recipeAction;
  
  // Convert recipe to legacy selectorObj
  const selectorObj = recipeToLegacySelector(target);
  
  return {
    type: type,
    qword: getQWord(type, target),
    description: description,
    timestamp: timestamp,
    // Legacy fields
    text: target?.what?.text || '',
    label: target?.where?.nearText || target?.what?.text || '',
    selector: selectorObj.selector,
    selectorObj: selectorObj,
    // New recipe field
    recipe: target,
    // Value for fill/select (handle complex values for new types)
    value: typeof value === 'object' ? (value.text || value.files || value) : value,
    displayValue: typeof value === 'object' ? (value.text || value.files?.join(', ') || JSON.stringify(value)) : value,
    // Element info
    element: {
      tagName: target?.what?.tag || '',
      id: target?.which?.id || '',
      name: target?.which?.name || '',
      text: target?.what?.text || '',
      role: target?.what?.role || '',
      testId: target?.which?.testId || '',
      ariaLabel: target?.which?.ariaLabel || '',
      placeholder: target?.which?.placeholder || '',
    },
    // Frame context for iframe support
    frameContext: frameContext || null,
    // Drag-drop target
    dropTarget: dropTarget || null
  };
}

/**
 * Get QWord (action keyword) from action type
 */
function getQWord(type, target) {
  switch (type) {
    case 'click':
      return target?.what?.text ? 'ClickText' : 'ClickElement';
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
  // If already has recipe, return it
  if (legacyAction.recipe) {
    return legacyAction.recipe;
  }
  
  // Build recipe from legacy fields
  const selectorObj = legacyAction.selectorObj || legacyAction.selector || {};
  const element = legacyAction.element || {};
  
  // CRITICAL FIX: elementIndex can be in multiple places:
  // 1. action.elementIndex (direct property)
  // 2. action.args[1] (for ClickText actions)
  // 3. action.selectorObj?.elementIndex
  let elementIndex = null;
  if (typeof legacyAction.elementIndex === 'number') {
    elementIndex = legacyAction.elementIndex;
  } else if (typeof legacyAction.args?.[1] === 'number') {
    elementIndex = legacyAction.args[1];
  } else if (typeof selectorObj.elementIndex === 'number') {
    elementIndex = selectorObj.elementIndex;
  }
  
  // Extract actual element text - try multiple sources
  // Priority: explicit text > element.text > extracted from label > label itself
  let elementText = legacyAction.text || element.text || selectorObj.text;
  if (!elementText && legacyAction.label) {
    // Try to extract text from descriptions like 'Click "Tables"'
    elementText = extractTextFromLabel(legacyAction.label) || legacyAction.label;
  }
  
  return {
    what: {
      role: element.role || selectorObj.role || null,
      text: elementText || '',
      tag: element.tagName || selectorObj.tag || null,
    },
    where: {
      nearText: elementText || selectorObj.ariaLabel || null,
    },
    which: {
      testId: element.testId || selectorObj.testId || selectorObj.dataTestId || null,
      id: element.id || selectorObj.id || null,
      name: element.name || selectorObj.name || null,
      ariaLabel: element.ariaLabel || selectorObj.ariaLabel || null,
      placeholder: element.placeholder || selectorObj.placeholder || null,
      // Position is 1-based (elementIndex 0 → position 1)
      position: elementIndex !== null ? elementIndex + 1 : null,
    },
    confirm: {
      cssSelector: typeof selectorObj === 'string' ? selectorObj : selectorObj.selector,
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
