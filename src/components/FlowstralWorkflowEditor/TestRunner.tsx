import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, Square, CheckCircle, XCircle, Loader2, 
  Clock, AlertCircle, FileText, Download, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TestRunnerProps {
  script: string;
  workflowName: string;
}

interface TestResult {
  status: 'running' | 'passed' | 'failed' | 'error' | null;
  duration?: number;
  logs?: string[];
  error?: string;
  screenshots?: string[];
  video?: string;
  trace?: string;
  stdout?: string;
  stderr?: string;
}

export default function TestRunner({ script, workflowName }: TestRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult>({ status: null });
  const [showDetails, setShowDetails] = useState(false);

  const executeTest = async () => {
    if (!script || script.trim().length === 0) {
      toast.error('No script to execute. Please generate a script first.');
      return;
    }

    setIsRunning(true);
    setResult({ status: 'running' });
    toast.loading('Executing test...', { id: 'test-execution' });

    try {
      // Create a test case object from the script
      const testCase = {
        title: workflowName || 'Workflow Test',
        description: 'Generated from Flowstral Workflow Editor',
        steps: extractStepsFromScript(script),
        framework: 'playwright',
        test_code: script
      };

      // Execute via backend API - use correct endpoint
      // The automation router has prefix "/automation" and is mounted at root
      const response = await fetch(`${API_BASE_URL}/automation/execute-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_code: script,
          test_name: workflowName || 'Workflow Test',
          browser: 'chromium',
          headless: false, // Show browser for debugging
          timeout: 30000,
          environment: 'local'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Test execution failed: ${errorText}`);
      }

      const data = await response.json();
      
      // The API returns { status: "success", execution_result: {...} }
      const executionResult = data.execution_result || data.result || data;

      const testResult: TestResult = {
        status: executionResult.status === 'success' || executionResult.status === 'passed' ? 'passed' : 
                executionResult.status === 'failed' ? 'failed' : 'error',
        duration: executionResult.duration || executionResult.execution_time,
        logs: executionResult.logs || [],
        error: executionResult.error,
        screenshots: executionResult.screenshots || [],
        video: executionResult.video,
        trace: executionResult.trace,
        stdout: executionResult.stdout,
        stderr: executionResult.stderr
      };

      setResult(testResult);
      setIsRunning(false);

      if (testResult.status === 'passed') {
        toast.success(`Test passed in ${testResult.duration}ms`, { id: 'test-execution' });
      } else {
        toast.error(`Test ${testResult.status}: ${testResult.error || 'Unknown error'}`, { id: 'test-execution' });
      }
    } catch (error: any) {
      setResult({
        status: 'error',
        error: error.message || 'Failed to execute test'
      });
      setIsRunning(false);
      toast.error(`Test execution error: ${error.message}`, { id: 'test-execution' });
    }
  };

  const extractStepsFromScript = (script: string): any[] => {
    // Extract steps from Playwright script for display
    const steps: any[] = [];
    const lines = script.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('// Step') || line.includes('//')) {
        const stepMatch = line.match(/\/\/\s*(Step\s+\d+)?:?\s*(.+)/);
        if (stepMatch) {
          steps.push({
            step_number: steps.length + 1,
            action: stepMatch[2] || line.replace('//', '').trim(),
            expected: 'Step executed successfully'
          });
        }
      } else if (line.includes('await page.') || line.includes('await expect')) {
        steps.push({
          step_number: steps.length + 1,
          action: line.trim(),
          expected: 'Action completed'
        });
      }
    });

    return steps.length > 0 ? steps : [
      { step_number: 1, action: 'Execute workflow', expected: 'All steps pass' }
    ];
  };

  const getStatusIcon = () => {
    switch (result.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Play className="h-5 w-5" />;
    }
  };

  const getStatusColor = () => {
    switch (result.status) {
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test Execution
            </div>
            {result.status && (
              <Badge className={getStatusColor()}>
                {result.status === 'running' && 'Running...'}
                {result.status === 'passed' && 'Passed'}
                {result.status === 'failed' && 'Failed'}
                {result.status === 'error' && 'Error'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Execute the generated automated script to verify it works correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={executeTest}
              disabled={isRunning || !script}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
            {result.status === 'running' && (
              <Button
                variant="outline"
                onClick={() => {
                  // Cancel would require backend support
                  toast.info('Test execution cannot be cancelled once started');
                }}
              >
                <Square className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>

          {result.status && result.status !== 'running' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="font-medium">
                    Test {result.status === 'passed' ? 'Passed' : result.status === 'failed' ? 'Failed' : 'Error'}
                  </span>
                </div>
                {result.duration && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {result.duration}ms
                  </div>
                )}
              </div>

              {result.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Error</p>
                      <p className="text-xs text-red-700 mt-1">{result.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {result.logs && result.logs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Execution Logs</p>
                  <div className="bg-muted p-3 rounded-lg max-h-48 overflow-y-auto">
                    <pre className="text-xs font-mono">
                      {result.logs.join('\n')}
                    </pre>
                  </div>
                </div>
              )}

              {(result.screenshots && result.screenshots.length > 0) || result.video || result.trace && (
                <div>
                  <p className="text-sm font-medium mb-2">Artifacts</p>
                  <div className="flex flex-wrap gap-2">
                    {result.screenshots?.map((screenshot, idx) => (
                      <Badge key={idx} variant="outline" className="cursor-pointer">
                        <Eye className="h-3 w-3 mr-1" />
                        Screenshot {idx + 1}
                      </Badge>
                    ))}
                    {result.video && (
                      <Badge variant="outline" className="cursor-pointer">
                        <FileText className="h-3 w-3 mr-1" />
                        Video
                      </Badge>
                    )}
                    {result.trace && (
                      <Badge variant="outline" className="cursor-pointer">
                        <FileText className="h-3 w-3 mr-1" />
                        Trace
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDetails(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Full Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Execution Details</DialogTitle>
            <DialogDescription>
              Complete execution results and logs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {result.stdout && (
              <div>
                <p className="text-sm font-medium mb-2">Output</p>
                <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">
                  {result.stdout}
                </pre>
              </div>
            )}
            {result.stderr && (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">Error Output</p>
                <pre className="bg-red-50 p-3 rounded-lg text-xs font-mono overflow-x-auto text-red-800">
                  {result.stderr}
                </pre>
              </div>
            )}
            {result.logs && result.logs.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Logs</p>
                <div className="bg-muted p-3 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-xs font-mono">
                    {result.logs.join('\n')}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

