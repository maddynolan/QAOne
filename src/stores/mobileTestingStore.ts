/**
 * Mobile Testing Store
 * ====================
 * Dedicated Zustand store for the Mobile Testing module.
 *
 * Manages:
 * 1. SAVED TEST FLOWS - CRUD for Maestro YAML flows with folders
 * 2. TEST RUN HISTORY - Execution results, pass/fail tracking
 * 3. DEVICE STATE - Selected platform, device, app bundle
 * 4. INSPECTOR STATE - Element tree, selected element
 * 5. ADVANCED TOOLS - Deep links, push notifications, network, geolocation
 * 6. UI STATE - Active tab, studio status, editor state
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// TYPES
// ============================================================================

export type MobileTab = 'studio' | 'flows' | 'device-lab' | 'runs' | 'inspector' | 'tools';
export type MobilePlatform = 'ios' | 'android';
export type TestRunStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'error';
export type FlowPriority = 'critical' | 'high' | 'medium' | 'low';

export interface MobileTestFlow {
  id: string;
  name: string;
  description: string;
  folder_id: string | null;
  yaml: string;
  app_bundle_id: string;
  platform: MobilePlatform;
  tags: string[];
  priority: FlowPriority;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: TestRunStatus | null;
  run_count: number;
}

export interface MobileTestFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  expanded: boolean;
  created_at: string;
}

export interface MobileTestRun {
  id: string;
  flow_id: string;
  flow_name: string;
  platform: MobilePlatform;
  device: string;
  app_bundle_id: string;
  status: TestRunStatus;
  duration_ms: number;
  steps_total: number;
  steps_passed: number;
  steps_failed: number;
  output: string[];
  screenshots: string[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: MobilePlatform;
  os_version: string;
  status: 'connected' | 'disconnected' | 'booting';
  is_emulator: boolean;
}

export interface InstalledApp {
  bundle_id: string;
  name: string;
  version: string;
  platform: MobilePlatform;
  installed_at: string;
}

export interface ElementNode {
  id: string;
  type: string;
  text: string;
  resource_id: string;
  content_desc: string;
  bounds: { x: number; y: number; width: number; height: number };
  children: ElementNode[];
  attributes: Record<string, string>;
  clickable: boolean;
  visible: boolean;
}

export interface DeepLinkConfig {
  id: string;
  name: string;
  url: string;
  platform: MobilePlatform;
  description: string;
}

export interface NetworkProfile {
  id: string;
  name: string;
  download_kbps: number;
  upload_kbps: number;
  latency_ms: number;
  packet_loss: number;
}

export interface GeoLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
}

// ============================================================================
// STORE STATE
// ============================================================================

interface MobileTestingState {
  // UI State
  activeTab: MobileTab;
  isSidebarCollapsed: boolean;

  // Studio State
  isStudioRunning: boolean;
  isStartingStudio: boolean;
  studioOutput: string[];

  // Device State
  selectedPlatform: MobilePlatform;
  selectedDevice: string;
  appBundleId: string;
  nativeDevices: string[];
  isLoadingDevices: boolean;
  maestroInstalled: boolean | null;
  isCheckingMaestro: boolean;
  installedApps: InstalledApp[];

  // Flow Management
  flows: MobileTestFlow[];
  folders: MobileTestFolder[];
  activeFlowId: string | null;
  flowSearchQuery: string;
  flowFilterPlatform: MobilePlatform | 'all';
  flowFilterPriority: FlowPriority | 'all';
  flowFilterStatus: TestRunStatus | 'all';

  // Test Runs
  testRuns: MobileTestRun[];
  isRunningTest: boolean;
  currentRunId: string | null;

  // Inspector
  elementTree: ElementNode | null;
  selectedElementId: string | null;
  isInspecting: boolean;
  screenshotUrl: string | null;

  // Advanced Tools
  deepLinks: DeepLinkConfig[];
  savedLocations: GeoLocation[];
  activeNetworkProfile: string | null;
  networkProfiles: NetworkProfile[];
  currentLocation: GeoLocation | null;
  pushNotificationPayload: string;

  // Settings
  defaultBundleIds: Record<MobilePlatform, string>;
  autoScreenshot: boolean;
  keepTestHistory: number; // days
  maestroTimeout: number; // seconds
}

// ============================================================================
// ACTIONS
// ============================================================================

interface MobileTestingActions {
  // UI Actions
  setActiveTab: (tab: MobileTab) => void;
  toggleSidebar: () => void;

  // Studio Actions
  setStudioRunning: (running: boolean) => void;
  setStartingStudio: (starting: boolean) => void;
  addStudioOutput: (line: string) => void;
  clearStudioOutput: () => void;

  // Device Actions
  setSelectedPlatform: (platform: MobilePlatform) => void;
  setSelectedDevice: (device: string) => void;
  setAppBundleId: (id: string) => void;
  setNativeDevices: (devices: string[]) => void;
  setIsLoadingDevices: (loading: boolean) => void;
  setMaestroInstalled: (installed: boolean | null) => void;
  setIsCheckingMaestro: (checking: boolean) => void;
  addInstalledApp: (app: InstalledApp) => void;
  removeInstalledApp: (bundleId: string) => void;

  // Flow Management Actions
  createFlow: (flow: Omit<MobileTestFlow, 'id' | 'created_at' | 'updated_at' | 'last_run_at' | 'last_run_status' | 'run_count'>) => string;
  updateFlow: (id: string, updates: Partial<MobileTestFlow>) => void;
  deleteFlow: (id: string) => void;
  duplicateFlow: (id: string) => string;
  setActiveFlow: (id: string | null) => void;
  setFlowSearch: (query: string) => void;
  setFlowFilterPlatform: (platform: MobilePlatform | 'all') => void;
  setFlowFilterPriority: (priority: FlowPriority | 'all') => void;
  setFlowFilterStatus: (status: TestRunStatus | 'all') => void;
  importFlows: (yaml: string, name: string) => string;

  // Folder Actions
  createFolder: (name: string, parentId?: string | null, color?: string) => string;
  updateFolder: (id: string, updates: Partial<MobileTestFolder>) => void;
  deleteFolder: (id: string) => void;
  toggleFolder: (id: string) => void;

  // Test Run Actions
  addTestRun: (run: Omit<MobileTestRun, 'id'>) => string;
  updateTestRun: (id: string, updates: Partial<MobileTestRun>) => void;
  setIsRunningTest: (running: boolean) => void;
  setCurrentRunId: (id: string | null) => void;
  clearTestRuns: () => void;
  deleteTestRun: (id: string) => void;

  // Inspector Actions
  setElementTree: (tree: ElementNode | null) => void;
  setSelectedElement: (id: string | null) => void;
  setIsInspecting: (inspecting: boolean) => void;
  setScreenshotUrl: (url: string | null) => void;

  // Advanced Tools Actions
  addDeepLink: (link: Omit<DeepLinkConfig, 'id'>) => string;
  updateDeepLink: (id: string, updates: Partial<DeepLinkConfig>) => void;
  deleteDeepLink: (id: string) => void;
  addSavedLocation: (location: Omit<GeoLocation, 'id'>) => string;
  deleteSavedLocation: (id: string) => void;
  setCurrentLocation: (location: GeoLocation | null) => void;
  setActiveNetworkProfile: (id: string | null) => void;
  setPushNotificationPayload: (payload: string) => void;

  // Settings Actions
  setDefaultBundleId: (platform: MobilePlatform, bundleId: string) => void;
  setAutoScreenshot: (enabled: boolean) => void;
  setKeepTestHistory: (days: number) => void;
  setMaestroTimeout: (seconds: number) => void;
}

// ============================================================================
// HELPER
// ============================================================================

const generateId = () => `mob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// ============================================================================
// DEFAULT NETWORK PROFILES
// ============================================================================

const DEFAULT_NETWORK_PROFILES: NetworkProfile[] = [
  { id: 'wifi', name: 'WiFi', download_kbps: 30000, upload_kbps: 15000, latency_ms: 2, packet_loss: 0 },
  { id: '5g', name: '5G', download_kbps: 10000, upload_kbps: 5000, latency_ms: 10, packet_loss: 0 },
  { id: '4g-lte', name: '4G LTE', download_kbps: 4000, upload_kbps: 3000, latency_ms: 20, packet_loss: 0 },
  { id: '4g', name: '4G', download_kbps: 1500, upload_kbps: 750, latency_ms: 50, packet_loss: 0 },
  { id: '3g', name: '3G', download_kbps: 750, upload_kbps: 250, latency_ms: 100, packet_loss: 0 },
  { id: '3g-slow', name: '3G Slow', download_kbps: 400, upload_kbps: 100, latency_ms: 200, packet_loss: 0.5 },
  { id: '2g', name: '2G / Edge', download_kbps: 50, upload_kbps: 20, latency_ms: 500, packet_loss: 1 },
  { id: 'offline', name: 'Offline', download_kbps: 0, upload_kbps: 0, latency_ms: 0, packet_loss: 100 },
];

// ============================================================================
// DEFAULT GEO LOCATIONS
// ============================================================================

const DEFAULT_LOCATIONS: GeoLocation[] = [
  { id: 'sf', name: 'San Francisco, CA', latitude: 37.7749, longitude: -122.4194, altitude: 16 },
  { id: 'nyc', name: 'New York, NY', latitude: 40.7128, longitude: -74.0060, altitude: 10 },
  { id: 'london', name: 'London, UK', latitude: 51.5074, longitude: -0.1278, altitude: 11 },
  { id: 'tokyo', name: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503, altitude: 40 },
  { id: 'sydney', name: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093, altitude: 58 },
  { id: 'berlin', name: 'Berlin, Germany', latitude: 52.5200, longitude: 13.4050, altitude: 34 },
  { id: 'mumbai', name: 'Mumbai, India', latitude: 19.0760, longitude: 72.8777, altitude: 14 },
  { id: 'sao-paulo', name: 'São Paulo, Brazil', latitude: -23.5505, longitude: -46.6333, altitude: 760 },
];

// ============================================================================
// SAMPLE FLOWS
// ============================================================================

const SAMPLE_FLOWS: MobileTestFlow[] = [
  {
    id: 'sample-login',
    name: 'Login Flow',
    description: 'Tests the standard login flow with valid credentials',
    folder_id: null,
    yaml: `appId: com.example.app\n---\n- launchApp\n- tapOn: "Login"\n- inputText:\n    id: "email"\n    text: "test@example.com"\n- inputText:\n    id: "password"\n    text: "password123"\n- tapOn: "Submit"\n- assertVisible: "Welcome"`,
    app_bundle_id: 'com.example.app',
    platform: 'ios',
    tags: ['auth', 'smoke'],
    priority: 'critical',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_run_at: null,
    last_run_status: null,
    run_count: 0,
  },
  {
    id: 'sample-onboarding',
    name: 'Onboarding Flow',
    description: 'Tests the onboarding carousel and skip functionality',
    folder_id: null,
    yaml: `appId: com.example.app\n---\n- launchApp\n- assertVisible: "Welcome to Our App"\n- swipe:\n    direction: LEFT\n    duration: 500\n- assertVisible: "Feature 1"\n- swipe:\n    direction: LEFT\n    duration: 500\n- assertVisible: "Feature 2"\n- tapOn: "Skip"\n- assertVisible: "Home"`,
    app_bundle_id: 'com.example.app',
    platform: 'ios',
    tags: ['onboarding', 'smoke'],
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_run_at: null,
    last_run_status: null,
    run_count: 0,
  },
];

// ============================================================================
// STORE
// ============================================================================

export const useMobileTestingStore = create<MobileTestingState & MobileTestingActions>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial State
          activeTab: 'studio' as MobileTab,
          isSidebarCollapsed: false,

          isStudioRunning: false,
          isStartingStudio: false,
          studioOutput: [],

          selectedPlatform: 'ios' as MobilePlatform,
          selectedDevice: '',
          appBundleId: '',
          nativeDevices: [],
          isLoadingDevices: false,
          maestroInstalled: null,
          isCheckingMaestro: false,
          installedApps: [],

          flows: SAMPLE_FLOWS,
          folders: [],
          activeFlowId: null,
          flowSearchQuery: '',
          flowFilterPlatform: 'all' as const,
          flowFilterPriority: 'all' as const,
          flowFilterStatus: 'all' as const,

          testRuns: [],
          isRunningTest: false,
          currentRunId: null,

          elementTree: null,
          selectedElementId: null,
          isInspecting: false,
          screenshotUrl: null,

          deepLinks: [],
          savedLocations: DEFAULT_LOCATIONS,
          activeNetworkProfile: null,
          networkProfiles: DEFAULT_NETWORK_PROFILES,
          currentLocation: null,
          pushNotificationPayload: JSON.stringify({
            aps: {
              alert: { title: "Test Notification", body: "This is a test push notification" },
              badge: 1,
              sound: "default"
            },
            custom_key: "custom_value"
          }, null, 2),

          defaultBundleIds: { ios: '', android: '' },
          autoScreenshot: true,
          keepTestHistory: 30,
          maestroTimeout: 60,

          // UI Actions
          setActiveTab: (tab) => set((state) => { state.activeTab = tab; }),
          toggleSidebar: () => set((state) => { state.isSidebarCollapsed = !state.isSidebarCollapsed; }),

          // Studio Actions
          setStudioRunning: (running) => set((state) => { state.isStudioRunning = running; }),
          setStartingStudio: (starting) => set((state) => { state.isStartingStudio = starting; }),
          addStudioOutput: (line) => set((state) => { state.studioOutput.push(line); }),
          clearStudioOutput: () => set((state) => { state.studioOutput = []; }),

          // Device Actions
          setSelectedPlatform: (platform) => set((state) => { state.selectedPlatform = platform; }),
          setSelectedDevice: (device) => set((state) => { state.selectedDevice = device; }),
          setAppBundleId: (id) => set((state) => { state.appBundleId = id; }),
          setNativeDevices: (devices) => set((state) => { state.nativeDevices = devices; }),
          setIsLoadingDevices: (loading) => set((state) => { state.isLoadingDevices = loading; }),
          setMaestroInstalled: (installed) => set((state) => { state.maestroInstalled = installed; }),
          setIsCheckingMaestro: (checking) => set((state) => { state.isCheckingMaestro = checking; }),
          addInstalledApp: (app) => set((state) => { state.installedApps.push(app); }),
          removeInstalledApp: (bundleId) => set((state) => {
            state.installedApps = state.installedApps.filter(a => a.bundle_id !== bundleId);
          }),

          // Flow Management
          createFlow: (flow) => {
            const id = generateId();
            const now = new Date().toISOString();
            set((state) => {
              state.flows.push({
                ...flow,
                id,
                created_at: now,
                updated_at: now,
                last_run_at: null,
                last_run_status: null,
                run_count: 0,
              });
            });
            return id;
          },

          updateFlow: (id, updates) => set((state) => {
            const idx = state.flows.findIndex(f => f.id === id);
            if (idx !== -1) {
              Object.assign(state.flows[idx], updates, { updated_at: new Date().toISOString() });
            }
          }),

          deleteFlow: (id) => set((state) => {
            state.flows = state.flows.filter(f => f.id !== id);
            if (state.activeFlowId === id) state.activeFlowId = null;
          }),

          duplicateFlow: (id) => {
            const original = get().flows.find(f => f.id === id);
            if (!original) return '';
            const newId = generateId();
            const now = new Date().toISOString();
            set((state) => {
              state.flows.push({
                ...original,
                id: newId,
                name: `${original.name} (Copy)`,
                created_at: now,
                updated_at: now,
                last_run_at: null,
                last_run_status: null,
                run_count: 0,
              });
            });
            return newId;
          },

          setActiveFlow: (id) => set((state) => { state.activeFlowId = id; }),
          setFlowSearch: (query) => set((state) => { state.flowSearchQuery = query; }),
          setFlowFilterPlatform: (platform) => set((state) => { state.flowFilterPlatform = platform; }),
          setFlowFilterPriority: (priority) => set((state) => { state.flowFilterPriority = priority; }),
          setFlowFilterStatus: (status) => set((state) => { state.flowFilterStatus = status; }),

          importFlows: (yaml, name) => {
            const id = generateId();
            const now = new Date().toISOString();
            set((state) => {
              state.flows.push({
                id,
                name,
                description: 'Imported flow',
                folder_id: null,
                yaml,
                app_bundle_id: '',
                platform: 'ios',
                tags: ['imported'],
                priority: 'medium',
                created_at: now,
                updated_at: now,
                last_run_at: null,
                last_run_status: null,
                run_count: 0,
              });
            });
            return id;
          },

          // Folder Actions
          createFolder: (name, parentId = null, color = '#8b5cf6') => {
            const id = generateId();
            set((state) => {
              state.folders.push({
                id,
                name,
                parent_id: parentId ?? null,
                color,
                expanded: true,
                created_at: new Date().toISOString(),
              });
            });
            return id;
          },

          updateFolder: (id, updates) => set((state) => {
            const idx = state.folders.findIndex(f => f.id === id);
            if (idx !== -1) Object.assign(state.folders[idx], updates);
          }),

          deleteFolder: (id) => set((state) => {
            state.folders = state.folders.filter(f => f.id !== id);
            // Move flows from deleted folder to root
            state.flows.forEach(f => {
              if (f.folder_id === id) f.folder_id = null;
            });
          }),

          toggleFolder: (id) => set((state) => {
            const folder = state.folders.find(f => f.id === id);
            if (folder) folder.expanded = !folder.expanded;
          }),

          // Test Run Actions
          addTestRun: (run) => {
            const id = generateId();
            set((state) => {
              state.testRuns.unshift({ ...run, id });
            });
            return id;
          },

          updateTestRun: (id, updates) => set((state) => {
            const idx = state.testRuns.findIndex(r => r.id === id);
            if (idx !== -1) Object.assign(state.testRuns[idx], updates);
          }),

          setIsRunningTest: (running) => set((state) => { state.isRunningTest = running; }),
          setCurrentRunId: (id) => set((state) => { state.currentRunId = id; }),
          clearTestRuns: () => set((state) => { state.testRuns = []; }),
          deleteTestRun: (id) => set((state) => {
            state.testRuns = state.testRuns.filter(r => r.id !== id);
          }),

          // Inspector Actions
          setElementTree: (tree) => set((state) => { state.elementTree = tree; }),
          setSelectedElement: (id) => set((state) => { state.selectedElementId = id; }),
          setIsInspecting: (inspecting) => set((state) => { state.isInspecting = inspecting; }),
          setScreenshotUrl: (url) => set((state) => { state.screenshotUrl = url; }),

          // Advanced Tools Actions
          addDeepLink: (link) => {
            const id = generateId();
            set((state) => { state.deepLinks.push({ ...link, id }); });
            return id;
          },
          updateDeepLink: (id, updates) => set((state) => {
            const idx = state.deepLinks.findIndex(l => l.id === id);
            if (idx !== -1) Object.assign(state.deepLinks[idx], updates);
          }),
          deleteDeepLink: (id) => set((state) => {
            state.deepLinks = state.deepLinks.filter(l => l.id !== id);
          }),
          addSavedLocation: (location) => {
            const id = generateId();
            set((state) => { state.savedLocations.push({ ...location, id }); });
            return id;
          },
          deleteSavedLocation: (id) => set((state) => {
            state.savedLocations = state.savedLocations.filter(l => l.id !== id);
          }),
          setCurrentLocation: (location) => set((state) => { state.currentLocation = location; }),
          setActiveNetworkProfile: (id) => set((state) => { state.activeNetworkProfile = id; }),
          setPushNotificationPayload: (payload) => set((state) => { state.pushNotificationPayload = payload; }),

          // Settings Actions
          setDefaultBundleId: (platform, bundleId) => set((state) => {
            state.defaultBundleIds[platform] = bundleId;
          }),
          setAutoScreenshot: (enabled) => set((state) => { state.autoScreenshot = enabled; }),
          setKeepTestHistory: (days) => set((state) => { state.keepTestHistory = days; }),
          setMaestroTimeout: (seconds) => set((state) => { state.maestroTimeout = seconds; }),
        })),
        {
          name: 'mobile-testing-store',
          version: 1,
          partialize: (state) => ({
            // Persist only user data, not transient UI state
            flows: state.flows,
            folders: state.folders,
            testRuns: state.testRuns,
            deepLinks: state.deepLinks,
            savedLocations: state.savedLocations,
            networkProfiles: state.networkProfiles,
            pushNotificationPayload: state.pushNotificationPayload,
            defaultBundleIds: state.defaultBundleIds,
            autoScreenshot: state.autoScreenshot,
            keepTestHistory: state.keepTestHistory,
            maestroTimeout: state.maestroTimeout,
            selectedPlatform: state.selectedPlatform,
            appBundleId: state.appBundleId,
            activeTab: state.activeTab,
          }),
        }
      )
    ),
    { name: 'MobileTestingStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const useFilteredFlows = () => useMobileTestingStore((state) => {
  let filtered = [...state.flows];

  if (state.flowSearchQuery) {
    const q = state.flowSearchQuery.toLowerCase();
    filtered = filtered.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  if (state.flowFilterPlatform !== 'all') {
    filtered = filtered.filter(f => f.platform === state.flowFilterPlatform);
  }

  if (state.flowFilterPriority !== 'all') {
    filtered = filtered.filter(f => f.priority === state.flowFilterPriority);
  }

  if (state.flowFilterStatus !== 'all') {
    filtered = filtered.filter(f => f.last_run_status === state.flowFilterStatus);
  }

  return filtered;
});

export const useActiveFlow = () => useMobileTestingStore((state) => {
  if (!state.activeFlowId) return null;
  return state.flows.find(f => f.id === state.activeFlowId) ?? null;
});

export const useTestRunStats = () => useMobileTestingStore((state) => {
  const runs = state.testRuns;
  const total = runs.length;
  const passed = runs.filter(r => r.status === 'passed').length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const errors = runs.filter(r => r.status === 'error').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const avgDuration = total > 0 ? Math.round(runs.reduce((sum, r) => sum + r.duration_ms, 0) / total) : 0;
  return { total, passed, failed, errors, passRate, avgDuration };
});
