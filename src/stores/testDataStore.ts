/**
 * Enterprise Test Data Store
 * ==========================
 * Global state management with Zustand for test management system.
 * 
 * Features:
 * - Persists state across navigation (no more zero counts on tab switch)
 * - Optimistic updates for better UX
 * - Middleware for logging and persistence
 * - Type-safe selectors
 * 
 * Architecture:
 * - Stores metadata only (counts, current page, filters)
 * - Actual data fetched via React Query hooks
 * - Supports offline mode (future)
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// TYPES
// ============================================================================

export interface TestCaseListItem {
  id: string;
  name: string;
  description?: string;
  folder_id?: string;
  folder_name?: string;
  priority: string;
  status?: string;
  tags: string[];
  automation_status: string;
  created_at?: string;
  updated_at?: string;
}

export interface TestCaseFull extends TestCaseListItem {
  steps: TestStep[];
  automation_script_path?: string;
}

export interface TestStep {
  id: string;
  order: number;
  action: string;
  data?: string;
  expected?: string;
  locator?: string;
  isAutomated?: boolean;
  automationCode?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  testCaseIds: string[];
  created_at?: string;
}

export interface TestPlan {
  id: string;
  name: string;
  description?: string;
  status: string;
  suiteIds: string[];
  testCaseIds: string[];
  startDate?: string;
  endDate?: string;
  created_at?: string;
}

export interface Release {
  id: string;
  name: string;
  description?: string;
  status: string;
  suiteIds: string[];
  version?: string;
  releaseDate?: string;
  created_at?: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FilterState {
  search: string;
  priority: string | null;
  automationStatus: string | null;
  folderId: string | null;
  sortBy: 'name' | 'priority' | 'updated_at' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export interface SummaryState {
  testCases: number;
  suites: number;
  plans: number;
  releases: number;
  automated: number;
  manual: number;
  lastUpdated: number | null;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface TestDataState {
  // Summary counts (cached)
  summary: SummaryState;
  
  // Current view state
  pagination: PaginationState;
  filters: FilterState;
  
  // Currently loaded items (for display)
  testCases: TestCaseListItem[];
  suites: TestSuite[];
  plans: TestPlan[];
  releases: Release[];
  
  // Currently selected/open item
  selectedTestCaseId: string | null;
  selectedTestCase: TestCaseFull | null;
  
  // UI state
  activeTab: 'repository' | 'suites' | 'plans' | 'releases' | 'execution';
  isLoading: boolean;
  error: string | null;
  
  // API base URL
  apiBaseUrl: string;
}

interface TestDataActions {
  // Summary
  setSummary: (summary: Partial<SummaryState>) => void;
  refreshSummary: () => Promise<void>;
  
  // Pagination
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  
  // Filters
  setSearch: (search: string) => void;
  setPriority: (priority: string | null) => void;
  setAutomationStatus: (status: string | null) => void;
  setFolderId: (folderId: string | null) => void;
  setSortBy: (sortBy: FilterState['sortBy']) => void;
  setSortOrder: (order: FilterState['sortOrder']) => void;
  resetFilters: () => void;
  
  // Data
  setTestCases: (testCases: TestCaseListItem[], pagination?: Partial<PaginationState>) => void;
  setSuites: (suites: TestSuite[]) => void;
  setPlans: (plans: TestPlan[]) => void;
  setReleases: (releases: Release[]) => void;
  
  // Selection
  selectTestCase: (id: string | null) => void;
  setSelectedTestCase: (tc: TestCaseFull | null) => void;
  
  // UI
  setActiveTab: (tab: TestDataState['activeTab']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API
  setApiBaseUrl: (url: string) => void;
  
  // Utility
  reset: () => void;
}

type TestDataStore = TestDataState & TestDataActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const defaultFilters: FilterState = {
  search: '',
  priority: null,
  automationStatus: null,
  folderId: null,
  sortBy: 'updated_at',
  sortOrder: 'desc',
};

const defaultPagination: PaginationState = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

const defaultSummary: SummaryState = {
  testCases: 0,
  suites: 0,
  plans: 0,
  releases: 0,
  automated: 0,
  manual: 0,
  lastUpdated: null,
};

const initialState: TestDataState = {
  summary: defaultSummary,
  pagination: defaultPagination,
  filters: defaultFilters,
  testCases: [],
  suites: [],
  plans: [],
  releases: [],
  selectedTestCaseId: null,
  selectedTestCase: null,
  activeTab: 'repository',
  isLoading: false,
  error: null,
  apiBaseUrl: 'http://localhost:8000',
};

// ============================================================================
// STORE
// ============================================================================

export const useTestDataStore = create<TestDataStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        ...initialState,
        
        // Summary actions
        setSummary: (summary) => set((state) => ({
          summary: { ...state.summary, ...summary, lastUpdated: Date.now() }
        })),
        
        refreshSummary: async () => {
          try {
            const response = await fetch(`${get().apiBaseUrl}/api/v2/summary`);
            if (!response.ok) throw new Error('Failed to fetch summary');
            const data = await response.json();
            set({ summary: { ...data, lastUpdated: Date.now() } });
          } catch (error) {
            console.error('Failed to refresh summary:', error);
          }
        },
        
        // Pagination actions
        setPage: (page) => set((state) => ({
          pagination: { ...state.pagination, page }
        })),
        
        setLimit: (limit) => set((state) => ({
          pagination: { ...state.pagination, limit, page: 1 }
        })),
        
        setPagination: (pagination) => set((state) => ({
          pagination: { ...state.pagination, ...pagination }
        })),
        
        // Filter actions
        setSearch: (search) => set((state) => ({
          filters: { ...state.filters, search },
          pagination: { ...state.pagination, page: 1 }
        })),
        
        setPriority: (priority) => set((state) => ({
          filters: { ...state.filters, priority },
          pagination: { ...state.pagination, page: 1 }
        })),
        
        setAutomationStatus: (automationStatus) => set((state) => ({
          filters: { ...state.filters, automationStatus },
          pagination: { ...state.pagination, page: 1 }
        })),
        
        setFolderId: (folderId) => set((state) => ({
          filters: { ...state.filters, folderId },
          pagination: { ...state.pagination, page: 1 }
        })),
        
        setSortBy: (sortBy) => set((state) => ({
          filters: { ...state.filters, sortBy }
        })),
        
        setSortOrder: (sortOrder) => set((state) => ({
          filters: { ...state.filters, sortOrder }
        })),
        
        resetFilters: () => set({
          filters: defaultFilters,
          pagination: { ...defaultPagination }
        }),
        
        // Data actions
        setTestCases: (testCases, pagination) => set((state) => ({
          testCases,
          pagination: pagination ? { ...state.pagination, ...pagination } : state.pagination
        })),
        
        setSuites: (suites) => set({ suites }),
        setPlans: (plans) => set({ plans }),
        setReleases: (releases) => set({ releases }),
        
        // Selection actions
        selectTestCase: (id) => set({ 
          selectedTestCaseId: id,
          selectedTestCase: id === null ? null : get().selectedTestCase 
        }),
        
        setSelectedTestCase: (tc) => set({ 
          selectedTestCase: tc,
          selectedTestCaseId: tc?.id || null 
        }),
        
        // UI actions
        setActiveTab: (activeTab) => set({ activeTab }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        
        // API
        setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
        
        // Utility
        reset: () => set(initialState),
      })),
      {
        name: 'test-data-store',
        partialize: (state) => ({
          // Only persist these fields
          summary: state.summary,
          filters: state.filters,
          pagination: { page: state.pagination.page, limit: state.pagination.limit },
          activeTab: state.activeTab,
          apiBaseUrl: state.apiBaseUrl,
        }),
      }
    ),
    { name: 'TestDataStore' }
  )
);

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const selectSummary = (state: TestDataStore) => state.summary;
export const selectTestCases = (state: TestDataStore) => state.testCases;
export const selectPagination = (state: TestDataStore) => state.pagination;
export const selectFilters = (state: TestDataStore) => state.filters;
export const selectSelectedTestCase = (state: TestDataStore) => state.selectedTestCase;
export const selectIsLoading = (state: TestDataStore) => state.isLoading;
export const selectActiveTab = (state: TestDataStore) => state.activeTab;

// Computed selectors
export const selectTotalTests = (state: TestDataStore) => state.summary.testCases;
export const selectTotalSuites = (state: TestDataStore) => state.summary.suites;
export const selectTotalPlans = (state: TestDataStore) => state.summary.plans;
export const selectTotalReleases = (state: TestDataStore) => state.summary.releases;
export const selectAutomatedCount = (state: TestDataStore) => state.summary.automated;
export const selectManualCount = (state: TestDataStore) => state.summary.manual;

