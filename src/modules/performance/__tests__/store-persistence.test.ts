/**
 * Unit Tests — Store Persistence Configuration
 * ================================================
 * Validates that the Zustand persist middleware correctly
 * partializes state (only persists intended fields, excludes
 * runtime-only state like isRunning, metrics, etc.)
 */

import { usePerformanceTestingStore } from '../store/performanceTestingStore';

// Reset between tests using setState (not resetAll which uses replace mode)
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
    workloadModel: 'constant_vus',
    stages: [{ duration: 30, target: 10 }, { duration: 30, target: 10 }],
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
    metricsHistory: [],
    thresholdResults: [],
    correlationRules: [],
    isProtocolRecording: false,
    protocolRecordingId: null,
    testHistory: [],
    activeTab: 'quickstart',
    activeDraftId: null,
  }, false);
};

describe('Store Persistence Partialize', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * The store's partialize function should include these fields:
   * scenarioSteps, scenarioName, targetUrl, virtualUsers, duration,
   * rampUpTime, pattern, persona, thinkTime, iterations, workloadModel,
   * stages, thresholds, correlationRules, testHistory, useServerRunner, activeTab
   *
   * And should EXCLUDE runtime state:
   * isRunning, isPaused, elapsedTime, backendTestId, backendScenarioId,
   * metrics, metricsHistory, thresholdResults, isProtocolRecording,
   * protocolRecordingId, activeDraftId
   */

  it('store has persist name "flowstral-perf-store"', () => {
    // The persist middleware uses this name for localStorage key
    // We verify by checking the store's persist API
    const persistApi = (usePerformanceTestingStore as any).persist;
    expect(persistApi).toBeDefined();
    expect(typeof persistApi.getOptions).toBe('function');
    const options = persistApi.getOptions();
    expect(options.name).toBe('flowstral-perf-store');
  });

  it('persist partialize includes config fields', () => {
    const persistApi = (usePerformanceTestingStore as any).persist;
    const options = persistApi.getOptions();
    const partialize = options.partialize;

    // Modify state first
    const store = usePerformanceTestingStore.getState();
    store.setTargetUrl('https://test.com');
    store.setVirtualUsers(100);
    store.setWorkloadModel('ramping_vus');
    store.setScenarioName('Test Scenario');

    const state = usePerformanceTestingStore.getState();
    const persisted = partialize(state);

    // These should be in persisted state
    expect(persisted).toHaveProperty('targetUrl', 'https://test.com');
    expect(persisted).toHaveProperty('virtualUsers', 100);
    expect(persisted).toHaveProperty('workloadModel', 'ramping_vus');
    expect(persisted).toHaveProperty('scenarioName', 'Test Scenario');
    expect(persisted).toHaveProperty('scenarioSteps');
    expect(persisted).toHaveProperty('duration');
    expect(persisted).toHaveProperty('rampUpTime');
    expect(persisted).toHaveProperty('pattern');
    expect(persisted).toHaveProperty('persona');
    expect(persisted).toHaveProperty('thinkTime');
    expect(persisted).toHaveProperty('iterations');
    expect(persisted).toHaveProperty('stages');
    expect(persisted).toHaveProperty('thresholds');
    expect(persisted).toHaveProperty('correlationRules');
    expect(persisted).toHaveProperty('testHistory');
    expect(persisted).toHaveProperty('useServerRunner');
    expect(persisted).toHaveProperty('activeTab');
  });

  it('persist partialize excludes runtime state', () => {
    const persistApi = (usePerformanceTestingStore as any).persist;
    const options = persistApi.getOptions();
    const partialize = options.partialize;

    // Set some runtime state
    const store = usePerformanceTestingStore.getState();
    store.setIsRunning(true);
    store.setElapsedTime(42);
    store.setBackendTestId('test-123');
    store.updateMetrics({
      totalRequests: 500,
      successfulRequests: 490,
      failedRequests: 10,
      avgResponseTime: 200,
      minResponseTime: 50,
      maxResponseTime: 1000,
      p50ResponseTime: 150,
      p90ResponseTime: 350,
      p95ResponseTime: 500,
      p99ResponseTime: 800,
      requestsPerSecond: 50,
      activeUsers: 10,
      errorsPerSecond: 1,
      bytesReceived: 1024000,
      bytesSent: 512000,
    });
    store.setProtocolRecording(true, 'rec-1');
    store.setActiveDraftId('draft-1');

    const state = usePerformanceTestingStore.getState();
    const persisted = partialize(state);

    // These should NOT be persisted
    expect(persisted).not.toHaveProperty('isRunning');
    expect(persisted).not.toHaveProperty('isPaused');
    expect(persisted).not.toHaveProperty('elapsedTime');
    expect(persisted).not.toHaveProperty('backendTestId');
    expect(persisted).not.toHaveProperty('backendScenarioId');
    expect(persisted).not.toHaveProperty('metrics');
    expect(persisted).not.toHaveProperty('metricsHistory');
    expect(persisted).not.toHaveProperty('thresholdResults');
    expect(persisted).not.toHaveProperty('isProtocolRecording');
    expect(persisted).not.toHaveProperty('protocolRecordingId');
    expect(persisted).not.toHaveProperty('activeDraftId');
  });
});
