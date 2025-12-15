import { TestRunResult } from './test-execution-service';

export interface TestRunData {
  run_id: string;
  org_id: string;
  project_id: string;
  test_name?: string;
  test_cases: Array<{
    case_id: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    screenshots?: string[];
    logs?: string[];
    step_number?: number;
  }>;
  metadata: {
    environment: string;
    browser: string;
    timestamp: string;
    duration: number;
    failed_step?: number;
    error_message?: string;
    screenshot_path?: string;
  };
}

const STORAGE_KEY = 'qaai_test_results';

export class ResultsIngestionService {
  private results: Map<string, TestRunData> = new Map();

  constructor() {
    // Load from localStorage on initialization
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.forEach((item: TestRunData) => {
          this.results.set(item.run_id, item);
        });
        console.log(`[ResultsService] Loaded ${this.results.size} results from storage`);
      }
    } catch (e) {
      console.error('[ResultsService] Failed to load from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.results.values());
      // Keep only last 100 results
      const trimmed = data.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('[ResultsService] Failed to save to storage:', e);
    }
  }

  async ingestResults(runData: TestRunData): Promise<void> {
    // Store the results
    this.results.set(runData.run_id, runData);
    
    // Persist to localStorage
    this.saveToStorage();
    
    console.log(`[ResultsService] Ingested results for run ${runData.run_id}:`, runData);
  }

  getResults(runId: string): TestRunData | undefined {
    return this.results.get(runId);
  }

  getAllResults(): TestRunData[] {
    return Array.from(this.results.values());
  }
  
  clearResults(): void {
    this.results.clear();
    localStorage.removeItem(STORAGE_KEY);
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
