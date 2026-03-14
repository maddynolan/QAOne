/**
 * @module performance
 * @page VirtualUserGenerator
 *
 * Consolidated performance testing page. Manages load test configuration,
 * execution (backend-based), real-time metrics, threshold evaluation,
 * correlations, and test history.
 *
 * Uses Zustand store (performanceTestingStore) for persistent state and
 * delegates UI to extracted components: ScenarioBuilder, WorkloadModelSelector,
 * StagesEditor, ThresholdManager, CorrelationManager, PerformanceCharts,
 * PerformanceAnalytics.
 *
 * @features
 * - 9 tabs: Quick Start, Record & Import, Configure, Scenario Steps, Users, Metrics, Results, Correlations, History
 * - 8 load patterns (constant, ramp, spike, stress, soak, breakpoint, wave, custom)
 * - 6 workload models (constant_vus, ramping_vus, per_vu_iterations, shared_iterations, constant/ramping_arrival_rate)
 * - Protocol recording for HTTP traffic capture
 * - SLA threshold evaluation with PASS/FAIL verdicts
 * - Correlation rule management (JSONPath, regex, boundary, header, cookie, xpath, html_form)
 * - Persistent test history (max 50 entries)
 * - Server-side execution via Server execution (up to 10,000 VUs)
 *
 * @api /performance/* - Load testing engine (80 endpoints)
 * @api /api/protocol-recording/* - HTTP traffic capture (13 endpoints)
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Play, Pause, Square, Upload, Download, RefreshCw,
  TrendingUp, Activity, Clock, Zap, Target, AlertTriangle,
  CheckCircle2, XCircle, BarChart3, Loader2,
  Settings, Trash2, Plus, Eye, FileCode, Workflow,
  Timer, Gauge, Bot, Cpu, Globe, Server, Layers,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Types
import type { VirtualUser, TestStep, FlowstralSession, LoadTestConfig, LoadTestMetrics, FailedRequest } from '../types/virtual-user-types';
import type {
  ScenarioStep, WorkloadModelType, Threshold, ThresholdResult, CorrelationRule, TestHistoryEntry,
} from '../store/performanceTestingStore';

// Store
import { usePerformanceTestingStore } from '../store/performanceTestingStore';

// Constants & utils
import { LOAD_PATTERNS, USER_PERSONAS, QUICK_START_SCENARIOS, INITIAL_METRICS } from '../constants/virtual-user-constants';
import { formatTime, formatBytes, convertFlowstralToSteps, getVerdict } from '../lib/virtual-user-utils';
import { API_BASE_URL } from '@/lib/api-config';

// Extracted components
import ScenarioBuilder from '../components/ScenarioBuilder';
import WorkloadModelSelector from '../components/WorkloadModelSelector';
import StagesEditor from '../components/StagesEditor';
import ThresholdManager from '../components/ThresholdManager';
import CorrelationManager from '../components/CorrelationManager';

// ============================================================================
// Tab definitions
// ============================================================================

const TABS = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'record-import', label: 'Record & Import', icon: Upload },
  { id: 'configure', label: 'Configure', icon: Settings },
  { id: 'scenario', label: 'Scenario Steps', icon: Workflow },
  { id: 'users', label: 'Virtual Users', icon: Users },
  { id: 'metrics', label: 'Live Metrics', icon: Activity },
  { id: 'results', label: 'Results & Analytics', icon: BarChart3 },
  { id: 'correlations', label: 'Correlations', icon: Layers },
  { id: 'history', label: 'History', icon: Clock },
] as const;

// ============================================================================
// Threshold evaluation helper
// ============================================================================

function evaluateThresholds(metrics: LoadTestMetrics, thresholds: Threshold[]): ThresholdResult[] {
  const getMetricValue = (metric: string): number => {
    switch (metric) {
      case 'p50': return metrics.p50ResponseTime;
      case 'p90': return metrics.p90ResponseTime;
      case 'p95': return metrics.p95ResponseTime;
      case 'p99': return metrics.p99ResponseTime;
      case 'avg_response': return metrics.avgResponseTime;
      case 'error_rate':
        return metrics.totalRequests > 0
          ? (metrics.failedRequests / metrics.totalRequests) * 100
          : 0;
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

  return thresholds.map(th => {
    const actual = getMetricValue(th.metric);
    return {
      metric: th.metric,
      passed: evaluate(actual, th.operator, th.value),
      actual,
      threshold: th,
    };
  });
}

// ============================================================================
// Component
// ============================================================================

export default function VirtualUserGenerator() {
  const { toast } = useToast();

  // ---------------------------------------------------------------------------
  // Zustand store (persistent state)
  // ---------------------------------------------------------------------------
  const store = usePerformanceTestingStore();

  // ---------------------------------------------------------------------------
  // Local state (transient, UI-only)
  // ---------------------------------------------------------------------------
  const [virtualUsers, setVirtualUsers] = useState<VirtualUser[]>([]);
  const [failedRequests, setFailedRequests] = useState<FailedRequest[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<LoadTestConfig[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [importSource, setImportSource] = useState<'testcases' | 'recordings'>('testcases');
  const [flowstralSessions, setFlowstralSessions] = useState<FlowstralSession[]>([]);
  const [loadingFlowstral, setLoadingFlowstral] = useState(false);
  const [selectedSession, setSelectedSession] = useState<FlowstralSession | null>(null);

  // Legacy config bridge: we still keep a local `config` for the old test step
  // format used by the backend scenario creation and quick-start flows.
  const [legacySteps, setLegacySteps] = useState<TestStep[]>([]);
  const [legacyName, setLegacyName] = useState('Load Test');

  // ---------------------------------------------------------------------------
  // URL params (incoming test case from Builder/Recorder)
  // ---------------------------------------------------------------------------
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const incomingTestCaseName = useMemo(() => urlParams.get('testCaseName'), [urlParams]);
  const hasProtocolData = useMemo(() => urlParams.get('hasProtocolData') === 'true', [urlParams]);
  const source = useMemo(() => urlParams.get('source'), [urlParams]);

  // ---------------------------------------------------------------------------
  // Refs for closure access
  // ---------------------------------------------------------------------------
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const elapsedTimeRef = useRef(0);
  const metricsInterval = useRef<NodeJS.Timeout | null>(null);
  const testInterval = useRef<NodeJS.Timeout | null>(null);
  const metricsPollingRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Data loading helpers
  // ============================================================================

  const loadTestCasesFromLibrary = async () => {
    setLoadingTestCases(true);
    try {
      const response = await fetch(`${API_BASE_URL}/test-cases`);
      if (response.ok) {
        const data = await response.json();
        const automatedCases = (data.test_cases || data || []).filter((tc: any) =>
          tc.type === 'automated' || tc.automationScript || tc.source?.type === 'flowstral'
        );
        setTestCases(automatedCases);
      } else {
        try {
          const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
          setTestCases(local.filter((tc: any) =>
            tc.type === 'automated' || tc.automationScript || tc.source?.type === 'flowstral'
          ));
        } catch {
          setTestCases([]);
        }
      }
    } catch (error) {
      console.error("Failed to load test cases:", error);
      try {
        const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
        setTestCases(local);
      } catch {
        setTestCases([]);
      }
    } finally {
      setLoadingTestCases(false);
    }
  };

  const toggleTestCaseSelection = (tcId: string) => {
    setSelectedTestCases(prev =>
      prev.includes(tcId)
        ? prev.filter(id => id !== tcId)
        : [...prev, tcId]
    );
  };

  const importSelectedTestCases = () => {
    const selected = testCases.filter(tc => selectedTestCases.includes(tc.id));
    if (selected.length === 0) {
      toast({ title: "No Selection", description: "Please select at least one test case to import", variant: "destructive" });
      return;
    }

    const allSteps: TestStep[] = [];
    selected.forEach((tc, tcIndex) => {
      allSteps.push({
        id: `tc_${tcIndex}_header_${Date.now()}`,
        type: 'wait',
        action: `--- ${tc.name} ---`,
        value: '0'
      });
      (tc.steps || []).forEach((step: any, stepIndex: number) => {
        allSteps.push({
          id: `tc_${tcIndex}_step_${stepIndex}_${Date.now()}`,
          type: step.type || 'click',
          action: step.action || step.description || `Step ${stepIndex + 1}`,
          target: step.target || step.selector,
          value: step.value || step.testData
        });
      });
    });

    setLegacySteps(allSteps);
    setLegacyName(selected.length === 1
      ? `Load Test: ${selected[0].name}`
      : `Load Test: ${selected.length} Test Cases`
    );

    toast({ title: "Test Cases Imported", description: `Imported ${selected.length} test cases with ${allSteps.length} total steps` });
    setShowImportDialog(false);
    setSelectedTestCases([]);
    store.setActiveTab("scenario");
  };

  const loadFlowstralSessions = async () => {
    setLoadingFlowstral(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        sessions.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        setFlowstralSessions(sessions);
      } else {
        setFlowstralSessions([]);
      }
    } catch (error) {
      console.error("Failed to load Flowstral sessions:", error);
      setFlowstralSessions([]);
    } finally {
      setLoadingFlowstral(false);
    }
  };

  const importFlowstralSession = (session: FlowstralSession) => {
    const steps = convertFlowstralToSteps(session);
    setLegacySteps(steps);
    setLegacyName(`Load Test - ${session.name || session.session_id.substring(0, 8)}`);
    if (session.initial_url) store.setTargetUrl(session.initial_url);
    setSelectedSession(session);
    setShowImportDialog(false);
    toast({ title: "Session Imported", description: `Imported ${steps.length} steps from Flowstral recording` });
  };

  // ============================================================================
  // Backend scenario creation
  // ============================================================================

  const createBackendScenarioWithConfig = async (
    name: string, steps: TestStep[], targetUrl: string, vus: number, duration: number,
  ): Promise<string | null> => {
    try {
      const createResponse = await fetch(`${API_BASE_URL}/api/performance/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: `Load test with ${vus} VUs, ${duration}s duration` })
      });
      if (!createResponse.ok) throw new Error('Failed to create scenario');
      const { scenario_id } = await createResponse.json();

      for (const step of steps) {
        const stepUrl = step.type === 'api' || step.type === 'navigate'
          ? (step.target?.startsWith('http') ? step.target : `${targetUrl}${step.target}`)
          : targetUrl;
        await fetch(`${API_BASE_URL}/api/performance/scenarios/${scenario_id}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step_type: 'http_request',
            name: step.action || `${step.value || 'GET'} ${step.target}`,
            method: step.value || 'GET',
            url: stepUrl,
            headers: step.headers || {},
            body: step.body || null
          })
        });
      }
      console.log(`[LoadTest] Created backend scenario: ${scenario_id}`);
      return scenario_id;
    } catch (error) {
      console.error('[LoadTest] Failed to create backend scenario:', error);
      return null;
    }
  };

  // ============================================================================
  // Backend metrics polling
  // ============================================================================

  const pollBackendMetrics = async (testId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/tests/${testId}/status`);
      if (!response.ok) return;
      const data = await response.json();
      const testData = data.test || data;

      if (testData.status === 'running' && testData.current_metrics) {
        const m = testData.current_metrics;
        const rt = m.response_time || {};
        const tp = m.throughput || {};
        const vu = m.virtual_users || {};
        const iter = m.iterations || {};

        const newMetrics: LoadTestMetrics = {
          totalRequests: tp.total_requests || 0,
          successfulRequests: (tp.total_requests || 0) - (iter.errors || 0),
          failedRequests: iter.errors || 0,
          avgResponseTime: rt.avg || 0,
          minResponseTime: rt.min || 0,
          maxResponseTime: rt.max || 0,
          p50ResponseTime: rt.p50 || 0,
          p90ResponseTime: rt.p90 || 0,
          p95ResponseTime: rt.p95 || 0,
          p99ResponseTime: rt.p99 || 0,
          requestsPerSecond: tp.rps || 0,
          activeUsers: vu.active || 0,
          errorsPerSecond: iter.error_rate || 0,
          bytesReceived: m.bytes_received || 0,
          bytesSent: m.bytes_sent || 0,
        };

        store.updateMetrics(newMetrics);
        store.addMetricsSnapshot(newMetrics);

        // Update virtual users display
        const vuCount = vu.total || store.virtualUsers;
        const vuArray: VirtualUser[] = Array.from({ length: vuCount }, (_, i) => ({
          id: `vu_${i}`,
          name: `Virtual User ${i + 1}`,
          persona: store.persona,
          status: (i < (vu.active || 0) ? 'running' : (i < (vu.completed || 0) ? 'completed' : 'idle')) as VirtualUser['status'],
          currentStep: 0,
          totalSteps: legacySteps.length,
          metrics: {
            requestsCompleted: Math.floor((iter.total || 0) / vuCount),
            errorsCount: Math.floor((iter.errors || 0) / vuCount),
            avgResponseTime: rt.avg || 0
          }
        }));
        setVirtualUsers(vuArray);
      } else if (testData.status === 'completed' || testData.status === 'stopped') {
        stopBackendPolling();
        store.setIsRunning(false);
        isRunningRef.current = false;
        completeTest();
        toast({ title: "Load Test Complete", description: "Backend test finished. Check Results tab." });
        store.setActiveTab("results");
      }
    } catch (error) {
      console.error('[LoadTest] Error polling metrics:', error);
    }
  };

  const stopBackendPolling = () => {
    if (metricsPollingRef.current) {
      clearInterval(metricsPollingRef.current);
      metricsPollingRef.current = null;
    }
  };

  // ============================================================================
  // Test execution
  // ============================================================================

  const startLoadTestWithSteps = async (steps: TestStep[], name: string) => {
    if (steps.length === 0) {
      toast({ title: "Error", description: "Please add test steps or import a session", variant: "destructive" });
      return;
    }

    store.setIsRunning(true);
    store.setIsPaused(false);
    store.setElapsedTime(0);
    store.resetMetrics();
    isRunningRef.current = true;
    isPausedRef.current = false;
    elapsedTimeRef.current = 0;
    setFailedRequests([]);

    console.log(`[LoadTest] Starting BACKEND-based test: ${store.virtualUsers} VUs, ${store.duration}s duration`);

    try {
      toast({ title: "Creating Scenario...", description: "Setting up load test on backend" });
      const scenarioId = await createBackendScenarioWithConfig(
        name, steps, store.targetUrl, store.virtualUsers, store.duration,
      );
      if (!scenarioId) throw new Error('Failed to create scenario on backend');
      store.setBackendScenarioId(scenarioId);

      toast({ title: "Starting Load Test...", description: `Backend generating ${store.virtualUsers} virtual users` });

      const runResponse = await fetch(`${API_BASE_URL}/api/performance/tests/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: scenarioId,
          virtual_users: store.virtualUsers,
          ramp_up_seconds: store.rampUpTime,
          duration_seconds: store.duration,
          ramp_down_seconds: Math.floor(store.rampUpTime / 2),
          think_time_ms: store.thinkTime ? 2000 : 500,
          base_url: store.targetUrl,
          protocol: 'http',
          use_distributed: store.virtualUsers > 500,
        })
      });

      if (!runResponse.ok) {
        const error = await runResponse.json();
        throw new Error(error.detail || 'Failed to start load test');
      }

      const { test_id } = await runResponse.json();
      store.setBackendTestId(test_id);
      console.log(`[LoadTest] Backend test started: ${test_id}`);

      toast({ title: "Load Test Running", description: `Test ${test_id} executing on backend server` });

      // Elapsed time counter
      metricsInterval.current = setInterval(() => {
        elapsedTimeRef.current += 1;
        store.setElapsedTime(elapsedTimeRef.current);
      }, 1000);

      // Poll backend for real-time metrics
      metricsPollingRef.current = setInterval(() => {
        if (test_id && isRunningRef.current) {
          pollBackendMetrics(test_id);
        }
      }, 1000);

      // Auto-stop after duration (backup)
      testInterval.current = setTimeout(async () => {
        console.log(`[LoadTest] Duration complete, checking backend status...`);
        await pollBackendMetrics(test_id);
        stopBackendPolling();
        if (metricsInterval.current) clearInterval(metricsInterval.current);
        isRunningRef.current = false;
        store.setIsRunning(false);
        completeTest();
        toast({ title: "Load Test Complete", description: "Backend test finished. See Results tab." });
        store.setActiveTab("results");
      }, (store.duration + 10) * 1000);

    } catch (error: unknown) {
      console.error('[LoadTest] Error starting backend test:', error);
      store.setIsRunning(false);
      isRunningRef.current = false;
      const message = error instanceof Error ? error.message : "Failed to start load test on backend";
      toast({ title: "Load Test Failed", description: message, variant: "destructive" });
    }
  };

  const startLoadTest = async () => {
    await startLoadTestWithSteps(legacySteps, legacyName);
  };

  const stopLoadTest = async () => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    store.setIsRunning(false);
    store.setIsPaused(false);

    if (store.backendTestId) {
      try {
        await fetch(`${API_BASE_URL}/api/performance/tests/${store.backendTestId}/stop`, { method: 'POST' });
        console.log(`[LoadTest] Stopped backend test: ${store.backendTestId}`);
      } catch (error) {
        console.error('[LoadTest] Error stopping backend test:', error);
      }
    }

    stopBackendPolling();
    if (metricsInterval.current) clearInterval(metricsInterval.current);
    if (testInterval.current) clearTimeout(testInterval.current);
    setVirtualUsers(prev => prev.map(u => ({ ...u, status: 'completed' as const })));
    completeTest();
    console.log(`[LoadTest] Test stopped by user`);
    toast({ title: "Load Test Stopped", description: "Test execution has been stopped" });
  };

  const togglePause = () => {
    const newPausedState = !isPausedRef.current;
    isPausedRef.current = newPausedState;
    store.setIsPaused(newPausedState);

    if (newPausedState) {
      stopBackendPolling();
    } else if (store.backendTestId) {
      metricsPollingRef.current = setInterval(() => {
        pollBackendMetrics(store.backendTestId!);
      }, 1000);
    }
    toast({ title: newPausedState ? "Test Paused" : "Test Resumed", description: newPausedState ? "Metrics polling paused" : "Metrics polling resumed" });
  };

  // ============================================================================
  // Test completion & history
  // ============================================================================

  const completeTest = () => {
    // Evaluate thresholds using the store's configurable thresholds
    const results = evaluateThresholds(store.metrics, store.thresholds);
    store.setThresholdResults(results);

    // Derive verdict from threshold results (respects user-configured thresholds)
    let verdict = 'PENDING';
    let verdictReason = '';
    if (store.metrics.totalRequests === 0) {
      verdict = 'PENDING';
      verdictReason = 'No test data yet';
    } else if (results.length === 0) {
      // No thresholds configured, fall back to getVerdict() defaults
      const fallback = getVerdict(store.metrics);
      verdict = fallback.verdict;
      verdictReason = fallback.reason;
    } else {
      const passed = results.filter(r => r.passed).length;
      const criticalFails = results.filter(r => !r.passed && r.threshold.critical);
      if (criticalFails.length > 0) {
        verdict = 'FAIL';
        verdictReason = `Critical threshold failed: ${criticalFails.map(f => f.threshold.name || f.threshold.metric).join(', ')}`;
      } else if (passed === results.length) {
        verdict = 'PASS';
        verdictReason = `All ${results.length} thresholds passed`;
      } else {
        verdict = 'FAIL';
        verdictReason = `${results.length - passed} of ${results.length} thresholds failed`;
      }
    }

    // Save to history
    store.addToHistory({
      id: `test_${Date.now()}`,
      name: store.scenarioName || legacyName || 'Load Test',
      timestamp: new Date().toISOString(),
      config: {
        targetUrl: store.targetUrl,
        virtualUsers: store.virtualUsers,
        duration: store.duration,
        workloadModel: store.workloadModel,
        pattern: store.pattern,
      },
      metrics: { ...store.metrics },
      verdict: verdict,
      verdictReason: verdictReason,
      thresholdResults: results,
    });
  };

  // ============================================================================
  // Quick Start scenario helpers
  // ============================================================================

  const applyQuickStartScenario = (scenario: typeof QUICK_START_SCENARIOS[0]) => {
    const steps: TestStep[] = scenario.endpoints.map((endpoint, index) => ({
      id: `step_${index}_${Date.now()}`,
      type: 'api' as const,
      action: `${endpoint.method} ${endpoint.path}`,
      target: endpoint.path,
      value: endpoint.method,
    }));

    setLegacySteps(steps);
    setLegacyName(scenario.name);
    store.setVirtualUsers(scenario.virtualUsers);
    store.setDuration(scenario.duration);
    store.setRampUpTime(scenario.rampUp);
    store.setPattern(scenario.pattern);
    store.setActiveTab("configure");

    toast({ title: "Scenario Applied", description: `${scenario.name} loaded with ${steps.length} API endpoints` });
  };

  const runApiTest = async (scenario: typeof QUICK_START_SCENARIOS[0]) => {
    const steps: TestStep[] = scenario.endpoints.map((endpoint, index) => ({
      id: `step_${index}_${Date.now()}`,
      type: 'api' as const,
      action: `${endpoint.method} ${endpoint.path}`,
      target: endpoint.path,
      value: endpoint.method,
    }));

    setLegacySteps(steps);
    setLegacyName(scenario.name);
    store.setVirtualUsers(scenario.virtualUsers);
    store.setDuration(scenario.duration);
    store.setRampUpTime(scenario.rampUp);
    store.setPattern(scenario.pattern);
    store.setActiveTab("metrics");

    await startLoadTestWithSteps(steps, scenario.name);
  };

  // ============================================================================
  // HAR import
  // ============================================================================

  const handleHarImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.har,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const harData = JSON.parse(text);
        const entries = harData?.log?.entries || [];

        const steps: TestStep[] = entries
          .filter((entry: any) => {
            const url = entry?.request?.url || '';
            return !url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)(\?|$)/i);
          })
          .slice(0, 50)
          .map((entry: any, idx: number) => {
            const req = entry?.request || {};
            const url = new URL(req.url || 'http://localhost');
            return {
              id: `har_${idx}`,
              type: 'api' as const,
              name: `${req.method || 'GET'} ${url.pathname}`,
              action: `${req.method || 'GET'} ${url.pathname}`,
              url: req.url,
              method: req.method || 'GET',
              target: url.pathname,
              value: req.method || 'GET',
              headers: (req.headers || []).reduce((acc: any, h: any) => {
                if (h.name && !h.name.startsWith(':')) acc[h.name] = h.value;
                return acc;
              }, {}),
              body: req.postData?.text,
              enabled: true,
            };
          });

        if (steps.length > 0) {
          const firstUrl = new URL(steps[0].url || 'http://localhost');
          const baseUrl = `${firstUrl.protocol}//${firstUrl.host}`;
          setLegacySteps(steps);
          setLegacyName(`Load Test: ${file.name}`);
          store.setTargetUrl(baseUrl);

          toast({ title: "HAR Imported Successfully", description: `Loaded ${steps.length} HTTP requests.` });

          // Also save to backend (non-blocking)
          fetch(`${API_BASE_URL}/api/protocol-recording/import-har`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ har: harData, name: file.name })
          }).catch((err) => { console.warn('[LoadTest] Non-blocking HAR backend save failed:', err); });
        } else {
          toast({ title: "No API Requests Found", description: "HAR file contains no API requests", variant: "destructive" });
        }
      } catch {
        toast({ title: "Import Failed", description: "Invalid HAR file format", variant: "destructive" });
      }
    };
    input.click();
  };

  // ============================================================================
  // Protocol recording
  // ============================================================================

  const toggleProtocolRecording = async () => {
    if (store.isProtocolRecording) {
      // Stop
      try {
        await fetch(`${API_BASE_URL}/api/protocol-recording/stop`, { method: 'POST' });
        store.setProtocolRecording(false);
        toast({ title: "Recording Stopped", description: "Protocol recording stopped" });
      } catch {
        toast({ title: "Error", description: "Failed to stop recording", variant: "destructive" });
      }
    } else {
      // Start
      try {
        const response = await fetch(`${API_BASE_URL}/api/protocol-recording/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: store.targetUrl || 'http://localhost:8000' })
        });
        if (response.ok) {
          const data = await response.json();
          store.setProtocolRecording(true, data.recording_id || null);
          toast({ title: "Recording Started", description: "Navigate your app to capture HTTP traffic" });
        }
      } catch {
        toast({ title: "Error", description: "Failed to start protocol recording", variant: "destructive" });
      }
    }
  };

  // ============================================================================
  // Export
  // ============================================================================

  const exportResults = () => {
    const results = {
      config: {
        name: legacyName,
        targetUrl: store.targetUrl,
        virtualUsers: store.virtualUsers,
        duration: store.duration,
        pattern: store.pattern,
      },
      metrics: store.metrics,
      metricsHistory: store.metricsHistory,
      thresholdResults: store.thresholdResults,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `load-test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // Effects
  // ============================================================================

  // Cleanup all intervals on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (metricsInterval.current) clearInterval(metricsInterval.current);
      if (testInterval.current) clearTimeout(testInterval.current);
      if (metricsPollingRef.current) clearInterval(metricsPollingRef.current);
    };
  }, []);

  // Load saved configs and auto-refresh sessions
  useEffect(() => {
    try {
      const saved = localStorage.getItem('load_test_configs');
      if (saved) setSavedConfigs(JSON.parse(saved));
    } catch {
      console.warn('[LoadTest] Failed to parse saved configs from localStorage');
    }
    loadFlowstralSessions();

    const interval = setInterval(() => {
      if (showImportDialog) loadFlowstralSessions();
    }, 5000);
    return () => clearInterval(interval);
  }, [showImportDialog]);

  // Handle incoming test case from Builder or Recorder
  useEffect(() => {
    if (hasProtocolData) {
      if (source === 'recorder') {
        toast({ title: "Protocol Data Ready", description: "Import your recorded session to run load tests" });
        store.setActiveTab("record-import");
      } else if (incomingTestCaseName) {
        toast({ title: "Test Case Loaded", description: `"${incomingTestCaseName}" protocol data ready` });
        setLegacyName(`Load Test: ${incomingTestCaseName}`);
        store.setActiveTab("record-import");
      }
    }

    // Check for pending load test from recorder (Quick Load Test)
    const pendingRequests = sessionStorage.getItem('pendingLoadTestRequests');
    const pendingTimestamp = sessionStorage.getItem('pendingLoadTestTimestamp');

    if (pendingRequests && pendingTimestamp) {
      const age = Date.now() - parseInt(pendingTimestamp);
      if (age < 30000) {
        try {
          const requests = JSON.parse(pendingRequests);
          if (Array.isArray(requests) && requests.length > 0) {
            const steps: TestStep[] = requests.map((req: any, index: number) => ({
              id: `quick-${index}-${Date.now()}`,
              type: 'api' as const,
              action: `${req.method} ${new URL(req.url).pathname}`,
              name: `${req.method} ${new URL(req.url).pathname}`,
              method: req.method || 'GET',
              url: req.url,
              target: new URL(req.url).pathname,
              value: req.method || 'GET',
              headers: req.headers || {},
              body: req.body || '',
            }));

            const firstUrl = new URL(requests[0].url);
            const baseUrl = `${firstUrl.protocol}//${firstUrl.host}`;
            setLegacySteps(steps);
            setLegacyName(`Quick Load Test - ${new Date().toLocaleTimeString()}`);
            store.setTargetUrl(baseUrl);

            toast({ title: "Load Test Ready", description: `${requests.length} HTTP requests loaded from recording` });
            store.setActiveTab("record-import");
          }
        } catch (e) {
          console.error('Failed to parse pending load test requests:', e);
        }
      }
      sessionStorage.removeItem('pendingLoadTestRequests');
      sessionStorage.removeItem('pendingLoadTestTimestamp');
    }

    // Check for perf-draft-requests (from Recorder)
    const draftRequests = sessionStorage.getItem('perf-draft-requests');
    if (draftRequests) {
      try {
        const requests = JSON.parse(draftRequests);
        if (Array.isArray(requests) && requests.length > 0) {
          const steps: TestStep[] = requests.map((req: any, index: number) => ({
            id: `draft-${index}-${Date.now()}`,
            type: 'api' as const,
            action: `${req.method || 'GET'} ${req.path || req.url || '/'}`,
            target: req.path || req.url || '/',
            value: req.method || 'GET',
            url: req.url,
            method: req.method || 'GET',
            headers: req.headers || {},
            body: req.body || '',
          }));
          setLegacySteps(steps);
          toast({ title: "Draft Loaded", description: `${steps.length} requests loaded from recorder draft` });
          store.setActiveTab("record-import");
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('perf-draft-requests');
    }
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                              */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Gauge className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Performance Testing</h1>
              <p className="text-sm text-muted-foreground">
                Load testing - Virtual users - Threshold evaluation
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {store.isRunning ? (
              <>
                <Button variant="outline" onClick={togglePause}>
                  {store.isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                  {store.isPaused ? "Resume" : "Pause"}
                </Button>
                <Button variant="destructive" onClick={stopLoadTest}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : (
              <Button onClick={startLoadTest} disabled={legacySteps.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Play className="w-4 h-4 mr-2" />
                Start Load Test
              </Button>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Status Bar (visible while running)                                  */}
        {/* ------------------------------------------------------------------ */}
        {store.isRunning && (
          <Card className="border-primary">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-5 h-5 ${store.isPaused ? 'text-yellow-500' : 'text-green-500 animate-pulse'}`} />
                    <span className="font-medium">{store.isPaused ? 'Paused' : 'Running'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(store.elapsedTime)} / {formatTime(store.duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{store.metrics.activeUsers} Active Users</span>
                  </div>
                </div>
                <Progress value={(store.elapsedTime / store.duration) * 100} className="w-48" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Banner: requests loaded from recording                              */}
        {/* ------------------------------------------------------------------ */}
        {legacySteps.length > 0 && legacyName.includes('Quick Load Test') && !store.isRunning && store.metrics.totalRequests === 0 && (
          <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-700 dark:text-orange-300">
                      {legacySteps.length} API requests loaded from recording
                    </p>
                    <p className="text-sm text-orange-600/70 dark:text-orange-400/70">
                      Target: {store.targetUrl} - Ready to run
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => store.setActiveTab("scenario")}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Steps
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={startLoadTest}>
                    <Play className="w-4 h-4 mr-2" />
                    Run Load Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================== */}
        {/* Tabs                                                               */}
        {/* ================================================================== */}
        <Tabs value={store.activeTab} onValueChange={store.setActiveTab} className="space-y-4">
          <TabsList className="grid w-full bg-secondary border border-border p-1" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
            {TABS.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground text-xs"
              >
                <tab.icon className="w-3.5 h-3.5 mr-1" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ================================================================ */}
          {/* TAB: Quick Start                                                  */}
          {/* ================================================================ */}
          <TabsContent value="quickstart" className="space-y-4">
            {/* Server Runner toggle */}
            <div className="flex items-center gap-3 mb-4">
              <Switch checked={store.useServerRunner} onCheckedChange={store.setUseServerRunner} />
              <Label>Run on Server (Server Execution -- up to 10,000 VUs)</Label>
              {store.useServerRunner && <Badge variant="secondary">Server Mode</Badge>}
              {!store.useServerRunner && store.virtualUsers > 20 && (
                <Badge variant="destructive">Browser limited to 20 VUs</Badge>
              )}
            </div>

            {/* Target URL */}
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Target URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={store.targetUrl}
                        onChange={(e) => store.setTargetUrl(e.target.value)}
                        placeholder="https://your-api.com"
                        className="font-mono"
                      />
                      <Select onValueChange={(value) => store.setTargetUrl(value)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Presets" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={API_BASE_URL}>Backend API</SelectItem>
                          <SelectItem value="https://jsonplaceholder.typicode.com">JSONPlaceholder (Public)</SelectItem>
                          <SelectItem value="https://httpbin.org">HTTPBin (Public)</SelectItem>
                          <SelectItem value="http://localhost:3000">localhost:3000</SelectItem>
                          <SelectItem value="http://localhost:8000">localhost:8000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Start Scenarios */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-primary" />
                  API Performance Tests
                </CardTitle>
                <CardDescription>
                  One-click scenarios to test your API against the Target URL above.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {QUICK_START_SCENARIOS.map((scenario) => (
                    <Card key={scenario.id} className="bg-secondary border-border hover:border-primary/50 transition-all">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{scenario.icon}</span>
                          <span className="font-medium text-sm">{scenario.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{scenario.description}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-xs">{scenario.virtualUsers} users</Badge>
                          <Badge variant="outline" className="text-xs">{scenario.duration}s</Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => runApiTest(scenario)}
                          className="w-full mt-2"
                          disabled={store.isRunning}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Run
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Record & Import                                              */}
          {/* ================================================================ */}
          <TabsContent value="record-import" className="space-y-4">
            {/* Protocol Recording */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  Protocol Recording
                </CardTitle>
                <CardDescription>
                  Capture HTTP traffic in real-time by browsing your application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant={store.isProtocolRecording ? "destructive" : "default"}
                    onClick={toggleProtocolRecording}
                  >
                    {store.isProtocolRecording ? (
                      <><Square className="w-4 h-4 mr-2" /> Stop Recording</>
                    ) : (
                      <><Activity className="w-4 h-4 mr-2" /> Start Recording</>
                    )}
                  </Button>
                  {store.isProtocolRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm text-red-600 font-medium">Recording HTTP traffic...</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* HAR Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-500" />
                  Import HAR File
                </CardTitle>
                <CardDescription>
                  Import HTTP Archive files from Chrome/Firefox DevTools.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                  <AlertDescription>
                    <strong className="text-blue-700 dark:text-blue-300">How to capture HAR:</strong>
                    <ol className="list-decimal list-inside mt-2 text-sm text-blue-600 dark:text-blue-400 space-y-1">
                      <li>Open Chrome DevTools (F12) - Network tab</li>
                      <li>Browse your application to capture traffic</li>
                      <li>Right-click - "Save all as HAR with content"</li>
                      <li>Import the HAR file below</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <Card className="p-6 border-2 border-dashed hover:border-primary cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Import HAR File</h4>
                      <p className="text-xs text-muted-foreground">Load HTTP Archive from browser DevTools</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleHarImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import HAR File
                  </Button>
                </Card>
              </CardContent>
            </Card>

            {/* Import from Flowstral Recordings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-purple-500" />
                  Import from Recordings
                </CardTitle>
                <CardDescription>
                  Load test steps from saved test cases or Flowstral recordings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => { setShowImportDialog(true); loadFlowstralSessions(); }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import from Library
                </Button>
              </CardContent>
            </Card>

            {/* Steps Ready banner */}
            {legacySteps.length > 0 && (
              <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="w-5 h-5" />
                    {legacySteps.length} API Requests Ready for Load Testing
                  </CardTitle>
                  <CardDescription>Target: <span className="font-medium">{store.targetUrl}</span></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-h-32 overflow-y-auto space-y-1 text-xs bg-muted/50 rounded p-2">
                    {legacySteps.slice(0, 8).map((step) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{step.method || step.value || 'GET'}</Badge>
                        <span className="truncate text-muted-foreground">{step.action || step.name}</span>
                      </div>
                    ))}
                    {legacySteps.length > 8 && <div className="text-muted-foreground">... and {legacySteps.length - 8} more</div>}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Virtual Users</Label>
                      <Input type="number" min={1} max={10000} value={store.virtualUsers} onChange={(e) => store.setVirtualUsers(Math.min(10000, Math.max(1, parseInt(e.target.value) || 10)))} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Duration (sec)</Label>
                      <Input type="number" min={1} max={3600} value={store.duration} onChange={(e) => store.setDuration(Math.min(3600, Math.max(1, parseInt(e.target.value) || 60)))} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Ramp-up (sec)</Label>
                      <Input type="number" min={0} max={3600} value={store.rampUpTime} onChange={(e) => store.setRampUpTime(Math.min(3600, Math.max(0, parseInt(e.target.value) || 10)))} className="h-8" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1" size="lg" disabled={store.isRunning} onClick={startLoadTest}>
                      {store.isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                      {store.isRunning ? 'Running...' : `Start Load Test (${store.virtualUsers} VUs, ${store.duration}s)`}
                    </Button>
                    <Button variant="outline" onClick={() => store.setActiveTab("scenario")}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Steps
                    </Button>
                    <Button variant="ghost" onClick={() => setLegacySteps([])}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Configure                                                    */}
          {/* ================================================================ */}
          <TabsContent value="configure" className="space-y-6">
            {/* Target URL */}
            <Card>
              <CardHeader>
                <CardTitle>Target URL</CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={store.targetUrl} onChange={e => store.setTargetUrl(e.target.value)} placeholder="https://your-api.com" className="font-mono" />
              </CardContent>
            </Card>

            {/* Workload Model */}
            <WorkloadModelSelector
              selected={store.workloadModel}
              onSelect={store.setWorkloadModel}
              virtualUsers={store.virtualUsers}
              onVirtualUsersChange={store.setVirtualUsers}
              duration={store.duration}
              onDurationChange={store.setDuration}
              iterations={store.iterations}
              onIterationsChange={store.setIterations}
            />

            {/* Stages Editor (for ramping models) */}
            {(store.workloadModel === 'ramping_vus' || store.workloadModel === 'ramping_arrival_rate') && (
              <StagesEditor
                stages={store.stages}
                onStagesChange={store.setStages}
                targetLabel={store.workloadModel.includes('arrival') ? 'req/s' : 'VUs'}
              />
            )}

            {/* Load Pattern */}
            <Card>
              <CardHeader>
                <CardTitle>Load Pattern</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {Object.entries(LOAD_PATTERNS).map(([key, pattern]) => (
                    <div
                      key={key}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        store.pattern === key
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => store.setPattern(key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{pattern.icon}</span>
                        <span className="font-medium text-sm">{pattern.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Additional config */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Timing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Ramp-Up Time (seconds): {store.rampUpTime}</Label>
                    <Slider value={[store.rampUpTime]} onValueChange={(v) => store.setRampUpTime(v[0])} min={0} max={store.duration} step={1} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Think Time (realistic delays)</Label>
                    <Switch checked={store.thinkTime} onCheckedChange={(v) => store.setThinkTime(v)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Persona</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(USER_PERSONAS).map(([key, persona]) => (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          store.persona === key
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => store.setPersona(key)}
                      >
                        <span className="font-medium text-sm">{persona.name}</span>
                        <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SLA Thresholds */}
            <ThresholdManager
              thresholds={store.thresholds}
              onThresholdsChange={store.setThresholds}
              results={store.thresholdResults}
            />

            {/* Server Execution Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-4 w-4" /> Server Execution Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Switch checked={store.useServerRunner} onCheckedChange={store.setUseServerRunner} />
                  <div className={`h-3 w-3 rounded-full ${store.useServerRunner ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>{store.useServerRunner ? 'Server runner enabled' : 'Using browser execution'}</span>
                </div>
                {store.useServerRunner && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Server execution supports up to 10,000 concurrent virtual users with HTTP/1.1, HTTP/2, WebSocket, and gRPC protocols.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Scenario Steps                                               */}
          {/* ================================================================ */}
          <TabsContent value="scenario" className="space-y-4">
            <ScenarioBuilder
              steps={store.scenarioSteps}
              onStepsChange={store.setScenarioSteps}
              targetUrl={store.targetUrl}
              onImportHar={handleHarImport}
              onImportRecording={() => { setShowImportDialog(true); loadFlowstralSessions(); }}
            />

            {/* Legacy steps display (from HAR/Flowstral import) */}
            {legacySteps.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Imported Steps (Legacy)</CardTitle>
                      <CardDescription>
                        {legacySteps.length} steps imported from recordings/HAR. These are used for load test execution.
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLegacySteps([])}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {legacySteps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                        <Badge variant="outline" className="w-8 h-6 flex items-center justify-center text-xs">{index + 1}</Badge>
                        <Badge variant="secondary" className="text-xs">{step.type}</Badge>
                        <span className="flex-1 truncate text-muted-foreground">{step.action || step.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{step.target}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Virtual Users                                                */}
          {/* ================================================================ */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Virtual Users ({virtualUsers.length})</CardTitle>
                <CardDescription>Monitor individual virtual user status during test execution</CardDescription>
              </CardHeader>
              <CardContent>
                {virtualUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No virtual users</h3>
                    <p className="text-muted-foreground">Start a load test to see virtual users</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
                    {virtualUsers.map(user => (
                      <Card key={user.id} className={`p-3 ${
                        user.status === 'running' ? 'border-green-500' :
                        user.status === 'error' ? 'border-red-500' :
                        user.status === 'completed' ? 'border-blue-500' : ''
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className={`w-4 h-4 ${
                            user.status === 'running' ? 'text-green-500 animate-pulse' :
                            user.status === 'error' ? 'text-red-500' :
                            user.status === 'completed' ? 'text-blue-500' : 'text-muted-foreground'
                          }`} />
                          <span className="text-sm font-medium truncate">{user.name}</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">Requests:</span><span>{user.metrics.requestsCompleted}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Errors:</span><span className={user.metrics.errorsCount > 0 ? 'text-red-500' : ''}>{user.metrics.errorsCount}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Avg RT:</span><span>{user.metrics.avgResponseTime.toFixed(0)}ms</span></div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Live Metrics                                                 */}
          {/* ================================================================ */}
          <TabsContent value="metrics" className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-3xl font-bold">{store.metrics.totalRequests.toLocaleString()}</p>
                    </div>
                    <Activity className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Requests/sec</p>
                      <p className="text-3xl font-bold">{store.metrics.requestsPerSecond.toFixed(1)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Response Time</p>
                      <p className="text-3xl font-bold">{store.metrics.avgResponseTime.toFixed(0)}ms</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                      <p className="text-3xl font-bold">
                        {((store.metrics.failedRequests / Math.max(1, store.metrics.totalRequests)) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Percentiles + Success/Failure */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Response Time Percentiles</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'p50 (Median)', value: store.metrics.p50ResponseTime },
                      { label: 'p90', value: store.metrics.p90ResponseTime },
                      { label: 'p95', value: store.metrics.p95ResponseTime },
                      { label: 'p99', value: store.metrics.p99ResponseTime },
                    ].map(p => (
                      <div key={p.label} className="flex justify-between items-center">
                        <span>{p.label}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, p.value / 10)} className="w-32" />
                          <span className="font-mono">{p.value.toFixed(0)}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Success vs Failures</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-green-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Successful</span>
                        <span>{store.metrics.successfulRequests.toLocaleString()}</span>
                      </div>
                      <Progress value={(store.metrics.successfulRequests / Math.max(1, store.metrics.totalRequests)) * 100} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-red-500 flex items-center gap-2"><XCircle className="w-4 h-4" /> Failed</span>
                        <span>{store.metrics.failedRequests.toLocaleString()}</span>
                      </div>
                      <Progress value={(store.metrics.failedRequests / Math.max(1, store.metrics.totalRequests)) * 100} className="h-3 [&>div]:bg-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Response Time Over Time (bar chart) */}
            <Card>
              <CardHeader><CardTitle>Response Time Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48 flex items-end gap-1">
                  {(() => {
                    const recentHistory = store.metricsHistory.slice(-60);
                    let maxAvgRT = 1;
                    for (const h of store.metricsHistory) {
                      if (h.avgResponseTime > maxAvgRT) maxAvgRT = h.avgResponseTime;
                    }
                    return recentHistory.map((m, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/80 rounded-t transition-all"
                      style={{
                        height: `${Math.min(100, (m.avgResponseTime / maxAvgRT) * 100)}%`,
                        minHeight: '4px'
                      }}
                      title={`${m.avgResponseTime.toFixed(0)}ms`}
                    />
                  ));
                  })()}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>-60s</span>
                  <span>Now</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Results & Analytics                                          */}
          {/* ================================================================ */}
          <TabsContent value="results" className="space-y-4">
            {/* PASS/FAIL Verdict Banner */}
            {store.metrics.totalRequests > 0 && (() => {
              const v = getVerdict(store.metrics);
              return (
                <Card className={`border-2 ${
                  v.verdict === 'PASS' ? 'border-green-500 bg-green-500/10' :
                  v.verdict === 'FAIL' ? 'border-red-500 bg-red-500/10' :
                  'border-yellow-500 bg-yellow-500/10'
                }`}>
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`text-4xl font-black ${
                          v.verdict === 'PASS' ? 'text-green-500' : v.verdict === 'FAIL' ? 'text-red-500' : 'text-yellow-500'
                        }`}>{v.verdict}</div>
                        <div className="text-sm text-muted-foreground">{v.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Thresholds</div>
                        <div className="text-2xl font-bold">{v.passed}/{v.total}</div>
                      </div>
                    </div>
                    {/* Threshold Results */}
                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {v.details.map((result, i) => (
                        <div key={i} className={`p-2 rounded text-xs ${
                          result.passed ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:text-red-400'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span>{result.passed ? '>' : 'x'} {result.name}</span>
                          </div>
                          <div className="font-mono mt-1">{result.actual.toFixed(2)} {result.operator} {result.expected}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Store threshold results (from ThresholdManager) */}
            {store.thresholdResults.length > 0 && (
              <ThresholdManager
                thresholds={store.thresholds}
                onThresholdsChange={store.setThresholds}
                results={store.thresholdResults}
              />
            )}

            {/* Summary */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Test Results Summary</h3>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportResults}>
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Test Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Test Name:</span><span>{legacyName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Target URL:</span><span className="truncate max-w-[150px]">{store.targetUrl}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Virtual Users:</span><span>{store.virtualUsers}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span>{formatTime(store.duration)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pattern:</span><Badge variant="outline">{LOAD_PATTERNS[store.pattern as keyof typeof LOAD_PATTERNS]?.name}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Steps:</span><span>{legacySteps.length}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Performance Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Requests:</span><span className="font-mono">{store.metrics.totalRequests.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Throughput:</span><span className="font-mono">{store.metrics.requestsPerSecond.toFixed(2)} req/s</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Avg Response:</span><span className="font-mono">{store.metrics.avgResponseTime.toFixed(2)}ms</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Min Response:</span><span className="font-mono">{store.metrics.minResponseTime === Infinity ? '0' : store.metrics.minResponseTime.toFixed(2)}ms</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Max Response:</span><span className="font-mono">{store.metrics.maxResponseTime.toFixed(2)}ms</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">p95 Response:</span><span className="font-mono">{store.metrics.p95ResponseTime.toFixed(2)}ms</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Reliability</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success Rate:</span>
                    <span className={`font-mono ${
                      (store.metrics.successfulRequests / Math.max(1, store.metrics.totalRequests)) > 0.99 ? 'text-green-500' :
                      (store.metrics.successfulRequests / Math.max(1, store.metrics.totalRequests)) > 0.95 ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {((store.metrics.successfulRequests / Math.max(1, store.metrics.totalRequests)) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Successful:</span><span className="font-mono text-green-500">{store.metrics.successfulRequests.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Failed:</span><span className="font-mono text-red-500">{store.metrics.failedRequests.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Error/sec:</span><span className="font-mono">{store.metrics.errorsPerSecond.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Peak Users:</span><span className="font-mono">{virtualUsers.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span className="font-mono">{formatTime(store.elapsedTime)}</span></div>
                </CardContent>
              </Card>
            </div>

            {/* Failed Requests Details */}
            {failedRequests.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    Failed Requests ({failedRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {failedRequests.map((failure, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-red-700 dark:text-red-400">{failure.userName} - {failure.stepName}</p>
                            <p className="text-xs text-muted-foreground mt-1">Step {failure.stepIndex + 1} - {new Date(failure.timestamp).toLocaleTimeString()}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">{failure.responseTime.toFixed(0)}ms</Badge>
                        </div>
                        {failure.error && <p className="text-xs text-red-600 mt-2">{failure.error}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: Correlations                                                 */}
          {/* ================================================================ */}
          <TabsContent value="correlations" className="space-y-4">
            <CorrelationManager
              rules={store.correlationRules}
              onRulesChange={store.setCorrelationRules}
              targetUrl={store.targetUrl}
            />
          </TabsContent>

          {/* ================================================================ */}
          {/* TAB: History                                                       */}
          {/* ================================================================ */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Test History
                    </CardTitle>
                    <CardDescription>{store.testHistory.length} test runs recorded</CardDescription>
                  </div>
                  {store.testHistory.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => {
                      store.clearHistory();
                      toast({ title: "History Cleared" });
                    }}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear History
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {store.testHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No test history</h3>
                    <p className="text-muted-foreground">Run a load test to see results here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>VUs</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Avg RT</TableHead>
                        <TableHead>p95</TableHead>
                        <TableHead>Error Rate</TableHead>
                        <TableHead>RPS</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {store.testHistory.map((entry) => {
                        const errorRate = entry.metrics.totalRequests > 0
                          ? ((entry.metrics.failedRequests / entry.metrics.totalRequests) * 100).toFixed(1)
                          : '0.0';
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">{entry.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>{entry.config.virtualUsers}</TableCell>
                            <TableCell>{formatTime(entry.config.duration)}</TableCell>
                            <TableCell className="font-mono">{entry.metrics.avgResponseTime.toFixed(0)}ms</TableCell>
                            <TableCell className="font-mono">{entry.metrics.p95ResponseTime.toFixed(0)}ms</TableCell>
                            <TableCell className="font-mono">{errorRate}%</TableCell>
                            <TableCell className="font-mono">{entry.metrics.requestsPerSecond.toFixed(1)}</TableCell>
                            <TableCell>
                              <Badge variant={entry.verdict === 'PASS' ? 'default' : entry.verdict === 'FAIL' ? 'destructive' : 'secondary'}>
                                {entry.verdict}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => {
                                  // Re-load config from history
                                  store.setTargetUrl(entry.config.targetUrl);
                                  store.setVirtualUsers(entry.config.virtualUsers);
                                  store.setDuration(entry.config.duration);
                                  store.setPattern(entry.config.pattern);
                                  store.setWorkloadModel(entry.config.workloadModel);
                                  store.setActiveTab("configure");
                                  toast({ title: "Config Loaded", description: `Loaded config from "${entry.name}"` });
                                }}>
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  store.removeFromHistory(entry.id);
                                  toast({ title: "Removed" });
                                }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ================================================================== */}
        {/* Import Dialog - Test Cases & Recordings                             */}
        {/* ================================================================== */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Import Test Steps
              </DialogTitle>
            </DialogHeader>

            {/* Source Selection Tabs */}
            <div className="flex gap-2 border-b pb-2">
              <Button
                variant={importSource === 'testcases' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setImportSource('testcases'); loadTestCasesFromLibrary(); }}
              >
                <FileCode className="w-4 h-4 mr-2" />
                Test Cases ({testCases.length})
              </Button>
              <Button
                variant={importSource === 'recordings' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setImportSource('recordings'); loadFlowstralSessions(); }}
              >
                <Workflow className="w-4 h-4 mr-2" />
                Raw Recordings ({flowstralSessions.length})
              </Button>
            </div>

            <div className="space-y-4">
              {/* Test Cases (Multi-Select) */}
              {importSource === 'testcases' && (
                <>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {selectedTestCases.length > 0
                        ? `${selectedTestCases.length} test case(s) selected`
                        : 'Select test cases to import (multi-select supported)'
                      }
                    </div>
                    <div className="flex gap-2">
                      {selectedTestCases.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => setSelectedTestCases([])}>Clear</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={loadTestCasesFromLibrary} disabled={loadingTestCases}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingTestCases ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {testCases.length === 0 ? (
                    <div className="text-center py-8">
                      <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No automated test cases found</p>
                      <p className="text-sm text-muted-foreground mt-2">Approve recordings in Trace (Record) to create test cases</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {testCases.map(tc => (
                        <Card
                          key={tc.id}
                          className={`p-4 cursor-pointer transition-all ${
                            selectedTestCases.includes(tc.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          }`}
                          onClick={() => toggleTestCaseSelection(tc.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                              selectedTestCases.includes(tc.id) ? 'bg-primary border-primary' : 'border-muted-foreground/50'
                            }`}>
                              {selectedTestCases.includes(tc.id) && <CheckCircle2 className="w-4 h-4 text-gray-900 dark:text-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{tc.name}</p>
                                <Badge variant="outline" className="text-xs">{tc.type || 'automated'}</Badge>
                                {tc.category && <Badge variant="secondary" className="text-xs">{tc.category}</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{tc.steps?.length || 0} steps - Priority: {tc.priority || 'medium'}</p>
                              {tc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{tc.description}</p>}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Raw Recordings (Single-Select) */}
              {importSource === 'recordings' && (
                <>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={loadFlowstralSessions} disabled={loadingFlowstral}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loadingFlowstral ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>

                  {flowstralSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No recordings found</p>
                      <p className="text-sm text-muted-foreground mt-2">Record a session using the Flowstral extension</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {flowstralSessions.map(session => (
                        <Card
                          key={session.session_id}
                          className="p-4 cursor-pointer hover:border-primary transition-colors"
                          onClick={() => importFlowstralSession(session)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{session.name || `Recording ${session.session_id.substring(0, 8)}`}</p>
                              <p className="text-sm text-muted-foreground">
                                {(session.actions?.length || session.nodes?.length || 0)} actions - {session.initial_url || 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground">{session.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown date'}</p>
                            </div>
                            <Button variant="outline" size="sm">
                              <Upload className="w-4 h-4 mr-2" />
                              Import
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowImportDialog(false); setSelectedTestCases([]); }}>
                Cancel
              </Button>
              {importSource === 'testcases' && selectedTestCases.length > 0 && (
                <Button onClick={importSelectedTestCases}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {selectedTestCases.length} Test Case(s)
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
