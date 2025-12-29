/**
 * Blaze - Autonomous Testing Engine
 * AI-powered automatic testing that discovers defects on any website
 * Works with or without OpenAI - fallback to intelligent heuristic testing
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Zap, Play, Pause, Square, Loader2, AlertTriangle, CheckCircle, 
  XCircle, Activity, Target, Bug, Clock, Download, RefreshCw,
  Settings, Globe, Shield, Eye, FileText, BarChart3, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';

interface Defect {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  pageUrl: string;
  screenshot?: string;
  reproducible: boolean;
  timestamp: string;
}

interface BlazeSession {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startUrl: string;
  pagesVisited: number;
  actionsPerformed: number;
  defectsFound: Defect[];
  coverage: Record<string, number>;
  startTime?: string;
  duration: number;
  currentActivity: string;
  progress: number;
}

export default function Blaze() {
  const [session, setSession] = useState<BlazeSession>({
    id: '',
    status: 'idle',
    startUrl: '',
    pagesVisited: 0,
    actionsPerformed: 0,
    defectsFound: [],
    coverage: {},
    duration: 0,
    currentActivity: '',
    progress: 0,
  });

  const [targetUrl, setTargetUrl] = useState('');
  const [maxDuration, setMaxDuration] = useState(10);
  const [maxPages, setMaxPages] = useState(20);
  const [testTypes, setTestTypes] = useState({
    functional: true,
    accessibility: true,
    performance: false,
    security: false,
  });
  const [headless, setHeadless] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('run');
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check backend availability
  useEffect(() => {
    checkBackendStatus();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/nexus/health`);
      setBackendAvailable(response.ok);
    } catch {
      setBackendAvailable(false);
    }
  };

  const startBlaze = async () => {
    if (!targetUrl.trim()) {
      toast.error('Please enter a URL to test');
      return;
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    // Reset session state
    setSession({
      id: '',
      status: 'running',
      startUrl: targetUrl,
      pagesVisited: 0,
      actionsPerformed: 0,
      defectsFound: [],
      coverage: {},
      duration: 0,
      currentActivity: 'Starting exploration...',
      progress: 0,
      startTime: new Date().toISOString(),
    });

    try {
      // Add https:// if missing
      let validatedUrl = targetUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        validatedUrl = `https://${targetUrl}`;
      }

      // Use the real Blaze API (no OpenAI dependency!)
      const response = await fetch(`${API_BASE_URL}/api/nexus/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_url: validatedUrl,
          max_pages: maxPages,
          max_duration_minutes: maxDuration,
          headless: headless,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setSession(prev => ({
          ...prev,
          id: data.session_id,
          status: 'running',
          currentActivity: 'Exploration started...',
        }));
        toast.success('Blaze exploration started!');
        startPolling(data.session_id);
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to start session');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('Blaze failed:', error);
      toast.error(`Failed to start: ${error.message}`);
      setSession(prev => ({ ...prev, status: 'error', currentActivity: error.message }));
    } finally {
      setIsLoading(false);
    }
  };


  const startPolling = (sessionId: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/nexus/status/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          
          const defects = (data.defects || []).map((d: any) => ({
            id: d.id || `defect-${Math.random()}`,
            type: d.type || 'functional',
            severity: d.severity || 'medium',
            title: d.title,
            description: d.description,
            pageUrl: d.page_url || '',
            reproducible: d.reproducible ?? true,
            timestamp: d.timestamp || new Date().toISOString(),
          }));

          const pagesVisited = data.progress?.pages_crawled || 0;
          const progressPct = data.progress?.progress_percentage || 0;

          setSession(prev => ({
            ...prev,
            status: data.status === 'completed' ? 'completed' : data.status,
            pagesVisited: pagesVisited,
            defectsFound: defects,
            coverage: data.risk_heatmap || {},
            duration: data.time_elapsed_seconds || 0,
            progress: progressPct,
            currentActivity: data.current_activity || prev.currentActivity,
          }));

          if (data.status === 'completed' || data.status === 'error' || data.status === 'stopped') {
            clearInterval(intervalRef.current!);
            if (data.status === 'completed') {
              toast.success(`Blaze completed! Found ${defects.length} defects across ${pagesVisited} pages.`);
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  };

  const stopBlaze = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (session.id) {
      try {
        await fetch(`${API_BASE_URL}/api/nexus/stop/${session.id}`, { method: 'POST' });
      } catch (e) {
        console.warn('Failed to stop session:', e);
      }
    }

    setSession(prev => ({ ...prev, status: 'paused', currentActivity: 'Stopped by user' }));
    toast.info('Testing stopped');
  };

  const resetSession = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSession({
      id: '',
      status: 'idle',
      startUrl: '',
      pagesVisited: 0,
      actionsPerformed: 0,
      defectsFound: [],
      coverage: {},
      duration: 0,
      currentActivity: '',
      progress: 0,
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            Blaze - Autonomous Testing
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered automatic testing that discovers defects with zero human input
          </p>
        </div>
        <div className="flex items-center gap-2">
          {backendAvailable === false && (
            <Badge variant="outline" className="text-red-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Backend Offline
            </Badge>
          )}
          {backendAvailable === true && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
          {backendAvailable === null && (
            <Badge variant="outline">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking...
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="run">
            <Play className="h-4 w-4 mr-2" />
            Run Tests
          </TabsTrigger>
          <TabsTrigger value="defects" disabled={session.defectsFound.length === 0}>
            <Bug className="h-4 w-4 mr-2" />
            Defects ({session.defectsFound.length})
          </TabsTrigger>
          <TabsTrigger value="coverage">
            <BarChart3 className="h-4 w-4 mr-2" />
            Coverage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="space-y-4">
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>
                Enter a URL and Blaze will autonomously explore, test, and find defects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={session.status === 'running'}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(parseInt(e.target.value) || 10)}
                    disabled={session.status === 'running'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Pages</Label>
                  <Input
                    type="number"
                    min={5}
                    max={100}
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 20)}
                    disabled={session.status === 'running'}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Test Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="functional"
                      checked={testTypes.functional}
                      onCheckedChange={(c) => setTestTypes({ ...testTypes, functional: !!c })}
                      disabled={session.status === 'running'}
                    />
                    <Label htmlFor="functional" className="cursor-pointer">Functional Testing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility"
                      checked={testTypes.accessibility}
                      onCheckedChange={(c) => setTestTypes({ ...testTypes, accessibility: !!c })}
                      disabled={session.status === 'running'}
                    />
                    <Label htmlFor="accessibility" className="cursor-pointer">Accessibility (WCAG)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="performance"
                      checked={testTypes.performance}
                      onCheckedChange={(c) => setTestTypes({ ...testTypes, performance: !!c })}
                      disabled={session.status === 'running'}
                    />
                    <Label htmlFor="performance" className="cursor-pointer">Performance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="security"
                      checked={testTypes.security}
                      onCheckedChange={(c) => setTestTypes({ ...testTypes, security: !!c })}
                      disabled={session.status === 'running'}
                    />
                    <Label htmlFor="security" className="cursor-pointer">Security Scan</Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="headless"
                  checked={headless}
                  onCheckedChange={setHeadless}
                  disabled={session.status === 'running'}
                />
                <Label htmlFor="headless" className="cursor-pointer">
                  Headless Mode (faster, no browser window)
                </Label>
              </div>

              <div className="flex gap-2">
                {session.status === 'idle' || session.status === 'completed' || session.status === 'error' ? (
                  <Button
                    onClick={startBlaze}
                    disabled={isLoading || !targetUrl.trim()}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Start Blaze
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={stopBlaze}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop Testing
                  </Button>
                )}
                
                {(session.status === 'completed' || session.status === 'paused' || session.status === 'error') && (
                  <Button variant="outline" onClick={resetSession}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Status */}
          {session.status !== 'idle' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="text-2xl font-bold capitalize">{session.status}</p>
                      </div>
                      {session.status === 'running' ? (
                        <Activity className="h-8 w-8 text-yellow-500 animate-pulse" />
                      ) : session.status === 'completed' ? (
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      ) : session.status === 'error' ? (
                        <XCircle className="h-8 w-8 text-red-500" />
                      ) : (
                        <Pause className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Defects Found</p>
                        <p className="text-2xl font-bold text-red-600">{session.defectsFound.length}</p>
                      </div>
                      <Bug className="h-8 w-8 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pages Visited</p>
                        <p className="text-2xl font-bold">{session.pagesVisited}</p>
                      </div>
                      <Globe className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="text-2xl font-bold">{formatDuration(session.duration)}</p>
                      </div>
                      <Clock className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress */}
              {session.status === 'running' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Testing Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{session.currentActivity || 'Processing...'}</span>
                        <span>{Math.round(session.progress)}%</span>
                      </div>
                      <Progress value={session.progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How Blaze Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-2">
                    <Globe className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Crawl & Map</p>
                  <p className="text-xs text-muted-foreground">Discovers all pages and capabilities</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Analyze Risk</p>
                  <p className="text-xs text-muted-foreground">Identifies high-risk areas to test</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
                    <Zap className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Execute Tests</p>
                  <p className="text-xs text-muted-foreground">Runs intelligent test scenarios</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
                    <Bug className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Report Defects</p>
                  <p className="text-xs text-muted-foreground">Documents issues with evidence</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Detected Defects ({session.defectsFound.length})</CardTitle>
                  <CardDescription>
                    Real issues found during exploratory testing
                  </CardDescription>
                </div>
                {session.defectsFound.length > 0 && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant="destructive">
                      {session.defectsFound.filter(d => d.severity === 'critical').length} Critical
                    </Badge>
                    <Badge className="bg-orange-500">
                      {session.defectsFound.filter(d => d.severity === 'high').length} High
                    </Badge>
                    <Badge className="bg-yellow-500 text-black">
                      {session.defectsFound.filter(d => d.severity === 'medium').length} Medium
                    </Badge>
                    <Badge variant="secondary">
                      {session.defectsFound.filter(d => d.severity === 'low').length} Low
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {session.defectsFound.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No defects found yet. Run Blaze to start exploratory testing.
                </p>
              ) : (
                <div className="space-y-4">
                  {session.defectsFound.map((defect: any, idx) => (
                    <Card key={defect.id || idx} className="border-l-4" style={{
                      borderLeftColor: defect.severity === 'critical' ? '#dc2626' : 
                                       defect.severity === 'high' ? '#ea580c' :
                                       defect.severity === 'medium' ? '#eab308' : '#3b82f6'
                    }}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-mono">{defect.id}</span>
                              <h4 className="font-semibold">{defect.title}</h4>
                              <Badge className={getSeverityColor(defect.severity)}>
                                {defect.severity}
                              </Badge>
                              <Badge variant="outline">{defect.type?.replace('_', ' ')}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {defect.description}
                            </p>
                            {defect.element && (
                              <p className="text-xs font-mono bg-gray-100 p-2 rounded mb-2 overflow-x-auto">
                                {defect.element}
                              </p>
                            )}
                            {defect.pageUrl && (
                              <a 
                                href={defect.pageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline block truncate"
                              >
                                📄 {defect.pageUrl}
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Coverage Map</CardTitle>
              <CardDescription>
                Risk assessment for each capability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(session.coverage).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No coverage data yet. Run Blaze to generate coverage map.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(session.coverage).map(([capability, risk]) => (
                    <div
                      key={capability}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <span className="font-medium">{capability}</span>
                      <Badge className={getSeverityColor(String(risk))}>{String(risk)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

