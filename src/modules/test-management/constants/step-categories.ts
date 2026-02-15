/**
 * Step Categories & Step Info
 *
 * Extracted from UnifiedWorkflowEditor.tsx.
 * Defines all step type categories for the test builder palette.
 */

import {
  MousePointer, Navigation, Type, ChevronDown, Target, Upload, Keyboard,
  CheckCircle, Eye, FileText, Link2, Hash, Calculator, Mail, File,
  Clock, Timer, Activity,
  Database, Edit, Download, Wand2, ClipboardList,
  Share2, RefreshCw, Package, Layers, Layout, Maximize2, AlertCircle,
  Server, Globe, Key, ShieldCheck,
  Search, Move, Sliders, Calendar, CheckSquare,
  Camera, Flag,
  Cloud, Settings, User, Plus,
  Zap,
} from 'lucide-react';
import type { StepType } from '../types/workflow-editor.types';

// ============================================================================
// STEP TYPE DEFINITIONS
// ============================================================================

/**
 * Step Palette - Streamlined test step types organized for robust test building
 *
 * ORGANIZED BY TEST FLOW:
 *
 * CORE ACTIONS (Most Used - 80% of tests)
 *   1. UI Actions    -> Navigate, Click, Type, Select (basic interactions)
 *   2. Verify        -> Assert visibility, text, values (validation)
 *   3. Wait          -> Timing and synchronization
 *
 * DATA & LOGIC (When tests need dynamic behavior)
 *   4. Data          -> Variables, extraction, data generation
 *   5. Logic         -> Conditions, loops, reusable modules, browser contexts
 *
 * ADVANCED (Complex scenarios)
 *   6. Backend       -> API calls, database queries
 *   7. Advanced      -> Tables, drag-drop, complex interactions
 *
 * DOCUMENTATION
 *   8. Evidence      -> Screenshots, notes, manual steps
 *
 * PLUGINS (Show based on license)
 *   9. Salesforce    -> SF-specific automation
 */
export const STEP_CATEGORIES = {
  // CORE ACTIONS - These cover 80% of test cases

  // UI ACTIONS - The foundation of UI testing
  ui: {
    label: 'UI Actions',
    icon: MousePointer,
    color: 'blue',
    description: 'Core interactions - click, type, select',
    priority: 1,
    steps: [
      { type: 'navigate', label: 'Navigate', icon: Navigation, color: 'bg-blue-500', desc: 'Go to URL' },
      { type: 'click', label: 'Click', icon: MousePointer, color: 'bg-blue-500', desc: 'Click element' },
      { type: 'input', label: 'Type Text', icon: Type, color: 'bg-blue-500', desc: 'Enter text in field' },
      { type: 'select', label: 'Select Option', icon: ChevronDown, color: 'bg-blue-500', desc: 'Choose from dropdown' },
      { type: 'hover', label: 'Hover', icon: Target, color: 'bg-blue-600', desc: 'Mouse hover' },
      { type: 'upload', label: 'Upload File', icon: Upload, color: 'bg-blue-600', desc: 'Upload file' },
      { type: 'keyboard', label: 'Press Keys', icon: Keyboard, color: 'bg-blue-600', desc: 'Keyboard shortcuts' },
    ]
  },

  // VERIFY - Assertions are critical for test validity
  verify: {
    label: 'Verify',
    icon: CheckCircle,
    color: 'green',
    description: 'Assert conditions are met',
    priority: 2,
    steps: [
      { type: 'assert', label: 'Element Visible', icon: Eye, color: 'bg-green-500', desc: 'Check element exists' },
      { type: 'assert_text', label: 'Text Content', icon: Type, color: 'bg-green-500', desc: 'Verify text on page' },
      { type: 'assert_value', label: 'Field Value', icon: FileText, color: 'bg-green-500', desc: 'Check input value' },
      { type: 'assert_url', label: 'URL Contains', icon: Link2, color: 'bg-green-600', desc: 'Verify URL' },
      { type: 'assert_title', label: 'Page Title', icon: FileText, color: 'bg-green-600', desc: 'Check page title' },
      { type: 'assert_count', label: 'Element Count', icon: Hash, color: 'bg-green-600', desc: 'Count elements' },
      { type: 'computed_assert', label: 'Computed Assert', icon: Calculator, color: 'bg-green-700', desc: 'Math/formula check' },
      { type: 'email_verify', label: 'Email Received', icon: Mail, color: 'bg-green-700', desc: 'Verify email' },
      { type: 'file_verify', label: 'File Downloaded', icon: File, color: 'bg-green-700', desc: 'Verify file' },
    ]
  },

  // WAIT - Critical for test stability
  wait: {
    label: 'Wait',
    icon: Clock,
    color: 'cyan',
    description: 'Timing and synchronization',
    priority: 3,
    steps: [
      { type: 'wait', label: 'Wait Time', icon: Timer, color: 'bg-cyan-500', desc: 'Fixed delay (ms)' },
      { type: 'wait_for_element', label: 'Wait for Element', icon: Eye, color: 'bg-cyan-500', desc: 'Until visible' },
      { type: 'wait_for_text', label: 'Wait for Text', icon: Type, color: 'bg-cyan-600', desc: 'Until text appears' },
      { type: 'wait_for_network', label: 'Wait for Network', icon: Activity, color: 'bg-cyan-600', desc: 'Network idle' },
    ]
  },

  // DATA & LOGIC - Dynamic test behavior

  // DATA - Variables, extraction, generation
  data: {
    label: 'Data',
    icon: Database,
    color: 'violet',
    description: 'Variables and test data',
    priority: 4,
    steps: [
      { type: 'set_variable', label: 'Set Variable', icon: Edit, color: 'bg-violet-500', desc: 'Store a value' },
      { type: 'extract_text', label: 'Extract from Page', icon: FileText, color: 'bg-violet-500', desc: 'Get text from element' },
      { type: 'extract_variable', label: 'Extract to Variable', icon: Download, color: 'bg-violet-500', desc: 'Store element value' },
      { type: 'generate_data', label: 'Generate Data', icon: Wand2, color: 'bg-violet-600', desc: 'Random/fake data' },
      { type: 'use_data_row', label: 'Use Data Row', icon: ClipboardList, color: 'bg-violet-600', desc: 'Data-driven testing' },
    ]
  },

  // LOGIC - Control flow, conditions, modules
  logic: {
    label: 'Logic',
    icon: Share2,
    color: 'purple',
    description: 'Control flow and browser contexts',
    priority: 5,
    steps: [
      { type: 'condition', label: 'If / Then', icon: Share2, color: 'bg-purple-500', desc: 'Conditional logic' },
      { type: 'loop', label: 'Loop', icon: RefreshCw, color: 'bg-purple-500', desc: 'Repeat steps' },
      { type: 'module', label: 'Reusable Module', icon: Package, color: 'bg-purple-600', desc: 'Import shared steps' },
      { type: 'group', label: 'Group Steps', icon: Layers, color: 'bg-purple-600', desc: 'Organize steps' },
      { type: 'frame_switch', label: 'Switch Frame', icon: Layout, color: 'bg-purple-700', desc: 'Enter iframe' },
      { type: 'new_tab', label: 'New Tab', icon: Maximize2, color: 'bg-purple-700', desc: 'Handle new tab' },
      { type: 'alert_handle', label: 'Handle Alert', icon: AlertCircle, color: 'bg-purple-700', desc: 'Accept/dismiss' },
    ]
  },

  // ADVANCED - Complex scenarios

  // BACKEND - API and Database
  backend: {
    label: 'Backend',
    icon: Server,
    color: 'orange',
    description: 'API calls and database queries',
    priority: 6,
    steps: [
      { type: 'api', label: 'API Request', icon: Globe, color: 'bg-orange-500', desc: 'HTTP request' },
      { type: 'api_validate', label: 'Validate Response', icon: CheckCircle, color: 'bg-orange-500', desc: 'Check API response' },
      { type: 'api_extract', label: 'Extract Value', icon: Key, color: 'bg-orange-600', desc: 'Get from response' },
      { type: 'db_query', label: 'Database Query', icon: Database, color: 'bg-orange-600', desc: 'SQL query' },
      { type: 'db_validate', label: 'Validate Data', icon: ShieldCheck, color: 'bg-orange-700', desc: 'Check DB data' },
    ]
  },

  // ADVANCED - Tables, complex interactions
  advanced: {
    label: 'Advanced',
    icon: Target,
    color: 'teal',
    description: 'Tables, drag-drop, complex UI',
    priority: 7,
    steps: [
      { type: 'smart_select', label: 'Smart Select', icon: Target, color: 'bg-teal-500', desc: 'Find by text/attribute' },
      { type: 'table_find', label: 'Find in Table', icon: Search, color: 'bg-teal-500', desc: 'Find row by value' },
      { type: 'table_extract', label: 'Extract from Table', icon: Download, color: 'bg-teal-500', desc: 'Get table data' },
      { type: 'table_assert', label: 'Assert Table', icon: CheckCircle, color: 'bg-teal-600', desc: 'Verify table data' },
      { type: 'drag_drop', label: 'Drag & Drop', icon: Move, color: 'bg-teal-600', desc: 'Drag to target' },
      { type: 'slider', label: 'Slider', icon: Sliders, color: 'bg-teal-600', desc: 'Set slider value' },
      { type: 'date_picker', label: 'Date Picker', icon: Calendar, color: 'bg-teal-700', desc: 'Select date' },
      { type: 'multi_select', label: 'Multi-Select', icon: CheckSquare, color: 'bg-teal-700', desc: 'Select multiple' },
      { type: 'pdf_verify', label: 'PDF Content', icon: FileText, color: 'bg-teal-700', desc: 'Verify PDF content' },
    ]
  },

  // DOCUMENTATION

  // EVIDENCE - Screenshots, notes, manual steps
  evidence: {
    label: 'Evidence',
    icon: Camera,
    color: 'rose',
    description: 'Screenshots, notes, manual steps',
    priority: 8,
    steps: [
      { type: 'screenshot', label: 'Screenshot', icon: Camera, color: 'bg-rose-500', desc: 'Capture screen' },
      { type: 'visual_check', label: 'Visual Compare', icon: Eye, color: 'bg-rose-500', desc: 'Compare to baseline' },
      { type: 'log', label: 'Log Message', icon: FileText, color: 'bg-rose-500', desc: 'Add log entry' },
      { type: 'note', label: 'Note / Comment', icon: FileText, color: 'bg-slate-500', desc: 'Free-form note' },
      { type: 'manual_step', label: 'Manual Step', icon: ClipboardList, color: 'bg-slate-500', desc: 'Manual action' },
      { type: 'checkpoint', label: 'Checkpoint', icon: Flag, color: 'bg-slate-600', desc: 'Verification point' },
    ]
  },

  // PLUGINS - Show based on license/settings

  // SALESFORCE - SF-specific steps
  salesforce: {
    label: 'Salesforce',
    icon: Cloud,
    color: 'sky',
    description: 'Salesforce automation',
    priority: 9,
    plugin: 'salesforce',
    steps: [
      { type: 'sf_connect', label: 'SF Connect', icon: Cloud, color: 'bg-sky-500', desc: 'Connect to org' },
      { type: 'sf_navigate', label: 'SF Navigate', icon: Navigation, color: 'bg-sky-500', desc: 'Navigate in SF' },
      { type: 'sf_query', label: 'SOQL Query', icon: Database, color: 'bg-sky-600', desc: 'Run SOQL' },
      { type: 'sf_assert', label: 'SF Assert', icon: ShieldCheck, color: 'bg-sky-600', desc: 'Assert record' },
      { type: 'sf_metadata_assert', label: 'Metadata Assert', icon: Settings, color: 'bg-sky-700', desc: 'Assert metadata' },
      { type: 'sf_login_as', label: 'Login As User', icon: User, color: 'bg-sky-700', desc: 'Switch user' },
      { type: 'sf_create_record', label: 'Create Record', icon: Plus, color: 'bg-sky-800', desc: 'Create record' },
    ]
  },
};

export const getStepInfo = (type: StepType) => {
  for (const category of Object.values(STEP_CATEGORIES)) {
    const step = (category as any).steps.find((s: any) => s.type === type);
    if (step) return step;
  }
  return { type, label: type, icon: Zap, color: 'bg-gray-500 text-white' };
};
