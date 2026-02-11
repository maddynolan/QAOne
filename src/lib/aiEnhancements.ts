/**
 * AI Enhancements API Client — Independent Module
 * ================================================
 * 
 * Thin API wrapper for the backend AI Enhancements service.
 * Provides: false positive persistence, flaky step detection, AI failure explanation.
 * 
 * All methods are fail-safe — return sensible defaults if backend is unreachable.
 * Designed to be used alongside (not replace) the existing failureClassification.ts.
 * 
 * The existing no-code UX (classifyFailure + manual flag/fix buttons) works
 * exactly as before. These functions ADD optional persistence and AI insights.
 */

import { API_BASE_URL } from '@/lib/api-config';

const API_PREFIX = '/api/ai/enhancements';

// ============================================================================
// Types — match backend response shapes exactly
// ============================================================================

export interface FalsePositiveFlag {
  step_id: string;
  step_index: number;
  step_label: string;
  screenshot?: string | null;
  reason?: string | null;
  flagged_at: string;
  flagged_by: string;
  resolved: boolean;
  resolved_at?: string | null;
}

export interface FlakyStepInfo {
  step_id: string;
  step_label: string;
  flakiness_score: number;
  is_flaky: boolean;
  total_runs: number;
  pass_count: number;
  fail_count: number;
  heal_count: number;
  last_status: string;
  last_error?: string | null;
}

export interface FixOption {
  fix_id: string;
  title: string;
  description: string;
  fix_type: string;      // update_selector, add_wait, skip_step, mark_false_positive, retry, quarantine
  confidence: number;     // 0.0-1.0
  auto_applicable: boolean;
  details: Record<string, any>;
}

export interface FailureExplanation {
  step_id: string;
  step_label: string;
  failure_type: string;           // couldnt_find_it, found_wrong_one, page_not_ready, sometimes_works
  plain_explanation: string;       // One sentence, no jargon
  technical_detail: string;        // For advanced users (collapsible)
  root_cause: string;
  confidence: number;
  fix_options: FixOption[];
  is_known_flaky: boolean;
  flakiness_score: number;
  was_previously_flagged: boolean;
  ai_enhanced: boolean;            // true if AI key was available
}

export interface EnhancementsStatus {
  services: {
    false_positive_persistence: { available: boolean; requires_ai: boolean };
    flaky_step_detection: { available: boolean; requires_ai: boolean };
    ai_failure_explanation: { available: boolean; requires_ai: boolean; note: string };
  };
  note: string;
}

// ============================================================================
// HTTP Helper — all calls fail-safe
// ============================================================================

function getBaseUrl(): string {
  // Always use the central API_BASE_URL (Railway production or env override)
  // This ensures desktop and web apps both reach the same backend
  return API_BASE_URL;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const url = `${getBaseUrl()}${API_PREFIX}${path}`;
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
    // Fail silently — AI enhancements are optional
    console.warn(`[AI Enhancements] ${path} unavailable:`, err);
    return null;
  }
}

// ============================================================================
// FALSE POSITIVE PERSISTENCE
// ============================================================================

/**
 * Save a false-positive flag (persists across sessions).
 * Call this when user clicks "Not a real failure" on a step.
 */
export async function saveFalsePositive(params: {
  test_id: string;
  step_id: string;
  step_index: number;
  step_label: string;
  screenshot?: string | null;
  reason?: string | null;
}): Promise<boolean> {
  const result = await apiFetch<{ success: boolean }>('/false-positives', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result?.success ?? false;
}

/**
 * Get all false-positive flags for a test/recording.
 * Call on page load to restore flags from previous sessions.
 */
export async function getFalsePositives(testId: string): Promise<FalsePositiveFlag[]> {
  const result = await apiFetch<{ test_id: string; flags: FalsePositiveFlag[]; count: number }>(
    `/false-positives/${encodeURIComponent(testId)}`
  );
  return result?.flags ?? [];
}

/**
 * Remove a false-positive flag (user clicks "Unflag").
 */
export async function removeFalsePositive(testId: string, stepId: string): Promise<boolean> {
  const result = await apiFetch<{ success: boolean }>(
    `/false-positives/${encodeURIComponent(testId)}/${encodeURIComponent(stepId)}`,
    { method: 'DELETE' }
  );
  return result?.success ?? false;
}

/**
 * Mark a false-positive flag as resolved (step was fixed).
 */
export async function resolveFalsePositive(testId: string, stepId: string): Promise<boolean> {
  const result = await apiFetch<{ success: boolean }>(
    `/false-positives/${encodeURIComponent(testId)}/${encodeURIComponent(stepId)}/resolve`,
    { method: 'POST' }
  );
  return result?.success ?? false;
}

/**
 * Analytics: Get steps most frequently flagged as false positives.
 */
export async function getMostFlaggedSteps(limit: number = 20): Promise<Array<{ step_id: string; label: string; flag_count: number }>> {
  const result = await apiFetch<{ most_flagged: Array<{ step_id: string; label: string; flag_count: number }> }>(
    `/false-positives-analytics/most-flagged?limit=${limit}`
  );
  return result?.most_flagged ?? [];
}

// ============================================================================
// FLAKY STEP DETECTION
// ============================================================================

/**
 * Record step results from a completed test run.
 * Call this after each test run completes so the tracker can build history.
 */
export async function recordStepResults(params: {
  test_id: string;
  run_id: string;
  step_results: Array<{
    step_id?: string;
    actionId?: string;
    index: number;
    label?: string;
    description?: string;
    status: string;
    error?: string;
    duration_ms?: number;
    healed?: boolean;
  }>;
}): Promise<boolean> {
  const result = await apiFetch<{ success: boolean }>('/flaky-steps/record', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result?.success ?? false;
}

/**
 * Get flaky step analysis for a test.
 */
export async function getFlakySteps(testId: string): Promise<FlakyStepInfo[]> {
  const result = await apiFetch<{ test_id: string; flaky_steps: FlakyStepInfo[]; total_flaky: number }>(
    `/flaky-steps/${encodeURIComponent(testId)}`
  );
  return result?.flaky_steps ?? [];
}

/**
 * Get execution history for a specific step.
 */
export async function getStepHistory(testId: string, stepId: string): Promise<Array<Record<string, any>>> {
  const result = await apiFetch<{ history: Array<Record<string, any>> }>(
    `/flaky-steps/${encodeURIComponent(testId)}/${encodeURIComponent(stepId)}/history`
  );
  return result?.history ?? [];
}

// ============================================================================
// AI FAILURE EXPLANATION — Multi-Fix Options
// ============================================================================

/**
 * Get AI-enhanced failure explanation with multiple fix options.
 * 
 * Works WITH or WITHOUT AI API key:
 * - Without AI: Returns basic classification + standard fix options
 * - With AI: Returns enhanced explanation + AI-suggested fix
 * 
 * Always returns a usable result — never throws.
 */
export async function explainFailure(params: {
  test_id: string;
  step_id: string;
  step_index?: number;
  step_label?: string;
  error_message: string;
  step_info?: Record<string, any>;
  screenshot_b64?: string | null;
  dom_snapshot?: string | null;
  console_logs?: string[] | null;
  previous_steps?: Array<Record<string, any>> | null;
}): Promise<FailureExplanation> {
  const result = await apiFetch<FailureExplanation>('/explain-failure', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // Always return something useful — fallback if backend unreachable
  if (!result) {
    return {
      step_id: params.step_id,
      step_label: params.step_label || '',
      failure_type: 'couldnt_find_it',
      plain_explanation: 'Could not analyze this failure — backend may be unavailable.',
      technical_detail: '',
      root_cause: 'unknown',
      confidence: 0,
      fix_options: [
        {
          fix_id: 'pick_element',
          title: 'Click the correct element',
          description: 'Open the element picker and click the right element on the page.',
          fix_type: 'update_selector',
          confidence: 0.95,
          auto_applicable: false,
          details: {},
        },
        {
          fix_id: 'skip_step',
          title: 'Skip this step',
          description: 'Skip and continue with the rest of the test.',
          fix_type: 'skip_step',
          confidence: 0.3,
          auto_applicable: true,
          details: {},
        },
      ],
      is_known_flaky: false,
      flakiness_score: 0,
      was_previously_flagged: false,
      ai_enhanced: false,
    };
  }

  return result;
}

/**
 * Batch explain multiple failures from a single test run.
 */
export async function explainFailuresBatch(
  failures: Array<Parameters<typeof explainFailure>[0]>
): Promise<FailureExplanation[]> {
  const result = await apiFetch<{ explanations: FailureExplanation[] }>(
    '/explain-failure/batch',
    { method: 'POST', body: JSON.stringify(failures) }
  );
  return result?.explanations ?? [];
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Check which AI enhancement services are available.
 */
export async function getEnhancementsStatus(): Promise<EnhancementsStatus | null> {
  return apiFetch<EnhancementsStatus>('/status');
}
