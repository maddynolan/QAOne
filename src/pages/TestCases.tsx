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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  color = 'amber' 
}: { 
  label: string; 
  value: number | string; 
  icon: React.ElementType;
  color?: 'amber' | 'green' | 'red' | 'blue';
}) {
  const colorClasses = {
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/20',
    green: 'from-green-500/20 to-emerald-500/20 text-green-500 border-green-500/20',
    red: 'from-red-500/20 to-rose-500/20 text-red-500 border-red-500/20',
    blue: 'from-blue-500/20 to-cyan-500/20 text-blue-500 border-blue-500/20',
  };

  return (
    <div className={cn(
      "p-4 rounded-xl bg-gradient-to-br border",
      colorClasses[color]
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          color === 'amber' && "bg-amber-500/20",
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
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
    }
    switch (testCase.lastResult) {
      case 'passed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAutomationBadge = () => {
    switch (testCase.automationStatus) {
      case 'full': return <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Automated</Badge>;
      case 'partial': return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Partial</Badge>;
      default: return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Manual</Badge>;
    }
  };

  return (
    <Card className="bg-gray-900/50 border-gray-800 hover:border-amber-500/30 transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {testCase.name || testCase.title || 'Untitled'}
              </h3>
            </div>
            
            {/* Description */}
            {testCase.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {testCase.description}
              </p>
            )}
            
            {/* Meta row */}
            <div className="flex items-center gap-3 mt-3">
              {getAutomationBadge()}
              <span className="text-xs text-gray-500">
                {testCase.steps?.length || 0} steps
              </span>
              {testCase.priority && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    testCase.priority === 'critical' && "text-red-400 border-red-400/30",
                    testCase.priority === 'high' && "text-orange-400 border-orange-400/30",
                    testCase.priority === 'medium' && "text-amber-400 border-amber-400/30",
                    testCase.priority === 'low' && "text-gray-400 border-gray-400/30"
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
                  ? "text-amber-400 bg-amber-500/10" 
                  : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
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
              className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              title="Open in Builder"
            >
              <Wrench className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900 dark:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                <DropdownMenuItem onClick={onEdit} className="text-gray-300 focus:bg-gray-800">
                  <Edit className="h-4 w-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onBuilder} className="text-gray-300 focus:bg-gray-800">
                  <Wrench className="h-4 w-4 mr-2" /> Open Builder
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem onClick={onDelete} className="text-red-400 focus:bg-red-500/10">
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
      <div className="text-center py-6 text-gray-500">
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
          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            {run.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {run.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
            {run.status === 'running' && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
            {run.status === 'skipped' && <Clock className="w-4 h-4 text-gray-500" />}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-48">{run.testCaseName}</p>
              <p className="text-xs text-gray-500">
                {new Date(run.startTime).toLocaleString()} • {run.mode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              className={cn(
                "text-xs",
                run.status === 'passed' && "bg-green-500/10 text-green-400",
                run.status === 'failed' && "bg-red-500/10 text-red-400",
                run.status === 'running' && "bg-amber-500/10 text-amber-400",
                run.status === 'skipped' && "bg-gray-500/10 text-gray-400"
              )}
            >
              {run.passedSteps}/{run.totalSteps}
            </Badge>
            <ChevronRight className="w-4 h-4 text-gray-600" />
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
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-gray-900 dark:text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {run.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {run.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
            Test Results: {run.testCaseName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{passRate}%</p>
              <p className="text-xs text-gray-400">Pass Rate</p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-400">{run.passedSteps}</p>
              <p className="text-xs text-gray-400">Passed</p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-400">{run.failedSteps}</p>
              <p className="text-xs text-gray-400">Failed</p>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-300">{run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}</p>
              <p className="text-xs text-gray-400">Duration</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progress</span>
              <span className="text-gray-900 dark:text-white">{run.passedSteps}/{run.totalSteps} steps</span>
            </div>
            <Progress value={passRate} className="h-2 bg-gray-800" />
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
                  step.status === 'skipped' && "bg-gray-500/10"
                )}
              >
                <div className="flex items-center gap-2">
                  {step.status === 'passed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                  {step.status === 'skipped' && <Clock className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm text-gray-900 dark:text-white">Step {step.step}: {step.name}</span>
                </div>
                {step.duration && (
                  <span className="text-xs text-gray-500">{step.duration}ms</span>
                )}
              </div>
            ))}
          </div>

          {/* Error message if failed */}
          {run.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{run.error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">
            Close
          </Button>
          <Button 
            onClick={() => {
              // Copy results to clipboard
              const text = `Test: ${run.testCaseName}\nStatus: ${run.status}\nPassed: ${run.passedSteps}/${run.totalSteps}\nDuration: ${run.duration}ms`;
              navigator.clipboard.writeText(text);
              toast.success('Results copied to clipboard');
            }}
            className="bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-700"
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
    
    if (!fullTestCase.steps || fullTestCase.steps.length === 0) {
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
      totalSteps: fullTestCase.steps.length,
      passedSteps: 0,
      failedSteps: 0
    };

    // Add to history
    setExecutionHistory(prev => [newRun, ...prev]);
    toast.info(`Running: ${testCase.name || 'Test'}`, { duration: 2000 });

    try {
      // Check if Electron API is available for Playwright execution
      const electronAPI = (window as any).electronAPI;
      const flowstral = (window as any).flowstral;
      
      if (isElectron() && flowstral?.playwrightRecorder?.runTest) {
        // Use Playwright recorder for automated execution
        const result = await flowstral.playwrightRecorder.runTest(
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

        // Update history
        setExecutionHistory(prev => prev.map(r => r.id === runId ? updatedRun : r));
        
        // Save to localStorage
        const history = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
        history.unshift(updatedRun);
        localStorage.setItem('test_execution_history', JSON.stringify(history.slice(0, 100)));

        // Update test case last result
        setTestCases(prev => prev.map(tc => 
          tc.id === testCase.id 
            ? { ...tc, lastResult: result.success ? 'passed' : 'failed', lastRun: endTime }
            : tc
        ));

        // Show results
        setSelectedRun(updatedRun);
        setStepResults(result.stepResults || []);
        setShowResultsDialog(true);

        if (result.success) {
          toast.success(`✅ Test passed! (${result.passedSteps}/${fullTestCase.steps.length} steps)`);
        } else {
          toast.error(`❌ Test failed: ${result.error || 'Unknown error'}`);
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
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* ─────────────────────────────────────────────────────────────────
            HEADER
            ───────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-7 h-7 text-amber-500" />
              Test Cases
            </h1>
            <p className="text-gray-400 mt-1">Manage your manual and automated test cases</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={loadTestCases} 
              disabled={loading}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              onClick={() => navigate('/test-cases/builder')}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-gray-900 dark:text-white hover:from-amber-400 hover:to-orange-400"
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
          <StatCard label="Total Tests" value={totalCount} icon={Layers} color="amber" />
          <StatCard label="Automated" value={automatedCount} icon={Zap} color="blue" />
          <StatCard label="Passed" value={passedCount} icon={CheckCircle} color="green" />
          <StatCard label="Failed" value={failedCount} icon={AlertCircle} color="red" />
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            SEARCH & FILTERS
            ───────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search test cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:ring-amber-500/20"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-1 border border-gray-800">
            {(['all', 'manual', 'automated', 'passed', 'failed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  filter === f 
                    ? f === 'passed' ? "bg-green-500/10 text-green-500"
                    : f === 'failed' ? "bg-red-500/10 text-red-500"
                    : "bg-amber-500/10 text-amber-500" 
                    : "text-gray-400 hover:text-gray-900 dark:text-white"
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
              "border-gray-700",
              showHistoryPanel ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : "text-gray-400 hover:text-gray-900 dark:text-white"
            )}
          >
            <History className="w-4 h-4 mr-2" />
            History
            {executionHistory.length > 0 && (
              <Badge className="ml-2 h-5 bg-gray-800 text-gray-300">{executionHistory.length}</Badge>
            )}
          </Button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            EXECUTION HISTORY PANEL (collapsible)
            ───────────────────────────────────────────────────────────────── */}
        {showHistoryPanel && (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="py-3 border-b border-gray-800">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-900 dark:text-white">
                <History className="w-4 h-4 text-amber-500" />
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
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <span className="ml-3 text-gray-400">Loading test cases...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No test cases found</h3>
              <p className="text-gray-400 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search criteria' 
                  : 'Create your first test case to get started'}
              </p>
              <Button 
                onClick={() => navigate('/test-cases/builder')}
                className="bg-gradient-to-r from-amber-500 to-orange-500"
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
