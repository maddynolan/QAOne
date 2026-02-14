/**
 * AI Enhancements API Client — Chrome Extension Module
 * =====================================================
 *
 * Vanilla JS port of src/lib/aiEnhancements.ts for use in the extension sidepanel.
 * Provides: AI auto-fix, false positive persistence, manual assist (paste element / enter selector).
 *
 * All methods are fail-safe — return sensible defaults if backend is unreachable.
 * Uses getServerUrl() from api-config.js for the backend URL.
 */

const AI_API_PREFIX = '/api/ai/enhancements';

/**
 * Fail-safe fetch wrapper for AI enhancement endpoints.
 * Returns parsed JSON on success, null on any failure.
 */
async function aiApiFetch(path, options = {}) {
  try {
    const baseUrl = typeof getServerUrl === 'function' ? getServerUrl() : 'http://localhost:8000';
    const url = `${baseUrl}${AI_API_PREFIX}${path}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      console.warn(`[AI Enhancements] ${path} → ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`[AI Enhancements] ${path} unavailable:`, err.message);
    return null;
  }
}

// ============================================================================
// AUTO-FIX STEP — 4-layer AI healing chain
// ============================================================================

/**
 * Attempt to auto-fix a failed step using the AI healing chain.
 * Healing chain: Knowledge → Deterministic → Vision AI → OCR
 *
 * @param {Object} params
 * @param {string} params.test_id
 * @param {string} params.step_id
 * @param {number} params.step_index
 * @param {string} params.step_label
 * @param {string} params.failed_selector
 * @param {string} params.error_message
 * @param {Object} params.step_info
 * @param {string|null} [params.screenshot_b64]
 * @param {string|null} [params.page_url]
 * @returns {Promise<{success: boolean, fixed_selector?: string, strategy_used?: string, confidence: number, attempts: Array, message: string, needs_manual_fix: boolean}>}
 */
async function aiAutoFixStep(params) {
  const result = await aiApiFetch('/auto-fix-step', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result || {
    success: false,
    confidence: 0,
    attempts: [],
    message: 'Backend unreachable',
    needs_manual_fix: true,
  };
}

// ============================================================================
// FALSE POSITIVE PERSISTENCE
// ============================================================================

/**
 * Save a false-positive flag (persists across sessions).
 */
async function aiSaveFalsePositive(params) {
  const result = await aiApiFetch('/false-positives', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result?.success ?? false;
}

/**
 * Get all false-positive flags for a test/recording.
 */
async function aiGetFalsePositives(testId) {
  const result = await aiApiFetch(`/false-positives/${encodeURIComponent(testId)}`);
  return result?.flags ?? [];
}

/**
 * Remove a false-positive flag.
 */
async function aiRemoveFalsePositive(testId, stepId) {
  const result = await aiApiFetch(
    `/false-positives/${encodeURIComponent(testId)}/${encodeURIComponent(stepId)}`,
    { method: 'DELETE' }
  );
  return result?.success ?? false;
}

// ============================================================================
// MANUAL ASSIST — Paste Element / Enter Selector / Screenshot
// ============================================================================

const MANUAL_ASSIST_FALLBACK = {
  success: false,
  selectors: [],
  message: 'Backend unreachable — try entering a selector directly.',
};

/**
 * Manual assist: Parse pasted outerHTML from DevTools and generate selectors.
 */
async function aiManualAssistPasteElement(params) {
  const result = await aiApiFetch('/manual-assist', {
    method: 'POST',
    body: JSON.stringify({ mode: 'paste_element', ...params }),
  });
  return result || MANUAL_ASSIST_FALLBACK;
}

/**
 * Manual assist: Validate a user-entered CSS/XPath/text selector.
 */
async function aiManualAssistEnterSelector(params) {
  const result = await aiApiFetch('/manual-assist', {
    method: 'POST',
    body: JSON.stringify({ mode: 'enter_selector', ...params }),
  });
  return result || MANUAL_ASSIST_FALLBACK;
}

/**
 * Manual assist: Analyze a pasted screenshot to identify elements via Vision AI.
 */
async function aiManualAssistScreenshot(params) {
  const result = await aiApiFetch('/manual-assist', {
    method: 'POST',
    body: JSON.stringify({ mode: 'paste_screenshot', ...params }),
  });
  return result || MANUAL_ASSIST_FALLBACK;
}

// ============================================================================
// DETECT FALSE POSITIVE — Vision-based automatic detection
// ============================================================================

/**
 * Detect if a failed step is a false positive using vision AI.
 */
async function aiDetectFalsePositive(params) {
  const result = await aiApiFetch('/detect-false-positive', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result || {
    is_false_positive: false,
    confidence: 0,
    reason: 'Backend unreachable',
  };
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Check which AI enhancement services are available.
 */
async function aiGetEnhancementsStatus() {
  return aiApiFetch('/status');
}

// Export for sidepanel use
if (typeof self !== 'undefined') {
  self.aiAutoFixStep = aiAutoFixStep;
  self.aiSaveFalsePositive = aiSaveFalsePositive;
  self.aiGetFalsePositives = aiGetFalsePositives;
  self.aiRemoveFalsePositive = aiRemoveFalsePositive;
  self.aiManualAssistPasteElement = aiManualAssistPasteElement;
  self.aiManualAssistEnterSelector = aiManualAssistEnterSelector;
  self.aiManualAssistScreenshot = aiManualAssistScreenshot;
  self.aiDetectFalsePositive = aiDetectFalsePositive;
  self.aiGetEnhancementsStatus = aiGetEnhancementsStatus;
}
