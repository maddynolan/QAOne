/**
 * Unified Test Management Service
 * Single source of truth for test cases, suites, and runs
 * Includes caching, optimized fetching, and proper data relationships
 */

import { TestCase } from './data-storage';

// ============ TYPES ============

export interface TestSuiteItem {
  testCaseId: string;
  order: number;
  enabled: boolean;
  lastStatus?: 'passed' | 'failed' | 'skipped' | 'pending';
  lastRun?: string;
  duration?: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  environment: string;
  items: TestSuiteItem[]; // References to test cases
  runOrder: 'sequential' | 'parallel';
  stopOnFailure: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastRun?: {
    timestamp: string;
    duration: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export interface Schedule {
  id: string;
  name: string;
  suiteId: string;
  type: 'cron' | 'interval' | 'once';
  cronExpression?: string;
  intervalMinutes?: number;
  oneTimeDate?: string;
  environment: string;
  browser: 'chromium' | 'firefox' | 'webkit' | 'all';
  enabled: boolean;
  notifyOnFailure: boolean;
  notifyEmail?: string;
  lastRun?: {
    timestamp: string;
    status: 'passed' | 'failed' | 'running';
    duration: number;
  };
  nextRun?: string;
  createdAt: string;
}

export interface Environment {
  id: string;
  name: string;
  type: 'development' | 'qa' | 'staging' | 'production';
  baseUrl: string;
  variables: Record<string, string>;
}

// Cache configuration
const CACHE_TTL = 30000; // 30 seconds cache TTL
const STORAGE_KEYS = {
  TEST_CASES: 'tm_test_cases',
  TEST_SUITES: 'tm_test_suites',
  SCHEDULES: 'tm_schedules',
  ENVIRONMENTS: 'tm_environments',
  CACHE_TIMESTAMPS: 'tm_cache_timestamps',
};

class TestManagementService {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.loadFromLocalStorage();
  }

  // ============ CACHING ============

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_TTL;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    // Persist to localStorage for offline support
    try {
      localStorage.setItem(key, JSON.stringify(data));
      const timestamps = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMPS) || '{}');
      timestamps[key] = Date.now();
      localStorage.setItem(STORAGE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(timestamps));
    } catch (e) {
      console.warn('Failed to persist cache to localStorage:', e);
    }
  }

  private getCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data as T;
    }
    return null;
  }

  private loadFromLocalStorage(): void {
    try {
      const timestamps = JSON.parse(localStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMPS) || '{}');
      
      Object.keys(STORAGE_KEYS).forEach(keyName => {
        const key = STORAGE_KEYS[keyName as keyof typeof STORAGE_KEYS];
        const data = localStorage.getItem(key);
        const timestamp = timestamps[key];
        
        if (data && timestamp) {
          this.cache.set(key, { data: JSON.parse(data), timestamp });
        }
      });
    } catch (e) {
      console.warn('Failed to load cache from localStorage:', e);
    }
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      localStorage.removeItem(key);
    } else {
      this.cache.clear();
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    }
  }

  // ============ DEDUPLICATION ============
  
  // Prevent duplicate concurrent requests
  private async deduplicatedFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.getCache<T>(key);
    if (cached) {
      console.log(`[TMS] Cache hit for ${key}`);
      return cached;
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      console.log(`[TMS] Waiting for pending request: ${key}`);
      return pending;
    }

    // Make new request
    console.log(`[TMS] Fetching: ${key}`);
    const request = fetchFn().then(data => {
      this.setCache(key, data);
      this.pendingRequests.delete(key);
      return data;
    }).catch(error => {
      this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, request);
    return request;
  }

  // ============ TEST CASES ============

  async getTestCases(forceRefresh = false): Promise<TestCase[]> {
    if (forceRefresh) {
      this.invalidateCache(STORAGE_KEYS.TEST_CASES);
    }

    return this.deduplicatedFetch(STORAGE_KEYS.TEST_CASES, async () => {
      const testCases: TestCase[] = [];
      
      // Fetch from both endpoints in parallel
      const [mainResponse, flowstralResponse] = await Promise.allSettled([
        fetch(`${this.baseUrl}/test-cases`),
        fetch(`${this.baseUrl}/api/flowstral/test-cases`),
      ]);

      // Process main endpoint
      if (mainResponse.status === 'fulfilled' && mainResponse.value.ok) {
        try {
          const data = await mainResponse.value.json();
          const cases = Array.isArray(data) ? data : (data.testCases || data.test_cases || []);
          testCases.push(...cases);
        } catch (e) {
          console.warn('Failed to parse main test cases:', e);
        }
      }

      // Process Flowstral endpoint
      if (flowstralResponse.status === 'fulfilled' && flowstralResponse.value.ok) {
        try {
          const data = await flowstralResponse.value.json();
          const flowstralCases = data.test_cases || [];
          const converted = flowstralCases.map((fc: any) => this.convertFlowstralTestCase(fc));
          testCases.push(...converted);
        } catch (e) {
          console.warn('Failed to parse Flowstral test cases:', e);
        }
      }

      // Deduplicate by ID (Flowstral first as they're newer)
      const uniqueCases = new Map<string, TestCase>();
      testCases.forEach(tc => {
        if (!uniqueCases.has(tc.id)) {
          uniqueCases.set(tc.id, tc);
        }
      });

      return Array.from(uniqueCases.values());
    });
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    // First check cache
    const cached = this.getCache<TestCase[]>(STORAGE_KEYS.TEST_CASES);
    if (cached) {
      const found = cached.find(tc => tc.id === id);
      if (found) return found;
    }

    // Fetch from backend
    try {
      const response = await fetch(`${this.baseUrl}/test-cases/${id}`);
      if (response.ok) {
        return await response.json();
      }
      
      // Try Flowstral endpoint
      const flowstralResponse = await fetch(`${this.baseUrl}/api/flowstral/test-cases/${id}`);
      if (flowstralResponse.ok) {
        const data = await flowstralResponse.json();
        return this.convertFlowstralTestCase(data.test_case || data);
      }
    } catch (e) {
      console.error('Failed to fetch test case:', e);
    }
    
    return null;
  }

  async createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestCase> {
    const response = await fetch(`${this.baseUrl}/test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase),
    });

    if (!response.ok) {
      throw new Error(`Failed to create test case: ${response.statusText}`);
    }

    const { id } = await response.json();
    const created: TestCase = {
      ...testCase,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as TestCase;

    // Invalidate cache
    this.invalidateCache(STORAGE_KEYS.TEST_CASES);
    
    return created;
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase | null> {
    const response = await fetch(`${this.baseUrl}/test-cases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Try Flowstral endpoint
        const flowstralResponse = await fetch(`${this.baseUrl}/api/flowstral/test-cases/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!flowstralResponse.ok) return null;
      } else {
        throw new Error(`Failed to update test case: ${response.statusText}`);
      }
    }

    this.invalidateCache(STORAGE_KEYS.TEST_CASES);
    return this.getTestCase(id);
  }

  async deleteTestCase(id: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/test-cases/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      // Try Flowstral endpoint
      const flowstralResponse = await fetch(`${this.baseUrl}/api/flowstral/test-cases/${id}`, {
        method: 'DELETE',
      });
      if (!flowstralResponse.ok) return false;
    }

    this.invalidateCache(STORAGE_KEYS.TEST_CASES);
    return true;
  }

  private convertFlowstralTestCase(fc: any): TestCase {
    const metadata = fc.metadata || {};
    const actions = fc.actions || [];
    
    const steps = actions.map((action: any) => ({
      action: action.description || `${action.type}: ${action.value || action.url || ''}`,
      expectedResult: this.getExpectedResult(action),
    }));
    
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
      tags,
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

  // ============ TEST SUITES ============

  async getTestSuites(): Promise<TestSuite[]> {
    return this.deduplicatedFetch(STORAGE_KEYS.TEST_SUITES, async () => {
      // For now, suites are stored in localStorage (can be moved to backend later)
      const saved = localStorage.getItem(STORAGE_KEYS.TEST_SUITES);
      if (saved) {
        return JSON.parse(saved);
      }
      
      // Return default suites
      const defaultSuites: TestSuite[] = [
        {
          id: 'suite-default-1',
          name: 'Smoke Tests',
          description: 'Quick validation of core functionality',
          environment: 'qa',
          items: [],
          runOrder: 'sequential',
          stopOnFailure: true,
          tags: ['smoke', 'critical'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'suite-default-2',
          name: 'Regression Suite',
          description: 'Full regression test suite',
          environment: 'staging',
          items: [],
          runOrder: 'sequential',
          stopOnFailure: false,
          tags: ['regression'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      this.saveSuitesToStorage(defaultSuites);
      return defaultSuites;
    });
  }

  async getTestSuite(id: string): Promise<TestSuite | null> {
    const suites = await this.getTestSuites();
    return suites.find(s => s.id === id) || null;
  }

  async createTestSuite(suite: Omit<TestSuite, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestSuite> {
    const suites = await this.getTestSuites();
    
    const newSuite: TestSuite = {
      ...suite,
      id: `suite-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    suites.push(newSuite);
    this.saveSuitesToStorage(suites);
    
    return newSuite;
  }

  async updateTestSuite(id: string, updates: Partial<TestSuite>): Promise<TestSuite | null> {
    const suites = await this.getTestSuites();
    const index = suites.findIndex(s => s.id === id);
    
    if (index === -1) return null;
    
    suites[index] = {
      ...suites[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    this.saveSuitesToStorage(suites);
    return suites[index];
  }

  async deleteTestSuite(id: string): Promise<boolean> {
    const suites = await this.getTestSuites();
    const filtered = suites.filter(s => s.id !== id);
    
    if (filtered.length === suites.length) return false;
    
    this.saveSuitesToStorage(filtered);
    return true;
  }

  // Add a test case to a suite
  async addTestCaseToSuite(suiteId: string, testCaseId: string): Promise<boolean> {
    const suite = await this.getTestSuite(suiteId);
    if (!suite) return false;
    
    // Check if already in suite
    if (suite.items.some(item => item.testCaseId === testCaseId)) {
      return true; // Already exists
    }
    
    suite.items.push({
      testCaseId,
      order: suite.items.length + 1,
      enabled: true,
      lastStatus: 'pending',
    });
    
    await this.updateTestSuite(suiteId, { items: suite.items });
    return true;
  }

  // Remove a test case from a suite
  async removeTestCaseFromSuite(suiteId: string, testCaseId: string): Promise<boolean> {
    const suite = await this.getTestSuite(suiteId);
    if (!suite) return false;
    
    suite.items = suite.items.filter(item => item.testCaseId !== testCaseId);
    
    // Reorder
    suite.items.forEach((item, index) => {
      item.order = index + 1;
    });
    
    await this.updateTestSuite(suiteId, { items: suite.items });
    return true;
  }

  // Get suite with full test case details
  async getSuiteWithTestCases(suiteId: string): Promise<{ suite: TestSuite; testCases: TestCase[] } | null> {
    const suite = await this.getTestSuite(suiteId);
    if (!suite) return null;
    
    const allTestCases = await this.getTestCases();
    const testCases = suite.items
      .sort((a, b) => a.order - b.order)
      .map(item => allTestCases.find(tc => tc.id === item.testCaseId))
      .filter(Boolean) as TestCase[];
    
    return { suite, testCases };
  }

  private saveSuitesToStorage(suites: TestSuite[]): void {
    localStorage.setItem(STORAGE_KEYS.TEST_SUITES, JSON.stringify(suites));
    this.setCache(STORAGE_KEYS.TEST_SUITES, suites);
  }

  // ============ ENVIRONMENTS ============

  async getEnvironments(): Promise<Environment[]> {
    return this.deduplicatedFetch(STORAGE_KEYS.ENVIRONMENTS, async () => {
      const saved = localStorage.getItem(STORAGE_KEYS.ENVIRONMENTS);
      if (saved) {
        return JSON.parse(saved);
      }
      
      const defaults: Environment[] = [
        { id: 'env-dev', name: 'Development', type: 'development', baseUrl: 'http://localhost:3000', variables: {} },
        { id: 'env-qa', name: 'QA', type: 'qa', baseUrl: 'https://qa.example.com', variables: {} },
        { id: 'env-staging', name: 'Staging', type: 'staging', baseUrl: 'https://staging.example.com', variables: {} },
        { id: 'env-prod', name: 'Production', type: 'production', baseUrl: 'https://app.example.com', variables: {} },
      ];
      
      localStorage.setItem(STORAGE_KEYS.ENVIRONMENTS, JSON.stringify(defaults));
      return defaults;
    });
  }

  async saveEnvironments(envs: Environment[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENTS, JSON.stringify(envs));
    this.setCache(STORAGE_KEYS.ENVIRONMENTS, envs);
  }

  // ============ SCHEDULES ============

  async getSchedules(): Promise<Schedule[]> {
    return this.deduplicatedFetch(STORAGE_KEYS.SCHEDULES, async () => {
      const saved = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (saved) {
        return JSON.parse(saved);
      }
      return [];
    });
  }

  async saveSchedules(schedules: Schedule[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    this.setCache(STORAGE_KEYS.SCHEDULES, schedules);
  }

  // ============ BULK OPERATIONS ============

  // Preload all data for a page
  async preloadAll(): Promise<{
    testCases: TestCase[];
    testSuites: TestSuite[];
    environments: Environment[];
    schedules: Schedule[];
  }> {
    const [testCases, testSuites, environments, schedules] = await Promise.all([
      this.getTestCases(),
      this.getTestSuites(),
      this.getEnvironments(),
      this.getSchedules(),
    ]);

    return { testCases, testSuites, environments, schedules };
  }
}

// Export singleton
export const testManagementService = new TestManagementService();

// Export types
export type { TestCase };

