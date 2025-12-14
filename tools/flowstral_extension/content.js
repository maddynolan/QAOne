// Flowstral Extension - Content Script
// Injected into every page to capture user interactions

console.log('Flowstral Content: Script loaded on', window.location.href);

let isRecording = false;
let currentSessionId = null;
let eventBuffer = [];

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Flowstral Content: Received message', message.type, message);
  
  // Handle async responses properly
  const handleAsync = async () => {
    try {
      switch (message.type) {
        case 'FLOWSTRAL_START_RECORDING':
          startRecording(message.sessionId);
          sendResponse({ success: true, message: 'Recording started' });
          break;
          
        case 'FLOWSTRAL_STOP_RECORDING':
          await stopRecording();
          sendResponse({ success: true, message: 'Recording stopped' });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Flowstral Content: Message handler error', error);
      sendResponse({ success: false, error: error.message });
    }
  };
  
  // Execute async handler
  handleAsync();
  
  return true; // Keep channel open for async response
});

// Start recording
function startRecording(sessionId) {
  if (!sessionId) {
    console.error('Flowstral Content: No session ID provided');
    return;
  }
  
  // If already recording with a different session ID, update it
  if (isRecording && currentSessionId !== sessionId) {
    console.log(`Flowstral Content: Updating session ID from ${currentSessionId} to ${sessionId}`);
    currentSessionId = sessionId;
    // Don't return - continue to ensure recording is properly initialized
  } else if (isRecording) {
    console.log('Flowstral Content: Already recording with same session ID');
    return;
  }
  
  currentSessionId = sessionId;
  isRecording = true;
  eventBuffer = [];
  
  console.log('Flowstral Content: Starting recording', sessionId);
  console.log('Flowstral Content: Current URL', window.location.href);
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeRecording();
    });
  } else {
    initializeRecording();
  }
}

// Initialize recording after page is ready
function initializeRecording() {
  // Show visual indicator
  showRecordingIndicator();
  
  // Capture initial page state
  captureInitialState();
  
  // Attach event listeners
  console.log('Flowstral Content: Attaching event listeners...');
  attachEventListeners();
  console.log('Flowstral Content: Event listeners attached successfully');
  
  // NOTE: Periodic WCAG and performance scans are DISABLED
  // They create too many nodes in the action graph and slow down recording
  // Use standalone accessibility and performance tools instead for comprehensive testing
  // startPeriodicScans(); // DISABLED - use standalone tools
  
  console.log('Flowstral Content: Recording initialized and active!');
  console.log('Flowstral Content: isRecording =', isRecording);
  console.log('Flowstral Content: currentSessionId =', currentSessionId);
  console.log('Flowstral Content: You should see a green "Flowstral Recording..." indicator in the top-right corner');
}

// Stop recording
async function stopRecording() {
  if (!isRecording) {
    console.log('Flowstral Content: Not recording, nothing to stop');
    return;
  }
  
  console.log('Flowstral Content: Stopping recording - flushing events first...');
  
  // CRITICAL: Flush any buffered events BEFORE stopping
  await flushEventBuffer();
  
  // Wait a moment for events to be sent
  await new Promise(resolve => setTimeout(resolve, 500));
  
  isRecording = false;
  currentSessionId = null;
  console.log('Flowstral Content: Recording stopped');
  
  // Hide visual indicator
  hideRecordingIndicator();
  
  // Remove event listeners
  removeEventListeners();
}

// Capture screenshot using Chrome tabs API (via background script)
async function captureScreenshot() {
  try {
    // Send message to background script to capture visible tab
    const response = await chrome.runtime.sendMessage({
      type: 'FLOWSTRAL_CAPTURE_SCREENSHOT'
    });
    
    if (response && response.success && response.screenshot) {
      return response.screenshot; // Base64 data URL
    }
    
    console.warn('Flowstral Content: Screenshot capture failed or not available');
    return null;
  } catch (error) {
    console.error('Flowstral Content: Screenshot capture error', error);
    return null;
  }
}

// Capture initial page state
async function captureInitialState() {
  // Capture screenshot for initial page load
  const screenshot = await captureScreenshot();
  
  const eventData = {
    html: document.documentElement.outerHTML.substring(0, 50000),
    url: window.location.href,
    interacted_element: null,
    action_description: `Page load: ${window.location.href}`,
    page_metrics: capturePerformanceMetrics(),
    wcag_snapshot: null, // Will be captured by periodic scan
    screenshot: screenshot // Add screenshot
  };
  
  captureEvent('page_load', eventData);
}

// Attach event listeners
function attachEventListeners() {
  console.log('Flowstral Content: attachEventListeners called');
  
  // Click events
  document.addEventListener('click', handleClick, true);
  console.log('Flowstral Content: Click listener attached');
  
  // Input events (with debouncing to avoid too many events)
  let inputTimeout;
  const inputElements = new WeakSet(); // Track which inputs we've seen
  
  document.addEventListener('input', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      inputElements.add(event.target); // Mark this element as having input
      // Debounce input events - only capture after user stops typing for 300ms (reduced from 500ms)
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        handleInput(event);
      }, 300);
    }
  }, true);
  
  // CRITICAL: Capture on blur (when user leaves the field) - this is the most reliable
  // This ensures we capture the final value even if debounce didn't fire
  document.addEventListener('blur', (event) => {
    if ((event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') && inputElements.has(event.target)) {
      // Clear any pending input timeout for this element
      clearTimeout(inputTimeout);
      // Small delay to ensure value is updated
      setTimeout(() => {
        handleInput(event);
        inputElements.delete(event.target); // Clean up
      }, 50);
    }
  }, true);
  
  document.addEventListener('change', handleChange, true);
  
  // Navigation events
  window.addEventListener('popstate', handleNavigation);
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    handleNavigation();
  };
  
  // Scroll events (throttled) - only from active tabs
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    // Only capture scroll from active/visible tabs
    if (document.hidden) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      captureEvent('scroll', {
        url: window.location.href,
        scrollY: window.scrollY,
        scrollX: window.scrollX
      });
    }, 500);
  }, { passive: true });
  
  // Listen for tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('Flowstral Content: Tab became hidden - pausing event capture');
    } else {
      console.log('Flowstral Content: Tab became visible - resuming event capture');
    }
  });
  
  // Network events (via Performance API)
  observeNetworkRequests();
}

// Remove event listeners
function removeEventListeners() {
  document.removeEventListener('click', handleClick, true);
  // Note: We can't remove the debounced input listener easily, but that's okay
  // since isRecording will prevent capture anyway
  document.removeEventListener('change', handleChange, true);
  window.removeEventListener('popstate', handleNavigation);
}

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
  
  const fieldLower = fieldName.toLowerCase();
  if (PII_PATTERNS.password.test(fieldLower)) {
    return '***MASKED***';
  }
  
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
  
  for (const [actionType, keywords] of Object.entries(SEMANTIC_ACTIONS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return actionType;
      }
    }
  }
  
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
  // CRITICAL: Only use actual ARIA role attribute, never fallback to tag name
  // Tag names like "input", "button", "div" are NOT valid ARIA roles
  const roleAttr = element.getAttribute('role');
  // Map common input types to their proper ARIA roles
  let role = roleAttr;
  if (!roleAttr && element.tagName === 'INPUT') {
    const inputType = element.type || 'text';
    const roleMap = {
      'text': 'textbox',
      'email': 'textbox',
      'password': 'textbox',
      'search': 'searchbox',
      'number': 'spinbutton',
      'tel': 'textbox',
      'url': 'textbox',
      'button': 'button',
      'submit': 'button',
      'reset': 'button',
      'checkbox': 'checkbox',
      'radio': 'radio'
    };
    role = roleMap[inputType] || null; // null if no valid mapping
  } else if (!roleAttr && element.tagName === 'BUTTON') {
    role = 'button';
  } else if (!roleAttr) {
    // For other elements, only use role if explicitly set
    role = null;
  }
  
  const a11y = {
    role: role, // Only valid ARIA roles, never tag names
    ariaLabel: element.getAttribute('aria-label') || null,
    ariaLabelledBy: element.getAttribute('aria-labelledby') || null,
    ariaDescribedBy: element.getAttribute('aria-describedby') || null,
    ariaLive: element.getAttribute('aria-live') || null,
    ariaHidden: element.getAttribute('aria-hidden') === 'true',
    hasLabel: !!element.labels || !!element.closest('label'),
    alt: element.getAttribute('alt') || null,
    title: element.getAttribute('title') || null
  };
  
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
  if (element.__reactInternalInstance || element.__reactFiber) return 'React';
  if (element.__vue__) return 'Vue';
  if (element.ngVersion || element.getAttribute('ng-version')) return 'Angular';
  
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
    hierarchy.unshift({
      tag: current.tagName.toLowerCase(),
      id: current.id || null,
      class: current.className || null,
      dataTestId: current.getAttribute('data-testid') || null,
      role: current.getAttribute('role') || null
    });
    current = current.parentElement;
    depth++;
  }
  
  return hierarchy;
}

// Enhanced selector generation
function generateEnhancedSelector(element) {
  const selectors = {};
  
  if (element.getAttribute('data-testid')) {
    selectors.dataTestId = `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  if (element.getAttribute('aria-label')) {
    selectors.ariaLabel = `[aria-label="${element.getAttribute('aria-label')}"]`;
  }
  if (element.id) {
    selectors.id = `#${element.id}`;
  }
  if (element.name) {
    selectors.name = `[name="${element.name}"]`;
  }
  if (element.getAttribute('role')) {
    selectors.role = `[role="${element.getAttribute('role')}"]`;
  }
  
  return selectors;
}

// Handle click events (enhanced with semantic labeling)
async function handleClick(event) {
  console.log('Flowstral Content: handleClick called, isRecording =', isRecording, 'currentSessionId =', currentSessionId);
  
  if (!isRecording) {
    console.log('Flowstral Content: Click ignored - not recording');
    return;
  }
  
  if (!currentSessionId) {
    console.log('Flowstral Content: Click ignored - no session ID');
    return;
  }
  
  // Only capture events from active/visible tabs
  if (document.hidden) {
    console.log('Flowstral Content: Click ignored - tab is not active/visible');
    return;
  }
  
  const element = event.target;
  const selector = generateSelector(element);
  const enhancedSelectors = generateEnhancedSelector(element);
  const semanticAction = detectSemanticAction(element, 'click');
  const a11yTree = extractAccessibilityTree(element);
  const componentHierarchy = extractComponentHierarchy(element);
  const framework = detectComponentFramework(element);
  
  console.log('Flowstral Content: Click detected', semanticAction, element.tagName, selector);
  
  // Capture screenshot for major actions (submit, navigation, important buttons)
  let screenshot = null;
  if (semanticAction === 'SUBMIT_FORM' || semanticAction === 'CHECKOUT' || 
      semanticAction === 'LOGIN' || semanticAction === 'ADD_TO_CART' ||
      element.tagName === 'BUTTON' || element.tagName === 'A') {
    screenshot = await captureScreenshot();
  }
  
  // CRITICAL FIX: Get actual visible text for radio/checkbox inputs
  // The text is usually in a parent <label> or sibling element, not in the input itself
  let actualText = element.textContent?.substring(0, 100) || '';
  
  // For radio/checkbox inputs, try to get text from associated label
  if ((element.tagName === 'INPUT' && (element.type === 'radio' || element.type === 'checkbox')) || 
      (element.tagName === 'INPUT' && !actualText)) {
    // Try parent label
    let parent = element.parentElement;
    if (parent && parent.tagName === 'LABEL') {
      actualText = parent.textContent?.trim() || '';
      // Remove the input's own text if it's duplicated
      if (actualText && element.textContent) {
        actualText = actualText.replace(element.textContent, '').trim();
      }
    } else {
      // Try aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement) {
          actualText = labelElement.textContent?.trim() || '';
        }
      }
      // Try aria-label
      if (!actualText) {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          actualText = ariaLabel.trim();
        }
      }
      // Try next sibling (common pattern: <input><span>Text</span>)
      if (!actualText && element.nextElementSibling) {
        actualText = element.nextElementSibling.textContent?.trim() || '';
      }
      // Try previous sibling (common pattern: <span>Text</span><input>)
      if (!actualText && element.previousElementSibling) {
        actualText = element.previousElementSibling.textContent?.trim() || '';
      }
    }
  }
  
  // For other inputs, use value or placeholder
  if (element.tagName === 'INPUT' && element.type !== 'radio' && element.type !== 'checkbox') {
    actualText = element.value || element.placeholder || actualText;
  }
  
  const eventData = {
    html: document.documentElement.outerHTML.substring(0, 50000),
    url: window.location.href,
    interacted_element: {
      tag_name: element.tagName,
      id: element.id,
      class_name: element.className,
      text_content: actualText.substring(0, 100),
      selector: selector,
      enhanced_selectors: enhancedSelectors,
      x: event.clientX,
      y: event.clientY,
      accessibility: a11yTree,
      component_hierarchy: componentHierarchy,
      framework: framework
    },
    semantic_action: semanticAction,
    action_description: `${semanticAction}: ${element.tagName}${element.id ? '#' + element.id : ''}${actualText ? ' - ' + actualText.substring(0, 50) : ''}`,
    page_metrics: capturePerformanceMetrics(),
    screenshot: screenshot // Add screenshot for major actions
  };
  
  captureEvent('click', eventData);
}

// Handle input events (enhanced with privacy guards)
function handleInput(event) {
  if (!isRecording) {
    console.log('Flowstral Content: Input ignored - not recording');
    return;
  }
  
  if (!currentSessionId) {
    console.log('Flowstral Content: Input ignored - no session ID');
    return;
  }
  
  // Only capture events from active/visible tabs
  if (document.hidden) {
    console.log('Flowstral Content: Input ignored - tab is not active/visible');
    return;
  }
  
  const element = event.target;
  
  // Only capture input/textarea elements
  if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
    return;
  }
  
  console.log('Flowstral Content: Capturing input event', {
    tag: element.tagName,
    type: element.type,
    id: element.id,
    name: element.name,
    valueLength: (element.value || '').length,
    hasValue: !!(element.value && element.value.trim()),
    value: element.type === 'password' ? '***MASKED***' : (element.value || '').substring(0, 20)
  });
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

// Handle change events (select, checkbox, etc.)
function handleChange(event) {
  if (!isRecording) return;
  
  // Only capture events from active/visible tabs
  if (document.hidden) {
    console.log('Flowstral Content: Change ignored - tab is not active/visible');
    return;
  }
  
  const element = event.target;
  const selector = generateSelector(element);
  
  const eventData = {
    html: document.documentElement.outerHTML.substring(0, 50000),
    url: window.location.href,
    interacted_element: {
      tag_name: element.tagName,
      id: element.id,
      class_name: element.className,
      text_content: element.textContent?.substring(0, 100),
      selector: selector
    },
    action_description: `Change: ${element.tagName}${element.id ? '#' + element.id : ''}`,
    value: element.value || (element.checked ? 'checked' : 'unchecked'),
    page_metrics: capturePerformanceMetrics()
  };
  
  captureEvent('change', eventData);
}

// Handle navigation
async function handleNavigation() {
  if (!isRecording) return;
  
  // Only capture navigation from active/visible tabs
  if (document.hidden) {
    console.log('Flowstral Content: Navigation ignored - tab is not active/visible');
    return;
  }
  
  setTimeout(async () => {
    // Capture screenshot after navigation (page has loaded)
    const screenshot = await captureScreenshot();
    
    const eventData = {
      html: document.documentElement.outerHTML.substring(0, 50000),
      url: window.location.href,
      interacted_element: null,
      action_description: `Navigate to: ${window.location.href}`,
      page_metrics: capturePerformanceMetrics(),
      screenshot: screenshot // Add screenshot for navigation
    };
    
    captureEvent('navigate', eventData);
    
    // Re-attach listeners after navigation (SPA)
    if (isRecording) {
      attachEventListeners();
    }
  }, 500);
}

// Generate CSS selector for element
function generateSelector(element) {
  if (!element) return 'unknown';
  
  // Prefer ID
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Prefer data-testid
  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`;
  }
  
  // Prefer name
  if (element.name) {
    return `[name="${element.name}"]`;
  }
  
  // Use class names
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  
  // Fallback to tag name
  return element.tagName.toLowerCase();
}

// Capture performance metrics (Web Vitals)
function capturePerformanceMetrics() {
  try {
    const navTiming = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const paintEntries = performance.getEntriesByType('paint');
    
    // Get Web Vitals
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0;
    const fp = paintEntries.find(e => e.name === 'first-paint')?.startTime || 0;
    
    // Calculate TTFB (Time to First Byte)
    const ttfb = navTiming ? (navTiming.responseStart - navTiming.requestStart) : 0;
    
    // Calculate DOM Content Loaded
    const domContentLoaded = navTiming ? (navTiming.domContentLoadedEventEnd - navTiming.navigationStart) : 0;
    
    // Calculate Load Time
    const loadTime = navTiming ? (navTiming.loadEventEnd - navTiming.navigationStart) : 0;
    
    // Get LCP (Largest Contentful Paint) - approximate from resources
    let lcp = 0;
    if (window.PerformanceObserver) {
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries && lcpEntries.length > 0) {
          lcp = lcpEntries[lcpEntries.length - 1].renderTime || lcpEntries[lcpEntries.length - 1].loadTime || 0;
        }
      } catch (e) {
        // LCP not available, use FCP as approximation
        lcp = fcp;
      }
    }
    
    // Calculate CLS (Cumulative Layout Shift) - approximate
    let cls = 0;
    if (window.PerformanceObserver) {
      try {
        const clsEntries = performance.getEntriesByType('layout-shift');
        if (clsEntries && clsEntries.length > 0) {
          cls = clsEntries.reduce((sum, entry) => sum + (entry.value || 0), 0);
        }
      } catch (e) {
        // CLS not available
      }
    }
    
    return {
      ttfb: Math.round(ttfb),
      domContentLoaded: Math.round(domContentLoaded),
      fcp: Math.round(fcp),
      lcp: Math.round(lcp),
      cls: Math.round(cls * 100) / 100, // Round to 2 decimals
      loadTime: Math.round(loadTime),
      first_paint: Math.round(fp),
      resource_count: resources.length,
      total_transfer_size: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
    };
  } catch (e) {
    console.warn('Flowstral: Failed to capture performance metrics', e);
    return {
      ttfb: 0,
      domContentLoaded: 0,
      fcp: 0,
      lcp: 0,
      cls: 0,
      loadTime: 0
    };
  }
}

// Observe network requests
function observeNetworkRequests() {
  // Use Performance API to track network requests
  const observer = new PerformanceObserver((list) => {
    if (!isRecording) return;
    
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource' && entry.name.includes('/api/')) {
        captureEvent('api_request', {
          url: entry.name,
          duration: entry.duration,
          transfer_size: entry.transferSize,
          response_status: entry.responseStatus || null
        });
      }
    }
  });
  
  try {
    observer.observe({ entryTypes: ['resource'] });
  } catch (e) {
    console.warn('Flowstral: PerformanceObserver not supported', e);
  }
}

// Start periodic WCAG and performance scans
function startPeriodicScans() {
  // Run WCAG scan every 5 seconds
  setInterval(() => {
    if (isRecording) {
      runWCAGScan();
    }
  }, 5000);
  
  // Initial scan
  setTimeout(runWCAGScan, 2000);
}

// Run WCAG accessibility scan using axe-core
// Note: axe-core CDN loading is blocked by CSP, so we use basic checks
async function runWCAGScan() {
  if (!isRecording) return;
  
  try {
    // Try to use axe-core if already loaded (from background script injection)
    if (window.axe && typeof window.axe.run === 'function') {
      window.axe.run().then(results => {
        captureEvent('wcag_scan', {
          url: window.location.href,
          violations: results.violations || [],
          passes: results.passes || [],
          incomplete: results.incomplete || [],
          total: (results.violations || []).length
        });
      }).catch(err => {
        console.warn('Flowstral: axe-core scan error', err);
        // Fallback to basic check
        captureEvent('wcag_scan', {
          url: window.location.href,
          violations: performBasicA11yCheck(),
          total: performBasicA11yCheck().length
        });
      });
    } else {
      // Use basic accessibility check (CSP blocks CDN loading)
      // In production, axe-core should be injected via chrome.scripting.executeScript
      const violations = performBasicA11yCheck();
      captureEvent('wcag_scan', {
        url: window.location.href,
        violations: violations,
        passes: [],
        incomplete: [],
        total: violations.length,
        note: 'Using basic accessibility check (axe-core not available due to CSP)'
      });
    }
  } catch (e) {
    console.warn('Flowstral: WCAG scan failed', e);
    // Fallback: send basic accessibility check
    captureEvent('wcag_scan', {
      url: window.location.href,
      violations: performBasicA11yCheck(),
      total: performBasicA11yCheck().length
    });
  }
}

// Basic accessibility check fallback (if axe-core fails to load)
function performBasicA11yCheck() {
  const violations = [];
  
  // Check for images without alt
  document.querySelectorAll('img:not([alt])').forEach(img => {
    violations.push({
      id: 'image-alt',
      impact: 'critical',
      description: 'Image missing alt attribute',
      nodes: [{ html: img.outerHTML }]
    });
  });
  
  // Check for buttons without accessible names
  document.querySelectorAll('button').forEach(btn => {
    const hasText = btn.textContent.trim().length > 0;
    const hasAriaLabel = btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby');
    if (!hasText && !hasAriaLabel) {
      violations.push({
        id: 'button-name',
        impact: 'serious',
        description: 'Button missing accessible name',
        nodes: [{ html: btn.outerHTML }]
      });
    }
  });
  
  return violations;
}

// Capture event and send to background
function captureEvent(eventType, eventData) {
  if (!isRecording || !currentSessionId) {
    console.log('Flowstral Content: Not recording, skipping event', eventType);
    return;
  }
  
  const event = {
    session_id: currentSessionId,
    event_type: eventType,
    event_data: eventData,
    timestamp: Date.now()
  };
  
  console.log('Flowstral Content: Capturing event', eventType, eventData.action_description || '');
  
  // Add to buffer
  eventBuffer.push(event);
  
  // Send to background script (which forwards to API)
  console.log('Flowstral Content: Sending event to background script', eventType, event.session_id);
  chrome.runtime.sendMessage({
    type: 'FLOWSTRAL_CAPTURE_EVENT',
    data: event
  }).then(response => {
    if (response && response.success) {
      console.log('Flowstral Content: Event sent successfully', eventType, 'Response:', response);
    } else {
      console.warn('Flowstral Content: Event send response', eventType, response);
    }
  }).catch(error => {
    console.error('Flowstral Content: Failed to send event', eventType, error);
  });
  
  // Flush buffer if it gets too large
  if (eventBuffer.length > 10) {
    flushEventBuffer();
  }
}

// Flush event buffer - send any remaining events to background script
async function flushEventBuffer() {
  if (eventBuffer.length === 0) {
    return;
  }
  
  console.log(`Flowstral Content: Flushing ${eventBuffer.length} buffered events`);
  
  // Send each buffered event to background script
  for (const event of eventBuffer) {
    try {
      await chrome.runtime.sendMessage({
        type: 'FLOWSTRAL_CAPTURE_EVENT',
        data: event
      });
      console.log('Flowstral Content: Buffered event sent', event.event_type);
    } catch (error) {
      console.error('Flowstral Content: Failed to send buffered event', error);
    }
  }
  
  // Clear buffer
  eventBuffer = [];
}

// Show visual indicator when recording (DISABLED - moved to side panel)
function showRecordingIndicator() {
  // Indicator removed - status is now shown in side panel only
  // This prevents blocking the webpage
  console.log('Flowstral Content: Recording active (indicator disabled, check side panel for status)');
  
  // Optional: Send status update to side panel instead
  try {
    chrome.runtime.sendMessage({
      type: 'FLOWSTRAL_RECORDING_STATUS',
      data: { isRecording: true }
    });
  } catch (e) {
    // Ignore if side panel not available
  }
}

// Hide recording indicator
function hideRecordingIndicator() {
  const indicator = document.getElementById('flowstral-recording-indicator');
  if (indicator) {
    indicator.remove();
    console.log('Flowstral Content: Recording indicator hidden');
  }
}

// Initialize: Check if we should start recording
chrome.storage.local.get('flowstral_session').then(stored => {
  console.log('Flowstral Content: Checking for existing session', stored);
  if (stored.flowstral_session && stored.flowstral_session.isActive) {
    console.log('Flowstral Content: Found active session, starting recording');
    startRecording(stored.flowstral_session.sessionId);
  } else {
    console.log('Flowstral Content: No active session found');
  }
});

// Also listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.flowstral_session) {
    const newSession = changes.flowstral_session.newValue;
    if (newSession && newSession.isActive && newSession.sessionId) {
      console.log('Flowstral Content: Session activated via storage change');
      startRecording(newSession.sessionId);
    } else if (!newSession || !newSession.isActive) {
      console.log('Flowstral Content: Session deactivated');
      stopRecording();
    }
  }
});

