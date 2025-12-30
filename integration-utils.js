// Utility functions for integrating Flowstral Recorder with Visual Editor

/**
 * Convert Flowstral Recorder events to Visual Editor workflow format
 */
export function recorderToVisualWorkflow(recordedEvents, workflowName = 'Recorded Workflow') {
  // Auto-layout nodes vertically with proper spacing
  const NODE_SPACING = 130;
  const START_X = 250;
  const START_Y = 50;

  const nodes = recordedEvents.map((event, index) => {
    const nodeId = String(index + 1);
    
    return {
      id: nodeId,
      position: { 
        x: START_X, 
        y: START_Y + (index * NODE_SPACING) 
      },
      data: {
        type: mapEventTypeToNodeType(event.type),
        label: event.label || generateLabel(event),
        selector: event.selector || '',
        value: event.value || '',
        url: event.url || '',
        timestamp: event.timestamp
      }
    };
  });

  // Auto-connect nodes sequentially
  const edges = recordedEvents.slice(0, -1).map((_, index) => ({
    id: `e${index + 1}-${index + 2}`,
    source: String(index + 1),
    target: String(index + 2)
  }));

  return {
    name: workflowName,
    nodes,
    edges,
    metadata: {
      source: 'flowstral-recorder',
      recordedAt: new Date().toISOString(),
      totalSteps: nodes.length
    }
  };
}

/**
 * Map recorder event types to visual editor node types
 */
function mapEventTypeToNodeType(eventType) {
  const typeMap = {
    'page.goto': 'navigate',
    'click': 'click',
    'fill': 'input',
    'type': 'input',
    'press': 'input',
    'check': 'click',
    'uncheck': 'click',
    'selectOption': 'click',
    'waitForSelector': 'wait',
    'waitForTimeout': 'wait',
    'expect': 'assert',
    'assert': 'assert'
  };

  return typeMap[eventType] || 'click';
}

/**
 * Generate a human-readable label from event data
 */
function generateLabel(event) {
  const labels = {
    'page.goto': `Navigate to ${extractDomain(event.url)}`,
    'click': `Click ${event.targetText || 'element'}`,
    'fill': `Enter "${event.value}" in ${event.targetText || 'field'}`,
    'type': `Type "${event.value}"`,
    'check': `Check ${event.targetText || 'checkbox'}`,
    'uncheck': `Uncheck ${event.targetText || 'checkbox'}`,
    'waitForSelector': `Wait for ${event.selector}`,
    'waitForTimeout': `Wait ${event.value}ms`,
    'expect': `Verify ${event.selector}`,
  };

  return labels[event.type] || `${event.type} action`;
}

/**
 * Extract domain from URL for cleaner labels
 */
function extractDomain(url) {
  if (!url) return 'page';
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Convert Visual Editor workflow back to Playwright code
 */
export function visualWorkflowToPlaywright(workflow) {
  let script = `import { test, expect } from '@playwright/test';\n\n`;
  script += `test('${workflow.name}', async ({ page }) => {\n`;

  // Sort nodes by Y position (top to bottom)
  const sortedNodes = [...workflow.nodes].sort((a, b) => a.position.y - b.position.y);

  sortedNodes.forEach((node) => {
    const { type, label, selector, value, url } = node.data;
    
    script += `  // ${label}\n`;
    
    switch (type) {
      case 'navigate':
        script += `  await page.goto('${url}');\n`;
        break;
      case 'click':
        script += `  await ${selector}.click();\n`;
        break;
      case 'input':
        script += `  await ${selector}.fill('${value}');\n`;
        break;
      case 'wait':
        const waitValue = parseInt(value) || 1000;
        script += `  await page.waitForTimeout(${waitValue});\n`;
        break;
      case 'assert':
        script += `  await expect(${selector}).toBeVisible();\n`;
        break;
      case 'condition':
        script += `  if (await ${selector}.isVisible()) {\n`;
        script += `    // TODO: Add conditional logic\n`;
        script += `  }\n`;
        break;
      case 'loop':
        script += `  for (let i = 0; i < ${value || 1}; i++) {\n`;
        script += `    // TODO: Add loop logic\n`;
        script += `  }\n`;
        break;
    }
    script += '\n';
  });

  script += `});\n`;
  return script;
}

/**
 * Example: Convert a typical recording session
 */
export function exampleRecordingConversion() {
  // Simulated events from Flowstral Recorder
  const recordedEvents = [
    {
      type: 'page.goto',
      url: 'https://example.com/login',
      timestamp: Date.now()
    },
    {
      type: 'fill',
      selector: "page.getByLabel('Email')",
      value: 'user@example.com',
      targetText: 'Email',
      timestamp: Date.now() + 1000
    },
    {
      type: 'fill',
      selector: "page.getByLabel('Password')",
      value: 'password123',
      targetText: 'Password',
      timestamp: Date.now() + 2000
    },
    {
      type: 'click',
      selector: "page.getByRole('button', { name: 'Login' })",
      targetText: 'Login',
      timestamp: Date.now() + 3000
    },
    {
      type: 'expect',
      selector: "page.getByText('Welcome')",
      targetText: 'Welcome message',
      timestamp: Date.now() + 4000
    }
  ];

  // Convert to visual workflow
  const visualWorkflow = recorderToVisualWorkflow(recordedEvents, 'Login Flow');
  
  console.log('Visual Workflow:', JSON.stringify(visualWorkflow, null, 2));
  
  // Convert to Playwright
  const playwrightCode = visualWorkflowToPlaywright(visualWorkflow);
  
  console.log('Playwright Code:', playwrightCode);
  
  return { visualWorkflow, playwrightCode };
}

/**
 * Save workflow to file (browser download)
 */
export function downloadWorkflow(workflow, filename) {
  const blob = new Blob([JSON.stringify(workflow, null, 2)], { 
    type: 'application/json' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${workflow.name.replace(/\s+/g, '_')}_workflow.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Load workflow from file (browser upload)
 */
export function loadWorkflow(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target.result);
        resolve(workflow);
      } catch (error) {
        reject(new Error('Invalid workflow file: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Validate workflow structure
 */
export function validateWorkflow(workflow) {
  const errors = [];

  if (!workflow.name) errors.push('Missing workflow name');
  if (!Array.isArray(workflow.nodes)) errors.push('Invalid nodes array');
  if (!Array.isArray(workflow.edges)) errors.push('Invalid edges array');

  workflow.nodes?.forEach((node, index) => {
    if (!node.id) errors.push(`Node ${index} missing ID`);
    if (!node.position) errors.push(`Node ${index} missing position`);
    if (!node.data) errors.push(`Node ${index} missing data`);
    if (!node.data?.type) errors.push(`Node ${index} missing type`);
  });

  workflow.edges?.forEach((edge, index) => {
    if (!edge.source) errors.push(`Edge ${index} missing source`);
    if (!edge.target) errors.push(`Edge ${index} missing target`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// Example usage in browser extension (Flowstral Recorder)
/*
// In your recorder's background script or popup:

import { recorderToVisualWorkflow, downloadWorkflow } from './integration-utils.js';

// When user clicks "Export to Visual Editor"
function exportToVisualEditor() {
  const recordedEvents = getRecordedEvents(); // Your recorder's event list
  const workflow = recorderToVisualWorkflow(recordedEvents, 'My Test');
  
  // Option 1: Download JSON file
  downloadWorkflow(workflow);
  
  // Option 2: Open in visual editor web app
  const workflowData = encodeURIComponent(JSON.stringify(workflow));
  window.open(`https://your-editor.com?import=${workflowData}`);
  
  // Option 3: Send to API
  fetch('https://your-editor.com/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow)
  });
}
*/
