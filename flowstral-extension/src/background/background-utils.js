/**
 * Background Utils - Shared utility functions for RecordingManager
 * Extracted from background.js for modularity
 */

function bgToSnakeCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

function bgEscapeStringDouble(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/"/g, '\\"')       // Escape double quotes
    .replace(/\n/g, '\\n')      // Escape newlines
    .replace(/\r/g, '\\r')      // Escape carriage returns
    .replace(/\t/g, '\\t')      // Escape tabs
    .replace(/\f/g, '\\f')      // Escape form feeds
    .replace(/\0/g, '')         // Remove null characters
    .replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove other control characters
}

function bgEscapeString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function bgEscapeStringSingleQuote(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function bgIsRedundant(action, prev, getSelectorStringFn, getActionPriorityFn) {
  if (!prev) return false;

  const actionSelector = getSelectorStringFn(action.selector);
  const prevSelector = getSelectorStringFn(prev.selector);

  // Skip duplicate navigations to same URL
  if (action.type === 'navigate' && prev.type === 'navigate') {
    if (action.url === prev.url) return true;
  }

  // Skip duplicate button clicks (same button, same text, within 500ms)
  if (action.type === 'click' && prev.type === 'click') {
    if (action.description === prev.description && action.timestamp - prev.timestamp < 500) {
      return true;
    }
  }

  // Skip duplicate actions on same element within short time
  if (actionSelector === prevSelector && actionSelector) {
    // Same element, check if redundant
    if (action.timestamp - prev.timestamp < 500) {
      // Multiple actions on same element - keep only the most specific one
      const actionPriority = getActionPriorityFn(action.type);
      const prevPriority = getActionPriorityFn(prev.type);

      // If current action is less specific, skip it
      if (actionPriority < prevPriority) return true;

      // If same priority, skip duplicates
      if (actionPriority === prevPriority && action.type === prev.type) return true;

      // Skip fill after check on radio/checkbox
      if (prev.type === 'check' && action.type === 'fill') {
        return true; // Check is enough, don't fill
      }
    }
  }

  // Skip click before check/uncheck on same element (check/uncheck already includes click)
  if (prev.type === 'click' && (action.type === 'check' || action.type === 'uncheck')) {
    if (actionSelector === prevSelector && action.timestamp - prev.timestamp < 500) {
      return true; // Skip the click, keep the check
    }
  }

  // Skip fill on radio/checkbox elements (use check instead)
  if (action.type === 'fill') {
    if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
      return true; // Never fill radio/checkbox
    }
  }

  // Skip clicks on generic spans/labels that are just wrappers
  if (action.type === 'click') {
    const selector = actionSelector.toLowerCase();
    if (selector.includes('span') && selector.includes('nth-of-type') &&
        prev.type === 'check' && action.timestamp - prev.timestamp < 500) {
      return true; // Skip click on span wrapper if check just happened
    }
  }

  // Skip redundant waits
  if (action.type === 'wait') {
    return true;
  }

  return false;
}

function bgGetSelectorString(selector) {
  if (!selector) return '';
  if (typeof selector === 'string') return selector;

  // Try to extract actual selector string in order of preference
  // Priority: playwright > selector > css > primary (nested)
  if (selector.playwright) return selector.playwright;
  if (selector.selector) return selector.selector;
  if (selector.css) return selector.css;

  // Check nested primary object
  if (selector.primary) {
    if (typeof selector.primary === 'string') return selector.primary;
    if (selector.primary.playwright) return selector.primary.playwright;
    if (selector.primary.selector) return selector.primary.selector;
  }

  // Try other properties
  if (selector.testId) return `[data-testid="${selector.testId}"]`;
  if (selector.role) return `role=${selector.role}`;
  if (selector.text) return `text=${selector.text}`;
  if (selector.label) return `label=${selector.label}`;
  if (selector.id) return `#${selector.id}`;
  if (selector.name) return `[name="${selector.name}"]`;

  // Last resort: return empty string (not JSON) to avoid false matches
  return '';
}

function bgGetActionPriority(type) {
  // Higher number = more specific/important
  const priorities = {
    'navigate': 10,
    'fill': 8,
    'select': 8,
    'check': 7,
    'uncheck': 7,
    'click': 5,
    'type': 6,
    'press': 4,
    'hover': 3,
    'wait': 1,
  };
  return priorities[type] || 0;
}

function bgNormalizeSelector(selectorStr) {
  if (!selectorStr) return '';
  return selectorStr
    .replace(/'/g, '"')                     // Normalize quotes
    .replace(/\s+/g, ' ')                   // Normalize whitespace
    .replace(/locator\s*\(\s*/g, 'locator(') // Normalize spacing in locator()
    .replace(/get_by_\s*/g, 'get_by_')      // Normalize get_by methods (MUST MATCH content.js)
    .trim()
    .toLowerCase();
}

function bgGenerateSelectorFromActionData(action) {
  // Try to generate a Playwright selector from available action data
  // CRITICAL: Generate Python snake_case syntax, not JavaScript camelCase
  if (!action) return null;

  // Extract text from description (e.g., "Click 'Get involved'" -> "Get involved")
  const description = action.description || '';
  const textMatch = description.match(/['"]([^'"]+)['"]/);
  const text = textMatch ? textMatch[1] : (action.text || '');

  // For click actions, try get_by_role or get_by_text (Python syntax)
  if (action.type === 'click' && text) {
    // Try to determine role from description or tagName
    let role = 'button';
    if (description.toLowerCase().includes('link') || action.tagName === 'a') {
      role = 'link';
    } else if (description.toLowerCase().includes('button') || action.tagName === 'button') {
      role = 'button';
    }

    if (text.length > 0 && text.length < 50) {
      return `get_by_role('${role}', name='${bgEscapeString(text)}')`;
    }
  }

  // For fill actions, try get_by_label or get_by_placeholder (Python syntax)
  if (action.type === 'fill') {
    const label = action.label || action.placeholder || text;
    if (label && label.length > 0 && label.length < 50) {
      return `get_by_label('${bgEscapeString(label)}')`;
    }
  }

  // For check/uncheck, try get_by_role with text (Python syntax)
  if ((action.type === 'check' || action.type === 'uncheck') && text) {
    if (text.length > 0 && text.length < 50) {
      return `get_by_role('checkbox', name='${bgEscapeString(text)}')`;
    }
  }

  // If we have a name attribute, use it
  if (action.name) {
    return `locator('[name="${bgEscapeString(action.name)}"]')`;
  }

  // If we have a title attribute, use it
  if (action.title) {
    return `locator('[title="${bgEscapeString(action.title)}"]')`;
  }

  return null;
}
