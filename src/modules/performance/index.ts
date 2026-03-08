/**
 * @module performance
 *
 * Load testing, stress testing, and performance analysis.
 *
 * Features:
 * - Virtual user simulation with configurable behavior
 * - 6 workload models (constant_vus, ramping_vus, per_vu_iterations, shared_iterations, constant_arrival_rate, ramping_arrival_rate)
 * - 8 load patterns (constant, ramp, spike, stress, soak, breakpoint, wave, custom)
 * - No-code scenario builder with HTTP requests, think times, loops
 * - Correlation engine (JSONPath, Regex, Boundary, Header, Cookie, XPath)
 * - SLA thresholds with pass/fail evaluation
 * - Protocol recording (HTTP traffic capture)
 * - Script generation (QAAI, k6, JMeter formats)
 * - Go runner integration (up to 10,000 VUs)
 * - Response time percentiles, throughput, error rates
 * - HAR import/export
 * - Persistent test history with comparison
 */

// Pages
export { default as VirtualUserGenerator } from './pages/VirtualUserGenerator';

// Store
export { usePerformanceTestingStore } from './store/performanceTestingStore';
