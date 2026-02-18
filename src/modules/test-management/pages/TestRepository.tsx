/**
 * Test Repository - Unified Test Management Hub
 * 
 * Features:
 * - Folder-based organization (like file explorer)
 * - Drag-and-drop reorganization
 * - Test Suites for grouped execution
 * - Releases & Sprint cycles
 * - Test Run history
 * - Powerful search & filter
 * 
 * Unified Test Case Approach:
 * - Tests can be Manual or Automated (no specific tool references)
 * - Same test can run in both modes
 * - Track execution across releases
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Folder, FolderOpen, FileText, Plus, Search, ChevronRight, ChevronDown,
  MoreVertical, Play, Edit, Trash2, Copy, Move, FolderPlus,
  GripVertical, Check, X, Filter, SortAsc, Grid, List, RefreshCw,
  Layers, Zap, Clock, CheckCircle, AlertCircle, Tag, Star,
  Download, Upload, FolderTree, Home, ArrowRight, Calendar, Target,
  PlayCircle, Archive, Rocket, Users, BarChart3, Settings, Video, Pencil,
  Bug, Link2, ExternalLink, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';

// Extracted types, components, and utilities
import type {
  TestSuite, Release, Defect, StepResult, TestRun, TestPlan,
  TestFolder, TestCase, TreeNode
} from '../types/test-repository.types';
import { DEFAULT_FOLDERS } from '../types/test-repository.types';
import { TreeItem } from '../components/TreeItem';
import { TestCaseCard } from '../components/TestCaseCard';
import { SuitesTabPanel } from '../components/SuitesTabPanel';
import { ReleasesTabPanel } from '../components/ReleasesTabPanel';
import { DefectsTabPanel } from '../components/DefectsTabPanel';
import { PlansTabPanel } from '../components/PlansTabPanel';
import { RunsTabPanel } from '../components/RunsTabPanel';
import { RepositoryDialogs } from '../components/RepositoryDialogs';
import { mapSuiteFromApi, mapPlanFromApi, mapRunFromApi, mapDefectFromApi } from '../lib/data-mappers';
import { convertStepToExecutorFormat as convertStepToExecutorFormatFn } from '../lib/test-execution';
import { LAZY_BATCH_SIZE, SEARCH_PLACEHOLDERS, buildTabDefinitions } from '../constants/test-repository.constants';
import { calculateAutomationStatus, isApiTest as isApiTestUtil, isElectronApp, sortTestCases, prioritizeTestCases } from '../lib/test-repository-utils';
import { deleteTestCaseFromAllSources, loadAllTestCases, loadRelatedData, runApiTestFromRepository as runApiTestApi } from '../lib/test-repository-api';
import type { ApiRunResult } from '../lib/test-repository-api';

export default function TestRepository() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read tab from URL params
  const tabFromUrl = searchParams.get('tab') as 'repository' | 'suites' | 'plans' | 'releases' | 'runs' | 'defects' | null;
  
  // State
  const [folders, setFolders] = useState<TestFolder[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  
  // Lazy loading state for scale testing (5000+ test cases)
  const [visibleCount, setVisibleCount] = useState(100); // Start with 100, load more on scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allTestCasesLoaded, setAllTestCasesLoaded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [backendSearchResults, setBackendSearchResults] = useState<TestCase[] | null>(null);
  const BATCH_SIZE = LAZY_BATCH_SIZE;
  
  // Filter state for enterprise scale
  const [statusFilter, setStatusFilter] = useState<'all' | 'none' | 'partial' | 'full'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [releaseFilter, setReleaseFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all'); // For load, api, automation tags
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'priority'>('updated');
  
  // Dialogs
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Rename/Delete dialogs
  const [showRenameFolderDialog, setShowRenameFolderDialog] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<TestFolder | null>(null);
  const [newFolderRename, setNewFolderRename] = useState('');
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'folder' | 'test'; node: TreeNode } | null>(null);
  
  // Multi-select state
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // Test Results Dialog
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [selectedRunForResults, setSelectedRunForResults] = useState<TestRun | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  
  // Edit dialogs
  const [editingFolder, setEditingFolder] = useState<TestFolder | null>(null);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [showEditFolderDialog, setShowEditFolderDialog] = useState(false);
  const [showEditSuiteDialog, setShowEditSuiteDialog] = useState(false);
  const [showEditReleaseDialog, setShowEditReleaseDialog] = useState(false);
  const [showEditPlanDialog, setShowEditPlanDialog] = useState(false);
  const [showLinkPlanToReleaseDialog, setShowLinkPlanToReleaseDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [showRunDetailsDialog, setShowRunDetailsDialog] = useState(false);
  const [showCreateRunDialog, setShowCreateRunDialog] = useState(false);
  const [newRunName, setNewRunName] = useState('');
  const [newRunMode, setNewRunMode] = useState<'automated' | 'manual'>('automated');
  const [newRunTestCases, setNewRunTestCases] = useState<string[]>([]);
  const [newRunReleaseId, setNewRunReleaseId] = useState<string>('');
  const [newRunExecutionMode, setNewRunExecutionMode] = useState<'sequential' | 'parallel'>('sequential');
  const [newRunTestSearch, setNewRunTestSearch] = useState('');
  
  // Create dialogs with linking
  const [showCreateSuiteDialog, setShowCreateSuiteDialog] = useState(false);
  const [showCreateReleaseDialog, setShowCreateReleaseDialog] = useState(false);
  const [showCreateTestDialog, setShowCreateTestDialog] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestDescription, setNewTestDescription] = useState('');
  const [newTestPriority, setNewTestPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [newTestFolder, setNewTestFolder] = useState<string>('root');
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDescription, setNewSuiteDescription] = useState('');
  const [newSuiteTestCases, setNewSuiteTestCases] = useState<string[]>([]);
  const [newReleaseName, setNewReleaseName] = useState('');
  const [newReleaseDescription, setNewReleaseDescription] = useState('');
  const [newReleaseSuites, setNewReleaseSuites] = useState<string[]>([]);
  const [newReleaseStartDate, setNewReleaseStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newReleaseEndDate, setNewReleaseEndDate] = useState('');

  // Tab state and data (must be declared before useEffects that use them)
  const [activeTab, setActiveTab] = useState<'repository' | 'suites' | 'plans' | 'releases' | 'runs' | 'defects'>(
    tabFromUrl || 'repository'
  );
  
  // Sync tab with URL parameter
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [executingStepIndex, setExecutingStepIndex] = useState<number>(-1);
  
  // Defect dialogs
  const [showCreateDefectDialog, setShowCreateDefectDialog] = useState(false);
  const [editingDefect, setEditingDefect] = useState<Defect | null>(null);
  const [showEditDefectDialog, setShowEditDefectDialog] = useState(false);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<{
    type: 'test' | 'suite' | 'plan' | 'release' | null;
    data: any;
  }>({ type: null, data: null });
  
  // Track deleted IDs to prevent reloading from backend
  const [deletedTestIds, setDeletedTestIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('deleted_test_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete key - delete selected items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleKeyboardDelete();
      }
      
      // Ctrl+C / Cmd+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleKeyboardCopy();
      }
      
      // Ctrl+V / Cmd+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handleKeyboardPaste();
      }
      
      // Escape - Clear selection
      if (e.key === 'Escape') {
        setSelectedTestIds(new Set());
        setIsMultiSelectMode(false);
        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedTestIds, selectedNode, clipboard, suites, testPlans, releases, defects]);

  // Load data
  useEffect(() => {
    // Load folders
    const savedFolders = localStorage.getItem('test_repository_folders');
    if (savedFolders) {
      setFolders(JSON.parse(savedFolders));
    } else {
      setFolders(DEFAULT_FOLDERS);
      localStorage.setItem('test_repository_folders', JSON.stringify(DEFAULT_FOLDERS));
    }

    // Load test cases from all sources (extracted to lib/test-repository-api.ts)
    const doLoad = async () => {
      const cases = await loadAllTestCases();
      setTestCases(cases);
    };

    doLoad();
    
    // Also reload when triggered by focus or external event
    const handleReload = () => loadAllTestCases();
    window.addEventListener('reload-test-cases', handleReload);
    return () => window.removeEventListener('reload-test-cases', handleReload);
  }, []);

  // Save folders when changed
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem('test_repository_folders', JSON.stringify(folders));
    }
  }, [folders]);

  // Helper to save test cases after user-initiated changes
  // SAFETY: Never saves empty array - prevents data wipes
  const saveTestCases = useCallback((updatedCases: TestCase[]) => {
    if (updatedCases.length === 0) {
      console.warn('[Repository] Refusing to save empty test cases array - preventing data wipe');
      return;
    }
    localStorage.setItem('test_cases', JSON.stringify(updatedCases));
    localStorage.setItem('flowstral_test_cases', JSON.stringify(updatedCases)); // Backup to both keys
    console.log('[Repository] Saved test cases after user change:', updatedCases.length);
  }, []);
  
  // Reload data from localStorage when window gets focus (catches external saves)
  useEffect(() => {
    const handleFocus = async () => {
      console.log('[Repository] Window focused - reloading data');
      // Trigger re-load by re-running the load effect
      window.dispatchEvent(new CustomEvent('reload-test-cases'));
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Build tree structure - FOLDERS ONLY (no test cases in tree)
  const treeData = useMemo(() => {
    const buildTree = (folderId: string, depth: number): TreeNode | null => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return null;

      // Count test cases in this folder for display
      const folderTestCount = testCases.filter(tc => tc.folderId === folder.id).length;

      const folderNode: TreeNode = {
        id: folder.id,
        type: 'folder',
        name: folder.name,
        data: { ...folder, testCount: folderTestCount },
        depth,
        children: []
      };

      // Add child folders ONLY (no test cases in the tree)
      for (const childId of folder.children) {
        const childNode = buildTree(childId, depth + 1);
        if (childNode) {
          folderNode.children!.push(childNode);
        }
      }

      return folderNode;
    };

    return buildTree('root', 0);
  }, [folders, testCases]);

  // Get current folder's content
  const currentFolderContent = useMemo(() => {
    const folder = folders.find(f => f.id === currentFolderId);
    if (!folder) return { subfolders: [], tests: [] };

    const subfolders = folders.filter(f => f.parentId === currentFolderId);
    const tests = testCases.filter(tc => 
      tc.folderId === currentFolderId || 
      (currentFolderId === 'root' && (!tc.folderId || tc.folderId === 'root'))
    );

    return { subfolders, tests };
  }, [folders, testCases, currentFolderId]);

  // Filtered tests (for enterprise scale performance)
  const filteredTests = useMemo(() => {
    let result = currentFolderContent.tests;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(tc => {
        const status = tc.automationStatus || 'none';
        return status === statusFilter || (statusFilter === 'full' && status === 'automated');
      });
    }
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(tc => tc.priority === priorityFilter);
    }
    
    // Apply plan filter - find test cases linked to selected plan
    if (planFilter !== 'all') {
      const selectedPlan = testPlans.find(p => p.id === planFilter);
      if (selectedPlan) {
        const linkedTestIds = new Set(selectedPlan.testCaseIds || []);
        // Also include tests from linked suites
        for (const suiteId of (selectedPlan.suiteIds || [])) {
          const suite = suites.find(s => s.id === suiteId);
          if (suite) {
            suite.testCaseIds.forEach(id => linkedTestIds.add(id));
          }
        }
        result = result.filter(tc => linkedTestIds.has(tc.id));
      }
    }
    
    // Apply release filter - find test cases linked to selected release
    if (releaseFilter !== 'all') {
      const selectedRelease = releases.find(r => r.id === releaseFilter);
      if (selectedRelease) {
        const linkedTestIds = new Set<string>();
        // Get tests from release's suites
        for (const suiteId of (selectedRelease.suiteIds || [])) {
          const suite = suites.find(s => s.id === suiteId);
          if (suite) {
            suite.testCaseIds.forEach(id => linkedTestIds.add(id));
          }
        }
        // Also check plans linked to this release
        const releasePlans = testPlans.filter(p => p.releaseId === selectedRelease.id);
        for (const plan of releasePlans) {
          (plan.testCaseIds || []).forEach(id => linkedTestIds.add(id));
          for (const suiteId of (plan.suiteIds || [])) {
            const suite = suites.find(s => s.id === suiteId);
            if (suite) {
              suite.testCaseIds.forEach(id => linkedTestIds.add(id));
            }
          }
        }
        result = result.filter(tc => linkedTestIds.has(tc.id));
      }
    }
    
    // Apply tag filter (automation, load, api, manual)
    if (tagFilter !== 'all') {
      result = result.filter(tc => {
        const tags = tc.tags || [];
        // Check if test has the specific tag
        if (tags.includes(tagFilter)) return true;
        // For 'manual' tag, include tests without any automation-related tags
        if (tagFilter === 'manual' && !tags.includes('automation') && !tags.includes('load') && !tags.includes('api')) {
          return true;
        }
        return false;
      });
    }
    
    // Apply sorting (extracted to lib/test-repository-utils.ts)
    return sortTestCases(result, sortBy);
  }, [currentFolderContent.tests, statusFilter, priorityFilter, planFilter, releaseFilter, tagFilter, sortBy, testPlans, releases, suites]);
  
  // Prioritized sort: newest first, then by priority (extracted to lib/test-repository-utils.ts)
  const prioritizedTests = useMemo(() => prioritizeTestCases(filteredTests), [filteredTests]);
  
  // Lazy loaded tests for rendering (first visibleCount tests)
  const displayedTests = useMemo(() => {
    return prioritizedTests.slice(0, visibleCount);
  }, [prioritizedTests, visibleCount]);
  
  const hasMoreToLoad = visibleCount < prioritizedTests.length;
  
  // Load more tests handler
  const loadMoreTests = useCallback(() => {
    if (isLoadingMore || !hasMoreToLoad) return;
    
    setIsLoadingMore(true);
    // Simulate async loading delay for smooth UX
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, prioritizedTests.length));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, hasMoreToLoad, prioritizedTests.length]);
  
  // Reset visible count when filters or folder changes
  useEffect(() => {
    setVisibleCount(100);
  }, [currentFolderId, statusFilter, priorityFilter]);

  // Context-aware search - searches based on active tab
  const [searchResultsData, setSearchResultsData] = useState<{
    testCases: TestCase[];
    suites: TestSuite[];
    plans: TestPlan[];
    releases: Release[];
  } | null>(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResultsData(null);
      return;
    }
    
    // Debounce search
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const term = searchTerm.toLowerCase();
        
        // Search test cases
        const tcResults = testCases.filter(tc => 
          tc.name.toLowerCase().includes(term) ||
          tc.description?.toLowerCase().includes(term) ||
          tc.tags?.some(t => t.toLowerCase().includes(term))
        );
        
        // Search suites
        const suiteResults = suites.filter(s =>
          s.name.toLowerCase().includes(term) ||
          s.description?.toLowerCase().includes(term)
        );
        
        // Search plans
        const planResults = testPlans.filter(p =>
          p.name.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
        );
        
        // Search releases
        const releaseResults = releases.filter(r =>
          r.name.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term) ||
          r.version?.toLowerCase().includes(term)
        );
        
        console.log(`[Repository] Search "${term}": ${tcResults.length} tests, ${suiteResults.length} suites, ${planResults.length} plans, ${releaseResults.length} releases`);
        
        setSearchResultsData({
          testCases: tcResults,
          suites: suiteResults,
          plans: planResults,
          releases: releaseResults
        });
      } catch (e) {
        console.error('[Repository] Search error:', e);
      } finally {
        setSearchLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [searchTerm, testCases, suites, testPlans, releases]);

  // Get search results for current tab
  const searchResults = useMemo(() => {
    if (!searchResultsData) return null;
    if (activeTab === 'repository') return searchResultsData.testCases;
    return searchResultsData.testCases; // Default to test cases
  }, [searchResultsData, activeTab]);
  
  // Search results for each tab
  const filteredSuites = useMemo(() => {
    if (searchResultsData && searchTerm.trim()) return searchResultsData.suites;
    return suites;
  }, [suites, searchResultsData, searchTerm]);
  
  const filteredPlans = useMemo(() => {
    if (searchResultsData && searchTerm.trim()) return searchResultsData.plans;
    return testPlans;
  }, [testPlans, searchResultsData, searchTerm]);
  
  const filteredReleases = useMemo(() => {
    if (searchResultsData && searchTerm.trim()) return searchResultsData.releases;
    return releases;
  }, [releases, searchResultsData, searchTerm]);

  // Breadcrumb path
  const breadcrumbPath = useMemo(() => {
    const path: TestFolder[] = [];
    let current = folders.find(f => f.id === currentFolderId);
    
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current!.parentId) : undefined;
    }
    
    return path;
  }, [folders, currentFolderId]);

  // Handlers
  const handleToggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node);
    if (node.type === 'folder') {
      setCurrentFolderId(node.id);
      setExpandedFolders(prev => new Set([...prev, node.id]));
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetNode: TreeNode) => {
    e.preventDefault();
    
    if (!draggedNode || draggedNode.id === targetNode.id) return;
    
    // Can only drop into folders
    if (targetNode.type !== 'folder') return;
    
    if (draggedNode.type === 'test') {
      // Move test case to new folder
      setTestCases(prev => prev.map(tc => 
        tc.id === draggedNode.id ? { ...tc, folderId: targetNode.id } : tc
      ));
      toast.success(`Moved "${draggedNode.name}" to "${targetNode.name}"`);
    } else {
      // Move folder (update parent)
      setFolders(prev => {
        const updated = [...prev];
        const draggedFolder = updated.find(f => f.id === draggedNode.id);
        const targetFolder = updated.find(f => f.id === targetNode.id);
        const oldParent = updated.find(f => f.id === draggedFolder?.parentId);
        
        if (draggedFolder && targetFolder) {
          // Remove from old parent
          if (oldParent) {
            oldParent.children = oldParent.children.filter(id => id !== draggedNode.id);
          }
          // Add to new parent
          targetFolder.children.push(draggedNode.id);
          draggedFolder.parentId = targetNode.id;
        }
        
        return updated;
      });
      toast.success(`Moved "${draggedNode.name}" to "${targetNode.name}"`);
    }
    
    setDraggedNode(null);
  }, [draggedNode]);

  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    
    const newFolder: TestFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      parentId: currentFolderId,
      children: [],
      testCases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setFolders(prev => {
      const updated = [...prev, newFolder];
      // Add to parent's children
      const parent = updated.find(f => f.id === currentFolderId);
      if (parent) {
        parent.children.push(newFolder.id);
      }
      return updated;
    });
    
    setNewFolderName('');
    setShowNewFolderDialog(false);
    toast.success(`Created folder "${newFolder.name}"`);
  }, [newFolderName, currentFolderId]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    if (!confirm('Delete this folder and move all tests to parent?')) return;
    
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    // Move tests to parent
    setTestCases(prev => prev.map(tc => 
      tc.folderId === folderId ? { ...tc, folderId: folder.parentId || 'root' } : tc
    ));
    
    // Remove folder
    setFolders(prev => {
      const updated = prev.filter(f => f.id !== folderId);
      const parent = updated.find(f => f.id === folder.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== folderId);
      }
      return updated;
    });
    
    toast.success('Folder deleted');
  }, [folders]);

  const handleStarTest = useCallback((testId: string) => {
    setTestCases(prev => prev.map(tc => 
      tc.id === testId ? { ...tc, starred: !tc.starred } : tc
    ));
  }, []);

  // Run test - Shows dialog to add to run or create new run
  const [showRunTestDialog, setShowRunTestDialog] = useState(false);
  const [testCaseToRun, setTestCaseToRun] = useState<TestCase | null>(null);
  const [apiRunResult, setApiRunResult] = useState<{ passed: boolean; message: string; detail?: string } | null>(null);

  const isApiTest = useCallback((tc: TestCase) => isApiTestUtil(tc), []);

  const handleRunTest = useCallback((testCase: TestCase) => {
    setTestCaseToRun(testCase);
    setApiRunResult(null);
    setShowRunTestDialog(true);
  }, []);

  const runApiTestFromRepository = useCallback(async (tc: TestCase): Promise<{ passed: boolean; message: string }> => {
    const result = await runApiTestApi(tc);
    setApiRunResult(result);
    if (result.passed) toast.success(result.message); else toast.error(result.message);
    return { passed: result.passed, message: result.message };
  }, []);

  // Edit test steps in builder
  const handleEditTest = useCallback((testCase: TestCase) => {
    navigate(`/test-cases/builder?testCaseId=${testCase.id}`);
  }, [navigate]);

  // Edit test case configuration (name, priority, folder, etc.)
  const [showEditTestConfigDialog, setShowEditTestConfigDialog] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  
  const handleEditTestConfig = useCallback((testCase: TestCase) => {
    setEditingTestCase({ ...testCase });
    setShowEditTestConfigDialog(true);
  }, []);

  // Rename folder handler
  const handleRenameFolder = useCallback((folder: TestFolder) => {
    setRenamingFolder(folder);
    setNewFolderRename(folder.name);
    setShowRenameFolderDialog(true);
  }, []);

  const handleSaveFolderRename = useCallback(() => {
    if (!renamingFolder || !newFolderRename.trim()) return;
    setFolders(prev => {
      const updated = prev.map(f => 
        f.id === renamingFolder.id 
          ? { ...f, name: newFolderRename.trim(), updatedAt: new Date().toISOString() } 
          : f
      );
      localStorage.setItem('test_folders', JSON.stringify(updated));
      return updated;
    });
    setShowRenameFolderDialog(false);
    setRenamingFolder(null);
    setNewFolderRename('');
    toast.success('Folder renamed');
  }, [renamingFolder, newFolderRename]);

  // Delete confirmation handlers
  const handleDeleteFolderConfirm = useCallback((node: TreeNode) => {
    setDeletingItem({ type: 'folder', node });
    setShowDeleteConfirmDialog(true);
  }, []);

  const handleDeleteTestConfirm = useCallback((node: TreeNode) => {
    setDeletingItem({ type: 'test', node });
    setShowDeleteConfirmDialog(true);
  }, []);

  // Helper function to delete a test case from all sources (extracted to lib/test-repository-api.ts)

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingItem) return;
    
    if (deletingItem.type === 'folder') {
      const folderId = deletingItem.node.id;
      // Move tests in this folder back to root
      setTestCases(prev => {
        const updated = prev.map(tc => 
          tc.folderId === folderId ? { ...tc, folderId: null } : tc
        );
        localStorage.setItem('test_cases', JSON.stringify(updated));
        return updated;
      });
      // Delete the folder
      setFolders(prev => {
        const updated = prev.filter(f => f.id !== folderId);
        localStorage.setItem('test_folders', JSON.stringify(updated));
        return updated;
      });
      toast.success('Folder deleted. Tests moved to root.');
    } else {
      const testId = deletingItem.node.id;
      
      // Delete from all sources (backend, electron, localStorage entries)
      await deleteTestCaseFromAllSources(testId);
      
      // Update local state and test_cases localStorage
      setTestCases(prev => {
        const updated = prev.filter(tc => tc.id !== testId);
        localStorage.setItem('test_cases', JSON.stringify(updated));
        return updated;
      });
      
      // Track deleted ID to prevent reloading from any source
      setDeletedTestIds(prev => {
        const updated = new Set([...prev, testId]);
        localStorage.setItem('deleted_test_ids', JSON.stringify([...updated]));
        return updated;
      });
      
      toast.success('Test case deleted');
    }
    
    setShowDeleteConfirmDialog(false);
    setDeletingItem(null);
  }, [deletingItem, deleteTestCaseFromAllSources]);

  // Duplicate test handler
  const handleDuplicateTest = useCallback((node: TreeNode) => {
    const testCase = node.data as TestCase;
    const newTest: TestCase = {
      ...testCase,
      id: `tc_${Date.now()}`,
      name: `${testCase.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTestCases(prev => {
      const updated = [...prev, newTest];
      localStorage.setItem('test_cases', JSON.stringify(updated));
      return updated;
    });
    toast.success('Test case duplicated');
  }, []);

  // Rename test handler
  const handleRenameTest = useCallback((node: TreeNode) => {
    const testCase = node.data as TestCase;
    const newName = prompt('Enter new test name:', testCase.name);
    if (newName && newName.trim() && newName !== testCase.name) {
      setTestCases(prev => {
        const updated = prev.map(tc => 
          tc.id === testCase.id 
            ? { ...tc, name: newName.trim(), updatedAt: new Date().toISOString() } 
            : tc
        );
        localStorage.setItem('test_cases', JSON.stringify(updated));
        return updated;
      });
      toast.success('Test renamed');
    }
  }, []);

  // TreeItem context menu handlers
  const handleTreeItemRename = useCallback((node: TreeNode) => {
    if (node.type === 'folder') {
      handleRenameFolder(node.data as TestFolder);
    } else {
      handleRenameTest(node);
    }
  }, [handleRenameFolder, handleRenameTest]);

  const handleTreeItemDelete = useCallback((node: TreeNode) => {
    if (node.type === 'folder') {
      handleDeleteFolderConfirm(node);
    } else {
      handleDeleteTestConfirm(node);
    }
  }, [handleDeleteFolderConfirm, handleDeleteTestConfirm]);

  // Multi-select handlers
  const toggleTestSelection = useCallback((testId: string, e?: React.MouseEvent) => {
    if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
      setSelectedTestIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(testId)) {
          newSet.delete(testId);
        } else {
          newSet.add(testId);
        }
        return newSet;
      });
      setIsMultiSelectMode(true);
    }
  }, []);

  const handleBulkMoveToFolder = useCallback((folderId: string | null) => {
    if (selectedTestIds.size === 0) return;
    
    setTestCases(prev => {
      const updated = prev.map(tc => 
        selectedTestIds.has(tc.id) ? { ...tc, folderId } : tc
      );
      localStorage.setItem('test_cases', JSON.stringify(updated));
      return updated;
    });
    
    const folderName = folderId 
      ? folders.find(f => f.id === folderId)?.name || 'folder'
      : 'root';
    toast.success(`${selectedTestIds.size} tests moved to ${folderName}`);
    setSelectedTestIds(new Set());
    setIsMultiSelectMode(false);
  }, [selectedTestIds, folders]);

  const clearSelection = useCallback(() => {
    setSelectedTestIds(new Set());
    setIsMultiSelectMode(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS HANDLERS (Delete, Ctrl+C, Ctrl+V)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleKeyboardDelete = useCallback(async () => {
    if (activeTab === 'repository') {
      // Delete selected test cases
      if (selectedTestIds.size > 0) {
        if (!confirm(`Delete ${selectedTestIds.size} selected test case(s)?`)) return;
        const idsToDelete = Array.from(selectedTestIds);
        
        // Delete from all sources (backend, electron, localStorage entries)
        for (const testId of idsToDelete) {
          await deleteTestCaseFromAllSources(testId);
        }
        
        setTestCases(prev => {
          const updated = prev.filter(tc => !selectedTestIds.has(tc.id));
          localStorage.setItem('test_cases', JSON.stringify(updated));
          return updated;
        });
        // Track deleted IDs to prevent reloading
        setDeletedTestIds(prev => {
          const updated = new Set([...prev, ...idsToDelete]);
          localStorage.setItem('deleted_test_ids', JSON.stringify([...updated]));
          return updated;
        });
        toast.success(`${idsToDelete.length} test case(s) deleted`);
        setSelectedTestIds(new Set());
        setIsMultiSelectMode(false);
      } else if (selectedNode?.type === 'test') {
        if (!confirm(`Delete test case "${selectedNode.name}"?`)) return;
        const testId = selectedNode.id;
        
        // Delete from all sources (backend, electron, localStorage entries)
        await deleteTestCaseFromAllSources(testId);
        
        setTestCases(prev => {
          const updated = prev.filter(tc => tc.id !== testId);
          localStorage.setItem('test_cases', JSON.stringify(updated));
          return updated;
        });
        setDeletedTestIds(prev => {
          const updated = new Set([...prev, testId]);
          localStorage.setItem('deleted_test_ids', JSON.stringify([...updated]));
          return updated;
        });
        toast.success('Test case deleted');
        setSelectedNode(null);
      }
    } else if (activeTab === 'suites' && selectedNode) {
      handleDeleteSuite(selectedNode.id);
    } else if (activeTab === 'releases' && selectedNode) {
      handleDeleteRelease(selectedNode.id);
    } else if (activeTab === 'runs' && selectedNode) {
      handleDeleteRun(selectedNode.id);
    } else if (activeTab === 'defects' && selectedNode) {
      if (!confirm('Delete this defect?')) return;
      setDefects(prev => {
        const updated = prev.filter(d => d.id !== selectedNode.id);
        localStorage.setItem('test_defects', JSON.stringify(updated));
        return updated;
      });
      setSelectedNode(null);
      toast.success('Defect deleted');
    }
  }, [activeTab, selectedTestIds, selectedNode, defects, deleteTestCaseFromAllSources]);

  const handleKeyboardCopy = useCallback(() => {
    if (activeTab === 'repository') {
      if (selectedTestIds.size > 0) {
        // Copy multiple test cases
        const testsToCopy = testCases.filter(tc => selectedTestIds.has(tc.id));
        setClipboard({ type: 'test', data: testsToCopy });
        toast.success(`${testsToCopy.length} test case(s) copied to clipboard`);
      } else if (selectedNode?.type === 'test') {
        setClipboard({ type: 'test', data: [selectedNode.data] });
        toast.success('Test case copied to clipboard');
      }
    } else if (activeTab === 'suites') {
      const selectedSuite = suites.find(s => s.id === selectedNode?.id);
      if (selectedSuite) {
        setClipboard({ type: 'suite', data: selectedSuite });
        toast.success('Suite copied to clipboard');
      }
    } else if (activeTab === 'plans') {
      const selectedPlan = testPlans.find(p => p.id === selectedNode?.id);
      if (selectedPlan) {
        setClipboard({ type: 'plan', data: selectedPlan });
        toast.success('Plan copied to clipboard');
      }
    } else if (activeTab === 'releases') {
      const selectedRelease = releases.find(r => r.id === selectedNode?.id);
      if (selectedRelease) {
        setClipboard({ type: 'release', data: selectedRelease });
        toast.success('Release copied to clipboard');
      }
    } else if (activeTab === 'defects') {
      const selectedDefect = defects.find(d => d.id === selectedNode?.id);
      if (selectedDefect) {
        setClipboard({ type: 'defect', data: selectedDefect });
        toast.success('Defect copied to clipboard');
      }
    }
  }, [activeTab, selectedTestIds, selectedNode, testCases, suites, testPlans, releases, defects]);

  const handleKeyboardPaste = useCallback(() => {
    if (!clipboard.type || !clipboard.data) {
      toast.error('Nothing to paste');
      return;
    }

    const timestamp = Date.now();
    
    if (clipboard.type === 'test' && activeTab === 'repository') {
      const testsToCreate = Array.isArray(clipboard.data) ? clipboard.data : [clipboard.data];
      const newTests = testsToCreate.map((tc: TestCase, idx: number) => ({
        ...tc,
        id: `tc_${timestamp}_${idx}`,
        name: `${tc.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        folderId: currentFolderId === 'root' ? null : currentFolderId,
      }));
      setTestCases(prev => {
        const updated = [...prev, ...newTests];
        localStorage.setItem('test_cases', JSON.stringify(updated));
        return updated;
      });
      toast.success(`${newTests.length} test case(s) pasted`);
    } else if (clipboard.type === 'suite' && activeTab === 'suites') {
      const newSuite: TestSuite = {
        ...clipboard.data,
        id: `suite_${timestamp}`,
        name: `${clipboard.data.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      setSuites(prev => {
        const updated = [...prev, newSuite];
        localStorage.setItem('test_suites', JSON.stringify(updated));
        return updated;
      });
      toast.success('Suite pasted');
    } else if (clipboard.type === 'plan' && activeTab === 'plans') {
      const newPlan: TestPlan = {
        ...clipboard.data,
        id: `plan_${timestamp}`,
        name: `${clipboard.data.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      setTestPlans(prev => {
        const updated = [...prev, newPlan];
        localStorage.setItem('test_plans', JSON.stringify(updated));
        return updated;
      });
      toast.success('Plan pasted');
    } else if (clipboard.type === 'release' && activeTab === 'releases') {
      const newRelease: Release = {
        ...clipboard.data,
        id: `release_${timestamp}`,
        name: `${clipboard.data.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      setReleases(prev => {
        const updated = [...prev, newRelease];
        localStorage.setItem('test_releases', JSON.stringify(updated));
        return updated;
      });
      toast.success('Release pasted');
    } else if (clipboard.type === 'defect' && activeTab === 'defects') {
      const newDefect: Defect = {
        ...clipboard.data,
        id: `DEF-${timestamp.toString(36).toUpperCase()}`,
        title: `${clipboard.data.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDefects(prev => {
        const updated = [...prev, newDefect];
        localStorage.setItem('test_defects', JSON.stringify(updated));
        return updated;
      });
      toast.success('Defect pasted');
    } else {
      toast.info(`Cannot paste ${clipboard.type} in ${activeTab} tab`);
    }
  }, [clipboard, activeTab, currentFolderId]);

  // Suite handlers
  const handleEditSuite = useCallback((suite: TestSuite) => {
    setEditingSuite(suite);
    setShowEditSuiteDialog(true);
  }, []);

  const handleSaveSuite = useCallback(() => {
    if (!editingSuite) return;
    setSuites(prev => {
      const updated = prev.map(s => s.id === editingSuite.id ? editingSuite : s);
      localStorage.setItem('test_suites', JSON.stringify(updated));
      return updated;
    });
    setShowEditSuiteDialog(false);
    setEditingSuite(null);
    toast.success('Suite updated');
  }, [editingSuite]);

  const handleDeleteSuite = useCallback((suiteId: string) => {
    if (!confirm('Are you sure you want to delete this suite?')) return;
    setSuites(prev => {
      const updated = prev.filter(s => s.id !== suiteId);
      localStorage.setItem('test_suites', JSON.stringify(updated));
      return updated;
    });
    toast.success('Suite deleted');
  }, []);

  // Release handlers
  const handleEditRelease = useCallback((release: Release) => {
    setEditingRelease(release);
    setShowEditReleaseDialog(true);
  }, []);

  const handleSaveRelease = useCallback(() => {
    if (!editingRelease) return;
    setReleases(prev => {
      const updated = prev.map(r => r.id === editingRelease.id ? editingRelease : r);
      localStorage.setItem('test_releases', JSON.stringify(updated));
      return updated;
    });
    setShowEditReleaseDialog(false);
    setEditingRelease(null);
    toast.success('Release updated');
  }, [editingRelease]);

  const handleDeleteRelease = useCallback((releaseId: string) => {
    if (!confirm('Are you sure you want to delete this release?')) return;
    setReleases(prev => {
      const updated = prev.filter(r => r.id !== releaseId);
      localStorage.setItem('test_releases', JSON.stringify(updated));
      return updated;
    });
    toast.success('Release deleted');
  }, []);

  // Test Run handlers
  const handleDeleteRun = useCallback((runId: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return;
    setTestRuns(prev => {
      const updated = prev.filter(r => r.id !== runId);
      localStorage.setItem('test_execution_history', JSON.stringify(updated));
      return updated;
    });
    toast.success('Run deleted');
  }, []);

  // Folder edit handler
  const handleEditFolder = useCallback((folder: TestFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setShowEditFolderDialog(true);
  }, []);

  const handleSaveFolder = useCallback(() => {
    if (!editingFolder || !newFolderName.trim()) return;
    setFolders(prev => {
      const updated = prev.map(f => 
        f.id === editingFolder.id ? { ...f, name: newFolderName.trim(), updatedAt: new Date().toISOString() } : f
      );
      localStorage.setItem('test_repository_folders', JSON.stringify(updated));
      return updated;
    });
    setShowEditFolderDialog(false);
    setEditingFolder(null);
    setNewFolderName('');
    toast.success('Folder renamed');
  }, [editingFolder, newFolderName]);

  // Create Suite with test case linking
  const handleCreateSuite = useCallback(() => {
    if (!newSuiteName.trim()) {
      toast.error('Suite name is required');
      return;
    }
    const newSuite: TestSuite = {
      id: `suite_${Date.now()}`,
      name: newSuiteName.trim(),
      description: newSuiteDescription,
      testCaseIds: newSuiteTestCases,
      createdAt: new Date().toISOString()
    };
    setSuites(prev => {
      const updated = [...prev, newSuite];
      localStorage.setItem('test_suites', JSON.stringify(updated));
      return updated;
    });
    setShowCreateSuiteDialog(false);
    setNewSuiteName('');
    setNewSuiteDescription('');
    setNewSuiteTestCases([]);
    toast.success(`Suite "${newSuite.name}" created with ${newSuiteTestCases.length} test cases`);
  }, [newSuiteName, newSuiteDescription, newSuiteTestCases]);

  // Create Release with suite linking
  const handleCreateRelease = useCallback(() => {
    if (!newReleaseName.trim()) {
      toast.error('Release name is required');
      return;
    }
    const newRelease: Release = {
      id: `release_${Date.now()}`,
      name: newReleaseName.trim(),
      description: newReleaseDescription,
      startDate: newReleaseStartDate,
      endDate: newReleaseEndDate || undefined,
      status: 'planning',
      suiteIds: newReleaseSuites,
      createdAt: new Date().toISOString()
    };
    setReleases(prev => {
      const updated = [...prev, newRelease];
      localStorage.setItem('test_releases', JSON.stringify(updated));
      return updated;
    });
    setShowCreateReleaseDialog(false);
    setNewReleaseName('');
    setNewReleaseDescription('');
    setNewReleaseSuites([]);
    setNewReleaseStartDate(new Date().toISOString().split('T')[0]);
    setNewReleaseEndDate('');
    toast.success(`Release "${newRelease.name}" created with ${newReleaseSuites.length} suites`);
  }, [newReleaseName, newReleaseDescription, newReleaseStartDate, newReleaseEndDate, newReleaseSuites]);

  // Check if running in Electron desktop app (extracted to lib/test-repository-utils.ts)
  const isElectron = useCallback(() => isElectronApp(), []);

  // Step conversion from Builder format to Executor format (imported utility)
  const convertStepToExecutorFormat = useCallback(convertStepToExecutorFormatFn, []);

  // Direct test execution for Electron (runs without builder)
  const executeTestDirectly = useCallback(async (testCaseId: string, runId: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.testRunner?.executeTest) {
      toast.error('Direct execution only available in desktop app');
      return false;
    }
    
    // Find the test case
    const testCase = testCases.find(tc => tc.id === testCaseId);
    if (!testCase) {
      toast.error('Test case not found');
      return false;
    }

    // API tests: run via backend, not Playwright
    if (isApiTest(testCase)) {
      setExecutingRunId(runId);
      setTestRuns(prev => prev.map(r => r.id === runId ? { ...r, status: 'running' as const, startTime: new Date().toISOString() } : r));
      try {
        const { passed } = await runApiTestFromRepository(testCase);
        const stepName = `${(testCase.unified_data?.method || 'GET')} ${testCase.unified_data?.endpoint || testCase.unified_data?.path || ''}`;
        setTestRuns(prev => {
          const updated = prev.map(r =>
            r.id === runId
              ? {
                  ...r,
                  status: passed ? 'passed' : 'failed',
                  stepResults: [{ stepIndex: 0, stepName, status: passed ? 'passed' : 'failed', timestamp: new Date().toISOString() }],
                }
              : r
          );
          localStorage.setItem('test_execution_history', JSON.stringify(updated));
          return updated;
        });
      } catch (e) {
        setTestRuns(prev => {
          const updated = prev.map(r => r.id === runId ? { ...r, status: 'failed' as const } : r);
          localStorage.setItem('test_execution_history', JSON.stringify(updated));
          return updated;
        });
        toast.error('API test execution failed');
      }
      setExecutingRunId(null);
      return true;
    }
    
    // Use unified_data.steps if available (has full qword/args), otherwise fall back to steps
    const rawSteps = testCase.unified_data?.steps || testCase.steps || [];
    
    if (!rawSteps || rawSteps.length === 0) {
      toast.error('Test case has no steps to execute');
      return false;
    }
    
    console.log('[Run] Found test case:', testCase.name, 'with', rawSteps.length, 'steps');
    console.log('[Run] Using unified_data.steps:', !!testCase.unified_data?.steps);
    
    setExecutingRunId(runId);
    setExecutingStepIndex(0);
    
    // Track step results during execution
    const stepResultsMap: Map<number, StepResult> = new Map();
    const executionLogs: string[] = [];
    
    // Initialize step results
    const convertedSteps = rawSteps.map(convertStepToExecutorFormat);
    convertedSteps.forEach((step, idx) => {
      stepResultsMap.set(idx, {
        stepIndex: idx,
        stepName: step.description || step.name || `Step ${idx + 1}`,
        status: 'skipped',
        timestamp: new Date().toISOString()
      });
    });
    
    // Update run status to running with initial step results
    setTestRuns(prev => {
      const updated = prev.map(r => 
        r.id === runId ? { 
          ...r, 
          status: 'running' as const, 
          startTime: new Date().toISOString(),
          stepResults: Array.from(stepResultsMap.values())
        } : r
      );
      localStorage.setItem('test_execution_history', JSON.stringify(updated));
      return updated;
    });
    
    try {
      // Set up event listeners for progress
      const unsubStepStart = electronAPI.on?.('test-step-start', ({ index, step }: { index: number; step: any }) => {
        setExecutingStepIndex(index);
        executionLogs.push(`[${new Date().toISOString()}] Starting step ${index + 1}: ${step?.description || step?.qword || 'Unknown'}`);
        
        // Update step status to running
        const existingResult = stepResultsMap.get(index);
        if (existingResult) {
          stepResultsMap.set(index, { ...existingResult, status: 'running' });
          // Update run with current progress
          setTestRuns(prev => prev.map(r => 
            r.id === runId ? { ...r, stepResults: Array.from(stepResultsMap.values()), logs: [...executionLogs] } : r
          ));
        }
      });
      
      const unsubStepComplete = electronAPI.on?.('test-step-complete', ({ index, step, result }: any) => {
        console.log(`[Run] Step ${index + 1} completed:`, result?.status);
        const stepName = step?.description || step?.name || step?.qword || `Step ${index + 1}`;
        executionLogs.push(`[${new Date().toISOString()}] Step ${index + 1} ${result?.status}: ${stepName}`);
        
        // Update step result
        stepResultsMap.set(index, {
          stepIndex: index,
          stepName: stepName,
          status: result?.status || 'failed',
          duration: result?.duration,
          error: result?.error,
          screenshot: result?.screenshot,
          timestamp: new Date().toISOString()
        });
        
        // Update run with current progress
        setTestRuns(prev => prev.map(r => 
          r.id === runId ? { ...r, stepResults: Array.from(stepResultsMap.values()), logs: [...executionLogs] } : r
        ));
      });
      
      console.log('[Run] Converted steps:', convertedSteps.length);
      
      // Execute the test with screenshot capture option
      const testData = {
        id: testCase.id,
        name: testCase.name,
        steps: convertedSteps,
        settings: { 
          timeout: 30000,
          captureScreenshots: true,
          screenshotOnError: true
        }
      };
      
      console.log('[Run] Executing test directly:', testData.name, 'with', testData.steps.length, 'steps');
      const results = await electronAPI.testRunner.executeTest(testData);
      
      // Clean up event listeners
      unsubStepStart?.();
      unsubStepComplete?.();
      
      // Process final results from executor
      if (results.steps) {
        results.steps.forEach((stepResult: any, idx: number) => {
          const existingResult = stepResultsMap.get(idx);
          stepResultsMap.set(idx, {
            stepIndex: idx,
            stepName: existingResult?.stepName || stepResult.name || `Step ${idx + 1}`,
            status: stepResult.status || 'failed',
            duration: stepResult.duration,
            error: stepResult.error,
            screenshot: stepResult.screenshot,
            timestamp: new Date().toISOString()
          });
        });
      }
      
      // Calculate final stats
      const finalStepResults = Array.from(stepResultsMap.values());
      const passed = finalStepResults.filter(s => s.status === 'passed').length;
      const failed = finalStepResults.filter(s => s.status === 'failed').length;
      const skipped = finalStepResults.filter(s => s.status === 'skipped').length;
      
      // Find first failed step for error message
      const firstFailedStep = finalStepResults.find(s => s.status === 'failed');
      
      executionLogs.push(`[${new Date().toISOString()}] Test ${results.status}: ${passed} passed, ${failed} failed, ${skipped} skipped`);
      
      // Update run with final results
      setTestRuns(prev => {
        const updated = prev.map(r => 
          r.id === runId ? { 
            ...r, 
            status: results.status === 'passed' ? 'passed' as const : 'failed' as const,
            endTime: new Date().toISOString(),
            results: { passed, failed, skipped },
            stepResults: finalStepResults,
            logs: executionLogs,
            errorMessage: firstFailedStep?.error || (results.status !== 'passed' ? 'Test execution failed' : undefined),
            failedStep: firstFailedStep?.stepIndex
          } : r
        );
        localStorage.setItem('test_execution_history', JSON.stringify(updated));
        return updated;
      });
      
      toast.success(`Test ${results.status}: ${passed} passed, ${failed} failed`);
      return results.status === 'passed';
      
    } catch (error: any) {
      console.error('[Run] Execution error:', error);
      executionLogs.push(`[${new Date().toISOString()}] ERROR: ${error.message}`);
      
      setTestRuns(prev => {
        const updated = prev.map(r => 
          r.id === runId ? { 
            ...r, 
            status: 'failed' as const, 
            endTime: new Date().toISOString(),
            stepResults: Array.from(stepResultsMap.values()),
            logs: executionLogs,
            errorMessage: error.message
          } : r
        );
        localStorage.setItem('test_execution_history', JSON.stringify(updated));
        return updated;
      });
      toast.error(`Execution failed: ${error.message}`);
      return false;
    } finally {
      setExecutingRunId(null);
      setExecutingStepIndex(-1);
    }
  }, [testCases, convertStepToExecutorFormat]);

  // Execute multiple tests (sequential or parallel)
  const executeMultipleTests = useCallback(async (
    testCaseIds: string[], 
    runId: string, 
    executionMode: 'sequential' | 'parallel' = 'sequential'
  ) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.testRunner?.executeTest) {
      toast.error('Direct execution only available in desktop app');
      return false;
    }

    if (testCaseIds.length === 0) {
      toast.error('No test cases to execute');
      return false;
    }

    console.log(`[Run] Executing ${testCaseIds.length} tests in ${executionMode} mode`);
    setExecutingRunId(runId);

    // Initialize test results
    const testResultsInit = testCaseIds.map(id => {
      const tc = testCases.find(t => t.id === id);
      return {
        testCaseId: id,
        testName: tc?.name || 'Unknown Test',
        status: 'pending' as const,
        stepResults: [],
        duration: 0
      };
    });

    // Update run status to running
    setTestRuns(prev => {
      const updated = prev.map(r => 
        r.id === runId ? { 
          ...r, 
          status: 'running' as const, 
          startTime: new Date().toISOString(),
          testResults: testResultsInit,
          currentTestIndex: 0
        } : r
      );
      localStorage.setItem('test_execution_history', JSON.stringify(updated));
      return updated;
    });

    const executionLogs: string[] = [];
    let allPassed = true;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    try {
      if (executionMode === 'sequential') {
        // Execute tests one by one
        for (let i = 0; i < testCaseIds.length; i++) {
          const testCaseId = testCaseIds[i];
          const testCase = testCases.find(tc => tc.id === testCaseId);
          
          if (!testCase) {
            executionLogs.push(`[${new Date().toISOString()}] SKIPPED: Test ${testCaseId} not found`);
            totalSkipped++;
            continue;
          }

          executionLogs.push(`[${new Date().toISOString()}] Starting test ${i + 1}/${testCaseIds.length}: ${testCase.name}`);
          
          // Update current test index
          setTestRuns(prev => prev.map(r => 
            r.id === runId ? { ...r, currentTestIndex: i, logs: [...executionLogs] } : r
          ));

          const rawSteps = testCase.unified_data?.steps || testCase.steps || [];
          if (rawSteps.length === 0) {
            executionLogs.push(`[${new Date().toISOString()}] SKIPPED: ${testCase.name} has no steps`);
            totalSkipped++;
            continue;
          }

          const convertedSteps = rawSteps.map(convertStepToExecutorFormat);
          const testData = {
            id: testCase.id,
            name: testCase.name,
            steps: convertedSteps,
            settings: { timeout: 30000, captureScreenshots: true, screenshotOnError: true }
          };

          // Update test status to running
          setTestRuns(prev => prev.map(r => {
            if (r.id !== runId) return r;
            const testResults = [...(r.testResults || [])];
            if (testResults[i]) testResults[i] = { ...testResults[i], status: 'running' };
            return { ...r, testResults };
          }));

          try {
            const startTime = Date.now();
            const results = await electronAPI.testRunner.executeTest(testData);
            const duration = Date.now() - startTime;

            const stepResults: StepResult[] = (results.steps || []).map((s: any, idx: number) => ({
              stepIndex: idx,
              stepName: s.name || convertedSteps[idx]?.description || `Step ${idx + 1}`,
              status: s.status || 'failed',
              duration: s.duration,
              error: s.error,
              screenshot: s.screenshot
            }));

            const passed = stepResults.filter(s => s.status === 'passed').length;
            const failed = stepResults.filter(s => s.status === 'failed').length;
            
            if (results.status === 'passed') {
              totalPassed++;
              executionLogs.push(`[${new Date().toISOString()}] ✓ PASSED: ${testCase.name} (${passed}/${stepResults.length} steps)`);
            } else {
              totalFailed++;
              allPassed = false;
              executionLogs.push(`[${new Date().toISOString()}] ✗ FAILED: ${testCase.name} - ${results.error || 'Unknown error'}`);
            }

            // Update test result
            setTestRuns(prev => prev.map(r => {
              if (r.id !== runId) return r;
              const testResults = [...(r.testResults || [])];
              if (testResults[i]) {
                testResults[i] = {
                  ...testResults[i],
                  status: results.status === 'passed' ? 'passed' : 'failed',
                  stepResults,
                  duration,
                  errorMessage: results.error
                };
              }
              return { ...r, testResults, logs: [...executionLogs] };
            }));

          } catch (testError: any) {
            totalFailed++;
            allPassed = false;
            executionLogs.push(`[${new Date().toISOString()}] ✗ ERROR: ${testCase.name} - ${testError.message}`);
            
            setTestRuns(prev => prev.map(r => {
              if (r.id !== runId) return r;
              const testResults = [...(r.testResults || [])];
              if (testResults[i]) {
                testResults[i] = {
                  ...testResults[i],
                  status: 'failed',
                  errorMessage: testError.message
                };
              }
              return { ...r, testResults, logs: [...executionLogs] };
            }));
          }
        }
      } else {
        // Parallel execution - run all tests simultaneously
        executionLogs.push(`[${new Date().toISOString()}] Starting ${testCaseIds.length} tests in parallel...`);
        
        const promises = testCaseIds.map(async (testCaseId, i) => {
          const testCase = testCases.find(tc => tc.id === testCaseId);
          if (!testCase) return { index: i, status: 'skipped', error: 'Not found' };

          const rawSteps = testCase.unified_data?.steps || testCase.steps || [];
          if (rawSteps.length === 0) return { index: i, status: 'skipped', error: 'No steps' };

          const convertedSteps = rawSteps.map(convertStepToExecutorFormat);
          const testData = {
            id: testCase.id,
            name: testCase.name,
            steps: convertedSteps,
            settings: { timeout: 30000 }
          };

          try {
            const startTime = Date.now();
            // Note: Parallel execution may need headless mode for multiple browser instances
            const results = await electronAPI.testRunner.executeHeadless?.(testData) || 
                           await electronAPI.testRunner.executeTest(testData);
            return { 
              index: i, 
              status: results.status, 
              results, 
              duration: Date.now() - startTime,
              testName: testCase.name 
            };
          } catch (e: any) {
            return { index: i, status: 'failed', error: e.message, testName: testCase.name };
          }
        });

        const parallelResults = await Promise.all(promises);
        
        parallelResults.forEach((result, i) => {
          if (result.status === 'passed') {
            totalPassed++;
            executionLogs.push(`[${new Date().toISOString()}] ✓ PASSED: ${result.testName}`);
          } else if (result.status === 'skipped') {
            totalSkipped++;
            executionLogs.push(`[${new Date().toISOString()}] ○ SKIPPED: ${testCaseIds[i]}`);
          } else {
            totalFailed++;
            allPassed = false;
            executionLogs.push(`[${new Date().toISOString()}] ✗ FAILED: ${result.testName || testCaseIds[i]}`);
          }
        });

        // Update all test results at once
        setTestRuns(prev => prev.map(r => {
          if (r.id !== runId) return r;
          const testResults = parallelResults.map((result, i) => ({
            testCaseId: testCaseIds[i],
            testName: result.testName || 'Unknown',
            status: result.status as any,
            duration: result.duration,
            errorMessage: result.error,
            stepResults: result.results?.steps?.map((s: any, idx: number) => ({
              stepIndex: idx,
              stepName: s.name || `Step ${idx + 1}`,
              status: s.status,
              duration: s.duration,
              error: s.error,
              screenshot: s.screenshot
            })) || []
          }));
          return { ...r, testResults, logs: [...executionLogs] };
        }));
      }

      // Final status update
      executionLogs.push(`[${new Date().toISOString()}] Completed: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
      
      setTestRuns(prev => {
        const updated = prev.map(r => 
          r.id === runId ? { 
            ...r, 
            status: allPassed ? 'passed' as const : 'failed' as const,
            endTime: new Date().toISOString(),
            results: { passed: totalPassed, failed: totalFailed, skipped: totalSkipped },
            logs: executionLogs,
            currentTestIndex: undefined
          } : r
        );
        localStorage.setItem('test_execution_history', JSON.stringify(updated));
        return updated;
      });

      toast.success(`Run complete: ${totalPassed} passed, ${totalFailed} failed`);
      return allPassed;

    } catch (error: any) {
      console.error('[Run] Multi-test execution error:', error);
      setTestRuns(prev => {
        const updated = prev.map(r => 
          r.id === runId ? { 
            ...r, 
            status: 'failed' as const, 
            endTime: new Date().toISOString(),
            logs: [...executionLogs, `ERROR: ${error.message}`],
            errorMessage: error.message
          } : r
        );
        localStorage.setItem('test_execution_history', JSON.stringify(updated));
        return updated;
      });
      toast.error(`Run failed: ${error.message}`);
      return false;
    } finally {
      setExecutingRunId(null);
    }
  }, [testCases, convertStepToExecutorFormat]);

  // Load suites, plans, runs, defects from backend first, then fallback to localStorage
  useEffect(() => {
    const doLoadRelated = async () => {
      const data = await loadRelatedData();
      setSuites(data.suites);
      setTestPlans(data.plans);
      setTestRuns(data.runs);
      setDefects(data.defects);
      setReleases(data.releases);
    };

    doLoadRelated();

    const handleReloadRelated = () => doLoadRelated();
    window.addEventListener('reload-related-data', handleReloadRelated);
    return () => window.removeEventListener('reload-related-data', handleReloadRelated);
  }, []);

  // Stats
  const stats = useMemo(() => ({
    totalTests: testCases.length,
    automated: testCases.filter(tc => tc.automationStatus === 'full' || tc.automationStatus === 'automated').length,
    manual: testCases.filter(tc => !tc.automationStatus || tc.automationStatus === 'none').length,
    passed: testCases.filter(tc => tc.lastResult === 'passed').length,
    failed: testCases.filter(tc => tc.lastResult === 'failed').length,
    starred: testCases.filter(tc => tc.starred).length,
    suites: suites.length,
    releases: releases.length,
    runs: testRuns.length,
    defects: defects.length,
    openDefects: defects.filter(d => ['new', 'open', 'in-progress', 'reopened'].includes(d.status)).length
  }), [testCases, suites, releases, testRuns, defects]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header with Tabs */}
      <header className="flex-none border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary">
              <FolderTree className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Test Management</h1>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {stats.totalTests} tests • {stats.suites} suites • {stats.releases} releases
                {stats.openDefects > 0 && <span className="text-red-600 dark:text-red-400"> • {stats.openDefects} open defects</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Context-aware Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder={
                  activeTab === 'repository' ? 'Search test cases...' :
                  activeTab === 'suites' ? 'Search suites...' :
                  activeTab === 'plans' ? 'Search plans...' :
                  activeTab === 'releases' ? 'Search releases...' :
                  activeTab === 'defects' ? 'Search defects...' :
                  activeTab === 'runs' ? 'Search runs...' :
                  'Search...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
              {searchLoading && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 dark:text-primary animate-spin" />
              )}
            </div>

            {/* Context-aware actions */}
            {activeTab === 'repository' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.info('Refreshing test cases and related data...');
                    window.dispatchEvent(new CustomEvent('reload-test-cases'));
                    window.dispatchEvent(new CustomEvent('reload-related-data'));
                  }}
                  className="border-gray-300 dark:border-border text-gray-600 dark:text-foreground hover:bg-accent"
                  title="Refresh test cases and related data (from backend DB when available)"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewFolderDialog(true)}
                  className="border-gray-300 dark:border-border text-gray-600 dark:text-foreground hover:bg-accent"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Folder
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewTestName('');
                    setNewTestDescription('');
                    setNewTestPriority('medium');
                    setNewTestFolder(currentFolderId);
                    setShowCreateTestDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const imported = JSON.parse(text);
                        // Handle single test case or array of test cases
                        const testCasesToImport = Array.isArray(imported) ? imported : [imported];
                        let importedCount = 0;
                        for (const tc of testCasesToImport) {
                          if (tc.id && tc.name) {
                            const newTC = {
                              ...tc,
                              id: tc.id.startsWith('tc_') ? tc.id : `tc_${Date.now()}_${importedCount}`,
                              folderId: currentFolderId,
                              createdAt: tc.createdAt || new Date().toISOString(),
                              updatedAt: new Date().toISOString()
                            };
                            setTestCases(prev => {
                              const updated = [...prev.filter(t => t.id !== newTC.id), newTC];
                              localStorage.setItem('test_cases', JSON.stringify(updated));
                              localStorage.setItem('flowstral_test_cases', JSON.stringify(updated));
                              return updated;
                            });
                            importedCount++;
                          }
                        }
                        toast.success(`Imported ${importedCount} test case(s)`);
                      } catch (err: any) {
                        toast.error(`Import failed: ${err.message}`);
                      }
                    };
                    input.click();
                  }}
                  className="border-border text-foreground hover:bg-accent"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </>
            )}
            {activeTab === 'suites' && (
              <Button
                size="sm"
                onClick={() => setShowCreateSuiteDialog(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Suite
              </Button>
            )}
            {activeTab === 'plans' && (
              <Button
                size="sm"
                onClick={() => {
                  const newPlan: TestPlan = {
                    id: `plan_${Date.now()}`,
                    name: 'New Test Plan',
                    description: '',
                    suiteIds: [],
                    testCaseIds: [],
                    status: 'draft',
                    createdAt: new Date().toISOString()
                  };
                  setTestPlans(prev => {
                    const updated = [...prev, newPlan];
                    localStorage.setItem('test_plans', JSON.stringify(updated));
                    return updated;
                  });
                  toast.success('Test plan created');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Plan
              </Button>
            )}
            {activeTab === 'releases' && (
              <Button
                size="sm"
                onClick={() => setShowCreateReleaseDialog(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Release
              </Button>
            )}
            {activeTab === 'defects' && (
              <Button
                size="sm"
                onClick={() => setShowCreateDefectDialog(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Report Defect
              </Button>
            )}
            {activeTab === 'runs' && (
              <Button
                size="sm"
                onClick={() => setShowCreateRunDialog(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Run
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation - Following proper test management workflow */}
        <div className="px-4 flex items-center gap-1 border-t border-gray-200 dark:border-gray-800/50 overflow-x-auto">
          {[
            { id: 'repository', label: 'Test Cases', icon: FolderTree, count: stats.totalTests, desc: 'All test cases' },
            { id: 'suites', label: 'Suites', icon: Layers, count: stats.suites, desc: 'Group related tests' },
            { id: 'plans', label: 'Plans', icon: Target, count: testPlans.length, desc: 'Execution plans' },
            { id: 'releases', label: 'Releases', icon: Rocket, count: stats.releases, desc: 'Sprint/version' },
            { id: 'runs', label: 'Runs', icon: PlayCircle, count: stats.runs, desc: 'Execution history' },
            { id: 'defects', label: 'Defects', icon: Bug, count: stats.defects, desc: 'Bug tracking', highlight: stats.openDefects > 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-amber-500 text-blue-600 dark:text-primary"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-white"
              )}
            >
              <tab.icon className={cn("w-4 h-4", tab.id === 'defects' && (tab as any).highlight && "text-red-400")} />
              {tab.label}
              <Badge className={cn(
                "h-5 px-1.5 text-xs",
                tab.id === 'defects' && (tab as any).highlight
                  ? "bg-red-500/20 text-red-400 border border-red-500/50"
                  : "bg-secondary text-gray-500 dark:text-gray-400"
              )}>{tab.count}</Badge>
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === 'repository' && (
        /* Main Repository content */
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Tree View */}
          <aside className="w-64 flex-none border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-900/30">
            <div className="p-2">
              {treeData && (
                <TreeItem
                  node={treeData}
                  selectedId={selectedNode?.id || null}
                  onSelect={handleSelectNode}
                  onToggle={handleToggleFolder}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onContextMenu={() => {}}
                  expandedFolders={expandedFolders}
                  onRename={handleTreeItemRename}
                  onDelete={handleTreeItemDelete}
                  onDuplicate={handleDuplicateTest}
                  testCases={testCases}
                />
              )}
            </div>
          </aside>

          {/* Main area */}
          <main className="flex-1 overflow-y-auto p-4">
            {/* Search results */}
            {searchResults ? (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Search Results ({searchResults.length})
                </h2>
                {searchResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tests found matching "{searchTerm}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {searchResults.map((tc) => (
                      <TestCaseCard
                        key={tc.id}
                        testCase={tc}
                        onSelect={() => setSelectedNode({ id: tc.id, type: 'test', name: tc.name, data: tc, depth: 0 })}
                        onRun={() => handleRunTest(tc)}
                        onEdit={() => handleEditTest(tc)}
                        onStar={() => handleStarTest(tc.id)}
                        isSelected={selectedNode?.id === tc.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-4 text-sm">
                  {breadcrumbPath.map((folder, idx) => (
                    <React.Fragment key={folder.id}>
                      {idx > 0 && <ChevronRight className="w-4 h-4 text-gray-600" />}
                      <button
                        onClick={() => setCurrentFolderId(folder.id)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded hover:bg-accent",
                          folder.id === currentFolderId ? "text-blue-600 dark:text-primary" : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {idx === 0 ? <Home className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                        <span>{folder.name.replace(/^[^\s]+\s/, '')}</span>
                      </button>
                    </React.Fragment>
                  ))}
                </div>

                {/* Stats bar */}
                {/* Stats bar with filters for enterprise scale */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={displayedTests.length > 0 && selectedTestIds.size === displayedTests.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTestIds(new Set(displayedTests.map(t => t.id)));
                          setIsMultiSelectMode(true);
                        } else {
                          setSelectedTestIds(new Set());
                          setIsMultiSelectMode(false);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500 cursor-pointer"
                      title="Select all tests on this page"
                    />
                    <Layers className="w-4 h-4 text-blue-600 dark:text-primary" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {filteredTests.length === currentFolderContent.tests.length 
                        ? `${currentFolderContent.tests.length} tests` 
                        : `${filteredTests.length} of ${currentFolderContent.tests.length} tests`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-blue-600 dark:text-primary" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">{currentFolderContent.subfolders.length} folders</span>
                  </div>
                  
                  <div className="flex-1" />
                  
                  {/* Filters for scale testing */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Status</option>
                    <option value="full">Automated</option>
                    <option value="partial">Partial</option>
                    <option value="none">Manual</option>
                  </select>
                  
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Priority</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  
                  {/* Test Type Tag Filter */}
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Types</option>
                    <option value="automation">🎭 Automation</option>
                    <option value="load">📊 Load Test</option>
                    <option value="api">🔌 API Test</option>
                    <option value="manual">📝 Manual</option>
                  </select>
                  
                  {/* Plan Filter */}
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Plans</option>
                    {testPlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({(plan.testCaseIds?.length || 0) + (plan.suiteIds?.length || 0) * 10} tests)
                      </option>
                    ))}
                  </select>
                  
                  {/* Release Filter */}
                  <select
                    value={releaseFilter}
                    onChange={(e) => setReleaseFilter(e.target.value)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Releases</option>
                    {releases.map(release => (
                      <option key={release.id} value={release.id}>
                        {release.name} {release.version && `(${release.version})`}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs bg-secondary border border-border text-foreground rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    <option value="updated">Sort by Updated</option>
                    <option value="name">Sort by Name</option>
                    <option value="priority">Sort by Priority</option>
                  </select>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {currentFolderContent.tests.filter(t => t.automationStatus === 'automated' || t.automationStatus === 'full').length} automated
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {currentFolderContent.tests.filter(t => !t.automationStatus || t.automationStatus === 'none').length} manual
                    </span>
                  </div>
                </div>

                {/* All Test Cases - Clean Table View */}
                {currentFolderContent.tests.length > 0 || currentFolderContent.subfolders.length > 0 ? (
                  <div className="space-y-1">
                    {/* Inline subfolders (quick navigation + drop targets) */}
                    {currentFolderContent.subfolders.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-800/50">
                        {currentFolderContent.subfolders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => setCurrentFolderId(folder.id)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add('border-amber-500', 'bg-amber-500/10');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/10');
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/10');
                              
                              // Check for multiple selected items first
                              const testCaseIdsJson = e.dataTransfer.getData('testCaseIds');
                              const testCaseId = e.dataTransfer.getData('testCaseId');
                              
                              if (testCaseIdsJson) {
                                // Move multiple test cases
                                const testCaseIds = JSON.parse(testCaseIdsJson) as string[];
                                setTestCases(prev => {
                                  const updated = prev.map(tc => 
                                    testCaseIds.includes(tc.id) ? { ...tc, folderId: folder.id } : tc
                                  );
                                  localStorage.setItem('test_cases', JSON.stringify(updated));
                                  return updated;
                                });
                                toast.success(`Moved ${testCaseIds.length} tests to ${folder.name}`);
                                setSelectedTestIds(new Set());
                                setIsMultiSelectMode(false);
                              } else if (testCaseId) {
                                // Move single test case
                                setTestCases(prev => {
                                  const updated = prev.map(tc => 
                                    tc.id === testCaseId ? { ...tc, folderId: folder.id } : tc
                                  );
                                  localStorage.setItem('test_cases', JSON.stringify(updated));
                                  return updated;
                                });
                                toast.success(`Moved test to ${folder.name}`);
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg border border-border hover:border-amber-500/50 hover:bg-accent transition-all text-sm"
                          >
                            <FolderOpen className="w-4 h-4 text-blue-600 dark:text-primary" />
                            <span className="text-foreground">{folder.name}</span>
                            <span className="text-xs text-gray-500">
                              ({testCases.filter(tc => tc.folderId === folder.id).length})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Multi-select Action Bar */}
                    {selectedTestIds.size > 0 && (
                      <div className="sticky top-0 z-10 flex items-center gap-3 p-3 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <Check className="w-5 h-5 text-blue-600 dark:text-primary" />
                        <span className="text-sm text-white font-medium">
                          {selectedTestIds.size} test{selectedTestIds.size > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex-1" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" className="bg-primary hover:bg-primary/90">
                              <Move className="w-4 h-4 mr-1" />
                              Move to Folder
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border">
                            <DropdownMenuItem 
                              className="text-foreground focus:bg-secondary"
                              onClick={() => handleBulkMoveToFolder(null)}
                            >
                              <Home className="w-4 h-4 mr-2" />
                              Root (Test Repository)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-secondary" />
                            {folders.filter(f => f.id !== 'root').map(folder => (
                              <DropdownMenuItem 
                                key={folder.id}
                                className="text-foreground focus:bg-secondary"
                                onClick={() => handleBulkMoveToFolder(folder.id)}
                              >
                                <Folder className="w-4 h-4 mr-2 text-blue-600 dark:text-primary" />
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={clearSelection}
                          className="text-gray-500 dark:text-gray-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Test Cases List - Using lazy loading for scale */}
                    {displayedTests.map((tc) => (
                      <div
                        key={tc.id}
                        draggable
                        onDragStart={(e) => {
                          // If this item is selected, drag all selected items
                          if (selectedTestIds.has(tc.id)) {
                            e.dataTransfer.setData('testCaseIds', JSON.stringify(Array.from(selectedTestIds)));
                          } else {
                            e.dataTransfer.setData('testCaseId', tc.id);
                          }
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey || e.shiftKey) {
                            e.preventDefault();
                            toggleTestSelection(tc.id, e);
                          } else if (!isMultiSelectMode) {
                            handleEditTest(tc);
                          } else {
                            toggleTestSelection(tc.id, e);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all group",
                          selectedTestIds.has(tc.id)
                            ? "bg-primary/20 border-primary/50"
                            : selectedNode?.id === tc.id
                            ? "bg-primary/10 border-primary/30"
                            : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 hover:bg-accent/50 hover:border-border"
                        )}
                      >
                        {/* Checkbox for multi-select */}
                        <input
                          type="checkbox"
                          checked={selectedTestIds.has(tc.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedTestIds(prev => {
                              const newSet = new Set(prev);
                              if (e.target.checked) {
                                newSet.add(tc.id);
                              } else {
                                newSet.delete(tc.id);
                              }
                              setIsMultiSelectMode(newSet.size > 0);
                              return newSet;
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-600 text-blue-600 dark:text-primary focus:ring-amber-500 flex-none cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {/* Drag handle */}
                        <GripVertical className="w-4 h-4 text-gray-600 cursor-grab active:cursor-grabbing flex-none" />
                        
                        {/* Status indicator */}
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-none",
                          tc.automationStatus === 'automated' || tc.automationStatus === 'full' ? "bg-success" :
                          tc.automationStatus === 'partial' ? "bg-warning" : "bg-muted-foreground"
                        )} />
                        
                        {/* Test info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground truncate">{tc.name}</h4>
                            <Badge className={cn(
                              "text-[10px] px-1.5",
                              (tc.automationStatus === 'automated' || tc.automationStatus === 'full') && "bg-success/10 text-success",
                              tc.automationStatus === 'partial' && "bg-warning/10 text-warning",
                              (tc.automationStatus === 'none' || !tc.automationStatus) && "bg-muted/10 text-muted-foreground"
                            )}>
                              {tc.automationStatus === 'automated' || tc.automationStatus === 'full' ? 'Automated' : 
                               tc.automationStatus === 'partial' ? 'Partial' : 'Manual'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {tc.steps?.length || 0} steps • Updated {tc.updatedAt ? new Date(tc.updatedAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-gray-500 dark:text-gray-400 hover:text-green-400 hover:bg-green-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunTest(tc);
                            }}
                            title="Run Test"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:text-primary hover:bg-amber-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTest(tc);
                            }}
                            title="Edit in Builder"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-gray-500 dark:text-gray-400 hover:text-white"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border">
                              <DropdownMenuItem 
                                className="text-foreground focus:bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newName = prompt('Enter new test name:', tc.name);
                                  if (newName && newName.trim() && newName !== tc.name) {
                                    setTestCases(prev => {
                                      const updated = prev.map(t => 
                                        t.id === tc.id 
                                          ? { ...t, name: newName.trim(), updatedAt: new Date().toISOString() } 
                                          : t
                                      );
                                      localStorage.setItem('test_cases', JSON.stringify(updated));
                                      return updated;
                                    });
                                    toast.success('Test renamed');
                                  }
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-foreground focus:bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTestConfig(tc);
                                }}
                              >
                                <Settings className="w-4 h-4 mr-2" /> Edit Configuration
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-foreground focus:bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarTest(tc.id);
                                }}
                              >
                                <Star className={cn("w-4 h-4 mr-2", tc.starred && "fill-amber-400 text-blue-600 dark:text-primary")} />
                                {tc.starred ? 'Unstar' : 'Star'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-foreground focus:bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Duplicate test case
                                  const duplicate: TestCase = {
                                    ...tc,
                                    id: `tc_${Date.now()}`,
                                    name: `${tc.name} (Copy)`,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                  };
                                  setTestCases(prev => {
                                    const updated = [...prev, duplicate];
                                    localStorage.setItem('test_cases', JSON.stringify(updated));
                                    return updated;
                                  });
                                  toast.success('Test case duplicated');
                                }}
                              >
                                <Copy className="w-4 h-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-secondary" />
                              <DropdownMenuItem 
                                className="text-red-400 focus:bg-red-500/10"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this test case?')) {
                                    // Delete from all sources (backend, electron, localStorage)
                                    await deleteTestCaseFromAllSources(tc.id);
                                    
                                    setTestCases(prev => {
                                      const updated = prev.filter(t => t.id !== tc.id);
                                      localStorage.setItem('test_cases', JSON.stringify(updated));
                                      return updated;
                                    });
                                    
                                    // Track deleted ID to prevent reloading
                                    setDeletedTestIds(prev => {
                                      const updated = new Set([...prev, tc.id]);
                                      localStorage.setItem('deleted_test_ids', JSON.stringify([...updated]));
                                      return updated;
                                    });
                                    
                                    toast.success('Test deleted');
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                    
                    {/* Load More / Infinite Scroll Controls */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Showing {displayedTests.length} of {prioritizedTests.length} tests
                          {prioritizedTests.length !== filteredTests.length && ` (${filteredTests.length} total in folder)`}
                        </span>
                        {hasMoreToLoad && (
                          <span className="text-xs text-gray-500">
                            {prioritizedTests.length - visibleCount} more to load
                          </span>
                        )}
                      </div>
                      
                      {hasMoreToLoad && (
                        <Button
                          onClick={loadMoreTests}
                          disabled={isLoadingMore}
                          className="w-full bg-secondary hover:bg-secondary border border-border text-foreground"
                        >
                          {isLoadingMore ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Load More ({Math.min(BATCH_SIZE, prioritizedTests.length - visibleCount)} tests)
                            </>
                          )}
                        </Button>
                      )}
                      
                      {!hasMoreToLoad && displayedTests.length > 0 && (
                        <p className="text-center text-xs text-gray-500">
                          All {displayedTests.length} tests loaded
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No tests yet</h3>
                    <p className="text-gray-500 mb-4">Start by recording or creating a test case</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        onClick={() => navigate('/recorder')}
                        variant="outline"
                        className="border-border text-foreground"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Record Test
                      </Button>
                      <Button
                        onClick={() => navigate('/test-cases/builder')}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Test
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* SUITES TAB */}
      {activeTab === 'suites' && (
        <SuitesTabPanel
          suites={filteredSuites}
          searchTerm={searchTerm}
          onEditSuite={handleEditSuite}
          onDeleteSuite={handleDeleteSuite}
        />
      )}

      {/* RELEASES TAB */}
      {activeTab === 'releases' && (
        <ReleasesTabPanel
          releases={filteredReleases}
          searchTerm={searchTerm}
          onEditRelease={handleEditRelease}
          onDeleteRelease={handleDeleteRelease}
        />
      )}

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <PlansTabPanel
          plans={filteredPlans}
          suites={suites}
          releases={releases}
          searchTerm={searchTerm}
          onCreatePlan={() => {
            const newPlan: TestPlan = {
              id: `plan_${Date.now()}`,
              name: 'New Test Plan',
              description: '',
              suiteIds: [],
              testCaseIds: [],
              status: 'draft',
              createdAt: new Date().toISOString()
            };
            setTestPlans(prev => {
              const updated = [...prev, newPlan];
              localStorage.setItem('test_plans', JSON.stringify(updated));
              return updated;
            });
            toast.success('Test plan created');
          }}
          onEditPlan={(plan) => {
            setEditingPlan(plan);
            setShowEditPlanDialog(true);
          }}
          onLinkPlanToRelease={(plan) => {
            setEditingPlan(plan);
            setShowLinkPlanToReleaseDialog(true);
          }}
          onDuplicatePlan={(plan) => {
            const duplicate: TestPlan = {
              ...plan,
              id: `plan_${Date.now()}`,
              name: `${plan.name} (Copy)`,
              createdAt: new Date().toISOString()
            };
            setTestPlans(prev => {
              const updated = [...prev, duplicate];
              localStorage.setItem('test_plans', JSON.stringify(updated));
              return updated;
            });
            toast.success('Plan duplicated');
          }}
          onDeletePlan={(planId) => {
            if (!confirm('Delete this test plan?')) return;
            setTestPlans(prev => {
              const updated = prev.filter(p => p.id !== planId);
              localStorage.setItem('test_plans', JSON.stringify(updated));
              return updated;
            });
            toast.success('Plan deleted');
          }}
          onRunPlan={(plan) => {
            const newRun: TestRun = {
              id: `run_${Date.now()}`,
              name: `${plan.name} - Run`,
              planId: plan.id,
              releaseId: plan.releaseId,
              mode: 'automated',
              status: 'pending',
              startTime: new Date().toISOString()
            };
            setTestRuns(prev => {
              const updated = [...prev, newRun];
              localStorage.setItem('test_execution_history', JSON.stringify(updated));
              return updated;
            });
            setActiveTab('runs');
            toast.success('Test run created from plan');
          }}
        />
      )}

      {/* RUNS TAB */}
      {activeTab === 'runs' && (
        <RunsTabPanel
          testRuns={testRuns}
          executingRunId={executingRunId}
          executingStepIndex={executingStepIndex}
          onCreateRun={() => setShowCreateRunDialog(true)}
          onExecuteRun={async (run) => {
            const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
            if (testIds.length === 0) return;
            if (run.mode === 'manual') {
              navigate(`/execution/run/${run.id}/${testIds[0]}`);
              return;
            }
            if (isElectron()) {
              if (testIds.length === 1) {
                await executeTestDirectly(testIds[0], run.id);
              } else {
                await executeMultipleTests(testIds, run.id, run.executionMode || 'sequential');
              }
            } else {
              setTestRuns(prev => {
                const updated = prev.map(r =>
                  r.id === run.id ? { ...r, status: 'running' as const } : r
                );
                localStorage.setItem('test_execution_history', JSON.stringify(updated));
                return updated;
              });
              navigate(`/test-cases/builder?testCaseId=${testIds[0]}&autoRun=true&runId=${run.id}`);
            }
          }}
          onContinueManualRun={(run) => {
            const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
            let testIdToResume = testIds[0];
            if (run.testCaseStatuses) {
              for (const id of testIds) {
                const status = run.testCaseStatuses[id];
                if (status !== 'passed' && status !== 'failed') {
                  testIdToResume = id;
                  break;
                }
              }
            }
            navigate(`/execution/run/${run.id}/${testIdToResume}`);
          }}
          onViewResults={(run) => {
            setSelectedRunForResults(run);
            setShowResultsDialog(true);
          }}
          onRerunFromRun={async (run) => {
            const testIds = run.testCaseIds || (run.testCaseId ? [run.testCaseId] : []);
            if (testIds.length === 0) return;
            const newRunId = `run_${Date.now()}`;
            const newRun: TestRun = {
              id: newRunId,
              name: `${run.name} (Re-run)`,
              testCaseId: testIds[0],
              testCaseIds: testIds,
              planId: run.planId,
              suiteId: run.suiteId,
              releaseId: run.releaseId,
              mode: run.mode,
              executionMode: run.executionMode,
              status: 'pending',
              startTime: new Date().toISOString()
            };
            setTestRuns(prev => {
              const updated = [newRun, ...prev];
              localStorage.setItem('test_execution_history', JSON.stringify(updated));
              return updated;
            });
            if (run.mode === 'manual') {
              toast.success('Starting manual re-run...');
              navigate(`/execution/run/${newRunId}/${testIds[0]}`);
              return;
            }
            if (isElectron()) {
              if (testIds.length === 1) {
                await executeTestDirectly(testIds[0], newRunId);
              } else {
                await executeMultipleTests(testIds, newRunId, run.executionMode || 'sequential');
              }
            } else {
              toast.info('Run created - click Execute to start');
            }
          }}
          onRerunFromDropdown={async (run) => {
            if (!run.testCaseId) return;
            const newRunId = `run_${Date.now()}`;
            const newRun: TestRun = {
              id: newRunId,
              name: `${run.name} (Re-run)`,
              testCaseId: run.testCaseId,
              planId: run.planId,
              suiteId: run.suiteId,
              releaseId: run.releaseId,
              mode: run.mode,
              status: 'pending',
              startTime: new Date().toISOString()
            };
            setTestRuns(prev => {
              const updated = [newRun, ...prev];
              localStorage.setItem('test_execution_history', JSON.stringify(updated));
              return updated;
            });
            if (isElectron() && run.testCaseId) {
              await executeTestDirectly(run.testCaseId, newRunId);
            }
          }}
          onDeleteRun={handleDeleteRun}
        />
      )}

      {/* DEFECTS TAB */}
      {activeTab === 'defects' && (
        <DefectsTabPanel
          defects={defects}
          testCases={testCases}
          onCreateDefect={() => setShowCreateDefectDialog(true)}
          onEditDefect={(defect) => {
            setEditingDefect(defect);
            setShowEditDefectDialog(true);
          }}
          onUpdateDefects={setDefects}
          onNavigate={(path) => navigate(path)}
        />
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Login Tests, Payment Flow"
                className="bg-secondary border-border"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <p className="text-xs text-gray-500">
              Creating in: {breadcrumbPath.map(f => f.name.replace(/^[^\s]+\s/, '')).join(' / ')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} className="bg-amber-500 hover:bg-amber-400">
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={showEditFolderDialog} onOpenChange={setShowEditFolderDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="bg-secondary border-border"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditFolderDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleSaveFolder} className="bg-amber-500 hover:bg-amber-400">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog (from context menu) */}
      <Dialog open={showRenameFolderDialog} onOpenChange={setShowRenameFolderDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-1 block">Folder Name</label>
              <Input
                value={newFolderRename}
                onChange={(e) => setNewFolderRename(e.target.value)}
                placeholder="Enter folder name"
                className="bg-secondary border-border"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFolderRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameFolderDialog(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleSaveFolderRename} className="bg-amber-500 hover:bg-amber-400">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border text-gray-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-foreground">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {deletingItem?.node.name}
              </span>
              ?
            </p>
            {deletingItem?.type === 'folder' && (
              <p className="text-sm text-blue-600 dark:text-primary bg-amber-500/10 p-3 rounded-lg">
                ⚠️ Any test cases in this folder will be moved to the root folder.
              </p>
            )}
            <p className="text-xs text-gray-500">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteConfirmDialog(false);
                setDeletingItem(null);
              }} 
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-500">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All entity editing dialogs extracted to RepositoryDialogs */}
      <RepositoryDialogs
        showEditSuiteDialog={showEditSuiteDialog}
        setShowEditSuiteDialog={setShowEditSuiteDialog}
        editingSuite={editingSuite}
        setEditingSuite={setEditingSuite}
        handleSaveSuite={handleSaveSuite}
        showEditReleaseDialog={showEditReleaseDialog}
        setShowEditReleaseDialog={setShowEditReleaseDialog}
        editingRelease={editingRelease}
        setEditingRelease={setEditingRelease}
        handleSaveRelease={handleSaveRelease}
        suites={suites}
        testPlans={testPlans}
        showCreateSuiteDialog={showCreateSuiteDialog}
        setShowCreateSuiteDialog={setShowCreateSuiteDialog}
        newSuiteName={newSuiteName}
        setNewSuiteName={setNewSuiteName}
        newSuiteDescription={newSuiteDescription}
        setNewSuiteDescription={setNewSuiteDescription}
        newSuiteTestCases={newSuiteTestCases}
        setNewSuiteTestCases={setNewSuiteTestCases}
        testCases={testCases}
        handleCreateSuite={handleCreateSuite}
        showCreateReleaseDialog={showCreateReleaseDialog}
        setShowCreateReleaseDialog={setShowCreateReleaseDialog}
        newReleaseName={newReleaseName}
        setNewReleaseName={setNewReleaseName}
        newReleaseDescription={newReleaseDescription}
        setNewReleaseDescription={setNewReleaseDescription}
        newReleaseStartDate={newReleaseStartDate}
        setNewReleaseStartDate={setNewReleaseStartDate}
        newReleaseEndDate={newReleaseEndDate}
        setNewReleaseEndDate={setNewReleaseEndDate}
        newReleaseSuites={newReleaseSuites}
        setNewReleaseSuites={setNewReleaseSuites}
        handleCreateRelease={handleCreateRelease}
        showEditPlanDialog={showEditPlanDialog}
        setShowEditPlanDialog={setShowEditPlanDialog}
        editingPlan={editingPlan}
        setEditingPlan={setEditingPlan}
        onSavePlan={() => {
          if (!editingPlan) return;
          setTestPlans(prev => {
            const updated = prev.map(p => p.id === editingPlan.id ? { ...editingPlan, updatedAt: new Date().toISOString() } : p);
            localStorage.setItem('test_plans', JSON.stringify(updated));
            return updated;
          });
          setShowEditPlanDialog(false);
          setEditingPlan(null);
          toast.success('Plan updated');
        }}
        showLinkPlanToReleaseDialog={showLinkPlanToReleaseDialog}
        setShowLinkPlanToReleaseDialog={setShowLinkPlanToReleaseDialog}
        releases={releases}
        onLinkPlanToRelease={(releaseId) => {
          if (!editingPlan) return;
          setTestPlans(prev => {
            const updated = prev.map(p => p.id === editingPlan.id ? { ...p, releaseId } : p);
            localStorage.setItem('test_plans', JSON.stringify(updated));
            return updated;
          });
          setShowLinkPlanToReleaseDialog(false);
          setEditingPlan(null);
          const relName = releases.find(r => r.id === releaseId)?.name || releaseId;
          toast.success(`Linked to ${relName}`);
        }}
        onUnlinkPlanFromRelease={() => {
          if (!editingPlan) return;
          setTestPlans(prev => {
            const updated = prev.map(p => p.id === editingPlan.id ? { ...p, releaseId: undefined } : p);
            localStorage.setItem('test_plans', JSON.stringify(updated));
            return updated;
          });
          setShowLinkPlanToReleaseDialog(false);
          setEditingPlan(null);
          toast.success('Unlinked from release');
        }}
        showRunDetailsDialog={showRunDetailsDialog}
        setShowRunDetailsDialog={setShowRunDetailsDialog}
        selectedRun={selectedRun}
        onRerunFromDetails={() => {
          if (!selectedRun) return;
          const newRun: TestRun = {
            id: `run_${Date.now()}`,
            name: `${selectedRun.name} (Re-run)`,
            planId: selectedRun.planId,
            suiteId: selectedRun.suiteId,
            releaseId: selectedRun.releaseId,
            mode: selectedRun.mode,
            status: 'pending',
            startTime: new Date().toISOString()
          };
          setTestRuns(prev => {
            const updated = [newRun, ...prev];
            localStorage.setItem('test_execution_history', JSON.stringify(updated));
            return updated;
          });
          setShowRunDetailsDialog(false);
          toast.success('Re-run scheduled');
        }}
        showCreateTestDialog={showCreateTestDialog}
        setShowCreateTestDialog={setShowCreateTestDialog}
        newTestName={newTestName}
        setNewTestName={setNewTestName}
        newTestDescription={newTestDescription}
        setNewTestDescription={setNewTestDescription}
        newTestPriority={newTestPriority}
        setNewTestPriority={setNewTestPriority}
        newTestFolder={newTestFolder}
        setNewTestFolder={setNewTestFolder}
        folders={folders}
        onCreateTestCase={() => {
          if (!newTestName.trim()) {
            toast.error('Test name is required');
            return;
          }
          const newTestCase: TestCase = {
            id: `tc_${Date.now()}`,
            name: newTestName.trim(),
            description: newTestDescription,
            folderId: newTestFolder === 'root' ? null : newTestFolder,
            priority: newTestPriority,
            status: 'draft',
            automationStatus: 'none',
            tags: [],
            steps: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setTestCases(prev => {
            const updated = [...prev, newTestCase];
            localStorage.setItem('test_cases', JSON.stringify(updated));
            return updated;
          });
          localStorage.removeItem('unified_test_case');
          localStorage.removeItem('unified_test_case_timestamp');
          setShowCreateTestDialog(false);
          toast.success('Test case created');
          navigate(`/test-cases/builder?testCaseId=${newTestCase.id}`);
        }}
        showRunTestDialog={showRunTestDialog}
        setShowRunTestDialog={setShowRunTestDialog}
        testCaseToRun={testCaseToRun}
        isApiTest={isApiTest}
        runApiTestFromRepository={async (tc) => { await runApiTestFromRepository(tc); }}
        apiRunResult={apiRunResult}
        onQuickRunTest={(tc) => {
          const runId = `run_${Date.now()}`;
          const newRun: TestRun = {
            id: runId,
            name: `Quick Run: ${tc.name}`,
            testCaseId: tc.id,
            mode: 'automated',
            status: 'running',
            startTime: new Date().toISOString()
          };
          setTestRuns(prev => {
            const updated = [newRun, ...prev];
            localStorage.setItem('test_execution_history', JSON.stringify(updated));
            return updated;
          });
          setShowRunTestDialog(false);
          navigate(`/test-cases/builder?testCaseId=${tc.id}&autoRun=true&runId=${runId}`);
        }}
        onOpenInBuilder={(tc) => {
          setShowRunTestDialog(false);
          navigate(`/test-cases/builder?testCaseId=${tc.id}`);
        }}
        onOpenInApiTesting={() => {
          setShowRunTestDialog(false);
          navigate('/api');
        }}
        onAddToTestRun={(tc) => {
          setShowRunTestDialog(false);
          setNewRunTestCases([tc.id]);
          setNewRunName(`Test Run: ${tc.name}`);
          setShowCreateRunDialog(true);
        }}
        showCreateRunDialog={showCreateRunDialog}
        setShowCreateRunDialog={setShowCreateRunDialog}
        newRunName={newRunName}
        setNewRunName={setNewRunName}
        newRunMode={newRunMode}
        setNewRunMode={setNewRunMode}
        newRunExecutionMode={newRunExecutionMode}
        setNewRunExecutionMode={setNewRunExecutionMode}
        newRunReleaseId={newRunReleaseId}
        setNewRunReleaseId={setNewRunReleaseId}
        newRunTestCases={newRunTestCases}
        setNewRunTestCases={setNewRunTestCases}
        newRunTestSearch={newRunTestSearch}
        setNewRunTestSearch={setNewRunTestSearch}
        executingRunId={executingRunId}
        onCreateRunSaveLater={() => {
          if (!newRunName.trim()) { toast.error('Run name is required'); return; }
          if (newRunTestCases.length === 0) { toast.error('Select at least one test case'); return; }
          const newRun: TestRun = {
            id: `run_${Date.now()}`,
            name: newRunName.trim(),
            mode: newRunMode,
            executionMode: newRunExecutionMode,
            releaseId: newRunReleaseId || undefined,
            testCaseIds: newRunTestCases,
            testCaseId: newRunTestCases[0],
            status: 'pending',
            startTime: new Date().toISOString(),
            results: { passed: 0, failed: 0, skipped: newRunTestCases.length }
          };
          setTestRuns(prev => {
            const updated = [newRun, ...prev];
            localStorage.setItem('test_execution_history', JSON.stringify(updated));
            return updated;
          });
          setShowCreateRunDialog(false);
          setNewRunName(''); setNewRunTestCases([]); setNewRunReleaseId('');
          setNewRunExecutionMode('sequential'); setNewRunMode('automated'); setNewRunTestSearch('');
          toast.success(`Test run created with ${newRunTestCases.length} test(s)`);
        }}
        onCreateRunAndExecute={async () => {
          if (!newRunName.trim()) { toast.error('Run name is required'); return; }
          if (newRunTestCases.length === 0) { toast.error('Select at least one test case'); return; }
          const runId = `run_${Date.now()}`;
          const newRun: TestRun = {
            id: runId,
            name: newRunName.trim(),
            mode: newRunMode,
            executionMode: newRunExecutionMode,
            releaseId: newRunReleaseId || undefined,
            testCaseIds: newRunTestCases,
            testCaseId: newRunTestCases[0],
            status: 'pending',
            startTime: new Date().toISOString()
          };
          setTestRuns(prev => {
            const updated = [newRun, ...prev];
            localStorage.setItem('test_execution_history', JSON.stringify(updated));
            return updated;
          });
          const testsToRun = [...newRunTestCases];
          const execMode = newRunExecutionMode;
          const runMode = newRunMode;
          setShowCreateRunDialog(false);
          setNewRunName(''); setNewRunTestCases([]); setNewRunReleaseId('');
          setNewRunExecutionMode('sequential'); setNewRunMode('automated'); setNewRunTestSearch('');
          if (runMode === 'manual') {
            toast.success(`Starting manual test execution for ${testsToRun.length} test(s)...`);
            navigate(`/execution/run/${runId}/${testsToRun[0]}`);
            return;
          }
          if (isElectron()) {
            toast.success(`Executing ${testsToRun.length} test(s) in ${execMode} mode...`);
            if (testsToRun.length === 1) {
              await executeTestDirectly(testsToRun[0], runId);
            } else {
              await executeMultipleTests(testsToRun, runId, execMode);
            }
          } else {
            navigate(`/test-cases/builder?testCaseId=${testsToRun[0]}&autoRun=true&runId=${runId}`);
            toast.info('Note: Multiple tests will run one at a time in web mode');
          }
        }}
        showEditTestConfigDialog={showEditTestConfigDialog}
        setShowEditTestConfigDialog={setShowEditTestConfigDialog}
        editingTestCase={editingTestCase}
        setEditingTestCase={setEditingTestCase}
        handleEditTest={handleEditTest}
        onSaveTestConfig={() => {
          if (!editingTestCase?.name?.trim()) { toast.error('Test name is required'); return; }
          setTestCases(prev => {
            const updated = prev.map(tc => tc.id === editingTestCase.id ? { ...editingTestCase, updatedAt: new Date().toISOString() } : tc);
            localStorage.setItem('test_cases', JSON.stringify(updated));
            return updated;
          });
          setShowEditTestConfigDialog(false);
          setEditingTestCase(null);
          toast.success('Test case updated');
        }}
        showResultsDialog={showResultsDialog}
        selectedRunForResults={selectedRunForResults}
        onCloseResults={() => {
          setShowResultsDialog(false);
          setSelectedRunForResults(null);
        }}
        onRerunFromResults={selectedRunForResults?.testCaseId ? async () => {
          if (!selectedRunForResults?.testCaseId) return;
          const newRunId = `run_${Date.now()}`;
          const newRun: TestRun = {
            id: newRunId,
            name: `${selectedRunForResults.name} (Re-run)`,
            testCaseId: selectedRunForResults.testCaseId,
            mode: selectedRunForResults.mode,
            status: 'pending',
            startTime: new Date().toISOString()
          };
          setTestRuns(prev => {
            const updated = [newRun, ...prev];
            localStorage.setItem('test_execution_history', JSON.stringify(updated));
            return updated;
          });
          if (isElectron() && selectedRunForResults.testCaseId) {
            await executeTestDirectly(selectedRunForResults.testCaseId, newRunId);
          }
        } : undefined}
        showCreateDefectDialog={showCreateDefectDialog}
        setShowCreateDefectDialog={setShowCreateDefectDialog}
        showEditDefectDialog={showEditDefectDialog}
        setShowEditDefectDialog={setShowEditDefectDialog}
        editingDefect={editingDefect}
        setEditingDefect={setEditingDefect}
        testRuns={testRuns}
        onCreateDefect={(defect) => {
          setDefects(prev => {
            const updated = [defect, ...prev];
            localStorage.setItem('test_defects', JSON.stringify(updated));
            return updated;
          });
          setShowCreateDefectDialog(false);
          toast.success('Defect created');
        }}
        onUpdateDefect={(defect) => {
          setDefects(prev => {
            const updated = prev.map(d => d.id === defect.id ? defect : d);
            localStorage.setItem('test_defects', JSON.stringify(updated));
            return updated;
          });
          setShowEditDefectDialog(false);
          setEditingDefect(null);
          toast.success('Defect updated');
        }}
      />
    </div>
  );
}

