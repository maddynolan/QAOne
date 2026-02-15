/**
 * Step Description & Conversion Helpers
 *
 * Extracted from UnifiedWorkflowEditor.tsx.
 * Pure functions for generating step descriptions, mapping event types,
 * cleaning step names, and converting workflow steps.
 */

import type { StepType, TestStep } from '../types/workflow-editor.types';
import { extractSelectorString, extractTargetName } from './selector-utils';

/**
 * Get friendly step description for No-Code view
 */
export function getStepDescription(step: TestStep): string {
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
        const hasGarbledChars = /[\u0101\u00e3\u53e3\u00a2\u0393]/.test(step.value || '');

        if (isSensitive || hasGarbledChars) {
          return `Type "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"`;
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
      return step.noteText ? `\ud83d\udcdd ${step.noteText.slice(0, 50)}...` : 'Note';

    case 'manual_step':
      return step.manualAction || 'Manual step';

    case 'checkpoint':
      return step.noteText ? `\ud83d\udea9 ${step.noteText.slice(0, 40)}` : 'Checkpoint';

    // Salesforce Testing Helper step types
    case 'sf-navigate-record' as any:
      return `Navigate to ${(step as any).args?.[1] || 'record'}: ${(step as any).args?.[0] || ''}`;
    case 'sf-navigate-soql' as any:
      return `Query ${(step as any).args?.[0] || 'Object'} and navigate`;
    case 'sf-navigate-list' as any:
      return `Navigate to ${(step as any).args?.[0] || 'Object'} list`;
    case 'sf-navigate-new' as any:
      return `Open New ${(step as any).args?.[0] || 'Record'} form`;
    case 'sf-global-search' as any:
      return `Search: "${(step as any).args?.[0] || ''}"`;
    case 'sf-app-launcher' as any:
      return 'Open App Launcher';
    case 'sf-open-search' as any:
      return 'Focus Global Search';
    case 'sf-wait' as any:
      return `Wait for Salesforce (${(step as any).args?.[0] || '3000'}ms)`;
    case 'sf-click-tab' as any:
      return `Click ${(step as any).args?.[0] || 'Details'} tab`;
    case 'sf-click-save' as any:
      return 'Click Save button';
    case 'sf-click-edit' as any:
      return 'Click Edit button';
    case 'sf-click-delete' as any:
      return 'Click Delete button';
    case 'sf-click-clone' as any:
      return 'Click Clone button';

    default:
      return step.description || '';
  }
}

/**
 * Map raw event type strings to StepType
 */
export function mapEventType(type: string): StepType {
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
}

/**
 * Clean step name - remove redundant type prefixes (e.g., "Click: Click" -> "Click")
 * Also masks passwords and fixes garbled UTF-8 characters
 */
export function cleanStepName(name: string, type?: string): string {
  if (!name) return name;

  let cleaned = name;

  // Detect password fields by name pattern - match "pw" as word or in quotes
  const isPasswordField = /password|passwd|pwd|["']pw["']|\/pw\/|:pw:|_pw_|\bpw\b/i.test(name);

  // Detect garbled UTF-8 characters (encoding issues)
  const hasGarbledChars = /[\u0101\u00e3\u53e3\u00a2\u0393]/.test(name);

  // If it's a password field or has garbled chars, mask the value
  if (isPasswordField || hasGarbledChars) {
    // Replace quoted values with mask (handles: "value" or 'value')
    cleaned = cleaned.replace(/["'][^"']+["']/g, (match, offset) => {
      // Preserve field name (first quoted value), mask password (second quoted value)
      // Pattern: Fill "fieldName": "value"
      if (offset > 10) return '"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"';
      return match;
    });

    // If the entire name is garbled, replace it
    if (hasGarbledChars && cleaned === name) {
      // Keep the action and field name, replace garbled value
      if (cleaned.includes(':')) {
        const parts = cleaned.split(':');
        cleaned = `${parts[0]}: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"`;
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
}

/**
 * Generate a step name from a recording event
 */
export function generateStepName(event: any): string {
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
}

/**
 * Generate expected result from a recording event
 */
export function generateExpectedResult(event: any): string {
  const type = event.type || 'click';
  if (type === 'click') return 'Element is clicked successfully';
  if (type === 'input') return 'Text is entered in the field';
  if (type === 'navigate') return 'Page navigates successfully';
  return '';
}

/**
 * Convert a workflow node/step to TestStep format
 */
export function convertWorkflowStep(node: any): TestStep {
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
}
