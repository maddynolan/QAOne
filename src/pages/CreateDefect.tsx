import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Bug, AlertTriangle, Link2, Upload, Paperclip, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ==================== TEMPLATES ====================
const TEMPLATES = [
  {
    id: "ui",
    name: "🎨 UI Bug",
    description: "Visual or layout issue",
    data: {
      title: "[UI] ",
      description: "",
      severity: "medium",
      priority: "medium",
      category: "ui",
      stepsToReproduce: [
        "Navigate to affected page",
        "Observe the UI element",
        "Note the visual discrepancy"
      ],
      environment: { browser: "", os: "", screenSize: "" }
    }
  },
  {
    id: "functional",
    name: "⚙️ Functional Bug",
    description: "Feature not working",
    data: {
      title: "[Functional] ",
      description: "",
      severity: "high",
      priority: "high",
      category: "functional",
      stepsToReproduce: [
        "Login as user",
        "Navigate to feature",
        "Perform action",
        "Observe unexpected behavior"
      ],
      environment: {}
    }
  },
  {
    id: "crash",
    name: "💥 Crash/Error",
    description: "App crashes or errors",
    data: {
      title: "[Crash] ",
      description: "",
      severity: "critical",
      priority: "critical",
      category: "crash",
      stepsToReproduce: [
        "Describe the action that triggers the crash",
        "Include any error messages displayed"
      ],
      environment: {}
    }
  },
  {
    id: "performance",
    name: "🐌 Performance",
    description: "Slow or unresponsive",
    data: {
      title: "[Performance] ",
      description: "",
      severity: "medium",
      priority: "medium",
      category: "performance",
      stepsToReproduce: [
        "Navigate to affected page/feature",
        "Measure response time",
        "Compare with expected performance"
      ],
      environment: {}
    }
  },
  {
    id: "blank",
    name: "📄 Blank",
    description: "Start from scratch",
    data: {
      title: "",
      description: "",
      severity: "medium",
      priority: "medium",
      category: "other",
      stepsToReproduce: [],
      environment: {}
    }
  }
];

// ==================== INTERFACES ====================
interface Defect {
  title: string;
  description: string;
  severity: string;
  priority: string;
  status: string;
  category: string;
  stepsToReproduce: string[];
  actualResult: string;
  expectedResult: string;
  environment: {
    browser?: string;
    os?: string;
    version?: string;
    url?: string;
  };
  linkedTestCases: string[];
  linkedRequirements: string[];
  assignee: string;
  reporter: string;
  tags: string[];
  attachments: string[];
}

// ==================== COMPONENT ====================
export default function CreateDefect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const testCaseId = searchParams.get('testCase'); // Pre-link to test case
  
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [defect, setDefect] = useState<Defect>({
    title: "",
    description: "",
    severity: "medium",
    priority: "medium",
    status: "open",
    category: "functional",
    stepsToReproduce: [""],
    actualResult: "",
    expectedResult: "",
    environment: {},
    linkedTestCases: testCaseId ? [testCaseId] : [],
    linkedRequirements: [],
    assignee: "",
    reporter: "",
    tags: [],
    attachments: []
  });

  const [tagInput, setTagInput] = useState("");
  const [stepInput, setStepInput] = useState("");

  // Load test cases and requirements for linking
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/test-cases`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE_URL}/requirements`).then(r => r.ok ? r.json() : { requirements: [] })
    ]).then(([cases, reqs]) => {
      setTestCases(Array.isArray(cases) ? cases : []);
      setRequirements(reqs.requirements || reqs || []);
    }).catch(() => {});
  }, []);

  // Apply template
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const data = template.data;
    setDefect(prev => ({
      ...prev,
      title: data.title,
      description: data.description,
      severity: data.severity,
      priority: data.priority,
      category: data.category,
      stepsToReproduce: data.stepsToReproduce.length > 0 ? data.stepsToReproduce : [""],
      environment: data.environment
    }));
    setShowTemplates(false);
  };

  // Save defect
  const handleSave = async () => {
    if (!defect.title.trim()) {
      toast.error('Please enter a defect title');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...defect,
        stepsToReproduce: defect.stepsToReproduce.filter(s => s.trim()),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Generate ID
      const id = `DEF-${Date.now()}`;
      const defectData = { ...payload, id };

      // Try backend first
      try {
        const response = await fetch(`${API_BASE_URL}/defects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defectData)
        });

        if (response.ok) {
          // Also save to localStorage for consistency
          const stored = JSON.parse(localStorage.getItem('defects') || '[]');
          stored.push(defectData);
          localStorage.setItem('defects', JSON.stringify(stored));
          
          toast.success('Defect reported!');
          navigate('/defects');
          return;
        }
      } catch (backendError) {
        console.log('Backend not available, saving locally');
      }

      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('defects') || '[]');
      stored.push(defectData);
      localStorage.setItem('defects', JSON.stringify(stored));
      toast.success('Defect saved!');
      navigate('/defects');
    } catch (error) {
      console.error('Error saving defect:', error);
      toast.error('Failed to save defect');
    } finally {
      setSaving(false);
    }
  };

  // Step management
  const addStep = () => {
    if (!stepInput.trim()) return;
    setDefect(prev => ({
      ...prev,
      stepsToReproduce: [...prev.stepsToReproduce, stepInput.trim()]
    }));
    setStepInput("");
  };

  const removeStep = (idx: number) => {
    setDefect(prev => ({
      ...prev,
      stepsToReproduce: prev.stepsToReproduce.filter((_, i) => i !== idx)
    }));
  };

  // Tag management
  const addTag = () => {
    if (!tagInput.trim() || defect.tags.includes(tagInput.trim())) return;
    setDefect(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
    setTagInput("");
  };

  const getSeverityColor = (sev: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[sev] || colors.medium;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/defects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bug className="h-6 w-6 text-red-500" />
              Report Defect
            </h1>
            <p className="text-sm text-muted-foreground">Document bugs for tracking and resolution</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Submit Defect
        </Button>
      </div>

      {/* Templates */}
      {showTemplates && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              What type of bug?
            </CardTitle>
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
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Main Info (2/3 width) */}
        <div className="col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Defect Title *</Label>
                <Input
                  value={defect.title}
                  onChange={(e) => setDefect(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., [UI] Login button not visible on mobile"
                  className="text-lg"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={defect.description}
                  onChange={(e) => setDefect(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of the bug..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Steps to Reproduce */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Steps to Reproduce</CardTitle>
              <CardDescription>How can someone recreate this bug?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={stepInput}
                  onChange={(e) => setStepInput(e.target.value)}
                  placeholder="Add step..."
                  onKeyPress={(e) => e.key === 'Enter' && addStep()}
                />
                <Button variant="outline" onClick={addStep}>Add</Button>
              </div>
              <div className="space-y-2">
                {defect.stepsToReproduce.filter(s => s.trim()).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                      {idx + 1}
                    </Badge>
                    <span className="flex-1 text-sm">{step}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeStep(idx)}>×</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4">
              <div>
                <Label>Actual Result</Label>
                <Textarea
                  value={defect.actualResult}
                  onChange={(e) => setDefect(prev => ({ ...prev, actualResult: e.target.value }))}
                  placeholder="What actually happened?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Expected Result</Label>
                <Textarea
                  value={defect.expectedResult}
                  onChange={(e) => setDefect(prev => ({ ...prev, expectedResult: e.target.value }))}
                  placeholder="What should have happened?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metadata (1/3 width) */}
        <div className="space-y-4">
          {/* Severity & Priority */}
          <Card className={`border-2 ${getSeverityColor(defect.severity)}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Severity & Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Severity</Label>
                <Select value={defect.severity} onValueChange={(v) => setDefect(prev => ({ ...prev, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical - System Down</SelectItem>
                    <SelectItem value="high">🟠 High - Major Feature Broken</SelectItem>
                    <SelectItem value="medium">🟡 Medium - Feature Impaired</SelectItem>
                    <SelectItem value="low">🟢 Low - Minor Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={defect.priority} onValueChange={(v) => setDefect(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">P0 - Fix Immediately</SelectItem>
                    <SelectItem value="high">P1 - Fix This Sprint</SelectItem>
                    <SelectItem value="medium">P2 - Fix Soon</SelectItem>
                    <SelectItem value="low">P3 - Fix When Possible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={defect.category} onValueChange={(v) => setDefect(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="ui">UI/Visual</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="crash">Crash/Error</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                {defect.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer text-xs"
                    onClick={() => setDefect(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
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
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Linked Test Cases</Label>
                <Select
                  onValueChange={(v) => {
                    if (!defect.linkedTestCases.includes(v)) {
                      setDefect(prev => ({ ...prev, linkedTestCases: [...prev.linkedTestCases, v] }));
                    }
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Link test case..." />
                  </SelectTrigger>
                  <SelectContent>
                    {testCases.map((tc: any) => (
                      <SelectItem key={tc.id} value={tc.id}>
                        {tc.name || tc.title || tc.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {defect.linkedTestCases.map(tcId => (
                    <Badge 
                      key={tcId} 
                      variant="outline" 
                      className="cursor-pointer text-xs"
                      onClick={() => setDefect(prev => ({ 
                        ...prev, 
                        linkedTestCases: prev.linkedTestCases.filter(t => t !== tcId) 
                      }))}
                    >
                      TC-{tcId.substring(0, 6)} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Linked Requirements</Label>
                <Select
                  onValueChange={(v) => {
                    if (!defect.linkedRequirements.includes(v)) {
                      setDefect(prev => ({ ...prev, linkedRequirements: [...prev.linkedRequirements, v] }));
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
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {defect.linkedRequirements.map(reqId => (
                    <Badge 
                      key={reqId} 
                      variant="outline" 
                      className="cursor-pointer text-xs"
                      onClick={() => setDefect(prev => ({ 
                        ...prev, 
                        linkedRequirements: prev.linkedRequirements.filter(r => r !== reqId) 
                      }))}
                    >
                      REQ-{reqId.substring(0, 6)} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Environment
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  <Input
                    value={defect.environment.browser || ""}
                    onChange={(e) => setDefect(prev => ({ 
                      ...prev, 
                      environment: { ...prev.environment, browser: e.target.value } 
                    }))}
                    placeholder="Browser (e.g., Chrome 120)"
                    className="text-sm"
                  />
                  <Input
                    value={defect.environment.os || ""}
                    onChange={(e) => setDefect(prev => ({ 
                      ...prev, 
                      environment: { ...prev.environment, os: e.target.value } 
                    }))}
                    placeholder="OS (e.g., Windows 11)"
                    className="text-sm"
                  />
                  <Input
                    value={defect.environment.url || ""}
                    onChange={(e) => setDefect(prev => ({ 
                      ...prev, 
                      environment: { ...prev.environment, url: e.target.value } 
                    }))}
                    placeholder="URL where bug occurred"
                    className="text-sm"
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
