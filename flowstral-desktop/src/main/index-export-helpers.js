/**
 * Export Helper Functions
 * Extracted from index.js for modularity.
 *
 * Contains:
 * - mapQWordToStepType: QWord action type to step type mapping
 * - getBestCssSelector: Extract best CSS selector from recorded selectors
 * - buildSelectorObj: Build proper selectorObj for Test Builder
 * - deduplicateAndFilterSteps: Deduplicate fills and filter phantom actions
 */

/**
 * Map QWord action types to step types for the Test Builder.
 * @param {string} qword
 * @returns {string}
 */
function mapQWordToStepType(qword) {
  const map = {
    'GoTo': 'navigate',
    'ClickText': 'click',
    'ClickElement': 'click',
    'Fill': 'input',
    'Select': 'select',
    'Check': 'click',
    'Uncheck': 'click',
    'AssertText': 'assert',
    'Wait': 'wait'
  };
  return map[qword] || 'click';
}

/**
 * Extract best CSS selector from recorded selectors (MATCHES WEB EXTENSION).
 * Web extension stores selectors with 'selector' property (CSS) and 'playwright' property.
 * @param {Object} step - Step object with selectorObj
 * @returns {string} Best CSS selector or empty string
 */
function getBestCssSelector(step) {
  const selectorObj = step.selectorObj || {};
  const strategies = selectorObj.strategies || [];

  // First check if selectorObj already has selector from _buildSelectorObject
  if (selectorObj.selector && (selectorObj.selector.startsWith('[') || selectorObj.selector.startsWith('#'))) {
    return selectorObj.selector;
  }

  // Priority order: id > testid > name > placeholder > aria > css
  const priorityTypes = ['id', 'testid', 'name', 'placeholder', 'aria'];

  for (const type of priorityTypes) {
    // Try 'selector' property first (new format), then 'value' (old format)
    const sel = strategies.find(s => s.type === type && (s.selector || s.value));
    if (sel) {
      const cssVal = sel.selector || sel.value;
      if (cssVal && (cssVal.startsWith('[') || cssVal.startsWith('#'))) {
        return cssVal;
      }
    }
  }

  // Also check primary
  const primary = selectorObj.primary;
  if (typeof primary === 'string' && (primary.startsWith('[') || primary.startsWith('#'))) {
    return primary;
  } else if (primary?.selector) {
    return primary.selector;
  }

  // Fall back to any CSS-like selector from strategies
  const cssSelector = strategies.find(s => {
    const val = s.selector || s.value;
    return val && (val.startsWith('[') || val.startsWith('#') || val.startsWith('.'));
  });
  if (cssSelector) return cssSelector.selector || cssSelector.value;

  return '';
}

/**
 * Build proper selectorObj for Test Builder (MATCHES WEB EXTENSION FORMAT).
 * @param {Object} step - Step object with selectorObj and raw element data
 * @returns {Object} Formatted selectorObj
 */
function buildSelectorObj(step) {
  const raw = step.selectorObj || {};
  const strategies = raw.strategies || [];
  const element = step.raw?.element || {};

  // Find best CSS selector
  const cssSelector = getBestCssSelector(step);

  // Get playwright string from selectorObj if available, otherwise build it
  let playwright = raw.playwright || '';
  if (!playwright && cssSelector) {
    playwright = `locator('${cssSelector}')`;
  } else if (!playwright && element.name) {
    playwright = `locator('[name="${element.name}"]')`;
  } else if (!playwright && element.id) {
    playwright = `locator('#${element.id}')`;
  } else if (!playwright && element.placeholder) {
    playwright = `get_by_placeholder('${element.placeholder}')`;
  }

  // Build text selector for ClickText
  const textSelector = strategies.find(s => s.type === 'text');

  return {
    // Match web extension format
    selector: cssSelector || raw.selector || '',
    playwright: playwright,
    primary: typeof raw.primary === 'string' ? raw.primary : (raw.primary?.selector || cssSelector || ''),
    confidence: raw.confidence || 0,
    type: raw.type || 'css',
    // Text content
    text: textSelector?.value || raw.text || element.text || '',
    // Element attributes for fallback
    name: raw.name || element.name || '',
    id: raw.id || element.id || '',
    placeholder: raw.placeholder || element.placeholder || '',
    ariaLabel: raw.ariaLabel || element.ariaLabel || '',
    // Fallbacks with both selector and playwright
    fallbacks: (raw.fallbacks || []).map(f => {
      if (typeof f === 'string') {
        return { selector: f, playwright: `locator('${f}')` };
      }
      return {
        selector: f.selector || f.value || '',
        playwright: f.playwright || (f.selector ? `locator('${f.selector}')` : ''),
        type: f.type,
        confidence: f.confidence
      };
    }),
    strategies: strategies.map(s => ({
      type: s.type,
      selector: s.selector || s.value || '',
      playwright: s.playwright || '',
      confidence: s.confidence
    }))
  };
}

/**
 * Deduplicate fill steps and filter phantom/unwanted actions.
 * Keeps only the LAST fill for each field. Removes generic clicks and consecutive hovers.
 * @param {Array} steps - Original array of steps
 * @returns {Array} Deduplicated and filtered steps with sequential order numbers
 */
function deduplicateAndFilterSteps(steps) {
  // ============================================================
  // DEDUPLICATE FILLS - Keep only the LAST fill for each field
  // This handles Recipe + CDP recorder duplicates
  // ============================================================
  const seenFillFields = new Map(); // fieldKey -> index
  const deduplicatedSteps = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepType = (step.type || '').toLowerCase();
    const isFill = stepType === 'input' || stepType === 'fill';

    if (isFill) {
      // Extract field name from step.name like 'Fill "Username": "value"'
      // Also try args[0] as fallback
      let fieldName = '';
      const nameMatch = (step.name || '').match(/Fill\s*"([^"]+)"/i);
      if (nameMatch) {
        fieldName = nameMatch[1].toLowerCase().trim();
      } else {
        fieldName = (step.args?.[0] || '').toLowerCase().trim();
      }

      // Normalize common field name variations
      const normalizeFieldName = (name) => {
        const n = name.toLowerCase().trim();
        if (['pw', 'pwd', 'passwd', 'pass'].includes(n)) return 'password';
        if (['user', 'uname', 'usr'].includes(n)) return 'username';
        if (['mail', 'e-mail'].includes(n)) return 'email';
        return n;
      };

      const normalizedFieldName = normalizeFieldName(fieldName);
      console.log(`[Export Dedupe] Fill step ${i}: "${fieldName}" -> normalized: "${normalizedFieldName}"`);

      if (normalizedFieldName && normalizedFieldName !== 'input') {
        const existingIdx = seenFillFields.get(normalizedFieldName);
        if (existingIdx !== undefined) {
          // Replace with this one (later fill has more complete value)
          console.log(`[Export Dedupe] ★ Replacing fill for "${normalizedFieldName}" at index ${existingIdx}`);
          deduplicatedSteps[existingIdx] = step;
          continue; // Don't add again
        }
        seenFillFields.set(normalizedFieldName, deduplicatedSteps.length);
      }
    }

    deduplicatedSteps.push(step);
  }

  // ============================================================
  // ADDITIONAL FILTERING - Remove phantom/unwanted actions
  // ============================================================
  const filteredSteps = deduplicatedSteps.filter((step, idx) => {
    const name = (step.name || '').toLowerCase();
    const type = (step.type || '').toLowerCase();

    // Filter 1: Remove generic "click div" or empty clicks
    if (type === 'click' && (name.includes('click "div"') || name.includes('click "span"') || name.includes('click ""'))) {
      console.log('[Export Filter] Removing generic click:', name);
      return false;
    }

    // Filter 2: Remove consecutive duplicate hovers
    if (type === 'hover') {
      const nextStep = deduplicatedSteps[idx + 1];
      if (nextStep && (nextStep.type || '').toLowerCase() === 'hover') {
        console.log('[Export Filter] Removing consecutive hover:', name);
        return false;
      }
    }

    return true;
  });

  // Renumber steps sequentially
  const renumberedSteps = filteredSteps.map((step, idx) => ({
    ...step,
    order: idx + 1
  }));

  console.log(`[Export Dedupe] Final: ${steps.length} -> ${renumberedSteps.length} steps`);
  return renumberedSteps;
}

module.exports = {
  mapQWordToStepType,
  getBestCssSelector,
  buildSelectorObj,
  deduplicateAndFilterSteps
};
