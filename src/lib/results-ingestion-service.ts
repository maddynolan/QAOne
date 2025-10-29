import { TestRunResult } from './test-execution-service';

export interface TestRunData {
  run_id: string;
  org_id: string;
  project_id: string;
  test_cases: Array<{
    case_id: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    screenshots?: string[];
    logs?: string[];
  }>;
  metadata: {
    environment: string;
    browser: string;
    timestamp: string;
    duration: number;
  };
}

export class ResultsIngestionService {
  private results: Map<string, TestRunData> = new Map();

  async ingestResults(runData: TestRunData): Promise<void> {
    // Store the results
    this.results.set(runData.run_id, runData);
    
    // In a real implementation, this would:
    // 1. Validate the data
    // 2. Store in database
    // 3. Trigger notifications
    // 4. Update analytics
    // 5. Send to external systems (Jira, Slack, etc.)
    
    console.log(`Ingested results for run ${runData.run_id}:`, runData);
  }

  getResults(runId: string): TestRunData | undefined {
    return this.results.get(runId);
  }

  getAllResults(): TestRunData[] {
    return Array.from(this.results.values());
  }

  getResultsByProject(projectId: string): TestRunData[] {
    return this.getAllResults().filter(result => result.project_id === projectId);
  }

  getResultsByOrg(orgId: string): TestRunData[] {
    return this.getAllResults().filter(result => result.org_id === orgId);
  }

  // Analytics methods
  getProjectStats(projectId: string) {
    const results = this.getResultsByProject(projectId);
    
    const stats = {
      totalRuns: results.length,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      averageDuration: 0,
      successRate: 0
    };

    if (results.length === 0) return stats;

    results.forEach(run => {
      run.test_cases.forEach(testCase => {
        stats.totalTests++;
        switch (testCase.status) {
          case 'passed':
            stats.passedTests++;
            break;
          case 'failed':
            stats.failedTests++;
            break;
          case 'skipped':
            stats.skippedTests++;
            break;
        }
      });
    });

    stats.averageDuration = results.reduce((sum, run) => sum + run.metadata.duration, 0) / results.length;
    stats.successRate = stats.totalTests > 0 ? (stats.passedTests / stats.totalTests) * 100 : 0;

    return stats;
  }

  getOrgStats(orgId: string) {
    const results = this.getResultsByOrg(orgId);
    
    const stats = {
      totalRuns: results.length,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      averageDuration: 0,
      successRate: 0,
      projects: new Set<string>()
    };

    if (results.length === 0) return stats;

    results.forEach(run => {
      stats.projects.add(run.project_id);
      run.test_cases.forEach(testCase => {
        stats.totalTests++;
        switch (testCase.status) {
          case 'passed':
            stats.passedTests++;
            break;
          case 'failed':
            stats.failedTests++;
            break;
          case 'skipped':
            stats.skippedTests++;
            break;
        }
      });
    });

    stats.averageDuration = results.reduce((sum, run) => sum + run.metadata.duration, 0) / results.length;
    stats.successRate = stats.totalTests > 0 ? (stats.passedTests / stats.totalTests) * 100 : 0;

    return {
      ...stats,
      projectCount: stats.projects.size
    };
  }
}

export const resultsIngestionService = new ResultsIngestionService();
