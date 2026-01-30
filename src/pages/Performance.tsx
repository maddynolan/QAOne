import { useState, useEffect, useRef } from "react";
import { 
  Zap, Play, Square, BarChart3, TrendingUp, Clock, Users, AlertTriangle, CheckCircle, 
  RefreshCw, Download, ExternalLink, FileText, Settings, Bell, Calendar, 
  Activity, Database, Network, Layers, FileSpreadsheet, Gauge, AlertCircle,
  Rocket, Target, Timer, Server, Cpu, HardDrive, Wifi, PauseCircle, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/lib/api-config";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Test website endpoints for quick-start scenarios
const ECOMMERCE_TEST_URL = "http://localhost:8002";

// In-browser runner: quick validation only. For real load use Go runner or k6.
const MAX_BROWSER_VUS = 20;

interface TestMetrics {
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

interface LiveTestData {
  testId: string;
  status: "running" | "completed" | "stopped" | "failed";
  metrics: TestMetrics;
  responseTimeHistory: number[];
  rpsHistory: number[];
  errorHistory: number[];
  cpuHistory: number[];
  memoryHistory: number[];
}

interface ServerCpuMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_sent_mb: number;
  network_recv_mb: number;
  load_average_1m?: number;
  process_count?: number;
  top_processes?: Array<{user: string; pid: string; cpu_percent: number; command: string}>;
}

interface ProtocolRecording {
  recordingId: string;
  isActive: boolean;
  totalRequests: number;
  totalBytes: number;
}

// Quick-start scenario presets for e-commerce testing
const QUICK_START_SCENARIOS = [
  {
    id: "api_load",
    name: "🚀 API Load Test",
    description: "Standard load test on REST API endpoints (products, categories)",
    virtualUsers: 50,
    duration: 60,
    rampUp: 10,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 20 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "spike_test",
    name: "⚡ Spike Test",
    description: "Sudden traffic spike to test system resilience",
    virtualUsers: 200,
    duration: 120,
    rampUp: 5,
    testType: "spike",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/products/1", weight: 30 },
      { method: "GET", path: "/api/categories", weight: 20 },
    ]
  },
  {
    id: "stress_test",
    name: "🔥 Stress Test",
    description: "Find the breaking point - gradually increase load until failure",
    virtualUsers: 500,
    duration: 180,
    rampUp: 60,
    testType: "stress",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products?limit=100", weight: 30 },
      { method: "GET", path: "/api/search?q=product", weight: 30 },
    ]
  },
  {
    id: "endurance_test",
    name: "⏱️ Endurance Test",
    description: "Long-running test to find memory leaks and stability issues",
    virtualUsers: 30,
    duration: 600,
    rampUp: 30,
    testType: "endurance",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/categories", weight: 30 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "mixed_workload",
    name: "🔀 Mixed Workload",
    description: "Realistic user behavior with reads and writes",
    virtualUsers: 100,
    duration: 120,
    rampUp: 20,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 30 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 15 },
      { method: "GET", path: "/api/search?q=test", weight: 15 },
      { method: "GET", path: "/api/performance/load?iterations=100", weight: 10 },
      { method: "GET", path: "/api/performance/delay/0.1", weight: 10 },
    ]
  },
  {
    id: "pwa_load",
    name: "📱 PWA Load",
    description: "Load test PWA start URL (document + shell). Use your PWA base URL in Custom Config.",
    virtualUsers: 30,
    duration: 60,
    rampUp: 10,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/", weight: 80 },
      { method: "GET", path: "/manifest.json", weight: 10 },
      { method: "GET", path: "/service-worker.js", weight: 10 },
    ]
  }
];

export default function Performance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("quickstart");
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<LiveTestData | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [customConfig, setCustomConfig] = useState({
    baseUrl: ECOMMERCE_TEST_URL,
    virtualUsers: 50,
    duration: 60,
    rampUp: 10,
    thinkTime: 1000,
  });
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [testHistory, setTestHistory] = useState<any[]>([]);
  
  // Protocol capture state
  const [protocolCaptureEnabled, setProtocolCaptureEnabled] = useState(false);
  const [protocolRecording, setProtocolRecording] = useState<ProtocolRecording | null>(null);
  
  // Server CPU monitoring state
  const [serverMonitoringEnabled, setServerMonitoringEnabled] = useState(false);
  const [targetServerConfig, setTargetServerConfig] = useState({
    host: "localhost",
    serverType: "prometheus" as "linux_ssh" | "windows_wmi" | "prometheus" | "aws_cloudwatch",
    port: 9090,
    username: "",
    password: "",
  });
  const [serverCpuMetrics, setServerCpuMetrics] = useState<ServerCpuMetrics | null>(null);
  const [serverHealthWarnings, setServerHealthWarnings] = useState<string[]>([]);
  
  // From Recorder: draft (backend) or sessionStorage
  const [searchParams] = useSearchParams();
  const [fromRecorderRequests, setFromRecorderRequests] = useState<Array<{ method: string; url: string; headers?: Record<string, string>; body?: string }>>([]);
  const [fromRecorderTimestamp, setFromRecorderTimestamp] = useState<number | null>(null);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [recorderEndpoints, setRecorderEndpoints] = useState<Array<{ method: string; path: string; weight: number }>>([]);
  
  // Lighthouse
  const [lighthouseUrl, setLighthouseUrl] = useState("");
  const [lighthouseResult, setLighthouseResult] = useState<any>(null);
  const [lighthouseLoading, setLighthouseLoading] = useState(false);
  const [lighthouseFormFactor, setLighthouseFormFactor] = useState<"desktop" | "mobile">("desktop");
  
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const serverMetricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Consume load test from Recorder: draft_id (backend) first, then sessionStorage fallback
  useEffect(() => {
    const draftId = searchParams.get("draft_id");
    if (draftId) {
      fetch(`${API_BASE_URL}/api/performance/drafts/${draftId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.draft?.requests?.length > 0) {
            const requests = data.draft.requests as Array<{ method?: string; url: string; headers?: Record<string, string>; body?: string }>;
            setFromRecorderRequests(requests.map((r) => ({ method: r.method || "GET", url: r.url, headers: r.headers, body: r.body })));
            setFromRecorderTimestamp(data.draft.created_at ? Math.floor(data.draft.created_at * 1000) : null);
            setLoadedDraftId(draftId);
            toast.success(`Loaded draft ${draftId}: ${requests.length} requests`);
          }
        })
        .catch(() => {
          toast.error("Draft not found or expired. Try recording again.");
        });
      return;
    }
    try {
      const raw = sessionStorage.getItem("pendingLoadTestRequests");
      const ts = sessionStorage.getItem("pendingLoadTestTimestamp");
      if (raw && ts) {
        const requests = JSON.parse(raw) as Array<{ method?: string; url: string; headers?: Record<string, string>; body?: string }>;
        if (Array.isArray(requests) && requests.length > 0) {
          setFromRecorderRequests(requests.map((r) => ({ method: r.method || "GET", url: r.url, headers: r.headers, body: r.body })));
          setFromRecorderTimestamp(parseInt(ts, 10) || null);
          toast.success(`Loaded ${requests.length} requests from Recorder (session)`);
        }
      }
    } catch (_) {
      // ignore parse errors
    }
  }, [searchParams]);

  const useRecorderRequests = () => {
    if (fromRecorderRequests.length === 0) return;
    const first = fromRecorderRequests[0];
    try {
      const u = new URL(first.url);
      const baseUrl = `${u.protocol}//${u.host}`;
      setCustomConfig((c) => ({ ...c, baseUrl }));
      const endpoints: Array<{ method: string; path: string; weight: number }> = fromRecorderRequests.map((r) => {
        try {
          const u2 = new URL(r.url);
          const path = u2.pathname || "/";
          const search = u2.search || "";
          return { method: r.method || "GET", path: path + search, weight: 100 };
        } catch {
          return { method: r.method || "GET", path: "/", weight: 100 };
        }
      });
      setRecorderEndpoints(endpoints);
      setActiveTab("config");
      sessionStorage.removeItem("pendingLoadTestRequests");
      sessionStorage.removeItem("pendingLoadTestTimestamp");
      setFromRecorderRequests([]);
      setFromRecorderTimestamp(null);
      setLoadedDraftId(null);
      if (searchParams.get("draft_id")) window.history.replaceState({}, "", "/performance");
      toast.success("Using recorder requests. Adjust base URL and Run Custom Test.");
    } catch (e) {
      toast.error("Could not parse recorder URLs");
    }
  };

  const dismissRecorderRequests = () => {
    setFromRecorderRequests([]);
    setFromRecorderTimestamp(null);
    setLoadedDraftId(null);
    setRecorderEndpoints([]);
    sessionStorage.removeItem("pendingLoadTestRequests");
    sessionStorage.removeItem("pendingLoadTestTimestamp");
    if (searchParams.get("draft_id")) {
      window.history.replaceState({}, "", "/performance");
    }
  };

  const runLighthouse = async () => {
    const url = lighthouseUrl.trim();
    if (!url) {
      toast.error("Enter a URL");
      return;
    }
    setLighthouseLoading(true);
    setLighthouseResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/performance/lighthouse/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, form_factor: lighthouseFormFactor, timeout_seconds: 120 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Lighthouse run failed");
      setLighthouseResult(data);
      toast.success("Lighthouse run completed");
    } catch (e: any) {
      toast.error(e?.message || "Lighthouse run failed");
      setLighthouseResult({ success: false, error: e?.message });
    } finally {
      setLighthouseLoading(false);
    }
  };

  useEffect(() => {
    loadSystemMetrics();
    // Poll system metrics every 5 seconds
    metricsIntervalRef.current = setInterval(loadSystemMetrics, 5000);
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      if (testIntervalRef.current) clearInterval(testIntervalRef.current);
      if (serverMetricsIntervalRef.current) clearInterval(serverMetricsIntervalRef.current);
    };
  }, []);

  // Protocol capture functions
  const startProtocolCapture = async () => {
    try {
      const recordingId = `protocol_${Date.now()}`;
      const response = await fetch(`${API_BASE_URL}/api/protocol-recording/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: recordingId,
          name: `Load Test Protocol Capture`,
          base_url: customConfig.baseUrl
        })
      });
      
      if (response.ok) {
        setProtocolRecording({
          recordingId,
          isActive: true,
          totalRequests: 0,
          totalBytes: 0
        });
        toast.success("🔴 Protocol capture started - all HTTP traffic will be recorded");
      }
    } catch (error) {
      console.error("Failed to start protocol capture:", error);
      toast.error("Failed to start protocol capture");
    }
  };

  const stopProtocolCapture = async () => {
    if (!protocolRecording) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/protocol-recording/stop/${protocolRecording.recordingId}`, {
        method: "POST"
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`📊 Protocol capture stopped: ${data.summary?.total_requests || 0} requests captured`);
        setProtocolRecording(null);
      }
    } catch (error) {
      console.error("Failed to stop protocol capture:", error);
    }
  };

  // Server monitoring functions
  const startServerMonitoring = async () => {
    try {
      // Add server to monitor
      await fetch(`${API_BASE_URL}/api/srm/servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: "target_server",
          server_type: targetServerConfig.serverType,
          host: targetServerConfig.host,
          port: targetServerConfig.port,
          username: targetServerConfig.username || undefined,
          password: targetServerConfig.password || undefined
        })
      });

      // Start monitoring
      await fetch(`${API_BASE_URL}/api/srm/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_seconds: 2 })
      });

      setServerMonitoringEnabled(true);
      
      // Poll server metrics
      serverMetricsIntervalRef.current = setInterval(async () => {
        await loadServerCpuMetrics();
      }, 2000);
      
      toast.success("📡 Server resource monitoring started");
    } catch (error) {
      console.error("Failed to start server monitoring:", error);
      toast.error("Failed to start server monitoring");
    }
  };

  const stopServerMonitoring = async () => {
    try {
      if (serverMetricsIntervalRef.current) {
        clearInterval(serverMetricsIntervalRef.current);
        serverMetricsIntervalRef.current = null;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/srm/stop`, {
        method: "POST"
      });
      
      if (response.ok) {
        const data = await response.json();
        setServerMonitoringEnabled(false);
        toast.success("Server monitoring stopped - summary available in results");
      }
    } catch (error) {
      console.error("Failed to stop server monitoring:", error);
    }
  };

  const loadServerCpuMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srm/current`);
      if (response.ok) {
        const data = await response.json();
        const serverData = data.servers?.target_server;
        if (serverData && !serverData.error) {
          setServerCpuMetrics({
            cpu_percent: serverData.cpu_percent || 0,
            memory_percent: serverData.memory_percent || 0,
            disk_percent: serverData.disk_percent || 0,
            network_sent_mb: serverData.network_sent_mb || 0,
            network_recv_mb: serverData.network_recv_mb || 0,
            load_average_1m: serverData.load_average,
            process_count: serverData.process_count,
            top_processes: serverData.top_processes
          });

          // Check for warnings
          const warnings: string[] = [];
          if (serverData.cpu_percent > 80) warnings.push(`⚠️ HIGH CPU: ${serverData.cpu_percent.toFixed(1)}%`);
          if (serverData.memory_percent > 85) warnings.push(`⚠️ HIGH MEMORY: ${serverData.memory_percent.toFixed(1)}%`);
          if (serverData.disk_percent > 90) warnings.push(`⚠️ LOW DISK: ${serverData.disk_percent.toFixed(1)}% used`);
          setServerHealthWarnings(warnings);
        }
      }
    } catch (error) {
      // Silent fail for polling
    }
  };

  const recordResponseTimeToServer = async (responseTimeMs: number, transactionName?: string) => {
    if (!serverMonitoringEnabled) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/srm/record-response-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response_time_ms: responseTimeMs,
          transaction_name: transactionName,
          status: "pass"
        })
      });
    } catch (error) {
      // Silent fail
    }
  };

  const loadSystemMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/system-metrics`);
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data.metrics);
      }
    } catch (error) {
      // Silent fail for metrics
    }
  };

  // Run actual load test using the frontend (in-browser = quick validation only)
  const runLoadTest = async (scenario?: typeof QUICK_START_SCENARIOS[0]) => {
    const defaultEndpoints = recorderEndpoints.length > 0
      ? recorderEndpoints
      : [{ method: "GET" as const, path: "/api/products", weight: 100 }];
    let virtualUsers = scenario?.virtualUsers ?? customConfig.virtualUsers;
    if (virtualUsers > MAX_BROWSER_VUS) {
      toast.warning(`In-browser runner capped at ${MAX_BROWSER_VUS} VUs. Use Go runner or k6 for ${virtualUsers}+ VUs.`);
      virtualUsers = MAX_BROWSER_VUS;
    }
    const config = scenario
      ? { ...scenario, virtualUsers: Math.min(scenario.virtualUsers, MAX_BROWSER_VUS) }
      : { virtualUsers, duration: customConfig.duration, rampUp: customConfig.rampUp, endpoints: defaultEndpoints };
    
    const baseUrl = customConfig.baseUrl || ECOMMERCE_TEST_URL;
    
    // Check if target is reachable (try /health then base URL)
    try {
      let ok = false;
      try {
        const healthCheck = await fetch(`${baseUrl}/health`);
        ok = healthCheck.ok;
      } catch (_) {}
      if (!ok) {
        const rootCheck = await fetch(baseUrl, { method: "HEAD" }).catch(() => fetch(baseUrl));
        ok = rootCheck?.ok ?? false;
      }
      if (!ok) throw new Error("Target not reachable");
    } catch (error) {
      toast.error(`Cannot connect to ${baseUrl}. Make sure the test website is running.`);
      return;
    }

    setIsRunning(true);
    const testId = `test_${Date.now()}`;
    
    const initialMetrics: TestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      activeUsers: 0,
      elapsedTime: 0
    };

    setCurrentTest({
      testId,
      status: "running",
      metrics: initialMetrics,
      responseTimeHistory: [],
      rpsHistory: [],
      errorHistory: [],
      cpuHistory: [],
      memoryHistory: []
    });

    // Start protocol capture if enabled
    if (protocolCaptureEnabled && !protocolRecording) {
      await startProtocolCapture();
    }

    // Start server monitoring if enabled
    if (serverMonitoringEnabled && !serverMetricsIntervalRef.current) {
      await startServerMonitoring();
    }

    toast.success(`🚀 Load test started: ${scenario?.name || "Custom Test"}`);

    // Simulate load test execution with real HTTP calls
    const startTime = Date.now();
    const responseTimes: number[] = [];
    let requestCount = 0;
    let successCount = 0;
    let failCount = 0;
    let currentUsers = 0;
    
    const endpoints = scenario?.endpoints || config.endpoints || [];
    const totalWeight = endpoints.reduce((sum, e) => sum + (e.weight || 1), 0);

    // Weighted endpoint selection
    const selectEndpoint = () => {
      const rand = Math.random() * totalWeight;
      let cumulative = 0;
      for (const ep of endpoints) {
        cumulative += ep.weight || 1;
        if (rand <= cumulative) return ep;
      }
      return endpoints[0];
    };

    // Make HTTP requests and capture for protocol recording
    const makeRequest = async () => {
      const endpoint = selectEndpoint();
      const url = `${baseUrl}${endpoint.path}`;
      const reqStart = performance.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        const response = await fetch(url, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" }
        });
        const reqEnd = performance.now();
        const duration = reqEnd - reqStart;
        
        responseTimes.push(duration);
        requestCount++;
        
        const success = response.ok;
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        
        // Send to protocol recording if enabled
        if (protocolCaptureEnabled && protocolRecording?.recordingId) {
          try {
            // Get response headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              responseHeaders[key] = value;
            });
            
            // Send captured request to protocol recorder
            await fetch(`${API_BASE_URL}/api/protocol-recording/request/${protocolRecording.recordingId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                request_id: requestId,
                timestamp: reqStart,
                method: endpoint.method,
                url: url,
                headers: { "Content-Type": "application/json" },
                status_code: response.status,
                response_headers: responseHeaders,
                response_size: parseInt(response.headers.get("content-length") || "0"),
                duration_ms: duration,
                ttfb_ms: duration * 0.3, // Approximate TTFB
                request_type: "fetch"
              })
            }).catch(() => {}); // Silent fail - don't block load test
            
            // Update protocol recording stats
            setProtocolRecording(prev => prev ? {
              ...prev,
              totalRequests: (prev.totalRequests || 0) + 1,
              totalBytes: (prev.totalBytes || 0) + parseInt(response.headers.get("content-length") || "0")
            } : null);
          } catch {
            // Silent fail - protocol capture shouldn't break load test
          }
        }
        
        return { success, duration };
      } catch (error) {
        const reqEnd = performance.now();
        const duration = reqEnd - reqStart;
        responseTimes.push(duration);
        requestCount++;
        failCount++;
        
        // Capture failed request too
        if (protocolCaptureEnabled && protocolRecording?.recordingId) {
          try {
            await fetch(`${API_BASE_URL}/api/protocol-recording/request/${protocolRecording.recordingId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                request_id: requestId,
                timestamp: reqStart,
                method: endpoint.method,
                url: url,
                headers: { "Content-Type": "application/json" },
                status_code: 0,
                duration_ms: duration,
                request_type: "fetch",
                error: error instanceof Error ? error.message : "Request failed"
              })
            }).catch(() => {});
          } catch {
            // Silent fail
          }
        }
        
        return { success: false, duration };
      }
    };

    // Calculate percentiles
    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    // Update metrics periodically
    testIntervalRef.current = setInterval(async () => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Ramp up users
      const rampUpTime = scenario?.rampUp || config.rampUp || 10;
      const maxUsers = scenario?.virtualUsers || config.virtualUsers || 50;
      currentUsers = Math.min(maxUsers, Math.floor((elapsed / rampUpTime) * maxUsers));
      
      // Each virtual user makes concurrent requests
      const requestPromises = [];
      for (let i = 0; i < Math.max(1, currentUsers / 5); i++) {
        requestPromises.push(makeRequest());
      }
      await Promise.all(requestPromises);
      
      // Update metrics
      const metrics: TestMetrics = {
        totalRequests: requestCount,
        successfulRequests: successCount,
        failedRequests: failCount,
        avgResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
          : 0,
        p50ResponseTime: percentile(responseTimes, 50),
        p95ResponseTime: percentile(responseTimes, 95),
        p99ResponseTime: percentile(responseTimes, 99),
        requestsPerSecond: elapsed > 0 ? requestCount / elapsed : 0,
        errorRate: requestCount > 0 ? (failCount / requestCount) * 100 : 0,
        activeUsers: currentUsers,
        elapsedTime: elapsed
      };

      // Record response time to server for correlation
      if (serverMonitoringEnabled && responseTimes.length > 0) {
        const avgRecentTime = responseTimes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(responseTimes.length, 10);
        recordResponseTimeToServer(avgRecentTime, scenario?.name || "Custom Test");
      }

      setCurrentTest(prev => prev ? {
        ...prev,
        metrics,
        responseTimeHistory: [...(prev.responseTimeHistory || []).slice(-30), metrics.avgResponseTime],
        rpsHistory: [...(prev.rpsHistory || []).slice(-30), metrics.requestsPerSecond],
        errorHistory: [...(prev.errorHistory || []).slice(-30), metrics.errorRate],
        cpuHistory: [...(prev.cpuHistory || []).slice(-30), serverCpuMetrics?.cpu_percent || 0],
        memoryHistory: [...(prev.memoryHistory || []).slice(-30), serverCpuMetrics?.memory_percent || 0]
      } : null);

      // Check if test should end
      const duration = scenario?.duration || config.duration || 60;
      if (elapsed >= duration) {
        stopTest(metrics);
      }
    }, 1000);

    setActiveTab("live");
  };

  const stopTest = async (finalMetrics?: TestMetrics) => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    
    setIsRunning(false);

    // Stop protocol capture if running
    if (protocolRecording) {
      await stopProtocolCapture();
    }

    // Stop server monitoring if running
    if (serverMonitoringEnabled && serverMetricsIntervalRef.current) {
      await stopServerMonitoring();
    }
    
    if (currentTest) {
      const completedTest = {
        ...currentTest,
        status: "completed" as const,
        metrics: finalMetrics || currentTest.metrics,
        completedAt: new Date().toISOString()
      };
      
      setCurrentTest(completedTest);
      setTestHistory(prev => [completedTest, ...prev.slice(0, 9)]);
      toast.success(`✅ Load test completed! ${completedTest.metrics.totalRequests} requests made.`);
    }
  };

  const forceStopTest = () => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    setIsRunning(false);
    if (currentTest) {
      setCurrentTest({ ...currentTest, status: "stopped" });
    }
    toast.info("⏹️ Test stopped by user");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gauge className="w-8 h-8 text-orange-500" />
            Performance Testing
          </h1>
          <p className="text-muted-foreground mt-2">
            Real load testing against your e-commerce demo site
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-lg px-4 py-2">
            Target: {customConfig.baseUrl}
          </Badge>
          {isRunning && (
            <Badge variant="default" className="text-lg px-4 py-2 bg-green-600 animate-pulse">
              <Activity className="w-4 h-4 mr-2" />
              Test Running
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={isRunning ? "border-green-500 bg-green-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Virtual Users</p>
                <p className="text-3xl font-bold">
                  {currentTest?.metrics.activeUsers || 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={isRunning ? "border-green-500 bg-green-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Requests/sec</p>
                <p className="text-3xl font-bold">
                  {currentTest?.metrics.requestsPerSecond.toFixed(1) || "0.0"}
                </p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={isRunning ? "border-green-500 bg-green-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-3xl font-bold">
                  {currentTest?.metrics.avgResponseTime.toFixed(0) || "0"}
                  <span className="text-sm font-normal">ms</span>
                </p>
              </div>
              <Timer className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={currentTest && currentTest.metrics.errorRate > 5 ? "border-red-500 bg-red-500/5" : isRunning ? "border-green-500 bg-green-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className={`text-3xl font-bold ${currentTest && currentTest.metrics.errorRate > 5 ? "text-red-500" : ""}`}>
                  {currentTest?.metrics.errorRate.toFixed(2) || "0.00"}%
                </p>
              </div>
              <AlertCircle className={`w-8 h-8 ${currentTest && currentTest.metrics.errorRate > 5 ? "text-red-500" : "text-gray-400"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="quickstart">
            <Rocket className="w-4 h-4 mr-2" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger value="record">
            <Activity className="w-4 h-4 mr-2" />
            Record
            {protocolCaptureEnabled && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="live">
            <Activity className="w-4 h-4 mr-2" />
            Live Test
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            Config
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart3 className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="system">
            <Cpu className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
          <TabsTrigger value="lighthouse">
            <Gauge className="w-4 h-4 mr-2" />
            Lighthouse
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Settings className="w-4 h-4 mr-2" />
            Setup
          </TabsTrigger>
        </TabsList>

        {/* From Recorder: pending load test requests */}
        {fromRecorderRequests.length > 0 && (
          <Alert className="border-blue-500 bg-blue-500/10">
            <Rocket className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
              <span>
                <strong>From Recorder:</strong> {fromRecorderRequests.length} request(s) ready for load testing.
                Use these to run a load test with the same endpoints you recorded.
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={useRecorderRequests}>
                  Use these requests
                </Button>
                <Button size="sm" variant="outline" onClick={dismissRecorderRequests}>
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Record Tab - Protocol Capture & Server Monitoring */}
        <TabsContent value="record" className="space-y-4">
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              <strong>Protocol Recording & Server Monitoring:</strong> Capture HTTP traffic and monitor target server CPU/memory during load tests for comprehensive analysis.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            {/* Protocol Capture Card */}
            <Card className={protocolCaptureEnabled ? "border-red-500 bg-red-500/5" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-violet-500" />
                  Protocol Capture
                  {protocolCaptureEnabled && (
                    <Badge variant="destructive" className="animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-1" />
                      ENABLED
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Capture all HTTP/HTTPS traffic during load tests for detailed protocol-level analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="protocol-capture">Enable Protocol Capture</Label>
                    <p className="text-xs text-muted-foreground">
                      Records request/response details, headers, timing
                    </p>
                  </div>
                  <Switch
                    id="protocol-capture"
                    checked={protocolCaptureEnabled}
                    onCheckedChange={(checked) => {
                      setProtocolCaptureEnabled(checked);
                      if (checked) {
                        toast.success("Protocol capture enabled - will start with next test");
                      } else {
                        toast.info("Protocol capture disabled");
                      }
                    }}
                  />
                </div>

                {protocolCaptureEnabled && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-semibold">What gets captured:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ All HTTP requests & responses</li>
                      <li>✓ Request/response headers</li>
                      <li>✓ Response times per request</li>
                      <li>✓ Request body & response body</li>
                      <li>✓ Auto-detected correlation values (tokens, session IDs)</li>
                      <li>✓ WebSocket messages (if enabled)</li>
                    </ul>
                  </div>
                )}

                {protocolRecording && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording Active
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      ID: {protocolRecording.recordingId}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Requests: {protocolRecording.totalRequests} | Bytes: {protocolRecording.totalBytes}
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          try {
                            const response = await fetch(`${API_BASE_URL}/api/protocol-recording/export-har/${protocolRecording.recordingId}`, {
                              method: "POST"
                            });
                            if (response.ok) {
                              const data = await response.json();
                              // Download HAR file
                              const blob = new Blob([JSON.stringify(data.har, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `loadtest_${protocolRecording.recordingId}.har`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast.success("HAR file exported!");
                            }
                          } catch (error) {
                            toast.error("Failed to export HAR");
                          }
                        }}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Export HAR
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          try {
                            const response = await fetch(`${API_BASE_URL}/api/protocol-recording/${protocolRecording.recordingId}`);
                            if (response.ok) {
                              const data = await response.json();
                              console.log("Protocol Recording Data:", data);
                              toast.success(`Recording has ${data.recording?.total_requests || 0} requests. Check console for details.`);
                            }
                          } catch (error) {
                            toast.error("Failed to fetch recording details");
                          }
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Server Monitoring Card */}
            <Card className={serverMonitoringEnabled ? "border-green-500 bg-green-500/5" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-500" />
                  Server CPU Monitoring
                  {serverMonitoringEnabled && (
                    <Badge variant="default" className="bg-green-500">
                      MONITORING
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Monitor target server CPU, memory, disk during load tests to detect bottlenecks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="server-monitoring">Enable Server Monitoring</Label>
                    <p className="text-xs text-muted-foreground">
                      Correlates response time with server resources
                    </p>
                  </div>
                  <Switch
                    id="server-monitoring"
                    checked={serverMonitoringEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        startServerMonitoring();
                      } else {
                        stopServerMonitoring();
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Server Type</Label>
                  <Select
                    value={targetServerConfig.serverType}
                    onValueChange={(value: "linux_ssh" | "windows_wmi" | "prometheus" | "aws_cloudwatch") => 
                      setTargetServerConfig({ ...targetServerConfig, serverType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prometheus">Prometheus Endpoint</SelectItem>
                      <SelectItem value="linux_ssh">Linux (SSH)</SelectItem>
                      <SelectItem value="windows_wmi">Windows (WMI/PowerShell)</SelectItem>
                      <SelectItem value="aws_cloudwatch">AWS CloudWatch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Host</Label>
                    <Input
                      value={targetServerConfig.host}
                      onChange={(e) => setTargetServerConfig({ ...targetServerConfig, host: e.target.value })}
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input
                      type="number"
                      value={targetServerConfig.port}
                      onChange={(e) => setTargetServerConfig({ ...targetServerConfig, port: parseInt(e.target.value) || 22 })}
                    />
                  </div>
                </div>

                {(targetServerConfig.serverType === "linux_ssh" || targetServerConfig.serverType === "windows_wmi") && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={targetServerConfig.username}
                        onChange={(e) => setTargetServerConfig({ ...targetServerConfig, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={targetServerConfig.password}
                        onChange={(e) => setTargetServerConfig({ ...targetServerConfig, password: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {serverCpuMetrics && serverMonitoringEnabled && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 space-y-2">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      Live Server Metrics
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">CPU</p>
                        <p className={`text-lg font-bold ${serverCpuMetrics.cpu_percent > 80 ? 'text-red-500' : 'text-green-600'}`}>
                          {serverCpuMetrics.cpu_percent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Memory</p>
                        <p className={`text-lg font-bold ${serverCpuMetrics.memory_percent > 85 ? 'text-red-500' : 'text-green-600'}`}>
                          {serverCpuMetrics.memory_percent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Disk</p>
                        <p className={`text-lg font-bold ${serverCpuMetrics.disk_percent > 90 ? 'text-red-500' : 'text-green-600'}`}>
                          {serverCpuMetrics.disk_percent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {serverHealthWarnings.length > 0 && (
                  <div className="space-y-1">
                    {serverHealthWarnings.map((warning, idx) => (
                      <Alert key={idx} variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{warning}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Benefits Section */}
          <Card>
            <CardHeader>
              <CardTitle>Why Use Protocol Capture + Server Monitoring?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">🔍 Find Root Causes</h4>
                  <p className="text-muted-foreground">
                    When response times spike, see if it's CPU-bound, memory pressure, or external dependencies.
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">📊 Correlation Analysis</h4>
                  <p className="text-muted-foreground">
                    Automatically correlate response times with server metrics to identify bottlenecks.
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">🚨 Early Warning</h4>
                  <p className="text-muted-foreground">
                    Get alerts when server resources approach critical levels during testing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Start Tab */}
        <TabsContent value="quickstart" className="space-y-4">
          <Alert>
            <Rocket className="h-4 w-4" />
            <AlertDescription>
              <strong>Quick validation (browser):</strong> Max {MAX_BROWSER_VUS} VUs in-browser. For real load (50–10,000+ VUs) use <strong>Setup</strong> tab → Go runner or k6.
            </AlertDescription>
          </Alert>
          <Alert className="border-muted">
            <AlertDescription>
              Pre-configured scenarios (e.g. e-commerce demo at <code>{ECOMMERCE_TEST_URL}</code>). Set Base URL in Config for your target.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUICK_START_SCENARIOS.map((scenario) => (
              <Card 
                key={scenario.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedScenario === scenario.id ? "border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => setSelectedScenario(scenario.id)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Virtual Users:</span>
                      <Badge variant="outline">{scenario.virtualUsers}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <Badge variant="outline">{scenario.duration}s</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ramp Up:</span>
                      <Badge variant="outline">{scenario.rampUp}s</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Endpoints:</span>
                      <Badge variant="outline">{scenario.endpoints.length}</Badge>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      runLoadTest(scenario);
                    }}
                    disabled={isRunning}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Run Test
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {isRunning && (
            <Card className="border-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                    <div>
                      <p className="font-semibold">Test in Progress</p>
                      <p className="text-sm text-muted-foreground">
                        Elapsed: {currentTest?.metrics.elapsedTime.toFixed(0)}s | 
                        Total Requests: {currentTest?.metrics.totalRequests}
                      </p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={forceStopTest}>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Live Test Tab */}
        <TabsContent value="live" className="space-y-4">
          {currentTest ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Test: {currentTest.testId}
                  <Badge variant={currentTest.status === "running" ? "default" : "secondary"} className="ml-2">
                    {currentTest.status}
                  </Badge>
                </h2>
                {currentTest.status === "running" && (
                  <Button variant="destructive" onClick={forceStopTest}>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Test
                  </Button>
                )}
              </div>

              {/* Detailed Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Requests</p>
                    <p className="text-2xl font-bold text-blue-600">{currentTest.metrics.totalRequests}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Successful</p>
                    <p className="text-2xl font-bold text-green-600">{currentTest.metrics.successfulRequests}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{currentTest.metrics.failedRequests}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Elapsed Time</p>
                    <p className="text-2xl font-bold">{currentTest.metrics.elapsedTime.toFixed(1)}s</p>
                  </CardContent>
                </Card>
              </div>

              {/* Response Time Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Response Time Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className="text-xl font-bold">{currentTest.metrics.avgResponseTime.toFixed(0)}ms</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">P50 (Median)</p>
                      <p className="text-xl font-bold">{currentTest.metrics.p50ResponseTime.toFixed(0)}ms</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">P95</p>
                      <p className="text-xl font-bold text-orange-600">{currentTest.metrics.p95ResponseTime.toFixed(0)}ms</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">P99</p>
                      <p className="text-xl font-bold text-red-600">{currentTest.metrics.p99ResponseTime.toFixed(0)}ms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Charts (Simplified) */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Response Time History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 flex items-end gap-1">
                      {currentTest.responseTimeHistory.map((rt, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-500 rounded-t transition-all"
                          style={{ 
                            height: `${Math.min(100, (rt / Math.max(...currentTest.responseTimeHistory, 1)) * 100)}%`,
                            minHeight: "4px"
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Requests/sec History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-32 flex items-end gap-1">
                      {currentTest.rpsHistory.map((rps, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-green-500 rounded-t transition-all"
                          style={{ 
                            height: `${Math.min(100, (rps / Math.max(...currentTest.rpsHistory, 1)) * 100)}%`,
                            minHeight: "4px"
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Server Resource Charts - CPU & Memory */}
              {serverMonitoringEnabled && currentTest.cpuHistory && currentTest.cpuHistory.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-orange-500/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-orange-500" />
                        Server CPU History
                        {serverCpuMetrics && (
                          <Badge variant={serverCpuMetrics.cpu_percent > 80 ? "destructive" : "secondary"}>
                            {serverCpuMetrics.cpu_percent.toFixed(1)}%
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-end gap-1">
                        {currentTest.cpuHistory.map((cpu, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-t transition-all ${cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ 
                              height: `${Math.min(100, cpu)}%`,
                              minHeight: "4px"
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0%</span>
                        <span className="text-orange-500">80% threshold</span>
                        <span>100%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-500/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-purple-500" />
                        Server Memory History
                        {serverCpuMetrics && (
                          <Badge variant={serverCpuMetrics.memory_percent > 85 ? "destructive" : "secondary"}>
                            {serverCpuMetrics.memory_percent.toFixed(1)}%
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 flex items-end gap-1">
                        {currentTest.memoryHistory.map((mem, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-t transition-all ${mem > 85 ? 'bg-red-500' : mem > 70 ? 'bg-purple-500' : 'bg-blue-500'}`}
                            style={{ 
                              height: `${Math.min(100, mem)}%`,
                              minHeight: "4px"
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0%</span>
                        <span className="text-purple-500">85% threshold</span>
                        <span>100%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Server Health Warnings during test */}
              {isRunning && serverHealthWarnings.length > 0 && (
                <Card className="border-red-500 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Server Health Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {serverHealthWarnings.map((warning, idx) => (
                        <div key={idx} className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm text-red-700 dark:text-red-300">
                          {warning}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2">
                        ⚠️ High server resource usage detected - your load test may be approaching the server's capacity limit.
                        Consider stopping the test to prevent server crash.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Activity className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No Active Test</h3>
              <p className="text-muted-foreground mb-4">Start a load test from the Quick Start tab to see live metrics</p>
              <Button onClick={() => setActiveTab("quickstart")}>
                <Rocket className="w-4 h-4 mr-2" />
                Go to Quick Start
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Custom Config Tab */}
        <TabsContent value="config" className="space-y-4">
          {recorderEndpoints.length > 0 && (
            <Alert className="border-blue-500/50 bg-blue-500/5">
              <Rocket className="h-4 w-4" />
              <AlertDescription>
                <strong>From Recorder:</strong> Running with {recorderEndpoints.length} endpoint(s). Clear by running a Quick Start scenario or Dismiss in the banner above.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Custom Test Configuration</CardTitle>
              <CardDescription>Configure a custom load test with your own parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target Base URL</Label>
                <Input
                  value={customConfig.baseUrl}
                  onChange={(e) => setCustomConfig({ ...customConfig, baseUrl: e.target.value })}
                  placeholder="http://localhost:8002"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Virtual Users (browser max {MAX_BROWSER_VUS})</Label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_BROWSER_VUS}
                    value={Math.min(customConfig.virtualUsers, MAX_BROWSER_VUS)}
                    onChange={(e) => setCustomConfig({ ...customConfig, virtualUsers: Math.min(parseInt(e.target.value) || 10, MAX_BROWSER_VUS) })}
                  />
                  <p className="text-xs text-muted-foreground">For more VUs use Go runner or k6 (Setup tab).</p>
                </div>
                <div className="space-y-2">
                  <Label>Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={customConfig.duration}
                    onChange={(e) => setCustomConfig({ ...customConfig, duration: parseInt(e.target.value) || 60 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ramp Up Time (seconds)</Label>
                  <Input
                    type="number"
                    value={customConfig.rampUp}
                    onChange={(e) => setCustomConfig({ ...customConfig, rampUp: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Think Time (ms)</Label>
                  <Input
                    type="number"
                    value={customConfig.thinkTime}
                    onChange={(e) => setCustomConfig({ ...customConfig, thinkTime: parseInt(e.target.value) || 1000 })}
                  />
                </div>
              </div>

              <Button onClick={() => runLoadTest()} disabled={isRunning} className="w-full">
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Custom Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compare runs (last vs baseline)</CardTitle>
              <CardDescription>Compare two runs for regression detection. Uses backend run manager (POST /runs/compare).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Run metadata and time-series are stored by the backend. Use API runs (POST /api/performance/tests/run) then GET /api/performance/runs and POST /api/performance/runs/compare with run_ids for trend comparison.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/performance/runs?limit=10`);
                    const data = await res.json();
                    if (data.runs?.length >= 2) {
                      const runIds = [data.runs[0].run_id, data.runs[1].run_id];
                      const compareRes = await fetch(`${API_BASE_URL}/api/performance/runs/compare`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ run_ids: runIds }),
                      });
                      const compareData = await compareRes.json();
                      toast.success(compareData.comparison ? "Comparison loaded. Check network response for details." : "No runs to compare yet.");
                    } else {
                      toast.info("Run at least 2 tests via API to compare (GET /runs, POST /runs/compare).");
                    }
                  } catch (e) {
                    toast.error("Failed to compare runs");
                  }
                }}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Compare last 2 runs (API)
              </Button>
            </CardContent>
          </Card>
          {testHistory.length > 0 ? (
            <div className="space-y-4">
              {testHistory.map((test, index) => (
                <Card key={test.testId || index}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{test.testId}</p>
                        <p className="text-sm text-muted-foreground">
                          Completed: {test.completedAt ? new Date(test.completedAt).toLocaleString() : "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="text-muted-foreground">Requests</p>
                          <p className="font-semibold">{test.metrics?.totalRequests || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Avg RT</p>
                          <p className="font-semibold">{test.metrics?.avgResponseTime?.toFixed(0) || 0}ms</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Error Rate</p>
                          <p className={`font-semibold ${test.metrics?.errorRate > 5 ? "text-red-500" : "text-green-500"}`}>
                            {test.metrics?.errorRate?.toFixed(2) || 0}%
                          </p>
                        </div>
                        <Badge variant={test.status === "completed" ? "default" : "secondary"}>
                          {test.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No Test History</h3>
              <p className="text-muted-foreground">Run some tests to see history here</p>
            </div>
          )}
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Monitor system resources during load tests</CardDescription>
            </CardHeader>
            <CardContent>
              {systemMetrics?.current ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        CPU Usage
                      </span>
                      <span className="font-semibold">{systemMetrics.current.cpu_percent?.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemMetrics.current.cpu_percent || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        Memory Usage
                      </span>
                      <span className="font-semibold">{systemMetrics.current.memory_percent?.toFixed(1)}%</span>
                    </div>
                    <Progress value={systemMetrics.current.memory_percent || 0} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Network Sent</p>
                        <p className="font-semibold">{systemMetrics.current.network_sent_mb?.toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Network Recv</p>
                        <p className="font-semibold">{systemMetrics.current.network_recv_mb?.toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">System metrics not available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lighthouse Tab - Core Web Vitals & Performance score */}
        <TabsContent value="lighthouse" className="space-y-4">
          <Alert>
            <Gauge className="h-4 w-4" />
            <AlertDescription>
              <strong>Lighthouse:</strong> Run Google Lighthouse against any URL to get Performance score and Core Web Vitals (LCP, FCP, CLS, TBT, TTI). Integrates with PWA and load testing.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Run Lighthouse</CardTitle>
              <CardDescription>Enter a URL and run Lighthouse (requires Node.js and npx on the backend)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={lighthouseUrl}
                    onChange={(e) => setLighthouseUrl(e.target.value)}
                    placeholder="https://your-pwa.example.com"
                  />
                </div>
                <div className="space-y-2 w-32">
                  <Label>Device</Label>
                  <Select value={lighthouseFormFactor} onValueChange={(v: "desktop" | "mobile") => setLighthouseFormFactor(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">Desktop</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runLighthouse} disabled={lighthouseLoading}>
                  {lighthouseLoading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> Run Lighthouse</>
                  )}
                </Button>
              </div>
              {lighthouseResult && (
                <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
                  {lighthouseResult.error ? (
                    <p className="text-destructive">{lighthouseResult.error}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-background rounded">
                          <p className="text-xs text-muted-foreground">Performance</p>
                          <p className="text-2xl font-bold">
                            {lighthouseResult.performance_score != null
                              ? Math.round((lighthouseResult.performance_score as number) * 100)
                              : "—"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-background rounded">
                          <p className="text-xs text-muted-foreground">LCP</p>
                          <p className="text-xl font-bold">
                            {lighthouseResult.lcp_ms != null ? `${(lighthouseResult.lcp_ms / 1000).toFixed(2)}s` : "—"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-background rounded">
                          <p className="text-xs text-muted-foreground">FCP</p>
                          <p className="text-xl font-bold">
                            {lighthouseResult.fcp_ms != null ? `${(lighthouseResult.fcp_ms / 1000).toFixed(2)}s` : "—"}
                          </p>
                        </div>
                        <div className="text-center p-3 bg-background rounded">
                          <p className="text-xs text-muted-foreground">CLS</p>
                          <p className="text-xl font-bold">
                            {lighthouseResult.cls != null ? lighthouseResult.cls.toFixed(3) : "—"}
                          </p>
                        </div>
                      </div>
                      {(lighthouseResult.tbt_ms != null || lighthouseResult.tti_ms != null) && (
                        <div className="flex gap-4 text-sm">
                          {lighthouseResult.tbt_ms != null && (
                            <span><strong>TBT:</strong> {(lighthouseResult.tbt_ms / 1000).toFixed(2)}s</span>
                          )}
                          {lighthouseResult.tti_ms != null && (
                            <span><strong>TTI:</strong> {(lighthouseResult.tti_ms / 1000).toFixed(2)}s</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Tab - Step-by-step: Go runner, k6, Lighthouse, Server metrics */}
        <TabsContent value="setup" className="space-y-4">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <strong>Enterprise setup:</strong> Go runner (load engine), k6, Lighthouse, and Server Resource Monitoring (SRM). Follow steps to integrate with your environment.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>1. Go Runner (load engine)</CardTitle>
              <CardDescription>Optional: run the Go-based load runner for high-scale tests. Backend compiles scenarios to JSON; Go runner executes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Install:</strong> Build from <code>runner/</code>: <code>go build -o runner ./cmd/runner</code>. Or use the in-browser load test (no Go required).</p>
              <p><strong>Start:</strong> <code>./runner --port 50051</code>. Backend discovers on port 50051 or use POST /api/performance/runner/register.</p>
              <p><strong>API:</strong> GET /api/performance/runner/status, POST /api/performance/runner/start-local, POST /api/performance/runner/discover.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. k6 (optional)</CardTitle>
              <CardDescription>Export HAR or use compiled scenario; run k6 externally for maximum scale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Install:</strong> <a href="https://k6.io/docs/getting-started/installation/" target="_blank" rel="noreferrer" className="text-primary underline">k6.io</a>.</p>
              <p><strong>Use:</strong> Record in Recorder with Load toggle → Quick Load Test → Perf tab uses requests. Or export HAR from Protocol Capture and run <code>k6 run script.js</code>.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Lighthouse (Core Web Vitals)</CardTitle>
              <CardDescription>Backend runs Lighthouse via npx. Ensure Node.js is installed on the backend host.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Install:</strong> Node.js on backend server. First run: <code>npx lighthouse &lt;url&gt;</code> will fetch Lighthouse. Or install globally: <code>npm i -g lighthouse</code>.</p>
              <p><strong>Use:</strong> Lighthouse tab in this page, or POST /api/performance/lighthouse/run with <code>{"{ \"url\": \"https://...\" }"}</code>. PWA: POST /api/performance/pwa/performance.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>4. Server-side metrics (SRM)</CardTitle>
              <CardDescription>Monitor target server CPU, memory, disk during load tests. Like LoadRunner SiteScope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Steps:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Record tab → Server CPU Monitoring → Add server (type: Prometheus / Linux SSH / Windows WMI / AWS CloudWatch). Set host, port, credentials if needed.</li>
                <li>Enable Server Monitoring → Start monitoring (POST /api/srm/start).</li>
                <li>Run a load test; backend can record response times via POST /api/srm/record-response-time.</li>
                <li>Stop monitoring → View correlation (GET /api/srm/correlation).</li>
              </ol>
              <p><strong>API:</strong> POST /api/srm/servers, POST /api/srm/start, POST /api/srm/stop, GET /api/srm/current, GET /api/srm/correlation.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
