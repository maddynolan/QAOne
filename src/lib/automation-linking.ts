/**
 * Automation Linking System
 * 
 * Provides bidirectional linking between manual test steps and recorded automation actions.
 * Supports multiple linking modes and template-based description generation.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single automation action (recorded or from suggestion)
 */
export interface AutomationAction {
  id: string;
  qword: string;           // click, fill, navigate, assert, etc.
  args: string[];          // [selector, value] or [url] etc.
  description?: string;    // Human-readable description
  selectorObj?: any;       // Full selector object with fallbacks
  timestamp?: number;
  source: 'recorded' | 'suggested' | 'manual';  // Where this action came from
  isOptional?: boolean;    // For wait/hover actions that might be skipped
}

/**
 * How to merge manual description with automation
 */
export type LinkMode = 
  | 'replace'    // Automation replaces manual text (use generated description)
  | 'document'   // Keep manual text as documentation, add automation alongside
  | 'hybrid';    // Use manual text for description, automation for execution

/**
 * Automation status for a step
 */
export type AutomationStatus = 
  | 'manual'           // No automation attached
  | 'partial'          // Some actions recorded but not complete
  | 'fully_automated'  // All actions recorded and linked
  | 'verified';        // Automated and verified working

/**
 * Enhanced step with both manual and automation layers
 */
export interface LinkedStep {
  id: string;
  
  // ═══ MANUAL LAYER ═══
  manualDescription: string;      // What the tester should do
  expectedResult: string;         // What should happen
  preconditions?: string;         // Setup requirements
  
  // ═══ AUTOMATION LAYER ═══
  automationActions: AutomationAction[];  // Multiple actions per step!
  automationStatus: AutomationStatus;
  
  // ═══ LINKAGE ═══
  linkMode: LinkMode;
  
  // ═══ ORIGINAL STEP DATA (preserved) ═══
  originalStep?: any;  // Original step data for reference
}

/**
 * Recording session state for "Automate Existing" mode
 */
export interface AutomationSession {
  testCaseId: string;
  currentStepIndex: number;
  stepLinks: Record<number, {
    actions: AutomationAction[];
    linkMode: LinkMode;
    isComplete: boolean;
  }>;
  recordingMode: 'new' | 'existing' | 'hybrid';
  groupingEnabled: boolean;  // Allow multiple actions per step
}

// ============================================================================
// TEMPLATE-BASED DESCRIPTION GENERATOR
// ============================================================================

/**
 * Templates for generating human-readable descriptions from recorded actions
 */
const ACTION_TEMPLATES: Record<string, (args: string[], selectorObj?: any) => string> = {
  // Navigation
  'navigate': (args) => `Navigate to ${args[0] || 'the page'}`,
  'goto': (args) => `Go to ${args[0] || 'the page'}`,
  'back': () => 'Go back to the previous page',
  'forward': () => 'Go forward to the next page',
  'reload': () => 'Reload the current page',
  
  // Clicks
  'click': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Click on ${target}`;
  },
  'dblclick': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Double-click on ${target}`;
  },
  'rightclick': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Right-click on ${target}`;
  },
  
  // Input
  'fill': (args, sel) => {
    const field = getReadableTarget(args[0], sel);
    const value = args[1] ? `"${maskIfSensitive(args[1], sel)}"` : 'a value';
    return `Enter ${value} in the ${field}`;
  },
  'type': (args, sel) => {
    const field = getReadableTarget(args[0], sel);
    const value = args[1] ? `"${maskIfSensitive(args[1], sel)}"` : 'text';
    return `Type ${value} in the ${field}`;
  },
  'clear': (args, sel) => {
    const field = getReadableTarget(args[0], sel);
    return `Clear the ${field}`;
  },
  'press': (args) => `Press the ${args[1] || args[0] || 'Enter'} key`,
  
  // Selection
  'select': (args, sel) => {
    const dropdown = getReadableTarget(args[0], sel);
    const value = args[1] ? `"${args[1]}"` : 'an option';
    return `Select ${value} from the ${dropdown}`;
  },
  'selectOption': (args, sel) => {
    const dropdown = getReadableTarget(args[0], sel);
    const value = args[1] ? `"${args[1]}"` : 'an option';
    return `Select ${value} from the ${dropdown}`;
  },
  'check': (args, sel) => {
    const checkbox = getReadableTarget(args[0], sel);
    return `Check the ${checkbox}`;
  },
  'uncheck': (args, sel) => {
    const checkbox = getReadableTarget(args[0], sel);
    return `Uncheck the ${checkbox}`;
  },
  
  // Hover/Focus
  'hover': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Hover over ${target}`;
  },
  'focus': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Focus on ${target}`;
  },
  
  // Wait
  'wait': (args) => `Wait for ${args[0] || '1000'}ms`,
  'waitForSelector': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Wait for ${target} to appear`;
  },
  'waitForText': (args) => `Wait for text "${args[0]}" to appear`,
  'waitForNavigation': () => 'Wait for page navigation to complete',
  'waitForLoadState': (args) => `Wait for page to ${args[0] || 'load'}`,
  
  // Assertions
  'assert': (args) => {
    const type = args[0] || 'value';
    const expected = args[2] || args[1];
    return `Verify ${type} equals "${expected}"`;
  },
  'assertText': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Verify ${target} contains "${args[1]}"`;
  },
  'assertVisible': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Verify ${target} is visible`;
  },
  'assertHidden': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Verify ${target} is hidden`;
  },
  'assertUrl': (args) => `Verify URL contains "${args[0]}"`,
  'assertTitle': (args) => `Verify page title is "${args[0]}"`,
  
  // File
  'upload': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Upload file to ${target}`;
  },
  'download': () => 'Download the file',
  
  // Scroll
  'scroll': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Scroll to ${target}`;
  },
  'scrollIntoView': (args, sel) => {
    const target = getReadableTarget(args[0], sel);
    return `Scroll ${target} into view`;
  },
  
  // Screenshot
  'screenshot': () => 'Take a screenshot',
  
  // Keyboard
  'keyboard': (args) => `Press ${args[0] || 'key'}`,
};

/**
 * Extract a human-readable target name from selector
 */
function getReadableTarget(selector: string | undefined, selectorObj?: any): string {
  if (!selector && !selectorObj) return 'the element';
  
  // Try to extract from selectorObj first (has more context)
  if (selectorObj) {
    // Check for human-readable attributes
    if (selectorObj.ariaLabel) return `"${selectorObj.ariaLabel}" button/element`;
    if (selectorObj.text) return `"${selectorObj.text}"`;
    if (selectorObj.placeholder) return `"${selectorObj.placeholder}" field`;
    if (selectorObj.name) return `"${selectorObj.name}" field`;
    if (selectorObj.testId) return `"${selectorObj.testId}" element`;
    if (selectorObj.role) return `the ${selectorObj.role}`;
  }
  
  if (!selector) return 'the element';
  
  // Parse common selector patterns
  const patterns = [
    // text= or text=""
    { regex: /text[=:]?\s*["']([^"']+)["']/i, format: (m: string) => `"${m}"` },
    // placeholder=
    { regex: /placeholder[=:]?\s*["']([^"']+)["']/i, format: (m: string) => `"${m}" field` },
    // aria-label=
    { regex: /aria-label[=:]?\s*["']([^"']+)["']/i, format: (m: string) => `"${m}"` },
    // data-testid=
    { regex: /data-testid[=:]?\s*["']([^"']+)["']/i, format: (m: string) => `"${m}" element` },
    // name=
    { regex: /name[=:]?\s*["']([^"']+)["']/i, format: (m: string) => `"${m}" field` },
    // id=
    { regex: /#([a-zA-Z0-9_-]+)/i, format: (m: string) => `"${m}" element` },
    // button, input, etc.
    { regex: /\b(button|input|select|textarea|link|checkbox|radio)\b/i, format: (m: string) => `the ${m}` },
    // getByRole
    { regex: /getByRole\(['"]([^'"]+)['"]/i, format: (m: string) => `the ${m}` },
    // getByText
    { regex: /getByText\(['"]([^'"]+)['"]/i, format: (m: string) => `"${m}"` },
    // getByLabel
    { regex: /getByLabel\(['"]([^'"]+)['"]/i, format: (m: string) => `"${m}" field` },
    // getByPlaceholder
    { regex: /getByPlaceholder\(['"]([^'"]+)['"]/i, format: (m: string) => `"${m}" field` },
  ];
  
  for (const pattern of patterns) {
    const match = selector.match(pattern.regex);
    if (match && match[1]) {
      return pattern.format(match[1]);
    }
  }
  
  // Fallback: clean up selector for display
  return 'the element';
}

/**
 * Mask sensitive values (passwords, tokens, etc.)
 */
function maskIfSensitive(value: string, selectorObj?: any): string {
  // Check if this is likely a password field
  const isPw = selectorObj && (
    selectorObj.inputType === 'password' ||
    /password|passwd|pwd|secret|token/i.test(JSON.stringify(selectorObj))
  );
  
  if (isPw) return '••••••••';
  return value;
}

/**
 * Generate a human-readable description for a single action
 */
export function generateActionDescription(action: AutomationAction): string {
  const template = ACTION_TEMPLATES[action.qword?.toLowerCase()];
  
  if (template) {
    return template(action.args || [], action.selectorObj);
  }
  
  // Fallback: basic description
  if (action.description) return action.description;
  return `${action.qword || 'Perform action'} ${action.args?.[0] || ''}`.trim();
}

/**
 * Generate a combined description for multiple actions (many-to-one)
 */
export function generateGroupDescription(actions: AutomationAction[]): string {
  if (actions.length === 0) return 'No actions recorded';
  if (actions.length === 1) return generateActionDescription(actions[0]);
  
  // Group related actions
  const descriptions = actions.map(a => generateActionDescription(a));
  
  // Try to create a cohesive description
  // Check for common patterns
  const hasNavigation = actions.some(a => ['navigate', 'goto'].includes(a.qword?.toLowerCase()));
  const hasLogin = actions.some(a => 
    a.args?.some(arg => /username|email|password|login/i.test(String(arg)))
  );
  const hasSubmit = actions.some(a => 
    a.qword === 'click' && /submit|login|sign|save|confirm/i.test(String(a.args?.[0] || ''))
  );
  
  // Pattern: Login flow
  if (hasLogin && hasSubmit) {
    return 'Complete the login process with credentials';
  }
  
  // Pattern: Form submission
  if (hasSubmit && actions.filter(a => a.qword === 'fill').length >= 2) {
    return 'Fill out and submit the form';
  }
  
  // Pattern: Navigation + Actions
  if (hasNavigation && actions.length > 1) {
    return `Navigate and ${descriptions.slice(1).join(', then ')}`;
  }
  
  // Default: List first few actions
  if (descriptions.length <= 3) {
    return descriptions.join(', then ');
  }
  
  return `${descriptions[0]}, then ${descriptions.length - 1} more actions`;
}

/**
 * Generate expected result from actions
 */
export function generateExpectedResult(actions: AutomationAction[]): string {
  if (actions.length === 0) return '';
  
  // Look for assertions first
  const assertions = actions.filter(a => 
    a.qword?.toLowerCase().startsWith('assert') || 
    a.qword?.toLowerCase() === 'verify'
  );
  
  if (assertions.length > 0) {
    return assertions.map(a => generateActionDescription(a)).join('; ');
  }
  
  // Look for navigation
  const lastNav = [...actions].reverse().find(a => 
    ['navigate', 'goto', 'click'].includes(a.qword?.toLowerCase())
  );
  
  if (lastNav && lastNav.qword === 'click') {
    return 'Action completes successfully';
  }
  
  if (lastNav && ['navigate', 'goto'].includes(lastNav.qword?.toLowerCase())) {
    return `Page loads successfully at ${lastNav.args?.[0] || 'the destination'}`;
  }
  
  return 'Action completes without errors';
}

// ============================================================================
// LINKING UTILITIES
// ============================================================================

/**
 * Create a LinkedStep from a manual step and automation actions
 */
export function createLinkedStep(
  manualStep: any,
  actions: AutomationAction[],
  linkMode: LinkMode = 'document'
): LinkedStep {
  const status: AutomationStatus = actions.length === 0 
    ? 'manual' 
    : 'fully_automated';
  
  return {
    id: manualStep.id || `step_${Date.now()}`,
    
    // Manual layer
    manualDescription: linkMode === 'replace' 
      ? generateGroupDescription(actions)
      : (manualStep.manualAction || manualStep.name || manualStep.description || ''),
    expectedResult: manualStep.expectedResult || generateExpectedResult(actions),
    preconditions: manualStep.preconditions,
    
    // Automation layer
    automationActions: actions,
    automationStatus: status,
    
    // Linkage
    linkMode,
    
    // Preserve original
    originalStep: manualStep,
  };
}

/**
 * Convert recorded actions to AutomationAction format
 */
export function convertRecordedAction(recorded: any): AutomationAction {
  return {
    id: recorded.id || `action_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    qword: recorded.qword || recorded.type || 'action',
    args: recorded.args || [],
    description: recorded.description || generateActionDescription({
      id: recorded.id,
      qword: recorded.qword,
      args: recorded.args,
      selectorObj: recorded.selectorObj,
      source: 'recorded',
    }),
    selectorObj: recorded.selectorObj,
    timestamp: recorded.timestamp || Date.now(),
    source: 'recorded',
  };
}

/**
 * Convert suggestion to AutomationAction format
 */
export function convertSuggestion(suggestion: any): AutomationAction {
  return {
    id: `sugg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    qword: suggestion.qword || suggestion.type || 'action',
    args: suggestion.args || [],
    description: suggestion.description || '',
    selectorObj: suggestion.selectorObj,
    timestamp: Date.now(),
    source: 'suggested',
  };
}

/**
 * Merge linked steps back to the original step format for saving
 */
export function mergeToStep(linkedStep: LinkedStep): any {
  const base = linkedStep.originalStep || {};
  const hasAutomation = linkedStep.automationActions.length > 0;
  const firstAction = linkedStep.automationActions[0];
  
  return {
    ...base,
    id: linkedStep.id,
    
    // Keep manual description based on mode
    manualAction: linkedStep.linkMode === 'replace' 
      ? undefined 
      : linkedStep.manualDescription,
    name: linkedStep.linkMode === 'replace' && hasAutomation
      ? generateGroupDescription(linkedStep.automationActions)
      : (base.name || linkedStep.manualDescription),
    description: linkedStep.manualDescription,
    expectedResult: linkedStep.expectedResult,
    
    // Automation data (from first action for simple execution)
    qword: firstAction?.qword,
    args: firstAction?.args,
    selector: firstAction?.selectorObj?.selector || firstAction?.selectorObj?.playwright,
    selectorObj: firstAction?.selectorObj,
    
    // NEW: All automation actions for complex steps
    automationActions: linkedStep.automationActions.length > 1 
      ? linkedStep.automationActions 
      : undefined,
    
    // Status
    automationStatus: linkedStep.automationStatus,
    linkMode: linkedStep.linkMode,
    
    // Keep type
    type: hasAutomation ? (firstAction?.qword || base.type) : (base.type || 'manual_step'),
  };
}

/**
 * Calculate automation coverage for a test case
 */
export function calculateCoverage(steps: LinkedStep[]): {
  total: number;
  automated: number;
  partial: number;
  manual: number;
  percentage: number;
} {
  const total = steps.length;
  let automated = 0;
  let partial = 0;
  let manual = 0;
  
  for (const step of steps) {
    switch (step.automationStatus) {
      case 'fully_automated':
      case 'verified':
        automated++;
        break;
      case 'partial':
        partial++;
        break;
      default:
        manual++;
    }
  }
  
  const percentage = total > 0 ? Math.round((automated / total) * 100) : 0;
  
  return { total, automated, partial, manual, percentage };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const SESSION_KEY = 'automation_session';

/**
 * Save automation session to localStorage
 */
export function saveSession(session: AutomationSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save automation session:', e);
  }
}

/**
 * Load automation session from localStorage
 */
export function loadSession(): AutomationSession | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load automation session:', e);
    return null;
  }
}

/**
 * Clear automation session
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Failed to clear automation session:', e);
  }
}

// ============================================================================
// STEP MATCHING HEURISTICS
// ============================================================================

/**
 * Try to auto-match a recorded action to a manual step based on content similarity
 */
export function findBestStepMatch(
  action: AutomationAction,
  manualSteps: any[],
  existingLinks: Record<number, AutomationAction[]>
): number | null {
  if (manualSteps.length === 0) return null;
  
  const actionDesc = generateActionDescription(action).toLowerCase();
  const actionKeywords = extractKeywords(actionDesc);
  
  let bestMatch: { index: number; score: number } | null = null;
  
  for (let i = 0; i < manualSteps.length; i++) {
    // Skip if already fully linked
    if (existingLinks[i]?.length >= 5) continue; // Max 5 actions per step
    
    const step = manualSteps[i];
    const stepText = `${step.name || ''} ${step.manualAction || ''} ${step.description || ''}`.toLowerCase();
    const stepKeywords = extractKeywords(stepText);
    
    // Calculate similarity score
    let score = 0;
    
    // Keyword overlap
    for (const keyword of actionKeywords) {
      if (stepKeywords.has(keyword)) {
        score += 2;
      } else if (stepText.includes(keyword)) {
        score += 1;
      }
    }
    
    // Action type matching
    if (action.qword === 'click' && /click|press|tap|button/i.test(stepText)) score += 3;
    if (action.qword === 'fill' && /enter|type|input|field|form/i.test(stepText)) score += 3;
    if (action.qword === 'navigate' && /go|navigate|open|visit|url/i.test(stepText)) score += 3;
    if (action.qword === 'select' && /select|choose|pick|dropdown/i.test(stepText)) score += 3;
    if (action.qword?.startsWith('assert') && /verify|check|confirm|ensure|should/i.test(stepText)) score += 3;
    
    // Prefer steps that don't have automation yet
    if (!existingLinks[i] || existingLinks[i].length === 0) {
      score += 1;
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { index: i, score };
    }
  }
  
  // Only return if score is reasonable
  return bestMatch && bestMatch.score >= 3 ? bestMatch.index : null;
}

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'to', 'on', 'in', 'for', 'and', 'or', 'is', 'be', 'should', 'then', 'that', 'this']);
  
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

