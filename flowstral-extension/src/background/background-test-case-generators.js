/**
 * Background Test Case Generators
 * Generates ISTQB, Gherkin, and Markdown test case formats
 * Extracted from background.js for modularity
 */

function bgGenerateTestCases(actions, format, testName, metadata) {
  switch (format) {
    case 'istqb': return bgGenerateISTQB(actions, testName, metadata);
    case 'gherkin': return bgGenerateGherkin(actions, testName, metadata);
    case 'markdown': return bgGenerateMarkdown(actions, testName, metadata);
    default: return bgGenerateMarkdown(actions, testName, metadata);
  }
}

function bgGenerateISTQB(actions, testName, metadata) {
  const border = '\u2550'.repeat(76);
  const appType = (metadata && metadata.appType) || 'generic';
  let output = `
\u2554${border}\u2557
\u2551${'TEST CASE SPECIFICATION'.padStart(49).padEnd(76)}\u2551
\u2560${border}\u2563
\u2551 Test Case ID    : TC_${Date.now().toString().slice(-8).padEnd(56)}\u2551
\u2551 Title           : ${testName.substring(0, 56).padEnd(56)}\u2551
\u2551 App Type        : ${appType.padEnd(56)}\u2551
\u2551 Priority        : ${'Medium'.padEnd(56)}\u2551
\u2551 Estimated Time  : ${(Math.ceil(actions.length * 0.25) + ' minutes').padEnd(56)}\u2551
\u2560${border}\u2563
\u2551 PRECONDITIONS                                                                \u2551
\u2560${border}\u2563
\u2551 1. Application is accessible and functional                                  \u2551
\u2551 2. User has valid credentials (if required)                                  \u2551
\u2551 3. Test environment is stable                                                \u2551
\u2560${border}\u2563
\u2551 TEST STEPS                                                                   \u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u2566${'═'.repeat(38)}\u2566${'═'.repeat(31)}\u2563
\u2551 #   \u2551 ACTION${' '.repeat(32)}\u2551 EXPECTED RESULT${' '.repeat(15)}\u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u256C${'─'.repeat(38)}\u256C${'─'.repeat(31)}\u2563
`;

  let stepNum = 1;
  actions.forEach((action, i) => {
    if (action.type === 'navigate' && i > 0) return;

    const actionText = bgFormatActionText(action).substring(0, 36).padEnd(36);
    const expected = bgFormatExpectedResult(action).substring(0, 29).padEnd(29);
    output += `\u2551 ${stepNum.toString().padEnd(3)} \u2551 ${actionText} \u2551 ${expected} \u2551\n`;
    stepNum++;
  });

  output += `\u2560\u2550\u2550\u2550\u2550\u2550\u2569${'═'.repeat(38)}\u2569${'═'.repeat(31)}\u2563
\u2551 POSTCONDITIONS                                                               \u2551
\u2560${border}\u2563
\u2551 1. System returns to stable state                                            \u2551
\u2551 2. No error messages displayed                                               \u2551
\u255A${border}\u255D
`;
  return output;
}

function bgGenerateGherkin(actions, testName, metadata) {
  const featureName = testName.replace(/[-_]/g, ' ');
  const appType = (metadata && metadata.appType) || 'generic';
  const language = (metadata && metadata.language) || 'typescript';

  let output = `@automated @${appType.replace('-', '_')}
Feature: ${featureName}
  As a user
  I want to complete the workflow
  So that I can achieve my goal

  Background:
    Given the application is accessible
    And all prerequisites are met

  @smoke @e2e
  Scenario: ${testName}
`;

  let isFirst = true;
  for (const action of actions) {
    if (action.type === 'navigate' && !isFirst) continue;

    let keyword;
    if (action.type === 'navigate') {
      keyword = 'Given';
    } else {
      keyword = isFirst ? 'When' : 'And';
      isFirst = false;
    }

    output += `    ${keyword} ${bgFormatGherkinStep(action)}\n`;
  }

  output += `\n  # Step Definitions Reference (${language === 'python' ? 'Behave/pytest-bdd' : 'Cucumber.js'})
  # This scenario was auto-generated from recorded actions
`;

  return output;
}

function bgGenerateMarkdown(actions, testName, metadata) {
  const appType = (metadata && metadata.appType) || 'generic';
  const language = (metadata && metadata.language) || 'typescript';

  let output = `# Test Case: ${testName}\n\n`;

  output += `## Overview\n\n`;
  output += `| Property | Value |\n|----------|-------|\n`;
  output += `| **Test ID** | TC_${Date.now().toString().slice(-8)} |\n`;
  output += `| **App Type** | ${appType} |\n`;
  output += `| **Generated** | ${new Date().toISOString()} |\n`;
  output += `| **Language** | ${language === 'python' ? 'Python' : 'TypeScript'} |\n`;
  output += `| **Steps** | ${actions.length} |\n\n`;

  output += `## Preconditions\n\n`;
  output += `- Application is accessible\n`;
  output += `- User has required permissions\n`;
  output += `- Test environment is stable\n\n`;

  output += `## Test Steps\n\n`;
  output += `| # | Action | Test Data | Expected Result |\n`;
  output += `|---|--------|-----------|----------------|\n`;

  actions.forEach((action, i) => {
    const actionText = bgFormatActionText(action);
    const data = action.value || action.text || '-';
    const expected = bgFormatExpectedResult(action);
    output += `| ${i + 1} | ${actionText} | ${data} | ${expected} |\n`;
  });

  output += `\n## Automation Code\n\n`;
  output += `The test script is available in ${language === 'python' ? 'Python' : 'TypeScript'} format.\n`;
  output += `Download using the extension's Generate tab.\n`;

  output += `\n## Notes\n\n`;
  output += `- This test case was auto-generated from browser recording\n`;
  output += `- Review and adjust expected results for your specific requirements\n`;
  output += `- Add assertions as needed for validation\n`;

  return output;
}

function bgFormatActionText(action) {
  switch (action.type) {
    case 'navigate': return `Navigate to page`;
    case 'click': return `Click ${action.text?.substring(0, 25) || action.description?.substring(0, 25) || 'element'}`;
    case 'fill': return `Enter "${action.value?.substring(0, 15) || ''}"`;
    case 'check': return `Select ${action.text?.substring(0, 25) || 'option'}`;
    case 'uncheck': return `Deselect option`;
    case 'select': return `Choose "${action.value?.substring(0, 15) || ''}"`;
    case 'press': return `Press ${action.key} key`;
    default: return action.type;
  }
}

function bgFormatExpectedResult(action) {
  switch (action.type) {
    case 'navigate': return 'Page loads successfully';
    case 'click': return 'Element responds';
    case 'fill': return 'Field accepts input';
    case 'check': return 'Option is selected';
    case 'uncheck': return 'Option is deselected';
    case 'select': return 'Value is selected';
    case 'press': return 'Key action registered';
    default: return 'Success';
  }
}

function bgFormatGherkinStep(action) {
  switch (action.type) {
    case 'navigate': return `I am on the application page`;
    case 'click': return `I click on "${action.text?.substring(0, 30) || action.description?.substring(0, 30) || 'the element'}"`;
    case 'fill': return `I enter "${action.value || 'value'}" in the input field`;
    case 'check': return `I select the "${action.text?.substring(0, 30) || 'option'}"`;
    case 'uncheck': return `I deselect the option`;
    case 'select': return `I choose "${action.value || 'value'}" from the dropdown`;
    case 'press': return `I press the "${action.key}" key`;
    default: return `I perform ${action.type} action`;
  }
}
