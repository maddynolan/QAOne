/**
 * Action Converter - Converts raw recorded actions to QWord format
 * 
 * QWord format is Flowstral's standard action representation.
 */

/**
 * Convert a raw action to QWord format
 * @param {Object} action - Raw action from recorder
 * @returns {Object} QWord formatted action
 */
function toQWord(action) {
  const element = action.element || {};
  const selectors = element.selectors || [];
  const bestSelector = [...selectors].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  const textSelector = selectors.find(s => s.type === 'text');

  switch (action.type) {
    case 'navigate':
      return {
        qword: 'GoTo',
        args: [action.url],
        description: `Navigate to ${action.url}`
      };
    
    case 'click':
    case 'submit':
      // Prefer text-based clicks for readability
      if (textSelector && textSelector.value && textSelector.value.length < 50) {
        return {
          qword: 'ClickText',
          args: [textSelector.value],
          selector: bestSelector,
          description: `Click "${textSelector.value}"`
        };
      }
      // Fall back to element click
      return {
        qword: 'ClickElement',
        args: [bestSelector?.value || element.tagName || 'element'],
        selector: bestSelector,
        description: `Click ${element.tagName || 'element'}`
      };
    
    case 'fill':
    case 'input':
      const label = element.placeholder || element.name || element.id || 
                    element.ariaLabel || 'input';
      const displayVal = action.isPassword ? '********' : (action.displayValue || action.value);
      return {
        qword: 'Fill',
        args: [label, action.value || ''],
        displayArgs: [label, displayVal],
        isPassword: action.isPassword,
        selector: bestSelector,
        description: `Type "${displayVal}" into ${label}`
      };
    
    case 'select':
      const selectLabel = element.name || element.id || 'dropdown';
      return {
        qword: 'Select',
        args: [selectLabel, action.value],
        selector: bestSelector,
        description: `Select "${action.value}" from ${selectLabel}`
      };
    
    case 'check':
      const checkLabel = element.name || element.id || element.ariaLabel || 'checkbox';
      return {
        qword: 'Check',
        args: [checkLabel],
        selector: bestSelector,
        description: `Check "${checkLabel}"`
      };
    
    case 'uncheck':
      const uncheckLabel = element.name || element.id || element.ariaLabel || 'checkbox';
      return {
        qword: 'Uncheck',
        args: [uncheckLabel],
        selector: bestSelector,
        description: `Uncheck "${uncheckLabel}"`
      };
    
    case 'assert':
      const assertText = element.text || element.value || 'text';
      return {
        qword: 'AssertText',
        args: [assertText],
        selector: bestSelector,
        description: `Assert text "${assertText}"`
      };
    
    default:
      return {
        qword: 'ClickElement',
        args: [bestSelector?.value || element.tagName || 'element'],
        selector: bestSelector,
        description: `Click ${element.tagName || 'element'}`
      };
  }
}

/**
 * Build selector object with fallbacks
 * @param {Object} action - Action with element info
 * @returns {Object} Selector object for Test Builder
 */
function buildSelectorObject(action) {
  const element = action.element || {};
  const selectors = element.selectors || [];
  
  // Sort by confidence
  const sorted = [...selectors].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  
  // Find CSS selectors (not text-based)
  const cssSelectors = sorted.filter(s => 
    s.selector && (s.selector.startsWith('[') || s.selector.startsWith('#') || s.selector.startsWith('.'))
  );
  
  const primary = cssSelectors[0] || sorted[0] || { selector: null, playwright: null };
  const textSelector = sorted.find(s => s.type === 'text');
  
  // PRIORITY ORDER for selectors (enterprise-grade approach):
  // 1. data-testid (most stable - explicitly added for testing)
  // 2. name attribute (stable - used by forms)
  // 3. id attribute (stable if not dynamic)
  // 4. aria-label (stable - accessibility)
  
  let bestSelector = primary.selector || null;
  if (element.testId || element.dataTestId) {
    bestSelector = `[data-testid="${element.testId || element.dataTestId}"]`;
  } else if (element.name && !bestSelector) {
    bestSelector = `[name="${element.name}"]`;
  } else if (element.id && !bestSelector) {
    bestSelector = `#${element.id}`;
  }
  
  return {
    primary: primary,
    // CSS selector - PRIORITIZE stable attributes
    selector: bestSelector,
    playwright: primary.playwright || null,
    confidence: primary.confidence || 0,
    type: primary.type || 'unknown',
    text: textSelector?.value || element.text || '',
    // CRITICAL: Include ALL element attributes for robust playback
    testId: element.testId || element.dataTestId || '',       // HIGHEST PRIORITY
    dataTestId: element.dataTestId || element.testId || '',   // Alias
    name: element.name || '',                                  // HIGH PRIORITY
    id: element.id || '',
    placeholder: element.placeholder || '',
    ariaLabel: element.ariaLabel || '',
    title: element.title || '',
    role: element.role || '',
    href: element.href || '',
    fallbacks: sorted.slice(1)
      .filter(s => s.playwright)
      .map(s => ({ 
        selector: s.selector,
        playwright: s.playwright,
        type: s.type,
        confidence: s.confidence 
      })),
    strategies: sorted.map(s => ({ 
      type: s.type, 
      selector: s.selector, 
      playwright: s.playwright, 
      confidence: s.confidence 
    })),
    app: action.app || 'generic'
  };
}

/**
 * Map QWord to step type for Test Builder
 * @param {string} qword - QWord action type
 * @returns {string} Step type
 */
function mapQWordToStepType(qword) {
  const mapping = {
    'GoTo': 'navigate',
    'ClickText': 'click',
    'ClickElement': 'click',
    'Fill': 'fill',
    'Select': 'select',
    'Check': 'check',
    'Uncheck': 'uncheck',
    'AssertText': 'assert',
    'Wait': 'wait',
    'Hover': 'hover',
    'Screenshot': 'screenshot'
  };
  return mapping[qword] || 'action';
}

module.exports = {
  toQWord,
  buildSelectorObject,
  mapQWordToStepType
};

