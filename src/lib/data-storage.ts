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
  status: 'running' | 'passed' | 'failed' | 'queued';
  progress: number;
  tests: string;
  startTime: string;
  endTime?: string;
  results?: any[];
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
  private storageKey = 'qa-ai-platform-data';

  private getStorageData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {
        testCases: [],
        testPlans: [],
        testRuns: [],
        defects: []
      };
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return {
        testCases: [],
        testPlans: [],
        testRuns: [],
        defects: []
      };
    }
  }

  private saveStorageData(data: any) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // Test Case Management
  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCase> {
    const data = this.getStorageData();
    const newTestCase: TestCase = {
      ...testCase,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.testCases.push(newTestCase);
    this.saveStorageData(data);
    
    return newTestCase;
  }

  async getTestCases(): Promise<TestCase[]> {
    const data = this.getStorageData();
    return data.testCases.sort((a: TestCase, b: TestCase) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    const data = this.getStorageData();
    return data.testCases.find((tc: TestCase) => tc.id === id) || null;
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase | null> {
    const data = this.getStorageData();
    const index = data.testCases.findIndex((tc: TestCase) => tc.id === id);
    
    if (index === -1) return null;
    
    data.testCases[index] = {
      ...data.testCases[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveStorageData(data);
    return data.testCases[index];
  }

  async deleteTestCase(id: string): Promise<boolean> {
    const data = this.getStorageData();
    const index = data.testCases.findIndex((tc: TestCase) => tc.id === id);
    
    if (index === -1) return false;
    
    data.testCases.splice(index, 1);
    this.saveStorageData(data);
    return true;
  }

  // Test Plan Management
  async createTestPlan(testPlan: Omit<TestPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestPlan> {
    const data = this.getStorageData();
    const newTestPlan: TestPlan = {
      ...testPlan,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.testPlans.push(newTestPlan);
    this.saveStorageData(data);
    
    return newTestPlan;
  }

  async getTestPlans(): Promise<TestPlan[]> {
    const data = this.getStorageData();
    return data.testPlans.sort((a: TestPlan, b: TestPlan) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Test Run Management
  async createTestRun(testRun: Omit<TestRun, 'id' | 'startTime'>): Promise<TestRun> {
    const data = this.getStorageData();
    const newTestRun: TestRun = {
      ...testRun,
      id: this.generateId(),
      startTime: new Date().toISOString()
    };
    
    data.testRuns.push(newTestRun);
    this.saveStorageData(data);
    
    return newTestRun;
  }

  async getTestRuns(): Promise<TestRun[]> {
    const data = this.getStorageData();
    return data.testRuns.sort((a: TestRun, b: TestRun) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun | null> {
    const data = this.getStorageData();
    const index = data.testRuns.findIndex((tr: TestRun) => tr.id === id);
    
    if (index === -1) return null;
    
    data.testRuns[index] = {
      ...data.testRuns[index],
      ...updates
    };
    
    this.saveStorageData(data);
    return data.testRuns[index];
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
