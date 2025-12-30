/**
 * Salesforce Test Integration Layer
 * 
 * This module connects Salesforce metadata (validation rules, flows, etc.)
 * to the test recording and suggestion systems.
 * 
 * KEY INTEGRATIONS:
 * 1. Context-Aware Recording - Suggest assertions based on current page/object
 * 2. Validation Rule Integration - Auto-suggest rule tests during recording
 * 3. Flow Awareness - Track flow triggers and suggest verifications
 * 4. Data Synchronization - Link test data to test cases
 * 5. Coverage Tracking - Know what's tested vs untested
 */

import { salesforceApi } from './salesforce-api';
import { testDataFactory } from './salesforce-test-data-factory';

// ========== TYPES ==========

interface SalesforceContext {
  currentObject?: string;
  currentRecordId?: string;
  currentPage?: 'list' | 'detail' | 'edit' | 'new';
  fields?: FieldInfo[];
  validationRules?: ValidationRuleInfo[];
  flows?: FlowInfo[];
  relatedObjects?: string[];
}

interface FieldInfo {
  name: string;
  label: string;
  type: string;
  required: boolean;
  length?: number;
  picklistValues?: string[];
}

interface ValidationRuleInfo {
  id: string;
  name: string;
  active: boolean;
  errorMessage?: string;
  description?: string;
  formula?: string;
}

interface FlowInfo {
  id: string;
  name: string;
  type: string;
  triggerType?: string;
  description?: string;
}

interface TestSuggestion {
  id: string;
  type: 'assertion' | 'action' | 'data' | 'flow' | 'validation';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  code?: string;
  relatedRule?: string;
  relatedFlow?: string;
}

interface RecordingContext {
  url: string;
  title: string;
  actions: any[];
  currentObject?: string;
  currentRecordId?: string;
}

// ========== MAIN CLASS ==========

class SalesforceTestIntegration {
  private cachedContext: SalesforceContext | null = null;
  private validationRulesCache: Map<string, ValidationRuleInfo[]> = new Map();
  private flowsCache: Map<string, FlowInfo[]> = new Map();
  private objectMetadataCache: Map<string, any> = new Map();

  // ========== CONTEXT DETECTION ==========

  /**
   * Detect current Salesforce context from URL
   */
  detectContextFromUrl(url: string): { object?: string; recordId?: string; page?: string } {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      // Lightning Experience patterns
      // /lightning/o/Account/list - List view
      // /lightning/r/Account/001xxx/view - Record view
      // /lightning/r/Account/001xxx/edit - Edit
      // /lightning/o/Account/new - New record
      
      const listMatch = path.match(/\/lightning\/o\/(\w+)\/list/);
      if (listMatch) {
        return { object: listMatch[1], page: 'list' };
      }
      
      const recordMatch = path.match(/\/lightning\/r\/(\w+)\/([a-zA-Z0-9]{15,18})\/(view|edit)/);
      if (recordMatch) {
        return { 
          object: recordMatch[1], 
          recordId: recordMatch[2],
          page: recordMatch[3] as 'view' | 'edit'
        };
      }
      
      const newMatch = path.match(/\/lightning\/o\/(\w+)\/new/);
      if (newMatch) {
        return { object: newMatch[1], page: 'new' };
      }
      
      // Classic patterns
      const classicMatch = path.match(/\/([a-zA-Z0-9]{15,18})/);
      if (classicMatch) {
        return { recordId: classicMatch[1] };
      }
      
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get full Salesforce context including metadata
   */
  async getFullContext(url: string): Promise<SalesforceContext> {
    const { object, recordId, page } = this.detectContextFromUrl(url);
    
    if (!object) {
      return {};
    }
    
    const context: SalesforceContext = {
      currentObject: object,
      currentRecordId: recordId,
      currentPage: page as any,
    };
    
    // Load validation rules
    if (!this.validationRulesCache.has(object)) {
      try {
        const rules = await this.loadValidationRules(object);
        this.validationRulesCache.set(object, rules);
      } catch (e) {
        console.warn('Could not load validation rules:', e);
      }
    }
    context.validationRules = this.validationRulesCache.get(object);
    
    // Load flows
    if (!this.flowsCache.has(object)) {
      try {
        const flows = await this.loadFlows(object);
        this.flowsCache.set(object, flows);
      } catch (e) {
        console.warn('Could not load flows:', e);
      }
    }
    context.flows = this.flowsCache.get(object);
    
    // Load fields
    if (!this.objectMetadataCache.has(object)) {
      try {
        const metadata = await salesforceApi.describeSObject(object);
        this.objectMetadataCache.set(object, metadata);
      } catch (e) {
        console.warn('Could not load object metadata:', e);
      }
    }
    const metadata = this.objectMetadataCache.get(object);
    if (metadata?.fields) {
      context.fields = metadata.fields.map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: !f.nillable && f.createable,
        length: f.length,
        picklistValues: f.picklistValues?.map((p: any) => p.value),
      }));
    }
    
    this.cachedContext = context;
    return context;
  }

  // ========== METADATA LOADING ==========

  async loadValidationRules(objectName: string): Promise<ValidationRuleInfo[]> {
    const currentOrg = salesforceApi.getCurrentOrg();
    if (!currentOrg) return [];
    
    try {
      const query = `SELECT Id, ValidationName, Active, Description, ErrorMessage 
                     FROM ValidationRule 
                     WHERE EntityDefinition.QualifiedApiName = '${objectName}'`;
      const result = await salesforceApi.toolingQuery(query);
      return (result.records || []).map((r: any) => ({
        id: r.Id,
        name: r.ValidationName,
        active: r.Active,
        errorMessage: r.ErrorMessage,
        description: r.Description,
      }));
    } catch (e) {
      console.error('Error loading validation rules:', e);
      return [];
    }
  }

  async loadFlows(objectName: string): Promise<FlowInfo[]> {
    const currentOrg = salesforceApi.getCurrentOrg();
    if (!currentOrg) return [];
    
    try {
      // Note: This is a simplified query - actual flow-to-object mapping is complex
      const query = `SELECT Id, DeveloperName, MasterLabel, ProcessType, Description 
                     FROM FlowDefinition 
                     WHERE ProcessType IN ('Workflow', 'AutoLaunchedFlow', 'RecordTriggeredFlow')
                     LIMIT 50`;
      const result = await salesforceApi.toolingQuery(query);
      return (result.records || []).map((r: any) => ({
        id: r.Id,
        name: r.MasterLabel || r.DeveloperName,
        type: r.ProcessType,
        description: r.Description,
      }));
    } catch (e) {
      console.error('Error loading flows:', e);
      return [];
    }
  }

  // ========== SUGGESTION ENGINE ==========

  /**
   * Generate suggestions based on current recording context
   */
  generateSuggestions(recordingContext: RecordingContext): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];
    const context = this.cachedContext;
    
    if (!context?.currentObject) {
      return suggestions;
    }
    
    // Validation Rule Suggestions
    if (context.validationRules?.length) {
      for (const rule of context.validationRules) {
        if (!rule.active) continue;
        
        // Suggest positive test
        suggestions.push({
          id: `val-pos-${rule.id}`,
          type: 'validation',
          priority: 'high',
          title: `Test: ${rule.name} (Valid)`,
          description: `Verify record saves when ${rule.name} conditions are met`,
          relatedRule: rule.name,
          code: `// Test ${rule.name} - Valid data
await expect(page.locator('[data-aura-class="forceDetailRecordMessage"]')).toContainText('saved');`,
        });
        
        // Suggest negative test
        suggestions.push({
          id: `val-neg-${rule.id}`,
          type: 'validation',
          priority: 'high',
          title: `Test: ${rule.name} (Invalid)`,
          description: rule.errorMessage || 'Verify validation error appears',
          relatedRule: rule.name,
          code: `// Test ${rule.name} - Invalid data
await expect(page.locator('.errorsList, .error, [data-aura-class="forceFormMessage"]')).toBeVisible();`,
        });
      }
    }
    
    // Flow Suggestions
    if (context.flows?.length) {
      for (const flow of context.flows.slice(0, 5)) {
        suggestions.push({
          id: `flow-${flow.id}`,
          type: 'flow',
          priority: 'medium',
          title: `Verify Flow: ${flow.name}`,
          description: flow.description || 'Verify flow executed correctly',
          relatedFlow: flow.name,
          code: `// Verify ${flow.name} executed
// Check for expected outcome of flow`,
        });
      }
    }
    
    // Field-based suggestions
    if (context.fields?.length) {
      // Required field assertions
      const requiredFields = context.fields.filter(f => f.required);
      if (requiredFields.length > 0) {
        suggestions.push({
          id: 'required-fields',
          type: 'assertion',
          priority: 'medium',
          title: 'Verify Required Fields',
          description: `Check ${requiredFields.length} required fields: ${requiredFields.slice(0, 3).map(f => f.label).join(', ')}...`,
          code: `// Verify required field validation
await page.click('[title="Save"]');
await expect(page.locator('.error, .validationError')).toBeVisible();`,
        });
      }
      
      // Picklist suggestions
      const picklistFields = context.fields.filter(f => f.type === 'picklist');
      if (picklistFields.length > 0) {
        suggestions.push({
          id: 'picklist-values',
          type: 'data',
          priority: 'low',
          title: 'Test Picklist Values',
          description: `Test various picklist combinations for ${picklistFields.length} fields`,
          code: `// Test different picklist values
${picklistFields.slice(0, 2).map(f => `// ${f.label}: ${f.picklistValues?.slice(0, 3).join(', ')}`).join('\n')}`,
        });
      }
    }
    
    // Context-specific suggestions based on page type
    if (context.currentPage === 'new' || context.currentPage === 'edit') {
      suggestions.push({
        id: 'save-cancel',
        type: 'action',
        priority: 'medium',
        title: 'Test Save & Cancel',
        description: 'Verify save commits changes, cancel discards them',
        code: `// Test cancel button
await page.click('[title="Cancel"]');
// Verify no changes saved

// Test save button  
await page.click('[title="Save"]');
await expect(page.locator('.toastMessage')).toContainText('saved');`,
      });
    }
    
    if (context.currentPage === 'detail' || context.currentPage === 'list') {
      suggestions.push({
        id: 'crud-operations',
        type: 'action',
        priority: 'medium',
        title: 'Test CRUD Actions',
        description: 'Test Edit, Delete, Clone actions',
        code: `// Test edit action
await page.click('[name="Edit"]');
await expect(page.url()).toContain('edit');

// Test delete action
await page.click('[name="Delete"]');
await expect(page.locator('.confirmDelete')).toBeVisible();`,
      });
    }
    
    return suggestions.sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return priority[a.priority] - priority[b.priority];
    });
  }

  // ========== TEST DATA INTEGRATION ==========

  /**
   * Generate test data for current context
   */
  async generateContextualTestData(count: number = 3): Promise<any[]> {
    const context = this.cachedContext;
    if (!context?.currentObject) {
      return [];
    }
    
    try {
      const records = testDataFactory.generateRecords({
        objectName: context.currentObject,
        count,
        industry: 'generic',
      });
      return records;
    } catch (e) {
      console.error('Error generating test data:', e);
      return [];
    }
  }

  /**
   * Generate test data that triggers specific validation rule
   */
  async generateDataForValidationRule(
    ruleName: string, 
    shouldPass: boolean
  ): Promise<any> {
    const context = this.cachedContext;
    if (!context?.currentObject) return null;
    
    // Generate base record
    const records = testDataFactory.generateRecords({
      objectName: context.currentObject,
      count: 1,
      industry: 'generic',
    });
    
    const record = records[0]?.data;
    if (!record) return null;
    
    // TODO: Analyze rule formula to determine which fields to modify
    // For now, return base record
    return record;
  }

  // ========== ASSERTION GENERATION ==========

  /**
   * Generate Playwright assertions for current context
   */
  generateAssertions(): string[] {
    const context = this.cachedContext;
    if (!context?.currentObject) return [];
    
    const assertions: string[] = [];
    
    // Page load assertion
    assertions.push(`// Verify ${context.currentObject} page loaded`);
    assertions.push(`await expect(page).toHaveURL(/${context.currentObject.toLowerCase()}/i);`);
    
    // Validation rule assertions
    if (context.validationRules?.length) {
      assertions.push(`\n// Validation Rules (${context.validationRules.length} active)`);
      for (const rule of context.validationRules.slice(0, 3)) {
        if (rule.errorMessage) {
          assertions.push(`// ${rule.name}`);
          assertions.push(`// await expect(page.locator('.errorsList')).toContainText('${rule.errorMessage.slice(0, 50)}...');`);
        }
      }
    }
    
    // Field assertions
    if (context.fields?.length) {
      const keyFields = context.fields.filter(f => 
        ['Name', 'Email', 'Phone', 'Status', 'Stage'].includes(f.name) ||
        f.name.endsWith('__c') && f.required
      );
      
      if (keyFields.length > 0) {
        assertions.push(`\n// Key Field Assertions`);
        for (const field of keyFields.slice(0, 5)) {
          assertions.push(`// await expect(page.locator('[data-field="${field.name}"]')).toBeVisible();`);
        }
      }
    }
    
    return assertions;
  }

  // ========== COVERAGE TRACKING ==========

  /**
   * Calculate test coverage for current context
   */
  calculateCoverage(existingTests: any[]): {
    validationRulesCovered: number;
    validationRulesTotal: number;
    flowsCovered: number;
    flowsTotal: number;
    fieldsCovered: number;
    fieldsTotal: number;
    overallPercentage: number;
  } {
    const context = this.cachedContext;
    if (!context) {
      return {
        validationRulesCovered: 0,
        validationRulesTotal: 0,
        flowsCovered: 0,
        flowsTotal: 0,
        fieldsCovered: 0,
        fieldsTotal: 0,
        overallPercentage: 0,
      };
    }
    
    // TODO: Implement actual coverage calculation based on test content
    const validationRulesTotal = context.validationRules?.length || 0;
    const flowsTotal = context.flows?.length || 0;
    const fieldsTotal = context.fields?.length || 0;
    
    // Placeholder coverage (would need actual test analysis)
    const validationRulesCovered = Math.floor(validationRulesTotal * 0.3);
    const flowsCovered = Math.floor(flowsTotal * 0.2);
    const fieldsCovered = Math.floor(fieldsTotal * 0.5);
    
    const total = validationRulesTotal + flowsTotal + fieldsTotal;
    const covered = validationRulesCovered + flowsCovered + fieldsCovered;
    const overallPercentage = total > 0 ? Math.round((covered / total) * 100) : 0;
    
    return {
      validationRulesCovered,
      validationRulesTotal,
      flowsCovered,
      flowsTotal,
      fieldsCovered,
      fieldsTotal,
      overallPercentage,
    };
  }

  // ========== HELPERS ==========

  clearCache() {
    this.cachedContext = null;
    this.validationRulesCache.clear();
    this.flowsCache.clear();
    this.objectMetadataCache.clear();
  }

  getCachedContext(): SalesforceContext | null {
    return this.cachedContext;
  }
}

// Export singleton
export const salesforceTestIntegration = new SalesforceTestIntegration();

// Export types
export type { 
  SalesforceContext, 
  FieldInfo, 
  ValidationRuleInfo, 
  FlowInfo, 
  TestSuggestion,
  RecordingContext 
};



