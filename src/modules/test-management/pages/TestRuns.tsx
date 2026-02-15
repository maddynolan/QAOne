/**
 * @module test-management
 * @page TestRuns
 *
 * Test run listing, execution history, and reporting dashboard. Shows all
 * test executions with status, duration, pass/fail metrics, and drill-down
 * to individual step results.
 *
 * @features
 * - Test run listing with status indicators
 * - Execution history and trend tracking
 * - Run creation and management
 * - Real-time execution progress via WebSocket
 * - Run comparison and regression analysis
 *
 * @api /test-runs/* - Test run execution and reporting (14 endpoints)
 *
 * @dependencies TestRuns uses lucide-react icons, shadcn/ui Card, Badge, Button, Progress
 */
import { Play, Clock, CheckCircle, XCircle, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface TestRun {
  id: string;
  name: string;
  status: string;
  suite_id?: string;
  test_case_ids: string[];
  results: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  browser: string;
  environment: string;
}

export default function TestRuns() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTestRuns();
  }, []);

  const loadTestRuns = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/db/test-runs?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setTestRuns(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to load test runs:', response.statusText);
        setTestRuns([]);
      }
    } catch (error) {
      console.error('Error loading test runs:', error);
      toast.error('Failed to load test runs');
      setTestRuns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewTestRun = async () => {
    setIsLoading(true);
    try {
      // Get test cases from DB
      const casesRes = await fetch(`${API_BASE_URL}/api/db/test-cases?limit=1000`);
      if (!casesRes.ok) throw new Error('Failed to load test cases');
      const testCases = await casesRes.json();
      
      if (!Array.isArray(testCases) || testCases.length === 0) {
        toast.error("No test cases available. Create test cases first.");
        return;
      }

      // Create test run in database
      const response = await fetch(`${API_BASE_URL}/api/db/test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Run ${new Date().toLocaleString()}`,
          test_case_ids: testCases.map((tc: any) => tc.id),
          browser: 'chromium',
          environment: 'production',
        })
      });

      if (!response.ok) throw new Error('Failed to create test run');
      
      toast.success(`Test run created with ${testCases.length} test case(s)!`);
      await loadTestRuns();
    } catch (error: any) {
      toast.error(`Failed to create test run: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTestRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const run = testRuns.find(r => r.id === runId);
      if (!run) {
        toast.error("Test run not found");
        return;
      }

      // Update status to running
      await fetch(`${API_BASE_URL}/api/db/test-runs/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() })
      });

      // Get test case details
      const testCaseDetails = [];
      for (const tcId of (run.test_case_ids || [])) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/db/test-cases/${tcId}`);
          if (res.ok) testCaseDetails.push(await res.json());
        } catch {}
      }

      if (testCaseDetails.length === 0) {
        toast.error("No test cases found for this run");
        return;
      }

      // Execute via API testing engine
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_suite: {
            test_cases: testCaseDetails.map((tc: any) => ({
              test_case_id: tc.id,
              title: tc.name || "Test",
              method: tc.metadata?.method || "GET",
              path: tc.metadata?.endpoint || "",
              request: {
                headers: tc.metadata?.headers ? (typeof tc.metadata.headers === 'string' ? JSON.parse(tc.metadata.headers) : tc.metadata.headers) : { "Content-Type": "application/json" },
                body: tc.metadata?.request_body ? (typeof tc.metadata.request_body === 'string' ? JSON.parse(tc.metadata.request_body) : tc.metadata.request_body) : undefined,
              },
              expected_status: parseInt(tc.metadata?.expected_status) || 200,
              assertions: tc.metadata?.assertions || [],
              test_type: tc.category || "functional",
            })),
            base_url: "",
          },
          execution_config: { base_url: "", parallel: true },
          mode: "automated",
        }),
      });

      const result = await response.json();
      const summary = result?.execution_results?.summary || {};
      const passed = summary.passed || 0;
      const failed = summary.failed || 0;

      // Update run with results
      await fetch(`${API_BASE_URL}/api/db/test-runs/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: failed === 0 ? 'passed' : 'failed',
          completed_at: new Date().toISOString(),
          results: JSON.stringify({ summary, test_results: result?.execution_results?.test_results || [] })
        })
      });

      toast.success(`Test run completed! ${passed} passed, ${failed} failed`);
      await loadTestRuns();
    } catch (error: any) {
      toast.error(`Failed to execute test run: ${error.message}`);
      // Mark as failed
      await fetch(`${API_BASE_URL}/api/db/test-runs/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', completed_at: new Date().toISOString() })
      }).catch(() => {});
    } finally {
      setIsLoading(false);
      await loadTestRuns();
    }
  };

  const deleteTestRun = async (runId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/db/test-runs/${runId}`, { method: 'DELETE' });
      setTestRuns(prev => prev.filter(r => r.id !== runId));
      toast.success('Test run deleted');
    } catch {
      toast.error('Failed to delete test run');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'running': return <Play className="h-4 w-4 animate-pulse" />;
      case 'passed': case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string): "secondary" | "default" | "destructive" => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'running': return 'default';
      case 'passed': case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  const parseResults = (results: any) => {
    if (!results) return null;
    try {
      return typeof results === 'string' ? JSON.parse(results) : results;
    } catch { return null; }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Runs</h1>
          <p className="text-muted-foreground mt-1">Execute and monitor test runs - data persists across all users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTestRuns} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={createNewTestRun}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Test Run
          </Button>
        </div>
      </div>

      {isLoading && testRuns.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Loading test runs...</div>
      ) : testRuns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Test Runs Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first test run to start executing tests
            </p>
            <Button onClick={createNewTestRun} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Create Test Run
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {testRuns.map((run) => {
            const results = parseResults(run.results);
            const summary = results?.summary || {};
            return (
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
                          {run.started_at 
                            ? `Started: ${new Date(run.started_at).toLocaleString()}` 
                            : run.created_at 
                              ? `Created: ${new Date(run.created_at).toLocaleString()}` 
                              : 'Not started'}
                        </span>
                        <Badge variant="outline" className="text-xs">{run.environment}</Badge>
                      </div>
                      <CardTitle className="text-lg">{run.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {run.test_case_ids?.length || 0} test case{(run.test_case_ids?.length || 0) !== 1 ? 's' : ''}
                        {run.browser && <span> | {run.browser}</span>}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary.total && (
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{summary.passed || 0}</div>
                        <div className="text-muted-foreground">Passed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{summary.failed || 0}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{summary.total || 0}</div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0}%
                        </div>
                        <div className="text-muted-foreground">Pass Rate</div>
                      </div>
                    </div>
                  )}

                  {run.test_case_ids && run.test_case_ids.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Test Cases</span>
                        <span>{run.test_case_ids.length}</span>
                      </div>
                      <Progress 
                        value={run.status === 'passed' || run.status === 'completed' ? 100 : run.status === 'failed' ? 100 : 0}
                        className="h-2"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {run.status === 'pending' && (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTestRun(run.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
