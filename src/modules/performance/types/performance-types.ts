/**
 * Types for the Performance testing page.
 */

export interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  activeUsers: number;
  elapsedTime: number;
}

export interface LiveTestData {
  testId: string;
  status: "running" | "completed" | "stopped" | "failed";
  metrics: TestMetrics;
  responseTimeHistory: number[];
  rpsHistory: number[];
  errorHistory: number[];
  cpuHistory: number[];
  memoryHistory: number[];
}

export interface ServerCpuMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_sent_mb: number;
  network_recv_mb: number;
  load_average_1m?: number;
  process_count?: number;
  top_processes?: Array<{user: string; pid: string; cpu_percent: number; command: string}>;
}

export interface ProtocolRecording {
  recordingId: string;
  isActive: boolean;
  totalRequests: number;
  totalBytes: number;
}
