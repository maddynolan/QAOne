/**
 * @module platform
 * @page Traceability
 *
 * Requirements-to-test traceability matrix page. Visualizes the relationships
 * between requirements, test cases, test runs, and defects to ensure complete
 * coverage and identify gaps.
 *
 * @features
 * - Interactive traceability matrix visualization
 * - Requirement-to-test-case linking
 * - Coverage gap identification
 * - Bidirectional navigation (requirement to test, test to requirement)
 * - Export traceability reports
 * - Filter by coverage status
 *
 * @api /api/requirements/* - Requirements endpoints
 * @api /test-cases/* - Test case endpoints
 * @api /defects/* - Defect endpoints
 *
 * @dependencies Traceability uses React, useState, useEffect, useCallback, useMemo, lucide-react
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch, FileText, TestTube, PlayCircle, Bug, AlertTriangle,
  CheckCircle2, XCircle, Clock, Link2, Unlink, Search, Filter,
  Download, RefreshCw, ChevronRight, ChevronDown, Eye,
  Target, Layers, AlertCircle, ExternalLink, Plus, Rocket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== TYPES ====================

interface Requirement {
  id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  linkedTestCases?: string[];
}

interface TestPlan {
  id: string;
  name: string;
  description?: string;
  status?: string;
  testCaseIds: string[];
  linkedRequirements?: string[];
  releaseId?: string;
}

interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  linkedRequirements?: string[];
  type?: string;
}

interface TestRun {
  id: string;
  name?: string;
  testCaseId: string;
  status: string;
  planId?: string;
  sourceId?: string;
  startTime?: string;
  endTime?: string;
}

interface Defect {
  id: string;
  title: string;
  severity?: string;
  status?: string;
  linkedTestCase?: string;
}

interface TraceabilityLink {
  requirement: Requirement;
  testCases: TestCase[];
  testPlans: TestPlan[];
  testRuns: TestRun[];
  defects: Defect[];
  coverageScore: number;
  coverageStatus: 'full' | 'partial' | 'none';
  gaps: string[];
}

// ==================== COMPONENT ====================

export default function Traceability() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Raw data
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);

  // Computed
  const [traceabilityLinks, setTraceabilityLinks] = useState<TraceabilityLink[]>([]);
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  // ==================== DATA LOADING ====================

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Load from multiple sources and merge

      // 1. Requirements
      let reqs: Requirement[] = [];
      try {
        const res = await fetch(`${API_BASE}/requirements`);
        if (res.ok) {
          const data = await res.json();
          reqs = data.requirements || [];
        }
      } catch { }
      // Merge with localStorage
      const localReqs = JSON.parse(localStorage.getItem('requirements') || '[]');
      const reqIds = new Set(reqs.map(r => r.id));
      localReqs.forEach((r: Requirement) => {
        if (!reqIds.has(r.id)) reqs.push(r);
      });
      setRequirements(reqs);

      // 2. Test Cases
      let cases: TestCase[] = [];
      try {
        const res = await fetch(`${API_BASE}/test-cases`);
        if (res.ok) {
          const data = await res.json();
          cases = Array.isArray(data) ? data : [];
        }
      } catch { }
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const caseIds = new Set(cases.map(c => c.id));
      localCases.forEach((c: TestCase) => {
        if (!caseIds.has(c.id)) cases.push(c);
      });
      setTestCases(cases);

      // 3. Test Plans (from localStorage - this is where we store them)
      const plans: TestPlan[] = JSON.parse(localStorage.getItem('test_plans') || '[]');
      setTestPlans(plans);

      // 4. Test Runs (from localStorage)
      const runs: TestRun[] = JSON.parse(localStorage.getItem('test_runs') || '[]');
      setTestRuns(runs);

      // 5. Defects
      let defs: Defect[] = [];
      try {
        const res = await fetch(`${API_BASE}/defects`);
        if (res.ok) {
          const data = await res.json();
          defs = data.defects || [];
        }
      } catch { }
      const localDefs = JSON.parse(localStorage.getItem('defects') || '[]');
      const defIds = new Set(defs.map(d => d.id));
      localDefs.forEach((d: Defect) => {
        if (!defIds.has(d.id)) defs.push(d);
      });
      setDefects(defs);

      // Build traceability
      buildTraceability(reqs, cases, plans, runs, defs);

    } catch (error) {
      console.error('Error loading traceability data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const buildTraceability = (
    reqs: Requirement[],
    cases: TestCase[],
    plans: TestPlan[],
    runs: TestRun[],
    defs: Defect[]
  ) => {
    const links: TraceabilityLink[] = [];

    reqs.forEach(req => {
      // Find test cases linked to this requirement
      const linkedCases = cases.filter(tc => {
        const tcReqs = tc.linkedRequirements || [];
        return tcReqs.includes(req.id);
      });

      // Find test plans that contain these test cases
      const linkedPlans = plans.filter(plan => {
        return linkedCases.some(tc => plan.testCaseIds?.includes(tc.id)) ||
               plan.linkedRequirements?.includes(req.id);
      });

      // Find test runs for these test cases
      const linkedRuns = runs.filter(run =>
        linkedCases.some(tc => run.testCaseId === tc.id)
      );

      // Find defects linked to these test cases
      const linkedDefects = defs.filter(def =>
        linkedCases.some(tc => def.linkedTestCase === tc.id)
      );

      // Calculate coverage score
      let score = 0;
      const gaps: string[] = [];

      if (linkedCases.length > 0) {
        score += 40; // Has test cases
      } else {
        gaps.push('No test cases linked');
      }

      if (linkedPlans.length > 0) {
        score += 20; // In a test plan
      } else if (linkedCases.length > 0) {
        gaps.push('Test cases not in any plan');
      }

      if (linkedRuns.length > 0) {
        score += 20; // Has been executed
        const passedRuns = linkedRuns.filter(r => r.status === 'passed').length;
        if (passedRuns > 0) {
          score += 20; // Has passed runs
        } else {
          gaps.push('No passing test runs');
        }
      } else if (linkedCases.length > 0) {
        gaps.push('Test cases not executed');
      }

      links.push({
        requirement: req,
        testCases: linkedCases,
        testPlans: linkedPlans,
        testRuns: linkedRuns,
        defects: linkedDefects,
        coverageScore: score,
        coverageStatus: score >= 80 ? 'full' : score >= 40 ? 'partial' : 'none',
        gaps
      });
    });

    setTraceabilityLinks(links);
  };

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ==================== COMPUTED STATS ====================

  const stats = useMemo(() => {
    const totalReqs = requirements.length;
    const fullCoverage = traceabilityLinks.filter(l => l.coverageStatus === 'full').length;
    const partialCoverage = traceabilityLinks.filter(l => l.coverageStatus === 'partial').length;
    const noCoverage = traceabilityLinks.filter(l => l.coverageStatus === 'none').length;

    const passedRuns = testRuns.filter(r => r.status === 'passed').length;
    const failedRuns = testRuns.filter(r => r.status === 'failed').length;
    const otherRuns = testRuns.length - passedRuns - failedRuns;

    const coveragePercent = totalReqs > 0 ? Math.round((fullCoverage / totalReqs) * 100) : 0;
    const executionRate = testCases.length > 0 ? Math.round((testRuns.length / testCases.length) * 100) : 0;
    const passRate = testRuns.length > 0 ? Math.round((passedRuns / testRuns.length) * 100) : 0;

    return {
      totalRequirements: totalReqs,
      fullCoverage,
      partialCoverage,
      noCoverage,
      totalTestPlans: testPlans.length,
      totalTestCases: testCases.length,
      totalTestRuns: testRuns.length,
      passedRuns,
      failedRuns,
      otherRuns,
      coveragePercent,
      executionRate,
      passRate
    };
  }, [requirements, testPlans, testCases, testRuns, traceabilityLinks]);

  // ==================== FILTERING ====================

  const filteredLinks = useMemo(() => {
    return traceabilityLinks.filter(link => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!link.requirement.title?.toLowerCase().includes(q) &&
            !link.requirement.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterStatus !== 'all' && link.coverageStatus !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [traceabilityLinks, searchQuery, filterStatus]);

  // ==================== GAPS ====================

  const gapAnalysis = useMemo(() => {
    return {
      reqsWithoutCases: traceabilityLinks.filter(l => l.testCases.length === 0),
      reqsWithoutPlans: traceabilityLinks.filter(l => l.testPlans.length === 0 && l.testCases.length > 0),
      casesNotExecuted: traceabilityLinks.filter(l => l.testRuns.length === 0 && l.testCases.length > 0),
      failingTests: traceabilityLinks.filter(l => l.testRuns.some(r => r.status === 'failed'))
    };
  }, [traceabilityLinks]);

  // ==================== NAVIGATION HELPERS ====================

  const navigateTo = (type: string, id?: string) => {
    switch (type) {
      case 'requirements':
        navigate('/requirements');
        break;
      case 'requirement':
        navigate(`/requirements`); // Could navigate to specific req
        break;
      case 'testPlans':
        navigate('/execution?tab=plans');
        break;
      case 'testPlan':
        if (id) navigate(`/execution/plan/${id}`);
        else navigate('/execution?tab=plans');
        break;
      case 'testCases':
        navigate('/cases');
        break;
      case 'testCase':
        if (id) navigate(`/cases/edit/${id}`);
        else navigate('/cases');
        break;
      case 'testRuns':
        navigate('/execution?tab=results');
        break;
      case 'defects':
        navigate('/defects');
        break;
      case 'createTestCase':
        navigate('/cases/create');
        break;
      case 'createPlan':
        navigate('/execution');
        break;
    }
  };

  const toggleExpand = (reqId: string) => {
    const newExpanded = new Set(expandedReqs);
    if (newExpanded.has(reqId)) {
      newExpanded.delete(reqId);
    } else {
      newExpanded.add(reqId);
    }
    setExpandedReqs(newExpanded);
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-purple-600" />
            Traceability Matrix
          </h1>
          <p className="text-muted-foreground mt-1">
            End-to-end visibility: Requirements → Test Plans → Test Cases → Test Runs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setActiveTab('gaps')}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Gap Analysis
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="overview">
            <Target className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="matrix">
            <Layers className="h-4 w-4 mr-2" />
            Matrix
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Gaps
          </TabsTrigger>
          <TabsTrigger value="impact">
            <GitBranch className="h-4 w-4 mr-2" />
            Impact
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Summary Cards - All Clickable */}
          <div className="grid grid-cols-4 gap-4">
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-white border-blue-200"
              onClick={() => navigateTo('requirements')}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Requirements</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalRequirements}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.fullCoverage} fully covered
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50 to-white border-purple-200"
              onClick={() => navigateTo('testPlans')}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Test Plans</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalTestPlans}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Organizing test execution
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-white border-green-200"
              onClick={() => navigateTo('testCases')}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-green-600">Test Cases</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalTestCases}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.executionRate}% execution rate
                    </p>
                  </div>
                  <TestTube className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-amber-50 to-white border-amber-200"
              onClick={() => navigateTo('testRuns')}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-amber-600">Test Runs</p>
                    <p className="text-3xl font-bold mt-1">{stats.totalTestRuns}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.passRate}% pass rate
                    </p>
                  </div>
                  <PlayCircle className="h-8 w-8 text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coverage & Health Cards */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Requirement Coverage
                </CardTitle>
                <CardDescription>
                  How well requirements are covered by test cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold">{stats.coveragePercent}%</span>
                  <Badge variant={stats.coveragePercent >= 80 ? 'default' : stats.coveragePercent >= 50 ? 'secondary' : 'destructive'}>
                    {stats.coveragePercent >= 80 ? 'Good' : stats.coveragePercent >= 50 ? 'Moderate' : 'Needs Attention'}
                  </Badge>
                </div>
                <Progress value={stats.coveragePercent} className="h-3 mb-4" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div 
                    className="p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100"
                    onClick={() => setFilterStatus('full')}
                  >
                    <p className="text-xl font-bold text-green-600">{stats.fullCoverage}</p>
                    <p className="text-xs text-green-600">Fully Covered</p>
                  </div>
                  <div 
                    className="p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100"
                    onClick={() => setFilterStatus('partial')}
                  >
                    <p className="text-xl font-bold text-amber-600">{stats.partialCoverage}</p>
                    <p className="text-xs text-amber-600">Partial Coverage</p>
                  </div>
                  <div 
                    className="p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100"
                    onClick={() => setFilterStatus('none')}
                  >
                    <p className="text-xl font-bold text-red-600">{stats.noCoverage}</p>
                    <p className="text-xs text-red-600">No Coverage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  Execution Health
                </CardTitle>
                <CardDescription>
                  Test execution status and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold">{stats.passRate}%</span>
                  <Badge variant={stats.passRate >= 80 ? 'default' : stats.passRate >= 50 ? 'secondary' : 'destructive'}>
                    Pass Rate
                  </Badge>
                </div>
                <Progress value={stats.passRate} className="h-3 mb-4" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div 
                    className="p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100"
                    onClick={() => navigateTo('testRuns')}
                  >
                    <p className="text-xl font-bold text-green-600">{stats.passedRuns}</p>
                    <p className="text-xs text-green-600">Passed</p>
                  </div>
                  <div 
                    className="p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100"
                    onClick={() => navigateTo('testRuns')}
                  >
                    <p className="text-xl font-bold text-red-600">{stats.failedRuns}</p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                  <div 
                    className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => navigateTo('testRuns')}
                  >
                    <p className="text-xl font-bold text-gray-600">{stats.otherRuns}</p>
                    <p className="text-xs text-gray-600">Other</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          {stats.totalRequirements === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No requirements found</h3>
                <p className="text-muted-foreground mb-4">
                  Add requirements to start building traceability
                </p>
                <Button onClick={() => navigate('/requirements/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Requirement
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MATRIX TAB */}
        <TabsContent value="matrix" className="mt-6 space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requirements..."
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="full">Fully Covered</SelectItem>
                <SelectItem value="partial">Partial Coverage</SelectItem>
                <SelectItem value="none">No Coverage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Matrix List */}
          {filteredLinks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {requirements.length === 0 ? 'No requirements to trace' : 'No matches found'}
                </h3>
                <p className="text-muted-foreground">
                  {requirements.length === 0 
                    ? 'Create requirements first to build traceability' 
                    : 'Try adjusting your filters'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLinks.map(link => (
                <Card key={link.requirement.id} className="overflow-hidden">
                  <Collapsible open={expandedReqs.has(link.requirement.id)}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="p-4 cursor-pointer hover:bg-muted/50 flex items-center justify-between"
                        onClick={() => toggleExpand(link.requirement.id)}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-3 h-3 rounded-full ${
                            link.coverageStatus === 'full' ? 'bg-green-500' :
                            link.coverageStatus === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                          <div className="flex-1">
                            <p className="font-medium">{link.requirement.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {link.requirement.description || 'No description'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-green-50">
                              <TestTube className="h-3 w-3 mr-1" />
                              {link.testCases.length}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50">
                              <Target className="h-3 w-3 mr-1" />
                              {link.testPlans.length}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50">
                              <PlayCircle className="h-3 w-3 mr-1" />
                              {link.testRuns.length}
                            </Badge>
                            {link.defects.length > 0 && (
                              <Badge variant="destructive">
                                <Bug className="h-3 w-3 mr-1" />
                                {link.defects.length}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="w-24">
                            <div className="flex items-center gap-2">
                              <Progress value={link.coverageScore} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground">{link.coverageScore}%</span>
                            </div>
                          </div>
                          
                          {expandedReqs.has(link.requirement.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t bg-muted/30">
                        <div className="grid grid-cols-4 gap-4 pt-4">
                          {/* Test Cases */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <TestTube className="h-4 w-4" />
                              Test Cases ({link.testCases.length})
                            </h4>
                            {link.testCases.length === 0 ? (
                              <p className="text-sm text-muted-foreground">None linked</p>
                            ) : (
                              <div className="space-y-1">
                                {link.testCases.slice(0, 3).map(tc => (
                                  <div 
                                    key={tc.id}
                                    className="text-sm p-2 bg-white rounded cursor-pointer hover:bg-green-50"
                                    onClick={() => navigateTo('testCase', tc.id)}
                                  >
                                    {tc.name || tc.title}
                                  </div>
                                ))}
                                {link.testCases.length > 3 && (
                                  <Button variant="link" size="sm" onClick={() => navigateTo('testCases')}>
                                    +{link.testCases.length - 3} more
                                  </Button>
                                )}
                              </div>
                            )}
                            {link.testCases.length === 0 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => navigateTo('createTestCase')}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Test Case
                              </Button>
                            )}
                          </div>
                          
                          {/* Test Plans */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              Test Plans ({link.testPlans.length})
                            </h4>
                            {link.testPlans.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Not in any plan</p>
                            ) : (
                              <div className="space-y-1">
                                {link.testPlans.slice(0, 3).map(plan => (
                                  <div 
                                    key={plan.id}
                                    className="text-sm p-2 bg-white rounded cursor-pointer hover:bg-purple-50"
                                    onClick={() => navigateTo('testPlan', plan.id)}
                                  >
                                    {plan.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Test Runs */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <PlayCircle className="h-4 w-4" />
                              Test Runs ({link.testRuns.length})
                            </h4>
                            {link.testRuns.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Not executed</p>
                            ) : (
                              <div className="space-y-1">
                                {link.testRuns.slice(0, 3).map(run => (
                                  <div 
                                    key={run.id}
                                    className={`text-sm p-2 rounded flex items-center gap-2 ${
                                      run.status === 'passed' ? 'bg-green-50' :
                                      run.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'
                                    }`}
                                  >
                                    {run.status === 'passed' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> :
                                     run.status === 'failed' ? <XCircle className="h-3 w-3 text-red-600" /> :
                                     <Clock className="h-3 w-3" />}
                                    <span className="truncate">{run.name || 'Test Run'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Gaps */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Gaps ({link.gaps.length})
                            </h4>
                            {link.gaps.length === 0 ? (
                              <p className="text-sm text-green-600">✓ Fully covered</p>
                            ) : (
                              <div className="space-y-1">
                                {link.gaps.map((gap, i) => (
                                  <div key={i} className="text-sm p-2 bg-red-50 text-red-700 rounded">
                                    {gap}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* GAPS TAB */}
        <TabsContent value="gaps" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Requirements without test cases */}
            <Card className={gapAnalysis.reqsWithoutCases.length > 0 ? 'border-red-200' : 'border-green-200'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className={gapAnalysis.reqsWithoutCases.length > 0 ? 'text-red-500' : 'text-green-500'} />
                  Requirements Without Test Cases
                </CardTitle>
                <CardDescription>
                  {gapAnalysis.reqsWithoutCases.length} requirement(s) have no test coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gapAnalysis.reqsWithoutCases.length === 0 ? (
                  <p className="text-green-600 text-sm">✓ All requirements have test cases</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {gapAnalysis.reqsWithoutCases.map(link => (
                      <div 
                        key={link.requirement.id}
                        className="p-3 bg-red-50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-red-100"
                        onClick={() => toggleExpand(link.requirement.id)}
                      >
                        <span className="font-medium">{link.requirement.title}</span>
                        <Button size="sm" variant="outline" onClick={(e) => {
                          e.stopPropagation();
                          navigateTo('createTestCase');
                        }}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Test
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test cases not in plans */}
            <Card className={gapAnalysis.reqsWithoutPlans.length > 0 ? 'border-amber-200' : 'border-green-200'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className={gapAnalysis.reqsWithoutPlans.length > 0 ? 'text-amber-500' : 'text-green-500'} />
                  Test Cases Not in Plans
                </CardTitle>
                <CardDescription>
                  {gapAnalysis.reqsWithoutPlans.length} requirement(s) have tests not in any plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gapAnalysis.reqsWithoutPlans.length === 0 ? (
                  <p className="text-green-600 text-sm">✓ All test cases are in plans</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {gapAnalysis.reqsWithoutPlans.map(link => (
                      <div 
                        key={link.requirement.id}
                        className="p-3 bg-amber-50 rounded-lg flex items-center justify-between"
                      >
                        <span className="font-medium">{link.requirement.title}</span>
                        <Button size="sm" variant="outline" onClick={() => navigateTo('createPlan')}>
                          <Rocket className="h-3 w-3 mr-1" />
                          Add to Plan
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test cases not executed */}
            <Card className={gapAnalysis.casesNotExecuted.length > 0 ? 'border-amber-200' : 'border-green-200'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className={gapAnalysis.casesNotExecuted.length > 0 ? 'text-amber-500' : 'text-green-500'} />
                  Tests Not Executed
                </CardTitle>
                <CardDescription>
                  {gapAnalysis.casesNotExecuted.length} requirement(s) have tests not yet run
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gapAnalysis.casesNotExecuted.length === 0 ? (
                  <p className="text-green-600 text-sm">✓ All tests have been executed</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {gapAnalysis.casesNotExecuted.map(link => (
                      <div 
                        key={link.requirement.id}
                        className="p-3 bg-amber-50 rounded-lg flex items-center justify-between"
                      >
                        <span className="font-medium">{link.requirement.title}</span>
                        <Badge variant="secondary">{link.testCases.length} tests pending</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Failing tests */}
            <Card className={gapAnalysis.failingTests.length > 0 ? 'border-red-200' : 'border-green-200'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className={gapAnalysis.failingTests.length > 0 ? 'text-red-500' : 'text-green-500'} />
                  Requirements with Failing Tests
                </CardTitle>
                <CardDescription>
                  {gapAnalysis.failingTests.length} requirement(s) have failing test runs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gapAnalysis.failingTests.length === 0 ? (
                  <p className="text-green-600 text-sm">✓ No failing tests</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {gapAnalysis.failingTests.map(link => {
                      const failCount = link.testRuns.filter(r => r.status === 'failed').length;
                      return (
                        <div 
                          key={link.requirement.id}
                          className="p-3 bg-red-50 rounded-lg flex items-center justify-between"
                        >
                          <span className="font-medium">{link.requirement.title}</span>
                          <Badge variant="destructive">{failCount} failed</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IMPACT TAB */}
        <TabsContent value="impact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Impact Analysis</CardTitle>
              <CardDescription>
                Select a requirement to see what would be affected by changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requirements.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No requirements available for impact analysis
                </p>
              ) : (
                <div className="space-y-4">
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a requirement..." />
                    </SelectTrigger>
                    <SelectContent>
                      {requirements.map(req => (
                        <SelectItem key={req.id} value={req.id}>{req.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="text-center py-8 text-muted-foreground">
                    <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a requirement to view its impact chain</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
