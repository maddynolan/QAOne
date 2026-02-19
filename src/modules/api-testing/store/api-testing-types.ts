/**
 * Type definitions for the API Testing Store.
 * Extracted from apiTestingStore.ts for reuse across the API testing module.
 */

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
  response_body?: any;
  response_headers?: Record<string, string>;
  assertion_results: Array<{
    assertion_id?: string;
    name?: string;
    passed: boolean;
    message: string;
  }>;
  error: string | null;
}

export type RequestResultInfo = { status: string; response_status: number; time: number };

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
// STORE STATE & ACTIONS
// ============================================================================

export interface ApiTestingState {
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

export interface ApiTestingActions {
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
  createFolder: (name: string, parentFolderId?: string | null) => string | undefined;
  renameFolder: (folderId: string, newName: string) => void;
  deleteFolder: (folderId: string) => void;
  moveFolder: (folderId: string, newParentId: string | null) => void;
  toggleFolderExpanded: (folderId: string) => void;

  // --- Request Actions ---
  addRequest: (request: Partial<ApiRequest>, folderId?: string | null) => string;
  updateRequest: (requestId: string, updates: Partial<ApiRequest>) => void;
  deleteRequest: (requestId: string) => void;
  moveRequest: (requestId: string, targetFolderId: string | null) => void;
  reorderRequest: (requestId: string, newIndex: number, folderId?: string | null) => void;
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
