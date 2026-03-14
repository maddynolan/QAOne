/**
 * @module test-management
 * @page TestCaseExecution
 *
 * Step-by-step manual test execution interface with evidence capture.
 * Guides testers through each step, allowing them to mark pass/fail,
 * capture screenshots, attach evidence, and log defects.
 *
 * @features
 * - Sequential step-by-step execution flow
 * - Screenshot capture and evidence attachment
 * - Pass/fail/skip step status tracking
 * - Defect logging from failed steps
 * - Execution timer and progress tracking
 * - Real-time WebSocket execution updates
 *
 * @api /test-runs/* - Test run execution and reporting
 *
 * @dependencies TestCaseExecution uses lucide-react icons, shadcn/ui Card, Badge, Button, Textarea
 */
import { ArrowLeft, CheckCircle, XCircle, Clock, Camera, Bug, ChevronRight, ChevronLeft, SkipForward, ImageIcon, AlertCircle, Save, Home, Trash2, Eye, Globe, MousePointer, Type, Check, Target, List, Plus, Link, Search, Clipboard, Monitor, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from '@/lib/api-config';
import { useExecutionWebSocket, Screenshot } from '@/hooks/useExecutionWebSocket';

// Standard severity and priority definitions following industry standards
const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'S1 - Critical', description: 'System crash, data loss, security breach' },
  { value: 'high', label: 'S2 - High', description: 'Major feature broken, no workaround' },
  { value: 'medium', label: 'S3 - Medium', description: 'Feature impaired but has workaround' },
  { value: 'low', label: 'S4 - Low', description: 'Minor issue, cosmetic' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'P1 - Critical', description: 'Fix immediately' },
  { value: 'high', label: 'P2 - High', description: 'Fix in current sprint' },
  { value: 'medium', label: 'P3 - Medium', description: 'Fix in next sprint' },
  { value: 'low', label: 'P4 - Low', description: 'Fix when time permits' },
];

// Step result interface for manual execution
interface StepResult {
  stepIndex: number;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  notes?: string;
  screenshots?: string[]; // Base64 images
  defectId?: string;
  defectTitle?: string;
  executedAt?: string;
  errorMessage?: string;
}

interface TestStep {
  action: string;
  expectedResult: string;
  qword?: string;
  type?: string;
  selector?: string;
  value?: string;
  args?: Record<string, string | number | boolean>;
  assertion?: {
    type?: string;
    target?: string;
    selector?: string;
    value?: string;
    expectedValue?: string;
  };
}

// Format step for detailed display
const formatStepDetails = (step: TestStep): { action: string; details: { label: string; value: string }[] } => {
  const details: { label: string; value: string }[] = [];
  const qword = step.qword || step.type || step.action?.split(' ')[0] || 'Unknown';
  let actionText = qword;
  const args = step.args || {};
  
  switch (qword.toLowerCase()) {
    case 'goto':
    case 'navigate':
      actionText = 'Navigate to URL';
      if (args.url || args[0]) details.push({ label: 'URL', value: String(args.url || args[0]) });
      break;
    case 'click':
    case 'clicktext':
    case 'clickelement':
      actionText = 'Click Element';
      if (args.selector || step.selector) details.push({ label: 'Selector', value: args.selector || step.selector });
      if (args.text || args[0]) details.push({ label: 'Text', value: args.text || args[0] });
      break;
    case 'fill':
    case 'type':
      actionText = 'Enter Text';
      if (args.selector || step.selector) details.push({ label: 'Field', value: args.selector || step.selector });
      if (args.value || args.text || args[1] || step.value) details.push({ label: 'Value', value: args.value || args.text || args[1] || step.value });
      break;
    case 'asserttext':
    case 'assert':
    case 'verify':
      actionText = 'Verify/Assert';
      if (args[0] || args.text) details.push({ label: 'Expected Text', value: args[0] || args.text });
      break;
    case 'select':
      actionText = 'Select Option';
      if (args.selector || step.selector) details.push({ label: 'Dropdown', value: args.selector || step.selector });
      if (args.value || args[1] || step.value) details.push({ label: 'Option', value: args.value || args[1] || step.value });
      break;
    case 'wait':
      actionText = 'Wait';
      if (args.timeout || args[0]) details.push({ label: 'Duration', value: `${args.timeout || args[0]}ms` });
      break;
    default:
      if (step.action && step.action !== qword) {
        actionText = step.action;
      }
      Object.entries(args).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          details.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value });
        }
      });
  }
  
  return { action: actionText, details };
};

// Build expected result from step data
const buildExpectedResult = (step: Record<string, unknown>): string => {
  if (step.qword === 'AssertText' || step.type === 'assert') {
    const args = step.args as Record<string, unknown> | undefined;
    const assertText = args?.[0] || args?.text || step.value;
    if (assertText) return `✓ Verify "${assertText}" is visible on the page`;
  }
  // Handle multi-assertion array (new) and single assertion (legacy)
  const assertions = step.assertions as Array<Record<string, unknown>> | undefined;
  if (assertions && assertions.length > 0) {
    const enabledAssertions = assertions.filter((a) => a.enabled);
    if (enabledAssertions.length > 0) {
      const descriptions = enabledAssertions.map((a) => {
        if (a.expected) return `✓ ${a.type}: "${a.expected}"`;
        return `✓ ${(a.type || 'verify').replace(/_/g, ' ')}`;
      });
      return descriptions.join('\n');
    }
  }
  const assertion = step.assertion as Record<string, unknown> | undefined;
  if (assertion) {
    const assertValue = assertion.value || assertion.expectedValue || assertion.expected;
    if (assertValue) return `✓ Verify: ${assertValue}`;
  }
  if (typeof step.expectedResult === 'string' && step.expectedResult.trim()) return step.expectedResult;
  if (typeof step.expected_result === 'string' && step.expected_result.trim()) return step.expected_result;

  const qword = (step.qword || step.type || '') as string;
  switch (qword.toLowerCase()) {
    case 'goto':
    case 'navigate':
      return `Page navigates successfully to ${step.args?.url || step.args?.[0] || 'the URL'}`;
    case 'click':
    case 'clicktext':
      return `Element is clicked and responds appropriately`;
    case 'fill':
    case 'type':
      return `Text is entered into the field successfully`;
    case 'select':
      return `Option is selected from dropdown`;
    case 'wait':
      return `Wait completes after specified duration`;
    default:
      return 'Step completes successfully';
  }
};

// Get icon for action type
const getActionIcon = (qword?: string) => {
  switch (qword?.toLowerCase()) {
    case 'goto':
    case 'navigate':
      return <Globe className="w-4 h-4" />;
    case 'click':
    case 'clicktext':
      return <MousePointer className="w-4 h-4" />;
    case 'fill':
    case 'type':
      return <Type className="w-4 h-4" />;
    case 'asserttext':
    case 'assert':
      return <Check className="w-4 h-4" />;
    case 'select':
      return <List className="w-4 h-4" />;
    default:
      return <Target className="w-4 h-4" />;
  }
};

export default function TestCaseExecution() {
  const { runId, testCaseId } = useParams<{ runId: string; testCaseId: string }>();
  const navigate = useNavigate();
  const [testRun, setTestRun] = useState<Record<string, unknown> | null>(null);
  const [testCase, setTestCase] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepNotes, setStepNotes] = useState('');
  const [showDefectDialog, setShowDefectDialog] = useState(false);
  const [showLinkDefectDialog, setShowLinkDefectDialog] = useState(false);
  const [newDefect, setNewDefect] = useState({ title: '', description: '', severity: 'medium', priority: 'medium' });
  const [existingDefects, setExistingDefects] = useState<Array<Record<string, unknown>>>([]);
  const [defectSearchQuery, setDefectSearchQuery] = useState('');
  const [allTestCases, setAllTestCases] = useState<Array<Record<string, unknown>>>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [showScreenshotPreview, setShowScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Browser panel state
  const [liveBrowserExpanded, setLiveBrowserExpanded] = useState(true);
  const [selectedLiveScreenshot, setSelectedLiveScreenshot] = useState<number | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  // WebSocket hook for real-time execution updates (screenshots, step progress)
  const { progress: wsProgress, isConnected: wsConnected, connect: wsConnect, disconnect: wsDisconnect } = useExecutionWebSocket({
    onScreenshot: (_step: number, _screenshot: Screenshot) => {
      // Auto-scroll filmstrip to latest screenshot
      if (filmstripRef.current) {
        filmstripRef.current.scrollLeft = filmstripRef.current.scrollWidth;
      }
    }
  });

  const testIds = testRun?.testCaseIds || (testRun?.testCaseId ? [testRun.testCaseId] : []);

  // Clipboard paste handler for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const newResults = [...stepResults];
            const currentResult = newResults[currentStepIndex] || { stepIndex: currentStepIndex, status: 'pending' as const };
            newResults[currentStepIndex] = {
              ...currentResult,
              screenshots: [...(currentResult.screenshots || []), base64]
            };
            saveStepResults(newResults);
            toast.success("Screenshot pasted from clipboard!");
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  }, [stepResults, currentStepIndex]);

  // Add clipboard listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    loadData();
    // Load existing defects
    const savedDefects = JSON.parse(localStorage.getItem('defects') || '[]');
    const testDefects = JSON.parse(localStorage.getItem('test_defects') || '[]');
    setExistingDefects([...savedDefects, ...testDefects]);
  }, [runId, testCaseId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const savedRuns = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
      const run = savedRuns.find((r: Record<string, unknown>) => r.id === runId);
      
      if (run) {
        setTestRun(run);
        // Set current test index based on URL
        const ids = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
        const idx = ids.indexOf(testCaseId);
        if (idx !== -1) setCurrentTestIndex(idx);
        
        if (run.manualStepResults?.[testCaseId!]) {
          const savedResults = run.manualStepResults[testCaseId!];
          setStepResults(savedResults);
          const firstPending = savedResults.findIndex((r: StepResult) => r.status === 'pending');
          if (firstPending !== -1) setCurrentStepIndex(firstPending);
        }
      }
      
      let allCases: Array<Record<string, unknown>> = [];
      const seenIds = new Set<string>();

      // Helper to add cases without duplicates
      const addCases = (cases: Array<Record<string, unknown>>) => {
        for (const tc of cases) {
          if (tc.id && !seenIds.has(tc.id)) {
            seenIds.add(tc.id);
            allCases.push(tc);
          }
        }
      };
      
      // 1. Load from Electron local storage (primary source for desktop app)
      try {
        const electronAPI = (window as any).electronAPI || (window as any).flowstral;
        if (electronAPI?.localStorage?.getTestCases) {
          const electronCases = await electronAPI.localStorage.getTestCases();
          console.log('[Execution] Loaded from Electron storage:', electronCases?.length || 0, 'test cases');
          addCases(electronCases || []);
        }
      } catch (electronErr) {
        console.warn('[Execution] Electron storage not available:', electronErr instanceof Error ? electronErr.message : 'Unknown error');
      }

      // 2. Load from flowstral_test_cases
      try {
        const localCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
        addCases(localCases);
      } catch (parseErr) {
        console.warn('[Execution] Failed to parse flowstral_test_cases:', parseErr instanceof Error ? parseErr.message : 'Invalid JSON');
      }

      // 3. Load from test_cases key
      try {
        const altCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        addCases(altCases);
      } catch (parseErr) {
        console.warn('[Execution] Failed to parse test_cases:', parseErr instanceof Error ? parseErr.message : 'Invalid JSON');
      }
      
      // 4. Load from unified_test_case_* keys (legacy format)
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_'));
        for (const key of keys) {
          try {
            const tc = JSON.parse(localStorage.getItem(key) || '{}');
            if (tc.id && !seenIds.has(tc.id)) {
              seenIds.add(tc.id);
              allCases.push(tc);
            }
          } catch (innerParseErr) {
            console.warn(`[Execution] Failed to parse ${key}:`, innerParseErr instanceof Error ? innerParseErr.message : 'Invalid JSON');
          }
        }
      } catch (storageErr) {
        console.warn('[Execution] Failed to read unified_test_case keys:', storageErr instanceof Error ? storageErr.message : 'Unknown error');
      }
      
      // 5. Try backend API as additional source
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`);
        if (response.ok) {
          const backendCases = await response.json();
          const cases = Array.isArray(backendCases) ? backendCases : [];
          addCases(cases);
        }
      } catch (apiErr) {
        console.warn('[Execution] Backend API not available:', apiErr instanceof Error ? apiErr.message : 'Network error');
      }
      
      console.log('[Execution] Loaded', allCases.length, 'test cases from all sources');
      console.log('[Execution] Looking for testCaseId:', testCaseId);
      console.log('[Execution] Available IDs:', allCases.slice(0, 5).map(tc => tc.id));
      
      setAllTestCases(allCases);
      
      const foundCase = allCases.find((tc) => tc.id === testCaseId);
      if (foundCase) {
        console.log('[Execution] Found test case:', foundCase.name);
        setTestCase(foundCase);
        const steps = getSteps(foundCase);
        if (steps.length > 0 && (!run?.manualStepResults?.[testCaseId!] || run.manualStepResults[testCaseId!].length === 0)) {
          setStepResults(steps.map((_: TestStep, idx: number) => ({
            stepIndex: idx,
            status: 'pending' as const
          })));
        }
      } else {
        console.error('[Execution] Test case NOT found. ID searched:', testCaseId);
        console.error('[Execution] Available test cases:', allCases.map(tc => ({ id: tc.id, name: tc.name })));
        toast.error(`Test case not found (ID: ${testCaseId?.slice(0, 8)}...)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error("Error loading data:", message);
      toast.error(`Failed to load data: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getSteps = (tc: Record<string, unknown> | null): TestStep[] => {
    if (!tc) return [];
    const unifiedData = tc.unified_data as Record<string, unknown> | undefined;
    const unifiedSteps = unifiedData?.steps as Array<Record<string, unknown>> | undefined;
    if (unifiedSteps && unifiedSteps.length > 0) {
      return unifiedSteps.map((s) => ({
        action: (s.action as string) || '',
        expectedResult: buildExpectedResult(s),
        qword: s.qword as string | undefined,
        type: s.type as string | undefined,
        selector: s.selector as string | undefined,
        value: s.value as string | undefined,
        args: (s.args as Record<string, string | number | boolean>) || {},
        assertion: s.assertion as TestStep['assertion']
      }));
    }
    const steps = tc.steps as Array<Record<string, unknown>> | undefined;
    if (steps && steps.length > 0) {
      return steps.map((s) => ({
        action: (s.action as string) || '',
        expectedResult: buildExpectedResult(s),
        qword: (s.qword || s.type) as string | undefined,
        type: s.type as string | undefined,
        selector: s.selector as string | undefined,
        value: s.value as string | undefined,
        args: (s.args as Record<string, string | number | boolean>) || {},
        assertion: s.assertion as TestStep['assertion']
      }));
    }
    return [];
  };

  const saveStepResults = (newResults: StepResult[]) => {
    setStepResults(newResults);
    const savedRuns = JSON.parse(localStorage.getItem('test_execution_history') || '[]');
    const updatedRuns = savedRuns.map((r: Record<string, unknown>) => {
      if (r.id === runId) {
        const manualStepResults = (r.manualStepResults || {}) as Record<string, StepResult[]>;
        const updatedResults = { ...manualStepResults, [testCaseId!]: newResults };
        const testStatus = newResults.some(sr => sr.status === 'failed') ? 'failed'
          : newResults.every(sr => sr.status === 'passed' || sr.status === 'skipped') ? 'passed' : 'running';
        const existingStatuses = (r.testCaseStatuses || {}) as Record<string, string>;
        const testCaseStatuses = { ...existingStatuses, [testCaseId!]: testStatus };
        const testIdsList = (r.testCaseIds || (r.testCaseId ? [r.testCaseId] : [])) as string[];
        const values = testIdsList.map((id: string) => testCaseStatuses[id] || 'pending');
        const overallStatus = values.some((s: string) => s === 'failed') ? 'failed'
          : values.every((s: string) => s === 'passed') ? 'passed'
          : values.some((s: string) => s === 'running' || s === 'pending') ? 'running' : 'pending';

        // Calculate step-level results for manual execution (more meaningful than test-case level)
        let totalPassed = 0, totalFailed = 0, totalSkipped = 0;
        Object.values(updatedResults).forEach((resultArr: StepResult[]) => {
          if (Array.isArray(resultArr)) {
            resultArr.forEach((step: StepResult) => {
              if (step.status === 'passed') totalPassed++;
              else if (step.status === 'failed') totalFailed++;
              else totalSkipped++; // pending counts as skipped for now
            });
          }
        });
        
        return {
          ...r,
          manualStepResults: updatedResults,
          testCaseStatuses,
          status: overallStatus,
          results: {
            passed: totalPassed,
            failed: totalFailed,
            skipped: totalSkipped
          },
          endTime: overallStatus !== 'running' ? new Date().toISOString() : undefined
        };
      }
      return r;
    });
    localStorage.setItem('test_execution_history', JSON.stringify(updatedRuns));
    setTestRun(updatedRuns.find((r: Record<string, unknown>) => r.id === runId) || null);
  };

  const markStep = (status: 'passed' | 'failed' | 'skipped', errorMessage?: string) => {
    const newResults = [...stepResults];
    newResults[currentStepIndex] = {
      ...newResults[currentStepIndex],
      status,
      notes: stepNotes || newResults[currentStepIndex]?.notes,
      executedAt: new Date().toISOString(),
      errorMessage
    };
    saveStepResults(newResults);
    setStepNotes('');
    
    const steps = getSteps(testCase);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
    toast.success(`Step ${currentStepIndex + 1} marked as ${status}`);
  };

  const handleScreenshotUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const newResults = [...stepResults];
      const currentResult = newResults[currentStepIndex] || { stepIndex: currentStepIndex, status: 'pending' as const };
      newResults[currentStepIndex] = {
        ...currentResult,
        screenshots: [...(currentResult.screenshots || []), base64]
      };
      saveStepResults(newResults);
      toast.success("Screenshot added!");
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = (screenshotIndex: number) => {
    const newResults = [...stepResults];
    const currentResult = newResults[currentStepIndex];
    if (currentResult?.screenshots) {
      currentResult.screenshots = currentResult.screenshots.filter((_, i) => i !== screenshotIndex);
      saveStepResults(newResults);
      toast.success("Screenshot removed");
    }
  };

  // Generate steps to reproduce from executed steps up to failure
  const generateStepsToReproduce = () => {
    const steps = getSteps(testCase);
    let stepsText = `Test Case: ${testCase?.name || 'Unknown'}\n`;
    stepsText += `Environment: ${testRun?.environment || 'Not specified'}\n\n`;
    stepsText += `Steps to Reproduce:\n`;
    
    for (let i = 0; i <= currentStepIndex; i++) {
      const step = steps[i];
      const result = stepResults[i];
      const { action, details } = formatStepDetails(step);
      stepsText += `${i + 1}. ${action}`;
      if (details.length > 0) {
        stepsText += ` - ${details.map(d => `${d.label}: ${d.value}`).join(', ')}`;
      }
      if (result?.status === 'failed' && result?.errorMessage) {
        stepsText += ` [FAILED: ${result.errorMessage}]`;
      }
      stepsText += '\n';
    }
    
    const currentStep = steps[currentStepIndex];
    if (currentStep?.expectedResult) {
      stepsText += `\nExpected Result:\n${currentStep.expectedResult}\n`;
    }
    
    stepsText += `\nActual Result:\n[Describe what actually happened]\n`;
    
    return stepsText;
  };

  const createDefect = () => {
    if (!newDefect.title.trim()) {
      toast.error("Defect title is required");
      return;
    }
    const defectId = `DEF-${Date.now()}`;
    const newResults = [...stepResults];
    newResults[currentStepIndex] = {
      ...newResults[currentStepIndex],
      defectId,
      defectTitle: newDefect.title
    };
    saveStepResults(newResults);
    
    const defects = JSON.parse(localStorage.getItem('defects') || '[]');
    defects.push({
      id: defectId,
      title: newDefect.title,
      description: newDefect.description,
      severity: newDefect.severity,
      priority: newDefect.priority,
      testCaseId,
      testCaseName: testCase?.name,
      stepIndex: currentStepIndex,
      failedAtStep: currentStepIndex + 1,
      stepsToReproduce: generateStepsToReproduce(),
      runId,
      status: 'open',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('defects', JSON.stringify(defects));
    
    // Also update existing defects list
    setExistingDefects(prev => [...prev, {
      id: defectId,
      title: newDefect.title,
      severity: newDefect.severity,
      priority: newDefect.priority,
      status: 'open'
    }]);
    
    setShowDefectDialog(false);
    setNewDefect({ title: '', description: '', severity: 'medium', priority: 'medium' });
    toast.success(`Defect ${defectId} created and linked!`);
  };

  // Link existing defect to current step
  const linkExistingDefect = (defect: Record<string, unknown>) => {
    const newResults = [...stepResults];
    newResults[currentStepIndex] = {
      ...newResults[currentStepIndex],
      defectId: defect.id,
      defectTitle: defect.title
    };
    saveStepResults(newResults);
    setShowLinkDefectDialog(false);
    setDefectSearchQuery('');
    toast.success(`Defect ${defect.id} linked to step ${currentStepIndex + 1}`);
  };

  // Filter defects for search
  const filteredDefects = existingDefects.filter(d => 
    d.id?.toLowerCase().includes(defectSearchQuery.toLowerCase()) ||
    d.title?.toLowerCase().includes(defectSearchQuery.toLowerCase())
  );

  const removeDefect = () => {
    const newResults = [...stepResults];
    delete newResults[currentStepIndex].defectId;
    delete newResults[currentStepIndex].defectTitle;
    saveStepResults(newResults);
    toast.success("Defect unlinked");
  };

  const navigateToNextTest = () => {
    const ids = testRun?.testCaseIds || (testRun?.testCaseId ? [testRun.testCaseId] : []);
    console.log('[Navigation] Next - current:', currentTestIndex, 'total:', ids.length, 'ids:', ids);
    const nextIndex = currentTestIndex + 1;
    if (nextIndex < ids.length) {
      navigate(`/execution/run/${runId}/${ids[nextIndex]}`);
    } else {
      toast.success("All test cases completed!");
      navigate('/test-cases?tab=runs');
    }
  };

  const navigateToPrevTest = () => {
    const ids = testRun?.testCaseIds || (testRun?.testCaseId ? [testRun.testCaseId] : []);
    console.log('[Navigation] Prev - current:', currentTestIndex, 'total:', ids.length, 'ids:', ids);
    const prevIndex = currentTestIndex - 1;
    if (prevIndex >= 0) {
      navigate(`/execution/run/${runId}/${ids[prevIndex]}`);
    }
  };

  // Skip current test and move to next
  const skipCurrentTest = () => {
    // Mark all pending steps as skipped
    const newResults = stepResults.map(r => 
      r.status === 'pending' ? { ...r, status: 'skipped' as const, executedAt: new Date().toISOString() } : r
    );
    saveStepResults(newResults);
    toast.info('Test skipped');
    
    // Navigate to next test
    const ids = testRun?.testCaseIds || (testRun?.testCaseId ? [testRun.testCaseId] : []);
    const nextIndex = currentTestIndex + 1;
    if (nextIndex < ids.length) {
      navigate(`/execution/run/${runId}/${ids[nextIndex]}`);
    } else {
      toast.success("All test cases completed!");
      navigate('/test-cases?tab=runs');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold text-foreground">Loading Test Case...</h3>
        </div>
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Test Case Not Found</h3>
          <Button onClick={() => navigate('/test-cases?tab=runs')}>Back to Runs</Button>
        </div>
      </div>
    );
  }

  const steps = getSteps(testCase);
  const currentStep = steps[currentStepIndex];
  const currentResult = stepResults[currentStepIndex] || { status: 'pending' };
  const stepDetails = currentStep ? formatStepDetails(currentStep) : { action: 'Unknown', details: [] };
  
  const completedSteps = stepResults.filter(r => r.status === 'passed' || r.status === 'failed' || r.status === 'skipped').length;
  const passedSteps = stepResults.filter(r => r.status === 'passed').length;
  const failedSteps = stepResults.filter(r => r.status === 'failed').length;
  const progressPercent = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;
  const isTestComplete = completedSteps === steps.length;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Compact Header */}
      <header className="flex-none bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/test-cases?tab=runs')} className="h-8">
              <Home className="h-4 w-4 mr-1" />
              Runs
            </Button>
            <div className="border-l border-border pl-3">
              <h1 className="text-base font-semibold text-foreground">{testCase.name}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2 text-xs">
              <Progress value={progressPercent} className="w-32 h-1.5" />
              <span className="text-emerald-600 dark:text-emerald-400">{passedSteps} passed</span>
              <span className="text-red-600 dark:text-red-400">{failedSteps} failed</span>
              <span className="text-muted-foreground">{steps.length - completedSteps} left</span>
            </div>
            
            {/* Multi-test nav */}
            {testIds.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-muted rounded px-2 py-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={currentTestIndex === 0} 
                    onClick={navigateToPrevTest} 
                    className="h-6 w-6 p-0 hover:bg-gray-700"
                    title="Previous test"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-foreground px-1 min-w-[60px] text-center">
                    Test {currentTestIndex + 1}/{testIds.length}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={currentTestIndex >= testIds.length - 1} 
                    onClick={navigateToNextTest} 
                    className="h-6 w-6 p-0 hover:bg-gray-700"
                    title="Next test"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {/* Skip Test Button - allows moving to next without completing */}
                {currentTestIndex < testIds.length - 1 && !isTestComplete && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={skipCurrentTest}
                    className="h-7 text-xs border-border text-muted-foreground hover:text-foreground hover:border-primary"
                    title="Skip this test and move to next"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skip Test
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Fixed Height */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Steps List */}
        <aside className="w-56 flex-none border-r border-border overflow-y-auto bg-muted/30">
          <div className="p-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-card/95 backdrop-blur">
            Steps ({completedSteps}/{steps.length})
          </div>
          <div className="p-1">
            {steps.map((step, idx) => {
              const result = stepResults[idx];
              const { action } = formatStepDetails(step);
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={cn(
                    "w-full p-2 rounded text-left transition-all flex items-center gap-2 text-xs",
                    idx === currentStepIndex ? "bg-primary/20 border border-primary/50" : "hover:bg-muted",
                    result?.status === 'passed' && "border-l-2 border-l-green-500",
                    result?.status === 'failed' && "border-l-2 border-l-red-500",
                    result?.status === 'skipped' && "border-l-2 border-l-gray-500"
                  )}
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                    result?.status === 'passed' && "bg-emerald-600 dark:bg-emerald-500 text-white",
                    result?.status === 'failed' && "bg-red-600 dark:bg-red-500 text-white",
                    result?.status === 'skipped' && "bg-muted-foreground text-white",
                    (!result || result.status === 'pending') && "bg-muted text-muted-foreground"
                  )}>
                    {idx + 1}
                  </span>
                  <span className="truncate flex-1 text-foreground">{action}</span>
                  {result?.screenshots?.length > 0 && <ImageIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                  {result?.defectId && <Bug className="w-3 h-3 text-red-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Step Header */}
          <div className="flex-none p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                  currentResult?.status === 'passed' && "bg-green-600",
                  currentResult?.status === 'failed' && "bg-red-600",
                  currentResult?.status === 'skipped' && "bg-gray-600",
                  currentResult?.status === 'pending' && "bg-amber-600"
                )}>
                  {currentStepIndex + 1}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    {getActionIcon(currentStep?.qword)}
                    {stepDetails.action}
                  </h2>
                  <p className="text-xs text-muted-foreground">Step {currentStepIndex + 1} of {steps.length}</p>
                </div>
              </div>
              <Badge className={cn(
                "px-3 py-1",
                currentResult?.status === 'passed' && "bg-green-500/20 text-green-400",
                currentResult?.status === 'failed' && "bg-red-500/20 text-red-400",
                currentResult?.status === 'skipped' && "bg-muted text-muted-foreground",
                currentResult?.status === 'pending' && "bg-amber-500/20 text-amber-400"
              )}>
                {currentResult?.status || 'pending'}
              </Badge>
            </div>
          </div>

          {/* Live Browser Panel — shows real-time screenshots streamed via WebSocket */}
          {wsProgress.screenshots.length > 0 && (
            <div className="flex-none border-b border-border">
              <button
                onClick={() => setLiveBrowserExpanded(!liveBrowserExpanded)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
              >
                <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  Live Browser
                  <span className="text-xs text-muted-foreground">
                    Step {wsProgress.screenshots[wsProgress.screenshots.length - 1]?.step || wsProgress.screenshots.length}
                  </span>
                  {wsConnected && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </h3>
                {liveBrowserExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {liveBrowserExpanded && (
                <div className="px-4 pb-3">
                  {/* Main screenshot viewer */}
                  <div
                    className="relative bg-muted rounded overflow-hidden mb-2 cursor-pointer"
                    style={{ maxHeight: '280px' }}
                    onClick={() => {
                      const idx = selectedLiveScreenshot ?? wsProgress.screenshots.length - 1;
                      const ss = wsProgress.screenshots[idx];
                      if (ss?.base64) {
                        setShowScreenshotPreview(`data:image/jpeg;base64,${ss.base64}`);
                      }
                    }}
                  >
                    <img
                      src={`data:image/jpeg;base64,${
                        (selectedLiveScreenshot !== null
                          ? wsProgress.screenshots[selectedLiveScreenshot]?.base64
                          : wsProgress.screenshots[wsProgress.screenshots.length - 1]?.base64) || ''
                      }`}
                      className="w-full h-full object-contain"
                      alt={`Step ${
                        selectedLiveScreenshot !== null
                          ? wsProgress.screenshots[selectedLiveScreenshot]?.step
                          : wsProgress.screenshots[wsProgress.screenshots.length - 1]?.step
                      }`}
                    />
                  </div>
                  {/* Filmstrip of all captured screenshots */}
                  <div
                    ref={filmstripRef}
                    className="flex gap-1 overflow-x-auto pb-1"
                  >
                    {wsProgress.screenshots.map((ss, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedLiveScreenshot(idx)}
                        className={cn(
                          "flex-shrink-0 w-20 h-12 rounded border overflow-hidden transition-all",
                          (selectedLiveScreenshot ?? wsProgress.screenshots.length - 1) === idx
                            ? "border-primary ring-2 ring-primary/50"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        {ss.base64 && (
                          <img
                            src={`data:image/jpeg;base64,${ss.base64}`}
                            className="w-full h-full object-cover"
                            alt={`Step ${ss.step}`}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content Area with Tabs */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="execute" className="h-full flex flex-col">
              <TabsList className="flex-none mx-4 mt-2 bg-muted border border-border">
                <TabsTrigger value="execute" className="flex-1">Execute</TabsTrigger>
                <TabsTrigger value="evidence" className="flex-1 relative">
                  Evidence
                  {(currentResult?.screenshots?.length || currentResult?.defectId) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Execute Tab */}
              <TabsContent value="execute" className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Step Details */}
                {stepDetails.details.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    {stepDetails.details.map((detail, idx) => (
                      <div key={idx} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground min-w-[70px]">{detail.label}:</span>
                        <span className="text-foreground font-mono bg-muted px-2 py-0.5 rounded break-all">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expected Result */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="text-blue-400 text-xs uppercase tracking-wide flex items-center gap-1 mb-1">
                    <Check className="w-3 h-3" />
                    Expected Result
                  </div>
                  <p className="text-foreground text-sm">{currentStep?.expectedResult || 'Step completes successfully'}</p>
                </div>

                {/* Action Buttons */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="text-muted-foreground text-xs uppercase tracking-wide mb-3">Mark Step Result</div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => markStep('passed')}
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold"
                      disabled={currentResult?.status !== 'pending'}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      PASS
                    </Button>
                    <Button
                      onClick={() => {
                        const error = prompt("Enter failure reason:");
                        if (error !== null) markStep('failed', error || 'Step failed');
                      }}
                      className="flex-1 h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white font-semibold"
                      disabled={currentResult?.status !== 'pending'}
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      FAIL
                    </Button>
                    <Button
                      onClick={() => markStep('skipped')}
                      variant="outline"
                      className="h-11 border-border text-muted-foreground px-4"
                      disabled={currentResult?.status !== 'pending'}
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
                    </Button>
                  </div>
                </div>

                {/* Error if failed */}
                {currentResult?.errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                      <AlertCircle className="w-4 h-4" />
                      Failure Reason
                    </div>
                    <p className="text-foreground text-sm">{currentResult.errorMessage}</p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
                  <Textarea
                    value={stepNotes || currentResult?.notes || ''}
                    onChange={(e) => setStepNotes(e.target.value)}
                    placeholder="Add observations..."
                    className="mt-1 bg-muted/50 border-border text-foreground h-20"
                  />
                </div>
              </TabsContent>

              {/* Evidence Tab */}
              <TabsContent value="evidence" className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Screenshots Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-foreground text-sm flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-400" />
                      Screenshots ({currentResult?.screenshots?.length || 0})
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        Ctrl+V to paste
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleScreenshotUpload(file);
                          e.target.value = '';
                        }}
                      />
                      <Button size="sm" onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Screenshot
                      </Button>
                    </div>
                  </div>
                  
                  {currentResult?.screenshots?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {currentResult.screenshots.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                          <img
                            src={img}
                            alt={`Screenshot ${idx + 1}`}
                            className="w-full h-40 object-cover cursor-pointer hover:opacity-90"
                            onClick={() => setShowScreenshotPreview(img)}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setShowScreenshotPreview(img)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => removeScreenshot(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No screenshots attached</p>
                      <p className="text-muted-foreground text-xs mt-1">Click to upload or press <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground text-[10px] font-mono">Ctrl+V</kbd> to paste from clipboard</p>
                    </div>
                  )}
                </div>

                {/* Defects Section */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-foreground text-sm flex items-center gap-2">
                      <Bug className="w-4 h-4 text-red-400" />
                      Linked Defect
                    </Label>
                    {!currentResult?.defectId && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setShowLinkDefectDialog(true)} 
                          className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        >
                          <Link className="h-4 w-4 mr-1" />
                          Link Existing
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            // Auto-populate description with steps to reproduce
                            setNewDefect(prev => ({
                              ...prev,
                              description: generateStepsToReproduce()
                            }));
                            setShowDefectDialog(true);
                          }} 
                          className="bg-red-600 hover:bg-red-500"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Defect
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {currentResult?.defectId ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Bug className="w-6 h-6 text-red-400" />
                        <div>
                          <span className="text-red-400 font-mono font-medium">{currentResult.defectId}</span>
                          <p className="text-white text-sm">{currentResult.defectTitle}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={removeDefect} className="text-gray-400 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Bug className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No defect linked</p>
                      <p className="text-muted-foreground/80 text-xs">Create a defect if this step reveals a bug</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Navigation Footer */}
          <div className="flex-none p-4 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="border-gray-700 text-gray-300"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            {isTestComplete ? (
              testIds.length > 1 && currentTestIndex < testIds.length - 1 ? (
                <Button onClick={navigateToNextTest} className="bg-primary hover:bg-primary/90">
                  Next Test
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => navigate('/test-cases?tab=runs')} variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Complete Run
                </Button>
              )
            ) : (
              <Button
                variant="outline"
                onClick={() => setCurrentStepIndex(Math.min(steps.length - 1, currentStepIndex + 1))}
                disabled={currentStepIndex === steps.length - 1}
                className="border-gray-700 text-gray-300"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </main>
      </div>

      {/* Screenshot Preview */}
      <Dialog open={!!showScreenshotPreview} onOpenChange={() => setShowScreenshotPreview(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Screenshot Preview</DialogTitle>
          </DialogHeader>
          {showScreenshotPreview && (
            <img src={showScreenshotPreview} alt="Screenshot" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Defect Dialog */}
      <Dialog open={showDefectDialog} onOpenChange={setShowDefectDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-400" />
              Create Defect for Step {currentStepIndex + 1}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Title *</Label>
              <Input
                value={newDefect.title}
                onChange={(e) => setNewDefect({ ...newDefect, title: e.target.value })}
                placeholder="Brief description of the bug..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Severity</Label>
                <select
                  value={newDefect.severity}
                  onChange={(e) => setNewDefect({ ...newDefect, severity: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-foreground"
                >
                  {SEVERITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {SEVERITY_OPTIONS.find(o => o.value === newDefect.severity)?.description}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Priority</Label>
                <select
                  value={newDefect.priority}
                  onChange={(e) => setNewDefect({ ...newDefect, priority: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-foreground"
                >
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {PRIORITY_OPTIONS.find(o => o.value === newDefect.priority)?.description}
                </p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">
                Description / Steps to Reproduce
                <span className="text-green-600 dark:text-green-400 text-xs ml-2">(Auto-populated from test execution)</span>
              </Label>
              <Textarea
                value={newDefect.description}
                onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                placeholder="Steps to reproduce, expected vs actual..."
                className="mt-1 h-48 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDefectDialog(false)}>Cancel</Button>
            <Button onClick={createDefect} className="bg-red-600 hover:bg-red-500">
              <Bug className="h-4 w-4 mr-2" />
              Create & Link Defect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Existing Defect Dialog */}
      <Dialog open={showLinkDefectDialog} onOpenChange={setShowLinkDefectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-amber-500" />
              Link Existing Defect
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={defectSearchQuery}
                onChange={(e) => setDefectSearchQuery(e.target.value)}
                placeholder="Search by defect ID or title..."
                className="pl-10 bg-gray-900 border-gray-700 text-white"
              />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredDefects.length > 0 ? (
                filteredDefects.map((defect) => (
                  <button
                    key={defect.id}
                    onClick={() => linkExistingDefect(defect)}
                    className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-left hover:border-amber-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-mono text-sm">{defect.id}</span>
                      <div className="flex gap-2">
                        {defect.severity && (
                          <Badge className={cn(
                            "text-xs",
                            defect.severity === 'critical' && "bg-red-500/20 text-red-400",
                            defect.severity === 'high' && "bg-orange-500/20 text-orange-400",
                            defect.severity === 'medium' && "bg-yellow-500/20 text-yellow-400",
                            defect.severity === 'low' && "bg-blue-500/20 text-blue-400"
                          )}>
                            {SEVERITY_OPTIONS.find(s => s.value === defect.severity)?.label || defect.severity}
                          </Badge>
                        )}
                        {defect.status && (
                          <Badge variant="outline" className="text-xs text-gray-400">
                            {defect.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-white text-sm mt-1 truncate">{defect.title}</p>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {defectSearchQuery ? 'No defects found' : 'No existing defects'}
                  </p>
                  <p className="text-xs mt-1">
                    {defectSearchQuery ? 'Try a different search term' : 'Create a new defect instead'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDefectDialog(false)} className="border-gray-700">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
