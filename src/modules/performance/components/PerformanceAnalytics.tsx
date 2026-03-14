/**
 * PerformanceAnalytics — Trend analysis, run comparison, script export, report generation
 *
 * Features:
 * 1. TREND ANALYSIS — Recharts line chart of avg RT, P95, error rate, throughput across runs
 * 2. RUN COMPARISON — Side-by-side comparison of 2 selected runs with delta badges
 * 3. SCRIPT EXPORT — Generate k6, JMeter, Artillery, Gatling scripts from config
 * 4. REPORT EXPORT — JSON/HTML report download for any historical run
 * 5. GEOGRAPHIC ZONES — Load zone selector for distributed testing (UI-only, wired to config)
 */
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  TrendingUp, GitCompareArrows, FileCode, Download, Globe, BarChart3,
  ArrowUp, ArrowDown, Minus, CheckCircle, XCircle, MapPin,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryEntry {
  testId: string;
  status: string;
  metrics: {
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
    throughput?: number;
  };
  completedAt?: string;
  config?: { virtualUsers?: number; duration?: number };
  responseTimeHistory?: number[];
  rpsHistory?: number[];
  errorHistory?: number[];
}

interface PerformanceAnalyticsProps {
  testHistory: HistoryEntry[];
  customConfig: {
    baseUrl: string;
    virtualUsers: number;
    duration: number;
    rampUp: number;
    thinkTime: number;
  };
}

// ─── Geographic Load Zones ───────────────────────────────────────────────────

const LOAD_ZONES = [
  { id: 'us-east-1', name: 'US East (Virginia)', flag: '🇺🇸', region: 'Americas' },
  { id: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸', region: 'Americas' },
  { id: 'eu-west-1', name: 'EU West (Ireland)', flag: '🇮🇪', region: 'Europe' },
  { id: 'eu-central-1', name: 'EU Central (Frankfurt)', flag: '🇩🇪', region: 'Europe' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬', region: 'Asia' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵', region: 'Asia' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai)', flag: '🇮🇳', region: 'Asia' },
  { id: 'sa-east-1', name: 'South America (Sao Paulo)', flag: '🇧🇷', region: 'Americas' },
  { id: 'me-south-1', name: 'Middle East (Bahrain)', flag: '🇧🇭', region: 'Middle East' },
  { id: 'af-south-1', name: 'Africa (Cape Town)', flag: '🇿🇦', region: 'Africa' },
];

// ─── Script Templates ────────────────────────────────────────────────────────

function generateK6Script(config: PerformanceAnalyticsProps['customConfig']): string {
  return `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '${config.rampUp}s', target: ${config.virtualUsers} },
    { duration: '${config.duration - config.rampUp}s', target: ${config.virtualUsers} },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get('${config.baseUrl}/api/products');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(res.status !== 200);
  responseTime.add(res.timings.duration);

  sleep(${(config.thinkTime / 1000).toFixed(1)});
}`;
}

function generateJMeterXml(config: PerformanceAnalyticsProps['customConfig']): string {
  let host = 'localhost', port = '80', protocol = 'http', path = '/api/products';
  try {
    const u = new URL(config.baseUrl);
    host = u.hostname;
    port = u.port || (u.protocol === 'https:' ? '443' : '80');
    protocol = u.protocol.replace(':', '');
  } catch { /* use defaults */ }
  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Flowstral Load Test">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments"/>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Load Test">
        <intProp name="ThreadGroup.num_threads">${config.virtualUsers}</intProp>
        <intProp name="ThreadGroup.ramp_time">${config.rampUp}</intProp>
        <intProp name="ThreadGroup.duration">${config.duration}</intProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET ${path}">
          <stringProp name="HTTPSampler.domain">${host}</stringProp>
          <stringProp name="HTTPSampler.port">${port}</stringProp>
          <stringProp name="HTTPSampler.protocol">${protocol}</stringProp>
          <stringProp name="HTTPSampler.path">${path}</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
        </HTTPSamplerProxy>
        <hashTree>
          <ResponseAssertion guiclass="AssertionGui" testclass="ResponseAssertion" testname="Status 200">
            <collectionProp name="Asserion.test_strings">
              <stringProp name="">200</stringProp>
            </collectionProp>
            <intProp name="Assertion.test_type">8</intProp>
            <intProp name="Assertion.test_field">4</intProp>
          </ResponseAssertion>
        </hashTree>
        <ConstantTimer guiclass="ConstantTimerGui" testclass="ConstantTimer" testname="Think Time">
          <stringProp name="ConstantTimer.delay">${config.thinkTime}</stringProp>
        </ConstantTimer>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`;
}

function generateArtilleryYaml(config: PerformanceAnalyticsProps['customConfig']): string {
  return `config:
  target: "${config.baseUrl}"
  phases:
    - duration: ${config.rampUp}
      arrivalRate: 1
      rampTo: ${Math.ceil(config.virtualUsers / 10)}
      name: "Ramp up"
    - duration: ${config.duration - config.rampUp}
      arrivalRate: ${Math.ceil(config.virtualUsers / 10)}
      name: "Sustained load"
  defaults:
    headers:
      Content-Type: "application/json"
  ensure:
    p95: 500
    maxErrorRate: 5

scenarios:
  - name: "Load Test"
    flow:
      - get:
          url: "/api/products"
          expect:
            - statusCode: 200
      - think: ${(config.thinkTime / 1000).toFixed(1)}
      - get:
          url: "/api/categories"
          expect:
            - statusCode: 200`;
}

function generateGatlingScala(config: PerformanceAnalyticsProps['customConfig']): string {
  return `import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class FlowstralLoadTest extends Simulation {

  val httpProtocol = http
    .baseUrl("${config.baseUrl}")
    .acceptHeader("application/json")

  val scn = scenario("Load Test")
    .exec(
      http("GET /api/products")
        .get("/api/products")
        .check(status.is(200))
    )
    .pause(${(config.thinkTime / 1000).toFixed(0)}.seconds)
    .exec(
      http("GET /api/categories")
        .get("/api/categories")
        .check(status.is(200))
    )

  setUp(
    scn.inject(
      rampUsers(${config.virtualUsers}).during(${config.rampUp}.seconds),
      constantUsersPerSec(${Math.ceil(config.virtualUsers / 10)}).during(${config.duration - config.rampUp}.seconds)
    )
  ).protocols(httpProtocol)
   .assertions(
     global.responseTime.percentile(95).lt(500),
     global.successfulRequests.percent.gt(95.0)
   )
}`;
}

// ─── Delta Badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ current, previous, unit, lowerIsBetter = true }: {
  current: number; previous: number; unit: string; lowerIsBetter?: boolean;
}) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const delta = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = delta > 0;
  const isBetter = lowerIsBetter ? !isPositive : isPositive;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  return (
    <Badge variant="outline" className={`text-[10px] ${isBetter ? 'text-green-600 border-green-300' : delta === 0 ? '' : 'text-red-600 border-red-300'}`}>
      <Icon className="w-3 h-3 mr-0.5" />
      {Math.abs(delta).toFixed(1)}%
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PerformanceAnalytics({ testHistory, customConfig }: PerformanceAnalyticsProps) {
  const [analyticsTab, setAnalyticsTab] = useState('trends');
  const [compareRunA, setCompareRunA] = useState<string>('');
  const [compareRunB, setCompareRunB] = useState<string>('');
  const [selectedZones, setSelectedZones] = useState<string[]>(['us-east-1']);
  const [distributedEnabled, setDistributedEnabled] = useState(false);

  // Build trend data from history
  const trendData = useMemo(() => {
    return testHistory
      .filter(t => t.metrics && t.status === 'completed')
      .reverse()
      .map((t, i) => ({
        run: i + 1,
        label: t.testId?.slice(-8) || `Run ${i + 1}`,
        avgRT: Math.round(t.metrics.avgResponseTime || 0),
        p95RT: Math.round(t.metrics.p95ResponseTime || 0),
        p99RT: Math.round(t.metrics.p99ResponseTime || 0),
        rps: Number((t.metrics.requestsPerSecond || 0).toFixed(1)),
        errorRate: Number((t.metrics.errorRate || 0).toFixed(2)),
        totalReqs: t.metrics.totalRequests || 0,
      }));
  }, [testHistory]);

  // Comparison data
  const runA = useMemo(() => testHistory.find(t => t.testId === compareRunA), [testHistory, compareRunA]);
  const runB = useMemo(() => testHistory.find(t => t.testId === compareRunB), [testHistory, compareRunB]);

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    // Delay revocation to ensure download completes before blob is freed
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success(`Downloaded ${filename}`);
  };

  const exportReportJson = (entry: HistoryEntry) => {
    const report = {
      testId: entry.testId,
      status: entry.status,
      completedAt: entry.completedAt,
      config: entry.config || customConfig,
      metrics: entry.metrics,
      summary: {
        totalRequests: entry.metrics.totalRequests,
        successRate: entry.metrics.totalRequests > 0
          ? ((entry.metrics.successfulRequests / entry.metrics.totalRequests) * 100).toFixed(2) + '%'
          : 'N/A',
        avgResponseTime: `${Math.round(entry.metrics.avgResponseTime)}ms`,
        p95ResponseTime: `${Math.round(entry.metrics.p95ResponseTime)}ms`,
        p99ResponseTime: `${Math.round(entry.metrics.p99ResponseTime)}ms`,
        errorRate: `${entry.metrics.errorRate.toFixed(2)}%`,
        throughput: `${entry.metrics.requestsPerSecond.toFixed(1)} req/s`,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perf-report-${entry.testId}.json`;
    a.click();
    // Delay revocation to ensure download completes before blob is freed
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success('JSON report downloaded');
  };

  return (
    <div className="space-y-4">
      <Tabs value={analyticsTab} onValueChange={setAnalyticsTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="trends">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompareArrows className="w-4 h-4 mr-1.5" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="export">
            <FileCode className="w-4 h-4 mr-1.5" />
            Export Script
          </TabsTrigger>
          <TabsTrigger value="reports">
            <Download className="w-4 h-4 mr-1.5" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="zones">
            <Globe className="w-4 h-4 mr-1.5" />
            Load Zones
          </TabsTrigger>
        </TabsList>

        {/* ═══ TRENDS TAB ═══ */}
        <TabsContent value="trends" className="space-y-4">
          {trendData.length >= 2 ? (
            <>
              {/* Response Time Trend */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Response Time Trend</CardTitle>
                  <CardDescription>Average, P95, and P99 response times across runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="avgRT" stroke="#3b82f6" strokeWidth={2} name="Avg RT" />
                      <Line type="monotone" dataKey="p95RT" stroke="#f59e0b" strokeWidth={2} name="P95 RT" />
                      <Line type="monotone" dataKey="p99RT" stroke="#ef4444" strokeWidth={2} name="P99 RT" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Throughput + Error Rate Trend */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Throughput Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="rps" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} name="Req/s" />
                        <Bar dataKey="totalReqs" fill="#3b82f6" fillOpacity={0.3} name="Total Reqs" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Error Rate Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} name="Error Rate %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Not Enough Data</h3>
                <p className="text-muted-foreground">Run at least 2 completed tests to see trend analysis</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ COMPARE TAB ═══ */}
        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Run Comparison</CardTitle>
              <CardDescription>Compare two test runs side-by-side to detect regression</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Run A (Baseline)</Label>
                  <Select value={compareRunA} onValueChange={setCompareRunA}>
                    <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
                    <SelectContent>
                      {testHistory.filter(t => t.metrics).map((t, i) => (
                        <SelectItem key={t.testId || i} value={t.testId || `idx-${i}`}>
                          {t.testId?.slice(-12) || `Run ${i + 1}`} — {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Run B (Current)</Label>
                  <Select value={compareRunB} onValueChange={setCompareRunB}>
                    <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
                    <SelectContent>
                      {testHistory.filter(t => t.metrics).map((t, i) => (
                        <SelectItem key={t.testId || i} value={t.testId || `idx-${i}`}>
                          {t.testId?.slice(-12) || `Run ${i + 1}`} — {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {runA && runB ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium border-b pb-2">
                    <div className="text-left">Metric</div>
                    <div className="col-span-2">Run A (Baseline)</div>
                    <div className="col-span-2">Run B (Current)</div>
                    <div className="col-span-2">Delta</div>
                  </div>
                  {[
                    { label: 'Avg Response Time', key: 'avgResponseTime', unit: 'ms', lower: true },
                    { label: 'P95 Response Time', key: 'p95ResponseTime', unit: 'ms', lower: true },
                    { label: 'P99 Response Time', key: 'p99ResponseTime', unit: 'ms', lower: true },
                    { label: 'Throughput', key: 'requestsPerSecond', unit: 'req/s', lower: false },
                    { label: 'Error Rate', key: 'errorRate', unit: '%', lower: true },
                    { label: 'Total Requests', key: 'totalRequests', unit: '', lower: false },
                  ].map(({ label, key, unit, lower }) => {
                    const valA = (runA.metrics as any)[key] || 0;
                    const valB = (runB.metrics as any)[key] || 0;
                    return (
                      <div key={key} className="grid grid-cols-7 gap-2 text-center text-sm py-1.5 border-b border-muted">
                        <div className="text-left font-medium">{label}</div>
                        <div className="col-span-2">{typeof valA === 'number' ? valA.toFixed(key === 'totalRequests' ? 0 : 1) : valA} {unit}</div>
                        <div className="col-span-2">{typeof valB === 'number' ? valB.toFixed(key === 'totalRequests' ? 0 : 1) : valB} {unit}</div>
                        <div className="col-span-2">
                          <DeltaBadge current={valB} previous={valA} unit={unit} lowerIsBetter={lower} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Visual comparison bar chart */}
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Visual Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={[
                          { name: 'Avg RT (ms)', A: Math.round(runA.metrics.avgResponseTime), B: Math.round(runB.metrics.avgResponseTime) },
                          { name: 'P95 RT (ms)', A: Math.round(runA.metrics.p95ResponseTime), B: Math.round(runB.metrics.p95ResponseTime) },
                          { name: 'RPS', A: Number(runA.metrics.requestsPerSecond.toFixed(1)), B: Number(runB.metrics.requestsPerSecond.toFixed(1)) },
                          { name: 'Error %', A: Number(runA.metrics.errorRate.toFixed(2)), B: Number(runB.metrics.errorRate.toFixed(2)) },
                        ]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="A" fill="#3b82f6" name="Run A" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="B" fill="#f59e0b" name="Run B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GitCompareArrows className="w-8 h-8 mx-auto mb-2" />
                  Select two runs to compare
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ EXPORT SCRIPT TAB ═══ */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Load Test Scripts</CardTitle>
              <CardDescription>Generate scripts for external load testing tools based on your current config ({customConfig.virtualUsers} VUs, {customConfig.duration}s, {customConfig.baseUrl})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* k6 */}
                <Card className="border-violet-500/30 hover:border-violet-500 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-violet-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">k6</h4>
                        <p className="text-xs text-muted-foreground">Grafana k6 load testing script</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => downloadScript(generateK6Script(customConfig), 'loadtest.js')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download k6 Script (.js)
                    </Button>
                  </CardContent>
                </Card>

                {/* JMeter */}
                <Card className="border-green-500/30 hover:border-green-500 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Apache JMeter</h4>
                        <p className="text-xs text-muted-foreground">JMX test plan</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => downloadScript(generateJMeterXml(customConfig), 'loadtest.jmx')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download JMeter Plan (.jmx)
                    </Button>
                  </CardContent>
                </Card>

                {/* Artillery */}
                <Card className="border-orange-500/30 hover:border-orange-500 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Artillery</h4>
                        <p className="text-xs text-muted-foreground">Artillery YAML config</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => downloadScript(generateArtilleryYaml(customConfig), 'artillery.yml')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Artillery Config (.yml)
                    </Button>
                  </CardContent>
                </Card>

                {/* Gatling */}
                <Card className="border-red-500/30 hover:border-red-500 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <FileCode className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Gatling</h4>
                        <p className="text-xs text-muted-foreground">Gatling Scala simulation</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => downloadScript(generateGatlingScala(customConfig), 'FlowstralLoadTest.scala')}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Gatling Simulation (.scala)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ REPORTS TAB ═══ */}
        <TabsContent value="reports" className="space-y-4">
          {testHistory.filter(t => t.metrics).length > 0 ? (
            <div className="space-y-3">
              {testHistory.filter(t => t.metrics).map((entry, i) => (
                <Card key={entry.testId || i}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{entry.testId?.slice(-16) || `Run ${i + 1}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.completedAt ? new Date(entry.completedAt).toLocaleString() : 'N/A'}
                          {' · '}
                          {entry.metrics.totalRequests} reqs · {Math.round(entry.metrics.avgResponseTime)}ms avg · {entry.metrics.errorRate.toFixed(2)}% errors
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={entry.status === 'completed' ? 'default' : 'secondary'}>{entry.status}</Badge>
                        <Button variant="outline" size="sm" onClick={() => exportReportJson(entry)}>
                          <Download className="w-3 h-3 mr-1" />
                          JSON
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Download className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Reports Available</h3>
                <p className="text-muted-foreground">Run some tests to generate downloadable reports</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ LOAD ZONES TAB ═══ */}
        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Geographic Load Zones
              </CardTitle>
              <CardDescription>
                Select regions to distribute load generation. Requires cloud-connected runner infrastructure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Switch
                  id="distributed"
                  checked={distributedEnabled}
                  onCheckedChange={setDistributedEnabled}
                />
                <div>
                  <Label htmlFor="distributed" className="cursor-pointer font-medium">Enable Distributed Testing</Label>
                  <p className="text-xs text-muted-foreground">Distribute VUs across multiple geographic regions</p>
                </div>
              </div>

              {distributedEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {LOAD_ZONES.map(zone => {
                      const isSelected = selectedZones.includes(zone.id);
                      return (
                        <div
                          key={zone.id}
                          onClick={() => {
                            setSelectedZones(prev =>
                              isSelected
                                ? prev.filter(z => z !== zone.id)
                                : [...prev, zone.id]
                            );
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-muted-foreground/30'
                          }`}
                        >
                          <span className="text-xl">{zone.flag}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{zone.name}</p>
                            <p className="text-xs text-muted-foreground">{zone.region}</p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                      );
                    })}
                  </div>

                  {selectedZones.length > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                      <p className="text-sm font-semibold">Load Distribution</p>
                      <p className="text-xs text-muted-foreground">
                        {customConfig.virtualUsers} VUs distributed across {selectedZones.length} zone(s)
                        {' → '}~{Math.ceil(customConfig.virtualUsers / selectedZones.length)} VUs per zone
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedZones.map(zoneId => {
                          const zone = LOAD_ZONES.find(z => z.id === zoneId);
                          return zone ? (
                            <Badge key={zoneId} variant="outline" className="text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              {zone.flag} {zone.name.split('(')[1]?.replace(')', '') || zone.name}
                              {' · '}
                              {Math.ceil(customConfig.virtualUsers / selectedZones.length)} VUs
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
