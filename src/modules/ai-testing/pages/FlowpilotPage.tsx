/**
 * FlowpilotPage - Goal-Based Agentic Testing Interface
 *
 * REAL implementation connected to backend APIs:
 * - Generator/Self-Healer: Uses /api/ai-testing/start (AgenticOrchestrator v2.0)
 *   -> Real Playwright browser, real DOM scanning, real LLM instruction parsing
 * - Explorer: Uses /api/blaze/start-stream (BlazeExplorer v2.0)
 *   -> SSE streaming, concurrent crawling, auth support, axe-core, defect screenshots
 * - Flowmap: Uses /api/exploration/start (AutonomousExplorer)
 *   -> Real BFS site crawling, capability mapping, LLM-enhanced analysis
 *
 * All agents stream real results via SSE or polling.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAI } from '@/contexts/AIContext';
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
  Lock,
  Layers,
  Clock,
  FileText,
  Download,
} from 'lucide-react';

// ---- Types ----

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
  id?: string;
  type: string;
  severity: string;
  title?: string;
  description: string;
  page_url?: string;
  url?: string;
  element?: string;
  screenshot?: string;
  wcag_criterion?: string;
  evidence?: Record<string, any>;
}

interface ExplorationResult {
  session_id: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  progress: number;
  pages_visited: number;
  defects_found: number;
  defects: ExplorationDefect[];
  current_activity: string;
  duration: number;
  pages_queued?: number;
  summary?: Record<string, any>;
  generated_tests?: GeneratedTestSuite | null;
}

interface GeneratedTestSuite {
  test_count: number;
  tests: Array<{
    title: string;
    description: string;
    steps: any[];
    tags: string[];
    priority: string;
  }>;
  summary: {
    smoke_tests: number;
    form_tests: number;
    regression_tests: number;
  };
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

interface ExplorerConfig {
  authType: 'none' | 'cookie' | 'bearer' | 'basic' | 'form_login';
  bearerToken: string;
  cookieJson: string;
  basicUsername: string;
  basicPassword: string;
  loginUrl: string;
  loginUsername: string;
  loginPassword: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
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

// ---- Agent Definitions ----

const agents = [
  {
    id: 'generator' as AgentId,
    name: 'Generator',
    icon: Sparkles,
    description: 'Test from natural language -- real browser automation with AI healing',
    features: ['NLP Input', 'Real Browser', 'Auto-Heal', 'Vision AI'],
    color: 'amber',
    endpoint: 'ai-testing',
  },
  {
    id: 'explorer' as AgentId,
    name: 'Explorer',
    icon: Compass,
    description: 'Autonomous crawling -- finds real defects with axe-core and heuristics',
    features: ['Concurrent Crawl', 'axe-core A11y', 'Auth Support', 'Test Generation'],
    color: 'violet',
    endpoint: 'blaze',
  },
  {
    id: 'flowmap' as AgentId,
    name: 'Flowmap',
    icon: Map,
    description: 'Map app capabilities -- pages, entities, forms, and user journeys',
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

// ---- Color Helpers ----

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

// ---- Main Component ----

export default function FlowpilotPage() {
  const { theme } = useTheme();
  const { config: aiConfig } = useAI();
  const aiAvailable = aiConfig.enabled && aiConfig.hasApiKey;
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
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
  const [showExplorerConfig, setShowExplorerConfig] = useState(false);
  const [explorerSessionId, setExplorerSessionId] = useState<string | null>(null);
  const [explorerConfig, setExplorerConfig] = useState<ExplorerConfig>({
    authType: 'none',
    bearerToken: '',
    cookieJson: '',
    basicUsername: '',
    basicPassword: '',
    loginUrl: '',
    loginUsername: '',
    loginPassword: '',
    usernameSelector: '#username',
    passwordSelector: '#password',
    submitSelector: "button[type='submit']",
    maxPages: 50,
    maxDepth: 5,
    concurrency: 3,
  });

  // Flowmap results
  const [flowmapResult, setFlowmapResult] = useState<FlowmapResult | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const colors = getColors(selectedAgent.color, theme);

  // ---- SSE Stream Reader (Generator / Self-Healer) ----

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
          setCurrentStep(`Detected: ${event.data.url || 'app'} -- ${event.data.actions || 0} actions planned`);
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

  // ---- Execute: Generator Agent (SSE) ----

  const executeGenerator = useCallback(async () => {
    let instruction = goal;
    if (targetUrl.trim()) {
      instruction = `${goal} on ${targetUrl}`;
    }
    setTestResults([]);
    setLiveScreenshot(null);
    await streamSSE(`${API_BASE_URL}/api/ai-testing/start`, { instruction });
  }, [goal, targetUrl, streamSSE]);

  // ---- Execute: Self-Healer Agent (SSE with fix) ----

  const executeSelfHealer = useCallback(async () => {
    let instruction = goal;
    if (targetUrl.trim()) {
      instruction = `${goal} on ${targetUrl}`;
    }
    setTestResults([]);
    setLiveScreenshot(null);

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
      await streamSSE(`${API_BASE_URL}/api/ai-testing/start`, { instruction });
    }
  }, [goal, targetUrl, testResults, streamSSE]);

  // ---- Execute: Explorer Agent (SSE Streaming) ----

  const executeExplorer = useCallback(async () => {
    const url = targetUrl.trim() || 'https://example.com';
    setExplorationResult(null);
    setExplorerSessionId(null);

    // Build auth config
    let auth: any = undefined;
    if (explorerConfig.authType !== 'none') {
      auth = { type: explorerConfig.authType };
      if (explorerConfig.authType === 'bearer') {
        auth.token = explorerConfig.bearerToken;
      } else if (explorerConfig.authType === 'cookie') {
        auth.cookies = explorerConfig.cookieJson;
      } else if (explorerConfig.authType === 'basic') {
        auth.username = explorerConfig.basicUsername;
        auth.password = explorerConfig.basicPassword;
      } else if (explorerConfig.authType === 'form_login') {
        auth.login_url = explorerConfig.loginUrl;
        auth.username = explorerConfig.loginUsername;
        auth.password = explorerConfig.loginPassword;
        auth.username_selector = explorerConfig.usernameSelector;
        auth.password_selector = explorerConfig.passwordSelector;
        auth.submit_selector = explorerConfig.submitSelector;
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch(`${API_BASE_URL}/api/blaze/start-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        max_pages: explorerConfig.maxPages,
        max_depth: explorerConfig.maxDepth,
        concurrency: explorerConfig.concurrency,
        delay_ms: 200,
        headless: true,
        auth,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Failed to start exploration: ${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';
    const collectedDefects: ExplorationDefect[] = [];
    let pagesVisited = 0;
    let pagesQueued = 0;
    let sessionId = '';

    setCurrentPhase('Exploring...');
    setCurrentStep(`Crawling ${url} with ${explorerConfig.concurrency} concurrent browser(s)`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          switch (event.type) {
            case 'session':
              sessionId = event.session_id;
              setExplorerSessionId(sessionId);
              break;

            case 'page_visited':
              pagesVisited++;
              setCurrentStep(`Analyzing: ${event.url || ''}`);
              setProgress(Math.min(95, (pagesVisited / explorerConfig.maxPages) * 100));
              break;

            case 'defect_found':
              if (event.defect) {
                collectedDefects.push(event.defect);
                setExplorationResult(prev => ({
                  session_id: sessionId,
                  status: 'running',
                  progress: Math.min(95, (pagesVisited / explorerConfig.maxPages) * 100),
                  pages_visited: pagesVisited,
                  defects_found: collectedDefects.length,
                  defects: [...collectedDefects],
                  current_activity: prev?.current_activity || '',
                  duration: prev?.duration || 0,
                  pages_queued: pagesQueued,
                  generated_tests: null,
                }));
              }
              break;

            case 'progress':
              pagesVisited = event.pages_visited || pagesVisited;
              pagesQueued = event.pages_queued || pagesQueued;
              setProgress(Math.min(95, (pagesVisited / explorerConfig.maxPages) * 100));
              break;

            case 'complete':
              setCurrentPhase('Complete');
              setProgress(100);
              const summary = event.summary || {};
              setExplorationResult({
                session_id: sessionId,
                status: 'completed',
                progress: 100,
                pages_visited: summary.pages_visited || pagesVisited,
                defects_found: summary.total_defects || collectedDefects.length,
                defects: event.defects || collectedDefects,
                current_activity: 'Exploration complete',
                duration: summary.duration_seconds || 0,
                pages_queued: 0,
                summary,
                generated_tests: null,
              });
              break;

            case 'error':
              setError(event.error || 'Exploration error');
              setCurrentPhase('Error');
              break;

            case 'stopped':
              setCurrentPhase('Stopped');
              break;
          }
        } catch (e) {
          console.error('[Flowpilot Explorer] Failed to parse SSE event:', line);
        }
      }
    }
  }, [targetUrl, explorerConfig]);

  // ---- Execute: Flowmap Agent (REST) ----

  const executeFlowmap = useCallback(async () => {
    const url = targetUrl.trim() || 'https://example.com';
    setFlowmapResult(null);
    setCurrentPhase('Mapping application...');
    setCurrentStep(`Crawling ${url} -- discovering pages, entities, and actions`);

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

  // ---- Main Execute Handler ----

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

  // ---- Generate Test Suite ----

  const handleGenerateTests = useCallback(async () => {
    if (!explorerSessionId) return;
    setCurrentStep('Generating test suite...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/blaze/generate-tests/${explorerSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Failed to generate tests: ${response.status}`);

      const data: GeneratedTestSuite = await response.json();
      setExplorationResult(prev => prev ? { ...prev, generated_tests: data } : prev);
      setCurrentStep(`Generated ${data.test_count} test cases (${data.summary.smoke_tests} smoke, ${data.summary.form_tests} form, ${data.summary.regression_tests} regression)`);
    } catch (err: any) {
      console.error('[Flowpilot] Failed to generate tests:', err);
      setCurrentStep(`Test generation failed: ${err.message || 'Network error'}`);
    }
  }, [explorerSessionId]);

  // ---- Save Generated Tests ----

  const handleSaveAllTests = useCallback(async (tests: GeneratedTestSuite['tests']) => {
    let savedCount = 0;
    for (const test of tests) {
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test),
        });
        if (response.ok) savedCount++;
      } catch (err) {
        console.error('[Flowpilot] Failed to save test:', err);
      }
    }
    setCurrentStep(`Saved ${savedCount}/${tests.length} test cases to repository`);
  }, []);

  // ---- Save Test Case ----

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
      } else {
        const errData = await response.json().catch(() => ({}));
        setCurrentStep(`Failed to save: ${errData.detail || response.statusText}`);
      }
    } catch (err: any) {
      console.error('[Flowpilot] Failed to save test case:', err);
      setCurrentStep(`Save failed: ${err.message || 'Network error'}`);
    }
  }, [goal]);

  // ---- Determine if execute button is enabled ----

  const agentNeedsAI = selectedAgent.id === 'generator' || selectedAgent.id === 'self-healer';
  const canExecute = (() => {
    if (isProcessing) return false;
    if (agentNeedsAI && !aiAvailable) return false;
    if (selectedAgent.id === 'explorer' || selectedAgent.id === 'flowmap') return !!targetUrl.trim();
    return !!goal.trim();
  })();

  // ---- Render ----

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
              AI-powered testing agents -- real browser automation, real defect detection
            </p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0">
            <Brain className="w-3 h-3 mr-1" /> Live AI
          </Badge>
        </div>
        {!aiAvailable && (
          <div className={cn(
            "mt-3 px-4 py-2 rounded-lg border text-sm flex items-center gap-2",
            theme === 'light' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          )}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Configure AI in{' '}
              <a href="/settings?tab=ai" className="underline font-medium hover:opacity-80">Settings</a>
              {' '}to enable Generator and Self-Healer agents. Explorer works without AI.
            </span>
          </div>
        )}
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
            const needsAI = agent.id === 'generator' || agent.id === 'self-healer';
            const isAgentDisabled = needsAI && !aiAvailable;

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
                      : "bg-gray-900 border-gray-800 hover:border-gray-700",
                  isAgentDisabled && "opacity-60"
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
                      {isAgentDisabled && (
                        <span className={cn("ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded",
                          theme === 'light' ? "bg-amber-100 text-amber-600" : "bg-amber-500/20 text-amber-400"
                        )}>
                          AI Required
                        </span>
                      )}
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
                    {agent.id === 'flowmap' && !aiAvailable && (
                      <Badge className={cn("text-[10px]", theme === 'light' ? "bg-gray-100 text-gray-500" : "bg-gray-800 text-gray-400", "border-0")}>
                        Enhanced with AI when configured
                      </Badge>
                    )}
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

              {/* Explorer Configuration Panel */}
              {selectedAgent.id === 'explorer' && (
                <div>
                  <button
                    onClick={() => setShowExplorerConfig(!showExplorerConfig)}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium w-full py-2",
                      theme === 'light' ? 'text-gray-700 hover:text-gray-900' : 'text-gray-300 hover:text-white'
                    )}
                  >
                    <Settings className="w-4 h-4" />
                    Explorer Configuration
                    {showExplorerConfig ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                  </button>

                  {showExplorerConfig && (
                    <div className={cn(
                      "mt-2 p-4 rounded-lg border space-y-4",
                      theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
                    )}>
                      {/* Crawl Settings */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                            Max Pages ({explorerConfig.maxPages})
                          </label>
                          <input
                            type="range"
                            min={10}
                            max={500}
                            step={10}
                            value={explorerConfig.maxPages}
                            onChange={(e) => setExplorerConfig(prev => ({ ...prev, maxPages: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                            Max Depth ({explorerConfig.maxDepth})
                          </label>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={explorerConfig.maxDepth}
                            onChange={(e) => setExplorerConfig(prev => ({ ...prev, maxDepth: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                            Concurrency ({explorerConfig.concurrency})
                          </label>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={explorerConfig.concurrency}
                            onChange={(e) => setExplorerConfig(prev => ({ ...prev, concurrency: parseInt(e.target.value) }))}
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Auth Configuration */}
                      <div>
                        <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                          <Lock className="w-3 h-3 inline mr-1" />
                          Authentication
                        </label>
                        <select
                          value={explorerConfig.authType}
                          onChange={(e) => setExplorerConfig(prev => ({ ...prev, authType: e.target.value as any }))}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm",
                            theme === 'light' ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-600 text-gray-200'
                          )}
                        >
                          <option value="none">None</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="cookie">Cookie</option>
                          <option value="basic">Basic Auth</option>
                          <option value="form_login">Form Login</option>
                        </select>
                      </div>

                      {explorerConfig.authType === 'bearer' && (
                        <div>
                          <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                            Bearer Token
                          </label>
                          <Input
                            type="password"
                            value={explorerConfig.bearerToken}
                            onChange={(e) => setExplorerConfig(prev => ({ ...prev, bearerToken: e.target.value }))}
                            placeholder="eyJhbGciOiJIUzI1NiIs..."
                            className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                          />
                        </div>
                      )}

                      {explorerConfig.authType === 'cookie' && (
                        <div>
                          <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                            Cookie JSON
                          </label>
                          <Textarea
                            value={explorerConfig.cookieJson}
                            onChange={(e) => setExplorerConfig(prev => ({ ...prev, cookieJson: e.target.value }))}
                            placeholder={'[{"name": "session", "value": "abc123", "domain": "example.com", "path": "/"}]'}
                            rows={3}
                            className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                          />
                        </div>
                      )}

                      {explorerConfig.authType === 'basic' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Username</label>
                            <Input
                              value={explorerConfig.basicUsername}
                              onChange={(e) => setExplorerConfig(prev => ({ ...prev, basicUsername: e.target.value }))}
                              className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                            />
                          </div>
                          <div>
                            <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Password</label>
                            <Input
                              type="password"
                              value={explorerConfig.basicPassword}
                              onChange={(e) => setExplorerConfig(prev => ({ ...prev, basicPassword: e.target.value }))}
                              className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                            />
                          </div>
                        </div>
                      )}

                      {explorerConfig.authType === 'form_login' && (
                        <div className="space-y-3">
                          <div>
                            <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Login URL</label>
                            <Input
                              value={explorerConfig.loginUrl}
                              onChange={(e) => setExplorerConfig(prev => ({ ...prev, loginUrl: e.target.value }))}
                              placeholder="https://example.com/login"
                              className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Username</label>
                              <Input
                                value={explorerConfig.loginUsername}
                                onChange={(e) => setExplorerConfig(prev => ({ ...prev, loginUsername: e.target.value }))}
                                className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                              />
                            </div>
                            <div>
                              <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Password</label>
                              <Input
                                type="password"
                                value={explorerConfig.loginPassword}
                                onChange={(e) => setExplorerConfig(prev => ({ ...prev, loginPassword: e.target.value }))}
                                className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Username Selector</label>
                              <Input
                                value={explorerConfig.usernameSelector}
                                onChange={(e) => setExplorerConfig(prev => ({ ...prev, usernameSelector: e.target.value }))}
                                className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                              />
                            </div>
                            <div>
                              <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Password Selector</label>
                              <Input
                                value={explorerConfig.passwordSelector}
                                onChange={(e) => setExplorerConfig(prev => ({ ...prev, passwordSelector: e.target.value }))}
                                className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                              />
                            </div>
                            <div>
                              <label className={cn("text-xs font-medium mb-1 block", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>Submit Selector</label>
                              <Input
                                value={explorerConfig.submitSelector}
                                onChange={(e) => setExplorerConfig(prev => ({ ...prev, submitSelector: e.target.value }))}
                                className={cn("text-sm", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-600")}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {agentNeedsAI && !aiAvailable && (
                <div className={cn(
                  "p-3 rounded-lg border text-sm",
                  theme === 'light' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                )}>
                  {selectedAgent.name} requires AI to be configured.{' '}
                  <a href="/settings?tab=ai" className="underline font-medium hover:opacity-80">
                    Configure AI in Settings
                  </a>
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
                    title={agentNeedsAI && !aiAvailable ? "AI must be configured in Settings to use this agent" : undefined}
                  >
                    <Wand2 className="w-4 h-4 mr-2" /> Execute with {selectedAgent.name}
                  </Button>
                )}
                {selectedAgent.id === 'explorer' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowExplorerConfig(!showExplorerConfig)}
                    className={cn(theme === 'light' ? "border-gray-200 hover:bg-gray-100" : "border-gray-700 hover:bg-gray-800")}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Processing Status */}
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

          {/* Error Display */}
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

          {/* Generator / Self-Healer Results */}
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

          {/* Explorer Results */}
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
                {explorationResult.status === 'completed' && explorerSessionId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateTests}
                    className="ml-auto"
                  >
                    <FileText className="w-3 h-3 mr-1" /> Generate Test Suite
                  </Button>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-blue-500">{explorationResult.pages_visited}</div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Pages Visited</div>
                </div>
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-red-500">{explorationResult.defects_found}</div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Defects Found</div>
                </div>
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-emerald-500">
                    {typeof explorationResult.duration === 'number' ? `${Math.round(explorationResult.duration)}s` : '0s'}
                  </div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Duration</div>
                </div>
                <div className={cn("p-4 rounded-lg", theme === 'light' ? 'bg-gray-50' : 'bg-gray-800')}>
                  <div className="text-2xl font-bold text-violet-500">
                    {explorationResult.summary?.max_depth_reached ?? '-'}
                  </div>
                  <div className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>Max Depth</div>
                </div>
              </div>

              {/* Severity Breakdown */}
              {explorationResult.summary?.by_severity && (
                <div className="flex gap-2 mb-4">
                  {Object.entries(explorationResult.summary.by_severity as Record<string, number>).map(([sev, count]) => (
                    count > 0 && (
                      <Badge key={sev} className={cn(
                        "text-xs",
                        sev === 'critical' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                        sev === 'high' ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
                        sev === 'medium' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
                        "border-0"
                      )}>
                        {sev}: {count}
                      </Badge>
                    )
                  ))}
                </div>
              )}

              {/* Defect List */}
              {explorationResult.defects.length > 0 && (
                <div className="space-y-3">
                  <h4 className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                    Defects Detected ({explorationResult.defects.length})
                  </h4>
                  {explorationResult.defects.slice(0, 50).map((defect, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        defect.severity === 'critical' ? 'border-red-200 dark:border-red-500/30' :
                        defect.severity === 'high' ? 'border-orange-200 dark:border-orange-500/30' :
                        defect.severity === 'medium' ? 'border-yellow-200 dark:border-yellow-500/30' :
                        'border-gray-200 dark:border-gray-700',
                        theme === 'light' ? 'bg-white' : 'bg-gray-800'
                      )}
                    >
                      {/* Screenshot Thumbnail */}
                      {defect.screenshot && (
                        <button
                          onClick={() => setLiveScreenshot(defect.screenshot!)}
                          className="flex-shrink-0 w-16 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-600 hover:opacity-80"
                        >
                          <img
                            src={`data:image/jpeg;base64,${defect.screenshot}`}
                            alt="Defect screenshot"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn(
                            "text-[10px] flex-shrink-0",
                            defect.severity === 'critical' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                            defect.severity === 'high' ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" :
                            defect.severity === 'medium' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" :
                            "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
                            "border-0"
                          )}>
                            {defect.severity}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{defect.type}</Badge>
                          {defect.wcag_criterion && (
                            <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 dark:border-blue-500 dark:text-blue-400">
                              {defect.wcag_criterion}
                            </Badge>
                          )}
                        </div>
                        <div className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-800' : 'text-gray-200')}>
                          {defect.title || defect.description}
                        </div>
                        {defect.title && defect.description !== defect.title && (
                          <div className={cn("text-xs mt-0.5", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                            {defect.description}
                          </div>
                        )}
                        <div className={cn("text-xs truncate mt-1", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                          {defect.page_url || defect.url}
                        </div>
                      </div>
                    </div>
                  ))}
                  {explorationResult.defects.length > 50 && (
                    <p className={cn("text-xs text-center py-2", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                      Showing 50 of {explorationResult.defects.length} defects
                    </p>
                  )}
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

              {/* Generated Test Suite */}
              {explorationResult.generated_tests && (
                <div className={cn(
                  "mt-6 p-4 rounded-lg border",
                  theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30'
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className={cn("text-sm font-medium", theme === 'light' ? 'text-blue-700' : 'text-blue-400')}>
                      Generated Test Suite ({explorationResult.generated_tests.test_count} tests)
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
                        {explorationResult.generated_tests.summary.smoke_tests} smoke
                      </Badge>
                      <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0">
                        {explorationResult.generated_tests.summary.form_tests} form
                      </Badge>
                      <Badge className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-0">
                        {explorationResult.generated_tests.summary.regression_tests} regression
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {explorationResult.generated_tests.tests.slice(0, 20).map((test, idx) => (
                      <div key={idx} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded text-sm",
                        theme === 'light' ? 'bg-white' : 'bg-gray-800'
                      )}>
                        <FileText className="w-3 h-3 flex-shrink-0 text-blue-500" />
                        <span className={cn("flex-1 truncate", theme === 'light' ? 'text-gray-800' : 'text-gray-200')}>
                          {test.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{test.priority}</Badge>
                      </div>
                    ))}
                    {explorationResult.generated_tests.tests.length > 20 && (
                      <p className={cn("text-xs text-center py-1", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                        ... and {explorationResult.generated_tests.tests.length - 20} more
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSaveAllTests(explorationResult.generated_tests!.tests)}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 text-white"
                    >
                      <Save className="w-3 h-3 mr-1" /> Save All to Repository
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flowmap Results */}
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
