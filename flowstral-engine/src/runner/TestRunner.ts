/**
 * TestRunner - Executes recorded tests with pause/resume/debug capabilities
 * 
 * Features:
 * - Execute recorded actions using Playwright
 * - Pause/Resume execution mid-test
 * - Step-by-step debugging mode
 * - Edit steps on-the-fly while paused
 * - Skip/Retry individual steps
 * - Browser stays open during pause for inspection
 */

import { chromium, Browser, BrowserContext, Page, Locator } from 'playwright';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface TestStep {
  id: string;
  qword: string;  // Action type: click, fill, goto, assert, etc.
  args?: string[];
  selector?: string;
  selectorObj?: {
    selector: string;
    strategies?: Array<{ type: string; value: string }>;
  };
  description?: string;
  timeout?: number;
}

export interface TestConfig {
  name?: string;
  baseUrl?: string;
  timeout?: number;
  headless?: boolean;
  slowMo?: number;
  viewport?: { width: number; height: number };
  debugMode?: boolean;
  stepByStep?: boolean;
}

export interface StepResult {
  index: number;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  error?: string;
  screenshot?: string;
  duration?: number;
}

export interface TestResult {
  success: boolean;
  stepResults: StepResult[];
  totalDuration: number;
  error?: string;
  failedStep?: number;
}

export type TestRunnerEvent = 
  | 'step-start'
  | 'step-complete'
  | 'step-failed'
  | 'test-paused'
  | 'test-resumed'
  | 'test-complete'
  | 'test-stopped';

// ============================================================================
// TestRunner Class
// ============================================================================

export class TestRunner extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  // Execution state
  private isRunning = false;
  private isPaused = false;
  private currentStepIndex = 0;
  private steps: TestStep[] = [];
  private stepResults: StepResult[] = [];
  
  // Pause/Resume control
  private pauseResolver: (() => void) | null = null;
  private pauseRequested = false;
  private stopRequested = false;
  
  // Debug mode
  private debugMode = false;
  private stepByStep = false;
  
  // Config
  private config: TestConfig = {
    timeout: 30000,
    headless: false,
    slowMo: 0,
    viewport: { width: 1920, height: 1080 }
  };

  constructor(config?: Partial<TestConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================================
  // Main Execution
  // ============================================================================

  /**
   * Run a test with the given steps
   */
  async runTest(steps: TestStep[], config?: Partial<TestConfig>): Promise<TestResult> {
    const startTime = Date.now();
    
    // Apply config
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.debugMode = this.config.debugMode || false;
    this.stepByStep = this.config.stepByStep || false;
    this.steps = steps;
    this.stepResults = steps.map((_, i) => ({ index: i, status: 'pending' as const }));
    this.currentStepIndex = 0;
    this.isRunning = true;
    this.stopRequested = false;
    this.pauseRequested = false;
    
    try {
      // Launch browser
      await this.launchBrowser();
      
      // Navigate to base URL if provided
      if (this.config.baseUrl && this.page) {
        await this.page.goto(this.config.baseUrl);
      }
      
      // Execute steps
      for (let i = this.currentStepIndex; i < steps.length; i++) {
        // Check if stop requested
        if (this.stopRequested) {
          // Mark remaining steps as skipped
          for (let j = i; j < steps.length; j++) {
            this.stepResults[j] = { index: j, status: 'skipped' };
          }
          break;
        }
        
        // Check if pause requested (before step execution)
        if (this.pauseRequested || (this.stepByStep && i > 0)) {
          this.isPaused = true;
          this.currentStepIndex = i;
          this.emit('test-paused', { stepIndex: i, step: steps[i] });
          
          // Wait for resume
          await this.waitForResume();
          
          // Check if stopped during pause
          if (this.stopRequested) {
            for (let j = i; j < steps.length; j++) {
              this.stepResults[j] = { index: j, status: 'skipped' };
            }
            break;
          }
        }
        
        // Execute step
        this.currentStepIndex = i;
        this.emit('step-start', { index: i, step: steps[i] });
        
        const stepStartTime = Date.now();
        
        try {
          await this.executeStep(steps[i]);
          
          const duration = Date.now() - stepStartTime;
          this.stepResults[i] = { index: i, status: 'passed', duration };
          
          this.emit('step-complete', { index: i, status: 'passed', duration });
          
        } catch (error: any) {
          const duration = Date.now() - stepStartTime;
          
          // Take screenshot on failure
          let screenshot: string | undefined;
          try {
            if (this.page) {
              const buffer = await this.page.screenshot();
              screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
            }
          } catch {}
          
          this.stepResults[i] = { 
            index: i, 
            status: 'failed', 
            error: error.message,
            screenshot,
            duration
          };
          
          this.emit('step-failed', { index: i, error: error.message, screenshot });
          
          // In debug mode, pause on failure
          if (this.debugMode) {
            this.isPaused = true;
            this.currentStepIndex = i;
            this.emit('test-paused', { stepIndex: i, step: steps[i], error: error.message });
            
            // Wait for user action (resume, retry, skip, or stop)
            await this.waitForResume();
            
            // If they didn't stop, decrement i to retry this step (if they chose retry)
            // or it will naturally continue to next step
            if (this.stopRequested) {
              for (let j = i + 1; j < steps.length; j++) {
                this.stepResults[j] = { index: j, status: 'skipped' };
              }
              break;
            }
            
          } else {
            // In normal mode, fail immediately
            throw error;
          }
        }
      }
      
      // Calculate result
      const failedCount = this.stepResults.filter(r => r.status === 'failed').length;
      const success = failedCount === 0 && !this.stopRequested;
      
      const result: TestResult = {
        success,
        stepResults: this.stepResults,
        totalDuration: Date.now() - startTime,
        error: success ? undefined : 'Test failed',
        failedStep: this.stepResults.findIndex(r => r.status === 'failed')
      };
      
      this.emit('test-complete', result);
      
      return result;
      
    } catch (error: any) {
      const result: TestResult = {
        success: false,
        stepResults: this.stepResults,
        totalDuration: Date.now() - startTime,
        error: error.message,
        failedStep: this.currentStepIndex
      };
      
      this.emit('test-complete', result);
      
      return result;
      
    } finally {
      this.isRunning = false;
      
      // Only close browser if not paused (keep open for inspection)
      if (!this.isPaused) {
        await this.closeBrowser();
      }
    }
  }

  // ============================================================================
  // Pause/Resume Control
  // ============================================================================

  /**
   * Request to pause execution after current step
   */
  pauseTest(): void {
    if (!this.isRunning) return;
    this.pauseRequested = true;
  }

  /**
   * Resume execution from paused state
   */
  resumeTest(options?: { fromStep?: number; updatedSteps?: TestStep[] }): void {
    if (!this.isPaused) return;
    
    // Apply updated steps if provided
    if (options?.updatedSteps) {
      this.steps = options.updatedSteps;
    }
    
    // Update start position if provided
    if (options?.fromStep !== undefined) {
      this.currentStepIndex = options.fromStep;
    }
    
    this.isPaused = false;
    this.pauseRequested = false;
    
    this.emit('test-resumed', { stepIndex: this.currentStepIndex });
    
    // Unblock the execution loop
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  /**
   * Skip current step and continue
   */
  skipStep(): void {
    if (!this.isPaused) return;
    
    // Mark current step as skipped
    this.stepResults[this.currentStepIndex] = { 
      index: this.currentStepIndex, 
      status: 'skipped' 
    };
    
    // Move to next step
    this.currentStepIndex++;
    
    this.isPaused = false;
    this.pauseRequested = false;
    
    // Unblock
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  /**
   * Retry current step with optionally updated step data
   */
  async retryStep(updatedStep?: TestStep): Promise<StepResult> {
    if (!this.isPaused || !this.page) {
      throw new Error('Cannot retry: not paused or no page');
    }
    
    const stepIndex = this.currentStepIndex;
    const step = updatedStep || this.steps[stepIndex];
    
    // Update step in list if provided
    if (updatedStep) {
      this.steps[stepIndex] = updatedStep;
    }
    
    this.emit('step-start', { index: stepIndex, step, isRetry: true });
    
    const startTime = Date.now();
    
    try {
      await this.executeStep(step);
      
      const duration = Date.now() - startTime;
      const result: StepResult = { index: stepIndex, status: 'passed', duration };
      this.stepResults[stepIndex] = result;
      
      this.emit('step-complete', { index: stepIndex, status: 'passed', duration, isRetry: true });
      
      return result;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      let screenshot: string | undefined;
      try {
        const buffer = await this.page.screenshot();
        screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
      } catch {}
      
      const result: StepResult = { 
        index: stepIndex, 
        status: 'failed', 
        error: error.message,
        screenshot,
        duration
      };
      this.stepResults[stepIndex] = result;
      
      this.emit('step-failed', { index: stepIndex, error: error.message, screenshot, isRetry: true });
      
      return result;
    }
  }

  /**
   * Run a single step (for step-by-step mode)
   */
  async runSingleStep(step: TestStep, index: number): Promise<StepResult> {
    if (!this.page) {
      throw new Error('No page available');
    }
    
    this.emit('step-start', { index, step });
    
    const startTime = Date.now();
    
    try {
      await this.executeStep(step);
      
      const duration = Date.now() - startTime;
      const result: StepResult = { index, status: 'passed', duration };
      
      this.emit('step-complete', { index, status: 'passed', duration });
      
      return result;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      let screenshot: string | undefined;
      try {
        const buffer = await this.page.screenshot();
        screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
      } catch {}
      
      const result: StepResult = { 
        index, 
        status: 'failed', 
        error: error.message,
        screenshot,
        duration
      };
      
      this.emit('step-failed', { index, error: error.message, screenshot });
      
      return result;
    }
  }

  /**
   * Stop test execution and optionally close browser
   */
  async stopTest(options?: { closeBrowser?: boolean }): Promise<void> {
    this.stopRequested = true;
    this.isRunning = false;
    
    // Unblock if paused
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
    
    this.emit('test-stopped', { stepIndex: this.currentStepIndex });
    
    if (options?.closeBrowser !== false) {
      await this.closeBrowser();
    }
  }

  // ============================================================================
  // Step Execution
  // ============================================================================

  /**
   * Execute a single step
   */
  private async executeStep(step: TestStep): Promise<void> {
    if (!this.page) {
      throw new Error('No page available');
    }
    
    const timeout = step.timeout || this.config.timeout || 30000;
    const qword = step.qword?.toLowerCase() || '';
    const selector = step.selectorObj?.selector || step.selector;
    const args = step.args || [];
    
    // Get locator if selector provided
    let locator: Locator | null = null;
    if (selector) {
      locator = this.page.locator(selector);
    }
    
    // Execute based on action type
    switch (qword) {
      // Navigation
      case 'goto':
      case 'navigate':
        await this.page.goto(args[0] || '', { timeout });
        break;
      
      // Click actions
      case 'click':
        if (!locator) throw new Error('No selector for click');
        await locator.click({ timeout });
        break;
        
      case 'dblclick':
      case 'doubleclick':
        if (!locator) throw new Error('No selector for double click');
        await locator.dblclick({ timeout });
        break;
        
      case 'rightclick':
        if (!locator) throw new Error('No selector for right click');
        await locator.click({ button: 'right', timeout });
        break;
      
      // Input actions
      case 'fill':
      case 'type':
        if (!locator) throw new Error('No selector for fill');
        await locator.fill(args[0] || '', { timeout });
        break;
        
      case 'clear':
        if (!locator) throw new Error('No selector for clear');
        await locator.clear({ timeout });
        break;
        
      case 'press':
      case 'keypress':
        const key = args[0] || 'Enter';
        if (locator) {
          await locator.press(key, { timeout });
        } else {
          await this.page.keyboard.press(key);
        }
        break;
      
      // Select/Check actions
      case 'select':
      case 'selectoption':
        if (!locator) throw new Error('No selector for select');
        await locator.selectOption(args[0] || '', { timeout });
        break;
        
      case 'check':
        if (!locator) throw new Error('No selector for check');
        await locator.check({ timeout });
        break;
        
      case 'uncheck':
        if (!locator) throw new Error('No selector for uncheck');
        await locator.uncheck({ timeout });
        break;
      
      // Hover/Focus
      case 'hover':
        if (!locator) throw new Error('No selector for hover');
        await locator.hover({ timeout });
        break;
        
      case 'focus':
        if (!locator) throw new Error('No selector for focus');
        await locator.focus({ timeout });
        break;
      
      // Wait actions
      case 'wait':
      case 'waitfor':
        const waitTime = parseInt(args[0] || '1000', 10);
        await this.page.waitForTimeout(waitTime);
        break;
        
      case 'waitforvisible':
        if (!locator) throw new Error('No selector for wait');
        await locator.waitFor({ state: 'visible', timeout });
        break;
        
      case 'waitforhidden':
        if (!locator) throw new Error('No selector for wait');
        await locator.waitFor({ state: 'hidden', timeout });
        break;
        
      case 'waitfornetworkidle':
        await this.page.waitForLoadState('networkidle', { timeout });
        break;
      
      // Assertions
      case 'assert':
      case 'assertvisible':
        if (!locator) throw new Error('No selector for assertion');
        await expect(locator).toBeVisible({ timeout });
        break;
        
      case 'asserttext':
      case 'assertcontainstext':
        if (!locator) throw new Error('No selector for assertion');
        const expectedText = args[0] || '';
        await expect(locator).toContainText(expectedText, { timeout });
        break;
        
      case 'assertvalue':
        if (!locator) throw new Error('No selector for assertion');
        const expectedValue = args[0] || '';
        await expect(locator).toHaveValue(expectedValue, { timeout });
        break;
        
      case 'asserturl':
        const expectedUrl = args[0] || '';
        await expect(this.page).toHaveURL(expectedUrl, { timeout });
        break;
      
      // Screenshot
      case 'screenshot':
        const path = args[0] || `screenshot_${Date.now()}.png`;
        await this.page.screenshot({ path });
        break;
      
      // Scroll
      case 'scroll':
        if (locator) {
          await locator.scrollIntoViewIfNeeded({ timeout });
        } else {
          const x = parseInt(args[0] || '0', 10);
          const y = parseInt(args[1] || '0', 10);
          await this.page.evaluate(({ x, y }) => window.scrollTo(x, y), { x, y });
        }
        break;
      
      // Upload
      case 'upload':
      case 'setinputfiles':
        if (!locator) throw new Error('No selector for upload');
        await locator.setInputFiles(args[0] || '');
        break;
      
      // Salesforce-specific actions
      case 'sf-navigate':
      case 'sf-navigateto':
        await this.page.goto(args[0] || '', { timeout });
        await this.page.waitForLoadState('networkidle', { timeout });
        break;
        
      case 'sf-click':
        if (!locator) throw new Error('No selector for SF click');
        await locator.click({ timeout });
        await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        break;
        
      case 'sf-fill':
        if (!locator) throw new Error('No selector for SF fill');
        await locator.fill(args[0] || '', { timeout });
        break;
        
      case 'sf-wait':
        const sfWait = parseInt(args[0] || '2000', 10);
        await this.page.waitForTimeout(sfWait);
        break;
      
      default:
        console.warn(`Unknown action type: ${qword}`);
        // Try to execute as a generic action
        if (locator && qword.includes('click')) {
          await locator.click({ timeout });
        } else if (locator && (qword.includes('fill') || qword.includes('type'))) {
          await locator.fill(args[0] || '', { timeout });
        }
    }
  }

  // ============================================================================
  // Browser Management
  // ============================================================================

  private async launchBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless || false,
      slowMo: this.config.slowMo || 0
    });
    
    this.context = await this.browser.newContext({
      viewport: this.config.viewport || { width: 1920, height: 1080 }
    });
    
    this.page = await this.context.newPage();
  }

  private async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Wait for resume signal
   */
  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      this.pauseResolver = resolve;
    });
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get running(): boolean {
    return this.isRunning;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get currentStep(): number {
    return this.currentStepIndex;
  }

  get results(): StepResult[] {
    return this.stepResults;
  }

  getPage(): Page | null {
    return this.page;
  }
}

// Helper for Playwright expect (simplified version)
function expect(target: Locator | Page): any {
  return {
    async toBeVisible(options?: { timeout?: number }) {
      if ('waitFor' in target) {
        await (target as Locator).waitFor({ state: 'visible', timeout: options?.timeout });
      }
    },
    async toContainText(text: string, options?: { timeout?: number }) {
      if ('textContent' in target) {
        const content = await (target as Locator).textContent({ timeout: options?.timeout });
        if (!content?.includes(text)) {
          throw new Error(`Expected text "${text}" not found. Got: "${content}"`);
        }
      }
    },
    async toHaveValue(value: string, options?: { timeout?: number }) {
      if ('inputValue' in target) {
        const actual = await (target as Locator).inputValue({ timeout: options?.timeout });
        if (actual !== value) {
          throw new Error(`Expected value "${value}" but got "${actual}"`);
        }
      }
    },
    async toHaveURL(url: string, options?: { timeout?: number }) {
      if ('url' in target) {
        await (target as Page).waitForURL(url, { timeout: options?.timeout });
      }
    }
  };
}

export default TestRunner;

