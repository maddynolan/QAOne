/**
 * Step normalization utilities for robust test playback.
 * Normalizes selectors, filters garbage actions, and prepares steps
 * for consistent, reliable test execution.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

/**
 * Normalizes text by removing dynamic content that may change between recordings
 * - Strips trailing numbers (badge counts like "Cart 2" -> "Cart")
 * - Strips leading/trailing whitespace
 * - Handles emojis and special characters
 */
export const normalizeText = (text: string | undefined): string => {
  if (!text) return '';
  return text
    .replace(/\s*\d+\s*$/, '')           // Strip trailing numbers (badge counts)
    .replace(/^\s*\d+\s*/, '')           // Strip leading numbers
    // CRITICAL: Normalize apostrophe variants to straight apostrophe (don't strip them!)
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'")  // Curly apostrophes -> straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')        // Curly quotes -> straight
    // Only strip emojis (not ALL non-ASCII - that breaks apostrophes and accented chars)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Emojis in Misc Symbols and Pictographs
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
    .replace(/\s+/g, ' ')                // Normalize whitespace
    .trim();
};

/**
 * Creates robust fallback selectors from a selectorObj
 * Prioritizes: data-testid > aria-label > role > text > css
 */
export const createRobustSelectors = (selectorObj: any, description: string): string[] => {
  const selectors: string[] = [];

  // 1. HIGHEST PRIORITY: data-testid (most stable)
  if (selectorObj?.testId) {
    selectors.push(`[data-testid="${selectorObj.testId}"]`);
  }

  // 2. aria-label (accessibility, stable)
  if (selectorObj?.ariaLabel) {
    selectors.push(`[aria-label="${selectorObj.ariaLabel}"]`);
  }

  // 3. Role + name (semantic, robust)
  if (selectorObj?.role) {
    const role = selectorObj.role;
    const name = normalizeText(selectorObj.name || selectorObj.text);
    if (name) {
      selectors.push(`role=${role}[name="${name}"]`);
      selectors.push(`role=${role}[name*="${name}"]`); // Partial match
    } else {
      selectors.push(`role=${role}`);
    }
  }

  // 4. Original playwright selector (if valid)
  if (selectorObj?.playwright && !selectorObj.playwright.includes('undefined')) {
    selectors.push(selectorObj.playwright);
  }

  // 5. Text selector - NORMALIZED (strip numbers, emojis)
  const originalText = selectorObj?.text || '';
  const normalizedText = normalizeText(originalText);
  if (normalizedText && normalizedText.length > 1) {
    selectors.push(`text="${normalizedText}"`);
    selectors.push(`text=${normalizedText}`);  // Without quotes (partial match)
  }

  // 6. ID selector
  if (selectorObj?.id) {
    selectors.push(`#${selectorObj.id}`);
  }

  // 7. Name attribute
  if (selectorObj?.name) {
    selectors.push(`[name="${selectorObj.name}"]`);
  }

  // 8. CSS selector from selectorObj
  if (selectorObj?.selector && typeof selectorObj.selector === 'string') {
    selectors.push(selectorObj.selector);
  }

  // 9. Extract from description as last resort
  // "Click "Cart"" -> text="Cart"
  const descMatch = description?.match(/["']([^"']+)["']/);
  if (descMatch && descMatch[1]) {
    const descText = normalizeText(descMatch[1]);
    if (descText && descText.length > 1 && !selectors.some(s => s.includes(descText))) {
      selectors.push(`text="${descText}"`);
    }
  }

  // 10. Include original fallbacks
  if (selectorObj?.fallbacks && Array.isArray(selectorObj.fallbacks)) {
    selectorObj.fallbacks.forEach((fb: any) => {
      if (fb?.playwright) selectors.push(fb.playwright);
      if (fb?.selector) selectors.push(fb.selector);
    });
  }

  // Deduplicate and filter empty
  return [...new Set(selectors)].filter(s => s && s.length > 0);
};

/**
 * Normalizes a single step for robust playback
 * DIRECTLY REPLACES selector fields so backend uses normalized values
 */
export const normalizeStepForPlayback = (action: RecordedAction): RecordedAction => {
  const selectorObj = action.selectorObj || {};
  const description = action.description || '';

  // Create robust selectors
  const robustSelectors = createRobustSelectors(selectorObj, description);

  // Normalize the primary text - CRITICAL: this replaces the original
  const originalText = selectorObj.text || '';
  const normalizedText = normalizeText(originalText);

  // Normalize args[0] if it contains the element name (for click actions)
  const normalizedArgs = action.args ? [...action.args] : [];
  if (normalizedArgs[0] && typeof normalizedArgs[0] === 'string') {
    normalizedArgs[0] = normalizeText(normalizedArgs[0]);
  }

  // Build enhanced selectorObj - REPLACE original fields, not just add new ones
  const enhancedSelectorObj = {
    ...selectorObj,
    // REPLACE text with normalized version (backend uses this!)
    text: normalizedText || selectorObj.text,
    // REPLACE selector with normalized text selector
    selector: robustSelectors[0] || selectorObj.selector,
    // REPLACE playwright with best robust selector
    playwright: robustSelectors[0] || selectorObj.playwright,
    // Store ALL fallbacks for backend to try
    fallbacks: robustSelectors.map(sel => ({
      playwright: sel,
      selector: sel
    })),
    // Keep original for debugging
    _originalText: originalText,
    _normalized: true
  };

  // Normalize the description - REPLACE dynamic numbers
  const normalizedDesc = description
    .replace(/["']([^"']+)["']/g, (match, text) => {
      const normalized = normalizeText(text);
      return normalized ? `"${normalized}"` : match;
    })
    .replace(/\s+/g, ' ')
    .trim();

  if (import.meta.env.DEV) {
    console.log(`[Normalize] "${originalText}" \u2192 "${normalizedText}", selectors:`, robustSelectors.slice(0, 3));
  }

  return {
    ...action,
    args: normalizedArgs,
    selectorObj: enhancedSelectorObj,
    description: normalizedDesc,
    // Store original for debugging
    _original: {
      description: action.description,
      selectorObj: action.selectorObj,
      args: action.args
    }
  } as RecordedAction;
};

/**
 * Checks if an action is garbage/invalid (internal framework code, etc.)
 * These get accidentally captured sometimes and should be filtered out
 */
export const isGarbageAction = (action: RecordedAction): boolean => {
  const desc = (action.description || '').toLowerCase();
  const text = (action.selectorObj?.text || '').toLowerCase();
  const arg0 = (action.args?.[0] || '').toString().toLowerCase();

  // Patterns that indicate garbage/internal framework captures
  const garbagePatterns = [
    /import\s*\{.*\}\s*from/i,           // ES6 imports
    /@react-refr/i,                       // React refresh
    /injectintoglobalhook/i,              // React internals
    /webpack/i,                           // Webpack internals
    /hot-update/i,                        // HMR
    /\[hmr\]/i,                           // Hot Module Replacement
    /__vite/i,                            // Vite internals
    /node_modules/i,                      // Node modules paths
    /sourcemappingurl/i,                  // Source maps
    /use strict/i,                        // JS directives
    /export\s*(default|const|function)/i, // ES6 exports
    /^function\s*\(/i,                    // Raw function code
    /^\(\s*\)\s*=>/i,                     // Arrow functions
  ];

  const allText = `${desc} ${text} ${arg0}`;

  for (const pattern of garbagePatterns) {
    if (pattern.test(allText)) {
      if (import.meta.env.DEV) {
        console.log(`[Normalize] FILTERED garbage action: "${desc.slice(0, 50)}..."`);
      }
      return true;
    }
  }

  return false;
};

/**
 * Normalizes all steps before playback
 * - Filters out garbage/invalid actions
 * - Normalizes selectors for robust execution
 */
export const normalizeStepsForPlayback = (actions: RecordedAction[]): RecordedAction[] => {
  return actions
    .filter(action => {
      // Remove garbage actions (React internals, imports, etc.)
      if (isGarbageAction(action)) {
        return false;
      }
      return true;
    })
    .map(action => {
      // Skip if already normalized
      if ((action.selectorObj as any)?._normalized) return action;

      // Only normalize click/input actions that have selectors
      const actionType = (action.qword || action.type || '').toLowerCase();
      const needsNormalization = ['click', 'fill', 'type', 'input', 'select', 'check', 'hover'].includes(actionType);

      if (needsNormalization) {
        return normalizeStepForPlayback(action);
      }

      return action;
    });
};
