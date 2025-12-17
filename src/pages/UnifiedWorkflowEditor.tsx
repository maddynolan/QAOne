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
  BookOpen, Share2, Upload, ExternalLink,
  Calendar, Calculator, Shuffle, AlertTriangle,
  Mail, Phone, Hash, User, ShieldCheck, Lightbulb,
  Building2, Plane, GraduationCap, Heart, Utensils,
  Home, Briefcase, Gamepad2, BarChart3,
  Activity, FileJson, Link2, Key, Timer
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
import { SmartFillDialog } from '@/components/SmartFillDialog';
import { 
  DOMAINS, CATEGORIES, DomainType, ValidationTemplate,
  getValidationsByDomain, getSuggestionsForField, calculateCoverage,
  groupValidations, getPriorityColor, validationToAssertion
} from '@/lib/qa-validation-templates';

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

// Simplified & compact step categories
const STEP_CATEGORIES = {
  // VERIFY - Most important
  verify: {
    label: '✅ Verify',
    compact: true,
    steps: [
      { type: 'assert', label: 'Element', icon: Eye, color: 'bg-green-500' },
      { type: 'assert_text', label: 'Text', icon: Type, color: 'bg-green-500' },
      { type: 'screenshot', label: 'Screenshot', icon: Camera, color: 'bg-violet-500' },
    ]
  },
  // TIMING
  wait: {
    label: '⏱️ Wait',
    compact: true,
    steps: [
      { type: 'wait', label: 'Time', icon: Clock, color: 'bg-amber-500' },
      { type: 'wait_for_element', label: 'Element', icon: Eye, color: 'bg-amber-500' },
    ]
  },
  // BACKEND
  api: {
    label: '🔌 API/DB',
    compact: true,
    steps: [
      { type: 'api', label: 'API', icon: Globe, color: 'bg-blue-600' },
      { type: 'db_query', label: 'Database', icon: Database, color: 'bg-orange-500' },
    ]
  },
  // LOGIC
  logic: {
    label: '🔀 Logic',
    compact: true,
    steps: [
      { type: 'condition', label: 'If/Then', icon: Share2, color: 'bg-purple-500' },
      { type: 'loop', label: 'Loop', icon: RefreshCw, color: 'bg-purple-500' },
      { type: 'module', label: 'Module', icon: Package, color: 'bg-purple-500' },
    ]
  },
  // UI ACTIONS - Collapsed
  ui: {
    label: 'UI (Manual)',
    collapsed: true,
    steps: [
      { type: 'navigate', label: 'Navigate', icon: Navigation, color: 'bg-slate-400' },
      { type: 'click', label: 'Click', icon: MousePointer, color: 'bg-slate-400' },
      { type: 'input', label: 'Input', icon: Type, color: 'bg-slate-400' },
      { type: 'select', label: 'Select', icon: ChevronDown, color: 'bg-slate-400' },
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
const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

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

  // QA Validation Coverage
  const [showDomainSelector, setShowDomainSelector] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainType>(testCase.domain || 'general');
  const [coveredValidations, setCoveredValidations] = useState<string[]>(testCase.coveredValidations || []);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'validations'>('details');
  const [rightPanelMode, setRightPanelMode] = useState<'step' | 'protocol'>('step');
  
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
      // Load from localStorage (recording import)
      const saved = localStorage.getItem('unified_test_case');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('[Builder] Loading from localStorage:', parsed.steps?.length, 'steps');
          
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
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      }
    }
  }, [searchParams]);
  
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
      
      // Try backend if not found locally
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

  // Auto-load test case from URL parameter
  useEffect(() => {
    if (testCaseIdFromUrl) {
      loadTestCaseById(testCaseIdFromUrl);
    }
  }, [testCaseIdFromUrl, loadTestCaseById]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('unified_test_case', JSON.stringify(testCase));
  }, [testCase]);

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

  // Clean step name - remove redundant type prefixes (e.g., "Click: Click" -> "Click")
  const cleanStepName = (name: string, type?: string): string => {
    if (!name) return name;
    
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
    
    let cleaned = name;
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
        name: 'Check: Text Contains',
        expectedResult: 'Text should contain expected value'
      },
      assert_url: {
        name: 'Check: URL',
        expectedResult: 'URL should match'
      },
      screenshot: {
        name: 'Take Screenshot',
        expectedResult: 'Screenshot captured'
      },
      api: {
        name: 'API: [endpoint]',
        method: 'GET',
        expectedResult: 'API call should succeed'
      },
      db_query: {
        name: 'Query: [table]',
        dbType: 'postgres',
        expectedResult: 'Query should return results'
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
      
      // Create merged test case for code generation
      const mergedTestCase: UnifiedTestCase = {
        ...testCase,
        steps: allSteps,
        preconditions: [], // Clear preconditions since we're inlining them
      };
      
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
  const generateAllTestData = (forceRegenerate = false) => {
    let count = 0;
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.type === 'input' && (forceRegenerate || !step.value)) {
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    title="Generate test data for all input fields"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Fill Data
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => generateAllTestData(false)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Fill Empty Fields Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generateAllTestData(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate All Fields
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Accessibility Scan - Dropdown with URL input option */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" title="Accessibility Scanner (WCAG)">
                    ♿ A11y
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>♿ Accessibility Scanner</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* Scan from test case URL */}
                  <DropdownMenuItem 
                    onClick={() => {
                      const navigateStep = testCase.steps.find(s => s.type === 'navigate' && s.url);
                      const urlToScan = navigateStep?.url || testCase.settings.baseUrl;
                      
                      if (!urlToScan) {
                        toast.error('No URL in test case. Use "Scan Any URL" instead.');
                        return;
                      }
                      
                      toast.info(`Scanning ${urlToScan}...`);
                      fetch('http://localhost:8000/api/a11y/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: urlToScan, wcag_level: 'AA' })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.scan_id) {
                          window.open(`http://localhost:8000/api/a11y/report/${data.scan_id}?format=html`, '_blank');
                          toast.success(`Found ${data.summary.total_violations} issues`);
                        } else {
                          toast.error(data.detail || 'Scan failed');
                        }
                      })
                      .catch(() => toast.error('Backend not running'));
                    }}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Scan Test Case URL
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Scan any URL - with input */}
                  <div className="px-2 py-2">
                    <p className="text-xs text-muted-foreground mb-2">Scan Any Website:</p>
                    <div className="flex gap-2">
                      <input 
                        type="url"
                        placeholder="https://example.com"
                        className="flex-1 px-2 py-1 text-sm border rounded"
                        id="a11y-url-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.target as HTMLInputElement;
                            const url = input.value.trim();
                            if (!url) return;
                            
                            toast.info(`Scanning ${url}...`);
                            fetch('http://localhost:8000/api/a11y/scan', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url, wcag_level: 'AA' })
                            })
                            .then(res => res.json())
                            .then(data => {
                              if (data.scan_id) {
                                window.open(`http://localhost:8000/api/a11y/report/${data.scan_id}?format=html`, '_blank');
                                toast.success(`Found ${data.summary.total_violations} issues`);
                              } else {
                                toast.error(data.detail || 'Scan failed');
                              }
                            })
                            .catch(() => toast.error('Backend not running'));
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          const input = document.getElementById('a11y-url-input') as HTMLInputElement;
                          const url = input?.value.trim();
                          if (!url) {
                            toast.error('Enter a URL first');
                            return;
                          }
                          
                          toast.info(`Scanning ${url}...`);
                          fetch('http://localhost:8000/api/a11y/scan', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url, wcag_level: 'AA' })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.scan_id) {
                              window.open(`http://localhost:8000/api/a11y/report/${data.scan_id}?format=html`, '_blank');
                              toast.success(`Found ${data.summary.total_violations} issues`);
                            } else {
                              toast.error(data.detail || 'Scan failed');
                            }
                          })
                          .catch(() => toast.error('Backend not running'));
                        }}
                      >
                        Scan
                      </Button>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => window.open('http://localhost:8000/docs#/accessibility-v2', '_blank')}
                    className="text-xs text-muted-foreground"
                  >
                    📚 API Documentation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
          {/* Left Panel: Compact & Focused */}
          <aside className="w-48 flex-none border-r bg-card overflow-y-auto">
            <div className="p-2 space-y-2">
              {/* Domain & Coverage Section */}
              <div className="p-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-violet-700 dark:text-violet-300">DOMAIN</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-1 text-[10px]"
                    onClick={() => setShowDomainSelector(true)}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
                <button 
                  className="w-full text-left text-xs font-medium flex items-center gap-1 hover:text-violet-600"
                  onClick={() => setShowDomainSelector(true)}
                >
                  <span>{DOMAINS[selectedDomain]?.icon}</span>
                  <span className="truncate">{DOMAINS[selectedDomain]?.label || 'Select Domain'}</span>
                </button>
                
                {/* Coverage Meter */}
                {(() => {
                  const coverage = calculateCoverage(coveredValidations, selectedDomain);
                  return (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Coverage</span>
                        <span className={`font-medium ${
                          coverage.percentage >= 80 ? 'text-green-600' :
                          coverage.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {coverage.percentage}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            coverage.percentage >= 80 ? 'bg-green-500' :
                            coverage.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${coverage.percentage}%` }}
                        />
                      </div>
                      {coverage.missingHigh.length > 0 && (
                        <button
                          className="mt-1 text-[9px] text-red-600 hover:underline flex items-center gap-0.5"
                          onClick={() => setShowValidationPanel(true)}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {coverage.missingHigh.length} high priority gaps
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[10px] px-2"
                  onClick={() => setShowModules(true)}
                >
                  <Package className="h-3 w-3 mr-1" />
                  Modules
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[10px] px-2"
                  onClick={() => window.open('/flowstral', '_blank')}
                >
                  <Video className="h-3 w-3 mr-1" />
                  Record
                </Button>
              </div>

              {/* Compact Step Categories */}
              <div className="space-y-1">
                <p className="text-[9px] text-muted-foreground text-center py-1">ADD STEPS</p>
                
                {Object.entries(STEP_CATEGORIES).map(([key, category]) => {
                  const cat = category as any;
                  const isCompact = cat.compact;
                  const isCollapsedByDefault = cat.collapsed;
                  const isOpen = isCollapsedByDefault 
                    ? expandedCategories.includes(key)
                    : !expandedCategories.includes(`${key}_closed`);
                  
                  // Compact mode: show all steps inline
                  if (isCompact) {
                    return (
                      <div key={key} className="space-y-0.5">
                        <p className="text-[10px] font-medium text-muted-foreground px-1">{category.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {category.steps.map((step) => (
                            <Button
                              key={step.type}
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => addStep(step.type as StepType)}
                              title={step.label}
                            >
                              <div className={`p-0.5 rounded mr-1 ${step.color} text-white`}>
                                <step.icon className="h-2.5 w-2.5" />
                              </div>
                              {step.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Collapsible mode for less common steps
                  return (
                    <Collapsible
                      key={key}
                      open={isOpen}
                      onOpenChange={(open) => {
                        if (isCollapsedByDefault) {
                          setExpandedCategories(prev =>
                            open ? [...prev, key] : prev.filter(k => k !== key)
                          );
                        } else {
                          setExpandedCategories(prev =>
                            open ? prev.filter(k => k !== `${key}_closed`) : [...prev, `${key}_closed`]
                          );
                        }
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full justify-between h-6 text-[10px] text-muted-foreground"
                        >
                          <span>{category.label}</span>
                          <ChevronRight className={`h-2.5 w-2.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="flex flex-wrap gap-1 mt-1 pl-1">
                        {category.steps.map((step) => (
                          <Button
                            key={step.type}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => addStep(step.type as StepType)}
                          >
                            <div className={`p-0.5 rounded mr-1 ${step.color} text-white`}>
                              <step.icon className="h-2.5 w-2.5" />
                            </div>
                            {step.label}
                          </Button>
                        ))}
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

          {/* Right Panel: Step Editor OR Protocol Panel */}
          {viewMode === 'no-code' && (selectedStep || protocolData || rightPanelMode === 'protocol') && (
            <aside className="w-80 flex-none border-l bg-card overflow-hidden flex flex-col">
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
                              className="p-2 bg-white dark:bg-gray-900 rounded text-xs cursor-pointer hover:ring-2 ring-red-300"
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
            <h3 className="font-semibold text-sm">Edit Step</h3>
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

      {['click', 'input', 'select', 'hover', 'assert'].includes(step.type) && (
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
            <Input
              value={step.value || ''}
              onChange={(e) => onUpdate({ value: e.target.value })}
              placeholder="Text to enter"
            />
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
                page.locator(submit_selector).click()
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
    print(f"📦 Stored variable '{name}' = {value}")
    return value

def get_variable(name, default=None):
    """Retrieve a stored variable"""
    return _variables.get(name, default)

def test_${safeName}():
    """${tc.description || tc.name}"""
    global test_results
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_default_timeout(30000)  # 30 second timeout
        
        try:
`;

  // Add initial navigation if baseUrl is set and first step is not navigate
  if (baseUrl && !hasNavigateFirst) {
    code += `
            # Initial Navigation (from Base URL)
            print("🌐 Navigating to base URL: ${baseUrl}")
            page.goto("${baseUrl}")
            page.wait_for_load_state("domcontentloaded")
            print("✅ Page loaded successfully")
`;
  } else if (!hasNavigateFirst && !baseUrl) {
    // No navigate step and no baseUrl - add a warning
    code += `
            # ⚠️ WARNING: No initial URL specified!
            # Please add a Navigate step or set Base URL in test settings
            print("⚠️ WARNING: No initial URL - browser will open to blank page")
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
        // Generate selectors with fallbacks - SAME LOGIC AS SUGGEST FEATURE
        const stepNameClean = step.name.replace(/^\[Precond\]\s*/i, '').replace(/^Click:\s*/i, '').trim();
        const elementIndex = (step as any).elementIndex;
        
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
        // 4. Text from selectorObj
        if (step.selectorObj?.text) {
          selectorsToTry.push(`page.get_by_text("${step.selectorObj.text.replace(/"/g, '\\"')}", exact=True)`);
          selectorsToTry.push(`page.get_by_text("${step.selectorObj.text.replace(/"/g, '\\"')}")`);
        }
        // 5. Target-based selector
        if (step.target && step.target.trim()) {
          selectorsToTry.push(`page.get_by_text("${step.target.replace(/"/g, '\\"')}", exact=True)`);
        }
        // 6. Step name-based selector  
        if (stepNameClean) {
          selectorsToTry.push(`page.get_by_text("${stepNameClean.replace(/"/g, '\\"')}")`);
          selectorsToTry.push(`page.get_by_role("button", name="${stepNameClean.replace(/"/g, '\\"')}")`);
          selectorsToTry.push(`page.get_by_role("link", name="${stepNameClean.replace(/"/g, '\\"')}")`);
        }
        
        // Deduplicate selectors and ensure at least one exists
        const uniqueSelectors = [...new Set(selectorsToTry)].filter(s => s && s.length > 0);
        
        // Fallback: if no selectors found, use step name as text selector
        if (uniqueSelectors.length === 0 && stepNameClean) {
          uniqueSelectors.push(`page.get_by_text("${stepNameClean.replace(/"/g, '\\"')}")`);
        }
        
        code += `${indent}# Click element with fallback selectors (same logic as Suggest)\n`;
        // Escape quotes in step name for Python f-string
        const stepNameForPython = stepNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'");
        code += `${indent}print(f"🔍 Looking for: ${stepNameForPython}")\n`;
        code += `${indent}_selectors_to_try = [\n`;
        uniqueSelectors.forEach((sel, i) => {
          // Escape selector string properly for Python
          const safeSel = sel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          code += `${indent}    ("${safeSel}", ${i + 1}),\n`;
        });
        code += `${indent}]\n`;
        code += `${indent}_element_found = False\n`;
        code += `${indent}for _selector_str, _priority in _selectors_to_try:\n`;
        code += `${indent}    try:\n`;
        code += `${indent}        _el = eval(_selector_str)\n`;
        code += `${indent}        _count = _el.count()\n`;
        code += `${indent}        if _count > 0:\n`;
        code += `${indent}            print(f"   ✓ Found {_count} element(s) with selector #{_priority}")\n`;
        if (elementIndex !== undefined && elementIndex !== null) {
          code += `${indent}            _el.nth(${elementIndex}).click()\n`;
        } else {
          code += `${indent}            if _count > 1:\n`;
          code += `${indent}                print(f"   ⚠️ Multiple matches, clicking first visible")\n`;
          code += `${indent}                for i in range(_count):\n`;
          code += `${indent}                    try:\n`;
          code += `${indent}                        if _el.nth(i).is_visible():\n`;
          code += `${indent}                            _el.nth(i).click()\n`;
          code += `${indent}                            break\n`;
          code += `${indent}                    except:\n`;
          code += `${indent}                        continue\n`;
          code += `${indent}                else:\n`;
          code += `${indent}                    _el.first.click()\n`;
          code += `${indent}            else:\n`;
          code += `${indent}                _el.click()\n`;
        }
        code += `${indent}            _element_found = True\n`;
        code += `${indent}            break\n`;
        code += `${indent}    except Exception as _e:\n`;
        code += `${indent}        print(f"   Selector #{_priority} failed: {str(_e)[:50]}")\n`;
        code += `${indent}        continue\n`;
        code += `${indent}if not _element_found:\n`;
        code += `${indent}    # Wait and retry with primary selector\n`;
        code += `${indent}    print("   Waiting for element to appear...")\n`;
        code += `${indent}    page.wait_for_timeout(2000)\n`;
        code += `${indent}    for _selector_str, _priority in _selectors_to_try[:3]:  # Retry top 3\n`;
        code += `${indent}        try:\n`;
        code += `${indent}            _el = eval(_selector_str)\n`;
        code += `${indent}            if _el.count() > 0:\n`;
        code += `${indent}                _el.first.click()\n`;
        code += `${indent}                _element_found = True\n`;
        code += `${indent}                print(f"   ✓ Found after wait with selector #{_priority}")\n`;
        code += `${indent}                break\n`;
        code += `${indent}        except:\n`;
        code += `${indent}            continue\n`;
        code += `${indent}if not _element_found:\n`;
        code += `${indent}    print("❌ Element not found with any selector")\n`;
        code += `${indent}    raise Exception("Click failed: No elements found matching any selector")\n`;
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
            code += `${indent}print(f"   💾 Stored as '${storeAsVar}': {_runtime_value}")\n`;
          }
        }
        
        // Build list of selectors to try (same order as Suggest)
        const inputSelectorsToTry: string[] = [];
        
        // 1. Primary selector from selectorObj (same as Suggest)
        if (step.selectorObj?.playwright) {
          inputSelectorsToTry.push(`page.${step.selectorObj.playwright}`);
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
        // 4. Label-based selectors
        if (step.selectorObj?.text || step.target || inputNameClean) {
          const labelText = step.selectorObj?.text || step.target || inputNameClean;
          inputSelectorsToTry.push(`page.get_by_label("${labelText.replace(/"/g, '\\"')}")`);
          inputSelectorsToTry.push(`page.get_by_placeholder("${labelText.replace(/"/g, '\\"')}")`);
          inputSelectorsToTry.push(`page.get_by_label("${labelText.replace(/"/g, '\\"')}", exact=False)`);
        }
        // 5. Name attribute
        if (step.selectorObj?.name) {
          inputSelectorsToTry.push(`page.locator('[name="${step.selectorObj.name}"]')`);
        }
        
        // Deduplicate selectors and ensure at least one exists
        const uniqueInputSelectors = [...new Set(inputSelectorsToTry)].filter(s => s && s.length > 0);
        
        // Fallback: if no selectors found, use step name as label selector
        if (uniqueInputSelectors.length === 0 && inputNameClean) {
          uniqueInputSelectors.push(`page.get_by_label("${inputNameClean.replace(/"/g, '\\"')}")`);
        }
        
        // Determine the value to use (runtime or static)
        const valueExpr = isRuntimeRandom ? '_runtime_value' : `"${escapedInputValue}"`;
        const valuePreview = isRuntimeRandom ? '{_runtime_value}' : (escapedInputValue.slice(0, 20) + (inputValue.length > 20 ? '...' : ''));
        
        code += `${indent}# Fill input with fallback selectors (same logic as Suggest)\n`;
        // Escape quotes in step name for Python f-string
        const inputNameForPython = inputNameClean.replace(/"/g, '\\"').replace(/'/g, "\\'");
        code += `${indent}print(f"🔍 Looking for input: ${inputNameForPython}")\n`;
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
        code += `${indent}for _selector_str, _priority in _input_selectors:\n`;
        code += `${indent}    try:\n`;
        code += `${indent}        _el = eval(_selector_str)\n`;
        code += `${indent}        _count = _el.count()\n`;
        code += `${indent}        if _count > 0:\n`;
        code += `${indent}            print(f"   ✓ Found {_count} input(s) with selector #{_priority}")\n`;
        code += `${indent}            if _count > 1:\n`;
        code += `${indent}                print(f"   ⚠️ Multiple matches, filling first visible")\n`;
        code += `${indent}                for i in range(_count):\n`;
        code += `${indent}                    try:\n`;
        code += `${indent}                        if _el.nth(i).is_visible():\n`;
        code += `${indent}                            _el.nth(i).fill(_fill_value)\n`;
        code += `${indent}                            break\n`;
        code += `${indent}                    except:\n`;
        code += `${indent}                        continue\n`;
        code += `${indent}                else:\n`;
        code += `${indent}                    _el.first.fill(_fill_value)\n`;
        code += `${indent}            else:\n`;
        code += `${indent}                _el.fill(_fill_value)\n`;
        code += `${indent}            _input_found = True\n`;
        code += `${indent}            print(f"   ✓ Filled with: {_fill_value[:30] if len(str(_fill_value)) > 30 else _fill_value}")\n`;
        code += `${indent}            break\n`;
        code += `${indent}    except Exception as _e:\n`;
        code += `${indent}        print(f"   Selector #{_priority} failed: {str(_e)[:50]}")\n`;
        code += `${indent}        continue\n`;
        code += `${indent}if not _input_found:\n`;
        code += `${indent}    page.wait_for_timeout(1500)\n`;
        code += `${indent}    for _selector_str, _priority in _input_selectors[:3]:\n`;
        code += `${indent}        try:\n`;
        code += `${indent}            _el = eval(_selector_str)\n`;
        code += `${indent}            if _el.count() > 0:\n`;
        code += `${indent}                _el.first.fill(_fill_value)\n`;
        code += `${indent}                _input_found = True\n`;
        code += `${indent}                print(f"   ✓ Found after wait with selector #{_priority}")\n`;
        code += `${indent}                break\n`;
        code += `${indent}        except:\n`;
        code += `${indent}            continue\n`;
        code += `${indent}if not _input_found:\n`;
        code += `${indent}    print("❌ Input not found with any selector")\n`;
        code += `${indent}    raise Exception("Input failed: No elements found matching any selector")\n`;
        break;
      }
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
        code += `${indent}print(f"✓ Date '{_date_text}' is in the future")\n`;
        break;
      }
      
      case 'date_verify_sequence': {
        const startSel = (step as any).startDateSelector;
        const endSel = (step as any).endDateSelector;
        code += `${indent}# Verify end date is after start date\n`;
        code += `${indent}_start_date = page.${convertSelector(startSel || '')}.inner_text()\n`;
        code += `${indent}_end_date = page.${convertSelector(endSel || '')}.inner_text()\n`;
        code += `${indent}verify_date_sequence(_start_date, _end_date)\n`;
        code += `${indent}print(f"✓ Date sequence valid: {_start_date} → {_end_date}")\n`;
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
        code += `${indent}print(f"✓ Multiplication verified: {_factor1} × {_factor2} = {_result}")\n`;
        break;
      }
      
      case 'math_verify_sum': {
        const listSel = (step as any).listSelector;
        const totalSel = (step as any).totalSelector;
        code += `${indent}# Verify sum of list equals total\n`;
        code += `${indent}_items = page.${convertSelector(listSel || '')}.all_inner_texts()\n`;
        code += `${indent}_total = page.${convertSelector(totalSel || '')}.inner_text()\n`;
        code += `${indent}verify_sum(_items, _total)\n`;
        code += `${indent}print(f"✓ Sum verified: {len(_items)} items = {_total}")\n`;
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
        code += `${indent}print(f"✓ Discount verified: {_original} - ${disc}% = {_final}")\n`;
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
        code += `${indent}print(f"✓ Format verified: '{_text}' matches ${fmtType}")\n`;
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
          code += `${indent}print(f"✓ Target field is visible after trigger")\n`;
        } else {
          code += `${indent}expect(page.${convertSelector(targetSel || '')}).to_be_hidden()\n`;
          code += `${indent}print(f"✓ Target field is hidden after trigger")\n`;
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
        code += `${indent}    status = "✓" if result.get("test_passed") else "✗"\n`;
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
                print(f"✓ Step ${index + 1}: ${step.name.replace(/"/g, '\\"')}")
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

  // Clean up the selector
  selector = selector.trim();
  
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
    result = `locator("${selector.replace(/"/g, '\\"')}")`;
  }

  console.log('[convertSelector] Final result:', result);
  return result || 'locator("body")';
}









