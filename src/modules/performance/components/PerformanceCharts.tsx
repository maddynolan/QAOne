/**
 * PerformanceCharts — Rich Recharts-based performance visualizations
 *
 * Replaces the primitive CSS bar charts with proper time-series line charts,
 * area charts, response time histograms, and error breakdown pie charts.
 *
 * Used by Performance.tsx Live Test tab and Analytics tab.
 */
import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LiveTestData, TestMetrics } from '@/modules/performance/types/performance-types';

// ─── Color palette ───────────────────────────────────────────────────────────
const COLORS = {
  responseTime: '#3b82f6',   // blue-500
  rps: '#22c55e',            // green-500
  errorRate: '#ef4444',      // red-500
  cpu: '#f97316',            // orange-500
  memory: '#a855f7',         // purple-500
  p50: '#06b6d4',            // cyan-500
  p95: '#f59e0b',            // amber-500
  p99: '#ef4444',            // red-500
  activeUsers: '#8b5cf6',    // violet-500
  success: '#22c55e',
  failed: '#ef4444',
};

const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#06b6d4'];

interface PerformanceChartsProps {
  testData: LiveTestData;
  serverMonitoring?: boolean;
}

/**
 * Converts history arrays into time-series data points for Recharts.
 */
function buildTimeSeriesData(testData: LiveTestData) {
  const len = testData.responseTimeHistory.length;
  return Array.from({ length: len }, (_, i) => ({
    time: i + 1,
    responseTime: Math.round(testData.responseTimeHistory[i] || 0),
    rps: Number((testData.rpsHistory[i] || 0).toFixed(1)),
    errorRate: Number((testData.errorHistory[i] || 0).toFixed(2)),
    cpu: Number((testData.cpuHistory[i] || 0).toFixed(1)),
    memory: Number((testData.memoryHistory[i] || 0).toFixed(1)),
  }));
}

/**
 * Build histogram buckets from response time history for distribution chart.
 */
function buildHistogramData(responseTimes: number[]) {
  if (responseTimes.length === 0) return [];
  // Use loop-based min/max to avoid stack overflow with large arrays (>100K elements)
  let max = -Infinity;
  let min = Infinity;
  for (const rt of responseTimes) {
    if (rt > max) max = rt;
    if (rt < min) min = rt;
  }
  const range = max - min || 1;
  const bucketCount = Math.min(20, Math.max(5, Math.ceil(responseTimes.length / 3)));
  const bucketSize = range / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    range: `${Math.round(min + i * bucketSize)}-${Math.round(min + (i + 1) * bucketSize)}`,
    rangeStart: min + i * bucketSize,
    count: 0,
  }));
  for (const rt of responseTimes) {
    const idx = Math.min(Math.floor((rt - min) / bucketSize), bucketCount - 1);
    buckets[idx].count++;
  }
  return buckets;
}

// ─── Chart Components ────────────────────────────────────────────────────────

/** Response Time + RPS overlay chart (dual Y-axis) */
export const ResponseTimeRpsChart: React.FC<{ data: ReturnType<typeof buildTimeSeriesData> }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey="time" label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5 }} tick={{ fontSize: 11 }} />
      <YAxis yAxisId="left" label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 11 }} />
      <YAxis yAxisId="right" orientation="right" label={{ value: 'Req/s', angle: 90, position: 'insideRight' }} tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Area yAxisId="left" type="monotone" dataKey="responseTime" stroke={COLORS.responseTime} fill={COLORS.responseTime} fillOpacity={0.15} name="Avg Response Time (ms)" />
      <Line yAxisId="right" type="monotone" dataKey="rps" stroke={COLORS.rps} strokeWidth={2} dot={false} name="Requests/sec" />
    </ComposedChart>
  </ResponsiveContainer>
);

/** Error Rate over time */
export const ErrorRateChart: React.FC<{ data: ReturnType<typeof buildTimeSeriesData> }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
      <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Area type="monotone" dataKey="errorRate" stroke={COLORS.errorRate} fill={COLORS.errorRate} fillOpacity={0.2} name="Error Rate (%)" />
      <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '5% threshold', fontSize: 10, fill: '#f59e0b' }} />
    </AreaChart>
  </ResponsiveContainer>
);

/** Active Users over time */
export const ActiveUsersChart: React.FC<{ data: { time: number; activeUsers: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Area type="stepAfter" dataKey="activeUsers" stroke={COLORS.activeUsers} fill={COLORS.activeUsers} fillOpacity={0.15} name="Active Users" />
    </AreaChart>
  </ResponsiveContainer>
);

/** Server CPU + Memory overlay */
export const ServerResourceChart: React.FC<{ data: ReturnType<typeof buildTimeSeriesData> }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <ReferenceLine y={80} stroke={COLORS.cpu} strokeDasharray="5 5" label={{ value: 'CPU 80%', fontSize: 10, fill: COLORS.cpu }} />
      <ReferenceLine y={85} stroke={COLORS.memory} strokeDasharray="5 5" label={{ value: 'MEM 85%', fontSize: 10, fill: COLORS.memory }} />
      <Line type="monotone" dataKey="cpu" stroke={COLORS.cpu} strokeWidth={2} dot={false} name="CPU %" />
      <Line type="monotone" dataKey="memory" stroke={COLORS.memory} strokeWidth={2} dot={false} name="Memory %" />
    </LineChart>
  </ResponsiveContainer>
);

/** Response Time Distribution Histogram with percentile markers */
export const ResponseTimeHistogram: React.FC<{ responseTimes: number[]; metrics: TestMetrics }> = ({ responseTimes, metrics }) => {
  const histData = useMemo(() => buildHistogramData(responseTimes), [responseTimes]);
  if (histData.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={histData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="range" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 9 }} height={60} />
        <YAxis tick={{ fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="count" fill={COLORS.responseTime} radius={[4, 4, 0, 0]} name="Requests" />
        {metrics.p50ResponseTime > 0 && (
          <ReferenceLine x={histData.findIndex(b => b.rangeStart <= metrics.p50ResponseTime && b.rangeStart + (histData[1]?.rangeStart - histData[0]?.rangeStart || 1) > metrics.p50ResponseTime)}
            stroke={COLORS.p50} strokeWidth={0} /* use label only */
            label={{ value: `P50: ${Math.round(metrics.p50ResponseTime)}ms`, fontSize: 10, fill: COLORS.p50, position: 'top' }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

/** Success vs Failed pie chart */
export const RequestOutcomePie: React.FC<{ metrics: TestMetrics }> = ({ metrics }) => {
  const data = useMemo(() => [
    { name: 'Success', value: metrics.successfulRequests, color: COLORS.success },
    { name: 'Failed', value: metrics.failedRequests, color: COLORS.failed },
  ].filter(d => d.value > 0), [metrics.successfulRequests, metrics.failedRequests]);

  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
          dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
          labelLine={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ─── Main Composite Component ────────────────────────────────────────────────

/**
 * PerformanceCharts — renders all live test charts.
 * Replaces the old CSS bar divs in Performance.tsx Live Test tab.
 */
export default function PerformanceCharts({ testData, serverMonitoring }: PerformanceChartsProps) {
  const timeSeriesData = useMemo(() => buildTimeSeriesData(testData), [
    testData.responseTimeHistory, testData.rpsHistory, testData.errorHistory,
    testData.cpuHistory, testData.memoryHistory,
  ]);

  // Build active user data from metrics history (approximate from elapsed time increments)
  const activeUsersData = useMemo(() => {
    return timeSeriesData.map((d, i) => ({
      time: d.time,
      activeUsers: testData.metrics.activeUsers > 0
        ? Math.min(testData.metrics.activeUsers, Math.round((i / Math.max(timeSeriesData.length - 1, 1)) * testData.metrics.activeUsers))
        : 0,
    }));
  }, [timeSeriesData, testData.metrics.activeUsers]);

  return (
    <div className="space-y-4">
      {/* Response Time + RPS overlay */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Response Time & Throughput</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseTimeRpsChart data={timeSeriesData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Error Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Error Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorRateChart data={timeSeriesData} />
          </CardContent>
        </Card>

        {/* Request Outcome Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Request Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestOutcomePie metrics={testData.metrics} />
          </CardContent>
        </Card>
      </div>

      {/* Response Time Histogram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Response Time Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseTimeHistogram responseTimes={testData.responseTimeHistory} metrics={testData.metrics} />
          <div className="flex justify-center gap-8 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: COLORS.p50 }} />
              P50: {Math.round(testData.metrics.p50ResponseTime)}ms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: COLORS.p95 }} />
              P95: {Math.round(testData.metrics.p95ResponseTime)}ms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ background: COLORS.p99 }} />
              P99: {Math.round(testData.metrics.p99ResponseTime)}ms
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Active Virtual Users</CardTitle>
        </CardHeader>
        <CardContent>
          <ActiveUsersChart data={activeUsersData} />
        </CardContent>
      </Card>

      {/* Server Resources (CPU + Memory) — only shown when monitoring is active */}
      {serverMonitoring && (testData.cpuHistory.some(v => v > 0) || testData.memoryHistory.some(v => v > 0)) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Server Resources (CPU & Memory)</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerResourceChart data={timeSeriesData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
