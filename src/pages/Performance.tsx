import { useState, useEffect, useRef } from "react";
import { 
  Zap, Play, Square, BarChart3, TrendingUp, Clock, Users, AlertTriangle, CheckCircle, 
  RefreshCw, Download, ExternalLink, FileText, Settings, Bell, Calendar, 
  Activity, Database, Network, Layers, FileSpreadsheet, Gauge, AlertCircle,
  Rocket, Target, Timer, Server, Cpu, HardDrive, Wifi, PauseCircle
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
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/api-config";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Test website endpoints for quick-start scenarios
const ECOMMERCE_TEST_URL = "http://localhost:8002";

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
  
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSystemMetrics();
    // Poll system metrics every 5 seconds
    metricsIntervalRef.current = setInterval(loadSystemMetrics, 5000);
    return () => {
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
      if (testIntervalRef.current) clearInterval(testIntervalRef.current);
    };
  }, []);

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

  // Run actual load test using the frontend
  const runLoadTest = async (scenario?: typeof QUICK_START_SCENARIOS[0]) => {
    const config = scenario || {
      virtualUsers: customConfig.virtualUsers,
      duration: customConfig.duration,
      rampUp: customConfig.rampUp,
      endpoints: [{ method: "GET", path: "/api/products", weight: 100 }]
    };
    
    const baseUrl = customConfig.baseUrl || ECOMMERCE_TEST_URL;
    
    // Check if target is reachable
    try {
      const healthCheck = await fetch(`${baseUrl}/health`);
      if (!healthCheck.ok) throw new Error("Target not reachable");
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
      errorHistory: []
    });

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

    // Make HTTP requests
    const makeRequest = async () => {
      const endpoint = selectEndpoint();
      const url = `${baseUrl}${endpoint.path}`;
      const reqStart = performance.now();
      
      try {
        const response = await fetch(url, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" }
        });
        const reqEnd = performance.now();
        const duration = reqEnd - reqStart;
        
        responseTimes.push(duration);
        requestCount++;
        
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
        
        return { success: response.ok, duration };
      } catch (error) {
        const reqEnd = performance.now();
        const duration = reqEnd - reqStart;
        responseTimes.push(duration);
        requestCount++;
        failCount++;
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

      setCurrentTest(prev => prev ? {
        ...prev,
        metrics,
        responseTimeHistory: [...(prev.responseTimeHistory || []).slice(-30), metrics.avgResponseTime],
        rpsHistory: [...(prev.rpsHistory || []).slice(-30), metrics.requestsPerSecond],
        errorHistory: [...(prev.errorHistory || []).slice(-30), metrics.errorRate]
      } : null);

      // Check if test should end
      const duration = scenario?.duration || config.duration || 60;
      if (elapsed >= duration) {
        stopTest(metrics);
      }
    }, 1000);

    setActiveTab("live");
  };

  const stopTest = (finalMetrics?: TestMetrics) => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    
    setIsRunning(false);
    
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="quickstart">
            <Rocket className="w-4 h-4 mr-2" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger value="live">
            <Activity className="w-4 h-4 mr-2" />
            Live Test
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            Custom Config
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart3 className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="system">
            <Cpu className="w-4 h-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Quick Start Tab */}
        <TabsContent value="quickstart" className="space-y-4">
          <Alert>
            <Rocket className="h-4 w-4" />
            <AlertDescription>
              <strong>Quick Start:</strong> Run pre-configured load tests against the e-commerce demo site at <code>{ECOMMERCE_TEST_URL}</code>
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
                  <Label>Virtual Users</Label>
                  <Input
                    type="number"
                    value={customConfig.virtualUsers}
                    onChange={(e) => setCustomConfig({ ...customConfig, virtualUsers: parseInt(e.target.value) || 10 })}
                  />
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
      </Tabs>
    </div>
  );
}
