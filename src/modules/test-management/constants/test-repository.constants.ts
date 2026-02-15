/**
 * Test Repository Constants
 *
 * Tab definitions, status mappings, priority orderings, and
 * defect status workflow for the Test Repository page.
 */

import {
  FolderTree, Layers, Target, Rocket, PlayCircle, Bug,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface TabDefinition {
  id: string;
  label: string;
  icon: typeof FolderTree;
  desc: string;
  highlight?: boolean;
}

/**
 * Build the tab definitions with dynamic counts from stats.
 */
export function buildTabDefinitions(stats: {
  totalTests: number;
  suites: number;
  plans: number;
  releases: number;
  runs: number;
  defects: number;
  openDefects: number;
}): (TabDefinition & { count: number })[] {
  return [
    { id: 'repository', label: 'Test Cases', icon: FolderTree, count: stats.totalTests, desc: 'All test cases' },
    { id: 'suites', label: 'Suites', icon: Layers, count: stats.suites, desc: 'Group related tests' },
    { id: 'plans', label: 'Plans', icon: Target, count: stats.plans, desc: 'Execution plans' },
    { id: 'releases', label: 'Releases', icon: Rocket, count: stats.releases, desc: 'Sprint/version' },
    { id: 'runs', label: 'Runs', icon: PlayCircle, count: stats.runs, desc: 'Execution history' },
    { id: 'defects', label: 'Defects', icon: Bug, count: stats.defects, desc: 'Bug tracking', highlight: stats.openDefects > 0 },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// PRIORITY ORDER
// ═══════════════════════════════════════════════════════════════════════════

export const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ═══════════════════════════════════════════════════════════════════════════
// DEFECT STATUS WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

/** Maps a defect status to its next logical status in the workflow. */
export const DEFECT_NEXT_STATUS: Record<string, string> = {
  'new': 'open',
  'open': 'in-progress',
  'in-progress': 'fixed',
  'fixed': 'verified',
  'verified': 'closed',
  'closed': 'reopened',
  'reopened': 'in-progress',
  'deferred': 'open',
};

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH PLACEHOLDER MAP
// ═══════════════════════════════════════════════════════════════════════════

export const SEARCH_PLACEHOLDERS: Record<string, string> = {
  repository: 'Search test cases...',
  suites: 'Search suites...',
  plans: 'Search plans...',
  releases: 'Search releases...',
  defects: 'Search defects...',
  runs: 'Search runs...',
};

// ═══════════════════════════════════════════════════════════════════════════
// BATCH SIZE FOR LAZY LOADING
// ═══════════════════════════════════════════════════════════════════════════

export const LAZY_BATCH_SIZE = 100;
