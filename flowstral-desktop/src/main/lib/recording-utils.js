/**
 * Recording Utilities
 * 
 * Shared utility functions for recording and playback.
 * Includes text normalization, selector generation, and CSS escaping.
 */

// cssEscape polyfill for Node.js (browser API not available in Electron main process)
// Based on https://drafts.csswg.org/cssom/#serialize-an-identifier
const cssEscape = (value) => {
  if (value == null) return '';
  const string = String(value);
  const length = string.length;
  let result = '';
  for (let i = 0; i < length; i++) {
    const char = string.charAt(i);
    const code = string.charCodeAt(i);
    // If the character is NULL, use replacement character
    if (code === 0x0000) {
      result += '\uFFFD';
      continue;
    }
    if (
      (code >= 0x0001 && code <= 0x001F) || // C0 controls
      code === 0x007F || // DEL
      (i === 0 && code >= 0x0030 && code <= 0x0039) || // digit at start
      (i === 1 && code >= 0x0030 && code <= 0x0039 && string.charCodeAt(0) === 0x002D) // digit after hyphen at start
    ) {
      result += '\\' + code.toString(16) + ' ';
      continue;
    }
    if (i === 0 && code === 0x002D && length === 1) {
      result += '\\' + char;
      continue;
    }
    if (
      code >= 0x0080 ||
      code === 0x002D || // hyphen
      code === 0x005F || // underscore
      (code >= 0x0030 && code <= 0x0039) || // digit
      (code >= 0x0041 && code <= 0x005A) || // uppercase
      (code >= 0x0061 && code <= 0x007A) // lowercase
    ) {
      result += char;
      continue;
    }
    result += '\\' + char;
  }
  return result;
};

/**
 * Normalize text for matching
 * Handles: apostrophe variants (', ', etc.), quote variants, whitespace
 */
const normalizeTextForMatching = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'") // All apostrophe variants to straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')              // All quote variants to straight
    .replace(/\s+/g, ' ')                                          // Normalize whitespace
    .trim();
};

/**
 * Extract element text from description like 'Click "Submit"' -> 'Submit'
 */
const extractTextFromDescription = (description) => {
  if (!description) return '';
  const match = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*"([^"]+)"/i);
  if (match) return match[1];
  // Also try single quotes
  const matchSingle = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*'([^']+)'/i);
  if (matchSingle) return matchSingle[1];
  return description; // Return full description as fallback
};

/**
 * Get the best label for an action from all available sources
 */
const getActionLabel = (action) => {
  // Priority order: label > text > selectorObj.text > recipe.what.text > extracted from description
  let label = action.label || 
              action.text || 
              action.selectorObj?.text ||
              action.recipe?.what?.text ||
              action.args?.[0];
  
  // If still no label, try extracting from description
  if (!label && action.description) {
    label = extractTextFromDescription(action.description);
  }
  
  // Normalize the label for matching
  return normalizeTextForMatching(label || '');
};

/**
 * Check if an ID looks dynamic (contains random/timestamp patterns)
 */
const isDynamicId = (id) => {
  if (!id) return true;
  // Pattern matches: UUIDs, timestamps, random strings
  const dynamicPatterns = [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
    /^\d{10,}$/, // Timestamp
    /^[a-z0-9]{20,}$/i, // Random alphanumeric
    /:r\d+:/, // React generated IDs
    /^ember\d+$/, // Ember IDs
    /^react-aria-?\d+/, // React ARIA IDs
  ];
  return dynamicPatterns.some(p => p.test(id));
};

/**
 * Generate a stable CSS selector for an element
 */
const generateStableSelector = (element) => {
  const { testId, dataTestId, name, id, ariaLabel, tagName, className } = element;
  
  // Priority order for stable selectors
  if (testId || dataTestId) {
    return `[data-testid="${testId || dataTestId}"]`;
  }
  if (name) {
    return `[name="${name}"]`;
  }
  if (id && !isDynamicId(id)) {
    return `#${cssEscape(id)}`;
  }
  if (ariaLabel) {
    return `[aria-label="${ariaLabel}"]`;
  }
  if (tagName && className) {
    // Use first stable class
    const classes = className.split(' ').filter(c => !isDynamicId(c));
    if (classes.length > 0) {
      return `${tagName.toLowerCase()}.${classes[0]}`;
    }
  }
  return '';
};

/**
 * Clean text for recording (remove invisible characters, normalize)
 */
const cleanTextForRecording = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // Limit length
};

/**
 * Check if a click should be filtered (on input fields, etc.)
 */
const shouldFilterClick = (element) => {
  const { tagName, type } = element;
  const tag = (tagName || '').toLowerCase();
  const inputType = (type || '').toLowerCase();
  
  // Filter clicks on text inputs (fill handles these)
  if (tag === 'input') {
    const textTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
    if (textTypes.includes(inputType) || !inputType) {
      return true;
    }
  }
  
  if (tag === 'textarea') {
    return true;
  }
  
  return false;
};

/**
 * Normalize action type to standard format
 */
const normalizeActionType = (type) => {
  if (!type) return '';
  return type.toLowerCase().replace(/[_\s-]/g, '');
};

/**
 * Convert recorded action to QWord format
 */
const toQWord = (action) => {
  const typeMap = {
    'navigate': 'GoTo',
    'goto': 'GoTo',
    'click': 'ClickText',
    'fill': 'Fill',
    'type': 'Fill',
    'select': 'Select',
    'check': 'Check',
    'uncheck': 'Uncheck',
    'hover': 'Hover',
    'press': 'Press',
    'scroll': 'Scroll',
    'wait': 'Wait',
    'screenshot': 'Screenshot',
    'newtab': 'NewTab',
    'switchtab': 'SwitchTab',
    'closetab': 'CloseTab',
  };
  
  const normalizedType = normalizeActionType(action.type);
  return typeMap[normalizedType] || action.type;
};

module.exports = {
  cssEscape,
  normalizeTextForMatching,
  extractTextFromDescription,
  getActionLabel,
  isDynamicId,
  generateStableSelector,
  cleanTextForRecording,
  shouldFilterClick,
  normalizeActionType,
  toQWord,
};
