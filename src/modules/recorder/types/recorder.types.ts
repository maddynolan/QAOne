/**
 * Core types for the Playwright Recorder module.
 * Extracted from PlaywrightRecorderPage.tsx for shared use across recorder components.
 */

import { ConfidenceLevel } from '@/modules/recorder/components/confidence';

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
  selectorObj?: any;
  selector?: any;
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
  selectorObj?: any;
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

export interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  steps: any[];
  folderId?: string;
  tags?: string[];
  automationStatus?: 'none' | 'partial' | 'full';
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
