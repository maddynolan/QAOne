/**
 * @module performance
 *
 * Load testing, stress testing, and performance analysis.
 *
 * Features:
 * - Virtual user simulation with configurable behavior
 * - 8 load patterns (constant, ramp, spike, stress, soak, breakpoint, wave, custom)
 * - Protocol recording (HTTP traffic capture)
 * - Script generation (QAAI, k6, JMeter formats)
 * - Response time percentiles, throughput, error rates
 * - HAR import/export
 */

// Pages
export { default as VirtualUserGenerator } from './pages/VirtualUserGenerator';
export { default as Performance } from './pages/Performance';
