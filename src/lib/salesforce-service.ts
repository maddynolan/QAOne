/**
 * Salesforce Metadata Validation Service
 * 
 * Frontend service for:
 * - Connecting to Salesforce orgs
 * - Validating metadata (objects, fields, selectors)
 * - Autocomplete suggestions
 * - Workflow validation
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SalesforceConnectionStatus {
  loaded: boolean;
  objects_count: number;
  fields_count: number;
  picklists_count: number;
  last_updated: string | null;
  connected_to_org: boolean;
  instance_url: string | null;
}

export interface SalesforceCredentials {
  username: string;
  password: string;
  security_token?: string;
  domain?: 'login' | 'test';
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  suggestions?: string[];
  warning?: boolean;
}

export interface ObjectValidation extends ValidationResult {
  object_name: string;
  label?: string;
  custom?: boolean;
}

export interface FieldValidation extends ValidationResult {
  field_name: string;
  object_name: string;
  label?: string;
  type?: string;
  required?: boolean;
  custom?: boolean;
}

export interface SelectorValidation {
  valid: boolean;
  selector: string;
  warnings: string[];
  extracted: {
    fields: string[];
    objects: string[];
    record_ids: string[];
    components: string[];
  };
  suggestions: string[];
}

export interface WorkflowValidationStep {
  step_index: number;
  step_name: string;
  step_valid: boolean;
  validations: Array<{
    type: string;
    result: ValidationResult;
    object?: string;
    field?: string;
  }>;
  warnings: string[];
  suggestions: string[];
}

export interface WorkflowValidationResult {
  workflow_valid: boolean;
  total_steps: number;
  valid_steps: number;
  warnings_count: number;
  steps: WorkflowValidationStep[];
  summary: {
    objects_referenced: string[];
    fields_referenced: string[];
    components_used: string[];
    invalid_selectors: string[];
    unknown_fields: string[];
  };
}

export interface FieldSuggestion {
  name: string;
  label: string;
  type: string;
}

export interface ObjectSuggestion {
  name: string;
  label: string;
  custom: boolean;
}

export interface SalesforceObject {
  name: string;
  label: string;
  custom: boolean;
  fields_count: number;
  record_types_count: number;
}

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  custom: boolean;
  picklist: boolean;
}

class SalesforceService {
  private baseUrl = `${API_BASE_URL}/api/salesforce`;

  // =========================================================================
  // Connection Methods
  // =========================================================================

  /**
   * Get current Salesforce connection status
   */
  async getStatus(): Promise<SalesforceConnectionStatus> {
    const response = await fetch(`${this.baseUrl}/status`);
    if (!response.ok) {
      throw new Error('Failed to get Salesforce status');
    }
    return response.json();
  }

  /**
   * Connect to a Salesforce org
   */
  async connect(credentials: SalesforceCredentials): Promise<{
    connected: boolean;
    instance_url?: string;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        security_token: credentials.security_token || '',
        domain: credentials.domain || 'login'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to connect to Salesforce');
    }
    
    return response.json();
  }

  /**
   * Disconnect from Salesforce
   */
  async disconnect(): Promise<void> {
    await fetch(`${this.baseUrl}/disconnect`, { method: 'POST' });
  }

  // =========================================================================
  // Metadata Methods
  // =========================================================================

  /**
   * Fetch metadata from connected org
   */
  async fetchMetadata(objects?: string[]): Promise<{
    success: boolean;
    objects_fetched?: number;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/metadata/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects })
    });
    
    return response.json();
  }

  /**
   * List cached objects
   */
  async listObjects(): Promise<{ objects: SalesforceObject[]; total: number }> {
    const response = await fetch(`${this.baseUrl}/metadata/objects`);
    if (!response.ok) {
      throw new Error('Failed to list objects');
    }
    return response.json();
  }

  /**
   * Get fields for an object
   */
  async getObjectFields(objectName: string): Promise<{
    object: string;
    fields: SalesforceField[];
    cached: boolean;
  }> {
    const response = await fetch(`${this.baseUrl}/metadata/objects/${objectName}/fields`);
    if (!response.ok) {
      throw new Error(`Failed to get fields for ${objectName}`);
    }
    return response.json();
  }

  // =========================================================================
  // Validation Methods
  // =========================================================================

  /**
   * Validate a Salesforce object name
   */
  async validateObject(objectName: string): Promise<ObjectValidation> {
    const response = await fetch(`${this.baseUrl}/validate/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_name: objectName })
    });
    
    return response.json();
  }

  /**
   * Validate a field on an object
   */
  async validateField(objectName: string, fieldName: string): Promise<FieldValidation> {
    const response = await fetch(`${this.baseUrl}/validate/field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_name: objectName, field_name: fieldName })
    });
    
    return response.json();
  }

  /**
   * Validate a picklist value
   */
  async validatePicklistValue(
    objectName: string,
    fieldName: string,
    value: string
  ): Promise<ValidationResult> {
    const response = await fetch(`${this.baseUrl}/validate/picklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object_name: objectName,
        field_name: fieldName,
        value
      })
    });
    
    return response.json();
  }

  /**
   * Validate a Salesforce selector
   */
  async validateSelector(selector: string): Promise<SelectorValidation> {
    const response = await fetch(`${this.baseUrl}/validate/selector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selector })
    });
    
    return response.json();
  }

  /**
   * Validate an entire workflow
   */
  async validateWorkflow(
    nodes: Array<{ data: any }>,
    appType: string = 'salesforce'
  ): Promise<WorkflowValidationResult> {
    const response = await fetch(`${this.baseUrl}/validate/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, app_type: appType })
    });
    
    return response.json();
  }

  // =========================================================================
  // Autocomplete Methods
  // =========================================================================

  /**
   * Get field suggestions for autocomplete
   */
  async suggestFields(
    objectName: string,
    partial: string,
    limit: number = 10
  ): Promise<FieldSuggestion[]> {
    const response = await fetch(`${this.baseUrl}/suggest/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object_name: objectName, partial, limit })
    });
    
    const data = await response.json();
    return data.suggestions || [];
  }

  /**
   * Get object suggestions for autocomplete
   */
  async suggestObjects(partial: string, limit: number = 10): Promise<ObjectSuggestion[]> {
    const response = await fetch(`${this.baseUrl}/suggest/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partial, limit })
    });
    
    const data = await response.json();
    return data.suggestions || [];
  }

  // =========================================================================
  // SOQL Methods
  // =========================================================================

  /**
   * Execute a SOQL query
   */
  async executeSOQL(query: string, parameters?: Record<string, any>): Promise<{
    success: boolean;
    totalSize?: number;
    records?: any[];
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/soql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, parameters })
    });
    
    return response.json();
  }

  /**
   * Execute SOQL assertion
   */
  async executeSOQLAssertion(
    query: string,
    expectedCount: number,
    parameters?: Record<string, any>
  ): Promise<{
    passed: boolean;
    expected_count: number;
    actual_count: number;
    records?: any[];
    message: string;
  }> {
    const response = await fetch(`${this.baseUrl}/soql/assert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        expected_count: expectedCount,
        parameters
      })
    });
    
    return response.json();
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Extract Salesforce metadata from a selector string
   */
  extractMetadataFromSelector(selector: string): {
    fields: string[];
    objects: string[];
    components: string[];
  } {
    const result = {
      fields: [] as string[],
      objects: [] as string[],
      components: [] as string[]
    };

    // Extract custom fields (__c pattern)
    const fieldMatches = selector.match(/\b(\w+__c)\b/g);
    if (fieldMatches) {
      result.fields.push(...new Set(fieldMatches));
    }

    // Extract data-field attributes
    const dataFieldMatches = selector.match(/data-field=["']([^"']+)["']/g);
    if (dataFieldMatches) {
      const fields = dataFieldMatches.map(m => m.replace(/data-field=["']|["']/g, ''));
      result.fields.push(...fields.filter(f => !result.fields.includes(f)));
    }

    // Extract Lightning components
    const lightningMatches = selector.match(/lightning-[\w-]+/g);
    if (lightningMatches) {
      result.components.push(...new Set(lightningMatches));
    }

    // Extract LWC components
    const lwcMatches = selector.match(/c-[\w-]+/g);
    if (lwcMatches) {
      result.components.push(...new Set(lwcMatches));
    }

    return result;
  }

  /**
   * Check if a selector has unstable patterns
   */
  hasUnstablePatterns(selector: string): string[] {
    const warnings: string[] = [];
    
    const unstablePatterns = [
      { pattern: /auraId_\d+/, message: 'Aura dynamic ID (unstable)' },
      { pattern: /lwc-\d+/, message: 'LWC dynamic ID (unstable)' },
      { pattern: /slds-\d+/, message: 'SLDS dynamic class (unstable)' },
      { pattern: /ember\d+/, message: 'Ember ID (unstable)' },
      { pattern: /id=["']\d+["']/, message: 'Numeric ID (unstable)' },
    ];

    for (const { pattern, message } of unstablePatterns) {
      if (pattern.test(selector)) {
        warnings.push(message);
      }
    }

    return warnings;
  }

  /**
   * Suggest better selector for Salesforce elements
   */
  suggestBetterSelector(selector: string, elementInfo?: {
    tagName?: string;
    label?: string;
    name?: string;
    dataId?: string;
    ariaLabel?: string;
  }): string | null {
    // If we have element info, suggest a better selector
    if (elementInfo) {
      if (elementInfo.dataId) {
        return `[data-id="${elementInfo.dataId}"]`;
      }
      if (elementInfo.ariaLabel) {
        return `[aria-label="${elementInfo.ariaLabel}"]`;
      }
      if (elementInfo.name && elementInfo.tagName) {
        return `${elementInfo.tagName.toLowerCase()}[name="${elementInfo.name}"]`;
      }
      if (elementInfo.label) {
        return `lightning-input:has-text("${elementInfo.label}")`;
      }
    }
    
    return null;
  }
}

// Singleton instance
export const salesforceService = new SalesforceService();
