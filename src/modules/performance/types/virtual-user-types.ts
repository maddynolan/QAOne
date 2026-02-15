/**
 * Type definitions for VirtualUserGenerator page.
 */

export interface VirtualUser {
  id: string;
  name: string;
  persona: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  metrics: {
    requestsCompleted: number;
    errorsCount: number;
    avgResponseTime: number;
  };
}

export interface TestStep {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'wait' | 'assert' | 'api';
  action?: string;
  name?: string;
  target?: string;
  value?: string;
  waitTime?: number;
  // API/Protocol testing fields
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  enabled?: boolean;
}

export interface FlowstralSession {
  session_id: string;
  name?: string;
  nodes?: any[];
  actions?: any[]; // Recorder extension uses 'actions' instead of 'nodes'
  initial_url?: string;
  created_at?: string;
  is_active?: boolean;
  artifacts?: any;
}

export interface LoadTestConfig {
  name: string;
  targetUrl: string;
  virtualUsers: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  pattern: string;
  persona: string;
  steps: TestStep[];
  thinkTime: boolean;
  iterations: number;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  activeUsers: number;
  errorsPerSecond: number;
  bytesReceived: number;
  bytesSent: number;
}

export interface FailedRequest {
  userId: string;
  userName: string;
  stepIndex: number;
  stepName: string;
  timestamp: string;
  responseTime: number;
  error?: string;
}
