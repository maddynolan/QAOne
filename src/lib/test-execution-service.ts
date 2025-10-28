import { playwrightRunner, TestCase, TestRunResult } from './playwright-runner';

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
  private activeRuns: Map<string, TestRun> = new Map();

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

  async executeTestRun(runId: string): Promise<TestRun> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Test run ${runId} not found`);
    }

    run.status = 'running';
    run.startTime = new Date();

    try {
      await playwrightRunner.initialize();

      for (const testCase of run.testCases) {
        const result = await playwrightRunner.runTestCase(testCase);
        run.results.push(result);
      }

      await playwrightRunner.cleanup();
    } catch (error) {
      run.status = 'failed';
      throw error;
    }

    run.status = 'completed';
    run.endTime = new Date();
    run.summary = this.calculateSummary(run);

    return run;
  }

  getTestRun(runId: string): TestRun | undefined {
    return this.activeRuns.get(runId);
  }

  getAllTestRuns(): TestRun[] {
    return Array.from(this.activeRuns.values());
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

export const testExecutionService = new TestExecutionService();
