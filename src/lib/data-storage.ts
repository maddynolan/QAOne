// Data Storage Service for QA AI Platform
// Handles local storage of test cases, plans, and other data

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    action: string;
    expectedResult: string;
  }>;
  preconditions: string[];
  testData: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  automationScript?: string;
  testType: string;
  complexity: string;
  estimatedTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
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

  constructor(baseUrl: string = 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  // Test Case Management
  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCase> {
    try {
      const response = await fetch(`${this.baseUrl}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create test case: ${response.statusText}`);
      }
      
      const { id } = await response.json();
      return {
        ...testCase,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as TestCase;
    } catch (error) {
      console.error('Error creating test case:', error);
      throw error;
    }
  }

  async getTestCases(): Promise<TestCase[]> {
    try {
      const response = await fetch(`${this.baseUrl}/test-cases`);
      
      if (!response.ok) {
        throw new Error(`Failed to get test cases: ${response.statusText}`);
      }
      
      const { testCases } = await response.json();
      return testCases || [];
    } catch (error) {
      console.error('Error getting test cases:', error);
      return [];
    }
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    try {
      const response = await fetch(`${this.baseUrl}/test-cases/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get test case: ${response.statusText}`);
      }
      
      return await response.json() as TestCase;
    } catch (error) {
      console.error('Error getting test case:', error);
      return null;
    }
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase | null> {
    try {
      const response = await fetch(`${this.baseUrl}/test-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to update test case: ${response.statusText}`);
      }
      
      const updated = await response.json();
      return await this.getTestCase(id);
    } catch (error) {
      console.error('Error updating test case:', error);
      return null;
    }
  }

  async deleteTestCase(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/test-cases/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        if (response.status === 404) return false;
        throw new Error(`Failed to delete test case: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting test case:', error);
      return false;
    }
  }

  // Test Plan Management
  async createTestPlan(testPlan: Omit<TestPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPlan> {
    try {
      const response = await fetch(`${this.baseUrl}/test-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPlan)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create test plan: ${response.statusText}`);
      }
      
      const { id } = await response.json();
      return {
        ...testPlan,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as TestPlan;
    } catch (error) {
      console.error('Error creating test plan:', error);
      throw error;
    }
  }

  async getTestPlans(): Promise<TestPlan[]> {
    try {
      const response = await fetch(`${this.baseUrl}/test-plans`);
      
      if (!response.ok) {
        throw new Error(`Failed to get test plans: ${response.statusText}`);
      }
      
      const { testPlans } = await response.json();
      return testPlans || [];
    } catch (error) {
      console.error('Error getting test plans:', error);
      return [];
    }
  }

  // Test Run Management
  async createTestRun(testRun: Omit<TestRun, 'id' | 'startTime'>): Promise<TestRun> {
    try {
      const response = await fetch(`${this.baseUrl}/test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRun)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create test run: ${response.statusText}`);
      }
      
      const { id } = await response.json();
      return {
        ...testRun,
        id,
        createdAt: new Date().toISOString()
      } as TestRun;
    } catch (error) {
      console.error('Error creating test run:', error);
      throw error;
    }
  }

  async getTestRuns(): Promise<TestRun[]> {
    try {
      const response = await fetch(`${this.baseUrl}/test-runs`);
      
      if (!response.ok) {
        throw new Error(`Failed to get test runs: ${response.statusText}`);
      }
      
      const { testRuns } = await response.json();
      return testRuns || [];
    } catch (error) {
      console.error('Error getting test runs:', error);
      return [];
    }
  }

  async updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | null> {
    try {
      const response = await fetch(`${this.baseUrl}/test-runs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
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
      const response = await fetch(`${this.baseUrl}/test-runs/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get test run: ${response.statusText}`);
      }
      
      return await response.json() as TestRun;
    } catch (error) {
      console.error('Error getting test run:', error);
      return null;
    }
  }

  // Defect Management
  async createDefect(defect: Omit<Defect, 'id' | 'createdAt' | 'updatedAt'>): Promise<Defect> {
    const data = this.getStorageData();
    const newDefect: Defect = {
      ...defect,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.defects.push(newDefect);
    this.saveStorageData(data);
    
    return newDefect;
  }

  async getDefects(): Promise<Defect[]> {
    const data = this.getStorageData();
    return data.defects.sort((a: Defect, b: Defect) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateDefect(id: string, updates: Partial<Defect>): Promise<Defect | null> {
    const data = this.getStorageData();
    const index = data.defects.findIndex((d: Defect) => d.id === id);
    
    if (index === -1) return null;
    
    data.defects[index] = {
      ...data.defects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveStorageData(data);
    return data.defects[index];
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Initialize with sample data
  async initializeSampleData(): Promise<void> {
    const data = this.getStorageData();
    
    if (data.testCases.length === 0) {
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
        await this.createTestCase(testCase);
      }
    }

    if (data.testRuns.length === 0) {
      // Add some sample test runs
      const sampleTestRuns: Omit<TestRun, 'id' | 'startTime'>[] = [
        {
          name: "API Integration Tests",
          status: "running",
          progress: 65,
          tests: "32/50"
        },
        {
          name: "E2E User Flow Tests",
          status: "passed",
          progress: 100,
          tests: "45/45",
          endTime: new Date(Date.now() - 3600000).toISOString()
        },
        {
          name: "Security Scan",
          status: "failed",
          progress: 100,
          tests: "12/15",
          endTime: new Date(Date.now() - 7200000).toISOString()
        }
      ];

      for (const testRun of sampleTestRuns) {
        await this.createTestRun(testRun);
      }
    }
  }

  // Clear all data (for testing)
  async clearAllData(): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }
}

// Export singleton instance
export const dataStorageService = new DataStorageService();
