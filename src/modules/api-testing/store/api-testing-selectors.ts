/**
 * Typed selectors for memoized component subscriptions to the API Testing Store.
 * Each selector subscribes to only the slice of state it needs,
 * preventing unnecessary re-renders in consuming components.
 */
import { shallow } from 'zustand/shallow';
import { useApiTestingStore } from './apiTestingStore';
import type { ApiTestRun, RequestResultInfo } from './api-testing-types';

// Re-export the type for consumers
export type { RequestResultInfo } from './api-testing-types';

// ============================================================================
// TYPED SELECTORS
// ============================================================================

/** Subscribe to only sidebar state - sidebar won't re-render when other state changes */
const _emptySidebarFolders = new Set<string>();
const _emptySidebarEndpoints = new Set<string>();
export const useSidebarState = () => useApiTestingStore((s) => {
  const sb = s.sidebar;
  // Defensive: ensure Sets exist even if rehydration/merge lost them
  if (!sb.expanded_folders || typeof sb.expanded_folders.has !== 'function') {
    return { ...sb, expanded_folders: _emptySidebarFolders, expanded_endpoints: _emptySidebarEndpoints };
  }
  if (!sb.expanded_endpoints || typeof sb.expanded_endpoints.has !== 'function') {
    return { ...sb, expanded_endpoints: _emptySidebarEndpoints };
  }
  return sb;
});

/** Subscribe to only active collection ID (stable primitive) */
export const useActiveCollectionId = () => useApiTestingStore((s) => s.active_collection_id);

/** Subscribe to only active collection - uses shallow compare to avoid infinite getSnapshot loop */
export const useActiveCollection = () => useApiTestingStore((s) => {
  if (!s.active_collection_id) return null;
  return s.collections[s.active_collection_id] || null;
}, (a, b) => {
  // Deep-stable comparison: same ID + same request count + same name means "equal"
  if (a === b) return true;
  if (!a || !b) return a === b;
  return a.id === b.id
    && a.name === b.name
    && a.requests.length === b.requests.length
    && a.folders.length === b.folders.length
    && a.updated_at === b.updated_at;
});

/** Subscribe to workspace list */
export const useWorkspaces = () => useApiTestingStore((s) => s.workspaces);

/** Subscribe to active tab only */
export const useActiveTab = () => useApiTestingStore((s) => s.active_tab);

/** Subscribe to environments */
export const useApiEnvironments = () => useApiTestingStore((s) => s.environments);

/** Subscribe to loading states */
export const useApiLoadingState = () => useApiTestingStore((s) => s.loading, shallow);

/** Subscribe to test runs */
export const useApiTestRuns = () => useApiTestingStore((s) => s.test_runs);

/** Subscribe to execution state */
export const useApiExecutionState = () => useApiTestingStore((s) => ({
  executing: s.executing,
  execution_results: s.execution_results,
  execution_mode: s.execution_mode,
}), shallow);

/** Subscribe to builder state */
export const useBuilderState = () => useApiTestingStore((s) => ({
  request_id: s.builder_request_id,
  initial_data: s.builder_initial_data,
}), shallow);

/** Subscribe to sync status */
export const useSyncStatus = () => useApiTestingStore((s) => ({
  status: s.sync_status,
  last_sync: s.last_sync,
}), shallow);

/** Get store actions only (stable reference, never triggers re-render) */
export const useApiTestingActions = () => useApiTestingStore((s) => ({
  initialize: s.initialize,
  importCollection: s.importCollection,
  openRequestInBuilder: s.openRequestInBuilder,
  switchCollection: s.switchCollection,
  createCollection: s.createCollection,
  deleteCollection: s.deleteCollection,
  addRequest: s.addRequest,
  updateRequest: s.updateRequest,
  deleteRequest: s.deleteRequest,
  createFolder: s.createFolder,
  setSidebarOpen: s.setSidebarOpen,
  setSidebarSearch: s.setSidebarSearch,
}), shallow);

// ============================================================================
// PURE HELPERS (for use with useMemo in components)
// ============================================================================

/**
 * Compute latest test result for each request from test_runs.
 * Returns a map: request_id -> { status, response_status, time }.
 * Use with useMemo: `const resultMap = useMemo(() => getLatestResultMap(testRuns), [testRuns]);`
 */
export function getLatestResultMap(testRuns: ApiTestRun[]): Record<string, RequestResultInfo> {
  const map: Record<string, RequestResultInfo> = {};
  // Process runs from newest to oldest so we keep only the latest result per request
  const sortedRuns = [...testRuns].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  for (const run of sortedRuns) {
    if (run.status === 'passed' || run.status === 'failed') {
      for (const r of run.results) {
        if (r.request_id && !map[r.request_id]) {
          map[r.request_id] = { status: r.status, response_status: r.response_status, time: r.response_time_ms };
        }
      }
    }
  }
  return map;
}

/**
 * Compute folder-level summary stats from a result map.
 */
export function getFolderStats(
  requestIds: string[],
  resultMap: Record<string, RequestResultInfo>
): { total: number; passed: number; failed: number; untested: number } {
  let passed = 0, failed = 0, untested = 0;
  for (const id of requestIds) {
    const r = resultMap[id];
    if (!r) untested++;
    else if (r.status === 'passed') passed++;
    else failed++;
  }
  return { total: requestIds.length, passed, failed, untested };
}
