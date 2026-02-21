/**
 * FlowpilotPage - Goal-Based Agentic Testing Interface
 *
 * REAL implementation connected to backend APIs:
 * - Generator/Self-Healer: Uses /api/ai-testing/start (AgenticOrchestrator v2.0)
 *   → Real Playwright browser, real DOM scanning, real LLM instruction parsing
 * - Explorer: Uses /api/blaze/start (BlazeExplorer)
 *   → Real autonomous crawling, defect detection, no AI dependency
 * - Flowmap: Uses /api/exploration/start (AutonomousExplorer)
 *   → Real BFS site crawling, capability mapping, LLM-enhanced analysis
 *
 * All agents stream real results via SSE or polling.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { API_BASE_URL } from '@/lib/api-config';
import {
  Compass,
  Map,
  RefreshCw,
  Sparkles,
  Target,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Brain,
  Eye,
  Wand2,
  Settings,
  Code,
  Camera,
  Bug,
  Shield,
  Zap,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Save,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface TestStep {
  action: string;
  target: string;
  value?: string;
  success: boolean;
  error?: string;
  screenshot?: string;
  method?: string;
  healed?: boolean;
  heal_method?: string;
  confidence?: number;
  selector_used?: string;
  description?: string;
}

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'running';
  steps: TestStep[];
  duration: number;
  screenshot?: string;
}

interface ExplorationDefect {
  type: string;
  severity: string;
  url: string;
  description: string;
  element?: string;
  screenshot?: string;
}

interface ExplorationResult {
  session_id: string;
  status: 'running' | 'completed' | 'error';
  progress: number;
  pages_visited: number;
  defects_found: number;
  defects: ExplorationDefect[];
  current_activity: string;
  duration: number;
}

interface CapabilityPage {
  id: string;
  url: string;
  title: string;
  headings: string[];
  buttons: { text: string; selector: string }[];
  forms: { id: string; fields: any[] }[];
  links: string[];
  entities: string[];
  actions: string[];
}

interface FlowmapResult {
  base_url: string;
  total_pages: number;
  pages: CapabilityPage[];
  llm_analysis?: any;
  total_defects: number;
}

type AgentId = 'flowmap' | 'explorer' | 'self-healer' | 'generator';

interface SSEEvent {
  type: string;
  phase?: string;
  message?: string;
  screenshot?: string;
  result?: TestResult;
  data?: any;
  tests?: number;
  error?: string;
  intent?: any;
}

// ─── Agent Definitions ──────────────────────────────────────────────

const agents = [
  {
    id: 'generator' as AgentId,
    name: 'Generator',
    icon: Sparkles,
    description: 'Test from natural language — real browser automation with AI healing',
    features: ['NLP Input', 'Real Browser', 'Auto-Heal', 'Vision AI'],
    color: 'amber',
    endpoint: 'ai-testing',
  },
  {
    id: 'explorer' as AgentId,
    name: 'Explorer',
    icon: Compass,
    description: 'Autonomous crawling — finds real defects without AI dependency',
    features: ['Auto-Crawl', 'Bug Detection', 'Accessibility', 'Security'],
    color: 'violet',
    endpoint: 'blaze',
  },
  {
    id: 'flowmap' as AgentId,
    name: 'Flowmap',
    icon: Map,
    description: 'Map app capabilities — pages, entities, forms, and user journeys',
    features: ['Site Map', 'Entity Discovery', 'Coverage Gaps', 'LLM Analysis'],
    color: 'fuchsia',
    endpoint: 'exploration',
  },
  {
    id: 'self-healer' as AgentId,
    name: 'Self-Healer',
    icon: RefreshCw,
    description: 'Re-run failed tests with AI-generated selector fixes',
    features: ['Auto-Repair', 'Vision AI', 'Smart Locators', 'Re-run'],
    color: 'emerald',
    endpoint: 'ai-testing',
  },
];

// ─── Color Helpers ──────────────────────────────────────────────────

function getColors(color: string, theme: string) {
  const map: Record<string, any> = {
    fuchsia: {
      bg: theme === 'light' ? 'bg-fuchsia-100' : 'bg-fuchsia-500/20',
      text: theme === 'light' ? 'text-fuchsia-700' : 'text-fuchsia-400',
      border: theme === 'light' ? 'border-fuchsia-300' : 'border-fuchsia-500',
      gradient: 'from-fuchsia-500 to-pink-500',
    },
    violet: {
      bg: theme === 'light' ? 'bg-violet-100' : 'bg-violet-500/20',
      text: theme === 'light' ? 'text-violet-700' : 'text-violet-400',
      border: theme === 'light' ? 'border-violet-300' : 'border-violet-500',
      gradient: 'from-violet-500 to-purple-500',
    },
    emerald: {
      bg: theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-500/20',
      text: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400',
      border: theme === 'light' ? 'border-emerald-300' : 'border-emerald-500',
      gradient: 'from-emerald-500 to-teal-500',
    },
    amber: {
      bg: theme === 'light' ? 'bg-amber-100' : 'bg-amber-500/20',
      text: theme === 'light' ? 'text-amber-700' : 'text-amber-400',
      border: theme === 'light' ? 'border-amber-300' : 'border-amber-500',
      gradient: 'from-amber-500 to-orange-500',
    },
  };
  return map[color] || map.amber;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function FlowpilotPage() {
  const { theme } = useTheme();
  const [selectedAgent, setSelectedAgent] = useState(agents[0]); // Start with Generator
  const [goal, setGoal] = useState('');
  const [targetUrl, setTargetUrl] = useState('');

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Test results (Generator / Self-Healer)
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Exploration results (Explorer)
  const [explorationResult, setExplorationResult] = useState<ExplorationResult | null>(null);

  // Flowmap results
  const [flowmapResult, setFlowmapResult] = useState<FlowmapResult | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const colors = getColors(selectedAgent.color, theme);

  // ─── SSE Stream Reader (Generator / Self-Healer) ───────────────

  const streamSSE = useCallback(async (url: string, body: any) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Server error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch (e) {
            console.error('[Flowpilot] Failed to parse SSE event:', line);
          }
        }
      }
    }
  }, []);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'phase': {
        const msg = event.message || event.phase || '';
        setCurrentPhase(msg);
        const phases = ['understanding', 'preparing', 'exploring', 'planning', 'executing', 'complete'];
        const idx = phases.indexOf(event.phase || '');
        if (idx >= 0) setProgress(Math.round((idx / (phases.length - 1)) * 100));
        break;
      }
      case 'intent':
        if (event.data) {
          setCurrentStep(`Detected: ${event.data.url || 'app'} — ${event.data.actions || 0} actions planned`);
        }
        break;
      case 'step':
        setCurrentStep(event.message || '');
        break;
      case 'screenshot':
        if (event.screenshot) setLiveScreenshot(event.screenshot);
        break;
      case 'test_complete':
        if (event.result) setTestResults(prev => [...prev, event.result!]);
        break;
      case 'plan':
        if (event.tests) setCurrentStep(`Planning ${event.tests} test(s)...`);
        break;
      case 'complete':
        setProgress(100);
        setCurrentPhase('Complete');
        break;
      case 'error':
        setError(event.error || 'Unknown error');
        break;
    }
  }, []);

  // ─── Execute: Generator Agent (SSE) ────────────────────────────

  const executeGenerator = useCallback(async () => {
    // Build instruction string — if URL is provided, include it
    let instruction = goal;
    if (targetUrl.trim()) {
      instruction = `${goal} on ${targetUrl}`;
    }

    setTestResults([]);
    setLiveScreenshot(null);

    await streamSSE(`${API_BASE_URL}/api/ai-testing/start`, { instruction });
  }, [goal, targetUrl, streamSSE]);

  // ─── Execute: Self-Healer Agent (SSE with fix) ─────────────────

  const executeSelfHealer = useCallback(async () => {
    // Self-Healer re-runs with fixes — use the goal as instruction
    let instruction = goal;
    if (targetUrl.trim()) {
      instruction = `${goal} on ${targetUrl}`;
    }

    setTestResults([]);
    setLiveScreenshot(null);

    // If there are previous failed results, include them for enhanced re-run
    const failedTests = testResults.filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
      const failedTest = failedTests[0];
      await streamSSE(`${API_BASE_URL}/api/ai-testing/rerun-with-fix`, {
        original_instruction: instruction,
        failed_test: {
          name: failedTest.name,
          steps: failedTest.steps,
          screenshot: failedTest.screenshot,
        },
      });
    } else {
      // No prior failures — just run normally with extra healing emphasis
      await streamSSE(`${API_BASE_URL}/api/ai-testing/start`, { instruction });
    }
  }, [goal, targetUrl, testResults, streamSSE]);

  // ─── Execute: Explorer Agent (Polling) ─────────────────────────

  const executeExplorer = useCallback(async () => {
    const url = targetUrl.trim() || 'https://example.com';
    setExplorationResult(null);

    const response = await fetch(`${API_BASE_URL}/api/blaze/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        max_pages: 20,
        max_duration_minutes: 5,
        headless: true,
      }),
    });

    if (!response.ok) throw new Error(`Failed to start exploration: ${response.status}`);

    const data = await response.json();
    const sessionId = data.session_id;

    setCurrentPhase('Exploring...');
    setCurrentStep(`Session ${sessionId} started — crawling ${url}`);

    // Poll for status
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/blaze/status/${sessionId}`);
        if (!statusRes.ok) return;
        const status = await statusRes.json();

        setExplorationResult(status);
        setProgress(Math.round((status.progress || 0) * 100));
        setCurrentStep(status.current_activity || `Visited ${status.pages_visited} pages`);

        if (status.status === 'completed' || status.status === 'error') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setCurrentPhase(status.status === 'completed' ? 'Complete' : 'Error');
          setProgress(100);
        }
      } catch {
        // Polling error — ignore, will retry
      }
    }, 2000);
  }, [targetUrl]);

  // ─── Execute: Flowmap Agent (REST) ─────────────────────────────

  const executeFlowmap = useCallback(async () => {
    const url = targetUrl.trim() || 'https://example.com';
    setFlowmapResult(null);
    setCurrentPhase('Mapping application...');
    setCurrentStep(`Crawling ${url} — discovering pages, entities, and actions`);

    const response = await fetch(`${API_BASE_URL}/api/exploration/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: url,
        max_depth: 3,
        max_pages: 30,
        headless: true,
        screenshot: true,
      }),
    });

    if (!response.ok) throw new Error(`Failed to start mapping: ${response.status}`);

    const data = await response.json();
    setFlowmapResult(data);
    setProgress(100);
    setCurrentPhase('Complete');
    setCurrentStep(`Discovered ${data.total_pages || 0} pages`);
  }, [targetUrl]);

  // ─── Main Execute Handler ──────────────────────────────────────

  const handleExecute = useCallback(async () => {
    if (selectedAgent.id !== 'explorer' && selectedAgent.id !== 'flowmap' && !goal.trim()) return;
    if ((selectedAgent.id === 'explorer' || selectedAgent.id === 'flowmap') && !targetUrl.trim()) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentPhase('Starting...');
    setCurrentStep('');

    try {
      switch (selectedAgent.id) {
        case 'generator':
          await executeGenerator();
          break;
        case 'self-healer':
          await executeSelfHealer();
          break;
        case 'explorer':
          await executeExplorer();
          break;
        case 'flowmap':
          await executeFlowmap();
          break;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Execution failed');
        console.error('[Flowpilot] Error:', err);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [selectedAgent, goal, targetUrl, executeGenerator, executeSelfHealer, executeExplorer, executeFlowmap]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsProcessing(false);
    setCurrentPhase('Stopped');
  }, []);

  // ─── Save Test Case ────────────────────────────────────────────

  const saveAsTestCase = useCallback(async (test: TestResult) => {
    try {
      const testCase = {
        title: test.name,
        description: test.description || `Generated by Flowpilot: ${goal}`,
        steps: test.steps.map((s, i) => ({
          step_number: i + 1,
          action: s.action,
          expected_result: s.success ? 'Pass' : `Fail: ${s.error || 'Unknown'}`,
          test_data: s.value || '',
          selector: s.selector_used || s.target,
        })),
        tags: ['flowpilot', 'ai-generated'],
        priority: 'medium',
        status: 'draft',
      };

      const response = await fetch(`${API_BASE_URL}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase),
      });

      if (response.ok) {
        setCurrentStep(`Saved "${test.name}" as test case`);
      }
    } catch (err) {
      console.error('[Flowpilot] Failed to save test case:', err);
    }
  }, [goal]);

  // ─── Determine if execute button is enabled ────────────────────

  const canExecute = (() => {
    if (isProcessing) return false;
    if (selectedAgent.id === 'explorer' || selectedAgent.id === 'flowmap') return !!targetUrl.trim();
    return !!goal.trim();
  })();

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className={cn("min-h-screen p-6", theme === 'light' ? 'bg-gray-50' : 'bg-gray-950')}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={cn("text-2xl font-bold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
              Flowpilot
            </h1>
            <p className={cn("text-sm", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
              AI-powered testing agents — real browser automation, real defect detection
            </p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0">
            <Brain className="w-3 h-3 mr-1" /> Live AI
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Agent Selection */}
        <div className="space-y-3">
          <h3 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
            Select Agent
          </h3>
          {agents.map((agent) => {
            const Icon = agent.icon;
            const c = getColors(agent.color, theme);
            const isSelected = selectedAgent.id === agent.id;

            return (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setError(null); }}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  isSelected
                    ? cn(c.bg, c.border, "border-2")
                    : theme === 'light'
                      ? "bg-white border-gray-200 hover:border-gray-300"
                      : "bg-gray-900 border-gray-800 hover:border-gray-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected ? `bg-gradient-to-r ${c.gradient}` : theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
                  )}>
                    <Icon className={cn("w-5 h-5", isSelected ? "text-white" : theme === 'light' ? 'text-gray-500' : 'text-gray-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-semibold", isSelected ? c.text : theme === 'light' ? 'text-gray-900' : 'text-white')}>
                      {agent.name}
                    </div>
                    <div className={cn("text-xs truncate", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                      {agent.description}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className={cn("w-5 h-5 flex-shrink-0", c.text)} />}
                </div>

                {isSelected && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-current/10">
                    {agent.features.map((f) => (
                      <Badge key={f} className={cn("text-[10px]", c.bg, c.text, "border-0")}>{f}</Badge>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Goal Input */}
          <div className={cn(
            "rounded-xl border p-6",
            theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Target className={cn("w-5 h-5", colors.text)} />
              <h3 className={cn("font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                {selectedAgent.id === 'explorer' || selectedAgent.id === 'flowmap'
                  ? 'Target Application'
                  : 'Define Your Goal'}
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className={cn("text-sm font-medium mb-2 block", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                  Target URL {(selectedAgent.id === 'explorer' || selectedAgent.id === 'flowmap') && <span className="text-red-400">*</span>}
                </label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={cn(theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700")}
                />
              </div>

              {(selectedAgent.id === 'generator' || selectedAgent.id === 'self-healer') && (
                <div>
                  <label className={cn("text-sm font-medium mb-2 block", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                    Test Goal (Natural Language) <span className="text-red-400">*</span>
                  </label>
                  <Textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder={selectedAgent.id === 'self-healer'
                      ? "Describe the test to re-run with AI healing...\nExample: 'Test login with valid credentials'"
                      : "Describe what to test in plain English...\nExample: 'Test login with invalid credentials and verify error message'"
                    }
                    rows={4}
                    className={cn(theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700")}
                  />
                </div>
              )}

              <div className="flex gap-3">
                {isProcessing ? (
                  <Button onClick={handleStop} variant="destructive" className="flex-1">
                    <Square className="w-4 h-4 mr-2" /> Stop
                  </Button>
                ) : (
                  <Button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    className={cn("flex-1", `bg-gradient-to-r ${colors.gradient}`, "hover:opacity-90 text-white")}
                  >
                    <Wand2 className="w-4 h-4 mr-2" /> Execute with {selectedAgent.name}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className={cn(theme === 'light' ? "border-gray-200 hover:bg-gray-100" : "border-gray-700 hover:bg-gray-800")}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Processing Status ──────────────────────────────── */}
          {(isProcessing || currentPhase) && (
            <div className={cn(
              "rounded-xl border p-6",
              theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isProcessing ? "animate-pulse" : "",
                  `bg-gradient-to-r ${colors.gradient}`
                )}>
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={cn("font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                    {isProcessing ? `${selectedAgent.name} is Working...` : currentPhase}
                  </h3>
                  {currentStep && (
                    <p className={cn("text-sm", colors.text)}>{currentStep}</p>
                  )}
                </div>
                {currentPhase === 'Complete' && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                )}
              </div>

              <Progress value={progress} className="h-2" />

              {/* Live Screenshot */}
              {liveScreenshot && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className={cn("w-4 h-4", colors.text)} />
                    <span className={cn("text-xs font-medium", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                      Live View
                    </span>
                  </div>
                  <img
                    src={`data:image/png;base64,${liveScreenshot}`}
                    alt="Live browser screenshot"
                    className="rounded-lg border border-gray-200 dark:border-gray-700 w-full max-h-64 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Error Display ──────────────────────────────────── */}
          {error && (
            <div className={cn(
              "rounded-xl border p-4 flex items-start gap-3",
              theme === 'light' ? "bg-red-50 border-red-200" : "bg-red-500/10 border-red-500/30"
            )}>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-600 dark:text-red-400">Error</h4>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* ── Generator / Self-Healer Results ────────────────── */}
          {testResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Code className={cn("w-5 h-5", colors.text)} />
                <h3 className={cn("font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                  Test Results
                </h3>
                <Badge className={cn(colors.bg, colors.text, "border-0")}>
                  {testResults.length} test{testResults.length > 1 ? 's' : ''}
                </Badge>
                <div className="ml-auto flex gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
                    {testResults.filter(t => t.status === 'passed').length} passed
                  </Badge>
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-0">
                    {testResults.filter(t => t.status === 'failed').length} failed
                  </Badge>
                </div>
              </div>

              {testResults.map((test) => (
                <div
                  key={test.id}
                  className={cn(
                    "rounded-xl border overflow-hidden",
                    theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
                  )}
                >
                  {/* Test Header */}
                  <button
                    onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {test.status === 'passed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : test.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-medium", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                        {test.name}
                      </div>
                      {test.description && (
                        <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                          {test.description}
                        </div>
                      )}
                    </div>
                    <Badge className={cn(
                      "text-xs",
                      test.status === 'passed' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                      test.status === 'failed' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
                      "border-0"
                    )}>
                      {test.status}
                    </Badge>
                    <span className={cn("text-xs", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                      {test.duration > 0 ? `${(test.duration / 1000).toFixed(1)}s` : ''}
                    </span>
                    {expandedTest === test.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Expanded Steps */}
                  {expandedTest === test.id && (
                    <div className={cn("border-t p-4 space-y-2", theme === 'light' ? 'border-gray-100' : 'border-gray-800')}>
                      {test.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          {step.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-800' : 'text-gray-200')}>
                              {step.description || `${step.action} "${step.target}"`}
                            </div>
                            {step.method && (
                              <span className={cn("text-xs", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                                Found via: {step.method}
                                {step.confidence ? ` (${step.confidence}%)` : ''}
                              </span>
                            )}
                            {step.healed && (
                              <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-0">
                                Healed: {step.heal_method}
                              </Badge>
                            )}
                            {step.error && (
                              <div className="text-xs text-red-500 mt-1">{step.error}</div>
                            )}
                          </div>
                          {step.screenshot && (
                            <button
                              onClick={() => setLiveScreenshot(step.screenshot!)}
                              className="text-xs text-blue-500 hover:underline flex-shrink-0"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Test Actions */}
                      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <Button
                          size="sm"
                          onClick={() => saveAsTestCase(test)}
                          className={cn(`bg-gradient-to-r ${colors.gradient}`, "hover:opacity-90 text-white")}
                        >
                          <Save className="w-3 h-3 mr-1" /> Save as Test Case
                        </Button>
                        {test.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAgent(agents.find(a => a.id === 'self-healer')!);
                              setGoal(goal || test.name);
                            }}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Re-run with Healer
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Explorer Results ────────────────────────────────── */}
          {explorationResult && (
            <div className={cn(
              "rounded-xl border p-6",
              theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center gap-2 mb-4">
                <Bug className={cn("w-5 h-5", colors.text)} />
                <h3 className={cn("font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                  Exploration Results
                </h3>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-blue-500">{explorationResult.pages_visited}</div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Pages Visited</div>
                </div>
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-red-500">{explorationResult.defects_found}</div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Defects Found</div>
                </div>
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-emerald-500">{(explorationResult.duration / 1000).toFixed(0)}s</div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Duration</div>
                </div>
              </div>

              {/* Defect List */}
              {explorationResult.defects.length > 0 && (
                <div className="space-y-3">
                  <h4 className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                    Defects Detected
                  </h4>
                  {explorationResult.defects.map((defect, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        defect.severity === 'critical' ? 'border-red-200 dark:border-red-500/30' :
                        defect.severity === 'high' ? 'border-orange-200 dark:border-orange-500/30' :
                        'border-yellow-200 dark:border-yellow-500/30',
                        theme === 'light' ? 'bg-white' : 'bg-gray-800'
                      )}
                    >
                      <Badge className={cn(
                        "text-[10px] flex-shrink-0",
                        defect.severity === 'critical' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                        defect.severity === 'high' ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
                        "border-0"
                      )}>
                        {defect.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-800' : 'text-gray-200')}>
                          {defect.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{defect.type}</Badge>
                          <span className={cn("text-xs truncate", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                            {defect.url}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {explorationResult.defects.length === 0 && explorationResult.status === 'completed' && (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className={cn("font-medium", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                    No Defects Found
                  </h4>
                  <p className={cn("text-sm", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                    The explorer crawled {explorationResult.pages_visited} pages and found no issues.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Flowmap Results ─────────────────────────────────── */}
          {flowmapResult && (
            <div className={cn(
              "rounded-xl border p-6",
              theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center gap-2 mb-4">
                <Globe className={cn("w-5 h-5", colors.text)} />
                <h3 className={cn("font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                  Application Map
                </h3>
                <Badge className={cn(colors.bg, colors.text, "border-0")}>
                  {flowmapResult.total_pages} pages
                </Badge>
              </div>

              {/* Page List */}
              <div className="space-y-3">
                {(flowmapResult.pages || []).slice(0, 20).map((page, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-4 rounded-lg border",
                      theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <span className={cn("font-medium text-sm", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                        {page.title || page.url}
                      </span>
                    </div>
                    <div className={cn("text-xs truncate mb-2", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                      {page.url}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(page.buttons || []).slice(0, 5).map((btn, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {btn.text || 'button'}
                        </Badge>
                      ))}
                      {(page.forms || []).length > 0 && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0">
                          {page.forms.length} form{page.forms.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {(page.entities || []).slice(0, 3).map((entity, i) => (
                        <Badge key={i} className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-0">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* LLM Analysis */}
              {flowmapResult.llm_analysis && (
                <div className={cn(
                  "mt-4 p-4 rounded-lg border",
                  theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-blue-500" />
                    <span className={cn("text-sm font-medium", theme === 'light' ? 'text-blue-700' : 'text-blue-400')}>
                      AI Analysis
                    </span>
                  </div>
                  <pre className={cn(
                    "text-xs whitespace-pre-wrap",
                    theme === 'light' ? 'text-blue-600' : 'text-blue-300'
                  )}>
                    {typeof flowmapResult.llm_analysis === 'string'
                      ? flowmapResult.llm_analysis
                      : JSON.stringify(flowmapResult.llm_analysis, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
