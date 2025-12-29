import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Search, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Map,
  FileText,
  GitCompare,
  Eye,
  Bug,
  TestTube,
  BarChart3,
  Zap,
  RefreshCw,
  Globe,
  Link2,
  Layout,
  Settings
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-config";

interface ExplorationRun {
  id: string;
  base_url: string;
  status: string;
  total_pages_discovered: number;
  started_at: string;
  completed_at?: string;
}

interface CapabilityMap {
  id: string;
  base_url: string;
  total_entities: number;
  total_capabilities: number;
  created_at: string;
}

interface Defect {
  id: string;
  title: string;
  description: string;
  defect_type: string;
  severity: string;
  status: string;
  page_url: string;
  detected_at: string;
  screenshot_path?: string;
}

interface TestCase {
  title: string;
  description: string;
  test_type: string;
  priority: string;
  steps: any[];
  entity: string;
  operation: string;
}

interface WorkflowSummary {
  pages_discovered: number;
  defects_detected: number;
  defects_saved: number;
  test_cases_generated: number;
  test_cases_executed: number;
  test_cases_passed: number;
  test_cases_failed: number;
  defects_from_tests: number;
}

interface LLMAnalysis {
  domain?: string;
  application_type?: string;
  primary_entities?: Array<{name: string; operations: string[]}>;
  key_operations?: Array<{name: string; description: string; priority: string}>;
  critical_flows?: Array<{name: string; description: string; priority: string; steps: string[]}>;
  confidence?: string;
  reasoning?: string;
}

export default function Exploration() {
  const [baseUrl, setBaseUrl] = useState("https://www.walmart.com/");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(20);
  const [headless, setHeadless] = useState(true);
  const [screenshot, setScreenshot] = useState(true);
  const [generateTests, setGenerateTests] = useState(true);
  const [executeTests, setExecuteTests] = useState(false);
  
  const [isExploring, setIsExploring] = useState(false);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [explorationRun, setExplorationRun] = useState<ExplorationRun | null>(null);
  const [capabilityMap, setCapabilityMap] = useState<any>(null);
  const [capabilityMaps, setCapabilityMaps] = useState<CapabilityMap[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [workflowSummary, setWorkflowSummary] = useState<WorkflowSummary | null>(null);
  const [report, setReport] = useState<any>(null);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysis | null>(null);
  const [initialAnalysis, setInitialAnalysis] = useState<LLMAnalysis | null>(null);
  const [selectedTab, setSelectedTab] = useState<"explore" | "pages" | "maps" | "defects" | "tests" | "report" | "compare">("explore");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  useEffect(() => {
    loadCapabilityMaps();
    loadDefects();
  }, []);

  const loadCapabilityMaps = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exploration/capability-maps`);
      if (response.ok) {
        const data = await response.json();
        setCapabilityMaps(data.capability_maps || []);
      }
    } catch (error) {
      console.error("Failed to load capability maps:", error);
    }
  };

  const loadDefects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/defects`);
      if (response.ok) {
        const data = await response.json();
        setDefects(data.defects || []);
      }
    } catch (error) {
      console.error("Failed to load defects:", error);
    }
  };

  const startExploration = async () => {
    if (!baseUrl) {
      toast.error("Please enter a base URL");
      return;
    }

    // Validate URL
    try {
      new URL(baseUrl);
    } catch {
      toast.error("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setIsExploring(true);
    setExplorationRun(null);
    setCapabilityMap(null);
    setDefects([]);
    setTestCases([]);
    setWorkflowSummary(null);
    setReport(null);

    toast.info("Starting exploration... This may take a few minutes.");

    try {
      const response = await fetch(`${API_BASE_URL}/api/exploration/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_url: baseUrl,
          max_depth: maxDepth,
          max_pages: maxPages,
          headless: headless,
          screenshot: screenshot,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Exploration failed");
      }

      const data = await response.json();
      console.log("Exploration response:", data);
      
      const totalPages = data.exploration_result?.total_pages || data.exploration_result?.pages?.length || 0;
      const resultBaseUrl = data.capability_map?.base_url || data.exploration_result?.base_url || baseUrl;
      
      setExplorationRun({
        id: data.exploration_run_id,
        base_url: resultBaseUrl,
        status: "completed",
        total_pages_discovered: totalPages,
        started_at: data.timestamp,
        completed_at: data.timestamp,
      });
      
      const capabilityData = data.capability_map || {};
      setCapabilityMap(capabilityData);
      setCurrentRunId(data.exploration_run_id);
      
      // Extract LLM analysis from capability map
      if (capabilityData.llm_analysis) {
        setLlmAnalysis(capabilityData.llm_analysis);
      }
      if (capabilityData.initial_analysis) {
        setInitialAnalysis(capabilityData.initial_analysis);
      }
      
      // Load defects detected during exploration
      if (data.defects_detected > 0) {
        await loadDefects();
      }
      
      toast.success(`Exploration complete! Discovered ${totalPages} pages, ${data.defects_detected || 0} defects`);
      loadCapabilityMaps();
    } catch (error: any) {
      toast.error(error.message || "Exploration failed");
      console.error("Exploration error:", error);
    } finally {
      setIsExploring(false);
    }
  };

  const runCompleteWorkflow = async () => {
    if (!baseUrl) {
      toast.error("Please enter a base URL");
      return;
    }

    // Validate URL
    try {
      new URL(baseUrl);
    } catch {
      toast.error("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setIsRunningWorkflow(true);
    setExplorationRun(null);
    setCapabilityMap(null);
    setDefects([]);
    setTestCases([]);
    setWorkflowSummary(null);
    setReport(null);

    try {
      toast.info("Starting complete workflow... This may take several minutes. Please wait.");
      
      const response = await fetch(`${API_BASE_URL}/api/exploration/complete-workflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_url: baseUrl,
          max_depth: maxDepth,
          max_pages: maxPages,
          headless: headless,
          screenshot: screenshot,
          generate_tests: generateTests,
          execute_tests: executeTests,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Workflow failed");
      }

      const data = await response.json();
      console.log("Complete workflow response:", data);
      console.log("Capability map ID:", data.capability_map_id);
      
      // Set exploration run
      setExplorationRun({
        id: data.exploration_run_id,
        base_url: baseUrl,
        status: "completed",
        total_pages_discovered: data.summary.pages_discovered,
        started_at: data.timestamp,
        completed_at: data.timestamp,
      });
      
      // Set capability map
      if (data.capability_map_id) {
        const mapResponse = await fetch(`${API_BASE_URL}/api/exploration/capability-map/${data.capability_map_id}`);
        if (mapResponse.ok) {
          const mapData = await mapResponse.json();
          const capabilityData = mapData.capability_map?.capability_data || mapData.capability_map || {};
          console.log("Capability data loaded:", capabilityData);
          console.log("LLM analysis in capability data:", capabilityData.llm_analysis);
          console.log("Initial analysis in capability data:", capabilityData.initial_analysis);
          setCapabilityMap(capabilityData);
          
          // Extract LLM analysis from capability map
          if (capabilityData.llm_analysis) {
            console.log("Setting LLM analysis:", capabilityData.llm_analysis);
            setLlmAnalysis(capabilityData.llm_analysis);
          }
          if (capabilityData.initial_analysis) {
            console.log("Setting initial analysis:", capabilityData.initial_analysis);
            setInitialAnalysis(capabilityData.initial_analysis);
          }
        }
      }
      
      // Also check if LLM analysis is in the response directly
      if (data.llm_analysis) {
        setLlmAnalysis(data.llm_analysis);
      }
      if (data.initial_analysis) {
        setInitialAnalysis(data.initial_analysis);
      }
      
      // Set summary
      setWorkflowSummary(data.summary);
      setCurrentRunId(data.exploration_run_id);
      
      // Set test cases if included in response
      if (data.test_cases && data.test_cases.length > 0) {
        setTestCases(data.test_cases);
      } else if (data.summary.test_cases_generated > 0 && generateTests) {
        // Fallback: load test cases separately
        await loadTestCases(data.exploration_run_id);
      }
      
      // Set defects if included in response
      if (data.defects && data.defects.length > 0) {
        setDefects(data.defects);
      } else {
        // Fallback: load defects from API
        await loadDefects();
      }
      
      // Load report
      if (data.report) {
        setReport(data.report);
      } else {
        await loadReport(data.exploration_run_id);
      }
      
      toast.success(
        `Complete workflow finished! ` +
        `${data.summary.pages_discovered} pages, ` +
        `${data.summary.defects_detected} defects, ` +
        `${data.summary.test_cases_generated} test cases generated`
      );
      
      // Switch to report tab
      setSelectedTab("report");
      
      loadCapabilityMaps();
    } catch (error: any) {
      toast.error(error.message || "Complete workflow failed");
      console.error("Workflow error:", error);
    } finally {
      setIsRunningWorkflow(false);
    }
  };

  const loadTestCases = async (runId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exploration/generate-tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exploration_run_id: runId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestCases(data.test_cases || []);
      }
    } catch (error) {
      console.error("Failed to load test cases:", error);
    }
  };

  const loadReport = async (runId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exploration/report/${runId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
      }
    } catch (error) {
      console.error("Failed to load report:", error);
    }
  };

  const loadCapabilityMap = async (mapId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exploration/capability-map/${mapId}`);
      if (response.ok) {
        const data = await response.json();
        const capabilityData = data.capability_map?.capability_data || data.capability_map || {};
        setCapabilityMap(capabilityData);
        setSelectedTab("explore");
      }
    } catch (error) {
      toast.error("Failed to load capability map");
      console.error(error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="h-8 w-8 text-primary" />
            Exploration - Capability Mapping
          </h1>
          <p className="text-muted-foreground mt-2">
            Build capability maps, compare requirements, and generate test cases from discovered capabilities
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
        <TabsList>
          <TabsTrigger value="explore">
            <Search className="w-4 h-4 mr-2" />
            Explore App
          </TabsTrigger>
          <TabsTrigger value="pages">
            <FileText className="w-4 h-4 mr-2" />
            Pages ({capabilityMap?.pages?.length || capabilityMap?.total_pages || 0})
          </TabsTrigger>
          <TabsTrigger value="maps">
            <Map className="w-4 h-4 mr-2" />
            Capability Maps
          </TabsTrigger>
          <TabsTrigger value="defects">
            <Bug className="w-4 h-4 mr-2" />
            Defects ({defects.length})
          </TabsTrigger>
          <TabsTrigger value="tests">
            <TestTube className="w-4 h-4 mr-2" />
            Test Cases ({testCases.length})
          </TabsTrigger>
          <TabsTrigger value="report">
            <BarChart3 className="w-4 h-4 mr-2" />
            Report
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="w-4 h-4 mr-2" />
            Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explore" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Workflow (Recommended)</CardTitle>
              <CardDescription>
                Run exploration, detect defects, generate tests, and execute them all in one go
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://example.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  disabled={isExploring || isRunningWorkflow}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxDepth">Max Depth</Label>
                  <Input
                    id="maxDepth"
                    type="number"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value) || 2)}
                    disabled={isExploring || isRunningWorkflow}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPages">Max Pages</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 20)}
                    disabled={isExploring || isRunningWorkflow}
                    min={1}
                    max={500}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="headless"
                    checked={headless}
                    onCheckedChange={(checked) => setHeadless(checked as boolean)}
                    disabled={isExploring || isRunningWorkflow}
                  />
                  <Label htmlFor="headless" className="cursor-pointer">
                    Run in headless mode (faster)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="screenshot"
                    checked={screenshot}
                    onCheckedChange={(checked) => setScreenshot(checked as boolean)}
                    disabled={isExploring || isRunningWorkflow}
                  />
                  <Label htmlFor="screenshot" className="cursor-pointer">
                    Capture screenshots (for defect evidence)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generateTests"
                    checked={generateTests}
                    onCheckedChange={(checked) => setGenerateTests(checked as boolean)}
                    disabled={isExploring || isRunningWorkflow}
                  />
                  <Label htmlFor="generateTests" className="cursor-pointer">
                    Generate test cases from capability map
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="executeTests"
                    checked={executeTests}
                    onCheckedChange={(checked) => setExecuteTests(checked as boolean)}
                    disabled={isExploring || isRunningWorkflow}
                  />
                  <Label htmlFor="executeTests" className="cursor-pointer">
                    Execute generated tests (creates defects from failures)
                  </Label>
                </div>
              </div>

              <Button
                onClick={runCompleteWorkflow}
                disabled={isExploring || isRunningWorkflow || !baseUrl}
                className="w-full"
                size="lg"
              >
                {isRunningWorkflow ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Complete Workflow...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run Complete Workflow
                  </>
                )}
              </Button>

              <div className="border-t pt-4">
                <Button
                  onClick={startExploration}
                  disabled={isExploring || isRunningWorkflow || !baseUrl}
                  variant="outline"
                  className="w-full"
                >
                  {isExploring ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exploring...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Exploration Only
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Or run just exploration without test generation
                </p>
              </div>

              {(isExploring || isRunningWorkflow) && (
                <div className="space-y-2">
                  <Progress value={50} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {isRunningWorkflow 
                      ? "Running complete workflow... This may take several minutes." 
                      : "Exploring application... This may take a few minutes."}
                  </p>
                </div>
              )}

              {workflowSummary && (
                <Card className="mt-4 border-green-500">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      Workflow Complete
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Pages Discovered</p>
                        <p className="text-2xl font-bold">{workflowSummary.pages_discovered}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Defects Detected</p>
                        <p className="text-2xl font-bold text-red-500">{workflowSummary.defects_detected}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Test Cases Generated</p>
                        <p className="text-2xl font-bold text-blue-500">{workflowSummary.test_cases_generated}</p>
                      </div>
                      {executeTests && (
                        <>
                          <div>
                            <p className="text-sm font-medium">Tests Passed</p>
                            <p className="text-2xl font-bold text-green-500">{workflowSummary.test_cases_passed}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Tests Failed</p>
                            <p className="text-2xl font-bold text-red-500">{workflowSummary.test_cases_failed}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {explorationRun && !workflowSummary && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Exploration Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge variant={explorationRun.status === "completed" ? "default" : "secondary"}>
                          {explorationRun.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Pages Discovered:</span>
                        <span className="text-sm">{explorationRun.total_pages_discovered}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* LLM Analysis Results */}
          {(llmAnalysis || initialAnalysis || (capabilityMap && (capabilityMap.llm_analysis || capabilityMap.initial_analysis))) && (() => {
            const initial = initialAnalysis || (capabilityMap && capabilityMap.initial_analysis);
            const complete = llmAnalysis || (capabilityMap && capabilityMap.llm_analysis);
            
            return (
              <Card className="border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    AI-Powered Application Analysis
                  </CardTitle>
                  <CardDescription>
                    Intelligent analysis of application domain and structure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {initial && (
                    <div>
                      <h3 className="font-semibold mb-2">Initial Analysis (Pre-Exploration)</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Domain</p>
                          <Badge variant="default">{initial.domain || 'Unknown'}</Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Confidence</p>
                          <Badge variant={initial.confidence === 'high' ? 'default' : 'secondary'}>
                            {initial.confidence || 'medium'}
                          </Badge>
                        </div>
                      </div>
                      {initial.expected_entities && initial.expected_entities.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-muted-foreground">Expected Entities</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {initial.expected_entities.map((entity: string, idx: number) => (
                              <Badge key={idx} variant="outline">{entity}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {complete && (
                    <div>
                      <h3 className="font-semibold mb-2">Complete Analysis (Post-Exploration)</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Domain</p>
                          <Badge variant="default">{complete.domain || 'Unknown'}</Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Application Type</p>
                          <Badge variant="outline">{complete.application_type || 'Web Application'}</Badge>
                        </div>
                      </div>
                      
                      {complete.primary_entities && complete.primary_entities.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium mb-2">Primary Entities ({complete.primary_entities.length})</p>
                          <div className="space-y-2">
                            {complete.primary_entities.slice(0, 5).map((entity: any, idx: number) => (
                              <div key={idx} className="p-2 border rounded">
                                <p className="font-medium">{entity.name || entity}</p>
                                {entity.operations && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {entity.operations.slice(0, 4).map((op: string, opIdx: number) => (
                                      <Badge key={opIdx} variant="outline" className="text-xs">{op}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {complete.critical_flows && complete.critical_flows.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Critical Flows ({complete.critical_flows.length})</p>
                          <div className="space-y-2">
                            {complete.critical_flows.slice(0, 5).map((flow: any, idx: number) => (
                              <div key={idx} className="p-3 border rounded bg-muted/30">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium">{flow.name}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{flow.description}</p>
                                    {flow.steps && flow.steps.length > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {flow.steps.length} steps
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant={flow.priority === 'high' ? 'default' : 'secondary'}>
                                    {flow.priority || 'medium'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
          
          {/* Debug: Show if LLM analysis exists but card didn't render */}
          {capabilityMap && (capabilityMap.llm_analysis || capabilityMap.initial_analysis) && !llmAnalysis && !initialAnalysis && (
            <Card className="border-yellow-500">
              <CardHeader>
                <CardTitle>Debug: LLM Analysis Found in Capability Map</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify({
                    has_llm_analysis: !!capabilityMap.llm_analysis,
                    has_initial_analysis: !!capabilityMap.initial_analysis,
                    llm_analysis_keys: capabilityMap.llm_analysis ? Object.keys(capabilityMap.llm_analysis) : [],
                    initial_analysis_keys: capabilityMap.initial_analysis ? Object.keys(capabilityMap.initial_analysis) : []
                  }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {capabilityMap && (
            <Card>
              <CardHeader>
                <CardTitle>Capability Map</CardTitle>
                <CardDescription>
                  Discovered entities and operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Entities ({capabilityMap.entities?.length || 0})</h3>
                    <div className="space-y-2">
                      {capabilityMap.entities?.slice(0, 10).map((entity: any, idx: number) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{entity.entity}</p>
                              <p className="text-sm text-muted-foreground">
                                Operation: {entity.operation}
                              </p>
                            </div>
                            <Badge>{entity.fields?.length || 0} fields</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovered Pages</CardTitle>
              <CardDescription>
                All pages traversed during exploration ({capabilityMap?.pages?.length || capabilityMap?.total_pages || 0} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!capabilityMap || !capabilityMap.pages || capabilityMap.pages.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No pages discovered yet. Start an exploration to discover pages.
                </p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {capabilityMap.pages.map((page: any, idx: number) => (
                    <Card key={page.id || idx} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-medium">{page.title || 'Untitled Page'}</p>
                            {page.metadata?.defects > 0 && (
                              <Badge variant="destructive">{page.metadata.defects} defects</Badge>
                            )}
                            {page.metadata?.depth !== undefined && (
                              <Badge variant="outline">Depth {page.metadata.depth}</Badge>
                            )}
                          </div>
                          <a 
                            href={page.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline break-all"
                          >
                            {page.url}
                          </a>
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            {page.buttons && page.buttons.length > 0 && (
                              <span>{page.buttons.length} buttons</span>
                            )}
                            {page.links && page.links.length > 0 && (
                              <span>{page.links.length} links</span>
                            )}
                            {page.forms && page.forms.length > 0 && (
                              <span>{page.forms.length} forms</span>
                            )}
                            {page.headings && page.headings.length > 0 && (
                              <span>{page.headings.length} headings</span>
                            )}
                          </div>
                          {page.entities && page.entities.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-1">Entities:</p>
                              <div className="flex gap-1 flex-wrap">
                                {page.entities.slice(0, 5).map((entity: string, eIdx: number) => (
                                  <Badge key={eIdx} variant="outline" className="text-xs">{entity}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Capability Maps</CardTitle>
              <CardDescription>
                View and manage discovered capability maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capabilityMaps.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No capability maps found. Start an exploration to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {capabilityMaps.map((map) => (
                    <Card key={map.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{map.base_url}</p>
                          <p className="text-sm text-muted-foreground">
                            {map.total_entities} entities, {map.total_capabilities} capabilities
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(map.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadCapabilityMap(map.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Defects Detected</CardTitle>
                  <CardDescription>
                    Defects found during exploration and test execution
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDefects}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {defects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No defects found. Run exploration to detect defects.
                </p>
              ) : (
                <div className="space-y-4">
                  {defects.map((defect) => (
                    <Card key={defect.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{defect.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {defect.description || "No description"}
                            </p>
                            {defect.page_url && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Page: <a href={defect.page_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{defect.page_url}</a>
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <Badge variant={defect.severity === "critical" || defect.severity === "high" ? "destructive" : "secondary"}>
                              {defect.severity}
                            </Badge>
                            <Badge variant="outline">
                              {defect.defect_type || "functional"}
                            </Badge>
                            <Badge variant={defect.status === "open" ? "default" : "secondary"}>
                              {defect.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      {defect.screenshot_path && (
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-2">Screenshot available</p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Test Cases</CardTitle>
                  <CardDescription>
                    Test cases automatically generated from capability map
                  </CardDescription>
                </div>
                {currentRunId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTestCases(currentRunId)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {testCases.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No test cases generated yet. Run complete workflow with "Generate test cases" enabled.
                </p>
              ) : (
                <div className="space-y-4">
                  {testCases.map((testCase, idx) => (
                    <Card key={idx} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{testCase.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {testCase.description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{testCase.entity}</Badge>
                              <Badge variant="outline">{testCase.operation}</Badge>
                              <Badge variant={testCase.priority === "high" ? "default" : "secondary"}>
                                {testCase.priority}
                              </Badge>
                              <Badge variant="outline">{testCase.test_type}</Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Steps:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            {testCase.steps?.slice(0, 5).map((step: any, stepIdx: number) => (
                              <li key={stepIdx}>{step.action || step.step_number}</li>
                            ))}
                            {testCase.steps && testCase.steps.length > 5 && (
                              <li className="text-muted-foreground">... and {testCase.steps.length - 5} more steps</li>
                            )}
                          </ol>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Exploration Report</CardTitle>
                  <CardDescription>
                    Comprehensive report of exploration, defects, and test execution
                  </CardDescription>
                </div>
                {currentRunId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadReport(currentRunId)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!report && !workflowSummary ? (
                <p className="text-muted-foreground text-center py-8">
                  No report available. Run complete workflow to generate a report.
                </p>
              ) : (
                <div className="space-y-6">
                  {workflowSummary && (
                    <div>
                      <h3 className="font-semibold mb-4">Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">Pages</p>
                          <p className="text-2xl font-bold">{workflowSummary.pages_discovered}</p>
                        </Card>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">Defects</p>
                          <p className="text-2xl font-bold text-red-500">{workflowSummary.defects_detected}</p>
                        </Card>
                        <Card className="p-4">
                          <p className="text-sm text-muted-foreground">Test Cases</p>
                          <p className="text-2xl font-bold text-blue-500">{workflowSummary.test_cases_generated}</p>
                        </Card>
                        {executeTests && (
                          <Card className="p-4">
                            <p className="text-sm text-muted-foreground">Pass Rate</p>
                            <p className="text-2xl font-bold text-green-500">
                              {workflowSummary.test_cases_executed > 0
                                ? Math.round((workflowSummary.test_cases_passed / workflowSummary.test_cases_executed) * 100)
                                : 0}%
                            </p>
                          </Card>
                        )}
                      </div>
                    </div>
                  )}

                  {report && (
                    <>
                      {report.defects_by_type && (
                        <div>
                          <h3 className="font-semibold mb-4">Defects by Type</h3>
                          <div className="space-y-2">
                            {Object.entries(report.defects_by_type).map(([type, count]: [string, any]) => (
                              <div key={type} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm font-medium">{type}</span>
                                <Badge>{count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.defects_by_severity && (
                        <div>
                          <h3 className="font-semibold mb-4">Defects by Severity</h3>
                          <div className="space-y-2">
                            {Object.entries(report.defects_by_severity).map(([severity, count]: [string, any]) => (
                              <div key={severity} className="flex items-center justify-between p-2 border rounded">
                                <span className="text-sm font-medium">{severity}</span>
                                <Badge variant={severity === "critical" || severity === "high" ? "destructive" : "secondary"}>
                                  {count}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.test_execution_summary && (
                        <div>
                          <h3 className="font-semibold mb-4">Test Execution Summary</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4">
                              <p className="text-sm text-muted-foreground">Total Tests</p>
                              <p className="text-2xl font-bold">{report.test_execution_summary.total}</p>
                            </Card>
                            <Card className="p-4">
                              <p className="text-sm text-muted-foreground">Passed</p>
                              <p className="text-2xl font-bold text-green-500">{report.test_execution_summary.passed}</p>
                            </Card>
                            <Card className="p-4">
                              <p className="text-sm text-muted-foreground">Failed</p>
                              <p className="text-2xl font-bold text-red-500">{report.test_execution_summary.failed}</p>
                            </Card>
                            <Card className="p-4">
                              <p className="text-sm text-muted-foreground">Pass Rate</p>
                              <p className="text-2xl font-bold">{report.test_execution_summary.pass_rate?.toFixed(1) || 0}%</p>
                            </Card>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compare Requirements</CardTitle>
              <CardDescription>
                Compare new requirements against discovered capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Select a capability map and requirement to compare. This feature will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
