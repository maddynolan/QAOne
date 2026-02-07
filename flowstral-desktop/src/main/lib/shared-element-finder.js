/**
 * Shared element-finding logic for playback (Executor-style legacy find).
 * Used by TestExecutor so "find element" behavior is in one place; same order,
 * same timeouts. PlaywrightRecorder can adopt this later for full parity.
 *
 * See: docs/RECORD-PLAYBACK-AUDIT-SIMPLIFICATION.md (Section 6, 8)
 */

const { getManualOverrideSelector, getLockedSelector } = require('./override-and-locked');

/** Same as TestExecutor.normalizeSelector - for legacy selector from action */
function normalizeSelector(sel) {
  if (sel == null) return '';
  if (typeof sel === 'string') return sel;
  return sel.selector || sel.value || sel.css || sel.xpath || '';
}

/** Build Executor-style selector list (same order as TestExecutor._findElement) */
function buildExecutorSelectorList(action) {
  const selectorObj = action.selectorObj || {};
  const text = action.args?.[0] || selectorObj.text || '';
  const list = [];

  if (selectorObj.testId) list.push(`[data-testid="${selectorObj.testId}"]`);
  if (selectorObj.ariaLabel) list.push(`[aria-label="${selectorObj.ariaLabel}"]`);
  if (selectorObj.name) list.push(`[name="${selectorObj.name}"]`);
  if (selectorObj.id && !/^[a-f0-9]{8,}|^\d{6,}|^:r/.test(selectorObj.id)) {
    list.push(`#${selectorObj.id}`);
  }
  if (selectorObj.selector) list.push(selectorObj.selector);
  const actionSel = normalizeSelector(action.selector);
  if (actionSel) list.push(actionSel);
  if (text) list.push(`text="${text}"`);

  return list;
}

/**
 * Run Executor-style legacy find: try each selector in order with same visibility timeout.
 * @param {object} page - Playwright page
 * @param {object} action - Step/action (selectorObj, args, selector)
 * @param {object} options - { elementIndex: 0, visibilityTimeout: 2000 }
 * @returns {Promise<{ locator: object, strategy: object } | null>}
 */
async function runLegacyFindExecutor(page, action, options = {}) {
  const elementIndex = options.elementIndex ?? 0;
  const visibilityTimeout = options.visibilityTimeout ?? 2000;
  const getAtIndex = (locator) => (elementIndex === 0 ? locator.first() : locator.nth(elementIndex));

  const selectorsToTry = buildExecutorSelectorList(action);
  for (const selector of selectorsToTry) {
    try {
      const locator = getAtIndex(page.locator(selector));
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        const isVisible = await locator.isVisible({ timeout: visibilityTimeout }).catch(() => false);
        if (isVisible) {
          return { locator, strategy: { type: 'legacy-selector', value: selector } };
        }
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

module.exports = {
  normalizeSelector,
  buildExecutorSelectorList,
  runLegacyFindExecutor,
};
