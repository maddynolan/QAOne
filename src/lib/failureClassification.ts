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
