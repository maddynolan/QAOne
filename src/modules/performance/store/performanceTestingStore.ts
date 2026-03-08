/**
 * Performance Testing Store
 * =========================
 * Dedicated Zustand store for the Performance Testing module.
 *
 * Manages scenario configuration, load test execution state, metrics,
 * threshold evaluation, correlation rules, protocol recording, and
 * test history with persistence.
 *
 * Middleware: devtools + persist + immer
 * Persist key: flowstral-perf-store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { LoadTestMetrics } from '@/modules/performance/types/virtual-user-types';

// ============================================================================
// Types
// ============================================================================

export type WorkloadModelType =
  | 'constant_vus'
  | 'ramping_vus'
  | 'per_vu_iterations'
  | 'shared_iterations'
  | 'constant_arrival_rate'
  | 'ramping_arrival_rate';

export interface Stage {
  duration: number;
  target: number;
}

export interface Threshold {
  id: string;
  metric: string; // p50, p90, p95, p99, error_rate, rps, avg_response
  operator: string; // <, <=, >, >=, ==
  value: number;
  critical: boolean;
}

export interface ThresholdResult {
  metric: string;
  passed: boolean;
  actual: number;
  threshold: Threshold;
}

export interface CorrelationRule {
  id: string;
  name: string;
  extractType: 'jsonpath' | 'regex' | 'boundary' | 'header' | 'cookie' | 'xpath' | 'html_form';
  pattern: string;
  variableName: string;
  scope: 'response_body' | 'response_header' | 'cookie';
  occurrence: 'first' | 'last' | 'all';
  enabled: boolean;
}

export interface ScenarioStep {
  id: string;
  type: 'http_request' | 'think_time' | 'loop' | 'condition';
  name: string;
  enabled: boolean;
  // HTTP Request fields
  method?: string;
  url?: string;
  headers?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  bodyType?: string;
  // Extractors (correlation)
  extractors?: Array<{
    id: string;
    type: string;
    variableName: string;
    pattern: string;
    scope: string;
  }>;
  // Checks (assertions)
  checks?: Array<{
    id: string;
    type: string;
    operator: string;
    expectedValue: string;
  }>;
  // Think time
  minDelay?: number;
  maxDelay?: number;
  // Loop
  iterations?: number;
  children?: ScenarioStep[];
}

export interface TestHistoryEntry {
  id: string;
  name: string;
  timestamp: string;
  config: {
    targetUrl: string;
    virtualUsers: number;
    duration: number;
    workloadModel: WorkloadModelType;
    pattern: string;
  };
  metrics: LoadTestMetrics;
  verdict: string;
  verdictReason: string;
  thresholdResults: ThresholdResult[];
}

// ============================================================================
// State & Actions interfaces
// ============================================================================

interface PerformanceTestingState {
  // Scenario
  scenarioSteps: ScenarioStep[];
  scenarioName: string;

  // Config
  targetUrl: string;
  virtualUsers: number;
  duration: number;
  rampUpTime: number;
  pattern: string;
  persona: string;
  thinkTime: boolean;
  iterations: number;
  workloadModel: WorkloadModelType;
  stages: Stage[];
  thresholds: Threshold[];

  // Execution
  isRunning: boolean;
  isPaused: boolean;
  elapsedTime: number;
  useServerRunner: boolean;
  backendTestId: string | null;
  backendScenarioId: string | null;

  // Metrics
  metrics: LoadTestMetrics;
  metricsHistory: LoadTestMetrics[];
  thresholdResults: ThresholdResult[];

  // Correlations
  correlationRules: CorrelationRule[];

  // Protocol Recording
  isProtocolRecording: boolean;
  protocolRecordingId: string | null;

  // History
  testHistory: TestHistoryEntry[];

  // UI
  activeTab: string;

  // Draft
  activeDraftId: string | null;
}

interface PerformanceTestingActions {
  // Scenario
  addScenarioStep: (step: ScenarioStep) => void;
  removeScenarioStep: (stepId: string) => void;
  updateScenarioStep: (stepId: string, updates: Partial<ScenarioStep>) => void;
  reorderScenarioSteps: (fromIndex: number, toIndex: number) => void;
  setScenarioSteps: (steps: ScenarioStep[]) => void;
  setScenarioName: (name: string) => void;

  // Config
  setTargetUrl: (url: string) => void;
  setVirtualUsers: (vus: number) => void;
  setDuration: (duration: number) => void;
  setRampUpTime: (time: number) => void;
  setPattern: (pattern: string) => void;
  setPersona: (persona: string) => void;
  setThinkTime: (enabled: boolean) => void;
  setIterations: (iterations: number) => void;
  setWorkloadModel: (model: WorkloadModelType) => void;
  addStage: (stage: Stage) => void;
  removeStage: (index: number) => void;
  updateStage: (index: number, stage: Stage) => void;
  setStages: (stages: Stage[]) => void;

  // Thresholds
  addThreshold: (threshold: Threshold) => void;
  removeThreshold: (id: string) => void;
  updateThreshold: (id: string, updates: Partial<Threshold>) => void;
  setThresholds: (thresholds: Threshold[]) => void;

  // Execution
  setIsRunning: (running: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setElapsedTime: (time: number) => void;
  setUseServerRunner: (use: boolean) => void;
  setBackendTestId: (id: string | null) => void;
  setBackendScenarioId: (id: string | null) => void;

  // Metrics
  updateMetrics: (metrics: LoadTestMetrics) => void;
  addMetricsSnapshot: (metrics: LoadTestMetrics) => void;
  resetMetrics: () => void;
  setThresholdResults: (results: ThresholdResult[]) => void;

  // Correlations
  addCorrelationRule: (rule: CorrelationRule) => void;
  removeCorrelationRule: (id: string) => void;
  updateCorrelationRule: (id: string, updates: Partial<CorrelationRule>) => void;
  setCorrelationRules: (rules: CorrelationRule[]) => void;

  // Protocol Recording
  setProtocolRecording: (active: boolean, id?: string | null) => void;

  // History
  addToHistory: (entry: TestHistoryEntry) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;

  // UI
  setActiveTab: (tab: string) => void;

  // Draft
  setActiveDraftId: (id: string | null) => void;

  // Reset
  resetConfig: () => void;
  resetAll: () => void;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_METRICS: LoadTestMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  avgResponseTime: 0,
  minResponseTime: 0,
  maxResponseTime: 0,
  p50ResponseTime: 0,
  p90ResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  requestsPerSecond: 0,
  activeUsers: 0,
  errorsPerSecond: 0,
  bytesReceived: 0,
  bytesSent: 0,
};

const DEFAULT_STAGES: Stage[] = [
  { duration: 30, target: 10 },
  { duration: 30, target: 10 },
];

const DEFAULT_THRESHOLDS: Threshold[] = [
  { id: 'th-p95', metric: 'p95', operator: '<', value: 800, critical: true },
  { id: 'th-p99', metric: 'p99', operator: '<', value: 2000, critical: true },
  { id: 'th-error-rate', metric: 'error_rate', operator: '<', value: 1, critical: true },
  { id: 'th-rps', metric: 'rps', operator: '>', value: 10, critical: false },
];

const INITIAL_STATE: PerformanceTestingState = {
  // Scenario
  scenarioSteps: [],
  scenarioName: '',

  // Config
  targetUrl: '',
  virtualUsers: 10,
  duration: 60,
  rampUpTime: 10,
  pattern: 'constant',
  persona: 'normal',
  thinkTime: true,
  iterations: 1,
  workloadModel: 'constant_vus',
  stages: DEFAULT_STAGES,
  thresholds: DEFAULT_THRESHOLDS,

  // Execution (not persisted)
  isRunning: false,
  isPaused: false,
  elapsedTime: 0,
  useServerRunner: false,
  backendTestId: null,
  backendScenarioId: null,

  // Metrics (not persisted)
  metrics: { ...DEFAULT_METRICS },
  metricsHistory: [],
  thresholdResults: [],

  // Correlations
  correlationRules: [],

  // Protocol Recording (not persisted)
  isProtocolRecording: false,
  protocolRecordingId: null,

  // History
  testHistory: [],

  // UI
  activeTab: 'quickstart',

  // Draft (not persisted)
  activeDraftId: null,
};

// ============================================================================
// Store
// ============================================================================

export const usePerformanceTestingStore = create<
  PerformanceTestingState & PerformanceTestingActions
>()(
  devtools(
    persist(
      immer((set) => ({
        ...INITIAL_STATE,

        // ====================================================================
        // Scenario actions
        // ====================================================================

        addScenarioStep: (step) =>
          set(
            (state) => {
              state.scenarioSteps.push(step);
            },
            false,
            'addScenarioStep'
          ),

        removeScenarioStep: (stepId) =>
          set(
            (state) => {
              state.scenarioSteps = state.scenarioSteps.filter((s) => s.id !== stepId);
            },
            false,
            'removeScenarioStep'
          ),

        updateScenarioStep: (stepId, updates) =>
          set(
            (state) => {
              const idx = state.scenarioSteps.findIndex((s) => s.id === stepId);
              if (idx !== -1) {
                Object.assign(state.scenarioSteps[idx], updates);
              }
            },
            false,
            'updateScenarioStep'
          ),

        reorderScenarioSteps: (fromIndex, toIndex) =>
          set(
            (state) => {
              const [moved] = state.scenarioSteps.splice(fromIndex, 1);
              state.scenarioSteps.splice(toIndex, 0, moved);
            },
            false,
            'reorderScenarioSteps'
          ),

        setScenarioSteps: (steps) =>
          set(
            (state) => {
              state.scenarioSteps = steps;
            },
            false,
            'setScenarioSteps'
          ),

        setScenarioName: (name) =>
          set(
            (state) => {
              state.scenarioName = name;
            },
            false,
            'setScenarioName'
          ),

        // ====================================================================
        // Config actions
        // ====================================================================

        setTargetUrl: (url) =>
          set(
            (state) => {
              state.targetUrl = url;
            },
            false,
            'setTargetUrl'
          ),

        setVirtualUsers: (vus) =>
          set(
            (state) => {
              state.virtualUsers = vus;
            },
            false,
            'setVirtualUsers'
          ),

        setDuration: (duration) =>
          set(
            (state) => {
              state.duration = duration;
            },
            false,
            'setDuration'
          ),

        setRampUpTime: (time) =>
          set(
            (state) => {
              state.rampUpTime = time;
            },
            false,
            'setRampUpTime'
          ),

        setPattern: (pattern) =>
          set(
            (state) => {
              state.pattern = pattern;
            },
            false,
            'setPattern'
          ),

        setPersona: (persona) =>
          set(
            (state) => {
              state.persona = persona;
            },
            false,
            'setPersona'
          ),

        setThinkTime: (enabled) =>
          set(
            (state) => {
              state.thinkTime = enabled;
            },
            false,
            'setThinkTime'
          ),

        setIterations: (iterations) =>
          set(
            (state) => {
              state.iterations = iterations;
            },
            false,
            'setIterations'
          ),

        setWorkloadModel: (model) =>
          set(
            (state) => {
              state.workloadModel = model;
            },
            false,
            'setWorkloadModel'
          ),

        addStage: (stage) =>
          set(
            (state) => {
              state.stages.push(stage);
            },
            false,
            'addStage'
          ),

        removeStage: (index) =>
          set(
            (state) => {
              state.stages.splice(index, 1);
            },
            false,
            'removeStage'
          ),

        updateStage: (index, stage) =>
          set(
            (state) => {
              if (index >= 0 && index < state.stages.length) {
                state.stages[index] = stage;
              }
            },
            false,
            'updateStage'
          ),

        setStages: (stages) =>
          set(
            (state) => {
              state.stages = stages;
            },
            false,
            'setStages'
          ),

        // ====================================================================
        // Threshold actions
        // ====================================================================

        addThreshold: (threshold) =>
          set(
            (state) => {
              state.thresholds.push(threshold);
            },
            false,
            'addThreshold'
          ),

        removeThreshold: (id) =>
          set(
            (state) => {
              state.thresholds = state.thresholds.filter((t) => t.id !== id);
            },
            false,
            'removeThreshold'
          ),

        updateThreshold: (id, updates) =>
          set(
            (state) => {
              const idx = state.thresholds.findIndex((t) => t.id === id);
              if (idx !== -1) {
                Object.assign(state.thresholds[idx], updates);
              }
            },
            false,
            'updateThreshold'
          ),

        setThresholds: (thresholds) =>
          set(
            (state) => {
              state.thresholds = thresholds;
            },
            false,
            'setThresholds'
          ),

        // ====================================================================
        // Execution actions
        // ====================================================================

        setIsRunning: (running) =>
          set(
            (state) => {
              state.isRunning = running;
            },
            false,
            'setIsRunning'
          ),

        setIsPaused: (paused) =>
          set(
            (state) => {
              state.isPaused = paused;
            },
            false,
            'setIsPaused'
          ),

        setElapsedTime: (time) =>
          set(
            (state) => {
              state.elapsedTime = time;
            },
            false,
            'setElapsedTime'
          ),

        setUseServerRunner: (use) =>
          set(
            (state) => {
              state.useServerRunner = use;
            },
            false,
            'setUseServerRunner'
          ),

        setBackendTestId: (id) =>
          set(
            (state) => {
              state.backendTestId = id;
            },
            false,
            'setBackendTestId'
          ),

        setBackendScenarioId: (id) =>
          set(
            (state) => {
              state.backendScenarioId = id;
            },
            false,
            'setBackendScenarioId'
          ),

        // ====================================================================
        // Metrics actions
        // ====================================================================

        updateMetrics: (metrics) =>
          set(
            (state) => {
              state.metrics = metrics;
            },
            false,
            'updateMetrics'
          ),

        addMetricsSnapshot: (metrics) =>
          set(
            (state) => {
              state.metricsHistory.push(metrics);
            },
            false,
            'addMetricsSnapshot'
          ),

        resetMetrics: () =>
          set(
            (state) => {
              state.metrics = { ...DEFAULT_METRICS };
              state.metricsHistory = [];
              state.thresholdResults = [];
            },
            false,
            'resetMetrics'
          ),

        setThresholdResults: (results) =>
          set(
            (state) => {
              state.thresholdResults = results;
            },
            false,
            'setThresholdResults'
          ),

        // ====================================================================
        // Correlation actions
        // ====================================================================

        addCorrelationRule: (rule) =>
          set(
            (state) => {
              state.correlationRules.push(rule);
            },
            false,
            'addCorrelationRule'
          ),

        removeCorrelationRule: (id) =>
          set(
            (state) => {
              state.correlationRules = state.correlationRules.filter((r) => r.id !== id);
            },
            false,
            'removeCorrelationRule'
          ),

        updateCorrelationRule: (id, updates) =>
          set(
            (state) => {
              const idx = state.correlationRules.findIndex((r) => r.id === id);
              if (idx !== -1) {
                Object.assign(state.correlationRules[idx], updates);
              }
            },
            false,
            'updateCorrelationRule'
          ),

        setCorrelationRules: (rules) =>
          set(
            (state) => {
              state.correlationRules = rules;
            },
            false,
            'setCorrelationRules'
          ),

        // ====================================================================
        // Protocol Recording actions
        // ====================================================================

        setProtocolRecording: (active, id) =>
          set(
            (state) => {
              state.isProtocolRecording = active;
              state.protocolRecordingId = id ?? null;
            },
            false,
            'setProtocolRecording'
          ),

        // ====================================================================
        // History actions
        // ====================================================================

        addToHistory: (entry) =>
          set(
            (state) => {
              state.testHistory.unshift(entry);
              // Cap at 50 entries
              if (state.testHistory.length > 50) {
                state.testHistory = state.testHistory.slice(0, 50);
              }
            },
            false,
            'addToHistory'
          ),

        removeFromHistory: (id) =>
          set(
            (state) => {
              state.testHistory = state.testHistory.filter((h) => h.id !== id);
            },
            false,
            'removeFromHistory'
          ),

        clearHistory: () =>
          set(
            (state) => {
              state.testHistory = [];
            },
            false,
            'clearHistory'
          ),

        // ====================================================================
        // UI actions
        // ====================================================================

        setActiveTab: (tab) =>
          set(
            (state) => {
              state.activeTab = tab;
            },
            false,
            'setActiveTab'
          ),

        // ====================================================================
        // Draft actions
        // ====================================================================

        setActiveDraftId: (id) =>
          set(
            (state) => {
              state.activeDraftId = id;
            },
            false,
            'setActiveDraftId'
          ),

        // ====================================================================
        // Reset actions
        // ====================================================================

        resetConfig: () =>
          set(
            (state) => {
              state.scenarioSteps = [];
              state.scenarioName = '';
              state.targetUrl = '';
              state.virtualUsers = 10;
              state.duration = 60;
              state.rampUpTime = 10;
              state.pattern = 'constant';
              state.persona = 'normal';
              state.thinkTime = true;
              state.iterations = 1;
              state.workloadModel = 'constant_vus';
              state.stages = DEFAULT_STAGES.map((s) => ({ ...s }));
              state.thresholds = DEFAULT_THRESHOLDS.map((t) => ({ ...t }));
              state.correlationRules = [];
            },
            false,
            'resetConfig'
          ),

        resetAll: () =>
          set(
            () => ({ ...INITIAL_STATE }),
            true, // replace entire state
            'resetAll'
          ),
      })),
      {
        name: 'flowstral-perf-store',
        partialize: (state) => ({
          // Only persist these fields
          scenarioSteps: state.scenarioSteps,
          scenarioName: state.scenarioName,
          targetUrl: state.targetUrl,
          virtualUsers: state.virtualUsers,
          duration: state.duration,
          rampUpTime: state.rampUpTime,
          pattern: state.pattern,
          persona: state.persona,
          thinkTime: state.thinkTime,
          iterations: state.iterations,
          workloadModel: state.workloadModel,
          stages: state.stages,
          thresholds: state.thresholds,
          correlationRules: state.correlationRules,
          testHistory: state.testHistory,
          useServerRunner: state.useServerRunner,
          activeTab: state.activeTab,
        }),
      }
    ),
    { name: 'PerformanceTestingStore' }
  )
);
