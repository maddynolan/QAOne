import { useState, useEffect } from "react";
import { Zap, Play, Square, BarChart3, TrendingUp, Clock, Users, AlertTriangle, CheckCircle, RefreshCw, Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/lib/api-config";

interface PerformanceScenario {
  scenario_id: string;
  name: string;
  description: string;
  steps: any[];
  flowstral_integration?: {
    session_id: string;
    project_id: string;
    imported_from_flowstral: boolean;
  };
}

interface TestRun {
  test_id: string;
  scenario_id: string;
  status: "running" | "completed" | "stopped" | "failed";
  virtual_users: number;
  duration_seconds: number;
  start_time: string;
  metrics?: {
    response_time_p50: number;
    response_time_p95: number;
    response_time_p99: number;
    throughput_rps: number;
    error_rate: number;
  };
}

export default function Performance() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<PerformanceScenario[]>([]);
  const [activeTests, setActiveTests] = useState<TestRun[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [testConfig, setTestConfig] = useState({
    virtual_users: 10,
    ramp_up_seconds: 60,
    duration_seconds: 300,
    think_time_ms: 2000,
    base_url: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const getApiKey = () => {
    return localStorage.getItem("api_key") || "";
  };

  useEffect(() => {
    loadScenarios();
    loadActiveTests();
  }, []);

  const loadScenarios = async () => {
    try {
      const apiKey = getApiKey();
      
      // Build headers - API key is optional for web UI access
      const headers: HeadersInit = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/performance/scenarios`, {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error("Failed to load scenarios:", error);
    }
  };

  const loadActiveTests = async () => {
    try {
      const apiKey = getApiKey();
      // TODO: Implement endpoint to get active tests
      // For now, use mock data
    } catch (error) {
      console.error("Failed to load active tests:", error);
    }
  };

  const createScenarioFromFlowstral = async (sessionId: string) => {
    try {
      const apiKey = getApiKey();
      
      // Build headers - API key is optional for web UI access
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/performance/scenarios/from-flowstral`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          scenario_name: `Flowstral Session ${sessionId.substring(0, 8)}`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create scenario");
      }

      const result = await response.json();
      toast.success("Performance scenario created from Flowstral");
      await loadScenarios();
      setSelectedScenario(result.scenario_id);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runTest = async () => {
    if (!selectedScenario) {
      toast.error("Please select a scenario");
      return;
    }

    if (!testConfig.base_url) {
      toast.error("Please enter a base URL");
      return;
    }

    try {
      const apiKey = getApiKey();
      
      // Build headers - API key is optional for web UI access
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      setIsRunning(true);

      const response = await fetch(`${API_BASE_URL}/api/performance/tests/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          scenario_id: selectedScenario,
          ...testConfig
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to start test");
      }

      const result = await response.json();
      toast.success(`Test started: ${result.test_id}`);
      await loadActiveTests();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const stopTest = async (testId: string) => {
    try {
      const apiKey = getApiKey();
      
      // Build headers - API key is optional for web UI access
      const headers: HeadersInit = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/performance/tests/${testId}/stop`, {
        method: "POST",
        headers
      });

      if (response.ok) {
        toast.success("Test stopped");
        await loadActiveTests();
      }
    } catch (error: any) {
      toast.error(`Failed to stop test: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Testing</h1>
          <p className="text-muted-foreground mt-2">
            Load testing and performance analysis with Flowstral integration
          </p>
        </div>
        <Button onClick={() => navigate("/flowstral")} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Import from Flowstral
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Scenarios</CardTitle>
            <CardDescription>Manage performance test scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No scenarios yet</p>
                <p className="text-sm mt-2">Import from Flowstral or create a new scenario</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario) => (
                  <div
                    key={scenario.scenario_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedScenario === scenario.scenario_id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedScenario(scenario.scenario_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{scenario.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {scenario.description || "No description"}
                        </p>
                        {scenario.flowstral_integration?.imported_from_flowstral && (
                          <Badge variant="outline" className="mt-2">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            From Flowstral
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary">{scenario.steps.length} steps</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Run Test</CardTitle>
            <CardDescription>Configure and execute performance test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://api.example.com"
                value={testConfig.base_url}
                onChange={(e) => setTestConfig({ ...testConfig, base_url: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="virtualUsers">Virtual Users</Label>
                <Input
                  id="virtualUsers"
                  type="number"
                  value={testConfig.virtual_users}
                  onChange={(e) => setTestConfig({ ...testConfig, virtual_users: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={testConfig.duration_seconds}
                  onChange={(e) => setTestConfig({ ...testConfig, duration_seconds: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rampUp">Ramp Up (seconds)</Label>
                <Input
                  id="rampUp"
                  type="number"
                  value={testConfig.ramp_up_seconds}
                  onChange={(e) => setTestConfig({ ...testConfig, ramp_up_seconds: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thinkTime">Think Time (ms)</Label>
                <Input
                  id="thinkTime"
                  type="number"
                  value={testConfig.think_time_ms}
                  onChange={(e) => setTestConfig({ ...testConfig, think_time_ms: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <Button
              onClick={runTest}
              disabled={!selectedScenario || isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {activeTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeTests.map((test) => (
                <div key={test.test_id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Test {test.test_id.substring(0, 8)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(test.start_time).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          test.status === "running"
                            ? "default"
                            : test.status === "completed"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {test.status}
                      </Badge>
                      {test.status === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => stopTest(test.test_id)}
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>

                  {test.metrics && (
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">P95 Response Time</p>
                        <p className="text-lg font-semibold">{test.metrics.response_time_p95}ms</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Throughput</p>
                        <p className="text-lg font-semibold">{test.metrics.throughput_rps} req/s</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Error Rate</p>
                        <p className="text-lg font-semibold">{(test.metrics.error_rate * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Virtual Users</p>
                        <p className="text-lg font-semibold">{test.virtual_users}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Flowstral Integration</CardTitle>
          <CardDescription>
            Import Flowstral recordings as performance test scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Record user flows in Flowstral, then convert them to performance test scenarios.
              This allows you to test real user behavior patterns under load.
            </p>
            <Button onClick={() => navigate("/flowstral")} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Go to Flowstral
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

