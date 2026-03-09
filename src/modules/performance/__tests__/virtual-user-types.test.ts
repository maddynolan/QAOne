/**
 * Unit Tests — Virtual User Type Definitions
 * =============================================
 * Validates that type structures match expected shapes.
 * While TypeScript enforces types at compile time, these tests
 * ensure runtime object shapes are correct for API serialization.
 */

import type {
  VirtualUser,
  TestStep,
  FlowstralSession,
  LoadTestConfig,
  LoadTestMetrics,
  FailedRequest,
} from '../types/virtual-user-types';

describe('Virtual User Types — Runtime Shape Validation', () => {
  describe('VirtualUser', () => {
    it('valid object matches interface shape', () => {
      const user: VirtualUser = {
        id: 'vu-1',
        name: 'User 1',
        persona: 'normal',
        status: 'idle',
        currentStep: 0,
        totalSteps: 5,
        metrics: {
          requestsCompleted: 0,
          errorsCount: 0,
          avgResponseTime: 0,
        },
      };

      expect(user.id).toBe('vu-1');
      expect(['idle', 'running', 'completed', 'error']).toContain(user.status);
      expect(user.metrics).toBeDefined();
      expect(typeof user.metrics.requestsCompleted).toBe('number');
    });
  });

  describe('TestStep', () => {
    it('supports all step types', () => {
      const types: TestStep['type'][] = ['navigate', 'click', 'type', 'wait', 'assert', 'api'];
      types.forEach((type) => {
        const step: TestStep = { id: `step-${type}`, type };
        expect(step.type).toBe(type);
      });
    });

    it('api step has optional method and url', () => {
      const apiStep: TestStep = {
        id: 'api-1',
        type: 'api',
        url: 'https://api.example.com',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"key": "value"}',
        enabled: true,
      };

      expect(apiStep.url).toBeDefined();
      expect(apiStep.method).toBe('POST');
    });
  });

  describe('LoadTestConfig', () => {
    it('has all required fields', () => {
      const config: LoadTestConfig = {
        name: 'API Load Test',
        targetUrl: 'https://api.example.com',
        virtualUsers: 50,
        duration: 120,
        rampUpTime: 15,
        pattern: 'constant',
        persona: 'normal',
        steps: [],
        thinkTime: true,
        iterations: 1,
      };

      expect(config.name).toBeTruthy();
      expect(config.virtualUsers).toBeGreaterThan(0);
      expect(config.duration).toBeGreaterThan(0);
      expect(typeof config.thinkTime).toBe('boolean');
    });
  });

  describe('LoadTestMetrics', () => {
    it('has all 15 metric fields', () => {
      const metrics: LoadTestMetrics = {
        totalRequests: 1000,
        successfulRequests: 950,
        failedRequests: 50,
        avgResponseTime: 200,
        minResponseTime: 10,
        maxResponseTime: 5000,
        p50ResponseTime: 150,
        p90ResponseTime: 400,
        p95ResponseTime: 600,
        p99ResponseTime: 1200,
        requestsPerSecond: 100,
        activeUsers: 50,
        errorsPerSecond: 5,
        bytesReceived: 10240000,
        bytesSent: 5120000,
      };

      const keys = Object.keys(metrics);
      expect(keys).toHaveLength(15);
      keys.forEach((key) => {
        expect(typeof (metrics as any)[key]).toBe('number');
      });
    });

    it('percentile ordering is logical', () => {
      const metrics: LoadTestMetrics = {
        totalRequests: 1000,
        successfulRequests: 950,
        failedRequests: 50,
        avgResponseTime: 200,
        minResponseTime: 10,
        maxResponseTime: 5000,
        p50ResponseTime: 150,
        p90ResponseTime: 400,
        p95ResponseTime: 600,
        p99ResponseTime: 1200,
        requestsPerSecond: 100,
        activeUsers: 50,
        errorsPerSecond: 5,
        bytesReceived: 10240000,
        bytesSent: 5120000,
      };

      expect(metrics.p50ResponseTime).toBeLessThanOrEqual(metrics.p90ResponseTime);
      expect(metrics.p90ResponseTime).toBeLessThanOrEqual(metrics.p95ResponseTime);
      expect(metrics.p95ResponseTime).toBeLessThanOrEqual(metrics.p99ResponseTime);
      expect(metrics.minResponseTime).toBeLessThanOrEqual(metrics.avgResponseTime);
      expect(metrics.avgResponseTime).toBeLessThanOrEqual(metrics.maxResponseTime);
    });
  });

  describe('FailedRequest', () => {
    it('captures failure details', () => {
      const failure: FailedRequest = {
        userId: 'vu-3',
        userName: 'User 3',
        stepIndex: 2,
        stepName: 'GET /api/products',
        timestamp: '2026-03-08T12:00:00Z',
        responseTime: 5500,
        error: 'Connection timeout',
      };

      expect(failure.userId).toBeTruthy();
      expect(failure.stepIndex).toBeGreaterThanOrEqual(0);
      expect(failure.responseTime).toBeGreaterThan(0);
      expect(failure.error).toBeDefined();
    });
  });
});
