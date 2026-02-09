/**
 * Test Cases - Unified Test Case Management
 * 
 * Clean, modern design with amber accent theme
 * Supports both manual and automated test cases
 * 
 * Features:
 * - Quick Run from list (no need to open builder)
 * - Execution history tracking
 * - Pass/fail filtering
 * - Data-driven test support
 */

import { 
  Plus, Edit, Trash2, RefreshCw, Loader2, Play, Search, 
  Wrench, FileText, Zap, Filter, MoreVertical, CheckCircle,
  Clock, AlertCircle, Layers, History, XCircle, ChevronRight,
  BarChart3, Calendar, TrendingUp, Database, Copy, Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { isElectron } from "@/lib/electron-bridge";

import { API_BASE_URL } from "@/lib/api-config";

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION HISTORY TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ExecutionRun {
  id: string;
  testCaseId: string;
  testCaseName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  mode: 'manual' | 'automated';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  duration?: number;
  error?: string;
}

interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  type?: string;
  category?: string;
  status?: string;
  priority?: string;
  steps?: any[];
  tags?: string[];
  createdAt?: string;
  automationStatus?: 'none' | 'partial' | 'full';
  lastRun?: string;
  lastResult?: 'passed' | 'failed' | 'skipped';
}

// ═══════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color = 'primary' 
}: { 
  label: string; 
  value: number | string; 
  icon: React.ElementType;
  color?: 'primary' | 'green' | 'red' | 'blue';
}) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border",
      colorClasses[color]
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          color === 'primary' && "bg-primary/20",
          color === 'green' && "bg-green-500/20",
          color === 'red' && "bg-red-500/20",
          color === 'blue' && "bg-blue-500/20"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function TestCaseCard({ 
  testCase, 
  onEdit, 
  onDelete, 
  onBuilder,
  onRun,
  isRunning = false
}: { 
  testCase: TestCase;
  onEdit: () => void;
  onDelete: () => void;
  onBuilder: () => void;
  onRun: () => void;
  isRunning?: boolean;
}) {
  const getStatusIcon = () => {
    if (isRunning) {
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    }
    switch (testCase.lastResult) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getAutomationBadge = () => {
    switch (testCase.automationStatus) {
      case 'full': return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">Automated</Badge>;
      case 'partial': return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Partial</Badge>;
      default: return <Badge className="bg-secondary text-muted-foreground border-border">Manual</Badge>;
    }
  };

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="font-semibold text-foreground truncate">
                {testCase.name || testCase.title || 'Untitled'}
              </h3>
            </div>
            
            {/* Description */}
            {testCase.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {testCase.description}
              </p>
            )}
            
            {/* Meta row */}
            <div className="flex items-center gap-3 mt-3">
              {getAutomationBadge()}
              <span className="text-xs text-muted-foreground">
                {testCase.steps?.length || 0} steps
              </span>
              {testCase.priority && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    testCase.priority === 'critical' && "text-red-600 dark:text-red-400 border-red-400/30",
                    testCase.priority === 'high' && "text-orange-600 dark:text-orange-400 border-orange-400/30",
                    testCase.priority === 'medium' && "text-yellow-600 dark:text-yellow-400 border-yellow-400/30",
                    testCase.priority === 'low' && "text-muted-foreground border-border"
                  )}
                >
                  {testCase.priority}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className={cn(
            "flex items-center gap-1 transition-opacity",
            isRunning ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRun}
              disabled={isRunning}
              className={cn(
                "h-8 w-8",
                isRunning 
                  ? "text-primary bg-primary/10" 
                  : "text-green-600 dark:text-green-400 hover:text-green-700 hover:bg-green-500/10"
              )}
              title={isRunning ? "Running..." : "Run test"}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onBuilder}
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
              title="Open in Builder"
            >
              <Wrench className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={onEdit} className="text-foreground focus:bg-accent">
                  <Edit className="h-4 w-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBuilder} className="text-foreground focus:bg-accent">
                  <Wrench className="h-4 w-4 mr-2" /> Open Builder
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION HISTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════

function ExecutionHistoryPanel({ 
  runs, 
  onViewDetails 
}: { 
  runs: ExecutionRun[];
  onViewDetails: (run: ExecutionRun) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recent executions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {runs.slice(0, 10).map((run) => (
        <div
          key={run.id}
          onClick={() => onViewDetails(run)}
          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            {run.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {run.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
            {run.status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {run.status === 'skipped' && <Clock className="w-4 h-4 text-muted-foreground" />}
            <div>
              <p className="text-sm font-medium text-foreground truncate max-w-48">{run.testCaseName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(run.startTime).toLocaleString()} • {run.mode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              className={cn(
                "text-xs",
                run.status === 'passed' && "bg-green-500/10 text-green-600 dark:text-green-400",
                run.status === 'failed' && "bg-red-500/10 text-red-600 dark:text-red-400",
                run.status === 'running' && "bg-primary/10 text-primary",
                run.status === 'skipped' && "bg-secondary text-muted-foreground"
              )}
            >
              {run.passedSteps}/{run.totalSteps}
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN RESULTS DIALOG
// ═══════════════════════════════════════════════════════════════════════════

function RunResultsDialog({
  open,
  onClose,
  run,
  stepResults
}: {
  open: boolean;
  onClose: () => void;
  run: ExecutionRun | null;
  stepResults: Array<{ step: number; name: string; status: string; error?: string; duration?: number }>;
}) {
  if (!run) return null;

  const passRate = run.totalSteps > 0 ? Math.round((run.passedSteps / run.totalSteps) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {run.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {run.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
            Test Results: {run.testCaseName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-secondary rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{passRate}%</p>
              <p className="text-xs text-muted-foreground">Pass Rate</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{run.passedSteps}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{run.failedSteps}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="p-3 bg-secondary rounded-lg text-center">
              <p className="text-2xl font-bold text-foreground">{run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}</p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground">{run.passedSteps}/{run.totalSteps} steps</span>
            </div>
            <Progress value={passRate} className="h-2 bg-secondary" />
          </div>

          {/* Step results */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {stepResults.map((step, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg",
                  step.status === 'passed' && "bg-green-500/10",
                  step.status === 'failed' && "bg-red-500/10",
                  step.status === 'skipped' && "bg-secondary"
                )}
              >
                <div className="flex items-center gap-2">
                  {step.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                  {step.status === 'skipped' && <Clock className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm text-foreground">Step {step.step}: {step.name}</span>
                </div>
                {step.duration && (
                  <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                )}
              </div>
            ))}
          </div>

          {/* Error message if failed */}
          {run.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{run.error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground">
            Close
          </Button>
          <Button 
            onClick={() => {
              // Copy results to clipboard
              const text = `Test: ${run.testCaseName}\nStatus: ${run.status}\nPassed: ${run.passedSteps}/${run.totalSteps}\nDuration: ${run.duration}ms`;
              navigator.clipboard.writeText(text);
              toast.success('Results copied to clipboard');
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TestCases() {
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<'all' | 'manual' | 'automated' | 'passed' | 'failed'>('all');
  
  // Execution state
  const [executionHistory, setExecutionHistory] = useState<ExecutionRun[]>([]);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);
  const [stepResults, setStepResults] = useState<Array<{ step: number; name: string; status: string; error?: string; duration?: number }>>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Load test cases
  const loadTestCases = async () => {
    setLoading(true);
    const allCases: TestCase[] = [];
    
    try {
      // Load from localStorage first
      const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
      allCases.push(...local);
      
      // Also load unified test cases
      const unifiedKeys = Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_'));
      for (const key of unifiedKeys) {
        try {
          const tc = JSON.parse(localStorage.getItem(key) || '{}');
          if (tc.id && !allCases.some(c => c.id === tc.id)) {
            allCases.push({
              ...tc,
              name: tc.name || 'Unnamed Test',
              automationStatus: tc.steps?.some((s: any) => s.automationStatus === 'recorded') ? 'partial' : 'none'
            });
          }
        } catch (e) {}
      }
      
      // Try backend (with timeout)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`, {
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          const backendCases = Array.isArray(data) ? data : (data.value || data.test_cases || []);
          backendCases.forEach((tc: TestCase) => {
            if (!allCases.some(c => c.id === tc.id)) {
              allCases.push({
                ...tc,
                name: tc.name || tc.title || `Test Case ${tc.id?.slice(0, 8) || 'Unknown'}`
              });
            }
          });
        }
      } catch (e) {
        console.log('Backend timeout/error, using local only');
      }
      
      setTestCases(allCases);
    } catch (error) {
      console.error('Error loading test cases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestCases();
  }, []);

  // Load execution history from localStorage
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
    setExecutionHistory(history);
  }, []);

  // Quick Run handler - runs test directly without opening builder
  const handleQuickRun = useCallback(async (testCase: TestCase) => {
    if (runningTestId) {
      toast.error('A test is already running');
      return;
    }

    // Get the full test case data
    const fullTestCase = JSON.parse(localStorage.getItem(`unified_test_case_${testCase.id}`) || 'null') || testCase;
    
    // Detect if this is an API test case
    const isApiTest = fullTestCase.category === 'api' || fullTestCase.type === 'api' || 
      fullTestCase.testType === 'api' || fullTestCase.test_type === 'api' ||
      (fullTestCase.tags && fullTestCase.tags.some((t: string) => t === 'api-testing' || t === 'api'));

    if (!isApiTest && (!fullTestCase.steps || fullTestCase.steps.length === 0)) {
      toast.error('No steps found in this test case');
      return;
    }

    setRunningTestId(testCase.id);
    const runId = `run_${Date.now()}`;
    const newRun: ExecutionRun = {
      id: runId,
      testCaseId: testCase.id,
      testCaseName: testCase.name || 'Unnamed Test',
      startTime: new Date().toISOString(),
      status: 'running',
      mode: 'automated',
      totalSteps: isApiTest ? 1 : fullTestCase.steps.length,
      passedSteps: 0,
      failedSteps: 0
    };

    // Add to history
    setExecutionHistory(prev => [newRun, ...prev]);
    toast.info(`Running: ${testCase.name || 'Test'}`, { duration: 2000 });

    try {
      if (isApiTest) {
        // API test: execute via API testing engine backend
        const method = fullTestCase.method || "GET";
        const endpoint = fullTestCase.endpoint || fullTestCase.path || fullTestCase.url || "";
        // If endpoint is a relative path, it will be combined with base_url by the backend
        // For full URLs (starting with http), pass as-is; otherwise use as path
        const isFullUrl = endpoint.startsWith("http://") || endpoint.startsWith("https://");
        const testPath = isFullUrl ? endpoint : (endpoint.startsWith("/") ? endpoint : `/${endpoint}`);
        
        // Parse headers and body safely
        let parsedHeaders: Record<string, string> = { "Content-Type": "application/json" };
        try {
          if (fullTestCase.headers && typeof fullTestCase.headers === "string") {
            parsedHeaders = JSON.parse(fullTestCase.headers);
          } else if (fullTestCase.headers && typeof fullTestCase.headers === "object") {
            parsedHeaders = fullTestCase.headers;
          }
        } catch { /* keep defaults */ }

        let parsedBody: any = undefined;
        try {
          if (fullTestCase.request_body && typeof fullTestCase.request_body === "string") {
            parsedBody = JSON.parse(fullTestCase.request_body);
          } else if (fullTestCase.request_body && typeof fullTestCase.request_body === "object") {
            parsedBody = fullTestCase.request_body;
          }
        } catch { /* keep undefined */ }

        // Parse assertions safely
        let parsedAssertions: any[] = [];
        try {
          if (fullTestCase.assertions && typeof fullTestCase.assertions === "string") {
            parsedAssertions = JSON.parse(fullTestCase.assertions);
          } else if (Array.isArray(fullTestCase.assertions)) {
            parsedAssertions = fullTestCase.assertions;
          }
        } catch { /* keep empty */ }

        const response = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_suite: {
              test_cases: [{
                test_case_id: testCase.id,
                title: testCase.name || "API Test",
                method: method,
                path: testPath,
                request: {
                  headers: parsedHeaders,
                  body: parsedBody,
                },
                expected_status: parseInt(fullTestCase.expected_status) || 200,
                assertions: parsedAssertions,
                test_type: "functional",
              }],
              base_url: isFullUrl ? "" : "",
            },
            execution_config: { base_url: "", parallel: false },
            mode: "automated",
          }),
        });

        const data = await response.json();
        const testResult = data?.execution_results?.test_results?.[0];
        const endTime = new Date().toISOString();
        const passed = testResult?.status === "passed";

        const updatedRun: ExecutionRun = {
          ...newRun,
          endTime,
          status: passed ? 'passed' : 'failed',
          passedSteps: passed ? 1 : 0,
          failedSteps: passed ? 0 : 1,
          duration: testResult?.response_time_ms || (new Date(endTime).getTime() - new Date(newRun.startTime).getTime()),
          error: testResult?.error || undefined
        };

        setExecutionHistory(prev => prev.map(r => r.id === runId ? updatedRun : r));
        const history = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
        history.unshift(updatedRun);
        localStorage.setItem('test_execution_history', JSON.stringify(history.slice(0, 100)));

        setTestCases(prev => prev.map(tc => 
          tc.id === testCase.id 
            ? { ...tc, lastResult: passed ? 'passed' : 'failed', lastRun: endTime }
            : tc
        ));

        // Show results with API details
        setSelectedRun(updatedRun);
        setStepResults([{
          step: `${method} ${endpoint}`,
          status: passed ? 'passed' : 'failed',
          duration: testResult?.response_time_ms || 0,
          details: `Status: ${testResult?.actual_status || 'N/A'} | Expected: ${fullTestCase.expected_status || 200}`,
          error: testResult?.error
        }]);
        setShowResultsDialog(true);

        if (passed) {
          toast.success(`Test passed! ${method} ${endpoint} returned ${testResult?.actual_status}`);
        } else {
          toast.error(`Test failed: ${testResult?.error || `Expected ${fullTestCase.expected_status || 200}, got ${testResult?.actual_status || 'error'}`}`);
        }
      } else if (isElectron() && (window as any).flowstral?.playwrightRecorder?.runTest) {
        // Use Playwright recorder for automated execution
        const result = await (window as any).flowstral.playwrightRecorder.runTest(
          fullTestCase.steps.map((step: any) => ({
            type: step.type,
            selector: step.selector,
            value: step.value || step.args?.[0],
            url: step.url,
            description: step.description,
            assertion: step.assertion
          }))
        );

        const endTime = new Date().toISOString();
        const updatedRun: ExecutionRun = {
          ...newRun,
          endTime,
          status: result.success ? 'passed' : 'failed',
          passedSteps: result.passedSteps || 0,
          failedSteps: result.failedSteps || 0,
          duration: result.duration || (new Date(endTime).getTime() - new Date(newRun.startTime).getTime()),
          error: result.error
        };

        setExecutionHistory(prev => prev.map(r => r.id === runId ? updatedRun : r));
        const history = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
        history.unshift(updatedRun);
        localStorage.setItem('test_execution_history', JSON.stringify(history.slice(0, 100)));

        setTestCases(prev => prev.map(tc => 
          tc.id === testCase.id 
            ? { ...tc, lastResult: result.success ? 'passed' : 'failed', lastRun: endTime }
            : tc
        ));

        setSelectedRun(updatedRun);
        setStepResults(result.stepResults || []);
        setShowResultsDialog(true);

        if (result.success) {
          toast.success(`Test passed! (${result.passedSteps}/${fullTestCase.steps.length} steps)`);
        } else {
          toast.error(`Test failed: ${result.error || 'Unknown error'}`);
        }
      } else {
        // Fallback: Navigate to builder for execution
        toast.info('Opening in Builder for execution...');
        navigate(`/builder?testCaseId=${testCase.id}&autoRun=true`);
      }
    } catch (error: any) {
      console.error('Quick run error:', error);
      const endTime = new Date().toISOString();
      const updatedRun: ExecutionRun = {
        ...newRun,
        endTime,
        status: 'failed',
        failedSteps: 1,
        duration: new Date(endTime).getTime() - new Date(newRun.startTime).getTime(),
        error: error.message || 'Execution failed'
      };
      setExecutionHistory(prev => prev.map(r => r.id === runId ? updatedRun : r));
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setRunningTestId(null);
    }
  }, [runningTestId, navigate]);

  // Filter test cases
  const filteredCases = testCases.filter(tc => {
    const matchesSearch = !searchTerm || 
      tc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = filter === 'all';
    if (filter === 'automated') {
      matchesFilter = tc.automationStatus === 'full' || tc.automationStatus === 'partial';
    } else if (filter === 'manual') {
      matchesFilter = !tc.automationStatus || tc.automationStatus === 'none';
    } else if (filter === 'passed') {
      matchesFilter = tc.lastResult === 'passed';
    } else if (filter === 'failed') {
      matchesFilter = tc.lastResult === 'failed';
    }
    
    return matchesSearch && matchesFilter;
  });

  // Stats
  const totalCount = testCases.length;
  const automatedCount = testCases.filter(tc => tc.automationStatus === 'full' || tc.automationStatus === 'partial').length;
  const passedCount = testCases.filter(tc => tc.lastResult === 'passed').length;
  const failedCount = testCases.filter(tc => tc.lastResult === 'failed').length;

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test case?')) return;
    
    setTestCases(prev => prev.filter(tc => tc.id !== id));
    
    const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localStorage.setItem('test_cases', JSON.stringify(local.filter((tc: any) => tc.id !== id)));
    localStorage.removeItem(`unified_test_case_${id}`);
    
    fetch(`${API_BASE_URL}/test-cases/${id}`, { method: 'DELETE' }).catch(() => {});
    
    toast.success('Test case deleted');
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* ─────────────────────────────────────────────────────────────────
            HEADER
            ───────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Test Cases
            </h1>
            <p className="text-muted-foreground mt-1">Manage your manual and automated test cases</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadTestCases} 
              disabled={loading}
              className="border-border text-foreground hover:bg-accent"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              onClick={() => navigate('/test-cases/builder')}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Test Case
            </Button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            STATS
            ───────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Tests" value={totalCount} icon={Layers} color="primary" />
          <StatCard label="Automated" value={automatedCount} icon={Zap} color="blue" />
          <StatCard label="Passed" value={passedCount} icon={CheckCircle} color="green" />
          <StatCard label="Failed" value={failedCount} icon={AlertCircle} color="red" />
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            SEARCH & FILTERS
            ───────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search test cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 border border-border">
            {(['all', 'manual', 'automated', 'passed', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  filter === f 
                    ? f === 'passed' ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : f === 'failed' ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className={cn(
              "border-border",
              showHistoryPanel ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="w-4 h-4 mr-2" />
            History
            {executionHistory.length > 0 && (
              <Badge className="ml-2 h-5 bg-secondary text-muted-foreground">{executionHistory.length}</Badge>
            )}
          </Button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            EXECUTION HISTORY PANEL (collapsible)
            ───────────────────────────────────────────────────────────────── */}
        {showHistoryPanel && (
          <Card className="bg-card border-border">
            <CardHeader className="py-3 border-b border-border">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <History className="w-4 h-4 text-primary" />
                Recent Executions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ExecutionHistoryPanel 
                runs={executionHistory}
                onViewDetails={(run) => {
                  setSelectedRun(run);
                  // Try to get step results from localStorage
                  const stored = JSON.parse(localStorage.getItem(`run_results_${run.id}`) || '[]');
                  setStepResults(stored);
                  setShowResultsDialog(true);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TEST CASE LIST
            ───────────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading test cases...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No test cases found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm 
                  ? 'Try adjusting your search criteria' 
                  : 'Create your first test case to get started'}
              </p>
              <Button 
                onClick={() => navigate('/test-cases/builder')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Test Case
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredCases.map((tc) => (
              <TestCaseCard
                key={tc.id}
                testCase={tc}
                isRunning={runningTestId === tc.id}
                onEdit={() => navigate(`/builder?testCaseId=${tc.id}`)}
                onDelete={() => handleDelete(tc.id)}
                onBuilder={() => navigate(`/builder?testCaseId=${tc.id}`)}
                onRun={() => handleQuickRun(tc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Run Results Dialog */}
      <RunResultsDialog
        open={showResultsDialog}
        onClose={() => setShowResultsDialog(false)}
        run={selectedRun}
        stepResults={stepResults}
      />
    </div>
  );
}
