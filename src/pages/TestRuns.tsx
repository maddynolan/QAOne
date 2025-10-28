import { Play, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { testExecutionService, TestRun } from "@/lib/test-execution-service";
import { dataStorageService } from "@/lib/data-storage";
import { toast } from "sonner";

export default function TestRuns() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTestRuns();
  }, []);

  const loadTestRuns = () => {
    const runs = testExecutionService.getAllTestRuns();
    setTestRuns(runs);
  };

  const createNewTestRun = async () => {
    setIsLoading(true);
    try {
      const testCases = dataStorageService.getTestCases();
      if (testCases.length === 0) {
        toast.error("No test cases available. Please create some test cases first.");
        return;
      }

      const run = await testExecutionService.createTestRun(
        `Test Run ${new Date().toLocaleString()}`,
        testCases
      );
      
      setTestRuns(prev => [...prev, run]);
      toast.success("Test run created successfully!");
    } catch (error) {
      toast.error(`Failed to create test run: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTestRun = async (runId: string) => {
    setIsLoading(true);
    try {
      const run = await testExecutionService.executeTestRun(runId);
      setTestRuns(prev => prev.map(r => r.id === runId ? run : r));
      toast.success("Test run completed!");
    } catch (error) {
      toast.error(`Failed to execute test run: ${error.message}`);
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
          onClick={createNewTestRun}
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
            <Button onClick={createNewTestRun} disabled={isLoading}>
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
                        {run.startTime ? `Started: ${run.startTime.toLocaleString()}` : 'Not started'}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{run.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {run.testCases.length} test cases
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{run.results.length}/{run.testCases.length}</span>
                  </div>
                  <Progress 
                    value={(run.results.length / run.testCases.length) * 100} 
                    className="h-2"
                  />
                </div>

                {run.results.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{run.summary.passed}</div>
                      <div className="text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{run.summary.failed}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{run.summary.skipped}</div>
                      <div className="text-muted-foreground">Skipped</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {Math.round(run.summary.duration / 1000)}s
                      </div>
                      <div className="text-muted-foreground">Duration</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {run.status === 'pending' && (
                    <Button 
                      onClick={() => executeTestRun(run.id)}
                      disabled={isLoading}
                      size="sm"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Execute
                    </Button>
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