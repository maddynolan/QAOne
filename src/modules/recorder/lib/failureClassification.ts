/**
 * Failure classification for Record & Playback — no-code UX.
 * Maps technical error strings to user-facing types and one-sentence messages.
 * See: docs/RECORD-PLAYBACK-FAILURES-FALSE-POSITIVES-NO-CODE.md
 */

export type FailureUserType =
  | 'couldnt_find_it'
  | 'found_wrong_one'
  | 'page_not_ready'
  | 'not_real_failure'
  | 'sometimes_works';

export interface ClassifiedFailure {
  type: FailureUserType;
  /** One-sentence plain-language message (no selectors, timeout, DOM). */
  message: string;
  /** Primary CTA key for UI. */
  primaryAction: 'click_correct_one' | 'wait_and_retry' | 'not_real_failure' | 'stabilize';
}

const LOWER = (s: string) => (s || '').toLowerCase();

/** Step label for messages, e.g. "Submit", "Login" — optional. */
function stepLabelForMessage(stepLabel?: string | null): string {
  const t = (stepLabel || '').trim();
  if (!t) return 'the item';
  if (t.length > 40) return `"${t.slice(0, 37)}…"`;
  return `"${t}"`;
}

/**
 * Classify a raw error (from backend/Playwright/TestExecutor) into a user type
 * and a single plain-language sentence. Never exposes selectors, timeout, or DOM.
 */
export function classifyFailure(
  rawError: string | null | undefined,
  stepLabel?: string | null
): ClassifiedFailure {
  const err = LOWER(rawError || '');
  const label = stepLabelForMessage(stepLabel);

  // Found the wrong one — multiple matches, wrong one clicked
  if (
    /multiple|several|more than one|ambiguous|wrong (element|one)|clicked the wrong|nth match|which one/i.test(err) ||
    /found \d+ (element|match)/i.test(err) ||
    /strict mode.*multiple/i.test(err)
  ) {
    return {
      type: 'found_wrong_one',
      message: `We found several options and clicked the wrong one. Please click the one you meant.`,
      primaryAction: 'click_correct_one',
    };
  }

  // Page wasn't ready — timeouts, slow load
  if (
    /timeout|timed out|exceeded|wasn't ready|not ready|still loading|wait.*longer/i.test(err) ||
    /page.*load|load state|domcontentloaded|networkidle/i.test(err) ||
    /waiting for|did not load within/i.test(err)
  ) {
    return {
      type: 'page_not_ready',
      message: `The page wasn't ready in time. We can wait longer and try again.`,
      primaryAction: 'wait_and_retry',
    };
  }

  // Couldn't find it — 0 elements, hidden, disabled, covered
  if (
    /no element|0 element|zero element|element not found|locator.*resolved|couldn't find|can't find|cannot find/i.test(err) ||
    /selector.*match|no match|did not match|not found/i.test(err) ||
    /hidden|disabled|covered|not visible|not attached|detached/i.test(err) ||
    /not in the viewport|outside.*viewport/i.test(err)
  ) {
    return {
      type: 'couldnt_find_it',
      message: `We couldn't find ${label} on the page. It may have moved or the page may have changed.`,
      primaryAction: 'click_correct_one',
    };
  }

  // Optional: flaky (if we ever add a flaky hint in the error)
  if (/flak|intermittent|sometimes fail/i.test(err)) {
    return {
      type: 'sometimes_works',
      message: `This step has failed in some runs. You can make it stable or we can ask you at this step each time.`,
      primaryAction: 'stabilize',
    };
  }

  // Default: treat as "couldn't find it" so primary action is still "Click the correct one"
  return {
    type: 'couldnt_find_it',
    message: `We couldn't find ${label} on the page. It may have moved or the page may have changed.`,
    primaryAction: 'click_correct_one',
  };
}


// ============================================================================
// AI-ENHANCED CLASSIFICATION (additive — existing classifyFailure unchanged)
// ============================================================================
// These utilities pair with the aiEnhancements.ts API client.
// Import from here so failure classification stays the single source of truth.

/**
 * Map a FixOption.fix_type to a Lucide icon name.
 * Used by the failure card UI to render appropriate icons per fix option.
 */
export function fixTypeIcon(fixType: string): string {
  const icons: Record<string, string> = {
    update_selector: 'mouse-pointer-click',  // Click the correct element / new selector
    add_wait: 'clock',                       // Wait and retry
    retry: 'refresh-cw',                     // Retry this step
    skip_step: 'skip-forward',               // Skip this step
    mark_false_positive: 'flag',             // Not a real failure
    quarantine: 'shield-alert',              // Quarantine flaky step
    investigate: 'search',                   // Needs investigation
    update_assertion: 'check-circle',        // Fix assertion
    config_change: 'settings',               // Configuration change
  };
  return icons[fixType] || 'wrench';
}

/**
 * Map a FixOption.fix_type to a button variant for shadcn/ui.
 */
export function fixTypeVariant(fixType: string): 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' {
  switch (fixType) {
    case 'update_selector':
      return 'default';       // Primary — most common fix
    case 'add_wait':
    case 'retry':
      return 'secondary';
    case 'quarantine':
    case 'investigate':
    case 'update_assertion':
    case 'config_change':
      return 'outline';
    case 'skip_step':
    case 'mark_false_positive':
      return 'ghost';
    default:
      return 'outline';
  }
}

/**
 * Get a background color class for a flakiness score.
 */
export function flakyScoreColor(score: number): string {
  if (score >= 0.5) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (score >= 0.25) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (score > 0) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-green-500/20 text-green-400 border-green-500/30';
}

/**
 * Human-readable flaky label.
 */
export function flakyLabel(score: number, isFlaky: boolean): string {
  if (!isFlaky) return '';
  if (score >= 0.5) return 'Very Flaky';
  if (score >= 0.25) return 'Flaky';
  return 'Slightly Unstable';
}

/**
 * Map FailureExplanation.root_cause to a user-facing badge label + color.
 */
export function rootCauseBadge(rootCause: string): { label: string; className: string } {
  const badges: Record<string, { label: string; className: string }> = {
    element_changed: { label: 'Element Changed', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    timing_issue: { label: 'Timing Issue', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    app_bug: { label: 'App Bug', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    env_issue: { label: 'Environment', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    test_issue: { label: 'Test Issue', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  };
  return badges[rootCause] || { label: rootCause, className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
}
