/**
 * Core types for the Playwright Recorder module.
 * Extracted from PlaywrightRecorderPage.tsx for shared use across recorder components.
 */

import { ConfidenceLevel } from '@/modules/recorder/components/confidence';

/**
 * Selector object describing how to find an element on the page.
 * Contains multiple strategies for robust element location.
 */
export interface SelectorObj {
  selector?: string;
  playwright?: string;
  text?: string;
  role?: string;
  tagName?: string;
  tag?: string;
  testId?: string;
  dataTestId?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  title?: string;
  innerText?: string;
  inputType?: string;
  elementIndex?: number;
  /** Manual override selector set by user when automation fails */
  manualOverride?: string;
  /** Optimized selector saved after successful test run (Lock Locators) */
  optimizedSelector?: string;
  optimizedAt?: string;
  optimizedSource?: string;
  /** Fallback selectors for retry */
  fallbacks?: Array<{ playwright?: string; selector?: string }>;
  /** Internal normalization flag */
  _normalized?: boolean;
  _originalText?: string;
  /** Allow additional properties from backend/extension */
  [key: string]: unknown;
}

export interface StepConfidence {
  score: number;
  level: ConfidenceLevel;
  reasons?: string[];
  deductions?: string[];
  recommendation?: string | null;
}

export interface MatchAnalysis {
  totalMatches: number;
  usedPosition: number;
  matchDetails?: Array<{
    position: number;
    text: string;
    context: string | null;
  }>;
}

export interface RecordedAction {
  id: string;
  qword: string;
  args: string[];
  displayArgs?: string[];
  description: string;
  timestamp: number;
  selectorObj?: SelectorObj;
  selector?: string | SelectorObj;
  type?: string;
  value?: string; // Fill value for input steps
  // Confidence system fields
  confidence?: StepConfidence;
  matchAnalysis?: MatchAnalysis;
}

export interface Suggestion {
  type: string;
  qword: string;
  args: string[];
  description: string;
  element: string;
  category: string;
  selector?: string;
  selectorObj?: SelectorObj;
  inputType?: string; // 'text', 'email', 'password', 'tel', etc.
  count?: number; // For "X FOUND" badge
}

export interface SuggestResult {
  suggestions: Suggestion[];
  categories: Record<string, Suggestion[]>;
  counts: Record<string, number>;
  timing: string;
  total: number;
}

/**
 * A test step as stored in a test case. Extends RecordedAction fields
 * but may include additional metadata from the test management system.
 */
export interface TestStep {
  qword?: string;
  selector?: string;
  selectorObj?: SelectorObj;
  args?: string[];
  description?: string;
  expectedResult?: string;
  type?: string;
  [key: string]: unknown;
}

export interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  steps: TestStep[];
  folderId?: string;
  tags?: string[];
  automationStatus?: 'none' | 'partial' | 'full';
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Result of a single step during test execution.
 * Returned from the backend and used by TestResultsDialog and useTestExecution.
 */
export interface StepResult {
  index: number;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | string;
  error?: string;
  screenshot?: string;
  workingSelector?: string;
  strategyType?: string;
  healed?: boolean;
  newSelector?: string;
  duration?: number;
  url?: string;
}

// Cross-origin user action - for manual selector input
export interface CrossOriginUserAction {
  id: string;
  type: 'click' | 'fill' | 'select' | 'wait';
  findBy: 'text' | 'css' | 'xpath' | 'testId' | 'coords';
  selector: string;
  coords?: { x: number; y: number };
  value?: string;
  description?: string;
}
