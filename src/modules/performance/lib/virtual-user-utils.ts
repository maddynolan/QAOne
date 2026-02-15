/**
 * Pure utility functions for VirtualUserGenerator page.
 * These functions have no React dependencies and no side effects.
 */

import type { TestStep, FlowstralSession, LoadTestMetrics } from '../types/virtual-user-types';

/**
 * Format seconds to MM:SS display string.
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bytes to human-readable size string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Convert Flowstral/Recorder session to test steps.
 * Handles both formats: nodes (flowstral) and actions (recorder).
 */
export function convertFlowstralToSteps(session: FlowstralSession): TestStep[] {
  const steps: TestStep[] = [];

  // Add initial navigation
  if (session.initial_url) {
    steps.push({
      id: `step_nav_${Date.now()}`,
      type: 'navigate',
      action: 'Navigate to URL',
      target: session.initial_url
    });
  }

  // Get actions array - support both formats
  const actions = (session as any).actions || session.nodes || [];

  // Convert actions/nodes to steps
  actions.forEach((item: any, index: number) => {
    // Handle direct action format (from recorder extension)
    const actionType = item.type || item.data?.actionType || item.data?.type || 'click';
    const selector = item.selector?.playwright || item.selector?.selector ||
                     item.selector || item.data?.selector || item.data?.target;
    const description = item.description || item.data?.label || `Action ${index + 1}`;
    const value = item.value || item.data?.value || item.data?.text || '';

    // Skip navigate actions (already handled by initial_url)
    if (actionType === 'navigate' && index === 0) {
      return;
    }

    let step: TestStep = {
      id: `step_${index}_${Date.now()}`,
      type: 'click',
      action: description,
      target: selector
    };

    if (actionType === 'click' || actionType === 'tap') {
      step.type = 'click';
    } else if (actionType === 'type' || actionType === 'input' || actionType === 'fill') {
      step.type = 'type';
      step.value = value;
    } else if (actionType === 'navigate' || actionType === 'goto') {
      step.type = 'navigate';
      step.target = item.url || item.data?.url || selector;
    } else if (actionType === 'wait') {
      step.type = 'wait';
      step.waitTime = item.duration || item.data?.duration || 1000;
    } else if (actionType === 'assert' || actionType === 'verify') {
      step.type = 'assert';
      step.value = item.expected || item.data?.expected || value;
    } else if (actionType === 'select') {
      step.type = 'click'; // Treat select as click for load testing
      step.value = value;
    } else if (actionType === 'check' || actionType === 'uncheck') {
      step.type = 'click';
    }

    // Only add if we have a valid target
    if (step.target || step.type === 'wait' || step.type === 'navigate') {
      steps.push(step);
    }
  });

  return steps;
}

/**
 * Calculate PASS/FAIL verdict from load test metrics.
 */
export function getVerdict(metrics: LoadTestMetrics) {
  // Default thresholds (same as backend)
  const thresholds = [
    { metric: 'p95', name: 'P95 Response Time', operator: '<', value: 800, critical: false },
    { metric: 'p99', name: 'P99 Response Time', operator: '<', value: 2000, critical: false },
    { metric: 'errorRate', name: 'Error Rate', operator: '<', value: 0.01, critical: true },
    { metric: 'rps', name: 'Throughput', operator: '>', value: 10, critical: false }
  ];

  const getMetricValue = (metric: string): number => {
    switch (metric) {
      case 'p95': return metrics.p95ResponseTime;
      case 'p99': return metrics.p99ResponseTime;
      case 'errorRate': return metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;
      case 'rps': return metrics.requestsPerSecond;
      default: return 0;
    }
  };

  const evaluate = (actual: number, operator: string, expected: number): boolean => {
    switch (operator) {
      case '<': return actual < expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '>=': return actual >= expected;
      case '==': return Math.abs(actual - expected) < 0.001;
      default: return false;
    }
  };

  const results = thresholds.map(t => {
    const actual = getMetricValue(t.metric);
    const passed = evaluate(actual, t.operator, t.value);
    return { ...t, actual, passed };
  });

  const passedCount = results.filter(r => r.passed).length;
  const criticalFailures = results.filter(r => !r.passed && r.critical);

  let verdict = 'PENDING';
  let reason = '';

  if (metrics.totalRequests === 0) {
    verdict = 'PENDING';
    reason = 'No test data yet';
  } else if (criticalFailures.length > 0) {
    verdict = 'FAIL';
    reason = `Critical: ${criticalFailures.map(f => f.name).join(', ')} failed`;
  } else if (passedCount === thresholds.length) {
    verdict = 'PASS';
    reason = `All ${thresholds.length} thresholds passed`;
  } else {
    verdict = 'FAIL';
    reason = `${thresholds.length - passedCount} of ${thresholds.length} thresholds failed`;
  }

  return {
    verdict,
    reason,
    passed: passedCount,
    total: thresholds.length,
    details: results.map(r => ({
      name: r.name,
      actual: r.actual,
      expected: r.value,
      operator: r.operator,
      passed: r.passed,
      critical: r.critical
    }))
  };
}
