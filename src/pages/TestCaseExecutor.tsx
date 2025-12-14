import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, XCircle, AlertCircle, Clock, ChevronLeft, ChevronRight,
  Camera, Upload, Bug, Link2, Plus, Trash2, Image, FileText, MessageSquare,
  Play, Pause, Timer, Save, Send, SkipForward, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Paperclip, X, Eye, Download, List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types
interface TestStep {
  id: string;
  stepNumber: number;
  action: string;
  expectedResult: string;
  testData?: string;
  status: 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped';
  actualResult?: string;
  notes?: string;
  defects?: string[];
  attachments?: Attachment[];
  executedAt?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'screenshot' | 'file' | 'image';
  url: string;
  uploadedAt: string;
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: string;
  priority: string;
  steps: Array<{
    action: string;
    expectedResult: string;
    testData?: string;
  }>;
  preconditions?: string[];
  linkedRequirements?: string[];
}

interface Defect {
  id: string;
  title: string;
  severity: string;
  status: string;
}

interface ExecutionSession {
  id: string;
  testCaseId: string;
  testCase: TestCase;
  planId?: string;
  releaseId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  startTime?: string;
  endTime?: string;
  duration?: number;
  steps: TestStep[];
  overallResult?: 'passed' | 'failed' | 'blocked' | 'partial';
  executedBy: string;
  comments?: string;
}

interface QueuedTest {
  testCaseId: string;
  testCase: TestCase | null;
  session: ExecutionSession | null;
  status: 'pending' | 'in_progress' | 'completed';
}

export default function TestCaseExecutor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const releaseId = searchParams.get('release');
  const isQueue = searchParams.get('queue') === 'true';
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Queue state
  const [testQueue, setTestQueue] = useState<QueuedTest[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [showQueuePanel, setShowQueuePanel] = useState(true);
  
  // Current test state
  const [loading, setLoading] = useState(true);
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Dialogs
  const [showDefectDialog, setShowDefectDialog] = useState(false);
  const [showLinkDefectDialog, setShowLinkDefectDialog] = useState(false);
  const [existingDefects, setExistingDefects] = useState<Defect[]>([]);
  const [selectedDefectId, setSelectedDefectId] = useState('');
  
  // New defect form
  const [newDefect, setNewDefect] = useState({
    title: '',
    description: '',
    severity: 'medium',
    stepsToReproduce: [] as string[]
  });

  // Open defect dialog with pre-populated steps
  const openDefectDialog = () => {
    if (!session || !currentStep) return;
    
    // Build steps to reproduce from test steps up to current step
    const stepsUpToCurrent = session.steps.slice(0, currentStepIndex + 1);
    const stepsToReproduce = stepsUpToCurrent.map((step, idx) => {
      let stepText = `Step ${idx + 1}: ${step.action}`;
      if (step.testData) {
        stepText += ` [Data: ${step.testData}]`;
      }
      if (step.actualResult) {
        stepText += ` → Actual: ${step.actualResult}`;
      }
      return stepText;
    });
    
    // Add the expected vs actual for the failing step
    if (currentStep.expectedResult) {
      stepsToReproduce.push(`Expected: ${currentStep.expectedResult}`);
    }
    if (currentStep.actualResult) {
      stepsToReproduce.push(`Actual: ${currentStep.actualResult}`);
    }
    
    setNewDefect({
      title: `[${testCase?.name || 'Test'}] Step ${currentStep.stepNumber} Failed`,
      description: `Failure occurred at Step ${currentStep.stepNumber}: ${currentStep.action}`,
      severity: 'medium',
      stepsToReproduce
    });
    
    setShowDefectDialog(true);
  };

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (session && session.status === 'in_progress' && !isPaused) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [session, isPaused]);

  // Load test queue or single test
  useEffect(() => {
    loadTests();
    loadExistingDefects();
  }, [id, isQueue]);

  const loadTests = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      let testCaseIds: string[] = [id];
      
      // Check if we have a queue from plan
      if (isQueue && planId) {
        const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
        const plan = plans.find((p: any) => p.id === planId);
        if (plan && plan.testCaseIds) {
          testCaseIds = plan.testCaseIds;
        }
      }
      
      // Check for stored execution queue
      const storedQueue = localStorage.getItem('execution_queue');
      if (storedQueue) {
        const queue = JSON.parse(storedQueue);
        if (queue.testCaseIds && queue.testCaseIds.length > 0) {
          testCaseIds = queue.testCaseIds;
        }
        localStorage.removeItem('execution_queue'); // Clear after loading
      }
      
      // Load all test cases
      let allTestCases: TestCase[] = [];
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`);
        if (response.ok) {
          const data = await response.json();
          allTestCases = Array.isArray(data) ? data : [];
        }
      } catch {
        allTestCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      }
      
      // Build queue
      const queue: QueuedTest[] = testCaseIds.map((tcId, index) => {
        const tc = allTestCases.find(t => t.id === tcId) || null;
        return {
          testCaseId: tcId,
          testCase: tc,
          session: null,
          status: index === 0 ? 'in_progress' : 'pending'
        };
      });
      
      setTestQueue(queue);
      
      // Initialize first test
      const firstTest = queue[0];
      if (firstTest?.testCase) {
        setTestCase(firstTest.testCase);
        initializeSession(firstTest.testCase);
      } else {
        toast.error('Test case not found');
        navigate('/execution');
      }
      
    } catch (error) {
      console.error('Error loading tests:', error);
      toast.error('Failed to load test cases');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingDefects = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/defects`);
      if (response.ok) {
        const data = await response.json();
        setExistingDefects(data.defects || []);
      }
    } catch (error) {
      const stored = JSON.parse(localStorage.getItem('defects') || '[]');
      setExistingDefects(stored);
    }
  };

  const initializeSession = (tc: TestCase) => {
    const steps: TestStep[] = (tc.steps || []).map((step, index) => ({
      id: `step_${index}`,
      stepNumber: index + 1,
      action: step.action,
      expectedResult: step.expectedResult,
      testData: step.testData,
      status: 'pending',
      defects: [],
      attachments: []
    }));

    const newSession: ExecutionSession = {
      id: `exec_${Date.now()}`,
      testCaseId: tc.id,
      testCase: tc,
      planId: planId || undefined,
      releaseId: releaseId || undefined,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      steps,
      executedBy: 'Current User'
    };

    setSession(newSession);
    setCurrentStepIndex(0);
    setElapsedTime(0);
  };

  const currentStep = session?.steps[currentStepIndex];

  const updateStepStatus = (status: TestStep['status'], actualResult?: string) => {
    if (!session || !currentStep) return;

    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex 
        ? { 
            ...step, 
            status, 
            actualResult: actualResult || step.actualResult,
            executedAt: new Date().toISOString()
          }
        : step
    );

    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
    
    // Auto-advance to next step if not the last one
    if (currentStepIndex < session.steps.length - 1 && status !== 'failed' && status !== 'blocked') {
      setTimeout(() => setCurrentStepIndex(prev => prev + 1), 300);
    }
    
    toast.success(`Step ${currentStep.stepNumber} marked as ${status}`);
  };

  const updateStepNotes = (notes: string) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex ? { ...step, notes } : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
  };

  const updateStepActualResult = (actualResult: string) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex ? { ...step, actualResult } : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
  };

  // Calculate test result
  const calculateTestResult = (steps: TestStep[]): ExecutionSession['overallResult'] => {
    const passedSteps = steps.filter(s => s.status === 'passed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    const blockedSteps = steps.filter(s => s.status === 'blocked').length;
    const totalSteps = steps.length;

    if (failedSteps > 0) return 'failed';
    if (blockedSteps > 0) return 'blocked';
    if (passedSteps === totalSteps) return 'passed';
    return 'partial';
  };

  // Save current test run
  const saveCurrentTestRun = (status: 'completed' | 'in_progress' | 'paused') => {
    if (!session || !testCase) return;

    const result = calculateTestResult(session.steps);
    const completedSession = {
      ...session,
      status,
      endTime: status === 'completed' ? new Date().toISOString() : undefined,
      duration: elapsedTime,
      overallResult: result
    };

    // Save to localStorage
    const runs = JSON.parse(localStorage.getItem('test_runs') || '[]');
    const existingIndex = runs.findIndex((r: any) => r.id === session.id);
    
    const runData = {
      id: completedSession.id,
      name: `Execution: ${testCase.name}`,
      testCaseId: completedSession.testCaseId,
      planId: completedSession.planId,
      releaseId: completedSession.releaseId,
      sourceId: completedSession.planId,
      status: result,
      startTime: completedSession.startTime,
      endTime: completedSession.endTime,
      duration: completedSession.duration,
      steps: completedSession.steps,
      executedBy: completedSession.executedBy
    };

    if (existingIndex >= 0) {
      runs[existingIndex] = runData;
    } else {
      runs.push(runData);
    }
    localStorage.setItem('test_runs', JSON.stringify(runs));

    return result;
  };

  // Save and proceed to next test
  const saveAndNext = () => {
    if (!session) return;

    const result = saveCurrentTestRun(session.steps.some(s => s.status === 'pending') ? 'in_progress' : 'completed');
    
    // Update queue status
    const updatedQueue = [...testQueue];
    updatedQueue[currentQueueIndex] = {
      ...updatedQueue[currentQueueIndex],
      session,
      status: 'completed'
    };
    
    // Move to next test
    if (currentQueueIndex < testQueue.length - 1) {
      const nextIndex = currentQueueIndex + 1;
      const nextTest = updatedQueue[nextIndex];
      
      updatedQueue[nextIndex] = { ...nextTest, status: 'in_progress' };
      setTestQueue(updatedQueue);
      setCurrentQueueIndex(nextIndex);
      
      if (nextTest.testCase) {
        setTestCase(nextTest.testCase);
        initializeSession(nextTest.testCase);
        toast.success(`Moving to: ${nextTest.testCase.name}`);
      }
    } else {
      // All tests completed
      setTestQueue(updatedQueue);
      toast.success('All tests completed!');
      navigate(`/execution/plan/${planId}` || '/execution?tab=results');
    }
  };

  // Save and exit (saves progress, can resume later)
  const saveAndExit = () => {
    if (!session) return;
    
    const executedSteps = session.steps.filter(s => s.status !== 'pending').length;
    const status = executedSteps === 0 ? 'pending' : executedSteps < session.steps.length ? 'in_progress' : 'completed';
    
    saveCurrentTestRun(status as any);
    toast.success('Progress saved');
    
    if (planId) {
      navigate(`/execution/plan/${planId}`);
    } else {
      navigate('/execution?tab=results');
    }
  };

  // Complete current test and continue
  const completeCurrentTest = () => {
    if (!session) return;

    const result = saveCurrentTestRun('completed');
    toast.success(`Test completed: ${result?.toUpperCase()}`);
    
    // Update queue
    const updatedQueue = [...testQueue];
    updatedQueue[currentQueueIndex] = {
      ...updatedQueue[currentQueueIndex],
      session,
      status: 'completed'
    };
    setTestQueue(updatedQueue);
    
    // Check if more tests
    if (currentQueueIndex < testQueue.length - 1) {
      saveAndNext();
    } else {
      toast.success('All tests in queue completed!');
      if (planId) {
        navigate(`/execution/plan/${planId}`);
      } else {
        navigate('/execution?tab=results');
      }
    }
  };

  // Switch to a specific test in queue
  const switchToTest = (index: number) => {
    if (index === currentQueueIndex) return;
    
    // Save current progress
    if (session) {
      saveCurrentTestRun('in_progress');
      const updatedQueue = [...testQueue];
      updatedQueue[currentQueueIndex] = {
        ...updatedQueue[currentQueueIndex],
        session,
        status: session.steps.every(s => s.status !== 'pending') ? 'completed' : 'in_progress'
      };
      setTestQueue(updatedQueue);
    }
    
    // Switch to selected test
    const target = testQueue[index];
    if (target.testCase) {
      setCurrentQueueIndex(index);
      setTestCase(target.testCase);
      
      if (target.session) {
        setSession(target.session);
        setElapsedTime(target.session.duration || 0);
      } else {
        initializeSession(target.testCase);
      }
    }
  };

  // Screenshot capture
  const captureScreenshot = async () => {
    if (!session || !currentStep) return;
    
    const screenshot: Attachment = {
      id: `att_${Date.now()}`,
      name: `Screenshot_Step${currentStep.stepNumber}_${new Date().toISOString().slice(0, 10)}.png`,
      type: 'screenshot',
      url: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23f0f0f0" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="%23666">Screenshot Placeholder</text></svg>`,
      uploadedAt: new Date().toISOString()
    };
    
    addAttachment(screenshot);
    toast.success('Screenshot captured');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !session || !currentStep) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          url: reader.result as string,
          uploadedAt: new Date().toISOString()
        };
        addAttachment(attachment);
      };
      reader.readAsDataURL(file);
    });
    
    toast.success(`${files.length} file(s) uploaded`);
  };

  const addAttachment = (attachment: Attachment) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex 
        ? { ...step, attachments: [...(step.attachments || []), attachment] }
        : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
  };

  const removeAttachment = (attachmentId: string) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex 
        ? { ...step, attachments: step.attachments?.filter(a => a.id !== attachmentId) }
        : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
    toast.success('Attachment removed');
  };

  // Defect linking
  const createAndLinkDefect = async () => {
    if (!newDefect.title.trim() || !session || !currentStep) {
      toast.error('Please enter defect title');
      return;
    }

    const defect: Defect = {
      id: `DEF-${Date.now()}`,
      title: newDefect.title,
      severity: newDefect.severity,
      status: 'open'
    };

    const stored = JSON.parse(localStorage.getItem('defects') || '[]');
    stored.push({
      ...defect,
      description: newDefect.description,
      stepsToReproduce: newDefect.stepsToReproduce, // Now an array
      linkedTestCase: session.testCaseId,
      linkedTestCaseName: testCase?.name,
      linkedStep: currentStep.stepNumber,
      linkedStepAction: currentStep.action,
      expectedResult: currentStep.expectedResult,
      actualResult: currentStep.actualResult,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('defects', JSON.stringify(stored));

    linkDefectToStep(defect.id);
    setExistingDefects(prev => [...prev, defect]);
    setShowDefectDialog(false);
    setNewDefect({ title: '', description: '', severity: 'medium', stepsToReproduce: [] });
    toast.success(`Defect ${defect.id} created and linked`);
  };

  const linkDefectToStep = (defectId: string) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex 
        ? { ...step, defects: [...new Set([...(step.defects || []), defectId])] }
        : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
  };

  const linkExistingDefect = () => {
    if (!selectedDefectId) {
      toast.error('Please select a defect');
      return;
    }
    linkDefectToStep(selectedDefectId);
    setShowLinkDefectDialog(false);
    setSelectedDefectId('');
    toast.success('Defect linked to step');
  };

  const unlinkDefect = (defectId: string) => {
    if (!session) return;
    const updatedSteps = session.steps.map((step, index) => 
      index === currentStepIndex 
        ? { ...step, defects: step.defects?.filter(d => d !== defectId) }
        : step
    );
    setSession(prev => prev ? { ...prev, steps: updatedSteps } : null);
    toast.success('Defect unlinked');
  };

  // Stats
  const getStats = () => {
    if (!session) return { passed: 0, failed: 0, blocked: 0, pending: 0, skipped: 0, progress: 0 };
    const passed = session.steps.filter(s => s.status === 'passed').length;
    const failed = session.steps.filter(s => s.status === 'failed').length;
    const blocked = session.steps.filter(s => s.status === 'blocked').length;
    const skipped = session.steps.filter(s => s.status === 'skipped').length;
    const pending = session.steps.filter(s => s.status === 'pending').length;
    const executed = passed + failed + blocked + skipped;
    const progress = session.steps.length > 0 ? Math.round((executed / session.steps.length) * 100) : 0;
    return { passed, failed, blocked, pending, skipped, progress };
  };

  const stats = getStats();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Queue stats
  const queueStats = {
    total: testQueue.length,
    completed: testQueue.filter(t => t.status === 'completed').length,
    current: currentQueueIndex + 1
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!testCase || !session) {
    return (
      <div className="p-6 text-center">
        <p>Test case not found</p>
        <Button onClick={() => navigate('/execution')} className="mt-4">Back to Execution</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => planId ? navigate(`/execution/plan/${planId}`) : navigate('/execution')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{testCase.name}</h1>
            <p className="text-muted-foreground">
              {testQueue.length > 1 ? `Test ${queueStats.current} of ${queueStats.total}` : `${session.steps.length} steps`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Timer className="h-4 w-4" />
            <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
          </div>
          
          <Button variant="outline" onClick={saveAndExit}>
            <Save className="h-4 w-4 mr-2" />
            Save & Exit
          </Button>
          
          {testQueue.length > 1 && currentQueueIndex < testQueue.length - 1 ? (
            <Button onClick={saveAndNext}>
              <ChevronRight className="h-4 w-4 mr-2" />
              Save & Next Test
            </Button>
          ) : (
            <Button onClick={completeCurrentTest}>
              <Send className="h-4 w-4 mr-2" />
              Complete {testQueue.length > 1 ? 'All' : 'Test'}
            </Button>
          )}
        </div>
      </div>

      {/* Test Queue Panel (when multiple tests) */}
      {testQueue.length > 1 && (
        <Collapsible open={showQueuePanel} onOpenChange={setShowQueuePanel}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Test Queue ({queueStats.completed}/{queueStats.total} completed)
                  </CardTitle>
                  {showQueuePanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="flex gap-2 flex-wrap">
                  {testQueue.map((qt, index) => (
                    <Badge 
                      key={qt.testCaseId}
                      variant={index === currentQueueIndex ? 'default' : qt.status === 'completed' ? 'secondary' : 'outline'}
                      className={`cursor-pointer py-1.5 px-3 ${index === currentQueueIndex ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => switchToTest(index)}
                    >
                      {qt.status === 'completed' ? <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> :
                       qt.status === 'in_progress' ? <Play className="h-3 w-3 mr-1" /> :
                       <Clock className="h-3 w-3 mr-1" />}
                      {qt.testCase?.name?.substring(0, 25) || `Test ${index + 1}`}
                      {qt.testCase?.name && qt.testCase.name.length > 25 ? '...' : ''}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step Progress</span>
            <span className="text-sm text-muted-foreground">{stats.progress}% complete</span>
          </div>
          <Progress value={stats.progress} className="h-3" />
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-green-600">✓ {stats.passed} passed</span>
            <span className="text-red-600">✗ {stats.failed} failed</span>
            <span className="text-amber-600">⚠ {stats.blocked} blocked</span>
            <span className="text-gray-600">○ {stats.pending} pending</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* Steps List (Left) */}
        <div className="col-span-4 space-y-2">
          <h3 className="text-sm font-medium mb-3">Test Steps</h3>
          {session.steps.map((step, index) => (
            <Card 
              key={step.id}
              className={`cursor-pointer transition-all ${
                index === currentStepIndex 
                  ? 'ring-2 ring-primary' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => setCurrentStepIndex(index)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    step.status === 'passed' ? 'bg-green-100 text-green-600' :
                    step.status === 'failed' ? 'bg-red-100 text-red-600' :
                    step.status === 'blocked' ? 'bg-amber-100 text-amber-600' :
                    step.status === 'skipped' ? 'bg-gray-100 text-gray-400' :
                    index === currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {step.status === 'passed' ? <CheckCircle2 className="h-4 w-4" /> :
                     step.status === 'failed' ? <XCircle className="h-4 w-4" /> :
                     step.status === 'blocked' ? <AlertCircle className="h-4 w-4" /> :
                     step.stepNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{step.action.substring(0, 50)}...</p>
                    <div className="flex gap-2 mt-1">
                      {(step.defects?.length || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <Bug className="h-3 w-3 mr-1" />
                          {step.defects?.length}
                        </Badge>
                      )}
                      {(step.attachments?.length || 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Paperclip className="h-3 w-3 mr-1" />
                          {step.attachments?.length}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current Step Detail (Right) */}
        <div className="col-span-8 space-y-4">
          {currentStep && (
            <>
              {/* Step Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Step {currentStep.stepNumber} of {session.steps.length}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentStepIndex === 0}
                        onClick={() => setCurrentStepIndex(prev => prev - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={currentStepIndex === session.steps.length - 1}
                        onClick={() => setCurrentStepIndex(prev => prev + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">ACTION</Label>
                    <p className="mt-1 p-3 bg-muted/50 rounded-lg">{currentStep.action}</p>
                  </div>
                  
                  {currentStep.testData && (
                    <div>
                      <Label className="text-xs text-muted-foreground">TEST DATA</Label>
                      <p className="mt-1 p-3 bg-blue-50 rounded-lg font-mono text-sm">{currentStep.testData}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">EXPECTED RESULT</Label>
                    <p className="mt-1 p-3 bg-green-50 rounded-lg">{currentStep.expectedResult}</p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">ACTUAL RESULT</Label>
                    <Textarea
                      value={currentStep.actualResult || ''}
                      onChange={(e) => updateStepActualResult(e.target.value)}
                      placeholder="Enter the actual result observed..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Result Buttons */}
              <Card>
                <CardContent className="py-4">
                  <Label className="text-xs text-muted-foreground mb-3 block">MARK RESULT</Label>
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => updateStepStatus('passed')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Pass
                    </Button>
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={() => updateStepStatus('failed')}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Fail
                    </Button>
                    <Button 
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      onClick={() => updateStepStatus('blocked')}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Blocked
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => updateStepStatus('skipped')}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Attachments & Defects */}
              <div className="grid grid-cols-2 gap-4">
                {/* Attachments */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Evidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-3">
                      <Button variant="outline" size="sm" onClick={captureScreenshot}>
                        <Camera className="h-4 w-4 mr-2" />
                        Screenshot
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                    
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {(currentStep.attachments || []).map(att => (
                        <div key={att.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          {att.type === 'screenshot' || att.type === 'image' ? (
                            <Image className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="flex-1 text-sm truncate">{att.name}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => removeAttachment(att.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(!currentStep.attachments || currentStep.attachments.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-2">No attachments</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Defects */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      Defects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={openDefectDialog}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowLinkDefectDialog(true)}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Link
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                      {(currentStep.defects || []).map(defectId => {
                        const defect = existingDefects.find(d => d.id === defectId);
                        return (
                          <div key={defectId} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                            <Bug className="h-4 w-4 text-red-600" />
                            <span className="flex-1 text-sm truncate">
                              {defect?.title || defectId}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => unlinkDefect(defectId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                      {(!currentStep.defects || currentStep.defects.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-2">No defects linked</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={currentStep.notes || ''}
                    onChange={(e) => updateStepNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Create Defect Dialog */}
      <Dialog open={showDefectDialog} onOpenChange={setShowDefectDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-red-500" />
              Create Defect from Test Step
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Test Context */}
            {testCase && currentStep && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium">{testCase.name}</p>
                <p className="text-muted-foreground">Step {currentStep.stepNumber}: {currentStep.action}</p>
              </div>
            )}
            
            <div>
              <Label>Title *</Label>
              <Input
                value={newDefect.title}
                onChange={(e) => setNewDefect(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief description of the defect"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <Select
                  value={newDefect.severity}
                  onValueChange={(v) => setNewDefect(prev => ({ ...prev, severity: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Input value="Open" disabled className="bg-muted" />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={newDefect.description}
                onChange={(e) => setNewDefect(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the issue..."
                rows={2}
              />
            </div>
            
            {/* Steps to Reproduce - Auto-populated from test steps */}
            <div>
              <Label className="flex items-center justify-between">
                <span>Steps to Reproduce</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Auto-populated from test steps
                </span>
              </Label>
              <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                {newDefect.stepsToReproduce.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded text-sm ${
                      step.startsWith('Expected:') ? 'bg-green-50 text-green-700' :
                      step.startsWith('Actual:') ? 'bg-red-50 text-red-700' :
                      'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{idx + 1}.</span>
                      <Input
                        value={step}
                        onChange={(e) => {
                          const updated = [...newDefect.stepsToReproduce];
                          updated[idx] = e.target.value;
                          setNewDefect(prev => ({ ...prev, stepsToReproduce: updated }));
                        }}
                        className="flex-1 h-auto py-1 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          const updated = newDefect.stepsToReproduce.filter((_, i) => i !== idx);
                          setNewDefect(prev => ({ ...prev, stepsToReproduce: updated }));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setNewDefect(prev => ({
                    ...prev,
                    stepsToReproduce: [...prev.stepsToReproduce, '']
                  }));
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Step
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDefectDialog(false)}>Cancel</Button>
            <Button onClick={createAndLinkDefect} className="bg-red-600 hover:bg-red-700">
              <Bug className="h-4 w-4 mr-2" />
              Create & Link Defect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Existing Defect Dialog */}
      <Dialog open={showLinkDefectDialog} onOpenChange={setShowLinkDefectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Existing Defect
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Defect</Label>
            <Select value={selectedDefectId} onValueChange={setSelectedDefectId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a defect..." />
              </SelectTrigger>
              <SelectContent>
                {existingDefects.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.id}: {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDefectDialog(false)}>Cancel</Button>
            <Button onClick={linkExistingDefect} disabled={!selectedDefectId}>Link Defect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
