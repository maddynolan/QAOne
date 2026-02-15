/**
 * Sidepanel Assertion & Type-Mapping helpers
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * These are standalone functions invoked by one-liner delegates in the class.
 */

/**
 * Map step type to workflow editor node type.
 */
function spMapStepTypeToNodeType(stepType) {
  const typeMap = {
    'click': 'click',
    'fill': 'input',
    'type': 'input',
    'input': 'input',
    'navigate': 'navigate',
    'goto': 'navigate',
    'wait': 'wait',
    'assert': 'assert',
    'assertion': 'assert',
    'switchToParent': 'navigate',
    'closeTab': 'navigate'
  };
  return typeMap[stepType] || 'click';
}

/**
 * Map action type to workflow editor node type.
 */
function spMapActionTypeToNodeType(actionType) {
  const typeMap = {
    'click': 'click',
    'fill': 'input',
    'type': 'input',
    'select': 'input',
    'check': 'click',
    'uncheck': 'click',
    'navigate': 'navigate',
    'goto': 'navigate',
    'wait': 'wait',
    'waitForSelector': 'wait',
    'assert': 'assert',
    'expect': 'assert',
    'hover': 'hover',  // ADD: Map hover to hover (don't convert to click!)
    'dblclick': 'click'  // Double-clicks can be treated as clicks
  };
  return typeMap[actionType] || 'click';
}

/**
 * Generate auto-assertion based on action type.
 */
function spGenerateAutoAssertion(suggestion, response) {
  const type = suggestion.type || suggestion.element;

  // Default assertions based on action type
  const defaults = {
    'click': { enabled: true, type: 'visible', target: suggestion.selector },
    'fill': { enabled: true, type: 'value_equals', target: suggestion.selector, expected: suggestion.value || '' },
    'navigate': { enabled: true, type: 'url_contains', expected: suggestion.href || '' },
    'link': { enabled: true, type: 'url_contains', expected: suggestion.href || '' },
    'button': { enabled: true, type: 'visible', target: suggestion.selector },
    'checkbox': { enabled: true, type: 'checked', target: suggestion.selector },
    'radio': { enabled: true, type: 'checked', target: suggestion.selector },
    'select': { enabled: true, type: 'value_equals', target: suggestion.selector, expected: '' },
  };

  return defaults[type] || { enabled: false, type: 'visible' };
}

/**
 * Generate manual action description.
 */
function spGenerateManualAction(suggestion) {
  const type = suggestion.type || suggestion.element;
  const text = suggestion.text || suggestion.label || suggestion.description;

  switch (type) {
    case 'click':
    case 'button':
      return `Click on "${text}"`;
    case 'link':
      return `Click on link "${text}"`;
    case 'fill':
    case 'input':
      return `Enter "${suggestion.value || '...'}" in ${text}`;
    case 'checkbox':
      return `Check/uncheck "${text}"`;
    case 'radio':
      return `Select radio option "${text}"`;
    case 'select':
      return `Select option from "${text}"`;
    case 'navigate':
      return `Navigate to ${suggestion.href || 'the target page'}`;
    default:
      return `Interact with "${text}"`;
  }
}

/**
 * Generate expected result description.
 */
function spGenerateExpectedResult(suggestion, assertion) {
  if (!assertion || !assertion.enabled) {
    return 'Step completes successfully';
  }

  const type = assertion.type;
  const expected = assertion.expected || '';

  const descriptions = {
    'visible': 'Element is visible on the page',
    'hidden': 'Element is no longer visible',
    'enabled': 'Element is enabled and clickable',
    'disabled': 'Element is disabled',
    'text_equals': `Text equals "${expected}"`,
    'text_contains': `Text contains "${expected}"`,
    'url_equals': `URL is "${expected}"`,
    'url_contains': `URL contains "${expected}"`,
    'title_equals': `Page title is "${expected}"`,
    'title_contains': `Page title contains "${expected}"`,
    'element_count': `Element count is ${expected}`,
    'value_equals': `Input value is "${expected}"`,
    'checked': 'Checkbox/radio is checked',
    'not_checked': 'Checkbox/radio is unchecked',
  };

  return descriptions[type] || 'Assertion passes';
}

/**
 * Generate Playwright assertion code for a step.
 */
function spGenerateAssertionCode(assertion, selector, language) {
  if (!assertion?.enabled) return '';
  language = language || 'python';

  const target = assertion.target || selector || '';
  const expected = assertion.expected || '';

  if (language === 'python') {
    switch (assertion.type) {
      case 'visible': return `    expect(${target}).to_be_visible()`;
      case 'hidden': return `    expect(${target}).to_be_hidden()`;
      case 'enabled': return `    expect(${target}).to_be_enabled()`;
      case 'disabled': return `    expect(${target}).to_be_disabled()`;
      case 'text_equals': return `    expect(${target}).to_have_text("${expected}")`;
      case 'text_contains': return `    expect(${target}).to_contain_text("${expected}")`;
      case 'url_equals': return `    expect(page).to_have_url("${expected}")`;
      case 'url_contains': return `    expect(page.url).to_contain("${expected}")`;
      case 'title_equals': return `    expect(page).to_have_title("${expected}")`;
      case 'title_contains': return `    expect(page.title()).to_contain("${expected}")`;
      case 'element_count': return `    expect(${target}).to_have_count(${expected})`;
      case 'value_equals': return `    expect(${target}).to_have_value("${expected}")`;
      case 'checked': return `    expect(${target}).to_be_checked()`;
      case 'not_checked': return `    expect(${target}).not_to_be_checked()`;
      default: return '';
    }
  } else {
    // TypeScript
    switch (assertion.type) {
      case 'visible': return `    await expect(${target}).toBeVisible();`;
      case 'hidden': return `    await expect(${target}).toBeHidden();`;
      case 'enabled': return `    await expect(${target}).toBeEnabled();`;
      case 'disabled': return `    await expect(${target}).toBeDisabled();`;
      case 'text_equals': return `    await expect(${target}).toHaveText('${expected}');`;
      case 'text_contains': return `    await expect(${target}).toContainText('${expected}');`;
      case 'url_equals': return `    await expect(page).toHaveURL('${expected}');`;
      case 'url_contains': return `    await expect(page.url()).toContain('${expected}');`;
      case 'title_equals': return `    await expect(page).toHaveTitle('${expected}');`;
      case 'title_contains': return `    await expect(await page.title()).toContain('${expected}');`;
      case 'element_count': return `    await expect(${target}).toHaveCount(${expected});`;
      case 'value_equals': return `    await expect(${target}).toHaveValue('${expected}');`;
      case 'checked': return `    await expect(${target}).toBeChecked();`;
      case 'not_checked': return `    await expect(${target}).not.toBeChecked();`;
      default: return '';
    }
  }
}
