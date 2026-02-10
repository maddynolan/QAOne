/**
 * API Testing Store
 * =================
 * Dedicated Zustand store for the entire API Testing module.
 * 
 * Replaces the 59+ useState hooks in EnhancedAPITesting.tsx with a single,
 * optimized global store. Key improvements:
 * 
 * 1. WORKSPACE SYSTEM - Multiple collections without sidebar reloads
 * 2. COLLECTION PERSISTENCE - Granular DB operations (not single-blob)
 * 3. CHAIN PERSISTENCE - Saved to DB, not localStorage
 * 4. MEMOIZED SELECTORS - Sidebar won't re-render on unrelated state changes
 * 5. OPTIMISTIC UPDATES - Instant UI, background sync
 * 
 * Architecture:
 * - Workspaces contain multiple collections (like Postman workspaces)
 * - Each collection has folders, requests, chains, and environments
 * - Active workspace determines what shows in sidebar
 * - Switching collections doesn't trigger page reload
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
// Force immer into this chunk so production bundle has it (fixes "immer is not defined")
import 'immer';
import { API_BASE_URL } from '@/lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiWorkspace {
  id: string;
  name: string;
  description: string;
  collections: string[];  // collection IDs
  created_at: string;
  updated_at: string;
}

export interface ApiCollection {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  base_url: string;
  folders: ApiFolder[];
  requests: ApiRequest[];
  chains: ApiChain[];
  environment_ids: string[];
  variables: Record<string, string>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ApiFolder {
  id: string;
  name: string;
  description: string;
  parent_folder_id: string | null;  // Nested folders support
  request_ids: string[];
  sort_order: number;
  expanded: boolean;
}

export interface ApiRequest {
  id: string;
  collection_id: string;
  folder_id: string | null;
  name: string;
  method: string;
  url: string;
  path: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body_type: string;
  body: string;
  auth_type: string;
  auth_config: Record<string, string>;
  assertions: ApiAssertion[];
  pre_request_vars: Record<string, string>;
  test_type: string;
  expected_status: number;
  description: string;
  tags: string[];
  sort_order: number;
  last_response?: ApiResponseSnapshot;
  created_at: string;
  updated_at: string;
}

export interface ApiChain {
  id: string;
  collection_id: string;
  name: string;
  description: string;
  steps: ApiChainStep[];
  variables: Record<string, string>;
  tags: string[];
  last_run?: ApiChainRunResult;
  created_at: string;
  updated_at: string;
}

export interface ApiChainStep {
  id: string;
  name: string;
  request: {
    method: string;
    url: string;
    headers: KeyValuePair[];
    params: KeyValuePair[];
    body_type: string;
    body: string;
    auth_type: string;
    auth_config: Record<string, string>;
  };
  extractions: ExtractionConfig[];
  assertions: ApiAssertion[];
  conditions: ConditionConfig[];
  enabled: boolean;
  retry_on_failure: boolean;
  retry_count: number;
  delay_before: number;
}

export interface ApiAssertion {
  id: string;
  type: string;
  name: string;
  expected: string;
  path: string;
  operator: string;
  schema: string;
}

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export interface ExtractionConfig {
  id: string;
  name: string;
  method: string;
  expression: string;
  default_value: string;
}

export interface ConditionConfig {
  id: string;
  source: string;
  operator: string;
  expected: string;
  goto_step: string;
  skip_step: string;
}

export interface ApiResponseSnapshot {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  time_ms: number;
  size_bytes: number;
  timestamp: string;
}

export interface ApiChainRunResult {
  chain_id: string;
  status: 'passed' | 'failed' | 'partial';
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  total_duration_ms: number;
  timestamp: string;
}

export interface ApiTestRun {
  id: string;
  collection_id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  mode: 'manual' | 'automated' | 'ci_cd' | 'load';
  environment_id: string | null;
  request_ids: string[];
  results: ApiTestRunResult[];
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  created_at: string;
}

export interface ApiTestRunResult {
  request_id: string;
  request_name: string;
  method: string;
  url: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  response_status: number;
  response_time_ms: number;
  assertion_results: Array<{
    assertion_id: string;
    name: string;
    passed: boolean;
    message: string;
  }>;
  error: string | null;
}

export interface ApiEnvironment {
  id: string;
  name: string;
  type: string;
  base_url: string;
  variables: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SIDEBAR STATE (isolated for memoization)
// ============================================================================

export interface SidebarState {
  open: boolean;
  width: number;
  search_query: string;
  expanded_folders: Set<string>;
  expanded_endpoints: Set<string>;
  selected_request_id: string | null;
  scroll_position: number;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface ApiTestingState {
  // --- Workspace & Collection Management ---
  workspaces: ApiWorkspace[];
  active_workspace_id: string | null;
  collections: Record<string, ApiCollection>;  // Keyed by collection ID
  active_collection_id: string | null;
  
  // --- Sidebar (isolated for no-reload switching) ---
  sidebar: SidebarState;
  
  // --- Active Tab ---
  active_tab: string;
  
  // --- Builder State ---
  builder_request_id: string | null;  // Currently editing request
  builder_initial_data: any | null;    // Pre-population data
  
  // --- Environments ---
  environments: ApiEnvironment[];
  active_environment_id: string | null;
  
  // --- Variables (scoped) ---
  global_variables: Record<string, string>;
  
  // --- Execution ---
  execution_mode: string;
  executing: boolean;
  execution_results: any | null;
  selected_test_case_ids: Set<string>;
  
  // --- Test Runs (persistent) ---
  test_runs: ApiTestRun[];
  active_test_run_id: string | null;
  
  // --- Loading & Sync ---
  loading: {
    workspaces: boolean;
    collections: boolean;
    environments: boolean;
    test_runs: boolean;
    chains: boolean;
  };
  sync_status: 'idle' | 'syncing' | 'error';
  last_sync: string | null;
  
  // --- Debounce timers (internal) ---
  _save_timers: Record<string, NodeJS.Timeout>;
}

// ============================================================================
// ACTIONS
// ============================================================================

interface ApiTestingActions {
  // --- Initialization ---
  initialize: () => Promise<void>;
  
  // --- Workspace Actions ---
  loadWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, description?: string) => Promise<ApiWorkspace>;
  switchWorkspace: (workspaceId: string) => void;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  
  // --- Collection Actions ---
  loadCollections: (workspaceId: string) => Promise<void>;
  createCollection: (data: Partial<ApiCollection>) => Promise<ApiCollection>;
  switchCollection: (collectionId: string) => void;
  updateCollection: (collectionId: string, updates: Partial<ApiCollection>) => void;
  deleteCollection: (collectionId: string) => Promise<void>;
  importCollection: (payload: any, name?: string) => Promise<ApiCollection>;
  
  // --- Folder Actions (nested support) ---
  createFolder: (name: string, parentFolderId?: string | null) => void;
  renameFolder: (folderId: string, newName: string) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (folderId: string, newParentId: string | null) => void;
  toggleFolderExpanded: (folderId: string) => void;
  
  // --- Request Actions ---
  addRequest: (request: Partial<ApiRequest>, folderId?: string | null) => string;
  updateRequest: (requestId: string, updates: Partial<ApiRequest>) => void;
  deleteRequest: (requestId: string) => void;
  moveRequest: (requestId: string, targetFolderId: string | null) => void;
  duplicateRequest: (requestId: string) => string;
  openRequestInBuilder: (requestId: string) => void;
  
  // --- Chain Actions (DB-persisted) ---
  loadChains: (collectionId: string) => Promise<void>;
  createChain: (data: Partial<ApiChain>) => Promise<string>;
  updateChain: (chainId: string, updates: Partial<ApiChain>) => void;
  deleteChain: (chainId: string) => Promise<void>;
  
  // --- Sidebar Actions (no reload) ---
  setSidebarOpen: (open: boolean) => void;
  setSidebarSearch: (query: string) => void;
  setSidebarScrollPosition: (pos: number) => void;
  toggleEndpointExpanded: (endpointKey: string) => void;
  
  // --- Environment Actions ---
  loadEnvironments: () => Promise<void>;
  setActiveEnvironment: (envId: string | null) => void;
  createEnvironment: (env: Partial<ApiEnvironment>) => Promise<void>;
  updateEnvironment: (envId: string, updates: Partial<ApiEnvironment>) => Promise<void>;
  deleteEnvironment: (envId: string) => Promise<void>;
  
  // --- Variable Actions ---
  setGlobalVariable: (key: string, value: string) => void;
  removeGlobalVariable: (key: string) => void;
  setGlobalVariables: (vars: Record<string, string>) => void;
  
  // --- Test Tab / Execution ---
  setActiveTab: (tab: string) => void;
  setExecutionMode: (mode: string) => void;
  toggleTestCaseSelection: (id: string) => void;
  selectAllTestCases: () => void;
  deselectAllTestCases: () => void;
  
  // --- Test Runs (DB-persisted) ---
  loadTestRuns: (collectionId: string) => Promise<void>;
  createTestRun: (name: string, requestIds: string[], environmentId?: string | null) => Promise<ApiTestRun>;
  executeTestRun: (runId: string) => Promise<void>;
  
  // --- Builder ---
  setBuilderRequest: (requestId: string | null, initialData?: any) => void;
  
  // --- Debounced Persistence ---
  _debouncedSaveCollection: (collectionId: string) => void;
  _saveCollectionNow: (collectionId: string) => Promise<void>;
  _debouncedSaveGlobalVars: () => void;
  
  // --- Computed / Selectors ---
  getActiveCollection: () => ApiCollection | null;
  getActiveWorkspace: () => ApiWorkspace | null;
  getCollectionRequests: (collectionId: string) => ApiRequest[];
  getRequestsByEndpoint: (collectionId: string) => Map<string, ApiRequest[]>;
  getFolderTree: (collectionId: string) => ApiFolder[];
  getCollectionChains: (collectionId: string) => ApiChain[];
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

const DEBOUNCE_MS = 800;  // Faster than old 1500ms but still batches

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useApiTestingStore = create<ApiTestingState & ApiTestingActions>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // --- Initial State ---
          workspaces: [],
          active_workspace_id: null,
          collections: {},
          active_collection_id: null,
          
          sidebar: {
            open: true,
            width: 264,
            search_query: '',
            expanded_folders: new Set<string>(),
            expanded_endpoints: new Set<string>(),
            selected_request_id: null,
            scroll_position: 0,
          },
          
          active_tab: 'builder',
          builder_request_id: null,
          builder_initial_data: null,
          
          environments: [],
          active_environment_id: null,
          global_variables: {},
          
          execution_mode: 'automated',
          executing: false,
          execution_results: null,
          selected_test_case_ids: new Set<string>(),
          
          test_runs: [],
          active_test_run_id: null,
          
          loading: {
            workspaces: false,
            collections: false,
            environments: false,
            test_runs: false,
            chains: false,
          },
          sync_status: 'idle',
          last_sync: null,
          _save_timers: {},

          // =================================================================
          // INITIALIZATION
          // =================================================================
          
          initialize: async () => {
            const state = get();
            if (state.loading.workspaces) return;
            
            set((s) => { s.loading.workspaces = true; });
            
            try {
              // Load workspaces
              await get().loadWorkspaces();
              
              // Load environments
              await get().loadEnvironments();
              
              // If we have an active workspace, load its collections
              const activeWs = get().active_workspace_id;
              if (activeWs) {
                await get().loadCollections(activeWs);
              }
              
              // Migrate legacy localStorage data if exists
              await migrateLegacyData(get, set);
              
            } catch (err) {
              console.error('[ApiTestingStore] Initialization error:', err);
            } finally {
              set((s) => { s.loading.workspaces = false; });
            }
          },

          // =================================================================
          // WORKSPACE ACTIONS
          // =================================================================
          
          loadWorkspaces: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/db/api-workspaces`);
              if (!res.ok) {
                // Endpoint may not exist yet - create default workspace
                const defaultWs = await get().createWorkspace('My Workspace', 'Default API testing workspace');
                set((s) => {
                  s.active_workspace_id = defaultWs.id;
                });
                return;
              }
              const workspaces: ApiWorkspace[] = await res.json();
              set((s) => {
                s.workspaces = workspaces;
                if (!s.active_workspace_id && workspaces.length > 0) {
                  s.active_workspace_id = workspaces[0].id;
                }
              });
            } catch (err) {
              // Create default workspace on any error
              console.warn('[ApiTestingStore] Failed to load workspaces, creating default');
              try {
                const defaultWs = await get().createWorkspace('My Workspace', 'Default API testing workspace');
                set((s) => {
                  s.active_workspace_id = defaultWs.id;
                });
              } catch { /* ignore */ }
            }
          },
          
          createWorkspace: async (name, description = '') => {
            const ws: ApiWorkspace = {
              id: generateId(),
              name,
              description,
              collections: [],
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            
            set((s) => {
              s.workspaces.push(ws);
            });
            
            // Persist to backend
            try {
              await fetch(`${API_BASE_URL}/api/db/api-workspaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ws),
              });
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to persist workspace:', err);
            }
            
            return ws;
          },
          
          switchWorkspace: (workspaceId) => {
            set((s) => {
              s.active_workspace_id = workspaceId;
              s.active_collection_id = null;
              // Preserve sidebar state - NO reload
              s.sidebar.search_query = '';
            });
            // Load collections for new workspace in background
            get().loadCollections(workspaceId);
          },
          
          deleteWorkspace: async (workspaceId) => {
            set((s) => {
              s.workspaces = s.workspaces.filter(w => w.id !== workspaceId);
              if (s.active_workspace_id === workspaceId) {
                s.active_workspace_id = s.workspaces[0]?.id || null;
              }
            });
            try {
              await fetch(`${API_BASE_URL}/api/db/api-workspaces/${workspaceId}`, { method: 'DELETE' });
            } catch { /* ignore */ }
          },

          // =================================================================
          // COLLECTION ACTIONS
          // =================================================================
          
          loadCollections: async (workspaceId) => {
            set((s) => { s.loading.collections = true; });
            try {
              // First try the new workspace-scoped endpoint
              let res = await fetch(`${API_BASE_URL}/api/db/api-collections-v2?workspace_id=${workspaceId}`);
              
              if (!res.ok) {
                // Fallback: load from legacy default collection
                res = await fetch(`${API_BASE_URL}/api/db/api-collections/default`);
                if (res.ok) {
                  const data = await res.json();
                  const payload = data?.payload || {};
                  if (payload && (payload.test_cases?.length || payload.folders?.length)) {
                    // Migrate legacy collection into the workspace system
                    const migrated = legacyPayloadToCollection(payload, workspaceId);
                    set((s) => {
                      s.collections[migrated.id] = migrated;
                      s.active_collection_id = migrated.id;
                    });
                    // Save migrated collection
                    get()._debouncedSaveCollection(migrated.id);
                    return;
                  }
                }
                return;
              }
              
              const colls: ApiCollection[] = await res.json();
              set((s) => {
                for (const c of colls) {
                  s.collections[c.id] = c;
                }
                if (!s.active_collection_id && colls.length > 0) {
                  s.active_collection_id = colls[0].id;
                }
              });
              
              // Load chains for active collection
              const activeCol = get().active_collection_id;
              if (activeCol) {
                get().loadChains(activeCol);
                get().loadTestRuns(activeCol);
              }
            } catch (err) {
              console.error('[ApiTestingStore] Failed to load collections:', err);
            } finally {
              set((s) => { s.loading.collections = false; });
            }
          },
          
          createCollection: async (data) => {
            const wsId = get().active_workspace_id;
            const collection: ApiCollection = {
              id: generateId(),
              workspace_id: wsId || '',
              name: data.name || 'New Collection',
              description: data.description || '',
              base_url: data.base_url || '',
              folders: data.folders || [],
              requests: data.requests || [],
              chains: data.chains || [],
              environment_ids: data.environment_ids || [],
              variables: data.variables || {},
              metadata: data.metadata || {},
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            
            set((s) => {
              s.collections[collection.id] = collection;
              // Add to workspace
              const ws = s.workspaces.find(w => w.id === wsId);
              if (ws) ws.collections.push(collection.id);
            });
            
            // Persist
            get()._debouncedSaveCollection(collection.id);
            
            return collection;
          },
          
          switchCollection: (collectionId) => {
            // Switch collection WITHOUT any reload - just update pointer
            set((s) => {
              s.active_collection_id = collectionId;
              s.sidebar.search_query = '';
              s.sidebar.selected_request_id = null;
              // Keep sidebar open, keep scroll position concept
            });
            // Load chains and runs for this collection
            get().loadChains(collectionId);
            get().loadTestRuns(collectionId);
          },
          
          updateCollection: (collectionId, updates) => {
            set((s) => {
              const coll = s.collections[collectionId];
              if (!coll) return;
              Object.assign(coll, updates, { updated_at: nowISO() });
            });
            get()._debouncedSaveCollection(collectionId);
          },
          
          deleteCollection: async (collectionId) => {
            set((s) => {
              delete s.collections[collectionId];
              if (s.active_collection_id === collectionId) {
                const remaining = Object.keys(s.collections);
                s.active_collection_id = remaining.length > 0 ? remaining[0] : null;
              }
            });
            try {
              await fetch(`${API_BASE_URL}/api/db/api-collections-v2/${collectionId}`, { method: 'DELETE' });
            } catch { /* ignore */ }
          },
          
          importCollection: async (payload, name) => {
            const wsId = get().active_workspace_id;
            const migrated = legacyPayloadToCollection(payload, wsId || '', name);
            
            set((s) => {
              s.collections[migrated.id] = migrated;
              s.active_collection_id = migrated.id;
              const ws = s.workspaces.find(w => w.id === wsId);
              if (ws && !ws.collections.includes(migrated.id)) {
                ws.collections.push(migrated.id);
              }
            });
            
            get()._debouncedSaveCollection(migrated.id);
            return migrated;
          },

          // =================================================================
          // FOLDER ACTIONS (with nested support)
          // =================================================================
          
          createFolder: (name, parentFolderId = null) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            const folder: ApiFolder = {
              id: generateId(),
              name,
              description: '',
              parent_folder_id: parentFolderId,
              request_ids: [],
              sort_order: get().collections[collId]?.folders.length || 0,
              expanded: true,
            };
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              coll.folders.push(folder);
              coll.updated_at = nowISO();
              s.sidebar.expanded_folders.add(folder.id);
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          renameFolder: (folderId, newName) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              const folder = coll.folders.find(f => f.id === folderId);
              if (folder) folder.name = newName;
              coll.updated_at = nowISO();
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          deleteFolder: (folderId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              
              // Move requests from this folder to root (unfiled)
              const folder = coll.folders.find(f => f.id === folderId);
              if (folder) {
                for (const req of coll.requests) {
                  if (req.folder_id === folderId) {
                    req.folder_id = null;
                  }
                }
              }
              
              // Also re-parent child folders
              for (const f of coll.folders) {
                if (f.parent_folder_id === folderId) {
                  f.parent_folder_id = folder?.parent_folder_id || null;
                }
              }
              
              coll.folders = coll.folders.filter(f => f.id !== folderId);
              coll.updated_at = nowISO();
              s.sidebar.expanded_folders.delete(folderId);
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          moveFolder: (folderId, newParentId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              const folder = coll.folders.find(f => f.id === folderId);
              if (folder) folder.parent_folder_id = newParentId;
              coll.updated_at = nowISO();
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          toggleFolderExpanded: (folderId) => {
            set((s) => {
              if (s.sidebar.expanded_folders.has(folderId)) {
                s.sidebar.expanded_folders.delete(folderId);
              } else {
                s.sidebar.expanded_folders.add(folderId);
              }
            });
          },

          // =================================================================
          // REQUEST ACTIONS
          // =================================================================
          
          addRequest: (requestData, folderId = null) => {
            const collId = get().active_collection_id;
            if (!collId) return '';
            
            const id = generateId();
            const request: ApiRequest = {
              id,
              collection_id: collId,
              folder_id: folderId,
              name: requestData.name || `${requestData.method || 'GET'} ${requestData.path || requestData.url || '/'}`,
              method: requestData.method || 'GET',
              url: requestData.url || '',
              path: requestData.path || '',
              headers: requestData.headers || [{ key: 'Content-Type', value: 'application/json', enabled: true }],
              params: requestData.params || [],
              body_type: requestData.body_type || 'json',
              body: requestData.body || '',
              auth_type: requestData.auth_type || 'none',
              auth_config: requestData.auth_config || {},
              assertions: requestData.assertions || [],
              pre_request_vars: requestData.pre_request_vars || {},
              test_type: requestData.test_type || 'functional',
              expected_status: requestData.expected_status || 200,
              description: requestData.description || '',
              tags: requestData.tags || [],
              sort_order: get().collections[collId]?.requests.length || 0,
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              coll.requests.push(request);
              
              // Add to folder if specified
              if (folderId) {
                const folder = coll.folders.find(f => f.id === folderId);
                if (folder) folder.request_ids.push(id);
              }
              
              coll.updated_at = nowISO();
            });
            
            get()._debouncedSaveCollection(collId);
            return id;
          },
          
          updateRequest: (requestId, updates) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              const reqIdx = coll.requests.findIndex(r => r.id === requestId);
              if (reqIdx !== -1) {
                Object.assign(coll.requests[reqIdx], updates, { updated_at: nowISO() });
              }
              coll.updated_at = nowISO();
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          deleteRequest: (requestId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              
              // Remove from any folder
              for (const folder of coll.folders) {
                folder.request_ids = folder.request_ids.filter(id => id !== requestId);
              }
              
              coll.requests = coll.requests.filter(r => r.id !== requestId);
              coll.updated_at = nowISO();
              
              if (s.sidebar.selected_request_id === requestId) {
                s.sidebar.selected_request_id = null;
              }
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          moveRequest: (requestId, targetFolderId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              
              // Remove from all folders first
              for (const folder of coll.folders) {
                folder.request_ids = folder.request_ids.filter(id => id !== requestId);
              }
              
              // Update request's folder_id
              const req = coll.requests.find(r => r.id === requestId);
              if (req) req.folder_id = targetFolderId;
              
              // Add to new folder
              if (targetFolderId) {
                const targetFolder = coll.folders.find(f => f.id === targetFolderId);
                if (targetFolder) targetFolder.request_ids.push(requestId);
              }
              
              coll.updated_at = nowISO();
            });
            
            get()._debouncedSaveCollection(collId);
          },
          
          duplicateRequest: (requestId) => {
            const collId = get().active_collection_id;
            if (!collId) return '';
            
            const coll = get().collections[collId];
            const original = coll?.requests.find(r => r.id === requestId);
            if (!original) return '';
            
            return get().addRequest({
              ...original,
              name: `${original.name} (copy)`,
              id: undefined,
            }, original.folder_id);
          },
          
          openRequestInBuilder: (requestId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            const coll = get().collections[collId];
            const request = coll?.requests.find(r => r.id === requestId);
            if (!request) return;
            
            // Resolve full URL with environment
            const envId = get().active_environment_id;
            const env = get().environments.find(e => e.id === envId);
            const baseUrl = env?.base_url || coll?.base_url || '';
            const url = request.url || request.path;
            const fullUrl = url.startsWith('http') ? url : `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
            
            set((s) => {
              s.builder_request_id = requestId;
              s.builder_initial_data = {
                method: request.method,
                url: fullUrl,
                headers: request.headers?.reduce((acc: any, h: KeyValuePair) => {
                  if (h.key) acc[h.key] = h.value;
                  return acc;
                }, {}) || { 'Content-Type': 'application/json' },
                body: request.body || undefined,
                assertions: request.assertions?.length ? request.assertions : undefined,
                editingTestCaseId: requestId,
                title: request.name,
              };
              s.active_tab = 'builder';
              s.sidebar.selected_request_id = requestId;
            });
          },

          // =================================================================
          // CHAIN ACTIONS (DB-persisted, not localStorage)
          // =================================================================
          
          loadChains: async (collectionId) => {
            set((s) => { s.loading.chains = true; });
            try {
              const res = await fetch(`${API_BASE_URL}/api/db/api-chains?collection_id=${collectionId}`);
              if (res.ok) {
                const chains: ApiChain[] = await res.json();
                set((s) => {
                  const coll = s.collections[collectionId];
                  if (coll) coll.chains = chains;
                });
              }
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to load chains:', err);
              // Try loading from localStorage as fallback
              try {
                const raw = localStorage.getItem('api_saved_chains');
                if (raw) {
                  const legacyChains = JSON.parse(raw);
                  if (Array.isArray(legacyChains) && legacyChains.length > 0) {
                    set((s) => {
                      const coll = s.collections[collectionId];
                      if (coll) {
                        coll.chains = legacyChains.map((lc: any) => ({
                          id: lc.id || generateId(),
                          collection_id: collectionId,
                          name: lc.name || 'Imported Chain',
                          description: '',
                          steps: lc.steps || [],
                          variables: {},
                          tags: [],
                          created_at: nowISO(),
                          updated_at: nowISO(),
                        }));
                      }
                    });
                  }
                }
              } catch { /* ignore */ }
            } finally {
              set((s) => { s.loading.chains = false; });
            }
          },
          
          createChain: async (data) => {
            const collId = get().active_collection_id;
            if (!collId) return '';
            
            const id = generateId();
            const chain: ApiChain = {
              id,
              collection_id: collId,
              name: data.name || 'New Chain',
              description: data.description || '',
              steps: data.steps || [],
              variables: data.variables || {},
              tags: data.tags || [],
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            
            set((s) => {
              const coll = s.collections[collId];
              if (coll) coll.chains.push(chain);
            });
            
            // Persist chain to database
            try {
              await fetch(`${API_BASE_URL}/api/db/api-chains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chain),
              });
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to persist chain:', err);
            }
            
            return id;
          },
          
          updateChain: (chainId, updates) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              const chain = coll.chains.find(c => c.id === chainId);
              if (chain) {
                Object.assign(chain, updates, { updated_at: nowISO() });
              }
            });
            
            // Debounced save for chains
            const state = get();
            const timerKey = `chain_${chainId}`;
            if (state._save_timers[timerKey]) clearTimeout(state._save_timers[timerKey]);
            
            const timer = setTimeout(async () => {
              const coll = get().collections[collId];
              const chain = coll?.chains.find(c => c.id === chainId);
              if (!chain) return;
              try {
                await fetch(`${API_BASE_URL}/api/db/api-chains/${chainId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(chain),
                });
              } catch { /* ignore */ }
            }, DEBOUNCE_MS);
            
            set((s) => { s._save_timers[timerKey] = timer; });
          },
          
          deleteChain: async (chainId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (coll) {
                coll.chains = coll.chains.filter(c => c.id !== chainId);
              }
            });
            
            try {
              await fetch(`${API_BASE_URL}/api/db/api-chains/${chainId}`, { method: 'DELETE' });
            } catch { /* ignore */ }
          },

          // =================================================================
          // SIDEBAR ACTIONS (no-reload, memoization-friendly)
          // =================================================================
          
          setSidebarOpen: (open) => {
            set((s) => { s.sidebar.open = open; });
          },
          
          setSidebarSearch: (query) => {
            set((s) => { s.sidebar.search_query = query; });
          },
          
          setSidebarScrollPosition: (pos) => {
            set((s) => { s.sidebar.scroll_position = pos; });
          },
          
          toggleEndpointExpanded: (endpointKey) => {
            set((s) => {
              if (s.sidebar.expanded_endpoints.has(endpointKey)) {
                s.sidebar.expanded_endpoints.delete(endpointKey);
              } else {
                s.sidebar.expanded_endpoints.add(endpointKey);
              }
            });
          },

          // =================================================================
          // ENVIRONMENT ACTIONS
          // =================================================================
          
          loadEnvironments: async () => {
            set((s) => { s.loading.environments = true; });
            try {
              const res = await fetch(`${API_BASE_URL}/api/db/environments`);
              if (res.ok) {
                const envs = await res.json();
                set((s) => {
                  s.environments = envs.map((e: any) => ({
                    id: e.id || e.environment_id || generateId(),
                    name: e.name || 'Unnamed',
                    type: e.type || 'development',
                    base_url: e.base_url || '',
                    variables: e.variables || {},
                    is_active: e.is_active || false,
                    created_at: e.created_at || nowISO(),
                    updated_at: e.updated_at || nowISO(),
                  }));
                  // Set active environment if none selected
                  if (!s.active_environment_id && s.environments.length > 0) {
                    s.active_environment_id = s.environments[0].id;
                  }
                });
              }
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to load environments:', err);
            } finally {
              set((s) => { s.loading.environments = false; });
            }
          },
          
          setActiveEnvironment: (envId) => {
            set((s) => { s.active_environment_id = envId; });
          },
          
          createEnvironment: async (env) => {
            const newEnv: ApiEnvironment = {
              id: generateId(),
              name: env.name || 'New Environment',
              type: env.type || 'development',
              base_url: env.base_url || '',
              variables: env.variables || {},
              is_active: false,
              created_at: nowISO(),
              updated_at: nowISO(),
            };
            
            set((s) => { s.environments.push(newEnv); });
            
            try {
              await fetch(`${API_BASE_URL}/api/db/environments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEnv),
              });
            } catch { /* ignore */ }
          },
          
          updateEnvironment: async (envId, updates) => {
            set((s) => {
              const env = s.environments.find(e => e.id === envId);
              if (env) Object.assign(env, updates, { updated_at: nowISO() });
            });
            try {
              const env = get().environments.find(e => e.id === envId);
              if (env) {
                await fetch(`${API_BASE_URL}/api/db/environments/${envId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(env),
                });
              }
            } catch { /* ignore */ }
          },
          
          deleteEnvironment: async (envId) => {
            set((s) => {
              s.environments = s.environments.filter(e => e.id !== envId);
              if (s.active_environment_id === envId) s.active_environment_id = null;
            });
            try {
              await fetch(`${API_BASE_URL}/api/db/environments/${envId}`, { method: 'DELETE' });
            } catch { /* ignore */ }
          },

          // =================================================================
          // VARIABLE ACTIONS
          // =================================================================
          
          setGlobalVariable: (key, value) => {
            set((s) => { s.global_variables[key] = value; });
            get()._debouncedSaveGlobalVars();
          },
          
          removeGlobalVariable: (key) => {
            set((s) => { delete s.global_variables[key]; });
            get()._debouncedSaveGlobalVars();
          },
          
          setGlobalVariables: (vars) => {
            set((s) => { s.global_variables = vars; });
            get()._debouncedSaveGlobalVars();
          },

          // =================================================================
          // TAB & EXECUTION ACTIONS
          // =================================================================
          
          setActiveTab: (tab) => {
            set((s) => { s.active_tab = tab; });
          },
          
          setExecutionMode: (mode) => {
            set((s) => { s.execution_mode = mode; });
          },
          
          toggleTestCaseSelection: (id) => {
            set((s) => {
              if (s.selected_test_case_ids.has(id)) {
                s.selected_test_case_ids.delete(id);
              } else {
                s.selected_test_case_ids.add(id);
              }
            });
          },
          
          selectAllTestCases: () => {
            const collId = get().active_collection_id;
            if (!collId) return;
            const coll = get().collections[collId];
            if (!coll) return;
            set((s) => {
              s.selected_test_case_ids = new Set(coll.requests.map(r => r.id));
            });
          },
          
          deselectAllTestCases: () => {
            set((s) => { s.selected_test_case_ids = new Set(); });
          },

          // =================================================================
          // TEST RUNS (DB-persisted)
          // =================================================================
          
          loadTestRuns: async (collectionId) => {
            set((s) => { s.loading.test_runs = true; });
            try {
              const res = await fetch(`${API_BASE_URL}/api/db/api-test-runs?collection_id=${collectionId}`);
              if (res.ok) {
                const runs: ApiTestRun[] = await res.json();
                set((s) => { s.test_runs = runs; });
              }
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to load test runs:', err);
            } finally {
              set((s) => { s.loading.test_runs = false; });
            }
          },
          
          createTestRun: async (name, requestIds, environmentId = null) => {
            const collId = get().active_collection_id;
            const run: ApiTestRun = {
              id: generateId(),
              collection_id: collId || '',
              name,
              status: 'pending',
              mode: get().execution_mode as any,
              environment_id: environmentId || get().active_environment_id,
              request_ids: requestIds,
              results: [],
              started_at: nowISO(),
              completed_at: null,
              duration_ms: 0,
              created_at: nowISO(),
            };
            
            set((s) => { s.test_runs.unshift(run); });
            
            // Persist to backend
            try {
              await fetch(`${API_BASE_URL}/api/db/api-test-runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(run),
              });
            } catch { /* ignore */ }
            
            return run;
          },
          
          executeTestRun: async (runId) => {
            set((s) => {
              s.executing = true;
              const run = s.test_runs.find(r => r.id === runId);
              if (run) run.status = 'running';
            });
            
            try {
              const run = get().test_runs.find(r => r.id === runId);
              if (!run) return;
              
              const collId = run.collection_id;
              const coll = get().collections[collId];
              if (!coll) return;
              
              // Gather test cases from requests
              const testCases = run.request_ids
                .map(rid => coll.requests.find(r => r.id === rid))
                .filter(Boolean)
                .map((req: any) => ({
                  test_case_id: req.id,
                  name: req.name,
                  method: req.method,
                  path: req.url || req.path,
                  expected_status: req.expected_status || 200,
                  assertions: req.assertions,
                  request: {
                    headers: req.headers?.reduce((acc: any, h: KeyValuePair) => {
                      if (h.key && h.enabled) acc[h.key] = h.value;
                      return acc;
                    }, {}),
                    body: req.body || undefined,
                  },
                }));
              
              // Resolve environment
              const env = get().environments.find(e => e.id === run.environment_id);
              
              const res = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  test_suite: {
                    name: run.name,
                    base_url: env?.base_url || coll.base_url || '',
                    test_cases: testCases,
                  },
                  execution_config: {
                    mode: run.mode,
                    parallel: run.mode === 'automated',
                    max_workers: 5,
                  },
                }),
              });
              
              const results = await res.json();
              
              set((s) => {
                const r = s.test_runs.find(r => r.id === runId);
                if (r) {
                  r.status = results.summary?.total_failed > 0 ? 'failed' : 'passed';
                  r.completed_at = nowISO();
                  r.duration_ms = results.summary?.total_duration_ms || 0;
                  r.results = (results.results || []).map((result: any) => ({
                    request_id: result.test_case_id || '',
                    request_name: result.test_name || '',
                    method: result.method || '',
                    url: result.url || '',
                    status: result.passed ? 'passed' : 'failed',
                    response_status: result.actual_status || 0,
                    response_time_ms: result.response_time_ms || 0,
                    assertion_results: result.assertion_results || [],
                    error: result.error || null,
                  }));
                }
                s.execution_results = results;
                s.executing = false;
              });
              
              // Persist run results to DB
              try {
                const updatedRun = get().test_runs.find(r => r.id === runId);
                await fetch(`${API_BASE_URL}/api/db/api-test-runs/${runId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updatedRun),
                });
              } catch { /* ignore */ }
              
            } catch (err) {
              console.error('[ApiTestingStore] Test run execution failed:', err);
              set((s) => {
                s.executing = false;
                const run = s.test_runs.find(r => r.id === runId);
                if (run) {
                  run.status = 'failed';
                  run.completed_at = nowISO();
                }
              });
            }
          },

          // =================================================================
          // BUILDER
          // =================================================================
          
          setBuilderRequest: (requestId, initialData) => {
            set((s) => {
              s.builder_request_id = requestId;
              s.builder_initial_data = initialData || null;
            });
          },

          // =================================================================
          // DEBOUNCED PERSISTENCE
          // =================================================================
          
          _debouncedSaveCollection: (collectionId) => {
            const state = get();
            const timerKey = `coll_${collectionId}`;
            
            if (state._save_timers[timerKey]) {
              clearTimeout(state._save_timers[timerKey]);
            }
            
            const timer = setTimeout(() => {
              get()._saveCollectionNow(collectionId);
            }, DEBOUNCE_MS);
            
            set((s) => { s._save_timers[timerKey] = timer; });
          },
          
          _saveCollectionNow: async (collectionId) => {
            const coll = get().collections[collectionId];
            if (!coll) return;
            
            set((s) => { s.sync_status = 'syncing'; });
            
            try {
              // Save to new granular endpoint
              const res = await fetch(`${API_BASE_URL}/api/db/api-collections-v2/${collectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(coll),
              });
              
              if (!res.ok) {
                // Fallback: save to legacy endpoint (e.g. v2 table empty)
                await fetch(`${API_BASE_URL}/api/db/api-collections/default`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    payload: {
                      name: coll.name,
                      base_url: coll.base_url,
                      test_cases: coll.requests.map(r => ({
                        test_case_id: r.id,
                        name: r.name,
                        title: r.name,
                        method: r.method,
                        path: r.path || r.url,
                        endpoint: r.url,
                        expected_status: r.expected_status,
                        description: r.description,
                        test_type: r.test_type,
                        assertions: r.assertions,
                        request: {
                          headers: r.headers?.reduce((acc: any, h: KeyValuePair) => {
                            if (h.key) acc[h.key] = h.value;
                            return acc;
                          }, {}),
                          body: r.body || undefined,
                        },
                      })),
                      folders: coll.folders.map(f => ({
                        id: f.id,
                        name: f.name,
                        test_case_ids: f.request_ids,
                      })),
                    },
                  }),
                });
              }
              
              set((s) => {
                s.sync_status = 'idle';
                s.last_sync = nowISO();
              });
            } catch (err) {
              console.error('[ApiTestingStore] Failed to save collection:', err);
              set((s) => { s.sync_status = 'error'; });
            }
          },
          
          _debouncedSaveGlobalVars: () => {
            const state = get();
            const timerKey = 'global_vars';
            
            if (state._save_timers[timerKey]) {
              clearTimeout(state._save_timers[timerKey]);
            }
            
            const timer = setTimeout(() => {
              const vars = get().global_variables;
              try {
                localStorage.setItem('api_global_variables', JSON.stringify(vars));
              } catch { /* ignore */ }
              // Also persist to backend
              fetch(`${API_BASE_URL}/api/db/global-variables`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables: vars }),
              }).catch(() => {});
            }, DEBOUNCE_MS);
            
            set((s) => { s._save_timers[timerKey] = timer; });
          },

          // =================================================================
          // COMPUTED SELECTORS
          // =================================================================
          
          getActiveCollection: () => {
            const { active_collection_id, collections } = get();
            if (!active_collection_id) return null;
            return collections[active_collection_id] || null;
          },
          
          getActiveWorkspace: () => {
            const { active_workspace_id, workspaces } = get();
            return workspaces.find(w => w.id === active_workspace_id) || null;
          },
          
          getCollectionRequests: (collectionId) => {
            const coll = get().collections[collectionId];
            return coll?.requests || [];
          },
          
          getRequestsByEndpoint: (collectionId) => {
            const coll = get().collections[collectionId];
            if (!coll) return new Map();
            
            const map = new Map<string, ApiRequest[]>();
            for (const req of coll.requests) {
              const method = (req.method || 'GET').toUpperCase();
              const path = (req.path || req.url || '/').replace(/^https?:\/\/[^/]+/, '') || '/';
              const key = `${method} ${path}`;
              if (!map.has(key)) map.set(key, []);
              map.get(key)!.push(req);
            }
            return map;
          },
          
          getFolderTree: (collectionId) => {
            const coll = get().collections[collectionId];
            return coll?.folders || [];
          },
          
          getCollectionChains: (collectionId) => {
            const coll = get().collections[collectionId];
            return coll?.chains || [];
          },
        })),
        {
          name: 'api-testing-store',
          // Only persist UI state, not full data (data comes from DB)
          partialize: (state) => ({
            active_workspace_id: state.active_workspace_id,
            active_collection_id: state.active_collection_id,
            active_tab: state.active_tab,
            active_environment_id: state.active_environment_id,
            global_variables: state.global_variables,
            execution_mode: state.execution_mode,
            sidebar: {
              open: state.sidebar.open,
              width: state.sidebar.width,
            },
          }),
          // Safe storage: never throw so rehydration cannot crash the app
          storage: {
            getItem: (name) => {
              try {
                const raw = localStorage.getItem(name);
                if (!raw) return null;
                return JSON.parse(raw);
              } catch {
                return null;
              }
            },
            setItem: (name, value) => {
              try {
                localStorage.setItem(name, JSON.stringify(value));
              } catch { /* ignore */ }
            },
            removeItem: (name) => {
              try {
                localStorage.removeItem(name);
              } catch { /* ignore */ }
            },
          },
        }
      )
    ),
    { name: 'ApiTestingStore' }
  )
);

// ============================================================================
// MIGRATION: Convert legacy single-blob collection to new format
// ============================================================================

function legacyPayloadToCollection(payload: any, workspaceId: string, name?: string): ApiCollection {
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
    url: tc.path || tc.endpoint || '',
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

async function migrateLegacyData(get: () => ApiTestingState & ApiTestingActions, set: any) {
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

// ============================================================================
// TYPED SELECTORS (for memoized component subscriptions)
// ============================================================================

/** Subscribe to only sidebar state - sidebar won't re-render when other state changes */
export const useSidebarState = () => useApiTestingStore((s) => s.sidebar);

/** Subscribe to only active collection */
export const useActiveCollection = () => useApiTestingStore((s) => {
  if (!s.active_collection_id) return null;
  return s.collections[s.active_collection_id] || null;
});

/** Subscribe to workspace list */
export const useWorkspaces = () => useApiTestingStore((s) => s.workspaces);

/** Subscribe to active tab only */
export const useActiveTab = () => useApiTestingStore((s) => s.active_tab);

/** Subscribe to environments */
export const useApiEnvironments = () => useApiTestingStore((s) => s.environments);

/** Subscribe to loading states */
export const useApiLoadingState = () => useApiTestingStore((s) => s.loading);

/** Subscribe to test runs */
export const useApiTestRuns = () => useApiTestingStore((s) => s.test_runs);

/** Subscribe to execution state */
export const useApiExecutionState = () => useApiTestingStore((s) => ({
  executing: s.executing,
  execution_results: s.execution_results,
  execution_mode: s.execution_mode,
}));

/** Subscribe to builder state */
export const useBuilderState = () => useApiTestingStore((s) => ({
  request_id: s.builder_request_id,
  initial_data: s.builder_initial_data,
}));

/** Subscribe to sync status */
export const useSyncStatus = () => useApiTestingStore((s) => ({
  status: s.sync_status,
  last_sync: s.last_sync,
}));
