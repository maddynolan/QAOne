/**
 * Test Execution Service
 * Handles execution of generated Playwright tests
 */

export interface TestExecutionResult {
  test_name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  duration: number;
  error?: string;
  screenshots: string[];
  logs: string[];
}

export interface TestExecutionResponse {
  status: 'success' | 'error';
  test_results: TestExecutionResult[];
  error?: string;
  test_file?: string;
  temp_dir?: string;
}

export interface TestRun {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  testCases: any[];
  results?: TestExecutionResult[];
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

export class TestExecutionService {
  private baseUrl: string;
  private testRuns: TestRun[] = [];

  constructor(baseUrl: string = 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  async runGeneratedTest(testCode: string, testName: string = 'generated_test'): Promise<TestExecutionResponse> {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout
      
      const response = await fetch(`${this.baseUrl}/tests/run-generated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_code: testCode,
          test_name: testName
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error running generated test:', error);
      if (error.name === 'AbortError') {
        throw new Error('Test execution timed out after 3 minutes');
      }
      throw new Error(`Failed to run test: ${error.message}`);
    }
  }

  async runTestSuite(testCodes: { name: string; code: string }[]): Promise<TestExecutionResponse[]> {
    const results: TestExecutionResponse[] = [];
    
    for (const test of testCodes) {
      try {
        const result = await this.runGeneratedTest(test.code, test.name);
        results.push(result);
      } catch (error) {
        results.push({
          status: 'error',
          test_results: [],
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Test Run Management Methods
  getAllTestRuns(): TestRun[] {
    // This is now handled by dataStorageService
    return [];
  }

  async createTestRun(name: string, testCases: any[]): Promise<TestRun> {
    const { dataStorageService } = await import('./data-storage');
    
    const testRun = await dataStorageService.createTestRun({
      name,
      status: 'pending',
      testCases,
      results: []
    });
    
    return testRun;
  }

  async executeTestRun(runId: string, orgId: string, projectId: string): Promise<TestRun> {
    const testRun = this.testRuns.find(run => run.id === runId);
    if (!testRun) {
      throw new Error('Test run not found');
    }

    testRun.status = 'running';
    
    try {
      // Execute each test case
      const results: TestExecutionResult[] = [];
      
      for (const testCase of testRun.testCases) {
        // Convert test case to Playwright code
        const testCode = this.convertTestCaseToCode(testCase);
        
        // Run the test
        const response = await this.runGeneratedTest(testCode, testCase.title);
        
        if (response.status === 'success') {
          results.push(...response.test_results);
        } else {
          results.push({
            test_name: testCase.title,
            status: 'failed',
            duration: 0,
            error: response.error || 'Test execution failed',
            screenshots: [],
            logs: ['Test execution failed']
          });
        }
      }
      
      testRun.results = results;
      testRun.status = 'completed';
      testRun.completedAt = new Date().toISOString();
      testRun.duration = results.reduce((sum, result) => sum + result.duration, 0);
      
    } catch (error) {
      testRun.status = 'failed';
      testRun.completedAt = new Date().toISOString();
      throw error;
    }
    
    return testRun;
  }

  private convertTestCaseToCode(testCase: any): string {
    // Convert test case to Playwright code
    const steps = testCase.steps || [];
    const stepCode = steps.map((step: any, index: number) => {
      const action = step.action.toLowerCase();
      const expected = step.expected || '';
      
      if (action.includes('navigate') || action.includes('goto')) {
        return `    await page.goto('https://www.saucedemo.com');`;
      } else if (action.includes('fill') && action.includes('username')) {
        return `    await page.fill('[data-test="username"]', 'standard_user');`;
      } else if (action.includes('fill') && action.includes('password')) {
        return `    await page.fill('[data-test="password"]', 'secret_sauce');`;
      } else if (action.includes('click') && action.includes('login')) {
        return `    await page.click('[data-test="login-button"]');`;
      } else if (action.includes('verify') || action.includes('expect')) {
        return `    await expect(page.locator('.inventory_container')).toBeVisible();`;
      } else {
        return `    // ${step.action}`;
      }
    }).join('\n');

    return `import { test, expect } from '@playwright/test';

test.describe('${testCase.title}', () => {
  test('${testCase.title}', async ({ page }) => {
${stepCode}
  });
});`;
  }
}

// Export singleton instance
export const testExecutionService = new TestExecutionService();