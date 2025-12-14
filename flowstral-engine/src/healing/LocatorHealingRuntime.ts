/**
 * Flowstral - Locator Healing Runtime
 * Runtime module for validating and healing locators during test execution
 */

import {
  AutoHealingLocator,
  LocatorStrategy,
  ElementSignature,
  RecordedElement,
  EnterpriseApplication,
  ApplicationFingerprint,
} from '../types';

export interface HealingResult {
  success: boolean;
  originalLocator: LocatorStrategy;
  healedLocator?: LocatorStrategy;
  strategyUsed?: string;
  confidence: number;
  attempts: number;
  timeTaken: number;
}

export interface ValidationResult {
  isValid: boolean;
  locator: LocatorStrategy;
  matchedElements: number;
  warning?: string;
}

export interface ElementMatch {
  element: any; // Playwright ElementHandle
  score: number;
  matchedAttributes: string[];
  signatureMatch: number;
}

/**
 * Locator Healing Runtime
 * Provides real-time locator validation and healing during test execution
 */
export class LocatorHealingRuntime {
  private page: any; // Playwright Page
  private healingHistory: Map<string, HealingResult[]> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private application: EnterpriseApplication;

  constructor(page: any, application: EnterpriseApplication = 'unknown') {
    this.page = page;
    this.application = application;
  }

  /**
   * Find element with auto-healing support
   */
  async findWithHealing(
    locator: AutoHealingLocator,
    timeout: number = 10000
  ): Promise<any> {
    const startTime = Date.now();
    let attempts = 0;

    // Try primary locator first
    try {
      const element = await this.tryLocator(locator.primary, timeout / 2);
      if (element) {
        await this.validateSignature(element, locator.elementSignature);
        return element;
      }
    } catch (e) {
      console.log(`Primary locator failed: ${locator.primary.value}`);
    }

    // Try fallback strategies
    for (const fallback of locator.fallbacks) {
      attempts++;
      try {
        const element = await this.tryLocator(fallback, 2000);
        if (element) {
          const signatureMatch = await this.validateSignature(element, locator.elementSignature);
          if (signatureMatch >= 0.7) {
            // Record successful heal
            this.recordHeal({
              success: true,
              originalLocator: locator.primary,
              healedLocator: fallback,
              strategyUsed: fallback.type,
              confidence: signatureMatch * 100,
              attempts,
              timeTaken: Date.now() - startTime,
            });
            return element;
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Last resort: signature-based search
    const healedElement = await this.healBySignature(locator.elementSignature, timeout);
    if (healedElement) {
      this.recordHeal({
        success: true,
        originalLocator: locator.primary,
        strategyUsed: 'signature-search',
        confidence: healedElement.score * 100,
        attempts: attempts + 1,
        timeTaken: Date.now() - startTime,
      });
      return healedElement.element;
    }

    throw new Error(
      `Element not found after ${attempts} healing attempts. ` +
      `Locator: ${locator.primary.value}`
    );
  }

  /**
   * Try a single locator strategy
   */
  private async tryLocator(strategy: LocatorStrategy, timeout: number): Promise<any> {
    let locator: any;

    switch (strategy.type) {
      case 'role':
        locator = await this.parseRoleLocator(strategy.playwrightCode);
        break;
      case 'text':
        locator = await this.parseTextLocator(strategy.playwrightCode);
        break;
      case 'label':
        locator = await this.parseLabelLocator(strategy.playwrightCode);
        break;
      case 'testid':
        locator = await this.parseTestIdLocator(strategy.playwrightCode);
        break;
      case 'placeholder':
        locator = await this.parsePlaceholderLocator(strategy.playwrightCode);
        break;
      case 'shadow-locator':
        locator = await this.handleShadowLocator(strategy);
        break;
      default:
        // CSS or XPath
        locator = this.page.locator(strategy.value);
    }

    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * Parse role-based locator
   */
  private async parseRoleLocator(code: string): Promise<any> {
    const match = code.match(/getByRole\('([^']+)'(?:,\s*\{([^}]+)\})?\)/);
    if (!match) throw new Error('Invalid role locator');

    const role = match[1];
    const options: any = {};

    if (match[2]) {
      const optionsStr = match[2];
      const nameMatch = optionsStr.match(/name:\s*'([^']+)'/);
      if (nameMatch) options.name = nameMatch[1];
      if (optionsStr.includes('exact: true')) options.exact = true;
    }

    return this.page.getByRole(role, options);
  }

  /**
   * Parse text-based locator
   */
  private async parseTextLocator(code: string): Promise<any> {
    const match = code.match(/getByText\('([^']+)'(?:,\s*\{([^}]+)\})?\)/);
    if (!match) throw new Error('Invalid text locator');

    const text = match[1];
    const options: any = {};

    if (match[2]?.includes('exact: true')) {
      options.exact = true;
    }

    return this.page.getByText(text, options);
  }

  /**
   * Parse label-based locator
   */
  private async parseLabelLocator(code: string): Promise<any> {
    const match = code.match(/getByLabel\('([^']+)'\)/);
    if (!match) throw new Error('Invalid label locator');
    return this.page.getByLabel(match[1]);
  }

  /**
   * Parse testid-based locator
   */
  private async parseTestIdLocator(code: string): Promise<any> {
    const match = code.match(/getByTestId\('([^']+)'\)/);
    if (!match) throw new Error('Invalid testid locator');
    return this.page.getByTestId(match[1]);
  }

  /**
   * Parse placeholder-based locator
   */
  private async parsePlaceholderLocator(code: string): Promise<any> {
    const match = code.match(/getByPlaceholder\('([^']+)'\)/);
    if (!match) throw new Error('Invalid placeholder locator');
    return this.page.getByPlaceholder(match[1]);
  }

  /**
   * Handle shadow DOM locators
   */
  private async handleShadowLocator(strategy: LocatorStrategy): Promise<any> {
    const segments = JSON.parse(strategy.value);
    let current = this.page;

    for (const segment of segments) {
      current = current.locator(segment.hostSelector);
      // Playwright's >> syntax pierces shadow DOM
      if (segment.shadowSelector) {
        current = current.locator(`>> ${segment.shadowSelector}`);
      }
    }

    return current;
  }

  /**
   * Validate element against signature
   */
  private async validateSignature(
    element: any,
    signature: ElementSignature
  ): Promise<number> {
    try {
      const elementData = await element.evaluate((el: Element) => ({
        tagName: el.tagName.toLowerCase(),
        textContent: el.textContent?.trim().substring(0, 100),
        attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
        rect: el.getBoundingClientRect(),
        role: el.getAttribute('role'),
      }));

      let score = 0;
      let checks = 0;

      // Check tag name
      checks++;
      if (elementData.tagName === signature.tagName.toLowerCase()) {
        score++;
      }

      // Check text content
      if (signature.textContent) {
        checks++;
        if (elementData.textContent?.includes(signature.textContent.substring(0, 20))) {
          score++;
        }
      }

      // Check role
      if (signature.semanticRole) {
        checks++;
        if (elementData.role === signature.semanticRole) {
          score++;
        }
      }

      // Check stable attributes
      for (const attr of signature.attributes) {
        checks++;
        if (elementData.attributes[attr.name] === attr.value) {
          score++;
        }
      }

      // Check visual position (approximate)
      const { approximateLocation } = signature.visualPosition;
      if (approximateLocation) {
        checks++;
        const xMatch = Math.abs(elementData.rect.x - approximateLocation.x) < 200;
        const yMatch = Math.abs(elementData.rect.y - approximateLocation.y) < 200;
        if (xMatch && yMatch) {
          score += 0.5;
        }
      }

      return checks > 0 ? score / checks : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Heal by searching for elements matching signature
   */
  private async healBySignature(
    signature: ElementSignature,
    timeout: number
  ): Promise<ElementMatch | null> {
    const candidates = await this.findCandidateElements(signature);

    if (candidates.length === 0) {
      return null;
    }

    // Score and rank candidates
    const matches: ElementMatch[] = [];

    for (const candidate of candidates) {
      const score = await this.scoreCandidate(candidate, signature);
      if (score.score > 0.5) {
        matches.push(score);
      }
    }

    // Return best match
    matches.sort((a, b) => b.score - a.score);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Find candidate elements that might match the signature
   */
  private async findCandidateElements(signature: ElementSignature): Promise<any[]> {
    const selectors: string[] = [];

    // By tag name
    selectors.push(signature.tagName.toLowerCase());

    // By role
    if (signature.semanticRole) {
      selectors.push(`[role="${signature.semanticRole}"]`);
    }

    // By stable attributes
    for (const attr of signature.attributes.filter(a => a.stability === 'high')) {
      selectors.push(`[${attr.name}="${attr.value}"]`);
    }

    const candidates: any[] = [];

    for (const selector of selectors) {
      try {
        const elements = await this.page.locator(selector).all();
        candidates.push(...elements);
      } catch (e) {
        // Ignore failed selectors
      }
    }

    // Deduplicate
    return [...new Set(candidates)];
  }

  /**
   * Score how well a candidate matches the signature
   */
  private async scoreCandidate(
    candidate: any,
    signature: ElementSignature
  ): Promise<ElementMatch> {
    const matchedAttributes: string[] = [];
    let score = 0;

    try {
      const data = await candidate.evaluate((el: Element) => ({
        tagName: el.tagName,
        text: el.textContent?.trim().substring(0, 100),
        attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
        rect: el.getBoundingClientRect(),
        role: el.getAttribute('role'),
      }));

      // Tag match (required)
      if (data.tagName.toLowerCase() !== signature.tagName.toLowerCase()) {
        return { element: candidate, score: 0, matchedAttributes, signatureMatch: 0 };
      }
      score += 0.2;
      matchedAttributes.push('tagName');

      // Text match
      if (signature.textContent && data.text?.includes(signature.textContent.substring(0, 20))) {
        score += 0.25;
        matchedAttributes.push('textContent');
      }

      // Role match
      if (signature.semanticRole && data.role === signature.semanticRole) {
        score += 0.15;
        matchedAttributes.push('role');
      }

      // Attribute matches
      for (const attr of signature.attributes) {
        if (data.attributes[attr.name] === attr.value) {
          score += 0.1;
          matchedAttributes.push(attr.name);
        }
      }

      // Position match
      const { approximateLocation } = signature.visualPosition;
      if (approximateLocation) {
        const distance = Math.sqrt(
          Math.pow(data.rect.x - approximateLocation.x, 2) +
          Math.pow(data.rect.y - approximateLocation.y, 2)
        );
        if (distance < 100) {
          score += 0.15;
          matchedAttributes.push('position');
        } else if (distance < 200) {
          score += 0.05;
        }
      }

      // Contextual hints match
      for (const hint of signature.contextualHints) {
        if (hint.type === 'nearby-text' && data.text?.includes(hint.value)) {
          score += 0.05 * hint.reliability;
        }
      }

      return {
        element: candidate,
        score: Math.min(score, 1),
        matchedAttributes,
        signatureMatch: score,
      };
    } catch (e) {
      return { element: candidate, score: 0, matchedAttributes, signatureMatch: 0 };
    }
  }

  /**
   * Record a healing event
   */
  private recordHeal(result: HealingResult): void {
    const key = result.originalLocator.value;
    if (!this.healingHistory.has(key)) {
      this.healingHistory.set(key, []);
    }
    this.healingHistory.get(key)!.push(result);
  }

  /**
   * Get healing statistics
   */
  getHealingStats(): {
    totalHeals: number;
    successRate: number;
    avgAttempts: number;
    avgTime: number;
    strategyBreakdown: Record<string, number>;
  } {
    let totalHeals = 0;
    let successfulHeals = 0;
    let totalAttempts = 0;
    let totalTime = 0;
    const strategyBreakdown: Record<string, number> = {};

    for (const heals of this.healingHistory.values()) {
      for (const heal of heals) {
        totalHeals++;
        if (heal.success) {
          successfulHeals++;
          totalAttempts += heal.attempts;
          totalTime += heal.timeTaken;
          const strategy = heal.strategyUsed || 'unknown';
          strategyBreakdown[strategy] = (strategyBreakdown[strategy] || 0) + 1;
        }
      }
    }

    return {
      totalHeals,
      successRate: totalHeals > 0 ? successfulHeals / totalHeals : 0,
      avgAttempts: successfulHeals > 0 ? totalAttempts / successfulHeals : 0,
      avgTime: successfulHeals > 0 ? totalTime / successfulHeals : 0,
      strategyBreakdown,
    };
  }

  /**
   * Generate healing report
   */
  generateHealingReport(): string {
    const stats = this.getHealingStats();
    const lines: string[] = [
      '# Locator Healing Report',
      '',
      '## Summary',
      `- Total healing attempts: ${stats.totalHeals}`,
      `- Success rate: ${(stats.successRate * 100).toFixed(1)}%`,
      `- Average attempts per heal: ${stats.avgAttempts.toFixed(1)}`,
      `- Average time per heal: ${stats.avgTime.toFixed(0)}ms`,
      '',
      '## Strategy Breakdown',
    ];

    for (const [strategy, count] of Object.entries(stats.strategyBreakdown)) {
      lines.push(`- ${strategy}: ${count} heals`);
    }

    lines.push('', '## Detailed History');

    for (const [locator, heals] of this.healingHistory.entries()) {
      lines.push(`\n### Locator: \`${locator}\``);
      for (const heal of heals) {
        lines.push(
          `- ${heal.success ? '✓' : '✗'} ` +
          `Strategy: ${heal.strategyUsed}, ` +
          `Confidence: ${heal.confidence.toFixed(0)}%, ` +
          `Attempts: ${heal.attempts}, ` +
          `Time: ${heal.timeTaken}ms`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Suggest locator improvements based on healing history
   */
  suggestImprovements(): Array<{
    locator: string;
    issue: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const suggestions: Array<{
      locator: string;
      issue: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    for (const [locator, heals] of this.healingHistory.entries()) {
      const failCount = heals.filter(h => !h.success).length;
      const avgAttempts = heals.reduce((sum, h) => sum + h.attempts, 0) / heals.length;
      const successfulStrategies = heals
        .filter(h => h.success && h.healedLocator)
        .map(h => h.healedLocator!);

      if (failCount > 2) {
        suggestions.push({
          locator,
          issue: `Failed ${failCount} times`,
          suggestion: 'Consider using a more stable selector strategy',
          priority: 'high',
        });
      }

      if (avgAttempts > 3) {
        suggestions.push({
          locator,
          issue: `Average ${avgAttempts.toFixed(1)} attempts to heal`,
          suggestion: successfulStrategies.length > 0
            ? `Consider switching to: ${successfulStrategies[0].type}`
            : 'Add more fallback strategies',
          priority: 'medium',
        });
      }

      // Check for frequent healing to same strategy
      const strategyCount: Record<string, number> = {};
      for (const heal of heals.filter(h => h.success && h.strategyUsed)) {
        strategyCount[heal.strategyUsed!] = (strategyCount[heal.strategyUsed!] || 0) + 1;
      }

      for (const [strategy, count] of Object.entries(strategyCount)) {
        if (count >= 3 && strategy !== 'signature-search') {
          suggestions.push({
            locator,
            issue: `Frequently heals to ${strategy}`,
            suggestion: `Update primary locator to use ${strategy} strategy`,
            priority: 'low',
          });
        }
      }
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Clear healing history
   */
  clearHistory(): void {
    this.healingHistory.clear();
    this.validationCache.clear();
  }
}

/**
 * Factory for creating healing runtime instances
 */
export function createHealingRuntime(
  page: any,
  fingerprint: ApplicationFingerprint
): LocatorHealingRuntime {
  return new LocatorHealingRuntime(page, fingerprint.application);
}
