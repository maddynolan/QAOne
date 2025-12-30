/**
 * Flowstral - Test Utilities
 * Application-specific helper functions for robust testing
 */

import { EnterpriseApplication, ApplicationFingerprint } from '../types';

/**
 * Wait Utilities - Application-specific wait conditions
 */
export class WaitUtilities {
  private page: any;
  private application: EnterpriseApplication;

  constructor(page: any, application: EnterpriseApplication) {
    this.page = page;
    this.application = application;
  }

  /**
   * Wait for application-specific loading to complete
   */
  async waitForApplicationReady(timeout: number = 30000): Promise<void> {
    const waitFunctions: Record<EnterpriseApplication, () => Promise<void>> = {
      salesforce: () => this.waitForSalesforce(timeout),
      workday: () => this.waitForWorkday(timeout),
      servicenow: () => this.waitForServiceNow(timeout),
      sap: () => this.waitForSAP(timeout),
      pega: () => this.waitForPega(timeout),
      'oracle-fusion': () => this.waitForOracleFusion(timeout),
      dynamics365: () => this.waitForDynamics365(timeout),
      netsuite: () => this.waitForNetSuite(timeout),
      successfactors: () => this.waitForSuccessFactors(timeout),
      concur: () => this.waitForConcur(timeout),
      veeva: () => this.waitForVeeva(timeout),
      coupa: () => this.waitForCoupa(timeout),
      ariba: () => this.waitForAriba(timeout),
      zendesk: () => this.waitForZendesk(timeout),
      hubspot: () => this.waitForHubSpot(timeout),
      zoho: () => this.waitForZoho(timeout),
      freshworks: () => this.waitForFreshworks(timeout),
      anaplan: () => this.waitForAnaplan(timeout),
      snowflake: () => this.waitForSnowflake(timeout),
      tableau: () => this.waitForTableau(timeout),
      'power-bi': () => this.waitForPowerBI(timeout),
      jira: () => this.waitForJira(timeout),
      confluence: () => this.waitForConfluence(timeout),
      monday: () => this.waitForMonday(timeout),
      asana: () => this.waitForAsana(timeout),
      unknown: () => this.waitForGeneric(timeout),
    };

    const waitFn = waitFunctions[this.application] || waitFunctions.unknown;
    await waitFn();
  }

  private async waitForSalesforce(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        // Wait for Lightning spinners
        const spinners = document.querySelectorAll('lightning-spinner, .slds-spinner');
        if (spinners.length > 0) return false;
        
        // Wait for Aura loading state
        const loading = document.querySelector('[data-aura-state="LOADING"]');
        if (loading) return false;
        
        // Check for in-flight XHRs
        const $A = (window as any).$A;
        if ($A?.clientService?.inFlightXHRs?.()) return false;
        
        return true;
      },
      { timeout }
    );
  }

  private async waitForWorkday(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('.wd-spinner, [data-automation-widget="spinner"]');
        const loading = document.querySelector('.wd-loading, [data-loading="true"]');
        return spinners.length === 0 && !loading;
      },
      { timeout }
    );
  }

  private async waitForServiceNow(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector(
          '.loading-icon, .sn_loading, [now-loading], .now-loading'
        );
        const glideRunning = (window as any).g_ui_running;
        return !loading && !glideRunning;
      },
      { timeout }
    );
  }

  private async waitForSAP(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const sap = (window as any).sap;
        if (!sap?.ui?.core?.BusyIndicator) return true;
        return !sap.ui.core.BusyIndicator.isOpen();
      },
      { timeout }
    );
  }

  private async waitForPega(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('.loading-indicator, [data-loading="true"]');
        return !loading;
      },
      { timeout }
    );
  }

  private async waitForOracleFusion(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const AdfPage = (window as any).AdfPage;
        if (AdfPage?.PAGE) {
          return !AdfPage.PAGE.isBusy();
        }
        const busy = document.querySelector('.AFBusyIndicator, [af\\:message]');
        return !busy;
      },
      { timeout }
    );
  }

  private async waitForDynamics365(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const Xrm = (window as any).Xrm;
        const spinner = document.querySelector('.ms-Spinner, [data-loading="true"]');
        return Xrm && !spinner;
      },
      { timeout }
    );
  }

  private async waitForNetSuite(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('.ns-loading, #loading, .x-mask, .ext-el-mask');
        return !loading;
      },
      { timeout }
    );
  }

  private async waitForSuccessFactors(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const spinner = document.querySelector('.bx-spinner, .sfp-loading');
        return !spinner;
      },
      { timeout }
    );
  }

  private async waitForConcur(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }

  private async waitForVeeva(timeout: number): Promise<void> {
    // Veeva uses Lightning, inherit Salesforce wait
    await this.waitForSalesforce(timeout);
  }

  private async waitForCoupa(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(400);
  }

  private async waitForAriba(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const busy = document.querySelector('.awbusy, .aw-loading, .w-busy');
        return !busy;
      },
      { timeout }
    );
  }

  private async waitForZendesk(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForHubSpot(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForZoho(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(400);
  }

  private async waitForFreshworks(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForAnaplan(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('.anaplan-loading, .model-loading');
        return !loading;
      },
      { timeout }
    );
  }

  private async waitForSnowflake(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }

  private async waitForTableau(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('.tab-loading, .tabLoadingIndicator');
        return !loading;
      },
      { timeout }
    );
  }

  private async waitForPowerBI(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('.pbi-loading, [data-loading="true"]');
        return !loading;
      },
      { timeout }
    );
  }

  private async waitForJira(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForConfluence(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(400);
  }

  private async waitForMonday(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForAsana(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  private async waitForGeneric(timeout: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Shadow DOM Utilities
 */
export class ShadowDomUtilities {
  private page: any;

  constructor(page: any) {
    this.page = page;
  }

  /**
   * Find element through shadow DOM boundaries
   */
  async findInShadow(selectors: string[]): Promise<any> {
    const element = await this.page.evaluateHandle((sels: string[]) => {
      function traverseShadow(root: Document | ShadowRoot, selector: string): Element | null {
        // Try direct query
        let element = root.querySelector(selector);
        if (element) return element;

        // Search through shadow roots
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
          if (el.shadowRoot) {
            element = traverseShadow(el.shadowRoot, selector);
            if (element) return element;
          }
        }
        return null;
      }

      let current: Document | ShadowRoot | null = document;
      for (const sel of sels) {
        const found = traverseShadow(current as Document | ShadowRoot, sel);
        if (!found) return null;
        current = found.shadowRoot || found;
      }
      return current;
    }, selectors);

    return element.asElement();
  }

  /**
   * Get all elements matching selector including shadow DOM
   */
  async queryAllWithShadow(selector: string): Promise<any[]> {
    const handles = await this.page.evaluateHandle((sel: string) => {
      const results: Element[] = [];

      function searchShadow(root: Document | ShadowRoot) {
        const elements = root.querySelectorAll(sel);
        results.push(...elements);

        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            searchShadow(el.shadowRoot);
          }
        });
      }

      searchShadow(document);
      return results;
    }, selector);

    return handles.getProperties().then((props: Map<string, any>) => 
      Array.from(props.values()).map(h => h.asElement()).filter(Boolean)
    );
  }

  /**
   * Click element through shadow DOM
   */
  async clickInShadow(selectors: string[]): Promise<void> {
    const element = await this.findInShadow(selectors);
    if (!element) {
      throw new Error(`Element not found in shadow DOM: ${selectors.join(' >> ')}`);
    }
    await element.click();
  }

  /**
   * Fill input through shadow DOM
   */
  async fillInShadow(selectors: string[], value: string): Promise<void> {
    const element = await this.findInShadow(selectors);
    if (!element) {
      throw new Error(`Element not found in shadow DOM: ${selectors.join(' >> ')}`);
    }
    await element.fill(value);
  }
}

/**
 * Frame Utilities
 */
export class FrameUtilities {
  private page: any;

  constructor(page: any) {
    this.page = page;
  }

  /**
   * Get frame by various identifiers
   */
  async getFrame(identifier: {
    name?: string;
    src?: RegExp | string;
    title?: string;
    index?: number;
  }): Promise<any> {
    if (identifier.name) {
      return this.page.frameLocator(`iframe[name="${identifier.name}"]`);
    }
    if (identifier.src) {
      if (identifier.src instanceof RegExp) {
        const frames = this.page.frames();
        for (const frame of frames) {
          if (identifier.src.test(frame.url())) {
            return frame;
          }
        }
      } else {
        return this.page.frameLocator(`iframe[src*="${identifier.src}"]`);
      }
    }
    if (identifier.title) {
      return this.page.frameLocator(`iframe[title="${identifier.title}"]`);
    }
    if (identifier.index !== undefined) {
      return this.page.frameLocator(`iframe`).nth(identifier.index);
    }
    throw new Error('No valid frame identifier provided');
  }

  /**
   * Execute action in nested frames
   */
  async withNestedFrames(
    framePath: Array<{ name?: string; src?: RegExp | string }>,
    action: (frame: any) => Promise<void>
  ): Promise<void> {
    let current = this.page;
    
    for (const frameId of framePath) {
      current = await this.getFrame(frameId);
    }
    
    await action(current);
  }

  /**
   * Wait for frame to be available
   */
  async waitForFrame(
    identifier: { name?: string; src?: RegExp | string },
    timeout: number = 30000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const frame = await this.getFrame(identifier);
        if (frame) return frame;
      } catch (e) {
        await this.page.waitForTimeout(500);
      }
    }
    
    throw new Error(`Frame not found within ${timeout}ms`);
  }
}

/**
 * Retry Utilities
 */
export class RetryUtilities {
  /**
   * Retry an action with exponential backoff
   */
  static async retry<T>(
    action: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      retryIf?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryIf = () => true,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error as Error;
        
        if (!retryIf(lastError) || attempt === maxRetries - 1) {
          throw lastError;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Retry until condition is met
   */
  static async retryUntil<T>(
    action: () => Promise<T>,
    condition: (result: T) => boolean,
    options: {
      maxAttempts?: number;
      delay?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 10, delay = 1000, timeout = 30000 } = options;
    const startTime = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout after ${timeout}ms`);
      }

      const result = await action();
      if (condition(result)) {
        return result;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error(`Condition not met after ${maxAttempts} attempts`);
  }
}

/**
 * Screenshot Utilities
 */
export class ScreenshotUtilities {
  private page: any;
  private outputDir: string;

  constructor(page: any, outputDir: string = './screenshots') {
    this.page = page;
    this.outputDir = outputDir;
  }

  /**
   * Take screenshot on failure
   */
  async captureOnFailure(testName: string, error: Error): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.outputDir}/${testName}_${timestamp}_failure.png`;
    
    await this.page.screenshot({
      path: filename,
      fullPage: true,
    });

    return filename;
  }

  /**
   * Take screenshot with highlighted element
   */
  async captureWithHighlight(
    locator: any,
    filename: string
  ): Promise<string> {
    // Add highlight
    await locator.evaluate((el: HTMLElement) => {
      el.style.outline = '3px solid red';
      el.style.outlineOffset = '2px';
    });

    const path = `${this.outputDir}/${filename}`;
    await this.page.screenshot({ path, fullPage: true });

    // Remove highlight
    await locator.evaluate((el: HTMLElement) => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    });

    return path;
  }

  /**
   * Compare screenshots
   */
  async compareWithBaseline(
    currentPath: string,
    baselinePath: string,
    threshold: number = 0.1
  ): Promise<{ match: boolean; diffPercentage: number }> {
    // This would use pixelmatch or similar in real implementation
    // Placeholder for now
    return { match: true, diffPercentage: 0 };
  }
}

/**
 * Create utilities bundle for a specific application
 */
export function createTestUtilities(
  page: any,
  fingerprint: ApplicationFingerprint
): {
  wait: WaitUtilities;
  shadow: ShadowDomUtilities;
  frames: FrameUtilities;
  retry: typeof RetryUtilities;
  screenshot: ScreenshotUtilities;
} {
  return {
    wait: new WaitUtilities(page, fingerprint.application),
    shadow: new ShadowDomUtilities(page),
    frames: new FrameUtilities(page),
    retry: RetryUtilities,
    screenshot: new ScreenshotUtilities(page),
  };
}
