/**
 * Pure utility functions for FlowstralWorkflowEditor.
 * No React dependencies, no side effects.
 */
import type { Node } from './types';

/** Check if a workflow node is complete based on its type and required fields. */
export function isNodeComplete(node: Node): boolean {
  switch (node.data.type) {
    case 'navigate':
      return !!node.data.url;
    case 'click':
    case 'assert':
      return !!node.data.selector;
    case 'input':
      return !!node.data.selector && !!node.data.value;
    case 'wait':
      return !!node.data.value;
    default:
      return true;
  }
}

/** Auto-generate a smart Playwright locator based on node type and label. */
export function generateSmartLocator(type: Node['data']['type'], label: string): string {
  const cleanLabel = label.replace(/^(New|Click|Enter|Fill|Wait|Assert)\s+/i, '').trim();

  switch (type) {
    case 'click':
      // Try button first, then link
      if (cleanLabel) {
        return `page.getByRole('button', { name: '${cleanLabel}' })`;
      }
      return `page.getByRole('button').first()`;

    case 'input':
      // Use label if available, otherwise use placeholder text
      if (cleanLabel) {
        return `page.getByLabel('${cleanLabel}')`;
      }
      return `page.getByRole('textbox').first()`;

    case 'assert':
      // Use text content for assertions
      if (cleanLabel) {
        return `page.getByText('${cleanLabel}')`;
      }
      return `page.locator('body')`;

    default:
      return '';
  }
}
