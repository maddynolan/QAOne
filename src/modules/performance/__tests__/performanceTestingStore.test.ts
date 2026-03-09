/**
 * Unit Tests — Performance Testing Zustand Store
 * ================================================
 * Tests all state management, actions, persistence partialize,
 * and complex behaviors like history capping and reordering.
 */

import { usePerformanceTestingStore } from '../store/performanceTestingStore';
import type {
  ScenarioStep,
  Threshold,
  CorrelationRule,
  Stage,
  TestHistoryEntry,
  WorkloadModelType,
} from '../store/performanceTestingStore';
import type { LoadTestMetrics } from '../types/virtual-user-types';

// Reset store between tests using setState (merge mode).
// We cannot use resetAll() because it uses immer `replace: true`
// which strips action methods from the zustand store in the test env.
const resetStore = () => {
  usePerformanceTestingStore.setState({
    scenarioSteps: [],
    scenarioName: '',
    targetUrl: '',
    virtualUsers: 10,
    duration: 60,
    rampUpTime: 10,
    pattern: 'constant',
    persona: 'normal',
    thinkTime: true,
    iterations: 1,
    workloadModel: 'constant_vus' as WorkloadModelType,
    stages: [
      { duration: 30, target: 10 },
      { duration: 30, target: 10 },
    ],
    thresholds: [
      { id: 'th-p95', metric: 'p95', operator: '<', value: 800, critical: true },
      { id: 'th-p99', metric: 'p99', operator: '<', value: 2000, critical: true },
      { id: 'th-error-rate', metric: 'error_rate', operator: '<', value: 1, critical: true },
      { id: 'th-rps', metric: 'rps', operator: '>', value: 10, critical: false },
    ],
    isRunning: false,
    isPaused: false,
    elapsedTime: 0,
    useServerRunner: false,
    backendTestId: null,
    backendScenarioId: null,
    metrics: {
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      avgResponseTime: 0, minResponseTime: 0, maxResponseTime: 0,
      p50ResponseTime: 0, p90ResponseTime: 0, p95ResponseTime: 0,
      p99ResponseTime: 0, requestsPerSecond: 0, activeUsers: 0,
      errorsPerSecond: 0, bytesReceived: 0, bytesSent: 0,
    },
    metricsHistory: [] as LoadTestMetrics[],
    thresholdResults: [],
    correlationRules: [],
    isProtocolRecording: false,
    protocolRecordingId: null,
    testHistory: [],
    activeTab: 'quickstart',
    activeDraftId: null,
  }, false);
};

// Helper: create a minimal ScenarioStep
const makeStep = (id: string, overrides?: Partial<ScenarioStep>): ScenarioStep => ({
  id,
  type: 'http_request',
  name: `Step ${id}`,
  enabled: true,
  method: 'GET',
  url: `https://api.example.com/${id}`,
  ...overrides,
});

// Helper: create a minimal Threshold
const makeThreshold = (id: string, overrides?: Partial<Threshold>): Threshold => ({
  id,
  metric: 'p95',
  operator: '<',
  value: 500,
  critical: true,
  ...overrides,
});

// Helper: create a minimal CorrelationRule
const makeRule = (id: string, overrides?: Partial<CorrelationRule>): CorrelationRule => ({
  id,
  name: `Rule ${id}`,
  extractType: 'jsonpath',
  pattern: '$.data.token',
  variableName: `var_${id}`,
  scope: 'response_body',
  occurrence: 'first',
  enabled: true,
  ...overrides,
});

// Helper: create metrics
const makeMetrics = (overrides?: Partial<LoadTestMetrics>): LoadTestMetrics => ({
  totalRequests: 100,
  successfulRequests: 95,
  failedRequests: 5,
  avgResponseTime: 250,
  minResponseTime: 50,
  maxResponseTime: 1200,
  p50ResponseTime: 200,
  p90ResponseTime: 450,
  p95ResponseTime: 600,
  p99ResponseTime: 900,
  requestsPerSecond: 10,
  activeUsers: 5,
  errorsPerSecond: 0.5,
  bytesReceived: 1024000,
  bytesSent: 512000,
  ...overrides,
});

// Helper: create TestHistoryEntry
const makeHistoryEntry = (id: string): TestHistoryEntry => ({
  id,
  name: `Test Run ${id}`,
  timestamp: new Date().toISOString(),
  config: {
    targetUrl: 'https://api.example.com',
    virtualUsers: 10,
    duration: 60,
    workloadModel: 'constant_vus',
    pattern: 'constant',
  },
  metrics: makeMetrics(),
  verdict: 'pass',
  verdictReason: 'All thresholds met',
  thresholdResults: [],
});

describe('Performance Testing Store', () => {
  beforeEach(() => {
    resetStore();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================
  describe('Initial State', () => {
    it('has correct default values', () => {
      const state = usePerformanceTestingStore.getState();
      expect(state.scenarioSteps).toEqual([]);
      expect(state.scenarioName).toBe('');
      expect(state.targetUrl).toBe('');
      expect(state.virtualUsers).toBe(10);
      expect(state.duration).toBe(60);
      expect(state.rampUpTime).toBe(10);
      expect(state.pattern).toBe('constant');
      expect(state.persona).toBe('normal');
      expect(state.thinkTime).toBe(true);
      expect(state.iterations).toBe(1);
      expect(state.workloadModel).toBe('constant_vus');
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.useServerRunner).toBe(false);
      expect(state.activeTab).toBe('quickstart');
      expect(state.testHistory).toEqual([]);
      expect(state.correlationRules).toEqual([]);
    });

    it('has default stages', () => {
      const { stages } = usePerformanceTestingStore.getState();
      expect(stages).toHaveLength(2);
      expect(stages[0]).toEqual({ duration: 30, target: 10 });
      expect(stages[1]).toEqual({ duration: 30, target: 10 });
    });

    it('has default thresholds', () => {
      const { thresholds } = usePerformanceTestingStore.getState();
      expect(thresholds).toHaveLength(4);
      expect(thresholds.map((t) => t.id)).toEqual([
        'th-p95',
        'th-p99',
        'th-error-rate',
        'th-rps',
      ]);
    });

    it('has zero metrics initially', () => {
      const { metrics } = usePerformanceTestingStore.getState();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.requestsPerSecond).toBe(0);
    });
  });

  // ===========================================================================
  // Scenario Step Actions
  // ===========================================================================
  describe('Scenario Step Actions', () => {
    it('addScenarioStep adds a step', () => {
      usePerformanceTestingStore.getState().addScenarioStep(makeStep('s1'));
      const { scenarioSteps } = usePerformanceTestingStore.getState();
      expect(scenarioSteps).toHaveLength(1);
      expect(scenarioSteps[0].id).toBe('s1');
    });

    it('removeScenarioStep removes by id', () => {
      const store = usePerformanceTestingStore.getState();
      store.addScenarioStep(makeStep('s1'));
      store.addScenarioStep(makeStep('s2'));
      store.addScenarioStep(makeStep('s3'));
      usePerformanceTestingStore.getState().removeScenarioStep('s2');

      const { scenarioSteps } = usePerformanceTestingStore.getState();
      expect(scenarioSteps).toHaveLength(2);
      expect(scenarioSteps.map((s) => s.id)).toEqual(['s1', 's3']);
    });

    it('removeScenarioStep does nothing for non-existent id', () => {
      usePerformanceTestingStore.getState().addScenarioStep(makeStep('s1'));
      usePerformanceTestingStore.getState().removeScenarioStep('does-not-exist');
      expect(usePerformanceTestingStore.getState().scenarioSteps).toHaveLength(1);
    });

    it('updateScenarioStep updates fields', () => {
      usePerformanceTestingStore.getState().addScenarioStep(makeStep('s1'));
      usePerformanceTestingStore.getState().updateScenarioStep('s1', { name: 'Updated', method: 'POST' });

      const step = usePerformanceTestingStore.getState().scenarioSteps[0];
      expect(step.name).toBe('Updated');
      expect(step.method).toBe('POST');
      expect(step.url).toBe('https://api.example.com/s1');
    });

    it('updateScenarioStep does nothing for non-existent id', () => {
      usePerformanceTestingStore.getState().addScenarioStep(makeStep('s1'));
      usePerformanceTestingStore.getState().updateScenarioStep('nope', { name: 'should-not-apply' });
      expect(usePerformanceTestingStore.getState().scenarioSteps[0].name).toBe('Step s1');
    });

    it('reorderScenarioSteps moves step from one position to another', () => {
      const store = usePerformanceTestingStore.getState();
      store.addScenarioStep(makeStep('a'));
      store.addScenarioStep(makeStep('b'));
      store.addScenarioStep(makeStep('c'));

      usePerformanceTestingStore.getState().reorderScenarioSteps(0, 2);
      const ids = usePerformanceTestingStore.getState().scenarioSteps.map((s) => s.id);
      expect(ids).toEqual(['b', 'c', 'a']);
    });

    it('setScenarioSteps replaces all steps', () => {
      usePerformanceTestingStore.getState().addScenarioStep(makeStep('old'));
      usePerformanceTestingStore.getState().setScenarioSteps([makeStep('new1'), makeStep('new2')]);

      const ids = usePerformanceTestingStore.getState().scenarioSteps.map((s) => s.id);
      expect(ids).toEqual(['new1', 'new2']);
    });

    it('setScenarioName sets the name', () => {
      usePerformanceTestingStore.getState().setScenarioName('API Load Test');
      expect(usePerformanceTestingStore.getState().scenarioName).toBe('API Load Test');
    });
  });

  // ===========================================================================
  // Config Actions
  // ===========================================================================
  describe('Config Actions', () => {
    it('setTargetUrl updates URL', () => {
      usePerformanceTestingStore.getState().setTargetUrl('https://example.com');
      expect(usePerformanceTestingStore.getState().targetUrl).toBe('https://example.com');
    });

    it('setVirtualUsers updates VU count', () => {
      usePerformanceTestingStore.getState().setVirtualUsers(100);
      expect(usePerformanceTestingStore.getState().virtualUsers).toBe(100);
    });

    it('setDuration updates duration', () => {
      usePerformanceTestingStore.getState().setDuration(300);
      expect(usePerformanceTestingStore.getState().duration).toBe(300);
    });

    it('setWorkloadModel updates model type', () => {
      const models: WorkloadModelType[] = [
        'constant_vus', 'ramping_vus', 'per_vu_iterations',
        'shared_iterations', 'constant_arrival_rate', 'ramping_arrival_rate',
      ];
      models.forEach((model) => {
        usePerformanceTestingStore.getState().setWorkloadModel(model);
        expect(usePerformanceTestingStore.getState().workloadModel).toBe(model);
      });
    });

    it('setPattern updates pattern', () => {
      usePerformanceTestingStore.getState().setPattern('spike');
      expect(usePerformanceTestingStore.getState().pattern).toBe('spike');
    });

    it('setThinkTime toggles think time', () => {
      usePerformanceTestingStore.getState().setThinkTime(false);
      expect(usePerformanceTestingStore.getState().thinkTime).toBe(false);
      usePerformanceTestingStore.getState().setThinkTime(true);
      expect(usePerformanceTestingStore.getState().thinkTime).toBe(true);
    });
  });

  // ===========================================================================
  // Stage Actions
  // ===========================================================================
  describe('Stage Actions', () => {
    it('addStage appends a new stage', () => {
      usePerformanceTestingStore.getState().addStage({ duration: 60, target: 50 });
      const { stages } = usePerformanceTestingStore.getState();
      expect(stages).toHaveLength(3);
      expect(stages[2]).toEqual({ duration: 60, target: 50 });
    });

    it('removeStage removes by index', () => {
      usePerformanceTestingStore.getState().removeStage(0);
      expect(usePerformanceTestingStore.getState().stages).toHaveLength(1);
    });

    it('updateStage updates at index', () => {
      usePerformanceTestingStore.getState().updateStage(0, { duration: 120, target: 100 });
      expect(usePerformanceTestingStore.getState().stages[0]).toEqual({ duration: 120, target: 100 });
    });

    it('updateStage ignores out-of-bounds index', () => {
      const before = [...usePerformanceTestingStore.getState().stages];
      usePerformanceTestingStore.getState().updateStage(99, { duration: 999, target: 999 });
      expect(usePerformanceTestingStore.getState().stages).toEqual(before);
    });

    it('setStages replaces all stages', () => {
      const newStages: Stage[] = [
        { duration: 10, target: 5 },
        { duration: 20, target: 50 },
        { duration: 10, target: 0 },
      ];
      usePerformanceTestingStore.getState().setStages(newStages);
      expect(usePerformanceTestingStore.getState().stages).toEqual(newStages);
    });
  });

  // ===========================================================================
  // Threshold Actions
  // ===========================================================================
  describe('Threshold Actions', () => {
    it('addThreshold appends a threshold', () => {
      const th = makeThreshold('custom-1', { metric: 'avg_response', value: 300 });
      usePerformanceTestingStore.getState().addThreshold(th);
      expect(usePerformanceTestingStore.getState().thresholds).toHaveLength(5);
    });

    it('removeThreshold removes by id', () => {
      usePerformanceTestingStore.getState().removeThreshold('th-p95');
      const remaining = usePerformanceTestingStore.getState().thresholds;
      expect(remaining.find((t) => t.id === 'th-p95')).toBeUndefined();
      expect(remaining).toHaveLength(3);
    });

    it('updateThreshold updates fields', () => {
      usePerformanceTestingStore.getState().updateThreshold('th-p95', { value: 1000 });
      const th = usePerformanceTestingStore.getState().thresholds.find((t) => t.id === 'th-p95');
      expect(th?.value).toBe(1000);
      expect(th?.metric).toBe('p95');
    });

    it('setThresholds replaces all thresholds', () => {
      usePerformanceTestingStore.getState().setThresholds([makeThreshold('only')]);
      expect(usePerformanceTestingStore.getState().thresholds).toHaveLength(1);
      expect(usePerformanceTestingStore.getState().thresholds[0].id).toBe('only');
    });
  });

  // ===========================================================================
  // Execution Actions
  // ===========================================================================
  describe('Execution Actions', () => {
    it('setIsRunning toggles running state', () => {
      usePerformanceTestingStore.getState().setIsRunning(true);
      expect(usePerformanceTestingStore.getState().isRunning).toBe(true);
    });

    it('setUseServerRunner toggles server runner', () => {
      usePerformanceTestingStore.getState().setUseServerRunner(true);
      expect(usePerformanceTestingStore.getState().useServerRunner).toBe(true);
    });

    it('setBackendTestId sets and clears id', () => {
      usePerformanceTestingStore.getState().setBackendTestId('test-123');
      expect(usePerformanceTestingStore.getState().backendTestId).toBe('test-123');
      usePerformanceTestingStore.getState().setBackendTestId(null);
      expect(usePerformanceTestingStore.getState().backendTestId).toBeNull();
    });
  });

  // ===========================================================================
  // Metrics Actions
  // ===========================================================================
  describe('Metrics Actions', () => {
    it('updateMetrics replaces metrics', () => {
      usePerformanceTestingStore.getState().updateMetrics(makeMetrics({ totalRequests: 500 }));
      expect(usePerformanceTestingStore.getState().metrics.totalRequests).toBe(500);
    });

    it('addMetricsSnapshot appends to history', () => {
      usePerformanceTestingStore.getState().addMetricsSnapshot(makeMetrics({ activeUsers: 5 }));
      usePerformanceTestingStore.getState().addMetricsSnapshot(makeMetrics({ activeUsers: 10 }));

      const { metricsHistory } = usePerformanceTestingStore.getState();
      expect(metricsHistory).toHaveLength(2);
      expect(metricsHistory[0].activeUsers).toBe(5);
      expect(metricsHistory[1].activeUsers).toBe(10);
    });

    it('resetMetrics clears metrics, history, and threshold results', () => {
      const store = usePerformanceTestingStore.getState();
      store.updateMetrics(makeMetrics({ totalRequests: 100 }));
      store.addMetricsSnapshot(makeMetrics());
      store.setThresholdResults([{
        metric: 'p95', passed: true, actual: 500,
        threshold: makeThreshold('th-p95'),
      }]);

      usePerformanceTestingStore.getState().resetMetrics();

      const state = usePerformanceTestingStore.getState();
      expect(state.metrics.totalRequests).toBe(0);
      expect(state.metricsHistory).toHaveLength(0);
      expect(state.thresholdResults).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Correlation Rule Actions
  // ===========================================================================
  describe('Correlation Rule Actions', () => {
    it('addCorrelationRule adds rule', () => {
      usePerformanceTestingStore.getState().addCorrelationRule(makeRule('r1'));
      expect(usePerformanceTestingStore.getState().correlationRules).toHaveLength(1);
    });

    it('removeCorrelationRule removes by id', () => {
      const store = usePerformanceTestingStore.getState();
      store.addCorrelationRule(makeRule('r1'));
      store.addCorrelationRule(makeRule('r2'));
      usePerformanceTestingStore.getState().removeCorrelationRule('r1');

      const rules = usePerformanceTestingStore.getState().correlationRules;
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r2');
    });

    it('updateCorrelationRule updates fields', () => {
      usePerformanceTestingStore.getState().addCorrelationRule(makeRule('r1'));
      usePerformanceTestingStore.getState().updateCorrelationRule('r1', {
        pattern: '$.new.path', enabled: false,
      });

      const rule = usePerformanceTestingStore.getState().correlationRules[0];
      expect(rule.pattern).toBe('$.new.path');
      expect(rule.enabled).toBe(false);
      expect(rule.name).toBe('Rule r1');
    });

    it('setCorrelationRules replaces all rules', () => {
      usePerformanceTestingStore.getState().addCorrelationRule(makeRule('old'));
      usePerformanceTestingStore.getState().setCorrelationRules([makeRule('new1'), makeRule('new2')]);
      expect(usePerformanceTestingStore.getState().correlationRules).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Protocol Recording
  // ===========================================================================
  describe('Protocol Recording', () => {
    it('setProtocolRecording activates with id', () => {
      usePerformanceTestingStore.getState().setProtocolRecording(true, 'rec-123');
      const state = usePerformanceTestingStore.getState();
      expect(state.isProtocolRecording).toBe(true);
      expect(state.protocolRecordingId).toBe('rec-123');
    });

    it('setProtocolRecording deactivates and clears id', () => {
      usePerformanceTestingStore.getState().setProtocolRecording(true, 'rec-123');
      usePerformanceTestingStore.getState().setProtocolRecording(false);
      const state = usePerformanceTestingStore.getState();
      expect(state.isProtocolRecording).toBe(false);
      expect(state.protocolRecordingId).toBeNull();
    });
  });

  // ===========================================================================
  // History Actions
  // ===========================================================================
  describe('History Actions', () => {
    it('addToHistory prepends entry', () => {
      usePerformanceTestingStore.getState().addToHistory(makeHistoryEntry('h1'));
      usePerformanceTestingStore.getState().addToHistory(makeHistoryEntry('h2'));

      const { testHistory } = usePerformanceTestingStore.getState();
      expect(testHistory).toHaveLength(2);
      expect(testHistory[0].id).toBe('h2');
      expect(testHistory[1].id).toBe('h1');
    });

    it('addToHistory caps at 50 entries', () => {
      const store = usePerformanceTestingStore.getState();
      for (let i = 0; i < 55; i++) {
        store.addToHistory(makeHistoryEntry(`h-${i}`));
      }
      expect(usePerformanceTestingStore.getState().testHistory).toHaveLength(50);
    });

    it('removeFromHistory removes by id', () => {
      const store = usePerformanceTestingStore.getState();
      store.addToHistory(makeHistoryEntry('h1'));
      store.addToHistory(makeHistoryEntry('h2'));
      usePerformanceTestingStore.getState().removeFromHistory('h1');

      const { testHistory } = usePerformanceTestingStore.getState();
      expect(testHistory).toHaveLength(1);
      expect(testHistory[0].id).toBe('h2');
    });

    it('clearHistory removes all entries', () => {
      const store = usePerformanceTestingStore.getState();
      store.addToHistory(makeHistoryEntry('h1'));
      store.addToHistory(makeHistoryEntry('h2'));
      usePerformanceTestingStore.getState().clearHistory();
      expect(usePerformanceTestingStore.getState().testHistory).toHaveLength(0);
    });
  });

  // ===========================================================================
  // UI Actions
  // ===========================================================================
  describe('UI Actions', () => {
    it('setActiveTab changes tab', () => {
      usePerformanceTestingStore.getState().setActiveTab('configure');
      expect(usePerformanceTestingStore.getState().activeTab).toBe('configure');
    });
  });

  // ===========================================================================
  // Reset Actions
  // ===========================================================================
  describe('Reset Actions', () => {
    it('resetConfig resets config but keeps history', () => {
      const store = usePerformanceTestingStore.getState();
      store.setTargetUrl('https://example.com');
      store.setVirtualUsers(500);
      store.setWorkloadModel('ramping_vus');
      store.addScenarioStep(makeStep('s1'));
      store.addCorrelationRule(makeRule('r1'));
      store.addToHistory(makeHistoryEntry('h1'));

      usePerformanceTestingStore.getState().resetConfig();

      const state = usePerformanceTestingStore.getState();
      expect(state.targetUrl).toBe('');
      expect(state.virtualUsers).toBe(10);
      expect(state.workloadModel).toBe('constant_vus');
      expect(state.scenarioSteps).toEqual([]);
      expect(state.correlationRules).toEqual([]);
      // History preserved
      expect(state.testHistory).toHaveLength(1);
    });
  });
});
