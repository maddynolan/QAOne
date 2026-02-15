/**
 * Salesforce User Acceptance Testing (UAT)
 * 
 * Enable business users to validate Salesforce implementations:
 * 1. Natural Language Test Cases - Write tests in plain English
 * 2. Business Process Templates - Pre-built test scenarios
 * 3. Test Data Scenarios - Realistic test data sets
 * 4. User-Friendly Execution - Simple test running interface
 * 5. Stakeholder Reporting - Clear pass/fail reports
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Users, Play, CheckCircle, XCircle, AlertTriangle, FileText,
  Wand2, MessageSquare, Clock, Download, Upload, Sparkles,
  Loader2, Plus, Trash2, Copy, Eye, ChevronRight, ThumbsUp,
  ThumbsDown, Send, Building2, ShoppingCart, Phone, Mail,
  Target, ListChecks, ClipboardList, UserCheck, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';

interface UATTestCase {
  id: string;
  title: string;
  description: string;
  steps: UATStep[];
  expectedResult: string;
  actualResult?: string;
  status: 'draft' | 'ready' | 'running' | 'pass' | 'fail' | 'blocked';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  category: string;
  executionNotes?: string;
  attachments?: string[];
}

interface UATStep {
  id: string;
  description: string;
  expectedBehavior: string;
  status: 'pending' | 'pass' | 'fail' | 'skipped';
  notes?: string;
}

interface BusinessProcessTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: string;
  steps: string[];
  objects: string[];
  estimatedTime: string;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  testData: { [key: string]: any };
  prerequisites: string[];
}

interface SalesforceUATestingProps {
  isConnected: boolean;
}

// Pre-built business process templates
const BUSINESS_TEMPLATES: BusinessProcessTemplate[] = [
  {
    id: 'lead-to-opp',
    name: 'Lead to Opportunity Conversion',
    description: 'Complete sales workflow from lead capture to opportunity creation',
    icon: Target,
    category: 'Sales',
    steps: [
      'Create a new Lead with company information',
      'Qualify the Lead by updating Status',
      'Convert Lead to Account, Contact, and Opportunity',
      'Verify Account was created with correct details',
      'Verify Contact is linked to Account',
      'Verify Opportunity has correct Stage',
    ],
    objects: ['Lead', 'Account', 'Contact', 'Opportunity'],
    estimatedTime: '10 min',
  },
  {
    id: 'opp-to-close',
    name: 'Opportunity to Closed Won',
    description: 'Full opportunity lifecycle through all stages to close',
    icon: Briefcase,
    category: 'Sales',
    steps: [
      'Create Opportunity with Account',
      'Add Products/Line Items',
      'Move through each Stage',
      'Add Tasks and Events',
      'Update to Closed Won',
      'Verify Close Date and Amount',
    ],
    objects: ['Opportunity', 'OpportunityLineItem', 'Task', 'Event'],
    estimatedTime: '15 min',
  },
  {
    id: 'case-resolution',
    name: 'Case Creation to Resolution',
    description: 'Service case workflow from creation to closure',
    icon: Phone,
    category: 'Service',
    steps: [
      'Create Case from Account/Contact',
      'Assign to Service Queue',
      'Update Case Status',
      'Add Case Comments',
      'Escalate if needed',
      'Close Case with Resolution',
    ],
    objects: ['Case', 'CaseComment', 'Account', 'Contact'],
    estimatedTime: '8 min',
  },
  {
    id: 'campaign-flow',
    name: 'Campaign Management',
    description: 'Marketing campaign creation and member management',
    icon: Mail,
    category: 'Marketing',
    steps: [
      'Create Campaign with details',
      'Set Campaign Status to Active',
      'Add Campaign Members',
      'Track Member Status changes',
      'Create Leads from Campaign',
      'Report on Campaign ROI',
    ],
    objects: ['Campaign', 'CampaignMember', 'Lead'],
    estimatedTime: '12 min',
  },
  {
    id: 'quote-order',
    name: 'Quote to Order Process',
    description: 'CPQ workflow from quote generation to order',
    icon: ShoppingCart,
    category: 'Sales',
    steps: [
      'Create Quote from Opportunity',
      'Add Quote Line Items',
      'Apply Discounts if applicable',
      'Send Quote for Approval',
      'Convert Quote to Order',
      'Verify Order details',
    ],
    objects: ['Quote', 'QuoteLineItem', 'Order', 'OrderItem'],
    estimatedTime: '15 min',
  },
  {
    id: 'account-hierarchy',
    name: 'Account Hierarchy Setup',
    description: 'Create and verify parent-child account relationships',
    icon: Building2,
    category: 'Data',
    steps: [
      'Create Parent Account',
      'Create Child Accounts',
      'Link Children to Parent',
      'Verify hierarchy in Account view',
      'Test roll-up calculations',
      'Verify sharing rules',
    ],
    objects: ['Account'],
    estimatedTime: '10 min',
  },
];

export function SalesforceUATesting({ isConnected }: SalesforceUATestingProps) {
  const [activeTab, setActiveTab] = useState('tests');
  const [isLoading, setIsLoading] = useState(false);
  
  // Test Cases State
  const [testCases, setTestCases] = useState<UATTestCase[]>([
    {
      id: '1',
      title: 'Create New Account',
      description: 'Verify that users can create a new Account with all required fields',
      steps: [
        { id: '1a', description: 'Navigate to Accounts tab', expectedBehavior: 'Accounts list view loads', status: 'pending' },
        { id: '1b', description: 'Click "New" button', expectedBehavior: 'New Account form opens', status: 'pending' },
        { id: '1c', description: 'Fill in Account Name', expectedBehavior: 'Field accepts input', status: 'pending' },
        { id: '1d', description: 'Select Industry', expectedBehavior: 'Picklist shows options', status: 'pending' },
        { id: '1e', description: 'Click Save', expectedBehavior: 'Account is created and detail page shows', status: 'pending' },
      ],
      expectedResult: 'Account record is created successfully with all entered data',
      status: 'ready',
      priority: 'high',
      category: 'Account Management',
    },
  ]);
  const [selectedTest, setSelectedTest] = useState<UATTestCase | null>(null);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  
  // Execution State
  const [executionMode, setExecutionMode] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Templates State
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessProcessTemplate | null>(null);

  // ========== TEST CASE MANAGEMENT ==========
  
  const createTestFromNaturalLanguage = useCallback(async () => {
    if (!naturalLanguageInput.trim()) {
      toast.error('Please enter a test description');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Parse natural language into test steps
      // In production, this would use AI/LLM
      const lines = naturalLanguageInput.split('\n').filter(l => l.trim());
      const title = lines[0] || 'New Test Case';
      
      const steps: UATStep[] = [];
      lines.slice(1).forEach((line, idx) => {
        if (line.trim()) {
          steps.push({
            id: `step-${idx}`,
            description: line.trim(),
            expectedBehavior: 'Verify expected behavior',
            status: 'pending',
          });
        }
      });
      
      // If only one line, create default steps
      if (steps.length === 0) {
        steps.push(
          { id: 'step-1', description: 'Navigate to the relevant page', expectedBehavior: 'Page loads correctly', status: 'pending' },
          { id: 'step-2', description: title, expectedBehavior: 'Action completes successfully', status: 'pending' },
          { id: 'step-3', description: 'Verify the result', expectedBehavior: 'Expected outcome is achieved', status: 'pending' },
        );
      }
      
      const newTest: UATTestCase = {
        id: Date.now().toString(),
        title,
        description: naturalLanguageInput,
        steps,
        expectedResult: 'Test completes successfully',
        status: 'draft',
        priority: 'medium',
        category: 'General',
      };
      
      setTestCases(prev => [...prev, newTest]);
      setSelectedTest(newTest);
      setNaturalLanguageInput('');
      toast.success('Test case created from natural language');
      
    } catch (error: any) {
      toast.error('Failed to create test case');
    } finally {
      setIsLoading(false);
    }
  }, [naturalLanguageInput]);

  const createTestFromTemplate = useCallback((template: BusinessProcessTemplate) => {
    const steps: UATStep[] = template.steps.map((step, idx) => ({
      id: `step-${idx}`,
      description: step,
      expectedBehavior: 'Step completes successfully',
      status: 'pending' as const,
    }));
    
    const newTest: UATTestCase = {
      id: Date.now().toString(),
      title: template.name,
      description: template.description,
      steps,
      expectedResult: `${template.name} workflow completes successfully`,
      status: 'ready',
      priority: 'high',
      category: template.category,
    };
    
    setTestCases(prev => [...prev, newTest]);
    setSelectedTest(newTest);
    toast.success(`Created test case from "${template.name}" template`);
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: UATStep['status'], notes?: string) => {
    if (!selectedTest) return;
    
    const updatedSteps = selectedTest.steps.map(step =>
      step.id === stepId ? { ...step, status, notes } : step
    );
    
    const updatedTest = { ...selectedTest, steps: updatedSteps };
    
    // Check if all steps are complete
    const allComplete = updatedSteps.every(s => s.status === 'pass' || s.status === 'fail' || s.status === 'skipped');
    const allPassed = updatedSteps.every(s => s.status === 'pass');
    const anyFailed = updatedSteps.some(s => s.status === 'fail');
    
    if (allComplete) {
      updatedTest.status = allPassed ? 'pass' : anyFailed ? 'fail' : 'blocked';
    }
    
    setSelectedTest(updatedTest);
    setTestCases(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
    
    // Move to next step
    const currentIdx = updatedSteps.findIndex(s => s.id === stepId);
    if (currentIdx < updatedSteps.length - 1 && status !== 'pending') {
      setCurrentStepIndex(currentIdx + 1);
    }
  }, [selectedTest]);

  const startExecution = useCallback(() => {
    if (!selectedTest) return;
    
    setExecutionMode(true);
    setCurrentStepIndex(0);
    
    // Reset all steps
    const resetSteps = selectedTest.steps.map(s => ({ ...s, status: 'pending' as const }));
    const updatedTest = { ...selectedTest, steps: resetSteps, status: 'running' as const };
    setSelectedTest(updatedTest);
    setTestCases(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
  }, [selectedTest]);

  const finishExecution = useCallback(() => {
    setExecutionMode(false);
    if (selectedTest) {
      toast.success(`Test "${selectedTest.title}" execution completed`);
    }
  }, [selectedTest]);

  const addTestCase = useCallback(() => {
    const newTest: UATTestCase = {
      id: Date.now().toString(),
      title: 'New Test Case',
      description: '',
      steps: [
        { id: 'step-1', description: 'Step 1', expectedBehavior: 'Expected result', status: 'pending' },
      ],
      expectedResult: '',
      status: 'draft',
      priority: 'medium',
      category: 'General',
    };
    setTestCases(prev => [...prev, newTest]);
    setSelectedTest(newTest);
  }, []);

  const deleteTestCase = useCallback((testId: string) => {
    setTestCases(prev => prev.filter(t => t.id !== testId));
    if (selectedTest?.id === testId) {
      setSelectedTest(null);
    }
    toast.success('Test case deleted');
  }, [selectedTest]);

  // ========== REPORTING ==========
  
  const generateReport = useCallback(() => {
    const report = testCases.map(test => ({
      title: test.title,
      status: test.status,
      steps: test.steps.length,
      passed: test.steps.filter(s => s.status === 'pass').length,
      failed: test.steps.filter(s => s.status === 'fail').length,
    }));
    
    const totalTests = report.length;
    const passedTests = report.filter(r => r.status === 'pass').length;
    const failedTests = report.filter(r => r.status === 'fail').length;
    
    const reportText = `
# UAT Test Report
Generated: ${new Date().toLocaleString()}

## Summary
- Total Tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${failedTests}
- Pass Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%

## Test Details
${report.map(r => `
### ${r.title}
- Status: ${r.status.toUpperCase()}
- Steps: ${r.passed}/${r.steps} passed
`).join('')}
    `.trim();
    
    navigator.clipboard.writeText(reportText);
    toast.success('Report copied to clipboard');
  }, [testCases]);

  const exportTestCases = useCallback(() => {
    const data = JSON.stringify(testCases, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uat-test-cases.json';
    a.click();
    toast.success('Test cases exported');
  }, [testCases]);

  // ========== HELPERS ==========
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'fail': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'blocked': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'skipped': return <AlertTriangle className="w-4 h-4 text-slate-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-600';
      case 'fail': return 'bg-red-600';
      case 'running': return 'bg-blue-600';
      case 'blocked': return 'bg-yellow-600';
      default: return 'bg-secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 border-red-400/30';
      case 'medium': return 'text-yellow-400 border-yellow-400/30';
      case 'low': return 'text-green-400 border-green-400/30';
      default: return 'text-slate-400 border-slate-400/30';
    }
  };

  const stats = useMemo(() => {
    const total = testCases.length;
    const passed = testCases.filter(t => t.status === 'pass').length;
    const failed = testCases.filter(t => t.status === 'fail').length;
    const pending = testCases.filter(t => t.status === 'draft' || t.status === 'ready').length;
    return { total, passed, failed, pending };
  }, [testCases]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            User Acceptance Testing
          </h3>
          <p className="text-sm text-slate-400">
            Business user validation with natural language test cases
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 text-xs">
            <Badge className="bg-green-600">{stats.passed} Passed</Badge>
            <Badge className="bg-red-600">{stats.failed} Failed</Badge>
            <Badge className="bg-secondary">{stats.pending} Pending</Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card">
          <TabsTrigger value="tests" className="gap-1.5 text-xs data-[state=active]:bg-purple-600">
            <ListChecks className="w-3.5 h-3.5" />
            Test Cases
          </TabsTrigger>
          <TabsTrigger value="natural" className="gap-1.5 text-xs data-[state=active]:bg-purple-600">
            <Sparkles className="w-3.5 h-3.5" />
            Natural Language
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 text-xs data-[state=active]:bg-purple-600">
            <ClipboardList className="w-3.5 h-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="execute" className="gap-1.5 text-xs data-[state=active]:bg-purple-600">
            <Play className="w-3.5 h-3.5" />
            Execute
          </TabsTrigger>
        </TabsList>

        {/* Test Cases Tab */}
        <TabsContent value="tests" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Test List */}
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm">Test Cases</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={addTestCase} className="h-7 px-2">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exportTestCases} className="h-7 px-2">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {testCases.map(test => (
                    <div
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className={`p-3 rounded cursor-pointer transition-colors ${
                        selectedTest?.id === test.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-secondary hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(test.status)}
                          <span className="font-medium text-foreground text-sm">{test.title}</span>
                        </div>
                        <Badge variant="outline" className={getPriorityColor(test.priority)}>
                          {test.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{test.category}</p>
                      <p className="text-xs text-slate-500 mt-1">{test.steps.length} steps</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Test Details */}
            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm">
                    {selectedTest?.title || 'Select a test case'}
                  </CardTitle>
                  {selectedTest && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteTestCase(selectedTest.id)}
                        className="gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveTab('execute');
                          startExecution();
                        }}
                        className="gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Execute
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedTest ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-400 text-xs">Description</Label>
                      <p className="text-sm text-slate-300 mt-1">{selectedTest.description}</p>
                    </div>
                    
                    <div>
                      <Label className="text-slate-400 text-xs">Steps</Label>
                      <div className="space-y-2 mt-2">
                        {selectedTest.steps.map((step, idx) => (
                          <div
                            key={step.id}
                            className="p-3 rounded bg-secondary border border-border"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-slate-500 mt-0.5">{idx + 1}.</span>
                              <div className="flex-1">
                                <p className="text-sm text-foreground">{step.description}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  Expected: {step.expectedBehavior}
                                </p>
                              </div>
                              {getStatusIcon(step.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-slate-400 text-xs">Expected Result</Label>
                      <p className="text-sm text-slate-300 mt-1">{selectedTest.expectedResult}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-8">
                    Select a test case to view details
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Natural Language Tab */}
        <TabsContent value="natural" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="py-3">
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Create Tests from Natural Language
              </CardTitle>
              <CardDescription>
                Describe what you want to test in plain English
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-400 text-xs">Describe your test scenario</Label>
                <Textarea
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  placeholder={`Example:
Test creating a new opportunity
Navigate to Opportunities
Click New button
Fill in the opportunity name
Select the stage
Enter the close date
Click Save
Verify the opportunity was created`}
                  className="font-mono text-sm bg-input border-border min-h-[200px] text-foreground mt-1"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={createTestFromNaturalLanguage}
                  disabled={isLoading || !naturalLanguageInput.trim()}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  Generate Test Case
                </Button>
              </div>
              
              <div className="p-4 rounded-lg bg-secondary border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">💡 Tips</h4>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• First line becomes the test title</li>
                  <li>• Each subsequent line becomes a test step</li>
                  <li>• Use action verbs: Navigate, Click, Enter, Verify</li>
                  <li>• Be specific about expected outcomes</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUSINESS_TEMPLATES.map(template => {
              const Icon = template.icon;
              return (
                <Card
                  key={template.id}
                  className="bg-card border-border hover:border-purple-500/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded bg-purple-500/20">
                          <Icon className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="text-foreground text-sm">{template.name}</CardTitle>
                          <Badge variant="outline" className="text-xs text-slate-400 border-slate-600 mt-1">
                            {template.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-400 mb-3">{template.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{template.steps.length} steps</span>
                      <span className="text-slate-500">{template.estimatedTime}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.objects.map(obj => (
                        <Badge key={obj} variant="outline" className="text-xs text-slate-400 border-border">
                          {obj}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 text-purple-400 border-purple-400/30 hover:bg-purple-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        createTestFromTemplate(template);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create Test Case
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Execute Tab */}
        <TabsContent value="execute" className="space-y-4">
          {selectedTest && executionMode ? (
            <Card className="bg-card border-border">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground text-sm flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-400" />
                    Executing: {selectedTest.title}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={finishExecution}
                    className="text-slate-300 border-slate-600"
                  >
                    Finish Execution
                  </Button>
                </div>
                <Progress 
                  value={(selectedTest.steps.filter(s => s.status !== 'pending').length / selectedTest.steps.length) * 100} 
                  className="h-2 mt-2"
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedTest.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-4 rounded-lg border ${
                        idx === currentStepIndex
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : step.status === 'pass'
                          ? 'bg-green-500/10 border-green-500/30'
                          : step.status === 'fail'
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-secondary border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className={`text-lg font-bold ${
                            idx === currentStepIndex ? 'text-blue-400' : 'text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-foreground font-medium">{step.description}</p>
                            <p className="text-sm text-slate-400 mt-1">
                              Expected: {step.expectedBehavior}
                            </p>
                          </div>
                        </div>
                        {getStatusIcon(step.status)}
                      </div>
                      
                      {idx === currentStepIndex && step.status === 'pending' && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => updateStepStatus(step.id, 'pass')}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            onClick={() => updateStepStatus(step.id, 'fail')}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            Fail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-slate-300 border-slate-600"
                            onClick={() => updateStepStatus(step.id, 'skipped')}
                          >
                            Skip
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">Ready to Execute?</p>
                  <p className="text-sm mb-4">Select a test case and start execution</p>
                  {selectedTest ? (
                    <Button onClick={startExecution} className="gap-2">
                      <Play className="w-4 h-4" />
                      Start Executing "{selectedTest.title}"
                    </Button>
                  ) : (
                    <p className="text-xs">No test case selected. Go to Test Cases tab first.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Quick Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={generateReport}
              className="gap-2 text-slate-300 border-slate-600"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}




