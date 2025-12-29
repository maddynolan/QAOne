/**
 * Flowstral Test Studio - Embedded Interactive Browser
 * 
 * Click on preview to interact, type in modal for text input
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Square, 
  Circle,
  RefreshCw, 
  Download, 
  Copy, 
  Monitor,
  MousePointer2,
  Type,
  Navigation,
  CheckSquare,
  Code,
  Zap,
  Trash2,
  ChevronRight,
  Crosshair,
  Layers,
  CheckCircle2,
  AlertCircle,
  Globe,
  X,
  Send,
  Keyboard,
  Target
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface RecordedAction {
  id: string;
  type: string;
  timestamp: number;
  url: string;
  description?: string;
  selectors: Array<{
    strategy: string;
    value: string;
    confidence: number;
    playwright?: string;
  }>;
  text?: string;
  value?: string;
}

interface Session {
  session_id: string;
  start_url: string;
  status: string;
  action_count: number;
  current_url: string;
  app_type?: string;
}

interface SuggestedAction {
  type: string;
  name: string;
  selectors: Array<{
    strategy: string;
    value: string;
    confidence: number;
  }>;
  elementType: string;
}

interface PageAnalysis {
  url: string;
  title: string;
  appType: string;
  suggestedActions: SuggestedAction[];
}

export default function CDPRecorder() {
  const [session, setSession] = useState<Session | null>(null);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [startUrl, setStartUrl] = useState('https://login.salesforce.com');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [testName, setTestName] = useState('recorded_test');
  const [activePanel, setActivePanel] = useState<'steps' | 'suggest' | 'code'>('steps');
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Interactive mode state
  const [isInteractive, setIsInteractive] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [lastClickPos, setLastClickPos] = useState<{x: number, y: number} | null>(null);
  const [isClicking, setIsClicking] = useState(false);
  const [clickFeedback, setClickFeedback] = useState<{x: number, y: number} | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);

  // Recording timer
  useEffect(() => {
    if (session?.status === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Recording
  const startRecording = async () => {
    setIsLoading(true);
    setError(null);
    setActions([]);
    setGeneratedCode('');
    setRecordingTime(0);
    setScreenshot(null);
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_url: startUrl,
          use_persistent_context: true,
          headless: true,  // Run headless for embedded experience
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start recording');
      }
      
      const sessionData = await response.json();
      setSession(sessionData);
      startPolling(sessionData.session_id);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    if (!session) return;
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/stop/${session.session_id}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.actions) setActions(result.actions);
      }
      
      setSession(prev => prev ? { ...prev, status: 'stopped' } : null);
      stopPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Polling for updates - gets actions and screenshot in single request
  const startPolling = (sessionId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const actionsRes = await fetch(`${API_BASE}/cdp-recorder/session/${sessionId}/actions`);
        if (actionsRes.ok) {
          const data = await actionsRes.json();
          setActions(data.actions || []);
          
          // Update session with ALL fields from response including status
          setSession(prev => prev ? {
            ...prev,
            status: data.status || prev.status,  // Update status!
            current_url: data.url || prev.current_url,
            app_type: data.app_type || prev.app_type,
          } : null);
          
          // Screenshot is included in actions response for efficiency
          if (data.screenshot) {
            setScreenshot(`data:image/jpeg;base64,${data.screenshot}`);
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 2000);  // Poll every 2 seconds to reduce flickering
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Handle click on preview
  const handlePreviewClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!session || !isInteractive || isClicking) return;
    
    const img = imageRef.current;
    if (!img) return;
    
    // Get click position relative to image
    const rect = img.getBoundingClientRect();
    const scaleX = 1280 / rect.width;  // Browser viewport width
    const scaleY = 720 / rect.height;  // Browser viewport height
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    // Show click feedback
    setClickFeedback({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setClickFeedback(null), 300);
    
    setIsClicking(true);
    setLastClickPos({ x, y });
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/session/${session.session_id}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
      
      if (!response.ok) {
        console.error('Click failed');
      }
    } catch (err) {
      console.error('Click error:', err);
    } finally {
      setIsClicking(false);
    }
  }, [session, isInteractive, isClicking]);

  // Handle type submission
  const handleTypeSubmit = async () => {
    if (!session || !typeText.trim()) return;
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/session/${session.session_id}/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: typeText }),
      });
      
      if (response.ok) {
        setShowTypeModal(false);
        setTypeText('');
      }
    } catch (err) {
      console.error('Type error:', err);
    }
  };

  // Handle key press in type modal
  const handleTypeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTypeSubmit();
    } else if (e.key === 'Escape') {
      setShowTypeModal(false);
      setTypeText('');
    }
  };

  // Press Enter key
  const handlePressEnter = async () => {
    if (!session) return;
    
    try {
      await fetch(`${API_BASE}/cdp-recorder/session/${session.session_id}/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'Enter' }),
      });
    } catch (err) {
      console.error('Key press error:', err);
    }
  };

  // Manual screenshot capture (no flicker - only on demand)
  const captureScreenshot = async () => {
    if (!session) return;
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/session/${session.session_id}/screenshot`);
      if (response.ok) {
        const data = await response.json();
        if (data.screenshot) {
          setScreenshot(`data:image/jpeg;base64,${data.screenshot}`);
        }
      }
    } catch (err) {
      console.error('Screenshot capture error:', err);
    }
  };

  // Analyze Page
  const analyzePage = async () => {
    if (!session) return;
    setIsAnalyzing(true);
    
    try {
      const response = await fetch(`${API_BASE}/cdp-recorder/session/${session.session_id}/analyze`);
      if (response.ok) {
        const analysis = await response.json();
        setPageAnalysis(analysis);
        setActivePanel('suggest');
      }
    } catch (err) {
      setError('Failed to analyze page');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add suggested action
  const addSuggestedAction = (action: SuggestedAction) => {
    const newAction: RecordedAction = {
      id: `suggested_${Date.now()}`,
      type: action.type,
      timestamp: Date.now(),
      url: pageAnalysis?.url || '',
      description: action.name,
      selectors: action.selectors.map(s => ({
        strategy: s.strategy,
        value: s.value,
        confidence: s.confidence,
        playwright: `locator('${s.value}')`
      })),
      text: action.name,
    };
    setActions(prev => [...prev, newAction]);
    setActivePanel('steps');
  };

  // Generate Test
  const generateTest = async () => {
    if (actions.length === 0) {
      setError('No actions to generate test from');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const formattedActions = actions.map(a => ({
        type: a.type,
        description: a.description || a.text || `${a.type} action`,
        selectors: a.selectors?.map(s => s.value) || [],
        value: a.value,
        url: a.url
      }));
      
      const response = await fetch(`${API_BASE}/cdp-recorder/generate-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.session_id,
          test_name: testName,
          language: 'python',
          actions: formattedActions,
          start_url: actions[0]?.url || startUrl,
        }),
      });
      
      const result = await response.json();
      if (result.test_code) {
        setGeneratedCode(result.test_code);
        setActivePanel('code');
      }
    } catch (err) {
      setError('Failed to generate test');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => navigator.clipboard.writeText(generatedCode);
  
  const downloadCode = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${testName}.py`;
    a.click();
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'click': return <MousePointer2 className="w-3.5 h-3.5" />;
      case 'fill': case 'input': return <Type className="w-3.5 h-3.5" />;
      case 'navigate': return <Navigation className="w-3.5 h-3.5" />;
      case 'select': case 'check': return <CheckSquare className="w-3.5 h-3.5" />;
      default: return <Circle className="w-3.5 h-3.5" />;
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Focus type input when modal opens
  useEffect(() => {
    if (showTypeModal && typeInputRef.current) {
      typeInputRef.current.focus();
    }
  }, [showTypeModal]);

  const isRecording = session?.status === 'recording';

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-gradient-to-r from-[#0f0f1a] to-[#1a1a2e] border-b border-cyan-900/30 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Flowstral
          </span>
          <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400">
            Test Studio
          </Badge>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="Enter URL to test..."
              disabled={isRecording}
              className="pl-10 bg-[#1a1a2e] border-cyan-900/50 text-white placeholder:text-gray-500 focus:border-cyan-500 h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              disabled={isLoading || !startUrl}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 gap-2 h-9"
            >
              <Circle className="w-4 h-4 fill-current" />
              Start Recording
            </Button>
          ) : (
            <Button onClick={stopRecording} disabled={isLoading} variant="destructive" className="gap-2 h-9">
              <Square className="w-4 h-4 fill-current" />
              Stop
            </Button>
          )}
          
          <Button
            onClick={generateTest}
            disabled={actions.length === 0 || isLoading}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 gap-2 h-9"
          >
            <Code className="w-4 h-4" />
            Generate
          </Button>
        </div>

        {isRecording && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-red-500/20 rounded-full border border-red-500/30">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium">REC</span>
            <span className="text-gray-400 text-sm font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser Panel */}
        <div className="flex-1 flex flex-col bg-[#0d0d12] border-r border-cyan-900/30">
          {/* Browser toolbar */}
          <div className="h-10 bg-[#0f0f1a] border-b border-cyan-900/30 flex items-center px-3 gap-3">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-300 truncate flex-1">
              {session?.current_url || 'No page loaded'}
            </span>
            {session?.app_type && session.app_type !== 'generic' && (
              <Badge className="bg-blue-500/20 text-blue-400 text-xs border-blue-500/30">
                {session.app_type}
              </Badge>
            )}
            {isRecording && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTypeModal(true)}
                  className="h-7 px-2 text-xs bg-cyan-900/30 hover:bg-cyan-800/50"
                  title="Type text"
                >
                  <Keyboard className="w-3.5 h-3.5 mr-1" />
                  Type
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePressEnter}
                  className="h-7 px-2 text-xs bg-cyan-900/30 hover:bg-cyan-800/50"
                  title="Press Enter"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Enter
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={captureScreenshot}
                  className="h-7 px-2 text-xs bg-green-900/30 hover:bg-green-800/50"
                  title="Capture current screenshot"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* Browser viewport */}
          <div 
            ref={previewRef}
            className="flex-1 relative bg-[#0a0a0f] flex items-center justify-center p-2 overflow-hidden"
          >
            {screenshot ? (
              <div 
                className={`relative w-full h-full flex items-center justify-center ${isInteractive && isRecording ? 'cursor-crosshair' : ''}`}
                onClick={isRecording ? handlePreviewClick : undefined}
              >
                <img 
                  ref={imageRef}
                  src={screenshot} 
                  alt="Browser"
                  className="max-w-full max-h-full object-contain rounded border border-cyan-900/50 shadow-2xl"
                  draggable={false}
                />
                
                {/* Click feedback ripple */}
                {clickFeedback && (
                  <div 
                    className="absolute pointer-events-none"
                    style={{ 
                      left: clickFeedback.x - 15, 
                      top: clickFeedback.y - 15,
                    }}
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-400 animate-ping" />
                    <div className="absolute inset-0 w-8 h-8 rounded-full bg-cyan-400/30" />
                  </div>
                )}
                
                {/* Live indicator */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur rounded text-xs flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400">Live</span>
                </div>
                
                {/* Interactive mode indicator */}
                {isRecording && isInteractive && (
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-cyan-500/20 backdrop-blur rounded text-xs flex items-center gap-1.5 border border-cyan-500/30">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span className="text-cyan-300">Click to interact</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Monitor className="w-20 h-20 mx-auto mb-6 text-cyan-900/50" />
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Flowstral Test Studio
                </h2>
                <p className="text-gray-500 mb-6">Enter a URL and click Start Recording</p>
                <div className="max-w-md mx-auto space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 bg-[#1a1a2e]/50 rounded-lg border border-cyan-900/30">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <Circle className="w-4 h-4 text-red-400 fill-current" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">1. Start Recording</p>
                      <p className="text-xs text-gray-500">Browser loads in this panel</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-[#1a1a2e]/50 rounded-lg border border-cyan-900/30">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <MousePointer2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">2. Click & Type</p>
                      <p className="text-xs text-gray-500">Click on elements, use Type button for text</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-[#1a1a2e]/50 rounded-lg border border-cyan-900/30">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Code className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">3. Generate Test</p>
                      <p className="text-xs text-gray-500">Get Playwright code instantly</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[380px] flex flex-col bg-[#0f0f1a]">
          <div className="h-10 bg-[#0a0a0f] border-b border-cyan-900/30 flex">
            {['steps', 'suggest', 'code'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActivePanel(tab as any);
                  if (tab === 'suggest' && session) analyzePage();
                }}
                className={`flex-1 flex items-center justify-center gap-2 text-sm transition-colors ${
                  activePanel === tab 
                    ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-900/10' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'steps' && <Layers className="w-4 h-4" />}
                {tab === 'suggest' && <Zap className="w-4 h-4" />}
                {tab === 'code' && <Code className="w-4 h-4" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'steps' && actions.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-cyan-500/30 rounded text-xs">{actions.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Steps Panel */}
            {activePanel === 'steps' && (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-cyan-900/30 flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Recorded Steps</span>
                  {actions.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setActions([])} className="h-6 px-2 text-xs text-gray-400 hover:text-red-400">
                      <Trash2 className="w-3 h-3 mr-1" />Clear
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {actions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MousePointer2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No steps yet</p>
                      <p className="text-xs mt-1">Click on the browser to interact</p>
                    </div>
                  ) : (
                    actions.map((action, i) => (
                      <div key={action.id || i} className="group flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-[#1a1a2e] border border-transparent hover:border-cyan-900/50">
                        <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                        <div className={`p-1.5 rounded ${
                          action.type === 'click' ? 'bg-cyan-500/20 text-cyan-400' :
                          action.type === 'fill' ? 'bg-blue-500/20 text-blue-400' :
                          action.type === 'navigate' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {getActionIcon(action.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{action.description || action.text || action.type}</p>
                          {action.value && <p className="text-xs text-gray-500 truncate">"{action.value.slice(0, 25)}"</p>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setActions(prev => prev.filter((_, idx) => idx !== i))} className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Suggest Panel */}
            {activePanel === 'suggest' && (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-cyan-900/30 flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase">AI Suggestions</span>
                  <Button variant="ghost" size="sm" onClick={analyzePage} disabled={!session || isAnalyzing} className="h-6 px-2 text-xs">
                    <RefreshCw className={`w-3 h-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />Analyze
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {!session ? (
                    <div className="text-center py-12 text-gray-500">
                      <Zap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Start recording first</p>
                    </div>
                  ) : !pageAnalysis?.suggestedActions?.length ? (
                    <div className="text-center py-12 text-gray-500">
                      <Crosshair className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Click Analyze to find elements</p>
                    </div>
                  ) : (
                    pageAnalysis.suggestedActions.map((action, i) => (
                      <button key={i} onClick={() => addSuggestedAction(action)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-[#1a1a2e] border border-transparent hover:border-cyan-500/50 text-left group">
                        <div className={`p-1.5 rounded ${action.type === 'click' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {getActionIcon(action.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{action.name}</p>
                          <p className="text-xs text-gray-500 truncate">{action.selectors[0]?.value}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Code Panel */}
            {activePanel === 'code' && (
              <div className="h-full flex flex-col">
                <div className="px-3 py-2 border-b border-cyan-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 uppercase">Code</span>
                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">Python</Badge>
                  </div>
                  {generatedCode && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={copyCode} className="h-6 px-2 text-xs"><Copy className="w-3 h-3 mr-1" />Copy</Button>
                      <Button variant="ghost" size="sm" onClick={downloadCode} className="h-6 px-2 text-xs"><Download className="w-3 h-3 mr-1" />Save</Button>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 border-b border-cyan-900/30">
                  <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Test name..." className="h-8 text-sm bg-[#1a1a2e] border-cyan-900/50" />
                </div>
                <div className="flex-1 overflow-auto p-3 bg-[#0a0a0f]">
                  {generatedCode ? (
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{generatedCode}</pre>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Code className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Record actions then Generate</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-xl border border-cyan-900/50 shadow-2xl w-[400px] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-cyan-400" />
                Type Text
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowTypeModal(false)} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Type your text below and press Enter or click Send
            </p>
            <div className="flex gap-2">
              <Input
                ref={typeInputRef}
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                onKeyDown={handleTypeKeyDown}
                placeholder="Enter text..."
                className="flex-1 bg-[#0a0a0f] border-cyan-900/50"
                autoFocus
              />
              <Button onClick={handleTypeSubmit} className="bg-cyan-500 hover:bg-cyan-600">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send, Escape to cancel
            </p>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-7 bg-[#0a0a0f] border-t border-cyan-900/30 flex items-center px-4 text-xs">
        <div className="flex items-center gap-4 flex-1">
          {session ? (
            <>
              <div className="flex items-center gap-1.5">
                {isRecording ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-gray-400">{isRecording ? 'Recording' : 'Stopped'}</span>
              </div>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">{actions.length} actions</span>
              {session.app_type && session.app_type !== 'generic' && (
                <>
                  <span className="text-gray-600">|</span>
                  <span className="text-blue-400">{session.app_type}</span>
                </>
              )}
            </>
          ) : (
            <span className="text-gray-500">Ready</span>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-red-400 mr-4">
            <AlertCircle className="w-3.5 h-3.5" />{error}
          </div>
        )}
        <span className="text-gray-600">Flowstral v1.0</span>
      </div>
    </div>
  );
}
