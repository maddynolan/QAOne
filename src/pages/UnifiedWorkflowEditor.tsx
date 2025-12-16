/**
 * Unified Test Builder - v3.1
 * 
 * THE ONLY test builder you need. One unified test case that can:
 * - Run as automated UI test
 * - Execute API tests
 * - Query databases
 * - Run performance tests
 * - Generate manual test documentation
 * 
 * Features:
 * - No-Code / Code toggle (framework abstracted)
 * - Recorder integration
 * - Reusable modules
 * - Blackbox fallback strategies
 * - All assertion types
 * 
 * Color scheme: Purple primary (#8B5CF6), Cyan accent (#38BDF8)
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play, Save, Download, Plus, Trash2, Copy,
  ArrowUp, ArrowDown, Eye, EyeOff, Code, Settings,
  Zap, Globe, MousePointer, Type, Clock, CheckCircle,
  Navigation, AlertCircle, Package, Wand2,
  ChevronRight, ChevronDown, MoreHorizontal, Target,
  Layers, RefreshCw, FileText, Monitor, Server, Gauge,
  Video, Camera, Search, X, XCircle, Edit,
  Database, ToggleLeft, ToggleRight, FolderPlus,
  BookOpen, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { ReusableModulesManager, ModuleStep } from '@/components/ReusableModulesManager';
import { BlackboxLocatorStrategies, BlackboxLocator } from '@/components/BlackboxLocatorStrategies';
import { resultsIngestionService, TestRunData } from '@/lib/results-ingestion-service';

// ============================================================================
// TYPES - Unified Test Case Schema
// ============================================================================

type StepType = 
  | 'navigate' | 'click' | 'input' | 'select' | 'hover' | 'scroll'
  | 'wait' | 'wait_for_element' | 'wait_for_text'
  | 'assert' | 'verify'
  | 'api' | 'graphql'
  | 'db_query' | 'db_assert'
  | 'screenshot' | 'visual_compare'
  | 'extract' | 'store_variable'
  | 'condition' | 'loop'
  | 'module'
  | 'custom';

interface StepAssertion {
  enabled: boolean;
  type: string;
  target?: string;
  expected?: string;
  operator?: 'equals' | 'contains' | 'greater' | 'less' | 'matches';
  softAssert?: boolean;
}

interface TestStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  enabled: boolean;
  
  // UI Actions
  selector?: string;
  value?: string;
  url?: string;
  waitTime?: number;
  
  // Human-readable target (for No-Code view)
  target?: string;  // e.g., "Submit Button", "Email Field"
  
  // Fallback (blackbox)
  fallback?: BlackboxLocator;
  
  // API
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint?: string;
  headers?: Record<string, string>;
  body?: string;
  
  // Database
  dbType?: 'postgres' | 'mysql' | 'mongodb' | 'salesforce_soql';
  query?: string;
  connectionString?: string;
  
  // Assertion
  assertion?: StepAssertion;
  
  // Manual test info
  manualAction?: string;
  expectedResult?: string;
  
  // Variables
  storeAs?: string;
  
  // Module reference
  moduleId?: string;
}

interface TestVariable {
  name: string;
  value: string;
  type: 'static' | 'env' | 'generated' | 'extracted';
}

// Precondition test case reference
interface PreconditionRef {
  testCaseId: string;
  testCaseName: string;
  enabled: boolean;
}

interface UnifiedTestCase {
  id: string;
  name: string;
  description: string;
  tags: string[];
  preconditions: PreconditionRef[]; // Referenced test cases to run first
  steps: TestStep[];
  variables: TestVariable[];
  settings: {
    baseUrl?: string;
    timeout: number;
    retries: number;
    parallelizable: boolean;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    author?: string;
    version: number;
  };
}

type ExportMode = 'automation' | 'api' | 'database' | 'performance' | 'manual';
type ViewMode = 'no-code' | 'code';

// ============================================================================
// STEP TYPE DEFINITIONS
// ============================================================================

const STEP_CATEGORIES = {
  ui: {
    label: 'UI Actions',
    steps: [
      { type: 'navigate', label: 'Navigate', icon: Navigation, color: 'bg-primary text-white' },
      { type: 'click', label: 'Click', icon: MousePointer, color: 'bg-cyan-500 text-white' },
      { type: 'input', label: 'Type Text', icon: Type, color: 'bg-emerald-500 text-white' },
      { type: 'select', label: 'Select Option', icon: ChevronDown, color: 'bg-blue-500 text-white' },
      { type: 'hover', label: 'Hover', icon: Target, color: 'bg-indigo-500 text-white' },
    ]
  },
  wait: {
    label: 'Wait & Sync',
    steps: [
      { type: 'wait', label: 'Wait', icon: Clock, color: 'bg-amber-500 text-white' },
      { type: 'wait_for_element', label: 'Wait for Element', icon: Eye, color: 'bg-amber-600 text-white' },
      { type: 'wait_for_text', label: 'Wait for Text', icon: Search, color: 'bg-amber-700 text-white' },
    ]
  },
  verify: {
    label: 'Verify & Assert',
    steps: [
      { type: 'assert', label: 'Assert', icon: CheckCircle, color: 'bg-green-500 text-white' },
      { type: 'screenshot', label: 'Screenshot', icon: Camera, color: 'bg-violet-500 text-white' },
      { type: 'visual_compare', label: 'Visual Compare', icon: Eye, color: 'bg-violet-600 text-white' },
    ]
  },
  api: {
    label: 'API & Backend',
    steps: [
      { type: 'api', label: 'API Call', icon: Globe, color: 'bg-blue-600 text-white' },
      { type: 'graphql', label: 'GraphQL', icon: Zap, color: 'bg-pink-500 text-white' },
    ]
  },
  db: {
    label: 'Database',
    steps: [
      { type: 'db_query', label: 'DB Query', icon: Database, color: 'bg-orange-500 text-white' },
      { type: 'db_assert', label: 'DB Assert', icon: CheckCircle, color: 'bg-orange-600 text-white' },
    ]
  },
  data: {
    label: 'Data & Variables',
    steps: [
      { type: 'extract', label: 'Extract Value', icon: Copy, color: 'bg-teal-500 text-white' },
      { type: 'store_variable', label: 'Store Variable', icon: FolderPlus, color: 'bg-teal-600 text-white' },
    ]
  },
  logic: {
    label: 'Logic & Flow',
    steps: [
      { type: 'condition', label: 'If/Then', icon: Share2, color: 'bg-purple-500 text-white' },
      { type: 'loop', label: 'Loop', icon: RefreshCw, color: 'bg-purple-600 text-white' },
      { type: 'module', label: 'Use Module', icon: Package, color: 'bg-purple-700 text-white' },
    ]
  },
};

const getStepInfo = (type: StepType) => {
  for (const category of Object.values(STEP_CATEGORIES)) {
    const step = category.steps.find(s => s.type === type);
    if (step) return step;
  }
  return { type, label: type, icon: Zap, color: 'bg-gray-500 text-white' };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract human-readable target name from selector
 * e.g., getByRole('button', { name: 'Submit' }) -> "Submit button"
 */
function extractTargetName(selector?: string, eventData?: any): string {
  if (!selector) return '';
  
  // Check if we have text/label from event data
  if (eventData?.text) return eventData.text;
  if (eventData?.element?.textContent) return eventData.element.textContent.slice(0, 30);
  
  // Parse getByRole
  const roleMatch = selector.match(/getByRole\(['"](\w+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
  if (roleMatch) {
    const [, role, name] = roleMatch;
    return name ? `${name}` : role;
  }
  
  // Parse getByText
  const textMatch = selector.match(/getByText\(['"]([^'"]+)['"]\)/);
  if (textMatch) return textMatch[1];
  
  // Parse getByLabel
  const labelMatch = selector.match(/getByLabel\(['"]([^'"]+)['"]\)/);
  if (labelMatch) return `${labelMatch[1]} field`;
  
  // Parse getByPlaceholder
  const placeholderMatch = selector.match(/getByPlaceholder\(['"]([^'"]+)['"]\)/);
  if (placeholderMatch) return `${placeholderMatch[1]} field`;
  
  // Parse locator with text
  const locatorTextMatch = selector.match(/locator\([^)]*text=['"]([^'"]+)['"]/);
  if (locatorTextMatch) return locatorTextMatch[1];
  
  // Parse data-testid
  const testIdMatch = selector.match(/\[data-testid=['"]([^'"]+)['"]\]/);
  if (testIdMatch) return testIdMatch[1].replace(/-/g, ' ');
  
  // Parse aria-label
  const ariaMatch = selector.match(/\[aria-label=['"]([^'"]+)['"]\]/);
  if (ariaMatch) return ariaMatch[1];
  
  return '';
}

/**
 * Get friendly step description for No-Code view
 */
function getStepDescription(step: TestStep): string {
  switch (step.type) {
    case 'navigate':
      if (step.url) {
        try {
          const url = new URL(step.url);
          return `Go to ${url.hostname}${url.pathname !== '/' ? url.pathname : ''}`;
        } catch {
          return step.url.slice(0, 40);
        }
      }
      return 'Navigate to page';
    
    case 'click':
      return step.target || step.name || 'Click element';
    
    case 'input':
      if (step.value) {
        const preview = step.value.length > 20 ? step.value.slice(0, 20) + '...' : step.value;
        return `Type "${preview}"`;
      }
      return step.target ? `Type in ${step.target}` : 'Enter text';
    
    case 'select':
      return step.value ? `Select "${step.value}"` : 'Select option';
    
    case 'hover':
      return step.target || 'Hover over element';
    
    case 'wait':
      return `Wait ${step.waitTime || 1000}ms`;
    
    case 'wait_for_element':
      return step.target || 'Wait for element';
    
    case 'assert':
    case 'verify':
      return step.expectedResult || 'Verify condition';
    
    case 'api':
      return `${step.method || 'GET'} ${step.endpoint || 'API call'}`;
    
    case 'db_query':
      return 'Execute database query';
    
    case 'screenshot':
      return 'Take screenshot';
    
    default:
      return step.description || '';
  }
}

/**
 * Generate synthetic test data based on field name/type
 */
function generateTestValue(fieldNameOrTarget: string): string {
  const text = fieldNameOrTarget.toLowerCase();
  
  // Common test data patterns
  const testData: Record<string, () => string> = {
    email: () => `test.user${Math.floor(Math.random() * 10000)}@example.com`,
    phone: () => `555-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
    firstName: () => ['John', 'Jane', 'Alex', 'Sam', 'Taylor'][Math.floor(Math.random() * 5)],
    lastName: () => ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][Math.floor(Math.random() * 5)],
    fullName: () => `${testData.firstName()} ${testData.lastName()}`,
    password: () => 'Test@1234!',
    company: () => ['Acme Corp', 'Tech Solutions', 'Global Inc', 'Digital Labs'][Math.floor(Math.random() * 4)],
    street: () => `${Math.floor(Math.random() * 9999)} Main Street`,
    city: () => ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][Math.floor(Math.random() * 5)],
    state: () => ['CA', 'TX', 'NY', 'FL', 'IL'][Math.floor(Math.random() * 5)],
    zipCode: () => `${Math.floor(Math.random() * 90000 + 10000)}`,
    date: () => new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    number: () => `${Math.floor(Math.random() * 1000)}`,
    text: () => ['Test input', 'Sample data', 'Example text'][Math.floor(Math.random() * 3)],
  };
  
  // Match field patterns
  if (/email/.test(text)) return testData.email();
  if (/phone|tel|mobile/.test(text)) return testData.phone();
  if (/first\s*name|fname/.test(text)) return testData.firstName();
  if (/last\s*name|lname/.test(text)) return testData.lastName();
  if (/name/.test(text) && !/user|company/.test(text)) return testData.fullName();
  if (/password|pwd/.test(text)) return testData.password();
  if (/company|org|business/.test(text)) return testData.company();
  if (/street|address/.test(text)) return testData.street();
  if (/city/.test(text)) return testData.city();
  if (/state|province/.test(text)) return testData.state();
  if (/zip|postal/.test(text)) return testData.zipCode();
  if (/date|dob|birth/.test(text)) return testData.date();
  if (/amount|price|number/.test(text)) return testData.number();
  
  return testData.text();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedWorkflowEditor() {
  const [searchParams] = useSearchParams();
  
  // Test case state
  const [testCase, setTestCase] = useState<UnifiedTestCase>(() => ({
    id: `tc_${Date.now()}`,
    name: 'New Test Case',
    description: '',
    tags: [],
    preconditions: [], // Test cases to run before this one
    steps: [],
    variables: [],
    settings: {
      timeout: 30000,
      retries: 0,
      parallelizable: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  }));
  
  // UI state
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('no-code');
  const [exportMode, setExportMode] = useState<ExportMode>('automation');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [showBlackbox, setShowBlackbox] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['ui', 'verify']);
  
  // Saved state - tracks if this test case exists in backend
  const [savedTestCaseId, setSavedTestCaseId] = useState<string | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  
  // Import test case as precondition
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [availableTestCases, setAvailableTestCases] = useState<Array<{ id: string; name: string; description?: string; steps?: number }>>([]);
  const [importLoading, setImportLoading] = useState(false);
  
  // Format view dialog (ISTQB/Gherkin)
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'istqb' | 'gherkin' | 'markdown'>('istqb');
  
  // Execution state
  const [executionResult, setExecutionResult] = useState<{
    status: 'idle' | 'running' | 'passed' | 'failed';
    currentStep: number;
    results: { stepId: string; status: string; duration?: number; error?: string }[];
    logs: string[];
  }>({
    status: 'idle',
    currentStep: 0,
    results: [],
    logs: [],
  });

  // Test history
  const [testHistory, setTestHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('unified_test_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Selected step
  const selectedStep = testCase.steps.find(s => s.id === selectedStepId);

  // Load from URL params or localStorage
  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(data));
        console.log('[Builder] Loading from URL data:', parsed);
        if (parsed.events || parsed.steps || parsed.nodes) {
          let steps: TestStep[] = [];
          
          if (parsed.events) {
            steps = convertRecordedEvents(parsed.events, parsed.startUrl);
          } else if (parsed.nodes) {
            steps = convertWorkflowNodes(parsed.nodes, parsed.startUrl);
          } else if (parsed.steps) {
            steps = parsed.steps.map(convertWorkflowStep);
          }
          
          console.log('[Builder] Converted steps:', steps.length);
          
          setTestCase(prev => ({
            ...prev,
            name: parsed.name || parsed.workflowName || parsed.title || 'Recorded Test',
            description: parsed.description || '',
            steps,
            settings: {
              ...prev.settings,
              baseUrl: parsed.startUrl || parsed.baseUrl || '',
            },
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
          const parsed = JSON.parse(saved);
          console.log('[Builder] Loading from localStorage:', parsed.steps?.length, 'steps');
          setTestCase(parsed);
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      }
    }
  }, [searchParams]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('unified_test_case', JSON.stringify(testCase));
  }, [testCase]);

  // Save history
  useEffect(() => {
    localStorage.setItem('unified_test_history', JSON.stringify(testHistory));
  }, [testHistory]);

  // Convert recorded events to steps (from raw events)
  const convertRecordedEvents = (events: any[], startUrl?: string): TestStep[] => {
    console.log('[Builder] Converting events:', events.length, 'startUrl:', startUrl);
    const steps: TestStep[] = [];
    
    // Always add navigate step first if we have a URL
    if (startUrl) {
      steps.push({
        id: `step_${Date.now()}_nav`,
        type: 'navigate',
        name: 'Open Application',
        url: startUrl,
        enabled: true,
        expectedResult: 'Page loads successfully',
      });
    }
    
    // Convert ALL events - no limit
    events.forEach((event, idx) => {
      const step: TestStep = {
        id: `step_${Date.now()}_${idx}`,
        type: mapEventType(event.type),
        name: generateStepName(event),
        selector: event.selector,
        value: event.value,
        target: extractTargetName(event.selector, event),
        enabled: true,
        expectedResult: generateExpectedResult(event),
      };
      steps.push(step);
    });
    
    console.log('[Builder] Converted to steps:', steps.length);
    return steps;
  };

  // Convert workflow nodes (from sidepanel)
  const convertWorkflowNodes = (nodes: any[], startUrl?: string): TestStep[] => {
    console.log('[Builder] Converting nodes:', nodes.length, 'startUrl:', startUrl);
    const steps: TestStep[] = [];
    
    // Add navigate step first if we have a URL
    if (startUrl) {
      steps.push({
        id: `step_${Date.now()}_nav`,
        type: 'navigate',
        name: 'Open Application',
        url: startUrl,
        enabled: true,
        expectedResult: 'Page loads successfully',
      });
    }
    
    // Convert ALL nodes - no limit
    nodes.forEach((node, idx) => {
      const nodeData = node.data || node;
      const step: TestStep = {
        id: node.id || `step_${Date.now()}_${idx}`,
        type: mapEventType(node.type || nodeData.type || 'click'),
        name: node.label || nodeData.label || generateNodeName(node),
        selector: nodeData.selector || node.selector,
        value: nodeData.value || node.value,
        url: nodeData.url || node.url,
        target: extractTargetName(nodeData.selector || node.selector, nodeData),
        enabled: true,
        expectedResult: nodeData.manualStep?.expectedResult || nodeData.expectedResult || '',
        assertion: nodeData.assertion,
      };
      steps.push(step);
    });
    
    console.log('[Builder] Converted nodes to steps:', steps.length);
    return steps;
  };

  const generateNodeName = (node: any): string => {
    const nodeData = node.data || node;
    const type = node.type || nodeData.type || 'click';
    
    if (type === 'navigate') return 'Navigate';
    if (type === 'input' || type === 'fill') {
      const val = nodeData.value || node.value || '';
      return `Enter "${val.slice(0, 15)}${val.length > 15 ? '...' : ''}"`;
    }
    if (type === 'click') {
      const target = extractTargetName(nodeData.selector || node.selector, nodeData);
      return target ? `Click "${target}"` : 'Click element';
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const mapEventType = (type: string): StepType => {
    const map: Record<string, StepType> = {
      'click': 'click',
      'input': 'input',
      'type': 'input',
      'fill': 'input',
      'select': 'select',
      'navigate': 'navigate',
      'goto': 'navigate',
      'wait': 'wait',
      'assert': 'assert',
      'hover': 'hover',
    };
    return map[type] || 'click';
  };

  const generateStepName = (event: any): string => {
    const type = event.type || 'click';
    if (type === 'input' || type === 'fill') {
      const val = event.value || '';
      return `Enter "${val.slice(0, 15)}${val.length > 15 ? '...' : ''}"`;
    }
    if (type === 'click') {
      const text = event.element?.textContent || event.text || '';
      if (text) return `Click "${text.slice(0, 20)}"`;
      const target = extractTargetName(event.selector, event);
      if (target) return `Click "${target}"`;
      return 'Click element';
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const generateExpectedResult = (event: any): string => {
    const type = event.type || 'click';
    if (type === 'click') return 'Element is clicked successfully';
    if (type === 'input') return 'Text is entered in the field';
    if (type === 'navigate') return 'Page navigates successfully';
    return '';
  };

  const convertWorkflowStep = (node: any): TestStep => ({
    id: node.id || `step_${Date.now()}`,
    type: mapEventType(node.type || 'click'),
    name: node.label || node.name || 'Step',
    selector: node.data?.selector || node.selector,
    value: node.data?.value || node.value,
    url: node.data?.url || node.url,
    target: extractTargetName(node.data?.selector || node.selector, node.data),
    enabled: true,
    expectedResult: node.data?.manualStep?.expectedResult || node.expectedResult || '',
    assertion: node.data?.assertion,
  });

  // Step operations
  const addStep = (type: StepType) => {
    const info = getStepInfo(type);
    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      type,
      name: info.label,
      enabled: true,
      expectedResult: '',
    };
    
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    setSelectedStepId(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<TestStep>) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  };

  const deleteStep = (stepId: string) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    if (selectedStepId === stepId) setSelectedStepId(null);
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    setTestCase(prev => {
      const idx = prev.steps.findIndex(s => s.id === stepId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.steps.length) return prev;
      const newSteps = [...prev.steps];
      [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
      return { ...prev, steps: newSteps, metadata: { ...prev.metadata, updatedAt: new Date().toISOString() } };
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
      return { ...prev, steps: newSteps, metadata: { ...prev.metadata, updatedAt: new Date().toISOString() } };
    });
  };

  // Import module steps
  const handleImportModule = (moduleSteps: ModuleStep[]) => {
    const newSteps = moduleSteps.map((ms, idx) => ({
      id: `step_${Date.now()}_${idx}`,
      type: ms.type as StepType,
      name: ms.label,
      selector: ms.selector,
      value: ms.value,
      waitTime: ms.waitTime,
      target: extractTargetName(ms.selector),
      enabled: true,
      expectedResult: ms.description || '',
    }));
    
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, ...newSteps],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    toast.success(`Imported ${newSteps.length} steps from module`);
  };

  // Blackbox fallback
  const handleBlackboxLocator = (locator: BlackboxLocator, _code: string) => {
    if (selectedStepId) {
      updateStep(selectedStepId, { fallback: locator });
      toast.success(`Fallback strategy added: ${locator.type}`);
    }
    setShowBlackbox(false);
  };

  // Generate code for export
  const generateCode = useCallback((mode: ExportMode): string => {
    const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    
    switch (mode) {
      case 'automation':
        return generateAutomationCode(testCase, safeName);
      case 'api':
        return generateAPICode(testCase, safeName);
      case 'database':
        return generateDBCode(testCase, safeName);
      case 'performance':
        return generatePerformanceCode(testCase, safeName);
      case 'manual':
        return generateManualDoc(testCase);
      default:
        return '';
    }
  }, [testCase]);

  // Run test
  const runTest = async () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to run the test');
      return;
    }

    setIsRunning(true);
    setExecutionResult({ status: 'running', currentStep: 0, results: [], logs: [] });

    try {
      const code = generateCode('automation');
      const response = await fetch('http://localhost:8000/api/flowstral/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: code,
          language: 'python',
          browser: 'chromium',
          headless: false,
          workflow_name: testCase.name.replace(/[^a-z0-9]+/gi, '_'),
        }),
      });

      const responseData = await response.json();
      
      // The backend wraps the result in execution_result
      const result = responseData.execution_result || responseData;
      
      // Get output from stdout or output field
      const fullOutput = result.stdout || result.output || '';
      const logs = fullOutput ? fullOutput.split('\n') : [];
      const stderr = result.stderr || '';
      
      console.log('[Test Run] Response:', responseData);
      console.log('[Test Run] Full stdout:', fullOutput);
      console.log('[Test Run] Stderr:', stderr);
      console.log('[Test Run] Exit code:', result.exit_code, 'Status:', result.status || responseData.status);
      
      // Combine stdout and stderr for error detection
      const allOutput = fullOutput + '\n' + stderr;
      
      // Check exit code - treat undefined as success if status is 'success'
      const exitCode = result.exit_code;
      const isExitCodeFailure = exitCode !== undefined && exitCode !== null && exitCode !== 0;
      
      // More robust failure detection - check exit code AND output for failure markers
      const hasFailureMarker = 
        allOutput.includes('TEST FAILED') || 
        allOutput.includes('FAILED:') ||
        (allOutput.includes('Step') && allOutput.includes('FAILED')) ||
        allOutput.includes('Traceback') ||
        allOutput.includes('Exception:') ||
        allOutput.includes('sys.exit(1)') ||
        allOutput.includes('Error:') ||
        isExitCodeFailure;
        
      const hasSuccessMarker = 
        allOutput.includes('TEST PASSED') || 
        allOutput.includes('All steps completed successfully') ||
        allOutput.includes('Test completed successfully') ||
        ((result.status === 'success' || responseData.status === 'success') && !hasFailureMarker);
      
      // Pass if: success marker AND no explicit failure markers
      const passed = hasSuccessMarker && !hasFailureMarker;
      
      // Extract failure details from logs - check multiple patterns
      let failedStep: number | null = null;
      let errorMessage: string | null = null;
      let screenshotPath: string | null = null;
      
      // Pattern 1: "TEST FAILED at step X" or "FAILED at step X"
      const stepMatch = allOutput.match(/(?:TEST )?FAILED at step (\d+)/i);
      if (stepMatch) {
        failedStep = parseInt(stepMatch[1]);
      }
      
      // Pattern 2: "Step X FAILED:" or "✗ Step X FAILED"
      if (!failedStep) {
        const stepMatch2 = allOutput.match(/Step (\d+).*?FAILED/i);
        if (stepMatch2) {
          failedStep = parseInt(stepMatch2[1]);
        }
      }
      
      // Pattern 3: Look for "failed_step" in output
      if (!failedStep) {
        const stepMatch3 = allOutput.match(/failed_step['":\s]+(\d+)/i);
        if (stepMatch3) {
          failedStep = parseInt(stepMatch3[1]);
        }
      }
      
      // Extract error message - look for multiple patterns
      const errorPatterns = [
        /Error:\s*(.+?)(?:\n|$)/,
        /Exception:\s*(.+?)(?:\n|$)/,
        /error_message['":\s]+['"]?([^'"}\n]+)/,
        /TimeoutError:\s*(.+?)(?:\n|$)/,
        /playwright\._impl\._errors\.(\w+Error):\s*(.+?)(?:\n|$)/,
      ];
      
      for (const pattern of errorPatterns) {
        const match = allOutput.match(pattern);
        if (match) {
          errorMessage = match[2] || match[1];
          break;
        }
      }
      
      // Extract screenshot path
      const screenshotMatch = allOutput.match(/Screenshot(?:\ssaved)?:\s*(.+\.png)/i);
      if (screenshotMatch) {
        screenshotPath = screenshotMatch[1].trim();
      }
      
      // If we detected a failure but couldn't find the step, default to 1
      if (!passed && !failedStep && !hasSuccessMarker) {
        failedStep = 1; // Assume first step failed if we can't determine
      }
      
      // If no error message but we have Traceback, try to extract it
      if (!errorMessage && allOutput.includes('Traceback')) {
        const lines = allOutput.split('\n');
        const lastLine = lines.filter(l => l.trim() && !l.startsWith(' ')).pop();
        if (lastLine && lastLine.includes('Error')) {
          errorMessage = lastLine;
        }
      }
      
      console.log('[Test Run] Detected - passed:', passed, 'failedStep:', failedStep, 'error:', errorMessage);
      
      // Combine logs for display
      const allLogs = [...logs];
      if (stderr) {
        allLogs.push('--- STDERR ---');
        allLogs.push(...stderr.split('\n'));
      }
      
      setExecutionResult(prev => ({
        ...prev,
        status: passed ? 'passed' : 'failed',
        logs: allLogs,
        currentStep: failedStep || (passed ? testCase.steps.length : 1),
        results: testCase.steps.map((step, idx) => ({
          stepId: step.id,
          status: passed ? 'passed' : (failedStep && idx + 1 >= failedStep ? 'failed' : 'passed'),
          error: failedStep && idx + 1 === failedStep ? errorMessage || undefined : undefined,
        })),
      }));

      // Save to history with more details
      const runId = `run_${Date.now()}`;
      const historyEntry = {
        id: runId,
        testName: testCase.name,
        status: passed ? 'passed' : 'failed',
        timestamp: new Date().toISOString(),
        duration: result.duration || 0,
        steps: testCase.steps.length,
        failedStep: passed ? null : failedStep,
        errorMessage: passed ? null : (errorMessage?.slice(0, 100) || 'Check logs for details'),
        screenshotPath,
        logs: logs.slice(-10), // Store last 10 log lines
      };
      setTestHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
      
      // Push to results ingestion service for dashboard
      const runData: TestRunData = {
        run_id: runId,
        org_id: 'local',
        project_id: 'unified-builder',
        test_name: testCase.name,
        test_cases: testCase.steps.map((step, idx) => ({
          case_id: step.id,
          status: passed ? 'passed' : (failedStep && idx + 1 >= failedStep ? 'failed' : 'passed') as 'passed' | 'failed' | 'skipped',
          duration: Math.round((result.duration || 0) / testCase.steps.length),
          error: failedStep && idx + 1 === failedStep ? errorMessage || undefined : undefined,
          step_number: idx + 1,
        })),
        metadata: {
          environment: 'local',
          browser: 'chromium',
          timestamp: new Date().toISOString(),
          duration: result.duration || 0,
          failed_step: failedStep || undefined,
          error_message: errorMessage || undefined,
          screenshot_path: screenshotPath || undefined,
        }
      };
      resultsIngestionService.ingestResults(runData);

      if (passed) {
        toast.success('✅ Test passed!');
      } else {
        const stepInfo = failedStep ? `step ${failedStep}` : 'test';
        const errorInfo = errorMessage?.slice(0, 40) || 'Check logs';
        toast.error(`❌ Failed at ${stepInfo}: ${errorInfo}`);
      }
    } catch (error) {
      setExecutionResult(prev => ({ ...prev, status: 'failed', logs: ['Execution error'] }));
      toast.error('Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Build test case data for API
  const buildTestCaseData = (name?: string) => ({
    title: name || testCase.name,
    name: name || testCase.name,
    description: testCase.description,
    test_type: 'unified',
    steps: testCase.steps.map((s, i) => ({
      step_number: i + 1,
      action: s.name,
      expected_result: s.expectedResult || '',
      assertion_type: s.assertionType || null,
      assertion_target: s.assertionTarget || null,
      assertion_value: s.assertionValue || null,
      test_data: JSON.stringify(s),
    })),
    tags: testCase.tags,
    unified_data: JSON.stringify(testCase),
  });

  // Save test case - update if exists, create if new
  const saveTestCase = async () => {
    try {
      const testCaseData = buildTestCaseData();
      
      if (savedTestCaseId) {
        // Update existing test case
        const response = await fetch(`http://localhost:8000/test-cases/${savedTestCaseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCaseData),
        });
        
        if (response.ok) {
          toast.success('✅ Test case updated');
        } else {
          toast.error('Failed to update');
        }
      } else {
        // Create new test case
        const response = await fetch('http://localhost:8000/test-cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCaseData),
        });

        if (response.ok) {
          const data = await response.json();
          setSavedTestCaseId(data.id);
          toast.success('✅ Test case saved');
        } else {
          toast.error('Failed to save');
        }
      }
    } catch (error) {
      console.error('[Save] Error:', error);
      toast.error('Failed to save');
    }
  };
  
  // Save As - always create new with different name
  const saveTestCaseAs = async (newName: string) => {
    try {
      const testCaseData = buildTestCaseData(newName);
      
      const response = await fetch('http://localhost:8000/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCaseData),
      });

      if (response.ok) {
        const data = await response.json();
        // Update current test case name and ID
        setTestCase(prev => ({ ...prev, name: newName }));
        setSavedTestCaseId(data.id);
        toast.success(`✅ Saved as "${newName}"`);
        setShowSaveAsDialog(false);
        setSaveAsName('');
      } else {
        toast.error('Failed to save');
      }
    } catch (error) {
      console.error('[SaveAs] Error:', error);
      toast.error('Failed to save');
    }
  };
  
  // Load available test cases for import
  const loadAvailableTestCases = async () => {
    setImportLoading(true);
    try {
      const response = await fetch('http://localhost:8000/test-cases?limit=100');
      if (response.ok) {
        const data = await response.json();
        // Filter out current test case and format the list
        const testCases = (Array.isArray(data) ? data : [])
          .filter((tc: any) => tc.id !== testCase.id && tc.id !== savedTestCaseId)
          .map((tc: any) => ({
            id: tc.id,
            name: tc.name || tc.title || 'Unnamed Test',
            description: tc.description,
            steps: tc.steps?.length || 0,
          }));
        setAvailableTestCases(testCases);
      }
    } catch (error) {
      console.error('[Import] Error loading test cases:', error);
      toast.error('Failed to load test cases');
    } finally {
      setImportLoading(false);
    }
  };
  
  // Add test case as precondition
  const addPrecondition = (testCaseId: string, testCaseName: string) => {
    // Check if already added
    if (testCase.preconditions?.some(p => p.testCaseId === testCaseId)) {
      toast.error('Test case already added as precondition');
      return;
    }
    
    setTestCase(prev => ({
      ...prev,
      preconditions: [
        ...(prev.preconditions || []),
        { testCaseId, testCaseName, enabled: true }
      ],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    toast.success(`Added "${testCaseName}" as precondition`);
  };
  
  // Remove precondition
  const removePrecondition = (testCaseId: string) => {
    setTestCase(prev => ({
      ...prev,
      preconditions: (prev.preconditions || []).filter(p => p.testCaseId !== testCaseId),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  };
  
  // Toggle precondition enabled
  const togglePrecondition = (testCaseId: string) => {
    setTestCase(prev => ({
      ...prev,
      preconditions: (prev.preconditions || []).map(p => 
        p.testCaseId === testCaseId ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  // Generate test data for all input steps
  const generateAllTestData = () => {
    let count = 0;
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.type === 'input' && !step.value) {
          count++;
          return {
            ...step,
            value: generateTestValue(step.name || step.target || 'text')
          };
        }
        return step;
      }),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    if (count > 0) {
      toast.success(`Generated test data for ${count} input fields`);
    } else {
      toast.info('No empty input fields to fill');
    }
  };

  // Export handler
  const handleExport = (mode: ExportMode) => {
    const code = generateCode(mode);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const ext = mode === 'manual' ? 'md' : mode === 'performance' ? 'js' : 'py';
    a.download = `${testCase.name.replace(/[^a-z0-9]+/gi, '_')}_${mode}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${mode}`);
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="flex-none border-b bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg gradient-primary shadow-lg">
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
                  <span>v{testCase.metadata.version}</span>
                </div>
              </div>
            </div>

            {/* Center: View Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === 'no-code' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('no-code')}
                  className={viewMode === 'no-code' ? 'gradient-primary text-white' : ''}
                >
                  <ToggleLeft className="h-4 w-4 mr-1" />
                  No-Code
                </Button>
                <Button
                  variant={viewMode === 'code' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('code')}
                  className={viewMode === 'code' ? 'gradient-primary text-white' : ''}
                >
                  <Code className="h-4 w-4 mr-1" />
                  Code
                </Button>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="h-4 w-4" />
              </Button>
              
              {/* Generate Test Data */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={generateAllTestData}
                title="Generate test data for all input fields"
              >
                <Zap className="h-4 w-4 mr-1" />
                Fill Data
              </Button>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export As</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport('automation')}>
                    <Monitor className="h-4 w-4 mr-2" />
                    Automation Test
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('api')}>
                    <Globe className="h-4 w-4 mr-2" />
                    API Test
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('database')}>
                    <Database className="h-4 w-4 mr-2" />
                    Database Test
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('performance')}>
                    <Gauge className="h-4 w-4 mr-2" />
                    Performance Test
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport('manual')}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Manual Test Doc
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">View Formats</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => {
                    setSelectedFormat('istqb');
                    setShowFormatDialog(true);
                  }}>
                    📋 ISTQB Format
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedFormat('gherkin');
                    setShowFormatDialog(true);
                  }}>
                    🥒 Gherkin/BDD Format
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedFormat('markdown');
                    setShowFormatDialog(true);
                  }}>
                    📝 Markdown Format
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-1" />
                    Save
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={saveTestCase}>
                    <Save className="h-4 w-4 mr-2" />
                    {savedTestCaseId ? 'Save (Update)' : 'Save'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSaveAsName(testCase.name + ' - Copy');
                    setShowSaveAsDialog(true);
                  }}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Save As...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                Run
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Step Types */}
          <aside className="w-56 flex-none border-r bg-card overflow-y-auto">
            <div className="p-3 space-y-2">
              {/* Quick Actions */}
              <div className="flex gap-1 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowModules(true)}
                >
                  <Package className="h-3 w-3 mr-1" />
                  Modules
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => window.open('/flowstral', '_blank')}
                >
                  <Video className="h-3 w-3 mr-1" />
                  Record
                </Button>
              </div>

              {/* Step Categories */}
              {Object.entries(STEP_CATEGORIES).map(([key, category]) => (
                <Collapsible
                  key={key}
                  open={expandedCategories.includes(key)}
                  onOpenChange={(open) => {
                    setExpandedCategories(prev => 
                      open ? [...prev, key] : prev.filter(k => k !== key)
                    );
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                      {category.label}
                      <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategories.includes(key) ? 'rotate-90' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-1">
                    {category.steps.map((step) => (
                      <Button
                        key={step.type}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start pl-4 text-xs"
                        onClick={() => addStep(step.type as StepType)}
                      >
                        <div className={`p-1 rounded mr-2 ${step.color}`}>
                          <step.icon className="h-3 w-3" />
                        </div>
                        {step.label}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {/* Execution Status & Results */}
              {executionResult.status !== 'idle' && (
                <div className={`mt-4 p-3 rounded-lg border ${
                  executionResult.status === 'passed' ? 'bg-green-50 border-green-200' :
                  executionResult.status === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    {executionResult.status === 'running' && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
                    {executionResult.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {executionResult.status === 'failed' && <AlertCircle className="h-4 w-4 text-red-600" />}
                    <span className={
                      executionResult.status === 'passed' ? 'text-green-700' :
                      executionResult.status === 'failed' ? 'text-red-700' :
                      'text-blue-700'
                    }>
                      {executionResult.status === 'running' ? 'Running...' :
                       executionResult.status === 'passed' ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                  {executionResult.status === 'failed' && executionResult.currentStep && (
                    <div className="text-xs text-red-600 mb-2">
                      Failed at step {executionResult.currentStep}
                    </div>
                  )}
                  {executionResult.logs.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View logs ({executionResult.logs.filter(l => l.trim()).length} lines)
                      </summary>
                      <div className="mt-2 max-h-32 overflow-auto bg-slate-900 text-slate-100 p-2 rounded font-mono text-[10px]">
                        {executionResult.logs.slice(-20).map((line, i) => (
                          <div key={i} className={
                            line.includes('FAILED') || line.includes('Error') ? 'text-red-400' :
                            line.includes('PASSED') || line.includes('✓') ? 'text-green-400' :
                            ''
                          }>{line}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Test Run History */}
              {testHistory.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                    <span>Recent Runs</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 text-xs px-1"
                      onClick={() => setTestHistory([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {testHistory.slice(0, 5).map((run) => (
                      <div 
                        key={run.id} 
                        className={`p-2 rounded text-xs border ${
                          run.status === 'passed' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {run.status === 'passed' 
                              ? <CheckCircle className="h-3 w-3 text-green-600" />
                              : <AlertCircle className="h-3 w-3 text-red-600" />
                            }
                            <span className="font-medium truncate max-w-[100px]">
                              {run.testName?.slice(0, 15) || 'Test'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(run.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {run.status === 'failed' && run.failedStep && (
                          <div className="text-[10px] text-red-600 mt-1 truncate">
                            Step {run.failedStep}: {run.errorMessage?.slice(0, 30) || 'Error'}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Center: Steps List or Code View */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {viewMode === 'no-code' ? (
              <div className="flex-1 overflow-y-auto p-4">
                {testCase.steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Layers className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">Start building your test</h3>
                    <p className="text-sm mb-4">Add steps from the left panel or record from browser</p>
                    <div className="flex gap-2">
                      <Button onClick={() => addStep('navigate')} variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                      <Button onClick={() => window.open('/flowstral', '_blank')} className="gradient-primary text-white">
                        <Video className="h-4 w-4 mr-1" />
                        Record
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Preconditions Section */}
                    {(testCase.preconditions?.length > 0 || true) && (
                      <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FolderPlus className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              Preconditions (Run First)
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              loadAvailableTestCases();
                              setShowImportDialog(true);
                            }}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Import Test Case
                          </Button>
                        </div>
                        
                        {testCase.preconditions?.length > 0 ? (
                          <div className="space-y-1">
                            {testCase.preconditions.map((precond, idx) => (
                              <div 
                                key={precond.testCaseId} 
                                className={`flex items-center justify-between p-2 rounded-md ${
                                  precond.enabled ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-900 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                                  <input
                                    type="checkbox"
                                    checked={precond.enabled}
                                    onChange={() => togglePrecondition(precond.testCaseId)}
                                    className="h-4 w-4"
                                  />
                                  <span className={`text-sm ${!precond.enabled && 'line-through text-muted-foreground'}`}>
                                    {precond.testCaseName}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removePrecondition(precond.testCaseId)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No preconditions. Import existing test cases to run before this test.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Test Steps */}
                    <div className="space-y-2">
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
                          executionStatus={executionResult.results.find(r => r.stepId === step.id)?.status}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Code View */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-none px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(['automation', 'api', 'database', 'performance', 'manual'] as ExportMode[]).map(mode => (
                      <Button
                        key={mode}
                        variant={exportMode === mode ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setExportMode(mode)}
                        className={exportMode === mode ? 'bg-primary text-white' : ''}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
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
                  <pre className="p-4 text-sm font-mono bg-slate-900 text-slate-100 min-h-full whitespace-pre-wrap">
                    {generateCode(exportMode)}
                  </pre>
                </div>
              </div>
            )}
          </main>

          {/* Right Panel: Step Editor */}
          {selectedStep && viewMode === 'no-code' && (
            <aside className="w-80 flex-none border-l bg-card overflow-y-auto">
              <StepEditor
                step={selectedStep}
                onUpdate={(updates) => updateStep(selectedStep.id, updates)}
                onClose={() => setSelectedStepId(null)}
                onShowBlackbox={() => setShowBlackbox(true)}
              />
            </aside>
          )}
        </div>

        {/* Modules Dialog */}
        <Dialog open={showModules} onOpenChange={setShowModules}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Reusable Modules</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <ReusableModulesManager
                currentNodes={testCase.steps.map(s => ({ ...s, data: s }))}
                appType="generic"
                onImportModule={handleImportModule}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Blackbox Strategies Dialog */}
        <Dialog open={showBlackbox} onOpenChange={setShowBlackbox}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Fallback Locator Strategy</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <BlackboxLocatorStrategies
                onLocatorSelected={handleBlackboxLocator}
                framework="playwright-python"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={testCase.settings.baseUrl || ''}
                  onChange={(e) => setTestCase(prev => ({
                    ...prev,
                    settings: { ...prev.settings, baseUrl: e.target.value }
                  }))}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={testCase.settings.timeout}
                  onChange={(e) => setTestCase(prev => ({
                    ...prev,
                    settings: { ...prev.settings, timeout: parseInt(e.target.value) }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Retries</Label>
                <Input
                  type="number"
                  value={testCase.settings.retries}
                  onChange={(e) => setTestCase(prev => ({
                    ...prev,
                    settings: { ...prev.settings, retries: parseInt(e.target.value) }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={testCase.description}
                  onChange={(e) => setTestCase(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this test verify?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSettings(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Save As Dialog */}
        <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save As New Test Case</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test Case Name</Label>
                <Input
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="Enter new test case name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveAsDialog(false)}>Cancel</Button>
              <Button 
                onClick={() => saveTestCaseAs(saveAsName)}
                disabled={!saveAsName.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Import Test Case Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-amber-500" />
                Import Test Case as Precondition
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Select test cases to run before this test. They will execute in order as setup steps.
            </p>
            <div className="flex-1 overflow-y-auto border rounded-md">
              {importLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                  Loading test cases...
                </div>
              ) : availableTestCases.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No saved test cases found.</p>
                  <p className="text-xs mt-1">Save some test cases first to import them here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableTestCases.map(tc => (
                    <div 
                      key={tc.id}
                      className="p-3 hover:bg-muted/50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tc.name}</div>
                        {tc.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{tc.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {tc.steps || 0} steps
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          addPrecondition(tc.id, tc.name);
                        }}
                        disabled={testCase.preconditions?.some(p => p.testCaseId === tc.id)}
                      >
                        {testCase.preconditions?.some(p => p.testCaseId === tc.id) ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Format View Dialog (ISTQB/Gherkin) */}
        <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Test Case Documentation
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-2">
              {(['istqb', 'gherkin', 'markdown'] as const).map(fmt => (
                <Button
                  key={fmt}
                  size="sm"
                  variant={selectedFormat === fmt ? 'default' : 'outline'}
                  onClick={() => setSelectedFormat(fmt)}
                >
                  {fmt === 'istqb' ? '📋 ISTQB' : fmt === 'gherkin' ? '🥒 Gherkin' : '📝 Markdown'}
                </Button>
              ))}
            </div>
            <div className="flex-1 overflow-auto border rounded-md p-4 bg-muted/30">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {selectedFormat === 'istqb' 
                  ? generateISTQBFormat(testCase)
                  : selectedFormat === 'gherkin'
                  ? generateGherkinFormat(testCase)
                  : generateMarkdownFormat(testCase)
                }
              </pre>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  const content = selectedFormat === 'istqb' 
                    ? generateISTQBFormat(testCase)
                    : selectedFormat === 'gherkin'
                    ? generateGherkinFormat(testCase)
                    : generateMarkdownFormat(testCase);
                  navigator.clipboard.writeText(content);
                  toast.success('Copied to clipboard!');
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button onClick={() => setShowFormatDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// ============================================================================
// STEP CARD COMPONENT - No-Code Friendly
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
  executionStatus?: string;
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
  executionStatus,
}: StepCardProps) {
  const info = getStepInfo(step.type);
  
  // Get human-readable description (NO selectors shown)
  const description = getStepDescription(step);

  return (
    <div
      className={`group relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-primary bg-primary/5 border-primary'
          : executionStatus === 'passed'
          ? 'bg-green-50 border-green-200'
          : executionStatus === 'failed'
          ? 'bg-red-50 border-red-200'
          : 'bg-card hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      {/* Step Number & Icon */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${info.color}`}>
          {index + 1}
        </div>
        {!isLast && <div className="w-0.5 h-4 bg-border mt-1" />}
      </div>

      {/* Content - NO CODE/SELECTOR shown */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <info.icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{step.name}</span>
          {!step.enabled && (
            <Badge variant="secondary" className="text-xs">Disabled</Badge>
          )}
          {step.fallback && (
            <Badge variant="outline" className="text-xs bg-amber-50">
              <Wand2 className="h-3 w-3 mr-1" />
              Fallback
            </Badge>
          )}
          {step.assertion?.enabled && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Assert
            </Badge>
          )}
        </div>
        {/* Show human-readable description, not selector */}
        {description && (
          <div className="text-sm text-muted-foreground mt-1">
            {description}
          </div>
        )}
        {step.expectedResult && (
          <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {step.expectedResult.slice(0, 60)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={isFirst}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={isLast}>
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
            <DropdownMenuItem onClick={() => onUpdate({ enabled: !step.enabled })}>
              {step.enabled ? <><EyeOff className="h-4 w-4 mr-2" />Disable</> : <><Eye className="h-4 w-4 mr-2" />Enable</>}
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
// STEP EDITOR COMPONENT - Shows technical details only when editing
// ============================================================================

// ============================================================================
// ASSERTION BUILDER HELPERS
// ============================================================================

function getAssertionSuggestions(stepType: StepType, assertionType: string) {
  const suggestions: Record<string, { expectedResult: string }> = {
    element_visible: { expectedResult: 'Element should be visible on the page' },
    element_hidden: { expectedResult: 'Element should not be visible' },
    text_contains: { expectedResult: 'Text should contain the expected value' },
    text_equals: { expectedResult: 'Text should match exactly' },
    url_contains: { expectedResult: 'URL should contain the expected path' },
    url_equals: { expectedResult: 'URL should match exactly' },
    value_equals: { expectedResult: 'Input value should match' },
    element_enabled: { expectedResult: 'Element should be enabled and interactive' },
    element_disabled: { expectedResult: 'Element should be disabled' },
    count_equals: { expectedResult: 'Number of matching elements should equal expected count' },
    page_title: { expectedResult: 'Page title should match' },
    toast_message: { expectedResult: 'Toast/notification should appear with message' },
  };
  return suggestions[assertionType] || { expectedResult: '' };
}

function generateExpectedResultText(assertionType: string, value: string, target?: string): string {
  const targetText = target ? ` for "${target}"` : '';
  
  switch (assertionType) {
    case 'element_visible':
      return `Element${targetText} should be visible`;
    case 'element_hidden':
      return `Element${targetText} should be hidden`;
    case 'text_contains':
      return `Text should contain "${value}"${targetText}`;
    case 'text_equals':
      return `Text should equal "${value}"${targetText}`;
    case 'url_contains':
      return `URL should contain "${value}"`;
    case 'url_equals':
      return `URL should be "${value}"`;
    case 'value_equals':
      return `Input value should be "${value}"${targetText}`;
    case 'element_enabled':
      return `Element${targetText} should be enabled`;
    case 'element_disabled':
      return `Element${targetText} should be disabled`;
    case 'count_equals':
      return `Should find exactly ${value} matching elements`;
    case 'page_title':
      return `Page title should be "${value}"`;
    case 'toast_message':
      return `Should see message: "${value}"`;
    case 'attribute_equals':
      return `Attribute should equal "${value}"`;
    default:
      return value;
  }
}

function getQuickSuggestions(stepType: StepType): Array<{ label: string; type: string; expected?: string; text: string }> {
  const baseSuggestions = {
    navigate: [
      { label: 'Page loads', type: 'element_visible', text: 'Page should load successfully' },
      { label: 'URL matches', type: 'url_contains', expected: '/', text: 'URL should be correct' },
      { label: 'Title correct', type: 'page_title', expected: '', text: 'Page title should be correct' },
    ],
    click: [
      { label: 'Element appears', type: 'element_visible', text: 'Expected element should appear after click' },
      { label: 'Page changes', type: 'url_contains', text: 'Should navigate to new page' },
      { label: 'Modal opens', type: 'element_visible', text: 'Modal/dialog should open' },
      { label: 'Success message', type: 'toast_message', expected: 'Success', text: 'Success message should appear' },
    ],
    input: [
      { label: 'Value accepted', type: 'value_equals', text: 'Input should accept the value' },
      { label: 'No errors', type: 'element_hidden', text: 'No validation errors should appear' },
      { label: 'Validation shows', type: 'element_visible', text: 'Validation message should appear' },
    ],
    select: [
      { label: 'Option selected', type: 'value_equals', text: 'Selected option should be set' },
      { label: 'Form updates', type: 'element_visible', text: 'Dependent fields should update' },
    ],
    wait: [
      { label: 'Element ready', type: 'element_visible', text: 'Element should be ready for interaction' },
    ],
    assert: [
      { label: 'Condition met', type: 'custom', text: 'Assertion condition should be true' },
    ],
    api: [
      { label: 'Status 200', type: 'custom', expected: '200', text: 'API should return success status' },
      { label: 'Response valid', type: 'custom', text: 'Response should contain expected data' },
    ],
    db_query: [
      { label: 'Records found', type: 'count_equals', expected: '1', text: 'Query should return expected records' },
      { label: 'Data matches', type: 'custom', text: 'Query results should match expected data' },
    ],
  };
  
  return baseSuggestions[stepType as keyof typeof baseSuggestions] || [
    { label: 'Verify success', type: 'element_visible', text: 'Step should complete successfully' },
  ];
}

interface StepEditorProps {
  step: TestStep;
  onUpdate: (updates: Partial<TestStep>) => void;
  onClose: () => void;
  onShowBlackbox: () => void;
}

function StepEditor({ step, onUpdate, onClose, onShowBlackbox }: StepEditorProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Edit Step</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Step Name */}
      <div className="space-y-2">
        <Label>Step Name</Label>
        <Input
          value={step.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </div>

      {/* Type-specific fields */}
      {step.type === 'navigate' && (
        <div className="space-y-2">
          <Label>URL</Label>
          <Input
            value={step.url || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      )}

      {['click', 'input', 'select', 'hover', 'assert'].includes(step.type) && (
        <>
          {/* Human-readable target name */}
          <div className="space-y-2">
            <Label>Target Element</Label>
            <Input
              value={step.target || ''}
              onChange={(e) => onUpdate({ target: e.target.value })}
              placeholder="e.g., Submit Button, Email Field"
            />
            <p className="text-xs text-muted-foreground">Human-readable name for this element</p>
          </div>
          
          {/* Technical selector - collapsed by default */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  Technical Details
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Selector (for automation)</Label>
                <Textarea
                  value={step.selector || ''}
                  onChange={(e) => onUpdate({ selector: e.target.value })}
                  placeholder="Enter selector..."
                  className="font-mono text-xs"
                  rows={2}
                />
              </div>
              
              {/* Element Index for handling duplicates */}
              {['click', 'input', 'select', 'hover'].includes(step.type) && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Element Index
                    <span className="text-muted-foreground">(for duplicate elements)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={(step as any).elementIndex?.toString() || 'first'}
                      onValueChange={(value) => onUpdate({ 
                        elementIndex: value === 'first' ? undefined : parseInt(value) 
                      } as any)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="First" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First (default)</SelectItem>
                        <SelectItem value="0">1st element</SelectItem>
                        <SelectItem value="1">2nd element</SelectItem>
                        <SelectItem value="2">3rd element</SelectItem>
                        <SelectItem value="3">4th element</SelectItem>
                        <SelectItem value="4">5th element</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      Use when page has multiple matching elements
                    </span>
                  </div>
                </div>
              )}
              
              <Button variant="outline" size="sm" className="w-full" onClick={onShowBlackbox}>
                <Wand2 className="h-4 w-4 mr-1" />
                Add Fallback Strategy
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {step.type === 'input' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Value to Enter</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-primary"
              onClick={() => {
                const generated = generateTestValue(step.name || step.target || '');
                onUpdate({ value: generated });
              }}
            >
              <Zap className="h-3 w-3 mr-1" />
              Generate
            </Button>
          </div>
          <Input
            value={step.value || ''}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Text to enter"
          />
        </div>
      )}

      {step.type === 'wait' && (
        <div className="space-y-2">
          <Label>Wait Time (ms)</Label>
          <Input
            type="number"
            value={step.waitTime || 1000}
            onChange={(e) => onUpdate({ waitTime: parseInt(e.target.value) })}
          />
        </div>
      )}

      {step.type === 'api' && (
        <>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={step.method || 'GET'} onValueChange={(v) => onUpdate({ method: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              value={step.endpoint || ''}
              onChange={(e) => onUpdate({ endpoint: e.target.value })}
              placeholder="/api/users"
            />
          </div>
          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              value={step.body || ''}
              onChange={(e) => onUpdate({ body: e.target.value })}
              placeholder='{"key": "value"}'
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        </>
      )}

      {step.type === 'db_query' && (
        <>
          <div className="space-y-2">
            <Label>Database Type</Label>
            <Select value={step.dbType || 'postgres'} onValueChange={(v) => onUpdate({ dbType: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
                <SelectItem value="salesforce_soql">Salesforce SOQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Query</Label>
            <Textarea
              value={step.query || ''}
              onChange={(e) => onUpdate({ query: e.target.value })}
              placeholder="SELECT * FROM users WHERE id = $1"
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        </>
      )}

      {/* Expected Result with Assertion Builder */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Expected Result & Verification
          </Label>
        </div>
        
        {/* Assertion Type Selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">What do you want to verify?</Label>
          <Select
            value={step.assertion?.type || ''}
            onValueChange={(value) => {
              const suggestions = getAssertionSuggestions(step.type, value);
              onUpdate({ 
                assertion: { 
                  ...step.assertion, 
                  enabled: true, 
                  type: value,
                  target: step.assertion?.target || step.selector || '',
                },
                expectedResult: step.expectedResult || suggestions.expectedResult
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select verification type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="element_visible">✓ Element is visible</SelectItem>
              <SelectItem value="element_hidden">✗ Element is hidden</SelectItem>
              <SelectItem value="text_contains">📝 Text contains...</SelectItem>
              <SelectItem value="text_equals">📝 Text equals exactly...</SelectItem>
              <SelectItem value="url_contains">🔗 URL contains...</SelectItem>
              <SelectItem value="url_equals">🔗 URL equals...</SelectItem>
              <SelectItem value="value_equals">📋 Input value equals...</SelectItem>
              <SelectItem value="element_enabled">✓ Element is enabled</SelectItem>
              <SelectItem value="element_disabled">✗ Element is disabled</SelectItem>
              <SelectItem value="count_equals">🔢 Element count equals...</SelectItem>
              <SelectItem value="attribute_equals">🏷️ Attribute equals...</SelectItem>
              <SelectItem value="page_title">📄 Page title...</SelectItem>
              <SelectItem value="toast_message">💬 Toast/Alert message...</SelectItem>
              <SelectItem value="custom">✏️ Custom verification</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Dynamic fields based on assertion type */}
        {step.assertion?.type && ['text_contains', 'text_equals', 'value_equals', 'url_contains', 'url_equals', 'count_equals', 'page_title', 'toast_message', 'attribute_equals'].includes(step.assertion.type) && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {step.assertion.type === 'count_equals' ? 'Expected count:' : 
               step.assertion.type.includes('url') ? 'Expected URL value:' :
               step.assertion.type === 'page_title' ? 'Expected page title:' :
               step.assertion.type === 'toast_message' ? 'Expected message:' :
               'Expected value:'}
            </Label>
            <Input
              value={step.assertion?.expected || ''}
              onChange={(e) => {
                const newAssertion = { ...step.assertion, expected: e.target.value };
                onUpdate({ 
                  assertion: newAssertion,
                  expectedResult: generateExpectedResultText(step.assertion?.type || '', e.target.value, step.target)
                });
              }}
              placeholder={
                step.assertion.type === 'text_contains' ? 'Text to look for...' :
                step.assertion.type === 'url_contains' ? '/dashboard, /success, etc.' :
                step.assertion.type === 'toast_message' ? 'Success! Account created' :
                'Expected value...'
              }
            />
          </div>
        )}
        
        {/* Target element for certain assertions */}
        {step.assertion?.type && ['element_visible', 'element_hidden', 'text_contains', 'text_equals', 'count_equals', 'attribute_equals'].includes(step.assertion.type) && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Target element (optional):</Label>
            <Input
              value={step.assertion?.target || ''}
              onChange={(e) => onUpdate({ assertion: { ...step.assertion, target: e.target.value } })}
              placeholder={step.selector || 'Leave blank to use step selector'}
            />
          </div>
        )}
        
        {/* Quick suggestion chips based on step type */}
        <div className="flex flex-wrap gap-1">
          {getQuickSuggestions(step.type).map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => {
                onUpdate({
                  assertion: { enabled: true, type: suggestion.type, expected: suggestion.expected },
                  expectedResult: suggestion.text
                });
              }}
              className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-full transition-colors"
            >
              💡 {suggestion.label}
            </button>
          ))}
        </div>
        
        {/* Free-form expected result */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Expected Result (human-readable)</Label>
          <Textarea
            value={step.expectedResult || ''}
            onChange={(e) => onUpdate({ expectedResult: e.target.value })}
            placeholder="Describe what should happen after this step..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

      {/* Store Result */}
      <div className="space-y-2">
        <Label>Store Result As (Variable)</Label>
        <Input
          value={step.storeAs || ''}
          onChange={(e) => onUpdate({ storeAs: e.target.value })}
          placeholder="e.g., response_data"
        />
      </div>
    </div>
  );
}

// ============================================================================
// CODE GENERATION FUNCTIONS
// ============================================================================

function generateAutomationCode(tc: UnifiedTestCase, safeName: string): string {
  let code = `"""
${tc.name}
${tc.description || 'Generated by QAAI Unified Test Builder'}

Tags: ${tc.tags.join(', ') || 'none'}
"""

import sys
import os
import re
import traceback
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

# Test result tracking
test_results = {
    "status": "passed",
    "steps_passed": 0,
    "steps_failed": 0,
    "failed_step": None,
    "error_message": None,
    "screenshot_path": None
}

def test_${safeName}():
    """${tc.description || tc.name}"""
    global test_results
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_default_timeout(30000)  # 30 second timeout
        
        try:
`;

  tc.steps.forEach((step, index) => {
    if (!step.enabled) {
      code += `\n            # Step ${index + 1}: ${step.name} (DISABLED)\n`;
      return;
    }

    // Wrap each step in try/except
    code += `
            # Step ${index + 1}: ${step.name}
            try:
`;

    const indent = '                ';
    
    switch (step.type) {
      case 'navigate':
        code += `${indent}page.goto("${step.url || tc.settings.baseUrl || ''}")\n`;
        code += `${indent}page.wait_for_load_state("domcontentloaded")\n`;
        break;
      case 'click':
        // For elements that might have duplicates
        const clickSelector = convertSelector(step.selector || '');
        const elementIndex = (step as any).elementIndex;
        if (elementIndex !== undefined && elementIndex !== null) {
          // User specified which element to click
          code += `${indent}element = page.${clickSelector}\n`;
          code += `${indent}count = element.count()\n`;
          code += `${indent}if count > 1:\n`;
          code += `${indent}    print(f"Found {count} elements, clicking element ${elementIndex + 1} of {count}")\n`;
          code += `${indent}element.nth(${elementIndex}).click()\n`;
        } else {
          // Default: warn if multiple, click first
          code += `${indent}element = page.${clickSelector}\n`;
          code += `${indent}count = element.count()\n`;
          code += `${indent}if count > 1:\n`;
          code += `${indent}    print(f"⚠️ WARNING: Found {count} matching elements, clicking first one")\n`;
          code += `${indent}    print("   Consider using elementIndex to specify which element")\n`;
          code += `${indent}    element.first.click()\n`;
          code += `${indent}elif count == 1:\n`;
          code += `${indent}    element.click()\n`;
          code += `${indent}else:\n`;
          code += `${indent}    raise Exception("No elements found matching selector")\n`;
        }
        break;
      case 'input':
        code += `${indent}page.${convertSelector(step.selector || '')}.fill("${step.value || ''}")\n`;
        break;
      case 'select':
        code += `${indent}page.${convertSelector(step.selector || '')}.select_option("${step.value || ''}")\n`;
        break;
      case 'hover':
        code += `${indent}page.${convertSelector(step.selector || '')}.hover()\n`;
        break;
      case 'wait':
        code += `${indent}page.wait_for_timeout(${step.waitTime || 1000})\n`;
        break;
      case 'wait_for_element':
        code += `${indent}page.${convertSelector(step.selector || '')}.wait_for(state="visible")\n`;
        break;
      case 'assert':
        code += `${indent}expect(page.${convertSelector(step.selector || '')}).to_be_visible()\n`;
        break;
      case 'screenshot':
        code += `${indent}page.screenshot(path="step_${index + 1}_${safeName}.png")\n`;
        break;
      case 'api':
        code += `${indent}pass  # API call handled separately\n`;
        break;
      default:
        code += `${indent}pass  # Unknown step type\n`;
    }
    
    // Add assertion code if defined
    if (step.assertion?.enabled && step.assertion?.type) {
      code += generateAssertionCode(step.assertion, step, index, indent);
    }

    code += `                test_results["steps_passed"] += 1
                print(f"✓ Step ${index + 1}: ${step.name.replace(/"/g, '\\"')}")
            except Exception as step_error:
                test_results["status"] = "failed"
                test_results["steps_failed"] += 1
                test_results["failed_step"] = ${index + 1}
                test_results["error_message"] = str(step_error)
                
                # Take screenshot on failure
                screenshot_path = f"failure_step_${index + 1}_${safeName}_{'{datetime.now().strftime("%Y%m%d_%H%M%S")}'}.png"
                try:
                    page.screenshot(path=screenshot_path, full_page=True)
                    test_results["screenshot_path"] = screenshot_path
                    print(f"📸 Screenshot saved: {screenshot_path}")
                except:
                    pass
                
                print(f"✗ Step ${index + 1} FAILED: ${step.name.replace(/"/g, '\\"')}")
                print(f"  Error: {step_error}")
                
                # Keep browser open for 5 seconds so user can see the failure
                print("⏳ Keeping browser open for 5 seconds...")
                page.wait_for_timeout(5000)
                raise step_error
`;
  });

  code += `
            print("\\n" + "="*50)
            print("✅ TEST PASSED - All steps completed successfully")
            print("="*50)
            
        except Exception as e:
            print("\\n" + "="*50)
            print(f"❌ TEST FAILED at step {test_results['failed_step']}")
            print(f"Error: {test_results['error_message']}")
            if test_results['screenshot_path']:
                print(f"Screenshot: {test_results['screenshot_path']}")
            print("="*50)
            sys.exit(1)  # Exit with error code
            
        finally:
            browser.close()
    
    return test_results

if __name__ == "__main__":
    result = test_${safeName}()
    print(f"\\nFinal Result: {result['status'].upper()}")
    print(f"Steps Passed: {result['steps_passed']}")
    if result['status'] == 'failed':
        print(f"Failed at Step: {result['failed_step']}")
        sys.exit(1)
`;
  return code;
}

function generateAPICode(tc: UnifiedTestCase, safeName: string): string {
  let code = `"""
${tc.name} - API Test
${tc.description || 'Generated by QAAI'}
"""

import pytest
import requests

BASE_URL = "${tc.settings.baseUrl || 'http://localhost:8000'}"

class Test${safeName.replace(/_/g, '')}:
`;

  const apiSteps = tc.steps.filter(s => s.type === 'api' && s.enabled);
  
  if (apiSteps.length === 0) {
    code += `    def test_placeholder(self):
        """No API steps defined"""
        pass
`;
  } else {
    apiSteps.forEach((step, index) => {
      const stepName = step.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      code += `
    def test_${index + 1}_${stepName}(self):
        """${step.name}"""
        response = requests.${(step.method || 'GET').toLowerCase()}(
            f"{BASE_URL}${step.endpoint || '/'}",
            ${step.body ? `json=${step.body},` : ''}
            headers=${JSON.stringify(step.headers || {})}
        )
        assert response.status_code in [200, 201, 204], f"Expected 2xx, got {response.status_code}"
`;
      if (step.storeAs) {
        code += `        ${step.storeAs} = response.json()\n`;
      }
    });
  }
  
  return code;
}

function generateDBCode(tc: UnifiedTestCase, safeName: string): string {
  let code = `"""
${tc.name} - Database Test
${tc.description || 'Generated by QAAI'}
"""

import pytest
import psycopg2
# from pymongo import MongoClient  # For MongoDB
# from simple_salesforce import Salesforce  # For SOQL

class Test${safeName.replace(/_/g, '')}:
`;

  const dbSteps = tc.steps.filter(s => (s.type === 'db_query' || s.type === 'db_assert') && s.enabled);
  
  if (dbSteps.length === 0) {
    code += `    def test_placeholder(self):
        """No database steps defined"""
        pass
`;
  } else {
    dbSteps.forEach((step, index) => {
      const stepName = step.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      code += `
    def test_${index + 1}_${stepName}(self):
        """${step.name}"""
        # Connection would be configured via environment variables
        query = """${step.query || 'SELECT 1'}"""
        # Execute query and verify results
        # result = cursor.execute(query)
        # assert result is not None
        pass
`;
    });
  }
  
  return code;
}

function generatePerformanceCode(tc: UnifiedTestCase, safeName: string): string {
  return `// K6 Performance Test Script
// ${tc.name}
// ${tc.description || 'Generated by QAAI'}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { browser } from 'k6/experimental/browser';

export const options = {
  scenarios: {
    ui_test: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 50,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    browser_web_vital_lcp: ['p(95)<2500'],
  },
};

export default async function () {
  const page = browser.newPage();
  
  try {
${tc.steps.filter(s => s.enabled).map((step) => {
  if (step.type === 'navigate') return `    await page.goto('${step.url || tc.settings.baseUrl || ''}');`;
  if (step.type === 'click' && step.selector) return `    await page.locator('${step.selector}').click();`;
  if (step.type === 'input' && step.selector) return `    await page.locator('${step.selector}').fill('${step.value || ''}');`;
  return '';
}).filter(Boolean).join('\n')}
  } finally {
    page.close();
  }
  
  sleep(1);
}
`;
}

function generateManualDoc(tc: UnifiedTestCase): string {
  let doc = `# ${tc.name}\n\n`;
  doc += `**Description:** ${tc.description || 'N/A'}\n\n`;
  doc += `**Tags:** ${tc.tags.join(', ') || 'None'}\n\n`;
  doc += `**Timeout:** ${tc.settings.timeout}ms\n\n`;
  doc += `---\n\n`;
  doc += `## Test Steps\n\n`;
  
  tc.steps.forEach((step, index) => {
    if (!step.enabled) {
      doc += `### ~~Step ${index + 1}: ${step.name}~~ (Disabled)\n\n`;
      return;
    }
    
    doc += `### Step ${index + 1}: ${step.name}\n\n`;
    doc += `**Action:** ${step.manualAction || getStepDescription(step)}\n\n`;
    doc += `**Expected Result:** ${step.expectedResult || 'TBD'}\n\n`;
    doc += `**Status:** [ ] Pass  [ ] Fail  [ ] Blocked\n\n`;
    doc += `---\n\n`;
  });
  
  return doc;
}

// Generate ISTQB format test case
function generateISTQBFormat(tc: UnifiedTestCase): string {
  let doc = `┌─────────────────────────────────────────────────────────────────┐
│                    TEST CASE SPECIFICATION                       │
└─────────────────────────────────────────────────────────────────┘

TEST CASE ID: ${tc.id}
TEST CASE NAME: ${tc.name}
VERSION: ${tc.metadata.version}
CREATED: ${new Date(tc.metadata.createdAt).toLocaleDateString()}
AUTHOR: ${tc.metadata.author || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESCRIPTION:
${tc.description || 'No description provided'}

TAGS: ${tc.tags.join(', ') || 'None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRECONDITIONS:
`;

  if (tc.preconditions?.length > 0) {
    tc.preconditions.forEach((pre, idx) => {
      doc += `${idx + 1}. Execute test case: ${pre.testCaseName} (${pre.enabled ? 'Enabled' : 'Disabled'})\n`;
    });
  } else {
    doc += `• None specified\n`;
  }

  doc += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST STEPS:
┌────┬────────────────────────┬────────────────────────┬──────────┐
│ #  │ ACTION                 │ EXPECTED RESULT        │ STATUS   │
├────┼────────────────────────┼────────────────────────┼──────────┤
`;

  tc.steps.forEach((step, index) => {
    const action = (step.manualAction || getStepDescription(step)).slice(0, 22).padEnd(22);
    const expected = (step.expectedResult || 'Verify success').slice(0, 22).padEnd(22);
    const status = step.enabled ? '[ ]      ' : 'SKIP     ';
    doc += `│ ${String(index + 1).padStart(2)} │ ${action} │ ${expected} │ ${status}│\n`;
  });

  doc += `└────┴────────────────────────┴────────────────────────┴──────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST DATA:
${tc.variables.length > 0 
  ? tc.variables.map(v => `• ${v.name}: ${v.value}`).join('\n')
  : '• No test data specified'}

ENVIRONMENT:
• Base URL: ${tc.settings.baseUrl || 'Not specified'}
• Timeout: ${tc.settings.timeout}ms
• Retries: ${tc.settings.retries}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION SUMMARY:
• Total Steps: ${tc.steps.length}
• Enabled Steps: ${tc.steps.filter(s => s.enabled).length}
• Disabled Steps: ${tc.steps.filter(s => !s.enabled).length}

RESULT: [ ] PASS  [ ] FAIL  [ ] BLOCKED

NOTES:
_________________________________________________________________
`;

  return doc;
}

// Generate Gherkin/BDD format
function generateGherkinFormat(tc: UnifiedTestCase): string {
  const tagLine = tc.tags.length > 0 ? tc.tags.map(t => `@${t.replace(/\s+/g, '_')}`).join(' ') : '@automated';
  
  let doc = `${tagLine}
Feature: ${tc.name}
  ${tc.description || 'Automated test case'}

`;

  // Add background for preconditions if any
  if (tc.preconditions?.length > 0) {
    doc += `  Background:
    Given the following test cases have been executed:
`;
    tc.preconditions.forEach(pre => {
      if (pre.enabled) {
        doc += `      | ${pre.testCaseName} |
`;
      }
    });
    doc += `
`;
  }

  doc += `  Scenario: ${tc.name}
`;

  // Group steps by type for better Gherkin flow
  let hasGiven = false;
  let hasWhen = false;
  
  tc.steps.forEach((step, index) => {
    if (!step.enabled) {
      doc += `    # DISABLED: ${step.name}\n`;
      return;
    }
    
    let keyword = 'And';
    
    // First navigate is Given
    if (step.type === 'navigate' && !hasGiven) {
      keyword = 'Given';
      hasGiven = true;
    }
    // Actions (click, input, select) are When
    else if (['click', 'input', 'select', 'hover'].includes(step.type) && !hasWhen) {
      keyword = 'When';
      hasWhen = true;
    }
    // Assertions are Then
    else if (['assert', 'verify'].includes(step.type)) {
      keyword = 'Then';
    }
    // Continue with And for same type
    else if (hasGiven && step.type === 'navigate') {
      keyword = 'And';
    }
    else if (hasWhen && ['click', 'input', 'select', 'hover'].includes(step.type)) {
      keyword = 'And';
    }
    
    const description = getStepDescription(step);
    doc += `    ${keyword} ${description}\n`;
    
    if (step.expectedResult) {
      doc += `    Then ${step.expectedResult}\n`;
    }
  });

  doc += `

  # ─────────────────────────────────────────────
  # Test Data
  # ─────────────────────────────────────────────
`;

  if (tc.variables.length > 0) {
    doc += `  Examples:
    | variable | value |
`;
    tc.variables.forEach(v => {
      doc += `    | ${v.name} | ${v.value} |
`;
    });
  }

  return doc;
}

// Generate Markdown format (similar to manual doc but cleaner)
function generateMarkdownFormat(tc: UnifiedTestCase): string {
  let doc = `# 📋 ${tc.name}

> ${tc.description || 'No description provided'}

**Test ID:** \`${tc.id}\`  
**Tags:** ${tc.tags.map(t => `\`${t}\``).join(', ') || 'None'}  
**Created:** ${new Date(tc.metadata.createdAt).toLocaleDateString()}

---

## 🔗 Preconditions

`;

  if (tc.preconditions?.length > 0) {
    tc.preconditions.forEach((pre, idx) => {
      const icon = pre.enabled ? '✅' : '⏭️';
      doc += `${idx + 1}. ${icon} **${pre.testCaseName}**\n`;
    });
  } else {
    doc += `_No preconditions defined_\n`;
  }

  doc += `
---

## 📝 Test Steps

| # | Step | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
`;

  tc.steps.forEach((step, index) => {
    const status = step.enabled ? '⬜' : '⏭️ Skip';
    const action = step.manualAction || getStepDescription(step);
    const expected = step.expectedResult || 'Verify success';
    doc += `| ${index + 1} | ${step.name} | ${action} | ${expected} | ${status} |\n`;
  });

  doc += `
---

## 🔧 Test Configuration

- **Base URL:** ${tc.settings.baseUrl || 'Not specified'}
- **Timeout:** ${tc.settings.timeout}ms
- **Retries:** ${tc.settings.retries}
- **Parallelizable:** ${tc.settings.parallelizable ? 'Yes' : 'No'}

`;

  if (tc.variables.length > 0) {
    doc += `## 📊 Test Data

| Variable | Value | Type |
|----------|-------|------|
`;
    tc.variables.forEach(v => {
      doc += `| ${v.name} | ${v.value} | ${v.type} |\n`;
    });
  }

  doc += `
---

## ✅ Execution Result

- [ ] **PASS** - All steps completed successfully
- [ ] **FAIL** - One or more steps failed
- [ ] **BLOCKED** - Unable to execute

**Notes:**
_Add execution notes here..._
`;

  return doc;
}

// Generate Playwright assertion code from structured assertion
function generateAssertionCode(assertion: StepAssertion, step: TestStep, stepIndex: number, indent: string): string {
  let code = '';
  const target = assertion.target || step.selector || '';
  const expected = assertion.expected || '';
  const selector = convertSelector(target);
  
  code += `${indent}# Verify: ${step.expectedResult || assertion.type}\n`;
  
  switch (assertion.type) {
    case 'element_visible':
      code += `${indent}expect(page.${selector}).to_be_visible()\n`;
      break;
    case 'element_hidden':
      code += `${indent}expect(page.${selector}).to_be_hidden()\n`;
      break;
    case 'text_contains':
      if (target) {
        code += `${indent}expect(page.${selector}).to_contain_text("${expected}")\n`;
      } else {
        code += `${indent}expect(page.locator("body")).to_contain_text("${expected}")\n`;
      }
      break;
    case 'text_equals':
      code += `${indent}expect(page.${selector}).to_have_text("${expected}")\n`;
      break;
    case 'url_contains':
      code += `${indent}expect(page).to_have_url(re.compile(r".*${expected}.*"))\n`;
      break;
    case 'url_equals':
      code += `${indent}expect(page).to_have_url("${expected}")\n`;
      break;
    case 'value_equals':
      code += `${indent}expect(page.${selector}).to_have_value("${expected}")\n`;
      break;
    case 'element_enabled':
      code += `${indent}expect(page.${selector}).to_be_enabled()\n`;
      break;
    case 'element_disabled':
      code += `${indent}expect(page.${selector}).to_be_disabled()\n`;
      break;
    case 'count_equals':
      code += `${indent}expect(page.${selector}).to_have_count(${expected || 1})\n`;
      break;
    case 'page_title':
      code += `${indent}expect(page).to_have_title("${expected}")\n`;
      break;
    case 'toast_message':
      // Common toast selectors
      code += `${indent}expect(page.locator('[role="alert"], .toast, .notification, [class*="toast"], [class*="snackbar"]').filter(has_text="${expected}")).to_be_visible(timeout=5000)\n`;
      break;
    case 'attribute_equals':
      const [attr, val] = expected.split('=');
      code += `${indent}expect(page.${selector}).to_have_attribute("${attr || 'class'}", "${val || ''}")\n`;
      break;
    case 'custom':
      code += `${indent}# Custom assertion: ${expected || 'verify expected result'}\n`;
      code += `${indent}pass  # Implement custom verification\n`;
      break;
    default:
      code += `${indent}# TODO: Verify ${assertion.type}\n`;
  }
  
  return code;
}

function convertSelector(selector: string): string {
  if (!selector) return 'locator("body")';
  if (selector.includes('get_by_')) return selector.replace(/^page\./, '');
  
  return selector
    .replace(/getByRole\(['"](\w+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\)/g, 'get_by_role("$1", name="$2")')
    .replace(/getByRole\(['"](\w+)['"]\)/g, 'get_by_role("$1")')
    .replace(/getByText\(['"]([^'"]+)['"]\)/g, 'get_by_text("$1")')
    .replace(/getByLabel\(['"]([^'"]+)['"]\)/g, 'get_by_label("$1")')
    .replace(/getByPlaceholder\(['"]([^'"]+)['"]\)/g, 'get_by_placeholder("$1")')
    .replace(/locator\(['"]([^'"]+)['"]\)/g, 'locator("$1")')
    .replace(/^page\./, '') || 'locator("body")';
}




