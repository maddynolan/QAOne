/**
 * Unified Workflow Editor - v3.0 (Rearchitected)
 * 
 * Clean, focused test builder that supports:
 * - Manual test cases
 * - Automated UI tests (Playwright)
 * - API tests
 * - Performance tests
 * 
 * All from a single unified test case format.
 * 
 * Color scheme: Purple primary (#8B5CF6), Cyan accent (#38BDF8)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play, Save, Download, Upload, Plus, Trash2, Copy,
  ArrowUp, ArrowDown, Eye, EyeOff, Code, Settings,
  Zap, Globe, MousePointer, Type, Clock, CheckCircle,
  Navigation, AlertCircle, Sparkles, Package, Wand2,
  ChevronRight, ChevronDown, MoreHorizontal, Target,
  Layers, RefreshCw, FileText, Monitor, Server, Gauge,
  Video, Camera, Search, Filter, X, Check, Edit, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { useExecutionWebSocket } from '@/hooks/useExecutionWebSocket';

// ============================================================================
// TYPES - Unified Test Case Schema
// ============================================================================

type StepType = 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'api' | 'screenshot';

interface TestStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  // UI Actions
  selector?: string;
  value?: string;
  url?: string;
  waitTime?: number;
  // API Actions
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint?: string;
  headers?: Record<string, string>;
  body?: string;
  // Assertions
  assertion?: {
    type: string;
    target?: string;
    expected?: string;
  };
  // Blackbox fallback
  fallbackStrategy?: 'ocr' | 'coordinates' | 'image' | 'ai';
  fallbackConfig?: any;
  // Metadata
  isEnabled: boolean;
  expectedResult?: string;  // For manual testing
}

interface UnifiedTestCase {
  id: string;
  name: string;
  description: string;
  tags: string[];
  steps: TestStep[];
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

type ExportMode = 'manual' | 'playwright' | 'api' | 'performance';

// ============================================================================
// STEP TYPE DEFINITIONS
// ============================================================================

const STEP_TYPES: Record<StepType, { label: string; icon: any; color: string; description: string }> = {
  navigate: { 
    label: 'Navigate', 
    icon: Navigation, 
    color: 'bg-primary text-primary-foreground',
    description: 'Go to a URL'
  },
  click: { 
    label: 'Click', 
    icon: MousePointer, 
    color: 'bg-cyan-500 text-white',
    description: 'Click an element'
  },
  input: { 
    label: 'Input', 
    icon: Type, 
    color: 'bg-emerald-500 text-white',
    description: 'Enter text into a field'
  },
  wait: { 
    label: 'Wait', 
    icon: Clock, 
    color: 'bg-amber-500 text-white',
    description: 'Wait for time or element'
  },
  assert: { 
    label: 'Assert', 
    icon: CheckCircle, 
    color: 'bg-green-500 text-white',
    description: 'Verify a condition'
  },
  api: { 
    label: 'API Call', 
    icon: Globe, 
    color: 'bg-blue-500 text-white',
    description: 'Make an API request'
  },
  screenshot: { 
    label: 'Screenshot', 
    icon: Camera, 
    color: 'bg-violet-500 text-white',
    description: 'Capture the screen'
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedWorkflowEditor() {
  const [searchParams] = useSearchParams();
  
  // Test case state
  const [testCase, setTestCase] = useState<UnifiedTestCase>({
    id: `tc_${Date.now()}`,
    name: 'New Test Case',
    description: '',
    tags: [],
    steps: [],
    variables: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  // UI state
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'build' | 'code' | 'run'>('build');
  const [exportMode, setExportMode] = useState<ExportMode>('playwright');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModules, setShowModules] = useState(false);
  
  // Execution state
  const [executionProgress, setExecutionProgress] = useState({
    currentStep: 0,
    status: 'idle' as 'idle' | 'running' | 'passed' | 'failed',
    results: [] as { stepId: string; status: string; duration?: number; error?: string }[],
  });

  // Settings
  const [settings, setSettings] = useState({
    browser: 'chromium',
    headless: false,
    timeout: 30000,
    baseUrl: '',
  });

  // Selected step
  const selectedStep = testCase.steps.find(s => s.id === selectedStepId);

  // Load from URL params or localStorage
  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(data));
        if (parsed.events) {
          // Convert from recorder format
          const steps = convertRecordedEvents(parsed.events, parsed.startUrl);
          setTestCase(prev => ({
            ...prev,
            name: parsed.name || 'Recorded Test',
            steps,
          }));
        }
      } catch (e) {
        console.error('Failed to parse URL data:', e);
      }
    } else {
      // Load from localStorage
      const saved = localStorage.getItem('unified_test_case');
      if (saved) {
        try {
          setTestCase(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [searchParams]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('unified_test_case', JSON.stringify(testCase));
  }, [testCase]);

  // Convert recorded events to steps
  const convertRecordedEvents = (events: any[], startUrl?: string): TestStep[] => {
    const steps: TestStep[] = [];
    
    if (startUrl) {
      steps.push({
        id: `step_${Date.now()}_0`,
        type: 'navigate',
        name: 'Navigate to page',
        url: startUrl,
        isEnabled: true,
        expectedResult: 'Page loads successfully',
      });
    }
    
    events.forEach((event, idx) => {
      const step: TestStep = {
        id: `step_${Date.now()}_${idx + 1}`,
        type: event.type || 'click',
        name: event.type === 'input' ? `Enter ${event.value?.slice(0, 20) || 'text'}` : 
              event.type === 'click' ? `Click ${event.element?.textContent?.slice(0, 20) || 'element'}` :
              event.type || 'Action',
        selector: event.selector,
        value: event.value,
        isEnabled: true,
        expectedResult: '',
      };
      steps.push(step);
    });
    
    return steps;
  };

  // Step operations
  const addStep = (type: StepType) => {
    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      type,
      name: STEP_TYPES[type].label,
      isEnabled: true,
      expectedResult: '',
    };
    
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedStepId(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<TestStep>) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
      updatedAt: new Date().toISOString(),
    }));
  };

  const deleteStep = (stepId: string) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    setTestCase(prev => {
      const idx = prev.steps.findIndex(s => s.id === stepId);
      if (idx === -1) return prev;
      
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.steps.length) return prev;
      
      const newSteps = [...prev.steps];
      [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
      
      return { ...prev, steps: newSteps, updatedAt: new Date().toISOString() };
    });
  };

  const duplicateStep = (stepId: string) => {
    const step = testCase.steps.find(s => s.id === stepId);
    if (!step) return;
    
    const newStep = { ...step, id: `step_${Date.now()}`, name: `${step.name} (Copy)` };
    const idx = testCase.steps.findIndex(s => s.id === stepId);
    
    setTestCase(prev => {
      const newSteps = [...prev.steps];
      newSteps.splice(idx + 1, 0, newStep);
      return { ...prev, steps: newSteps, updatedAt: new Date().toISOString() };
    });
  };

  // Generate code
  const generateCode = useCallback((mode: ExportMode): string => {
    switch (mode) {
      case 'playwright':
        return generatePlaywrightCode(testCase, settings);
      case 'manual':
        return generateManualTestCase(testCase);
      case 'api':
        return generateAPITestCode(testCase);
      case 'performance':
        return generatePerformanceScript(testCase);
      default:
        return '';
    }
  }, [testCase, settings]);

  // Run test
  const runTest = async () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to run the test');
      return;
    }

    setIsRunning(true);
    setActiveTab('run');
    setExecutionProgress({ currentStep: 0, status: 'running', results: [] });

    try {
      const code = generateCode('playwright');
      const response = await fetch('http://localhost:8000/api/playwright-recorder/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: code,
          language: 'python',
          browser: settings.browser,
          headless: settings.headless,
          workflow_name: testCase.name.replace(/[^a-z0-9]+/gi, '_'),
        }),
      });

      const result = await response.json();
      
      setExecutionProgress(prev => ({
        ...prev,
        status: result.status === 'success' || result.exit_code === 0 ? 'passed' : 'failed',
      }));

      if (result.status === 'success' || result.exit_code === 0) {
        toast.success('Test passed!');
      } else {
        toast.error('Test failed');
      }
    } catch (error) {
      setExecutionProgress(prev => ({ ...prev, status: 'failed' }));
      toast.error('Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Save test case
  const saveTestCase = async () => {
    try {
      const response = await fetch('http://localhost:8000/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: testCase.name,
          name: testCase.name,
          description: testCase.description,
          test_type: 'unified',
          steps: testCase.steps.map((s, i) => ({
            step_number: i + 1,
            action: s.name,
            expected_result: s.expectedResult || '',
            test_data: JSON.stringify(s),
          })),
          tags: testCase.tags,
        }),
      });

      if (response.ok) {
        toast.success('Test case saved');
      } else {
        toast.error('Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="flex-none border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg gradient-primary">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <Input
                  value={testCase.name}
                  onChange={(e) => setTestCase(prev => ({ ...prev, name: e.target.value }))}
                  className="text-lg font-semibold border-none p-0 h-auto bg-transparent focus-visible:ring-0"
                  placeholder="Test Case Name"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{testCase.steps.length} steps</span>
                  <span>•</span>
                  <span>Last saved {new Date(testCase.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Center: Mode Tabs */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {(['build', 'code', 'run'] as const).map(tab => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'gradient-primary text-white' : ''}
                >
                  {tab === 'build' && <Edit className="h-4 w-4 mr-1" />}
                  {tab === 'code' && <Code className="h-4 w-4 mr-1" />}
                  {tab === 'run' && <Play className="h-4 w-4 mr-1" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={saveTestCase}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button 
                size="sm" 
                onClick={runTest}
                disabled={isRunning || testCase.steps.length === 0}
                className="gradient-primary text-white"
              >
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Run Test
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Actions */}
          <aside className="w-56 flex-none border-r bg-card p-3 overflow-y-auto">
            <div className="space-y-4">
              {/* Add Steps */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Add Step
                </h3>
                <div className="space-y-1">
                  {Object.entries(STEP_TYPES).map(([type, info]) => (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => addStep(type as StepType)}
                    >
                      <div className={`p-1 rounded mr-2 ${info.color}`}>
                        <info.icon className="h-3 w-3" />
                      </div>
                      {info.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="border-t pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Tools
                </h3>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowModules(true)}
                  >
                    <Package className="h-4 w-4 mr-2 text-purple-500" />
                    Modules
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open('/trace', '_blank')}
                  >
                    <Video className="h-4 w-4 mr-2 text-red-500" />
                    Record
                  </Button>
                </div>
              </div>

              {/* Export Options */}
              <div className="border-t pt-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Export As
                </h3>
                <div className="space-y-1">
                  {([
                    { mode: 'playwright', label: 'Playwright', icon: Monitor },
                    { mode: 'manual', label: 'Manual Test', icon: FileText },
                    { mode: 'api', label: 'API Test', icon: Server },
                    { mode: 'performance', label: 'Performance', icon: Gauge },
                  ] as const).map(({ mode, label, icon: Icon }) => (
                    <Button
                      key={mode}
                      variant={exportMode === mode ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setExportMode(mode);
                        setActiveTab('code');
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Center: Steps List or Code View */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'build' && (
              <div className="flex-1 overflow-y-auto p-4">
                {testCase.steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Layers className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">No steps yet</h3>
                    <p className="text-sm mb-4">Add steps from the left panel or record from browser</p>
                    <div className="flex gap-2">
                      <Button onClick={() => addStep('navigate')} variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                      <Button onClick={() => window.open('/trace', '_blank')} className="gradient-primary text-white">
                        <Video className="h-4 w-4 mr-1" />
                        Record
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-3xl mx-auto">
                    {testCase.steps.map((step, index) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        index={index}
                        isSelected={selectedStepId === step.id}
                        onSelect={() => setSelectedStepId(step.id)}
                        onUpdate={(updates) => updateStep(step.id, updates)}
                        onDelete={() => deleteStep(step.id)}
                        onMove={(dir) => moveStep(step.id, dir)}
                        onDuplicate={() => duplicateStep(step.id)}
                        isFirst={index === 0}
                        isLast={index === testCase.steps.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'code' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-none px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{exportMode.toUpperCase()}</Badge>
                    <span className="text-sm text-muted-foreground">Generated Code</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generateCode(exportMode));
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  <pre className="p-4 text-sm font-mono bg-slate-900 text-slate-100 min-h-full">
                    {generateCode(exportMode)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'run' && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto space-y-4">
                  {/* Execution Status */}
                  <Card className={
                    executionProgress.status === 'passed' ? 'border-green-300 bg-green-50' :
                    executionProgress.status === 'failed' ? 'border-red-300 bg-red-50' :
                    'border-border'
                  }>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {executionProgress.status === 'idle' && (
                            <div className="p-2 rounded-full bg-muted">
                              <Play className="h-5 w-5" />
                            </div>
                          )}
                          {executionProgress.status === 'running' && (
                            <div className="p-2 rounded-full bg-blue-100">
                              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                            </div>
                          )}
                          {executionProgress.status === 'passed' && (
                            <div className="p-2 rounded-full bg-green-100">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                          {executionProgress.status === 'failed' && (
                            <div className="p-2 rounded-full bg-red-100">
                              <AlertCircle className="h-5 w-5 text-red-600" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold">
                              {executionProgress.status === 'idle' && 'Ready to run'}
                              {executionProgress.status === 'running' && 'Running...'}
                              {executionProgress.status === 'passed' && 'Test Passed'}
                              {executionProgress.status === 'failed' && 'Test Failed'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {testCase.steps.length} steps total
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={runTest}
                          disabled={isRunning}
                          className="gradient-primary text-white"
                        >
                          {isRunning ? 'Running...' : 'Run Again'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Steps Progress */}
                  <div className="space-y-2">
                    {testCase.steps.map((step, index) => {
                      const result = executionProgress.results.find(r => r.stepId === step.id);
                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            result?.status === 'passed' ? 'bg-green-50 border-green-200' :
                            result?.status === 'failed' ? 'bg-red-50 border-red-200' :
                            executionProgress.currentStep === index && executionProgress.status === 'running'
                              ? 'bg-blue-50 border-blue-200' :
                            'bg-card'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            result?.status === 'passed' ? 'bg-green-500 text-white' :
                            result?.status === 'failed' ? 'bg-red-500 text-white' :
                            'bg-muted'
                          }`}>
                            {result?.status === 'passed' ? <Check className="h-3 w-3" /> :
                             result?.status === 'failed' ? <X className="h-3 w-3" /> :
                             index + 1}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">{step.name}</span>
                            {result?.duration && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {result.duration}ms
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Right Panel: Step Editor */}
          {selectedStep && activeTab === 'build' && (
            <aside className="w-80 flex-none border-l bg-card p-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Edit Step</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStepId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Step Name */}
                <div className="space-y-2">
                  <Label>Step Name</Label>
                  <Input
                    value={selectedStep.name}
                    onChange={(e) => updateStep(selectedStep.id, { name: e.target.value })}
                  />
                </div>

                {/* Type-specific fields */}
                {selectedStep.type === 'navigate' && (
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={selectedStep.url || ''}
                      onChange={(e) => updateStep(selectedStep.id, { url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {(selectedStep.type === 'click' || selectedStep.type === 'input' || selectedStep.type === 'assert') && (
                  <div className="space-y-2">
                    <Label>Selector</Label>
                    <Textarea
                      value={selectedStep.selector || ''}
                      onChange={(e) => updateStep(selectedStep.id, { selector: e.target.value })}
                      placeholder="page.get_by_role('button', name='Submit')"
                      className="font-mono text-sm"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use Playwright selectors or enable blackbox mode below
                    </p>
                  </div>
                )}

                {selectedStep.type === 'input' && (
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      value={selectedStep.value || ''}
                      onChange={(e) => updateStep(selectedStep.id, { value: e.target.value })}
                      placeholder="Text to enter"
                    />
                  </div>
                )}

                {selectedStep.type === 'wait' && (
                  <div className="space-y-2">
                    <Label>Wait Time (ms)</Label>
                    <Input
                      type="number"
                      value={selectedStep.waitTime || 1000}
                      onChange={(e) => updateStep(selectedStep.id, { waitTime: parseInt(e.target.value) })}
                    />
                  </div>
                )}

                {selectedStep.type === 'api' && (
                  <>
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select
                        value={selectedStep.method || 'GET'}
                        onValueChange={(v) => updateStep(selectedStep.id, { method: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Endpoint</Label>
                      <Input
                        value={selectedStep.endpoint || ''}
                        onChange={(e) => updateStep(selectedStep.id, { endpoint: e.target.value })}
                        placeholder="/api/users"
                      />
                    </div>
                  </>
                )}

                {/* Expected Result (for manual testing) */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Expected Result</Label>
                  <Textarea
                    value={selectedStep.expectedResult || ''}
                    onChange={(e) => updateStep(selectedStep.id, { expectedResult: e.target.value })}
                    placeholder="What should happen after this step?"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for manual test documentation
                  </p>
                </div>

                {/* Blackbox Fallback */}
                {(selectedStep.type === 'click' || selectedStep.type === 'input') && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Blackbox Fallback</Label>
                      <Badge variant="outline" className="text-xs">
                        <Wand2 className="h-3 w-3 mr-1" />
                        When selector fails
                      </Badge>
                    </div>
                    <Select
                      value={selectedStep.fallbackStrategy || ''}
                      onValueChange={(v) => updateStep(selectedStep.id, { fallbackStrategy: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="ocr">OCR Text Detection</SelectItem>
                        <SelectItem value="coordinates">Fixed Coordinates</SelectItem>
                        <SelectItem value="image">Image Matching</SelectItem>
                        <SelectItem value="ai">AI Detection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Browser</Label>
                <Select
                  value={settings.browser}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, browser: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chromium">Chromium</SelectItem>
                    <SelectItem value="firefox">Firefox</SelectItem>
                    <SelectItem value="webkit">WebKit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Headless Mode</Label>
                <input
                  type="checkbox"
                  checked={settings.headless}
                  onChange={(e) => setSettings(prev => ({ ...prev, headless: e.target.checked }))}
                  className="rounded"
                />
              </div>
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={settings.baseUrl}
                  onChange={(e) => setSettings(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={settings.timeout}
                  onChange={(e) => setSettings(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSettings(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// ============================================================================
// STEP CARD COMPONENT
// ============================================================================

interface StepCardProps {
  step: TestStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TestStep>) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDuplicate: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function StepCard({
  step,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  isFirst,
  isLast,
}: StepCardProps) {
  const stepInfo = STEP_TYPES[step.type];

  return (
    <div
      className={`group relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-primary bg-primary/5 border-primary'
          : 'bg-card hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      {/* Step Number */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stepInfo.color}`}>
          <stepInfo.icon className="h-4 w-4" />
        </div>
        {!isLast && <div className="w-0.5 h-4 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{step.name}</span>
          {!step.isEnabled && (
            <Badge variant="secondary" className="text-xs">Disabled</Badge>
          )}
          {step.fallbackStrategy && (
            <Badge variant="outline" className="text-xs">
              <Wand2 className="h-3 w-3 mr-1" />
              {step.fallbackStrategy}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {step.type === 'navigate' && step.url}
          {step.type === 'click' && (step.selector?.slice(0, 50) || 'Click element')}
          {step.type === 'input' && `Enter: ${step.value || '...'}`}
          {step.type === 'wait' && `${step.waitTime || 1000}ms`}
          {step.type === 'assert' && (step.selector?.slice(0, 50) || 'Verify element')}
          {step.type === 'api' && `${step.method || 'GET'} ${step.endpoint || '/api'}`}
          {step.type === 'screenshot' && 'Capture screenshot'}
        </div>
        {step.expectedResult && (
          <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {step.expectedResult.slice(0, 60)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onMove('up'); }}
          disabled={isFirst}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onMove('down'); }}
          disabled={isLast}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdate({ isEnabled: !step.isEnabled })}
            >
              {step.isEnabled ? (
                <><EyeOff className="h-4 w-4 mr-2" />Disable</>
              ) : (
                <><Eye className="h-4 w-4 mr-2" />Enable</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// CODE GENERATION FUNCTIONS
// ============================================================================

function generatePlaywrightCode(testCase: UnifiedTestCase, settings: any): string {
  const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  
  let code = `"""
${testCase.name}
${testCase.description || 'Generated by QAAI Unified Workflow Editor'}
"""

import pytest
from playwright.sync_api import Page, expect

@pytest.fixture(scope="function")
def page(browser):
    page = browser.new_page()
    yield page
    page.close()

def test_${safeName}(page: Page):
    """${testCase.description || testCase.name}"""
`;

  testCase.steps.forEach((step, index) => {
    if (!step.isEnabled) {
      code += `\n    # Step ${index + 1}: ${step.name} (DISABLED)\n`;
      return;
    }

    code += `\n    # Step ${index + 1}: ${step.name}\n`;

    switch (step.type) {
      case 'navigate':
        code += `    page.goto("${step.url || ''}")\n`;
        code += `    page.wait_for_load_state("domcontentloaded")\n`;
        break;
      case 'click':
        if (step.selector) {
          code += `    page.${convertSelector(step.selector)}.click()\n`;
        }
        break;
      case 'input':
        if (step.selector) {
          code += `    page.${convertSelector(step.selector)}.fill("${step.value || ''}")\n`;
        }
        break;
      case 'wait':
        code += `    page.wait_for_timeout(${step.waitTime || 1000})\n`;
        break;
      case 'assert':
        if (step.selector) {
          code += `    expect(page.${convertSelector(step.selector)}).to_be_visible()\n`;
        }
        break;
      case 'screenshot':
        code += `    page.screenshot(path="step_${index + 1}_${safeName}.png")\n`;
        break;
    }
  });

  code += `\n    print("Test completed successfully")`;
  
  return code;
}

function generateManualTestCase(testCase: UnifiedTestCase): string {
  let doc = `# ${testCase.name}\n\n`;
  doc += `**Description:** ${testCase.description || 'N/A'}\n\n`;
  doc += `**Tags:** ${testCase.tags.join(', ') || 'None'}\n\n`;
  doc += `---\n\n`;
  doc += `## Test Steps\n\n`;
  
  testCase.steps.forEach((step, index) => {
    doc += `### Step ${index + 1}: ${step.name}\n\n`;
    
    switch (step.type) {
      case 'navigate':
        doc += `**Action:** Navigate to ${step.url || 'URL'}\n\n`;
        break;
      case 'click':
        doc += `**Action:** Click on element\n`;
        doc += `- Selector: \`${step.selector || 'TBD'}\`\n\n`;
        break;
      case 'input':
        doc += `**Action:** Enter text "${step.value || ''}"\n`;
        doc += `- Field: \`${step.selector || 'TBD'}\`\n\n`;
        break;
      case 'wait':
        doc += `**Action:** Wait for ${step.waitTime || 1000}ms\n\n`;
        break;
      case 'assert':
        doc += `**Action:** Verify condition\n`;
        doc += `- Element: \`${step.selector || 'TBD'}\`\n\n`;
        break;
    }
    
    doc += `**Expected Result:** ${step.expectedResult || 'TBD'}\n\n`;
    doc += `**Status:** [ ] Pass  [ ] Fail  [ ] Blocked\n\n`;
    doc += `---\n\n`;
  });
  
  return doc;
}

function generateAPITestCode(testCase: UnifiedTestCase): string {
  let code = `"""
${testCase.name} - API Test
Generated by QAAI
"""

import pytest
import requests

BASE_URL = "${testCase.variables?.baseUrl || 'http://localhost:8000'}"

class Test${testCase.name.replace(/[^a-z0-9]+/gi, '')}:
`;

  const apiSteps = testCase.steps.filter(s => s.type === 'api');
  
  if (apiSteps.length === 0) {
    code += `    def test_placeholder(self):
        """No API steps defined"""
        pass
`;
  } else {
    apiSteps.forEach((step, index) => {
      const safeName = step.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      code += `
    def test_${index + 1}_${safeName}(self):
        """${step.name}"""
        response = requests.${(step.method || 'GET').toLowerCase()}(
            f"{BASE_URL}${step.endpoint || '/'}",
            ${step.body ? `json=${step.body},` : ''}
            headers=${JSON.stringify(step.headers || {})}
        )
        assert response.status_code in [200, 201, 204], f"Expected 2xx, got {response.status_code}"
`;
    });
  }
  
  return code;
}

function generatePerformanceScript(testCase: UnifiedTestCase): string {
  const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  
  let code = `// K6 Performance Test Script
// ${testCase.name}
// Generated by QAAI

import http from 'k6/http';
import { check, sleep } from 'k6';
import { browser } from 'k6/experimental/browser';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 50,
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
  thresholds: {
    checks: ['rate>0.9'],
    browser_web_vital_lcp: ['p(95)<2500'],
    browser_web_vital_fcp: ['p(95)<1500'],
  },
};

export default async function () {
  const page = browser.newPage();
  
  try {
`;

  testCase.steps.forEach((step, index) => {
    if (!step.isEnabled) return;
    
    switch (step.type) {
      case 'navigate':
        code += `    // Step ${index + 1}: ${step.name}
    await page.goto('${step.url || ''}');
`;
        break;
      case 'click':
        if (step.selector) {
          code += `    // Step ${index + 1}: ${step.name}
    await page.locator('${step.selector}').click();
`;
        }
        break;
      case 'input':
        if (step.selector) {
          code += `    // Step ${index + 1}: ${step.name}
    await page.locator('${step.selector}').fill('${step.value || ''}');
`;
        }
        break;
    }
  });

  code += `
  } finally {
    page.close();
  }
  
  sleep(1);
}
`;
  
  return code;
}

// Helper to convert JS-style selectors to Python
function convertSelector(selector: string): string {
  // Already Python style
  if (selector.includes('get_by_')) return selector.replace(/^page\./, '');
  
  // Convert JS to Python
  return selector
    .replace(/getByRole\(['"](\w+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\)/g, 'get_by_role("$1", name="$2")')
    .replace(/getByRole\(['"](\w+)['"]\)/g, 'get_by_role("$1")')
    .replace(/getByText\(['"]([^'"]+)['"]\)/g, 'get_by_text("$1")')
    .replace(/getByLabel\(['"]([^'"]+)['"]\)/g, 'get_by_label("$1")')
    .replace(/getByPlaceholder\(['"]([^'"]+)['"]\)/g, 'get_by_placeholder("$1")')
    .replace(/locator\(['"]([^'"]+)['"]\)/g, 'locator("$1")')
    .replace(/^page\./, '');
}
