/**
 * Test Repository Utility Functions
 *
 * Pure functions for computing automation status, checking test types,
 * and sorting/filtering test data. No React dependencies.
 */

import type { TestCase } from '../types/test-repository.types';
import { PRIORITY_ORDER } from '../constants/test-repository.constants';

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION STATUS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate automation status based on step coverage for a test case.
 * Returns 'full', 'partial', or 'none'.
 */
export function calculateAutomationStatus(tc: any): 'none' | 'partial' | 'full' {
  // First check if already has correct status saved
  if (tc.automationStatus === 'full' || tc.automationStatus === 'automated') {
    return 'full';
  }

  // Get steps from unified_data or steps array
  let steps = tc.unified_data?.steps || tc.steps || [];
  if (typeof tc.unified_data === 'string') {
    try {
      const parsed = JSON.parse(tc.unified_data);
      steps = parsed?.steps || steps;
    } catch (e) {
      // Failed to parse unified_data
    }
  }

  if (!steps || steps.length === 0) {
    return 'none';
  }

  // Count automated steps - must have REAL automation data:
  // - qword (GoTo, Fill, ClickText, etc.) WITH args, OR
  // - selectorObj (from recording), OR
  // - automationStatus explicitly set to 'recorded'
  const automatedSteps = steps.filter((s: any) => {
    if (s.qword && s.args && s.args.length > 0) return true;
    if (s.selectorObj && Object.keys(s.selectorObj).length > 0) return true;
    if (s.automationStatus === 'recorded') return true;
    return false;
  });

  if (automatedSteps.length === steps.length) return 'full';
  if (automatedSteps.length > 0) return 'partial';
  return 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// API TEST DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine if a test case is an API test based on tags, category, type, or unified_data.
 */
export function isApiTest(tc: TestCase): boolean {
  return tc.tags?.includes('api-testing') === true ||
    (tc as any).category === 'api' ||
    (tc as any).type === 'api' ||
    !!(tc.unified_data?.method && (tc.unified_data?.endpoint || tc.unified_data?.path));
}

// ═══════════════════════════════════════════════════════════════════════════
// SORTING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sort test cases by the given criteria.
 */
export function sortTestCases(tests: TestCase[], sortBy: 'name' | 'updated' | 'priority'): TestCase[] {
  return [...tests].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'priority') {
      return (PRIORITY_ORDER[a.priority || 'medium'] || 2) - (PRIORITY_ORDER[b.priority || 'medium'] || 2);
    }
    // Default: sort by updated
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}

/**
 * Sort test cases by most recently updated first, then by priority.
 */
export function prioritizeTestCases(tests: TestCase[]): TestCase[] {
  return [...tests].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (PRIORITY_ORDER[a.priority || 'medium'] || 2) - (PRIORITY_ORDER[b.priority || 'medium'] || 2);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRON DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if the application is running in Electron desktop app.
 */
export function isElectronApp(): boolean {
  return typeof window !== 'undefined' &&
    ((window as any).electronAPI?.isElectron === true || (window as any).platform?.isElectron === true);
}
