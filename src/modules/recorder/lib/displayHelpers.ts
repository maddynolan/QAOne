/**
 * Display helper functions for the recorder UI.
 * Pure functions that improve UI display without modifying underlying data.
 * Fixes "Click element" labels and deduplicates fill actions for display.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

/**
 * Get a better display label from action data when args[0] is generic "element"
 * PURE FUNCTION: Only reads data, never modifies anything
 */
export const getDisplayLabel = (action: RecordedAction): string => {
  if (!action) return 'element';

  const args = action.args || [];
  const label = args[0] || '';

  // If label is already good (not generic), use it as-is
  if (label && label !== 'element' && typeof label === 'string' && label.length > 1 &&
      !/^(div|span|button|input|a|li|td|tr)$/i.test(label)) {
    return label;
  }

  // Extract better label from selectorObj, raw, element data
  const sel = action.selectorObj || (action as any).raw?.selectorObj || {};
  const raw = (action as any).raw || {};
  const element = (action as any).element || raw.element || {};
  const recipe = (action as any).recipe || raw.recipe || (action as any).target || {};
  const recipeWhat = recipe?.what || {};
  const recipeWhere = recipe?.where || {};
  const recipeWhich = recipe?.which || {};

  // Priority order for finding a better label - try ALL sources
  const betterLabel =
    // First: accessible names
    sel.title || raw.title || element.title ||
    sel.ariaLabel || raw.ariaLabel || element.ariaLabel ||
    recipeWhat.text ||
    recipeWhere.nearText ||
    // Second: form identifiers
    sel.placeholder || raw.placeholder || element.placeholder ||
    sel.name || raw.name || element.name ||
    recipeWhich.name ||
    // Third: test IDs
    sel.testId || raw.testId || element.testId ||
    sel.dataTestId || raw.dataTestId || element.dataTestId ||
    recipeWhich.testId ||
    // Fourth: text content
    sel.text || raw.text || element.text ||
    sel.innerText || raw.innerText || element.innerText ||
    element.textContent ||
    // Fifth: try to extract from description
    extractLabelFromDescription(action.description) ||
    // Sixth: role-based
    (sel.role || element.role ? `${sel.role || element.role}${sel.tagName || element.tagName ? ' (' + (sel.tagName || element.tagName) + ')' : ''}` : null) ||
    // Seventh: tag with index
    ((sel.tagName || element.tagName || raw.tag) && (sel.elementIndex !== undefined || raw.elementIndex !== undefined)
      ? `${sel.tagName || element.tagName || raw.tag} #${(sel.elementIndex || raw.elementIndex || 0) + 1}`
      : null) ||
    // Eighth: just tag name
    sel.tagName || element.tagName || raw.tag ||
    // Last resort
    (typeof label === 'string' ? label : 'element');

  return betterLabel || 'element';
};

/**
 * Extract label from description text like 'Click "Login"' -> 'Login'
 */
export const extractLabelFromDescription = (description?: string): string | null => {
  if (!description) return null;
  const match = description.match(/(?:Click|Fill|Select|Check|Uncheck|Type)\s*["']([^"']+)["']/i);
  if (match && match[1] && match[1] !== 'element' && match[1].length > 1) {
    return match[1];
  }
  return null;
};

/**
 * Check if a string looks like a field VALUE rather than a field LABEL
 */
export const looksLikeFieldValue = (str?: string): boolean => {
  if (!str || str.length < 3) return false;

  // Common field label names - NOT values
  if (/^(username|user|pw|pwd|password|pass|email|mail|name|phone|tel|address|city|zip|code|input|field|text|search|query)$/i.test(str)) {
    return false;
  }

  // Looks like email
  if (str.includes('@') && str.includes('.')) return true;

  // Looks like password (mixed case + numbers/special chars, 6+ chars)
  if (str.length >= 6 && /[A-Z]/.test(str) && /[a-z]/.test(str) && /[0-9@!#$%^&*()_+\-=]/.test(str)) return true;

  // Contains @ but not a field name
  if (str.includes('@') && str.length > 5) return true;

  return false;
};

/**
 * Get field identity for deduplication (by attributes, not display label)
 */
export const getFieldIdentity = (action: RecordedAction): string | null => {
  const sel = action.selectorObj || {};
  const raw = (action as any).raw?.selectorObj || (action as any).raw || {};
  const element = (action as any).element || (action as any).raw?.element || {};
  const recipe = (action as any).recipe || (action as any).target || {};
  const recipeWhich = recipe?.which || {};

  return sel.name || raw.name || element.name ||
         sel.id || raw.id || element.id ||
         sel.testId || raw.testId || element.testId ||
         sel.dataTestId || raw.dataTestId || element.dataTestId ||
         sel.placeholder || raw.placeholder || element.placeholder ||
         recipeWhich.name || recipeWhich.id || recipeWhich.testId ||
         null;
};

/**
 * Check if an action is a fill action (CDP or Recipe)
 */
export const isFillAction = (action: RecordedAction): boolean => {
  const qword = (action.qword || '').toLowerCase();
  const type = (action.type || '').toLowerCase();
  return qword === 'fill' || type === 'fill' || type === 'input';
};

/**
 * Check if two Fill actions are for the same field
 */
export const areSameFillField = (action1: RecordedAction, action2: RecordedAction): boolean => {
  if (!action1 || !action2) return false;
  if (!isFillAction(action1) || !isFillAction(action2)) return false;

  // Get field identifiers from multiple sources
  const id1 = getFieldIdentity(action1);
  const id2 = getFieldIdentity(action2);
  if (id1 && id2 && id1.toLowerCase() === id2.toLowerCase()) return true;

  // Get labels from args[0] OR fieldLabel (Recipe fills)
  const label1 = (action1.args?.[0]?.toString() || (action1 as any).fieldLabel || '').toLowerCase().trim();
  const label2 = (action2.args?.[0]?.toString() || (action2 as any).fieldLabel || '').toLowerCase().trim();

  // Get values
  const val1 = (action1.args?.[1] || (action1 as any).value || '').toString();
  const val2 = (action2.args?.[1] || (action2 as any).value || '').toString();

  // Normalize common field names (pw -> password, user -> username)
  const normalizeFieldName = (name: string): string => {
    const n = name.toLowerCase().trim();
    if (['pw', 'pwd', 'passwd', 'pass'].includes(n)) return 'password';
    if (['user', 'uname', 'usr'].includes(n)) return 'username';
    if (['mail', 'e-mail'].includes(n)) return 'email';
    return n;
  };

  const norm1 = normalizeFieldName(label1);
  const norm2 = normalizeFieldName(label2);

  // Same normalized label
  if (norm1 && norm2 && norm1 === norm2) return true;

  const timeDiff = Math.abs((action1.timestamp || 0) - (action2.timestamp || 0));

  if (timeDiff < 5000) {
    // Same value
    if (val1 && val2 && val1 === val2) return true;
    // One contains other (partial typing)
    if (val1 && val2 && (val1.includes(val2) || val2.includes(val1))) return true;
    // Label equals value (Recipe bug where label was the typed value)
    if (label1 && val2 && label1 === val2.toLowerCase()) return true;
    if (label2 && val1 && label2 === val1.toLowerCase()) return true;
    // One label is a value-like string
    if (looksLikeFieldValue(label1) && (id2 || !looksLikeFieldValue(label2))) return true;
    if (looksLikeFieldValue(label2) && (id1 || !looksLikeFieldValue(label1))) return true;
  }

  return false;
};

/**
 * Deduplicate actions for display (fills with same field)
 * PURE FUNCTION: Returns NEW array, NEVER modifies input
 */
export const getDisplayActions = (actions: RecordedAction[]): RecordedAction[] => {
  if (!actions || actions.length === 0) return [];

  const result: { action: RecordedAction; originalIndex: number }[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Check for fills from BOTH CDP (qword='Fill') AND Recipe (type='fill')
    if (isFillAction(action)) {
      const existingIndex = result.findIndex(item => areSameFillField(item.action, action));

      if (existingIndex !== -1) {
        const existing = result[existingIndex];
        const existingId = getFieldIdentity(existing.action);
        const newId = getFieldIdentity(action);
        // Check BOTH args[1] (CDP) AND value property (Recipe)
        const existingVal = (existing.action.args?.[1] || (existing.action as any).value || '').toString();
        const newVal = (action.args?.[1] || (action as any).value || '').toString();

        // Keep better one: has identity, longer value, or later timestamp
        // CRITICAL: Always prefer the one with actual value (for passwords)
        const shouldReplace =
          (newVal.length > 0 && existingVal.length === 0) ||  // New has value, existing empty
          (!existingId && newId) ||
          (newVal.length > existingVal.length) ||
          (action.timestamp > existing.action.timestamp && newVal.length >= existingVal.length);

        if (shouldReplace) {
          result[existingIndex] = { action, originalIndex: i };
        }
        continue;
      }

      result.push({ action, originalIndex: i });
    } else {
      result.push({ action, originalIndex: i });
    }
  }

  result.sort((a, b) => a.originalIndex - b.originalIndex);
  return result.map(item => item.action);
};

/**
 * Get improved description for display
 */
export const getDisplayDescription = (action: RecordedAction): string => {
  if (!action) return '';

  const qword = action.qword || action.type?.toUpperCase() || 'ACTION';
  let description = action.description || '';
  const betterLabel = getDisplayLabel(action);

  // If description contains generic "element", replace it
  if (description.includes('"element"') || description.includes("'element'")) {
    description = description.replace(/"element"|'element'/g, `"${betterLabel}"`);
  }

  // If label is still "element", try harder
  if (betterLabel === 'element' || description.includes('Click "element"')) {
    const sel = action.selectorObj || (action as any).raw?.selectorObj || {};
    const element = (action as any).element || (action as any).raw?.element || {};
    const role = sel.role || element.role;
    const tag = sel.tagName || element.tagName || (action as any).raw?.tag;

    if (role) {
      description = `Click ${role}${tag ? ' (' + tag + ')' : ''}`;
    } else if (tag && tag !== 'element') {
      description = `Click ${tag}`;
    }
  }

  // If no description, build one
  if (!description || description === qword) {
    if (qword === 'Fill') {
      const value = action.displayArgs?.[1] || action.args?.[1] || '';
      const displayVal = typeof value === 'string' && value.length > 20 ? value.substring(0, 20) + '...' : value;
      description = `Fill "${betterLabel}": "${displayVal}"`;
    } else if (qword === 'GoTo') {
      description = `Navigate to ${action.args?.[0] || (action as any).url || ''}`;
    } else {
      description = `${qword.replace(/([A-Z])/g, ' $1').trim()} "${betterLabel}"`;
    }
  }

  return description;
};
