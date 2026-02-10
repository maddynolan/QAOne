/**
 * Salesforce API Service
 * 
 * Core service layer for all Salesforce API interactions.
 * Handles authentication, REST API, Bulk API, Tooling API, and Metadata API.
 * 
 * Features:
 * - Multi-org credential management
 * - OAuth 2.0 and Username-Password flows
 * - REST API CRUD operations
 * - SOQL/SOSL query execution
 * - Bulk API 2.0 for mass operations
 * - Tooling API for metadata
 * - Rate limiting and error handling
 */

import { API_BASE_URL } from '@/lib/api-config';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesforceOrg {
  id: string;
  name: string;
  instanceUrl: string;
  loginUrl: string;
  username: string;
  orgType: 'production' | 'sandbox' | 'developer' | 'scratch';
  color: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  apiVersion: string;
  lastUsed?: string;
  isDefault?: boolean;
}

export interface SalesforceCredentials {
  username: string;
  password: string;
  securityToken?: string;
  clientId?: string;
  clientSecret?: string;
  loginUrl?: string;
}

export interface SalesforceAuthResult {
  accessToken: string;
  instanceUrl: string;
  id: string;
  tokenType: string;
  issuedAt: string;
  signature: string;
  refreshToken?: string;
}

export interface SObjectDescribe {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  custom: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  queryable: boolean;
  fields: SObjectField[];
  childRelationships: ChildRelationship[];
  recordTypeInfos: RecordTypeInfo[];
}

export interface SObjectField {
  name: string;
  label: string;
  type: string;
  length: number;
  precision: number;
  scale: number;
  nillable: boolean;
  createable: boolean;
  updateable: boolean;
  unique: boolean;
  externalId: boolean;
  custom: boolean;
  defaultValue: any;
  picklistValues: PicklistValue[];
  referenceTo: string[];
  relationshipName: string;
  inlineHelpText: string;
  calculated: boolean;
  formulaTreatNullNumberAsZero: boolean;
}

export interface PicklistValue {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

export interface ChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string;
  cascadeDelete: boolean;
}

export interface RecordTypeInfo {
  recordTypeId: string;
  name: string;
  developerName: string;
  available: boolean;
  defaultRecordTypeMapping: boolean;
  master: boolean;
}

export interface QueryResult<T = any> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface BulkJob {
  id: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete' | 'query';
  object: string;
  state: 'Open' | 'UploadComplete' | 'InProgress' | 'Aborted' | 'JobComplete' | 'Failed';
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  createdDate: string;
  systemModstamp: string;
  concurrencyMode: string;
  contentType: string;
  apiVersion: string;
  lineEnding: string;
  columnDelimiter: string;
}

export interface BulkJobResult {
  id: string;
  success: boolean;
  created: boolean;
  errors: string[];
}

export interface ApexTestResult {
  id: string;
  queueItemId: string;
  stackTrace: string;
  message: string;
  methodName: string;
  outcome: 'Pass' | 'Fail' | 'CompileFail' | 'Skip';
  apexClass: {
    id: string;
    name: string;
    namespacePrefix: string;
  };
  runTime: number;
  testTimestamp: string;
}

export interface ApiLimits {
  DailyApiRequests: { Max: number; Remaining: number };
  DailyBulkApiRequests: { Max: number; Remaining: number };
  DailyAsyncApexExecutions: { Max: number; Remaining: number };
  HourlyTimeBasedWorkflow: { Max: number; Remaining: number };
  DailyStreamingApiEvents: { Max: number; Remaining: number };
  SingleEmail: { Max: number; Remaining: number };
  MassEmail: { Max: number; Remaining: number };
}

export interface UserPermissions {
  objectPermissions: ObjectPermission[];
  fieldPermissions: FieldPermission[];
}

export interface ObjectPermission {
  objectName: string;
  canCreate: boolean;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewAll: boolean;
  canModifyAll: boolean;
}

export interface FieldPermission {
  objectName: string;
  fieldName: string;
  canRead: boolean;
  canEdit: boolean;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  ORGS: 'salesforce_orgs',
  CURRENT_ORG: 'salesforce_current_org',
  QUERY_HISTORY: 'salesforce_query_history',
  API_HISTORY: 'salesforce_api_history',
};

// ============================================================================
// SALESFORCE API SERVICE
// ============================================================================

class SalesforceApiService {
  private currentOrg: SalesforceOrg | null = null;
  private orgs: SalesforceOrg[] = [];
  private apiVersion = 'v59.0';
  private backendConnected = false;

  constructor() {
    this.loadOrgs();
    // Try to auto-connect from backend (async, non-blocking)
    this.autoConnectFromBackend();
  }

  // ========== ORG MANAGEMENT ==========

  /**
   * Auto-connect from backend auth service if configured.
   * This enables seamless parallel execution and CI/CD scenarios.
   */
  async autoConnectFromBackend(): Promise<boolean> {
    try {
      // Check if backend has a configured org
      const statusResponse = await fetch(`${this.getBackendUrl()}/api/salesforce/auth/status`);
      if (!statusResponse.ok) return false;
      
      const status = await statusResponse.json();
      if (!status.configured_orgs || status.configured_orgs.length === 0) {
        console.log('[SF API] No orgs configured in backend');
        return false;
      }
      
      // Get a token from the backend
      const tokenResponse = await fetch(`${this.getBackendUrl()}/api/salesforce/auth/token`, {
        method: 'POST',
      });
      
      if (!tokenResponse.ok) {
        console.warn('[SF API] Backend token request failed');
        return false;
      }
      
      const token = await tokenResponse.json();
      const backendOrg = status.configured_orgs.find((o: any) => o.is_default) || status.configured_orgs[0];
      
      // Create/update org in local storage
      const existingOrg = this.orgs.find(o => o.instanceUrl === backendOrg.instance_url);
      
      if (existingOrg) {
        // Update existing org with fresh token
        this.updateOrg(existingOrg.id, {
          accessToken: token.access_token,
          tokenExpiry: Date.now() + (token.expires_in * 1000),
        });
        this.currentOrg = existingOrg;
      } else {
        // Add new org from backend
        const newOrg = this.addOrg({
          name: backendOrg.name || 'Backend Org',
          instanceUrl: backendOrg.instance_url,
          loginUrl: backendOrg.login_url || 'https://login.salesforce.com',
          username: backendOrg.username || '',
          orgType: 'developer',
          color: '#4CAF50',
          accessToken: token.access_token,
          tokenExpiry: Date.now() + (token.expires_in * 1000),
          apiVersion: this.apiVersion,
          isDefault: true,
        });
        this.currentOrg = newOrg;
        localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, newOrg.id);
      }
      
      this.backendConnected = true;
      console.log('[SF API] Auto-connected from backend:', backendOrg.instance_url);
      return true;
    } catch (e) {
      // Backend not available - fall back to localStorage
      console.log('[SF API] Backend not available, using localStorage');
      return false;
    }
  }

  loadOrgs(): SalesforceOrg[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ORGS);
      this.orgs = stored ? JSON.parse(stored) : [];
      
      const currentOrgId = localStorage.getItem(STORAGE_KEYS.CURRENT_ORG);
      if (currentOrgId) {
        this.currentOrg = this.orgs.find(o => o.id === currentOrgId) || null;
      }
      
      return this.orgs;
    } catch (e) {
      console.error('Failed to load orgs:', e);
      return [];
    }
  }
  
  /**
   * Check if connected to backend auth service.
   */
  isBackendConnected(): boolean {
    return this.backendConnected;
  }

  saveOrgs(): void {
    localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(this.orgs));
  }

  getOrgs(): SalesforceOrg[] {
    return this.orgs;
  }

  getCurrentOrg(): SalesforceOrg | null {
    return this.currentOrg;
  }

  setCurrentOrg(orgId: string): SalesforceOrg | null {
    const org = this.orgs.find(o => o.id === orgId);
    if (org) {
      this.currentOrg = org;
      localStorage.setItem(STORAGE_KEYS.CURRENT_ORG, orgId);
      org.lastUsed = new Date().toISOString();
      this.saveOrgs();
    }
    return this.currentOrg;
  }

  addOrg(org: Omit<SalesforceOrg, 'id'>): SalesforceOrg {
    const newOrg: SalesforceOrg = {
      ...org,
      id: `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      apiVersion: org.apiVersion || this.apiVersion,
    };
    this.orgs.push(newOrg);
    this.saveOrgs();
    return newOrg;
  }

  updateOrg(orgId: string, updates: Partial<SalesforceOrg>): SalesforceOrg | null {
    const index = this.orgs.findIndex(o => o.id === orgId);
    if (index !== -1) {
      this.orgs[index] = { ...this.orgs[index], ...updates };
      this.saveOrgs();
      if (this.currentOrg?.id === orgId) {
        this.currentOrg = this.orgs[index];
      }
      return this.orgs[index];
    }
    return null;
  }

  removeOrg(orgId: string): boolean {
    const index = this.orgs.findIndex(o => o.id === orgId);
    if (index !== -1) {
      this.orgs.splice(index, 1);
      this.saveOrgs();
      if (this.currentOrg?.id === orgId) {
        this.currentOrg = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_ORG);
      }
      return true;
    }
    return false;
  }

  // ========== AUTHENTICATION ==========

  async loginWithCredentials(credentials: SalesforceCredentials): Promise<SalesforceAuthResult> {
    const loginUrl = credentials.loginUrl || 'https://login.salesforce.com';
    
    // Determine domain type from loginUrl
    let domain = 'login'; // production
    if (loginUrl.includes('test.salesforce.com')) {
      domain = 'test'; // sandbox
    } else if (loginUrl.includes('.my.salesforce.com')) {
      // Custom domain - extract subdomain
      const match = loginUrl.match(/https?:\/\/([^.]+)\.my\.salesforce\.com/);
      domain = match ? match[1] : 'login';
    }
    
    try {
      // Use backend proxy to avoid CORS issues
      const response = await fetch(`${this.getBackendUrl()}/api/salesforce/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          security_token: credentials.securityToken || '',
          domain: domain,
          login_url: loginUrl,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Authentication failed');
      }
      
      const result = await response.json();
      
      if (!result.connected) {
        throw new Error(result.error || 'Failed to connect to Salesforce');
      }
      
      return {
        accessToken: result.access_token || 'backend-managed',
        instanceUrl: result.instance_url,
        id: result.id || '',
        tokenType: 'Bearer',
        issuedAt: Date.now().toString(),
        signature: '',
        refreshToken: result.refresh_token || '',
      };
    } catch (error: any) {
      if (error.message.includes('fetch')) {
        throw new Error('Backend server not running. Please start the backend with: cd backend && python -m uvicorn app.main:app --reload --port 8000');
      }
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async refreshAccessToken(org: SalesforceOrg): Promise<string> {
    if (!org.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const loginUrl = org.loginUrl || 'https://login.salesforce.com';
    const tokenUrl = `${loginUrl}/services/oauth2/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', '3MVG9I9urWNIrEluKXkz0U8fSLu3F.D15u7C5h2AqF_HCLI1nWGlHqlmz3_Ax4yrJlBklOQV9fPF5');
    params.append('refresh_token', org.refreshToken);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const result = await response.json();
    this.updateOrg(org.id, {
      accessToken: result.access_token,
      tokenExpiry: Date.now() + 7200000, // 2 hours
    });
    
    return result.access_token;
  }

  private async getAccessToken(): Promise<string> {
    // AUTO-CONNECT: If no org or no token, try to connect from backend
    if (!this.currentOrg || !this.currentOrg.accessToken) {
      console.log('[SF API] No org/token, attempting auto-connect from backend...');
      const connected = await this.ensureConnected();
      if (!connected) {
        throw new Error('No org selected. Please select or connect to a Salesforce org.');
      }
    }
    
    if (!this.currentOrg!.accessToken) {
      throw new Error('No access token. Please re-authenticate.');
    }
    
    // Check if token is expired
    if (this.currentOrg!.tokenExpiry && Date.now() > this.currentOrg!.tokenExpiry) {
      // Try auto-refresh from backend first
      console.log('[SF API] Token expired, attempting auto-refresh...');
      const refreshed = await this.autoRefreshFromBackend();
      if (refreshed) {
        return this.currentOrg!.accessToken!;
      }
      
      // Fall back to local refresh token
      if (this.currentOrg!.refreshToken) {
        return await this.refreshAccessToken(this.currentOrg!);
      }
      throw new Error('Access token expired. Please re-authenticate.');
    }
    
    return this.currentOrg!.accessToken;
  }
  
  /**
   * Ensure Salesforce is connected before making API calls.
   * This is the key method for auto-connection in parallel/CI/CD scenarios.
   */
  async ensureConnected(): Promise<boolean> {
    // If already connected with valid token, return true
    if (this.currentOrg?.accessToken && 
        (!this.currentOrg.tokenExpiry || Date.now() < this.currentOrg.tokenExpiry)) {
      return true;
    }
    
    // Try auto-connect from backend
    return await this.autoConnectFromBackend();
  }
  
  /**
   * Auto-refresh token from backend auth service.
   * Used when the current token is expired.
   */
  private async autoRefreshFromBackend(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBackendUrl()}/api/salesforce/auth/token`, {
        method: 'POST',
      });
      
      if (!response.ok) return false;
      
      const token = await response.json();
      
      if (this.currentOrg) {
        this.updateOrg(this.currentOrg.id, {
          accessToken: token.access_token,
          tokenExpiry: Date.now() + (token.expires_in * 1000),
        });
      }
      
      console.log('[SF API] Auto-refreshed token from backend');
      return true;
    } catch (e) {
      console.warn('[SF API] Auto-refresh from backend failed:', e);
      return false;
    }
  }

  private getBaseUrl(): string {
    if (!this.currentOrg) {
      throw new Error('No org selected');
    }
    return `${this.currentOrg.instanceUrl}/services/data/${this.currentOrg.apiVersion || this.apiVersion}`;
  }

  // ========== REST API ==========

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Try to use auto-proxy (backend handles auth) if no local token
    const hasLocalToken = this.currentOrg?.accessToken && 
      (!this.currentOrg.tokenExpiry || Date.now() < this.currentOrg.tokenExpiry);
    
    if (!hasLocalToken) {
      // Use auto-proxy - backend handles authentication
      return this.requestAutoProxy<T>(endpoint, options);
    }
    
    const accessToken = await this.getAccessToken();
    const instanceUrl = this.currentOrg?.instanceUrl;
    
    if (!instanceUrl) {
      // Fall back to auto-proxy
      return this.requestAutoProxy<T>(endpoint, options);
    }
    
    // Use backend proxy with local token
    const proxyUrl = `${this.getBackendUrl()}/api/salesforce/proxy`;
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instance_url: instanceUrl,
        access_token: accessToken,
        endpoint: endpoint.startsWith('/services') ? endpoint : `/services/data/${this.apiVersion}${endpoint}`,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body as string) : null,
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    console.log('[SF API] Proxy response:', result);
    
    // If token expired (401), try auto-proxy
    if (!result.success && result.status === 401) {
      console.log('[SF API] Token expired, trying auto-proxy...');
      return this.requestAutoProxy<T>(endpoint, options);
    }
    
    if (!result.success) {
      const errorData = result.data;
      if (Array.isArray(errorData)) {
        throw new Error(errorData[0]?.message || 'Request failed');
      }
      throw new Error(typeof errorData === 'string' ? errorData : JSON.stringify(errorData));
    }
    
    // result.data contains the actual Salesforce response
    if (result.data === null || result.data === undefined) {
      throw new Error('Empty response from Salesforce');
    }
    
    return result.data as T;
  }

  /**
   * Make request using auto-proxy - backend handles authentication automatically.
   * This is the key method for parallel/CI/CD execution without local tokens.
   */
  private async requestAutoProxy<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    console.log('[SF API] Using auto-proxy (backend auth)');
    
    const autoProxyUrl = `${this.getBackendUrl()}/api/salesforce/auto-proxy`;
    
    const response = await fetch(autoProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: endpoint.startsWith('/services') ? endpoint : `/services/data/${this.apiVersion}${endpoint}`,
        method: options.method || 'GET',
        body: options.body ? JSON.parse(options.body as string) : null,
      }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    console.log('[SF API] Auto-proxy response:', result);
    
    // Update local org with instance URL from backend (for reference)
    if (result.instance_url && !this.currentOrg) {
      // Create a minimal org record for reference
      this.addOrg({
        name: 'Backend Org',
        instanceUrl: result.instance_url,
        loginUrl: 'https://login.salesforce.com',
        username: '',
        orgType: 'developer',
        color: '#4CAF50',
        apiVersion: this.apiVersion,
        isDefault: true,
      });
    }
    
    if (!result.success) {
      const errorData = result.data;
      if (Array.isArray(errorData)) {
        throw new Error(errorData[0]?.message || 'Request failed');
      }
      throw new Error(typeof errorData === 'string' ? errorData : JSON.stringify(errorData));
    }
    
    if (result.data === null || result.data === undefined) {
      throw new Error('Empty response from Salesforce');
    }
    
    return result.data as T;
  }

  // ========== SOQL QUERIES ==========

  async query<T = any>(soql: string): Promise<QueryResult<T>> {
    const encoded = encodeURIComponent(soql);
    return this.request<QueryResult<T>>(`/query?q=${encoded}`);
  }

  async queryMore<T = any>(nextRecordsUrl: string): Promise<QueryResult<T>> {
    return this.request<QueryResult<T>>(nextRecordsUrl);
  }

  async queryAll<T = any>(soql: string): Promise<T[]> {
    const allRecords: T[] = [];
    let result = await this.query<T>(soql);
    allRecords.push(...result.records);
    
    while (!result.done && result.nextRecordsUrl) {
      result = await this.queryMore<T>(result.nextRecordsUrl);
      allRecords.push(...result.records);
    }
    
    return allRecords;
  }

  async search(sosl: string): Promise<any> {
    const encoded = encodeURIComponent(sosl);
    return this.request(`/search?q=${encoded}`);
  }

  // ========== CRUD OPERATIONS ==========

  async getRecord(objectName: string, recordId: string, fields?: string[]): Promise<any> {
    // Sanitize inputs - remove whitespace and non-printable characters
    const cleanObjectName = objectName.trim().replace(/[\t\n\r]/g, '');
    const cleanRecordId = recordId.trim().replace(/[\t\n\r]/g, '');
    
    let endpoint = `/sobjects/${cleanObjectName}/${cleanRecordId}`;
    if (fields && fields.length > 0) {
      endpoint += `?fields=${fields.join(',')}`;
    }
    return this.request(endpoint);
  }

  async createRecord(objectName: string, data: any): Promise<{ id: string; success: boolean; errors: any[] }> {
    return this.request(`/sobjects/${objectName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Bulk create records using Composite API (up to 25 records per batch)
   * For larger batches, it automatically chunks into multiple requests
   */
  async createRecordsBulk(objectName: string, records: any[]): Promise<{ success: number; failed: number; results: Array<{ success: boolean; id?: string; errors?: any[] }> }> {
    const BATCH_SIZE = 25; // Salesforce Composite API limit
    const allResults: Array<{ success: boolean; id?: string; errors?: any[] }> = [];
    let successCount = 0;
    let failedCount = 0;

    // Process in batches of 25
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      // Build composite request
      const compositeRequest = {
        allOrNone: false, // Continue even if some fail
        compositeRequest: batch.map((record, idx) => ({
          method: 'POST',
          url: `/services/data/${this.apiVersion}/sobjects/${objectName}`,
          referenceId: `record_${i + idx}`,
          body: record
        }))
      };

      try {
        const response = await this.request<{ compositeResponse: Array<{ httpStatusCode: number; body: any; referenceId: string }> }>(
          '/composite',
          {
            method: 'POST',
            body: JSON.stringify(compositeRequest),
          }
        );

        // Process results
        for (const result of response.compositeResponse) {
          if (result.httpStatusCode === 201 || result.httpStatusCode === 200) {
            successCount++;
            allResults.push({ success: true, id: result.body?.id });
          } else {
            failedCount++;
            allResults.push({ success: false, errors: result.body });
          }
        }
      } catch (error: any) {
        // If composite API fails, fall back to individual inserts for this batch
        console.warn('Composite API failed, falling back to individual inserts:', error.message);
        for (const record of batch) {
          try {
            const result = await this.createRecord(objectName, record);
            if (result.success) {
              successCount++;
              allResults.push({ success: true, id: result.id });
            } else {
              failedCount++;
              allResults.push({ success: false, errors: result.errors });
            }
          } catch (e: any) {
            failedCount++;
            allResults.push({ success: false, errors: [{ message: e.message }] });
          }
        }
      }
    }

    return { success: successCount, failed: failedCount, results: allResults };
  }

  async updateRecord(objectName: string, recordId: string, data: any): Promise<void> {
    await this.request(`/sobjects/${objectName}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteRecord(objectName: string, recordId: string): Promise<void> {
    await this.request(`/sobjects/${objectName}/${recordId}`, {
      method: 'DELETE',
    });
  }

  async upsertRecord(objectName: string, externalIdField: string, externalIdValue: string, data: any): Promise<any> {
    return this.request(`/sobjects/${objectName}/${externalIdField}/${externalIdValue}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ========== COMPOSITE API ==========

  async composite(requests: any[]): Promise<any> {
    return this.request('/composite', {
      method: 'POST',
      body: JSON.stringify({
        allOrNone: true,
        compositeRequest: requests,
      }),
    });
  }

  async compositeBatch(requests: any[]): Promise<any> {
    return this.request('/composite/batch', {
      method: 'POST',
      body: JSON.stringify({
        batchRequests: requests,
      }),
    });
  }

  async sObjectTree(objectName: string, records: any[]): Promise<any> {
    return this.request(`/composite/tree/${objectName}`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }

  // ========== DESCRIBE / METADATA ==========

  async describeGlobal(): Promise<{ sobjects: any[] }> {
    return this.request('/sobjects');
  }

  async describeSObject(objectName: string): Promise<SObjectDescribe> {
    return this.request(`/sobjects/${objectName}/describe`);
  }

  // Alias for describeSObject
  async describeObject(objectName: string): Promise<SObjectDescribe> {
    return this.describeSObject(objectName);
  }

  async getRecentItems(objectName: string, limit = 10): Promise<any[]> {
    const result = await this.request(`/sobjects/${objectName}/describe/recentItems`);
    return result.slice(0, limit);
  }

  // ========== BULK API 2.0 ==========

  async createBulkJob(operation: string, objectName: string, externalIdField?: string): Promise<BulkJob> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest`;
    
    const jobData: any = {
      operation,
      object: objectName,
      contentType: 'CSV',
      lineEnding: 'LF',
    };
    
    if (operation === 'upsert' && externalIdField) {
      jobData.externalIdFieldName = externalIdField;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create bulk job: ${response.statusText}`);
    }
    
    return response.json();
  }

  async uploadBulkData(jobId: string, csvData: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/batches`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/csv',
      },
      body: csvData,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload bulk data: ${response.statusText}`);
    }
  }

  async closeBulkJob(jobId: string): Promise<BulkJob> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'UploadComplete' }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to close bulk job: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getBulkJobStatus(jobId: string): Promise<BulkJob> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getBulkJobResults(jobId: string, type: 'successfulResults' | 'failedResults' | 'unprocessedrecords'): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/jobs/ingest/${jobId}/${type}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'text/csv',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get job results: ${response.statusText}`);
    }
    
    return response.text();
  }

  // ========== TOOLING API ==========

  async toolingQuery<T = any>(soql: string): Promise<QueryResult<T>> {
    // Ensure org is connected
    if (!this.currentOrg) {
      throw new Error('No Salesforce org connected. Please connect to an org first.');
    }
    
    // Use the proxy to avoid CORS issues
    const encoded = encodeURIComponent(soql);
    console.log('[SF API] Tooling Query:', soql);
    
    try {
      const result = await this.request<QueryResult<T>>(`/tooling/query?q=${encoded}`);
      console.log('[SF API] Tooling Query result:', result);
      return result;
    } catch (error: any) {
      console.error('[SF API] Tooling Query error:', error);
      throw new Error(`Tooling API error: ${error.message}`);
    }
  }

  async executeAnonymousApex(apexCode: string): Promise<{ success: boolean; compileProblem?: string; exceptionMessage?: string; exceptionStackTrace?: string; line?: number; column?: number }> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCode)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Apex execution failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  async runApexTests(classIds: string[]): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = `${this.currentOrg!.instanceUrl}/services/data/${this.apiVersion}/tooling/runTestsAsynchronous`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ classids: classIds.join(',') }),
    });
    
    if (!response.ok) {
      throw new Error(`Test run failed: ${response.statusText}`);
    }
    
    return response.text(); // Returns the AsyncApexJobId
  }

  async getApexTestResults(asyncApexJobId: string): Promise<ApexTestResult[]> {
    const soql = `
      SELECT Id, QueueItemId, StackTrace, Message, MethodName, Outcome,
             ApexClass.Id, ApexClass.Name, ApexClass.NamespacePrefix,
             RunTime, TestTimestamp
      FROM ApexTestResult
      WHERE AsyncApexJobId = '${asyncApexJobId}'
    `;
    const result = await this.toolingQuery<ApexTestResult>(soql);
    return result.records;
  }

  async getApexTestQueueStatus(asyncApexJobId: string): Promise<any> {
    const soql = `
      SELECT Id, Status, ApexClassId, ApexClass.Name, ExtendedStatus
      FROM ApexTestQueueItem
      WHERE ParentJobId = '${asyncApexJobId}'
    `;
    return this.toolingQuery(soql);
  }

  async getApexClasses(): Promise<any[]> {
    const soql = `
      SELECT Id, Name, Body, Status, IsValid, LengthWithoutComments,
             NamespacePrefix, ApiVersion, CreatedDate, LastModifiedDate
      FROM ApexClass
      WHERE Status = 'Active'
      ORDER BY Name
    `;
    const result = await this.toolingQuery(soql);
    return result.records;
  }

  async getApexTestClasses(): Promise<any[]> {
    const soql = `
      SELECT Id, Name, Body, Status, IsValid
      FROM ApexClass
      WHERE Status = 'Active'
      AND (Body LIKE '%@isTest%' OR Body LIKE '%testMethod%')
      ORDER BY Name
    `;
    const result = await this.toolingQuery(soql);
    return result.records;
  }

  // ========== LIMITS ==========

  async getLimits(): Promise<ApiLimits> {
    return this.request('/limits');
  }

  // ========== PERMISSIONS ==========

  async getObjectPermissions(userId: string): Promise<ObjectPermission[]> {
    const soql = `
      SELECT SobjectType, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
             PermissionsViewAllRecords, PermissionsModifyAllRecords
      FROM ObjectPermissions
      WHERE ParentId IN (
        SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}'
      )
    `;
    const result = await this.query(soql);
    return result.records.map((r: any) => ({
      objectName: r.SobjectType,
      canCreate: r.PermissionsCreate,
      canRead: r.PermissionsRead,
      canEdit: r.PermissionsEdit,
      canDelete: r.PermissionsDelete,
      canViewAll: r.PermissionsViewAllRecords,
      canModifyAll: r.PermissionsModifyAllRecords,
    }));
  }

  async getFieldPermissions(userId: string, objectName?: string): Promise<FieldPermission[]> {
    let soql = `
      SELECT SobjectType, Field, PermissionsRead, PermissionsEdit
      FROM FieldPermissions
      WHERE ParentId IN (
        SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${userId}'
      )
    `;
    if (objectName) {
      soql += ` AND SobjectType = '${objectName}'`;
    }
    
    const result = await this.query(soql);
    return result.records.map((r: any) => ({
      objectName: r.SobjectType,
      fieldName: r.Field,
      canRead: r.PermissionsRead,
      canEdit: r.PermissionsEdit,
    }));
  }

  async getCurrentUserId(): Promise<string> {
    const result = await this.query('SELECT Id FROM User WHERE Username = \'' + this.currentOrg?.username + '\'');
    if (result.records.length > 0) {
      return result.records[0].Id;
    }
    throw new Error('Could not find current user');
  }

  // ========== QUERY HISTORY ==========

  saveQueryToHistory(query: string): void {
    try {
      const history = this.getQueryHistory();
      const entry = {
        query,
        timestamp: new Date().toISOString(),
        orgId: this.currentOrg?.id,
      };
      history.unshift(entry);
      // Keep only last 50 queries
      const trimmed = history.slice(0, 50);
      localStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save query to history:', e);
    }
  }

  getQueryHistory(): Array<{ query: string; timestamp: string; orgId?: string }> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUERY_HISTORY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  clearQueryHistory(): void {
    localStorage.removeItem(STORAGE_KEYS.QUERY_HISTORY);
  }

  // ========== ORCHESTRATOR API ==========
  
  /**
   * Scan the connected org for testable metadata
   * Returns validation rules, flows, triggers, apex classes, custom objects
   */
  async orchestratorScan(): Promise<{
    validation_rules: any[];
    flows: any[];
    triggers: any[];
    apex_classes: any[];
    custom_objects: any[];
    summary: {
      total_items: number;
      by_type: Record<string, number>;
    };
  }> {
    const response = await fetch(`${this.getBackendUrl()}/api/salesforce/orchestrator/scan`);
    if (!response.ok) {
      throw new Error(`Orchestrator scan failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Generate test suite for a specific object
   */
  async orchestratorGenerateTests(options: {
    object_name: string;
    test_types?: string[];
    include_negative_tests?: boolean;
    include_boundary_tests?: boolean;
  }): Promise<{
    object: string;
    testCount: number;
    tests: any[];
    summary: Record<string, number>;
  }> {
    const response = await fetch(`${this.getBackendUrl()}/api/salesforce/orchestrator/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      throw new Error(`Test generation failed: ${response.statusText}`);
    }
    return response.json();
  }

  // ========== INTEGRATION TESTING API ==========

  /**
   * Execute an API integration test
   */
  async executeIntegrationTest(config: {
    method: string;
    endpoint: string;
    body?: any;
    assertions?: Array<{
      path: string;
      condition: 'exists' | 'notEmpty' | 'equals' | 'contains' | 'greaterThan' | 'lessThan';
      expected?: any;
    }>;
  }): Promise<{
    success: boolean;
    method: string;
    endpoint: string;
    statusCode?: number;
    response: any;
    assertions: Array<{
      path: string;
      condition: string;
      expected?: any;
      actual?: any;
      passed: boolean;
      error?: string;
    }>;
    error?: string;
  }> {
    const response = await fetch(`${this.getBackendUrl()}/api/salesforce/integration/execute-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error(`Integration test failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Run a full CRUD test cycle on an object
   */
  async runCrudTest(objectName: string = 'Account'): Promise<{
    object: string;
    steps: Array<{
      action: string;
      success: boolean;
      recordId?: string;
      data?: any;
      updatedFields?: string[];
      error?: string;
    }>;
    success: boolean;
    recordId?: string;
    error?: string;
  }> {
    const response = await fetch(`${this.getBackendUrl()}/api/salesforce/integration/run-crud-test?object_name=${objectName}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`CRUD test failed: ${response.statusText}`);
    }
    return response.json();
  }

  // Helper to get backend URL (same as web app API; avoids CORS to localhost from flowstral.com)
  private getBackendUrl(): string {
    return import.meta.env.VITE_BACKEND_URL || API_BASE_URL;
  }
}

// Export singleton instance
export const salesforceApi = new SalesforceApiService();

// Export class for type checking
export { SalesforceApiService };


