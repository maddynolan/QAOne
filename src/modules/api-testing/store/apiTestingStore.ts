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
// Enable Map/Set support in immer — MUST be called before any immer producer runs.
// Without this, all Set operations (expanded_folders, expanded_endpoints, etc.)
// crash with "Immer error nr: 0" because immer can't create proxies for Sets.
import { enableMapSet } from 'immer';
enableMapSet();
import { API_BASE_URL } from '@/lib/api-config';

// Types, helpers, and selectors extracted to separate files
export type {
  ApiWorkspace, ApiCollection, ApiFolder, ApiRequest, ApiChain, ApiChainStep,
  ApiAssertion, KeyValuePair, ExtractionConfig, ConditionConfig,
  ApiResponseSnapshot, ApiChainRunResult, ApiTestRun, ApiTestRunResult,
  ApiEnvironment, SidebarState, ApiTestingState, ApiTestingActions,
} from './api-testing-types';
import type { ApiTestingState, ApiTestingActions } from './api-testing-types';
import {
  generateId, nowISO, DEBOUNCE_MS, ensureSidebarSets, ensureTestCaseSet,
  legacyPayloadToCollection, migrateLegacyData,
} from './api-testing-helpers';
export {
  useSidebarState, useActiveCollectionId, useActiveCollection, useWorkspaces,
  useActiveTab, useApiEnvironments, useApiLoadingState, useApiTestRuns,
  useApiExecutionState, useBuilderState, useSyncStatus, useApiTestingActions,
  getLatestResultMap, getFolderStats,
  type RequestResultInfo,
} from './api-testing-selectors';

// ============================================================================
// BUILDER AUTO-SAVE: Module-level state (not in Zustand to avoid re-renders)
// RequestBuilder writes here on every change; openRequestInBuilder reads
// to auto-save before switching to a different request.
// ============================================================================
let _builderDirtyState: {
  requestId: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  params: Array<{ key: string; value: string; enabled: boolean }>;
  body: string;
  bodyType: string;
  assertions: any[];
  authType?: string;
  authToken?: string;
  authUsername?: string;
  authPassword?: string;
  authApiKeyName?: string;
  authApiKeyValue?: string;
  authApiKeyLocation?: string;
} | null = null;

/** Called by RequestBuilder on every form change to keep track of the current state */
export function setBuilderDirtyState(state: typeof _builderDirtyState) {
  _builderDirtyState = state;
}

/** Clear the dirty state (e.g., when builder unmounts) */
export function clearBuilderDirtyState() {
  _builderDirtyState = null;
}

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
              
              // Ensure we have a workspace (always)
              let activeWs = get().active_workspace_id;
              if (!activeWs) {
                const ws = await get().createWorkspace('My Workspace', 'Default API testing workspace');
                activeWs = ws.id;
                set((s) => { s.active_workspace_id = ws.id; });
              }
              
              // Load collections for active workspace
              await get().loadCollections(activeWs);
              
              // If still no collection after load, create a default one
              if (!get().active_collection_id || Object.keys(get().collections).length === 0) {
                const coll = await get().createCollection({ name: 'My Collection' });
                set((s) => {
                  s.active_collection_id = coll.id;
                });
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
              
              let colls: ApiCollection[] = await res.json();
              
              // If workspace query returned empty, also try loading the persisted active collection directly
              if (colls.length === 0) {
                const persistedId = get().active_collection_id;
                if (persistedId) {
                  try {
                    const directRes = await fetch(`${API_BASE_URL}/api/db/api-collections-v2/${persistedId}`);
                    if (directRes.ok) {
                      const directColl = await directRes.json();
                      if (directColl && directColl.id) {
                        colls = [directColl];
                      }
                    }
                  } catch { /* ignore */ }
                }
              }
              
              set((s) => {
                for (const c of colls) {
                  // Only overwrite if backend version is newer or local version doesn't exist
                  const existing = s.collections[c.id];
                  if (!existing) {
                    s.collections[c.id] = c;
                  } else {
                    // Compare timestamps - keep the newer version
                    const backendTime = new Date(c.updated_at || 0).getTime();
                    const localTime = new Date(existing.updated_at || 0).getTime();
                    if (backendTime >= localTime) {
                      s.collections[c.id] = c;
                    }
                    // else: local version is newer (e.g. recent delete/add), keep it
                  }
                }
                // If active_collection_id is unset or points to a non-existent collection, pick the first one
                const currentActive = s.active_collection_id;
                const activeExists = currentActive && (s.collections[currentActive] != null || colls.some(c => c.id === currentActive));
                if (!activeExists && colls.length > 0) {
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
            if (!collId) return undefined;

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
              ensureSidebarSets(s);
              s.sidebar.expanded_folders.add(folder.id);
            });

            // Save immediately so new folders persist
            get()._saveCollectionNow(collId);
            return folder.id;
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

            // Save immediately so renames persist (not debounced)
            get()._saveCollectionNow(collId);
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
              ensureSidebarSets(s);
              s.sidebar.expanded_folders.delete(folderId);
            });
            
            // Save IMMEDIATELY on delete so deletions persist through refresh
            get()._saveCollectionNow(collId);
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
              ensureSidebarSets(s);
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
            
            // Use debounced save (callers can trigger immediate save after bulk ops)
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
            
            // Save IMMEDIATELY on delete (not debounced) so deletions persist through refresh
            get()._saveCollectionNow(collId);
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
            
            // Save immediately so move persists
            get()._saveCollectionNow(collId);
          },
          
          reorderRequest: (requestId, newIndex, folderId) => {
            const collId = get().active_collection_id;
            if (!collId) return;
            
            set((s) => {
              const coll = s.collections[collId];
              if (!coll) return;
              
              // Get requests in the same scope (same folder or root)
              const scopeRequests = coll.requests
                .filter(r => folderId !== undefined ? r.folder_id === folderId : r.folder_id === null)
                .sort((a, b) => a.sort_order - b.sort_order);
              
              const oldIdx = scopeRequests.findIndex(r => r.id === requestId);
              if (oldIdx < 0 || oldIdx === newIndex) return;
              
              // Remove from old position and insert at new
              const [moved] = scopeRequests.splice(oldIdx, 1);
              scopeRequests.splice(newIndex, 0, moved);
              
              // Re-assign sort_order
              scopeRequests.forEach((r, idx) => {
                const req = coll.requests.find(cr => cr.id === r.id);
                if (req) req.sort_order = idx;
              });
              
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

            // Auto-save current builder state before switching to a different request
            if (_builderDirtyState && _builderDirtyState.requestId !== requestId) {
              const prevId = _builderDirtyState.requestId;
              const prevExists = coll?.requests.some(r => r.id === prevId);
              if (prevExists) {
                const ds = _builderDirtyState;
                const pathOnly = ds.url ? (ds.url.replace(/^https?:\/\/[^/]+/, '') || '/') : '/';
                set((s) => {
                  const c = s.collections[collId];
                  if (!c) return;
                  const idx = c.requests.findIndex(r => r.id === prevId);
                  if (idx !== -1) {
                    Object.assign(c.requests[idx], {
                      method: ds.method,
                      url: ds.url,
                      path: pathOnly,
                      headers: ds.headers,
                      params: ds.params || [],
                      body: ds.body || '',
                      assertions: ds.assertions || [],
                      updated_at: nowISO(),
                    });
                    c.updated_at = nowISO();
                  }
                });
                get()._debouncedSaveCollection(collId);
              }
              _builderDirtyState = null;
            }

            // Use the stored URL directly — prefer request.url (full URL with base) over request.path
            const storedUrl = request.url || request.path || '/';

            let fullUrl: string;
            if (storedUrl.startsWith('http')) {
              // Already a full URL — use as-is, no base URL prepend needed
              fullUrl = storedUrl;
            } else {
              // Path-only URL — resolve base URL from environment → collection → localStorage
              const envId = get().active_environment_id;
              const env = get().environments.find(e => e.id === envId);
              let baseUrl = env?.base_url || coll?.base_url || '';

              // Extra fallback: try page's localStorage environment if store env lookup failed
              if (!baseUrl) {
                try {
                  const savedEnvId = localStorage.getItem('apex_selected_environment');
                  if (savedEnvId) {
                    const savedEnvs = JSON.parse(localStorage.getItem('apex_environments') || '[]');
                    const savedEnv = savedEnvs.find((e: any) => e.environment_id === savedEnvId);
                    if (savedEnv?.base_url) baseUrl = savedEnv.base_url;
                  }
                } catch { /* ignore */ }
              }

              fullUrl = baseUrl
                ? `${baseUrl.replace(/\/$/, '')}${storedUrl.startsWith('/') ? storedUrl : `/${storedUrl}`}`
                : storedUrl; // No base URL found — show path only (user can edit)
            }
            
            set((s) => {
              s.builder_request_id = requestId;
              s.builder_initial_data = {
                method: request.method,
                url: fullUrl,
                headers: request.headers?.reduce((acc: any, h: KeyValuePair) => {
                  if (h.key) acc[h.key] = h.value;
                  return acc;
                }, {}) || { 'Content-Type': 'application/json' },
                params: request.params?.length ? request.params : undefined,
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
              ensureSidebarSets(s);
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
              ensureTestCaseSet(s);
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
              if (!run) {
                set((s) => { s.executing = false; });
                return;
              }
              
              const collId = run.collection_id || get().active_collection_id;
              const coll = get().collections[collId || ''];
              if (!coll) {
                console.error('[ApiTestingStore] executeTestRun: no collection found for', collId);
                set((s) => { s.executing = false; });
                return;
              }
              
              // Gather test cases from requests (use all if request_ids is empty)
              const requestIds = run.request_ids?.length > 0 ? run.request_ids : coll.requests.map(r => r.id);
              const testCases = requestIds
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
                      if (h.key && h.enabled !== false) acc[h.key] = h.value;
                      return acc;
                    }, {}),
                    body: req.body || undefined,
                  },
                }));
              
              if (testCases.length === 0) {
                console.error('[ApiTestingStore] executeTestRun: no test cases to run');
                set((s) => { s.executing = false; });
                return;
              }
              
              // Resolve environment (try store envs, then page's localStorage envs)
              const envId = run.environment_id || get().active_environment_id;
              let env = get().environments.find(e => e.id === envId);
              let baseUrl = env?.base_url || coll.base_url || '';
              
              // Fallback: try page's localStorage environment
              if (!baseUrl) {
                try {
                  const savedEnvId = localStorage.getItem('apex_selected_environment');
                  if (savedEnvId) {
                    const savedEnvs = JSON.parse(localStorage.getItem('apex_environments') || '[]');
                    const savedEnv = savedEnvs.find((e: any) => e.environment_id === savedEnvId);
                    if (savedEnv?.base_url) baseUrl = savedEnv.base_url;
                  }
                } catch { /* ignore */ }
              }
              
              const res = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  test_suite: {
                    name: run.name,
                    base_url: baseUrl,
                    test_cases: testCases,
                  },
                  execution_config: {
                    mode: run.mode || 'automated',
                    parallel: (run.mode || 'automated') === 'automated',
                    max_workers: 5,
                  },
                }),
              });
              
              if (!res.ok) {
                const errText = await res.text().catch(() => 'Unknown error');
                throw new Error(`Execution failed (HTTP ${res.status}): ${errText.slice(0, 200)}`);
              }
              
              const rawResp = await res.json();
              // Backend wraps in { status, execution_results: { test_results, summary, ... } }
              const execResults = rawResp?.execution_results || rawResp;
              const testResults = execResults?.test_results || [];
              const summary = execResults?.summary || {};
              
              set((s) => {
                const r = s.test_runs.find(r => r.id === runId);
                if (r) {
                  const failCount = testResults.filter((t: any) => t.status === 'failed' || t.error).length;
                  r.status = failCount > 0 ? 'failed' : 'passed';
                  r.completed_at = nowISO();
                  r.duration_ms = summary.total_duration_ms || testResults.reduce((sum: number, t: any) => sum + (t.response_time_ms || 0), 0);
                  r.results = testResults.map((result: any) => ({
                    request_id: result.test_case_id || '',
                    request_name: result.title || result.test_name || '',
                    method: result.method || '',
                    url: result.url || '',
                    status: result.status === 'passed' ? 'passed' : (result.error ? 'error' : 'failed'),
                    response_status: result.actual_status || 0,
                    response_time_ms: result.response_time_ms || 0,
                    response_body: result.response_body || result.response_data || null,
                    response_headers: result.response_headers || {},
                    assertion_results: result.assertion_results || result.assertions?.results || [],
                    error: result.error || null,
                  }));
                }
                // Store the UNWRAPPED execution results (not the full response wrapper)
                // so the Results tab can directly access .summary, .test_results, etc.
                s.execution_results = execResults;
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
            
            // Retry helper: try up to 2 times with 1s delay for transient CORS/network failures
            const tryFetch = async (url: string, opts: RequestInit, retries = 1): Promise<Response> => {
              try {
                return await fetch(url, opts);
              } catch (err) {
                if (retries > 0) {
                  await new Promise(r => setTimeout(r, 1000));
                  return tryFetch(url, opts, retries - 1);
                }
                throw err;
              }
            };
            
            try {
              // Save to new granular endpoint
              const res = await tryFetch(`${API_BASE_URL}/api/db/api-collections-v2/${collectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(coll),
              });
              
              if (!res.ok) {
                // Fallback: save to legacy endpoint (e.g. v2 table empty)
                await tryFetch(`${API_BASE_URL}/api/db/api-collections/default`, {
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
                }, 0); // No retry on fallback
              }
              
              set((s) => {
                s.sync_status = 'idle';
                s.last_sync = nowISO();
              });
              
              // Sync test cases to Test Repository (/api/db/test-cases) in the background
              try {
                for (const req of coll.requests) {
                  const tcPayload = {
                    title: req.name || `${req.method} ${req.path || req.url || '/'}`,
                    description: req.description || '',
                    category: 'api',
                    priority: 'medium',
                    status: 'active',
                    type: req.test_type || 'functional',
                    tags: [req.method?.toLowerCase(), 'api-collection', coll.name].filter(Boolean),
                    steps: [{
                      step: 1,
                      action: `${req.method} ${req.url || req.path || '/'}`,
                      expected: `Status ${req.expected_status || 200}`,
                    }],
                    metadata: {
                      source: 'api-collection',
                      collection_id: collectionId,
                      request_id: req.id,
                      method: req.method,
                      endpoint: req.url || req.path,
                      headers: req.headers?.reduce((acc: any, h: KeyValuePair) => {
                        if (h.key && h.enabled) acc[h.key] = h.value;
                        return acc;
                      }, {}),
                      body: req.body || undefined,
                      assertions: req.assertions,
                      expected_status: req.expected_status || 200,
                    },
                  };
                  
                  await fetch(`${API_BASE_URL}/api/db/test-cases`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tcPayload),
                  }).catch(() => {}); // Silently ignore per-request failures
                }
              } catch {
                // Non-critical: don't block collection save if sync fails
                console.warn('[ApiTestingStore] Test Repository sync failed (non-critical)');
              }
            } catch (err) {
              console.warn('[ApiTestingStore] Failed to save collection (will retry on next change):', (err as Error).message);
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
          // Persist UI state + collections as local cache (backend is source of truth but
          // localStorage ensures collections survive refresh even when backend is slow)
          partialize: (state) => ({
            active_workspace_id: state.active_workspace_id,
            active_collection_id: state.active_collection_id,
            active_tab: state.active_tab,
            active_environment_id: state.active_environment_id,
            global_variables: state.global_variables,
            execution_mode: state.execution_mode,
            collections: state.collections,
            workspaces: state.workspaces,
            sidebar: {
              open: state.sidebar.open,
              width: state.sidebar.width,
            },
          }),
          // Deep merge so partial persisted sidebar doesn't overwrite Sets/defaults
          merge: (persisted: any, current: any) => {
            if (!persisted) return current;
            return {
              ...current,
              ...persisted,
              // Deep-merge sidebar: keep Sets from current, apply persisted scalars
              sidebar: {
                ...current.sidebar,
                ...(persisted.sidebar || {}),
                // ALWAYS ensure Sets exist (they cannot survive JSON serialization)
                expanded_folders: current.sidebar?.expanded_folders ?? new Set<string>(),
                expanded_endpoints: current.sidebar?.expanded_endpoints ?? new Set<string>(),
              },
              // Ensure other Sets survive rehydration
              selected_test_case_ids: current.selected_test_case_ids ?? new Set<string>(),
              // Ensure collections object survives rehydration
              collections: { ...(current.collections || {}), ...(persisted.collections || {}) },
              workspaces: persisted.workspaces?.length > 0 ? persisted.workspaces : current.workspaces,
            };
          },
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

// Expose store reference on window for beforeunload save handler in RequestBuilder
if (typeof window !== 'undefined') {
  (window as any).__apiTestingStore = useApiTestingStore;
}

