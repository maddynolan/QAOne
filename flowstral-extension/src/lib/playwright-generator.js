/**
 * PlaywrightGenerator - Generates clean, maintainable Playwright test scripts
 * Includes intelligent wait strategies, assertions, and Page Object Model support
 */

class PlaywrightGenerator {
  constructor(options = {}) {
    this.options = {
      includeComments: true,
      generateAssertions: true,
      usePageObjectModel: false,
      browserType: 'chromium',
      headless: false,
      slowMo: 0,
      timeout: 30000,
      screenshotOnFailure: true,
      ...options
    };
  }

  /**
   * Generate a complete Playwright test script from recorded actions
   */
  generate(recording) {
    const { actions, metadata } = recording;
    
    let script = this.generateImports();
    script += this.generateTestSetup(metadata);
    script += this.generateTestBody(actions);
    script += this.generateTestTeardown();
    
    return this.formatScript(script);
  }

  generateImports() {
    return `import { test, expect } from '@playwright/test';

`;
  }

  generateTestSetup(metadata) {
    const { startUrl, title, timestamp } = metadata;
    const testName = title || `Recorded test - ${new Date(timestamp).toLocaleString()}`;
    
    let setup = '';
    
    if (this.options.includeComments) {
      setup += `/**
 * ${testName}
 * Recorded on: ${new Date(timestamp).toISOString()}
 * Starting URL: ${startUrl}
 */
`;
    }

    setup += `test('${this.escapeString(testName)}', async ({ page }) => {
  // Configure test timeout
  test.setTimeout(${this.options.timeout});
  
  // Navigate to starting URL
  await page.goto('${this.escapeString(startUrl)}');
  await page.waitForLoadState('networkidle');
  
`;
    return setup;
  }

  generateTestBody(actions) {
    let body = '';
    let previousAction = null;
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const nextAction = actions[i + 1];
      
      // Skip redundant actions
      if (this.isRedundantAction(action, previousAction)) {
        continue;
      }

      // Add comment for action context
      if (this.options.includeComments && action.description) {
        body += `  // ${action.description}\n`;
      }

      // Generate the action code
      body += this.generateActionCode(action, nextAction);
      
      // Add intelligent waits
      body += this.generateWaitCode(action, nextAction);
      
      // Add assertions if enabled
      if (this.options.generateAssertions) {
        body += this.generateAssertionCode(action);
      }
      
      body += '\n';
      previousAction = action;
    }
    
    return body;
  }

  generateActionCode(action, nextAction) {
    const selector = this.formatSelector(action.selector);
    
    switch (action.type) {
      case 'click':
        return this.generateClickCode(action, selector);
      
      case 'dblclick':
        return `  await page.${selector}.dblclick();\n`;
      
      case 'type':
      case 'input':
        return this.generateTypeCode(action, selector);
      
      case 'fill':
        return `  await page.${selector}.fill('${this.escapeString(action.value)}');\n`;
      
      case 'clear':
        return `  await page.${selector}.clear();\n`;
      
      case 'select':
        return this.generateSelectCode(action, selector);
      
      case 'check':
        return `  await page.${selector}.check();\n`;
      
      case 'uncheck':
        return `  await page.${selector}.uncheck();\n`;
      
      case 'hover':
        return `  await page.${selector}.hover();\n`;
      
      case 'focus':
        return `  await page.${selector}.focus();\n`;
      
      case 'press':
        return `  await page.${selector}.press('${action.key}');\n`;
      
      case 'keyboard':
        return `  await page.keyboard.${action.method}('${this.escapeString(action.key)}');\n`;
      
      case 'navigate':
        return `  await page.goto('${this.escapeString(action.url)}');\n`;
      
      case 'goBack':
        return `  await page.goBack();\n`;
      
      case 'goForward':
        return `  await page.goForward();\n`;
      
      case 'reload':
        return `  await page.reload();\n`;
      
      case 'scroll':
        return this.generateScrollCode(action, selector);
      
      case 'upload':
        return `  await page.${selector}.setInputFiles('${this.escapeString(action.files)}');\n`;
      
      case 'drag':
        return this.generateDragCode(action);
      
      case 'frame':
        return this.generateFrameCode(action);
      
      case 'screenshot':
        return `  await page.screenshot({ path: '${action.filename || 'screenshot.png'}' });\n`;
      
      case 'wait':
        return `  await page.waitForTimeout(${action.duration || 1000});\n`;
      
      default:
        return `  // Unknown action: ${action.type}\n`;
    }
  }

  generateClickCode(action, selector) {
    let code = `  await page.${selector}.click(`;
    
    const options = [];
    if (action.button && action.button !== 'left') {
      options.push(`button: '${action.button}'`);
    }
    if (action.modifiers && action.modifiers.length > 0) {
      options.push(`modifiers: [${action.modifiers.map(m => `'${m}'`).join(', ')}]`);
    }
    if (action.clickCount && action.clickCount > 1) {
      options.push(`clickCount: ${action.clickCount}`);
    }
    if (action.position) {
      options.push(`position: { x: ${action.position.x}, y: ${action.position.y} }`);
    }
    
    if (options.length > 0) {
      code += `{ ${options.join(', ')} }`;
    }
    
    code += ');\n';
    return code;
  }

  generateTypeCode(action, selector) {
    const value = action.value || '';
    
    // Use fill for complete text entry (faster and more reliable)
    if (!action.pressEnter && value.length > 0) {
      return `  await page.${selector}.fill('${this.escapeString(value)}');\n`;
    }
    
    // Use type for character-by-character input with key events
    let code = `  await page.${selector}.type('${this.escapeString(value)}'`;
    
    if (action.delay) {
      code += `, { delay: ${action.delay} }`;
    }
    
    code += ');\n';
    
    if (action.pressEnter) {
      code += `  await page.${selector}.press('Enter');\n`;
    }
    
    return code;
  }

  generateSelectCode(action, selector) {
    const { value, label, index } = action;
    
    if (label) {
      return `  await page.${selector}.selectOption({ label: '${this.escapeString(label)}' });\n`;
    }
    if (value) {
      return `  await page.${selector}.selectOption('${this.escapeString(value)}');\n`;
    }
    if (index !== undefined) {
      return `  await page.${selector}.selectOption({ index: ${index} });\n`;
    }
    
    return `  await page.${selector}.selectOption('${this.escapeString(action.selectedValue || '')}');\n`;
  }

  generateScrollCode(action, selector) {
    if (action.target === 'page') {
      return `  await page.evaluate(() => window.scrollTo(${action.x || 0}, ${action.y || 0}));\n`;
    }
    
    if (action.target === 'element') {
      return `  await page.${selector}.scrollIntoViewIfNeeded();\n`;
    }
    
    return `  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollTo(${action.x || 0}, ${action.y || 0});
  }, '${this.escapeString(action.selector?.selector || '')}');\n`;
  }

  generateDragCode(action) {
    const sourceSelector = this.formatSelector(action.source);
    const targetSelector = this.formatSelector(action.target);
    
    return `  await page.${sourceSelector}.dragTo(page.${targetSelector});\n`;
  }

  generateFrameCode(action) {
    let frameLocator = '';
    
    if (action.frameName) {
      frameLocator = `frameLocator('[name="${action.frameName}"]')`;
    } else if (action.frameUrl) {
      frameLocator = `frameLocator('iframe[src*="${action.frameUrl}"]')`;
    } else if (action.frameIndex !== undefined) {
      frameLocator = `frameLocator('iframe').nth(${action.frameIndex})`;
    }
    
    return `  const frame = page.${frameLocator};\n`;
  }

  generateWaitCode(action, nextAction) {
    let waitCode = '';
    
    // Add wait after navigation
    if (action.type === 'navigate' || action.triggersNavigation) {
      waitCode += `  await page.waitForLoadState('networkidle');\n`;
    }
    
    // Add wait for element after click that might trigger content changes
    if (action.type === 'click' && action.mightTriggerChange) {
      if (nextAction && nextAction.selector) {
        const nextSelector = this.formatSelector(nextAction.selector);
        waitCode += `  await page.${nextSelector}.waitFor({ state: 'visible' });\n`;
      } else {
        waitCode += `  await page.waitForLoadState('domcontentloaded');\n`;
      }
    }
    
    // Wait after form submission
    if (action.type === 'press' && action.key === 'Enter' && action.isInForm) {
      waitCode += `  await page.waitForLoadState('networkidle');\n`;
    }
    
    return waitCode;
  }

  generateAssertionCode(action) {
    let assertions = '';
    
    // Assert element is visible after click
    if (action.type === 'click' && action.expectedVisible) {
      assertions += `  await expect(page.${this.formatSelector(action.expectedVisible)}).toBeVisible();\n`;
    }
    
    // Assert URL after navigation
    if (action.type === 'navigate' || action.triggersNavigation) {
      if (action.expectedUrl) {
        assertions += `  await expect(page).toHaveURL(/${this.escapeRegex(action.expectedUrl)}/);\n`;
      }
    }
    
    // Assert value after input
    if ((action.type === 'type' || action.type === 'fill') && action.value) {
      assertions += `  await expect(page.${this.formatSelector(action.selector)}).toHaveValue('${this.escapeString(action.value)}');\n`;
    }
    
    return assertions;
  }

  generateTestTeardown() {
    let teardown = '';
    
    if (this.options.screenshotOnFailure) {
      teardown += `  // Take screenshot on completion
  await page.screenshot({ path: 'test-complete.png', fullPage: true });
`;
    }
    
    teardown += `});
`;
    return teardown;
  }

  formatSelector(selectorData) {
    if (!selectorData) return "locator('body')";
    
    // Use the Playwright-specific format if available
    if (selectorData.playwright) {
      return selectorData.playwright;
    }
    
    // Fall back to CSS selector
    if (selectorData.selector) {
      return `locator('${this.escapeString(selectorData.selector)}')`;
    }
    
    // Handle string selectors
    if (typeof selectorData === 'string') {
      return `locator('${this.escapeString(selectorData)}')`;
    }
    
    return "locator('body')";
  }

  isRedundantAction(action, previousAction) {
    if (!previousAction) return false;
    
    // Skip consecutive identical clicks within 100ms
    if (action.type === 'click' && previousAction.type === 'click') {
      if (action.selector?.selector === previousAction.selector?.selector) {
        if (action.timestamp - previousAction.timestamp < 100) {
          return true;
        }
      }
    }
    
    // Skip focus events before type events on same element
    if (action.type === 'focus' && previousAction.type === 'click') {
      if (action.selector?.selector === previousAction.selector?.selector) {
        return true;
      }
    }
    
    return false;
  }

  formatScript(script) {
    // Clean up extra blank lines
    return script.replace(/\n{3,}/g, '\n\n');
  }

  escapeString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate a Page Object Model structure
   */
  generatePageObjectModel(recording) {
    const { actions, metadata } = recording;
    const pageObjects = this.extractPageObjects(actions);
    
    let output = '';
    
    // Generate page object classes
    for (const [pageName, elements] of Object.entries(pageObjects)) {
      output += this.generatePageClass(pageName, elements);
    }
    
    // Generate the test using page objects
    output += this.generateTestWithPageObjects(recording, pageObjects);
    
    return output;
  }

  extractPageObjects(actions) {
    const pages = {};
    let currentPage = 'HomePage';
    
    for (const action of actions) {
      if (action.type === 'navigate') {
        currentPage = this.urlToPageName(action.url);
      }
      
      if (!pages[currentPage]) {
        pages[currentPage] = new Map();
      }
      
      if (action.selector) {
        const elementName = this.generateElementName(action);
        pages[currentPage].set(elementName, action.selector);
      }
    }
    
    return pages;
  }

  generatePageClass(pageName, elements) {
    let pageClass = `class ${pageName} {
  constructor(page) {
    this.page = page;
`;
    
    for (const [name, selector] of elements) {
      pageClass += `    this.${name} = page.${this.formatSelector(selector)};
`;
    }
    
    pageClass += `  }
}

`;
    return pageClass;
  }

  urlToPageName(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/\//g, ' ').trim();
      if (!path || path === '/') return 'HomePage';
      return path
        .split(' ')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('') + 'Page';
    } catch {
      return 'HomePage';
    }
  }

  generateElementName(action) {
    if (action.description) {
      return this.toCamelCase(action.description);
    }
    
    const type = action.type;
    const random = Math.random().toString(36).substring(7);
    return `${type}Element_${random}`;
  }

  toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map((word, index) => 
        index === 0 
          ? word.toLowerCase() 
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  generateTestWithPageObjects(recording, pageObjects) {
    // Implementation for POM-based test generation
    return '// Page Object Model test generation\n';
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.PlaywrightGenerator = PlaywrightGenerator;
}

if (typeof module !== 'undefined') {
  module.exports = { PlaywrightGenerator };
}
