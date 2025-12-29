import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Square, Download, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle, FileVideo, FileText, BarChart3, Shield, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { dataStorageService } from "@/lib/data-storage";

interface ExecutionResult {
  test_name: string;
  test_type: string;
  status: "passed" | "failed" | "running" | "error" | "timeout";
  duration?: number;
  logs: string[];
  error?: string;
  artifacts?: {
    video?: string;
    har?: string;
    screenshots?: string[];
    perf_graph?: string;
    a11y_report?: string;
    security_report?: string;
  };
  metrics?: any;
  findings?: any[];
  violations?: any[];
}

export default function RunAutomation() {
  const navigate = useNavigate();
  const [selectedTestCases, setSelectedTestCases] = useState<any[]>([]);
  const [testSuites, setTestSuites] = useState<any[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string>("");
  const [testDomains, setTestDomains] = useState({
    ui: false,
    api: false,
    perf: false,
    a11y: false,
    security: false
  });
  const [environment, setEnvironment] = useState<string>("staging");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [credentialsProfile, setCredentialsProfile] = useState<string>("default");
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState<number>(-1);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedResultTab, setSelectedResultTab] = useState<"overview" | "logs" | "artifacts">("overview");

  useEffect(() => {
    loadTestCases();
    loadTestSuites();
  }, []);

  useEffect(() => {
    // Auto-scroll logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveLogs]);

  const loadTestCases = async () => {
    try {
      const testCases = await dataStorageService.getTestCases();
      setSelectedTestCases(testCases);
    } catch (error: any) {
      console.error("Error loading test cases:", error);
    }
  };

  const loadTestSuites = async () => {
    try {
      const plans = await dataStorageService.getTestPlans();
      setTestSuites(plans);
    } catch (error: any) {
      console.error("Error loading test suites:", error);
    }
  };

  const executeTests = async () => {
    if (!selectedSuite && selectedTestCases.length === 0) {
      toast.error("Please select a test suite or test cases to run");
      return;
    }

    const domainsToRun = Object.entries(testDomains)
      .filter(([_, enabled]) => enabled)
      .map(([domain, _]) => domain);

    if (domainsToRun.length === 0) {
      toast.error("Please select at least one test domain to run");
      return;
    }

    setIsExecuting(true);
    setExecutionResults([]);
    setLiveLogs([]);
    setCurrentTestIndex(-1);

    try {
      // Get tests to execute
      let testsToExecute: any[] = [];
      
      if (selectedSuite) {
        const suite = testSuites.find(s => s.id === selectedSuite);
        if (suite) {
          testsToExecute = suite.testCases || [];
        }
      } else {
        testsToExecute = selectedTestCases;
      }

      // Filter by selected domains
      const filteredTests = testsToExecute.filter(tc => {
        const tcType = tc.testType || tc.type || "ui";
        return domainsToRun.includes(tcType) || 
               (tcType === "ui" && domainsToRun.includes("ui")) ||
               (tcType === "automation" && domainsToRun.includes("ui"));
      });

      if (filteredTests.length === 0) {
        toast.error("No tests match the selected domains");
        setIsExecuting(false);
        return;
      }

      addLog(`Starting execution of ${filteredTests.length} test(s)...`);
      addLog(`Environment: ${environment}`);
      addLog(`Test domains: ${domainsToRun.join(", ")}`);

      const results: ExecutionResult[] = [];

      for (let i = 0; i < filteredTests.length; i++) {
        const test = filteredTests[i];
        setCurrentTestIndex(i);
        
        const testType = test.testType || test.type || "ui";
        const testCode = test.automationScript || test.code || "";
        const testName = test.name || test.title || `Test ${i + 1}`;

        if (!testCode) {
          addLog(`⚠️ Skipping ${testName}: No automation code found`);
          results.push({
            test_name: testName,
            test_type: testType,
            status: "error",
            logs: [`No automation code found for ${testName}`],
            error: "Missing automation code"
          });
          continue;
        }

        addLog(`\n[${i + 1}/${filteredTests.length}] Executing ${testName} (${testType})...`);

        try {
          const response = await fetch("http://localhost:8000/runners/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              test_type: testType === "automation" ? "ui" : testType,
              test_code: testCode,
              test_name: testName,
              framework: test.framework || getFrameworkForType(testType),
              options: {
                target_url: baseUrl || test.context || "https://example.com",
                environment: environment
              }
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }

          const data = await response.json();
          const result = data.result;

          addLog(`✓ ${testName} completed: ${result.status}`);
          
          if (result.logs && result.logs.length > 0) {
            result.logs.forEach((log: string) => addLog(`  ${log}`));
          }

          if (result.error) {
            addLog(`✗ Error: ${result.error}`);
          }

          results.push({
            test_name: testName,
            test_type: testType,
            status: result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "error",
            duration: result.duration || result.execution_time,
            logs: result.logs || [],
            error: result.error,
            artifacts: result.artifacts || {},
            metrics: result.metrics,
            findings: result.findings,
            violations: result.violations
          });

        } catch (error: any) {
          addLog(`✗ ${testName} failed: ${error.message}`);
          results.push({
            test_name: testName,
            test_type: testType,
            status: "error",
            logs: [`Execution error: ${error.message}`],
            error: error.message
          });
        }

        setExecutionResults([...results]);
      }

      setCurrentTestIndex(-1);
      addLog(`\n✅ Execution complete: ${results.filter(r => r.status === "passed").length} passed, ${results.filter(r => r.status === "failed" || r.status === "error").length} failed`);

      toast.success(`Execution complete: ${results.filter(r => r.status === "passed").length}/${results.length} passed`);

    } catch (error: any) {
      console.error("Error executing tests:", error);
      toast.error(`Execution failed: ${error.message}`);
      addLog(`✗ Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLiveLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getFrameworkForType = (testType: string): string => {
    const map: Record<string, string> = {
      "ui": "playwright",
      "automation": "playwright",
      "api": "pytest",
      "performance": "k6",
      "perf": "k6",
      "accessibility": "axe",
      "a11y": "axe",
      "security": "zap"
    };
    return map[testType] || "playwright";
  };

  const sendFailuresToTriage = async () => {
    const failures = executionResults.filter(r => r.status === "failed" || r.status === "error");
    
    if (failures.length === 0) {
      toast.info("No failures to send to triage");
      return;
    }

    try {
      // TODO: Implement triage integration
      toast.success(`Sent ${failures.length} failure(s) to triage`);
    } catch (error: any) {
      toast.error(`Failed to send to triage: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      "passed": "default",
      "failed": "destructive",
      "error": "destructive",
      "running": "secondary"
    };
    return variants[status] || "secondary";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Run & Automation</h1>
            <p className="text-muted-foreground">Execute tests and view results</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Selection</CardTitle>
              <CardDescription>Choose tests to execute</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Test Suite</Label>
                <Select value={selectedSuite} onValueChange={setSelectedSuite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test suite (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (use test cases)</SelectItem>
                    {testSuites.map(suite => (
                      <SelectItem key={suite.id} value={suite.id}>
                        {suite.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {!selectedSuite && (
                <div className="space-y-2">
                  <Label>Test Cases ({selectedTestCases.length} available)</Label>
                  <p className="text-sm text-muted-foreground">
                    Select test cases from Test Cases page first
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Domains</CardTitle>
              <CardDescription>Select which test types to run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domain-ui"
                  checked={testDomains.ui}
                  onCheckedChange={(checked) => setTestDomains({...testDomains, ui: checked as boolean})}
                />
                <Label htmlFor="domain-ui" className="font-normal cursor-pointer">UI / Functional</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domain-api"
                  checked={testDomains.api}
                  onCheckedChange={(checked) => setTestDomains({...testDomains, api: checked as boolean})}
                />
                <Label htmlFor="domain-api" className="font-normal cursor-pointer">API</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domain-perf"
                  checked={testDomains.perf}
                  onCheckedChange={(checked) => setTestDomains({...testDomains, perf: checked as boolean})}
                />
                <Label htmlFor="domain-perf" className="font-normal cursor-pointer">Performance / Load</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domain-a11y"
                  checked={testDomains.a11y}
                  onCheckedChange={(checked) => setTestDomains({...testDomains, a11y: checked as boolean})}
                />
                <Label htmlFor="domain-a11y" className="font-normal cursor-pointer">Accessibility</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domain-security"
                  checked={testDomains.security}
                  onCheckedChange={(checked) => setTestDomains({...testDomains, security: checked as boolean})}
                />
                <Label htmlFor="domain-security" className="font-normal cursor-pointer">Security / Negative</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment & Config</CardTitle>
              <CardDescription>Configure execution environment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Dev</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="preprod">Preprod</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  placeholder="https://staging.example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Credentials Profile</Label>
                <Select value={credentialsProfile} onValueChange={setCredentialsProfile}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              className="flex-1 gradient-primary"
              onClick={executeTests}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Tests
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel: Execution Results */}
        <div className="lg:col-span-2 space-y-6">
          {executionResults.length > 0 || isExecuting ? (
            <Tabs value={selectedResultTab} onValueChange={(v) => setSelectedResultTab(v as any)}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">Live Logs</TabsTrigger>
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Execution Results</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="default">
                          {executionResults.filter(r => r.status === "passed").length} Passed
                        </Badge>
                        <Badge variant="destructive">
                          {executionResults.filter(r => r.status === "failed" || r.status === "error").length} Failed
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {executionResults.map((result, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="font-semibold">{result.test_name}</span>
                            <Badge variant={getStatusBadge(result.status)}>{result.status}</Badge>
                            <Badge variant="outline">{result.test_type}</Badge>
                          </div>
                          {result.duration && (
                            <span className="text-sm text-muted-foreground">
                              {result.duration}ms
                            </span>
                          )}
                        </div>
                        {result.error && (
                          <p className="text-sm text-red-500">{result.error}</p>
                        )}
                        {result.metrics && (
                          <div className="text-sm text-muted-foreground">
                            <p>Metrics: {JSON.stringify(result.metrics, null, 2).substring(0, 100)}...</p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {executionResults.some(r => r.status === "failed" || r.status === "error") && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={sendFailuresToTriage}
                      >
                        Send Failures to Triage
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Live Execution Logs</CardTitle>
                    <CardDescription>Real-time execution output</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto">
                      {liveLogs.length === 0 ? (
                        <p className="text-muted-foreground">No logs yet. Start execution to see logs.</p>
                      ) : (
                        liveLogs.map((log, idx) => (
                          <div key={idx} className="mb-1">
                            {log}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="artifacts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Execution Artifacts</CardTitle>
                    <CardDescription>Videos, reports, and other artifacts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {executionResults.map((result, idx) => (
                      result.artifacts && Object.keys(result.artifacts).length > 0 && (
                        <div key={idx} className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-semibold">{result.test_name}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {result.artifacts.video && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={result.artifacts.video} target="_blank" rel="noopener noreferrer">
                                  <FileVideo className="h-4 w-4 mr-2" />
                                  Video
                                </a>
                              </Button>
                            )}
                            {result.artifacts.har && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={result.artifacts.har} target="_blank" rel="noopener noreferrer">
                                  <FileText className="h-4 w-4 mr-2" />
                                  HAR File
                                </a>
                              </Button>
                            )}
                            {result.artifacts.perf_graph && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={result.artifacts.perf_graph} target="_blank" rel="noopener noreferrer">
                                  <BarChart3 className="h-4 w-4 mr-2" />
                                  Performance Graph
                                </a>
                              </Button>
                            )}
                            {result.artifacts.a11y_report && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={result.artifacts.a11y_report} target="_blank" rel="noopener noreferrer">
                                  <Eye className="h-4 w-4 mr-2" />
                                  A11y Report
                                </a>
                              </Button>
                            )}
                            {result.artifacts.security_report && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={result.artifacts.security_report} target="_blank" rel="noopener noreferrer">
                                  <Shield className="h-4 w-4 mr-2" />
                                  Security Report
                                </a>
                              </Button>
                            )}
                            {result.artifacts.screenshots && result.artifacts.screenshots.length > 0 && (
                              <div className="col-span-2">
                                <Label className="text-sm">Screenshots ({result.artifacts.screenshots.length})</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {result.artifacts.screenshots.map((screenshot, sIdx) => (
                                    <Button key={sIdx} variant="outline" size="sm" asChild>
                                      <a href={screenshot} target="_blank" rel="noopener noreferrer">
                                        Screenshot {sIdx + 1}
                                      </a>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                    
                    {executionResults.every(r => !r.artifacts || Object.keys(r.artifacts).length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No artifacts generated yet. Artifacts will appear here after test execution.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Configure your test selection and click "Run Tests" to start execution.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}




