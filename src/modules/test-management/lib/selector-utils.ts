/**
 * Selector Utility Functions
 *
 * Extracted from UnifiedWorkflowEditor.tsx.
 * Pure functions for converting, extracting, and working with element selectors.
 */

import type { SelectorObject } from '../types/workflow-editor.types';

/**
 * Convert various selector formats to Python Playwright format
 * IMPORTANT: This function MUST be defined at module level before any usage
 */
export function convertSelector(selector: string): string {
  if (!selector) return 'locator("body")';

  // Clean up the selector - also escape newlines
  selector = selector.trim().replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // Log for debugging
  console.log('[convertSelector] Input:', selector);

  // Already in Python format
  if (selector.includes('get_by_')) {
    const result = selector.replace(/^page\./, '');
    console.log('[convertSelector] Python format:', result);
    return result;
  }

  // Handle page.getByRole, page.getByText etc. (JavaScript Playwright format from recordings)
  if (selector.startsWith('page.getBy') || selector.startsWith('page.locator')) {
    let result = selector
      .replace(/^page\./, '')
      .replace(/getByRole\(\s*['"](\w+)['"](?:\s*,\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g,
        (_, role, name) => name ? `get_by_role("${role}", name="${name}")` : `get_by_role("${role}")`)
      .replace(/getByText\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_text("$1")')
      .replace(/getByLabel\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_label("$1")')
      .replace(/getByPlaceholder\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_placeholder("$1")')
      .replace(/getByTestId\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_test_id("$1")')
      .replace(/getByTitle\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_title("$1")')
      .replace(/locator\(\s*['"]([^'"]+)['"]\s*\)/g, 'locator("$1")');

    console.log('[convertSelector] JS Playwright format converted:', result);
    return result;
  }

  // Handle locator('...') format - extract the inner selector
  const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
  if (locatorMatch) {
    const innerSelector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
    const result = `locator("${innerSelector.replace(/"/g, '\\"')}")`;
    console.log('[convertSelector] Locator format:', result);
    return result;
  }

  // Handle raw CSS selectors (e.g., [name="firstName"], #myId, .myClass)
  if (selector.startsWith('[') || selector.startsWith('#') || selector.startsWith('.')) {
    const result = `locator("${selector.replace(/"/g, '\\"')}")`;
    console.log('[convertSelector] CSS selector:', result);
    return result;
  }

  // Handle getByRole, getByText, etc. without page. prefix (JavaScript to Python conversion)
  let result = selector
    .replace(/getByRole\(\s*['"](\w+)['"](?:\s*,\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g,
      (_, role, name) => name ? `get_by_role("${role}", name="${name}")` : `get_by_role("${role}")`)
    .replace(/getByText\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_text("$1")')
    .replace(/getByLabel\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_label("$1")')
    .replace(/getByPlaceholder\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_placeholder("$1")')
    .replace(/getByTestId\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_test_id("$1")')
    .replace(/getByTitle\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_title("$1")')
    .replace(/^page\./, '');

  // If no transformation happened and it's not empty, wrap in locator
  if (result === selector && selector.trim()) {
    // Check if it looks like a simple field name (no special chars) - convert to name attribute selector
    // Common field names: username, password, email, firstName, lastName, etc.
    const trimmed = selector.trim();
    const isSimpleName = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed) && !trimmed.includes(' ');

    if (isSimpleName) {
      // This is likely a field name, use name attribute selector
      result = `locator('[name="${trimmed}"]')`;
      console.log('[convertSelector] Converted simple name to [name=]:', result);
    } else {
      result = `locator("${selector.replace(/"/g, '\\"')}")`;
    }
  }

  console.log('[convertSelector] Final result:', result);
  return result || 'locator("body")';
}

/**
 * Extract string selector from various formats (object or string)
 * Recordings can produce: { playwright: "locator('[name=x]')", selector: "[name=x]" } or just a string
 */
export function extractSelectorString(selector: any): string {
  if (!selector) return '';

  // If it's already a string, return it
  if (typeof selector === 'string') return selector;

  // If it's an object, try to extract the selector string
  if (typeof selector === 'object') {
    // Priority: playwright > selector > primary.playwright > primary.selector
    if (selector.playwright && typeof selector.playwright === 'string') {
      return selector.playwright;
    }
    if (selector.selector && typeof selector.selector === 'string') {
      return selector.selector;
    }
    if (selector.primary?.playwright && typeof selector.primary.playwright === 'string') {
      return selector.primary.playwright;
    }
    if (selector.primary?.selector && typeof selector.primary.selector === 'string') {
      return selector.primary.selector;
    }
    // Check for common selector attributes stored directly
    if (selector.css) return selector.css;
    if (selector.xpath) return selector.xpath;
    if (selector.text) return `text=${selector.text}`;
    if (selector.testId) return `[data-testid="${selector.testId}"]`;
    if (selector.name) return `[name="${selector.name}"]`;
    if (selector.id) return `#${selector.id}`;

    console.warn('[extractSelectorString] Could not extract string from selector object:', selector);
    return '';
  }

  console.warn('[extractSelectorString] Unknown selector type:', typeof selector, selector);
  return '';
}

/**
 * Extract full SelectorObject with fallbacks (same structure as Suggest/Recording)
 * This preserves all fallback strategies for robust execution
 */
export function extractSelectorObject(selector: any, selectorObj: any, eventData: any): SelectorObject | undefined {
  // If we already have a valid selectorObj, use it
  if (selectorObj && typeof selectorObj === 'object') {
    return {
      playwright: selectorObj.playwright,
      selector: selectorObj.selector,
      fallbacks: selectorObj.fallbacks,
      confidence: selectorObj.confidence,
      text: eventData?.text || selectorObj.text,
      name: eventData?.name || selectorObj.name,
      id: eventData?.id || selectorObj.id,
      ariaLabel: eventData?.ariaLabel || selectorObj.ariaLabel,
      testId: eventData?.testId || selectorObj.testId,
    };
  }

  // If selector is an object with selector data, extract it
  if (selector && typeof selector === 'object') {
    return {
      playwright: selector.playwright,
      selector: selector.selector || selector.css,
      fallbacks: selector.fallbacks,
      confidence: selector.confidence,
      text: eventData?.text || selector.text,
      name: eventData?.name || selector.name,
      id: eventData?.id || selector.id,
      ariaLabel: eventData?.ariaLabel || selector.ariaLabel,
      testId: eventData?.testId || selector.testId,
    };
  }

  // If we have event data with text/attributes, create a minimal selectorObj for fallbacks
  if (eventData) {
    const obj: SelectorObject = {};
    if (eventData.text) obj.text = eventData.text;
    if (eventData.name) obj.name = eventData.name;
    if (eventData.id) obj.id = eventData.id;
    if (eventData.ariaLabel) obj.ariaLabel = eventData.ariaLabel;
    if (Object.keys(obj).length > 0) return obj;
  }

  return undefined;
}

/**
 * Extract human-readable target name from selector
 * e.g., getByRole('button', { name: 'Submit' }) -> "Submit button"
 */
export function extractTargetName(selectorInput?: any, eventData?: any): string {
  const selector = extractSelectorString(selectorInput);
  if (!selector) return '';

  // Check if we have text/label from event data
  if (eventData?.text) return eventData.text;
  if (eventData?.element?.textContent) return eventData.element.textContent.slice(0, 30);

  // Parse getByRole
  const roleMatch = selector.match(/getByRole\(['"](\w+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
  if (roleMatch) {
    const [, role, name] = roleMatch;
    return name ? `${name}` : role;
  }

  // Parse getByText
  const textMatch = selector.match(/getByText\(['"]([^'"]+)['"]\)/);
  if (textMatch) return textMatch[1];

  // Parse getByLabel
  const labelMatch = selector.match(/getByLabel\(['"]([^'"]+)['"]\)/);
  if (labelMatch) return `${labelMatch[1]} field`;

  // Parse getByPlaceholder
  const placeholderMatch = selector.match(/getByPlaceholder\(['"]([^'"]+)['"]\)/);
  if (placeholderMatch) return `${placeholderMatch[1]} field`;

  // Parse locator with text
  const locatorTextMatch = selector.match(/locator\([^)]*text=['"]([^'"]+)['"]/);
  if (locatorTextMatch) return locatorTextMatch[1];

  // Parse data-testid
  const testIdMatch = selector.match(/\[data-testid=['"]([^'"]+)['"]\]/);
  if (testIdMatch) return testIdMatch[1].replace(/-/g, ' ');

  // Parse aria-label
  const ariaMatch = selector.match(/\[aria-label=['"]([^'"]+)['"]\]/);
  if (ariaMatch) return ariaMatch[1];

  return '';
}
