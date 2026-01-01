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
  AlertCircle, CheckCircle, Loader2, ArrowRight, ExternalLink,
  Building2, Key, Lock, Unlock, MoreVertical, Layers, Hash, GitBranch, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  salesforceApi,
  SalesforceOrg,
  SalesforceCredentials,
  SObjectDescribe,
  QueryResult,
  ApexTestResult
} from '@/lib/salesforce-api';
import {
  testDataFactory,
  STANDARD_OBJECT_TEMPLATES,
  GeneratedRecord
} from '@/lib/salesforce-test-data-factory';
import { SalesforceRelationshipVisualizer } from '@/components/SalesforceRelationshipVisualizer';
import { SalesforceDebugLogAnalyzer } from '@/components/SalesforceDebugLogAnalyzer';
import { SalesforceAssertionBuilder } from '@/components/SalesforceAssertionBuilder';
import { SalesforceRecordCloner } from '@/components/SalesforceRecordCloner';
import { SalesforceDataDiff } from '@/components/SalesforceDataDiff';
import { SalesforceQuickRecordCreator } from '@/components/SalesforceQuickRecordCreator';
import { SalesforceApexExecutor } from '@/components/SalesforceApexExecutor';
import { SalesforceFieldAnalyzer } from '@/components/SalesforceFieldAnalyzer';
import { SalesforceReportRunner } from '@/components/SalesforceReportRunner';
import { SoqlEditor } from '@/components/SoqlEditor';
import { SalesforceApiReference } from '@/components/SalesforceApiReference';
import { SalesforceFunctionalTesting } from '@/components/SalesforceFunctionalTesting';
import { SalesforceIntegrationTesting } from '@/components/SalesforceIntegrationTesting';
import { SalesforceRegressionTesting } from '@/components/SalesforceRegressionTesting';
import { SalesforceUATesting } from '@/components/SalesforceUATesting';
import { SalesforceTestOrchestrator } from '@/components/SalesforceTestOrchestrator';

// ============================================================================
// ORG COLORS
// ============================================================================

const ORG_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
];

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
  const [newOrgForm, setNewOrgForm] = useState<SalesforceCredentials & { name: string; orgType: string; color: string }>({
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
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Cloud className="w-5 h-5 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Salesforce Tools</h1>
                  <p className="text-xs text-gray-400">API • Data • Development</p>
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
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{currentOrg.name}</div>
                    <div className="text-xs text-slate-400">{currentOrg.username}</div>
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
              <TabsList className="bg-gray-900 border border-gray-700 p-1 h-auto flex flex-wrap gap-0.5">
                <TabsTrigger value="orgs" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Orgs</span>
                </TabsTrigger>
                <TabsTrigger value="soql" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Search className="w-3.5 h-3.5" />
                  <span>SOQL</span>
                </TabsTrigger>
                <TabsTrigger value="bulk" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk</span>
                </TabsTrigger>
                <TabsTrigger value="api" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Code className="w-3.5 h-3.5" />
                  <span>API</span>
                </TabsTrigger>
                <TabsTrigger value="schema" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Database className="w-3.5 h-3.5" />
                  <span>Schema</span>
                </TabsTrigger>
                <TabsTrigger value="inspect" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspector</span>
                </TabsTrigger>
                <TabsTrigger value="tests" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Play className="w-3.5 h-3.5" />
                  <span>Tests</span>
                </TabsTrigger>
                <TabsTrigger value="permissions" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Perms</span>
                </TabsTrigger>
                <TabsTrigger value="datafactory" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Factory</span>
                </TabsTrigger>
                <TabsTrigger value="relationships" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Relations</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Logs</span>
                </TabsTrigger>
                <TabsTrigger value="assertions" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Assert</span>
                </TabsTrigger>
                <TabsTrigger value="cloner" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Copy className="w-3.5 h-3.5" />
                  <span>Clone</span>
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Diff</span>
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </TabsTrigger>
                <TabsTrigger value="apex" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Apex</span>
                </TabsTrigger>
                <TabsTrigger value="fieldanalysis" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Fields</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Table className="w-3.5 h-3.5" />
                  <span>Reports</span>
                </TabsTrigger>
                {/* Testing Tabs */}
                <TabsTrigger value="functional" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-blue-500/30 data-[state=active]:text-blue-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Functional</span>
                </TabsTrigger>
                <TabsTrigger value="integration" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-green-500/30 data-[state=active]:text-green-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Integration</span>
                </TabsTrigger>
                <TabsTrigger value="regression" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-yellow-500/30 data-[state=active]:text-yellow-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Regression</span>
                </TabsTrigger>
                <TabsTrigger value="uat" className="gap-1 px-2 py-1 text-xs text-gray-400 data-[state=active]:bg-pink-500/30 data-[state=active]:text-pink-400 hover:bg-gray-800 hover:text-gray-900 dark:text-white">
                  <Users className="w-3.5 h-3.5" />
                  <span>UAT</span>
                </TabsTrigger>
                {/* Orchestrator - Main Hub */}
                <TabsTrigger value="orchestrator" className="gap-1 px-2 py-1 text-xs text-gray-300 bg-gradient-to-r from-amber-600/30 to-orange-600/30 data-[state=active]:from-amber-500/50 data-[state=active]:to-orange-500/50 data-[state=active]:text-amber-300 hover:from-amber-500/40 hover:to-orange-500/40 hover:text-gray-900 dark:text-white border border-amber-500/30">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white">Connected Orgs</CardTitle>
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
                          <Cloud className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orgs connected</h3>
                          <p className="text-slate-400 mb-4">Connect a Salesforce org to get started</p>
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
                                  ? 'bg-slate-700/50 border-blue-500/50'
                                  : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
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
                                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                      {org.name}
                                      {currentOrg?.id === org.id && (
                                        <Badge className="bg-green-500/20 text-green-400 border-green-500/50 text-xs">
                                          Active
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-slate-400">{org.username}</div>
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
                                    className="text-slate-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white">API Limits</CardTitle>
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
                        <p className="text-slate-400 text-sm">Select an org to view limits</p>
                      ) : apiLimits ? (
                        <div className="space-y-4">
                          {Object.entries(apiLimits).slice(0, 6).map(([key, value]: [string, any]) => {
                            const percentage = ((value.Max - value.Remaining) / value.Max) * 100;
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-slate-400">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                  <span className="text-gray-900 dark:text-white">{value.Remaining.toLocaleString()} / {value.Max.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white text-sm flex items-center gap-2">
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
                          className="gap-1.5 text-slate-300 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-slate-500 font-medium w-12">#</th>
                              {queryColumns.map(col => (
                                <th key={col} className="px-4 py-2 text-left text-slate-300 font-medium">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResults.map((record, idx) => (
                              <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                                <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                                {queryColumns.map(col => (
                                  <td key={col} className="px-4 py-2 text-slate-300">
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
                  <div className="text-center py-12 text-slate-500">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">Bulk Data Loader</CardTitle>
                      <CardDescription>Insert, update, or delete thousands of records</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Operation</Label>
                            <Select value={bulkOperation} onValueChange={(v: any) => setBulkOperation(v)}>
                              <SelectTrigger className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white">
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
                              className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white"
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
                              className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        )}

                        <div>
                          <Label>CSV Data</Label>
                          <Textarea
                            value={bulkCsvData}
                            onChange={(e) => setBulkCsvData(e.target.value)}
                            placeholder="Name,Phone,Website&#10;Acme Corp,(555) 123-4567,www.acme.com"
                            className="font-mono text-sm bg-slate-900 border-slate-700 min-h-[200px] text-gray-900 dark:text-white placeholder:text-slate-500"
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
                          <Button variant="outline" asChild className="text-slate-200 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white text-sm">Job Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bulkJobStatus ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">State</span>
                            <Badge className={
                              bulkJobStatus.state === 'JobComplete' ? 'bg-green-500/20 text-green-400' :
                              bulkJobStatus.state === 'Failed' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }>
                              {bulkJobStatus.state}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Processed</span>
                            <span className="text-gray-900 dark:text-white">{bulkJobStatus.numberRecordsProcessed}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Failed</span>
                            <span className="text-red-400">{bulkJobStatus.numberRecordsFailed}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Job ID</span>
                            <span className="text-gray-900 dark:text-white font-mono text-xs">{bulkJobStatus.id}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">No active job</p>
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
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-gray-900 dark:text-white text-sm">API Reference</CardTitle>
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
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-gray-900 dark:text-white text-sm">Request Builder</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Select value={apiMethod} onValueChange={(v: any) => setApiMethod(v)}>
                          <SelectTrigger className="w-[100px] bg-slate-900 border-slate-700 text-gray-900 dark:text-white">
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
                          className="flex-1 bg-slate-900 border-slate-700 font-mono text-sm text-gray-900 dark:text-white placeholder:text-slate-500"
                        />
                      </div>

                      {(apiMethod === 'POST' || apiMethod === 'PATCH') && (
                        <div>
                          <Label className="text-slate-400 text-xs">Request Body (JSON)</Label>
                          <Textarea
                            value={apiBody}
                            onChange={(e) => setApiBody(e.target.value)}
                            placeholder='{"Name": "Test Account"}'
                            className="font-mono text-sm bg-slate-900 border-slate-700 min-h-[150px] text-gray-900 dark:text-white placeholder:text-slate-500 mt-1"
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
                          className="text-slate-300 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700"
                        >
                          Clear
                        </Button>
                      </div>

                      {/* Full URL Preview */}
                      {currentOrg && apiEndpoint && (
                        <div className="p-2 rounded bg-slate-900/50 border border-slate-700">
                          <Label className="text-slate-500 text-xs">Full URL</Label>
                          <code className="text-xs text-slate-400 font-mono block mt-1 break-all">
                            {currentOrg.instanceUrl}/services/data/v59.0{apiEndpoint}
                          </code>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Response */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-gray-900 dark:text-white text-sm">Response</CardTitle>
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
                      <pre className="p-4 rounded-lg bg-slate-900 border border-slate-700 overflow-auto max-h-[500px] text-xs text-slate-300 font-mono">
                        {JSON.stringify(apiResponse, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white text-sm">Objects</CardTitle>
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
                          className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="customOnly"
                            checked={showCustomOnly}
                            onCheckedChange={(c) => setShowCustomOnly(!!c)}
                          />
                          <Label htmlFor="customOnly" className="text-sm text-slate-400">
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
                                  : 'hover:bg-slate-700/50 text-slate-300'
                              }`}
                              onClick={() => loadObjectDescribe(obj.name)}
                            >
                              <div className="flex items-center gap-2">
                                {obj.custom && <Badge variant="outline" className="text-[10px] px-1 text-blue-300 border-blue-500/50">C</Badge>}
                                <span className="text-sm truncate">{obj.label}</span>
                              </div>
                              <div className="text-xs text-slate-500">{obj.name}</div>
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">
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
                            {objectDescribe.queryable && <Badge className="bg-purple-500/20 text-purple-400">Queryable</Badge>}
                            {objectDescribe.custom && <Badge className="bg-orange-500/20 text-orange-400">Custom</Badge>}
                          </div>

                          {/* Fields Table */}
                          <div className="overflow-auto max-h-[500px] rounded-lg border border-slate-700">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-800 sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left text-slate-300">Field</th>
                                  <th className="px-4 py-2 text-left text-slate-300">API Name</th>
                                  <th className="px-4 py-2 text-left text-slate-300">Type</th>
                                  <th className="px-4 py-2 text-left text-slate-300">Properties</th>
                                </tr>
                              </thead>
                              <tbody>
                                {objectDescribe.fields.map(field => (
                                  <tr key={field.name} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                                    <td className="px-4 py-2 text-gray-900 dark:text-white">{field.label}</td>
                                    <td className="px-4 py-2 text-slate-300 font-mono text-xs">{field.name}</td>
                                    <td className="px-4 py-2">
                                      <Badge variant="outline" className="text-xs text-cyan-300 border-cyan-500/50 bg-cyan-900/20">
                                        {field.type}
                                        {field.length > 0 && `(${field.length})`}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        {!field.nillable && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Req</Badge>}
                                        {field.unique && <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">Unique</Badge>}
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
                        <p className="text-slate-500">Select an object from the list to view its schema</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== RECORD INSPECTOR TAB ==================== */}
            <TabsContent value="inspect">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Record Inspector</CardTitle>
                    <CardDescription>View any Salesforce record by ID</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          value={inspectRecordId}
                          onChange={(e) => setInspectRecordId(e.target.value)}
                          placeholder="Enter Record ID (e.g., 001xx...)"
                          className="flex-1 bg-slate-900 border-slate-700 font-mono text-gray-900 dark:text-white placeholder:text-slate-500"
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
                          className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-gray-900 dark:text-white">Record Details</CardTitle>
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
                            <div key={key} className="flex justify-between p-2 rounded bg-slate-900/50">
                              <span className="text-slate-400 text-sm">{key}</span>
                              <span className="text-gray-900 dark:text-white text-sm font-mono">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'null')}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">Enter a record ID to inspect</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== APEX TESTS TAB ==================== */}
            <TabsContent value="tests">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Test Classes */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-gray-900 dark:text-white text-sm">Test Classes</CardTitle>
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
                          className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50"
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
                          <span className="text-sm text-slate-300">{cls.Name}</span>
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 dark:text-white">Test Results</CardTitle>
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
                                  <span className="text-gray-900 dark:text-white font-medium">
                                    {result.apexClass?.name}.{result.methodName}
                                  </span>
                                </div>
                                <span className="text-slate-400 text-sm">{result.runTime}ms</span>
                              </div>
                              {result.message && (
                                <div className="mt-2 text-sm text-red-400">{result.message}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">Select test classes and run tests to see results</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== PERMISSIONS TAB ==================== */}
            <TabsContent value="permissions">
              <div className="space-y-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">Permission Analyzer</CardTitle>
                    <CardDescription>Check user permissions on objects and fields</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      <Input
                        value={permissionUserId}
                        onChange={(e) => setPermissionUserId(e.target.value)}
                        placeholder="User ID (leave blank for current user)"
                        className="max-w-md bg-slate-900 border-slate-700 font-mono text-gray-900 dark:text-white placeholder:text-slate-500"
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">Object Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-auto max-h-[400px] rounded-lg border border-slate-700">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-slate-300">Object</th>
                              <th className="px-4 py-2 text-center text-slate-300">Create</th>
                              <th className="px-4 py-2 text-center text-slate-300">Read</th>
                              <th className="px-4 py-2 text-center text-slate-300">Edit</th>
                              <th className="px-4 py-2 text-center text-slate-300">Delete</th>
                              <th className="px-4 py-2 text-center text-slate-300">View All</th>
                              <th className="px-4 py-2 text-center text-slate-300">Modify All</th>
                            </tr>
                          </thead>
                          <tbody>
                            {objectPermissions.map((perm, idx) => (
                              <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                                <td className="px-4 py-2 text-gray-900 dark:text-white">{perm.objectName}</td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canCreate ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canRead ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canEdit ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canDelete ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canViewAll ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {perm.canModifyAll ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">Test Data Factory</CardTitle>
                      <CardDescription>Generate realistic Salesforce test data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Object</Label>
                            <Select value={selectedDataObject} onValueChange={setSelectedDataObject}>
                              <SelectTrigger className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white">
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
                              className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <Label>Industry</Label>
                            <Select value={dataIndustry} onValueChange={(v: any) => setDataIndustry(v)}>
                              <SelectTrigger className="bg-slate-900 border-slate-700 text-gray-900 dark:text-white">
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
                              <Button variant="outline" onClick={handleExportTestDataCSV} className="gap-2 text-slate-200 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700">
                                <Download className="w-4 h-4" />
                                Export CSV
                              </Button>
                              <Button variant="outline" onClick={handleCopyTestDataJSON} className="gap-2 text-slate-200 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700">
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
                              <span className="text-gray-900 dark:text-white">{seedingProgress.current} / {seedingProgress.total}</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(seedingProgress.current / seedingProgress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {generatedRecords.length > 0 && (
                          <div className="overflow-auto max-h-[400px] rounded-lg border border-slate-700">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-800 sticky top-0">
                                <tr>
                                  <th className="px-4 py-2 text-left text-slate-300">#</th>
                                  {Object.keys(generatedRecords[0]?.data || {}).slice(0, 5).map(key => (
                                    <th key={key} className="px-4 py-2 text-left text-slate-300">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {generatedRecords.slice(0, 20).map((record, idx) => (
                                  <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                                    <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                                    {Object.entries(record.data).slice(0, 5).map(([key, value]) => (
                                      <td key={key} className="px-4 py-2 text-slate-300">
                                        {String(value ?? '').slice(0, 30)}
                                        {String(value ?? '').length > 30 && '...'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {generatedRecords.length > 20 && (
                              <div className="p-2 text-center text-slate-500 bg-slate-800/50">
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
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white text-sm">Data Seeding Templates</CardTitle>
                      <CardDescription>Pre-built data sets for common scenarios</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {seedingTemplates.map(template => (
                          <div
                            key={template.name}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedSeedTemplate === template.name
                                ? 'bg-purple-500/10 border-purple-500/50'
                                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                            }`}
                            onClick={() => handleApplySeedTemplate(template.name)}
                          >
                            <div className="font-medium text-gray-900 dark:text-white text-sm">{template.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{template.description}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.objects.map(obj => (
                                <Badge key={obj.object} variant="outline" className="text-[10px] text-slate-200 border-slate-500 bg-slate-800/50">
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
                  <Card className="bg-slate-800/50 border-slate-700 mt-4">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white text-sm">
                        {selectedDataObject} Fields
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === selectedDataObject)?.fields.map(field => (
                          <div
                            key={field.name}
                            className="flex items-center justify-between p-2 rounded bg-slate-900/50"
                          >
                            <span className="text-sm text-slate-300">{field.label}</span>
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
        <Dialog open={showAddOrgDialog} onOpenChange={setShowAddOrgDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Connect Salesforce Org</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Browser OAuth Option - Recommended */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ExternalLink className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-blue-300">Recommended: Login with Browser</span>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  Opens Salesforce login in your browser. Works with SSO, MFA, and all org types.
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Select 
                      value={newOrgForm.orgType} 
                      onValueChange={(v) => setNewOrgForm({ ...newOrgForm, orgType: v })}
                    >
                      <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-gray-900 dark:text-white">
                        <SelectValue placeholder="Org Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={newOrgForm.name}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                      placeholder="Org nickname (for display)"
                      className="flex-1 bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                    />
                  </div>
                  <Input
                    value={newOrgForm.loginUrl}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, loginUrl: e.target.value })}
                    placeholder="Paste your Salesforce URL (e.g., https://orgfarm-xxx-dev-ed.develop.my.salesforce.com)"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500 text-xs"
                  />
                  <p className="text-xs text-slate-500">
                    Paste your full Salesforce login URL, or leave empty to use standard login
                  </p>
                </div>
                <div className="flex gap-2 items-center mt-3">
                  <Button 
                    onClick={async () => {
                      setIsLoading(true);
                      let pollInterval: NodeJS.Timeout | null = null;
                      let timeoutId: NodeJS.Timeout | null = null;
                      let authWindow: Window | null = null;
                      
                      const cleanup = () => {
                        if (pollInterval) clearInterval(pollInterval);
                        if (timeoutId) clearTimeout(timeoutId);
                        setIsLoading(false);
                      };
                      
                      try {
                        // Determine domain for OAuth
                        let domain = 'login';
                        
                        // Check if full URL was provided FIRST (takes priority)
                        if (newOrgForm.loginUrl && newOrgForm.loginUrl.includes('.salesforce.com')) {
                          // Extract domain from URL like https://orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com
                          const match = newOrgForm.loginUrl.match(/https?:\/\/([^/]+)/);
                          if (match) {
                            const hostname = match[1];
                            // For .develop.my.salesforce.com domains (developer editions)
                            if (hostname.includes('.develop.my.salesforce.com')) {
                              domain = hostname.replace('.my.salesforce.com', '');
                            } else if (hostname.includes('.my.salesforce.com')) {
                              domain = hostname.replace('.my.salesforce.com', '');
                            } else {
                              domain = hostname.replace('.salesforce.com', '');
                            }
                          }
                        } else if (newOrgForm.orgType === 'sandbox') {
                          domain = 'test';
                        } else {
                          // For production and developer editions without custom URL, use login
                          domain = 'login';
                        }
                        
                        const response = await fetch(`http://localhost:8000/api/salesforce/oauth/start?domain=${domain}`);
                        const data = await response.json();
                        
                        if (data.auth_url) {
                          // Try to open OAuth URL in new window
                          authWindow = window.open(data.auth_url, 'salesforce_auth', 'width=600,height=700');
                          
                          // Check if popup was blocked
                          if (!authWindow || authWindow.closed) {
                            // Popup blocked - show URL for manual copy
                            const copyUrl = await navigator.clipboard.writeText(data.auth_url).then(() => true).catch(() => false);
                            if (copyUrl) {
                              toast.success('URL copied! Paste it in your browser to login, then return here.');
                            } else {
                              // Show the URL in a prompt
                              prompt('Popup blocked! Copy this URL and open it in your browser:', data.auth_url);
                            }
                            // Don't cleanup - keep polling in case they complete login manually
                          }
                          
                          let pollCount = 0;
                          const maxPolls = 60; // 2 minutes max (2s * 60)
                          
                          // Poll for completion
                          pollInterval = setInterval(async () => {
                            pollCount++;
                            
                            // Check if window was closed by user
                            if (authWindow?.closed) {
                              cleanup();
                              toast.info('Login cancelled - window was closed');
                              return;
                            }
                            
                            // Timeout after max polls
                            if (pollCount >= maxPolls) {
                              cleanup();
                              authWindow?.close();
                              toast.error('Login timed out. Please try again.');
                              return;
                            }
                            
                            try {
                              const statusRes = await fetch(`http://localhost:8000/api/salesforce/oauth/status/${data.state}`);
                              const status = await statusRes.json();
                              
                              if (status.status === 'completed') {
                                cleanup();
                                authWindow?.close();
                                
                                // Add org with OAuth credentials
                                const newOrg = salesforceApi.addOrg({
                                  name: newOrgForm.name || 'My Salesforce Org',
                                  instanceUrl: status.instance_url,
                                  loginUrl: status.instance_url,
                                  username: 'oauth-user',
                                  orgType: newOrgForm.orgType as any,
                                  color: newOrgForm.color,
                                  accessToken: status.access_token,
                                  refreshToken: status.refresh_token,
                                  tokenExpiry: Date.now() + 7200000,
                                  apiVersion: 'v59.0',
                                });
                                
                                loadOrgs();
                                handleSelectOrg(newOrg.id);
                                setShowAddOrgDialog(false);
                                toast.success('Connected via browser login!');
                              }
                            } catch (e) {
                              // Continue polling
                            }
                          }, 2000);
                        }
                      } catch (error: any) {
                        cleanup();
                        toast.error(`OAuth failed: ${error.message}`);
                      }
                    }}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    <span className="ml-2">{isLoading ? 'Waiting...' : 'Login'}</span>
                  </Button>
                  {isLoading && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsLoading(false)}
                      className="text-red-400 border-red-500/50 hover:bg-red-500/20"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Session ID Option */}
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-green-300">Quick: Connect with Session ID</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  If username/password doesn't work, copy your session from the browser.
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Instance URL (e.g., https://orgfarm-xxx.develop.my.salesforce.com)"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500 text-xs"
                    id="session-instance-url"
                  />
                  <Input
                    placeholder="Session ID (from browser cookies)"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500 text-xs"
                    id="session-id-input"
                  />
                  <Button 
                    onClick={() => {
                      let instanceUrl = (document.getElementById('session-instance-url') as HTMLInputElement)?.value?.trim();
                      const sessionId = (document.getElementById('session-id-input') as HTMLInputElement)?.value?.trim();
                      
                      if (!instanceUrl || !sessionId) {
                        toast.error('Please enter both Instance URL and Session ID');
                        return;
                      }
                      
                      // Auto-add https:// if missing
                      if (!instanceUrl.startsWith('http://') && !instanceUrl.startsWith('https://')) {
                        instanceUrl = 'https://' + instanceUrl;
                      }
                      
                      // Ensure we're using the API domain (.my.salesforce.com), not Lightning (.lightning.force.com)
                      if (instanceUrl.includes('.lightning.force.com')) {
                        instanceUrl = instanceUrl.replace('.lightning.force.com', '.my.salesforce.com');
                        toast.info('Converted Lightning URL to API URL');
                      }
                      
                      // Remove trailing slash
                      instanceUrl = instanceUrl.replace(/\/$/, '');
                      
                      // Add org with session credentials
                      const newOrg = salesforceApi.addOrg({
                        name: newOrgForm.name || 'My Salesforce Org',
                        instanceUrl: instanceUrl,
                        loginUrl: instanceUrl,
                        username: 'session-user',
                        orgType: newOrgForm.orgType as any,
                        color: newOrgForm.color,
                        accessToken: sessionId,
                        refreshToken: '',
                        tokenExpiry: Date.now() + 7200000,
                        apiVersion: 'v59.0',
                      });
                      
                      loadOrgs();
                      handleSelectOrg(newOrg.id);
                      setShowAddOrgDialog(false);
                      toast.success('Connected with Session ID!');
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Connect with Session
                  </Button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-slate-700" />
                <span className="text-xs text-slate-500">OR use credentials</span>
                <div className="flex-1 border-t border-slate-700" />
              </div>

              {/* Manual Credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-slate-300">Org Name</Label>
                  <Input
                    value={newOrgForm.name}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                    placeholder="My Production Org"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Org Type</Label>
                  <Select value={newOrgForm.orgType} onValueChange={(v) => setNewOrgForm({ ...newOrgForm, orgType: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="scratch">Scratch Org</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Color</Label>
                  <Select value={newOrgForm.color} onValueChange={(v) => setNewOrgForm({ ...newOrgForm, color: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Login URL</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={newOrgForm.loginUrl.includes('login.salesforce.com') ? 'https://login.salesforce.com' : 
                             newOrgForm.loginUrl.includes('test.salesforce.com') ? 'https://test.salesforce.com' : 'custom'} 
                      onValueChange={(v) => {
                        if (v !== 'custom') {
                          setNewOrgForm({ ...newOrgForm, loginUrl: v });
                        }
                      }}
                    >
                      <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-gray-900 dark:text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="https://login.salesforce.com">Production</SelectItem>
                        <SelectItem value="https://test.salesforce.com">Sandbox</SelectItem>
                        <SelectItem value="custom">Custom Domain</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={newOrgForm.loginUrl}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, loginUrl: e.target.value })}
                      placeholder="https://orgfam.my.salesforce.com"
                      className="flex-1 bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    For custom domains: https://[your-domain].my.salesforce.com
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Username</Label>
                  <Input
                    value={newOrgForm.username}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, username: e.target.value })}
                    placeholder="user@example.com"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Password</Label>
                  <Input
                    type="password"
                    value={newOrgForm.password}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, password: e.target.value })}
                    placeholder="Your password"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Security Token (optional)</Label>
                  <Input
                    value={newOrgForm.securityToken}
                    onChange={(e) => setNewOrgForm({ ...newOrgForm, securityToken: e.target.value })}
                    placeholder="Security token from Salesforce"
                    className="bg-slate-800 border-slate-700 text-gray-900 dark:text-white placeholder:text-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required if IP restrictions are enabled. Get from: Setup → My Personal Information → Reset Security Token
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddOrgDialog(false)} className="text-slate-200 border-slate-600 hover:text-gray-900 dark:text-white hover:bg-slate-700">
                Cancel
              </Button>
              <Button onClick={handleAddOrg} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default SalesforceToolsPage;

