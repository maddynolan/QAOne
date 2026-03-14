/**
 * Code generation utilities for exporting recorded actions
 * to various test frameworks (Playwright, Cypress, Selenium, Robot Framework)
 * and CSV format.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

/**
 * Escape single quotes in a string for safe embedding in JS/Python single-quoted strings.
 * Prevents code injection when user-provided selectors or values contain single quotes.
 */
const escapeJS = (str: string): string => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/**
 * Escape double quotes for CSV fields.
 */
const escapeCSV = (str: string): string => (str || '').replace(/"/g, '""');

/** Generate Playwright test code from recorded actions */
export const generatePlaywrightCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
  await page.goto('${escapeJS(startUrl)}');
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `  await page.fill('${escapeJS(selector)}', '${escapeJS(value)}');\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `  await page.click('${escapeJS(selector || `text=${action.args?.[0] || ''}`)}');\n`;
        break;
      case 'goto':
        code += `  await page.goto('${escapeJS(action.args?.[0] || '')}');\n`;
        break;
      default:
        code += `  // ${(action.description || action.qword || '').replace(/\n/g, ' ')}\n`;
    }
  });
  code += '});\n';
  return code;
};

/** Generate Cypress test code from recorded actions */
export const generateCypressCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `describe('Recorded Test', () => {
  it('should complete the test flow', () => {
    cy.visit('${escapeJS(startUrl)}');
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `    cy.get('${escapeJS(selector)}').type('${escapeJS(value)}');\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `    cy.${selector ? `get('${escapeJS(selector)}')` : `contains('${escapeJS(action.args?.[0] || '')}')`}.click();\n`;
        break;
      case 'goto':
        code += `    cy.visit('${escapeJS(action.args?.[0] || '')}');\n`;
        break;
      default:
        code += `    // ${(action.description || action.qword || '').replace(/\n/g, ' ')}\n`;
    }
  });
  code += `  });
});
`;
  return code;
};

/** Generate Selenium (Python) test code from recorded actions */
export const generateSeleniumCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_recorded():
    driver = webdriver.Chrome()
    driver.get('${escapeJS(startUrl)}')
    wait = WebDriverWait(driver, 10)
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `    driver.find_element(By.CSS_SELECTOR, '${escapeJS(selector)}').send_keys('${escapeJS(value)}')\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `    driver.find_element(By.CSS_SELECTOR, '${escapeJS(selector)}').click()\n`;
        break;
      case 'goto':
        code += `    driver.get('${escapeJS(action.args?.[0] || '')}')\n`;
        break;
      default:
        code += `    # ${(action.description || action.qword || '').replace(/\n/g, ' ')}\n`;
    }
  });
  code += `    driver.quit()
`;
  return code;
};

/** Generate Robot Framework test code from recorded actions */
export const generateRobotCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `*** Settings ***
Library    SeleniumLibrary

*** Test Cases ***
Recorded Test
    Open Browser    ${startUrl}    chrome
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `    Input Text    ${selector}    ${value}\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `    Click Element    ${selector || `//\*[contains(text(),'${escapeJS(action.args?.[0] || '')}')]`}\n`;
        break;
      case 'goto':
        code += `    Go To    ${action.args?.[0] || ''}\n`;
        break;
      default:
        code += `    # ${(action.description || action.qword || '').replace(/\n/g, ' ')}\n`;
    }
  });
  code += `    Close Browser
`;
  return code;
};

/** Convert recorded actions to CSV format */
export const actionsToCSV = (acts: RecordedAction[]): string => {
  let csv = 'Step,Action,Target,Value,Description\n';
  acts.forEach((action, i) => {
    csv += `${i + 1},"${escapeCSV(action.qword || '')}","${escapeCSV(action.args?.[0] || '')}","${escapeCSV(action.args?.[1] || '')}","${escapeCSV(action.description || '')}"\n`;
  });
  return csv;
};
