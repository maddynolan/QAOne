/**
 * Shared helper: manual override and locked selector (single source of truth).
 * Used by both PlaywrightRecorder and TestExecutor so override/locked checks
 * behave identically. No behavior change — only centralizes the selector source.
 *
 * See: docs/RECORD-PLAYBACK-AUDIT-SIMPLIFICATION.md (Section 5, 8)
 */

/**
 * Returns the user-specified manual override selector if set, else null.
 * Same as: action.manualOverride || action.selectorObj?.manualOverride
 * @param {object} action - Step/action object (may have manualOverride or selectorObj.manualOverride)
 * @returns {string|null}
 */
function getManualOverrideSelector(action) {
  if (!action) return null;
  const s = action.manualOverride || action.selectorObj?.manualOverride;
  return s != null && typeof s === 'string' ? s : null;
}

/**
 * Returns the locked (optimized) selector from "Lock Locators" if set, else null.
 * Same as: action.selectorObj?.optimizedSelector
 * @param {object} action - Step/action object (selectorObj.optimizedSelector)
 * @returns {string|null}
 */
function getLockedSelector(action) {
  if (!action?.selectorObj) return null;
  const s = action.selectorObj.optimizedSelector;
  return s != null && typeof s === 'string' ? s : null;
}

module.exports = {
  getManualOverrideSelector,
  getLockedSelector,
};
