/**
 * AI Flow Explorer Component
 * 
 * Advanced autonomous exploration that:
 * - Discovers ALL elements including hidden ones
 * - Builds a navigation graph of the entire app
 * - Generates runnable test cases with assertions
 * - Can automate manual test cases
 */

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAI } from "@/contexts/AIContext";
import { 
  Bot, 
  Play, 
  Square, 
  Zap, 
  Target, 
  Check, 
  X, 
  MousePointer, 
  Type, 
  List, 
  Navigation,
  Sparkles,
  AlertCircle,
  TestTube2,
  Loader2,
  Globe,
  Eye,
  Save,
  AlertTriangle,
  Map,
  Network,
  Layers,
  ChevronRight,
  FileText,
  Camera,
  EyeOff,
  ArrowRight,
  Workflow
} from "lucide-react";

interface PageNode {
  id: string;
  url: string;
  title: string;
  elementCount: number;
  hiddenElementCount: number;
  navigationTriggerCount: number;
  screenshot?: string;
  fullyExplored: boolean;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  trigger: string;
  action: string;
  stepCount: number;
}

interface DiscoveredTest {
  id: string;
  name: string;
  description: string;
  steps: any[];
  assertions: any[];
  priority: string;
}

interface Coverage {
  pagesDiscovered: number;
  pagesFullyExplored: number;
  elementsDiscovered: number;
  hiddenElementsFound: number;
  navigationPathsFound: number;
  flowsGenerated: number;
  assertionsCreated: number;
}

interface AIFlowExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveTests: (tests: DiscoveredTest[]) => void;
}

export function AIFlowExplorer({ isOpen, onClose, currentUrl, onSaveTests }: AIFlowExplorerProps) {
  const { config } = useAI();
  const [isRunning, setIsRunning] = useState(false);
  const [startUrl, setStartUrl] = useState(currentUrl);
  const [maxPages, setMaxPages] = useState(20);
  const [activeTab, setActiveTab] = useState('goal');
  
  // Check if running in Electron (desktop app) - backend may have API key
  const isElectron = !!(window as any).electronAPI;
  
  // Test data
  const [showTestData, setShowTestData] = useState(false);
  const [customTestData, setCustomTestData] = useState({
    username: '',
    email: '',
    password: '',
  });
  
  // Exploration results
  const [pageGraph, setPageGraph] = useState<{ nodes: PageNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [discoveredTests, setDiscoveredTests] = useState<DiscoveredTest[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [logs, setLogs] = useState<{ id: string; type: string; message: string; timestamp: Date }[]>([]);
  
  // Manual test automation
  const [manualTestInput, setManualTestInput] = useState('');
  const [automatedSteps, setAutomatedSteps] = useState<any[]>([]);
  const [isAutomating, setIsAutomating] = useState(false);
  
  // Goal Agent
  const [goalInput, setGoalInput] = useState('');
  const [isExecutingGoal, setIsExecutingGoal] = useState(false);
  const [goalSteps, setGoalSteps] = useState<any[]>([]);
  const [goalResult, setGoalResult] = useState<any>(null);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Update start URL when current URL changes
  useEffect(() => {
    if (currentUrl && !isRunning) {
      setStartUrl(currentUrl);
    }
  }, [currentUrl, isRunning]);
  
  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  // Set up IPC listeners
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const handleProgress = (_: any, data: any) => {
      addLog('info', `${data.type}: ${JSON.stringify(data)}`);
      if (data.type === 'page_explored') {
        addLog('success', `Explored: ${data.fromUrl} → ${data.toUrl} via "${data.trigger}"`);
      }
    };
    
    const handlePageDiscovered = (_: any, data: any) => {
      addLog('page', `📄 New page: ${data.title} (${data.url})`);
    };
    
    const handleTestGenerated = (_: any, test: DiscoveredTest) => {
      setDiscoveredTests(prev => [...prev, test]);
      addLog('test', `🧪 Generated test: "${test.name}"`);
    };
    
    const handleError = (_: any, error: any) => {
      addLog('error', error.error || error.message || 'Unknown error');
    };
    
    // @ts-ignore
    window.electronAPI?.on('flow-explorer-progress', handleProgress);
    // @ts-ignore
    window.electronAPI?.on('flow-explorer-page-discovered', handlePageDiscovered);
    // @ts-ignore
    window.electronAPI?.on('flow-explorer-test-generated', handleTestGenerated);
    // @ts-ignore
    window.electronAPI?.on('flow-explorer-error', handleError);
    
    // Goal Agent listeners
    const handleGoalStep = (_: any, data: any) => {
      setGoalSteps(prev => [...prev, data]);
      addLog('info', `Step ${data.step}: ${data.action?.description || 'Action'}`);
    };
    
    // @ts-ignore
    window.electronAPI?.on('goal-agent-step', handleGoalStep);
    
    return () => {
      // @ts-ignore
      window.electronAPI?.off?.('flow-explorer-progress', handleProgress);
      // @ts-ignore
      window.electronAPI?.off?.('flow-explorer-page-discovered', handlePageDiscovered);
      // @ts-ignore
      window.electronAPI?.off?.('flow-explorer-test-generated', handleTestGenerated);
      // @ts-ignore
      window.electronAPI?.off?.('flow-explorer-error', handleError);
      // @ts-ignore
      window.electronAPI?.off?.('goal-agent-step', handleGoalStep);
    };
  }, []);
  
  const addLog = (type: string, message: string) => {
    setLogs(prev => [...prev, {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date()
    }]);
  };
  
  const handleStart = async () => {
    if (!window.electronAPI) {
      addLog('error', 'Electron API not available');
      return;
    }
    
    // In Electron, backend may have API key - use special marker
    const apiKeyToUse = config.apiKey || (isElectron ? '***env***' : '');
    
    if (!apiKeyToUse) {
      toast.error('OpenAI API key not configured. Go to Settings > AI.');
      return;
    }
    
    setIsRunning(true);
    setLogs([]);
    setPageGraph({ nodes: [], edges: [] });
    setDiscoveredTests([]);
    setCoverage(null);
    
    addLog('info', `🚀 Starting Flow Explorer from ${startUrl}`);
    addLog('info', `📊 Will explore up to ${maxPages} pages`);
    
    try {
      // @ts-ignore
      const result = await window.electronAPI?.invoke('flow-explorer-start', {
        startUrl,
        maxPages,
        apiKey: apiKeyToUse,
        model: config.model || 'gpt-4o-mini',
        testData: {
          ...customTestData
        }
      });
      
      if (result?.success) {
        setPageGraph(result.pageGraph || { nodes: [], edges: [] });
        setCoverage(result.coverage);
        addLog('success', `✅ Exploration complete!`);
        addLog('info', `📄 Pages: ${result.coverage?.pagesDiscovered || 0}`);
        addLog('info', `🔗 Paths: ${result.coverage?.navigationPathsFound || 0}`);
        addLog('info', `🧪 Tests: ${result.coverage?.flowsGenerated || 0}`);
      } else {
        addLog('error', result?.error || 'Exploration failed');
      }
    } catch (error: any) {
      addLog('error', error.message);
    }
    
    setIsRunning(false);
  };
  
  const handleStop = async () => {
    // @ts-ignore
    await window.electronAPI?.invoke('flow-explorer-stop');
    setIsRunning(false);
    addLog('info', '⏹️ Exploration stopped');
  };
  
  const handleAutomateManual = async () => {
    if (!manualTestInput.trim()) {
      toast.error('Please enter a manual test case description');
      return;
    }
    
    // In Electron, backend may have API key - use special marker
    const apiKeyToUse = config.apiKey || (isElectron ? '***env***' : '');
    
    setIsAutomating(true);
    addLog('info', '🤖 Converting manual test to automation...');
    
    try {
      // @ts-ignore
      const result = await window.electronAPI?.invoke('flow-explorer-automate-manual', {
        description: manualTestInput,
        apiKey: apiKeyToUse,
        testData: customTestData
      });
      
      if (result?.success) {
        setAutomatedSteps(result.automatedSteps);
        addLog('success', `✅ Generated ${result.stepCount} automated steps`);
      } else {
        addLog('error', result?.error || 'Automation failed');
      }
    } catch (error: any) {
      addLog('error', error.message);
    }
    
    setIsAutomating(false);
  };
  
  const handleSaveTests = () => {
    if (discoveredTests.length > 0) {
      onSaveTests(discoveredTests);
      toast.success(`Saved ${discoveredTests.length} tests`);
    }
  };
  
  const handleExecuteGoal = async () => {
    if (!goalInput.trim()) {
      toast.error('Please enter a goal to execute');
      return;
    }
    
    const apiKeyToUse = config.apiKey || (isElectron ? '***env***' : '');
    
    setIsExecutingGoal(true);
    setGoalSteps([]);
    setGoalResult(null);
    setActiveTab('goal');
    
    addLog('info', `🎯 Starting goal: "${goalInput}"`);
    
    try {
      // @ts-ignore
      const result = await window.electronAPI?.invoke('goal-agent-execute', {
        goal: goalInput,
        startUrl: startUrl,
        apiKey: apiKeyToUse,
        maxSteps: 50,
        testData: customTestData
      });
      
      setGoalResult(result);
      
      if (result?.success) {
        addLog('success', `✅ Goal achieved in ${result.totalSteps} steps!`);
        toast.success('Goal achieved!');
        
        // Add to discovered tests
        if (result.testCase) {
          setDiscoveredTests(prev => [...prev, result.testCase]);
        }
      } else {
        addLog('error', result?.error || 'Goal not achieved');
      }
    } catch (error: any) {
      addLog('error', error.message);
    }
    
    setIsExecutingGoal(false);
  };
  
  const handleStopGoal = async () => {
    // @ts-ignore
    await window.electronAPI?.invoke('goal-agent-stop');
    setIsExecutingGoal(false);
    addLog('info', '⏹️ Goal execution stopped');
  };
  
  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return <X className="h-3 w-3 text-red-400" />;
      case 'success': return <Check className="h-3 w-3 text-emerald-400" />;
      case 'page': return <Globe className="h-3 w-3 text-blue-400" />;
      case 'test': return <TestTube2 className="h-3 w-3 text-purple-400" />;
      default: return <ChevronRight className="h-3 w-3 text-slate-400" />;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Workflow className="h-6 w-6 text-indigo-400" />
            AI Flow Explorer
            <Badge variant="outline" className="ml-2 bg-indigo-500/20 text-indigo-300 border-indigo-500/50">
              v2.0
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Autonomous discovery of ALL application flows, elements, and navigation paths
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Configuration */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Landing Page URL</Label>
                <Input
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isRunning}
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Max Pages: {maxPages}</Label>
                <Slider
                  value={[maxPages]}
                  onValueChange={([v]) => setMaxPages(v)}
                  min={5}
                  max={100}
                  step={5}
                  disabled={isRunning}
                  className="mt-3"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Test Credentials</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTestData(!showTestData)}
                  className="w-full justify-between text-indigo-300"
                  disabled={isRunning}
                >
                  <span className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    {showTestData ? 'Hide' : 'Configure'}
                  </span>
                </Button>
              </div>
            </div>
            
            {showTestData && (
              <div className="mt-3 grid grid-cols-3 gap-3 p-3 bg-slate-900/30 rounded-lg">
                <Input
                  value={customTestData.username}
                  onChange={(e) => setCustomTestData(prev => ({ ...prev, username: e.target.value, email: e.target.value }))}
                  placeholder="Username/Email"
                  className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                />
                <Input
                  type="password"
                  value={customTestData.password}
                  onChange={(e) => setCustomTestData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Password"
                  className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                />
              </div>
            )}
          </div>
          
          {/* Running Progress */}
          {isRunning && (
            <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/30">
              <div className="flex items-center gap-2 text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Exploring application flows...</span>
                <span className="ml-auto text-sm text-slate-400">
                  {pageGraph.nodes.length} pages | {pageGraph.edges.length} paths | {discoveredTests.length} tests
                </span>
              </div>
            </div>
          )}
          
          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-800/50 border border-slate-700/50">
              <TabsTrigger value="goal" className="data-[state=active]:bg-emerald-500/20">
                <Target className="h-4 w-4 mr-2" />
                Goal Agent
              </TabsTrigger>
              <TabsTrigger value="graph" className="data-[state=active]:bg-indigo-500/20">
                <Network className="h-4 w-4 mr-2" />
                Navigation Graph
              </TabsTrigger>
              <TabsTrigger value="tests" className="data-[state=active]:bg-indigo-500/20">
                <TestTube2 className="h-4 w-4 mr-2" />
                Tests ({discoveredTests.length})
              </TabsTrigger>
              <TabsTrigger value="manual" className="data-[state=active]:bg-indigo-500/20">
                <FileText className="h-4 w-4 mr-2" />
                Manual → Auto
              </TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-indigo-500/20">
                <List className="h-4 w-4 mr-2" />
                Logs
              </TabsTrigger>
            </TabsList>
            
            {/* Goal Agent Tab */}
            <TabsContent value="goal" className="flex-1 mt-4 min-h-0">
              <div className="h-full grid grid-cols-2 gap-4">
                {/* Goal Input */}
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-emerald-500/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-5 w-5 text-emerald-400" />
                    <Label className="text-emerald-300 text-lg font-medium">What do you want to achieve?</Label>
                  </div>
                  <Textarea
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder={`Enter your goal in plain English, e.g.:

• "Create a new Opportunity named 'Q1 Deal' worth $50,000"
• "Search for 'Test Account' and update the phone number"  
• "Navigate to Reports and export the Sales Pipeline report"
• "Add a new Contact with email john@test.com"
• "Find and delete any lead named 'Test Lead'"

The AI agent will automatically:
1. Analyze the current page
2. Decide the best action to reach your goal
3. Fill forms with your test data
4. Navigate through the app
5. Complete the entire flow`}
                    className="flex-1 bg-slate-900/50 border-slate-600 resize-none min-h-[200px]"
                    disabled={isExecutingGoal}
                  />
                  
                  {isExecutingGoal && (
                    <div className="mt-4 flex items-center gap-2 text-emerald-300 text-sm bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI is working towards your goal... Check Steps panel →
                    </div>
                  )}
                  
                  <div className="mt-3 text-xs text-slate-500">
                    💡 Click "Execute Goal" button below to start
                  </div>
                </div>
                
                {/* Steps Taken */}
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="font-medium text-slate-200">Steps Taken</span>
                    <Badge variant="outline" className="ml-auto">{goalSteps.length}</Badge>
                    {goalResult?.success && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50">
                        Goal Achieved!
                      </Badge>
                    )}
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    {goalSteps.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No steps yet</p>
                        <p className="text-sm mt-2">Enter a goal and click Execute</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {goalSteps.map((step, i) => (
                          <div 
                            key={i} 
                            className={`p-3 rounded-lg border ${
                              step.result?.success 
                                ? 'bg-emerald-500/10 border-emerald-500/30' 
                                : 'bg-amber-500/10 border-amber-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-sm">Step {step.step}</span>
                              <span className={`font-medium ${step.result?.success ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {step.action?.action || 'action'}
                              </span>
                              {step.result?.success ? (
                                <Check className="h-4 w-4 text-emerald-400 ml-auto" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-400 ml-auto" />
                              )}
                            </div>
                            <div className="text-sm text-slate-300 mt-1">
                              {step.action?.description || step.action?.target}
                            </div>
                            {step.action?.value && (
                              <div className="text-xs text-slate-500 mt-1">
                                Value: "{step.action.value}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  
                  {goalResult?.testCase && (
                    <div className="p-3 border-t border-slate-700/50">
                      <Button
                        onClick={() => {
                          onSaveTests([goalResult.testCase]);
                          toast.success('Test case saved!');
                        }}
                        className="w-full"
                        variant="outline"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save as Test Case
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Navigation Graph Tab */}
            <TabsContent value="graph" className="flex-1 mt-4 min-h-0">
              <div className="h-full grid grid-cols-2 gap-4">
                {/* Pages */}
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-slate-200">Discovered Pages</span>
                    <Badge variant="outline" className="ml-auto">{pageGraph.nodes.length}</Badge>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    {pageGraph.nodes.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Map className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No pages discovered yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pageGraph.nodes.map((node) => (
                          <div key={node.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <div className="font-medium text-blue-200 truncate">{node.title || 'Untitled'}</div>
                            <div className="text-xs text-slate-400 truncate mt-1">{node.url}</div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Layers className="h-3 w-3" />
                                {node.elementCount} elements
                              </span>
                              <span className="flex items-center gap-1 text-amber-400">
                                <EyeOff className="h-3 w-3" />
                                {node.hiddenElementCount} hidden
                              </span>
                              <span className="flex items-center gap-1 text-indigo-400">
                                <Navigation className="h-3 w-3" />
                                {node.navigationTriggerCount} triggers
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
                
                {/* Navigation Paths */}
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-purple-400" />
                    <span className="font-medium text-slate-200">Navigation Paths</span>
                    <Badge variant="outline" className="ml-auto">{pageGraph.edges.length}</Badge>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    {pageGraph.edges.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Network className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No paths discovered yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pageGraph.edges.map((edge) => (
                          <div key={edge.id} className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-purple-200">"{edge.trigger}"</span>
                              <ArrowRight className="h-3 w-3 text-slate-500" />
                              <Badge variant="outline" className="text-xs">{edge.stepCount} steps</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
            
            {/* Tests Tab */}
            <TabsContent value="tests" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-full">
                {discoveredTests.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <TestTube2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No tests generated yet</p>
                    <p className="text-sm mt-2">Start exploration to auto-generate test cases</p>
                  </div>
                ) : (
                  <div className="space-y-3 p-2">
                    {discoveredTests.map((test) => (
                      <div key={test.id} className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-purple-200">{test.name}</h4>
                          <Badge 
                            variant="outline" 
                            className={
                              test.priority === 'high' 
                                ? 'bg-red-500/20 text-red-300 border-red-500/50'
                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                            }
                          >
                            {test.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{test.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                          <span>{test.steps?.length || 0} steps</span>
                          <span>{test.assertions?.length || 0} assertions</span>
                        </div>
                        {/* Show steps preview */}
                        <div className="mt-3 space-y-1">
                          {test.steps?.slice(0, 3).map((step: any, i: number) => (
                            <div key={i} className="text-xs text-slate-400 flex items-center gap-2">
                              <span className="w-4 text-right text-slate-500">{i + 1}.</span>
                              <span className="text-indigo-300">{step.qword}</span>
                              <span className="truncate">{step.args?.join(' ')}</span>
                            </div>
                          ))}
                          {(test.steps?.length || 0) > 3 && (
                            <div className="text-xs text-slate-500 pl-6">
                              +{(test.steps?.length || 0) - 3} more steps
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
            
            {/* Manual → Auto Tab */}
            <TabsContent value="manual" className="flex-1 mt-4 min-h-0">
              <div className="h-full grid grid-cols-2 gap-4">
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
                  <Label className="text-slate-300 mb-2">Manual Test Case</Label>
                  <Textarea
                    value={manualTestInput}
                    onChange={(e) => setManualTestInput(e.target.value)}
                    placeholder={`Enter manual test case description, e.g.:

1. Go to login page
2. Enter username "admin@test.com"
3. Enter password "Test123!"
4. Click Login button
5. Verify dashboard is displayed
6. Click on Settings menu
7. Verify Settings page loads`}
                    className="flex-1 bg-slate-900/50 border-slate-600 resize-none"
                    disabled={isAutomating}
                  />
                  <Button
                    onClick={handleAutomateManual}
                    disabled={isAutomating || !manualTestInput.trim() || (!config.apiKey && !isElectron)}
                    className="mt-3 bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    {isAutomating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Convert to Automation
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="font-medium text-slate-200">Automated Steps</span>
                    <Badge variant="outline" className="ml-auto">{automatedSteps.length}</Badge>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    {automatedSteps.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No automated steps yet</p>
                        <p className="text-xs mt-2">Enter a manual test and click Convert</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {automatedSteps.map((step, i) => (
                          <div key={step.id || i} className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-300 font-medium">{step.qword}</span>
                              <span className="text-slate-400 truncate">{step.args?.join(' | ')}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{step.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  {automatedSteps.length > 0 && (
                    <div className="p-3 border-t border-slate-700/50">
                      <Button
                        onClick={() => {
                          onSaveTests([{
                            id: `manual_${Date.now()}`,
                            name: 'Manual Test Automation',
                            description: manualTestInput.substring(0, 100),
                            steps: automatedSteps,
                            assertions: [],
                            priority: 'medium'
                          }]);
                          toast.success('Test saved!');
                        }}
                        className="w-full"
                        variant="outline"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save as Test Case
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* Logs Tab */}
            <TabsContent value="logs" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-full bg-slate-800/30 rounded-lg border border-slate-700/50 p-2">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <List className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 px-2 py-1 hover:bg-slate-700/30 rounded">
                        {getLogIcon(log.type)}
                        <span className="text-slate-500">{log.timestamp.toLocaleTimeString()}</span>
                        <span className={
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-emerald-400' :
                          log.type === 'page' ? 'text-blue-400' :
                          log.type === 'test' ? 'text-purple-400' :
                          'text-slate-300'
                        }>{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          
          {/* Coverage Summary */}
          {coverage && (
            <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Check className="h-4 w-4" />
                  <span>Exploration Complete</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Globe className="h-3 w-3" />
                  <span>{coverage.pagesDiscovered} pages</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Layers className="h-3 w-3" />
                  <span>{coverage.elementsDiscovered} elements</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <EyeOff className="h-3 w-3" />
                  <span>{coverage.hiddenElementsFound} hidden</span>
                </div>
                <div className="flex items-center gap-1 text-indigo-400">
                  <Navigation className="h-3 w-3" />
                  <span>{coverage.navigationPathsFound} paths</span>
                </div>
                <div className="flex items-center gap-1 text-purple-400">
                  <TestTube2 className="h-3 w-3" />
                  <span>{coverage.flowsGenerated} tests</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="border-slate-600">
              Close
            </Button>
            
            <div className="flex-1" />
            
            {discoveredTests.length > 0 && (
              <Button onClick={handleSaveTests} className="bg-purple-600 hover:bg-purple-700">
                <Save className="h-4 w-4 mr-2" />
                Save {discoveredTests.length} Tests
              </Button>
            )}
            
            {activeTab === 'goal' ? (
              // Goal Agent buttons
              isExecutingGoal ? (
                <Button onClick={handleStopGoal} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Goal
                </Button>
              ) : (
                <Button
                  onClick={handleExecuteGoal}
                  disabled={!goalInput.trim() || (!config.apiKey && !isElectron)}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Execute Goal
                </Button>
              )
            ) : (
              // Flow Explorer buttons
              isRunning ? (
                <Button onClick={handleStop} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleStart}
                  disabled={!config.apiKey && !isElectron}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Exploration
                </Button>
              )
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
