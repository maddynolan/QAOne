import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Loader2, Sparkles, FileText, Zap, Upload, Link2, ChevronDown, ChevronRight, GripVertical, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ==================== TEMPLATES ====================
const TEMPLATES = [
  {
    id: "login",
    name: "🔐 Login Flow",
    description: "User authentication test",
    data: {
      name: "Login - Valid Credentials",
      description: "Verify user can login with valid username and password",
      type: "automated",
      category: "functional",
      priority: "high",
      preconditions: ["User account exists in the system", "User is on the login page"],
      steps: [
        { action: "Enter valid username", expectedResult: "Username field populated" },
        { action: "Enter valid password", expectedResult: "Password field shows masked input" },
        { action: "Click Login button", expectedResult: "User redirected to dashboard" },
        { action: "Verify user is logged in", expectedResult: "User profile/name visible in header" }
      ],
      expectedResult: "User successfully authenticated and redirected to dashboard",
      tags: ["login", "auth", "smoke"]
    }
  },
  {
    id: "crud",
    name: "📝 CRUD Operation",
    description: "Create, Read, Update, Delete",
    data: {
      name: "CRUD - Create New Item",
      description: "Verify user can create a new item in the system",
      type: "manual",
      category: "functional",
      priority: "high",
      preconditions: ["User is logged in", "User has create permissions"],
      steps: [
        { action: "Navigate to item list page", expectedResult: "Item list displayed" },
        { action: "Click 'Add New' button", expectedResult: "Create form opens" },
        { action: "Fill in required fields", expectedResult: "Fields accept input" },
        { action: "Click Save", expectedResult: "Item created, success message shown" },
        { action: "Verify item in list", expectedResult: "New item visible in list" }
      ],
      expectedResult: "Item successfully created and visible in the list",
      tags: ["crud", "create", "regression"]
    }
  },
  {
    id: "api",
    name: "🌐 API Test",
    description: "REST API endpoint test",
    data: {
      name: "API - GET Endpoint",
      description: "Verify API endpoint returns correct data",
      type: "automated",
      category: "api",
      priority: "high",
      preconditions: ["API server is running", "Valid authentication token available"],
      steps: [
        { action: "Send GET request to /api/endpoint", expectedResult: "Response received" },
        { action: "Verify status code is 200", expectedResult: "Status: 200 OK" },
        { action: "Verify response body structure", expectedResult: "JSON matches schema" },
        { action: "Verify response time < 500ms", expectedResult: "Performance acceptable" }
      ],
      expectedResult: "API returns correct data with 200 status",
      tags: ["api", "integration"]
    }
  },
  {
    id: "e2e",
    name: "🔄 E2E Flow",
    description: "End-to-end user journey",
    data: {
      name: "E2E - Complete User Journey",
      description: "Test complete user flow from start to finish",
      type: "automated",
      category: "e2e",
      priority: "critical",
      preconditions: ["Application is accessible", "Test data is prepared"],
      steps: [
        { action: "User lands on home page", expectedResult: "Home page loads correctly" },
        { action: "User navigates to feature", expectedResult: "Feature page displayed" },
        { action: "User completes main action", expectedResult: "Action successful" },
        { action: "User verifies result", expectedResult: "Expected outcome visible" }
      ],
      expectedResult: "Complete user journey works as expected",
      tags: ["e2e", "critical-path", "smoke"]
    }
  },
  {
    id: "blank",
    name: "📄 Blank",
    description: "Start from scratch",
    data: {
      name: "",
      description: "",
      type: "manual",
      category: "functional",
      priority: "medium",
      preconditions: [],
      steps: [{ action: "", expectedResult: "" }],
      expectedResult: "",
      tags: []
    }
  }
];

// ==================== INTERFACES ====================
interface TestStep {
  id: string;
  action: string;
  expectedResult: string;
  testData?: string;
}

interface TestCase {
  name: string;
  description: string;
  type: 'manual' | 'automated';
  category: string;
  priority: string;
  status: string;
  preconditions: string[];
  steps: TestStep[];
  expectedResult: string;
  tags: string[];
  linkedRequirements: string[];
  source?: {
    type: 'manual' | 'flowstral' | 'import';
    recordingId?: string;
  };
}

// ==================== COMPONENT ====================
export default function CreateTestCase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const importFrom = searchParams.get('import'); // 'flowstral' or recording ID
  
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportStepsDialog, setShowImportStepsDialog] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [existingTestCases, setExistingTestCases] = useState<any[]>([]);
  const [stepsSearchQuery, setStepsSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [testCase, setTestCase] = useState<TestCase>({
    name: "",
    description: "",
    type: "manual",
    category: "functional",
    priority: "medium",
    status: "draft",
    preconditions: [],
    steps: [{ id: "1", action: "", expectedResult: "" }],
    expectedResult: "",
    tags: [],
    linkedRequirements: [],
    source: { type: 'manual' }
  });

  const [tagInput, setTagInput] = useState("");
  const [preconditionInput, setPreconditionInput] = useState("");

  // Load requirements and existing test cases
  useEffect(() => {
    fetch(`${API_BASE_URL}/requirements`)
      .then(res => res.ok ? res.json() : { requirements: [] })
      .then(data => setRequirements(data.requirements || data || []))
      .catch(() => setRequirements([]));
    
    fetch(`${API_BASE_URL}/test-cases`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setExistingTestCases(Array.isArray(data) ? data : []))
      .catch(() => setExistingTestCases([]));
  }, []);

  // Import steps from existing test case
  const importStepsFromTestCase = (tc: any) => {
    const stepsToImport = (tc.steps || []).map((s: any, idx: number) => ({
      id: String(Date.now() + idx),
      action: s.action || s.description || '',
      expectedResult: s.expectedResult || s.expected || ''
    }));
    
    if (stepsToImport.length > 0) {
      setTestCase(prev => ({
        ...prev,
        steps: [...prev.steps.filter(s => s.action.trim()), ...stepsToImport]
      }));
      toast.success(`Imported ${stepsToImport.length} steps from "${tc.name}"`);
    }
    setShowImportStepsDialog(false);
  };

  const filteredTestCases = existingTestCases.filter(tc => 
    !stepsSearchQuery || 
    tc.name?.toLowerCase().includes(stepsSearchQuery.toLowerCase()) ||
    tc.tags?.some((t: string) => t.toLowerCase().includes(stepsSearchQuery.toLowerCase()))
  );

  // Auto-import from URL param
  useEffect(() => {
    if (importFrom === 'flowstral') {
      setShowImportDialog(true);
      loadRecordings();
    } else if (importFrom) {
      importRecording(importFrom);
    }
  }, [importFrom]);

  // Load Flowstral recordings
  const loadRecordings = async () => {
    setLoadingRecordings(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        setRecordings(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setLoadingRecordings(false);
    }
  };

  // Import from Flowstral recording
  const importRecording = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${sessionId}/status`);
      if (response.ok) {
        const data = await response.json();
        const session = data.session || data;
        const actions = session.actions || session.nodes || [];
        
        setTestCase(prev => ({
          ...prev,
          name: session.name || `Test from Recording ${sessionId.substring(0, 8)}`,
          description: `Automated test imported from Flowstral recording`,
          type: 'automated',
          steps: actions.map((action: any, idx: number) => ({
            id: String(idx + 1),
            action: action.description || `${action.type}: ${action.value || action.target || ''}`,
            expectedResult: 'Step completes successfully'
          })),
          source: { type: 'flowstral', recordingId: sessionId },
          tags: ['flowstral', 'automated']
        }));
        
        setShowTemplates(false);
        setShowImportDialog(false);
        toast.success(`Imported ${actions.length} steps from recording`);
      }
    } catch (error) {
      toast.error('Failed to import recording');
    }
  };

  // Apply template
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const data = template.data;
    setTestCase({
      name: data.name,
      description: data.description,
      type: data.type as 'manual' | 'automated',
      category: data.category,
      priority: data.priority,
      status: 'draft',
      preconditions: data.preconditions,
      steps: data.steps.map((s, i) => ({ id: String(i + 1), ...s })),
      expectedResult: data.expectedResult,
      tags: data.tags,
      linkedRequirements: [],
      source: { type: 'manual' }
    });
    setShowTemplates(false);
    if (template.id !== 'blank') {
      toast.success(`Applied "${template.name}" template`);
    }
  };

  // Save test case - always saves to localStorage for traceability consistency
  const handleSave = async () => {
    if (!testCase.name.trim()) {
      toast.error('Please enter a test case name');
      return;
    }

    setSaving(true);
    try {
      const id = `tc_${Date.now()}`;
      const payload = {
        ...testCase,
        id,
        steps: testCase.steps.filter(s => s.action.trim()),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Always save to localStorage first (for traceability consistency)
      const stored = JSON.parse(localStorage.getItem('test_cases') || '[]');
      stored.push(payload);
      localStorage.setItem('test_cases', JSON.stringify(stored));

      // Also try API
      try {
        await fetch(`${API_BASE_URL}/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (apiError) {
        console.warn('API save failed, data saved locally:', apiError);
      }

      toast.success('Test case created!');
      navigate('/cases');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save test case');
    } finally {
      setSaving(false);
    }
  };

  // Step management
  const addStep = () => {
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, { id: String(Date.now()), action: "", expectedResult: "" }]
    }));
  };

  const removeStep = (stepId: string) => {
    if (testCase.steps.length <= 1) return;
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId)
    }));
  };

  const updateStep = (stepId: string, field: keyof TestStep, value: string) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s)
    }));
  };

  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStep(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault();
    if (stepId !== draggedStep) {
      setDragOverStep(stepId);
    }
  };

  const handleDragEnd = () => {
    if (draggedStep && dragOverStep && draggedStep !== dragOverStep) {
      setTestCase(prev => {
        const steps = [...prev.steps];
        const draggedIndex = steps.findIndex(s => s.id === draggedStep);
        const dropIndex = steps.findIndex(s => s.id === dragOverStep);
        
        if (draggedIndex !== -1 && dropIndex !== -1) {
          const [removed] = steps.splice(draggedIndex, 1);
          steps.splice(dropIndex, 0, removed);
        }
        return { ...prev, steps };
      });
    }
    setDraggedStep(null);
    setDragOverStep(null);
  };

  // Tag management
  const addTag = () => {
    if (!tagInput.trim() || testCase.tags.includes(tagInput.trim())) return;
    setTestCase(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
    setTagInput("");
  };

  // Precondition management
  const addPrecondition = () => {
    if (!preconditionInput.trim()) return;
    setTestCase(prev => ({ ...prev, preconditions: [...prev.preconditions, preconditionInput.trim()] }));
    setPreconditionInput("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cases')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Test Case</h1>
            <p className="text-sm text-muted-foreground">
              {testCase.source?.type === 'flowstral' ? '📹 Imported from Flowstral' : 'Define test steps and expected results'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Recording
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Quick Start Templates
            </CardTitle>
            <CardDescription>Choose a template or start blank</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1"
                  onClick={() => applyTemplate(template)}
                >
                  <span className="text-lg">{template.name.split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-4 gap-6">
        {/* Left Column - Main Info (3/4 width) */}
        <div className="col-span-3 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Test Case Name *</Label>
                <Input
                  value={testCase.name}
                  onChange={(e) => setTestCase(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Login - Valid Credentials"
                  className="text-lg"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={testCase.description}
                  onChange={(e) => setTestCase(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this test verify?"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Steps */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Test Steps ({testCase.steps.length})</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowImportStepsDialog(true)}>
                    <Copy className="h-4 w-4 mr-1" /> Import Steps
                  </Button>
                  <Button variant="outline" size="sm" onClick={addStep}>
                    <Plus className="h-4 w-4 mr-1" /> Add Step
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {testCase.steps.map((step, index) => (
                <div 
                  key={step.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, step.id)}
                  onDragOver={(e) => handleDragOver(e, step.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDragOverStep(null)}
                  className={`flex gap-4 p-4 rounded-xl border-2 transition-all cursor-move ${
                    draggedStep === step.id ? 'opacity-50 bg-primary/10 border-primary' :
                    dragOverStep === step.id ? 'bg-primary/5 border-primary border-dashed' :
                    'bg-muted/20 hover:bg-muted/40 border-muted'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="secondary" className="w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full">
                      {index + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mt-auto"
                      onClick={() => {
                        // Duplicate step
                        const newStep = { ...step, id: String(Date.now()) };
                        setTestCase(prev => ({
                          ...prev,
                          steps: [...prev.steps.slice(0, index + 1), newStep, ...prev.steps.slice(index + 1)]
                        }));
                      }}
                      title="Duplicate step"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-foreground">Action / Step Description</Label>
                      <Textarea
                        value={step.action}
                        onChange={(e) => updateStep(step.id, 'action', e.target.value)}
                        placeholder="Describe what action to perform..."
                        rows={3}
                        className="mt-1 text-sm resize-y min-h-[80px]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground">Expected Result</Label>
                      <Textarea
                        value={step.expectedResult}
                        onChange={(e) => updateStep(step.id, 'expectedResult', e.target.value)}
                        placeholder="Describe the expected outcome..."
                        rows={3}
                        className="mt-1 text-sm resize-y min-h-[80px]"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(step.id)}
                    disabled={testCase.steps.length <= 1}
                    className="self-start mt-6"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Expected Result */}
          <Card>
            <CardContent className="pt-6">
              <Label>Overall Expected Result</Label>
              <Textarea
                value={testCase.expectedResult}
                onChange={(e) => setTestCase(prev => ({ ...prev, expectedResult: e.target.value }))}
                placeholder="What is the overall expected outcome?"
                rows={2}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metadata (1/3 width) */}
        <div className="space-y-4">
          {/* Classification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={testCase.type} onValueChange={(v) => setTestCase(prev => ({ ...prev, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">📝 Manual</SelectItem>
                    <SelectItem value="automated">🤖 Automated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={testCase.category} onValueChange={(v) => setTestCase(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="regression">Regression</SelectItem>
                    <SelectItem value="smoke">Smoke</SelectItem>
                    <SelectItem value="e2e">End-to-End</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={testCase.priority} onValueChange={(v) => setTestCase(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag..."
                  className="text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button variant="outline" size="sm" onClick={addTag}>+</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {testCase.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer text-xs"
                    onClick={() => setTestCase(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Traceability */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Traceability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs">Linked Requirements</Label>
              <Select
                onValueChange={(v) => {
                  if (!testCase.linkedRequirements.includes(v)) {
                    setTestCase(prev => ({ ...prev, linkedRequirements: [...prev.linkedRequirements, v] }));
                  }
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Link requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {requirements.map((req: any) => (
                    <SelectItem key={req.id} value={req.id}>
                      {req.title || req.name || req.id}
                    </SelectItem>
                  ))}
                  {requirements.length === 0 && (
                    <SelectItem value="_none" disabled>No requirements found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                {testCase.linkedRequirements.map(reqId => (
                  <Badge 
                    key={reqId} 
                    variant="outline" 
                    className="cursor-pointer text-xs"
                    onClick={() => setTestCase(prev => ({ 
                      ...prev, 
                      linkedRequirements: prev.linkedRequirements.filter(r => r !== reqId) 
                    }))}
                  >
                    REQ-{reqId.substring(0, 6)} ×
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Advanced (Collapsible) */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Preconditions
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex gap-2">
                    <Input
                      value={preconditionInput}
                      onChange={(e) => setPreconditionInput(e.target.value)}
                      placeholder="Add precondition..."
                      className="text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && addPrecondition()}
                    />
                    <Button variant="outline" size="sm" onClick={addPrecondition}>+</Button>
                  </div>
                  <div className="space-y-1">
                    {testCase.preconditions.map((pre, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                        <span>• {pre}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setTestCase(prev => ({
                            ...prev,
                            preconditions: prev.preconditions.filter((_, i) => i !== idx)
                          }))}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Source Info */}
          {testCase.source?.type === 'flowstral' && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Zap className="h-4 w-4" />
                  <span>Imported from Flowstral</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Recording: {testCase.source.recordingId?.substring(0, 8)}...
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Import Recording Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import from Flowstral Recording
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Button variant="outline" onClick={loadRecordings} disabled={loadingRecordings} className="mb-4">
              {loadingRecordings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Refresh Recordings
            </Button>
            
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recordings found</p>
                <p className="text-sm">Record a session using the Flowstral extension first</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recordings.map(rec => (
                  <Card 
                    key={rec.session_id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => importRecording(rec.session_id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{rec.name || `Recording ${rec.session_id?.substring(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {rec.actions?.length || rec.node_count || 0} steps
                          </p>
                        </div>
                        <Button variant="outline" size="sm">Import</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Steps from Existing Test Cases Dialog */}
      <Dialog open={showImportStepsDialog} onOpenChange={setShowImportStepsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Import Steps from Existing Test Case
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={stepsSearchQuery}
                onChange={(e) => setStepsSearchQuery(e.target.value)}
                placeholder="Search test cases by name or tag..."
                className="pl-10"
              />
            </div>
            
            {filteredTestCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No test cases found</p>
                <p className="text-sm">Create test cases first or load sample data</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredTestCases.map(tc => (
                  <Card 
                    key={tc.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => importStepsFromTestCase(tc)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{tc.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {tc.steps?.length || 0} steps • {tc.type || 'manual'} • {tc.priority || 'medium'}
                          </p>
                          {tc.steps?.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                              <span className="font-medium">Step 1:</span> {tc.steps[0].action?.substring(0, 60)}...
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {tc.tags?.slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportStepsDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
