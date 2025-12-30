/**
 * Database Service
 * 
 * Unified frontend service for database operations.
 * Uses the new SQLite-based backend API with caching for fast UI loading.
 */

const API_BASE = 'http://localhost:8000/api/db';

// ==================== TYPES ====================

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  steps: any[];
  status: 'draft' | 'approved' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  tags: string[];
  script?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  project_id?: string;
  suite_id?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  test_case_ids: string[];
  test_cases?: TestCase[];  // Populated when fetched with details
  status: 'active' | 'archived';
  created_at: string;
  updated_at?: string;
  project_id?: string;
}

export interface TestRun {
  id: string;
  name: string;
  suite_id?: string;
  test_case_ids: string[];
  status: 'pending' | 'running' | 'passed' | 'failed';
  results: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  project_id?: string;
  browser: string;
  environment: string;
}

export interface Recording {
  id: string;
  name: string;
  url: string;
  actions: any[];
  script?: string;
  status: 'recorded' | 'converted' | 'approved';
  app_type: string;
  framework: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface Element {
  id: string;
  name: string;
  selector: string;
  selector_type: 'css' | 'xpath' | 'text' | 'role';
  page_name?: string;
  app_type: string;
  attributes?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface DatabaseStats {
  test_cases: number;
  test_suites: number;
  test_runs: number;
  test_plans: number;
  recordings: number;
  elements: number;
  defects: number;
  database_type: string;
  database_path: string;
}

// ==================== CACHE ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ttl: number = 30000; // 30 seconds default

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (ttl || this.ttl)
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new SimpleCache();

// ==================== API HELPERS ====================

async function fetchApi<T>(
  endpoint: string, 
  options?: RequestInit,
  cacheKey?: string,
  cacheTtl?: number
): Promise<T> {
  // Check cache first for GET requests
  if (cacheKey && (!options || options.method === 'GET')) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      console.log(`[DB] Cache hit: ${cacheKey}`);
      return cached;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  const data = await response.json();

  // Cache the result for GET requests
  if (cacheKey && (!options || options.method === 'GET')) {
    cache.set(cacheKey, data, cacheTtl);
  }

  return data;
}

// ==================== TEST CASES ====================

export const testCasesApi = {
  async getAll(filters?: {
    status?: string;
    priority?: string;
    category?: string;
    suite_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<TestCase[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.suite_id) params.set('suite_id', filters.suite_id);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));

    const query = params.toString();
    return fetchApi<TestCase[]>(
      `/test-cases${query ? `?${query}` : ''}`,
      undefined,
      `test_cases_${query}`,
      30000
    );
  },

  async get(id: string): Promise<TestCase> {
    return fetchApi<TestCase>(`/test-cases/${id}`, undefined, `test_case_${id}`);
  },

  async create(data: Omit<TestCase, 'id' | 'created_at' | 'updated_at'>): Promise<TestCase> {
    cache.invalidate('test_cases');
    return fetchApi<TestCase>('/test-cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<TestCase>): Promise<TestCase> {
    cache.invalidate('test_case');
    cache.invalidate('test_cases');
    return fetchApi<TestCase>(`/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    cache.invalidate('test_case');
    cache.invalidate('test_cases');
    await fetchApi(`/test-cases/${id}`, { method: 'DELETE' });
  },

  async search(query: string): Promise<TestCase[]> {
    return fetchApi<TestCase[]>(`/test-cases/search/${encodeURIComponent(query)}`);
  },
};

// ==================== TEST SUITES ====================

export const testSuitesApi = {
  async getAll(filters?: { status?: string }): Promise<TestSuite[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return fetchApi<TestSuite[]>(
      `/test-suites${query ? `?${query}` : ''}`,
      undefined,
      `test_suites_${query}`,
      30000
    );
  },

  async get(id: string): Promise<TestSuite> {
    return fetchApi<TestSuite>(`/test-suites/${id}`, undefined, `test_suite_${id}`);
  },

  async create(data: {
    name: string;
    description?: string;
    test_case_ids?: string[];
    project_id?: string;
  }): Promise<TestSuite> {
    cache.invalidate('test_suites');
    return fetchApi<TestSuite>('/test-suites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<TestSuite>): Promise<TestSuite> {
    cache.invalidate('test_suite');
    cache.invalidate('test_suites');
    return fetchApi<TestSuite>(`/test-suites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    cache.invalidate('test_suite');
    cache.invalidate('test_suites');
    await fetchApi(`/test-suites/${id}`, { method: 'DELETE' });
  },

  async addTestCase(suiteId: string, testCaseId: string): Promise<void> {
    cache.invalidate('test_suite');
    cache.invalidate('test_suites');
    await fetchApi(`/test-suites/${suiteId}/add-test-case/${testCaseId}`, {
      method: 'POST',
    });
  },
};

// ==================== TEST RUNS ====================

export const testRunsApi = {
  async getAll(filters?: { status?: string }): Promise<TestRun[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return fetchApi<TestRun[]>(
      `/test-runs${query ? `?${query}` : ''}`,
      undefined,
      `test_runs_${query}`,
      15000  // Shorter TTL for runs
    );
  },

  async get(id: string): Promise<TestRun> {
    return fetchApi<TestRun>(`/test-runs/${id}`, undefined, `test_run_${id}`, 5000);
  },

  async create(data: {
    name: string;
    suite_id?: string;
    test_case_ids?: string[];
    browser?: string;
    environment?: string;
  }): Promise<TestRun> {
    cache.invalidate('test_runs');
    return fetchApi<TestRun>('/test-runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<TestRun>): Promise<TestRun> {
    cache.invalidate('test_run');
    cache.invalidate('test_runs');
    return fetchApi<TestRun>(`/test-runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ==================== RECORDINGS ====================

export const recordingsApi = {
  async getAll(filters?: { status?: string }): Promise<Recording[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return fetchApi<Recording[]>(
      `/recordings${query ? `?${query}` : ''}`,
      undefined,
      `recordings_${query}`,
      30000
    );
  },

  async get(id: string): Promise<Recording> {
    return fetchApi<Recording>(`/recordings/${id}`, undefined, `recording_${id}`);
  },

  async create(data: Omit<Recording, 'id' | 'created_at'>): Promise<Recording> {
    cache.invalidate('recordings');
    return fetchApi<Recording>('/recordings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    cache.invalidate('recording');
    cache.invalidate('recordings');
    await fetchApi(`/recordings/${id}`, { method: 'DELETE' });
  },
};

// ==================== ELEMENTS ====================

export const elementsApi = {
  async getAll(filters?: { page_name?: string; app_type?: string }): Promise<Element[]> {
    const params = new URLSearchParams();
    if (filters?.page_name) params.set('page_name', filters.page_name);
    if (filters?.app_type) params.set('app_type', filters.app_type);
    const query = params.toString();
    return fetchApi<Element[]>(
      `/elements${query ? `?${query}` : ''}`,
      undefined,
      `elements_${query}`,
      60000  // Elements don't change often
    );
  },

  async create(data: Omit<Element, 'id' | 'created_at' | 'updated_at'>): Promise<Element> {
    cache.invalidate('elements');
    return fetchApi<Element>('/elements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==================== ADMIN ====================

export const adminApi = {
  async getStats(): Promise<DatabaseStats> {
    return fetchApi<DatabaseStats>('/stats', undefined, 'db_stats', 10000);
  },

  async backup(): Promise<{ status: string; backup_path: string }> {
    return fetchApi('/backup', { method: 'POST' });
  },

  async clearCache(): Promise<void> {
    cache.invalidate();
    await fetchApi('/clear-cache', { method: 'POST' });
  },

  async migrateFromJson(): Promise<{ status: string; migrated_count: number }> {
    cache.invalidate();
    return fetchApi('/migrate', { method: 'POST' });
  },
};

// ==================== UNIFIED SERVICE ====================

export const databaseService = {
  testCases: testCasesApi,
  testSuites: testSuitesApi,
  testRuns: testRunsApi,
  recordings: recordingsApi,
  elements: elementsApi,
  admin: adminApi,
  
  // Clear all caches
  clearCache: () => cache.invalidate(),
};

export default databaseService;

