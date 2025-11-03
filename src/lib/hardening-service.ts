export interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'ui' | 'api' | 'performance' | 'security' | 'data' | 'integration';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'duplicate';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reporter: string;
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  environment: string;
  browser?: string;
  device?: string;
  attachments?: string[];
  tags: string[];
  relatedIssues?: string[];
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  category: 'functional' | 'integration' | 'performance' | 'security' | 'ui';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'ready' | 'in_progress' | 'completed' | 'failed';
  steps: TestStep[];
  expectedResults: string[];
  actualResults?: string[];
  testData?: Record<string, any>;
  environment: string;
  browser?: string;
  device?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastExecuted?: Date;
  executionCount: number;
  passRate: number;
  tags: string[];
}

export interface TestStep {
  id: string;
  stepNumber: number;
  action: string;
  expectedResult: string;
  actualResult?: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  notes?: string;
  attachments?: string[];
}

export interface TestExecution {
  id: string;
  testCaseId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  executedBy: string;
  environment: string;
  browser?: string;
  device?: string;
  results: TestStepResult[];
  screenshots?: string[];
  logs?: string[];
  error?: string;
  notes?: string;
}

export interface TestStepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'skipped';
  actualResult: string;
  notes?: string;
  screenshots?: string[];
  error?: string;
}

export interface BugBashSession {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  participants: string[];
  testCases: string[];
  bugsFound: string[];
  rewards: {
    type: 'points' | 'badges' | 'prizes';
    value: number;
    description: string;
  };
  rules: string[];
  leaderboard: Array<{
    participant: string;
    bugsFound: number;
    points: number;
    rank: number;
  }>;
}

export class HardeningService {
  private bugReports: Map<string, BugReport> = new Map();
  private testCases: Map<string, TestCase> = new Map();
  private testExecutions: Map<string, TestExecution> = new Map();
  private bugBashSessions: Map<string, BugBashSession> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Initialize with sample bug reports
    const sampleBugs: BugReport[] = [
      {
        id: 'bug_001',
        title: 'Login button not responding on mobile',
        description: 'The login button does not respond to touch events on mobile devices',
        severity: 'high',
        category: 'ui',
        status: 'open',
        priority: 'high',
        reporter: 'user@company.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        stepsToReproduce: [
          'Open the application on a mobile device',
          'Navigate to the login page',
          'Tap the login button'
        ],
        expectedBehavior: 'The login button should respond to touch and initiate login',
        actualBehavior: 'The login button does not respond to touch events',
        environment: 'Mobile Chrome',
        browser: 'Chrome Mobile',
        device: 'iPhone 12',
        tags: ['mobile', 'ui', 'touch'],
        relatedIssues: []
      },
      {
        id: 'bug_002',
        title: 'API endpoint returns 500 error',
        description: 'The /api/users endpoint returns a 500 internal server error',
        severity: 'critical',
        category: 'api',
        status: 'in_progress',
        priority: 'urgent',
        reporter: 'dev@company.com',
        assignee: 'backend-dev@company.com',
        createdAt: new Date(),
        updatedAt: new Date(),
        stepsToReproduce: [
          'Make a GET request to /api/users',
          'Check the response status code'
        ],
        expectedBehavior: 'The API should return a 200 status code with user data',
        actualBehavior: 'The API returns a 500 status code with error message',
        environment: 'Production',
        tags: ['api', 'backend', 'error'],
        relatedIssues: []
      }
    ];

    sampleBugs.forEach(bug => {
      this.bugReports.set(bug.id, bug);
    });

    // Initialize with sample test cases
    const sampleTestCases: TestCase[] = [
      {
        id: 'test_001',
        title: 'User Login Flow',
        description: 'Test the complete user login flow',
        category: 'functional',
        priority: 'high',
        status: 'ready',
        steps: [
          {
            id: 'step_001',
            stepNumber: 1,
            action: 'Navigate to login page',
            expectedResult: 'Login page loads successfully',
            status: 'pending'
          },
          {
            id: 'step_002',
            stepNumber: 2,
            action: 'Enter valid credentials',
            expectedResult: 'Credentials are entered successfully',
            status: 'pending'
          },
          {
            id: 'step_003',
            stepNumber: 3,
            action: 'Click login button',
            expectedResult: 'User is logged in successfully',
            status: 'pending'
          }
        ],
        expectedResults: [
          'Login page loads',
          'Credentials are accepted',
          'User is redirected to dashboard'
        ],
        environment: 'Staging',
        browser: 'Chrome',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'qa@company.com',
        executionCount: 0,
        passRate: 0,
        tags: ['login', 'authentication', 'ui']
      }
    ];

    sampleTestCases.forEach(testCase => {
      this.testCases.set(testCase.id, testCase);
    });
  }

  // Bug Report Management
  async createBugReport(bug: Omit<BugReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newBug: BugReport = {
      ...bug,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.bugReports.set(id, newBug);
    return id;
  }

  async updateBugReport(bugId: string, updates: Partial<BugReport>): Promise<boolean> {
    const bug = this.bugReports.get(bugId);
    if (!bug) return false;

    Object.assign(bug, updates);
    bug.updatedAt = new Date();
    return true;
  }

  getBugReport(bugId: string): BugReport | undefined {
    return this.bugReports.get(bugId);
  }

  getAllBugReports(): BugReport[] {
    return Array.from(this.bugReports.values());
  }

  getBugReportsByStatus(status: BugReport['status']): BugReport[] {
    return this.getAllBugReports().filter(bug => bug.status === status);
  }

  getBugReportsBySeverity(severity: BugReport['severity']): BugReport[] {
    return this.getAllBugReports().filter(bug => bug.severity === severity);
  }

  // Test Case Management
  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'passRate'>): Promise<string> {
    const id = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newTestCase: TestCase = {
      ...testCase,
      id,
      createdAt: now,
      updatedAt: now,
      executionCount: 0,
      passRate: 0
    };

    this.testCases.set(id, newTestCase);
    return id;
  }

  async updateTestCase(testCaseId: string, updates: Partial<TestCase>): Promise<boolean> {
    const testCase = this.testCases.get(testCaseId);
    if (!testCase) return false;

    Object.assign(testCase, updates);
    testCase.updatedAt = new Date();
    return true;
  }

  getTestCase(testCaseId: string): TestCase | undefined {
    return this.testCases.get(testCaseId);
  }

  getAllTestCases(): TestCase[] {
    return Array.from(this.testCases.values());
  }

  getTestCasesByCategory(category: TestCase['category']): TestCase[] {
    return this.getAllTestCases().filter(testCase => testCase.category === category);
  }

  getTestCasesByStatus(status: TestCase['status']): TestCase[] {
    return this.getAllTestCases().filter(testCase => testCase.status === status);
  }

  // Test Execution Management
  async executeTestCase(testCaseId: string, executedBy: string, environment: string): Promise<string> {
    const testCase = this.testCases.get(testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    
    const execution: TestExecution = {
      id: executionId,
      testCaseId,
      status: 'running',
      startTime,
      executedBy,
      environment,
      results: []
    };

    this.testExecutions.set(executionId, execution);

    try {
      // Simulate test execution
      await this.simulateTestExecution(execution, testCase);
      
      execution.status = 'passed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      
      // Update test case statistics
      testCase.executionCount++;
      testCase.lastExecuted = execution.endTime;
      testCase.passRate = (testCase.passRate * (testCase.executionCount - 1) + 100) / testCase.executionCount;
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.error = error.message;
      
      // Update test case statistics
      testCase.executionCount++;
      testCase.lastExecuted = execution.endTime;
      testCase.passRate = (testCase.passRate * (testCase.executionCount - 1) + 0) / testCase.executionCount;
    }

    return executionId;
  }

  private async simulateTestExecution(execution: TestExecution, testCase: TestCase): Promise<void> {
    // Simulate test step execution
    for (const step of testCase.steps) {
      const result: TestStepResult = {
        stepId: step.id,
        status: Math.random() > 0.1 ? 'passed' : 'failed', // 90% pass rate
        actualResult: step.expectedResult,
        notes: `Executed step ${step.stepNumber}`
      };

      if (result.status === 'failed') {
        result.error = `Step ${step.stepNumber} failed: ${step.action}`;
        throw new Error(result.error);
      }

      execution.results.push(result);
    }
  }

  getTestExecution(executionId: string): TestExecution | undefined {
    return this.testExecutions.get(executionId);
  }

  getAllTestExecutions(): TestExecution[] {
    return Array.from(this.testExecutions.values());
  }

  getTestExecutionsByTestCase(testCaseId: string): TestExecution[] {
    return this.getAllTestExecutions().filter(execution => execution.testCaseId === testCaseId);
  }

  // Bug Bash Management
  async createBugBashSession(session: Omit<BugBashSession, 'id' | 'bugsFound' | 'leaderboard'>): Promise<string> {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSession: BugBashSession = {
      ...session,
      id,
      bugsFound: [],
      leaderboard: []
    };

    this.bugBashSessions.set(id, newSession);
    return id;
  }

  async startBugBashSession(sessionId: string): Promise<boolean> {
    const session = this.bugBashSessions.get(sessionId);
    if (!session) return false;

    session.status = 'active';
    return true;
  }

  async endBugBashSession(sessionId: string): Promise<boolean> {
    const session = this.bugBashSessions.get(sessionId);
    if (!session) return false;

    session.status = 'completed';
    session.endDate = new Date();
    
    // Calculate leaderboard
    const participantStats = new Map<string, { bugsFound: number; points: number }>();
    
    session.participants.forEach(participant => {
      participantStats.set(participant, { bugsFound: 0, points: 0 });
    });

    session.bugsFound.forEach(bugId => {
      const bug = this.bugReports.get(bugId);
      if (bug) {
        const stats = participantStats.get(bug.reporter);
        if (stats) {
          stats.bugsFound++;
          stats.points += this.calculateBugPoints(bug.severity);
        }
      }
    });

    session.leaderboard = Array.from(participantStats.entries())
      .map(([participant, stats]) => ({
        participant,
        ...stats,
        rank: 0 // Will be calculated after sorting
      }))
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return true;
  }

  private calculateBugPoints(severity: BugReport['severity']): number {
    switch (severity) {
      case 'critical': return 100;
      case 'high': return 50;
      case 'medium': return 25;
      case 'low': return 10;
      default: return 0;
    }
  }

  getBugBashSession(sessionId: string): BugBashSession | undefined {
    return this.bugBashSessions.get(sessionId);
  }

  getAllBugBashSessions(): BugBashSession[] {
    return Array.from(this.bugBashSessions.values());
  }

  // Analytics and Reporting
  async getBugReportSummary(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }> {
    const bugs = this.getAllBugReports();
    
    return {
      total: bugs.length,
      open: bugs.filter(b => b.status === 'open').length,
      inProgress: bugs.filter(b => b.status === 'in_progress').length,
      resolved: bugs.filter(b => b.status === 'resolved').length,
      closed: bugs.filter(b => b.status === 'closed').length,
      critical: bugs.filter(b => b.severity === 'critical').length,
      high: bugs.filter(b => b.severity === 'high').length,
      medium: bugs.filter(b => b.severity === 'medium').length,
      low: bugs.filter(b => b.severity === 'low').length
    };
  }

  async getTestCaseSummary(): Promise<{
    total: number;
    ready: number;
    inProgress: number;
    completed: number;
    failed: number;
    averagePassRate: number;
  }> {
    const testCases = this.getAllTestCases();
    
    return {
      total: testCases.length,
      ready: testCases.filter(tc => tc.status === 'ready').length,
      inProgress: testCases.filter(tc => tc.status === 'in_progress').length,
      completed: testCases.filter(tc => tc.status === 'completed').length,
      failed: testCases.filter(tc => tc.status === 'failed').length,
      averagePassRate: testCases.length > 0 
        ? testCases.reduce((sum, tc) => sum + tc.passRate, 0) / testCases.length 
        : 0
    };
  }

  async getTestExecutionSummary(): Promise<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    averageDuration: number;
  }> {
    const executions = this.getAllTestExecutions();
    
    return {
      total: executions.length,
      passed: executions.filter(e => e.status === 'passed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      skipped: executions.filter(e => e.status === 'skipped').length,
      averageDuration: executions.length > 0
        ? executions.reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length
        : 0
    };
  }
}

export const hardeningService = new HardeningService();


