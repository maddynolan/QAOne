/**
 * Salesforce Test Orchestrator
 * 
 * Unified testing hub that integrates all Salesforce testing capabilities:
 * 1. Auto-discovery of testable items (validation rules, flows, objects)
 * 2. One-click test suite generation
 * 3. Smart test recommendations
 * 4. Context-aware test recording
 * 5. Integrated data generation
 * 6. Comprehensive reporting
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Wand2, Play, Search, Database, Shield, Zap, GitBranch, Users,
  FileText, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  ChevronRight, ChevronDown, Download, Copy, Eye, Target, Layers,
  ArrowRight, Sparkles, ListChecks, Clock, BarChart, Settings,
  PlusCircle, Workflow, TestTube, Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';
import { testDataFactory } from '@/modules/salesforce/lib/salesforce-test-data-factory';

interface DiscoveredItem {
  type: 'validation' | 'flow' | 'apex' | 'trigger' | 'object' | 'field';
  id: string;
  name: string;
  object?: string;
  description?: string;
  active?: boolean;
  testable: boolean;
}

interface GeneratedTest {
  id: string;
  name: string;
  type: 'positive' | 'negative' | 'boundary' | 'integration' | 'e2e';
  category: string;
  sourceItem: string;
  steps: string[];
  testData?: any;
  assertions: string[];
  status: 'draft' | 'ready' | 'pass' | 'fail';
}

interface TestSuite {
  id: string;
  name: string;
  object: string;
  tests: GeneratedTest[];
  coverage: {
    validationRules: number;
    flows: number;
    fields: number;
    crud: boolean;
  };
  createdAt: string;
}

interface SalesforceTestOrchestratorProps {
  isConnected: boolean;
  onRunTest?: (test: GeneratedTest) => void;
  onRecordTest?: (test: GeneratedTest) => void;
}

export function SalesforceTestOrchestrator({ 
  isConnected, 
  onRunTest,
  onRecordTest 
}: SalesforceTestOrchestratorProps) {
  // Discovery State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredItem[]>([]);
  
  // Generation State
  const [selectedObject, setSelectedObject] = useState('Account');
  const [objects, setObjects] = useState<string[]>([
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event', 'Campaign'
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuite, setGeneratedSuite] = useState<TestSuite | null>(null);
  
  // Options
  const [options, setOptions] = useState({
    includeValidationTests: true,
    includeFlowTests: true,
    includeCrudTests: true,
    includeFieldTests: true,
    includeSecurityTests: true,
    includeApiTests: true,
    includeNegativeTests: true,
    includeBoundaryTests: true,
    generateTestData: true,
  });

  // ========== DISCOVERY ==========
  
  const scanOrg = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    setIsScanning(true);
    setScanProgress(0);
    setDiscoveredItems([]);
    
    try {
      setScanProgress(20);
      toast.info('Scanning org metadata via backend...');
      
      // Call the new backend orchestrator scan endpoint
      const scanResult = await salesforceApi.orchestratorScan();
      
      setScanProgress(80);
      
      // Convert backend results to DiscoveredItem format
      const items: DiscoveredItem[] = [];
      
      // Validation Rules
      for (const rule of scanResult.validation_rules || []) {
        items.push({
          type: 'validation',
          id: rule.id,
          name: rule.name,
          object: rule.object,
          description: rule.description || rule.errorMessage,
          active: rule.active,
          testable: true,
        });
      }
      
      // Flows
      for (const flow of scanResult.flows || []) {
        items.push({
          type: 'flow',
          id: flow.id,
          name: flow.name,
          description: flow.description,
          active: true,
          testable: true,
        });
      }
      
      // Triggers
      for (const trigger of scanResult.triggers || []) {
        items.push({
          type: 'trigger',
          id: trigger.id,
          name: trigger.name,
          object: trigger.object,
          active: trigger.valid,
          testable: true,
        });
      }
      
      // Apex Test Classes
      for (const cls of scanResult.apex_classes || []) {
        items.push({
          type: 'apex',
          id: cls.id,
          name: cls.name,
          active: cls.valid,
          testable: true,
        });
      }
      
      // Custom Objects
      for (const obj of scanResult.custom_objects || []) {
        items.push({
          type: 'object',
          id: obj.id,
          name: obj.name,
          description: obj.label,
          testable: true,
        });
      }
      
      setScanProgress(100);
      setDiscoveredItems(items);
      
      toast.success(
        `Discovery complete! Found ${scanResult.summary.total_items} testable items: ` +
        `${scanResult.summary.by_type.validation_rules || 0} validation rules, ` +
        `${scanResult.summary.by_type.flows || 0} flows, ` +
        `${scanResult.summary.by_type.triggers || 0} triggers, ` +
        `${scanResult.summary.by_type.apex_classes || 0} apex classes`
      );
      
    } catch (error: any) {
      console.error('Scan error:', error);
      toast.error('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  }, [isConnected]);

  // ========== TEST GENERATION ==========
  
  const generateTestSuite = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      toast.info(`Generating test suite for ${selectedObject}...`);
      
      // Determine which test types to include
      const testTypes: string[] = [];
      if (options.includeCrudTests) testTypes.push('crud');
      if (options.includeValidationTests) testTypes.push('validation');
      if (options.includeApiTests) testTypes.push('api');
      
      // Call backend to generate tests
      const result = await salesforceApi.orchestratorGenerateTests({
        object_name: selectedObject,
        test_types: testTypes,
        include_negative_tests: options.includeNegativeTests,
        include_boundary_tests: options.includeBoundaryTests,
      });
      
      // Convert backend tests to our format
      const tests: GeneratedTest[] = result.tests.map((test: any) => ({
        id: test.id,
        name: test.name,
        type: test.type as GeneratedTest['type'],
        category: test.category,
        sourceItem: test.validationRule || test.object || selectedObject,
        steps: test.steps || [],
        assertions: [test.expectedResult || 'Test passes'],
        status: 'ready' as const,
        testData: test.testData,
      }));
      
      // Also add local validation/flow tests from discovered items
      if (options.includeValidationTests) {
        const validationItems = discoveredItems.filter(
          item => item.type === 'validation' && item.object === selectedObject
        );
        
        for (const rule of validationItems) {
          // Check if we already have tests for this rule
          const hasTest = tests.some(t => t.sourceItem === rule.name);
          if (!hasTest) {
            tests.push({
              id: `val-pos-${rule.id}`,
              name: `${rule.name} - Valid Data`,
              type: 'positive',
              category: 'Validation Rules',
              sourceItem: rule.name,
              steps: [
                `Create ${selectedObject} with valid data`,
                'Ensure all validation criteria are met',
                'Save the record',
              ],
              assertions: [
                'Record saves successfully',
                'No validation errors',
              ],
              status: 'ready',
            });
            
            if (options.includeNegativeTests) {
              tests.push({
                id: `val-neg-${rule.id}`,
                name: `${rule.name} - Invalid Data`,
                type: 'negative',
                category: 'Validation Rules',
                sourceItem: rule.name,
                steps: [
                  `Create ${selectedObject} with invalid data`,
                  `Violate: ${rule.description || rule.name}`,
                  'Attempt to save',
                ],
                assertions: [
                  'Validation error is displayed',
                  'Record is NOT saved',
                ],
                status: 'ready',
              });
            }
          }
        }
      }
      
      // Add flow tests from discovered items
      if (options.includeFlowTests) {
        const flowItems = discoveredItems.filter(item => item.type === 'flow');
        for (const flow of flowItems.slice(0, 5)) {
          tests.push({
            id: `flow-${flow.id}`,
            name: `Flow: ${flow.name}`,
            type: 'e2e',
            category: 'Flows & Automation',
            sourceItem: flow.name,
            steps: [
              'Trigger the flow conditions',
              'Verify flow executes',
              'Check flow actions completed',
            ],
            assertions: [
              'Flow is triggered',
              'Expected actions are performed',
              'Data is updated correctly',
            ],
            status: 'ready',
          });
        }
      }
      
      // Generate test data if requested
      if (options.generateTestData) {
        try {
          const testDataRecords = testDataFactory.generateRecords({
            objectName: selectedObject,
            count: 3,
            industry: 'generic',
          });
          
          tests.forEach(test => {
            if (test.category === 'CRUD' || test.category === 'Validation Rules') {
              test.testData = testDataRecords[0]?.data;
            }
          });
        } catch (e) {
          console.warn('Could not generate test data:', e);
        }
      }
      
      // Create test suite
      const suite: TestSuite = {
        id: Date.now().toString(),
        name: `${selectedObject} Test Suite`,
        object: selectedObject,
        tests,
        coverage: {
          validationRules: tests.filter(t => t.category === 'Validation Rules').length / 2,
          flows: tests.filter(t => t.category === 'Flows & Automation').length,
          fields: tests.filter(t => t.category === 'Field Validation' || t.category === 'Boundary Tests').length,
          crud: options.includeCrudTests,
        },
        createdAt: new Date().toISOString(),
      };
      
      setGeneratedSuite(suite);
      toast.success(`Generated ${tests.length} test cases for ${selectedObject}!`);
      
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Generation failed: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedObject, options, discoveredItems, isConnected]);

  // ========== TEST EXECUTION ==========
  
  const [isRunningCrud, setIsRunningCrud] = useState(false);
  const [crudResults, setCrudResults] = useState<any>(null);
  
  const runCrudTest = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    setIsRunningCrud(true);
    setCrudResults(null);
    
    try {
      toast.info(`Running CRUD test on ${selectedObject}...`);
      const result = await salesforceApi.runCrudTest(selectedObject);
      setCrudResults(result);
      
      if (result.success) {
        toast.success(`CRUD test passed for ${selectedObject}!`);
      } else {
        toast.error(`CRUD test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error('CRUD test failed: ' + error.message);
      setCrudResults({ success: false, error: error.message, steps: [] });
    } finally {
      setIsRunningCrud(false);
    }
  }, [selectedObject, isConnected]);

  const runApiTest = useCallback(async (method: string, endpoint: string) => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }
    
    try {
      toast.info(`Running API test: ${method} ${endpoint}...`);
      const result = await salesforceApi.executeIntegrationTest({
        method,
        endpoint,
        assertions: [
          { path: 'Id', condition: 'exists' },
        ],
      });
      
      if (result.success) {
        toast.success(`API test passed!`);
      } else {
        toast.error(`API test failed: ${result.error || 'Assertion failed'}`);
      }
      
      return result;
    } catch (error: any) {
      toast.error('API test failed: ' + error.message);
      return null;
    }
  }, [isConnected]);

  // ========== EXPORT ==========
  
  const exportSuite = useCallback(() => {
    if (!generatedSuite) return;
    
    const exportData = {
      ...generatedSuite,
      exportedAt: new Date().toISOString(),
      format: 'qa-ai-test-suite',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedObject}-test-suite.json`;
    a.click();
    
    toast.success('Test suite exported!');
  }, [generatedSuite, selectedObject]);

  const copyAsMarkdown = useCallback(() => {
    if (!generatedSuite) return;
    
    const markdown = `# ${generatedSuite.name}

Generated: ${new Date(generatedSuite.createdAt).toLocaleString()}

## Coverage
- CRUD Operations: ${generatedSuite.coverage.crud ? '✅' : '❌'}
- Validation Rules: ${generatedSuite.coverage.validationRules} tests
- Flows: ${generatedSuite.coverage.flows} tests
- Field Validation: ${generatedSuite.coverage.fields} tests

## Test Cases

${generatedSuite.tests.map((test, idx) => `
### ${idx + 1}. ${test.name}
**Type:** ${test.type} | **Category:** ${test.category}

**Steps:**
${test.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Assertions:**
${test.assertions.map(a => `- ${a}`).join('\n')}
`).join('\n---\n')}
`;
    
    navigator.clipboard.writeText(markdown);
    toast.success('Copied as Markdown!');
  }, [generatedSuite]);

  // ========== STATS ==========
  
  const stats = useMemo(() => {
    if (!discoveredItems.length) return null;
    
    return {
      validationRules: discoveredItems.filter(i => i.type === 'validation').length,
      flows: discoveredItems.filter(i => i.type === 'flow').length,
      apexClasses: discoveredItems.filter(i => i.type === 'apex').length,
      triggers: discoveredItems.filter(i => i.type === 'trigger').length,
      total: discoveredItems.length,
    };
  }, [discoveredItems]);

  const testStats = useMemo(() => {
    if (!generatedSuite) return null;
    
    const byCategory: { [key: string]: number } = {};
    const byType: { [key: string]: number } = {};
    
    generatedSuite.tests.forEach(test => {
      byCategory[test.category] = (byCategory[test.category] || 0) + 1;
      byType[test.type] = (byType[test.type] || 0) + 1;
    });
    
    return { byCategory, byType, total: generatedSuite.tests.length };
  }, [generatedSuite]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-6 h-6 text-purple-400" />
            Test Orchestrator
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-discover, generate, and manage comprehensive Salesforce tests
          </p>
        </div>
      </div>

      {/* Step 1: Discovery */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Step 1: Discover Testable Items
          </CardTitle>
          <CardDescription>
            Scan your org for validation rules, flows, triggers, and Apex classes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={scanOrg}
              disabled={isScanning || !isConnected}
              className="gap-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isScanning ? 'Scanning...' : 'Scan Org'}
            </Button>
            
            {isScanning && (
              <div className="flex-1">
                <Progress value={scanProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{scanProgress}% complete</p>
              </div>
            )}
            
            {stats && (
              <div className="flex gap-3">
                <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                  <Shield className="w-3 h-3 mr-1" />
                  {stats.validationRules} Rules
                </Badge>
                <Badge variant="outline" className="text-green-400 border-green-400/30">
                  <Zap className="w-3 h-3 mr-1" />
                  {stats.flows} Flows
                </Badge>
                <Badge variant="outline" className="text-purple-400 border-purple-400/30">
                  <FileText className="w-3 h-3 mr-1" />
                  {stats.apexClasses} Apex
                </Badge>
                <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                  <GitBranch className="w-3 h-3 mr-1" />
                  {stats.triggers} Triggers
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Configure & Generate */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            Step 2: Generate Test Suite
          </CardTitle>
          <CardDescription>
            Configure options and auto-generate comprehensive test cases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Object Selection */}
          <div className="flex items-center gap-4">
            <Label className="text-muted-foreground">Target Object:</Label>
            <select
              value={selectedObject}
              onChange={(e) => setSelectedObject(e.target.value)}
              className="px-3 py-2 rounded-md bg-input border border-border text-foreground"
            >
              {objects.map(obj => (
                <option key={obj} value={obj}>{obj}</option>
              ))}
            </select>
            
            <Button
              onClick={generateTestSuite}
              disabled={isGenerating || !isConnected}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Test Suite
            </Button>
          </div>
          
          {/* Options */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-secondary border border-border">
            <div className="space-y-2">
              <Label className="text-foreground text-sm font-medium">Test Types</Label>
              {[
                { key: 'includeCrudTests', label: 'CRUD Tests' },
                { key: 'includeValidationTests', label: 'Validation Rules' },
                { key: 'includeFlowTests', label: 'Flow Tests' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">{opt.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground text-sm font-medium">Coverage</Label>
              {[
                { key: 'includeFieldTests', label: 'Field Validation' },
                { key: 'includeSecurityTests', label: 'Security Tests' },
                { key: 'includeApiTests', label: 'API Tests' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">{opt.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-foreground text-sm font-medium">Advanced</Label>
              {[
                { key: 'includeNegativeTests', label: 'Negative Tests' },
                { key: 'includeBoundaryTests', label: 'Boundary Tests' },
                { key: 'generateTestData', label: 'Generate Test Data' },
              ].map(opt => (
                <div key={opt.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={options[opt.key as keyof typeof options]}
                    onCheckedChange={(checked) => 
                      setOptions(prev => ({ ...prev, [opt.key]: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Generated Tests */}
      {generatedSuite && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-green-400" />
                Step 3: Review & Execute ({generatedSuite.tests.length} Tests)
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyAsMarkdown} className="gap-1.5 text-foreground border-border">
                  <Copy className="w-3.5 h-3.5" />
                  Copy MD
                </Button>
                <Button size="sm" variant="outline" onClick={exportSuite} className="gap-1.5 text-foreground border-border">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats */}
            {testStats && (
              <div className="grid grid-cols-5 gap-3 mb-4">
                {Object.entries(testStats.byCategory).map(([cat, count]) => (
                  <div key={cat} className="p-3 rounded-lg bg-secondary border border-border text-center">
                    <div className="text-lg font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground">{cat}</div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Test List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {generatedSuite.tests.map((test, idx) => (
                <div
                  key={test.id}
                  className="p-3 rounded-lg bg-secondary border border-border hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                        <span className="font-medium text-foreground">{test.name}</span>
                        <Badge className={
                          test.type === 'positive' ? 'bg-green-600' :
                          test.type === 'negative' ? 'bg-red-600' :
                          test.type === 'boundary' ? 'bg-yellow-600' :
                          test.type === 'integration' ? 'bg-blue-600' :
                          'bg-purple-600'
                        }>
                          {test.type}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border">
                          {test.category}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="text-muted-foreground">Steps:</span> {test.steps.length} |{' '}
                        <span className="text-muted-foreground">Assertions:</span> {test.assertions.length}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordTest?.(test)}
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                        title="Record this test"
                      >
                        <TestTube className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRunTest?.(test)}
                        className="h-7 px-2 text-muted-foreground hover:text-green-400"
                        title="Run this test"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRUD Test Results */}
      {crudResults && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              {crudResults.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              CRUD Test Results - {selectedObject}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {crudResults.steps?.map((step: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    step.success
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {step.success ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium text-foreground">{step.action}</span>
                    {step.recordId && (
                      <Badge variant="outline" className="text-xs">
                        ID: {step.recordId}
                      </Badge>
                    )}
                  </div>
                  {step.error && (
                    <p className="text-sm text-red-400 mt-1">{step.error}</p>
                  )}
                  {step.data && (
                    <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                      {JSON.stringify(step.data, null, 2).slice(0, 200)}...
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4">
        <Button
          variant="outline"
          onClick={runCrudTest}
          disabled={isRunningCrud || !isConnected}
          className="h-16 flex-col gap-1 text-foreground border-border hover:border-green-500/50 hover:bg-green-500/10"
        >
          {isRunningCrud ? (
            <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
          ) : (
            <Target className="w-5 h-5 text-green-400" />
          )}
          <span className="text-xs">Run CRUD Test</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => runApiTest('GET', `/sobjects/${selectedObject}/describe`)}
          disabled={!isConnected}
          className="h-16 flex-col gap-1 text-foreground border-border hover:border-blue-500/50 hover:bg-blue-500/10"
        >
          <TestTube className="w-5 h-5 text-blue-400" />
          <span className="text-xs">Test API</span>
        </Button>
        <Button
          variant="outline"
          onClick={exportSuite}
          disabled={!generatedSuite}
          className="h-16 flex-col gap-1 text-foreground border-border hover:border-purple-500/50 hover:bg-purple-500/10"
        >
          <Download className="w-5 h-5 text-purple-400" />
          <span className="text-xs">Export Suite</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDiscoveredItems([]);
            setGeneratedSuite(null);
            setCrudResults(null);
            toast.info('Cleared all results');
          }}
          className="h-16 flex-col gap-1 text-foreground border-border hover:border-primary/50 hover:bg-primary/10"
        >
          <RefreshCw className="w-5 h-5 text-primary" />
          <span className="text-xs">Reset</span>
        </Button>
      </div>
    </div>
  );
}




