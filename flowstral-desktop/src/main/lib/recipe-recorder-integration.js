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
                              'checkbox', 'radio', 'switch', 'slider', 'treeitem'];
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
    window.__flowstralRecipeActions.push(action);
    console.log('[Flowstral Recipe]', action.type, action.description || '');
  }
  
  // ========== CLICK HANDLER ==========
  
  document.addEventListener('click', function(e) {
    try {
      // Get composed path for Shadow DOM support
      var path = e.composedPath ? e.composedPath() : [e.target];
      
      // Find best element
      var element = findBestElement(path);
      if (!element) return;
      
      // Skip overlay
      if (isOverlayElement(element)) return;
      
      // Skip framework internals
      if (isFrameworkInternal(element)) return;
      
      // Debug: Log what we're capturing
      var role = element.getAttribute && element.getAttribute('role');
      var text = (element.innerText || element.textContent || '').trim().substring(0, 50);
      console.log('[Flowstral Recipe] Click on:', element.tagName, 
        role ? 'role=' + role : '', 
        text ? '"' + text + '"' : '');
      
      // Check if this is a dropdown option (for debugging)
      var isOption = coalescer.isDropdownOption(element);
      var isTrigger = coalescer.isDropdownTrigger(element);
      console.log('[Flowstral Recipe] isOption:', isOption, 'isTrigger:', isTrigger, 
        'hasPending:', !!coalescer.pendingTrigger);
      
      // Analyze the element
      var recipe = analyzer.analyze(element);
      if (!recipe) {
        console.log('[Flowstral Recipe] No recipe generated for element');
        return;
      }
      
      // Process through coalescer (handles dropdowns)
      coalescer.processClick(element, recipe, function(action) {
        recordAction(action);
      });
      
    } catch (err) {
      console.error('[Flowstral Recipe] Click capture error:', err);
    }
  }, true); // Use capture phase
  
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
  
  // ========== KEYBOARD HANDLER (for Enter key submissions) ==========
  
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
  const { type, target, value, description, timestamp } = recipeAction;
  
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
    // Value for fill/select
    value: typeof value === 'object' ? value.text : value,
    displayValue: typeof value === 'object' ? value.text : value,
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
    }
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
    case 'press':
      return 'Press';
    case 'navigate':
      return 'GoTo';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
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
  
  return {
    what: {
      role: element.role || selectorObj.role || null,
      text: legacyAction.text || element.text || selectorObj.text || '',
      tag: element.tagName || selectorObj.tag || null,
    },
    where: {
      nearText: legacyAction.label || selectorObj.ariaLabel || null,
    },
    which: {
      testId: element.testId || selectorObj.testId || selectorObj.dataTestId || null,
      id: element.id || selectorObj.id || null,
      name: element.name || selectorObj.name || null,
      ariaLabel: element.ariaLabel || selectorObj.ariaLabel || null,
      placeholder: element.placeholder || selectorObj.placeholder || null,
      position: legacyAction.elementIndex ? legacyAction.elementIndex + 1 : null,
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
