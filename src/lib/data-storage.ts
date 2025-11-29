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

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  // Test Case Management
  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCase> {
    const url = `${this.baseUrl}/test-cases`;
    console.log('Creating test case via API:', testCase);
    console.log('Request URL:', url);
    console.log('Base URL:', this.baseUrl);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      
      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend returned error:', errorText);
        console.error('Error status:', response.status);
        throw new Error(`Failed to create test case: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Backend response data:', responseData);
      const { id } = responseData;
      
      if (!id) {
        console.error('Backend returned no ID in response:', responseData);
        throw new Error(`Backend returned no ID in response: ${JSON.stringify(responseData)}`);
      }
      
      if (id.startsWith('tc_')) {
        console.error('Backend returned invalid fallback ID:', id);
        console.error('Full response:', responseData);
        throw new Error(`Backend returned invalid fallback ID (${id}). This indicates a database error. Check server logs.`);
      }
      
      console.log('Successfully created test case with ID:', id);
      return {
        ...testCase,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as TestCase;
    } catch (error: any) {
      console.error('=== ERROR CREATING TEST CASE ===');
      console.error('Error object:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      
      // Check for network errors
      if (error instanceof TypeError) {
        console.error('NETWORK ERROR DETECTED (TypeError)');
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          console.error('Failed to connect to backend at:', url);
          console.error('This usually means:');
          console.error('  1. Backend server is not running');
          console.error('  2. Backend is on a different port');
          console.error('  3. CORS issue (backend not allowing requests from frontend)');
          console.error('  4. Network/firewall blocking the connection');
          throw new Error(`Cannot connect to backend at ${url}. Check: 1) Is server running? 2) Is it on port 8000? 3) Check CORS settings.`);
        }
      }
      
      // Check for CORS errors
      if (error.message && (error.message.includes('CORS') || error.message.includes('cross-origin'))) {
        console.error('CORS ERROR: Backend is not allowing requests from this origin');
        console.error('Check backend CORS configuration');
      }
      
      throw error;
    }
  }

  async getTestCases(planId?: string): Promise<TestCase[]> {
    try {
      let url = `${this.baseUrl}/test-cases`;
      if (planId) {
        url += `?plan_id=${planId}`;
      }
      console.log('Fetching test cases from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to get test cases:', response.status, errorText);
        throw new Error(`Failed to get test cases: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Backend response for getTestCases:', data);
      
      // Handle different response formats
      let testCases: TestCase[] = [];
      if (Array.isArray(data)) {
        testCases = data;
      } else if (data.testCases && Array.isArray(data.testCases)) {
        testCases = data.testCases;
      } else if (data.test_cases && Array.isArray(data.test_cases)) {
        testCases = data.test_cases;
      } else {
        console.warn('Unexpected response format:', data);
      }
      
      console.log(`Returning ${testCases.length} test cases`);
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
    try {
      const response = await fetch(`${this.baseUrl}/defects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defect)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create defect: ${response.statusText}`);
      }
      
      const { id } = await response.json();
      return {
        ...defect,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Defect;
    } catch (error) {
      console.error('Error creating defect:', error);
      throw error;
    }
  }

  async getDefects(): Promise<Defect[]> {
    try {
      const response = await fetch(`${this.baseUrl}/defects`);
      
      if (!response.ok) {
        throw new Error(`Failed to get defects: ${response.statusText}`);
      }
      
      const { defects } = await response.json();
      return defects || [];
    } catch (error) {
      console.error('Error getting defects:', error);
      return [];
    }
  }

  async updateDefect(id: string, updates: Partial<Defect>): Promise<Defect | null> {
    try {
      const response = await fetch(`${this.baseUrl}/defects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
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
      const response = await fetch(`${this.baseUrl}/defects/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get defect: ${response.statusText}`);
      }
      
      return await response.json() as Defect;
    } catch (error) {
      console.error('Error getting defect:', error);
      return null;
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
