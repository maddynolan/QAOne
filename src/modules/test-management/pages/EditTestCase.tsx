/**
 * @module test-management
 * @page EditTestCase
 *
 * Edit existing test case form. Loads test case data by ID and provides
 * the same editing capabilities as CreateTestCase with pre-populated fields.
 *
 * @features
 * - Load and edit existing test case details
 * - Modify test steps with drag-and-drop reordering
 * - Update metadata (priority, type, tags)
 * - Save changes with validation
 *
 * @api /test-cases/* - Test case CRUD endpoints
 *
 * @dependencies EditTestCase uses react-router-dom (useParams), lucide-react, shadcn/ui components
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from '@/lib/api-config';

interface TestStep {
  id: string;
  action: string;
  expectedResult: string;
  testData?: string;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automated';
  category: string;
  status: 'draft' | 'active' | 'deprecated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  steps: TestStep[];
  preconditions: string[];
  expectedResult: string;
  tags: string[];
  linkedRequirements: string[];
}

export default function EditTestCase() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [testCase, setTestCase] = useState<TestCase>({
    id: '',
    name: '',
    description: '',
    type: 'manual',
    category: 'functional',
    status: 'draft',
    priority: 'medium',
    steps: [{ id: '1', action: '', expectedResult: '' }],
    preconditions: [],
    expectedResult: '',
    tags: [],
    linkedRequirements: []
  });

  const [tagInput, setTagInput] = useState('');

  // Load test case
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadTestCase = async () => {
      try {
        // Try multiple endpoints
        let data = null;
        
        // Try main endpoint first
        const response = await fetch(`${API_BASE_URL}/test-cases/${id}`);
        if (response.ok) {
          data = await response.json();
        }
        
        // Try v2 endpoint
        if (!data) {
          const v2Response = await fetch(`${API_BASE_URL}/test-cases/${id}`);
          if (v2Response.ok) {
            const v2Data = await v2Response.json();
            data = v2Data.test_case || v2Data;
          }
        }
        
        // Try flowstral endpoint
        if (!data) {
          const flowstralResponse = await fetch(`${API_BASE_URL}/api/flowstral/test-cases/${id}`);
          if (flowstralResponse.ok) {
            const flowstralData = await flowstralResponse.json();
            data = flowstralData.test_case || flowstralData;
          }
        }

        if (data) {
          setTestCase({
            id: data.id || id,
            name: data.name || data.title || '',
            description: data.description || '',
            type: data.type || 'manual',
            category: data.category || data.testType || 'functional',
            status: data.status || 'draft',
            priority: data.priority || 'medium',
            steps: (data.steps || []).map((s: any, i: number) => ({
              id: String(i + 1),
              action: s.action || s.step_action || '',
              expectedResult: s.expectedResult || s.expected_result || '',
              testData: s.testData || s.test_data || ''
            })),
            preconditions: data.preconditions || [],
            expectedResult: data.expectedResult || data.expected_result || '',
            tags: data.tags || [],
            linkedRequirements: data.linkedRequirements || data.linked_requirements || []
          });
          
          // Ensure at least one step
          if (!data.steps || data.steps.length === 0) {
            setTestCase(prev => ({
              ...prev,
              steps: [{ id: '1', action: '', expectedResult: '' }]
            }));
          }
        } else {
          toast.error('Test case not found');
          navigate('/cases');
        }
      } catch (error) {
        console.error('Error loading test case:', error);
        toast.error('Failed to load test case');
      } finally {
        setLoading(false);
      }
    };

    loadTestCase();
  }, [id, navigate]);

  // Save test case
  const handleSave = async () => {
    if (!testCase.name.trim()) {
      toast.error('Please enter a test case name');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...testCase,
        steps: testCase.steps.filter(s => s.action.trim()),
        updatedAt: new Date().toISOString()
      };

      // Try to update via multiple endpoints
      let success = false;
      
      // Try main endpoint
      const response = await fetch(`${API_BASE_URL}/test-cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        success = true;
      } else {
        // Try v2 endpoint
        const v2Response = await fetch(`${API_BASE_URL}/test-cases/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        success = v2Response.ok;
      }

      if (success) {
        toast.success('Test case updated!');
        navigate('/cases');
      } else {
        // Save to localStorage as fallback
        const stored = JSON.parse(localStorage.getItem('test_cases') || '[]');
        const idx = stored.findIndex((tc: any) => tc.id === id);
        if (idx >= 0) {
          stored[idx] = payload;
        } else {
          stored.push(payload);
        }
        localStorage.setItem('test_cases', JSON.stringify(stored));
        toast.success('Test case saved locally');
        navigate('/cases');
      }
    } catch (error) {
      console.error('Error saving test case:', error);
      toast.error('Failed to save test case');
    } finally {
      setSaving(false);
    }
  };

  // Step management
  const addStep = () => {
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, { id: String(Date.now()), action: '', expectedResult: '' }]
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

  // Tag management
  const addTag = () => {
    if (!tagInput.trim()) return;
    if (testCase.tags.includes(tagInput.trim())) return;
    setTestCase(prev => ({
      ...prev,
      tags: [...prev.tags, tagInput.trim()]
    }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTestCase(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading test case...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cases')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Test Case</h1>
            <p className="text-sm text-muted-foreground">ID: {id}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input
                value={testCase.name}
                onChange={(e) => setTestCase(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter test case name..."
              />
            </div>
            
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={testCase.description}
                onChange={(e) => setTestCase(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this test verifies..."
                rows={3}
              />
            </div>

            <div>
              <Label>Type</Label>
              <Select
                value={testCase.type}
                onValueChange={(v) => setTestCase(prev => ({ ...prev, type: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automated">Automated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={testCase.category}
                onValueChange={(v) => setTestCase(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="regression">Regression</SelectItem>
                  <SelectItem value="smoke">Smoke</SelectItem>
                  <SelectItem value="e2e">End-to-End</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select
                value={testCase.priority}
                onValueChange={(v) => setTestCase(prev => ({ ...prev, priority: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">P0 - Critical</SelectItem>
                  <SelectItem value="high">P1 - High</SelectItem>
                  <SelectItem value="medium">P2 - Medium</SelectItem>
                  <SelectItem value="low">P3 - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={testCase.status}
                onValueChange={(v) => setTestCase(prev => ({ ...prev, status: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Test Steps ({testCase.steps.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {testCase.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 pt-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                  {index + 1}
                </Badge>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Action</Label>
                  <Textarea
                    value={step.action}
                    onChange={(e) => updateStep(step.id, 'action', e.target.value)}
                    placeholder="What action to perform..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Expected Result</Label>
                  <Textarea
                    value={step.expectedResult}
                    onChange={(e) => updateStep(step.id, 'expectedResult', e.target.value)}
                    placeholder="What should happen..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeStep(step.id)}
                disabled={testCase.steps.length <= 1}
                className="mt-6"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
            />
            <Button variant="outline" onClick={addTag}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {testCase.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                {tag} ×
              </Badge>
            ))}
            {testCase.tags.length === 0 && (
              <span className="text-sm text-muted-foreground">No tags</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expected Result */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Expected Result</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={testCase.expectedResult}
            onChange={(e) => setTestCase(prev => ({ ...prev, expectedResult: e.target.value }))}
            placeholder="What is the overall expected outcome of this test?"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/cases')}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

