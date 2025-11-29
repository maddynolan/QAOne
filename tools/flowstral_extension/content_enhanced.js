// Flowstral Extension - Enhanced Content Script
// Phase 1.2: Semantic Action Labeling + Phase 1.3: Privacy Guards

// Privacy Guard: PII Detection Patterns
const PII_PATTERNS = {
  password: /password|pwd|passwd/i,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/
};

// Semantic Action Types
const SEMANTIC_ACTIONS = {
  LOGIN: ['login', 'sign in', 'signin', 'authenticate', 'auth'],
  LOGOUT: ['logout', 'sign out', 'signout'],
  SEARCH: ['search', 'find', 'query', 'lookup'],
  ADD_TO_CART: ['add to cart', 'add cart', 'buy now', 'purchase'],
  CHECKOUT: ['checkout', 'place order', 'complete purchase', 'pay'],
  SUBMIT_FORM: ['submit', 'save', 'send', 'post'],
  NAVIGATE: ['navigate', 'go to', 'visit', 'open'],
  FILTER: ['filter', 'sort', 'refine'],
  SELECT: ['select', 'choose', 'pick']
};

// Mask sensitive values
function maskSensitiveValue(value, fieldName = '') {
  if (!value || typeof value !== 'string') return value;
  
  // Check field name patterns
  const fieldLower = fieldName.toLowerCase();
  if (PII_PATTERNS.password.test(fieldLower)) {
    return '***MASKED***';
  }
  
  // Check value patterns
  if (PII_PATTERNS.creditCard.test(value)) {
    return value.replace(/\d(?=\d{4})/g, '*');
  }
  if (PII_PATTERNS.ssn.test(value)) {
    return '***-**-****';
  }
  if (PII_PATTERNS.email.test(value) && fieldLower.includes('email')) {
    const [local, domain] = value.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }
  
  return value;
}

// Detect semantic action type
function detectSemanticAction(element, eventType) {
  const text = (element.textContent || '').toLowerCase().trim();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const title = (element.getAttribute('title') || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const className = (element.className || '').toLowerCase();
  const name = (element.name || '').toLowerCase();
  
  const searchText = `${text} ${ariaLabel} ${title} ${id} ${className} ${name}`;
  
  // Check each semantic action
  for (const [actionType, keywords] of Object.entries(SEMANTIC_ACTIONS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return actionType;
      }
    }
  }
  
  // Fallback based on element type and context
  if (eventType === 'click') {
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      if (element.type === 'submit' || element.closest('form')) {
        return 'SUBMIT_FORM';
      }
      return 'CLICK_BUTTON';
    }
  }
  
  if (eventType === 'input' || eventType === 'change') {
    if (element.tagName === 'INPUT') {
      if (element.type === 'search') return 'SEARCH';
      if (element.type === 'email') return 'FILL_EMAIL';
      if (element.type === 'password') return 'FILL_PASSWORD';
      return 'FILL_INPUT';
    }
    if (element.tagName === 'SELECT') return 'SELECT_OPTION';
  }
  
  return eventType.toUpperCase();
}

// Extract accessibility tree summary
function extractAccessibilityTree(element) {
  const a11y = {
    role: element.getAttribute('role') || element.tagName.toLowerCase(),
    ariaLabel: element.getAttribute('aria-label') || null,
    ariaLabelledBy: element.getAttribute('aria-labelledby') || null,
    ariaDescribedBy: element.getAttribute('aria-describedby') || null,
    ariaLive: element.getAttribute('aria-live') || null,
    ariaHidden: element.getAttribute('aria-hidden') === 'true',
    hasLabel: !!element.labels || !!element.closest('label'),
    alt: element.getAttribute('alt') || null,
    title: element.getAttribute('title') || null
  };
  
  // Check for missing accessibility attributes
  const issues = [];
  if (element.tagName === 'BUTTON' && !a11y.ariaLabel && !a11y.ariaLabelledBy && !element.textContent.trim()) {
    issues.push('Button lacks accessible name');
  }
  if (element.tagName === 'IMG' && !a11y.alt && !a11y.ariaHidden) {
    issues.push('Image missing alt text');
  }
  if (element.tagName === 'INPUT' && element.type !== 'hidden' && !a11y.hasLabel && !a11y.ariaLabel) {
    issues.push('Input lacks label');
  }
  
  return {
    ...a11y,
    issues: issues.length > 0 ? issues : null
  };
}

// Detect component framework
function detectComponentFramework(element) {
  // Check for React
  if (element.__reactInternalInstance || element.__reactFiber) {
    return 'React';
  }
  
  // Check for Vue
  if (element.__vue__) {
    return 'Vue';
  }
  
  // Check for Angular
  if (element.ngVersion || element.getAttribute('ng-version')) {
    return 'Angular';
  }
  
  // Check parent components
  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    if (parent.__reactInternalInstance || parent.__reactFiber) return 'React';
    if (parent.__vue__) return 'Vue';
    if (parent.ngVersion) return 'Angular';
    parent = parent.parentElement;
    depth++;
  }
  
  return null;
}

// Extract component hierarchy
function extractComponentHierarchy(element) {
  const hierarchy = [];
  let current = element;
  let depth = 0;
  
  while (current && current !== document.body && depth < 10) {
    const info = {
      tag: current.tagName.toLowerCase(),
      id: current.id || null,
      class: current.className || null,
      dataTestId: current.getAttribute('data-testid') || null,
      role: current.getAttribute('role') || null
    };
    
    // Try to detect component name
    const framework = detectComponentFramework(current);
    if (framework) {
      info.framework = framework;
    }
    
    hierarchy.unshift(info);
    current = current.parentElement;
    depth++;
  }
  
  return hierarchy;
}

// Enhanced selector generation with priority
function generateEnhancedSelector(element) {
  const selectors = {
    dataTestId: null,
    ariaLabel: null,
    id: null,
    name: null,
    role: null,
    text: null,
    css: null,
    xpath: null
  };
  
  // Priority 1: data-testid
  if (element.getAttribute('data-testid')) {
    selectors.dataTestId = `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  
  // Priority 2: ARIA label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    selectors.ariaLabel = `[aria-label="${ariaLabel}"]`;
  }
  
  // Priority 3: ID
  if (element.id) {
    selectors.id = `#${element.id}`;
  }
  
  // Priority 4: Name
  if (element.name) {
    selectors.name = `[name="${element.name}"]`;
  }
  
  // Priority 5: Role
  const role = element.getAttribute('role');
  if (role) {
    selectors.role = `[role="${role}"]`;
  }
  
  // Priority 6: Text content (fallback)
  const text = element.textContent?.trim();
  if (text && text.length < 50) {
    selectors.text = `:has-text("${text}")`;
  }
  
  // Priority 7: CSS selector (fallback)
  if (element.id) {
    selectors.css = `#${element.id}`;
  } else if (element.className) {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      selectors.css = `.${classes}`;
    }
  }
  
  return selectors;
}

// Enhanced click handler with semantic labeling
function handleClickEnhanced(event) {
  if (!isRecording) return;
  
  const element = event.target;
  const selector = generateSelector(element); // Keep existing function
  const enhancedSelectors = generateEnhancedSelector(element);
  const semanticAction = detectSemanticAction(element, 'click');
  const a11yTree = extractAccessibilityTree(element);
  const componentHierarchy = extractComponentHierarchy(element);
  const framework = detectComponentFramework(element);
  
  const eventData = {
    html: document.documentElement.outerHTML.substring(0, 50000),
    url: window.location.href,
    interacted_element: {
      tag_name: element.tagName,
      id: element.id,
      class_name: element.className,
      text_content: element.textContent?.substring(0, 100),
      selector: selector,
      enhanced_selectors: enhancedSelectors,
      x: event.clientX,
      y: event.clientY,
      accessibility: a11yTree,
      component_hierarchy: componentHierarchy,
      framework: framework
    },
    semantic_action: semanticAction,
    action_description: `${semanticAction}: ${element.tagName}${element.id ? '#' + element.id : ''}${element.textContent ? ' - ' + element.textContent.substring(0, 50) : ''}`,
    page_metrics: capturePerformanceMetrics()
  };
  
  captureEvent('click', eventData);
}

// Enhanced input handler with privacy guards
function handleInputEnhanced(event) {
  if (!isRecording) return;
  
  const element = event.target;
  const selector = generateSelector(element);
  const enhancedSelectors = generateEnhancedSelector(element);
  const semanticAction = detectSemanticAction(element, 'input');
  const a11yTree = extractAccessibilityTree(element);
  
  // Privacy guard: mask sensitive values
  const rawValue = element.value || '';
  const fieldName = element.name || element.id || element.getAttribute('aria-label') || '';
  const maskedValue = maskSensitiveValue(rawValue, fieldName);
  const isMasked = maskedValue !== rawValue;
  
  const eventData = {
    html: document.documentElement.outerHTML.substring(0, 50000),
    url: window.location.href,
    interacted_element: {
      tag_name: element.tagName,
      id: element.id,
      class_name: element.className,
      type: element.type,
      name: element.name,
      placeholder: element.placeholder,
      selector: selector,
      enhanced_selectors: enhancedSelectors,
      accessibility: a11yTree
    },
    semantic_action: semanticAction,
    action_description: `${semanticAction}: ${element.tagName}${element.id ? '#' + element.id : ''}${element.name ? '[' + element.name + ']' : ''}`,
    value: maskedValue,
    value_length: rawValue.length,
    is_masked: isMasked,
    field_type: element.type || 'text',
    page_metrics: capturePerformanceMetrics()
  };
  
  captureEvent('input', eventData);
}

// Export functions to be used in main content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    maskSensitiveValue,
    detectSemanticAction,
    extractAccessibilityTree,
    extractComponentHierarchy,
    generateEnhancedSelector,
    detectComponentFramework,
    handleClickEnhanced,
    handleInputEnhanced
  };
}



