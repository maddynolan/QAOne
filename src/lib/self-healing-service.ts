import { TestRunResult } from './playwright-runner';

export interface SelfHealingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    errorPattern: string;
    elementType?: string;
    maxOccurrences: number;
    timeWindow: number; // in hours
  };
  actions: {
    type: 'selector_update' | 'wait_time_increase' | 'retry_count_increase' | 'skip_test';
    parameters: Record<string, any>;
  };
  successRate: number;
  lastApplied?: Date;
  appliedCount: number;
}

export interface HealingSuggestion {
  ruleId: string;
  testId: string;
  confidence: number;
  suggestion: string;
  parameters: Record<string, any>;
  estimatedSuccessRate: number;
}

export class SelfHealingService {
  private rules: Map<string, SelfHealingRule> = new Map();
  private testFailures: Map<string, Array<{ timestamp: Date; error: string; context: any }>> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    const defaultRules: SelfHealingRule[] = [
      {
        id: 'selector-stability',
        name: 'Selector Stability',
        description: 'Update unstable selectors based on failure patterns',
        enabled: true,
        conditions: {
          errorPattern: 'Element not found|TimeoutError|Element not visible',
          elementType: 'button|input|select|div',
          maxOccurrences: 3,
          timeWindow: 24
        },
        actions: {
          type: 'selector_update',
          parameters: {
            strategy: 'more_specific',
            fallbackSelectors: true
          }
        },
        successRate: 0,
        appliedCount: 0
      },
      {
        id: 'wait-time-optimization',
        name: 'Wait Time Optimization',
        description: 'Increase wait times for flaky elements',
        enabled: true,
        conditions: {
          errorPattern: 'TimeoutError|Element not found',
          maxOccurrences: 2,
          timeWindow: 12
        },
        actions: {
          type: 'wait_time_increase',
          parameters: {
            multiplier: 1.5,
            maxWaitTime: 10000
          }
        },
        successRate: 0,
        appliedCount: 0
      },
      {
        id: 'retry-mechanism',
        name: 'Retry Mechanism',
        description: 'Add retry logic for intermittent failures',
        enabled: true,
        conditions: {
          errorPattern: 'NetworkError|TimeoutError|Element not found',
          maxOccurrences: 2,
          timeWindow: 6
        },
        actions: {
          type: 'retry_count_increase',
          parameters: {
            retryCount: 3,
            retryDelay: 1000
          }
        },
        successRate: 0,
        appliedCount: 0
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  async analyzeFailure(testResult: TestRunResult): Promise<HealingSuggestion[]> {
    const suggestions: HealingSuggestion[] = [];
    
    if (testResult.status !== 'failed' || !testResult.error) {
      return suggestions;
    }

    // Record the failure
    this.recordFailure(testResult);

    // Analyze against each rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const matches = this.checkRuleConditions(rule, testResult);
      if (matches) {
        const suggestion = this.generateSuggestion(rule, testResult);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private recordFailure(testResult: TestRunResult) {
    const testId = testResult.case_id;
    if (!this.testFailures.has(testId)) {
      this.testFailures.set(testId, []);
    }

    const failures = this.testFailures.get(testId)!;
    failures.push({
      timestamp: new Date(),
      error: testResult.error || '',
      context: {
        screenshots: testResult.screenshots,
        logs: testResult.logs
      }
    });

    // Keep only recent failures (last 7 days)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFailures = failures.filter(f => f.timestamp > cutoff);
    this.testFailures.set(testId, recentFailures);
  }

  private checkRuleConditions(rule: SelfHealingRule, testResult: TestRunResult): boolean {
    const { conditions } = rule;
    const error = testResult.error || '';

    // Check error pattern
    const errorRegex = new RegExp(conditions.errorPattern, 'i');
    if (!errorRegex.test(error)) {
      return false;
    }

    // Check element type if specified
    if (conditions.elementType) {
      const elementRegex = new RegExp(conditions.elementType, 'i');
      if (!elementRegex.test(error)) {
        return false;
      }
    }

    // Check occurrence count within time window
    const testId = testResult.case_id;
    const failures = this.testFailures.get(testId) || [];
    const cutoff = new Date(Date.now() - conditions.timeWindow * 60 * 60 * 1000);
    const recentFailures = failures.filter(f => f.timestamp > cutoff);

    return recentFailures.length >= conditions.maxOccurrences;
  }

  private generateSuggestion(rule: SelfHealingRule, testResult: TestRunResult): HealingSuggestion | null {
    const { actions } = rule;
    const error = testResult.error || '';

    let suggestion: string;
    let parameters: Record<string, any> = {};
    let confidence = 0.7; // Base confidence

    switch (actions.type) {
      case 'selector_update':
        suggestion = `Update selector for "${this.extractElementFromError(error)}"`;
        parameters = {
          ...actions.parameters,
          currentSelector: this.extractSelectorFromError(error),
          suggestedSelectors: this.generateSelectorSuggestions(error)
        };
        confidence = 0.8;
        break;

      case 'wait_time_increase':
        suggestion = `Increase wait time for "${this.extractElementFromError(error)}"`;
        parameters = {
          ...actions.parameters,
          currentWaitTime: this.extractWaitTimeFromError(error),
          suggestedWaitTime: this.calculateSuggestedWaitTime(error, actions.parameters)
        };
        confidence = 0.7;
        break;

      case 'retry_count_increase':
        suggestion = `Add retry logic for "${this.extractElementFromError(error)}"`;
        parameters = {
          ...actions.parameters,
          retryDelay: actions.parameters.retryDelay
        };
        confidence = 0.6;
        break;

      case 'skip_test':
        suggestion = `Skip test "${testResult.case_id}" due to persistent failures`;
        parameters = {
          reason: 'Persistent failures',
          skipDuration: 24 // hours
        };
        confidence = 0.5;
        break;

      default:
        return null;
    }

    return {
      ruleId: rule.id,
      testId: testResult.case_id,
      confidence,
      suggestion,
      parameters,
      estimatedSuccessRate: rule.successRate
    };
  }

  private extractElementFromError(error: string): string {
    // Extract element information from error message
    const elementMatch = error.match(/(button|input|select|div|span|a|img|form)\s*[^\s]*/i);
    return elementMatch ? elementMatch[0] : 'element';
  }

  private extractSelectorFromError(error: string): string {
    // Extract selector from error message
    const selectorMatch = error.match(/selector[:\s]+([^\s]+)/i);
    return selectorMatch ? selectorMatch[1] : 'unknown';
  }

  private generateSelectorSuggestions(error: string): string[] {
    // Generate alternative selectors based on error context
    const suggestions = [];
    const element = this.extractElementFromError(error);
    
    if (element.includes('button')) {
      suggestions.push('button[type="submit"]');
      suggestions.push('button:contains("Submit")');
      suggestions.push('input[type="submit"]');
    } else if (element.includes('input')) {
      suggestions.push('input[type="text"]');
      suggestions.push('input[placeholder*="email"]');
      suggestions.push('input[name*="email"]');
    }

    return suggestions;
  }

  private extractWaitTimeFromError(error: string): number {
    // Extract wait time from error message
    const waitMatch = error.match(/(\d+)ms|(\d+)s/i);
    if (waitMatch) {
      return waitMatch[1] ? parseInt(waitMatch[1]) : parseInt(waitMatch[2]) * 1000;
    }
    return 5000; // Default wait time
  }

  private calculateSuggestedWaitTime(error: string, parameters: any): number {
    const currentWaitTime = this.extractWaitTimeFromError(error);
    const multiplier = parameters.multiplier || 1.5;
    const maxWaitTime = parameters.maxWaitTime || 10000;
    
    return Math.min(currentWaitTime * multiplier, maxWaitTime);
  }

  async applyHealingSuggestion(suggestion: HealingSuggestion): Promise<boolean> {
    try {
      const rule = this.rules.get(suggestion.ruleId);
      if (!rule) return false;

      // Apply the healing suggestion
      const success = await this.executeHealingAction(suggestion);
      
      if (success) {
        rule.appliedCount++;
        rule.lastApplied = new Date();
        
        // Update success rate
        const totalApplied = rule.appliedCount;
        const successfulApplications = Math.floor(totalApplied * rule.successRate);
        rule.successRate = (successfulApplications + 1) / (totalApplied + 1);
      }

      return success;
    } catch (error) {
      console.error('Failed to apply healing suggestion:', error);
      return false;
    }
  }

  private async executeHealingAction(suggestion: HealingSuggestion): Promise<boolean> {
    // In a real implementation, this would:
    // 1. Update test case selectors
    // 2. Modify wait times
    // 3. Add retry logic
    // 4. Skip tests temporarily
    
    console.log(`Applying healing suggestion: ${suggestion.suggestion}`, suggestion.parameters);
    
    // Simulate success
    return Math.random() > 0.3; // 70% success rate
  }

  getRules(): SelfHealingRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(ruleId: string, updates: Partial<SelfHealingRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    return true;
  }

  createRule(rule: Omit<SelfHealingRule, 'id' | 'successRate' | 'appliedCount'>): string {
    const id = `rule_${Date.now()}`;
    const newRule: SelfHealingRule = {
      ...rule,
      id,
      successRate: 0,
      appliedCount: 0
    };
    
    this.rules.set(id, newRule);
    return id;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getTestFailureHistory(testId: string): Array<{ timestamp: Date; error: string; context: any }> {
    return this.testFailures.get(testId) || [];
  }
}

export const selfHealingService = new SelfHealingService();
