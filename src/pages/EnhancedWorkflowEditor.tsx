/**
 * Enhanced Workflow Editor Page - v2.1
 * Fixed layout with visible canvas, app selection, and smart code generation
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Workflow, FolderOpen, Variable, Calendar, GitBranch,
  Settings, Play, Save, Download, Upload, ChevronLeft,
  ChevronRight, ChevronUp, ChevronDown, Zap, Database, Globe, Layers, Plus,
  MousePointer, Type, Clock, CheckCircle, Navigation,
  Code, Eye, EyeOff, Trash2, Copy, ArrowUp, ArrowDown, Lightbulb,
  AlertCircle, Info, Sparkles, FolderPlus, User, Bot, ToggleLeft, ToggleRight,
  History, Monitor, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { useExecutionWebSocket } from '@/hooks/useExecutionWebSocket';
import { TestSuite } from '@/components/FlowstralWorkflowEditor/TestSuiteManager';
import VariableStore, { WorkflowVariable, DataSource } from '@/components/FlowstralWorkflowEditor/VariableStore';
import CICDExporter from '@/components/FlowstralWorkflowEditor/CICDExporter';

// Application types for smart locator generation
const APP_TYPES = [
  { id: 'generic', name: 'Generic HTML', icon: '🌐' },
  { id: 'salesforce', name: 'Salesforce/LWC', icon: '☁️' },
  { id: 'angular', name: 'Angular', icon: '🅰️' },
  { id: 'react', name: 'React', icon: '⚛️' },
  { id: 'vue', name: 'Vue.js', icon: '💚' },
  { id: 'servicenow', name: 'ServiceNow', icon: '🔧' },
  { id: 'workday', name: 'Workday', icon: '👔' },
  { id: 'sap', name: 'SAP UI5/Fiori', icon: '🔷' },
  { id: 'dynamics', name: 'Dynamics 365', icon: '📊' },
  { id: 'pega', name: 'Pega', icon: '🔶' },
];

// Node types - EXTENDED
type NodeType = 
  | 'navigate' | 'click' | 'input' | 'wait' | 'assert' 
  | 'api' | 'database' 
  | 'condition' | 'loop'
  | 'extract_text' | 'store_variable' | 'calculate'
  | 'group_start' | 'group_end'  // For reusable components
  | 'screenshot' | 'compare_visual';

// Assertion types for expected results - COMPREHENSIVE
type AssertionType = 
  // Element State
  | 'visible' | 'hidden' | 'enabled' | 'disabled'
  // Text Verification
  | 'text_equals' | 'text_contains' | 'text_not_contains' | 'text_starts_with' | 'text_ends_with'
  | 'text_matches_regex' | 'text_is_number' | 'text_is_date'
  // URL & Page
  | 'url_equals' | 'url_contains' | 'title_equals' | 'title_contains'
  // Element Properties
  | 'element_count' | 'attribute_equals' | 'has_class'
  | 'value_equals' | 'checked' | 'not_checked'
  // Math & Calculations
  | 'number_equals' | 'number_greater' | 'number_less' | 'number_between' | 'sum_equals'
  // Date Operations  
  | 'date_equals' | 'date_before' | 'date_after' | 'date_within_days'
  // Text Extraction (copy from page)
  | 'copy_text' | 'copy_all_text' | 'compare_texts'
  // Database
  | 'db_query_equals' | 'db_record_exists' | 'db_count_equals'
  // API Response
  | 'api_status' | 'api_body_contains' | 'api_response_time'
  // Visual
  | 'screenshot_match' | 'element_in_viewport'
  // Custom
  | 'custom';

// Data variable types
type DataVariableType = 
  | 'text' | 'number' | 'email' | 'phone' | 'date' | 'boolean'
  | 'dropdown_option' | 'random_from_list' | 'uuid' | 'timestamp'
  | 'db_query' | 'api_response' | 'extracted_text' | 'calculated';

// Reusable Component (No-code POM)
interface ReusableComponent {
  id: string;
  name: string;
  description: string;
  category: 'page' | 'component' | 'flow';  // Page Object, UI Component, or User Flow
  steps: string[];  // Node IDs
  variables: string[];  // Variable names used
  tags: string[];
}

interface NodeAssertion {
  enabled: boolean;
  type: AssertionType;
  target?: string;      // selector or 'page' for page-level assertions
  expected?: string;    // expected value
  timeout?: number;
  softAssert?: boolean; // Continue test even if assertion fails
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  data: {
    url?: string;
    selector?: string;
    selectorMethod?: string;
    value?: string;
    waitTime?: number;
    assertType?: string;
    description?: string;
    generatedCode?: string;
    // NEW: Assertion (expected result) for this step
    assertion?: NodeAssertion;
    // NEW: Manual test step description
    manualStep?: {
      action: string;
      expectedResult: string;
    };
    // NEW: Data binding for variables
    dataBinding?: {
      variable?: string;
      source?: 'synthetic' | 'csv' | 'api' | 'previous_step';
    };
    // NEW: Condition for logic nodes
    condition?: {
      expression?: string;
      trueBranch?: string[];
      falseBranch?: string[];
    };
  };
}

// Assertion options with labels - GROUPED BY CATEGORY
const ASSERTION_OPTIONS: { value: AssertionType; label: string; icon: string; needsTarget: boolean; needsExpected: boolean; category: string }[] = [
  // Element State
  { value: 'visible', label: 'Element is visible', icon: '👁️', needsTarget: true, needsExpected: false, category: 'Element State' },
  { value: 'hidden', label: 'Element is hidden', icon: '🙈', needsTarget: true, needsExpected: false, category: 'Element State' },
  { value: 'enabled', label: 'Element is enabled', icon: '✅', needsTarget: true, needsExpected: false, category: 'Element State' },
  { value: 'disabled', label: 'Element is disabled', icon: '🚫', needsTarget: true, needsExpected: false, category: 'Element State' },
  { value: 'checked', label: 'Checkbox is checked', icon: '☑️', needsTarget: true, needsExpected: false, category: 'Element State' },
  { value: 'not_checked', label: 'Checkbox is unchecked', icon: '⬜', needsTarget: true, needsExpected: false, category: 'Element State' },
  
  // Text Verification
  { value: 'text_equals', label: 'Text equals exactly', icon: '📝', needsTarget: true, needsExpected: true, category: 'Text' },
  { value: 'text_contains', label: 'Text contains', icon: '🔍', needsTarget: true, needsExpected: true, category: 'Text' },
  { value: 'text_starts_with', label: 'Text starts with', icon: '▶️', needsTarget: true, needsExpected: true, category: 'Text' },
  { value: 'text_ends_with', label: 'Text ends with', icon: '⏹️', needsTarget: true, needsExpected: true, category: 'Text' },
  { value: 'text_matches_regex', label: 'Text matches pattern', icon: '🔣', needsTarget: true, needsExpected: true, category: 'Text' },
  { value: 'text_is_number', label: 'Text is a number', icon: '#️⃣', needsTarget: true, needsExpected: false, category: 'Text' },
  { value: 'text_is_date', label: 'Text is a valid date', icon: '📅', needsTarget: true, needsExpected: false, category: 'Text' },
  
  // Text Extraction (Copy from page)
  { value: 'copy_text', label: '📋 Copy text to variable', icon: '📋', needsTarget: true, needsExpected: true, category: 'Text Extract' },
  { value: 'copy_all_text', label: '📋 Copy all text (list)', icon: '📜', needsTarget: true, needsExpected: true, category: 'Text Extract' },
  { value: 'compare_texts', label: '🔀 Compare two texts', icon: '🔀', needsTarget: true, needsExpected: true, category: 'Text Extract' },
  
  // URL & Page
  { value: 'url_equals', label: 'URL equals', icon: '🔗', needsTarget: false, needsExpected: true, category: 'Page' },
  { value: 'url_contains', label: 'URL contains', icon: '🔗', needsTarget: false, needsExpected: true, category: 'Page' },
  { value: 'title_equals', label: 'Page title equals', icon: '📄', needsTarget: false, needsExpected: true, category: 'Page' },
  { value: 'title_contains', label: 'Page title contains', icon: '📄', needsTarget: false, needsExpected: true, category: 'Page' },
  
  // Element Properties
  { value: 'element_count', label: 'Element count equals', icon: '🔢', needsTarget: true, needsExpected: true, category: 'Element' },
  { value: 'attribute_equals', label: 'Attribute equals', icon: '🏷️', needsTarget: true, needsExpected: true, category: 'Element' },
  { value: 'value_equals', label: 'Input value equals', icon: '📥', needsTarget: true, needsExpected: true, category: 'Element' },
  { value: 'element_in_viewport', label: 'Element in viewport', icon: '👀', needsTarget: true, needsExpected: false, category: 'Element' },
  
  // Math & Calculations
  { value: 'number_equals', label: '🔢 Number equals', icon: '=', needsTarget: true, needsExpected: true, category: 'Math' },
  { value: 'number_greater', label: '🔢 Number greater than', icon: '>', needsTarget: true, needsExpected: true, category: 'Math' },
  { value: 'number_less', label: '🔢 Number less than', icon: '<', needsTarget: true, needsExpected: true, category: 'Math' },
  { value: 'number_between', label: '🔢 Number between', icon: '↔️', needsTarget: true, needsExpected: true, category: 'Math' },
  { value: 'sum_equals', label: '➕ Sum of values equals', icon: '➕', needsTarget: true, needsExpected: true, category: 'Math' },
  
  // Date Operations
  { value: 'date_equals', label: '📅 Date equals', icon: '📅', needsTarget: true, needsExpected: true, category: 'Date' },
  { value: 'date_before', label: '📅 Date is before', icon: '⏪', needsTarget: true, needsExpected: true, category: 'Date' },
  { value: 'date_after', label: '📅 Date is after', icon: '⏩', needsTarget: true, needsExpected: true, category: 'Date' },
  { value: 'date_within_days', label: '📅 Date within X days', icon: '📆', needsTarget: true, needsExpected: true, category: 'Date' },
  
  // Database
  { value: 'db_query_equals', label: '🗄️ DB query result equals', icon: '🗄️', needsTarget: false, needsExpected: true, category: 'Database' },
  { value: 'db_record_exists', label: '🗄️ DB record exists', icon: '✓', needsTarget: false, needsExpected: true, category: 'Database' },
  { value: 'db_count_equals', label: '🗄️ DB record count', icon: '🔢', needsTarget: false, needsExpected: true, category: 'Database' },
  
  // API Response
  { value: 'api_status', label: '🌐 API status code', icon: '🌐', needsTarget: false, needsExpected: true, category: 'API' },
  { value: 'api_body_contains', label: '🌐 API response contains', icon: '📦', needsTarget: false, needsExpected: true, category: 'API' },
  { value: 'api_response_time', label: '🌐 API response time (ms)', icon: '⏱️', needsTarget: false, needsExpected: true, category: 'API' },
  
  // Visual
  { value: 'screenshot_match', label: '📸 Screenshot matches', icon: '📸', needsTarget: true, needsExpected: false, category: 'Visual' },
  
  // Custom
  { value: 'custom', label: '⚙️ Custom assertion', icon: '⚙️', needsTarget: false, needsExpected: true, category: 'Custom' },
];

// Data Variable templates for synthetic data
const DATA_VARIABLE_TEMPLATES = [
  { type: 'email', label: 'Email Address', icon: '📧', generator: '{{email}}', example: 'test.user@example.com' },
  { type: 'phone', label: 'Phone Number', icon: '📱', generator: '{{phone}}', example: '(555) 123-4567' },
  { type: 'name', label: 'Full Name', icon: '👤', generator: '{{name}}', example: 'John Smith' },
  { type: 'firstName', label: 'First Name', icon: '👤', generator: '{{firstName}}', example: 'John' },
  { type: 'lastName', label: 'Last Name', icon: '👤', generator: '{{lastName}}', example: 'Smith' },
  { type: 'date', label: 'Date', icon: '📅', generator: '{{date}}', example: '2024-01-15' },
  { type: 'dateOfBirth', label: 'Date of Birth (18-65)', icon: '🎂', generator: '{{dateOfBirth}}', example: '1990-05-20' },
  { type: 'address', label: 'Street Address', icon: '🏠', generator: '{{address}}', example: '123 Main St' },
  { type: 'city', label: 'City', icon: '🏙️', generator: '{{city}}', example: 'New York' },
  { type: 'state', label: 'State', icon: '🗺️', generator: '{{state}}', example: 'NY' },
  { type: 'zipCode', label: 'ZIP Code', icon: '📮', generator: '{{zipCode}}', example: '10001' },
  { type: 'ssn', label: 'SSN (masked)', icon: '🔒', generator: '{{ssn}}', example: 'XXX-XX-1234' },
  { type: 'creditCard', label: 'Credit Card (test)', icon: '💳', generator: '{{creditCard}}', example: '4111-1111-1111-1111' },
  { type: 'number', label: 'Random Number', icon: '🔢', generator: '{{number(1,100)}}', example: '42' },
  { type: 'uuid', label: 'Unique ID', icon: '🆔', generator: '{{uuid}}', example: 'a1b2c3d4-e5f6-...' },
  { type: 'timestamp', label: 'Timestamp', icon: '⏰', generator: '{{timestamp}}', example: '1704067200' },
  { type: 'company', label: 'Company Name', icon: '🏢', generator: '{{company}}', example: 'Acme Corp' },
  { type: 'username', label: 'Username', icon: '👤', generator: '{{username}}', example: 'jsmith42' },
  { type: 'password', label: 'Password (strong)', icon: '🔑', generator: '{{password}}', example: 'Str0ng#Pass!' },
];

// Smart locator strategies per app type
const LOCATOR_STRATEGIES: Record<string, {
  priority: string[];
  recommendations: string[];
  example: string;
}> = {
  generic: {
    priority: ['data-testid', 'id', 'name', 'role', 'text', 'css'],
    recommendations: [
      'Prefer data-testid for stable selectors',
      'Use getByRole for accessibility',
      'Avoid dynamic IDs and class names',
    ],
    example: "page.getByRole('button', { name: 'Submit' })",
  },
  salesforce: {
    priority: ['data-id', 'name', 'aria-label', 'lightning-*', 'text'],
    recommendations: [
      'Use data-id or name attributes (stable in SF)',
      'Avoid lwc- prefixed dynamic IDs',
      'Use getByText for labels on radio/checkboxes',
      'Wait for LWC components to load',
    ],
    example: "page.locator('lightning-input[name=\"Email\"]')",
  },
  angular: {
    priority: ['data-testid', 'formcontrolname', 'ng-reflect-name', 'id', 'text'],
    recommendations: [
      'Use formcontrolname for form inputs',
      'Prefer ng-reflect-* attributes',
      'Avoid ng- dynamic classes',
    ],
    example: "page.locator('[formcontrolname=\"email\"]')",
  },
  react: {
    priority: ['data-testid', 'data-cy', 'role', 'aria-label', 'text'],
    recommendations: [
      'Add data-testid to components for testing',
      'Use role-based selectors for accessibility',
      'Avoid relying on component class names',
    ],
    example: "page.getByTestId('login-button')",
  },
  servicenow: {
    priority: ['data-field', 'name', 'id', 'aria-label', 'text'],
    recommendations: [
      'Use data-field for form fields',
      'Handle iframes with frameLocator',
      'Wait for GlideRecord operations',
    ],
    example: "page.locator('[data-field=\"short_description\"]')",
  },
};

export default function EnhancedWorkflowEditorPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || undefined;
  
  // Panel states
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState('properties');
  const [showSaveToSuiteModal, setShowSaveToSuiteModal] = useState(false);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('');
  
  // NEW: Blackbox mode - hide code for non-technical users
  const [blackboxMode, setBlackboxMode] = useState(false);
  const [testMode, setTestMode] = useState<'manual' | 'automated' | 'both'>('both');
  
  // Workflow state
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [appType, setAppType] = useState('generic');
  const [framework, setFramework] = useState('playwright-python');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [generatedScript, setGeneratedScript] = useState('');
  
  // Data state
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [variables, setVariables] = useState<WorkflowVariable[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  
  // Environment & Execution state - NEW
  const [environment, setEnvironment] = useState('local');
  const [browser, setBrowser] = useState('chromium');
  const [headless, setHeadless] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    stepName: string;
    status: 'idle' | 'running' | 'passed' | 'failed';
    healedSelectors: Array<{ original: string; healed: string; step: number }>;
    screenshots: Array<{ step: number; path: string; base64?: string; type: 'failure' | 'step' }>;
    stepResults: Array<{ step: number; name: string; status: 'passed' | 'failed' | 'healed'; duration: number; error?: string }>;
  }>({
    currentStep: 0,
    totalSteps: 0,
    stepName: '',
    status: 'idle',
    healedSelectors: [],
    screenshots: [],
    stepResults: []
  });
  const [testHistory, setTestHistory] = useState<Array<{
    id: string;
    name: string;
    status: 'passed' | 'failed';
    timestamp: string;
    duration: number;
    steps: number;
    passedSteps: number;
    healedCount: number;
    screenshots: string[];
  }>>([]);
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  // Real-time execution WebSocket
  const { 
    progress: wsProgress, 
    isConnected: wsConnected, 
    connect: wsConnect, 
    disconnect: wsDisconnect,
    reset: wsReset 
  } = useExecutionWebSocket({
    onStepStart: (step, name) => {
      setExecutionProgress(prev => ({
        ...prev,
        currentStep: step,
        stepName: name,
        stepResults: [
          ...prev.stepResults.filter(s => s.step !== step),
          { step, name, status: 'passed', duration: 0 } // Will be updated on complete
        ]
      }));
    },
    onStepComplete: (step, status, duration) => {
      setExecutionProgress(prev => ({
        ...prev,
        stepResults: prev.stepResults.map(s => 
          s.step === step 
            ? { ...s, status: status as 'passed' | 'failed' | 'healed', duration }
            : s
        )
      }));
    },
    onSelfHealing: (step, original, healed) => {
      setExecutionProgress(prev => ({
        ...prev,
        healedSelectors: [...prev.healedSelectors, { step, original, healed }]
      }));
      toast.info(`🔧 Step ${step}: Selector healed`, {
        description: `${original.slice(0, 30)}... → ${healed.slice(0, 30)}...`
      });
    },
    onScreenshot: (step, screenshot) => {
      setExecutionProgress(prev => ({
        ...prev,
        screenshots: [...prev.screenshots, {
          step,
          path: screenshot.path || '',
          base64: screenshot.base64,
          type: screenshot.type as 'failure' | 'step'
        }]
      }));
    },
    onComplete: (status, results) => {
      setExecutionProgress(prev => ({
        ...prev,
        status: status === 'passed' ? 'passed' : 'failed',
        stepName: status === 'passed' ? 'All steps completed!' : 'Execution finished'
      }));
      if (status === 'passed') {
        toast.success(`✅ Test passed! ${results.healed_steps || 0} elements self-healed`);
      } else {
        toast.error(`❌ Test failed: ${results.error || 'Unknown error'}`);
      }
    },
    onError: (error) => {
      toast.error(`WebSocket error: ${error}`);
    }
  });

  // Sync WebSocket progress to local state when connected
  useEffect(() => {
    if (wsConnected && wsProgress.status !== 'idle') {
      setExecutionProgress(prev => ({
        ...prev,
        currentStep: wsProgress.currentStep,
        totalSteps: wsProgress.totalSteps,
        stepName: wsProgress.stepName,
        status: wsProgress.status === 'connecting' ? 'running' : wsProgress.status
      }));
    }
  }, [wsConnected, wsProgress]);

  // Load saved state
  useEffect(() => {
    const savedWorkflow = localStorage.getItem('workflow_editor_state');
    if (savedWorkflow) {
      try {
        const state = JSON.parse(savedWorkflow);
        setWorkflowName(state.workflowName || 'New Workflow');
        setAppType(state.appType || 'generic');
        setNodes(state.nodes || []);
      } catch (e) {
        console.error('Failed to load saved workflow:', e);
      }
    }
  }, []);

  // Auto-save
  useEffect(() => {
    const state = { workflowName, appType, nodes };
    localStorage.setItem('workflow_editor_state', JSON.stringify(state));
  }, [workflowName, appType, nodes]);

  // Generate assertion code based on framework
  const generateAssertionCode = useCallback((assertion: NodeAssertion, nodeSelector?: string): string => {
    if (!assertion?.enabled) return '';
    
    const target = assertion.target || nodeSelector || '';
    const expected = assertion.expected || '';
    
    switch (framework) {
      case 'playwright-python':
        switch (assertion.type) {
          case 'visible': return `    expect(${target}).to_be_visible()`;
          case 'hidden': return `    expect(${target}).to_be_hidden()`;
          case 'enabled': return `    expect(${target}).to_be_enabled()`;
          case 'disabled': return `    expect(${target}).to_be_disabled()`;
          case 'text_equals': return `    expect(${target}).to_have_text("${expected}")`;
          case 'text_contains': return `    expect(${target}).to_contain_text("${expected}")`;
          case 'url_equals': return `    expect(page).to_have_url("${expected}")`;
          case 'url_contains': return `    expect(page.url()).to_contain("${expected}")`;
          case 'title_equals': return `    expect(page).to_have_title("${expected}")`;
          case 'title_contains': return `    expect(page.title()).to_contain("${expected}")`;
          case 'element_count': return `    expect(${target}).to_have_count(${expected})`;
          case 'value_equals': return `    expect(${target}).to_have_value("${expected}")`;
          case 'checked': return `    expect(${target}).to_be_checked()`;
          case 'not_checked': return `    expect(${target}).not_to_be_checked()`;
          case 'custom': return `    ${expected}`;
          default: return '';
        }
      
      case 'playwright-typescript':
        switch (assertion.type) {
          case 'visible': return `    await expect(${target}).toBeVisible();`;
          case 'hidden': return `    await expect(${target}).toBeHidden();`;
          case 'enabled': return `    await expect(${target}).toBeEnabled();`;
          case 'disabled': return `    await expect(${target}).toBeDisabled();`;
          case 'text_equals': return `    await expect(${target}).toHaveText('${expected}');`;
          case 'text_contains': return `    await expect(${target}).toContainText('${expected}');`;
          case 'url_equals': return `    await expect(page).toHaveURL('${expected}');`;
          case 'url_contains': return `    await expect(page.url()).toContain('${expected}');`;
          case 'title_equals': return `    await expect(page).toHaveTitle('${expected}');`;
          case 'title_contains': return `    await expect(await page.title()).toContain('${expected}');`;
          case 'element_count': return `    await expect(${target}).toHaveCount(${expected});`;
          case 'value_equals': return `    await expect(${target}).toHaveValue('${expected}');`;
          case 'checked': return `    await expect(${target}).toBeChecked();`;
          case 'not_checked': return `    await expect(${target}).not.toBeChecked();`;
          case 'custom': return `    ${expected}`;
          default: return '';
        }
      
      case 'cypress':
        switch (assertion.type) {
          case 'visible': return `    cy.get('${target}').should('be.visible');`;
          case 'hidden': return `    cy.get('${target}').should('not.be.visible');`;
          case 'enabled': return `    cy.get('${target}').should('not.be.disabled');`;
          case 'disabled': return `    cy.get('${target}').should('be.disabled');`;
          case 'text_equals': return `    cy.get('${target}').should('have.text', '${expected}');`;
          case 'text_contains': return `    cy.get('${target}').should('contain', '${expected}');`;
          case 'url_equals': return `    cy.url().should('eq', '${expected}');`;
          case 'url_contains': return `    cy.url().should('include', '${expected}');`;
          case 'title_equals': return `    cy.title().should('eq', '${expected}');`;
          case 'title_contains': return `    cy.title().should('include', '${expected}');`;
          case 'element_count': return `    cy.get('${target}').should('have.length', ${expected});`;
          case 'value_equals': return `    cy.get('${target}').should('have.value', '${expected}');`;
          case 'checked': return `    cy.get('${target}').should('be.checked');`;
          case 'not_checked': return `    cy.get('${target}').should('not.be.checked');`;
          case 'custom': return `    ${expected}`;
          default: return '';
        }
      
      default:
        return `    # Assertion: ${assertion.type}`;
    }
  }, [framework]);

  // Generate code for a single node based on framework
  const generateNodeCode = useCallback((node: WorkflowNode, includeAssertion: boolean = true): string => {
    const url = node.data.url || 'https://example.com';
    const selector = node.data.selector || '';
    const value = node.data.value || '';
    const waitTime = node.data.waitTime || 1000;
    
    // Convert Playwright-style selectors to framework-specific
    const getFrameworkSelector = (sel: string): string => {
      if (!sel) return '';
      
      // Handle Playwright JS-style selectors -> convert to Python if needed
      if (sel.includes('getByRole')) {
        const match = sel.match(/getByRole\(['"]([^'"]+)['"],\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}/);
        if (match) {
          const [, role, name] = match;
          switch (framework) {
            case 'playwright-python':
              return `page.get_by_role("${role}", name="${name}")`;
            case 'selenium-java':
              return `By.xpath("//${role === 'button' ? 'button' : '*'}[contains(text(), '${name}')]")`;
            case 'cypress':
              return `'${role}:contains("${name}")'`;
            default:
              return sel;
          }
        }
        // Handle simple getByRole without name
        const simpleMatch = sel.match(/getByRole\(['"]([^'"]+)['"]\)/);
        if (simpleMatch) {
          const [, role] = simpleMatch;
          switch (framework) {
            case 'playwright-python':
              return `page.get_by_role("${role}")`;
            default:
              return sel;
          }
        }
      }
      
      if (sel.includes('getByLabel')) {
        const match = sel.match(/getByLabel\(['"]([^'"]+)['"]\)/);
        if (match) {
          const [, label] = match;
          switch (framework) {
            case 'playwright-python':
              return `page.get_by_label("${label}")`;
            case 'selenium-java':
              return `By.xpath("//label[contains(text(), '${label}')]//following::input[1]")`;
            case 'cypress':
              return `'input[aria-label="${label}"], label:contains("${label}") + input'`;
            default:
              return sel;
          }
        }
      }
      
      if (sel.includes('getByText')) {
        const match = sel.match(/getByText\(['"]([^'"]+)['"]\)/);
        if (match) {
          const [, text] = match;
          switch (framework) {
            case 'playwright-python':
              return `page.get_by_text("${text}")`;
            case 'selenium-java':
              return `By.xpath("//*[contains(text(), '${text}')]")`;
            case 'cypress':
              return `':contains("${text}")'`;
            default:
              return sel;
          }
        }
      }
      
      // Handle page.getByX style (with page. prefix)
      if (sel.includes('page.getBy')) {
        if (framework === 'playwright-python') {
          // Convert camelCase to snake_case for Python
          return sel
            .replace(/\.getByRole\(/g, '.get_by_role(')
            .replace(/\.getByText\(/g, '.get_by_text(')
            .replace(/\.getByLabel\(/g, '.get_by_label(')
            .replace(/\.getByPlaceholder\(/g, '.get_by_placeholder(')
            .replace(/\.getByAltText\(/g, '.get_by_alt_text(')
            .replace(/\.getByTitle\(/g, '.get_by_title(')
            .replace(/\.getByTestId\(/g, '.get_by_test_id(')
            .replace(/{ name: ['"]([^'"]+)['"] }/g, 'name="$1"')
            .replace(/{ exact: (true|false) }/g, 'exact=$1');
        }
        return sel;
      }
      
      // Handle CSS selectors
      if (sel.startsWith('#') || sel.startsWith('.') || sel.includes('[')) {
        switch (framework) {
          case 'selenium-java':
            return `By.cssSelector("${sel}")`;
          case 'cypress':
            return `'${sel}'`;
          case 'playwright-python':
            return `page.locator("${sel}")`;
          default:
            return `page.locator('${sel}')`;
        }
      }
      
      return sel;
    };
    
    const frameworkSelector = getFrameworkSelector(selector);
    
    switch (framework) {
      // ===== PLAYWRIGHT PYTHON =====
      case 'playwright-python':
        switch (node.type) {
          case 'navigate':
            return `    page.goto("${url}")\n    page.wait_for_load_state("domcontentloaded")`;
          case 'click':
            return `    ${frameworkSelector || "page.get_by_role('button', name='Submit')"}.click()`;
          case 'input':
            return `    ${frameworkSelector || "page.get_by_label('Email')"}.fill("${value}")`;
          case 'wait':
            return `    page.wait_for_timeout(${waitTime})`;
          case 'assert':
            return `    expect(${frameworkSelector || "page.get_by_text('Success')"}).to_be_visible()`;
          default:
            return `    # ${node.type}: ${node.label}`;
        }
      
      // ===== PLAYWRIGHT TYPESCRIPT =====
      case 'playwright-typescript':
        switch (node.type) {
          case 'navigate':
            return `    await page.goto('${url}');\n    await page.waitForLoadState('domcontentloaded');`;
          case 'click':
            return `    await ${selector || "page.getByRole('button', { name: 'Submit' })"}.click();`;
          case 'input':
            return `    await ${selector || "page.getByLabel('Email')"}.fill('${value}');`;
          case 'wait':
            return `    await page.waitForTimeout(${waitTime});`;
          case 'assert':
            return `    await expect(${selector || "page.getByText('Success')"}).toBeVisible();`;
          default:
            return `    // ${node.type}: ${node.label}`;
        }
      
      // ===== SELENIUM JAVA =====
      case 'selenium-java':
        switch (node.type) {
          case 'navigate':
            return `        driver.get("${url}");\n        new WebDriverWait(driver, Duration.ofSeconds(10)).until(d -> ((JavascriptExecutor) d).executeScript("return document.readyState").equals("complete"));`;
          case 'click':
            return `        driver.findElement(${frameworkSelector || 'By.id("submitBtn")'}).click();`;
          case 'input':
            return `        driver.findElement(${frameworkSelector || 'By.id("email")'}).sendKeys("${value}");`;
          case 'wait':
            return `        Thread.sleep(${waitTime});`;
          case 'assert':
            return `        Assert.assertTrue(driver.findElement(${frameworkSelector || 'By.xpath("//*[contains(text(), \'Success\')]")'}).isDisplayed());`;
          default:
            return `        // ${node.type}: ${node.label}`;
        }
      
      // ===== CYPRESS =====
      case 'cypress':
        switch (node.type) {
          case 'navigate':
            return `    cy.visit('${url}');`;
          case 'click':
            return `    cy.get(${frameworkSelector || "'#submitBtn'"}).click();`;
          case 'input':
            return `    cy.get(${frameworkSelector || "'#email'"}).type('${value}');`;
          case 'wait':
            return `    cy.wait(${waitTime});`;
          case 'assert':
            return `    cy.get(${frameworkSelector || "':contains(\"Success\")'"}).should('be.visible');`;
          default:
            return `    // ${node.type}: ${node.label}`;
        }
      
      // ===== SELENIUM PYTHON =====
      case 'selenium-python':
        switch (node.type) {
          case 'navigate':
            return `    driver.get("${url}")\n    WebDriverWait(driver, 10).until(lambda d: d.execute_script("return document.readyState") == "complete")`;
          case 'click':
            return `    driver.find_element(${frameworkSelector || 'By.ID, "submitBtn"'}).click()`;
          case 'input':
            return `    driver.find_element(${frameworkSelector || 'By.ID, "email"'}).send_keys("${value}")`;
          case 'wait':
            return `    time.sleep(${waitTime / 1000})`;
          case 'assert':
            return `    assert driver.find_element(${frameworkSelector || 'By.XPATH, "//*[contains(text(), \'Success\')]"'}).is_displayed()`;
          default:
            return `    # ${node.type}: ${node.label}`;
        }
      
      // ===== ROBOT FRAMEWORK =====
      case 'robot-framework':
        switch (node.type) {
          case 'navigate':
            return `    Open Browser    ${url}    chrome\n    Wait Until Page Contains Element    tag:body`;
          case 'click':
            return `    Click Element    ${selector || 'id:submitBtn'}`;
          case 'input':
            return `    Input Text    ${selector || 'id:email'}    ${value}`;
          case 'wait':
            return `    Sleep    ${waitTime / 1000}s`;
          case 'assert':
            return `    Element Should Be Visible    ${selector || 'xpath://*[contains(text(), "Success")]'}`;
          default:
            return `    # ${node.type}: ${node.label}`;
        }
      
      default:
        return `    // Unknown framework: ${node.type}`;
    }
  }, [appType, framework]);

  // Generate complete node code including assertion
  const generateNodeCodeWithAssertion = useCallback((node: WorkflowNode): string => {
    let code = generateNodeCode(node);
    
    // Add assertion if enabled
    if (node.data.assertion?.enabled) {
      const assertionCode = generateAssertionCode(node.data.assertion, node.data.selector);
      if (assertionCode) {
        code += '\n' + assertionCode;
      }
    }
    
    return code;
  }, [generateNodeCode, generateAssertionCode]);

  // Generate manual test step from workflow node
  const generateManualStep = useCallback((node: WorkflowNode, stepNumber: number): { action: string; expectedResult: string } => {
    let action = '';
    let expectedResult = 'Step completes successfully';
    
    switch (node.type) {
      case 'navigate':
        action = `Navigate to: ${node.data.url || 'the target URL'}`;
        expectedResult = 'Page loads successfully';
        break;
      case 'click':
        action = `Click on "${node.label}"`;
        expectedResult = node.data.assertion?.enabled 
          ? getAssertionDescription(node.data.assertion)
          : 'Element responds to click';
        break;
      case 'input':
        action = `Enter "${node.data.value || '...'}" in ${node.label}`;
        expectedResult = node.data.assertion?.enabled 
          ? getAssertionDescription(node.data.assertion)
          : 'Value is entered successfully';
        break;
      case 'wait':
        action = `Wait for ${node.data.waitTime || 1000}ms`;
        expectedResult = 'Wait completes';
        break;
      case 'assert':
        action = `Verify: ${node.label}`;
        expectedResult = node.data.assertion?.enabled 
          ? getAssertionDescription(node.data.assertion)
          : 'Verification passes';
        break;
      default:
        action = node.label;
    }
    
    // Override with custom manual step if provided
    if (node.data.manualStep?.action) action = node.data.manualStep.action;
    if (node.data.manualStep?.expectedResult) expectedResult = node.data.manualStep.expectedResult;
    
    return { action, expectedResult };
  }, []);

  // Convert assertion type to human-readable description
  const getAssertionDescription = (assertion: NodeAssertion): string => {
    const opt = ASSERTION_OPTIONS.find(o => o.value === assertion.type);
    if (!opt) return 'Assertion passes';
    
    switch (assertion.type) {
      case 'visible': return 'Element is visible on the page';
      case 'hidden': return 'Element is no longer visible';
      case 'text_equals': return `Text equals "${assertion.expected}"`;
      case 'text_contains': return `Text contains "${assertion.expected}"`;
      case 'url_equals': return `URL is "${assertion.expected}"`;
      case 'url_contains': return `URL contains "${assertion.expected}"`;
      case 'title_equals': return `Page title is "${assertion.expected}"`;
      case 'element_count': return `Element count is ${assertion.expected}`;
      case 'value_equals': return `Input value is "${assertion.expected}"`;
      case 'checked': return 'Checkbox/radio is checked';
      case 'not_checked': return 'Checkbox/radio is unchecked';
      default: return opt.label;
    }
  };

  // Generate full script based on selected framework
  const generateFullScript = useCallback(() => {
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
    // Sanitize test name: replace ALL non-alphanumeric chars with underscore, remove leading/trailing underscores
    const testName = workflowName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')  // Replace ALL non-alphanumeric with underscore
      .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
      .substring(0, 50) || 'recorded_test';  // Limit length, fallback if empty
    const appTypeName = APP_TYPES.find(a => a.id === appType)?.name || 'Generic';
    
    let script = '';
    let commentStyle = '#'; // Python style
    
    switch (framework) {
      // ===== PLAYWRIGHT PYTHON =====
      case 'playwright-python':
        script = `from playwright.sync_api import expect

def test_${testName}(page):
    """
    ${workflowName}
    App Type: ${appTypeName}
    Generated by QAAI Workflow Editor
    """
`;
        commentStyle = '#';
        break;
      
      // ===== PLAYWRIGHT TYPESCRIPT =====
      case 'playwright-typescript':
        script = `import { test, expect } from '@playwright/test';

test('${workflowName}', async ({ page }) => {
    // App Type: ${appTypeName}
    // Generated by QAAI Workflow Editor
`;
        commentStyle = '//';
        break;
      
      // ===== SELENIUM JAVA =====
      case 'selenium-java':
        script = `package com.qaai.tests;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;
import java.time.Duration;

/**
 * ${workflowName}
 * App Type: ${appTypeName}
 * Generated by QAAI Workflow Editor
 */
public class ${testName.charAt(0).toUpperCase() + testName.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}Test extends BaseTest {
    
    @Test
    public void test${testName.charAt(0).toUpperCase() + testName.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}() throws InterruptedException {
`;
        commentStyle = '//';
        break;
      
      // ===== CYPRESS =====
      case 'cypress':
        script = `describe('${workflowName}', () => {
  // App Type: ${appTypeName}
  // Generated by QAAI Workflow Editor

  it('should complete the workflow', () => {
`;
        commentStyle = '//';
        break;
      
      // ===== SELENIUM PYTHON =====
      case 'selenium-python':
        script = `import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class Test${testName.charAt(0).toUpperCase() + testName.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}:
    """
    ${workflowName}
    App Type: ${appTypeName}
    Generated by QAAI Workflow Editor
    """
    
    def setup_method(self):
        self.driver = webdriver.Chrome()
        self.driver.implicitly_wait(10)
    
    def teardown_method(self):
        self.driver.quit()
    
    def test_${testName}(self):
        driver = self.driver
`;
        commentStyle = '#';
        break;
      
      // ===== ROBOT FRAMEWORK =====
      case 'robot-framework':
        script = `*** Settings ***
Library    SeleniumLibrary
Library    Collections

Documentation    ${workflowName}
...              App Type: ${appTypeName}
...              Generated by QAAI Workflow Editor

*** Variables ***
\${BROWSER}    chrome

*** Test Cases ***
${workflowName.replace(/\s+/g, ' ')}
    [Documentation]    ${workflowName}
`;
        commentStyle = '#';
        break;
      
      default:
        script = `// Unknown framework: ${framework}\n`;
    }
    
    // Generate steps with assertions
    sortedNodes.forEach((node, index) => {
      let indent = '    ';
      if (framework === 'selenium-java') indent = '        ';
      if (framework === 'robot-framework') indent = '    ';
      
      script += `\n${indent}${commentStyle} Step ${index + 1}: ${node.label}\n`;
      script += generateNodeCodeWithAssertion(node) + '\n';
    });
    
    // Close the test function/block
    switch (framework) {
      case 'playwright-typescript':
        script += '});\n';
        break;
      case 'selenium-java':
        script += '    }\n}\n';
        break;
      case 'cypress':
        script += '  });\n});\n';
        break;
      case 'robot-framework':
        script += '\n*** Keywords ***\n';
        break;
      // playwright-python and selenium-python don't need closing
    }
    
    setGeneratedScript(script);
    toast.success(`Generated ${framework.replace('-', ' ').toUpperCase()} code!`);
    return script;
  }, [nodes, workflowName, appType, framework, generateNodeCodeWithAssertion]);

  // Generate unified test case (manual + automated)
  const generateUnifiedTestCase = useCallback(() => {
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
    const appTypeName = APP_TYPES.find(a => a.id === appType)?.name || 'Generic';
    
    // Generate manual test steps
    const manualSteps = sortedNodes.map((node, index) => {
      const step = generateManualStep(node, index + 1);
      return {
        stepNumber: index + 1,
        action: step.action,
        expectedResult: step.expectedResult,
        testData: node.data.value || '',
        selector: node.data.selector || '',
        nodeType: node.type,
      };
    });
    
    // Generate automation script
    const automationScript = generateFullScript();
    
    return {
      name: workflowName,
      description: `Test case for ${workflowName} on ${appTypeName}`,
      type: 'unified',
      priority: 'medium',
      status: 'draft',
      application: appTypeName,
      framework,
      
      // Manual test case format
      manualSteps,
      preconditions: `1. Access to ${appTypeName} application\n2. Valid test credentials (if required)`,
      postconditions: 'Test environment is in a clean state',
      
      // Automation data
      automationScript,
      selectors: sortedNodes.filter(n => n.data.selector).map(n => ({
        step: n.label,
        selector: n.data.selector,
      })),
      
      // Assertions for reporting
      assertions: sortedNodes
        .filter(n => n.data.assertion?.enabled)
        .map(n => ({
          step: n.label,
          type: n.data.assertion?.type,
          expected: n.data.assertion?.expected,
          description: getAssertionDescription(n.data.assertion as NodeAssertion),
        })),
      
      // Metadata
      createdAt: new Date().toISOString(),
      tags: [appType, framework],
      estimatedDuration: `${sortedNodes.length * 2} minutes`,
    };
  }, [nodes, workflowName, appType, framework, generateManualStep, generateFullScript]);

  // Export as manual test case document
  const exportAsManualTestCase = useCallback(() => {
    const testCase = generateUnifiedTestCase();
    
    // Generate markdown document
    let markdown = `# Test Case: ${testCase.name}\n\n`;
    markdown += `**Application:** ${testCase.application}  \n`;
    markdown += `**Priority:** ${testCase.priority}  \n`;
    markdown += `**Estimated Duration:** ${testCase.estimatedDuration}  \n`;
    markdown += `**Tags:** ${testCase.tags.join(', ')}  \n\n`;
    
    markdown += `## Description\n${testCase.description}\n\n`;
    
    markdown += `## Preconditions\n${testCase.preconditions}\n\n`;
    
    markdown += `## Test Steps\n\n`;
    markdown += `| Step | Action | Expected Result |\n`;
    markdown += `|------|--------|------------------|\n`;
    testCase.manualSteps.forEach(step => {
      markdown += `| ${step.stepNumber} | ${step.action} | ${step.expectedResult} |\n`;
    });
    
    markdown += `\n## Postconditions\n${testCase.postconditions}\n\n`;
    
    if (testCase.assertions.length > 0) {
      markdown += `## Verification Points\n`;
      testCase.assertions.forEach((a, i) => {
        markdown += `${i + 1}. **${a.step}**: ${a.description}\n`;
      });
    }
    
    // Download as markdown
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${testCase.name.replace(/\s+/g, '_')}_manual_test.md`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Manual test case exported!');
    return testCase;
  }, [generateUnifiedTestCase]);

  // Save unified test case to backend
  const saveUnifiedTestCase = useCallback(async () => {
    const testCase = generateUnifiedTestCase();
    
    try {
      const response = await fetch('http://localhost:8000/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: testCase.name,
          description: testCase.description,
          type: 'unified',
          priority: testCase.priority,
          status: testCase.status,
          steps: testCase.manualSteps.map(s => ({
            step_number: s.stepNumber,
            action: s.action,
            expected_result: s.expectedResult,
            test_data: s.testData,
          })),
          automation_data: {
            script: testCase.automationScript,
            framework: testCase.framework,
            selectors: testCase.selectors,
            assertions: testCase.assertions,
          },
          tags: testCase.tags,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(`Test case saved! ID: ${result.id || 'Created'}`);
        return result;
      } else {
        const error = await response.text();
        toast.error(`Failed to save: ${error}`);
      }
    } catch (error: any) {
      toast.error(`Error saving test case: ${error.message}`);
    }
  }, [generateUnifiedTestCase]);

  // Add new node
  const addNode = (type: NodeType) => {
    const nodeLabels: Record<NodeType, string> = {
      navigate: 'Navigate to URL',
      click: 'Click Element',
      input: 'Enter Text',
      wait: 'Wait',
      assert: 'Verify Element',
      api: 'API Request',
      database: 'Database Query',
      condition: 'IF Condition',
      loop: 'Loop / Repeat',
      extract_text: 'Copy Text from Page',
      store_variable: 'Store Value',
      calculate: 'Calculate / Math',
      group_start: 'Start Reusable Group',
      group_end: 'End Reusable Group',
      screenshot: 'Take Screenshot',
      compare_visual: 'Visual Comparison',
    };

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label: nodeLabels[type],
      position: { x: 50, y: nodes.length * 80 + 20 },
      data: {
        url: type === 'navigate' ? 'https://' : undefined,
        waitTime: type === 'wait' ? 1000 : undefined,
        // Initialize condition data for logic nodes
        condition: type === 'condition' ? {
          expression: '',
          trueBranch: [],
          falseBranch: [],
        } : undefined,
        // Initialize manual step
        manualStep: {
          action: '',
          expectedResult: '',
        },
      },
    };

    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    toast.success(`Added: ${nodeLabels[type]}`);
  };

  // Update node data
  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    
    const updated = {
      ...selectedNode,
      data: { ...selectedNode.data, [field]: value },
    };
    
    if (field === 'label') {
      updated.label = value;
    }
    
    setNodes(nodes.map(n => n.id === selectedNode.id ? updated : n));
    setSelectedNode(updated);
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
    toast.success('Node deleted');
  };

  // Move node up/down
  const moveNode = (nodeId: string, direction: 'up' | 'down') => {
    const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
    const index = sorted.findIndex(n => n.id === nodeId);
    
    if (direction === 'up' && index > 0) {
      const temp = sorted[index].position.y;
      sorted[index].position.y = sorted[index - 1].position.y;
      sorted[index - 1].position.y = temp;
    } else if (direction === 'down' && index < sorted.length - 1) {
      const temp = sorted[index].position.y;
      sorted[index].position.y = sorted[index + 1].position.y;
      sorted[index + 1].position.y = temp;
    }
    
    setNodes(sorted);
  };

  // Get recommendations for current app type
  const getRecommendations = () => {
    return LOCATOR_STRATEGIES[appType]?.recommendations || LOCATOR_STRATEGIES.generic.recommendations;
  };

  // Run the workflow
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  const runWorkflow = async () => {
    if (nodes.length === 0) {
      toast.error('Add some steps to run the workflow');
      return;
    }

    // Generate the script first
    const script = generateFullScript();
    
    if (!script) {
      toast.error('Failed to generate script');
      return;
    }

    setIsRunning(true);
    setRunResult(null);
    setShowResultsPanel(true);
    wsReset(); // Reset WebSocket progress state
    
    // Generate unique execution ID for WebSocket tracking
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    setExecutionProgress({
      currentStep: 0,
      totalSteps: nodes.length,
      stepName: 'Connecting...',
      status: 'running',
      healedSelectors: [],
      screenshots: [],
      stepResults: []
    });
    
    // Connect to WebSocket for real-time updates
    wsConnect(executionId);
    
    toast.info(`🚀 Starting test in ${environment} environment...`);

    try {
      const response = await fetch('http://localhost:8000/api/flowstral/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script,
          language: framework.includes('python') ? 'python' : 'typescript',
          browser,
          headless,
          timeout: 60000,
          environment,
          enable_self_healing: true,
          capture_screenshots: true,
          workflow_name: workflowName,
          step_names: nodes.map(n => n.label),
          execution_id: executionId // Pass execution ID for WebSocket correlation
        }),
      });

      const result = await response.json();
      
      // Handle both response formats
      const execResult = result.execution_result || result;
      setRunResult(execResult);
      
      // Extract healed selectors from result
      const healedSelectors = execResult.healed_selectors || execResult.self_healing_results || [];
      
      // Extract screenshots from result  
      const screenshots = execResult.screenshots || [];
      
      // Extract step results
      const stepResults = execResult.step_results || execResult.steps || [];
      
      // Update progress with final results
      const passed = execResult.success || execResult.status === 'passed' || result.status === 'success';
      setExecutionProgress(prev => ({
        ...prev,
        currentStep: nodes.length,
        stepName: passed ? 'All steps completed!' : 'Test execution finished',
        status: passed ? 'passed' : 'failed',
        healedSelectors: healedSelectors.map((h: any, i: number) => ({
          original: h.original_selector || h.original || 'unknown',
          healed: h.new_selector || h.healed || 'unknown',
          step: h.step || i + 1
        })),
        screenshots: screenshots.map((s: any, i: number) => ({
          step: s.step || i + 1,
          path: s.path || s.file || '',
          base64: s.base64 || s.data || '',
          type: s.type || 'step'
        })),
        stepResults: stepResults.map((s: any, i: number) => ({
          step: i + 1,
          name: s.name || nodes[i]?.label || `Step ${i + 1}`,
          status: s.healed ? 'healed' : (s.passed || s.status === 'passed' ? 'passed' : 'failed'),
          duration: s.duration || 0,
          error: s.error || s.message
        }))
      }));
      
      // Add to test history
      const historyEntry = {
        id: `run-${Date.now()}`,
        name: workflowName,
        status: passed ? 'passed' as const : 'failed' as const,
        timestamp: new Date().toISOString(),
        duration: execResult.duration || execResult.execution_time || 0,
        steps: nodes.length,
        passedSteps: stepResults.filter((s: any) => s.passed || s.status === 'passed').length || (passed ? nodes.length : 0),
        healedCount: healedSelectors.length,
        screenshots: screenshots.map((s: any) => s.path || s.base64)
      };
      setTestHistory(prev => [historyEntry, ...prev.slice(0, 49)]); // Keep last 50

      if (passed) {
        toast.success(`✅ Test passed! ${healedSelectors.length > 0 ? `(${healedSelectors.length} elements self-healed)` : ''}`);
      } else {
        const errorMsg = execResult.error || execResult.message || result.detail || 'Unknown error';
        toast.error(`❌ Test failed: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Run error:', error);
      toast.error(`Failed to run test: ${error.message}`);
      setRunResult({ success: false, error: error.message });
      setExecutionProgress(prev => ({
        ...prev,
        status: 'failed',
        stepName: `Error: ${error.message}`
      }));
    } finally {
      setIsRunning(false);
      // Disconnect WebSocket after a short delay to ensure final messages are received
      setTimeout(() => wsDisconnect(), 2000);
    }
  };

  // Get node icon
  const getNodeIcon = (type: NodeType) => {
    const icons: Record<NodeType, React.ReactNode> = {
      navigate: <Navigation className="h-4 w-4" />,
      click: <MousePointer className="h-4 w-4" />,
      input: <Type className="h-4 w-4" />,
      wait: <Clock className="h-4 w-4" />,
      assert: <CheckCircle className="h-4 w-4" />,
      api: <Globe className="h-4 w-4" />,
      database: <Database className="h-4 w-4" />,
      condition: <GitBranch className="h-4 w-4" />,
      loop: <Variable className="h-4 w-4" />,
      extract_text: <Copy className="h-4 w-4" />,
      store_variable: <Variable className="h-4 w-4" />,
      calculate: <Zap className="h-4 w-4" />,
      group_start: <FolderOpen className="h-4 w-4" />,
      group_end: <FolderOpen className="h-4 w-4" />,
      screenshot: <Eye className="h-4 w-4" />,
      compare_visual: <Eye className="h-4 w-4" />,
    };
    return icons[type];
  };

  // Get node color
  const getNodeColor = (type: NodeType) => {
    const colors: Record<NodeType, string> = {
      navigate: 'bg-blue-500',
      click: 'bg-green-500',
      input: 'bg-purple-500',
      wait: 'bg-yellow-500',
      assert: 'bg-red-500',
      api: 'bg-cyan-500',
      database: 'bg-orange-500',
      condition: 'bg-amber-500',
      loop: 'bg-indigo-500',
      extract_text: 'bg-teal-500',
      store_variable: 'bg-pink-500',
      calculate: 'bg-rose-500',
      group_start: 'bg-slate-500',
      group_end: 'bg-slate-400',
      screenshot: 'bg-violet-500',
      compare_visual: 'bg-fuchsia-500',
    };
    return colors[type];
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-blue-600" />
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="font-semibold border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 w-64"
            />
            <Badge variant="outline">v2.2</Badge>
            <Badge variant="outline">{nodes.length} steps</Badge>
            
            {/* Test Mode Selector */}
            <div className="flex items-center gap-1 ml-4 border-l pl-4">
              <Button
                variant={testMode === 'manual' ? 'default' : 'ghost'}
                size="sm"
                className="h-7"
                onClick={() => setTestMode('manual')}
                title="Manual Testing Mode"
              >
                <User className="h-3 w-3 mr-1" />
                Manual
              </Button>
              <Button
                variant={testMode === 'automated' ? 'default' : 'ghost'}
                size="sm"
                className="h-7"
                onClick={() => setTestMode('automated')}
                title="Automated Testing Mode"
              >
                <Bot className="h-3 w-3 mr-1" />
                Auto
              </Button>
              <Button
                variant={testMode === 'both' ? 'default' : 'ghost'}
                size="sm"
                className="h-7"
                onClick={() => setTestMode('both')}
                title="Unified (Both Manual & Automated)"
              >
                Both
              </Button>
            </div>
            
            {/* Blackbox Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 ml-2 ${blackboxMode ? 'bg-purple-100 text-purple-700' : ''}`}
              onClick={() => setBlackboxMode(!blackboxMode)}
              title={blackboxMode ? 'Show Code (Developer Mode)' : 'Hide Code (Blackbox Mode)'}
            >
              {blackboxMode ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {blackboxMode ? 'Blackbox' : 'Show Code'}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* App Type Selector - hide in blackbox mode */}
            {!blackboxMode && (
            <Select value={appType} onValueChange={setAppType}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_TYPES.map(app => (
                  <SelectItem key={app.id} value={app.id}>
                    <span className="mr-2">{app.icon}</span>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
            
            {/* Framework Selector - hide in blackbox mode */}
            {!blackboxMode && (
            <Select value={framework} onValueChange={setFramework}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="playwright-python">Playwright (Python)</SelectItem>
                <SelectItem value="playwright-typescript">Playwright (TypeScript)</SelectItem>
                <SelectItem value="selenium-java">Selenium (Java)</SelectItem>
                <SelectItem value="selenium-python">Selenium (Python)</SelectItem>
                <SelectItem value="cypress">Cypress (JavaScript)</SelectItem>
                <SelectItem value="robot-framework">Robot Framework</SelectItem>
              </SelectContent>
            </Select>
            )}
            
            {/* CI/CD Export - hide in blackbox mode */}
            {!blackboxMode && (
            <CICDExporter 
              workflowName={workflowName}
              workflowScript={generatedScript}
              testSuites={testSuites}
            />
            )}
            
            {/* Generate Code - hide in blackbox mode */}
            {!blackboxMode && testMode !== 'manual' && (
            <Button variant="outline" onClick={generateFullScript}>
              <Code className="h-4 w-4 mr-2" />
              Generate
            </Button>
            )}
            
            {/* Export Manual Test - show in manual or both modes */}
            {(testMode === 'manual' || testMode === 'both') && (
            <Button variant="outline" onClick={exportAsManualTestCase} disabled={nodes.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Manual Test
            </Button>
            )}
            
            {/* Save Test Case - always visible */}
            <Button variant="outline" onClick={saveUnifiedTestCase} disabled={nodes.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Save Test Case
            </Button>
            
            {/* Separator */}
            <div className="h-6 w-px bg-gray-300 mx-1" />
            
            {/* Environment Selector */}
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">🖥️ Local</SelectItem>
                <SelectItem value="dev">🔧 Dev</SelectItem>
                <SelectItem value="staging">🎭 Staging</SelectItem>
                <SelectItem value="prod">🚀 Prod</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Browser Selector */}
            <Select value={browser} onValueChange={setBrowser}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chromium">🌐 Chrome</SelectItem>
                <SelectItem value="firefox">🦊 Firefox</SelectItem>
                <SelectItem value="webkit">🧭 Safari</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Headless Toggle */}
            <Button
              variant={headless ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setHeadless(!headless)}
              title={headless ? 'Running headless (no browser window)' : 'Running with browser window visible'}
            >
              {headless ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            
            {/* Run Button */}
            <Button 
              onClick={runWorkflow} 
              disabled={isRunning || nodes.length === 0}
              className={executionProgress.status === 'passed' ? 'bg-green-600 hover:bg-green-700' : 
                         executionProgress.status === 'failed' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isRunning ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running ({executionProgress.currentStep}/{executionProgress.totalSteps})
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run
                </>
              )}
            </Button>
            
            {/* Results Toggle */}
            {(runResult || executionProgress.status !== 'idle') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResultsPanel(!showResultsPanel)}
                className="relative"
              >
                <Layers className="h-4 w-4" />
                {executionProgress.healedSelectors.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] bg-yellow-500">
                    {executionProgress.healedSelectors.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Execution Results Panel - Collapsible */}
        {showResultsPanel && (runResult || executionProgress.status !== 'idle') && (
          <div className="bg-gray-50 border-b flex-shrink-0 max-h-64 overflow-hidden">
            <div className="p-3">
              {/* Header with Progress */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge 
                    className={
                      executionProgress.status === 'passed' ? 'bg-green-500' :
                      executionProgress.status === 'failed' ? 'bg-red-500' :
                      executionProgress.status === 'running' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }
                  >
                    {executionProgress.status === 'passed' ? '✅ PASSED' :
                     executionProgress.status === 'failed' ? '❌ FAILED' :
                     executionProgress.status === 'running' ? '🔄 RUNNING' :
                     '⏸️ IDLE'}
                  </Badge>
                  <span className="text-sm font-medium">{executionProgress.stepName}</span>
                  {executionProgress.healedSelectors.length > 0 && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                      🔧 {executionProgress.healedSelectors.length} Self-Healed
                    </Badge>
                  )}
                  {wsConnected && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 animate-pulse">
                      📡 Live
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowResultsPanel(false)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Progress Bar */}
              {executionProgress.status === 'running' && (
                <div className="mb-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${(executionProgress.currentStep / executionProgress.totalSteps) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Step {executionProgress.currentStep} of {executionProgress.totalSteps}
                  </p>
                </div>
              )}
              
              <div className="flex gap-4 overflow-x-auto">
                {/* Step Results */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-medium text-muted-foreground mb-2">📋 Step Results</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {executionProgress.stepResults.length > 0 ? (
                      executionProgress.stepResults.map((step, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded text-xs ${
                            step.status === 'passed' ? 'bg-green-50 text-green-700' :
                            step.status === 'healed' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {step.status === 'passed' ? '✅' : step.status === 'healed' ? '🔧' : '❌'}
                            </span>
                            <span className="truncate max-w-[150px]">{step.name}</span>
                          </div>
                          <span className="text-[10px] opacity-75">{step.duration}ms</span>
                        </div>
                      ))
                    ) : (
                      nodes.map((node, idx) => (
                        <div 
                          key={node.id}
                          className={`flex items-center gap-2 p-2 rounded text-xs ${
                            idx < executionProgress.currentStep ? 'bg-green-50 text-green-700' :
                            idx === executionProgress.currentStep && executionProgress.status === 'running' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <span>
                            {idx < executionProgress.currentStep ? '✅' :
                             idx === executionProgress.currentStep && executionProgress.status === 'running' ? '🔄' :
                             '⏳'}
                          </span>
                          <span className="truncate">{node.label}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                {/* Self-Healing Log */}
                {executionProgress.healedSelectors.length > 0 && (
                  <div className="flex-1 min-w-[250px]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">🔧 Self-Healing Log</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {executionProgress.healedSelectors.map((heal, idx) => (
                        <div key={idx} className="p-2 bg-yellow-50 rounded text-xs">
                          <div className="flex items-center gap-1 text-yellow-800 font-medium mb-1">
                            <AlertCircle className="h-3 w-3" />
                            Step {heal.step}: Selector healed
                          </div>
                          <div className="space-y-0.5 text-[10px]">
                            <div className="flex gap-1">
                              <span className="text-red-600">Old:</span>
                              <code className="bg-red-100 px-1 rounded truncate max-w-[180px]">{heal.original}</code>
                            </div>
                            <div className="flex gap-1">
                              <span className="text-green-600">New:</span>
                              <code className="bg-green-100 px-1 rounded truncate max-w-[180px]">{heal.healed}</code>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Screenshots */}
                {executionProgress.screenshots.length > 0 && (
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs font-medium text-muted-foreground mb-2">📸 Screenshots</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {executionProgress.screenshots.map((screenshot, idx) => (
                        <div 
                          key={idx} 
                          className={`flex-shrink-0 p-1 rounded border ${
                            screenshot.type === 'failure' ? 'border-red-300 bg-red-50' : 'border-gray-200'
                          }`}
                        >
                          {screenshot.base64 ? (
                            <img 
                              src={`data:image/png;base64,${screenshot.base64}`}
                              alt={`Step ${screenshot.step}`}
                              className="h-24 w-auto rounded cursor-pointer hover:opacity-75"
                              onClick={() => window.open(`data:image/png;base64,${screenshot.base64}`, '_blank')}
                            />
                          ) : (
                            <div className="h-24 w-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                              Step {screenshot.step}
                            </div>
                          )}
                          <p className="text-[10px] text-center mt-1">
                            {screenshot.type === 'failure' ? '❌ ' : ''}Step {screenshot.step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Error Details */}
                {runResult?.error && (
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs font-medium text-red-600 mb-2">❌ Error Details</p>
                    <div className="p-2 bg-red-50 rounded text-xs text-red-700 max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono text-[10px]">
                        {runResult.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content - 3 Panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Actions & Suites */}
          <div className={`bg-white border-r transition-all duration-300 flex-shrink-0 ${leftPanelCollapsed ? 'w-12' : 'w-64'}`}>
            {leftPanelCollapsed ? (
              <div className="p-2 space-y-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setLeftPanelCollapsed(false)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="p-2 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Build</span>
                  <Button variant="ghost" size="sm" onClick={() => setLeftPanelCollapsed(true)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">Click to add step</p>
                      
                      {/* Action Buttons */}
                      {(['navigate', 'click', 'input', 'wait', 'assert'] as NodeType[]).map(type => (
                        <Button
                          key={type}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => addNode(type)}
                        >
                          <div className={`${getNodeColor(type)} text-white p-1 rounded mr-2`}>
                            {getNodeIcon(type)}
                          </div>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      ))}
                      
                      {/* Text & Data - COPY FROM PAGE */}
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">📋 Text & Data</p>
                        <Button variant="outline" className="w-full justify-start text-xs" onClick={() => addNode('extract_text')}>
                          <div className="bg-teal-500 text-white p-1 rounded mr-2">
                            <Copy className="h-3 w-3" />
                          </div>
                          Copy Text from Page
                        </Button>
                        <Button variant="outline" className="w-full justify-start mt-1 text-xs" onClick={() => addNode('store_variable')}>
                          <div className="bg-pink-500 text-white p-1 rounded mr-2">
                            <Variable className="h-3 w-3" />
                          </div>
                          Store Variable
                        </Button>
                        <Button variant="outline" className="w-full justify-start mt-1 text-xs" onClick={() => addNode('calculate')}>
                          <div className="bg-rose-500 text-white p-1 rounded mr-2">
                            <Zap className="h-3 w-3" />
                          </div>
                          Calculate / Math
                        </Button>
                      </div>
                      
                      {/* Logic Nodes - Phase 2 */}
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">🔀 Logic</p>
                        <Button variant="outline" className="w-full justify-start text-xs" onClick={() => addNode('condition')}>
                          <div className="bg-amber-500 text-white p-1 rounded mr-2">
                            <GitBranch className="h-3 w-3" />
                          </div>
                          IF / Condition
                        </Button>
                        <Button variant="outline" className="w-full justify-start mt-1 text-xs" onClick={() => addNode('loop')}>
                          <div className="bg-indigo-500 text-white p-1 rounded mr-2">
                            <Variable className="h-3 w-3" />
                          </div>
                          Loop / Repeat
                        </Button>
                      </div>
                      
                      {/* Reusable Groups (No-code POM) */}
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">📦 Reusable Groups</p>
                        <Button variant="outline" className="w-full justify-start text-xs" onClick={() => addNode('group_start')}>
                          <div className="bg-slate-500 text-white p-1 rounded mr-2">
                            <FolderOpen className="h-3 w-3" />
                          </div>
                          Start Reusable Group
                        </Button>
                        <Button variant="outline" className="w-full justify-start mt-1 text-xs" onClick={() => addNode('group_end')}>
                          <div className="bg-slate-400 text-white p-1 rounded mr-2">
                            <FolderOpen className="h-3 w-3" />
                          </div>
                          End Reusable Group
                        </Button>
                      </div>
                      
                      {/* Database & API - hide in blackbox mode */}
                      {!blackboxMode && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">🔌 Integrations</p>
                        <Button variant="outline" className="w-full justify-start text-xs" onClick={() => addNode('api')}>
                          <div className="bg-cyan-500 text-white p-1 rounded mr-2">
                            <Globe className="h-3 w-3" />
                          </div>
                          API Request
                        </Button>
                        <Button variant="outline" className="w-full justify-start mt-1 text-xs" onClick={() => addNode('database')}>
                          <div className="bg-orange-500 text-white p-1 rounded mr-2">
                            <Database className="h-3 w-3" />
                          </div>
                          Database Query
                        </Button>
                      </div>
                      )}
                      
                      {/* Visual Testing */}
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">📸 Visual</p>
                        <Button variant="outline" className="w-full justify-start text-xs" onClick={() => addNode('screenshot')}>
                          <div className="bg-violet-500 text-white p-1 rounded mr-2">
                            <Eye className="h-3 w-3" />
                          </div>
                          Take Screenshot
                        </Button>
                      </div>
                      
                      {/* Recommendations */}
                      <Card className="mt-4 bg-blue-50 border-blue-200">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs flex items-center gap-1">
                            <Lightbulb className="h-3 w-3 text-blue-600" />
                            {APP_TYPES.find(a => a.id === appType)?.name} Tips
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 px-3">
                          <ul className="text-xs space-y-1">
                            {getRecommendations().map((rec, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-blue-600">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                      
                      {/* Quick Actions */}
                      <div className="border-t pt-3 mt-3 space-y-2">
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-xs"
                          onClick={() => setShowSaveToSuiteModal(true)}
                          disabled={nodes.length === 0}
                        >
                          <FolderPlus className="h-4 w-4 mr-2 text-purple-500" />
                          Save to Suite
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-xs"
                          onClick={() => window.open('/test-suites', '_blank')}
                        >
                          <Layers className="h-4 w-4 mr-2 text-blue-500" />
                          Manage Suites
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-xs"
                          onClick={() => window.open('/scheduled-runs', '_blank')}
                        >
                          <Calendar className="h-4 w-4 mr-2 text-green-500" />
                          Schedule Runs
                        </Button>
                      </div>
                    </div>
                  </div>
              </div>
            )}
          </div>

          {/* Center - Canvas (Node List View) */}
          <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
            {/* Steps Header */}
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium">Workflow Steps</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNodes([])}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
            
            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4">
              {nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Workflow className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No steps yet</p>
                  <p className="text-sm">Click an action on the left to add steps</p>
                  <Button variant="outline" className="mt-4" onClick={() => addNode('navigate')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-w-2xl mx-auto">
                  {[...nodes].sort((a, b) => a.position.y - b.position.y).map((node, index) => (
                    <Card 
                      key={node.id}
                      className={`cursor-pointer transition-all ${
                        selectedNode?.id === node.id 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedNode(node)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Step Number */}
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground">{index + 1}</span>
                            {index < nodes.length - 1 && (
                              <div className="w-px h-4 bg-gray-300 mt-1" />
                            )}
                          </div>
                          
                          {/* Icon */}
                          <div className={`${getNodeColor(node.type)} text-white p-2 rounded`}>
                            {getNodeIcon(node.type)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm flex items-center gap-2">
                              {node.label}
                              {node.data.assertion?.enabled && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                  ✓ Assert
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {node.type === 'navigate' && node.data.url}
                              {node.type === 'click' && (node.data.selector || 'Click element')}
                              {node.type === 'input' && `Enter: ${node.data.value || '...'}`}
                              {node.type === 'wait' && `${node.data.waitTime || 1000}ms`}
                              {node.type === 'assert' && (node.data.selector || 'Verify element')}
                              {node.type === 'extract_text' && `📋 Copy: ${node.data.description || 'text'}`}
                              {node.type === 'store_variable' && `💾 ${node.data.description || 'variable'}`}
                              {node.type === 'calculate' && `🔢 ${node.data.description || 'calculation'}`}
                              {node.type === 'condition' && `🔀 ${node.data.condition?.expression || 'if...'}`}
                              {node.type === 'loop' && `🔁 ${node.data.description || 'repeat...'}`}
                              {node.type === 'group_start' && `📦 Start: ${node.data.description || 'Group'}`}
                              {node.type === 'group_end' && `📦 End: ${node.data.description || 'Group'}`}
                              {node.type === 'api' && `🌐 ${node.data.url || 'API call'}`}
                              {node.type === 'database' && `🗄️ ${node.data.description || 'DB query'}`}
                              {node.type === 'screenshot' && `📸 ${node.data.description || 'Capture'}`}
                            </div>
                            {/* Show assertion expected result preview */}
                            {node.data.assertion?.enabled && (
                              <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                {getAssertionDescription(node.data.assertion)}
                              </div>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'up'); }}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'down'); }}
                              disabled={index === nodes.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Code Preview - only show in non-blackbox mode */}
                        {selectedNode?.id === node.id && !blackboxMode && testMode !== 'manual' && (
                          <div className="mt-2 p-2 bg-gray-900 rounded text-xs font-mono text-green-400 overflow-x-auto">
                            <pre>{generateNodeCode(node)}</pre>
                          </div>
                        )}
                        
                        {/* Manual Step Preview - show in blackbox/manual mode */}
                        {selectedNode?.id === node.id && (blackboxMode || testMode === 'manual') && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs border border-blue-200">
                            <div className="font-medium text-blue-800 mb-1">
                              📋 Test Step {nodes.indexOf(node) + 1}
                            </div>
                            <div className="text-gray-700">
                              <strong>Action:</strong> {generateManualStep(node, nodes.indexOf(node) + 1).action}
                            </div>
                            <div className="text-green-700 mt-1">
                              <strong>Expected:</strong> {generateManualStep(node, nodes.indexOf(node) + 1).expectedResult}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Run Results */}
            {runResult && (
              <div className={`border-t max-h-48 overflow-y-auto ${runResult.success || runResult.status === 'passed' ? 'bg-green-900' : 'bg-red-900'}`}>
                <div className="p-2 flex items-center justify-between text-white text-xs">
                  <span className="flex items-center gap-2">
                    {runResult.success || runResult.status === 'passed' ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        Test Passed
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        Test Failed
                      </>
                    )}
                    {runResult.duration && <span className="text-gray-400">({runResult.duration}ms)</span>}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white h-6"
                    onClick={() => setRunResult(null)}
                  >
                    ×
                  </Button>
                </div>
                {(runResult.error || runResult.stderr || runResult.output) && (
                  <pre className="p-3 text-xs font-mono text-white overflow-x-auto whitespace-pre-wrap">
                    {runResult.error || runResult.stderr || runResult.output || runResult.message}
                  </pre>
                )}
              </div>
            )}

            {/* Generated Script Preview - hide in blackbox mode */}
            {generatedScript && !blackboxMode && testMode !== 'manual' && (
              <div className="border-t bg-gray-900 max-h-48 overflow-y-auto">
                <div className="p-2 flex items-center justify-between bg-gray-800 text-white text-xs">
                  <span>Generated Script</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white h-6"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedScript);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white h-6"
                      onClick={() => setGeneratedScript('')}
                    >
                      ×
                    </Button>
                  </div>
                </div>
                <pre className="p-3 text-xs font-mono text-green-400 overflow-x-auto">
                  {generatedScript}
                </pre>
              </div>
            )}
          </div>

          {/* Right Panel - Properties & Variables */}
          <div className={`bg-white border-l transition-all duration-300 flex-shrink-0 ${rightPanelCollapsed ? 'w-12' : 'w-80'}`}>
            {rightPanelCollapsed ? (
              <div className="p-2 space-y-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setRightPanelCollapsed(false)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="p-2 border-b flex items-center justify-between">
                  <span className="text-sm font-medium">Properties</span>
                  <Button variant="ghost" size="sm" onClick={() => setRightPanelCollapsed(true)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <Tabs value={activeRightTab} onValueChange={setActiveRightTab} className="flex-1 flex flex-col">
                  <TabsList className="w-full rounded-none border-b grid grid-cols-2">
                    <TabsTrigger value="properties" className="text-xs">Step</TabsTrigger>
                    <TabsTrigger value="variables" className="text-xs">Variables</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex-1 overflow-y-auto p-3">
                    <TabsContent value="properties" className="m-0">
                      {selectedNode ? (
                        <div className="space-y-4">
                          <div>
                            <Label>Step Name</Label>
                            <Input
                              value={selectedNode.label}
                              onChange={(e) => updateNodeData('label', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          
                          {selectedNode.type === 'navigate' && (
                            <div>
                              <Label>URL</Label>
                              <Input
                                value={selectedNode.data.url || ''}
                                onChange={(e) => updateNodeData('url', e.target.value)}
                                placeholder="https://example.com"
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {['click', 'input', 'assert'].includes(selectedNode.type) && (
                            <>
                              <div>
                                <Label>Selector</Label>
                                <Textarea
                                  value={selectedNode.data.selector || ''}
                                  onChange={(e) => updateNodeData('selector', e.target.value)}
                                  placeholder={LOCATOR_STRATEGIES[appType]?.example || "page.getByRole('button')"}
                                  className="mt-1 font-mono text-xs"
                                  rows={3}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  {LOCATOR_STRATEGIES[appType]?.recommendations[0]}
                                </p>
                              </div>
                              
                              {/* Selector Method Quick Pick */}
                              <div>
                                <Label>Quick Selector</Label>
                                <div className="grid grid-cols-2 gap-1 mt-1">
                                  {['getByRole', 'getByText', 'getByLabel', 'locator'].map(method => (
                                    <Button
                                      key={method}
                                      variant="outline"
                                      size="sm"
                                      className="text-xs"
                                      onClick={() => {
                                        // Use Python-style selectors for Python frameworks
                                        const isPython = framework === 'playwright-python' || framework === 'selenium-python';
                                        const templates: Record<string, string> = isPython ? {
                                          getByRole: 'page.get_by_role("button", name="")',
                                          getByText: 'page.get_by_text("")',
                                          getByLabel: 'page.get_by_label("")',
                                          locator: 'page.locator("")',
                                        } : {
                                          getByRole: "page.getByRole('button', { name: '' })",
                                          getByText: "page.getByText('')",
                                          getByLabel: "page.getByLabel('')",
                                          locator: "page.locator('')",
                                        };
                                        updateNodeData('selector', templates[method]);
                                      }}
                                    >
                                      {method}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                          
                          {selectedNode.type === 'input' && (
                            <div>
                              <Label>Value</Label>
                              <Input
                                value={selectedNode.data.value || ''}
                                onChange={(e) => updateNodeData('value', e.target.value)}
                                placeholder="Text to enter"
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {selectedNode.type === 'wait' && (
                            <div>
                              <Label>Wait Time (ms)</Label>
                              <Input
                                type="number"
                                value={selectedNode.data.waitTime || 1000}
                                onChange={(e) => updateNodeData('waitTime', parseInt(e.target.value))}
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {/* Assertion / Expected Result Section */}
                          <Card className="border-2 border-dashed border-green-300 bg-green-50">
                            <CardHeader className="py-2 px-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-xs flex items-center gap-1 text-green-700">
                                  <CheckCircle className="h-3 w-3" />
                                  Expected Result (Assertion)
                                </CardTitle>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <span className="text-xs text-muted-foreground">Enable</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedNode.data.assertion?.enabled || false}
                                    onChange={(e) => {
                                      const newAssertion = {
                                        ...selectedNode.data.assertion,
                                        enabled: e.target.checked,
                                        type: selectedNode.data.assertion?.type || 'visible',
                                      };
                                      updateNodeData('assertion', newAssertion);
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                </label>
                              </div>
                            </CardHeader>
                            {selectedNode.data.assertion?.enabled && (
                              <CardContent className="py-2 px-3 space-y-3">
                                {/* Assertion Type */}
                                <div>
                                  <Label className="text-xs">Assertion Type</Label>
                                  <Select
                                    value={selectedNode.data.assertion?.type || 'visible'}
                                    onValueChange={(value) => {
                                      updateNodeData('assertion', {
                                        ...selectedNode.data.assertion,
                                        type: value,
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="mt-1 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ASSERTION_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          <span className="mr-2">{opt.icon}</span>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {/* Target Selector (if needed) */}
                                {ASSERTION_OPTIONS.find(o => o.value === selectedNode.data.assertion?.type)?.needsTarget && (
                                  <div>
                                    <Label className="text-xs">Target Element</Label>
                                    <Input
                                      value={selectedNode.data.assertion?.target || selectedNode.data.selector || ''}
                                      onChange={(e) => {
                                        updateNodeData('assertion', {
                                          ...selectedNode.data.assertion,
                                          target: e.target.value,
                                        });
                                      }}
                                      placeholder="Leave empty to use step's selector"
                                      className="mt-1 h-8 text-xs font-mono"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Uses step's selector if empty
                                    </p>
                                  </div>
                                )}
                                
                                {/* Expected Value (if needed) */}
                                {ASSERTION_OPTIONS.find(o => o.value === selectedNode.data.assertion?.type)?.needsExpected && (
                                  <div>
                                    <Label className="text-xs">Expected Value</Label>
                                    <Input
                                      value={selectedNode.data.assertion?.expected || ''}
                                      onChange={(e) => {
                                        updateNodeData('assertion', {
                                          ...selectedNode.data.assertion,
                                          expected: e.target.value,
                                        });
                                      }}
                                      placeholder={
                                        selectedNode.data.assertion?.type?.includes('url') ? 'https://...' :
                                        selectedNode.data.assertion?.type?.includes('text') ? 'Expected text...' :
                                        selectedNode.data.assertion?.type?.includes('count') ? '5' :
                                        'Expected value...'
                                      }
                                      className="mt-1 h-8 text-xs"
                                    />
                                  </div>
                                )}
                                
                                {/* Preview assertion as manual step */}
                                <div className="bg-white rounded p-2 border">
                                  <p className="text-xs text-muted-foreground mb-1">Manual Test Expected Result:</p>
                                  <p className="text-xs font-medium text-green-700">
                                    ✅ {getAssertionDescription(selectedNode.data.assertion as NodeAssertion)}
                                  </p>
                                </div>
                              </CardContent>
                            )}
                          </Card>
                          
                          {/* Manual Step Override */}
                          <div className="border-t pt-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs text-muted-foreground">Manual Test Step Override</Label>
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            </div>
                            <div className="space-y-2">
                              <Input
                                value={selectedNode.data.manualStep?.action || ''}
                                onChange={(e) => {
                                  updateNodeData('manualStep', {
                                    ...selectedNode.data.manualStep,
                                    action: e.target.value,
                                  });
                                }}
                                placeholder="Custom action description..."
                                className="h-8 text-xs"
                              />
                              <Input
                                value={selectedNode.data.manualStep?.expectedResult || ''}
                                onChange={(e) => {
                                  updateNodeData('manualStep', {
                                    ...selectedNode.data.manualStep,
                                    expectedResult: e.target.value,
                                  });
                                }}
                                placeholder="Custom expected result..."
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Code Preview - only show in non-blackbox mode */}
                          {!blackboxMode && testMode !== 'manual' && (
                          <Card className="bg-gray-900">
                            <CardHeader className="py-2 px-3">
                              <CardTitle className="text-xs text-white flex items-center gap-1">
                                <Code className="h-3 w-3" />
                                Generated Code
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="py-2 px-3">
                              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                                {generateNodeCodeWithAssertion(selectedNode)}
                              </pre>
                            </CardContent>
                          </Card>
                          )}
                          
                          {/* Manual Test Preview - show in blackbox/manual mode */}
                          {(blackboxMode || testMode === 'manual') && (
                          <Card className="bg-blue-50 border-blue-200">
                            <CardHeader className="py-2 px-3">
                              <CardTitle className="text-xs text-blue-800 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Manual Test Step
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="py-2 px-3 space-y-2">
                              <div>
                                <Label className="text-xs text-blue-600">Action</Label>
                                <p className="text-sm">{generateManualStep(selectedNode, 1).action}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-green-600">Expected Result</Label>
                                <p className="text-sm text-green-700">{generateManualStep(selectedNode, 1).expectedResult}</p>
                              </div>
                            </CardContent>
                          </Card>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <Settings className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">Select a step to edit</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="variables" className="m-0 space-y-4">
                      {/* Quick Insert Variables */}
                      <div>
                        <Label className="text-xs font-medium">🎲 Quick Insert Test Data</Label>
                        <p className="text-xs text-muted-foreground mb-2">Click to copy variable placeholder</p>
                        <div className="grid grid-cols-2 gap-1">
                          {DATA_VARIABLE_TEMPLATES.slice(0, 10).map(v => (
                            <Button
                              key={v.type}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 justify-start"
                              onClick={() => {
                                navigator.clipboard.writeText(v.generator);
                                toast.success(`Copied ${v.generator}`);
                              }}
                              title={`Example: ${v.example}`}
                            >
                              <span className="mr-1">{v.icon}</span>
                              {v.label}
                            </Button>
                          ))}
                        </div>
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">More variables...</summary>
                          <div className="grid grid-cols-2 gap-1 mt-2">
                            {DATA_VARIABLE_TEMPLATES.slice(10).map(v => (
                              <Button
                                key={v.type}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 justify-start"
                                onClick={() => {
                                  navigator.clipboard.writeText(v.generator);
                                  toast.success(`Copied ${v.generator}`);
                                }}
                                title={`Example: ${v.example}`}
                              >
                                <span className="mr-1">{v.icon}</span>
                                {v.label}
                              </Button>
                            ))}
                          </div>
                        </details>
                      </div>
                      
                      {/* Extracted Variables (from Copy Text nodes) */}
                      <div className="border-t pt-3">
                        <Label className="text-xs font-medium">📋 Extracted Text Variables</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Variables captured from "Copy Text from Page" steps
                        </p>
                        {nodes.filter(n => n.type === 'extract_text').length > 0 ? (
                          <div className="space-y-1">
                            {nodes.filter(n => n.type === 'extract_text').map(n => (
                              <div key={n.id} className="flex items-center gap-2 p-2 bg-teal-50 rounded text-xs">
                                <Copy className="h-3 w-3 text-teal-600" />
                                <span className="font-mono text-teal-700">
                                  {'{{' + (n.data.description || 'extracted_text') + '}}'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Add "Copy Text from Page" steps to capture text
                          </p>
                        )}
                      </div>
                      
                      {/* Advanced Variable Store */}
                      <div className="border-t pt-3">
                        <Label className="text-xs font-medium">⚙️ Advanced Variables</Label>
                        <VariableStore
                          variables={variables}
                          dataSources={dataSources}
                          onVariablesChange={setVariables}
                          onDataSourcesChange={setDataSources}
                        />
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save to Suite Modal */}
      <Dialog open={showSaveToSuiteModal} onOpenChange={setShowSaveToSuiteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-purple-500" />
              Save Workflow to Suite
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Workflow Name</Label>
              <Input 
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Login Flow"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Select Suite</Label>
              <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose an existing suite or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">➕ Create New Suite</SelectItem>
                  {testSuites.map(suite => (
                    <SelectItem key={suite.id} value={suite.id}>
                      📁 {suite.name} ({suite.workflows.length} workflows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedSuiteId === 'new' && (
              <div>
                <Label>New Suite Name</Label>
                <Input 
                  placeholder="e.g., Smoke Tests"
                  className="mt-1"
                />
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">This workflow includes:</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{nodes.length} steps</Badge>
                <Badge variant="outline">{APP_TYPES.find(a => a.id === appType)?.name}</Badge>
                <Badge variant="outline">{framework}</Badge>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveToSuiteModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Save workflow to suite
                const script = generateFullScript();
                const workflow = {
                  id: `wf-${Date.now()}`,
                  name: workflowName,
                  nodes,
                  appType,
                  framework,
                  script,
                  createdAt: new Date().toISOString(),
                };
                
                // Store in localStorage for now
                const savedWorkflows = JSON.parse(localStorage.getItem('saved_workflows') || '[]');
                savedWorkflows.push(workflow);
                localStorage.setItem('saved_workflows', JSON.stringify(savedWorkflows));
                
                toast.success(`Saved "${workflowName}" to suite`);
                setShowSaveToSuiteModal(false);
              }}
              disabled={nodes.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save to Suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
