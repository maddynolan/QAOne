/**
 * @module platform
 * @page ProjectManagement
 *
 * Project management page with Kanban boards, task tracking, and team
 * collaboration. Provides project-level organization for test efforts
 * with milestone tracking and resource management.
 *
 * @features
 * - Kanban board and list views for task management
 * - Project creation with team assignment
 * - Milestone and sprint tracking
 * - Task status management (todo, in-progress, done)
 * - Search, filter, and bulk operations
 * - Team member assignment and workload view
 *
 * @api /api/projects/* - Project management endpoints
 *
 * @dependencies ProjectManagement uses React, useState, useCallback, useEffect, lucide-react
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  LayoutGrid, List, GitBranch,
  Plus, Search, Clock, AlertCircle,
  Link2, TestTube, Bug, FileText, Zap, ArrowRight,
  Sparkles, Columns, RefreshCw,
  Play, FileCode, Copy, Download,
  Loader2, BookText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// Extracted types
import type {
  Issue, BoardColumn, Cycle, TeamMember,
  StoredRequirement, StoredTestCase, StoredDefect,
} from '../types/project-management-types';

// Extracted constants
import {
  TEAM_MEMBERS, DEFAULT_COLUMNS, MOCK_ISSUES, MOCK_CYCLES, MOCK_GOALS,
  TYPE_CONFIG, PRIORITY_CONFIG, GHERKIN_TEMPLATES,
} from '../constants/project-management-constants';

// Extracted utility functions
import { generateLocalGherkin, generateGherkinFromText } from '../lib/project-management-utils';

// Extracted sub-components
import {
  TeamAvatar, QuickFilters, TeamPanel, ColumnCustomizer,
  KanbanColumn, CreateIssueModal, IssueDetailModal,
} from '../components/project-management';

// ==================== MAIN COMPONENT ====================

export default function ProjectManagement() {
  const [issues, setIssues] = useState<Issue[]>(MOCK_ISSUES);
  const [cycles] = useState<Cycle[]>(MOCK_CYCLES);
  const [columns, setColumns] = useState<BoardColumn[]>(DEFAULT_COLUMNS);
  const [teamMembers] = useState<TeamMember[]>(TEAM_MEMBERS);
  
  // Traceability data from localStorage
  const [storedRequirements, setStoredRequirements] = useState<StoredRequirement[]>([]);
  const [storedTestCases, setStoredTestCases] = useState<StoredTestCase[]>([]);
  const [storedDefects, setStoredDefects] = useState<StoredDefect[]>([]);
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDefaultColumn, setCreateDefaultColumn] = useState('queue');
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);

  // Gherkin state
  const [gherkinLoading, setGherkinLoading] = useState(false);
  const [generatedGherkin, setGeneratedGherkin] = useState<string>('');
  const [selectedIssueForGherkin, setSelectedIssueForGherkin] = useState<string>('');
  const [gherkinTemplate, setGherkinTemplate] = useState<string>('default');
  const [requirementText, setRequirementText] = useState<string>('');


  // API Base URL
  const API_BASE = 'http://localhost:8000/api/projects';
  const GHERKIN_API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Load issues from backend
  const loadIssues = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/issues?limit=100`);
      if (response.ok) {
        const data = await response.json();
        if (data.issues && data.issues.length > 0) {
          // Map backend format to frontend format
          const mappedIssues = data.issues.map((i: any) => ({
            id: i.id,
            key: i.key,
            title: i.title,
            description: i.description || '',
            type: i.type || 'card',
            status: i.status || 'queue',
            priority: i.priority || 'normal',
            assigneeId: i.assignee_id || i.assigneeId,
            reporterId: i.reporter_id || i.reporterId || '1',
            cycleId: i.cycle_id || i.cycleId,
            goalId: i.goal_id || i.goalId,
            points: i.story_points || i.points,
            labels: i.labels || [],
            created_at: i.created_at || '',
            updated_at: i.updated_at || '',
            linkedRequirements: i.linked_requirements || i.linkedRequirements || [],
            linkedTestCases: i.linked_test_cases || i.linkedTestCases || [],
            linkedDefects: i.linked_defects || i.linkedDefects || [],
            linkedCommits: i.linked_commits || i.linkedCommits || [],
          }));
          setIssues(mappedIssues);
        }
      }
    } catch (error) {
      console.error('Failed to load issues:', error);
      // Keep mock data if API fails
    } finally {
      setIsLoading(false);
    }
  };

  // Create new issue
  const handleCreateIssue = async (newIssue: Partial<Issue>) => {
    try {
      const response = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newIssue.title,
          description: newIssue.description,
          type: newIssue.type,
          priority: newIssue.priority,
          assignee: teamMembers.find(m => m.id === newIssue.assigneeId)?.name,
          story_points: newIssue.points,
          labels: newIssue.labels,
          linked_requirements: newIssue.linkedRequirements || [],
          linked_test_cases: newIssue.linkedTestCases || [],
          linked_defects: newIssue.linkedDefects || [],
          linked_commits: newIssue.linkedCommits || [],
        }),
      });

      if (response.ok) {
        const createdIssue = await response.json();
        
        // Add to local state with proper mapping
        const mappedIssue: Issue = {
          id: createdIssue.id,
          key: createdIssue.key,
          title: createdIssue.title,
          description: createdIssue.description || '',
          type: createdIssue.type || 'card',
          status: newIssue.status || 'queue',
          priority: createdIssue.priority || 'normal',
          assigneeId: newIssue.assigneeId,
          reporterId: '1',
          points: createdIssue.story_points,
          labels: createdIssue.labels || [],
          created_at: createdIssue.created_at,
          updated_at: createdIssue.updated_at,
          linkedRequirements: createdIssue.linked_requirements || [],
          linkedTestCases: createdIssue.linked_test_cases || [],
          linkedDefects: createdIssue.linked_defects || [],
          linkedCommits: createdIssue.linked_commits || [],
        };

        // Update the status if specified
        if (newIssue.status && newIssue.status !== 'queue') {
          await fetch(`${API_BASE}/issues/${createdIssue.id}/move?new_status=${newIssue.status}`, {
            method: 'POST',
          });
          mappedIssue.status = newIssue.status;
        }

        setIssues(prev => [mappedIssue, ...prev]);
        toast.success(`Created ${mappedIssue.key}: ${mappedIssue.title}`);
      } else {
        throw new Error('Failed to create issue');
      }
    } catch (error) {
      console.error('Failed to create issue:', error);
      toast.error('Failed to create item');
      throw error;
    }
  };

  // Load traceability data from localStorage and API
  const loadTraceabilityData = useCallback(async () => {
    // Load requirements
    const reqStored = JSON.parse(localStorage.getItem('requirements') || '[]');
    let allReqs = reqStored;
    try {
      const reqRes = await fetch('http://localhost:8000/requirements');
      if (reqRes.ok) {
        const data = await reqRes.json();
        const apiReqs = (data.requirements || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: r.status,
          source: r.source,
        }));
        // Merge and dedupe
        const ids = new Set(reqStored.map((r: any) => r.id));
        allReqs = [...reqStored, ...apiReqs.filter((r: any) => !ids.has(r.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredRequirements(allReqs);

    // Load test cases
    const tcStored = JSON.parse(localStorage.getItem('test_cases') || '[]');
    let allTcs = tcStored;
    try {
      const tcRes = await fetch('http://localhost:8000/test-cases');
      if (tcRes.ok) {
        const data = await tcRes.json();
        const apiTcs = (data.testCases || []).map((t: any) => ({
          id: t.id,
          name: t.name || t.title,
          status: t.status,
          linkedRequirements: t.linkedRequirements || t.linked_requirements || [],
        }));
        const ids = new Set(tcStored.map((t: any) => t.id));
        allTcs = [...tcStored, ...apiTcs.filter((t: any) => !ids.has(t.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredTestCases(allTcs);

    // Load defects
    const defStored = JSON.parse(localStorage.getItem('defects') || '[]');
    let allDefs = defStored;
    try {
      const defRes = await fetch('http://localhost:8000/defects');
      if (defRes.ok) {
        const data = await defRes.json();
        const apiDefs = (data.defects || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          severity: d.severity,
        }));
        const ids = new Set(defStored.map((d: any) => d.id));
        allDefs = [...defStored, ...apiDefs.filter((d: any) => !ids.has(d.id))];
      }
    } catch (e) { /* ignore */ }
    setStoredDefects(allDefs);
  }, []);

  // Load issues on mount
  useEffect(() => {
    loadIssues();
    loadTraceabilityData();
  }, [loadTraceabilityData]);

  // Gherkin conversion from issue
  const handleConvertIssueToGherkin = async (issueId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) {
      toast.error('Issue not found');
      return;
    }

    setGherkinLoading(true);
    setSelectedIssueForGherkin(issueId);
    
    try {
      const response = await fetch(`${GHERKIN_API}/api/gherkin/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: {
            id: issue.id,
            title: issue.title,
            description: issue.description,
            type: issue.type,
            source: 'project_management'
          },
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedGherkin(data.gherkin || generateLocalGherkin(issue));
        toast.success('Gherkin generated successfully');
      } else {
        // Fallback to local generation
        setGeneratedGherkin(generateLocalGherkin(issue));
        toast.success('Gherkin generated (local)');
      }
    } catch (error) {
      console.error('Gherkin conversion error:', error);
      // Generate locally on error
      setGeneratedGherkin(generateLocalGherkin(issue));
      toast.success('Gherkin generated (local)');
    } finally {
      setGherkinLoading(false);
    }
  };


  // Convert text to Gherkin
  const handleTextToGherkin = async () => {
    if (!requirementText.trim()) {
      toast.error('Please enter requirement text');
      return;
    }

    setGherkinLoading(true);
    
    try {
      const response = await fetch(`${GHERKIN_API}/api/gherkin/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: {
            title: 'Custom Requirement',
            description: requirementText,
            source: 'manual'
          },
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedGherkin(data.gherkin || generateGherkinFromText(requirementText));
        toast.success('Gherkin generated successfully');
      } else {
        setGeneratedGherkin(generateGherkinFromText(requirementText));
        toast.success('Gherkin generated (local)');
      }
    } catch (error) {
      setGeneratedGherkin(generateGherkinFromText(requirementText));
      toast.success('Gherkin generated (local)');
    } finally {
      setGherkinLoading(false);
    }
  };


  // Copy Gherkin to clipboard
  const copyGherkinToClipboard = () => {
    navigator.clipboard.writeText(generatedGherkin);
    toast.success('Copied to clipboard');
  };

  // Download Gherkin as file
  const downloadGherkin = () => {
    const blob = new Blob([generatedGherkin], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature_${Date.now()}.feature`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Filter handler
  const handleFilterChange = (type: string, value: string) => {
    if (type === 'clear') {
      setActiveFilters({});
      return;
    }
    
    setActiveFilters(prev => {
      const current = prev[type] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      
      if (updated.length === 0) {
        const { [type]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [type]: updated };
    });
  };
  
  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = !searchQuery || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.key.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !activeFilters.type?.length || activeFilters.type.includes(issue.type);
    const matchesPriority = !activeFilters.priority?.length || activeFilters.priority.includes(issue.priority);
    const matchesAssignee = !activeFilters.assignee?.length || 
      (activeFilters.assignee.includes('unassigned') && !issue.assigneeId) ||
      (issue.assigneeId && activeFilters.assignee.includes(issue.assigneeId));
    
    return matchesSearch && matchesType && matchesPriority && matchesAssignee;
  });
  
  // Group issues by status
  const issuesByColumn = columns.reduce((acc, col) => {
    acc[col.id] = filteredIssues.filter(i => i.status === col.id);
    return acc;
  }, {} as Record<string, Issue[]>);
  
  // Drag handlers
  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    setDraggedIssue(issue);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedIssue) {
      const oldStatus = draggedIssue.status;
      
      // Optimistic update
      setIssues(prev => prev.map(issue => 
        issue.id === draggedIssue.id ? { ...issue, status: newStatus } : issue
      ));
      
      const col = columns.find(c => c.id === newStatus);
      toast.success(`Moved to ${col?.name || newStatus}`);

      // Update backend
      try {
        await fetch(`${API_BASE}/issues/${draggedIssue.id}/move?new_status=${newStatus}`, {
          method: 'POST',
        });
      } catch (error) {
        // Revert on error
        setIssues(prev => prev.map(issue => 
          issue.id === draggedIssue.id ? { ...issue, status: oldStatus } : issue
        ));
        toast.error('Failed to update status');
      }
    }
    setDraggedIssue(null);
  };
  
  const handleAssign = (issueId: string, memberId: string) => {
    setIssues(prev => prev.map(issue => 
      issue.id === issueId ? { ...issue, assigneeId: memberId || undefined } : issue
    ));
    const member = teamMembers.find(m => m.id === memberId);
    toast.success(member ? `Assigned to ${member.name}` : 'Unassigned');
  };
  
  const handleIssueUpdate = (updates: Partial<Issue>) => {
    if (selectedIssue) {
      setIssues(prev => prev.map(issue => 
        issue.id === selectedIssue.id ? { ...issue, ...updates } : issue
      ));
      setSelectedIssue(prev => prev ? { ...prev, ...updates } : null);
    }
  };
  
  // Stats
  const activeCycle = cycles.find(c => c.status === 'active');
  const stats = {
    total: filteredIssues.length,
    active: filteredIssues.filter(i => i.status === 'active').length,
    issues: filteredIssues.filter(i => i.type === 'issue').length,
    urgent: filteredIssues.filter(i => i.priority === 'urgent').length,
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Board</h1>
          <p className="text-muted-foreground">Agile work management with QA traceability</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnCustomizerOpen(true)}>
            <Columns className="w-4 h-4 mr-2" />
            Columns
          </Button>
          <Button variant="outline" size="sm" onClick={loadIssues} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setCreateDefaultColumn('queue'); setCreateModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        </div>
      </div>
      
      {/* Active Cycle Banner */}
      {activeCycle && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{activeCycle.name}</h3>
                    <Badge>Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{activeCycle.objective}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{activeCycle.issueIds.length}</p>
                  <p className="text-xs text-muted-foreground">Items</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {activeCycle.startDate} → {activeCycle.endDate}
                  </p>
                  <Progress value={65} className="w-32 h-2 mt-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <LayoutGrid className="w-8 h-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-amber-500">{stats.active}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open Issues</p>
              <p className="text-2xl font-bold text-red-500">{stats.issues}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Urgent</p>
              <p className="text-2xl font-bold text-orange-500">{stats.urgent}</p>
            </div>
            <Zap className="w-8 h-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>
      
      {/* Search & Quick Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by title or key..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <QuickFilters 
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          teamMembers={teamMembers}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex gap-6">
        {/* Board */}
        <div className="flex-1">
          <Tabs defaultValue="board">
            <TabsList className="mb-4">
              <TabsTrigger value="board" className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="gherkin" className="flex items-center gap-2">
                <BookText className="w-4 h-4" />
                Gherkin
              </TabsTrigger>
              <TabsTrigger value="traceability" className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Traceability
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="board">
              <div className="flex gap-4 overflow-x-auto pb-4">
                {columns.map(column => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    issues={issuesByColumn[column.id] || []}
                    teamMembers={teamMembers}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                    onIssueClick={(issue) => { setSelectedIssue(issue); setDetailOpen(true); }}
                    onAssign={handleAssign}
                    onAddClick={(colId) => {
                      setCreateDefaultColumn(colId);
                      setCreateModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="list">
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Key</th>
                        <th className="text-left p-3 font-medium">Title</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Priority</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Assignee</th>
                        <th className="text-center p-3 font-medium">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map(issue => {
                        const typeConfig = TYPE_CONFIG[issue.type];
                        const priorityConfig = PRIORITY_CONFIG[issue.priority];
                        const column = columns.find(c => c.id === issue.status);
                        const assignee = teamMembers.find(m => m.id === issue.assigneeId);
                        const traceCount = issue.linkedRequirements.length + issue.linkedTestCases.length;
                        
                        return (
                          <tr 
                            key={issue.id} 
                            className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => { setSelectedIssue(issue); setDetailOpen(true); }}
                          >
                            <td className="p-3 font-mono text-sm">{issue.key}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span>{typeConfig.icon}</span>
                                <span className="font-medium">{issue.title}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${priorityConfig.dotColor}`} />
                                <span className="text-sm">{priorityConfig.label}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column?.color }} />
                                <span className="text-sm">{column?.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <TeamAvatar member={assignee} size="sm" />
                                <span className="text-sm">{assignee?.name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {traceCount > 0 ? (
                                <Badge variant="outline" className="gap-1">
                                  <Link2 className="w-3 h-3" />
                                  {traceCount}
                                </Badge>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gherkin">
              <div className="space-y-4">
                {/* Template Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileCode className="w-5 h-5" />
                      Gherkin Templates
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Click a template to see its structure and use it for conversion</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-5 gap-3">
                      {Object.entries(GHERKIN_TEMPLATES).map(([key, template]) => (
                        <div
                          key={key}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            gherkinTemplate === key 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setGherkinTemplate(key)}
                        >
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        </div>
                      ))}
                    </div>
                    
                    {/* Template Preview */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.name} Template Preview
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''
                              );
                              toast.success('Template copied to clipboard');
                            }}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRequirementText(
                                GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''
                              );
                              toast.info('Template loaded - customize the placeholders {{...}}');
                            }}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Use Template
                          </Button>
                        </div>
                      </div>
                      <pre className="text-xs font-mono bg-background p-3 rounded border overflow-auto max-h-[200px] whitespace-pre-wrap">
                        {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  {/* Convert from Issue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Convert from Work Item</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select
                        value={selectedIssueForGherkin}
                        onValueChange={setSelectedIssueForGherkin}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a work item" />
                        </SelectTrigger>
                        <SelectContent>
                          {issues.map(issue => (
                            <SelectItem key={issue.id} value={issue.id}>
                              {issue.key}: {issue.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={() => handleConvertIssueToGherkin(selectedIssueForGherkin)}
                        disabled={!selectedIssueForGherkin || gherkinLoading}
                        className="w-full"
                      >
                        {gherkinLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Gherkin
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Convert from Text */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Convert from Text</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={requirementText}
                        onChange={(e) => setRequirementText(e.target.value)}
                        placeholder="Paste requirement text here..."
                        className="min-h-[80px]"
                      />
                      <Button 
                        onClick={handleTextToGherkin}
                        disabled={!requirementText.trim() || gherkinLoading}
                        className="w-full"
                      >
                        {gherkinLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Convert to Gherkin
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Generated Output */}
                {generatedGherkin && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          Generated Gherkin
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={copyGherkinToClipboard}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          <Button variant="outline" size="sm" onClick={downloadGherkin}>
                            <Download className="w-4 h-4 mr-2" />
                            Download .feature
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                        {generatedGherkin}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* Template Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selected Template Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono overflow-x-auto text-muted-foreground">
                      {GHERKIN_TEMPLATES[gherkinTemplate as keyof typeof GHERKIN_TEMPLATES]?.template || ''}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="traceability">
              <div className="space-y-6">
                {/* Flow Diagram */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GitBranch className="w-5 h-5" />
                      Traceability Flow
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4 py-8">
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/requirements'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center mb-2">
                          <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="font-medium">Requirements</h4>
                        <p className="text-2xl font-bold text-blue-500">
                          {storedRequirements.length}
                        </p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center">
                        <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center mb-2">
                          <LayoutGrid className="w-8 h-8 text-amber-500" />
                        </div>
                        <h4 className="font-medium">Work Items</h4>
                        <p className="text-2xl font-bold text-amber-500">{issues.length}</p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/cases'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-2">
                          <TestTube className="w-8 h-8 text-green-500" />
                        </div>
                        <h4 className="font-medium">Test Cases</h4>
                        <p className="text-2xl font-bold text-green-500">
                          {storedTestCases.length}
                        </p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 text-center cursor-pointer hover:scale-105 transition-transform" onClick={() => window.location.href = '/defects'}>
                        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-2">
                          <Bug className="w-8 h-8 text-red-500" />
                        </div>
                        <h4 className="font-medium">Defects</h4>
                        <p className="text-2xl font-bold text-red-500">
                          {storedDefects.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/requirements/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Plus className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Requirement</h4>
                        <p className="text-xs text-muted-foreground">Create requirement</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-green-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/cases/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Plus className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Test Case</h4>
                        <p className="text-xs text-muted-foreground">Create test case</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-red-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/defects/create'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <Plus className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">New Defect</h4>
                        <p className="text-xs text-muted-foreground">Report a bug</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-purple-500/50 cursor-pointer transition-colors" onClick={() => window.location.href = '/traceability'}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <GitBranch className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">Full Traceability</h4>
                        <p className="text-xs text-muted-foreground">View matrix</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Coverage Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Coverage Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Requirements with Test Cases</span>
                          <span className="text-sm font-medium">
                            {storedRequirements.length > 0 
                              ? Math.round((storedRequirements.filter(r => 
                                  storedTestCases.some(tc => 
                                    (tc.linkedRequirements || []).includes(r.id)
                                  )
                                ).length / storedRequirements.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedRequirements.length > 0 
                            ? (storedRequirements.filter(r => 
                                storedTestCases.some(tc => 
                                  (tc.linkedRequirements || []).includes(r.id)
                                )
                              ).length / storedRequirements.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Test Cases Executed</span>
                          <span className="text-sm font-medium">
                            {storedTestCases.length > 0 
                              ? Math.round((storedTestCases.filter(tc => tc.status === 'passed' || tc.status === 'failed').length / storedTestCases.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedTestCases.length > 0 
                            ? (storedTestCases.filter(tc => tc.status === 'passed' || tc.status === 'failed').length / storedTestCases.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Defects Resolved</span>
                          <span className="text-sm font-medium">
                            {storedDefects.length > 0 
                              ? Math.round((storedDefects.filter(d => d.status === 'closed' || d.status === 'resolved').length / storedDefects.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={storedDefects.length > 0 
                            ? (storedDefects.filter(d => d.status === 'closed' || d.status === 'resolved').length / storedDefects.length) * 100
                            : 0} 
                          className="h-2" 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Team Panel */}
        <div className="w-72 flex-shrink-0">
          <TeamPanel members={teamMembers} issues={issues} onAssign={handleAssign} />
        </div>
      </div>
      
      {/* Modals */}
      <IssueDetailModal 
        issue={selectedIssue}
        teamMembers={teamMembers}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={handleIssueUpdate}
      />
      
      <ColumnCustomizer
        columns={columns}
        onSave={setColumns}
        open={columnCustomizerOpen}
        onClose={() => setColumnCustomizerOpen(false)}
      />

      <CreateIssueModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateIssue}
        teamMembers={teamMembers}
        columns={columns}
        defaultColumn={createDefaultColumn}
      />
    </div>
  );
}
