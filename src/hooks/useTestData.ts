/**
 * Enterprise Test Data Hooks
 * ==========================
 * React Query hooks for fetching test data with caching.
 * 
 * Features:
 * - Automatic caching (stale-while-revalidate)
 * - Background refetching
 * - Optimistic updates
 * - Error handling
 * - Pagination support
 * 
 * Usage:
 *   const { data, isLoading } = useTestCases({ page: 1, limit: 50 });
 *   const { data: summary } = useSummary();
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useTestDataStore } from '../stores/testDataStore';

// ============================================================================
// API CLIENT
// ============================================================================

const API_BASE = 'http://localhost:8000/api/v2';

interface FetchOptions {
  signal?: AbortSignal;
}

class TestDataAPI {
  private baseUrl: string;
  
  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }
  
  private async fetch<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getSummary(options?: FetchOptions): Promise<SummaryResponse> {
    return this.fetch('/summary', options);
  }
  
  async getTestCases(params: TestCasesParams, options?: FetchOptions): Promise<TestCasesResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page || 1));
    searchParams.set('limit', String(params.limit || 50));
    
    if (params.search) searchParams.set('search', params.search);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.status) searchParams.set('status', params.status);
    if (params.folderId) searchParams.set('folder_id', params.folderId);
    if (params.sortBy) searchParams.set('sort_by', params.sortBy);
    if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);
    
    return this.fetch(`/test-cases?${searchParams.toString()}`, options);
  }
  
  async getTestCase(id: string, options?: FetchOptions): Promise<TestCaseDetail> {
    return this.fetch(`/test-cases/${id}`, options);
  }
  
  async getSuites(params: PaginationParams, options?: FetchOptions): Promise<SuitesResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page || 1));
    searchParams.set('limit', String(params.limit || 50));
    return this.fetch(`/suites?${searchParams.toString()}`, options);
  }
  
  async getPlans(params: PaginationParams, options?: FetchOptions): Promise<PlansResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page || 1));
    searchParams.set('limit', String(params.limit || 50));
    return this.fetch(`/plans?${searchParams.toString()}`, options);
  }
  
  async getReleases(params: PaginationParams, options?: FetchOptions): Promise<ReleasesResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page || 1));
    searchParams.set('limit', String(params.limit || 50));
    return this.fetch(`/releases?${searchParams.toString()}`, options);
  }
  
  async invalidateCache(): Promise<void> {
    await this.fetch('/cache/invalidate', {});
  }
}

export const testDataAPI = new TestDataAPI();

// ============================================================================
// TYPES
// ============================================================================

export interface SummaryResponse {
  testCases: number;
  suites: number;
  plans: number;
  releases: number;
  automated?: number;
  manual?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface TestCasesParams extends PaginationParams {
  search?: string;
  priority?: string;
  status?: string;
  folderId?: string;
  sortBy?: string;
  sortOrder?: string;
}

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

export interface TestCaseDetail extends TestCaseListItem {
  steps: TestStep[];
  automation_script_path?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  items?: T[];
}

export interface TestCasesResponse extends PaginatedResponse<TestCaseListItem> {
  testCases: TestCaseListItem[];
}

export interface Suite {
  id: string;
  name: string;
  description?: string;
  testCaseIds: string[];
  test_case_ids?: string;
  created_at?: string;
}

export interface SuitesResponse extends PaginatedResponse<Suite> {
  suites: Suite[];
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  status: string;
  suiteIds: string[];
  testCaseIds: string[];
  suite_ids?: string;
  test_case_ids?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
}

export interface PlansResponse extends PaginatedResponse<Plan> {
  plans: Plan[];
}

export interface Release {
  id: string;
  name: string;
  description?: string;
  status: string;
  suiteIds: string[];
  suite_ids?: string;
  version?: string;
  release_date?: string;
  created_at?: string;
}

export interface ReleasesResponse extends PaginatedResponse<Release> {
  releases: Release[];
}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const queryKeys = {
  all: ['testData'] as const,
  summary: () => [...queryKeys.all, 'summary'] as const,
  testCases: () => [...queryKeys.all, 'testCases'] as const,
  testCasesList: (params: TestCasesParams) => [...queryKeys.testCases(), 'list', params] as const,
  testCaseDetail: (id: string) => [...queryKeys.testCases(), 'detail', id] as const,
  suites: () => [...queryKeys.all, 'suites'] as const,
  suitesList: (params: PaginationParams) => [...queryKeys.suites(), 'list', params] as const,
  plans: () => [...queryKeys.all, 'plans'] as const,
  plansList: (params: PaginationParams) => [...queryKeys.plans(), 'list', params] as const,
  releases: () => [...queryKeys.all, 'releases'] as const,
  releasesList: (params: PaginationParams) => [...queryKeys.releases(), 'list', params] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch summary counts
 * Cached for 60 seconds, background refresh enabled
 */
export function useSummary(options?: Partial<UseQueryOptions<SummaryResponse>>) {
  const setSummary = useTestDataStore((state) => state.setSummary);
  
  return useQuery({
    queryKey: queryKeys.summary(),
    queryFn: ({ signal }) => testDataAPI.getSummary({ signal }),
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    ...options,
    // Update store when data arrives
    select: (data) => {
      setSummary(data);
      return data;
    },
  });
}

/**
 * Fetch paginated test cases
 * Automatically uses filters from store if not provided
 */
export function useTestCases(params?: TestCasesParams, options?: Partial<UseQueryOptions<TestCasesResponse>>) {
  const storeFilters = useTestDataStore((state) => state.filters);
  const storePagination = useTestDataStore((state) => state.pagination);
  const setTestCases = useTestDataStore((state) => state.setTestCases);
  
  // Merge params with store state
  const mergedParams: TestCasesParams = {
    page: params?.page ?? storePagination.page,
    limit: params?.limit ?? storePagination.limit,
    search: params?.search ?? (storeFilters.search || undefined),
    priority: params?.priority ?? (storeFilters.priority || undefined),
    status: params?.status ?? (storeFilters.automationStatus || undefined),
    folderId: params?.folderId ?? (storeFilters.folderId || undefined),
    sortBy: params?.sortBy ?? storeFilters.sortBy,
    sortOrder: params?.sortOrder ?? storeFilters.sortOrder,
  };
  
  return useQuery({
    queryKey: queryKeys.testCasesList(mergedParams),
    queryFn: ({ signal }) => testDataAPI.getTestCases(mergedParams, { signal }),
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
    gcTime: 10 * 60 * 1000, // Cache for 10 minutes
    placeholderData: (previousData) => previousData, // Show old data while fetching
    ...options,
    select: (data) => {
      // Update store with fetched data
      setTestCases(data.testCases, {
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev,
      });
      return data;
    },
  });
}

/**
 * Fetch single test case with full details (including steps)
 * Use this when opening a test case in the builder
 */
export function useTestCaseDetail(testCaseId: string | null, options?: Partial<UseQueryOptions<TestCaseDetail>>) {
  const setSelectedTestCase = useTestDataStore((state) => state.setSelectedTestCase);
  
  return useQuery({
    queryKey: queryKeys.testCaseDetail(testCaseId || ''),
    queryFn: ({ signal }) => testDataAPI.getTestCase(testCaseId!, { signal }),
    enabled: !!testCaseId,
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Cache for 30 minutes
    ...options,
    select: (data) => {
      setSelectedTestCase(data as any);
      return data;
    },
  });
}

/**
 * Fetch paginated suites
 */
export function useSuites(params?: PaginationParams, options?: Partial<UseQueryOptions<SuitesResponse>>) {
  const setSuites = useTestDataStore((state) => state.setSuites);
  
  const mergedParams: PaginationParams = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
  };
  
  return useQuery({
    queryKey: queryKeys.suitesList(mergedParams),
    queryFn: ({ signal }) => testDataAPI.getSuites(mergedParams, { signal }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    ...options,
    select: (data) => {
      setSuites(data.suites as any);
      return data;
    },
  });
}

/**
 * Fetch paginated plans
 */
export function usePlans(params?: PaginationParams, options?: Partial<UseQueryOptions<PlansResponse>>) {
  const setPlans = useTestDataStore((state) => state.setPlans);
  
  const mergedParams: PaginationParams = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
  };
  
  return useQuery({
    queryKey: queryKeys.plansList(mergedParams),
    queryFn: ({ signal }) => testDataAPI.getPlans(mergedParams, { signal }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    ...options,
    select: (data) => {
      setPlans(data.plans as any);
      return data;
    },
  });
}

/**
 * Fetch paginated releases
 */
export function useReleases(params?: PaginationParams, options?: Partial<UseQueryOptions<ReleasesResponse>>) {
  const setReleases = useTestDataStore((state) => state.setReleases);
  
  const mergedParams: PaginationParams = {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
  };
  
  return useQuery({
    queryKey: queryKeys.releasesList(mergedParams),
    queryFn: ({ signal }) => testDataAPI.getReleases(mergedParams, { signal }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    ...options,
    select: (data) => {
      setReleases(data.releases as any);
      return data;
    },
  });
}

/**
 * Invalidate all cached data
 * Use after bulk imports or data changes
 */
export function useInvalidateCache() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => testDataAPI.invalidateCache(),
    onSuccess: () => {
      // Invalidate all test data queries
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
}

/**
 * Prefetch test case detail
 * Call this when hovering over a test case to preload
 */
export function usePrefetchTestCase() {
  const queryClient = useQueryClient();
  
  return (testCaseId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.testCaseDetail(testCaseId),
      queryFn: () => testDataAPI.getTestCase(testCaseId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Get current page data from store (no refetch)
 */
export function useCurrentTestCases() {
  return useTestDataStore((state) => state.testCases);
}

/**
 * Get summary from store
 */
export function useStoreSummary() {
  return useTestDataStore((state) => state.summary);
}

/**
 * Get and set pagination
 */
export function usePagination() {
  const pagination = useTestDataStore((state) => state.pagination);
  const setPage = useTestDataStore((state) => state.setPage);
  const setLimit = useTestDataStore((state) => state.setLimit);
  
  return {
    ...pagination,
    setPage,
    setLimit,
    goToPage: setPage,
    nextPage: () => pagination.hasNext && setPage(pagination.page + 1),
    prevPage: () => pagination.hasPrev && setPage(pagination.page - 1),
  };
}

/**
 * Get and set filters
 */
export function useFilters() {
  const filters = useTestDataStore((state) => state.filters);
  const setSearch = useTestDataStore((state) => state.setSearch);
  const setPriority = useTestDataStore((state) => state.setPriority);
  const setAutomationStatus = useTestDataStore((state) => state.setAutomationStatus);
  const resetFilters = useTestDataStore((state) => state.resetFilters);
  
  return {
    ...filters,
    setSearch,
    setPriority,
    setAutomationStatus,
    resetFilters,
  };
}


