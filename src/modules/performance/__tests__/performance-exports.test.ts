/**
 * Unit Tests — Performance Module Exports
 * =========================================
 * Validates that barrel exports are wired correctly.
 *
 * NOTE: We only test non-React exports (store, constants, types)
 * directly. React component barrel exports are validated by
 * checking the index.ts file structure rather than importing
 * (which would require mocking the entire UI framework).
 */

import { usePerformanceTestingStore } from '../store/performanceTestingStore';

describe('Performance Module Exports', () => {
  describe('module index.ts structure', () => {
    it('index file is resolvable', () => {
      const resolvedPath = require.resolve('../index');
      expect(resolvedPath).toBeTruthy();
      expect(resolvedPath).toContain('performance');
    });

    it('store can be imported directly (bypassing React page)', () => {
      // The module index also exports VirtualUserGenerator (React page),
      // so we import the store directly from its source instead.
      const store = require('../store/performanceTestingStore');
      expect(store.usePerformanceTestingStore).toBeDefined();
      expect(typeof store.usePerformanceTestingStore).toBe('function');
    });
  });

  describe('store exports', () => {
    it('usePerformanceTestingStore is a valid Zustand store', () => {
      expect(typeof usePerformanceTestingStore).toBe('function');
      expect(typeof usePerformanceTestingStore.getState).toBe('function');
      expect(typeof usePerformanceTestingStore.setState).toBe('function');
      expect(typeof usePerformanceTestingStore.subscribe).toBe('function');
    });

    it('store has persist API', () => {
      const persistApi = (usePerformanceTestingStore as any).persist;
      expect(persistApi).toBeDefined();
      expect(typeof persistApi.getOptions).toBe('function');
    });

    it('store state has all expected action methods', () => {
      const state = usePerformanceTestingStore.getState();
      // Key actions from the store — not exhaustive, but covers all categories
      const expectedActions = [
        // Scenario steps
        'addScenarioStep', 'removeScenarioStep', 'updateScenarioStep',
        'reorderScenarioSteps', 'setScenarioSteps',
        // Config
        'setScenarioName', 'setTargetUrl', 'setVirtualUsers',
        'setDuration', 'setRampUpTime', 'setPattern',
        'setPersona', 'setThinkTime', 'setIterations', 'setWorkloadModel',
        // Stages & Thresholds
        'addStage', 'removeStage', 'updateStage', 'setStages',
        'addThreshold', 'removeThreshold', 'updateThreshold', 'setThresholds',
        // Execution
        'setIsRunning', 'setIsPaused', 'setElapsedTime',
        'setBackendTestId', 'setBackendScenarioId', 'setUseServerRunner',
        // Metrics
        'updateMetrics', 'addMetricsSnapshot',
        'resetMetrics', 'setThresholdResults',
        // Correlations
        'addCorrelationRule', 'removeCorrelationRule', 'updateCorrelationRule',
        'setCorrelationRules',
        // Protocol & History
        'setProtocolRecording', 'addToHistory', 'removeFromHistory',
        'clearHistory',
        // UI & Reset
        'setActiveTab', 'setActiveDraftId', 'resetAll', 'resetConfig',
      ];
      for (const action of expectedActions) {
        expect(state).toHaveProperty(action);
        expect(typeof (state as any)[action]).toBe('function');
      }
    });
  });

  describe('constants module', () => {
    it('exports QUICK_START_SCENARIOS', () => {
      const mod = require('../constants/performance-constants');
      expect(mod.QUICK_START_SCENARIOS).toBeDefined();
      expect(Array.isArray(mod.QUICK_START_SCENARIOS)).toBe(true);
      expect(mod.QUICK_START_SCENARIOS.length).toBeGreaterThan(0);
    });

    it('exports FLOWSTRAL_SCENARIOS', () => {
      const mod = require('../constants/performance-constants');
      expect(mod.FLOWSTRAL_SCENARIOS).toBeDefined();
      expect(Array.isArray(mod.FLOWSTRAL_SCENARIOS)).toBe(true);
      expect(mod.FLOWSTRAL_SCENARIOS.length).toBeGreaterThan(0);
    });
  });

  describe('components barrel structure', () => {
    // We validate the components/index.ts file exists and has the right
    // shape by reading it as a module path — but we can't actually import
    // React components without mocking the UI framework.
    it('components index file is resolvable', () => {
      // If this doesn't throw, the file exists and TypeScript can find it
      const resolvedPath = require.resolve('../components/index');
      expect(resolvedPath).toBeTruthy();
      expect(resolvedPath).toContain('components');
    });
  });
});
