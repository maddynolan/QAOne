/**
 * Playwright Export - Generate Playwright test code from recorded actions
 */

/**
 * Escape a string for use in JavaScript code
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeString(str) {
  return (str || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/**
 * Generate Playwright test code from actions
 * @param {Array} actions - Array of QWord actions
 * @param {string} testName - Name of the test
 * @returns {string} Playwright test code
 */
function generatePlaywrightCode(actions, testName = 'Recorded Test') {
  let code = `// Flowstral Generated Test\n`;
  code += `// Generated on: ${new Date().toISOString()}\n`;
  code += `import { test, expect } from '@playwright/test';\n\n`;
  code += `test('${escapeString(testName)}', async ({ page }) => {\n`;
  code += `  // Set default timeout\n`;
  code += `  test.setTimeout(60000);\n\n`;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    // Add comment for context
    if (action.description) {
      code += `  // ${action.description}\n`;
    }
    
    code += generateStepCode(action);
    code += `  await page.waitForTimeout(500);\n\n`;
  }
  
  code += `});\n`;
  return code;
}

/**
 * Generate code for a single step
 * @param {Object} action - QWord action
 * @returns {string} Code for this step
 */
function generateStepCode(action) {
  const selectorObj = action.selectorObj || {};
  
  switch (action.qword) {
    case 'GoTo':
      return `  await page.goto('${escapeString(action.args[0])}');\n` +
             `  await page.waitForLoadState('networkidle');\n`;
    
    case 'ClickText': {
      const clickText = escapeString(action.args[0]);
      return `  await page.getByText('${clickText}', { exact: false }).first().click();\n`;
    }
    
    case 'ClickElement': {
      const clickSelector = selectorObj.selector || action.selector?.value || action.args[0];
      return `  await page.locator('${escapeString(clickSelector)}').first().click();\n`;
    }
    
    case 'Fill': {
      const fieldLabel = escapeString(action.args[0]);
      const fieldValue = escapeString(action.args[1]);
      
      // Use best available selector
      if (selectorObj.selector) {
        return `  await page.locator('${escapeString(selectorObj.selector)}').fill('${fieldValue}');\n`;
      } else if (action.selector?.value) {
        return `  await page.locator('${escapeString(action.selector.value)}').fill('${fieldValue}');\n`;
      } else {
        return `  await page.getByLabel('${fieldLabel}').fill('${fieldValue}');\n`;
      }
    }
    
    case 'Select': {
      const selectLabel = escapeString(action.args[0]);
      const selectValue = escapeString(action.args[1]);
      const selectSelector = selectorObj.selector || action.selector?.value;
      if (selectSelector) {
        return `  await page.locator('${selectSelector}').selectOption('${selectValue}');\n`;
      } else {
        return `  await page.getByLabel('${selectLabel}').selectOption('${selectValue}');\n`;
      }
    }
    
    case 'Check': {
      const checkLabel = escapeString(action.args[0]);
      const checkSelector = selectorObj.selector || action.selector?.value;
      if (checkSelector) {
        return `  await page.locator('${checkSelector}').check();\n`;
      } else {
        return `  await page.getByLabel('${checkLabel}').check();\n`;
      }
    }
    
    case 'Uncheck': {
      const uncheckLabel = escapeString(action.args[0]);
      const uncheckSelector = selectorObj.selector || action.selector?.value;
      if (uncheckSelector) {
        return `  await page.locator('${uncheckSelector}').uncheck();\n`;
      } else {
        return `  await page.getByLabel('${uncheckLabel}').uncheck();\n`;
      }
    }
    
    case 'AssertText': {
      const assertText = escapeString(action.args[0]);
      return `  await expect(page.getByText('${assertText}')).toBeVisible();\n`;
    }
    
    case 'Wait': {
      const waitTime = parseInt(action.args[0], 10);
      return `  await page.waitForTimeout(${waitTime});\n`;
    }
    
    default:
      return `  // Unsupported action: ${action.qword}\n`;
  }
}

/**
 * Generate test case object for Test Builder
 * @param {Array} actions - Array of QWord actions
 * @param {string} testName - Name of the test
 * @returns {Object} Test case object
 */
function generateTestCase(actions, testName = 'Recorded Test') {
  const { mapQWordToStepType, buildSelectorObject } = require('./action-converter');
  
  return {
    id: `tc_${Date.now()}`,
    name: testName,
    description: `Recorded on ${new Date().toISOString()}`,
    tags: ['recorded', 'desktop'],
    steps: actions.map((action, idx) => {
      const selectorObj = action.selectorObj || buildSelectorObject({ element: action.raw?.element });
      const cssSelector = selectorObj.selector || '';
      
      return {
        id: action.id || `step_${Date.now()}_${idx}`,
        type: mapQWordToStepType(action.qword),
        name: action.name || action.description || `Step ${idx + 1}`,
        url: action.qword === 'GoTo' ? action.args[0] : '',
        selector: cssSelector,
        selectorObj: selectorObj,
        target: action.qword === 'Fill' ? action.args[0] : '',
        value: action.qword === 'Fill' ? action.args[1] : (action.args?.[0] || ''),
        qword: action.qword,
        args: action.args,
        displayArgs: action.displayArgs,
        enabled: true,
        expectedResult: action.qword === 'GoTo' ? 'Page loads successfully' : 
                        action.qword === 'Fill' ? 'Value entered successfully' :
                        action.qword === 'ClickText' ? 'Element clicked successfully' : '',
      };
    }),
    variables: [],
    settings: { timeout: 30000, retries: 0 },
    metadata: { 
      createdAt: new Date().toISOString(), 
      source: 'flowstral-desktop',
      recordedSteps: actions.length
    },
  };
}

module.exports = {
  escapeString,
  generatePlaywrightCode,
  generateStepCode,
  generateTestCase
};

