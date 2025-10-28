import { resultsIngestionService } from './results-ingestion-service';

export interface AnalyticsData {
  totalRuns: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  successRate: number;
  averageDuration: number;
  trends: {
    daily: Array<{
      date: string;
      runs: number;
      tests: number;
      passed: number;
      failed: number;
      skipped: number;
    }>;
    weekly: Array<{
      week: string;
      runs: number;
      tests: number;
      passed: number;
      failed: number;
      skipped: number;
    }>;
    monthly: Array<{
      month: string;
      runs: number;
      tests: number;
      passed: number;
      failed: number;
      skipped: number;
    }>;
  };
  topFailingTests: Array<{
    testId: string;
    testName: string;
    failureCount: number;
    lastFailure: string;
  }>;
  projectStats: Array<{
    projectId: string;
    projectName: string;
    runs: number;
    tests: number;
    successRate: number;
    averageDuration: number;
  }>;
}

export class AnalyticsService {
  async getOrgAnalytics(orgId: string): Promise<AnalyticsData> {
    const results = resultsIngestionService.getResultsByOrg(orgId);
    
    const analytics: AnalyticsData = {
      totalRuns: results.length,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      successRate: 0,
      averageDuration: 0,
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      topFailingTests: [],
      projectStats: []
    };

    if (results.length === 0) return analytics;

    // Calculate basic stats
    results.forEach(run => {
      run.test_cases.forEach(testCase => {
        analytics.totalTests++;
        switch (testCase.status) {
          case 'passed':
            analytics.passedTests++;
            break;
          case 'failed':
            analytics.failedTests++;
            break;
          case 'skipped':
            analytics.skippedTests++;
            break;
        }
      });
    });

    analytics.successRate = analytics.totalTests > 0 
      ? (analytics.passedTests / analytics.totalTests) * 100 
      : 0;

    analytics.averageDuration = results.reduce((sum, run) => sum + run.metadata.duration, 0) / results.length;

    // Calculate trends
    analytics.trends = this.calculateTrends(results);

    // Calculate top failing tests
    analytics.topFailingTests = this.calculateTopFailingTests(results);

    // Calculate project stats
    analytics.projectStats = this.calculateProjectStats(results);

    return analytics;
  }

  async getProjectAnalytics(projectId: string): Promise<AnalyticsData> {
    const results = resultsIngestionService.getResultsByProject(projectId);
    
    const analytics: AnalyticsData = {
      totalRuns: results.length,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      successRate: 0,
      averageDuration: 0,
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      },
      topFailingTests: [],
      projectStats: []
    };

    if (results.length === 0) return analytics;

    // Calculate basic stats
    results.forEach(run => {
      run.test_cases.forEach(testCase => {
        analytics.totalTests++;
        switch (testCase.status) {
          case 'passed':
            analytics.passedTests++;
            break;
          case 'failed':
            analytics.failedTests++;
            break;
          case 'skipped':
            analytics.skippedTests++;
            break;
        }
      });
    });

    analytics.successRate = analytics.totalTests > 0 
      ? (analytics.passedTests / analytics.totalTests) * 100 
      : 0;

    analytics.averageDuration = results.reduce((sum, run) => sum + run.metadata.duration, 0) / results.length;

    // Calculate trends
    analytics.trends = this.calculateTrends(results);

    // Calculate top failing tests
    analytics.topFailingTests = this.calculateTopFailingTests(results);

    return analytics;
  }

  private calculateTrends(results: any[]) {
    const daily: any[] = [];
    const weekly: any[] = [];
    const monthly: any[] = [];

    // Group by date
    const dailyGroups = new Map<string, any>();
    const weeklyGroups = new Map<string, any>();
    const monthlyGroups = new Map<string, any>();

    results.forEach(run => {
      const date = new Date(run.metadata.timestamp);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = this.getWeekKey(date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Daily
      if (!dailyGroups.has(dayKey)) {
        dailyGroups.set(dayKey, {
          date: dayKey,
          runs: 0,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0
        });
      }
      const dailyGroup = dailyGroups.get(dayKey);
      dailyGroup.runs++;
      run.test_cases.forEach((testCase: any) => {
        dailyGroup.tests++;
        switch (testCase.status) {
          case 'passed':
            dailyGroup.passed++;
            break;
          case 'failed':
            dailyGroup.failed++;
            break;
          case 'skipped':
            dailyGroup.skipped++;
            break;
        }
      });

      // Weekly
      if (!weeklyGroups.has(weekKey)) {
        weeklyGroups.set(weekKey, {
          week: weekKey,
          runs: 0,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0
        });
      }
      const weeklyGroup = weeklyGroups.get(weekKey);
      weeklyGroup.runs++;
      run.test_cases.forEach((testCase: any) => {
        weeklyGroup.tests++;
        switch (testCase.status) {
          case 'passed':
            weeklyGroup.passed++;
            break;
          case 'failed':
            weeklyGroup.failed++;
            break;
          case 'skipped':
            weeklyGroup.skipped++;
            break;
        }
      });

      // Monthly
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, {
          month: monthKey,
          runs: 0,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0
        });
      }
      const monthlyGroup = monthlyGroups.get(monthKey);
      monthlyGroup.runs++;
      run.test_cases.forEach((testCase: any) => {
        monthlyGroup.tests++;
        switch (testCase.status) {
          case 'passed':
            monthlyGroup.passed++;
            break;
          case 'failed':
            monthlyGroup.failed++;
            break;
          case 'skipped':
            monthlyGroup.skipped++;
            break;
        }
      });
    });

    return {
      daily: Array.from(dailyGroups.values()).sort((a, b) => a.date.localeCompare(b.date)),
      weekly: Array.from(weeklyGroups.values()).sort((a, b) => a.week.localeCompare(b.week)),
      monthly: Array.from(monthlyGroups.values()).sort((a, b) => a.month.localeCompare(b.month))
    };
  }

  private calculateTopFailingTests(results: any[]) {
    const testFailures = new Map<string, any>();

    results.forEach(run => {
      run.test_cases.forEach((testCase: any) => {
        if (testCase.status === 'failed') {
          const key = testCase.case_id;
          if (!testFailures.has(key)) {
            testFailures.set(key, {
              testId: testCase.case_id,
              testName: `Test ${testCase.case_id}`,
              failureCount: 0,
              lastFailure: run.metadata.timestamp
            });
          }
          const failure = testFailures.get(key);
          failure.failureCount++;
          if (new Date(run.metadata.timestamp) > new Date(failure.lastFailure)) {
            failure.lastFailure = run.metadata.timestamp;
          }
        }
      });
    });

    return Array.from(testFailures.values())
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);
  }

  private calculateProjectStats(results: any[]) {
    const projectStats = new Map<string, any>();

    results.forEach(run => {
      const projectId = run.project_id;
      if (!projectStats.has(projectId)) {
        projectStats.set(projectId, {
          projectId,
          projectName: `Project ${projectId}`,
          runs: 0,
          tests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          totalDuration: 0
        });
      }
      const stats = projectStats.get(projectId);
      stats.runs++;
      stats.totalDuration += run.metadata.duration;
      run.test_cases.forEach((testCase: any) => {
        stats.tests++;
        switch (testCase.status) {
          case 'passed':
            stats.passed++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'skipped':
            stats.skipped++;
            break;
        }
      });
    });

    return Array.from(projectStats.values()).map(stats => ({
      projectId: stats.projectId,
      projectName: stats.projectName,
      runs: stats.runs,
      tests: stats.tests,
      successRate: stats.tests > 0 ? (stats.passed / stats.tests) * 100 : 0,
      averageDuration: stats.runs > 0 ? stats.totalDuration / stats.runs : 0
    }));
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

export const analyticsService = new AnalyticsService();
