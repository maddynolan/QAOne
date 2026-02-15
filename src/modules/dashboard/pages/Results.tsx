/**
 * @module dashboard
 * @page Results
 *
 * Test results overview and drill-down page. Displays aggregated test
 * results with the ability to drill down into individual test runs,
 * failed steps, and execution details.
 *
 * @features
 * - Aggregated test result summaries
 * - Pass/fail/skip status breakdown
 * - Drill-down to individual test run details
 * - Result filtering by status, date, and suite
 * - Result cleanup and management
 *
 * @api /test-runs/* - Test run results
 * @api /dashboard/* - Dashboard result metrics
 *
 * @dependencies Results uses lucide-react icons, shadcn/ui Card, Badge, Button, Progress
 */
import { BarChart3, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resultsIngestionService, TestRunData } from "@/lib/results-ingestion-service";
import { testExecutionService } from "@/lib/test-execution-service";
import { toast } from "sonner";

export default function Results() {
  const [results, setResults] = useState<TestRunData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = () => {
    const allResults = resultsIngestionService.getAllResults();
    setResults(allResults);
  };

  const ingestTestRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const testRun = testExecutionService.getTestRun(runId);
      if (!testRun) {
        toast.error("Test run not found");
        return;
      }

      const runData: TestRunData = {
        run_id: testRun.id,
        org_id: "550e8400-e29b-41d4-a716-446655440000", // Mock org ID
        project_id: "550e8400-e29b-41d4-a716-446655440001", // Mock project ID
        test_cases: testRun.results.map(result => ({
          case_id: result.case_id,
          status: result.status,
          duration: result.duration,
          error: result.error,
          screenshots: result.screenshots,
          logs: result.logs
        })),
        metadata: {
          environment: "Test Environment",
          browser: "Chromium",
          timestamp: testRun.startTime?.toISOString() || new Date().toISOString(),
          duration: testRun.summary.duration
        }
      };

      await resultsIngestionService.ingestResults(runData);
      setResults(prev => [...prev, runData]);
      toast.success("Test run results ingested successfully!");
    } catch (error) {
      toast.error(`Failed to ingest results: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'skipped':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getSuccessRate = (run: TestRunData) => {
    const total = run.test_cases.length;
    const passed = run.test_cases.filter(tc => tc.status === 'passed').length;
    return total > 0 ? (passed / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Test Results</h1>
          <p className="text-muted-foreground mt-1">View and analyze test execution results</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadResults}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {results.length > 0 && (
            <Button 
              onClick={() => {
                resultsIngestionService.clearResults();
                setResults([]);
                toast.success('Results cleared');
              }}
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
          <Button 
            onClick={() => navigate('/runs')}
            variant="outline"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Test Runs
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">{results.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">
                  {results.length > 0 
                    ? `${Math.round(results.reduce((sum, run) => sum + getSuccessRate(run), 0) / results.length)}%`
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {results.length > 0 
                    ? `${Math.round(results.reduce((sum, run) => sum + run.metadata.duration, 0) / results.length / 1000)}s`
                    : '0s'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Last Run</p>
                <p className="text-2xl font-bold">
                  {results.length > 0 
                    ? new Date(results[results.length - 1].metadata.timestamp).toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results List */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Execute some test runs to see results here
            </p>
            <Button onClick={() => navigate('/runs')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Go to Test Runs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {results.map((run) => (
            <Card key={run.run_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {run.metadata.browser}
                      </Badge>
                      <Badge variant="outline">
                        {run.metadata.environment}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.metadata.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg">Run {run.run_id}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {run.test_cases.length} test cases • {Math.round(run.metadata.duration / 1000)}s duration
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span>{Math.round(getSuccessRate(run))}%</span>
                  </div>
                  <Progress value={getSuccessRate(run)} className="h-2" />
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {run.test_cases.filter(tc => tc.status === 'passed').length}
                    </div>
                    <div className="text-muted-foreground">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {run.test_cases.filter(tc => tc.status === 'failed').length}
                    </div>
                    <div className="text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {run.test_cases.filter(tc => tc.status === 'skipped').length}
                    </div>
                    <div className="text-muted-foreground">Skipped</div>
                  </div>
                </div>

                {/* Show failed step info if available */}
                {run.metadata.failed_step && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-700">Failed at Step {run.metadata.failed_step}</span>
                    </div>
                    {run.metadata.error_message && (
                      <p className="text-sm text-red-600 mt-1 font-mono">{run.metadata.error_message}</p>
                    )}
                    {run.metadata.screenshot_path && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📸 Screenshot: {run.metadata.screenshot_path}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/runs/${run.run_id}`)}
                  >
                    View Details
                  </Button>
                  {run.metadata.screenshot_path && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Open screenshot - it's in the backend directory
                        toast.info(`Screenshot saved at: ${run.metadata.screenshot_path}`);
                      }}
                    >
                      View Screenshot
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


