import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Play, Pause, CheckCircle2, XCircle, AlertCircle, Clock,
  Layers, CheckSquare, Calendar, Target, Bug, FileText, ChevronRight,
  ChevronDown, MoreHorizontal, Edit, Trash2, Copy, Filter, Download,
  RefreshCw, Loader2, ArrowRight, Link2, PlayCircle, Square, SkipForward,
  FolderOpen, Tag, Flag, User, Timer, BarChart3, Zap, Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== TYPES ====================
interface Release {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  testPlanIds: string[];
}

interface TestPlan {
  id: string;
  name: string;
  description: string;
  releaseId: string;
  type: 'smoke' | 'regression' | 'functional' | 'integration' | 'e2e' | 'custom';
  testCaseIds: string[];
  linkedRequirements: string[];
  status: 'draft' | 'ready' | 'in_progress' | 'completed';
  assignee?: string;
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  steps?: any[];
  tags?: string[];
  linkedRequirements?: string[];
}

interface TestRun {
  id: string;
  name: string;
  source: 'manual' | 'plan' | 'suite' | 'single';
  sourceId?: string;
  testCaseId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  executedBy?: string;
  notes?: string;
  defectIds?: string[];
  releaseId?: string;
}

interface Defect {
  id: string;
  title: string;
  severity: string;
  status: string;
  linkedTestRuns?: string[];
  deferredToRelease?: string;
}

// ==================== COMPONENT ====================
export default function TestExecution() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'releases';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [releases, setReleases] = useState<Release[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateRelease, setShowCreateRelease] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TestPlan | null>(null);
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  
  // Form State
  const [newRelease, setNewRelease] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [newPlan, setNewPlan] = useState({ name: '', description: '', type: 'functional' as TestPlan['type'], releaseId: '' });

  // Load data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [casesRes, reqsRes, defectsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/test-cases`).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/requirements`).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/defects`).catch(() => ({ ok: false }))
      ]);

      if (casesRes.ok) {
        const data = await (casesRes as Response).json();
        setTestCases(Array.isArray(data) ? data : []);
      }
      if (reqsRes.ok) {
        const data = await (reqsRes as Response).json();
        setRequirements(data.requirements || []);
      }
      if (defectsRes.ok) {
        const data = await (defectsRes as Response).json();
        setDefects(data.defects || []);
      }

      // Load from localStorage
      setReleases(JSON.parse(localStorage.getItem('releases') || '[]'));
      setTestPlans(JSON.parse(localStorage.getItem('test_plans') || '[]'));
      setTestRuns(JSON.parse(localStorage.getItem('test_runs') || '[]'));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save helpers
  const saveReleases = (data: Release[]) => {
    setReleases(data);
    localStorage.setItem('releases', JSON.stringify(data));
  };

  const saveTestPlans = (data: TestPlan[]) => {
    setTestPlans(data);
    localStorage.setItem('test_plans', JSON.stringify(data));
  };

  const saveTestRuns = (data: TestRun[]) => {
    setTestRuns(data);
    localStorage.setItem('test_runs', JSON.stringify(data));
  };

  // Create Release
  const createRelease = () => {
    if (!newRelease.name.trim()) {
      toast.error('Please enter a release name');
      return;
    }
    const release: Release = {
      id: `rel_${Date.now()}`,
      ...newRelease,
      status: 'planning',
      testPlanIds: []
    };
    saveReleases([...releases, release]);
    setNewRelease({ name: '', description: '', startDate: '', endDate: '' });
    setShowCreateRelease(false);
    toast.success('Release created!');
  };

  // Create Test Plan
  const createTestPlan = () => {
    if (!newPlan.name.trim() || !newPlan.releaseId) {
      toast.error('Please enter plan name and select release');
      return;
    }
    const plan: TestPlan = {
      id: `plan_${Date.now()}`,
      ...newPlan,
      testCaseIds: selectedTestCases,
      linkedRequirements: [],
      status: 'draft'
    };
    saveTestPlans([...testPlans, plan]);
    
    // Update release
    const updatedReleases = releases.map(r => 
      r.id === newPlan.releaseId 
        ? { ...r, testPlanIds: [...r.testPlanIds, plan.id] }
        : r
    );
    saveReleases(updatedReleases);
    
    setNewPlan({ name: '', description: '', type: 'functional', releaseId: '' });
    setSelectedTestCases([]);
    setShowCreatePlan(false);
    toast.success('Test plan created!');
  };

  // Run Tests - Navigate to step-by-step executor
  const runSingleTest = (testCase: TestCase, releaseId?: string, planId?: string) => {
    const params = new URLSearchParams();
    if (releaseId) params.set('release', releaseId);
    if (planId) params.set('plan', planId);
    const queryString = params.toString();
    navigate(`/execution/run/${testCase.id}${queryString ? `?${queryString}` : ''}`);
  };

  // Edit test plan - add/remove test cases
  const [showEditPlanDialog, setShowEditPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [editPlanTestCases, setEditPlanTestCases] = useState<string[]>([]);

  const openEditPlan = (plan: TestPlan) => {
    setEditingPlan(plan);
    setEditPlanTestCases([...plan.testCaseIds]);
    setShowEditPlanDialog(true);
  };

  const saveEditPlan = () => {
    if (!editingPlan) return;
    
    const updatedPlans = testPlans.map(p => 
      p.id === editingPlan.id 
        ? { ...p, testCaseIds: editPlanTestCases }
        : p
    );
    saveTestPlans(updatedPlans);
    setShowEditPlanDialog(false);
    setEditingPlan(null);
    toast.success('Test plan updated');
  };

  const runTestPlan = (plan: TestPlan) => {
    const planTestCases = testCases.filter(tc => plan.testCaseIds.includes(tc.id));
    const newRuns: TestRun[] = planTestCases.map(tc => ({
      id: `run_${Date.now()}_${tc.id}`,
      name: `${plan.name}: ${tc.name}`,
      source: 'plan',
      sourceId: plan.id,
      testCaseId: tc.id,
      status: 'pending' as const,
      releaseId: plan.releaseId
    }));
    saveTestRuns([...testRuns, ...newRuns]);
    toast.success(`Started ${newRuns.length} test runs for "${plan.name}"`);
    
    // Update plan status
    const updatedPlans = testPlans.map(p => 
      p.id === plan.id ? { ...p, status: 'in_progress' as const } : p
    );
    saveTestPlans(updatedPlans);
  };

  const markTestResult = (runId: string, result: TestRun['status']) => {
    const updatedRuns = testRuns.map(r => 
      r.id === runId 
        ? { ...r, status: result, endTime: new Date().toISOString() }
        : r
    );
    saveTestRuns(updatedRuns);
    toast.success(`Marked as ${result}`);
  };

  // Stats
  const getRunStats = (runs: TestRun[]) => {
    const passed = runs.filter(r => r.status === 'passed').length;
    const failed = runs.filter(r => r.status === 'failed').length;
    const blocked = runs.filter(r => r.status === 'blocked').length;
    const pending = runs.filter(r => r.status === 'pending').length;
    const total = runs.length;
    return { passed, failed, blocked, pending, total, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 };
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Clear all execution data
  const clearAllData = () => {
    if (!confirm('Clear ALL execution data?\n\nThis will delete:\n- All releases\n- All test plans\n- All test run history\n\nTest cases will NOT be deleted.')) return;
    
    localStorage.removeItem('releases');
    localStorage.removeItem('test_plans');
    localStorage.removeItem('test_runs');
    localStorage.removeItem('execution_queue');
    
    setReleases([]);
    setTestPlans([]);
    setTestRuns([]);
    
    toast.success('All execution data cleared');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Test Execution</h1>
          <p className="text-muted-foreground mt-1">
            Manage releases, test plans, and execute tests
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={clearAllData} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Execution Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setShowCreateRelease(true)}>
            <Rocket className="h-4 w-4 mr-2" />
            New Release
          </Button>
          <Button onClick={() => setShowCreatePlan(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Test Plan
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="releases">
            <Rocket className="h-4 w-4 mr-2" />
            Releases
          </TabsTrigger>
          <TabsTrigger value="plans">
            <FileText className="h-4 w-4 mr-2" />
            Test Plans
          </TabsTrigger>
          <TabsTrigger value="execute">
            <Play className="h-4 w-4 mr-2" />
            Execute
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="h-4 w-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* RELEASES TAB */}
        <TabsContent value="releases" className="mt-6 space-y-4">
          {releases.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No releases yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a release (test cycle) to organize your testing by version
                </p>
                <Button onClick={() => setShowCreateRelease(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Release
                </Button>
              </CardContent>
            </Card>
          ) : (
            releases.map(release => {
              const releasePlans = testPlans.filter(p => p.releaseId === release.id);
              const releaseRuns = testRuns.filter(r => r.releaseId === release.id);
              const stats = getRunStats(releaseRuns);
              
              return (
                <Card key={release.id} className="overflow-hidden">
                  <div className={`h-1 ${
                    release.status === 'active' ? 'bg-green-500' :
                    release.status === 'completed' ? 'bg-blue-500' :
                    release.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{release.name}</h3>
                          <Badge variant={release.status === 'active' ? 'default' : 'secondary'}>
                            {release.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{release.description || 'No description'}</p>
                        
                        {/* Release Stats */}
                        <div className="grid grid-cols-5 gap-4 mb-4">
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <p className="text-2xl font-bold">{releasePlans.length}</p>
                            <p className="text-xs text-muted-foreground">Test Plans</p>
                          </div>
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Test Runs</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
                            <p className="text-xs text-green-600">Passed</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                            <p className="text-xs text-red-600">Failed</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{stats.passRate}%</p>
                            <p className="text-xs text-blue-600">Pass Rate</p>
                          </div>
                        </div>
                        
                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Execution Progress</span>
                            <span>{stats.total - stats.pending}/{stats.total} completed</span>
                          </div>
                          <Progress value={stats.total > 0 ? ((stats.total - stats.pending) / stats.total) * 100 : 0} />
                        </div>
                        
                        {/* Test Plans in Release */}
                        {releasePlans.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Test Plans:</p>
                            <div className="flex flex-wrap gap-2">
                              {releasePlans.map(plan => (
                                <Badge 
                                  key={plan.id} 
                                  variant="outline" 
                                  className="py-1 cursor-pointer hover:bg-primary/10 transition-colors"
                                  onClick={() => navigate(`/execution/plan/${plan.id}`)}
                                >
                                  {plan.name} ({plan.testCaseIds.length} tests)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setSelectedRelease(release);
                            setNewPlan(prev => ({ ...prev, releaseId: release.id }));
                            setShowCreatePlan(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Plan
                        </Button>
                        <Select
                          value={release.status}
                          onValueChange={(v) => {
                            const updated = releases.map(r => 
                              r.id === release.id ? { ...r, status: v as Release['status'] } : r
                            );
                            saveReleases(updated);
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete "${release.name}"?\n\nThis will remove the release, its ${releasePlans.length} test plan(s), and execution history.\nTest cases will NOT be deleted - they remain in your library.`)) {
                              // Get plan IDs for this release
                              const planIds = releasePlans.map(p => p.id);
                              
                              // Delete associated test runs
                              const updatedRuns = testRuns.filter(r => 
                                r.releaseId !== release.id && !planIds.includes(r.sourceId || '')
                              );
                              saveTestRuns(updatedRuns);
                              
                              // Delete associated plans (linkage only)
                              const updatedPlans = testPlans.filter(p => p.releaseId !== release.id);
                              saveTestPlans(updatedPlans);
                              
                              // Delete release
                              const updatedReleases = releases.filter(r => r.id !== release.id);
                              saveReleases(updatedReleases);
                              
                              toast.success('Release deleted. Test cases preserved in library.');
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* TEST PLANS TAB */}
        <TabsContent value="plans" className="mt-6 space-y-4">
          {testPlans.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No test plans yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create a test plan to organize test cases for a release
                </p>
                <Button onClick={() => setShowCreatePlan(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test Plan
                </Button>
              </CardContent>
            </Card>
          ) : (
            testPlans.map(plan => {
              const planRelease = releases.find(r => r.id === plan.releaseId);
              const planRuns = testRuns.filter(r => r.sourceId === plan.id);
              const stats = getRunStats(planRuns);
              
              return (
                <Card 
                  key={plan.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/execution/plan/${plan.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{plan.name}</h3>
                          <Badge variant="outline">{plan.type}</Badge>
                          <Badge variant={
                            plan.status === 'completed' ? 'default' :
                            plan.status === 'in_progress' ? 'secondary' : 'outline'
                          }>
                            {plan.status}
                          </Badge>
                        </div>
                        {planRelease && (
                          <p className="text-sm text-muted-foreground mb-2">
                            Release: <span className="font-medium">{planRelease.name}</span>
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mb-4">{plan.description || 'No description'}</p>
                        
                        <div className="flex items-center gap-6 text-sm">
                          <span><CheckSquare className="h-4 w-4 inline mr-1" />{plan.testCaseIds.length} test cases</span>
                          {stats.total > 0 && (
                            <>
                              <span className="text-green-600">{stats.passed} passed</span>
                              <span className="text-red-600">{stats.failed} failed</span>
                              <span className="text-amber-600">{stats.pending} pending</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="default" 
                          onClick={() => {
                            if (plan.testCaseIds.length === 0) {
                              toast.error('No test cases in this plan');
                              return;
                            }
                            // Quick execute first test
                            navigate(`/execution/run/${plan.testCaseIds[0]}?plan=${plan.id}&release=${plan.releaseId}&queue=true`);
                          }}
                          disabled={plan.testCaseIds.length === 0}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Execution
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditPlan(plan)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Quick Edit Test Cases
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('Delete this test plan?\n\nExecution history will be removed.\nTest cases will NOT be deleted - they remain in your library.')) {
                                  // Delete associated test runs
                                  const updatedRuns = testRuns.filter(r => r.sourceId !== plan.id);
                                  saveTestRuns(updatedRuns);
                                  
                                  // Delete plan (linkage only)
                                  const updatedPlans = testPlans.filter(p => p.id !== plan.id);
                                  saveTestPlans(updatedPlans);
                                  
                                  // Remove plan from release
                                  const updatedReleases = releases.map(r => ({
                                    ...r,
                                    testPlanIds: (r.testPlanIds || []).filter(pid => pid !== plan.id)
                                  }));
                                  saveReleases(updatedReleases);
                                  
                                  toast.success('Test plan deleted. Test cases preserved.');
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* EXECUTE TAB */}
        <TabsContent value="execute" className="mt-6">
          {testPlans.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No test plans available</h3>
                <p className="text-muted-foreground mb-4">
                  Create a release and test plan first, then add test cases to execute
                </p>
                <Button onClick={() => setShowCreateRelease(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Release
                </Button>
              </CardContent>
            </Card>
          ) : !selectedPlan ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a test plan to execute</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a test plan from the dropdown to see its test cases
                </p>
                <Select
                  value=""
                  onValueChange={(v) => setSelectedPlan(testPlans.find(p => p.id === v) || null)}
                >
                  <SelectTrigger className="w-64 mx-auto">
                    <SelectValue placeholder="Select a test plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {testPlans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.testCaseIds.length} tests)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Test Case List */}
            <div className="col-span-2 space-y-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search test cases..."
                    className="pl-10"
                  />
                </div>
                <Select
                  value={selectedPlan.id}
                  onValueChange={(v) => setSelectedPlan(testPlans.find(p => p.id === v) || null)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {testPlans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Test cases from selected plan only */}
              {(() => {
                const planTestCases = testCases.filter(tc => selectedPlan.testCaseIds.includes(tc.id));
                
                if (planTestCases.length === 0) {
                  return (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <CheckSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground mb-3">No test cases in this plan</p>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/execution/plan/${selectedPlan.id}`)}>
                          Add Test Cases to Plan
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {planTestCases.filter(tc => 
                      !searchTerm || tc.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map(tc => {
                  const tcRuns = testRuns.filter(r => r.testCaseId === tc.id);
                  const lastRun = tcRuns[tcRuns.length - 1];
                  const isRunning = runningTestId && tcRuns.some(r => r.id === runningTestId);
                  
                  return (
                    <Card key={tc.id} className={`transition-all ${isRunning ? 'border-blue-500 bg-blue-50/50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              lastRun?.status === 'passed' ? 'bg-green-100' :
                              lastRun?.status === 'failed' ? 'bg-red-100' :
                              lastRun?.status === 'blocked' ? 'bg-amber-100' : 'bg-gray-100'
                            }`}>
                              {lastRun?.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                               lastRun?.status === 'failed' ? <XCircle className="h-4 w-4 text-red-600" /> :
                               lastRun?.status === 'blocked' ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
                               <Clock className="h-4 w-4 text-gray-400" />}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{tc.name}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{tc.type}</Badge>
                                <Badge variant="outline" className="text-xs">{tc.priority}</Badge>
                                {tc.linkedRequirements?.length > 0 && (
                                  <Badge variant="outline" className="text-xs bg-blue-50">
                                    <Link2 className="h-3 w-3 mr-1" />
                                    {tc.linkedRequirements.length} req
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isRunning ? (
                              <Button variant="outline" size="sm" disabled>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Running...
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => runSingleTest(tc, selectedPlan?.releaseId, selectedPlan?.id)}
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
                                    <DropdownMenuItem onClick={() => markTestResult(lastRun?.id || '', 'passed')}>
                                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                      Mark Passed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markTestResult(lastRun?.id || '', 'failed')}>
                                      <XCircle className="h-4 w-4 mr-2 text-red-600" />
                                      Mark Failed
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markTestResult(lastRun?.id || '', 'blocked')}>
                                      <AlertCircle className="h-4 w-4 mr-2 text-amber-600" />
                                      Mark Blocked
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markTestResult(lastRun?.id || '', 'skipped')}>
                                      <SkipForward className="h-4 w-4 mr-2" />
                                      Skip
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate(`/defects/create?testCase=${tc.id}`)}>
                                      <Bug className="h-4 w-4 mr-2 text-red-600" />
                                      Log Defect
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
                );
              })()}
            </div>

            {/* Execution Summary - for selected plan only */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Plan Summary</CardTitle>
                  <p className="text-sm text-muted-foreground">{selectedPlan.name}</p>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Only show runs for the selected plan
                    const planRuns = testRuns.filter(r => r.sourceId === selectedPlan.id || r.planId === selectedPlan.id);
                    const stats = getRunStats(planRuns);
                    return (
                      <div className="space-y-4">
                        <div className="text-center">
                          <p className="text-4xl font-bold">{stats.passRate}%</p>
                          <p className="text-sm text-muted-foreground">Pass Rate</p>
                        </div>
                        <Progress value={stats.passRate} className="h-3" />
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 bg-green-50 rounded">
                            <p className="text-lg font-bold text-green-600">{stats.passed}</p>
                            <p className="text-xs text-green-600">Passed</p>
                          </div>
                          <div className="p-2 bg-red-50 rounded">
                            <p className="text-lg font-bold text-red-600">{stats.failed}</p>
                            <p className="text-xs text-red-600">Failed</p>
                          </div>
                          <div className="p-2 bg-amber-50 rounded">
                            <p className="text-lg font-bold text-amber-600">{stats.blocked}</p>
                            <p className="text-xs text-amber-600">Blocked</p>
                          </div>
                          <div className="p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-gray-600">{stats.pending}</p>
                            <p className="text-xs text-gray-600">Pending</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/cases/create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Test Case
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/defects/create')}>
                    <Bug className="h-4 w-4 mr-2" />
                    Log Defect
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/traceability')}>
                    <Target className="h-4 w-4 mr-2" />
                    View Traceability
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </TabsContent>

        {/* RESULTS TAB */}
        <TabsContent value="results" className="mt-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {(() => {
              const stats = getRunStats(testRuns);
              return (
                <>
                  <Card className="bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                      <p className="text-sm text-muted-foreground">Total Runs</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-50 to-white">
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-green-600">{stats.passed}</p>
                      <p className="text-sm text-muted-foreground">Passed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-50 to-white">
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-purple-50 to-white">
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold text-purple-600">{stats.passRate}%</p>
                      <p className="text-sm text-muted-foreground">Pass Rate</p>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>

          {/* Recent Runs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testRuns.slice(-10).reverse().map(run => {
                  const tc = testCases.find(t => t.id === run.testCaseId);
                  return (
                    <div key={run.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${
                          run.status === 'passed' ? 'bg-green-100' :
                          run.status === 'failed' ? 'bg-red-100' :
                          run.status === 'blocked' ? 'bg-amber-100' : 'bg-gray-100'
                        }`}>
                          {run.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                           run.status === 'failed' ? <XCircle className="h-4 w-4 text-red-600" /> :
                           run.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                           <Clock className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-medium">{tc?.name || run.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {run.startTime ? new Date(run.startTime).toLocaleString() : 'Pending'}
                            {run.duration && ` • ${run.duration}s`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        run.status === 'passed' ? 'default' :
                        run.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {run.status}
                      </Badge>
                    </div>
                  );
                })}
                {testRuns.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No test runs yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Release Dialog */}
      <Dialog open={showCreateRelease} onOpenChange={setShowCreateRelease}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Create Release / Test Cycle
            </DialogTitle>
            <DialogDescription>
              A release represents a version or sprint that contains test plans
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Release Name *</Label>
              <Input
                value={newRelease.name}
                onChange={(e) => setNewRelease(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., December 2024 Release, Sprint 24, v2.1.0"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newRelease.description}
                onChange={(e) => setNewRelease(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Release goals and scope..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newRelease.startDate}
                  onChange={(e) => setNewRelease(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newRelease.endDate}
                  onChange={(e) => setNewRelease(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRelease(false)}>Cancel</Button>
            <Button onClick={createRelease}>Create Release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Test Plan Dialog */}
      <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Create Test Plan
            </DialogTitle>
            <DialogDescription>
              Group test cases for a specific testing objective (smoke, regression, feature, etc.)
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="details">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="testcases">Test Cases ({selectedTestCases.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Smoke Tests, Login Regression, Feature X Tests"
                />
              </div>
              <div>
                <Label>Release *</Label>
                <Select
                  value={newPlan.releaseId}
                  onValueChange={(v) => setNewPlan(prev => ({ ...prev, releaseId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select release..." />
                  </SelectTrigger>
                  <SelectContent>
                    {releases.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan Type</Label>
                <Select
                  value={newPlan.type}
                  onValueChange={(v) => setNewPlan(prev => ({ ...prev, type: v as TestPlan['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smoke">🔥 Smoke Tests</SelectItem>
                    <SelectItem value="regression">🔄 Regression Tests</SelectItem>
                    <SelectItem value="functional">⚙️ Functional Tests</SelectItem>
                    <SelectItem value="integration">🔗 Integration Tests</SelectItem>
                    <SelectItem value="e2e">🎯 End-to-End Tests</SelectItem>
                    <SelectItem value="custom">📝 Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this plan test?"
                  rows={2}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="testcases" className="mt-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {testCases.map(tc => (
                  <div 
                    key={tc.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTestCases.includes(tc.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedTestCases(prev => 
                        prev.includes(tc.id) ? prev.filter(id => id !== tc.id) : [...prev, tc.id]
                      );
                    }}
                  >
                    <Checkbox checked={selectedTestCases.includes(tc.id)} />
                    <div className="flex-1">
                      <p className="font-medium">{tc.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{tc.type}</Badge>
                        <Badge variant="outline" className="text-xs">{tc.priority}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setShowCreatePlan(false);
              setSelectedTestCases([]);
            }}>Cancel</Button>
            <Button onClick={createTestPlan}>Create Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Test Plan Dialog - Manage Test Cases */}
      <Dialog open={showEditPlanDialog} onOpenChange={setShowEditPlanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Manage Test Cases - {editingPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove test cases from this test plan
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-muted-foreground">
                {editPlanTestCases.length} test cases selected
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditPlanTestCases(testCases.map(tc => tc.id))}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditPlanTestCases([])}
                >
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {testCases.map(tc => (
                <div 
                  key={tc.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    editPlanTestCases.includes(tc.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setEditPlanTestCases(prev => 
                      prev.includes(tc.id) ? prev.filter(id => id !== tc.id) : [...prev, tc.id]
                    );
                  }}
                >
                  <Checkbox checked={editPlanTestCases.includes(tc.id)} />
                  <div className="flex-1">
                    <p className="font-medium">{tc.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{tc.type || 'manual'}</Badge>
                      <Badge variant="outline" className="text-xs">{tc.priority || 'medium'}</Badge>
                      {tc.linkedRequirements && tc.linkedRequirements.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          {tc.linkedRequirements.length} req
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {testCases.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No test cases available</p>
                  <Button variant="link" onClick={() => navigate('/cases/create')}>
                    Create test cases first
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPlanDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditPlan}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

