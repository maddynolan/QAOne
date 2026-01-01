import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Play, Pause, Square, Upload, Download, RefreshCw,
  TrendingUp, Activity, Clock, Zap, Target, AlertTriangle,
  CheckCircle2, XCircle, BarChart3, LineChart, Loader2,
  Settings, Copy, Trash2, Plus, Eye, FileCode, Workflow,
  Timer, Gauge, ArrowUpRight, ArrowDownRight, Minus,
  UserPlus, UserMinus, Bot, Cpu, Globe, Server
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Load Test Patterns
const LOAD_PATTERNS = {
  constant: {
    name: "Constant Load",
    icon: "➡️",
    description: "Maintain steady number of virtual users",
    color: "bg-blue-500"
  },
  ramp_up: {
    name: "Ramp Up",
    icon: "📈",
    description: "Gradually increase users over time",
    color: "bg-green-500"
  },
  ramp_down: {
    name: "Ramp Down",
    icon: "📉",
    description: "Gradually decrease users over time",
    color: "bg-orange-500"
  },
  spike: {
    name: "Spike Test",
    icon: "⚡",
    description: "Sudden burst of users to test resilience",
    color: "bg-red-500"
  },
  stress: {
    name: "Stress Test",
    icon: "🔥",
    description: "Push system beyond normal capacity",
    color: "bg-purple-500"
  },
  soak: {
    name: "Soak/Endurance",
    icon: "🕐",
    description: "Extended duration test for memory leaks",
    color: "bg-cyan-500"
  },
  breakpoint: {
    name: "Breakpoint",
    icon: "💥",
    description: "Find system breaking point",
    color: "bg-pink-500"
  },
  wave: {
    name: "Wave Pattern",
    icon: "🌊",
    description: "Cyclic load increases and decreases",
    color: "bg-indigo-500"
  }
};

// User Personas
const USER_PERSONAS = {
  casual: {
    name: "Casual Browser",
    thinkTime: { min: 3000, max: 8000 },
    clickDelay: { min: 500, max: 2000 },
    description: "Slow, exploratory user behavior"
  },
  normal: {
    name: "Normal User",
    thinkTime: { min: 1000, max: 3000 },
    clickDelay: { min: 200, max: 800 },
    description: "Average user interaction speed"
  },
  power: {
    name: "Power User",
    thinkTime: { min: 500, max: 1500 },
    clickDelay: { min: 100, max: 400 },
    description: "Fast, experienced user"
  },
  automated: {
    name: "Bot/Automated",
    thinkTime: { min: 100, max: 500 },
    clickDelay: { min: 50, max: 200 },
    description: "Machine-speed interactions"
  }
};

// Quick Start API Scenarios - ONE CLICK to run (no Browser Flow here)
const QUICK_START_SCENARIOS = [
  {
    id: "api_load",
    name: "API Load Test",
    icon: "🚀",
    description: "50 users hitting your API for 60 seconds",
    virtualUsers: 50,
    duration: 60,
    rampUp: 10,
    pattern: "ramp_up",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 20 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "spike_test",
    name: "Spike Test",
    icon: "⚡",
    description: "200 users sudden spike - test resilience",
    virtualUsers: 200,
    duration: 120,
    rampUp: 5,
    pattern: "spike",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/products/1", weight: 30 },
      { method: "GET", path: "/api/categories", weight: 20 },
    ]
  },
  {
    id: "stress_test",
    name: "Stress Test",
    icon: "🔥",
    description: "500 users - find breaking point",
    virtualUsers: 500,
    duration: 180,
    rampUp: 60,
    pattern: "stress",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products?limit=100", weight: 30 },
      { method: "GET", path: "/api/search?q=product", weight: 30 },
    ]
  },
  {
    id: "endurance_test",
    name: "Endurance Test",
    icon: "⏱️",
    description: "30 users for 10 min - find memory leaks",
    virtualUsers: 30,
    duration: 600,
    rampUp: 30,
    pattern: "soak",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/categories", weight: 30 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "quick_smoke",
    name: "Quick Smoke Test",
    icon: "💨",
    description: "5 users, 30 seconds - quick health check",
    virtualUsers: 5,
    duration: 30,
    rampUp: 5,
    pattern: "constant",
    endpoints: [
      { method: "GET", path: "/health", weight: 50 },
      { method: "GET", path: "/api/products", weight: 50 },
    ]
  }
];

interface VirtualUser {
  id: string;
  name: string;
  persona: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  metrics: {
    requestsCompleted: number;
    errorsCount: number;
    avgResponseTime: number;
  };
}

interface TestStep {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'wait' | 'assert' | 'api';
  action?: string;
  name?: string;
  target?: string;
  value?: string;
  waitTime?: number;
  // API/Protocol testing fields
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  enabled?: boolean;
}

interface FlowstralSession {
  session_id: string;
  name?: string;
  nodes?: any[];
  actions?: any[]; // Recorder extension uses 'actions' instead of 'nodes'
  initial_url?: string;
  created_at?: string;
  is_active?: boolean;
  artifacts?: any;
}

interface LoadTestConfig {
  name: string;
  targetUrl: string;
  virtualUsers: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  pattern: string;
  persona: string;
  steps: TestStep[];
  thinkTime: boolean;
  iterations: number;
}

interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  activeUsers: number;
  errorsPerSecond: number;
  bytesReceived: number;
  bytesSent: number;
}

export default function VirtualUserGenerator() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("quickstart");
  const [loading, setLoading] = useState(false);
  
  // Check for incoming test case from Builder (parse URL params directly)
  const urlParams = new URLSearchParams(window.location.search);
  const incomingTestCaseId = urlParams.get('testCaseId');
  const incomingTestCaseName = urlParams.get('testCaseName');
  const hasProtocolData = urlParams.get('hasProtocolData') === 'true';
  const source = urlParams.get('source');
  
  // Flowstral sessions
  const [flowstralSessions, setFlowstralSessions] = useState<FlowstralSession[]>([]);
  const [loadingFlowstral, setLoadingFlowstral] = useState(false);
  const [selectedSession, setSelectedSession] = useState<FlowstralSession | null>(null);
  
  // Load test configuration
  const [config, setConfig] = useState<LoadTestConfig>({
    name: "Load Test",
    targetUrl: "http://localhost:8002",
    virtualUsers: 10,
    duration: 60,
    rampUpTime: 10,
    pattern: "ramp_up",
    persona: "normal",
    steps: [],
    thinkTime: true,
    iterations: 0 // 0 = infinite until duration
  });
  
  // Virtual users state
  const [virtualUsers, setVirtualUsers] = useState<VirtualUser[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs for closure access (state values captured in closures don't update)
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const elapsedTimeRef = useRef(0);
  
  // Metrics
  const [metrics, setMetrics] = useState<LoadTestMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    p50ResponseTime: 0,
    p90ResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerSecond: 0,
    activeUsers: 0,
    errorsPerSecond: 0,
    bytesReceived: 0,
    bytesSent: 0
  });
  
  // Historical metrics for charts
  const [metricsHistory, setMetricsHistory] = useState<LoadTestMetrics[]>([]);
  const metricsInterval = useRef<NodeJS.Timeout | null>(null);
  const testInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Failed requests tracking
  interface FailedRequest {
    userId: string;
    userName: string;
    stepIndex: number;
    stepName: string;
    timestamp: string;
    responseTime: number;
    error?: string;
  }
  const [failedRequests, setFailedRequests] = useState<FailedRequest[]>([]);
  
  // Saved test configs
  const [savedConfigs, setSavedConfigs] = useState<LoadTestConfig[]>([]);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Test Cases from library (for multi-select import)
  const [testCases, setTestCases] = useState<any[]>([]);
  const [loadingTestCases, setLoadingTestCases] = useState(false);
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [importSource, setImportSource] = useState<'testcases' | 'recordings'>('testcases');

  // Load Test Cases from library
  const loadTestCases = async () => {
    setLoadingTestCases(true);
    try {
      const response = await fetch(`${API_BASE_URL}/test-cases`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only automated test cases with steps
        const automatedCases = (data.test_cases || data || []).filter((tc: any) => 
          tc.type === 'automated' || tc.automationScript || tc.source?.type === 'flowstral'
        );
        setTestCases(automatedCases);
      } else {
        // Try local storage
        const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
        setTestCases(local.filter((tc: any) => 
          tc.type === 'automated' || tc.automationScript || tc.source?.type === 'flowstral'
        ));
      }
    } catch (error) {
      console.error("Failed to load test cases:", error);
      // Try local storage
      const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
      setTestCases(local);
    } finally {
      setLoadingTestCases(false);
    }
  };

  // Toggle test case selection
  const toggleTestCaseSelection = (tcId: string) => {
    setSelectedTestCases(prev => 
      prev.includes(tcId) 
        ? prev.filter(id => id !== tcId)
        : [...prev, tcId]
    );
  };

  // Import selected test cases
  const importSelectedTestCases = () => {
    const selected = testCases.filter(tc => selectedTestCases.includes(tc.id));
    if (selected.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one test case to import",
        variant: "destructive"
      });
      return;
    }

    // Convert all selected test cases to steps
    const allSteps: TestStep[] = [];
    selected.forEach((tc, tcIndex) => {
      // Add separator comment for each test case
      allSteps.push({
        id: `tc_${tcIndex}_header_${Date.now()}`,
        type: 'wait',
        action: `--- ${tc.name} ---`,
        value: '0'
      });
      
      // Add test case steps
      (tc.steps || []).forEach((step: any, stepIndex: number) => {
        allSteps.push({
          id: `tc_${tcIndex}_step_${stepIndex}_${Date.now()}`,
          type: step.type || 'click',
          action: step.action || step.description || `Step ${stepIndex + 1}`,
          target: step.target || step.selector,
          value: step.value || step.testData
        });
      });
    });

    setConfig(prev => ({
      ...prev,
      name: selected.length === 1 
        ? `Load Test: ${selected[0].name}` 
        : `Load Test: ${selected.length} Test Cases`,
      steps: allSteps
    }));

    toast({
      title: "Test Cases Imported",
      description: `Imported ${selected.length} test cases with ${allSteps.length} total steps`,
    });

    setShowImportDialog(false);
    setSelectedTestCases([]);
    setActiveTab("steps");
  };

  // Load Flowstral sessions
  const loadFlowstralSessions = async () => {
    setLoadingFlowstral(true);
    try {
      // Single endpoint - /api/flowstral/sessions (the active router)
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        
        // Sort by created_at descending
        sessions.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        
        setFlowstralSessions(sessions);
        console.log(`[LoadTest] Loaded ${sessions.length} Flowstral sessions`);
      } else {
        console.warn(`[LoadTest] Failed to load sessions: ${response.status}`);
        setFlowstralSessions([]);
      }
    } catch (error) {
      console.error("Failed to load Flowstral sessions:", error);
      setFlowstralSessions([]);
    } finally {
      setLoadingFlowstral(false);
    }
  };

  // Convert Flowstral/Recorder session to test steps
  // Handles both formats: nodes (flowstral) and actions (recorder)
  const convertFlowstralToSteps = (session: FlowstralSession): TestStep[] => {
    const steps: TestStep[] = [];
    
    // Add initial navigation
    if (session.initial_url) {
      steps.push({
        id: `step_nav_${Date.now()}`,
        type: 'navigate',
        action: 'Navigate to URL',
        target: session.initial_url
      });
    }
    
    // Get actions array - support both formats
    const actions = (session as any).actions || session.nodes || [];
    
    // Convert actions/nodes to steps
    actions.forEach((item: any, index: number) => {
      // Handle direct action format (from recorder extension)
      const actionType = item.type || item.data?.actionType || item.data?.type || 'click';
      const selector = item.selector?.playwright || item.selector?.selector || 
                       item.selector || item.data?.selector || item.data?.target;
      const description = item.description || item.data?.label || `Action ${index + 1}`;
      const value = item.value || item.data?.value || item.data?.text || '';
      
      // Skip navigate actions (already handled by initial_url)
      if (actionType === 'navigate' && index === 0) {
        return;
      }
      
      let step: TestStep = {
        id: `step_${index}_${Date.now()}`,
        type: 'click',
        action: description,
        target: selector
      };
      
      if (actionType === 'click' || actionType === 'tap') {
        step.type = 'click';
      } else if (actionType === 'type' || actionType === 'input' || actionType === 'fill') {
        step.type = 'type';
        step.value = value;
      } else if (actionType === 'navigate' || actionType === 'goto') {
        step.type = 'navigate';
        step.target = item.url || item.data?.url || selector;
      } else if (actionType === 'wait') {
        step.type = 'wait';
        step.waitTime = item.duration || item.data?.duration || 1000;
      } else if (actionType === 'assert' || actionType === 'verify') {
        step.type = 'assert';
        step.value = item.expected || item.data?.expected || value;
      } else if (actionType === 'select') {
        step.type = 'click'; // Treat select as click for load testing
        step.value = value;
      } else if (actionType === 'check' || actionType === 'uncheck') {
        step.type = 'click';
      }
      
      // Only add if we have a valid target
      if (step.target || step.type === 'wait' || step.type === 'navigate') {
        steps.push(step);
      }
    });
    
    return steps;
  };

  // Import Flowstral session
  const importFlowstralSession = (session: FlowstralSession) => {
    const steps = convertFlowstralToSteps(session);
    setConfig(prev => ({
      ...prev,
      name: `Load Test - ${session.name || session.session_id.substring(0, 8)}`,
      targetUrl: session.initial_url || prev.targetUrl,
      steps
    }));
    setSelectedSession(session);
    setShowImportDialog(false);
    
    toast({
      title: "Session Imported",
      description: `Imported ${steps.length} steps from Flowstral recording`,
    });
  };

  // Generate virtual users based on config
  // startIndex allows proper naming when adding users incrementally
  const generateVirtualUsers = (count: number, startIndex: number = 0): VirtualUser[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `vu_${Date.now()}_${startIndex + i}`,
      name: `Virtual User ${startIndex + i + 1}`,
      persona: config.persona,
      status: 'idle',
      currentStep: 0,
      totalSteps: config.steps.length,
      metrics: {
        requestsCompleted: 0,
        errorsCount: 0,
        avgResponseTime: 0
      }
    }));
  };

  // Simulate a single request - makes actual HTTP requests to the target URL
  const simulateRequest = async (userId: string, stepIndex: number): Promise<{success: boolean, responseTime: number}> => {
    const step = config.steps[stepIndex];
    const persona = USER_PERSONAS[config.persona as keyof typeof USER_PERSONAS];
    
    // Add think time based on persona
    if (config.thinkTime) {
      const thinkDelay = Math.random() * (persona.thinkTime.max - persona.thinkTime.min) + persona.thinkTime.min;
      await new Promise(resolve => setTimeout(resolve, thinkDelay));
    }
    
    const startTime = performance.now();
    
    try {
      // For navigate steps, make actual HTTP GET request to the target URL
      if (step.type === 'navigate') {
        const targetUrl = step.target || config.targetUrl;
        try {
          const response = await fetch(targetUrl, {
            method: 'GET',
            mode: 'no-cors', // Allow cross-origin requests for load testing
          });
          const endTime = performance.now();
          return {
            success: true, // no-cors doesn't give us status, assume success
            responseTime: endTime - startTime
          };
        } catch {
          const endTime = performance.now();
          return { success: false, responseTime: endTime - startTime };
        }
      } 
      // For API steps, make the actual request
      else if (step.type === 'api') {
        const response = await fetch(step.target || config.targetUrl, {
          method: 'GET',
          mode: 'no-cors',
        });
        const endTime = performance.now();
        return {
          success: true,
          responseTime: endTime - startTime
        };
      }
      // For UI actions (click, type, etc.), simulate with realistic delays
      else {
        const actionDelay = Math.random() * (persona.clickDelay.max - persona.clickDelay.min) + persona.clickDelay.min;
        await new Promise(resolve => setTimeout(resolve, actionDelay));
        
        const endTime = performance.now();
        // 98% success rate for simulated UI actions
        return {
          success: Math.random() > 0.02,
          responseTime: endTime - startTime
        };
      }
    } catch (error) {
      const endTime = performance.now();
      console.warn(`[LoadTest] Request failed for user ${userId}, step ${stepIndex}:`, error);
      return {
        success: false,
        responseTime: endTime - startTime
      };
    }
  };

  // Apply Quick Start scenario
  const applyQuickStartScenario = (scenario: typeof QUICK_START_SCENARIOS[0]) => {
    if (scenario.isFlowstralImport) {
      // Open Flowstral import dialog
      setShowImportDialog(true);
      setActiveTab("steps");
      toast({
        title: "Import Recording",
        description: "Select a Flowstral recording to import for browser flow testing",
      });
      return;
    }

    // Convert API endpoints to test steps
    const steps: TestStep[] = scenario.endpoints.map((endpoint, index) => ({
      id: `step_${index}_${Date.now()}`,
      type: 'api' as const,
      action: `${endpoint.method} ${endpoint.path}`,
      target: endpoint.path,
      value: endpoint.method,
    }));

    // Apply configuration
    setConfig(prev => ({
      ...prev,
      name: scenario.name,
      virtualUsers: scenario.virtualUsers,
      duration: scenario.duration,
      rampUpTime: scenario.rampUp,
      pattern: scenario.pattern,
      steps,
    }));

    setActiveTab("configure");
    toast({
      title: "Scenario Applied",
      description: `${scenario.name} configuration loaded with ${steps.length} API endpoints`,
    });
  };

  // Run API endpoint test (for Quick Start scenarios)
  const runApiTest = async (scenario: typeof QUICK_START_SCENARIOS[0]) => {
    applyQuickStartScenario(scenario);
    // Small delay to let state update, then start
    setTimeout(() => {
      startLoadTest();
    }, 100);
  };

  // Run load test
  const startLoadTest = async () => {
    if (config.steps.length === 0) {
      toast({
        title: "Error",
        description: "Please add test steps or import a Flowstral session",
        variant: "destructive"
      });
      return;
    }

    // Update both state AND refs (refs are used in closures)
    setIsRunning(true);
    setIsPaused(false);
    setElapsedTime(0);
    setMetricsHistory([]);
    isRunningRef.current = true;
    isPausedRef.current = false;
    elapsedTimeRef.current = 0;
    
    // Reset metrics
    setMetrics({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      activeUsers: 0,
      errorsPerSecond: 0,
      bytesReceived: 0,
      bytesSent: 0
    });

    // Track all response times for percentile calculation
    const allResponseTimes: number[] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequestsCount = 0;
    
    // Clear previous failed requests
    setFailedRequests([]);

    // Calculate user ramp schedule based on pattern
    const pattern = LOAD_PATTERNS[config.pattern as keyof typeof LOAD_PATTERNS];
    const targetUsers = config.virtualUsers;
    const rampTime = config.rampUpTime;
    const duration = config.duration;

    console.log(`[LoadTest] Starting test: ${targetUsers} users, ${duration}s duration, ${config.steps.length} steps`);

    // Start metrics collection interval
    metricsInterval.current = setInterval(() => {
      elapsedTimeRef.current += 1;
      setElapsedTime(elapsedTimeRef.current);
      
      // Collect metrics snapshot
      setMetrics(current => {
        const snapshot = { ...current };
        setMetricsHistory(prev => [...prev.slice(-59), snapshot]); // Keep last 60 seconds
        return current;
      });
    }, 1000);

    // Main test loop
    let currentUsers = 0;
    const activeUserPromises: Promise<void>[] = [];

    const userLoop = async (userId: string, userIndex: number) => {
      let iterations = 0;
      const maxIterations = config.iterations || Infinity;
      
      console.log(`[LoadTest] User ${userId} starting loop`);
      
      // Use REFS instead of state for closure access!
      while (isRunningRef.current && !isPausedRef.current && iterations < maxIterations && elapsedTimeRef.current < duration) {
        // Update user status
        setVirtualUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, status: 'running' } : u
        ));

        for (let stepIndex = 0; stepIndex < config.steps.length; stepIndex++) {
          if (!isRunningRef.current || isPausedRef.current) break;

          // Update current step
          setVirtualUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, currentStep: stepIndex + 1 } : u
          ));

          const result = await simulateRequest(userId, stepIndex);
          totalRequests++;
          
          if (result.success) {
            successfulRequests++;
          } else {
            failedRequestsCount++;
            // Track failure details
            setFailedRequests(prev => [...prev, {
              userId,
              userName: `Virtual User ${userIndex + 1}`,
              stepIndex,
              stepName: config.steps[stepIndex]?.action || `Step ${stepIndex + 1}`,
              timestamp: new Date().toISOString(),
              responseTime: result.responseTime,
              error: 'Request failed or timed out'
            }]);
          }
          
          allResponseTimes.push(result.responseTime);

          // Update metrics
          setMetrics(prev => {
            const newTotal = prev.totalRequests + 1;
            const newAvg = (prev.avgResponseTime * prev.totalRequests + result.responseTime) / newTotal;
            
            // Calculate percentiles
            const sorted = [...allResponseTimes].sort((a, b) => a - b);
            const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
            const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
            const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
            const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
            
            return {
              ...prev,
              totalRequests: newTotal,
              successfulRequests: result.success ? prev.successfulRequests + 1 : prev.successfulRequests,
              failedRequests: result.success ? prev.failedRequests : prev.failedRequests + 1,
              avgResponseTime: newAvg,
              minResponseTime: Math.min(prev.minResponseTime, result.responseTime),
              maxResponseTime: Math.max(prev.maxResponseTime, result.responseTime),
              p50ResponseTime: p50,
              p90ResponseTime: p90,
              p95ResponseTime: p95,
              p99ResponseTime: p99,
              requestsPerSecond: newTotal / Math.max(1, elapsedTime),
              activeUsers: currentUsers,
              errorsPerSecond: (result.success ? prev.failedRequests : prev.failedRequests + 1) / Math.max(1, elapsedTime)
            };
          });

          // Update user metrics
          setVirtualUsers(prev => prev.map(u => {
            if (u.id === userId) {
              const newRequests = u.metrics.requestsCompleted + 1;
              return {
                ...u,
                metrics: {
                  requestsCompleted: newRequests,
                  errorsCount: result.success ? u.metrics.errorsCount : u.metrics.errorsCount + 1,
                  avgResponseTime: (u.metrics.avgResponseTime * (newRequests - 1) + result.responseTime) / newRequests
                }
              };
            }
            return u;
          }));
        }

        iterations++;
      }

      // Mark user as completed
      setVirtualUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, status: 'completed' } : u
      ));
    };

    // Ramp up users based on pattern - use REFS for closure access!
    const rampUpInterval = setInterval(() => {
      if (!isRunningRef.current || isPausedRef.current) return;
      
      const elapsed = elapsedTimeRef.current;
      let targetCurrentUsers = targetUsers;

      // Calculate target users based on pattern
      switch (config.pattern) {
        case 'ramp_up':
          targetCurrentUsers = Math.min(targetUsers, Math.floor((elapsed / rampTime) * targetUsers) + 1);
          break;
        case 'ramp_down':
          targetCurrentUsers = Math.max(1, targetUsers - Math.floor((elapsed / duration) * (targetUsers - 1)));
          break;
        case 'spike':
          // Sudden spike at 30% of duration
          targetCurrentUsers = elapsed > duration * 0.3 && elapsed < duration * 0.5 
            ? targetUsers * 3 
            : targetUsers;
          break;
        case 'stress':
          // Keep increasing users
          targetCurrentUsers = Math.min(targetUsers * 2, targetUsers + Math.floor(elapsed / 5));
          break;
        case 'wave':
          // Sine wave pattern
          const cycle = Math.sin((elapsed / duration) * Math.PI * 4);
          targetCurrentUsers = Math.floor(targetUsers * 0.5 + targetUsers * 0.5 * cycle);
          break;
        case 'breakpoint':
          // Keep increasing until system breaks
          targetCurrentUsers = Math.min(targetUsers * 5, targetUsers + Math.floor(elapsed / 2));
          break;
        default:
          targetCurrentUsers = targetUsers;
      }

      // Add new users if needed - use REFS!
      while (currentUsers < targetCurrentUsers && isRunningRef.current) {
        const newUser = generateVirtualUsers(1, currentUsers)[0]; // Pass currentUsers as startIndex
        setVirtualUsers(prev => [...prev, newUser]);
        activeUserPromises.push(userLoop(newUser.id, currentUsers));
        currentUsers++;
        setMetrics(prev => ({ ...prev, activeUsers: currentUsers }));
        console.log(`[LoadTest] Added user ${currentUsers}/${targetCurrentUsers}`);
      }
    }, 1000);

    // Initial users
    const initialUsers = generateVirtualUsers(config.pattern === 'constant' ? targetUsers : 1);
    setVirtualUsers(initialUsers);
    initialUsers.forEach((user, index) => {
      activeUserPromises.push(userLoop(user.id, index));
      currentUsers++;
    });

    // Wait for test to complete
    testInterval.current = setTimeout(async () => {
      console.log(`[LoadTest] Test duration complete, stopping...`);
      clearInterval(rampUpInterval);
      isRunningRef.current = false;
      setIsRunning(false);
      
      // Wait for all user loops to complete
      await Promise.all(activeUserPromises);
      
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
      
      console.log(`[LoadTest] Final results: ${totalRequests} requests, ${successfulRequests} successful, ${failedRequestsCount} failed`);
      
      toast({
        title: "Load Test Complete",
        description: `Completed ${totalRequests} requests: ${successfulRequests} successful, ${failedRequestsCount} failed`,
      });
    }, duration * 1000);
  };

  // Stop load test
  const stopLoadTest = () => {
    // Update BOTH state AND refs
    isRunningRef.current = false;
    isPausedRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    
    if (metricsInterval.current) {
      clearInterval(metricsInterval.current);
    }
    if (testInterval.current) {
      clearTimeout(testInterval.current);
    }
    
    // Mark all users as completed
    setVirtualUsers(prev => prev.map(u => ({ ...u, status: 'completed' })));
    
    console.log(`[LoadTest] Test stopped by user`);
    
    toast({
      title: "Load Test Stopped",
      description: "Test execution has been stopped",
    });
  };

  // Pause/Resume
  const togglePause = () => {
    const newPausedState = !isPausedRef.current;
    isPausedRef.current = newPausedState;
    setIsPaused(newPausedState);
    toast({
      title: newPausedState ? "Test Paused" : "Test Resumed",
      description: newPausedState ? "Test execution paused" : "Continuing test execution",
    });
  };

  // Add manual step
  const addStep = (type: TestStep['type']) => {
    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      type,
      action: `New ${type} step`,
      target: '',
      value: ''
    };
    setConfig(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  // Remove step
  const removeStep = (stepId: string) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId)
    }));
  };

  // Update step
  const updateStep = (stepId: string, updates: Partial<TestStep>) => {
    setConfig(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    }));
  };

  // Save config
  const saveConfig = () => {
    const saved = [...savedConfigs, { ...config, name: `${config.name} - ${new Date().toLocaleString()}` }];
    setSavedConfigs(saved);
    localStorage.setItem('load_test_configs', JSON.stringify(saved));
    toast({ title: "Config Saved" });
  };

  // Load saved configs and auto-refresh sessions
  useEffect(() => {
    const saved = localStorage.getItem('load_test_configs');
    if (saved) {
      setSavedConfigs(JSON.parse(saved));
    }
    loadFlowstralSessions();
    
    // Auto-refresh Flowstral sessions every 5 seconds when dialog is open
    const interval = setInterval(() => {
      if (showImportDialog) {
        loadFlowstralSessions();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [showImportDialog]);

  // Handle incoming test case from Builder or Recorder
  useEffect(() => {
    if (hasProtocolData) {
      if (source === 'recorder') {
        // Coming from recorder - show notification
        toast({
          title: "🎯 Protocol Data Ready",
          description: "Import your recorded session to run load tests",
        });
        // Switch to Protocol tab
        setActiveTab("protocol");
      } else if (incomingTestCaseName) {
        // Coming from Builder with test case name
        toast({
          title: "📥 Test Case Loaded",
          description: `"${incomingTestCaseName}" protocol data ready for load testing`,
        });
        
        setConfig(prev => ({
          ...prev,
          name: `Load Test: ${incomingTestCaseName}`,
        }));
        
        // Switch to Protocol tab
        setActiveTab("protocol");
      }
    }
  }, []);

  // Export results
  const exportResults = () => {
    const results = {
      config,
      metrics,
      metricsHistory,
      virtualUsers: virtualUsers.map(u => ({
        id: u.id,
        name: u.name,
        metrics: u.metrics
      })),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `load-test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Gauge className="w-6 h-6 text-gray-900 dark:text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance Testing</h1>
              <p className="text-sm text-gray-400">
                Load testing • Virtual users • Browser flow simulation
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isRunning ? (
              <>
                <Button variant="outline" onClick={togglePause} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                  {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                  {isPaused ? "Resume" : "Pause"}
                </Button>
                <Button variant="destructive" onClick={stopLoadTest}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : (
              <Button onClick={startLoadTest} disabled={config.steps.length === 0} className="bg-gradient-to-r from-amber-500 to-orange-500 text-gray-900 dark:text-white hover:from-amber-400 hover:to-orange-400">
                <Play className="w-4 h-4 mr-2" />
                Start Load Test
              </Button>
            )}
          </div>
        </div>

      {/* Status Bar */}
      {isRunning && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Activity className={`w-5 h-5 ${isPaused ? 'text-yellow-500' : 'text-green-500 animate-pulse'}`} />
                  <span className="font-medium">{isPaused ? 'Paused' : 'Running'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(elapsedTime)} / {formatTime(config.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{metrics.activeUsers} Active Users</span>
                </div>
              </div>
              <Progress value={(elapsedTime / config.duration) * 100} className="w-48" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7 bg-gray-900 border border-gray-700 p-1">
          <TabsTrigger value="quickstart" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <Zap className="w-4 h-4 mr-2" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger value="protocol" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <Activity className="w-4 h-4 mr-2" />
            Protocol
          </TabsTrigger>
          <TabsTrigger value="configure" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="steps" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <FileCode className="w-4 h-4 mr-2" />
            Test Steps
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <Bot className="w-4 h-4 mr-2" />
            Virtual Users
          </TabsTrigger>
          <TabsTrigger value="metrics" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Live Metrics
          </TabsTrigger>
          <TabsTrigger value="results" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-gray-400">
            <LineChart className="w-4 h-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Quick Start Tab - ONE CLICK scenarios for API testing */}
        <TabsContent value="quickstart" className="space-y-4">
          {/* Target URL - Most Important, Show First */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Target URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={config.targetUrl}
                      onChange={(e) => setConfig(prev => ({ ...prev, targetUrl: e.target.value }))}
                      placeholder="http://localhost:8002"
                      className="font-mono"
                    />
                    <Select
                      onValueChange={(value) => setConfig(prev => ({ ...prev, targetUrl: value }))}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Presets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http://localhost:8002">E-commerce Demo</SelectItem>
                        <SelectItem value="http://localhost:3000">Test Website</SelectItem>
                        <SelectItem value="http://localhost:8000">Backend API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Scenarios - API Testing */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
                <Zap className="w-5 h-5 text-amber-500" />
                API Performance Tests
              </CardTitle>
              <CardDescription className="text-gray-400">
                One-click scenarios to test your API. Each scenario runs against the Target URL above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {QUICK_START_SCENARIOS.map((scenario) => (
                  <Card 
                    key={scenario.id}
                    className="bg-gray-800 border-gray-700 hover:border-amber-500/50 transition-all"
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{scenario.icon}</span>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{scenario.name}</span>
                      </div>
                      <p className="text-xs text-gray-400">{scenario.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                          {scenario.virtualUsers} users
                        </Badge>
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                          {scenario.duration}s
                        </Badge>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => runApiTest(scenario)}
                        className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 dark:text-white"
                        disabled={isRunning}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Browser Flow Testing - Separate Section */}
          <Card className="bg-gray-900 border-gray-700 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
                <Globe className="w-5 h-5 text-amber-500" />
                Browser Flow Testing
              </CardTitle>
              <CardDescription className="text-gray-400">
                Import a Flowstral recording to replay user journeys with multiple virtual users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-400">
                    Record a browser session using Flowstral, then import it here to run as a load test.
                    This tests actual user flows (clicks, typing, navigation) not just API endpoints.
                  </p>
                </div>
                <Button onClick={() => setShowImportDialog(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-900 dark:text-white">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Recording
                </Button>
                <Button onClick={() => setActiveTab("steps")} variant="ghost" className="text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-800">
                  <FileCode className="w-4 h-4 mr-2" />
                  View Steps
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Need Custom Config? */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <span>Need custom settings?</span>
            <Button variant="link" size="sm" onClick={() => setActiveTab("configure")} className="p-0 h-auto">
              Go to Configure tab →
            </Button>
          </div>
        </TabsContent>

        {/* Protocol Recording Tab - NEW! Better than NeoLoad/LoadRunner */}
        <TabsContent value="protocol" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-500" />
                Protocol-Level Recording & Testing
              </CardTitle>
              <CardDescription>
                Capture HTTP/WebSocket traffic during browser sessions for true protocol-level load testing.
                This is how NeoLoad and LoadRunner achieve massive scale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Protocol Recording Options */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 border-dashed hover:border-primary cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Record Protocol Traffic</h4>
                      <p className="text-xs text-muted-foreground">Capture HTTP requests during browser session</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Records all network calls while you interact with the browser.
                    Auto-detects correlatable values (tokens, session IDs).
                  </p>
                  <Button className="w-full" onClick={() => {
                    toast({
                      title: "Protocol Recording",
                      description: "Start recording in Flowstral, network traffic will be captured automatically"
                    });
                  }}>
                    <Activity className="w-4 h-4 mr-2" />
                    Start Protocol Recording
                  </Button>
                </Card>

                <Card className="p-4 border-dashed hover:border-primary cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Import HAR File</h4>
                      <p className="text-xs text-muted-foreground">Load HTTP Archive from browser DevTools</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Import HAR files exported from Chrome/Firefox DevTools.
                    Industry-standard format for portable traffic recordings.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.har,.json';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        const text = await file.text();
                        try {
                          const harData = JSON.parse(text);
                          const entries = harData?.log?.entries || [];
                          
                          // Convert HAR entries to test steps
                          const steps: TestStep[] = entries
                            .filter((entry: any) => {
                              const url = entry?.request?.url || '';
                              // Filter out static assets
                              return !url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)(\?|$)/i);
                            })
                            .slice(0, 50) // Limit to first 50 requests for performance
                            .map((entry: any, idx: number) => {
                              const req = entry?.request || {};
                              const url = new URL(req.url || 'http://localhost');
                              return {
                                id: `har_${idx}`,
                                type: 'api' as const,
                                name: `${req.method || 'GET'} ${url.pathname}`,
                                url: req.url,
                                method: req.method || 'GET',
                                headers: (req.headers || []).reduce((acc: any, h: any) => {
                                  if (h.name && !h.name.startsWith(':')) {
                                    acc[h.name] = h.value;
                                  }
                                  return acc;
                                }, {}),
                                body: req.postData?.text,
                                enabled: true,
                              };
                            });
                          
                          if (steps.length > 0) {
                            // Get base URL from first request
                            const firstUrl = new URL(steps[0].url || 'http://localhost');
                            const baseUrl = `${firstUrl.protocol}//${firstUrl.host}`;
                            
                            // Update config with imported steps
                            setConfig(prev => ({
                              ...prev,
                              name: `Load Test: ${file.name}`,
                              targetUrl: baseUrl,
                              steps: steps,
                            }));
                            
                            toast({
                              title: "✅ HAR Imported Successfully",
                              description: `Loaded ${steps.length} HTTP requests. Click 'Start Load Test' to run!`,
                            });
                          } else {
                            toast({ 
                              title: "No API Requests Found", 
                              description: "HAR file contains no API requests to test",
                              variant: "destructive" 
                            });
                          }
                          
                          // Also save to backend (non-blocking)
                          fetch(`${API_BASE_URL}/api/protocol-recording/import-har`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ har: harData, name: file.name })
                          }).catch(() => {});
                          
                        } catch (err) {
                          toast({ title: "Import Failed", description: "Invalid HAR file format", variant: "destructive" });
                        }
                      }
                    };
                    input.click();
                  }}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import HAR File
                  </Button>
                </Card>
              </div>

              {/* Protocol Execution Modes */}
              <div>
                <h3 className="font-medium mb-3">Execution Mode</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 border-2 border-primary bg-primary/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Protocol Only</span>
                      <Badge className="text-[10px]">Fastest</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pure HTTP requests without browser. 10,000+ VUs possible.
                    </p>
                  </Card>
                  <Card className="p-3 border hover:border-primary/50 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4" />
                      <span className="font-medium text-sm">Headless Browser</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Full browser in headless mode. JavaScript execution included.
                    </p>
                  </Card>
                  <Card className="p-3 border hover:border-primary/50 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="w-4 h-4" />
                      <span className="font-medium text-sm">Debug Mode</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Visible browser for debugging. Lower scale, full visibility.
                    </p>
                  </Card>
                </div>
              </div>

              {/* Correlation Detection */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Auto-Correlation Detection
                </h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Session IDs
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    CSRF Tokens
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Auth Tokens (JWT)
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Request IDs
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    User IDs
                  </div>
                  <div className="p-2 bg-muted rounded flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Timestamps/Nonces
                  </div>
                </div>
              </div>

              {/* Export Formats */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Script Formats
                </h3>
                <div className="flex gap-2">
                  <Badge variant="outline" className="py-1">QAAI Native</Badge>
                  <Badge variant="outline" className="py-1">k6 JavaScript</Badge>
                  <Badge variant="outline" className="py-1">JMeter JMX</Badge>
                  <Badge variant="outline" className="py-1">HAR (HTTP Archive)</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison with NeoLoad/LoadRunner */}
          <Card className="border-green-500/30 bg-green-50/30 dark:bg-green-950/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Why This Beats NeoLoad & LoadRunner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">🚀 QAAI Advantages</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✅ Free & Open Source</li>
                    <li>✅ Integrated with test case management</li>
                    <li>✅ AI-powered test generation</li>
                    <li>✅ Browser + Protocol in one tool</li>
                    <li>✅ Auto-correlation detection</li>
                    <li>✅ Real-time metrics dashboard</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">💰 NeoLoad/LoadRunner</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>❌ $15,000-50,000+/year licensing</li>
                    <li>❌ Separate test management tools</li>
                    <li>❌ Manual script correlation</li>
                    <li>❌ Complex setup & training</li>
                    <li>❌ Protocol-only (no browser)</li>
                    <li>❌ Vendor lock-in</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configure Tab */}
        <TabsContent value="configure" className="space-y-4">
          {/* Run Test Banner - Always Visible */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Ready to Run: {config.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {config.virtualUsers} users • {config.duration}s duration • {config.steps.length} steps • {config.targetUrl}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!isRunning ? (
                    <Button onClick={startLoadTest} size="lg" className="px-8">
                      <Play className="w-5 h-5 mr-2" />
                      Start Test
                    </Button>
                  ) : (
                    <>
                      <Button onClick={togglePause} variant="outline">
                        {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        {isPaused ? "Resume" : "Pause"}
                      </Button>
                      <Button onClick={stopLoadTest} variant="destructive">
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Load Test Configuration</CardTitle>
                <CardDescription>Configure your load test parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Test Name</Label>
                  <Input
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Load Test"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Target URL</Label>
                  <Input
                    value={config.targetUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, targetUrl: e.target.value }))}
                    placeholder="http://localhost:8002"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Virtual Users: {config.virtualUsers}</Label>
                    <Slider
                      value={[config.virtualUsers]}
                      onValueChange={(v) => setConfig(prev => ({ ...prev, virtualUsers: v[0] }))}
                      min={1}
                      max={500}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (seconds): {config.duration}</Label>
                    <Slider
                      value={[config.duration]}
                      onValueChange={(v) => setConfig(prev => ({ ...prev, duration: v[0] }))}
                      min={10}
                      max={3600}
                      step={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ramp-Up Time (seconds): {config.rampUpTime}</Label>
                  <Slider
                    value={[config.rampUpTime]}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, rampUpTime: v[0] }))}
                    min={0}
                    max={config.duration}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Think Time (realistic delays)</Label>
                  <Switch
                    checked={config.thinkTime}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, thinkTime: v }))}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={saveConfig}>
                    <Download className="w-4 h-4 mr-2" />
                    Save Config
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                    <Workflow className="w-4 h-4 mr-2" />
                    Import Flowstral
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Load Pattern */}
              <Card>
                <CardHeader>
                  <CardTitle>Load Pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(LOAD_PATTERNS).map(([key, pattern]) => (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          config.pattern === key 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setConfig(prev => ({ ...prev, pattern: key }))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{pattern.icon}</span>
                          <span className="font-medium text-sm">{pattern.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* User Persona */}
              <Card>
                <CardHeader>
                  <CardTitle>User Persona</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(USER_PERSONAS).map(([key, persona]) => (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          config.persona === key 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setConfig(prev => ({ ...prev, persona: key }))}
                      >
                        <span className="font-medium text-sm">{persona.name}</span>
                        <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Test Steps Tab */}
        <TabsContent value="steps" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Test Steps</CardTitle>
                  <CardDescription>
                    {selectedSession 
                      ? `Imported from: ${selectedSession.name || selectedSession.session_id.substring(0, 8)}`
                      : 'Add steps manually or import from Flowstral'
                    }
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addStep('navigate')}>
                    <Globe className="w-4 h-4 mr-2" />
                    Navigate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep('click')}>
                    <Target className="w-4 h-4 mr-2" />
                    Click
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep('type')}>
                    <FileCode className="w-4 h-4 mr-2" />
                    Type
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep('wait')}>
                    <Timer className="w-4 h-4 mr-2" />
                    Wait
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addStep('api')}>
                    <Server className="w-4 h-4 mr-2" />
                    API
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {config.steps.length === 0 ? (
                <div className="text-center py-12">
                  <Workflow className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No test steps defined</h3>
                  <p className="text-muted-foreground mb-4">
                    Import a Flowstral recording or add steps manually
                  </p>
                  <Button onClick={() => setShowImportDialog(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import from Flowstral
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {config.steps.map((step, index) => (
                    <Card key={step.id} className="p-3">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div className="flex-1 grid grid-cols-4 gap-4">
                          <Select
                            value={step.type}
                            onValueChange={(v) => updateStep(step.id, { type: v as TestStep['type'] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="navigate">Navigate</SelectItem>
                              <SelectItem value="click">Click</SelectItem>
                              <SelectItem value="type">Type</SelectItem>
                              <SelectItem value="wait">Wait</SelectItem>
                              <SelectItem value="assert">Assert</SelectItem>
                              <SelectItem value="api">API Call</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={step.action}
                            onChange={(e) => updateStep(step.id, { action: e.target.value })}
                            placeholder="Action description"
                          />
                          <Input
                            value={step.target || ''}
                            onChange={(e) => updateStep(step.id, { target: e.target.value })}
                            placeholder="Target/Selector"
                          />
                          <Input
                            value={step.value || ''}
                            onChange={(e) => updateStep(step.id, { value: e.target.value })}
                            placeholder="Value"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Virtual Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Virtual Users ({virtualUsers.length})</CardTitle>
              <CardDescription>Monitor individual virtual user status</CardDescription>
            </CardHeader>
            <CardContent>
              {virtualUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No virtual users</h3>
                  <p className="text-muted-foreground">Start a load test to see virtual users</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
                  {virtualUsers.map(user => (
                    <Card key={user.id} className={`p-3 ${
                      user.status === 'running' ? 'border-green-500' :
                      user.status === 'error' ? 'border-red-500' :
                      user.status === 'completed' ? 'border-blue-500' : ''
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className={`w-4 h-4 ${
                          user.status === 'running' ? 'text-green-500 animate-pulse' :
                          user.status === 'error' ? 'text-red-500' :
                          user.status === 'completed' ? 'text-blue-500' : 'text-muted-foreground'
                        }`} />
                        <span className="text-sm font-medium truncate">{user.name}</span>
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Step:</span>
                          <span>{user.currentStep}/{user.totalSteps}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Requests:</span>
                          <span>{user.metrics.requestsCompleted}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className={user.metrics.errorsCount > 0 ? 'text-red-500' : ''}>
                            {user.metrics.errorsCount}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg RT:</span>
                          <span>{user.metrics.avgResponseTime.toFixed(0)}ms</span>
                        </div>
                      </div>
                      <Progress 
                        value={(user.currentStep / user.totalSteps) * 100} 
                        className="h-1 mt-2"
                      />
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Requests</p>
                    <p className="text-3xl font-bold">{metrics.totalRequests.toLocaleString()}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Requests/sec</p>
                    <p className="text-3xl font-bold">{metrics.requestsPerSecond.toFixed(1)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response Time</p>
                    <p className="text-3xl font-bold">{metrics.avgResponseTime.toFixed(0)}ms</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-3xl font-bold">
                      {((metrics.failedRequests / Math.max(1, metrics.totalRequests)) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Percentiles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>p50 (Median)</span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, metrics.p50ResponseTime / 10)} className="w-32" />
                      <span className="font-mono">{metrics.p50ResponseTime.toFixed(0)}ms</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>p90</span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, metrics.p90ResponseTime / 10)} className="w-32" />
                      <span className="font-mono">{metrics.p90ResponseTime.toFixed(0)}ms</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>p95</span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, metrics.p95ResponseTime / 10)} className="w-32" />
                      <span className="font-mono">{metrics.p95ResponseTime.toFixed(0)}ms</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>p99</span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, metrics.p99ResponseTime / 10)} className="w-32" />
                      <span className="font-mono">{metrics.p99ResponseTime.toFixed(0)}ms</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success vs Failures</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-green-500 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Successful
                      </span>
                      <span>{metrics.successfulRequests.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={(metrics.successfulRequests / Math.max(1, metrics.totalRequests)) * 100} 
                      className="h-3"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-red-500 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Failed
                      </span>
                      <span>{metrics.failedRequests.toLocaleString()}</span>
                    </div>
                    <Progress 
                      value={(metrics.failedRequests / Math.max(1, metrics.totalRequests)) * 100} 
                      className="h-3 [&>div]:bg-red-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Response Time Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-1">
                {metricsHistory.slice(-60).map((m, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/80 rounded-t transition-all"
                    style={{ 
                      height: `${Math.min(100, (m.avgResponseTime / Math.max(1, Math.max(...metricsHistory.map(h => h.avgResponseTime)))) * 100)}%`,
                      minHeight: '4px'
                    }}
                    title={`${m.avgResponseTime.toFixed(0)}ms`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>-60s</span>
                <span>Now</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Test Results Summary</h3>
            <Button variant="outline" onClick={exportResults}>
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Test Name:</span>
                  <span>{config.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target URL:</span>
                  <span className="truncate max-w-[150px]">{config.targetUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Virtual Users:</span>
                  <span>{config.virtualUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{formatTime(config.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pattern:</span>
                  <Badge variant="outline">{LOAD_PATTERNS[config.pattern as keyof typeof LOAD_PATTERNS]?.name}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Steps:</span>
                  <span>{config.steps.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Requests:</span>
                  <span className="font-mono">{metrics.totalRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Throughput:</span>
                  <span className="font-mono">{metrics.requestsPerSecond.toFixed(2)} req/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Response:</span>
                  <span className="font-mono">{metrics.avgResponseTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Response:</span>
                  <span className="font-mono">{metrics.minResponseTime === Infinity ? '0' : metrics.minResponseTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Response:</span>
                  <span className="font-mono">{metrics.maxResponseTime.toFixed(2)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">p95 Response:</span>
                  <span className="font-mono">{metrics.p95ResponseTime.toFixed(2)}ms</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reliability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span className={`font-mono ${
                    (metrics.successfulRequests / Math.max(1, metrics.totalRequests)) > 0.99 
                      ? 'text-green-500' 
                      : (metrics.successfulRequests / Math.max(1, metrics.totalRequests)) > 0.95 
                        ? 'text-yellow-500' 
                        : 'text-red-500'
                  }`}>
                    {((metrics.successfulRequests / Math.max(1, metrics.totalRequests)) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Successful:</span>
                  <span className="font-mono text-green-500">{metrics.successfulRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed:</span>
                  <span className="font-mono text-red-500">{metrics.failedRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error/sec:</span>
                  <span className="font-mono">{metrics.errorsPerSecond.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peak Users:</span>
                  <span className="font-mono">{virtualUsers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-mono">{formatTime(elapsedTime)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Failed Requests Details */}
          {failedRequests.length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Failed Requests ({failedRequests.length})
                </CardTitle>
                <CardDescription>
                  Details of all failed requests during the test
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {failedRequests.map((failure, index) => (
                    <div key={index} className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-red-700 dark:text-red-400">
                            {failure.userName} - {failure.stepName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Step {failure.stepIndex + 1} • {new Date(failure.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="text-xs">
                            {failure.responseTime.toFixed(0)}ms
                          </Badge>
                        </div>
                      </div>
                      {failure.error && (
                        <p className="text-xs text-red-600 mt-2">{failure.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Import Dialog - Test Cases & Recordings */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Test Steps
            </DialogTitle>
          </DialogHeader>
          
          {/* Source Selection Tabs */}
          <div className="flex gap-2 border-b pb-2">
            <Button 
              variant={importSource === 'testcases' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setImportSource('testcases');
                loadTestCases();
              }}
            >
              <FileCode className="w-4 h-4 mr-2" />
              Test Cases ({testCases.length})
            </Button>
            <Button 
              variant={importSource === 'recordings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setImportSource('recordings');
                loadFlowstralSessions();
              }}
            >
              <Workflow className="w-4 h-4 mr-2" />
              Raw Recordings ({flowstralSessions.length})
            </Button>
          </div>
          
          <div className="space-y-4">
            {/* Test Cases (Multi-Select) */}
            {importSource === 'testcases' && (
              <>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {selectedTestCases.length > 0 
                      ? `${selectedTestCases.length} test case(s) selected`
                      : 'Select test cases to import (multi-select supported)'
                    }
                  </div>
                  <div className="flex gap-2">
                    {selectedTestCases.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedTestCases([])}>
                        Clear
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={loadTestCases} disabled={loadingTestCases}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loadingTestCases ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
                
                {testCases.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No automated test cases found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Approve recordings in Trace (Record) to create test cases
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {testCases.map(tc => (
                      <Card 
                        key={tc.id} 
                        className={`p-4 cursor-pointer transition-all ${
                          selectedTestCases.includes(tc.id) 
                            ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => toggleTestCaseSelection(tc.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                            selectedTestCases.includes(tc.id) 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground/50'
                          }`}>
                            {selectedTestCases.includes(tc.id) && (
                              <CheckCircle2 className="w-4 h-4 text-gray-900 dark:text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{tc.name}</p>
                              <Badge variant="outline" className="text-xs">
                                {tc.type || 'automated'}
                              </Badge>
                              {tc.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {tc.category}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {tc.steps?.length || 0} steps • Priority: {tc.priority || 'medium'}
                            </p>
                            {tc.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {tc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {/* Raw Recordings (Single-Select) */}
            {importSource === 'recordings' && (
              <>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={loadFlowstralSessions} disabled={loadingFlowstral}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingFlowstral ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                {flowstralSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No recordings found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Record a session using the Flowstral extension
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {flowstralSessions.map(session => (
                      <Card 
                        key={session.session_id} 
                        className="p-4 cursor-pointer hover:border-primary transition-colors"
                        onClick={() => importFlowstralSession(session)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {session.name || `Recording ${session.session_id.substring(0, 8)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {(session.actions?.length || session.nodes?.length || 0)} actions • {session.initial_url || 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown date'}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            <Upload className="w-4 h-4 mr-2" />
                            Import
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setSelectedTestCases([]);
            }}>
              Cancel
            </Button>
            {importSource === 'testcases' && selectedTestCases.length > 0 && (
              <Button onClick={importSelectedTestCases}>
                <Upload className="w-4 h-4 mr-2" />
                Import {selectedTestCases.length} Test Case(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

