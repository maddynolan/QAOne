export interface TestCase {
  id: string;
  name: string;
  status: string;
  folder_id?: string;
  folder_name?: string;
  steps?: TestStep[];
  created_at?: string;
  updated_at?: string;
  priority?: string;
  tags?: string[];
}

export interface TestStep {
  id?: string;
  step_number: number;
  action: string;
  target?: string;
  selector?: string;
  value?: string;
  expected_result?: string;
  status?: 'passed' | 'failed' | 'skipped' | 'pending';
  error_message?: string;
  screenshot?: string;
  duration_ms?: number;
}

export interface TestRun {
  id: string;
  test_case_id: string;
  test_name?: string;
  status: 'passed' | 'failed' | 'running' | 'error';
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  steps_total?: number;
  steps_passed?: number;
  steps_failed?: number;
  results?: TestStepResult[];
  environment?: string;
}

export interface TestStepResult {
  step_number: number;
  action: string;
  target?: string;
  selector?: string;
  status: 'passed' | 'failed' | 'skipped';
  error_message?: string;
  expected?: string;
  actual?: string;
  screenshot?: string;
  duration_ms?: number;
  healed?: boolean;
  healing_details?: string;
}

export interface Defect {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  assignee?: string;
  test_case_id?: string;
  created_at?: string;
  url?: string;
}

export interface AccessibilityIssue {
  id: string;
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  element?: string;
  suggested_fix?: string;
  wcag_criterion?: string;
}

export interface AccessibilityScanResult {
  scan_id: string;
  url: string;
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issues: AccessibilityIssue[];
  timestamp?: string;
}

export interface ExplorationResult {
  session_id: string;
  url: string;
  pages_discovered: number;
  pages: ExploredPage[];
  defects: ExplorationDefect[];
  forms: ExploredForm[];
  duration_ms?: number;
}

export interface ExploredPage {
  url: string;
  title: string;
  status_code?: number;
  links_count?: number;
}

export interface ExplorationDefect {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  url: string;
  element?: string;
}

export interface ExploredForm {
  url: string;
  action?: string;
  method?: string;
  fields: string[];
}

export interface DashboardMetrics {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  pass_rate: number;
  total_runs: number;
  recent_runs: number;
  defects_open: number;
  defects_closed: number;
}

export interface ApiTestResult {
  status_code: number;
  response_time_ms: number;
  headers: Record<string, string>;
  body: unknown;
  assertions?: ApiAssertionResult[];
}

export interface ApiAssertionResult {
  type: string;
  passed: boolean;
  expected: string;
  actual: string;
  message?: string;
}
