import { chromium, Browser, Page } from 'playwright';

export interface TestStep {
  action: string;
  data?: Record<string, any>;
  expected: string;
  locator_hints?: string[];
}

export interface TestCase {
  case_id: string;
  title: string;
  description?: string;
  priority: string;
  tags?: string[];
  steps: TestStep[];
}

export interface TestRunResult {
  case_id: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshots?: string[];
  logs?: string[];
}

export class PlaywrightRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async cleanup() {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runTestCase(testCase: TestCase): Promise<TestRunResult> {
    if (!this.page) {
      throw new Error('Playwright not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];

    try {
      logs.push(`Starting test: ${testCase.title}`);

      for (const step of testCase.steps) {
        logs.push(`Executing step: ${step.action}`);
        
        // Take screenshot before each step
        const screenshot = await this.page.screenshot({ fullPage: true });
        screenshots.push(screenshot.toString('base64'));

        // Execute the step
        await this.executeStep(step);
        
        // Verify expected result
        if (step.expected) {
          await this.verifyExpected(step.expected);
        }
      }

      const duration = Date.now() - startTime;
      logs.push(`Test completed successfully in ${duration}ms`);

      return {
        case_id: testCase.case_id,
        status: 'passed',
        duration,
        logs,
        screenshots
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logs.push(`Test failed: ${error.message}`);
      
      // Take final screenshot on failure
      const screenshot = await this.page.screenshot({ fullPage: true });
      screenshots.push(screenshot.toString('base64'));

      return {
        case_id: testCase.case_id,
        status: 'failed',
        duration,
        error: error.message,
        logs,
        screenshots
      };
    }
  }

  private async executeStep(step: TestStep) {
    if (!this.page) return;

    const action = step.action.toLowerCase();
    const data = step.data || {};

    if (action.includes('navigate')) {
      const url = data.url || 'https://example.com';
      await this.page.goto(url);
    } else if (action.includes('click')) {
      const selector = data.selector || 'button';
      await this.page.click(selector);
    } else if (action.includes('fill')) {
      const selector = data.selector || 'input';
      const value = data.value || '';
      await this.page.fill(selector, value);
    } else if (action.includes('wait')) {
      const timeout = data.timeout || 1000;
      await this.page.waitForTimeout(timeout);
    } else if (action.includes('select')) {
      const selector = data.selector || 'select';
      const value = data.value || '';
      await this.page.selectOption(selector, value);
    } else if (action.includes('check')) {
      const selector = data.selector || 'input[type="checkbox"]';
      await this.page.check(selector);
    } else if (action.includes('uncheck')) {
      const selector = data.selector || 'input[type="checkbox"]';
      await this.page.uncheck(selector);
    } else if (action.includes('hover')) {
      const selector = data.selector || 'button';
      await this.page.hover(selector);
    } else if (action.includes('press')) {
      const key = data.key || 'Enter';
      await this.page.press('body', key);
    } else {
      throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private async verifyExpected(expected: string) {
    if (!this.page) return;

    const expectedLower = expected.toLowerCase();

    if (expectedLower.includes('visible')) {
      const selector = expected.match(/visible\s+(\S+)/)?.[1];
      if (selector) {
        await this.page.waitForSelector(selector, { state: 'visible' });
      }
    } else if (expectedLower.includes('hidden')) {
      const selector = expected.match(/hidden\s+(\S+)/)?.[1];
      if (selector) {
        await this.page.waitForSelector(selector, { state: 'hidden' });
      }
    } else if (expectedLower.includes('contains')) {
      const text = expected.match(/contains\s+"([^"]+)"/)?.[1];
      if (text) {
        await this.page.waitForSelector(`text=${text}`);
      }
    } else if (expectedLower.includes('url')) {
      const url = expected.match(/url\s+(\S+)/)?.[1];
      if (url) {
        await this.page.waitForURL(url);
      }
    } else if (expectedLower.includes('title')) {
      const title = expected.match(/title\s+"([^"]+)"/)?.[1];
      if (title) {
        await this.page.waitForFunction(
          (expectedTitle) => document.title === expectedTitle,
          title
        );
      }
    }
  }
}

export const playwrightRunner = new PlaywrightRunner();
