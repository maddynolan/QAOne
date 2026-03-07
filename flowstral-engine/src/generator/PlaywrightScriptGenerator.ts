/**
 * Flowstral - Playwright Script Generator
 * Generates robust, maintainable Playwright test scripts
 */

import {
  GeneratedScript,
  RecordingSession,
  RecordedAction,
  AutoHealingLocator,
  TestCase,
  TestStep,
  HelperFunction,
  ApplicationFingerprint,
  ActionType,
  EnterpriseApplication,
} from '../types';
import { AutoHealingLocatorEngine } from '../locators/AutoHealingLocatorEngine';
import { ApplicationHandlerFactory, ApplicationHandler } from '../handlers/ApplicationHandlers';

/**
 * Playwright Script Generator
 */
export class PlaywrightScriptGenerator {
  private fingerprint: ApplicationFingerprint;
  private locatorEngine: AutoHealingLocatorEngine;
  private appHandler: ApplicationHandler;
  private indentLevel: number = 0;

  constructor(fingerprint: ApplicationFingerprint) {
    this.fingerprint = fingerprint;
    this.locatorEngine = new AutoHealingLocatorEngine(fingerprint);
    this.appHandler = ApplicationHandlerFactory.getHandler(fingerprint);
  }

  /**
   * Generate complete Playwright test script from recording session
   */
  generateScript(session: RecordingSession): GeneratedScript {
    const imports = this.generateImports();
    const helpers = this.generateHelpers();
    const testCases = this.generateTestCases(session);
    const code = this.assembleScript(imports, helpers, testCases, session);

    return {
      language: 'typescript',
      framework: 'playwright',
      code,
      imports,
      helpers,
      testCases,
    };
  }

  /**
   * Generate required imports
   */
  private generateImports(): string[] {
    const imports = [
      "import { test, expect, Page, Locator, FrameLocator } from '@playwright/test';",
    ];

    if (this.fingerprint.shadowDomEnabled) {
      imports.push("// Shadow DOM support enabled for this application");
    }

    return imports;
  }

  /**
   * Generate helper functions
   */
  private generateHelpers(): HelperFunction[] {
    const helpers: HelperFunction[] = [];

    // Auto-healing locator helper
    helpers.push({
      name: 'findWithHealing',
      description: 'Auto-healing locator function that tries multiple strategies',
      code: `
async function findWithHealing(
  page: Page,
  strategies: { locator: string; type: string }[],
  timeout: number = 10000
): Promise<Locator> {
  for (const strategy of strategies) {
    try {
      let locator: Locator;
      
      switch (strategy.type) {
        case 'role':
          locator = page.getByRole(strategy.locator as any);
          break;
        case 'text':
          locator = page.getByText(strategy.locator);
          break;
        case 'label':
          locator = page.getByLabel(strategy.locator);
          break;
        case 'testid':
          locator = page.getByTestId(strategy.locator);
          break;
        case 'placeholder':
          locator = page.getByPlaceholder(strategy.locator);
          break;
        default:
          locator = page.locator(strategy.locator);
      }
      
      await locator.waitFor({ state: 'visible', timeout: 2000 });
      return locator;
    } catch (e) {
      console.log(\`Strategy \${strategy.type} failed, trying next...\`);
      continue;
    }
  }
  
  throw new Error(\`Element not found after trying \${strategies.length} strategies\`);
}`,
    });

    // Wait for stability helper
    helpers.push({
      name: 'waitForStability',
      description: 'Wait for application-specific stability',
      code: this.appHandler.getStabilityWaitCode(),
    });

    // Shadow DOM helper if needed
    if (this.fingerprint.shadowDomEnabled) {
      helpers.push({
        name: 'pierceShadowDom',
        description: 'Navigate through shadow DOM boundaries',
        code: this.appHandler.getShadowDomPiercingScript(),
      });
    }

    // Retry action helper
    helpers.push({
      name: 'retryAction',
      description: 'Retry an action with exponential backoff',
      code: `
async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(\`Attempt \${attempt + 1} failed, retrying in \${delay}ms...\`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}`,
    });

    return helpers;
  }

  /**
   * Generate test cases from recording session
   */
  private generateTestCases(session: RecordingSession): TestCase[] {
    const testCase: TestCase = {
      name: this.generateTestName(session),
      description: `Recorded on ${new Date(session.startTime).toISOString()}`,
      steps: [],
      assertions: [],
    };

    for (const action of session.actions) {
      const step = this.generateTestStep(action);
      if (step) {
        testCase.steps.push(step);
      }
    }

    return [testCase];
  }

  /**
   * Generate a single test step
   */
  private generateTestStep(action: RecordedAction): TestStep | null {
    if (!action.element && action.type !== 'navigate' && action.type !== 'wait') {
      return null;
    }

    let locator: AutoHealingLocator | undefined;
    let generatedCode: string;

    if (action.element) {
      // Transform element using app handler
      const transformedElement = this.appHandler.transformElement(action.element);
      locator = this.locatorEngine.generateAutoHealingLocator(transformedElement);
    }

    generatedCode = this.generateActionCode(action, locator);

    return {
      action,
      locator: locator!,
      generatedCode,
      comment: this.generateComment(action),
    };
  }

  /**
   * Generate code for a specific action
   */
  private generateActionCode(action: RecordedAction, locator?: AutoHealingLocator): string {
    const lines: string[] = [];
    const appConfig = this.appHandler.getConfig();

    switch (action.type) {
      case 'navigate':
        lines.push(`await page.goto('${this.escapeString(action.targetUrl || '')}');`);
        lines.push(`await page.waitForLoadState('networkidle');`);
        break;

      case 'click':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'click'));
        }
        break;

      case 'dblclick':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'dblclick'));
        }
        break;

      case 'rightclick':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'click', '{ button: "right" }'));
        }
        break;

      case 'fill':
        if (locator && action.value) {
          lines.push(...this.generateLocatorCode(locator, 'fill', `'${this.escapeString(action.value as string)}'`));
        }
        break;

      case 'type':
        if (locator && action.value) {
          lines.push(...this.generateLocatorCode(locator, 'type', `'${this.escapeString(action.value as string)}'`));
        }
        break;

      case 'clear':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'clear'));
        }
        break;

      case 'select':
        if (locator && action.value) {
          const values = Array.isArray(action.value) ? action.value : [action.value];
          lines.push(...this.generateLocatorCode(locator, 'selectOption', JSON.stringify(values)));
        }
        break;

      case 'check':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'check'));
        }
        break;

      case 'uncheck':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'uncheck'));
        }
        break;

      case 'hover':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'hover'));
        }
        break;

      case 'focus':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'focus'));
        }
        break;

      case 'press':
        if (action.key) {
          const key = action.modifiers?.length 
            ? `${action.modifiers.join('+')}+${action.key}`
            : action.key;
          lines.push(`await page.keyboard.press('${key}');`);
        }
        break;

      case 'upload':
        if (locator && action.value) {
          const files = Array.isArray(action.value) ? action.value : [action.value];
          lines.push(...this.generateLocatorCode(locator, 'setInputFiles', JSON.stringify(files)));
        }
        break;

      case 'scroll':
        if (locator) {
          lines.push(...this.generateLocatorCode(locator, 'scrollIntoViewIfNeeded'));
        } else {
          lines.push(`await page.mouse.wheel(0, 200);`);
        }
        break;

      case 'wait':
        if (action.waitCondition) {
          lines.push(this.generateWaitCode(action.waitCondition));
        } else {
          lines.push(`await page.waitForTimeout(${action.duration || 1000});`);
        }
        break;

      case 'screenshot':
        lines.push(`await page.screenshot({ path: 'screenshot-${action.id}.png' });`);
        break;

      case 'assert':
        if (locator) {
          lines.push(`await expect(${locator.primary.playwrightCode}).toBeVisible();`);
        }
        break;
    }

    // Add stability wait after certain actions
    if (['click', 'fill', 'select'].includes(action.type) && appConfig.stabilityWait > 0) {
      lines.push(`await page.waitForTimeout(${appConfig.stabilityWait});`);
    }

    return lines.join('\n    ');
  }

  /**
   * Generate locator code with fallback strategies
   */
  private generateLocatorCode(locator: AutoHealingLocator, method: string, args?: string): string[] {
    const lines: string[] = [];
    const allStrategies = [locator.primary, ...locator.fallbacks.slice(0, 4)];

    lines.push(`// Primary: ${locator.primary.type} - ${locator.primary.value.substring(0, 50)}`);

    if (locator.primary.requiresShadowDom && this.fingerprint.shadowDomEnabled) {
      // Shadow DOM handling
      lines.push(`await retryAction(async () => {`);
      lines.push(`  const element = ${locator.primary.playwrightCode};`);
      lines.push(`  await element.${method}(${args || ''});`);
      lines.push(`});`);
    } else {
      // Standard locator with healing fallback
      lines.push(`await findWithHealing(page, [`);
      
      for (const strategy of allStrategies) {
        lines.push(`  { locator: '${this.escapeString(strategy.value)}', type: '${strategy.type}' },`);
      }
      
      lines.push(`]).then(el => el.${method}(${args || ''}));`);
    }

    return lines;
  }

  /**
   * Generate wait code
   */
  private generateWaitCode(condition: import('../types').WaitCondition): string {
    switch (condition.type) {
      case 'visible':
        return `await page.waitForSelector('${this.escapeString(condition.customCondition || '')}', { state: 'visible', timeout: ${condition.timeout || 30000} });`;
      case 'hidden':
        return `await page.waitForSelector('${this.escapeString(condition.customCondition || '')}', { state: 'hidden', timeout: ${condition.timeout || 30000} });`;
      case 'networkidle':
        return `await page.waitForLoadState('networkidle', { timeout: ${condition.timeout || 30000} });`;
      case 'custom':
        if (condition.customCondition) {
          return `await page.waitForSelector('${this.escapeString(condition.customCondition)}', { timeout: ${condition.timeout || 30000} });`;
        }
        return '';
      default:
        return `await page.waitForTimeout(${condition.timeout || 1000});`;
    }
  }

  /**
   * Generate comment for action
   */
  private generateComment(action: RecordedAction): string {
    const element = action.element;
    let description = action.type;

    if (element) {
      if (element.ariaLabel) {
        description += ` on "${element.ariaLabel}"`;
      } else if (element.text && element.text.length < 30) {
        description += ` on "${element.text}"`;
      } else if (element.placeholder) {
        description += ` on input with placeholder "${element.placeholder}"`;
      }
    }

    if (action.value && typeof action.value === 'string' && action.value.length < 50) {
      description += ` with value "${action.value}"`;
    }

    return description;
  }

  /**
   * Assemble the complete script
   */
  private assembleScript(
    imports: string[],
    helpers: HelperFunction[],
    testCases: TestCase[],
    session: RecordingSession
  ): string {
    const lines: string[] = [];

    // Header comment
    lines.push('/**');
    lines.push(` * Auto-generated Playwright test by Flowstral`);
    lines.push(` * Application: ${this.fingerprint.application}`);
    lines.push(` * Generated: ${new Date().toISOString()}`);
    lines.push(` * Shadow DOM: ${this.fingerprint.shadowDomEnabled ? 'Enabled' : 'Disabled'}`);
    lines.push(' */');
    lines.push('');

    // Imports
    lines.push(...imports);
    lines.push('');

    // Helper functions
    for (const helper of helpers) {
      lines.push(`// ${helper.description}`);
      lines.push(helper.code);
      lines.push('');
    }

    // Test configuration
    lines.push('// Test configuration');
    lines.push(`test.describe('${this.generateSuiteName(session)}', () => {`);
    lines.push(`  test.beforeEach(async ({ page }) => {`);
    lines.push(`    // Set viewport and other configurations`);
    lines.push(`    await page.setViewportSize({ width: ${session.metadata.viewportSize.width}, height: ${session.metadata.viewportSize.height} });`);
    lines.push(`  });`);
    lines.push('');

    // Generate test cases
    for (const testCase of testCases) {
      lines.push(`  test('${this.escapeString(testCase.name)}', async ({ page }) => {`);
      
      if (testCase.description) {
        lines.push(`    // ${testCase.description}`);
      }

      for (const step of testCase.steps) {
        if (step.comment) {
          lines.push(`    // ${step.comment}`);
        }
        lines.push(`    ${step.generatedCode}`);
        lines.push('');
      }

      // Generate assertions
      for (const assertion of testCase.assertions) {
        lines.push(`    ${assertion.generatedCode}`);
      }

      lines.push(`  });`);
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate test name from session
   */
  private generateTestName(session: RecordingSession): string {
    const date = new Date(session.startTime);
    const baseUrl = new URL(session.baseUrl);
    return `${baseUrl.hostname} - ${date.toLocaleDateString()}`;
  }

  /**
   * Generate suite name from session
   */
  private generateSuiteName(session: RecordingSession): string {
    return `${this.capitalize(this.fingerprint.application)} Automated Tests`;
  }

  /**
   * Utility methods
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Page Object Model Generator
 */
export class PageObjectGenerator {
  private fingerprint: ApplicationFingerprint;
  private locatorEngine: AutoHealingLocatorEngine;

  constructor(fingerprint: ApplicationFingerprint) {
    this.fingerprint = fingerprint;
    this.locatorEngine = new AutoHealingLocatorEngine(fingerprint);
  }

  /**
   * Generate Page Object Model from recording session
   */
  generatePageObject(session: RecordingSession): string {
    const uniqueElements = this.extractUniqueElements(session);
    const className = this.generateClassName(session);
    
    const lines: string[] = [];

    // Header
    lines.push(`import { Page, Locator, expect } from '@playwright/test';`);
    lines.push('');
    lines.push(`/**`);
    lines.push(` * Page Object for ${this.fingerprint.application}`);
    lines.push(` * Auto-generated by Flowstral`);
    lines.push(` */`);
    lines.push(`export class ${className} {`);
    lines.push(`  private page: Page;`);
    lines.push('');

    // Element locators
    for (const [name, element] of Object.entries(uniqueElements)) {
      const locator = this.locatorEngine.generateAutoHealingLocator(element);
      lines.push(`  // ${this.generateElementComment(element)}`);
      lines.push(`  private ${name}Locator(): Locator {`);
      lines.push(`    return ${locator.primary.playwrightCode.replace('page', 'this.page')};`);
      lines.push(`  }`);
      lines.push('');
    }

    // Constructor
    lines.push(`  constructor(page: Page) {`);
    lines.push(`    this.page = page;`);
    lines.push(`  }`);
    lines.push('');

    // Navigation method
    lines.push(`  async navigate(): Promise<void> {`);
    lines.push(`    await this.page.goto('${session.baseUrl}');`);
    lines.push(`    await this.page.waitForLoadState('networkidle');`);
    lines.push(`  }`);
    lines.push('');

    // Action methods
    for (const [name, element] of Object.entries(uniqueElements)) {
      lines.push(...this.generateActionMethods(name, element));
    }

    lines.push('}');

    return lines.join('\n');
  }

  private extractUniqueElements(session: RecordingSession): Record<string, import('../types').RecordedElement> {
    const elements: Record<string, import('../types').RecordedElement> = {};
    
    for (const action of session.actions) {
      if (action.element) {
        const name = this.generateElementName(action.element);
        if (!elements[name]) {
          elements[name] = action.element;
        }
      }
    }

    return elements;
  }

  private generateElementName(element: import('../types').RecordedElement): string {
    if (element.ariaLabel) {
      return this.toCamelCase(element.ariaLabel);
    }
    if (element.name) {
      return this.toCamelCase(element.name);
    }
    if (element.placeholder) {
      return this.toCamelCase(element.placeholder);
    }
    if (element.text && element.text.length < 30) {
      return this.toCamelCase(element.text);
    }
    return `${element.tagName.toLowerCase()}Element`;
  }

  private generateElementComment(element: import('../types').RecordedElement): string {
    const parts: string[] = [element.tagName];
    if (element.ariaLabel) parts.push(`aria-label="${element.ariaLabel}"`);
    if (element.role) parts.push(`role="${element.role}"`);
    return parts.join(' - ');
  }

  private generateActionMethods(name: string, element: import('../types').RecordedElement): string[] {
    const lines: string[] = [];
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    // Click method
    if (this.isClickable(element)) {
      lines.push(`  async click${capitalizedName}(): Promise<void> {`);
      lines.push(`    await this.${name}Locator().click();`);
      lines.push(`  }`);
      lines.push('');
    }

    // Fill method for inputs
    if (this.isInput(element)) {
      lines.push(`  async fill${capitalizedName}(value: string): Promise<void> {`);
      lines.push(`    await this.${name}Locator().fill(value);`);
      lines.push(`  }`);
      lines.push('');

      lines.push(`  async get${capitalizedName}Value(): Promise<string> {`);
      lines.push(`    return await this.${name}Locator().inputValue();`);
      lines.push(`  }`);
      lines.push('');
    }

    // Select method for dropdowns
    if (this.isSelect(element)) {
      lines.push(`  async select${capitalizedName}(value: string): Promise<void> {`);
      lines.push(`    await this.${name}Locator().selectOption(value);`);
      lines.push(`  }`);
      lines.push('');
    }

    // Visibility assertion
    lines.push(`  async expect${capitalizedName}ToBeVisible(): Promise<void> {`);
    lines.push(`    await expect(this.${name}Locator()).toBeVisible();`);
    lines.push(`  }`);
    lines.push('');

    return lines;
  }

  private isClickable(element: import('../types').RecordedElement): boolean {
    const clickableTags = ['button', 'a', 'input'];
    const clickableRoles = ['button', 'link', 'menuitem', 'tab'];
    return clickableTags.includes(element.tagName.toLowerCase()) ||
           (element.role ? clickableRoles.includes(element.role) : false);
  }

  private isInput(element: import('../types').RecordedElement): boolean {
    const inputTags = ['input', 'textarea'];
    const inputTypes = ['text', 'password', 'email', 'tel', 'url', 'search', 'number'];
    return inputTags.includes(element.tagName.toLowerCase()) &&
           (!element.type || inputTypes.includes(element.type));
  }

  private isSelect(element: import('../types').RecordedElement): boolean {
    return element.tagName.toLowerCase() === 'select' ||
           element.role === 'combobox' ||
           element.role === 'listbox';
  }

  private generateClassName(session: RecordingSession): string {
    const baseUrl = new URL(session.baseUrl);
    const parts = baseUrl.pathname.split('/').filter(Boolean);
    const name = parts.length > 0 ? parts[parts.length - 1] : 'Main';
    return `${this.toPascalCase(name)}Page`;
  }

  private toCamelCase(str: string): string {
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

  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
