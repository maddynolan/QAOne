/**
 * Pure helper functions for the API Testing Store.
 * No React or Zustand dependencies.
 */
import type {
  ApiCollection, ApiFolder, ApiRequest, ApiTestingState, ApiTestingActions,
} from './api-testing-types';

// ============================================================================
// HELPERS
// ============================================================================

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export const DEBOUNCE_MS = 800;  // Faster than old 1500ms but still batches

/**
 * Ensure sidebar Sets exist (they can be lost during persist rehydration
 * because JSON.stringify(Set) → "{}" and rehydration does shallow merge).
 * Call this inside any immer `set()` callback that touches sidebar Sets.
 */
export function ensureSidebarSets(s: any): void {
  if (!s.sidebar.expanded_folders || typeof s.sidebar.expanded_folders.has !== 'function') {
    s.sidebar.expanded_folders = new Set<string>();
  }
  if (!s.sidebar.expanded_endpoints || typeof s.sidebar.expanded_endpoints.has !== 'function') {
    s.sidebar.expanded_endpoints = new Set<string>();
  }
}

/** Ensure selected_test_case_ids Set exists. */
export function ensureTestCaseSet(s: any): void {
  if (!s.selected_test_case_ids || typeof s.selected_test_case_ids.has !== 'function') {
    s.selected_test_case_ids = new Set<string>();
  }
}

// ============================================================================
// MIGRATION: Convert legacy single-blob collection to new format
// ============================================================================

export function legacyPayloadToCollection(payload: any, workspaceId: string, name?: string): ApiCollection {
  const id = generateId();

  // Extract test cases from legacy format
  const baseCases: any[] = payload.test_cases || [];
  const categoryList: any[] = payload.test_categories
    ? Object.values(payload.test_categories).flat().filter(Boolean) as any[]
    : [];

  // Deduplicate
  const seenIds = new Set<string>();
  const allCases: any[] = [];

  for (const tc of [...baseCases, ...categoryList]) {
    const tcId = tc.test_case_id || tc.test_id || tc.id || tc.name || tc.title;
    if (tcId && seenIds.has(String(tcId))) continue;
    if (tcId) seenIds.add(String(tcId));
    allCases.push(tc);
  }

  // Convert to ApiRequest format
  const requests: ApiRequest[] = allCases.map((tc, idx) => ({
    id: tc.test_case_id || tc.test_id || tc.id || generateId(),
    collection_id: id,
    folder_id: null,
    name: tc.title || tc.name || `${tc.method || 'GET'} ${tc.path || tc.endpoint || '/'}`,
    method: (tc.method || 'GET').toUpperCase(),
    url: tc.endpoint || tc.path || '',
    path: tc.path || tc.endpoint || '',
    headers: tc.request?.headers
      ? Object.entries(tc.request.headers).map(([k, v]) => ({ key: k, value: String(v), enabled: true }))
      : [{ key: 'Content-Type', value: 'application/json', enabled: true }],
    params: [],
    body_type: 'json',
    body: typeof tc.request?.body === 'string' ? tc.request.body : JSON.stringify(tc.request?.body || ''),
    auth_type: 'none',
    auth_config: {},
    assertions: Array.isArray(tc.assertions) ? tc.assertions : [],
    pre_request_vars: {},
    test_type: tc.test_type || 'functional',
    expected_status: tc.expected_status || 200,
    description: tc.description || '',
    tags: [],
    sort_order: idx,
    created_at: nowISO(),
    updated_at: nowISO(),
  }));

  // Convert folders
  const folders: ApiFolder[] = (payload.folders || []).map((f: any, idx: number) => ({
    id: f.id || generateId(),
    name: f.name || 'Folder',
    description: '',
    parent_folder_id: null,
    request_ids: (f.test_case_ids || []).filter((tcId: string) => requests.some(r => r.id === tcId)),
    sort_order: idx,
    expanded: true,
  }));

  // Assign requests to folders
  for (const folder of folders) {
    for (const reqId of folder.request_ids) {
      const req = requests.find(r => r.id === reqId);
      if (req) req.folder_id = folder.id;
    }
  }

  return {
    id,
    workspace_id: workspaceId,
    name: name || payload.name || 'Imported Collection',
    description: payload.description || '',
    base_url: payload.base_url || '',
    folders,
    requests,
    chains: [],
    environment_ids: [],
    variables: {},
    metadata: payload.metadata || {},
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}

// ============================================================================
// LEGACY DATA MIGRATION
// ============================================================================

export async function migrateLegacyData(get: () => ApiTestingState & ApiTestingActions, set: any) {
  // Check if we already have collections loaded
  const state = get();
  if (Object.keys(state.collections).length > 0) return;

  // Try to migrate from legacy localStorage chains
  try {
    const savedChains = localStorage.getItem('api_saved_chains');
    if (savedChains) {
      console.log('[ApiTestingStore] Found legacy chains in localStorage, will migrate on collection load');
    }
  } catch { /* ignore */ }

  // Migrate global variables
  try {
    const raw = localStorage.getItem('api_global_variables');
    if (raw) {
      const vars = JSON.parse(raw);
      set((s: ApiTestingState) => { s.global_variables = vars; });
    }
  } catch { /* ignore */ }

  // Migrate collection variables
  try {
    const raw = localStorage.getItem('api_collection_variables');
    if (raw) {
      const vars = JSON.parse(raw);
      // Will be applied to active collection when one is loaded
      console.log('[ApiTestingStore] Found legacy collection variables:', Object.keys(vars).length);
    }
  } catch { /* ignore */ }
}
