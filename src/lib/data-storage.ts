// Data Storage Service for ArisTrace Platform
// Handles local storage of test cases, plans, requirements, and recordings

// ============ RECORDING (from Flowstral) ============
export interface Recording {
  id: string;
  sessionId: string;
  name: string;
  description?: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  actions: RecordingAction[];
  metadata: {
    baseUrl?: string;
    browser?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
  };
  playwrightScript?: string;
  reviewNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  testCaseId?: string; // Linked test case after approval
  createdAt: string;
  updatedAt: string;
}

export interface RecordingAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'select' | 'scroll' | 'wait' | 'assert';
  target?: string;
  value?: string;
  selector?: string;
  url?: string;
  description?: string;
  timestamp?: string;
}

// ============ REQUIREMENT ============
export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non_functional' | 'business' | 'technical';
  priority: 'must_have' | 'should_have' | 'could_have' | 'wont_have';
  status: 'draft' | 'approved' | 'implemented' | 'verified' | 'rejected';
  acceptanceCriteria: string[];
  linkedTestCases: string[]; // Test Case IDs
  tags: string[];
  source?: 'jira' | 'manual' | 'import';
  externalId?: string; // Jira ticket ID, etc.
  createdAt: string;
  updatedAt: string;
}

// ============ TEST CASE ============
export interface TestCase {
  id: string;
  name: string;
  description: string;
  // Execution type
  type: 'manual' | 'automated';
  // Category for organization
  category: 'functional' | 'regression' | 'smoke' | 'e2e' | 'integration' | 'api' | 'performance';
  // Lifecycle status
  status: 'draft' | 'active' | 'deprecated';
  // Test steps
  steps: Array<{
    action: string;
    expectedResult: string;
    testData?: string;
  }>;
  preconditions: string[];
  testData: string[];
  expectedResult: string; // Overall expected outcome
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  // Traceability
  linkedRequirements: string[]; // Requirement IDs
  // Source tracking
  source: {
    type: 'manual' | 'flowstral' | 'import';
    recordingId?: string; // If from Flowstral
    importedFrom?: string;
  };
  // Automation
  automationScript?: string;
  // Legacy fields (kept for compatibility)
  testType: string;
  complexity: string;
  estimatedTime: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============ TEST PLAN ============
export interface TestPlan {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  testCases: string[]; // Test Case IDs (not full objects)
  linkedRequirements: string[]; // Requirement IDs
  environment: string;
  scheduledDate?: string;
  estimatedDuration: number;
  coverage: string;
  riskAssessment: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  testCases: any[];
  results?: any[];
  createdAt: string;
  completedAt?: string;
  duration?: number;
}

export interface Defect {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'open' | 'in-progress' | 'fixed' | 'closed';
  testCaseId?: string;
  testRunId?: string;
  aiAnalysis?: any;
  createdAt: string;
  updatedAt: string;
}

class DataStorageService {
  private baseUrl: string;
  private dbUrl: string; // /api/db endpoint for persistent SQLite storage

  constructor(baseUrl: string = 'https://qaone-production.up.railway.app') {
    this.baseUrl = baseUrl;
    this.dbUrl = `${baseUrl}/api/db`; // Persistent database API
  }

  // Convert Flowstral recorded test case to standard TestCase format
  private convertFlowstralTestCase(fc: any): TestCase {
    const metadata = fc.metadata || {};
    const actions = fc.actions || [];
    
    // Convert actions to steps
    const steps = actions.map((action: any) => ({
      action: action.description || `${action.type}: ${action.value || action.url || ''}`,
      expectedResult: this.getExpectedResult(action)
    }));
    
    // Handle tags - backend may return string or array
    let tags: string[] = [];
    if (typeof fc.tags === 'string') {
      tags = fc.tags.split(/[\s,]+/).filter((t: string) => t.trim());
    } else if (Array.isArray(fc.tags)) {
      tags = fc.tags;
    }
    
    return {
      id: fc.id || `flowstral_${Date.now()}`,
      name: fc.name || 'Recorded Test',
      description: fc.description || metadata.description || `Recorded from ${fc.start_url || metadata.start_url || 'browser'}`,
      steps: steps.length > 0 ? steps : [{ action: 'No actions recorded', expectedResult: 'N/A' }],
      preconditions: [`Application accessible at ${fc.start_url || metadata.start_url || 'target URL'}`],
      testData: [],
      priority: (fc.priority || metadata.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      tags: tags,
      automationScript: fc.script || undefined,
      testType: fc.test_type || metadata.test_type || 'automated',
      complexity: fc.category || metadata.category || 'functional',
      estimatedTime: Math.max(1, Math.ceil((fc.action_count || actions.length || 1) / 4)),
      createdAt: fc.created_at || new Date().toISOString(),
      updatedAt: fc.updated_at || new Date().toISOString(),
    };
  }
  
  private getExpectedResult(action: any): string {
    const type = action.type || '';
    switch (type) {
      case 'navigate': return 'Page loads successfully';
      case 'click': return 'Element responds to click';
      case 'fill': case 'type': case 'input': return 'Field accepts input';
      case 'check': return 'Checkbox/radio is selected';
      case 'uncheck': return 'Checkbox is deselected';
      case 'select': return 'Option is selected';
      case 'hover': return 'Hover action completes';
      case 'upload': return 'File is uploaded';
      default: return 'Action completes successfully';
    }
  }

  // Test Case Management - uses /api/db/ for persistent SQLite storage
  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCase> {
    try {
      const response = await fetch(`${this.dbUrl}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testCase.name,
          description: testCase.description || '',
          steps: testCase.steps || [],
          status: testCase.status || 'draft',
          priority: testCase.priority || 'medium',
          category: testCase.category || testCase.testType || 'functional',
          tags: testCase.tags || [],
          script: testCase.automationScript || null,
          metadata: {
            type: testCase.type,
            preconditions: testCase.preconditions,
            testData: testCase.testData,
            expectedResult: testCase.expectedResult,
            source: testCase.source,
            complexity: testCase.complexity,
            estimatedTime: testCase.estimatedTime,
            linkedRequirements: testCase.linkedRequirements,
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test case: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return { ...testCase, id: data.id, createdAt: data.created_at || new Date().toISOString(), updatedAt: data.updated_at || new Date().toISOString() } as TestCase;
    } catch (error: any) {
      console.error('Error creating test case:', error.message);
      throw error;
    }
  }

  async getTestCases(planId?: string): Promise<TestCase[]> {
    try {
      // Use persistent /api/db/ endpoint as primary source
      const response = await fetch(`${this.dbUrl}/test-cases?limit=1000`);
      
      let testCases: TestCase[] = [];
      
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : [];
        testCases = items.map((item: any) => this._dbItemToTestCase(item));
      }
      
      // Also fetch from Flowstral endpoint (recorded test cases)
      try {
        const flowstralUrl = `${this.baseUrl}/api/flowstral/test-cases`;
        const flowstralResponse = await fetch(flowstralUrl);
        
        if (flowstralResponse.ok) {
          const flowstralData = await flowstralResponse.json();
          const flowstralCases = flowstralData.test_cases || [];
          
          if (flowstralCases.length > 0) {
            const convertedCases = flowstralCases.map((fc: any) => this.convertFlowstralTestCase(fc));
            // Merge: add Flowstral cases not already in DB
            const existingIds = new Set(testCases.map(tc => tc.id));
            for (const fc of convertedCases) {
              if (!existingIds.has(fc.id)) {
                testCases.push(fc);
              }
            }
          }
        }
      } catch (flowstralError) {
        // Silently fail - Flowstral endpoint may not exist
      }
      return testCases;
    } catch (error: any) {
      console.error('Error getting test cases:', error);
      // Check for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error - backend may not be running');
        throw new Error(`Cannot connect to backend at ${this.baseUrl}. Is the server running?`);
      }
      // Re-throw to let the UI handle it
      throw error;
    }
  }

  // Convert database item to TestCase format
  private _dbItemToTestCase(item: any): TestCase {
    const meta = item.metadata || {};
    return {
      id: item.id,
      name: item.name || 'Unnamed Test',
      description: item.description || '',
      type: meta.type || (item.script ? 'automated' : 'manual'),
      category: item.category || meta.category || 'functional',
      status: item.status || 'draft',
      steps: Array.isArray(item.steps) ? item.steps : [],
      preconditions: meta.preconditions || [],
      testData: meta.testData || [],
      expectedResult: meta.expectedResult || '',
      priority: item.priority || 'medium',
      tags: Array.isArray(item.tags) ? item.tags : [],
      linkedRequirements: meta.linkedRequirements || [],
      source: meta.source || { type: 'manual' },
      automationScript: item.script || undefined,
      testType: item.category || meta.testType || 'functional',
      complexity: meta.complexity || 'medium',
      estimatedTime: meta.estimatedTime || 0,
      createdAt: item.created_at || '',
      updatedAt: item.updated_at || '',
    } as TestCase;
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    try {
      const response = await fetch(`${this.dbUrl}/test-cases/${id}`);
      if (response.ok) {
        const item = await response.json();
        return this._dbItemToTestCase(item);
      }
      if (response.status === 404) return null;
      throw new Error(`Failed to get test case: ${response.statusText}`);
    } catch (error) {
      console.error('Error getting test case:', error);
      return null;
    }
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase | null> {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.steps !== undefined) dbUpdates.steps = updates.steps;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.automationScript !== undefined) dbUpdates.script = updates.automationScript;
      
      const response = await fetch(`${this.dbUrl}/test-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates)
      });
      
      if (response.ok) return this._dbItemToTestCase(await response.json());
      if (response.status === 404) return null;
      throw new Error(`Failed to update test case: ${response.statusText}`);
    } catch (error) {
      console.error('Error updating test case:', error);
      return null;
    }
  }

  async deleteTestCase(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dbUrl}/test-cases/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting test case:', error);
      return false;
    }
  }

  // Test Plan Management - uses /api/db/ for persistent storage
  async createTestPlan(testPlan: Omit<TestPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPlan> {
    try {
      const response = await fetch(`${this.dbUrl}/test-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testPlan.name,
          description: testPlan.description || '',
          test_case_ids: testPlan.testCases || [],
          status: testPlan.status || 'draft',
        })
      });
      
      if (!response.ok) throw new Error(`Failed to create test plan: ${response.statusText}`);
      const data = await response.json();
      return { ...testPlan, id: data.id, createdAt: data.created_at || new Date().toISOString(), updatedAt: data.updated_at || new Date().toISOString() } as TestPlan;
    } catch (error) {
      console.error('Error creating test plan:', error);
      throw error;
    }
  }

  async getTestPlans(): Promise<TestPlan[]> {
    try {
      const response = await fetch(`${this.dbUrl}/test-plans?limit=1000`);
      if (!response.ok) throw new Error(`Failed to get test plans: ${response.statusText}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      return items.map((item: any) => ({
        id: item.id,
        name: item.name || 'Unnamed Plan',
        description: item.description || '',
        status: item.status || 'draft',
        testCases: item.test_case_ids || [],
        linkedRequirements: item.suite_ids || [],
        environment: '',
        estimatedDuration: 0,
        coverage: '',
        riskAssessment: '',
        createdAt: item.created_at || '',
        updatedAt: item.updated_at || '',
      })) as TestPlan[];
    } catch (error) {
      console.error('Error getting test plans:', error);
      return [];
    }
  }

  async deleteTestPlan(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dbUrl}/test-plans/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting test plan:', error);
      return false;
    }
  }

  // Test Run Management - uses /api/db/ for persistent storage
  async createTestRun(testRun: Omit<TestRun, 'id' | 'startTime'>): Promise<TestRun> {
    try {
      const response = await fetch(`${this.dbUrl}/test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testRun.name,
          test_case_ids: (testRun.testCases || []).map((tc: any) => typeof tc === 'string' ? tc : tc.id),
          status: testRun.status || 'pending',
        })
      });
      
      if (!response.ok) throw new Error(`Failed to create test run: ${response.statusText}`);
      const data = await response.json();
      return { ...testRun, id: data.id, createdAt: data.created_at || new Date().toISOString() } as TestRun;
    } catch (error) {
      console.error('Error creating test run:', error);
      throw error;
    }
  }

  async getTestRuns(): Promise<TestRun[]> {
    try {
      const response = await fetch(`${this.dbUrl}/test-runs?limit=1000`);
      if (!response.ok) throw new Error(`Failed to get test runs: ${response.statusText}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      return items.map((item: any) => ({
        id: item.id,
        name: item.name || 'Unnamed Run',
        status: item.status || 'pending',
        testCases: item.test_case_ids || [],
        results: item.results ? (typeof item.results === 'string' ? JSON.parse(item.results) : item.results) : [],
        createdAt: item.created_at || '',
        completedAt: item.completed_at || undefined,
        duration: undefined,
      })) as TestRun[];
    } catch (error) {
      console.error('Error getting test runs:', error);
      return [];
    }
  }

  async updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | null> {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.results !== undefined) dbUpdates.results = updates.results;
      
      const response = await fetch(`${this.dbUrl}/test-runs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates)
      });
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to update test run: ${response.statusText}`);
      }
      return await this.getTestRun(id);
    } catch (error) {
      console.error('Error updating test run:', error);
      return null;
    }
  }

  async getTestRun(id: string): Promise<TestRun | null> {
    try {
      const response = await fetch(`${this.dbUrl}/test-runs/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get test run: ${response.statusText}`);
      }
      const item = await response.json();
      return {
        id: item.id,
        name: item.name,
        status: item.status,
        testCases: item.test_case_ids || [],
        results: item.results || [],
        createdAt: item.created_at || '',
        completedAt: item.completed_at || undefined,
      } as TestRun;
    } catch (error) {
      console.error('Error getting test run:', error);
      return null;
    }
  }

  async deleteTestRun(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dbUrl}/test-runs/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting test run:', error);
      return false;
    }
  }

  // Defect Management - uses /api/db/ for persistent storage
  async createDefect(defect: Omit<Defect, 'id' | 'createdAt' | 'updatedAt'>): Promise<Defect> {
    try {
      const response = await fetch(`${this.dbUrl}/defects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: defect.title,
          description: defect.description || '',
          severity: defect.severity || 'medium',
          status: defect.status || 'open',
          test_case_id: defect.testCaseId || null,
          test_run_id: defect.testRunId || null,
        })
      });
      
      if (!response.ok) throw new Error(`Failed to create defect: ${response.statusText}`);
      const data = await response.json();
      return { ...defect, id: data.id, createdAt: data.created_at || new Date().toISOString(), updatedAt: data.updated_at || new Date().toISOString() } as Defect;
    } catch (error) {
      console.error('Error creating defect:', error);
      throw error;
    }
  }

  async getDefects(): Promise<Defect[]> {
    try {
      const response = await fetch(`${this.dbUrl}/defects?limit=1000`);
      if (!response.ok) throw new Error(`Failed to get defects: ${response.statusText}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      return items.map((item: any) => ({
        id: item.id,
        title: item.title || 'Unnamed Defect',
        description: item.description || '',
        severity: item.severity || 'medium',
        priority: item.severity || 'medium',
        status: item.status || 'open',
        testCaseId: item.test_case_id || undefined,
        testRunId: item.test_run_id || undefined,
        createdAt: item.created_at || '',
        updatedAt: item.updated_at || '',
      })) as Defect[];
    } catch (error) {
      console.error('Error getting defects:', error);
      return [];
    }
  }

  async updateDefect(id: string, updates: Partial<Defect>): Promise<Defect | null> {
    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.severity !== undefined) dbUpdates.severity = updates.severity;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      
      const response = await fetch(`${this.dbUrl}/defects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates)
      });
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to update defect: ${response.statusText}`);
      }
      return await this.getDefect(id);
    } catch (error) {
      console.error('Error updating defect:', error);
      return null;
    }
  }

  async getDefect(id: string): Promise<Defect | null> {
    try {
      const response = await fetch(`${this.dbUrl}/defects/${id}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get defect: ${response.statusText}`);
      }
      const item = await response.json();
      return {
        id: item.id, title: item.title, description: item.description,
        severity: item.severity, priority: item.severity, status: item.status,
        testCaseId: item.test_case_id, testRunId: item.test_run_id,
        createdAt: item.created_at, updatedAt: item.updated_at,
      } as Defect;
    } catch (error) {
      console.error('Error getting defect:', error);
      return null;
    }
  }

  async deleteDefect(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.dbUrl}/defects/${id}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Error deleting defect:', error);
      return false;
    }
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Initialize with sample data
  async initializeSampleData(): Promise<void> {
    try {
      // Check if we already have test cases in the database
      const existingTestCases = await this.getTestCases();
      
      // Only create sample data if database is empty
      if (existingTestCases.length === 0) {
      // Add some sample test cases
      const sampleTestCases: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          name: "API - User Authentication",
          description: "Test user login functionality with valid credentials",
          steps: [
            { action: "Send POST request to /api/auth/login with valid credentials", expectedResult: "Response status 200 with JWT token" },
            { action: "Extract token from response body", expectedResult: "Valid JWT token received" },
            { action: "Use token for authenticated requests", expectedResult: "Subsequent requests succeed with token" }
          ],
          preconditions: ["Valid user account exists", "API endpoint is accessible"],
          testData: ["Valid email and password", "Test user credentials"],
          priority: "critical",
          tags: ["api", "authentication", "critical-path"],
          testType: "api",
          complexity: "medium",
          estimatedTime: 15
        },
        {
          name: "UI - Login Form Validation",
          description: "Test login form with various input scenarios",
          steps: [
            { action: "Navigate to login page", expectedResult: "Login form is displayed" },
            { action: "Enter invalid email format", expectedResult: "Email validation error shown" },
            { action: "Enter valid email and invalid password", expectedResult: "Password validation error shown" },
            { action: "Enter valid credentials", expectedResult: "User redirected to dashboard" }
          ],
          preconditions: ["Application is running", "Login page is accessible"],
          testData: ["Invalid email formats", "Valid email with invalid password", "Valid credentials"],
          priority: "high",
          tags: ["ui", "validation", "form"],
          testType: "ui",
          complexity: "medium",
          estimatedTime: 20
        }
      ];

        for (const testCase of sampleTestCases) {
          try {
            await this.createTestCase(testCase);
          } catch (error) {
            console.warn('Failed to create sample test case:', error);
            // Continue with other test cases even if one fails
          }
        }
      }

      // Check if we already have test runs in the database
      const existingTestRuns = await this.getTestRuns();
      
      if (existingTestRuns.length === 0) {
      // Add some sample test runs
        const sampleTestRuns: Omit<TestRun, 'id' | 'startTime'>[] = [
          {
            name: "API Integration Tests",
            status: "running",
            testCases: [],
            results: []
          },
          {
            name: "E2E User Flow Tests",
            status: "completed",
            testCases: [],
            results: []
          },
          {
            name: "Security Scan",
            status: "failed",
            testCases: [],
            results: []
          }
        ];

        for (const testRun of sampleTestRuns) {
          try {
            await this.createTestRun(testRun);
          } catch (error) {
            console.warn('Failed to create sample test run:', error);
            // Continue with other test runs even if one fails
          }
        }
      }
    } catch (error) {
      console.error('Error initializing sample data:', error);
      // Don't throw - allow app to continue even if sample data fails
    }
  }

  // Clear all data (for testing)
  async clearAllData(): Promise<void> {
    // Note: This would require DELETE endpoints on the backend
    // For now, this is a no-op as we're using the database
    console.warn('clearAllData not implemented for backend storage');
  }
}

// Export singleton instance
export const dataStorageService = new DataStorageService();
