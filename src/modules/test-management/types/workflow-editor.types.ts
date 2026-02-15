/**
 * Unified Workflow Editor Types
 *
 * Extracted from UnifiedWorkflowEditor.tsx for reusability and maintainability.
 * Contains all type/interface definitions for the test builder.
 */

import type { BlackboxLocator } from '@/modules/recorder/components/BlackboxLocatorStrategies';
import type { DomainType } from '@/lib/qa-validation-templates';

// ============================================================================
// TYPES - Unified Test Case Schema
// ============================================================================

export type StepType =
  | 'navigate' | 'click' | 'input' | 'select' | 'hover' | 'scroll'
  | 'wait' | 'wait_for_element' | 'wait_for_text'
  | 'assert' | 'verify'
  | 'api' | 'graphql'
  | 'db_query' | 'db_assert'
  | 'note' | 'manual_step' | 'checkpoint'
  | 'screenshot' | 'visual_compare'
  | 'extract' | 'store_variable'
  | 'condition' | 'loop' | 'foreach'
  | 'module'
  | 'custom'
  // Salesforce step types
  | 'sf_connect' | 'sf_query' | 'sf_assert' | 'sf_navigate'
  | 'sf_metadata_assert' | 'sf_login_as' | 'sf_create_record'
  // Complex Verification step types
  | 'email_verify' | 'pdf_verify' | 'file_verify'
  // Advanced UI - Dynamic Selection & Data Extraction
  | 'smart_select' | 'extract_variable' | 'computed_assert'
  // Advanced UI - Table Operations
  | 'table_find' | 'table_extract' | 'table_assert'
  // Advanced UI - Complex Interactions
  | 'drag_drop' | 'slider' | 'date_picker' | 'keyboard'
  // Advanced UI - Multi-context
  | 'frame_switch' | 'new_tab' | 'alert_handle' | 'multi_select';

export interface StepAssertion {
  id?: string;  // For multiple assertions
  enabled: boolean;
  type: string;
  target?: string;
  expected?: string;
  operator?: 'equals' | 'contains' | 'greater' | 'less' | 'matches';
  softAssert?: boolean;
}

export interface SelectorObject {
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

export interface TestStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  enabled: boolean;

  // UI Actions
  selector?: string;
  selectorObj?: SelectorObject;  // Full selector with fallbacks (same as Suggest/Recording)
  value?: string;
  displayValue?: string;  // Masked value for display (e.g., ******* for passwords)
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

  // ========== Advanced UI - Smart Selection ==========
  findBy?: 'text' | 'attribute' | 'contains' | 'index' | 'css' | 'xpath';
  findCriteria?: string;        // The value to match (text, attribute value, etc.)
  findAttribute?: string;       // For attribute-based selection (e.g., 'data-product-id')
  findWithin?: string;          // Container selector to search within
  findIndex?: number;           // For index-based selection

  // ========== Advanced UI - Data Extraction ==========
  extractType?: 'text' | 'number' | 'attribute' | 'count' | 'html' | 'list';
  extractAttribute?: string;    // Which attribute to extract (for attribute type)
  extractRegex?: string;        // Optional regex to extract part of the value
  variableName?: string;        // Name of the variable to store the extracted value

  // ========== Advanced UI - Computed Assertions ==========
  expression?: string;          // Math/string expression: "${price} * ${quantity}"
  compareOperator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches';
  compareValue?: string;        // Expected value or expression: "${total}"
  tolerance?: number;           // For floating point comparisons

  // ========== Advanced UI - Table Operations ==========
  tableSelector?: string;       // Selector for the table element
  columnName?: string;          // Column to search in (for table_find)
  rowCriteria?: string;         // Value to find in the column
  actionColumn?: string;        // Column containing the action button (for table_find)
  actionButton?: string;        // Button text to click (e.g., "Edit", "Delete")
  extractColumns?: string[];    // Columns to extract values from

  // ========== Advanced UI - Complex Interactions ==========
  targetSelector?: string;      // Drop target for drag_drop
  sliderValue?: number;         // Value to set slider to (0-100 or custom range)
  sliderMin?: number;           // Min value of slider
  sliderMax?: number;           // Max value of slider
  dateValue?: string;           // Date to select (ISO format)
  dateFormat?: string;          // Expected format in the date picker
  keyToPress?: string;          // Key to press (e.g., 'Enter', 'Tab', 'ArrowDown')
  keyModifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];  // Modifier keys

  // ========== Advanced UI - Multi-Context ==========
  frameSelector?: string;       // Frame/iframe selector or index
  frameIndex?: number;          // Frame index (0-based)
  tabAction?: 'new' | 'switch' | 'close';  // Tab action type
  tabIndex?: number;            // Tab index for switch/close
  alertAction?: 'accept' | 'dismiss' | 'getText' | 'type';  // Alert handling action
  alertText?: string;           // Text to type into prompt

  // ========== Advanced UI - Loops & Conditions ==========
  loopType?: 'count' | 'foreach' | 'while';
  loopCount?: number;           // For count-based loops
  loopSelector?: string;        // Selector for elements to iterate (foreach)
  loopVariable?: string;        // Variable name for current iteration
  conditionExpression?: string; // Expression to evaluate for condition/while
  thenSteps?: TestStep[];       // Steps to run if condition is true
  elseSteps?: TestStep[];       // Steps to run if condition is false
  loopSteps?: TestStep[];       // Steps to run in each iteration

  // ========== Advanced UI - Multi-Select ==========
  selectMultiple?: boolean;     // Whether to select multiple elements
  selectValues?: string[];      // Multiple values to select
}

export interface TestVariable {
  name: string;
  value: string;
  type: 'static' | 'env' | 'generated' | 'extracted';
}

// Precondition test case reference
export interface PreconditionRef {
  testCaseId: string;
  testCaseName: string;
  enabled: boolean;
}

export interface UnifiedTestCase {
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

export type ExportMode = 'automation' | 'api' | 'database' | 'performance' | 'manual';
export type ViewMode = 'no-code' | 'code';
