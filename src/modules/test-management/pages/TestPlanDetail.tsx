/**
 * @module test-management
 * @page TestPlanDetail
 *
 * Test plan detail view showing plan overview, associated test suites,
 * execution progress, and management actions. Supports drill-down into
 * individual test suite and test case results.
 *
 * @features
 * - Plan overview with progress metrics
 * - Associated test suite listing
 * - Execution status tracking per suite
 * - Plan editing and management actions
 * - Test case import and assignment
 *
 * @api /test-plans/* - Test plan management endpoints
 * @api /test-cases/* - Test case endpoints for suite details
 *
 * @dependencies TestPlanDetail uses react-router-dom (useParams), useState, useEffect, lucide-react
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Play, Plus, CheckSquare, Clock, CheckCircle2, XCircle,
  AlertCircle, Search, Import, FileText, Trash2, Edit, MoreHorizontal,
  Rocket, Target, BarChart3, Calendar, User, Link2, Bug, Loader2,
  Square, CheckCheck, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';

interface TestPlan {
  id: string;
  name: string;
  description: string;
  releaseId: string;
  type: string;
  testCaseIds: string[];
  linkedRequirements: string[];
  status: string;
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  steps?: any[];
  linkedRequirements?: string[];
}

interface TestRun {
  id: string;
  testCaseId: string;
  status: string;
  startTime?: string;
  endTime?: string;
}

interface Release {
  id: string;
  name: string;
}

export default function TestPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  
  // Selection
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Dialogs
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importSelection, setImportSelection] = useState<string[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', type: '' });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    
    try {
      // Load plan from localStorage
      const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
      const foundPlan = plans.find((p: TestPlan) => p.id === id);
      
      if (!foundPlan) {
        toast.error('Test plan not found');
        navigate('/execution');
        return;
      }
      
      setPlan(foundPlan);
      setEditForm({ 
        name: foundPlan.name, 
        description: foundPlan.description || '', 
        type: foundPlan.type 
      });
      
      // Load release
      const releases = JSON.parse(localStorage.getItem('releases') || '[]');
      const foundRelease = releases.find((r: Release) => r.id === foundPlan.releaseId);
      setRelease(foundRelease || null);
      
      // Load test runs
      const runs = JSON.parse(localStorage.getItem('test_runs') || '[]');
      setTestRuns(runs);
      
      // Load all test cases
      let allCases: TestCase[] = [];
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`);
        if (response.ok) {
          const data = await response.json();
          allCases = Array.isArray(data) ? data : [];
        }
      } catch {
        // Use localStorage fallback
        allCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      }
      
      setAllTestCases(allCases);
      
      // Filter to plan's test cases
      const planCases = allCases.filter(tc => foundPlan.testCaseIds.includes(tc.id));
      setTestCases(planCases);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load test plan');
    } finally {
      setLoading(false);
    }
  };

  // Get last run status for a test case
  const getLastRunStatus = (testCaseId: string) => {
    const caseRuns = testRuns.filter(r => r.testCaseId === testCaseId);
    if (caseRuns.length === 0) return 'not_run';
    return caseRuns[caseRuns.length - 1].status;
  };

  // Filter test cases
  const filteredCases = testCases.filter(tc => {
    const matchesSearch = !searchTerm || 
      tc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    
    const lastStatus = getLastRunStatus(tc.id);
    if (filterStatus === 'not_run') return matchesSearch && lastStatus === 'not_run';
    if (filterStatus === 'passed') return matchesSearch && lastStatus === 'passed';
    if (filterStatus === 'failed') return matchesSearch && lastStatus === 'failed';
    if (filterStatus === 'blocked') return matchesSearch && lastStatus === 'blocked';
    
    return matchesSearch;
  });

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedCases.length === filteredCases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(filteredCases.map(tc => tc.id));
    }
  };

  const toggleSelectCase = (caseId: string) => {
    setSelectedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  // Execute selected
  const executeSelected = () => {
    if (selectedCases.length === 0) {
      toast.error('Please select at least one test case');
      return;
    }
    
    if (selectedCases.length === 1) {
      // Single test - go directly to executor
      navigate(`/execution/run/${selectedCases[0]}?plan=${plan?.id}&release=${plan?.releaseId}`);
    } else {
      // Multiple tests - store selection and go to execution queue
      localStorage.setItem('execution_queue', JSON.stringify({
        planId: plan?.id,
        releaseId: plan?.releaseId,
        testCaseIds: selectedCases
      }));
      navigate(`/execution/run/${selectedCases[0]}?plan=${plan?.id}&release=${plan?.releaseId}&queue=true`);
      toast.info(`Queued ${selectedCases.length} tests for execution`);
    }
  };

  // Execute single
  const executeSingle = (testCaseId: string) => {
    navigate(`/execution/run/${testCaseId}?plan=${plan?.id}&release=${plan?.releaseId}`);
  };

  // Import test cases
  const handleImport = () => {
    if (!plan || importSelection.length === 0) return;
    
    const updatedPlan = {
      ...plan,
      testCaseIds: [...new Set([...plan.testCaseIds, ...importSelection])]
    };
    
    // Update plan
    const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
    const updatedPlans = plans.map((p: TestPlan) => 
      p.id === plan.id ? updatedPlan : p
    );
    localStorage.setItem('test_plans', JSON.stringify(updatedPlans));
    
    setPlan(updatedPlan);
    setTestCases(allTestCases.filter(tc => updatedPlan.testCaseIds.includes(tc.id)));
    setShowImportDialog(false);
    setImportSelection([]);
    toast.success(`Added ${importSelection.length} test case(s) to plan`);
  };

  // Remove test case from plan
  const removeFromPlan = (testCaseId: string) => {
    if (!plan) return;
    
    const updatedPlan = {
      ...plan,
      testCaseIds: plan.testCaseIds.filter(id => id !== testCaseId)
    };
    
    const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
    const updatedPlans = plans.map((p: TestPlan) => 
      p.id === plan.id ? updatedPlan : p
    );
    localStorage.setItem('test_plans', JSON.stringify(updatedPlans));
    
    setPlan(updatedPlan);
    setTestCases(prev => prev.filter(tc => tc.id !== testCaseId));
    setSelectedCases(prev => prev.filter(id => id !== testCaseId));
    toast.success('Test case removed from plan');
  };

  // Save plan edits
  const savePlanEdits = () => {
    if (!plan) return;
    
    const updatedPlan = {
      ...plan,
      name: editForm.name,
      description: editForm.description,
      type: editForm.type
    };
    
    const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
    const updatedPlans = plans.map((p: TestPlan) => 
      p.id === plan.id ? updatedPlan : p
    );
    localStorage.setItem('test_plans', JSON.stringify(updatedPlans));
    
    setPlan(updatedPlan);
    setShowEditDialog(false);
    toast.success('Test plan updated');
  };

  // Delete plan
  const deletePlan = () => {
    if (!plan || !confirm('Delete this test plan?\n\nExecution history will be removed.\nTest cases will NOT be deleted - they remain in your library.')) return;
    
    // Remove associated test runs
    const runs = JSON.parse(localStorage.getItem('test_runs') || '[]');
    const updatedRuns = runs.filter((r: any) => r.sourceId !== plan.id && r.planId !== plan.id);
    localStorage.setItem('test_runs', JSON.stringify(updatedRuns));
    
    // Remove plan
    const plans = JSON.parse(localStorage.getItem('test_plans') || '[]');
    const updatedPlans = plans.filter((p: TestPlan) => p.id !== plan.id);
    localStorage.setItem('test_plans', JSON.stringify(updatedPlans));
    
    // Remove from release
    const releases = JSON.parse(localStorage.getItem('releases') || '[]');
    const updatedReleases = releases.map((r: Release & { testPlanIds?: string[] }) => ({
      ...r,
      testPlanIds: (r.testPlanIds || []).filter(pid => pid !== plan.id)
    }));
    localStorage.setItem('releases', JSON.stringify(updatedReleases));
    
    toast.success('Test plan deleted');
    navigate('/execution');
  };

  // Stats
  const stats = {
    total: testCases.length,
    notRun: testCases.filter(tc => getLastRunStatus(tc.id) === 'not_run').length,
    passed: testCases.filter(tc => getLastRunStatus(tc.id) === 'passed').length,
    failed: testCases.filter(tc => getLastRunStatus(tc.id) === 'failed').length,
    blocked: testCases.filter(tc => getLastRunStatus(tc.id) === 'blocked').length
  };
  
  const progressPercent = stats.total > 0 
    ? Math.round(((stats.passed + stats.failed + stats.blocked) / stats.total) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p>Test plan not found</p>
        <Button onClick={() => navigate('/execution')} className="mt-4">Back</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/execution')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{plan.name}</h1>
              <Badge variant="outline">{plan.type}</Badge>
              <Badge variant={plan.status === 'completed' ? 'default' : 'secondary'}>
                {plan.status}
              </Badge>
            </div>
            {release && (
              <p className="text-muted-foreground mt-1">
                <Rocket className="h-4 w-4 inline mr-1" />
                {release.name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Plan
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={deletePlan} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Tests</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-gray-600">{stats.notRun}</p>
            <p className="text-sm text-gray-600">Not Run</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.passed}</p>
            <p className="text-sm text-green-600">Passed</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-sm text-red-600">Failed</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{stats.blocked}</p>
            <p className="text-sm text-amber-600">Blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Execution Progress</span>
            <span className="text-sm text-muted-foreground">{progressPercent}% executed</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search test cases..."
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_run">Not Run</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Import Test Cases
          </Button>
          <Button variant="outline" onClick={() => navigate('/cases/create')}>
            <FileText className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>
      </div>

      {/* Selection Bar */}
      {selectedCases.length > 0 && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="font-medium">
              {selectedCases.length} test case{selectedCases.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedCases([])}>
                Clear Selection
              </Button>
              <Button size="sm" onClick={executeSelected}>
                <Play className="h-4 w-4 mr-2" />
                Execute Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Cases Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Test Cases ({filteredCases.length})</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedCases.length === filteredCases.length && filteredCases.length > 0 ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Select All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No test cases in this plan</h3>
              <p className="text-muted-foreground mb-4">
                Import existing test cases or create new ones
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Import Test Cases
                </Button>
                <Button onClick={() => navigate('/cases/create')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCases.map(tc => {
                const lastStatus = getLastRunStatus(tc.id);
                const isSelected = selectedCases.includes(tc.id);
                
                return (
                  <div 
                    key={tc.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                      isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleSelectCase(tc.id)}
                  >
                    <Checkbox 
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleSelectCase(tc.id)}
                    />
                    
                    <div className={`p-2 rounded-lg shrink-0 ${
                      lastStatus === 'passed' ? 'bg-green-100' :
                      lastStatus === 'failed' ? 'bg-red-100' :
                      lastStatus === 'blocked' ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      {lastStatus === 'passed' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                       lastStatus === 'failed' ? <XCircle className="h-5 w-5 text-red-600" /> :
                       lastStatus === 'blocked' ? <AlertCircle className="h-5 w-5 text-amber-600" /> :
                       <Clock className="h-5 w-5 text-gray-400" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{tc.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{tc.type || 'manual'}</Badge>
                        <Badge variant="outline" className="text-xs">{tc.priority || 'medium'}</Badge>
                        {tc.steps && tc.steps.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {tc.steps.length} steps
                          </Badge>
                        )}
                        {tc.linkedRequirements && tc.linkedRequirements.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {tc.linkedRequirements.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => executeSingle(tc.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Execute
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/cases/edit/${tc.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Test Case
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => removeFromPlan(tc.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Plan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Test Cases Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Import Test Cases
            </DialogTitle>
            <DialogDescription>
              Select test cases to add to this plan
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-muted-foreground">
                {importSelection.length} selected
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setImportSelection(
                    allTestCases.filter(tc => !plan.testCaseIds.includes(tc.id)).map(tc => tc.id)
                  )}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setImportSelection([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {allTestCases.filter(tc => !plan.testCaseIds.includes(tc.id)).map(tc => (
                <div 
                  key={tc.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    importSelection.includes(tc.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setImportSelection(prev => 
                      prev.includes(tc.id) ? prev.filter(id => id !== tc.id) : [...prev, tc.id]
                    );
                  }}
                >
                  <Checkbox checked={importSelection.includes(tc.id)} />
                  <div className="flex-1">
                    <p className="font-medium">{tc.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{tc.type || 'manual'}</Badge>
                      <Badge variant="outline" className="text-xs">{tc.priority || 'medium'}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {allTestCases.filter(tc => !plan.testCaseIds.includes(tc.id)).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>All test cases are already in this plan</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importSelection.length === 0}>
              Import {importSelection.length > 0 ? `(${importSelection.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Test Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plan Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smoke">🔥 Smoke</SelectItem>
                  <SelectItem value="regression">🔄 Regression</SelectItem>
                  <SelectItem value="functional">⚙️ Functional</SelectItem>
                  <SelectItem value="integration">🔗 Integration</SelectItem>
                  <SelectItem value="e2e">🎯 E2E</SelectItem>
                  <SelectItem value="custom">📝 Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={savePlanEdits}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

