/**
 * AI Explorer Agent Component
 * 
 * A fully autonomous AI agent that:
 * - Navigates pages
 * - Performs actions (clicks, fills, selects)
 * - Observes state changes
 * - Automatically builds test cases
 * 
 * Like watching a robot explore your app!
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
  AlertTriangle
} from "lucide-react";

interface ActionLog {
  id: string;
  timestamp: Date;
  type: 'action' | 'discovery' | 'error' | 'info';
  action?: string;
  element?: string;
  result?: boolean;
  message?: string;
  stateChange?: any[];
}

interface DiscoveredTest {
  id: string;
  name: string;
  description: string;
  priority: string;
  steps: any[];
  assertions: any[];
}

interface AIExplorerAgentProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveTests: (tests: DiscoveredTest[]) => void;
}

export function AIExplorerAgent({ isOpen, onClose, currentUrl, onSaveTests }: AIExplorerAgentProps) {
  const { config } = useAI();
  const [isRunning, setIsRunning] = useState(false);
  const [startUrl, setStartUrl] = useState(currentUrl);
  const [maxActions, setMaxActions] = useState(30);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [discoveredTests, setDiscoveredTests] = useState<DiscoveredTest[]>([]);
  const [progress, setProgress] = useState({ actionCount: 0, maxActions: 30, pagesVisited: 0 });
  const [status, setStatus] = useState<'idle' | 'exploring' | 'complete' | 'error'>('idle');
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Check if running in Electron (desktop app) - backend may have API key
  const isElectron = !!(window as any).electronAPI;
  
  // User-provided test data for accurate form filling
  const [showTestData, setShowTestData] = useState(false);
  const [customTestData, setCustomTestData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    search: '',
    custom1Label: '',
    custom1Value: '',
    custom2Label: '',
    custom2Value: '',
  });
  
  // Update start URL when current URL changes
  useEffect(() => {
    if (currentUrl && !isRunning) {
      setStartUrl(currentUrl);
    }
  }, [currentUrl, isRunning]);
  
  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actionLogs]);
  
  // Set up IPC listeners
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const handleProgress = (_: any, data: any) => {
      setProgress(data);
      if (data.type === 'complete') {
        setStatus('complete');
        setIsRunning(false);
        addLog({
          type: 'info',
          message: `✨ Exploration complete! Performed ${data.actionCount} actions, visited ${data.pagesVisited} pages, discovered ${data.testsDiscovered} tests`
        });
      }
    };
    
    const handleAction = (_: any, data: any) => {
      addLog({
        type: 'action',
        action: data.action,
        element: data.element,
        result: data.result,
        stateChange: data.stateChange
      });
    };
    
    const handleTestDiscovered = (_: any, test: DiscoveredTest) => {
      setDiscoveredTests(prev => [...prev, test]);
      addLog({
        type: 'discovery',
        message: `🎉 Discovered test: "${test.name}"`
      });
    };
    
    const handleError = (_: any, error: any) => {
      addLog({
        type: 'error',
        message: error.error || error.message || 'Unknown error'
      });
    };
    
    // Subscribe to events
    // @ts-ignore - Electron API
    window.electronAPI?.on('ai-explorer-progress', handleProgress);
    // @ts-ignore
    window.electronAPI?.on('ai-explorer-action', handleAction);
    // @ts-ignore
    window.electronAPI?.on('ai-explorer-test-discovered', handleTestDiscovered);
    // @ts-ignore
    window.electronAPI?.on('ai-explorer-error', handleError);
    
    return () => {
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-explorer-progress', handleProgress);
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-explorer-action', handleAction);
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-explorer-test-discovered', handleTestDiscovered);
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-explorer-error', handleError);
    };
  }, []);
  
  const addLog = (log: Omit<ActionLog, 'id' | 'timestamp'>) => {
    setActionLogs(prev => [...prev, {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }]);
  };
  
  const handleStart = async () => {
    if (!window.electronAPI) {
      addLog({ type: 'error', message: 'Electron API not available' });
      return;
    }
    
    // Backend resolves API key from stored BYOK or env var
    if (!config.hasApiKey && !isElectron) {
      toast.error('OpenAI API key not configured. Go to Settings > AI to add it.');
      addLog({ type: 'error', message: 'No API key configured. Go to Settings > AI to add one.' });
      return;
    }
    
    setIsRunning(true);
    setStatus('exploring');
    setActionLogs([]);
    setDiscoveredTests([]);
    
    addLog({
      type: 'info',
      message: `🤖 Starting autonomous exploration from ${startUrl}`
    });
    addLog({
      type: 'info',
      message: `📋 Will perform up to ${maxActions} actions and discover test cases`
    });
    
    try {
      console.log('[AIExplorer] Calling ai-explorer-start with:', { startUrl, maxActions, hasApiKey: config.hasApiKey });
      
      // Build test data object from user-provided values
      const userTestData: Record<string, string> = {};
      if (customTestData.username) userTestData.username = customTestData.username;
      if (customTestData.email) userTestData.email = customTestData.email;
      if (customTestData.password) userTestData.password = customTestData.password;
      if (customTestData.firstName) userTestData.firstName = customTestData.firstName;
      if (customTestData.lastName) userTestData.lastName = customTestData.lastName;
      if (customTestData.phone) userTestData.phone = customTestData.phone;
      if (customTestData.search) userTestData.search = customTestData.search;
      // Custom fields
      if (customTestData.custom1Label && customTestData.custom1Value) {
        userTestData[customTestData.custom1Label.toLowerCase()] = customTestData.custom1Value;
      }
      if (customTestData.custom2Label && customTestData.custom2Value) {
        userTestData[customTestData.custom2Label.toLowerCase()] = customTestData.custom2Value;
      }
      
      if (Object.keys(userTestData).length > 0) {
        addLog({ type: 'info', message: `📋 Using custom test data: ${Object.keys(userTestData).join(', ')}` });
      }
      
      // @ts-ignore - Electron API
      const result = await window.electronAPI?.invoke('ai-explorer-start', {
        startUrl,
        maxActions,
        maxPages: 5,
        model: config.model || 'gpt-4o-mini',
        testData: Object.keys(userTestData).length > 0 ? userTestData : undefined
      });
      
      console.log('[AIExplorer] Result:', result);
      
      if (!result?.success) {
        setStatus('error');
        addLog({ type: 'error', message: result?.error || 'Exploration failed (no error message)' });
      } else {
        addLog({ type: 'info', message: `✅ Exploration completed: ${result.actionsPerformed || 0} actions` });
      }
    } catch (error: any) {
      console.error('[AIExplorer] Error:', error);
      setStatus('error');
      addLog({ type: 'error', message: error.message || 'Failed to start exploration' });
    }
    
    setIsRunning(false);
  };
  
  const handleStop = async () => {
    if (window.electronAPI) {
      // @ts-ignore - Electron API
      await window.electronAPI?.invoke('ai-explorer-stop');
      setIsRunning(false);
      setStatus('idle');
      addLog({ type: 'info', message: '⏹️ Exploration stopped by user' });
    }
  };
  
  const handleSaveTests = () => {
    if (discoveredTests.length > 0) {
      onSaveTests(discoveredTests);
    }
  };
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'click': return <MousePointer className="h-3 w-3" />;
      case 'fill': return <Type className="h-3 w-3" />;
      case 'select': return <List className="h-3 w-3" />;
      case 'navigate': return <Navigation className="h-3 w-3" />;
      case 'check': return <Check className="h-3 w-3" />;
      default: return <Zap className="h-3 w-3" />;
    }
  };
  
  const getLogStyle = (log: ActionLog) => {
    switch (log.type) {
      case 'action':
        return log.result 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          : 'bg-red-500/10 border-red-500/30 text-red-200';
      case 'discovery':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-200';
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-200';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-200';
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bot className="h-6 w-6 text-purple-400" />
            AI Explorer Agent
            <Badge variant="outline" className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/50">
              Autonomous
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Watch the AI agent explore your application, perform actions, and discover test cases automatically
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Configuration Panel */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Start URL</Label>
                <Input
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isRunning}
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Max Actions: {maxActions}</Label>
                <Slider
                  value={[maxActions]}
                  onValueChange={([v]) => setMaxActions(v)}
                  min={10}
                  max={100}
                  step={5}
                  disabled={isRunning}
                  className="mt-3"
                />
              </div>
            </div>
            
            {/* Test Data Configuration Toggle */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTestData(!showTestData)}
                className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 w-full justify-between"
                disabled={isRunning}
              >
                <span className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Test Data (Login/Forms)
                </span>
                <span className="text-xs text-slate-500">{showTestData ? '▲ Hide' : '▼ Configure'}</span>
              </Button>
              
              {showTestData && (
                <div className="mt-3 space-y-3 bg-slate-900/30 p-3 rounded-lg border border-slate-700/30">
                  <p className="text-xs text-slate-400 mb-2">
                    Provide real credentials for accurate login testing. Leave blank to use defaults.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Username/Email</Label>
                      <Input
                        value={customTestData.username || customTestData.email}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, username: e.target.value, email: e.target.value }))}
                        placeholder="your@email.com"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Password</Label>
                      <Input
                        type="password"
                        value={customTestData.password}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">First Name</Label>
                      <Input
                        value={customTestData.firstName}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Last Name</Label>
                      <Input
                        value={customTestData.lastName}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Doe"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Phone</Label>
                      <Input
                        value={customTestData.phone}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="555-123-4567"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Search Term</Label>
                      <Input
                        value={customTestData.search}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, search: e.target.value }))}
                        placeholder="test query"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-sm"
                      />
                    </div>
                  </div>
                  {/* Custom fields */}
                  <div className="pt-2 border-t border-slate-700/30">
                    <Label className="text-xs text-slate-400 mb-2 block">Custom Fields (optional)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        value={customTestData.custom1Label}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, custom1Label: e.target.value }))}
                        placeholder="Field name"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-xs"
                      />
                      <Input
                        value={customTestData.custom1Value}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, custom1Value: e.target.value }))}
                        placeholder="Value"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-xs"
                      />
                      <Input
                        value={customTestData.custom2Label}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, custom2Label: e.target.value }))}
                        placeholder="Field name"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-xs"
                      />
                      <Input
                        value={customTestData.custom2Value}
                        onChange={(e) => setCustomTestData(prev => ({ ...prev, custom2Value: e.target.value }))}
                        placeholder="Value"
                        disabled={isRunning}
                        className="bg-slate-800/50 border-slate-600 h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* API Key Warning - only show if not in Electron (desktop app has backend key) */}
          {!config.hasApiKey && !isElectron && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>OpenAI API key not configured. Go to Settings → AI to add your API key.</span>
            </div>
          )}
          
          {/* Progress Bar */}
          {isRunning && (
            <div className="bg-slate-800/50 rounded-lg p-3 border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-purple-300 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exploring...
                </span>
                <span className="text-sm text-slate-400">
                  {progress.actionCount} / {progress.maxActions} actions
                </span>
              </div>
              <Progress value={(progress.actionCount / progress.maxActions) * 100} className="h-2" />
            </div>
          )}
          
          {/* Split View: Logs and Discovered Tests */}
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
            {/* Action Logs */}
            <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
              <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-400" />
                <span className="font-medium text-slate-200">Live Actions</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {actionLogs.length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {actionLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No actions yet</p>
                      <p className="text-xs">Start exploration to see actions</p>
                    </div>
                  ) : (
                    actionLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-2 rounded border text-sm ${getLogStyle(log)}`}
                      >
                        <div className="flex items-start gap-2">
                          {log.type === 'action' && (
                            <>
                              <span className="mt-0.5">{getActionIcon(log.action || '')}</span>
                              <div className="flex-1">
                                <span className="font-medium capitalize">{log.action}</span>
                                <span className="mx-1 text-slate-400">→</span>
                                <span className="text-slate-300">"{log.element}"</span>
                                {log.result ? (
                                  <Check className="h-3 w-3 inline ml-2 text-emerald-400" />
                                ) : (
                                  <X className="h-3 w-3 inline ml-2 text-red-400" />
                                )}
                              </div>
                            </>
                          )}
                          {log.type === 'discovery' && (
                            <>
                              <Sparkles className="h-3 w-3 mt-0.5 text-purple-400" />
                              <span>{log.message}</span>
                            </>
                          )}
                          {log.type === 'error' && (
                            <>
                              <AlertCircle className="h-3 w-3 mt-0.5 text-red-400" />
                              <span>{log.message}</span>
                            </>
                          )}
                          {log.type === 'info' && (
                            <span>{log.message}</span>
                          )}
                        </div>
                        {log.stateChange && log.stateChange.length > 0 && log.stateChange[0].type !== 'none' && (
                          <div className="mt-1 text-xs text-slate-400 pl-5">
                            State: {log.stateChange.map((s: any) => s.type).join(', ')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            </div>
            
            {/* Discovered Tests */}
            <div className="flex flex-col bg-slate-800/30 rounded-lg border border-slate-700/50">
              <div className="p-3 border-b border-slate-700/50 flex items-center gap-2">
                <TestTube2 className="h-4 w-4 text-purple-400" />
                <span className="font-medium text-slate-200">Discovered Tests</span>
                <Badge variant="outline" className="ml-auto text-xs bg-purple-500/20 text-purple-300">
                  {discoveredTests.length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-3">
                  {discoveredTests.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <TestTube2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No tests discovered yet</p>
                      <p className="text-xs">Agent will build tests as it explores</p>
                    </div>
                  ) : (
                    discoveredTests.map((test) => (
                      <div
                        key={test.id}
                        className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-purple-200">{test.name}</h4>
                          <Badge 
                            variant="outline" 
                            className={
                              test.priority === 'high' 
                                ? 'bg-red-500/20 text-red-300 border-red-500/50'
                                : test.priority === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
                                  : 'bg-slate-500/20 text-slate-300 border-slate-500/50'
                            }
                          >
                            {test.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{test.description}</p>
                        <div className="mt-2 text-xs text-slate-500">
                          {test.steps?.length || 0} steps • {test.assertions?.length || 0} assertions
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          {/* Stats Footer */}
          {status === 'complete' && (
            <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/30">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Check className="h-4 w-4" />
                  <span>Exploration Complete</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Zap className="h-3 w-3" />
                  <span>{progress.actionCount} actions</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Globe className="h-3 w-3" />
                  <span>{progress.pagesVisited || 1} pages</span>
                </div>
                <div className="flex items-center gap-1 text-purple-400">
                  <TestTube2 className="h-3 w-3" />
                  <span>{discoveredTests.length} tests</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-3 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-600"
            >
              Close
            </Button>
            
            <div className="flex-1" />
            
            {discoveredTests.length > 0 && (
              <Button
                onClick={handleSaveTests}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save {discoveredTests.length} Tests
              </Button>
            )}
            
            {isRunning ? (
              <Button
                onClick={handleStop}
                variant="destructive"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={!config.hasApiKey && !isElectron}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                title={!config.hasApiKey && !isElectron ? "Configure API key in Settings > AI first" : "Start autonomous exploration"}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Exploration
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
