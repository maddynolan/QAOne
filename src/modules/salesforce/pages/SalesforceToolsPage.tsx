/**
 * Salesforce Tools Page
 * 
 * Comprehensive Salesforce testing and development tools:
 * 1. Multi-Org Manager - Manage multiple SF org connections
 * 2. SOQL Builder - Visual query builder
 * 3. Bulk Data Loader - CSV import/export
 * 4. REST API Playground - Test API calls
 * 5. Test Data Factory - Generate realistic test data
 * 6. Schema Browser - Explore objects and fields
 * 7. Record Inspector - View record details
 * 8. Apex Test Runner - Run and monitor tests
 * 9. Data Seeding Templates - Pre-built data sets
 * 10. Permission Analyzer - Check user permissions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cloud, Database, Search, Code, FileJson, Users, Shield, Play,
  Plus, Trash2, RefreshCw, Copy, Download, Upload, Check, X,
  ChevronRight, ChevronDown, Eye, Edit, Settings, Zap, Globe,
  Table, List, Grid, Filter, Save, FolderOpen, Terminal,
  AlertCircle, CheckCircle, Loader2, ArrowRight,
  Building2, Lock, Unlock, MoreVertical, Layers, Hash, GitBranch, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  salesforceApi,
  SalesforceOrg,
  SObjectDescribe,
  QueryResult,
  ApexTestResult
} from '@/modules/salesforce/lib/salesforce-api';
import {
  testDataFactory,
  STANDARD_OBJECT_TEMPLATES,
  GeneratedRecord
} from '@/modules/salesforce/lib/salesforce-test-data-factory';
import { SalesforceRelationshipVisualizer } from '@/modules/salesforce/components/SalesforceRelationshipVisualizer';
import { SalesforceDebugLogAnalyzer } from '@/modules/salesforce/components/SalesforceDebugLogAnalyzer';
import { SalesforceAssertionBuilder } from '@/modules/salesforce/components/SalesforceAssertionBuilder';
import { SalesforceRecordCloner } from '@/modules/salesforce/components/SalesforceRecordCloner';
import { SalesforceDataDiff } from '@/modules/salesforce/components/SalesforceDataDiff';
import { SalesforceQuickRecordCreator } from '@/modules/salesforce/components/SalesforceQuickRecordCreator';
import { SalesforceApexExecutor } from '@/modules/salesforce/components/SalesforceApexExecutor';
import { SalesforceFieldAnalyzer } from '@/modules/salesforce/components/SalesforceFieldAnalyzer';
import { SalesforceReportRunner } from '@/modules/salesforce/components/SalesforceReportRunner';
import { SoqlEditor } from '@/modules/salesforce/components/SoqlEditor';
import { SalesforceApiReference } from '@/modules/salesforce/components/SalesforceApiReference';
import { SalesforceFunctionalTesting } from '@/modules/salesforce/components/SalesforceFunctionalTesting';
import { SalesforceIntegrationTesting } from '@/modules/salesforce/components/SalesforceIntegrationTesting';
import { SalesforceRegressionTesting } from '@/modules/salesforce/components/SalesforceRegressionTesting';
import { SalesforceUATesting } from '@/modules/salesforce/components/SalesforceUATesting';
import { SalesforceTestOrchestrator } from '@/modules/salesforce/components/SalesforceTestOrchestrator';
import { AddOrgDialog, type OrgFormState } from '@/modules/salesforce/components/AddOrgDialog';
import { ORG_COLORS } from '@/modules/salesforce/constants/salesforce-constants';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SalesforceToolsPage() {
  // ========== STATE ==========
  const [activeTab, setActiveTab] = useState('orgs');
  const [orgs, setOrgs] = useState<SalesforceOrg[]>([]);
  const [currentOrg, setCurrentOrg] = useState<SalesforceOrg | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Org Manager State
  const [showAddOrgDialog, setShowAddOrgDialog] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState<OrgFormState>({
    username: '',
    password: '',
    securityToken: '',
    loginUrl: 'https://login.salesforce.com',
    name: '',
    orgType: 'production',
    color: '#3B82F6',
  });
  
  // SOQL Builder State
  const [soqlQuery, setSoqlQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; timestamp: string }>>([]);
  
  // Schema Browser State
  const [objects, setObjects] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [objectDescribe, setObjectDescribe] = useState<SObjectDescribe | null>(null);
  const [objectFilter, setObjectFilter] = useState('');
  const [showCustomOnly, setShowCustomOnly] = useState(false);
  
  // Record Inspector State
  const [inspectRecordId, setInspectRecordId] = useState('');
  const [inspectObjectType, setInspectObjectType] = useState('');
  const [inspectedRecord, setInspectedRecord] = useState<any>(null);
  
  // Bulk Loader State
  const [bulkOperation, setBulkOperation] = useState<'insert' | 'update' | 'upsert' | 'delete'>('insert');
  const [bulkObjectName, setBulkObjectName] = useState('');
  const [bulkCsvData, setBulkCsvData] = useState('');
  const [bulkExternalIdField, setBulkExternalIdField] = useState('');
  const [bulkJobStatus, setBulkJobStatus] = useState<any>(null);
  
  // API Playground State
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [apiEndpoint, setApiEndpoint] = useState('/sobjects/Account/describe');
  const [apiBody, setApiBody] = useState('');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Apex Test Runner State
  const [testClasses, setTestClasses] = useState<any[]>([]);
  const [selectedTestClasses, setSelectedTestClasses] = useState<string[]>([]);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<ApexTestResult[]>([]);
  const [testRunStatus, setTestRunStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  
  // Permission Analyzer State
  const [permissionUserId, setPermissionUserId] = useState('');
  const [objectPermissions, setObjectPermissions] = useState<any[]>([]);
  const [fieldPermissions, setFieldPermissions] = useState<any[]>([]);
  
  // API Limits State
  const [apiLimits, setApiLimits] = useState<any>(null);
  
  // Test Data Factory State
  const [selectedDataObject, setSelectedDataObject] = useState('Account');
  const [dataRecordCount, setDataRecordCount] = useState(10);
  const [dataIndustry, setDataIndustry] = useState<'generic' | 'healthcare' | 'finance' | 'technology'>('generic');
  const [generatedRecords, setGeneratedRecords] = useState<GeneratedRecord[]>([]);
  const [selectedSeedTemplate, setSelectedSeedTemplate] = useState<string | null>(null);
  const [seedingProgress, setSeedingProgress] = useState<{ current: number; total: number } | null>(null);

  // ========== EFFECTS ==========
  
  useEffect(() => {
    loadOrgs();
    setQueryHistory(salesforceApi.getQueryHistory());
    // Sync with backend connection status
    syncWithBackend();
  }, []);

  // ========== ORG MANAGEMENT ==========

  const loadOrgs = useCallback(() => {
    const loadedOrgs = salesforceApi.loadOrgs();
    setOrgs(loadedOrgs);
    setCurrentOrg(salesforceApi.getCurrentOrg());
  }, []);

  // Sync frontend state with backend connection
  const syncWithBackend = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/salesforce/status');
      if (!response.ok) return;
      
      const status = await response.json();
      console.log('[Salesforce Tools] Backend status:', status);
      
      if (status.connected && status.instance_url && status.access_token) {
        // Check if we already have this org
        const existingOrgs = salesforceApi.getOrgs();
        const existingOrg = existingOrgs.find(o => 
          o.instanceUrl === status.instance_url || 
          o.username === status.username
        );
        
        if (existingOrg) {
          // Update existing org with fresh token
          salesforceApi.updateOrg(existingOrg.id, {
            accessToken: status.access_token,
            instanceUrl: status.instance_url,
            tokenExpiry: Date.now() + 7200000,
          });
          salesforceApi.setCurrentOrg(existingOrg.id);
        } else {
          // Create new org from backend connection
          const newOrg = salesforceApi.addOrg({
            name: status.username?.split('@')[0] || 'Backend Connected Org',
            instanceUrl: status.instance_url,
            loginUrl: status.domain === 'test' ? 'https://test.salesforce.com' : 'https://login.salesforce.com',
            username: status.username || 'unknown',
            orgType: status.domain === 'test' ? 'sandbox' : 'production',
            color: '#3b82f6',
            accessToken: status.access_token,
            tokenExpiry: Date.now() + 7200000,
            apiVersion: 'v59.0',
          });
          salesforceApi.setCurrentOrg(newOrg.id);
        }
        
        // Reload orgs to refresh state
        loadOrgs();
        toast.success('Synced with backend Salesforce connection');
      }
    } catch (error) {
      console.log('[Salesforce Tools] Could not sync with backend:', error);
    }
  }, [loadOrgs]);

  const handleSelectOrg = useCallback((orgId: string) => {
    const org = salesforceApi.setCurrentOrg(orgId);
    setCurrentOrg(org);
    toast.success(`Switched to ${org?.name}`);
  }, []);

  const handleAddOrg = useCallback(async () => {
    if (!newOrgForm.username || !newOrgForm.password) {
      toast.error('Username and password are required');
      return;
    }

    setIsLoading(true);
    try {
      const authResult = await salesforceApi.loginWithCredentials({
        username: newOrgForm.username,
        password: newOrgForm.password,
        securityToken: newOrgForm.securityToken,
        loginUrl: newOrgForm.loginUrl,
      });

      const newOrg = salesforceApi.addOrg({
        name: newOrgForm.name || newOrgForm.username.split('@')[0],
        instanceUrl: authResult.instanceUrl,
        loginUrl: newOrgForm.loginUrl || 'https://login.salesforce.com',
        username: newOrgForm.username,
        orgType: newOrgForm.orgType as any,
        color: newOrgForm.color,
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        tokenExpiry: Date.now() + 7200000,
        apiVersion: 'v59.0',
      });

      loadOrgs();
      handleSelectOrg(newOrg.id);
      setShowAddOrgDialog(false);
      setNewOrgForm({
        username: '',
        password: '',
        securityToken: '',
        loginUrl: 'https://login.salesforce.com',
        name: '',
        orgType: 'production',
        color: '#3B82F6',
      });
      toast.success('Org connected successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [newOrgForm, loadOrgs, handleSelectOrg]);

  const handleRemoveOrg = useCallback((orgId: string) => {
    if (confirm('Are you sure you want to remove this org?')) {
      salesforceApi.removeOrg(orgId);
      loadOrgs();
      toast.success('Org removed');
    }
  }, [loadOrgs]);

  // ========== SOQL BUILDER ==========

  const handleExecuteQuery = useCallback(async () => {
    if (!currentOrg) {
      toast.error('Please select an org first');
      return;
    }

    setIsLoading(true);
    setQueryError(null);
    setQueryResults([]);
    setQueryColumns([]);

    try {
      const result = await salesforceApi.query(soqlQuery);
      setQueryResults(result.records);
      
      if (result.records.length > 0) {
        const cols = Object.keys(result.records[0]).filter(k => k !== 'attributes');
        setQueryColumns(cols);
      }
      
      salesforceApi.saveQueryToHistory(soqlQuery);
      setQueryHistory(salesforceApi.getQueryHistory());
      toast.success(`Found ${result.totalSize} records`);
    } catch (error: any) {
      setQueryError(error.message);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, soqlQuery]);

  // ========== SCHEMA BROWSER ==========

  const loadObjects = useCallback(async () => {
    if (!currentOrg) return;

    setIsLoading(true);
    try {
      const result = await salesforceApi.describeGlobal();
      setObjects(result.sobjects);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  const loadObjectDescribe = useCallback(async (objectName: string) => {
    if (!currentOrg) return;

    setIsLoading(true);
    try {
      const describe = await salesforceApi.describeSObject(objectName);
      setObjectDescribe(describe);
      setSelectedObject(objectName);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  const filteredObjects = useMemo(() => {
    return objects.filter(obj => {
      const matchesFilter = objectFilter === '' || 
        obj.name.toLowerCase().includes(objectFilter.toLowerCase()) ||
        obj.label.toLowerCase().includes(objectFilter.toLowerCase());
      const matchesCustom = !showCustomOnly || obj.custom;
      return matchesFilter && matchesCustom;
    });
  }, [objects, objectFilter, showCustomOnly]);

  // ========== RECORD INSPECTOR ==========

  const handleInspectRecord = useCallback(async () => {
    if (!currentOrg || !inspectRecordId) {
      toast.error('Please select an org and enter a record ID');
      return;
    }

    // Auto-detect object type from record ID prefix
    let objectType = inspectObjectType;
    if (!objectType && inspectRecordId.length >= 3) {
      const prefix = inspectRecordId.substring(0, 3);
      const matchingObject = objects.find(o => o.keyPrefix === prefix);
      if (matchingObject) {
        objectType = matchingObject.name;
        setInspectObjectType(objectType);
      }
    }

    if (!objectType) {
      toast.error('Could not determine object type. Please select one.');
      return;
    }

    setIsLoading(true);
    try {
      const record = await salesforceApi.getRecord(objectType, inspectRecordId);
      setInspectedRecord(record);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, inspectRecordId, inspectObjectType, objects]);

  // ========== BULK LOADER ==========

  const handleBulkUpload = useCallback(async () => {
    if (!currentOrg || !bulkObjectName || !bulkCsvData) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Create job
      const job = await salesforceApi.createBulkJob(
        bulkOperation,
        bulkObjectName,
        bulkOperation === 'upsert' ? bulkExternalIdField : undefined
      );
      
      // Upload data
      await salesforceApi.uploadBulkData(job.id, bulkCsvData);
      
      // Close job
      const closedJob = await salesforceApi.closeBulkJob(job.id);
      setBulkJobStatus(closedJob);
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await salesforceApi.getBulkJobStatus(job.id);
        setBulkJobStatus(status);
        
        if (status.state === 'JobComplete' || status.state === 'Failed' || status.state === 'Aborted') {
          clearInterval(pollInterval);
          if (status.state === 'JobComplete') {
            toast.success(`Bulk ${bulkOperation} complete! ${status.numberRecordsProcessed} processed, ${status.numberRecordsFailed} failed`);
          } else {
            toast.error(`Bulk job ${status.state}`);
          }
        }
      }, 2000);
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, bulkOperation, bulkObjectName, bulkCsvData, bulkExternalIdField]);

  // ========== API PLAYGROUND ==========

  const handleApiRequest = useCallback(async () => {
    if (!currentOrg) {
      toast.error('Please select an org first');
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setApiResponse(null);

    try {
      const options: RequestInit = { method: apiMethod };
      if (apiBody && (apiMethod === 'POST' || apiMethod === 'PATCH')) {
        options.body = apiBody;
      }
      
      const result = await salesforceApi.request(apiEndpoint, options);
      setApiResponse(result);
      toast.success('Request successful');
    } catch (error: any) {
      setApiError(error.message);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, apiMethod, apiEndpoint, apiBody]);

  // ========== APEX TEST RUNNER ==========

  const loadTestClasses = useCallback(async () => {
    if (!currentOrg) return;

    setIsLoading(true);
    try {
      const classes = await salesforceApi.getApexTestClasses();
      setTestClasses(classes);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg]);

  const handleRunTests = useCallback(async () => {
    if (!currentOrg || selectedTestClasses.length === 0) {
      toast.error('Please select test classes to run');
      return;
    }

    setIsLoading(true);
    setTestRunStatus('running');
    setTestResults([]);

    try {
      const jobId = await salesforceApi.runApexTests(selectedTestClasses);
      setTestRunId(jobId);
      
      // Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const results = await salesforceApi.getApexTestResults(jobId);
          setTestResults(results);
          
          const queueStatus = await salesforceApi.getApexTestQueueStatus(jobId);
          const allComplete = queueStatus.records.every((q: any) => 
            q.Status === 'Completed' || q.Status === 'Failed' || q.Status === 'Aborted'
          );
          
          if (allComplete) {
            clearInterval(pollInterval);
            setTestRunStatus('complete');
            const passed = results.filter(r => r.outcome === 'Pass').length;
            const failed = results.filter(r => r.outcome === 'Fail').length;
            toast.success(`Tests complete: ${passed} passed, ${failed} failed`);
          }
        } catch (e) {
          // Continue polling
        }
      }, 3000);
      
    } catch (error: any) {
      toast.error(error.message);
      setTestRunStatus('idle');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, selectedTestClasses]);

  // ========== PERMISSION ANALYZER ==========

  const handleAnalyzePermissions = useCallback(async () => {
    if (!currentOrg) {
      toast.error('Please select an org first');
      return;
    }

    setIsLoading(true);
    try {
      let userId = permissionUserId;
      if (!userId) {
        userId = await salesforceApi.getCurrentUserId();
        setPermissionUserId(userId);
      }
      
      const objPerms = await salesforceApi.getObjectPermissions(userId);
      const fieldPerms = await salesforceApi.getFieldPermissions(userId);
      
      setObjectPermissions(objPerms);
      setFieldPermissions(fieldPerms);
      toast.success('Permissions loaded');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, permissionUserId]);

  // ========== API LIMITS ==========

  const loadApiLimits = useCallback(async () => {
    if (!currentOrg) return;

    try {
      const limits = await salesforceApi.getLimits();
      setApiLimits(limits);
    } catch (error: any) {
      console.error('Failed to load limits:', error);
    }
  }, [currentOrg]);

  // ========== TEST DATA FACTORY ==========

  const handleGenerateTestData = useCallback(async () => {
    if (!currentOrg) {
      // Fall back to template-based generation if no org connected
      try {
        const records = testDataFactory.generateRecords({
          objectName: selectedDataObject,
          count: dataRecordCount,
          industry: dataIndustry,
        });
        setGeneratedRecords(records);
        toast.success(`Generated ${records.length} ${selectedDataObject} records (template-based - connect org for schema-aware generation)`);
      } catch (error: any) {
        toast.error(error.message);
      }
      return;
    }

    // Schema-aware generation: fetch object metadata first
    setIsLoading(true);
    try {
      toast.info(`Fetching ${selectedDataObject} schema...`);
      const describe = await salesforceApi.describeObject(selectedDataObject);
      
      // Extract field metadata
      const schemaFields = describe.fields.map((field: any) => ({
        name: field.name,
        type: field.type,
        picklistValues: field.picklistValues,
        referenceTo: field.referenceTo,
        required: !field.nillable && field.createable,
        createable: field.createable,
        maxLength: field.length,
        defaultValue: field.defaultValue,
      }));
      
      // Log fields with picklist values for debugging
      const picklistFields = schemaFields.filter((f: any) => f.picklistValues?.length > 0);
      console.log(`Found ${picklistFields.length} picklist fields:`, picklistFields.map((f: any) => f.name));
      
      // Generate with real schema
      const records = testDataFactory.generateRecordsWithSchema(
        selectedDataObject,
        dataRecordCount,
        schemaFields
      );
      
      setGeneratedRecords(records);
      toast.success(`Generated ${records.length} ${selectedDataObject} records (schema-aware with valid picklist values)`);
    } catch (error: any) {
      console.error('Schema fetch error:', error);
      toast.error(`Failed to fetch schema: ${error.message}. Using template-based generation.`);
      
      // Fall back to template-based
      try {
        const records = testDataFactory.generateRecords({
          objectName: selectedDataObject,
          count: dataRecordCount,
          industry: dataIndustry,
        });
        setGeneratedRecords(records);
      } catch (err: any) {
        toast.error(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, selectedDataObject, dataRecordCount, dataIndustry]);

  const handleExportTestDataCSV = useCallback(() => {
    if (generatedRecords.length === 0) {
      toast.error('No data to export');
      return;
    }
    const csv = testDataFactory.recordsToCSV(generatedRecords);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDataObject}_test_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [generatedRecords, selectedDataObject]);

  const handleCopyTestDataJSON = useCallback(() => {
    if (generatedRecords.length === 0) {
      toast.error('No data to copy');
      return;
    }
    const json = JSON.stringify(generatedRecords.map(r => r.data), null, 2);
    navigator.clipboard.writeText(json);
    toast.success('JSON copied to clipboard');
  }, [generatedRecords]);

  const handleInsertTestData = useCallback(async () => {
    if (!currentOrg || generatedRecords.length === 0) {
      toast.error('No org selected or no data to insert');
      return;
    }

    setIsLoading(true);
    setSeedingProgress({ current: 0, total: generatedRecords.length });

    try {
      // Group records by object type
      const recordsByObject: Record<string, any[]> = {};
      for (const record of generatedRecords) {
        if (!recordsByObject[record.object]) {
          recordsByObject[record.object] = [];
        }
        recordsByObject[record.object].push(record.data);
      }

      let totalSuccess = 0;
      let totalError = 0;
      let processed = 0;
      const allErrors: string[] = [];

      // Insert each object type using bulk API
      for (const [objectName, records] of Object.entries(recordsByObject)) {
        const result = await salesforceApi.createRecordsBulk(objectName, records);
        totalSuccess += result.success;
        totalError += result.failed;
        processed += records.length;
        setSeedingProgress({ current: processed, total: generatedRecords.length });
        
        // Collect error messages
        for (const res of result.results) {
          if (!res.success && res.errors) {
            const errMsg = Array.isArray(res.errors) 
              ? res.errors.map((e: any) => e.message || e.errorCode || JSON.stringify(e)).join(', ')
              : JSON.stringify(res.errors);
            if (errMsg && !allErrors.includes(errMsg)) {
              allErrors.push(errMsg);
            }
          }
        }
      }

      if (totalError === 0) {
        toast.success(`Successfully inserted ${totalSuccess} records!`);
      } else {
        // Show first 3 unique errors
        const errorSummary = allErrors.slice(0, 3).join('; ');
        toast.error(`${totalError} failed: ${errorSummary || 'Unknown error'}`);
        console.error('All insert errors:', allErrors);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
      setSeedingProgress(null);
    }
  }, [currentOrg, generatedRecords]);

  const seedingTemplates = useMemo(() => testDataFactory.getSeedingTemplates(), []);

  const handleApplySeedTemplate = useCallback((templateName: string) => {
    const template = seedingTemplates.find(t => t.name === templateName);
    if (!template) return;
    
    setSelectedSeedTemplate(templateName);
    
    // Generate all data for this template
    const allRecords: GeneratedRecord[] = [];
    for (const objConfig of template.objects) {
      const records = testDataFactory.generateRecords({
        objectName: objConfig.object,
        count: objConfig.count,
        industry: dataIndustry,
      });
      allRecords.push(...records);
    }
    setGeneratedRecords(allRecords);
    toast.success(`Generated ${allRecords.length} total records for ${templateName}`);
  }, [seedingTemplates, dataIndustry]);

  // ========== RENDER ==========

  return (
    <div className="h-full overflow-y-auto bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card backdrop-blur-sm sticky top-0 z-40">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                  <Cloud className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Salesforce Tools</h1>
                  <p className="text-xs text-muted-foreground">API • Data • Development</p>
                </div>
              </div>
              
              {/* Current Org Indicator */}
              {currentOrg ? (
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: currentOrg.color }}
                  />
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{currentOrg.name}</div>
                    <div className="text-xs text-muted-foreground">{currentOrg.username}</div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="ml-2"
                    style={{ borderColor: currentOrg.color, color: currentOrg.color }}
                  >
                    {currentOrg.orgType}
                  </Badge>
                </div>
              ) : (
                <Button onClick={() => setShowAddOrgDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Connect Org
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Compact wrapping tabs */}
            <div className="mb-4">
              <TabsList className="bg-secondary border border-border p-1 h-auto flex flex-wrap gap-0.5">
                <TabsTrigger value="orgs" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Orgs</span>
                </TabsTrigger>
                <TabsTrigger value="soql" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Search className="w-3.5 h-3.5" />
                  <span>SOQL</span>
                </TabsTrigger>
                <TabsTrigger value="bulk" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk</span>
                </TabsTrigger>
                <TabsTrigger value="api" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Code className="w-3.5 h-3.5" />
                  <span>API</span>
                </TabsTrigger>
                <TabsTrigger value="schema" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Database className="w-3.5 h-3.5" />
                  <span>Schema</span>
                </TabsTrigger>
                <TabsTrigger value="inspect" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspector</span>
                </TabsTrigger>
                <TabsTrigger value="tests" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Play className="w-3.5 h-3.5" />
                  <span>Tests</span>
                </TabsTrigger>
                <TabsTrigger value="permissions" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Perms</span>
                </TabsTrigger>
                <TabsTrigger value="datafactory" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Factory</span>
                </TabsTrigger>
                <TabsTrigger value="relationships" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Relations</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Logs</span>
                </TabsTrigger>
                <TabsTrigger value="assertions" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Assert</span>
                </TabsTrigger>
                <TabsTrigger value="cloner" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone</span>
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Diff</span>
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </TabsTrigger>
                <TabsTrigger value="apex" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Apex</span>
                </TabsTrigger>
                <TabsTrigger value="fieldanalysis" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Fields</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Table className="w-3.5 h-3.5" />
                  <span>Reports</span>
                </TabsTrigger>
                {/* Testing Tabs */}
                <TabsTrigger value="functional" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-accent hover:text-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Functional</span>
                </TabsTrigger>
                <TabsTrigger value="integration" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-success/20 data-[state=active]:text-success hover:bg-accent hover:text-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Integration</span>
                </TabsTrigger>
                <TabsTrigger value="regression" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-warning/20 data-[state=active]:text-warning hover:bg-accent hover:text-foreground">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Regression</span>
                </TabsTrigger>
                <TabsTrigger value="uat" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-500 hover:bg-accent hover:text-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>UAT</span>
                </TabsTrigger>
                {/* Orchestrator - Main Hub */}
                <TabsTrigger value="orchestrator" className="gap-1 px-2 py-1 text-xs text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-primary hover:bg-primary/10 hover:text-foreground border border-border">
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Orchestrator</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ==================== ORGS TAB ==================== */}
            <TabsContent value="orgs">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Org List */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">Connected Orgs</CardTitle>
                        <Button onClick={() => setShowAddOrgDialog(true)} size="sm" className="gap-2">
                          <Plus className="w-4 h-4" />
                          Add Org
                        </Button>
                      </div>
                      <CardDescription>Manage your Salesforce org connections</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {orgs.length === 0 ? (
                        <div className="text-center py-12">
                          <Cloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">No orgs connected</h3>
                          <p className="text-muted-foreground mb-4">Connect a Salesforce org to get started</p>
                          <Button onClick={() => setShowAddOrgDialog(true)} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Connect Your First Org
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {orgs.map(org => (
                            <div
                              key={org.id}
                              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                                currentOrg?.id === org.id
                                  ? 'bg-primary/10 border-primary/50'
                                  : 'bg-secondary border-border hover:border-primary/30'
                              }`}
                              onClick={() => handleSelectOrg(org.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: org.color + '30' }}
                                  >
                                    <Cloud className="w-5 h-5" style={{ color: org.color }} />
                                  </div>
                                  <div>
                                    <div className="font-medium text-foreground flex items-center gap-2">
                                      {org.name}
                                      {currentOrg?.id === org.id && (
                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                                          Active
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{org.username}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" style={{ borderColor: org.color + '50', color: org.color }}>
                                    {org.orgType}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveOrg(org.id);
                                    }}
                                    className="text-muted-foreground hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {org.instanceUrl}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* API Limits */}
                <div>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">API Limits</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={loadApiLimits}
                          disabled={!currentOrg}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!currentOrg ? (
                        <p className="text-muted-foreground text-sm">Select an org to view limits</p>
                      ) : apiLimits ? (
                        <div className="space-y-4">
                          {Object.entries(apiLimits).slice(0, 6).map(([key, value]: [string, any]) => {
                            const percentage = ((value.Max - value.Remaining) / value.Max) * 100;
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span className="text-foreground">{value.Remaining.toLocaleString()} / {value.Max.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      percentage > 80 ? 'bg-red-500' :
                                      percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Button onClick={loadApiLimits} className="w-full">
                          Load Limits
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== SOQL TAB ==================== */}
            <TabsContent value="soql">
              <div className="space-y-4">
                {/* SOQL Editor with Monaco */}
                <div className="h-[200px]">
                  <SoqlEditor
                    value={soqlQuery}
                    onChange={setSoqlQuery}
                    onExecute={handleExecuteQuery}
                    isLoading={isLoading}
                    objects={objects.map(o => ({ name: o.name, label: o.label }))}
                    queryHistory={queryHistory}
                    disabled={!currentOrg}
                  />
                </div>

                {/* Query Error */}
                {queryError && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Query Error</div>
                        <div className="text-sm mt-1">{queryError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                {queryResults.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground text-sm flex items-center gap-2">
                          <Table className="w-4 h-4" />
                          Results ({queryResults.length} records)
                        </CardTitle>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const csv = [
                              queryColumns.join(','),
                              ...queryResults.map(r => 
                                queryColumns.map(c => JSON.stringify(r[c] ?? '')).join(',')
                              )
                            ].join('\n');
                            navigator.clipboard.writeText(csv);
                            toast.success('Copied as CSV');
                          }}
                          className="gap-1.5 text-muted-foreground border-border hover:text-foreground hover:bg-accent"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-muted-foreground font-medium w-12">#</th>
                              {queryColumns.map(col => (
                                <th key={col} className="px-4 py-2 text-left text-foreground font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResults.map((record, idx) => (
                              <tr key={idx} className="border-t border-border hover:bg-secondary/50">
                                <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                                {queryColumns.map(col => (
                                  <td key={col} className="px-4 py-2 text-foreground">
                                    {typeof record[col] === 'object' 
                                      ? JSON.stringify(record[col])
                                      : String(record[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Empty state */}
                {!queryError && queryResults.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Run a SOQL query to see results</p>
                    <p className="text-sm mt-1">Press Ctrl+Enter or click Run</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ==================== BULK LOADER TAB ==================== */}
            <TabsContent value="bulk">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Bulk Data Loader</CardTitle>
                      <CardDescription>Insert, update, or delete thousands of records</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Operation</Label>
                            <Select value={bulkOperation} onValueChange={(v: any) => setBulkOperation(v)}>
                              <SelectTrigger className="bg-input border-border text-foreground">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="insert">Insert</SelectItem>
                                <SelectItem value="update">Update</SelectItem>
                                <SelectItem value="upsert">Upsert</SelectItem>
                                <SelectItem value="delete">Delete</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Object</Label>
                            <Input
                              value={bulkObjectName}
                              onChange={(e) => setBulkObjectName(e.target.value)}
                              placeholder="e.g., Account, Contact"
                              className="bg-input border-border text-foreground"
                            />
                          </div>
                        </div>

                        {bulkOperation === 'upsert' && (
                          <div>
                            <Label>External ID Field</Label>
                            <Input
                              value={bulkExternalIdField}
                              onChange={(e) => setBulkExternalIdField(e.target.value)}
                              placeholder="e.g., External_Id__c"
                              className="bg-input border-border text-foreground"
                            />
                          </div>
                        )}

                        <div>
                          <Label>CSV Data</Label>
                          <Textarea
                            value={bulkCsvData}
                            onChange={(e) => setBulkCsvData(e.target.value)}
                            placeholder="Name,Phone,Website&#10;Acme Corp,(555) 123-4567,www.acme.com"
                            className="font-mono text-sm bg-input border-border min-h-[200px] text-foreground placeholder:text-muted-foreground"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleBulkUpload}
                            disabled={!currentOrg || isLoading || !bulkObjectName || !bulkCsvData}
                            className="gap-2"
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            Start Bulk Job
                          </Button>
                          <Button variant="outline" asChild className="text-foreground border-border hover:text-foreground hover:bg-secondary">
                            <label className="cursor-pointer gap-2">
                              <FolderOpen className="w-4 h-4" />
                              Upload CSV
                              <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                      setBulkCsvData(e.target?.result as string);
                                    };
                                    reader.readAsText(file);
                                  }
                                }}
                              />
                            </label>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Job Status */}
                <div>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-sm">Job Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bulkJobStatus ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">State</span>
                            <Badge className={
                              bulkJobStatus.state === 'JobComplete' ? 'bg-green-500/20 text-green-400' :
                              bulkJobStatus.state === 'Failed' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }>
                              {bulkJobStatus.state}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Processed</span>
                            <span className="text-foreground">{bulkJobStatus.numberRecordsProcessed}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="text-red-400">{bulkJobStatus.numberRecordsFailed}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Job ID</span>
                            <span className="text-foreground font-mono text-xs">{bulkJobStatus.id}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No active job</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== API PLAYGROUND TAB ==================== */}
            <TabsContent value="api">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* API Reference Browser */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-foreground text-sm">API Reference</CardTitle>
                    <CardDescription className="text-xs">Click any endpoint to load it</CardDescription>
                  </CardHeader>
                  <CardContent className="p-3">
                    <SalesforceApiReference
                      objects={objects.map(o => ({ name: o.name, label: o.label }))}
                      onSelectEndpoint={(method, path, body) => {
                        setApiMethod(method);
                        setApiEndpoint(path);
                        if (body) setApiBody(body);
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Request Builder */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3">
                    <CardTitle className="text-foreground text-sm">Request Builder</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Select value={apiMethod} onValueChange={(v: any) => setApiMethod(v)}>
                          <SelectTrigger className="w-[100px] bg-input border-border text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                          placeholder="/sobjects/Account/describe"
                          className="flex-1 bg-input border-border font-mono text-sm text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      {(apiMethod === 'POST' || apiMethod === 'PATCH') && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Request Body (JSON)</Label>
                          <Textarea
                            value={apiBody}
                            onChange={(e) => setApiBody(e.target.value)}
                            placeholder='{"Name": "Test Account"}'
                            className="font-mono text-sm bg-input border-border min-h-[150px] text-foreground placeholder:text-muted-foreground mt-1"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={handleApiRequest}
                          disabled={!currentOrg || isLoading}
                          className="gap-2 flex-1"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          Send Request
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setApiEndpoint('');
                            setApiBody('');
                            setApiResponse(null);
                            setApiError(null);
                          }}
                          className="text-foreground border-border hover:text-foreground hover:bg-secondary"
                        >
                          Clear
                        </Button>
                      </div>

                      {/* Full URL Preview */}
                      {currentOrg && apiEndpoint && (
                        <div className="p-2 rounded bg-input/50 border border-border">
                          <Label className="text-muted-foreground text-xs">Full URL</Label>
                          <code className="text-xs text-muted-foreground font-mono block mt-1 break-all">
                            {currentOrg.instanceUrl}/services/data/v59.0{apiEndpoint}
                          </code>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Response */}
                <Card className="bg-card border-border">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground text-sm">Response</CardTitle>
                      {apiResponse && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(apiResponse, null, 2));
                            toast.success('Copied to clipboard');
                          }}
                          className="h-7 px-2"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {apiError ? (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {apiError}
                      </div>
                    ) : apiResponse ? (
                      <pre className="p-4 rounded-lg bg-input border border-border overflow-auto max-h-[500px] text-xs text-foreground font-mono">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Code className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select an endpoint and send a request</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== SCHEMA BROWSER TAB ==================== */}
            <TabsContent value="schema">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Object List */}
                <div>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground text-sm">Objects</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadObjects}
                          disabled={!currentOrg || isLoading}
                        >
                          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Input
                          value={objectFilter}
                          onChange={(e) => setObjectFilter(e.target.value)}
                          placeholder="Filter objects..."
                          className="bg-input border-border text-foreground"
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="customOnly"
                            checked={showCustomOnly}
                            onCheckedChange={(c) => setShowCustomOnly(!!c)}
                          />
                          <Label htmlFor="customOnly" className="text-sm text-muted-foreground">
                            Custom objects only
                          </Label>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto space-y-1">
                          {filteredObjects.map(obj => (
                            <div
                              key={obj.name}
                              className={`p-2 rounded cursor-pointer transition-colors ${
                                selectedObject === obj.name
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'hover:bg-secondary/50 text-foreground'
                              }`}
                              onClick={() => loadObjectDescribe(obj.name)}
                            >
                              <div className="flex items-center gap-2">
                                {obj.custom && <Badge variant="outline" className="text-[10px] px-1 text-blue-300 border-blue-500/50">C</Badge>}
                                <span className="text-sm truncate">{obj.label}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{obj.name}</div>
                            </div>
                          ))}
                          {objects.length === 0 && (
                            <Button onClick={loadObjects} className="w-full" disabled={!currentOrg}>
                              Load Objects
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Object Details */}
                <div className="lg:col-span-3">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">
                        {objectDescribe ? `${objectDescribe.label} (${objectDescribe.name})` : 'Select an Object'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {objectDescribe ? (
                        <div className="space-y-4">
                          {/* Object Info */}
                          <div className="flex flex-wrap gap-2">
                            {objectDescribe.createable && <Badge className="bg-green-500/20 text-green-400">Createable</Badge>}
                            {objectDescribe.updateable && <Badge className="bg-blue-500/20 text-blue-400">Updateable</Badge>}
                            {objectDescribe.deletable && <Badge className="bg-red-500/20 text-red-400">Deletable</Badge>}
                            {objectDescribe.queryable && <Badge className="bg-primary/20 text-primary">Queryable</Badge>}
                            {objectDescribe.custom && <Badge className="bg-orange-500/20 text-orange-400">Custom</Badge>}
                          </div>

                          {/* Fields Table */}
                          <div className="overflow-auto max-h-[500px] rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-secondary sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left text-foreground">Field</th>
                                  <th className="px-4 py-2 text-left text-foreground">API Name</th>
                                  <th className="px-4 py-2 text-left text-foreground">Type</th>
                                  <th className="px-4 py-2 text-left text-foreground">Properties</th>
                                </tr>
                              </thead>
                              <tbody>
                                {objectDescribe.fields.map(field => (
                                  <tr key={field.name} className="border-t border-border hover:bg-secondary/50">
                                    <td className="px-4 py-2 text-foreground">{field.label}</td>
                                    <td className="px-4 py-2 text-foreground font-mono text-xs">{field.name}</td>
                                    <td className="px-4 py-2">
                                      <Badge variant="outline" className="text-xs text-cyan-300 border-cyan-500/50 bg-cyan-900/20">
                                        {field.type}
                                        {field.length > 0 && `(${field.length})`}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        {!field.nillable && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Req</Badge>}
                                        {field.unique && <Badge className="bg-primary/20 text-primary text-[10px]">Unique</Badge>}
                                        {field.externalId && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">ExtId</Badge>}
                                        {field.custom && <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">Custom</Badge>}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Select an object from the list to view its schema</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== RECORD INSPECTOR TAB ==================== */}
            <TabsContent value="inspect">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Record Inspector</CardTitle>
                    <CardDescription>View any Salesforce record by ID</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          value={inspectRecordId}
                          onChange={(e) => setInspectRecordId(e.target.value)}
                          placeholder="Enter Record ID (e.g., 001xx...)"
                          className="flex-1 bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
                        />
                        <Button
                          onClick={handleInspectRecord}
                          disabled={!currentOrg || isLoading || !inspectRecordId}
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div>
                        <Label>Object Type (auto-detected)</Label>
                        <Input
                          value={inspectObjectType}
                          onChange={(e) => setInspectObjectType(e.target.value)}
                          placeholder="Account, Contact, etc."
                          className="bg-input border-border text-foreground"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground">Record Details</CardTitle>
                      {inspectedRecord && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(inspectedRecord, null, 2));
                            toast.success('Copied');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {inspectedRecord ? (
                      <div className="max-h-[500px] overflow-y-auto space-y-2">
                        {Object.entries(inspectedRecord)
                          .filter(([key]) => key !== 'attributes')
                          .map(([key, value]) => (
                            <div key={key} className="flex justify-between p-2 rounded bg-input/50">
                              <span className="text-muted-foreground text-sm">{key}</span>
                              <span className="text-foreground text-sm font-mono">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'null')}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Enter a record ID to inspect</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== APEX TESTS TAB ==================== */}
            <TabsContent value="tests">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Test Classes */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-foreground text-sm">Test Classes</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadTestClasses}
                        disabled={!currentOrg || isLoading}
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                      {testClasses.map(cls => (
                        <div
                          key={cls.Id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-secondary/50"
                        >
                          <Checkbox
                            checked={selectedTestClasses.includes(cls.Id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTestClasses([...selectedTestClasses, cls.Id]);
                              } else {
                                setSelectedTestClasses(selectedTestClasses.filter(id => id !== cls.Id));
                              }
                            }}
                          />
                          <span className="text-sm text-foreground">{cls.Name}</span>
                        </div>
                      ))}
                      {testClasses.length === 0 && (
                        <Button onClick={loadTestClasses} className="w-full" disabled={!currentOrg}>
                          Load Test Classes
                        </Button>
                      )}
                    </div>
                    {selectedTestClasses.length > 0 && (
                      <Button
                        onClick={handleRunTests}
                        disabled={testRunStatus === 'running'}
                        className="w-full mt-4 gap-2"
                      >
                        {testRunStatus === 'running' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Run {selectedTestClasses.length} Tests
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Test Results */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-foreground">Test Results</CardTitle>
                        {testRunStatus !== 'idle' && (
                          <Badge className={
                            testRunStatus === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }>
                            {testRunStatus === 'running' ? 'Running...' : 'Complete'}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {testResults.length > 0 ? (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {testResults.map(result => (
                            <div
                              key={result.id}
                              className={`p-3 rounded-lg border ${
                                result.outcome === 'Pass' 
                                  ? 'bg-green-500/10 border-green-500/30' 
                                  : 'bg-red-500/10 border-red-500/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {result.outcome === 'Pass' ? (
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className="text-foreground font-medium">
                                    {result.apexClass?.name}.{result.methodName}
                                  </span>
                                </div>
                                <span className="text-muted-foreground text-sm">{result.runTime}ms</span>
                              </div>
                              {result.message && (
                                <div className="mt-2 text-sm text-red-400">{result.message}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Select test classes and run tests to see results</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== PERMISSIONS TAB ==================== */}
            <TabsContent value="permissions">
              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Permission Analyzer</CardTitle>
                    <CardDescription>Check user permissions on objects and fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <Input
                        value={permissionUserId}
                        onChange={(e) => setPermissionUserId(e.target.value)}
                        placeholder="User ID (leave blank for current user)"
                        className="max-w-md bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
                      />
                      <Button
                        onClick={handleAnalyzePermissions}
                        disabled={!currentOrg || isLoading}
                        className="gap-2"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        Analyze Permissions
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {objectPermissions.length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Object Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto max-h-[400px] rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-foreground">Object</th>
                              <th className="px-4 py-2 text-center text-foreground">Create</th>
                              <th className="px-4 py-2 text-center text-foreground">Read</th>
                              <th className="px-4 py-2 text-center text-foreground">Edit</th>
                              <th className="px-4 py-2 text-center text-foreground">Delete</th>
                              <th className="px-4 py-2 text-center text-foreground">View All</th>
                              <th className="px-4 py-2 text-center text-foreground">Modify All</th>
                            </tr>
                          </thead>
                          <tbody>
                            {objectPermissions.map((perm, idx) => (
                              <tr key={idx} className="border-t border-border hover:bg-secondary/50">
                                <td className="px-4 py-2 text-foreground">{perm.objectName}</td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canCreate ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canRead ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canEdit ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canDelete ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canViewAll ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canModifyAll ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground mx-auto" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ==================== DATA FACTORY TAB ==================== */}
            <TabsContent value="datafactory">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Data Generation */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Test Data Factory</CardTitle>
                      <CardDescription>Generate realistic Salesforce test data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Object</Label>
                            <Select value={selectedDataObject} onValueChange={setSelectedDataObject}>
                              <SelectTrigger className="bg-input border-border text-foreground">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STANDARD_OBJECT_TEMPLATES.map(obj => (
                                  <SelectItem key={obj.apiName} value={obj.apiName}>
                                    {obj.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Record Count</Label>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={dataRecordCount}
                              onChange={(e) => setDataRecordCount(parseInt(e.target.value) || 10)}
                              className="bg-input border-border text-foreground"
                            />
                          </div>
                          <div>
                            <Label>Industry</Label>
                            <Select value={dataIndustry} onValueChange={(v: any) => setDataIndustry(v)}>
                              <SelectTrigger className="bg-input border-border text-foreground">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="generic">Generic</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="technology">Technology</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={handleGenerateTestData} disabled={isLoading} className="gap-2">
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                            {isLoading ? 'Fetching Schema...' : 'Generate Data'}
                          </Button>
                          {generatedRecords.length > 0 && (
                            <>
                              <Button variant="outline" onClick={handleExportTestDataCSV} className="gap-2 text-foreground border-border hover:text-foreground hover:bg-secondary">
                                <Download className="w-4 h-4" />
                                Export CSV
                              </Button>
                              <Button variant="outline" onClick={handleCopyTestDataJSON} className="gap-2 text-foreground border-border hover:text-foreground hover:bg-secondary">
                                <Copy className="w-4 h-4" />
                                Copy JSON
                              </Button>
                              <Button
                                onClick={handleInsertTestData}
                                disabled={!currentOrg || isLoading}
                                className="gap-2 bg-green-600 hover:bg-green-700"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4" />
                                )}
                                Insert to Org
                              </Button>
                            </>
                          )}
                        </div>

                        {seedingProgress && (
                          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-blue-400">Inserting records...</span>
                              <span className="text-foreground">{seedingProgress.current} / {seedingProgress.total}</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(seedingProgress.current / seedingProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {generatedRecords.length > 0 && (
                          <div className="overflow-auto max-h-[400px] rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead className="bg-secondary sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left text-foreground">#</th>
                                  {Object.keys(generatedRecords[0]?.data || {}).slice(0, 5).map(key => (
                                    <th key={key} className="px-4 py-2 text-left text-foreground">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {generatedRecords.slice(0, 20).map((record, idx) => (
                                  <tr key={idx} className="border-t border-border hover:bg-secondary/50">
                                    <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                                    {Object.entries(record.data).slice(0, 5).map(([key, value]) => (
                                      <td key={key} className="px-4 py-2 text-foreground">
                                        {String(value ?? '').slice(0, 30)}
                                        {String(value ?? '').length > 30 && '...'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {generatedRecords.length > 20 && (
                              <div className="p-2 text-center text-muted-foreground bg-secondary/50">
                                ... and {generatedRecords.length - 20} more records
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Seeding Templates */}
                <div>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-sm">Data Seeding Templates</CardTitle>
                      <CardDescription>Pre-built data sets for common scenarios</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {seedingTemplates.map(template => (
                          <div
                            key={template.name}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedSeedTemplate === template.name
                                ? 'bg-primary/10 border-primary/50'
                                : 'bg-input/50 border-border hover:border-border'
                            }`}
                            onClick={() => handleApplySeedTemplate(template.name)}
                          >
                            <div className="font-medium text-foreground text-sm">{template.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.objects.map(obj => (
                                <Badge key={obj.object} variant="outline" className="text-[10px] text-foreground border-slate-500 bg-secondary/50">
                                  {obj.object} ({obj.count})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Object Fields Preview */}
                  <Card className="bg-card border-border mt-4">
                    <CardHeader>
                      <CardTitle className="text-foreground text-sm">
                        {selectedDataObject} Fields
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === selectedDataObject)?.fields.map(field => (
                          <div
                            key={field.name}
                            className="flex items-center justify-between p-2 rounded bg-input/50"
                          >
                            <span className="text-sm text-foreground">{field.label}</span>
                            <Badge variant="outline" className="text-[10px] text-cyan-300 border-cyan-500/50">
                              {field.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== RELATIONSHIPS TAB ==================== */}
            <TabsContent value="relationships">
              <SalesforceRelationshipVisualizer isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== DEBUG LOGS TAB ==================== */}
            <TabsContent value="logs">
              <SalesforceDebugLogAnalyzer isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== ASSERTIONS TAB ==================== */}
            <TabsContent value="assertions">
              <SalesforceAssertionBuilder isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== CLONER TAB ==================== */}
            <TabsContent value="cloner">
              <SalesforceRecordCloner isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== DIFF TAB ==================== */}
            <TabsContent value="diff">
              <SalesforceDataDiff isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== CREATE TAB ==================== */}
            <TabsContent value="create">
              <SalesforceQuickRecordCreator isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== APEX TAB ==================== */}
            <TabsContent value="apex">
              <SalesforceApexExecutor isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== FIELD ANALYSIS TAB ==================== */}
            <TabsContent value="fieldanalysis">
              <SalesforceFieldAnalyzer isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== REPORTS TAB ==================== */}
            <TabsContent value="reports">
              <SalesforceReportRunner isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== FUNCTIONAL TESTING TAB ==================== */}
            <TabsContent value="functional">
              <SalesforceFunctionalTesting isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== INTEGRATION TESTING TAB ==================== */}
            <TabsContent value="integration">
              <SalesforceIntegrationTesting isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== REGRESSION TESTING TAB ==================== */}
            <TabsContent value="regression">
              <SalesforceRegressionTesting isConnected={!!currentOrg} />
            </TabsContent>

            {/* ==================== UAT TAB ==================== */}
            <TabsContent value="uat">
              <SalesforceUATesting isConnected={!!currentOrg} />
            </TabsContent>

            {/* Test Orchestrator - Main Hub */}
            <TabsContent value="orchestrator">
              <SalesforceTestOrchestrator isConnected={!!currentOrg} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Org Dialog */}
        <AddOrgDialog
          open={showAddOrgDialog}
          onOpenChange={setShowAddOrgDialog}
          form={newOrgForm}
          onFormChange={setNewOrgForm}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          onAddOrg={handleAddOrg}
          onOrgConnected={(orgId) => {
            loadOrgs();
            handleSelectOrg(orgId);
          }}
        />
    </div>
  );
}

export default SalesforceToolsPage;

