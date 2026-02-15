/**
 * Test Repository Types
 *
 * Shared type definitions for the Test Repository module including
 * interfaces for test suites, releases, defects, runs, plans, folders,
 * test cases, and tree structures.
 */

// ═══════════════════════════════════════════════════════════════════════════
// SUITE, RELEASE, DEFECT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCaseIds: string[];
  folderId?: string;
  type?: 'smoke' | 'regression' | 'functional' | 'integration' | 'e2e' | 'sanity';
  schedule?: 'daily' | 'weekly' | 'on-demand';
  owner?: string;
  tags?: string[];
  executionOrder?: 'sequential' | 'parallel';
  estimatedDuration?: number; // in minutes
  status?: 'active' | 'inactive' | 'archived';
  lastRun?: {
    date: string;
    passed: number;
    failed: number;
    total: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface Release {
  id: string;
  name: string;
  version?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  releaseDate?: string;
  planIds?: string[]; // Link to test plans
  status: 'planning' | 'active' | 'testing' | 'completed' | 'released' | 'cancelled';
  environment?: string;
  suiteIds: string[];
  owner?: string;
  notes?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt?: string;
}

// Standard Defect/Bug interface
export interface Defect {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'major' | 'minor' | 'trivial';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'open' | 'in-progress' | 'fixed' | 'verified' | 'closed' | 'reopened' | 'deferred';
  type?: 'bug' | 'enhancement' | 'regression' | 'performance' | 'security' | 'ui';
  environment?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  assignedTo?: string;
  reporter?: string;
  linkedTestCaseIds?: string[];
  linkedRunIds?: string[];
  affectedVersion?: string;
  fixVersion?: string;
  resolution?: string;
  rootCause?: string;
  component?: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface StepResult {
  stepIndex: number;
  stepName: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration?: number;
  error?: string;
  screenshot?: string;
  timestamp?: string;
}

export interface TestRun {
  id: string;
  name: string;
  testCaseId?: string;       // Single test case (legacy)
  testCaseIds?: string[];    // Multiple test cases
  suiteId?: string;
  releaseId?: string;
  planId?: string;
  mode: 'manual' | 'automated';
  executionMode?: 'sequential' | 'parallel';  // How to run multiple tests
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'aborted';
  startTime: string;
  endTime?: string;
  duration?: number;
  executedBy?: string;
  assignedTo?: string;
  environment?: string;
  buildVersion?: string;
  browser?: string;
  notes?: string;
  defectIds?: string[];      // Linked defects
  tags?: string[];
  results?: {
    passed: number;
    failed: number;
    skipped: number;
    blocked?: number;
    total?: number;
  };
  // Per-test results when running multiple tests
  testResults?: Array<{
    testCaseId: string;
    testName: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    stepResults?: StepResult[];
    duration?: number;
    errorMessage?: string;
  }>;
  stepResults?: StepResult[];  // For single test runs
  logs?: string[];
  errorMessage?: string;
  failedStep?: number;
  currentTestIndex?: number;  // Track which test is running in multi-test run
  // Dynamic property for manual execution step results (keyed by test case ID)
  manualStepResults?: Record<string, StepResult[]>;
}

export interface TestPlan {
  id: string;
  name: string;
  description?: string;
  releaseId?: string;
  suiteIds: string[];
  testCaseIds: string[];
  status: 'draft' | 'ready' | 'in-progress' | 'completed' | 'archived';
  environment?: string;
  assignedTo?: string;
  owner?: string;
  startDate?: string;
  endDate?: string;
  scope?: string;
  objectives?: string;
  entryCriteria?: string;
  exitCriteria?: string;
  resources?: string[];
  risks?: string;
  type?: 'regression' | 'release' | 'sprint' | 'feature' | 'smoke';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  lastRun?: {
    date: string;
    passed: number;
    failed: number;
    blocked: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FOLDER & TEST CASE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TestFolder {
  id: string;
  name: string;
  parentId: string | null;
  children: string[]; // folder IDs
  testCases: string[]; // test case IDs
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  folderId: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'draft' | 'ready' | 'approved' | 'deprecated';
  type?: 'functional' | 'regression' | 'smoke' | 'integration' | 'e2e' | 'performance' | 'security' | 'accessibility' | 'usability';
  automationStatus?: 'none' | 'partial' | 'full' | 'automated';
  lastResult?: 'passed' | 'failed' | 'skipped' | 'blocked';
  lastRun?: string;
  tags?: string[];
  starred?: boolean;
  steps?: any[];
  // Test metadata
  preconditions?: string;
  expectedResult?: string;
  testData?: string;
  environment?: string;
  estimatedDuration?: number; // in minutes
  // Assignment
  assignedTo?: string;
  createdBy?: string;
  reviewedBy?: string;
  // Linked items
  linkedRequirementIds?: string[];
  linkedDefectIds?: string[];
  suiteIds?: string[];
  // Execution tracking
  executionCount?: number;
  passCount?: number;
  failCount?: number;
  // Other data
  unified_data?: {
    steps?: any[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TREE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TreeNode {
  id: string;
  type: 'folder' | 'test';
  name: string;
  data: TestFolder | TestCase;
  children?: TreeNode[];
  expanded?: boolean;
  depth: number;
}

export interface TreeItemProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (id: string) => void;
  onDragStart: (e: React.DragEvent, node: TreeNode) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetNode: TreeNode) => void;
  onContextMenu: (node: TreeNode) => void;
  expandedFolders: Set<string>;
  onRename?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onDuplicate?: (node: TreeNode) => void;
  testCases?: TestCase[];  // Pass test cases to calculate folder counts
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT FOLDERS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_FOLDERS: TestFolder[] = [
  { id: 'root', name: 'Test Repository', parentId: null, children: ['smoke', 'regression', 'integration', 'e2e'], testCases: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'smoke', name: '🔥 Smoke Tests', parentId: 'root', children: [], testCases: [], color: '#ef4444', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'regression', name: '🔄 Regression', parentId: 'root', children: [], testCases: [], color: '#f59e0b', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'integration', name: '🔗 Integration', parentId: 'root', children: [], testCases: [], color: '#10b981', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'e2e', name: '🎯 End-to-End', parentId: 'root', children: [], testCases: [], color: '#3b82f6', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
