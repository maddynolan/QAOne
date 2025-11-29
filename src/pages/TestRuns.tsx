import { Play, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { testExecutionService, TestRun } from "@/lib/test-execution-service";
import { dataStorageService, TestCase } from "@/lib/data-storage";
import { toast } from "sonner";

export default function TestRuns() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTestRuns();
  }, []);

  const loadTestRuns = async () => {
    try {
      const runs = await dataStorageService.getTestRuns();
      setTestRuns(runs);
    } catch (error) {
      console.error('Error loading test runs:', error);
      toast.error('Failed to load test runs');
    }
  };

  const createNewTestRun = async (selectedTestCases?: TestCase[]) => {
    setIsLoading(true);
    try {
      // Handle case where function is called with event object from button click
      if (selectedTestCases && !Array.isArray(selectedTestCases) && 'nativeEvent' in selectedTestCases) {
        // This is a React SyntheticEvent, reset to undefined
        selectedTestCases = undefined;
      }
      
      const allTestCases = await dataStorageService.getTestCases();
      
      // Ensure allTestCases is an array
      let testCasesArray: TestCase[] = [];
      if (allTestCases === null || allTestCases === undefined) {
        toast.error("Failed to retrieve test cases. Please try again.");
        return;
      } else if (Array.isArray(allTestCases)) {
        testCasesArray = allTestCases;
      } else if (typeof allTestCases === 'object') {
        // Try to extract array from object
        if ('testCases' in allTestCases && Array.isArray(allTestCases.testCases)) {
          testCasesArray = allTestCases.testCases;
        } else if ('test_cases' in allTestCases && Array.isArray(allTestCases.test_cases)) {
          testCasesArray = allTestCases.test_cases;
        } else {
          toast.error("Invalid test cases format received from backend");
          return;
        }
      } else {
        toast.error("Invalid test cases data type received");
        return;
      }
      
      if (testCasesArray.length === 0) {
        toast.error("No test cases available. Please create some test cases first.");
        return;
      }

      // Use provided test cases or all test cases
      const testCasesToRun = (selectedTestCases && Array.isArray(selectedTestCases)) ? selectedTestCases : testCasesArray;
      
      // Ensure testCasesToRun is an array
      if (!Array.isArray(testCasesToRun)) {
        toast.error("Invalid test cases data");
        return;
      }

      // Convert data storage test cases to test execution service format
      const testCases = testCasesToRun.map((tc: any) => {
        console.log("Processing test case:", tc);
        // Ensure steps is an array
        const steps = Array.isArray(tc.steps) ? tc.steps : [];
        const testCase = {
          id: tc.id || tc.case_id || "",
          title: tc.name || tc.title || "Untitled Test Case",
          description: tc.description || "",
          priority: tc.priority || "medium",
          tags: Array.isArray(tc.tags) ? tc.tags : [],
          steps: steps.map((step: any) => ({
            action: step.action || "",
            data: {},
            expected: step.expectedResult || step.expected || "",
            locator_hints: []
          }))
        };
        console.log("Converted test case:", testCase);
        return testCase;
      });
      
      console.log("Converted test cases for backend:", testCases);

      const run = await dataStorageService.createTestRun({
        name: `Test Run ${new Date().toLocaleString()}`,
        status: 'pending',
        testCases: testCases,
        results: []
      });
      
      await loadTestRuns(); // Reload from backend
      toast.success(`Test run created with ${testCases.length} test case(s)!`);
    } catch (error: any) {
      toast.error(`Failed to create test run: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTestRun = async (runId: string) => {
    setIsLoading(true);
    try {
      // Get the test run details
      const run = testRuns.find(r => r.id === runId);
      if (!run) {
        toast.error("Test run not found");
        return;
      }
      
      if (run.testCases.length === 0) {
        toast.error("No test cases in this run");
        return;
      }
      
      // Use default IDs that match backend constants
      const orgId = "00000000-0000-0000-0000-000000000000"; // DEFAULT_ORG_ID
      const projectId = "11111111-1111-1111-1111-111111111111"; // DEFAULT_PROJECT_ID
      
      toast.loading("Executing test run...");
      
      // Call backend execution endpoint
      const response = await fetch("http://localhost:8000/tests/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          project_id: projectId,
          test_cases: run.testCases.map(tc => ({
            id: tc.id || tc.case_id,
            title: tc.name || tc.title,
            description: tc.description || "",
            priority: tc.priority || "medium",
            tags: tc.tags || [],
            steps: (tc.steps || []).map((step: any) => ({
              action: step.action || "",
              data: step.data || {},
              expected: step.expected || step.expectedResult || "",
              locator_hints: step.locator_hints || []
            }))
          }))
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test execution failed: ${errorText}`);
      }
      
      const result = await response.json();
      toast.dismiss();
      
      // Update test run status
      await fetch(`http://localhost:8000/test-runs/${runId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: result.summary?.failed === 0 ? "completed" : "failed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      });
      
      toast.success(`Test run completed! ${result.summary?.passed || 0} passed, ${result.summary?.failed || 0} failed`);
      await loadTestRuns(); // Reload from backend
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Failed to execute test run: ${error.message}`);
      console.error("Error executing test run:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: TestRun['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'running':
        return <Play className="h-4 w-4 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: TestRun['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'running':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Runs</h1>
          <p className="text-muted-foreground mt-1">Execute and monitor test runs</p>
        </div>
        <Button 
          onClick={() => navigate("/runs/create")}
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Create Test Run
        </Button>
      </div>

      {testRuns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Test Runs Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first test run to start executing tests
            </p>
            <Button onClick={() => createNewTestRun()} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Create Test Run
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {testRuns.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getStatusColor(run.status)}>
                        {getStatusIcon(run.status)}
                        <span className="ml-1">{run.status}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {run.startTime 
                          ? `Started: ${run.startTime instanceof Date 
                              ? run.startTime.toLocaleString() 
                              : new Date(run.startTime).toLocaleString()}` 
                          : run.createdAt 
                            ? `Created: ${new Date(run.createdAt).toLocaleString()}` 
                            : 'Not started'}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{run.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {run.testCases?.length || 0} test case{run.testCases?.length !== 1 ? 's' : ''}
                      {run.planId && <span> • Plan: {run.planId}</span>}
                    </p>
                    {run.testCases && run.testCases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {run.testCases.slice(0, 5).map((tc: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tc.name || tc.title || `Case ${idx + 1}`}
                          </Badge>
                        ))}
                        {run.testCases.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{run.testCases.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{(run.results?.length || 0)}/{run.testCases?.length || 0}</span>
                  </div>
                  <Progress 
                    value={run.testCases && run.testCases.length > 0 
                      ? ((run.results?.length || 0) / run.testCases.length) * 100 
                      : 0} 
                    className="h-2"
                  />
                </div>

                {run.results && run.results.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{run.summary?.passed || 0}</div>
                      <div className="text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{run.summary?.failed || 0}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{run.summary?.skipped || 0}</div>
                      <div className="text-muted-foreground">Skipped</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {run.summary?.duration ? Math.round(run.summary.duration / 1000) : 0}s
                      </div>
                      <div className="text-muted-foreground">Duration</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {run.status === 'pending' && run.testCases && run.testCases.length > 0 && (
                    <Button 
                      onClick={() => executeTestRun(run.id)}
                      disabled={isLoading}
                      size="sm"
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {isLoading ? "Executing..." : "Execute"}
                    </Button>
                  )}
                  {run.status === 'running' && (
                    <Badge variant="default" className="animate-pulse">
                      Running...
                    </Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}