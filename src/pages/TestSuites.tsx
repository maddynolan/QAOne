import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Play, Layers, CheckSquare, Clock, Calendar,
  MoreHorizontal, Edit, Trash2, Copy, ChevronRight, Target,
  AlertCircle, CheckCircle2, XCircle, Loader2, Filter, ArrowRight,
  FileText, Bug, Link2, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TestCase {
  id: string;
  name: string;
  type: string;
  priority: string;
  status: string;
  tags: string[];
  linkedRequirements?: string[];
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCaseIds: string[];
  status: 'draft' | 'active' | 'archived';
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'on-demand';
    nextRun?: string;
  };
  linkedRequirements: string[];
  lastRun?: {
    date: string;
    passed: number;
    failed: number;
    skipped: number;
  };
  createdAt: string;
}

export default function TestSuites() {
  const navigate = useNavigate();
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  
  const [newSuite, setNewSuite] = useState({
    name: '',
    description: '',
    schedule: 'on-demand' as 'daily' | 'weekly' | 'on-demand'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suitesRes, casesRes, reqsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/db/test-suites`).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/test-cases`).catch(() => ({ ok: false })),
        fetch(`${API_BASE_URL}/requirements`).catch(() => ({ ok: false }))
      ]);

      // Load suites
      if (suitesRes.ok) {
        const data = await suitesRes.json();
        setSuites(Array.isArray(data) ? data : []);
      } else {
        // Load from localStorage as fallback
        const stored = localStorage.getItem('test_suites');
        setSuites(stored ? JSON.parse(stored) : []);
      }

      // Load test cases
      if (casesRes.ok) {
        const data = await casesRes.json();
        setTestCases(Array.isArray(data) ? data : []);
      }

      // Load requirements
      if (reqsRes.ok) {
        const data = await reqsRes.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSuite = async () => {
    if (!newSuite.name.trim()) {
      toast.error('Please enter a suite name');
      return;
    }

    const suite: TestSuite = {
      id: editingSuite?.id || `suite_${Date.now()}`,
      name: newSuite.name,
      description: newSuite.description,
      testCaseIds: selectedTestCases,
      status: 'active',
      schedule: {
        enabled: newSuite.schedule !== 'on-demand',
        frequency: newSuite.schedule,
      },
      linkedRequirements: selectedRequirements,
      createdAt: editingSuite?.createdAt || new Date().toISOString()
    };

    try {
      // Try backend first
      const method = editingSuite ? 'PUT' : 'POST';
      const url = editingSuite 
        ? `${API_BASE_URL}/api/db/test-suites/${suite.id}`
        : `${API_BASE_URL}/api/db/test-suites`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suite)
      });

      if (!response.ok) throw new Error('Backend failed');
      
      toast.success(editingSuite ? 'Suite updated!' : 'Suite created!');
    } catch {
      // Save to localStorage as fallback
      const stored = JSON.parse(localStorage.getItem('test_suites') || '[]');
      if (editingSuite) {
        const idx = stored.findIndex((s: TestSuite) => s.id === suite.id);
        if (idx >= 0) stored[idx] = suite;
      } else {
        stored.push(suite);
      }
      localStorage.setItem('test_suites', JSON.stringify(stored));
      toast.success(editingSuite ? 'Suite updated!' : 'Suite created!');
    }

    // Update local state
    if (editingSuite) {
      setSuites(prev => prev.map(s => s.id === suite.id ? suite : s));
    } else {
      setSuites(prev => [...prev, suite]);
    }

    resetForm();
  };

  const deleteSuite = async (suiteId: string) => {
    if (!confirm('Delete this test suite?')) return;

    try {
      await fetch(`${API_BASE_URL}/api/db/test-suites/${suiteId}`, { method: 'DELETE' });
    } catch {
      // Remove from localStorage
      const stored = JSON.parse(localStorage.getItem('test_suites') || '[]');
      localStorage.setItem('test_suites', JSON.stringify(stored.filter((s: TestSuite) => s.id !== suiteId)));
    }

    setSuites(prev => prev.filter(s => s.id !== suiteId));
    toast.success('Suite deleted');
  };

  const runSuite = (suite: TestSuite) => {
    // Navigate to test runs with the suite pre-selected
    navigate(`/runs?suite=${suite.id}`);
  };

  const resetForm = () => {
    setNewSuite({ name: '', description: '', schedule: 'on-demand' });
    setSelectedTestCases([]);
    setSelectedRequirements([]);
    setEditingSuite(null);
    setShowCreateDialog(false);
  };

  const openEditDialog = (suite: TestSuite) => {
    setEditingSuite(suite);
    setNewSuite({
      name: suite.name,
      description: suite.description,
      schedule: suite.schedule?.frequency || 'on-demand'
    });
    setSelectedTestCases(suite.testCaseIds || []);
    setSelectedRequirements(suite.linkedRequirements || []);
    setShowCreateDialog(true);
  };

  const filteredSuites = suites.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTestCaseById = (id: string) => testCases.find(tc => tc.id === id);

  // Calculate coverage stats
  const totalRequirements = requirements.length;
  const coveredRequirements = new Set(suites.flatMap(s => s.linkedRequirements || [])).size;
  const coveragePercent = totalRequirements > 0 ? Math.round((coveredRequirements / totalRequirements) * 100) : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Test Suites</h1>
          <p className="text-muted-foreground mt-1">
            Organize test cases into executable suites • {suites.length} suites • {testCases.length} test cases
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Suite
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suites.length}</p>
                <p className="text-sm text-muted-foreground">Test Suites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{testCases.length}</p>
                <p className="text-sm text-muted-foreground">Test Cases</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{coveragePercent}%</p>
                <p className="text-sm text-muted-foreground">Req Coverage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Calendar className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{suites.filter(s => s.schedule?.enabled).length}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search suites..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Suites List */}
      {filteredSuites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No test suites yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a suite to organize your test cases and enable scheduled runs
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Suite
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSuites.map(suite => {
            const suiteTestCases = (suite.testCaseIds || []).map(id => getTestCaseById(id)).filter(Boolean);
            const passRate = suite.lastRun 
              ? Math.round((suite.lastRun.passed / (suite.lastRun.passed + suite.lastRun.failed + suite.lastRun.skipped)) * 100) 
              : null;

            return (
              <Card key={suite.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{suite.name}</h3>
                        <Badge variant={suite.status === 'active' ? 'default' : 'secondary'}>
                          {suite.status}
                        </Badge>
                        {suite.schedule?.enabled && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Calendar className="h-3 w-3 mr-1" />
                            {suite.schedule.frequency}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{suite.description || 'No description'}</p>
                      
                      {/* Stats Row */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{suiteTestCases.length} test cases</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span>{(suite.linkedRequirements || []).length} requirements</span>
                        </div>
                        {passRate !== null && (
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className={passRate >= 80 ? 'text-green-600' : passRate >= 50 ? 'text-amber-600' : 'text-red-600'}>
                              {passRate}% pass rate
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Test Case Preview */}
                      {suiteTestCases.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {suiteTestCases.slice(0, 5).map(tc => (
                            <Badge key={tc!.id} variant="outline" className="text-xs">
                              {tc!.name.substring(0, 30)}{tc!.name.length > 30 ? '...' : ''}
                            </Badge>
                          ))}
                          {suiteTestCases.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{suiteTestCases.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="default" size="sm" onClick={() => runSuite(suite)}>
                        <Play className="h-4 w-4 mr-1" />
                        Run
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(suite)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Suite
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            const copy = { ...suite, id: `suite_${Date.now()}`, name: `${suite.name} (Copy)` };
                            setSuites(prev => [...prev, copy]);
                            toast.success('Suite duplicated');
                          }}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteSuite(suite.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {editingSuite ? 'Edit Test Suite' : 'Create Test Suite'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="testcases">Test Cases ({selectedTestCases.length})</TabsTrigger>
              <TabsTrigger value="requirements">Requirements ({selectedRequirements.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div>
                <Label>Suite Name *</Label>
                <Input
                  value={newSuite.name}
                  onChange={(e) => setNewSuite(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Smoke Test Suite"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newSuite.description}
                  onChange={(e) => setNewSuite(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this suite test?"
                  rows={3}
                />
              </div>
              <div>
                <Label>Schedule</Label>
                <Select 
                  value={newSuite.schedule} 
                  onValueChange={(v) => setNewSuite(prev => ({ ...prev, schedule: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on-demand">On Demand (Manual)</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="testcases" className="mt-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {testCases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No test cases available</p>
                    <Button variant="link" onClick={() => navigate('/cases/create')}>
                      Create test cases first
                    </Button>
                  </div>
                ) : (
                  testCases.map(tc => (
                    <div 
                      key={tc.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTestCases.includes(tc.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedTestCases(prev => 
                          prev.includes(tc.id) 
                            ? prev.filter(id => id !== tc.id)
                            : [...prev, tc.id]
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
                  ))
                )}
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedTestCases(testCases.map(tc => tc.id))}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedTestCases([])}>
                  Clear All
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-4">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {requirements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No requirements available</p>
                    <Button variant="link" onClick={() => navigate('/requirements/create')}>
                      Create requirements first
                    </Button>
                  </div>
                ) : (
                  requirements.map(req => (
                    <div 
                      key={req.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRequirements.includes(req.id) ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedRequirements(prev => 
                          prev.includes(req.id) 
                            ? prev.filter(id => id !== req.id)
                            : [...prev, req.id]
                        );
                      }}
                    >
                      <Checkbox checked={selectedRequirements.includes(req.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{req.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{req.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={saveSuite}>
              {editingSuite ? 'Save Changes' : 'Create Suite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
