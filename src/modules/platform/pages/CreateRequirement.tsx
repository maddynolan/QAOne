/**
 * @module platform
 * @page CreateRequirement
 *
 * Create new requirement form. Captures requirement details including title,
 * description, type, priority, acceptance criteria, and linked test cases.
 *
 * @features
 * - Requirement detail form (title, description, type, priority)
 * - Acceptance criteria editor
 * - Test case linking for traceability
 * - Requirement categorization and tagging
 *
 * @api /api/requirements/* - Requirements management endpoints
 *
 * @dependencies CreateRequirement uses react-router-dom, lucide-react, shadcn/ui form components
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, FileText, Target, Link2, ChevronDown, ChevronRight, Plus, Trash2, CheckCircle2 } from "lucide-react";
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
    id: "user-story",
    name: "👤 User Story",
    description: "Agile user story format",
    data: {
      title: "",
      type: "user-story",
      priority: "medium",
      description: "As a [user role],\nI want to [action/feature],\nSo that [benefit/value].",
      acceptanceCriteria: [
        "Given [precondition], when [action], then [expected result]"
      ]
    }
  },
  {
    id: "functional",
    name: "⚙️ Functional",
    description: "System functionality",
    data: {
      title: "FR-",
      type: "functional",
      priority: "high",
      description: "The system shall [capability/behavior].",
      acceptanceCriteria: [
        "System displays [expected output]",
        "System validates [input criteria]",
        "System stores [data correctly]"
      ]
    }
  },
  {
    id: "non-functional",
    name: "📊 Non-Functional",
    description: "Performance, security, etc.",
    data: {
      title: "NFR-",
      type: "non-functional",
      priority: "high",
      description: "The system shall meet the following quality attribute:",
      acceptanceCriteria: [
        "Response time < [X] seconds",
        "Availability >= [X]%",
        "Support [X] concurrent users"
      ]
    }
  },
  {
    id: "business",
    name: "💼 Business Rule",
    description: "Business logic requirement",
    data: {
      title: "BR-",
      type: "business",
      priority: "high",
      description: "The following business rule must be enforced:",
      acceptanceCriteria: [
        "Rule is applied when [condition]",
        "Exception handling for [edge case]"
      ]
    }
  },
  {
    id: "blank",
    name: "📄 Blank",
    description: "Start from scratch",
    data: {
      title: "",
      type: "functional",
      priority: "medium",
      description: "",
      acceptanceCriteria: []
    }
  }
];

// ==================== INTERFACES ====================
interface AcceptanceCriterion {
  id: string;
  description: string;
  verified: boolean;
}

interface Requirement {
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  acceptanceCriteria: AcceptanceCriterion[];
  source: string;
  owner: string;
  linkedTestCases: string[];
  dependencies: string[];
  tags: string[];
  notes: string;
}

// ==================== COMPONENT ====================
export default function CreateRequirement() {
  const navigate = useNavigate();
  
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [existingRequirements, setExistingRequirements] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [requirement, setRequirement] = useState<Requirement>({
    title: "",
    description: "",
    type: "functional",
    priority: "medium",
    status: "draft",
    acceptanceCriteria: [],
    source: "",
    owner: "",
    linkedTestCases: [],
    dependencies: [],
    tags: [],
    notes: ""
  });

  const [tagInput, setTagInput] = useState("");
  const [acInput, setAcInput] = useState("");

  // Load test cases and existing requirements
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/test-cases`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE_URL}/requirements`).then(r => r.ok ? r.json() : { requirements: [] })
    ]).then(([cases, reqs]) => {
      setTestCases(Array.isArray(cases) ? cases : []);
      setExistingRequirements(reqs.requirements || reqs || []);
    }).catch(() => {});
  }, []);

  // Apply template
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    const data = template.data;
    setRequirement(prev => ({
      ...prev,
      title: data.title,
      type: data.type,
      priority: data.priority,
      description: data.description,
      acceptanceCriteria: data.acceptanceCriteria.map((ac, i) => ({
        id: String(i + 1),
        description: ac,
        verified: false
      }))
    }));
    setShowTemplates(false);
  };

  // Save requirement - always saves to localStorage for traceability consistency
  const handleSave = async () => {
    if (!requirement.title.trim()) {
      toast.error('Please enter a requirement title');
      return;
    }

    setSaving(true);
    try {
      const id = `req_${Date.now()}`;
      const payload = {
        ...requirement,
        id,
        source: requirement.source || 'manual', // Set source for traceability
        source_ref: id, // Reference ID
        acceptanceCriteria: requirement.acceptanceCriteria.filter(ac => ac.description.trim()),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Always save to localStorage first (for traceability consistency)
      const stored = JSON.parse(localStorage.getItem('requirements') || '[]');
      stored.push(payload);
      localStorage.setItem('requirements', JSON.stringify(stored));

      // Also try API
      try {
        await fetch(`${API_BASE_URL}/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (apiError) {
        console.warn('API save failed, data saved locally:', apiError);
      }

      toast.success('Requirement created!');
      navigate('/requirements');
    } catch (error) {
      toast.error('Failed to save requirement');
    } finally {
      setSaving(false);
    }
  };

  // Acceptance Criteria management
  const addAC = () => {
    if (!acInput.trim()) return;
    setRequirement(prev => ({
      ...prev,
      acceptanceCriteria: [
        ...prev.acceptanceCriteria,
        { id: String(Date.now()), description: acInput.trim(), verified: false }
      ]
    }));
    setAcInput("");
  };

  const removeAC = (id: string) => {
    setRequirement(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter(ac => ac.id !== id)
    }));
  };

  const toggleACVerified = (id: string) => {
    setRequirement(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map(ac =>
        ac.id === id ? { ...ac, verified: !ac.verified } : ac
      )
    }));
  };

  // Tag management
  const addTag = () => {
    if (!tagInput.trim() || requirement.tags.includes(tagInput.trim())) return;
    setRequirement(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
    setTagInput("");
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'user-story': 'bg-blue-100 text-blue-800 border-blue-300',
      'functional': 'bg-green-100 text-green-800 border-green-300',
      'non-functional': 'bg-purple-100 text-purple-800 border-purple-300',
      'business': 'bg-amber-100 text-amber-800 border-amber-300'
    };
    return colors[type] || colors.functional;
  };

    return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/requirements')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-500" />
              Create Requirement
            </h1>
            <p className="text-sm text-muted-foreground">Define what the system should do</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Requirement
        </Button>
      </div>

      {/* Templates */}
      {showTemplates && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Requirement Type
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
          <Card className={`border-2 ${getTypeColor(requirement.type)}`}>
            <CardContent className="pt-6 space-y-4">
        <div>
                <Label>Requirement Title *</Label>
              <Input
                  value={requirement.title}
                  onChange={(e) => setRequirement(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., User Authentication - Login"
                  className="text-lg"
              />
            </div>
              <div>
                <Label>Description</Label>
              <Textarea
                  value={requirement.description}
                  onChange={(e) => setRequirement(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={
                    requirement.type === 'user-story' 
                      ? "As a [user], I want to [action], so that [benefit]..."
                      : "The system shall..."
                  }
                  rows={4}
                  className="font-mono text-sm"
              />
            </div>
            </CardContent>
          </Card>

          {/* Acceptance Criteria */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Acceptance Criteria
                  </CardTitle>
                  <CardDescription>How will we know this requirement is met?</CardDescription>
                </div>
                <Badge variant="outline">
                  {requirement.acceptanceCriteria.filter(ac => ac.verified).length}/{requirement.acceptanceCriteria.length} verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={acInput}
                  onChange={(e) => setAcInput(e.target.value)}
                  placeholder="Given... When... Then... (or plain text)"
                  onKeyPress={(e) => e.key === 'Enter' && addAC()}
                />
                <Button variant="outline" onClick={addAC}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
            </div>
              <div className="space-y-2">
                {requirement.acceptanceCriteria.map((ac, idx) => (
                  <div 
                    key={ac.id} 
                    className={`flex items-start gap-3 p-3 rounded border ${
                      ac.verified ? 'bg-green-50 border-green-200' : 'bg-muted/30'
                    }`}
                  >
                    <button
                      onClick={() => toggleACVerified(ac.id)}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        ac.verified 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {ac.verified && <CheckCircle2 className="h-3 w-3" />}
                    </button>
                    <div className="flex-1">
                      <Badge variant="outline" className="text-xs mb-1">AC-{idx + 1}</Badge>
                      <p className={`text-sm ${ac.verified ? 'line-through text-muted-foreground' : ''}`}>
                        {ac.description}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAC(ac.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {requirement.acceptanceCriteria.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No acceptance criteria defined. Add criteria to verify this requirement.
                  </p>
                )}
              </div>
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
                <Select value={requirement.type} onValueChange={(v) => setRequirement(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user-story">👤 User Story</SelectItem>
                    <SelectItem value="functional">⚙️ Functional</SelectItem>
                    <SelectItem value="non-functional">📊 Non-Functional</SelectItem>
                    <SelectItem value="business">💼 Business Rule</SelectItem>
                    <SelectItem value="technical">🔧 Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={requirement.priority} onValueChange={(v) => setRequirement(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">🔴 Critical - Must Have</SelectItem>
                    <SelectItem value="high">🟠 High - Should Have</SelectItem>
                    <SelectItem value="medium">🟡 Medium - Could Have</SelectItem>
                    <SelectItem value="low">🟢 Low - Won't Have (this time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={requirement.status} onValueChange={(v) => setRequirement(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">📝 Draft</SelectItem>
                    <SelectItem value="review">👀 In Review</SelectItem>
                    <SelectItem value="approved">✅ Approved</SelectItem>
                    <SelectItem value="implemented">🚀 Implemented</SelectItem>
                    <SelectItem value="verified">✔️ Verified</SelectItem>
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
                {requirement.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer text-xs"
                    onClick={() => setRequirement(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
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
                    if (!requirement.linkedTestCases.includes(v)) {
                      setRequirement(prev => ({ ...prev, linkedTestCases: [...prev.linkedTestCases, v] }));
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
                  {requirement.linkedTestCases.map(tcId => (
                    <Badge 
                      key={tcId} 
                      variant="outline" 
                      className="cursor-pointer text-xs"
                      onClick={() => setRequirement(prev => ({ 
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
                <Label className="text-xs">Dependencies</Label>
                <Select
                  onValueChange={(v) => {
                    if (!requirement.dependencies.includes(v)) {
                      setRequirement(prev => ({ ...prev, dependencies: [...prev.dependencies, v] }));
                    }
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Depends on..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingRequirements.map((req: any) => (
                      <SelectItem key={req.id} value={req.id}>
                        {req.title || req.name || req.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {requirement.dependencies.map(depId => (
                    <Badge 
                      key={depId} 
                variant="outline"
                      className="cursor-pointer text-xs bg-amber-50"
                      onClick={() => setRequirement(prev => ({ 
                        ...prev, 
                        dependencies: prev.dependencies.filter(d => d !== depId) 
                      }))}
                    >
                      REQ-{depId.substring(0, 6)} ×
                    </Badge>
                  ))}
                </div>
            </div>
          </CardContent>
        </Card>

          {/* Source & Notes */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Additional Info
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <div>
                    <Label className="text-xs">Source</Label>
                    <Input
                      value={requirement.source}
                      onChange={(e) => setRequirement(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="e.g., Stakeholder meeting, JIRA-123"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Owner</Label>
                    <Input
                      value={requirement.owner}
                      onChange={(e) => setRequirement(prev => ({ ...prev, owner: e.target.value }))}
                      placeholder="Who owns this requirement?"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      value={requirement.notes}
                      onChange={(e) => setRequirement(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
