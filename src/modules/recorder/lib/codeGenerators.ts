/**
 * Code generation utilities for exporting recorded actions
 * to various test frameworks (Playwright, Cypress, Selenium, Robot Framework)
 * and CSV format.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

/** Generate Playwright test code from recorded actions */
export const generatePlaywrightCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
  await page.goto('${startUrl}');
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `  await page.fill('${selector}', '${value}');\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `  await page.click('${selector || `text=${action.args?.[0]}`}');\n`;
        break;
      case 'goto':
        code += `  await page.goto('${action.args?.[0]}');\n`;
        break;
      default:
        code += `  // ${action.description || action.qword}\n`;
    }
  });
  code += '});\n';
  return code;
};

/** Generate Cypress test code from recorded actions */
export const generateCypressCode = (acts: RecordedAction[], startUrl: string): string => {
  let code = `describe('Recorded Test', () => {
  it('should complete the test flow', () => {
    cy.visit('${startUrl}');
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `    cy.get('${selector}').type('${value}');\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `    cy.${selector ? `get('${selector}')` : `contains('${action.args?.[0]}')`}.click();\n`;
        break;
      case 'goto':
        code += `    cy.visit('${action.args?.[0]}');\n`;
        break;
      default:
        code += `    // ${action.description || action.qword}\n`;
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
    driver.get('${startUrl}')
    wait = WebDriverWait(driver, 10)
`;
  acts.forEach(action => {
    const selector = action.selectorObj?.selector || action.args?.[1] || '';
    const value = action.args?.[1] || action.args?.[0] || '';
    switch (action.qword?.toLowerCase()) {
      case 'fill':
        code += `    driver.find_element(By.CSS_SELECTOR, '${selector}').send_keys('${value}')\n`;
        break;
      case 'click':
      case 'clicktext':
        code += `    driver.find_element(By.CSS_SELECTOR, '${selector}').click()\n`;
        break;
      case 'goto':
        code += `    driver.get('${action.args?.[0]}')\n`;
        break;
      default:
        code += `    # ${action.description || action.qword}\n`;
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
        code += `    Click Element    ${selector || `//\*[contains(text(),'${action.args?.[0]}')]`}\n`;
        break;
      case 'goto':
        code += `    Go To    ${action.args?.[0]}\n`;
        break;
      default:
        code += `    # ${action.description || action.qword}\n`;
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
    csv += `${i + 1},"${action.qword}","${action.args?.[0] || ''}","${action.args?.[1] || ''}","${action.description || ''}"\n`;
  });
  return csv;
};
