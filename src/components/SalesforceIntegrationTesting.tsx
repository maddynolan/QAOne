/**
 * Salesforce Integration Testing
 * 
 * Test integrations between Salesforce and external systems:
 * 1. API Functionality - Test REST/SOAP API endpoints
 * 2. Data Synchronization - Verify bidirectional data flow
 * 3. Middleware Validation - Test MuleSoft, Dell Boomi, etc.
 * 4. Real-Time Event Processing - Platform Events, CDC, Streaming
 * 5. Webhook Testing - Outbound messages, callouts
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Globe, RefreshCw, Play, CheckCircle, XCircle, AlertTriangle,
  ArrowLeftRight, Webhook, Zap, Database, Clock, Link, Code,
  Loader2, Plus, Trash2, Copy, Download, Upload, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi } from '@/lib/salesforce-api';

interface ApiTest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  headers: { [key: string]: string };
  body?: string;
  expectedStatus: number;
  expectedBody?: string;
  assertions: Array<{
    path: string;
    operator: 'equals' | 'contains' | 'exists' | 'notEmpty';
    value?: string;
  }>;
}

interface TestResult {
  testId: string;
  testName: string;
  status: 'pass' | 'fail' | 'error';
  duration: number;
  request: any;
  response: any;
  assertions: Array<{
    path: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
  error?: string;
}

interface SyncTest {
  id: string;
  name: string;
  sourceObject: string;
  targetSystem: string;
  fieldMappings: Array<{
    sourceField: string;
    targetField: string;
  }>;
  direction: 'inbound' | 'outbound' | 'bidirectional';
}

interface PlatformEvent {
  EventUuid: string;
  CreatedDate: string;
  CreatedById: string;
  EventApiName: string;
}

interface SalesforceIntegrationTestingProps {
  isConnected: boolean;
}

export function SalesforceIntegrationTesting({ isConnected }: SalesforceIntegrationTestingProps) {
  const [activeTab, setActiveTab] = useState('api');
  const [isLoading, setIsLoading] = useState(false);
  
  // API Testing State
  const [apiTests, setApiTests] = useState<ApiTest[]>([
    {
      id: '1',
      name: 'Get Account by ID',
      method: 'GET',
      endpoint: '/sobjects/Account/{accountId}',
      headers: {},
      expectedStatus: 200,
      assertions: [
        { path: 'Id', operator: 'exists' },
        { path: 'Name', operator: 'notEmpty' },
      ],
    },
    {
      id: '2',
      name: 'Query Accounts',
      method: 'GET',
      endpoint: '/query?q=SELECT+Id,Name+FROM+Account+LIMIT+5',
      headers: {},
      expectedStatus: 200,
      assertions: [
        { path: 'totalSize', operator: 'exists' },
        { path: 'records', operator: 'exists' },
      ],
    },
    {
      id: '3',
      name: 'Create Contact',
      method: 'POST',
      endpoint: '/sobjects/Contact',
      headers: { 'Content-Type': 'application/json' },
      body: '{"LastName": "Integration Test", "Email": "test@example.com"}',
      expectedStatus: 201,
      assertions: [
        { path: 'id', operator: 'exists' },
        { path: 'success', operator: 'equals', value: 'true' },
      ],
    },
  ]);
  const [apiTestResults, setApiTestResults] = useState<TestResult[]>([]);
  const [selectedTest, setSelectedTest] = useState<ApiTest | null>(null);
  
  // Sync Testing State
  const [syncTests, setSyncTests] = useState<SyncTest[]>([]);
  const [syncResults, setSyncResults] = useState<any[]>([]);
  
  // Platform Events State
  const [platformEvents, setPlatformEvents] = useState<any[]>([]);
  const [eventSubscription, setEventSubscription] = useState<string>('');
  const [receivedEvents, setReceivedEvents] = useState<PlatformEvent[]>([]);
  
  // Outbound Messages State
  const [outboundMessages, setOutboundMessages] = useState<any[]>([]);

  // ========== API TESTING ==========
  
  const runApiTest = useCallback(async (test: ApiTest) => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      let endpoint = test.endpoint;
      // Replace placeholders
      if (endpoint.includes('{accountId}')) {
        const accounts = await salesforceApi.query('SELECT Id FROM Account LIMIT 1');
        if (accounts.records.length > 0) {
          endpoint = endpoint.replace('{accountId}', accounts.records[0].Id);
        }
      }
      
      const response = await salesforceApi.request(endpoint, {
        method: test.method,
        body: test.body,
      });
      
      const duration = Date.now() - startTime;
      
      // Run assertions
      const assertionResults = test.assertions.map(assertion => {
        const actualValue = getNestedValue(response, assertion.path);
        let passed = false;
        
        switch (assertion.operator) {
          case 'equals':
            passed = String(actualValue) === assertion.value;
            break;
          case 'contains':
            passed = String(actualValue).includes(assertion.value || '');
            break;
          case 'exists':
            passed = actualValue !== undefined && actualValue !== null;
            break;
          case 'notEmpty':
            passed = actualValue !== undefined && actualValue !== null && actualValue !== '';
            break;
        }
        
        return {
          path: assertion.path,
          expected: `${assertion.operator}${assertion.value ? `: ${assertion.value}` : ''}`,
          actual: String(actualValue),
          passed,
        };
      });
      
      const allPassed = assertionResults.every(a => a.passed);
      
      const result: TestResult = {
        testId: test.id,
        testName: test.name,
        status: allPassed ? 'pass' : 'fail',
        duration,
        request: { method: test.method, endpoint, body: test.body },
        response,
        assertions: assertionResults,
      };
      
      setApiTestResults(prev => [...prev.filter(r => r.testId !== test.id), result]);
      toast.success(`Test "${test.name}": ${allPassed ? 'PASSED' : 'FAILED'}`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        testId: test.id,
        testName: test.name,
        status: 'error',
        duration,
        request: { method: test.method, endpoint: test.endpoint, body: test.body },
        response: null,
        assertions: [],
        error: error.message,
      };
      
      setApiTestResults(prev => [...prev.filter(r => r.testId !== test.id), result]);
      toast.error(`Test "${test.name}" failed: ${error.message}`);
    }
  }, [isConnected]);

  const runAllApiTests = useCallback(async () => {
    setApiTestResults([]);
    setIsLoading(true);
    
    for (const test of apiTests) {
      await runApiTest(test);
    }
    
    setIsLoading(false);
    toast.success('All API tests completed');
  }, [apiTests, runApiTest]);

  const addApiTest = useCallback(() => {
    const newTest: ApiTest = {
      id: Date.now().toString(),
      name: 'New API Test',
      method: 'GET',
      endpoint: '/sobjects/Account/describe',
      headers: {},
      expectedStatus: 200,
      assertions: [],
    };
    setApiTests(prev => [...prev, newTest]);
    setSelectedTest(newTest);
  }, []);

  const updateApiTest = useCallback((updatedTest: ApiTest) => {
    setApiTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
    setSelectedTest(updatedTest);
  }, []);

  const deleteApiTest = useCallback((testId: string) => {
    setApiTests(prev => prev.filter(t => t.id !== testId));
    if (selectedTest?.id === testId) {
      setSelectedTest(null);
    }
  }, [selectedTest]);

  // ========== PLATFORM EVENTS ==========
  
  const loadPlatformEvents = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const query = `SELECT Id, DeveloperName, MasterLabel, Description FROM PlatformEventChannelMember`;
      const result = await salesforceApi.toolingQuery(query);
      setPlatformEvents(result.records || []);
      toast.success(`Found ${result.records?.length || 0} platform events`);
    } catch (error: any) {
      // Platform events might not be queryable directly
      toast.error('Failed to load platform events');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const loadChangeDataCapture = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      // Query CDC-enabled entities
      const query = `SELECT Id, DeveloperName, MasterLabel FROM EntityDefinition WHERE IsChangeDataCaptureEnabled = true`;
      const result = await salesforceApi.toolingQuery(query);
      toast.success(`Found ${result.records?.length || 0} CDC-enabled objects`);
    } catch (error: any) {
      toast.error('Failed to load CDC entities');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // ========== OUTBOUND MESSAGES ==========
  
  const loadOutboundMessages = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const query = `SELECT Id, Name FROM WorkflowOutboundMessage`;
      const result = await salesforceApi.toolingQuery(query);
      setOutboundMessages(result.records || []);
      toast.success(`Found ${result.records?.length || 0} outbound messages`);
    } catch (error: any) {
      toast.error('Failed to load outbound messages');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // ========== HELPERS ==========
  
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'fail': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default: return <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />;
    }
  };

  const exportTestSuite = useCallback(() => {
    const suite = {
      name: 'Salesforce Integration Test Suite',
      created: new Date().toISOString(),
      tests: apiTests,
    };
    const blob = new Blob([JSON.stringify(suite, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salesforce-api-tests.json';
    a.click();
    toast.success('Test suite exported');
  }, [apiTests]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-green-400" />
            Integration Testing
          </h3>
          <p className="text-sm text-slate-400">
            Test API endpoints, data sync, and event processing
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card">
          <TabsTrigger value="api" className="gap-1.5 text-xs data-[state=active]:bg-green-600">
            <Globe className="w-3.5 h-3.5" />
            API Tests
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5 text-xs data-[state=active]:bg-green-600">
            <RefreshCw className="w-3.5 h-3.5" />
            Data Sync
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs data-[state=active]:bg-green-600">
            <Zap className="w-3.5 h-3.5" />
            Events
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5 text-xs data-[state=active]:bg-green-600">
            <Webhook className="w-3.5 h-3.5" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        {/* API Tests Tab */}
        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Test List */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm">Test Suite</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={addApiTest} className="h-7 px-2">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exportTestSuite} className="h-7 px-2">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {apiTests.map(test => {
                    const result = apiTestResults.find(r => r.testId === test.id);
                    return (
                      <div
                        key={test.id}
                        onClick={() => setSelectedTest(test)}
                        className={`p-2 rounded cursor-pointer transition-colors ${
                          selectedTest?.id === test.id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-secondary hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result && getStatusIcon(result.status)}
                            <Badge className={`text-xs ${
                              test.method === 'GET' ? 'bg-green-600' :
                              test.method === 'POST' ? 'bg-blue-600' :
                              test.method === 'PATCH' ? 'bg-yellow-600' :
                              'bg-red-600'
                            }`}>
                              {test.method}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              runApiTest(test);
                            }}
                            className="h-6 px-1.5"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-foreground mt-1">{test.name}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{test.endpoint}</p>
                        {result && (
                          <p className="text-xs text-slate-400 mt-1">{result.duration}ms</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    onClick={runAllApiTests}
                    disabled={isLoading || !isConnected}
                    className="w-full gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run All Tests
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Test Editor */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-foreground text-sm">Test Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTest ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-slate-400 text-xs">Test Name</Label>
                      <Input
                        value={selectedTest.name}
                        onChange={(e) => updateApiTest({ ...selectedTest, name: e.target.value })}
                        className="bg-input border-border text-foreground mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="w-24">
                        <Label className="text-slate-400 text-xs">Method</Label>
                        <select
                          value={selectedTest.method}
                          onChange={(e) => updateApiTest({ ...selectedTest, method: e.target.value as any })}
                          className="w-full mt-1 px-2 py-2 rounded bg-input border border-border text-foreground text-sm"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-slate-400 text-xs">Endpoint</Label>
                        <Input
                          value={selectedTest.endpoint}
                          onChange={(e) => updateApiTest({ ...selectedTest, endpoint: e.target.value })}
                          className="bg-input border-border text-foreground font-mono text-sm mt-1"
                        />
                      </div>
                    </div>
                    {(selectedTest.method === 'POST' || selectedTest.method === 'PATCH') && (
                      <div>
                        <Label className="text-slate-400 text-xs">Request Body (JSON)</Label>
                        <Textarea
                          value={selectedTest.body || ''}
                          onChange={(e) => updateApiTest({ ...selectedTest, body: e.target.value })}
                          placeholder="{}"
                          className="font-mono text-sm bg-input border-border min-h-[80px] text-foreground mt-1"
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-slate-400 text-xs">Assertions</Label>
                      <div className="space-y-2 mt-1">
                        {selectedTest.assertions.map((assertion, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              value={assertion.path}
                              onChange={(e) => {
                                const newAssertions = [...selectedTest.assertions];
                                newAssertions[idx] = { ...assertion, path: e.target.value };
                                updateApiTest({ ...selectedTest, assertions: newAssertions });
                              }}
                              placeholder="response.path"
                              className="bg-input border-border text-foreground font-mono text-xs flex-1"
                            />
                            <select
                              value={assertion.operator}
                              onChange={(e) => {
                                const newAssertions = [...selectedTest.assertions];
                                newAssertions[idx] = { ...assertion, operator: e.target.value as any };
                                updateApiTest({ ...selectedTest, assertions: newAssertions });
                              }}
                              className="px-2 py-2 rounded bg-input border border-border text-foreground text-xs"
                            >
                              <option value="exists">exists</option>
                              <option value="equals">equals</option>
                              <option value="contains">contains</option>
                              <option value="notEmpty">notEmpty</option>
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const newAssertions = selectedTest.assertions.filter((_, i) => i !== idx);
                                updateApiTest({ ...selectedTest, assertions: newAssertions });
                              }}
                              className="h-8 px-2 text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newAssertions = [...selectedTest.assertions, { path: '', operator: 'exists' as const }];
                            updateApiTest({ ...selectedTest, assertions: newAssertions });
                          }}
                          className="w-full text-slate-400 border-border"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Assertion
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteApiTest(selectedTest.id)}
                      className="w-full"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete Test
                    </Button>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-8">
                    Select a test to edit or click + to create new
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Test Results */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-foreground text-sm">Results</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTest && apiTestResults.find(r => r.testId === selectedTest.id) ? (
                  (() => {
                    const result = apiTestResults.find(r => r.testId === selectedTest.id)!;
                    return (
                      <div className="space-y-3">
                        <div className={`p-3 rounded-lg ${
                          result.status === 'pass' ? 'bg-green-500/10 border border-green-500/30' :
                          result.status === 'fail' ? 'bg-red-500/10 border border-red-500/30' :
                          'bg-orange-500/10 border border-orange-500/30'
                        }`}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="text-sm font-medium text-foreground">
                              {result.status.toUpperCase()}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {result.duration}ms
                            </span>
                          </div>
                        </div>
                        
                        {result.assertions.length > 0 && (
                          <div>
                            <Label className="text-slate-400 text-xs">Assertions</Label>
                            <div className="space-y-1 mt-1">
                              {result.assertions.map((a, idx) => (
                                <div key={idx} className={`p-2 rounded text-xs ${
                                  a.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {a.passed ? (
                                      <CheckCircle className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <XCircle className="w-3 h-3 text-red-400" />
                                    )}
                                    <span className="font-mono text-slate-300">{a.path}</span>
                                  </div>
                                  <div className="text-slate-500 ml-5">
                                    Expected: {a.expected}, Got: {a.actual}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {result.error && (
                          <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs">
                            {result.error}
                          </div>
                        )}
                        
                        {result.response && (
                          <div>
                            <Label className="text-slate-400 text-xs">Response</Label>
                            <pre className="p-2 mt-1 rounded bg-input border border-border text-xs text-slate-300 overflow-auto max-h-[200px] font-mono">
                              {JSON.stringify(result.response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-slate-500 text-sm text-center py-8">
                    Run a test to see results
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="py-3">
              <CardTitle className="text-foreground text-sm">Data Synchronization Testing</CardTitle>
              <CardDescription>Verify data flows between Salesforce and external systems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-slate-400">Test Sync Scenarios</Label>
                  <div className="space-y-2">
                    {[
                      { name: 'Create record in SF → External', icon: ArrowLeftRight },
                      { name: 'Update record in SF → External', icon: RefreshCw },
                      { name: 'Delete record in SF → External', icon: Trash2 },
                      { name: 'External → Create in SF', icon: Upload },
                      { name: 'External → Update in SF', icon: RefreshCw },
                      { name: 'Conflict resolution', icon: AlertTriangle },
                    ].map((scenario, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        className="w-full justify-start gap-2 text-slate-300 border-border"
                      >
                        <scenario.icon className="w-4 h-4" />
                        {scenario.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-slate-400">Sync Validation</Label>
                  <div className="p-4 rounded-lg bg-secondary border border-border">
                    <p className="text-sm text-slate-400 mb-3">
                      Configure external system endpoint to test bidirectional sync:
                    </p>
                    <Input
                      placeholder="https://external-system.com/api/endpoint"
                      className="bg-input border-border text-foreground mb-2"
                    />
                    <Button disabled className="w-full gap-2">
                      <Play className="w-4 h-4" />
                      Run Sync Test
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm">Platform Events</CardTitle>
                  <Button
                    size="sm"
                    onClick={loadPlatformEvents}
                    disabled={isLoading || !isConnected}
                    className="gap-1.5"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Load
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {platformEvents.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Load platform events to test</p>
                    </div>
                  ) : (
                    platformEvents.map((event, idx) => (
                      <div key={idx} className="p-2 rounded bg-secondary border border-border">
                        <span className="text-foreground text-sm">{event.MasterLabel || event.DeveloperName}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm">Change Data Capture</CardTitle>
                  <Button
                    size="sm"
                    onClick={loadChangeDataCapture}
                    disabled={isLoading || !isConnected}
                    className="gap-1.5"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Load
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-slate-500">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Check CDC-enabled objects</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground text-sm">Outbound Messages & Callouts</CardTitle>
                <Button
                  size="sm"
                  onClick={loadOutboundMessages}
                  disabled={isLoading || !isConnected}
                  className="gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Load
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {outboundMessages.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Load outbound messages to test</p>
                  </div>
                ) : (
                  outboundMessages.map((msg, idx) => (
                    <div key={idx} className="p-2 rounded bg-secondary border border-border">
                      <span className="text-foreground text-sm">{msg.Name}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}




