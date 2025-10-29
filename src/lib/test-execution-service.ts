// Test Execution Service - Frontend API Client
// This service communicates with the backend Playwright runner via API calls

export interface TestStep {
  action: string;
  data?: Record<string, any>;
  expected: string;
  locator_hints?: string[];
}

export interface TestCase {
  id: string;
  title: string;
  description?: string;
  priority: string;
  tags?: string[];
  steps: TestStep[];
}

export interface TestRunResult {
  case_id: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

export interface TestExecutionResponse {
  run_id: string;
  results: TestRunResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    success_rate: number;
    run_id: string;
  };
}

export interface TestRun {
  id: string;
  name: string;
  testCases: TestCase[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  results: TestRunResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

export class TestExecutionService {
  private baseUrl: string;
  private activeRuns: Map<string, TestRun> = new Map();

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async executeTests(
    orgId: string,
    projectId: string,
    testCases: TestCase[]
  ): Promise<TestExecutionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/tests/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: orgId,
          project_id: projectId,
          test_cases: testCases,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Test execution failed: ${errorData.detail || response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error executing tests:', error);
      throw error;
    }
  }

  async executeSingleTest(
    orgId: string,
    projectId: string,
    testCase: TestCase
  ): Promise<TestExecutionResponse> {
    return this.executeTests(orgId, projectId, [testCase]);
  }

  async createTestRun(name: string, testCases: TestCase[]): Promise<TestRun> {
    const run: TestRun = {
      id: `run_${Date.now()}`,
      name,
      testCases,
      status: 'pending',
      results: [],
      summary: {
        total: testCases.length,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    this.activeRuns.set(run.id, run);
    return run;
  }

  async executeTestRun(runId: string, orgId: string, projectId: string): Promise<TestRun> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    run.status = 'running';
    run.startTime = new Date();

    try {
      const response = await this.executeTests(orgId, projectId, run.testCases);
      
      run.results = response.results;
      run.status = 'completed';
      run.endTime = new Date();
      run.summary = this.calculateSummary(run);
      
    } catch (error) {
      run.status = 'failed';
      run.endTime = new Date();
      throw error;
    }

    return run;
  }

  getTestRun(runId: string): TestRun | undefined {
    return this.activeRuns.get(runId);
  }

  getAllTestRuns(): TestRun[] {
    return Array.from(this.activeRuns.values());
  }

  // Helper method to create a test case from form data
  createTestCaseFromForm(formData: any): TestCase {
    return {
      id: formData.id || crypto.randomUUID(),
      title: formData.title || 'Untitled Test',
      description: formData.description || '',
      priority: formData.priority || 'P2',
      tags: formData.tags || [],
      steps: formData.steps || [],
    };
  }

  // Helper method to validate test case
  validateTestCase(testCase: TestCase): string[] {
    const errors: string[] = [];

    if (!testCase.title.trim()) {
      errors.push('Test case title is required');
    }

    if (!testCase.steps || testCase.steps.length === 0) {
      errors.push('At least one test step is required');
    }

    testCase.steps.forEach((step, index) => {
      if (!step.action.trim()) {
        errors.push(`Step ${index + 1}: Action is required`);
      }
      if (!step.expected.trim()) {
        errors.push(`Step ${index + 1}: Expected result is required`);
      }
    });

    return errors;
  }

  private calculateSummary(run: TestRun) {
    const results = run.results;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const duration = run.endTime && run.startTime 
      ? run.endTime.getTime() - run.startTime.getTime()
      : 0;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      duration
    };
  }
}

// Export singleton instance
export const testExecutionService = new TestExecutionService();