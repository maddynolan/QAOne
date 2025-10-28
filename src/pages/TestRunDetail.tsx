import { ArrowLeft, Play, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { testExecutionService, TestRun } from "@/lib/test-execution-service";
import { toast } from "sonner";

export default function TestRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadTestRun(id);
    }
  }, [id]);

  const loadTestRun = (runId: string) => {
    const run = testExecutionService.getTestRun(runId);
    setTestRun(run || null);
  };

  const executeTestRun = async () => {
    if (!testRun) return;
    
    setIsLoading(true);
    try {
      const run = await testExecutionService.executeTestRun(testRun.id);
      setTestRun(run);
      toast.success("Test run completed!");
    } catch (error) {
      toast.error(`Failed to execute test run: ${error.message}`);
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

  if (!testRun) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/runs')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Test Runs
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Test Run Not Found</h3>
              <p className="text-muted-foreground">
                The test run you're looking for doesn't exist or has been deleted.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/runs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Test Runs
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold gradient-text">{testRun.name}</h1>
          <p className="text-muted-foreground mt-1">
            {testRun.startTime ? `Started: ${testRun.startTime.toLocaleString()}` : 'Not started'}
            {testRun.endTime && ` • Completed: ${testRun.endTime.toLocaleString()}`}
          </p>
        </div>
        {testRun.status === 'pending' && (
          <Button 
            onClick={executeTestRun}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Test Run
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Test Run Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{testRun.summary.total}</div>
              <div className="text-muted-foreground">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{testRun.summary.passed}</div>
              <div className="text-muted-foreground">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{testRun.summary.failed}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{testRun.summary.skipped}</div>
              <div className="text-muted-foreground">Skipped</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{testRun.results.length}/{testRun.testCases.length}</span>
            </div>
            <Progress 
              value={(testRun.results.length / testRun.testCases.length) * 100} 
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Test Results</h2>
        {testRun.results.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                <p className="text-muted-foreground">
                  Execute the test run to see results
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {testRun.results.map((result) => {
              const testCase = testRun.testCases.find(tc => tc.case_id === result.case_id);
              return (
                <Card key={result.case_id}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(result.status)}>
                        {getStatusIcon(result.status)}
                        <span className="ml-1">{result.status}</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {result.duration}ms
                      </span>
                    </div>
                    <CardTitle className="text-lg">
                      {testCase?.title || `Test Case ${result.case_id}`}
                    </CardTitle>
                    {testCase?.description && (
                      <p className="text-sm text-muted-foreground">
                        {testCase.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.error && (
                      <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                        <code className="text-sm text-red-600 dark:text-red-400">
                          {result.error}
                        </code>
                      </div>
                    )}
                    
                    {result.logs && result.logs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Execution Logs</h4>
                        <div className="bg-muted p-3 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap">
                            {result.logs.join('\n')}
                          </pre>
                        </div>
                      </div>
                    )}

                    {result.screenshots && result.screenshots.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Screenshots</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {result.screenshots.map((screenshot, index) => (
                            <img
                              key={index}
                              src={`data:image/png;base64,${screenshot}`}
                              alt={`Screenshot ${index + 1}`}
                              className="rounded-lg border"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}