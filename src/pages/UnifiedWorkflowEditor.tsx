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
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  Play, Save, Download, Plus, Trash2, Copy,
  ArrowUp, ArrowDown, Eye, EyeOff, Code, Settings,
  Zap, Globe, MousePointer, Type, Clock, CheckCircle,
  Navigation, AlertCircle, Package, Wand2,
  ChevronRight, ChevronDown, MoreHorizontal, Target,
  Layers, RefreshCw, FileText, Monitor, Server, Gauge,
  Video, Camera, Search, X, XCircle, Edit,
  Database, ToggleLeft, ToggleRight, FolderPlus,
  BookOpen, Share2, Upload, ExternalLink,
  Calendar, Calculator, Shuffle, AlertTriangle,
  Mail, Phone, Hash, User, ShieldCheck, Lightbulb,
  Building2, Plane, GraduationCap, Heart, Utensils,
  Home, Briefcase, Gamepad2, BarChart3,
  Activity, FileJson, Link2, Key, Timer,
  ClipboardList, ArrowLeft, ArrowRight, Circle, CheckCircle2, XCircle as XCircleIcon, SkipForward, Ban,
  Pencil, Flag, FileDown, Cloud, File
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
import { ReusableModulesManager, ModuleStep } from '@/components/ReusableModulesManager';
import { BlackboxLocatorStrategies, BlackboxLocator } from '@/components/BlackboxLocatorStrategies';
import { resultsIngestionService, TestRunData } from '@/lib/results-ingestion-service';
import { SmartFillDialog } from '@/components/SmartFillDialog';
import { isElectron, localData, recorder as electronRecorder } from '@/lib/electron-bridge';
import { 
  DOMAINS, CATEGORIES, DomainType, ValidationTemplate,
  getValidationsByDomain, getSuggestionsForField, calculateCoverage,
  groupValidations, getPriorityColor, validationToAssertion
} from '@/lib/qa-validation-templates';

// ============================================================================
// UTILITY FUNCTIONS - MUST BE DEFINED BEFORE USE
// ============================================================================

/**
 * Convert various selector formats to Python Playwright format
 * IMPORTANT: This function MUST be defined at module level before any usage
 */
function convertSelector(selector: string): string {
  if (!selector) return 'locator("body")';

  // Clean up the selector - also escape newlines
  selector = selector.trim().replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  
  // Log for debugging
  console.log('[convertSelector] Input:', selector);

  // Already in Python format
  if (selector.includes('get_by_')) {
    const result = selector.replace(/^page\./, '');
    console.log('[convertSelector] Python format:', result);
    return result;
  }

  // Handle page.getByRole, page.getByText etc. (JavaScript Playwright format from recordings)
  if (selector.startsWith('page.getBy') || selector.startsWith('page.locator')) {
    let result = selector
      .replace(/^page\./, '')
      .replace(/getByRole\(\s*['"](\w+)['"](?:\s*,\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g, 
        (_, role, name) => name ? `get_by_role("${role}", name="${name}")` : `get_by_role("${role}")`)
      .replace(/getByText\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_text("$1")')
      .replace(/getByLabel\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_label("$1")')
      .replace(/getByPlaceholder\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_placeholder("$1")')
      .replace(/getByTestId\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_test_id("$1")')
      .replace(/getByTitle\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_title("$1")')
      .replace(/locator\(\s*['"]([^'"]+)['"]\s*\)/g, 'locator("$1")');
    
    console.log('[convertSelector] JS Playwright format converted:', result);
    return result;
  }

  // Handle locator('...') format - extract the inner selector
  const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
  if (locatorMatch) {
    const innerSelector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
    const result = `locator("${innerSelector.replace(/"/g, '\\"')}")`;
    console.log('[convertSelector] Locator format:', result);
    return result;
  }

  // Handle raw CSS selectors (e.g., [name="firstName"], #myId, .myClass)
  if (selector.startsWith('[') || selector.startsWith('#') || selector.startsWith('.')) {
    const result = `locator("${selector.replace(/"/g, '\\"')}")`;
    console.log('[convertSelector] CSS selector:', result);
    return result;
  }

  // Handle getByRole, getByText, etc. without page. prefix (JavaScript to Python conversion)
  let result = selector
    .replace(/getByRole\(\s*['"](\w+)['"](?:\s*,\s*\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g, 
      (_, role, name) => name ? `get_by_role("${role}", name="${name}")` : `get_by_role("${role}")`)
    .replace(/getByText\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_text("$1")')
    .replace(/getByLabel\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_label("$1")')
    .replace(/getByPlaceholder\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_placeholder("$1")')
    .replace(/getByTestId\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_test_id("$1")')
    .replace(/getByTitle\(\s*['"]([^'"]+)['"]\s*\)/g, 'get_by_title("$1")')
    .replace(/^page\./, '');

  // If no transformation happened and it's not empty, wrap in locator
  if (result === selector && selector.trim()) {
    // Check if it looks like a simple field name (no special chars) - convert to name attribute selector
    // Common field names: username, password, email, firstName, lastName, etc.
    const trimmed = selector.trim();
    const isSimpleName = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed) && !trimmed.includes(' ');
    
    if (isSimpleName) {
      // This is likely a field name, use name attribute selector
      result = `locator('[name="${trimmed}"]')`;
      console.log('[convertSelector] Converted simple name to [name=]:', result);
    } else {
      result = `locator("${selector.replace(/"/g, '\\"')}")`;
    }
  }

  console.log('[convertSelector] Final result:', result);
  return result || 'locator("body")';
}

// ============================================================================
// TYPES - Unified Test Case Schema
// ============================================================================

type StepType = 
  | 'navigate' | 'click' | 'input' | 'select' | 'hover' | 'scroll'
  | 'wait' | 'wait_for_element' | 'wait_for_text'
  | 'assert' | 'verify'
  | 'api' | 'graphql'
  | 'db_query' | 'db_assert'
  | 'note' | 'manual_step' | 'checkpoint'
  | 'screenshot' | 'visual_compare'
  | 'extract' | 'store_variable'
  | 'condition' | 'loop'
  | 'module'
  | 'custom'
  // Salesforce step types
  | 'sf_connect' | 'sf_query' | 'sf_assert' | 'sf_navigate' 
  | 'sf_metadata_assert' | 'sf_login_as' | 'sf_create_record'
  // Complex Verification step types
  | 'email_verify' | 'pdf_verify' | 'file_verify';

interface StepAssertion {
  id?: string;  // For multiple assertions
  enabled: boolean;
  type: string;
  target?: string;
  expected?: string;
  operator?: 'equals' | 'contains' | 'greater' | 'less' | 'matches';
  softAssert?: boolean;
}

// Helper to generate assertion description text
function getAssertionDescription(assertion: StepAssertion, stepSelector?: string): string {
  const target = assertion.target || stepSelector || 'element';
  const expected = assertion.expected || '';
  
  switch (assertion.type) {
    case 'element_visible': return `Element "${target}" should be visible`;
    case 'element_hidden': return `Element "${target}" should be hidden`;
    case 'element_enabled': return `Element "${target}" should be enabled`;
    case 'element_disabled': return `Element "${target}" should be disabled`;
    case 'text_contains': return `Page should contain text "${expected}"`;
    case 'text_equals': return `Element text should equal "${expected}"`;
    case 'value_contains': return `Input value should contain "${expected}"`;
    case 'value_equals': return `Input value should be "${expected}"`;
    case 'url_contains': return `URL should contain "${expected}"`;
    case 'url_equals': return `URL should be "${expected}"`;
    case 'title_contains': return `Page title should contain "${expected}"`;
    case 'count_equals': return `Element count should be ${expected}`;
    case 'toast_message': return `Toast message "${expected}" should appear`;
    case 'attribute_equals': return `Attribute should equal "${expected}"`;
    case 'page_title': return `Page title should be "${expected}"`;
    default: return expected || 'Verification should pass';
  }
}

// Helper to generate expected result from multiple assertions
function generateExpectedResultFromAssertions(assertions: StepAssertion[], stepSelector?: string): string {
  if (!assertions || assertions.length === 0) return '';
  
  const descriptions = assertions
    .filter(a => a.enabled)
    .map(a => getAssertionDescription(a, stepSelector));
  
  if (descriptions.length === 0) return '';
  if (descriptions.length === 1) return descriptions[0];
  return descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
}

interface SelectorObject {
  playwright?: string;
  selector?: string;
  fallbacks?: Array<{ playwright?: string; selector?: string; confidence?: number }>;
  confidence?: number;
  text?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  testId?: string;
}

interface TestStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  enabled: boolean;

  // UI Actions
  selector?: string;
  selectorObj?: SelectorObject;  // Full selector with fallbacks (same as Suggest/Recording)
  value?: string;
  displayValue?: string;  // Masked value for display (e.g., ••••••• for passwords)
  isSensitive?: boolean;  // Flag for password/secret fields
  inputType?: string;     // e.g., 'password', 'text', 'email'
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
  
  // Assertion (single - legacy) and assertions (multiple - new)
  assertion?: StepAssertion;
  assertions?: StepAssertion[];  // Multiple assertions support
  
  // Manual test info
  manualAction?: string;
  expectedResult?: string;
  automationStatus?: 'manual' | 'recorded' | 'verified';
  
  // Freeform text for notes/manual steps
  noteText?: string;  // Free-form text for manual test documentation
  
  // QA Engineer fallback selector - when nothing else works
  qaFallbackSelector?: string;  // XPath/CSS selector input by QA when auto-detection fails
  
  // Manual execution tracking
  manualResult?: 'passed' | 'failed' | 'skipped' | 'blocked';
  manualNotes?: string;
  manualExecutedAt?: string;
  manualExecutedBy?: string;
  
  // Variables
  storeAs?: string;
  
  // Runtime Random Generation (generates unique value on each test run)
  runtimeRandom?: {
    enabled: boolean;
    type: 'auto' | 'name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'date' | 'number' | 'year' | 'text' | 'username' | 'password';
    constraints?: {
      minValue?: number;      // For numbers, year
      maxValue?: number;      // For numbers, year
      minAge?: number;        // For year (e.g., 18 means year <= currentYear - 18)
      maxAge?: number;        // For year (e.g., 100 means year >= currentYear - 100)
      format?: string;        // Date format
    };
  };
  
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
  // QA Validation Coverage
  domain?: DomainType;
  coveredValidations?: string[]; // IDs of covered validation templates
}

type ExportMode = 'automation' | 'api' | 'database' | 'performance' | 'manual';
type ViewMode = 'no-code' | 'code';

// ============================================================================
// STEP TYPE DEFINITIONS
// ============================================================================

/**
 * Step Palette - Comprehensive test step types for manual & automated testing
 * 
 * Organized for sprint-start test case creation:
 * - UI Actions: Core interactions (Navigate, Click, Input, Select)
 * - Verify: Assertions and validations
 * - Backend: API calls, DB queries, response validation
 * - Logic: Conditions, loops, reusable modules
 * - Wait: Timing and synchronization
 * - Data: Variables, test data generation
 * - Evidence: Screenshots, logs, recordings
 */
const STEP_CATEGORIES = {
  // UI ACTIONS - Primary for manual test case creation
  ui: {
    label: 'UI Actions',
    icon: MousePointer,
    color: 'amber',
    description: 'User interface interactions',
    steps: [
      { type: 'navigate', label: 'Navigate', icon: Navigation, color: 'bg-blue-500', desc: 'Go to URL' },
      { type: 'click', label: 'Click', icon: MousePointer, color: 'bg-blue-500', desc: 'Click element' },
      { type: 'input', label: 'Input', icon: Type, color: 'bg-blue-500', desc: 'Enter text' },
      { type: 'select', label: 'Select', icon: ChevronDown, color: 'bg-blue-500', desc: 'Choose option' },
      { type: 'hover', label: 'Hover', icon: Target, color: 'bg-blue-600', desc: 'Mouse hover' },
      { type: 'upload', label: 'Upload', icon: Upload, color: 'bg-amber-600', desc: 'Upload file' },
    ]
  },
  // VERIFY - Assertions and validations
  verify: {
    label: 'Verify',
    icon: CheckCircle,
    color: 'green',
    description: 'Assertions and validations',
    steps: [
      { type: 'assert', label: 'Element Visible', icon: Eye, color: 'bg-green-500', desc: 'Check visibility' },
      { type: 'assert_text', label: 'Text Content', icon: Type, color: 'bg-green-500', desc: 'Verify text' },
      { type: 'assert_value', label: 'Field Value', icon: FileText, color: 'bg-green-500', desc: 'Check input value' },
      { type: 'assert_url', label: 'URL', icon: Link2, color: 'bg-green-600', desc: 'Verify URL' },
      { type: 'assert_title', label: 'Page Title', icon: FileText, color: 'bg-green-600', desc: 'Check title' },
      { type: 'assert_count', label: 'Element Count', icon: Hash, color: 'bg-green-600', desc: 'Count elements' },
    ]
  },
  // BACKEND - API and Database
  backend: {
    label: 'Backend',
    icon: Server,
    color: 'blue',
    description: 'API calls and database queries',
    steps: [
      { type: 'api', label: 'API Request', icon: Globe, color: 'bg-blue-500', desc: 'HTTP request' },
      { type: 'api_validate', label: 'Validate Response', icon: CheckCircle, color: 'bg-blue-500', desc: 'Check API response' },
      { type: 'api_extract', label: 'Extract Value', icon: Key, color: 'bg-blue-600', desc: 'Get from response' },
      { type: 'db_query', label: 'Database Query', icon: Database, color: 'bg-orange-500', desc: 'SQL query' },
      { type: 'db_validate', label: 'Validate Data', icon: ShieldCheck, color: 'bg-orange-500', desc: 'Check DB data' },
    ]
  },
  // LOGIC - Control flow
  logic: {
    label: 'Logic',
    icon: Share2,
    color: 'purple',
    description: 'Conditions, loops, and modules',
    steps: [
      { type: 'condition', label: 'If / Then', icon: Share2, color: 'bg-purple-500', desc: 'Conditional logic' },
      { type: 'loop', label: 'Loop', icon: RefreshCw, color: 'bg-purple-500', desc: 'Repeat steps' },
      { type: 'module', label: 'Reusable Module', icon: Package, color: 'bg-purple-600', desc: 'Import module' },
      { type: 'group', label: 'Group Steps', icon: Layers, color: 'bg-purple-600', desc: 'Group together' },
    ]
  },
  // WAIT - Synchronization
  wait: {
    label: 'Wait',
    icon: Clock,
    color: 'cyan',
    description: 'Timing and synchronization',
    steps: [
      { type: 'wait', label: 'Wait Time', icon: Timer, color: 'bg-cyan-500', desc: 'Fixed delay' },
      { type: 'wait_for_element', label: 'Wait for Element', icon: Eye, color: 'bg-cyan-500', desc: 'Until visible' },
      { type: 'wait_for_text', label: 'Wait for Text', icon: Type, color: 'bg-cyan-600', desc: 'Until text appears' },
      { type: 'wait_for_network', label: 'Wait for Network', icon: Activity, color: 'bg-cyan-600', desc: 'Network idle' },
    ]
  },
  // DATA - Variables and test data
  data: {
    label: 'Data',
    icon: Database,
    color: 'violet',
    description: 'Variables and test data',
    steps: [
      { type: 'set_variable', label: 'Set Variable', icon: Edit, color: 'bg-violet-500', desc: 'Store value' },
      { type: 'generate_data', label: 'Generate Data', icon: Wand2, color: 'bg-violet-500', desc: 'Random/fake data' },
      { type: 'extract_text', label: 'Extract from Page', icon: FileText, color: 'bg-violet-600', desc: 'Get page data' },
      { type: 'use_data_row', label: 'Data Row', icon: ClipboardList, color: 'bg-violet-600', desc: 'Use dataset row' },
    ]
  },
  // EVIDENCE - Documentation
  evidence: {
    label: 'Evidence',
    icon: Camera,
    color: 'rose',
    description: 'Screenshots and logs',
    steps: [
      { type: 'screenshot', label: 'Screenshot', icon: Camera, color: 'bg-rose-500', desc: 'Capture screen' },
      { type: 'log', label: 'Log Message', icon: FileText, color: 'bg-rose-500', desc: 'Add log entry' },
    ]
  },
  // MANUAL - Freeform text for manual testing
  manual: {
    label: 'Manual',
    icon: Pencil,
    color: 'slate',
    description: 'Freeform text & manual steps',
    steps: [
      { type: 'note', label: 'Note / Comment', icon: FileText, color: 'bg-slate-500', desc: 'Free-form text' },
      { type: 'manual_step', label: 'Manual Step', icon: ClipboardList, color: 'bg-slate-500', desc: 'Manual action' },
      { type: 'checkpoint', label: 'Checkpoint', icon: Flag, color: 'bg-slate-600', desc: 'Verification point' },
    ]
  },
  // SALESFORCE - SF-specific steps (auto-connects via backend)
  salesforce: {
    label: 'Salesforce',
    icon: Cloud,
    color: 'sky',
    description: 'Salesforce automation & assertions',
    steps: [
      { type: 'sf_connect', label: 'SF Connect', icon: Cloud, color: 'bg-sky-500', desc: 'Connect to SF org (auto)' },
      { type: 'sf_navigate', label: 'SF Navigate', icon: Navigation, color: 'bg-sky-500', desc: 'Navigate in SF' },
      { type: 'sf_query', label: 'SOQL Query', icon: Database, color: 'bg-sky-600', desc: 'Run SOQL query' },
      { type: 'sf_assert', label: 'SF Assert', icon: ShieldCheck, color: 'bg-sky-600', desc: 'Assert record/field' },
      { type: 'sf_metadata_assert', label: 'Metadata Assert', icon: Settings, color: 'bg-sky-700', desc: 'Assert metadata' },
      { type: 'sf_login_as', label: 'Login As User', icon: User, color: 'bg-sky-700', desc: 'Switch user context' },
      { type: 'sf_create_record', label: 'Create Record', icon: Plus, color: 'bg-sky-800', desc: 'Create SF record' },
    ]
  },
  // COMPLEX VERIFY - Email, PDF, File verification
  complex_verify: {
    label: 'Complex Verify',
    icon: Mail,
    color: 'indigo',
    description: 'Email, PDF, and file verification',
    steps: [
      { type: 'email_verify', label: 'Email Verify', icon: Mail, color: 'bg-indigo-500', desc: 'Verify email received' },
      { type: 'pdf_verify', label: 'PDF Verify', icon: FileText, color: 'bg-indigo-600', desc: 'Verify PDF content' },
      { type: 'file_verify', label: 'File Verify', icon: File, color: 'bg-indigo-700', desc: 'Verify downloaded file' },
    ]
  },
};

const getStepInfo = (type: StepType) => {
  for (const category of Object.values(STEP_CATEGORIES)) {
    const step = (category as any).steps.find((s: any) => s.type === type);
    if (step) return step;
  }
  return { type, label: type, icon: Zap, color: 'bg-gray-500 text-white' };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract string selector from various formats (object or string)
 * Recordings can produce: { playwright: "locator('[name=x]')", selector: "[name=x]" } or just a string
 */
function extractSelectorString(selector: any): string {
  if (!selector) return '';
  
  // If it's already a string, return it
  if (typeof selector === 'string') return selector;
  
  // If it's an object, try to extract the selector string
  if (typeof selector === 'object') {
    // Priority: playwright > selector > primary.playwright > primary.selector
    if (selector.playwright && typeof selector.playwright === 'string') {
      return selector.playwright;
    }
    if (selector.selector && typeof selector.selector === 'string') {
      return selector.selector;
    }
    if (selector.primary?.playwright && typeof selector.primary.playwright === 'string') {
      return selector.primary.playwright;
    }
    if (selector.primary?.selector && typeof selector.primary.selector === 'string') {
      return selector.primary.selector;
    }
    // Check for common selector attributes stored directly
    if (selector.css) return selector.css;
    if (selector.xpath) return selector.xpath;
    if (selector.text) return `text=${selector.text}`;
    if (selector.testId) return `[data-testid="${selector.testId}"]`;
    if (selector.name) return `[name="${selector.name}"]`;
    if (selector.id) return `#${selector.id}`;
    
    console.warn('[extractSelectorString] Could not extract string from selector object:', selector);
    return '';
  }
  
  console.warn('[extractSelectorString] Unknown selector type:', typeof selector, selector);
  return '';
}

/**
 * Extract full SelectorObject with fallbacks (same structure as Suggest/Recording)
 * This preserves all fallback strategies for robust execution
 */
function extractSelectorObject(selector: any, selectorObj: any, eventData: any): SelectorObject | undefined {
  // If we already have a valid selectorObj, use it
  if (selectorObj && typeof selectorObj === 'object') {
    return {
      playwright: selectorObj.playwright,
      selector: selectorObj.selector,
      fallbacks: selectorObj.fallbacks,
      confidence: selectorObj.confidence,
      text: eventData?.text || selectorObj.text,
      name: eventData?.name || selectorObj.name,
      id: eventData?.id || selectorObj.id,
      ariaLabel: eventData?.ariaLabel || selectorObj.ariaLabel,
      testId: eventData?.testId || selectorObj.testId,
    };
  }
  
  // If selector is an object with selector data, extract it
  if (selector && typeof selector === 'object') {
    return {
      playwright: selector.playwright,
      selector: selector.selector || selector.css,
      fallbacks: selector.fallbacks,
      confidence: selector.confidence,
      text: eventData?.text || selector.text,
      name: eventData?.name || selector.name,
      id: eventData?.id || selector.id,
      ariaLabel: eventData?.ariaLabel || selector.ariaLabel,
      testId: eventData?.testId || selector.testId,
    };
  }
  
  // If we have event data with text/attributes, create a minimal selectorObj for fallbacks
  if (eventData) {
    const obj: SelectorObject = {};
    if (eventData.text) obj.text = eventData.text;
    if (eventData.name) obj.name = eventData.name;
    if (eventData.id) obj.id = eventData.id;
    if (eventData.ariaLabel) obj.ariaLabel = eventData.ariaLabel;
    if (Object.keys(obj).length > 0) return obj;
  }
  
  return undefined;
}

/**
 * Extract human-readable target name from selector
 * e.g., getByRole('button', { name: 'Submit' }) -> "Submit button"
 */
function extractTargetName(selectorInput?: any, eventData?: any): string {
  const selector = extractSelectorString(selectorInput);
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
        // SECURITY: Mask sensitive values (passwords, secrets, etc.)
        const isSensitive = step.isSensitive || 
                           step.inputType === 'password' ||
                           /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.name || '') ||
                           /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.target || '');
        
        // Also detect garbled UTF-8 characters (encoding issues from password recording)
        const hasGarbledChars = /[āã口¢Γ]/.test(step.value || '');
        
        if (isSensitive || hasGarbledChars) {
          return `🔒 Type "••••••••"`;
        }
        
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
    
    case 'note':
      return step.noteText ? `📝 ${step.noteText.slice(0, 50)}...` : 'Note';
    
    case 'manual_step':
      return step.manualAction || 'Manual step';
    
    case 'checkpoint':
      return step.noteText ? `🚩 ${step.noteText.slice(0, 40)}` : 'Checkpoint';
    
    default:
      return step.description || '';
  }
}

/**
 * Smart field type detection - matches field label/name to appropriate data type
 * Handles formats like "Input: *Year", "*Day", "First name", etc.
 * Returns the detected type and any constraints
 */
function detectFieldType(fieldText: string): { type: string; constraints?: Record<string, any> } {
  // Clean the text: remove "Input:", "*", ":", leading/trailing spaces
  const text = fieldText
    .replace(/^input\s*:\s*/i, '')  // Remove "Input: "
    .replace(/^\*+/, '')             // Remove leading asterisks
    .replace(/[:\*]+/g, ' ')         // Replace colons and asterisks with spaces
    .trim()
    .toLowerCase();
  
  // === DATE COMPONENTS (must check FIRST - before anything else) ===
  // Day of month (1-31)
  if (/^day$/i.test(text) || /\bday\b/i.test(text) && !/birth.*day|holiday|today/i.test(text)) {
    return { type: 'day', constraints: { minValue: 1, maxValue: 28 } };
  }
  // Month (1-12)
  if (/^month$/i.test(text) || /\bmonth\b/i.test(text) && !/monthly/i.test(text)) {
    return { type: 'month', constraints: { minValue: 1, maxValue: 12 } };
  }
  // Year
  if (/^year$/i.test(text) || /\byear\b/i.test(text) && !/yearly/i.test(text)) {
    return { type: 'birth_year', constraints: { minAge: 18, maxAge: 80 } };
  }
  if (/expir.*year|exp.*year/i.test(text)) {
    return { type: 'expiry_year', constraints: { minValue: new Date().getFullYear(), maxValue: new Date().getFullYear() + 10 } };
  }
  
  // === NAMES ===
  if (/^first\s*name$|^first$|fname|given/i.test(text)) {
    return { type: 'first_name' };
  }
  if (/^middle\s*name$|^middle$|mname/i.test(text)) {
    return { type: 'middle_name' };
  }
  if (/^last\s*name$|^last$|lname|surname|family/i.test(text)) {
    return { type: 'last_name' };
  }
  if (/^full\s*name$|^name$/i.test(text) && !/user|company|org|file/i.test(text)) {
    return { type: 'full_name' };
  }
  
  // === CONTACT INFO ===
  if (/email|e-mail/i.test(text)) {
    return { type: 'email' };
  }
  if (/phone|tel|mobile|cell/i.test(text)) {
    return { type: 'phone' };
  }
  
  // === ADDRESS COMPONENTS ===
  if (/street|address\s*1|address\s*line|^addr/i.test(text) && !/email/i.test(text)) {
    return { type: 'street_address' };
  }
  if (/address\s*2|^apt$|suite|unit/i.test(text)) {
    return { type: 'address_line2' };
  }
  if (/^city$|city/i.test(text)) {
    return { type: 'city' };
  }
  if (/^state$|state|province/i.test(text)) {
    return { type: 'state' };
  }
  if (/zip|postal/i.test(text)) {
    return { type: 'zip' };
  }
  if (/country/i.test(text)) {
    return { type: 'country' };
  }
  
  // === FINANCIAL ===
  if (/card\s*number|credit\s*card/i.test(text)) {
    return { type: 'credit_card' };
  }
  if (/cvv|cvc|security\s*code/i.test(text)) {
    return { type: 'cvv', constraints: { length: 3 } };
  }
  if (/expir.*month|exp.*month/i.test(text)) {
    return { type: 'expiry_month', constraints: { minValue: 1, maxValue: 12 } };
  }
  if (/amount|price|cost|total|balance/i.test(text)) {
    return { type: 'currency', constraints: { minValue: 1, maxValue: 1000 } };
  }
  
  // === IDENTITY ===
  if (/ssn|social\s*security/i.test(text)) {
    return { type: 'ssn' };
  }
  if (/^age$/i.test(text)) {
    return { type: 'age', constraints: { minValue: 18, maxValue: 80 } };
  }
  if (/gender|sex/i.test(text)) {
    return { type: 'gender' };
  }
  
  // === ACCOUNT ===
  if (/username|user\s*name|user\s*id|^login$/i.test(text)) {
    return { type: 'username' };
  }
  if (/password|pwd|^pass$/i.test(text)) {
    return { type: 'password' };
  }
  
  // === BUSINESS ===
  if (/company|org|business|employer/i.test(text)) {
    return { type: 'company' };
  }
  if (/job|title|position|occupation/i.test(text) && !/user/i.test(text)) {
    return { type: 'job_title' };
  }
  
  // === WEB ===
  if (/url|website|link|homepage/i.test(text)) {
    return { type: 'url' };
  }
  
  // === TEXT FIELDS ===
  if (/description|comment|note|message|bio|about/i.test(text)) {
    return { type: 'paragraph' };
  }
  
  // === NUMBERS ===
  if (/qty|quantity|count|^number$|^num$/i.test(text)) {
    return { type: 'number', constraints: { minValue: 1, maxValue: 100 } };
  }
  
  // === FULL DATE ===
  if (/^date$|dob|birth|birthday/i.test(text)) {
    return { type: 'date' };
  }
  
  // Default - generic text
  return { type: 'text' };
}

/**
 * Generate synthetic test data based on field name/type
 * Uses smart detection and RANDOM_DATA for variety
 */
function generateTestValue(fieldNameOrTarget: string): string {
  const detected = detectFieldType(fieldNameOrTarget);
  return generateSmartValue(detected.type, fieldNameOrTarget, detected.constraints);
}

/**
 * Large datasets for random generation (1000+ unique combinations)
 */
const RANDOM_DATA = {
  // 100 first names (male + female) = 100 options
  firstNames: [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
    'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
    'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
    'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah',
    'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
    'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
    'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra', 'Frank', 'Rachel',
    'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria', 'Jerry', 'Heather',
  ],
  // 100 last names = 100 options (100 x 100 = 10,000 name combinations)
  lastNames: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
    'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
  ],
  // 20 email domains
  emailDomains: [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
    'test.com', 'example.com', 'demo.org', 'sample.net', 'testmail.io',
    'mailtest.com', 'qatest.org', 'automation.io', 'testdata.com', 'mockmail.net',
    'tempmail.org', 'testuser.com', 'demouser.net', 'sampledata.io', 'autotest.com',
  ],
  // 50 street names
  streetNames: [
    'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Park', 'Lake', 'Hill',
    'Walnut', 'Sunset', 'River', 'Spring', 'Forest', 'Church', 'Highland', 'Valley', 'Meadow', 'Grove',
    'Willow', 'Cherry', 'Lincoln', 'Jefferson', 'Franklin', 'Jackson', 'Adams', 'Madison', 'Monroe', 'Wilson',
    'Broadway', 'Central', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Mill', 'Bridge', 'School',
    'North', 'South', 'East', 'West', 'College', 'Market', 'Harbor', 'Center', 'Vista', 'Ridge',
  ],
  // 20 street types
  streetTypes: ['Street', 'Avenue', 'Boulevard', 'Drive', 'Lane', 'Road', 'Court', 'Place', 'Way', 'Circle',
    'Terrace', 'Trail', 'Parkway', 'Commons', 'Square', 'Loop', 'Run', 'Path', 'Crossing', 'Heights'],
  // 100 cities (US + international)
  cities: [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego',
    'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco',
    'Indianapolis', 'Seattle', 'Denver', 'Washington', 'Boston', 'Nashville', 'Baltimore', 'Oklahoma City',
    'Louisville', 'Portland', 'Las Vegas', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento',
    'Mesa', 'Kansas City', 'Atlanta', 'Miami', 'Oakland', 'Minneapolis', 'Cleveland', 'Tampa',
    'London', 'Paris', 'Tokyo', 'Sydney', 'Toronto', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Vienna',
    'Dublin', 'Barcelona', 'Munich', 'Prague', 'Brussels', 'Stockholm', 'Copenhagen', 'Oslo', 'Helsinki', 'Zurich',
    'Singapore', 'Hong Kong', 'Seoul', 'Shanghai', 'Beijing', 'Mumbai', 'Delhi', 'Bangkok', 'Dubai', 'Cairo',
    'Mexico City', 'São Paulo', 'Buenos Aires', 'Lima', 'Bogotá', 'Santiago', 'Johannesburg', 'Lagos', 'Nairobi', 'Cape Town',
    'Melbourne', 'Brisbane', 'Perth', 'Auckland', 'Wellington', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton',
    'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Leeds', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff', 'Belfast',
  ],
  // 50 US states
  states: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  // State abbreviations
  stateAbbreviations: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
    'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
    'VA', 'WA', 'WV', 'WI', 'WY',
  ],
  // 50 company name prefixes
  companyPrefixes: [
    'Global', 'Tech', 'Digital', 'Advanced', 'Smart', 'Prime', 'Elite', 'Pro', 'Next', 'First',
    'United', 'National', 'American', 'Pacific', 'Atlantic', 'Sunrise', 'Sunset', 'Golden', 'Silver', 'Blue',
    'Green', 'Red', 'Alpha', 'Beta', 'Omega', 'Delta', 'Summit', 'Peak', 'Apex', 'Core',
    'Dynamic', 'Innovative', 'Creative', 'Strategic', 'Premier', 'Superior', 'Ultimate', 'Quantum', 'Fusion', 'Synergy',
    'Vertex', 'Pinnacle', 'Horizon', 'Zenith', 'Nova', 'Stellar', 'Cosmic', 'Infinity', 'Vision', 'Future',
  ],
  // 30 company suffixes
  companySuffixes: [
    'Solutions', 'Technologies', 'Systems', 'Services', 'Industries', 'Enterprises', 'Group', 'Corp', 'Inc', 'LLC',
    'Partners', 'Associates', 'Consulting', 'Labs', 'Works', 'Studio', 'Agency', 'Network', 'Media', 'Digital',
    'Software', 'Hardware', 'Electronics', 'Dynamics', 'Innovations', 'Ventures', 'Holdings', 'International', 'Global', 'Worldwide',
  ],
  // 20 job titles
  jobTitles: [
    'Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer', 'DevOps Engineer',
    'QA Engineer', 'Project Manager', 'Business Analyst', 'Marketing Manager', 'Sales Representative',
    'HR Manager', 'Financial Analyst', 'Operations Manager', 'Technical Lead', 'Architect',
    'Consultant', 'Director', 'Vice President', 'CEO', 'CTO',
  ],
  // Words for generating text
  words: [
    'test', 'sample', 'demo', 'example', 'automation', 'quality', 'data', 'input', 'output', 'result',
    'user', 'admin', 'system', 'process', 'workflow', 'action', 'event', 'task', 'item', 'record',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
  ],
};

// Helper to pick random from array
const randomPick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate random string of given length
const randomString = (length: number, chars = 'abcdefghijklmnopqrstuvwxyz0123456789'): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate smart test values based on type
 * Used by the Smart Fill dropdown in the right panel
 * Produces 1000+ unique combinations for each type
 */
/**
 * Generate smart test values based on detected type
 * Supports constraints for bounded values (day, month, year, numbers)
 */
function generateSmartValue(type: string, fieldHint: string = '', constraints?: Record<string, any>): string {
  const randomNum = Math.floor(Math.random() * 100000);
  const currentYear = new Date().getFullYear();
  const c = constraints || {};

  switch (type) {
    // === AUTO-DETECT (uses smart detection) ===
    case 'auto': {
      const detected = detectFieldType(fieldHint);
      return generateSmartValue(detected.type, fieldHint, detected.constraints);
    }

    // === DATE COMPONENTS ===
    case 'day': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 28; // Safe default
      return String(Math.floor(Math.random() * (max - min + 1)) + min).padStart(2, '0');
    }
    
    case 'month': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 12;
      return String(Math.floor(Math.random() * (max - min + 1)) + min).padStart(2, '0');
    }
    
    case 'year':
    case 'birth_year': {
      const minAge = c.minAge ?? 18;
      const maxAge = c.maxAge ?? 80;
      const maxYear = currentYear - minAge;
      const minYear = currentYear - maxAge;
      return String(Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear);
    }
    
    case 'expiry_year': {
      const min = c.minValue ?? currentYear;
      const max = c.maxValue ?? (currentYear + 10);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    
    case 'expiry_month': {
      return String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    }

    // === NAMES ===
    case 'full_name':
    case 'name':
      return `${randomPick(RANDOM_DATA.firstNames)} ${randomPick(RANDOM_DATA.lastNames)}`;

    case 'first_name':
      return randomPick(RANDOM_DATA.firstNames);
    
    case 'middle_name':
      // Use first names as middle names, or initials
      return Math.random() > 0.5 ? randomPick(RANDOM_DATA.firstNames) : randomPick(RANDOM_DATA.firstNames).charAt(0);

    case 'last_name':
      return randomPick(RANDOM_DATA.lastNames);

    // === EMAIL (customizable) ===
    case 'email': {
      const emailFirst = randomPick(RANDOM_DATA.firstNames).toLowerCase();
      const emailLast = randomPick(RANDOM_DATA.lastNames).toLowerCase();
      const emailNum = Math.floor(Math.random() * 1000);
      const domain = c.domain ?? randomPick(RANDOM_DATA.emailDomains);
      const prefix = c.prefix ?? '';
      
      const formats = [
        `${prefix}${emailFirst}${emailNum}@${domain}`,
        `${prefix}${emailFirst}.${emailLast}@${domain}`,
        `${prefix}${emailFirst}_${emailLast}${emailNum}@${domain}`,
        `${prefix}test.${emailFirst}${emailNum}@${domain}`,
      ];
      return randomPick(formats);
    }

    // === PHONE ===
    case 'phone': {
      const areaCodes = ['201', '212', '310', '312', '404', '415', '503', '602', '650', '702'];
      const format = c.format ?? 'us';
      if (format === 'international') {
        return `+1 ${randomPick(areaCodes)} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}`;
      }
      return `(${randomPick(areaCodes)}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // === ADDRESS ===
    case 'street_address':
    case 'address':
      return `${Math.floor(Math.random() * 9999) + 1} ${randomPick(RANDOM_DATA.streetNames)} ${randomPick(RANDOM_DATA.streetTypes)}`;
    
    case 'address_line2':
      const aptTypes = ['Apt', 'Suite', 'Unit', '#'];
      return `${randomPick(aptTypes)} ${Math.floor(Math.random() * 999) + 1}`;

    case 'city':
      return randomPick(RANDOM_DATA.cities);

    case 'state':
      return randomPick(RANDOM_DATA.states);

    case 'state_abbr':
      return randomPick(RANDOM_DATA.stateAbbreviations);

    case 'zip':
      return String(Math.floor(Math.random() * 90000) + 10000);
    
    case 'country':
      return randomPick(['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France']);

    // === FINANCIAL ===
    case 'credit_card':
      return `4111 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}`;
    
    case 'cvv':
      const len = c.length ?? 3;
      return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, '0');
    
    case 'currency':
    case 'amount': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 1000;
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return value.toFixed(2);
    }

    // === IDENTITY ===
    case 'ssn':
      return `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000) + 1000}`;
    
    case 'age': {
      const min = c.minValue ?? 18;
      const max = c.maxValue ?? 80;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    
    case 'gender':
      return randomPick(['Male', 'Female', 'Other', 'Prefer not to say']);

    // === ACCOUNT ===
    case 'username':
      return `${randomPick(RANDOM_DATA.firstNames).toLowerCase()}${Math.floor(Math.random() * 10000)}`;

    case 'password': {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      const pwLen = c.length ?? 12;
      let pw = '';
      for (let i = 0; i < pwLen; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
      return pw;
    }

    // === BUSINESS ===
    case 'company':
      return `${randomPick(RANDOM_DATA.companyPrefixes)} ${randomPick(RANDOM_DATA.companySuffixes)}`;
      
    case 'job_title':
      return randomPick(RANDOM_DATA.jobTitles);

    // === WEB ===
    case 'url':
      return `https://www.${randomPick(RANDOM_DATA.companyPrefixes).toLowerCase().replace(/\s/g, '')}.com`;
    
    case 'ip_address':
      return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

    // === DATES ===
    case 'date':
      return new Date().toISOString().split('T')[0];

    case 'date_future': {
      const days = Math.floor(Math.random() * 365) + 1;
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }

    case 'date_past': {
      const days = Math.floor(Math.random() * 365) + 1;
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    }

    // === NUMBERS ===
    case 'number': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 100;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    // === TEXT ===
    case 'paragraph':
    case 'lorem': {
      const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'tempor'];
      return Array.from({length: 15}, () => randomPick(words)).join(' ') + '.';
    }

    case 'text':
    default:
      // For unknown types, generate sensible text
      return `Test_${randomPick(RANDOM_DATA.words)}_${Math.floor(Math.random() * 1000)}`;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedWorkflowEditor() {
  const [searchParams] = useSearchParams();
  const location = useLocation(); // Track location changes to reload from localStorage
  const testCaseIdFromUrl = searchParams.get('testCaseId') || undefined;

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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
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

  // ═══════════════════════════════════════════════════════════════
  // MANUAL EXECUTION MODE
  // ═══════════════════════════════════════════════════════════════
  const [isManualExecution, setIsManualExecution] = useState(false);
  const [manualCurrentStep, setManualCurrentStep] = useState(0);
  const [manualResults, setManualResults] = useState<Record<string, { 
    result: 'passed' | 'failed' | 'skipped' | 'blocked';
    notes?: string;
    executedAt: string;
  }>>({});
  const [manualExecutionStartTime, setManualExecutionStartTime] = useState<Date | null>(null);

  // QA Validation Coverage
  const [showDomainSelector, setShowDomainSelector] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainType>(testCase.domain || 'general');
  const [coveredValidations, setCoveredValidations] = useState<string[]>(testCase.coveredValidations || []);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'validations'>('details');
  const [rightPanelMode, setRightPanelMode] = useState<'step' | 'protocol'>('step');
  
  // Clipboard for step copy/paste
  const [stepClipboard, setStepClipboard] = useState<TestStep[] | null>(null);
  
  // Keyboard shortcuts for steps (Delete, Ctrl+C, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete key - delete selected step
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStepId) {
        e.preventDefault();
        const stepName = testCase.steps.find(s => s.id === selectedStepId)?.name || 'step';
        setTestCase(prev => ({
          ...prev,
          steps: prev.steps.filter(s => s.id !== selectedStepId),
        }));
        setSelectedStepId(null);
        toast.success(`Deleted step: ${stepName}`);
      }
      
      // Ctrl+C / Cmd+C - Copy selected step
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedStepId) {
        e.preventDefault();
        const stepToCopy = testCase.steps.find(s => s.id === selectedStepId);
        if (stepToCopy) {
          setStepClipboard([stepToCopy]);
          toast.success(`Copied step: ${stepToCopy.name}`);
        }
      }
      
      // Ctrl+V / Cmd+V - Paste step(s)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && stepClipboard && stepClipboard.length > 0) {
        e.preventDefault();
        const timestamp = Date.now();
        const newSteps = stepClipboard.map((step, idx) => ({
          ...step,
          id: `step_${timestamp}_${idx}`,
          name: `${step.name} (Copy)`,
        }));
        
        // Insert after selected step, or at end
        setTestCase(prev => {
          const selectedIndex = selectedStepId 
            ? prev.steps.findIndex(s => s.id === selectedStepId) + 1
            : prev.steps.length;
          const newStepList = [...prev.steps];
          newStepList.splice(selectedIndex, 0, ...newSteps);
          return { ...prev, steps: newStepList };
        });
        toast.success(`Pasted ${newSteps.length} step(s)`);
      }
      
      // Ctrl+D / Cmd+D - Duplicate selected step
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedStepId) {
        e.preventDefault();
        const stepToDuplicate = testCase.steps.find(s => s.id === selectedStepId);
        if (stepToDuplicate) {
          const newStep = { 
            ...stepToDuplicate, 
            id: `step_${Date.now()}`, 
            name: `${stepToDuplicate.name} (Copy)` 
          };
          setTestCase(prev => {
            const index = prev.steps.findIndex(s => s.id === selectedStepId);
            const newSteps = [...prev.steps];
            newSteps.splice(index + 1, 0, newStep);
            return { ...prev, steps: newSteps };
          });
          setSelectedStepId(newStep.id);
          toast.success('Step duplicated');
        }
      }
      
      // Arrow keys to navigate steps
      if (e.key === 'ArrowUp' && selectedStepId) {
        e.preventDefault();
        const currentIndex = testCase.steps.findIndex(s => s.id === selectedStepId);
        if (currentIndex > 0) {
          setSelectedStepId(testCase.steps[currentIndex - 1].id);
        }
      }
      if (e.key === 'ArrowDown' && selectedStepId) {
        e.preventDefault();
        const currentIndex = testCase.steps.findIndex(s => s.id === selectedStepId);
        if (currentIndex < testCase.steps.length - 1) {
          setSelectedStepId(testCase.steps[currentIndex + 1].id);
        }
      }
      
      // Escape - Deselect step
      if (e.key === 'Escape') {
        setSelectedStepId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStepId, stepClipboard, testCase.steps]);
  
  // Protocol/Network data for load testing
  const [protocolData, setProtocolData] = useState<{
    requests: Array<{
      requestId: string;
      url: string;
      method: string;
      statusCode: number;
      duration: number;
      type: string;
      requestHeaders?: Record<string, string>;
      responseHeaders?: Record<string, string>;
      timing?: Record<string, number>;
      linkedActionId?: string;
    }>;
    correlations: Array<{
      name: string;
      type: string;
      value: string;
      foundIn: string;
    }>;
    statistics: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      avgDuration: number;
      p95Duration: number;
    };
    linkedActions: Array<{
      actionId: string;
      requestIds: string[];
    }>;
  } | null>(null);

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
    const importSource = searchParams.get('import');
    const sessionId = searchParams.get('sessionId');
    
    // Handle base64-encoded import from Flowstral Desktop
    if (importSource && importSource !== 'trace') {
      try {
        // Decode base64 test case from desktop app
        const decoded = atob(decodeURIComponent(importSource));
        const desktopTestCase = JSON.parse(decoded);
        console.log('[Builder] Importing from Flowstral Desktop:', desktopTestCase);
        
        // Convert steps to our format - handle qword from recorder
        const steps: TestStep[] = (desktopTestCase.steps || []).map((step: any, idx: number) => {
          // Use qword if available, then type, then default to 'click'
          const rawType = step.qword || step.type || 'click';
          const mappedType = mapEventType(rawType);
          
          // Mask password values
          const isPasswordStep = /password|passwd|pwd|["']pw["']|\bpw\b/i.test(step.name || step.description || '');
          const value = isPasswordStep ? '••••••••' : (step.value || '');
          
          return {
            id: step.id || `step_${Date.now()}_${idx}`,
            type: mappedType,
            name: step.name || step.description || `Step ${idx + 1}`,
            selector: step.selector || step.selectorObj?.selector || '',
            selectorObj: step.selectorObj,
            value,
            url: step.url || (mappedType === 'navigate' ? step.args?.[0] : '') || '',
            qword: step.qword,  // Preserve qword for execution
            args: step.args,    // Preserve args for execution
            enabled: step.enabled !== false,
            expectedResult: step.expectedResult || '',
            isSensitive: isPasswordStep || step.isSensitive,
          };
        });
        
        setTestCase(prev => ({
          ...prev,
          id: desktopTestCase.id || `tc_${Date.now()}`,
          name: desktopTestCase.name || 'Imported from Desktop',
          description: desktopTestCase.description || 'Recorded in Flowstral Desktop',
          tags: desktopTestCase.tags || [],
          steps,
          settings: {
            ...prev.settings,
            baseUrl: desktopTestCase.settings?.baseUrl || '',
            timeout: desktopTestCase.settings?.timeout || 30000,
          },
          metadata: {
            ...prev.metadata,
            ...desktopTestCase.metadata,
            source: 'flowstral-desktop',
          },
        }));
        
        toast.success(`Imported "${desktopTestCase.name}" with ${steps.length} steps from Desktop`);
        return;
      } catch (e) {
        console.error('[Builder] Failed to decode desktop import:', e);
        // Fall through to other import methods
      }
    }
    
    // Handle import=trace from Trace page
    if (importSource === 'trace') {
      const sessionData = localStorage.getItem('workflow_import_session');
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          console.log('[Builder] Importing from Trace session:', session);
          
          let steps: TestStep[] = [];
          
          // Convert session actions to steps - PRESERVE selectorObj for fallbacks
          if (session.actions && Array.isArray(session.actions)) {
            steps = session.actions.map((action: any, idx: number) => {
              const eventType = mapEventType(action.type || 'click');
              const rawName = action.description || action.name || `Step ${idx + 1}`;
              return {
                id: `step_${Date.now()}_${idx}`,
                type: eventType,
                name: cleanStepName(rawName, eventType), // Clean up redundant prefixes
                selector: extractSelectorString(action.selector),
                selectorObj: extractSelectorObject(action.selector, action.selectorObj, action), // CRITICAL: Preserve full selector
                value: action.value || '',
                displayValue: action.displayValue || action.value || '', // Masked value for display
                isSensitive: action.isSensitive || action.inputType === 'password',  // Preserve sensitive flag
                inputType: action.inputType || action.elementType || '',  // Preserve input type
                target: action.target || action.description || '',
                enabled: true,
                expectedResult: action.expectedResult || '',
              };
            });
          } else if (session.script) {
            // Has a script but no structured actions - create placeholder
            steps = [{
              id: `step_${Date.now()}_0`,
              type: 'navigate',
              name: 'Run Recorded Script',
              url: session.startUrl || '',
              enabled: true,
              expectedResult: 'Script executes successfully',
            }];
          }
          
          // Add navigate step if we have a startUrl
          if (session.startUrl && steps.length > 0 && steps[0].type !== 'navigate') {
            steps.unshift({
              id: `step_${Date.now()}_nav`,
              type: 'navigate',
              name: 'Open Application',
              url: session.startUrl,
              enabled: true,
              expectedResult: 'Page loads successfully',
            });
          }
          
          setTestCase(prev => ({
            ...prev,
            name: session.name || 'Imported Recording',
            description: session.description || `Imported from Trace - ${session.actionCount || steps.length} steps`,
            steps,
            settings: {
              ...prev.settings,
              baseUrl: session.startUrl || '',
            },
          }));
          
          // Clear the import data
          localStorage.removeItem('workflow_import_session');
          toast.success(`Imported "${session.name}" with ${steps.length} steps`);
          return;
        } catch (e) {
          console.error('Failed to import from Trace:', e);
          toast.error('Failed to import recording');
        }
      }
    }
    
    // Handle sessionId from Flowstral
    if (sessionId) {
      loadFromFlowstralSession(sessionId);
      return;
    }
    
    if (data) {
      try {
        // Try base64 decoding first (from Electron export)
        let decodedData = data;
        try {
          decodedData = atob(decodeURIComponent(data));
          console.log('[Builder] Decoded base64 data');
        } catch (b64Error) {
          // Not base64, try as URI-encoded JSON
          decodedData = decodeURIComponent(data);
        }
        
        const parsed = JSON.parse(decodedData);
        console.log('[Builder] Loading from URL data:', parsed);
        console.log('[Builder] Parsed data has', parsed.steps?.length, 'steps');
        
        // Direct test case format (from Electron export)
        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          // Check if already in TestStep format
          if (parsed.steps[0].type) {
            console.log('[Builder] Direct test case format detected');
            // Clean up step names
            const cleanedSteps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
            
            setTestCase(prev => ({
              ...prev,
              id: parsed.id || prev.id,
              name: parsed.name || 'Recorded Test',
              description: parsed.description || '',
              steps: cleanedSteps,
              settings: {
                ...prev.settings,
                baseUrl: parsed.settings?.baseUrl || '',
              },
              metadata: {
                ...prev.metadata,
                ...parsed.metadata,
              }
            }));
            console.log('[Builder] Loaded', cleanedSteps.length, 'steps from URL data');
            return; // Exit early
          }
        }
        
        // Legacy format conversion
        if (parsed.events || parsed.nodes) {
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
      // IMPORTANT: If testCaseIdFromUrl is present, skip localStorage loading
      // because loadTestCaseById will handle it in a separate useEffect
      const testCaseIdParam = searchParams.get('testCaseId');
      if (testCaseIdParam) {
        console.log('[Builder] testCaseId in URL, skipping localStorage load - will load by ID');
        // Clear any stale localStorage data to prevent confusion
        localStorage.removeItem('unified_test_case_timestamp');
        return;
      }
      
      // Load from localStorage (recording import)
      const saved = localStorage.getItem('unified_test_case');
      const timestamp = localStorage.getItem('unified_test_case_timestamp');
      console.log('[Builder] Checking localStorage for unified_test_case:', saved ? 'FOUND' : 'NOT FOUND', 'timestamp:', timestamp);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('[Builder] Loading from localStorage:', parsed);
          console.log('[Builder] Steps count:', parsed.steps?.length, 'steps');
          
          // Clear the timestamp after reading to avoid re-loading on future visits
          if (timestamp) {
            localStorage.removeItem('unified_test_case_timestamp');
          }
          
          // Clean step names and ensure selectorObj is preserved
          if (parsed.steps && Array.isArray(parsed.steps)) {
            parsed.steps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              // Ensure selectorObj is preserved for fallback selectors
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
          }
          
          setTestCase(parsed);
          console.log('[Builder] TestCase set successfully with', parsed.steps?.length, 'steps');
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      } else {
        console.log('[Builder] No saved test case in localStorage');
      }
    }
  }, [searchParams, location.key]); // Include location.key to trigger on navigation
  
  // Also listen for storage events (when another window/tab sets localStorage)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'unified_test_case' && e.newValue) {
        console.log('[Builder] Storage event detected - reloading test case');
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            parsed.steps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
          }
          setTestCase(parsed);
          console.log('[Builder] Loaded from storage event:', parsed.steps?.length, 'steps');
        } catch (err) {
          console.error('[Builder] Failed to parse storage event data:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  // Load protocol data from localStorage (injected by recorder)
  useEffect(() => {
    // Check for unified test case with protocol data
    const unifiedTestCase = localStorage.getItem('unified_test_case');
    if (unifiedTestCase) {
      try {
        const parsed = JSON.parse(unifiedTestCase);
        
        // Check for network/protocol data
        const networkData = parsed.network_data || parsed.networkData || parsed.protocolData;
        if (networkData && networkData.requests && networkData.requests.length > 0) {
          console.log('[Builder] Found protocol data:', networkData.requests.length, 'requests');
          setProtocolData({
            requests: networkData.requests || [],
            correlations: networkData.correlations || [],
            statistics: networkData.statistics || {
              totalRequests: networkData.requests?.length || 0,
              successfulRequests: networkData.requests?.filter((r: any) => r.statusCode >= 200 && r.statusCode < 400).length || 0,
              failedRequests: networkData.requests?.filter((r: any) => r.statusCode >= 400).length || 0,
              avgDuration: Math.round((networkData.requests || []).reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / (networkData.requests?.length || 1)),
              p95Duration: 0,
            },
            linkedActions: networkData.linkedActions || [],
          });
          setRightPanelMode('protocol');
          toast.success(`Loaded ${networkData.requests.length} HTTP requests from recording!`);
        }
      } catch (e) {
        console.error('Failed to parse protocol data:', e);
      }
    }
    
    // Also check for standalone protocol data
    const standaloneProtocol = localStorage.getItem('qaai_protocol_data');
    if (standaloneProtocol) {
      try {
        const parsed = JSON.parse(standaloneProtocol);
        if (parsed.requests && parsed.requests.length > 0) {
          console.log('[Builder] Found standalone protocol data:', parsed.requests.length, 'requests');
          setProtocolData(parsed);
          setRightPanelMode('protocol');
          localStorage.removeItem('qaai_protocol_data'); // Clear after loading
          toast.success(`Loaded ${parsed.requests.length} HTTP requests!`);
        }
      } catch (e) {
        console.error('Failed to parse standalone protocol data:', e);
      }
    }
  }, []);
  
  // Load from Flowstral session
  const loadFromFlowstralSession = async (sessionId: string) => {
    console.log('[Builder] Loading from Flowstral session:', sessionId);
    try {
      // Try to get session artifacts from backend
      const response = await fetch(`http://localhost:8000/api/flowstral/session/${sessionId}/artifacts`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Builder] Flowstral session data:', data);
        
        let steps: TestStep[] = [];
        const actions = data.actions || data.events || data.nodes || [];
        
        if (actions.length > 0) {
          steps = actions.map((action: any, idx: number) => {
            const eventType = mapEventType(action.type || action.action_type || 'click');
            const rawName = action.label || action.description || action.name || `Step ${idx + 1}`;
            return {
              id: `step_${Date.now()}_${idx}`,
              type: eventType,
              name: cleanStepName(rawName, eventType), // Clean up redundant prefixes
              selector: extractSelectorString(action.selector),
              selectorObj: extractSelectorObject(action.selector, action.selectorObj, action), // CRITICAL: Preserve full selector
              value: action.value || action.input_value || '',
              displayValue: action.displayValue || action.value || '', // Masked value for display
              isSensitive: action.isSensitive || action.inputType === 'password',  // Preserve sensitive flag
              inputType: action.inputType || action.elementType || '',  // Preserve input type
              target: extractTargetName(action.selector, action),
              enabled: true,
              expectedResult: action.expected_result || '',
            };
          });
        }
        
        const startUrl = data.start_url || data.startUrl || data.base_url || '';
        
        // Add navigate step first
        if (startUrl && steps.length > 0 && steps[0].type !== 'navigate') {
          steps.unshift({
            id: `step_${Date.now()}_nav`,
            type: 'navigate',
            name: 'Open Application',
            url: startUrl,
            enabled: true,
            expectedResult: 'Page loads successfully',
          });
        }
        
        setTestCase(prev => ({
          ...prev,
          name: data.name || data.session_name || 'Flowstral Recording',
          description: data.description || `Imported from Flowstral session ${sessionId}`,
          steps,
          settings: {
            ...prev.settings,
            baseUrl: startUrl,
          },
        }));
        
        toast.success(`Loaded session with ${steps.length} steps`);
      } else {
        toast.error('Could not load Flowstral session');
      }
    } catch (error) {
      console.error('Failed to load Flowstral session:', error);
      toast.error('Failed to load session');
    }
  };

  // Load test case by ID from URL parameter
  const loadTestCaseById = useCallback(async (testCaseId: string) => {
    console.log('[Builder] Loading test case by ID:', testCaseId);
    
    try {
      // First try localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      let foundCase = localCases.find((tc: any) => tc.id === testCaseId);
      
      // Try scale-data backend endpoint (for scale testing data)
      if (!foundCase) {
        try {
          console.log('[Builder] Trying scale-data endpoint...');
          const scaleResponse = await fetch(`http://localhost:8000/test-cases/scale-data/test-case/${testCaseId}`);
          if (scaleResponse.ok) {
            foundCase = await scaleResponse.json();
            console.log('[Builder] Found in scale-data:', foundCase?.name);
          }
        } catch {
          console.log('[Builder] Scale-data endpoint not available');
        }
      }
      
      // Try regular backend endpoint
      if (!foundCase) {
        try {
          const response = await fetch(`http://localhost:8000/test-cases/${testCaseId}`);
          if (response.ok) {
            foundCase = await response.json();
          }
        } catch {
          console.log('Could not fetch from backend');
        }
      }
      
      if (!foundCase) {
        toast.error('Test case not found');
        return;
      }
      
      // PRIORITY 1: Try to load from unified_data (contains the full test case with proper step format)
      if (foundCase.unified_data) {
        try {
          const unifiedData = typeof foundCase.unified_data === 'string' 
            ? JSON.parse(foundCase.unified_data) 
            : foundCase.unified_data;
          
          if (unifiedData.steps && Array.isArray(unifiedData.steps)) {
            console.log('[Builder] Loading from unified_data:', unifiedData.steps.length, 'steps');
            setTestCase(prev => ({
              ...prev,
              id: testCaseId,
              name: unifiedData.name || foundCase.name || foundCase.title || 'Imported Test Case',
              description: unifiedData.description || foundCase.description || '',
              tags: unifiedData.tags || foundCase.tags || [],
              steps: unifiedData.steps,
              settings: unifiedData.settings || prev.settings,
              preconditions: unifiedData.preconditions || [],
            }));
            setSavedTestCaseId(testCaseId);
            toast.success(`Loaded "${unifiedData.name || foundCase.name}" with ${unifiedData.steps.length} steps`);
            return;
          }
        } catch (e) {
          console.warn('[Builder] Failed to parse unified_data, falling back to steps:', e);
        }
      }

      // PRIORITY 2: Convert test case steps to TestStep format (legacy format)
      const rawSteps = foundCase.steps || [];
      const convertedSteps: TestStep[] = rawSteps.map((step: any, index: number) => {
        // Try to parse test_data as JSON to get the original step
        let originalStep: any = null;
        if (step.test_data) {
          try {
            originalStep = typeof step.test_data === 'string' 
              ? JSON.parse(step.test_data) 
              : step.test_data;
          } catch (e) {
            console.warn('[Builder] Could not parse test_data for step', index);
          }
        }
        
        // Use original step data if available
        if (originalStep && originalStep.type) {
          // Clean up selector - extract the actual CSS selector if wrapped in locator()
          let selector = originalStep.selector || '';
          if (typeof selector === 'string') {
            const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
            if (locatorMatch) {
              selector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
          }
          
          return {
            ...originalStep,
            id: originalStep.id || `step_${Date.now()}_${index}`,
            selector: selector,
            // Ensure value is a simple string, not a JSON object
            value: typeof originalStep.value === 'string' ? originalStep.value : '',
          };
        }
        
        // Fallback: Parse from action text
        const action = step.action || step.description || '';
        const actionLower = action.toLowerCase();
        
        // Determine step type from action text
        let stepType: StepType = 'click';
        if (actionLower.includes('navigate') || actionLower.includes('go to') || actionLower.includes('open')) stepType = 'navigate';
        else if (actionLower.includes('enter') || actionLower.includes('type') || actionLower.includes('input') || actionLower.includes('fill')) stepType = 'input';
        else if (actionLower.includes('wait')) stepType = 'wait';
        else if (actionLower.includes('verify') || actionLower.includes('assert') || actionLower.includes('check') || actionLower.includes('confirm')) stepType = 'assert';
        else if (actionLower.includes('select') || actionLower.includes('choose')) stepType = 'select';
        else if (actionLower.includes('hover')) stepType = 'hover';
        else if (actionLower.includes('screenshot')) stepType = 'screenshot';
        
        // Extract value from action - DO NOT use test_data as it contains the entire step JSON
        let value = '';
        // Only use step.value if it's a simple string, not test_data
        if (typeof step.value === 'string' && !step.value.startsWith('{')) {
          value = step.value;
        }
        if (!value && stepType === 'input') {
          const valueMatch = action.match(/["']([^"']+)["']|enter\s+(.+)/i);
          if (valueMatch) value = valueMatch[1] || valueMatch[2] || '';
        }
        
        // Extract URL for navigate
        let url = '';
        if (stepType === 'navigate') {
          const urlMatch = action.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) url = urlMatch[0];
        }
        
        // Clean up selector - extract the actual CSS selector if wrapped in locator()
        let selector = step.selector || '';
        if (typeof selector === 'string') {
          // If selector is wrapped like locator('[name="x"]'), extract the inner part
          const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
          if (locatorMatch) {
            selector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
          }
        } else {
          selector = '';
        }
        
        return {
          id: `step_${Date.now()}_${index}`,
          type: stepType,
          name: action.slice(0, 50) || `Step ${index + 1}`,
          description: action,
          selector: selector,
          value: value,
          url: url,
          enabled: true,
          expectedResult: step.expected_result || step.expectedResult || 'Step completes successfully',
          assertion: step.expected_result || step.expectedResult ? {
            enabled: true,
            type: 'visible',
            expected: step.expected_result || step.expectedResult,
          } : undefined,
        };
      });
      
      // Update test case state
      setTestCase(prev => ({
        ...prev,
        id: testCaseId,
        name: foundCase.name || foundCase.title || 'Imported Test Case',
        description: foundCase.description || '',
        tags: foundCase.tags || [],
        steps: convertedSteps,
      }));
      
      setSavedTestCaseId(testCaseId);
      toast.success(`Loaded "${foundCase.name || foundCase.title}" with ${convertedSteps.length} steps`);
    } catch (error: any) {
      console.error('Error loading test case:', error);
      toast.error(`Error loading test case: ${error.message}`);
    }
  }, []);

  // Track if initial load is complete to prevent auto-save race condition
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Auto-load test case from URL parameter
  useEffect(() => {
    if (testCaseIdFromUrl) {
      loadTestCaseById(testCaseIdFromUrl);
    }
  }, [testCaseIdFromUrl, loadTestCaseById]);

  // Mark initial load as complete after first render cycle
  useEffect(() => {
    // Small delay to ensure loading useEffects have completed
    const timer = setTimeout(() => {
      setIsInitialLoadComplete(true);
      console.log('[Builder] Initial load complete, auto-save enabled');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-save - only after initial load is complete to prevent overwriting imported data
  useEffect(() => {
    if (!isInitialLoadComplete) {
      console.log('[Builder] Skipping auto-save during initial load');
      return;
    }
    console.log('[Builder] Auto-saving test case with', testCase.steps?.length, 'steps');
    localStorage.setItem('unified_test_case', JSON.stringify(testCase));
  }, [testCase, isInitialLoadComplete]);

  // Save history
  useEffect(() => {
    localStorage.setItem('unified_test_history', JSON.stringify(testHistory));
  }, [testHistory]);

  // Convert recorded events to steps (from raw events)
  // PRESERVES selectorObj with fallbacks - same as Suggest feature
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
      // Extract string selector from event (may be object or string)
      const selectorStr = extractSelectorString(event.selector);
      
      // PRESERVE the full selectorObj with fallbacks (same structure as Suggest)
      const selectorObj = extractSelectorObject(event.selector, event.selectorObj, event);

      const step: TestStep = {
        id: `step_${Date.now()}_${idx}`,
        type: mapEventType(event.type),
        name: generateStepName(event),
        selector: selectorStr,
        selectorObj,  // Preserve full selector with fallbacks
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
  // PRESERVES selectorObj with fallbacks - same as Suggest feature
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
      // Extract string selector from node (may be object or string)
      const rawSelector = nodeData.selector || node.selector;
      const selectorStr = extractSelectorString(rawSelector);
      
      // PRESERVE the full selectorObj with fallbacks (same structure as Suggest)
      const selectorObj = extractSelectorObject(
        rawSelector,
        nodeData.selectorObj || node.selectorObj,
        nodeData
      );

      const step: TestStep = {
        id: node.id || `step_${Date.now()}_${idx}`,
        type: mapEventType(node.type || nodeData.type || 'click'),
        name: node.label || nodeData.label || generateNodeName(node),
        selector: selectorStr,
        selectorObj,  // Preserve full selector with fallbacks
        value: nodeData.value || node.value,
        url: nodeData.url || node.url,
        target: extractTargetName(rawSelector, nodeData),
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
    const normalized = (type || '').toLowerCase();
    const map: Record<string, StepType> = {
      'click': 'click',
      'clicktext': 'click',
      'clickelement': 'click',
      'input': 'input',
      'type': 'input',
      'fill': 'input',
      'select': 'select',
      'navigate': 'navigate',
      'navigateto': 'navigate',  // SF Tool NavigateTo
      'goto': 'navigate',
      'wait': 'wait',
      'assert': 'assert',
      'asserttext': 'assert',
      'assertfieldvalue': 'assert',
      'assertvalidation': 'assert',
      'hover': 'hover',
      // SF Tools - map to custom or navigate
      'executesoql': 'api',
      'executeapex': 'api',
      'restapicall': 'api',
      'createrecord': 'api',
      'createtestdata': 'api',
      'clonerecord': 'api',
      'deleterecord': 'api',
      'bulkload': 'api',
      'runreport': 'api',
      'runapextest': 'api',
      'triggerflow': 'api',
      'managepermissionset': 'api',
    };
    return map[normalized] || 'click';
  };

  // Clean step name - remove redundant type prefixes (e.g., "Click: Click" -> "Click")
  // Also masks passwords and fixes garbled UTF-8 characters
  const cleanStepName = (name: string, type?: string): string => {
    if (!name) return name;
    
    let cleaned = name;
    
    // Detect password fields by name pattern - match "pw" as word or in quotes
    const isPasswordField = /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(name);
    
    // Detect garbled UTF-8 characters (encoding issues)
    const hasGarbledChars = /[āã口¢Γ]/.test(name);
    
    // If it's a password field or has garbled chars, mask the value
    if (isPasswordField || hasGarbledChars) {
      // Replace quoted values with mask (handles: "value" or 'value')
      cleaned = cleaned.replace(/["'][^"']+["']/g, (match, offset) => {
        // Preserve field name (first quoted value), mask password (second quoted value)
        // Pattern: Fill "fieldName": "value"
        if (offset > 10) return '"••••••••"';
        return match;
      });
      
      // If the entire name is garbled, replace it
      if (hasGarbledChars && cleaned === name) {
        // Keep the action and field name, replace garbled value
        if (cleaned.includes(':')) {
          const parts = cleaned.split(':');
          cleaned = `${parts[0]}: "••••••••"`;
        }
      }
    }
    
    // Remove redundant patterns like "Click: Click" or "Navigate: Navigate"
    // Handle patterns like: "Click: Click 'text'" -> "Click 'text'"
    // Handle patterns like: "Navigate: Navigate to X" -> "Navigate to X"
    const patterns = [
      { pattern: /^Click:\s*Click\s+/i, replacement: 'Click ' },
      { pattern: /^Input:\s*Input\s+/i, replacement: 'Input ' },
      { pattern: /^Navigate:\s*Navigate\s+/i, replacement: 'Navigate ' },
      { pattern: /^Select:\s*Select\s+/i, replacement: 'Select ' },
      { pattern: /^Wait:\s*Wait\s+/i, replacement: 'Wait ' },
      { pattern: /^Assert:\s*Assert\s+/i, replacement: 'Assert ' },
    ];
    
    for (const { pattern, replacement } of patterns) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, replacement);
        break;
      }
    }
    
    return cleaned.trim() || name;
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

  const convertWorkflowStep = (node: any): TestStep => {
    const rawSelector = node.data?.selector || node.selector;
    const selectorStr = extractSelectorString(rawSelector);
    
    return {
      id: node.id || `step_${Date.now()}`,
      type: mapEventType(node.type || 'click'),
      name: node.label || node.name || 'Step',
      selector: selectorStr,
      value: node.data?.value || node.value,
      url: node.data?.url || node.url,
      target: extractTargetName(rawSelector, node.data),
      enabled: true,
      expectedResult: node.data?.manualStep?.expectedResult || node.expectedResult || '',
      assertion: node.data?.assertion,
    };
  };

  // Step operations
  const addStep = (type: StepType) => {
    const info = getStepInfo(type);

    // Type-specific defaults
    const typeDefaults: Record<string, Partial<TestStep>> = {
      navigate: {
        name: 'Navigate',
        url: testCase.settings.baseUrl || '',
        expectedResult: 'Page should load successfully'
      },
      click: {
        name: 'Click: [element]',
        expectedResult: 'Element should be clicked'
      },
      input: {
        name: 'Input: [field]',
        value: '',
        expectedResult: 'Value should be entered'
      },
      select: {
        name: 'Select: [option]',
        value: '',
        expectedResult: 'Option should be selected'
      },
      hover: {
        name: 'Hover: [element]',
        expectedResult: 'Element should be hovered'
      },
      wait: {
        name: 'Wait',
        waitTime: 1000,
        expectedResult: 'Wait completed'
      },
      wait_for_element: {
        name: 'Wait for: [element]',
        expectedResult: 'Element should appear'
      },
      assert: {
        name: 'Check: Element Visible',
        expectedResult: 'Element should be visible'
      },
      assert_text: {
        name: 'Verify: Text Contains',
        expectedResult: 'Text should contain expected value'
      },
      assert_value: {
        name: 'Verify: Field Value',
        expectedResult: 'Field value should match expected'
      },
      assert_url: {
        name: 'Verify: URL',
        expectedResult: 'URL should match expected'
      },
      assert_title: {
        name: 'Verify: Page Title',
        expectedResult: 'Page title should match'
      },
      assert_count: {
        name: 'Verify: Element Count',
        expectedResult: 'Element count should match expected'
      },
      screenshot: {
        name: 'Take Screenshot',
        expectedResult: 'Screenshot captured'
      },
      log: {
        name: 'Log: [message]',
        expectedResult: 'Log entry created'
      },
      annotation: {
        name: 'Note: [description]',
        expectedResult: 'Note added to test'
      },
      api: {
        name: 'API: [endpoint]',
        method: 'GET',
        endpoint: '',
        expectedResult: 'API call should succeed'
      },
      api_validate: {
        name: 'Validate: API Response',
        expectedResult: 'Response should match expected'
      },
      api_extract: {
        name: 'Extract: [field] from Response',
        jsonPath: '',
        storeAs: 'extracted_value',
        expectedResult: 'Value extracted from response'
      },
      db_query: {
        name: 'Query: [table]',
        dbType: 'postgres',
        query: '',
        expectedResult: 'Query should return results'
      },
      db_validate: {
        name: 'Validate: DB Record',
        expectedResult: 'Database record should match expected'
      },
      condition: {
        name: 'If: [condition]',
        condition: '',
        expectedResult: 'Condition evaluated'
      },
      loop: {
        name: 'Loop: [count] times',
        loopCount: 1,
        expectedResult: 'Loop completed'
      },
      module: {
        name: 'Run Module: [name]',
        moduleId: '',
        expectedResult: 'Module executed successfully'
      },
      group: {
        name: 'Group: [steps]',
        expectedResult: 'Group of steps executed'
      },
      wait_for_text: {
        name: 'Wait for: [text]',
        expectedResult: 'Text should appear on page'
      },
      wait_for_network: {
        name: 'Wait for: Network Idle',
        expectedResult: 'Network should be idle'
      },
      set_variable: {
        name: 'Set: [variable]',
        variableName: '',
        variableValue: '',
        expectedResult: 'Variable set'
      },
      generate_data: {
        name: 'Generate: [data type]',
        dataType: 'random_string',
        storeAs: 'generated_data',
        expectedResult: 'Data generated'
      },
      extract_text: {
        name: 'Extract: Text from [element]',
        storeAs: 'extracted_text',
        expectedResult: 'Text extracted from page'
      },
      use_data_row: {
        name: 'Use: Data Row [index]',
        dataSource: '',
        rowIndex: 0,
        expectedResult: 'Data row applied'
      },
      upload: {
        name: 'Upload: [file]',
        filePath: '',
        expectedResult: 'File uploaded successfully'
      },
      // BLACK-BOX TESTING - Date & Time
      date_relative: {
        name: 'Generate Relative Date',
        daysOffset: 1, // tomorrow by default
        dateFormat: 'MM/DD/YYYY',
        storeAs: 'generated_date',
        expectedResult: 'Date generated and stored in variable'
      },
      date_verify_future: {
        name: 'Verify Date is Future',
        selector: '',
        expectedResult: 'Date should be in the future'
      },
      date_verify_sequence: {
        name: 'Verify Date Sequence',
        startDateSelector: '',
        endDateSelector: '',
        expectedResult: 'End date should be after start date'
      },
      // BLACK-BOX TESTING - Math & Calculations
      math_verify_multiply: {
        name: 'Verify Multiplication',
        factor1Selector: '',
        factor2Selector: '',
        resultSelector: '',
        expectedResult: 'Product should equal factor1 × factor2'
      },
      math_verify_sum: {
        name: 'Verify Sum of List',
        listSelector: '',
        totalSelector: '',
        expectedResult: 'Sum of all items should equal total'
      },
      math_verify_discount: {
        name: 'Verify % Discount',
        originalPriceSelector: '',
        discountPercent: 10,
        finalPriceSelector: '',
        expectedResult: 'Discount should be correctly applied'
      },
      // BLACK-BOX TESTING - Format Validation
      format_verify: {
        name: 'Verify Format',
        selector: '',
        formatType: 'email', // email, phone, ssn, zip, credit_card, date, custom
        customRegex: '',
        expectedResult: 'Value should match expected format'
      },
      random_string: {
        name: 'Generate Random String',
        length: 10,
        stringType: 'alphanumeric', // alphanumeric, alpha, numeric, email, phone
        storeAs: 'random_value',
        expectedResult: 'Random string generated and stored'
      },
      // BLACK-BOX TESTING - Cross-field & Boundary
      field_visibility: {
        name: 'Verify Field Visibility',
        triggerSelector: '',
        triggerValue: '',
        targetSelector: '',
        shouldBeVisible: true,
        expectedResult: 'Field visibility should change based on trigger'
      },
      boundary_test: {
        name: 'Boundary Value Test',
        inputSelector: '',
        minValue: 0,
        maxValue: 100,
        submitSelector: '',
        errorSelector: '',
        expectedResult: 'Boundary values should be validated correctly'
      },
    };

    const defaults = typeDefaults[type] || {};

    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      type,
      name: defaults.name || info.label,
      enabled: true,
      expectedResult: defaults.expectedResult || '',
      ...defaults,
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

  // Drag and drop handlers for step reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Reorder steps while dragging for smooth visual feedback
    setTestCase(prev => {
      const newSteps = [...prev.steps];
      const [removed] = newSteps.splice(draggedIndex, 1);
      newSteps.splice(index, 0, removed);
      return { ...prev, steps: newSteps };
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // Update timestamp
    setTestCase(prev => ({
      ...prev,
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() }
    }));
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

  // Load precondition test case steps
  const loadPreconditionSteps = async (preconditionId: string): Promise<TestStep[]> => {
    try {
      // First try localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      let foundCase = localCases.find((tc: any) => tc.id === preconditionId);
      
      // Try backend if not found locally
      if (!foundCase) {
        try {
          const response = await fetch(`http://localhost:8000/test-cases/${preconditionId}`);
          if (response.ok) {
            foundCase = await response.json();
          }
        } catch {
          console.log('Could not fetch precondition from backend');
        }
      }
      
      if (!foundCase) {
        console.warn(`Precondition test case ${preconditionId} not found`);
        return [];
      }
      
      // Try to load from unified_data first
      if (foundCase.unified_data) {
        try {
          const unifiedData = typeof foundCase.unified_data === 'string' 
            ? JSON.parse(foundCase.unified_data) 
            : foundCase.unified_data;
          
          if (unifiedData.steps && Array.isArray(unifiedData.steps)) {
            console.log(`[Precondition] Loaded ${unifiedData.steps.length} steps from unified_data`);
            return unifiedData.steps;
          }
        } catch (e) {
          console.warn('Failed to parse unified_data for precondition');
        }
      }
      
      // Fallback: convert steps from raw format
      const rawSteps = foundCase.steps || [];
      return rawSteps.map((step: any, index: number) => {
        // Try to parse test_data
        let originalStep: any = null;
        if (step.test_data) {
          try {
            originalStep = typeof step.test_data === 'string' 
              ? JSON.parse(step.test_data) 
              : step.test_data;
          } catch (e) {}
        }
        
        if (originalStep && originalStep.type) {
          return {
            ...originalStep,
            id: `precond_${preconditionId}_${index}`,
          };
        }
        
        // Basic conversion
        return {
          id: `precond_${preconditionId}_${index}`,
          type: 'click' as StepType,
          name: step.action || `Step ${index + 1}`,
          selector: step.selector || '',
          value: typeof step.value === 'string' ? step.value : '',
          enabled: true,
        };
      });
    } catch (error) {
      console.error('Error loading precondition:', error);
      return [];
    }
  };

  // Run test
  const runTest = async () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to run the test');
      return;
    }

    setIsRunning(true);
    setExecutionResult({ status: 'running', currentStep: 0, results: [], logs: [] });

    try {
      // Load precondition steps and merge them
      let allSteps: TestStep[] = [];
      
      if (testCase.preconditions && testCase.preconditions.length > 0) {
        const enabledPreconditions = testCase.preconditions.filter(p => p.enabled);
        
        for (const precond of enabledPreconditions) {
          console.log(`[Run Test] Loading precondition: ${precond.testCaseName}`);
          toast.info(`Loading precondition: ${precond.testCaseName}`);
          
          const precondSteps = await loadPreconditionSteps(precond.testCaseId);
          
          if (precondSteps.length > 0) {
            // Mark these steps as precondition steps
            const markedSteps = precondSteps.map((step, idx) => ({
              ...step,
              name: `[Precond] ${step.name}`,
              _isPrecondition: true,
              _preconditionName: precond.testCaseName,
            }));
            allSteps = [...allSteps, ...markedSteps];
            console.log(`[Run Test] Added ${precondSteps.length} steps from precondition: ${precond.testCaseName}`);
          } else {
            toast.warning(`Precondition "${precond.testCaseName}" has no steps`);
          }
        }
      }
      
      // Add main test steps after precondition steps
      allSteps = [...allSteps, ...testCase.steps];
      
      // Create merged test case for execution
      const mergedTestCase: UnifiedTestCase = {
        ...testCase,
        steps: allSteps,
        preconditions: [], // Clear preconditions since we're inlining them
      };
      
      // In Electron, use local Playwright execution for better performance
      if (isElectron()) {
        const api = (window as any).electronAPI;
        if (api?.testRunner) {
          console.log('[Run Test] Using Electron local execution');
          toast.info('Running test locally...');
          
          // Subscribe to step events
          const stepStartUnsub = api.on('test-step-start', ({ index, step }: { index: number; step: any }) => {
            setExecutionResult(prev => ({
              ...prev,
              currentStep: index,
              logs: [...prev.logs, `▶ Step ${index + 1}: ${step.name || step.type}`]
            }));
          });
          
          const stepCompleteUnsub = api.on('test-step-complete', ({ index, step, result }: { index: number; step: any; result: any }) => {
            const statusEmoji = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
            setExecutionResult(prev => ({
              ...prev,
              results: [...prev.results, result],
              logs: [...prev.logs, `${statusEmoji} Step ${index + 1}: ${result.status}${result.error ? ' - ' + result.error : ''}`]
            }));
          });
          
          const result = await api.testRunner.executeTest(mergedTestCase);
          
          // Cleanup subscriptions
          if (stepStartUnsub) stepStartUnsub();
          if (stepCompleteUnsub) stepCompleteUnsub();
          
          setExecutionResult(prev => ({
            ...prev,
            status: result.status,
            logs: [...prev.logs, `\n${result.status === 'passed' ? '✅ TEST PASSED' : '❌ TEST FAILED'} (${result.duration}ms)`]
          }));
          
          setIsRunning(false);
          
          if (result.status === 'passed') {
            toast.success('Test passed!');
          } else {
            toast.error(`Test failed: ${result.error || 'See logs for details'}`);
          }
          
          return;
        }
      }
      
      // Fallback to backend execution
      const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      const code = generateAutomationCode(mergedTestCase, safeName);
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
    } catch (error: any) {
      console.error('[Test Run] Execution error:', error);
      const errorMsg = error?.message || String(error) || 'Unknown error';
      const errorLogs = [
        `❌ Execution Error: ${errorMsg}`,
        '',
        'Possible causes:',
        '- Backend server not running (start with: cd backend && uvicorn app.main:app)',
        '- Network error',
        '- Invalid test code generated',
        '',
        error?.stack ? `Stack: ${error.stack}` : '',
      ].filter(Boolean);
      
      setExecutionResult(prev => ({ 
        ...prev, 
        status: 'failed', 
        logs: errorLogs
      }));
      toast.error(`Execution failed: ${errorMsg.slice(0, 50)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // MANUAL EXECUTION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  const startManualExecution = () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to execute manually');
      return;
    }
    setIsManualExecution(true);
    setManualCurrentStep(0);
    setManualResults({});
    setManualExecutionStartTime(new Date());
    toast.info('Manual execution started. Follow each step and mark Pass/Fail.');
  };

  const endManualExecution = () => {
    setIsManualExecution(false);
    
    // Calculate summary
    const results = Object.values(manualResults);
    const passed = results.filter(r => r.result === 'passed').length;
    const failed = results.filter(r => r.result === 'failed').length;
    const skipped = results.filter(r => r.result === 'skipped').length;
    const total = testCase.steps.length;
    
    // Update step results in test case
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        const result = manualResults[step.id];
        if (result) {
          return {
            ...step,
            manualResult: result.result,
            manualNotes: result.notes,
            manualExecutedAt: result.executedAt,
          };
        }
        return step;
      }),
    }));
    
    if (failed > 0) {
      toast.error(`Manual execution completed: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    } else {
      toast.success(`Manual execution completed: ${passed}/${total} passed!`);
    }
  };

  const markStepResult = (stepId: string, result: 'passed' | 'failed' | 'skipped' | 'blocked', notes?: string) => {
    setManualResults(prev => ({
      ...prev,
      [stepId]: {
        result,
        notes,
        executedAt: new Date().toISOString(),
      }
    }));
    
    // Auto-advance to next step
    if (manualCurrentStep < testCase.steps.length - 1) {
      setTimeout(() => setManualCurrentStep(prev => prev + 1), 300);
    }
  };

  const getCurrentManualStep = () => testCase.steps[manualCurrentStep];

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
      const testCaseId = savedTestCaseId || `tc_${Date.now()}`;
      
      // Create the full test case object
      const fullTestCase = {
        id: testCaseId,
        ...testCaseData,
        unified_data: testCase,
        steps: testCase.steps,
        createdAt: testCase.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to Electron local storage (JSON files) if available
      if (isElectron()) {
        await localData.saveTestCase(fullTestCase);
        console.log('[Save] Saved to Electron local storage');
      }
      
      // Also save to browser localStorage (for web and as backup)
      try {
        const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        const existingIndex = localCases.findIndex((tc: any) => tc.id === testCaseId);
        if (existingIndex >= 0) {
          localCases[existingIndex] = fullTestCase;
        } else {
          localCases.push(fullTestCase);
        }
        localStorage.setItem('test_cases', JSON.stringify(localCases));
        console.log('[Save] Saved to browser localStorage');
      } catch (localStorageError) {
        console.warn('[Save] Could not save to localStorage:', localStorageError);
      }
      
      // Update saved ID
      if (!savedTestCaseId) {
        setSavedTestCaseId(testCaseId);
      }
      
      // Also try to save to backend (may fail if offline)
      try {
        if (savedTestCaseId) {
          // Update existing test case
          const response = await fetch(`http://localhost:8000/test-cases/${savedTestCaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testCaseData),
          });
          
          if (response.ok) {
            toast.success('✅ Test case saved');
          } else {
            // Backend failed but already saved locally
            toast.success('✅ Saved locally');
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
            // Backend failed but already saved locally
            toast.success('✅ Saved locally');
          }
        }
      } catch (networkError) {
        // Network error - already saved locally
        console.log('[Save] Backend unavailable, saved locally');
        toast.success('✅ Saved locally');
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
  const generateAllTestData = (forceRegenerate = false) => {
    let count = 0;
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if ((step.type === 'input' || step.type === 'fill') && (forceRegenerate || !step.value)) {
          count++;
          // Use the step name to detect field type
          const fieldLabel = step.name || step.target || 'text';
          const detected = detectFieldType(fieldLabel);
          const newValue = generateSmartValue(detected.type, fieldLabel, detected.constraints);
          console.log(`[Fill Data] Field: "${fieldLabel}" -> Type: "${detected.type}" -> Value: "${newValue}"`);
          return {
            ...step,
            value: newValue
          };
        }
        return step;
      }),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    if (count > 0) {
      toast.success(`Generated smart test data for ${count} input fields`);
    } else {
      toast.info('No input fields to fill');
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

  // Debug: Log state on render
  console.log('[Builder] Rendering with', testCase.steps.length, 'steps');
  
  return (
    <div className="flex flex-col overflow-hidden bg-background h-full text-foreground" style={{ maxHeight: 'calc(100vh - 4rem)', minHeight: '600px' }}>
        {/* Header */}
        <header className="flex-none border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title - Expanded to show full name */}
            <div className="flex items-start gap-3 max-w-[400px]">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 dark:from-amber-500 dark:to-orange-500 shadow-lg shadow-blue-500/25 dark:shadow-amber-500/25 shrink-0 mt-1">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 group">
                {/* Display mode - truncated with ellipsis */}
                <div 
                  className="text-lg font-semibold text-foreground leading-7 cursor-text group-focus-within:hidden"
                  style={{ 
                    display: 'block',
                    maxHeight: '56px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: testCase.name.length > 40 ? 'normal' : 'nowrap',
                    wordBreak: 'break-word'
                  }}
                  onClick={(e) => {
                    const textarea = e.currentTarget.nextElementSibling as HTMLTextAreaElement;
                    textarea?.focus();
                  }}
                  title={testCase.name}
                >
                  {testCase.name || 'Test Case Name'}
                </div>
                {/* Edit mode - full textarea */}
                <Textarea
                  value={testCase.name}
                  onChange={(e) => setTestCase(prev => ({ ...prev, name: e.target.value }))}
                  className="text-lg font-semibold border-none p-0 min-h-[28px] max-h-[84px] bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground resize-none overflow-y-auto leading-7 opacity-0 absolute pointer-events-none focus:opacity-100 focus:relative focus:pointer-events-auto"
                  placeholder="Test Case Name"
                  rows={1}
                  onFocus={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.position = 'relative';
                    e.currentTarget.style.pointerEvents = 'auto';
                    const display = e.currentTarget.previousElementSibling as HTMLElement;
                    if (display) display.style.display = 'none';
                    // Auto-resize
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 84) + 'px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.opacity = '0';
                    e.currentTarget.style.position = 'absolute';
                    e.currentTarget.style.pointerEvents = 'none';
                    const display = e.currentTarget.previousElementSibling as HTMLElement;
                    if (display) display.style.display = 'block';
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 84) + 'px';
                  }}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{testCase.steps.length} steps</span>
                  <span>•</span>
                  <span>v{testCase.metadata.version}</span>
                  {testCase.priority && (
                    <>
                      <span>•</span>
                      <span className={cn(
                        testCase.priority === 'critical' && 'text-red-400',
                        testCase.priority === 'high' && 'text-orange-400',
                        testCase.priority === 'medium' && 'text-yellow-400',
                        testCase.priority === 'low' && 'text-green-400',
                      )}>{testCase.priority}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Test Type Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-500/50 dark:border-amber-500/50 text-blue-600 dark:text-amber-400 px-3 py-1">
                <FileText className="h-3 w-3 mr-1" />
                Visual Test Builder
              </Badge>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Settings */}
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>

              {/* Export Dropdown - Formats Only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Download className="h-4 w-4 mr-1.5 text-primary" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-700 min-w-[200px]">
                  <DropdownMenuLabel className="text-amber-400">Export Formats</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('istqb');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <FileText className="h-4 w-4 mr-2 text-blue-400" />
                    ISTQB Format
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('gherkin');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <Code className="h-4 w-4 mr-2 text-green-400" />
                    Gherkin/BDD Format
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('markdown');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <FileText className="h-4 w-4 mr-2 text-purple-400" />
                    Markdown Format
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={() => handleExport('automation')}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <Play className="h-4 w-4 mr-2 text-amber-400" />
                    Playwright Script
                  </DropdownMenuItem>
                  
                  {/* Electron-specific options */}
                  {isElectron() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-amber-400/70">Desktop Export</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const api = (window as any).electronAPI;
                            const result = await api?.localStorage?.exportToFile();
                            if (result?.success) {
                              toast.success(`Exported to ${result.filePath}`);
                            } else if (!result?.canceled) {
                              toast.error('Export failed');
                            }
                          } catch (e) {
                            toast.error('Export failed');
                          }
                        }}
                        className="hover:bg-accent text-foreground focus:bg-accent"
                      >
                        <Save className="h-4 w-4 mr-2 text-green-400" />
                        Export All to File
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const api = (window as any).electronAPI;
                            const result = await api?.localStorage?.importFromFile();
                            if (result?.success) {
                              toast.success('Imported successfully');
                              window.location.reload();
                            } else if (!result?.canceled) {
                              toast.error(result?.error || 'Import failed');
                            }
                          } catch (e) {
                            toast.error('Import failed');
                          }
                        }}
                        className="hover:bg-accent text-foreground focus:bg-accent"
                      >
                        <FileDown className="h-4 w-4 mr-2 text-blue-400" />
                        Import from File
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Save Button - Primary action */}
              <Button 
                size="sm" 
                variant="outline"
                onClick={saveTestCase}
                className="border-blue-500/50 dark:border-amber-500/50 text-blue-600 dark:text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 px-4"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {savedTestCaseId ? 'Save' : 'Save New'}
              </Button>
              
              {/* Automated Run Button - Prominent green with clear text */}
              <Button 
                size="sm" 
                onClick={runTest}
                disabled={isRunning || testCase.steps.length === 0}
                className="bg-green-600 hover:bg-green-500 text-white font-medium shadow-lg shadow-green-500/25 disabled:opacity-50 px-5"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" />
                    <span>Run Test</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Compact & Focused */}
          <aside className="w-48 flex-none border-r border-border bg-card overflow-y-auto">
            <div className="p-2 space-y-2">
              {/* Settings Section - Compact */}
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-secondary hover:bg-accent transition-all text-muted-foreground hover:text-foreground">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium flex-1 text-left">Settings</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {/* Domain Selector */}
                  <button 
                    className="w-full text-left text-xs px-2 py-1.5 rounded bg-secondary border border-border hover:border-primary/50 flex items-center gap-2"
                    onClick={() => setShowDomainSelector(true)}
                  >
                    <span>{DOMAINS[selectedDomain]?.icon}</span>
                    <span className="truncate text-foreground">{DOMAINS[selectedDomain]?.label || 'Select Domain'}</span>
                  </button>
                  
                  {/* Coverage - Only show if relevant */}
                  {(() => {
                    const coverage = calculateCoverage(coveredValidations, selectedDomain);
                    if (coverage.percentage === 0) return null;
                    return (
                      <div className="px-2">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Coverage</span>
                          <span className={`font-medium ${
                            coverage.percentage >= 80 ? 'text-green-400' :
                            coverage.percentage >= 50 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {coverage.percentage}%
                          </span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              coverage.percentage >= 80 ? 'bg-green-500' :
                              coverage.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${coverage.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </CollapsibleContent>
              </Collapsible>

              {/* Step Palette - Clean, organized categories */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider px-1">Add Steps</p>
                
                {Object.entries(STEP_CATEGORIES).map(([key, category]) => {
                  const cat = category as any;
                  const isExpanded = expandedCategories.includes(key);
                  const CategoryIcon = cat.icon;
                  
                  // Color mapping for category headers
                  const colorMap: Record<string, string> = {
                    amber: 'border-amber-500/30 hover:border-blue-500/50 dark:border-amber-500/50 text-blue-600 dark:text-amber-400',
                    green: 'border-green-500/30 hover:border-green-500/50 text-green-400',
                    blue: 'border-blue-500/30 hover:border-blue-500/50 text-blue-400',
                    purple: 'border-purple-500/30 hover:border-purple-500/50 text-purple-400',
                    cyan: 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400',
                    violet: 'border-violet-500/30 hover:border-violet-500/50 text-violet-400',
                    rose: 'border-rose-500/30 hover:border-rose-500/50 text-rose-400',
                  };
                  const headerColor = colorMap[cat.color] || 'border-border text-foreground';
                  
                  return (
                    <Collapsible
                      key={key}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedCategories(prev =>
                          open ? [...prev, key] : prev.filter(k => k !== key)
                        );
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <button 
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card transition-all ${headerColor}`}
                        >
                          <CategoryIcon className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium flex-1 text-left">{cat.label}</span>
                          <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-1.5">
                        <div className="space-y-0.5">
                          {cat.steps.map((step: any) => (
                            <button
                              key={step.type}
                              onClick={() => addStep(step.type as StepType)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-accent transition-colors group"
                              title={step.desc}
                            >
                              <div className={`p-1 rounded ${step.color} text-white group-hover:scale-105 transition-transform flex-shrink-0`}>
                                <step.icon className="h-3 w-3" />
                              </div>
                              <span className="text-[11px] text-foreground">{step.label}</span>
                            </button>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>

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
                                  precond.enabled ? 'bg-white dark:bg-gray-100 dark:bg-gray-800' : 'bg-gray-100 dark:bg-white dark:bg-gray-900 opacity-60'
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
                    
                    {/* Test Steps - Drag and Drop enabled */}
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
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggedIndex === index}
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

          {/* Right Panel: Step Editor OR Protocol Panel */}
          {viewMode === 'no-code' && (selectedStep || protocolData || rightPanelMode === 'protocol') && (
            <aside className="w-80 flex-none border-l bg-card flex flex-col max-h-full overflow-hidden">
              {/* Panel Tabs */}
              <div className="p-2 border-b bg-muted/30">
                <div className="flex gap-1">
                  <Button
                    variant={rightPanelMode === 'step' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => setRightPanelMode('step')}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Step
                  </Button>
                  <Button
                    variant={rightPanelMode === 'protocol' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs flex-1 relative"
                    onClick={() => setRightPanelMode('protocol')}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Protocol
                    {protocolData && protocolData.requests.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                        {protocolData.requests.length}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Panel Content */}
              {rightPanelMode === 'step' && selectedStep ? (
                <StepEditor
                  step={selectedStep}
                  onUpdate={(updates) => updateStep(selectedStep.id, updates)}
                  onClose={() => setSelectedStepId(null)}
                  onShowBlackbox={() => setShowBlackbox(true)}
                  domain={selectedDomain}
                  coveredValidations={coveredValidations}
                  onToggleValidation={(validationId) => {
                    setCoveredValidations(prev => 
                      prev.includes(validationId) 
                        ? prev.filter(id => id !== validationId)
                        : [...prev, validationId]
                    );
                  }}
                  activeTab={rightPanelTab}
                  onTabChange={setRightPanelTab}
                />
              ) : rightPanelMode === 'step' ? (
                <div className="flex-1 flex items-center justify-center p-4 text-center">
                  <div className="space-y-2">
                    <MousePointer className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Select a step to edit</p>
                  </div>
                </div>
              ) : (
                /* Protocol Panel */
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Protocol Header with Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-violet-500" />
                      <span className="text-xs font-medium">Protocol Data</span>
                    </div>
                    {protocolData && protocolData.requests.length > 0 && (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            const har = {
                              log: {
                                version: '1.2',
                                creator: { name: 'QAAI Builder', version: '1.0' },
                                entries: protocolData.requests.map(r => ({
                                  startedDateTime: new Date().toISOString(),
                                  time: r.duration,
                                  request: {
                                    method: r.method,
                                    url: r.url,
                                    httpVersion: 'HTTP/1.1',
                                    headers: Object.entries(r.requestHeaders || {}).map(([name, value]) => ({ name, value })),
                                  },
                                  response: {
                                    status: r.statusCode,
                                    statusText: '',
                                    headers: Object.entries(r.responseHeaders || {}).map(([name, value]) => ({ name, value })),
                                  },
                                  timings: r.timing || {},
                                })),
                              },
                            };
                            const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${testCase.name.replace(/\s+/g, '_')}_protocol.har`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('HAR file exported!');
                          }}
                        >
                          <FileJson className="h-3 w-3 mr-1" />
                          HAR
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-[10px] px-2 bg-violet-600 hover:bg-violet-700"
                          onClick={() => {
                            // Navigate to load test page with protocol data
                            localStorage.setItem('qaai_load_test_protocol', JSON.stringify(protocolData));
                            window.open('/load-testing?hasProtocolData=true&source=builder', '_blank');
                          }}
                        >
                          <Gauge className="h-3 w-3 mr-1" />
                          Load Test
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Protocol Content */}
                  {!protocolData || protocolData.requests.length === 0 ? (
                    <div className="text-center py-6 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-violet-100 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">No Protocol Data</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enable "Protocol Capture" in recorder or import HAR
                        </p>
                      </div>
                      
                      {/* Import HAR Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.har,.json';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              try {
                                const text = await file.text();
                                const harData = JSON.parse(text);
                                const entries = harData?.log?.entries || [];
                                
                                if (entries.length > 0) {
                                  const requests = entries.map((entry: any, idx: number) => ({
                                    requestId: `har_${idx}`,
                                    url: entry.request?.url || '',
                                    method: entry.request?.method || 'GET',
                                    statusCode: entry.response?.status || 0,
                                    duration: entry.time || 0,
                                    type: 'fetch',
                                    requestHeaders: (entry.request?.headers || []).reduce((acc: any, h: any) => {
                                      acc[h.name] = h.value;
                                      return acc;
                                    }, {}),
                                    responseHeaders: (entry.response?.headers || []).reduce((acc: any, h: any) => {
                                      acc[h.name] = h.value;
                                      return acc;
                                    }, {}),
                                    timing: entry.timings || {},
                                  }));
                                  
                                  setProtocolData({
                                    requests,
                                    correlations: [],
                                    statistics: {
                                      totalRequests: requests.length,
                                      successfulRequests: requests.filter((r: any) => r.statusCode >= 200 && r.statusCode < 400).length,
                                      failedRequests: requests.filter((r: any) => r.statusCode >= 400).length,
                                      avgDuration: Math.round(requests.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / requests.length),
                                      p95Duration: 0,
                                    },
                                    linkedActions: [],
                                  });
                                  
                                  toast.success(`Imported ${requests.length} HTTP requests!`);
                                } else {
                                  toast.error('No requests found in HAR file');
                                }
                              } catch (err) {
                                toast.error('Invalid HAR file format');
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import HAR File
                      </Button>
                      
                      <div className="bg-violet-50 rounded-lg p-3 text-left">
                        <p className="text-xs font-medium text-violet-700 mb-2">
                          🎯 Better than LoadRunner
                        </p>
                        <ul className="text-xs text-violet-600 space-y-1">
                          <li>• No proxy setup needed</li>
                          <li>• Auto-detects tokens & session IDs</li>
                          <li>• Links UI actions to API calls</li>
                          <li>• Export to HAR, k6, JMeter</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Statistics Summary */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-green-600">
                            {protocolData.statistics?.totalRequests || protocolData.requests.length}
                          </div>
                          <div className="text-[10px] text-green-700">Requests</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {protocolData.statistics?.avgDuration || 0}ms
                          </div>
                          <div className="text-[10px] text-blue-700">Avg Time</div>
                        </div>
                      </div>

                      {/* Correlations Detected */}
                      {protocolData.correlations && protocolData.correlations.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Key className="h-3 w-3 text-amber-600" />
                            <span className="text-[10px] font-medium text-amber-700">
                              Auto-Detected ({protocolData.correlations.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {protocolData.correlations.slice(0, 5).map((corr, idx) => (
                              <Badge key={idx} variant="outline" className="text-[9px] bg-white">
                                {corr.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request List */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium">HTTP Requests</span>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {protocolData.requests.slice(0, 50).map((req, idx) => (
                            <div 
                              key={req.requestId || idx}
                              className="p-2 rounded border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => {
                                // Show request details (could open a modal)
                                toast.info(`${req.method} ${new URL(req.url).pathname}\nStatus: ${req.statusCode}\nDuration: ${req.duration}ms`);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-[9px] font-mono ${
                                    req.method === 'GET' ? 'text-green-600 border-green-300' :
                                    req.method === 'POST' ? 'text-blue-600 border-blue-300' :
                                    req.method === 'PUT' ? 'text-amber-600 border-amber-300' :
                                    req.method === 'DELETE' ? 'text-red-600 border-red-300' :
                                    'text-gray-600 border-gray-300'
                                  }`}
                                >
                                  {req.method}
                                </Badge>
                                <span className="text-[10px] truncate flex-1 font-mono">
                                  {(() => {
                                    try {
                                      return new URL(req.url).pathname;
                                    } catch {
                                      return req.url;
                                    }
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                                <span className={req.statusCode >= 400 ? 'text-red-500' : 'text-green-500'}>
                                  {req.statusCode}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Timer className="h-2.5 w-2.5" />
                                  {req.duration}ms
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {protocolData.requests.length > 50 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{protocolData.requests.length - 50} more requests
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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

        {/* Domain Selector Dialog */}
        <Dialog open={showDomainSelector} onOpenChange={setShowDomainSelector}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-violet-500" />
                Select Application Domain
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your application type to get relevant validation suggestions and track test coverage.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(DOMAINS) as [DomainType, typeof DOMAINS[DomainType]][]).map(([key, domain]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDomain(key);
                    setShowDomainSelector(false);
                    toast.success(`Domain set to ${domain.label}`);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 ${
                    selectedDomain === key 
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-500/20' 
                      : ''
                  }`}
                >
                  <div className="text-2xl mb-1">{domain.icon}</div>
                  <div className="font-medium text-sm">{domain.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{domain.description}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Current:</strong> {DOMAINS[selectedDomain]?.icon} {DOMAINS[selectedDomain]?.label}
                <br />
                <strong>Categories:</strong> {DOMAINS[selectedDomain]?.categories.slice(0, 3).join(', ')}
                {DOMAINS[selectedDomain]?.categories.length > 3 && ` +${DOMAINS[selectedDomain].categories.length - 3} more`}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Validation Coverage Panel Dialog */}
        <Dialog open={showValidationPanel} onOpenChange={setShowValidationPanel}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                Validation Coverage Details
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {(() => {
                const coverage = calculateCoverage(coveredValidations, selectedDomain);
                const domainValidations = getValidationsByDomain(selectedDomain);
                const grouped = groupValidations(domainValidations);
                
                return (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Overall Coverage</span>
                        <span className={`text-lg font-bold ${
                          coverage.percentage >= 80 ? 'text-green-600' :
                          coverage.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {coverage.percentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            coverage.percentage >= 80 ? 'bg-green-500' :
                            coverage.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${coverage.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{coverage.covered} covered</span>
                        <span>{coverage.total - coverage.covered} remaining</span>
                      </div>
                    </div>
                    
                    {/* Missing High Priority */}
                    {coverage.missingHigh.length > 0 && (
                      <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                        <h4 className="font-medium text-red-700 dark:text-red-400 text-sm mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          High Priority Gaps ({coverage.missingHigh.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {coverage.missingHigh.slice(0, 10).map(v => (
                            <div 
                              key={v.id}
                              className="p-2 bg-white dark:bg-white dark:bg-gray-900 rounded text-xs cursor-pointer hover:ring-2 ring-red-300"
                              onClick={() => {
                                setCoveredValidations(prev => [...prev, v.id]);
                              }}
                            >
                              <div className="font-medium">{v.validationLogic}</div>
                              <div className="text-muted-foreground">{v.testScenario}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* All Categories */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">All Validations by Category</h4>
                      {Object.entries(grouped).map(([category, subcats]) => {
                        const categoryValidations = Object.values(subcats).flat();
                        const categoryCovered = categoryValidations.filter(v => coveredValidations.includes(v.id)).length;
                        const categoryTotal = categoryValidations.length;
                        
                        return (
                          <Collapsible key={category}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between h-auto py-2">
                                <div className="flex items-center gap-2">
                                  <span>{CATEGORIES[category]?.icon}</span>
                                  <span className="text-sm">{category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {categoryCovered}/{categoryTotal}
                                  </span>
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-violet-500"
                                      style={{ width: `${categoryTotal > 0 ? (categoryCovered / categoryTotal) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <ChevronRight className="h-4 w-4" />
                                </div>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-6 space-y-1">
                              {categoryValidations.map(v => {
                                const isCovered = coveredValidations.includes(v.id);
                                return (
                                  <div 
                                    key={v.id}
                                    className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer ${
                                      isCovered ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                      setCoveredValidations(prev => 
                                        isCovered 
                                          ? prev.filter(id => id !== v.id)
                                          : [...prev, v.id]
                                      );
                                    }}
                                  >
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${
                                      isCovered ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                    }`}>
                                      {isCovered && <CheckCircle className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="flex-1">{v.validationLogic}</span>
                                    <Badge className={`h-4 px-1 text-[9px] ${getPriorityColor(v.priority)}`}>
                                      {v.priority}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MANUAL EXECUTION OVERLAY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isManualExecution && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="flex-none border-b bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-6 w-6 text-amber-500" />
                    <h2 className="text-xl font-bold">Manual Execution</h2>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Step {manualCurrentStep + 1} of {testCase.steps.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  {/* Progress */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">
                      ✅ {Object.values(manualResults).filter(r => r.result === 'passed').length}
                    </span>
                    <span className="text-red-600 font-medium">
                      ❌ {Object.values(manualResults).filter(r => r.result === 'failed').length}
                    </span>
                    <span className="text-gray-500 font-medium">
                      ⏭️ {Object.values(manualResults).filter(r => r.result === 'skipped').length}
                    </span>
                  </div>
                  <Button variant="outline" onClick={endManualExecution}>
                    <X className="h-4 w-4 mr-1" />
                    End Execution
                  </Button>
                </div>
              </div>
              
              {/* Step Navigator */}
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
                {testCase.steps.map((step, idx) => {
                  const result = manualResults[step.id];
                  const isCurrent = idx === manualCurrentStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setManualCurrentStep(idx)}
                      className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isCurrent 
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300' 
                          : result?.result === 'passed' 
                          ? 'bg-green-100 text-green-700' 
                          : result?.result === 'failed' 
                          ? 'bg-red-100 text-red-700' 
                          : result?.result === 'skipped' 
                          ? 'bg-gray-100 text-gray-500' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
              {getCurrentManualStep() && (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Step Title */}
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-foreground">
                      {getCurrentManualStep().name}
                    </h3>
                    {getCurrentManualStep().description && (
                      <p className="text-muted-foreground mt-1">{getCurrentManualStep().description}</p>
                    )}
                  </div>
                  
                  {/* Action Card */}
                  <Card className="border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <MousePointer className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                            Action to Perform
                          </h4>
                          <p className="text-lg">
                            {getCurrentManualStep().manualAction || getCurrentManualStep().name || 
                             `${getCurrentManualStep().type}: ${getCurrentManualStep().target || getCurrentManualStep().value || ''}`}
                          </p>
                          
                          {/* Test Data */}
                          {getCurrentManualStep().value && (
                            <div className="mt-3 p-3 bg-white dark:bg-white dark:bg-gray-900 rounded border">
                              <span className="text-xs text-muted-foreground">Test Data:</span>
                              <p className="font-mono text-sm mt-1">{getCurrentManualStep().value}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Expected Result Card */}
                  <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                            Expected Result
                          </h4>
                          <p className="text-lg">
                            {getCurrentManualStep().expectedResult || 
                             (getCurrentManualStep().assertion?.expected 
                               ? `Verify: ${getCurrentManualStep().assertion.type?.replace(/_/g, ' ')} - "${getCurrentManualStep().assertion.expected}"`
                               : 'Step should complete successfully')}
                          </p>
                          
                          {/* Assertions to verify */}
                          {getCurrentManualStep().assertion?.enabled && (
                            <div className="mt-3 p-3 bg-white dark:bg-white dark:bg-gray-900 rounded border">
                              <span className="text-xs text-muted-foreground">Verify:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{getCurrentManualStep().assertion.type}</Badge>
                                <span className="font-mono text-sm">{getCurrentManualStep().assertion.expected}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Notes Input */}
                  <div>
                    <Label className="text-sm text-muted-foreground">Notes (optional)</Label>
                    <Input 
                      placeholder="Add any observations or issues..."
                      className="mt-1"
                      id={`manual-notes-${getCurrentManualStep().id}`}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer - Action Buttons */}
            <div className="flex-none border-t bg-card px-6 py-4">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setManualCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={manualCurrentStep === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setManualCurrentStep(prev => Math.min(testCase.steps.length - 1, prev + 1))}
                    disabled={manualCurrentStep === testCase.steps.length - 1}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                
                {/* Result Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'skipped', notes);
                    }}
                    className="border-gray-300"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'blocked', notes);
                    }}
                    className="border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Blocked
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'failed', notes);
                    }}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Fail
                  </Button>
                  <Button
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'passed', notes);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Pass
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isFirst: boolean;
  isLast: boolean;
  executionStatus?: string;
}

// Helper to mask sensitive values in step names/descriptions
function maskSensitiveStepName(name: string, step: TestStep): string {
  if (!name) return name;
  
  // Detect if this is a password/sensitive field
  const isSensitive = step.isSensitive || 
                     step.inputType === 'password' ||
                     /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.name || '') ||
                     /password|passwd|pwd|^pw$|secret|token|api[_-]?key/i.test(step.target || '');
  
  if (!isSensitive) return name;
  
  // Replace any quoted value with masked dots
  // Matches: "value", 'value', "ā口¢ā口¢...", etc.
  return name.replace(/["'][^"']+["']/g, (match) => {
    // Keep the first quote and replace content with mask
    const quote = match[0];
    return `${quote}••••••••${quote}`;
  });
}

// Helper to detect and fix corrupted/garbled characters
function hasCorruptedChars(str: string): boolean {
  if (!str) return false;
  // Detect UTF-8 encoding issues - these characters indicate corruption
  return /[āã口¢Γ]/.test(str) || /^[•●○◦]{4,}$/.test(str);
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
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isFirst,
  isLast,
  executionStatus,
}: StepCardProps) {
  const info = getStepInfo(step.type);
  
  // Get human-readable description (NO selectors shown)
  let description = getStepDescription(step);
  
  // Extra security: if this is a password field, force mask the description
  const isPasswordStep = step.isSensitive || 
                         step.inputType === 'password' ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.name || '') ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.target || '') ||
                         /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(step.selector || '') ||
                         /[āã口¢Γ]/.test(step.value || ''); // Detect garbled chars
  
  if (isPasswordStep && description) {
    // Force mask any password-related description
    description = '🔒 Type "••••••••"';
  }
  
  // Mask sensitive values in step name
  const displayName = maskSensitiveStepName(step.name, step);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`group relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-primary bg-primary/5 border-primary/50'
          : isDragging
          ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500/50 opacity-90'
          : executionStatus === 'passed'
          ? 'bg-success/5 border-success/30'
          : executionStatus === 'failed'
          ? 'bg-destructive/5 border-destructive/30'
          : 'bg-card border-border hover:border-primary/40 hover:bg-primary/5'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing flex items-center">
        <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      </div>
      
      {/* Step Number & Icon */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${info.color}`}>
          {index + 1}
        </div>
        {!isLast && <div className="w-0.5 h-4 bg-border mt-1" />}
      </div>

      {/* Content - NO CODE/SELECTOR shown */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <info.icon className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground text-base">{displayName}</span>
          {!step.enabled && (
            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">Disabled</Badge>
          )}
          {step.fallback && (
            <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30">
              <Wand2 className="h-3 w-3 mr-1" />
              Fallback
            </Badge>
          )}
          {step.assertion?.enabled && (
            <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/30">
              <CheckCircle className="h-3 w-3 mr-1" />
              Assert
            </Badge>
          )}
          {/* Show automation status */}
          {((step as any).qword && (step as any).args?.length > 0) && (
            <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
              <Zap className="h-3 w-3 mr-1" />
              Script
            </Badge>
          )}
        </div>
        {/* Show human-readable description, not selector */}
        {description && (
          <div className="text-sm text-muted-foreground font-medium mt-2">
            {description}
          </div>
        )}
        {step.expectedResult && (
          <div className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
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
          <DropdownMenuContent className="bg-popover border-border">
            <DropdownMenuItem 
              onClick={onDuplicate}
              className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer"
            >
              <Copy className="h-4 w-4 mr-2 text-primary" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onUpdate({ enabled: !step.enabled })}
              className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer"
            >
              {step.enabled ? (
                <><EyeOff className="h-4 w-4 mr-2 text-warning" />Disable</>
              ) : (
                <><Eye className="h-4 w-4 mr-2 text-success" />Enable</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={onDelete} 
              className="text-destructive hover:bg-destructive/10 focus:bg-destructive/10 cursor-pointer"
            >
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
  // Validation props
  domain?: DomainType;
  coveredValidations?: string[];
  onToggleValidation?: (validationId: string) => void;
  activeTab?: 'details' | 'validations';
  onTabChange?: (tab: 'details' | 'validations') => void;
}

function StepEditor({
  step,
  onUpdate,
  onClose,
  onShowBlackbox,
  domain = 'general',
  coveredValidations = [],
  onToggleValidation,
  activeTab = 'details',
  onTabChange
}: StepEditorProps) {
  // Smart Fill Dialog state
  const [showSmartFillDialog, setShowSmartFillDialog] = useState(false);
  
  // Check if step has automation data (recorded/merged)
  const hasAutomation = !!(
    (step as any).qword && 
    (step as any).args && 
    Array.isArray((step as any).args) && 
    (step as any).args.length > 0
  );
  const hasSmartSelectors = !!(step as any).selectorObj && Object.keys((step as any).selectorObj || {}).length > 0;
  const isAutomated = hasAutomation || hasSmartSelectors;
  
  // Get smart suggestions based on step content
  const fieldText = [step.name, step.target, step.selector, step.description].filter(Boolean).join(' ');
  const smartSuggestions = getSuggestionsForField(fieldText, domain);
  
  // Get step type info for better labels
  const stepTypeLabels: Record<string, { targetLabel: string; targetPlaceholder: string; targetHelp: string }> = {
    click: { 
      targetLabel: 'What to Click', 
      targetPlaceholder: 'e.g., Submit Button, Login Link, Menu Item',
      targetHelp: 'The text or name of the button/link to click. Used to find the element.'
    },
    input: { 
      targetLabel: 'Field Label', 
      targetPlaceholder: 'e.g., Email, First Name, Password',
      targetHelp: 'The label of the input field (what appears next to it or as placeholder).'
    },
    select: { 
      targetLabel: 'Dropdown Label', 
      targetPlaceholder: 'e.g., Country, State, Category',
      targetHelp: 'The label of the dropdown/select field.'
    },
    hover: { 
      targetLabel: 'Element to Hover', 
      targetPlaceholder: 'e.g., Menu, Profile Icon, Tooltip Trigger',
      targetHelp: 'The element to hover over (to reveal dropdowns, tooltips, etc.).'
    },
    assert: { 
      targetLabel: 'Element to Check', 
      targetPlaceholder: 'e.g., Success Message, Error Alert, Welcome Text',
      targetHelp: 'The element to verify exists or has specific content.'
    },
  };

  const typeInfo = stepTypeLabels[step.type] || { 
    targetLabel: 'Target Element', 
    targetPlaceholder: 'e.g., Submit Button',
    targetHelp: 'Human-readable name for this element'
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Edit Step
              {isAutomated && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
                  <Zap className="h-3 w-3 mr-0.5" />
                  Automated
                </Badge>
              )}
            </h3>
            <span className="text-[10px] text-muted-foreground capitalize">{step.type} action</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1">
          <Button
            variant={activeTab === 'details' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onTabChange?.('details')}
          >
            <Settings className="h-3 w-3 mr-1" />
            Details
          </Button>
          <Button
            variant={activeTab === 'validations' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onTabChange?.('validations')}
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Validations
            {smartSuggestions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {smartSuggestions.filter(s => s.priority === 'High').length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'validations' ? (
          /* Validations Tab - Smart Suggestions */
          <div className="space-y-3">
            {smartSuggestions.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <span>Suggested validations for this step</span>
                </div>
                
                {/* Group by category */}
                {(() => {
                  const grouped = groupValidations(smartSuggestions.slice(0, 20));
                  return Object.entries(grouped).map(([category, subcats]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{CATEGORIES[category]?.icon} {category}</span>
                      </div>
                      {Object.entries(subcats).map(([subcat, validations]) => (
                        <div key={subcat} className="pl-2 space-y-1">
                          <span className="text-[10px] text-muted-foreground">{subcat}</span>
                          {validations.map((v) => {
                            const isCovered = coveredValidations.includes(v.id);
                            return (
                              <div 
                                key={v.id}
                                className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                                  isCovered 
                                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => onToggleValidation?.(v.id)}
                              >
                                <div className="flex items-start gap-2">
                                  <div className={`mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center ${
                                    isCovered ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                  }`}>
                                    {isCovered && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{v.validationLogic}</span>
                                      <Badge className={`h-4 px-1 text-[9px] ${getPriorityColor(v.priority)}`}>
                                        {v.priority}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{v.testScenario}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No specific validations detected</p>
                <p className="text-xs mt-1">Add more details to the step to get suggestions</p>
              </div>
            )}
          </div>
        ) : (
          /* Details Tab - Original Step Editor Content */
          <div className="space-y-4">
            {/* Step Name */}
            <div className="space-y-2">
              <Label className="text-xs">Step Name</Label>
              <Input
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={`${step.type === 'click' ? 'Click: ' : step.type === 'input' ? 'Input: ' : ''}...`}
                className="h-8 text-sm"
              />
            </div>

      {/* Type-specific fields */}
      {step.type === 'navigate' && (
        <div className="space-y-2">
          <Label>URL to Navigate To</Label>
          <Input
            value={step.url || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://example.com/page"
          />
          <p className="text-xs text-muted-foreground">The full URL where the browser should go</p>
        </div>
      )}

      {step.type === 'wait' && (
        <div className="space-y-2">
          <Label>Wait Time (milliseconds)</Label>
          <Input
            type="number"
            value={step.waitTime || 1000}
            onChange={(e) => onUpdate({ waitTime: parseInt(e.target.value) })}
            placeholder="1000"
          />
          <p className="text-xs text-muted-foreground">How long to wait (1000ms = 1 second)</p>
        </div>
      )}

      {step.type === 'wait_for_element' && (
        <div className="space-y-2">
          <Label>Element to Wait For</Label>
          <Input
            value={step.target || ''}
            onChange={(e) => onUpdate({ target: e.target.value })}
            placeholder="e.g., Loading Spinner, Submit Button"
          />
          <p className="text-xs text-muted-foreground">Wait until this element appears on the page</p>
        </div>
      )}

      {['click', 'input', 'fill', 'select', 'hover', 'assert'].includes(step.type) && (
        <>
          {/* Human-readable target name - with type-specific label */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {typeInfo.targetLabel}
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                Used to find element
              </span>
            </Label>
            <Input
              value={step.target || ''}
              onChange={(e) => onUpdate({ target: e.target.value })}
              placeholder={typeInfo.targetPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{typeInfo.targetHelp}</p>
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
              {['click', 'input', 'fill', 'select', 'hover'].includes(step.type) && (
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
              
              {/* QA Engineer Fallback - Manual selector input when nothing else works */}
              <div className="space-y-1 mt-3 pt-3 border-t border-amber-500/30">
                <Label className="text-xs flex items-center gap-2">
                  <span className="text-amber-500">⚙️</span>
                  QA Override Selector
                  <span className="text-[10px] font-normal text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                    Fallback
                  </span>
                </Label>
                <Textarea
                  value={step.qaFallbackSelector || ''}
                  onChange={(e) => onUpdate({ qaFallbackSelector: e.target.value })}
                  placeholder="// Enter XPath or CSS selector when auto-detection fails&#10;// Example: //button[@data-testid='submit']&#10;// Example: [data-qa='login-btn']"
                  className="font-mono text-xs border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10"
                  rows={3}
                />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  💡 Use this when automatic element detection doesn't work. Supports XPath (//) or CSS selectors.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Automation Data (readonly when automated) */}
          {isAutomated && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Automation Script Attached
                </span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-500 space-y-1">
                {hasAutomation && (
                  <>
                    <div><span className="font-medium">Action:</span> {(step as any).qword}</div>
                    <div><span className="font-medium">Args:</span> {(step as any).args?.join(', ')}</div>
                  </>
                )}
                {hasSmartSelectors && (
                  <div><span className="font-medium">Smart Selectors:</span> Available for auto-healing</div>
                )}
              </div>
              <p className="text-[10px] text-green-600/70 mt-2">
                ✓ You can edit the step name and expected result without affecting the automation script
              </p>
            </div>
          )}
        </>
      )}

      {(step.type === 'input' || step.type === 'fill') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Value to Enter</Label>
            <div className="flex gap-1">
              {/* Quick Auto-detect */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const fieldLabel = step.name || step.target || 'text';
                  const detected = detectFieldType(fieldLabel);
                  const value = generateSmartValue(detected.type, fieldLabel, detected.constraints);
                  console.log(`[Smart Fill] "${fieldLabel}" -> ${detected.type} -> "${value}"`);
                  onUpdate({ value, runtimeRandom: undefined });
                }}
                title="Auto-detect and fill based on field name"
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Auto
              </Button>
              {/* Open Smart Fill Dialog */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowSmartFillDialog(true)}
              >
                <Zap className="h-3 w-3 mr-1" />
                Smart Fill
              </Button>
            </div>
          </div>
          
          {/* Smart Fill Dialog */}
          <SmartFillDialog
            open={showSmartFillDialog}
            onOpenChange={setShowSmartFillDialog}
            onSelectValue={(value, generatorId) => {
              console.log(`[Smart Fill Dialog] Selected: ${generatorId} -> "${value}"`);
              onUpdate({ value, runtimeRandom: undefined });
            }}
            fieldLabel={step.name || step.target || ''}
          />
          
          {/* Show current value or runtime indicator */}
          {step.runtimeRandom?.enabled ? (
            <div className="p-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <RefreshCw className="h-3 w-3 text-violet-500" />
                <span className="font-medium text-violet-700 dark:text-violet-300">Runtime Random</span>
                <Badge variant="secondary" className="text-[10px]">{step.runtimeRandom.type}</Badge>
              </div>
              {step.runtimeRandom.constraints && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {step.runtimeRandom.constraints.minAge && `Min Age: ${step.runtimeRandom.constraints.minAge}`}
                  {step.runtimeRandom.constraints.maxAge && ` Max Age: ${step.runtimeRandom.constraints.maxAge}`}
                  {step.runtimeRandom.constraints.minValue !== undefined && `Min: ${step.runtimeRandom.constraints.minValue}`}
                  {step.runtimeRandom.constraints.maxValue !== undefined && ` Max: ${step.runtimeRandom.constraints.maxValue}`}
                </div>
              )}
              <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-1">
                ✨ New unique value generated on each test run
              </p>
              
              {/* Constraint editors */}
              {step.runtimeRandom.type === 'year' && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Min Age</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.minAge || 18}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, minAge: parseInt(e.target.value) }
                        },
                        value: `{{runtime:year|minAge:${e.target.value}|maxAge:${step.runtimeRandom?.constraints?.maxAge || 100}}}`
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Max Age</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.maxAge || 100}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, maxAge: parseInt(e.target.value) }
                        },
                        value: `{{runtime:year|minAge:${step.runtimeRandom?.constraints?.minAge || 18}|maxAge:${e.target.value}}}`
                      })}
                    />
                  </div>
                </div>
              )}
              {step.runtimeRandom.type === 'number' && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Min</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.minValue ?? 1}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, minValue: parseInt(e.target.value) }
                        },
                        value: `{{runtime:number|min:${e.target.value}|max:${step.runtimeRandom?.constraints?.maxValue ?? 100}}}`
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Max</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.maxValue ?? 100}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, maxValue: parseInt(e.target.value) }
                        },
                        value: `{{runtime:number|min:${step.runtimeRandom?.constraints?.minValue ?? 1}|max:${e.target.value}}}`
                      })}
                    />
                  </div>
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] mt-2 text-red-500"
                onClick={() => onUpdate({ runtimeRandom: undefined, value: '' })}
              >
                <X className="h-3 w-3 mr-1" />
                Clear Runtime
              </Button>
            </div>
          ) : (
            <>
              {/* Detect password fields by name */}
              {(() => {
                const isPasswordField = /password|pwd|^pass$|passwd/i.test(
                  (step.name || '') + (step.target || '') + (step.selector || '')
                );
                const hasCorruptedValue = (step.value || '').includes('ã') || 
                  (step.value || '').includes('Γ') || 
                  /^[•●○◦]+$/.test(step.value || '');
                
                return (
                  <div className="space-y-1">
                    <Input
                      type={isPasswordField ? 'password' : 'text'}
                      value={step.value || ''}
                      onChange={(e) => onUpdate({ value: e.target.value })}
                      placeholder={isPasswordField ? "Enter password" : "Text to enter"}
                      className={hasCorruptedValue ? 'border-amber-500' : ''}
                    />
                    {hasCorruptedValue && (
                      <p className="text-xs text-amber-600">
                        ⚠️ Password may have encoding issues. Please re-enter the correct value.
                      </p>
                    )}
                    {isPasswordField && !hasCorruptedValue && (
                      <p className="text-xs text-muted-foreground">
                        🔒 Password field detected
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
          
          {/* Store As Variable (auto-shown for runtime random) */}
          {step.runtimeRandom?.enabled && (
            <div className="space-y-1 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Label className="text-xs flex items-center gap-1">
                <FolderPlus className="h-3 w-3 text-blue-500" />
                Store As Variable
              </Label>
              <Input
                value={step.storeAs || ''}
                onChange={(e) => onUpdate({ storeAs: e.target.value })}
                placeholder="e.g., user_email"
                className="h-7 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{{' + (step.storeAs || 'variable') + '}}'}</code> in later steps or API calls
              </p>
            </div>
          )}
          
          {!step.runtimeRandom?.enabled && (
            <p className="text-xs text-muted-foreground">
              Use Smart Fill → Runtime options for unique values each run
            </p>
          )}
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

      {/* ========== MANUAL TESTING STEPS - Freeform Text ========== */}
      
      {/* Note/Comment - Freeform text for documentation */}
      {step.type === 'note' && (
        <div className="space-y-4 border-l-4 border-slate-500 pl-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <FileText className="h-4 w-4" />
            Note / Comment
          </div>
          <div className="space-y-2">
            <Label>Note Text</Label>
            <Textarea
              value={step.noteText || ''}
              onChange={(e) => onUpdate({ noteText: e.target.value })}
              placeholder="Write any notes, comments, or test documentation here...&#10;&#10;Examples:&#10;- Test setup requirements&#10;- Environment considerations&#10;- Edge cases to watch for"
              className="text-sm min-h-[120px]"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              📝 This is a free-form text field for documentation purposes
            </p>
          </div>
        </div>
      )}
      
      {/* Manual Step - Action description with expected result */}
      {step.type === 'manual_step' && (
        <div className="space-y-4 border-l-4 border-slate-600 pl-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <ClipboardList className="h-4 w-4" />
            Manual Test Step
          </div>
          <div className="space-y-2">
            <Label>Action to Perform</Label>
            <Textarea
              value={step.manualAction || ''}
              onChange={(e) => onUpdate({ manualAction: e.target.value })}
              placeholder="Describe the manual action...&#10;e.g., Verify the color of the error message is red&#10;e.g., Check that the PDF downloads correctly"
              className="text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Expected Result</Label>
            <Textarea
              value={step.expectedResult || ''}
              onChange={(e) => onUpdate({ expectedResult: e.target.value })}
              placeholder="What should happen after this action?&#10;e.g., Error message displays in red (#FF0000)&#10;e.g., PDF opens with correct data"
              className="text-sm"
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            👆 Manual steps are for actions that cannot be automated but need to be documented and executed by a tester
          </p>
        </div>
      )}
      
      {/* Checkpoint - Verification point marker */}
      {step.type === 'checkpoint' && (
        <div className="space-y-4 border-l-4 border-amber-500 pl-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <Flag className="h-4 w-4" />
            Verification Checkpoint
          </div>
          <div className="space-y-2">
            <Label>Checkpoint Description</Label>
            <Textarea
              value={step.noteText || ''}
              onChange={(e) => onUpdate({ noteText: e.target.value })}
              placeholder="Describe what should be verified at this point...&#10;e.g., User is logged in and dashboard loads&#10;e.g., Cart contains the correct items"
              className="text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Pass Criteria</Label>
            <Input
              value={step.expectedResult || ''}
              onChange={(e) => onUpdate({ expectedResult: e.target.value })}
              placeholder="e.g., All elements visible, No errors in console"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            🚩 Checkpoints mark critical verification points in your test flow
          </p>
        </div>
      )}

      {/* ========== BLACK-BOX TESTING STEP EDITORS ========== */}
      
      {/* Date - Generate Relative Date */}
      {step.type === 'date_relative' && (
        <div className="space-y-4 border-l-4 border-indigo-500 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Generate Relative Date
          </div>
          <div className="space-y-2">
            <Label>Days from Today</Label>
            <Input
              type="number"
              value={(step as any).daysOffset || 1}
              onChange={(e) => onUpdate({ daysOffset: parseInt(e.target.value) } as any)}
              placeholder="1 = tomorrow, -1 = yesterday, 365 = next year"
            />
            <p className="text-xs text-muted-foreground">1 = tomorrow, -1 = yesterday, 365 = next year</p>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={(step as any).dateFormat || 'MM/DD/YYYY'} onValueChange={(v) => onUpdate({ dateFormat: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                <SelectItem value="MMMM DD, YYYY">Month DD, YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Store Result As Variable</Label>
            <Input
              value={(step as any).storeAs || 'generated_date'}
              onChange={(e) => onUpdate({ storeAs: e.target.value } as any)}
              placeholder="generated_date"
            />
          </div>
        </div>
      )}

      {/* Date - Verify Future */}
      {step.type === 'date_verify_future' && (
        <div className="space-y-4 border-l-4 border-indigo-600 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Verify Date is in Future
          </div>
          <div className="space-y-2">
            <Label>Date Element Selector</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[data-testid='booking-date'] or .date-field"
            />
            <p className="text-xs text-muted-foreground">The element containing the date to verify</p>
          </div>
        </div>
      )}

      {/* Date - Verify Sequence */}
      {step.type === 'date_verify_sequence' && (
        <div className="space-y-4 border-l-4 border-indigo-700 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Verify Date Sequence (End {'>'} Start)
          </div>
          <div className="space-y-2">
            <Label>Start Date Selector</Label>
            <Input
              value={(step as any).startDateSelector || ''}
              onChange={(e) => onUpdate({ startDateSelector: e.target.value } as any)}
              placeholder="[data-testid='start-date']"
            />
          </div>
          <div className="space-y-2">
            <Label>End Date Selector</Label>
            <Input
              value={(step as any).endDateSelector || ''}
              onChange={(e) => onUpdate({ endDateSelector: e.target.value } as any)}
              placeholder="[data-testid='end-date']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Multiplication */}
      {step.type === 'math_verify_multiply' && (
        <div className="space-y-4 border-l-4 border-pink-500 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Multiplication (A × B = Result)
          </div>
          <div className="space-y-2">
            <Label>Factor 1 Selector (e.g., Quantity)</Label>
            <Input
              value={(step as any).factor1Selector || ''}
              onChange={(e) => onUpdate({ factor1Selector: e.target.value } as any)}
              placeholder="[data-testid='quantity']"
            />
          </div>
          <div className="space-y-2">
            <Label>Factor 2 Selector (e.g., Unit Price)</Label>
            <Input
              value={(step as any).factor2Selector || ''}
              onChange={(e) => onUpdate({ factor2Selector: e.target.value } as any)}
              placeholder="[data-testid='price']"
            />
          </div>
          <div className="space-y-2">
            <Label>Result Selector (e.g., Line Total)</Label>
            <Input
              value={(step as any).resultSelector || ''}
              onChange={(e) => onUpdate({ resultSelector: e.target.value } as any)}
              placeholder="[data-testid='total']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Sum */}
      {step.type === 'math_verify_sum' && (
        <div className="space-y-4 border-l-4 border-pink-600 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Sum of List
          </div>
          <div className="space-y-2">
            <Label>List Items Selector</Label>
            <Input
              value={(step as any).listSelector || ''}
              onChange={(e) => onUpdate({ listSelector: e.target.value } as any)}
              placeholder=".cart-item-price (selects all price elements)"
            />
            <p className="text-xs text-muted-foreground">Should match all items to sum</p>
          </div>
          <div className="space-y-2">
            <Label>Total Selector</Label>
            <Input
              value={(step as any).totalSelector || ''}
              onChange={(e) => onUpdate({ totalSelector: e.target.value } as any)}
              placeholder="[data-testid='subtotal']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Discount */}
      {step.type === 'math_verify_discount' && (
        <div className="space-y-4 border-l-4 border-pink-700 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Percentage Discount
          </div>
          <div className="space-y-2">
            <Label>Original Price Selector</Label>
            <Input
              value={(step as any).originalPriceSelector || ''}
              onChange={(e) => onUpdate({ originalPriceSelector: e.target.value } as any)}
              placeholder="[data-testid='original-price']"
            />
          </div>
          <div className="space-y-2">
            <Label>Discount Percentage</Label>
            <Input
              type="number"
              value={(step as any).discountPercent || 10}
              onChange={(e) => onUpdate({ discountPercent: parseFloat(e.target.value) } as any)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Final Price Selector</Label>
            <Input
              value={(step as any).finalPriceSelector || ''}
              onChange={(e) => onUpdate({ finalPriceSelector: e.target.value } as any)}
              placeholder="[data-testid='final-price']"
            />
          </div>
        </div>
      )}

      {/* Format - Verify Format */}
      {step.type === 'format_verify' && (
        <div className="space-y-4 border-l-4 border-cyan-500 pl-4">
          <div className="flex items-center gap-2 text-cyan-700 font-medium">
            <CheckCircle className="h-4 w-4" />
            Verify Text Format
          </div>
          <div className="space-y-2">
            <Label>Element Selector</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[data-testid='email-input']"
            />
          </div>
          <div className="space-y-2">
            <Label>Format Type</Label>
            <Select value={(step as any).formatType || 'email'} onValueChange={(v) => onUpdate({ formatType: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email (user@domain.com)</SelectItem>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="ssn">SSN (XXX-XX-XXXX)</SelectItem>
                <SelectItem value="zip">ZIP Code</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="password_strong">Strong Password</SelectItem>
                <SelectItem value="custom">Custom Regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(step as any).formatType === 'custom' && (
            <div className="space-y-2">
              <Label>Custom Regex Pattern</Label>
              <Input
                value={(step as any).customRegex || ''}
                onChange={(e) => onUpdate({ customRegex: e.target.value } as any)}
                placeholder="^[A-Z]{2}[0-9]{4}$"
                className="font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Random String Generator */}
      {step.type === 'random_string' && (
        <div className="space-y-4 border-l-4 border-cyan-600 pl-4">
          <div className="flex items-center gap-2 text-cyan-700 font-medium">
            <Shuffle className="h-4 w-4" />
            Generate Random String
          </div>
          <div className="space-y-2">
            <Label>String Type</Label>
            <Select value={(step as any).stringType || 'alphanumeric'} onValueChange={(v) => onUpdate({ stringType: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alphanumeric">Alphanumeric (abc123)</SelectItem>
                <SelectItem value="alpha">Letters Only (abc)</SelectItem>
                <SelectItem value="numeric">Numbers Only (123)</SelectItem>
                <SelectItem value="email">Email (test_1234@example.com)</SelectItem>
                <SelectItem value="phone">Phone (+12025551234)</SelectItem>
                <SelectItem value="username">Username (user_12345)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Length</Label>
            <Input
              type="number"
              value={(step as any).length || 10}
              onChange={(e) => onUpdate({ length: parseInt(e.target.value) } as any)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Store As Variable</Label>
            <Input
              value={(step as any).storeAs || 'random_value'}
              onChange={(e) => onUpdate({ storeAs: e.target.value } as any)}
              placeholder="random_value"
            />
          </div>
        </div>
      )}

      {/* Field Visibility */}
      {step.type === 'field_visibility' && (
        <div className="space-y-4 border-l-4 border-orange-500 pl-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium">
            <Eye className="h-4 w-4" />
            Verify Field Shows/Hides Based on Selection
          </div>
          <div className="space-y-2">
            <Label>Trigger Element Selector (e.g., Dropdown)</Label>
            <Input
              value={(step as any).triggerSelector || ''}
              onChange={(e) => onUpdate({ triggerSelector: e.target.value } as any)}
              placeholder="[data-testid='country-select']"
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger Value (what to select)</Label>
            <Input
              value={(step as any).triggerValue || ''}
              onChange={(e) => onUpdate({ triggerValue: e.target.value } as any)}
              placeholder="USA"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Field Selector</Label>
            <Input
              value={(step as any).targetSelector || ''}
              onChange={(e) => onUpdate({ targetSelector: e.target.value } as any)}
              placeholder="[data-testid='state-dropdown']"
            />
          </div>
          <div className="space-y-2">
            <Label>Expected Visibility</Label>
            <Select value={(step as any).shouldBeVisible !== false ? 'visible' : 'hidden'} onValueChange={(v) => onUpdate({ shouldBeVisible: v === 'visible' } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visible">Should be Visible</SelectItem>
                <SelectItem value="hidden">Should be Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Boundary Value Test */}
      {step.type === 'boundary_test' && (
        <div className="space-y-4 border-l-4 border-orange-600 pl-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Boundary Value Analysis
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-tests: min-1 (fail), min (pass), max (pass), max+1 (fail)
          </p>
          <div className="space-y-2">
            <Label>Input Field Selector</Label>
            <Input
              value={(step as any).inputSelector || ''}
              onChange={(e) => onUpdate({ inputSelector: e.target.value } as any)}
              placeholder="[data-testid='age-input']"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Min Value</Label>
              <Input
                type="number"
                value={(step as any).minValue ?? 0}
                onChange={(e) => onUpdate({ minValue: parseInt(e.target.value) } as any)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Value</Label>
              <Input
                type="number"
                value={(step as any).maxValue ?? 100}
                onChange={(e) => onUpdate({ maxValue: parseInt(e.target.value) } as any)}
                placeholder="100"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Submit Button Selector (optional)</Label>
            <Input
              value={(step as any).submitSelector || ''}
              onChange={(e) => onUpdate({ submitSelector: e.target.value } as any)}
              placeholder="[type='submit']"
            />
          </div>
          <div className="space-y-2">
            <Label>Error Message Selector (optional)</Label>
            <Input
              value={(step as any).errorSelector || ''}
              onChange={(e) => onUpdate({ errorSelector: e.target.value } as any)}
              placeholder=".error-message, [role='alert']"
            />
          </div>
        </div>
      )}

      {/* Expected Result with Assertion Builder */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Expected Result & Verification
          </Label>
        </div>
        
        {/* Multiple Assertions Support */}
        <div className="space-y-3">
          {/* Current Assertions List */}
          {(step.assertions || (step.assertion?.type ? [step.assertion] : [])).map((assertion, idx) => (
            <div key={assertion.id || idx} className="p-2 bg-muted/50 rounded-lg border border-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Assertion {idx + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => {
                    const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                    const newAssertions = assertions.filter((_, i) => i !== idx);
                    const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                    onUpdate({ 
                      assertions: newAssertions.length > 0 ? newAssertions : undefined, 
                      assertion: newAssertions[0] || undefined,
                      expectedResult: newExpectedResult || step.expectedResult
                    });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Assertion Type */}
              <Select
                value={assertion.type || ''}
                onValueChange={(value) => {
                  const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                  const newAssertions = [...assertions];
                  newAssertions[idx] = { ...assertion, type: value, enabled: true };
                  const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                  onUpdate({ 
                    assertions: newAssertions, 
                    assertion: newAssertions[0],
                    expectedResult: newExpectedResult
                  });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select verification..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="element_visible">✓ Element visible</SelectItem>
                  <SelectItem value="element_hidden">✗ Element hidden</SelectItem>
                  <SelectItem value="text_contains">📝 Page contains text</SelectItem>
                  <SelectItem value="value_contains">📝 Input contains</SelectItem>
                  <SelectItem value="value_equals">📝 Input equals</SelectItem>
                  <SelectItem value="url_contains">🔗 URL contains</SelectItem>
                  <SelectItem value="title_contains">📄 Title contains</SelectItem>
                  <SelectItem value="toast_message">💬 Toast/Alert</SelectItem>
                  <SelectItem value="count_equals">🔢 Element count</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Expected Value - Show for types that need it */}
              {assertion.type && !['element_visible', 'element_hidden', 'element_enabled', 'element_disabled'].includes(assertion.type) && (
                <Input
                  value={assertion.expected || ''}
                  onChange={(e) => {
                    const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                    const newAssertions = [...assertions];
                    newAssertions[idx] = { ...assertion, expected: e.target.value };
                    const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                    onUpdate({ 
                      assertions: newAssertions, 
                      assertion: newAssertions[0],
                      expectedResult: newExpectedResult
                    });
                  }}
                  placeholder={
                    assertion.type?.includes('value') ? (step.value || 'Expected value...') :
                    assertion.type?.includes('url') ? '/success, /dashboard...' :
                    assertion.type?.includes('title') ? 'Page title...' :
                    assertion.type?.includes('toast') ? 'Success message...' :
                    assertion.type?.includes('count') ? '1, 5, 10...' :
                    'Expected text...'
                  }
                  className="h-8 text-xs"
                />
              )}
              
              {/* Target Element - Optional, defaults to step selector */}
              {assertion.type && ['element_visible', 'element_hidden', 'value_contains', 'value_equals', 'text_equals', 'count_equals'].includes(assertion.type) && (
                <div className="flex items-center gap-1">
                  <Input
                    value={assertion.target || ''}
                    onChange={(e) => {
                      const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                      const newAssertions = [...assertions];
                      newAssertions[idx] = { ...assertion, target: e.target.value };
                      onUpdate({ assertions: newAssertions, assertion: newAssertions[0] });
                    }}
                    placeholder={step.selector ? `Uses: ${step.selector.slice(0, 25)}...` : 'CSS selector (optional)'}
                    className="h-7 text-xs flex-1"
                  />
                  {step.selector && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                        const newAssertions = [...assertions];
                        newAssertions[idx] = { ...assertion, target: step.selector };
                        onUpdate({ assertions: newAssertions, assertion: newAssertions[0] });
                      }}
                    >
                      Use Step
                    </Button>
                  )}
                </div>
              )}
              
              {/* Assertion Status Indicator */}
              <div className="flex items-center gap-2 text-xs">
                {assertion.enabled && assertion.type && (
                  <>
                    <span className="text-green-500">✓</span>
                    <span className="text-muted-foreground truncate">
                      {getAssertionDescription(assertion, step.selector)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
          
          {/* Add Assertion Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs border-dashed"
            onClick={() => {
              const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
              const newAssertion: StepAssertion = {
                id: `assert_${Date.now()}`,
                enabled: true,
                type: '',
                target: step.selector || '',
                expected: step.value || ''
              };
              onUpdate({ 
                assertions: [...assertions, newAssertion],
                assertion: assertions[0] || newAssertion
              });
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Verification
          </Button>
        </div>
        
        {/* Quick Suggestions */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Quick Add</Label>
          <div className="flex flex-wrap gap-1">
            {getQuickSuggestions(step.type).slice(0, 4).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                  const newAssertion: StepAssertion = {
                    id: `assert_${Date.now()}`,
                    enabled: true,
                    type: suggestion.type,
                    expected: suggestion.expected || step.value || '',
                    target: step.selector || ''
                  };
                  const newAssertions = [...assertions, newAssertion];
                  const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                  onUpdate({
                    assertions: newAssertions,
                    assertion: newAssertions[0],
                    expectedResult: newExpectedResult
                  });
                }}
                className="text-[10px] px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded transition-colors"
              >
                + {suggestion.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Free-form expected result */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Expected Result (human-readable)</Label>
          <Textarea
            value={step.expectedResult || ''}
            onChange={(e) => onUpdate({ expectedResult: e.target.value })}
            placeholder="Auto-generated from assertions above, or type custom..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

            {/* Store Result */}
            <div className="space-y-2">
              <Label className="text-xs">Store Result As (Variable)</Label>
              <Input
                value={step.storeAs || ''}
                onChange={(e) => onUpdate({ storeAs: e.target.value })}
                placeholder="e.g., response_data"
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CODE GENERATION FUNCTIONS
// ============================================================================

function generateAutomationCode(tc: UnifiedTestCase, safeName: string): string {
  // Check if first step is a navigate step
  const hasNavigateFirst = tc.steps.length > 0 && tc.steps[0].type === 'navigate';
  const baseUrl = tc.settings.baseUrl || '';
  
  let code = `"""
${tc.name}
${tc.description || 'Generated by QAAI Unified Test Builder'}

Tags: ${tc.tags.join(', ') || 'none'}
"""

import sys
import os
import re
import traceback
import random
import string
from datetime import datetime, timedelta
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

# Variable store for cross-step data
_variables = {}

# ============================================================================
# RUNTIME RANDOM GENERATION FUNCTIONS
# ============================================================================

FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
    'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
    'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Emily', 'Anthony', 'Ashley', 'Mark', 'Amanda']

LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson']

EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'test.com', 'example.com']

MIDDLE_NAMES = ['James', 'Michael', 'William', 'David', 'John', 'Marie', 'Ann', 'Lynn', 'Rose', 'Grace']

def detect_field_type(field_text):
    """Smart field type detection based on field label/name"""
    text = field_text.lower().strip()
    
    # Date components
    if re.search(r'^\\*?day$|day\\s*of|birth.*day$|^dd$', text):
        return ('day', {'minValue': 1, 'maxValue': 31})
    if re.search(r'^\\*?month$|month\\s*of|birth.*month|^mm$', text):
        return ('month', {'minValue': 1, 'maxValue': 12})
    if re.search(r'birth.*year|year.*birth|dob.*year|^\\*?year$', text):
        return ('birth_year', {'minAge': 18, 'maxAge': 80})
    if re.search(r'expir.*year|exp.*year', text):
        return ('expiry_year', {})
    
    # Names
    if re.search(r'first.*name|fname|given.*name|^\\*?first$', text):
        return ('first_name', {})
    if re.search(r'middle.*name|mname|^middle$', text):
        return ('middle_name', {})
    if re.search(r'last.*name|lname|surname|family.*name|^\\*?last$', text):
        return ('last_name', {})
    if re.search(r'full.*name|^name$|^\\*?name$', text) and not re.search(r'user|company|file', text):
        return ('full_name', {})
    
    # Contact
    if re.search(r'email|e-mail', text):
        return ('email', {})
    if re.search(r'phone|tel|mobile|cell', text):
        return ('phone', {})
    
    # Address
    if re.search(r'street|address.*1|address.*line|^addr', text):
        return ('street_address', {})
    if re.search(r'^city$|city|town', text):
        return ('city', {})
    if re.search(r'^state$|state|province', text):
        return ('state', {})
    if re.search(r'zip|postal', text):
        return ('zip', {})
    
    # Financial
    if re.search(r'cvv|cvc|security.*code', text):
        return ('cvv', {})
    if re.search(r'expir.*month|exp.*month', text):
        return ('expiry_month', {})
    
    # Account
    if re.search(r'username|user.*name|login', text):
        return ('username', {})
    if re.search(r'password|pwd|pass', text):
        return ('password', {})
    
    # Company
    if re.search(r'company|org|business|employer', text):
        return ('company', {})
    
    return ('text', {})

def generate_runtime_random(random_type, constraints=None, field_hint=''):
    """Generate random values at runtime with optional constraints"""
    constraints = constraints or {}
    current_year = datetime.now().year
    
    # Auto-detect from field hint
    if random_type == 'auto' and field_hint:
        detected_type, detected_constraints = detect_field_type(field_hint)
        return generate_runtime_random(detected_type, {**detected_constraints, **constraints}, '')
    
    # Date components
    if random_type == 'day':
        min_val = constraints.get('minValue', 1)
        max_val = constraints.get('maxValue', 28)  # Safe default
        return str(random.randint(min_val, max_val)).zfill(2)
    
    if random_type == 'month':
        min_val = constraints.get('minValue', 1)
        max_val = constraints.get('maxValue', 12)
        return str(random.randint(min_val, max_val)).zfill(2)
    
    if random_type in ('year', 'birth_year'):
        min_age = constraints.get('minAge', 18)
        max_age = constraints.get('maxAge', 80)
        min_year = current_year - max_age
        max_year = current_year - min_age
        return str(random.randint(min_year, max_year))
    
    if random_type == 'expiry_year':
        return str(random.randint(current_year, current_year + 10))
    
    if random_type == 'expiry_month':
        return str(random.randint(1, 12)).zfill(2)
    
    # Names
    if random_type == 'full_name' or random_type == 'name':
        return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

    if random_type == 'first_name':
        return random.choice(FIRST_NAMES)
    
    if random_type == 'middle_name':
        return random.choice(MIDDLE_NAMES)

    if random_type == 'last_name':
        return random.choice(LAST_NAMES)

    # Contact
    if random_type == 'email':
        first = random.choice(FIRST_NAMES).lower()
        last = random.choice(LAST_NAMES).lower()
        num = random.randint(1, 999)
        prefix = constraints.get('prefix', '')
        domain = constraints.get('domain', random.choice(EMAIL_DOMAINS))
        return f"{prefix}{first}.{last}{num}@{domain}"

    if random_type == 'phone':
        area = random.randint(200, 999)
        prefix = random.randint(200, 999)
        line = random.randint(1000, 9999)
        return f"({area}) {prefix}-{line}"
    
    # Address
    if random_type == 'street_address':
        streets = ['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Park', 'Lake', 'Hill']
        types = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd']
        return f"{random.randint(100, 9999)} {random.choice(streets)} {random.choice(types)}"
    
    if random_type == 'city':
        cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Diego', 'Dallas', 'Austin', 'Seattle', 'Denver']
        return random.choice(cities)
    
    if random_type == 'state':
        states = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Michigan', 'Arizona']
        return random.choice(states)
    
    if random_type == 'zip':
        return str(random.randint(10000, 99999))
    
    # Financial
    if random_type == 'cvv':
        return str(random.randint(100, 999))
    
    # Numbers
    if random_type == 'number':
        min_val = constraints.get('minValue', 1)
        max_val = constraints.get('maxValue', 100)
        return str(random.randint(min_val, max_val))

    # Account
    if random_type == 'username':
        first = random.choice(FIRST_NAMES).lower()
        num = random.randint(1, 9999)
        return f"{first}_{num}"

    if random_type == 'password':
        chars = string.ascii_letters + string.digits + "!@#$%"
        return ''.join(random.choice(chars) for _ in range(12))
    
    # Company
    if random_type == 'company':
        prefixes = ['Global', 'Tech', 'Prime', 'United', 'First', 'Best', 'Elite', 'Pro']
        suffixes = ['Solutions', 'Systems', 'Services', 'Group', 'Corp', 'Inc', 'LLC']
        return f"{random.choice(prefixes)} {random.choice(suffixes)}"

    # Default text
    words = ['test', 'sample', 'data', 'value', 'input', 'example', 'demo']
    return ' '.join(random.choice(words) for _ in range(2)) + f"_{random.randint(1, 999)}"

# ============================================================================
# BLACK-BOX TESTING UTILITY FUNCTIONS
# ============================================================================

# --- DATE & TIME FUNCTIONS ---
def generate_relative_date(days_offset, date_format="MM/DD/YYYY"):
    """Generate a date relative to today. days_offset: 1=tomorrow, -1=yesterday, 365=next year"""
    target_date = datetime.now() + timedelta(days=days_offset)
    format_map = {
        "MM/DD/YYYY": "%m/%d/%Y",
        "DD/MM/YYYY": "%d/%m/%Y",
        "YYYY-MM-DD": "%Y-%m-%d",
        "MM-DD-YYYY": "%m-%d-%Y",
        "MMMM DD, YYYY": "%B %d, %Y"
    }
    py_format = format_map.get(date_format, "%m/%d/%Y")
    return target_date.strftime(py_format)

def verify_date_is_future(date_string):
    """Verify a date string is in the future"""
    formats = ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%m-%d-%Y", "%B %d, %Y"]
    for fmt in formats:
        try:
            date_obj = datetime.strptime(date_string.strip(), fmt)
            is_future = date_obj.date() > datetime.now().date()
            if not is_future:
                raise AssertionError(f"Date '{date_string}' is not in the future (today: {datetime.now().date()})")
            return True
        except ValueError:
            continue
    raise ValueError(f"Could not parse date: {date_string}")

def verify_date_sequence(start_date_str, end_date_str):
    """Verify end_date is after start_date"""
    formats = ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%m-%d-%Y"]
    start_date = None
    end_date = None
    for fmt in formats:
        try:
            if not start_date: start_date = datetime.strptime(start_date_str.strip(), fmt)
            if not end_date: end_date = datetime.strptime(end_date_str.strip(), fmt)
        except ValueError:
            continue
    if not start_date or not end_date:
        raise ValueError(f"Could not parse dates: start='{start_date_str}', end='{end_date_str}'")
    if end_date <= start_date:
        raise AssertionError(f"End date ({end_date_str}) is not after start date ({start_date_str})")
    return True

def verify_age_calculation(birth_date_str, expected_age_group):
    """Verify age calculation: expected_age_group can be 'adult' (18+), 'minor' (<18), 'senior' (65+)"""
    formats = ["%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"]
    for fmt in formats:
        try:
            birth_date = datetime.strptime(birth_date_str.strip(), fmt)
            today = datetime.now()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if expected_age_group == "adult" and age < 18:
                raise AssertionError(f"Expected adult (18+), but calculated age is {age}")
            elif expected_age_group == "minor" and age >= 18:
                raise AssertionError(f"Expected minor (<18), but calculated age is {age}")
            elif expected_age_group == "senior" and age < 65:
                raise AssertionError(f"Expected senior (65+), but calculated age is {age}")
            return age
        except ValueError:
            continue
    raise ValueError(f"Could not parse birth date: {birth_date_str}")

# --- MATH & CALCULATION FUNCTIONS ---
def parse_number(text):
    """Extract a number from text (handles $, commas, etc.)"""
    if not text: return 0.0
    cleaned = re.sub(r"[^\\d.\\-]", "", str(text).replace(",", ""))
    return float(cleaned) if cleaned else 0.0

def verify_multiplication(factor1, factor2, expected_result, tolerance=0.01):
    """Verify factor1 × factor2 = expected_result (with optional tolerance for rounding)"""
    f1, f2, expected = parse_number(factor1), parse_number(factor2), parse_number(expected_result)
    actual = f1 * f2
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"Multiplication failed: {f1} × {f2} = {actual}, expected {expected}")
    return True

def verify_sum(values, expected_total, tolerance=0.01):
    """Verify sum of values equals expected_total"""
    nums = [parse_number(v) for v in values]
    actual_sum = sum(nums)
    expected = parse_number(expected_total)
    if abs(actual_sum - expected) > tolerance:
        raise AssertionError(f"Sum failed: {nums} = {actual_sum}, expected {expected}")
    return True

def verify_percentage_discount(original_price, discount_percent, final_price, tolerance=0.01):
    """Verify discount: final = original × (1 - discount/100)"""
    orig = parse_number(original_price)
    disc = parse_number(discount_percent)
    final = parse_number(final_price)
    expected = orig * (1 - disc / 100)
    if abs(final - expected) > tolerance:
        raise AssertionError(f"Discount failed: {orig} - {disc}% = {final}, expected {expected:.2f}")
    return True

# --- STRING & FORMAT VALIDATION FUNCTIONS ---
FORMAT_PATTERNS = {
    "email": r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$",
    "phone": r"^[\\+]?[(]?[0-9]{1,3}[)]?[-\\s\\.]?[0-9]{3,4}[-\\s\\.]?[0-9]{4,6}$",
    "ssn": r"^\\d{3}-\\d{2}-\\d{4}$",
    "zip": r"^\\d{5}(-\\d{4})?$",
    "credit_card": r"^\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}[\\-\\s]?\\d{4}$",
    "date_us": r"^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])/\\d{4}$",
    "url": r"^https?://[\\w\\.-]+\\.[a-z]{2,}(/.*)?$",
    "password_strong": r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
}

def verify_text_format(text, format_type, custom_regex=None):
    """Verify text matches expected format (email, phone, ssn, zip, credit_card, url, password_strong, or custom)"""
    if format_type == "custom" and custom_regex:
        pattern = custom_regex
    else:
        pattern = FORMAT_PATTERNS.get(format_type)
        if not pattern:
            raise ValueError(f"Unknown format type: {format_type}")
    if not re.match(pattern, str(text).strip()):
        raise AssertionError(f"Text '{text}' does not match {format_type} format")
    return True

def generate_random_string(length=10, string_type="alphanumeric"):
    """Generate random string: alphanumeric, alpha, numeric, email, phone, username"""
    if string_type == "alphanumeric":
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    elif string_type == "alpha":
        return ''.join(random.choices(string.ascii_letters, k=length))
    elif string_type == "numeric":
        return ''.join(random.choices(string.digits, k=length))
    elif string_type == "email":
        return f"test_{random.randint(1000, 9999)}@example.com"
    elif string_type == "phone":
        return f"+1{random.randint(200, 999)}{random.randint(100, 999)}{random.randint(1000, 9999)}"
    elif string_type == "username":
        return f"user_{random.randint(10000, 99999)}"
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

# --- BOUNDARY VALUE ANALYSIS FUNCTIONS ---
def run_boundary_test(page, input_selector, min_val, max_val, submit_selector=None, error_selector=None):
    """
    Run boundary value tests: min-1 (fail), min (pass), max (pass), max+1 (fail)
    Returns dict with results for each boundary.
    """
    results = {}
    test_values = [
        (min_val - 1, "below_min", False),
        (min_val, "at_min", True),
        (max_val, "at_max", True),
        (max_val + 1, "above_max", False),
    ]
    for value, label, should_pass in test_values:
        try:
            # Clear and input value
            page.locator(input_selector).fill(str(value))
            # Submit if selector provided
            if submit_selector:
                page.locator(submit_selector).click(force=True, no_wait_after=True, timeout=10000)
                page.wait_for_timeout(500)
            # Check for error
            has_error = False
            if error_selector:
                has_error = page.locator(error_selector).is_visible()
            # Validate expectation
            passed = (should_pass and not has_error) or (not should_pass and has_error)
            results[label] = {"value": value, "expected_pass": should_pass, "actual_pass": not has_error, "test_passed": passed}
        except Exception as e:
            results[label] = {"value": value, "error": str(e), "test_passed": False}
    return results

# --- VARIABLE STORAGE FUNCTIONS ---
def store_variable(name, value):
    """Store a value for later use"""
    _variables[name] = value
    print(f"[STORED] Variable '{name}' = {value}")
    return value

def get_variable(name, default=None):
    """Retrieve a stored variable"""
    return _variables.get(name, default)

def test_${safeName}():
    """${tc.description || tc.name}"""
    global test_results

    # Use persistent browser context to remember MFA/login sessions
    user_data_dir = os.path.join(os.environ.get('TEMP', '/tmp'), 'playwright_salesforce_session')
    os.makedirs(user_data_dir, exist_ok=True)
    
    with sync_playwright() as p:
        # Launch with persistent context - remembers cookies, localStorage, MFA verification
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            viewport={"width": 1280, "height": 720}
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.set_default_timeout(30000)  # 30 second timeout

        # ==================== SALESFORCE AUTOMATION HELPER ====================
        class SalesforceHelper:
            """Comprehensive Salesforce Lightning automation helper."""
            ELEMENT_SELECTORS = {
                'app_launcher_button': ['div.slds-icon-waffle', 'button[class*="appLauncher"]', '.slds-context-bar__icon-action'],
                'app_launcher_search': [
                    'one-app-launcher-menu input[type="search"]', 'one-app-launcher-menu input[placeholder*="Search"]',
                    'input[placeholder*="Search apps and items"]', 'input[placeholder*="Search Apps"]',
                    '.slds-modal input[type="search"]', 'input.slds-input[placeholder*="Search"]', 'input[type="search"]',
                ],
                'app_launcher_modal': ['one-app-launcher-menu', 'section.slds-modal', '[role="dialog"]'],
                'spinner': ['lightning-spinner', '.slds-spinner_container', '.slds-spinner', '[aria-busy="true"]'],
                'record_tab': [
                    'a[data-tab-value="detailTab"]', 'a[data-label="Details"]',
                    '[role="tab"]', 'a.slds-tabs_default__link', 
                    'li.slds-tabs_default__item a', 'lightning-tab-bar a',
                ],
            }
            def __init__(self, page):
                self.page = page
            def wait_for_ready(self, timeout=15000):
                try: self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
                except: pass
                for spinner in self.ELEMENT_SELECTORS['spinner']:
                    try: self.page.locator(spinner).wait_for(state="hidden", timeout=3000)
                    except: pass
                self.page.wait_for_timeout(300)
            def find(self, desc, selectors=None):
                desc_lower = desc.lower()
                sels = list(selectors or [])
                if 'app launcher' in desc_lower or 'waffle' in desc_lower:
                    sels.extend(self.ELEMENT_SELECTORS['app_launcher_button'])
                if 'search' in desc_lower:
                    sels.extend(self.ELEMENT_SELECTORS['app_launcher_search'])
                # Salesforce record page tabs (Details, Related, Activity, etc.)
                if desc_lower in ['details', 'related', 'activity', 'news', 'chatter'] or 'tab' in desc_lower:
                    sels.extend(self.ELEMENT_SELECTORS['record_tab'])
                    sels.extend([
                        f'a[data-label="{desc}"]', f'a[data-tab-name="{desc}"]',
                        f'[role="tab"][aria-label*="{desc}"]', f'a.slds-tabs_default__link:has-text("{desc}")',
                        f'li.slds-tabs_default__item:has-text("{desc}") a',
                    ])
                sels.extend([f'text="{desc}"', f'[title="{desc}"]', f'[aria-label="{desc}"]', f'[placeholder*="{desc}"]'])
                for retry in range(5):
                    if retry > 0: self.page.wait_for_timeout(1000 * retry)
                    for sel in sels:
                        try:
                            loc = self.page.locator(sel)
                            if loc.count() > 0:
                                loc.first.wait_for(state="visible", timeout=3000)
                                return loc.first
                        except: continue
                return None
            def click(self, desc, selectors=None):
                el = self.find(desc, selectors)
                if not el: raise Exception(f"Element not found: {desc}")
                for strat in [lambda: el.click(force=True, no_wait_after=True, timeout=10000), lambda: el.dispatch_event('click')]:
                    try:
                        strat()
                        self.wait_for_ready()
                        return True
                    except: continue
                raise Exception(f"Click failed: {desc}")
            def fill(self, desc, value, selectors=None):
                el = self.find(desc, selectors)
                if not el: raise Exception(f"Input not found: {desc}")
                strategies = [
                    lambda: (el.click(timeout=3000), self.page.wait_for_timeout(200), el.fill(value, timeout=5000)),
                    lambda: (el.click(timeout=3000), self.page.wait_for_timeout(200), el.type(value, delay=30)),
                    lambda: (el.click(click_count=3, timeout=3000), self.page.keyboard.type(value)),
                    lambda: (el.focus(), self.page.keyboard.press('Control+a'), self.page.keyboard.type(value)),
                ]
                for strat in strategies:
                    try:
                        strat()
                        return True
                    except: continue
                raise Exception(f"Fill failed: {desc}")
            def open_app_launcher(self):
                result = self.click("App Launcher")
                # Wait for modal to appear after clicking waffle icon
                self.page.wait_for_timeout(1500)  # Initial wait
                for sel in self.ELEMENT_SELECTORS['app_launcher_modal']:
                    try:
                        self.page.locator(sel).first.wait_for(state="visible", timeout=5000)
                        break
                    except: continue
                return result
            def search_app_launcher(self, text):
                # ROBUST: Check if modal is open, if not click waffle icon again
                def is_modal_visible():
                    for sel in self.ELEMENT_SELECTORS['app_launcher_modal']:
                        try:
                            if self.page.locator(sel).first.is_visible(timeout=1000):
                                return True
                        except: continue
                    return False
                
                # If modal not visible, click waffle icon to open it
                if not is_modal_visible():
                    print("   [+] App Launcher modal not visible, clicking waffle icon...")
                    for waffle_sel in self.ELEMENT_SELECTORS['app_launcher_button']:
                        try:
                            waffle = self.page.locator(waffle_sel)
                            if waffle.count() > 0:
                                waffle.first.click(force=True)
                                self.page.wait_for_timeout(2000)
                                break
                        except: continue
                
                # Wait for modal with longer timeout
                for attempt in range(5):
                    if is_modal_visible(): break
                    self.page.wait_for_timeout(1000)
                
                self.page.wait_for_timeout(1000)  # Extra wait for search input
                
                # Extensive list of search selectors
                search_selectors = [
                    'one-app-launcher-menu input[type="search"]',
                    'one-app-launcher-menu input',
                    'input[placeholder*="Search apps"]',
                    'input[placeholder*="Search Apps"]',
                    'input[placeholder*="Search items"]',
                    '.slds-modal input[type="search"]',
                    'input.slds-input[placeholder*="Search"]',
                    '[role="searchbox"]',
                    'input[type="search"]:visible',
                    'one-app-launcher-search-bar input',
                    'lightning-input input[type="search"]',
                ] + self.ELEMENT_SELECTORS['app_launcher_search']
                
                for attempt in range(5):
                    print(f"   [+] Attempt {attempt + 1} to find search input...")
                    for sel in search_selectors:
                        try:
                            el = self.page.locator(sel)
                            count = el.count()
                            if count > 0:
                                print(f"   [+] Found {count} element(s) with: {sel[:50]}")
                                target = el.first
                                target.wait_for(state="visible", timeout=2000)
                                # Try multiple fill strategies
                                for strategy in ['click_fill', 'click_type', 'focus_type', 'keyboard']:
                                    try:
                                        if strategy == 'click_fill':
                                            target.click(timeout=2000)
                                            self.page.wait_for_timeout(300)
                                            target.fill(text, timeout=3000)
                                        elif strategy == 'click_type':
                                            target.click(timeout=2000)
                                            self.page.wait_for_timeout(300)
                                            target.type(text, delay=50)
                                        elif strategy == 'focus_type':
                                            target.focus()
                                            self.page.keyboard.type(text)
                                        elif strategy == 'keyboard':
                                            target.click(timeout=2000)
                                            self.page.keyboard.press('Control+a')
                                            self.page.keyboard.type(text)
                                        print(f"   [+] Filled search with strategy: {strategy}")
                                        return True
                                    except Exception as e:
                                        print(f"   Strategy {strategy} failed: {str(e)[:30]}")
                                        continue
                        except: continue
                    self.page.wait_for_timeout(1500)
                raise Exception(f"Could not fill App Launcher search after retries")
            def select_app(self, name):
                self.page.wait_for_timeout(1000)
                for sel in [f'one-app-launcher-menu-item a:has-text("{name}")', f'text="{name}"']:
                    try:
                        app = self.page.locator(sel).first
                        if app.is_visible(timeout=3000):
                            app.click()
                            self.wait_for_ready()
                            return True
                    except: continue
                raise Exception(f"App not found: {name}")
        
        sf = SalesforceHelper(page)  # Create Salesforce helper instance
        # ==================== END SALESFORCE HELPER ====================

        try:
`;

  // Add initial navigation if baseUrl is set and first step is not navigate
  if (baseUrl && !hasNavigateFirst) {
    code += `
            # Initial Navigation (from Base URL)
            print("[NAV] Navigating to base URL: ${baseUrl}")
            page.goto("${baseUrl}")
            page.wait_for_load_state("domcontentloaded")
            print("[OK] Page loaded successfully")
`;
  } else if (!hasNavigateFirst && !baseUrl) {
    // No navigate step and no baseUrl - add a warning
    code += `
            # [!] WARNING: No initial URL specified!
            # Please add a Navigate step or set Base URL in test settings
            print("[WARN] No initial URL - browser will open to blank page")
            print("   Add a Navigate step or set Base URL in Settings")
`;
  }

  // Handle preconditions - they are now inlined as steps, just add a note
  if (tc.preconditions && tc.preconditions.length > 0) {
    const enabledPreconditions = tc.preconditions.filter(p => p.enabled);
    if (enabledPreconditions.length > 0) {
      code += `
            # ========== PRECONDITIONS (${enabledPreconditions.length} test case(s) inlined) ==========
            print("🔗 Running ${enabledPreconditions.length} precondition test case(s) first...")
`;
    }
  }

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
      case 'click': {
        // CHECK: Is this actually a HOVER disguised as a click?
        // If the step name contains "Hover" at start or after "Click:", treat it as a hover (skip)
        const stepNameRaw = step.name || '';
        const isActuallyHover = /^(?:\[Precond\]\s*)?(?:Click:\s*)?Hover\s/i.test(stepNameRaw);
        
        if (isActuallyHover) {
          // This is a hover recorded as click - make it non-blocking
          const hoverTarget = stepNameRaw.replace(/^\[Precond\]\s*/i, '').replace(/^Click:\s*/i, '').replace(/^Hover\s*/i, '').trim();
          const safeHoverTarget = hoverTarget.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/[^\x00-\x7F]/g, '');
          code += `${indent}# HOVER (non-critical): ${safeHoverTarget}\n`;
          code += `${indent}try:\n`;
          code += `${indent}    print(f"[SKIP] Hover '${safeHoverTarget}' - hovers are non-critical, skipping")\n`;
          code += `${indent}except:\n`;
          code += `${indent}    pass\n`;
          break;
        }
        
        // Generate selectors with fallbacks - SAME LOGIC AS SUGGEST FEATURE
        const stepNameClean = step.name.replace(/^\[Precond\]\s*/i, '').replace(/^Click:\s*/i, '').trim();
        const elementIndex = (step as any).elementIndex;
        const stepNameLowerClick = stepNameClean.toLowerCase();
        const selectorStrClick = JSON.stringify(step.selectorObj || step.selector || {}).toLowerCase();
        
        // SALESFORCE: Detect App Launcher WAFFLE ICON click ONLY (not navigation items containing "App Launcher")
        // Must match waffle icon specifically, not text like "App LauncherDeveloper Edition"
        const isWaffleIconClick = selectorStrClick.includes('waffle') || selectorStrClick.includes('slds-icon-waffle') ||
                                  selectorStrClick.includes('appLauncher') ||
                                  (stepNameLowerClick === 'app launcher' || stepNameLowerClick === 'click app launcher' ||
                                   stepNameLowerClick === 'click "app launcher"');
        
        if (isWaffleIconClick) {
          code += `${indent}# SALESFORCE: Use dedicated App Launcher click (waffle icon)\n`;
          code += `${indent}sf.open_app_launcher()\n`;
          code += `${indent}print(f"   [+] Clicked App Launcher (via Salesforce Helper)")\n`;
          break; // Skip the normal click handling - sf helper handles everything
        }
        
        // Build list of selectors to try (same order as Suggest)
        const selectorsToTry: string[] = [];
        
        // 1. Primary selector from selectorObj (same as Suggest)
        if (step.selectorObj?.playwright) {
          selectorsToTry.push(`page.${step.selectorObj.playwright}`);
        }
        // 2. Fallbacks from selectorObj (same as Suggest)
        if (step.selectorObj?.fallbacks && Array.isArray(step.selectorObj.fallbacks)) {
          step.selectorObj.fallbacks.forEach(fb => {
            if (fb && fb.playwright) selectorsToTry.push(`page.${fb.playwright}`);
          });
        }
        // 3. Direct selector (only if it's a string)
        if (step.selector && typeof step.selector === 'string' && step.selector.trim()) {
          selectorsToTry.push(`page.${convertSelector(step.selector)}`);
        } else if (step.selector && typeof step.selector === 'object') {
          // Handle case where selector is an object with playwright property
          const selectorObj = step.selector as any;
          if (selectorObj.playwright) {
            selectorsToTry.push(`page.${selectorObj.playwright}`);
          } else if (selectorObj.selector && typeof selectorObj.selector === 'string') {
            selectorsToTry.push(`page.${convertSelector(selectorObj.selector)}`);
          }
        }
        // 4. Text from selectorObj (escape newlines and special chars)
        if (step.selectorObj?.text) {
          const escapedText = escapeForPython(step.selectorObj.text);
          selectorsToTry.push(`page.get_by_text("${escapedText}", exact=True)`);
          selectorsToTry.push(`page.get_by_text("${escapedText}")`);
        }
        // 5. Target-based selector
        if (step.target && step.target.trim()) {
          const escapedTarget = escapeForPython(step.target);
          selectorsToTry.push(`page.get_by_text("${escapedTarget}", exact=True)`);
        }
        // 6. Step name-based selector
        if (stepNameClean) {
          const escapedName = escapeForPython(stepNameClean);
          selectorsToTry.push(`page.get_by_text("${escapedName}")`);
          selectorsToTry.push(`page.get_by_role("button", name="${escapedName}")`);
          selectorsToTry.push(`page.get_by_role("link", name="${escapedName}")`);
        }
        // 7. Title/aria-label based selectors (CRITICAL for Salesforce App Launcher)
        if (step.selectorObj?.ariaLabel) {
          const escapedAriaLabel = escapeForPython(step.selectorObj.ariaLabel);
          selectorsToTry.push(`page.locator('[aria-label="${escapedAriaLabel}"]')`);
        }
        // Also try title selector based on step name (common pattern)
        if (stepNameClean) {
          const cleanName = stepNameClean.replace(/^Click:\s*/i, '').replace(/^Click\s*/i, '').replace(/^Hover:?\s*/i, '').replace(/"/g, '').trim();
          if (cleanName && cleanName.length > 0 && cleanName.length < 50) {
            const escapedTitle = escapeForPython(cleanName);
            selectorsToTry.push(`page.locator('[title="${escapedTitle}"]')`);
            selectorsToTry.push(`page.locator('button[title="${escapedTitle}"]')`);
            
            // 8. SALESFORCE: Record page tabs (Details, Related, Activity, News, etc.)
            const tabNames = ['details', 'related', 'activity', 'news', 'chatter', 'files', 'history'];
            if (tabNames.includes(cleanName.toLowerCase())) {
              selectorsToTry.push(`page.locator('a[data-label="${cleanName}"]')`);
              selectorsToTry.push(`page.locator('a[data-tab-name="${cleanName}"]')`);
              selectorsToTry.push(`page.locator('a[data-tab-value="${cleanName.toLowerCase()}Tab"]')`);
              selectorsToTry.push(`page.locator('[role="tab"]:has-text("${cleanName}")')`);
              selectorsToTry.push(`page.locator('a.slds-tabs_default__link:has-text("${cleanName}")')`);
              selectorsToTry.push(`page.locator('li.slds-tabs_default__item a:has-text("${cleanName}")')`);
              selectorsToTry.push(`page.locator('lightning-tab-bar a:has-text("${cleanName}")')`);
              selectorsToTry.push(`page.get_by_role("tab", name="${cleanName}")`);
              selectorsToTry.push(`page.locator('one-record-home-flexipage2 a:has-text("${cleanName}")')`);
            }
          }
        }

        // Deduplicate selectors and ensure at least one exists
        const uniqueSelectors = [...new Set(selectorsToTry)].filter(s => s && s.length > 0);

        // Fallback: if no selectors found, use step name as text selector
        if (uniqueSelectors.length === 0 && stepNameClean) {
          uniqueSelectors.push(`page.get_by_text("${escapeForPython(stepNameClean)}")`);
        }
        
        code += `${indent}# Click element with fallback selectors (same logic as Suggest)\n`;
        // Escape quotes in step name for Python f-string AND remove non-ASCII chars (Windows cp1252 compatibility)
        const stepNameForPython = stepNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/[^\x00-\x7F]/g, '');
        code += `${indent}print(f"[FIND] Looking for: ${stepNameForPython}")\n`;
        code += `${indent}_selectors_to_try = [\n`;
        uniqueSelectors.forEach((sel, i) => {
          // Escape selector string properly for Python
          const safeSel = sel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          code += `${indent}    ("${safeSel}", ${i + 1}),\n`;
        });
        code += `${indent}]\n`;
        code += `${indent}_element_found = False\n`;
        // ROBUST: Progressive retry with increasing wait times for dynamic elements (modals, SPAs)
        code += `${indent}_max_retries = 3\n`;
        code += `${indent}_retry_delays = [0, 2000, 4000]  # Progressive wait times\n`;
        code += `${indent}for _retry in range(_max_retries):\n`;
        code += `${indent}    if _retry > 0:\n`;
        code += `${indent}        print(f"   [RETRY {_retry}] Waiting {_retry_delays[_retry]}ms for element...")\n`;
        code += `${indent}        page.wait_for_timeout(_retry_delays[_retry])\n`;
        code += `${indent}    for _selector_str, _priority in _selectors_to_try:\n`;
        code += `${indent}        try:\n`;
        code += `${indent}            print(f"   Trying selector #{_priority}: {_selector_str[:60]}...")\n`;
        code += `${indent}            _el = eval(_selector_str)\n`;
        code += `${indent}            _count = _el.count()\n`;
        code += `${indent}            if _count > 0:\n`;
        code += `${indent}                # ROBUST: Wait for element to be visible and scroll into view\n`;
        code += `${indent}                try:\n`;
        code += `${indent}                    _el.first.wait_for(state="visible", timeout=5000)\n`;
        code += `${indent}                except:\n`;
        code += `${indent}                    pass  # Continue even if wait times out\n`;
        code += `${indent}                try:\n`;
        code += `${indent}                    _el.first.scroll_into_view_if_needed()\n`;
        code += `${indent}                except:\n`;
        code += `${indent}                    pass  # Continue even if scroll fails\n`;
        code += `${indent}                print(f"   [+] Found {_count} element(s) with selector #{_priority}")\n`;
        if (elementIndex !== undefined && elementIndex !== null) {
          code += `${indent}                # Click with force and no_wait_after to bypass actionability and navigation timeout\n`;
          code += `${indent}                _el.nth(${elementIndex}).click(force=True, no_wait_after=True, timeout=10000)\n`;
        } else {
        code += `${indent}                if _count > 1:\n`;
        code += `${indent}                    print(f"   [WARN] Multiple matches, clicking first visible")\n`;
        code += `${indent}                    _clicked = False\n`;
        code += `${indent}                    for i in range(_count):\n`;
        code += `${indent}                        try:\n`;
        code += `${indent}                            if _el.nth(i).is_visible():\n`;
        code += `${indent}                                _el.nth(i).scroll_into_view_if_needed()\n`;
        code += `${indent}                                _el.nth(i).click(force=True, no_wait_after=True, timeout=10000)\n`;
        code += `${indent}                                _clicked = True\n`;
        code += `${indent}                                break\n`;
        code += `${indent}                        except:\n`;
        code += `${indent}                            continue\n`;
        code += `${indent}                    if not _clicked:\n`;
        code += `${indent}                        _el.first.scroll_into_view_if_needed()\n`;
        code += `${indent}                        _el.first.click(force=True, no_wait_after=True, timeout=10000)\n`;
        code += `${indent}                else:\n`;
        code += `${indent}                    _el.scroll_into_view_if_needed()\n`;
        code += `${indent}                    _el.click(force=True, no_wait_after=True, timeout=10000)\n`;
        }
        code += `${indent}                _element_found = True\n`;
        code += `${indent}                break\n`;
        code += `${indent}            else:\n`;
        code += `${indent}                print(f"   Selector #{_priority}: 0 elements found")\n`;
        code += `${indent}        except Exception as _e:\n`;
        code += `${indent}            print(f"   Selector #{_priority} click failed: {str(_e)[:60]}")\n`;
        code += `${indent}            continue\n`;
        code += `${indent}    if _element_found:\n`;
        code += `${indent}        break\n`;
        code += `${indent}if not _element_found:\n`;
        code += `${indent}    print("[FAIL] Element not found with any selector after retries")\n`;
        code += `${indent}    raise Exception("Click failed: No elements found matching any selector")\n`;
        
        // CRITICAL: Add extra wait after login button clicks (Salesforce Lightning needs time to load)
        // Detect login buttons by: name, target, selector attributes, or if it's a submit-type button after password field
        const stepNameLower = (step.name || '').toLowerCase();
        const stepTargetLower = (step.target || '').toLowerCase();
        const selectorLower = (step.selector || '').toLowerCase();
        const selectorObjStr = JSON.stringify(step.selectorObj || {}).toLowerCase();
        
        const isLoginButton = 
          stepNameLower.includes('log in') || stepNameLower.includes('login') || stepNameLower.includes('sign in') ||
          stepTargetLower.includes('log in') || stepTargetLower.includes('login') || stepTargetLower.includes('sign in') ||
          selectorLower.includes('login') || selectorLower.includes('submit') ||
          selectorObjStr.includes('login') || selectorObjStr.includes('name="login"') ||
          // Also detect by context: input[type=submit] button right after password field
          (step.selectorObj?.name?.toLowerCase() === 'login');
          
        if (isLoginButton) {
          code += `${indent}# Wait for post-login page load (Salesforce Lightning needs extra time)\n`;
          code += `${indent}# Note: Skip networkidle wait - Salesforce makes continuous API calls\n`;
          code += `${indent}try:\n`;
          code += `${indent}    page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
          code += `${indent}except:\n`;
          code += `${indent}    pass  # Continue even if page is still loading\n`;
          code += `${indent}page.wait_for_timeout(8000)  # Fixed wait for Lightning Experience to fully load\n`;
        }
        
        // CRITICAL: Add wait for App Launcher modal after clicking waffle icon
        const isAppLauncher = 
          stepNameLower.includes('app launcher') || stepNameLower.includes('applauncher') ||
          stepTargetLower.includes('app launcher') || stepTargetLower.includes('applauncher') ||
          selectorLower.includes('waffle') || selectorLower.includes('app-launcher') ||
          selectorObjStr.includes('waffle') || selectorObjStr.includes('slds-icon-waffle');
          
        if (isAppLauncher) {
          code += `${indent}# Wait for App Launcher modal to open\n`;
          code += `${indent}try:\n`;
          code += `${indent}    page.locator('div.slds-modal__content, div.appLauncherMenu, one-app-launcher-menu').wait_for(state="visible", timeout=10000)\n`;
          code += `${indent}except:\n`;
          code += `${indent}    pass  # Modal might already be visible or use different selector\n`;
          code += `${indent}page.wait_for_timeout(1500)  # Extra wait for search input to be interactive\n`;
        }
        break;
      }
      case 'input': {
        // Check for runtime random generation
        const isRuntimeRandom = step.runtimeRandom?.enabled === true;
        const runtimeType = step.runtimeRandom?.type || 'auto';
        const constraints = step.runtimeRandom?.constraints || {};
        const storeAsVar = step.storeAs || '';
        
        // Ensure value is a string, not an object or JSON
        let inputValue = typeof step.value === 'string' ? step.value : '';
        // CRITICAL: Detect if value is a JSON object (corrupted data) and skip it
        if (inputValue.startsWith('{') && inputValue.includes('"id":')) {
          console.warn('[CodeGen] Detected JSON object as value, using empty string');
          inputValue = ''; // Don't pass JSON as input value
        }
        // Escape quotes in the value
        const escapedInputValue = inputValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const inputNameClean = step.name.replace(/^\[Precond\]\s*/i, '').replace(/^Input:\s*/i, '').replace(/^\*/, '').trim();
        
        // If runtime random, generate code to create value at runtime
        if (isRuntimeRandom) {
          const constraintsJson = JSON.stringify(constraints).replace(/"/g, "'");
          const fieldHintEscaped = inputNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'");
          code += `${indent}# Generate runtime random value\n`;
          code += `${indent}_runtime_value = generate_runtime_random("${runtimeType}", ${constraintsJson.replace(/'/g, '"')}, "${fieldHintEscaped}")\n`;
          if (storeAsVar) {
            code += `${indent}_variables["${storeAsVar}"] = _runtime_value\n`;
            code += `${indent}print(f"   [SAVED] Stored as '${storeAsVar}': {_runtime_value}")\n`;
          }
        }
        
        // Build list of selectors to try (same order as Suggest)
        const inputSelectorsToTry: string[] = [];
        
        // Helper: Ensure playwright locator uses proper CSS selector format
        const ensureProperSelector = (playwright: string): string => {
          if (!playwright) return '';
          console.log('[ensureProperSelector] Input:', playwright);
          // Extract inner selector from locator('...')
          const match = playwright.match(/^locator\(['"](.+)['"]\)$/);
          if (match) {
            const inner = match[1];
            console.log('[ensureProperSelector] Inner selector:', inner);
            // Check if it's a simple name without CSS prefix - convert to [name="..."]
            if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(inner) && !inner.includes(' ')) {
              const result = `locator('[name="${inner}"]')`;
              console.log('[ensureProperSelector] Converted to:', result);
              return result;
            }
          }
          console.log('[ensureProperSelector] No conversion needed, returning:', playwright);
          return playwright;
        };
        
        // 1. Primary selector from selectorObj (same as Suggest) - ENSURE PROPER FORMAT
        if (step.selectorObj?.playwright) {
          inputSelectorsToTry.push(`page.${ensureProperSelector(step.selectorObj.playwright)}`);
        }
        // 2. Fallbacks from selectorObj (same as Suggest)
        if (step.selectorObj?.fallbacks && Array.isArray(step.selectorObj.fallbacks)) {
          step.selectorObj.fallbacks.forEach(fb => {
            if (fb && fb.playwright) inputSelectorsToTry.push(`page.${fb.playwright}`);
          });
        }
        // 3. Direct selector (only if it's a string)
        if (step.selector && typeof step.selector === 'string' && step.selector.trim()) {
          inputSelectorsToTry.push(`page.${convertSelector(step.selector)}`);
        } else if (step.selector && typeof step.selector === 'object') {
          // Handle case where selector is an object with playwright property
          const selectorObj = step.selector as any;
          if (selectorObj.playwright) {
            inputSelectorsToTry.push(`page.${selectorObj.playwright}`);
          } else if (selectorObj.selector && typeof selectorObj.selector === 'string') {
            inputSelectorsToTry.push(`page.${convertSelector(selectorObj.selector)}`);
          }
        }
        // 4. Label-based selectors (escape newlines and special chars)
        if (step.selectorObj?.text || step.target || inputNameClean) {
          const labelText = escapeForPython(step.selectorObj?.text || step.target || inputNameClean);
          inputSelectorsToTry.push(`page.get_by_label("${labelText}")`);
          inputSelectorsToTry.push(`page.get_by_placeholder("${labelText}")`);
          inputSelectorsToTry.push(`page.get_by_label("${labelText}", exact=False)`);
        }
        // 5. Name attribute
        if (step.selectorObj?.name) {
          inputSelectorsToTry.push(`page.locator('[name="${step.selectorObj.name}"]')`);
        }
        
        // 6. SALESFORCE-SPECIFIC: Add robust fallbacks for common Salesforce UI patterns
        const inputNameLower = inputNameClean.toLowerCase();
        
        // App Launcher search box
        if (inputNameLower.includes('search apps') || inputNameLower.includes('search items') || inputNameLower.includes('app launcher')) {
          inputSelectorsToTry.push(`page.locator('input[placeholder*="Search apps"]')`);
          inputSelectorsToTry.push(`page.locator('input[placeholder*="Search Apps"]')`);
          inputSelectorsToTry.push(`page.locator('one-app-launcher-menu input[type="search"]')`);
          inputSelectorsToTry.push(`page.locator('.slds-modal input[type="search"]')`);
          inputSelectorsToTry.push(`page.locator('input.slds-input[placeholder*="Search"]')`);
          inputSelectorsToTry.push(`page.get_by_role("searchbox")`);
          inputSelectorsToTry.push(`page.locator('[data-aura-class*="appLauncher"] input')`);
        }
        
        // Global search box
        if (inputNameLower.includes('search salesforce') || inputNameLower.includes('global search')) {
          inputSelectorsToTry.push(`page.locator('input[placeholder*="Search Salesforce"]')`);
          inputSelectorsToTry.push(`page.locator('button.slds-button[aria-label*="Search"]')`);
          inputSelectorsToTry.push(`page.get_by_role("combobox", name=re.compile("search", re.I))`);
        }
        
        // Generic search fallback
        if (inputNameLower.includes('search')) {
          inputSelectorsToTry.push(`page.get_by_role("searchbox")`);
          inputSelectorsToTry.push(`page.locator('input[type="search"]')`);
          inputSelectorsToTry.push(`page.locator('input[placeholder*="Search"]')`);
        }
        
        // Deduplicate selectors and ensure at least one exists
        const uniqueInputSelectors = [...new Set(inputSelectorsToTry)].filter(s => s && s.length > 0);
        
        // Fallback: if no selectors found, use step name as label selector
        if (uniqueInputSelectors.length === 0 && inputNameClean) {
          uniqueInputSelectors.push(`page.get_by_label("${escapeForPython(inputNameClean)}")`);
        }
        
        // Determine the value to use (runtime or static)
        const valueExpr = isRuntimeRandom ? '_runtime_value' : `"${escapedInputValue}"`;
        const valuePreview = isRuntimeRandom ? '{_runtime_value}' : (escapedInputValue.slice(0, 20) + (inputValue.length > 20 ? '...' : ''));
        
        // SALESFORCE: Detect App Launcher search and use dedicated helper
        const isAppLauncherSearch = inputNameLower.includes('search apps') || inputNameLower.includes('app launcher') || 
                                    inputNameLower.includes('search items');
        
        if (isAppLauncherSearch) {
          // Use the Salesforce helper's robust App Launcher search
          code += `${indent}# SALESFORCE: Use dedicated App Launcher search (robust with fallbacks)\n`;
          code += `${indent}sf.search_app_launcher("${escapedInputValue}")\n`;
          code += `${indent}print(f"   [+] Filled App Launcher search with: ${valuePreview}")\n`;
          break; // Skip the normal input handling - sf helper handles everything
        }
        
        // For other modal inputs, wait for modal first
        const isModalInput = inputNameLower.includes('modal') || inputNameLower.includes('dialog') || inputNameLower.includes('popup');
        
        if (isModalInput) {
          code += `${indent}# SALESFORCE: Wait for modal/popup to be fully rendered before searching for input\n`;
          code += `${indent}sf.wait_for_ready()\n`;
        }
        
        code += `${indent}# Fill input with fallback selectors (same logic as Suggest)\n`;
        // Escape quotes in step name for Python f-string AND remove non-ASCII chars (Windows cp1252 compatibility)
        const inputNameForPython = inputNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/[^\x00-\x7F]/g, '');
        code += `${indent}print(f"[FIND] Looking for input: ${inputNameForPython}")\n`;
        code += `${indent}_input_selectors = [\n`;
        uniqueInputSelectors.forEach((sel, i) => {
          // Escape selector string properly for Python
          const safeSel = sel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          code += `${indent}    ("${safeSel}", ${i + 1}),\n`;
        });
        code += `${indent}]\n`;
        code += `${indent}_input_found = False\n`;
        if (isRuntimeRandom) {
          code += `${indent}_fill_value = _runtime_value  # Runtime generated\n`;
        } else {
          code += `${indent}_fill_value = "${escapedInputValue}"\n`;
        }
        // ROBUST: Try with progressive waits - elements may not be visible immediately (modals, dynamic content)
        code += `${indent}_max_retries = 3\n`;
        code += `${indent}_retry_delays = [0, 1500, 3000]  # Progressive wait times\n`;
        code += `${indent}for _retry in range(_max_retries):\n`;
        code += `${indent}    if _retry > 0:\n`;
        code += `${indent}        print(f"   [RETRY {_retry}] Waiting {_retry_delays[_retry]}ms for element to appear...")\n`;
        code += `${indent}        page.wait_for_timeout(_retry_delays[_retry])\n`;
        code += `${indent}    for _selector_str, _priority in _input_selectors:\n`;
        code += `${indent}        try:\n`;
        code += `${indent}            _el = eval(_selector_str)\n`;
        code += `${indent}            _count = _el.count()\n`;
        code += `${indent}            if _count > 0:\n`;
        code += `${indent}                # ROBUST: Wait for element to be VISIBLE before interacting\n`;
        code += `${indent}                try:\n`;
        code += `${indent}                    _el.first.wait_for(state="visible", timeout=5000)\n`;
        code += `${indent}                except:\n`;
        code += `${indent}                    pass  # Continue even if wait times out - element might still work\n`;
        code += `${indent}                print(f"   [+] Found {_count} input(s) with selector #{_priority}")\n`;
        code += `${indent}                # SALESFORCE FIX: Scroll into view, then click to focus, then fill\n`;
        code += `${indent}                _target_el = _el.first if _count == 1 else None\n`;
        code += `${indent}                if _count > 1:\n`;
        code += `${indent}                    print(f"   [WARN] Multiple matches, using first visible")\n`;
        code += `${indent}                    for i in range(_count):\n`;
        code += `${indent}                        try:\n`;
        code += `${indent}                            if _el.nth(i).is_visible():\n`;
        code += `${indent}                                _target_el = _el.nth(i)\n`;
        code += `${indent}                                break\n`;
        code += `${indent}                        except:\n`;
        code += `${indent}                            continue\n`;
        code += `${indent}                    if _target_el is None:\n`;
        code += `${indent}                        _target_el = _el.first\n`;
        code += `${indent}                # Scroll element into view before interacting\n`;
        code += `${indent}                try:\n`;
        code += `${indent}                    _target_el.scroll_into_view_if_needed()\n`;
        code += `${indent}                except:\n`;
        code += `${indent}                    pass\n`;
        code += `${indent}                # Try multiple fill strategies for Salesforce custom components\n`;
        code += `${indent}                _fill_success = False\n`;
        code += `${indent}                # Strategy 1: Click to focus, then fill with short timeout\n`;
        code += `${indent}                try:\n`;
        code += `${indent}                    _target_el.click(timeout=3000)\n`;
        code += `${indent}                    page.wait_for_timeout(300)\n`;
        code += `${indent}                    _target_el.fill(_fill_value, timeout=5000)\n`;
        code += `${indent}                    _fill_success = True\n`;
        code += `${indent}                except:\n`;
        code += `${indent}                    pass\n`;
        code += `${indent}                # Strategy 2: Use type() for custom Salesforce inputs\n`;
        code += `${indent}                if not _fill_success:\n`;
        code += `${indent}                    try:\n`;
        code += `${indent}                        _target_el.click(timeout=3000)\n`;
        code += `${indent}                        page.wait_for_timeout(300)\n`;
        code += `${indent}                        _target_el.type(_fill_value, delay=50)\n`;
        code += `${indent}                        _fill_success = True\n`;
        code += `${indent}                    except:\n`;
        code += `${indent}                        pass\n`;
        code += `${indent}                # Strategy 3: Use keyboard directly\n`;
        code += `${indent}                if not _fill_success:\n`;
        code += `${indent}                    try:\n`;
        code += `${indent}                        _target_el.click(timeout=3000)\n`;
        code += `${indent}                        page.keyboard.type(_fill_value)\n`;
        code += `${indent}                        _fill_success = True\n`;
        code += `${indent}                    except Exception as _ke:\n`;
        code += `${indent}                        print(f"   Selector #{_priority} failed: {str(_ke)[:50]}")\n`;
        code += `${indent}                        continue\n`;
        code += `${indent}                if _fill_success:\n`;
        code += `${indent}                    _input_found = True\n`;
        code += `${indent}                    print(f"   [+] Filled with: {_fill_value[:30] if len(str(_fill_value)) > 30 else _fill_value}")\n`;
        code += `${indent}                break\n`;
        code += `${indent}        except Exception as _e:\n`;
        code += `${indent}            print(f"   Selector #{_priority} failed: {str(_e)[:50]}")\n`;
        code += `${indent}            continue\n`;
        code += `${indent}    if _input_found:\n`;
        code += `${indent}        break\n`;
        code += `${indent}if not _input_found:\n`;
        code += `${indent}    print("[FAIL] Input not found with any selector after retries")\n`;
        code += `${indent}    raise Exception("Input failed: No elements found matching any selector")\n`;
        
        // SALESFORCE: If this is a search/lookup field, wait for and click on search results
        const isSearchField = inputNameLower.includes('search') || inputNameLower.includes('lookup') || 
                              inputNameLower.includes('find') || inputNameLower.includes('filter');
        const isGlobalSearch = inputNameLower.includes('search salesforce') || inputNameLower.includes('search...');
        
        if (isSearchField && !isAppLauncherSearch) {
          code += `${indent}# SALESFORCE: Wait for search results and click on matching result\n`;
          code += `${indent}page.wait_for_timeout(1500)  # Wait for search results to appear\n`;
          code += `${indent}try:\n`;
          code += `${indent}    # Try to find and click the search result matching our input\n`;
          code += `${indent}    _search_result_selectors = [\n`;
          code += `${indent}        f'li[role="option"]:has-text("{_fill_value}")',\n`;
          code += `${indent}        f'lightning-base-combobox-item:has-text("{_fill_value}")',\n`;
          code += `${indent}        f'.slds-listbox__item:has-text("{_fill_value}")',\n`;
          code += `${indent}        f'[role="option"]:has-text("{_fill_value}")',\n`;
          code += `${indent}        f'a:has-text("{_fill_value}")',\n`;
          code += `${indent}    ]\n`;
          code += `${indent}    _result_clicked = False\n`;
          code += `${indent}    for _result_sel in _search_result_selectors:\n`;
          code += `${indent}        try:\n`;
          code += `${indent}            _result = page.locator(_result_sel).first\n`;
          code += `${indent}            if _result.is_visible(timeout=2000):\n`;
          code += `${indent}                _result.click()\n`;
          code += `${indent}                print(f"   [+] Clicked search result: {_fill_value}")\n`;
          code += `${indent}                _result_clicked = True\n`;
          code += `${indent}                break\n`;
          code += `${indent}        except:\n`;
          code += `${indent}            continue\n`;
          code += `${indent}    if not _result_clicked:\n`;
          code += `${indent}        print(f"   [INFO] No search result dropdown found - may need Enter key")\n`;
          code += `${indent}except:\n`;
          code += `${indent}    pass  # Search results clicking is optional\n`;
        }
        break;
      }
      case 'select':
        code += `${indent}page.${convertSelector(step.selector || '')}.select_option("${step.value || ''}")\n`;
        break;
      case 'hover': {
        // HOVERS ARE NON-CRITICAL - Skip them entirely or do quick try
        // Hovers are usually incidental mouse movements during recording, not actual test actions
        const hoverStepNameClean = step.name.replace(/^\[Precond\]\s*/i, '').replace(/^Hover:\s*/i, '').replace(/^Click:\s*/i, '').trim();
        const hoverStepNameForPython = hoverStepNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/[^\x00-\x7F]/g, '');
        
        code += `${indent}# HOVER: Non-critical action - quick try and skip if not found\n`;
        code += `${indent}# Hovers are incidental mouse movements - they shouldn't fail tests\n`;
        code += `${indent}try:\n`;
        
        // Build ONE simple selector
        let hoverSelector = '';
        if (step.selectorObj?.playwright) {
          hoverSelector = `page.${step.selectorObj.playwright}`;
        } else if (step.selector && typeof step.selector === 'string') {
          hoverSelector = `page.${convertSelector(step.selector)}`;
        } else {
          hoverSelector = `page.get_by_text("${escapeForPython(hoverStepNameClean)}")`;
        }
        
        const safeHoverSel = hoverSelector.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        code += `${indent}    _hover_el = ${hoverSelector}\n`;
        code += `${indent}    if _hover_el.count() > 0:\n`;
        code += `${indent}        _hover_el.first.hover(timeout=2000)\n`;
        code += `${indent}        print(f"[HOVER] ${hoverStepNameForPython} - done")\n`;
        code += `${indent}    else:\n`;
        code += `${indent}        print(f"[SKIP] Hover '${hoverStepNameForPython}' - element not found, continuing...")\n`;
        code += `${indent}except:\n`;
        code += `${indent}    print(f"[SKIP] Hover '${hoverStepNameForPython}' - skipped (non-critical)")\n`;
        break;
      }
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
      
      // ========== BLACK-BOX TESTING STEPS ==========
      
      // Date & Time
      case 'date_relative': {
        const days = (step as any).daysOffset || 1;
        const format = (step as any).dateFormat || 'MM/DD/YYYY';
        const varName = (step as any).storeAs || 'generated_date';
        code += `${indent}# Generate relative date (${days} days from today)\n`;
        code += `${indent}_generated_date = generate_relative_date(${days}, "${format}")\n`;
        code += `${indent}store_variable("${varName}", _generated_date)\n`;
        code += `${indent}print(f"📅 Generated date: {_generated_date}")\n`;
        break;
      }
      
      case 'date_verify_future': {
        const sel = step.selector ? `page.${convertSelector(step.selector)}.inner_text()` : `"${(step as any).dateValue || ''}"`;
        code += `${indent}# Verify date is in the future\n`;
        code += `${indent}_date_text = ${sel}\n`;
        code += `${indent}verify_date_is_future(_date_text)\n`;
        code += `${indent}print(f"[+] Date '{_date_text}' is in the future")\n`;
        break;
      }
      
      case 'date_verify_sequence': {
        const startSel = (step as any).startDateSelector;
        const endSel = (step as any).endDateSelector;
        code += `${indent}# Verify end date is after start date\n`;
        code += `${indent}_start_date = page.${convertSelector(startSel || '')}.inner_text()\n`;
        code += `${indent}_end_date = page.${convertSelector(endSel || '')}.inner_text()\n`;
        code += `${indent}verify_date_sequence(_start_date, _end_date)\n`;
        code += `${indent}print(f"[+] Date sequence valid: {_start_date} -> {_end_date}")\n`;
        break;
      }
      
      // Math & Calculations
      case 'math_verify_multiply': {
        const f1 = (step as any).factor1Selector;
        const f2 = (step as any).factor2Selector;
        const res = (step as any).resultSelector;
        code += `${indent}# Verify multiplication: factor1 × factor2 = result\n`;
        code += `${indent}_factor1 = page.${convertSelector(f1 || '')}.inner_text()\n`;
        code += `${indent}_factor2 = page.${convertSelector(f2 || '')}.inner_text()\n`;
        code += `${indent}_result = page.${convertSelector(res || '')}.inner_text()\n`;
        code += `${indent}verify_multiplication(_factor1, _factor2, _result)\n`;
        code += `${indent}print(f"[+] Multiplication verified: {_factor1} x {_factor2} = {_result}")\n`;
        break;
      }
      
      case 'math_verify_sum': {
        const listSel = (step as any).listSelector;
        const totalSel = (step as any).totalSelector;
        code += `${indent}# Verify sum of list equals total\n`;
        code += `${indent}_items = page.${convertSelector(listSel || '')}.all_inner_texts()\n`;
        code += `${indent}_total = page.${convertSelector(totalSel || '')}.inner_text()\n`;
        code += `${indent}verify_sum(_items, _total)\n`;
        code += `${indent}print(f"[+] Sum verified: {len(_items)} items = {_total}")\n`;
        break;
      }
      
      case 'math_verify_discount': {
        const origSel = (step as any).originalPriceSelector;
        const disc = (step as any).discountPercent || 10;
        const finalSel = (step as any).finalPriceSelector;
        code += `${indent}# Verify ${disc}% discount applied correctly\n`;
        code += `${indent}_original = page.${convertSelector(origSel || '')}.inner_text()\n`;
        code += `${indent}_final = page.${convertSelector(finalSel || '')}.inner_text()\n`;
        code += `${indent}verify_percentage_discount(_original, ${disc}, _final)\n`;
        code += `${indent}print(f"[+] Discount verified: {_original} - ${disc}% = {_final}")\n`;
        break;
      }
      
      // Format Validation
      case 'format_verify': {
        const fmtSel = step.selector;
        const fmtType = (step as any).formatType || 'email';
        const customRegex = (step as any).customRegex || '';
        code += `${indent}# Verify text format: ${fmtType}\n`;
        code += `${indent}_text = page.${convertSelector(fmtSel || '')}.input_value() or page.${convertSelector(fmtSel || '')}.inner_text()\n`;
        if (fmtType === 'custom' && customRegex) {
          code += `${indent}verify_text_format(_text, "custom", r"${customRegex}")\n`;
        } else {
          code += `${indent}verify_text_format(_text, "${fmtType}")\n`;
        }
        code += `${indent}print(f"[+] Format verified: '{_text}' matches ${fmtType}")\n`;
        break;
      }
      
      case 'random_string': {
        const len = (step as any).length || 10;
        const strType = (step as any).stringType || 'alphanumeric';
        const varName = (step as any).storeAs || 'random_value';
        code += `${indent}# Generate random ${strType} string\n`;
        code += `${indent}_random = generate_random_string(${len}, "${strType}")\n`;
        code += `${indent}store_variable("${varName}", _random)\n`;
        code += `${indent}print(f"🎲 Generated random string: {_random}")\n`;
        break;
      }
      
      // Cross-field & Boundary
      case 'field_visibility': {
        const trigSel = (step as any).triggerSelector;
        const trigVal = (step as any).triggerValue || '';
        const targetSel = (step as any).targetSelector;
        const shouldShow = (step as any).shouldBeVisible !== false;
        code += `${indent}# Verify field visibility changes based on selection\n`;
        if (trigVal) {
          code += `${indent}page.${convertSelector(trigSel || '')}.select_option(label="${trigVal}")\n`;
        } else {
          code += `${indent}page.${convertSelector(trigSel || '')}.click()\n`;
        }
        code += `${indent}page.wait_for_timeout(500)\n`;
        if (shouldShow) {
          code += `${indent}expect(page.${convertSelector(targetSel || '')}).to_be_visible()\n`;
          code += `${indent}print(f"[+] Target field is visible after trigger")\n`;
        } else {
          code += `${indent}expect(page.${convertSelector(targetSel || '')}).to_be_hidden()\n`;
          code += `${indent}print(f"[+] Target field is hidden after trigger")\n`;
        }
        break;
      }
      
      case 'boundary_test': {
        const inputSel = (step as any).inputSelector;
        const minVal = (step as any).minValue ?? 0;
        const maxVal = (step as any).maxValue ?? 100;
        const submitSel = (step as any).submitSelector || '';
        const errorSel = (step as any).errorSelector || '';
        code += `${indent}# Boundary value analysis test (min=${minVal}, max=${maxVal})\n`;
        code += `${indent}_boundary_results = run_boundary_test(\n`;
        code += `${indent}    page,\n`;
        code += `${indent}    "${inputSel || ''}",\n`;
        code += `${indent}    ${minVal},\n`;
        code += `${indent}    ${maxVal},\n`;
        if (submitSel) code += `${indent}    submit_selector="${submitSel}",\n`;
        if (errorSel) code += `${indent}    error_selector="${errorSel}"\n`;
        code += `${indent})\n`;
        code += `${indent}# Check all boundary tests passed\n`;
        code += `${indent}_all_passed = all(r.get("test_passed", False) for r in _boundary_results.values())\n`;
        code += `${indent}for name, result in _boundary_results.items():\n`;
        code += `${indent}    status = "PASS" if result.get("test_passed") else "FAIL"\n`;
        code += `${indent}    print(f"  {status} {name}: value={result.get('value')}")\n`;
        code += `${indent}assert _all_passed, f"Boundary tests failed: {_boundary_results}"\n`;
        break;
      }
      
      default:
        code += `${indent}pass  # Unknown step type: ${step.type}\n`;
    }
    
    // Add assertion code if defined
    if (step.assertion?.enabled && step.assertion?.type) {
      code += generateAssertionCode(step.assertion, step, index, indent);
    }

    code += `                test_results["steps_passed"] += 1
                print(f"[+] Step ${index + 1}: ${step.name.replace(/"/g, '\\"').replace(/[^\x00-\x7F]/g, '')}")
            except Exception as step_error:
                test_results["status"] = "failed"
                test_results["steps_failed"] += 1
                test_results["failed_step"] = ${index + 1}
                test_results["error_message"] = str(step_error)
                
                # Take screenshot on failure
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                screenshot_path = f"failure_step_${index + 1}_${safeName}_{timestamp}.png"
                try:
                    page.screenshot(path=screenshot_path, full_page=True)
                    test_results["screenshot_path"] = screenshot_path
                    print(f"[SCREENSHOT] Saved: {screenshot_path}")
                except:
                    pass
                
                print(f"[X] Step ${index + 1} FAILED: ${step.name.replace(/"/g, '\\"').replace(/[^\x00-\x7F]/g, '')}")
                print(f"  Error: {step_error}")
                
                # Keep browser open for 5 seconds so user can see the failure
                print("[WAIT] Keeping browser open for 5 seconds...")
                page.wait_for_timeout(5000)
                raise step_error
`;
  });

  code += `
            print("\\n" + "="*50)
            print("[PASS] TEST PASSED - All steps completed successfully")
            print("="*50)
            
        except Exception as e:
            print("\\n" + "="*50)
            print(f"[FAIL] TEST FAILED at step {test_results['failed_step']}")
            print(f"Error: {test_results['error_message']}")
            if test_results['screenshot_path']:
                print(f"Screenshot: {test_results['screenshot_path']}")
            print("="*50)
            sys.exit(1)  # Exit with error code
            
        finally:
            context.close()

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
  if ((step.type === 'input' || step.type === 'fill') && step.selector) return `    await page.locator('${step.selector}').fill('${step.value || ''}');`;
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
    // Actions (click, input, fill, select) are When
    else if (['click', 'input', 'fill', 'select', 'hover'].includes(step.type) && !hasWhen) {
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
    else if (hasWhen && ['click', 'input', 'fill', 'select', 'hover'].includes(step.type)) {
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

// Helper function to escape text for Python strings (handles newlines, quotes, special chars)
function escapeForPython(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')     // Escape backslashes first
    .replace(/"/g, '\\"')       // Escape double quotes
    .replace(/\n/g, '\\n')      // Escape newlines
    .replace(/\r/g, '\\r')      // Escape carriage returns
    .replace(/\t/g, '\\t')      // Escape tabs
    .slice(0, 100);             // Limit length to avoid huge selectors
}









